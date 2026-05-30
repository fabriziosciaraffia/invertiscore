"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* Hook · detecta si el tema actual es light leyendo data-franco-theme
 * en el elemento [data-franco-root]. Re-evalúa via MutationObserver. */
function useIsLight(): boolean {
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

/**
 * Hero mockup · MOBILE-ONLY (F.11 Phase 2.14 · animaciones internas portadas de Desktop).
 *
 * Misma máquina de estados + loop que HeroAnimatedDesktop, sizing mobile.
 *
 * Salvaguardas Phase 2.6e/f intactas (anti NotFoundError iOS Safari):
 *   · useInView con margin en px (no %), once:false
 *   · TODOS los motion.* always-mounted con animate condicional
 *   · NO {cond && <motion>} NUNCA · NO AnimatePresence
 *   · Cursor del input always-mounted (animate condicional opacity)
 *   · Dropdown always-mounted (animate condicional opacity/y)
 *   · Counters via requestAnimationFrame + flag mounted en cleanup
 *   · SVG rects always-mounted (animate height/y)
 *   · polyline path always-mounted, strokeDashoffset CSS (no SMIL)
 *   · IntersectionObserver via useInView + try/catch implícito
 *   · prefers-reduced-motion → estado final estático directo, bypass loop
 *   · Phase 2.18c · loop sin pause-on-touch (causaba race NotFoundError iOS)
 *
 * Loop ~10s (idéntico a Desktop):
 *   t=0-3000     form-active: Card 1 brillante, sola
 *   t=3000-3500  transition: Card 2 entra
 *   t=3500-9000  results-active: Card 2 construye contenido animado
 *   t=9000-9500  stable
 *   t=9500-10000 exit: Card 2 sale, Card 1 vuelve a brillar
 *   t=10000      reset → próximo ciclo
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const TYPING_SPEED_MS = 75;
const DIRECCION = "Av. Manuel Montt 1234, Providencia";

type LoopPhase =
  | "idle"
  | "form-active"
  | "transition"
  | "results-active"
  | "stable";

const SUGGESTIONS = [
  "Av. Manuel Montt 1234, Providencia, Chile",
  "Av. Manuel Montt 1250, Providencia, Chile",
];

/* ===== Patrimonio chart constants (mismo modelo que Desktop / s04 Step03) ===== */
const APORTE = [60, 78, 96, 115, 135, 156, 178, 200, 220, 235, 250];
const VALOR = [250, 270, 290, 305, 315, 325, 340, 350, 360, 370, 380];
const NETO = [80, 120, 165, 215, 270, 330, 395, 465, 540, 625, 720];
const GRID_VALUES = [0, 400, 800];
const BAR_W = 22;
const BAR_GAP = 25;
const CHART_LEFT = 54;
const CHART_TOP = 8;
const CHART_BOTTOM_Y = 98;
const MAX_V = 800;
const INNER_H = CHART_BOTTOM_Y - CHART_TOP;
const v2y = (v: number) => CHART_BOTTOM_Y - (v / MAX_V) * INNER_H;
const barX = (i: number) => CHART_LEFT + i * (BAR_W + BAR_GAP);

export default function HeroStaticMobile() {
  const reduce = useReducedMotion();
  const isLight = useIsLight();
  const containerRef = useRef<HTMLDivElement>(null);

  // useInView con margin px (Phase 2.6g · compat Safari iOS).
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });

  const [card1Entered, setCard1Entered] = useState(!!reduce);
  const [showCard2, setShowCard2] = useState(!!reduce);

  const [phase, setPhase] = useState<LoopPhase>(reduce ? "stable" : "idle");

  // ─── Form sub-state ─────────────────────────────
  const [typedText, setTypedText] = useState(reduce ? DIRECCION : "");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [autocompleteHighlight, setAutocompleteHighlight] = useState(false);
  // formReveal · 0..10 · cada ítem del formulario en secuencia (igual que s04).
  const [formReveal, setFormReveal] = useState(reduce ? 10 : 0);
  const [precioCount, setPrecioCount] = useState(reduce ? 5500 : 0);
  const [superficieCount, setSuperficieCount] = useState(reduce ? 60 : 0);

  // ─── Results sub-state ──────────────────────────
  // Initial = FINAL state (Card 2 protagonista, igual que Desktop).
  const [scoreCount, setScoreCount] = useState(61);
  const [barPct, setBarPct] = useState(61);
  const [showBadge, setShowBadge] = useState(true);
  const [showLine, setShowLine] = useState(true);
  const [showCaja, setShowCaja] = useState(true);
  const [showCard02, setShowCard02] = useState(true);
  const [showCard03, setShowCard03] = useState(true);
  const [showCard04, setShowCard04] = useState(true);
  const [showCard05, setShowCard05] = useState(true);
  const [costoCount, setCostoCount] = useState(310);
  const [negociCount, setNegociCount] = useState(4900);
  const [largoCount, setLargoCount] = useState(1450);
  const [showPatri, setShowPatri] = useState(true);
  // Phase 2.18d · barIdx y linePct removidos · el SVG ahora corre con CSS
  // @keyframes puro (sin estado JS, sin motion.* dentro del SVG).

  const showFinalStatic = !!reduce;
  // Phase 2.18c · isHovered eliminado del ciclo de vida del loop.
  // El touch ya NO pausa/reinicia el loop — eso causaba race removeChild en
  // WebKit (touchend → cascada de ~37 motion.* updates colisionando con
  // transitions en vuelo). El loop corre continuo; solo isInView lo gobierna.
  const shouldLoop = !showFinalStatic && isInView && card1Entered;

  // Entrada inicial · solo Card 1. Card 2 entra en el primer ciclo.
  useEffect(() => {
    if (showFinalStatic) {
      setCard1Entered(true);
      setShowCard2(true);
      return;
    }
    const t1 = setTimeout(() => setCard1Entered(true), 1200);
    return () => {
      clearTimeout(t1);
    };
  }, [showFinalStatic]);

  // Estado estático final (prefers-reduced-motion).
  useEffect(() => {
    if (!showFinalStatic) return;
    setPhase("stable");
    setTypedText(DIRECCION);
    setDropdownVisible(false);
    setAutocompleteHighlight(false);
    setFormReveal(10);
    setPrecioCount(5500);
    setSuperficieCount(60);
    setScoreCount(61);
    setBarPct(61);
    setShowBadge(true);
    setShowLine(true);
    setShowCaja(true);
    setShowCard02(true);
    setShowCard03(true);
    setShowCard04(true);
    setShowCard05(true);
    setCostoCount(310);
    setNegociCount(4900);
    setLargoCount(1450);
    setShowPatri(true);
  }, [showFinalStatic]);

  // ─── Loop principal ──────────────────────────────
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
      // ===== FORM ACTIVE (0-3000ms) · Card 1 SOLA =====
      setPhase("form-active");
      setShowCard2(false);
      setTypedText("");
      setDropdownVisible(false);
      setAutocompleteHighlight(false);
      setFormReveal(0);
      setPrecioCount(0);
      setSuperficieCount(0);

      // Reset Card 2 sub-state.
      setScoreCount(0);
      setBarPct(0);
      setShowBadge(false);
      setShowLine(false);
      setShowCaja(false);
      setShowCard02(false);
      setShowCard03(false);
      setShowCard04(false);
      setShowCard05(false);
      setCostoCount(0);
      setNegociCount(0);
      setLargoCount(0);
      setShowPatri(false);

      // t=600 typing arranca
      T(600, () => {
        let i = 0;
        typingInterval = setInterval(() => {
          if (!mounted) return;
          i++;
          setTypedText(DIRECCION.slice(0, i));
          if (i >= DIRECCION.length && typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
          }
        }, TYPING_SPEED_MS);
      });

      // t=1500 dropdown · t=1800 highlight · t=2250 cierra
      T(1500, () => setDropdownVisible(true));
      T(1800, () => setAutocompleteHighlight(true));
      T(2250, () => {
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        setTypedText(DIRECCION);
        setDropdownVisible(false);
        setAutocompleteHighlight(false);
      });

      // Reveal secuencial del formulario · un ítem a la vez (cascada ~200ms).
      // Termina antes de que entre Card 2 (t=4500).
      T(2550, () => setFormReveal(1)); // Tipo
      T(2750, () => {
        setFormReveal(2); // Precio
        animateCounter(setPrecioCount, 0, 5500, 700);
      });
      T(2950, () => {
        setFormReveal(3); // Superficie
        animateCounter(setSuperficieCount, 0, 60, 700);
      });
      T(3150, () => setFormReveal(4)); // Mapa
      T(3350, () => setFormReveal(5)); // Dormitorios
      T(3500, () => setFormReveal(6)); // Baños
      T(3650, () => setFormReveal(7)); // Estacionamiento
      T(3800, () => setFormReveal(8)); // Bodega
      T(3950, () => setFormReveal(9)); // Huéspedes
      T(4150, () => setFormReveal(10)); // Analizar

      // ===== TRANSITION (4500-5250ms) · Card 2 entra =====
      T(4500, () => {
        setPhase("transition");
        setShowCard2(true);
      });

      // ===== RESULTS ACTIVE (5250-13500ms) =====
      T(5250, () => {
        setPhase("results-active");
        animateCounter(setScoreCount, 0, 61, 1800);
        animateCounter(setBarPct, 0, 61, 1800, false);
      });
      T(7050, () => setShowBadge(true));
      T(7350, () => setShowLine(true));
      T(7950, () => setShowCaja(true));
      T(8850, () => {
        setShowCard02(true);
        animateCounter(setCostoCount, 0, 310, 1050);
      });
      T(9150, () => {
        setShowCard03(true);
        animateCounter(setNegociCount, 0, 4900, 1050);
      });
      T(9450, () => {
        setShowCard04(true);
        animateCounter(setLargoCount, 0, 1450, 1050);
      });
      T(9750, () => setShowCard05(true));
      T(10350, () => setShowPatri(true));
      // Phase 2.18d · bar stagger + line draw ahora son CSS @keyframes
      // (sincronizados con el inicio del runCycle vía className).

      // ===== STABLE (13500-14250ms) =====
      T(13500, () => setPhase("stable"));

      // ===== EXIT (14250-15000ms) =====
      T(14250, () => setShowCard2(false));

      // ===== RESET =====
      T(15000, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (typingInterval) clearInterval(typingInterval);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [shouldLoop]);

  // ─── Render derived values ──────────────────────
  const dimOpacity = isLight ? 0.72 : 0.55;
  const dimBrightness = isLight ? 1.0 : 0.7;
  const card1Opacity = !card1Entered
    ? 0
    : showCard2
      ? dimOpacity
      : 1.0;
  const card1Brightness = !card1Entered
    ? dimBrightness
    : showCard2
      ? dimBrightness
      : 1.0;
  const card2Opacity = showCard2 ? 1.0 : 0;
  // Card 1 entry: centrada → slide a su pos cuando Card 2 entra.
  // Container ~358px - card 78% ≈ 279 → centered left = 40 → translateX 40-12 = 28.
  const card1X = !card1Entered ? 60 : showCard2 ? 0 : 28;
  const card1Anim = { x: card1X, y: 0 };
  const card2Anim = showCard2 ? { x: 0, y: 0 } : { x: 24, y: 0 };

  const cursorVisible =
    phase === "form-active" && typedText.length < DIRECCION.length;

  const solidBg = "var(--landing-mockup-solid-bg)";

  // Sizing mobile · Card 1 y Card 2 mismas dimensiones (78% × 500), con
  // offset top:80 en Card 2 para mantener superpuestas visibles.
  const card1Style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 12,
    width: "78%",
    height: 500,
    padding: 14,
    backgroundColor: solidBg,
    borderRadius: 22,
    zIndex: 1,
    willChange: "opacity, filter, transform",
    overflow: "hidden",
  };
  const card2Style: React.CSSProperties = {
    position: "absolute",
    top: 80,
    right: 12,
    width: "78%",
    height: 500,
    padding: 12,
    backgroundColor: solidBg,
    borderRadius: 22,
    boxShadow:
      "inset 0 1px 0 0 rgba(255, 255, 255, 0.04), -16px 0 36px -18px rgba(0, 0, 0, 0.7)",
    zIndex: 2,
    willChange: "opacity, transform",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: 580,
    marginTop: 40,
    marginBottom: 64,
    overflow: "visible",
  };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      {/* CARD 1 · FORM (atrás · entra primero centrada, dim cuando Card 2 entra) */}
      <motion.div
        className="franco-mockup"
        initial={false}
        animate={{
          opacity: card1Opacity,
          filter: `brightness(${card1Brightness})`,
          ...card1Anim,
        }}
        transition={{ duration: 1.4, ease: EASE }}
        style={card1Style}
        aria-label="Mockup formulario"
      >
        <FormCardMobile
          typedText={typedText}
          cursorVisible={cursorVisible}
          dropdownVisible={dropdownVisible}
          autocompleteHighlight={autocompleteHighlight}
          formReveal={formReveal}
          precioCount={precioCount}
          superficieCount={superficieCount}
          isLight={isLight}
        />
      </motion.div>

      {/* CARD 2 · RESULTS (frente · entra después con slide + fade) */}
      <motion.div
        className="franco-mockup"
        initial={false}
        animate={{ opacity: card2Opacity, ...card2Anim }}
        transition={{ duration: 1.4, ease: EASE }}
        style={card2Style}
        aria-label="Mockup resultados"
      >
        <ResultsCardMobile
          scoreCount={scoreCount}
          barPct={barPct}
          showBadge={showBadge}
          showLine={showLine}
          showCaja={showCaja}
          showCard02={showCard02}
          showCard03={showCard03}
          showCard04={showCard04}
          showCard05={showCard05}
          costoCount={costoCount}
          negociCount={negociCount}
          largoCount={largoCount}
          showPatri={showPatri}
          chartActive={shouldLoop}
        />
      </motion.div>
    </div>
  );
}

