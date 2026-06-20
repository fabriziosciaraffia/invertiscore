"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroAnimatedDesktop from "./HeroAnimatedDesktop";
import HeroStaticMobile from "./HeroStaticMobile";

/**
 * Sección 01 · Hero (F.11 Phase 2.7 Etapa 4).
 *
 * Branch responsivo limpio:
 *   · Mobile (max 767px) → HeroStaticMobile · 2 cards estáticas sin framer-motion.
 *   · Desktop (≥768px)   → HeroAnimatedDesktop · 2 cards con loop animado completo.
 *
 * Motivación del split: el NotFoundError iOS WebKit (Phase 2.6 series) era
 * causado por el reconciler React + framer-motion ejecutándose en mobile. La
 * solución Phase 2.6h (forzar reduce-motion en mobile) bypaseaba el bug pero
 * mobile quedaba sin Hero diferenciado. Etapa 4 separa los paths: mobile no
 * monta NINGÚN motion del Hero, desktop conserva el loop completo de Etapa 3.
 *
 * Timing inicial desktop (Etapa 8 · sin eyebrow ni microcopy):
 *   t=0     H1 línea 1
 *   t=0.3   H1 línea 2 (Signal Red)
 *   t=0.7   subhead
 *   t=1.1   CTA
 *   t=1.8   Card 2 entra
 *   t=2.0   Card 1 entra
 *   t=2.7   loopArmed → arranca cycle
 *
 * Pausa reversible desktop: IntersectionObserver sobre la sección. Cuando el
 * hero está visible (≥20% intersect) Y loop ya armó, el mockup corre el cycle.
 *
 * prefers-reduced-motion (desktop) → final estático directo sin loop.
 * Mobile siempre static.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
// Aceleración de salida para el crossfade del copy rotativo (el entrante usa
// EASE — decel suave — y el saliente EASE_IN — accel — para un swap escalonado).
const EASE_IN = [0.4, 0, 1, 1] as const;

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [loopArmed, setLoopArmed] = useState(!!reduce);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const loopArmedRef = useRef(!!reduce);

  useEffect(() => {
    loopArmedRef.current = loopArmed;
  }, [loopArmed]);

  // Detección mobile via matchMedia + listener · post-mount para evitar
  // hydration mismatch (server-side asume desktop).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // armTimer + IO solo en desktop · skip si reduce-motion o mobile.
  useEffect(() => {
    if (reduce || isMobile) return;

    const armTimer = setTimeout(() => setLoopArmed(true), 2700);

    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      return () => clearTimeout(armTimer);
    }

    try {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!loopArmedRef.current) return;
          const visible =
            entry.isIntersecting && entry.intersectionRatio >= 0.2;
          setIsHeroVisible(visible);
        },
        { threshold: [0, 0.2, 0.5] },
      );
      observer.observe(section);

      return () => {
        clearTimeout(armTimer);
        observer.disconnect();
      };
    } catch {
      setIsHeroVisible(true);
      return () => clearTimeout(armTimer);
    }
  }, [reduce, isMobile]);

  return (
    <section
      ref={sectionRef}
      className="relative flex items-start overflow-x-hidden md:items-center"
      style={{ minHeight: "100vh", background: "var(--franco-bg-base)" }}
    >
      {isMobile ? (
        /* === Mobile · stack vertical · px-5 (16→20px lateral) para que el
             H1 no quede pegado al borde · 3 líneas explícitas en HeroCopy. === */
        <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-12">
          {/* Phase 2.21 · rotación LTR↔STR corre en mobile (bug NotFoundError
              resuelto en 2.18d). reduce viene de useReducedMotion real, no
              forzado a true en mobile. */}
          <HeroCopy reduce={!!reduce} mobile />
          <HeroStaticMobile />
        </div>
      ) : (
        /* === Desktop · grid simétrico dentro del container max-w-6xl ===
             Phase 2.12 · cards ya no anchored al viewport. Ambos bloques
             viven dentro del container con el mismo respiro de borde (px-8). */
        <div className="mx-auto w-full max-w-6xl px-8 md:py-20">
          <div className="grid grid-cols-[1.1fr_1fr] items-center gap-8">
            <div>
              <HeroCopy reduce={!!reduce} mobile={false} />
            </div>
            <div className="relative flex items-center justify-end">
              <HeroAnimatedDesktop
                loopArmed={loopArmed}
                heroVisible={isHeroVisible}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HeroCopy({ reduce, mobile }: { reduce: boolean; mobile: boolean }) {
  const delay = (sec: number) => (reduce ? 0 : sec);

  return (
    <>
      {/* Bloque rotativo (eyebrow + H1 + subhead + dots indicator).
          Always-mounted en grid stack · pausa-on-hover/long-press · 8s loop. */}
      <HeroRotatingCopy reduce={reduce} mobile={mobile} />

      {/* Microcopy "HOY DISPONIBLE…" · estable (no rota con el copy).
          initial constante (mismo server/client) · transition.duration=0
          bajo reduce evita hydration mismatch + snap instantáneo. */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? 0 : 0.4,
          ease: EASE,
          delay: delay(0.9),
        }}
        className={`${mobile ? "mt-4" : "mt-6"} font-mono uppercase text-[var(--landing-text-muted)]`}
        style={{ fontSize: 10, letterSpacing: "0.08em" }}
      >
        Hoy disponible para Gran Santiago
      </motion.p>

      {/* CTA · estable */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? 0 : 0.4,
          ease: EASE,
          delay: delay(1.1),
        }}
        className={`${mobile ? "mt-5" : "mt-7"} flex items-start`}
      >
        <Link
          href="/analisis/nuevo-v2"
          className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
        >
          Analizar departamento
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </motion.div>
    </>
  );
}

