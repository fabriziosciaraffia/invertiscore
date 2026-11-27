import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { olvidarAccesoAsesoria } from "@/lib/asesoria/acceso-servidor";
import { TABLA_ACCESO_ASESORIA } from "@/lib/asesoria/acceso";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/asesoria { accion: "habilitar" | "quitar", nota? } (27-nov-2026): «Habilitar este dispositivo» para probar la
// asesoría SIN CUENTA mientras está en «lista»: guarda el hash de la cookie franco_disp del navegador desde donde se toca (el mismo
// hash que lee el interruptor). Sin enlaces: se habilita el navegador donde se está, se cierra sesión y se prueba ahí. Solo admin.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const b = (await request.json().catch(() => ({}))) as { accion?: unknown; nota?: unknown };
  const disp = huellaDeRequest(request).dispositivo;
  if (!disp) return NextResponse.json({ error: "sin-dispositivo" }, { status: 400 });
  if (b.accion === "habilitar") {
    const nota = typeof b.nota === "string" && b.nota.trim() ? b.nota.trim().slice(0, 80) : "Sin nota";
    const { error } = await gate.sb.from(TABLA_ACCESO_ASESORIA).upsert({ dispositivo_hash: disp, nota, creado_por: gate.adminUser.id }, { onConflict: "dispositivo_hash" });
    if (error) return NextResponse.json({ error: "interno" }, { status: 500 });
  } else if (b.accion === "quitar") {
    const { error } = await gate.sb.from(TABLA_ACCESO_ASESORIA).delete().eq("dispositivo_hash", disp);
    if (error) return NextResponse.json({ error: "interno" }, { status: 500 });
  } else {
    return NextResponse.json({ error: "accion" }, { status: 400 });
  }
  olvidarAccesoAsesoria();
  return NextResponse.json({ ok: true });
}
