// Hallazgo tipado de SOBREPRECIO vs comuna (precio/m² del sujeto vs mediana
// comunal de venta) — builder puro y determinístico. Espejo de
// `cap-rate-hallazgo.ts`, con DOS diferencias deliberadas:
//
//  1. ASIMETRÍA DE UBICACIÓN. Los otros 3 hallazgos (capex, cap_rate,
//     flujo_mensual) los siembra el MOTOR en results.hallazgos. Sobreprecio NO:
//     su desviación depende de la mediana comunal, resuelta ASYNC
//     (getComunaMedianaVentaUF). El motor en runtime no la tiene — el recompute
//     sync del render (recompute-results-for-legacy → runAnalysis sin mediana) la
//     deja en null, así que un hallazgo motor-seeded saldría null en TODO render.
//     Por eso este builder lo llama AI-GENERATION (donde la mediana ya está
//     resuelta) y el resultado se persiste en ai_analysis.hallazgoSobreprecio.
//     Ver ai-generation.ts (persistencia) y types.ts (por qué queda fuera de la
//     union `Hallazgo`).
//
//  2. DIRECCIÓN INVERTIDA. En cap_rate/flujo_mensual, más alto = favorable. Acá
//     es al revés: en o BAJO la mediana = favorable (entras barato); SOBRE la
//     mediana = adverso (pagas caro). Más caro = peor.
//
// Reusa metrics.precioVsComuna (FASE A, buildPrecioVsComuna) — NO recalcula la
// desviación. La fraseCanonica es la línea determinística (sin LLM); la IA la
// narra aguas abajo. Voz: tuteo neutro chileno, SIN voseo.

import type { HallazgoSobreprecio, PrecioVsComuna } from "./types";
import type { CondicionMercado } from "./comuna-stats";

/**
 * Banda (en %) que satura la decisividad: |desviacionPct| ≥ banda ⇒ 1.0.
 * Calibrada con la distribución real de desviaciones (237 análisis, jun-2026:
 * |desv| p50≈22, p75≈43, p90≈57). Candidata a localizar per-comuna, igual que
 * CAP_RATE_BANDA_DEFAULT (la dispersión normal de precio/m² varía por comuna).
 */
export const SOBREPRECIO_BANDA_DEFAULT = 30;

/**
 * Umbral (en %) bajo el cual la FRASE dice "en línea" con la mediana. La
 * señal-máquina `direccion` sigue siendo binaria (favorable si desv ≤ 0).
 */
const EN_LINEA_UMBRAL_PCT = 2;

