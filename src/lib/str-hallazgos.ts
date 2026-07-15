// Assembler de la PIRÁMIDE STR (E.1b) — ensambla los hasta 12 proto-hallazgos del corto y
// los devuelve para persistir en results.hallazgos. Se llama en el pipeline
// (buildShortTermAnalysisRow) DESPUÉS de calcShortTerm + calcFrancoScoreSTR, porque la
// decisividad de los 4 DECISIVOS sale del desglose de 4 dimensiones del score.
// Diseño congelado en of-e1a-piramide-str.md.
//
// DECISIVIDAD STR (decisión E.1a): decisividad>0 SOLO en los 4 que son 1:1 con una dim del
// score (decisividad_dim = |dimScore−50|/50). Los 8 restantes van solo-lectura (0.000) con
// magnitud para el sort. No se construye un calcDecisividades STR.

import type { Hallazgo } from "./types";
import type { ShortTermResult } from "./engines/short-term-engine";
import type { FrancoScoreSTR } from "./engines/short-term-score";
import { STR_UNIVERSO_OCC } from "./engines/str-universo-santiago";
import { buildHallazgoRentabilidadStr } from "./rentabilidad-str-hallazgo";
import { buildHallazgoFlujoStr } from "./flujo-str-hallazgo";
import { buildHallazgoOcupacionVsBanda } from "./ocupacion-vs-banda-hallazgo";
import { buildHallazgoVentajaVsLtr } from "./ventaja-vs-ltr-hallazgo";
import { buildHallazgoSensibilidadStr } from "./sensibilidad-str-hallazgo";
import { buildHallazgoEstructuraCostosStr } from "./estructura-costos-str-hallazgo";
import { buildHallazgoEstructuraFinanciamiento } from "./estructura-financiamiento-hallazgo";
import { buildHallazgoSobreprecio, SOBREPRECIO_BANDA_DEFAULT } from "./sobreprecio-hallazgo";
import { buildPrecioVsComuna } from "./precio-vs-comuna";
import { buildHallazgoPlusvalia, getPlusvaliaRef, resolvePlusvaliaComuna, PLUSVALIA_BANDA_DEFAULT } from "./plusvalia-hallazgo";
import { buildHallazgoTIR } from "./tir-hallazgo";
import { buildHallazgoPatrimonio } from "./patrimonio-hallazgo";
import { classifyFinancingHealth, LEVEL_RANK } from "./financing-health";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** decisividad_dim = |dimScore−50|/50: cuánto tira la dimensión el veredicto desde el neutro. */
const decisividadDim = (dimScore: number): number =>
  Number.isFinite(dimScore) ? clamp01(Math.abs(dimScore - 50) / 50) : 0;

export interface BuildStrHallazgosCtx {
  result: ShortTermResult;
  francoScore: FrancoScoreSTR;
  comuna: string;
  /** precio del depto en UF (para sobreprecio/financiamiento). */
  precioUF: number;
  superficieM2: number;
  piePct: number;   // % (ej. 20)
  tasaPct: number;  // % (ej. 4.5)
  plazoAnios: number;
  /** mediana comunal de venta UF/m² ya resuelta (sobreprecio-sync). */
  mediana: { mediana: number | null; n: number };
  valorUF: number;  // UF→CLP del momento (patrimonio CLP↔UF, financing)
  incluyeCorretaje: boolean;
}

/**
 * Ensambla la pirámide STR. Devuelve los hallazgos que sobreviven (omite los no computables
 * / sin exitScenario / sin mediana). El capex ya viene sembrado en result.hallazgos por
 * calcShortTerm — este assembler NO lo duplica; el pipeline concatena.
 */
