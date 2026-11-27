"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** «Habilitar este dispositivo» / «Quitar este dispositivo» (27-nov-2026): el navegador desde donde se toca. */
export function EsteDispositivo({ habilitado, sinCookie }: { habilitado: boolean; sinCookie: boolean }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sinCookie) return <p className="m-0 font-body text-[13px]">Este navegador no tiene la cookie del dispositivo. Recarga la página.</p>;
  async function enviar(accion: "habilitar" | "quitar") {
    setOcupado(true); setError(null);
    const r = await fetch("/api/admin/asesoria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, nota }) }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) { setError("No se pudo. Intenta de nuevo."); return; }
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 font-body text-[13px]" data-admin="asesoria-este">
      {habilitado ? (
        <>
          <span>Habilitado: aquí ves la asesoría aunque esté en «lista». Cierra sesión para probarla sin cuenta.</span>
          <button type="button" disabled={ocupado} onClick={() => enviar("quitar")} className="rounded-full border border-[var(--franco-border)] px-3 py-1.5">Quitar este dispositivo</button>
        </>
      ) : (
        <>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (ej. iPhone de prueba)" maxLength={80} className="rounded-lg border border-[var(--franco-border)] px-2 py-1.5" />
          <button type="button" disabled={ocupado} onClick={() => enviar("habilitar")} className="rounded-full bg-[var(--franco-text)] px-3 py-1.5 font-semibold text-[var(--franco-bg)]">Habilitar este dispositivo</button>
        </>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
