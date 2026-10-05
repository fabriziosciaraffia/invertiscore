import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";

// ─────────────────────────────────────────────────────────────────────────────
// Dejar de recibir los avisos inmediatos (05-oct-2026), con un clic y sin entrar: el token del aviso
// basta. NO toca el semanal (`semanal_baja_at`). GET desde el pie; POST desde el List-Unsubscribe.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = /^[0-9a-f]{20,80}$/i;

async function darDeBaja(t: string): Promise<boolean> {
  if (!TOKEN.test(t)) return false;
  const admin = createServiceClient();
  const { data: aviso } = await admin.from("avisos_inmediatos").select("user_id").eq("token", t).maybeSingle();
  if (!aviso) return false;
  const userId = aviso.user_id as string;
  const { error } = await admin.from("perfil_busqueda").upsert({ user_id: userId, inmediato_baja_at: new Date().toISOString() }, { onConflict: "user_id" });
  reportarFalloQuery(error, { ruta: "api/inmediato/baja", operacion: "baja", userId });
  if (error) return false;
  void capturarServidor({ event: "aviso_inmediato_baja", distinctId: userId, properties: {} }).catch(() => {});
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = await darDeBaja(url.searchParams.get("t") ?? "");
  return NextResponse.redirect(new URL(`/semanal/baja?tipo=inmediato${ok ? "" : "&error=1"}`, url.origin), 302);
}

export async function POST(request: Request) {
  const ok = await darDeBaja(new URL(request.url).searchParams.get("t") ?? "");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
