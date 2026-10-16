import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { primerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";

// GET /api/deptos/primeros (16-oct-2026, la puerta B): los primeros deptos de la cuenta con sesión, para «Estás dentro»
// al terminar (lib/deptos/primeros-servidor.ts). Mientras el correo del día revisa fichas, `revisando` y la pantalla
// vuelve a preguntar.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  try {
    return NextResponse.json(await primerosDeLaCuenta(createServiceClient(), user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/deptos/primeros", operacion: "primeros", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
