"use client";

// Ficha del depto evaluado — modal (FASE 3 rediseño Dictamen).
// Contrato: mockup v9 congelado — specs FRANJA (regla gruesa de tinta arriba,
// micro-etiqueta + valor mono bold, hairlines verticales) + grilla G2 ABIERTA
// (sin líneas de celda; etiqueta sobre valor; 3 col PC / 2 mobile; celdas flex
// que llenan la última fila). Títulos de grupo: tick rojo 14×3 + mono bold +
// regla al borde. El contenido viene armado por el builder puro (ficha-depto).
// Nomenclatura regla 25: "el análisis se recalcula" — nunca "dictamen".

import { useEffect } from "react";
import type { FichaDepto } from "@/lib/ficha-depto";

export function FichaModal({
  ficha,
  open,
  onClose,
  onAjustar,
}: {
  ficha: FichaDepto;
  open: boolean;
  onClose: () => void;
  /** Lleva a ajustar supuestos (scroll a la simulación interactiva). */
  onAjustar?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="doc-ficha-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha del depto evaluado"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="doc-ficha-sheet">
        <div className="px-7 pt-6 pb-5 max-[480px]:px-5">
          <div className="flex justify-between items-baseline mb-0.5">
            <h2 className="font-heading font-bold text-[19px] m-0">Ficha del depto evaluado</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha"
              className="bg-transparent border-none cursor-pointer font-mono text-[13px] p-1"
              style={{ color: "var(--doc-tx3)" }}
            >
              ✕
            </button>
          </div>
          <p className="text-[12.5px] m-0 mb-4" style={{ color: "var(--doc-tx3)" }}>
            {ficha.sub}
          </p>

          {/* Specs · Franja */}
          <div className="doc-specfranja">
            {ficha.specs.map(([k, v]) => (
              <div key={k} className="sp">
                <div className="sk">{k}</div>
                <div className="sv">{v}</div>
              </div>
            ))}
          </div>

          {/* Grupos · G2 Abierta */}
          {ficha.grupos.map((g) => (
            <div key={g.titulo} className="mb-6 last:mb-1">
              <div className="flex items-center gap-2.5 mb-3.5">
                <span className="doc-tick" aria-hidden="true" />
                <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--doc-tx)" }}>
                  {g.titulo}
                </span>
                <span className="flex-1 h-px" style={{ background: "var(--doc-line)" }} aria-hidden="true" />
              </div>
              <div className="doc-g2">
                {g.celdas.map(([k, v]) => (
                  <div key={k} className="cell">
                    <div className="k">{k}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p
          className="text-[12px] leading-[1.55] m-0 px-7 pt-3.5 pb-5 max-[480px]:px-5"
          style={{ color: "var(--doc-tx3)", borderTop: "1px solid var(--doc-line)" }}
        >
          Supuestos con los que Franco corrió el análisis. Si alguno no calza con tu realidad,{" "}
          <a
            className="cursor-pointer"
            style={{ color: "var(--signal-red)" }}
            onClick={() => {
              onClose();
              onAjustar?.();
            }}
          >
            ajústalos
          </a>{" "}
          y el análisis se recalcula.
        </p>
      </div>
    </div>
  );
}
