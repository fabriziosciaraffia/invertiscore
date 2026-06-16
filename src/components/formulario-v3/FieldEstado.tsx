"use client";

// Marcadores de estado por campo — affordance "estimado · ajustable".
// Ink puro, SIN Signal Red: "estimado/modificado" es estado neutro, no
// criticidad (regla del rojo del design system). Reusa los patrones ya
// existentes en BloqueOperacionSTR (badge de override + botón "Usar sugerido").

import type { ReactNode } from "react";

/** Tag de estado de un campo prellenado por Franco:
 *  - "estimado": prellenado y no tocado → Mono uppercase 9px, --franco-text-muted.
 *  - "modificado": editado por el usuario → Mono uppercase 9px, secondary + border. */
export function FieldEstadoTag({ estado }: { estado: "estimado" | "modificado" }) {
  if (estado === "estimado") {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
        Estimado por Franco
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.08em] font-semibold text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] rounded-sm px-1.5 py-0.5">
      Modificado por ti
    </span>
  );
}

/** Botón "Usar estimación de Franco" — restaura el campo al valor sugerido y lo
 *  quita de editedFields. Reusa el patrón "Usar sugerido" (Mono 10px dotted).
 *  En espacios estrechos (mobile/inline) pasar label="Usar estimación". */
export function UsarEstimacion({
  onClick,
  label = "Usar estimación de Franco",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[10px] text-[var(--franco-text-muted)] underline decoration-dotted hover:text-[var(--franco-text)]"
    >
      {label}
    </button>
  );
}

/** Footer de estado de un campo prellenado. Estimado → tag + descripción de la
 *  sugerencia ("Mercado sugiere $X · N comparables", etc., vía children).
 *  Modificado → badge "Modificado por ti" + "Usar estimación" (si onRestore). */
export function CampoEstado({
  edited,
  onRestore,
  children,
}: {
  edited: boolean;
  /** Restaura al valor estimado. Undefined → no hay sugerencia que restaurar. */
  onRestore?: () => void;
  /** Descripción de la sugerencia (solo se muestra en estado "estimado"). */
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap">
      {edited ? (
        <>
          <FieldEstadoTag estado="modificado" />
          {onRestore && <UsarEstimacion onClick={onRestore} label="Usar estimación" />}
        </>
      ) : (
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--franco-text-muted)] leading-snug">
          <FieldEstadoTag estado="estimado" />
          {children}
        </span>
      )}
    </div>
  );
}
