"use client";

import type { AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { SeisCifras, type CifraInforme } from "./shared/SeisCifras";
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
 *
 * Goal "LTR hereda" (05-sep-2026): las celdas son datos (`CifraInforme[]`) sobre la
 * misma pieza `SeisCifras` que STR; el toggle CLP/UF es el de la portada y llega en
 * `currency`. Mismos textos y mismas cifras que el JSX fijo anterior.
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

  const cifras: CifraInforme[] = [
    {
      k: "Cap rate bruto",
      v: pct1(metrics.rentabilidadBruta),
      tr: (
        <>
          El arriendo de un año sobre el precio, <b>antes</b> de gastos.
        </>
      ),
    },
    {
      k: "Cap rate neto",
      v: pct1(metrics.capRate),
      tr: (
        <>
          Lo mismo, ya descontados los gastos.{" "}
          {capRefPct != null ? <b>La referencia de mercado es {pct1(capRefPct)}.</b> : null}
        </>
      ),
    },
    {
      // §5.7: anglicismo en cursiva, con el nombre en español primero (tabla) y glosa en la línea.
      k: (
        <>
          Retorno sobre lo puesto (<em className="ang">cash-on-cash</em>)
        </>
      ),
      v: coc != null ? pct1(coc) : "—",
      neg: coc != null && coc < 0,
      tr:
        coc == null ? (
          <>Sin pie no hay capital propio sobre el que medirlo.</>
        ) : coc < 0 ? (
          <>
            Lo que rinde este año la plata que pusiste. Por cada $100, <b>este año pones ${Math.abs(coc).toFixed(2).replace(".", ",")} más</b> en vez de recibir.
          </>
        ) : (
          <>
            Lo que rinde este año la plata que pusiste. Por cada $100, <b>este año recibes ${coc.toFixed(2).replace(".", ",")}</b> de vuelta.
          </>
        ),
    },
    {
      k: "Flujo mensual",
      v: fmtSigned(flujo),
      neg: flujo < 0,
      tr:
        flujo < 0 ? (
          <>
            Lo que sale de tu bolsillo cada mes, <b>después de todo</b>: dividendo, gastos y vacancia.
          </>
        ) : (
          <>
            Lo que te queda cada mes, <b>después de todo</b>: dividendo, gastos y vacancia.
          </>
        ),
    },
    {
      k: "Cobertura de cuota",
      v:
        cobertura != null ? (
          <>
            {cobertura.toFixed(2).replace(".", ",")}
            <small>×</small>
          </>
        ) : (
          "—"
        ),
      tr:
        cobertura == null ? (
          <>Compra al contado: no hay cuota que cubrir.</>
        ) : coberturaPct != null && coberturaPct >= 0 ? (
          <>
            El arriendo paga el dividendo y <b>sobra un {coberturaPct}%</b> — antes de gastos.
          </>
        ) : (
          <>
            El arriendo <b>no alcanza a pagar el dividendo</b>: falta un {Math.abs(coberturaPct ?? 0)}% — antes de gastos.
          </>
        ),
    },
    {
      k: `TIR a ${anios} años`,
      v: tir != null ? pct1(tir) : "—",
      tr:
        tir == null ? (
          <>No se puede calcular: el flujo no cruza cero en el horizonte.</>
        ) : (
          <>
            Lo que rinde tu plata al año, sumando arriendo, aportes y venta. <b>Bajo 6%, conviene más otra inversión.</b>
          </>
        ),
    },
  ];

  return <SeisCifras cifras={cifras} onCalculo={onCalculo} />;
}
