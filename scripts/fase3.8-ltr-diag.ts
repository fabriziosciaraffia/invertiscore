/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 3.8 — LTR Diagnóstico (Plusvalía 10A + coherencia aporte mensual)
 *
 * 4 sintéticos:
 *   A — Santiago centro (plusvalía -1.1%, único caso negativo del dataset)
 *   B — Ñuñoa (plusvalía +3.2%, comuna con boom 2014-2018)
 *   C — Las Condes UF 6.800 / arriendo $850K (flujo apretado, cross-section)
 *   D — Providencia UF 5.500 / arriendo $950K (control)
 *
 * Outputs en audit/fase3.8-outputs/.
 *
 *   npx tsx scripts/fase3.8-ltr-diag.ts
 *
 * NO escribe en DB. NO toca baselines previos.
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
    notes: "Santiago centro. Único caso del dataset con plusvalía negativa. Test: ¿IA contextualiza el negativo o lo presenta plano?",
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
    notes: "Ñuñoa con dato sesgado posiblemente por boom 2014-2018. Test: ¿IA advierte que el dato incluye eventos del rango?",
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
    label: "Flujo apretado (cross-section aporte mensual)",
    notes: "UF 6.800 / 55m² / arriendo $850K. Test: ¿el aporte mensual coincide entre header / costo / negociación / largo plazo?",
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
    notes: "UF 5.500 / 60m² / arriendo $950K. Comparable con outputs Fase 3.7.",
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

// Extrae todos los montos $XXX.XXX o $XXXK o $X,XM en un texto.
// Retorna lista normalizada en CLP enteros.
function extractCLPAmounts(text: string): number[] {
  if (!text) return [];
  const out: number[] = [];
  // Pattern 1: $123.456 / $1.234.567 (separador de miles)
  const p1 = Array.from(text.matchAll(/\$\s*([\d.]+)(?!\s*[KkMm])/g));
  for (const m of p1) {
    const num = parseInt(m[1].replace(/\./g, ""), 10);
    if (num >= 10000) out.push(num);  // filtra decimales sueltos
  }
  // Pattern 2: $XXXK / $1.2M
  const p2 = Array.from(text.matchAll(/\$\s*([\d.,]+)\s*([KkMm])/g));
  for (const m of p2) {
    const numRaw = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    const mult = m[2].toLowerCase() === "k" ? 1000 : 1_000_000;
    out.push(Math.round(numRaw * mult));
  }
  return out;
}

