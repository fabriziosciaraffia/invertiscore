import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { lecturaDe } from "@/lib/invierte-v2/lectura-franco-servidor";
import { chequearPublicacionInvierte } from "@/lib/invierte-v2/carril-servidor";
import { fotosDe } from "@/lib/invierte-v2/fotos-servidor";
import { sinEnlaceAlPortal } from "@/lib/invierte-v2/portal-servidor";
import { NO_EXISTE, personaConSesion } from "@/lib/invierte-v2/rutas";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invierte-v2/lectura { avisoId } (entrega 4 de las láminas del 19-nov-2026): «Lo que ve Franco» de un depto. La pide la
// tarjeta aparte, sin bloquear la pantalla, y se completa sola. Solo para quien firmó la orden y para un depto de su base (sus
// elegidos y las alternativas que Franco le mostró): así nadie genera lecturas de deptos ajenos. Si la publicación todavía no se
// leyó, la lee aquí por el carril de Invierte (origen «resultado», con su tope, su memoria y su fusible; 20-nov-2026) y después
// escribe la lectura. Responde la lectura lista con cuántas fotos hay, o «generando» (otra pantalla ya la pidió: se vuelve a
// preguntar), «sin-datos» (no se pudo leer la publicación), «tope» o «error» (la tarjeta queda sin el bloque).
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { avisoId } = (await request.json().catch(() => ({}))) as { avisoId?: unknown };
  if (typeof avisoId !== "string" || !UUID.test(avisoId)) return NO_EXISTE();
  const user = await personaConSesion();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  if (!(await sinEnlaceAlPortal(admin, user.id))) return NO_EXISTE();
  const { data: suyo } = await admin.from("inv_deptos").select("aviso_id").eq("user_id", user.id).eq("aviso_id", avisoId).in("estado", ["opcion", "elegido"]).maybeSingle();
  if (!suyo) return NO_EXISTE();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ estado: "error" }, { headers: { "Cache-Control": "no-store" } });
  const leer = async () => { await chequearPublicacionInvierte(admin, { avisoId, userId: user.id, origen: "resultado", forzar: true }); };
  const r = await lecturaDe(admin, new Anthropic(), avisoId, new Date(), leer);
  const fotos = (await fotosDe(admin, [avisoId]))[avisoId] ?? 0;
  return NextResponse.json({ ...r, fotos }, { status: r.estado === "generando" ? 202 : 200, headers: { "Cache-Control": "no-store" } });
}
