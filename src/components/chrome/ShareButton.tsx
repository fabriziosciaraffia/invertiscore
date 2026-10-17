"use client";

/**
 * ShareButton — botón "Compartir" reutilizable (chrome).
 *
 * Generalización del antiguo `app/analisis/[id]/share-button.tsx` (atado a
 * LTR) a un componente compartido por LTR / STR / AMBAS. Se inyecta en el
 * header único (HeaderFranco, `informe.compartir`) con `variante="banda"`.
 *
 * Comportamiento (idéntico al original):
 *   - Móvil: usa `navigator.share` nativo si existe (con `title`/`text`).
 *   - Desktop / fallback: dropdown con Copiar link · WhatsApp · Email · X.
 *   - posthog.capture('analysis_shared', { analysis_id, comuna, score, modalidad }).
 *
 * Única adición sobre el original: si llega `pdfUrl`, se agrega la opción
 * "Descargar PDF" al dropdown; si no, no se muestra.
 *
 * La URL compartida se arma con `window.location.origin + path`.
 *
 * INVITA A ALGUIEN (16-oct-2026, la puerta C): el botón solo lo ve el dueño del informe (HeaderFranco › modo «propio»,
 * con sesión), así que el menú lleva su enlace de invitación —«los dos reciben un análisis»—, que se pide al abrir el
 * menú (/api/invitacion). Para que se vea también en el teléfono, el menú se abre siempre, como con el PDF; el menú
 * nativo del sistema queda como «Más opciones».
 * Desde el 17-oct-2026 (decisión de Fabrizio) va ARRIBA de las demás opciones y destacado con el color de «Invita a
 * alguien» del dashboard (invita.css › .iv-menu). Se dibuja al abrir —su texto es fijo— y se habilita cuando llega el
 * enlace, para no correr las opciones de abajo; si el enlace no llega, sale.
 */

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Link2, Mail, Download, MoreHorizontal, UserPlus } from "lucide-react";
import { REFERIDO_COPY } from "@/lib/referido";
import "@/components/invitacion/invita.css";

export type ShareModalidad = "LTR" | "STR" | "AMBAS";

