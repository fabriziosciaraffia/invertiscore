/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 3.5 — Diagnóstico LTR (4 casos críticos)
 *
 * Tensiona los 4 items detectados en QA post v8:
 *   A — Premium con sobreprecio claro (Las Condes UF 7.500)
 *   B — Borderline cerca del techo (Ñuñoa UF 4.800)
 *   C — Riesgos cargados (Estación Central UF 2.500)
 *   D — Premium control (Providencia UF 5.500)
 *
 * Usa el mismo shim que audit-batch-generate (buildLtrPrompts) para
 * comparabilidad con outputs de Fase 3. Outputs en audit/fase3.5-outputs/.
 *
 *   npx tsx scripts/fase3.5-ltr-batch.ts
 *
 * NO escribe en DB.
 */

import { config } from "dotenv";
import path from "path";
import fs from "fs";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

interface CaseDef {
  id: string;
  label: string;
  notes: string;
  input: Record<string, any>;
  etapa?: "evaluando" | "cerrado";
}

const baseDefaults = {
  ciudad: "Santiago",
  tipo: "Departamento",
  estadoVenta: "inmediata",
  banos: 1,
  estacionamiento: "no",
  precioEstacionamiento: 0,
  bodega: false,
  tipoRenta: "larga",
  arriendoEstacionamiento: 0,
  arriendoBodega: 0,
  contribuciones: 70000,
  provisionMantencion: 60000,
  plazoCredito: 25,
  vacanciaMeses: 1,
  cuotasPie: 0,
  montoCuota: 0,
  enConstruccion: false,
};

const CASES: CaseDef[] = [
  {
    id: "A-LasCondes-sobreprecio",
    label: "Premium con sobreprecio claro",
    notes: "UF 7.500 / 70m² = UF 107/m² (mediana LC ~UF 90/m²). vmFranco UF 6.300 simula SOBREPRECIO ~+19%.",
    etapa: "evaluando",
    input: {
      precio: 7500,
      valorMercadoFranco: 6300,
      superficie: 70,
      superficieTotal: 70,
      antiguedad: 5,
      piePct: 20,
      tasaInteres: 4.1,
      arriendo: 1300000,
      gastos: 180000,
      contribuciones: 110000,
      provisionMantencion: 90000,
      comuna: "Las Condes",
      dormitorios: 2,
      piso: 8,
      lat: -33.4150,
      lng: -70.5800,
      nombre: "Caso A — LasCondes sobreprecio",
    },
  },
  {
    id: "B-Nunoa-borderline",
    label: "Borderline cerca del techo",
    notes: "UF 4.800 / 55m² = UF 87/m² (mediana Ñuñoa ~UF 75/m²). vmFranco UF 4.500 simula leve SOBREPRECIO.",
    etapa: "evaluando",
    input: {
      precio: 4800,
      valorMercadoFranco: 4500,
      superficie: 55,
      superficieTotal: 55,
      antiguedad: 6,
      piePct: 20,
      tasaInteres: 4.1,
      arriendo: 750000,
      gastos: 120000,
      contribuciones: 75000,
      provisionMantencion: 65000,
      comuna: "Ñuñoa",
      dormitorios: 2,
      piso: 6,
      lat: -33.4533,
      lng: -70.5942,
      nombre: "Caso B — Ñuñoa borderline",
    },
  },
  {
    id: "C-EstCentral-riesgos",
    label: "Riesgos cargados",
    notes: "UF 2.500 / 40m² = UF 62/m² + antiguedad 12 + arriendo justo. Tensiona riesgos.contenido.",
    etapa: "evaluando",
    input: {
      precio: 2500,
      valorMercadoFranco: 2200,
      superficie: 40,
      superficieTotal: 40,
      antiguedad: 12,
      piePct: 18,
      tasaInteres: 4.5,
      arriendo: 420000,
      gastos: 90000,
      contribuciones: 45000,
      provisionMantencion: 50000,
      comuna: "Estación Central",
      dormitorios: 1,
      piso: 14,
      vacanciaMeses: 2,
      lat: -33.4570,
      lng: -70.6800,
      nombre: "Caso C — Estación Central riesgos",
    },
  },
  {
    id: "D-Providencia-control",
    label: "Control canónico",
    notes: "UF 5.500 / 60m² = UF 91.7/m² (Providencia ≈ alineado). vmFranco = precio → PRECIO_ALINEADO.",
    etapa: "evaluando",
    input: {
      precio: 5500,
      valorMercadoFranco: 5500,
      superficie: 60,
      superficieTotal: 60,
      antiguedad: 4,
      piePct: 20,
      tasaInteres: 4.1,
      arriendo: 950000,
      gastos: 130000,
      contribuciones: 80000,
      provisionMantencion: 70000,
      comuna: "Providencia",
      dormitorios: 2,
      piso: 5,
      lat: -33.4283,
      lng: -70.6182,
      nombre: "Caso D — Providencia control",
    },
  },
];

