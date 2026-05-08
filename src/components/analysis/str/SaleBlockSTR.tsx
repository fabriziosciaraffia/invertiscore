"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Sub-sección 10 · VENTA — variante STR (Patrón 7.B.4 simplificado).
 * STR no usa LTV-refi típicamente; solo escenario de venta.
 *
 * Hero KPI + tabla breakdown + footer narrativo.
 */
export function SaleBlockSTR({
  results,
  currency,
  valorUF,
}: {
  results: ShortTermResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const ex = results.exitScenario;
  if (!ex) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Sin escenario de salida disponible para este análisis.
      </p>
    );
  }

  const isCriticalGain = ex.gananciaNeta < 0;

  return (
    <div>
      {/* Hero KPI */}
      <div
        className="p-4 mb-4"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 10px 10px 0",
        }}
      >
        <p
          className="font-mono uppercase mb-2"
          style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
        >
          AL VENDER EN EL AÑO {ex.yearVenta} TE QUEDA
        </p>
        <p
          className="font-mono font-bold m-0"
          style={{
            fontSize: 28,
            color: isCriticalGain ? "var(--signal-red)" : "var(--franco-text)",
            lineHeight: 1,
          }}
        >
          {(ex.gananciaNeta >= 0 ? "+" : "") + fmtMoney(ex.gananciaNeta, currency, valorUF)}
        </p>
        <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-2 m-0">
          Ganancia neta sobre tu capital inicial · TIR {fmtPct(ex.tirAnual, 1)} · {ex.multiplicadorCapital.toFixed(2).replace(".", ",")}x del capital
        </p>
      </div>

      {/* Tabla breakdown */}
      <div>
        <Row label="Valor de venta estimado" value={fmtMoney(ex.valorVenta, currency, valorUF)} />
        <Row label="Saldo crédito al vender" value={"-" + fmtMoney(ex.saldoCreditoAlVender, currency, valorUF)} />
        <Row label="Comisión venta + cierre (2%)" value={"-" + fmtMoney(ex.gastosCierre, currency, valorUF)} />
        <Row label="Flujo acumulado a fecha" value={(ex.flujoAcumuladoAlVender >= 0 ? "+" : "") + fmtMoney(ex.flujoAcumuladoAlVender, currency, valorUF)} />
        <Row label="Capital inicial puesto" value={"-" + fmtMoney(results.capitalInvertido, currency, valorUF)} />
        <RowTotal
          label="Ganancia neta"
          value={(ex.gananciaNeta >= 0 ? "+" : "") + fmtMoney(ex.gananciaNeta, currency, valorUF)}
          isCritical={isCriticalGain}
        />
      </div>

      {/* Footer narrativo */}
      <p
        className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-4 pt-4 leading-[1.6]"
        style={{ borderTop: "0.5px dashed var(--franco-border)" }}
      >
        {isCriticalGain
          ? `La venta no recupera el capital + flujos. Para que la operación cierre, la plusvalía debe superar el supuesto del 3% anual o tu horizonte debe extenderse más allá del año ${ex.yearVenta}.`
          : `Sostener la operación ${ex.yearVenta} años convierte el capital de ${fmtMoney(results.capitalInvertido, currency, valorUF)} en una ganancia neta de ${fmtMoney(ex.gananciaNeta, currency, valorUF)} — equivalente a una TIR anualizada del ${fmtPct(ex.tirAnual, 1)} considerando flujos + venta.`}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b-[0.5px] border-[var(--franco-border)]">
      <span className="font-body text-[13px] text-[var(--franco-text)]">{label}</span>
      <span className="font-mono text-[13px] font-medium text-[var(--franco-text)]">{value}</span>
    </div>
  );
}

function RowTotal({ label, value, isCritical }: { label: string; value: string; isCritical?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-3 mt-1"
      style={{ borderTop: "0.5px solid var(--franco-text)" }}
    >
      <span className="font-body text-[14px] font-medium text-[var(--franco-text)]">{label}</span>
      <span
        className="font-mono text-[15px] font-bold"
        style={{ color: isCritical ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {value}
      </span>
    </div>
  );
}
