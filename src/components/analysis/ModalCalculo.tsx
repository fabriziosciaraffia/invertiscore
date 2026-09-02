"use client";

import type { AnalisisInput, AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { Modal } from "./hallazgos/vocabulario";

/**
 * "VER CÓMO SE CALCULA" — contrato CONGELADO 02-sep-2026 (T2).
 *
 * La planilla detrás de cada cifra de "Los números", para el lector calificado.
 * Modal con tres bloques apilados, todos DETERMINISTAS desde `projections` y
 * `metrics` (cero prosa):
 *   (a) Flujo por año — tabla desde el desglose anual que emite calcProjections
 *       (T1). El NOI es el del motor (excluye vacancia, corretaje y recambio, que
 *       van en su propia columna): así el NOI cuadra con el cap rate neto y el
 *       flujo con el del informe. Filas de pre-entrega marcadas.
 *   (b) Indicadores — fórmula en palabras · valores sustituidos · resultado.
 *       Con el año base (arriendo y gastos de hoy), que es lo que muestran las
 *       celdas.
 *   (c) Escenario de salida — valor año N → − saldo → − comisión → = tu parte, y
 *       la composición firme (pie + amortización) / proyectado (plusvalía neta).
 *
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

  return (
    <Modal
      abierto={abierto}
      onClose={onClose}
      titulo="Cómo se calcula"
      sub="La planilla detrás de cada cifra: el flujo año a año, los indicadores con sus valores sustituidos y el escenario de salida."
      pie={
        <>
          Motor Franco · UF {Math.round(valorUF).toLocaleString("es-CL")}
          {capRef ? ` · cap rate de referencia: ${capRef.fuente}` : ""}
        </>
      }
    >
      {/* (a) flujo por año */}
      <div className="m-block">
        <div className="bt">a · Flujo por año</div>
        <div className="bq">
          {preEntregaAnios > 0
            ? `Los primeros ${preEntregaAnios === 1 ? "año no hay" : `${preEntregaAnios} años no hay`} flujo: el depto se entrega${entregaTexto ? ` en ${entregaTexto}` : " después"}.`
            : "Cada año con el arriendo y los gastos reajustados."}
        </div>
        {conDesglose ? (
          <>
            <div className="m-tblwrap">
              <table className="calc-tbl">
                <thead>
                  <tr>
                    <th>Año</th>
                    <th>Arriendo</th>
                    <th>Gastos op.</th>
                    <th>NOI</th>
                    <th>Vac. y rotación</th>
                    <th>Dividendo</th>
                    <th>Flujo neto</th>
                    <th>Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((p) => {
                    const pre = (p.mesesOperativos ?? 12) === 0;
                    const ent = preEntregaAnios > 0 && p.anio === preEntregaAnios;
                    return (
                      <tr key={p.anio} className={`${pre ? "pre" : ""}${ent ? " ent" : ""}`}>
                        <td>
                          {p.anio}
                          {pre ? (ent ? " · entrega" : " · construcción") : ""}
                        </td>
                        <td>{pre ? "—" : num(p.arriendoAnual ?? 0)}</td>
                        <td>{pre ? "—" : num(-(p.gastosOperativosAnual ?? 0))}</td>
                        <td>{pre ? "—" : num(p.noiAnual ?? 0)}</td>
                        <td>{pre ? "—" : num(-(p.vacanciaRotacionAnual ?? 0))}</td>
                        <td>{pre ? "—" : num(-(p.dividendoAnual ?? 0))}</td>
                        <td className={p.flujoAnual < 0 ? "neg" : ""}>{num(p.flujoAnual)}</td>
                        <td className={p.flujoAcumulado < 0 ? "neg" : ""}>{num(p.flujoAcumulado)}</td>
                      </tr>
                    );
                  })}
                  <tr className="tot">
                    <td>Total {anios} años</td>
                    <td>{num(tot("arriendoAnual"))}</td>
                    <td>{num(-tot("gastosOperativosAnual"))}</td>
                    <td>{num(tot("noiAnual"))}</td>
                    <td>{num(-tot("vacanciaRotacionAnual"))}</td>
                    <td>{num(-tot("dividendoAnual"))}</td>
                    <td className={tot("flujoAnual") < 0 ? "neg" : ""}>{num(tot("flujoAnual"))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="m-scrollcue">↔ desliza la tabla</div>
            <div className="v-fuente">
              Arriendo reajustado 3,5% al año · gastos y dividendo 3% al año · gastos operativos = gastos comunes en vacancia +
              contribuciones + mantención · vacancia y rotación = 0,6 mes de arriendo + corretaje y recambio
            </div>
          </>
        ) : (
          <div className="v-fuente">Este análisis no trae el desglose anual (se calcula desde el motor en los análisis nuevos).</div>
        )}
      </div>

      {/* (b) indicadores */}
      <div className="m-block">
        <div className="bt">b · Indicadores</div>
        <div className="bq">Con el arriendo y los gastos de hoy, año base.</div>
        <table className="ind-tbl">
          <tbody>
            <tr>
              <td>Cap rate bruto</td>
              <td>Arriendo anual ÷ precio</td>
              <td>
                {clp(arriendoAnual)} ÷ {clp(precio)}
              </td>
              <td>{pct2(metrics.rentabilidadBruta)}</td>
            </tr>
            <tr>
              <td>Cap rate neto</td>
              <td>NOI anual ÷ precio</td>
              <td>
                {clp(noiAnual)} ÷ {clp(precio)}
              </td>
              <td>{pct2(metrics.capRate)}</td>
            </tr>
            <tr>
              <td>Cash-on-cash</td>
              <td>Flujo anual ÷ capital aportado</td>
              <td>{coc != null ? `${clp(flujoAnual0)} ÷ ${clp(capital)}` : "sin pie: no aplica"}</td>
              <td className={coc != null && coc < 0 ? "neg" : ""}>{coc != null ? pct2(coc) : "—"}</td>
            </tr>
            <tr>
              <td>Cobertura de cuota</td>
              <td>Arriendo mensual ÷ dividendo</td>
              <td>{cobertura != null ? `${clp(metrics.ingresoMensual)} ÷ ${clp(metrics.dividendo)}` : "sin crédito"}</td>
              <td>{cobertura != null ? `${cobertura.toFixed(2).replace(".", ",")}×` : "—"}</td>
            </tr>
            <tr>
              <td>TIR a {anios} años</td>
              <td>Tasa que iguala lo que pones con lo que recibes</td>
              <td>
                {exit
                  ? `−${mm(capital)} hoy · ${exit.flujoAcumulado < 0 ? "−" : "+"}${mm(Math.abs(exit.flujoAcumulado))} en ${anios - preEntregaAnios} años · +${mm(equity)} el año ${anios}`
                  : "—"}
              </td>
              <td>{tir != null ? pct2(tir) : "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="v-fuente">
          Capital aportado = pie {clp(metrics.pieCLP)} + gastos de compra {clp(Math.max(capital - metrics.pieCLP, 0))} · NOI = arriendo − gastos comunes
          en vacancia − contribuciones − mantención
        </div>
      </div>

      {/* (c) salida */}
      {exit && (
        <div className="m-block">
          <div className="bt">c · Escenario de salida</div>
          <div className="bq">Venta en el año {anios}.</div>
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
        </div>
      )}
    </Modal>
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
