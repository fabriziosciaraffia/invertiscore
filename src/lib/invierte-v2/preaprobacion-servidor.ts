// ─────────────────────────────────────────────────────────────────────────────
// LA PREAPROBACIÓN, EN EL SERVIDOR (Invierte con Franco, entrega 3, 19-nov-2026).
//   · pedirSubida: valida tipo y tamaño, crea la fila (`subiendo`) y devuelve una URL firmada de subida al bucket privado
//     `invierte` (preaprobaciones/<user>/<id>.<ext>): el archivo va directo del navegador al bucket, nunca por una función (Vercel
//     corta el cuerpo en 4,5 MB).
//   · confirmarSubida: baja el archivo, guarda su huella (sha256) y su tamaño real, lo lee la IA (si puede), deja la tarea
//     «revisar la preaprobación» y lo anota en la bitácora. Una lectura que falla no rompe nada: queda para la revisión a mano.
//   · sinCredito / todaviaNo: «Compro sin crédito» pasa directo; «Todavía no la tengo» deja la tarea de explicarle.
//   · aprobar / pedirCorregir (admin): cambian el estado, cierran la tarea, lo anotan y mandan el correo. Aprobar reemplaza la
//     estimación de hasta cuánto puede comprar por el monto aprobado (perfil y perfil de la selección semanal).
//   · borrarArchivosPreaprobacion: al pedir la eliminación de la cuenta, los archivos se van del bucket (las filas se van con la
//     cuenta, en cascada).
// Ningún correo sale a una cuenta fuera de la lista mientras el modo no sea «todos» (copias-servidor › puedeRecibirCopia).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { hastaCuanto } from "./perfil";
import { leerPerfilInv, mercado } from "./perfil-servidor";
import { anotar, sha256, ultimaOrdenDe, BUCKET_INVIERTE, type ContextoPedido } from "./servidor";
import { estadoVisible, nombreCoincide, validarArchivo, type Aprobacion, type EstadoDocumento, type EstadoVisible } from "./preaprobacion";
import type { ResultadoLectura } from "./preaprobacion-ia";

const T_DOCS = "inv_documentos";
const COLS = "id, user_id, tipo, estado, path, mime, bytes, sha256, motivo, ia, ia_modelo, ia_costo_usd, ia_at, banco, monto_aprobado_uf, vigente_hasta, revisado_por, revisado_at, es_prueba, created_at";

export interface DocumentoInv {
  id: string; userId: string; tipo: "preaprobacion" | "sin_credito"; estado: EstadoDocumento; path: string | null; mime: string | null; bytes: number | null;
  motivo: string | null; ia: Record<string, unknown> | null; iaModelo: string | null; iaCostoUsd: number | null; banco: string | null; montoAprobadoUF: number | null;
  vigenteHasta: string | null; revisadoPor: string | null; revisadoAt: string | null; esPrueba: boolean; createdAt: string;
}
const aDoc = (f: Record<string, unknown>): DocumentoInv => ({
  id: f.id as string, userId: f.user_id as string, tipo: f.tipo as DocumentoInv["tipo"], estado: f.estado as EstadoDocumento, path: (f.path as string | null) ?? null,
  mime: (f.mime as string | null) ?? null, bytes: (f.bytes as number | null) ?? null, motivo: (f.motivo as string | null) ?? null, ia: (f.ia as Record<string, unknown> | null) ?? null,
  iaModelo: (f.ia_modelo as string | null) ?? null, iaCostoUsd: f.ia_costo_usd == null ? null : Number(f.ia_costo_usd), banco: (f.banco as string | null) ?? null,
  montoAprobadoUF: f.monto_aprobado_uf == null ? null : Number(f.monto_aprobado_uf), vigenteHasta: (f.vigente_hasta as string | null) ?? null,
  revisadoPor: (f.revisado_por as string | null) ?? null, revisadoAt: (f.revisado_at as string | null) ?? null, esPrueba: f.es_prueba === true, createdAt: f.created_at as string,
});

export const MOTIVO_REEMPLAZADA = "Reemplazada por la que subiste después.";

export interface Preaprobacion { doc: DocumentoInv | null; explicando: boolean; estado: EstadoVisible }

