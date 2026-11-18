import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { esAvisoId } from "@/lib/invierte-v2/destino";
import { pedirAviso } from "@/lib/invierte-v2/perfil-servidor";
import { NO_EXISTE, personaConAcceso } from "@/lib/invierte-v2/rutas";

// POST /api/invierte-v2/avisar (etapa 2, 18-nov-2026): «Avísenme cuando algo me alcance» / «… el de Ñuñoa». Se anota y crea
// una tarea interna (avisar_alcance); el envío del aviso es de otra etapa. Sin acceso: 404.
export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const b = (await request.json().catch(() => ({}))) as { avisoId?: unknown };
  const ok = await pedirAviso(createServiceClient(), { id: user.id, email: user.email ?? null }, esAvisoId(b.avisoId) ? b.avisoId : null);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "guardar" }, { status: 500 });
}
