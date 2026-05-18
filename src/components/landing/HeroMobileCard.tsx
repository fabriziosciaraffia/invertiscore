"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getStaticMapUrl } from "@/lib/map-styles";

/**
 * Hero mockup — 2 cards sólidas, extendidas al viewport (F.11 Phase 2.7 Etapa 3).
 *
 * Concepto:
 *   · Card 2 (Results) es la protagonista PERMANENTE — opacity 1.0 siempre.
 *   · Card 1 (Form) es el "input que se ejecuta" — alterna entre apagada
 *     (opacity 0.55 + brightness 0.7) y activa (opacity 1.0 + brightness 1.0).
 *
 * Desktop:
 *   · Cards sólidas (no translúcidas) con bg de la section.
 *   · Card 2 anclada al borde DERECHO del viewport (right:0, width 440, height 480)
 *     con border-radius 14px 0 0 14px y box-shadow lateral izquierdo.
 *   · Card 1 detrás-izquierda (right:220, top:30, width 400, height 420),
 *     asoma 90px por la izquierda de Card 2.
 *
 * Mobile:
 *   · Stack vertical · Card 2 ARRIBA (asoma desde abajo del viewport above-the-fold)
 *     · Card 1 ABAJO (visible al scrollear).
 *   · Sin mask · cards sólidas con radius completo (Card 2 corta con bottom 0
 *     para sugerir continuación al scroll).
 *
 * Loop ~10s (Opción A modificada · Card 2 nunca dim):
 *   t=0-3000   form-active: Card 1 sube a 1.0 / brightness 1 · Form anima.
 *                            Card 2 sigue al 100%.
 *   t=3000-3500 transition: Card 1 baja a 0.55 / brightness 0.7.
 *   t=3500-9000 results-active: Card 2 anima internamente (score, badge, etc.)
 *                                Card 1 apagada.
 *   t=9000-10000 stable: ambas estables · Card 1 a 1.0 (preview previo al reset).
 *   t=10000 reset → t=0.
 *
 * Entrada inicial:
 *   t=1800 Card 2 entra (x:80→0 desktop / y:40→0 mobile, opacity:0→1)
 *   t=2000 Card 1 entra (x:80→0 / y:40→0, opacity:0→0.55, brightness:0→0.7)
 *   loopArmed externo (t=2700 desde SectionHero) → loop arranca.
 *
 * Pausas reversibles (Phase 2.6e):
 *   · IntersectionObserver propio (threshold 0.2 + rootMargin -50px)
 *   · heroVisible prop (IO de la sección Hero)
 *   · Hover/touch sobre wrapper externo
 *
 * Estado final estático: prefers-reduced-motion → ambas opacity 1.0,
 * brightness 1.0, contenido completo, sin loop.
 *
 * Defensivo Safari iOS (Phase 2.6e intactos):
 *   · IO en try/catch con fallback a visible=true
 *   · motion con repeat:Infinity siempre montadas (cursor + pin ring)
 *   · onTouchStart/End/Cancel + onMouseEnter/Leave
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const TYPING_SPEED_MS = 50;
const DIRECCION = "Av. Pedro de Valdivia 1850, Providencia";

type LoopPhase =
  | "idle"
  | "form-active"
  | "transition"
  | "results-active"
  | "stable";

const SUGGESTIONS = [
  "Av. Pedro de Valdivia 1850, Providencia",
  "Av. Pedro de Valdivia 2200, Providencia",
  "Av. Pedro de Valdivia 1234, Providencia",
];

const MAP_CENTER = { lat: -33.4297, lng: -70.6113 };
const MAP_VIEW_W = 380;
const MAP_VIEW_H = 100;
const MAP_PINS_GRAY = [
  { id: "p1", x: 90, y: 38, value: "UF 5.200" },
  { id: "p2", x: 270, y: 32, value: "UF 5.500" },
  { id: "p4", x: 305, y: 72, value: "UF 6.000" },
] as const;
const MAP_PIN_RED = { x: 185, y: 55, value: "UF 5.800" } as const;

const INSIGHT_CARDS: ReadonlyArray<{ eyebrow: string; text: string }> = [
  {
    eyebrow: "UBICACIÓN",
    text: "A 280m del metro Pedro de Valdivia y rodeado de oficinas. Demanda de arriendo alta y estable — vacancia esperada baja.",
  },
  {
    eyebrow: "PRECIO",
    text: "Estás pagando UF 100/m². La zona transa en UF 89. 12% sobre el promedio sin justificación clara.",
  },
  {
    eyebrow: "FLUJO",
    text: "Vas a poner $310.000 mensuales de tu bolsillo. En 25 años son $93M. Ojo con eso.",
  },
];

export default function HeroMobileCard({
  loopArmed = false,
  heroVisible = true,
  isDesktop = true,
}: {
  loopArmed?: boolean;
  heroVisible?: boolean;
  isDesktop?: boolean;
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Entradas escalonadas (Card 2 antes que Card 1 según spec).
  const [card1Entered, setCard1Entered] = useState(!!reduce);
  const [card2Entered, setCard2Entered] = useState(!!reduce);

  const [phase, setPhase] = useState<LoopPhase>(reduce ? "stable" : "idle");

  // Form sub-state
  const [typedText, setTypedText] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [autocompleteHighlight, setAutocompleteHighlight] = useState(false);
  const [precioCount, setPrecioCount] = useState(0);
  const [superficieCount, setSuperficieCount] = useState(0);
  // mapStage 0 hidden · 1 container · 2..4 pins gris · 5 pin rojo + ring · 6 caption
  const [mapStage, setMapStage] = useState(0);

  // Results sub-state
  const [scoreCount, setScoreCount] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [showFranco, setShowFranco] = useState(false);
  const [activeCards, setActiveCards] = useState(0);

  const showFinalStatic = !!reduce;
  const shouldLoop =
    !showFinalStatic &&
    loopArmed &&
    heroVisible &&
    isVisible &&
    !isHovered &&
    card1Entered &&
    card2Entered;

  // IntersectionObserver propio del mockup — pausa fuera de viewport.
  // rootMargin en px (no %) por compat con Safari iOS < 14.5 (Phase 2.6e).
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

  // Entrada escalonada de las cards.
  useEffect(() => {
    if (showFinalStatic) {
      setCard1Entered(true);
      setCard2Entered(true);
      return;
    }
    const t2 = setTimeout(() => setCard2Entered(true), 1800);
    const t1 = setTimeout(() => setCard1Entered(true), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showFinalStatic]);

  // Estado estático final (prefers-reduced-motion).
  useEffect(() => {
    if (!showFinalStatic) return;
    setPhase("stable");
    setTypedText(DIRECCION);
    setDropdownVisible(false);
    setAutocompleteHighlight(false);
    setPrecioCount(5800);
    setSuperficieCount(58);
    setMapStage(6);
    setScoreCount(61);
    setShowBadge(true);
    setShowLine(true);
    setShowFranco(true);
    setActiveCards(3);
  }, [showFinalStatic]);

  // Loop principal.
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

    const T = (offset: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (mounted) fn();
        }, offset),
      );
    };

    const runCycle = () => {
      // === FORM ACTIVE (0-3000ms) ===
      setPhase("form-active");
      setTypedText("");
      setDropdownVisible(false);
      setAutocompleteHighlight(false);
      setPrecioCount(0);
      setSuperficieCount(0);
      setMapStage(0);

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

      // t=1000 dropdown aparece
      T(1000, () => setDropdownVisible(true));
      // t=1200 highlight primer match
      T(1200, () => setAutocompleteHighlight(true));
      // t=1500 selección · cierra dropdown
      T(1500, () => {
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        setTypedText(DIRECCION);
        setDropdownVisible(false);
        setAutocompleteHighlight(false);
      });

      // t=1700 counters Precio/Superficie
      T(1700, () => {
        animateCounter(setPrecioCount, 0, 5800, 700);
        animateCounter(setSuperficieCount, 0, 58, 700);
      });

      // t=2300 mapa stagger reveal
      T(2300, () => setMapStage(1));
      T(2500, () => setMapStage(2));
      T(2650, () => setMapStage(3));
      T(2800, () => setMapStage(4));
      T(2950, () => setMapStage(5));
      T(3000, () => setMapStage(6));

      // === TRANSITION (3000-3500ms) ===
      T(3000, () => setPhase("transition"));

      // === RESULTS ACTIVE (3500-9000ms) ===
      T(3500, () => {
        setPhase("results-active");
        setScoreCount(0);
        setShowBadge(false);
        setShowLine(false);
        setShowFranco(false);
        setActiveCards(0);
        animateCounter(setScoreCount, 0, 61, 1200);
      });
      T(4700, () => setShowBadge(true));
      T(5000, () => setShowLine(true));
      T(5500, () => setShowFranco(true));
      T(6300, () => setActiveCards(1));
      T(6600, () => setActiveCards(2));
      T(6900, () => setActiveCards(3));

      // === STABLE (9000-10000ms) ===
      T(9000, () => setPhase("stable"));

      // === RESET → próximo ciclo ===
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

  // === Render derived values ===
  // Card 2 (Results) es protagonista permanente: opacity 1.0 siempre tras entry.
  // Card 1 (Form) alterna entre 0.55 base + brightness 0.7 ↔ 1.0 active.
  const card1Opacity = !card1Entered
    ? 0
    : phase === "form-active" || phase === "stable"
      ? 1.0
      : 0.55;
  const card1Brightness = !card1Entered
    ? 0.7
    : phase === "form-active" || phase === "stable"
      ? 1.0
      : 0.7;
  const card2Opacity = !card2Entered ? 0 : 1.0;
  const enterOffset = isDesktop ? { x: 80, y: 0 } : { x: 0, y: 40 };
  const card1Anim = !card1Entered ? enterOffset : { x: 0, y: 0 };
  const card2Anim = !card2Entered ? enterOffset : { x: 0, y: 0 };

  const cursorVisible =
    phase === "form-active" && typedText.length < DIRECCION.length;

  // === Card layout styles (responsive vía isDesktop prop) ===
  // bg sólido en ambas: backgroundColor override del gradient transparent de
  // .franco-mockup. El background-image (gradient sutil interno) se preserva.
  const solidBg = "var(--landing-mockup-solid-bg)";
  const card1Style: React.CSSProperties = isDesktop
    ? {
        position: "absolute",
        top: 30,
        right: 220,
        width: 400,
        height: 420,
        padding: "16px 18px",
        backgroundColor: solidBg,
        borderRadius: "14px 0 0 14px",
        borderRight: "none",
        zIndex: 1,
        willChange: "opacity, filter, transform",
      }
    : {
        position: "relative",
        width: "100%",
        padding: 14,
        backgroundColor: solidBg,
        borderRadius: 14,
        marginTop: 24,
        zIndex: 1,
        willChange: "opacity, filter, transform",
      };
  const card2Style: React.CSSProperties = isDesktop
    ? {
        position: "absolute",
        top: 0,
        right: 0,
        width: 440,
        height: 480,
        padding: 22,
        backgroundColor: solidBg,
        borderRadius: "14px 0 0 14px",
        borderRight: "none",
        boxShadow:
          "inset 0 1px 0 0 rgba(255, 255, 255, 0.04), -16px 0 32px -16px rgba(0, 0, 0, 0.6)",
        zIndex: 2,
        willChange: "opacity, transform",
      }
    : {
        position: "relative",
        width: "100%",
        padding: 16,
        backgroundColor: solidBg,
        borderRadius: 14,
        zIndex: 2,
        willChange: "opacity, transform",
      };

  // Wrapper desktop: width 460 (Card 2 ocupa right edge), height 480 (mismo que Card 2).
  const wrapperStyle: React.CSSProperties = isDesktop
    ? { position: "relative", width: 460, height: 480 }
    : { position: "relative", width: "100%" };

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
      {/* CARD 2 · RESULTS — protagonista permanente.
          Renderizada PRIMERO en el DOM para que en mobile flow vertical
          aparezca arriba (asoma above-the-fold). En desktop ambas son
          absolute · z-index decide stacking. */}
      <motion.div
        className="franco-mockup"
        animate={{ opacity: card2Opacity, ...card2Anim }}
        transition={{ duration: 0.6, ease: EASE }}
        style={card2Style}
        aria-label="Mockup resultados"
      >
        <ResultsCard
          scoreCount={scoreCount}
          showBadge={showBadge}
          showLine={showLine}
          showFranco={showFranco}
          activeCards={activeCards}
        />
      </motion.div>

      {/* CARD 1 · FORM — input que se ejecuta · alterna apagada/activa.
          En mobile aparece debajo de Card 2 (segundo en flujo). */}
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
          precioCount={precioCount}
          superficieCount={superficieCount}
          mapStage={mapStage}
        />
      </motion.div>
    </div>
  );
}