/** Lo vigente: el último documento que no quedó a medio subir, y si espera que le expliquen cómo pedirla. */
export async function leerPreaprobacion(admin: SupabaseClient, userId: string): Promise<Preaprobacion> {
  const [{ data: docs }, { data: tareas }] = await Promise.all([
    admin.from(T_DOCS).select(COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    admin.from("inv_tareas").select("id").eq("user_id", userId).eq("tipo", "explicar_preaprobacion").eq("estado", "pendiente").limit(1),
  ]);
  const f = (docs ?? []).find((d) => d.estado !== "subiendo");
  const doc = f ? aDoc(f as Record<string, unknown>) : null;
  const explicando = (tareas ?? []).length > 0;
  return { doc, explicando, estado: estadoVisible(doc, explicando) };
}

// ── SUBIR ────────────────────────────────────────────────────────────────────
export type ResultadoPedirSubida = { ok: true; id: string; path: string; token: string } | { ok: false; error: "sin-orden" | "tipo" | "tamano" | "guardar" };

export async function pedirSubida(admin: SupabaseClient, user: { id: string; email: string | null }, archivo: { mime: unknown; bytes: unknown }): Promise<ResultadoPedirSubida> {
  const v = validarArchivo(archivo);
  if (!v.ok) return { ok: false, error: v.error };
  const orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) return { ok: false, error: "sin-orden" };
  const { data: fila, error } = await admin.from(T_DOCS).insert({ user_id: user.id, tipo: "preaprobacion", estado: "subiendo", mime: v.mime, bytes: v.bytes, es_prueba: orden.esPrueba }).select("id").single();
  if (error || !fila) return { ok: false, error: "guardar" };
  const path = `preaprobaciones/${user.id}/${fila.id}.${v.ext}`;
  const u = await admin.from(T_DOCS).update({ path }).eq("id", fila.id);
  const firmada = await admin.storage.from(BUCKET_INVIERTE).createSignedUploadUrl(path);
  if (u.error || firmada.error || !firmada.data) return { ok: false, error: "guardar" };
  return { ok: true, id: fila.id as string, path, token: firmada.data.token };
}

export interface DepsConfirmar { leerIA: ((a: { bytes: Uint8Array; mime: string }) => Promise<ResultadoLectura>) | null }
export type ResultadoConfirmar = { ok: true; leida: boolean } | { ok: false; error: "no-existe" | "sin-archivo" | "guardar" };

export async function confirmarSubida(admin: SupabaseClient, user: { id: string; email: string | null }, id: string, deps: DepsConfirmar, ctx: ContextoPedido | null): Promise<ResultadoConfirmar> {
  const { data: f } = await admin.from(T_DOCS).select(COLS).eq("id", id).eq("user_id", user.id).eq("estado", "subiendo").maybeSingle();
  if (!f?.path) return { ok: false, error: "no-existe" };
  const doc = aDoc(f as Record<string, unknown>);
  const bajada = await admin.storage.from(BUCKET_INVIERTE).download(doc.path!);
  if (bajada.error || !bajada.data) return { ok: false, error: "sin-archivo" };
  const bytes = new Uint8Array(await bajada.data.arrayBuffer());
  if (!bytes.length) return { ok: false, error: "sin-archivo" };
  const orden = await ultimaOrdenDe(admin, user.id);
  // La lectura con IA: propone; el servidor decide si el nombre coincide y pasa el monto a UF.
  let ia: Record<string, unknown> | null = null, iaModelo: string | null = null, iaCosto: number | null = null;
  if (deps.leerIA && doc.mime) {
    const r = await deps.leerIA({ bytes, mime: doc.mime });
    if (r.ok) {
      const { uf } = await mercado(admin);
      const montoUF = r.lectura.monto == null ? null : r.lectura.moneda === "CLP" ? Math.round(r.lectura.monto / uf) : r.lectura.monto;
      ia = { ...r.lectura, montoUF, nombreCoincide: orden ? nombreCoincide(r.lectura.nombreTitular, orden.nombre) : null };
      iaModelo = r.modelo; iaCosto = r.costoUsd;
    } else ia = { sinLectura: r.motivo };
  }
  const ahora = new Date().toISOString();
  const up = await admin.from(T_DOCS).update({
    estado: "en_revision", bytes: bytes.length, sha256: sha256(bytes), ia, ia_modelo: iaModelo, ia_costo_usd: iaCosto, ia_at: ia ? ahora : null,
  }).eq("id", id).eq("estado", "subiendo");
  if (up.error) return { ok: false, error: "guardar" };
  // Las que estaban en revisión quedan reemplazadas por esta: el admin revisa la última, no una vieja.
  await admin.from(T_DOCS).update({ estado: "por_corregir", motivo: MOTIVO_REEMPLAZADA, revisado_por: "sistema", revisado_at: ahora }).eq("user_id", user.id).eq("estado", "en_revision").neq("id", id);
  const t = await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "revisar_preaprobacion", estado: "pendiente", detalle: { documento: id }, es_prueba: doc.esPrueba });
  if (t.error && t.error.code !== "23505") console.error("[inv2] tarea revisar:", t.error.message);
  // Si esperaba que le explicaran cómo pedirla, ya no hace falta.
  await admin.from("inv_tareas").update({ estado: "hecha", hecha_por: "sistema", hecha_at: ahora }).eq("user_id", user.id).eq("tipo", "explicar_preaprobacion").eq("estado", "pendiente");
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden?.id ?? null, actor: "persona", accion: "preaprobacion_subida", detalle: { documento: id, mime: doc.mime, bytes: bytes.length, leida: !!iaModelo }, ctx, esPrueba: doc.esPrueba });
  return { ok: true, leida: !!iaModelo };
}

