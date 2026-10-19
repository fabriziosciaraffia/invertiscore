"use client";

// Cancelar el plan (19-oct-2026: copy de la oferta nueva —ya no hay «Pro» ni «Free»— y sin rojo: cancelar no es un error).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CUENTA_COPY } from "./cuenta-copy";

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const C = CUENTA_COPY.cancelar;

  async function handleCancel() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/cancel-subscription", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || CUENTA_COPY.error);
        setLoading(false);
        return;
      }
      router.refresh();
      setOpen(false);
    } catch {
      setError(CUENTA_COPY.error);
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[14px] text-[var(--franco-text)] underline underline-offset-4" data-cuenta="cancelar">
        {C.boton}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-label={C.pregunta}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6" style={{ fontFamily: "var(--font-ui), Inter, sans-serif" }}>
            <h3 className="m-0 text-[18px] font-semibold text-[var(--franco-text)]">{C.pregunta}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--franco-text-secondary)]">{C.texto}</p>
            {error && <p role="alert" className="mt-2 text-[13px] text-[var(--signal-red)]">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={handleCancel} disabled={loading}
                className="h-11 flex-1 rounded-full border-[1.5px] border-[var(--franco-text)] text-[14px] font-semibold text-[var(--franco-text)] disabled:opacity-50">
                {loading ? C.cancelando : C.si}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={loading}
                className="h-11 flex-1 rounded-full bg-[var(--franco-text)] text-[14px] font-semibold text-[var(--franco-bg)]">
                {C.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
