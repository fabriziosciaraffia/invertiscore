import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";

// ─────────────────────────────────────────────────────────────────────────────
// Los correos de Franco desde la cuenta (19-oct-2026, decisión de Fabrizio): la selección semanal y el aviso cuando
// aparece un depto, cada uno se apaga o se vuelve a prender. Escribe lo mismo que el enlace de baja de cada correo
// (`semanal_baja_at` / `inmediato_baja_at` en perfil_busqueda, que el cliente no puede escribir: solo el servidor), con
// la sesión en vez del token.
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNA = { semanal: "semanal_baja_at", inmediato: "inmediato_baja_at" } as const;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { correo?: unknown; recibe?: unknown };
  const correo = body.correo === "semanal" || body.correo === "inmediato" ? body.correo : null;
  if (!correo || typeof body.recibe !== "boolean") return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const admin = createServiceClient();
  const { error } = await admin
    .from("perfil_busqueda")
    .upsert({ user_id: user.id, [COLUMNA[correo]]: body.recibe ? null : new Date().toISOString() }, { onConflict: "user_id" });
  reportarFalloQuery(error, { ruta: "api/cuenta/correos", operacion: "cambiar", userId: user.id });
  if (error) return NextResponse.json({ error: "No pudimos guardarlo" }, { status: 500 });

  await capturarServidor({
    event: body.recibe ? `${correo}_vuelve` : `${correo}_baja`,
    distinctId: user.id,
    properties: { desde: "cuenta" },
  }).catch(() => {});
  return NextResponse.json({ ok: true, correo, recibe: body.recibe });
}
