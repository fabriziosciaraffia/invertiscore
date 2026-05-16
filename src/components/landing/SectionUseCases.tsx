"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import LandingModal from "./LandingModal";
import { RevealOnScroll } from "./RevealOnScroll";

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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <section
      className="relative"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-[14vh] md:pt-[16vh]">
        <UseCasesHeader />
      </div>

      {isDesktop ? (
        <CardsStack3D onSelect={setActive} />
      ) : (
        <div className="mx-auto w-full max-w-[1280px] px-6 pb-[14vh] md:pb-[16vh]">
          <CardsStatic onSelect={setActive} />
        </div>
      )}

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
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-hidden="true"
        style={{
          width: 24,
          height: 1,
          background: "rgba(200, 50, 60, 0.6)",
          marginBottom: 16,
        }}
      />
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
        className="font-heading font-bold leading-[1.1] tracking-[-0.015em] text-[var(--landing-text)]"
        style={{ maxWidth: 1100, marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.1 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)" }}
              variants={lineVariant(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      {/* F.11 test: subhead reemplazado por <RevealOnScroll> para validar */}
      <RevealOnScroll delay={0.6} y={16} duration={0.5}>
        <p
          className="max-w-[680px] font-body text-[var(--landing-text-secondary)]"
          style={{ fontSize: 17, lineHeight: 1.55 }}
        >
          Tres perfiles, tres dolores, la misma respuesta honesta. Click en
          una para ver cómo Franco resuelve el caso.
        </p>
      </RevealOnScroll>
    </motion.div>
  );
}

/* ============================ Cards stack 3D (desktop, sticky 200vh) ============================ */

/**
 * 3 cards inician apiladas en el centro con offset/rotate y se separan
 * al grid 3-cols a medida que el usuario scrollea. Implementación sticky:
 *
 *   - Container wrapper de 200vh
 *   - Inner sticky top-0 h-screen, contenido vertical-centered
 *   - Cards renderizadas en grid 3-cols (slots fijos), cada una recibe un
 *     transform scroll-driven que las trae desde el centro al slot final.
 *
 * Estado inicial (scrollYProgress = 0):
 *   - Card 1 (slot izq):  translateX +120% (al centro), translateY 20, rotateZ -6°, scale 0.92
 *   - Card 2 (slot mid):  translateX 0,                  translateY 0,  rotateZ 0°,  scale 0.92
 *   - Card 3 (slot der):  translateX -120%,              translateY 20, rotateZ 6°,  scale 0.92
 *
 * Estado final (scrollYProgress >= 0.7):
 *   - Todas en su slot natural: translateX 0, translateY 0, rotateZ 0, scale 1.
 *
 * prefers-reduced-motion: render directo en estado final, sin scroll-driven.
 */
function CardsStack3D({ onSelect }: { onSelect: (p: Profile) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // 3 perfiles, transforms diferenciados por índice
  const initialOffsets = [
    { x: "120%", y: 20, rot: -6, z: 1 },
    { x: "0%", y: 0, rot: 0, z: 3 },
    { x: "-120%", y: 20, rot: 6, z: 1 },
  ];

  return (
    <div ref={ref} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-3 gap-6 px-6">
          {PROFILES.map((p, i) => {
            const cfg = initialOffsets[i];
            return (
              <Stack3DCard
                key={p.id}
                profile={p}
                onSelect={onSelect}
                scrollYProgress={scrollYProgress}
                initialX={cfg.x}
                initialY={cfg.y}
                initialRot={cfg.rot}
                initialZ={cfg.z}
                reduce={!!reduce}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stack3DCard({
  profile: p,
  onSelect,
  scrollYProgress,
  initialX,
  initialY,
  initialRot,
  initialZ,
  reduce,
}: {
  profile: Profile;
  onSelect: (p: Profile) => void;
  scrollYProgress: MotionValue<number>;
  initialX: string;
  initialY: number;
  initialRot: number;
  initialZ: number;
  reduce: boolean;
}) {
  // El stack se separa entre 0 y 0.7 del progreso, último 30% es buffer estable.
  const range = [0, 0.7];
  const x = useTransform(scrollYProgress, range, [initialX, "0%"]);
  const y = useTransform(scrollYProgress, range, [initialY, 0]);
  const rotate = useTransform(scrollYProgress, range, [initialRot, 0]);
  const scale = useTransform(scrollYProgress, range, [0.92, 1]);

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(p)}
      style={
        reduce
          ? { zIndex: "auto" }
          : { x, y, rotate, scale, zIndex: initialZ, willChange: "transform" }
      }
      className="group relative flex h-full flex-col rounded-2xl p-7 text-left transition-[box-shadow,border-color] duration-300 md:p-8"
    >
      {/* Inner card con bg y border (separado para no chocar con motion transform) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: "var(--landing-card-bg)",
          border: "0.5px solid var(--landing-card-border)",
          boxShadow:
            "0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -16px rgba(0,0,0,0.28)",
        }}
      />
      <span
        className="relative z-[1] font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        {p.label}
      </span>
      <h3
        className="relative z-[1] mt-4 font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(20px, 2.2vw, 26px)" }}
      >
        {p.shortLabel}
      </h3>
      <p
        className="relative z-[1] mt-3 font-body italic leading-[1.5] text-[var(--landing-text-secondary)]"
        style={{ fontSize: 15 }}
      >
        &ldquo;{p.question}&rdquo;
      </p>

      <div className="relative z-[1] mt-7 flex-1" />

      <span
        className="relative z-[1] inline-flex items-center gap-2 font-mono font-semibold uppercase text-[#C8323C] transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ fontSize: 11, letterSpacing: "0.12em" }}
      >
        Ver caso completo
        <span aria-hidden="true">→</span>
      </span>
    </motion.button>
  );
}

/* ============================ Cards static (mobile <768px) ============================ */

function CardsStatic({ onSelect }: { onSelect: (p: Profile) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-5">
      {PROFILES.map((p, i) => (
        <motion.button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
          transition={{
            duration: 0.6,
            ease: EASE,
            delay: reduce ? 0 : 0.1 + i * 0.1,
          }}
          className="group relative flex h-full flex-col rounded-2xl p-7 text-left"
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

          <span
            className="mt-6 inline-flex items-center gap-2 font-mono font-semibold uppercase text-[#C8323C]"
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
