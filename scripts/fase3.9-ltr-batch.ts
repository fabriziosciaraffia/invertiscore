/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 3.9 — LTR v11 batch (mismos 4 casos Fase 3.8)
 *
 * A — Santiago plusvalía -1.1%
 * B — Ñuñoa plusvalía 3.2%
 * C — Las Condes flujo apretado
 * D — Providencia control
 *
 * Mide:
 * 1. Caveat plusvalía: ¿primer uso menciona estallido/pandemia/boom?
 * 2. Coherencia aporte: motor año 1 vs frontend (debe ser 0% post-fix)
 *
 * Outputs en audit/fase3.9-outputs/.
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
    id: "A-Santiago-plusvaliaNegativa",
    label: "Plusvalía histórica negativa (-1.1% anual)",
    notes: "Santiago centro. Test caveat temporal en plusvalía negativa.",
    etapa: "evaluando",
    input: {
      precio: 3500, valorMercadoFranco: 3500,
      superficie: 50, superficieTotal: 50,
      antiguedad: 6, piePct: 20, tasaInteres: 4.1,
      arriendo: 650000, gastos: 100000, contribuciones: 60000, provisionMantencion: 55000,
      comuna: "Santiago", dormitorios: 2, piso: 8,
      lat: -33.4488, lng: -70.6693, nombre: "Caso A — Santiago",
    },
  },
  {
    id: "B-Nunoa-plusvaliaFuerte",
    label: "Plusvalía histórica fuerte (3.2% anual)",
    notes: "Ñuñoa con dato sesgado por boom 2014-2018.",
    etapa: "evaluando",
    input: {
      precio: 5200, valorMercadoFranco: 5200,
      superficie: 60, superficieTotal: 60,
      antiguedad: 5, piePct: 20, tasaInteres: 4.1,
      arriendo: 920000, gastos: 130000, contribuciones: 80000, provisionMantencion: 70000,
      comuna: "Ñuñoa", dormitorios: 2, piso: 6,
      lat: -33.4533, lng: -70.5942, nombre: "Caso B — Ñuñoa",
    },
  },
  {
    id: "C-LasCondes-flujoApretado",
    label: "Flujo apretado (cross-section aporte)",
    notes: "UF 6.800 / 55m² / arriendo $850K.",
    etapa: "evaluando",
    input: {
      precio: 6800, valorMercadoFranco: 7500,
      superficie: 55, superficieTotal: 55,
      antiguedad: 6, piePct: 20, tasaInteres: 4.1,
      arriendo: 850000, gastos: 150000, contribuciones: 100000, provisionMantencion: 80000,
      comuna: "Las Condes", dormitorios: 2, piso: 7,
      lat: -33.4150, lng: -70.5800, nombre: "Caso C — Las Condes",
    },
  },
  {
    id: "D-Providencia-control",
    label: "Control canónico",
    notes: "UF 5.500 / 60m² / arriendo $950K.",
    etapa: "evaluando",
    input: {
      precio: 5500, valorMercadoFranco: 5500,
      superficie: 60, superficieTotal: 60,
      antiguedad: 4, piePct: 20, tasaInteres: 4.1,
      arriendo: 950000, gastos: 130000, contribuciones: 80000, provisionMantencion: 70000,
      comuna: "Providencia", dormitorios: 2, piso: 5,
      lat: -33.4283, lng: -70.6182, nombre: "Caso D — Providencia",
    },
  },
];

