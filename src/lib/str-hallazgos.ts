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
import { aplicarEncuadreVeredicto } from "./encuadre-veredicto";
import { buildHallazgoGateVeredicto } from "./gate-veredicto-hallazgo";
import { GLOSA_BRAZO } from "./engines/short-term-score";
import { metricaValorONull } from "./types";
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
import { buildHallazgoDistanciaVeredictoStr } from "./distancia-veredicto-str-hallazgo";
import { esCasoPrecioJustoStr } from "./distancia-veredicto-hallazgo";
import { veredictoStrConPatch, type VeredictoStrCtx } from "./analysis/veredicto-str-con-patch";
import { COMISION_AIRBNB } from "./engines/short-term-engine";

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
  /**
   * Contexto para reevaluar el veredicto con una palanca movida (hallazgo de distancia al
   * veredicto). Se pasa el contexto ENTERO en vez de los campos sueltos para que el
   * hallazgo no pueda medir contra un input distinto del que produjo el veredicto.
   *
   * OPCIONAL: sin él el hallazgo se omite (pirámide N−1), que es el comportamiento correcto
   * para los call sites de auditoría que reconstruyen el resultado sin el input completo.
   */
  veredictoCtx?: VeredictoStrCtx;
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
    // Pie cero (rama A): TIR 'no_aplica' ⇒ hallazgo ausente, igual que LTR
    // (analysis.ts:1882-83). Sin este guard, con pie 0 el corto emitía un hallazgo
    // de TIR que el largo ya no emite — la misma asimetría que la rama cierra.
    const tirNum = metricaValorONull(exit.tirAnual);
    if (tirNum !== null) {
      out.push(buildHallazgoTIR({ tirPct: tirNum, modalidad: "str" }));
    }
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
        sinCapitalPropio: r.pie === 0,
      }),
    );
  }

  // ── DISTANCIA AL VEREDICTO (solo-lectura, decisividad 0) ──
  // Espejo STR del hallazgo LTR: mide cuánto tiene que mejorar una palanca para que el
  // veredicto SUBA. Usa el closure `veredictoStrConPatch`, que NO reconstruye hallazgos →
  // sin recursión con este assembler. Ausente en COMPRAR (no hay veredicto superior) y
  // cuando el caller no pasa el contexto ⇒ pirámide N−1.
  if (ctx.veredictoCtx) {
    const vc = ctx.veredictoCtx;
    // CASO PRECIO-JUSTO STR (§1.12.4) — detección de fuente única
    // (esCasoPrecioJustoStr): el sobreprecio ya viene sembrado en la lista con la
    // mediana confiable; los overrides salen del MISMO input del closure.
    const sobre = out.find((h) => h?.id === "sobreprecio");
    const casoPrecioJusto = esCasoPrecioJustoStr({
      desviacionPct: (sobre?.valor as { desviacionPct?: number } | undefined)?.desviacionPct,
      adrOverride: vc.inputs.adrOverride,
      occOverride: vc.inputs.occOverride,
      veredicto: fs.veredicto,
    });
    out.push(
      buildHallazgoDistanciaVeredictoStr({
        veredictoBase: fs.veredicto,
        score: fs.score,
        precioUF: ctx.precioUF,
        precioCLP: vc.inputs.precioCompra,
        adrActual: r.ejesAplicados?.adrFinal ?? NaN,
        modoGestionActual: vc.inputs.modoGestion === "auto" ? "auto" : "administrador",
        comisionAutoDec: COMISION_AIRBNB,
        comisionAdminDec: vc.inputs.comisionAdministrador,
        plazoCredito: ctx.plazoAnios,
        piePct: ctx.piePct,
        razonSinPie: vc.inputs.razonSinPie,
        motivosGate: fs.gates?.motivos ?? [],
        veredictoAtPatch: (patch) => veredictoStrConPatch(vc, patch),
        casoPrecioJusto,
      }),
    );
  }

  // §1.12.8 — cuando un gate decide y NINGUNA card es adversa, la causa del
  // veredicto no existe en la piramide y el orden no tiene donde anclar. Ese
  // hueco se cierra con el hallazgo del gate (decisividad medida, no asignada).
  const vivos = out.filter((h): h is Hallazgo => h != null);
  const gateHallazgo = buildHallazgoGateVeredicto({
    motivos: fs.gates?.motivos ?? [],
    glosas: GLOSA_BRAZO,
    score: fs.score,
    veredictoFinal: fs.veredicto,
    hayAdverso: vivos.some((h) => h.direccion === "adverso"),
  });
  if (gateHallazgo) vivos.push(gateHallazgo);

  // §1.12.8 — el encuadre por veredicto se aplica a la piramide STR con el
  // mismo criterio que LTR: los favorables que dicen decidir llegan con su
  // clausula cuando el veredicto esta degradado. Ver encuadre-veredicto.ts.
  return aplicarEncuadreVeredicto(vivos, fs.veredicto);
}
