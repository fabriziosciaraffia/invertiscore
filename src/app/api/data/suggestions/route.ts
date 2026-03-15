import { NextResponse } from "next/server";
import { getSugerencias } from "@/lib/services/market-suggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const comuna = searchParams.get("comuna");
  const superficie = parseFloat(searchParams.get("superficie") || "0");
  const dormitorios = parseInt(searchParams.get("dormitorios") || "2");
  const precioUF = parseFloat(searchParams.get("precioUF") || "0") || undefined;
  const lat = parseFloat(searchParams.get("lat") || "0") || undefined;
  const lng = parseFloat(searchParams.get("lng") || "0") || undefined;
  const radius = parseInt(searchParams.get("radius") || "800");

  if (!comuna || superficie <= 0) {
    return NextResponse.json({ error: "Missing comuna or superficie" }, { status: 400 });
  }

  try {
    const sugerencias = await getSugerencias(
      comuna, superficie, dormitorios, precioUF, lat, lng, radius
    );
    return NextResponse.json(sugerencias);
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
