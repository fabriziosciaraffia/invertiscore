// Assembler de la PIRÁMIDE STR (E.1b) — ensambla los hasta 12 proto-hallazgos del corto y
// los devuelve para persistir en results.hallazgos. Se llama en el pipeline
// (buildShortTermAnalysisRow) DESPUÉS de calcShortTerm + calcFrancoScoreSTR, porque la
// decisividad de los 4 DECISIVOS sale del desglose de 4 dimensiones del score.
// Diseño congelado en of-e1a-piramide-str.md.
//
// DECISIVIDAD STR (03-sep-2026, goal "decisividad real"): la calcula calcDecisividadesSTR
// (decisividades-str.ts) por NEUTRALIZACIÓN, con el mismo contrato y las mismas constantes
// que calcDecisividades en LTR (|Δscore|/25, piso 0,85 si flipea el veredicto o desarma
// un gate, magnitud como desempate). Siete hallazgos tienen knob; los seis informativos
// (INFORMATIVOS_STR) declaran 0 en su builder. Hasta acá la decisividad de los 4
// "decisivos" se inyectaba desde |dimScore−50|/50 — un número sin relación con lo que
// cada hallazgo mide (ver la cabecera de decisividades-str.ts).

import type { Hallazgo } from "./types";
import { aplicarEncuadreVeredicto } from "./encuadre-veredicto";
import { buildHallazgoGateVeredicto } from "./gate-veredicto-hallazgo";
import { GLOSA_BRAZO } from "./engines/short-term-score";
import { metricaValorONull } from "./types";
import type { ShortTermResult } from "./engines/short-term-engine";
import type { FrancoScoreSTR } from "./engines/short-term-score";
import { buildHallazgoRentabilidadStr } from "./rentabilidad-str-hallazgo";
import { buildHallazgoFlujoStr } from "./flujo-str-hallazgo";
import { buildHallazgoOcupacionVsEstimacion, OCC_FALLBACK_PCT } from "./ocupacion-vs-estimacion-hallazgo";
import { buildHallazgoVentajaVsLtr } from "./ventaja-vs-ltr-hallazgo";
import { buildHallazgoSensibilidadStr } from "./sensibilidad-str-hallazgo";
import { buildHallazgoEstructuraCostosStr } from "./estructura-costos-str-hallazgo";
import { buildHallazgoEstructuraFinanciamiento } from "./estructura-financiamiento-hallazgo";
import { buildHallazgoSobreprecio, SOBREPRECIO_BANDA_DEFAULT } from "./sobreprecio-hallazgo";
import { buildPrecioVsComuna } from "./precio-vs-comuna";
import { buildHallazgoPlusvalia, getPlusvaliaRef, resolvePlusvaliaComuna, PLUSVALIA_BANDA_DEFAULT } from "./plusvalia-hallazgo";
import { buildHallazgoTIR } from "./tir-hallazgo";
import { buildHallazgoPatrimonio } from "./patrimonio-hallazgo";
import { classifyFinancingHealth } from "./financing-health";
import { buildHallazgoDistanciaVeredictoStr } from "./distancia-veredicto-str-hallazgo";
import { esCasoPrecioJustoStr } from "./distancia-veredicto-hallazgo";
import { veredictoStrConPatch, type VeredictoStrCtx } from "./analysis/veredicto-str-con-patch";
import { calcDecisividadesSTR } from "./decisividades-str";
import type { DecisividadFactor } from "./analysis";
import { COMISION_AIRBNB } from "./engines/short-term-engine";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Aplica el factor calibrado a un hallazgo ya construido: decisividad y magnitud
 *  (Δscore crudo, desempate del orden único) — el mismo par que LTR pasa a sus builders.
 *  Sin factor (no aplicable) ⇒ 0 / 0. */
function calibrar<H extends Hallazgo>(h: H | null, f: DecisividadFactor | undefined): H | null {
  if (!h) return h;
  return { ...h, decisividad: f?.decisividad ?? 0, magnitudContinua: f?.magnitud ?? 0 };
}

