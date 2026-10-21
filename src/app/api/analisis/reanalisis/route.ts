import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { respuestasDesdeInforme } from "@/components/formulario-v4/wizardV4Reanalisis";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analisis/reanalisis?origen= (21-oct-2026, lib/reanalisis.ts): el informe PROPIO, entero, como respuestas del
// wizard —el depto y la persona—, para el re-análisis al precio recomendado. El wizard pone encima el precio, el pie y el
// plazo de la recomendación y abre en el resumen. Con sesión; sin ella, 401 y el wizard pide el código y vuelve.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const origen = new URL(request.url).searchParams.get("origen") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(origen)) return NextResponse.json({ error: "Falta el informe" }, { status: 400 });
  const { data } = await supabase
    .from("analisis")
    .select("input_data, tipo_analisis")
    .eq("id", origen)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Ese informe no es tuyo" }, { status: 404 });
  const { respuestas, completadas, precioUF } = respuestasDesdeInforme(data.input_data as Record<string, unknown>, data.tipo_analisis as string);
  return NextResponse.json({ respuestas, completadas, precioOriginalUF: precioUF });
}
