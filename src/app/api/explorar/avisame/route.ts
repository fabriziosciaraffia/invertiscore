import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EVENTOS_PORTAL, ORDEN_POR_DEFECTO, propsDeFiltros, validarPortal } from "@/lib/explorar/portal";
import { eventoPortal, guardarBusquedaComoPerfil } from "@/lib/explorar/portal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/avisame { filtros } (28-oct-2026): «Avísame de nuevos». Los filtros activos pasan a ser el perfil de
// búsqueda de la cuenta —comunas, tipología, precio, pie, plazo y modalidad— y desde ahí el semanal y la selección diaria
// buscan con eso (leen `perfil_busqueda`: lo editado a mano manda). La pantalla ya mostró qué búsqueda reemplaza. El perfil
// necesita entre 1 y 8 comunas: con todas, 422 «comunas». Deja «explorar_avisame». Junto con la casilla del pop-up, es lo
// único de Explorar que escribe el perfil.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { filtros?: Record<string, unknown> };
  const filtros = validarPortal(b.filtros ?? null);
  const r = await guardarBusquedaComoPerfil(createServiceClient(), user.id, filtros);
  if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: r.motivo === "base" ? 500 : 422 });
  waitUntil(capturarServidor(eventoPortal(EVENTOS_PORTAL.avisame, user.id, propsDeFiltros(filtros, ORDEN_POR_DEFECTO))).then(() => undefined).catch(() => undefined));
  return NextResponse.json({ ok: true, linea: r.linea });
}
