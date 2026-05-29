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
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <div className="relative mx-auto w-full max-w-6xl px-5 py-[12vh] md:px-8 md:py-[16vh]">
        <SectionHeader
          eyebrow="Cómo funciona"
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
// Card 01 · espejo exacto de la animación de la card 01 del hero
// (HeroAnimatedDesktop · FormCard): typing de la dirección, dropdown
// autocomplete que aparece mientras se escribe y se cierra al elegir,
// chips + counters Precio/Superficie y mapa fade-in. Loop continuo in-view.
const S01_DIRECCION = "Av. Manuel Montt 1234, Providencia";
const S01_TYPING_SPEED_MS = 75;

/* Hook · detecta si el tema actual es light leyendo data-franco-theme
 * en el elemento [data-franco-root]. Mismo patrón que HeroAnimatedDesktop /
 * HeroStaticMobile · re-evalúa via MutationObserver. */
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

/* Wordmark refranco.ai reutilizable (header de los 3 mockups · Phase 2.11
 * skill alignment). Mantiene la receta del wordmark global:
 *   "re"     Source Serif 4 Light italic 11px ·  color landing-wm-re
 *   "franco" Source Serif 4 Bold 11px      ·  color landing-wm-franco
 *   ".ai"    IBM Plex Sans Semibold 6px     ·  Signal Red (CLAUDE.md override)
 */
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

