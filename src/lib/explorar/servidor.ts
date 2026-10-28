// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR del lado del servidor (23-oct-2026): los pines salen de la RPC `explorar_pines` —el mismo universo que
// deptos_conteo y el semanal, solo los Comprar con ese pie y ese plazo—, paginados con `range` (PostgREST corta en
// 1.000 sin avisar y una comuna puede pasar de mil); los ya analizados, de los informes de la cuenta hechos desde un
// aviso; el saldo, el ticket y la tasa y la UF para el aviso antes de gastar. NADA ACÁ ESCRIBE: explorar no gasta y no
// toca el perfil. Las reglas puras viven en explorar.ts.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { MEMORIA_SEMANAL_MS, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { condicionDe } from "@/lib/guia/linea-depto";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { leerConfigGuia, origenSintetico, type CandidatoGuia } from "@/lib/guia/guia-servidor";
import { candidatoDeFila, type FilaRpc } from "@/lib/guia/semanal-candidatos";
import { sondaDeCandidato, type SondaDeAviso } from "@/lib/avisos/estandar-deptos";
import { estadoSaldo, leerSaldo, type EstadoSaldo } from "@/lib/casa-saldo";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import type { EventoServidor } from "@/lib/posthog-servidor";
import type { MotivoRobot } from "@/lib/vista-entrada";
import {
  claveCombo, comboVigente, dormsDe, esCombinacionDeLaNoche, explorarCerrado, FILTROS_POR_DEFECTO, filtrosDePerfil, pieDeLaNoche, pinCerrado, plazoDeLaNoche, porPuntaje, soloComprar,
  type ComboGuardado, type FiltrosExplorar, type PinExplorar,
} from "./explorar";

const RUTA = "lib/explorar";
/** Lo que trae cada página de la RPC: el tope de PostgREST, pedido a propósito. */
export const PAGINA_PINES = 1000;
/** Un tope de cordura: ocho comunas con todo no llegan ni a la mitad. */
const TOPE_PINES = 20000;

const desdeVentana = (ahora: Date) => new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

type FilaPin = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  precio_uf: number; veredicto: string | null; score: number | null; flujo: number | null; arriendo: number | null;
  pub_estado: string | null; pub_at: string | null;
};

function parametros(f: FiltrosExplorar, ahora: Date) {
  return { comunas: f.comunas.map(comunaDeAviso), dorms: dormsDe(f.tipologias), uf_min: f.ufMin, uf_max: f.ufMax, desde: desdeVentana(ahora), pie: f.pie, plazo: f.plazo };
}

/** Cuánto costó una lectura: cuántos avisos se calcularon en el momento y los milisegundos. Lo llena pinesExplorar. */
export interface CuentaExplorar { calculados: number; ms: number }

/** Qué usa el cálculo al vuelo; se inyecta para probarlo sin motor ni base. */
export interface DepsCalculo {
  sonda?: (c: CandidatoGuia, combo: { piePct: number; plazoAnios: number }, cfg: { uf: number; tasa: number }, asOf: Date) => SondaDeAviso | null;
  cfg?: { uf: number; tasa: number };
}

/**
 * Todos los pines de una búsqueda, por puntaje: los Comprar con ese pie y ese plazo. Una combinación de la noche sale de
 * sus columnas (RPC explorar_pines); cualquier otra, de lo guardado en `combos` o del cálculo al vuelo (pinesCalculados).
 */
export async function pinesExplorar(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date(), cuenta?: CuentaExplorar, deps: DepsCalculo = {}): Promise<PinExplorar[]> {
  const t0 = Date.now();
  const [pines, noUsados] = await Promise.all([
    esCombinacionDeLaNoche(f) ? pinesDeLaNoche(admin, f, ahora) : pinesCalculados(admin, f, ahora, cuenta, deps),
    avisosNoUsados(admin, ahora),
  ]);
  if (cuenta) cuenta.ms = Date.now() - t0;
  return conCondicionDePines(pines, noUsados);
}

