"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";
import SectionHeader from "./SectionHeader";

/**
 * Sección 06 · Objeciones — fondo Ink 900.
 * 3 modos:
 * - Desktop + motion OK → sticky scroll narrativo 400vh (4 bloques con
 *   numeral fantasma 320px Signal Red 0.06 que cambia 01→04 alternando lado).
 * - Mobile               → acordeón vertical (una abierta a la vez,
 *   primera expandida por defecto).
 * - prefers-reduced-motion → stack vertical (layout original).
 */

type BlockDef = {
  n: "01" | "02" | "03" | "04";
  label: string;
  quote: string;
  title: string;
  body: string;
  ghostSide: "left" | "right";
  visualSide: "left" | "right";
  visualKey: "data" | "form" | "cost" | "ai";
};

const BLOCKS: ReadonlyArray<BlockDef> = [
  {
    n: "01",
    label: "01 · Datos",
    quote: "¿De dónde sacan los números?",
    title: "Del mercado real, no de promedios.",
    body: "Cruzamos tu caso con propiedades en venta, arriendo largo, datos de Airbnb (ADR y ocupación por zona), estaciones de metro, clínicas, universidades y comercio. 24 comunas del Gran Santiago, actualizado semanal.",
    ghostSide: "right",
    visualSide: "right",
    visualKey: "data",
  },
  {
    n: "02",
    label: "02 · Facilidad",
    quote: "No tengo todos los datos a mano.",
    title: "Pon precio y comuna. Franco completa el resto.",
    body: "Si no sabes el arriendo esperado, los gastos comunes o las contribuciones, Franco usa la mediana real de la zona. Tú confirmas o ajustas si tienes el dato. 5 minutos, veredicto en 30 segundos.",
    ghostSide: "left",
    visualSide: "left",
    visualKey: "form",
  },
  {
    n: "03",
    label: "03 · Costo",
    quote: "¿Cuánto cuesta?",
    title: "Lo que cuestan dos cafés.",
    body: "Y el primero es gratis, sin tarjeta. Antes de firmar 25 años de hipoteca, el costo se paga solo. Ahorrarte un error de compra equivale a miles de análisis.",
    ghostSide: "right",
    visualSide: "right",
    visualKey: "cost",
  },
  {
    n: "04",
    label: "04 · IA",
    quote: "Y si no conviene, ¿qué hago?",
    title: "Franco interpreta con IA, no solo calcula.",
    body: "No es una calculadora — es un asesor. La IA identifica el problema real y propone alternativas concretas: hasta dónde negociar, cómo reestructurar el financiamiento, qué modalidad de arriendo optimiza el flujo, qué riesgos vigilar.",
    ghostSide: "left",
    visualSide: "left",
    visualKey: "ai",
  },
];

export default function SectionObjections() {
  const [mode, setMode] = useState<"sticky" | "accordion" | "stack">("stack");

  useEffect(() => {
    const compute = () => {
      const m = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const d = window.matchMedia("(min-width: 768px)").matches;
      setMode(m ? (d ? "sticky" : "accordion") : "stack");
    };
    compute();
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqDesk = window.matchMedia("(min-width: 768px)");
    mqMotion.addEventListener("change", compute);
    mqDesk.addEventListener("change", compute);
    return () => {
      mqMotion.removeEventListener("change", compute);
      mqDesk.removeEventListener("change", compute);
    };
  }, []);

  return (
    <section className="relative ">
      {/* Header — fuera del sticky solo en accordion/stack; en modo sticky
          se incrusta dentro del bloque 01 para que no se pierda del viewport. */}
      {mode !== "sticky" && (
        <div className="mx-auto max-w-[1280px] px-6 pt-14 md:pt-[72px]">
          <SectionHeader
            eyebrow="07 · Lo que vas a pensar"
            title={"Cuatro razones para confiar\nantes de hacer click."}
            className="max-w-[820px]"
          />
        </div>
      )}

      {mode === "sticky" && <StickyVariant />}
      {mode === "accordion" && <AccordionVariant />}
      {mode === "stack" && <StackVariant />}
    </section>
  );
}

/* ============================ Sticky (desktop) ============================ */

