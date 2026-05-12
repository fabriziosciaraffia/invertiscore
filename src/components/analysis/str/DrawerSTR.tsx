"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Drawer Detail — variante Renta Corta (Patrón 3 del design system).
 *
 * 6 dimensiones STR (Commit 2c — 2026-05-12):
 *   02 · RENTABILIDAD
 *   03 · SOSTENIBILIDAD
 *   04 · SENSIBILIDAD
 *   05 · VENTAJA vs LTR
 *   06 · TIPO DE HUÉSPED        ← nuevo (paralelo LTR Drawer 06 Zona)
 *   07 · FACTIBILIDAD Y RIESGOS (renumerado, era 06)
 *
 * Versión simplificada del AnalysisDrawer LTR — solo header + body genérico
 * (consumer pasa children con secciones de datos / bloque conclusivo /
 * caja accionable Franco).
 */
export type DrawerKeySTR =
  | "rentabilidad"
  | "sostenibilidad"
  | "sensibilidad"
  | "ventajaLtr"
  | "tipoHuesped"
  | "factibilidad";

const DRAWER_META: Record<DrawerKeySTR, { numero: string; label: string }> = {
  rentabilidad: { numero: "02", label: "RENTABILIDAD" },
  sostenibilidad: { numero: "03", label: "SOSTENIBILIDAD" },
  sensibilidad: { numero: "04", label: "SENSIBILIDAD" },
  ventajaLtr: { numero: "05", label: "VENTAJA vs LTR" },
  tipoHuesped: { numero: "06", label: "TIPO DE HUÉSPED" },
  factibilidad: { numero: "07", label: "FACTIBILIDAD Y RIESGOS" },
};

const DRAWER_NAV_ORDER: DrawerKeySTR[] = [
  "rentabilidad",
  "sostenibilidad",
  "sensibilidad",
  "ventajaLtr",
  "tipoHuesped",
  "factibilidad",
];

export function DrawerSTR({
  activeKey,
  titulo,
  onClose,
  onNavigate,
  children,
}: {
  activeKey: DrawerKeySTR | null;
  titulo: string;
  onClose: () => void;
  onNavigate?: (key: DrawerKeySTR) => void;
  children: React.ReactNode;
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (activeKey) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [activeKey]);

  // ESC closes
  useEffect(() => {
    if (!activeKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeKey, onClose]);

  if (!activeKey) return null;

  const meta = DRAWER_META[activeKey];
  const idx = DRAWER_NAV_ORDER.indexOf(activeKey);
  const prev = idx > 0 ? DRAWER_NAV_ORDER[idx - 1] : null;
  const next = idx < DRAWER_NAV_ORDER.length - 1 ? DRAWER_NAV_ORDER[idx + 1] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel — paridad visual con AnalysisDrawer LTR (Commit 2):
          desktop md:75vw → lg:70vw → xl:min(960px,65vw); mobile bottom sheet
          85vh con esquinas redondas arriba. Mismo breakpoint system. */}
      <aside
        role="dialog"
        aria-modal="true"
        className="
          fixed z-50 bg-[var(--franco-card)] overflow-hidden flex flex-col
          md:top-0 md:right-0 md:bottom-0 md:w-[75vw] lg:w-[70vw] xl:w-[min(960px,65vw)] md:border-l md:border-[var(--franco-border)] md:animate-slideInRight
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[85vh] max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--franco-border)] max-md:animate-slideInUp
        "
      >
        {/* Header — Commit 4 · 2026-05-12: paridad con AnalysisDrawer LTR
            (border-bottom 0.5px que separa header de body). */}
        <div
          className="px-5 md:px-7 pt-5 pb-4 flex items-start justify-between gap-3 shrink-0"
          style={{ borderBottom: "0.5px solid var(--franco-border)" }}
        >
          <div className="min-w-0">
            <span
              className="font-mono uppercase block mb-1.5"
              style={{
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--franco-text-tertiary)",
              }}
            >
              {meta.numero} · {meta.label}
            </span>
            <h3 className="font-heading font-bold text-[22px] md:text-[24px] text-[var(--franco-text)] m-0 leading-[1.25]">
              {titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-md hover:bg-[var(--franco-border)] shrink-0 transition-colors"
          >
            <X className="h-5 w-5 text-[var(--franco-text-secondary)]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 md:px-7 pb-6 flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer nav */}
        {(prev || next) && onNavigate && (
          <div
            className="px-5 md:px-7 py-3 flex items-center justify-between shrink-0"
            style={{ borderTop: "0.5px solid var(--franco-border)" }}
          >
            {prev ? (
              <button
                type="button"
                onClick={() => onNavigate(prev)}
                className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
              >
                ← {DRAWER_META[prev].numero} {DRAWER_META[prev].label}
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                onClick={() => onNavigate(next)}
                className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
              >
                {DRAWER_META[next].numero} {DRAWER_META[next].label} →
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
      </aside>
    </>
  );
}