/* ============================ HeroRotatingCopy (Phase 2.21) ============================
 *
 * Rotación LTR↔STR del bloque (eyebrow + H1 + subhead) cada 8s. Doctrina
 * post-2.18d:
 *   · AMBAS versiones SIEMPRE montadas en un grid stack (mismo grid-area).
 *     NO {activeIndex===0 && <Copy>} · NO AnimatePresence.
 *   · motion.div always-mounted con animate condicional (opacity + y 8px).
 *   · pausedRef es REF (no state). El touch NO entra en las deps del effect.
 *   · setInterval 100ms tick · acumula elapsedRef · avanza activeIndex al
 *     cruzar 8000ms · pause-aware (poll antes de incrementar).
 *   · Cleanup completo del interval y holdTimerRef.
 *   · prefers-reduced-motion → solo LTR estático, sin rotación ni dots.
 *
 * Pausa-on-hold:
 *   · Desktop (mouse): onMouseEnter pausa · onMouseLeave reanuda.
 *   · Mobile (touch): onPointerDown con threshold 200ms · onPointerUp/Cancel
 *     reanuda (cancela threshold si llega antes de 200ms = tap corto).
 *   · El wrapper recibe className "is-paused" vía ref + classList — pausa
 *     simultánea de la animación CSS del dot (animation-play-state: paused).
 * ──────────────────────────────────────────────────────────────────────── */

const ROTATE_INTERVAL_MS = 8000;
const TICK_MS = 100;
const HOLD_THRESHOLD_MS = 200;

