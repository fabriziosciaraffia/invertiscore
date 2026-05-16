"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";

/**
 * Sección 06 · CTA primario — invertido en Signal Red (F.11 Phase 2.5).
 * Bg #C8323C, texto blanco, eyebrow + microcopy rosa claro, botón invertido
 * (bg blanco + texto Signal Red).
 */
export default function SectionCTAPrimary() {
  return (
    <section
      className="relative flex min-h-screen items-center"
      style={{ background: "#C8323C" }}
    >
      <div className="mx-auto w-full max-w-[820px] px-6 py-14 md:py-[72px]">
        <SectionHeader
          eyebrow="06 · Tu turno"
          title={"Antes de firmar,\nve si los números cierran."}
          subhead="Ingresas precio, comuna y arriendo esperado. Franco te entrega veredicto en 30 segundos."
          align="center"
          tone="invertido"
          hideHairline
        />

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md bg-white px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-[#C8323C] shadow-[0_2px_0_rgba(0,0,0,0.12)] transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#F4F4F4]"
          >
            Analizar mi departamento
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p
            className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#FFD9DC" }}
          >
            Sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en 30s
          </p>
        </div>
      </div>
    </section>
  );
}
