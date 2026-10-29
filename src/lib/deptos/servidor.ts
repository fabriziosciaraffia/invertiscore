// ─────────────────────────────────────────────────────────────────────────────
// /deptos del lado del servidor (16-oct-2026): los conteos de la noche (RPC `deptos_conteo`), los primeros deptos con lo
// último que se supo de su ficha (RPC `deptos_candidatos`) y la elección pendiente por correo (`deptos_pendientes`).
// Sin consultas en vivo por aviso: todo sale de la evaluación de la noche (estándar de 25 años, estandar-deptos.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { comunasVecinas } from "@/lib/comunas-vecinas";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { condicionDe, type CondicionDepto } from "@/lib/guia/linea-depto";
import { MEMORIA_SEMANAL_MS, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { CLAVE_GOOGLE, ELECCIONES_POR_DEFECTO, PREFIJO_GOOGLE, RANGOS_UF, respuestaDeptos, TIPOLOGIAS_DEPTOS, tipoDeAlta, validarElecciones, type ConteoComuna, type EleccionesDeptos, type RangoUf, type RespuestaDeptos, type TipologiaDeptos, type Validacion } from "./respuesta";

const RUTA = "lib/deptos";
type Ok = Extract<Validacion, { ok: true }>;

const desdeVentana = (ahora: Date) => new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

/** La respuesta al instante: sus comunas y, por si da cero, las vecinas, leídas del conteo guardado (conteoDeptos). */
export async function responderDeptos(admin: SupabaseClient, v: Ok, ahora: Date = new Date()): Promise<RespuestaDeptos> {
  const vecinas = comunasVecinas(v.comunas).filter((c) => !v.comunas.includes(c));
  // Las comunas en cero vienen en cero (la RPC no las traía): no suman y respuestaDeptos solo ofrece vecinas que convienen.
  const filas = await conteoDeptos(admin, v, [...v.comunas, ...vecinas], ahora);
  return respuestaDeptos(v, filas.filter((f) => v.comunas.includes(f.comuna)), filas.filter((f) => vecinas.includes(f.comuna)));
}

/**
 * EL CONTEO DE /deptos, GUARDADO (28-oct-2026, Sentry JAVASCRIPT-NEXTJS-1K). `deptos_conteo` corría en cada GET de
 * /api/deptos/respuesta —une la semana de avisos con su evaluación: 120 ms con la base tranquila, más de los 8 s del
 * `statement_timeout` cuando está ocupada (Providencia, 2D, UF 3.000 a 4.000)—. Como el resumen de la noche: lo cuenta el
 * cron de la evaluación al terminar (guardarConteosDeLaNoche), una fila de `config` por tipología y rango con TODAS las
 * comunas de la cobertura y sus vecinas (las sin ninguno, en cero), y /deptos solo lee esa fila. Si falta (varias
 * tipologías a la vez, una comuna nueva, antes del primer cron), se cuenta una vez con la misma RPC y se guarda. Una
 * guardada vieja se sigue leyendo: el número cambia una vez por noche.
 */
export const PREFIJO_CONTEO = "deptos_conteo:";

/** La fila de `config` de una búsqueda: «deptos_conteo:2|3000-4000» (las tipologías, ordenadas). */
export function claveConteo(tipologias: ReadonlyArray<{ id: string }>, rango: { id: string }): string {
  return `${PREFIJO_CONTEO}${tipologias.map((t) => t.id).sort().join(",")}|${rango.id}`;
}

/** Por comuna: [publicados, convienen con pie 20 %, convienen con pie 30 %]. */
type PorComuna = Record<string, [number, number, number]>;

/** Lo guardado en `config`, o null si no hay o no se lee. */
export function conteoGuardado(valor: string | null | undefined): PorComuna | null {
  if (!valor) return null;
  try {
    const v = JSON.parse(valor) as { comunas?: unknown };
    if (!v.comunas || typeof v.comunas !== "object") return null;
    const out: PorComuna = {};
    for (const [c, n] of Object.entries(v.comunas as Record<string, unknown>)) {
      if (Array.isArray(n) && n.length === 3 && n.every((x) => Number.isFinite(Number(x)))) out[c] = [Number(n[0]), Number(n[1]), Number(n[2])];
    }
    return out;
  } catch {
    return null;
  }
}

/** La RPC, para estas comunas: las que no trae quedan en cero (así se sabe que se contaron). */
async function contarEnVivo(admin: SupabaseClient, comunas: string[], dorms: number[], rango: { min: number | null; max: number }, ahora: Date): Promise<PorComuna> {
  const { data, error } = await admin.rpc("deptos_conteo", { comunas, dorms, uf_min: rango.min ?? 0, uf_max: rango.max, desde: desdeVentana(ahora) });
  if (error) throw new Error(`deptos_conteo: ${error.message}`);
  const out: PorComuna = Object.fromEntries(comunas.map((c) => [c, [0, 0, 0] as [number, number, number]]));
  for (const f of (data ?? []) as Array<{ comuna: string; total: number; comprar_20: number; comprar_30: number }>) {
    out[f.comuna] = [Number(f.total) || 0, Number(f.comprar_20) || 0, Number(f.comprar_30) || 0];
  }
  return out;
}

async function guardarConteo(admin: SupabaseClient, clave: string, comunas: PorComuna, ahora: Date): Promise<void> {
  const { error } = await admin.from("config").upsert({ key: clave, value: JSON.stringify({ comunas, calculadoAt: ahora.toISOString() }), updated_at: ahora.toISOString().replace("Z", "") }, { onConflict: "key" });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-conteo" });
}

/** El conteo de una búsqueda para estas comunas: lo guardado; lo que falte se cuenta una vez y se guarda. */
export async function conteoDeptos(admin: SupabaseClient, v: Pick<Ok, "tipologias" | "dorms" | "rango">, comunas: string[], ahora: Date = new Date()): Promise<ConteoComuna[]> {
  const clave = claveConteo(v.tipologias, v.rango);
  const { data, error } = await admin.from("config").select("value").eq("key", clave).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-conteo" });
  let porComuna = conteoGuardado(data?.value as string | null | undefined) ?? {};
  const faltan = comunas.filter((c) => !(c in porComuna));
  if (faltan.length > 0) {
    porComuna = { ...porComuna, ...(await contarEnVivo(admin, faltan, v.dorms, v.rango, ahora)) };
    await guardarConteo(admin, clave, porComuna, ahora);
  }
  return comunas.map((c) => ({ comuna: c, total: porComuna[c][0], comprar20: porComuna[c][1], comprar30: porComuna[c][2] }));
}

/** Toda comuna que /deptos puede pedir: la cobertura y sus vecinas. */
const COMUNAS_DEL_CONTEO = Array.from(new Set([...COMUNAS_DISPONIBLES, ...comunasVecinas([...COMUNAS_DISPONIBLES])]));
const CONTEOS_A_LA_VEZ = 4;

/**
 * Lo llama el cron de la evaluación al terminar: cada tipología por cada rango (las 20 búsquedas de una tipología), sobre
 * todas las comunas, y de nuevo las de varias tipologías que alguien pidió. Una que falla queda con lo anterior.
 */
export async function guardarConteosDeLaNoche(admin: SupabaseClient, ahora: Date = new Date()): Promise<{ guardados: number; fallidos: number }> {
  const busquedas = new Map<string, { tipologias: TipologiaDeptos[]; rango: RangoUf }>();
  for (const t of TIPOLOGIAS_DEPTOS) for (const r of RANGOS_UF) busquedas.set(claveConteo([t], r), { tipologias: [t], rango: r });
  const { data: previas, error } = await admin.from("config").select("key").like("key", `${PREFIJO_CONTEO}%`).limit(200);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-conteos-previos" });
  for (const { key } of (previas ?? []) as Array<{ key: string }>) {
    const [ids, rangoId] = key.slice(PREFIJO_CONTEO.length).split("|");
    const tipologias = TIPOLOGIAS_DEPTOS.filter((t) => (ids ?? "").split(",").includes(t.id));
    const rango = RANGOS_UF.find((r) => r.id === rangoId);
    if (tipologias.length > 0 && rango && !busquedas.has(key)) busquedas.set(key, { tipologias, rango });
  }
  let guardados = 0, fallidos = 0;
  const lista = Array.from(busquedas.entries());
  for (let i = 0; i < lista.length; i += CONTEOS_A_LA_VEZ) {
    await Promise.all(lista.slice(i, i + CONTEOS_A_LA_VEZ).map(async ([clave, b]) => {
      try {
        const dorms = Array.from(new Set(b.tipologias.flatMap((t) => t.dorms))).sort((x, y) => x - y);
        await guardarConteo(admin, clave, await contarEnVivo(admin, COMUNAS_DEL_CONTEO, dorms, b.rango, ahora), ahora);
        guardados++;
      } catch (e) {
        fallidos++;
        reportarFalloQuery({ message: e instanceof Error ? e.message : String(e) }, { ruta: RUTA, operacion: "contar-de-noche" });
      }
    }));
  }
  return { guardados, fallidos };
}

/**
 * EL RANGO CON QUE ARRANCA UNA COMUNA (20-oct-2026, decisión de Fabrizio): desde «Ver los deptos de [comuna]», el de los
 * cuatro rangos con más deptos de la tipología publicados esa semana en esa comuna. El de Santiago (UF 3.000 a 4.000)
 * dejaba a Vitacura, Quilicura y Renca en cero publicados y a casi todas sin ninguno que conviniera (Estación Central: 28
 * y 0; con «Hasta UF 3.000», 638 y 227). Empate o todo en cero: el por defecto. Una falla también cae al por defecto.
 */
export async function rangoConMasPublicados(admin: SupabaseClient, comuna: string, dorms: number[], ahora: Date = new Date()): Promise<string> {
  const conteos = await Promise.all(
    RANGOS_UF.map(async (r) => {
      const { data, error } = await admin.rpc("deptos_conteo", { comunas: [comuna], dorms, uf_min: r.min ?? 0, uf_max: r.max, desde: desdeVentana(ahora) });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "rango-de-la-comuna" });
      const total = ((data ?? []) as Array<{ total: number }>).reduce((s, f) => s + (Number(f.total) || 0), 0);
      return { id: r.id, total };
    }),
  );
  const defecto = conteos.find((c) => c.id === ELECCIONES_POR_DEFECTO.rango) ?? conteos[0];
  const mejor = conteos.reduce((a, b) => (b.total > a.total ? b : a), defecto);
  return mejor.total > 0 ? mejor.id : ELECCIONES_POR_DEFECTO.rango;
}

