/**
 * Reenviar el correo "tu análisis está listo" (Panel admin · Fase 2 · Acción 2).
 *
 *   POST { analisisId } → reenvía el informe al dueño del análisis
 *
 * Pasa por withAdminAction("resend_report") → gate + fila en admin_audit_log con
 * el resultado. A diferencia de las notas, esta acción tiene un efecto EXTERNO e
 * irreversible: el correo sale y no vuelve. De ahí que (a) todos los guards
 * corran en el servidor aunque la UI ya deshabilite el botón, y (b) el envío use
 * la variante que PROPAGA el error — si no, el audit log diría result='ok' sobre
 * un correo que nunca salió.
 *
 * No hay idempotencia: reenviar dos veces manda dos correos. Es una acción
 * manual y deliberada; la memoria de "esto ya se mandó" vive en admin_audit_log
 * y la UI la muestra al lado del botón.
 */

import { withAdminAction, AdminActionError } from "@/lib/admin-audit";
import { sendAnalysisReadyEmailOrThrow } from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";
import { readVeredicto } from "@/lib/results-helpers";
import type { AdminAuditFields } from "@/lib/admin-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AnalisisRow = {
  id: string;
  user_id: string | null;
  nombre: string | null;
  comuna: string | null;
  superficie: number | null;
  score: number | null;
  results: { score?: number; veredicto?: string; francoVerdict?: string; engineSignal?: string } | null;
  tipo_analisis: string | null;
  pending_payment: boolean | null;
  is_premium: boolean | null;
  ambas_group_id: string | null;
  ambas_role: string | null;
};

export async function POST(request: Request) {
  return withAdminAction("resend_report", async ({ sb }) => {
    const body = (await request.json().catch(() => null)) as
      | { analisisId?: unknown }
      | null;
    const analisisId = body?.analisisId;
    if (typeof analisisId !== "string" || !UUID_RE.test(analisisId)) {
      throw new AdminActionError("analisisId inválido", 400, {
        targetType: "analisis",
        meta: { analisisIdRecibido: analisisId ?? null },
      });
    }

    // target_id se puede fijar ya: es un string libre, sin FK.
    const audit: AdminAuditFields = { targetType: "analisis", targetId: analisisId };

    const { data, error } = await sb
      .from("analisis")
      .select(
        "id, user_id, nombre, comuna, superficie, score, results, tipo_analisis, pending_payment, is_premium, ambas_group_id, ambas_role"
      )
      .eq("id", analisisId)
      .maybeSingle();

    if (error) {
      throw new AdminActionError(`No se pudo leer el análisis: ${error.message}`, 500, audit);
    }
    if (!data) {
      throw new AdminActionError("El análisis no existe", 404, audit);
    }
    const row = data as AnalisisRow;

    // ── GUARDS ────────────────────────────────────────────────────────────────
    // Orden deliberado: primero los que hablan del ESTADO DE PAGO (los que
    // mandarían un "tu análisis está listo" de algo no cobrado), después el de
    // plantilla, y al final los datos que faltan para armar el correo.

    if (row.pending_payment === true) {
      throw new AdminActionError(
        "El análisis está pendiente de pago: se computó pero no se cobró. Reenviar anunciaría un informe que el usuario no compró.",
        422,
        { ...audit, targetUserId: row.user_id, meta: { pending_payment: true } }
      );
    }

    if (row.is_premium !== true) {
      throw new AdminActionError(
        "El análisis no está desbloqueado (is_premium=false): el correo llevaría a un informe recortado.",
        422,
        { ...audit, targetUserId: row.user_id, meta: { is_premium: row.is_premium } }
      );
    }

    // STR: sendAnalysisReadyEmail solo tiene plantilla para LTR suelto y para la
    // COMPARATIVA (que se manda desde el lado LTR del par). tipo_analisis null =
    // LTR legacy, mismo criterio que usa el timeline del panel para etiquetar.
    if (row.tipo_analisis === "short-term") {
      const esPar = !!row.ambas_group_id;
      throw new AdminActionError(
        esPar
          ? "Es el lado STR de un par AMBAS: el correo de la comparativa se reenvía desde la fila LTR del par."
          : "No hay plantilla de correo para un análisis STR suelto.",
        422,
        { ...audit, targetUserId: row.user_id, meta: { tipo_analisis: row.tipo_analisis, esPar } }
      );
    }

    if (!row.user_id) {
      throw new AdminActionError(
        "El análisis no tiene usuario asociado: no hay a quién reenviarlo.",
        422,
        audit
      );
    }

    const { data: userData, error: userError } = await sb.auth.admin.getUserById(row.user_id);
    const targetUser = userData?.user ?? null;
    if (userError || !targetUser) {
      throw new AdminActionError("El usuario del análisis no existe", 404, {
        ...audit,
        meta: { userIdNoValidado: row.user_id },
      });
    }
    if (!targetUser.email) {
      throw new AdminActionError("El usuario no tiene email", 422, {
        ...audit,
        targetUserId: row.user_id,
      });
    }

    // Desde acá el target está verificado: la FK de target_user_id no puede fallar.
    const auditFull: AdminAuditFields = {
      ...audit,
      targetUserId: row.user_id,
      targetEmail: targetUser.email,
    };

    // ── DATOS DEL CORREO ──────────────────────────────────────────────────────
    // AMBAS: el hermano STR se resuelve por el group. Sin reintentos — a
    // diferencia del alta, en un reenvío el par ya existe hace rato.
    let ambas: { ltrId: string; strId: string } | undefined;
    if (row.ambas_group_id) {
      const { data: sibling } = await sb
        .from("analisis")
        .select("id")
        .eq("ambas_group_id", row.ambas_group_id)
        .eq("ambas_role", "str")
        .maybeSingle();
      if (sibling?.id) ambas = { ltrId: row.id, strId: sibling.id as string };
    }

    // Mismo armado que /api/analisis (route.ts): título con fallback a
    // "comuna - superficie m²", y veredicto de results con fallback por score.
    const titulo =
      row.nombre?.trim() ||
      (row.comuna && row.superficie ? `${row.comuna} - ${row.superficie}m²` : null) ||
      row.comuna ||
      "tu análisis";
    const score =
      typeof row.score === "number" ? row.score : row.results?.score ?? 0;
    const veredicto =
      readVeredicto(row.results) ||
      (score >= 70 ? "COMPRAR" : score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");
    const nombreUsuario = resolveDisplayName(targetUser.user_metadata, targetUser.email);

    // ── ENVÍO ─────────────────────────────────────────────────────────────────
    // La variante OrThrow propaga: sin API key, rechazo in-band de Resend o error
    // de red terminan acá. Se re-lanza como AdminActionError para que el operador
    // vea el motivo real (un 500 "Error interno" esconde justo lo que necesita).
    let resendId: string | null = null;
    try {
      resendId = await sendAnalysisReadyEmailOrThrow(
        targetUser.email,
        nombreUsuario,
        titulo,
        score,
        veredicto,
        row.id,
        ambas
      );
    } catch (e) {
      throw new AdminActionError(
        `No se pudo enviar el correo: ${e instanceof Error ? e.message : String(e)}`,
        502,
        { ...auditFull, meta: { to: targetUser.email, variante: ambas ? "comparativa" : "ltr" } }
      );
    }

    return {
      data: { to: targetUser.email, variante: ambas ? "comparativa" : "ltr", resendId },
      audit: {
        ...auditFull,
        meta: {
          to: targetUser.email,
          variante: ambas ? "comparativa" : "ltr",
          titulo,
          score,
          veredicto,
          resendId,
        },
      },
    };
  });
}
