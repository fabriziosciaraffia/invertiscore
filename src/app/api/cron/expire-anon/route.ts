import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiError } from "@/lib/observabilidad";
import { latirCron } from "@/lib/cron-heartbeat";

const RUTA = "GET /api/cron/expire-anon";

/**
 * Cron · Expiración de la VENTANA DE CLAIM de análisis anónimos (cap F2-2).
 *
 * NO borra filas (decisión F2-1 #2 de Fabrizio): los análisis anónimos no
 * reclamados son data de mercado propietaria (demanda real por comuna/precio —
 * insumo futuro de páginas comuna y calibración) y se RETIENEN. Lo único que
 * expira es el token de claim: a los 30 días, `anon_claim_token_hash` pasa a
 * NULL y la fila queda huérfana definitiva (nadie puede adoptarla).
 *
 * Guardas del predicado (dev y prod comparten base — esto es lo que hace el
 * UPDATE seguro):
 *  · charge_mode = 'anon_cap' → SOLO filas nacidas por el cap. Los fixtures QA
 *    con user_id NULL (AUDIT_BASE_*, etc.) no lo tienen y quedan intactos.
 *  · user_id IS NULL → una fila reclamada jamás se toca (el claim ya limpió el
 *    hash de todos modos; doble cinturón).
 *  · anon_claim_token_hash IS NOT NULL → idempotente: tras el update las filas
 *    ya no matchean.
 *
 * `?dry=1`: cuenta lo que expiraría, sin escribir. `expirarian` es el conteo
 * REAL (count exact, sin tope); `filas` es una muestra de hasta MUESTRA_DRY
 * para mirar, no para contar. Hasta el 04-sep-2026 el dry hacía un select con
 * `.limit(100)` y reportaba `data.length`: un dry decía "100" cuando el real
 * iba a expirar 340. Auth: Vercel Cron con `Authorization: Bearer
 * ${CRON_SECRET}` (patrón expire-grace).
 */

const VENTANA_CLAIM_DIAS = 30;
/** Filas que el dry-run lista como muestra. El conteo va aparte y sin tope. */
const MUESTRA_DRY = 100;

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/expire-anon] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createAdminClient();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió".
  // En dry-run no se late: un ensayo no debe figurar como corrida sana.
  if (!dry) await latirCron(supabase, "expire-anon");

  const corte = new Date(Date.now() - VENTANA_CLAIM_DIAS * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (dry) {
      // Mismo predicado que el UPDATE real, dos lecturas: el conteo exacto (head,
      // sin filas ni tope) y una muestra acotada para inspeccionar.
      const { count, error: errCount } = await supabase
        .from("analisis")
        .select("id", { count: "exact", head: true })
        .eq("charge_mode", "anon_cap")
        .is("user_id", null)
        .not("anon_claim_token_hash", "is", null)
        .lt("created_at", corte);
      if (errCount) throw errCount;
      const { data, error } = await supabase
        .from("analisis")
        .select("id, comuna, created_at")
        .eq("charge_mode", "anon_cap")
        .is("user_id", null)
        .not("anon_claim_token_hash", "is", null)
        .lt("created_at", corte)
        .order("created_at", { ascending: true })
        .limit(MUESTRA_DRY);
      if (error) throw error;
      return NextResponse.json({
        dry: true,
        expirarian: count ?? 0,
        filas: data ?? [],
        muestraTope: MUESTRA_DRY,
        muestraCapada: (count ?? 0) > MUESTRA_DRY,
      });
    }

    const { data, error } = await supabase
      .from("analisis")
      .update({ anon_claim_token_hash: null })
      .eq("charge_mode", "anon_cap")
      .is("user_id", null)
      .not("anon_claim_token_hash", "is", null)
      .lt("created_at", corte)
      .select("id");
    if (error) throw error;

    const expiradas = data?.length ?? 0;
    console.log(`[cron/expire-anon] ventanas de claim expiradas: ${expiradas}`);
    return NextResponse.json({ ok: true, expiradas });
  } catch (error) {
    captureApiError(error, { ruta: RUTA, operacion: "expirar-claim-anonimo" });
    return NextResponse.json({ error: "Error expirando claims anónimos" }, { status: 500 });
  }
}
