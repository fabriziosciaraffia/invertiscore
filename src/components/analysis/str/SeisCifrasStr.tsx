"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { metricaValorONull } from "@/lib/types";
import { CAP_STR_UMBRAL_PCT } from "@/lib/rentabilidad-str-hallazgo";
import { SeisCifras, type CifraInforme } from "@/components/analysis/shared";
import { fmtMoney } from "@/components/analysis/utils";

/**
 * "Los números" STR — seis cifras del CONGELADO, en su orden: ingreso mensual
 * estabilizado · flujo mensual · cap rate STR · TIR a 10 años · tarifa por noche ·
 * ocupación base. Con el toggle CLP/UF cambian ingreso, flujo y tarifa; cap rate, TIR y
 * ocupación no. Todo sale de `results.metrics` (T0); sin metrics (filas sin airbnbRaw)
 * cae a los escenarios persistidos, cifra por cifra.
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

  const cifras: CifraInforme[] = [
    {
      k: "Ingreso mensual estabilizado",
      v: money(ingreso),
      tr: (
        <>
          Lo que factura un mes típico con la ocupación estimada, <b>antes</b> de comisiones y costos.
        </>
      ),
    },
    {
      k: "Flujo mensual",
      v: money(flujo),
      neg: flujo < 0,
      tr:
        flujo < 0 ? (
          <>
            Lo que sale de tu bolsillo cada mes <b>después de todo</b>: comisión, costos, cuota.
          </>
        ) : (
          <>
            Lo que te queda cada mes <b>después de todo</b>: comisión, costos, cuota.
          </>
        ),
    },
    {
      k: "Cap rate STR",
      v: pct1(cap),
      tr: (
        <>
          El ingreso neto de un año (lo que queda antes de la cuota) sobre el precio. <b>La referencia para renta corta es {pct1(CAP_STR_UMBRAL_PCT)}.</b>
        </>
      ),
    },
    {
      k: "TIR a 10 años",
      v: tir != null ? pct1(tir) : "—",
      tr:
        tir == null ? (
          <>No se puede calcular: el flujo no cruza cero en el horizonte.</>
        ) : (
          <>
            Lo que rinde tu plata al año, sumando operación, aportes y venta. <b>Bajo 6%, conviene más otra inversión.</b>
          </>
        ),
    },
    {
      k: "Tarifa por noche · ADR",
      v: money(tarifa),
      tr: tarifaEsTuya ? (
        <>Lo que cobras cada noche ocupada: <b>la tarifa que tú definiste</b>, no la mediana de la zona.</>
      ) : (
        <>Lo que cobras cada noche ocupada: <b>la mediana de la zona</b>, sin ajuste.</>
      ),
    },
    {
      k: "Ocupación base",
      v: `${Math.round(occ * 100)}%`,
      tr: occEsTuya ? (
        <>Noches ocupadas sobre noches del año: <b>el supuesto que tú definiste</b>, no la estimación del mercado.</>
      ) : (
        <>Noches ocupadas sobre noches del año: <b>la que estima el mercado para este depto</b>, no un supuesto tuyo.</>
      ),
    },
  ];
  return <SeisCifras cifras={cifras} onCalculo={onCalculo} />;
}
