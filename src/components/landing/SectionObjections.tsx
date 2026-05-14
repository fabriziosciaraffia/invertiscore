"use client";

import { useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import LandingModal from "./LandingModal";

/**
 * Sección 07 · Lo que vas a pensar — grid de 4 cards con modal al click.
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
    body: "Cruzamos tu caso con propiedades en venta, arriendo largo, datos de Airbnb (ADR y ocupación por zona), estaciones de metro, clínicas, universidades y comercio. 24 comunas del Gran Santiago, actualizado semanal.",
    visualKey: "data",
  },
  {
    n: "02",
    label: "02 · Facilidad",
    quote: "No tengo todos los datos a mano.",
    title: "Pon precio y comuna. Franco completa el resto.",
    body: "Si no sabes el arriendo esperado, los gastos comunes o las contribuciones, Franco usa la mediana real de la zona. Tú confirmas o ajustas si tienes el dato. 5 minutos, veredicto en 30 segundos.",
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
    <section className="relative">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-[14vh] md:py-[16vh]">
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
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      className="mb-[8vh]"
    >
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 24 }}
      >
        07 · Lo que vas a pensar
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ maxWidth: 1100, marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.05 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
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
        Lo que probablemente estás pensando — y la respuesta franca. Click
        para ver el detalle de cada una.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Cards grid ============================ */

function Cards({ onSelect }: { onSelect: (b: Block) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  const reduce = useReducedMotion();

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
      {BLOCKS.map((b, i) => (
        <motion.button
          key={b.n}
          type="button"
          onClick={() => onSelect(b)}
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={
            inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }
          }
          transition={{
            duration: 0.7,
            ease: EASE,
            delay: reduce ? 0 : 0.1 + i * 0.1,
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
      ))}
    </div>
  );
}

/* ============================ Modal content ============================ */

function BlockDetail({ block }: { block: Block }) {
  return (
    <div className="px-7 py-9 md:px-10 md:py-12">
      <span
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(64px, 7vw, 88px)" }}
        aria-hidden="true"
      >
        {block.n}
      </span>

      <p
        className="mt-4 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.16em" }}
      >
        {block.label}
      </p>

      <p
        className="mt-3 font-body italic leading-[1.35] text-[var(--landing-text-muted)]"
        style={{ fontSize: "clamp(18px, 2.2vw, 22px)" }}
      >
        &ldquo;{block.quote}&rdquo;
      </p>

      <h3
        className="mt-4 font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(24px, 3.2vw, 32px)" }}
      >
        {block.title}
      </h3>

      <p
        className="mt-5 max-w-[640px] font-body leading-[1.6] text-[var(--landing-text-secondary)]"
        style={{ fontSize: 16 }}
      >
        {block.body}
      </p>

      <div className="mt-8">
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

function DataCardsGrid() {
  const items: Array<{ label: string; big: string; sub: string }> = [
    { label: "Venta", big: "12.944", sub: "deptos comparables" },
    { label: "Arriendo largo", big: "6.506", sub: "arriendos vivos" },
    { label: "Airbnb", big: "ADR + Occ", sub: "por zona y banda" },
    { label: "Atractores", big: "195+", sub: "metros · POIs · clínicas" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md px-4 py-5"
          style={{
            background: "var(--landing-card-bg-soft)",
            border: "0.5px solid var(--landing-card-border)",
          }}
        >
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{ fontSize: 9, letterSpacing: "0.14em" }}
          >
            {it.label}
          </p>
          <p
            className="mt-2 font-mono font-semibold text-[var(--landing-text)]"
            style={{ fontSize: 20 }}
          >
            {it.big}
          </p>
          <p
            className="mt-1 font-body leading-[1.4] text-[var(--landing-text-muted)]"
            style={{ fontSize: 12 }}
          >
            {it.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

function SmartFormMock() {
  const rows: Array<{ label: string; value: string; tag: "tú" | "Franco" }> = [
    { label: "Precio", value: "UF 5.500", tag: "tú" },
    { label: "Comuna", value: "Providencia", tag: "tú" },
    { label: "Arriendo esperado", value: "$950.000", tag: "Franco" },
    { label: "Gastos comunes", value: "$110.000", tag: "Franco" },
    { label: "Contribuciones", value: "$80.000", tag: "Franco" },
  ];
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
      }}
    >
      <div
        className="px-5 py-3"
        style={{ borderBottom: "0.5px solid var(--landing-card-border)" }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 9, letterSpacing: "0.14em" }}
        >
          Nuevo análisis · paso 1 de 3
        </p>
      </div>
      <div className="p-5">
        <ul className="space-y-3">
          {rows.map((r) => {
            const isFranco = r.tag === "Franco";
            return (
              <li
                key={r.label}
                className="flex items-center gap-3 rounded-md px-4 py-3"
                style={{
                  borderColor: isFranco
                    ? "rgba(200,50,60,0.25)"
                    : "var(--landing-card-border)",
                  borderWidth: "0.5px",
                  borderStyle: "solid",
                  background: isFranco
                    ? "rgba(200,50,60,0.06)"
                    : "var(--landing-card-bg)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                    style={{ fontSize: 9, letterSpacing: "0.14em" }}
                  >
                    {r.label}
                  </p>
                  <p
                    className="mt-1 font-mono font-semibold text-[var(--landing-text)]"
                    style={{ fontSize: 14 }}
                  >
                    {r.value}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-sm px-2 py-1 font-mono font-semibold uppercase"
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.1em",
                    background: isFranco ? "#C8323C" : "var(--landing-card-bg)",
                    color: isFranco ? "#FFFFFF" : "var(--landing-text-muted)",
                  }}
                >
                  {r.tag}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function CostHero() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-6 py-12"
      style={{
        background: "var(--landing-card-bg-soft)",
        border: "0.5px solid var(--landing-card-border)",
      }}
    >
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(80px, 12vw, 120px)" }}
      >
        $0
      </p>
      <p
        className="mt-5 font-mono font-semibold uppercase text-[var(--landing-text)]"
        style={{ fontSize: 11, letterSpacing: "0.16em" }}
      >
        Primer análisis
      </p>
      <p
        className="mt-2 font-mono font-medium uppercase text-[var(--landing-text-muted)]"
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
    <div className="space-y-3">
      {items.map((it) => (
        <div
          key={it.verb}
          className="rounded-r-md py-3 pl-4 pr-4"
          style={{
            borderLeft: "2px solid #C8323C",
            background: "var(--landing-card-bg-soft)",
          }}
        >
          <p
            className="font-body leading-[1.55] text-[var(--landing-text-secondary)]"
            style={{ fontSize: 14 }}
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
