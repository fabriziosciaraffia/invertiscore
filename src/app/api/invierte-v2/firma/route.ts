import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EVENTOS_INV2, validarFirma } from "@/lib/invierte-v2/flujo";
import { firmar } from "@/lib/invierte-v2/servidor";
import { DEPS_FIRMA, NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { chequearPublicacionInvierte } from "@/lib/invierte-v2/carril-servidor";
import { lecturaDe } from "@/lib/invierte-v2/lectura-franco-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invierte-v2/firma (etapa 1 de Invierte con Franco, 18-nov-2026): la firma electrónica simple de la orden de
// visita. Sin sesión o sin acceso: 404. Rechaza (400) un nombre vacío, un RUT que no pasa el módulo 11, la firma sin haber
// llegado al final del texto o sin la casilla, y una versión del texto que no es la vigente. Guarda la orden con la copia
// del texto, su huella, la hora del servidor, la IP y el navegador; después el PDF en el bucket privado y la copia por correo
// (si fallan, la firma queda y se reintentan). Quien ya firmó la versión vigente no firma de nuevo.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const v = validarFirma((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const admin = createServiceClient();
  try {
    const r = await firmar(admin, { id: user.id, email: user.email ?? null }, v.pedido, contextoDe(request), DEPS_FIRMA);
    if (!r.ok) {
      const status = r.error === "sin-contacto" ? 409 : r.error === "depto" ? 404 : r.error === "sin-correo" ? 400 : 500;
      if (r.error === "guardar") captureApiError(new Error("inv2: firma no guardada"), { ruta: "/api/invierte-v2/firma", operacion: "firmar", userId: user.id });
      return NextResponse.json({ error: r.error }, { status });
    }
    if (!r.yaFirmada) {
      // Apenas se firma, en segundo plano y sin demorar la firma (20-nov-2026): la publicación del depto elegido se lee por el carril
      // de Invierte (origen «firma») y se escribe «Lo que ve Franco», para que el resultado ya los tenga.
      const avisoId = v.pedido.avisoId;
      waitUntil((async () => {
        await chequearPublicacionInvierte(admin, { avisoId, userId: user.id, origen: "firma" }).catch(() => undefined);
        if (process.env.ANTHROPIC_API_KEY) await lecturaDe(admin, new Anthropic(), avisoId).catch(() => undefined);
      })());
      await capturarServidor({
        event: EVENTOS_INV2.firma,
        distinctId: user.id,
        correo: user.email ?? null,
        properties: { aviso_id: v.pedido.avisoId, version: v.pedido.version, pdf: r.pdf, copia: r.copia },
      }).catch(() => false);
    }
    if (!r.pdf || !r.copia) captureApiError(new Error(`inv2: orden incompleta (pdf ${r.pdf}, copia ${r.copia}${r.motivoCopia ? `: ${r.motivoCopia}` : ""})`), { ruta: "/api/invierte-v2/firma", operacion: "completar", userId: user.id, extra: { ordenId: r.ordenId, motivoCopia: r.motivoCopia } });
    return NextResponse.json({ ok: true, ordenId: r.ordenId, yaFirmada: r.yaFirmada }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "/api/invierte-v2/firma", operacion: "firmar", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
