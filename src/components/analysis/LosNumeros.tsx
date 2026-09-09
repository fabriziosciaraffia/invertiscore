"use client";

import { Ang } from "./shared/Ang";
import type { AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { SeisCifras, type CifraInforme } from "./shared/SeisCifras";
import { fmtMoney, menos } from "./utils";
import { TIR_LIMITE_PCT } from "@/lib/tir-limite";

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
  // El signo tipográfico sale de `menos` (utils.ts). Afecta las dos celdas que
  // pueden ir en negativo —«Retorno sobre lo puesto» y la TIR—, que hasta acá
  // imprimían el guion ASCII al lado de las filas de hallazgo, ya con «−».
  const pct1 = (n: number) => `${menos(n.toFixed(1).replace(".", ","))}%`;
  const coc = metricaValorONull(metrics.cashOnCash);
  const tir = metricaValorONull(results.exitScenario?.tir);
  const anios = results.exitScenario?.anios ?? 10;
  const flujo = metrics.flujoNetoMensual;
  const cobertura = metrics.dividendo > 0 ? metrics.ingresoMensual / metrics.dividendo : null;
  const coberturaPct = cobertura != null ? Math.round((cobertura - 1) * 100) : null;
  const fmtSigned = (n: number) => `${n < 0 ? "−" : ""}${fmtMoney(Math.abs(n), currency, valorUF)}`;

  const cifras: CifraInforme[] = [
    {
      k: <><Ang>Cap rate</Ang> bruto</>,
      v: pct1(metrics.rentabilidadBruta),
      tr: (
        <>
          <Ang>Cap rate</Ang> (lo que renta al año sobre el precio): el arriendo de un año, <b>antes</b> de gastos.
        </>
      ),
    },
    {
      k: <><Ang>Cap rate</Ang> neto</>,
      v: pct1(metrics.capRate),
      tr: (
        <>
          Lo mismo, ya descontados los gastos.{" "}
          {capRefPct != null ? <b>La referencia de mercado es {pct1(capRefPct)}.</b> : null}
        </>
      ),
    },
    {
      // §5.7: el rótulo en español, de una línea; el anglicismo en cursiva abre la glosa.
      k: "Retorno sobre lo puesto",
      v: coc != null ? pct1(coc) : "—",
      neg: coc != null && coc < 0,
      tr:
        coc == null ? (
          <>Sin pie no hay capital propio sobre el que medirlo.</>
        ) : coc < 0 ? (
          <>
            <Ang>Cash-on-cash</Ang>: por cada $100 que pusiste, <b>este año pones ${Math.abs(coc).toFixed(2).replace(".", ",")} más</b> en vez de recibir.
          </>
        ) : (
          <>
            <Ang>Cash-on-cash</Ang>: por cada $100 que pusiste, <b>este año recibes ${coc.toFixed(2).replace(".", ",")}</b> de vuelta.
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
      // El múltiplo Y su porcentaje. No es dato nuevo: es el mismo número en la unidad
      // que se entiende sin pensar. Medido sobre 30 generaciones v21, la prosa traducía
      // «0,71×» a «cubre el 71% de la cuota» en 8 de ellas — gastaba palabras en una
      // conversión que la celda puede hacer sola. Ojo con el sufijo del tooltip, que
      // dice otra cosa: `coberturaPct` es el SOBRANTE (cobertura − 1), no la cobertura.
      v:
        cobertura != null ? (
          <>
            {cobertura.toFixed(2).replace(".", ",")}
            <small>× · {Math.round(cobertura * 100)}%</small>
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
            Lo que rinde tu plata al año, sumando arriendo, aportes y venta.{" "}
            <b>Bajo {TIR_LIMITE_PCT}%, conviene más otra inversión.</b>
          </>
        ),
    },
  ];

  return <SeisCifras cifras={cifras} onCalculo={onCalculo} />;
}