/* ===================== Shared sub-components ===================== */

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

function HeaderApp({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: 10 }}
    >
      <MockupWordmark />
      <span
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.12em" }}
      >
        {label}
      </span>
    </div>
  );
}

/* ===================== Card 1 · Form (animado · mobile) ===================== */

/* Item revelable · reveal secuencial item-por-item.
 * SAFE iOS WebKit (Phase 2.6e/f): NO usa framer motion.* — es un <div> plano
 * always-mounted con transición CSS de opacidad. Animar ~10 motion.* en
 * simultáneo en cada reset del loop gatillaba el race removeChild
 * (NotFoundError) que tira el sitio. CSS opacity no toca el reconciler. */
function RevealItem({
  show,
  children,
  className,
  style,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden={!show}
      className={className}
      style={{
        ...style,
        opacity: show ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {children}
    </div>
  );
}

function FormCardMobile({
  typedText,
  cursorVisible,
  dropdownVisible,
  autocompleteHighlight,
  formReveal,
  precioCount,
  superficieCount,
  isLight,
}: {
  typedText: string;
  cursorVisible: boolean;
  dropdownVisible: boolean;
  autocompleteHighlight: boolean;
  formReveal: number;
  precioCount: number;
  superficieCount: number;
  isLight: boolean;
}) {
  return (
    <div>
      <HeaderApp label="Nuevo análisis" />

      {/* Dirección · typing + dropdown autocomplete OVERLAY (no reserva alto). */}
      <div style={{ position: "relative", marginBottom: 10, zIndex: 5 }}>
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
            minHeight: 20,
          }}
        >
          <span
            className="font-body text-[var(--landing-text)]"
            style={{
              fontSize: 12,
              position: "relative",
              display: "inline-block",
            }}
          >
            {/* Placeholder always-mounted (Phase 2.18d · sin mount/unmount).
                Antes: ternario {typedText ? ... : <span>...</span>} causaba
                race removeChild en iOS WebKit cuando React desmontaba el
                <span> mientras framer-motion ajustaba el cursor hermano.
                Ahora: placeholder absoluto, opacity controla visibilidad. */}
            <span
              aria-hidden={!!typedText}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                color: "var(--landing-text-muted)",
                opacity: typedText ? 0 : 1,
                transition: "opacity 120ms linear",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              Buscar dirección…
            </span>
            {/* Texto tecleado · reserva espacio cuando vacío vía
                visibility:hidden para que el cursor se posicione correctamente.
                Solo mutación de text content (sin mount/unmount de elementos). */}
            <span
              style={{ visibility: typedText ? "visible" : "hidden" }}
            >
              {typedText || "Buscar dirección…"}
            </span>
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
        {/* Dropdown always-mounted, OVERLAY absoluto (no reserva alto). */}
        <motion.div
          initial={false}
          animate={
            dropdownVisible
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -4 }
          }
          transition={{ duration: 0.18, ease: EASE }}
          aria-hidden={!dropdownVisible}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 10,
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 5,
            padding: 3,
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            pointerEvents: dropdownVisible ? "auto" : "none",
          }}
        >
          {SUGGESTIONS.map((s, i) => (
            <div
              key={s}
              className="font-body text-[var(--landing-text)]"
              style={{
                fontSize: 11,
                padding: "4px 6px",
                borderRadius: 3,
                background:
                  i === 0 && autocompleteHighlight
                    ? "rgba(200,50,60,0.10)"
                    : "transparent",
                color:
                  i === 0 && autocompleteHighlight
                    ? "var(--landing-text)"
                    : "var(--landing-text-secondary)",
                transition: "background 0.18s ease",
              }}
            >
              {s}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Tipo · chips Usado / Nuevo · reveal 1 */}
      <RevealItem show={formReveal >= 1} style={{ marginBottom: 10 }}>
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
      </RevealItem>

      {/* Grid Precio (UF/CLP toggle) + Superficie · cada celda en secuencia (2, 3) */}
      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 12 }}>
        <RevealItem show={formReveal >= 2}>
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
        </RevealItem>
        <RevealItem show={formReveal >= 3}>
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
        </RevealItem>
      </div>

      {/* Mapa real WebP · theme-aware · reveal 4 · alto fijo (card mobile baja). */}
      <RevealItem
        show={formReveal >= 4}
        className="relative w-full overflow-hidden"
        style={{
          height: 68,
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            isLight
              ? "/landing/map-comparables-light.png"
              : "/landing/map-comparables.webp"
          }
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          aria-hidden="true"
        />
      </RevealItem>

      {/* Características · campos reales del Paso 1 (dormitorios, baños,
          estacionamiento, bodega, huéspedes). Cada uno en secuencia (5..9). */}
      <div className="grid grid-cols-2" style={{ gap: "5px 12px" }}>
        {(
          [
            ["Dormitorios", "2"],
            ["Baños", "1"],
            ["Estacionamiento", "1"],
            ["Bodega", "1"],
            ["Huéspedes", "4"],
          ] as ReadonlyArray<readonly [string, string]>
        ).map(([label, value], i) => (
          <RevealItem key={label} show={formReveal >= 5 + i}>
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 2 }}
            >
              {label}
            </p>
            <div
              style={{
                borderBottom: "0.5px solid var(--landing-divider)",
                paddingBottom: 3,
              }}
            >
              <span
                className="font-mono font-medium text-[var(--landing-text)]"
                style={{ fontSize: 12 }}
              >
                {value}
              </span>
            </div>
          </RevealItem>
        ))}
      </div>

      {/* Botón ANALIZAR · reveal 10 */}
      <RevealItem show={formReveal >= 10} style={{ marginTop: 10 }}>
        <div
          style={{
            padding: "7px 12px",
            background: "#C8323C",
            color: "#FAFAF8",
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          Analizar
          <span aria-hidden="true">→</span>
        </div>
      </RevealItem>
    </div>
  );
}

