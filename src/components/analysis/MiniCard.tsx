import { extractRiesgos } from "@/components/ui/AnalysisDrawer";
import { readFrancoVerdict } from "@/lib/results-helpers";
import type { AISection, AINegociacionSection, FullAnalysisResult } from "@/lib/types";
import { parseUFString } from "./utils";

/** Las 5 dimensiones que el grid 2×2 + ReestructuracionMiniCard renderean. */
export type MiniCardSection =
  | "costoMensual"
  | "negociacion"
  | "reestructuracion"
  | "largoPlazo"
  | "riesgos";

/**
 * Calcula el "punchline" del MiniCard: KPI + sublabel + color, derivado del
 * motor cuando posible (no de la IA, que puede halluciná). Co-locado con
 * MiniCard porque es su única fuente de consumo.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.1, líneas 1794-1905).
 */
export function getPunchline(
  section: MiniCardSection,
  data: AISection | AINegociacionSection,
  currency: "CLP" | "UF",
  results: FullAnalysisResult | null | undefined,
  valorUF: number
): { value: string; sub: string; color: string } {
  // 1. Costo mensual — from motor
  if (section === "costoMensual") {
    const flujo = results?.metrics?.flujoNetoMensual;
    if (typeof flujo === "number" && !isNaN(flujo)) {
      const absV = Math.abs(flujo);
      const formatted = currency === "CLP"
        ? "$" + Math.round(absV).toLocaleString("es-CL")
        : "UF " + (Math.round((absV / (valorUF || 1)) * 100) / 100).toFixed(2).replace(".", ",");
      const isNeg = flujo < 0;
      return {
        value: `${isNeg ? "-" : "+"}${formatted}`,
        sub: isNeg ? "Sale de tu bolsillo" : "Entra a tu bolsillo",
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
      };
    }
    return { value: "—", sub: "Aporte mensual", color: "var(--franco-text)" };
  }

  // 2. Negociación — fuente única: motor recomputado (post-Sesión
  // B-bug-snapshot-fix). Antes la MiniCard prefería IA cuando IA < precio
  // actual, pero el header `buildHeroDatosClave` y el drawer interno leen
  // del motor: divergían visualmente. Doctrina canónica: motor primero,
  // IA fallback. Ver audit/sesionB-bug-snapshot-residual-fix/.
  if (section === "negociacion") {
    const motorSugUF = results?.negociacion?.precioSugeridoUF ?? 0;
    const precioActualCLP = results?.metrics?.precioCLP ?? 0;
    const precioActualUF = valorUF > 0 ? precioActualCLP / valorUF : 0;
    const raw = "precioSugerido" in data
      ? (data as AINegociacionSection).precioSugerido
      : "";
    const iaUF = parseUFString(raw);

    // Prioridad: motor (canónico) → IA (con guard anti-hallucinación P2) → raw.
    let sugeridoUF: number;
    if (motorSugUF > 0) {
      sugeridoUF = motorSugUF;
    } else if (iaUF > 0 && (precioActualUF === 0 || iaUF < precioActualUF)) {
      sugeridoUF = iaUF;
    } else {
      // Sin datos: caer al raw IA si existe, sino "—".
      return { value: raw || "—", sub: "Precio al que conviene cerrar", color: "var(--franco-text)" };
    }

    // P3 (7.6): si sugerido === precio actual (o muy cerca), copy variable.
    const sugeridoIgualPrecio = precioActualUF > 0 && Math.abs(sugeridoUF - precioActualUF) / precioActualUF < 0.005;
    const sub = sugeridoIgualPrecio ? "Tu precio ya está alineado" : "Precio al que conviene cerrar";

    if (valorUF > 0) {
      const value = currency === "CLP"
        ? "$" + Math.round(sugeridoUF * valorUF).toLocaleString("es-CL")
        : "UF " + Math.round(sugeridoUF).toLocaleString("es-CL");
      return { value, sub, color: "var(--franco-text)" };
    }
    return { value: `UF ${Math.round(sugeridoUF)}`, sub, color: "var(--franco-text)" };
  }

  // 3. Largo plazo — from motor
  if (section === "largoPlazo") {
    const tir = results?.exitScenario?.tir;
    const aniosPlazo = results?.exitScenario?.anios ?? 10;
    if (typeof tir === "number" && !isNaN(tir)) {
      const tirPct = tir.toFixed(1).replace(".", ",");
      const isNeg = tir < 0;
      // Skill Patrón 2: KPI binario (signal-red criticidad / var(--franco-text)
      // neutro). El dato hace el trabajo — la distinción TIR baja vs alta vive
      // en el valor mismo, no en color intermedio.
      return {
        value: `TIR ${tirPct}%`,
        sub: isNeg
          ? `Pérdida anualizada a ${aniosPlazo} años`
          : `Rentabilidad anual a ${aniosPlazo} años`,
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
      };
    }
    const retorno = results?.exitScenario?.retornoTotal;
    if (typeof retorno === "number" && !isNaN(retorno)) {
      const isNeg = retorno < 0;
      const formatted = currency === "CLP"
        ? "$" + Math.round(Math.abs(retorno) / 1_000_000) + "M"
        : "UF " + Math.round(Math.abs(retorno) / (valorUF || 1)).toLocaleString("es-CL");
      return {
        value: `${isNeg ? "-" : "+"}${formatted}`,
        sub: "Ganancia total 10 años",
        color: isNeg ? "var(--signal-red)" : "var(--franco-text)",
      };
    }
    return { value: "—", sub: "Retorno 10 años", color: "var(--franco-text)" };
  }

  // 4. Riesgos — usa el mismo extractRiesgos que el drawer (Fase 22 P2).
  // Si extractRiesgos devuelve 0, el drawer cae a 3 hardcoded — count debe
  // reflejar ESO mismo (3) para consistencia visible.
  if (section === "riesgos") {
    const content = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
    const parsed = extractRiesgos(content || "");
    const count = parsed.length > 0 ? parsed.length : 3;
    return {
      value: `${count} flancos`,
      sub: "Requieren defensa",
      color: "var(--signal-red)",
    };
  }

  return { value: "—", sub: "", color: "var(--franco-text)" };
}

