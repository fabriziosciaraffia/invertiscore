import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BUCKET_INVIERTE } from "@/lib/invierte-v2/servidor";
import { NO_EXISTE, personaConSesion } from "@/lib/invierte-v2/rutas";
import { MAX_FOTOS_VISITA, rutaFotoVisita } from "@/lib/invierte-v2/visita";

// ───────────────────────────────────────────────────────────
// GET /api/invierte-v2/foto-visita?visita=<uuid>&i=<n>[&mini=1] (24-nov-2026): una foto del reporte de la visita, o su copia liviana.
// Solo para la persona dueña de la visita y con el reporte publicado (si no, 404). Las fotos viven en el bucket privado «invierte»:
// la ruta entrega una URL firmada de un minuto, tal como se subió, sin recortar ni filtrar.
// ───────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const visitaId = q.get("visita") ?? "";
  const i = Number(q.get("i"));
  if (!UUID.test(visitaId) || !Number.isInteger(i) || i < 0 || i >= MAX_FOTOS_VISITA) return NO_EXISTE();
  const user = await personaConSesion();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  const { data: v } = await admin.from("inv_visitas").select("user_id, estado, reporte").eq("id", visitaId).maybeSingle();
  const ruta = rutaFotoVisita(v, user.id, visitaId, i, q.get("mini") === "1");
  if (!ruta) return NO_EXISTE();
  const { data, error } = await admin.storage.from(BUCKET_INVIERTE).createSignedUrl(ruta, 60);
  if (error || !data?.signedUrl) return NO_EXISTE();
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=50" } });
}
