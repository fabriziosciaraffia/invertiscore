// ─────────────────────────────────────────────────────────────────────────────
// INVIERTE CON FRANCO, COMPRADOR · EL SERVIDOR DE LA ETAPA 1 (18-nov-2026): el contacto, la firma, el PDF guardado, la copia
// por correo, «Ver mi orden», el CRM mínimo y «Reiniciar prueba». Tablas nuevas (migración 20261118_invierte_v2_etapa1),
// todas con RLS sin políticas: solo el service role, desde rutas que ya miraron la sesión y el interruptor.
//   · LA ORDEN NO SE DESHACE: si el PDF o el correo fallan después de firmar, la firma queda y `completarOrden` los reintenta
//     (lo llama «Ver mi orden» y la pantalla Partimos). El PDF es un dibujo del texto guardado: regenerarlo es fiel.
//   · `es_prueba` lo pone el servidor al firmar si la cuenta está en `test_accounts`; si no se puede leer, la orden queda REAL
//     (protegida seis años): ante la duda, se conserva.
//   · «Reiniciar prueba» solo borra lo de una cuenta de prueba sin ninguna orden real; si encuentra una, no toca nada.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerAviso, textoCampana, type AvisoInvierte } from "@/lib/invierte/invierte-servidor";
import { pieDelDepto } from "@/lib/invierte/invierte";
import { deptoDeLinea, ordenVigente, textoPlano, VERSION_ORDEN } from "./orden";
import { formatearRut } from "./rut";
import type { PedidoContacto, PedidoFirma } from "./flujo";
import type { OrdenParaPdf } from "./orden-pdf";

export const BUCKET_INVIERTE = "invierte";
const T_PERSONAS = "inv_personas";
const T_ORDENES = "inv_ordenes";
const T_BITACORA = "inv_bitacora";

export const sha256 = (x: string | Uint8Array) => createHash("sha256").update(x).digest("hex");

export interface ContextoPedido {
  ip: string | null;
  ua: string | null;
}

export interface UsuarioInv {
  id: string;
  email: string | null;
}

/** ¿La cuenta está en test_accounts? Sin poder leer: no (lo real se conserva). */
export async function esCuentaTest(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("test_accounts").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && !!data;
}

export async function anotar(admin: SupabaseClient, f: { userId: string | null; email: string | null; ordenId?: string | null; actor: "persona" | "admin" | "sistema"; actorEmail?: string | null; accion: string; detalle?: Record<string, unknown> | null; ctx?: ContextoPedido | null; esPrueba: boolean }): Promise<void> {
  const { error } = await admin.from(T_BITACORA).insert({
    user_id: f.userId, email: f.email, orden_id: f.ordenId ?? null, actor: f.actor, actor_email: f.actorEmail ?? null, accion: f.accion,
    detalle: f.detalle ?? null, ip: f.ctx?.ip ?? null, user_agent: f.ctx?.ua ?? null, es_prueba: f.esPrueba,
  });
  if (error) console.error("[inv2] bitácora:", error.message);
}

// ── LO QUE SE SABE DE LA PERSONA ─────────────────────────────────────────────
export interface PersonaInv {
  userId: string;
  email: string | null;
  avisoOrigen: string;
  origen: string;
  urgencia: string;
  pie: string;
  pieUF: number | null;
  whatsapp: string;
  permisoWhatsappAt: string;
  estado: "contacto" | "firmo";
  createdAt: string;
  updatedAt: string;
}

export interface OrdenInv {
  id: string;
  userId: string | null;
  email: string;
  nombre: string;
  /** Desde el 20-nov-2026; null en las órdenes de antes (su saludo sale de `nombre`). */
  nombres: string | null;
  apellidos: string | null;
  rut: string;
  avisoId: string;
  deptoLinea: string;
  textoVersion: number;
  textoSha256: string;
  texto: string;
  esPrueba: boolean;
  firmadoAt: string;
  ip: string | null;
  userAgent: string | null;
  pdfPath: string | null;
  pdfSha256: string | null;
  copiaEnviadaAt: string | null;
}

