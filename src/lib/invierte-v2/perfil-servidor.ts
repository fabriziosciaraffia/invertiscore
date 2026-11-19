// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL Y LAS OPCIONES, EN EL SERVIDOR (Invierte con Franco, etapa 2, 18-nov-2026).
//   · contextoPerfil: lo que se precarga (comunas de entrada y de perfil_busqueda, el pie sugerido, lo ya guardado).
//   · confirmarPerfil: calcula hasta cuánto (perfil.ts › hastaCuanto), guarda inv_perfiles y escribe en perfil_busqueda las
//     comunas y el tope —el MISMO perfil de la selección semanal— guardando el precio máximo anterior en tope_supuestos para
//     poder volver. Sin renta (la estimación menos precisa) el tope NO reemplaza el precio máximo. Nada se escribe antes.
//   · calcularOpciones: el depto de entrada y los que convienen y le alcanzan en sus comunas (deptos_candidatos, usados), con
//     sus etiquetas; los persiste en inv_deptos (lo que deja de alcanzar se marca, no se borra) y anota en la bitácora, con la
//     orden, qué deptos le presentó Franco (se conserva seis años).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { findNearestStation } from "@/lib/metro-stations";
import { VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { hastaCuanto, comunasPrecargadas, piePrecargado, type PedidoPerfil, type Tope, type Objetivo, type Preocupacion, type Donde } from "./perfil";
import { casoDe, elegirOpciones, etiquetar, vsParecidos, type Caso, type Etiqueta, type OpcionDepto } from "./opciones";
import { anotar, esCuentaTest, leerPersona, ultimaOrdenDe, type ContextoPedido } from "./servidor";
import type { PerfilComparable } from "./base";

const T_PERFILES = "inv_perfiles";
const T_DEPTOS = "inv_deptos";
const TODOS_DORMS = [0, 1, 2, 3, 4, 5, 6];
const TASA_RESPALDO = 4.1;

export interface PerfilInv {
  userId: string;
  objetivo: Objetivo;
  preocupaciones: Preocupacion[];
  comunas: string[];
  /** «¿Dónde buscamos?» (19-nov-2026): la columna es no nula y por defecto «cerca». */
  donde: Donde;
  preaprobado: "tengo" | "tramite" | "no";
  montoPreaprobadoUF: number | null;
  pieTiene: "si" | "parte" | "no" | null;
  pieUF: number | null;
  rentaCLP: number | null;
  otrasCuotasCLP: number | null;
  noDiceRenta: boolean;
  topeUF: number | null;
  topeFuente: Tope["fuente"] | null;
  topeSupuestos: Record<string, unknown> | null;
  avisarCuandoAlcance: boolean;
  esPrueba: boolean;
  updatedAt: string;
}

const aPerfil = (f: Record<string, unknown>): PerfilInv => ({
  userId: f.user_id as string, objetivo: f.objetivo as Objetivo, preocupaciones: (f.preocupaciones as Preocupacion[]) ?? [], comunas: (f.comunas as string[]) ?? [],
  donde: f.donde === "comuna" || f.donde === "convenga" ? f.donde : "cerca",
  preaprobado: f.preaprobado as PerfilInv["preaprobado"], montoPreaprobadoUF: f.monto_preaprobado_uf == null ? null : Number(f.monto_preaprobado_uf),
  pieTiene: (f.pie_tiene as PerfilInv["pieTiene"]) ?? null, pieUF: f.pie_uf == null ? null : Number(f.pie_uf), rentaCLP: (f.renta_liquida_clp as number | null) ?? null,
  otrasCuotasCLP: (f.otras_cuotas_clp as number | null) ?? null, noDiceRenta: f.no_dice_renta === true, topeUF: f.tope_uf == null ? null : Number(f.tope_uf),
  topeFuente: (f.tope_fuente as PerfilInv["topeFuente"]) ?? null, topeSupuestos: (f.tope_supuestos as Record<string, unknown> | null) ?? null,
  avisarCuandoAlcance: f.avisar_cuando_alcance === true, esPrueba: f.es_prueba === true, updatedAt: f.updated_at as string,
});

export async function leerPerfilInv(admin: SupabaseClient, userId: string): Promise<PerfilInv | null> {
  const { data } = await admin.from(T_PERFILES).select("*").eq("user_id", userId).maybeSingle();
  return data ? aPerfil(data as Record<string, unknown>) : null;
}

/** La tasa del motor y la UF del día (config). Sin ellas, la tasa de respaldo del repo y la UF del último valor guardado. */
export async function mercado(admin: SupabaseClient): Promise<{ tasaPct: number; uf: number }> {
  const { data } = await admin.from("config").select("key, value").in("key", ["tasa_hipotecaria", "uf_value"]);
  const v = (k: string) => Number((data ?? []).find((f) => f.key === k)?.value);
  const tasa = v("tasa_hipotecaria");
  const uf = v("uf_value");
  return { tasaPct: Number.isFinite(tasa) && tasa > 0 ? tasa : TASA_RESPALDO, uf: Number.isFinite(uf) && uf > 0 ? uf : 40000 };
}

interface DeptoBase { avisoId: string; comuna: string; precioUF: number | null }
async function deptoEntrada(admin: SupabaseClient, avisoId: string | null): Promise<DeptoBase | null> {
  if (!avisoId) return null;
  const [{ data: sp }, { data: ae }] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("precio_uf").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  return sp ? { avisoId, comuna: sp.comuna as string, precioUF: ae?.precio_uf == null ? null : Number(ae.precio_uf) } : null;
}

export interface ContextoPerfil {
  comunas: string[];
  deEntrada: string | null;
  dePerfil: string[];
  pieSugeridoUF: number | null;
  guardado: PerfilInv | null;
  tasaPct: number;
  uf: number;
}

export async function contextoPerfil(admin: SupabaseClient, userId: string): Promise<ContextoPerfil> {
  const [persona, guardado, { data: pb }, m] = await Promise.all([
    leerPersona(admin, userId), leerPerfilInv(admin, userId),
    admin.from("perfil_busqueda").select("comunas").eq("user_id", userId).maybeSingle(), mercado(admin),
  ]);
  const entrada = await deptoEntrada(admin, persona?.avisoOrigen ?? null);
  // Lo ya confirmado manda; si no, la comuna de entrada y las del perfil de la selección semanal.
  const pre = comunasPrecargadas(entrada?.comuna ?? null, guardado?.comunas?.length ? guardado.comunas : ((pb?.comunas as string[] | null) ?? []));
  return { ...pre, pieSugeridoUF: guardado?.pieUF ?? piePrecargado(persona?.pie ?? null, entrada?.precioUF ?? null), guardado, tasaPct: m.tasaPct, uf: m.uf };
}

export type ResultadoPerfil = { ok: true; tope: Tope; editado: boolean } | { ok: false; error: "sin-orden" | "guardar" };

export async function confirmarPerfil(admin: SupabaseClient, user: { id: string; email: string | null }, pedido: PedidoPerfil, ctx: ContextoPedido | null): Promise<ResultadoPerfil> {
  const orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) return { ok: false, error: "sin-orden" };
  const [m, previo, { data: pb }, esPrueba] = await Promise.all([
    mercado(admin), leerPerfilInv(admin, user.id), admin.from("perfil_busqueda").select("comunas, precio_max_uf").eq("user_id", user.id).maybeSingle(), esCuentaTest(admin, user.id),
  ]);
  const tope = hastaCuanto({ ...pedido, tasaPct: m.tasaPct, uf: m.uf, aprobadaUF: previo?.topeFuente === "aprobada" ? Number(previo.topeSupuestos?.aprobadaUF ?? 0) || null : null });
  const reemplaza = tope.fuente !== "solo_pie";
  // El precio máximo anterior: el que había la PRIMERA vez que el tope lo reemplazó (para poder volver a él).
  const anterior = (previo?.topeSupuestos?.precioMaxAnterior as { valor: number | null } | undefined) ?? (pb ? { valor: pb.precio_max_uf == null ? null : Number(pb.precio_max_uf) } : { valor: null });
  // Las comunas de antes (pedido de Fabrizio, 18-nov-2026): las del perfil de búsqueda la PRIMERA vez que el perfil las pisa, para
  // que Reiniciar prueba las devuelva. Un perfil confirmado antes de este cambio no las tiene: no se inventan con las ya pisadas.
  const comunasAnterior = previo
    ? ((previo.topeSupuestos?.comunasAnterior as { valor: string[] | null } | undefined) ?? null)
    : { valor: (pb?.comunas as string[] | null | undefined) ?? null };
  // El cambio del perfil (entrega 2, lámina 3.3-perfil-editado): lo de antes y lo de ahora, y cómo estaban sus deptos ANTES del
  // recálculo, para que «Perfil actualizado» diga qué entra y qué queda fuera aunque la página se recargue.
  const ultimoCambio = previo ? await cambioDelPerfil(admin, user.id, previo, pedido, tope.topeUF) : null;
  const supuestos = { ...tope.supuestos, limita: tope.limita, porPieUF: tope.porPieUF, creditoUF: tope.creditoUF, precioMaxAnterior: anterior, reemplazoPrecioMax: reemplaza, ...(comunasAnterior ? { comunasAnterior } : {}), ...(previo?.topeSupuestos?.aprobadaUF ? { aprobadaUF: previo.topeSupuestos.aprobadaUF } : {}), ...(ultimoCambio ? { ultimoCambio } : {}) };
  const fila = {
    user_id: user.id, objetivo: pedido.objetivo, preocupaciones: pedido.preocupaciones, comunas: pedido.comunas, preaprobado: pedido.preaprobado,
    monto_preaprobado_uf: pedido.montoPreaprobadoUF, pie_tiene: pedido.pieTiene, pie_uf: pedido.pieUF, renta_liquida_clp: pedido.rentaCLP,
    otras_cuotas_clp: pedido.otrasCuotasCLP, no_dice_renta: pedido.noDiceRenta, tope_uf: tope.topeUF, tope_fuente: tope.fuente, tope_supuestos: supuestos,
    es_prueba: esPrueba, updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from(T_PERFILES).upsert(fila, { onConflict: "user_id" });
  if (error) return { ok: false, error: "guardar" };
  // UN SOLO PERFIL: las comunas y (salvo sin renta) el tope van también al de la selección semanal.
  const pbFila: Record<string, unknown> = { user_id: user.id, comunas: pedido.comunas, actualizado_at: new Date().toISOString() };
  if (reemplaza && tope.topeUF > 0) pbFila.precio_max_uf = Math.round(tope.topeUF);
  const r = await admin.from("perfil_busqueda").upsert(pbFila, { onConflict: "user_id" });
  if (r.error) console.error("[inv2] perfil_busqueda:", r.error.message);
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: previo ? "perfil_actualizado" : "perfil_confirmado", detalle: { tope_uf: tope.topeUF, fuente: tope.fuente, comunas: pedido.comunas }, ctx, esPrueba });
  return { ok: true, tope, editado: !!ultimoCambio && ultimoCambio.deptos.some((d) => d.estado === "elegido") };
}