function HeroRotatingCopy({
  reduce,
  mobile,
}: {
  reduce: boolean;
  mobile: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pausedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const pause = () => {
    pausedRef.current = true;
    wrapperRef.current?.classList.add("is-paused");
  };
  const resume = () => {
    pausedRef.current = false;
    wrapperRef.current?.classList.remove("is-paused");
  };

  // Mouse · desktop · pausa directa sin threshold (hover es intencional).
  const handleMouseEnter = () => pause();
  const handleMouseLeave = () => resume();

  // Touch · mobile · threshold 200ms para distinguir tap corto de hold.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => pause(), HOLD_THRESHOLD_MS);
  };
  const handlePointerEnd = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    resume();
  };

  // Cleanup holdTimer en unmount (independiente del effect del interval).
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Loop interval · deps SOLO [reduce] (sin activeIndex ni paused).
  useEffect(() => {
    if (reduce) return;
    let mounted = true;
    const id = setInterval(() => {
      if (!mounted) return;
      if (pausedRef.current) return;
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= ROTATE_INTERVAL_MS) {
        elapsedRef.current = 0;
        setActiveIndex((i) => (i === 0 ? 1 : 0));
      }
    }, TICK_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [reduce]);

  // Click en dot · cambia activeIndex y resetea el timer del ciclo (sin
  // teardown del effect · solo se resetea el contador local).
  const handleDotClick = (i: number) => {
    elapsedRef.current = 0;
    setActiveIndex(i);
  };

  // Transiciones del crossfade · entrante (decel + delay) vs saliente (accel).
  // El delay del entrante deja que el saliente casi termine antes de aparecer,
  // por eso no hay momento con ambos títulos a media opacidad.
  const fadeIn = reduce
    ? { duration: 0 }
    : { duration: 0.6, ease: EASE, delay: 0.18 };
  const fadeOut = reduce
    ? { duration: 0 }
    : { duration: 0.32, ease: EASE_IN };

  return (
    <div
      ref={wrapperRef}
      className="s01-hero-copy"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ touchAction: "pan-y" }}
    >
      {/* Grid stack · ambas versiones overlap en la misma cell.
          Phase 2.23 · STR reescrito a "¿Airbnb o arriendo tradicional?"
          para igualar el n° de líneas del H1 LTR · el grid hace
          max(content_LTR, content_STR) naturalmente, sin minHeight.

          Crossfade suave (Phase 2.29): solo opacity, sin desplazamiento
          vertical. Antes el saliente subía (y:-8) y el entrante bajaba
          (y:8→0) — direcciones opuestas cruzándose con ambos a media
          opacidad, lo que se sentía "saltón". Ahora el swap es escalonado:
          el saliente se va rápido (fadeOut, accel) y el entrante aparece con
          un pequeño delay (fadeIn, decel), evitando el doble-texto. */}
      <div style={{ display: "grid" }}>
        <motion.div
          style={{
            gridArea: "1 / 1",
            pointerEvents: activeIndex === 0 ? "auto" : "none",
          }}
          initial={false}
          animate={{ opacity: activeIndex === 0 ? 1 : 0 }}
          transition={activeIndex === 0 ? fadeIn : fadeOut}
          aria-hidden={activeIndex !== 0}
        >
          <CopyLTR reduce={reduce} mobile={mobile} />
        </motion.div>
        <motion.div
          style={{
            gridArea: "1 / 1",
            pointerEvents: activeIndex === 1 ? "auto" : "none",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: activeIndex === 1 ? 1 : 0 }}
          transition={activeIndex === 1 ? fadeIn : fadeOut}
          aria-hidden={activeIndex !== 1}
        >
          <CopySTR mobile={mobile} />
        </motion.div>
      </div>

      {/* Dots indicator · siempre montados (SSR-safe).
          Bajo prefers-reduced-motion el dot activo se renderiza estático
          (CSS media query: transform scaleX(1), animation:none).
          Static <button> sin motion · key estática (índice del array constante). */}
      <div
        className={`${mobile ? "mt-4" : "mt-5"} flex items-center`}
        style={{ gap: 0 }}
        aria-label="Selector de versión del copy"
      >
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={
              i === 0
                ? "Mostrar análisis arriendo largo"
                : "Mostrar análisis Airbnb"
            }
            aria-pressed={activeIndex === i}
            onClick={() => handleDotClick(i)}
            style={{
              padding: 3,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <span
              className={`s01-hero-dot${activeIndex === i ? " s01-hero-dot--active" : ""}`}
            >
              <span className="s01-hero-dot-fill" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ====== Copy LTR (versión 1) · "¿Y si el depto no se paga solo?" ===========
 *
 * Preserva la animación slide-up línea-por-línea del Hero original (corre
 * UNA vez en el mount inicial). Crossfade subsecuente lo maneja el wrapper
 * motion.div de HeroRotatingCopy.
 * ──────────────────────────────────────────────────────────────────────── */
function CopyLTR({
  reduce,
  mobile,
}: {
  reduce: boolean;
  mobile: boolean;
}) {
  const delay = (sec: number) => (reduce ? 0 : sec);
  return (
    <>
      <p
        className="font-mono font-bold uppercase"
        style={{
          fontSize: 10,
          color: "#C8323C",
          letterSpacing: "0.14em",
          marginBottom: 12,
        }}
      >
        Análisis arriendo largo
      </p>
      <h1
        className="font-heading font-bold leading-[1.02] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{
          fontSize: mobile
            ? "clamp(42px, 12vw, 58px)"
            : "clamp(48px, 8.5vw, 88px)",
        }}
      >
        {/* initial constante SSR-safe · transition.duration=0 bajo reduce
            evita hydration mismatch (la animación snap-ea instantáneo). */}
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block"
            initial={{ y: "105%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: reduce ? 0 : 0.7,
              ease: EASE,
              delay: delay(0),
            }}
          >
            ¿Y si el depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block text-[#C8323C]"
            initial={{ y: "105%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: reduce ? 0 : 0.7,
              ease: EASE,
              delay: delay(0.25),
            }}
          >
            no se paga
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block text-[#C8323C]"
            initial={{ y: "105%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: reduce ? 0 : 0.75,
              ease: EASE,
              delay: delay(0.45),
            }}
          >
            solo?
          </motion.span>
        </span>
      </h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? 0 : 0.4,
          ease: EASE,
          delay: delay(0.7),
        }}
        className={`${mobile ? "mt-5" : "mt-8"} max-w-[540px] font-body text-[var(--landing-text-secondary)]`}
        style={{ fontSize: mobile ? 14 : 18, lineHeight: 1.5 }}
      >
        Antes de invertir, ve si los números cierran o vas a poner plata todos los meses.
      </motion.p>
    </>
  );
}

