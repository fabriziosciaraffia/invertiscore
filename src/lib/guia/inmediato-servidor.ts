// ─────────────────────────────────────────────────────────────────────────────
// El aviso inmediato del lado del servidor (05-oct-2026). Las reglas viven en inmediato.ts (puro); acá se
// lee el perfil y el «Ya», se elige con la misma preparación que el semanal (pero con los avisos NUEVOS),
// se chequean las fichas con el presupuesto de siempre y se manda UN correo por día por persona. La fila
// del día se toma antes de mandar y se suelta si Resend falla.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { leerSaldo } from "@/lib/casa-saldo";
import { nombreReal } from "@/lib/welcome";
import { sendInmediatoEmail, sendPreguntaYaEmail } from "@/lib/email";
import { textoBusca } from "@/lib/email/correo-semanal";
import { correoInmediato, correoPreguntaYa } from "@/lib/email/correo-inmediato";
import { RUTA_SUELTO_INMEDIATO, diaDelAviso, elegirInmediato, estadoYa, mandaSeleccionDiaria, ventanaNuevosHoras, type HorizonteCompra } from "./inmediato";
import { avisadosAlMomento, prepararSeleccion, publicadoConPresupuesto, type ItemSemanal, type PresupuestoFichas } from "./semanal-servidor";
import { prepararSeleccionStr } from "./semanal-str-servidor";
import type { Candidato } from "./semanal-candidatos";
import type { Combinacion, Evaluado } from "./seleccion";
import type { EstadoPublicacion } from "./publicacion";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";

const RUTA = "lib/guia/inmediato";
const fecha = (s: string | null | undefined) => (s ? new Date(s) : null);

/** Los enlaces del aviso: el clic y la compra pasan por /api/semanal (la misma página); la baja es propia. */
export function enlacesInmediato(sitio: string, token: string) {
  return {
    depto: (avisoId: string) => `${sitio}/api/semanal/clic?t=${token}&a=${avisoId}`,
    boton: `${sitio}/api/semanal/clic?t=${token}`,
    comprar: `${sitio}/api/semanal/clic?t=${token}&ir=comprar`,
    baja: `${sitio}/api/inmediato/baja?t=${token}`,
  };
}

export type ResultadoInmediato = "enviado" | "pregunta" | "nada" | "ya" | "no" | "fallido";

/** La pregunta de los 60 días, una vez: se marca antes de mandar (dos corridas no la mandan dos veces). */
async function preguntar(admin: SupabaseClient, userId: string, yaDesde: Date, sitio: string): Promise<ResultadoInmediato> {
  const token = randomBytes(18).toString("hex");
  await admin.from("perfil_busqueda").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: ganada, error } = await admin.from("perfil_busqueda").update({ ya_pregunta_at: new Date().toISOString(), ya_pregunta_token: token })
    .eq("user_id", userId).or(`ya_pregunta_at.is.null,ya_pregunta_at.lt.${yaDesde.toISOString()}`).select("user_id");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-pregunta", userId });
  if ((ganada?.length ?? 0) !== 1) return "ya";
  const { data: u } = await admin.auth.admin.getUserById(userId);
  if (!u?.user?.email) return "no";
  const correo = correoPreguntaYa({ nombre: nombreReal(u.user.user_metadata), urlRespuesta: (h) => `${sitio}/api/inmediato/horizonte?t=${token}&h=${h}` });
  const ok = await sendPreguntaYaEmail(u.user.email, correo, userId);
  if (!ok) {
    await admin.from("perfil_busqueda").update({ ya_pregunta_at: null, ya_pregunta_token: null }).eq("user_id", userId).eq("ya_pregunta_token", token);
    return "fallido";
  }
  void capturarServidor({ event: "aviso_inmediato_pregunta", distinctId: userId, uuid: uuidDeterminista(`aviso_inmediato_pregunta:${token}`), properties: {} }).catch(() => {});
  return "pregunta";
}

/** Lo que hace falta de una preparación (renta larga o corta) para elegir el aviso del día. */
export interface PreparacionInmediato {
  perfil: PerfilBusqueda;
  origen: { analysisId: string | null };
  combo: Combinacion;
  candidatos: Candidato[];
  evaluar: (c: Candidato) => Promise<Evaluado | null>;
}

/**
 * QUÉ LLEVA LA SELECCIÓN DEL DÍA (26-oct-2026). Hasta hoy el aviso era solo de renta larga: quien dijo «Quiero comprar
 * ya» con un perfil de renta corta —dos de las tres personas reales con «Ya»— quedaba «sin-perfil» todos los días y no
 * recibía nada, aunque el dashboard le promete una selección diaria. Ahora: primero renta larga; si no tiene ese perfil,
 * renta corta, con los nuevos de su zona estimados como el bloque corto del semanal. La primera de cada persona mira los
 * nuevos de la semana (`ventanaNuevosHoras`). null: no tiene con qué buscar. Lo prueba el tier PAUTA-ARREGLOS.
 */
export async function seleccionDelDia(
  deps: {
    ltr: (nuevosDesde: string) => Promise<PreparacionInmediato | null>;
    str: (nuevosDesde: string) => Promise<PreparacionInmediato | null>;
    avisados: () => Promise<ReadonlySet<string>>;
    publicado: (c: Candidato) => Promise<EstadoPublicacion>;
    primera: () => Promise<boolean>;
  },
  ahora: Date = new Date(),
): Promise<{ modalidad: "ltr" | "str"; prep: PreparacionInmediato; elegidos: Array<{ c: Candidato; ev: Evaluado }>; nuevosDesde: string } | null> {
  const nuevosDesde = new Date(ahora.getTime() - ventanaNuevosHoras(await deps.primera()) * 3600_000).toISOString().replace("Z", "");
  const ltr = await deps.ltr(nuevosDesde);
  const str = ltr ? null : await deps.str(nuevosDesde);
  const prep = ltr ?? str;
  if (!prep) return null;
  const elegidos = await elegirInmediato(prep.candidatos, await deps.avisados(), prep.evaluar, deps.publicado);
  return { modalidad: ltr ? "ltr" : "str", prep, elegidos, nuevosDesde };
}

