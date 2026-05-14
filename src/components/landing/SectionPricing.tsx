"use client";

import Link from "next/link";
import Reveal, { RevealItem } from "./Reveal";

/**
 * Sección 08 · Pricing — fondo Ink 100, 3 cards (la del medio dark + destacada).
 */
export default function SectionPricing() {
  return (
    <section
      id="pricing"
      className="relative flex min-h-screen items-center"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-14 md:py-[72px]">
        {/* Header */}
        <Reveal as="div" className="mx-auto max-w-[760px] text-center">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
            08 · Precios
          </span>
          <h2 className="mt-4 font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[var(--landing-text)] md:text-[38px]">
            Empieza gratis. Paga cuando lo necesites.
          </h2>
          <p className="mt-4 font-body text-[15px] leading-[1.55] text-[var(--landing-text-secondary)] md:text-[16px]">
            Sin tarjeta para empezar. Sin compromiso mensual obligatorio.
          </p>
        </Reveal>

        {/* Cards */}
        <Reveal
          as="div"
          className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
          stagger={0.1}
          delay={0.1}
        >
          <PricingCard
            label="Demo"
            title="Tu primer análisis, gratis."
            price="$0"
            unit="sin tarjeta"
            features={[
              "1 análisis completo",
              "LTR, STR o ambos",
              "Todas las capas e IA",
            ]}
            ctaText="Empezar gratis"
            ctaHref="/register"
            ctaVariant="outline"
          />
          <PricingCard
            label="Individual"
            title="Análisis cuando los necesites."
            price="$9.990"
            unit="por análisis"
            features={[
              "Todo lo del demo",
              "Sin caducidad de créditos",
              "Comparativa entre análisis",
              "Informe compartible",
            ]}
            ctaText="Comprar análisis"
            ctaHref="/register"
            ctaVariant="solid"
            highlighted
            badge="Más popular"
          />
          <PricingCard
            label="Mensual"
            title="Para evaluar varios deptos."
            price="$49.990"
            unit="/mes · 10 análisis"
            features={[
              "10 análisis al mes",
              "Créditos acumulables",
              "Cancela cuando quieras",
              "Planes mayores disponibles",
            ]}
            ctaText="Ver planes"
            ctaHref="/pricing"
            ctaVariant="outline"
          />
        </Reveal>

        {/* Footer */}
        <p className="mt-8 text-center font-body text-[14px] text-[var(--landing-text-secondary)]">
          ¿Eres corredor o family officer?{" "}
          <Link
            href="/register"
            className="border-b border-[#C8323C]/40 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-[#C8323C] transition-colors hover:border-[#C8323C]"
          >
            Plan ilimitado →
          </Link>
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  label,
  title,
  price,
  unit,
  features,
  ctaText,
  ctaHref,
  ctaVariant,
  highlighted = false,
  badge,
}: {
  label: string;
  title: string;
  price: string;
  unit: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  ctaVariant: "solid" | "outline";
  highlighted?: boolean;
  badge?: string;
}) {
  const dark = highlighted;
  const text = dark ? "#FAFAF8" : "#0F0F0F";
  const muted = dark ? "rgba(250,250,248,0.55)" : "rgba(15,15,15,0.55)";
  const checkColor = dark ? "rgba(250,250,248,0.85)" : "rgba(15,15,15,0.85)";

  return (
    <RevealItem
      className="relative flex flex-col rounded-2xl p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 md:p-8"
      style={{
        background: dark ? "#0F0F0F" : "#FFFFFF",
        border: dark ? "0.5px solid rgba(250,250,248,0.12)" : "0.5px solid rgba(15,15,15,0.10)",
        boxShadow: dark
          ? "0 24px 48px -16px rgba(0,0,0,0.35)"
          : "0 1px 0 rgba(15,15,15,0.03)",
      }}
    >
      {badge && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded-md bg-[#C8323C] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_2px_8px_rgba(200,50,60,0.4)]">
          {badge}
        </span>
      )}

      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: muted }}>
        {label}
      </p>
      <p className="mt-3 font-heading text-[20px] font-bold leading-[1.25]" style={{ color: text }}>
        {title}
      </p>

      <div className="mt-6 flex items-baseline gap-2">
        <span
          className="font-heading font-bold leading-none tracking-[-0.02em]"
          style={{ color: text, fontSize: "48px" }}
        >
          {price}
        </span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>
          {unit}
        </span>
      </div>

      <ul className="mt-7 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 font-body text-[14px] leading-[1.5]" style={{ color: checkColor }}>
            <span
              aria-hidden="true"
              className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
              style={{ background: dark ? "rgba(250,250,248,0.10)" : "rgba(15,15,15,0.06)" }}
            >
              <span style={{ color: text }} className="text-[10px] leading-none">✓</span>
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex-1" />

      <Link
        href={ctaHref}
        className={`group inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] transition-[transform,filter,background] duration-150 hover:scale-[1.02] ${
          ctaVariant === "solid"
            ? "bg-[#C8323C] text-white shadow-[0_2px_0_rgba(0,0,0,0.18)] hover:brightness-95"
            : dark
              ? "border border-[rgba(250,250,248,0.18)] text-[var(--landing-text)] hover:bg-[rgba(250,250,248,0.05)]"
              : "border border-[rgba(15,15,15,0.18)] text-[var(--landing-text)] hover:bg-[rgba(15,15,15,0.04)]"
        }`}
      >
        {ctaText}
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </RevealItem>
  );
}
