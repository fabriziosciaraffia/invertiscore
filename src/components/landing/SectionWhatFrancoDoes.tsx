"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import SectionHeader from "./SectionHeader";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 04 · Cómo funciona (F.11 Phase 2.3 · reset estilo Linear).
 *
 * Layout natural sin sticky. 3 pasos en bloques grid 2 cols con lados
 * alternados en desktop (texto izq → mockup der, mockup izq → texto der,
 * texto izq → mockup der). En mobile colapsa a 1 col con texto arriba
 * y mockup debajo en cada paso (orden consistente, sin alternar).
 *
 * Mockups: HTML/CSS placeholder con clase .franco-mockup (gradient bg +
 * shadow stack). Se reemplazarán por screenshots reales en fase futura.
 *
 * Animaciones: solo RevealOnScroll por paso.
 */

type Step = {
  numeral: "01" | "02" | "03";
  eyebrow: string;
  title: string;
  description: string;
  /** En desktop: si true → mockup va a la izquierda, texto a la derecha. */
  mockupLeft?: boolean;
  mockup: ReactNode;
};

const STEPS: ReadonlyArray<Step> = [
  {
    numeral: "01",
    eyebrow: "Datos del depto",
    title: "Ingresas el depto que estás evaluando.",
    description:
      "Dirección, precio, superficie, modalidad. 30 segundos.",
    mockup: <MockupStep01 />,
  },
  {
    numeral: "02",
    eyebrow: "Análisis en 30 segundos",
    title: "Calcula contribuciones, flujos y comparables.",
    description:
      "Franco autocompleta el resto con datos del SII, +34.000 propiedades y precios Airbnb en tiempo real.",
    mockupLeft: true,
    mockup: <MockupStep02 />,
  },
  {
    numeral: "03",
    eyebrow: "Decisión clara",
    title: "Score, veredicto y qué hacer en este caso.",
    description:
      "No solo te damos un puntaje. Te decimos si comprar, ajustar precio, cambiar modalidad o buscar otra. Y por qué.",
    mockup: <MockupStep03 />,
  },
];

export default function SectionWhatFrancoDoes() {
  return (
    <section
      id="que-hace-franco"
      className="relative"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-[12vh] md:px-8 md:py-[16vh]">
        <SectionHeader
          eyebrow="04 · Cómo funciona"
          title={"Le hacemos a tu depto las preguntas\nque tu cotización no responde."}
          subhead="Datos reales del mercado, contribuciones del SII, gastos operativos, comparables de tu zona. Todo procesado por IA en 30 segundos."
        />

        <div className="mt-16 space-y-24 md:mt-24 md:space-y-32">
          {STEPS.map((step) => (
            <RevealOnScroll key={step.numeral}>
              <StepBlock data={step} />
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ Step block ============================ */

function StepBlock({ data }: { data: Step }) {
  // En desktop alternamos lados con grid-flow-col-dense + col-start.
  // En mobile siempre texto arriba (orden natural).
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div
        className={data.mockupLeft ? "lg:order-2" : "lg:order-1"}
      >
        <StepText data={data} />
      </div>
      <div className={data.mockupLeft ? "lg:order-1" : "lg:order-2"}>
        {data.mockup}
      </div>
    </div>
  );
}

function StepText({ data }: { data: Step }) {
  return (
    <div className="max-w-[520px]">
      <p
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{
          fontSize: 14,
          letterSpacing: "0.06em",
          marginBottom: 16,
        }}
      >
        {data.numeral}
      </p>
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          marginBottom: 12,
        }}
      >
        {data.eyebrow}
      </p>
      <h3
        className="font-heading font-bold text-[var(--landing-text)]"
        style={{
          fontSize: "clamp(28px, 3.4vw, 36px)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          marginBottom: 16,
        }}
      >
        {data.title}
      </h3>
      <p
        className="font-body text-[var(--landing-text-muted)]"
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          maxWidth: 460,
        }}
      >
        {data.description}
      </p>
    </div>
  );
}

