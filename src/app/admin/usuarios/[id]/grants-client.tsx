"use client";

/**
 * Otorgar y revertir análisis — piezas de cliente (Fase 2 · Acción 3).
 *
 *  - OtorgarAnalisisForm: cantidad + motivo, en la card de saldo.
 *  - RevertirGrantButton: solo se renderiza en lotes manuales INTACTOS.
 *
 * Es la primera acción del panel que mueve saldo real, así que la confirmación
 * dice CUÁNTO y A QUIÉN antes de escribir. El servidor revalida todo igual: los
 * límites de acá son para no hacerle perder el viaje al operador, no la defensa.
 *
 * Cromático Ink + Signal Red: rojo solo en errores de formulario (uso #6) y en
 * el hover de "Revertir" (acción destructiva). Sin verde para el OK — la
 * confirmación es que el saldo cambia en pantalla.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CANTIDAD_MIN = 1;
const CANTIDAD_MAX = 20;
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;

const INPUT_CLASS =
  "w-full rounded-md border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 py-2 " +
  "font-mono text-sm text-[var(--franco-text)] " +
  "focus:border-[var(--franco-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--franco-text)]";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 py-2 " +
  "font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] " +
  "focus:border-[var(--franco-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--franco-text)]";

const BTN_CLASS =
  "rounded-md border border-[var(--franco-border)] px-3 py-1.5 font-body text-xs font-medium " +
  "text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-strong)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const LINK_CLASS =
  "font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)] " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-40";

async function errorDe(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `Error ${res.status}`;
}

export function OtorgarAnalisisForm({
  targetUserId,
  targetEmail,
}: {
  targetUserId: string;
  targetEmail: string;
}) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, startTransition] = useTransition();

  const ocupado = busy || refrescando;
  const n = Number(cantidad);
  const cantidadOk = Number.isInteger(n) && n >= CANTIDAD_MIN && n <= CANTIDAD_MAX;
  const motivoOk = motivo.trim().length >= MOTIVO_MIN;

  async function otorgar() {
    if (ocupado || !cantidadOk || !motivoOk) return;

    if (
      !window.confirm(
        `¿Otorgar ${n} ${n === 1 ? "análisis" : "análisis"} a ${targetEmail}?\n\n` +
          `Motivo: ${motivo.trim()}\n\n` +
          `Es saldo real que el usuario puede gastar. Se puede revertir solo mientras no consuma nada.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, cantidad: n, motivo }),
      });
      if (!res.ok) {
        setError(await errorDe(res));
        return;
      }
      setCantidad("1");
      setMotivo("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--franco-border)] mt-3 pt-3">
      <label
        htmlFor="grant-cantidad"
        className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]"
      >
        Otorgar análisis
      </label>
      <div className="flex items-start gap-2">
        <input
          id="grant-cantidad"
          type="number"
          inputMode="numeric"
          min={CANTIDAD_MIN}
          max={CANTIDAD_MAX}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          disabled={ocupado}
          aria-label="Cantidad de análisis a otorgar"
          className={`${INPUT_CLASS} w-20 shrink-0`}
        />
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)] pt-2.5">
          máx {CANTIDAD_MAX}
        </span>
      </div>
      <textarea
        rows={2}
        value={motivo}
        maxLength={MOTIVO_MAX}
        onChange={(e) => setMotivo(e.target.value)}
        disabled={ocupado}
        aria-label="Motivo del otorgamiento"
        placeholder="Motivo (obligatorio): por qué este usuario recibe análisis sin pagarlos."
        className={`mt-2 ${TEXTAREA_CLASS}`}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
          {motivo.trim().length < MOTIVO_MIN
            ? `motivo: ${motivo.trim().length}/${MOTIVO_MIN} mín`
            : `${motivo.length}/${MOTIVO_MAX}`}
        </span>
        <button
          type="button"
          onClick={otorgar}
          disabled={ocupado || !cantidadOk || !motivoOk}
          className={BTN_CLASS}
        >
          {ocupado ? "Otorgando…" : "Otorgar"}
        </button>
      </div>
      {error && <p className="mt-2 font-body text-xs text-[var(--signal-red)]">{error}</p>}
    </div>
  );
}

export function RevertirGrantButton({
  grantId,
  cantidad,
}: {
  grantId: string;
  cantidad: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, startTransition] = useTransition();

  const ocupado = busy || refrescando;

  async function revertir() {
    if (ocupado) return;
    if (
      !window.confirm(
        `¿Revertir este lote de ${cantidad} ${cantidad === 1 ? "análisis" : "análisis"}?\n\n` +
          `El saldo del usuario baja en ${cantidad}. El lote no se borra: queda en cero y registrado.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/grants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        setError(await errorDe(res));
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={revertir}
        disabled={ocupado}
        title="Devuelve el lote a cero. Solo mientras el usuario no haya consumido nada."
        className={`${LINK_CLASS} hover:text-[var(--signal-red)]`}
      >
        {ocupado ? "…" : "Revertir"}
      </button>
      {error && (
        <p className="mt-1 font-body text-xs text-[var(--signal-red)]">{error}</p>
      )}
    </>
  );
}
