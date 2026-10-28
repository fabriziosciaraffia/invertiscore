// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR COMO PORTAL, del lado del servidor (28-oct-2026). Las reglas puras viven en portal.ts.
//
//   · EL UNIVERSO DE LA NOCHE: arriendo tradicional con pie 20/30 % a 25/30 años sale de las columnas de la evaluación
//     nocturna, todo Gran Santiago en UN pedido (RPC explorar_mapa, un jsonb: de a páginas de mil eran cinco pedidos y
//     5,1 s; así, 240 ms). Es el mismo para todas las cuentas: diez minutos de caché, como el número de /deptos.
//   · LO CALCULADO: otro pie u otro plazo, o la renta corta, por comuna. Se lee el universo liviano de esas comunas con lo
//     guardado para la combinación (`avisos_evaluados.combos`, 24 horas y posterior a la evaluación de la fila), y lo que
//     falta se calcula y se guarda. En renta corta la tarifa y la ocupación son las TÍPICAS de la celda comuna ×
//     dormitorios (semanal-str-servidor.ts › zonasDeComuna, sin consultas al proveedor): «Estimado por zona; se mide al
//     analizar». Solo salen los Comprar.
//   · LA CUENTA: los informes que ya hizo desde un aviso (los pines azules), sus guardados, el saldo, el perfil para «Mi
//     búsqueda» y cuántos analizó desde Explorar en 30 días (la línea del plan).
//   · LO QUE ESCRIBE: los guardados (el corazón) y «Avísame de nuevos» (el perfil, con lo que reemplaza). Explorar no gasta:
//     nada acá cobra.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { candidatoDeFila, comunaDeAviso, type FilaRpc } from "@/lib/guia/semanal-candidatos";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { sondaDeCandidato } from "@/lib/avisos/estandar-deptos";
import { celdaDormitorios, cuerpoStrDeAviso, evaluarStrCon, zonasDeComuna, type ZonaStr } from "@/lib/guia/semanal-str-servidor";
import { origenSinteticoStr } from "@/lib/guia/semanal-str-servidor";
import { estadoSaldo, leerSaldo, type EstadoSaldo } from "@/lib/casa-saldo";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { validarCambiosPerfil } from "@/lib/perfil-busqueda";
import type { EventoServidor } from "@/lib/posthog-servidor";
import type { MotivoRobot } from "@/lib/vista-entrada";
import { comboVigente, VIDA_COMBO_MS, type ComboGuardado } from "./explorar";
import { filasParaSonda, guardarCombos, informesDeExplorar, type FilaUniverso } from "./servidor";
import {
  claveUniverso, compactar, EVENTOS_PORTAL, filtrosDeMiBusqueda, lineaBusqueda, perfilDeFiltros, pinDeFila, propsDeFiltros, VENTANA_PLAN_DIAS,
  type FiltrosPortal, type ModalidadPortal, type OrdenPortal, type PinMapa, type UniversoCompacto,
} from "./portal";

const RUTA = "lib/explorar/portal";
const desdeVentana = (ahora: Date) => new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
/** Todos los dormitorios (la vista global no filtra por tipología en el servidor). */
const TODOS_LOS_DORMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ── EL UNIVERSO DE LA NOCHE ──────────────────────────────────────────────────
type FilaMapa = [string, string, number, number, number, number, number | null, number, number | null, number | null, number | null, string | null, number | null];

/** Todo Gran Santiago, solo los Comprar con ese pie y ese plazo de la noche, por puntaje. Un pedido. */
export async function universoDeLaNoche(admin: SupabaseClient, pie: number, plazo: number, ahora: Date = new Date()): Promise<PinMapa[]> {
  const { data, error } = await admin.rpc("explorar_mapa", { comunas: [...(COMUNAS_DISPONIBLES as readonly string[])].map(comunaDeAviso), desde: desdeVentana(ahora), pie: pie >= 30 ? 30 : 20, plazo: plazo >= 30 ? 30 : 25 });
  if (error) throw new Error(`explorar_mapa: ${error.message}`);
  const filas = (Array.isArray(data) ? data : []) as FilaMapa[];
  return filas.map(([id, comuna, lat, lng, m2, dormitorios, banos, precio, score, flujo, arriendo, condicion, alta]) => pinDeFila({ id, comuna, lat, lng, m2, dormitorios, banos, precio, score, flujo, arriendo, condicion, alta }));
}

