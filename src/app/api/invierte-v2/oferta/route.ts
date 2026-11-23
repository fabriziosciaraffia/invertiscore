import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { esAvisoId } from "@/lib/invierte-v2/destino";
import { firmarOferta, hablarConFranco } from "@/lib/invierte-v2/rango-servidor";
import { firmarRonda, noGracias, retirarOferta } from "@/lib/invierte-v2/b4-servidor";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// POST /api/invierte-v2/oferta (etapa 3, B3, 22-nov-2026; láminas 5.1 y 5.1b). Sin acceso: 404.
//   { accion: "firmar", avisoId, montoUF, acepto: true, leyo } → firma la oferta del depto (queda firmada, o en cola si hay otra viva).
//   { accion: "hablar", avisoId, montoUF }                     → «Hablarlo con Franco»: una tarea para que Franco la llame.
//   B4 (23-nov-2026): { accion: "firmar_ronda", avisoId, desdeId, montoUF, acepto: true, leyo, retirarOtra } → acepta su precio, propone otro
//   monto, reactiva una respuesta fuera de plazo o vuelve a presentar (siempre firmado); { accion: "retirar", avisoId } → la retira (o «No
//   aceptar la contraoferta»); { accion: "no_gracias", avisoId } → «No, gracias» a una respuesta fuera de plazo.
// Ninguna presenta la oferta: eso lo hace una persona de Franco (B4).
export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const b = (await request.json().catch(() => ({}))) as { accion?: unknown; avisoId?: unknown; montoUF?: unknown; acepto?: unknown; leyo?: unknown; desdeId?: unknown; retirarOtra?: unknown };
  if (!esAvisoId(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const u = { id: user.id, email: user.email ?? null };
  if (b.accion === "hablar") {
    const r = await hablarConFranco(createServiceClient(), u, b.avisoId, b.montoUF);
    return NextResponse.json(r, { status: r.ok ? 200 : 500 });
  }
  if (b.accion === "firmar") {
    const r = await firmarOferta(createServiceClient(), u, b.avisoId, b, contextoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 409 });
    return NextResponse.json(r);
  }
  if (b.accion === "firmar_ronda") {
    const r = await firmarRonda(createServiceClient(), u, b.avisoId, b, contextoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 409 });
    return NextResponse.json(r);
  }
  if (b.accion === "retirar") {
    const r = await retirarOferta(createServiceClient(), u, b.avisoId, contextoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 409 });
    return NextResponse.json(r);
  }
  if (b.accion === "no_gracias") {
    const r = await noGracias(createServiceClient(), u, b.avisoId, contextoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 409 });
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: "accion" }, { status: 400 });
}