const COLS_ORDEN = "id, user_id, email, nombre, nombres, apellidos, rut, aviso_id, depto_linea, texto_version, texto_sha256, texto, es_prueba, firmado_at, ip, user_agent, pdf_path, pdf_sha256, copia_enviada_at";

function aOrden(f: Record<string, unknown>): OrdenInv {
  return {
    id: f.id as string, userId: (f.user_id as string | null) ?? null, email: f.email as string, nombre: f.nombre as string,
    nombres: (f.nombres as string | null) ?? null, apellidos: (f.apellidos as string | null) ?? null, rut: f.rut as string,
    avisoId: f.aviso_id as string, deptoLinea: f.depto_linea as string, textoVersion: Number(f.texto_version), textoSha256: f.texto_sha256 as string,
    texto: f.texto as string, esPrueba: f.es_prueba === true, firmadoAt: f.firmado_at as string, ip: (f.ip as string | null) ?? null,
    userAgent: (f.user_agent as string | null) ?? null, pdfPath: (f.pdf_path as string | null) ?? null, pdfSha256: (f.pdf_sha256 as string | null) ?? null,
    copiaEnviadaAt: (f.copia_enviada_at as string | null) ?? null,
  };
}

function aPersona(f: Record<string, unknown>): PersonaInv {
  return {
    userId: f.user_id as string, email: (f.email as string | null) ?? null, avisoOrigen: f.aviso_origen as string, origen: f.origen as string,
    urgencia: f.urgencia as string, pie: f.pie as string, pieUF: f.pie_uf != null ? Number(f.pie_uf) : null, whatsapp: f.whatsapp as string,
    permisoWhatsappAt: f.permiso_whatsapp_at as string, estado: f.estado === "firmo" ? "firmo" : "contacto",
    createdAt: f.created_at as string, updatedAt: f.updated_at as string,
  };
}

export async function leerPersona(admin: SupabaseClient, userId: string): Promise<PersonaInv | null> {
  const { data } = await admin.from(T_PERSONAS).select("*").eq("user_id", userId).maybeSingle();
  return data ? aPersona(data as Record<string, unknown>) : null;
}

/** La orden de la versión vigente, si la firmó. */
export async function ordenVigenteDe(admin: SupabaseClient, userId: string): Promise<OrdenInv | null> {
  const { data } = await admin.from(T_ORDENES).select(COLS_ORDEN).eq("user_id", userId).eq("texto_version", VERSION_ORDEN).maybeSingle();
  return data ? aOrden(data as Record<string, unknown>) : null;
}

/** La última orden que firmó (de cualquier versión): la que «Ver mi orden» abre si todavía no firmó la vigente. */
export async function ultimaOrdenDe(admin: SupabaseClient, userId: string): Promise<OrdenInv | null> {
  const { data } = await admin.from(T_ORDENES).select(COLS_ORDEN).eq("user_id", userId).order("texto_version", { ascending: false }).limit(1);
  const f = data?.[0];
  return f ? aOrden(f as Record<string, unknown>) : null;
}

/** El depto del flujo nuevo: existe y es usado. null si no (un nuevo sigue yendo a Pronto). */
export async function deptoDelFlujo(admin: SupabaseClient, avisoId: string): Promise<AvisoInvierte | null> {
  const aviso = await leerAviso(admin, avisoId);
  return aviso && aviso.condicion === "usado" ? aviso : null;
}

// ── EL CONTACTO ──────────────────────────────────────────────────────────────
export type ResultadoContacto = { ok: true; firmo: boolean } | { ok: false; error: "depto" | "guardar" };