/* ====== Copy STR (versión 2) · "¿Conviene Airbnb o arriendo tradicional?" ===
 *
 * Sin slide-up línea-por-línea (la versión queda hidden en mount inicial
 * vía wrapper opacity:0). Aparece via crossfade del wrapper en cada
 * activación. "Airbnb" en Signal Red.
 * ──────────────────────────────────────────────────────────────────────── */
function CopySTR({ mobile }: { mobile: boolean }) {
  return (
    <>
      <p
        className="font-mono font-bold uppercase"
        style={{
          fontSize: 10,
          color: "#C8323C",
          letterSpacing: "0.14em",
          marginBottom: 12,
        }}
      >
        Análisis Airbnb
      </p>
      <h1
        className="font-heading font-bold leading-[1.02] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{
          fontSize: mobile
            ? "clamp(42px, 12vw, 58px)"
            : "clamp(48px, 8.5vw, 88px)",
        }}
      >
        ¿<span className="text-[#C8323C]">Airbnb</span> o arriendo tradicional?
      </h1>
      <p
        className={`${mobile ? "mt-5" : "mt-8"} max-w-[540px] font-body text-[var(--landing-text-secondary)]`}
        style={{ fontSize: mobile ? 14 : 18, lineHeight: 1.5 }}
      >
        Compara las dos modalidades con datos reales de tu zona y decide con números, no con intuición.
      </p>
    </>
  );
}
