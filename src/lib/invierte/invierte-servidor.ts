// ─────────────────────────────────────────────────────────────────────────────
// «PRONTO: INVIERTE CON FRANCO» — el servidor (11-nov-2026). La ruta /api/invierte inscribe con `inscribir`; el informe pregunta
// con `invierteDelInforme` si su portada lleva la franja; Explorar y la selección leen con `inscritosDe` qué tarjetas llevan la
// etiqueta «Inscrito en Invierte con Franco». La tabla `invierte_inscripciones` tiene RLS sin políticas: solo service role.
//   · UNA POR PERSONA Y DEPTO: si repite, se actualiza (upsert por user_id + aviso_id) y el estado del panel no se pisa.
//   · SIN DEPTO NO HAY INSCRIPCIÓN: el aviso tiene que existir; uno cuya condición no se sabe (ni usado ni nuevo) se rechaza aunque el
//     navegador lo pida.
//   · CADA INSCRIPCIÓN LLEGA A hola@ (las de «este mes» con el asunto marcado). Si el correo no sale, la ruta responde error y la
//     hoja ofrece reintentar: no se confirma una inscripción que Franco no recibió.
//   · LA MEDICIÓN: `invierte_inscripcion` a PostHog desde el servidor (con la urgencia y el pie) y el Lead a Meta por
//     emitirEventoMeta (fase 0), uno por persona y depto, con el espejo para el pixel.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { lineaDepto, condicionDe } from "@/lib/guia/linea-depto";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { avisoDelInforme } from "@/lib/guia/publicacion-portada";
import { readVeredicto } from "@/lib/results-helpers";
import { asuntoInscripcion, condicionDeLinea, INVIERTE_COPY, pieDelDepto, puedeInvertir, type DeptoInvierte, type PedidoInvierte } from "./invierte";

export const TABLA_INVIERTE = "invierte_inscripciones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que se sabe del aviso en la base: la línea, el precio, la condición y el veredicto de la noche (pie 20 %). */
export interface AvisoInvierte {
  avisoId: string;
  linea: string;
  precioUF: number | null;
  condicion: "nuevo" | "usado" | undefined;
  veredicto: string | null;
  score: number | null;
  negociable: boolean;
}

export async function leerAviso(admin: SupabaseClient, avisoId: string): Promise<AvisoInvierte | null> {
  if (!UUID.test(avisoId)) return null;
  const [sp, ev] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, superficie_m2, dormitorios, banos, condicion, precio").eq("id", avisoId).order("id").limit(1),
    admin.from("avisos_evaluados").select("aviso_id, precio_uf, condicion, veredicto_20, score_20, negociar_20").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = sp.data?.[0] as Record<string, unknown> | undefined;
  if (!f) return null;
  const e = (ev.data ?? null) as Record<string, unknown> | null;
  const condicion = condicionDe(f.condicion ?? e?.condicion);
  const m2 = Number(f.superficie_m2) || 0;
  const precio = e?.precio_uf != null ? Number(e.precio_uf) : null;
  return {
    avisoId,
    linea: lineaDepto({ comuna: (f.comuna as string) ?? null, tipologia: tipologiaDe(f.dormitorios, f.banos), m2, condicion }),
    precioUF: precio != null && Number.isFinite(precio) ? precio : null,
    condicion,
    veredicto: typeof e?.veredicto_20 === "string" ? e.veredicto_20 : null,
    score: e?.score_20 != null ? Number(e.score_20) : null,
    negociable: e?.negociar_20 != null,
  };
}