export async function guardarContacto(admin: SupabaseClient, user: UsuarioInv, pedido: PedidoContacto, ctx: ContextoPedido, campana: Record<string, unknown> | null): Promise<ResultadoContacto> {
  const aviso = await deptoDelFlujo(admin, pedido.avisoId);
  if (!aviso) return { ok: false, error: "depto" };
  const previa = await leerPersona(admin, user.id);
  const firmada = await ordenVigenteDe(admin, user.id);
  const ahora = new Date().toISOString();
  const { error } = await admin.from(T_PERSONAS).upsert({
    user_id: user.id,
    email: user.email,
    aviso_origen: aviso.avisoId,
    origen: pedido.origen,
    urgencia: pedido.urgencia,
    pie: pedido.pie,
    pie_uf: pieDelDepto(aviso.precioUF),
    whatsapp: pedido.whatsapp,
    permiso_whatsapp_at: ahora,
    estado: firmada || previa?.estado === "firmo" ? "firmo" : "contacto",
    campana,
    updated_at: ahora,
  }, { onConflict: "user_id" });
  if (error) {
    console.error("[inv2] contacto:", error.message);
    return { ok: false, error: "guardar" };
  }
  const esPrueba = await esCuentaTest(admin, user.id);
  await anotar(admin, { userId: user.id, email: user.email, actor: "persona", accion: previa ? "contacto_actualizado" : "contacto", detalle: { aviso_id: aviso.avisoId, origen: pedido.origen, urgencia: pedido.urgencia, pie: pedido.pie, permiso_whatsapp: true }, ctx, esPrueba });
  return { ok: true, firmo: !!firmada };
}

// ── LA FIRMA ─────────────────────────────────────────────────────────────────
export interface DepsFirma {
  generarPdf: (o: OrdenParaPdf) => Promise<Uint8Array>;
  /** `ok: false` con el MOTIVO (sin-llave, bloqueo:…, baja, eliminacion, resend:…, excepcion:…): va a Sentry y a la bitácora. */
  enviarCopia: (p: { to: string; userId: string | null; nombre: string; depto: string; firmadoAt: string; pdf: Uint8Array; ordenId: string }) => Promise<{ ok: true } | { ok: false; motivo: string }>;
}

/** De dónde vino el intento de completar la orden (va a la bitácora). */
export type OrigenIntento = "firma" | "ver" | "cron" | "admin";

export type ResultadoFirma =
  | { ok: true; ordenId: string; yaFirmada: boolean; pdf: boolean; copia: boolean; motivoCopia: string | null }
  | { ok: false; error: "sin-contacto" | "depto" | "sin-correo" | "guardar" };

export async function firmar(admin: SupabaseClient, user: UsuarioInv, pedido: PedidoFirma, ctx: ContextoPedido, deps: DepsFirma): Promise<ResultadoFirma> {
  if (!user.email) return { ok: false, error: "sin-correo" };
  const persona = await leerPersona(admin, user.id);
  if (!persona) return { ok: false, error: "sin-contacto" };
  const previa = await ordenVigenteDe(admin, user.id);
  if (previa) {
    const c = await completarOrden(admin, previa, deps, "firma");
    return { ok: true, ordenId: previa.id, yaFirmada: true, ...c };
  }
  const aviso = await deptoDelFlujo(admin, pedido.avisoId);
  if (!aviso) return { ok: false, error: "depto" };
  const depto = deptoDeLinea(aviso.linea);
  const texto = textoPlano(ordenVigente({ nombre: pedido.nombre, rut: formatearRut(pedido.rut), depto }));
  const esPrueba = await esCuentaTest(admin, user.id);
  const { data, error } = await admin.from(T_ORDENES).insert({
    user_id: user.id,
    email: user.email,
    nombre: pedido.nombre,
    nombres: pedido.nombres,
    apellidos: pedido.apellidos,
    rut: pedido.rut,
    aviso_id: aviso.avisoId,
    depto_linea: aviso.linea,
    texto_version: VERSION_ORDEN,
    texto_sha256: sha256(texto),
    texto,
    acepto_casilla: pedido.acepto,
    leyo_hasta_el_final: pedido.leyoHastaElFinal,
    es_prueba: esPrueba,
    ip: ctx.ip,
    user_agent: ctx.ua ? ctx.ua.slice(0, 500) : null,
  }).select(COLS_ORDEN).single();
  if (error || !data) {
    // Dos pestañas firmando a la vez: la otra ya la guardó (índice único por cuenta y versión).
    if (error?.code === "23505") {
      const ya = await ordenVigenteDe(admin, user.id);
      if (ya) return { ok: true, ordenId: ya.id, yaFirmada: true, ...(await completarOrden(admin, ya, deps, "firma")) };
    }
    console.error("[inv2] firma:", error?.message);
    return { ok: false, error: "guardar" };
  }
  const orden = aOrden(data as Record<string, unknown>);
  await admin.from(T_PERSONAS).update({ estado: "firmo", updated_at: new Date().toISOString() }).eq("user_id", user.id);
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "firma", detalle: { version: VERSION_ORDEN, aviso_id: aviso.avisoId, texto_sha256: orden.textoSha256 }, ctx, esPrueba });
  const c = await completarOrden(admin, orden, deps, "firma");
  return { ok: true, ordenId: orden.id, yaFirmada: false, ...c };
}

