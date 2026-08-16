// ─────────────────────────────────────────────────────────────────────────
// Generación de la prosa comparativa (Fase C · Plan C) — función de lib
// reutilizable desde el endpoint /api/analisis/comparativa/ai Y desde el golden
// semántico (scripts/eval). Flujo: recompute ambos lados (base homologada) →
// apertura determinística (motor) → budget dinámico → LLM → retry de budget →
// guards + strip → versión → persistencia (opcional).
//
// No hace authz: es responsabilidad del caller (el endpoint valida owner/admin
// antes de invocar; el golden corre con service client).
// ─────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import { acumularUsage, camposUpdateUsage, nuevoAcumuladorUsage } from "@/lib/ai-usage";
import type { FullAnalysisResult, AIAnalysisComparativa, RecomendacionModalidadAmbas, AnalisisInput } from "@/lib/types";
import { esMetricaNoAplica } from "@/lib/types";
import { razonSinCapitalPrompt } from "@/lib/no-aplica-copy";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import {
  SYSTEM_PROMPT_AMBAS,
  PROMPT_VERSION_AMBAS,
  fmtCLPAmbas,
  fmtUFAmbas,
  fmtPctAmbas,
  sanitizeComparativaAI,
  despersonalizarComparativa,
  scanEngineIsmsAmbas,
  stripAperturaEco,
  scanCardCifraEcho,
  extractCifras,
} from "@/lib/ai-generation-ambas";
import { scanVozChilena, hitsQueExigenReintento, correctivoVoz } from "@/lib/voz-chilena";
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";
import type { BandaComparativa } from "@/lib/engines/str-universo-santiago";
import { ctxFromResults, buildFindingsComparativa } from "@/lib/comparativa-findings";
import { buildAperturaComparativa, aperturaWordCount } from "@/lib/comparativa-apertura";
import { derivarEstadoHero, type EstadoHero, type Verdict } from "@/lib/comparativa-hero-copy";
import { readVeredicto } from "@/lib/results-helpers";
import { normalizeLegacyVerdict } from "@/lib/types";
import { resolveUfForAnalysis } from "@/lib/uf";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { nuevoRegistroLlamadas, persistGeneracionTiming } from "@/lib/pipeline-timing";

const anthropic = new Anthropic();

// Prompt caching (Goal C): system AMBAS (~3.9k tokens) idéntico entre principal
// y retries — cache_control ephemeral (5 min) los sirve a 0.1×. Solo shape.
const SYSTEM_AMBAS_CACHED = [
  { type: "text" as const, text: SYSTEM_PROMPT_AMBAS, cache_control: { type: "ephemeral" as const } },
];

type LTRResultsWithCache = FullAnalysisResult & { comparativaAI?: AIAnalysisComparativa; tipoAnalisis?: string };
type STRResultsExtended = ShortTermResult & { tipoAnalisis?: string };

export interface GenerateComparativaOpts {
  ltrId: string;
  strId: string;
  supabase: SupabaseClient;
  persist?: boolean;             // default true
  log?: (m: string) => void;
}