const fmtUF = (n: number) =>
  `UF ${(Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

/**
 * Sujeto de la comparación, con el UNIVERSO declarado. Antes decía siempre "la
 * mediana de la comuna" — y esa etiqueta era el defecto: la mediana salía del
 * mercado de USADOS y se le presentaba a deptos nuevos como si fuera "la comuna"
 * entera. Ahora la frase nombra de qué está hecha la muestra.
 *
 * Sin universo (snapshots anteriores al fix, cuya mediana es mixta) cae a la
 * redacción previa, byte-idéntica: no se le pone etiqueta a un número que no la
 * tiene. Sin N (>0) tampoco se rotula — una frase que dijera "0 publicaciones"
 * sería peor que la genérica.
 */
function refMediana(universo: CondicionMercado | undefined, n: number): string {
  if (!universo || !Number.isFinite(n) || n <= 0) return "la mediana de la comuna";
  const tipo = universo === "nuevo" ? "nuevos" : "usados";
  return `la mediana de ${n.toLocaleString("es-CL")} publicaciones de departamentos ${tipo} de la comuna`;
}

/**
 * Construye el proto-hallazgo de sobreprecio reusando metrics.precioVsComuna.
 * Cae elegante a null cuando la mediana comunal no es confiable (sin dato de
 * zona): sin mediana no hay desviación y no hay hallazgo.
 */
export function buildHallazgoSobreprecio(
  pvc: PrecioVsComuna,
  // Decisividad calibrada (0..1) inyectada por calcDecisividades — escala común
  // "Δdecisión" (E2). El builder ya NO la calcula con |desviacionPct|/banda.
  decisividad: number,
  // Magnitud continua pre-floor — desempate secundario del sort (E4).
  magnitudContinua: number,
  // Nombre de la comuna de la mediana — nombra el nivel geográfico en el ksub (R2).
  // "" cuando el caller no lo tiene: el render cae al genérico "de la comuna".
  comuna: string = "",
  banda: number = SOBREPRECIO_BANDA_DEFAULT,
): HallazgoSobreprecio | null {
  if (
    !pvc.confiable ||
    pvc.desviacionPct == null ||
    pvc.medianaComunaUfM2 == null ||
    pvc.sobreprecioUfM2 == null
  ) {
    return null;
  }

  const desv = pvc.desviacionPct; // entero, ya redondeado en FASE A (buildPrecioVsComuna)
  const desvAbs = Math.abs(desv);

  // Redondeo a 1 decimal UNA vez (precisión de display): body (fmtUF), y valor.sujetoUfM2/
  // valor.medianaComunaUfM2 leen de acá; el ksub de la card (pct1) reformatea esos mismos
  // valores → mismo string. Sin esto, body (fmtUF sobre el crudo) y ksub (toFixed sobre el
  // crudo por otra vía) divergían en el borde .x5 (UF 81,0 vs 81,1 en la misma card —
  // mismo linaje que el bug cap_rate). Patrón round-una-vez de cap-rate-hallazgo.ts:116.
  // desviacionPct NO se recalcula: sigue siendo la fuente única de FASE A.
  const sujetoUfM2 = Math.round(pvc.sujetoUfM2 * 10) / 10;
  const medianaComunaUfM2 = Math.round(pvc.medianaComunaUfM2 * 10) / 10;

  // DIRECCIÓN INVERTIDA (≠ cap_rate / flujo_mensual):
  //   |desv| ≤ 2 → neutral  (pagas lo justo — familia 6 del censo: la etiqueta ya no
  //                          desdice a la frase "a precio de comuna")
  //   desv < 0  → favorable (bajo la mediana = entras barato)
  //   desv > 0  → adverso   (sobre la mediana = pagas caro)
  const direccion: "favorable" | "adverso" | "neutral" =
    desvAbs <= EN_LINEA_UMBRAL_PCT ? "neutral" : desv <= 0 ? "favorable" : "adverso";

  const sujetoFmt = fmtUF(sujetoUfM2);
  const medianaFmt = fmtUF(medianaComunaUfM2);
  const ref = refMediana(pvc.universo, pvc.n);

  let fraseCanonica: string;
  let titular: string;
  if (direccion === "neutral") {
    titular = "Pagas el metro a precio de comuna, sin sobreprecio.";
    fraseCanonica =
      `Tu precio por m² (${sujetoFmt}) está en línea con ${ref} (${medianaFmt}). ` +
      `Pagas lo que vale el metro en esta comuna.`;
  } else if (direccion === "favorable") {
    titular = "Entras barato: el metro está bajo la mediana comunal.";
    fraseCanonica =
      `Tu precio por m² (${sujetoFmt}) está ${desvAbs}% bajo ${ref} (${medianaFmt}). ` +
      `Entras barato para esta comuna.`;
  } else {
    titular = "Estás pagando caro el metro para esta comuna.";
    fraseCanonica =
      `Tu precio por m² (${sujetoFmt}) está ${desvAbs}% sobre ${ref} (${medianaFmt}). ` +
      `Estás pagando caro el metro para esta comuna.`;
  }

  return {
    id: "sobreprecio",
    tipo: "precio_vs_comuna",
    valor: {
      // Ya redondeados a 1 decimal — mismo valor que el body; el ksub de la card los
      // reformatea (pct1) sin re-redondear por otra vía (round-una-vez).
      sujetoUfM2,
      medianaComunaUfM2,
      desviacionPct: desv,
      sobreprecioUfM2: pvc.sobreprecioUfM2,
      banda,
      n: pvc.n,
      comuna: comuna.trim(),
      ...(pvc.universo ? { universo: pvc.universo } : {}),
    },
    direccion,
    decisividad,
    magnitudContinua,
    procedencia: {
      base: pvc.universo
        ? `mediana de precios de PUBLICACIÓN de venta de departamentos ${pvc.universo === "nuevo" ? "NUEVOS" : "USADOS"} de la comuna (scraped), no transacción`
        : "mediana de precios de PUBLICACIÓN de venta de la comuna (scraped), no transacción",
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
