"use client";

import { useState } from "react";

/** El gasto de un conjunto en una semana, ingresado a mano (pesos). Se guarda al salir del campo y recarga para recalcular. */
export function GastoInput({ clave, inicial }: { clave: string; inicial: number | null }) {
  const [valor, setValor] = useState(inicial != null ? String(inicial) : "");
  const [estado, setEstado] = useState<"quieto" | "guardando" | "error">("quieto");
  async function guardar() {
    const limpio = valor.replace(/[^\d]/g, "");
    if ((limpio === "" ? null : Number(limpio)) === inicial) return;
    setEstado("guardando");
    const ok = await fetch("/api/admin/campana", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave, monto: limpio === "" ? null : Number(limpio) }) }).then((r) => r.ok).catch(() => false);
    if (!ok) { setEstado("error"); return; }
    window.location.reload();
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[var(--franco-text-muted)]">$</span>
      <input
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void guardar()}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        disabled={estado === "guardando"}
        aria-label="Gasto de la semana"
        className="w-24 rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 text-right font-mono text-[12px] text-[var(--franco-text)]"
        data-admin="campana-gasto"
      />
      {estado === "error" && <span className="text-[11px] text-[var(--signal-red)]" role="alert">No se guardó</span>}
    </span>
  );
}
