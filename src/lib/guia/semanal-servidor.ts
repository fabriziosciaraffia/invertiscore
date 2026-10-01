// ─────────────────────────────────────────────────────────────────────────────
// El correo semanal del lado del servidor (02-oct-2026): armar la selección de una persona (domingo),
// releerla antes de mandar (lunes), el regalo y el chequeo al clic. Las reglas viven en semanal.ts (puro).
//
// La ficha se chequea con los MISMOS resguardos que la guía (publicacion.ts): la memoria de 24 horas y el
// tope por hora son compartidos entre personas, así que un aviso que vio una selección no se vuelve a
// leer para la siguiente. Una corrida que se queda sin cupo deja la selección «pendiente» y la retoma la
// corrida de la hora siguiente.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { sondaConPatch } from "@/lib/analysis";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { payloadDeAviso, respuestasDeAviso } from "@/lib/avisos/evaluar-aviso";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { FUENTE_REGALO_SEMANAL } from "@/lib/credits-grant";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { leerSaldo } from "@/lib/casa-saldo";
import { nombreReal } from "@/lib/welcome";
import { sendSemanalEmail } from "@/lib/email";
import { correoSemanal, textoBusca } from "@/lib/email/correo-semanal";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";
import { avisoDeCandidato, contextoDeFila, leerOrigenGuia, type CandidatoGuia, type OrigenGuia } from "./guia-servidor";
import { chequearPublicacion, type EstadoPublicacion } from "./publicacion";
import { almacenPublicacion, bajarFicha } from "./ficha-servidor";
import { claveEdificio } from "./ficha-anio";
import type { Combinacion, Evaluado } from "./seleccion";
import {
  DIAS_VIGENCIA_REGALO, LECTURAS_POR_CORRIDA_SEMANAL, MAX_CANDIDATOS_SEMANAL, MINIMO_SEMANAL, correspondeRegalo, VENTANA_SEMANAL_DIAS, elegirSemanal, rangoSemanal, varianteDe,
  type CandidatoSemanal,
} from "./semanal";

const RUTA = "lib/guia/semanal";

/** Lo que guarda la selección y muestra el correo: sin enlace al aviso, sin textos del aviso. */
export interface ItemSemanal {
  avisoId: string;
  comuna: string;
  tipologia: string | null;
  m2: number;
  precioUF: number;
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
}

/** «Santiago Centro» (el nombre del dataset viejo) es «Santiago» en los avisos. */
const comunaDeAviso = (c: string) => (c === "Santiago Centro" ? "Santiago" : c);

type FilaRpc = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  condicion: string; direccion: string | null; fecha_entrega: string | null; url: string | null; precio_uf: number;
  antiguedad_anios: number | null; antiguedad_origen: string | null; arriendo: CandidatoGuia["arriendo"]; venta: CandidatoGuia["venta"];
  gastos_comunes: number | null; mediana_comuna: unknown | null; score_cron: number | null;
};

type Candidato = CandidatoGuia & CandidatoSemanal;

/** El informe de renta larga más reciente de la persona que trae con qué buscar (su tasa, su pie). */
async function origenDePersona(admin: SupabaseClient, userId: string): Promise<OrigenGuia | null> {
  const { data } = await admin.from("analisis").select("id").eq("user_id", userId).eq("tipo_analisis", "long-term")
    .order("created_at", { ascending: false }).limit(5);
  for (const f of data ?? []) {
    const o = await leerOrigenGuia(admin, f.id as string);
    if (o) return o;
  }
  return null;
}

export interface PresupuestoFichas {
  lecturas: number;
  bloqueada: boolean;
}

