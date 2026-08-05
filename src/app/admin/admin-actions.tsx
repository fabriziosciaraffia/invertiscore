"use client";

import { useState } from "react";

type ActionKey = "update-market" | "calculate-stats" | "geocode";
/**
 * Cuatro estados, no tres. "parcial" existe desde que los endpoints devuelven
 * 207 (ver cron-resultado.ts): la acción corrió e hizo parte del trabajo. Antes
 * caía en "ok" porque el chequeo era `if (!res.ok)` y 207 es 2xx — el botón
 * "Actualizar UF/Tasa" mostraba el check aunque la UF no se hubiera escrito.
 *
 * Hoy solo update-market puede devolverlo, pero el manejo va por STATUS y no
 * por acción, así que cubre a las que migren después sin tocar nada.
 */
type Status = "idle" | "running" | "ok" | "parcial" | "error";

interface ActionState {
  status: Status;
  message?: string;
}

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: "update-market", label: "Actualizar UF/Tasa" },
  { key: "calculate-stats", label: "Recalcular Stats" },
  { key: "geocode", label: "Forzar Geocode" },
];

export function AdminActions() {
  const [states, setStates] = useState<Record<ActionKey, ActionState>>({
    "update-market": { status: "idle" },
    "calculate-stats": { status: "idle" },
    "geocode": { status: "idle" },
  });

  async function run(action: ActionKey) {
    if (states[action].status === "running") return;
    setStates((s) => ({ ...s, [action]: { status: "running" } }));
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStates((s) => ({ ...s, [action]: { status: "error", message: data?.error || "Error" } }));
        return;
      }
      if (data?.parcial) {
        // No se auto-limpia: un resultado parcial hay que leerlo, no verlo pasar.
        setStates((s) => ({
          ...s,
          [action]: { status: "parcial", message: String(data?.result ?? "").slice(0, 240) },
        }));
        return;
      }
      setStates((s) => ({ ...s, [action]: { status: "ok" } }));
      setTimeout(() => {
        setStates((s) => ({ ...s, [action]: { status: "idle" } }));
      }, 3000);
    } catch (e) {
      setStates((s) => ({
        ...s,
        [action]: { status: "error", message: e instanceof Error ? e.message : "Error" },
      }));
    }
  }

  function buttonText(state: ActionState, label: string) {
    if (state.status === "running") return "Ejecutando…";
    if (state.status === "ok") return "Listo ✓";
    if (state.status === "parcial") return "Parcial";
    if (state.status === "error") return "Error ✗";
    return label;
  }

  /**
   * Los cuatro estados se distinguen SIN color nuevo, que es la regla de la
   * Capa 1: solo Ink y Signal Red. El éxito usaba `#16A34A` —verde, prohibido
   * por el sistema— y pasa a Ink; el parcial se separa del éxito por el borde
   * punteado y la palabra, no por un tercer color. El rojo queda reservado al
   * error, que es uno de sus usos permitidos.
   */
  function buttonClass(state: ActionState) {
    const base =
      "px-4 py-2 rounded-md border text-sm font-body font-medium transition-colors";
    if (state.status === "ok")
      return `${base} border-[var(--franco-text)] text-[var(--franco-text)]`;
    if (state.status === "parcial")
      return `${base} border-dashed border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)]`;
    if (state.status === "error") return `${base} border-[#C8323C] text-[#C8323C] bg-[#C8323C]/5`;
    if (state.status === "running")
      return `${base} border-[var(--franco-border)] text-[var(--franco-text-secondary)] cursor-wait`;
    return `${base} border-[var(--franco-border)] text-[var(--franco-text)] hover:border-[#C8323C]`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => {
        const state = states[a.key];
        return (
          <div key={a.key} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => run(a.key)}
              disabled={state.status === "running"}
              className={buttonClass(state)}
            >
              {buttonText(state, a.label)}
            </button>
            {state.status === "error" && state.message && (
              <span className="font-mono text-[10px] text-[#C8323C]/70 max-w-[240px] truncate" title={state.message}>
                {state.message}
              </span>
            )}
            {/* En parcial el detalle es lo importante: dice QUÉ quedó sin hacer.
                Va en Ink —no es un error— y con el body completo en el title. */}
            {state.status === "parcial" && (
              <span
                className="font-mono text-[10px] text-[var(--franco-text-muted)] max-w-[240px] truncate"
                title={state.message}
              >
                {state.message || "corrió a medias"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
