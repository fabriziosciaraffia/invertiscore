"use client";

import { useEffect, useRef, useState } from "react";
import SectionHeader from "./SectionHeader";

/**
 * Sección 03 · Qué hace Franco — 3 modos según viewport y motion:
 * - Desktop (>=768px) + motion OK → sticky scroll narrativo 300vh
 * - Mobile (<768px)               → carousel horizontal scroll-snap-x mandatory
 * - prefers-reduced-motion        → stack vertical simple (sin sticky/carousel)
 *
 * El crescendo ink-200 → ink-100 → ink-900 se mantiene en los 3 modos.
 */

type StepDef = {
  numeral: "01" | "02" | "03";
  title: string;
  body: string;
  /** Si true, numeral en Signal Red (highlight del último step). */
  highlight?: boolean;
};

const STEPS: ReadonlyArray<StepDef> = [
  {
    numeral: "01",
    title: "Cruza tu caso con el mercado.",
    body: "12.944 propiedades comparables, 195 estaciones de metro, POIs georreferenciados. Tu depto no se evalúa aislado, se ubica en el mapa real del mercado.",
  },
  {
    numeral: "02",
    title: "Saca todas las cuentas.",
    body: "Flujo real mes a mes, contemplando gastos que nadie suma. Proyección patrimonial a 10 años con aporte real, valor del depto y patrimonio neto.",
  },
  {
    numeral: "03",
    title: "Se la juega.",
    body: "Score, veredicto, precio sugerido, costo real, riesgos. Sin matices que diluyan la decisión.",
    highlight: true,
  },
];

export default function SectionWhatFrancoDoes() {
  const [mode, setMode] = useState<"sticky" | "carousel" | "stack">("stack");

  useEffect(() => {
    const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const compute = () => {
      const m = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const d = window.matchMedia("(min-width: 768px)").matches;
      setMode(m ? (d ? "sticky" : "carousel") : "stack");
    };
    setMode(motionOK ? (desktop ? "sticky" : "carousel") : "stack");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqDesk = window.matchMedia("(min-width: 768px)");
    mqMotion.addEventListener("change", compute);
    mqDesk.addEventListener("change", compute);
    return () => {
      mqMotion.removeEventListener("change", compute);
      mqDesk.removeEventListener("change", compute);
    };
  }, []);

  // Header de sección — solo se muestra fuera del sticky (carousel y stack
  // lo necesitan; en modo sticky se incrusta dentro del step 0).
  const HeaderOutside = (
    <div>
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-14 md:pb-10 md:pt-[72px]">
        <SectionHeader
          eyebrow="04 · Cómo funciona"
          title={"Le hacemos a tu depto las preguntas\nque tu cotización no responde."}
          subhead="Tres pasos, 30 segundos, una posición clara. Así trabaja Franco con el caso del depto en Providencia."
          className="max-w-[820px]"
        />
      </div>
    </div>
  );

  return (
    <section id="que-hace-franco" className="contents">
      {mode !== "sticky" && HeaderOutside}
      {mode === "sticky" && <StickyVariant />}
      {mode === "carousel" && <CarouselVariant />}
      {mode === "stack" && <StackVariant />}
    </section>
  );
}

/* ============================ Sticky (desktop) ============================ */

