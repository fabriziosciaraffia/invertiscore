import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { esEstado } from "@/lib/invierte/invierte";
import { TABLA_INVIERTE } from "@/lib/invierte/invierte-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/invierte (11-nov-2026, «Pronto: Invierte con Franco»): el estado de una inscripción en la lista del panel
// —nuevo, contactado o descartado—. Solo admin. No toca las respuestas de la persona.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const b = (await request.json().catch(() => null)) as { id?: unknown; estado?: unknown } | null;
  if (!b || typeof b.id !== "string" || !UUID.test(b.id) || !esEstado(b.estado)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const { data, error } = await gate.sb.from(TABLA_INVIERTE).update({ estado: b.estado }).eq("id", b.id).select("id, estado").maybeSingle();
  if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  return NextResponse.json({ ok: true, estado: data.estado });
}
