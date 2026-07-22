"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 05 · Para quién — carrusel de 3 perfiles (F.11 Phase 2.22).
 *
 * Cambios clave:
 *  - TABS arriba (selección manual) con affordance clara de click: hover
 *    eleva + border Signal Red, ícono "→" en tabs inactivos.
 *  - FLECHAS afuera de la card (layout flex con card flex-grow).
 *  - Card grande con IDENTIDAD protagonista arriba (eyebrow + identidad
 *    Source Serif), border-bottom separador, después grid TU DUDA / FRANCO
 *    RESPONDE.
 *  - DOTS abajo de la card · navegación manual sin animación de fill.
 *  - SIN auto-rotación · navegación 100% manual (tabs + dots + flechas + swipe).
 *  - Patrón SAFE Phase 2.6: 3 perfiles siempre montados, no AnimatePresence,
 *    pointerEvents/aria-hidden condicionales, cleanup completo.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

/* Hook · detecta si el tema actual es light leyendo data-theme en <html>
 * (fuente única de tema · Fase 1). */
function useLandingIsLight(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setIsLight(root.getAttribute("data-theme") === "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

type Kpi = { label: string; value: string; red?: boolean };

type Profile = {
  id: string;
  /** Eyebrow mono arriba de la identidad · "PERFIL 0X · DE 03" */
  eyebrow: string;
  /** Label corto para el tab (auto-selección arriba) */
  tabLabel: string;
  /** Identidad protagonista · Source Serif bold */
  identity: string;
  /** Pregunta del perfil · Sans italic */
  question: string;
  /** Narrativa explicativa · Sans muted */
  narrative: string;
  kpis: Kpi[];
  ctaText: string;
  ctaHref: string;
};

const PROFILES: ReadonlyArray<Profile> = [
  {
    id: "01",
    eyebrow: "PERFIL 01 · DE 03",
    tabLabel: "Aún no compro",
    identity: "Estás por comprar tu primer depto para invertir.",
    question:
      "¿Esto se paga solo o voy a poner plata todos los meses?",
    narrative:
      "Franco te dice cuánto pones de tu bolsillo, a qué precio sí cierra el negocio, y si la plusvalía compensa el flujo negativo.",
    kpis: [
      { label: "Aporte mensual", value: "−$290K", red: true },
      { label: "Precio que cierra", value: "$199M" },
      { label: "Ventaja apalancado", value: "+$15M" },
    ],
    ctaText: "Analizar departamento →",
    ctaHref: "/register",
  },
  {
    id: "02",
    eyebrow: "PERFIL 02 · DE 03",
    tabLabel: "Ya compré",
    identity: "Ya tienes el depto y quieres saber si fue buen negocio.",
    question:
      "¿Compré bien? ¿Puedo subir el arriendo o me conviene otra cosa?",
    narrative:
      "Pones lo que pagaste y a cuánto arriendas. Franco te muestra el precio de mercado de la zona hoy, si tu arriendo está bajo lo que se paga, y qué movida tiene más sentido.",
    kpis: [
      { label: "Mercado hoy vs tu compra", value: "+UF 280" },
      { label: "Arriendo vs mercado", value: "−UF 2/mes", red: true },
      { label: "Potencial Airbnb", value: "+$148K/mes" },
    ],
    ctaText: "Evaluar inversión →",
    ctaHref: "/register",
  },
  {
    id: "03",
    eyebrow: "PERFIL 03 · DE 03",
    tabLabel: "Soy corredor",
    identity: "Asesoras inversionistas y tu reputación está en juego.",
    question: "¿Cómo sé que no le recomiendo una mala compra?",
    narrative:
      "Franco te da un informe compartible con respaldo de datos. Tu cliente confía en números, no solo en tu palabra.",
    kpis: [
      { label: "Comparables", value: "12.944" },
      { label: "Informe", value: "Compartible" },
      { label: "Plan asesor", value: "Ilimitado" },
    ],
    ctaText: "Franco para asesores →",
    ctaHref: "/register",
  },
];

export default function SectionUseCases() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <div className="relative mx-auto w-full max-w-[1280px] px-6 pt-[10vh] md:pt-[10vh]">
        <UseCasesHeader />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-6 pb-[10vh] md:pb-[10vh]">
        <ProfileCarousel />
      </div>
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
      viewport={{ once: true, margin: "-100px 0px -100px 0px" }}
      className="mb-12 md:mb-16"
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
        Para quién
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

      <RevealOnScroll delay={0.6} y={16} duration={0.5}>
        <p
          className="max-w-[680px] font-body text-[var(--landing-text-secondary)]"
          style={{ fontSize: 17, lineHeight: 1.55 }}
        >
          Tres perfiles, tres dolores, la misma respuesta honesta.
        </p>
      </RevealOnScroll>
    </motion.div>
  );
}

/* ============================ Carousel ============================ */

