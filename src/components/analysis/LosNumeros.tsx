"use client";

import type { AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { fmtMoney } from "./utils";

/**
 * LOS NÚMEROS — contrato CONGELADO 02-sep-2026 (T2).
 *
 * Seis celdas, siempre las mismas en todos los informes: cap rate bruto, cap rate
 * neto, cash-on-cash, flujo mensual, cobertura de cuota y TIR a 10 años, cada una
 * con su traducción de una línea. Es la tabla que un inversionista que sabe busca
 * primero — para comparar este departamento con otro, o con lo que rinde su plata
 * en otra parte. Seis es el techo.
 *
 * Todo sale de `metrics` y del exit del recompute; ningún cálculo nuevo salvo la
 * cobertura (arriendo ÷ dividendo, el DSCR que mira el banco). Los "no aplica"
 * del motor (pie 0, TIR no calculable) se muestran como tales, nunca se rellenan.
 * Cierra con el enlace al modal "Ver cómo se calcula".
 */
export function LosNumeros({
  metrics,
  results,
  capRefPct,
  currency,
  valorUF,
  onCalculo,
}: {
  metrics: AnalysisMetrics;
  results: FullAnalysisResult;
  /** Referencia de mercado del cap rate neto (del hallazgo o de `getCapRefComuna`). */
  capRefPct: number | null;
  currency: "CLP" | "UF";
  valorUF: number;
  onCalculo?: () => void;
}) {
  const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
  const coc = metricaValorONull(metrics.cashOnCash);
  const tir = metricaValorONull(results.exitScenario?.tir);
  const anios = results.exitScenario?.anios ?? 10;
  const flujo = metrics.flujoNetoMensual;
  const cobertura = metrics.dividendo > 0 ? metrics.ingresoMensual / metrics.dividendo : null;
  const coberturaPct = cobertura != null ? Math.round((cobertura - 1) * 100) : null;
  const fmtSigned = (n: number) => `${n < 0 ? "−" : ""}${fmtMoney(Math.abs(n), currency, valorUF)}`;

  return (
    <div className="nums-wrap">
      <div className="nums">
        <div className="num-cell">
          <div className="k">Cap rate bruto</div>
          <div className="v">{pct1(metrics.rentabilidadBruta)}</div>
          <div className="tr">
            El arriendo de un año sobre el precio, <b>antes</b> de gastos.
          </div>
        </div>
        <div className="num-cell">
          <div className="k">Cap rate neto</div>
          <div className="v">{pct1(metrics.capRate)}</div>
          <div className="tr">
            Lo mismo, ya descontados los gastos.{" "}
            {capRefPct != null ? <b>La referencia de mercado es {pct1(capRefPct)}.</b> : null}
          </div>
        </div>
        <div className="num-cell">
          <div className="k">Cash-on-cash</div>
          <div className={`v${coc != null && coc < 0 ? " neg" : ""}`}>{coc != null ? pct1(coc) : "—"}</div>
          <div className="tr">
            {coc == null ? (
              <>Sin pie no hay capital propio sobre el que medirlo.</>
            ) : coc < 0 ? (
              <>
                Por cada $100 que pusiste, <b>este año pones ${Math.abs(coc).toFixed(2).replace(".", ",")} más</b> en vez de recibir.
              </>
            ) : (
              <>
                Por cada $100 que pusiste, <b>este año recibes ${coc.toFixed(2).replace(".", ",")}</b> de vuelta.
              </>
            )}
          </div>
        </div>
        <div className="num-cell">
          <div className="k">Flujo mensual</div>
          <div className={`v${flujo < 0 ? " neg" : ""}`}>{fmtSigned(flujo)}</div>
          <div className="tr">
            {flujo < 0 ? (
              <>
                Lo que sale de tu bolsillo cada mes, <b>después de todo</b>: dividendo, gastos y vacancia.
              </>
            ) : (
              <>
                Lo que te queda cada mes, <b>después de todo</b>: dividendo, gastos y vacancia.
              </>
            )}
          </div>
        </div>
        <div className="num-cell">
          <div className="k">Cobertura de cuota</div>
          <div className="v">
            {cobertura != null ? (
              <>
                {cobertura.toFixed(2).replace(".", ",")}
                <small>×</small>
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="tr">
            {cobertura == null ? (
              <>Compra al contado: no hay cuota que cubrir.</>
            ) : coberturaPct != null && coberturaPct >= 0 ? (
              <>
                El arriendo paga el dividendo y <b>sobra un {coberturaPct}%</b> — antes de gastos.
              </>
            ) : (
              <>
                El arriendo <b>no alcanza a pagar el dividendo</b>: falta un {Math.abs(coberturaPct ?? 0)}% — antes de gastos.
              </>
            )}
          </div>
        </div>
        <div className="num-cell">
          <div className="k">TIR a {anios} años</div>
          <div className="v">{tir != null ? pct1(tir) : "—"}</div>
          <div className="tr">
            {tir == null ? (
              <>No se puede calcular: el flujo no cruza cero en el horizonte.</>
            ) : (
              <>
                Lo que rinde tu plata al año, sumando arriendo, aportes y venta. <b>Bajo 6%, conviene más otra inversión.</b>
              </>
            )}
          </div>
        </div>
      </div>
      {onCalculo && (
        <div className="nums-foot">
          <button type="button" className="doc-lnk" onClick={onCalculo}>
            Ver cómo se calcula →
          </button>
        </div>
      )}
    </div>
  );
}
