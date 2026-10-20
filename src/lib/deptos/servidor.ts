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
import { MEMORIA_SEMANAL_MS, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { CLAVE_GOOGLE, ELECCIONES_POR_DEFECTO, PREFIJO_GOOGLE, RANGOS_UF, respuestaDeptos, tipoDeAlta, validarElecciones, type ConteoComuna, type EleccionesDeptos, type RespuestaDeptos, type Validacion } from "./respuesta";

const RUTA = "lib/deptos";
type Ok = Extract<Validacion, { ok: true }>;

const desdeVentana = (ahora: Date) => new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

/** La respuesta al instante: sus comunas y, por si da cero, las vecinas, en una sola consulta. */
export async function responderDeptos(admin: SupabaseClient, v: Ok, ahora: Date = new Date()): Promise<RespuestaDeptos> {
  const vecinas = comunasVecinas(v.comunas).filter((c) => !v.comunas.includes(c));
  const { data, error } = await admin.rpc("deptos_conteo", {
    comunas: [...v.comunas, ...vecinas], dorms: v.dorms, uf_min: v.rango.min ?? 0, uf_max: v.rango.max, desde: desdeVentana(ahora),
  });
  if (error) throw new Error(`deptos_conteo: ${error.message}`);
  const filas = ((data ?? []) as Array<{ comuna: string; total: number; comprar_20: number; comprar_30: number }>)
    .map((f): ConteoComuna => ({ comuna: f.comuna, total: Number(f.total) || 0, comprar20: Number(f.comprar_20) || 0, comprar30: Number(f.comprar_30) || 0 }));
  return respuestaDeptos(v, filas.filter((f) => v.comunas.includes(f.comuna)), filas.filter((f) => vecinas.includes(f.comuna)));
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
 */
export async function resumenDeLaNoche(admin: SupabaseClient, ahora: Date = new Date()): Promise<ResumenNoche | null> {
  const { data, error } = await admin.rpc("deptos_conteo", {
    comunas: [...COMUNAS_DISPONIBLES], dorms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], uf_min: 0, uf_max: 1e9, desde: desdeVentana(ahora),
  });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "resumen-noche" });
  if (error || !data) return null;
  const filas = data as Array<{ total: number; comprar_20: number }>;
  const revisados = filas.reduce((s, f) => s + (Number(f.total) || 0), 0);
  return revisados > 0 ? { revisados, convienen: filas.reduce((s, f) => s + (Number(f.comprar_20) || 0), 0) } : null;
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
    score_cron: number | null; flujo: number | null; pub_estado: string | null; pub_at: string | null;
  }>;
  const fresco = (f: (typeof filas)[number]) => f.pub_estado === "publicado" && !!f.pub_at && ahora.getTime() - Date.parse(f.pub_at) < MEMORIA_SEMANAL_MS;
  const orden = [...filas.filter(fresco), ...filas.filter((f) => !fresco(f))];
  return orden.slice(0, MAX_PRIMEROS).map((f) => ({
    avisoId: f.id, comuna: f.comuna, tipologia: tipologiaDe(f.dormitorios, f.banos), m2: Math.round(Number(f.superficie_m2)), precioUF: Math.round(Number(f.precio_uf)),
    veredicto: "COMPRAR", score: f.score_cron, flujo: f.flujo, vistoAt: fresco(f) ? f.pub_at : null,
  }));
}

/** La elección pendiente de un correo (lo elegido antes del código). */
export interface Pendiente { correo: string; perfil: Record<string, unknown>; existe: boolean; creadoAt: string }

export const normalizarCorreo = (c: string) => c.trim().toLowerCase();

export async function guardarPendiente(admin: SupabaseClient, correo: string, perfil: Record<string, unknown>, existe: boolean): Promise<void> {
  const { error } = await admin.from("deptos_pendientes").upsert({ correo: normalizarCorreo(correo), perfil, existe, creado_at: new Date().toISOString() }, { onConflict: "correo" });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-pendiente" });
  if (error) throw new Error(`pendiente: ${error.message}`);
}

export async function leerPendiente(admin: SupabaseClient, correo: string): Promise<Pendiente | null> {
  const { data, error } = await admin.from("deptos_pendientes").select("correo, perfil, existe, creado_at").eq("correo", normalizarCorreo(correo)).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-pendiente" });
  return data ? { correo: data.correo as string, perfil: data.perfil as Record<string, unknown>, existe: !!data.existe, creadoAt: data.creado_at as string } : null;
}

/**
 * ANTES DE IRSE A GOOGLE (16-oct-2026): lo elegido queda con una clave al azar —todavía no se sabe el correo—, con la
 * hora del servidor (la del «pedido», para saber después si la cuenta nació con esta entrada). Devuelve la clave.
 */
export async function guardarPendienteGoogle(admin: SupabaseClient, perfil: Record<string, unknown>): Promise<string> {
  const clave = randomBytes(16).toString("hex");
  const { error } = await admin.from("deptos_pendientes").insert({ correo: `${PREFIJO_GOOGLE}${clave}`, perfil, existe: false, creado_at: new Date().toISOString() });
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
  const { data, error } = await admin.from("deptos_pendientes").select("perfil, creado_at").eq("correo", llave).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-pendiente-google" });
  if (!data) return false;
  const pedidoAt = data.creado_at as string;
  const existe = tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: p.cuentaCreadaAt, pedidoAt }) === "existente";
  const { error: e2 } = await admin.from("deptos_pendientes").upsert({ correo: normalizarCorreo(p.correo), perfil: data.perfil, existe, creado_at: pedidoAt }, { onConflict: "correo" });
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
