// ─────────────────────────────────────────────────────────────────────────────
// ENSAMBLADOR DE LOS CIERRES STR (T0 CONGELADO · 04-sep-2026) — arma los argumentos de
// `cierres-capitulos-str.ts` desde lo que el motor ya emite (metrics, simularStr,
// hallazgos, comparativa, zonaSTR, exit). Es la única costura entre motor y cierres: el
// render y los fixtures llaman esto, no recalculan nada por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────
import type { ShortTermResult } from "./engines/short-term-engine";
import type { FrancoScoreSTR } from "./engines/short-term-score";
import type { Hallazgo, HallazgoRentabilidadStr } from "./types";
import { metricaValorONull } from "./types";
import type { SimulacionStr } from "./analysis/simular-str";
import { CAP_STR_UMBRAL_PCT } from "./rentabilidad-str-hallazgo";
import { costoOportunidad } from "./analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "./plusvalia-proyeccion";
import type { FmtCierre, SegCierre } from "./cierres-capitulos";
import {
  cierreRentaStr, cierreNochesStr, cierreGestionStr, cierreLargoStr, cierreResultadoStr,
  type ArgsCierreRentaStr, type ArgsCierreNochesStr, type ArgsCierreGestionStr, type ArgsCierreResultadoStr,
} from "./cierres-capitulos-str";

export interface EntradaCierresStr {
  result: ShortTermResult;
  francoScore: FrancoScoreSTR;
  hallazgos: Hallazgo[];
  simulacion: SimulacionStr | null;
  comuna: string;
  /** UF congelada del análisis (precioCompra / precioCompraUF). */
  ufValue: number;
  modoGestion: "auto" | "administrador";
}

export interface ArgsCierresStr {
  renta: ArgsCierreRentaStr;
  noches: ArgsCierreNochesStr;
  gestion: ArgsCierreGestionStr;
  resultado: ArgsCierreResultadoStr;
}

export interface CierresStr {
  renta: SegCierre[];
  noches: SegCierre[];
  /** Cierra el capítulo II, debajo de las filas del administrador (fusión 17-sep-2026). */
  gestion: SegCierre[];
  /** Cierra lo que queda del capítulo V: el corto contra el arriendo largo. */
  largo: SegCierre[];
  resultado: SegCierre[];
}

