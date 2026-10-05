import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { chequearAlClic, seleccionPorToken } from "@/lib/guia/semanal-servidor";
import { rutaSueltoSemanal } from "@/lib/guia/semanal";
import { RUTA_SUELTO_INMEDIATO } from "@/lib/guia/inmediato";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/semanal/clic (02-oct-2026): todo enlace del correo semanal pasa por acá. Mide el clic
// (`semanal_clic`), y si es un depto, RELEE SU FICHA (con la memoria y el tope de siempre): si se
// despublicó, la página lo dice. «Analizar uno · $9.990» sin saldo va a comprar el suelto, marcado como
// venido del correo. El aviso inmediato (05-oct-2026) pasa por acá también: mide `aviso_inmediato_clic`
// y su compra va marcada como venida del aviso.
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
  const sel = await seleccionPorToken(admin, t);
  if (!sel) return volver("/dashboard");
  const avisoId = a && UUID.test(a) && sel.items.some((i) => i.avisoId === a) ? a : null;
  const destino = ir === "comprar" ? "comprar" : avisoId ? "depto" : "seleccion";

  if (sel.fuente === "inmediato") {
    void capturarServidor({ event: "aviso_inmediato_clic", distinctId: sel.user_id, properties: { dia: sel.semana, aviso_id: avisoId, destino } }).catch(() => {});
  } else {
    void capturarServidor({
      event: "semanal_clic",
      distinctId: sel.user_id as string,
      properties: { semana: sel.semana, variante: sel.variante, aviso_id: avisoId, destino },
    }).catch(() => {});
  }

  if (ir === "comprar" && sel.fuente === "inmediato") return volver(RUTA_SUELTO_INMEDIATO);
  if (ir === "comprar") return volver(rutaSueltoSemanal(sel.variante as "banda" | "tarjetas" | null));
  if (!avisoId) return volver(`/semanal?t=${t}`);
  const estado = await chequearAlClic(admin, avisoId).catch(() => "sin-chequeo" as const);
  return volver(`/semanal?t=${t}&a=${avisoId}${estado === "despublicado" ? "&d=1" : ""}`);
}
