"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Modal reutilizable para la landing.
 *
 * - ESC cierra
 * - Click sobre backdrop cierra
 * - Body scroll lock mientras está abierto (también pausa Lenis si existe)
 * - Focus management: enfoca el contenedor del modal al abrir
 * - prefers-reduced-motion: sin animación de entrada
 * - Cierre con animación 220ms (fade + scale)
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingModal({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
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
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 md:px-6 md:py-12"
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
            className="relative z-10 max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-2xl outline-none"
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
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full font-mono text-[16px] text-[var(--landing-text-muted)] transition-[background,color] duration-150 hover:bg-[var(--landing-card-bg-soft)] hover:text-[var(--landing-text)]"
              aria-label="Cerrar"
            >
              ×
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
