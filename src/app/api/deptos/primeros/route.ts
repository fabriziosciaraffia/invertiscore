import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { esPuerta } from "@/lib/atribucion-puerta";
import { primerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";

// GET /api/deptos/primeros (16-oct-2026, la puerta B; 20-oct-2026, todas las puertas): los primeros deptos de la cuenta
// con sesión, para «Estás dentro» al terminar (lib/deptos/primeros-servidor.ts). Mientras el correo del día revisa fichas,
// `revisando` y la pantalla vuelve a preguntar.
// LA MEDICIÓN (20-oct-2026): `primera_seleccion_vista` una vez por cuenta (uuid determinista), con la puerta por la que
// entró —la fijada en el servidor; si todavía no está, la candidata que manda el navegador (`?puerta=`)—, cuántos deptos
// vio y de dónde salieron. Es el paso entre el registro y el primer análisis del panel de activación.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  try {
    // El ticket de la cuenta nueva (21-oct-2026, lib/guia/compra-desde-depto.ts): el precio del pack en el aviso sin saldo.
    const [r, ticket] = await Promise.all([primerosDeLaCuenta(admin, user.id), ticketDeCuentaDisponible(admin, user)]);
    const candidata = new URL(request.url).searchParams.get("puerta");
    void (async () => {
      const { data: atr } = await admin.from("user_attribution").select("puerta").eq("user_id", user.id).maybeSingle();
      const puerta = esPuerta(atr?.puerta) ? atr.puerta : esPuerta(candidata) ? candidata : null;
      await capturarServidor({
        event: "primera_seleccion_vista", distinctId: user.id, uuid: uuidDeterminista(`primera_seleccion:${user.id}`),
        properties: { puerta, n: r.items.length, fuente: r.fuente, faltan: r.faltan.length, con_regalo: !!r.regaloVence, minutos_desde_alta: user.created_at ? Math.round((Date.now() - Date.parse(user.created_at)) / 60_000) : null },
      });
    })().catch(() => {});
    return NextResponse.json({ ...r, ticket }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/deptos/primeros", operacion: "primeros", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
