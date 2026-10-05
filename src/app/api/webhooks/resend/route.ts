// POST /api/webhooks/resend — aperturas, clics, entregas y rebotes de los correos, a PostHog.
// La firma se verifica ANTES de leer la carga (`RESEND_WEBHOOK_SECRET`, el `whsec_` que da Resend
// al crear el endpoint). Sin secreto configurado el endpoint no acepta nada (503): un webhook sin
// firma sería una puerta para escribir eventos falsos.

import { NextResponse } from "next/server";
import { capturarServidor } from "@/lib/posthog-servidor";
import { eventoDeResend, eventoInmediatoAbierto, eventoSemanalAbierto } from "@/lib/medicion-correo";
import { verificarFirmaSvix } from "@/lib/resend-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) return NextResponse.json({ error: "webhook sin secreto" }, { status: 503 });
  const cuerpo = await req.text();
  const svixId = req.headers.get("svix-id");
  const valida = verificarFirmaSvix({
    svixId,
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
    cuerpo,
    secreto,
  });
  if (!valida || !svixId) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

  let carga: unknown;
  try {
    carga = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "cuerpo no es JSON" }, { status: 400 });
  }
  const evento = eventoDeResend(carga, svixId);
  if (!evento) return NextResponse.json({ ok: true, ignorado: true });
  const enviado = await capturarServidor(evento);
  const semanal = eventoSemanalAbierto(evento, carga);
  if (semanal) await capturarServidor(semanal);
  const inmediato = eventoInmediatoAbierto(evento);
  if (inmediato) await capturarServidor(inmediato);
  return NextResponse.json({ ok: true, evento: evento.event, enviado });
}