/**
 * NUEVO O USADO EN LOS PINES (28-oct-2026, la línea de la tarjeta y de la hoja, linea-depto.ts). Las RPC de los pines no
 * traen la condición, y pedirla por id serían decenas de pedidos con miles de pines. Pero los pines son siempre avisos de
 * venta activos de la ventana (`scraped_at >= desde`, las dos RPC), y casi todos dicen «usado»: se leen solo los de la
 * ventana que NO dicen «usado» —los nuevos y los que no dicen nada, unas pocas filas, 142 ms medido—, en paralelo con los
 * pines. Un pin que no está ahí dice «usado»; uno que está, «nuevo» o nada. Si la lectura falla (null), ningún pin lleva la
 * palabra: nunca se supone.
 */
export async function avisosNoUsados(admin: SupabaseClient, ahora: Date): Promise<Map<string, unknown> | null> {
  try {
    const out = new Map<string, unknown>();
    for (let desde = 0; ; desde += PAGINA_POSTGREST) {
      const { data, error } = await admin.from("scraped_properties").select("id, condicion")
        .eq("is_active", true).eq("type", "venta").gte("scraped_at", desdeVentana(ahora)).or("condicion.is.null,condicion.neq.usado")
        .order("id").range(desde, desde + PAGINA_POSTGREST - 1);
      if (error) { reportarFalloQuery(error, { ruta: RUTA, operacion: "no-usados" }); return null; }
      for (const r of (data ?? []) as Array<{ id: string; condicion: unknown }>) out.set(r.id, r.condicion);
      if ((data?.length ?? 0) < PAGINA_POSTGREST) return out;
    }
  } catch {
    return null;
  }
}

/** Cada pin con su condición, según los que no dicen «usado» (avisosNoUsados). */
export function conCondicionDePines(pines: PinExplorar[], noUsados: ReadonlyMap<string, unknown> | null): PinExplorar[] {
  if (!noUsados) return pines;
  return pines.map((p) => {
    const c = noUsados.has(p.avisoId) ? condicionDe(noUsados.get(p.avisoId)) : "usado";
    return c ? { ...p, condicion: c } : p;
  });
}

async function pinesDeLaNoche(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date): Promise<PinExplorar[]> {
  const params = parametros(f, ahora);
  const filas: FilaPin[] = [];
  for (let desde = 0; desde < TOPE_PINES; desde += PAGINA_PINES) {
    const { data, error } = await admin.rpc("explorar_pines", params).range(desde, desde + PAGINA_PINES - 1);
    if (error) throw new Error(`explorar_pines: ${error.message}`);
    const pagina = (data ?? []) as FilaPin[];
    filas.push(...pagina);
    if (pagina.length < PAGINA_PINES) break;
  }
  const fresco = (f: FilaPin) => f.pub_estado === "publicado" && !!f.pub_at && ahora.getTime() - Date.parse(f.pub_at) < MEMORIA_SEMANAL_MS;
  const pines: PinExplorar[] = filas.map((f) => ({
    avisoId: f.id, comuna: f.comuna, lat: Number(f.lat), lng: Number(f.lng), m2: Math.round(Number(f.superficie_m2)),
    dormitorios: Number(f.dormitorios), tipologia: tipologiaDe(f.dormitorios, f.banos), precioUF: Math.round(Number(f.precio_uf)),
    veredicto: f.veredicto ?? "", score: f.score, flujo: f.flujo, arriendo: f.arriendo != null && f.arriendo > 0 ? f.arriendo : null,
    vistoAt: fresco(f) ? f.pub_at : null,
  }));
  return porPuntaje(soloComprar(pines));
}

/** Una fila liviana del universo: lo que el pin necesita y lo guardado para la combinación; sin los jsonb de la evaluación. */
export type FilaUniverso = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null; precio_uf: number;
  arriendo_monto: number | null; evaluado_at: string | null; combo: unknown; pub_estado: string | null; pub_at: string | null;
};
/** Pedidos a la vez contra la base (lo pesado y el guardado, de a 500 avisos cada uno). */
const PEDIDOS_A_LA_VEZ = 12;
const LOTE = 500;
const lotes = <T,>(xs: T[]): T[][] => Array.from({ length: Math.ceil(xs.length / LOTE) }, (_, i) => xs.slice(i * LOTE, (i + 1) * LOTE));

