"use client";

// ─────────────────────────────────────────────────────────────────────────────
// NextAnalysisCTA — invitación al siguiente análisis DENTRO del cuerpo del
// informe (F2-2, decisión 4 de F2-1: copy A "UN ANÁLISIS NO DECIDE — COMPARA").
//
// Posición: al cierre de la sección IA/hallazgos, ANTES de la Advanced Section —
// el momento en que el lector acaba de digerir el veredicto narrado y decide qué
// hacer. El pie (WalletStatusCTA) llega tarde: mucha gente no scrollea hasta ahí.
//
// Reglas de honestidad: no gatea NADA (es una card informativa entre dos
// secciones ya visibles), cero urgencia falsa, el precio solo aparece si el
// wallet está en cero. Signal Red SOLO en el CTA (uso canónico); la card es Ink.
//
// Exclusión con el pie: cuando esta card muestra la variante de compra, el
// caller pasa `suppressNoCredits` a WalletStatusCTA — un solo aviso rojo por
// página. Los estados neutros conviven (mensajes distintos).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";

export interface NextAnalysisCTAProps {
  isLoggedIn: boolean;
  /** Anónimo-dueño (cap F2-2): su siguiente análisis pasa por crear la cuenta. */
  isAnonOwner?: boolean;
  isSubscriber: boolean;
  credits: number;
  welcomeAvailable: boolean;
  isSharedView: boolean;
  source: "ltr" | "str" | "comparativa";
  /** Round-trip del registro para el anónimo-dueño (la URL de SU análisis). */
  registerNext?: string;
}

type WalletState = "anon_owner" | "subscriber" | "credits" | "welcome" | "no_credits";

function resolverDestino(state: WalletState, registerNext?: string): { label: string; href: string } {
  switch (state) {
    case "anon_owner":
      // El registro guarda ESTE análisis (claim) y abre el camino al siguiente.
      return {
        label: "Crear cuenta y analizar otro",
        href: `/register?next=${encodeURIComponent(registerNext || "/analisis/nuevo-v4")}`,
      };
    case "no_credits":
      return { label: `Analizar otro depto · ${fmtCLP(SINGLE_PRICE)}`, href: "/checkout?product=single" };
    default:
      return { label: "Analizar otro depto", href: "/analisis/nuevo-v4" };
  }
}

/** Estado del wallet a efectos de ESTA card (null = no se muestra). */
export function nextCtaState(p: NextAnalysisCTAProps): WalletState | null {
  // Vista compartida: el siguiente análisis no es una decisión del que mira.
  if (p.isSharedView) return null;
  if (p.isAnonOwner) return "anon_owner";
  // Guest no-dueño (link compartido): ConversionHook/Closer ya cubren.
  if (!p.isLoggedIn) return null;
  if (p.isSubscriber) return "subscriber";
  if (p.credits > 0) return "credits";
  if (p.welcomeAvailable) return "welcome";
  return "no_credits";
}

export function NextAnalysisCTA(p: NextAnalysisCTAProps) {
  const posthog = usePostHog();
  const state = nextCtaState(p);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!state || shownRef.current) return;
    shownRef.current = true;
    posthog?.capture("next_cta_shown", { variant: "A", wallet_state: state, source: p.source });
  }, [state, posthog, p.source]);

  if (!state) return null;
  const destino = resolverDestino(state, p.registerNext);

  return (
    <section
      aria-label="Siguiente paso"
      className="rounded-r-lg border-l-2 border-[var(--franco-text)] bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-4 sm:pl-5 sm:pr-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--franco-text-muted)] m-0 mb-1.5">
        Un análisis no decide — compara
      </p>
      <p className="font-body text-[13.5px] text-[var(--franco-text-secondary)] leading-snug m-0 mb-3">
        Este veredicto es de este depto, con estos supuestos. La decisión buena aparece
        cuando tienes dos o tres análisis lado a lado. El siguiente depto que estás
        mirando también se puede medir.
      </p>
      <Link
        href={destino.href}
        onClick={() =>
          posthog?.capture("next_cta_clicked", {
            variant: "A",
            wallet_state: state,
            source: p.source,
            destination: destino.href,
          })
        }
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] font-medium text-signal-red hover:opacity-80 transition-opacity"
      >
        {destino.label}
        <ArrowRight size={12} />
      </Link>
    </section>
  );
}
