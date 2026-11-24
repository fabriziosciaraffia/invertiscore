// ─────────────────────────────────────────────────────────────────────────────
// LA BASE COMPLETA, EN EL SERVIDOR (Invierte con Franco, etapa 2, entrega 2, 19-nov-2026).
//   · leerBase: sus deptos elegidos (con lo que cambió en su publicación y cuáles faltan por preparar), las otras opciones que
//     convienen y le alcanzan (para «Seguir con este»), su perfil en una línea, la orden y el número de «Escribirle».
//   · sumarDepto: «Seguir con este» de la base y «Sumar a mis opciones» desde el mapa (lámina 3.3-sumar-otro-depto). Hasta
//     MAX_ACTIVOS a la vez; sobre eso, la persona deja uno (`deja`). Solo lo que le alcanza. Un depto del mapa que no estaba entre
//     sus opciones entra con origen «mapa». Cada sumado deja la tarea «gestionar al corredor».
//   · perfilActualizado: lo que entra y lo que queda fuera tras cambiar el perfil (lámina 3.3-perfil-editado), contra la foto de
//     sus deptos guardada al confirmar (perfil-servidor › cambioDelPerfil), así la pantalla dice lo mismo aunque se recargue.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisitaResumen } from "./visita";
import { MAX_ACTIVOS } from "./opciones";
import { cuantasPedir } from "./alternativas";
import { CLAVE_WHATSAPP_FRANCO, numeroWhatsapp, rangoSumar } from "./base";
import { lineaCambio, type TipoCambio, type Vigente } from "./cambios";
import { aOpcion, calcularOpciones, filaEntrada, leerPerfilInv, tareasGestionar, type CambioPerfil, type PerfilInv } from "./perfil-servidor";
import { anotar, ultimaOrdenDe, type ContextoPedido, type OrdenInv } from "./servidor";
import { puedeInvertir } from "@/lib/invierte/invierte";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import type { EstadoVisible } from "./preaprobacion";
import { fichasDe, type FichaDepto } from "./ficha-depto-servidor";
import { etapaDe, ordenBase, type Etapa, type OfertaBase } from "./depto-flujo";
import { leerUbicaciones, numerosDe } from "./depto-servidor";

const T_DEPTOS = "inv_deptos";

export interface DatosDepto { precioUF?: number; veredicto?: string | null; score?: number | null; comuna?: string; m2?: number | null; dormitorios?: number | null; banos?: number | null; flujoCLP?: number | null }
/** De dónde salió (lámina 3.3-base, etapa 3): «El que elegiste» (entrada o mapa) o «Te lo recomendamos» (Franco). */
export type OrigenDepto = "entrada" | "franco" | "mapa";
export interface DeptoDeBase { avisoId: string; alcanza: boolean; datos: DatosDepto; lineas: string[]; preparado: boolean; alMesEnCambio: boolean; origen: OrigenDepto; ficha: FichaDepto | null; /** Etapa 3, B1: en qué va (la línea de estado de la tarjeta). */ etapa: Etapa; noAvanzaMotivo: string | null;
  /** Rediseño del 23-nov (lámina 3.3): la oferta abierta (para decir el rango o que Franco la presenta) y el número confirmado de la calle. */
  oferta: OfertaBase | null; numeroConfirmado: string | null }

interface FilaCambio { aviso_id: string; tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }
const PRINCIPALES: TipoCambio[] = ["precio_baja", "precio_sube", "despublicado", "republicado"];

/** Por depto: la línea del último cambio de la publicación y, debajo, lo que cambió por él ese mismo día (veredicto, al mes). */
export function lineasDeCambios(cs: FilaCambio[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of cs) {
    if (out.has(c.aviso_id) || !PRINCIPALES.includes(c.tipo)) continue;
    const mismoDia = cs.filter((x) => x.aviso_id === c.aviso_id && x.fecha === c.fecha);
    const orden = [...mismoDia.filter((x) => PRINCIPALES.includes(x.tipo)), ...mismoDia.filter((x) => x.tipo === "veredicto"), ...mismoDia.filter((x) => x.tipo === "al_mes")];
    out.set(c.aviso_id, orden.map((x) => lineaCambio(x, x.fecha)).filter((x): x is string => !!x));
  }
  return out;
}

/** Lo que se le muestra de un depto elegido: la foto del día que lo eligió, con lo que la vigilancia de la mañana sabe hoy
 *  (precio, veredicto, lo que deja al mes) encima. Así la tarjeta y la línea de lo que cambió nunca dicen dos precios. */
