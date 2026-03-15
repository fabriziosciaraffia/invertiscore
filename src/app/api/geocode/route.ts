import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/services/geocoding";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const comuna = searchParams.get("comuna");

  if (!q || !comuna) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const result = await geocodeAddress(q, comuna);
  return NextResponse.json(result || { lat: null, lng: null });
}