/* ===================== Sub-components ===================== */

function HeaderApp({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ height: 28, marginBottom: 12 }}
    >
      <span className="inline-flex items-baseline">
        <span
          className="font-heading italic font-light"
          style={{
            fontSize: 12,
            color: "var(--landing-wm-re)",
            marginRight: "-0.08em",
          }}
        >
          re
        </span>
        <span
          className="font-heading font-bold"
          style={{ fontSize: 12, color: "var(--landing-wm-franco)" }}
        >
          franco
        </span>
        <span
          className="font-body font-semibold text-[#C8323C]"
          style={{ fontSize: 7, marginLeft: 1, letterSpacing: "0.1em" }}
        >
          .ai
        </span>
      </span>
      <span
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em" }}
      >
        {label}
      </span>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ marginBottom: 10 }}>
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 4 }}
      >
        {label}
      </p>
      <div
        style={{
          paddingBottom: 5,
          borderBottom: "0.5px solid var(--landing-divider)",
          minHeight: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FormCard({
  typedText,
  cursorVisible,
  dropdownVisible,
  autocompleteHighlight,
  precioCount,
  superficieCount,
  mapStage,
}: {
  typedText: string;
  cursorVisible: boolean;
  dropdownVisible: boolean;
  autocompleteHighlight: boolean;
  precioCount: number;
  superficieCount: number;
  mapStage: number;
}) {
  return (
    <div>
      <HeaderApp label="Nuevo análisis · 4 comparables" />

      <FormField label="Dirección">
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
          {/* Cursor siempre montado · animate condicional (Phase 2.6e). */}
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
        {dropdownVisible && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute left-0 right-0 z-10"
            style={{
              top: "100%",
              marginTop: 4,
              background: "var(--landing-card-bg)",
              border: "0.5px solid var(--landing-card-border)",
              borderRadius: 6,
              padding: 4,
              boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            }}
          >
            {SUGGESTIONS.map((s, i) => (
              <div
                key={s}
                className="font-body text-[var(--landing-text)]"
                style={{
                  fontSize: 11,
                  padding: "5px 8px",
                  borderRadius: 4,
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
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Precio">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 12 }}
          >
            UF {precioCount > 0 ? precioCount.toLocaleString("es-CL") : "—"}
          </span>
        </FormField>
        <FormField label="Superficie">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 12 }}
          >
            {superficieCount > 0 ? `${superficieCount} m²` : "—"}
          </span>
        </FormField>
      </div>

      <ComparablesMap mapStage={mapStage} />
    </div>
  );
}

function ComparablesMap({ mapStage }: { mapStage: number }) {
  const [imgError, setImgError] = useState(false);

  const mapUrl = getStaticMapUrl({
    lat: MAP_CENTER.lat,
    lng: MAP_CENTER.lng,
    zoom: 16,
    width: MAP_VIEW_W,
    height: MAP_VIEW_H,
    scale: 2,
    theme: "dark",
  });
  const showFallback = !mapUrl || imgError;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: mapStage >= 1 ? 1 : 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      style={{
        position: "relative",
        width: "100%",
        height: MAP_VIEW_H,
        borderRadius: 6,
        overflow: "hidden",
        border: "0.5px solid var(--landing-card-border)",
        background: "var(--landing-map-bg)",
        marginTop: 4,
      }}
    >
      {showFallback ? (
        <div
          className="flex h-full items-center justify-center font-mono uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.12em" }}
        >
          Mapa no disponible
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapUrl}
          alt=""
          loading="eager"
          onError={() => setImgError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          aria-hidden="true"
        />
      )}

      <svg
        viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`}
        width="100%"
        height={MAP_VIEW_H}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        {MAP_PINS_GRAY.map((pin, i) => {
          const visible = mapStage >= 2 + i;
          return (
            <motion.g
              key={pin.id}
              initial={false}
              animate={
                visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }
              }
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <circle
                cx={pin.x}
                cy={pin.y}
                r={3}
                fill="#C8C8C8"
                stroke="#0F0F0F"
                strokeWidth={1.5}
              />
              <PinLabel x={pin.x} y={pin.y - 10} text={pin.value} />
            </motion.g>
          );
        })}

        <motion.g
          initial={false}
          animate={
            mapStage >= 5
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.3 }
          }
          transition={{ duration: 0.4, ease: "backOut" }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {/* Ring siempre montado · animate controlado (Phase 2.6e). */}
          <motion.circle
            cx={MAP_PIN_RED.x}
            cy={MAP_PIN_RED.y}
            fill="none"
            stroke="#C8323C"
            strokeWidth={1.5}
            initial={{ r: 8, opacity: 0 }}
            animate={
              mapStage >= 5
                ? { r: [8, 18], opacity: [0.5, 0] }
                : { r: 8, opacity: 0 }
            }
            transition={
              mapStage >= 5
                ? { duration: 2, repeat: Infinity, ease: "easeOut" }
                : { duration: 0 }
            }
          />
          <circle
            cx={MAP_PIN_RED.x}
            cy={MAP_PIN_RED.y}
            r={4}
            fill="#C8323C"
            stroke="#0F0F0F"
            strokeWidth={2}
          />
          <PinLabel
            x={MAP_PIN_RED.x}
            y={MAP_PIN_RED.y - 12}
            text={MAP_PIN_RED.value}
            accent
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}

function PinLabel({
  x,
  y,
  text,
  accent = false,
}: {
  x: number;
  y: number;
  text: string;
  accent?: boolean;
}) {
  const charW = accent ? 6.2 : 5.6;
  const padX = 4;
  const padY = 2;
  const w = text.length * charW + padX * 2;
  const h = accent ? 13 : 12;
  return (
    <>
      <rect
        x={x - w / 2}
        y={y - h + padY}
        width={w}
        height={h}
        rx={2}
        fill="rgba(15,15,15,0.72)"
      />
      <text
        x={x}
        y={y - 1}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={accent ? 10 : 9}
        fontWeight={accent ? 700 : 500}
        letterSpacing="0.02em"
        fill="#FFFFFF"
      >
        {text}
      </text>
    </>
  );
}

function ResultsCard({
  scoreCount,
  showBadge,
  showLine,
  showFranco,
  activeCards,
}: {
  scoreCount: number;
  showBadge: boolean;
  showLine: boolean;
  showFranco: boolean;
  activeCards: number;
}) {
  return (
    <div>
      <HeaderApp label="Resultado" />

      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 4 }}
      >
        <span className="franco-glow-signal" style={{ display: "inline-block" }}>
          <span
            className="font-heading font-bold leading-none tracking-tight text-[var(--landing-text)]"
            style={{ fontSize: 42 }}
          >
            {scoreCount}
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--landing-text-muted)",
                marginLeft: 2,
              }}
            >
              /100
            </span>
          </span>
        </span>
        <motion.span
          initial={false}
          animate={
            showBadge ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }
          }
          transition={{ duration: 0.3, ease: EASE }}
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            padding: "4px 8px",
            borderRadius: 4,
            background: "#C8323C",
            color: "#FAFAF8",
          }}
        >
          Ajustar supuestos
        </motion.span>
      </div>

      <motion.p
        initial={false}
        animate={showLine ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-heading italic"
        style={{
          fontSize: 13,
          color: "var(--landing-text-muted)",
          marginTop: 6,
          marginBottom: 14,
        }}
      >
        Buena propiedad. Precio incómodo.
      </motion.p>

      <motion.div
        initial={false}
        animate={showFranco ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          borderLeft: "2px solid #C8323C",
          background: "rgba(200,50,60,0.05)",
          padding: "9px 11px",
        }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "#C8323C",
            marginBottom: 3,
          }}
        >
          Siendo franco
        </p>
        <p
          className="font-heading italic text-[var(--landing-text-secondary)]"
          style={{ fontSize: 12, lineHeight: 1.5 }}
        >
          &ldquo;Negocia hasta UF 5.100 y el flujo cuadra. Si no cede, la misma
          plata en Airbnb te da +$180K mensuales — pero requiere que te
          involucres en gestión.&rdquo;
        </p>
      </motion.div>

      <div className="mt-3 flex flex-col gap-2.5">
        {INSIGHT_CARDS.map((card, i) => (
          <motion.div
            key={card.eyebrow}
            initial={false}
            animate={
              activeCards > i
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 12 }
            }
            transition={{ duration: 0.4, ease: EASE }}
          >
            <p
              className="font-mono font-semibold uppercase"
              style={{
                fontSize: 9,
                letterSpacing: "0.08em",
                color: "#C8323C",
                marginBottom: 3,
              }}
            >
              {card.eyebrow}
            </p>
            <p
              className="font-body text-[var(--landing-text-secondary)]"
              style={{ fontSize: 11, lineHeight: 1.45 }}
            >
              {card.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