// ── LO CALCULADO (otro pie, otro plazo, renta corta) ─────────────────────────
/** La clave en `combos`: «15-20» en renta larga (la misma de siempre), «str-20-25» en renta corta. */
export const claveComboPortal = (m: ModalidadPortal, pie: number, plazo: number): string => (m === "str" ? `str-${pie}-${plazo}` : `${pie}-${plazo}`);

/** Lo guardado en renta corta lleva también el ingreso mensual estimado por zona (el cap rate de la tarjeta). */
type ComboPortal = ComboGuardado & { i?: number | null };

/** Qué usa el cálculo; se inyecta para probarlo sin motor ni base. */
export interface DepsPortal {
  cfg?: { uf: number; tasa: number };
  sondaLtr?: typeof sondaDeCandidato;
  /** La renta corta de un depto con la zona de su celda: veredicto, puntaje, flujo e ingreso mensual (null si no se puede). */
  sondaStr?: (fila: FilaRpc, combo: { piePct: number; plazoAnios: number }, cfg: { uf: number; tasa: number }, zona: ZonaStr | undefined, asOf: Date) => { v: string | null; s: number | null; f: number | null; i: number | null } | null;
  zonas?: (comuna: string) => Promise<Map<number, ZonaStr>>;
}

const sondaStrReal: NonNullable<DepsPortal["sondaStr"]> = (fila, combo, cfg, zona, asOf) => {
  if (!zona) return null;
  const c = candidatoDeFila(fila);
  const o = origenSinteticoStr("", { piePct: combo.piePct, plazoAnios: combo.plazoAnios, comunas: [], dormitorios: [] }, cfg);
  const body = cuerpoStrDeAviso(c, o, combo, cfg);
  if (!body) return null;
  const ev = evaluarStrCon(body, zona.estimacion, { uf: cfg.uf }, c.medianaComuna, asOf);
  return { v: ev.veredicto, s: ev.score, f: ev.flujo, i: ev.ingresoMensual };
};

/** El universo de unas comunas para una combinación calculada: todos los Comprar, por puntaje. `cuenta.calculados`: cuántos
 *  se calcularon recién (el resto salió de lo guardado). */
export async function universoCalculado(
  admin: SupabaseClient, q: { comunas: string[]; modalidad: ModalidadPortal; pie: number; plazo: number }, ahora: Date = new Date(),
  cuenta?: { calculados: number; ms: number }, deps: DepsPortal = {},
): Promise<PinMapa[]> {
  const t0 = Date.now();
  const clave = claveComboPortal(q.modalidad, q.pie, q.plazo);
  const combo = { piePct: q.pie, plazoAnios: q.plazo };
  const { data, error } = await admin.rpc("explorar_universo_liviano", { comunas: q.comunas.map(comunaDeAviso), dorms: TODOS_LOS_DORMS, uf_min: 0, uf_max: 1e9, desde: desdeVentana(ahora), clave });
  if (error) throw new Error(`explorar_universo_liviano: ${error.message}`);
  const filas = (Array.isArray(data) ? data : []) as Array<FilaUniverso & { condicion?: string | null; alta?: number | null }>;
  const porCalcular = filas.filter((r) => !comboVigente(r.combo, r.evaluado_at, ahora));
  const [cfg, pesadas] = porCalcular.length
    ? await Promise.all([deps.cfg ?? leerConfigGuia(admin), filasParaSonda(admin, porCalcular.map((r) => r.id))])
    : [null, new Map<string, FilaRpc>()];
  // Renta corta: la zona de cada comuna (una lectura por comuna, en paralelo; queda en memoria 30 minutos).
  const zonas = new Map<string, Map<number, ZonaStr>>();
  if (q.modalidad === "str" && porCalcular.length) {
    const leer = deps.zonas ?? ((c: string) => zonasDeComuna(admin, c));
    const comunas = Array.from(new Set(porCalcular.map((r) => r.comuna)));
    const leidas = await Promise.all(comunas.map((c) => leer(c).catch(() => new Map<number, ZonaStr>())));
    comunas.forEach((c, i) => zonas.set(c, leidas[i]));
  }
  const sondaLtr = deps.sondaLtr ?? sondaDeCandidato;
  const sondaStr = deps.sondaStr ?? sondaStrReal;
  const nuevos: Array<{ avisoId: string; combo: ComboPortal }> = [];
  const resultado = new Map<string, ComboPortal>();
  for (const r of filas) {
    if (comboVigente(r.combo, r.evaluado_at, ahora)) { resultado.set(r.id, r.combo as ComboPortal); continue; }
    const pesada = pesadas.get(r.id);
    let c: ComboPortal;
    if (!cfg || !pesada) c = { v: null, s: null, f: null, at: ahora.toISOString() };
    else if (q.modalidad === "str") {
      const s = sondaStr(pesada, combo, cfg, zonas.get(r.comuna)?.get(celdaDormitorios(Number(pesada.dormitorios))), ahora);
      c = { v: s?.v ?? null, s: s?.s ?? null, f: s?.f ?? null, i: s?.i ?? null, at: ahora.toISOString() };
    } else {
      const s = sondaLtr(candidatoDeFila(pesada), combo, cfg, ahora);
      c = { v: s?.veredicto ?? null, s: s?.score ?? null, f: s?.flujo ?? null, at: ahora.toISOString() };
    }
    resultado.set(r.id, c);
    nuevos.push({ avisoId: r.id, combo: c });
  }
  if (nuevos.length) await guardarCombos(admin, clave, nuevos);
  if (cuenta) { cuenta.calculados += nuevos.length; cuenta.ms += Date.now() - t0; }
  const pines: PinMapa[] = [];
  for (const r of filas) {
    const c = resultado.get(r.id);
    if (c?.v !== "COMPRAR") continue;
    const arriendo = q.modalidad === "str" ? c.i ?? null : r.arriendo_monto;
    pines.push(pinDeFila({ id: r.id, comuna: r.comuna, lat: r.lat, lng: r.lng, m2: r.superficie_m2, dormitorios: r.dormitorios, banos: r.banos, precio: r.precio_uf, score: c.s, flujo: c.f, arriendo, condicion: r.condicion ?? null, alta: r.alta ?? null }));
  }
  return pines.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.avisoId.localeCompare(b.avisoId));
}

