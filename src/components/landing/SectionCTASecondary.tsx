"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";

/**
 * Sección 08 · CTA secundario — bg base + botón outline (F.11 Phase 2.5).
 * No se invierte para no competir con s06 y s10 (dos rojos seguidos = ruido).
 */
export default function SectionCTASecondary() {
  return (
    <section
      className="flex min-h-screen items-center"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto w-full max-w-[820px] px-6 py-14 md:py-[72px]">
        <SectionHeader
          eyebrow="08 · Ya lo sabes todo"
          title={"30 segundos y decides\ncon fundamentos."}
          subhead="Sin tarjeta, sin compromiso. Si los números no cierran, mejor saberlo ahora."
          align="center"
        />

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md border border-[#C8323C] bg-transparent px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-[#C8323C] transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[rgba(200,50,60,0.06)]"
          >
            Analizar mi departamento ahora
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;30 segundos
          </p>
        </div>
      </div>
    </section>
  );
}