export interface ShareButtonProps {
  /** Link relativo a compartir, ej. `/analisis/${id}`. La URL completa se
   *  arma con `window.location.origin`. */
  path: string;
  /** ID del análisis para analytics (posthog `analysis_id`). */
  analysisId: string;
  /** Título para navigator.share. */
  title: string;
  /** Texto para navigator.share. */
  text: string;
  /** Datos usados para los mensajes sociales (WhatsApp/Email/X). Opcionales. */
  score?: number;
  nombre?: string;
  comuna?: string;
  /** Si viene, agrega la opción "Descargar PDF" al dropdown. */
  pdfUrl?: string;
  /** Modalidad del análisis — se incluye en el evento de analytics. */
  modalidad: ShareModalidad;
  /** «banda»: el disparador va sobre la banda del header único (HeaderFranco), como botón
   *  secundario en papel; a 390, solo el ícono. El desplegable no cambia. */
  variante?: "pagina" | "banda";
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ShareButton({
  path,
  analysisId,
  title,
  text,
  score,
  nombre,
  comuna,
  pdfUrl,
  modalidad,
  variante = "pagina",
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const posthog = usePostHog();
  const [invitacion, setInvitacion] = useState<{ url: string; nombre: string | null } | null>(null);
  const [invitaCopiada, setInvitaCopiada] = useState(false);
  const [sinInvitacion, setSinInvitacion] = useState(false);
  const [nativo, setNativo] = useState(false);

  useEffect(() => {
    setNativo(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // El enlace de invitación, la primera vez que se abre el menú (sin sesión responde 401 y la línea no aparece).
  useEffect(() => {
    if (!open || invitacion || sinInvitacion) return;
    let vivo = true;
    void fetch("/api/invitacion", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string; nombre?: string | null } | null) => {
        if (!vivo) return;
        if (d?.url) setInvitacion({ url: d.url, nombre: d.nombre ?? null });
        else setSinInvitacion(true);
      })
      .catch(() => { if (vivo) setSinInvitacion(true); });
    return () => { vivo = false; };
  }, [open, invitacion, sinInvitacion]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : "";

  const handleClick = () => {
    posthog?.capture('analysis_shared', { analysis_id: analysisId, comuna, score, modalidad });
    // El menú propio siempre (16-oct-2026): el share nativo del SO solo comparte la URL y no puede exponer «Descargar
    // PDF» ni «Invita a alguien». El nativo queda adentro, como «Más opciones».
    setOpen(!open);
  };

  const shareNativo = async () => {
    setOpen(false);
    try {
      await navigator.share({ title, text, url });
    } catch {
      /* canceló */
    }
  };

  // Invita a alguien: el menú nativo con el mensaje de la invitación; sin él, copia el enlace.
  const invitar = async () => {
    if (!invitacion) return;
    posthog?.capture('invitacion_compartida', { con_nombre: !!invitacion.nombre, donde: 'compartir_informe' });
    if (nativo) {
      setOpen(false);
      try {
        await navigator.share({ title: REFERIDO_COPY.quien(invitacion.nombre), text: REFERIDO_COPY.textoCompartir(invitacion.nombre), url: invitacion.url });
      } catch {
        /* canceló */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(invitacion.url);
      setInvitaCopiada(true);
      setTimeout(() => { setInvitaCopiada(false); setOpen(false); }, 1500);
    } catch {
      /* sin portapapeles */
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const shareWhatsApp = () => {
    // Sin score (AMBAS): usa `text`. Con score (LTR/STR): mensaje original.
    const msg =
      score === undefined
        ? `${text} → ${url}`
        : `Analicé este depto con Franco y el Score es ${score}/100. Míralo acá → ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    setOpen(false);
  };

  const shareEmail = () => {
    // Sin score (AMBAS): subject = `title`, body = `text`. Con score: original.
    const subject =
      score === undefined ? title : `Te comparto mi análisis Franco: ${nombre}`;
    const comunaText = comuna ? `\nComuna: ${comuna}` : "";
    const body =
      score === undefined
        ? `${text}\n\nVer comparativa: ${url}`
        : `Hice un análisis de inversión con Franco para este depto.\n\nScore: ${score}/100${comunaText}\n\nVer análisis: ${url}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setOpen(false);
  };

  const shareX = () => {
    // Sin score (AMBAS): usa `text`. Con score (LTR/STR): mensaje original.
    const msg =
      score === undefined
        ? `${text} ${url}`
        : `Analicé este depto con Franco: Score ${score}/100 🏠 ${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, "_blank");
    setOpen(false);
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    // Navegación directa: el endpoint responde Content-Disposition: attachment.
    window.location.href = pdfUrl;
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {variante === "banda" ? (
        <button type="button" className="hf-ghost" onClick={handleClick} aria-label="Compartir">
          <Share2 aria-hidden="true" /><span className="hf-solo-ancho">Compartir</span>
        </button>
      ) : (
        <Button variant="outline" size="sm" className="gap-2 border-[var(--franco-border)] bg-[var(--franco-card)] text-[var(--franco-text)] hover:bg-[var(--franco-elevated)] hover:text-[var(--franco-text)]" onClick={handleClick}>
          <Share2 className="h-4 w-4 text-[var(--franco-text-secondary)]" /> Compartir
        </Button>
      )}

      {/* En el teléfono el menú va al ancho de la pantalla, bajo el header (QA a 390, 16-oct-2026): colgado del botón, que
          está a la izquierda de «Nuevo análisis», se salía por el borde. Desde 640 px, colgado del botón como siempre. */}
      {open && (
        <div data-compartir="menu" className="fixed inset-x-4 top-16 z-50 rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56 border border-[var(--franco-border-strong)] bg-[var(--franco-card)] p-2 shadow-lg">
          {!sinInvitacion && (
            <button onClick={() => void invitar()} disabled={!invitacion} className="iv-menu mb-1.5 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold" data-compartir="invitar">
              {invitaCopiada ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="flex flex-col">
                <span>{invitaCopiada ? REFERIDO_COPY.copiado : REFERIDO_COPY.menuCompartir}</span>
                <span className="iv-m-nota text-xs font-normal">{REFERIDO_COPY.menuCompartirNota}</span>
              </span>
            </button>
          )}
          <button onClick={shareWhatsApp} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]">
            <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
            WhatsApp
          </button>
          <button onClick={copyLink} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]">
            {copied ? <Check className="h-4 w-4 text-ink-400" /> : <Link2 className="h-4 w-4 text-[var(--franco-text-secondary)]" />}
            {copied ? "Link copiado" : "Copiar link"}
          </button>
          <button onClick={shareEmail} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]">
            <Mail className="h-4 w-4 text-[var(--franco-text-secondary)]" />
            Email
          </button>
          <button onClick={shareX} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]">
            <XIcon className="h-4 w-4 text-[var(--franco-text)]" />
            X (Twitter)
          </button>
          {pdfUrl && (
            <button onClick={downloadPDF} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]">
              <Download className="h-4 w-4 text-[var(--franco-text-secondary)]" />
              Descargar PDF
            </button>
          )}
          {nativo && (
            <button onClick={() => void shareNativo()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]" data-compartir="nativo">
              <MoreHorizontal className="h-4 w-4 text-[var(--franco-text-secondary)]" />
              Más opciones
            </button>
          )}
        </div>
      )}
    </div>
  );
}