/* ============================ Mockup · 01 Datos del depto ============================
 *
 * F.11 Phase 2.8 · Enriquecido con mapa comparables + bloque Franco sugiere.
 *
 * Animación entrada single-pass (no loop):
 *   t=0     header + form fields visibles
 *   t=400   dropdown autocomplete fade-in (in-flow)
 *   t=800   mapa fade-in
 *   t=1000  pins verdes (45) stagger interno · delay i*15ms · total ~675ms
 *   t=1700  pin rojo central
 *   t=1900  bloque "Franco sugiere" fade-in
 *   t=2200  counters arrancan (arriendo 0→18 UF, airbnb 0→$145.000)
 *   t=3400  estado final estable
 *
 * Trigger: useInView con once:true → dispara una vez al entrar al viewport.
 * prefers-reduced-motion → estado final inmediato sin animation.
 *
 * Safe vs NotFoundError (Phase 2.6e/f patrón):
 *   · Pins SVG always-mounted (motion.g con animate condicional, no {cond &&})
 *   · Bloque Franco motion.div always-mounted
 *   · Mapa <img> normal con opacity vía motion.div wrapper
 *   · Counters vía rAF manual con flag mounted en cleanup
 */

const S01_EASE = [0.215, 0.61, 0.355, 1] as const;

