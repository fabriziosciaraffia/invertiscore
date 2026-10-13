import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config-store";
import { respuestaConfig } from "@/lib/config-publica";

// Solo la lista cerrada de claves públicas (`config-publica.ts`, 13-oct-2026). Cualquier otra clave —exista o no—
// recibe el mismo 404, sin consultar la base.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const r = await respuestaConfig(key, getConfig);
  return NextResponse.json(r.body, { status: r.status });
}
