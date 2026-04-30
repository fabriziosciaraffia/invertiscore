"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { usePostHog } from "posthog-js/react";

const STORAGE_KEY = "franco_pro_cta_dismissed_at";
const DEFAULT_THRESHOLD = 1;
const DEFAULT_DISMISS_DAYS = 7;

interface ProCTABannerProps {
  analysesCount: number;
  isLoggedIn: boolean;
  accessLevel: "guest" | "free" | "premium" | "subscriber";
  source?: string;
}

export function ProCTABanner({
  analysesCount,
  isLoggedIn,
  accessLevel,
  source = "results",
}: ProCTABannerProps) {
  const posthog = usePostHog();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Mount-only resolution: condiciones + localStorage check.
  useEffect(() => {
    if (!isLoggedIn || accessLevel !== "free") return;

    const threshold = Number(process.env.NEXT_PUBLIC_PRO_CTA_THRESHOLD) || DEFAULT_THRESHOLD;
    const dismissDays = Number(process.env.NEXT_PUBLIC_PRO_CTA_DISMISS_DAYS) || DEFAULT_DISMISS_DAYS;

    if (analysesCount < threshold) return;

    // Dismiss check (graceful con try/catch para private mode).
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const dismissTs = new Date(dismissedAt).getTime();
        const cutoff = Date.now() - dismissDays * 24 * 60 * 60 * 1000;
        if (dismissTs > cutoff) return;
      }
    } catch {
      // localStorage no disponible (private mode) — banner reaparece cada sesión.
    }

    setVisible(true);
    posthog?.capture("pro_cta_banner_shown", { analyses_count: analysesCount, source });
  }, [analysesCount, isLoggedIn, accessLevel, posthog, source]);

  function handleDismiss() {
    setClosing(true);
    posthog?.capture("pro_cta_banner_dismissed", { analyses_count: analysesCount });
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // graceful
    }
    // Animación slide-down 200ms antes de unmount.
    setTimeout(() => setVisible(false), 200);
  }

  function handleClickPro() {
    posthog?.capture("pro_cta_banner_clicked", { analyses_count: analysesCount });
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 ${closing ? "pro-cta-slide-out" : "pro-cta-slide-in"}`}
      role="region"
      aria-label="Mejora a Franco Pro"
    >
      <div
        className="mx-auto max-w-[1100px] flex items-center justify-between gap-4 px-4 sm:px-6 py-3"
        style={{
          background: "var(--franco-elevated)",
          borderTop: "0.5px solid var(--franco-border)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm font-bold text-[var(--franco-text)] m-0 leading-snug">
            Más análisis con Franco
          </p>
          <p className="hidden sm:block font-body text-[12px] text-[var(--franco-text-secondary)] m-0 leading-snug mt-0.5">
            Créditos sin vencimiento o suscripción con 30% off anual
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/pricing"
            onClick={handleClickPro}
            className="bg-signal-red text-white font-mono uppercase text-[11px] font-semibold tracking-[0.06em] px-4 py-2 rounded-md hover:bg-signal-red/90 transition-colors"
          >
            Ver planes →
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar banner"
            className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text-secondary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .pro-cta-slide-in {
          animation: proCtaSlideIn 200ms ease-out;
        }
        .pro-cta-slide-out {
          animation: proCtaSlideOut 200ms ease-out forwards;
        }
        @keyframes proCtaSlideIn {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes proCtaSlideOut {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
