"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Modal reutilizable para la landing.
 *
 * Phase 2.26 · estructura flex-column con header sticky en mobile.
 *   · Mobile (<768px): ocupa 100dvh (no 100vh — iOS Safari address bar) y
 *     monta un header sticky 56px con el `headerLabel` mono uppercase a la
 *     izquierda + botón × táctil 44×44 a la derecha. El body crece con
 *     flex:1 y maneja su propio overflow-y; el header queda fuera del scroll
 *     y SIEMPRE accesible aunque el contenido sea largo.
 *   · Desktop (≥md=768px): max-w 760px / max-h 90vh, esquinas redondeadas,
 *     el botón × flota absoluto top-right (igual que antes), header mobile
 *     se oculta vía md:hidden.
 *
 * Comportamiento conservado:
 *   · ESC cierra · click en backdrop cierra · scroll lock del body (+ Lenis
 *     pausado si existe) · focus al abrir · prefers-reduced-motion respetado.
 *   · AnimatePresence sigue para la animación de cierre fade+scale (220ms);
 *     no agregamos conditional renders nuevos en el path animado.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingModal({
  open,
  onClose,
  ariaLabel,
  headerLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** Etiqueta corta para el header sticky en mobile (ej: "02 · Facilidad"). */
  headerLabel?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (lenis) lenis.stop();
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (lenis) lenis.start();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center md:px-6 md:py-12"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          aria-modal="true"
          role="dialog"
          aria-label={ariaLabel}
        >
          <button
            type="button"
            aria-label="Cerrar modal"
            className="absolute inset-0 cursor-default bg-[rgba(0,0,0,0.65)] backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            // h-[100dvh] mobile (dynamic viewport · iOS Safari address bar
            // safe); md:h-auto + md:max-h-[90vh] desktop · clases arbitrarias
            // de Tailwind generan las reglas con el orden correcto (no usar
            // inline style: la mobile-first cascade no aplicaría).
            className="relative z-10 flex w-full flex-col overflow-hidden outline-none h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-[760px] md:rounded-2xl"
            style={{
              background: "var(--landing-card-bg)",
              border: "0.5px solid var(--landing-card-border)",
              boxShadow:
                "0 60px 120px -20px rgba(0,0,0,0.55), 0 24px 48px rgba(0,0,0,0.35)",
            }}
            initial={
              reduce ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {/* Mobile header sticky · 56px · label izq + × der · ocultar en md+ */}
            <div
              className="flex shrink-0 items-center justify-between md:hidden"
              style={{
                height: 56,
                padding: "0 8px 0 16px",
                borderBottom: "0.5px solid var(--landing-card-border)",
                background: "var(--landing-card-bg)",
              }}
            >
              {headerLabel ? (
                <span
                  className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                  style={{ fontSize: 10, letterSpacing: "0.16em" }}
                >
                  {headerLabel}
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex items-center justify-center rounded-full text-[var(--landing-text)] transition-[background] duration-150 hover:bg-[var(--landing-card-bg-soft)]"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: 22,
                  lineHeight: 1,
                  // -mr-2 visual: alinea el centro del × con el borde derecho
                  // útil (16px effective inset), preservando 44×44 táctil.
                  marginRight: -8,
                }}
              >
                ×
              </button>
            </div>

            {/* Desktop floating × · arriba a la derecha del dialog · oculto en mobile */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 hidden h-9 w-9 items-center justify-center rounded-full font-mono text-[16px] text-[var(--landing-text-muted)] transition-[background,color] duration-150 hover:bg-[var(--landing-card-bg-soft)] hover:text-[var(--landing-text)] md:flex"
              aria-label="Cerrar"
            >
              ×
            </button>

            {/* Body scrollable · padding mobile 24/20/32 · desktop md:p-8 */}
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 md:p-8">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
