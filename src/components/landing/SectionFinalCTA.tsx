"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";
import SectionGhostNumber from "./SectionGhostNumber";

/**
 * Sección 10 · CTA final — invertido en Signal Red (F.11 Phase 2.5).
 * Bg #C8323C, texto blanco, botón invertido (bg blanco + texto Signal Red).
 *
 * F.11 Phase 2.18 · Numeral fantasma migrado a SectionGhostNumber reusable
 * y anclado al título (top ~calc(50% - 30px)) en lugar del centro vertical,
 * para consistencia con s02-s09. Tono invertido por bg Signal Red.
 */
export default function SectionFinalCTA() {
  return (
    <section
      className="relative flex min-h-screen items-center overflow-hidden"
      style={{ background: "#C8323C" }}
    >
      <SectionGhostNumber
        number="10"
        side="right"
        tone="invertido"
        top="calc(50% - 30px)"
      />

      <div className="relative mx-auto w-full max-w-[820px] px-6 py-16 md:py-[88px]">
        <SectionHeader
          eyebrow="10 · Tu turno"
          title={"¿Y si el depto\nno se paga solo?"}
          subhead="30 segundos y decides con fundamentos. Antes de firmar 25 años."
          align="center"
          tone="invertido"
          hideHairline
        />

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md bg-white px-7 py-4 font-mono text-[14px] font-semibold uppercase tracking-[0.06em] text-[#C8323C] shadow-[0_4px_24px_rgba(0,0,0,0.15)] transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#F4F4F4]"
          >
            Analizar departamento
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p
            className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#FFD9DC" }}
          >
            1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta
          </p>
        </div>
      </div>
    </section>
  );
}
