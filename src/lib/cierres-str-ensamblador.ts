// ─────────────────────────────────────────────────────────────────────────────
// ENSAMBLADOR DE LOS CIERRES STR (T0 CONGELADO · 04-sep-2026) — arma los argumentos de
// `cierres-capitulos-str.ts` desde lo que el motor ya emite (metrics, simularStr,
// hallazgos, comparativa, zonaSTR, exit). Es la única costura entre motor y cierres: el
// render y los fixtures llaman esto, no recalculan nada por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────
import type { ShortTermResult } from "./engines/short-term-engine";
import type { FrancoScoreSTR } from "./engines/short-term-score";
import type { Hallazgo, HallazgoDistanciaVeredicto } from "./types";
import { metricaValorONull } from "./types";
import type { SimulacionStr } from "./analysis/simular-str";
import { CAP_STR_UMBRAL_PCT } from "./rentabilidad-str-hallazgo";
import { costoOportunidad } from "./analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "./plusvalia-proyeccion";
import type { FmtCierre, SegCierre } from "./cierres-capitulos";
import {
  cierreRentaStr, cierreFlujoStr, cierreNochesStr, cierrePagasStr, cierreGestionStr, cierreResultadoStr,
  type ArgsCierreRentaStr, type ArgsCierreFlujoStr, type ArgsCierreNochesStr, type ArgsCierrePagasStr, type ArgsCierreGestionStr, type ArgsCierreResultadoStr,
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
  flujo: ArgsCierreFlujoStr;
  noches: ArgsCierreNochesStr;
  pagas: ArgsCierrePagasStr;
  gestion: ArgsCierreGestionStr;
  resultado: ArgsCierreResultadoStr;
}

export interface CierresStr {
  renta: SegCierre[];
  flujo: SegCierre[];
  noches: SegCierre[];
  pagas: SegCierre[];
  gestion: SegCierre[];
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
  const byId = <T extends Hallazgo["id"]>(id: T) => e.hallazgos.find((h) => h.id === id) as Extract<Hallazgo, { id: T }> | undefined;
  const dv = byId("distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
  const vias = dv?.valor.vias ?? [];
  const viaPrecio = vias.find((v) => v.palanca === "precio");
  const viaAdr = vias.find((v) => v.palanca === "adr");
  const precioCLP = r.pie + r.montoCredito;
  const precioUF = e.ufValue > 0 ? precioCLP / e.ufValue : 0;
  const adr = m?.tarifaNoche ?? r.ejesAplicados?.adrFinal ?? base.adrReferencia;
  const occ = m?.ocupacion ?? r.ejesAplicados?.ocupacionFinal ?? base.ocupacionReferencia;
  const capPct = m?.capRatePct ?? base.capRate * 100;
  const flujo = m?.flujoMensual ?? base.flujoCajaMensual;
  // Tarifa a la que rendirías como el umbral: la inversa exacta del cap rate del motor
  // (ingreso neto anual ÷ precio), con la comisión y los costos fijos del caso.
  const ingreso = m?.desgloseFall.ingreso ?? base.ingresoBrutoMensual;
  const comRate = ingreso > 0 ? base.comisionMensual / ingreso : 0;
  const costosFijos = m ? m.desgloseFall.costosDirectos + m.desgloseFall.gastosComunesMantencion + m.desgloseFall.contribucionesMensuales : base.costosOperativos;
  const adrRef = occ > 0 && comRate < 1 ? ((CAP_STR_UMBRAL_PCT / 100) * precioCLP / 12 + costosFijos) / (1 - comRate) / ((occ * 365) / 12) : adr;
  const otro = e.modoGestion === "auto" ? r.comparativa.str_admin : r.comparativa.str_auto;
  const sobre = byId("sobreprecio") as { valor?: { desviacionPct?: number; n?: number; medianaComunaUfM2?: number | null } } | undefined;
  const fin = byId("estructura_financiamiento") as { valor?: { tasaPct?: number; tasaMarketPct?: number } } | undefined;
  const exit = r.exitScenario;
  const bolsillo = (r.projections ?? []).reduce((acc, p) => acc + (p.flujoOperacionalAnual < 0 ? -p.flujoOperacionalAnual : 0), 0);
  return {
    renta: {
      veredictoBase: veredicto,
      adr,
      adrEsDelUsuario: r.adrFuente === "override",
      capPct,
      capRefPct: CAP_STR_UMBRAL_PCT,
      gapPts: capPct - CAP_STR_UMBRAL_PCT,
      adrRef: Math.round(adrRef / 100) * 100,
      fronteras: sim?.fronterasIngreso ?? null,
      matriz: sim?.matrizTarifaOcupacion ?? null,
    },
    flujo: {
      flujoMensual: flujo,
      estabilizacionCLP: r.perdidaRampUp,
      flujoLargo: r.comparativa.ltr.flujoCaja,
      flujoOtroModo: otro.flujoCajaMensual,
      modo: e.modoGestion,
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
    pagas: {
      veredictoBase: veredicto,
      precioUF,
      // Solo la vía que cruza DENTRO del tope de honestidad: la frontera del dial explora más
      // lejos (hasta −70%) y sirve para dibujar, no para prometer un ajuste.
      techoUF: viaPrecio?.estado === "cruza" ? viaPrecio.objetivo : null,
      veredictoObjetivo: dv?.valor.veredictoObjetivo ?? null,
      sobreprecio: sobre?.valor && typeof sobre.valor.desviacionPct === "number" && sobre.valor.medianaComunaUfM2 != null ? { desviacionPct: sobre.valor.desviacionPct, n: sobre.valor.n ?? 0 } : null,
      spreadTasaPts: fin?.valor && typeof fin.valor.tasaPct === "number" && typeof fin.valor.tasaMarketPct === "number" ? fin.valor.tasaPct - fin.valor.tasaMarketPct : null,
      matriz: sim?.matrizPiePlazo ?? null,
      tarifaCruza: viaAdr?.estado === "cruza" ? { objetivo: viaAdr.objetivo, deltaPct: viaAdr.deltaPct } : null,
    },
    gestion: {
      modo: e.modoGestion,
      sobreRenta: r.comparativa.sobreRenta,
      sobreRentaOtroModo: otro.noiMensual - r.comparativa.ltr.noiMensual,
      flujoMensual: flujo,
      flujoOtroModo: otro.flujoCajaMensual,
      ltrIngresoNeto: r.comparativa.ltr.noiMensual,
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
    },
  };
}

/** Los seis cierres redactados. */
export function cierresStr(e: EntradaCierresStr, f: FmtCierre = fmtCierreCLP()): CierresStr {
  const a = argsCierresStr(e);
  return {
    renta: cierreRentaStr(a.renta, f),
    flujo: cierreFlujoStr(a.flujo, f),
    noches: cierreNochesStr(a.noches, f),
    pagas: cierrePagasStr(a.pagas, f),
    gestion: cierreGestionStr(a.gestion, f),
    resultado: cierreResultadoStr(a.resultado, f),
  };
}

export const textoCierre = (segs: SegCierre[]) => segs.map((s) => s.t).join("");