export interface CambioPerfil { antes: PerfilComparable; despues: PerfilComparable; at: string; deptos: { avisoId: string; alcanza: boolean; estado: string }[] }

async function cambioDelPerfil(admin: SupabaseClient, userId: string, previo: PerfilInv, pedido: PedidoPerfil, topeUF: number): Promise<CambioPerfil> {
  const { data } = await admin.from(T_DEPTOS).select("aviso_id, alcanza, estado").eq("user_id", userId);
  return {
    antes: { pieUF: previo.pieUF, rentaCLP: previo.rentaCLP, otrasCuotasCLP: previo.otrasCuotasCLP, comunas: previo.comunas, topeUF: previo.topeUF, montoPreaprobadoUF: previo.montoPreaprobadoUF },
    despues: { pieUF: pedido.pieUF, rentaCLP: pedido.rentaCLP, otrasCuotasCLP: pedido.otrasCuotasCLP, comunas: pedido.comunas, topeUF, montoPreaprobadoUF: pedido.montoPreaprobadoUF },
    at: new Date().toISOString(),
    deptos: (data ?? []).map((d) => ({ avisoId: d.aviso_id as string, alcanza: d.alcanza === true, estado: d.estado as string })),
  };
}

// ── LAS OPCIONES ─────────────────────────────────────────────────────────────
export interface FilaCandidato { id: string; comuna: string; lat: number | null; lng: number | null; superficie_m2: number | null; dormitorios: number | null; banos: number | null; condicion: string | null; precio_uf: number; arriendo: { monto?: number } | null; venta: { precioM2UF?: number; n?: number } | null; score_cron: number | null; flujo: number | null }

