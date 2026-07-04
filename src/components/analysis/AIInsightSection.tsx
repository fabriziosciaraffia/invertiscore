"use client";

import type { AIAnalysisV2, DatoClave, FullAnalysisResult } from "@/lib/types";
import { parseUFString } from "./utils";

/**
 * Helpers compartidos del análisis IA v2 (Patrón 4 — AI Insight). Move
 * verbatim desde results-client.tsx LTR (Ronda 4a.3). Consumidos por
 * HeroVerdictBlock, HeroTopStrip y SubjectCardGrid.
 *
 * Skill franco-design-system §2.5 Canal A: la cursiva (italic) es
 * obligatoria en cuerpos de bloque IA. La aplican los componentes
 * consumidores via clase `italic` en sus contenedores.
 */

/** Estilos visuales por veredicto (3 variantes canónicas per skill Patrón 1).
 *  Commit E.3 · 2026-05-13 — entrada "RECONSIDERA LA ESTRUCTURA" eliminada;
 *  análisis legacy con ese veredicto se coercen a "AJUSTA SUPUESTOS" en
 *  read-path (normalizeLegacyVerdict en types.ts). */
export const VERDICT_STYLES: Record<
  string,
  { color: string; bg: string; border: string; bgInner: string; borderInner: string }
> = {
  COMPRAR: {
    color: "var(--franco-positive)",
    bg: "color-mix(in srgb, var(--franco-positive) 8%, transparent)",
    border: "color-mix(in srgb, var(--franco-positive) 30%, transparent)",
    bgInner: "color-mix(in srgb, var(--franco-positive) 18%, transparent)",
    borderInner: "color-mix(in srgb, var(--franco-positive) 40%, transparent)",
  },
  "BUSCAR OTRA": {
    color: "var(--signal-red)",
    bg: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
    border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
    bgInner: "color-mix(in srgb, var(--signal-red) 12%, transparent)",
    borderInner: "color-mix(in srgb, var(--signal-red) 30%, transparent)",
  },
  "AJUSTA SUPUESTOS": {
    color: "var(--signal-red)",
    bg: "color-mix(in srgb, var(--signal-red) 8%, transparent)",
    border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
    bgInner: "color-mix(in srgb, var(--signal-red) 15%, transparent)",
    borderInner: "color-mix(in srgb, var(--signal-red) 30%, transparent)",
  },
};

export function getVerdictStyles(veredicto: string) {
  return VERDICT_STYLES[veredicto] || VERDICT_STYLES["AJUSTA SUPUESTOS"];
}

/** Tooltips por veredicto (badge del callout, Fase 17). */
export const VERDICT_TOOLTIPS: Record<string, string> = {
  COMPRAR: "El depto cumple los criterios de inversión: buena rentabilidad, flujo razonable y plusvalía proyectada.",
  "AJUSTA SUPUESTOS": "El depto tiene potencial pero el precio actual no lo justifica. Negociar puede convertirlo en buena inversión.",
  "BUSCAR OTRA": "Los números no cierran. Mejor dedicar el presupuesto a otra propiedad o zona.",
};

export const FRANCO_SCORE_TOOLTIP =
  "Puntaje 0-100 que combina rentabilidad (30%), flujo de caja (25%), plusvalía proyectada (25%) y eficiencia (20%) del depto. Sobre 70: COMPRAR. Entre 50-70: AJUSTA SUPUESTOS. Bajo 50: BUSCAR OTRA.";

/** Detecta la estructura nueva v2 del análisis IA.
 * Discriminador: `conviene.respuestaDirecta_clp` (no `siendoFrancoHeadline_clp`,
 * que el prompt LTR dejó de emitir — campo huérfano no renderizado). Los
 * análisis viejos persistidos siguen pasando: traían respuestaDirecta_clp junto
 * al headline, sin regresión hacia atrás. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasAiV2(ai: any): ai is AIAnalysisV2 {
  return !!ai
    && typeof ai === "object"
    && !!ai.conviene
    && typeof ai.conviene.respuestaDirecta_clp === "string";
}

/** Renderiza contenido AI con bold markdown simple (**text**), preservando
 * párrafos. Per skill §2.5 los consumers deben aplicar `italic` al wrapper
 * cuando el campo es cuerpo IA (Patrón 4). */
export function renderAiContent(texto: string): React.ReactNode {
  if (!texto) return null;
  return texto.split(/\n\n+/).map((parrafo, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {parrafo.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j} className="font-medium">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </p>
  ));
}

/**
 * Construye los 3 DatoCards del Hero usando data del motor (no IA).
 * Garantiza consistencia con MiniCards y drawers (todos leen del motor).
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3, líneas 159-275).
 */
