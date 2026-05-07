"use client";

import { useState } from "react";

/**
 * Sección colapsable genérica. Move verbatim desde results-client.tsx LTR
 * (Ronda 4a.1). Hoy sin usages activos en LTR — preservada para reuso futuro
 * en STR / drawers (Ronda 4c).
 */
export function CollapsibleSection({
  title,
  subtitle,
  helpText,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  helpText?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--franco-card)] rounded-xl border border-[var(--franco-border)] mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-4 px-5 text-left gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[15px] font-medium text-[var(--franco-text)]">{title}</span>
            {badge}
          </div>
          {subtitle && <p className="font-body text-xs text-[var(--franco-text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        <span className={`font-body text-lg text-[var(--franco-text-secondary)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}>↓</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {helpText && (
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-snug p-2.5 px-3.5 bg-[var(--franco-card)] rounded-lg mb-3.5">{helpText}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