/** Arma (o deja como está) la selección de una persona para el lunes `semana`. Devuelve el estado. */
export async function armarSeleccion(
  admin: SupabaseClient,
  userId: string,
  semana: string,
  cfg: { uf: number; tasa: number },
  presupuesto: PresupuestoFichas,
): Promise<"ya" | "pendiente" | "armada" | "sin_match"> {
  const { data: previa } = await admin.from("semanal_selecciones").select("estado").eq("user_id", userId).eq("semana", semana).maybeSingle();
  if (previa && previa.estado !== "pendiente") return "ya";

  const guardar = async (fila: Record<string, unknown>) => {
    const { error } = await admin.from("semanal_selecciones").upsert({ user_id: userId, semana, armada_at: new Date().toISOString(), ...fila }, { onConflict: "user_id,semana" });
    reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-seleccion", userId });
  };

  const { perfil, semanalBajaAt } = await leerPerfilBusqueda(admin, userId);
  if (semanalBajaAt) return "ya";
  // Los avisos se evalúan como arriendo largo: un perfil de renta corta no tiene con qué compararse.
  const rango = rangoSemanal(perfil);
  const o = perfil.completo && perfil.modalidad === "ltr" && rango ? await origenDePersona(admin, userId) : null;
  if (!o || !rango) {
    await guardar({ estado: "sin_match", items: [], perfil });
    return "sin_match";
  }
  const combo: Combinacion = { piePct: perfil.piePct ?? o.piePct, plazoAnios: perfil.plazoAnios ?? o.plazoAnios };

  const desde = new Date(Date.now() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
  const { data, error } = await admin.rpc("semanal_candidatos", {
    comunas: perfil.comunas.map(comunaDeAviso), dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, desde, max_filas: MAX_CANDIDATOS_SEMANAL,
  });
  if (error) throw new Error(`semanal_candidatos: ${error.message}`);
  const candidatos: Candidato[] = ((data ?? []) as FilaRpc[]).map((f) => ({
    avisoId: f.id, distanciaM: 0, scoreCron: f.score_cron, comuna: f.comuna, lat: Number(f.lat), lng: Number(f.lng),
    m2: Number(f.superficie_m2), dormitorios: Number(f.dormitorios), banos: Number(f.banos) || 1,
    condicion: f.condicion === "nuevo" ? "nuevo" : "usado", direccion: f.direccion, fechaEntrega: f.fecha_entrega, url: f.url,
    precioUF: Number(f.precio_uf), antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
    antiguedadOrigen: f.antiguedad_origen, arriendo: f.arriendo, venta: f.venta, gastosComunes: f.gastos_comunes, medianaComuna: f.mediana_comuna ?? null,
  }));

  const asOf = new Date();
  const evaluar = async (c: Candidato): Promise<Evaluado | null> => {
    const ctx = contextoDeFila(c, cfg);
    // Sin la mediana guardada no se recalcula acá (sería una consulta en vivo por candidato): queda fuera.
    if (!ctx || !c.arriendo || c.medianaComuna == null) return null;
    const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(c), combo.piePct, o.tasa, c.arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }), ctx);
    const s = sondaConPatch(body as never, cfg.uf, c.medianaComuna as never, asOf, {});
    return { veredicto: s.veredicto, score: s.score != null ? Math.round(s.score) : null, flujo: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null };
  };
  const almacen = almacenPublicacion(admin);
  const publicado = async (c: Candidato): Promise<EstadoPublicacion> => {
    const r = await chequearPublicacion({ id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "guia", almacen, bajarFicha, {
      sinLeer: presupuesto.bloqueada || presupuesto.lecturas >= LECTURAS_POR_CORRIDA_SEMANAL,
    });
    presupuesto.lecturas += r.lectura?.gets ?? 0;
    if (r.lectura?.leida && r.lectura.motivo === "bloqueo") presupuesto.bloqueada = true;
    return r.estado;
  };

  const g = await elegirSemanal(candidatos, evaluar, publicado);
  const items: ItemSemanal[] = g.items.map(({ c, ev }) => ({
    avisoId: c.avisoId, comuna: c.comuna, tipologia: tipologiaDe(c.dormitorios, c.banos), m2: Math.round(c.m2), precioUF: Math.round(c.precioUF),
    veredicto: ev.veredicto, score: ev.score, flujo: ev.flujo,
  }));
  await guardar({ estado: g.estado, items, combinacion: combo, perfil, origen_analysis_id: o.analysisId, variante: varianteDe(userId) });
  return g.estado;
}

