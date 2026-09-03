import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiWarning } from "@/lib/observabilidad";
import { FUENTE_SENTRY, METRICA_ERRORES_1D, guardarMetrica } from "@/lib/metrics-daily";
import { latirCron } from "@/lib/cron-heartbeat";

/**
 * Cron · Conteo diario de errores de Sentry → metrics_daily.
 *
 * POR QUÉ UN CRON Y NO UNA LLAMADA EN VIVO: el panel no puede depender de una
 * API de terceros para renderizar. Un timeout de Sentry dejaría /admin/operacion
 * colgado, y una pastilla no justifica pagar latencia de red en cada visita.
 * Este cron escribe una fila por día; el panel lee de la tabla.
 *
 * QUÉ ENDPOINT DE SENTRY Y POR QUÉ:
 * Se usa `/organizations/{org}/stats_v2/`, que devuelve una SERIE AGREGADA de
 * conteos. Las alternativas devuelven listas y habría que paginarlas enteras
 * para contar:
 *   · /issues/  → lista de GRUPOS (un issue con 500 eventos cuenta como 1).
 *                 Responde "cuántos problemas distintos hay", no "cuántos
 *                 errores ocurrieron" — que es lo que la pastilla mide.
 *   · /events/  → lista de eventos individuales. El dato correcto, pero pidiendo
 *                 miles de payloads completos para terminar haciendo un .length.
 * stats_v2 devuelve el número directamente, filtrado por `category=error`
 * (excluye transacciones de performance, que con tracing al 10% son la mayoría
 * del volumen) y `outcome=accepted` (lo que Sentry realmente ingirió, sin
 * contar lo que descartó por rate-limit o por los filtros de ignoreErrors).
 *
 * stats_v2 pide el ID NUMÉRICO del proyecto, pero lo que hay en el env es el
 * slug — de ahí la primera llamada, que lo resuelve.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 * Degrada sin romper: sin token o con la API caída NO escribe fila. Un día sin
 * fila se lee como "sin dato", que es honesto; escribir un cero sería inventar
 * una medición que no ocurrió.
 */

const SENTRY_API = "https://sentry.io/api/0";
/** Ventana de la medición. El cron corre a diario, así que 24h no deja huecos. */
const VENTANA = "24h";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function sentryFetch(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Sin cache: es un cron, siempre queremos el dato fresco.
    cache: "no-store",
  });
  if (!res.ok) {
    // El cuerpo se recorta: un error de Sentry puede traer HTML entero.
    const cuerpo = await res.text().catch(() => "");
    throw new Error(`Sentry ${res.status} en ${new URL(url).pathname}: ${cuerpo.slice(0, 200)}`);
  }
  return res.json();
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/sentry-metrics] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Latido ANTES del trabajo: registra "corrió", no "terminó bien" — importa
  // sobre todo acá, donde la falta de config sale por un camino que no escribe
  // ninguna métrica. Ver la doctrina en cron-heartbeat.ts.
  await latirCron(createAdminClient(), "sentry-metrics");

  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const proyecto = process.env.SENTRY_PROJECT;

  // Config incompleta: se avisa una vez por corrida y se sale sin escribir. No
  // es un 500 — el cron no está roto, le falta configuración, y devolver error
  // haría que Vercel lo marque como fallo todas las noches.
  if (!token || !org || !proyecto) {
    const faltan = [
      !token && "SENTRY_AUTH_TOKEN",
      !org && "SENTRY_ORG",
      !proyecto && "SENTRY_PROJECT",
    ].filter(Boolean);
    console.warn("[cron/sentry-metrics] sin configurar:", faltan.join(", "));
    captureApiWarning(new Error(`Faltan variables de Sentry: ${faltan.join(", ")}`), {
      ruta: "GET /api/cron/sentry-metrics",
      operacion: "config-sentry-incompleta",
    });
    return NextResponse.json({ ok: false, skipped: "config-incompleta", faltan });
  }

  try {
    // 1) slug → id numérico (stats_v2 no acepta slugs).
    const proyectoData = (await sentryFetch(
      `${SENTRY_API}/projects/${org}/${proyecto}/`,
      token
    )) as { id?: string | number };
    const projectId = proyectoData?.id;
    if (!projectId) throw new Error(`El proyecto ${org}/${proyecto} no devolvió id`);

    // 2) conteo agregado de errores aceptados en la ventana.
    const params = new URLSearchParams({
      field: "sum(quantity)",
      category: "error",
      outcome: "accepted",
      statsPeriod: VENTANA,
      interval: "1d",
      project: String(projectId),
    });
    const stats = (await sentryFetch(`${SENTRY_API}/organizations/${org}/stats_v2/?${params}`, token)) as {
      groups?: Array<{ totals?: Record<string, number> }>;
    };

    // stats_v2 devuelve un array de grupos; con un solo category+outcome viene
    // uno solo, pero se suman todos por si Sentry decide agrupar distinto.
    const total = (stats.groups ?? []).reduce(
      (acc, g) => acc + (Number(g?.totals?.["sum(quantity)"]) || 0),
      0
    );

    // La fecha es el día en que se mide. La ventana de 24h cruza dos días
    // naturales; `meta.ventana` deja constancia de eso para que nadie lea la
    // fila como "los errores del calendario del día X".
    const hoy = new Date().toISOString().slice(0, 10);
    const guardado = await guardarMetrica(createAdminClient(), {
      fecha: hoy,
      fuente: FUENTE_SENTRY,
      metrica: METRICA_ERRORES_1D,
      valor: total,
      meta: {
        ventana: VENTANA,
        proyecto,
        project_id: String(projectId),
        endpoint: "stats_v2",
        category: "error",
        outcome: "accepted",
      },
    });

    if (!guardado) {
      captureApiWarning(new Error("No se pudo escribir metrics_daily"), {
        ruta: "GET /api/cron/sentry-metrics",
        operacion: "guardar-metrica",
        extra: { fecha: hoy, valor: total },
      });
      return NextResponse.json({ ok: false, error: "escritura-fallida", valor: total });
    }

    return NextResponse.json({ ok: true, fecha: hoy, errores: total, ventana: VENTANA });
  } catch (e) {
    // La API de Sentry falló. Se reporta y NO se escribe: un día sin fila se lee
    // como "sin dato", que es la verdad. Escribir 0 haría creer que hubo cero
    // errores cuando lo que hubo fue cero mediciones.
    console.error("[cron/sentry-metrics] error consultando Sentry:", e);
    captureApiWarning(e, {
      ruta: "GET /api/cron/sentry-metrics",
      operacion: "consultar-sentry",
    });
    return NextResponse.json({ ok: false, error: "sentry-no-disponible" });
  }
}

// Vercel Cron dispara GET. Reusamos el handler POST (con su validación Bearer
// CRON_SECRET) para no duplicar lógica ni perder la auth — mismo patrón que
// scrape-nuevos y scrape-unidades-nuevas.
export const GET = POST;
