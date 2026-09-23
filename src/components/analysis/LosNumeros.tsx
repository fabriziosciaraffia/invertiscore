"use client";

import type { AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { SeisCifras, type CifraInforme } from "./shared/SeisCifras";
import { fmtMoney, menos } from "./utils";
import { TIR_LIMITE_PCT } from "@/lib/tir-limite";
import { capRateDisplayPct } from "@/lib/cap-rate-hallazgo";

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
  capRefBase,
  currency,
  valorUF,
  onCalculo,
}: {
  metrics: AnalysisMetrics;
  results: FullAnalysisResult;
  /** Referencia de mercado del cap rate (del hallazgo o de `getCapRefComuna`). */
  capRefPct: number | null;
  /** En qué base está la referencia: «bruta» (avisos de la comuna) va bajo el cap rate bruto;
   *  «neta» (BDO, nacional) bajo el neto. Ausente ⇒ neta (filas viejas). */
  capRefBase?: "bruta" | "neta";
  currency: "CLP" | "UF";
  valorUF: number;
  onCalculo?: () => void;
}) {
  // El signo tipográfico sale de `menos` (utils.ts). Afecta las dos celdas que
  // pueden ir en negativo —el cash on cash y la TIR—, que hasta acá
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
      // Nombre de mercado, sin cursiva, con su ⓘ (§5.7, 23-sep-2026): la glosa entre paréntesis
      // que abría esta línea se mudó al ⓘ.
      k: "Cap rate bruto",
      glosa: "capRateBruto",
      v: pct1(metrics.rentabilidadBruta),
      tr: (
        <>
          El arriendo de un año sobre el precio, <b>antes</b> de gastos.{" "}
          {capRefPct != null && capRefBase === "bruta" ? <b>Los avisos de la comuna rinden {pct1(capRefPct)}.</b> : null}
        </>
      ),
    },
    {
      k: "Cap rate neto",
      glosa: "capRateNeto",
      // LA MISMA CIFRA que lee el capítulo I: `valor.capRatePct` del hallazgo, redondeada UNA
      // vez desde el crudo. `metrics.capRate` viene redondeado a DOS decimales y formatearlo a
      // uno es redondear dos veces (2,848 → 2,85 → «2,9» acá, 2,8 en el capítulo): 55 filas
      // del parque mostraban dos cap rates en la misma página (21-sep-2026). Sin hallazgo
      // (filas sin ingreso), el crudo redondeado una vez.
      v: pct1(metrics.hallazgoCapRate?.valor.capRatePct ?? capRateDisplayPct(metrics.capRate)),
      tr: (
        <>
          Lo mismo, ya descontados los gastos.{" "}
          {capRefPct != null && capRefBase !== "bruta" ? <b>La referencia de mercado es {pct1(capRefPct)}.</b> : null}
        </>
      ),
    },
    {
      // «Retorno sobre lo puesto» salió (decisión de Fabrizio, 23-sep-2026): el indicador va con
      // su nombre de mercado y el ⓘ lo explica.
      k: "Cash on cash",
      glosa: "cashOnCash",
      v: coc != null ? pct1(coc) : "—",
      neg: coc != null && coc < 0,
      tr:
        coc == null ? (
          <>Sin pie no hay capital propio sobre el que medirlo.</>
        ) : coc < 0 ? (
          <>
            Por cada $100 que pusiste, <b>este año pones ${Math.abs(coc).toFixed(2).replace(".", ",")} más</b> en vez de recibir.
          </>
        ) : (
          <>
            Por cada $100 que pusiste, <b>este año recibes ${coc.toFixed(2).replace(".", ",")}</b> de vuelta.
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
      glosa: "cobertura",
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
      glosa: "tir",
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
