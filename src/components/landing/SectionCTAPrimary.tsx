"use client";

import Link from "next/link";

/**
 * Sección 06 · CTA primario — franja horizontal compacta en Signal Red
 * (F.11 Phase 2.36). Antes era min-h-screen; ahora es una franja: título a la
 * izquierda + CTA a la derecha (stack vertical en mobile). Header inline
 * (sin SectionHeader, sin subhead).
 */
export default function SectionCTAPrimary() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#C8323C" }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-8 md:py-14">
        {/* IZQ · título */}
        <div>
          <p
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "#FFD9DC",
              margin: "0 0 8px 0",
            }}
          >
            Tu turno
          </p>
          <h2
            className="font-heading font-bold"
            style={{
              fontSize: "clamp(28px, 5vw, 36px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              margin: 0,
              maxWidth: 560,
            }}
          >
            Antes de firmar, ve si los números cierran.
          </h2>
        </div>

        {/* DER · CTA */}
        <div className="flex shrink-0 flex-col items-start gap-2.5 md:items-end">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 font-mono font-bold uppercase transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#F4F4F4]"
            style={{
              background: "#FFFFFF",
              color: "#C8323C",
              fontSize: 13,
              letterSpacing: "0.04em",
              padding: "14px 24px",
              borderRadius: 6,
              boxShadow: "0 2px 0 rgba(0,0,0,0.1)",
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
          <p className="font-body" style={{ fontSize: 11, color: "#FFD9DC" }}>
            Sin tarjeta · 1 análisis gratis · 30s
          </p>
        </div>
      </div>
    </section>
  );
}
