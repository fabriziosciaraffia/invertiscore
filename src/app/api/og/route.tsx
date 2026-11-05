import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { fmtPct } from "@/components/analysis/utils";
import { readVeredicto } from "@/lib/results-helpers";
import { veredictoDeBanda } from "@/lib/gate-veredicto-hallazgo";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";
import { puntajeDe, resultadosPorId } from "@/lib/analysis/resultados-del-informe";
import { getUFValue } from "@/lib/uf";

// En Node, no en edge (05-nov-2026): el puntaje sale del mismo recálculo que el informe (resultados-del-informe.ts), que
// corre el motor. El runtime edge está deprecado en Vercel.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("analisis")
    .select("nombre, score, comuna, creator_name, results, pending_payment")
    .eq("id", id)
    .single();

  // Pendiente de pago (04-nov-2026, lib/informe-bloqueado.ts): sin puntaje ni veredicto en la vista previa.
  if (!data || (data as { pending_payment?: boolean | null }).pending_payment === true) {
    return new Response("Not found", { status: 404 });
  }

  // EL PUNTAJE DE LA PORTADA (05-nov-2026): el mismo recálculo que el informe, no la columna del día en que se creó.
  const delInforme = await resultadosPorId(id, await getUFValue());
  const score = puntajeDe(delInforme?.results) ?? (data.score || 0);
  // Goal 10a (07-sep-2026): el veredicto sale de results.veredicto (el del motor, con
  // gates), no de umbrales sobre el score (los viejos 75/40 ni siquiera eran los del
  // motor). Sin results, la banda del score con los umbrales del motor. Etiqueta única.
  const veredicto = readVeredicto(data.results as Parameters<typeof readVeredicto>[0]) ?? (veredictoDeBanda(score) as Veredicto);
  const verdict = etiquetaVeredicto(veredicto, "banda");
  const verdictColor = veredicto === "COMPRAR" ? "#B0BEC5" : "#C8323C";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (delInforme?.results ?? data.results) as any;
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
            <div style={{ display: "flex", fontSize: "18px" }}>Rent: {fmtPct(rent, 1)}</div>
          ) : null}
          <div style={{ display: "flex", fontSize: "18px" }}>{data.comuna}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