/** Lo que devuelve GET /api/explorar: el universo compacto y de qué es (la clave y las comunas; vacío = Gran Santiago). */
export interface RespuestaUniverso { clave: string; comunas: string[]; universo: UniversoCompacto; calculados: number; ms: number }
export function respuestaUniverso(pines: PinMapa[], q: { modalidad: ModalidadPortal; pie: number; plazo: number; comunas: string[] }, cuenta = { calculados: 0, ms: 0 }): RespuestaUniverso {
  return { clave: claveUniverso(q), comunas: q.comunas, universo: compactar(pines), calculados: cuenta.calculados, ms: cuenta.ms };
}

// ── LA CUENTA ────────────────────────────────────────────────────────────────
/** Los avisos que la cuenta guardó con el corazón, el más reciente primero. */
export async function guardadosDe(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin.from("explorar_guardados").select("aviso_id").eq("user_id", userId).order("creado_at", { ascending: false }).limit(500);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardados", userId });
  return ((data ?? []) as Array<{ aviso_id: string }>).map((r) => r.aviso_id);
}

/** El corazón: guarda o quita un aviso. Idempotente. */
export async function alternarGuardado(admin: SupabaseClient, userId: string, avisoId: string, guardar: boolean): Promise<boolean> {
  const { error } = guardar
    ? await admin.from("explorar_guardados").upsert({ user_id: userId, aviso_id: avisoId }, { onConflict: "user_id,aviso_id", ignoreDuplicates: true })
    : await admin.from("explorar_guardados").delete().match({ user_id: userId, aviso_id: avisoId });
  reportarFalloQuery(error, { ruta: RUTA, operacion: guardar ? "guardar" : "quitar", userId });
  return !error;
}

/** Cuántos informes hizo desde Explorar en los últimos 30 días (renta larga y corta: `origenAviso.desde = explorar`). */
export async function analisisDesdeExplorar(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<number> {
  const desde = new Date(ahora.getTime() - VENTANA_PLAN_DIAS * 864e5).toISOString();
  const { count, error } = await admin.from("analisis").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("input_data->origenAviso->>desde", "explorar").gte("created_at", desde);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "analisis-explorar", userId });
  return error ? 0 : count ?? 0;
}

