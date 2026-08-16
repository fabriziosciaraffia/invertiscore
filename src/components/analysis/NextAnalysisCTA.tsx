"use client";

// ─────────────────────────────────────────────────────────────────────────────
// NextAnalysisCTA — invitación COMERCIAL al siguiente análisis, dentro del
// cuerpo del informe (F2-2 + ajuste pre-push de Fabrizio).
//
// Doctrina: la sobriedad editorial y los usos canónicos de Signal Red rigen el
// PRODUCTO (el informe); esta card es VENTA y corre con la licencia comercial
// de pricing/checkout. Card contenida con tinte suave, botón filled Signal Red
// como acción principal, precio visible cuando aplica. La tipografía sigue
// siendo la del sistema (Source Serif / IBM Plex / JetBrains) — la licencia es
// de presencia, no de identidad.
//
// Posición: al cierre de la sección IA/hallazgos, ANTES de la Advanced Section
// (LTR, STR y comparativa) — el momento en que el lector acaba de digerir el
// veredicto y decide qué hacer.
//
// Honestidad (fix de copy anónimo): el anónimo ya CONSUMIÓ su gratis con este
// análisis — el registro lo GUARDA, no regala otro. El botón dice guardar y la
// línea secundaria dice, sin letra chica, que el siguiente es pagado.
//
// Exclusión con el pie: cuando esta card muestra la variante de compra, el
// caller pasa `suppressNoCredits` a WalletStatusCTA — un solo aviso de compra
// por página. Eventos next_cta_shown / next_cta_clicked intactos.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";

export interface NextAnalysisCTAProps {
  isLoggedIn: boolean;
  /** Anónimo-dueño (cap F2-2): su siguiente paso es guardar ESTE análisis. */
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

interface Accion {
  label: string;
  href: string;
  /** Línea bajo el botón: contexto honesto + link a /pricing cuando aplica. */
  secundaria: React.ReactNode | null;
}

function resolverAccion(state: WalletState, registerNext?: string): Accion {
  const linkPricing = (
    <Link href="/pricing" className="underline underline-offset-2 hover:text-[var(--franco-text)] transition-colors">
      packs y plan mensual
    </Link>
  );
  switch (state) {
    case "anon_owner":
      // El registro guarda ESTE análisis (claim). Cero promesa de otro gratis:
      // el welcome se consume en el claim — este análisis ERA el gratis.
      return {
        label: "Crear cuenta para guardarlo",
        href: `/register?next=${encodeURIComponent(registerNext || "/analisis/nuevo-v4")}`,
        secundaria: (
          <>
            Este fue tu análisis gratis. Los siguientes: {fmtCLP(SINGLE_PRICE)} cada uno, o {linkPricing}.
          </>
        ),
      };
    case "no_credits":
      return {
        label: `Analizar otro depto · ${fmtCLP(SINGLE_PRICE)}`,
        href: "/checkout?product=single",
        secundaria: <>¿Vas a mirar varios? Te conviene un pack o el plan — {linkPricing}.</>,
      };
    default:
      return { label: "Analizar otro depto", href: "/analisis/nuevo-v4", secundaria: null };
  }
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
  const accion = resolverAccion(state, p.registerNext);

  return (
    <section
      aria-label="Siguiente paso"
      className="rounded-2xl border border-[var(--franco-border-strong)] bg-[color-mix(in_srgb,var(--signal-red)_3.5%,var(--franco-card))] shadow-sm px-5 py-5 sm:px-7 sm:py-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] font-medium text-signal-red m-0 mb-2">
        Un análisis no decide — compara
      </p>
      <p className="font-body text-[14px] text-[var(--franco-text)] leading-relaxed m-0 mb-4 max-w-[62ch]">
        Este veredicto es de este depto, con estos supuestos. La decisión buena aparece
        cuando tienes dos o tres análisis lado a lado. El siguiente depto que estás
        mirando también se puede medir.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <Link
          href={accion.href}
          onClick={() =>
            posthog?.capture("next_cta_clicked", {
              variant: "A",
              wallet_state: state,
              source: p.source,
              destination: accion.href,
            })
          }
          className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-signal-red px-6 py-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-signal-red/90 min-h-[48px] sm:whitespace-nowrap"
        >
          {accion.label}
          <ArrowRight size={14} />
        </Link>
        {accion.secundaria && (
          <p className="font-body text-[12.5px] text-[var(--franco-text-muted)] leading-snug m-0">
            {accion.secundaria}
          </p>
        )}
      </div>
    </section>
  );
}
