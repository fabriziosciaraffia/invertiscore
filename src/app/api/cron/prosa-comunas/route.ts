import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { capturarFallaDeCron } from "@/lib/observabilidad";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { esComunaDelRoster } from "@/lib/data/comunas-roster";
import { getAllComunasStats } from "@/lib/data/comunas-seo";
import { getTodasLasProsas } from "@/lib/data/comuna-prosa";
import { generadorAnthropic, regenerarProsas } from "@/lib/data/comuna-prosa-generador";

// ─────────────────────────────────────────────────────────────────────────────
// La prosa de las páginas de comuna se regenera sola (20-oct-2026, goal de Fabrizio). Cada lunes a las 05:30 UTC —después
// de la evaluación nocturna de las 04:20, con los números de la semana— regenera con el prompt v6 SOLO las prosas que
// `detectarDrift` marca desfasadas contra su tabla; las que están al día no se tocan (ni una llamada al modelo). Los
// controles son los de siempre (comuna-prosa-generador.ts): una cifra que no está en los datos o una comparación que no
// cuadra se rechaza y se reintenta UNA vez con lo rechazado; si vuelve a fallar, queda la prosa anterior y la corrida
// cuenta como falla parcial, que va al resumen del día de los crons (cron-alertas.ts › CRONS_AL_RESUMEN). La página ya
// esconde la que contradice su tabla, así que lo peor que puede pasar es una semana con la síntesis calculada.
//
// Lo regenerado se revalida al tiro (revalidatePath): la página es ISR de un día y si no, mostraría la anterior.
// `?dry=1` genera y controla sin guardar ni registrar la corrida; `?solo=<slug>` y `?todas=1`, para correrla a mano.
//
// COSTO (medido el 20-oct-2026, las 25 con `--todas`, v6): 38 llamadas (13 reintentos), 97.101 tokens de entrada y 10.600
// de salida, 88 s con 4 a la vez; con claude-sonnet-4-6 (US$3 y US$15 por millón), unos US$0,45. Un lunes normal paga
// solo las desfasadas, y una semana sin desfase no llama al modelo. Cada corrida lo dice en su respuesta (`tokens`).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 800;
const RUTA = "GET /api/cron/prosa-comunas";
/** Corte voluntario antes del maxDuration: lo que no empezó queda para el lunes siguiente y la corrida lo dice. */
const PRESUPUESTO_MS = 600_000;
const CONCURRENCIA = 4;

/** La clave de Anthropic no sirve: ninguna prosa se puede generar hasta que una persona la cambie (regla 2). */
const esClaveInvalida = (e: string) => /\b401\b|authentication_error|invalid x-api-key/i.test(e);

export async function GET(request: Request) {
  const t0 = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const solo = url.searchParams.get("solo");
  const todas = url.searchParams.get("todas") === "1";

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (!dry) await latirCron(sb, "prosa-comunas");
  if (!process.env.ANTHROPIC_API_KEY) {
    return cerrarCron(sb, "prosa-comunas", CORRIDA_FALLIDA, {
      error: "falta ANTHROPIC_API_KEY",
      accion: { codigo: "anthropic-sin-clave", texto: "Falta ANTHROPIC_API_KEY en Vercel: la prosa de las comunas no se puede regenerar." },
    }, { registrar: !dry });
  }

  let parque: Awaited<ReturnType<typeof getAllComunasStats>>;
  let prosas: Awaited<ReturnType<typeof getTodasLasProsas>>;
  try {
    [parque, prosas] = await Promise.all([getAllComunasStats(), getTodasLasProsas()]);
    parque = parque.filter((s) => esComunaDelRoster(s.slug));
    if (parque.length === 0) throw new Error("ninguna comuna del roster con números");
  } catch (e) {
    capturarFallaDeCron(e, { ruta: RUTA, operacion: "leer" });
    return cerrarCron(sb, "prosa-comunas", CORRIDA_FALLIDA, { error: `leer: ${String(e).slice(0, 200)}` }, { registrar: !dry });
  }

  const r = await regenerarProsas({
    parque,
    prosas,
    generar: generadorAnthropic(new Anthropic()),
    guardar: async (fila) => {
      const { error } = await sb.from("comuna_prosa").upsert(fila, { onConflict: "slug" });
      if (error) throw new Error(error.message);
    },
    todas,
    solo,
    dry,
    concurrencia: CONCURRENCIA,
    presupuestoMs: PRESUPUESTO_MS,
  });
  if (!dry) for (const slug of r.regeneradas) revalidatePath(`/comunas/${slug}`);

  // Lo que quedó con la anterior, por comuna y con su porqué: es lo que dice el resumen del día.
  const errores = [
    ...r.rechazadas.map((x) => `${x.comuna}: quedó la anterior — ${x.errores.join("; ")}`.slice(0, 300)),
    ...r.sinTiempo.map((s) => `${s}: no alcanzó a correr en esta corrida, quedó la anterior`),
  ];
  const claveInvalida = r.rechazadas.length > 0 && r.rechazadas.every((x) => x.errores.some(esClaveInvalida));
  return cerrarCron(sb, "prosa-comunas",
    { procesados: r.regeneradas.length + r.rechazadas.length + r.sinTiempo.length, exitosos: r.regeneradas.length, fallidos: r.rechazadas.length + r.sinTiempo.length },
    {
      unidad: "prosas",
      ...(errores.length ? { errores } : {}),
      ...(claveInvalida ? { accion: { codigo: "anthropic-401", texto: "La clave de Anthropic de Vercel no sirve (401): ninguna prosa de las comunas se regeneró." } } : {}),
      regeneradas: r.regeneradas,
      alDia: r.intactas.length,
      sinStats: r.sinStats,
      llamadas: r.llamadas,
      tokens: r.tokens,
      ms: Date.now() - t0,
      dry,
      ...(dry ? { ensayo: r.ensayo } : {}),
    },
    { registrar: !dry });
}
