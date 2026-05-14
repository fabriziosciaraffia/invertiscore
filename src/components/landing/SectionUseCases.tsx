"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import LandingModal from "./LandingModal";

/**
 * Sección 05 · Para quién — grid de 3 cards con modal al click.
 *
 * - Header gigante 56-72px scroll-driven (mismo patrón que s02).
 * - 3 cards en grid con animación de entrada stagger slide+fade.
 * - Click en card → modal con detalle completo (pregunta, body, KPIs, CTA).
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

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

export default function SectionUseCases() {
  const [active, setActive] = useState<Profile | null>(null);

  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-[14vh] md:py-[16vh]">
        <UseCasesHeader />
        <Cards onSelect={setActive} />
      </div>

      <LandingModal
        open={!!active}
        onClose={() => setActive(null)}
        ariaLabel={active ? active.label : "Detalle del perfil"}
      >
        {active && <ProfileDetail profile={active} />}
      </LandingModal>
    </section>
  );
}

/* ============================ Header ============================ */

function UseCasesHeader() {
  const reduce = useReducedMotion();
  const lines = ["Franco resuelve preguntas distintas", "según quién pregunta."];

  const lineVariant = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.75,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.15,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      className="mb-[8vh]"
    >
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 24 }}
      >
        05 · Para quién
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ maxWidth: 1100, marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.05 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
              variants={lineVariant(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
        className="max-w-[680px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 17, lineHeight: 1.55 }}
      >
        Tres perfiles, tres dolores, la misma respuesta honesta. Click en
        una para ver cómo Franco resuelve el caso.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Cards grid ============================ */

function Cards({ onSelect }: { onSelect: (p: Profile) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  const reduce = useReducedMotion();

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
      {PROFILES.map((p, i) => (
        <motion.button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={
            inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }
          }
          transition={{
            duration: 0.7,
            ease: EASE,
            delay: reduce ? 0 : 0.1 + i * 0.12,
          }}
          className="group relative flex h-full flex-col rounded-2xl p-7 text-left transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 md:p-8"
          style={{
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.04), 0 12px 24px -16px rgba(0,0,0,0.18)",
          }}
        >
          <span
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 10, letterSpacing: "0.16em" }}
          >
            {p.label}
          </span>
          <h3
            className="mt-4 font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
            style={{ fontSize: "clamp(20px, 2.2vw, 26px)" }}
          >
            {p.shortLabel}
          </h3>
          <p
            className="mt-3 font-body italic leading-[1.5] text-[var(--landing-text-secondary)]"
            style={{ fontSize: 15 }}
          >
            &ldquo;{p.question}&rdquo;
          </p>

          <div className="mt-7 flex-1" />

          <span
            className="inline-flex items-center gap-2 font-mono font-semibold uppercase text-[#C8323C] transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ fontSize: 11, letterSpacing: "0.12em" }}
          >
            Ver caso completo
            <span aria-hidden="true">→</span>
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/* ============================ Modal content ============================ */

function ProfileDetail({ profile }: { profile: Profile }) {
  return (
    <div className="px-7 py-9 md:px-10 md:py-12">
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        {profile.label}
      </p>

      <p
        className="mt-3 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        Tu pregunta
      </p>
      <h3
        className="mt-2 font-heading font-bold italic leading-[1.18] tracking-[-0.005em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(24px, 3.2vw, 34px)" }}
      >
        &ldquo;{profile.question}&rdquo;
      </h3>
      <p
        className="mt-5 max-w-[640px] font-body leading-[1.6] text-[var(--landing-text-secondary)]"
        style={{ fontSize: 16 }}
      >
        {profile.body}
      </p>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {profile.kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-md px-4 py-4"
            style={{
              background: "var(--landing-card-bg-soft)",
              border: "0.5px solid var(--landing-card-border)",
            }}
          >
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{ fontSize: 9, letterSpacing: "0.14em" }}
            >
              {k.label}
            </p>
            <p
              className="mt-1.5 font-mono font-semibold"
              style={{
                fontSize: 18,
                color: k.red ? "#C8323C" : "var(--landing-text)",
              }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href={profile.ctaHref}
          className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
        >
          {profile.ctaText}
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
