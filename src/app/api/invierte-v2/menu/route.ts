import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { muestraMiInversion } from "@/lib/invierte-v2/menu-servidor";

// GET /api/invierte-v2/menu (láminas del 19-nov-2026): ¿el menú de arriba lleva «Mi inversión»? Solo con sesión, firma y acceso
// (menu-servidor.ts). Sin sesión responde false, sin error: el header la consulta una vez por sesión del navegador.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const firmo = await muestraMiInversion(user ?? null);
  return NextResponse.json({ firmo }, { headers: { "Cache-Control": "no-store" } });
}
