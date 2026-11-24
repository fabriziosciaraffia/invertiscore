// ─────────────────────────────────────────────────────────────────────────────
// B4 · PRESENTAR Y RESPONDER, EN EL SERVIDOR (etapa 3, 23-nov-2026; decisiones de Fabrizio en el LEEME y en su respuesta a la FASE 0).
// Todo paso de la oferta lo hace una persona: la persona de Franco presenta, registra la respuesta (también fuera de plazo), corrige lo
// que sugiere Franco y marca una aceptación como comunicada; la persona responde la contraoferta, reactiva una respuesta fuera de plazo,
// retira su oferta o dice «No, gracias». La sugerencia de Franco es un cálculo que se muestra (b4.ts), no una acción. La noche vence lo
// que pasó su plazo, deja la tarea de insistir al tercer día, pasa la siguiente en cola a «por presentar» y avisa si el precio publicado
// bajó de la oferta. Los avisos a la persona: correo (solo a la lista mientras el modo sea «lista») y, cuando le toca actuar, una tarea
// del admin para escribirle por WhatsApp con el enlace wa.me.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLS_OFERTA, leerConfigRango, ofertaDeFila, proximaRonda, textoDeFirma, type OfertaVista } from "./rango-servidor";
import { OFERTAS_VIVAS, REGLA_SUGERENCIA, esRetirable, sePuedeRetirar, insistirDesde, lineaVence, medianocheChile, sugerenciaFranco, sugerenciaValida, venceAlTerminar } from "./b4";
import { WHATSAPP_OFERTA, type EventoOferta } from "./b4-correo";
import { avisoOferta, topeOferta } from "./rango";
import { anotar, sha256, ultimaOrdenDe, type ContextoPedido } from "./servidor";
import { leerPaginaDepto } from "./depto-pagina-servidor";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import { puedeOfertar } from "./preaprobacion";
import { VERSION_TEXTO_OFERTA, VERSION_TEXTO_OFERTA_EN_FIRME } from "./oferta-documento";
import { lineaDepto, urlWhatsapp } from "./base";
import type { DatosDepto } from "./base-servidor";
import { captureApiWarning } from "@/lib/observabilidad";
import { conArreglo, fechaVisitaLarga, naceEnFirme, type VisitaResumen } from "./visita";
import { visitaParaRonda } from "./visita-lectura";
export { visitaParaRonda };

const T_OF = "inv_ofertas";
const iso0 = (d: Date) => d.toISOString();
const COLS_FILA = `${COLS_OFERTA}, user_id, depto_id, aviso_id, es_prueba, postura, rango_fuente, aviso_nivel, insistir_tarea_at, sugerida_visita_id, sujeta_a_visita`;
type Fila = Record<string, unknown>;
const n = (x: unknown) => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);

// ── LOS AVISOS A LA PERSONA ──────────────────────────────────────────────────
export interface DepsAviso {
  /** Manda el correo y dice si salió y, si no, por qué (24-nov-2026: un correo que no sale queda registrado y el admin lo ve). */
  correo: (p: { to: string; userId: string; ofertaId: string; nombre: string | null; evento: EventoOferta; avisoId: string; depto: string; montoUF: number; otroUF: number | null; vence: string | null }) => Promise<{ ok: boolean; motivo?: string | null }>;
  /** ¿Puede recibir el correo? Mientras el modo sea «lista», solo las cuentas de la lista (decisión de Fabrizio, punto 14). */
  puedeRecibir: (email: string) => Promise<boolean>;
}