/** Los deptos de una selección que siguen en pie: sin despublicados y todavía evaluados. */
export async function itemsVigentes(admin: SupabaseClient, items: ItemSemanal[]): Promise<ItemSemanal[]> {
  const ids = items.map((i) => i.avisoId);
  if (ids.length === 0) return [];
  const [{ data: idas }, { data: siguen }] = await Promise.all([
    admin.from("publicacion_avisos").select("aviso_id").in("aviso_id", ids).eq("estado", "despublicado"),
    admin.from("avisos_evaluados").select("aviso_id").in("aviso_id", ids),
  ]);
  const fuera = new Set((idas ?? []).map((r) => r.aviso_id as string));
  const vivos = new Set((siguen ?? []).map((r) => r.aviso_id as string));
  return items.filter((i) => !fuera.has(i.avisoId) && vivos.has(i.avisoId));
}

/** El clic en un depto del correo: la ficha se chequea de nuevo (con la memoria y el tope de siempre). */
export async function chequearAlClic(admin: SupabaseClient, avisoId: string): Promise<EstadoPublicacion> {
  const { data } = await admin.from("scraped_properties").select("id, url, comuna, lat, lng").eq("id", avisoId).order("id").limit(1);
  const f = data?.[0];
  if (!f || f.lat == null || f.lng == null) return "sin-chequeo";
  const r = await chequearPublicacion(
    { id: f.id as string, url: (f.url as string | null) ?? null, edificio: claveEdificio({ comuna: f.comuna as string, lat: Number(f.lat), lng: Number(f.lng) }) },
    "clic", almacenPublicacion(admin), bajarFicha,
  );
  return r.estado;
}

/**
 * El regalo, una vez por persona: se marca `regalo_otorgado_at` con un UPDATE condicional (dos corridas
 * no regalan dos veces) y recién entonces se carga el crédito, que vence a los 60 días.
 */
export async function otorgarRegalo(admin: SupabaseClient, userId: string): Promise<boolean> {
  await admin.from("perfil_busqueda").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const ahora = new Date();
  const { data: ganado, error } = await admin.from("perfil_busqueda").update({ regalo_otorgado_at: ahora.toISOString() })
    .eq("user_id", userId).is("regalo_otorgado_at", null).select("user_id");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-regalo", userId });
  if ((ganado?.length ?? 0) !== 1) return false;
  const { error: e2 } = await admin.from("credit_grants").insert({
    user_id: userId, amount: 1, remaining: 1, source: FUENTE_REGALO_SEMANAL, granted_at: ahora.toISOString(),
    expires_at: new Date(ahora.getTime() + DIAS_VIGENCIA_REGALO * 864e5).toISOString(),
  });
  if (e2) {
    // Sin el crédito no hay regalo: se suelta la marca para que la semana siguiente lo intente de nuevo.
    reportarFalloQuery(e2, { ruta: RUTA, operacion: "cargar-regalo", userId });
    await admin.from("perfil_busqueda").update({ regalo_otorgado_at: null }).eq("user_id", userId);
    return false;
  }
  void capturarServidor({ event: "semanal_regalo_otorgado", distinctId: userId, uuid: uuidDeterminista(`semanal_regalo:${userId}`), properties: {} }).catch(() => {});
  return true;
}

/** Quienes reciben el correo: toda persona con cuenta y al menos un informe. */
export async function personasSemanal(admin: SupabaseClient): Promise<Array<{ userId: string }>> {
  const ids = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin.from("perfiles_inversion").select("user_id").not("user_id", "is", null).order("id").range(desde, desde + 999);
    if (error) throw new Error(`personas: ${error.message}`);
    for (const r of data ?? []) ids.add(r.user_id as string);
    if ((data?.length ?? 0) < 1000) break;
  }
  return Array.from(ids).map((userId) => ({ userId }));
}

export interface FilaSeleccion {
  id: string;
  user_id: string;
  semana: string;
  items: ItemSemanal[];
  combinacion: Combinacion | null;
  perfil: PerfilBusqueda | null;
  variante: "banda" | "tarjetas" | null;
  token: string;
}

/** Los enlaces del correo: todos pasan por /api/semanal (miden el clic y releen la ficha). */
export function enlacesSemanal(sitio: string, token: string) {
  const base = `${sitio}/api/semanal`;
  return {
    depto: (avisoId: string) => `${base}/clic?t=${token}&a=${avisoId}`,
    boton: `${base}/clic?t=${token}`,
    comprar: `${base}/clic?t=${token}&ir=comprar`,
    baja: `${base}/baja?t=${token}`,
  };
}

