// GET /api/lo-que-sigue/oferta?analysisId=… — la vigencia del pack, dicha por el servidor: el
// checkout la muestra y no confía en el reloj del navegador. Sin sesión también responde (el
// checkout puede consultarla antes de que la cuenta exista); solo devuelve la hora, nada más.
import { NextResponse } from "next/server";
import { createServiceClient as createAdminClient } from "@/lib/supabase/service";
import { ofertaPackVigente, venceEl } from "@/lib/lo-que-sigue/oferta-pack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const analysisId = new URL(request.url).searchParams.get("analysisId");
  if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
    return NextResponse.json({ error: "analysisId inválido" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data } = await admin.from("analisis").select("created_at").eq("id", analysisId).single();
  if (!data?.created_at) return NextResponse.json({ error: "no existe" }, { status: 404 });
  return NextResponse.json({
    vigente: ofertaPackVigente(data.created_at),
    venceAt: venceEl(data.created_at).toISOString(),
  });
}