export interface CuentaPortal {
  /** aviso → informe, de los que ya analizó (los pines azules). */
  analizados: Record<string, string>;
  guardados: string[];
  saldo: EstadoSaldo;
  /** Tiene una suscripción vigente: la línea del plan no aparece. */
  suscrito: boolean;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
  /** «Mi búsqueda»: el perfil como filtros; null si no tiene con qué buscar. */
  miBusqueda: FiltrosPortal | null;
  /** La búsqueda que «Avísame de nuevos» reemplazaría, en una línea; null si no tiene. */
  busquedaActual: string | null;
  /** Cuántos analizó desde Explorar en 30 días. */
  explorarEnMes: number;
}

export async function cuentaPortal(admin: SupabaseClient, user: { id: string; created_at?: string | null }, ahora: Date = new Date()): Promise<CuentaPortal> {
  const [analizados, guardados, datosSaldo, ticket, cfg, pp, explorarEnMes] = await Promise.all([
    informesDeExplorar(admin, user.id),
    guardadosDe(admin, user.id),
    leerSaldo(admin, user.id),
    ticketDeCuentaDisponible(admin, user),
    leerConfigGuia(admin).catch(() => ({ uf: null, tasa: null })),
    leerPerfilBusqueda(admin, user.id),
    analisisDesdeExplorar(admin, user.id, ahora),
  ]);
  const perfil = pp.perfil.modalidad === "str" ? pp.perfilStr ?? pp.perfil : pp.perfilLtr ?? pp.perfil;
  const tiene = perfil.comunas.length > 0 || perfil.dormitorios.length > 0 || perfil.precioMaxUf != null;
  return {
    analizados, guardados, saldo: estadoSaldo(datosSaldo), suscrito: datosSaldo.suscripcion, ticket, cuentaCreadaAt: ticket ? (user.created_at ?? null) : null,
    finanzas: { uf: cfg.uf, tasa: cfg.tasa },
    miBusqueda: filtrosDeMiBusqueda(perfil),
    busquedaActual: tiene ? lineaBusqueda({ ...perfil, modalidad: perfil.modalidad }) : null,
    explorarEnMes,
  };
}

// ── «AVÍSAME DE NUEVOS» ──────────────────────────────────────────────────────
/** Los filtros activos como perfil de búsqueda: desde ahí el semanal y la selección diaria buscan con esto. Devuelve la
 *  búsqueda guardada en una línea, o por qué no se pudo. Escribe lo mismo que el PUT del perfil (validarCambiosPerfil). */
export async function guardarBusquedaComoPerfil(admin: SupabaseClient, userId: string, f: FiltrosPortal, ahora: Date = new Date()): Promise<{ ok: true; linea: string } | { ok: false; motivo: "comunas" | "invalido" | "base" }> {
  const p = perfilDeFiltros(f);
  if (!p.ok) return { ok: false, motivo: p.motivo };
  const v = validarCambiosPerfil(p.cambios as unknown as Record<string, unknown>);
  if (!v.ok) return { ok: false, motivo: "invalido" };
  const { error } = await admin.from("perfil_busqueda").upsert({ user_id: userId, ...v.cambios, actualizado_at: ahora.toISOString() }, { onConflict: "user_id" });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "avisame", userId });
  if (error) return { ok: false, motivo: "base" };
  return { ok: true, linea: lineaBusqueda(p.cambios) };
}

// ── LA MEDICIÓN ──────────────────────────────────────────────────────────────
/** «explorar_vista» al entrar (la página): los filtros, el orden y si es la vista global. Los cambios los deja el navegador. */
export function eventoPortalVista(p: { userId: string; filtros: FiltrosPortal; orden: OrdenPortal; n: number | null; robot?: MotivoRobot | null }): EventoServidor {
  return {
    event: EVENTOS_PORTAL.vista,
    distinctId: p.userId,
    properties: { ...propsDeFiltros(p.filtros, p.orden), n: p.n, fuente: "pagina", robot: !!p.robot, ...(p.robot ? { robot_motivo: p.robot } : {}) },
  };
}

/** «explorar_guardar» (el corazón) y «explorar_avisame» (la búsqueda como perfil), del servidor. */
export function eventoPortal(nombre: typeof EVENTOS_PORTAL.guardar | typeof EVENTOS_PORTAL.avisame, userId: string, properties: Record<string, unknown>): EventoServidor {
  return { event: nombre, distinctId: userId, properties };
}

/** Cuánto vale lo calculado (para la cabecera de la API). */
export const VIDA_CALCULADO_S = Math.round(VIDA_COMBO_MS / 1000);
