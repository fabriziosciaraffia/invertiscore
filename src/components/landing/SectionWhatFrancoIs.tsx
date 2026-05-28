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
 * Mobile (lg-): grid colapsa a 1 col. Card 01 entra centrada y al aparecer
 * Card 02 se desplaza (x + scale dim, patrón Hero mobile).
 * Animación bullets: RevealOnScroll stagger 100ms (once:true).
 * Animación cards: loop continuo 26s (back → 3 segmentos sentence-by-
 * sentence → front entra dim back → header → 3 hallazgos staggered → cita).
 * Pausa-on-hold: hold ≥200ms pausa el avance del ciclo (pausedRef · sin
 * state · sin acople a deps del useEffect · doctrina post-2.18d).
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

/* Hook · detecta layout mobile (single-col, debajo del breakpoint lg de
 * Tailwind: 1024px). Inicial false en SSR · se actualiza al mount via
 * matchMedia + listener (sin hydration mismatch). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
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

/* ============================ Typewriter del Insight de zona (Phase 2.21) ============================
 *
 * Reemplaza el fade-stagger de 3 segmentos por typewriter word-by-word.
 * Doctrina post-2.18d:
 *   · TODAS las palabras de los 3 segmentos siempre montadas como <span>.
 *     Visibilidad por opacity controlada con índice (NO conditional render).
 *   · Keys estáticas (segId + i). NO key dinámica.
 *   · setInterval único · 80ms tick · pausedRef consultado antes de incrementar.
 *     Si paused → return temprano (palabra actual queda visible, no avanza).
 *     NO destruir interval por pausa.
 *   · Pausa 600ms (= 8 ticks) entre segmentos · countdown en ticks dentro del
 *     mismo interval, también pause-aware.
 *   · Cleanup completo en useEffect return.
 *   · reduce-motion → todas las palabras visibles desde el inicio, sin interval.
 *
 * Tokens: cada token = una palabra. Cuando un dato lleva mono/numérico
 * (e.g. "245m,", "$950.000", "percentil 58"), datum:true → render con <Datum>.
 * Puntuación adyacente al dato se atornilla al token del dato (atómico). */

type SegToken = { text: string; datum?: boolean };

const SEG1_TOKENS: ReadonlyArray<SegToken> = [
  { text: "Triple" },
  { text: "conectividad" },
  { text: "de" },
  { text: "metro" },
  { text: "(Manuel" },
  { text: "Montt" },
  { text: "245m,", datum: true },
  { text: "Pedro" },
  { text: "de" },
  { text: "Valdivia" },
  { text: "396m,", datum: true },
  { text: "Salvador" },
  { text: "1km)", datum: true },
  { text: "genera" },
  { text: "demanda" },
  { text: "sostenida." },
];

const SEG2_TOKENS: ReadonlyArray<SegToken> = [
  { text: "INACAP" },
  { text: "y" },
  { text: "DuocUC" },
  { text: "en" },
  { text: "un" },
  { text: "radio" },
  { text: "de" },
  { text: "800m", datum: true },
  { text: "atraen" },
  { text: "estudiantes" },
  { text: "y" },
  { text: "jóvenes" },
  { text: "profesionales;" },
  { text: "Parque" },
  { text: "Inés" },
  { text: "de" },
  { text: "Suárez" },
  { text: "a" },
  { text: "pasos" },
  { text: "suma" },
  { text: "calidad" },
  { text: "de" },
  { text: "vida." },
];

const SEG3_TOKENS: ReadonlyArray<SegToken> = [
  { text: "El" },
  { text: "arriendo" },
  { text: "estimado" },
  { text: "de" },
  { text: "$950.000", datum: true },
  { text: "se" },
  { text: "posiciona" },
  { text: "en" },
  { text: "el" },
  { text: "percentil 58", datum: true },
  { text: "del" },
  { text: "rango" },
  { text: "local" },
  { text: "($640K–$1.347M):", datum: true },
  { text: "compite" },
  { text: "sin" },
  { text: "castigar" },
  { text: "precio" },
  { text: "y" },
  { text: "mantiene" },
  { text: "vacancia" },
  { text: "baja." },
];

