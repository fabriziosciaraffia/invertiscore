"use client";

import { useState } from "react";

type ActionKey = "update-market" | "calculate-stats" | "geocode";
type Status = "idle" | "running" | "ok" | "error";

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
    if (state.status === "error") return "Error ✗";
    return label;
  }

  function buttonClass(state: ActionState) {
    const base =
      "px-4 py-2 rounded-md border text-sm font-body font-medium transition-colors";
    if (state.status === "ok") return `${base} border-[#16A34A] text-[#16A34A] bg-[#16A34A]/5`;
    if (state.status === "error") return `${base} border-[#C8323C] text-[#C8323C] bg-[#C8323C]/5`;
    if (state.status === "running")
      return `${base} border-white/[0.08] text-white/50 cursor-wait`;
    return `${base} border-white/[0.08] text-[#FAFAF8] hover:border-[#C8323C]`;
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
          </div>
        );
      })}
    </div>
  );
}
