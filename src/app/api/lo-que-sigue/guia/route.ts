import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { calcularYGuardarGuia, guiaGuardada } from "@/lib/guia/guia-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (30-sep-2026): los parecidos del informe `a`, recalculados con los números
// de la persona. La guía se calcula al confirmarse el pago del pack y queda guardada por informe
// (`guias_calculadas`): acá se lee hecha. Si todavía no está —el pago se confirmó hace un instante, o
// venció—, se calcula y se guarda. Devuelve lo que la pantalla muestra y nada más (`respuestaGuia`):
// sin enlace al aviso ni textos del aviso. El id del informe llega en la vuelta de Flow.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const a = new URL(request.url).searchParams.get("a") ?? "";
  if (!UUID.test(a)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const admin = createAnonPipelineClient();
  try {
    const guardada = await guiaGuardada(admin, a);
    const r = guardada ?? (await calcularYGuardarGuia(admin, a));
    return NextResponse.json(r, { headers: { "Cache-Control": "private, max-age=300", "x-guia": guardada ? "guardada" : "calculada" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/lo-que-sigue/guia", operacion: "guia", extra: { analysisId: a } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