export function buildStrHallazgos(ctx: BuildStrHallazgosCtx): Hallazgo[] {
  const { result: r, francoScore: fs } = ctx;
  const base = r.escenarios?.base;
  const out: (Hallazgo | null)[] = [];
  if (!base) return [];

  // ── 4 DECISIVOS (decisividad = dim del score) ──
  out.push(
    buildHallazgoRentabilidadStr({
      capRatePct: base.capRate * 100,
      decisividad: decisividadDim(fs.desglose.rentabilidad.score),
      modalidad: "str",
    }),
  );
  // fix-occfuente-override 2026-07 — procedencia real de la ocupación del base.
  const occEsOverride = r.occFuente === "override";
  const occObservadaPct = (typeof r.occObservada === "number" ? r.occObservada : base.ocupacionReferencia) * 100;
  const occObservadaEsFallback = r.occObservadaFuente === "fallback_mercado";
  out.push(
    buildHallazgoFlujoStr({
      flujoMensualCLP: base.flujoCajaMensual,
      decisividad: decisividadDim(fs.desglose.sostenibilidad.score),
      modalidad: "str",
      occEsOverride,
      occDefinidaPct: base.ocupacionReferencia * 100,
      occObservadaPct,
    }),
  );
  {
    const bandaComunal = STR_UNIVERSO_OCC[ctx.comuna];
    out.push(
      buildHallazgoOcupacionVsBanda({
        ocupacionPct: base.ocupacionReferencia * 100, // = override cuando lo hay (consistente con el score, que factura ocupacionFinal)
        bandaComunalPct: typeof bandaComunal === "number" ? bandaComunal * 100 : NaN,
        // fallback SOLO cuando es fallback real; 'override' NO es fallback; undefined (legacy)→fallback (default dominante).
        esFallback: r.occFuente === "fallback_mercado" || r.occFuente == null,
        esOverride: occEsOverride,
        occObservadaPct,
        occObservadaEsFallback,
        comuna: ctx.comuna || "",
        decisividad: decisividadDim(fs.desglose.factibilidad.score),
        modalidad: "str",
      }),
    );
  }
  {
    const comp = r.comparativa;
    if (comp) {
      out.push(
        buildHallazgoVentajaVsLtr({
          sobreRentaPct: comp.sobreRentaPct,
          sobreRentaCLP: comp.sobreRenta,
          ltrNoiMensual: comp.ltr?.noiMensual ?? NaN,
          decisividad: decisividadDim(fs.desglose.ventaja.score),
          modalidad: "str",
        }),
      );
    }
  }

  // ── SOLO-LECTURA propios (decisividad 0) ──
  out.push(
    buildHallazgoSensibilidadStr({
      breakEvenPctDelMercado: r.breakEvenPctDelMercado,
      modalidad: "str",
    }),
  );
  {
    const ib = base.ingresoBrutoMensual;
    if (Number.isFinite(ib) && ib > 0) {
      out.push(
        buildHallazgoEstructuraCostosStr({
          costStackPct: (base.costosOperativos + (base.comisionMensual || 0)) / ib,
          modalidad: "str",
        }),
      );
    }
  }

  // ── HEREDADOS (reuso de builders LTR, solo-lectura, modalidad "str") ──
  // estructura_financiamiento — mismo crédito hipotecario que LTR.
  {
    const fh = classifyFinancingHealth(
      { pie_pct: ctx.piePct, tasa_pct: ctx.tasaPct, precio_uf: ctx.precioUF, plazo_anios: ctx.plazoAnios },
      ctx.valorUF,
    );
    const magFin = clamp01(LEVEL_RANK[fh.overall] / 3);
    out.push(
      buildHallazgoEstructuraFinanciamiento({
        financingHealth: fh,
        modalidad: "str",
        decisividad: 0,
        magnitudContinua: magFin,
      }),
    );
  }
  // sobreprecio — precio/mediana comunal idéntico a LTR (solo si hay mediana confiable).
  {
    const sujetoUfM2 = ctx.superficieM2 > 0 ? ctx.precioUF / ctx.superficieM2 : NaN;
    const confiable = ctx.mediana.mediana != null && ctx.mediana.n > 0;
    const pvc = buildPrecioVsComuna({
      sujetoUfM2,
      medianaComunaUfM2: ctx.mediana.mediana,
      confiable,
      n: ctx.mediana.n,
    });
    if (pvc.confiable && pvc.desviacionPct != null) {
      const mag = clamp01(Math.abs(pvc.desviacionPct) / SOBREPRECIO_BANDA_DEFAULT);
      out.push(buildHallazgoSobreprecio(pvc, 0, mag, ctx.comuna || "", SOBREPRECIO_BANDA_DEFAULT));
    }
  }
  // plusvalia — histórica comunal idéntica a LTR.
  {
    const { anualizada, tieneData } = resolvePlusvaliaComuna(ctx.comuna || "");
    const ref = getPlusvaliaRef();
    const mag = clamp01(Math.abs(anualizada - ref.pct) / PLUSVALIA_BANDA_DEFAULT);
    out.push(
      buildHallazgoPlusvalia({
        anualizadaPct: anualizada,
        tieneData,
        ref,
        comuna: ctx.comuna || "",
        modalidad: "str",
        decisividad: 0,
        magnitudContinua: mag,
      }),
    );
  }

  // ── INTEGRADORES (condicionales a exitScenario, solo-lectura) ──
  const exit = r.exitScenario;
  if (exit) {
    out.push(buildHallazgoTIR({ tirPct: exit.tirAnual, modalidad: "str" }));
    out.push(
      buildHallazgoPatrimonio({
        patrimonioCLP: exit.equityCLP,
        // Base = totalAportado (inicial + Σ aportes<0), espejo EXACTO del card LTR
        // (analysis.ts:1737). Antes usaba capitalInvertido → el multiplicador del card no
        // calzaba con el del exit/SaleBlock/score. Homologación rama comparabilidad-motores.
        aportadoCLP: exit.totalAportado,
        valorUF: ctx.valorUF,
        incluyeCorretaje: ctx.incluyeCorretaje,
        modalidad: "str",
      }),
    );
  }

  return out.filter((h): h is Hallazgo => h != null);
}