function StickyVariant() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeBlock, setActiveBlock] = useState(0);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  // Parallax leve del numeral fantasma (más lento que scroll, 30px max)
  const yGhost = useTransform(scrollYProgress, [0, 1], [30, -30]);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      const idx = p >= 0.75 ? 3 : p >= 0.5 ? 2 : p >= 0.25 ? 1 : 0;
      setActiveBlock(idx);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const block = BLOCKS[activeBlock];

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: "350vh" }}
    >
      <div className="sticky top-[64px] flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden">
        {/* Header permanente — visible en todos los bloques. */}
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-8">
          <div className="max-w-[820px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
              06 · Lo que vas a pensar
            </span>
            <h2 className="mt-2 font-heading text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-[var(--landing-text)] md:text-[32px]">
              Cuatro razones para confiar antes de hacer click.
            </h2>
          </div>
        </div>

        {/* Numeral fantasma — alterna lado según paridad, parallax leve */}
        <motion.span
          key={block.n}
          className="pointer-events-none absolute select-none font-heading font-bold leading-none tracking-[-0.04em] transition-[left,right,opacity] duration-500"
          style={{
            color: "rgba(200,50,60,0.08)",
            fontSize: "clamp(180px, 24vw, 280px)",
            top: "55%",
            translateY: "-50%",
            [block.ghostSide]: "-2vw",
            zIndex: 0,
            y: reduce ? 0 : yGhost,
          }}
          aria-hidden="true"
        >
          {block.n}
        </motion.span>

        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-6 pb-10">
          {/* Slides */}
          <div className="relative flex min-h-[440px] w-full items-center">
            {BLOCKS.map((b, i) => {
              const isActive = i === activeBlock;
              return (
                <div
                  key={b.n}
                  className={`grid grid-cols-2 items-center gap-12 transition-[opacity,transform] duration-[400ms] ease-out ${
                    isActive ? "" : "absolute inset-0 pointer-events-none"
                  }`}
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive
                      ? "translateX(0)"
                      : `translateX(${b.visualSide === "right" ? "20px" : "-20px"})`,
                  }}
                  aria-hidden={!isActive}
                >
                  {b.visualSide === "left" ? (
                    <>
                      <div>
                        <VisualSlot which={b.visualKey} />
                      </div>
                      <CopyBlock block={b} />
                    </>
                  ) : (
                    <>
                      <CopyBlock block={b} />
                      <div>
                        <VisualSlot which={b.visualKey} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>



        {/* Dots verticales */}
        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex" aria-hidden="true">
          {BLOCKS.map((_, i) => {
            const active = i === activeBlock;
            return (
              <span
                key={i}
                className="h-2 w-2 rounded-full transition-[background,transform] duration-300"
                style={{
                  background: active ? "rgba(250,250,248,0.85)" : "rgba(250,250,248,0.25)",
                  transform: active ? "scale(1.4)" : "scale(1)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CopyBlock({ block }: { block: BlockDef }) {
  return (
    <div className="max-w-[520px]">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
        {block.label}
      </span>
      <p className="mt-2 font-body text-[15px] italic leading-[1.4] text-[var(--landing-text-muted)]">
        &ldquo;{block.quote}&rdquo;
      </p>
      <h3 className="mt-3 font-heading text-[22px] font-bold leading-[1.2] tracking-[-0.005em] text-[var(--landing-text)] md:text-[26px]">
        {block.title}
      </h3>
      <p className="mt-3 font-body text-[14px] leading-[1.6] text-[var(--landing-text-secondary)]">
        {block.body}
      </p>
    </div>
  );
}

/* ============================ Accordion (mobile) ============================ */

function AccordionVariant() {
  const [open, setOpen] = useState<number>(0);
  return (
    <div className="mx-auto mt-8 max-w-[1280px] px-6 pb-14">
      <div className="space-y-2">
        {BLOCKS.map((b, i) => {
          const isOpen = i === open;
          return (
            <div
              key={b.n}
              className="overflow-hidden rounded-md border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.02)]"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[rgba(250,250,248,0.03)]"
                aria-expanded={isOpen}
                aria-controls={`obj-${b.n}`}
              >
                <span
                  className="font-heading font-bold leading-none"
                  style={{
                    color: isOpen ? "#C8323C" : "rgba(250,250,248,0.92)",
                    fontSize: "32px",
                  }}
                  aria-hidden="true"
                >
                  {b.n}
                </span>
                <div className="flex-1 pt-1">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
                    {b.label}
                  </span>
                  <p className="mt-1 font-body text-[14px] italic leading-[1.4] text-[var(--landing-text-muted)]">
                    &ldquo;{b.quote}&rdquo;
                  </p>
                </div>
                <span
                  className="mt-1 font-mono text-[14px] text-[var(--landing-text-muted)] transition-transform duration-300"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                  aria-hidden="true"
                >
                  ↓
                </span>
              </button>

              <div
                id={`obj-${b.n}`}
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-5 px-4 pb-5">
                    <h3 className="font-heading text-[20px] font-bold leading-[1.2] tracking-[-0.005em] text-[var(--landing-text)]">
                      {b.title}
                    </h3>
                    <p className="font-body text-[14px] leading-[1.6] text-[var(--landing-text-secondary)]">
                      {b.body}
                    </p>
                    <VisualSlot which={b.visualKey} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============== Stack (reduced motion / fallback no-JS) =============== */

function StackVariant() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-10 md:pb-[72px]">
      <div>
        {BLOCKS.map((b, i) => (
          <StackBlock key={b.n} block={b} isLast={i === BLOCKS.length - 1} />
        ))}
      </div>
    </div>
  );
}

function StackBlock({ block, isLast }: { block: BlockDef; isLast: boolean }) {
  return (
    <Reveal as="div"
      className="relative overflow-hidden"
      style={{
        borderTop: "0.5px solid rgba(250,250,248,0.10)",
        borderBottom: isLast ? "0.5px solid rgba(250,250,248,0.10)" : undefined,
      }}
    >
      <span
        className="pointer-events-none absolute select-none font-heading font-bold leading-none tracking-[-0.04em]"
        style={{
          color: "rgba(200,50,60,0.06)",
          fontSize: "clamp(180px, 26vw, 320px)",
          top: "50%",
          transform: "translateY(-50%)",
          [block.ghostSide]: "-2vw",
        }}
        aria-hidden="true"
      >
        {block.n}
      </span>

      <div className="relative grid grid-cols-1 items-center gap-10 px-2 py-12 md:grid-cols-2 md:gap-14 md:py-14">
        {block.visualSide === "left" ? (
          <>
            <div className="order-2 md:order-1">
              <VisualSlot which={block.visualKey} />
            </div>
            <div className="order-1 md:order-2">
              <CopyBlock block={block} />
            </div>
          </>
        ) : (
          <>
            <CopyBlock block={block} />
            <div>
              <VisualSlot which={block.visualKey} />
            </div>
          </>
        )}
      </div>
    </Reveal>
  );
}

/* ============================ Visual slot ============================ */

function VisualSlot({ which }: { which: BlockDef["visualKey"] }) {
  if (which === "data") return <DataCardsGrid />;
  if (which === "form") return <SmartFormMock />;
  if (which === "cost") return <CostHero />;
  return <AIRecommendations />;
}

/* ───────────── Bloque 01 · DATOS — 2x2 grid mini cards ───────────── */

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
          className="rounded-md border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.03)] px-4 py-5"
        >
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
            {it.label}
          </p>
          <p className="mt-2 font-mono text-[20px] font-semibold text-[var(--landing-text)]">{it.big}</p>
          <p className="mt-1 font-body text-[12px] leading-[1.4] text-[var(--landing-text-muted)]">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Bloque 02 · FACILIDAD — Form mock ───────────── */

function SmartFormMock() {
  type Row = { label: string; value: string; tag: "tú" | "Franco" };
  const rows: Row[] = [
    { label: "Precio", value: "UF 5.500", tag: "tú" },
    { label: "Comuna", value: "Providencia", tag: "tú" },
    { label: "Arriendo esperado", value: "$950.000", tag: "Franco" },
    { label: "Gastos comunes", value: "$110.000", tag: "Franco" },
    { label: "Contribuciones", value: "$80.000", tag: "Franco" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(250,250,248,0.10)] bg-[#1A1A1A] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="border-b border-[rgba(250,250,248,0.08)] px-5 py-3">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
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
                className="flex items-center gap-3 rounded-md border px-4 py-3"
                style={{
                  borderColor: isFranco ? "rgba(200,50,60,0.25)" : "rgba(250,250,248,0.08)",
                  background: isFranco ? "rgba(200,50,60,0.06)" : "rgba(250,250,248,0.02)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
                    {r.label}
                  </p>
                  <p className="mt-1 font-mono text-[14px] font-semibold text-[var(--landing-text)]">{r.value}</p>
                </div>
                <span
                  className="shrink-0 rounded-sm px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.1em]"
                  style={{
                    background: isFranco ? "#C8323C" : "rgba(250,250,248,0.10)",
                    color: isFranco ? "#FFFFFF" : "rgba(250,250,248,0.65)",
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

/* ───────────── Bloque 03 · COSTO — $0 hero ───────────── */

function CostHero() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.02)] px-6 py-12">
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(80px, 14vw, 128px)" }}
      >
        $0
      </p>
      <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--landing-text)]">
        Primer análisis
      </p>
      <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
        Sin tarjeta · sin compromiso
      </p>
    </div>
  );
}

/* ───────────── Bloque 04 · IA — 4 recomendaciones ───────────── */

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
          style={{ borderLeft: "2px solid #C8323C", background: "rgba(250,250,248,0.03)" }}
        >
          <p className="font-body text-[14px] leading-[1.55] text-[var(--landing-text-secondary)]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
              {it.verb}
            </span>
            <span className="ml-2 font-body italic">{it.body}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
