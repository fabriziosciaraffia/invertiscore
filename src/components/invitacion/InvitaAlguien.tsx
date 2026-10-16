"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «Invita a alguien» (16-oct-2026, la puerta C): el enlace propio, copiar y compartir, y «Que diga mi nombre» —solo si la
// persona lo pide; por defecto el invitado ve «un amigo te invitó a Franco»—. Vive en el dashboard y en la página del
// propio enlace (`propio`). Sistema de la casa: Inter, Source Serif en el título, sin rojo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { REFERIDO_COPY } from "@/lib/referido";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const tarjeta = "rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)]";
const botonBorde = "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-[var(--franco-text)] px-5 text-[14px] font-semibold text-[var(--franco-text)] disabled:opacity-50";

export interface DatosInvitacion {
  codigo: string;
  url: string;
  texto: string;
  conNombre: boolean;
  nombre: string | null;
  nombreSugerido: string | null;
  pagados: number;
  cuenta: string;
}

export function InvitaAlguien({ variante = "casa" }: { variante?: "casa" | "propio" }) {
  const posthog = usePostHog();
  const [datos, setDatos] = useState<DatosInvitacion | null>(null);
  const [conNombre, setConNombre] = useState(false);
  const [nombre, setNombre] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    setPuedeCompartir(typeof navigator !== "undefined" && typeof navigator.share === "function");
    let vivo = true;
    void (async () => {
      try {
        const res = await fetch("/api/invitacion", { cache: "no-store" });
        if (!res.ok) { if (vivo) setError(REFERIDO_COPY.error); return; }
        const d = (await res.json()) as DatosInvitacion;
        if (!vivo) return;
        setDatos(d);
        setNombre(d.nombreSugerido ?? "");
      } catch {
        if (vivo) setError(REFERIDO_COPY.error);
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function pedir(body: { conNombre: boolean; nombre?: string }) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch("/api/invitacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError(REFERIDO_COPY.error); return false; }
      setDatos((await res.json()) as DatosInvitacion);
      setCopiado(false);
      return true;
    } catch {
      setError(REFERIDO_COPY.error);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function tocarNombre(si: boolean) {
    setConNombre(si);
    posthog?.capture("invitacion_nombre", { con_nombre: si });
    // Sin nombre vuelve al enlace de siempre; con nombre, el enlace con nombre espera a que lo confirme.
    if (!si && datos?.conNombre) await pedir({ conNombre: false });
  }

  async function usarNombre(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await pedir({ conNombre: true, nombre });
  }

  async function copiar() {
    if (!datos) return;
    try {
      await navigator.clipboard.writeText(datos.url);
      setCopiado(true);
      posthog?.capture("invitacion_copiada", { con_nombre: datos.conNombre, donde: variante });
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles: el enlace está a la vista para copiarlo a mano */
    }
  }

  async function compartir() {
    if (!datos) return;
    try {
      await navigator.share({ title: REFERIDO_COPY.quien(datos.nombre), text: REFERIDO_COPY.textoCompartir(datos.nombre), url: datos.url });
      posthog?.capture("invitacion_compartida", { con_nombre: datos.conNombre, donde: variante });
    } catch {
      /* canceló */
    }
  }

  return (
    <section id="invitar" style={{ fontFamily: UI, scrollMarginTop: 80 }} data-casa="invitar">
      {variante === "casa" ? (
        <>
          <h2 className="font-heading text-[21px] font-bold leading-[1.15] tracking-[-0.01em] sm:text-[24px]">{REFERIDO_COPY.invitaTitulo}</h2>
          <p className="mb-3 mt-1.5 max-w-[640px] text-[14.5px] text-[var(--franco-text-secondary)]">{REFERIDO_COPY.invitaTexto}</p>
        </>
      ) : (
        <p className="mb-3 max-w-[640px] text-[14.5px] text-[var(--franco-text-secondary)]">{REFERIDO_COPY.invitaTexto}</p>
      )}
      <div className={`${tarjeta} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-all text-[17px] font-semibold tracking-[-0.005em] tabular-nums" data-invitar="enlace">
            {datos ? datos.texto : <span className="text-[var(--franco-text-secondary)]">…</span>}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className={botonBorde} onClick={() => void copiar()} disabled={!datos || ocupado} data-invitar="copiar">
              {copiado ? REFERIDO_COPY.copiado : REFERIDO_COPY.copiar}
            </button>
            {puedeCompartir && (
              <button type="button" className={botonBorde} onClick={() => void compartir()} disabled={!datos || ocupado} data-invitar="compartir">
                {REFERIDO_COPY.compartir}
              </button>
            )}
          </div>
        </div>
        <label className="mt-3.5 flex w-fit cursor-pointer items-center gap-2 text-[14px]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--franco-text)]" checked={conNombre} onChange={(e) => void tocarNombre(e.target.checked)} disabled={!datos || ocupado} data-invitar="con-nombre" />
          {REFERIDO_COPY.conNombre}
        </label>
        {conNombre && (
          <form className="mt-2.5 flex flex-col gap-2 sm:flex-row" onSubmit={usarNombre} data-invitar="nombre">
            <input className="h-11 w-full min-w-0 shrink-0 rounded-xl sm:w-auto sm:flex-1 border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3.5 text-[15px] text-[var(--franco-text)]" maxLength={40}
              placeholder={REFERIDO_COPY.nombrePlaceholder} aria-label={REFERIDO_COPY.nombrePlaceholder} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
            <button type="submit" className={botonBorde} disabled={ocupado || !nombre.trim()}>{REFERIDO_COPY.usarNombre}</button>
          </form>
        )}
        {conNombre && datos?.conNombre && datos.nombre && (
          <p className="mt-2 text-[13px] text-[var(--franco-text-secondary)]" data-invitar="vista">{REFERIDO_COPY.quien(datos.nombre)}.</p>
        )}
        {datos && <p className="mt-3 text-[13px] text-[var(--franco-text-secondary)]" data-invitar="cuenta">{datos.cuenta}</p>}
        {error && <p className="mt-2 text-[13px] text-[var(--franco-text)]" role="alert">{error}</p>}
      </div>
    </section>
  );
}
