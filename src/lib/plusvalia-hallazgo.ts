// Hallazgo tipado de PLUSVALÍA (apreciación histórica de la comuna) para LTR —
// motor determinístico. Espejo de `cap-rate-hallazgo.ts`: el motor envuelve la
// tasa histórica anualizada per-comuna que YA usa el scoring (analysis.ts:823-824)
// en un hallazgo tipado; NO recalcula ni deriva otra tasa (no toca
// precio2014/precio2024). La IA lo narra aguas abajo (skill analysis-voice-franco).
//
// DOCTRINA: la plusvalía es el CONTRAPESO de la tesis — rara vez tumba o salva
// sola, aporta al patrimonio. Y es HISTÓRICA (2014-2024), NO garantía futura: la
// procedencia y la frase lo dicen explícito y van en pasado. Por eso la confianza
// NUNCA es "alta" — proyectar futuro desde pasado es incierto aunque la data sea
// buena (Franco es pro-honestidad: no vender plusvalía histórica como futura).

import type { HallazgoPlusvalia } from "./types";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "./plusvalia-historica";

// ─── Referencia (umbral absoluto de apreciación real) ─────────────────────
//
// A diferencia de una comparativa-vs-pares, el ancla es un UMBRAL ABSOLUTO fijo:
// 3,0% anual ≈ apreciación real de largo plazo SOBRE inflación en Chile. Lectura
// honesta para el inversor: ≥3% = la comuna ganó valor REAL (sobre inflación);
// <3% = perdió valor real aunque el precio nominal suba. El ancla es ESTABLE —
// no se mueve si cambia el set de comunas (mismo criterio que el ancla nacional
// de cap rate). getPlusvaliaRef es el ÚNICO punto de resolución; mañana podría
// localizarse per-comuna sin tocar el builder.
export const PLUSVALIA_REF_REAL = 3.0;

// Banda (en puntos porcentuales) que satura la decisividad: |gap| ≥ banda ⇒ 1.0.
// Con la distribución observada (IQR ~2,5–3,7) una banda de 2,0 deja el centro con
// decisividad baja (coherente con "la plusvalía rara vez tumba/salva sola") y solo
// las colas marcan decisivo (Santiago -1,1 → ~1.0; Quilicura 5,3 → ~1.0).
export const PLUSVALIA_BANDA_DEFAULT = 2.0;

// Margen (en pts) bajo el cual la frase dice "en línea" pese a la dirección
// binaria (espejo del 0,2 de cap_rate).
const EN_LINEA_PTS = 0.2;

export interface PlusvaliaRef {
  /** Umbral de apreciación real anual, en %. */
  pct: number;
  /** Banda de saturación de la decisividad, en puntos porcentuales. */
  banda: number;
  /** Procedencia legible del umbral (para auditoría de la brecha). */
  fuente: string;
  /** Alcance del umbral usado. */
  scope: "absoluta" | "comuna";
}

/**
 * ÚNICO punto de resolución del umbral de plusvalía. Síncrono y puro.
 * Hoy: umbral absoluto de apreciación real (3,0%). Sin localización per-comuna.
 */
export function getPlusvaliaRef(): PlusvaliaRef {
  return {
    pct: PLUSVALIA_REF_REAL,
    banda: PLUSVALIA_BANDA_DEFAULT,
    fuente: "umbral de apreciación real de largo plazo sobre inflación en Chile (~3% anual)",
    scope: "absoluta",
  };
}

/**
 * Resuelve la tasa histórica anualizada de la comuna reusando PLUSVALIA_HISTORICA
 * (mismo dato y misma normalización `.trim()` que el scoring, analysis.ts:822-824).
 * NO deriva otra tasa. Devuelve `tieneData` para graduar la confianza: dato propio
 * ⇒ "media"; caída al promedio Gran Santiago (sin dato propio) ⇒ "baja".
 */
export function resolvePlusvaliaComuna(comuna: string): { anualizada: number; tieneData: boolean } {
  const historica = PLUSVALIA_HISTORICA[comuna.trim()] || null;
  return historica
    ? { anualizada: historica.anualizada, tieneData: true }
    : { anualizada: PLUSVALIA_DEFAULT.anualizada, tieneData: false };
}

// ─── Builder del hallazgo ─────────────────────────────────────────────────

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Construye el proto-hallazgo de plusvalía reusando la tasa histórica del scoring.
 * Recibe la referencia ya resuelta como PARÁMETRO (getPlusvaliaRef); nunca la busca
 * por su cuenta. Devuelve null si los números no son finitos.
 *
 * La plusvalía es HISTÓRICA, no futura: la frase va en PASADO y dice explícito que
 * no es garantía. La confianza nunca es "alta". La IA reescribe la frase aguas
 * abajo. Voz: tuteo neutro chileno, sin prometer apreciación futura.
 */