/** El nombre corto del depto para los avisos: «Av. Grecia 1250 · Ñuñoa» o su programa. */
async function nombreDepto(admin: SupabaseClient, userId: string, avisoId: string): Promise<string> {
  const [{ data: u }, { data: d }] = await Promise.all([
    admin.from("inv_ubicaciones").select("direccion, numero").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("inv_deptos").select("datos").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const datos = (d?.datos ?? {}) as DatosDepto;
  const calle = u?.direccion ? [u.direccion, u.numero].filter(Boolean).join(" ") : null;
  return [calle, datos.comuna].filter(Boolean).join(" · ") || lineaDepto(datos) || "tu depto";
}

/** UN AVISO: el correo (si la persona puede recibirlo) y, si le toca actuar, la tarea para escribirle por WhatsApp. Nunca rompe el paso. */
export async function avisarPersona(admin: SupabaseClient, deps: DepsAviso | null, f: Fila, evento: EventoOferta, x: { otroUF?: number | null; venceAt?: Date | null } = {}): Promise<{ correo: boolean; whatsapp: boolean }> {
  const userId = f.user_id as string, avisoId = f.aviso_id as string, montoUF = Number(f.monto_uf);
  const depto = await nombreDepto(admin, userId, avisoId);
  const vence = x.venceAt ? lineaVence(x.venceAt).vence : null;
  let correo = false, whatsapp = false;
  // Por qué no salió, si no salió (queda en la bitácora y el admin lo ve en el panel de la oferta).
  let motivo: string | null = null;
  try {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email ?? null;
    if (!deps) motivo = "sin-envio";
    else if (!email) motivo = "sin-correo";
    else if (!(await deps.puedeRecibir(email))) motivo = "fuera-de-la-lista";
    else {
      const orden = await ultimaOrdenDe(admin, userId);
      const r = await deps.correo({ to: email, userId, ofertaId: f.id as string, nombre: orden?.nombre ?? null, evento, avisoId, depto, montoUF, otroUF: x.otroUF ?? null, vence });
      correo = r.ok;
      motivo = r.ok ? null : r.motivo ?? "error";
    }
  } catch (e) { motivo = `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200); }
  if (deps) {
    await anotar(admin, { userId, email: null, actor: "sistema", accion: "aviso_oferta", detalle: { oferta_id: f.id, evento, correo: correo ? "enviado" : "no_salio", motivo }, esPrueba: f.es_prueba === true });
    // Un correo que falla de verdad (sin la llave de Resend o un error al enviar) queda también en Sentry.
    if (!correo && motivo && (motivo === "sin-llave" || motivo.startsWith("error"))) {
      captureApiWarning(new Error(`aviso de oferta no salió: ${motivo}`), { ruta: "B4 · avisos", operacion: `correo-${evento}`, tags: { evento }, extra: { ofertaId: f.id, motivo } });
    }
  }
  const texto = WHATSAPP_OFERTA[evento]?.({ depto, montoUF, otroUF: x.otroUF ?? null, vence });
  if (texto) {
    // Mientras el modo sea «lista», el WhatsApp es solo una tarea del admin con el enlace (sin número o sin permiso, sin enlace).
    const { data: p } = await admin.from("inv_personas").select("whatsapp, permiso_whatsapp_at").eq("user_id", userId).maybeSingle();
    const url = p?.whatsapp && p.permiso_whatsapp_at ? urlWhatsapp(p.whatsapp as string, texto) : null;
    const detalle = { evento, oferta_id: f.id, texto, url };
    const ins = await admin.from("inv_tareas").insert({ user_id: userId, tipo: "enviar_whatsapp", aviso_id: avisoId, estado: "pendiente", detalle, es_prueba: f.es_prueba === true });
    if (ins.error?.code === "23505") await admin.from("inv_tareas").update({ detalle }).eq("user_id", userId).eq("tipo", "enviar_whatsapp").eq("aviso_id", avisoId).eq("estado", "pendiente");
    whatsapp = !ins.error || ins.error.code === "23505";
  }
  return { correo, whatsapp };
}

/** La visita abierta del depto se cancela cuando la oferta se cierra (retirada, no aceptada o vencida). Va aquí y no en visita-servidor
 *  para que B4 no dependa de él (visita-servidor importa este archivo). */
export async function cancelarVisitaDeOferta(admin: SupabaseClient, deptoId: string, motivo: "persona" | "oferta_cerrada"): Promise<void> {
  await admin.from("inv_visitas").update({ estado: "cancelada", cancelada_motivo: motivo, updated_at: new Date().toISOString() }).eq("depto_id", deptoId).in("estado", ["pedida", "agendada", "visitada"]);
}

/** Cierra las tareas pendientes de esos tipos para el depto de la persona. */
export async function cerrarTareas(admin: SupabaseClient, userId: string, avisoId: string, tipos: string[], quien: string | null): Promise<void> {
  await admin.from("inv_tareas").update({ estado: "hecha", hecha_por: quien ?? "sistema", hecha_at: new Date().toISOString() }).eq("user_id", userId).eq("aviso_id", avisoId).eq("estado", "pendiente").in("tipo", tipos);
}

async function fila(admin: SupabaseClient, ofertaId: string): Promise<Fila | null> {
  const { data } = await admin.from(T_OF).select(COLS_FILA).eq("id", ofertaId).maybeSingle();
  return (data as Fila | null) ?? null;
}

/** LA COLA: si la persona ya no tiene una oferta viva que no sea en cola, la más antigua en cola pasa a «por presentar» (firmada) con
 *  su tarea para Franco (decisión 9). Devuelve la que pasó, si alguna. */
export async function promoverCola(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: vivas } = await admin.from(T_OF).select("id").eq("user_id", userId).in("estado", ["firmada", "presentada", "contraoferta", "aceptada_sujeta"]).limit(1);
  if ((vivas ?? []).length) return null;
  const { data: c } = await admin.from(T_OF).select("id, aviso_id, monto_uf, es_prueba").eq("user_id", userId).eq("estado", "en_cola").order("firmada_at", { ascending: true }).limit(1).maybeSingle();
  if (!c) return null;
  const { error } = await admin.from(T_OF).update({ estado: "firmada", updated_at: new Date().toISOString() }).eq("id", c.id).eq("estado", "en_cola");
  if (error) return null;
  await admin.from("inv_tareas").insert({ user_id: userId, tipo: "presentar_oferta", aviso_id: c.aviso_id, estado: "pendiente", detalle: { oferta_id: c.id, monto_uf: n(c.monto_uf), desde: "cola" }, es_prueba: c.es_prueba === true });
  return c.id as string;
}

// ── EL ADMIN ─────────────────────────────────────────────────────────────────
type Quien = { id: string; email: string | null };
export type ErrorB4 = "oferta" | "estado" | "monto" | "fecha" | "guardar" | "vencida" | "otra_viva" | "otra_firme" | "depto" | "etapa" | "preaprobacion" | "orden" | "casilla";

/** PRESENTAR (decisión 2): la persona de Franco entregó a quien vende el PDF de la oferta firmada y marca la fecha. Vence al terminar el
 *  día de hoy más 5 (en Santiago). Cierra la tarea y le avisa a la persona por correo. */
export async function presentarOferta(admin: SupabaseClient, quien: Quien, ofertaId: string, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true; venceAt: string } | { ok: false; error: ErrorB4 }> {
  const f = await fila(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  const tipo = ofertaDeFila(f).tipoRonda;
  if (f.estado !== "firmada" || tipo === "aceptar" || tipo === "reactivar") return { ok: false, error: "estado" };
  const venceAt = venceAlTerminar(ahora);
  const { error } = await admin.from(T_OF).update({ estado: "presentada", presentada_at: ahora.toISOString(), presentada_por: quien.id, vigente_hasta: venceAt.toISOString(), updated_at: ahora.toISOString() }).eq("id", ofertaId).eq("estado", "firmada");
  if (error) { console.error("[inv2] presentar:", error.message); return { ok: false, error: "guardar" }; }
  await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["presentar_oferta"], quien.email);
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "oferta_presentada", detalle: { oferta_id: ofertaId, aviso_id: f.aviso_id, vence: venceAt.toISOString() }, esPrueba: f.es_prueba === true });
  await avisarPersona(admin, deps, f, "presentada", { venceAt });
  return { ok: true, venceAt: venceAt.toISOString() };
}

/** «2026-11-26» → al terminar ese día en Santiago. Sin fecha: 5 días corridos desde hoy (decisión 5). */
export function venceContraoferta(fecha: unknown, ahora: Date = new Date()): Date | null {
  if (fecha == null || fecha === "") return venceAlTerminar(ahora);
  const m = typeof fecha === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha) : null;
  if (!m) return null;
  const v = medianocheChile(Number(m[1]), Number(m[2]), Number(m[3]) + 1);
  return v.getTime() > ahora.getTime() ? v : null;
}

/** REGISTRAR LA RESPUESTA de quien vende: aceptada (sujeta a visita), contraoferta (monto, nota y vencimiento) o rechazada. Si llega
 *  después del vencimiento (decisión 8), la oferta no obliga: queda cargada como respuesta fuera de plazo y decide la persona. */
export async function registrarRespuesta(admin: SupabaseClient, quien: Quien, ofertaId: string, r: { tipo?: unknown; montoUF?: unknown; nota?: unknown; vence?: unknown }, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true; fueraDePlazo: boolean } | { ok: false; error: ErrorB4 }> {
  let f = await fila(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  const tipo = r.tipo === "aceptada" || r.tipo === "contraoferta" || r.tipo === "rechazada" ? r.tipo : null;
  if (!tipo) return { ok: false, error: "estado" };
  const monto = Number(f.monto_uf);
  const contra = tipo === "contraoferta" ? Math.round(Number(r.montoUF)) : null;
  if (tipo === "contraoferta" && !(contra && contra > monto)) return { ok: false, error: "monto" };
  const venceContra = tipo === "contraoferta" ? venceContraoferta(r.vence, ahora) : null;
  if (tipo === "contraoferta" && !venceContra) return { ok: false, error: "fecha" };
  const nota = typeof r.nota === "string" && r.nota.trim() ? r.nota.trim().slice(0, 500) : null;
  const s = (f.senales ?? {}) as { alto?: number; comprarUF?: number | null };
  const sugerida = contra ? sugerenciaFranco({ ofertaUF: monto, contraofertaUF: contra, altoUF: n(s.alto) ?? Number(f.techo_uf), comprarUF: n(s.comprarUF) }) : null;
  const iso = ahora.toISOString();
  // Presentada pero ya pasó su plazo (la noche todavía no la venció): se vence primero.
  if (f.estado === "presentada" && f.vigente_hasta && new Date(f.vigente_hasta as string).getTime() <= ahora.getTime()) {
    await vencerUna(admin, f, null, ahora);
    f = (await fila(admin, ofertaId)) ?? f;
  }
  const tardia = f.estado === "sin_acuerdo" && f.sin_acuerdo_motivo === "vencida" && !f.respuesta_tardia;
  if (f.estado === "presentada") {
    const base = { respuesta: tipo === "aceptada" ? "aceptada_sujeta" : tipo, respuesta_at: iso, respuesta_por: quien.id, updated_at: iso };
    // Después de la visita, toda oferta es en firme (24-nov-2026): si nació en firme y la aceptan, queda en firme sin otro paso de la persona.
    const enFirme = f.sujeta_a_visita === false;
    const cambio = tipo === "aceptada" && enFirme ? { ...base, estado: "en_firme", en_firme_at: iso, en_firme_como: "tras_visita", precio_final_uf: monto }
      : tipo === "aceptada" ? { ...base, estado: "aceptada_sujeta" }
      : tipo === "contraoferta" ? { ...base, estado: "contraoferta", contraoferta_uf: contra, contraoferta_nota: nota, contraoferta_vence: venceContra!.toISOString(), sugerida_uf: sugerida!.montoUF, sugerida_regla_uf: sugerida!.montoUF, sugerida_fuente: "regla", sugerida_regla_version: REGLA_SUGERENCIA }
      : { ...base, estado: "sin_acuerdo", sin_acuerdo_motivo: "rechazada" };
    const { error } = await admin.from(T_OF).update(cambio).eq("id", ofertaId).eq("estado", "presentada");
    if (error) { console.error("[inv2] respuesta:", error.message); return { ok: false, error: "guardar" }; }
    await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["insistir_oferta", "registrar_respuesta"], quien.email);
    await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "oferta_respuesta", detalle: { oferta_id: ofertaId, tipo, contraoferta_uf: contra, nota, vence: venceContra?.toISOString() ?? null, sugerida: sugerida?.montoUF ?? null }, esPrueba: f.es_prueba === true });
    if (tipo === "aceptada" && enFirme) await admin.from("inv_deptos").update({ etapa: "en_firme", updated_at: iso }).eq("id", f.depto_id as string);
    await avisarPersona(admin, deps, f, tipo === "aceptada" ? (enFirme ? "aceptada_en_firme" : "aceptada") : tipo, { otroUF: contra, venceAt: venceContra });
    if (tipo === "rechazada") await promoverCola(admin, f.user_id as string);
    return { ok: true, fueraDePlazo: false };
  }
  if (tardia) {
    // Una negativa fuera de plazo no cambia nada: la oferta ya venció.
    if (tipo === "rechazada") return { ok: true, fueraDePlazo: true };
    const cambio = tipo === "aceptada"
      ? { respuesta_tardia: "aceptada_sujeta", respuesta_tardia_uf: monto, respuesta_tardia_at: iso, respuesta_tardia_por: quien.id, updated_at: iso }
      : { respuesta_tardia: "contraoferta", respuesta_tardia_uf: contra, respuesta_tardia_at: iso, respuesta_tardia_por: quien.id, contraoferta_uf: contra, contraoferta_nota: nota, contraoferta_vence: venceContra!.toISOString(), sugerida_uf: sugerida!.montoUF, sugerida_regla_uf: sugerida!.montoUF, sugerida_fuente: "regla", sugerida_regla_version: REGLA_SUGERENCIA, updated_at: iso };
    const { error } = await admin.from(T_OF).update(cambio).eq("id", ofertaId).eq("estado", "sin_acuerdo").is("respuesta_tardia", null);
    if (error) { console.error("[inv2] respuesta tardía:", error.message); return { ok: false, error: "guardar" }; }
    await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "oferta_respuesta_tardia", detalle: { oferta_id: ofertaId, tipo, contraoferta_uf: contra, vence: venceContra?.toISOString() ?? null }, esPrueba: f.es_prueba === true });
    await avisarPersona(admin, deps, f, tipo === "aceptada" ? "tardia_aceptada" : "tardia_contraoferta", { otroUF: contra, venceAt: venceContra });
    return { ok: true, fueraDePlazo: true };
  }
  return { ok: false, error: "estado" };
}

/** CORREGIR LO QUE SUGIERE FRANCO (decisión 3): entre la oferta de la persona y lo que piden. Queda quién y cuándo. */
export async function corregirSugerencia(admin: SupabaseClient, quien: Quien, ofertaId: string, montoUF: unknown): Promise<{ ok: true } | { ok: false; error: ErrorB4 }> {
  const f = await fila(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  const abierta = f.estado === "contraoferta" || (f.estado === "sin_acuerdo" && f.respuesta_tardia === "contraoferta" && !f.tardia_decision);
  if (!abierta) return { ok: false, error: "estado" };
  const m = Math.round(Number(montoUF));
  const v = f.estado === "contraoferta" ? await visitaParaRonda(admin, f.depto_id as string) : null;
  const bajarHasta = conArreglo(v) ? v!.pisoUF : null;
  if (!sugerenciaValida(m, Number(f.monto_uf), Number(f.contraoferta_uf), bajarHasta)) return { ok: false, error: "monto" };
  const iso = new Date().toISOString();
  const { error } = await admin.from(T_OF).update({ sugerida_uf: m, sugerida_fuente: "admin", sugerida_por: quien.id, sugerida_at: iso, sugerida_visita_id: m < Number(f.monto_uf) && v ? v.id : (f.sugerida_visita_id ?? null), updated_at: iso }).eq("id", ofertaId);
  if (error) return { ok: false, error: "guardar" };
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "oferta_sugerencia_corregida", detalle: { oferta_id: ofertaId, regla: n(f.sugerida_regla_uf), ahora: m }, esPrueba: f.es_prueba === true });
  return { ok: true };
}

/** MARCAR COMUNICADA una aceptación (punto 9 de Fabrizio): la persona firmó el precio de quien vende y la persona de Franco ya se lo
 *  comunicó. La ronda queda aceptada sujeta a visita, sin otro plazo de 5 días. */
export async function marcarComunicada(admin: SupabaseClient, quien: Quien, ofertaId: string): Promise<{ ok: true } | { ok: false; error: ErrorB4 }> {
  const f = await fila(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  const tipo = ofertaDeFila(f).tipoRonda;
  if (f.estado !== "firmada" || (tipo !== "aceptar" && tipo !== "reactivar")) return { ok: false, error: "estado" };
  const iso = new Date().toISOString();
  const enFirme = f.sujeta_a_visita === false;
  const { error } = await admin.from(T_OF).update({ estado: enFirme ? "en_firme" : "aceptada_sujeta", presentada_at: iso, presentada_por: quien.id, respuesta: "aceptada_sujeta", respuesta_at: iso, respuesta_por: quien.id, updated_at: iso,
    ...(enFirme ? { en_firme_at: iso, en_firme_como: "tras_visita", precio_final_uf: n(f.monto_uf) } : {}) }).eq("id", ofertaId).eq("estado", "firmada");
  if (error) { console.error("[inv2] comunicada:", error.message); return { ok: false, error: "guardar" }; }
  if (enFirme) await admin.from("inv_deptos").update({ etapa: "en_firme", updated_at: iso }).eq("id", f.depto_id as string);
  await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["comunicar_aceptacion"], quien.email);
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "admin", actorEmail: quien.email, accion: "oferta_aceptacion_comunicada", detalle: { oferta_id: ofertaId, monto_uf: n(f.monto_uf) }, esPrueba: f.es_prueba === true });
  return { ok: true };
}

// ── LA PERSONA ───────────────────────────────────────────────────────────────
async function deptoDe(admin: SupabaseClient, userId: string, avisoId: string): Promise<{ id: string; es_prueba: boolean } | null> {
  const { data } = await admin.from("inv_deptos").select("id, es_prueba").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  return data ? { id: data.id as string, es_prueba: data.es_prueba === true } : null;
}

/** RETIRARLA (decisión 9 y punto 12): mientras esté firmada, en cola, presentada, en contraoferta («No aceptar la contraoferta») o
 *  aceptada con la visita pendiente; nunca desde en firme. Si quien vende ya la conocía, Franco le avisa (tarea). La siguiente en cola
 *  pasa a «por presentar». */
export async function retirarOferta(admin: SupabaseClient, user: Quien, avisoId: string, ctx: ContextoPedido | null, ahora: Date = new Date()): Promise<{ ok: true; desde: string } | { ok: false; error: ErrorB4 }> {
  const d = await deptoDe(admin, user.id, avisoId);
  if (!d) return { ok: false, error: "depto" };
  const { data } = await admin.from(T_OF).select(COLS_FILA).eq("depto_id", d.id).eq("user_id", user.id).in("estado", ["firmada", "en_cola", "presentada", "contraoferta", "aceptada_sujeta", "en_firme"]).order("ronda", { ascending: false }).limit(1).maybeSingle();
  const f = data as Fila | null;
  if (!f) return { ok: false, error: "oferta" };
  const desde = f.estado as string;
  if (!esRetirable(desde)) return { ok: false, error: "estado" };
  // Una oferta a firme no se retira mientras esté vigente (24-nov-2026, Fabrizio): firmada o presentada, vence sola a los 5 días.
  if (!sePuedeRetirar({ estado: desde, sujetaAVisita: f.sujeta_a_visita !== false })) return { ok: false, error: "estado" };
  const iso = ahora.toISOString();
  const { error } = await admin.from(T_OF).update({ estado: "retirada", retirada_at: iso, retirada_desde: desde, updated_at: iso }).eq("id", f.id).eq("estado", desde);
  if (error) { console.error("[inv2] retirar:", error.message); return { ok: false, error: "guardar" }; }
  await cerrarTareas(admin, user.id, avisoId, ["presentar_oferta", "comunicar_aceptacion", "insistir_oferta", "agendar_visita", "hacer_visita", "publicar_reporte", "pedir_mantener_contraoferta"], "sistema");
  await cancelarVisitaDeOferta(admin, d.id, "persona");
  // Quien vende la conocía si ya se presentó, si respondió, o si es una ronda de una conversación en curso.
  const laConocia = desde === "presentada" || desde === "contraoferta" || desde === "aceptada_sujeta" || (desde === "firmada" && !!f.anterior_id);
  if (laConocia) await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "avisar_retiro", aviso_id: avisoId, estado: "pendiente", detalle: { oferta_id: f.id, desde, monto_uf: n(f.monto_uf) }, es_prueba: f.es_prueba === true });
  await anotar(admin, { userId: user.id, email: user.email, actor: "persona", accion: desde === "contraoferta" ? "contraoferta_no_aceptada" : "oferta_retirada", detalle: { oferta_id: f.id, aviso_id: avisoId, desde }, ctx, esPrueba: f.es_prueba === true });
  await promoverCola(admin, user.id);
  return { ok: true, desde };
}

/** «No, gracias» a una respuesta fuera de plazo: queda anotado y Franco le avisa a quien vende. */
export async function noGracias(admin: SupabaseClient, user: Quien, avisoId: string, ctx: ContextoPedido | null): Promise<{ ok: true } | { ok: false; error: ErrorB4 }> {
  const d = await deptoDe(admin, user.id, avisoId);
  if (!d) return { ok: false, error: "depto" };
  const { data } = await admin.from(T_OF).select(COLS_FILA).eq("depto_id", d.id).eq("estado", "sin_acuerdo").eq("sin_acuerdo_motivo", "vencida").not("respuesta_tardia", "is", null).is("tardia_decision", null).order("ronda", { ascending: false }).limit(1).maybeSingle();
  const f = data as Fila | null;
  if (!f) return { ok: false, error: "oferta" };
  const iso = new Date().toISOString();
  const { error } = await admin.from(T_OF).update({ tardia_decision: "no_gracias", tardia_decision_at: iso, updated_at: iso }).eq("id", f.id).is("tardia_decision", null);
  if (error) return { ok: false, error: "guardar" };
  await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "avisar_retiro", aviso_id: avisoId, estado: "pendiente", detalle: { oferta_id: f.id, desde: "fuera_de_plazo" }, es_prueba: f.es_prueba === true });
  await anotar(admin, { userId: user.id, email: user.email, actor: "persona", accion: "respuesta_tardia_no_gracias", detalle: { oferta_id: f.id, aviso_id: avisoId }, ctx, esPrueba: f.es_prueba === true });
  return { ok: true };
}

/** De dónde sale una ronda nueva y qué montos admite. null si esa oferta no admite una ronda (o ya venció lo que se responde). */
export function rondaDesde(o: Pick<OfertaVista, "estado" | "montoUF" | "contraofertaUF" | "contraofertaVence" | "sinAcuerdoMotivo" | "respuestaTardia" | "respuestaTardiaUF" | "tardiaDecision"> & { visita?: VisitaResumen | null }, ahora: Date = new Date()):
  { tipo: "contra" | "tardia_aceptada" | "tardia_contra" | "volver" | "ajustar"; minUF: number; maxUF: number; aceptaUF: number | null } | null {
  const monto = o.montoUF ?? 0;
  const viva = (vence: string | null | undefined) => !vence || new Date(vence).getTime() > ahora.getTime();
  // La visita antes del precio (24-nov-2026): ofrecer menos que la oferta anterior se permite en un solo caso, después de la visita y
  // solo si el reporte nombra un arreglo concreto; entonces el piso es el del rango recalculado. Sin eso, nunca se baja de lo ofrecido.
  const piso = conArreglo(o.visita) && o.visita!.pisoUF != null ? Math.min(monto, o.visita!.pisoUF) : monto;
  if (o.estado === "contraoferta" && o.contraofertaUF && viva(o.contraofertaVence)) return { tipo: "contra", minUF: piso, maxUF: o.contraofertaUF, aceptaUF: o.contraofertaUF };
  // Aceptada y visitada con un arreglo: «Ajustar el precio con lo que viste» (una ronda nueva, bajo lo aceptado). Si coincide, no hay ajuste.
  if (o.estado === "aceptada_sujeta" && conArreglo(o.visita) && piso < monto) return { tipo: "ajustar", minUF: piso, maxUF: monto - 1, aceptaUF: null };
  if (o.estado === "sin_acuerdo" && o.sinAcuerdoMotivo === "vencida") {
    if (o.respuestaTardia === "aceptada_sujeta" && !o.tardiaDecision) { const m = o.respuestaTardiaUF ?? monto; return { tipo: "tardia_aceptada", minUF: m, maxUF: m, aceptaUF: m }; }
    if (o.respuestaTardia === "contraoferta" && !o.tardiaDecision && o.contraofertaUF && viva(o.contraofertaVence)) return { tipo: "tardia_contra", minUF: monto, maxUF: o.contraofertaUF, aceptaUF: o.contraofertaUF };
    if (!o.respuestaTardia) return { tipo: "volver", minUF: monto, maxUF: monto, aceptaUF: null };
  }
  return null;
}

/** FIRMAR UNA RONDA NUEVA (decisiones 4, 8 y puntos 9 a 11 de Fabrizio): aceptar el precio de quien vende o proponer otro monto (desde
 *  una contraoferta, también la que llegó fuera de plazo), reactivar una aceptación fuera de plazo, o volver a presentar una oferta que
 *  venció. Todo pasa por «Revisa y firma». Aceptar crea la tarea «comunicar_aceptacion» (sin otro plazo); proponer o volver a presentar,
 *  la de presentar. Una a la vez: si la persona tiene otra oferta viva, para aceptar o reactivar primero elige con cuál se queda
 *  (`retirarOtra`); un monto nuevo con otra viva queda en cola. */
export async function firmarRonda(admin: SupabaseClient, user: Quien, avisoId: string, pedido: { desdeId?: unknown; montoUF?: unknown; acepto?: unknown; leyo?: unknown; retirarOtra?: unknown; aceptoFirme?: unknown }, ctx: ContextoPedido | null, ahora: Date = new Date()): Promise<{ ok: true; estado: string; tipo: string } | { ok: false; error: ErrorB4; venceAt?: string | null }> {
  if (pedido.acepto !== true) return { ok: false, error: "casilla" };
  const monto = Math.round(Number(pedido.montoUF));
  const p = await leerPaginaDepto(admin, user.id, avisoId);
  if (!p) return { ok: false, error: "depto" };
  if (p.etapa !== "listo") return { ok: false, error: "etapa" };
  if (!puedeOfertar(p.preaprobacion)) return { ok: false, error: "preaprobacion" };
  const d = await deptoDe(admin, user.id, avisoId);
  const desde = typeof pedido.desdeId === "string" ? await fila(admin, pedido.desdeId) : null;
  if (!d || !desde || desde.depto_id !== d.id || desde.user_id !== user.id) return { ok: false, error: "oferta" };
  const vista = { ...ofertaDeFila(desde), visita: await visitaParaRonda(admin, d.id) };
  const r = rondaDesde(vista, ahora);
  if (!r) return { ok: false, error: desde.estado === "contraoferta" || desde.respuesta_tardia ? "vencida" : "estado" };
  if (!(monto >= r.minUF && monto <= r.maxUF) || monto > topeOferta(vista.publicadoUF)) return { ok: false, error: "monto" };
  const acepta = r.aceptaUF != null && monto === r.aceptaUF;
  const tipo = r.tipo === "volver" ? "volver" : r.tipo === "ajustar" ? "ajustar" : acepta ? (r.tipo === "contra" ? "aceptar" : "reactivar") : "proponer";
  const [orden, pre, { data: otras }] = await Promise.all([
    ultimaOrdenDe(admin, user.id), leerPreaprobacion(admin, user.id),
    admin.from(T_OF).select("id, aviso_id, estado, sujeta_a_visita, vigente_hasta").eq("user_id", user.id).neq("depto_id", d.id).in("estado", OFERTAS_VIVAS as unknown as string[]),
  ]);
  if (!orden) return { ok: false, error: "orden" };
  const otrasVivas = (otras ?? []) as { id: string; aviso_id: string; estado: string; sujeta_a_visita: boolean | null; vigente_hasta: string | null }[];
  // Aceptar o reactivar con otra oferta viva: primero elige con cuál se queda (sigue valiendo una a la vez).
  if ((tipo === "aceptar" || tipo === "reactivar") && otrasVivas.length) {
    if (pedido.retirarOtra !== true) return { ok: false, error: "otra_viva" };
    // Una oferta a firme vigente en otro depto no se retira (24-nov-2026): aceptar aquí se rechaza antes de tocar nada, en vez de dejar
    // dos ofertas vivas porque el retiro de la otra falló.
    const firme = otrasVivas.find((o) => !sePuedeRetirar({ estado: o.estado, sujetaAVisita: o.sujeta_a_visita !== false }));
    if (firme) return { ok: false, error: "otra_firme", venceAt: firme.vigente_hasta };
    for (const o of otrasVivas) await retirarOferta(admin, user, o.aviso_id, ctx, ahora);
  }
  const quedaEnCola = (tipo === "proponer" || tipo === "volver" || tipo === "ajustar") && otrasVivas.length > 0 && pedido.retirarOtra !== true;
  // Después de la visita, toda oferta es en firme (24-nov-2026): cualquier ronda firmada con el reporte de la visita publicado. Exige la
  // segunda casilla; si el monto baja de la oferta anterior, el documento lleva el reporte como respaldo.
  const enFirme = naceEnFirme(vista.visita) ? vista.visita! : null;
  if (enFirme && pedido.aceptoFirme !== true) return { ok: false, error: "casilla" };
  const respaldo = enFirme && monto < Number(desde.monto_uf) ? enFirme.reporteLinea : null;
  const texto = textoDeFirma({ orden, pre, tituloConNumero: p.tituloConNumero, datos: p.datos, montoUF: monto, publicadoUF: vista.publicadoUF, enFirme: enFirme ? { visitaFecha: fechaVisitaLarga(enFirme.visitadaAt ?? iso0(ahora)), respaldo } : null });
  const cfg = await leerConfigRango(admin);
  const aviso = avisoOferta(monto, { pisoUF: vista.pisoUF, altoUF: vista.altoUF, comprarUF: vista.comprarUF }, vista.publicadoUF, cfg);
  const iso = ahora.toISOString();
  const estado = quedaEnCola ? "en_cola" : "firmada";
  // La contraoferta deja de estar abierta (la reemplaza la ronda nueva); una vencida queda como está, con la decisión anotada.
  // El ajuste después de la visita reemplaza a la aceptada (sigue valiendo una a la vez).
  if (desde.estado === "contraoferta" || (tipo === "ajustar" && desde.estado === "aceptada_sujeta")) {
    const { error } = await admin.from(T_OF).update({ estado: "reemplazada", updated_at: iso }).eq("id", desde.id).eq("estado", desde.estado as string);
    if (error) return { ok: false, error: "guardar" };
  }
  const nueva = {
    user_id: user.id, depto_id: d.id, aviso_id: avisoId, ronda: await proximaRonda(admin, d.id), anterior_id: desde.id, estado, es_prueba: d.es_prueba,
    postura_recomendada: desde.postura_recomendada, postura: desde.postura ?? desde.postura_recomendada, publicado_uf: desde.publicado_uf, piso_uf: desde.piso_uf, recomendado_uf: desde.recomendado_uf, techo_uf: desde.techo_uf,
    rango_fuente: desde.rango_fuente ?? "regla", regla_version: desde.regla_version, razones: desde.razones,
    senales: { ...((desde.senales ?? {}) as Record<string, unknown>), b4: { tipo, desde: desde.id } },
    monto_uf: monto, aviso_nivel: aviso, insistio_at: aviso === "ninguno" ? null : iso, sujeta_a_visita: !enFirme, vigencia_dias: 5,
    ...(enFirme ? { en_firme_confirmo: true, en_firme_ip: ctx?.ip ?? null, en_firme_user_agent: ctx?.ua ? ctx.ua.slice(0, 500) : null } : {}),
    // La visita que respalda la ronda: el reporte va como respaldo, y la base exige un arreglo si el monto baja de la anterior.
    visita_id: vista.visita && vista.visita.estado === "reporte_publicado" ? vista.visita.id : null,
    nombre: orden.nombre, rut: orden.rut, texto_version: enFirme ? VERSION_TEXTO_OFERTA_EN_FIRME : VERSION_TEXTO_OFERTA, texto, texto_sha256: sha256(texto), acepto_casilla: true, leyo_hasta_el_final: pedido.leyo === true,
    firmada_at: iso, ip: ctx?.ip ?? null, user_agent: ctx?.ua ? ctx.ua.slice(0, 500) : null, updated_at: iso,
  };
  const { data: ins, error } = await admin.from(T_OF).insert(nueva).select("id").maybeSingle();
  if (error || !ins) {
    console.error("[inv2] firmar ronda:", error?.message);
    if (desde.estado === "contraoferta" || (tipo === "ajustar" && desde.estado === "aceptada_sujeta")) await admin.from(T_OF).update({ estado: desde.estado, updated_at: iso }).eq("id", desde.id).eq("estado", "reemplazada");
    return { ok: false, error: "guardar" };
  }
  if (desde.estado === "sin_acuerdo" && desde.respuesta_tardia) await admin.from(T_OF).update({ tardia_decision: "reactivar", tardia_decision_at: iso, updated_at: iso }).eq("id", desde.id).is("tardia_decision", null);
  if (tipo === "ajustar" && vista.visita) await admin.from("inv_visitas").update({ respuesta: "ajusto", respuesta_at: iso, updated_at: iso }).eq("id", vista.visita.id);
  if (estado === "firmada") await admin.from("inv_tareas").insert({ user_id: user.id, tipo: tipo === "aceptar" || tipo === "reactivar" ? "comunicar_aceptacion" : "presentar_oferta", aviso_id: avisoId, estado: "pendiente", detalle: { oferta_id: ins.id, monto_uf: monto, tipo }, es_prueba: d.es_prueba });
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "oferta_ronda_firmada", detalle: { aviso_id: avisoId, oferta_id: ins.id, desde: desde.id, monto_uf: monto, tipo, estado, texto_version: VERSION_TEXTO_OFERTA }, ctx, esPrueba: d.es_prueba });
  return { ok: true, estado, tipo };
}

// ── LA NOCHE ─────────────────────────────────────────────────────────────────
async function vencerUna(admin: SupabaseClient, f: Fila, deps: DepsAviso | null, ahora: Date): Promise<boolean> {
  const iso = ahora.toISOString();
  const deContra = f.estado === "contraoferta";
  const { error } = await admin.from(T_OF).update({ estado: "sin_acuerdo", sin_acuerdo_motivo: "vencida", updated_at: iso }).eq("id", f.id).eq("estado", f.estado as string);
  if (error) { console.error("[inv2] vencer:", error.message); return false; }
  await cerrarTareas(admin, f.user_id as string, f.aviso_id as string, ["insistir_oferta", "agendar_visita", "hacer_visita", "publicar_reporte", "pedir_mantener_contraoferta"], "sistema");
  await cancelarVisitaDeOferta(admin, f.depto_id as string, "oferta_cerrada");
  await anotar(admin, { userId: f.user_id as string, email: null, actor: "sistema", accion: deContra ? "contraoferta_vencida" : "oferta_vencida", detalle: { oferta_id: f.id, aviso_id: f.aviso_id }, esPrueba: f.es_prueba === true });
  if (deps) await avisarPersona(admin, deps, f, deContra ? "contra_vencida" : "vencida", { otroUF: n(f.contraoferta_uf) });
  await promoverCola(admin, f.user_id as string);
  return true;
}

/** EL PASE DE LA NOCHE de B4: vence lo que pasó su plazo (presentadas y contraofertas), cierra las respuestas fuera de plazo que nadie
 *  respondió a tiempo, deja la tarea de insistir al empezar el tercer día y avisa si el precio publicado bajó de la oferta viva. */
export async function noche(admin: SupabaseClient, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ vencidas: number; insistir: number; preciosBajos: number; tardiasCerradas: number }> {
  const iso = ahora.toISOString();
  let vencidas = 0, insistir = 0, preciosBajos = 0, tardiasCerradas = 0;
  const { data: pres } = await admin.from(T_OF).select(COLS_FILA).eq("estado", "presentada").lte("vigente_hasta", iso).limit(200);
  for (const f of (pres ?? []) as Fila[]) if (await vencerUna(admin, f, deps, ahora)) vencidas++;
  const { data: cons } = await admin.from(T_OF).select(COLS_FILA).eq("estado", "contraoferta").lte("contraoferta_vence", iso).limit(200);
  for (const f of (cons ?? []) as Fila[]) if (await vencerUna(admin, f, deps, ahora)) vencidas++;
  // La contraoferta que llegó fuera de plazo y nadie respondió antes de su vencimiento: queda como «no siguió».
  const { data: tar } = await admin.from(T_OF).select("id").eq("estado", "sin_acuerdo").eq("respuesta_tardia", "contraoferta").is("tardia_decision", null).lte("contraoferta_vence", iso).limit(200);
  for (const t of tar ?? []) { const { error } = await admin.from(T_OF).update({ tardia_decision: "no_gracias", tardia_decision_at: iso, updated_at: iso }).eq("id", t.id).is("tardia_decision", null); if (!error) tardiasCerradas++; }
  // Insistir al tercer día sin respuesta (decisión 1).
  const { data: sin } = await admin.from(T_OF).select("id, user_id, aviso_id, presentada_at, monto_uf, es_prueba").eq("estado", "presentada").is("insistir_tarea_at", null).limit(500);
  for (const f of (sin ?? []) as Fila[]) {
    if (!f.presentada_at || insistirDesde(new Date(f.presentada_at as string)).getTime() > ahora.getTime()) continue;
    const ins = await admin.from("inv_tareas").insert({ user_id: f.user_id, tipo: "insistir_oferta", aviso_id: f.aviso_id, estado: "pendiente", detalle: { oferta_id: f.id, monto_uf: n(f.monto_uf) }, es_prueba: f.es_prueba === true });
    if (!ins.error || ins.error.code === "23505") { await admin.from(T_OF).update({ insistir_tarea_at: iso }).eq("id", f.id); insistir++; }
  }
  // El precio publicado bajó de la oferta viva (decisión 11): tarea para Franco y aviso a la persona, una vez por precio.
  const { data: vivas } = await admin.from(T_OF).select(COLS_FILA).in("estado", OFERTAS_VIVAS as unknown as string[]).limit(500);
  const filas = (vivas ?? []) as Fila[];
  if (filas.length) {
    const { data: deptos } = await admin.from("inv_deptos").select("id, vigente, datos").in("id", Array.from(new Set(filas.map((f) => f.depto_id as string))));
    const precio = new Map(((deptos ?? []) as { id: string; vigente: { precioUF?: number } | null; datos: { precioUF?: number } | null }[]).map((x) => [x.id, n(x.vigente?.precioUF) ?? n(x.datos?.precioUF)]));
    for (const f of filas) {
      const p = precio.get(f.depto_id as string) ?? null;
      const s = (f.senales ?? {}) as Record<string, unknown>;
      if (p == null || !(p < Number(f.monto_uf)) || n(s.precioBajoAvisado) === p) continue;
      await admin.from(T_OF).update({ senales: { ...s, precioBajoAvisado: p } }).eq("id", f.id);
      await admin.from("inv_tareas").insert({ user_id: f.user_id, tipo: "precio_bajo_oferta", aviso_id: f.aviso_id, estado: "pendiente", detalle: { oferta_id: f.id, monto_uf: n(f.monto_uf), precio_uf: p }, es_prueba: f.es_prueba === true });
      await avisarPersona(admin, deps, f, "precio_bajo", { otroUF: p });
      preciosBajos++;
    }
  }
  return { vencidas, insistir, preciosBajos, tardiasCerradas };
}

/** ¿Se puede correr la pasada a mano? Solo fuera de producción (el cron de B4 corre en producción recién con el merge). */
export const pasadaManualPermitida = (vercelEnv: string | undefined = process.env.VERCEL_ENV) => vercelEnv !== "production";

/** LA PASADA DE LA NOCHE PARA UNA OFERTA, A MANO (24-nov-2026, para probar B4 en el preview antes del merge). Solo fuera de producción y
 *  solo sobre ofertas de prueba. `modo`: «pasada» corre lo que la noche haría hoy (vence si ya pasó su plazo; deja la tarea de insistir si
 *  ya es el tercer día); «vencer» adelanta el vencimiento a ahora y corre la pasada; «insistir» deja la tarea del día 3 aunque no toque. */
export async function pasadaDeUnaOferta(admin: SupabaseClient, deps: DepsAviso | null, ofertaId: string, modo: "pasada" | "vencer" | "insistir", ahora: Date = new Date(), vercelEnv: string | undefined = process.env.VERCEL_ENV): Promise<{ ok: true; hizo: string } | { ok: false; error: ErrorB4 | "produccion" | "no_es_prueba" }> {
  if (!pasadaManualPermitida(vercelEnv)) return { ok: false, error: "produccion" };
  let f = await fila(admin, ofertaId);
  if (!f) return { ok: false, error: "oferta" };
  if (f.es_prueba !== true) return { ok: false, error: "no_es_prueba" };
  const iso = ahora.toISOString();
  if (modo === "vencer") {
    const antes = new Date(ahora.getTime() - 1000).toISOString();
    if (f.estado === "presentada") await admin.from(T_OF).update({ vigente_hasta: antes, updated_at: iso }).eq("id", ofertaId).eq("estado", "presentada");
    else if (f.estado === "contraoferta") await admin.from(T_OF).update({ contraoferta_vence: antes, updated_at: iso }).eq("id", ofertaId).eq("estado", "contraoferta");
    else return { ok: false, error: "estado" };
    f = (await fila(admin, ofertaId)) ?? f;
  }
  if (modo === "insistir") {
    if (f.estado !== "presentada") return { ok: false, error: "estado" };
    await admin.from("inv_tareas").insert({ user_id: f.user_id, tipo: "insistir_oferta", aviso_id: f.aviso_id, estado: "pendiente", detalle: { oferta_id: f.id, monto_uf: n(f.monto_uf), prueba: true }, es_prueba: true });
    await admin.from(T_OF).update({ insistir_tarea_at: iso }).eq("id", ofertaId);
    return { ok: true, hizo: "insistir" };
  }
  const vence = f.estado === "presentada" ? f.vigente_hasta : f.estado === "contraoferta" ? f.contraoferta_vence : null;
  if (vence && new Date(vence as string).getTime() <= ahora.getTime()) return (await vencerUna(admin, f, deps, ahora)) ? { ok: true, hizo: "vencida" } : { ok: false, error: "guardar" };
  if (f.estado === "presentada" && !f.insistir_tarea_at && f.presentada_at && insistirDesde(new Date(f.presentada_at as string)).getTime() <= ahora.getTime()) {
    await admin.from("inv_tareas").insert({ user_id: f.user_id, tipo: "insistir_oferta", aviso_id: f.aviso_id, estado: "pendiente", detalle: { oferta_id: f.id, monto_uf: n(f.monto_uf) }, es_prueba: true });
    await admin.from(T_OF).update({ insistir_tarea_at: iso }).eq("id", ofertaId);
    return { ok: true, hizo: "insistir" };
  }
  return { ok: true, hizo: "nada" };
}

// ── LAS ACCIONES DEL PANEL DE LA OFERTA (24-nov-2026) ────────────────────────
/** Cada acción del panel lleva el prefijo «oferta_»: la ruta del admin ya tenía «respuesta» (la de «Lo que Franco averiguó», B2), que
 *  atrapaba la respuesta de quien vende antes de llegar a B4 y la rechazaba con «datos» sin escribir nada (Fabrizio, 23-nov-2026). */
export const ACCIONES_OFERTA_ADMIN = ["oferta_presentar", "oferta_respuesta", "oferta_sugerencia", "oferta_comunicada", "oferta_prueba_pasada"] as const;
export type AccionOfertaAdmin = (typeof ACCIONES_OFERTA_ADMIN)[number];
export const esAccionOfertaAdmin = (x: unknown): x is AccionOfertaAdmin => typeof x === "string" && (ACCIONES_OFERTA_ADMIN as readonly string[]).includes(x);

/** Despacha una acción del panel de la oferta. La ruta solo valida el administrador y reporta el error. */
export async function accionOfertaAdmin(admin: SupabaseClient, quien: Quien, b: Record<string, unknown>, deps: DepsAviso | null, ahora: Date = new Date()): Promise<{ ok: true } & Record<string, unknown> | { ok: false; error: string }> {
  const accion = b.accion;
  if (!esAccionOfertaAdmin(accion)) return { ok: false, error: "accion" };
  const ofertaId = typeof b.ofertaId === "string" && /^[0-9a-f-]{36}$/i.test(b.ofertaId) ? b.ofertaId : null;
  if (!ofertaId) return { ok: false, error: "datos" };
  if (accion === "oferta_presentar") return presentarOferta(admin, quien, ofertaId, deps, ahora);
  if (accion === "oferta_respuesta") return registrarRespuesta(admin, quien, ofertaId, { tipo: b.tipo, montoUF: b.montoUF, nota: b.nota, vence: b.vence }, deps, ahora);
  if (accion === "oferta_sugerencia") return corregirSugerencia(admin, quien, ofertaId, b.montoUF);
  if (accion === "oferta_comunicada") return marcarComunicada(admin, quien, ofertaId);
  return pasadaDeUnaOferta(admin, deps, ofertaId, b.modo === "vencer" || b.modo === "insistir" ? b.modo : "pasada", ahora);
}
