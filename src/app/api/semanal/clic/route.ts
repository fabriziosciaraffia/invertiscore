import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { chequearAlClic } from "@/lib/guia/semanal-servidor";
import { RUTA_SUELTO_SEMANAL } from "@/lib/guia/semanal";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/semanal/clic (02-oct-2026): todo enlace del correo semanal pasa por acá. Mide el clic
// (`semanal_clic`), y si es un depto, RELEE SU FICHA (con la memoria y el tope de siempre): si se
// despublicó, la página lo dice. «Analizar uno · $9.990» sin saldo va a comprar el suelto, marcado como
// venido del correo.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{20,80}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  const a = url.searchParams.get("a");
  const ir = url.searchParams.get("ir");
  const volver = (ruta: string) => NextResponse.redirect(new URL(ruta, url.origin), 302);
  if (!TOKEN.test(t)) return volver("/dashboard");

  const admin = createServiceClient();
  const { data: sel } = await admin.from("semanal_selecciones").select("id, user_id, semana, variante, items").eq("token", t).maybeSingle();
  if (!sel) return volver("/dashboard");
  const avisoId = a && UUID.test(a) && ((sel.items ?? []) as Array<{ avisoId: string }>).some((i) => i.avisoId === a) ? a : null;

  void capturarServidor({
    event: "semanal_clic",
    distinctId: sel.user_id as string,
    properties: { semana: sel.semana, variante: sel.variante, aviso_id: avisoId, destino: ir === "comprar" ? "comprar" : avisoId ? "depto" : "seleccion" },
  }).catch(() => {});

  if (ir === "comprar") return volver(RUTA_SUELTO_SEMANAL);
  if (!avisoId) return volver(`/semanal?t=${t}`);
  const estado = await chequearAlClic(admin, avisoId).catch(() => "sin-chequeo" as const);
  return volver(`/semanal?t=${t}&a=${avisoId}${estado === "despublicado" ? "&d=1" : ""}`);
}
