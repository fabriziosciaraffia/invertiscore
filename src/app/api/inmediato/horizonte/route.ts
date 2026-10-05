import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de un clic a «¿Cuándo piensas comprar?» (05-oct-2026): el correo de los 60 días trae un
// token por persona. «Ya» vuelve a correr el plazo de los avisos; las otras dos dejan solo el semanal.
// El token sirve una vez.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = /^[0-9a-f]{20,80}$/i;
const HORIZONTES = new Set(["ya", "meses", "mirando"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  const h = url.searchParams.get("h") ?? "";
  const volver = (q: string) => NextResponse.redirect(new URL(`/semanal/baja?tipo=horizonte${q}`, url.origin), 302);
  if (!TOKEN.test(t) || !HORIZONTES.has(h)) return volver("&error=1");
  const admin = createServiceClient();
  const { data, error } = await admin.from("perfil_busqueda")
    .update({ horizonte_compra: h, actualizado_at: new Date().toISOString(), ya_pregunta_token: null })
    .eq("ya_pregunta_token", t).select("user_id");
  reportarFalloQuery(error, { ruta: "api/inmediato/horizonte", operacion: "responder" });
  const userId = (data?.[0]?.user_id as string | undefined) ?? null;
  if (!userId) return volver("&error=1");
  void capturarServidor({ event: "aviso_inmediato_respuesta", distinctId: userId, properties: { horizonte: h } }).catch(() => {});
  return volver(`&h=${h}`);
}
