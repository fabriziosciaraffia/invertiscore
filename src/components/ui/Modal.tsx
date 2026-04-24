"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode; // overrides title/subtitle when provided (use for tab headers)
  maxWidth?: string;  // e.g. "max-w-lg"
  /**
   * Controla si un click sobre el backdrop cierra el modal.
   * Default: true (retrocompat). Poner false para modales con cambios sin guardar
   * que no deberían cerrarse por un click accidental.
   */
  dismissOnBackdropClick?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  header,
  maxWidth = "max-w-lg",
  dismissOnBackdropClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={dismissOnBackdropClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {header ?? (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[var(--franco-border)]">
            <div className="min-w-0">
              {title && (
                <h2 className="font-heading text-lg md:text-xl font-bold text-[var(--franco-text)] m-0">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-md p-1 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-border)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="px-5 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--franco-border)] bg-[var(--franco-card)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