/** Lo que dice la frase de arriba de /deptos: cuántos deptos publicados revisó la noche y cuántos convenían con pie 20 %. */
export interface ResumenNoche {
  revisados: number;
  convienen: number;
}

/**
 * EL RESUMEN DE LA NOCHE (17-oct-2026): `deptos_conteo` sobre toda la cobertura, todas las tipologías y todos los precios
 * —el mismo universo que la respuesta de cada búsqueda: publicados en la última semana, con arriendo de referencia—, así la
 * frase y el número de abajo cuentan lo mismo. Null si falla: la frase sale sin cifra.
 *
 * SE CALCULA UNA VEZ POR EVALUACIÓN, NO EN CADA PANTALLA (26-oct-2026). Contar toda la cobertura une ~24.000 avisos de la
 * semana con su evaluación: 2 a 4 s con la base tranquila (medido con EXPLAIN ANALYZE) y más de los 8 s del
 * `statement_timeout` de PostgREST cuando la base está ocupada —12 timeouts en el dashboard del 23 al 26-oct, en el SSR de
 * /deptos, /explorar, /i y el dashboard—. Ahora lo calcula el cron de la evaluación de avisos al terminar y lo guarda en
 * `config` (`deptos_resumen_noche`); las pantallas leen esa fila. Si no hay ninguna guardada (la primera vez), se calcula
 * en el momento y se guarda. Una guardada vieja se sigue leyendo: el número cambia una vez por noche y es mejor que una
 * pantalla que espera 8 s.
 */
