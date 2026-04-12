"use client";

import { useState } from "react";

type State = "idle" | "confirm" | "sending" | "sent" | "error";

export function DeleteAccountButton() {
  const [state, setState] = useState<State>("idle");

  async function handleRequest() {
    setState("sending");
    try {
      const res = await fetch("/api/account/request-deletion", { method: "POST" });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="font-body text-sm text-[#16A34A]">
        Solicitud enviada — Recibirás confirmación por email
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className="font-body text-sm text-[#71717A]">
        No se pudo enviar la solicitud.{" "}
        <a
          href="mailto:hola@refranco.ai?subject=Solicitud%20eliminación%20de%20cuenta"
          className="text-[#C8323C] hover:underline"
        >
          Escríbenos a hola@refranco.ai
        </a>
      </p>
    );
  }

  if (state === "confirm" || state === "sending") {
    return (
      <div>
        <p className="font-body text-sm text-[#FAFAF8] mb-3">
          ¿Estás seguro? Se enviará una solicitud para eliminar tu cuenta y todos tus datos.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRequest}
            disabled={state === "sending"}
            className="rounded-md border border-[#C8323C] bg-transparent px-3 py-1.5 font-body text-sm text-[#C8323C] transition-colors hover:bg-[#C8323C]/10 disabled:opacity-50"
          >
            {state === "sending" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando solicitud...
              </span>
            ) : (
              "Sí, solicitar eliminación"
            )}
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            disabled={state === "sending"}
            className="font-body text-sm text-[#71717A] hover:text-[#FAFAF8] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      className="font-body text-sm text-[#71717A] hover:text-[#C8323C] transition-colors"
    >
      Solicitar eliminación de cuenta
    </button>
  );
}
