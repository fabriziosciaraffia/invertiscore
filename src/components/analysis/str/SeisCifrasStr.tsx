"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { metricaValorONull } from "@/lib/types";
import { referenciaCapRateStr } from "@/lib/rentabilidad-str-hallazgo";
import { SeisCifras, type CifraInforme } from "@/components/analysis/shared";
import { fmtMoney } from "@/components/analysis/utils";
import { TIR_LIMITE_PCT } from "@/lib/tir-limite";

/**
 * "Los números" STR — seis cifras del CONGELADO, en su orden: ingreso mensual
 * estabilizado · flujo mensual · cap rate STR · TIR a 10 años · tarifa por noche ·
 * ocupación base. Con el toggle CLP/UF cambian ingreso, flujo y tarifa; cap rate, TIR y
 * ocupación no. Todo sale de `results.metrics` (T0); sin metrics (filas sin airbnbRaw)
 * cae a los escenarios persistidos, cifra por cifra.
 *
 * CON EL REDISEÑO (contrato §6 · bloque A, 11-sep-2026) el orden cambia y se declara:
 * tarifa y ocupación PRIMERO, destacadas con contorno, y la línea «Las dos primeras son
 * el supuesto del que cuelga todo lo demás» encima. En renta corta el ingreso no es un
 * dato, es una estimación, y eso se dice antes de mostrar lo que cuelga de ella:
 * ingreso, flujo, cap rate y TIR. Mismas seis cifras, misma fuente; lo que cambia es qué se
 * lee primero.
 *
 * EL CAP RATE (23-sep-2026): se llama «Cap rate», sin «por día» —es anual— y con su ⓘ; y lee
 * la MISMA referencia que el capítulo I (`referenciaCapRateStr`, lo que proyectan los Airbnb de
 * la zona), no la constante de 5%: eran dos referencias distintas para la misma cifra en la
 * misma página.
 */
export function SeisCifrasStr({
  results,
  currency,
  valorUF,
  onCalculo,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
  onCalculo?: () => void;
}) {
  const m = results.metrics;
  const base = results.escenarios.base;
  const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
  const money = (n: number) => `${n < 0 ? "−" : ""}${fmtMoney(Math.abs(n), currency, valorUF)}`;
  const ingreso = m?.ingresoEstabilizadoMensual ?? base.ingresoBrutoMensual;
  const flujo = m?.flujoMensual ?? base.flujoCajaMensual;
  const cap = m?.capRatePct ?? base.capRate * 100;
  const tir = m?.tirPct ?? (results.exitScenario ? metricaValorONull(results.exitScenario.tirAnual) : null);
  const tarifa = m?.tarifaNoche ?? results.ejesAplicados?.adrFinal ?? base.adrReferencia;
  const occ = m?.ocupacion ?? results.ejesAplicados?.ocupacionFinal ?? base.ocupacionReferencia;
  const tarifaEsTuya = results.adrFuente === "override";
  const occEsTuya = results.occFuente === "override";
  const ref = referenciaCapRateStr(results.hallazgos);

  const trFlujo =
    flujo < 0 ? (
      <>
        Lo que sale de tu bolsillo cada mes <b>después de todo</b>: comisión, costos, cuota.
      </>
    ) : (
      <>
        Lo que te queda cada mes <b>después de todo</b>: comisión, costos, cuota.
      </>
    );
  const trTir =
    tir == null ? (
      <>No se puede calcular: el flujo no cruza cero en el horizonte.</>
    ) : (
      <>
        Lo que rinde tu plata al año con operación, aportes y venta. <b>Bajo {TIR_LIMITE_PCT}%, conviene otra inversión.</b>
      </>
    );

  const cifras: CifraInforme[] = [
        {
          k: "Tarifa por noche",
          v: money(tarifa),
          destacada: true,
          tr: tarifaEsTuya ? (
            <>Lo que cobras cada noche ocupada. <b>La tarifa que tú definiste</b>, no la mediana de la zona.</>
          ) : (
            <>Lo que cobras cada noche ocupada. <b>La mediana de la zona</b>, sin ajuste.</>
          ),
        },
        {
          k: "Ocupación",
          v: `${Math.round(occ * 100)}%`,
          destacada: true,
          tr: occEsTuya ? (
            <>Noches ocupadas sobre el año. <b>El supuesto que tú definiste</b>, no la estimación del mercado.</>
          ) : (
            <>Noches ocupadas sobre el año. <b>La que estima el mercado</b> para este depto, no un supuesto tuyo.</>
          ),
        },
        {
          k: "Ingreso mensual",
          v: money(ingreso),
          tr: (
            <>
              Lo que factura un mes típico con esa ocupación, <b>antes</b> de comisiones y costos.
            </>
          ),
        },
        { k: "Flujo mensual", v: money(flujo), neg: flujo < 0, tr: trFlujo },
        {
          k: "Cap rate",
          glosa: "capRateStr",
          v: pct1(cap),
          neg: ref.hayRef && cap < ref.pct,
          tr: ref.hayRef ? (
            <>
              El ingreso neto de un año sobre el precio. <b>La referencia de la zona es {pct1(ref.pct)}.</b>
            </>
          ) : (
            <>El ingreso neto de un año sobre el precio. No hay Airbnb suficientes de la zona para compararlo.</>
          ),
        },
        { k: "TIR a 10 años", glosa: "tir", v: tir != null ? pct1(tir) : "—", tr: trTir },
      ];
  return (
    <SeisCifras
      cifras={cifras}
      onCalculo={onCalculo}
      encabezado="Las dos primeras son el supuesto del que cuelga todo lo demás."
    />
  );
}