function MockupStep01() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Phase 2.19 · once:false → loop continuo in-view (espejo del patrón Hero).
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();
  const isLight = useLandingIsLight();

  // Sub-state · mismo conjunto que la card 01 del hero (FormCard).
  const [typedText, setTypedText] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [autocompleteHighlight, setAutocompleteHighlight] = useState(false);
  const [showChips, setShowChips] = useState(false);
  const [precioCount, setPrecioCount] = useState(0);
  const [superficieCount, setSuperficieCount] = useState(0);
  const [showMap, setShowMap] = useState(false);

  // Phase 2.18c/d · loop NO acoplado a touch · solo isInView lo gobierna.
  const shouldLoop = !reduce && isInView;

  // prefers-reduced-motion → estado final estático (sin loop).
  useEffect(() => {
    if (!reduce) return;
    setTypedText(S01_DIRECCION);
    setDropdownVisible(false);
    setAutocompleteHighlight(false);
    setShowChips(true);
    setPrecioCount(5500);
    setSuperficieCount(60);
    setShowMap(true);
  }, [reduce]);

  // Loop continuo mientras esté in-view · mismo guion que la fase form-active
  // de la card 01 del hero (HeroAnimatedDesktop · runCycle).
  useEffect(() => {
    if (!shouldLoop) return;

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let typingInterval: ReturnType<typeof setInterval> | null = null;
    const rafIds: number[] = [];

    const animateCounter = (
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

    const T = (offset: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (mounted) fn();
        }, offset),
      );
    };

    const runCycle = () => {
      // Reset al estado inicial del ciclo.
      setTypedText("");
      setDropdownVisible(false);
      setAutocompleteHighlight(false);
      setShowChips(false);
      setPrecioCount(0);
      setSuperficieCount(0);
      setShowMap(false);

      // t=600 · arranca el typing de la dirección.
      T(600, () => {
        let i = 0;
        typingInterval = setInterval(() => {
          if (!mounted) return;
          i++;
          setTypedText(S01_DIRECCION.slice(0, i));
          if (i >= S01_DIRECCION.length && typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
          }
        }, S01_TYPING_SPEED_MS);
      });

      // t=1500 dropdown aparece · t=1800 highlight · t=2250 elige y cierra.
      T(1500, () => setDropdownVisible(true));
      T(1800, () => setAutocompleteHighlight(true));
      T(2250, () => {
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        setTypedText(S01_DIRECCION);
        setDropdownVisible(false);
        setAutocompleteHighlight(false);
      });

      // t=2550 chips + counters Precio/Superficie.
      T(2550, () => {
        setShowChips(true);
        animateCounter(setPrecioCount, 0, 5500, 1050);
        animateCounter(setSuperficieCount, 0, 60, 1050);
      });

      // t=3300 mapa fade-in.
      T(3300, () => setShowMap(true));

      // Reset → próximo ciclo.
      T(6500, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (typingInterval) clearInterval(typingInterval);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [shouldLoop]);

  const cursorVisible = typedText.length < S01_DIRECCION.length;

  return (
    <div
      ref={containerRef}
      className="franco-mockup"
      style={{ padding: 20, minHeight: 610 }}
    >
      {/* Header · wordmark refranco.ai + label "Nuevo análisis" */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 14 }}
      >
        <MockupWordmark />
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
            style={{ fontSize: 12, fontWeight: 400 }}
          >
            {typedText ? (
              typedText
            ) : (
              <span style={{ color: "var(--landing-text-muted)" }}>
                Buscar dirección…
              </span>
            )}
            {/* Cursor always-mounted · animate condicional (Phase 2.6e). */}
            <motion.span
              animate={
                cursorVisible ? { opacity: [1, 1, 0, 0] } : { opacity: 0 }
              }
              transition={
                cursorVisible
                  ? {
                      duration: 0.9,
                      repeat: Infinity,
                      times: [0, 0.5, 0.5, 1],
                    }
                  : { duration: 0 }
              }
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 1,
                height: 12,
                background: "var(--landing-text)",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                pointerEvents: "none",
              }}
            />
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
            className="font-body"
            style={{
              fontSize: 11,
              padding: "4px 6px",
              borderRadius: 3,
              background: autocompleteHighlight
                ? "rgba(200,50,60,0.10)"
                : "transparent",
              color: autocompleteHighlight
                ? "var(--landing-text)"
                : "var(--landing-text-secondary)",
              transition: "background 0.18s ease",
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

      {/* Tipo · chips Usado / Nuevo · fade-in con showChips (espejo hero). */}
      <motion.div
        initial={false}
        animate={showChips ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.25, ease: S01_EASE }}
        style={{ marginBottom: 10 }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 5 }}
        >
          Tipo
        </p>
        <div className="flex" style={{ gap: 6 }}>
          <span
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 4,
              border: "0.5px solid #C8323C",
              color: "#C8323C",
              background: "transparent",
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
      </motion.div>

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
                  fontWeight: 700,
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
              className="font-mono font-medium text-[var(--landing-text)]"
              style={{ fontSize: 12 }}
            >
              UF {precioCount > 0 ? precioCount.toLocaleString("es-CL") : "—"}
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
              className="font-mono font-medium text-[var(--landing-text)]"
              style={{ fontSize: 12 }}
            >
              {superficieCount > 0 ? `${superficieCount} m²` : "—"}
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
          src={
            isLight
              ? "/landing/map-comparables-light.png"
              : "/landing/map-comparables.webp"
          }
          alt="Mapa con 145 comparables cerca"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </motion.div>


      {/* Botón Analizar · CTA primario Signal Red (uso #1) · Mono Medium 500 */}
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
          fontWeight: 500,
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
 * F.11 Phase 2.10 · "Franco preparando análisis" · 5 líneas checklist con
 * checks verdes + 1 línea calculando con dot pulsante infinito. Single-pass
 * animation con useInView once.
 *
 * Animación entrada:
 *   t=0     header · contador "1 de 5" · línea 1 fade-in + counter contrib + barra 0→20%
 *   t=600   contador "2 de 5" · línea 2 + counters comps/mediana/este + barra 20→40%
 *   t=1200  contador "3 de 5" · línea 3 fade-in + chips stagger 100ms + barra 40→60%
 *   t=1800  contador "4 de 5" · línea 4 + counter gastos + barra 60→80%
 *   t=2400  línea 5 fade-in con dot pulsante infinito (queda "4 de 5", barra 80%)
 *   t=3000  footer fade-in
 *
 * Safe vs NotFoundError (Phase 2.6e/f):
 *   · 5 líneas always-mounted con motion.div animate condicional opacity
 *   · 3 chips always-mounted, animate condicional con stagger
 *   · Dot pulsante línea 5: always-mounted con animate=[1,0.3,1] repeat Infinity
 *   · Counters via rAF con cleanup
 */

