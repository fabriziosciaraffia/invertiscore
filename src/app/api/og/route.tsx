import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("analisis")
    .select("nombre, score, comuna, creator_name, results")
    .eq("id", id)
    .single();

  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const score = data.score || 0;
  const verdict = score >= 75 ? "COMPRAR" : score >= 40 ? "NEGOCIAR" : "BUSCAR OTRA";
  const verdictColor = score >= 75 ? "#B0BEC5" : score >= 40 ? "#C8323C" : "#C8323C";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = data.results as any;
  const flujo = results?.metrics?.flujoNetoMensual;
  const rent = results?.metrics?.rentabilidadBruta;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "1200px",
          height: "630px",
          backgroundColor: "#0F0F0F",
          color: "#FAFAF8",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", fontSize: "24px", opacity: 0.5 }}>refranco.ai</div>
          {data.creator_name ? (
            <div style={{ display: "flex", fontSize: "20px", opacity: 0.6 }}>
              Análisis de {data.creator_name}
            </div>
          ) : null}
        </div>

        {/* Score */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: "14px", letterSpacing: "3px", opacity: 0.5, marginBottom: "8px", textTransform: "uppercase" as const }}>
            Franco Score
          </div>
          <div style={{ display: "flex", fontSize: "120px", fontWeight: "bold", lineHeight: 1 }}>{score}</div>
          <div style={{ display: "flex", fontSize: "28px", fontWeight: "bold", color: verdictColor, marginTop: "8px", letterSpacing: "2px" }}>
            {verdict}
          </div>
          <div style={{ display: "flex", fontSize: "24px", marginTop: "16px", opacity: 0.8 }}>{data.nombre}</div>
        </div>

        {/* Footer metrics */}
        <div style={{ display: "flex", justifyContent: "center", gap: "60px", opacity: 0.7 }}>
          {flujo != null ? (
            <div style={{ display: "flex", fontSize: "18px" }}>
              Flujo: {flujo >= 0 ? "+" : ""}{Math.round(flujo / 1000)}K/mes
            </div>
          ) : null}
          {rent != null ? (
            <div style={{ display: "flex", fontSize: "18px" }}>Rent: {rent.toFixed(1)}%</div>
          ) : null}
          <div style={{ display: "flex", fontSize: "18px" }}>{data.comuna}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
