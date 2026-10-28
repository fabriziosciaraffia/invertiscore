import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { eleccionesDeUrl, responderDeptos, validarElecciones } from "@/lib/deptos/servidor";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deptos/respuesta?c=Ñuñoa&t=2&r=3000-4000&m=ltr (16-oct-2026, la puerta B): la respuesta al instante de /deptos
// con la evaluación de la noche, sin calcular en vivo (lib/deptos/respuesta.ts). Desde el 28-oct-2026 lee el conteo que
// guarda el cron de la evaluación (lib/deptos/servidor.ts › conteoDeptos): ya no cuenta en cada pedido. Pública y sin datos de nadie: se cachea
// unos minutos en el borde (los avisos cambian de noche). Fuera del Gran Santiago responde «por ahora solo Gran
// Santiago» con la lista.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const v = validarElecciones(eleccionesDeUrl(new URL(request.url).searchParams));
  if (!v.ok) {
    return NextResponse.json(
      v.error === "fuera" ? { error: "fuera", comuna: v.fuera, cobertura: COMUNAS_DISPONIBLES } : { error: v.error },
      { status: 400 },
    );
  }
  try {
    const r = await responderDeptos(createServiceClient(), v);
    return NextResponse.json(r, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/deptos/respuesta", operacion: "conteo" });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