function MockupStep02() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Phase 2.19 · once:false → loop continuo in-view (espejo del patrón Hero).
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();

  const [stepIdx, setStepIdx] = useState(1);
  const [progress, setProgress] = useState(0);
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showLine3, setShowLine3] = useState(false);
  const [showLine4, setShowLine4] = useState(false);
  const [showLine5, setShowLine5] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  // chipsCount: cuántos chips de la línea 3 están visibles (0..3) · stagger
  const [chipsCount, setChipsCount] = useState(0);

  const [contribCount, setContribCount] = useState(0);
  const [compsCount, setCompsCount] = useState(0);
  const [medianaCount, setMedianaCount] = useState(0);
  const [esteCount, setEsteCount] = useState(0);
  const [gastosCount, setGastosCount] = useState(0);

  // Phase 2.18c/d · loop NO acoplado a touch · solo isInView lo gobierna.
  const shouldLoop = !reduce && isInView;

  // prefers-reduced-motion → estado final estático directo (sin loop).
  useEffect(() => {
    if (!reduce) return;
    setStepIdx(4);
    setProgress(80);
    setShowLine1(true);
    setShowLine2(true);
    setShowLine3(true);
    setShowLine4(true);
    setShowLine5(true);
    setShowFooter(true);
    setChipsCount(3);
    setContribCount(78400);
    setCompsCount(145);
    setMedianaCount(89);
    setEsteCount(92);
    setGastosCount(120000);
  }, [reduce]);

  // Loop continuo (~8s) mientras esté in-view · runCycle auto-reiniciable.
  useEffect(() => {
    if (!shouldLoop) return;

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

    const runCycle = () => {
      // Reset al estado inicial del ciclo · el checklist se limpia y
      // reconstruye (gap de 400ms antes de la línea 1).
      setStepIdx(1);
      setProgress(0);
      setShowLine1(false);
      setShowLine2(false);
      setShowLine3(false);
      setShowLine4(false);
      setShowLine5(false);
      setShowFooter(false);
      setChipsCount(0);
      setContribCount(0);
      setCompsCount(0);
      setMedianaCount(0);
      setEsteCount(0);
      setGastosCount(0);

      // Línea 1 · SII conectado
      T(400, () => {
        setShowLine1(true);
        animateValue(setContribCount, 0, 78400, 600);
        animateValue(setProgress, 0, 20, 600, false);
      });

      // Línea 2 · Comparables
      T(1000, () => {
        setStepIdx(2);
        setShowLine2(true);
        animateValue(setCompsCount, 0, 145, 600);
        animateValue(setMedianaCount, 0, 89, 600);
        animateValue(setEsteCount, 0, 92, 600);
        animateValue(setProgress, 20, 40, 600, false);
      });

      // Línea 3 · Modalidad con chips
      T(1600, () => {
        setStepIdx(3);
        setShowLine3(true);
        animateValue(setProgress, 40, 60, 600, false);
      });
      T(1700, () => setChipsCount(1));
      T(1800, () => setChipsCount(2));
      T(1900, () => setChipsCount(3));

      // Línea 4 · Gastos
      T(2200, () => {
        setStepIdx(4);
        setShowLine4(true);
        animateValue(setGastosCount, 0, 120000, 600);
        animateValue(setProgress, 60, 80, 600, false);
      });

      // Línea 5 · Calculando (dot con pulse infinito propio, no avanza stepIdx)
      T(2800, () => setShowLine5(true));

      // Footer
      T(3400, () => setShowFooter(true));

      // Reset → próximo ciclo (~8s).
      T(8000, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [shouldLoop]);

  return (
    <div
      ref={containerRef}
      className="franco-mockup"
      style={{
        padding: 20,
        minHeight: 610,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header · wordmark refranco.ai + contador "X de 5" */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <MockupWordmark />
        <span
          className="font-mono font-medium uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#C8323C",
          }}
        >
          • {stepIdx} de 5
        </span>
      </div>

      {/* Barra progreso */}
      <div
        style={{
          width: "100%",
          height: 3,
          background: "var(--landing-divider)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#C8323C",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Línea 1 · SII */}
      <S02Line show={showLine1} marginBottom={12}>
        <CheckCircle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}
          >
            Conectado con SII
          </p>
          <p
            className="font-body text-[var(--landing-text-muted)]"
            style={{ fontSize: 11, lineHeight: 1.4, marginTop: 2 }}
          >
            Contribuciones:{" "}
            <span className="font-mono text-[var(--landing-text)]">
              ${contribCount.toLocaleString("es-CL")}
            </span>{" "}
            / mes
          </p>
        </div>
      </S02Line>

      {/* Línea 2 · Comparables */}
      <S02Line show={showLine2} marginBottom={12}>
        <CheckCircle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}
          >
            <span className="font-mono">{compsCount}</span> comparables en zona
          </p>
          <p
            className="font-body text-[var(--landing-text-muted)]"
            style={{ fontSize: 11, lineHeight: 1.4, marginTop: 2 }}
          >
            Mediana:{" "}
            <span className="font-mono">UF {medianaCount}/m²</span> · este:{" "}
            <span className="font-mono">UF {esteCount}/m²</span>
          </p>
        </div>
      </S02Line>

      {/* Línea 3 · Modalidad con chips */}
      <S02Line show={showLine3} marginBottom={12}>
        <CheckCircle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}
          >
            Modalidad sugerida
          </p>
          <div
            className="flex"
            style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}
          >
            <Chip show={chipsCount >= 1}>ARRIENDO UF 18</Chip>
            <Chip show={chipsCount >= 2}>AIRBNB $145K/d</Chip>
            <Chip show={chipsCount >= 3} active>
              AMBAS
            </Chip>
          </div>
        </div>
      </S02Line>

      {/* Línea 4 · Gastos */}
      <S02Line show={showLine4} marginBottom={12}>
        <CheckCircle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}
          >
            Gastos operativos estimados
          </p>
          <p
            className="font-body text-[var(--landing-text-muted)]"
            style={{ fontSize: 11, lineHeight: 1.4, marginTop: 2 }}
          >
            Comunes + admin:{" "}
            <span className="font-mono text-[var(--landing-text)]">
              ${gastosCount.toLocaleString("es-CL")}
            </span>{" "}
            / mes
          </p>
        </div>
      </S02Line>

      {/* Línea 5 · Calculando (loading) */}
      <S02Line show={showLine5} marginBottom={14}>
        <LoadingCircle />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}
          >
            Calculando flujo y veredicto…
          </p>
        </div>
      </S02Line>

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