export async function generateComparativaAI(opts: GenerateComparativaOpts): Promise<AIAnalysisComparativa | null> {
  const { ltrId, strId, supabase } = opts;
  const persist = opts.persist !== false;
  // Consumo de tokens de la generación comparativa (principal + retries). Se
  // escribe al final, junto al UPDATE de `results` que ya existe.
  const usage = nuevoAcumuladorUsage();
  const log = opts.log ?? ((m: string) => console.warn(`${m} · ${ltrId}`));
  // Timing de la generación comparativa (Goal A): se apendea a la fila LTR
  // (donde vive comparativaAI). Con persist:false (golden) no se escribe nada.
  const tGen = Date.now();
  const reg = nuevoRegistroLlamadas();
  const prep: { ms?: number } = {};
  const persistGen = async (resultado: "ok" | "error") => {
    if (!persist) return;
    await persistGeneracionTiming(supabase, ltrId, {
      tipo: "ambas",
      trigger: "on-open",
      inicio_at: new Date(tGen).toISOString(),
      fin_at: new Date().toISOString(),
      total_ms: Date.now() - tGen,
      resultado,
      prompt_version: PROMPT_VERSION_AMBAS,
      ...(prep.ms !== undefined ? { prep_ms: prep.ms } : {}),
      llamadas: reg.llamadas,
    });
  };

  const [{ data: ltrRow }, { data: strRow }] = await Promise.all([
    supabase.from("analisis").select("*").eq("id", ltrId).single(),
    supabase.from("analisis").select("*").eq("id", strId).single(),
  ]);
  if (!ltrRow || !strRow) return null;

  const ltrResultsPersisted = (ltrRow.results ?? null) as LTRResultsWithCache | null;
  const strResultsPersisted = (strRow.results ?? null) as STRResultsExtended | null;
  if (!ltrResultsPersisted || !strResultsPersisted) return null;

  const strInput = strRow.input_data as Record<string, unknown> | null;

  // Recompute ambos lados (base homologada) — espejo de comparativa/page.tsx.
  const ltrUf = resolveUfForAnalysis(
    ltrResultsPersisted as { metrics?: { precioCLP?: number | null } | null },
    ltrRow.input_data as { precio?: number | null } | null,
    38800,
    ltrRow.id as string,
  );
  const ltrInputRc = (ltrRow.input_data ?? null) as AnalisisInput | null;
  const ltrAsOfRc = new Date((ltrRow.created_at as string) ?? new Date().toISOString());
  const ltrMedianaRc = ltrInputRc ? await prefetchMedianaComunaVenta(supabase, ltrInputRc, ltrUf) : { mediana: null, n: 0 };
  const ltrResults = (
    ltrInputRc
      ? { ...recomputeResultsForLegacy(ltrInputRc, ltrUf, ltrMedianaRc, ltrAsOfRc), comparativaAI: ltrResultsPersisted.comparativaAI }
      : ltrResultsPersisted
  ) as LTRResultsWithCache;

  const strAsOfRc = new Date((strRow.created_at as string) ?? new Date().toISOString());
  const strMedianaRc = strInput
    ? await prefetchMedianaComunaVenta(
        supabase,
        { comuna: (strInput.comuna as string) ?? (strRow.comuna as string) ?? "", superficie: Number(strInput.superficieUtil) || 0, dormitorios: Number(strInput.dormitorios) || 0,
          esNuevo: strInput.tipoPropiedad === "nuevo", antiguedad: typeof strInput.antiguedad === "number" ? strInput.antiguedad : undefined },
        ltrUf,
      )
    : { mediana: null, n: 0 };
  const strResults = (recomputeShortTermForLegacy(strInput, strResultsPersisted, ltrUf, strAsOfRc, strMedianaRc) ?? strResultsPersisted) as STRResultsExtended;

  const comuna = (ltrRow.comuna as string) ?? (strRow.comuna as string) ?? "—";
  const superficie = (ltrRow.superficie as number) ?? 0;
  const dormitorios = (ltrRow.dormitorios as number) ?? 0;
  const banos = (ltrRow.banos as number) ?? 0;
  const precioUF = (ltrRow.precio as number) ?? (strRow.precio as number) ?? 0;

  const ltrMetrics = ltrResults.metrics;
  const strBase = strResults.escenarios?.base;

  const ltrNOIMensual = (ltrMetrics?.noi ?? 0) / 12;
  const strNOIMensual = strBase?.noiMensual ?? 0;
  const deltaNOIMensual = strNOIMensual - ltrNOIMensual;

  const ltrFlujoMensual = ltrMetrics?.flujoNetoMensual ?? 0;
  const strFlujoMensual = strBase?.flujoCajaMensual ?? 0;
  const deltaFlujoMensual = strFlujoMensual - ltrFlujoMensual;

  // Capital de entrada del LTR: `inversionInicial` (pie + cierre + CapEx + corretaje),
  // la MISMA derivación que ya usan la web, el share y el documento. Antes leía
  // `pieCLP` pelado y con pie 0 el prompt recibía "larga $0" — falso (el largo sí pone
  // plata de entrada) y además discrepante de la tabla que el usuario tiene enfrente.
  const ltrRetorno = ltrResults as unknown as {
    retorno?: { inversionInicial?: number };
    exitScenario?: { inversionInicial?: number };
  };
  const ltrCapital =
    ltrRetorno.retorno?.inversionInicial ?? ltrRetorno.exitScenario?.inversionInicial ?? ltrMetrics?.pieCLP ?? 0;

  // Pie cero (fase 5b + rama AMBAS): la razón la declara el usuario en el wizard y
  // viaja en la métrica del motor. Sin esto, el `bono_pie` declarado no llegaba nunca
  // a la prosa comparativa.
  const cocNoAplicaAmbas = esMetricaNoAplica(ltrMetrics?.cashOnCash) ? ltrMetrics!.cashOnCash : null;
  const sinCapitalPropio = cocNoAplicaAmbas !== null;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const strCapital = strResults.capitalInvertido ?? 0;

  const ltrPatY10 = ltrResults.projections?.[9]?.patrimonioNeto ?? 0;
  const strPatY10 = strResults.projections?.[9]?.patrimonioNeto ?? 0;
  const deltaPatY10 = strPatY10 - ltrPatY10;

  const zona = strResults.zonaSTR;
  const sobreRentaPct = strResults.comparativa?.sobreRentaPct ?? 0;
  const sobreRentaPctConfiable = strResults.comparativa?.sobreRentaPctConfiable ?? true;
  const sobreRentaCLP = strResults.comparativa?.sobreRenta ?? 0;
  const reco = deriveRecomendacionModalidad({
    recomendacionModalidad: strResults.recomendacionModalidad,
    zonaSTR: zona,
    sobreRentaPct,
    ltrNoiMensual: strResults.comparativa?.ltr?.noiMensual,
    sobreRenta: sobreRentaCLP,
    strNoiMensual: strResults.comparativa?.str_auto?.noiMensual,
    breakEvenPctDelMercado: strResults.breakEvenPctDelMercado,
  });

  const banda: BandaComparativa = strResults.veredictoComparativo?.banda ?? "INDIFERENTE";
  const flip = strResults.veredictoComparativo?.flipGestion;
  const flipCambia = flip?.cambiaVeredicto ?? false;

  // Viabilidad de compra (hero 3 ejes, contrato d25096d): los veredictos de los
  // hijos ENTRAN al prompt — su ausencia era la causa raíz del D8 del censo.
  // MISMO derivador que el render (derivarEstadoHero): cero copia de lógica.
  const ltrVerdict = (readVeredicto(ltrResults) as Verdict | null) ?? null;
  const strVerdict = (normalizeLegacyVerdict(strResults.veredicto) as Verdict | null) ?? null;
  const estadoHero: EstadoHero = derivarEstadoHero(ltrVerdict, strVerdict);
  const ltrScoreHijo = (ltrRow.score as number | null) ?? 0;
  const strScoreHijo = (strResults as { francoScore?: { score?: number } }).francoScore?.score ?? 0;
  const estadoHeroLabel: Record<EstadoHero, string> = {
    e1: "E1 — los dos análisis sostienen la compra",
    e2: "E2 — NINGUNA vía se sostiene (doble BUSCAR OTRA): marco «si igual lo compras», cero celebración del método",
    e3: "E3 — un lado no se sostiene: subordinación parcial (la compra pide ajustar supuestos; la otra vía no se sostiene)",
  };

  // §1.12.4 — herencia mínima del precio-justo de los hijos (matriz 15-ago-2026:
  // la UBICACIÓN la dicta el estado del hero, nunca la IA; sin flag = SILENCIO).
  // Los flags vienen pre-digeridos por los motores de cada hijo (esCasoPrecioJusto
  // LTR / esCasoPrecioJustoStr STR) en el hallazgo de distancia recomputado.
  const pjDe = (hs: unknown): boolean =>
    Array.isArray(hs) &&
    (hs as { id?: string; valor?: { casoPrecioJusto?: boolean } }[]).some(
      (h) => h?.id === "distancia_veredicto" && h.valor?.casoPrecioJusto === true,
    );
  const pjLtr = pjDe((ltrResults as { hallazgos?: unknown }).hallazgos);
  const pjStr = pjDe((strResults as { hallazgos?: unknown }).hallazgos);
  const bloquePrecioJustoAmbas = (() => {
    if (!pjLtr && !pjStr) return "";
    const ubicacion =
      estadoHero === "e2"
        ? "ARRIBA — fundida con el marco «si igual lo compras»; refuerza la subordinación, cero celebración del método"
        : estadoHero === "e3"
          ? "subordinada al lado que no se sostiene"
          : "como CONDICIÓN del cierre (la comparación de método sigue; ajustar la entrada beneficia a las dos)";
    const linea =
      pjLtr && pjStr
        ? `"a precios de compra actuales, esta zona no remunera ni la renta larga ni la corta — el problema no es la modalidad, es la entrada"`
        : pjLtr
          ? `"la renta larga acá no falla por el depto ni por su precio — a precios de compra actuales esta zona no la remunera; es un problema de entrada, no de modalidad"`
          : `"el corto acá no falla por gestión ni por tarifa — esta zona no sostiene renta corta a los precios de compra actuales; es un problema de entrada, no de modalidad"`;
    const alcance = pjLtr && pjStr ? "AMBOS hijos" : pjLtr ? "el hijo de renta larga" : "el hijo de renta corta";
    return `

=== PRECIO-JUSTO (herencia de los hijos · §1.12.4) ===
${alcance} detectó caso precio-justo: precio e ingresos a mercado con veredicto degradado — el problema es la ENTRADA (lo que cuesta comprar acá), no la modalidad ni la ejecución.
LÍNEA CANÓNICA (adáptala lo mínimo): ${linea}.
UBICACIÓN (la dicta el estado del hero, no tú): ${ubicacion}.
PROHIBIDO: resolverlo con un descuento cosmético, culpar la ejecución (gestión/tarifa/arriendo declarado) del lado marcado, o presentar a la ganadora como si la compra quedara validada.`;
  })();

  const modoGestion = (strInput?.modoGestion as string) ?? "auto";
  const comisionAdminDec = (strInput?.comisionAdministrador as number) ?? 0.2;
  const comisionAdmin = Math.round(comisionAdminDec * 100);
  const edificioPermiteAirbnb = (strInput?.edificioPermiteAirbnb as string) ?? "no_seguro";

  const ctxFindings = ctxFromResults(ltrResults, strResults, {
    modoGestion: modoGestion === "admin" ? "admin" : "auto",
    comisionAdministrador: comisionAdminDec,
    costoAmoblamiento,
    edificioPermiteAirbnb,
  });
  const findings = ctxFindings ? buildFindingsComparativa(ctxFindings, "CLP", ltrUf) : [];
  const top = findings[0];

  const apertura = buildAperturaComparativa({
    topId: top?.id ?? "flujo",
    topLado: top?.lado ?? "neutro",
    banda,
    estadoHero,
    sobreRentaPct,
    sobreRentaPctConfiable,
  });
  const aperturaWC = aperturaWordCount(apertura);
  const cardCifras = findings.flatMap((f) => [f.kpi, ...extractCifras(f.ksub), ...extractCifras(f.cuerpo)]);

  const maxQuien = 60;
  const maxSwitch = 55;
  const maxCierre = banda === "STR_FRAGIL" || flipCambia ? 55 : 45;
  const maxTotal = maxQuien + maxSwitch + maxCierre;

  const estadoLabel: Record<BandaComparativa, string> = {
    LTR_PREFERIDO: "RENTA LARGA (LTR_PREFERIDO)",
    STR_VENTAJA_CLARA: "RENTA CORTA (STR_VENTAJA_CLARA)",
    STR_FRAGIL: "VENTAJA FRÁGIL (STR_FRAGIL)",
    INDIFERENTE: "PAREJAS (INDIFERENTE)",
  };

  const userPrompt = `Genera la prosa comparativa (3 movimientos). El usuario ya vio el veredicto, tu posición corta en el hero, y la pirámide de tarjetas con TODAS las cifras. Narra solo lo que las tarjetas no pueden. Devuelve SOLO el JSON del schema.

=== PROPIEDAD ===
${dormitorios}D${banos}B en ${comuna} · ${superficie} m² · ${fmtUFAmbas(precioUF)}

=== ESTADO DEL VEREDICTO (coherencia total, Parte III) ===
estadoVeredicto: ${estadoLabel[banda]}
recomendacion (cópiala EXACTO al JSON): ${reco}
${flipCambia ? `flipGestion: SÍ — administrarlo tú vs delegarlo CAMBIA el veredicto (auto→${flip?.recomendacionAuto}, admin→${flip?.recomendacionAdmin}). Recanócelo en el cierre.` : "flipGestion: no cambia el veredicto."}
${zona ? `zona: ${zona.tierZona} (score ${zona.score}/100)${zona.comunaNoListada ? " · comuna no listada en el universo benchmark — atenúa" : ""}` : "zona STR no calculada"}

=== VIABILIDAD DE COMPRA (ver sección homónima del system) ===
estadoHero: ${estadoHeroLabel[estadoHero]}
análisis renta larga: ${ltrVerdict ?? "sin veredicto"} (score ${ltrScoreHijo})
análisis renta corta: ${strVerdict ?? "sin veredicto"} (score ${strScoreHijo})
Tu prosa NUNCA contradice estos veredictos de compra.${bloquePrecioJustoAmbas}

=== APERTURA YA ESCRITA POR EL MOTOR (${aperturaWC} palabras) ===
Se antepone automáticamente. NO la escribas, NO la parafrasees. Tu movimiento 1 CONTINÚA después de ella:
«${apertura}»

=== DATOS DEL CASO (contexto para razonar — YA están en las tarjetas, NO los recites como cifra) ===
Flujo mensual: larga ${fmtCLPAmbas(ltrFlujoMensual)} · corta ${fmtCLPAmbas(strFlujoMensual)} · diferencia ${fmtCLPAmbas(deltaFlujoMensual)} a favor de ${deltaFlujoMensual >= 0 ? "renta corta" : "renta larga"}.
Lo que renta la operación (NOI) mensual: larga ${fmtCLPAmbas(ltrNOIMensual)} · corta ${fmtCLPAmbas(strNOIMensual)} · diferencia ${fmtCLPAmbas(deltaNOIMensual)}.
Patrimonio a 10 años: larga ${fmtCLPAmbas(ltrPatY10)} · corta ${fmtCLPAmbas(strPatY10)} · diferencia ${fmtCLPAmbas(deltaPatY10)} (${Math.abs(deltaPatY10) < 1_000_000 ? "prácticamente igual" : "distinto"}).
Capital de entrada: larga ${fmtCLPAmbas(ltrCapital)} · corta ${fmtCLPAmbas(strCapital)} · el corto pide ${fmtCLPAmbas(Math.abs(strCapital - ltrCapital))} ${strCapital >= ltrCapital ? "más" : "menos"}${costoAmoblamiento > 0 ? ` (amoblamiento ${fmtCLPAmbas(costoAmoblamiento)})` : ""}.
${sinCapitalPropio ? `Capital propio: NO HAY en ninguna de las dos — el pie es $0 y la compra se financia al 100% (razonSinCapital: ${razonSinCapitalPrompt(cocNoAplicaAmbas!.razon)}). El capital de entrada de la línea anterior son gastos de cierre y puesta a punto, NO capital propio que rente; por eso la TIR y el retorno sobre capital no existen en este caso y la comparación entre modalidades se juega entera en flujo y esfuerzo (ver A12).
` : ""}
Sobre-renta STR vs LTR: ${sobreRentaPctConfiable ? fmtPctAmbas(sobreRentaPct, 1) : `${fmtCLPAmbas(sobreRentaCLP)}/mes (porcentaje N/D)`}.
Esfuerzo: larga ~0,5 hrs/semana (pasiva tras firmar). Corta auto-gestión 8-12 hrs/semana; con administrador ${comisionAdmin}% del bruto y ~0,5-1 hrs/semana tuyas.
Modo de gestión asumido: ${modoGestion}.

=== PRESUPUESTO DINÁMICO (un guard lo mide; respétalo) ===
quienDeberiasSer: MÁXIMO ${maxQuien} palabras.
switchPath: MÁXIMO ${maxSwitch} palabras.
cierre: MÁXIMO ${maxCierre} palabras.
Total continuación ≤ ${maxTotal} palabras. Un matiz por movimiento, no encadenes tres.

=== INSTRUCCIÓN FINAL ===
1. Coherencia TOTAL con estadoVeredicto (Parte III). La prosa no sugiere un ganador distinto.
2. NO recites cifras de las tarjetas (flujo, patrimonio, capital, comisión). Nárralas en palabras.
3. cierre = la CONDICIÓN que sostiene la jugada + costo emocional. NO la posición (ya está en el hero).
4. switchPath en rangos condicionales, nunca plazos exactos como certeza.
5. Voz §2.1 tuteo neutro chileno. Cero voseo (-ás/-és/-ís). Cero chilenismo. Cero cliché.
6. JSON válido y completo. Sin \`apertura\` ni \`headline\` (los pone el motor). Sin texto fuera del JSON.`;

  const wcCont = (ai: AIAnalysisComparativa | null): number => {
    if (!ai?.conviene) return 0;
    const all = `${ai.conviene.quienDeberiasSer ?? ""} ${ai.conviene.switchPath ?? ""} ${ai.conviene.cierre ?? ""}`.trim();
    return all ? all.split(/\s+/).filter(Boolean).length : 0;
  };
  const parse = (raw: string): AIAnalysisComparativa | null => {
    try {
      let t = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const a = t.indexOf("{");
      const b = t.lastIndexOf("}");
      if (a !== -1 && b !== -1) t = t.substring(a, b + 1);
      t = t.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(t) as AIAnalysisComparativa;
    } catch (e) {
      log(`[Comparativa AI] Parse error: ${(e as Error)?.message ?? e}`);
      return null;
    }
  };

  prep.ms = Date.now() - tGen;
  const msg = await reg.medir("principal", CLAUDE_MODEL, () => anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_AMBAS_CACHED,
  }));
  acumularUsage(usage, msg);
  const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
  let aiResult = parse(rawText);
  if (!aiResult) {
    await persistGen("error");
    return null;
  }

  // PLANC-BUDGET GUARD — 1 reintento y se acepta lo que venga.
  //
  // OJO — ya NO es espejo del LTR. Allá (ai-generation.ts, guard PLAN C) la rama
  // "sigue > máx, aceptado" murió: hay 2 reintentos y, si no converge, recorte
  // determinístico por oración (prosa-presupuesto.ts). Acá sigue vigente el patrón
  // viejo. La diferencia es deliberada por ahora: el techo de AMBAS ya es propio de la
  // continuación (maxQuien/maxSwitch/maxCierre NO se descuentan de la apertura del
  // motor), que era la causa raíz del desborde LTR, y no hay medición de desborde
  // sistemático en AMBAS que justifique tocarlo a ciegas. Si aparece, el recorte por
  // oración se importa desde prosa-presupuesto.ts — pero por campo, no sobre el total.
  const contWC = wcCont(aiResult);
  if (contWC > maxTotal * 1.1) {
    log(`[AMBAS-PLANC-BUDGET] continuación ${contWC} palabras > máx ${maxTotal} — retry`);
    const correctivo = `\n\n⚠️ CORRECCIÓN DE PRESUPUESTO: tu continuación midió ${contWC} palabras; el MÁXIMO total es ${maxTotal} (quienDeberiasSer ≤${maxQuien}, switchPath ≤${maxSwitch}, cierre ≤${maxCierre}). Reescribí el JSON COMPLETO desarrollando UN matiz por movimiento, dentro del techo. Sin cifras de tarjeta.`;
    try {
      const regen = await reg.medir("planc-budget", CLAUDE_MODEL, () => anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: userPrompt + correctivo }],
        system: SYSTEM_AMBAS_CACHED,
      }));
      acumularUsage(usage, regen);
      const regenText = regen.content[0].type === "text" ? regen.content[0].text : "";
      const regenResult = parse(regenText);
      if (regenResult) {
        const c2 = wcCont(regenResult);
        log(`[AMBAS-PLANC-BUDGET] retry → ${c2} palabras${c2 > maxTotal * 1.1 ? " (sigue > máx, aceptado)" : " (OK)"}`);
        aiResult = regenResult;
      }
    } catch (e) {
      log(`[AMBAS-PLANC-BUDGET] retry falló (best-effort): ${(e as Error)?.message ?? e}`);
    }
  }

  // CATCH-VOZ — reintento ÚNICO por voseo NO corregible (pronombre "vos" o un
  // -és/-ís fuera del léxico). El voseo conocido y los typos recurrentes NO
  // llegan acá: los arregla `sanitizeComparativaAI` abajo, sin pagar una
  // regeneración. Best-effort: nunca rompe la generación.
  {
    const noCorregibles = hitsQueExigenReintento(scanVozChilena(aiResult));
    if (noCorregibles.length) {
      log(`[AMBAS-CATCH-VOZ] ${noCorregibles.length} forma(s) sin corrección determinística (${noCorregibles.map((h) => h.token).join(", ")}) — 1 reintento`);
      try {
        const regen = await reg.medir("catch-voz", CLAUDE_MODEL, () => anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          messages: [{ role: "user", content: userPrompt + correctivoVoz(noCorregibles) }],
          system: SYSTEM_AMBAS_CACHED,
        }));
        acumularUsage(usage, regen);
        const regenText = regen.content[0].type === "text" ? regen.content[0].text : "";
        const regenResult = parse(regenText);
        const quedan = regenResult ? hitsQueExigenReintento(scanVozChilena(regenResult)) : null;
        if (regenResult && quedan && quedan.length < noCorregibles.length) {
          log(`[AMBAS-CATCH-VOZ] retry mejoró: ${noCorregibles.length}→${quedan.length} — aceptado`);
          aiResult = regenResult;
        } else {
          log(`[AMBAS-CATCH-VOZ] retry no mejoró — conservo el previo`);
        }
      } catch (e) {
        log(`[AMBAS-CATCH-VOZ] retry falló (best-effort): ${(e as Error)?.message ?? e}`);
      }
    }
  }

  if (!aiResult.recomendacion) aiResult.recomendacion = reco as RecomendacionModalidadAmbas;

  // Guards + strip (detection-only donde mutar sería destructivo).
  if (aiResult.conviene) {
    aiResult.conviene.quienDeberiasSer = stripAperturaEco(apertura, despersonalizarComparativa(aiResult.conviene.quienDeberiasSer ?? ""), log);
    aiResult.conviene.switchPath = despersonalizarComparativa(aiResult.conviene.switchPath ?? "");
    aiResult.conviene.cierre = despersonalizarComparativa(aiResult.conviene.cierre ?? "");

    const proseAll = `${aiResult.conviene.quienDeberiasSer} ${aiResult.conviene.switchPath} ${aiResult.conviene.cierre}`;
    const ismos = scanEngineIsmsAmbas(proseAll);
    if (ismos.length) log(`[AMBAS-ENGINE-ISM] residuo: ${ismos.join(", ")}`);
    const echos = scanCardCifraEcho(proseAll, cardCifras);
    if (echos.length) log(`[AMBAS-CARD-ECHO] cifras de card recitadas: ${echos.join(", ")}`);
  }

  aiResult = sanitizeComparativaAI(aiResult);
  aiResult.apertura = apertura;
  aiResult.promptVersion = PROMPT_VERSION_AMBAS;

  if (persist) {
    const updatedResults = { ...(ltrResults as object), comparativaAI: aiResult };
    await supabase
      .from("analisis")
      .update({
        results: updatedResults,
        // El consumo de la comparativa se carga a la fila LTR, que es donde vive
        // `comparativaAI` — misma fila, mismo UPDATE, cero queries nuevas.
        // `ltrRow` viene de un select("*"), así que ya trae los contadores.
        ...camposUpdateUsage(usage, ltrRow, CLAUDE_MODEL),
      })
      .eq("id", ltrId);
  }
  await persistGen("ok");

  return aiResult;
}
