"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { InfoTooltip } from "@/components/ui/tooltip";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Sub-sección 08 · INDICADORES — variante STR (Patrón 7.B.2).
 *
 * str-paridad2: adopta el wrapper-card + molde de celda del canon LTR
 * (`Indicators.tsx`) — card recesiva (bg 3%, border 0.5px, radius 12) con celdas
 * `label mono 9px + InfoTooltip · valor mono bold 24px`. Conserva el SET de
 * métricas STR (NOI · CAP · CoC · Recuperación amoblamiento · TIR) — divergencia
 * intrínseca legítima vs LTR (que tiene Múltiplo y separa Cap Rate como fila fija).
 * SIN el rótulo "reaccionan a los sliders" del canon: STR no tiene sliders (todo
 * es estático) — mostrarlo prometería interacción inexistente.
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
  // TIR proviene de exitScenario (Ronda 4b). Análisis pre-4b no lo tienen
  // persistido — render con "—" en lugar de 0 (que confunde con "TIR real = 0%").
  const exit = results.exitScenario;
  const hasTir = !!exit && Number.isFinite(exit.tirAnual) && exit.tirAnual !== 0;
  const tirValue = exit?.tirAnual ?? 0;
  const yearsExit = exit?.yearVenta ?? 10;
  const payback = results.comparativa.paybackMeses;

  const cells: Array<{ label: string; value: string; tone: "bad" | "neutral"; tooltip: string }> = [
    {
      label: "NOI MENSUAL",
      value: fmtMoney(base.noiMensual, currency, valorUF),
      tone: base.noiMensual < 0 ? "bad" : "neutral",
      tooltip: "NOI = ingreso neto operativo mensual = ingreso bruto - comisión gestión - costos operativos. Aún sin descontar la cuota del crédito.",
    },
    {
      label: "CAP RATE",
      value: fmtPct(base.capRate * 100, 2),
      tone: base.capRate <= 0 ? "bad" : "neutral",
      tooltip: "Tasa de capitalización: rentabilidad operativa anual sobre el precio. Útil para comparar contra otras propiedades del mercado.",
    },
    {
      label: "CASH-ON-CASH",
      value: fmtPct(base.cashOnCash * 100, 1),
      tone: base.cashOnCash < 0 ? "bad" : "neutral",
      tooltip: "Retorno anual sobre lo que efectivamente pusiste de tu bolsillo (pie + amoblamiento + gastos de cierre + puesta a punto).",
    },
    {
      label: "RECUPERACIÓN AMOBLAMIENTO",
      value: payback < 0 ? "—" : payback === 0 ? "N/A" : `${payback} m`,
      tone: payback < 0 ? "bad" : "neutral",
      tooltip: "Meses que tarda la sobre-renta vs LTR en pagar el costo del amoblamiento.",
    },
    {
      label: `TIR a ${yearsExit} AÑOS`,
      value: hasTir ? fmtPct(tirValue, 1) : "—",
      tone: !hasTir ? "neutral" : tirValue < 0 ? "bad" : "neutral",
      tooltip: "Tasa interna de retorno considerando capital inicial, flujos operativos año a año y venta del activo al año del horizonte.",
    },
  ];

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-5">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col min-w-0">
            <span
              className="inline-flex items-center gap-1 font-mono uppercase"
              style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--franco-text-tertiary)" }}
            >
              <span>{c.label}</span>
              <InfoTooltip content={c.tooltip} />
            </span>
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{
                fontSize: 24,
                lineHeight: 1,
                marginTop: 7,
                color: c.tone === "bad" ? "var(--signal-red)" : "var(--franco-text)",
              }}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
