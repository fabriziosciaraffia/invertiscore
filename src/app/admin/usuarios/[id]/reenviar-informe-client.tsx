"use client";

/**
 * Botón de reenvío del informe, una instancia por fila de análisis del timeline
 * (Fase 2 · Acción 2).
 *
 * Tres cosas que este botón hace distinto al de las notas:
 *  1. CONFIRMA antes de enviar. El correo sale y no vuelve — no hay deshacer.
 *  2. Se DESHABILITA con motivo visible (`title` + cursor) cuando el análisis no
 *     califica: pendiente de pago, no premium, o STR. El servidor vuelve a
 *     validar todo igual; esto es para no hacerle perder el clic al operador.
 *  3. Muestra el ÚLTIMO reenvío exitoso al lado, leído de admin_audit_log. Es la
 *     única memoria de que el correo ya salió: no hay idempotencia, así que sin
 *     ese dato es imposible saber si ya se mandó.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const LINK_CLASS =
  "font-mono text-[10px] uppercase tracking-wider transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export type ReenvioInfo = {
  /** Fecha ya formateada en el server (evita hydration mismatch). */
  fechaLabel: string;
  adminEmail: string;
};

export function ReenviarInformeButton({
  analisisId,
  /** Destinatario del correo. Va en la confirmación: el operador tiene que ver
   *  a qué casilla sale antes de mandar algo que no se puede deshacer. */
  targetEmail,
  /** Motivo por el que NO se puede reenviar. null = habilitado. */
  motivoBloqueo,
  ultimoReenvio,
}: {
  analisisId: string;
  targetEmail: string;
  motivoBloqueo: string | null;
  ultimoReenvio: ReenvioInfo | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, startTransition] = useTransition();

  const ocupado = busy || refrescando;
  const bloqueado = motivoBloqueo !== null;

  async function reenviar() {
    if (ocupado || bloqueado) return;

    const yaMandado = ultimoReenvio
      ? `\n\nOJO: ya se reenvió el ${ultimoReenvio.fechaLabel} (${ultimoReenvio.adminEmail}).`
      : "";
    if (
      !window.confirm(
        `¿Reenviar el correo del informe a ${targetEmail}?\n\nEl correo sale al instante y no se puede deshacer.${yaMandado}`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reenviar-informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analisisId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error || `Error ${res.status}`);
        return;
      }
      // Refresca para que el "Reenviado …" de al lado quede al día (sale del
      // audit log, que solo se lee en el server).
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={reenviar}
        disabled={ocupado || bloqueado}
        title={motivoBloqueo ?? "Reenvía el correo «tu análisis está listo» al usuario"}
        className={`${LINK_CLASS} ${
          bloqueado
            ? "text-[var(--franco-text-muted)]"
            : "text-[var(--franco-text-muted)] hover:text-[var(--franco-text)]"
        }`}
      >
        {ocupado ? "Enviando…" : "Reenviar informe"}
      </button>

      {ultimoReenvio && (
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
          Reenviado {ultimoReenvio.fechaLabel} · {ultimoReenvio.adminEmail}
        </span>
      )}

      {error && (
        <span className="max-w-[280px] text-right font-body text-xs text-[var(--signal-red)]">
          {error}
        </span>
      )}
    </div>
  );
}