/** Formateadores en CLP (el render pasa los suyos cuando el toggle está en UF). */
export function fmtCierreCLP(): FmtCierre {
  return {
    money: (n) => (n < 0 ? "−" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("es-CL"),
    compact: (n) => (n < 0 ? "−" : "") + "$" + (Math.abs(n) / 1e6).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM",
    pct1: (n) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
}

/** Los argumentos de los seis cierres, todos desde el motor. */
export function argsCierresStr(e: EntradaCierresStr): ArgsCierresStr {
  const r = e.result;
  const m = r.metrics;
  const base = r.escenarios.base;
  const veredicto = e.francoScore.veredicto;
  const sim = e.simulacion;
  const precioCLP = r.pie + r.montoCredito;
  const adr = m?.tarifaNoche ?? r.ejesAplicados?.adrFinal ?? base.adrReferencia;
  const occ = m?.ocupacion ?? r.ejesAplicados?.ocupacionFinal ?? base.ocupacionReferencia;
  const capPct = m?.capRatePct ?? base.capRate * 100;
  const flujo = m?.flujoMensual ?? base.flujoCajaMensual;
  // Tarifa a la que rendirías como el umbral: la inversa exacta del cap rate del motor
  // (ingreso neto anual ÷ precio), con la comisión y los costos fijos del caso.
  const ingreso = m?.desgloseFall.ingreso ?? base.ingresoBrutoMensual;
  const comRate = ingreso > 0 ? base.comisionMensual / ingreso : 0;
  const costosFijos = m ? m.desgloseFall.costosDirectos + m.desgloseFall.gastosComunesMantencion + m.desgloseFall.contribucionesMensuales : base.costosOperativos;
  // El umbral del hallazgo (bruta de la comuna + 1 pt; 5% nacional si la fila no lo trae).
  const hRenta = e.hallazgos.find((h) => h.id === "rentabilidad_str") as HallazgoRentabilidadStr | undefined;
  const umbralPct = hRenta?.valor.umbralPct ?? CAP_STR_UMBRAL_PCT;
  const adrRef = occ > 0 && comRate < 1 ? ((umbralPct / 100) * precioCLP / 12 + costosFijos) / (1 - comRate) / ((occ * 365) / 12) : adr;
  const otro = e.modoGestion === "auto" ? r.comparativa.str_admin : r.comparativa.str_auto;
  const exit = r.exitScenario;
  const bolsillo = (r.projections ?? []).reduce((acc, p) => acc + (p.flujoOperacionalAnual < 0 ? -p.flujoOperacionalAnual : 0), 0);
  return {
    renta: {
      veredictoBase: veredicto,
      adr,
      adrEsDelUsuario: r.adrFuente === "override",
      capPct,
      capRefPct: umbralPct,
      gapPts: capPct - umbralPct,
      adrRef: Math.round(adrRef / 100) * 100,
      fronteras: sim?.fronterasIngreso ?? null,
      matriz: sim?.matrizTarifaOcupacion ?? null,
    },
    noches: {
      veredictoBase: veredicto,
      noches: Math.round(occ * 365),
      nochesArriba: sim?.fronterasIngreso.ocupacion.arriba != null ? Math.round(sim.fronterasIngreso.ocupacion.arriba * 365) : null,
      ocupacionPct: occ * 100,
      ocupacionArribaPct: sim?.fronterasIngreso.ocupacion.arriba != null ? sim.fronterasIngreso.ocupacion.arriba * 100 : null,
      veredictoArriba: sim?.fronterasIngreso.arriba?.veredicto ?? null,
      ocupacionEsDelUsuario: r.occFuente === "override",
      vsComuna: r.zonaSTR?.ocupacionVsComuna ?? null,
      comuna: e.comuna,
      mesesEnVerde: r.flujoEstacional.filter((f) => f.flujo >= 0).length,
      estabilizacionCLP: r.perdidaRampUp,
    },
    gestion: {
      modo: e.modoGestion,
      sobreRenta: r.comparativa.sobreRenta,
      flujoMensual: flujo,
      flujoOtroModo: otro.flujoCajaMensual,
      ltrIngresoNeto: r.comparativa.ltr.noiMensual,
      quiebre: r.comparativa.quiebreGestion ?? null,
    },
    resultado: {
      comuna: e.comuna,
      patrimonioCLP: exit?.equityCLP ?? 0,
      aportadoCLP: exit?.totalAportado ?? r.capitalInvertido,
      pieCLP: r.pie,
      amortizacionCLP: exit ? r.montoCredito - exit.saldoCreditoAlVender : 0,
      multiplicador: exit ? metricaValorONull(exit.multiplicadorCapital) ?? 0 : 0,
      sinCapitalPropio: r.pie === 0,
      flujoAcumulado: exit?.flujoAcumuladoAlVender ?? 0,
      bolsilloCLP: bolsillo,
      tirPct: exit ? metricaValorONull(exit.tirAnual) : null,
      depositoCLP: costoOportunidad(r.capitalInvertido, 10).depositoUF,
      proyPct: String(Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)),
      motor: "la operación por noche",
    },
  };
}

/** Los cierres redactados. `gestion` y `largo` salen de los MISMOS args: eran un solo cierre
 *  hasta que la fusión del 17-sep-2026 mandó la comisión al capítulo II y dejó el hilo del
 *  largo en el V. */
export function cierresStr(e: EntradaCierresStr, f: FmtCierre = fmtCierreCLP()): CierresStr {
  const a = argsCierresStr(e);
  return {
    renta: cierreRentaStr(a.renta, f),
    noches: cierreNochesStr(a.noches, f),
    gestion: cierreGestionStr(a.gestion, f),
    largo: cierreLargoStr(a.gestion, f),
    resultado: cierreResultadoStr(a.resultado, f),
  };
}

export const textoCierre = (segs: SegCierre[]) => segs.map((s) => s.t).join("");