export function buildHallazgoPlusvalia(p: {
  /** Tasa histórica anualizada de la comuna, en %. Reusada de PLUSVALIA_HISTORICA. */
  anualizadaPct: number;
  /** True si la comuna tiene dato propio (⇒ confianza media); false ⇒ default (baja). */
  tieneData: boolean;
  /** Referencia ya resuelta (getPlusvaliaRef). */
  ref: PlusvaliaRef;
  comuna: string;
  modalidad: "ltr" | "str" | "ambas";
  /** Decisividad calibrada (0..1) inyectada por calcDecisividades — escala común
   *  "Δdecisión" (E2). El builder ya NO la calcula con |gap|/banda. */
  decisividad: number;
  /** Magnitud continua pre-floor — desempate secundario del sort (E4). */
  magnitudContinua: number;
}): HallazgoPlusvalia | null {
  if (!Number.isFinite(p.anualizadaPct) || !Number.isFinite(p.ref.pct)) return null;

  const gap = p.anualizadaPct - p.ref.pct; // signed
  const gapRounded = Math.round(gap * 10) / 10;
  // favorable si apreció ≥ umbral real (ganó valor real); adverso si < (perdió
  // valor real aunque el nominal suba). La frase puede decir "en línea" cuando el
  // gap es mínimo, pero la señal-máquina es binaria.
  const direccion: "favorable" | "adverso" =
    p.anualizadaPct >= p.ref.pct ? "favorable" : "adverso";

  const apFmt = fmt1(p.anualizadaPct);
  const refFmt = fmt1(p.ref.pct);
  const gapAbs = Math.abs(gapRounded);
  const sujeto = `los departamentos en ${p.comuna.trim()}`;

  // Frase determinística, en PASADO (histórica), con el disclaimer no-garantía.
  // 4 ramas: en línea / favorable / adverso-negativo / adverso-bajo-umbral. El
  // adverso se PARTE en dos porque la plusvalía puede ser negativa: decir
  // "cayeron" de una comuna que apreció 2,4% sería falso (a diferencia de
  // cap_rate, cuyo valor nunca es negativo y por eso le bastan 3 ramas).
  let fraseCanonica: string;
  let titular: string;
  if (gapAbs <= EN_LINEA_PTS) {
    titular = "La zona subió parejo con la inflación, histórico normal.";
    fraseCanonica =
      `En la última década ${sujeto} se valorizaron ${apFmt}% anual, en línea con el umbral de apreciación real (${refFmt}%). ` +
      `Plusvalía histórica normal: referencia, no garantía futura.`;
  } else if (direccion === "favorable") {
    titular = "La zona ganó valor real sobre la inflación, históricamente.";
    fraseCanonica =
      `En la última década ${sujeto} se valorizaron ${apFmt}% anual, sobre el umbral de apreciación real (${refFmt}%). ` +
      `Ganaron valor por sobre la inflación; es respaldo histórico, no garantía de que se repita.`;
  } else if (p.anualizadaPct < 0) {
    titular = "La zona perdió valor real en la última década.";
    fraseCanonica =
      `En la última década ${sujeto} cayeron ${fmt1(Math.abs(p.anualizadaPct))}% anual de valor, bajo el umbral de apreciación real (${refFmt}%). ` +
      `La historia no respalda una apuesta a plusvalía acá.`;
  } else {
    titular = "La zona no le ganó a la inflación en la década.";
    fraseCanonica =
      `En la última década ${sujeto} se valorizaron ${apFmt}% anual, bajo el umbral de apreciación real (${refFmt}%). ` +
      `No le ganaron a la inflación de largo plazo; la plusvalía histórica acá es débil, no garantía futura.`;
  }

  const base = p.tieneData
    ? "apreciación histórica de la comuna 2014-2024 (Arenas & Cayo, Tinsa, Propital), no garantía de apreciación futura"
    : "promedio histórico del Gran Santiago, sin datos propios de la comuna — no garantía futura";

  return {
    id: "plusvalia",
    tipo: "apreciacion_historica",
    valor: {
      anualizadaPct: Math.round(p.anualizadaPct * 100) / 100,
      refPct: p.ref.pct,
      gapPts: gapRounded,
      banda: p.ref.banda,
      fuente: p.ref.fuente,
      scope: p.ref.scope,
      tieneData: p.tieneData,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua: p.magnitudContinua,
    procedencia: {
      base,
      confianza: p.tieneData ? "media" : "baja",
    },
    titular,
    fraseCanonica,
  };
}