/** El universo de unos filtros (den lo que den), liviano, con lo guardado para esa combinación: UN solo pedido (la RPC
 *  devuelve un jsonb, no filas, así el tope de mil de PostgREST no corta; medido el 24-oct-2026: de a páginas, 2,5 s). */
export async function universoExplorar(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date()): Promise<FilaUniverso[]> {
  const params = { ...parametros(f, ahora), pie: undefined, plazo: undefined, clave: claveCombo(f) };
  const { data, error } = await admin.rpc("explorar_universo_liviano", params);
  if (error) throw new Error(`explorar_universo_liviano: ${error.message}`);
  return Array.isArray(data) ? (data as FilaUniverso[]) : [];
}

/** Lo que la sonda necesita, solo para esos avisos, de a 500 y de a PEDIDOS_A_LA_VEZ pedidos. */
export async function filasParaSonda(admin: SupabaseClient, ids: string[]): Promise<Map<string, FilaRpc>> {
  const out = new Map<string, FilaRpc>();
  const todos = lotes(ids);
  for (let i = 0; i < todos.length; i += PEDIDOS_A_LA_VEZ) {
    const respuestas = await Promise.all(todos.slice(i, i + PEDIDOS_A_LA_VEZ).map((lote) => admin.rpc("explorar_filas_para_sonda", { ids: lote })));
    for (const { data, error } of respuestas) {
      if (error) throw new Error(`explorar_filas_para_sonda: ${error.message}`);
      for (const r of (data ?? []) as FilaRpc[]) out.set(r.id, r);
    }
  }
  return out;
}

/** Lo calculado, guardado en `combos` de a lotes (sin pisar las otras combinaciones). */
export async function guardarCombos(admin: SupabaseClient, clave: string, nuevos: Array<{ avisoId: string; combo: ComboGuardado }>): Promise<number> {
  let guardados = 0;
  const todos = lotes(nuevos);
  for (let i = 0; i < todos.length; i += PEDIDOS_A_LA_VEZ) {
    const respuestas = await Promise.all(todos.slice(i, i + PEDIDOS_A_LA_VEZ).map((lote) => admin.rpc("explorar_guardar_combos", { filas: lote.map((n) => ({ aviso_id: n.avisoId, combo: { [clave]: n.combo } })) })));
    for (const { data, error } of respuestas) {
      reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-combos" });
      if (!error) guardados += Number(data) || 0;
    }
  }
  return guardados;
}

/**
 * UNA COMBINACIÓN QUE LA NOCHE NO TIENE (24-oct-2026): se lee el universo de los filtros con lo guardado para esa clave;
 * lo vigente (menos de 24 horas y posterior a la evaluación de la fila) se usa tal cual; el resto se calcula con la misma
 * sonda del estándar (sondaDeCandidato) y se guarda. Solo salen los Comprar, por puntaje. La evaluación nocturna no cambia.
 */
export async function pinesCalculados(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date(), cuenta?: CuentaExplorar, deps: DepsCalculo = {}): Promise<PinExplorar[]> {
  const clave = claveCombo(f);
  const combo = { piePct: f.pie, plazoAnios: f.plazo };
  const sonda = deps.sonda ?? sondaDeCandidato;
  const filas = await universoExplorar(admin, f, ahora);
  const porCalcular = filas.filter((r) => !comboVigente(r.combo, r.evaluado_at, ahora));
  // Los jsonb de la evaluación y la tasa/UF, solo si hay algo que calcular.
  const [cfg, pesadas] = porCalcular.length
    ? await Promise.all([deps.cfg ?? leerConfigGuia(admin), filasParaSonda(admin, porCalcular.map((r) => r.id))])
    : [null, new Map<string, FilaRpc>()];
  const nuevos: Array<{ avisoId: string; combo: ComboGuardado }> = [];
  const resultado = new Map<string, ComboGuardado>();
  for (const r of filas) {
    if (comboVigente(r.combo, r.evaluado_at, ahora)) { resultado.set(r.id, r.combo); continue; }
    const pesada = pesadas.get(r.id);
    const s = cfg && pesada ? sonda(candidatoDeFila(pesada), combo, cfg, ahora) : null;
    const c: ComboGuardado = { v: s?.veredicto ?? null, s: s?.score ?? null, f: s?.flujo ?? null, at: ahora.toISOString() };
    resultado.set(r.id, c);
    nuevos.push({ avisoId: r.id, combo: c });
  }
  if (nuevos.length) await guardarCombos(admin, clave, nuevos);
  if (cuenta) cuenta.calculados = nuevos.length;
  const fresco = (r: FilaUniverso) => r.pub_estado === "publicado" && !!r.pub_at && ahora.getTime() - Date.parse(r.pub_at) < MEMORIA_SEMANAL_MS;
  const pines: PinExplorar[] = filas.map((r) => {
    const c = resultado.get(r.id)!;
    return {
      avisoId: r.id, comuna: r.comuna, lat: Number(r.lat), lng: Number(r.lng), m2: Math.round(Number(r.superficie_m2)),
      dormitorios: Number(r.dormitorios), tipologia: tipologiaDe(r.dormitorios, r.banos), precioUF: Math.round(Number(r.precio_uf)),
      veredicto: c.v ?? "", score: c.s, flujo: c.f, arriendo: r.arriendo_monto != null && r.arriendo_monto > 0 ? r.arriendo_monto : null, vistoAt: fresco(r) ? r.pub_at : null,
    };
  });
  return porPuntaje(soloComprar(pines));
}