/* ===================== Card 2 · Results (animado · mobile) ===================== */

function ResultsCardMobile({
  scoreCount,
  barPct,
  showBadge,
  showLine,
  showCaja,
  showCard02,
  showCard03,
  showCard04,
  showCard05,
  costoCount,
  negociCount,
  largoCount,
  showPatri,
  chartActive,
}: {
  scoreCount: number;
  barPct: number;
  showBadge: boolean;
  showLine: boolean;
  showCaja: boolean;
  showCard02: boolean;
  showCard03: boolean;
  showCard04: boolean;
  showCard05: boolean;
  costoCount: number;
  negociCount: number;
  largoCount: number;
  showPatri: boolean;
  chartActive: boolean;
}) {
  const netoPoints = NETO.map(
    (v, i) => `${barX(i) + BAR_W / 2},${v2y(v)}`,
  ).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <HeaderApp label="Completado" />

      {/* Hero veredicto · score counter + tracker + badge outlined */}
      <div
        style={{
          background: "var(--landing-mockup-solid-bg)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 10,
          padding: 11,
          marginBottom: 8,
        }}
      >
        {/* Eyebrow row */}
        <div className="flex items-center" style={{ gap: 5, marginBottom: 6 }}>
          <span
            className="font-mono uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
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
              width: 11,
              height: 11,
              borderRadius: "50%",
              border: "0.5px solid currentColor",
              fontSize: 7,
              lineHeight: 1,
            }}
          >
            ?
          </span>
          <motion.span
            initial={false}
            animate={
              showBadge
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.92 }
            }
            transition={{ duration: 0.25, ease: EASE }}
            aria-hidden={!showBadge}
            className="font-mono uppercase"
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: "#C8323C",
              border: "0.5px solid #C8323C",
              padding: "4px 7px",
              borderRadius: 3,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.1em",
              whiteSpace: "nowrap",
            }}
          >
            Ajusta supuestos
          </motion.span>
        </div>

        {/* Score row · número Mono Bold animado + tracker bar fill */}
        <div className="flex items-center" style={{ gap: 10 }}>
          <span
            className="font-mono font-bold text-[var(--landing-text)]"
            style={{
              fontSize: 26,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            {scoreCount}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                height: 3,
                background:
                  "linear-gradient(to right, #C8323C 0%, #B4B2A9 100%)",
                borderRadius: 1.5,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${barPct}%`,
                  top: "50%",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#C8323C",
                  border: "2px solid var(--landing-mockup-solid-bg)",
                  transform: "translate(-50%, -50%)",
                }}
                aria-hidden="true"
              />
            </div>
            <div style={{ position: "relative", height: 10, marginTop: 3 }}>
              <span
                className="font-mono uppercase text-[var(--landing-text-muted)]"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontSize: 8,
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
                  fontSize: 8,
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
                  fontSize: 8,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                Comprar
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cita italic Sans · fade-in */}
      <motion.p
        initial={false}
        animate={showLine ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        aria-hidden={!showLine}
        className="font-body italic text-[var(--landing-text)]"
        style={{
          fontSize: 12,
          lineHeight: 1.35,
          margin: 0,
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        Buena propiedad. Precio incómodo.
      </motion.p>

      {/* Caja Franco · border-left 3px Signal Red · fade + slide y */}
      <motion.div
        initial={false}
        animate={showCaja ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={{ duration: 0.35, ease: EASE }}
        aria-hidden={!showCaja}
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderLeft: "3px solid #C8323C",
          borderRadius: "0 6px 6px 0",
          padding: "9px 10px",
          marginBottom: 7,
        }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 8,
            letterSpacing: "0.14em",
            color: "#C8323C",
            marginBottom: 3,
          }}
        >
          Antes de negociar
        </p>
        <p
          className="font-body italic text-[var(--landing-text)]"
          style={{ fontSize: 11, lineHeight: 1.4, margin: 0 }}
        >
          Negocia hasta{" "}
          <span className="font-mono font-bold text-[var(--landing-text)]">
            UF 4.900
          </span>{" "}
          y el flujo cuadra. Si no cede, prueba Airbnb — te da{" "}
          <span className="font-mono font-bold text-[var(--landing-text)]">
            +$180K/mes
          </span>{" "}
          pero requiere gestión.
        </p>
      </motion.div>

      {/* Grid 2x2 mini-cards · stagger + counters animados */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 5,
          marginBottom: 7,
        }}
      >
        <MiniCard
          show={showCard02}
          eyebrow="02 · Costo mensual"
          value={`−$${costoCount}K`}
          valueColor="#C8323C"
          sublabel="Flujo de bolsillo"
        />
        <MiniCard
          show={showCard03}
          eyebrow="03 · Negociación"
          value={`UF ${negociCount.toLocaleString("es-CL")}`}
          valueColor="var(--landing-text)"
          sublabel="Precio sugerido"
        />
        <MiniCard
          show={showCard04}
          eyebrow="04 · Largo plazo"
          value={`+UF ${largoCount.toLocaleString("es-CL")}`}
          valueColor="var(--landing-text)"
          sublabel="Plusvalía 10 años"
        />
        <MiniCard
          show={showCard05}
          eyebrow="05 · Riesgos"
          value="3 medios"
          valueColor="var(--landing-text)"
          sublabel="Vacancia · tasa · m²"
        />
      </div>

      {/* Bloque Patrimonio · barras stagger + línea draw */}
      <motion.div
        initial={false}
        animate={showPatri ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-hidden={!showPatri}
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 8,
          padding: 9,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          className="flex items-baseline justify-between"
          style={{ marginBottom: 6, gap: 8 }}
        >
          <p
            className="font-mono uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 8, letterSpacing: "0.12em" }}
          >
            09 · Patrimonio
          </p>
          <p
            className="font-heading font-bold text-[var(--landing-text)]"
            style={{ fontSize: 11, lineHeight: 1.2 }}
          >
            Cómo crece tu capital
          </p>
        </div>

        <svg
          viewBox="0 0 560 130"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block" }}
          className={
            chartActive
              ? "hero-mobile-chart hero-mobile-chart--active"
              : "hero-mobile-chart"
          }
          aria-hidden="true"
        >
          {GRID_VALUES.map((v) => {
            const y = v2y(v);
            return (
              <g key={`grid-${v}`}>
                <line
                  x1={CHART_LEFT}
                  x2={552}
                  y1={y}
                  y2={y}
                  stroke="var(--landing-card-border)"
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={CHART_LEFT - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono"
                  style={{ fontSize: 9, fill: "var(--landing-text-muted)" }}
                >
                  {v === 0 ? "$0" : `$${v}M`}
                </text>
              </g>
            );
          })}

          {APORTE.map((ap, i) => {
            const val = VALOR[i];
            const aporteY = v2y(ap);
            const aporteH = CHART_BOTTOM_Y - aporteY;
            const valorY = v2y(ap + val);
            const valorH = aporteY - valorY;
            const x = barX(i);
            // Phase 2.18d · native <rect> con className · animación 100% CSS.
            // transform-origin: bottom + scaleY 0→1 emula y/height crece.
            // animation-delay = i * 0.15s para stagger.
            const delay = `${i * 0.15}s` as const;
            return (
              <g key={`bar-${i}`}>
                <rect
                  className="hero-mobile-chart-bar"
                  style={{ animationDelay: delay }}
                  x={x}
                  y={aporteY}
                  width={BAR_W}
                  height={aporteH}
                  fill="#C8323C"
                />
                <rect
                  className="hero-mobile-chart-bar"
                  style={{ animationDelay: delay }}
                  x={x}
                  y={valorY}
                  width={BAR_W}
                  height={valorH}
                  fill="var(--landing-text)"
                  fillOpacity={0.5}
                />
              </g>
            );
          })}

          <polyline
            className="hero-mobile-chart-line"
            points={netoPoints}
            fill="none"
            stroke="var(--landing-text)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
          />
          {NETO.map((v, i) => (
            <circle
              key={`dot-${i}`}
              className="hero-mobile-chart-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
              cx={barX(i) + BAR_W / 2}
              cy={v2y(v)}
              r={2}
              fill="var(--landing-text)"
            />
          ))}

          {NETO.map((_, i) => (
            <text
              key={`xl-${i}`}
              x={barX(i) + BAR_W / 2}
              y={113}
              textAnchor="middle"
              className="font-mono"
              style={{ fontSize: 9, fill: "var(--landing-text-muted)" }}
            >
              a{i}
            </text>
          ))}
        </svg>
      </motion.div>
    </div>
  );
}

function MiniCard({
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
      transition={{ duration: 0.3, ease: EASE }}
      aria-hidden={!show}
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        borderRadius: 7,
        padding: "7px 9px",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 3 }}
      >
        <span
          className="font-mono uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 8, letterSpacing: "0.1em" }}
        >
          {eyebrow}
        </span>
        <span
          className="font-mono text-[var(--landing-text-muted)]"
          style={{ fontSize: 9 }}
          aria-hidden="true"
        >
          →
        </span>
      </div>
      <p
        className="font-mono font-bold"
        style={{
          fontSize: 13,
          lineHeight: 1.15,
          color: valueColor,
          margin: 0,
          marginBottom: 2,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
      <p
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 8,
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
