import { NextResponse } from "next/server";
import { getSugerencias } from "@/lib/services/market-suggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const comuna = searchParams.get("comuna");
  const superficie = parseFloat(searchParams.get("superficie") || "0") || 50;
  const dormRaw = parseInt(searchParams.get("dormitorios") || "0");
  // 0 = sin filtro (pasar null a la RPC), >0 = filtrar por dormitorios
  const dormitorios = dormRaw > 0 ? dormRaw : 0;
  const precioUF = parseFloat(searchParams.get("precioUF") || "0") || undefined;
  const lat = parseFloat(searchParams.get("lat") || "0") || undefined;
  const lng = parseFloat(searchParams.get("lng") || "0") || undefined;
  const radius = parseInt(searchParams.get("radius") || "800");
  const propType = searchParams.get("type") || "arriendo";
  const condicion = searchParams.get("condicion") || null;

  if (!comuna) {
    return NextResponse.json({ error: "Missing comuna" }, { status: 400 });
  }

  try {
    const sugerencias = await getSugerencias(
      comuna, superficie, dormitorios, precioUF, lat, lng, radius, propType, condicion
    );
    return NextResponse.json(sugerencias);
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
