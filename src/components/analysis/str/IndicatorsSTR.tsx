"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import KPICard from "../KPICard";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Sub-sección 08 · INDICADORES — variante STR (Patrón 7.B.2).
 * Grid 2-3 columnas con 5 KPIs estándar STR:
 *   • NOI mensual base
 *   • CAP rate
 *   • Cash-on-Cash
 *   • Payback amoblamiento
 *   • TIR @ horizonte (de exitScenario, Ronda 4b)
 */
export function IndicatorsSTR({
  results,
  currency,
  valorUF,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const base = results.escenarios.base;
  const tir = results.exitScenario?.tirAnual ?? 0;
  const yearsExit = results.exitScenario?.yearVenta ?? 10;
  const payback = results.comparativa.paybackMeses;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      <KPICard
        label="NOI MENSUAL"
        value={fmtMoney(base.noiMensual, currency, valorUF)}
        sub="Base · antes de dividendo"
        tone={base.noiMensual < 0 ? "bad" : "neutral"}
        size="small"
        tooltip="NOI = ingreso neto operacional mensual = ingreso bruto - comisión gestión - costos operativos. Aún sin descontar dividendo."
      />
      <KPICard
        label="CAP RATE"
        value={fmtPct(base.capRate * 100, 2)}
        sub="NOI anual / precio compra"
        tone={base.capRate <= 0 ? "bad" : "neutral"}
        size="small"
        tooltip="Tasa de capitalización: rentabilidad operativa anual sobre el precio. Útil para comparar contra otras propiedades del mercado."
      />
      <KPICard
        label="CASH-ON-CASH"
        value={fmtPct(base.cashOnCash * 100, 1)}
        sub="Anual sobre capital invertido"
        tone={base.cashOnCash < 0 ? "bad" : "neutral"}
        size="small"
        tooltip="Retorno anual sobre lo que efectivamente pusiste de tu bolsillo (pie + amoblamiento + gastos cierre)."
      />
      <KPICard
        label="PAYBACK AMOBLAMIENTO"
        value={
          payback < 0
            ? "—"
            : payback === 0
              ? "N/A"
              : `${payback} m`
        }
        sub={payback < 0 ? "Sobre-renta no recupera" : payback === 0 ? "Sin amoblamiento" : "Recuperación con sobre-renta"}
        tone={payback < 0 ? "bad" : "neutral"}
        size="small"
        tooltip="Meses que tarda la sobre-renta vs LTR en pagar el costo del amoblamiento."
      />
      <KPICard
        label={`TIR @ ${yearsExit} AÑOS`}
        value={fmtPct(tir, 1)}
        sub={tir < 0 ? "Pérdida anualizada" : "Rentabilidad anualizada con venta"}
        tone={tir < 0 ? "bad" : "neutral"}
        size="small"
        tooltip="Tasa interna de retorno considerando capital inicial, flujos operacionales año a año y venta del activo al año del horizonte."
      />
    </div>
  );
}
