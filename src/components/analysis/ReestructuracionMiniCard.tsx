"use client";

import { Calculator } from "lucide-react";
import type { AIReestructuracionSection } from "@/lib/types";

/**
 * Wide card que aparece entre el grid 2×2 y la card de Zona cuando
 * `aiAnalysis.reestructuracion` existe (Nivel 3 del escalonado
 * `financingHealth`, skill §1.5). Mismo patrón visual que ZoneInsightMiniCard
 * pero icono Calculator y KPI con el ahorro mensual en cuota.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3).
 */
export function ReestructuracionMiniCard({
  data,
  currency,
  valorUF,
  onClick,
}: {
  data: AIReestructuracionSection;
  currency: "CLP" | "UF";
  valorUF: number;
  onClick: () => void;
}) {
  const preview = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
  const ahorro = data.estructuraSugerida.impactoCuotaMensual_clp;
  const ahorroFmt = currency === "CLP"
    ? "$" + Math.round(ahorro).toLocaleString("es-CL")
    : "UF " + (Math.round((ahorro / (valorUF || 1)) * 100) / 100).toFixed(2).replace(".", ",");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors hover:opacity-95 group relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--franco-text) 5%, transparent) 0%, transparent 60%), var(--franco-card)",
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
          <Calculator size={20} strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex flex-col gap-1">
          <span
            className="font-mono text-[9px] uppercase tracking-[1.5px] font-medium"
            style={{ color: "var(--franco-text-secondary)" }}
          >
            03+ · Reestructuración
          </span>
          <h3 className="font-heading font-bold text-[15px] md:text-[16px] leading-[1.2] text-[var(--franco-text)] m-0">
            ¿Y si cambias la estructura?
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
            {preview}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="font-mono text-[9px] uppercase tracking-[1px] text-right"
            style={{ color: "var(--franco-text-secondary)" }}
          >
            Cuota baja
          </span>
          <span
            className="font-mono font-bold text-[14px] md:text-[15px] text-[var(--franco-text)]"
          >
            −{ahorroFmt}
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