export function vigenteSobre(d: DatosDepto, v: Partial<Vigente> | null): DatosDepto {
  if (!v) return d;
  return { ...d, ...(v.precioUF != null ? { precioUF: v.precioUF } : {}), ...(v.veredicto ? { veredicto: v.veredicto } : {}), ...(v.flujoCLP != null ? { flujoCLP: v.flujoCLP } : {}) };
}

/** El número de «Escribirle» (modo prueba): el de `config`. Null si no hay uno válido. */
export async function numeroFranco(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("config").select("value").eq("key", CLAVE_WHATSAPP_FRANCO).maybeSingle();
  return numeroWhatsapp(data?.value);
}

export interface Base {
  orden: OrdenInv;
  perfil: PerfilInv | null;
  elegidos: DeptoDeBase[];
  /** Las otras opciones que convienen y le alcanzan, de mejor a peor puntaje. */
  otras: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null }[];
  whatsapp: string | null;
  /** La preaprobación (entrega 3): decide «Lo que te toca hoy». */
  preaprobacion: EstadoVisible;
  /** Lo que la base dice de la preaprobación (20-nov-2026): el motivo si hay que corregirla, la aprobada (banco y vigencia), el archivo
   *  del documento vigente y la subida posterior, si la hay. */
  preDetalle: { motivo: string | null; banco: string | null; vigenteHasta: string | null; mime: string | null; otra: { estado: string; mime: string | null } | null };
}

