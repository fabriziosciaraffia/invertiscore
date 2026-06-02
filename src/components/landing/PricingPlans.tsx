"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PRICING_PLANS,
  fmtCLP,
  productKeyFor,
  type Billing,
  type PricingPlan,
} from "@/lib/pricing";

/**
 * PricingPlans · grilla de 4 planes + toggle Mensual/Anual con bundle pricing
 * (F.11 Phase 2.38). Compartido entre landing (s09) y /pricing. Lee de
 * @/lib/pricing (fuente única).
 *
 * `emphasis`: "subtle" (landing · badges discretos, sin glow) | "strong"
 * (/pricing · badge descuento sólido rojo en esquina + glow en la card
 * destacada).
 *
 * Theming: cards con hex hardcodeado (blanca / oscura destacada) →
 * theme-independent. Solo los labels del toggle son theme-aware (color por
 * prop desde el namespace de cada página).
 *
 * Patrón SAFE: 4 cards siempre montadas; el precio crossfadea por opacity CSS
 * (200ms) entre dos bloques always-mounted, sin mount/unmount ni AnimatePresence.
 */

const RED = "#C8323C";

export default function PricingPlans({
  emphasis = "strong",
  textColor = "var(--franco-text)",
  mutedColor = "var(--franco-text-secondary)",
  className = "",
}: {
  emphasis?: "subtle" | "strong";
  textColor?: string;
  mutedColor?: string;
  className?: string;
}) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const annual = billing === "annual";

  return (
    <div className={className}>
      {/* ===== Toggle Mensual/Anual ===== */}
      <div className="mb-8 flex flex-wrap items-center justify-center" style={{ gap: 12 }}>
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className="font-body"
          style={{
            fontSize: 14,
            fontWeight: annual ? 400 : 600,
            color: annual ? mutedColor : textColor,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "color 200ms ease",
          }}
        >
          Mensual
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Cambiar a facturación anual"
          onClick={() => setBilling(annual ? "monthly" : "annual")}
          style={{
            position: "relative",
            width: 42,
            height: 24,
            borderRadius: 999,
            background: annual ? RED : "rgba(128,128,128,0.35)",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 200ms ease",
            padding: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              left: annual ? 21 : 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              transition: "left 200ms ease",
            }}
          />
        </button>

        <button
          type="button"
          onClick={() => setBilling("annual")}
          className="font-body"
          style={{
            fontSize: 14,
            fontWeight: annual ? 600 : 400,
            color: annual ? textColor : mutedColor,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "color 200ms ease",
          }}
        >
          Anual
        </button>

        <span
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            color: RED,
            background: "rgba(200,50,60,0.15)",
            borderRadius: 4,
            padding: "4px 8px",
          }}
        >
          2 meses gratis
        </span>
      </div>

      {/* ===== Grid 4 planes ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PRICING_PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} annual={annual} emphasis={emphasis} />
        ))}
      </div>
    </div>
  );
}

/* ============================ Card ============================ */

function PlanCard({
  plan,
  annual,
  emphasis,
}: {
  plan: PricingPlan;
  annual: boolean;
  emphasis: "subtle" | "strong";
}) {
  const dark = !!plan.highlight;

  // CTA → SIEMPRE a /checkout con la product key real del plan + facturación
  // vigente. El gate de sesión vive en /checkout (auth-gate único): si no hay
  // sesión, checkout redirige a /register?next=/checkout?product=<key>. Así el
  // CTA no depende de un getUser() client-side que puede no resolver a tiempo.
  const productKey = productKeyFor(plan.id, annual ? "annual" : "monthly");
  const ctaHref = `/checkout?product=${productKey}`;
  const text = dark ? "#FAFAF8" : "#0F0F0F";
  const muted = dark ? "rgba(250,250,248,0.55)" : "rgba(15,15,15,0.55)";
  const checkBg = dark ? "rgba(250,250,248,0.10)" : "rgba(15,15,15,0.06)";
  const divider = dark ? "rgba(250,250,248,0.12)" : "rgba(15,15,15,0.10)";

  const ctaLabel = plan.ctaToggle
    ? `${plan.ctaBase} ${annual ? "anual" : "mensual"}`
    : plan.ctaBase;
  const ctaSolid = dark;

  return (
    <div
      className="relative flex flex-col rounded-2xl p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
      style={{
        background: dark ? "#0F0F0F" : "#FFFFFF",
        border: dark ? `0.5px solid ${RED}` : "0.5px solid rgba(15,15,15,0.10)",
        boxShadow: dark
          ? emphasis === "strong"
            ? "0 0 0 1px rgba(200,50,60,0.25), 0 24px 60px -18px rgba(200,50,60,0.45)"
            : "0 24px 48px -16px rgba(0,0,0,0.35)"
          : "0 1px 0 rgba(15,15,15,0.03)",
      }}
    >
      {/* Badge "Más popular" (top-center) */}
      {plan.popularBadge && (
        <span
          className="absolute left-1/2 inline-flex -translate-x-1/2 items-center rounded-md font-mono font-bold uppercase text-white"
          style={{
            top: -9,
            fontSize: 9,
            letterSpacing: "0.1em",
            background: RED,
            padding: "3px 9px",
            boxShadow: "0 2px 8px rgba(200,50,60,0.4)",
          }}
        >
          {plan.popularBadge}
        </span>
      )}

      {/* Badge descuento (top-right) */}
      {plan.discountBadge && (
        <span
          className="absolute font-mono font-bold uppercase"
          style={{
            top: 14,
            right: 14,
            fontSize: 9,
            letterSpacing: "0.08em",
            borderRadius: 4,
            padding: "3px 7px",
            ...(emphasis === "strong"
              ? { background: RED, color: "#FFFFFF" }
              : { background: "rgba(200,50,60,0.12)", color: RED }),
          }}
        >
          {plan.discountBadge}
        </span>
      )}

      <p
        className="font-mono font-medium uppercase"
        style={{ fontSize: 10, letterSpacing: "0.16em", color: muted, paddingRight: plan.discountBadge ? 64 : 0 }}
      >
        {plan.label}
      </p>
      <p
        className="mt-2 font-heading font-bold leading-[1.25]"
        style={{ fontSize: 16, color: text }}
      >
        {plan.title}
      </p>

      {/* ===== Precio ===== */}
      <div className="mt-5">
        {plan.fixed != null ? (
          /* Plan 1 · precio directo (sin comparativa, sin toggle) */
          <div className="flex items-baseline gap-2">
            <span
              className="font-heading font-bold leading-none tracking-[-0.02em]"
              style={{ fontSize: 30, color: text }}
            >
              {fmtCLP(plan.fixed)}
            </span>
            <span
              className="font-mono font-medium uppercase"
              style={{ fontSize: 10, letterSpacing: "0.1em", color: muted }}
            >
              {plan.fixedUnit}
            </span>
          </div>
        ) : (
          <>
            {/* Línea superior de la comparativa (constante) · tachado
                $/análisis (planes 2-3) o texto "Sin tope de uso" (ilimitado). */}
            {(plan.struck != null || plan.compareTopText) && (
              <p
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: RED,
                  textDecoration: plan.struck != null ? "line-through" : "none",
                  margin: 0,
                }}
              >
                {plan.struck != null
                  ? `${fmtCLP(plan.struck)} / análisis`
                  : plan.compareTopText}
              </p>
            )}
            {/* Crossfade mensual ↔ anual · always-mounted (anual en flujo
                reserva la altura, mensual absoluto encima). */}
            <div style={{ position: "relative" }}>
              <div
                aria-hidden={!annual}
                style={{ opacity: annual ? 1 : 0, transition: "opacity 200ms ease" }}
              >
                <PriceBlock plan={plan} annual text={text} muted={muted} divider={divider} />
              </div>
              <div
                aria-hidden={annual}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  opacity: annual ? 0 : 1,
                  transition: "opacity 200ms ease",
                  pointerEvents: annual ? "none" : "auto",
                }}
              >
                <PriceBlock plan={plan} annual={false} text={text} muted={muted} divider={divider} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Features ===== */}
      {/* Plan base: las 6 completas. Suscripciones: solo lo diferencial
          (el banner superior comunica "mismas capacidades en todos"). */}
      {plan.features.length > 0 && (
        <ul className="mt-6 space-y-2">
          {plan.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 font-body leading-[1.4]"
              style={{ fontSize: 12.5, color: dark ? "rgba(250,250,248,0.85)" : "rgba(15,15,15,0.85)" }}
            >
              <span
                aria-hidden="true"
                className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: checkBg }}
              >
                <span style={{ color: text }} className="text-[9px] leading-none">✓</span>
              </span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Subtexto plan 1 (trial / créditos) */}
      {plan.fixedSubtext && (
        <p className="mt-4 font-body" style={{ fontSize: 11, lineHeight: 1.45, color: muted }}>
          {plan.fixedSubtext}
        </p>
      )}

      <div className="mt-6 flex-1" />

      <Link
        href={ctaHref}
        style={{ color: ctaSolid ? "#FFFFFF" : text }}
        className={`group inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] transition-[transform,filter,background] duration-150 hover:scale-[1.02] ${
          ctaSolid
            ? "bg-[#C8323C] shadow-[0_2px_0_rgba(0,0,0,0.18)] hover:brightness-95"
            : "border border-[rgba(15,15,15,0.18)] hover:bg-[rgba(15,15,15,0.04)]"
        }`}
      >
        {ctaLabel}
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}