export const CLAVE_RESUMEN_NOCHE = "deptos_resumen_noche";

export async function calcularResumenDeLaNoche(admin: SupabaseClient, ahora: Date = new Date()): Promise<ResumenNoche | null> {
  const { data, error } = await admin.rpc("deptos_conteo", {
    comunas: [...COMUNAS_DISPONIBLES], dorms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], uf_min: 0, uf_max: 1e9, desde: desdeVentana(ahora),
  });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "resumen-noche" });
  if (error || !data) return null;
  const filas = data as Array<{ total: number; comprar_20: number }>;
  const revisados = filas.reduce((s, f) => s + (Number(f.total) || 0), 0);
  return revisados > 0 ? { revisados, convienen: filas.reduce((s, f) => s + (Number(f.comprar_20) || 0), 0) } : null;
}

/** Calcula el resumen y lo guarda (lo llama el cron de la evaluación al terminar). Null si no se pudo: queda el anterior. */
export async function guardarResumenDeLaNoche(admin: SupabaseClient, ahora: Date = new Date()): Promise<ResumenNoche | null> {
  const r = await calcularResumenDeLaNoche(admin, ahora);
  if (!r) return null;
  const { error } = await admin.from("config").upsert({ key: CLAVE_RESUMEN_NOCHE, value: JSON.stringify({ ...r, calculadoAt: ahora.toISOString() }), updated_at: ahora.toISOString().replace("Z", "") }, { onConflict: "key" });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-resumen-noche" });
  return r;
}

