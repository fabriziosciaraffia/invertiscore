"use client";

import SectionHeader from "./SectionHeader";
import PricingPlans from "./PricingPlans";

/**
 * Sección 09 · Pricing (F.11 Phase 2.38) — 4 planes con toggle Mensual/Anual,
 * compartido con la página /pricing vía <PricingPlans />. Fondo Ink alt.
 */
export default function SectionPricing() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <div className="relative mx-auto w-full max-w-[1280px] px-6 py-[10vh]">
        {/* Header */}
        <SectionHeader
          eyebrow="Precios"
          title={"Empieza gratis.\nPaga cuando lo necesites."}
          subhead="Sin tarjeta para empezar. Sin compromiso mensual obligatorio."
          align="center"
          className="mx-auto max-w-[760px]"
        />

        {/* 4 planes + toggle (compartido con /pricing) · bundle pricing sutil */}
        <PricingPlans
          emphasis="subtle"
          textColor="var(--landing-text)"
          mutedColor="var(--landing-text-muted)"
        />

        {/* Nota cobertura geográfica · beta solo Gran Santiago */}
        <p
          className="mt-8 text-center font-mono uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.08em" }}
        >
          Análisis disponible para Gran Santiago. Más zonas próximamente.
        </p>
      </div>
    </section>
  );
}
