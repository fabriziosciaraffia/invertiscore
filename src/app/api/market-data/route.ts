import { NextResponse } from "next/server";
import { getMarketDataForComuna } from "@/lib/market-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const comuna = searchParams.get("comuna");
  const dormitorios = parseInt(searchParams.get("dormitorios") || "2", 10);

  if (!comuna) {
    return NextResponse.json({ error: "comuna is required" }, { status: 400 });
  }

  const data = await getMarketDataForComuna(comuna, dormitorios);

  if (!data) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data });
}
