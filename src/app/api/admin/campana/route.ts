import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { guardarGasto } from "@/lib/admin-campana";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/campana (12-nov-2026, campaña de noviembre fase 0): el gasto ingresado a mano de un conjunto (utm_content)
// en una semana de llegada. { clave: "<conjunto>|<lunes>", monto: pesos | null }. Solo admin.
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const b = (await request.json().catch(() => null)) as { clave?: unknown; monto?: unknown } | null;
  const monto = b?.monto === null || b?.monto === "" ? null : Number(b?.monto);
  if (!b || typeof b.clave !== "string" || (monto !== null && (!Number.isFinite(monto) || monto < 0))) return NextResponse.json({ error: "datos" }, { status: 400 });
  // `config` se lee y escribe con la llave de servicio (CONFIG-PUBLICA §6).
  const ok = await guardarGasto(createServiceClient(), b.clave, monto);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "guardar" }, { status: 400 });
}
