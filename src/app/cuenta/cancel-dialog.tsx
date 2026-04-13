"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/account/cancel-subscription", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Error al cancelar");
        setLoading(false);
        return;
      }
      router.refresh();
      setOpen(false);
    } catch {
      alert("Error de conexión");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#C8323C] bg-transparent px-4 py-2 font-body text-sm font-medium text-[#C8323C] transition-colors hover:bg-[#C8323C]/10"
      >
        Cancelar suscripción
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
            <h3 className="font-heading text-lg font-bold text-[var(--franco-text)]">¿Seguro que quieres cancelar?</h3>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-muted)] leading-relaxed">
              Mantendrás acceso Pro hasta el fin de tu período actual. Después volverás al plan Free.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 rounded-md border border-[#C8323C] bg-transparent px-4 py-2 font-body text-sm font-medium text-[#C8323C] transition-colors hover:bg-[#C8323C]/10 disabled:opacity-50"
              >
                {loading ? "Cancelando..." : "Sí, cancelar"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 rounded-md bg-[var(--franco-text)] px-4 py-2 font-body text-sm font-medium text-[var(--franco-bg)] transition-colors hover:opacity-90"
              >
                No, mantener
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
