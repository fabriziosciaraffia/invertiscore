import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estadoMenuInvierte } from "@/lib/invierte-v2/menu-servidor";

// GET /api/invierte-v2/menu (láminas del 19-nov-2026): ¿qué entrada lleva el menú de arriba? Sin firma o sin acceso, ninguna;
// firmó y no ha elegido, «Seguir con Franco»; eligió, «Mi inversión» (menu-servidor.ts). Sin sesión responde «ninguno», sin
// error: el header la consulta una vez por sesión del navegador.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const estado = await estadoMenuInvierte(user ?? null);
  return NextResponse.json({ estado, firmo: estado !== "ninguno" }, { headers: { "Cache-Control": "no-store" } });
}