export function buildHeroDatosClave(
  aiData: AIAnalysisV2,
  results: FullAnalysisResult | null | undefined,
  currency: "CLP" | "UF",
  valorUF: number
): DatoClave[] {
  const iaDatos = aiData.conviene?.datosClave || [];

  // 1) Aporte / flujo mensual — from motor (ensures consistency)
  const flujo = results?.metrics?.flujoNetoMensual ?? 0;
  const flujoAbs = Math.abs(flujo);
  const flujoFmtCLP = (flujo < 0 ? "-$" : "+$") + Math.round(flujoAbs).toLocaleString("es-CL");
  const flujoFmtUF = (flujo < 0 ? "-UF " : "+UF ") + (
    flujoAbs / (valorUF || 1) >= 100
      ? Math.round(flujoAbs / (valorUF || 1)).toLocaleString("es-CL")
      : (Math.round((flujoAbs / (valorUF || 1)) * 100) / 100).toFixed(2).replace(".", ",")
  );
  const flujoColor: DatoClave["color"] = flujo < 0 ? "red" : "green";
  const aporteCard: DatoClave = {
    label: flujo < 0 ? "Aporte mensual" : "Te sobra mensual",
    valor_clp: flujoFmtCLP,
    valor_uf: flujoFmtUF,
    subtexto: flujo < 0 ? "Sale de tu bolsillo" : "Entra a tu bolsillo",
    color: flujoColor,
  };

  // 2) Precio sugerido — fuente única: motor recomputado (post-Sesión
  // B-bug-snapshot-fix). El drawer Card 03 también lee del motor, así que
  // header y drawer coinciden bit-a-bit. Fallback: anclas IA (Sesión B2
  // item 2) → string IA parseado, para análisis donde el motor no devolvió
  // negociación (caso edge sin input_data).
  const precioSugeridoRaw = aiData.negociacion?.precioSugerido || "";
  const precioSugeridoUFParsed = parseUFString(precioSugeridoRaw);
  const motorPrecioSugUF = results?.negociacion?.precioSugeridoUF;
  const motorPrecioSugCLP = results?.negociacion?.precioSugeridoCLP;
  const techoUFAncla = aiData.negociacion?.precios?.techo_uf;
  const techoCLPAncla = aiData.negociacion?.precios?.techo_clp;
  const precioSugeridoUF =
    (typeof motorPrecioSugUF === "number" && motorPrecioSugUF > 0) ? motorPrecioSugUF
    : (typeof techoUFAncla === "number" && techoUFAncla > 0) ? techoUFAncla
    : precioSugeridoUFParsed;
  const precioSugeridoCLP =
    (typeof motorPrecioSugCLP === "number" && motorPrecioSugCLP > 0) ? motorPrecioSugCLP
    : (typeof techoCLPAncla === "number" && techoCLPAncla > 0) ? techoCLPAncla
    : precioSugeridoUF * (valorUF || 0);
  const precioCard: DatoClave = {
    label: "Precio sugerido",
    valor_uf: precioSugeridoUF > 0 ? `UF ${Math.round(precioSugeridoUF).toLocaleString("es-CL")}` : "—",
    valor_clp: precioSugeridoCLP > 0 ? "$" + Math.round(precioSugeridoCLP).toLocaleString("es-CL") : "—",
    subtexto: "Para cerrar bien",
    color: "accent",
  };

  // 3) Sobreprecio vs comuna — FUENTE ÚNICA: el hallazgo de ai_analysis (FASE B).
  // El chip ahora responde "¿caro vs la comuna?" (UF/m² sujeto SIN estac vs mediana
  // comunal), NO vs vmFranco. Es la MISMA desviación que narra el párrafo → mata el
  // bug gemelo. Dirección invertida: sobre la mediana = caro (rojo), bajo = barato
  // (verde). Sin dato de zona ⇒ card "sin dato": NO hay fallback a vmFranco (diseño
  // FASE B, una sola pregunta).
  const hs = aiData.hallazgoSobreprecio;
  let sobreprecioCard: DatoClave;
  if (hs) {
    const desv = hs.valor.desviacionPct;
    const desvAbs = Math.abs(desv);
    const medianaFmt = `UF ${(Math.round(hs.valor.medianaComunaUfM2 * 10) / 10)
      .toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/m²`;
    const pct = `${desv >= 0 ? "+" : "−"}${desvAbs}%`;
    if (desvAbs <= 2) {
      sobreprecioCard = {
        label: "Precio alineado", valor_clp: pct, valor_uf: pct,
        subtexto: `En línea con la comuna (${medianaFmt})`, isLabel: false, color: "neutral",
      };
    } else if (desv > 0) {
      sobreprecioCard = {
        label: "Sobreprecio", valor_clp: pct, valor_uf: pct,
        subtexto: `Sobre la mediana de la comuna (${medianaFmt})`, isLabel: true, color: "red",
      };
    } else {
      sobreprecioCard = {
        label: "Ventaja", valor_clp: pct, valor_uf: pct,
        subtexto: `Bajo la mediana de la comuna (${medianaFmt})`, isLabel: true, color: "green",
      };
    }
  } else {
    sobreprecioCard = {
      label: "Precio vs zona", valor_clp: "—", valor_uf: "—",
      subtexto: "Sin dato de zona", isLabel: false, color: "neutral",
    };
  }

  // Silence unused vars if they aren't consumed here.
  void currency;
  void iaDatos;
  return [aporteCard, precioCard, sobreprecioCard];
}
