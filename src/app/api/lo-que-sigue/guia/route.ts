import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { calcularYGuardarGuia, guiaGuardada } from "@/lib/guia/guia-servidor";
import { firmaPagoValida } from "@/lib/lo-que-sigue/firma-pago";
import { pagoAbreElInforme } from "@/lib/lo-que-sigue/retorno-pago";

// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (30-sep-2026): los parecidos del informe `a`, recalculados con los números
// de la persona. La guía se calcula al confirmarse el pago del pack y queda guardada por informe
// (`guias_calculadas`): acá se lee hecha. Si todavía no está —el pago se confirmó hace un instante, o
// venció—, se calcula y se guarda. Devuelve lo que la pantalla muestra y nada más (`respuestaGuia`):
// sin enlace al aviso ni textos del aviso. El id del informe llega en la vuelta de Flow.
//
// QUIÉN LA LEE (02-oct-2026): hasta acá cualquiera con el id de un informe veía la guía y disparaba su
// cálculo. Ahora, una de dos: (a) la sesión del dueño del informe de origen (o admin), o (b) la firma del
// pago PAGADO de ESE informe (`order` + `t`, la misma de la vuelta de Flow: quien pagó el pack sin cuenta).
// Sin ninguna, 401 y no se calcula nada.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const a = sp.get("a") ?? "";
  if (!UUID.test(a)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const admin = createAnonPipelineClient();
  try {
    if (!(await puedeLeerLaGuia(admin, a, sp.get("order"), sp.get("t")))) {
      return NextResponse.json({ error: "sin-acceso" }, { status: 401 });
    }
    const guardada = await guiaGuardada(admin, a);
    const r = guardada ?? (await calcularYGuardarGuia(admin, a));
    return NextResponse.json(r, { headers: { "Cache-Control": "private, max-age=300", "x-guia": guardada ? "guardada" : "calculada" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/lo-que-sigue/guia", operacion: "guia", extra: { analysisId: a } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}

/** (a) sesión del dueño del informe (o admin) · (b) la firma de un pago pagado de ESE informe. */
async function puedeLeerLaGuia(admin: ReturnType<typeof createAnonPipelineClient>, analysisId: string, order: string | null, firma: string | null): Promise<boolean> {
  const { data: { user } } = await createClient().auth.getUser();
  if (user) {
    if (isAdminUser(user.email)) return true;
    const { data: fila } = await admin.from("analisis").select("user_id").eq("id", analysisId).maybeSingle();
    if (fila?.user_id && fila.user_id === user.id) return true;
  }
  const firmaValida = firmaPagoValida(order, firma);
  if (!firmaValida || !order) return false;
  const { data: pago } = await admin.from("payments").select("status, analysis_id, user_id").eq("commerce_order", order).maybeSingle();
  return pagoAbreElInforme({ firmaValida, pago: (pago as { status: string; analysis_id: string | null; user_id: string | null } | null) ?? null, analysisId });
}