export async function sinCredito(admin: SupabaseClient, user: { id: string; email: string | null }, ctx: ContextoPedido | null): Promise<boolean> {
  const orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) return false;
  const { error } = await admin.from(T_DOCS).insert({ user_id: user.id, tipo: "sin_credito", estado: "sin_credito", es_prueba: orden.esPrueba });
  if (error) return false;
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "compra_sin_credito", ctx, esPrueba: orden.esPrueba });
  return true;
}

export async function todaviaNo(admin: SupabaseClient, user: { id: string; email: string | null }, ctx: ContextoPedido | null): Promise<boolean> {
  const orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) return false;
  const { error } = await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "explicar_preaprobacion", estado: "pendiente", es_prueba: orden.esPrueba });
  if (error && error.code !== "23505") return false;
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "preaprobacion_todavia_no", ctx, esPrueba: orden.esPrueba });
  return true;
}

/** La URL firmada (60 s) para «Ver lo que subí» o «Ver» del admin. */
export async function urlDocumento(admin: SupabaseClient, doc: Pick<DocumentoInv, "path">): Promise<string | null> {
  if (!doc.path) return null;
  const { data } = await admin.storage.from(BUCKET_INVIERTE).createSignedUrl(doc.path, 60);
  return data?.signedUrl ?? null;
}

export async function documentoPorId(admin: SupabaseClient, id: string): Promise<DocumentoInv | null> {
  const { data } = await admin.from(T_DOCS).select(COLS).eq("id", id).maybeSingle();
  return data ? aDoc(data as Record<string, unknown>) : null;
}

// ── LA REVISIÓN (admin) ──────────────────────────────────────────────────────
export interface DepsRevision {
  /** El correo a la persona. Devuelve si salió. Lo inyecta la ruta (email.ts); el tier lo reemplaza. */
  correo: (p: { to: string; userId: string; nombre: string | null; documentoId: string } & ({ tipo: "aprobada"; banco: string; montoUF: number; vigenteHasta: string } | { tipo: "por_corregir"; motivo: string })) => Promise<boolean>;
  /** Si a ese correo le puede salir algo (el modo y la lista del interruptor). */
  puedeRecibir: (email: string) => Promise<boolean>;
}
export type ResultadoRevision = { ok: true; correo: boolean } | { ok: false; error: "no-existe" | "estado" | "guardar" };

async function cerrarRevision(admin: SupabaseClient, userId: string, adminEmail: string | null): Promise<void> {
  await admin.from("inv_tareas").update({ estado: "hecha", hecha_por: adminEmail, hecha_at: new Date().toISOString() }).eq("user_id", userId).eq("tipo", "revisar_preaprobacion").eq("estado", "pendiente");
}

async function avisar(admin: SupabaseClient, doc: DocumentoInv, deps: DepsRevision, cuerpo: Parameters<DepsRevision["correo"]>[0] extends infer P ? P extends { tipo: "aprobada" } ? Omit<P, "to" | "userId" | "nombre" | "documentoId"> : P extends { tipo: "por_corregir" } ? Omit<P, "to" | "userId" | "nombre" | "documentoId"> : never : never): Promise<boolean> {
  const orden = await ultimaOrdenDe(admin, doc.userId);
  if (!orden?.email || !(await deps.puedeRecibir(orden.email))) return false;
  return deps.correo({ to: orden.email, userId: doc.userId, nombre: orden.nombre, documentoId: doc.id, ...cuerpo } as Parameters<DepsRevision["correo"]>[0]);
}

