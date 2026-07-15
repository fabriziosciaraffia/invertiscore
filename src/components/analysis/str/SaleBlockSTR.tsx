"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtMoney } from "../utils";

/**
 * Sub-sección 10 · VENTA — variante STR (Patrón 7.B.4 simplificado).
 *
 * str-paridad2: adopta el molde del pane "Si vendes" del canon LTR
 * (`SaleRefiBlock.tsx`) — hero border-left + tabla de desglose COLOREADA
 * (positivos Ink, negativos Signal Red) con fila total "= Tu parte" + badge
 * "Ganancia neta ±(%) vs inversión total". SIN toggle ni pane refi: el
 * refinanciamiento es intrínsecamente ausente en STR (no se refinancia una
 * operación de renta corta). La criticidad (equity < capital) vive en el badge,
 * como en LTR, no en el color del hero.
 *
 * Diferencia de datos vs LTR: la tabla incluye "+ Flujo acumulado a fecha" —
 * el equity STR suma los flujos operativos del período (equityCLP = valorVenta −
 * saldo − cierre + flujoAcumulado), a diferencia del "te queda" LTR (solo venta).
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

  // EQUITY: `equityCLP` es lo que te queda al vender (neto de deuda y comisión, más
  // flujos). FALLBACK de lectura: filas STR persistidas pre-regen F6 traen el nombre
  // viejo `gananciaNeta` (mismo valor equity desde F2); el `??` las cubre.
  // "Tu parte" = EQUITY al liquidar (valor − deuda − comisión), SIN flujo — homologado al
  // canon LTR (SaleRefiBlock: `teQueda`). El flujo operativo NO suma acá: ya lo recibiste
  // durante los años y se muestra como fila informativa aparte + retorno total.
  const tuParte = ex.equityCLP ?? (ex as unknown as { gananciaNeta: number }).gananciaNeta;
  // Base de la ganancia = total aportado (inicial + aportes mensuales negativos), MISMA base
  // que el canon LTR (`aporteAcum`). Fallback a capitalInvertido para filas pre-recompute.
  const capital = ex.totalAportado ?? results.capitalInvertido;
  const gananciaNeta = tuParte - capital;
  const gananciaPct = capital > 0 ? (gananciaNeta / capital) * 100 : 0;
  const flujo = ex.flujoAcumuladoAlVender;
  const retornoTotal = ex.retornoTotal ?? (tuParte + flujo);
  const fmt = (n: number) => fmtMoney(n, currency, valorUF);

  // La tabla SUMA solo hacia el equity: valor − deuda − comisión = tu parte. El flujo va aparte.
  const rows: Array<{ label: string; value: number; color: string; sign: "+" | "−" }> = [
    { label: "Valor de venta estimado", value: ex.valorVenta, color: "var(--franco-text)", sign: "+" },
    { label: "− Saldo crédito al vender", value: ex.saldoCreditoAlVender, color: "var(--signal-red)", sign: "−" },
    { label: "− Comisión venta + cierre (2%)", value: ex.gastosCierre, color: "var(--signal-red)", sign: "−" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Hero venta — Ink secundario per skill 7.B.4 (paridad SaleRefiBlock) */}
      <div
        style={{
          background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
        }}
      >
        <p
          className="font-mono uppercase m-0 mb-1"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
        >
          Al vender en el año {ex.yearVenta}, tu parte es
        </p>
        <p
          className="font-mono font-bold m-0 whitespace-nowrap"
          style={{ fontSize: 28, color: "var(--franco-text)", lineHeight: 1 }}
        >
          {fmt(tuParte)}
        </p>
      </div>

      {/* Tabla desglose coloreada (molde canon venta) */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
        }}
      >
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between px-4 py-2.5"
            style={{
              borderTop: i === 0 ? "none" : "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
            }}
          >
            <span className="font-body" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)" }}>
              {row.label}
            </span>
            <span className="font-mono font-semibold whitespace-nowrap" style={{ fontSize: 13, color: row.color }}>
              {row.sign}{fmt(row.value)}
            </span>
          </div>
        ))}
        <div
          className="flex items-baseline justify-between px-4 py-3"
          style={{
            borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 20%, transparent)",
            background: "color-mix(in srgb, var(--ink-400) 5%, transparent)",
          }}
        >
          <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}>
            = Tu parte
          </span>
          <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 16, color: "var(--franco-text)" }}>
            {fmt(tuParte)}
          </span>
        </div>
      </div>

      {/* Flujo operativo acumulado — APARTE del equity (ya lo recibiste durante los años,
          NO suma a "tu parte"). Junto al equity forma el retorno total. Homologación LTR. */}
      <div
        className="rounded-lg px-4 py-3 flex flex-col gap-1.5"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
        }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-body" style={{ fontSize: 12, color: "color-mix(in srgb, var(--franco-text) 70%, transparent)" }}>
            Flujo operativo acumulado <span style={{ fontSize: 11, color: "var(--franco-text-secondary)" }}>(ya recibido, aparte)</span>
          </span>
          <span className="font-mono font-semibold whitespace-nowrap" style={{ fontSize: 13, color: flujo >= 0 ? "var(--franco-text)" : "var(--signal-red)" }}>
            {flujo >= 0 ? "+" : "−"}{fmt(Math.abs(flujo))}
          </span>
        </div>
        <div className="flex items-baseline justify-between" style={{ borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 12%, transparent)", paddingTop: 6 }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}>
            Retorno total (tu parte + flujo)
          </span>
          <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 13, color: "var(--franco-text)" }}>
            {fmt(retornoTotal)}
          </span>
        </div>
      </div>

      {/* Badge ganancia neta (molde canon) */}
      <div
        className="rounded-lg p-3"
        style={{
          background: `color-mix(in srgb, ${gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 10%, transparent)`,
          border: `0.5px solid color-mix(in srgb, ${gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 30%, transparent)`,
        }}
      >
        <p className="font-body m-0" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 80%, transparent)" }}>
          Ganancia neta{" "}
          <span
            className="font-mono font-bold"
            style={{ color: gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)" }}
          >
            {gananciaNeta >= 0 ? "+" : "−"}{fmt(Math.abs(gananciaNeta))}
          </span>{" "}
          ({gananciaNeta >= 0 ? "+" : "−"}{Math.round(Math.abs(gananciaPct))}%) vs inversión total de{" "}
          <span className="font-mono" style={{ color: "var(--franco-text)" }}>
            {fmt(capital)}
          </span>
        </p>
      </div>
    </div>
  );
}
