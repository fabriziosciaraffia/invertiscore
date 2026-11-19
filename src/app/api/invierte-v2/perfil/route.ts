import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validarPerfil } from "@/lib/invierte-v2/perfil";
import { confirmarPerfil } from "@/lib/invierte-v2/perfil-servidor";
import { capturarServidor } from "@/lib/posthog-servidor";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// POST /api/invierte-v2/perfil (Invierte con Franco, etapa 2, 18-nov-2026): confirma el perfil de inversión (los dos pasos).
// Sin acceso: 404. Valida todo (perfil.ts › validarPerfil), calcula hasta cuánto y lo guarda; recién acá se escribe algo,
// también en el perfil de la selección semanal. Sin orden firmada: 409.
export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const v = validarPerfil((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const r = await confirmarPerfil(createServiceClient(), { id: user.id, email: user.email ?? null }, v.pedido, contextoDe(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "sin-orden" ? 409 : 500 });
  await capturarServidor({ event: "inv2_perfil", distinctId: user.id, correo: user.email ?? null, properties: { fuente: r.tope.fuente, preaprobado: v.pedido.preaprobado, comunas: v.pedido.comunas.length } }).catch(() => false);
  return NextResponse.json({ ok: true, topeUF: r.tope.topeUF, fuente: r.tope.fuente, editado: r.editado });
}
