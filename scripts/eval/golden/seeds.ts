// ============================================================================
// GOLDEN SET LTR — SEEDS INMUTABLES
// ============================================================================
// 7 casos canónicos (GS-*) + 3 borde deterministas (BE-*). Inputs CONGELADOS,
// derivados de filas reales del corpus (of-golden-dump), re-seedados como filas
// dedicadas GOLDEN:: con UF fija 38800. Estos inputs NO cambian: son la fuente
// de verdad del eval de regresión. Los ESPERADOS (class a) viven aparte en
// baseline.json (regenerable, aprobado por Fabrizio) — acá solo el input + la
// mediana congelada + los ejes de matriz que cada caso cubre.
//
// Reusa ltr() y AUDIT_UF de ../fixtures (misma convención de determinismo).
// Diseño aprobado: of-golden-design.md.
// ============================================================================

import type { AnalisisInput } from "../../../src/lib/types";
import { ltr, AUDIT_UF } from "../fixtures";

/** UF congelada de todo el golden set (== UF_FALLBACK). Drift eliminado por construcción. */
export const GOLDEN_UF = AUDIT_UF; // 38800

/**
 * Fecha de análisis CONGELADA del golden set (espejo de GOLDEN_UF). El recompute
 * la pasa como `asOf` para que meses-hasta-entrega de los seeds en verde (GS-2,
 * GS-7) sea determinístico, desacoplado de cuándo se seedeó la fila. Producción
 * usa created_at; el golden usa esta constante. Fijada al día real de seed-db
 * (2026-07-09, local) → reproduce el baseline vigente (GS-7 mesesEspera=22, GS-2=0)
 * con delta cero. Ver of-datedrift-design.md §3.3.
 */
export const GOLDEN_ASOF = new Date(2026, 6, 9); // 2026-07-09 local

export type MedianaSnapshot = { mediana: number | null; n: number };

export interface GoldenSeed {
  key: string; // "GS-1"
  /** UUID FIJO de la fila persistida. Upsert idempotente por este id. */
  uuid: string;
  label: string;
  /** Ejes de la matriz que este caso cubre (para el agregado del reporte). */
  ejes: string[];
  /** Input LTR congelado. */
  input: AnalisisInput & { lat?: number; lng?: number };
  /** Mediana comunal de venta UF/m² congelada. null = datos-zona no confiables (CATCH-ROOT-A). */
  mediana: MedianaSnapshot;
  nota: string;
}

// ── 7 casos canónicos ───────────────────────────────────────────────────────

