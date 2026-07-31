/**
 * Notas internas de admin sobre un usuario (Panel admin · Fase 2 · Acción 1).
 *
 *   POST   { targetUserId, texto }  → crear
 *   PATCH  { notaId, texto }        → editar
 *   DELETE { notaId }               → borrar (SOFT: sella deleted_at)
 *
 * Las tres pasan por withAdminAction → gate de admin + fila en admin_audit_log
 * con el resultado (incluidos los intentos fallidos).
 *
 * Route handler y NO Server Action en la page: la SUPABASE_SERVICE_ROLE_KEY se
 * queda del lado de las rutas, lejos de cualquier archivo que un refactor pueda
 * convertir en componente de cliente.
 *
 * Quién puede editar/borrar: CUALQUIER admin puede tocar la nota de cualquier
 * otro. Somos dos operadores sin jerarquía entre ellos, y el rastro de quién
 * editó/borró queda en admin_audit_log — restringir por autor daría notas
 * huérfanas sin ganar nada.
 */

import {
  withAdminAction,
  AdminActionError,
  type AdminAuditFields,
} from "@/lib/admin-audit";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tope de la nota. Suficiente para contexto real, corto para que no sea un doc. */
const TEXTO_MAX = 2000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NotaRow = {
  id: string;
  target_user_id: string;
  autor_email: string;
  texto: string;
  deleted_at: string | null;
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new AdminActionError("Body inválido", 400);
  }
  return body as Record<string, unknown>;
}

/** UUID bien formado. Sin esto, un id basura estalla como 22P02 (500) en vez de 400. */
function requireUuid(value: unknown, campo: string, audit: AdminAuditFields = {}): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new AdminActionError(`${campo} inválido`, 400, audit);
  }
  return value;
}

/**
 * `audit` lleva el contexto de lo que se INTENTÓ (a quién y con qué largo de
 * texto): sin eso, la fila de error dice "la nota no puede estar vacía" sin
 * decir nunca sobre qué usuario.
 */
function requireTexto(value: unknown, audit: AdminAuditFields = {}): string {
  if (typeof value !== "string") {
    throw new AdminActionError("El texto de la nota es obligatorio", 400, audit);
  }
  const texto = value.trim();
  if (!texto) {
    throw new AdminActionError("La nota no puede estar vacía", 400, audit);
  }
  if (texto.length > TEXTO_MAX) {
    throw new AdminActionError(
      `La nota supera el máximo de ${TEXTO_MAX} caracteres`,
      400,
      audit
    );
  }
  return texto;
}

/**
 * El usuario destino tiene que existir ANTES de escribir. El service role
 * bypassea RLS, así que un target_user_id equivocado escribiría igual: esta
 * validación es la red de contención. Devuelve el email para el snapshot de
 * auditoría.
 *
 * El id NO validado va en `meta`, NUNCA en targetUserId: esa columna tiene FK a
 * auth.users, así que una fila de error arrastrando un id inexistente se
 * rechazaba con 23503 y la auditoría se perdía en silencio — precisamente en el
 * error que más importa registrar. (admin-audit.ts tiene además una red de
 * seguridad para el mismo caso; esto lo evita en origen.)
 */
async function requireTargetUser(
  sb: SupabaseClient,
  targetUserId: string
): Promise<string | null> {
  const { data, error } = await sb.auth.admin.getUserById(targetUserId);
  if (error || !data?.user) {
    throw new AdminActionError("Usuario no encontrado", 404, {
      targetType: "user",
      meta: { targetUserIdNoValidado: targetUserId },
    });
  }
  return data.user.email ?? null;
}

/** Nota viva (no borrada) + email del usuario dueño de la ficha, para auditoría. */
async function readNotaViva(
  sb: SupabaseClient,
  notaId: string
): Promise<{ nota: NotaRow; targetEmail: string | null }> {
  const { data, error } = await sb
    .from("admin_notas")
    .select("id, target_user_id, autor_email, texto, deleted_at")
    .eq("id", notaId)
    .maybeSingle();

  if (error) {
    throw new AdminActionError("No se pudo leer la nota", 500, {
      targetType: "admin_nota",
      targetId: notaId,
    });
  }
  if (!data) {
    throw new AdminActionError("Nota no encontrada", 404, {
      targetType: "admin_nota",
      targetId: notaId,
    });
  }

  const nota = data as NotaRow;
  if (nota.deleted_at) {
    throw new AdminActionError("La nota ya está borrada", 409, {
      targetUserId: nota.target_user_id,
      targetType: "admin_nota",
      targetId: notaId,
    });
  }

  // Best-effort: si el lookup falla el snapshot queda null, no rompe la acción.
  const { data: userData } = await sb.auth.admin.getUserById(nota.target_user_id);
  return { nota, targetEmail: userData?.user?.email ?? null };
}

