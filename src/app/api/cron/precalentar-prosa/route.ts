import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiError } from "@/lib/observabilidad";
import { latirCron } from "@/lib/cron-heartbeat";
import Anthropic from "@anthropic-ai/sdk";
import { generateAiAnalysis, PROMPT_VERSION_LTR } from "@/lib/ai-generation";
import { PROMPT_VERSION_STR } from "@/lib/ai-generation-str";
import { generarYPersistirProsaStr } from "@/lib/str-prosa-persist";
import { DEMO_ANALYSIS_ID } from "@/lib/demo";

const RUTA = "GET /api/cron/precalentar-prosa";

/**
 * Cron · PRECALENTADO SELECTIVO DE PROSA tras un bump de PROMPT_VERSION.
 *
 * ALCANCE (31-ago-2026): ya NO barre el parque. Cubre solo las filas SIN DUEÑO de
 * las últimas 48 h, más el demo — la población que no puede regenerar por su
 * cuenta. Todo lo demás pasó a regeneración bajo demanda al abrir el informe.
 *
 * POR QUÉ EXISTE. Subir `PROMPT_VERSION_*` deja stale al parque entero de golpe:
 * el informe descarta la prosa vieja y la regenera al abrirse. Eso funciona para
 * el dueño logueado —regenera bajo demanda— pero NO para quien mira sin sesión:
 * `POST /api/analisis/ai` exige usuario y responde 401. El 27-ago-2026 eso dejó
 * informes mudos en producción, el demo de la landing incluido.
 *
 * Y NO es un caso de borde: al medir el parque, 325 de 378 análisis LTR de los
 * últimos 14 días no tienen dueño (86%). El grueso de lo que se mira es anónimo,
 * así que la regeneración perezosa no cubre a la mayoría del tráfico.
 *
 * Corre solo, como paso del proceso, y no como script que alguien tiene que
 * acordarse de ejecutar: fue la instrucción explícita de Fabrizio.
 *
 * EL TOPE REAL ES EL RELOJ, NO LA PLATA. Una generación LTR tarda p50 114 s /
 * p90 157 s / max 277 s (228 generaciones reales, 7 días). Con `maxDuration` de
 * 300 s entran UNA o DOS por corrida, y ninguna cantidad de optimismo cambia eso:
 * por eso el loop lleva presupuesto de tiempo y no arranca una generación que no
 * alcanza a terminar. Un tope alto de filas sería decorativo.
 *
 * CADENCIA HORARIA (`vercel.json`) desde el 31-ago-2026. Con el barrido apagado la
 * cola es de unas pocas filas anónimas de 48 h, así que las 144 corridas diarias
 * de la cadencia anterior encontraban trabajo en una fracción: 24 alcanzan de
 * sobra. Sigue siendo mayor que `maxDuration`, que era la razón original:
 * dos corridas solapadas elegirían las mismas filas —ambas leen el mismo tope de
 * la lista antes de que la primera persista— y se pagaría dos veces la misma
 * generación. Ritmo resultante ~12/hora: drenar un parque recién bumpeado toma
 * cerca de un día.
 *
 * COSTO, para dimensionarlo: ~US$0,23 por generación a la tarifa de Sonnet con
 * la mediana de tokens del parque. Drenar las ~318 stale de una ventana de 14
 * días cuesta del orden de US$75, UNA VEZ POR BUMP — no es gasto recurrente,
 * porque los análisis nuevos nacen ya en la versión vigente.
 *
 * IDEMPOTENTE por construcción: solo toca filas cuya `promptVersion` no es la
 * vigente, así que una corrida sobre un parque fresco no genera nada.
 *
 * STR (extensión 28-ago, mitigación del bump v8 de PROMPT_VERSION_STR): el
 * mismo cron drena también la prosa STR — el predicado de frescura es POR TIPO
 * (short-term contra PROMPT_VERSION_STR, el resto contra PROMPT_VERSION_LTR) y
 * la generación va por el camino compartido de producción
 * (`generarYPersistirProsaStr`, el mismo del submit y del on-demand). El
 * presupuesto de tiempo es el mismo: si una generación STR resulta más corta
 * que el p90 LTR, sobra margen; nunca al revés.
 *
 * DRY-RUN: `?dry=1` devuelve el triage (stale por tipo + primeros ids) sin
 * generar nada — para verificar el cableado sin gastar tokens ni escribir.
 */

