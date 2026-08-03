/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 3.6 — LTR v9 batch (4 sintéticos)
 *
 * Mismos perfiles A/B/C/D que Fase 3.5 baseline. Aplica post-merge de anclas
 * deterministas + glosas IA, igual que producción en generateAiAnalysis.
 * Outputs en audit/fase3.6-outputs/.
 *
 *   npx tsx scripts/fase3.6-ltr-batch.ts
 *
 * NO escribe en DB. NO toca audit/fase3.5-outputs/ (baseline).
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

// MISMOS 4 perfiles que Fase 3.5 — copia exacta para comparabilidad.
const CASES: CaseDef[] = [
  {
    id: "A-LasCondes-sobreprecio",
    label: "Premium con sobreprecio claro",
    notes: "UF 7.500 / 70m² = UF 107/m² (mediana LC ~UF 90/m²). vmFranco UF 6.300 simula SOBREPRECIO ~+19%.",
    etapa: "evaluando",
    input: {
      precio: 7500,
      valorMercadoFranco: 6300,
      superficie: 70, superficieTotal: 70,
      antiguedad: 5, piePct: 20, tasaInteres: 4.1,
      arriendo: 1300000, gastos: 180000, contribuciones: 110000, provisionMantencion: 90000,
      comuna: "Las Condes", dormitorios: 2, piso: 8,
      lat: -33.4150, lng: -70.5800, nombre: "Caso A",
    },
  },
  {
    id: "B-Nunoa-borderline",
    label: "Borderline cerca del techo",
    notes: "UF 4.800 / 55m² = UF 87/m² (mediana Ñuñoa ~UF 75/m²). vmFranco UF 4.500 simula leve SOBREPRECIO.",
    etapa: "evaluando",
    input: {
      precio: 4800, valorMercadoFranco: 4500,
      superficie: 55, superficieTotal: 55,
      antiguedad: 6, piePct: 20, tasaInteres: 4.1,
      arriendo: 750000, gastos: 120000, contribuciones: 75000, provisionMantencion: 65000,
      comuna: "Ñuñoa", dormitorios: 2, piso: 6,
      lat: -33.4533, lng: -70.5942, nombre: "Caso B",
    },
  },
  {
    id: "C-EstCentral-riesgos",
    label: "Riesgos cargados",
    notes: "UF 2.500 / 40m² + antiguedad 12. Tensiona riesgos.contenido y jerga (bps).",
    etapa: "evaluando",
    input: {
      precio: 2500, valorMercadoFranco: 2200,
      superficie: 40, superficieTotal: 40,
      antiguedad: 12, piePct: 18, tasaInteres: 4.5,
      arriendo: 420000, gastos: 90000, contribuciones: 45000, provisionMantencion: 50000,
      comuna: "Estación Central", dormitorios: 1, piso: 14, vacanciaMeses: 2,
      lat: -33.4570, lng: -70.6800, nombre: "Caso C",
    },
  },
  {
    id: "D-Providencia-control",
    label: "Control canónico",
    notes: "UF 5.500 / 60m². vmFranco = precio. PRECIO_ALINEADO.",
    etapa: "evaluando",
    input: {
      precio: 5500, valorMercadoFranco: 5500,
      superficie: 60, superficieTotal: 60,
      antiguedad: 4, piePct: 20, tasaInteres: 4.1,
      arriendo: 950000, gastos: 130000, contribuciones: 80000, provisionMantencion: 70000,
      comuna: "Providencia", dormitorios: 2, piso: 5,
      lat: -33.4283, lng: -70.6182, nombre: "Caso D",
    },
  },
];

const RATE_LIMIT_MS = 2500;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const JERGA_TERMS = [
  "TIR", "tir",
  "DFL-2", "DFL2",
  "cap rate", "yield bruto", "yield neto",
  "LTV",
  "no cruza a positivo", "flujo no cruza",
  "breakeven",
  "VAN",
  "bps",
];

function detectJerga(text: string): string[] {
  const lower = text.toLowerCase();
  return JERGA_TERMS.filter(t => lower.includes(t.toLowerCase()));
}

