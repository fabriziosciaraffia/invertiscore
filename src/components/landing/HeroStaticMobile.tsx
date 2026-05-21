"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
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
 * Hero mockup · MOBILE-ONLY (F.11 Phase 2.13 · animación + loop reintroducidos).
 *
 * Animación con máximas salvaguardas Phase 2.6e/f (anti NotFoundError iOS):
 *   · framer-motion solo en outer wrappers de cada card · never on inner content
 *   · always-mounted motion.div · animate condicional opacity/filter/x
 *   · NO {cond && <motion>} · NO AnimatePresence
 *   · useInView con once:false para pausar fuera de viewport + cleanup
 *   · prefers-reduced-motion → estado final estático directo
 *
 * Loop ~8s (Card 1 sola → Card 2 entra → ambas visibles → Card 2 sale):
 *   t=0       Card 1 entra (fade-in alone, opacity full)
 *   t=1500    Card 2 entra (slide-in + fade), Card 1 transita a dim
 *   t=1500-6500   ambas visibles (Card 2 frente, Card 1 dim atrás)
 *   t=6500    Card 2 sale (fade-out), Card 1 vuelve a brillar
 *   t=8000    runCycle → próximo iteración
 *
 * Contenido = estado final estático de Step01 y Step03 de s04 (sin counters
 * internos para minimizar superficie de fallo).
 */

/* ===================== Helpers compartidos ===================== */

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

/* ===================== Layout shell con animación + loop ===================== */

const EASE = [0.215, 0.61, 0.355, 1] as const;

export default function HeroStaticMobile() {
  const reduce = useReducedMotion();
  const isLight = useIsLight();
  const containerRef = useRef<HTMLDivElement>(null);

  // useInView con margin px (Phase 2.6g · compat Safari iOS).
  // once:false permite que el loop pause cuando salga del viewport y resuma
  // al volver — pero solo togglea estado bool, no monta/desmonta.
  const isInView = useInView(containerRef, {
    once: false,
    margin: "-50px 0px -50px 0px",
  });

  // Estado animación · always-mounted, solo togglea via state.
  const [card1Entered, setCard1Entered] = useState(!!reduce);
  const [showCard2, setShowCard2] = useState(!!reduce);

  // Entry inicial Card 1 (solo una vez, no se repite).
  useEffect(() => {
    if (reduce) {
      setCard1Entered(true);
      setShowCard2(true);
      return;
    }
    const t = setTimeout(() => setCard1Entered(true), 400);
    return () => clearTimeout(t);
  }, [reduce]);

  // Loop · solo corre cuando isInView=true Y card1 entró.
  // Cleanup: flag mounted + clearTimeout en cada timer.
  useEffect(() => {
    if (reduce) return;
    if (!isInView || !card1Entered) return;

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const T = (offset: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (mounted) fn();
        }, offset),
      );
    };

    const runCycle = () => {
      setShowCard2(false);
      // Card 1 sola 2500ms (más tiempo para apreciar el centrado + slide).
      T(2500, () => setShowCard2(true));
      T(7000, () => setShowCard2(false));
      T(8500, runCycle);
    };

    runCycle();

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [reduce, isInView, card1Entered]);

  // Dim values theme-aware.
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
  // Phase 2.13 · Card 1 parte centrada → mueve a su pos cuando Card 2 entra.
  // translateX más generoso (50px) para que el slide sea claramente visible
  // en mobile narrow. Entry desde x:60 (slide-in derecha) → x:50 (centrada)
  // → x:0 (final cuando Card 2 entra).
  const card1X = !card1Entered ? 60 : showCard2 ? 0 : 50;
  const card2Opacity = showCard2 ? 1.0 : 0;
  const card2X = showCard2 ? 0 : 24;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: 570,
        marginTop: 16,
        marginBottom: 64,
        overflow: "visible",
      }}
    >
      {/* CARD 1 · FORM (atrás · entra primero centrada, dim cuando Card 2 entra) */}
      <FormCardStatic
        opacity={card1Opacity}
        brightness={card1Brightness}
        translateX={card1X}
      />
      {/* CARD 2 · RESULTS (frente · entra después con slide + fade) */}
      <ResultsCardStatic opacity={card2Opacity} translateX={card2X} />
    </div>
  );
}

/* ===================== Card 1 · Form estático (Step01 final) ===================== */

