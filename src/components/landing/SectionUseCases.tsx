"use client";

import Link from "next/link";
import { useState } from "react";

type Profile = {
  id: string;
  label: string;
  shortLabel: string;
  question: string;
  body: string;
  kpis: Array<{ label: string; value: string; red?: boolean }>;
  ctaText: string;
  ctaHref: string;
};

const PROFILES: Profile[] = [
  {
    id: "01",
    label: "01 · Primera inversión",
    shortLabel: "Vas a invertir por primera vez",
    question: "¿Y si el depto no se paga solo?",
    body:
      "Tienes el pie. Te dijeron que se paga solo. Pero el flujo real, con todos los gastos que nadie suma, no aparece en la cotización. Franco te muestra cuánto sale de tu bolsillo cada mes, antes de firmar.",
    kpis: [
      { label: "Aporte mensual", value: "−$290.677", red: true },
      { label: "Precio sugerido", value: "$199M" },
      { label: "Ventaja", value: "+$15M" },
    ],
    ctaText: "Analizar mi depto",
    ctaHref: "/register",
  },
  {
    id: "02",
    label: "02 · Inversionista activo",
    shortLabel: "Ya tienes propiedades",
    question: "¿Renta más en Airbnb que arrendado normal?",
    body:
      "Sabes leer cap rate y TIR. Lo que necesitas es comparar modalidades con datos reales de ocupación, ADR y costos operativos. Franco evalúa LTR, STR y combinado en el mismo análisis.",
    kpis: [
      { label: "Delta Airbnb", value: "+$148K/mes" },
      { label: "TIR 10 años", value: "11,1%" },
      { label: "Cap rate STR", value: "4,8%" },
    ],
    ctaText: "Comparar modalidades",
    ctaHref: "/register",
  },
  {
    id: "03",
    label: "03 · Asesor · corredor",
    shortLabel: "Asesoras inversionistas",
    question: "¿Cómo sé que no le estoy recomendando una mala compra?",
    body:
      "Tu cliente quiere datos reales, no folletos. Franco te entrega análisis compartibles con la rigurosidad que tu asesoría exige: 12.944 comparables, motor financiero propio, veredicto explícito. Plan con análisis ilimitados.",
    kpis: [
      { label: "Comparables", value: "12.944" },
      { label: "Informe", value: "Compartible" },
      { label: "Plan asesor", value: "Ilimitado" },
    ],
    ctaText: "Franco para asesores",
    ctaHref: "/register",
  },
];

/**
 * Sección 04 · Use cases — fondo Ink 900 (dark).
 * Sidebar 300px + detalle dinámico con fade 200ms.
 */
export default function SectionUseCases() {
  const [active, setActive] = useState(0);
  const profile = PROFILES[active];

  return (
    <section className="snap-section-start flex min-h-screen items-center bg-[#0F0F0F] text-[#FAFAF8]">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:py-12">
        {/* Header */}
        <div className="max-w-[820px]">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#FAFAF8]/55">
            04 · Para quién
          </span>
          <h2 className="mt-3 font-heading text-[28px] font-bold leading-[1.1] tracking-[-0.01em] text-[#FAFAF8] md:text-[32px]">
            Franco resuelve preguntas distintas según quién pregunta.
          </h2>
          <p className="mt-3 max-w-[640px] font-body text-[14px] leading-[1.5] text-[#FAFAF8]/70 md:text-[15px]">
            Tres perfiles, tres dolores, la misma respuesta honesta.
          </p>
        </div>

        {/* Layout: tabs horizontales mobile / sidebar desktop */}
        <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr] md:gap-10">
          {/* Sidebar (mobile: scroll horizontal) */}
          <nav
            className="-mx-6 flex gap-2 overflow-x-auto scrollbar-hide px-6 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0"
            aria-label="Perfiles"
          >
            {PROFILES.map((p, i) => {
              const isActive = i === active;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`group shrink-0 rounded-r-md text-left transition-[background,opacity,border-color,color] duration-200 md:w-full ${
                    isActive
                      ? "bg-[rgba(200,50,60,0.12)] opacity-100"
                      : "bg-transparent opacity-50 hover:opacity-80"
                  }`}
                  style={{
                    borderLeft: isActive ? "2px solid #C8323C" : "2px solid transparent",
                    padding: "14px 18px",
                  }}
                  aria-pressed={isActive}
                >
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/65">
                    {p.label}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-[1.4] text-[#FAFAF8]/85">
                    {p.shortLabel}
                  </p>
                </button>
              );
            })}
          </nav>

          {/* Detalle */}
          <div key={profile.id} className="min-h-[360px] animate-fadeIn md:pl-2">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#FAFAF8]/55">
              Tu pregunta
            </p>
            <h3 className="mt-2 font-heading text-[24px] font-bold italic leading-[1.18] tracking-[-0.005em] text-[#FAFAF8] md:text-[28px]">
              &ldquo;{profile.question}&rdquo;
            </h3>
            <p className="mt-4 max-w-[640px] font-body text-[14px] leading-[1.6] text-[#888780]">
              {profile.body}
            </p>

            {/* KPI cards */}
            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {profile.kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-md border border-[rgba(250,250,248,0.08)] bg-[#1A1A1A] px-3.5 py-3"
                >
                  <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[#FAFAF8]/55">
                    {k.label}
                  </p>
                  <p
                    className="mt-1.5 font-mono text-[16px] font-semibold"
                    style={{ color: k.red ? "#FF5C66" : "#FAFAF8" }}
                  >
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-6">
              <Link
                href={profile.ctaHref}
                className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.18)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
              >
                {profile.ctaText}
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