/** Lo guardado en `config`, o null si no hay o no se lee. */
export function resumenGuardado(valor: string | null | undefined): ResumenNoche | null {
  if (!valor) return null;
  try {
    const v = JSON.parse(valor) as Partial<ResumenNoche>;
    const revisados = Number(v.revisados), convienen = Number(v.convienen);
    return Number.isFinite(revisados) && revisados > 0 && Number.isFinite(convienen) ? { revisados, convienen } : null;
  } catch {
    return null;
  }
}

export async function resumenDeLaNoche(admin: SupabaseClient, ahora: Date = new Date()): Promise<ResumenNoche | null> {
  const { data, error } = await admin.from("config").select("value").eq("key", CLAVE_RESUMEN_NOCHE).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-resumen-noche" });
  const guardado = resumenGuardado(data?.value as string | null | undefined);
  if (guardado) return guardado;
  return guardarResumenDeLaNoche(admin, ahora);
}

/** Lo elegido desde la URL (`?c=Ñuñoa,Macul&t=2,3&r=3000-4000&m=ltr`). */
export function eleccionesDeUrl(sp: URLSearchParams): Partial<EleccionesDeptos> {
  const lista = (k: string) => (sp.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return { comunas: lista("c"), tipologias: lista("t"), rango: sp.get("r") ?? "", modalidad: sp.get("m") === "str" ? "str" : "ltr" };
}

/** Un depto de los primeros, como lo muestra «Estás dentro» y el dashboard: sin enlace ni textos del aviso. */
export interface PrimerDepto {
  avisoId: string;
  comuna: string;
  tipologia: string | null;
  m2: number;
  precioUF: number;
  veredicto: string;
  score: number | null;
  flujo: number | null;
  /** Cuándo se vio publicado (su último chequeo de ficha), si en la última semana; null = por confirmar. */
  vistoAt: string | null;
  /** Está en su selección del día: se puede analizar desde ahí (/semanal valida el aviso contra la selección). */
  enSeleccion?: boolean;
  /** Ya lo analizó (21-oct-2026): su informe, leído en vivo. La tarjeta dice «Ya lo analizaste · Ver informe». */
  informeId?: string | null;
  /** Nuevo o usado, como lo dice el aviso (28-oct-2026): «· Usado» al final de la línea. Ausente si no lo dice. */
  condicion?: CondicionDepto;
}

export const MAX_PRIMEROS = 5;

/**
 * Los primeros deptos de un perfil, de la evaluación de la noche: los que convienen con su pie a 25 años, por puntaje,
 * PRIMERO los que tienen la ficha chequeada publicada en la última semana —la memoria con que arma el semanal—, con el día
 * y la hora en que se vieron («Visto publicado el 14 de octubre a las 03:12»); después, los demás, por confirmar. Sin
 * fichas: lo que se sabe.
 */
export async function primerosDeptos(
  admin: SupabaseClient,
  p: { comunas: string[]; dorms: number[]; ufMin: number; ufMax: number; pie: number },
  ahora: Date = new Date(),
): Promise<PrimerDepto[]> {
  const { data, error } = await admin.rpc("deptos_candidatos", {
    comunas: p.comunas, dorms: p.dorms, uf_min: p.ufMin, uf_max: p.ufMax, desde: desdeVentana(ahora), pie: p.pie >= 30 ? 30 : 20, max_filas: 40,
  });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "primeros" });
  const filas = (data ?? []) as Array<{
    id: string; comuna: string; superficie_m2: number; dormitorios: number; banos: number | null; precio_uf: number;
    score_cron: number | null; flujo: number | null; pub_estado: string | null; pub_at: string | null; condicion: string | null;
  }>;
  const fresco = (f: (typeof filas)[number]) => f.pub_estado === "publicado" && !!f.pub_at && ahora.getTime() - Date.parse(f.pub_at) < MEMORIA_SEMANAL_MS;
  // El orden es determinista (23-oct-2026, el orden fijo): puntaje, flujo e id, como la RPC; a igual puntaje no depende
  // de en qué orden llegaron las filas.
  const porPuntaje = (a: (typeof filas)[number], b: (typeof filas)[number]) =>
    (b.score_cron ?? -1) - (a.score_cron ?? -1) || (b.flujo ?? -Infinity) - (a.flujo ?? -Infinity) || a.id.localeCompare(b.id);
  const orden = [...filas.filter(fresco).sort(porPuntaje), ...filas.filter((f) => !fresco(f)).sort(porPuntaje)];
  return orden.slice(0, MAX_PRIMEROS).map((f) => ({
    avisoId: f.id, comuna: f.comuna, tipologia: tipologiaDe(f.dormitorios, f.banos), m2: Math.round(Number(f.superficie_m2)), precioUF: Math.round(Number(f.precio_uf)),
    veredicto: "COMPRAR", score: f.score_cron, flujo: f.flujo, vistoAt: fresco(f) ? f.pub_at : null,
    ...(condicionDe(f.condicion) ? { condicion: condicionDe(f.condicion) } : {}),
  }));
}

