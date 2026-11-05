"use client";

// Pedir la eliminación de la cuenta (05-nov-2026, auditoría de promesas parte 2): al pedirlo se detienen los correos y se
// cancela el plan en Flow, aunque el borrado sea manual (api/account/request-deletion). La pantalla dice lo que pasó: si la
// confirmación por correo no salió, o Flow no confirmó la cancelación, no lo afirma.
import { useState } from "react";
import { ELIMINAR_COPY } from "./cuenta-copy";

type State = "idle" | "confirm" | "sending" | "sent" | "error";

export function DeleteAccountButton() {
  const [state, setState] = useState<State>("idle");
  const [resultado, setResultado] = useState<{ confirmacion: boolean; planCancelado: boolean } | null>(null);
  const C = ELIMINAR_COPY;

  async function handleRequest() {
    setState("sending");
    try {
      const res = await fetch("/api/account/request-deletion", { method: "POST" });
      if (!res.ok) {
        setState("error");
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { confirmacion?: boolean; planCancelado?: boolean };
      setResultado({ confirmacion: d.confirmacion !== false, planCancelado: d.planCancelado !== false });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="font-body text-sm text-[var(--franco-text-secondary)]" data-eliminar="listo">
        {C.listo} {resultado?.planCancelado === false ? C.planPendiente : C.planCancelado} {resultado?.confirmacion === false ? C.sinConfirmacion : C.conConfirmacion}
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className="font-body text-sm text-[var(--franco-text-muted)]" data-eliminar="error">
        {C.error}{" "}
        <a
          href="mailto:hola@refranco.ai?subject=Solicitud%20eliminación%20de%20cuenta"
          className="text-signal-red hover:underline"
        >
          {C.escribenos}
        </a>
      </p>
    );
  }

  if (state === "confirm" || state === "sending") {
    return (
      <div>
        <p className="font-body text-sm text-[var(--franco-text)] mb-3">{C.pregunta}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRequest}
            disabled={state === "sending"}
            className="rounded-md border border-signal-red bg-transparent px-3 py-1.5 font-body text-sm text-signal-red transition-colors hover:bg-signal-red/10 disabled:opacity-50"
          >
            {state === "sending" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {C.enviando}
              </span>
            ) : (
              C.si
            )}
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            disabled={state === "sending"}
            className="font-body text-sm text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] transition-colors disabled:opacity-50"
          >
            {C.no}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      className="font-body text-sm text-[var(--franco-text-muted)] hover:text-signal-red transition-colors"
    >
      {C.boton}
    </button>
  );
}
