"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";

/**
 * Sección 07 · CTA secundario — centered.
 */
export default function SectionCTASecondary() {
  return (
    <section className="flex min-h-screen items-center">
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
            className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
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
