"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getStaticMapUrl } from "@/lib/map-styles";

/**
 * Hero mockup como asesor — loop continuo Form → Results (~12s ciclo).
 * F.11 Phase 2.6 v2.
 *
 * Form:
 *   · Dirección con typing char-por-char + autocompletar (3 sugerencias).
 *   · Precio + superficie con counters animados.
 *   · Mapa comparables (200×120, 4 pins, pin central rojo) + caption.
 *
 * Results (reordenado · veredicto primero):
 *   1. Score 61 + badge AJUSTAR + línea italic.
 *   2. Caja Franco (border-left Signal Red).
 *   3. 3 cards UBICACIÓN / PRECIO / FLUJO con stagger.
 *
 * Pausas:
 *   · IntersectionObserver threshold 0.5 → fuera viewport pausa.
 *   · Hover sobre mockup → pausa.
 *   · skipToFinal (scroll fuera del hero) → results-stable estático.
 *   · prefers-reduced-motion → idem.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const TYPING_SPEED_MS = 40;
const DIRECCION = "Av. Pedro de Valdivia 1850, Providencia";

type LoopPhase =
  | "form-empty"
  | "form-typing-address"
  | "form-dropdown-visible"
  | "form-address-selected"
  | "form-counters-filling"
  | "form-map-revealing"
  | "form-submitting"
  | "results-score"
  | "results-franco"
  | "results-cards"
  | "results-stable"
  | "results-fading";

const SUGGESTIONS = [
  "Av. Pedro de Valdivia 1850, Providencia",
  "Av. Pedro de Valdivia 2200, Providencia",
  "Av. Pedro de Valdivia 1234, Providencia",
];

/* Coordenadas del depto ejemplo (Av. Pedro de Valdivia 1850, Providencia)
 * para la Maps Static API + posiciones pixel de los pins sobre el mapa. */