/** El informe, si es de la persona: su veredicto y su puntaje (manda sobre la noche cuando la inscripción sale de él). */
async function leerInforme(admin: SupabaseClient, analysisId: string | null | undefined, userId: string): Promise<{ veredicto: string | null; score: number | null; avisoId: string | null } | null> {
  if (!analysisId) return null;
  const { data } = await admin.from("analisis").select("id, user_id, score, results, input_data").eq("id", analysisId).maybeSingle();
  if (!data || data.user_id !== userId) return null;
  const v = readVeredicto((data.results ?? null) as Parameters<typeof readVeredicto>[0]) ?? null;
  return { veredicto: v, score: data.score != null ? Number(data.score) : null, avisoId: avisoDelInforme(data.input_data) };
}

/** La campaña de la cuenta (user_attribution) y la de la cookie de la primera visita (franco_origen, el mismo dato que va a la cuenta: lib/origen-campana.ts). */
async function campanaDe(admin: SupabaseClient, userId: string, sesion: Record<string, unknown> | null): Promise<Record<string, unknown>> {
  const { data } = await admin.from("user_attribution").select("utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path, puerta, puerta_detalle").eq("user_id", userId).maybeSingle();
  const limpio = (o: Record<string, unknown> | null | undefined) => {
    if (!o) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
    return Object.keys(out).length ? out : null;
  };
  return { cuenta: limpio(data as Record<string, unknown> | null), sesion: limpio(sesion) };
}

/** «facebook · paid · campaña» de lo que se sabe; «Directo» sin nada. */
export function textoCampana(c: Record<string, unknown> | null | undefined): string {
  const pick = (o: unknown) => (o && typeof o === "object" ? (o as Record<string, string>) : null);
  const s = pick(c?.sesion);
  const k = pick(c?.cuenta);
  const de = (o: Record<string, string> | null) => (o ? [o.utm_source, o.utm_medium, o.utm_campaign].filter(Boolean).join(" · ") : "");
  const partes = [de(s) && `visita: ${de(s)}`, de(k) && `cuenta: ${de(k)}`, k?.puerta && `puerta ${k.puerta}${k.puerta_detalle ? ` (${k.puerta_detalle})` : ""}`].filter(Boolean);
  return partes.length ? partes.join(" — ") : "Directo";
}

export type ResultadoInscripcion =
  | { ok: true; id: string; repetida: boolean; correo: boolean; depto: DeptoInvierte }
  | { ok: false; error: "depto" | "condicion" | "guardar" | "correo" };

export interface DepsInscribir {
  enviarCorreo: (p: Parameters<typeof import("@/lib/email").sendInscripcionInvierteInterna>[0], llave: string) => Promise<boolean>;
  esPrueba: (userId: string, email: string | null) => Promise<boolean>;
  ahora?: () => Date;
}

/**
 * Inscribe (o actualiza) y avisa a hola@. Devuelve `correo: false` con `ok: false, error: "correo"` si el correo no salió: la fila
 * queda (con `correo_enviado_at` null) y el reintento de la hoja la vuelve a mandar.
 */
