import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { capturarServidor } from "@/lib/posthog-servidor";
import { filtrosDeUrl } from "@/lib/explorar/explorar";
import { cargarExplorar, eventoExplorarVista, explorarCerradoPara, filtrosDeLaCuenta } from "@/lib/explorar/servidor";
import { robotDeVisita } from "@/lib/vista-entrada";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar?c=…&t=…&r=min-max&p=20&z=25 (23-oct-2026): los pines del mapa para una búsqueda, con la evaluación
// de la noche. Solo con sesión (los pines azules son los informes de esta cuenta). Sin filtros válidos, los del perfil.
// NO ESCRIBE NADA: cambiar los chips no toca el perfil guardado, y explorar no gasta. Con `evento=1` (el navegador cambió
// un chip) deja «explorar_vista» con los filtros y cuántos pines; la vista de entrada la deja la página.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
// Una combinación nueva calcula toda la comuna en el momento (24-oct-2026, medido: ver lib/explorar/servidor.ts).
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  try {
    // SIN SALDO, CERRADO (24-oct-2026, lib/explorar/explorar.ts › explorarCerrado): no hay otra búsqueda ni pines con detalle.
    if (await explorarCerradoPara(admin, user.id)) return NextResponse.json({ error: "cerrado" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const sp = new URL(request.url).searchParams;
    const filtros = filtrosDeUrl(sp) ?? (await filtrosDeLaCuenta(admin, user.id)).filtros;
    const d = await cargarExplorar(admin, user, filtros);
    if (sp.get("evento") === "1") {
      const analizados = d.pines.filter((p) => d.analizados[p.avisoId]).length;
      void capturarServidor(eventoExplorarVista({ userId: user.id, filtros, n: d.n, analizados, fuente: "cambio", cuenta: d.cuenta, robot: robotDeVisita(request.headers.get("user-agent"), request.headers) })).catch(() => false);
    }
    return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar", operacion: "pines", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
