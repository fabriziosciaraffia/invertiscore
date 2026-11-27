import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { accesoAsesoriaDe } from "@/lib/asesoria/acceso-servidor";
import { agregadosAsesoria } from "@/lib/asesoria/servidor";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/asesoria/agregados (27-nov-2026): lo que el anónimo ve AGREGADO —el cap rate medio de los Comprar por comuna (un número
// por comuna, lámina P2) y cuántos Comprar piden cada tramo de 25 mil al mes por plazo (las barras del slider, lámina P5)—, nunca
// una cifra de un depto. Sin la asesoría habilitada, 404.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const acceso = await accesoAsesoriaDe({ dispositivoHash: huellaDeRequest(request).dispositivo, userId: user?.id ?? null });
  if (!acceso.habilitada) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  try {
    const cfg = await leerConfigGuia(createServiceClient());
    // La tasa y la UF son las de la fórmula: llegan aunque el universo falle (entonces sin la tarjeta del cap rate ni las barras).
    const a = await agregadosAsesoria(cfg.uf).catch((e) => { captureApiError(e, { ruta: "GET /api/asesoria/agregados", operacion: "universo", userId: user?.id ?? null }); return null; });
    return NextResponse.json({ rinde: a?.rinde ?? [], dist: a?.dist ?? null, total: a?.total ?? null, tasa: cfg.tasa, uf: cfg.uf }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/asesoria/agregados", operacion: "agregados", userId: user?.id ?? null });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
