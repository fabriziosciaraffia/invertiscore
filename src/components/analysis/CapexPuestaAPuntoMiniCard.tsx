"use client";

import { Hammer } from "lucide-react";
import type { HallazgoPuestaAPunto } from "@/lib/types";

/**
 * Wide card que aparece entre el grid 2×2 y la card de Zona cuando el motor
 * emite el hallazgo `capex_puesta_a_punto` con dirección "adverso" (usado con
 * antigüedad > 2). Da el "porqué" de la caída de TIR/inversión inicial: para
 * captar arriendo de mercado hay que poner plata día 1 en puesta a punto.
 *
 * Mismo patrón visual que ReestructuracionMiniCard (chrome neutro, barra Ink,
 * sin border rojo). El monto va en Signal Red SOLO cuando pesa fuerte en la
 * plata día 1 (decisividad > 0.30, skill: KPI condicional Signal Red).
 */
export function CapexPuestaAPuntoMiniCard({
  hallazgo,
  currency,
  valorUF,
  onClick,
}: {
  hallazgo: HallazgoPuestaAPunto;
  currency: "CLP" | "UF";
  valorUF: number;
  onClick: () => void;
}) {
  void valorUF; // el hallazgo ya trae montoUF/CLP precomputados por el motor
  const { montoCLP, montoUF } = hallazgo.valor;
  const montoFmt =
    currency === "CLP"
      ? "$" + Math.round(montoCLP).toLocaleString("es-CL")
      : "UF " + Math.round(montoUF).toLocaleString("es-CL");

  // KPI condicional Signal Red: cuando el CapEx pesa fuerte en la plata día 1.
  // Umbral 0.20 calibrado a la distribución real (máx ~0.20, mediana ~0.07).
  const pesaFuerte = hallazgo.decisividad > 0.2;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors hover:opacity-95 group relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--franco-text) 5%, transparent) 0%, transparent 60%), var(--franco-card)",
        border: "1px solid var(--franco-border)",
        borderRadius: 16,
        padding: "16px 18px",
        minHeight: 120,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 pointer-events-none"
        style={{ height: 3, background: "var(--franco-text)" }}
      />
      <div className="grid items-center gap-3.5 md:gap-4" style={{ gridTemplateColumns: "44px 1fr auto" }}>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--franco-text) 25%, transparent)",
            color: "var(--franco-text)",
          }}
          aria-hidden="true"
        >
          <Hammer size={20} strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex flex-col gap-1">
          <span
            className="font-mono text-[9px] uppercase tracking-[1.5px] font-medium"
            style={{ color: "var(--franco-text-secondary)" }}
          >
            + · Puesta a punto
          </span>
          <h3 className="font-heading font-bold text-[15px] md:text-[16px] leading-[1.2] text-[var(--franco-text)] m-0">
            Dejarlo listo para arrendar
          </h3>
          <p
            className="font-body text-[12px] md:text-[12.5px] leading-[1.5] m-0 mt-0.5"
            style={{
              color: "color-mix(in srgb, var(--franco-text) 78%, transparent)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {hallazgo.fraseCanonica}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="font-mono text-[9px] uppercase tracking-[1px] text-right"
            style={{ color: "var(--franco-text-secondary)" }}
          >
            Inversión extra
          </span>
          <span
            className={`font-mono font-bold text-[14px] md:text-[15px] ${
              pesaFuerte ? "text-signal-red" : "text-[var(--franco-text)]"
            }`}
          >
            +{montoFmt}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-[1.3px] hidden md:inline mt-1"
            style={{ color: "color-mix(in srgb, var(--franco-text) 60%, transparent)" }}
          >
            Ver detalle →
          </span>
        </div>
      </div>
    </button>
  );
}