/* Línea genérica del checklist · always-mounted con animate condicional opacity. */
function S02Line({
  show,
  marginBottom,
  children,
}: {
  show: boolean;
  marginBottom?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
      transition={{ duration: 0.3, ease: S01_EASE }}
      aria-hidden={!show}
      className="flex items-start"
      style={{ gap: 10, marginBottom }}
    >
      {children}
    </motion.div>
  );
}

/* Check Ink · circle 14px con tick SVG (skill: verde PROHIBIDO → Ink 400).
 * Patrón 6 Loading Editorial: "Done: dot sólido Ink 400". */
function CheckCircle() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        background: "color-mix(in srgb, var(--landing-text) 16%, transparent)",
        marginTop: 1,
      }}
      aria-hidden="true"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path
          d="M1 4.5 L3.5 7 L8 1.5"
          stroke="#B4B2A9"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* Loading circle · border Signal Red + dot interior con pulse infinito.
   Always-mounted motion.div (Phase 2.6e/f). */
function LoadingCircle() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        border: "1.5px solid #C8323C",
        background: "transparent",
        marginTop: 1,
      }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          background: "#C8323C",
        }}
      />
    </div>
  );
}

/* Chip de modalidad · always-mounted, opacity controlled.
 * Activo: Ink invertido (Patrón 5 Form Step "toggle activo en Ink invertido").
 * Inactivo: surface neutra Ink, sin tinte Signal Red.
 * Pesos mono permitidos: 400/500/700. */
function Chip({
  show,
  active = false,
  children,
}: {
  show: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.span
      initial={false}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: S01_EASE }}
      aria-hidden={!show}
      className="font-mono uppercase"
      style={{
        fontSize: 10,
        letterSpacing: "0.04em",
        padding: "4px 9px",
        borderRadius: 14,
        background: active
          ? "var(--landing-text)"
          : "var(--landing-card-bg-soft)",
        border: active
          ? "1px solid var(--landing-text)"
          : "0.5px solid var(--landing-card-border)",
        color: active
          ? "var(--landing-mockup-solid-bg)"
          : "var(--landing-text-muted)",
        fontWeight: active ? 700 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </motion.span>
  );
}

