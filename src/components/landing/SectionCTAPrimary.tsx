"use client";

import Link from "next/link";
import Reveal from "./Reveal";

/**
 * Sección 05 · CTA primario — fondo Ink 200, centered.
 */
export default function SectionCTAPrimary() {
  return (
    <section className="relative flex min-h-screen items-center">
      <Reveal as="div" className="mx-auto w-full max-w-[820px] px-6 py-14 text-center md:py-[72px]">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
          05 · Tu turno
        </span>
        <h2 className="mt-4 font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[var(--landing-text)] md:text-[44px]">
          Antes de firmar,
          <br />
          ve si los números cierran.
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] font-body text-[15px] leading-[1.55] text-[var(--landing-text-secondary)] md:text-[16px]">
          Ingresas precio, comuna y arriendo esperado. Franco te entrega
          veredicto en 30 segundos.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
          >
            Analizar mi departamento
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            Sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en 30s
          </p>
        </div>
      </Reveal>
    </section>
  );
}