/** La elección pendiente de un correo (lo elegido antes del código). */
/** `puerta`: la de lo elegido (B, C o E), para la entrada (deptos_entradas) y, la E, para la atribución con su detalle. */
export interface Pendiente { correo: string; perfil: Record<string, unknown>; existe: boolean; creadoAt: string; puerta?: string | null; puertaDetalle?: string | null }

export const normalizarCorreo = (c: string) => c.trim().toLowerCase();

/** La puerta (B en /deptos, C en la página del invitado) queda con lo elegido desde el 22-oct-2026: la mide `alta_perdida`.
 *  E (29-oct-2026): la hoja de registro de Explorar sin cuenta. */
export type PuertaPendiente = "B" | "C" | "E";
export const esPuertaDeptos = (x: unknown): x is PuertaPendiente => x === "B" || x === "C" || x === "E";

export async function guardarPendiente(admin: SupabaseClient, correo: string, perfil: Record<string, unknown>, existe: boolean, puerta: PuertaPendiente | null = null, puertaDetalle: string | null = null): Promise<void> {
  const { error } = await admin.from("deptos_pendientes").upsert({ correo: normalizarCorreo(correo), perfil, existe, creado_at: new Date().toISOString(), puerta, puerta_detalle: puertaDetalle }, { onConflict: "correo" });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-pendiente" });
  if (error) throw new Error(`pendiente: ${error.message}`);
}