/** El aviso del día de una persona (o la pregunta, si su «Ya» cumplió 60 días sin compra). */
export async function avisarPersona(
  admin: SupabaseClient,
  userId: string,
  cfg: { uf: number; tasa: number },
  presupuesto: PresupuestoFichas,
  sitio: string,
  ahora: Date = new Date(),
): Promise<ResultadoInmediato> {
  const lp = await leerPerfilBusqueda(admin, userId);
  const { data: pago } = await admin.from("payments").select("created_at").eq("user_id", userId).eq("status", "paid")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const yaDesde = fecha(lp.horizonteDesde);
  const estado = estadoYa({
    horizonte: (lp.perfil.horizonte as HorizonteCompra | null) ?? null,
    yaDesde, ultimaCompra: fecha(pago?.created_at as string | undefined), preguntaAt: fecha(lp.yaPreguntaAt), bajaAt: fecha(lp.inmediatoBajaAt), ahora,
  });
  if (estado === "preguntar" && yaDesde) return preguntar(admin, userId, yaDesde, sitio);
  if (estado !== "vigente") return "no";

  const dia = diaDelAviso(ahora);
  const { data: hoy } = await admin.from("avisos_inmediatos").select("id, enviado_at").eq("user_id", userId).eq("dia", dia).maybeSingle();
  if (hoy?.enviado_at) return "ya";

  const sel = await seleccionDelDia({
    ltr: async (nuevosDesde) => { const p = await prepararSeleccion(admin, userId, cfg, { nuevosDesde, perfilLeido: lp }); return p.tipo === "lista" ? p.p : null; },
    str: async (nuevosDesde) => { const p = await prepararSeleccionStr(admin, userId, cfg, { perfilStr: lp.perfilStr, soloManual: true }, undefined, { nuevosDesde }); return p?.tipo === "lista" ? p.p : null; },
    avisados: () => avisadosAlMomento(admin, userId),
    publicado: publicadoConPresupuesto(admin, presupuesto),
    primera: async () => {
      const { count } = await admin.from("avisos_inmediatos").select("id", { count: "exact", head: true }).eq("user_id", userId).not("enviado_at", "is", null);
      return (count ?? 0) === 0;
    },
  }, ahora);
  if (!sel) return "no";
  const { modalidad, prep: { perfil, origen, combo }, elegidos } = sel;
  // La selección diaria (24-oct-2026): si hoy no hay nuevos que convengan, no se manda nada.
  if (!mandaSeleccionDiaria(elegidos.length)) return "nada";

  const items: ItemSemanal[] = elegidos.map(({ c, ev }) => ({
    avisoId: c.avisoId, comuna: c.comuna, tipologia: tipologiaDe(c.dormitorios, c.banos), m2: Math.round(c.m2), precioUF: Math.round(c.precioUF),
    veredicto: ev.veredicto, score: ev.score, flujo: ev.flujo,
  }));
  const fila = { user_id: userId, dia, items, aviso_ids: items.map((i) => i.avisoId), combinacion: combo, perfil, origen_analysis_id: origen.analysisId, modalidad, enviado_at: new Date().toISOString() };
  // Se toma la fila del día ANTES de mandar: dos corridas no mandan dos correos el mismo día.
  const { data: tomada } = hoy
    ? await admin.from("avisos_inmediatos").update(fila).eq("id", hoy.id).is("enviado_at", null).select("id, token").maybeSingle()
    : await admin.from("avisos_inmediatos").insert(fila).select("id, token").maybeSingle();
  if (!tomada) return "ya";

  const [{ data: u }, saldo] = await Promise.all([admin.auth.admin.getUserById(userId), leerSaldo(admin, userId)]);
  const usuario = u?.user ?? null;
  const email = usuario?.email;
  const enlaces = enlacesInmediato(sitio, tomada.token as string);
  if (!email) {
    await admin.from("avisos_inmediatos").update({ enviado_at: null }).eq("id", tomada.id);
    return "no";
  }
  const correo = correoInmediato({
    nombre: nombreReal(usuario?.user_metadata),
    busca: textoBusca(perfil),
    piePct: combo.piePct,
    plazoAnios: combo.plazoAnios,
    deptos: items.map((d) => ({ ...d, url: enlaces.depto(d.avisoId) })),
    saldo: saldo.plan ? null : saldo.disponibles,
    urlBoton: enlaces.boton,
    urlComprar: enlaces.comprar,
    urlBaja: enlaces.baja,
  });
  const r = await sendInmediatoEmail(email, correo, userId, enlaces.baja);
  if (!r.ok) {
    await admin.from("avisos_inmediatos").update({ enviado_at: null }).eq("id", tomada.id);
    return "fallido";
  }
  await admin.from("avisos_inmediatos").update({ resend_id: r.id }).eq("id", tomada.id);
  void capturarServidor({
    event: "aviso_inmediato_enviado", distinctId: userId, uuid: uuidDeterminista(`aviso_inmediato_enviado:${tomada.id}`),
    properties: { dia, n: items.length, saldo: saldo.plan ? "plan" : saldo.disponibles },
  }).catch(() => {});
  return "enviado";
}

/** La ruta de compra del suelto que vino del aviso (la usa el clic de «Analizar uno · $9.990»). */
export const rutaSueltoInmediato = () => RUTA_SUELTO_INMEDIATO;
