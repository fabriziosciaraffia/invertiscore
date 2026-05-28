"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import LandingModal from "./LandingModal";
import SectionGhostNumber from "./SectionGhostNumber";

/**
 * Sección 07 · Garantías — grid de 4 cards con modal al click.
 *
 * - Header gigante 56-72px scroll-driven (mismo patrón que s02).
 * - 4 cards en grid 2x2 (1 col mobile).
 * - Click en card → modal con título, body y visual completo.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Block = {
  n: "01" | "02" | "03" | "04";
  label: string;
  quote: string;
  title: string;
  body: string;
  visualKey: "data" | "form" | "cost" | "ai";
};

const BLOCKS: ReadonlyArray<Block> = [
  {
    n: "01",
    label: "01 · Datos",
    quote: "¿De dónde sacan los números?",
    title: "Del mercado real, no de promedios.",
    body: "Comparamos tu departamento con información real de propiedades en venta, arriendos de largo plazo y datos en línea de Airbnb. Además, interpretamos atractores de demanda como cercanía a estaciones de metro, clínicas, universidades y comercio. 24 comunas del Gran Santiago, actualizado semanalmente.",
    visualKey: "data",
  },
  {
    n: "02",
    label: "02 · Facilidad",
    quote: "No tengo todos los datos a mano.",
    title: "Pones dos datos. Lo lees sin saber de finanzas.",
    body: "No necesitas saber de finanzas ni tener todos los números. Franco completa con datos reales de la zona y te explica el resultado en palabras simples.",
    visualKey: "form",
  },
  {
    n: "03",
    label: "03 · Costo",
    quote: "¿Cuánto cuesta?",
    title: "Lo que cuestan dos cafés.",
    body: "Y el primero es gratis, sin tarjeta. Antes de firmar 25 años de hipoteca, el costo se paga solo. Ahorrarte un error de compra equivale a miles de análisis.",
    visualKey: "cost",
  },
  {
    n: "04",
    label: "04 · IA",
    quote: "Y si no conviene, ¿qué hago?",
    title: "Franco interpreta con IA, no solo calcula.",
    body: "No es una calculadora — es un asesor. La IA identifica el problema real y propone alternativas concretas: hasta dónde negociar, cómo reestructurar el financiamiento, qué modalidad de arriendo optimiza el flujo, qué riesgos vigilar.",
    visualKey: "ai",
  },
];

export default function SectionObjections() {
  const [active, setActive] = useState<Block | null>(null);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--franco-bg-alt)" }}
    >
      <SectionGhostNumber number="07" side="left" top="clamp(140px, 18vh, 240px)" />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 py-[14vh] md:py-[16vh]">
        <ObjectionsHeader />
        <Cards onSelect={setActive} />
      </div>

      <LandingModal
        open={!!active}
        onClose={() => setActive(null)}
        ariaLabel={active ? active.label : "Detalle de objeción"}
      >
        {active && <BlockDetail block={active} />}
      </LandingModal>
    </section>
  );
}

/* ============================ Header ============================ */

