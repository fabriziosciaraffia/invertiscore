import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { accesoAsesoriaDe } from "@/lib/asesoria/acceso-servidor";
import { esAporte, respuestaAporte } from "@/lib/asesoria/aporte";
import { sesionAsesoria, topeAporte, universoAsesoria } from "@/lib/asesoria/servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asesoria/aporte { aporte } (27-nov-2026, lámina P5): los Comprar que piden como mucho `aporte` al mes, con la máscara de
// los cuatro plazos. `aporte` es uno de los altos del slider (aporte.ts › APORTES, cortes de `cortes_flujo`): cualquier otro valor,
// 400. La respuesta lleva SOLO id y máscara —nunca precio, flujo ni cap rate—; el tope, las zonas y el plazo los aplica el
// navegador. Con tope por sesión y por IP (servidor.ts › topeAporte). Sin la asesoría habilitada, 404.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const huella = huellaDeRequest(request);
  const acceso = await accesoAsesoriaDe({ dispositivoHash: huella.dispositivo, userId: user?.id ?? null });
  if (!acceso.habilitada) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { aporte?: unknown };
  if (!esAporte(b.aporte)) return NextResponse.json({ error: "aporte" }, { status: 400 });
  const admin = createServiceClient();
  try {
    const pasa = await topeAporte(admin, { sesion: sesionAsesoria(user?.id ?? null, huella.dispositivo), ip: huella.ip, aporte: b.aporte, conCuenta: !!user });
    if (!pasa) return NextResponse.json({ error: "tope" }, { status: 429 });
    const r = respuestaAporte(await universoAsesoria(), b.aporte);
    return NextResponse.json({ i: r.i, m: r.m }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/asesoria/aporte", operacion: "aporte", userId: user?.id ?? null });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