const MAP_CENTER = { lat: -33.4297, lng: -70.6113 };
const MAP_VIEW_W = 332;
const MAP_VIEW_H = 180;
const MAP_PINS_GRAY = [
  { id: "p1", x: 80, y: 60, value: "UF 5.200" },
  { id: "p2", x: 220, y: 80, value: "UF 5.500" },
  { id: "p4", x: 240, y: 130, value: "UF 6.000" },
] as const;
const MAP_PIN_RED = { x: 160, y: 100, value: "UF 5.800" } as const;

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
  skipToFinal = false,
  loopArmed = false,
}: {
  skipToFinal?: boolean;
  loopArmed?: boolean;
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const [phase, setPhase] = useState<LoopPhase>("form-empty");
  const [typedText, setTypedText] = useState("");
  const [autocompleteHighlight, setAutocompleteHighlight] = useState(false);
  const [precioCount, setPrecioCount] = useState(0);
  const [superficieCount, setSuperficieCount] = useState(0);
  // mapStage drives the Maps Static reveal stagger:
  //   0 hidden · 1 container (img + frame visible) · 2 pin1 · 3 pin2
  //   4 pin4 · 5 pin3 red (ring pulses) · 6 caption
  const [mapStage, setMapStage] = useState(0);
  const [buttonPress, setButtonPress] = useState(false);
  const [scoreCount, setScoreCount] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [showFranco, setShowFranco] = useState(false);
  const [activeCards, setActiveCards] = useState(0);

  const showFinalStatic = reduce || skipToFinal;
  const shouldLoop = !showFinalStatic && loopArmed && isVisible && !isHovered;

  // IntersectionObserver — pausa fuera de viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Static final state (reduce-motion / skipToFinal).
  useEffect(() => {
    if (!showFinalStatic) return;
    setPhase("results-stable");
    setTypedText(DIRECCION);
    setPrecioCount(5800);
    setSuperficieCount(58);
    setMapStage(6);
    setScoreCount(61);
    setShowBadge(true);
    setShowLine(true);
    setShowFranco(true);
    setActiveCards(3);
  }, [showFinalStatic]);

  // Loop.
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
      // Reset.
      setPhase("form-empty");
      setTypedText("");
      setAutocompleteHighlight(false);
      setPrecioCount(0);
      setSuperficieCount(0);
      setMapStage(0);
      setButtonPress(false);
      setScoreCount(0);
      setShowBadge(false);
      setShowLine(false);
      setShowFranco(false);
      setActiveCards(0);

      // t=500 cursor enters address field (visual: phase change → field focused via CSS)
      // t=800 typing starts
      T(800, () => {
        setPhase("form-typing-address");
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

      // t=2300 dropdown appears (typing may still continue briefly)
      T(2300, () => {
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        setPhase("form-dropdown-visible");
      });

      // t=2800 highlight first suggestion
      T(2800, () => setAutocompleteHighlight(true));

      // t=3100 click → dropdown closes, address filled
      T(3100, () => {
        setPhase("form-address-selected");
        setTypedText(DIRECCION);
        setAutocompleteHighlight(false);
      });

      // t=3400 counters
      T(3400, () => {
        setPhase("form-counters-filling");
        animateCounter(setPrecioCount, 0, 5800, 700);
        animateCounter(setSuperficieCount, 0, 58, 700);
      });

      // t=4400 map reveal — Maps Static image + SVG pin overlay stagger.
      T(4400, () => {
        setPhase("form-map-revealing");
        setMapStage(1); // container + map img fade-in (300ms)
      });
      T(4900, () => setMapStage(2)); // pin 1 (gray)
      T(5050, () => setMapStage(3)); // pin 2 (gray)
      T(5200, () => setMapStage(4)); // pin 4 (gray)
      T(5400, () => setMapStage(5)); // pin 3 red central + ring pulsing
      T(5900, () => setMapStage(6)); // caption

      // t=6000 submit press
      T(6000, () => {
        setPhase("form-submitting");
        setButtonPress(true);
      });
      T(6150, () => setButtonPress(false));

      // t=6200 crossfade to results
      T(6200, () => setPhase("results-score"));
      // t=6500 score counter
      T(6500, () => animateCounter(setScoreCount, 0, 61, 1200));
      // t=7000 badge
      T(7000, () => setShowBadge(true));
      // t=7300 line
      T(7300, () => setShowLine(true));

      // t=7800 Caja Franco — VEREDICTO PRIMERO
      T(7800, () => {
        setPhase("results-franco");
        setShowFranco(true);
      });

      // Cards stagger.
      T(8600, () => {
        setPhase("results-cards");
        setActiveCards(1);
      });
      T(9100, () => setActiveCards(2));
      T(9600, () => setActiveCards(3));

      // Stable + fade + loop.
      T(10300, () => setPhase("results-stable"));
      T(11500, () => setPhase("results-fading"));
      T(12000, () => runCycle());
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (typingInterval) clearInterval(typingInterval);
      rafIds.forEach(cancelAnimationFrame);
    };
  }, [shouldLoop]);

  const isFormPhase = phase.startsWith("form-");
  const isResultsPhase =
    phase === "results-score" ||
    phase === "results-franco" ||
    phase === "results-cards" ||
    phase === "results-stable";
  const cursorVisible = phase === "form-typing-address";
  const dropdownVisible = phase === "form-dropdown-visible";

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ width: 380, maxWidth: "100%" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="franco-mockup" style={{ height: 620 }}>
        <div className="relative h-full">
          <HeaderApp />

          {/* Form layer */}
          <motion.div
            className="absolute inset-x-0 px-6"
            style={{ top: 50, bottom: 0 }}
            animate={{ opacity: isFormPhase ? 1 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-hidden={!isFormPhase}
          >
            <FormLayer
              typedText={typedText}
              cursorVisible={cursorVisible}
              dropdownVisible={dropdownVisible}
              autocompleteHighlight={autocompleteHighlight}
              precioCount={precioCount}
              superficieCount={superficieCount}
              mapStage={mapStage}
              buttonPress={buttonPress}
            />
          </motion.div>

          {/* Results layer */}
          <motion.div
            className="absolute inset-x-0 px-6"
            style={{ top: 50, bottom: 0 }}
            animate={{ opacity: isResultsPhase ? 1 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            aria-hidden={!isResultsPhase}
          >
            <ResultsLayer
              scoreCount={scoreCount}
              showBadge={showBadge}
              showLine={showLine}
              showFranco={showFranco}
              activeCards={activeCards}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Header app ===================== */

function HeaderApp() {
  return (
    <div
      className="flex items-center justify-between px-6"
      style={{
        height: 46,
        borderBottom: "0.5px solid var(--landing-divider)",
      }}
    >
      <span className="inline-flex items-baseline">
        <span
          className="font-heading italic font-light"
          style={{
            fontSize: 13,
            color: "var(--landing-wm-re)",
            marginRight: "-0.08em",
          }}
        >
          re
        </span>
        <span
          className="font-heading font-bold"
          style={{ fontSize: 13, color: "var(--landing-wm-franco)" }}
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
        className="font-mono text-[var(--landing-text-muted)]"
        style={{ fontSize: 11 }}
        aria-hidden="true"
      >
        ↗
      </span>
    </div>
  );
}

/* ===================== Form layer ===================== */

function FormLayer({
  typedText,
  cursorVisible,
  dropdownVisible,
  autocompleteHighlight,
  precioCount,
  superficieCount,
  mapStage,
  buttonPress,
}: {
  typedText: string;
  cursorVisible: boolean;
  dropdownVisible: boolean;
  autocompleteHighlight: boolean;
  precioCount: number;
  superficieCount: number;
  mapStage: number;
  buttonPress: boolean;
}) {
  return (
    <div className="flex h-full flex-col pt-5">
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.14em", marginBottom: 16 }}
      >
        Nuevo análisis
      </p>

      <FormField label="Dirección">
        <span
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 13 }}
        >
          {typedText ? (
            typedText
          ) : (
            <span style={{ color: "var(--landing-text-muted)" }}>
              Buscar dirección…
            </span>
          )}
          {cursorVisible && (
            <motion.span
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                times: [0, 0.5, 0.5, 1],
              }}
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 1,
                height: 13,
                background: "var(--landing-text)",
                marginLeft: 2,
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </span>
        {dropdownVisible && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute left-0 right-0 z-10"
            style={{
              top: "100%",
              marginTop: 6,
              background: "var(--landing-card-bg)",
              border: "0.5px solid var(--landing-card-border)",
              borderRadius: 6,
              padding: "4px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            }}
          >
            {SUGGESTIONS.map((s, i) => (
              <div
                key={s}
                className="font-body text-[var(--landing-text)]"
                style={{
                  fontSize: 11.5,
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

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FormField label="Precio">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 13 }}
          >
            UF {precioCount > 0 ? precioCount.toLocaleString("es-CL") : "—"}
          </span>
        </FormField>
        <FormField label="Superficie">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 13 }}
          >
            {superficieCount > 0 ? `${superficieCount} m²` : "—"}
          </span>
        </FormField>
      </div>

      {/* Mapa comparables */}
      <div className="mt-5">
        <ComparablesMap mapStage={mapStage} />
      </div>

      {/* Botón Analizar */}
      <div className="mt-auto pb-4">
        <motion.div
          animate={buttonPress ? { scale: 0.95 } : { scale: 1 }}
          transition={{ duration: 0.15, ease: EASE }}
          className="inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-4 py-2"
          style={{ boxShadow: "0 2px 0 rgba(0,0,0,0.08)" }}
        >
          <span
            className="font-mono font-semibold uppercase tracking-[0.08em] text-white"
            style={{ fontSize: 11 }}
          >
            Analizar
          </span>
          <span
            aria-hidden="true"
            className="text-white"
            style={{ fontSize: 11 }}
          >
            →
          </span>
        </motion.div>
      </div>
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
    <div className="relative">
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 9, letterSpacing: "0.14em", marginBottom: 4 }}
      >
        {label}
      </p>
      <div
        style={{
          paddingBottom: 6,
          borderBottom: "0.5px solid var(--landing-divider)",
          minHeight: 22,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ===================== Comparables map (Maps Static + SVG overlay) =====
 * F.11 Phase 2.6c — mapa real de Google Static Maps con dark style
 * (`getStaticMapUrl` reutiliza la paleta de `map-styles.ts`, misma que
 * el drawer zone-insight). Encima, overlay SVG con 4 pins (3 grises +
 * 1 rojo central con ring pulsante).
 *
 * Si la NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está definida o el <img>
 * falla, cae a un fallback "Mapa no disponible" sin bloquear el resto
 * del mockup.
 *
 * Reveal stagger por mapStage 1..6.
 */

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
    <div>
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
        }}
      >
        {/* Capa 1 · mapa real (o fallback) */}
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

        {/* Capa 2 · pins overlay SVG */}
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
          {/* Pins grises */}
          {MAP_PINS_GRAY.map((pin, i) => {
            const visible = mapStage >= 2 + i;
            return (
              <motion.g
                key={pin.id}
                initial={false}
                animate={
                  visible
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.4 }
                }
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
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

          {/* Pin rojo central + ring pulsante */}
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
            {mapStage >= 5 && (
              <motion.circle
                cx={MAP_PIN_RED.x}
                cy={MAP_PIN_RED.y}
                fill="none"
                stroke="#C8323C"
                strokeWidth={1.5}
                initial={{ r: 8, opacity: 0.5 }}
                animate={{ r: 18, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            )}
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

      {/* Caption */}
      <motion.p
        initial={false}
        animate={{ opacity: mapStage >= 6 ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono uppercase text-[var(--landing-text-muted)]"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          marginTop: 8,
        }}
      >
        4 comparables · 280m al metro · Providencia centro
      </motion.p>
    </div>
  );
}

/* Pin label con fondo oscuro semi-transparente para legibilidad sobre
 * el mapa real (cualquier tono). `accent` para el pin rojo: texto blanco
 * bold + bg ligeramente más opaco. */
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
  // Estimate width by char count (~5.5px per char at fontSize 10).
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

/* ===================== Results layer ===================== */

function ResultsLayer({
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
    <div className="flex h-full flex-col pt-4 pb-5">
      {/* Score header */}
      <div className="flex items-baseline justify-between">
        <span
          className="franco-glow-signal"
          style={{ display: "inline-block" }}
        >
          <span
            className="font-heading font-bold leading-none tracking-tight text-[var(--landing-text)]"
            style={{ fontSize: 60 }}
          >
            {scoreCount}
            <span
              className="font-heading"
              style={{ fontSize: 18, color: "var(--landing-text-muted)" }}
            >
              /100
            </span>
          </span>
        </span>
        <motion.span
          initial={false}
          animate={
            showBadge
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.9 }
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
          marginTop: 8,
          marginBottom: 16,
        }}
      >
        Buena propiedad. Precio incómodo.
      </motion.p>

      {/* Caja Franco · VEREDICTO PRIMERO */}
      <motion.div
        initial={false}
        animate={showFranco ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          borderLeft: "2px solid #C8323C",
          background: "rgba(200,50,60,0.04)",
          padding: "10px 12px",
        }}
      >
        <p
          className="font-mono font-semibold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "#C8323C",
            marginBottom: 4,
          }}
        >
          Siendo franco
        </p>
        <p
          className="font-heading italic text-[var(--landing-text-secondary)]"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          &ldquo;Negocia hasta UF 5.100 y el flujo cuadra. Si no cede, la misma
          plata en Airbnb te da +$180K mensuales — pero requiere que te
          involucres en gestión.&rdquo;
        </p>
      </motion.div>

      {/* 3 insight cards */}
      <div className="mt-4 flex flex-col gap-3">
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
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "#C8323C",
                marginBottom: 4,
              }}
            >
              {card.eyebrow}
            </p>
            <p
              className="font-body text-[var(--landing-text-secondary)]"
              style={{ fontSize: 13, lineHeight: 1.45 }}
            >
              {card.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
