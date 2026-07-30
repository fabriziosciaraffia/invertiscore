/**
 * Audit log de acciones de admin (Panel admin · Fase 2 · Paso 0).
 *
 * Somos DOS operadores: sin registro de quién ejecutó qué, cualquier acción de
 * escritura es anónima y las colisiones entre operadores son indetectables. Este
 * módulo es la única puerta por la que pasan las acciones de escritura del panel.
 *
 * Contrato de `withAdminAction`:
 *   1. Gate (requireAdmin). Si no hay admin → 403 y NO se audita: no hay
 *      operador que registrar, y un log escribible por cualquiera sería ruido
 *      (o peor, un vector de flood).
 *   2. Corre la operación.
 *   3. Escribe la fila de auditoría CON EL RESULTADO — después, nunca antes.
 *      Los intentos FALLIDOS también quedan registrados (result='error' +
 *      error_mensaje): un reenvío que rebotó o un grant que chocó es
 *      exactamente lo que se va a querer ver cuando dos operadores se pisen.
 *
 * LÍMITE CONOCIDO (deliberado): el insert del log es best-effort. Supabase JS no
 * expone transacciones, así que no se puede atar "la acción ocurrió" a "el log
 * se escribió". Si el insert falla, la acción YA pasó → no tiene sentido
 * devolver error al operador (lo llevaría a reintentar y duplicar el efecto).
 * Se loguea con console.error incluyendo el payload completo, que queda
 * recuperable desde los logs de Vercel. Es el mismo criterio con el que la
 * emisión de boletas nunca rompe el 200 a Flow.
 */

import { NextResponse } from "next/server";
import { requireAdmin, type AdminContext } from "@/lib/admin-auth";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Las 6 acciones de escritura de Fase 2. Espeja el CHECK de la columna
 * admin_audit_log.action (20260729_admin_audit_log_y_notas.sql): si se agrega
 * una acción hay que tocar los DOS lados.
 *
 * Solo note_* están implementadas en este paso; las otras tres quedan
 * declaradas para que las acciones siguientes no tengan que migrar el CHECK.
 */
export type AdminAuditAction =
  | "resend_report"
  | "note_add"
  | "note_edit"
  | "note_delete"
  | "grant_credits"
  | "toggle_unlimited";

/** Tipo de objeto sobre el que actuó el admin (columna target_type). */
export type AdminAuditTargetType =
  | "user"
  | "analisis"
  | "credit_grant"
  | "admin_nota";

/**
 * Qué registrar de esta acción.
 *
 * `targetUserId` es SIEMPRE el usuario del que se trata la acción (el índice
 * (target_user_id, created_at DESC) responde "qué se le hizo a este usuario"),
 * mientras que targetType/targetId apuntan al objeto concreto afectado — para
 * una nota: targetUserId = el usuario de la ficha, targetId = el id de la nota.
 *
 * `targetEmail` es un SNAPSHOT: la FK es ON DELETE SET NULL, así que cuando el
 * usuario se borra el email es lo único que queda para leer la fila.
 *
 * `before`/`after` llevan SOLO los campos tocados, no la fila entera: volcar
 * todo mete PII innecesaria y hace el diff ilegible.
 */
export type AdminAuditFields = {
  targetUserId?: string | null;
  targetEmail?: string | null;
  targetType?: AdminAuditTargetType | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Payload de entrada / contexto (motivo, monto, destinatario). */
  meta?: unknown;
};

/** Lo que devuelve la operación: respuesta al cliente + qué auditar. */
export type AdminActionResult = {
  /** Campos extra del JSON de respuesta (se mezclan con { ok: true }). */
  data?: Record<string, unknown>;
  /** HTTP status del camino feliz. Default 200. */
  status?: number;
  audit: AdminAuditFields;
};

/**
 * Fallo CONTROLADO de una acción: fija el status HTTP, expone su `message` al
 * cliente (es copy pensado para el operador) y aporta los campos de auditoría
 * que se conozcan hasta el punto de la falla.
 *
 * Cualquier otra excepción se trata como fallo inesperado: 500 + mensaje
 * genérico al cliente, mensaje real solo en el log.
 */
export class AdminActionError extends Error {
  readonly status: number;
  readonly audit: AdminAuditFields;

  constructor(message: string, status = 400, audit: AdminAuditFields = {}) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
    this.audit = audit;
  }
}

