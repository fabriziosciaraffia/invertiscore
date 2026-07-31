"use client";

/**
 * Toggle de acceso ilimitado — pieza de cliente (Fase 2 · Acción 4).
 *
 * Muestra el estado ACTUAL con su ORIGEN, que es la información que faltaba: sin
 * eso, "Ilimitado" no dice si lo paga el usuario o se lo regaló un admin, y son
 * dos cosas con consecuencias opuestas.
 *
 * La confirmación dice a quién afecta y qué efecto tiene (analizar sin consumir
 * saldo), porque encender esto es regalar acceso sin tope.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 py-2 " +
  "font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] " +
  "focus:border-[var(--franco-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--franco-text)]";

const BTN_CLASS =
  "rounded-md border border-[var(--franco-border)] px-3 py-1.5 font-body text-xs font-medium " +
  "text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-strong)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

async function errorDe(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `Error ${res.status}`;
}

export type UnlimitedEstado = {
  isUnlimited: boolean;
  /** 'subscription' | 'manual' | null */
  source: string | null;
  /** Motivo del último encendido manual (del audit log). */
  motivo: string | null;
  /** Quién lo encendió a mano, ya formateado con fecha. */
  porQuien: string | null;
  /** true si la suscripción está vigente → el server bloquea el apagado. */
  suscripcionVigente: boolean;
};

export function UnlimitedToggle({
  targetUserId,
  targetEmail,
  estado,
}: {
  targetUserId: string;
  targetEmail: string;
  estado: UnlimitedEstado;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, startTransition] = useTransition();

  const ocupado = busy || refrescando;
  const motivoOk = motivo.trim().length >= MOTIVO_MIN;
  const activar = !estado.isUnlimited;

  // Apagar un ilimitado de suscripción vigente lo rechaza el server; acá se
  // adelanta el motivo para no hacer perder el viaje.
  const bloqueado =
    !activar && estado.source === "subscription" && estado.suscripcionVigente;

  async function aplicar() {
    if (ocupado || !motivoOk || bloqueado) return;

    const efecto = activar
      ? "Va a poder analizar SIN consumir saldo, sin tope y sin pagar."
      : "Deja de tener acceso sin tope y vuelve a consumir su saldo normal.";
    if (
      !window.confirm(
        `¿${activar ? "Encender" : "Apagar"} el acceso ilimitado de ${targetEmail}?\n\n` +
          `${efecto}\n\nMotivo: ${motivo.trim()}`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/unlimited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, activar, motivo }),
      });
      if (!res.ok) {
        setError(await errorDe(res));
        return;
      }
      setMotivo("");
      setAbierto(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  // ── Línea de estado: el flag SIN su origen no dice nada útil ──
  const estadoLabel = !estado.isUnlimited
    ? "Sin acceso ilimitado"
    : estado.source === "manual"
    ? "Ilimitado por admin"
    : estado.source === "subscription"
    ? "Ilimitado por suscripción"
    : "Ilimitado (origen desconocido)";

  return (
    <div className="border-t border-[var(--franco-border)] mt-3 pt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
        Acceso ilimitado
      </div>
      <div className="font-body text-xs text-[var(--franco-text)] mt-1">{estadoLabel}</div>

      {estado.source === "manual" && (estado.motivo || estado.porQuien) && (
        <div className="mt-1">
          {estado.motivo && (
            <p className="font-body text-xs text-[var(--franco-text)]">{estado.motivo}</p>
          )}
          {estado.porQuien && (
            <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-0.5">
              {estado.porQuien}
            </div>
          )}
        </div>
      )}

      {bloqueado ? (
        <p className="font-body text-xs text-[var(--franco-text-muted)] mt-2">
          Viene de una suscripción vigente: se da de baja por el flujo de suscripciones,
          no desde acá.
        </p>
      ) : !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={`${BTN_CLASS} mt-2`}
        >
          {activar ? "Encender ilimitado" : "Apagar ilimitado"}
        </button>
      ) : (
        <>
          <textarea
            rows={2}
            value={motivo}
            maxLength={MOTIVO_MAX}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={ocupado}
            aria-label="Motivo del cambio de acceso ilimitado"
            placeholder={
              activar
                ? "Motivo (obligatorio): por qué este usuario accede sin tope y sin pagar."
                : "Motivo (obligatorio): por qué se le retira el acceso ilimitado."
            }
            className={`mt-2 ${TEXTAREA_CLASS}`}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
              {motivo.trim().length < MOTIVO_MIN
                ? `motivo: ${motivo.trim().length}/${MOTIVO_MIN} mín`
                : `${motivo.length}/${MOTIVO_MAX}`}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setMotivo("");
                  setError(null);
                }}
                disabled={ocupado}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)] transition-colors hover:text-[var(--franco-text)] disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicar}
                disabled={ocupado || !motivoOk}
                className={BTN_CLASS}
              >
                {ocupado ? "Aplicando…" : activar ? "Encender" : "Apagar"}
              </button>
            </div>
          </div>
        </>
      )}

      {error && <p className="mt-2 font-body text-xs text-[var(--signal-red)]">{error}</p>}
    </div>
  );
}