/** Deja la orden completa: su PDF guardado (con huella) y la copia enviada. Idempotente; cada parte que falla se reintenta la próxima vez. */
export async function completarOrden(admin: SupabaseClient, orden: OrdenInv, deps: DepsFirma, origen: OrigenIntento): Promise<{ pdf: boolean; copia: boolean; motivoCopia: string | null }> {
  let pdfBytes: Uint8Array | null = null;
  let pdf = !!orden.pdfPath;
  if (!pdf) {
    try {
      pdfBytes = await deps.generarPdf(paraPdf(orden));
      const ruta = `ordenes/${orden.id}.pdf`;
      const subida = await admin.storage.from(BUCKET_INVIERTE).upload(ruta, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (subida.error) throw new Error(subida.error.message);
      const huella = sha256(pdfBytes);
      const { error } = await admin.from(T_ORDENES).update({ pdf_path: ruta, pdf_sha256: huella, pdf_generado_at: new Date().toISOString() }).eq("id", orden.id).is("pdf_path", null);
      if (error) throw new Error(error.message);
      orden = { ...orden, pdfPath: ruta, pdfSha256: huella };
      pdf = true;
      await anotar(admin, { userId: orden.userId, email: orden.email, ordenId: orden.id, actor: "sistema", accion: "pdf_guardado", detalle: { ruta, pdf_sha256: huella }, esPrueba: orden.esPrueba });
    } catch (e) {
      console.error("[inv2] pdf:", e instanceof Error ? e.message : e);
    }
  }
  let copia = !!orden.copiaEnviadaAt;
  let motivoCopia: string | null = null;
  if (!copia && !pdf) motivoCopia = "sin-pdf";
  if (!copia && pdf) {
    try {
      if (!pdfBytes) pdfBytes = await descargarPdf(admin, orden);
      if (!pdfBytes) motivoCopia = "pdf-no-se-pudo-leer";
      else {
        const r = await deps.enviarCopia({ to: orden.email, userId: orden.userId, nombre: orden.nombre, depto: deptoDeLinea(orden.deptoLinea), firmadoAt: orden.firmadoAt, pdf: pdfBytes, ordenId: orden.id });
        if (r.ok) {
          await admin.from(T_ORDENES).update({ copia_enviada_at: new Date().toISOString() }).eq("id", orden.id).is("copia_enviada_at", null);
          copia = true;
          await anotar(admin, { userId: orden.userId, email: orden.email, ordenId: orden.id, actor: "sistema", accion: "copia_enviada", detalle: { a: orden.email, origen }, esPrueba: orden.esPrueba });
        } else motivoCopia = r.motivo;
      }
    } catch (e) {
      motivoCopia = `excepcion:${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`;
      console.error("[inv2] copia:", motivoCopia);
    }
    if (!copia) {
      const intento = (await intentosFallidos(admin, orden.id)) + 1;
      await anotar(admin, { userId: orden.userId, email: orden.email, ordenId: orden.id, actor: "sistema", accion: "copia_fallida", detalle: { motivo: motivoCopia, intento, origen }, esPrueba: orden.esPrueba });
    }
  }
  return { pdf, copia, motivoCopia };
}

async function intentosFallidos(admin: SupabaseClient, ordenId: string): Promise<number> {
  const { data } = await admin.from(T_BITACORA).select("id").eq("orden_id", ordenId).eq("accion", "copia_fallida");
  return (data ?? []).length;
}

// ── LAS COPIAS QUE NO SALIERON (18-nov-2026): el estado, el reintento del cron y el aviso a hola@ ────────────────────────
export interface EstadoCopiaOrden {
  intentos: number;
  ultimoIntentoAt: string | null;
  ultimoMotivo: string | null;
  avisada: boolean;
}

/** El estado de la copia de cada orden, leído de la bitácora (copia_fallida y copia_avisada). */
export async function estadoCopias(admin: SupabaseClient, ordenIds: string[]): Promise<Map<string, EstadoCopiaOrden>> {
  const out = new Map<string, EstadoCopiaOrden>();
  for (const id of ordenIds) out.set(id, { intentos: 0, ultimoIntentoAt: null, ultimoMotivo: null, avisada: false });
  if (!ordenIds.length) return out;
  const { data } = await admin.from(T_BITACORA).select("orden_id, accion, detalle, created_at").in("orden_id", ordenIds).in("accion", ["copia_fallida", "copia_avisada"]).order("created_at", { ascending: true });
  for (const f of (data ?? []) as Array<{ orden_id: string; accion: string; detalle: Record<string, unknown> | null; created_at: string }>) {
    const e = out.get(f.orden_id);
    if (!e) continue;
    if (f.accion === "copia_avisada") { e.avisada = true; continue; }
    e.intentos++;
    e.ultimoIntentoAt = f.created_at;
    e.ultimoMotivo = typeof f.detalle?.motivo === "string" ? f.detalle.motivo : null;
  }
  return out;
}

export interface DepsReintento {
  firma: DepsFirma;
  /** ¿Este correo puede recibir el reintento? (mientras el modo no sea «todos», solo la lista). */
  puedeRecibir: (email: string) => boolean;
  avisar: (p: { ordenId: string; email: string; firmadoAt: string; intentos: number; motivo: string | null }) => Promise<void>;
  ahora?: () => Date;
}

/** Reintenta las copias pendientes (las de los últimos 7 días, con PDF, hasta 5 intentos) y avisa a hola@ las de más de una hora. */
export async function reintentarCopias(admin: SupabaseClient, deps: DepsReintento): Promise<{ revisadas: number; enviadas: number; fallidas: number; avisadas: number; fuera: number }> {
  const { tocaReintentar, debeAvisar, VENTANA_REINTENTO_DIAS } = await import("./copias");
  const ahora = (deps.ahora ?? (() => new Date()))();
  const desde = new Date(ahora.getTime() - VENTANA_REINTENTO_DIAS * 86_400_000).toISOString();
  const { data, error } = await admin.from(T_ORDENES).select(COLS_ORDEN).is("copia_enviada_at", null).gte("firmado_at", desde).order("firmado_at", { ascending: true }).limit(20);
  if (error) throw new Error(`inv2 reintento: ${error.message}`);
  const ordenes = ((data ?? []) as Record<string, unknown>[]).map(aOrden);
  const estados = await estadoCopias(admin, ordenes.map((o) => o.id));
  const r = { revisadas: ordenes.length, enviadas: 0, fallidas: 0, avisadas: 0, fuera: 0 };
  for (const o of ordenes) {
    if (!deps.puedeRecibir(o.email)) { r.fuera++; continue; }
    const e = estados.get(o.id)!;
    let motivo = e.ultimoMotivo;
    let intentos = e.intentos;
    if (tocaReintentar({ firmadoAt: o.firmadoAt, intentos: e.intentos, ultimoIntentoAt: e.ultimoIntentoAt }, ahora)) {
      const c = await completarOrden(admin, o, deps.firma, "cron");
      if (c.copia) { r.enviadas++; continue; }
      r.fallidas++;
      motivo = c.motivoCopia;
      intentos++;
    }
    if (debeAvisar({ firmadoAt: o.firmadoAt, yaAvisada: e.avisada }, ahora)) {
      await deps.avisar({ ordenId: o.id, email: o.email, firmadoAt: o.firmadoAt, intentos, motivo });
      await anotar(admin, { userId: o.userId, email: o.email, ordenId: o.id, actor: "sistema", accion: "copia_avisada", detalle: { intentos, motivo }, esPrueba: o.esPrueba });
      r.avisadas++;
    }
  }
  return r;
}

export function paraPdf(o: OrdenInv): OrdenParaPdf {
  return { id: o.id, nombre: o.nombre, rut: o.rut, email: o.email, texto: o.texto, textoVersion: o.textoVersion, textoSha256: o.textoSha256, firmadoAt: o.firmadoAt, ip: o.ip, userAgent: o.userAgent };
}

async function descargarPdf(admin: SupabaseClient, o: OrdenInv): Promise<Uint8Array | null> {
  if (!o.pdfPath) return null;
  const { data, error } = await admin.storage.from(BUCKET_INVIERTE).download(o.pdfPath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Una URL firmada de 60 s al PDF guardado. */
export async function urlFirmadaPdf(admin: SupabaseClient, o: OrdenInv): Promise<string | null> {
  if (!o.pdfPath) return null;
  const { data, error } = await admin.storage.from(BUCKET_INVIERTE).createSignedUrl(o.pdfPath, 60, { download: false });
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export async function anotarVista(admin: SupabaseClient, o: OrdenInv, quien: { actor: "persona" | "admin"; email: string | null }, ctx: ContextoPedido | null): Promise<void> {
  await anotar(admin, { userId: o.userId, email: o.email, ordenId: o.id, actor: quien.actor, actorEmail: quien.actor === "admin" ? quien.email : null, accion: "orden_vista", ctx, esPrueba: o.esPrueba });
}

export async function leerOrdenPorId(admin: SupabaseClient, id: string): Promise<OrdenInv | null> {
  const { data } = await admin.from(T_ORDENES).select(COLS_ORDEN).eq("id", id).maybeSingle();
  return data ? aOrden(data as Record<string, unknown>) : null;
}

// ── EL CRM MÍNIMO (/admin/invierte-v2) ───────────────────────────────────────
export interface FilaCrm extends PersonaInv {
  linea: string | null;
  precioUF: number | null;
  orden: { id: string; version: number; firmadoAt: string; pdf: boolean; copia: boolean; esPrueba: boolean; copiaIntentos: number; copiaUltimoAt: string | null; copiaMotivo: string | null } | null;
  esPrueba: boolean;
  campanaTexto: string;
}

export async function leerCrm(admin: SupabaseClient): Promise<{ filas: FilaCrm[]; sinTabla: boolean }> {
  const { data, error } = await admin.from(T_PERSONAS).select("*").order("updated_at", { ascending: false }).range(0, 999);
  if (error) return { filas: [], sinTabla: ["PGRST205", "42P01"].includes(error.code ?? "") };
  const personas = (data ?? []).map((f) => ({ ...aPersona(f as Record<string, unknown>), campana: (f as Record<string, unknown>).campana as Record<string, unknown> | null }));
  const ids = personas.map((p) => p.userId);
  const [ordenes, pruebas, avisos] = await Promise.all([
    ids.length ? admin.from(T_ORDENES).select(COLS_ORDEN).in("user_id", ids).order("texto_version", { ascending: false }) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length ? admin.from("test_accounts").select("user_id").in("user_id", ids) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    Promise.all(Array.from(new Set(personas.map((p) => p.avisoOrigen))).map(async (a) => [a, await leerAviso(admin, a)] as const)),
  ]);
  const ordenDe = new Map<string, OrdenInv>();
  for (const f of (ordenes.data ?? []) as Record<string, unknown>[]) {
    const o = aOrden(f);
    if (o.userId && !ordenDe.has(o.userId)) ordenDe.set(o.userId, o);
  }
  const deprueba = new Set(((pruebas.data ?? []) as Record<string, unknown>[]).map((f) => f.user_id as string));
  const avisoDe = new Map(avisos);
  const copias = await estadoCopias(admin, Array.from(ordenDe.values()).filter((o) => !o.copiaEnviadaAt).map((o) => o.id));
  return {
    sinTabla: false,
    filas: personas.map((p) => {
      const o = ordenDe.get(p.userId);
      const a = avisoDe.get(p.avisoOrigen) ?? null;
      return {
        ...p,
        linea: a?.linea ?? null,
        precioUF: a?.precioUF ?? null,
        orden: o ? { id: o.id, version: o.textoVersion, firmadoAt: o.firmadoAt, pdf: !!o.pdfPath, copia: !!o.copiaEnviadaAt, esPrueba: o.esPrueba, copiaIntentos: copias.get(o.id)?.intentos ?? 0, copiaUltimoAt: copias.get(o.id)?.ultimoIntentoAt ?? null, copiaMotivo: copias.get(o.id)?.ultimoMotivo ?? null } : null,
        esPrueba: deprueba.has(p.userId),
        campanaTexto: textoCampana(p.campana),
      };
    }),
  };
}

// ── REINICIAR PRUEBA ─────────────────────────────────────────────────────────
export type ResultadoReinicio =
  | { ok: true; ordenes: number; bitacora: number; pdfs: number; etapa2: { deptos: number; documentos: number; tareas: number; perfil: boolean; precioMaxRestaurado: boolean; comunasRestauradas: boolean } }
  | { ok: false; error: "no-es-prueba" | "orden-real" | "leer" | "borrar" };

/**
 * Borra lo de una persona DE PRUEBA para repetir el recorrido: su bitácora de prueba, el PDF y la orden de prueba, y su fila de
 * inv_personas. No toca nada si la cuenta no está en test_accounts o si tiene alguna orden real (los triggers de la base son la
 * segunda barrera). Deja un registro de prueba del reinicio.
 * Etapa 2 (18-nov-2026): también su perfil, sus deptos, sus documentos (fila y archivo) y sus tareas, siempre por su user_id; y si
 * el tope reemplazó el precio máximo de su perfil de búsqueda, se lo devuelve al de antes; las comunas, también (las guardadas al
 * confirmar el perfil).
 */
export async function reiniciarPrueba(admin: SupabaseClient, userId: string, adminEmail: string | null, deps: { esCuentaTest?: (id: string) => Promise<boolean> } = {}): Promise<ResultadoReinicio> {
  const esTest = await (deps.esCuentaTest ?? ((id: string) => esCuentaTest(admin, id)))(userId);
  if (!esTest) return { ok: false, error: "no-es-prueba" };
  const { data: ordenes, error } = await admin.from(T_ORDENES).select("id, es_prueba, pdf_path").eq("user_id", userId);
  if (error) return { ok: false, error: "leer" };
  const filas = (ordenes ?? []) as { id: string; es_prueba: boolean; pdf_path: string | null }[];
  if (filas.some((o) => o.es_prueba !== true)) return { ok: false, error: "orden-real" };
  const idsOrden = filas.map((o) => o.id);
  // Etapa 2: perfil, deptos, documentos y tareas de ESTA persona (todas con user_id; ninguna apunta a la orden).
  const e2 = await reiniciarEtapa2(admin, userId);
  if (!e2) return { ok: false, error: "borrar" };
  // La bitácora primero (su FK a la orden es restrict): la de la persona y la de sus órdenes, solo la de prueba.
  const b1 = await admin.from(T_BITACORA).delete({ count: "exact" }).eq("user_id", userId).eq("es_prueba", true);
  const b2 = idsOrden.length ? await admin.from(T_BITACORA).delete({ count: "exact" }).in("orden_id", idsOrden).eq("es_prueba", true) : { error: null, count: 0 };
  if (b1.error || b2.error) return { ok: false, error: "borrar" };
  const rutas = filas.map((o) => o.pdf_path).filter((r): r is string => !!r);
  if (rutas.length) {
    const r = await admin.storage.from(BUCKET_INVIERTE).remove(rutas);
    if (r.error) return { ok: false, error: "borrar" };
  }
  if (idsOrden.length) {
    const d = await admin.from(T_ORDENES).delete().in("id", idsOrden).eq("es_prueba", true);
    if (d.error) return { ok: false, error: "borrar" };
  }
  const p = await admin.from(T_PERSONAS).delete().eq("user_id", userId);
  if (p.error) return { ok: false, error: "borrar" };
  await anotar(admin, { userId, email: null, actor: "admin", actorEmail: adminEmail, accion: "prueba_reiniciada", detalle: { ordenes: idsOrden.length, pdfs: rutas.length }, esPrueba: true });
  return { ok: true, ordenes: idsOrden.length, bitacora: (b1.count ?? 0) + (b2.count ?? 0), pdfs: rutas.length, etapa2: e2 };
}

async function reiniciarEtapa2(admin: SupabaseClient, userId: string): Promise<{ deptos: number; documentos: number; tareas: number; perfil: boolean; precioMaxRestaurado: boolean; comunasRestauradas: boolean } | null> {
  const [{ data: perfil, error: e1 }, { data: docs, error: e2 }] = await Promise.all([
    admin.from("inv_perfiles").select("tope_supuestos").eq("user_id", userId).maybeSingle(),
    admin.from("inv_documentos").select("id, path").eq("user_id", userId),
  ]);
  if (e1 || e2) return null;
  const archivos = ((docs ?? []) as { path: string | null }[]).map((d) => d.path).filter((r): r is string => !!r);
  if (archivos.length) {
    const r = await admin.storage.from(BUCKET_INVIERTE).remove(archivos);
    if (r.error) return null;
  }
  const d = await admin.from("inv_documentos").delete({ count: "exact" }).eq("user_id", userId);
  const t = await admin.from("inv_tareas").delete({ count: "exact" }).eq("user_id", userId);
  const dp = await admin.from("inv_deptos").delete({ count: "exact" }).eq("user_id", userId);
  if (d.error || t.error || dp.error) return null;
  // Los cambios avisados de sus deptos (entrega 2). Sin la migración aplicada la tabla no existe: eso no impide reiniciar.
  const cb = await admin.from("inv_cambios").delete().eq("user_id", userId);
  if (cb.error && cb.error.code !== "42P01" && cb.error.code !== "PGRST205") return null;
  // El precio máximo de antes: solo si el tope lo reemplazó.
  const sup = (perfil?.tope_supuestos ?? null) as { reemplazoPrecioMax?: boolean; precioMaxAnterior?: { valor: number | null }; comunasAnterior?: { valor: string[] | null } } | null;
  const devolver: Record<string, unknown> = {};
  if (sup?.reemplazoPrecioMax && sup.precioMaxAnterior) devolver.precio_max_uf = sup.precioMaxAnterior.valor;
  if (sup?.comunasAnterior) devolver.comunas = sup.comunasAnterior.valor;
  const restaurado = "precio_max_uf" in devolver;
  if (Object.keys(devolver).length) {
    const r = await admin.from("perfil_busqueda").update({ ...devolver, actualizado_at: new Date().toISOString() }).eq("user_id", userId);
    if (r.error) return null;
  }
  const pf = await admin.from("inv_perfiles").delete().eq("user_id", userId);
  if (pf.error) return null;
  return { deptos: dp.count ?? 0, documentos: d.count ?? 0, tareas: t.count ?? 0, perfil: !!perfil, precioMaxRestaurado: restaurado, comunasRestauradas: "comunas" in devolver };
}
