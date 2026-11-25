// ─────────────────────────────────────────────────────────────────────────────
// LA VISITA ANTES DE CERRAR EL PRECIO, EN EL SERVIDOR (etapa 3, 24-nov-2026; visita.ts tiene la regla y los textos). Quién va está sin
// decidir: pedir la visita solo avisa a Franco y deja la tarea. El admin pide mantener la contraoferta y carga lo que respondió quien
// vende, agenda la visita y publica el reporte (los puntos revisados; el rango y lo que sugiere Franco se recalculan con la regla). La
// persona pide la visita, confirma en firme (con confirmación explícita) o ajusta el precio (firmarRonda, con el reporte de respaldo).
// Una visita abierta se cancela si la oferta se cierra (retirada, no aceptada, vencida).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLS_OFERTA, leerConfigRango, ofertaDeFila } from "./rango-servidor";
import { REGLA_SUGERENCIA, sugerenciaFranco } from "./b4";
import { avisarPersona, cerrarTareas, venceContraoferta, visitaParaRonda, type DepsAviso } from "./b4-servidor";
import { BUCKET_INVIERTE, anotar, type ContextoPedido } from "./servidor";
import { pasarAAcuerdo } from "./acuerdo-servidor";
import { MAX_FOTOS_VISITA, VISITAS_ABIERTAS, ajusteSugerido, carpetaFotosVisita, estadoDelReporte, puntosVisita, rangoTrasVisita, validarFotoVisita, type EstadoReporte, type FotoVisita, type PuntoVisita } from "./visita";

const T_V = "inv_visitas", T_OF = "inv_ofertas";
const COLS_V = "id, user_id, depto_id, oferta_id, estado, pedida_desde, agendada_para, visitada_at, reporte, reporte_estado, reporte_arreglos, reporte_linea, sugerida_antes_uf, sugerida_despues_uf, reporte_publicado_at, cancelada_motivo, es_prueba, created_at";
type Quien = { id: string; email: string | null };
type Fila = Record<string, unknown>;
const n = (x: unknown) => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);
export type ErrorVisita = "depto" | "etapa" | "oferta" | "estado" | "datos" | "fecha" | "guardar" | "confirmacion";

/** La visita del depto que importa: la abierta, o la última con el reporte publicado (la misma lectura que usa B4). */
export const visitaDelDepto = visitaParaRonda;

/** Cancela la visita abierta del depto (la oferta se cerró, o la persona confirmó sin visitar). */
export async function cancelarVisitaAbierta(admin: SupabaseClient, deptoId: string, motivo: "persona" | "oferta_cerrada" | "quien_vende" | "depto_salio"): Promise<void> {
  const iso = new Date().toISOString();
  const { data } = await admin.from(T_V).update({ estado: "cancelada", cancelada_motivo: motivo, updated_at: iso }).eq("depto_id", deptoId).in("estado", VISITAS_ABIERTAS as unknown as string[]).select("id, user_id, oferta_id");
  for (const v of (data ?? []) as Fila[]) {
    const { data: o } = await admin.from(T_OF).select("aviso_id").eq("id", v.oferta_id as string).maybeSingle();
    if (o?.aviso_id) await cerrarTareas(admin, v.user_id as string, o.aviso_id as string, ["agendar_visita", "hacer_visita", "publicar_reporte", "pedir_mantener_contraoferta"], "sistema");
  }
}

async function ofertaViva(admin: SupabaseClient, userId: string, avisoId: string): Promise<{ depto: { id: string; es_prueba: boolean; etapa: string | null }; f: Fila } | null> {
  const { data: d } = await admin.from("inv_deptos").select("id, es_prueba, etapa").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  if (!d) return null;
  const { data: f } = await admin.from(T_OF).select(`${COLS_OFERTA}, user_id, depto_id, aviso_id, es_prueba`).eq("depto_id", d.id as string).in("estado", ["contraoferta", "aceptada_sujeta"]).order("ronda", { ascending: false }).limit(1).maybeSingle();
  return f ? { depto: { id: d.id as string, es_prueba: d.es_prueba === true, etapa: (d.etapa as string | null) ?? null }, f: f as Fila } : null;
}

async function tarea(admin: SupabaseClient, userId: string, tipo: string, avisoId: string, detalle: Record<string, unknown>, esPrueba: boolean): Promise<void> {
  const ins = await admin.from("inv_tareas").insert({ user_id: userId, tipo, aviso_id: avisoId, estado: "pendiente", detalle, es_prueba: esPrueba });
  if (ins.error && ins.error.code !== "23505") console.error("[inv2] tarea visita:", ins.error.message);
}

