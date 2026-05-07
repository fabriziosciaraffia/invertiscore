"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { InfoTooltip } from "@/components/ui/tooltip";
import { useSimulation } from "@/contexts/SimulationContext";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";
import { fmtMoney } from "./utils";

/**
 * Sub-sección 10 · VENTA O REFINANCIAMIENTO (Patrón 7.B.4 Sale/Refi Block).
 * Tabs Si vendes / Si refinancias. Hero KPI + tabla breakdown + footer
 * narrativo. Selector LTV (60/70/75%) en tab refinanciar.
 *
 * Bloquea cuando `plazoAnios * 12 ≤ mesesPreEntrega` (entrega futura): no
 * puedes vender ni refinanciar antes de la escritura.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.2).
 */
export function SaleRefiBlock({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { plazoAnios } = useSimulation();
  const [mode, setMode] = useState<"venta" | "refi">("venta");
  const [ltv, setLtv] = useState<0.60 | 0.70 | 0.75>(0.70);

  const data = useMemo(() => {
    const pieCLP = metrics.pieCLP ?? 0;
    const precioCLP = metrics.precioCLP ?? 0;
    const inversionInicial = pieCLP + Math.round(precioCLP * 0.02);

    const lastProy = projections[Math.min(plazoAnios, projections.length) - 1];
    if (!lastProy) {
      return null;
    }
    const valorDepto = lastProy.valorPropiedad;
    const deudaPendiente = lastProy.saldoCredito;
    const flujoAcumulado = lastProy.flujoAcumulado;
    const aporteAcum = inversionInicial + Math.abs(Math.min(0, flujoAcumulado));

    // Venta (sin notaría — ya no se resta)
    const comisionVenta = Math.round(valorDepto * 0.02);
    const teQueda = valorDepto - deudaPendiente - comisionVenta;
    const gananciaNeta = teQueda - aporteAcum;
    const gananciaPct = aporteAcum > 0 ? (gananciaNeta / aporteAcum) * 100 : 0;

    // Refi — LTV parametrizable
    const nuevoCredito = Math.round(valorDepto * ltv);
    const liquidez = nuevoCredito - deudaPendiente;

    return {
      valorDepto,
      deudaPendiente,
      comisionVenta,
      teQueda,
      aporteAcum,
      gananciaNeta,
      gananciaPct,
      nuevoCredito,
      liquidez,
      LTV: ltv,
    };
  }, [projections, metrics, plazoAnios, ltv]);

  const fmt = (n: number) => fmtMoney(n, currency, valorUF);

  // Entrega futura: si el horizonte elegido está antes de la entrega, no aplica venta/refi
  const mesesPreEntrega = useMemo(() => {
    if (!inputData.fechaEntrega || inputData.estadoVenta === "inmediata") return 0;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const ent = new Date(a, (me || 1) - 1);
    return Math.max(0, Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }, [inputData.fechaEntrega, inputData.estadoVenta]);
  const horizonBeforeDelivery = mesesPreEntrega > 0 && plazoAnios * 12 <= mesesPreEntrega;

  if (horizonBeforeDelivery || !data) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg p-4"
        style={{ border: "1px solid color-mix(in srgb, var(--signal-red) 30%, transparent)", background: "color-mix(in srgb, var(--signal-red) 5%, transparent)" }}
      >
        <Clock className="h-5 w-5 shrink-0" style={{ color: "var(--signal-red)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--franco-text)" }}>
            No puedes vender ni refinanciar antes de la entrega
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--franco-text-secondary)" }}>
            Aumenta el plazo del slider para ver escenarios de salida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle segmented */}
      <div
        className="grid grid-cols-2 p-0.5 rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("venta")}
          className="py-2 px-3 rounded-md font-body text-sm transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
          style={{
            background: mode === "venta" ? "rgba(250,250,248,0.08)" : "transparent",
            color: mode === "venta" ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
            fontWeight: mode === "venta" ? 600 : 400,
            boxShadow: mode === "venta" ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            border: mode === "venta" ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
          }}
        >
          Si vendes
        </button>
        <button
          type="button"
          onClick={() => setMode("refi")}
          className="py-2 px-3 rounded-md font-body text-sm transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
          style={{
            background: mode === "refi" ? "rgba(250,250,248,0.08)" : "transparent",
            color: mode === "refi" ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
            fontWeight: mode === "refi" ? 600 : 400,
            boxShadow: mode === "refi" ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            border: mode === "refi" ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
          }}
        >
          Si refinancias
        </button>
      </div>

      {mode === "venta" ? (
        <>
          {/* Hero venta — Ink secundario per skill 7.B.4 */}
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
              Al vender en el año {plazoAnios} recibes
            </p>
            <p
              className="font-mono font-bold m-0 whitespace-nowrap"
              style={{ fontSize: 28, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmt(data.teQueda)}
            </p>
          </div>

          {/* Tabla desglose */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
            }}
          >
            {[
              { label: "Valor del depto", value: data.valorDepto, color: "var(--franco-text)", sign: "+" },
              { label: "− Deuda pendiente", value: data.deudaPendiente, color: "var(--signal-red)", sign: "−" },
              { label: "− Comisión venta (2%)", value: data.comisionVenta, color: "var(--signal-red)", sign: "−" },
            ].map((row, i) => (
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
                = Te queda
              </span>
              <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 16, color: "var(--franco-text)" }}>
                {fmt(data.teQueda)}
              </span>
            </div>
          </div>

          {/* Badge ganancia neta */}
          <div
            className="rounded-lg p-3"
            style={{
              background: `color-mix(in srgb, ${data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 10%, transparent)`,
              border: `0.5px solid color-mix(in srgb, ${data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)"} 30%, transparent)`,
            }}
          >
            <p className="font-body m-0" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 80%, transparent)" }}>
              Ganancia neta{" "}
              <span
                className="font-mono font-bold"
                style={{ color: data.gananciaNeta >= 0 ? "var(--ink-400)" : "var(--signal-red)" }}
              >
                {data.gananciaNeta >= 0 ? "+" : "−"}{fmt(Math.abs(data.gananciaNeta))}
              </span>{" "}
              ({data.gananciaNeta >= 0 ? "+" : "−"}{Math.round(Math.abs(data.gananciaPct))}%) vs inversión total de{" "}
              <span className="font-mono" style={{ color: "var(--franco-text)" }}>
                {fmt(data.aporteAcum)}
              </span>
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Hero refi — Ink secundario per skill 7.B.4 (mismo treatment que venta) */}
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
              Sin vender, puedes sacar
            </p>
            <p
              className="font-mono font-bold m-0 whitespace-nowrap"
              style={{ fontSize: 28, color: "var(--franco-text)", lineHeight: 1 }}
            >
              {fmt(data.liquidez)}
            </p>
          </div>

          {/* Selector LTV */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "1.2px", color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" }}
            >
              <span>LTV banco</span>
              <InfoTooltip content="Loan-To-Value: porcentaje del valor del depto que el banco financia en el refinanciamiento. Mayor LTV = más liquidez extraída pero mayor deuda." />
            </span>
            <div
              className="grid grid-cols-3 p-0.5 rounded-md flex-1 max-w-[220px]"
              style={{
                background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
                border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
              }}
            >
              {[0.60, 0.70, 0.75].map((opt) => {
                const active = ltv === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLtv(opt as 0.60 | 0.70 | 0.75)}
                    className="py-1.5 px-2 rounded-sm font-mono transition-all hover:text-[color-mix(in_srgb,var(--franco-text)_85%,transparent)]"
                    style={{
                      fontSize: 11,
                      background: active ? "rgba(250,250,248,0.08)" : "transparent",
                      color: active ? "var(--franco-text)" : "rgba(250,250,248,0.45)",
                      fontWeight: active ? 700 : 400,
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                      border: active ? "1px solid rgba(250,250,248,0.2)" : "1px solid transparent",
                    }}
                  >
                    {Math.round(opt * 100)}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabla desglose refi */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
            }}
          >
            {[
              { label: "Valor del depto", value: fmt(data.valorDepto), color: "var(--franco-text)" },
              { label: `× LTV ${Math.round(data.LTV * 100)}%`, value: "", color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" },
              { label: "= Nuevo crédito", value: fmt(data.nuevoCredito), color: "var(--franco-text)", bold: true },
              { label: "− Deuda actual", value: "−" + fmt(data.deudaPendiente), color: "var(--signal-red)" },
            ].map((row, i) => (
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
                <span
                  className="font-mono font-semibold whitespace-nowrap"
                  style={{ fontSize: 13, color: row.color, fontWeight: row.bold ? 700 : 600 }}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between px-4 py-3"
              style={{
                borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 20%, transparent)",
                background: "color-mix(in srgb, var(--franco-text) 5%, transparent)",
              }}
            >
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}>
                = Liquidez disponible
              </span>
              <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 16, color: "var(--franco-text)" }}>
                {fmt(data.liquidez)}
              </span>
            </div>
          </div>

          {/* Badge refi */}
          {/* Refi badge final — Ink secundario consistente con hero refi */}
          <div
            className="rounded-lg p-3"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
              border: "0.5px solid var(--franco-border)",
            }}
          >
            <p className="font-body m-0" style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 80%, transparent)" }}>
              Mantienes el depto y liberas{" "}
              <span className="font-mono font-bold" style={{ color: "var(--franco-text)" }}>
                {fmt(data.liquidez)}
              </span>{" "}
              de capital.
            </p>
          </div>
        </>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <span style={{ display: "none" }} aria-hidden>{valorUF}</span>
    </div>
  );
}