type AuditRow = AdminAuditFields & {
  action: AdminAuditAction;
  result: "ok" | "error";
  errorMensaje?: string | null;
};

/**
 * Mezcla claves extra en `meta` sin asumir que meta es un objeto (es `unknown`:
 * cada acción decide qué mandar).
 */
function metaConExtra(
  meta: unknown,
  extra: Record<string, unknown>
): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return { ...(meta as Record<string, unknown>), ...extra };
  }
  return meta == null ? extra : { valor: meta, ...extra };
}

/**
 * Inserta la fila de auditoría. NUNCA lanza: la acción ya ocurrió y un fallo del
 * log no puede convertirse en un error que invite a reintentar.
 *
 * RED DE SEGURIDAD FK (23503): target_user_id tiene FK a auth.users, así que una
 * fila que arrastre un id INEXISTENTE se rechaza y la fila se pierde — justo el
 * caso de los errores tipo "usuario no encontrado", que son los que MÁS importa
 * registrar. Ante 23503 se reintenta con target_user_id NULL y el id crudo en
 * meta: la fila de auditoría vale más que la referencia. Verificado contra la DB
 * (insert con id inexistente → 23503; el mismo insert con NULL + meta → entra).
 */
async function writeAuditRow(
  sb: SupabaseClient,
  adminUser: User,
  row: AuditRow
): Promise<void> {
  const payload = {
    admin_user_id: adminUser.id,
    admin_email: adminUser.email ?? "",
    action: row.action,
    target_user_id: row.targetUserId ?? null,
    target_email: row.targetEmail ?? null,
    target_type: row.targetType ?? null,
    target_id: row.targetId ?? null,
    before: row.before ?? null,
    after: row.after ?? null,
    meta: row.meta ?? null,
    result: row.result,
    error_mensaje: row.errorMensaje ?? null,
  };

  try {
    const { error } = await sb.from("admin_audit_log").insert(payload);
    if (!error) return;

    // 23503 = foreign_key_violation. El único candidato es target_user_id (el
    // admin siempre existe): reintento con NULL y el id preservado en meta.
    if (error.code === "23503" && payload.target_user_id) {
      const { error: retryError } = await sb.from("admin_audit_log").insert({
        ...payload,
        target_user_id: null,
        meta: metaConExtra(payload.meta, {
          target_user_id_no_valido: payload.target_user_id,
        }),
      });
      if (!retryError) return;
      console.error(
        "[admin-audit] reintento sin FK también falló — acción SIN registrar:",
        retryError.message,
        JSON.stringify(payload)
      );
      return;
    }

    // Payload completo en el log: es la única copia que queda de la acción.
    console.error(
      "[admin-audit] insert falló — acción SIN registrar:",
      error.message,
      JSON.stringify(payload)
    );
  } catch (e) {
    console.error(
      "[admin-audit] excepción escribiendo el log — acción SIN registrar:",
      e instanceof Error ? e.message : String(e),
      JSON.stringify(payload)
    );
  }
}

/**
 * Envuelve una acción de escritura de admin: gate → operación → auditoría.
 *
 *   export async function POST(request: Request) {
 *     return withAdminAction("note_add", async ({ sb }) => {
 *       // ...validar y escribir; lanzar AdminActionError para cortar
 *       return { data: { nota }, audit: { targetUserId, targetType: "admin_nota" } };
 *     });
 *   }
 */
export async function withAdminAction(
  action: AdminAuditAction,
  run: (ctx: AdminContext) => Promise<AdminActionResult>
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { adminUser, sb } = gate;

  try {
    const outcome = await run({ adminUser, sb });
    await writeAuditRow(sb, adminUser, {
      action,
      result: "ok",
      ...outcome.audit,
    });
    return NextResponse.json(
      { ok: true, ...(outcome.data ?? {}) },
      { status: outcome.status ?? 200 }
    );
  } catch (e) {
    const controlled = e instanceof AdminActionError;
    const realMessage = e instanceof Error ? e.message : String(e);

    await writeAuditRow(sb, adminUser, {
      action,
      result: "error",
      errorMensaje: realMessage,
      ...(controlled ? e.audit : {}),
    });

    if (!controlled) {
      console.error(`[withAdminAction] ${action} falló inesperadamente:`, e);
    }

    return NextResponse.json(
      { ok: false, error: controlled ? realMessage : "Error interno" },
      { status: controlled ? e.status : 500 }
    );
  }
}
