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
      "Dirección, precio, superficie, modalidad. 30 segundos. Franco autocompleta el resto con datos del SII, TocToc y tu zona.",
    mockup: <MockupStep01 />,
  },
  {
    numeral: "02",
    eyebrow: "Análisis en 30 segundos",
    title: "Calcula contribuciones, flujos y comparables.",
    description:
      "Conectamos con SII para contribuciones reales, TocToc para comparables de tu zona, y modelos propios para proyección de arriendos largos y Airbnb.",
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
  const [showFranco, setShowFranco] = useState(false);
  const [arriendoCount, setArriendoCount] = useState(0);
  const [airbnbCount, setAirbnbCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    // Reduce motion: estado final inmediato.
    if (reduce) {
      setDropdownVisible(true);
      setShowMap(true);
      setShowFranco(true);
      setArriendoCount(18);
      setAirbnbCount(145000);
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

    const animateCounter = (
      setter: (n: number) => void,
      from: number,
      to: number,
      duration: number,
    ) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (!mounted) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setter(Math.round(from + (to - from) * eased));
        if (t < 1) rafIds.push(requestAnimationFrame(tick));
      };
      rafIds.push(requestAnimationFrame(tick));
    };

    T(400, () => setDropdownVisible(true));
    T(800, () => setShowMap(true));
    T(1400, () => setShowFranco(true));
    T(1700, () => {
      animateCounter(setArriendoCount, 0, 18, 1200);
      animateCounter(setAirbnbCount, 0, 145000, 1200);
    });

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      rafIds.forEach(cancelAnimationFrame);
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

      {/* Franco sugiere · always-mounted, opacity animate condicional */}
      <motion.div
        initial={false}
        animate={showFranco ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: S01_EASE }}
        aria-hidden={!showFranco}
        style={{ marginTop: 12 }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#C8323C",
            marginBottom: 4,
          }}
        >
          Franco sugiere
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Arriendo largo:{" "}
          <span className="font-mono font-medium">UF {arriendoCount}</span>{" "}
          / mes
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12, lineHeight: 1.45 }}
        >
          Airbnb:{" "}
          <span className="font-mono font-medium">
            ${airbnbCount.toLocaleString("es-CL")}
          </span>{" "}
          / día promedio
        </p>
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



/* ============================ Mockup · 02 Análisis ============================ */

function MockupStep02() {
  return (
    <div
      className="franco-mockup"
      style={{ padding: 28, aspectRatio: "4 / 3" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.12em" }}
        >
          Análisis en curso · Paso 2
        </p>
        <span
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          • procesando
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <MockKPI label="Fórmula SII" value="$78.400 / mes" hint="Contribuciones" />
        <MockKPI label="Cap rate" value="5,0%" hint="Mediano" />
        <MockKPI
          label="Flujo mensual"
          value="−$290K"
          hint="Negativo"
          red
        />
        <MockKPI label="Arriendo esperado" value="UF 19" hint="LTR / mes" />
      </div>
    </div>
  );
}

function MockKPI({
  label,
  value,
  hint,
  red,
}: {
  label: string;
  value: string;
  hint: string;
  red?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 6 }}
      >
        {label}
      </p>
      <p
        className="font-heading font-bold"
        style={{
          fontSize: 18,
          lineHeight: 1,
          color: red ? "#C8323C" : "var(--landing-text)",
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      <p
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.08em" }}
      >
        {hint}
      </p>
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
