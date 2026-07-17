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
import type { FullAnalysisResult, AIAnalysisComparativa, RecomendacionModalidadAmbas, AnalisisInput } from "@/lib/types";
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
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";
import type { BandaComparativa } from "@/lib/engines/str-universo-santiago";
import { ctxFromResults, buildFindingsComparativa } from "@/lib/comparativa-findings";
import { buildAperturaComparativa, aperturaWordCount } from "@/lib/comparativa-apertura";
import { resolveUfForAnalysis } from "@/lib/uf";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";

const anthropic = new Anthropic();

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
  const log = opts.log ?? ((m: string) => console.warn(`${m} · ${ltrId}`));

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
        { comuna: (strInput.comuna as string) ?? (strRow.comuna as string) ?? "", superficie: Number(strInput.superficieUtil) || 0, dormitorios: Number(strInput.dormitorios) || 0 },
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

  const ltrCapital = ltrMetrics?.pieCLP ?? 0;
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

  const apertura = buildAperturaComparativa({ topId: top?.id ?? "flujo", topLado: top?.lado ?? "neutro", banda });
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

=== APERTURA YA ESCRITA POR EL MOTOR (${aperturaWC} palabras) ===
Se antepone automáticamente. NO la escribas, NO la parafrasees. Tu movimiento 1 CONTINÚA después de ella:
«${apertura}»

=== DATOS DEL CASO (contexto para razonar — YA están en las tarjetas, NO los recites como cifra) ===
Flujo mensual: larga ${fmtCLPAmbas(ltrFlujoMensual)} · corta ${fmtCLPAmbas(strFlujoMensual)} · diferencia ${fmtCLPAmbas(deltaFlujoMensual)} a favor de ${deltaFlujoMensual >= 0 ? "renta corta" : "renta larga"}.
Lo que renta la operación (NOI) mensual: larga ${fmtCLPAmbas(ltrNOIMensual)} · corta ${fmtCLPAmbas(strNOIMensual)} · diferencia ${fmtCLPAmbas(deltaNOIMensual)}.
Patrimonio a 10 años: larga ${fmtCLPAmbas(ltrPatY10)} · corta ${fmtCLPAmbas(strPatY10)} · diferencia ${fmtCLPAmbas(deltaPatY10)} (${Math.abs(deltaPatY10) < 1_000_000 ? "prácticamente igual" : "distinto"}).
Capital de entrada: larga ${fmtCLPAmbas(ltrCapital)} · corta ${fmtCLPAmbas(strCapital)} · el corto pide ${fmtCLPAmbas(strCapital - ltrCapital)} más${costoAmoblamiento > 0 ? ` (amoblamiento ${fmtCLPAmbas(costoAmoblamiento)})` : ""}.
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

  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT_AMBAS,
  });
  const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
  let aiResult = parse(rawText);
  if (!aiResult) return null;

  // PLANC-BUDGET GUARD — enforcement por construcción (espejo LTR 1551-1579).
  const contWC = wcCont(aiResult);
  if (contWC > maxTotal * 1.1) {
    log(`[AMBAS-PLANC-BUDGET] continuación ${contWC} palabras > máx ${maxTotal} — retry`);
    const correctivo = `\n\n⚠️ CORRECCIÓN DE PRESUPUESTO: tu continuación midió ${contWC} palabras; el MÁXIMO total es ${maxTotal} (quienDeberiasSer ≤${maxQuien}, switchPath ≤${maxSwitch}, cierre ≤${maxCierre}). Reescribí el JSON COMPLETO desarrollando UN matiz por movimiento, dentro del techo. Sin cifras de tarjeta.`;
    try {
      const regen = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: userPrompt + correctivo }],
        system: SYSTEM_PROMPT_AMBAS,
      });
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
    await supabase.from("analisis").update({ results: updatedResults }).eq("id", ltrId);
  }

  return aiResult;
}