/** Campos de auditoría comunes a las 3 acciones sobre una nota. */
function notaAudit(
  targetUserId: string,
  targetEmail: string | null,
  notaId: string
): AdminAuditFields {
  return {
    targetUserId,
    targetEmail,
    targetType: "admin_nota",
    targetId: notaId,
  };
}

// ── CREAR ────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  return withAdminAction("note_add", async ({ adminUser, sb }) => {
    const body = await readBody(request);
    const targetUserId = requireUuid(body.targetUserId, "targetUserId", {
      targetType: "admin_nota",
      meta: { targetUserIdRecibido: body.targetUserId ?? null },
    });

    // ORDEN: existencia del usuario PRIMERO, validación del texto después. Al
    // revés, un texto vacío sobre un usuario válido dejaba la fila de error con
    // target_user_id NULL — fuera del índice por el que se consulta su historial.
    const targetEmail = await requireTargetUser(sb, targetUserId);
    const texto = requireTexto(body.texto, {
      targetUserId,
      targetEmail,
      targetType: "admin_nota",
      meta: { largoRecibido: typeof body.texto === "string" ? body.texto.length : null },
    });

    const { data, error } = await sb
      .from("admin_notas")
      .insert({
        target_user_id: targetUserId,
        autor_user_id: adminUser.id,
        autor_email: adminUser.email ?? "",
        texto,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      throw new AdminActionError(
        `No se pudo guardar la nota: ${error?.message ?? "sin fila"}`,
        500,
        { targetUserId, targetEmail, targetType: "admin_nota" }
      );
    }

    return {
      data: { notaId: data.id },
      status: 201,
      audit: {
        ...notaAudit(targetUserId, targetEmail, data.id),
        after: { texto },
      },
    };
  });
}

// ── EDITAR ───────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  return withAdminAction("note_edit", async ({ sb }) => {
    const body = await readBody(request);
    const notaId = requireUuid(body.notaId, "notaId", {
      targetType: "admin_nota",
      meta: { notaIdRecibido: body.notaId ?? null },
    });

    // Mismo orden que en POST: primero se resuelve la nota (que es la que
    // aporta el target_user_id), después se valida el texto nuevo.
    const { nota, targetEmail } = await readNotaViva(sb, notaId);
    const audit = notaAudit(nota.target_user_id, targetEmail, notaId);
    const texto = requireTexto(body.texto, {
      ...audit,
      meta: { largoRecibido: typeof body.texto === "string" ? body.texto.length : null },
    });

    if (texto === nota.texto) {
      throw new AdminActionError("La nota no cambió", 400, audit);
    }

    // Condicional sobre deleted_at: si otro operador la borró entremedio, el
    // UPDATE no matchea y no resucitamos una nota borrada.
    const { data, error } = await sb
      .from("admin_notas")
      .update({ texto, updated_at: new Date().toISOString() })
      .eq("id", notaId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new AdminActionError(
        `No se pudo editar la nota: ${error?.message ?? "borrada por otro operador"}`,
        409,
        audit
      );
    }

    return {
      audit: { ...audit, before: { texto: nota.texto }, after: { texto } },
    };
  });
}

// ── BORRAR (soft) ────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  return withAdminAction("note_delete", async ({ sb }) => {
    const body = await readBody(request);
    const notaId = requireUuid(body.notaId, "notaId", {
      targetType: "admin_nota",
      meta: { notaIdRecibido: body.notaId ?? null },
    });

    const { nota, targetEmail } = await readNotaViva(sb, notaId);
    const audit = notaAudit(nota.target_user_id, targetEmail, notaId);

    const deletedAt = new Date().toISOString();
    const { data, error } = await sb
      .from("admin_notas")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", notaId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new AdminActionError(
        `No se pudo borrar la nota: ${error?.message ?? "borrada por otro operador"}`,
        409,
        audit
      );
    }

    return {
      audit: {
        ...audit,
        // El texto se conserva en la fila (soft delete); acá queda para que la
        // auditoría sea legible sin ir a buscarlo.
        before: { deleted_at: null, texto: nota.texto },
        after: { deleted_at: deletedAt },
      },
    };
  });
}
