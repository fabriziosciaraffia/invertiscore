// ============================================================================
// GOLDEN SET STR (E.1b) — SEEDS
// ============================================================================
// 6 casos canónicos (GE-*) + 3 borde (BE-*-str). Los GE-* congelan filas reales del
// corpus (input mínimo + airbnbRaw + uf) en str-seeds-frozen.json — STR depende de AirROI,
// así que el determinismo se logra congelando el airbnbRaw (no re-pegándole a la API).
// El recompute reconstruye airbnbData con la réplica DirectData de buildAirbnbData y corre
// calcShortTerm → calcFrancoScoreSTR → buildStrHallazgos. Dos GE se SINTETIZAN sobre su fila
// base (GE-3 regulación=no; GE-5 fallback-occ por occ-strip). Los BE-*-str son razor-edges
// a nivel de builder (frontera exacta del corte). Diseño: of-e1a-piramide-str.md §Fase 5.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";

export type Sintesis = "reg_no" | "occ_strip" | "pie_cero_banda" | "precio_justo" | null;

export interface StrGeSeed {
  key: string;         // "GE-1"
  label: string;
  ejes: string[];      // ejes de la matriz E1..E11 que cubre
  sintesis: Sintesis;  // transformación sobre la fila base (null = tal cual)
  nota: string;
}

// Metadata de los 6 GE (los datos frozen viven en str-seeds-frozen.json, key == GE-*).
export const STR_GE_SEEDS: StrGeSeed[] = [
  { key: "GE-1", label: "COMPRAR · ventaja clara", sintesis: null,
    ejes: ["E1:COMPRAR", "E3:fav", "E4:observada", "E5:exit", "N:12"],
    nota: "COMPRAR con sobre-renta legible; los 4 decisivos + integradores presentes." },
  { key: "GE-2", label: "AJUSTA · flujo<0 sin horizonte · cost-stack alto", sintesis: null,
    ejes: ["E1:AJUSTA", "E2:G2-flujo", "flujo:-", "E9:cost-stack>40"],
    nota: "flujo negativo + cost-stack >40% (estructura_costos_str adverso)." },
  { key: "GE-3", label: "BUSCAR · regulación=no (gate)", sintesis: "reg_no",
    ejes: ["E1:BUSCAR", "E2:G1-regulacion", "E7:no", "sensibilidad:presente"],
    nota: "edificioPermiteAirbnb='no' fuerza BUSCAR OTRA (gate G1). Sintetizado sobre fila base." },
  { key: "GE-4", label: "LTR-negativo · KPI en CLP", sintesis: null,
    ejes: ["E3:LTR-negativo", "ventaja:KPI-CLP", "cero-%"],
    nota: "ltr_noiMensual ≤ 0: ventaja_vs_ltr usa CLP absoluto, sin % (rama LTR-negativo)." },
  { key: "GE-5", label: "Ocupación fallback (occ-strip)", sintesis: "occ_strip",
    ejes: ["E4:fallback", "ocupacion:confianza-baja", "supuesto-45%"],
    nota: "airbnbRaw sin ocupación → resolveOccObservada cae a fallback 0,45; ocupacion_vs_banda confianza baja, procedencia sin eufemismo. Sintetizado (occ-strip)." },
  { key: "GE-6", label: "ADR legacy uplifted · forward-only", sintesis: null,
    ejes: ["E10:factor≠1", "forward-only", "capRate-normalizado"],
    nota: "Fila que persistió con factorADR≠1 (revenue inflado); el recompute normaliza a 1,0 → capRate menor. Verifica forward-only." },
  { key: "GE-PC", label: "AJUSTA · pie 0 · el horizonte no se puede medir (rama B)", sintesis: "pie_cero_banda",
    ejes: ["E1:AJUSTA", "E2:G2-horizonte", "pie:0", "flujo:-", "BE≤110"],
    nota: "El caso que FIJA la decisión de la rama B (opción 1). Sintetizado sobre GE-1 para " +
      "caer en la única banda donde el brazo del horizonte decide: score ≥70, flujo NEGATIVO y " +
      "break-even ≤110% (o sea, ningún otro gate ataja antes). Con pie 0 la TIR y el multiplicador " +
      "son 'no_aplica' ⇒ el horizonte no cierra ⇒ GATE 2 degrada COMPRAR → AJUSTA SUPUESTOS. " +
      "Replica el perfil del único caso real del corpus (Las Condes, medido en el recompute de " +
      "banda) sin congelar su fila. Invariante BS-PC: con pie 0 ningún COMPRAR puede descansar en " +
      "TIR ni multiplicador. Su control es el MISMO perfil con pie 20%: COMPRAR con flujo positivo." },
  { key: "GE-PJ", label: "AJUSTA · precio-justo STR (mediana alineada + cero overrides)", sintesis: "precio_justo",
    ejes: ["E1:AJUSTA", "precioJusto:sí", "mediana:alineada", "overrides:cero"],
    nota: "§1.12.4 STR: sintetizado sobre GE-2 (AJUSTA) anulando adrOverride/occOverride (tarifa y " +
      "ocupación ancladas a la mediana observada) y con la mediana comunal ALINEADA al precio/m² " +
      "del sujeto (desv 0, confiable) → esCasoPrecioJustoStr = true. Fija la detección y — si el " +
      "caso cae estructural — la variante del cierre 'esta zona no sostiene renta corta a los " +
      "precios de compra actuales'. Calibrado 15-ago-2026 (AJUSTA score ~64, recuperable)." },
];

// ── 3 razor-edges a nivel de builder (frontera exacta del corte) ─────────────
export interface StrBeSeed {
  key: string;
  label: string;
  filo: string;
}
export const STR_BE_SEEDS: StrBeSeed[] = [
  { key: "BE-caprate-str", label: "rentabilidad_str en el umbral 5,0%",
    filo: "capRatePct=5,0 ⇒ favorable (≥ umbral); 4,9 ⇒ adverso. Frontera del corte CAP_STR_UMBRAL_PCT." },
  { key: "BE-sensibilidad-str", label: "sensibilidad_str en el corte frágil 110%",
    filo: "beRatio=1,10 ⇒ favorable (≤ corteFragil); 1,11 ⇒ adverso. Frontera BE_STR_CORTE_FRAGIL." },
  { key: "BE-costos-str", label: "estructura_costos_str en la banda alta 40%",
    filo: "cost-stack=40% ⇒ favorable (≤ bandaAdv); 41% ⇒ adverso. Frontera COSTOS_STR_BANDA_ADV_PCT." },
];

// ── Carga de los fixtures frozen ─────────────────────────────────────────────
export interface FrozenFixture {
  srcId: string;
  comuna: string;
  uf: number;
  input_data: Record<string, any>;
  airbnbRaw: Record<string, any>;
}

export function loadFrozen(): Record<string, FrozenFixture> {
  const p = path.resolve(process.cwd(), "scripts/eval/golden/str-seeds-frozen.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
