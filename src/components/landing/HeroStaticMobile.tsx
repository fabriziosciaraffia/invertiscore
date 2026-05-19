"use client";

import { getStaticMapUrl } from "@/lib/map-styles";
import { useEffect, useState } from "react";

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
 * Hero static mockup · MOBILE-ONLY (F.11 Phase 2.7 Etapa 6).
 *
 * SIN framer-motion · SIN AnimatePresence · SIN useInView. Solo divs
 * con CSS estático. Evita el NotFoundError iOS WebKit que afectaba al
 * componente animado (Phase 2.6 series no lo resolvieron).
 *
 * Layout estilo Linear · 2 cards SUPERPUESTAS (no apiladas):
 *   · Container relative con height fijo ~380px, ambas cards absolute.
 *   · CARD 1 · Form (atrás) — top:0, left:-16px (asoma izq), dim
 *     permanente (opacity 0.55 + brightness 0.7), z-index 1.
 *   · CARD 2 · Results (frente) — top:80px, right:-16px (asoma der),
 *     overlap con Card 1, opacity 1, z-index 2.
 *   · Bottom de cards corta con viewport · invita al scroll para ver el
 *     contenido completo.
 *
 * Above-the-fold (390x844):
 *   · Copy compacto (eyebrow + H1 reducido + subhead + CTA) ~360-400px
 *   · Card 1 + Card 2 superpuestas asomando ~40% visible cada una
 *
 * Contenido = estado final del cycle de HeroAnimatedDesktop:
 *   · Form: dirección, precio, superficie, mapa con 4 pins (sin pulsing)
 *   · Results: score 61, badge AJUSTAR SUPUESTOS, línea italic, caja
 *     Franco con cita, 3 cards UBICACIÓN/PRECIO/FLUJO.
 */

const DIRECCION = "Av. Pedro de Valdivia 1850, Providencia";

const MAP_CENTER = { lat: -33.4297, lng: -70.6113 };
const MAP_VIEW_W = 320;
const MAP_VIEW_H = 80;
const MAP_PINS_GRAY = [
  { id: "p1", x: 70, y: 28, value: "UF 5.200" },
  { id: "p2", x: 220, y: 22, value: "UF 5.500" },
  { id: "p4", x: 250, y: 56, value: "UF 6.000" },
] as const;
const MAP_PIN_RED = { x: 150, y: 44, value: "UF 5.800" } as const;

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

export default function HeroStaticMobile() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 560,
        marginTop: 16,
        marginBottom: 80,
        overflow: "visible",
      }}
    >
      {/* CARD 1 · FORM (atrás · dim permanente · asoma izq) */}
      <FormCardStatic />
      {/* CARD 2 · RESULTS (frente · protagonista · asoma der) */}
      <ResultsCardStatic />
    </div>
  );
}

/* ===================== Card 1 · Form (estático) ===================== */

function FormCardStatic() {
  const isLight = useIsLight();
  return (
    <div
      className="franco-mockup"
      style={{
        position: "absolute",
        top: 0,
        left: 12,
        width: "72%",
        height: 480,
        padding: 14,
        backgroundColor: "var(--landing-mockup-solid-bg)",
        borderRadius: 22,
        opacity: isLight ? 0.72 : 0.55,
        filter: isLight ? "none" : "brightness(0.7)",
        zIndex: 1,
      }}
    >
      <HeaderApp label="Nuevo análisis · 4 comparables" />

      <FormField label="Dirección">
        <span
          className="font-body text-[var(--landing-text)]"
          style={{ fontSize: 12 }}
        >
          {DIRECCION}
        </span>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Precio">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 12 }}
          >
            UF 5.800
          </span>
        </FormField>
        <FormField label="Superficie">
          <span
            className="font-mono font-medium text-[var(--landing-text)]"
            style={{ fontSize: 12 }}
          >
            58 m²
          </span>
        </FormField>
      </div>

      <StaticMap />
    </div>
  );
}

/* ===================== Card 2 · Results (estático) ===================== */

function ResultsCardStatic() {
  return (
    <div
      className="franco-mockup"
      style={{
        position: "absolute",
        top: 80,
        right: 12,
        width: "78%",
        height: 480,
        padding: 16,
        backgroundColor: "var(--landing-mockup-solid-bg)",
        borderRadius: 22,
        boxShadow:
          "inset 0 1px 0 0 rgba(255, 255, 255, 0.04), -16px 0 32px -16px rgba(0, 0, 0, 0.6)",
        zIndex: 2,
      }}
    >
      <HeaderApp label="Resultado" />

      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 4 }}
      >
        <span
          className="franco-glow-signal"
          style={{ display: "inline-block" }}
        >
          <span
            className="font-heading font-bold leading-none tracking-tight text-[var(--landing-text)]"
            style={{ fontSize: 42 }}
          >
            61
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
        <span
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
        </span>
      </div>

      <p
        className="font-heading italic"
        style={{
          fontSize: 13,
          color: "var(--landing-text-muted)",
          marginTop: 6,
          marginBottom: 14,
        }}
      >
        Buena propiedad. Precio incómodo.
      </p>

      <div
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
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {INSIGHT_CARDS.map((card) => (
          <div key={card.eyebrow}>
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
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Shared sub-components ===================== */

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

/* ===================== Mapa estático (sin animations) ===================== */

function StaticMap() {
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
    <div
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
        {MAP_PINS_GRAY.map((pin) => (
          <g key={pin.id}>
            <circle
              cx={pin.x}
              cy={pin.y}
              r={3}
              fill="#C8C8C8"
              stroke="#0F0F0F"
              strokeWidth={1.5}
            />
            <PinLabel x={pin.x} y={pin.y - 10} text={pin.value} />
          </g>
        ))}

        {/* Pin rojo central · sin ring pulsante */}
        <g>
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
        </g>
      </svg>
    </div>
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