// ── LA PERSONA ───────────────────────────────────────────────────────────────
/** PEDIR LA VISITA (decisión 5): con una contraoferta («Visitar antes de responder») o con la oferta aceptada. Solo avisa a Franco y deja
 *  la tarea; con contraoferta, también la de pedirle a quien vende que la mantenga. Pedirla dos veces no duplica nada. */
export async function pedirVisita(admin: SupabaseClient, user: Quien, avisoId: string, ctx: ContextoPedido | null): Promise<{ ok: true; visitaId: string } | { ok: false; error: ErrorVisita }> {
  const x = await ofertaViva(admin, user.id, avisoId);
  if (!x) return { ok: false, error: "oferta" };
  if (x.depto.etapa !== "listo") return { ok: false, error: "etapa" };
  const previa = await visitaDelDepto(admin, x.depto.id);
  if (previa && (VISITAS_ABIERTAS as readonly string[]).includes(previa.estado)) return { ok: true, visitaId: previa.id };
  if (previa && previa.estado === "reporte_publicado") return { ok: false, error: "estado" };
  const desde = x.f.estado === "contraoferta" ? "contraoferta" : "aceptada";
  const { data: v, error } = await admin.from(T_V).insert({ user_id: user.id, depto_id: x.depto.id, oferta_id: x.f.id, estado: "pedida", pedida_desde: desde, es_prueba: x.depto.es_prueba }).select("id").maybeSingle();
  if (error || !v) {
    if (error?.code === "23505") { const otra = await visitaDelDepto(admin, x.depto.id); if (otra) return { ok: true, visitaId: otra.id }; }
    console.error("[inv2] pedir visita:", error?.message);
    return { ok: false, error: "guardar" };
  }
  await tarea(admin, user.id, "agendar_visita", avisoId, { visita_id: v.id, oferta_id: x.f.id, desde }, x.depto.es_prueba);
  if (desde === "contraoferta") {
    await admin.from(T_OF).update({ mantener_pedido_at: new Date().toISOString() }).eq("id", x.f.id as string).is("mantener_pedido_at", null);
    await tarea(admin, user.id, "pedir_mantener_contraoferta", avisoId, { oferta_id: x.f.id, visita_id: v.id, vence: x.f.contraoferta_vence }, x.depto.es_prueba);
  }
  await anotar(admin, { userId: user.id, email: user.email, actor: "persona", accion: "visita_pedida", detalle: { aviso_id: avisoId, visita_id: v.id, oferta_id: x.f.id, desde }, ctx, esPrueba: x.depto.es_prueba });
  return { ok: true, visitaId: v.id as string };
}

/** CONFIRMAR EN FIRME (decisión 7): solo desde aceptada y solo con la confirmación explícita. Tras la visita si su reporte está publicado;
 *  si no, sin visitar (una visita pedida se cancela). Queda la tarea de comunicárselo a quien vende. Desde aquí ya no se puede retirar. */
export async function confirmarEnFirme(admin: SupabaseClient, user: Quien, avisoId: string, pedido: { confirmo?: unknown }, ctx: ContextoPedido | null, ahora: Date = new Date()): Promise<{ ok: true; como: string } | { ok: false; error: ErrorVisita }> {
  if (pedido.confirmo !== true) return { ok: false, error: "confirmacion" };
  const x = await ofertaViva(admin, user.id, avisoId);
  if (!x || x.f.estado !== "aceptada_sujeta") return { ok: false, error: "oferta" };
  const v = await visitaDelDepto(admin, x.depto.id);
  const como = v?.estado === "reporte_publicado" ? "tras_visita" : "sin_visitar";
  const iso = ahora.toISOString();
  const { error } = await admin.from(T_OF).update({ estado: "en_firme", en_firme_at: iso, en_firme_como: como, en_firme_confirmo: true, en_firme_ip: ctx?.ip ?? null, en_firme_user_agent: ctx?.ua ? ctx.ua.slice(0, 500) : null, precio_final_uf: n(x.f.monto_uf), updated_at: iso }).eq("id", x.f.id as string).eq("estado", "aceptada_sujeta");
  if (error) { console.error("[inv2] en firme:", error.message); return { ok: false, error: "guardar" }; }
  if (como === "sin_visitar") await cancelarVisitaAbierta(admin, x.depto.id, "persona");
  else await admin.from(T_V).update({ respuesta: "confirmo", respuesta_at: iso, updated_at: iso }).eq("id", v!.id);
  await pasarAAcuerdo(admin, x.depto.id, { tipo: "persona", email: user.email }, iso);
  await tarea(admin, user.id, "comunicar_en_firme", avisoId, { oferta_id: x.f.id, monto_uf: n(x.f.monto_uf), como }, x.depto.es_prueba);
  await anotar(admin, { userId: user.id, email: user.email, actor: "persona", accion: "oferta_en_firme", detalle: { aviso_id: avisoId, oferta_id: x.f.id, como, monto_uf: n(x.f.monto_uf) }, ctx, esPrueba: x.depto.es_prueba });
  return { ok: true, como };
}

