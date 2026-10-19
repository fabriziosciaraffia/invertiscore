"use client";

// Los correos de Franco, desde la cuenta (19-oct-2026): cada uno se apaga o se vuelve a prender (api/cuenta/correos).
import { useState } from "react";
import { CUENTA_COPY } from "./cuenta-copy";

type Correo = "semanal" | "inmediato";

export function CorreosCuenta({ inicial }: { inicial: Record<Correo, boolean> }) {
  const [recibe, setRecibe] = useState(inicial);
  const [ocupado, setOcupado] = useState<Correo | null>(null);
  const [error, setError] = useState(false);

  async function cambiar(correo: Correo) {
    const nuevo = !recibe[correo];
    setOcupado(correo);
    setError(false);
    try {
      const res = await fetch("/api/cuenta/correos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo, recibe: nuevo }) });
      if (!res.ok) { setError(true); return; }
      setRecibe((r) => ({ ...r, [correo]: nuevo }));
    } catch {
      setError(true);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5" data-cuenta="correos">
      {(["semanal", "inmediato"] as const).map((c) => (
        <div key={c} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" data-correo={c} data-recibe={recibe[c] ? "1" : "0"}>
          <p className="m-0 text-[15px]">
            <span className="font-semibold">{CUENTA_COPY.correos[c]}</span>
            <span className="text-[var(--franco-text-secondary)]"> · {recibe[c] ? CUENTA_COPY.correos.recibes : CUENTA_COPY.correos.noRecibes}</span>
          </p>
          <button type="button" onClick={() => void cambiar(c)} disabled={ocupado !== null}
            className="text-[14px] text-[var(--franco-text)] underline underline-offset-4 disabled:opacity-50">
            {ocupado === c ? CUENTA_COPY.guardando : recibe[c] ? CUENTA_COPY.correos.dejar : CUENTA_COPY.correos.volver}
          </button>
        </div>
      ))}
      {error && <p role="alert" className="m-0 text-[13px] text-[var(--signal-red)]">{CUENTA_COPY.error}</p>}
    </div>
  );
}
