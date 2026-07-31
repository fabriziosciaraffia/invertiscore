/**
 * Toggle de acceso ilimitado — Panel admin · Fase 2 · Acción 4.
 *
 *   POST { targetUserId, activar: boolean, motivo }
 *
 * Por withAdminAction("toggle_unlimited") → gate + fila de auditoría con
 * before/after del par (is_unlimited, unlimited_source).
 *
 * POR QUÉ HAY UNA COLUMNA DE PROCEDENCIA. is_unlimited es un booleano pelado, y
 * el cron expire-grace lo apaga en dos barridos. Encender el toggle sobre un
 * ex-suscriptor —el caso más típico para dar cortesía— se revertía solo a las
 * 08:00 del día siguiente. unlimited_source='manual' es lo que hace que el cron
 * (y setPlanFields) lo respeten: una decisión de admin solo la deshace un admin.
 *
 * EL GUARD QUE IMPORTA: apagar un ilimitado de origen 'subscription' mientras la
 * suscripción sigue vigente se RECHAZA. Mismo principio que la reversión de
 * grants — el panel no le quita al usuario lo que está pagando; para eso está el
 * flujo de suscripciones (cancelación en /cuenta o desde Flow).
 */

import { withAdminAction, AdminActionError } from "@/lib/admin-audit";
import type { AdminAuditFields } from "@/lib/admin-audit";
import { hasSubscriptionAccess } from "@/lib/access";
import type { SupabaseClient } from "@supabase/supabase-js";

const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreditsRow = {
  is_unlimited: boolean | null;
  unlimited_source: string | null;
  subscription_status: string | null;
  active_plan: string | null;
  grace_ends_at: string | null;
  subscription_ends_at: string | null;
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new AdminActionError("Body inválido", 400);
  }
  return body as Record<string, unknown>;
}

function requireUuid(value: unknown, campo: string, audit: AdminAuditFields = {}): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new AdminActionError(`${campo} inválido`, 400, audit);
  }
  return value;
}

/** Mismo piso que en grants: el motivo es lo único que explica el estado después. */
function requireMotivo(value: unknown, audit: AdminAuditFields): string {
  if (typeof value !== "string") {
    throw new AdminActionError("El motivo es obligatorio", 400, audit);
  }
  const motivo = value.trim();
  if (motivo.length < MOTIVO_MIN) {
    throw new AdminActionError(
      `El motivo es obligatorio y tiene que decir algo: mínimo ${MOTIVO_MIN} caracteres.`,
      400,
      audit
    );
  }
  if (motivo.length > MOTIVO_MAX) {
    throw new AdminActionError(
      `El motivo supera el máximo de ${MOTIVO_MAX} caracteres`,
      400,
      audit
    );
  }
  return motivo;
}

async function requireTargetUser(
  sb: SupabaseClient,
  targetUserId: string
): Promise<string | null> {
  const { data, error } = await sb.auth.admin.getUserById(targetUserId);
  if (error || !data?.user) {
    throw new AdminActionError("Usuario no encontrado", 404, {
      targetType: "user",
      meta: { targetUserIdRecibido: targetUserId },
    });
  }
  return data.user.email ?? null;
}

export async function POST(request: Request) {
  return withAdminAction("toggle_unlimited", async ({ sb }) => {
    const body = await readBody(request);
    const targetUserId = requireUuid(body.targetUserId, "targetUserId", {
      targetType: "user",
      meta: { targetUserIdRecibido: body.targetUserId ?? null },
    });

    // Existencia PRIMERO: así toda fila de error de acá en adelante queda colgada
    // del usuario correcto y entra al índice (target_user_id, created_at).
    const targetEmail = await requireTargetUser(sb, targetUserId);
    const audit: AdminAuditFields = {
      targetUserId,
      targetEmail,
      targetType: "user",
      targetId: targetUserId,
    };

    if (typeof body.activar !== "boolean") {
      throw new AdminActionError("Falta indicar si se enciende o se apaga", 400, {
        ...audit,
        meta: { activarRecibido: body.activar ?? null },
      });
    }
    const activar = body.activar;

    const motivo = requireMotivo(body.motivo, {
      ...audit,
      meta: {
        activar,
        motivoPedido: typeof body.motivo === "string" ? body.motivo : null,
      },
    });

    const { data, error } = await sb
      .from("user_credits")
      .select(
        "is_unlimited, unlimited_source, subscription_status, active_plan, grace_ends_at, subscription_ends_at"
      )
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (error) {
      throw new AdminActionError(`No se pudo leer user_credits: ${error.message}`, 500, {
        ...audit,
        meta: { activar, motivo },
      });
    }
    if (!data) {
      throw new AdminActionError(
        "El usuario no tiene fila en user_credits (nunca pasó por el flujo de créditos): no hay nada que togglear todavía.",
        422,
        { ...audit, meta: { activar, motivo } }
      );
    }

    const row = data as CreditsRow;
    const before = {
      is_unlimited: row.is_unlimited === true,
      unlimited_source: row.unlimited_source,
    };
    const auditConEstado: AdminAuditFields = {
      ...audit,
      before,
      meta: { activar, motivo },
    };

    // Sin cambio real: no se escribe ni se inventa un evento de auditoría "ok"
    // sobre algo que no pasó.
    if (before.is_unlimited === activar) {
      throw new AdminActionError(
        activar
          ? "El usuario ya tiene acceso ilimitado."
          : "El usuario no tiene acceso ilimitado.",
        409,
        auditConEstado
      );
    }

    // GUARD · apagar lo que el usuario paga. Solo aplica al origen 'subscription'
    // con la suscripción todavía vigente (activa, en gracia, o cancelada dentro
    // del ciclo pagado). Un 'subscription' ya vencido sí se puede apagar a mano:
    // ahí el panel está limpiando lo que el cron todavía no barrió.
    if (!activar && before.unlimited_source === "subscription" && hasSubscriptionAccess(row)) {
      throw new AdminActionError(
        `El ilimitado viene de una suscripción vigente (${row.active_plan ?? "plan"}, estado ${row.subscription_status ?? "—"}): no se apaga desde el panel. Si el usuario quiere darla de baja, va por el flujo de suscripciones; si el cobro falló, el cron lo resuelve al vencer la gracia.`,
        422,
        auditConEstado
      );
    }

    // Encender → siempre queda como 'manual' (es lo que protege del cron).
    // Apagar → limpia la procedencia junto con el flag.
    const after = {
      is_unlimited: activar,
      unlimited_source: activar ? "manual" : null,
    };

    // UPDATE condicional sobre is_unlimited: si el flag cambió entremedio (el
    // cron, un alta de suscripción), no pisamos el estado nuevo a ciegas.
    const { data: updated, error: updError } = await sb
      .from("user_credits")
      .update({ ...after, updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
      .eq("is_unlimited", before.is_unlimited)
      .select("user_id")
      .maybeSingle();

    if (updError || !updated) {
      throw new AdminActionError(
        updError
          ? `No se pudo actualizar el ilimitado: ${updError.message}`
          : "El estado cambió mientras se aplicaba el toggle. Vuelve a mirarlo antes de reintentar.",
        409,
        auditConEstado
      );
    }

    return {
      data: { isUnlimited: after.is_unlimited, unlimitedSource: after.unlimited_source },
      audit: { ...auditConEstado, after },
    };
  });
}
