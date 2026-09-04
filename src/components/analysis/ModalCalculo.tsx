"use client";

import type { AnalisisInput, AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { ModalCalculoBase } from "./shared/ModalCalculoBase";
import { Planilla, type FilaPlanilla } from "./shared/Planilla";

/**
 * "VER CÓMO SE CALCULA" — contrato CONGELADO 02-sep-2026 (T2), adaptador LTR.
 *
 * La planilla detrás de cada cifra de "Los números", para el lector calificado.
 * Tres bloques apilados, todos DETERMINISTAS desde `projections` y `metrics` (cero
 * prosa):
 *   (a) Flujo por año — desde el desglose anual que emite calcProjections (T1). El
 *       NOI es el del motor (excluye vacancia, corretaje y recambio, que van en su
 *       propia columna): así el NOI cuadra con el cap rate neto y el flujo con el del
 *       informe. Filas de pre-entrega marcadas.
 *   (b) Indicadores — fórmula en palabras · valores sustituidos · resultado, con el
 *       año base (arriendo y gastos de hoy), que es lo que muestran las celdas.
 *   (c) Escenario de salida — valor año N → − saldo → − comisión → = tu parte, y la
 *       composición firme (pie + amortización) / proyectado (plusvalía neta).
 *
 * Desde T1 (04-sep-2026) la cáscara y la tabla son compartidas (`ModalCalculoBase` +
 * `Planilla`): este archivo solo arma columnas, filas y supuestos LTR.
 * Si las filas vienen sin desglose (results legacy, demo), el bloque (a) no se
 * dibuja: se dice que falta, nunca se inventa.
 */
export function ModalCalculo({
  abierto,
  onClose,
  metrics,
  results,
  inputData,
  valorUF,
  capRef,
}: {
  abierto: boolean;
  onClose: () => void;
  metrics: AnalysisMetrics;
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  valorUF: number;
  /** Referencia del cap rate neto: porcentaje y su fuente, si existen. */
  capRef: { pct: number; fuente: string } | null;
}) {
  const clp = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
  const num = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
  const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;
  const mm = (n: number) => `$${(n / 1_000_000).toFixed(1).replace(".", ",")} MM`;
  const c = (v: number, texto?: string) => ({ v: texto ?? num(v), neg: v < 0 });

  const exit = results.exitScenario;
  const anios = exit?.anios ?? 10;
  const filas = (results.projections ?? []).slice(0, anios);
  const conDesglose = filas.length > 0 && filas.every((p) => p.noiAnual != null && p.dividendoAnual != null);
  const preEntregaAnios = metrics.preEntrega?.aniosEspera ?? 0;
  const entregaTexto = metrics.preEntrega && preEntregaAnios > 0 ? formatearEntrega(inputData.fechaEntrega) : null;

  const tot = (k: "arriendoAnual" | "gastosOperativosAnual" | "noiAnual" | "vacanciaRotacionAnual" | "dividendoAnual" | "flujoAnual") =>
    filas.reduce((a, p) => a + (p[k] ?? 0), 0);

  // (b) indicadores
  const arriendoAnual = metrics.ingresoMensual * 12;
  const noiAnual = metrics.noi;
  const precio = metrics.precioCLP;
  const coc = metricaValorONull(metrics.cashOnCash);
  const capital = exit?.inversionInicial ?? 0;
  const flujoAnual0 = metrics.flujoNetoMensual * 12;
  const tir = metricaValorONull(exit?.tir);
  const cobertura = metrics.dividendo > 0 ? metrics.ingresoMensual / metrics.dividendo : null;

  // (c) salida
  const creditoInicial = precio - metrics.pieCLP;
  const amortizacion = exit ? Math.max(creditoInicial - exit.saldoCredito, 0) : 0;
  const firme = metrics.pieCLP + amortizacion;
  const plusvaliaNeta = exit ? exit.valorVenta - precio - exit.comisionVenta : 0;
  const equity = exit?.equityCLP ?? 0;
  const pctFirme = equity > 0 ? Math.round((firme / equity) * 100) : 0;
  const pctProy = equity > 0 ? 100 - pctFirme : 0;

  const filasFlujo: FilaPlanilla[] = filas.map((p) => {
    const pre = (p.mesesOperativos ?? 12) === 0;
    const ent = preEntregaAnios > 0 && p.anio === preEntregaAnios;
    const raya = { v: "—" };
    return {
      th: `${p.anio}${pre ? (ent ? " · entrega" : " · construcción") : ""}`,
      clase: ent ? "ent" : pre ? "pre" : undefined,
      celdas: pre
        ? [raya, raya, raya, raya, raya, c(p.flujoAnual), c(p.flujoAcumulado)]
        : [c(p.arriendoAnual ?? 0), c(-(p.gastosOperativosAnual ?? 0)), c(p.noiAnual ?? 0), c(-(p.vacanciaRotacionAnual ?? 0)), c(-(p.dividendoAnual ?? 0)), c(p.flujoAnual), c(p.flujoAcumulado)],
    };
  });
  filasFlujo.push({
    th: `Total ${anios} años`,
    clase: "tot",
    celdas: [c(tot("arriendoAnual")), c(-tot("gastosOperativosAnual")), c(tot("noiAnual")), c(-tot("vacanciaRotacionAnual")), c(-tot("dividendoAnual")), c(tot("flujoAnual")), { v: "" }],
  });

  const filasInd: FilaPlanilla[] = [
    { th: "Cap rate bruto", celdas: [{ v: "Arriendo anual ÷ precio" }, { v: `${clp(arriendoAnual)} ÷ ${clp(precio)}` }, { v: pct2(metrics.rentabilidadBruta) }] },
    { th: "Cap rate neto", celdas: [{ v: "NOI anual ÷ precio" }, { v: `${clp(noiAnual)} ÷ ${clp(precio)}` }, { v: pct2(metrics.capRate) }] },
    { th: "Cash-on-cash", celdas: [{ v: "Flujo anual ÷ capital aportado" }, { v: coc != null ? `${clp(flujoAnual0)} ÷ ${clp(capital)}` : "sin pie: no aplica" }, { v: coc != null ? pct2(coc) : "—", neg: coc != null && coc < 0 }] },
    { th: "Cobertura de cuota", celdas: [{ v: "Arriendo mensual ÷ dividendo" }, { v: cobertura != null ? `${clp(metrics.ingresoMensual)} ÷ ${clp(metrics.dividendo)}` : "sin crédito" }, { v: cobertura != null ? `${cobertura.toFixed(2).replace(".", ",")}×` : "—" }] },
    {
      th: `TIR a ${anios} años`,
      celdas: [
        { v: "Tasa que iguala lo que pones con lo que recibes" },
        { v: exit ? `−${mm(capital)} hoy · ${exit.flujoAcumulado < 0 ? "−" : "+"}${mm(Math.abs(exit.flujoAcumulado))} en ${anios - preEntregaAnios} años · +${mm(equity)} el año ${anios}` : "—" },
        { v: tir != null ? pct2(tir) : "—" },
      ],
    },
  ];

  return (
    <ModalCalculoBase
      abierto={abierto}
      onClose={onClose}
      pie={
        <>
          Motor Franco · UF {Math.round(valorUF).toLocaleString("es-CL")}
          {capRef ? ` · cap rate de referencia: ${capRef.fuente}` : ""}
        </>
      }
      bloques={[
        {
          letra: "a",
          titulo: "Flujo por año",
          bajada:
            preEntregaAnios > 0
              ? `Los primeros ${preEntregaAnios === 1 ? "año no hay" : `${preEntregaAnios} años no hay`} flujo: el depto se entrega${entregaTexto ? ` en ${entregaTexto}` : " después"}.`
              : "Cada año con el arriendo y los gastos reajustados.",
          children: conDesglose ? (
            <>
              <Planilla columnas={["Año", "Arriendo", "Gastos op.", "NOI", "Vac. y rotación", "Dividendo", "Flujo neto", "Acumulado"]} filas={filasFlujo} />
              <div className="v-fuente">
                Arriendo reajustado 3,5% al año · gastos y dividendo 3% al año · gastos operativos = gastos comunes en vacancia +
                contribuciones + mantención · vacancia y rotación = 0,6 mes de arriendo + corretaje y recambio
              </div>
            </>
          ) : (
            <div className="v-fuente">Este análisis no trae el desglose anual (se calcula desde el motor en los análisis nuevos).</div>
          ),
        },
        {
          letra: "b",
          titulo: "Indicadores",
          bajada: "Con el arriendo y los gastos de hoy, año base.",
          children: (
            <>
              <Planilla variante="ind" columnas={[]} filas={filasInd} />
              <div className="v-fuente">
                Capital aportado = pie {clp(metrics.pieCLP)} + gastos de compra {clp(Math.max(capital - metrics.pieCLP, 0))} · NOI = arriendo − gastos comunes
                en vacancia − contribuciones − mantención
              </div>
            </>
          ),
        },
        ...(exit
          ? [
              {
                letra: "c",
                titulo: "Escenario de salida",
                bajada: `Venta en el año ${anios}.`,
                children: (
                  <>
                    <div className="kv">
                      <span>Valor del depto en el año {anios} · 3% anual desde la firma</span>
                      <span className="v">{clp(exit.valorVenta)}</span>
                    </div>
                    <div className="kv">
                      <span>− Saldo de la deuda</span>
                      <span className="v neg">{clp(-exit.saldoCredito)}</span>
                    </div>
                    <div className="kv">
                      <span>− Comisión de venta (2%)</span>
                      <span className="v neg">{clp(-exit.comisionVenta)}</span>
                    </div>
                    <div className="kv tot">
                      <span>= Tu parte</span>
                      <span className="v">{clp(equity)}</span>
                    </div>
                    {equity > 0 && (
                      <>
                        <div className="compo">
                          <span className="f" style={{ width: `${pctFirme}%` }} />
                          <span className="p" style={{ width: `${pctProy}%` }} />
                        </div>
                        <div className="compo-leg">
                          <span>
                            <b>Firme · {pctFirme}%</b> pie {mm(metrics.pieCLP)} + amortización {mm(amortizacion)}
                          </span>
                          <span>
                            <b>Proyectado · {pctProy}%</b> plusvalía neta de comisión {mm(plusvaliaNeta)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}

/** "2028-9" → "septiembre 2028". Vacío si no parsea. */
function formatearEntrega(fecha?: string | null): string {
  if (!fecha) return "";
  const [y, m] = String(fecha).split("-").map((x) => Number(x));
  if (!y || !m) return "";
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${meses[m - 1] ?? ""} ${y}`.trim();
}
