"use client";

/**
 * ShareButton — botón "Compartir" reutilizable (chrome).
 *
 * Generalización del antiguo `app/analisis/[id]/share-button.tsx` (atado a
 * LTR) a un componente compartido por LTR / STR / AMBAS. Se inyecta en el
 * `actionsSlot` de UnifiedNav.
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
 */

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Link2, Mail, Download } from "lucide-react";

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
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const posthog = usePostHog();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : "";

  const handleClick = async () => {
    posthog?.capture('analysis_shared', { analysis_id: analysisId, comuna, score, modalidad });
    // Si hay PDF para descargar, abrimos el menú propio: el share nativo del SO solo
    // comparte la URL y no puede exponer "Descargar PDF". Con pdfUrl presente preferimos
    // el menú (que igual trae WhatsApp / Copiar link / Email / X + Descargar PDF).
    if (pdfUrl) {
      setOpen(!open);
      return;
    }
    // Mobile: use native share
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled or not supported, fall through to dropdown
      }
    }
    setOpen(!open);
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
      <Button variant="outline" size="sm" className="gap-2 border-[var(--franco-border)] bg-[var(--franco-card)] text-[var(--franco-text)] hover:bg-[var(--franco-elevated)] hover:text-[var(--franco-text)]" onClick={handleClick}>
        <Share2 className="h-4 w-4 text-[var(--franco-text-secondary)]" /> Compartir
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[var(--franco-border-strong)] bg-[var(--franco-card)] p-2 shadow-lg">
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
        </div>
      )}
    </div>
  );
}