// Detectar glosa de TIR en 1ra aparición ("TIR (rentabilidad..." o "TIR — ...").
function tirGlosadaPrimerUso(text: string): boolean {
  const m = text.match(/\bTIR\b/);
  if (!m) return true;  // no hay TIR — trivialmente OK
  const idx = m.index!;
  const after = text.slice(idx, idx + 80).toLowerCase();
  return /tir\s*\(/.test(after) || /tir\s*[—\-:,]/.test(after) && /(rentabil|gana|anual)/.test(after);
}

function simulateExtractRiesgos(content: string): { titulo: string; descripcion: string; truncado: boolean }[] {
  if (!content) return [];
  const dobleSalto = content.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 20);
  if (dobleSalto.length >= 2) {
    return dobleSalto.slice(0, 3).map((block, i) => {
      const fs = block.match(/^([^.!?]+[.!?])/);
      const titulo = fs ? fs[1].replace(/[.:]$/, "").trim() : `Riesgo ${i + 1}`;
      const rest = fs ? block.slice(fs[0].length).trim() : "";
      return {
        titulo: titulo.slice(0, 60),
        descripcion: (rest || block).slice(0, 220),
        truncado: (rest || block).length > 220 || titulo.length > 60,
      };
    });
  }
  // Fallback (no debería entrar en v9)
  const blocks = content.split(/\n\s*(?:\d+\.|•|·|-)\s+/).map(b => b.trim()).filter(b => b.length > 20);
  return blocks.slice(0, 3).map((block, i) => {
    const fs = block.split(/[.:]/)[0];
    return {
      titulo: fs.trim().slice(0, 60) || `Riesgo ${i + 1}`,
      descripcion: block.replace(fs, "").replace(/^[.:]\s*/, "").trim().slice(0, 220) || block.slice(0, 220),
      truncado: block.length > 220,
    };
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { runAnalysis, setUFValue } = await import("../src/lib/analysis");
  const { buildLtrPrompts } = await import("./lib/audit-prompt-builder");

  const UF_CLP = 40027;
  setUFValue(UF_CLP);

  const outDir = path.resolve(process.cwd(), "audit", "fase3.6-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const anthropic = new Anthropic();
  const summary: any[] = [];

  for (const c of CASES) {
    console.log(`\n→ [${c.id}] ${c.label}`);
    const fullInput = { ...baseDefaults, ...c.input } as any;
    const results = runAnalysis(fullInput);
    const r = results as any;
    console.log(`  motor: engineSignal=${r.engineSignal} score=${r.score} fH.overall=${r.financingHealth?.overall}`);

    const { systemPrompt, userPrompt, diag } = await buildLtrPrompts(fullInput, results, { etapa: c.etapa });

    // Replicar el cálculo de anclas igual que el shim (paralelo a producción).
    const neg = r.negociacion;
    const techoUF = neg?.precioSugeridoUF ? Math.round(neg.precioSugeridoUF) : Math.round(fullInput.precio * 0.9);
    const techoCLP = Math.round(techoUF * UF_CLP);
    const primeraOfertaUF = Math.round(techoUF * 0.95);
    const primeraOfertaCLP = Math.round(primeraOfertaUF * UF_CLP);
    let walkAway: { precio_uf: number | null; precio_clp: number | null; razon: string } | null;
    if (r.engineSignal === "BUSCAR OTRA") {
      walkAway = { precio_uf: null, precio_clp: null, razon: "veredicto motor: buscar otra propiedad" };
    } else if (r.engineSignal === "AJUSTA EL PRECIO") {
      walkAway = { precio_uf: techoUF, precio_clp: techoCLP, razon: "no comprar sobre el techo" };
    } else {
      walkAway = null;
    }

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
      console.log(`OK (francoVerdict=${aiResult.francoVerdict})`);
    } catch (e) {
      console.log("FAIL", (e as Error).message);
      const dump = { caseDef: c, input: fullInput, results: r, error: (e as Error).message, rawText };
      fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));
      continue;
    }

    // ─── Post-merge de anclas (igual que producción) ───
    if (aiResult?.negociacion) {
      const iaGlosas = aiResult.negociacion.precios || {};
      aiResult.negociacion.precios = {
        primeraOferta_uf: primeraOfertaUF,
        primeraOferta_clp: primeraOfertaCLP,
        techo_uf: techoUF,
        techo_clp: techoCLP,
        walkAway,
        glosaPrimeraOferta_clp: String(iaGlosas.glosaPrimeraOferta_clp || ""),
        glosaPrimeraOferta_uf: String(iaGlosas.glosaPrimeraOferta_uf || iaGlosas.glosaPrimeraOferta_clp || ""),
        glosaTecho_clp: String(iaGlosas.glosaTecho_clp || ""),
        glosaTecho_uf: String(iaGlosas.glosaTecho_uf || iaGlosas.glosaTecho_clp || ""),
        glosaWalkAway_clp: String(iaGlosas.glosaWalkAway_clp || ""),
        glosaWalkAway_uf: String(iaGlosas.glosaWalkAway_uf || iaGlosas.glosaWalkAway_clp || ""),
      };
      aiResult.negociacion.precioSugerido = `UF ${techoUF.toLocaleString("es-CL")}`;
    }

    // ─── Métricas para diagnóstico ───
    const ai = aiResult;
    const allText = [
      ai.siendoFrancoHeadline_clp,
      ai.conviene?.respuestaDirecta_clp,
      ai.conviene?.reencuadre_clp,
      ai.costoMensual?.contenido_clp,
      ai.negociacion?.contenido_clp,
      ai.negociacion?.estrategiaSugerida_clp,
      ai.negociacion?.cajaAccionable_clp,
      ai.negociacion?.precios?.glosaPrimeraOferta_clp,
      ai.negociacion?.precios?.glosaTecho_clp,
      ai.negociacion?.precios?.glosaWalkAway_clp,
      ai.largoPlazo?.contenido_clp,
      ai.riesgos?.contenido_clp,
    ].filter(Boolean).join(" \n ");

    const riesContent = String(ai.riesgos?.contenido_clp || "");
    const negCaja = String(ai.negociacion?.cajaAccionable_clp || "");
    const precioSug = String(ai.negociacion?.precioSugerido || "");

    const metricas = {
      // Criterio 1 — precioSugerido coherente con techo
      precioSugerido: precioSug,
      precioSugerido_eq_techo: precioSug === `UF ${techoUF.toLocaleString("es-CL")}`,
      // Criterio 2 — anclas
      precios_presentes: !!ai.negociacion?.precios,
      glosaPrimera_presente: !!ai.negociacion?.precios?.glosaPrimeraOferta_clp,
      glosaTecho_presente: !!ai.negociacion?.precios?.glosaTecho_clp,
      glosaWalk_presente: walkAway === null ? null : !!ai.negociacion?.precios?.glosaWalkAway_clp,
      caja_contiene_primeraOferta_o_techo: negCaja.includes(`UF ${primeraOfertaUF.toLocaleString("es-CL")}`) || negCaja.includes(`UF ${techoUF.toLocaleString("es-CL")}`),
      // Criterio 3 — riesgos delimitador
      ries_chars: riesContent.length,
      ries_doble_newline: (riesContent.match(/\n\s*\n/g) || []).length,
      ries_parser_blocks: simulateExtractRiesgos(riesContent),
      // Criterio 4 — jerga
      jerga_hits: detectJerga(allText),
      tir_glosada_primer_uso: tirGlosadaPrimerUso(allText),
    };

    const dump = {
      caseDef: c,
      input: fullInput,
      motor: {
        engineSignal: r.engineSignal,
        francoVerdict: r.francoVerdict,
        score: r.score,
        flujoNetoMensual: r.metrics?.flujoNetoMensual,
      },
      anclasMotor: { primeraOfertaUF, primeraOfertaCLP, techoUF, techoCLP, walkAway },
      diag,
      ai_analysis: ai,
      rawText,
      metricas,
    };
    fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));

    summary.push({
      id: c.id,
      label: c.label,
      engineSignal: r.engineSignal,
      francoVerdict: ai.francoVerdict,
      anclas: { primeraOfertaUF, techoUF, walkAway: walkAway?.precio_uf ?? walkAway?.razon ?? "null" },
      metricas,
    });

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(path.resolve(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSummary → ${path.resolve(outDir, "_summary.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