const SEG_TOKEN_GROUPS = [SEG1_TOKENS, SEG2_TOKENS, SEG3_TOKENS] as const;

/* ===== Tokens de Card 02 (Phase 2.22) ============================
 * Cada hallazgo body + la cita también se escriben word-by-word con el mismo
 * patrón always-mounted/opacity-por-índice. El título de cada hallazgo y el
 * "★ Lo que Franco interpretó" siguen siendo fade (no son cuerpo narrativo).
 */
const H1_TOKENS: ReadonlyArray<SegToken> = [
  { text: "Con" },
  { text: "pie" },
  { text: "de" },
  { text: "20%", datum: true },
  { text: "a" },
  { text: "20 años", datum: true },
  { text: "el" },
  { text: "dividendo" },
  { text: "te" },
  { text: "deja" },
  { text: "en" },
  { text: "−$310K/mes.", datum: true },
  { text: "Sube" },
  { text: "el" },
  { text: "pie" },
  { text: "a" },
  { text: "30%", datum: true },
  { text: "y" },
  { text: "extiende" },
  { text: "a" },
  { text: "25 años", datum: true },
  { text: "al" },
  { text: "4,2%:", datum: true },
  { text: "el" },
  { text: "flujo" },
  { text: "sube" },
  { text: "a" },
  { text: "−$90K.", datum: true },
];

const H2_TOKENS: ReadonlyArray<SegToken> = [
  { text: "Pediste" },
  { text: "UF 22,", datum: true },
  { text: "pero" },
  { text: "los" },
  { text: "73 comparables", datum: true },
  { text: "de" },
  { text: "Ñuñoa" },
  { text: "transan" },
  { text: "en" },
  { text: "UF 18.", datum: true },
  { text: "Con" },
  { text: "eso" },
  { text: "bajas" },
  { text: "UF 4/mes,", datum: true },
  { text: "pero" },
  { text: "deja" },
  { text: "de" },
  { text: "ser" },
  { text: "una" },
  { text: "proyección" },
  { text: "de" },
  { text: "fantasía" },
  { text: "—" },
  { text: "ahora" },
  { text: "sí" },
  { text: "puedes" },
  { text: "confiar" },
  { text: "en" },
  { text: "el" },
  { text: "veredicto." },
];

const H3_TOKENS: ReadonlyArray<SegToken> = [
  { text: "Metro" },
  { text: "Irarrázaval" },
  { text: "a" },
  { text: "282m,", datum: true },
  { text: "Clínica" },
  { text: "UC" },
  { text: "Christus" },
  { text: "y" },
  { text: "la" },
  { text: "U." },
  { text: "de" },
  { text: "Chile" },
  { text: "a" },
  { text: "menos" },
  { text: "de" },
  { text: "2km.", datum: true },
  { text: "Demanda" },
  { text: "estable," },
  { text: "vacancia" },
  { text: "baja:" },
  { text: "si" },
  { text: "el" },
  { text: "precio" },
  { text: "cede" },
  { text: "a" },
  { text: "UF 4.900,", datum: true },
  { text: "el" },
  { text: "negocio" },
  { text: "cierra." },
];

const CITA_TOKENS: ReadonlyArray<SegToken> = [
  { text: "“Una" },
  { text: "calculadora" },
  { text: "habría" },
  { text: "corrido" },
  { text: "tus" },
  { text: "números." },
  { text: "Yo" },
  { text: "te" },
  { text: "digo" },
  { text: "cuáles" },
  { text: "arreglar" },
  { text: "primero.”" },
];

const CARD02_TOKEN_GROUPS = [H1_TOKENS, H2_TOKENS, H3_TOKENS, CITA_TOKENS] as const;

/* Timing del ciclo · auto-derivado del conteo real de palabras.
 *
 * Phase 2.23 · ticks separados para Card 01 y Card 02:
 *   · Card 01 más lento (110ms) — la narrativa del insight es densa, conviene
 *     dar tiempo para leer y absorber. El cap rate de "está pensando ahora"
 *     se siente mejor con ritmo más calmo.
 *   · Card 02 mantiene 80ms — los hallazgos son cortos y queremos cadencia ágil.
 *
 * Pausas: 600ms entre segs de Card 01 (sin cambio), 600ms entre hallazgos de
 * Card 02 (era 2000, demasiado lento), 600ms SETTLE entre Card 01 y Card 02
 * (era 0, sin respiro). Cada pausa convertida a ticks usando el tick propio
 * del card. */