function MockupStep01() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, {
    once: true,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    // Reduce motion: estado final inmediato.
    if (reduce) {
      setDropdownVisible(true);
      setShowMap(true);
      return;
    }

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const T = (offset: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (mounted) fn();
        }, offset),
      );
    };

    T(400, () => setDropdownVisible(true));
    T(800, () => setShowMap(true));

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [isInView, reduce]);

  return (
    <div
      ref={containerRef}
      className="franco-mockup"
      style={{ padding: 20 }}
    >
      {/* Header · logo refranco.ai mini + label "Nuevo análisis" */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 14 }}
      >
        <span className="inline-flex items-baseline">
          <span
            className="font-heading italic font-light"
            style={{
              fontSize: 11,
              color: "var(--landing-wm-re)",
              marginRight: "-0.08em",
            }}
          >
            re
          </span>
          <span
            className="font-heading font-bold"
            style={{ fontSize: 11, color: "var(--landing-wm-franco)" }}
          >
            franco
          </span>
          <span
            className="font-body font-semibold text-[#C8323C]"
            style={{ fontSize: 6, marginLeft: 1, letterSpacing: "0.1em" }}
          >
            .ai
          </span>
        </span>
        <span
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          Nuevo análisis
        </span>
      </div>

      {/* Campo Dirección · estilo Google Places autocomplete.
          Dropdown in-flow (no absolute) para que NO tape los chips TIPO. */}
      <div style={{ marginBottom: 10 }}>
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 3 }}
        >
          Dirección
        </p>
        <div
          style={{
            borderBottom: "0.5px solid var(--landing-divider)",
            paddingBottom: 4,
          }}
        >
          <span
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            Av. Manuel Montt 1234, Providencia
          </span>
        </div>
        {/* Dropdown autocomplete · always-mounted in-flow (Phase 2.6f patrón).
            Ocupa ~40px de altura desde t=0 (hidden con opacity:0) para evitar
            CLS · fade-in a t=400ms del trigger isInView. */}
        <motion.div
          initial={false}
          animate={
            dropdownVisible
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -4 }
          }
          transition={{ duration: 0.18, ease: S01_EASE }}
          aria-hidden={!dropdownVisible}
          style={{
            marginTop: 4,
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 5,
            padding: 3,
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            pointerEvents: dropdownVisible ? "auto" : "none",
          }}
        >
          <div
            className="font-body text-[var(--landing-text)]"
            style={{
              fontSize: 11,
              padding: "4px 6px",
              borderRadius: 3,
              background: "rgba(200,50,60,0.10)",
            }}
          >
            Av. Manuel Montt 1234, Providencia, Chile
          </div>
          <div
            className="font-body text-[var(--landing-text-secondary)]"
            style={{
              fontSize: 11,
              padding: "4px 6px",
              borderRadius: 3,
            }}
          >
            Av. Manuel Montt 1250, Providencia, Chile
          </div>
        </motion.div>
      </div>

      {/* Tipo · chips Usado / Nuevo */}
      <div style={{ marginBottom: 10 }}>
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 5 }}
        >
          Tipo
        </p>
        <div className="flex" style={{ gap: 6 }}>
          <span
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 4,
              border: "1px solid #C8323C",
              color: "#C8323C",
              background: "rgba(200,50,60,0.08)",
            }}
          >
            Usado
          </span>
          <span
            className="font-mono font-medium uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 4,
              border: "0.5px solid var(--landing-divider)",
              color: "var(--landing-text-muted)",
            }}
          >
            Nuevo
          </span>
        </div>
      </div>

      {/* Grid Precio / Superficie */}
      <div
        className="grid grid-cols-2"
        style={{ gap: 12, marginBottom: 12 }}
      >
        <div>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 3 }}
          >
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{ fontSize: 9, letterSpacing: "0.14em" }}
            >
              Precio
            </p>
            <div
              className="flex"
              style={{
                fontSize: 7,
                fontFamily: "var(--font-mono)",
                border: "0.5px solid var(--landing-divider)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  padding: "1px 4px",
                  background: "var(--landing-divider)",
                  color: "var(--landing-text)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                UF
              </span>
              <span
                style={{
                  padding: "1px 4px",
                  color: "var(--landing-text-muted)",
                  letterSpacing: "0.06em",
                }}
              >
                CLP
              </span>
            </div>
          </div>
          <div
            style={{
              borderBottom: "0.5px solid var(--landing-divider)",
              paddingBottom: 4,
            }}
          >
            <span
              className="font-body text-[var(--landing-text)]"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              UF 5.500
            </span>
          </div>
        </div>
        <div>
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 3 }}
          >
            Superficie
          </p>
          <div
            style={{
              borderBottom: "0.5px solid var(--landing-divider)",
              paddingBottom: 4,
            }}
          >
            <span
              className="font-body text-[var(--landing-text)]"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              60 m²
            </span>
          </div>
        </div>
      </div>

      {/* Mapa comparables · screenshot del producto real (incluye pins +
          label "145 comparables cerca" baked-in en la imagen). Fade-in
          cuando isInView dispara showMap a t=800ms. */}
      <motion.div
        initial={false}
        animate={{ opacity: showMap ? 1 : 0 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        className="relative w-full overflow-hidden rounded-md"
        style={{
          aspectRatio: "340 / 120",
          border: "0.5px solid var(--landing-card-border)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/map-comparables.webp"
          alt="Mapa con 145 comparables cerca"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </motion.div>


      {/* Botón Analizar */}
      <div
        style={{
          marginTop: 14,
          padding: "8px 14px",
          background: "#C8323C",
          color: "#FAFAF8",
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        Analizar
        <span aria-hidden="true">→</span>
      </div>
    </div>
  );
}



/* ============================ Mockup · 02 Análisis ============================
 *
 * F.11 Phase 2.9 · Análisis con barra progreso + 3 bloques (Costos / Ingresos /
 * Resultado) + footer fuente. Single-pass animation con useInView once.
 *
 * Animación entrada:
 *   t=0     header visible · "procesando" pulsing (loop opacity en motion.span)
 *   t=0-1500 barra progreso 0→100% (rAF continuo)
 *   t=1500  phase → "completado" (barra fade-out, label cambia)
 *   t=1700  Bloque 1 Costos reales fade-in + counters (78.400, 95.000, 173.400)
 *   t=2700  Bloque 2 Ingresos proyectados fade-in + counters (UF 18, $145K)
 *   t=3500  Bloque 3 Resultado fade-in + counters (5,0% verde, −$290K rojo)
 *   t=4400  Footer fade-in
 *
 * Safe vs NotFoundError (Phase 2.6e/f):
 *   · Bloques always-mounted con motion.div animate condicional
 *   · "procesando" / "completado" labels always-mounted, opacity controlado
 *   · Counters via rAF manual con cleanup
 *   · NO {cond && <motion>}, NO AnimatePresence
 */

function MockupStep02() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, {
    once: true,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"procesando" | "completado">("procesando");
  const [showCostos, setShowCostos] = useState(false);
  const [showIngresos, setShowIngresos] = useState(false);
  const [showResultado, setShowResultado] = useState(false);
  const [showFooter, setShowFooter] = useState(false);

  const [contribCount, setContribCount] = useState(0);
  const [gastosCount, setGastosCount] = useState(0);
  const [totalEgresosCount, setTotalEgresosCount] = useState(0);
  const [arriendoCount, setArriendoCount] = useState(0);
  const [airbnbCount, setAirbnbCount] = useState(0);
  // capRateCount va 0→50, render val/10 → "5,0"
  const [capRateCount, setCapRateCount] = useState(0);
  // flujoCount va 0→290000 (positivo), render con "−$" + val/1000 + "K"
  const [flujoCount, setFlujoCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    if (reduce) {
      setProgress(100);
      setPhase("completado");
      setShowCostos(true);
      setShowIngresos(true);
      setShowResultado(true);
      setShowFooter(true);
      setContribCount(78400);
      setGastosCount(95000);
      setTotalEgresosCount(173400);
      setArriendoCount(18);
      setAirbnbCount(145);
      setCapRateCount(50);
      setFlujoCount(290000);
      return;
    }

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const rafIds: number[] = [];

    const T = (offset: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (mounted) fn();
        }, offset),
      );
    };

    const animateValue = (
      setter: (n: number) => void,
      from: number,
      to: number,
      duration: number,
      round = true,
    ) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (!mounted) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = from + (to - from) * eased;
        setter(round ? Math.round(val) : val);
        if (t < 1) rafIds.push(requestAnimationFrame(tick));
      };
      rafIds.push(requestAnimationFrame(tick));
    };

    // t=0-1500: barra progreso
    animateValue(setProgress, 0, 100, 1500, false);

    // t=1500: cambio de fase
    T(1500, () => setPhase("completado"));

    // t=1700: Bloque 1 · Costos reales
    T(1700, () => {
      setShowCostos(true);
      animateValue(setContribCount, 0, 78400, 800);
      animateValue(setGastosCount, 0, 95000, 800);
      animateValue(setTotalEgresosCount, 0, 173400, 1000);
    });

    // t=2700: Bloque 2 · Ingresos proyectados
    T(2700, () => {
      setShowIngresos(true);
      animateValue(setArriendoCount, 0, 18, 800);
      animateValue(setAirbnbCount, 0, 145, 800);
    });

    // t=3500: Bloque 3 · Resultado
    T(3500, () => {
      setShowResultado(true);
      animateValue(setCapRateCount, 0, 50, 800);
      animateValue(setFlujoCount, 0, 290000, 1000);
    });

    // t=4400: Footer
    T(4400, () => setShowFooter(true));

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [isInView, reduce]);

  const isProcesando = phase === "procesando";
  const capRateStr = (capRateCount / 10).toFixed(1).replace(".", ",");
  const flujoStr = Math.round(flujoCount / 1000);

  return (
    <div
      ref={containerRef}
      className="franco-mockup"
      style={{
        padding: 20,
        aspectRatio: "4 / 3",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header · label izq + estado procesando/completado der */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 8 }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.12em" }}
        >
          Análisis en curso
        </p>
        <div style={{ position: "relative", height: 14, minWidth: 90 }}>
          {/* "procesando" pulsing · always-mounted, opacity animate condicional */}
          <motion.span
            initial={false}
            animate={
              isProcesando
                ? { opacity: [1, 0.5, 1] }
                : { opacity: 0 }
            }
            transition={
              isProcesando
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3, ease: S01_EASE }
            }
            className="font-mono font-semibold uppercase"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "#C8323C",
            }}
            aria-hidden={!isProcesando}
          >
            • procesando
          </motion.span>
          {/* "completado" · always-mounted, fade-in cuando phase cambia */}
          <motion.span
            initial={false}
            animate={!isProcesando ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.3, ease: S01_EASE }}
            className="font-mono font-semibold uppercase text-[var(--landing-text-muted)]"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              fontSize: 9,
              letterSpacing: "0.14em",
            }}
            aria-hidden={isProcesando}
          >
            ✓ completado
          </motion.span>
        </div>
      </div>

      {/* Barra progreso · fade-out cuando completado */}
      <motion.div
        initial={false}
        animate={{ opacity: isProcesando ? 1 : 0 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        style={{
          width: "100%",
          height: 3,
          background: "var(--landing-divider)",
          borderRadius: 1,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#C8323C",
            borderRadius: 1,
          }}
        />
      </motion.div>

      {/* Bloque 1 · Costos reales */}
      <motion.div
        initial={false}
        animate={showCostos ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        aria-hidden={!showCostos}
        style={{ marginBottom: 10 }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "#C8323C",
            marginBottom: 3,
          }}
        >
          Costos reales
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Contribuciones SII:{" "}
          <span className="font-mono font-medium">
            ${contribCount.toLocaleString("es-CL")}
          </span>{" "}
          / mes
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Gastos comunes est.:{" "}
          <span className="font-mono font-medium">
            ${gastosCount.toLocaleString("es-CL")}
          </span>{" "}
          / mes
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}
        >
          Total egresos:{" "}
          <span className="font-mono font-semibold">
            ${totalEgresosCount.toLocaleString("es-CL")}
          </span>{" "}
          / mes
        </p>
      </motion.div>

      {/* Bloque 2 · Ingresos proyectados */}
      <motion.div
        initial={false}
        animate={showIngresos ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        aria-hidden={!showIngresos}
        style={{ marginBottom: 10 }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "#C8323C",
            marginBottom: 3,
          }}
        >
          Ingresos proyectados
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Arriendo largo sugerido:{" "}
          <span className="font-mono font-medium">UF {arriendoCount}</span>{" "}
          / mes
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Airbnb sugerido:{" "}
          <span className="font-mono font-medium">${airbnbCount}K</span>{" "}
          / día · 65% ocupación
        </p>
      </motion.div>

      {/* Bloque 3 · Resultado */}
      <motion.div
        initial={false}
        animate={showResultado ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        aria-hidden={!showResultado}
        style={{ marginBottom: 10 }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "#C8323C",
            marginBottom: 3,
          }}
        >
          Resultado
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Cap rate:{" "}
          <span
            className="font-mono font-medium"
            style={{ color: "#10B981" }}
          >
            {capRateStr}%
          </span>
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Flujo mensual:{" "}
          <span
            className="font-mono font-medium"
            style={{ color: "#C8323C" }}
          >
            −${flujoStr}K
          </span>
        </p>
        <p
          className="font-mono uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.08em", marginTop: 2 }}
        >
          Sobre mediana zona · negativo
        </p>
      </motion.div>

      {/* Footer · fuente */}
      <motion.p
        initial={false}
        animate={showFooter ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 9,
          letterSpacing: "0.08em",
          marginTop: "auto",
        }}
      >
        Fuente · 34.000+ propiedades · Airbnb en tiempo real
      </motion.p>
    </div>
  );
}