/* ============================ Mockup · 03 Veredicto ============================
 *
 * Imita el Hero de la página de resultados LTR real: header · hero veredicto
 * (score + badge + barra + frase) · caja Franco · grid 2x2 mini-cards ·
 * bloque patrimonio (chart real estilo Patrón 7.B.3).
 *
 * Paleta strict design-system-franco: solo Signal Red (acento único) + escala
 * Ink + blancos. No verde, no amber.
 *
 * Animación entrada (single-pass, useInView once):
 *   t=400    Hero fade + score 0→61 + barra 0→61% (1.2s)
 *   t=1600   badge AJUSTA SUPUESTOS
 *   t=1800   línea veredicto italic
 *   t=2200   caja Franco
 *   t=2800   cards stagger 200ms con counters (02 · 03 · 04 · 05)
 *   t=3800   patrimonio fade
 *   t=4000   11 barras stagger 80ms · grow from bottom (motion attribute)
 *   t=4880   path patrimonio neto draws via strokeDashoffset (1.5s)
 *
 * Safe vs NotFoundError: todo always-mounted; counters via rAF con cleanup;
 * SVG rects/path always-mounted, height/dashoffset via motion attribute.
 */

const S03_BAR_W = 22;
const S03_BAR_GAP = 25;
const S03_CHART_LEFT = 54;
const S03_CHART_TOP = 8;
const S03_CHART_BOTTOM_Y = 98;
const S03_MAX_VALUE = 800;
const S03_INNER_H = S03_CHART_BOTTOM_Y - S03_CHART_TOP;
const S03_X_LABEL_Y = 113;
const S03_v2y = (v: number) =>
  S03_CHART_BOTTOM_Y - (v / S03_MAX_VALUE) * S03_INNER_H;
const S03_barX = (i: number) =>
  S03_CHART_LEFT + i * (S03_BAR_W + S03_BAR_GAP);

const S03_APORTE = [60, 78, 96, 115, 135, 156, 178, 200, 220, 235, 250];
const S03_VALOR = [250, 270, 290, 305, 315, 325, 340, 350, 360, 370, 380];
const S03_NETO = [80, 120, 165, 215, 270, 330, 395, 465, 540, 625, 720];
const S03_GRID_VALUES = [0, 400, 800];

