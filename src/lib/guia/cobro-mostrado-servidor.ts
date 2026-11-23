// ─────────────────────────────────────────────────────────────────────────────
// EL RESPALDO DEL COBRO, EN LA BASE (23-nov-2026, regla en cobro-mostrado.ts): el informe salió con otro veredicto que lo mostrado y
// nadie le avisó → un crédito nuevo, sin vencimiento, con fuente `devolucion_cobro`, y una fila en el registro del admin
// (`admin_audit_log`, acción `grant_credits`, `meta.automatica = true`). La tabla pide un admin que actúe (FK a auth.users y un CHECK
// sobre la acción): la fila va a nombre de la primera cuenta de ADMIN_EMAIL, que es quien decidió la regla, y `meta` dice que la
// hizo el sistema. Agregar una acción propia es una migración aparte.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantCredits } from "@/lib/credits-grant";
import { FUENTE_DEVOLUCION_COBRO } from "@/lib/access-devolucion";
import type { MarcaCambio } from "./cobro-mostrado";

let adminCache: { id: string; email: string } | null = null;

async function cuentaAdmin(admin: SupabaseClient): Promise<{ id: string; email: string } | null> {
  if (adminCache) return adminCache;
  const email = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)[0];
  if (!email) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
    if (u) return (adminCache = { id: u.id, email });
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Devuelve el crédito y deja la fila del admin. El id del lote, o null si el lote no se pudo otorgar. */
export async function devolverCobroPorCambio(
  admin: SupabaseClient,
  p: { userId: string; userEmail: string | null; analysisId: string; avisoId: string; marca: MarcaCambio; desde: string },
): Promise<string | null> {
  const grantId = await grantCredits(p.userId, FUENTE_DEVOLUCION_COBRO, 1, { noExpire: true });
  if (!grantId) return null;
  const quien = await cuentaAdmin(admin).catch(() => null);
  if (quien) {
    const { error } = await admin.from("admin_audit_log").insert({
      admin_user_id: quien.id,
      admin_email: quien.email,
      action: "grant_credits",
      target_user_id: p.userId,
      target_email: p.userEmail,
      target_type: "credit_grant",
      target_id: grantId,
      after: { source: FUENTE_DEVOLUCION_COBRO, amount: 1, remaining: 1, expires_at: null },
      meta: {
        automatica: true,
        motivo: "El informe salió con otro veredicto que el mostrado, sin aviso previo (cobro-mostrado.ts).",
        analisis: p.analysisId,
        aviso: p.avisoId,
        desde: p.desde,
        mostrado: p.marca.mostrado,
        informe: p.marca.hoy,
      },
      result: "ok",
    });
    if (error) console.error("[cobro-mostrado] la fila del admin no quedó (el lote sí):", error.message);
  } else {
    console.error("[cobro-mostrado] sin cuenta de admin para la fila del registro (el lote sí):", grantId);
  }
  return grantId;
}