export async function leerBase(admin: SupabaseClient, userId: string): Promise<Base | null> {
  const [{ data }, orden, perfil, whatsapp, pre] = await Promise.all([
    admin.from(T_DEPTOS).select("aviso_id, estado, origen, alcanza, datos, vigente, elegido_at, etapa, no_avanza_motivo").eq("user_id", userId).in("estado", ["elegido", "opcion"]),
    ultimaOrdenDe(admin, userId), leerPerfilInv(admin, userId), numeroFranco(admin), leerPreaprobacion(admin, userId),
  ]);
  if (!orden) return null;
  const filas = data ?? [];
  const elegidasF = filas.filter((f) => f.estado === "elegido").sort((a, b) => String(a.elegido_at ?? "").localeCompare(String(b.elegido_at ?? "")));
  const ids = elegidasF.map((f) => f.aviso_id as string);
  const [{ data: cambios }, { data: preparados }] = ids.length
    ? await Promise.all([
      admin.from("inv_cambios").select("aviso_id, tipo, antes, despues, fecha, created_at").eq("user_id", userId).eq("en_base", true).in("aviso_id", ids).order("created_at", { ascending: false }).limit(60),
      admin.from("guia_analisis").select("aviso_id").eq("user_id", userId).in("aviso_id", ids).not("analysis_id", "is", null),
    ])
    : [{ data: [] }, { data: [] }];
  const lineas = lineasDeCambios((cambios ?? []) as FilaCambio[]);
  const listos = new Set((preparados ?? []).map((p) => p.aviso_id as string));
  const conCambioAlMes = new Set((cambios ?? []).filter((c) => c.tipo === "al_mes").map((c) => `${c.aviso_id}|${c.fecha}`));
  const ultimaFecha = new Map<string, string>();
  for (const c of (cambios ?? []) as FilaCambio[]) if (PRINCIPALES.includes(c.tipo) && !ultimaFecha.has(c.aviso_id)) ultimaFecha.set(c.aviso_id, c.fecha);
  const elegidos = elegidasF.map((f) => {
    const id = f.aviso_id as string;
    return {
      avisoId: id, alcanza: f.alcanza === true, datos: vigenteSobre((f.datos ?? {}) as DatosDepto, f.vigente as Partial<Vigente> | null), lineas: lineas.get(id) ?? [],
      preparado: listos.has(id), alMesEnCambio: conCambioAlMes.has(`${id}|${ultimaFecha.get(id) ?? ""}`),
      origen: ((f.origen as string | null) ?? "mapa") as OrigenDepto, ficha: null as FichaDepto | null,
      etapa: etapaDe({ estado: "elegido", etapa: (f.etapa as string | null) ?? null }) ?? "confirmando", noAvanzaMotivo: (f.no_avanza_motivo as string | null) ?? null,
      oferta: null as DeptoDeBase["oferta"], numeroConfirmado: null as string | null,
    };
  });
  // «Otras opciones que convienen»: las recomendaciones de Franco que no eligió, nunca más del cupo de tres en todo el flujo
  // contando las que ya eligió (alternativas.ts; decisión de Fabrizio, 19-nov-2026).
  const elegidasFranco = filas.filter((f) => f.estado === "elegido" && f.origen === "franco").length;
  const otras = filas
    .filter((f) => f.estado === "opcion" && f.origen === "franco" && f.alcanza === true && (f.datos as DatosDepto | null)?.veredicto === "COMPRAR")
    .map((f) => ({ avisoId: f.aviso_id as string, datos: (f.datos ?? {}) as DatosDepto, ficha: null as FichaDepto | null }))
    .sort((a, b) => (b.datos.score ?? 0) - (a.datos.score ?? 0))
    .slice(0, cuantasPedir(elegidasFranco));
  // La ficha de cada tarjeta (etapa 3, parte A): título calle·metro, fotos, cap rate y «Lo que ve Franco» si ya está.
  const todos = [...elegidos, ...otras];
  // Una sola fuente de números (B1): con la ubicación confirmada, los del análisis rehecho.
  const ubic = await leerUbicaciones(admin, todos.map((d) => d.avisoId));
  for (const d of todos) d.datos = numerosDe(d.datos, ubic[d.avisoId]);
  // La oferta abierta de cada elegido (lámina 3.3 del 23-nov): el rango si está en borrador; si no, que Franco la presenta.
  // Segunda vuelta (23-nov): en la MISMA consulta, el monto, cuándo se presentó, la contraoferta y si quedó en firme sin visitar, para
  // la línea de estado y el camino chico de cada tarjeta. La más reciente por depto (una oferta en firme también cuenta).
  const { data: ofs } = ids.length ? await admin.from("inv_ofertas").select("aviso_id, estado, piso_uf, senales, monto_uf, presentada_at, vigente_hasta, contraoferta_uf, en_firme_como, sin_acuerdo_motivo, respuesta, respuesta_tardia, tardia_decision, retirada_at, mantener_respuesta, depto_id, ronda, created_at").eq("user_id", userId).in("aviso_id", ids).in("estado", ["borrador", "firmada", "en_cola", "presentada", "contraoferta", "aceptada_sujeta", "en_firme", "sin_acuerdo", "retirada"]).order("ronda", { ascending: false }).order("created_at", { ascending: false }) : { data: [] };
  type FilaOf = { aviso_id: string; estado: string; piso_uf: number | null; senales: { alto?: number; b4?: { tipo?: string } } | null; monto_uf: number | null; presentada_at: string | null; vigente_hasta: string | null; contraoferta_uf: number | null; en_firme_como: string | null; sin_acuerdo_motivo: string | null; respuesta: string | null; respuesta_tardia: string | null; tardia_decision: string | null; retirada_at: string | null; mantener_respuesta: string | null; depto_id: string };
  // La visita de cada depto (24-nov-2026): la abierta o la última con reporte, en una consulta (la tarjeta y el camino chico la usan).
  const deptosOf = Array.from(new Set(((ofs ?? []) as FilaOf[]).map((o) => o.depto_id)));
  const { data: vs } = deptosOf.length ? await admin.from("inv_visitas").select("depto_id, id, estado, visitada_at, reporte_arreglos, created_at").in("depto_id", deptosOf).neq("estado", "cancelada").order("created_at", { ascending: false }) : { data: [] };
  const visitaPor = new Map<string, VisitaResumen>();
  for (const v of (vs ?? []) as { depto_id: string; id: string; estado: string; visitada_at: string | null; reporte_arreglos: string[] | null }[]) if (!visitaPor.has(v.depto_id)) visitaPor.set(v.depto_id, { id: v.id, estado: v.estado, pedidaDesde: null, visitadaAt: v.visitada_at, reporteEstado: null, reporteLinea: null, arreglos: v.reporte_arreglos ?? [], puntos: [], fotos: [], delta: 0, pisoUF: null, altoUF: null, sugeridaAntesUF: null, sugeridaDespuesUF: null });
  const ofPor = new Map<string, OfertaBase>();
  for (const o of (ofs ?? []) as FilaOf[]) if (!ofPor.has(o.aviso_id)) ofPor.set(o.aviso_id, { estado: o.estado, pisoUF: o.piso_uf != null ? Number(o.piso_uf) : null, altoUF: o.senales?.alto != null ? Number(o.senales.alto) : null, montoUF: o.monto_uf != null ? Number(o.monto_uf) : null, presentadaAt: o.presentada_at, contraofertaUF: o.contraoferta_uf != null ? Number(o.contraoferta_uf) : null, enFirmeComo: o.en_firme_como,
    // B4: el vencimiento y cómo terminó (la última ronda del depto, aunque haya cerrado sin acuerdo).
    vigenteHasta: o.vigente_hasta, sinAcuerdoMotivo: o.sin_acuerdo_motivo, respuesta: o.respuesta, respuestaTardia: o.respuesta_tardia, tardiaDecision: o.tardia_decision, retiradaAt: o.retirada_at, tipoRonda: o.senales?.b4?.tipo ?? null, mantenerRespuesta: o.mantener_respuesta, visita: visitaPor.get(o.depto_id) ?? null });
  for (const d of elegidos) { d.oferta = ofPor.get(d.avisoId) ?? null; d.numeroConfirmado = ubic[d.avisoId]?.numero ?? null; }
  // Por nivel (Te toca a ti, En curso, Recién partiendo) y, dentro de cada nivel, el más avanzado primero (segunda vuelta, 23-nov).
  const ordenados = ordenBase(elegidos, pre.estado);
  // Las cuatro cifras de cada tarjeta, de una sola fuente (23-nov-2026): fichasDe las arma con el motor si la ubicación está confirmada.
  const fichas = await fichasDe(admin, todos.map((d) => d.avisoId), Object.fromEntries(todos.map((d) => [d.avisoId, d.datos.precioUF ?? null])), Object.fromEntries(todos.map((d) => [d.avisoId, d.datos.flujoCLP ?? null])));
  for (const d of todos) d.ficha = fichas[d.avisoId] ?? null;
  const preDetalle = { motivo: pre.doc?.motivo ?? null, banco: pre.doc?.banco ?? null, vigenteHasta: pre.doc?.vigenteHasta ?? null, mime: pre.doc?.mime ?? null, otra: pre.otra ? { estado: pre.otra.estado, mime: pre.otra.mime } : null };
  return { orden, perfil, elegidos: ordenados, otras, whatsapp, preaprobacion: pre.estado, preDetalle };
}