export const maxDuration = 300;

/** Cota de filas por corrida. El presupuesto de tiempo es quien manda de verdad. */
const LIMITE_POR_CORRIDA = 3;
/** Se corta acá para que la función alcance a responder y a dejar su latido. */
const PRESUPUESTO_MS = 240_000;
/** No se arranca una generación sin margen para el p90 (157 s) más su cola. */
const MARGEN_GENERACION_MS = 175_000;
/**
 * VENTANA DEL PRECALENTADO SELECTIVO — 48 horas, no 14 días.
 *
 * EL BARRIDO POR ANTIGÜEDAD SE APAGÓ (31-ago-2026). Precalentar 14 días de parque
 * regeneraba cientos de informes por si alguien los reabría, y la regeneración
 * bajo demanda ya cubre a quien puede dispararla: el dueño con sesión abre, el
 * cliente regenera, dos minutos y tiene texto nuevo.
 *
 * QUÉ QUEDA Y POR QUÉ. El precalentado sobrevive SOLO donde la regeneración bajo
 * demanda no existe: `POST /api/analisis/ai` exige sesión y dueño, así que un
 * anónimo nunca puede regenerar. Para ellos el informe ahora muestra la prosa
 * vieja fechada (ver `mostrarProsaStale` en la página del análisis), que es la
 * red de seguridad; el precalentado de 48 h es lo que hace que la mayoría ni
 * llegue a necesitarla, porque es la ventana en que un comprador vuelve a mirar
 * el análisis que acaba de hacer.
 *
 * POR QUÉ NO SE USA `informe_visible_at` como criterio, que sería lo obvio: la
 * RPC que lo escribe es NULL-only y SECURITY INVOKER, o sea que **solo el dueño
 * la escribe** — para una fila anónima el campo es estructuralmente NULL. Filtrar
 * por "ya abierto" habría excluido exactamente a la población que se quiere
 * cubrir. Medido: 120 marcas sobre 769 filas con prosa.
 */
const DIAS_RECIENTES = 2;