const CARD01_WORD_TICK_MS = 110;
const CARD02_WORD_TICK_MS = 80;
const PAUSE_BETWEEN_SEGS_MS = 600;
const PAUSE_BETWEEN_SEGS_TICKS = Math.round(PAUSE_BETWEEN_SEGS_MS / CARD01_WORD_TICK_MS);
const SETTLE_AFTER_TYPING_MS = 600;
const HEADER_DELAY_MS = 500;
const PAUSE_BETWEEN_HALLAZGOS_MS = 600;
const PAUSE_BETWEEN_HALLAZGOS_TICKS = Math.round(PAUSE_BETWEEN_HALLAZGOS_MS / CARD02_WORD_TICK_MS);
const CYCLE_DURATION_MS = 26000;

const SEG1_START_MS = 900;
const SEG1_END_MS = SEG1_START_MS + SEG1_TOKENS.length * CARD01_WORD_TICK_MS;
const SEG2_END_MS = SEG1_END_MS + PAUSE_BETWEEN_SEGS_MS + SEG2_TOKENS.length * CARD01_WORD_TICK_MS;
const SEG3_END_MS = SEG2_END_MS + PAUSE_BETWEEN_SEGS_MS + SEG3_TOKENS.length * CARD01_WORD_TICK_MS;
const SHOW_FRONT_AT_MS = SEG3_END_MS + SETTLE_AFTER_TYPING_MS;
const SHOW_HEADER_AT_MS = SHOW_FRONT_AT_MS + HEADER_DELAY_MS;
const SHOW_H1_AT_MS = SHOW_HEADER_AT_MS + HEADER_DELAY_MS;

type VisibleWords = { seg1: number; seg2: number; seg3: number };
const ZERO_VISIBLE: VisibleWords = { seg1: 0, seg2: 0, seg3: 0 };
const ALL_VISIBLE: VisibleWords = {
  seg1: SEG1_TOKENS.length,
  seg2: SEG2_TOKENS.length,
  seg3: SEG3_TOKENS.length,
};

type VisibleCard02 = { h1: number; h2: number; h3: number; cita: number };
const ZERO_CARD02: VisibleCard02 = { h1: 0, h2: 0, h3: 0, cita: 0 };
const ALL_CARD02: VisibleCard02 = {
  h1: H1_TOKENS.length,
  h2: H2_TOKENS.length,
  h3: H3_TOKENS.length,
  cita: CITA_TOKENS.length,
};

/* Renderiza un segmento como secuencia de spans always-mounted; opacity
 * controlada por índice. Keys estáticas: `${segId}-${i}`. */
