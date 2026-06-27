import { NextResponse } from "next/server";
import { getConfig } from "@/lib/market-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const result = await getConfig(key);

  // Hardcoded defaults. tasa_hipotecaria alineado con la referencia canónica del
  // motor (MARKET_AVG_TASA_UF = 4.1 en lib/financing-health.ts): si el row de DB
  // faltara, el wizard prefilearía la MISMA tasa contra la que el motor juzga, sin
  // sesgo. NO subir esto sin subir también esa constante.
  const defaults: Record<string, string> = {
    tasa_hipotecaria: "4.1",
  };

  return NextResponse.json({
    key,
    value: result?.value ?? defaults[key] ?? null,
    updated_at: result?.updated_at ?? null,
  });
}
