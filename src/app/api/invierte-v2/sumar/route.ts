import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { esAvisoId } from "@/lib/invierte-v2/destino";
import { sumarDepto } from "@/lib/invierte-v2/base-servidor";
import { capturarServidor } from "@/lib/posthog-servidor";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// POST /api/invierte-v2/sumar (entrega 2, 19-nov-2026): «Seguir con este» de la base y «Sumar a mis opciones» desde el mapa
// (lámina 3.3-sumar-otro-depto). { avisoId, deja?, origen: "base" | "mapa" }. Sin acceso: 404. Hasta seis activos; sobre eso,
// `deja` dice cuál suelta. Solo lo que le alcanza. Sumarlo deja la tarea «gestionar al corredor».
export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const b = (await request.json().catch(() => ({}))) as { avisoId?: unknown; deja?: unknown; origen?: unknown };
  if (!esAvisoId(b.avisoId) || (b.deja != null && !esAvisoId(b.deja))) return NextResponse.json({ error: "datos" }, { status: 400 });
  const origen = b.origen === "mapa" ? "mapa" : "base";
  const r = await sumarDepto(createServiceClient(), { id: user.id, email: user.email ?? null }, b.avisoId, (b.deja as string | null | undefined) ?? null, origen, contextoDe(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : r.error === "maximo" || r.error === "fuera" ? 409 : 400 });
  if (!r.ya) await capturarServidor({ event: "inv2_depto_sumado", distinctId: user.id, correo: user.email ?? null, properties: { origen } }).catch(() => false);
  return NextResponse.json({ ok: true, ya: r.ya });
}
