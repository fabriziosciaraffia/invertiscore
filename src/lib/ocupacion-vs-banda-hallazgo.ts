// Hallazgo tipado de OCUPACION_VS_BANDA — motor determinístico STR. DECISIVO: 1:1 con la
// dim `factibilidad` del score (la ocupación maneja el revenue, su 30%). Compara
// escenarios.base.ocupacionReferencia contra la banda comunal (STR_UNIVERSO_OCC). Diseño
// congelado en of-e1a-piramide-str.md.
//
// REGLA (aprobación Fabrizio) — la superficie no puede tener más confianza que el dato.
// Cuando la ocupación es FALLBACK (no observada; el caso DOMINANTE: 40/46 del corpus), la
// procedencia lo declara SIN eufemismo ("sin datos observados de esta propiedad, supuesto
// conservador 45%"), confianza "baja", y el KPI muestra el 45% del fallback, no un p50 ajeno.

import type { HallazgoOcupacionVsBanda } from "./types";

// Banda de saturación de magnitudContinua, en puntos de ocupación.
export const OCC_BANDA_PTS = 15;
const EN_LINEA_PTS = 1; // |gap| ≤ 1pt ⇒ "en línea"; señal-máquina binaria en 0

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct0 = (n: number) => Math.round(n).toString();

/**
 * Construye el proto-hallazgo de OCUPACION_VS_BANDA. `decisividad` la inyecta el assembler
 * (dim factibilidad). Rama fallback = default esperado. Devuelve null si la ocupación no es
 * computable. Voz: tuteo neutro chileno. §4: nunca "ramp-up" → "primeros meses de operación".
 */
export function buildHallazgoOcupacionVsBanda(p: {
  /** Ocupación del escenario base, en % (base.ocupacionReferencia × 100). */
  ocupacionPct: number;
  /** Ocupación estabilizada de la comuna, en % (STR_UNIVERSO_OCC[comuna] × 100). */
  bandaComunalPct: number;
  /** true si la ocupación es fallback de mercado (no observada) — el caso dominante. */
  esFallback: boolean;
  /** Nombre de la comuna para el ksub; "" si no disponible. */
  comuna: string;
  /** Decisividad de la dim factibilidad (0..1), inyectada por el assembler STR. */
  decisividad: number;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoOcupacionVsBanda | null {
  if (!Number.isFinite(p.ocupacionPct)) return null;

  // Redondeo de display (enteros) ANTES de decidir dirección: occ y banda que muestra el
  // ksub son los que deciden favorable/adverso (coherencia KPI-dirección).
  const occ = Math.round(p.ocupacionPct);
  const banda = Math.round(Number.isFinite(p.bandaComunalPct) ? p.bandaComunalPct : p.ocupacionPct);
  const gap = occ - banda;
  const gapAbs = Math.abs(gap);
  const direccion: "favorable" | "adverso" = occ >= banda ? "favorable" : "adverso";
  const magnitudContinua = clamp01(gapAbs / OCC_BANDA_PTS);
  const nochesMes = Math.round((occ / 100) * 30);

  let titular: string;
  let fraseCanonica: string;
  if (p.esFallback) {
    // Rama dominante — sin eufemismo. El supuesto conservador es el 45%.
    titular = direccion === "favorable" ? "Con el supuesto base ya llenas la zona." : "Necesitas llenar más que la zona típica.";
    fraseCanonica =
      `No hay datos de ocupación observados de esta propiedad, así que la operación asume un ` +
      `${pct0(occ)}% conservador. Con ese supuesto necesitas llenar ${nochesMes} noches al mes; ` +
      `el número real recién lo vas a conocer tras los primeros meses de operación.`;
  } else if (gapAbs <= EN_LINEA_PTS) {
    titular = "Tu ocupación está en línea con la zona.";
    fraseCanonica =
      `Tu ocupación observada es ${pct0(occ)}%, en línea con la banda típica de la comuna (${pct0(banda)}%). ` +
      `El listing llena parecido al promedio de la zona.`;
  } else if (direccion === "favorable") {
    titular = "Llenas más que la zona típica.";
    fraseCanonica =
      `Tu ocupación observada es ${pct0(occ)}%, sobre la banda típica de la comuna (${pct0(banda)}%). ` +
      `El listing llena más que el promedio de la zona — buena señal para sostener el revenue.`;
  } else {
    titular = "Necesitas llenar más que la zona típica.";
    fraseCanonica =
      `Tu ocupación observada es ${pct0(occ)}%, bajo la banda típica de la comuna (${pct0(banda)}%). ` +
      `Necesitas llenar más noches que el promedio de la zona para sostener los números.`;
  }

  return {
    id: "ocupacion_vs_banda",
    tipo: "ocupacion_vs_banda",
    valor: {
      ocupacionPct: Math.round(occ),
      bandaComunalPct: Math.round(banda),
      gapPts: Math.round(gap),
      esFallback: p.esFallback,
      comuna: p.comuna,
      banda: OCC_BANDA_PTS,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base: p.esFallback
        ? "sin datos observados de ocupación de esta propiedad; supuesto conservador 45% (fallback de mercado). Se confirma recién operando"
        : "ocupación observada del listing (AirROI), p50 de la comuna",
      confianza: p.esFallback ? "baja" : "media",
    },
    titular,
    fraseCanonica,
  };
}
