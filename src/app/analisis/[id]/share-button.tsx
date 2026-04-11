"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Link2, Mail } from "lucide-react";

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

export function ShareButton({ id, score, nombre, comuna }: { id: string; score: number; nombre: string; comuna?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const url = typeof window !== "undefined" ? `${window.location.origin}/analisis/${id}` : "";

  const handleClick = async () => {
    try { const ph = (await import('posthog-js')).default; ph.capture('share_clicked', { method: 'native_or_dropdown' }); } catch {}
    // Mobile: use native share
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Análisis Franco: ${nombre}`,
          text: `Mira el análisis de este depto. Score: ${score}/100`,
          url,
        });
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
    const text = `Analicé este depto con Franco y el Score es ${score}/100. Míralo acá → ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setOpen(false);
  };

  const shareEmail = () => {
    const subject = `Te comparto mi análisis Franco: ${nombre}`;
    const comunaText = comuna ? `\nComuna: ${comuna}` : "";
    const body = `Hice un análisis de inversión con Franco para este depto.\n\nScore: ${score}/100${comunaText}\n\nVer análisis: ${url}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setOpen(false);
  };

  const shareX = () => {
    const text = `Analicé este depto con Franco: Score ${score}/100 🏠 ${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleClick}>
        <Share2 className="h-4 w-4" /> Compartir
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-th-border-strong bg-th-card p-2 shadow-lg">
          <button onClick={shareWhatsApp} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-text transition-colors hover:bg-white/[0.08]">
            <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
            WhatsApp
          </button>
          <button onClick={copyLink} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-text transition-colors hover:bg-white/[0.08]">
            {copied ? <Check className="h-4 w-4 text-[#B0BEC5]" /> : <Link2 className="h-4 w-4 text-th-text-secondary" />}
            {copied ? "Link copiado" : "Copiar link"}
          </button>
          <button onClick={shareEmail} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-text transition-colors hover:bg-white/[0.08]">
            <Mail className="h-4 w-4 text-th-text-secondary" />
            Email
          </button>
          <button onClick={shareX} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-text transition-colors hover:bg-white/[0.08]">
            <XIcon className="h-4 w-4 text-th-text" />
            X (Twitter)
          </button>
        </div>
      )}
    </div>
  );
}
