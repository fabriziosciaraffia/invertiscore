"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";
import SectionHeader from "./SectionHeader";

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

const PROFILES: ReadonlyArray<Profile> = [
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
 * Sección 04 · Use cases — fondo Ink 100 (#FAFAF8).
 * Desktop: sticky scroll narrativo 300vh con header permanente arriba,
 * sidebar fijo izquierda, detalle cambia según scrollYProgress.
 * Mobile/reduced motion: stack vertical con click manual en sidebar.
 */
export default function SectionUseCases() {
  const [mode, setMode] = useState<"sticky" | "static">("static");

  useEffect(() => {
    const compute = () => {
      const m = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const d = window.matchMedia("(min-width: 768px)").matches;
      setMode(m && d ? "sticky" : "static");
    };
    compute();
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqDesk = window.matchMedia("(min-width: 768px)");
    mqMotion.addEventListener("change", compute);
    mqDesk.addEventListener("change", compute);
    return () => {
      mqMotion.removeEventListener("change", compute);
      mqDesk.removeEventListener("change", compute);
    };
  }, []);

  return (
    <section className="text-[var(--landing-text)]">
      {mode === "sticky" ? <StickyVariant /> : <StaticVariant />}
    </section>
  );
}

/* ============================ Sticky (desktop) ============================ */

function StickyVariant() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      const idx = p >= 0.66 ? 2 : p >= 0.33 ? 1 : 0;
      setActive(idx);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const handleSidebarClick = (i: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;
    const containerTop = window.scrollY + rect.top;
    // Aterrizar en el centro del rango del perfil i para que esté activo
    const targetP = i === 0 ? 0.1 : i === 1 ? 0.45 : 0.8;
    const targetY = containerTop + total * targetP;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number) => void } }).__lenis;
    if (lenis) lenis.scrollTo(targetY);
    else window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  return (
    <div ref={containerRef} className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-[64px] flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden">
        {/* Header permanente */}
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-8">
          <SectionHeader
            eyebrow="04 · Para quién"
            title={"Franco resuelve preguntas distintas\nsegún quién pregunta."}
            className="max-w-[820px]"
          />
        </div>

        {/* Body: sidebar + detalle, centrado vertical */}
        <div className="relative mx-auto flex w-full max-w-[1280px] flex-1 items-center px-6 pb-10">
          <div className="grid w-full grid-cols-[340px_1fr] gap-12">
            {/* Sidebar */}
            <nav className="flex flex-col gap-1" aria-label="Perfiles">
              {PROFILES.map((p, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSidebarClick(i)}
                    className="w-full rounded-r-md text-left transition-[background,opacity,border-color,color] duration-200"
                    style={{
                      background: isActive ? "rgba(200,50,60,0.06)" : "transparent",
                      borderLeft: isActive ? "2px solid #C8323C" : "2px solid transparent",
                      opacity: isActive ? 1 : 0.55,
                      padding: "14px 18px",
                    }}
                    aria-pressed={isActive}
                  >
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
                      {p.label}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-[1.4] text-[var(--landing-text-secondary)]">
                      {p.shortLabel}
                    </p>
                  </button>
                );
              })}
            </nav>

            {/* Detalle */}
            <div className="relative min-h-[360px]">
              {PROFILES.map((p, i) => (
                <div
                  key={p.id}
                  className={`absolute inset-0 flex flex-col gap-5 transition-[opacity,transform] duration-[400ms] ease-out ${
                    i === active ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "translateY(0)" : "translateY(16px)",
                  }}
                  aria-hidden={i !== active}
                >
                  <ProfileDetail profile={p} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Static (mobile / reduced) ============================ */

function StaticVariant() {
  const [active, setActive] = useState(0);
  const profile = PROFILES[active];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:py-12">
      <SectionHeader
        eyebrow="04 · Para quién"
        title={"Franco resuelve preguntas distintas\nsegún quién pregunta."}
        subhead="Tres perfiles, tres dolores, la misma respuesta honesta."
        className="max-w-[820px]"
      />

      <Reveal as="div" delay={0.15} className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr] md:gap-10">
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
                className="group shrink-0 rounded-r-md text-left transition-[background,opacity,border-color,color] duration-200 md:w-full"
                style={{
                  background: isActive ? "rgba(200,50,60,0.06)" : "transparent",
                  borderLeft: isActive ? "2px solid #C8323C" : "2px solid transparent",
                  opacity: isActive ? 1 : 0.55,
                  padding: "14px 18px",
                }}
                aria-pressed={isActive}
              >
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
                  {p.label}
                </p>
                <p className="mt-1 font-body text-[13px] leading-[1.4] text-[var(--landing-text-secondary)]">
                  {p.shortLabel}
                </p>
              </button>
            );
          })}
        </nav>

        <div key={profile.id} className="min-h-[360px] animate-fadeIn md:pl-2">
          <ProfileDetail profile={profile} />
        </div>
      </Reveal>
    </div>
  );
}

/* ============================ Profile detail (shared) ============================ */

function ProfileDetail({ profile }: { profile: Profile }) {
  return (
    <>
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
          Tu pregunta
        </p>
        <h3 className="mt-2 font-heading text-[28px] font-bold italic leading-[1.18] tracking-[-0.005em] text-[var(--landing-text)] md:text-[36px]">
          &ldquo;{profile.question}&rdquo;
        </h3>
        <p className="mt-4 max-w-[680px] font-body text-[15px] leading-[1.6] text-[var(--landing-text-secondary)] md:text-[16px]">
          {profile.body}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {profile.kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-md border px-5 py-5"
            style={{
              background: "var(--landing-card-bg)",
              borderColor: "var(--landing-card-border)",
              boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
            }}
          >
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-secondary)]">
              {k.label}
            </p>
            <p
              className="mt-1.5 font-mono text-[18px] font-semibold"
              style={{ color: k.red ? "#C8323C" : "var(--landing-text)" }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <Link
          href={profile.ctaHref}
          className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
        >
          {profile.ctaText}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </>
  );
}
