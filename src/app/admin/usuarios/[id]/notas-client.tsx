"use client";

/**
 * Notas internas — piezas de cliente de la ficha de usuario (Fase 2 · Acción 1).
 *
 *  - NotaComposer: alta de nota, arriba del timeline.
 *  - NotaCard: una nota dentro del timeline, con editar y borrar.
 *
 * Las fechas llegan YA FORMATEADAS desde el server (prop `fechaLabel`): usar
 * fmtRelative acá dispararía Date.now() en cliente y en servidor con resultados
 * distintos → hydration mismatch.
 *
 * Después de cada escritura, router.refresh() re-corre el Server Component: el
 * timeline se rearma con la nota nueva/editada/ausente sin manejar estado local
 * duplicado (una sola fuente de verdad: la DB).
 *
 * Cromático: Ink + Signal Red. El rojo aparece solo en errores de formulario
 * (uso #6) y en el hover de "Borrar" (acción destructiva, mismo criterio que
 * "Eliminar análisis" del menú de resultados). El OK no usa verde — la
 * confirmación es que la nota aparece en el timeline.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEXTO_MAX = 2000;

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-[var(--franco-border)] bg-[var(--franco-bg)] " +
  "px-3 py-2 font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] " +
  "focus:border-[var(--franco-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--franco-text)]";

const BTN_CLASS =
  "rounded-md border border-[var(--franco-border)] px-3 py-1.5 font-body text-xs font-medium " +
  "text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-strong)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const LINK_CLASS =
  "font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)] " +
  "transition-colors hover:text-[var(--franco-text)] disabled:cursor-not-allowed disabled:opacity-50";

/** Lee el error del endpoint; cae a un mensaje genérico si la respuesta no es JSON. */
async function errorDe(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `Error ${res.status}`;
}

export function NotaComposer({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vacio = texto.trim().length === 0;

  async function guardar() {
    if (busy || vacio) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, texto }),
      });
      if (!res.ok) {
        setError(await errorDe(res));
        return;
      }
      setTexto("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
      <label
        htmlFor="nota-nueva"
        className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]"
      >
        Nota interna
      </label>
      <textarea
        id="nota-nueva"
        rows={2}
        value={texto}
        maxLength={TEXTO_MAX}
        onChange={(e) => setTexto(e.target.value)}
        disabled={busy}
        placeholder="Contexto que el resto del equipo necesita saber de este usuario."
        className={TEXTAREA_CLASS}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
          {texto.length}/{TEXTO_MAX}
        </span>
        <button type="button" onClick={guardar} disabled={busy || vacio} className={BTN_CLASS}>
          {busy ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
      {error && (
        <p className="mt-2 font-body text-xs text-[var(--signal-red)]">{error}</p>
      )}
    </div>
  );
}

export type NotaView = {
  id: string;
  texto: string;
  autorEmail: string;
  /** Fecha ya formateada en el server (evita hydration mismatch). */
  fechaLabel: string;
  /** true si updated_at > created_at → la nota se editó al menos una vez. */
  editada: boolean;
};

export function NotaCard({ nota }: { nota: NotaView }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.texto);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(method: "PATCH" | "DELETE", body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await errorDe(res));
        return;
      }
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  function cancelar() {
    setTexto(nota.texto);
    setError(null);
    setEditando(false);
  }

  return (
    <article className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
          Nota interna
        </span>
        {!editando && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              disabled={busy}
              className={LINK_CLASS}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => enviar("DELETE", { notaId: nota.id })}
              disabled={busy}
              className={`${LINK_CLASS} hover:text-[var(--signal-red)]`}
            >
              {busy ? "…" : "Borrar"}
            </button>
          </div>
        )}
      </div>

      {editando ? (
        <>
          <textarea
            rows={3}
            value={texto}
            maxLength={TEXTO_MAX}
            onChange={(e) => setTexto(e.target.value)}
            disabled={busy}
            aria-label="Editar nota interna"
            className={`mt-2 ${TEXTAREA_CLASS}`}
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={cancelar} disabled={busy} className={LINK_CLASS}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => enviar("PATCH", { notaId: nota.id, texto })}
              disabled={busy || texto.trim().length === 0}
              className={BTN_CLASS}
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap font-body text-sm text-[var(--franco-text)]">
          {nota.texto}
        </p>
      )}

      <div className="mt-2 font-mono text-[10px] text-[var(--franco-text-muted)]">
        {nota.autorEmail} · {nota.fechaLabel}
        {nota.editada && " · editada"}
      </div>

      {error && (
        <p className="mt-2 font-body text-xs text-[var(--signal-red)]">{error}</p>
      )}
    </article>
  );
}
