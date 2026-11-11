"use client";

import { useState } from "react";
import { ESTADOS, type EstadoInvierte } from "@/lib/invierte/invierte";

const ROTULO: Record<EstadoInvierte, string> = { nuevo: "Nuevo", contactado: "Contactado", descartado: "Descartado" };

/** El estado de una inscripción (nuevo, contactado, descartado), guardado al cambiarlo. Si falla, vuelve al anterior. */
export function EstadoSelect({ id, inicial }: { id: string; inicial: EstadoInvierte }) {
  const [estado, setEstado] = useState<EstadoInvierte>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  async function cambiar(nuevo: EstadoInvierte) {
    const antes = estado;
    setEstado(nuevo);
    setOcupado(true);
    setError(false);
    const ok = await fetch("/api/admin/invierte", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado: nuevo }) }).then((r) => r.ok).catch(() => false);
    setOcupado(false);
    if (!ok) { setEstado(antes); setError(true); }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={estado}
        disabled={ocupado}
        onChange={(e) => void cambiar(e.target.value as EstadoInvierte)}
        aria-label="Estado"
        className="rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[12px] text-[var(--franco-text)]"
        data-admin="invierte-estado"
      >
        {ESTADOS.map((e) => <option key={e} value={e}>{ROTULO[e]}</option>)}
      </select>
      {error && <span className="text-[11px] text-[var(--signal-red)]" role="alert">No se guardó</span>}
    </span>
  );
}
