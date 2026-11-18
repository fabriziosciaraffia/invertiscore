import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_ACTIVOS } from "@/lib/invierte-v2/opciones";
import { elegir } from "@/lib/invierte-v2/perfil-servidor";
import { capturarServidor } from "@/lib/posthog-servidor";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// POST /api/invierte-v2/eleccion (etapa 2, 18-nov-2026): «Seguir con estos N». Como mucho MAX_ACTIVOS; solo opciones de la
// persona que le alcanzan. Sin acceso: 404.
export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const b = (await request.json().catch(() => ({}))) as { avisoIds?: unknown };
  const ids = Array.isArray(b.avisoIds) ? (b.avisoIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const r = await elegir(createServiceClient(), { id: user.id, email: user.email ?? null }, ids, MAX_ACTIVOS, contextoDe(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 400 });
  await capturarServidor({ event: "inv2_eleccion", distinctId: user.id, correo: user.email ?? null, properties: { n: r.elegidos.length } }).catch(() => false);
  return NextResponse.json({ ok: true });
}
