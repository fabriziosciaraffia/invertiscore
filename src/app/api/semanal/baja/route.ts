import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";

// ─────────────────────────────────────────────────────────────────────────────
// Dejar de recibir el correo semanal (02-oct-2026), con un clic y sin entrar: el token del correo basta.
// GET desde el enlace del pie; POST desde el «List-Unsubscribe» de un clic (Gmail, iPhone Mail).
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = /^[0-9a-f]{20,80}$/i;

async function darDeBaja(t: string): Promise<boolean> {
  if (!TOKEN.test(t)) return false;
  const admin = createServiceClient();
  const { data: sel } = await admin.from("semanal_selecciones").select("user_id").eq("token", t).maybeSingle();
  if (!sel) return false;
  const userId = sel.user_id as string;
  const { error } = await admin.from("perfil_busqueda").upsert({ user_id: userId, semanal_baja_at: new Date().toISOString() }, { onConflict: "user_id" });
  reportarFalloQuery(error, { ruta: "api/semanal/baja", operacion: "baja", userId });
  if (error) return false;
  void capturarServidor({ event: "semanal_baja", distinctId: userId, properties: {} }).catch(() => {});
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = await darDeBaja(url.searchParams.get("t") ?? "");
  return NextResponse.redirect(new URL(`/semanal/baja${ok ? "" : "?error=1"}`, url.origin), 302);
}

export async function POST(request: Request) {
  const ok = await darDeBaja(new URL(request.url).searchParams.get("t") ?? "");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