export async function inscribir(
  admin: SupabaseClient,
  user: { id: string; email: string | null; nombre: string | null },
  pedido: PedidoInvierte,
  sesionUtm: Record<string, unknown> | null,
  deps: DepsInscribir,
): Promise<ResultadoInscripcion> {
  const aviso = await leerAviso(admin, pedido.avisoId);
  if (!aviso) return { ok: false, error: "depto" };
  // Usados y, desde el 12-nov-2026, nuevos de inmobiliaria; sin condición, no.
  if (aviso.condicion !== "usado" && aviso.condicion !== "nuevo") return { ok: false, error: "condicion" };
  const informe = await leerInforme(admin, pedido.analysisId, user.id);
  const analysisId = informe && (!informe.avisoId || informe.avisoId === aviso.avisoId) ? pedido.analysisId ?? null : null;
  const veredicto = (analysisId ? informe?.veredicto : null) ?? aviso.veredicto;
  const score = (analysisId ? informe?.score : null) ?? aviso.score;
  const pieUF = pieDelDepto(aviso.precioUF);
  const ahora = (deps.ahora ?? (() => new Date()))().toISOString();
  const campana = await campanaDe(admin, user.id, sesionUtm);

  const { data: previa } = await admin.from(TABLA_INVIERTE).select("id").eq("user_id", user.id).eq("aviso_id", aviso.avisoId).maybeSingle();
  const fila = {
    user_id: user.id,
    aviso_id: aviso.avisoId,
    analysis_id: analysisId,
    origen: pedido.origen,
    urgencia: pedido.urgencia,
    pie: pedido.pie,
    pie_uf: pieUF,
    precio_uf: aviso.precioUF != null ? Math.round(aviso.precioUF) : null,
    linea: aviso.linea,
    veredicto,
    score,
    whatsapp: pedido.whatsapp,
    campana,
    correo_enviado_at: null,
    updated_at: ahora,
  };
  const { data: guardada, error } = await admin.from(TABLA_INVIERTE).upsert(fila, { onConflict: "user_id,aviso_id" }).select("id").single();
  if (error || !guardada) {
    console.error("[invierte] guardar:", error?.message);
    return { ok: false, error: "guardar" };
  }
  const id = guardada.id as string;
  const repetida = !!previa;
  const prueba = await deps.esPrueba(user.id, user.email).catch(() => false);
  const H = INVIERTE_COPY.hoja;
  const enviado = await deps.enviarCorreo({
    asunto: asuntoInscripcion({ urgencia: pedido.urgencia, linea: aviso.linea, precioUF: aviso.precioUF, prueba, condicion: aviso.condicion }),
    persona: user.nombre ? `${user.nombre} (${user.email ?? "sin correo"})` : user.email ?? user.id,
    correo: user.email,
    whatsapp: pedido.whatsapp,
    linea: aviso.linea,
    precioUF: aviso.precioUF,
    veredicto,
    score,
    urgencia: H.urgencias[pedido.urgencia],
    pie: H.pies[pedido.pie],
    pieUF,
    origen: { explorar: "Explorar", informe: "La portada del informe", seleccion: "La selección" }[pedido.origen],
    campana: textoCampana(campana),
    avisoId: aviso.avisoId,
    analysisId,
    repetida,
  }, `invierte-${id}-${pedido.urgencia}-${pedido.pie}-${pedido.whatsapp.slice(-8)}`);
  if (!enviado) return { ok: false, error: "correo" };
  await admin.from(TABLA_INVIERTE).update({ correo_enviado_at: new Date().toISOString() }).eq("id", id);
  return {
    ok: true,
    id,
    repetida,
    correo: true,
    depto: { avisoId: aviso.avisoId, linea: aviso.linea, precioUF: aviso.precioUF ?? 0, veredicto: veredicto ?? "", score, analysisId },
  };
}

