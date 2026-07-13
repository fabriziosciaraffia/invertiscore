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

  // EQUITY: `equityCLP` es lo que te queda al vender (sin restar el capital). "Crítico" =
  // terminas con menos de lo que pusiste (equity < capital, ×mult < 1), coherente con la card.
  // FALLBACK de lectura: filas STR persistidas ANTES del regen F6 traen el nombre viejo
  // `gananciaNeta` (mismo valor equity desde F2); el `??` las cubre hasta que el regen las reescriba.
  const tuParte = ex.equityCLP ?? (ex as unknown as { gananciaNeta: number }).gananciaNeta;
  const capital = results.capitalInvertido;
  const bajoLoPuesto = tuParte < capital;
  const mult = ex.multiplicadorCapital;

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
          AL VENDER EN EL AÑO {ex.yearVenta}, TU PARTE ES
        </p>
        <p
          className="font-mono font-bold m-0"
          style={{
            fontSize: 28,
            color: bajoLoPuesto ? "var(--signal-red)" : "var(--franco-text)",
            lineHeight: 1,
          }}
        >
          {fmtMoney(tuParte, currency, valorUF)}
        </p>
        <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-2 m-0">
          Lo que te queda neto de deuda y comisión · TIR {fmtPct(ex.tirAnual, 1)} · ×{mult.toFixed(2).replace(".", ",")} sobre el capital de {fmtMoney(capital, currency, valorUF)}
        </p>
      </div>

      {/* Tabla breakdown — cómo se arma tu parte (equity), sin restar el capital */}
      <div>
        <Row label="Valor de venta estimado" value={fmtMoney(ex.valorVenta, currency, valorUF)} />
        <Row label="Saldo crédito al vender" value={"-" + fmtMoney(ex.saldoCreditoAlVender, currency, valorUF)} />
        <Row label="Comisión venta + cierre (2%)" value={"-" + fmtMoney(ex.gastosCierre, currency, valorUF)} />
        <Row label="Flujo acumulado a fecha" value={(ex.flujoAcumuladoAlVender >= 0 ? "+" : "") + fmtMoney(ex.flujoAcumuladoAlVender, currency, valorUF)} />
        <RowTotal
          label="Tu parte al vender"
          value={fmtMoney(tuParte, currency, valorUF)}
          isCritical={bajoLoPuesto}
        />
      </div>

      {/* Footer narrativo */}
      <p
        className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-4 pt-4 leading-[1.6]"
        style={{ borderTop: "0.5px dashed var(--franco-border)" }}
      >
        {bajoLoPuesto
          ? `Al vender terminas con menos de lo que pusiste (×${mult.toFixed(2).replace(".", ",")} sobre el capital). Para que cierre a favor, la plusvalía debe superar el supuesto del 3% anual o tu horizonte debe extenderse más allá del año ${ex.yearVenta}.`
          : `Sostener la operación ${ex.yearVenta} años deja tu parte en ${fmtMoney(tuParte, currency, valorUF)} sobre el capital de ${fmtMoney(capital, currency, valorUF)} que pusiste — ×${mult.toFixed(2).replace(".", ",")}, equivalente a una TIR anualizada del ${fmtPct(ex.tirAnual, 1)} considerando flujos + venta.`}
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