/**
 * Card mediana del Subject Card Grid 2×2 (Patrón 2). Soporta override de
 * pregunta según estado del análisis (Fase 19/20). Move verbatim desde
 * results-client.tsx LTR (Ronda 4a.1, líneas 1907-1993).
 */
export function MiniCard({
  section,
  numero,
  label,
  data,
  currency,
  onClick,
  results,
  valorUF,
}: {
  section: MiniCardSection;
  /** Numeración mono per skill líneas 254-258 ("02 · COSTO MENSUAL", etc). */
  numero: string;
  label: string;
  data: AISection | AINegociacionSection;
  currency: "CLP" | "UF";
  onClick: () => void;
  results: FullAnalysisResult | null | undefined;
  valorUF: number;
}) {
  const punchline = getPunchline(section, data, currency, results, valorUF);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)] rounded-[12px] p-[1.125rem] text-left transition-colors duration-200 min-h-[150px] md:min-h-[168px] flex flex-col w-full"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[1.5px] mb-2 font-medium m-0 text-[var(--franco-text-secondary)]"
      >
        {numero} · {label}
      </p>
      <h3 className="font-heading font-bold text-[18px] leading-[1.3] mb-2 text-[var(--franco-text)] m-0">
        {(() => {
          // Override pregunta según estado (Fase 19/20). Coherente con el
          // override del drawer wrapper en AnalysisDrawer.tsx.
          if (section === "costoMensual") {
            const flujo = results?.metrics?.flujoNetoMensual ?? 0;
            if (flujo < -1000) return "¿Cuánto te cuesta mes a mes?";
            if (flujo > 1000) return "¿Cuánto te queda mes a mes?";
            return "¿Cómo queda tu flujo mensual?";
          }
          if (section === "negociacion") {
            const precioCLP = results?.metrics?.precioCLP ?? 0;
            const precioUF = valorUF > 0 ? precioCLP / valorUF : 0;
            const vmFranco = results?.metrics?.valorMercadoFrancoUF ?? precioUF;
            const dev = vmFranco > 0 ? (vmFranco - precioUF) / vmFranco : 0;
            const absDev = Math.abs(dev);
            if (absDev <= 0.02) return "¿Vale la pena negociar?";
            if (dev > 0) return "¿Vale la pena seguir negociando?";
            return "¿Cuánto bajar el precio?";
          }
          if (section === "largoPlazo") {
            const gananciaSobreTotal = results?.exitScenario?.gananciaSobreTotal ?? 0;
            const aniosPlazo = results?.exitScenario?.anios ?? 10;
            if (gananciaSobreTotal < -1000) return `¿Cuánto pierdes a ${aniosPlazo} años?`;
            if (gananciaSobreTotal > 1000) return `¿Cuánto ganas a ${aniosPlazo} años?`;
            return `¿Vale la pena a ${aniosPlazo} años?`;
          }
          if (section === "riesgos") {
            const score = results?.score ?? 0;
            const veredicto = readFrancoVerdict(results) || (score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA");
            if (veredicto === "COMPRAR") return "¿Qué cuidar?";
            if (veredicto === "BUSCAR OTRA") return "¿Qué te puede afectar más?";
            return "¿Qué riesgos asume tu negociación?";
          }
          return data.pregunta;
        })()}
      </h3>
      <p
        className="font-mono text-[22px] font-bold m-0 mb-1 leading-[1.1]"
        style={{ color: punchline.color }}
      >
        {punchline.value}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] mb-auto leading-[1.4] m-0">
        {punchline.sub}
      </p>
      <div className="border-t-[0.5px] border-[var(--franco-border)] mt-4 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)]">
          Leer análisis completo →
        </span>
      </div>
    </button>
  );
}