function FormCardStatic({
  opacity,
  brightness,
  translateX,
}: {
  opacity: number;
  brightness: number;
  translateX: number;
}) {
  const isLight = useIsLight();
  return (
    <motion.div
      className="franco-mockup"
      initial={false}
      animate={{ opacity, filter: `brightness(${brightness})`, x: translateX }}
      transition={{ duration: 0.8, ease: EASE }}
      style={{
        position: "absolute",
        top: 0,
        left: 12,
        width: "72%",
        height: 420,
        padding: 14,
        backgroundColor: "var(--landing-mockup-solid-bg)",
        borderRadius: 22,
        zIndex: 1,
        willChange: "opacity, filter, transform",
        // isLight retained to keep theme-aware reference for future fields;
        // current props handle the dim driven by parent state.
        ...(isLight ? {} : {}),
      }}
    >
      <HeaderApp label="Nuevo análisis" />

      {/* Dirección · con dropdown autocomplete in-flow seleccionado */}
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
            style={{ fontSize: 12 }}
          >
            Av. Manuel Montt 1234, Providencia
          </span>
        </div>
        <div
          style={{
            marginTop: 4,
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 5,
            padding: 3,
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
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
            style={{ fontSize: 11, padding: "4px 6px", borderRadius: 3 }}
          >
            Av. Manuel Montt 1250, Providencia, Chile
          </div>
        </div>
      </div>

      {/* Tipo · chips USADO (outline Signal Red) / NUEVO (inactivo Ink) */}
      <div style={{ marginBottom: 10 }}>
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
      </div>

      {/* Grid Precio (con UF/CLP toggle) + Superficie */}
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
              className="font-mono font-medium text-[var(--landing-text)]"
              style={{ fontSize: 12 }}
            >
              60 m²
            </span>
          </div>
        </div>
      </div>

      {/* Mapa real WebP · theme-aware */}
      <div
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
      </div>

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
    </motion.div>
  );
}

/* ===================== Card 2 · Results estático (Step03 final) ===================== */

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

function ResultsCardStatic({
  opacity,
  translateX,
}: {
  opacity: number;
  translateX: number;
}) {
  const netoPoints = NETO.map(
    (v, i) => `${barX(i) + BAR_W / 2},${v2y(v)}`,
  ).join(" ");

  return (
    <motion.div
      className="franco-mockup"
      initial={false}
      animate={{ opacity, x: translateX }}
      transition={{ duration: 0.8, ease: EASE }}
      style={{
        position: "absolute",
        top: 70,
        right: 12,
        willChange: "opacity, transform",
        width: "78%",
        height: 500,
        padding: 12,
        backgroundColor: "var(--landing-mockup-solid-bg)",
        borderRadius: 22,
        boxShadow:
          "inset 0 1px 0 0 rgba(255, 255, 255, 0.04), -16px 0 32px -16px rgba(0, 0, 0, 0.6)",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <HeaderApp label="Completado" />

      {/* Hero veredicto */}
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
        <div
          className="flex items-center"
          style={{ gap: 5, marginBottom: 6 }}
        >
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
          <span
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
          </span>
        </div>

        {/* Score + tracker row */}
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
            61
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                height: 3,
                background: "linear-gradient(to right, #C8323C 0%, #B4B2A9 100%)",
                borderRadius: 1.5,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "61%",
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
            <div
              style={{
                position: "relative",
                height: 10,
                marginTop: 3,
              }}
            >
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

      {/* Cita italic Sans */}
      <p
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
      </p>

      {/* Caja Franco · border-left 3px Signal Red, esquinas izq cuadradas */}
      <div
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
      </div>

      {/* Grid 2x2 mini-cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 5,
          marginBottom: 7,
        }}
      >
        <MiniCard
          eyebrow="02 · Costo mensual"
          value="−$310K"
          valueColor="#C8323C"
          sublabel="Flujo de bolsillo"
        />
        <MiniCard
          eyebrow="03 · Negociación"
          value="UF 4.900"
          valueColor="var(--landing-text)"
          sublabel="Precio sugerido"
        />
        <MiniCard
          eyebrow="04 · Largo plazo"
          value="+UF 1.450"
          valueColor="var(--landing-text)"
          sublabel="Plusvalía 10 años"
        />
        <MiniCard
          eyebrow="05 · Riesgos"
          value="3 medios"
          valueColor="var(--landing-text)"
          sublabel="Vacancia · tasa · m²"
        />
      </div>

      {/* Bloque Patrimonio */}
      <div
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
            return (
              <g key={`bar-${i}`}>
                <rect x={x} y={aporteY} width={BAR_W} height={aporteH} fill="#C8323C" />
                <rect
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
            points={netoPoints}
            fill="none"
            stroke="var(--landing-text)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {NETO.map((v, i) => (
            <circle
              key={`dot-${i}`}
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
      </div>
    </motion.div>
  );
}

function MiniCard({
  eyebrow,
  value,
  valueColor,
  sublabel,
}: {
  eyebrow: string;
  value: string;
  valueColor: string;
  sublabel: string;
}) {
  return (
    <div
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
    </div>
  );
}
