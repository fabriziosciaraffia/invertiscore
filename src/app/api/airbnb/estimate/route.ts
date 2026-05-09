import { NextRequest, NextResponse } from "next/server";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";
import type { AirbnbEstimateResponse } from "@/lib/airbnb/types";

/**
 * Thin HTTP wrapper sobre `getAirbnbEstimate`. La lógica core (cache lookup,
 * AirROI fetch, processing) vive en `src/lib/airbnb/get-estimate.ts` para
 * permitir que /api/analisis/short-term la consuma sin sub-fetch HTTP.
 *
 * Bug 2026-05-09 (análisis 71f4d2fd…): el sub-fetch HTTP de short-term a este
 * endpoint sufría doble cold start serverless en flujo AMBAS y devolvía HTML
 * (Vercel runtime page) cuando la function colapsaba. El consumer parseaba
 * HTML como JSON y tiraba SyntaxError. Eliminado al llamar la lib directo.
 */
export async function POST(req: NextRequest) {
  let body: { address?: unknown; bedrooms?: unknown; baths?: unknown; guests?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "validation_error", message: "Body JSON inválido" } satisfies AirbnbEstimateResponse,
      { status: 400 },
    );
  }

  const address = typeof body.address === "string" ? body.address : "";
  const bedrooms = Number(body.bedrooms);
  const baths = Number(body.baths);
  const guests = Number(body.guests);

  try {
    const result = await getAirbnbEstimate(address, bedrooms, baths, guests);

    // HTTP status apropiado por shape de la respuesta (mantiene contrato previo).
    if (result.success) {
      return NextResponse.json(result satisfies AirbnbEstimateResponse);
    }
    if (result.error === "validation_error") {
      return NextResponse.json(result satisfies AirbnbEstimateResponse, { status: 400 });
    }
    if (result.error === "no_comparables") {
      return NextResponse.json(result satisfies AirbnbEstimateResponse, { status: 404 });
    }
    // airbnb_api_error / no_credits → 502
    return NextResponse.json(result satisfies AirbnbEstimateResponse, { status: 502 });
  } catch (err) {
    console.error("[airbnb/estimate] Error:", err);
    return NextResponse.json(
      { success: false, error: "airbnb_api_error", message: "Error interno al procesar la estimación" } satisfies AirbnbEstimateResponse,
      { status: 502 },
    );
  }
}
