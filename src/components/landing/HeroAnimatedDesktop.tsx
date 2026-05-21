"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
 * Hero animated mockup · DESKTOP-ONLY (F.11 Phase 2.12 · recicla s04 cards).
 *
 * Estructura:
 *   · CARD 2 · Results — protagonista PERMANENTE (opacity 1.0 siempre).
 *     right:0 dentro del wrapper · width 420 · height 640.
 *   · CARD 1 · Form — "input que se ejecuta" · alterna apagada (0.55, brightness 0.7)
 *     vs activa (1.0) según fase del loop.
 *     right:200 top:30 · width 380 · height 560 · asoma 160px a la izq.
 *
 * Contenido = cards Step01 + Step03 de s04 SectionWhatFrancoDoes:
 *   · Form (Step01): header wordmark + dirección + dropdown autocomplete
 *     + chips USADO/NUEVO + precio (UF/CLP toggle) / superficie + mapa
 *     real WebP (theme-aware) + botón ANALIZAR.
 *   · Results (Step03): header wordmark + Hero score block (FRANCO SCORE +
 *     ? + AJUSTA SUPUESTOS outlined + score 61 Mono Bold 30px + tracker
 *     gradient + dot + BUSCAR/AJUSTA/COMPRAR labels) + cita italic Sans
 *     + Caja Franco (border-left 3px Signal Red, esquinas izq cuadradas)
 *     + 4 mini-cards (Mono Bold values, Mono uppercase sublabels) + bloque
 *     Patrimonio (11 barras stagger + línea Patrimonio neto).
 *
 * Loop ~10s (Card 2 nunca dim):
 *   t=0-3000     form-active: Card 1 brillante · typing + dropdown + chips
 *                + counters + mapa fade-in.
 *   t=3000-3500  transition: Card 1 dim back.
 *   t=3500-9000  results-active: Card 2 anima score 0→61 + tracker + badge
 *                + cita + Caja + 4 mini-cards stagger + patrimonio (11 barras
 *                stagger 80ms + línea draw 1s via stroke-dashoffset).
 *   t=9000-10000 stable: pausa.
 *   t=10000 reset → próximo cycle.
 *
 * Pausas reversibles: IO propio + heroVisible prop + hover/touch wrapper.
 * prefers-reduced-motion → estado final estable sin loop.
 *
 * Defensivos Safari iOS (Phase 2.6e/f intactos):
 *   · IO en try/catch con fallback visible=true
 *   · dropdown always-mounted (animate condicional)
 *   · motion rects SVG always-mounted (animate height/y attribute)
 *   · polyline path always-mounted (strokeDashoffset CSS)
 *   · cursor del input siempre montado (animate condicional opacity)
 *   · onTouchStart/End/Cancel + onMouseEnter/Leave
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const TYPING_SPEED_MS = 50;
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

/* ===== Patrimonio chart constants (mismo modelo que s04 Step03) ===== */
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

