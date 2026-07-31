/**
 * Otorgar (y revertir) análisis a un usuario — Panel admin · Fase 2 · Acción 3.
 *
 *   POST   { targetUserId, cantidad, motivo } → otorga un lote al ledger
 *   DELETE { grantId, motivo? }               → revierte un lote INTACTO
 *
 * Ambas por withAdminAction("grant_credits"); la reversión se distingue por
 * meta.reversion = true.
 *
 * Es la primera acción del panel que mueve algo equivalente a DINERO: un lote
 * otorgado es saldo real que el usuario puede gastar. De ahí el tope por acción,
 * el motivo obligatorio y una reversión que solo aplica mientras nadie tocó el
 * lote.
 *
 * El lote va con payment_id NULL y sin caducidad:
 *  - NULL no choca con uq_credit_grants_payment_id (índice PARCIAL, solo cuenta
 *    cuando payment_id NOT NULL) y ya es un caso de producción — el cron
 *    monthly-grants otorga así los meses 2-12 de los planes anuales.
 *  - noExpire da paridad con la compra individual ('single', que también nace
 *    sin caducidad): un análisis regalado no debería caducar antes que uno
 *    comprado. Como el FIFO ordena por expires_at con los NULL al final, el
 *    usuario gasta primero lo que sí vence.
 */

import { withAdminAction, AdminActionError } from "@/lib/admin-audit";
import type { AdminAuditFields } from "@/lib/admin-audit";
import { grantCredits } from "@/lib/credits-grant";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tope por acción. No es un límite del sistema: es un freno al dedo gordo. */
const CANTIDAD_MAX = 20;
const CANTIDAD_MIN = 1;
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;

/** source de los lotes manuales. Es lo que separa lo regalado de lo comprado. */
const SOURCE_ADMIN = "admin_grant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GrantRow = {
  id: string;
  user_id: string;
  source: string;
  amount: number;
  remaining: number;
  consumed: boolean;
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

/** Entero dentro del rango. Rechaza decimales y strings numéricos ambiguos. */
function requireCantidad(value: unknown, audit: AdminAuditFields): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) {
    throw new AdminActionError("La cantidad tiene que ser un número entero", 400, audit);
  }
  if (n < CANTIDAD_MIN || n > CANTIDAD_MAX) {
    throw new AdminActionError(
      `La cantidad tiene que estar entre ${CANTIDAD_MIN} y ${CANTIDAD_MAX} por acción. Para más, repetí la operación y queda registrada por separado.`,
      400,
      audit
    );
  }
  return n;
}

/**
 * El motivo es obligatorio y con piso de largo: es lo único que responde "¿por
 * qué este usuario tiene 5 análisis que no pagó?" tres meses después.
 */
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

/** Motivo OPCIONAL (reversión). Devuelve null si no vino. */
function optionalMotivo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const motivo = value.trim();
  return motivo ? motivo.slice(0, MOTIVO_MAX) : null;
}