/** Los avisos en que la persona ya está inscrita (para la etiqueta de la tarjeta). Vacío sin tabla o con error. */
export async function inscritosDe(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin.from(TABLA_INVIERTE).select("aviso_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
  if (error) return [];
  return (data ?? []).map((f) => f.aviso_id as string);
}

/** Lo que la portada del informe necesita para la franja: el depto (null si no va) y si ya está inscrito. */
export interface InvierteInforme {
  depto: DeptoInvierte;
  inscrito: boolean;
}

/**
 * ¿La portada de este informe lleva «Invierte con Franco»? Solo si salió de un aviso usado o nuevo de inmobiliaria y da ✓ Comprar, o − Ajustar con la
 * negociación de la noche. Con el veredicto DEL INFORME (lo que la persona está leyendo). Nunca lanza: sin datos, sin franja.
 */
export async function invierteDelInforme(admin: SupabaseClient, p: { inputData: unknown; analysisId: string; veredicto: string; score: number | null; userId: string | null }): Promise<InvierteInforme | null> {
  try {
    const avisoId = avisoDelInforme(p.inputData);
    if (!avisoId) return null;
    const aviso = await leerAviso(admin, avisoId);
    if (!aviso || !puedeInvertir({ condicion: aviso.condicion, veredicto: p.veredicto, negociable: aviso.negociable })) return null;
    const input = (p.inputData ?? {}) as Record<string, unknown>;
    const precioInput = Number(input.precio);
    const precioUF = aviso.precioUF ?? (Number.isFinite(precioInput) && precioInput > 0 ? precioInput : null);
    if (precioUF == null) return null;
    let inscrito = false;
    if (p.userId) {
      const { data } = await admin.from(TABLA_INVIERTE).select("id").eq("user_id", p.userId).eq("aviso_id", avisoId).maybeSingle();
      inscrito = !!data;
    }
    return { depto: { avisoId, linea: aviso.linea, precioUF, veredicto: p.veredicto, score: p.score, analysisId: p.analysisId }, inscrito };
  } catch {
    return null;
  }
}

// ── EL PANEL (/admin/invierte) ───────────────────────────────────────────────
export interface FilaPanelInvierte {
  id: string;
  userId: string;
  persona: string;
  avisoId: string;
  analysisId: string | null;
  linea: string | null;
  /** Nuevo de inmobiliaria o usado (12-nov-2026), de la línea guardada. */
  condicion: "nuevo" | "usado" | null;
  precioUF: number | null;
  veredicto: string | null;
  score: number | null;
  urgencia: string;
  pie: string;
  pieUF: number | null;
  whatsapp: string;
  origen: string;
  campana: string;
  estado: string;
  correo: boolean;
  creadaAt: string;
  actualizadaAt: string;
}

/** Las inscripciones, la más nueva primero (hasta mil, paginado de a mil por PostgREST). `noTest`: filtroNoTest o null. Sin
 *  tabla (la migración sin aplicar) devuelve `{ filas: [], sinTabla: true }`. */
export async function leerInscripciones(sb: SupabaseClient, noTest: string | null): Promise<{ filas: FilaPanelInvierte[]; sinTabla: boolean }> {
  let q = sb.from(TABLA_INVIERTE).select("id, user_id, aviso_id, analysis_id, linea, precio_uf, veredicto, score, urgencia, pie, pie_uf, whatsapp, origen, campana, estado, correo_enviado_at, created_at, updated_at").order("created_at", { ascending: false }).range(0, 999);
  if (noTest) q = q.or(noTest);
  const { data, error } = await q;
  if (error) return { filas: [], sinTabla: ["PGRST205", "42P01"].includes(error.code ?? "") };
  const ids = Array.from(new Set((data ?? []).map((f) => f.user_id as string)));
  const correos = new Map<string, string>();
  await Promise.all(ids.slice(0, 200).map(async (id) => {
    const { data: u } = await sb.auth.admin.getUserById(id).catch(() => ({ data: null }));
    if (u?.user?.email) correos.set(id, u.user.email);
  }));
  return {
    sinTabla: false,
    filas: (data ?? []).map((f) => ({
      id: f.id as string,
      userId: f.user_id as string,
      persona: correos.get(f.user_id as string) ?? (f.user_id as string),
      avisoId: f.aviso_id as string,
      analysisId: (f.analysis_id as string | null) ?? null,
      linea: (f.linea as string | null) ?? null,
      condicion: condicionDeLinea(f.linea as string | null),
      precioUF: f.precio_uf != null ? Number(f.precio_uf) : null,
      veredicto: (f.veredicto as string | null) ?? null,
      score: f.score != null ? Number(f.score) : null,
      urgencia: f.urgencia as string,
      pie: f.pie as string,
      pieUF: f.pie_uf != null ? Number(f.pie_uf) : null,
      whatsapp: f.whatsapp as string,
      origen: f.origen as string,
      campana: textoCampana(f.campana as Record<string, unknown> | null),
      estado: f.estado as string,
      correo: !!f.correo_enviado_at,
      creadaAt: f.created_at as string,
      actualizadaAt: f.updated_at as string,
    })),
  };
}
