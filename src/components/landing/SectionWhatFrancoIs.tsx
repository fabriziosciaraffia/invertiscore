"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import SectionHeader from "./SectionHeader";
import SectionGhostNumber from "./SectionGhostNumber";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 03 · Qué es Franco (F.11 Phase 2.13 · caja Franco rediseñada).
 *
 * Layout 2 cols (desktop ≥1024px):
 *  ┌──────────────────┬──────────────────────────┐
 *  │ Header                                       │
 *  ├──────────────────┼──────────────────────────┤
 *  │ 4 bullets        │ Insight Cards (2 cards   │
 *  │ INTERPRETA       │ superpuestas: atractores │
 *  │ IDENTIFICA       │ atrás + hallazgos Franco │
 *  │ PROPONE          │ adelante)                │
 *  │ VIGILA           │                          │
 *  └──────────────────┴──────────────────────────┘
 *
 * Mobile: grid colapsa a 1 col, cards debajo de bullets.
 * Animación bullets: RevealOnScroll stagger 100ms.
 * Animación cards: single-pass useInView once (back→front→header→3 hallazgos→cita).
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

/* Hook · detecta si el tema actual es light leyendo data-franco-theme. */
function useLandingIsLight(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const root = document.querySelector("[data-franco-root]");
    if (!root) return;
    const update = () =>
      setIsLight(root.getAttribute("data-franco-theme") === "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-franco-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

type Bullet = {
  id: "01" | "02" | "03" | "04";
  verb: "INTERPRETA" | "IDENTIFICA" | "PROPONE" | "VIGILA";
  title: string;
  example: ReactNode;
};

const BULLETS: ReadonlyArray<Bullet> = [
  {
    id: "01",
    verb: "INTERPRETA",
    title: "Lee los gastos reales que tú pasarías por alto.",
    example: (
      <>
        <ArrowRed /> Contribuciones SII <Hi>$78.400</Hi> · GGCC{" "}
        <Hi>$95.000</Hi> · vacancia
      </>
    ),
  },
  {
    id: "02",
    verb: "IDENTIFICA",
    title: "Encuentra la causa, no el síntoma.",
    example: (
      <>
        <ArrowRed /> &ldquo;Tu arriendo <Hi>UF 22</Hi> no es real: la zona
        transa en <Hi>UF 18</Hi>&rdquo;
      </>
    ),
  },
  {
    id: "03",
    verb: "PROPONE",
    title: "Da la salida concreta para tu caso.",
    example: (
      <>
        <ArrowRed /> &ldquo;Sube el pie a <Hi>30%</Hi>, extiende a{" "}
        <Hi>25 años</Hi>: flujo <Hi>−$310K</Hi> → <Hi>−$90K</Hi>&rdquo;
      </>
    ),
  },
  {
    id: "04",
    verb: "VIGILA",
    title: "Anticipa lo que puede salir mal.",
    example: (
      <>
        <ArrowRed /> Tasa al alza · plusvalía zona <Hi>+34%</Hi> · vacancia
        estacional
      </>
    ),
  },
];

/* Helpers de bullet · ArrowRed (flecha Signal Red al inicio del ejemplo)
 * + Hi (highlight Mono blanco bold para datos cuantitativos inline). */
function ArrowRed() {
  return (
    <span
      aria-hidden="true"
      style={{ color: "#C8323C", fontWeight: 700, marginRight: 4 }}
    >
      →
    </span>
  );
}

function Hi({ children }: { children: ReactNode }) {
  return (
    <span className="font-normal">{children}</span>
  );
}

export default function SectionWhatFrancoIs() {
  return (
    <section
      id="que-es-franco"
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-base)" }}
    >
      <SectionGhostNumber number="03" side="right" top="clamp(110px, 14vh, 200px)" />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-[10vh] md:px-8 md:py-[10vh]">
        <SectionHeader
          eyebrow="03 · Qué es Franco"
          title={"No es una calculadora.\nEs un asesor con IA."}
          subhead="Franco interpreta tu caso, identifica el problema real y propone alternativas concretas. No te entrega solo números — te dice qué hacer con ellos."
        />

        <div className="mt-10 grid grid-cols-1 gap-10 md:mt-14 lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Columna izquierda · 4 bullets */}
          <div>
            {BULLETS.map((b, i) => (
              <RevealOnScroll key={b.id} delay={i * 0.1}>
                <BulletItem data={b} last={i === BULLETS.length - 1} />
              </RevealOnScroll>
            ))}
          </div>

          {/* Columna derecha · 2 cards superpuestas con insight + atractores */}
          <FrancoInsightCards />
        </div>
      </div>
    </section>
  );
}

/* ============================ Bullet ============================ */

function BulletItem({ data, last }: { data: Bullet; last: boolean }) {
  return (
    <div
      className="flex"
      style={{
        gap: 16,
        padding: "18px 0",
        borderBottom: last
          ? "none"
          : "0.5px solid var(--landing-card-border)",
      }}
    >
      {/* Número grande Source Serif Bold · 18% opacity del color de texto
          (theme-aware via color-mix). */}
      <span
        className="font-heading font-bold"
        style={{
          width: 42,
          flexShrink: 0,
          fontSize: 30,
          lineHeight: 1,
          color:
            "color-mix(in srgb, var(--landing-text) 18%, transparent)",
        }}
        aria-hidden="true"
      >
        {data.id}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Verbo · Mono Bold Signal Red uppercase */}
        <p
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "#C8323C",
            marginBottom: 5,
            margin: "0 0 5px 0",
          }}
        >
          {data.verb}
        </p>

        {/* Título · Sans Semibold 600 (override usuario sobre el cap default
            del skill — pediste explícitamente fontWeight 600 para énfasis del
            título de bullet). */}
        <p
          className="font-body text-[var(--landing-text)]"
          style={{
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.35,
            margin: "0 0 6px 0",
          }}
        >
          {data.title}
        </p>

        {/* Ejemplo · Mono 11px muted · → Signal Red al inicio + datums Hi
            blanco bold inline. */}
        <p
          className="font-mono text-[var(--landing-text-muted)]"
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {data.example}
        </p>
      </div>
    </div>
  );
}

