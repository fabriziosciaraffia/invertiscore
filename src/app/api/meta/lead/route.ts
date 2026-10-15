import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EVENTOS_META, idLead } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta } from "@/lib/meta/servidor";
import { esPuerta } from "@/lib/atribucion-puerta";
import { waitUntil } from "@vercel/functions";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meta/lead (15-oct-2026, medición para la campaña): alguien DEJÓ SU CORREO —en el banner del informe y,
// cuando existan, en la página de selección (B) y en la del invitado—. El banner pide el código directo a Supabase
// y no pasa por ninguna ruta nuestra, así que avisa acá. El Lead sale una vez por correo (idLead) desde el servidor,
// y el pixel lo repite con el mismo id (el espejo, en la cookie de la respuesta). El ticket del pack manda su Lead
// en su propia ruta (/api/lo-que-sigue/pack).
// ─────────────────────────────────────────────────────────────────────────────

const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** De dónde viene el correo: solo los lugares que existen (o van a existir) para dejarlo. */
const ORIGENES = new Set(["banner", "seleccion", "invitado"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; origen?: unknown; puerta?: unknown; analysisId?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const origen = typeof body.origen === "string" && ORIGENES.has(body.origen) ? body.origen : null;
  if (!CORREO_OK.test(email) || !origen) return NextResponse.json({ ok: false }, { status: 400 });

  const emision = await emitirEventoMeta(createServiceClient(), {
    evento: EVENTOS_META.lead,
    eventId: await idLead(email),
    email,
    datos: { origen, ...(esPuerta(body.puerta) ? { puerta: body.puerta } : {}) },
    contexto: contextoDeRequest(request),
    origen: `lead:${origen}`,
  });
  waitUntil(emision.envio);
  return conEspejo(NextResponse.json({ ok: true }), [emision.espejo], request);
}