// Detecta menciones de plusvalía con número en %.
function detectPlusvaliaContexto(text: string): {
  mencionesPlusvalia: number;
  rangoTemporal: boolean;
  estallido2019: boolean;
  pandemia: boolean;
  cicloVsEstructural: boolean;
  pasadoNoGarantiza: boolean;
} {
  const lower = (text || "").toLowerCase();
  return {
    mencionesPlusvalia: (lower.match(/plusval/g) || []).length,
    rangoTemporal: /(2014.{0,5}2024|en 10 años|últim[ao]s? 10 años|década pasada|histórico de 10)/.test(lower),
    estallido2019: /(estallido|crisis 2019|octubre 2019)/.test(lower),
    pandemia: /(pandemia|covid|2020.{0,4}2021|cuarentena)/.test(lower),
    cicloVsEstructural: /(ciclo|estructural|tendencia|coyuntura)/.test(lower),
    pasadoNoGarantiza: /(pasado no garantiza|no asegura|no implica futuro|histórico no proyecta)/.test(lower),
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

  const outDir = path.resolve(process.cwd(), "audit", "fase3.8-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const anthropic = new Anthropic();
  const summary: any[] = [];

  for (const c of CASES) {
    console.log(`\n→ [${c.id}] ${c.label}`);
    const fullInput = { ...baseDefaults, ...c.input } as any;
    const results = runAnalysis(fullInput);
    const r = results as any;
    console.log(`  motor: engineSignal=${r.engineSignal} flujo=${r.metrics?.flujoNetoMensual} score=${r.score}`);

    // Plusvalía del input
    const histo = PLUSVALIA_HISTORICA[fullInput.comuna] || PLUSVALIA_DEFAULT;
    console.log(`  plusvalía ${fullInput.comuna}: ${histo.anualizada}% anual (10A: ${histo.plusvalia10a}%)`);

    // Aporte mensual cálculo frontend (Drawer Largo Plazo) — réplica
    const exit = r.exitScenario;
    const aniosPlazo = exit?.anios ?? 10;
    const flujoMensualAcum = exit?.flujoMensualAcumuladoNegativo ?? 0;
    const aporteMensualPromedioFrontend = aniosPlazo > 0 ? flujoMensualAcum / (aniosPlazo * 12) : 0;

    const { systemPrompt, userPrompt, diag } = await buildLtrPrompts(fullInput, results, { etapa: c.etapa });

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

    // ─── Coherencia aporte mensual cross-section ───
    // Buscar el flujoNetoMensual del motor (año 1) en cada sección IA.
    const flujoMotor = Math.abs(r.metrics?.flujoNetoMensual || 0);
    const matchTolerance = 0.05;  // 5% de tolerancia para diferencias de redondeo

    const sectionsAporte: Record<string, { texto: string; montos: number[]; cerca: number[] }> = {};
    const sectionMap: Record<string, string> = {
      conviene_respuesta: aiResult.conviene?.respuestaDirecta_clp || "",
      conviene_reencuadre: aiResult.conviene?.reencuadre_clp || "",
      conviene_caja: aiResult.conviene?.cajaAccionable_clp || "",
      costoMensual_contenido: aiResult.costoMensual?.contenido_clp || "",
      costoMensual_caja: aiResult.costoMensual?.cajaAccionable_clp || "",
      negociacion_contenido: aiResult.negociacion?.contenido_clp || "",
      negociacion_estrategia: aiResult.negociacion?.estrategiaSugerida_clp || "",
      largoPlazo_contenido: aiResult.largoPlazo?.contenido_clp || "",
      riesgos_contenido: aiResult.riesgos?.contenido_clp || "",
    };
    for (const [k, txt] of Object.entries(sectionMap)) {
      const montos = extractCLPAmounts(txt);
      const cerca = montos.filter(m => Math.abs(m - flujoMotor) / flujoMotor < matchTolerance);
      sectionsAporte[k] = { texto: txt, montos, cerca };
    }

    // ─── Plusvalía contexto ───
    const allText = Object.values(sectionMap).join(" \n ");
    const plusContext = detectPlusvaliaContexto(allText);

    // ─── TIR cross-section ───
    const tirMotor = r.exitScenario?.tir;
    const tirMatches: Record<string, string[]> = {};
    for (const [k, txt] of Object.entries(sectionMap)) {
      const ms = (txt.match(/\bTIR[^\d]{0,20}(\d+[.,]?\d*)\s*%/gi) || []).map(s => s.replace(/\s+/g, " "));
      if (ms.length > 0) tirMatches[k] = ms;
    }

    // Veredicto cross-section: francoVerdict vs explicacion en conviene
    const veredictoMotor = r.engineSignal;
    const francoVerdict = aiResult.francoVerdict;

    const dump = {
      caseDef: c,
      input: fullInput,
      motor: {
        engineSignal: r.engineSignal,
        francoVerdict: r.francoVerdict,
        score: r.score,
        flujoNetoMensual: r.metrics?.flujoNetoMensual,
        plusvaliaAnualizada: histo.anualizada,
        plusvalia10a: histo.plusvalia10a,
        TIR: tirMotor,
        aporteMensualPromedioFrontend,
      },
      ai_analysis: aiResult,
      diag,
      diagnostico: {
        flujoMotor,
        aporteMensualPromedioFrontend,
        // C1 — plusvalía
        plusvaliaContexto: plusContext,
        // C2 — coherencia aporte
        coherenciaAporte: {
          flujoMotorReferencia: flujoMotor,
          tolerancia: `${matchTolerance * 100}%`,
          secciones: Object.fromEntries(Object.entries(sectionsAporte).map(([k, v]) => [k, {
            tieneMonto: v.montos.length > 0,
            montos: v.montos,
            coincidenConFlujoMotor: v.cerca,
            cantidadCoincide: v.cerca.length,
          }])),
        },
        // C3 — otros cross-section
        TIR_motor: tirMotor,
        TIR_menciones: tirMatches,
        veredictoMotor,
        francoVerdict,
        veredictoCoherente: veredictoMotor === francoVerdict || (francoVerdict && ["RECONSIDERA LA ESTRUCTURA"].includes(francoVerdict)),
      },
    };
    fs.writeFileSync(path.resolve(outDir, `caso-${c.id}.json`), JSON.stringify(dump, null, 2));

    summary.push({
      id: c.id,
      label: c.label,
      comuna: fullInput.comuna,
      plusvaliaAnualizada: histo.anualizada,
      flujoMotor: r.metrics?.flujoNetoMensual,
      aporteFrontendPromedio: Math.round(aporteMensualPromedioFrontend),
      diff_motor_vs_frontend_pct: Math.round((Math.abs(aporteMensualPromedioFrontend) - flujoMotor) / Math.max(flujoMotor, 1) * 1000) / 10,
      plusContext,
      coherenciaAporte: dump.diagnostico.coherenciaAporte,
      tirMatches,
      veredictoCoherente: dump.diagnostico.veredictoCoherente,
    });

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(path.resolve(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSummary → ${path.resolve(outDir, "_summary.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
