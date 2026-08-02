"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import FrancoLogo from "@/components/franco-logo";

/**
 * CTA post-análisis welcome — contrato mockup-cta-welcome.
 *
 * Un componente, dos renders: la banda inline (Ink, permanente al cierre del
 * informe) y el popup (card blanca sobre overlay Ink 80%, dispara UNA vez por
 * análisis). Se monta SOLO en los informes en pantalla LTR/STR cuando el cobro
 * de ESTE análisis fue mode === "welcome" (gate server-side vía
 * input_data.chargeMode) — nunca en vistas /documento ni pipeline PDF.
 *
 * Trigger del popup: IntersectionObserver sobre la banda inline — que vive
 * inmediatamente después de la última sección del informe (zona en LTR, su
 * equivalente en STR), así que entrar a la banda ≡ llegar al final — más un
 * dwell de 1.5s sostenido en viewport. Guard localStorage
 * `cta_welcome_shown_<analysisId>` (patrón meta_sfa_fired: try/catch + ref en
 * memoria). Cerrar (X u overlay) marca el guard igual. La banda no tiene guard.
 *
 * Colores deliberadamente invariantes al tema (contrato visual): la banda es
 * Ink y la card del popup es blanca en ambos temas — mismo trato que
 * ConversionCloser (campo Signal Red). No es una violación de paridad: el
 * gesto es idéntico en los dos temas.
 */

const GUARD_PREFIX = "cta_welcome_shown_";
const DWELL_MS = 1500;

const SIGNAL_RED = "#C8323C";
const INK = "#0F0F0F";
const PAPER = "#FAFAF8";

function readGuard(analysisId: string): boolean {
  try {
    return !!localStorage.getItem(`${GUARD_PREFIX}${analysisId}`);
  } catch {
    return false;
  }
}

function markGuard(analysisId: string): void {
  try {
    localStorage.setItem(`${GUARD_PREFIX}${analysisId}`, "1");
  } catch {
    // localStorage no disponible → queda el guard en memoria (ref del efecto).
  }
}

/** Copy EXACTO del contrato — compartido por popup e inline, cero variantes. */
function CtaCopy({
  tone,
  source,
  onCtaClick,
}: {
  /** "paper" = card blanca del popup (texto Ink) · "ink" = banda Ink (texto claro). */
  tone: "paper" | "ink";
  source: "popup" | "inline";
  onCtaClick: () => void;
}) {
  const base = tone === "paper" ? INK : PAPER;
  const ghost =
    tone === "paper" ? "rgba(15, 15, 15, 0.45)" : "rgba(250, 250, 248, 0.45)";
  const body =
    tone === "paper" ? "rgba(15, 15, 15, 0.72)" : "rgba(250, 250, 248, 0.72)";
  const micro =
    tone === "paper" ? "rgba(15, 15, 15, 0.45)" : "rgba(250, 250, 248, 0.5)";

  return (
    <>
      <h3
        className="font-heading font-normal text-[24px] md:text-[28px] leading-[1.25] m-0"
        style={{ color: base }}
      >
        Un análisis es <em style={{ color: ghost }}>un dato</em>. Dos son{" "}
        <strong className="font-bold not-italic">un criterio</strong>.
      </h3>
      <p
        className="font-body text-[14px] leading-relaxed mt-3 mb-0"
        style={{ color: body }}
      >
        Ya sabes lo que este depto da. La decisión se toma comparando.
      </p>
      <Link
        href="/analisis/nuevo-v4"
        onClick={onCtaClick}
        className="inline-flex items-center justify-center rounded-lg px-6 py-3 mt-6 font-mono text-[12px] uppercase tracking-[0.06em] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: SIGNAL_RED }}
        data-source={source}
      >
        Analizar otra propiedad
      </Link>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.08em] mt-3 mb-0"
        style={{ color: micro }}
      >
        Toma 3 minutos
      </p>
    </>
  );
}

export function CtaWelcome({ analysisId }: { analysisId: string }) {
  const posthog = usePostHog();
  const bandRef = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  const [popupOpen, setPopupOpen] = useState(false);

  // Trigger del popup: banda inline visible + dwell sostenido de 1.5s.
  useEffect(() => {
    if (firedRef.current || readGuard(analysisId)) {
      firedRef.current = true;
      return;
    }
    const target = bandRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !dwellTimer && !firedRef.current) {
          dwellTimer = setTimeout(() => {
            if (firedRef.current) return;
            firedRef.current = true;
            markGuard(analysisId);
            setPopupOpen(true);
            posthog?.capture("cta_welcome_shown", { analysis_id: analysisId });
            observer.disconnect();
          }, DWELL_MS);
        } else if (!visible && dwellTimer) {
          clearTimeout(dwellTimer);
          dwellTimer = null;
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(target);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [analysisId, posthog]);

  const closePopup = () => {
    markGuard(analysisId);
    setPopupOpen(false);
  };

  const trackClick = (source: "popup" | "inline") => {
    posthog?.capture("cta_welcome_click", { source, analysis_id: analysisId });
  };

  return (
    <>
      {/* ── Banda inline (permanente, sin guard) ── */}
      <div
        ref={bandRef}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ background: INK }}
      >
        <CtaCopy tone="ink" source="inline" onCtaClick={() => trackClick("inline")} />
      </div>

      {/* ── Popup (una vez por análisis) ── */}
      {popupOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          style={{ background: "rgba(15, 15, 15, 0.8)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Analizar otra propiedad"
          onClick={closePopup}
        >
          <div
            className="cta-welcome-card relative w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 text-center"
            style={
              {
                // Wordmark sobre card blanca (theme-invariante): forzamos los
                // tokens del wordmark a Ink para que lea igual en modo dark.
                "--franco-wm-re": "rgba(15, 15, 15, 0.3)",
                "--franco-wm-franco": INK,
              } as React.CSSProperties
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePopup}
              aria-label="Cerrar"
              className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
              style={{ color: "rgba(15, 15, 15, 0.45)" }}
            >
              <span className="font-body text-[18px] leading-none">×</span>
            </button>
            <div className="mb-6 flex justify-center">
              <FrancoLogo size="sm" />
            </div>
            <CtaCopy
              tone="paper"
              source="popup"
              onCtaClick={() => trackClick("popup")}
            />
          </div>
          <style>{`
            /* Levitación ±5px · loop 6s. La sombra (3 capas) respira con el
               movimiento: arriba flota más (sombra amplia), abajo aterriza. */
            @keyframes cta-welcome-float {
              0%, 100% {
                transform: translateY(5px);
                box-shadow:
                  0 2px 6px rgba(15, 15, 15, 0.28),
                  0 10px 22px rgba(15, 15, 15, 0.24),
                  0 24px 48px rgba(15, 15, 15, 0.18);
              }
              50% {
                transform: translateY(-5px);
                box-shadow:
                  0 4px 10px rgba(15, 15, 15, 0.22),
                  0 16px 34px rgba(15, 15, 15, 0.26),
                  0 40px 80px rgba(15, 15, 15, 0.3);
              }
            }
            .cta-welcome-card {
              animation: cta-welcome-float 6s ease-in-out infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .cta-welcome-card {
                animation: none;
                transform: none;
                box-shadow:
                  0 2px 8px rgba(15, 15, 15, 0.26),
                  0 12px 28px rgba(15, 15, 15, 0.25),
                  0 32px 64px rgba(15, 15, 15, 0.24);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