function ObjectionsHeader() {
  const reduce = useReducedMotion();
  const lines = ["Cuatro razones para confiar", "antes de hacer click."];

  const lineVariant = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.75,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.15,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px 0px -100px 0px" }}
      className="mb-[8vh]"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-hidden="true"
        style={{
          width: 24,
          height: 1,
          background: "rgba(200, 50, 60, 0.6)",
          marginBottom: 16,
        }}
      />
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 24 }}
      >
        07 · Garantías
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.1] tracking-[-0.015em] text-[var(--landing-text)]"
        style={{ maxWidth: 1100, marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.1 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)" }}
              variants={lineVariant(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
        className="max-w-[680px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 17, lineHeight: 1.55 }}
      >
        Lo que probablemente estás pensando — y la respuesta franca.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Cards grid ============================ */

function Cards({ onSelect }: { onSelect: (b: Block) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px 0px -50px 0px" });
  const reduce = useReducedMotion();

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
      {BLOCKS.map((b, i) => {
        // Alternar entrada lateral: índices pares (0,2) entran desde la
        // izquierda con rotate -3°; impares (1,3) desde la derecha con +3°.
        const fromLeft = i % 2 === 0;
        const initialX = fromLeft ? -120 : 120;
        const initialRot = fromLeft ? -3 : 3;
        return (
          <motion.button
            key={b.n}
            type="button"
            onClick={() => onSelect(b)}
            initial={
              reduce ? false : { opacity: 0, x: initialX, rotate: initialRot }
            }
            animate={
              inView || reduce
                ? { opacity: 1, x: 0, rotate: 0 }
                : { opacity: 0, x: initialX, rotate: initialRot }
            }
            transition={{
              duration: 0.8,
              ease: EASE,
              delay: reduce ? 0 : 0.1 + i * 0.15,
            }}
          className="group relative flex flex-col gap-5 rounded-2xl p-7 text-left transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 md:flex-row md:items-start md:gap-7 md:p-9"
          style={{
            background: "var(--landing-card-bg)",
            border: "0.5px solid var(--landing-card-border)",
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.04), 0 12px 24px -16px rgba(0,0,0,0.18)",
          }}
        >
          <span
            className="font-heading font-bold leading-[0.85] tracking-[-0.04em] text-[#C8323C]"
            style={{ fontSize: "clamp(56px, 6vw, 80px)", flexShrink: 0 }}
            aria-hidden="true"
          >
            {b.n}
          </span>

          <div className="flex flex-1 flex-col">
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{ fontSize: 10, letterSpacing: "0.16em" }}
            >
              {b.label}
            </p>
            <p
              className="mt-2 font-body italic leading-[1.4] text-[var(--landing-text-muted)]"
              style={{ fontSize: 15 }}
            >
              &ldquo;{b.quote}&rdquo;
            </p>
            <h3
              className="mt-3 font-heading font-bold leading-[1.2] tracking-[-0.005em] text-[var(--landing-text)]"
              style={{ fontSize: "clamp(18px, 2vw, 22px)" }}
            >
              {b.title}
            </h3>

            <div className="mt-5">
              <span
                className="inline-flex items-center gap-2 font-mono font-semibold uppercase text-[#C8323C] transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ fontSize: 11, letterSpacing: "0.12em" }}
              >
                Leer más
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </motion.button>
        );
      })}
    </div>
  );
}

/* ============================ Modal content ============================ */

function BlockDetail({ block }: { block: Block }) {
  return (
    <div className="px-7 py-9 md:px-8 md:py-8">
      <span
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(44px, 4.5vw, 56px)" }}
        aria-hidden="true"
      >
        {block.n}
      </span>

      <p
        className="mt-3 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        {block.label}
      </p>

      <p
        className="mt-3 font-body italic leading-[1.35] text-[var(--landing-text-muted)]"
        style={{ fontSize: "clamp(16px, 1.9vw, 19px)" }}
      >
        &ldquo;{block.quote}&rdquo;
      </p>

      <h3
        className="mt-3 font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(20px, 2.6vw, 26px)" }}
      >
        {block.title}
      </h3>

      <p
        className="mt-4 max-w-[560px] font-body leading-[1.5] text-[var(--landing-text-secondary)]"
        style={{ fontSize: 14 }}
      >
        {block.body}
      </p>

      <div className="mt-6">
        <VisualSlot which={block.visualKey} />
      </div>
    </div>
  );
}

/* ============================ Visual slot (preservado de F.6) ============================ */

function VisualSlot({ which }: { which: Block["visualKey"] }) {
  if (which === "data") return <DataCardsGrid />;
  if (which === "form") return <SmartFormMock />;
  if (which === "cost") return <CostHero />;
  return <AIRecommendations />;
}

type Kpi = { label: string; big: string; sub: string; tip: string };

/* Detecta si el dispositivo soporta hover real (mouse fino). En touch
 * devuelve false → el tooltip se controla por tap en lugar de hover. */
function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setCanHover(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return canHover;
}

const KPIS: ReadonlyArray<Kpi> = [
  {
    label: "Venta",
    big: "12.944",
    sub: "departamentos comparables en venta",
    tip: "Base de propiedades publicadas en venta que cruzamos para estimar precio justo de mercado por zona y características.",
  },
  {
    label: "Renta larga (arriendo tradicional)",
    big: "6.506",
    sub: "arriendos activos en zona",
    tip: "Departamentos efectivamente arrendados o publicados en arriendo de largo plazo, usados para calcular el arriendo de mercado realista por zona.",
  },
  {
    label: "Renta corta (Airbnb)",
    big: "ADR + Ocupación",
    sub: "tarifa diaria y ocupación por zona",
    tip: "ADR (Average Daily Rate) es la tarifa promedio por noche; ocupación es el % de días arrendados al mes. Datos en línea segmentados por zona y tipo de propiedad.",
  },
  {
    label: "Entorno",
    big: "195+",
    sub: "metros, clínicas, universidades, comercio",
    tip: "Lugares cercanos que generan demanda estable: estaciones de metro, clínicas, universidades, malls, instituciones. Cada uno aporta al perfil de demanda de la zona.",
  },
];