export default function HeroAnimatedDesktop({
  loopArmed = false,
  heroVisible = true,
}: {
  loopArmed?: boolean;
  heroVisible?: boolean;
}) {
  const reduce = useReducedMotion();
  const isLight = useIsLight();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const [card1Entered, setCard1Entered] = useState(!!reduce);
  // showCard2 controla visibilidad Card 2 dentro del loop.
  // Phase 2.13 pattern (s03): Card 1 sola primero, después Card 2 entra
  // superpuesta. Al final del ciclo Card 2 sale y Card 1 vuelve a brillar.
  const [showCard2, setShowCard2] = useState(!!reduce);

  const [phase, setPhase] = useState<LoopPhase>(reduce ? "stable" : "idle");

  // ─── Form sub-state ─────────────────────────────
  const [typedText, setTypedText] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [autocompleteHighlight, setAutocompleteHighlight] = useState(false);
  const [showChips, setShowChips] = useState(false);
  const [precioCount, setPrecioCount] = useState(0);
  const [superficieCount, setSuperficieCount] = useState(0);
  const [showMap, setShowMap] = useState(false);

  // ─── Results sub-state ──────────────────────────
  // Initial values = FINAL state. Card 2 es protagonista permanente:
  // muestra contenido completo apenas entra. El loop solo "resetea" al iniciar
  // results-active (t=3500 del cycle) y re-anima. Durante form-active /
  // transition / stable, Card 2 mantiene el estado final del ciclo anterior.
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
  const [barIdx, setBarIdx] = useState(11);
  const [linePct, setLinePct] = useState(100);

  const showFinalStatic = !!reduce;
  const shouldLoop =
    !showFinalStatic &&
    loopArmed &&
    heroVisible &&
    isVisible &&
    !isHovered &&
    card1Entered;

  // IntersectionObserver propio — pausa fuera de viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    try {
      const obs = new IntersectionObserver(
        ([entry]) => setIsVisible(entry.isIntersecting),
        { threshold: 0.2, rootMargin: "0px 0px -50px 0px" },
      );
      obs.observe(el);
      return () => obs.disconnect();
    } catch {
      setIsVisible(true);
      return () => {};
    }
  }, []);

  // Entrada inicial · solo Card 1. Card 2 entra recién en el primer ciclo
  // del loop (t=3000 de cycle) — efecto s03 "Card 1 sola primero".
  useEffect(() => {
    if (showFinalStatic) {
      setCard1Entered(true);
      setShowCard2(true);
      return;
    }
    const t1 = setTimeout(() => setCard1Entered(true), 1800);
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
    setShowChips(true);
    setPrecioCount(5500);
    setSuperficieCount(60);
    setShowMap(true);
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
    setBarIdx(11);
    setLinePct(100);
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
      // Card 2 oculta al iniciar cada ciclo · efecto s03 "Card 1 sola primero".
      setPhase("form-active");
      setShowCard2(false);
      setTypedText("");
      setDropdownVisible(false);
      setAutocompleteHighlight(false);
      setShowChips(false);
      setPrecioCount(0);
      setSuperficieCount(0);
      setShowMap(false);

      // Reset Card 2 sub-state ahora · cuando showCard2 pase a true en
      // t=3000, Card 2 hace fade-in VACÍA y va construyéndose progresivo
      // (no flash del estado final del ciclo anterior).
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
      setBarIdx(0);
      setLinePct(0);

      // t=400 typing arranca
      T(400, () => {
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

      // t=1000 dropdown aparece · t=1200 highlight · t=1500 cierra
      T(1000, () => setDropdownVisible(true));
      T(1200, () => setAutocompleteHighlight(true));
      T(1500, () => {
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        setTypedText(DIRECCION);
        setDropdownVisible(false);
        setAutocompleteHighlight(false);
      });

      // t=1700 chips TIPO + counters Precio/Superficie
      T(1700, () => {
        setShowChips(true);
        animateCounter(setPrecioCount, 0, 5500, 700);
        animateCounter(setSuperficieCount, 0, 60, 700);
      });

      // t=2200 mapa fade-in
      T(2200, () => setShowMap(true));

      // ===== TRANSITION (3000-3500ms) · Card 2 entra =====
      T(3000, () => {
        setPhase("transition");
        setShowCard2(true);
      });

      // ===== RESULTS ACTIVE (3500-9000ms) =====
      // Card 2 ya está visible y vacía (reset al inicio del cycle).
      // Ahora se construye progresivamente.
      T(3500, () => {
        setPhase("results-active");
        animateCounter(setScoreCount, 0, 61, 1200);
        animateCounter(setBarPct, 0, 61, 1200, false);
      });
      T(4700, () => setShowBadge(true));
      T(4900, () => setShowLine(true));
      T(5300, () => setShowCaja(true));
      T(5900, () => {
        setShowCard02(true);
        animateCounter(setCostoCount, 0, 310, 700);
      });
      T(6100, () => {
        setShowCard03(true);
        animateCounter(setNegociCount, 0, 4900, 700);
      });
      T(6300, () => {
        setShowCard04(true);
        animateCounter(setLargoCount, 0, 1450, 700);
      });
      T(6500, () => setShowCard05(true));
      T(6900, () => setShowPatri(true));
      for (let i = 0; i < 11; i++) {
        T(7100 + i * 80, () =>
          setBarIdx((prev) => (prev > i ? prev : i + 1)),
        );
      }
      T(8000, () => animateCounter(setLinePct, 0, 100, 1000, false));

      // ===== STABLE (9000-9500ms) =====
      T(9000, () => setPhase("stable"));

      // ===== EXIT (9500-10000ms) · Card 2 sale, Card 1 vuelve a brillar ===
      T(9500, () => setShowCard2(false));

      // ===== RESET → próximo ciclo =====
      T(10000, runCycle);
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
  // Phase 2.13 pattern: Card 1 brilla cuando está sola (showCard2 false).
  // Card 1 se atenúa cuando Card 2 entra (showCard2 true).
  // Card 2 opacity se controla por showCard2 (entra/sale en cada ciclo).
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
  const enterOffset = { x: 80, y: 0 };
  const card1Anim = !card1Entered ? enterOffset : { x: 0, y: 0 };
  // Card 2 slide-in cuando entra (showCard2 false→true).
  const card2Anim = showCard2 ? { x: 0, y: 0 } : { x: 30, y: 0 };

  const cursorVisible =
    phase === "form-active" && typedText.length < DIRECCION.length;

  const solidBg = "var(--landing-mockup-solid-bg)";

  // Cards sizing · Phase 2.12 (alturas ajustadas a contenido · Card 1 dentro
  // del wrapper para no invadir el grid cell del copy en SectionHero).
  // Wrapper 500 wide × 540 tall: contiene Card 2 (420 a la derecha) y Card 1
  // (380 a la izquierda con right:100). Card 1 left edge ≈ 20px from wrapper
  // left → no escapa de su grid cell → no overlap con H1.
  const card1Style: React.CSSProperties = {
    position: "absolute",
    top: 30,
    right: 100,
    width: 380,
    height: 480,
    padding: "16px 18px",
    backgroundColor: solidBg,
    borderRadius: 22,
    zIndex: 1,
    willChange: "opacity, filter, transform",
    overflow: "hidden",
  };
  const card2Style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    width: 420,
    height: 540,
    padding: "16px 18px",
    backgroundColor: solidBg,
    borderRadius: 22,
    boxShadow:
      "inset 0 1px 0 0 rgba(255, 255, 255, 0.04), -16px 0 32px -16px rgba(0, 0, 0, 0.6)",
    zIndex: 2,
    willChange: "opacity, transform",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: 500,
    height: 540,
  };

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
      onTouchCancel={() => setIsHovered(false)}
    >
      {/* CARD 2 · RESULTS — protagonista permanente */}
      <motion.div
        className="franco-mockup"
        animate={{ opacity: card2Opacity, ...card2Anim }}
        transition={{ duration: 0.6, ease: EASE }}
        style={card2Style}
        aria-label="Mockup resultados"
      >
        <ResultsCard
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
          barIdx={barIdx}
          linePct={linePct}
        />
      </motion.div>

      {/* CARD 1 · FORM — input que se ejecuta · alterna apagada/activa */}
      <motion.div
        className="franco-mockup"
        animate={{
          opacity: card1Opacity,
          filter: `brightness(${card1Brightness})`,
          ...card1Anim,
        }}
        transition={{ duration: 0.6, ease: EASE }}
        style={card1Style}
        aria-label="Mockup formulario"
      >
        <FormCard
          typedText={typedText}
          cursorVisible={cursorVisible}
          dropdownVisible={dropdownVisible}
          autocompleteHighlight={autocompleteHighlight}
          showChips={showChips}
          precioCount={precioCount}
          superficieCount={superficieCount}
          showMap={showMap}
          isLight={isLight}
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

/* ===================== Card 1 · Form (animado) ===================== */

function FormCard({
  typedText,
  cursorVisible,
  dropdownVisible,
  autocompleteHighlight,
  showChips,
  precioCount,
  superficieCount,
  showMap,
  isLight,
}: {
  typedText: string;
  cursorVisible: boolean;
  dropdownVisible: boolean;
  autocompleteHighlight: boolean;
  showChips: boolean;
  precioCount: number;
  superficieCount: number;
  showMap: boolean;
  isLight: boolean;
}) {
  return (
    <div>
      <HeaderApp label="Nuevo análisis" />

      {/* Dirección · con typing + dropdown autocomplete */}
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
            minHeight: 20,
          }}
        >
          <span
            className="font-body text-[var(--landing-text)]"
            style={{ fontSize: 12 }}
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
        {/* Dropdown always-mounted in-flow · animate condicional (Phase 2.6f). */}
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
            marginTop: 4,
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

      {/* Tipo · chips · always-mounted, opacity controlled */}
      <motion.div
        initial={false}
        animate={showChips ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
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

      {/* Grid Precio (UF/CLP toggle) + Superficie */}
      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 12 }}>
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

      {/* Mapa real WebP · theme-aware · fade-in via opacity */}
      <motion.div
        initial={false}
        animate={{ opacity: showMap ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "340 / 120",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 6,
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
      </motion.div>

      {/* Botón ANALIZAR */}
      <div
        style={{
          marginTop: 12,
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
    </div>
  );
}

/* ===================== Card 2 · Results (animado) ===================== */

function ResultsCard({
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
  barIdx,
  linePct,
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
  barIdx: number;
  linePct: number;
}) {
  const netoPoints = NETO.map(
    (v, i) => `${barX(i) + BAR_W / 2},${v2y(v)}`,
  ).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <HeaderApp label="Completado" />

      {/* Hero veredicto · score + tracker + badge outlined */}
      <div
        style={{
          background: "var(--landing-mockup-solid-bg)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 10,
          padding: 12,
          marginBottom: 8,
        }}
      >
        {/* Eyebrow row */}
        <div className="flex items-center" style={{ gap: 5, marginBottom: 8 }}>
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
              padding: "5px 9px",
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
            }}
          >
            Ajusta supuestos
          </motion.span>
        </div>

        {/* Score row · número Mono Bold + tracker */}
        <div className="flex items-center" style={{ gap: 12 }}>
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
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: "#C8323C",
                  border: "2px solid var(--landing-mockup-solid-bg)",
                  transform: "translate(-50%, -50%)",
                }}
                aria-hidden="true"
              />
            </div>
            <div style={{ position: "relative", height: 11, marginTop: 3 }}>
              <span
                className="font-mono uppercase text-[var(--landing-text-muted)]"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontSize: 9,
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
                  fontSize: 9,
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
                  fontSize: 9,
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

      {/* Cita italic Sans */}
      <motion.p
        initial={false}
        animate={showLine ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        aria-hidden={!showLine}
        className="font-body italic text-[var(--landing-text)]"
        style={{
          fontSize: 12,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        Buena propiedad. Precio incómodo.
      </motion.p>

      {/* Caja Franco · border-left 3px Signal Red */}
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
          padding: "9px 11px",
          marginBottom: 8,
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

      {/* Grid 2x2 mini-cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 8,
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

      {/* Bloque Patrimonio */}
      <motion.div
        initial={false}
        animate={showPatri ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-hidden={!showPatri}
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 8,
          padding: 10,
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
            style={{ fontSize: 12, lineHeight: 1.2 }}
          >
            Cómo crece tu capital
          </p>
        </div>

        <svg
          viewBox="0 0 560 130"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto", display: "block" }}
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
            const visible = i < barIdx;
            const aporteY = v2y(ap);
            const aporteH = CHART_BOTTOM_Y - aporteY;
            const valorY = v2y(ap + val);
            const valorH = aporteY - valorY;
            const x = barX(i);
            return (
              <g key={`bar-${i}`}>
                <motion.rect
                  initial={false}
                  animate={{
                    y: visible ? aporteY : CHART_BOTTOM_Y,
                    height: visible ? aporteH : 0,
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                  x={x}
                  width={BAR_W}
                  fill="#C8323C"
                />
                <motion.rect
                  initial={false}
                  animate={{
                    y: visible ? valorY : aporteY,
                    height: visible ? valorH : 0,
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                  x={x}
                  width={BAR_W}
                  fill="var(--landing-text)"
                  fillOpacity={0.5}
                />
              </g>
            );
          })}

          <polyline
            points={netoPoints}
            fill="none"
            stroke="var(--landing-text)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: 100 - linePct,
            }}
          />
          {NETO.map((v, i) => {
            const dotPct = (i / 10) * 100;
            const dotVisible = linePct >= dotPct - 0.5;
            return (
              <circle
                key={`dot-${i}`}
                cx={barX(i) + BAR_W / 2}
                cy={v2y(v)}
                r={2}
                fill="var(--landing-text)"
                style={{
                  opacity: dotVisible ? 1 : 0,
                  transition: "opacity 200ms linear",
                }}
              />
            );
          })}

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
        padding: "8px 10px",
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
          fontSize: 14,
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
