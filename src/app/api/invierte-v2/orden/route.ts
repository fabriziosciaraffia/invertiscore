import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EVENTOS_INV2 } from "@/lib/invierte-v2/flujo";
import { anotarVista, completarOrden, ultimaOrdenDe, urlFirmadaPdf } from "@/lib/invierte-v2/servidor";
import { DEPS_FIRMA, NO_EXISTE, contextoDe, personaConSesion } from "@/lib/invierte-v2/rutas";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invierte-v2/orden (etapa 1 de Invierte con Franco, 18-nov-2026): «Ver mi orden». Redirige a una URL firmada de
// 60 s al PDF guardado. La orden firmada se ve SIEMPRE (aunque la cuenta salga de la lista): pide sesión y una orden de la
// persona, no el interruptor; sin sesión o sin orden, 404. Si el PDF o la copia quedaron pendientes, los completa antes.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await personaConSesion();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  let orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) return NO_EXISTE();
  if (!orden.pdfPath || !orden.copiaEnviadaAt) {
    await completarOrden(admin, orden, DEPS_FIRMA);
    orden = (await ultimaOrdenDe(admin, user.id)) ?? orden;
  }
  const url = await urlFirmadaPdf(admin, orden);
  if (!url) return NextResponse.json({ error: "pdf" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await anotarVista(admin, orden, { actor: "persona", email: user.email ?? null }, contextoDe(request));
  await capturarServidor({ event: EVENTOS_INV2.ordenVista, distinctId: user.id, correo: user.email ?? null, properties: { orden_id: orden.id, version: orden.textoVersion } }).catch(() => false);
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
}