function StickyVariant() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

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
      // Thresholds 0-0.33 step 1, 0.33-0.6 step 2, 0.6+ step 3.
      // Step 3 entra antes para que la salida hacia s04 no requiera buffer extra.
      const idx = p >= 0.6 ? 2 : p >= 0.33 ? 1 : 0;
      setActiveStep(idx);
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

  const step = STEPS[activeStep];

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-[64px] flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden">
        {/* Header permanente — visible en los 3 pasos */}
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-8">
          <div className="max-w-[820px]">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
              04 · Cómo funciona
            </span>
            <h2
              className="mt-2 font-heading font-bold leading-[1.1] tracking-[-0.015em] text-[var(--landing-text)]"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)" }}
            >
              Le hacemos a tu depto las preguntas que tu cotización no responde.
            </h2>
          </div>
        </div>

        {/* Body: numeral + slide centrado verticalmente */}
        <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-[140px_1fr] items-center gap-8 px-6 pb-8">
          {/* Numeral fijo — Signal Red sólo cuando highlight (step 3). */}
          <div className="flex items-center">
            <span
              key={step.numeral}
              className="font-heading font-bold leading-[0.85] tracking-[-0.04em] transition-colors duration-500"
              style={{
                color: step.highlight ? "#C8323C" : "var(--landing-text)",
                fontSize: "clamp(56px, 8vw, 96px)",
              }}
              aria-hidden="true"
            >
              {step.numeral}
            </span>
          </div>

          {/* Contenido derecha */}
          <div className="relative min-h-[440px]">
            {STEPS.map((s, i) => {
              const isActive = i === activeStep;
              return (
                <div
                  key={s.numeral}
                  className={`absolute inset-0 flex flex-col justify-center gap-5 transition-[opacity,transform] duration-[400ms] ease-out ${
                    isActive ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(20px)",
                  }}
                  aria-hidden={!isActive}
                >
                  <div className="max-w-[680px]">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
                      Paso {s.numeral}
                    </span>
                    <h3 className="mt-2 font-heading text-[22px] font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)] md:text-[26px]">
                      {s.title}
                    </h3>
                    <p className="mt-2 max-w-[600px] font-body text-[13px] leading-[1.5] text-[var(--landing-text-secondary)] md:text-[14px]">
                      {s.body}
                    </p>
                  </div>

                  {/* Frame slot — limitado en alto para encajar en viewport */}
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <FrameSlot stepIndex={i} dark={false} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indicador vertical */}
        <StepDots count={3} activeIndex={activeStep} />
      </div>
    </div>
  );
}

function StepDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  // Color de dots usa el secundario del tema activo. Inactivos con opacity.
  const baseColor = "var(--landing-text-muted)";
  const activeColor = "var(--landing-text)";
  return (
    <div
      className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <span
            key={i}
            className="h-2 w-2 rounded-full transition-[background,transform] duration-300"
            style={{
              background: active ? activeColor : baseColor,
              transform: active ? "scale(1.4)" : "scale(1)",
            }}
          />
        );
      })}
    </div>
  );
}

/* ============================ Carousel (mobile) ============================ */

function CarouselVariant() {
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth;
      const i = Math.round(el.scrollLeft / w);
      setActive(Math.max(0, Math.min(2, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      {/* Dots header */}
      <div className="px-6 pt-2">
        <div className="flex items-center gap-2" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{
                background:
                  i === active ? "rgba(15,15,15,0.85)" : "rgba(15,15,15,0.25)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Scroller */}
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide"
        style={{ scrollPaddingInline: "5vw" }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s.numeral}
            className="snap-start shrink-0 px-6 py-10"
            style={{ width: "90vw" }}
          >
            <div className="flex items-baseline gap-4">
              <span
                className="font-heading font-bold leading-none tracking-[-0.04em]"
                style={{
                  color: s.highlight ? "#C8323C" : "var(--landing-text)",
                  fontSize: "72px",
                }}
                aria-hidden="true"
              >
                {s.numeral}
              </span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
                Paso {s.numeral}
              </span>
            </div>

            <h3 className="mt-5 font-heading text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-[var(--landing-text)]">
              {s.title}
            </h3>
            <p className="mt-3 font-body text-[14px] leading-[1.55] text-[var(--landing-text-secondary)]">
              {s.body}
            </p>

            <div className="mt-6">
              <FrameSlot stepIndex={i} dark={false} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============== Stack (reduced motion / fallback no-JS SSR) =============== */

function StackVariant() {
  return (
    <>
      {STEPS.map((s, i) => (
        <div key={s.numeral}>
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-6 py-14 md:grid-cols-[180px_1fr] md:gap-10 md:py-[72px]">
            <div>
              <span
                className="font-heading font-bold leading-[0.85] tracking-[-0.04em]"
                style={{
                  color: s.highlight ? "#C8323C" : "var(--landing-text)",
                  fontSize: "clamp(80px, 14vw, 144px)",
                }}
                aria-hidden="true"
              >
                {s.numeral}
              </span>
            </div>
            <div className="flex flex-col gap-8 md:gap-10">
              <div className="max-w-[680px]">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
                  Paso {s.numeral}
                </span>
                <h3 className="mt-3 font-heading text-[28px] font-bold leading-[1.15] tracking-[-0.01em] text-[var(--landing-text)] md:text-[36px]">
                  {s.title}
                </h3>
                <p className="mt-4 font-body text-[15px] leading-[1.6] text-[var(--landing-text-secondary)] md:text-[16px]">
                  {s.body}
                </p>
              </div>
              <FrameSlot stepIndex={i} dark={false} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ====================== Frame slot por paso (visual) ====================== */

function FrameSlot({
  stepIndex,
  dark,
  compact = false,
}: {
  stepIndex: number;
  dark: boolean;
  compact?: boolean;
}) {
  const frameTokens = dark
    ? ({ "--frame-bg": "#1A1A1A", "--frame-border": "rgba(250,250,248,0.10)" } as React.CSSProperties)
    : ({ "--frame-bg": "#FFFFFF", "--frame-border": "rgba(15,15,15,0.10)" } as React.CSSProperties);
  return (
    <div style={frameTokens} className={compact ? "h-full" : undefined}>
      {stepIndex === 0 && <ZoneDrawerFrame compact={compact} />}
      {stepIndex === 1 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CostoDrawerFrame compact={compact} />
          <PatrimonioDrawerFrame compact={compact} />
        </div>
      )}
      {stepIndex === 2 && <HeroResultFrame compact={compact} />}
    </div>
  );
}

/* ───────────────────── Frame Linear-style (sin chrome) ───────────────────── */
/**
 * Contenedor limpio sin metáfora de navegador. El contenido del drawer es
 * protagonista. Acepta `dark` para alinear el bg del frame al tema oscuro
 * cuando el drawer renderiza contenido sobre fondo Ink.
 *
 * El argumento `url` se conserva en la firma para evitar que los call-sites
 * rompan, pero se ignora a propósito.
 */
function BrowserFrame({
  children,
  dark = false,
}: {
  url?: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: dark ? "#0F0F0F" : "var(--frame-bg)",
        border: "0.5px solid var(--frame-border)",
        borderRadius: 16,
        boxShadow:
          "0 30px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────── Paso 01 · Zone Drawer ───────────────────── */

function ZoneDrawerFrame({ compact = false }: { compact?: boolean }) {
  return (
    <BrowserFrame url="refranco.ai/analisis/providencia/zona">
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.1fr_1fr]">
        <div
          className={`relative overflow-hidden bg-[#F0F0EC] ${
            compact ? "" : "h-[280px] md:h-[360px]"
          }`}
          style={compact ? { height: 220 } : undefined}
        >
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="zonegrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(15,15,15,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#zonegrid)" />
            <line x1="0" y1="120" x2="100%" y2="120" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="0" y1="220" x2="100%" y2="220" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="180" y1="0" x2="180" y2="100%" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <line x1="320" y1="0" x2="320" y2="100%" stroke="rgba(15,15,15,0.10)" strokeWidth="2" />
            <circle cx="90" cy="80" r="4" fill="#5F5E5A" />
            <circle cx="240" cy="60" r="4" fill="#5F5E5A" />
            <circle cx="280" cy="180" r="4" fill="#5F5E5A" />
            <circle cx="80" cy="200" r="4" fill="#5F5E5A" />
            <circle cx="350" cy="100" r="4" fill="#5F5E5A" />
            <circle cx="150" cy="280" r="4" fill="#5F5E5A" />
            <circle cx="380" cy="280" r="4" fill="#5F5E5A" />
            <g transform="translate(200,170)">
              <circle r="14" fill="rgba(200,50,60,0.18)" />
              <circle r="7" fill="#C8323C" />
              <circle r="3" fill="#FFFFFF" />
            </g>
          </svg>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--landing-text-secondary)]">
            <span>20 POIs · 1.2 km radio</span>
            <span>Providencia centro</span>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              06 · Zona
            </p>
            <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[var(--landing-text)]">
              ¿Qué tan demandada está esta zona?
            </p>
          </div>
          <div
            className="rounded-r-md py-3 pl-3 pr-3"
            style={{ borderLeft: "3px solid #FAFAF8", background: "rgba(15,15,15,0.04)" }}
          >
            <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
              ★ Insight Franco IA
            </p>
            <p className="mt-1.5 font-body text-[11px] italic leading-[1.5] text-[var(--landing-text-secondary)]">
              Demanda alta sostenida: 3 universidades, metro a 350m, comercio 24/7 en 4 cuadras.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Cap rate zona" value="5,2%" />
            <Metric label="Vacancia" value="3,8%" />
            <Metric label="ADR Airbnb" value="$58K" />
            <Metric label="Ocupación" value="78%" />
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[rgba(15,15,15,0.04)] px-2.5 py-2">
      <p className="font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-[var(--landing-text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold text-[var(--landing-text)]">{value}</p>
    </div>
  );
}

/* ───────────────────── Paso 02 · Costo + Patrimonio ───────────────────── */

function CostoDrawerFrame({ compact = false }: { compact?: boolean }) {
  const rows: Array<{ label: string; value: string; pct: number; sign: "+" | "−" }> = [
    { label: "Arriendo bruto", value: "$950.000", pct: 100, sign: "+" },
    { label: "GGCC", value: "−$110.000", pct: 12, sign: "−" },
    { label: "Contribuciones", value: "−$80.000", pct: 8, sign: "−" },
    { label: "Vacancia (8%)", value: "−$76.000", pct: 8, sign: "−" },
    { label: "Comisión admin", value: "−$95.000", pct: 10, sign: "−" },
  ];
  return (
    <BrowserFrame url="refranco.ai/.../costo-mensual">
      <div className={compact ? "p-4" : "p-5"}>
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
          02 · Costo mensual
        </p>
        <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[var(--landing-text)]">
          ¿Cuánto sale de tu bolsillo?
        </p>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_70px_70px] items-center gap-2">
              <span className="truncate font-body text-[11px] text-[var(--landing-text-secondary)]">{r.label}</span>
              <div className="h-1.5 rounded-full bg-[rgba(15,15,15,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.pct}%`, background: r.sign === "+" ? "#B4B2A9" : "#C8323C" }}
                />
              </div>
              <span className="text-right font-mono text-[10px] font-medium text-[var(--landing-text)]">
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-5 rounded-r-md py-3 pl-3 pr-3"
          style={{ borderLeft: "3px solid #C8323C", background: "rgba(200,50,60,0.06)" }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
            Sale de tu bolsillo
          </p>
          <p className="mt-1 font-mono text-[20px] font-bold text-[#C8323C]">
            −$290.677<span className="text-[12px] text-[#C8323C]/70">/mes</span>
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

function PatrimonioDrawerFrame({ compact = false }: { compact?: boolean }) {
  return (
    <BrowserFrame url="refranco.ai/.../patrimonio">
      <div className={compact ? "p-4" : "p-5"}>
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
          09 · Patrimonio
        </p>
        <p className="mt-2 font-heading text-[15px] font-bold leading-tight text-[var(--landing-text)]">
          Patrimonio neto a 10 años
        </p>
        <div className="mt-4">
          <svg viewBox="0 0 320 140" className="h-[140px] w-full" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="20" x2="320" y1={20 + i * 30} y2={20 + i * 30} stroke="rgba(15,15,15,0.06)" strokeWidth="1" />
            ))}
            {Array.from({ length: 10 }).map((_, i) => {
              const x = 28 + i * 30;
              const aporteH = 10 + i * 4;
              const valorH = 24 + i * 8;
              return (
                <g key={i}>
                  <rect x={x} y={140 - aporteH} width="14" height={aporteH} fill="#C8323C" />
                  <rect x={x} y={140 - aporteH - valorH} width="14" height={valorH} fill="rgba(15,15,15,0.18)" />
                </g>
              );
            })}
            <polyline
              points="35,118 65,108 95,96 125,82 155,68 185,54 215,42 245,32 275,24 305,18"
              fill="none"
              stroke="#0F0F0F"
              strokeWidth="1.5"
            />
            {Array.from({ length: 10 }).map((_, i) => {
              const x = 35 + i * 30;
              const ys = [118, 108, 96, 82, 68, 54, 42, 32, 24, 18];
              return <circle key={i} cx={x} cy={ys[i]} r="2" fill="#0F0F0F" />;
            })}
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--landing-text-muted)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#C8323C]" /> Aporte</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[rgba(15,15,15,0.18)]" /> Valor depto</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" /> Neto</span>
        </div>
        <div
          className="mt-4 rounded-r-md py-3 pl-3 pr-3"
          style={{ borderLeft: "3px solid #5F5E5A", background: "rgba(15,15,15,0.04)" }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-text-muted)]">
            Patrimonio año 10
          </p>
          <p className="mt-1 font-mono text-[18px] font-bold text-[var(--landing-text)]">$196.792.800</p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ───────────────────── Paso 03 · Hero result ───────────────────── */

function HeroResultFrame({ compact = false }: { compact?: boolean }) {
  const score = 66;
  return (
    <BrowserFrame url="refranco.ai/analisis/providencia-2d2b" dark>
      <div className={compact ? "p-5" : "p-6 md:p-7"}>
        <div className="flex items-baseline justify-between border-b border-dashed border-[rgba(250,250,248,0.10)] pb-4">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(250,250,248,0.55)]">
            01 · Veredicto
          </span>
          <span className="font-heading text-[14px] font-bold text-[var(--landing-text)]">Depto 2D2B Providencia</span>
        </div>
        <div className="mt-5 grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[rgba(250,250,248,0.55)]">
              Franco Score
            </p>
            <p className="mt-2 font-heading text-[56px] font-bold leading-none tracking-[-0.02em] text-[var(--landing-text)]">
              {score}
              <span className="font-heading text-[20px] text-[rgba(250,250,248,0.35)]">/100</span>
            </p>
          </div>
          <div className="md:text-right">
            <span className="inline-flex items-center rounded-md border border-[rgba(200,50,60,0.5)] bg-[rgba(200,50,60,0.10)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FF5C66]">
              Ajusta supuestos
            </span>
            <div className="mt-3">
              <div className="relative h-1 w-full rounded-full bg-[rgba(250,250,248,0.08)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${score}%`, background: "linear-gradient(90deg,#C8323C 0%,#888780 60%,#B4B2A9 100%)" }}
                />
                <div
                  className="absolute -top-[3px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-[#FAFAF8]"
                  style={{ left: `${score}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          className="mt-5 rounded-r-md py-4 pl-4 pr-4"
          style={{ borderLeft: "3px solid #C8323C", background: "rgba(200,50,60,0.10)" }}
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#FF5C66]">
            Siendo franco
          </p>
          <p className="mt-2 font-body text-[13px] italic leading-[1.55] text-[rgba(250,250,248,0.88)]">
            &ldquo;Buena ubicación, precio incómodo. Negocia hasta UF 4.900 y opera en Airbnb.&rdquo;
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <KpiDark label="Aporte mes" value="−$290K" red />
          <KpiDark label="Sugerido" value="UF 4.900" />
          <KpiDark label="Δ Airbnb" value="+$148K" />
        </div>
      </div>
    </BrowserFrame>
  );
}

function KpiDark({ label, value, red = false }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="rounded-md border border-[rgba(250,250,248,0.08)] bg-[rgba(250,250,248,0.03)] px-3 py-2.5">
      <p className="font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-[rgba(250,250,248,0.55)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold" style={{ color: red ? "#FF5C66" : "#FAFAF8" }}>
        {value}
      </p>
    </div>
  );
}