// ── SUMAR UN DEPTO ───────────────────────────────────────────────────────────
export type ResultadoSumar =
  | { ok: true; ya: boolean }
  | { ok: false; error: "sin-orden" | "sin-perfil" | "depto" | "fuera" | "maximo" | "deja" | "guardar" };

/** Lo que la pantalla de sumar necesita saber antes del toque (sin escribir nada). */
export interface VistaSumar { estado: "sin-orden" | "sin-perfil" | "depto" | "ya" | "listo"; datos?: DatosDepto; alcanza?: boolean; perfil?: PerfilInv; orden?: OrdenInv; activos?: { avisoId: string; datos: DatosDepto }[] }

export async function vistaSumar(admin: SupabaseClient, userId: string, avisoId: string): Promise<VistaSumar> {
  const [orden, perfil] = await Promise.all([ultimaOrdenDe(admin, userId), leerPerfilInv(admin, userId)]);
  if (!orden) return { estado: "sin-orden" };
  if (!perfil) return { estado: "sin-perfil", orden };
  const [{ data: filas }, ent] = await Promise.all([
    admin.from(T_DEPTOS).select("aviso_id, estado, datos").eq("user_id", userId).eq("estado", "elegido"),
    filaEntrada(admin, avisoId),
  ]);
  if (!ent || (ent.fila.condicion ?? "usado") !== "usado") return { estado: "depto", orden, perfil };
  // La misma regla de entrada del botón (etapa 3, 21-nov-2026): un Comprar o un Ajusta supuestos negociable.
  if (!puedeInvertir({ condicion: ent.fila.condicion ?? "usado", veredicto: ent.veredicto, negociable: ent.negociable })) return { estado: "depto", orden, perfil };
  const o = aOpcion(ent.fila, perfil.topeUF ?? 0, false, ent.veredicto);
  const datos: DatosDepto = { precioUF: o.precioUF, veredicto: o.veredicto, score: o.score, flujoCLP: o.flujoCLP, comuna: o.comuna, m2: o.m2, dormitorios: o.dormitorios, banos: o.banos };
  const activos = (filas ?? []).map((f) => ({ avisoId: f.aviso_id as string, datos: (f.datos ?? {}) as DatosDepto }));
  if (activos.some((a) => a.avisoId === avisoId)) return { estado: "ya", orden, perfil, datos, alcanza: o.alcanza, activos };
  return { estado: "listo", orden, perfil, datos, alcanza: o.alcanza, activos };
}