function TypeSegment({
  tokens,
  visible,
  segId,
}: {
  tokens: ReadonlyArray<SegToken>;
  visible: number;
  segId: string;
}) {
  return (
    <>
      {tokens.map((tok, i) => {
        const shown = i < visible;
        return (
          <span
            key={`${segId}-${i}`}
            style={{
              opacity: shown ? 1 : 0,
              transition: "opacity 120ms linear",
            }}
          >
            {tok.datum ? <Datum>{tok.text}</Datum> : tok.text}
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
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
  const isMobile = useIsMobile();

  // Phase 2.20 · pausa-on-hold · pausedRef es REF (no state). Doctrina
  // post-2.18d: el touch NO entra en las deps del useEffect del runCycle.
  // El T() helper interno hace poll-retry mientras pausedRef.current=true,
  // sin destruir/recrear timers existentes. Hold-threshold 200ms distingue
  // tap corto de press sostenido.
  const pausedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      pausedRef.current = true;
    }, 200);
  };

  const releaseHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pausedRef.current = false;
  };

  useEffect(() => {
    // Cleanup del threshold timer si el componente se desmonta mid-hold.
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const [showBack, setShowBack] = useState(false);
  const [dimBack, setDimBack] = useState(false);
  // Phase 2.21 · visibleWords reemplaza showSeg1/2/3. Cada slot guarda cuántas
  // palabras del segmento están visibles (opacity 1). Los spans están todos
  // montados; el índice controla qué se ve. Ver TypeSegment + runTypewriter.
  const [visibleWords, setVisibleWords] = useState<VisibleWords>(ZERO_VISIBLE);
  // Phase 2.22 · mismo patrón para los 3 hallazgos + cita de Card 02.
  // Los show{H1,H2,H3,Cita} siguen controlando el fade del contenedor (título
  // del hallazgo, o motion.p de la cita); el word-count controla la aparición
  // de las palabras del body. El startCard02Typewriter levanta los show
  // cuando le toca a cada bloque, sincronizado con el ritmo del typing.
  const [visibleCard02, setVisibleCard02] = useState<VisibleCard02>(ZERO_CARD02);
  const [showFront, setShowFront] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [showH1, setShowH1] = useState(false);
  const [showH2, setShowH2] = useState(false);
  const [showH3, setShowH3] = useState(false);
  const [showCita, setShowCita] = useState(false);

  // Refs del estado del typewriter (live entre ticks del setInterval, sin
  // re-renders adicionales). segIdxRef: 0/1/2 segmento activo, 3 = done.
  // pauseTicksRef: ticks restantes de la pausa inter-segmento.
  const segIdxRef = useRef(0);
  const pauseTicksRef = useRef(0);
  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs análogos para el typewriter de Card 02 · 0..3 = H1/H2/H3/cita, 4 = done.
  const card02IdxRef = useRef(0);
  const card02PauseTicksRef = useRef(0);
  const card02IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isInView) return;

    if (reduce) {
      setShowBack(true);
      setDimBack(true);
      setVisibleWords(ALL_VISIBLE);
      setVisibleCard02(ALL_CARD02);
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

    // T() con poll-retry pattern · cuando el timer dispara, si pausedRef
    // está activo re-agenda la misma tick fn en +100ms (no ejecuta el fn
    // ni recrea nada). Cleanup en return cancela cualquier tick pendiente.
    const T = (offset: number, fn: () => void) => {
      const id = setTimeout(function tick() {
        if (!mounted) return;
        if (pausedRef.current) {
          const rid = setTimeout(tick, 100);
          timers.push(rid);
          return;
        }
        fn();
      }, offset);
      timers.push(id);
    };

    // Typewriter Card 01 · setInterval cada CARD01_WORD_TICK_MS, pause-aware
    // (consulta pausedRef antes de incrementar). Cuando termina seg N, inicia
    // countdown de pausa (también pause-aware). Cuando los 3 segmentos
    // terminan, clearInterval.
    const startTypewriter = () => {
      // Limpieza defensiva por si quedó un interval del ciclo previo
      // (no debería con timing actual; defensive cleanup).
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      segIdxRef.current = 0;
      pauseTicksRef.current = 0;

      typewriterIntervalRef.current = setInterval(() => {
        if (!mounted) return;
        // Hold sostenido · no avanza el typewriter ni la pausa. Interval vive.
        if (pausedRef.current) return;

        // Todos los segmentos terminaron · clearInterval y done.
        if (segIdxRef.current >= SEG_TOKEN_GROUPS.length) {
          if (typewriterIntervalRef.current) {
            clearInterval(typewriterIntervalRef.current);
            typewriterIntervalRef.current = null;
          }
          return;
        }

        // Estamos en pausa inter-segmento · decrementa ticks y skip incremento.
        if (pauseTicksRef.current > 0) {
          pauseTicksRef.current -= 1;
          return;
        }

        const idx = segIdxRef.current;
        const total = SEG_TOKEN_GROUPS[idx].length;
        const segKey = (["seg1", "seg2", "seg3"] as const)[idx];

        setVisibleWords((prev) => {
          const next = prev[segKey] + 1;
          if (next >= total) {
            // Justo completamos este segmento · arma la pausa para el próximo.
            segIdxRef.current = idx + 1;
            pauseTicksRef.current = PAUSE_BETWEEN_SEGS_TICKS;
          }
          return { ...prev, [segKey]: next };
        });
      }, CARD01_WORD_TICK_MS);
    };

    // Typewriter Card 02 · misma anatomía que startTypewriter pero con tick
    // propio (CARD02_WORD_TICK_MS) y 4 sub-segmentos (H1/H2/H3 bodies + cita)
    // con pausa breve (PAUSE_BETWEEN_HALLAZGOS_MS) entre cada uno. Cuando
    // cada sub-segmento termina, levanta el `show` del siguiente bloque (el
    // título de H2/H3 o el contenedor de la cita), sincronizado con el final
    // de la pausa — fuera del state-updater para no caer en doble ejecución
    // de side-effects en StrictMode.
    const startCard02Typewriter = () => {
      if (card02IntervalRef.current) {
        clearInterval(card02IntervalRef.current);
        card02IntervalRef.current = null;
      }
      card02IdxRef.current = 0;
      card02PauseTicksRef.current = 0;

      card02IntervalRef.current = setInterval(() => {
        if (!mounted) return;
        if (pausedRef.current) return;

        if (card02IdxRef.current >= CARD02_TOKEN_GROUPS.length) {
          if (card02IntervalRef.current) {
            clearInterval(card02IntervalRef.current);
            card02IntervalRef.current = null;
          }
          return;
        }

        if (card02PauseTicksRef.current > 0) {
          card02PauseTicksRef.current -= 1;
          // Al terminar la pausa, el siguiente bloque inicia · levanta el
          // show del título/cita antes de que empiece a tipearse.
          if (card02PauseTicksRef.current === 0) {
            const nextIdx = card02IdxRef.current;
            if (nextIdx === 1) setShowH2(true);
            else if (nextIdx === 2) setShowH3(true);
            else if (nextIdx === 3) setShowCita(true);
          }
          return;
        }

        const idx = card02IdxRef.current;
        const total = CARD02_TOKEN_GROUPS[idx].length;
        const key = (["h1", "h2", "h3", "cita"] as const)[idx];

        setVisibleCard02((prev) => {
          const next = prev[key] + 1;
          if (next >= total) {
            // Body N done · advance + arma pausa (la pausa termina mostrando
            // el título del siguiente bloque, ver branch de arriba).
            card02IdxRef.current = idx + 1;
            card02PauseTicksRef.current = PAUSE_BETWEEN_HALLAZGOS_TICKS;
          }
          return { ...prev, [key]: next };
        });
      }, CARD02_WORD_TICK_MS);
    };

    // Loop continuo · ciclo 26s. Card 01 con typewriter word-by-word; al
    // terminar (SETTLE=0) Card 02 entra inmediatamente, dimmeando Card 01,
    // y un segundo typewriter arma los 3 hallazgos + la cita.
    const runCycle = () => {
      // Reset estados al inicio del ciclo · incluye cualquier interval residual.
      setShowBack(false);
      setDimBack(false);
      setVisibleWords(ZERO_VISIBLE);
      setVisibleCard02(ZERO_CARD02);
      setShowFront(false);
      setShowHeader(false);
      setShowH1(false);
      setShowH2(false);
      setShowH3(false);
      setShowCita(false);
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      if (card02IntervalRef.current) {
        clearInterval(card02IntervalRef.current);
        card02IntervalRef.current = null;
      }
      segIdxRef.current = 0;
      pauseTicksRef.current = 0;
      card02IdxRef.current = 0;
      card02PauseTicksRef.current = 0;

      // Card 01 aparece, luego arranca el typewriter de los 3 segmentos.
      T(200, () => setShowBack(true));
      T(SEG1_START_MS, startTypewriter);

      // Card 02 entra superpuesta · Card 01 transita a dim (en mobile también
      // se desplaza con x/scale, manejado en animate values). SETTLE=0:
      // transición inmediata al terminar el typewriter de Card 01.
      T(SHOW_FRONT_AT_MS, () => {
        setDimBack(true);
        setShowFront(true);
      });
      T(SHOW_HEADER_AT_MS, () => setShowHeader(true));
      // H1 title aparece + arranca el typewriter de Card 02. Los títulos de
      // H2/H3 y el contenedor de la cita los levanta el propio interval al
      // pasar de un bloque al siguiente.
      T(SHOW_H1_AT_MS, () => {
        setShowH1(true);
        startCard02Typewriter();
      });
      // Loop reset al final del ciclo.
      T(CYCLE_DURATION_MS, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      if (card02IntervalRef.current) {
        clearInterval(card02IntervalRef.current);
        card02IntervalRef.current = null;
      }
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
      className="min-h-[680px] lg:min-h-[600px] s03-cards-hold"
      onPointerDown={handlePointerDown}
      onPointerUp={releaseHold}
      onPointerCancel={releaseHold}
      onPointerLeave={releaseHold}
      style={{
        position: "relative",
        width: "100%",
        cursor: "grab",
        // touch-action: pan-y permite scroll vertical normal — el hold
        // sostenido sin movimiento dispara el threshold de pausa.
        touchAction: "pan-y",
      }}
    >
      {/* CARD 01 · ATRACTORES DE ZONA (aparece sola primero, después dim).
          Mobile: entra centrada (left:8% · width 84%) y al entrar Card 02
          se desplaza x:-16 + scale 0.95 (patrón Hero mobile · always-mounted).
          Desktop (≥lg): comportamiento original (left:0, sin shift). */}
      <motion.div
        initial={false}
        animate={
          showBack
            ? {
                opacity: backOpacity,
                scale: isMobile && dimBack ? 0.95 : 1,
                x: isMobile && dimBack ? -16 : 0,
                filter: `brightness(${backBrightness})`,
              }
            : {
                opacity: 0,
                scale: 0.96,
                x: 0,
                filter: `brightness(${backBrightness})`,
              }
        }
        transition={{ duration: 0.5, ease: EASE }}
        aria-hidden={!showBack}
        style={{
          ...cardCommon,
          top: 0,
          left: isMobile ? "8%" : 0,
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
        {/* Body en 3 segmentos · typewriter word-by-word (Phase 2.21).
            TODAS las palabras siempre montadas como spans con keys estáticas;
            opacity controlada por índice (visibleWords[segN]). El interval del
            useEffect avanza la cuenta cada 80ms (pause-aware vía pausedRef). */}
        <p
          className="font-body italic text-[var(--landing-text-secondary)]"
          style={{ fontSize: 12.5, lineHeight: 1.55, margin: 0 }}
        >
          <TypeSegment tokens={SEG1_TOKENS} visible={visibleWords.seg1} segId="s1" />
          {" "}
          <TypeSegment tokens={SEG2_TOKENS} visible={visibleWords.seg2} segId="s2" />
          {" "}
          <TypeSegment tokens={SEG3_TOKENS} visible={visibleWords.seg3} segId="s3" />
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
          tokens={H1_TOKENS}
          visible={visibleCard02.h1}
          segId="h1"
        />

        <Divider />

        {/* Hallazgo 2 */}
        <Hallazgo
          show={showH2}
          title="El arriendo que pusiste no es real."
          tokens={H2_TOKENS}
          visible={visibleCard02.h2}
          segId="h2"
        />

        <Divider />

        {/* Hallazgo 3 */}
        <Hallazgo
          show={showH3}
          title="La ubicación juega a tu favor."
          tokens={H3_TOKENS}
          visible={visibleCard02.h3}
          segId="h3"
        />

        <Divider strong />

        {/* Cita Franco · Sans italic + typewriter (Phase 2.22). El contenedor
            fadea con showCita; las palabras aparecen word-by-word según
            visibleCard02.cita. */}
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
          <TypeSegment tokens={CITA_TOKENS} visible={visibleCard02.cita} segId="cita" />
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

/* Hallazgo individual · título Serif Bold (fade) + body Sans con typewriter
 * word-by-word (Phase 2.22). El body's <TypeSegment> tiene todos los spans
 * always-mounted; el `visible` count avanza por el setInterval de Card 02. */
function Hallazgo({
  show,
  title,
  tokens,
  visible,
  segId,
}: {
  show: boolean;
  title: string;
  tokens: ReadonlyArray<SegToken>;
  visible: number;
  segId: string;
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
        <TypeSegment tokens={tokens} visible={visible} segId={segId} />
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