export async function leerPendiente(admin: SupabaseClient, correo: string): Promise<Pendiente | null> {
  const { data, error } = await admin.from("deptos_pendientes").select("correo, perfil, existe, creado_at, puerta, puerta_detalle").eq("correo", normalizarCorreo(correo)).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-pendiente" });
  return data ? { correo: data.correo as string, perfil: data.perfil as Record<string, unknown>, existe: !!data.existe, creadoAt: data.creado_at as string, puerta: (data.puerta as string | null | undefined) ?? null, puertaDetalle: (data.puerta_detalle as string | null | undefined) ?? null } : null;
}

/**
 * ANTES DE IRSE A GOOGLE (16-oct-2026): lo elegido queda con una clave al azar —todavía no se sabe el correo—, con la
 * hora del servidor (la del «pedido», para saber después si la cuenta nació con esta entrada). Devuelve la clave.
 */
export async function guardarPendienteGoogle(admin: SupabaseClient, perfil: Record<string, unknown>, puerta: PuertaPendiente | null = null, puertaDetalle: string | null = null): Promise<string> {
  const clave = randomBytes(16).toString("hex");
  const { error } = await admin.from("deptos_pendientes").insert({ correo: `${PREFIJO_GOOGLE}${clave}`, perfil, existe: false, creado_at: new Date().toISOString(), puerta, puerta_detalle: puertaDetalle });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-pendiente-google" });
  if (error) throw new Error(`pendiente google: ${error.message}`);
  return clave;
}

/**
 * AL VOLVER DE GOOGLE, en el callback (que ya sabe el correo): lo elegido pasa a nombre del correo, con `existe` decidido
 * como en el código —la cuenta ya existía si nació antes de que la persona saliera a Google (tipoDeAlta)—. Así el alta,
 * la bienvenida (que no sale a la cuenta de /deptos) y todo lo demás lo leen igual que por código. true si había algo.
 */
export async function reclavarPendienteGoogle(admin: SupabaseClient, p: { clave: string; correo: string; cuentaCreadaAt: string | null | undefined }): Promise<boolean> {
  if (!CLAVE_GOOGLE.test(p.clave)) return false;
  const llave = `${PREFIJO_GOOGLE}${p.clave}`;
  const { data, error } = await admin.from("deptos_pendientes").select("perfil, creado_at, puerta, puerta_detalle").eq("correo", llave).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-pendiente-google" });
  if (!data) return false;
  const pedidoAt = data.creado_at as string;
  const existe = tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: p.cuentaCreadaAt, pedidoAt }) === "existente";
  const { error: e2 } = await admin.from("deptos_pendientes").upsert({ correo: normalizarCorreo(p.correo), perfil: data.perfil, existe, creado_at: pedidoAt, puerta: data.puerta ?? null, puerta_detalle: data.puerta_detalle ?? null }, { onConflict: "correo" });
  reportarFalloQuery(e2, { ruta: RUTA, operacion: "reclavar-pendiente-google" });
  if (e2) return false;
  await admin.from("deptos_pendientes").delete().eq("correo", llave);
  return true;
}

export async function borrarPendiente(admin: SupabaseClient, correo: string): Promise<void> {
  const { error } = await admin.from("deptos_pendientes").delete().eq("correo", normalizarCorreo(correo));
  reportarFalloQuery(error, { ruta: RUTA, operacion: "borrar-pendiente" });
}

/** ¿Ese correo ya tiene cuenta? (RPC `correo_tiene_cuenta`, solo el service role). null = no se pudo saber. */
export async function correoTieneCuenta(admin: SupabaseClient, correo: string): Promise<boolean | null> {
  const { data, error } = await admin.rpc("correo_tiene_cuenta", { p_correo: normalizarCorreo(correo) });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "tiene-cuenta" });
  return error ? null : data === true;
}

export { validarElecciones };