const desde = () => new Date(Date.now() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

export function aOpcion(f: FilaCandidato, topeUF: number, esEntrada: boolean, veredicto: string | null): OpcionDepto {
  const est = f.lat != null && f.lng != null ? findNearestStation(Number(f.lat), Number(f.lng), "active") : null;
  const precio = Number(f.precio_uf);
  return {
    avisoId: f.id, comuna: f.comuna, dormitorios: f.dormitorios, banos: f.banos, m2: f.superficie_m2 == null ? null : Number(f.superficie_m2), precioUF: precio,
    veredicto, score: f.score_cron, flujoCLP: f.flujo, arriendoCLP: f.arriendo?.monto ?? null, vsParecidosPct: vsParecidos(precio, f.superficie_m2 == null ? null : Number(f.superficie_m2), f.venta),
    metro: est ? { estacion: est.station.name, metros: est.distance } : null, esEntrada, alcanza: precio <= topeUF + 0.5,
  };
}

async function candidatos(admin: SupabaseClient, comunas: string[], ufMax: number): Promise<FilaCandidato[]> {
  const { data, error } = await admin.rpc("deptos_candidatos", { comunas, dorms: TODOS_DORMS, uf_min: 0, uf_max: ufMax, desde: desde(), pie: 20, max_filas: 40, plazo: 30 });
  if (error) throw new Error(`opciones: ${error.message}`);
  return ((data ?? []) as FilaCandidato[]).filter((f) => (f.condicion ?? "usado") === "usado");
}

/** El depto de entrada con los mismos campos (aunque no dé Comprar o no le alcance). */
export async function filaEntrada(admin: SupabaseClient, avisoId: string): Promise<{ fila: FilaCandidato; veredicto: string | null } | null> {
  const [{ data: sp }, { data: ae }] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("precio_uf, arriendo, venta, score_20, flujo_20, veredicto_20").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  if (!sp || !ae?.precio_uf) return null;
  return {
    fila: { id: sp.id as string, comuna: sp.comuna as string, lat: sp.lat as number | null, lng: sp.lng as number | null, superficie_m2: sp.superficie_m2 as number | null, dormitorios: sp.dormitorios as number | null, banos: sp.banos as number | null, condicion: (sp.condicion as string | null) ?? "usado", precio_uf: Number(ae.precio_uf), arriendo: ae.arriendo as FilaCandidato["arriendo"], venta: ae.venta as FilaCandidato["venta"], score_cron: (ae.score_20 as number | null) ?? null, flujo: (ae.flujo_20 as number | null) ?? null },
    veredicto: (ae.veredicto_20 as string | null) ?? null,
  };
}

/** El depto más barato que conviene en sus comunas, sin tope: para decir cuánto le falta (caso 2). Por tramos de precio. */
async function masBarato(admin: SupabaseClient, comunas: string[], desdeUF: number): Promise<number | null> {
  for (const techo of [desdeUF * 1.3, desdeUF * 1.8, desdeUF * 3, 100000]) {
    const filas = await candidatos(admin, comunas, Math.max(techo, 1));
    if (filas.length) return Math.min(...filas.map((f) => Number(f.precio_uf)));
  }
  return null;
}

export interface ResultadoOpciones {
  caso: Caso;
  opciones: OpcionDepto[];
  etiquetas: Record<string, Etiqueta>;
  /** Los que ya eligió (siguen aunque hoy no le alcancen; quedan marcados). */
  elegidos: string[];
  entrada: OpcionDepto | null;
  masBaratoUF: number | null;
  perfil: PerfilInv;
}

export async function calcularOpciones(admin: SupabaseClient, user: { id: string; email: string | null }): Promise<ResultadoOpciones | null> {
  const [perfil, persona, orden] = await Promise.all([leerPerfilInv(admin, user.id), leerPersona(admin, user.id), ultimaOrdenDe(admin, user.id)]);
  if (!perfil || !orden) return null;
  const tope = perfil.topeUF ?? 0;
  const avisoEntrada = persona?.avisoOrigen ?? orden.avisoId;
  const [filas, ent] = await Promise.all([tope > 0 ? candidatos(admin, perfil.comunas, tope) : Promise.resolve([] as FilaCandidato[]), avisoEntrada ? filaEntrada(admin, avisoEntrada) : Promise.resolve(null)]);
  const entrada = ent ? aOpcion(ent.fila, tope, true, ent.veredicto) : null;
  const lista = filas.map((f) => aOpcion(f, tope, false, "COMPRAR"));
  const deFranco = elegirOpciones(entrada, lista, perfil.objetivo, perfil.preocupaciones);
  const etiquetas = Object.fromEntries(etiquetar(deFranco));
  const caso = casoDe(deFranco);
  const masBaratoUF = caso === "caso2" ? await masBarato(admin, perfil.comunas, Math.max(tope, 500)) : null;

  // Los que ya eligió y hoy no están entre las de Franco (salieron del top o se sumaron aparte) siguen en la tabla, al final y
  // marcados: si no, desaparecían y «Seguir con estos» los soltaba sin avisar. Con 6 activos y el de entrada son 7 columnas
  // como mucho; la tabla del PC se desliza adentro, con la primera columna fija.
  const { data: previos } = await admin.from(T_DEPTOS).select("aviso_id, estado, alcanza").eq("user_id", user.id);
  const faltan = (previos ?? []).filter((p) => p.estado === "elegido" && !deFranco.some((o) => o.avisoId === p.aviso_id)).map((p) => p.aviso_id as string);
  const extras = (await Promise.all(faltan.map((id) => filaEntrada(admin, id)))).filter((e): e is NonNullable<typeof e> => !!e).map((e) => aOpcion(e.fila, tope, false, e.veredicto));
  const opciones = [...deFranco, ...extras];

  // Persistir: lo nuevo entra como opción; lo que ya estaba se actualiza (y lo que deja de alcanzar se marca, no se borra).
  const yaEstaban = new Map((previos ?? []).map((p) => [p.aviso_id as string, p]));
  const ahora = new Date().toISOString();
  const filasUpsert = opciones.map((o) => {
    const prev = yaEstaban.get(o.avisoId);
    return {
      user_id: user.id, aviso_id: o.avisoId, estado: (prev?.estado as string | undefined) ?? "opcion", origen: o.esEntrada ? "entrada" : "franco",
      etiqueta: etiquetas[o.avisoId] ?? null, alcanza: o.alcanza, fuera_de_alcance_at: o.alcanza ? null : ahora,
      datos: { precioUF: o.precioUF, veredicto: o.veredicto, score: o.score, flujoCLP: o.flujoCLP, comuna: o.comuna, m2: o.m2, dormitorios: o.dormitorios, banos: o.banos }, es_prueba: perfil.esPrueba, updated_at: ahora,
    };
  });
  // Los que ya estaban y hoy no aparecen: quedan como estaban. Fuera de alcance se marca solo por PRECIO (en `opciones` va con su
  // `alcanza` real); salir del top de Franco no es dejar de alcanzarle.
  if (filasUpsert.length) await admin.from(T_DEPTOS).upsert(filasUpsert, { onConflict: "user_id,aviso_id" });
  const nuevos = opciones.filter((o) => !yaEstaban.has(o.avisoId));
  if (nuevos.length) await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "sistema", accion: "depto_presentado", detalle: { avisos: nuevos.map((o) => ({ aviso_id: o.avisoId, etiqueta: etiquetas[o.avisoId] ?? null, precio_uf: o.precioUF })) }, esPrueba: perfil.esPrueba });
  const elegidos = (previos ?? []).filter((p) => p.estado === "elegido").map((p) => p.aviso_id as string);
  return { caso, opciones, etiquetas, elegidos, entrada, masBaratoUF, perfil };
}