function ProfileCarousel() {
  const reduce = useReducedMotion();
  const isLight = useLandingIsLight();

  const [activeIndex, setActiveIndex] = useState(0);
  // direction: +1 = next, -1 = prev · controla signo del slide en transición.
  const [direction, setDirection] = useState(1);

  /* Helpers de navegación · setean direction + índice. */
  const goTo = (next: number, dir: 1 | -1) => {
    setDirection(dir);
    setActiveIndex(((next % PROFILES.length) + PROFILES.length) % PROFILES.length);
  };

  const goNext = () => goTo(activeIndex + 1, 1);
  const goPrev = () => goTo(activeIndex - 1, -1);
  const goIndex = (i: number) => {
    if (i === activeIndex) return;
    goTo(i, i > activeIndex ? 1 : -1);
  };

  /* Touch swipe · mobile · delta X > 50px = swipe. */
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX ?? touchStartX.current;
    touchDeltaX.current = x - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const dotInactive = isLight
    ? "rgba(0,0,0,0.15)"
    : "rgba(255,255,255,0.15)";
  const dotInactiveHover = isLight
    ? "rgba(0,0,0,0.3)"
    : "rgba(255,255,255,0.3)";

  return (
    <div
      className="mx-auto"
      style={{ maxWidth: 960, width: "100%" }}
    >
      {/* ========== TABS · selección manual con affordance de click ========== */}
      <div className="flex" style={{ gap: 8, marginBottom: 20 }}>
        {PROFILES.map((p, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => goIndex(i)}
              aria-pressed={active}
              aria-label={`Ver perfil ${p.id}: ${p.tabLabel}`}
              className="landing-usecase-tab flex-1 font-body"
              data-active={active}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 14px",
                borderRadius: 10,
                border: active
                  ? "0.5px solid #C8323C"
                  : "0.5px solid var(--landing-card-border)",
                background: active
                  ? "var(--landing-card-bg-soft)"
                  : "var(--landing-mockup-solid-bg)",
                color: active
                  ? "var(--landing-text)"
                  : "var(--landing-text-muted)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                textAlign: "center",
                cursor: "pointer",
                transition:
                  "background 200ms ease, border-color 200ms ease, color 200ms ease, transform 200ms ease",
              }}
            >
              <span>{p.tabLabel}</span>
              {/* Ícono "→" · sugiere click · solo en tabs inactivos */}
              {!active && (
                <span
                  aria-hidden="true"
                  className="font-mono"
                  style={{ fontSize: 11, opacity: 0.7, lineHeight: 1 }}
                >
                  →
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========== Row · flecha-izq · CARD · flecha-der (desktop) ========== */}
      <div
        className="flex items-stretch md:items-center"
        style={{ gap: 12 }}
      >
        {/* Flecha izquierda · desktop solo */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Perfil anterior"
          className="hidden md:flex items-center justify-center transition-colors group"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "0.5px solid var(--landing-card-border)",
            background: "transparent",
            color: "var(--landing-text-muted)",
            cursor: "pointer",
            fontSize: 14,
            alignSelf: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#C8323C";
            e.currentTarget.style.color = "var(--landing-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--landing-card-border)";
            e.currentTarget.style.color = "var(--landing-text-muted)";
          }}
        >
          ←
        </button>

        {/* CARD GRANDE · flex-grow · 3 perfiles always-mounted */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            position: "relative",
            flex: 1,
            background: "var(--landing-mockup-solid-bg)",
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 18,
            padding: "24px 36px",
            minHeight: 300,
            overflow: "hidden",
          }}
        >
          {/* Spacer invisible · mantiene min-height del active profile.
           * Renderizamos el perfil activo en flujo normal (visibility:hidden)
           * para que el contenedor crezca con el contenido más alto. Los 3
           * motion.div luego se apilan absolute encima. */}
          <div style={{ visibility: "hidden" }} aria-hidden="true">
            <ProfileCardContent profile={PROFILES[activeIndex]} />
          </div>

          {PROFILES.map((p, i) => {
            const isActive = i === activeIndex;
            return (
              <motion.div
                key={p.id}
                initial={false}
                animate={
                  isActive
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: direction * 20 }
                }
                transition={{
                  duration: reduce ? 0 : 0.4,
                  ease: EASE,
                }}
                aria-hidden={!isActive}
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "24px 36px",
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                <ProfileCardContent profile={p} />
              </motion.div>
            );
          })}
        </div>

        {/* Flecha derecha · desktop solo */}
        <button
          type="button"
          onClick={goNext}
          aria-label="Perfil siguiente"
          className="hidden md:flex items-center justify-center transition-colors"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "0.5px solid var(--landing-card-border)",
            background: "transparent",
            color: "var(--landing-text-muted)",
            cursor: "pointer",
            fontSize: 14,
            alignSelf: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#C8323C";
            e.currentTarget.style.color = "var(--landing-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--landing-card-border)";
            e.currentTarget.style.color = "var(--landing-text-muted)";
          }}
        >
          →
        </button>
      </div>

      {/* ========== DOTS abajo · navegación manual ========== */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 8, marginTop: 24 }}
      >
        {PROFILES.map((p, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => goIndex(i)}
              aria-label={`Ver perfil ${p.id}`}
              aria-current={active ? "true" : "false"}
              style={{
                width: 28,
                height: 3,
                borderRadius: 2,
                background: active ? "#C8323C" : dotInactive,
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "background 200ms ease",
              }}
              onMouseEnter={(e) => {
                if (active) return;
                e.currentTarget.style.background = dotInactiveHover;
              }}
              onMouseLeave={(e) => {
                if (active) return;
                e.currentTarget.style.background = dotInactive;
              }}
            />
          );
        })}
      </div>

    </div>
  );
}