/**
 * Une los hallazgos que siembra el motor (`result.hallazgos`: hoy solo capex) con los del
 * assembler. Los del assembler GANAN por id: el capex que el motor siembra con decisividad
 * 0 se reemplaza por su copia calibrada. Fuente única del concat para los seis call sites
 * (pipeline, recompute legacy, golden, regen, sweep, prosa fresca).
 */
export function mergeHallazgosStr(motor: Hallazgo[] | null | undefined, str: Hallazgo[]): Hallazgo[] {
  const ids = new Set(str.map((h) => h.id));
  return [...(motor ?? []).filter((h) => h && !ids.has(h.id)), ...str];
}

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
   * Contexto para reevaluar el veredicto con una palanca movida: lo consumen la distancia
   * al veredicto y la decisividad real. Se pasa el contexto ENTERO en vez de los campos
   * sueltos para que ningún hallazgo pueda medir contra un input distinto del que produjo
   * el veredicto. OBLIGATORIO desde el 03-sep-2026: sin él no hay decisividad, y una
   * pirámide sin decisividad no es una pirámide más corta, es una pirámide ordenada al azar.
   */
  veredictoCtx: VeredictoStrCtx;
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

  // Decisividad real: una sola llamada sobre el MISMO ctx (y la misma base) que produjo el
  // veredicto. Los siete con knob reciben su factor; el resto declara 0 abajo.
  const dec = calcDecisividadesSTR(
    ctx.veredictoCtx,
    { comuna: ctx.comuna || "", medianaUfM2: ctx.mediana.mediana, medianaN: ctx.mediana.n, superficieM2: ctx.superficieM2, valorUF: ctx.valorUF },
    { result: r, francoScore: fs },
  );

  // ── 4 con knob propio del corto (calibrados) ──
  out.push(
    calibrar(
      buildHallazgoRentabilidadStr({
        capRatePct: base.capRate * 100,
        decisividad: dec.rentabilidad_str?.decisividad ?? 0,
        modalidad: "str",
      }),
      dec.rentabilidad_str,
    ),
  );
  // fix-occfuente-override 2026-07 — procedencia real de la ocupación del base.
  const occEsOverride = r.occFuente === "override";
  const occObservadaPct = (typeof r.occObservada === "number" ? r.occObservada : base.ocupacionReferencia) * 100;
  const occObservadaEsFallback = r.occObservadaFuente === "fallback_mercado";
  out.push(
    calibrar(
      buildHallazgoFlujoStr({
        flujoMensualCLP: base.flujoCajaMensual,
        decisividad: dec.flujo_str?.decisividad ?? 0,
        modalidad: "str",
        occEsOverride,
        occDefinidaPct: base.ocupacionReferencia * 100,
        occObservadaPct,
      }),
      dec.flujo_str,
    ),
  );
  {
    // Goal 4 — el supuesto contra la estimación para ESTE depto (no contra la comuna). Sin
    // override, caso = estimación ⇒ neutral y decisividad 0 por neutralización. La estimación
    // es `occObservada` (p50 de la dirección) o el 45% conservador cuando es fallback.
    const estimacionEsFallback = occObservadaEsFallback || r.occFuente === "fallback_mercado" || (r.occFuente == null && typeof r.occObservada !== "number");
    out.push(
      calibrar(
        buildHallazgoOcupacionVsEstimacion({
          ocupacionPct: base.ocupacionReferencia * 100, // = override cuando lo hay (consistente con el score, que factura ocupacionFinal)
          estimacionPct: estimacionEsFallback && !occEsOverride ? base.ocupacionReferencia * 100 : estimacionEsFallback ? OCC_FALLBACK_PCT : occObservadaPct,
          esOverride: occEsOverride,
          esFallback: estimacionEsFallback,
          comuna: ctx.comuna || "",
          decisividad: dec.ocupacion_vs_estimacion?.decisividad ?? 0,
          modalidad: "str",
        }),
        dec.ocupacion_vs_estimacion,
      ),
    );
  }
  {
    const comp = r.comparativa;
    if (comp) {
      out.push(
        calibrar(
          buildHallazgoVentajaVsLtr({
            sobreRentaPct: comp.sobreRentaPct,
            sobreRentaCLP: comp.sobreRenta,
            ltrNoiMensual: comp.ltr?.noiMensual ?? NaN,
            decisividad: dec.ventaja_vs_ltr?.decisividad ?? 0,
            modalidad: "str",
          }),
          dec.ventaja_vs_ltr,
        ),
      );
    }
  }

  // ── INFORMATIVOS propios del corto (0 declarado en el builder) ──
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

  // ── HEREDADOS (reuso de builders LTR, modalidad "str") ──
  // estructura_financiamiento — mismo crédito hipotecario que LTR; calibrado (pie → 25%,
  // tasa → mercado), porque en el corto el pie mueve el dividendo, el flujo y los gates.
  {
    const fh = classifyFinancingHealth(
      { pie_pct: ctx.piePct, tasa_pct: ctx.tasaPct, precio_uf: ctx.precioUF, plazo_anios: ctx.plazoAnios },
      ctx.valorUF,
    );
    out.push(
      buildHallazgoEstructuraFinanciamiento({
        financingHealth: fh,
        modalidad: "str",
        decisividad: dec.estructura_financiamiento?.decisividad ?? 0,
        magnitudContinua: dec.estructura_financiamiento?.magnitud ?? 0,
      }),
    );
  }
  // sobreprecio — precio/mediana comunal idéntico a LTR (solo si hay mediana confiable);
  // calibrado: precio → mediana × superficie.
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
      out.push(
        buildHallazgoSobreprecio(
          pvc,
          dec.sobreprecio?.decisividad ?? 0,
          dec.sobreprecio?.magnitud ?? 0,
          ctx.comuna || "",
          SOBREPRECIO_BANDA_DEFAULT,
        ),
      );
    }
  }
  // plusvalia — histórica comunal idéntica a LTR. INFORMATIVO en el corto (0 declarado):
  // el motor STR proyecta con la tasa global y no lee la histórica comunal, así que
  // neutralizarla no mueve nada. La magnitud propia queda como desempate.
  {
    const { anualizada, tieneData, cobertura, nivelUfM2, nivelPeriodo } = resolvePlusvaliaComuna(ctx.comuna || "");
    const ref = getPlusvaliaRef();
    const mag = clamp01(Math.abs(anualizada - ref.pct) / PLUSVALIA_BANDA_DEFAULT);
    out.push(
      buildHallazgoPlusvalia({
        anualizadaPct: anualizada,
        tieneData,
        cobertura,
        nivelUfM2,
        nivelPeriodo,
        ref,
        comuna: ctx.comuna || "",
        modalidad: "str",
        decisividad: 0,
        magnitudContinua: mag,
      }),
    );
  }

  // ── capex_puesta_a_punto — lo siembra calcShortTerm en result.hallazgos con decisividad
  //    0 (el motor no tiene ctx). Acá se re-emite CALIBRADO (CapEx → 0 puede desarmar un
  //    gate de cash-on-cash); mergeHallazgosStr reemplaza la copia del motor por esta. ──
  {
    const capexMotor = r.hallazgos?.find((h) => h.id === "capex_puesta_a_punto");
    if (capexMotor && dec.capex_puesta_a_punto) out.push(calibrar(capexMotor, dec.capex_puesta_a_punto));
  }

  // ── INTEGRADORES (condicionales a exitScenario, informativos: 0 declarado) ──
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

  // ── DISTANCIA AL VEREDICTO (informativo, decisividad 0 declarada) ──
  // Espejo STR del hallazgo LTR: mide cuánto tiene que mejorar una palanca para que el
  // veredicto SUBA. Usa el closure `veredictoStrConPatch`, que NO reconstruye hallazgos →
  // sin recursión con este assembler. Ausente en COMPRAR (no hay veredicto superior).
  {
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
