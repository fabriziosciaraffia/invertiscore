import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { asegurarInvitacion, premiosPagados } from "@/lib/referido-servidor";
import { enlaceInvitacion, REFERIDO_COPY, textoEnlaceInvitacion, TOPE_PREMIOS_REFERIDO } from "@/lib/referido";
import { nombreReal } from "@/lib/welcome";

// ─────────────────────────────────────────────────────────────────────────────
// /api/invitacion (16-oct-2026, la puerta C): el enlace propio de quien invita. Solo con sesión.
//   GET                          → el de siempre (el invitado ve «un amigo te invitó a Franco»).
//   POST { conNombre, nombre }   → con su nombre, solo si lo pide; `conNombre: false` vuelve al de siempre.
// Las dos anotan el dispositivo desde donde se abre (el «mismo dispositivo» del premio) y dicen cuántos lleva de cinco.
// ─────────────────────────────────────────────────────────────────────────────

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

async function responder(request: Request, conNombre: boolean, nombre: string | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const admin = createServiceClient();
  const inv = await asegurarInvitacion(admin, { userId: user.id, conNombre, nombre, dispositivo: huellaDeRequest(request).dispositivo });
  if (!inv) return NextResponse.json({ error: conNombre ? "Falta tu nombre" : "No se pudo armar tu enlace" }, { status: conNombre ? 400 : 500 });
  const pagados = (await premiosPagados(admin, user.id)) ?? 0;
  const url = enlaceInvitacion(SITIO, inv.codigo);
  return NextResponse.json({
    codigo: inv.codigo,
    url,
    texto: textoEnlaceInvitacion(inv.codigo),
    conNombre: inv.conNombre,
    nombre: inv.nombre,
    nombreSugerido: nombreReal(user.user_metadata),
    mensaje: REFERIDO_COPY.mensaje(inv.nombre, url),
    pagados,
    tope: TOPE_PREMIOS_REFERIDO,
    cuenta: REFERIDO_COPY.cuenta(pagados),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  return responder(request, false, null);
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { conNombre?: unknown; nombre?: unknown };
  const conNombre = b.conNombre === true;
  return responder(request, conNombre, conNombre && typeof b.nombre === "string" ? b.nombre : null);
}
