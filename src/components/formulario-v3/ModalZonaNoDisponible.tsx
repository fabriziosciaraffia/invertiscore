"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";

/**
 * Warning bloqueante cuando la comuna detectada está fuera de cobertura.
 * Franco hoy solo analiza el Gran Santiago. Ofrece avisar por email cuando
 * llegue a la comuna detectada (lead → waitlist_zonas) y permite cambiar la
 * dirección. No deja avanzar el paso 1 (el gate vive en el wizard).
 */
export function ModalZonaNoDisponible({
  open,
  onClose,
  comuna,
  defaultEmail,
}: {
  open: boolean;
  onClose: () => void;
  /** Comuna detectada fuera de cobertura (para personalizar el CTA). */
  comuna: string;
  /** Email del usuario logueado, si lo hay — prefill del input. */
  defaultEmail?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Reset al abrir; prefill con el email del usuario logueado si existe.
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setStatus("idle");
    }
  }, [open, defaultEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist/zona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, comuna }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  const comunaLabel = comuna?.trim() ? comuna.trim() : "tu zona";

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdropClick={false}
      title="Por ahora, solo Gran Santiago"
      maxWidth="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="font-body font-medium text-[14px] text-white px-5 py-2.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[40px]"
        >
          Cambiar dirección
        </button>
      }
    >
      <p className="font-body text-[14px] leading-[1.6] text-[var(--franco-text-secondary)] m-0">
        Por ahora Franco solo analiza departamentos del Gran Santiago. Estamos
        trabajando en más zonas.
      </p>

      {status === "success" ? (
        <div
          className="mt-5 rounded-xl p-4"
          style={{
            border: "0.5px solid var(--franco-border)",
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          }}
        >
          <p className="font-body text-[13px] leading-[1.5] text-[var(--franco-text)] m-0">
            Listo. Te avisamos apenas Franco llegue a {comunaLabel}.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5">
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] block mb-2">
            Avísame cuando llegue a {comunaLabel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="flex-1 h-10 rounded-lg border-[0.5px] bg-[var(--franco-card)] px-3 text-[14px] font-body text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:outline-none focus:ring-1 focus:ring-signal-red/20 focus:border-signal-red transition-colors"
              style={{ borderColor: status === "error" ? "#C8323C" : "var(--franco-border)" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="shrink-0 h-10 rounded-lg bg-[var(--franco-text)] px-5 font-body text-[13px] font-medium text-[var(--franco-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "Enviando…" : "Avisarme"}
            </button>
          </div>
          {status === "error" && (
            <p className="mt-2 font-body text-[12px] text-[#C8323C] m-0">
              Revisa el email e intenta de nuevo.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
