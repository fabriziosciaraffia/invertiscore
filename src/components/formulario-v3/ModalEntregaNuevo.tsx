"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import {
  mesesHastaEntrega,
  type WizardV3State,
} from "./wizardV3State";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Local = Pick<WizardV3State, "estadoVenta" | "fechaEntregaMes" | "fechaEntregaAnio">;

export function ModalEntregaNuevo({
  open,
  onClose,
  state,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  state: WizardV3State;
  onSave: (patch: Partial<WizardV3State>) => void;
}) {
  // `startSnap` se recaptura cada vez que el modal se abre (via useResetOnOpen)
  // — idéntico patrón que `local`, para que `isDirty` compare contra los
  // valores del state actual al abrir, no contra los de hace 3 aperturas atrás.
  const [startSnap, setStartSnap] = useResetOnOpen<Local>(open, {
    estadoVenta: state.estadoVenta,
    fechaEntregaMes: state.fechaEntregaMes,
    fechaEntregaAnio: state.fechaEntregaAnio,
  });
  const [local, setLocal] = useResetOnOpen<Local>(open, {
    estadoVenta: state.estadoVenta,
    fechaEntregaMes: state.fechaEntregaMes,
    fechaEntregaAnio: state.fechaEntregaAnio,
  });
  // setStartSnap queda disponible por si algún handler necesita "congelar"
  // un nuevo baseline después del mount. No lo usamos hoy, pero evita warning.
  void setStartSnap;

  const isDirty = useMemo(() => (
    local.estadoVenta !== startSnap.estadoVenta ||
    local.fechaEntregaMes !== startSnap.fechaEntregaMes ||
    local.fechaEntregaAnio !== startSnap.fechaEntregaAnio
  ), [local, startSnap]);

  // Esc: confirmar si hay cambios (patrón igual al de ModalAjusteCondiciones)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isDirty && !window.confirm("¿Descartar cambios?")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isDirty, onClose]);

  function handleSave() {
    // Si cambia a "inmediata", limpiar fecha (defensivo).
    const patch: Partial<WizardV3State> = {
      estadoVenta: local.estadoVenta,
      fechaEntregaMes: local.estadoVenta === "futura" ? local.fechaEntregaMes : "",
      fechaEntregaAnio: local.estadoVenta === "futura" ? local.fechaEntregaAnio : "",
    };
    onSave(patch);
    onClose();
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const meses = local.estadoVenta === "futura"
    ? mesesHastaEntrega(local.fechaEntregaMes, local.fechaEntregaAnio)
    : 0;

  const inputBase =
    "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)" }}
      /* Backdrop click NO cierra: cambios potenciales sin guardar. */
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[var(--franco-border)]">
          <h2 className="font-heading text-lg md:text-xl font-bold text-[var(--franco-text)] m-0">
            Entrega del proyecto
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
              Estado
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["inmediata", "futura"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setLocal((p) => ({ ...p, estadoVenta: e }))}
                  className={`h-10 rounded-lg font-body text-[13px] font-medium capitalize transition-colors ${
                    local.estadoVenta === e
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                      : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border border-[var(--franco-border)]"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {local.estadoVenta === "futura" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                    Mes
                  </label>
                  <select
                    className={`${inputBase} appearance-none text-[13px]`}
                    value={local.fechaEntregaMes}
                    onChange={(e) => setLocal((p) => ({ ...p, fechaEntregaMes: e.target.value }))}
                  >
                    <option value="">—</option>
                    {MESES_ES.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                    Año
                  </label>
                  <select
                    className={`${inputBase} appearance-none text-[13px]`}
                    value={local.fechaEntregaAnio}
                    onChange={(e) => setLocal((p) => ({ ...p, fechaEntregaAnio: e.target.value }))}
                  >
                    <option value="">—</option>
                    {Array.from({ length: 7 }, (_, i) => 2026 + i).map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              {meses > 0 && (
                <p className="font-body text-[11px] text-[var(--franco-text-muted)] m-0">
                  Pagarás el pie en ~{meses} cuotas hasta la entrega.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--franco-border)]">
          <button
            type="button"
            onClick={onClose}
            className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="font-body font-medium text-[14px] text-white px-5 py-2.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[40px]"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