// ── EL ADMIN ─────────────────────────────────────────────────────────────────
async function filaOferta(admin: SupabaseClient, id: string): Promise<Fila | null> {
  const { data } = await admin.from(T_OF).select(`${COLS_OFERTA}, user_id, depto_id, aviso_id, es_prueba`).eq("id", id).maybeSingle();
  return (data as Fila | null) ?? null;
}

/** MANTENER LA CONTRAOFERTA (decisión 4): lo que respondió quien vende. Si acepta, la fecha nueva reemplaza al vencimiento y la de antes
 *  queda guardada aparte. Le avisa a la persona en los dos casos. */
export async function registrarMantener(admin: SupabaseClient, quien: Quien, ofertaId: string, r: { acepta?: unknown; fecha?: unknown }, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true } | { ok: false; error: ErrorVisita }> {
  const f = await filaOferta(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  if (f.estado !== "contraoferta" || !f.mantener_pedido_at || f.mantener_respuesta) return { ok: false, error: "estado" };
  const acepta = r.acepta === true;
  const nueva = acepta ? venceContraoferta(r.fecha, ahora) : null;
  if (acepta && (!nueva || typeof r.fecha !== "string" || !r.fecha)) return { ok: false, error: "fecha" };
  const iso = ahora.toISOString();
  const cambio = acepta
    ? { mantener_respuesta: "acepta", mantener_respuesta_at: iso, mantener_respuesta_por: quien.id, contraoferta_vence_original: f.contraoferta_vence_original ?? f.contraoferta_vence, contraoferta_vence: nueva!.toISOString(), updated_at: iso }
    : { mantener_respuesta: "no_acepta", mantener_respuesta_at: iso, mantener_respuesta_por: quien.id, updated_at: iso };
  const { error } = await admin.from(T_OF).update(cambio).eq("id", ofertaId).eq("estado", "contraoferta");
  if (error) { console.error("[inv2] mantener:", error.message); return { ok: false, error: "guardar" }; }
  await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["pedir_mantener_contraoferta"], quien.email);
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "contraoferta_mantener", detalle: { oferta_id: ofertaId, acepta, vence: acepta ? nueva!.toISOString() : f.contraoferta_vence }, esPrueba: f.es_prueba === true });
  await avisarPersona(admin, deps, f, acepta ? "mantener_si" : "mantener_no", { otroUF: n(f.contraoferta_uf), venceAt: acepta ? nueva : f.contraoferta_vence ? new Date(f.contraoferta_vence as string) : null });
  return { ok: true };
}