function MockupStep03() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Phase 2.19 · once:false para permitir loop continuo in-view. El loop
  // visual del chart lo maneja CSS (.s04-chart--active); el JS runCycle se
  // re-ejecuta al entrar al viewport (espejo del patrón Hero).
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });
  const reduce = useReducedMotion();

  // Hero
  const [showHero, setShowHero] = useState(false);
  const [scoreCount, setScoreCount] = useState(0);
  const [barPct, setBarPct] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [showVerdictLine, setShowVerdictLine] = useState(false);
  // Caja
  const [showCaja, setShowCaja] = useState(false);
  // Mini-cards
  const [showCard02, setShowCard02] = useState(false);
  const [showCard03, setShowCard03] = useState(false);
  const [showCard04, setShowCard04] = useState(false);
  const [showCard05, setShowCard05] = useState(false);
  const [costoCount, setCostoCount] = useState(0);
  const [negociCount, setNegociCount] = useState(0);
  const [largoCount, setLargoCount] = useState(0);
  // Patrimonio · Phase 2.19 · barIdx/linePct removidos · el SVG corre con
  // CSS @keyframes puro (s04-chart-*), sin estado JS de geometría.
  const [showPatri, setShowPatri] = useState(false);

  // Phase 2.18c/d · loop NO acoplado a touch · solo isInView lo gobierna.
  const shouldLoop = !reduce && isInView;
  // chartActive activa los @keyframes CSS del SVG (sincronizado con runCycle).
  const chartActive = shouldLoop;

  // prefers-reduced-motion → estado final estático directo (sin loop).
  useEffect(() => {
    if (!reduce) return;
    setShowHero(true);
    setScoreCount(61);
    setBarPct(61);
    setShowBadge(true);
    setShowVerdictLine(true);
    setShowCaja(true);
    setShowCard02(true);
    setShowCard03(true);
    setShowCard04(true);
    setShowCard05(true);
    setCostoCount(310);
    setNegociCount(4900);
    setLargoCount(1450);
    setShowPatri(true);
  }, [reduce]);

  // Loop continuo (~12s) mientras esté in-view · runCycle auto-reiniciable.
  useEffect(() => {
    if (!shouldLoop) return;

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

    const runCycle = () => {
      // Reset al estado inicial del ciclo. El SVG (CSS) hace wrap a 0
      // simultáneamente — enmascarado por el fade-out de showPatri.
      setShowHero(false);
      setScoreCount(0);
      setBarPct(0);
      setShowBadge(false);
      setShowVerdictLine(false);
      setShowCaja(false);
      setShowCard02(false);
      setShowCard03(false);
      setShowCard04(false);
      setShowCard05(false);
      setCostoCount(0);
      setNegociCount(0);
      setLargoCount(0);
      setShowPatri(false);

      T(400, () => {
        setShowHero(true);
        animateValue(setScoreCount, 0, 61, 1200);
        animateValue(setBarPct, 0, 61, 1200, false);
      });
      T(1600, () => setShowBadge(true));
      T(1800, () => setShowVerdictLine(true));
      T(2200, () => setShowCaja(true));
      T(2800, () => {
        setShowCard02(true);
        animateValue(setCostoCount, 0, 310, 700);
      });
      T(3000, () => {
        setShowCard03(true);
        animateValue(setNegociCount, 0, 4900, 700);
      });
      T(3200, () => {
        setShowCard04(true);
        animateValue(setLargoCount, 0, 1450, 700);
      });
      T(3400, () => setShowCard05(true));
      T(3800, () => setShowPatri(true));
      // Barras (4000ms) · línea (4880ms) · dots: ahora CSS @keyframes,
      // sincronizados al inicio del ciclo vía clase .s04-chart--active.

      // Reset → próximo ciclo (12s · igual período que el CSS del chart).
      T(12000, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [shouldLoop]);

  const netoPoints = S03_NETO.map(
    (v, i) => `${S03_barX(i) + S03_BAR_W / 2},${S03_v2y(v)}`,
  ).join(" ");

  return (
    <div
      ref={containerRef}
      className="franco-mockup"
      style={{ padding: 18, minHeight: 610, display: "flex", flexDirection: "column" }}
    >
      {/* Header · wordmark refranco.ai + label "Completado" */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 12 }}
      >
        <MockupWordmark />
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.08em" }}
        >
          Completado
        </p>
      </div>

      {/* HERO VEREDICTO · score + barra-tracker estilo producto real */}
      <motion.div
        initial={false}
        animate={showHero ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.5, ease: S01_EASE }}
        aria-hidden={!showHero}
        style={{
          background: "var(--landing-mockup-solid-bg)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 10,
          padding: 14,
          marginBottom: 8,
        }}
      >
        {/* Eyebrow row · FRANCO SCORE + ? + badge */}
        <div
          className="flex items-center"
          style={{ gap: 6, marginBottom: 8 }}
        >
          <span
            className="font-mono uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 10, letterSpacing: "0.12em" }}
          >
            Franco score
          </span>
          <span
            aria-hidden="true"
            className="font-mono text-[var(--landing-text-muted)]"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "0.5px solid currentColor",
              fontSize: 8,
              lineHeight: 1,
            }}
          >
            ?
          </span>
          <motion.span
            initial={false}
            animate={showBadge ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: S01_EASE }}
            aria-hidden={!showBadge}
            className="font-mono uppercase"
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: "#C8323C",
              border: "0.5px solid #C8323C",
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
            }}
          >
            Ajusta supuestos
          </motion.span>
        </div>

        {/* Score row · número + barra-tracker con dot */}
        <div
          className="flex items-center"
          style={{ gap: 14 }}
        >
          <span
            className="font-mono font-bold text-[var(--landing-text)]"
            style={{
              fontSize: 30,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            {scoreCount}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Barra-tracker · gradient red→gris claro */}
            <div
              style={{
                position: "relative",
                height: 3,
                background: "linear-gradient(to right, #C8323C 0%, #B4B2A9 100%)",
                borderRadius: 1.5,
              }}
            >
              {/* Dot tracker · posición 0→61% */}
              <div
                style={{
                  position: "absolute",
                  left: `${barPct}%`,
                  top: "50%",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#C8323C",
                  border: "2px solid var(--landing-mockup-solid-bg)",
                  transform: "translate(-50%, -50%)",
                }}
                aria-hidden="true"
              />
            </div>
            {/* Labels equidistantes */}
            <div
              style={{
                position: "relative",
                height: 12,
                marginTop: 4,
              }}
            >
              <span
                className="font-mono uppercase text-[var(--landing-text-muted)]"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                Buscar
              </span>
              <span
                className="font-mono uppercase text-[var(--landing-text-muted)]"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  transform: "translateX(-50%)",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                Ajusta
              </span>
              <span
                className="font-mono uppercase text-[var(--landing-text-muted)]"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                Comprar
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Subtítulo · cita italic (sale del Hero, vive como bloque aparte) */}
      <motion.p
        initial={false}
        animate={showVerdictLine ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.35, ease: S01_EASE }}
        aria-hidden={!showVerdictLine}
        className="font-body italic text-[var(--landing-text)]"
        style={{
          fontSize: 14,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 4,
          paddingLeft: 2,
        }}
      >
        Buena propiedad. Precio incómodo.
      </motion.p>

      {/* CAJA FRANCO */}
      <motion.div
        initial={false}
        animate={showCaja ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={{ duration: 0.35, ease: S01_EASE }}
        aria-hidden={!showCaja}
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderLeft: "3px solid #C8323C",
          borderRadius: "0 6px 6px 0",
          padding: "11px 12px",
          marginBottom: 8,
        }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            color: "#C8323C",
            marginBottom: 4,
          }}
        >
          Antes de negociar
        </p>
        <p
          className="font-body italic text-[var(--landing-text)]"
          style={{ fontSize: 13, lineHeight: 1.45, margin: 0 }}
        >
          Negocia hasta{" "}
          <span
            className="font-mono font-bold text-[var(--landing-text)]"
          >
            UF 4.900
          </span>{" "}
          y el flujo cuadra. Si no cede, prueba Airbnb — te da{" "}
          <span
            className="font-mono font-bold text-[var(--landing-text)]"
          >
            +$180K/mes
          </span>{" "}
          pero requiere gestión.
        </p>
      </motion.div>

      {/* GRID 2x2 MINI-CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <S03MiniCard
          show={showCard02}
          eyebrow="02 · Costo mensual"
          value={`−$${costoCount}K`}
          valueColor="#C8323C"
          sublabel="Flujo de bolsillo"
        />
        <S03MiniCard
          show={showCard03}
          eyebrow="03 · Negociación"
          value={`UF ${negociCount.toLocaleString("es-CL")}`}
          valueColor="var(--landing-text)"
          sublabel="Precio sugerido"
        />
        <S03MiniCard
          show={showCard04}
          eyebrow="04 · Largo plazo"
          value={`+UF ${largoCount.toLocaleString("es-CL")}`}
          valueColor="var(--landing-text)"
          sublabel="Plusvalía 10 años"
        />
        <S03MiniCard
          show={showCard05}
          eyebrow="05 · Riesgos"
          value="3 medios"
          valueColor="var(--landing-text)"
          sublabel="Vacancia · tasa · m²"
        />
      </div>

      {/* PATRIMONIO BLOCK */}
      <motion.div
        initial={false}
        animate={showPatri ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.4, ease: S01_EASE }}
        aria-hidden={!showPatri}
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 8,
          padding: 11,
        }}
      >
        <div
          className="flex items-baseline justify-between"
          style={{ marginBottom: 8, gap: 12 }}
        >
          <p
            className="font-mono uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
          >
            09 · Patrimonio
          </p>
          <p
            className="font-heading font-bold text-[var(--landing-text)]"
            style={{ fontSize: 14, lineHeight: 1.2 }}
          >
            Cómo crece tu capital
          </p>
        </div>

        <svg
          viewBox="0 0 560 130"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block" }}
          className={chartActive ? "s04-chart s04-chart--active" : "s04-chart"}
          aria-hidden="true"
        >
          {/* Gridlines + Y labels */}
          {S03_GRID_VALUES.map((v) => {
            const y = S03_v2y(v);
            return (
              <g key={`grid-${v}`}>
                <line
                  x1={S03_CHART_LEFT}
                  x2={552}
                  y1={y}
                  y2={y}
                  stroke="var(--landing-card-border)"
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={S03_CHART_LEFT - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    fill: "var(--landing-text-muted)",
                  }}
                >
                  {v === 0 ? "$0" : `$${v}M`}
                </text>
              </g>
            );
          })}

          {/* Barras stack: aporte (red) abajo + valor (gris) arriba.
              Phase 2.19 · <rect> nativos con geometría final · animación
              100% CSS (scaleY 0→1 desde la base) vía clase s04-chart-bar.
              Stagger via animation-delay i*0.08s (calca el stagger JS 80ms). */}
          {S03_APORTE.map((aporte, i) => {
            const valor = S03_VALOR[i];
            const aporteY = S03_v2y(aporte);
            const aporteH = S03_CHART_BOTTOM_Y - aporteY;
            const valorY = S03_v2y(aporte + valor);
            const valorH = aporteY - valorY;
            const x = S03_barX(i);
            const delay = `${i * 0.08}s`;
            return (
              <g key={`bar-${i}`}>
                {/* Aporte acumulado · Signal Red */}
                <rect
                  className="s04-chart-bar"
                  style={{ animationDelay: delay }}
                  x={x}
                  y={aporteY}
                  width={S03_BAR_W}
                  height={aporteH}
                  fill="#C8323C"
                />
                {/* Valor depto · Ink 100 con opacity 50% (skill Patrón 7.B.3) */}
                <rect
                  className="s04-chart-bar"
                  style={{ animationDelay: delay }}
                  x={x}
                  y={valorY}
                  width={S03_BAR_W}
                  height={valorH}
                  fill="var(--landing-text)"
                  fillOpacity={0.5}
                />
              </g>
            );
          })}

          {/* Línea Patrimonio neto · draw via stroke-dashoffset (CSS). */}
          <polyline
            className="s04-chart-line"
            points={netoPoints}
            fill="none"
            stroke="var(--landing-text)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
          />
          {/* Puntos sobre cada año · fade-in con la línea (CSS · stagger
              animation-delay i*0.15s · calca el avance de linePct original). */}
          {S03_NETO.map((v, i) => (
            <circle
              key={`dot-${i}`}
              className="s04-chart-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
              cx={S03_barX(i) + S03_BAR_W / 2}
              cy={S03_v2y(v)}
              r={2}
              fill="var(--landing-text)"
            />
          ))}

          {/* X-axis labels */}
          {S03_NETO.map((_, i) => (
            <text
              key={`xl-${i}`}
              x={S03_barX(i) + S03_BAR_W / 2}
              y={S03_X_LABEL_Y}
              textAnchor="middle"
              className="font-mono"
              style={{
                fontSize: 9,
                fill: "var(--landing-text-muted)",
              }}
            >
              a{i}
            </text>
          ))}
        </svg>

        {/* Leyenda */}
        <div
          className="flex items-center justify-center"
          style={{ gap: 18, paddingTop: 4, flexWrap: "wrap" }}
        >
          <S03LegendItem swatch={<S03Dot color="#C8323C" />} label="Aporte acumulado" />
          <S03LegendItem swatch={<S03Dot color="var(--landing-text)" opacity={0.5} />} label="Valor depto" />
          <S03LegendItem swatch={<S03LineSwatch />} label="Patrimonio neto" />
        </div>
      </motion.div>
    </div>
  );
}

