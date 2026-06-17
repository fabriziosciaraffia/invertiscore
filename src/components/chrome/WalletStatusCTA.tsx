"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";

export interface WalletStatusCTAProps {
  welcomeAvailable: boolean;
  credits: number;
  isSubscriber: boolean;
  isAdmin: boolean;
  isSharedView: boolean;
  source?: "ltr" | "str" | "comparativa";
}

type WalletState = "subscriber" | "credits" | "no_credits";

interface CTAVariant {
  state: WalletState;
  message: string;
  plan: string;
  ctaLabel: string;
  href: string;
  /** Tratamiento visual: 'neutral' (Ink) | 'avoid' (Signal Red wash). Capa 1 v1.1. */
  tone: "neutral" | "avoid";
  /** Acción secundaria discreta (ej. "ver todos los planes"). Opcional. */
  secondaryLabel?: string;
  secondaryHref?: string;
}

/**
 * CTA in-line al pie de las páginas de resultados (LTR / STR / AMBAS) que
 * comunica el estado del wallet del usuario y la acción disponible.
 *
 * Reglas (UX fix CTA welcome consumido):
 *  - isSharedView || isAdmin || welcomeAvailable → null (no renderiza).
 *  - isSubscriber → card sutil "Análisis ilimitados".
 *  - credits > 0 → card neutral "Tienes N créditos".
 *  - !welcomeAvailable && credits === 0 → card Signal Red "Sin créditos".
 *
 * El componente NO es dismissable: el estado del wallet es información
 * relevante cada vez que el usuario llega al cierre del análisis.
 */
export function WalletStatusCTA({
  welcomeAvailable,
  credits,
  isSubscriber,
  isAdmin,
  isSharedView,
  source = "ltr",
}: WalletStatusCTAProps) {
  const posthog = usePostHog();

  const variant = resolveVariant({
    welcomeAvailable,
    credits,
    isSubscriber,
    isAdmin,
    isSharedView,
  });

  useEffect(() => {
    if (!variant) return;
    posthog?.capture("wallet_cta_shown", { state: variant.state, source });
  }, [variant, posthog, source]);

  if (!variant) return null;

  const isAvoid = variant.tone === "avoid";

  const cardStyle = isAvoid
    ? {
        background: "var(--franco-sc-bad-bg)",
        borderColor: "var(--franco-sc-bad-border)",
      }
    : {
        background: "var(--franco-card)",
        borderColor: "var(--franco-border)",
      };

  const messageColor = isAvoid ? "var(--signal-red)" : "var(--franco-text)";
  const planColor = isAvoid ? "var(--signal-red)" : "var(--franco-text)";

  function handleClickCTA() {
    posthog?.capture("wallet_cta_clicked", {
      state: variant!.state,
      source,
      destination: variant!.href,
    });
  }

  return (
    <section
      role="region"
      aria-label="Estado de tu wallet de análisis Franco"
      className="rounded-2xl border p-5 sm:p-6 flex flex-col gap-4"
      style={{ border: "1px solid", ...cardStyle }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
            Tu wallet
          </p>
          <p
            className="font-body text-[14px] sm:text-[15px] font-medium leading-snug m-0"
            style={{ color: messageColor }}
          >
            {variant.message}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
            Plan
          </p>
          <p
            className="font-mono text-[11px] sm:text-[12px] font-semibold tracking-wide m-0 whitespace-nowrap"
            style={{ color: planColor }}
          >
            {variant.plan}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={variant.href}
          onClick={handleClickCTA}
          className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] uppercase tracking-[0.06em] font-medium hover:opacity-80 transition-opacity"
          style={{ color: isAvoid ? "var(--signal-red)" : "var(--franco-text)" }}
        >
          {variant.ctaLabel}
          <ArrowRight size={12} />
        </Link>
        {variant.secondaryHref && variant.secondaryLabel && (
          <Link
            href={variant.secondaryHref}
            onClick={handleClickCTA}
            className="inline-flex items-center self-start font-mono text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--franco-text-muted)] hover:text-[var(--franco-text-secondary)] transition-colors"
          >
            {variant.secondaryLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

function resolveVariant(args: {
  welcomeAvailable: boolean;
  credits: number;
  isSubscriber: boolean;
  isAdmin: boolean;
  isSharedView: boolean;
}): CTAVariant | null {
  // Excluir vista compartida y admin: el CTA refleja el wallet del usuario
  // logueado actual, no del owner del análisis ajeno.
  if (args.isSharedView) return null;
  if (args.isAdmin) return null;

  if (args.isSubscriber) {
    return {
      state: "subscriber",
      message: "Análisis ilimitados con FrancoMensual.",
      plan: "FRANCOMENSUAL",
      ctaLabel: "Crear otro análisis",
      href: "/analisis/nuevo-v2",
      tone: "neutral",
    };
  }

  if (args.credits > 0) {
    const plural = args.credits === 1 ? "" : "s";
    return {
      state: "credits",
      message: `Tienes ${args.credits} análisis disponible${plural}.`,
      plan: `PRO · ${args.credits}`,
      ctaLabel: "Crear otro análisis",
      href: "/analisis/nuevo-v2",
      tone: "neutral",
    };
  }

  // Sin saldo: welcome ya consumido Y ledger en 0. `credits` es ledger-aware
  // (getAvailableCredits), así que un usuario con saldo comprado cae en la rama
  // `credits > 0` de arriba y nunca llega acá. Copy NEUTRO: no afirma "usaste tu
  // gratis" porque acá también cae quien pagó y agotó su saldo. CTA: compra 1
  // análisis ($9.990); link secundario a planes para quien quiere volumen.
  if (!args.welcomeAvailable && args.credits === 0) {
    return {
      state: "no_credits",
      message:
        "Te quedaste sin análisis disponibles.",
      plan: "SIN ANÁLISIS",
      ctaLabel: `Comprar 1 análisis · ${fmtCLP(SINGLE_PRICE)}`,
      href: "/checkout?product=single",
      tone: "avoid",
      secondaryLabel: "Ver todos los planes",
      secondaryHref: "/pricing",
    };
  }

  return null;
}