/* ============================ Mockup · 03 Veredicto ============================ */

function MockupStep03() {
  return (
    <div
      className="franco-mockup"
      style={{ padding: 28, aspectRatio: "4 / 3" }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 16 }}
      >
        Resultado · Franco score
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <p
          className="font-heading font-bold text-[var(--landing-text)]"
          style={{
            fontSize: 56,
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
          }}
        >
          61
        </p>
        <p
          className="font-mono text-[var(--landing-text-muted)]"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          / 100
        </p>
        <div
          style={{
            marginLeft: "auto",
            background: "#C8323C",
            color: "#FAFAF8",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          Ajustar
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 4,
          background: "var(--landing-divider)",
          borderRadius: 2,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "61%",
            background: "#C8323C",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "61%",
            top: "50%",
            width: 12,
            height: 12,
            background: "#C8323C",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      <div
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderLeft: "2px solid #C8323C",
          borderRadius: 4,
          padding: 12,
        }}
      >
        <p
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            marginBottom: 6,
          }}
        >
          Siendo franco
        </p>
        <p
          className="font-heading italic font-semibold text-[var(--landing-text)]"
          style={{ fontSize: 13, lineHeight: 1.4 }}
        >
          “Buena ubicación, precio incómodo. Negocia hasta UF 4.900.”
        </p>
      </div>
    </div>
  );
}