function S03MiniCard({
  show,
  eyebrow,
  value,
  valueColor,
  sublabel,
}: {
  show: boolean;
  eyebrow: string;
  value: string;
  valueColor: string;
  sublabel: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
      transition={{ duration: 0.3, ease: S01_EASE }}
      aria-hidden={!show}
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        borderRadius: 8,
        padding: "9px 11px",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 4 }}
      >
        <span
          className="font-mono uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          {eyebrow}
        </span>
        <span
          className="font-mono text-[var(--landing-text-muted)]"
          style={{ fontSize: 10 }}
          aria-hidden="true"
        >
          →
        </span>
      </div>
      <p
        className="font-mono font-bold"
        style={{
          fontSize: 16,
          lineHeight: 1.15,
          color: valueColor,
          margin: 0,
          marginBottom: 3,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
      <p
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 9,
          letterSpacing: "0.06em",
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {sublabel}
      </p>
    </motion.div>
  );
}

function S03Dot({ color, opacity }: { color: string; opacity?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        opacity,
      }}
    />
  );
}

function S03LineSwatch() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 12,
        height: 1.5,
        background: "var(--landing-text)",
        borderRadius: 1,
      }}
    />
  );
}

function S03LegendItem({
  swatch,
  label,
}: {
  swatch: ReactNode;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 6 }}
    >
      {swatch}
      <span
        className="font-mono text-[var(--landing-text)]"
        style={{ fontSize: 9, letterSpacing: "0.04em" }}
      >
        {label}
      </span>
    </span>
  );
}