export async function aprobar(admin: SupabaseClient, adminEmail: string | null, id: string, a: Aprobacion, deps: DepsRevision): Promise<ResultadoRevision> {
  const doc = await documentoPorId(admin, id);
  if (!doc) return { ok: false, error: "no-existe" };
  if (doc.estado !== "en_revision") return { ok: false, error: "estado" };
  const ahora = new Date().toISOString();
  const up = await admin.from(T_DOCS).update({ estado: "aprobada", banco: a.banco, monto_aprobado_uf: a.montoUF, vigente_hasta: a.vigenteHasta, revisado_por: adminEmail, revisado_at: ahora, motivo: null }).eq("id", id).eq("estado", "en_revision");
  if (up.error) return { ok: false, error: "guardar" };
  // El monto aprobado reemplaza la estimación de hasta cuánto puede comprar.
  const perfil = await leerPerfilInv(admin, doc.userId);
  if (perfil) {
    const m = await mercado(admin);
    const tope = hastaCuanto({ preaprobado: perfil.preaprobado, montoPreaprobadoUF: perfil.montoPreaprobadoUF, pieTiene: perfil.pieTiene, pieUF: perfil.pieUF, rentaCLP: perfil.rentaCLP, otrasCuotasCLP: perfil.otrasCuotasCLP, noDiceRenta: perfil.noDiceRenta, tasaPct: m.tasaPct, uf: m.uf, aprobadaUF: a.montoUF });
    const supuestos = { ...(perfil.topeSupuestos ?? {}), ...tope.supuestos, limita: tope.limita, porPieUF: tope.porPieUF, creditoUF: tope.creditoUF, aprobadaUF: a.montoUF, reemplazoPrecioMax: true };
    const p = await admin.from("inv_perfiles").update({ tope_uf: tope.topeUF, tope_fuente: tope.fuente, tope_supuestos: supuestos, updated_at: ahora }).eq("user_id", doc.userId);
    if (p.error) console.error("[inv2] tope aprobado:", p.error.message);
    if (tope.topeUF > 0) await admin.from("perfil_busqueda").update({ precio_max_uf: Math.round(tope.topeUF), actualizado_at: ahora }).eq("user_id", doc.userId);
  }
  await cerrarRevision(admin, doc.userId, adminEmail);
  const correo = await avisar(admin, doc, deps, { tipo: "aprobada", banco: a.banco, montoUF: a.montoUF, vigenteHasta: a.vigenteHasta });
  await anotar(admin, { userId: doc.userId, email: null, actor: "admin", actorEmail: adminEmail, accion: "preaprobacion_aprobada", detalle: { documento: id, banco: a.banco, monto_uf: a.montoUF, vigente_hasta: a.vigenteHasta, correo }, esPrueba: doc.esPrueba });
  return { ok: true, correo };
}

export async function pedirCorregir(admin: SupabaseClient, adminEmail: string | null, id: string, motivo: string, deps: DepsRevision): Promise<ResultadoRevision> {
  const doc = await documentoPorId(admin, id);
  if (!doc) return { ok: false, error: "no-existe" };
  if (doc.estado !== "en_revision") return { ok: false, error: "estado" };
  const up = await admin.from(T_DOCS).update({ estado: "por_corregir", motivo, revisado_por: adminEmail, revisado_at: new Date().toISOString() }).eq("id", id).eq("estado", "en_revision");
  if (up.error) return { ok: false, error: "guardar" };
  await cerrarRevision(admin, doc.userId, adminEmail);
  const correo = await avisar(admin, doc, deps, { tipo: "por_corregir", motivo });
  await anotar(admin, { userId: doc.userId, email: null, actor: "admin", actorEmail: adminEmail, accion: "preaprobacion_por_corregir", detalle: { documento: id, motivo, correo }, esPrueba: doc.esPrueba });
  return { ok: true, correo };
}

/** Al pedir la eliminación de la cuenta: los archivos de la preaprobación salen del bucket. Devuelve cuántos borró. */
export async function borrarArchivosPreaprobacion(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from(T_DOCS).select("path").eq("user_id", userId);
  const rutas = (data ?? []).map((d) => d.path as string | null).filter((r): r is string => !!r);
  if (!rutas.length) return 0;
  const { error } = await admin.storage.from(BUCKET_INVIERTE).remove(rutas);
  if (error) { console.error("[inv2] borrar preaprobaciones:", error.message); return 0; }
  await admin.from(T_DOCS).update({ path: null }).eq("user_id", userId);
  return rutas.length;
}