/**
 * Bloque de precio de suscripción para un `billing` dado:
 *   1. $/análisis nuevo (bold) — solo planes con perAnalysis (10/50)
 *   2. divider sutil (solo si hay comparativa $/análisis)
 *   3. precio mensual grande (Serif Bold) + "/mes"
 *   4. "Pagas $X al año" (solo anual) · volumeSubtext (ilimitado)
 */
function PriceBlock({
  plan,
  annual,
  text,
  muted,
  divider,
}: {
  plan: PricingPlan;
  annual: boolean;
  text: string;
  muted: string;
  divider: string;
}) {
  const per = annual ? plan.perAnalysisAnnual : plan.perAnalysisMonthly;
  const big = annual ? plan.annualPerMonth : plan.monthly;
  const compareMain = per != null ? `${fmtCLP(per)} / análisis` : plan.compareMainText;
  const hasCompare = !!compareMain;

  return (
    <>
      {hasCompare && (
        <p className="mt-1 font-mono font-bold" style={{ fontSize: 14, color: text }}>
          {compareMain}
        </p>
      )}
      <div
        style={{
          marginTop: hasCompare ? 12 : 0,
          paddingTop: hasCompare ? 12 : 0,
          borderTop: hasCompare ? `0.5px solid ${divider}` : "none",
        }}
      >
        <div className="flex items-baseline gap-2">
          <span
            className="font-heading font-bold leading-none tracking-[-0.02em]"
            style={{ fontSize: 30, color: text }}
          >
            {fmtCLP(big!)}
          </span>
          <span
            className="font-mono font-medium uppercase"
            style={{ fontSize: 10, letterSpacing: "0.1em", color: muted }}
          >
            /mes
          </span>
        </div>
        {annual && plan.annualTotal != null && (
          <p className="mt-1.5 font-body" style={{ fontSize: 11, color: muted }}>
            Pagas {fmtCLP(plan.annualTotal)} al año
          </p>
        )}
        {plan.volumeSubtext && (
          <p className="mt-1.5 font-body" style={{ fontSize: 11, lineHeight: 1.4, color: muted }}>
            {plan.volumeSubtext}
          </p>
        )}
      </div>
    </>
  );
}