/** Cuántos convienen con una búsqueda (el botón del dashboard), con la combinación de la NOCHE más cercana: contar con
 *  otra obligaría a calcular toda la comuna al abrir el dashboard. 0 si falla. */
export async function conteoExplorar(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date()): Promise<number> {
  const { data, error } = await admin.rpc("explorar_conteo", parametros({ ...f, pie: pieDeLaNoche(f.pie), plazo: plazoDeLaNoche(f.plazo) }, ahora));
  reportarFalloQuery(error, { ruta: RUTA, operacion: "conteo" });
  return error ? 0 : Number(data) || 0;
}

/** Los informes de renta larga de la cuenta hechos desde un aviso: aviso → informe (el más reciente). Los pines azules. */
export async function informesDeExplorar(admin: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const { data, error } = await admin.from("analisis").select("id, aviso:input_data->origenAviso->>avisoId")
    .eq("user_id", userId).eq("tipo_analisis", "long-term").not("input_data->origenAviso->>avisoId", "is", null)
    .order("created_at", { ascending: true }).limit(1000);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "informes", userId });
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; aviso: string | null }>) if (r.aviso) out[r.aviso] = r.id;
  return out;
}

/** Con qué filtros abre el mapa: el perfil de la cuenta, o la búsqueda por defecto si el perfil no alcanza. */
export async function filtrosDeLaCuenta(admin: SupabaseClient, userId: string): Promise<{ filtros: FiltrosExplorar; desdePerfil: boolean }> {
  const pp = await leerPerfilBusqueda(admin, userId);
  const f = filtrosDePerfil(pp.perfilLtr ?? pp.perfil);
  return f ? { filtros: f, desdePerfil: true } : { filtros: FILTROS_POR_DEFECTO, desdePerfil: false };
}

export interface DatosExplorar {
  filtros: FiltrosExplorar;
  /** La combinación no es de la noche y los pines no se leyeron todavía (la página lo deja al navegador: «Calculando con tu pie…»). */
  calculando: boolean;
  /** Cuántos se calcularon en el momento y cuánto tardó la lectura. */
  cuenta: CuentaExplorar;
  pines: PinExplorar[];
  /** aviso → informe de los que ya analizó esta cuenta. */
  analizados: Record<string, string>;
  n: number;
  saldo: EstadoSaldo;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
  /** SIN SALDO, CERRADO (24-oct-2026, explorar.ts › explorarCerrado): los pines van sin detalle (pinCerrado), todos, con la
   *  combinación de la noche; no hay qué abrir ni qué recalcular. */
  cerrado: boolean;
}

/** ¿Explorar está cerrado para esta cuenta? (sin saldo; el plan cuenta como saldo). Para cortar antes de leer pines. */
export async function explorarCerradoPara(admin: SupabaseClient, userId: string): Promise<boolean> {
  return explorarCerrado(estadoSaldo(await leerSaldo(admin, userId)));
}

