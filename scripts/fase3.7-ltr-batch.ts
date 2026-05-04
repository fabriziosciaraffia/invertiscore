/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 3.7 — LTR v10 batch (4 originales + 2 nuevos)
 *
 * Casos A/B/C/D heredados de Fase 3.5/3.6 + 2 casos nuevos:
 *   E — Bajo mercado con flujo viable (test modo "cerrar_actual")
 *   F — Bajo mercado con flujo apretado (test modo "optimizar_flujo")
 *
 * Aplica post-merge anclas v10 + lectura de neg.modo / neg.razon del motor.
 * Outputs en audit/fase3.7-outputs/.
 *
 *   npx tsx scripts/fase3.7-ltr-batch.ts
 *
 * NO escribe en DB. NO toca audit/fase3.5-outputs/ ni audit/fase3.6-outputs/.
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
  // — A/B/C/D heredados (idénticos a Fase 3.6) —
  {
    id: "A-LasCondes-sobreprecio",
    label: "Premium con sobreprecio claro",
    notes: "UF 7.500 / 70m². vmFranco UF 6.300 → SOBREPRECIO ~+19%. Modo esperado: alinear_mercado.",
    etapa: "evaluando",
    input: {
      precio: 7500, valorMercadoFranco: 6300,
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
    notes: "UF 4.800 / 55m². vmFranco UF 4.500. Modo esperado: alinear_mercado.",
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
    label: "Riesgos cargados / BUSCAR OTRA",
    notes: "UF 2.500 / 40m². Modo esperado: alinear_mercado. walkAway: precio_uf=null.",
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
    notes: "UF 5.500 / 60m². vmFranco = precio. Modo esperado: alinear_mercado.",
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
  // — Nuevos para v10 —
  {
    id: "E-Providencia-bajoMercado-flujoViable",
    label: "Bajo mercado con flujo viable",
    notes: "UF 5.500 / 60m² / arriendo $1.100K. vmFranco UF 6.200 (precio bajo mercado). Arriendo alto → flujo viable. Modo esperado: cerrar_actual.",
    etapa: "evaluando",
    input: {
      precio: 5500, valorMercadoFranco: 6200,
      superficie: 60, superficieTotal: 60,
      antiguedad: 4, piePct: 25, tasaInteres: 4.1,
      arriendo: 1100000, gastos: 130000, contribuciones: 80000, provisionMantencion: 70000,
      comuna: "Providencia", dormitorios: 2, piso: 5,
      lat: -33.4283, lng: -70.6182, nombre: "Caso E",
    },
  },
  {
    id: "F-LasCondes-bajoMercado-flujoApretado",
    label: "Bajo mercado con flujo apretado",
    notes: "UF 6.800 / 55m² / arriendo $850K. vmFranco UF 7.500. Arriendo bajo vs cuota → flujo apretado. Modo esperado: optimizar_flujo.",
    etapa: "evaluando",
    input: {
      precio: 6800, valorMercadoFranco: 7500,
      superficie: 55, superficieTotal: 55,
      antiguedad: 6, piePct: 20, tasaInteres: 4.1,
      arriendo: 850000, gastos: 150000, contribuciones: 100000, provisionMantencion: 80000,
      comuna: "Las Condes", dormitorios: 2, piso: 7,
      lat: -33.4150, lng: -70.5800, nombre: "Caso F",
    },
  },
];

const RATE_LIMIT_MS = 2500;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const VOCAB_GLOSAS_V9_DEPRECATED = [
  "Reconoce ventaja",
  "Matemática mejora, ventaja se mantiene",
  "Sobre este precio pierdes la ventaja",  // ya OK pero no lo permitimos como única razón sin glosa
];

function detectGlosaCriptica(g: string): boolean {
  const norm = g.trim().toLowerCase();
  // Glosa críptica si es muy corta (<20 chars) o repite conceptos vacíos
  if (norm.length < 20) return true;
  if (/(matem.*tica mejora|reconoce ventaja|ventaja se mantiene)$/i.test(norm)) return true;
  return false;
}

const JERGA_TERMS = ["TIR", "tir", "bps", "no cruza a positivo", "flujo no cruza"];
function detectJerga(text: string): string[] {
  const lower = text.toLowerCase();
  return JERGA_TERMS.filter(t => lower.includes(t.toLowerCase()));
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
  const blocks = content.split(/\n\s*(?:\d+\.|•|·|-)\s+/).map(b => b.trim()).filter(b => b.length > 20);
  return blocks.slice(0, 3).map((block, i) => ({
    titulo: block.split(/[.:]/)[0].trim().slice(0, 60) || `Riesgo ${i + 1}`,
    descripcion: block.slice(0, 220),
    truncado: block.length > 220,
  }));
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

  const outDir = path.resolve(process.cwd(), "audit", "fase3.7-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const anthropic = new Anthropic();
  const summary: any[] = [];

  for (const c of CASES) {
    console.log(`\n→ [${c.id}] ${c.label}`);
    const fullInput = { ...baseDefaults, ...c.input } as any;
    const results = runAnalysis(fullInput);
    const r = results as any;
    const motorModo = r.negociacion?.modo || "(undefined)";
    const motorRazon = r.negociacion?.razon || "(undefined)";
    console.log(`  motor: engineSignal=${r.engineSignal} score=${r.score} flujo=${r.metrics?.flujoNetoMensual} modo=${motorModo}`);

    const { systemPrompt, userPrompt, diag } = await buildLtrPrompts(fullInput, results, { etapa: c.etapa });

    // Replicar cálculo de anclas igual que producción.
    const neg = r.negociacion;
    const techoUF = neg?.precioSugeridoUF ? Math.round(neg.precioSugeridoUF) : Math.round(fullInput.precio * 0.9);
    const techoCLP = Math.round(techoUF * UF_CLP);
    const primeraOfertaUF = motorModo === "cerrar_actual" ? techoUF : Math.round(techoUF * 0.95);
    const primeraOfertaCLP = Math.round(primeraOfertaUF * UF_CLP);
    let walkAway: { precio_uf: number | null; precio_clp: number | null; razon: string } | null;
    if (r.engineSignal === "BUSCAR OTRA") {
      walkAway = { precio_uf: null, precio_clp: null, razon: "El motor recomienda no comprar esta propiedad." };
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

    // Post-merge anclas (replicar producción).
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

    const ai = aiResult;
    const neg2 = ai.negociacion?.precios || {};
    const allText = [
      ai.siendoFrancoHeadline_clp,
      ai.conviene?.respuestaDirecta_clp,
      ai.conviene?.reencuadre_clp,
      ai.costoMensual?.contenido_clp,
      ai.negociacion?.contenido_clp,
      ai.negociacion?.estrategiaSugerida_clp,
      ai.negociacion?.cajaAccionable_clp,
      neg2.glosaPrimeraOferta_clp,
      neg2.glosaTecho_clp,
      neg2.glosaWalkAway_clp,
      ai.largoPlazo?.contenido_clp,
      ai.riesgos?.contenido_clp,
    ].filter(Boolean).join(" \n ");

    const riesContent = String(ai.riesgos?.contenido_clp || "");
    const metricas = {
      modoMotor: motorModo,
      razonMotor: motorRazon,
      bajoMercado: fullInput.precio < (fullInput.valorMercadoFranco || fullInput.precio) * 0.98,
      flujoNeto: r.metrics?.flujoNetoMensual,
      // Criterio 1 — sugerido honesto
      precioSugerido: ai.negociacion?.precioSugerido,
      sugerido_eq_actual: techoUF === Math.round(fullInput.precio),
      sugerido_eq_techo: ai.negociacion?.precioSugerido === `UF ${techoUF.toLocaleString("es-CL")}`,
      // Criterio 2 — walkAway limpio
      walkAway_presente: walkAway !== null,
      walkAway_solo_BUSCAR_OTRA: r.engineSignal === "BUSCAR OTRA" ? walkAway !== null : walkAway === null,
      walkAway_razon_capitalizada: walkAway?.razon?.[0] === walkAway?.razon?.[0]?.toUpperCase(),
      // Criterio 3 — glosas con objetivo
      glosaPrimera: neg2.glosaPrimeraOferta_clp,
      glosaTecho: neg2.glosaTecho_clp,
      glosaWalk: neg2.glosaWalkAway_clp,
      glosa_primera_criptica: detectGlosaCriptica(neg2.glosaPrimeraOferta_clp || ""),
      glosa_techo_criptica: detectGlosaCriptica(neg2.glosaTecho_clp || ""),
      // Criterio 4 — modo correcto del motor
      modo_es_cerrar_actual_si_bajo_mercado_y_flujo_viable: motorModo === "cerrar_actual"
        ? fullInput.precio < (fullInput.valorMercadoFranco || fullInput.precio) * 0.98
        : true,
      // Riesgos
      ries_doble_newline: (riesContent.match(/\n\s*\n/g) || []).length,
      ries_blocks: simulateExtractRiesgos(riesContent),
      // Jerga
      jerga_hits: detectJerga(allText),
    };

    const dump = {
      caseDef: c,
      input: fullInput,
      motor: {
        engineSignal: r.engineSignal,
        francoVerdict: r.francoVerdict,
        score: r.score,
        flujoNetoMensual: r.metrics?.flujoNetoMensual,
        modo: motorModo,
        razon: motorRazon,
      },
      anclasMotor: { primeraOfertaUF, primeraOfertaCLP, techoUF, techoCLP, walkAway },
      diag,
      ai_analysis: ai,
      metricas,
    };
    fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));

    summary.push({
      id: c.id,
      label: c.label,
      engineSignal: r.engineSignal,
      francoVerdict: ai.francoVerdict,
      modoMotor: motorModo,
      anclas: { primeraOfertaUF, techoUF, walkAway: walkAway?.precio_uf ?? walkAway?.razon ?? "null" },
      metricas,
    });

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(path.resolve(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSummary → ${path.resolve(outDir, "_summary.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