/**
 * El lunes: relee la selección (sin los que se despublicaron desde el domingo), decide el regalo, manda
 * el correo una sola vez (la fila se marca enviada ANTES de mandar; si Resend falla, se suelta) y mide.
 */
export async function enviarSeleccion(admin: SupabaseClient, fila: FilaSeleccion, sitio: string): Promise<"enviada" | "descartada" | "ya" | "fallida"> {
  const descartar = async () => {
    await admin.from("semanal_selecciones").update({ estado: "descartada" }).eq("id", fila.id).is("enviada_at", null);
    return "descartada" as const;
  };
  const deptos = await itemsVigentes(admin, fila.items ?? []);
  if (deptos.length < MINIMO_SEMANAL || !fila.combinacion || !fila.perfil) return descartar();
  const [{ data: u }, { data: pb }, { count: compras }] = await Promise.all([
    admin.auth.admin.getUserById(fila.user_id),
    admin.from("perfil_busqueda").select("semanal_baja_at, regalo_otorgado_at").eq("user_id", fila.user_id).maybeSingle(),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", fila.user_id).eq("status", "paid"),
  ]);
  const user = u?.user;
  if (!user?.email || pb?.semanal_baja_at) return descartar();

  const { data: tomada } = await admin.from("semanal_selecciones").update({ estado: "enviada", enviada_at: new Date().toISOString() })
    .eq("id", fila.id).is("enviada_at", null).select("id");
  if ((tomada?.length ?? 0) !== 1) return "ya";

  let saldo = await leerSaldo(admin, fila.user_id);
  const conRegalo = correspondeRegalo({ registradoAt: new Date(user.created_at), compras: compras ?? 0, regaloOtorgadoAt: (pb?.regalo_otorgado_at as string | null) ?? null, plan: saldo.plan })
    && (await otorgarRegalo(admin, fila.user_id));
  if (conRegalo) saldo = await leerSaldo(admin, fila.user_id);

  const variante = fila.variante ?? varianteDe(fila.user_id);
  const enlaces = enlacesSemanal(sitio, fila.token);
  const correo = correoSemanal({
    variante,
    nombre: nombreReal(user.user_metadata),
    busca: textoBusca(fila.perfil),
    piePct: fila.combinacion.piePct,
    plazoAnios: fila.combinacion.plazoAnios,
    deptos: deptos.map((d) => ({ ...d, url: enlaces.depto(d.avisoId) })),
    saldo: saldo.plan ? null : saldo.disponibles,
    conRegalo,
    urlBoton: enlaces.boton,
    urlComprar: enlaces.comprar,
    urlBaja: enlaces.baja,
  });
  const r = await sendSemanalEmail(user.email, correo, fila.user_id, enlaces.baja);
  if (!r.ok) {
    await admin.from("semanal_selecciones").update({ estado: "armada", enviada_at: null }).eq("id", fila.id);
    return "fallida";
  }
  await admin.from("semanal_selecciones").update({ resend_id: r.id, con_regalo: conRegalo, variante, items: deptos }).eq("id", fila.id);
  void capturarServidor({
    event: "semanal_enviado", distinctId: fila.user_id, uuid: uuidDeterminista(`semanal_enviado:${fila.id}`),
    properties: { semana: fila.semana, variante, n: deptos.length, con_regalo: conRegalo, saldo: saldo.plan ? "plan" : saldo.disponibles },
  }).catch(() => {});
  return "enviada";
}

/** La combinación con que se analiza un depto del correo semanal: la de su selección, si es de esta
 *  persona, sale de este informe de origen y trae este aviso. null si no. */
export async function combinacionSemanal(admin: SupabaseClient, token: string, userId: string, origenId: string, avisoId: string): Promise<Combinacion | null> {
  if (!/^[0-9a-f]{20,80}$/i.test(token)) return null;
  const { data } = await admin.from("semanal_selecciones").select("user_id, origen_analysis_id, combinacion, items").eq("token", token).maybeSingle();
  if (!data || data.user_id !== userId || data.origen_analysis_id !== origenId) return null;
  if (!((data.items ?? []) as ItemSemanal[]).some((i) => i.avisoId === avisoId)) return null;
  const c = data.combinacion as Combinacion | null;
  return c && Number.isFinite(c.piePct) && Number.isFinite(c.plazoAnios) ? { piePct: c.piePct, plazoAnios: c.plazoAnios } : null;
}
