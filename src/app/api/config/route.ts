import { NextResponse } from "next/server";
import { getConfig } from "@/lib/market-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const result = await getConfig(key);

  // Hardcoded defaults
  const defaults: Record<string, string> = {
    tasa_hipotecaria: "4.72",
  };

  return NextResponse.json({
    key,
    value: result?.value ?? defaults[key] ?? null,
    updated_at: result?.updated_at ?? null,
  });
}