const RATE_LIMIT_MS = 2500;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { runAnalysis, setUFValue } = await import("../src/lib/analysis");
  const { buildLtrPrompts } = await import("./lib/audit-prompt-builder");

  const UF = 40027;
  setUFValue(UF);

  const outDir = path.resolve(process.cwd(), "audit", "fase3.5-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const anthropic = new Anthropic();
  const summary: any[] = [];

  for (const c of CASES) {
    console.log(`\n→ [${c.id}] ${c.label}`);
    console.log(`  ${c.notes}`);
    const fullInput = { ...baseDefaults, ...c.input } as any;

    const results = runAnalysis(fullInput);
    const r = results as any;
    console.log(`  motor: engineSignal=${r.engineSignal} score=${r.score} fH.overall=${r.financingHealth?.overall} flujoNetoMensual=${r.metrics.flujoNetoMensual}`);

    const { systemPrompt, userPrompt, diag } = await buildLtrPrompts(fullInput, results, { etapa: c.etapa });
    process.stdout.write("  Llamando Claude… ");

    let aiResult: any = null;
    let rawText = "";
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      rawText = message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = rawText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      aiResult = JSON.parse(cleaned);
      console.log(`OK (francoVerdict=${aiResult.francoVerdict}, reestructuracion=${aiResult.reestructuracion ? "presente" : "ausente"})`);
    } catch (e) {
      console.log("FAIL", (e as Error).message);
      const dump = { caseDef: c, input: fullInput, results: r, error: (e as Error).message, rawText };
      fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));
      continue;
    }

    // Métricas para diagnóstico
    const neg = aiResult.negociacion || {};
    const ries = aiResult.riesgos || {};
    const negContent = String(neg.contenido_clp || "");
    const negEstrategia = String(neg.estrategiaSugerida_clp || "");
    const negCaja = String(neg.cajaAccionable_clp || "");
    const riesContent = String(ries.contenido_clp || "");
    const precioSugStr = String(neg.precioSugerido || "");

    // Heurísticas para diagnosticar
    const metricas = {
      precioSugerido_str: precioSugStr,
      precioSugerido_motor_uf: r.negociacion?.precioSugeridoUF ?? null,
      precioSugerido_motor_clp: r.negociacion?.precioSugeridoCLP ?? null,
      // Criterio 1 — justificación de precioSugerido
      neg_menciona_TIR: /TIR|tir/.test(negContent + " " + negEstrategia),
      neg_menciona_flujo_cruza: /cruza|flujo (positivo|neutro)|breakeven/i.test(negContent + " " + negEstrategia),
      neg_menciona_pp_o_pct: /\d+\s*(pp|punto|%|p\.p)/i.test(negContent + " " + negEstrategia),
      neg_compara_actual_vs_sugerido: /actual.*sugerido|sugerido.*actual|de UF|a UF/i.test(negContent + " " + negEstrategia),
      // Criterio 2 — coherencia techo/oferta/walk-away
      neg_menciona_techo: /\btecho\b/i.test(negContent + " " + negEstrategia + " " + negCaja),
      neg_menciona_oferta: /\boferta\b|ofrec[eé]/i.test(negContent + " " + negEstrategia + " " + negCaja),
      neg_menciona_walkaway: /\bno\s+(compres|firmes)|abandon|no aceptes|no pagues/i.test(negContent + " " + negEstrategia + " " + negCaja),
      neg_caja_contiene_precioSugerido: precioSugStr ? negCaja.includes(precioSugStr.replace("UF ", "UF ").trim()) : false,
      // Criterio 3 — truncado riesgos
      ries_chars: riesContent.length,
      ries_doble_newline_count: (riesContent.match(/\n\s*\n/g) || []).length,
      ries_bullet_count: (riesContent.match(/\n\s*(?:\d+\.|•|·|-)\s+/g) || []).length,
      ries_bold_count: (riesContent.match(/\*\*[^*]+\*\*/g) || []).length,
      ries_oraciones_aprox: (riesContent.match(/[.!?]\s/g) || []).length,
      // Simulación del extractor del frontend
      ries_parser_blocks: simulateExtractRiesgos(riesContent),
      // Criterio 4 — jerga sin traducir
      jerga_hits: detectJerga([
        aiResult.siendoFrancoHeadline_clp,
        aiResult.conviene?.respuestaDirecta_clp,
        aiResult.conviene?.reencuadre_clp,
        aiResult.costoMensual?.contenido_clp,
        negContent, negEstrategia, negCaja,
        aiResult.largoPlazo?.contenido_clp,
        riesContent,
      ].filter(Boolean).join(" \n ")),
    };

    const dump = {
      caseDef: c,
      input: fullInput,
      motor: {
        engineSignal: r.engineSignal,
        francoVerdict: r.francoVerdict,
        score: r.score,
        flujoNetoMensual: r.metrics?.flujoNetoMensual,
        precioSugerido: r.negociacion,
        financingHealth: r.financingHealth,
      },
      diag,
      ai_analysis: aiResult,
      rawText,
      metricas,
    };
    fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));

    summary.push({
      id: c.id,
      label: c.label,
      engineSignal: r.engineSignal,
      francoVerdict: aiResult.francoVerdict,
      precioSugeridoMotor: r.negociacion?.precioSugeridoUF,
      precioSugeridoIA: precioSugStr,
      metricas,
    });

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(path.resolve(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSummary → ${path.resolve(outDir, "_summary.json")}`);
}

// Replica de extractRiesgos del frontend — para ver qué entrega el parser.
function simulateExtractRiesgos(content: string): { titulo: string; descripcion: string; descripcionTruncadoEn220: boolean }[] {
  if (!content || typeof content !== "string") return [];
  const boldMatches = Array.from(content.matchAll(/\*\*([^*]+)\*\*/g));
  if (boldMatches.length >= 2) {
    const results: { titulo: string; descripcion: string; descripcionTruncadoEn220: boolean }[] = [];
    for (let i = 0; i < boldMatches.length; i++) {
      const match = boldMatches[i];
      const titleRaw = match[1].trim().replace(/[.:]$/, "");
      const start = match.index! + match[0].length;
      const end = i + 1 < boldMatches.length ? boldMatches[i + 1].index! : content.length;
      const desc = content.slice(start, end).trim();
      if (desc.length > 10) {
        results.push({ titulo: titleRaw, descripcion: desc.slice(0, 220), descripcionTruncadoEn220: desc.length > 220 });
      }
    }
    if (results.length > 0) return results.slice(0, 3);
  }
  const blocks = content
    .split(/\n\s*\n|\n\s*(?:\d+\.|•|·|-)\s+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  return blocks.slice(0, 3).map((block, i) => {
    const firstSentence = block.split(/[.:]/)[0];
    const titulo = firstSentence.trim().slice(0, 60) || `Riesgo ${i + 1}`;
    const descripcion = block.replace(firstSentence, "").replace(/^[.:]\s*/, "").trim().slice(0, 220) || block.slice(0, 220);
    return { titulo, descripcion, descripcionTruncadoEn220: block.length > 220 };
  });
}

const JERGA_TERMS = [
  "TIR", "tir",
  "DFL-2", "DFL2",
  "cap rate",
  "yield bruto", "yield neto",
  "LTV",
  "no cruza a positivo", "flujo no cruza",
  "breakeven",
  "VAN",
  "cap.", "amortización",
  "bps",
  "cuartil",
];

function detectJerga(text: string): string[] {
  const lower = text.toLowerCase();
  return JERGA_TERMS.filter(t => lower.includes(t.toLowerCase()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