/* ============================ Card content ============================ */

function ProfileCardContent({ profile }: { profile: Profile }) {
  return (
    <div className="flex h-full flex-col">
      {/* ===== Bloque identidad PROTAGONISTA arriba ===== */}
      <IdentityBlock profile={profile} />

      {/* ===== Grid contenido (desktop · 1.1fr / 0.9fr) ===== */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 32,
          alignItems: "start",
          flex: 1,
        }}
      >
        <QuestionColumn profile={profile} />
        <AnswerColumn profile={profile} />
      </div>

      {/* ===== Mobile · stack vertical ===== */}
      <div className="md:hidden flex flex-col" style={{ gap: 22 }}>
        <QuestionColumn profile={profile} />
        <AnswerColumn profile={profile} />
      </div>
    </div>
  );
}

function IdentityBlock({ profile }: { profile: Profile }) {
  return (
    <div
      style={{
        borderBottom: "0.5px solid var(--landing-card-border)",
        paddingBottom: 14,
        marginBottom: 20,
      }}
    >
      <p
        className="font-mono font-bold uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          color: "#C8323C",
          margin: 0,
          marginBottom: 10,
        }}
      >
        {profile.eyebrow}
      </p>
      <h3
        className="font-heading font-bold text-[var(--landing-text)]"
        style={{
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {profile.identity}
      </h3>
    </div>
  );
}

function QuestionColumn({ profile }: { profile: Profile }) {
  return (
    <div>
      {/* TU DUDA · eyebrow muted (NO Signal Red) */}
      <p
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          margin: 0,
          marginBottom: 12,
        }}
      >
        Tu duda
      </p>
      {/* Pregunta · Sans italic 19px (NO Source Serif) */}
      <p
        className="font-body italic text-[var(--landing-text)]"
        style={{
          fontSize: 19,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          margin: 0,
          marginBottom: 16,
        }}
      >
        &ldquo;{profile.question}&rdquo;
      </p>
      {/* Narrativa · Sans 13.5px muted */}
      <p
        className="font-body text-[var(--landing-text-secondary)]"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {profile.narrative}
      </p>
    </div>
  );
}

function AnswerColumn({ profile }: { profile: Profile }) {
  return (
    <div
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        borderLeft: "3px solid #C8323C",
        // Esquinas izquierda cuadradas (border-left protagonista).
        borderRadius: "0 12px 12px 0",
        padding: 18,
      }}
    >
      {/* FRANCO RESPONDE · eyebrow Signal Red */}
      <p
        className="font-mono font-bold uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          color: "#C8323C",
          margin: 0,
          marginBottom: 12,
        }}
      >
        Franco responde
      </p>

      <div>
        {profile.kpis.map((k, i) => (
          <div key={k.label}>
            <div
              className="flex items-center justify-between"
              style={{ padding: "8px 0", gap: 12 }}
            >
              <span
                className="font-body text-[var(--landing-text-secondary)]"
                style={{ fontSize: 12, lineHeight: 1.3 }}
              >
                {k.label}
              </span>
              <span
                className="font-mono font-bold"
                style={{
                  fontSize: 17,
                  letterSpacing: "-0.01em",
                  color: k.red ? "#C8323C" : "var(--landing-text)",
                  whiteSpace: "nowrap",
                }}
              >
                {k.value}
              </span>
            </div>
            {i < profile.kpis.length - 1 && (
              <div
                style={{
                  height: 1,
                  background: "var(--landing-card-border)",
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* CTA tras border-top */}
      <div
        style={{
          borderTop: "0.5px solid var(--landing-card-border)",
          marginTop: 12,
          paddingTop: 12,
        }}
      >
        <Link
          href={profile.ctaHref}
          className="font-mono font-bold uppercase transition-opacity hover:opacity-80"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "#C8323C",
            textDecoration: "none",
          }}
        >
          {profile.ctaText}
        </Link>
      </div>
    </div>
  );
}