export async function sumarDepto(admin: SupabaseClient, user: { id: string; email: string | null }, avisoId: string, deja: string | null, origen: "base" | "mapa", ctx: ContextoPedido | null): Promise<ResultadoSumar> {
  const v = await vistaSumar(admin, user.id, avisoId);
  if (v.estado === "sin-orden" || v.estado === "sin-perfil" || v.estado === "depto") return { ok: false, error: v.estado };
  if (v.estado === "ya") return { ok: true, ya: true };
  // Un poco sobre su rango (hasta 15 %, sin preaprobación aprobada) se puede sumar igual (20-nov-2026); fuera de rango, no.
  if (!v.alcanza && rangoSumar({ precioUF: v.datos?.precioUF ?? Infinity, topeUF: v.perfil?.topeUF ?? 0, firme: v.perfil?.topeFuente === "aprobada" }) !== "poco_sobre") return { ok: false, error: "fuera" };
  const activos = v.activos ?? [];
  if (activos.length >= MAX_ACTIVOS && !deja) return { ok: false, error: "maximo" };
  if (deja && !activos.some((a) => a.avisoId === deja)) return { ok: false, error: "deja" };
  const ahora = new Date().toISOString();
  const esPrueba = v.perfil!.esPrueba;
  const d = v.datos!;
  // El depto queda elegido con la foto de hoy; si ya estaba como opción conserva su origen (entrada o Franco).
  const { data: previa } = await admin.from(T_DEPTOS).select("origen").eq("user_id", user.id).eq("aviso_id", avisoId).maybeSingle();
  const up = await admin.from(T_DEPTOS).upsert({
    user_id: user.id, aviso_id: avisoId, estado: "elegido", elegido_at: ahora, origen: (previa?.origen as string | undefined) ?? "mapa",
    alcanza: v.alcanza === true, fuera_de_alcance_at: v.alcanza ? null : ahora, datos: d, es_prueba: esPrueba, updated_at: ahora,
  }, { onConflict: "user_id,aviso_id" });
  if (up.error) return { ok: false, error: "guardar" };
  if (deja && activos.length >= MAX_ACTIVOS) {
    const r = await admin.from(T_DEPTOS).update({ estado: "opcion", elegido_at: null, updated_at: ahora }).eq("user_id", user.id).eq("aviso_id", deja);
    if (r.error) return { ok: false, error: "guardar" };
  }
  await tareasGestionar(admin, user.id, [avisoId], esPrueba);
  await anotar(admin, { userId: user.id, email: user.email, ordenId: v.orden!.id, actor: "persona", accion: "depto_sumado", detalle: { aviso_id: avisoId, origen, deja, precio_uf: d.precioUF ?? null }, ctx, esPrueba });
  return { ok: true, ya: false };
}

// ── PERFIL ACTUALIZADO ───────────────────────────────────────────────────────
export interface PerfilActualizado {
  cambio: CambioPerfil;
  topeUF: number;
  entran: { avisoId: string; datos: DatosDepto }[];
  fuera: { avisoId: string; datos: DatosDepto }[];
  siguen: number;
}

/** Recalcula las opciones con el perfil nuevo y las compara con la foto de antes. Null si no hubo un cambio guardado. */
export async function perfilActualizado(admin: SupabaseClient, user: { id: string; email: string | null }): Promise<PerfilActualizado | null> {
  const r = await calcularOpciones(admin, user);
  const cambio = (r?.perfil.topeSupuestos?.ultimoCambio as CambioPerfil | undefined) ?? null;
  if (!r || !cambio) return null;
  const antes = new Map(cambio.deptos.map((d) => [d.avisoId, d]));
  const datosDe = (o: (typeof r.opciones)[number]): DatosDepto => ({ precioUF: o.precioUF, veredicto: o.veredicto, score: o.score, flujoCLP: o.flujoCLP, comuna: o.comuna, m2: o.m2, dormitorios: o.dormitorios, banos: o.banos });
  const entran = r.opciones.filter((o) => o.alcanza && o.veredicto === "COMPRAR" && !antes.get(o.avisoId)?.alcanza).map((o) => ({ avisoId: o.avisoId, datos: datosDe(o) }));
  const fuera = r.opciones.filter((o) => !o.alcanza && antes.get(o.avisoId)?.alcanza).map((o) => ({ avisoId: o.avisoId, datos: datosDe(o) }));
  const siguen = cambio.deptos.filter((d) => d.alcanza && !fuera.some((f) => f.avisoId === d.avisoId)).length;
  return { cambio, topeUF: r.perfil.topeUF ?? 0, entran, fuera, siguen };
}