/**
 * El usuario destino tiene que existir ANTES de escribir: el service role
 * bypassea RLS, así que un id equivocado otorgaría igual. El id sin validar va
 * en meta y NUNCA en targetUserId — esa columna tiene FK a auth.users y una fila
 * de error con un id inexistente se pierde con 23503.
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

// ── OTORGAR ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  return withAdminAction("grant_credits", async ({ sb }) => {
    const body = await readBody(request);
    const targetUserId = requireUuid(body.targetUserId, "targetUserId");

    // Cantidad y motivo se validan antes de tocar la DB, pero DESPUÉS de tener
    // el id: así la fila de error ya dice de qué usuario se trataba.
    const auditPre: AdminAuditFields = {
      targetType: "credit_grant",
      meta: { targetUserIdNoValidado: targetUserId },
    };
    const cantidad = requireCantidad(body.cantidad, auditPre);
    const motivo = requireMotivo(body.motivo, auditPre);

    const targetEmail = await requireTargetUser(sb, targetUserId);
    // Desde acá el usuario está verificado: la FK de target_user_id no falla.
    const audit: AdminAuditFields = {
      targetUserId,
      targetEmail,
      targetType: "credit_grant",
    };

    const grantId = await grantCredits(targetUserId, SOURCE_ADMIN, cantidad, {
      noExpire: true,
    });

    if (!grantId) {
      throw new AdminActionError(
        "No se pudo otorgar el lote (el insert al ledger falló). Revisá los logs.",
        500,
        { ...audit, meta: { cantidad, motivo } }
      );
    }

    return {
      data: { grantId, cantidad },
      status: 201,
      audit: {
        ...audit,
        targetId: grantId,
        after: { source: SOURCE_ADMIN, amount: cantidad, remaining: cantidad, expires_at: null },
        meta: { cantidad, motivo },
      },
    };
  });
}

// ── REVERTIR ─────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  return withAdminAction("grant_credits", async ({ sb }) => {
    const body = await readBody(request);
    const auditBase: AdminAuditFields = {
      targetType: "credit_grant",
      meta: { reversion: true },
    };
    const grantId = requireUuid(body.grantId, "grantId", auditBase);
    const motivo = optionalMotivo(body.motivo);

    const { data, error } = await sb
      .from("credit_grants")
      .select("id, user_id, source, amount, remaining, consumed")
      .eq("id", grantId)
      .maybeSingle();

    if (error) {
      throw new AdminActionError(`No se pudo leer el lote: ${error.message}`, 500, {
        ...auditBase,
        targetId: grantId,
      });
    }
    if (!data) {
      throw new AdminActionError("El lote no existe", 404, {
        ...auditBase,
        targetId: grantId,
      });
    }
    const grant = data as GrantRow;

    const audit: AdminAuditFields = {
      targetUserId: grant.user_id,
      targetType: "credit_grant",
      targetId: grantId,
      meta: { reversion: true, motivo, source: grant.source },
    };

    // Guard 1 · Solo lotes MANUALES. Un lote 'single' o de plan es algo que el
    // usuario PAGÓ: revertirlo desde el panel sería quitarle lo comprado. Si hay
    // que ajustar un lote pagado, eso pasa por el flujo de pagos, no por acá.
    if (grant.source !== SOURCE_ADMIN) {
      throw new AdminActionError(
        `Este lote no es un otorgamiento manual (source='${grant.source}'): es saldo que el usuario pagó y no se revierte desde el panel.`,
        422,
        audit
      );
    }

    // Guard 2 · Solo lotes INTACTOS. Si el usuario ya gastó algo, revertir le
    // sacaría saldo que ya usó y dejaría el ledger inconsistente con lo que vio.
    if (grant.remaining !== grant.amount) {
      const usados = grant.amount - grant.remaining;
      throw new AdminActionError(
        grant.remaining === 0
          ? `El lote ya no tiene saldo (consumido o revertido antes): no hay nada que revertir. Si necesitás dejar constancia, agregá una nota interna en la ficha del usuario.`
          : `El usuario ya consumió ${usados} de ${grant.amount} análisis de este lote, así que no se puede revertir. Dejá una nota interna en su ficha explicando el ajuste.`,
        422,
        { ...audit, before: { amount: grant.amount, remaining: grant.remaining } }
      );
    }

    // UPDATE condicional sobre remaining: si el usuario consumió entre el SELECT
    // y el UPDATE, no matchea y no le sacamos un crédito que ya estaba usando.
    // No se borra la fila: el lote revertido queda como historia.
    const { data: updated, error: updError } = await sb
      .from("credit_grants")
      .update({ remaining: 0, consumed: true })
      .eq("id", grantId)
      .eq("remaining", grant.amount)
      .select("id")
      .maybeSingle();

    if (updError || !updated) {
      throw new AdminActionError(
        updError
          ? `No se pudo revertir el lote: ${updError.message}`
          : "El lote cambió mientras se revertía (el usuario consumió un análisis). Volvé a mirarlo.",
        409,
        audit
      );
    }

    return {
      data: { grantId, revertidos: grant.amount },
      audit: {
        ...audit,
        before: { remaining: grant.amount, consumed: false },
        after: { remaining: 0, consumed: true },
        meta: { reversion: true, motivo, source: grant.source, revertidos: grant.amount },
      },
    };
  });
}
