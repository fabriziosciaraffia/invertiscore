"use client";

// Primitivos de UI del wizard v4 (Patrón 5 — Form Step del design system).
// Solo Ink + Signal Red; el CTA primario "avanzar" es el único rojo sólido.

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/tooltip";

export function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  // Deshabilitado NO va como rojo fantasma (se leía como "roto"): pasa a outline
  // inactivo Ink → comunica "falta completar", no "acción apagada".
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] px-6 py-3.5 rounded-lg min-h-[44px] flex items-center justify-center gap-2 transition-colors text-white bg-signal-red hover:bg-signal-red/90 disabled:bg-transparent disabled:text-[var(--franco-text-muted)] disabled:border disabled:border-[var(--franco-border-strong)] disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

/** Reacción de Franco: Franco hablando entre preguntas. Fondo sutil, borde izq
 *  Signal Red, esquinas der redondeadas (0 X X 0), fade suave de entrada. */
export function FrancoReaction({ children }: { children: ReactNode }) {
  return (
    <div
      className="wizard4-reaction mb-7 rounded-r-lg border-l-2 border-signal-red pl-4 pr-4 py-3"
      style={{ background: "color-mix(in srgb, var(--franco-text) 3.5%, transparent)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal-red m-0 mb-1">
        Franco
      </p>
      <p className="font-body text-[14px] italic text-[var(--franco-text-secondary)] m-0 leading-relaxed">
        {children}
      </p>
    </div>
  );
}

export function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2 min-h-[44px]"
    >
      {children}
    </button>
  );
}

/** Tile seleccionable grande (una opción por fila). Hover-lift solo en no-elegidos. */
export function ChoiceTile({
  children,
  selected,
  onClick,
  accent,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick: () => void;
  /** Borde Signal Red 1.5px (destacado, NO preseleccionado). */
  accent?: boolean;
}) {
  const base = "text-left rounded-xl px-5 py-4 font-body text-[15px] w-full transition-colors";
  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} bg-[var(--franco-text)] text-[var(--franco-bg)] border-[1.5px] border-[var(--franco-text)]`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`franco-tile-target ${base} bg-[var(--franco-card)] text-[var(--franco-text)] ${
        accent ? "border-[1.5px] border-signal-red" : "border-[0.5px] border-[var(--franco-border)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Control segmentado horizontal (plazo 20/25/30, unidad de pie, etc.). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-1 gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-mono text-[13px] px-4 py-2 rounded-md min-h-[40px] transition-colors ${
              active
                ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                : "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Label de campo (Sans medium) con tooltip opcional. */
export function FieldLabel({ children, tooltip }: { children: ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">{children}</label>
      {tooltip && <InfoTooltip content={tooltip} />}
    </div>
  );
}

const INPUT_BASE =
  "w-full h-11 rounded-lg bg-[var(--franco-card)] px-3 text-[15px] text-[var(--franco-text)] focus:outline-none focus:ring-1 focus:ring-signal-red/20 transition-colors";

/** Input de texto/numérico con sufijo opcional. `strong` = borde ink 1.5px (precio). */
export function TextInput({
  value,
  onChange,
  placeholder,
  inputMode = "text",
  mono,
  suffix,
  strong,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
  mono?: boolean;
  suffix?: string;
  strong?: boolean;
  autoFocus?: boolean;
}) {
  const border = strong
    ? "border-[1.5px] border-[var(--franco-text)] focus:border-signal-red"
    : "border-[0.5px] border-[var(--franco-border)] focus:border-signal-red";
  return (
    <div className="relative">
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_BASE} ${border} ${mono ? "font-mono" : "font-body"} ${suffix ? "pr-12" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Línea de fuente/procedencia bajo una estimación (Mono, muted). */
export function FuenteLine({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-2 mb-0 leading-snug">
      {children}
    </p>
  );
}
