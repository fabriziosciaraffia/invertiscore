// Hallazgo tipado de FLUJO_STR (flujo de caja mensual estabilizado) — motor determinístico
// STR. DECISIVO: 1:1 con la dim `sostenibilidad` del score (flujo es su 40%). Molde de
// flujo-mensual-hallazgo.ts (LTR) con texto STR. Envuelve escenarios.base.flujoCajaMensual
// (short-term-engine.ts:135, = noiMensual − dividendoMensual, ocupación OBSERVADA del base)
// SIN recalcular. Diseño congelado en of-e1a-piramide-str.md.
//
// DOCTRINA (igual que LTR): un flujo negativo NO es malo por sí solo; se juzga por magnitud.
// El signo da la dirección; la magnitud (|flujo|/banda) ordena. Sin referencia externa →
// confianza "alta" (100% de inputs del usuario vía motor).

import type { HallazgoFlujoStr } from "./types";

// Banda de magnitud = $250.000: el umbral del Gate-1 STR (short-term-score.ts:372,
// flujoCajaMensual < −250k fuerza BUSCAR sin ventaja). Separa el aporte "acotado" del "fuerte".
export const FLUJO_STR_BANDA_CLP = 250_000;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmtSigned = (n: number) => (n < 0 ? "−" : "+") + "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
const fmtAbs = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
const pct0 = (n: number) => Math.round(n).toString();

/**
 * Construye el proto-hallazgo de FLUJO_STR. `decisividad` la inyecta el assembler (dim
 * sostenibilidad). Devuelve null si el flujo no es finito. Voz: tuteo neutro chileno.
 */
export function buildHallazgoFlujoStr(p: {
  /** Flujo de caja mensual estabilizado, CLP signed (base.flujoCajaMensual). */
  flujoMensualCLP: number;
  /** Decisividad de la dim sostenibilidad (0..1), inyectada por el assembler STR. */
  decisividad: number;
  modalidad: "ltr" | "str" | "ambas";
  /** fix-occfuente-override — true si el flujo se calculó con una ocupación definida por el usuario. */
  occEsOverride?: boolean;
  /** fix-occfuente-override — ocupación definida por el usuario, % (para declarar procedencia). */
  occDefinidaPct?: number;
  /** fix-occfuente-override — ocupación observada real de la zona, % (para mostrar ambos). */
  occObservadaPct?: number;
}): HallazgoFlujoStr | null {
  if (!Number.isFinite(p.flujoMensualCLP)) return null;

  // Redondeo a CLP entero (el que muestra el KPI) ANTES del signo: dirección y KPI coinciden.
  const flujo = Math.round(p.flujoMensualCLP);
  const direccion: "favorable" | "adverso" = flujo >= 0 ? "favorable" : "adverso";
  const magnitudContinua = clamp01(Math.abs(flujo) / FLUJO_STR_BANDA_CLP);
  const fuerte = Math.abs(flujo) >= FLUJO_STR_BANDA_CLP;

  // fix-occfuente-override 2026-07 — el ancla declara la procedencia de la ocupación que
  // produjo este flujo: con override no se disfraza de "mediana de la zona".
  const occOverride = p.occEsOverride === true
    && Number.isFinite(p.occDefinidaPct as number)
    && Number.isFinite(p.occObservadaPct as number);
  const anclaOcc = occOverride
    ? `Con la ocupación que definiste (${pct0(p.occDefinidaPct as number)}%), no la observada de la zona (${pct0(p.occObservadaPct as number)}%),`
    : "Con la ocupación mediana de la zona,";

  let titular: string;
  let fraseCanonica: string;
  if (direccion === "favorable") {
    titular = "La operación se paga sola mes a mes.";
    fraseCanonica =
      `${anclaOcc} el corto te deja ${fmtAbs(flujo)} al mes en el bolsillo ` +
      `después de la cuota y los costos. La operación se paga sola desde el primer mes estabilizado.`;
  } else if (!fuerte) {
    titular = "Pones algo de tu bolsillo cada mes.";
    fraseCanonica =
      `${anclaOcc} el corto deja ${fmtSigned(flujo)} al mes después de la ` +
      `cuota y los costos. No es una sangría, pero necesitas un colchón: la operación todavía no se sostiene sola.`;
  } else {
    titular = "Pones plata de tu bolsillo todos los meses.";
    fraseCanonica =
      `${anclaOcc} el corto deja ${fmtSigned(flujo)} al mes después de la cuota ` +
      `y los costos — un aporte fuerte. Antes de avanzar, confirma que puedes sostenerlo mes a mes: es plata que sale de tu bolsillo, no de la operación.`;
  }

  return {
    id: "flujo_str",
    tipo: "flujo_estabilizado",
    valor: {
      flujoMensualCLP: Math.round(flujo),
      banda: FLUJO_STR_BANDA_CLP,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: p.decisividad,
    magnitudContinua,
    procedencia: {
      base: occOverride
        ? "flujo del escenario base con la ocupación que definiste (no la observada de la zona), tras dividendo, comisión y todos los costos operativos"
        : "flujo del escenario base (ocupación observada de la zona), tras dividendo, comisión y todos los costos operativos",
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