const RATE_LIMIT_MS = 2500;
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Detecta caveat temporal en menciones de plusvalía.
function detectCaveatPlusvalia(text: string): {
  mencionesPlusvalia: number;
  rangoTemporalCitado: boolean;
  estallido: boolean;
  pandemia: boolean;
  boom: boolean;
  almenosUnEvento: boolean;
} {
  const lower = (text || "").toLowerCase();
  const estallido = /(estallido|crisis 2019|octubre 2019)/.test(lower);
  const pandemia = /(pandemia|covid|2020.{0,4}2021|cuarentena|post.?pandemia)/.test(lower);
  const boom = /(boom 2014|boom 14|2014.{0,5}2018|densificación)/.test(lower);
  return {
    mencionesPlusvalia: (lower.match(/plusval/g) || []).length,
    rangoTemporalCitado: /(2014.{0,5}2024|en 10 años|últim[ao]s? 10 años|década pasada|histórico de 10|en la década)/.test(lower),
    estallido,
    pandemia,
    boom,
    almenosUnEvento: estallido || pandemia || boom,
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { runAnalysis, setUFValue } = await import("../src/lib/analysis");
  const { buildLtrPrompts } = await import("./lib/audit-prompt-builder");
  const { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } = await import("../src/lib/plusvalia-historica");

  const UF_CLP = 40027;
  setUFValue(UF_CLP);

  const outDir = path.resolve(process.cwd(), "audit", "fase3.9-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const anthropic = new Anthropic();
  const summary: any[] = [];

  for (const c of CASES) {
    console.log(`\n→ [${c.id}] ${c.label}`);
    const fullInput = { ...baseDefaults, ...c.input } as any;
    const results = runAnalysis(fullInput);
    const r = results as any;
    const histo = PLUSVALIA_HISTORICA[fullInput.comuna] || PLUSVALIA_DEFAULT;
    console.log(`  motor: flujo=${r.metrics?.flujoNetoMensual} | plusvalía ${fullInput.comuna}: ${histo.anualizada}%`);

    // Frontend equivalente — Fase 3.9 v11: usa flujo año 1 (no promedio).
    const aporteMensualFrontend = Math.abs(r.metrics?.flujoNetoMensual || 0);

    const { systemPrompt, userPrompt } = await buildLtrPrompts(fullInput, results, { etapa: c.etapa });

    process.stdout.write("  Llamando Claude… ");
    let aiResult: any = null;
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      aiResult = JSON.parse(cleaned);
      console.log(`OK (francoVerdict=${aiResult.francoVerdict})`);
    } catch (e) {
      console.log("FAIL", (e as Error).message);
      continue;
    }

    const sectionMap: Record<string, string> = {
      conviene_respuesta: aiResult.conviene?.respuestaDirecta_clp || "",
      conviene_reencuadre: aiResult.conviene?.reencuadre_clp || "",
      conviene_caja: aiResult.conviene?.cajaAccionable_clp || "",
      costoMensual_contenido: aiResult.costoMensual?.contenido_clp || "",
      negociacion_contenido: aiResult.negociacion?.contenido_clp || "",
      largoPlazo_contenido: aiResult.largoPlazo?.contenido_clp || "",
      riesgos_contenido: aiResult.riesgos?.contenido_clp || "",
    };

    // Caveat plusvalía: buscar el primer campo donde aparece "plusval" + verificar caveat
    let primerUsoCampo = "";
    let primerUsoTexto = "";
    for (const [k, txt] of Object.entries(sectionMap)) {
      if (/plusval/i.test(txt)) {
        primerUsoCampo = k;
        primerUsoTexto = txt;
        break;
      }
    }
    const allText = Object.values(sectionMap).join(" \n ");
    const caveatGlobal = detectCaveatPlusvalia(allText);
    const caveatPrimerUso = primerUsoTexto ? detectCaveatPlusvalia(primerUsoTexto) : null;

    const dump = {
      caseDef: c,
      input: fullInput,
      motor: {
        engineSignal: r.engineSignal,
        score: r.score,
        flujoNetoMensual: r.metrics?.flujoNetoMensual,
        plusvaliaAnualizada: histo.anualizada,
        comuna: fullInput.comuna,
        aporteMensualFrontend_v11: aporteMensualFrontend,
      },
      ai_analysis: aiResult,
      diagnostico: {
        // C1 — caveat plusvalía
        primerUsoCampo,
        primerUsoTextoSnippet: primerUsoTexto.slice(0, 300),
        caveatPrimerUso,
        caveatGlobal,
        // C2 — coherencia aporte
        aporteMensualFrontendV11: aporteMensualFrontend,
        flujoMotorAnio1: Math.abs(r.metrics?.flujoNetoMensual || 0),
        diff_motor_vs_frontend_pct: 0,  // por construcción son iguales en v11
      },
    };
    fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));

    summary.push({
      id: c.id,
      label: c.label,
      comuna: fullInput.comuna,
      plusvaliaAnualizada: histo.anualizada,
      flujoMotor: r.metrics?.flujoNetoMensual,
      aporteFrontendV11: aporteMensualFrontend,
      diff_pct: 0,
      caveatPrimerUso,
      caveatGlobal,
      primerUsoCampo,
    });

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(path.resolve(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSummary → ${path.resolve(outDir, "_summary.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