export async function cargarExplorar(admin: SupabaseClient, user: { id: string; created_at?: string | null }, f: FiltrosExplorar, ahora: Date = new Date(), opts: { pines?: boolean } = {}): Promise<DatosExplorar> {
  // La página (SSR) no calcula una combinación nueva: deja los pines al navegador, que los pide enseguida.
  const leerPines = opts.pines ?? true;
  const cuenta: CuentaExplorar = { calculados: 0, ms: 0 };
  const [pines, analizados, datosSaldo, ticket, cfg] = await Promise.all([
    leerPines ? pinesExplorar(admin, f, ahora, cuenta) : Promise.resolve([] as PinExplorar[]),
    informesDeExplorar(admin, user.id),
    leerSaldo(admin, user.id),
    ticketDeCuentaDisponible(admin, user),
    leerConfigGuia(admin),
  ]);
  const saldo = estadoSaldo(datosSaldo);
  const comun = { analizados, saldo, ticket, cuentaCreadaAt: ticket ? (user.created_at ?? null) : null, finanzas: { uf: cfg.uf, tasa: cfg.tasa } };
  // Sin saldo, cerrado: la combinación de la noche (nada se calcula en el momento) y los pines sin detalle.
  if (explorarCerrado(saldo)) {
    const fn = esCombinacionDeLaNoche(f) ? f : { ...f, pie: pieDeLaNoche(f.pie), plazo: plazoDeLaNoche(f.plazo) } as FiltrosExplorar;
    const deLaNoche = leerPines && fn === f ? pines : await pinesExplorar(admin, fn, ahora, cuenta);
    return { ...comun, filtros: fn, calculando: false, cuenta, pines: deLaNoche.map(pinCerrado), n: deLaNoche.length, cerrado: true };
  }
  return { ...comun, filtros: f, calculando: !leerPines, cuenta, pines, n: pines.length, cerrado: false };
}

/** Un aviso del mapa con su evaluación guardada, para recalcularlo con otro pie y otro plazo. null si no está. */
export function candidatoExplorar(admin: SupabaseClient, avisoId: string): Promise<CandidatoGuia | null> {
  return leerAvisoGuia(admin, avisoId, origenSintetico("", { piePct: null, plazoAnios: null, comunas: [], dormitorios: [] }, { tasa: 0 }));
}

// ── LA MEDICIÓN ──────────────────────────────────────────────────────────────
/** «explorar_vista»: una vista del mapa, con los filtros y cuántos pines. */
// `robot` (26-oct-2026): el escáner se marca en el evento, como en las otras páginas de entrada (vista-entrada.ts › robotDeVisita).
export function eventoExplorarVista(p: { userId: string; filtros: FiltrosExplorar; n: number | null; analizados: number; fuente: "pagina" | "cambio"; cuenta?: CuentaExplorar; robot?: MotivoRobot | null }): EventoServidor {
  return {
    event: "explorar_vista",
    distinctId: p.userId,
    properties: {
      comunas: p.filtros.comunas, tipologias: p.filtros.tipologias, uf_min: p.filtros.ufMin, uf_max: p.filtros.ufMax, pie: p.filtros.pie, plazo: p.filtros.plazo,
      n: p.n, analizados: p.analizados, fuente: p.fuente, de_la_noche: esCombinacionDeLaNoche(p.filtros),
      robot: !!p.robot, ...(p.robot ? { robot_motivo: p.robot } : {}),
      ...(p.cuenta ? { calculados: p.cuenta.calculados, ms: p.cuenta.ms } : {}),
    },
  };
}

/** «explorar_analiza»: un análisis pedido desde el mapa, con el depto. */
export function eventoExplorarAnaliza(p: { userId: string; analysisId: string; avisoId: string; comuna: string; precioUF: number; m2: number; piePct: number; plazoAnios: number }): EventoServidor {
  return {
    event: "explorar_analiza",
    distinctId: p.userId,
    uuid: undefined,
    properties: { analysis_id: p.analysisId, aviso_id: p.avisoId, comuna: p.comuna, precio_uf: p.precioUF, m2: p.m2, pie_pct: p.piePct, plazo_anios: p.plazoAnios },
  };
}
