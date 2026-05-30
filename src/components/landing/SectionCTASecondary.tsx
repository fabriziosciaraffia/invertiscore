"use client";

import Link from "next/link";

/**
 * Sección 08 · CTA secundario — franja horizontal compacta sobre bg base
 * (F.11 Phase 2.36). Botón outline; no invierte para no encadenar 3 rojos.
 * Header inline (sin SectionHeader, sin subhead).
 */
export default function SectionCTASecondary() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-8 md:py-14">
        {/* IZQ · título */}
        <div>
          {/* Hairline Signal Red */}
          <div
            aria-hidden="true"
            style={{
              width: 24,
              height: 1,
              background: "rgba(200,50,60,0.6)",
              marginBottom: 14,
            }}
          />
          <p
            className="font-mono font-bold uppercase text-[#C8323C]"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              margin: "0 0 8px 0",
            }}
          >
            Ya lo sabes todo
          </p>
          <h2
            className="font-heading font-bold text-[var(--landing-text)]"
            style={{
              fontSize: "clamp(26px, 4.6vw, 34px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: 0,
              maxWidth: 560,
            }}
          >
            30 segundos y decides con fundamentos.
          </h2>
        </div>

        {/* DER · CTA */}
        <div className="flex shrink-0 flex-col items-start gap-2.5 md:items-end">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 font-mono font-bold uppercase text-[#C8323C] transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[rgba(200,50,60,0.06)]"
            style={{
              background: "transparent",
              border: "0.5px solid #C8323C",
              fontSize: 13,
              letterSpacing: "0.04em",
              padding: "14px 24px",
              borderRadius: 6,
            }}
          >
            Analizar departamento
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <p
            className="font-body text-[var(--landing-text-muted)]"
            style={{ fontSize: 11 }}
          >
            1 análisis gratis · sin tarjeta · 30s
          </p>
        </div>
      </div>
    </section>
  );
}