// ── LA ELECCIÓN ──────────────────────────────────────────────────────────────
export type ResultadoEleccion = { ok: true; elegidos: string[] } | { ok: false; error: "vacio" | "maximo" | "fuera" | "guardar" };

/** «Seguir con estos N»: los marcados pasan a elegidos (como mucho MAX_ACTIVOS); solo opciones que le alcanzan. */
export async function elegir(admin: SupabaseClient, user: { id: string; email: string | null }, avisoIds: string[], max: number, ctx: ContextoPedido | null): Promise<ResultadoEleccion> {
  const ids = Array.from(new Set(avisoIds.filter((x) => typeof x === "string")));
  if (!ids.length) return { ok: false, error: "vacio" };
  if (ids.length > max) return { ok: false, error: "maximo" };
  const [{ data: filas }, orden] = await Promise.all([admin.from(T_DEPTOS).select("aviso_id, alcanza, es_prueba").eq("user_id", user.id).in("aviso_id", ids), ultimaOrdenDe(admin, user.id)]);
  if ((filas ?? []).length !== ids.length || (filas ?? []).some((f) => !f.alcanza)) return { ok: false, error: "fuera" };
  const ahora = new Date().toISOString();
  const a = await admin.from(T_DEPTOS).update({ estado: "elegido", elegido_at: ahora, updated_at: ahora }).eq("user_id", user.id).in("aviso_id", ids);
  const b = await admin.from(T_DEPTOS).update({ estado: "opcion", elegido_at: null, updated_at: ahora }).eq("user_id", user.id).eq("estado", "elegido").not("aviso_id", "in", `(${ids.map((x) => `"${x}"`).join(",")})`);
  if (a.error || b.error) return { ok: false, error: "guardar" };
  await tareasGestionar(admin, user.id, ids, (filas ?? []).some((f) => f.es_prueba));
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden?.id ?? null, actor: "persona", accion: "deptos_elegidos", detalle: { avisos: ids }, ctx, esPrueba: (filas ?? []).some((f) => f.es_prueba) });
  return { ok: true, elegidos: ids };
}

