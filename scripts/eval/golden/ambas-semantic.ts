// ============================================================================
// GOLDEN SET COMPARATIVO (AMBAS) — tier SEMÁNTICO (juez Opus) · Fase C · F-C2.3
// ============================================================================
// Espejo del tier semántico LTR (semantic.ts) para la prosa comparativa nueva:
// apertura (motor) + conviene.{quienDeberiasSer, switchPath, cierre} (3 movimientos IA).
//
// Por par (ltr,str) real del corpus:
//   1. captureComparativaPrompt → bloque-caso REAL que generateComparativaAI arma
//      (REGLA ESPEJO: es la fuente de verdad numérica/veredicto; aborta antes del model-call).
//   2. generateComparativaAI({persist:false}) → prosa fresca (NUNCA persiste a la DB).
//   3. runJudgeAmbas → flags de coherencia-banda, cifras fabricadas, recitación de card,
//      voz chilena, narrativa vieja, cierre-como-posición, engine-ism.
//
// Los flags son REPORTE para Fabrizio, NO bloquean (el golden estructural GS-AMBAS ya
// cubre las fallas duras de veredicto/banda/flip). Este tier no aporta a totalHard.
//
// Los pares se congelan acá (descubiertos vía scripts/of-ambas-discover.ts sobre el corpus
// real, por ambas_group_id). Cobertura de los 4 estados de banda; prioridad a STR_FRAGIL y
// flip=true (ciegos a la prosa vieja). Si el corpus no tiene un estado, se reporta el gap.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateComparativaAI } from "../../../src/lib/ai-generation-ambas-generate";
import { captureComparativaPrompt, runJudgeAmbas } from "../judge";

export interface AmbasSemanticPair {
  key: string;
  ltrId: string;
  strId: string;
  comuna: string;
  banda: string;   // banda esperada (documental; la autoritativa se lee del bloque-caso capturado)
  flip: boolean;
  nota?: string;
}

