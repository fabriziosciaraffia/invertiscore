"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botón de re-emisión de boleta para filas en estado 'error'. Molde de
// AdminActions pero SIN verde (Capa 1 del design system): OK usa Ink, error usa
// Signal Red. Tras éxito refresca la página para que la fila refleje el nuevo
// estado. Si el helper venía con el kill-switch apagado (skipped), lo comunica
// sin tratarlo como error.
type Status = "idle" | "running" | "ok" | "error" | "skipped";

export function RetryButton({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | undefined>();

  async function run() {
    if (status === "running") return;
    setStatus("running");
    setMessage(undefined);
    try {
      const res = await fetch("/api/admin/documentos/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentoId }),
      });
      const data = await res.json().catch(() => ({}));

      if (data?.skipped) {
        setStatus("skipped");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }
      if (!res.ok || !data?.ok) {
        setStatus("error");
        setMessage(data?.error || "Error");
        return;
      }
      setStatus("ok");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Error");
    }
  }

  function text() {
    if (status === "running") return "Emitiendo…";
    if (status === "ok") return "Listo ✓";
    if (status === "error") return "Error ✗";
    if (status === "skipped") return "emisión desactivada";
    return "Reintentar";
  }

  const base =
    "px-3 py-1 rounded-md border font-mono text-[10px] uppercase transition-colors";
  let cls: string;
  if (status === "ok") {
    cls = `${base} border-[var(--ink-400)] text-[var(--ink-400)]`;
  } else if (status === "error") {
    cls = `${base} border-[#C8323C] text-[#C8323C]`;
  } else if (status === "running") {
    cls = `${base} border-[var(--franco-border)] text-[var(--franco-text-muted)] cursor-wait`;
  } else if (status === "skipped") {
    cls = `${base} border-[var(--ink-700)] text-[var(--ink-700)]`;
  } else {
    cls = `${base} border-[var(--franco-border)] text-[var(--franco-text)] hover:border-[#C8323C]`;
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={run} disabled={status === "running"} className={cls}>
        {text()}
      </button>
      {status === "error" && message && (
        <span
          className="font-mono text-[10px] text-[#C8323C]/70 max-w-[200px] truncate"
          title={message}
        >
          {message}
        </span>
      )}
    </div>
  );
}