/** AGENDAR LA VISITA: el día que se acordó con quien vende (quién va lo coordina Franco por fuera, mientras no esté decidido). */
export async function agendarVisita(admin: SupabaseClient, quien: Quien, visitaId: string, fecha: unknown): Promise<{ ok: true } | { ok: false; error: ErrorVisita }> {
  const m = typeof fecha === "string" ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(fecha) : null;
  if (!m) return { ok: false, error: "fecha" };
  const cuando = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00-03:00`);
  const { data: v } = await admin.from(T_V).select("id, user_id, oferta_id, estado, es_prueba").eq("id", visitaId).maybeSingle();
  if (!v || (v.estado !== "pedida" && v.estado !== "agendada")) return { ok: false, error: "estado" };
  const iso = new Date().toISOString();
  const { error } = await admin.from(T_V).update({ estado: "agendada", agendada_para: cuando.toISOString(), updated_at: iso }).eq("id", visitaId);
  if (error) return { ok: false, error: "guardar" };
  const { data: o } = await admin.from(T_OF).select("aviso_id").eq("id", v.oferta_id as string).maybeSingle();
  if (o?.aviso_id) {
    await cerrarTareas(admin, v.user_id as string, o.aviso_id as string, ["agendar_visita"], quien.email);
    await tarea(admin, v.user_id as string, "hacer_visita", o.aviso_id as string, { visita_id: visitaId, para: cuando.toISOString() }, v.es_prueba === true);
  }
  await anotar(admin, { userId: v.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "visita_agendada", detalle: { visita_id: visitaId, para: cuando.toISOString() }, esPrueba: v.es_prueba === true });
  return { ok: true };
}

/** Los puntos que llegan del admin: tema y texto con contenido, como mucho 12. */
export function limpiarPuntos(x: unknown): PuntoVisita[] | null {
  if (!Array.isArray(x)) return null;
  const ps = x.map((p) => p as Record<string, unknown>).map((p) => ({ tema: String(p.tema ?? "").trim().slice(0, 60), texto: String(p.texto ?? "").trim().slice(0, 240), arreglo: p.arreglo === true, enFotos: p.arreglo === true && p.enFotos === true }))
    .filter((p) => p.tema && p.texto);
  return ps.length && ps.length <= 12 ? ps : null;
}

/** La línea que ve la persona por defecto: el primer arreglo nuevo, o «El estado coincide con las fotos». */
export function lineaPorDefecto(puntos: readonly PuntoVisita[], estado: EstadoReporte): string {
  const nuevo = puntos.find((p) => p.arreglo && !p.enFotos) ?? puntos.find((p) => p.arreglo);
  if (estado === "coincide" || !nuevo) return "El estado coincide con las fotos";
  const t = nuevo.texto.split(/[:.]/)[0].trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** PUBLICAR EL REPORTE (decisiones 1, 2 y 6): los puntos revisados; el estado sale de ellos (sin arreglo nuevo, «coincide»); los puntos de
 *  rebaja de la visita (visita.ts › puntosVisita), el rango después de la visita y lo que sugiere Franco: con contraoferta, se recalcula
 *  y queda en la oferta con esta visita de respaldo (puede quedar bajo la oferta solo con un arreglo); aceptada, el ajuste sugerido. Le
 *  avisa a la persona (le toca decidir). */
export async function publicarReporte(admin: SupabaseClient, quien: Quien, visitaId: string, b: { puntos?: unknown; remodelacion?: unknown; linea?: unknown; fecha?: unknown; fotos?: unknown }, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true; delta: number; sugeridaUF: number | null } | { ok: false; error: ErrorVisita }> {
  const puntos = limpiarPuntos(b.puntos);
  if (!puntos) return { ok: false, error: "datos" };
  const { data: vf } = await admin.from(T_V).select(COLS_V).eq("id", visitaId).maybeSingle();
  if (!vf || !(VISITAS_ABIERTAS as readonly string[]).includes(vf.estado as string)) return { ok: false, error: "estado" };
  // Las fotos que subió el admin: solo rutas de la carpeta de esta visita, como mucho 12, cada una con su copia liviana.
  const fotos = limpiarFotos(b.fotos, vf.user_id as string, visitaId);
  if (fotos == null) return { ok: false, error: "datos" };
  const fechaOk = typeof b.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? new Date(`${b.fecha}T12:00:00-03:00`) : ahora;
  if (fechaOk.getTime() > ahora.getTime() + 864e5) return { ok: false, error: "fecha" };
  // La oferta viva del depto (la contraoferta o la aceptada), no necesariamente la ronda que había cuando se pidió.
  const { data: of } = await admin.from(T_OF).select(`${COLS_OFERTA}, user_id, depto_id, aviso_id, es_prueba`).eq("depto_id", vf.depto_id as string).in("estado", ["contraoferta", "aceptada_sujeta"]).order("ronda", { ascending: false }).limit(1).maybeSingle();
  if (!of) return { ok: false, error: "oferta" };
  const f = of as Fila, o = ofertaDeFila(f);
  const remodelacion = b.remodelacion === true && puntos.some((p) => p.arreglo);
  // Solo los arreglos que suman son los del reporte (los que ya se veían en las fotos, ya bajaron el rango): sin ellos, coincide.
  const arreglos = puntos.filter((p) => p.arreglo && (remodelacion || !p.enFotos)).map((p) => p.texto);
  const estado: EstadoReporte = arreglos.length ? estadoDelReporte(puntos, remodelacion) : "coincide";
  const s = (f.senales ?? {}) as { estadoArriendo?: string | null; arreglos?: string[] };
  const cfg = await leerConfigRango(admin);
  const delta = estado === "coincide" ? 0 : puntosVisita({ estadoFotos: s.estadoArriendo ?? null, arreglosFotos: s.arreglos ?? [], reporte: estado, puntos }, cfg);
  const rango = rangoTrasVisita({ publicadoUF: o.publicadoUF, descuentoPct: o.descuentoPct, comprarUF: o.comprarUF, pisoUF: o.pisoUF, altoUF: o.altoUF }, delta, cfg);
  const linea = typeof b.linea === "string" && b.linea.trim() ? b.linea.trim().slice(0, 140) : lineaPorDefecto(puntos, estado);
  let antes: number | null = null, despues: number | null = null;
  if (o.estado === "contraoferta" && o.montoUF && o.contraofertaUF) {
    antes = o.sugeridaUF ?? null;
    despues = delta > 0 ? sugerenciaFranco({ ofertaUF: o.montoUF, contraofertaUF: o.contraofertaUF, altoUF: rango.altoUF, comprarUF: o.comprarUF, bajarHasta: rango.pisoUF }).montoUF : antes;
  } else if (o.estado === "aceptada_sujeta" && o.montoUF) {
    antes = o.montoUF;
    despues = arreglos.length ? ajusteSugerido(o.montoUF, rango.altoUF) : o.montoUF;
  }
  const iso = ahora.toISOString();
  const { error } = await admin.from(T_V).update({
    estado: "reporte_publicado", agendada_para: (vf.agendada_para as string | null) ?? fechaOk.toISOString(), visitada_at: fechaOk.toISOString(),
    reporte: { puntos, fotos, delta, rango: { pisoUF: rango.pisoUF, altoUF: rango.altoUF, descuentoPct: rango.descuentoPct }, regla: REGLA_SUGERENCIA },
    reporte_estado: estado, reporte_arreglos: arreglos, reporte_linea: linea, sugerida_antes_uf: antes, sugerida_despues_uf: despues,
    reporte_publicado_at: iso, reporte_publicado_por: quien.id, oferta_id: f.id, updated_at: iso,
  }).eq("id", visitaId);
  if (error) { console.error("[inv2] reporte:", error.message); return { ok: false, error: "guardar" }; }
  if (o.estado === "contraoferta" && despues != null && despues !== antes) {
    const { error: e2 } = await admin.from(T_OF).update({ sugerida_uf: despues, sugerida_regla_uf: despues, sugerida_fuente: "regla", sugerida_regla_version: REGLA_SUGERENCIA, sugerida_visita_id: visitaId, sugerida_por: null, sugerida_at: null, updated_at: iso }).eq("id", f.id as string);
    if (e2) console.error("[inv2] sugerencia tras visita:", e2.message);
  }
  await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["agendar_visita", "hacer_visita", "publicar_reporte"], quien.email);
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "visita_reporte_publicado", detalle: { visita_id: visitaId, oferta_id: f.id, estado, arreglos, delta, antes, despues }, esPrueba: f.es_prueba === true });
  await avisarPersona(admin, deps, f, "reporte_listo", {});
  return { ok: true, delta, sugeridaUF: despues };
}

// ── LAS FOTOS DE LA VISITA (24-nov-2026) ─────────────────────────────────────
/** Las fotos del reporte, validadas: rutas dentro de la carpeta de esa visita (la original y su copia liviana), sin repetir, hasta 12.
 *  null si alguna no es de aquí. */
export function limpiarFotos(x: unknown, userId: string, visitaId: string): FotoVisita[] | null {
  if (x == null) return [];
  if (!Array.isArray(x) || x.length > MAX_FOTOS_VISITA) return null;
  const carpeta = carpetaFotosVisita(userId, visitaId);
  const fotos: FotoVisita[] = [];
  for (const f of x as { path?: unknown; mini?: unknown }[]) {
    const path = typeof f?.path === "string" ? f.path : "", mini = typeof f?.mini === "string" ? f.mini : "";
    if (!path.startsWith(carpeta) || !mini.startsWith(carpeta) || path.includes("..") || mini.includes("..")) return null;
    if (!fotos.some((g) => g.path === path)) fotos.push({ path, mini });
  }
  return fotos;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** SUBIR LAS FOTOS (admin): por cada foto, dos URLs firmadas de un solo uso (la original y su copia liviana en JPEG), en la carpeta de la
 *  visita. El navegador del admin sube directo al bucket; las rutas vuelven en «Publicar reporte». */
export async function urlsSubidaFotos(admin: SupabaseClient, visitaId: string, archivos: unknown): Promise<{ ok: true; fotos: { path: string; token: string; mini: string; tokenMini: string }[] } | { ok: false; error: ErrorVisita | "tipo" | "tamano" }> {
  if (!Array.isArray(archivos) || !archivos.length || archivos.length > MAX_FOTOS_VISITA) return { ok: false, error: "datos" };
  const { data: v } = await admin.from(T_V).select("id, user_id, estado").eq("id", visitaId).maybeSingle();
  if (!v || !(VISITAS_ABIERTAS as readonly string[]).includes(v.estado as string)) return { ok: false, error: "estado" };
  const carpeta = carpetaFotosVisita(v.user_id as string, visitaId);
  const fotos: { path: string; token: string; mini: string; tokenMini: string }[] = [];
  for (const a of archivos as { mime?: unknown; bytes?: unknown }[]) {
    const mime = String(a?.mime ?? ""), bytes = Number(a?.bytes);
    const val = validarFotoVisita({ mime, bytes });
    if (!val.ok) return { ok: false, error: val.error };
    const base = `${carpeta}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const [o, m] = await Promise.all([admin.storage.from(BUCKET_INVIERTE).createSignedUploadUrl(`${base}.${EXT[mime]}`), admin.storage.from(BUCKET_INVIERTE).createSignedUploadUrl(`${base}-mini.jpg`)]);
    if (o.error || m.error || !o.data || !m.data) return { ok: false, error: "guardar" };
    fotos.push({ path: o.data.path, token: o.data.token, mini: m.data.path, tokenMini: m.data.token });
  }
  return { ok: true, fotos };
}