/* ============================ Insight Cards (2 superpuestas) ============================ */

function FrancoInsightCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  // once:false → useInView toggle on/off cuando entra/sale del viewport.
  // El loop solo corre cuando está visible.
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();
  const isLight = useLandingIsLight();

  const [showBack, setShowBack] = useState(false);
  const [dimBack, setDimBack] = useState(false);
  // 3 segmentos del insight de zona (fade stagger simulando typewriter
  // sentence-by-sentence · más lento que un fade único, da tiempo a leer).
  const [showSeg1, setShowSeg1] = useState(false);
  const [showSeg2, setShowSeg2] = useState(false);
  const [showSeg3, setShowSeg3] = useState(false);
  const [showFront, setShowFront] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [showH1, setShowH1] = useState(false);
  const [showH2, setShowH2] = useState(false);
  const [showH3, setShowH3] = useState(false);
  const [showCita, setShowCita] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    if (reduce) {
      setShowBack(true);
      setDimBack(true);
      setShowSeg1(true);
      setShowSeg2(true);
      setShowSeg3(true);
      setShowFront(true);
      setShowHeader(true);
      setShowH1(true);
      setShowH2(true);
      setShowH3(true);
      setShowCita(true);
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

    // Loop continuo: cada ciclo ~22s. Card 01 sola con texto sentence-by-
    // sentence, después Card 02 entra y construye los 3 hallazgos.
    const runCycle = () => {
      // Reset todos los estados al inicio del ciclo.
      setShowBack(false);
      setDimBack(false);
      setShowSeg1(false);
      setShowSeg2(false);
      setShowSeg3(false);
      setShowFront(false);
      setShowHeader(false);
      setShowH1(false);
      setShowH2(false);
      setShowH3(false);
      setShowCita(false);

      // Card 01 aparece y el texto se construye en cascada continua y rápida
      // (segmentos solapados con stagger 700ms · feel typewriter continuo).
      T(200, () => setShowBack(true));
      T(500, () => setShowSeg1(true));
      T(1200, () => setShowSeg2(true));
      T(1900, () => setShowSeg3(true));
      // Card 02 entra superpuesta · Card 01 transita a dim.
      T(5000, () => {
        setDimBack(true);
        setShowFront(true);
      });
      T(5500, () => setShowHeader(true));
      T(5900, () => setShowH1(true));
      T(7500, () => setShowH2(true));
      T(9100, () => setShowH3(true));
      T(10800, () => setShowCita(true));
      // Loop reset al final del ciclo (14s).
      T(14000, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [isInView, reduce]);

  const dimOpacity = isLight ? 0.72 : 0.5;
  const dimBrightness = isLight ? 1.0 : 0.7;
  const backOpacity = !showBack ? 0 : dimBack ? dimOpacity : 1.0;
  const backBrightness = !dimBack ? 1.0 : dimBrightness;

  // Card visual common · ambas cards misma forma (radius full + border Ink).
  const cardCommon: React.CSSProperties = {
    position: "absolute",
    width: "84%",
    background: "var(--landing-mockup-solid-bg)",
    border: "0.5px solid var(--landing-card-border)",
    borderRadius: 14,
    padding: 20,
  };

  return (
    <div
      ref={containerRef}
      className="min-h-[680px] lg:min-h-[600px]"
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* CARD 01 · ATRACTORES DE ZONA (aparece sola primero, después dim) */}
      <motion.div
        initial={false}
        animate={
          showBack
            ? { opacity: backOpacity, scale: 1, filter: `brightness(${backBrightness})` }
            : { opacity: 0, scale: 0.96, filter: `brightness(${backBrightness})` }
        }
        transition={{ duration: 0.5, ease: EASE }}
        aria-hidden={!showBack}
        style={{
          ...cardCommon,
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        {/* Header · wordmark + label */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 12 }}
        >
          <MockupWordmark />
          <span
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
          >
            Atractores de zona
          </span>
        </div>

        {/* Mapa · theme-aware */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 180,
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              isLight
                ? "/landing/map-atractores-light.png"
                : "/landing/map-atractores.png"
            }
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            aria-hidden="true"
          />
        </div>

        {/* AI insight · narrativa Sans italic (estilo drawer 06 Zona) */}
        <p
          className="font-mono uppercase text-[var(--landing-text-muted)]"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            marginBottom: 6,
          }}
        >
          ★ Insight de zona
        </p>
        {/* Body en 3 segmentos · fade stagger (efecto typewriter sentence-by-
            sentence). Each segment is a motion.span always-mounted with
            animate condicional opacity (Phase 2.6e/f safe). */}
        <p
          className="font-body italic text-[var(--landing-text-secondary)]"
          style={{ fontSize: 12.5, lineHeight: 1.55, margin: 0 }}
        >
          <motion.span
            initial={false}
            animate={showSeg1 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            aria-hidden={!showSeg1}
          >
            Triple conectividad de metro (Manuel Montt{" "}
            <Datum>245m</Datum>, Pedro de Valdivia <Datum>396m</Datum>,
            Salvador <Datum>1km</Datum>) genera demanda sostenida.
          </motion.span>{" "}
          <motion.span
            initial={false}
            animate={showSeg2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            aria-hidden={!showSeg2}
          >
            INACAP y DuocUC en un radio de <Datum>800m</Datum> atraen
            estudiantes y jóvenes profesionales; Parque Inés de Suárez a
            pasos suma calidad de vida.
          </motion.span>{" "}
          <motion.span
            initial={false}
            animate={showSeg3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            aria-hidden={!showSeg3}
          >
            El arriendo estimado de <Datum>$950.000</Datum> se posiciona en
            el <Datum>percentil 58</Datum> del rango local (
            <Datum>$640K–$1.347M</Datum>): compite sin castigar precio y
            mantiene vacancia baja.
          </motion.span>
        </p>
      </motion.div>

      {/* CARD 02 · LO QUE FRANCO INTERPRETÓ (entra después, superpuesta) */}
      <motion.div
        initial={false}
        animate={showFront ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
        transition={{ duration: 0.5, ease: EASE }}
        aria-hidden={!showFront}
        style={{
          ...cardCommon,
          top: 120,
          right: 0,
          left: "auto",
          boxShadow: "-16px 0 36px -18px rgba(0,0,0,0.7)",
          zIndex: 2,
        }}
      >
        {/* Header · wordmark + label */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 16 }}
        >
          <MockupWordmark />
          <motion.span
            initial={false}
            animate={showHeader ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-hidden={!showHeader}
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "#C8323C",
            }}
          >
            ★ Lo que Franco interpretó
          </motion.span>
        </div>

        {/* Hallazgo 1 */}
        <Hallazgo
          show={showH1}
          title="Tu financiamiento está forzado."
          body={
            <>
              Con pie de{" "}
              <Datum>20%</Datum> a <Datum>20 años</Datum> el dividendo te deja en{" "}
              <Datum>−$310K/mes</Datum>. Sube el pie a <Datum>30%</Datum> y
              extiende a <Datum>25 años</Datum> al <Datum>4,2%</Datum>: el flujo
              sube a <Datum>−$90K</Datum>.
            </>
          }
        />

        <Divider />

        {/* Hallazgo 2 */}
        <Hallazgo
          show={showH2}
          title="El arriendo que pusiste no es real."
          body={
            <>
              Pediste <Datum>UF 22</Datum>, pero los <Datum>73 comparables</Datum>{" "}
              de Ñuñoa transan en <Datum>UF 18</Datum>. Con eso bajas{" "}
              <Datum>UF 4/mes</Datum>, pero deja de ser una proyección de
              fantasía — ahora sí puedes confiar en el veredicto.
            </>
          }
        />

        <Divider />

        {/* Hallazgo 3 */}
        <Hallazgo
          show={showH3}
          title="La ubicación juega a tu favor."
          body={
            <>
              Metro Irarrázaval a <Datum>282m</Datum>, Clínica UC Christus y la
              U. de Chile a menos de <Datum>2km</Datum>. Demanda estable,
              vacancia baja: si el precio cede a <Datum>UF 4.900</Datum>, el
              negocio cierra.
            </>
          }
        />

        <Divider strong />

        {/* Cita Franco · Sans italic */}
        <motion.p
          initial={false}
          animate={showCita ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.4, ease: EASE }}
          aria-hidden={!showCita}
          className="font-body italic text-[var(--landing-text)]"
          style={{
            fontSize: 14,
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          &ldquo;Una calculadora habría corrido tus números. Yo te digo cuáles
          arreglar primero.&rdquo;
        </motion.p>
      </motion.div>
    </div>
  );
}

/* Wordmark refranco.ai reutilizable (header de ambas cards). */
function MockupWordmark() {
  return (
    <span className="inline-flex items-baseline" aria-label="refranco.ai">
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
  );
}

/* Hallazgo individual · título Serif Bold + body Sans con datos Mono inline. */
function Hallazgo({
  show,
  title,
  body,
}: {
  show: boolean;
  title: string;
  body: ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: EASE }}
      aria-hidden={!show}
    >
      <p
        className="font-heading font-bold text-[var(--landing-text)]"
        style={{
          fontSize: 15,
          lineHeight: 1.3,
          margin: 0,
          marginBottom: 6,
        }}
      >
        {title}
      </p>
      <p
        className="font-body text-[var(--landing-text-secondary)]"
        style={{
          fontSize: 12.5,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {body}
      </p>
    </motion.div>
  );
}

/* Datum · valor cuantitativo inline Mono peso normal · color heredado
 * del párrafo (sin destacado cromático — el cambio de familia ya
 * diferencia el dato). */
function Datum({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono font-normal"
      style={{ letterSpacing: "-0.01em" }}
    >
      {children}
    </span>
  );
}

/* Divider entre hallazgos · 0.5px Ink translúcido. `strong` aumenta margin. */
function Divider({ strong = false }: { strong?: boolean }) {
  return (
    <div
      style={{
        height: 1,
        background: "var(--landing-card-border)",
        margin: strong ? "18px 0" : "14px 0",
      }}
    />
  );
}