// 15 pares reales (ambas_group_id) descubiertos en el corpus. Cobertura: los 4 estados.
// Prioridad declarada: STR_FRAGIL + flip=true (ASP-14, ASP-15) — ciegos a la prosa vieja.
export const AMBAS_SEMANTIC_PAIRS: AmbasSemanticPair[] = [
  { key: "ASP-01", ltrId: "9e4fb9e2-da96-400a-a317-26c9426175ff", strId: "dd7b0a08-8bfc-4fdd-98d1-376555dce926", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-02", ltrId: "04dcc9af-fdd3-4ad4-853c-36d88d67e452", strId: "1ab38470-58e5-4cf1-9d73-bf89a67dfb45", comuna: "Santiago", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-03", ltrId: "7dadc166-8850-48be-afcd-1f29ef5b18e8", strId: "cf3ae20f-d560-4e55-81cc-764058fee4f8", comuna: "Santiago", banda: "INDIFERENTE", flip: false, nota: "único INDIFERENTE del corpus" },
  { key: "ASP-04", ltrId: "acbfc1f5-c1dd-4648-a90a-b249a226dc7d", strId: "4ea0b582-e050-47d6-bd9f-111abda32be8", comuna: "Providencia", banda: "STR_VENTAJA_CLARA", flip: false },
  { key: "ASP-05", ltrId: "70dda795-9b55-454c-a7ed-42ac80923a20", strId: "61b6207a-0519-4234-81f4-ccb2b2072916", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-06", ltrId: "e42f9e9f-be5a-4ae1-9aa5-8808d53be20b", strId: "48799d74-021c-4201-b08d-81baf26bf642", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-07", ltrId: "6175fd87-bbf3-4609-b22c-a03e02f8f7f8", strId: "dc086820-888b-4496-9e50-ae064e25c08c", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-08", ltrId: "e587c444-95f9-469d-b674-ceaf2d406164", strId: "89e68f96-70ab-4cae-b045-cd14e92d0b35", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-09", ltrId: "669bcfa2-4f52-416c-811e-7106624b4ed3", strId: "ae162482-ac83-4088-8e9b-540b206f14cd", comuna: "Santiago", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-10", ltrId: "bcaed202-8b76-4146-872a-c361a14067c2", strId: "cc5f5275-8b58-4197-b8b0-26bcc11b345e", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-11", ltrId: "40260f17-23ac-4020-9bb6-57f014c1dddc", strId: "a3141ba5-f3c1-49d8-8559-bf430b4824d4", comuna: "Las Condes", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-12", ltrId: "a890411d-17e5-405a-9a8b-7af19465ff21", strId: "c53331bf-9b96-4651-8ebf-5b31811718ad", comuna: "Santiago", banda: "STR_VENTAJA_CLARA", flip: false },
  { key: "ASP-13", ltrId: "8c592df8-18ad-4d04-aefc-7a6faea5f5ea", strId: "99722e1d-9c8f-4ee9-9cfc-54ae2974109d", comuna: "Providencia", banda: "LTR_PREFERIDO", flip: false },
  { key: "ASP-14", ltrId: "163422e4-9fc6-4438-aa0f-47b4cbf58e55", strId: "441116e0-3bf8-49cc-a5ae-1103c39bd90e", comuna: "Santiago", banda: "LTR_PREFERIDO", flip: true, nota: "flip=true — la bisagra de gestión cambia el veredicto" },
  { key: "ASP-15", ltrId: "23bcbad9-ae21-480b-833f-3db6297116f5", strId: "c925e85a-f858-4124-a1f2-ffdf313400d7", comuna: "Las Condes", banda: "STR_FRAGIL", flip: true, nota: "único STR_FRAGIL + flip=true — prioridad máxima (ciego a la prosa vieja)" },
];

export interface AmbasSemanticReport {
  key: string;
  comuna: string;
  bandaCaso: string;   // banda leída del bloque-caso capturado (autoritativa)
  flipCaso: boolean;
  flags: Array<{ categoria: string; severidad: string; detalle: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
}

// Lee la banda/flip del bloque-caso REAL (lo que el motor le pasó al modelo).
function parseVeredictoFromCase(caseBlock: string): { banda: string; flip: boolean; estado: string } {
  const mEstado = caseBlock.match(/estadoVeredicto:\s*(.+)/);
  const estado = mEstado ? mEstado[1].trim() : "?";
  const mBanda = estado.match(/\(([A-Z_]+)\)/);
  const banda = mBanda ? mBanda[1] : (estado || "?");
  const flip = /flipGestion:\s*SÍ/.test(caseBlock);
  return { banda, flip, estado };
}

export async function runAmbasSemanticTier(sb: SupabaseClient): Promise<AmbasSemanticReport[]> {
  const reports: AmbasSemanticReport[] = [];

  for (const p of AMBAS_SEMANTIC_PAIRS) {
    // 1) Capturar el bloque-caso REAL (sin tokens; aborta antes del model-call).
    let caseBlock = "";
    let veredicto = { banda: p.banda, flip: p.flip, estado: p.banda };
    try {
      const captured = await captureComparativaPrompt(p.ltrId, p.strId, sb);
      if (captured?.user) {
        caseBlock = captured.user;
        veredicto = parseVeredictoFromCase(caseBlock);
      }
    } catch (e) {
      reports.push({ key: p.key, comuna: p.comuna, bandaCaso: p.banda, flipCaso: p.flip, flags: [], error: `captura: ${(e as Error)?.message ?? e}` });
      continue;
    }

    // 2) Generar prosa fresca (persist:false — NUNCA escribe a la DB).
    let ai;
    try {
      ai = await generateComparativaAI({ ltrId: p.ltrId, strId: p.strId, supabase: sb, persist: false, log: () => {} });
    } catch (e) {
      reports.push({ key: p.key, comuna: p.comuna, bandaCaso: veredicto.banda, flipCaso: veredicto.flip, flags: [], error: `generación: ${(e as Error)?.message ?? e}` });
      continue;
    }
    if (!ai) {
      reports.push({ key: p.key, comuna: p.comuna, bandaCaso: veredicto.banda, flipCaso: veredicto.flip, flags: [{ categoria: "gen", severidad: "alta", detalle: "generación devolvió null (¿falta results/input en el par?)" }] });
      continue;
    }
    if (!caseBlock) {
      // sin bloque-caso el juez pierde la REGLA ESPEJO; no juzgamos a ciegas.
      reports.push({ key: p.key, comuna: p.comuna, bandaCaso: veredicto.banda, flipCaso: veredicto.flip, flags: [{ categoria: "captura", severidad: "media", detalle: "no se capturó el bloque-caso (se omite el juez)" }] });
      continue;
    }

    // 3) Juez comparativo (REGLA ESPEJO).
    const fixtureMeta = { id: p.key, modalidad: "AMBAS", tier: "estandar", banda: veredicto.banda, flip: veredicto.flip, comuna: p.comuna, nota: p.nota };
    const veredictoBundle = { estadoVeredicto: veredicto.estado, banda: veredicto.banda, flipCambiaVeredicto: veredicto.flip };
    let judge;
    try {
      judge = await runJudgeAmbas({ fixtureMeta, aiAnalysis: ai, caseBlock, veredictoBundle });
    } catch (e) {
      reports.push({ key: p.key, comuna: p.comuna, bandaCaso: veredicto.banda, flipCaso: veredicto.flip, flags: [], error: `juez: ${(e as Error)?.message ?? e}` });
      continue;
    }
    reports.push({
      key: p.key,
      comuna: p.comuna,
      bandaCaso: veredicto.banda,
      flipCaso: veredicto.flip,
      flags: (judge.hallazgos ?? []).map((h) => ({
        categoria: h.categoria,
        severidad: h.severidad,
        detalle: `${h.campo}: ${h.porQue} — "${(h.cita ?? "").slice(0, 100)}"`,
      })),
      usage: judge._usage,
    });
  }
  return reports;
}