export const GOLDEN_SEEDS: GoldenSeed[] = [
  {
    key: "GS-1",
    uuid: "90111111-0000-4000-a000-000000000001",
    label: "COMPRAR limpio · Ñuñoa usado · VM débil · sensibilidad frágil",
    ejes: ["veredicto:COMPRAR", "gate:banda", "VM:débil", "mediana:confiable", "estado:usado", "flujo:+", "sensibilidad:frágil", "patrimonio:≥2", "capex:sí"],
    input: ltr({
      comuna: "Ñuñoa", ciudad: "Santiago", nombre: "GOLDEN GS-1 Ñuñoa",
      precio: 2600, arriendo: 780000, superficie: 50, superficieTotal: 50,
      dormitorios: 2, banos: 1, antiguedad: 2, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 120000, vacanciaMeses: 1,
      lat: -33.4445, lng: -70.6005,
    }),
    mediana: { mediana: 58, n: 540 },
    nota: "Arriendo declarado alto ($780k vs zona ~$480k): el flujo se da vuelta si el arriendo real es el de mercado → sensibilidad frágil (<7%). Corona por cap_rate favorable.",
  },
  {
    key: "GS-2",
    uuid: "90111111-0000-4000-a000-000000000002",
    label: "COMPRAR · Las Condes NUEVO · VM sólido · entrega futura",
    ejes: ["veredicto:COMPRAR", "VM:sólido", "mediana:confiable", "estado:nuevo", "capex:no", "entrega:futura", "N:bajo"],
    input: ltr({
      comuna: "Las Condes", ciudad: "Santiago", nombre: "GOLDEN GS-2 Las Condes",
      precio: 2650, arriendo: 447000, superficie: 25, superficieTotal: 25,
      dormitorios: 1, banos: 1, antiguedad: 0, enConstruccion: true,
      estadoVenta: "futura", fechaEntrega: "2026-04",
      piePct: 20, tasaInteres: 3.5, plazoCredito: 30, gastos: 60000,
      contribuciones: 64676, provisionMantencion: 30260, vacanciaMeses: 0.6,
      valorMercadoFranco: 3038, valorMercadoUsuario: 3038,
      lat: -33.4145, lng: -70.5737,
    }),
    mediana: { mediana: 79.5, n: 357 },
    nota: "VM sólido: valorMercadoFranco 3038 UF vs precio 2650 → 12,8% bajo referencia. Nuevo → sin corretaje ni capex, N bajo. Entrega futura penaliza score.",
  },
  {
    key: "GS-3",
    uuid: "90111111-0000-4000-a000-000000000003",
    label: "AJUSTA multi-matiz · Recoleta · fh problemático · reestructuración",
    ejes: ["veredicto:AJUSTA", "gate:gate2", "VM:débil", "mediana:confiable", "flujo:-", "N:alto", "sensibilidad:borde", "patrimonio:borde", "reestructuracion:sí", "capex:sí", "plusvalia:débil"],
    input: ltr({
      comuna: "Recoleta", ciudad: "Santiago", nombre: "GOLDEN GS-3 Recoleta",
      precio: 2600, arriendo: 560000, superficie: 38, superficieTotal: 38,
      dormitorios: 1, banos: 1, antiguedad: 6, piePct: 20, tasaInteres: 6.2,
      plazoCredito: 25, gastos: 120000, vacanciaMeses: 1,
      lat: -33.4180, lng: -70.6360,
    }),
    mediana: { mediana: 40.3, n: 118 },
    nota: "Tasa 6,2% (210 bps sobre mercado) → estructura problemática, reestructuración sí. Sobreprecio +70%. Multi-matiz → pirámide alta.",
  },
  {
    key: "GS-4",
    uuid: "90111111-0000-4000-a000-000000000004",
    label: "BUSCAR OTRA · Macul · VM sólido · patrimonio <1 · sensibilidad omitida",
    ejes: ["veredicto:BUSCAR", "gate:gate1", "VM:sólido", "mediana:confiable", "flujo:-", "sensibilidad:omitida", "patrimonio:<1", "capex:sí"],
    input: ltr({
      comuna: "Macul", ciudad: "Santiago", nombre: "GOLDEN GS-4 Macul",
      precio: 4000, arriendo: 450000, superficie: 50, superficieTotal: 50,
      dormitorios: 2, banos: 1, antiguedad: 14, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 120000, vacanciaMeses: 1,
      valorMercadoFranco: 3300,
      lat: -33.4800, lng: -70.5980,
    }),
    mediana: { mediana: 45, n: 180 },
    nota: "VM sólido en veredicto negativo (vmFranco 3300 vs precio 4000): la negociación ancla al VM sin negarlo (D2). TIR -2,5% → gate1. Patrimonio <1 (terminas con menos). Sensibilidad omitida (BUSCAR base).",
  },
  {
    key: "GS-5",
    uuid: "90111111-0000-4000-a000-000000000005",
    label: "AJUSTA · Peñalolén · SIN mediana confiable → CATCH-ROOT-A",
    ejes: ["veredicto:AJUSTA", "VM:débil", "mediana:NO-confiable", "catch-root-a", "sobreprecio:omitido", "flujo:-", "N:N-1"],
    input: ltr({
      comuna: "Peñalolén", ciudad: "Santiago", nombre: "GOLDEN GS-5 Peñalolén",
      precio: 3000, arriendo: 520000, superficie: 55, superficieTotal: 55,
      dormitorios: 2, banos: 1, antiguedad: 8, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 120000, vacanciaMeses: 1,
      lat: -33.4880, lng: -70.5430,
    }),
    mediana: { mediana: null, n: 0 },
    nota: "Sin mediana comunal confiable → sobreprecio null (pirámide N-1), CATCH-ROOT-A activo: la prosa fresca NO debe fabricar cifra de zona ni decir '% sobre la zona'.",
  },
  {
    key: "GS-6",
    uuid: "90111111-0000-4000-a000-000000000006",
    label: "BUSCAR OTRA · Ñuñoa · pie 10% · gate1 · reestructuración",
    ejes: ["veredicto:BUSCAR", "gate:gate1", "VM:débil", "mediana:confiable", "flujo:-", "sensibilidad:omitida", "patrimonio:<1", "reestructuracion:sí", "pie:10%", "N:alto"],
    input: ltr({
      comuna: "Ñuñoa", ciudad: "Santiago", nombre: "GOLDEN GS-6 Ñuñoa",
      precio: 5500, arriendo: 620000, superficie: 50, superficieTotal: 50,
      dormitorios: 2, banos: 1, antiguedad: 12, piePct: 10, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 120000, vacanciaMeses: 1,
      lat: -33.4445, lng: -70.6005,
    }),
    mediana: { mediana: 58, n: 540 },
    nota: "Pie 10% (muy bajo el óptimo 25%) → estructura problemática driver=pie, reestructuración sí. Sobreprecio +90%. Seed de drift-UF (UF 38800 verificada). Sensibilidad omitida.",
  },
  {
    key: "GS-7",
    uuid: "90111111-0000-4000-a000-000000000007",
    label: "BUSCAR OTRA · Santiago NUEVO · plusvalía NEGATIVA · entrega 2028",
    ejes: ["veredicto:BUSCAR", "VM:sólido", "mediana:confiable", "estado:nuevo", "plusvalia:negativa", "entrega:futura", "sensibilidad:omitida"],
    input: ltr({
      comuna: "Santiago", ciudad: "Santiago", nombre: "GOLDEN GS-7 Santiago",
      precio: 3187, arriendo: 350000, superficie: 36, superficieTotal: 36,
      dormitorios: 1, banos: 1, antiguedad: 0, enConstruccion: true,
      estadoVenta: "futura", fechaEntrega: "2028-05",
      piePct: 10, tasaInteres: 4.11, plazoCredito: 25, gastos: 65000,
      contribuciones: 68946, provisionMantencion: 30914, vacanciaMeses: 0.48,
      valorMercadoFranco: 3041,
      lat: -33.4432, lng: -70.6387,
    }),
    mediana: { mediana: 55.7, n: 60 },
    nota: "Plusvalía histórica de Santiago negativa (~-1,1%): rama adverso-negativo del hallazgo plusvalía. Nuevo #2, entrega 2028. Mediana fijada a la documentada (55,7) para cubrir sobreprecio confiable + plusvalía negativa juntos.",
  },
];

