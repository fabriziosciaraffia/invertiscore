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
import { comunasVecinas } from "@/lib/comunas-vecinas";
import { DIAS_NO_REPETIR } from "./inmediato";
import type { Combinacion, Evaluado } from "./seleccion";
import {
  DESCUENTO_NEGOCIABLE, DIAS_VIGENCIA_REGALO, LECTURAS_POR_CORRIDA_SEMANAL, filasDePagina, rechequearAvisos, siguienteReemplazo, type FilaPaginaSemanal, MAX_CANDIDATOS_SEMANAL, MEMORIA_SEMANAL_MS, MINIMO_SEMANAL, correspondeRegalo, VENTANA_SEMANAL_DIAS, elegirSemanal, esPrimerSemanal, rangoSemanal, repartirChequeos, siguienteAChequear, varianteDe,
  type CandidatoSemanal, type RespaldoSemanal,
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
  /** De dónde salió (05-oct-2026): ausente = sus comunas; «vecina»; «negociar» (Ajustar con descuento). */
  tramo?: "vecina" | "negociar";
  /** Puesto en /semanal en lugar de un depto que ya no está publicado (05-oct-2026): el id de ese depto. */
  reemplazaA?: string;
}

/** «Santiago Centro» (el nombre del dataset viejo) es «Santiago» en los avisos. */
const comunaDeAviso = (c: string) => (c === "Santiago Centro" ? "Santiago" : c);

type FilaRpc = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  condicion: string; direccion: string | null; fecha_entrega: string | null; url: string | null; precio_uf: number;
  antiguedad_anios: number | null; antiguedad_origen: string | null; arriendo: CandidatoGuia["arriendo"]; venta: CandidatoGuia["venta"];
  gastos_comunes: number | null; mediana_comuna: unknown | null; score_cron: number | null;
};

export type Candidato = CandidatoGuia & CandidatoSemanal;