export async function GET(request: Request) {
  const t0 = Date.now();
  try {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const dry = new URL(request.url).searchParams.get("dry") === "1";

    const desde = new Date(Date.now() - DIAS_RECIENTES * 86400_000).toISOString();
    // Se proyecta SOLO la versión del jsonb (no el `ai_analysis` entero, que es
    // pesado) y el descarte se decide en JS. En SQL sería la trampa conocida del
    // repo: `columna <> 'x'` da NULL —no true— cuando la columna es NULL, así que
    // un `.neq` pelado se comería justo las filas que hay que precalentar: las de
    // `tipo_analisis` NULL (LTR viejos) y las de prosa anterior al versionado,
    // que no tiene `promptVersion` y es la más stale de todas.
    const { data: filas, error } = await supabase
      .from("analisis")
      .select("id, created_at, tipo_analisis, user_id, pv:ai_analysis->promptVersion")
      .not("ai_analysis", "is", null)
      .or(`created_at.gte.${desde},id.eq.${DEMO_ANALYSIS_ID}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    // `pv` se compara vía Number a propósito: según cómo PostgREST serialice el
    // valor del jsonb puede llegar como 12 o como "12", y un `!==` estricto
    // contra la forma equivocada daría TODAS las filas por stale — regenerando
    // prosa fresca y pagándola. Con Number, ambas formas coinciden y el null
    // (prosa sin versionar) sigue cayendo del lado correcto.
    type FilaPrecalentado = { id: string; tipo_analisis: string | null; user_id: string | null; pv: number | string | null };
    // Predicado de frescura POR TIPO: cada modalidad contra SU versión vigente.
    // `<` Y NO `!==`: una versión SUPERIOR a la vigente es prosa de una rama que
    // todavía no mergea, y regenerarla la pisa. Pasó tres bumps seguidos — en el
    // último sobrevivió UNA de las filas regeneradas para QA, y solo porque caía
    // fuera de la ventana de 14 días. Cada pisada cuesta una generación y obliga
    // a rehacer los shots.
    //
    // El riesgo simétrico —revertir un bump y quedarse con prosa de una versión
    // que ya no existe— no se ha dado en 13 bumps, y la salida natural de un mal
    // bump es subir a la siguiente, no volver atrás: con eso el predicado vuelve
    // a cubrirlas.
    //
    // El guard de NaN es necesario: sin él un `pv` no numérico daría `NaN < X` =
    // false y pasaría por fresco. Desconocido tiene que seguir contando stale.
    const esStale = (f: FilaPrecalentado) => {
      const vigente = f.tipo_analisis === "short-term" ? PROMPT_VERSION_STR : PROMPT_VERSION_LTR;
      const n = Number(f.pv);
      return f.pv == null || !Number.isFinite(n) || n < vigente;
    };
    // SOLO LO QUE NADIE MÁS PUEDE ARREGLAR: filas SIN dueño (el anónimo no puede
    // regenerar) más el demo. Una fila con dueño se regenera sola cuando él la
    // abre, y precalentarla es pagar dos veces por el mismo texto.
    const soloSinDueno = (f: FilaPrecalentado) => f.user_id === null || f.id === DEMO_ANALYSIS_ID;
    const stale = ((filas ?? []) as unknown as FilaPrecalentado[]).filter(esStale).filter(soloSinDueno);
    let ok = 0;
    let fallidos = 0;
    let cortadoPorTiempo = false;

    // El DEMO va primero pase lo que pase: es la única superficie del informe que
    // se ve sin sesión y la que enlaza la landing. Su pinneo lo salva de quedar
    // mudo, pero igual conviene que quede en la versión vigente cuanto antes, y
    // depender de que caiga dentro de la ventana de recientes sería frágil.
    const orden = [
      ...stale.filter((f) => f.id === DEMO_ANALYSIS_ID),
      ...stale.filter((f) => f.id !== DEMO_ANALYSIS_ID),
    ];

    if (dry) {
      return NextResponse.json({
        dry: true,
        staleDetectados: stale.length,
        staleLtr: stale.filter((f) => f.tipo_analisis !== "short-term").length,
        staleStr: stale.filter((f) => f.tipo_analisis === "short-term").length,
        primeros: orden.slice(0, LIMITE_POR_CORRIDA).map((f) => ({ id: f.id, tipo: f.tipo_analisis ?? "long-term" })),
      });
    }

    const anthropic = new Anthropic();
    for (const fila of orden.slice(0, LIMITE_POR_CORRIDA)) {
      if (Date.now() - t0 + MARGEN_GENERACION_MS > PRESUPUESTO_MS) {
        cortadoPorTiempo = true;
        break;
      }
      try {
        if (fila.tipo_analisis === "short-term") {
          // El camino compartido pide la fila completa; un select extra por
          // generación es nada contra los ~2 min de la generación misma.
          const { data: row } = await supabase.from("analisis").select("*").eq("id", fila.id).single();
          if (!row) { fallidos++; continue; }
          const r = await generarYPersistirProsaStr({
            analysisId: fila.id,
            analysis: row as Record<string, unknown>,
            supabase,
            anthropic,
            trigger: "precalentado",
          });
          if (r) ok++;
          else fallidos++;
        } else {
          const r = await generateAiAnalysis(fila.id, supabase, { trigger: "precalentado" });
          if (r) ok++;
          else fallidos++;
        }
      } catch {
        // Una generación que falla NO corta la corrida: lo que quede de
        // presupuesto se usa en la siguiente.
        fallidos++;
      }
    }

    const resumen = {
      staleDetectados: stale.length,
      precalentados: ok,
      fallidos,
      // La MÉTRICA de la ventana bump→precalentado. Si no baja corrida a corrida,
      // la cadencia no alcanza para el ritmo al que se está bumpeando.
      pendientes: Math.max(0, stale.length - ok),
      cortadoPorTiempo,
      ms: Date.now() - t0,
    };
    await latirCron(supabase, "precalentar-prosa");
    return NextResponse.json(resumen);
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "precalentar-prosa" });
    return NextResponse.json({ error: "fallo el precalentado" }, { status: 500 });
  }
}