/** Al pedir la eliminación de la cuenta: las fotos de sus visitas salen del bucket. Devuelve cuántos archivos borró. */
export async function borrarFotosVisitas(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from(T_V).select("reporte").eq("user_id", userId);
  const rutas = ((data ?? []) as { reporte: { fotos?: FotoVisita[] } | null }[]).flatMap((v) => (v.reporte?.fotos ?? []).flatMap((f) => [f.path, f.mini])).filter((r): r is string => typeof r === "string" && r.startsWith(`visitas/${userId}/`));
  if (!rutas.length) return 0;
  const { error } = await admin.storage.from(BUCKET_INVIERTE).remove(rutas);
  if (error) { console.error("[inv2] borrar fotos de visitas:", error.message); return 0; }
  return rutas.length;
}

export const ACCIONES_VISITA_ADMIN = ["visita_mantener", "visita_agendar", "visita_reporte", "visita_fotos_subida"] as const;
export const esAccionVisitaAdmin = (x: unknown): x is (typeof ACCIONES_VISITA_ADMIN)[number] => typeof x === "string" && (ACCIONES_VISITA_ADMIN as readonly string[]).includes(x);
const uuid = (x: unknown) => (typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x) ? x : null);

/** Despacha una acción del panel de la visita. La ruta solo valida el administrador y reporta el error. */
export async function accionVisitaAdmin(admin: SupabaseClient, quien: Quien, b: Record<string, unknown>, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true } & Record<string, unknown> | { ok: false; error: string }> {
  if (!esAccionVisitaAdmin(b.accion)) return { ok: false, error: "accion" };
  if (b.accion === "visita_mantener") { const id = uuid(b.ofertaId); return id ? registrarMantener(admin, quien, id, { acepta: b.acepta, fecha: b.fecha }, deps, ahora) : { ok: false, error: "datos" }; }
  const visitaId = uuid(b.visitaId);
  if (!visitaId) return { ok: false, error: "datos" };
  if (b.accion === "visita_agendar") return agendarVisita(admin, quien, visitaId, b.fecha);
  if (b.accion === "visita_fotos_subida") return urlsSubidaFotos(admin, visitaId, b.archivos);
  return publicarReporte(admin, quien, visitaId, { puntos: b.puntos, remodelacion: b.remodelacion, linea: b.linea, fecha: b.fecha, fotos: b.fotos }, deps, ahora);
}