/** El informe de renta larga más reciente de la persona que trae con qué buscar (su tasa, su pie). */
export async function origenDePersona(admin: SupabaseClient, userId: string): Promise<OrigenGuia | null> {
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

/** Todo lo que hace falta para elegir la selección de una persona: sus candidatos, cómo se evalúan y el respaldo. */
export interface PreparacionSemanal {
  perfil: PerfilBusqueda;
  origen: OrigenGuia;
  combo: Combinacion;
  candidatos: Candidato[];
  evaluar: (c: Candidato) => Promise<Evaluado | null>;
  respaldo: RespaldoSemanal<Candidato>;
}

export type Preparada = { tipo: "baja" } | { tipo: "sin-perfil"; perfil: PerfilBusqueda } | { tipo: "lista"; p: PreparacionSemanal };

/**
 * Prepara la selección de una persona sin chequear ninguna ficha. La usan el armado del domingo y el
 * prechequeo de las noches: los dos eligen con la MISMA regla. Las evaluaciones y las vecinas se leen una vez.
 */
export async function prepararSeleccion(
  admin: SupabaseClient,
  userId: string,
  cfg: { uf: number; tasa: number },
  // El aviso inmediato (05-oct-2026) prepara con los avisos NUEVOS y no mira la baja del semanal.
  opts: { nuevosDesde?: string } = {},
): Promise<Preparada> {
  const { perfil, semanalBajaAt } = await leerPerfilBusqueda(admin, userId);
  if (semanalBajaAt && !opts.nuevosDesde) return { tipo: "baja" };
  // Los avisos se evalúan como arriendo largo: un perfil de renta corta no tiene con qué compararse.
  const rango = rangoSemanal(perfil);
  const o = perfil.completo && perfil.modalidad === "ltr" && rango ? await origenDePersona(admin, userId) : null;
  if (!o || !rango) return { tipo: "sin-perfil", perfil };
  const combo: Combinacion = { piePct: perfil.piePct ?? o.piePct, plazoAnios: perfil.plazoAnios ?? o.plazoAnios };

  const desde = new Date(Date.now() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
  // Lo que ya se le avisó al momento no se repite en el semanal (05-oct-2026).
  const avisados = opts.nuevosDesde ? new Set<string>() : await avisadosAlMomento(admin, userId);
  const leerCandidatos = async (comunas: string[]): Promise<Candidato[]> => {
    if (comunas.length === 0) return [];
    const { data, error } = opts.nuevosDesde
      ? await admin.rpc("inmediato_candidatos", {
          comunas, dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, nuevos_desde: opts.nuevosDesde, max_filas: MAX_CANDIDATOS_SEMANAL,
        })
      : await admin.rpc("semanal_candidatos", {
          comunas, dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, desde, max_filas: MAX_CANDIDATOS_SEMANAL,
        });
    if (error) throw new Error(`${opts.nuevosDesde ? "inmediato" : "semanal"}_candidatos: ${error.message}`);
    return ((data ?? []) as FilaRpc[]).map(candidatoDeFila).filter((c) => !avisados.has(c.avisoId));
  };
  const propias = perfil.comunas.map(comunaDeAviso);
  const candidatos = await leerCandidatos(propias);

  const asOf = new Date();
  const memo = new Map<string, Promise<Evaluado | null>>();
  const evaluarA = (c: Candidato, factorPrecio: number): Promise<Evaluado | null> => {
    const clave = `${c.avisoId}:${factorPrecio}`;
    const ya = memo.get(clave);
    if (ya) return ya;
    const r = (async () => {
      const cc = factorPrecio === 1 ? c : { ...c, precioUF: c.precioUF * factorPrecio };
      const ctx = contextoDeFila(cc, cfg);
      // Sin la mediana guardada no se recalcula acá (sería una consulta en vivo por candidato): queda fuera.
      if (!ctx || !c.arriendo || c.medianaComuna == null) return null;
      const body = payloadDeAviso(respuestasDeAviso(avisoDeCandidato(cc), combo.piePct, o.tasa, c.arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }), ctx);
      const s = sondaConPatch(body as never, cfg.uf, c.medianaComuna as never, asOf, {});
      return { veredicto: s.veredicto, score: s.score != null ? Math.round(s.score) : null, flujo: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null };
    })();
    memo.set(clave, r);
    return r;
  };
  let vecinas: Promise<Candidato[]> | null = null;
  return {
    tipo: "lista",
    p: {
      perfil, origen: o, combo, candidatos,
      evaluar: (c) => evaluarA(c, 1),
      respaldo: {
        vecinas: () => (vecinas ??= leerCandidatos(comunasVecinas(propias))),
        evaluarConDescuento: (c) => evaluarA(c, 1 - DESCUENTO_NEGOCIABLE),
      },
    },
  };
}

/** Los deptos que se le avisaron al momento en los últimos DIAS_NO_REPETIR días. */
export async function avisadosAlMomento(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const desde = new Date(Date.now() - DIAS_NO_REPETIR * 864e5).toISOString().slice(0, 10);
  const { data, error } = await admin.from("avisos_inmediatos").select("aviso_ids").eq("user_id", userId).not("enviado_at", "is", null).gte("dia", desde);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-avisados", userId });
  return new Set((data ?? []).flatMap((r) => (r.aviso_ids ?? []) as string[]));
}

/** El chequeo de un candidato con la memoria de la semana, dentro del presupuesto de la corrida. */
export function publicadoConPresupuesto(admin: SupabaseClient, presupuesto: PresupuestoFichas) {
  const almacen = almacenPublicacion(admin);
  return async (c: Candidato): Promise<EstadoPublicacion> => {
    const r = await chequearPublicacion({ id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "guia", almacen, bajarFicha, {
      sinLeer: presupuesto.bloqueada || presupuesto.lecturas >= LECTURAS_POR_CORRIDA_SEMANAL,
      memoriaMs: MEMORIA_SEMANAL_MS,
    });
    presupuesto.lecturas += r.lectura?.gets ?? 0;
    if (r.lectura?.leida && r.lectura.motivo === "bloqueo") presupuesto.bloqueada = true;
    return r.estado;
  };
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

  const prep = await prepararSeleccion(admin, userId, cfg);
  if (prep.tipo === "baja") return "ya";
  if (prep.tipo === "sin-perfil") {
    await guardar({ estado: "sin_match", items: [], perfil: prep.perfil });
    return "sin_match";
  }
  const { perfil, origen: o, combo, candidatos, evaluar, respaldo } = prep.p;
  const g = await elegirSemanal(candidatos, evaluar, publicadoConPresupuesto(admin, presupuesto), respaldo);
  const items: ItemSemanal[] = g.items.map(({ c, ev, tramo }) => ({ ...itemDe(c, ev), ...(tramo !== "propia" ? { tramo } : {}) }));
  await guardar({ estado: g.estado, items, combinacion: combo, perfil, origen_analysis_id: o.analysisId, variante: varianteDe(userId) });
  return g.estado;
}

/**
 * El prechequeo de una noche (05-oct-2026, decisión de Fabrizio): chequea, dentro del presupuesto de la
 * corrida, los avisos que las selecciones del domingo van a necesitar. Por turnos: en cada vuelta, cada
 * persona cuya selección todavía no se puede armar con lo ya chequeado esta semana chequea UN aviso, el
 * siguiente que le pediría la selección (sus Comprar, después las vecinas, después los negociables). Así
 * el presupuesto se reparte entre todos y un mismo aviso sirve a todos los que lo necesitan.
 * `turno` corre el punto de partida de una corrida a otra.
 */
export async function prechequearSemana(
  admin: SupabaseClient,
  personas: Array<{ userId: string }>,
  cfg: { uf: number; tasa: number },
  presupuesto: PresupuestoFichas,
  opts: { turno: number; hastaMs: number },
): Promise<{ personas: number; completas: number; sinCandidatos: number; chequeos: number }> {
  const almacen = almacenPublicacion(admin);
  const enMemoria = async (c: Candidato): Promise<EstadoPublicacion> =>
    (await chequearPublicacion({ id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "guia", almacen, bajarFicha, { sinLeer: true, memoriaMs: MEMORIA_SEMANAL_MS })).estado;
  const n = personas.length;
  const orden = personas.map((_, i) => personas[(i + (opts.turno % Math.max(1, n))) % n].userId);
  const preps = new Map<string, PreparacionSemanal | null>();
  const preparar = async (userId: string) => {
    if (!preps.has(userId)) {
      const pr = await prepararSeleccion(admin, userId, cfg).catch(() => null);
      preps.set(userId, pr?.tipo === "lista" ? pr.p : null);
    }
    return preps.get(userId) ?? null;
  };
  const chequeos = await repartirChequeos(
    orden,
    async (userId) => {
      const p = await preparar(userId);
      return p ? siguienteAChequear(p.candidatos, p.evaluar, enMemoria, p.respaldo) : null;
    },
    publicadoConPresupuesto(admin, presupuesto),
    () => !presupuesto.bloqueada && presupuesto.lecturas < LECTURAS_POR_CORRIDA_SEMANAL && Date.now() < opts.hastaMs,
  );

  // El estado al cierre, con lo chequeado en la semana (de las personas que alcanzó a mirar).
  let completas = 0, sinCandidatos = 0;
  for (const [, p] of Array.from(preps)) {
    if (!p) continue;
    const sig = await siguienteAChequear(p.candidatos, p.evaluar, enMemoria, p.respaldo);
    if (sig != null) continue;
    const g = await elegirSemanal(p.candidatos, p.evaluar, enMemoria, p.respaldo);
    if (g.estado === "armada") completas++;
    else sinCandidatos++;
  }
  return { personas: preps.size, completas, sinCandidatos, chequeos };
}

function candidatoDeFila(f: FilaRpc): Candidato {
  return {
    avisoId: f.id, distanciaM: 0, scoreCron: f.score_cron, comuna: f.comuna, lat: Number(f.lat), lng: Number(f.lng),
    m2: Number(f.superficie_m2), dormitorios: Number(f.dormitorios), banos: Number(f.banos) || 1,
    condicion: f.condicion === "nuevo" ? "nuevo" : "usado", direccion: f.direccion, fechaEntrega: f.fecha_entrega, url: f.url,
    precioUF: Number(f.precio_uf), antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
    antiguedadOrigen: f.antiguedad_origen, arriendo: f.arriendo, venta: f.venta, gastosComunes: f.gastos_comunes, medianaComuna: f.mediana_comuna ?? null,
  };
}

/** Un candidato elegido, como lo guarda la selección y lo muestra el correo. */
function itemDe(c: Candidato, ev: Evaluado): ItemSemanal {
  return {
    avisoId: c.avisoId, comuna: c.comuna, tipologia: tipologiaDe(c.dormitorios, c.banos), m2: Math.round(c.m2), precioUF: Math.round(c.precioUF),
    veredicto: ev.veredicto, score: ev.score, flujo: ev.flujo,
  };
}

/** Los avisos que ya no están: despublicados, o que salieron de la evaluación. */
async function avisosCaidos(admin: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [{ data: idas }, { data: siguen }] = await Promise.all([
    admin.from("publicacion_avisos").select("aviso_id").in("aviso_id", ids).eq("estado", "despublicado"),
    admin.from("avisos_evaluados").select("aviso_id").in("aviso_id", ids),
  ]);
  const vivos = new Set((siguen ?? []).map((r) => r.aviso_id as string));
  return new Set([...(idas ?? []).map((r) => r.aviso_id as string), ...ids.filter((id) => !vivos.has(id))]);
}

/**
 * La página /semanal VIVA (05-oct-2026, decisión de Fabrizio): cada depto del correo que ya no está
 * publicado se dice, y en su lugar va el siguiente mejor del perfil —Comprar de sus comunas y de las
 * vecinas, por puntaje— con la ficha chequeada en el momento. El reemplazo se GUARDA en la selección
 * (`reemplazaA`): así «Analizar este» lo reconoce y la próxima visita no vuelve a buscar.
 */
export async function seleccionViva(
  admin: SupabaseClient,
  sel: { tabla: "semanal_selecciones" | "avisos_inmediatos"; id: string; userId: string; items: ItemSemanal[] },
  cfg: { uf: number; tasa: number },
): Promise<Array<FilaPaginaSemanal<ItemSemanal>>> {
  let items = sel.items;
  const caidos = await avisosCaidos(admin, items.map((i) => i.avisoId));
  const faltan = filasDePagina(items, caidos).filter((f) => f.caido && !f.reemplazo);
  if (faltan.length > 0) {
    const prep = await prepararSeleccion(admin, sel.userId, cfg).catch(() => null);
    if (prep?.tipo === "lista") {
      const almacen = almacenPublicacion(admin);
      const publicado = async (c: Candidato) => (await chequearPublicacion({ id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "clic", almacen, bajarFicha)).estado;
      const pool = [...prep.p.candidatos, ...(await prep.p.respaldo.vecinas().catch(() => [] as Candidato[]))];
      const excluir = new Set([...items.map((i) => i.avisoId), ...Array.from(caidos)]);
      const antes = items.length;
      for (const f of faltan) {
        const r = await siguienteReemplazo(pool, excluir, prep.p.evaluar, publicado);
        if (!r) break;
        excluir.add(r.c.avisoId);
        items = [...items, { ...itemDe(r.c, r.ev), reemplazaA: f.item.avisoId }];
      }
      if (items.length > antes) {
        const { error } = await admin.from(sel.tabla).update({ items }).eq("id", sel.id);
        reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-reemplazo", userId: sel.userId });
      }
    }
  }
  return filasDePagina(items, caidos);
}

/**
 * El domingo, después de armar (05-oct-2026): con el presupuesto que quede, se vuelven a chequear los
 * avisos de las selecciones armadas, los chequeados hace más tiempo primero. Una selección con un aviso
 * que ya no está vuelve a «pendiente» para armarse de nuevo; devuelve de quién son.
 */
export async function rechequearArmadas(admin: SupabaseClient, semana: string, presupuesto: PresupuestoFichas): Promise<{ chequeados: number; caidos: number; usuarios: string[] }> {
  const { data: sels, error } = await admin.from("semanal_selecciones").select("id, user_id, items").eq("semana", semana).eq("estado", "armada").is("enviada_at", null).order("armada_at").limit(1000);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-armadas" });
  const filas = (sels ?? []) as Array<{ id: string; user_id: string; items: ItemSemanal[] }>;
  const ids = Array.from(new Set(filas.flatMap((s) => (s.items ?? []).map((i) => i.avisoId))));
  const fechas = new Map<string, number>();
  const fichas = new Map<string, { url: string | null; comuna: string; lat: number; lng: number }>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const [{ data: pub }, { data: sp }] = await Promise.all([
      admin.from("publicacion_avisos").select("aviso_id, chequeado_at").in("aviso_id", lote),
      admin.from("scraped_properties").select("id, url, comuna, lat, lng").in("id", lote).order("id").limit(100),
    ]);
    for (const r of pub ?? []) fechas.set(r.aviso_id as string, Date.parse(r.chequeado_at as string));
    for (const r of sp ?? []) fichas.set(r.id as string, { url: (r.url as string | null) ?? null, comuna: r.comuna as string, lat: Number(r.lat), lng: Number(r.lng) });
  }
  const almacen = almacenPublicacion(admin);
  const r = await rechequearAvisos(
    ids.map((avisoId) => ({ avisoId, chequeadoAt: fechas.get(avisoId) ?? null })),
    async (avisoId) => {
      const f = fichas.get(avisoId);
      if (!f) return "sin-chequeo";
      const x = await chequearPublicacion({ id: avisoId, url: f.url, edificio: claveEdificio(f) }, "guia", almacen, bajarFicha);
      presupuesto.lecturas += x.lectura?.gets ?? 0;
      if (x.lectura?.leida && x.lectura.motivo === "bloqueo") presupuesto.bloqueada = true;
      return x.estado;
    },
    () => !presupuesto.bloqueada && presupuesto.lecturas < LECTURAS_POR_CORRIDA_SEMANAL,
  );
  const caidas = filas.filter((s) => (s.items ?? []).some((i) => r.caidos.has(i.avisoId)));
  if (caidas.length > 0) {
    const { error: e2 } = await admin.from("semanal_selecciones").update({ estado: "pendiente" }).in("id", caidas.map((s) => s.id)).eq("estado", "armada").is("enviada_at", null);
    reportarFalloQuery(e2, { ruta: RUTA, operacion: "rearmar" });
  }
  return { chequeados: r.chequeados, caidos: r.caidos.size, usuarios: caidas.map((s) => s.user_id) };
}

/**
 * La selección detrás del token de un correo (05-oct-2026): la del semanal o la de un aviso inmediato
 * (ya enviado). Los dos correos llevan a la misma página y al mismo clic; `fuente` dice cuál fue.
 * `semana` es el lunes del semanal o el día del aviso.
 */
export interface SeleccionPorToken {
  fuente: "semanal" | "inmediato";
  id: string;
  user_id: string;
  semana: string;
  items: ItemSemanal[];
  combinacion: Combinacion | null;
  origen_analysis_id: string | null;
  variante: "banda" | "tarjetas" | null;
}

export async function seleccionPorToken(admin: SupabaseClient, token: string): Promise<SeleccionPorToken | null> {
  if (!/^[0-9a-f]{20,80}$/i.test(token)) return null;
  const { data: s } = await admin.from("semanal_selecciones").select("id, user_id, semana, items, combinacion, origen_analysis_id, variante").eq("token", token).maybeSingle();
  if (s) {
    return {
      fuente: "semanal", id: s.id as string, user_id: s.user_id as string, semana: s.semana as string, items: (s.items ?? []) as ItemSemanal[],
      combinacion: (s.combinacion ?? null) as Combinacion | null, origen_analysis_id: (s.origen_analysis_id as string | null) ?? null,
      variante: (s.variante as "banda" | "tarjetas" | null) ?? null,
    };
  }
  const { data: a } = await admin.from("avisos_inmediatos").select("id, user_id, dia, items, combinacion, origen_analysis_id").eq("token", token).not("enviado_at", "is", null).maybeSingle();
  if (!a) return null;
  return {
    fuente: "inmediato", id: a.id as string, user_id: a.user_id as string, semana: a.dia as string, items: (a.items ?? []) as ItemSemanal[],
    combinacion: (a.combinacion ?? null) as Combinacion | null, origen_analysis_id: (a.origen_analysis_id as string | null) ?? null, variante: null,
  };
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
export async function otorgarRegalo(admin: SupabaseClient, userId: string): Promise<string | null> {
  await admin.from("perfil_busqueda").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const ahora = new Date();
  const { data: ganado, error } = await admin.from("perfil_busqueda").update({ regalo_otorgado_at: ahora.toISOString() })
    .eq("user_id", userId).is("regalo_otorgado_at", null).select("user_id");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-regalo", userId });
  if ((ganado?.length ?? 0) !== 1) return null;
  const vence = new Date(ahora.getTime() + DIAS_VIGENCIA_REGALO * 864e5).toISOString();
  const { error: e2 } = await admin.from("credit_grants").insert({
    user_id: userId, amount: 1, remaining: 1, source: FUENTE_REGALO_SEMANAL, granted_at: ahora.toISOString(),
    expires_at: vence,
  });
  if (e2) {
    // Sin el crédito no hay regalo: se suelta la marca para que la semana siguiente lo intente de nuevo.
    reportarFalloQuery(e2, { ruta: RUTA, operacion: "cargar-regalo", userId });
    await admin.from("perfil_busqueda").update({ regalo_otorgado_at: null }).eq("user_id", userId);
    return null;
  }
  void capturarServidor({ event: "semanal_regalo_otorgado", distinctId: userId, uuid: uuidDeterminista(`semanal_regalo:${userId}`), properties: { vence } }).catch(() => {});
  return vence;
}

/**
 * Quienes reciben el correo (05-oct-2026): toda persona con cuenta y un informe de renta larga, más
 * quien tenga perfil (`perfiles_inversion`). Antes eran solo los segundos: la tabla nació el 28-sep y
 * dejaba fuera a casi todos los que tienen informes.
 */
export async function personasSemanal(admin: SupabaseClient): Promise<Array<{ userId: string }>> {
  const ids = new Set<string>();
  const juntar = async (tabla: "perfiles_inversion" | "analisis") => {
    for (let desde = 0; ; desde += 1000) {
      let q = admin.from(tabla).select("user_id").not("user_id", "is", null);
      if (tabla === "analisis") q = q.eq("tipo_analisis", "long-term");
      const { data, error } = await q.order("id").range(desde, desde + 999);
      if (error) throw new Error(`personas (${tabla}): ${error.message}`);
      for (const r of data ?? []) ids.add(r.user_id as string);
      if ((data?.length ?? 0) < 1000) break;
    }
  };
  await juntar("perfiles_inversion");
  await juntar("analisis");
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
  const [{ data: u }, { data: pb }, { count: compras }, { count: enviadasAntes, error: eAntes }] = await Promise.all([
    admin.auth.admin.getUserById(fila.user_id),
    admin.from("perfil_busqueda").select("semanal_baja_at, regalo_otorgado_at").eq("user_id", fila.user_id).maybeSingle(),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", fila.user_id).eq("status", "paid"),
    admin.from("semanal_selecciones").select("id", { count: "exact", head: true }).eq("user_id", fila.user_id).not("enviada_at", "is", null).neq("id", fila.id),
  ]);
  // Sin poder contar los envíos anteriores no se presenta: mejor perder la presentación que repetirla.
  reportarFalloQuery(eAntes, { ruta: RUTA, operacion: "contar-enviadas", userId: fila.user_id });
  const presentacion = !eAntes && esPrimerSemanal(enviadasAntes);
  const user = u?.user;
  if (!user?.email || pb?.semanal_baja_at) return descartar();

  const { data: tomada } = await admin.from("semanal_selecciones").update({ estado: "enviada", enviada_at: new Date().toISOString() })
    .eq("id", fila.id).is("enviada_at", null).select("id");
  if ((tomada?.length ?? 0) !== 1) return "ya";

  let saldo = await leerSaldo(admin, fila.user_id);
  const regaloVence = correspondeRegalo({ registradoAt: new Date(user.created_at), compras: compras ?? 0, regaloOtorgadoAt: (pb?.regalo_otorgado_at as string | null) ?? null, plan: saldo.plan })
    ? await otorgarRegalo(admin, fila.user_id)
    : null;
  const conRegalo = regaloVence != null;
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
    regaloVence,
    presentacion,
    urlBoton: enlaces.boton,
    urlComprar: enlaces.comprar,
    urlBaja: enlaces.baja,
  });
  const r = await sendSemanalEmail(user.email, correo, fila.user_id, enlaces.baja, variante);
  if (!r.ok) {
    await admin.from("semanal_selecciones").update({ estado: "armada", enviada_at: null }).eq("id", fila.id);
    return "fallida";
  }
  await admin.from("semanal_selecciones").update({ resend_id: r.id, con_regalo: conRegalo, variante, items: deptos }).eq("id", fila.id);
  void capturarServidor({
    event: "semanal_enviado", distinctId: fila.user_id, uuid: uuidDeterminista(`semanal_enviado:${fila.id}`),
    properties: {
      semana: fila.semana, variante, n: deptos.length, con_regalo: conRegalo, saldo: saldo.plan ? "plan" : saldo.disponibles, presentacion,
      vecinas: deptos.filter((d) => d.tramo === "vecina").length, negociar: deptos.filter((d) => d.tramo === "negociar").length,
    },
  }).catch(() => {});
  return "enviada";
}

/** La combinación con que se analiza un depto del correo semanal: la de su selección, si es de esta
 *  persona, sale de este informe de origen y trae este aviso. null si no. */
export async function combinacionSemanal(admin: SupabaseClient, token: string, userId: string, origenId: string, avisoId: string): Promise<Combinacion | null> {
  if (!/^[0-9a-f]{20,80}$/i.test(token)) return null;
  const data = await seleccionPorToken(admin, token);
  if (!data || data.user_id !== userId || data.origen_analysis_id !== origenId) return null;
  if (!((data.items ?? []) as ItemSemanal[]).some((i) => i.avisoId === avisoId)) return null;
  const c = data.combinacion as Combinacion | null;
  return c && Number.isFinite(c.piePct) && Number.isFinite(c.plazoAnios) ? { piePct: c.piePct, plazoAnios: c.plazoAnios } : null;
}