// ── 3 casos-borde deterministas (solo motor, sin LLM) ───────────────────────
// No son análisis completos: inputs calibrados para clavar un umbral exacto que
// "esperados exactos" pierde por definición. Se validan SOLO en la capa recompute.

export interface BordeSeed {
  key: string;
  label: string;
  input: AnalisisInput & { lat?: number; lng?: number };
  mediana: MedianaSnapshot;
  /** Qué razor-edge clava este caso (documenta la intención). */
  filo: string;
}

export const BORDE_SEEDS: BordeSeed[] = [
  {
    key: "BE-caprate",
    label: "cap_rate — body faithful al valor del motor (sentinel San Miguel)",
    input: ltr({
      comuna: "San Miguel", ciudad: "Santiago", nombre: "GOLDEN BE-caprate",
      precio: 2600, arriendo: 860000, superficie: 45, superficieTotal: 45,
      dormitorios: 2, banos: 1, antiguedad: 3, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 100000, vacanciaMeses: 1,
    }),
    mediana: { mediana: 52, n: 90 },
    filo: "Invariante B1: la cifra de cap_rate en la fraseCanonica == valor.capRatePct del motor (misma clase que el bug KPI 9,4 vs body 9,5 del backlog; la paridad exacta con el KPI del render es tier pixel).",
  },
  {
    key: "BE-patrimonio",
    label: "patrimonio en borde [1,2) — dirección favorable sobre el corte 1,0",
    input: ltr({
      comuna: "Macul", ciudad: "Santiago", nombre: "GOLDEN BE-patrimonio",
      precio: 4300, arriendo: 430000, superficie: 50, superficieTotal: 50,
      dormitorios: 2, banos: 1, antiguedad: 4, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 110000, vacanciaMeses: 1,
    }),
    mediana: { mediana: 45, n: 180 },
    filo: "Invariante B2: multiplicador ~1,3 (borde) → dirección favorable (corte adverso 1,0). El corte de dirección se decide sobre el multiplicador redondeado (clase del caso 1,996).",
  },
  {
    key: "BE-sensibilidad",
    label: "sensibilidad FRÁGIL — dirección adversa bajo el corte 7%",
    input: ltr({
      comuna: "Recoleta", ciudad: "Santiago", nombre: "GOLDEN BE-sensibilidad",
      precio: 2700, arriendo: 600000, superficie: 40, superficieTotal: 40,
      dormitorios: 1, banos: 1, antiguedad: 5, piePct: 20, tasaInteres: 4.5,
      plazoCredito: 25, gastos: 110000, vacanciaMeses: 1,
    }),
    mediana: { mediana: 40.3, n: 118 },
    filo: "Invariante B2: marginPct ~3% (< corte 7) → dirección ADVERSA aun en un COMPRAR. Cubre la sub-dirección frágil de sensibilidad que ningún GS toca.",
  },
];