function DataCardsGrid() {
  const canHover = useCanHover();
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {KPIS.map((it, i) => (
        <KpiTile
          key={it.label}
          item={it}
          rowTop={i < 2}
          colLeft={i % 2 === 0}
          canHover={canHover}
        />
      ))}
    </div>
  );
}

/* Tile KPI con tooltip de ayuda. Patrón SAFE: tooltip always-mounted con
 * animate condicional opacity + pointerEvents (no {cond && <Tooltip>} ni
 * AnimatePresence). Hover en desktop, tap-toggle en touch (tap fuera cierra).
 * Auto-flip por fila (top row → abajo, bottom row → arriba) y por columna
 * (izq → left:0, der → right:0) para no salirse del modal. */
function KpiTile({
  item,
  rowTop,
  colLeft,
  canHover,
}: {
  item: Kpi;
  rowTop: boolean;
  colLeft: boolean;
  canHover: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);

  // Tap fuera cierra (relevante en touch).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (tileRef.current && !tileRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const hoverHandlers = canHover
    ? {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
      }
    : {};

  return (
    <div
      ref={tileRef}
      className="relative rounded-md px-3 py-3.5"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
        // Eleva el tile abierto sobre sus hermanos para que el tooltip no
        // quede tapado por la fila siguiente.
        zIndex: open ? 30 : "auto",
      }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          {item.label}
        </p>
        <button
          type="button"
          aria-label={`Qué significa ${item.label}`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          {...hoverHandlers}
          // Área clickeable 24×24 (padding 4 + círculo 16) sin desplazar el
          // layout (margin negativo compensa el padding).
          className="inline-flex shrink-0 items-center justify-center"
          style={{
            padding: 4,
            margin: -4,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            lineHeight: 0,
          }}
        >
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center font-mono transition-colors duration-150"
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              border: `0.5px solid ${
                open ? "#C8323C" : "var(--landing-card-border)"
              }`,
              color: open ? "#C8323C" : "var(--landing-text-muted)",
              fontSize: 9,
              lineHeight: 1,
            }}
          >
            ?
          </span>
        </button>
      </div>

      <p
        className="mt-1.5 font-mono font-semibold leading-[1.1] text-[var(--landing-text)]"
        style={{ fontSize: 18 }}
      >
        {item.big}
      </p>
      <p
        className="mt-1 font-body leading-[1.4] text-[var(--landing-text-muted)]"
        style={{ fontSize: 11 }}
      >
        {item.sub}
      </p>

      {/* Tooltip · always-mounted */}
      <motion.div
        role="tooltip"
        aria-hidden={!open}
        initial={false}
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : rowTop ? -4 : 4 }}
        transition={{ duration: 0.15, ease: EASE }}
        style={{
          position: "absolute",
          ...(rowTop
            ? { top: "calc(100% + 8px)" }
            : { bottom: "calc(100% + 8px)" }),
          ...(colLeft ? { left: 0 } : { right: 0 }),
          width: "max-content",
          maxWidth: 240,
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderRadius: 8,
          padding: "10px 12px",
          boxShadow: "0 8px 24px -12px rgba(0,0,0,0.45)",
          zIndex: 60,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <span
          className="font-body text-[var(--landing-text-muted)]"
          style={{ fontSize: 12, lineHeight: 1.45, display: "block" }}
        >
          {item.tip}
        </span>
      </motion.div>
    </div>
  );
}

/* Visual Card 02 "Facilidad" · grid 2-col "TÚ PONES" / "FRANCO COMPLETA"
 * + remate Sans italic con cita. Reemplaza al viejo form mock 5-filas
 * (más alto que el resto). Versión horizontal compacta: 2 inputs del
 * usuario + 4 cosas que rellena Franco, cerrando con la promesa de
 * lenguaje claro (sin jerga financiera). */