/** Cada depto elegido deja una tarea «gestionar al corredor» (entrega 2, lámina 3.3-sumar-otro-depto: «adentro cae una tarea
 *  para gestionar al corredor»). Una pendiente por persona y depto (índice único): elegirlo de nuevo no la duplica. */
export async function tareasGestionar(admin: SupabaseClient, userId: string, avisoIds: string[], esPrueba: boolean): Promise<void> {
  for (const aviso_id of avisoIds) {
    const { error } = await admin.from("inv_tareas").insert({ user_id: userId, tipo: "gestionar_corredor", aviso_id, es_prueba: esPrueba });
    if (error && error.code !== "23505") console.error("[inv2] tarea gestionar:", error.message);
  }
}

/** «Avísenme cuando algo me alcance»: se anota en el perfil y crea una tarea (el envío del aviso es de otra etapa). */
export async function pedirAviso(admin: SupabaseClient, user: { id: string; email: string | null }, avisoId: string | null): Promise<boolean> {
  const perfil = await leerPerfilInv(admin, user.id);
  if (!perfil) return false;
  const p = await admin.from(T_PERFILES).update({ avisar_cuando_alcance: true, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  const t = await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "avisar_alcance", aviso_id: avisoId, detalle: { tope_uf: perfil.topeUF, comunas: perfil.comunas }, es_prueba: perfil.esPrueba });
  // Una tarea pendiente igual ya existe (índice único): no es un error.
  return !p.error && (!t.error || t.error.code === "23505");
}