function SmartFormMock() {
  const tuPones = ["Precio del depto", "Comuna"];
  const francoCompleta = [
    "Arriendo de la zona",
    "Gastos comunes",
    "Contribuciones SII",
    "Datos Airbnb",
  ];

  return (
    <div>
      {/* Grid 2-col · TÚ PONES / FRANCO COMPLETA */}
      <div className="grid grid-cols-2 gap-3">
        {/* Columna izq · TÚ PONES */}
        <div
          style={{
            background: "var(--landing-card-bg-soft)",
            border: "0.5px solid var(--landing-card-border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.12em", marginBottom: 12 }}
          >
            Tú pones
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {tuPones.map((it) => (
              <li
                key={it}
                className="flex items-start"
                style={{ gap: 8, marginBottom: 8 }}
              >
                <span
                  aria-hidden="true"
                  style={{ color: "#C8323C", fontSize: 11, lineHeight: 1.4 }}
                >
                  ✓
                </span>
                <span
                  className="font-body text-[var(--landing-text)]"
                  style={{ fontSize: 13, lineHeight: 1.4 }}
                >
                  {it}
                </span>
              </li>
            ))}
          </ul>
          <div
            style={{
              borderTop: "0.5px solid var(--landing-card-border)",
              marginTop: 10,
              paddingTop: 10,
            }}
          >
            <p
              className="font-mono uppercase text-[var(--landing-text-muted)] m-0"
              style={{ fontSize: 10, letterSpacing: "0.08em" }}
            >
              2 datos · 30 segundos
            </p>
          </div>
        </div>

        {/* Columna der · FRANCO COMPLETA · border-left 3px Signal Red */}
        <div
          style={{
            background: "var(--landing-card-bg-soft)",
            border: "0.5px solid var(--landing-card-border)",
            borderLeft: "3px solid #C8323C",
            borderRadius: "0 10px 10px 0",
            padding: 16,
          }}
        >
          <p
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "#C8323C",
              marginBottom: 12,
            }}
          >
            Franco completa
          </p>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {francoCompleta.map((it) => (
              <li
                key={it}
                className="font-body text-[var(--landing-text)]"
                style={{ fontSize: 12.5, lineHeight: 1.35 }}
              >
                {it}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Remate · "MISMO DATO, SIN LA JERGA" con ✓ versión clara vs ✕ versión
       * en jerga financiera (line-through) · enfatiza el contraste de
       * lenguaje · refuerza la promesa de Card 02 "lo lees sin saber de
       * finanzas". */}
      <div
        style={{
          background: "rgba(200,50,60,0.05)",
          border: "0.5px solid rgba(200,50,60,0.15)",
          borderRadius: 8,
          padding: "14px 16px",
          marginTop: 14,
        }}
      >
        <p
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 8,
            letterSpacing: "0.14em",
            color: "#C8323C",
            margin: "0 0 8px 0",
          }}
        >
          Mismo dato, sin la jerga
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* ✓ versión clara */}
          <div className="flex items-start" style={{ gap: 8 }}>
            <span
              aria-hidden="true"
              style={{ color: "#C8323C", fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}
            >
              ✓
            </span>
            <span
              className="font-body text-[var(--landing-text)]"
              style={{ fontSize: 13.5, lineHeight: 1.4 }}
            >
              &ldquo;Pones{" "}
              <span className="font-mono">$310.000</span> de tu bolsillo cada mes&rdquo;
            </span>
          </div>
          {/* ✕ versión jerga tachada */}
          <div className="flex items-start" style={{ gap: 8 }}>
            <span
              aria-hidden="true"
              style={{ color: "#666", fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}
            >
              ✕
            </span>
            <span
              className="font-body text-[var(--landing-text-muted)]"
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                textDecoration: "line-through",
                textDecorationColor: "rgba(255,255,255,0.2)",
              }}
            >
              &ldquo;Cap rate 4,2% con NOI mensual negativo&rdquo;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostHero() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-6 py-9"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
      }}
    >
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(56px, 8vw, 84px)" }}
      >
        $0
      </p>
      <p
        className="mt-4 font-mono font-semibold uppercase text-[var(--landing-text)]"
        style={{ fontSize: 11, letterSpacing: "0.16em" }}
      >
        Primer análisis
      </p>
      <p
        className="mt-1.5 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.14em" }}
      >
        Sin tarjeta · sin compromiso
      </p>
    </div>
  );
}

function AIRecommendations() {
  const items = [
    { verb: "Negocia", body: "Hasta UF 4.900. Argumento: el precio/m² está 11% sobre la mediana de zona." },
    { verb: "Reestructura", body: "Sube pie a 30% o extiende plazo a 30 años. Los números empiezan a cuadrar." },
    { verb: "Opera", body: "En Airbnb. Rinde $148K/mes más que arriendo tradicional en esta zona." },
    { verb: "Vigila", body: "3 riesgos detectados: vacancia mayor a la zona, gasto común alto, tope de aporte." },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.verb}
          className="rounded-r-md py-2.5 pl-3 pr-3"
          style={{
            borderLeft: "2px solid #C8323C",
            background: "var(--landing-card-bg-soft)",
          }}
        >
          <p
            className="font-body leading-[1.45] text-[var(--landing-text-secondary)]"
            style={{ fontSize: 13.5 }}
          >
            <span
              className="font-mono font-semibold uppercase text-[#C8323C]"
              style={{ fontSize: 10, letterSpacing: "0.14em" }}
            >
              {it.verb}
            </span>
            <span className="ml-2 font-body italic">{it.body}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
