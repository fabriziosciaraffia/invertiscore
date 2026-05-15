"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * Sección 02 · Problema — F.8 v3 narrativa scroll-driven en 4 bloques.
 *
 *   ┌─ Container 500vh ──────────────────────────────────────┐
 *   │ Sticky inner top-0 h-screen overflow-hidden            │
 *   │                                                          │
 *   │  [0.00 - 0.15] BLOQUE 1 · TÍTULO                        │
 *   │    Eyebrow + H2 mask reveal, centrado grande            │
 *   │    Luego se posiciona top-left, scale ~0.7              │
 *   │                                                          │
 *   │  [0.15 - 0.55] BLOQUE 2 · STATS ACUMULAN                │
 *   │    Stat 1 (4,5%) entra desde abajo → permanece          │
 *   │    Stat 2 (5,0%) entra debajo → permanece               │
 *   │    Stat 3 (31,7%, Signal Red) entra → permanece         │
 *   │    Al final del bloque los 3 son visibles               │
 *   │                                                          │
 *   │  [0.55 - 0.85] BLOQUE 3 · RESULTADO                     │
 *   │    Los 3 stats migran a mini-fila arriba (scale → 0.25) │
 *   │    Resultado 92,1% Signal Red dominante centrado         │
 *   │    Counter 0 → 92,1, descriptor + línea técnica         │
 *   │                                                          │
 *   │  [0.85 - 1.00] BLOQUE 4 · CIERRE                        │
 *   │    "Antes, comprar era seguro. / Hoy, hay que analizar."│
 *   │    Mask reveal, "analizar" en Signal Red                │
 *   │    Stats + resultado fade a 0.2                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Mobile (<768px): scroll vertical normal con stack secuencial.
 * prefers-reduced-motion: layout estático.
 */

const TITLE_SHRINK_START = 0.10;
const TITLE_SHRINK_END = 0.18;
// Stats salen ANTES del resultado (sin mini-fila)
const STATS_EXIT_START = 0.55;
const STATS_EXIT_END = 0.62;
// Resultado: "RESULTADO" aparece grande primero, luego se reduce y aparece 92,1%
const RESULTADO_BIG_START = 0.62;
const RESULTADO_BIG_END = 0.68;
const RESULT_CONTENT_START = 0.68;
const RESULT_CONTENT_END = 0.80;
// Bloque 4: salida limpia del resultado + entrada del cierre
const FADE_OUT_START = 0.85;
const FADE_OUT_END = 0.88;
const CIERRE_LINE1_START = 0.88;
const CIERRE_LINE1_END = 0.94;
const CIERRE_LINE2_START = 0.94;
const CIERRE_LINE2_END = 1.0;

type StatData = {
  id: "01" | "02" | "03";
  big: string;
  kicker: string;
  /** Subtítulo opcional bajo el kicker (mono 11px uppercase). */
  kickerSub?: string;
  description: string;
  color: string;
  signalRed?: boolean;
  entryStart: number;
  entryEnd: number;
  baseTopPct: number;
};

const STATS: ReadonlyArray<StatData> = [
  {
    id: "01",
    big: "4,5%",
    kicker: "Tasas más altas.",
    description:
      "Hace 5 años: 2,0%. El dividendo mensual del mismo depto es 40% más alto hoy.",
    color: "var(--landing-text)",
    entryStart: 0.16,
    entryEnd: 0.26,
    baseTopPct: 27,
  },
  {
    id: "02",
    big: "5,0%",
    kicker: "Cap rate.",
    kickerSub: "Mediana de la muestra · n=12.944",
    description:
      "Antes el arriendo pagaba el dividendo y sobraba. Hoy apenas lo iguala — y eso antes de descontar gastos.",
    color: "var(--landing-text)",
    entryStart: 0.28,
    entryEnd: 0.38,
    baseTopPct: 46,
  },
  {
    id: "03",
    big: "31,7%",
    kicker: "Un tercio desaparece.",
    description:
      "Contribuciones, gastos comunes, vacancia, comisiones. Salen de tu flujo antes de llegar a tu bolsillo.",
    color: "#C8323C",
    signalRed: true,
    entryStart: 0.40,
    entryEnd: 0.52,
    baseTopPct: 65,
  },
];

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export default function SectionProblem() {
  const reduce = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (reduce) return <ReducedMotionFallback />;
  return (
    <section className="relative">
      {isDesktop ? <DesktopLayout /> : <MobileLayout />}
    </section>
  );
}

/* ============================ Desktop ============================ */

function DesktopLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <div ref={ref} className="relative" style={{ height: "500vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="relative mx-auto h-full w-full max-w-[1280px] px-8">
          <Title scrollYProgress={scrollYProgress} />
          {STATS.map((s) => (
            <StatNarrative
              key={s.id}
              scrollYProgress={scrollYProgress}
              data={s}
            />
          ))}
          <Result scrollYProgress={scrollYProgress} />
          <Cierre scrollYProgress={scrollYProgress} />
        </div>
      </div>
    </div>
  );
}

/* ============================ Título ============================ */

function Title({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  // Bloque 1: centrado grande (con eyebrow + subhead)
  // Bloque 2-3: top-left scale 0.7 — SOLO H2, eyebrow + subhead ocultos
  // Bloque 4: fade-out completo (opacity → 0) durante [0.85, 0.88]
  const opacityMV = useMotionValue(0);
  const phaseMV = useMotionValue(0); // 0 = centrado grande, 1 = top-left chico
  const auxOpacityMV = useMotionValue(1); // eyebrow + subhead
  const yMV = useMotionValue(0);

  useEffect(() => {
    const update = (v: number) => {
      // Fade-in inicial
      let op = 1;
      if (v < 0.04) op = v / 0.04;
      // Fade-out completo en bloque 4 [0.85, 0.88]
      if (v >= FADE_OUT_START) {
        const t = clamp01((v - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START));
        op = 1 - t;
        yMV.set(-40 * t);
      } else {
        yMV.set(0);
      }
      opacityMV.set(op);

      // Phase transition centrado → top-left
      const phaseT = clamp01(
        (v - TITLE_SHRINK_START) / (TITLE_SHRINK_END - TITLE_SHRINK_START),
      );
      phaseMV.set(easeOutQuart(phaseT));

      // Eyebrow + subhead fade durante [0.10, 0.15]
      const auxT = clamp01((v - 0.10) / (0.15 - 0.10));
      auxOpacityMV.set(1 - auxT);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, opacityMV, phaseMV, auxOpacityMV, yMV]);

  // Interpolar top, left, scale entre centrado y top-left
  const topStr = useTransform(phaseMV, (p) => `${50 - 41 * p}%`); // 50% → 9%
  const leftStr = useTransform(phaseMV, (p) => `${50 - 44 * p}%`); // 50% → 6%
  const translateX = useTransform(phaseMV, (p) => `${-50 + 50 * p}%`); // -50% → 0%
  const translateY = useTransform(phaseMV, (p) => `${-50 + 50 * p}%`); // -50% → 0%
  const scaleNum = useTransform(phaseMV, (p) => 1 - 0.3 * p); // 1 → 0.7

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        top: topStr,
        left: leftStr,
        x: translateX,
        y: translateY,
        scale: scaleNum,
        transformOrigin: "left top",
        opacity: opacityMV,
        width: "min(1100px, 92vw)",
      }}
    >
      <motion.div style={{ y: yMV }}>
        <motion.p
          className="font-mono font-medium uppercase text-[#C8323C]"
          style={{
            opacity: auxOpacityMV,
            fontSize: 11,
            letterSpacing: "0.06em",
            marginBottom: 16,
          }}
        >
          02 · El problema
        </motion.p>
        <h2
          className="font-heading font-bold leading-[1.04] tracking-[-0.02em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(44px, 4.6vw, 64px)" }}
        >
          La matemática del depto<br />de inversión{" "}
          <span className="text-[#C8323C]">cambió.</span>
        </h2>
        <motion.p
          className="mt-4 font-body text-[var(--landing-text-secondary)]"
          style={{
            opacity: auxOpacityMV,
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 460,
          }}
        >
          Antes los números calzaban. Hoy no.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

/* ============================ Stat narrativo ============================ */

function StatNarrative({
  scrollYProgress,
  data,
}: {
  scrollYProgress: MotionValue<number>;
  data: StatData;
}) {
  // Entry: from below + fade in [entryStart, entryEnd]
  // Exit: stats salen ANTES del resultado en [STATS_EXIT_START, STATS_EXIT_END]
  // Sin migración a mini-fila — desaparecen limpio.
  const opacityMV = useMotionValue(0);
  const yPxMV = useMotionValue(80);

  useEffect(() => {
    const update = (v: number) => {
      const entryT = clamp01(
        (v - data.entryStart) / (data.entryEnd - data.entryStart),
      );
      const easedEntry = easeOutQuart(entryT);

      const exitT = clamp01(
        (v - STATS_EXIT_START) / (STATS_EXIT_END - STATS_EXIT_START),
      );

      // y: entrada desde abajo + salida hacia arriba
      const entryY = 80 * (1 - easedEntry);
      const exitY = -40 * exitT;
      yPxMV.set(entryY + exitY);

      opacityMV.set(easedEntry * (1 - exitT));
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [
    scrollYProgress,
    data.entryStart,
    data.entryEnd,
    opacityMV,
    yPxMV,
  ]);

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        top: `${data.baseTopPct}%`,
        left: "6%",
        right: "6%",
        opacity: opacityMV,
        y: yPxMV,
      }}
    >
      <div
        className="grid items-center"
        style={{
          // Columna número con ancho fijo para que la columna de texto
          // siempre inicie en la misma X (31,7% no debe correr el texto).
          gridTemplateColumns: "clamp(240px, 26vw, 380px) 1fr",
          columnGap: 32,
        }}
      >
        <p
          className="font-heading font-bold leading-[0.9] tracking-[-0.04em]"
          style={{
            fontSize: "clamp(72px, 8.4vw, 116px)",
            color: data.color,
          }}
        >
          {data.big}
        </p>
        <div>
          <p
            className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              marginBottom: 6,
            }}
          >
            {data.id}
          </p>
          <p
            className="font-heading font-bold leading-[1.15] tracking-[-0.01em] text-[var(--landing-text)]"
            style={{
              fontSize: "clamp(20px, 1.8vw, 26px)",
              marginBottom: data.kickerSub ? 4 : 8,
            }}
          >
            {data.kicker}
          </p>
          {data.kickerSub && (
            <p
              className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                marginBottom: 8,
              }}
            >
              {data.kickerSub}
            </p>
          )}
          <p
            className="font-body text-[var(--landing-text-muted)]"
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            {data.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================ Resultado 92,1% ============================ */

function Result({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  // Secuencia interna:
  //  [0.62, 0.68] "RESULTADO" aparece grande SOLO (centrado)
  //  [0.68, 0.80] "RESULTADO" se reduce a eyebrow normal + aparece 92,1% +
  //               descriptor + línea técnica
  //  [0.85, 0.88] todo fade-out completo
  const containerOpacityMV = useMotionValue(0);
  const yMV = useMotionValue(0);
  // Tamaño del label "RESULTADO": grande (40px) → eyebrow (12px)
  const labelSizeMV = useMotionValue(40);
  const labelMarginMV = useMotionValue(0);
  // Contenedor se reposiciona: durante phase A centrado, durante phase B sube
  const containerTopShiftMV = useMotionValue(0);
  // Contenido principal (92.1% + descriptor + tech) opacity
  const mainOpacityMV = useMotionValue(0);
  // Entrada inicial del label
  const labelEntryYMV = useMotionValue(20);

  const [shown, setShown] = useState("0,0");

  useEffect(() => {
    const update = (v: number) => {
      // Phase A: label grande aparece [0.62, 0.68]
      const phaseAT = clamp01(
        (v - RESULTADO_BIG_START) /
          (RESULTADO_BIG_END - RESULTADO_BIG_START),
      );
      const easedA = easeOutQuart(phaseAT);

      // Phase B: label se reduce + content aparece [0.68, 0.80]
      const phaseBT = clamp01(
        (v - RESULT_CONTENT_START) /
          (RESULT_CONTENT_END - RESULT_CONTENT_START),
      );
      const easedB = easeOutQuart(phaseBT);

      // Bloque 4: fade-out [0.85, 0.88]
      const fadeT = clamp01(
        (v - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START),
      );

      // Container opacity: aparece en phase A, fade-out al final
      const baseVisible = phaseAT > 0 ? 1 : 0;
      containerOpacityMV.set(baseVisible * (1 - fadeT));
      yMV.set(-40 * fadeT);

      // Label entry (Phase A): translateY 20 → 0
      labelEntryYMV.set(20 * (1 - easedA));

      // Label tamaño: 40px (Phase A) → 12px (Phase B) durante phaseBT
      labelSizeMV.set(40 - 28 * easedB); // 40 → 12
      labelMarginMV.set(10 * easedB); // 0 → 10 (espacio entre label y 92.1%)

      // Container reposicionar: en phase A center, en phase B subir para
      // hacer espacio al contenido debajo (~140px arriba del centro)
      containerTopShiftMV.set(-140 * easedB);

      // Main content opacity: aparece durante Phase B
      mainOpacityMV.set(easedB);

      // Counter
      const n = phaseBT * 92.1;
      setShown(n.toFixed(1).replace(".", ","));
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [
    scrollYProgress,
    containerOpacityMV,
    yMV,
    labelSizeMV,
    labelMarginMV,
    containerTopShiftMV,
    mainOpacityMV,
    labelEntryYMV,
  ]);

  // Combine yMV (fade-out exit) and containerTopShiftMV (phase shift) and
  // labelEntryYMV (initial label entry)
  const combinedYStr = useTransform([yMV, containerTopShiftMV], (v) => {
    const arr = v as [number, number];
    return arr[0] + arr[1];
  });

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2"
      style={{
        opacity: containerOpacityMV,
        y: combinedYStr,
        top: "50%",
        x: "-50%",
        transformOrigin: "center top",
        width: "min(900px, 92vw)",
      }}
    >
      <div className="flex flex-col items-center text-center">
        <motion.p
          className="font-mono font-medium uppercase text-[#C8323C]"
          style={{
            fontSize: labelSizeMV,
            letterSpacing: "0.18em",
            marginBottom: labelMarginMV,
            y: labelEntryYMV,
          }}
        >
          Resultado
        </motion.p>
        <motion.div
          style={{ opacity: mainOpacityMV }}
          className="flex flex-col items-center text-center"
        >
          <p
            className="font-heading font-bold leading-[0.88] tracking-[-0.045em] text-[#C8323C]"
            style={{ fontSize: "clamp(120px, 13vw, 188px)" }}
          >
            {shown}%
          </p>
          <p
            className="mt-3 max-w-[600px] font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
            style={{ fontSize: "clamp(20px, 2.2vw, 30px)" }}
          >
            de los deptos de inversión pierden plata cada mes.
          </p>
          <p
            className="mt-4 max-w-[640px] font-heading leading-[1.3] tracking-[-0.005em] text-[var(--landing-text)]"
            style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 600 }}
          >
            <span style={{ fontWeight: 700 }}>$240.000</span> al mes.{" "}
            <span style={{ fontWeight: 700 }}>$71 millones</span> acumulados en
            25 años.
          </p>
          <p
            className="mt-4 max-w-[720px] font-mono text-[var(--landing-text-muted)]"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              lineHeight: 1.55,
            }}
          >
            n=12.944 · 24 comunas Gran Santiago · pie 20% · crédito 25 años ·
            tasa 4,5% UF · gastos 31,7%
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ============================ Cierre ============================ */

function Cierre({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  // Cierre secuencial: línea 1 fade-in, luego línea 2 fade-in.
  // Sin translateY, sin mask reveal — solo opacity.
  const line1OpacityMV = useMotionValue(0);
  const line2OpacityMV = useMotionValue(0);

  useEffect(() => {
    const update = (v: number) => {
      const t1 = clamp01(
        (v - CIERRE_LINE1_START) / (CIERRE_LINE1_END - CIERRE_LINE1_START),
      );
      line1OpacityMV.set(t1);

      const t2 = clamp01(
        (v - CIERRE_LINE2_START) / (CIERRE_LINE2_END - CIERRE_LINE2_START),
      );
      line2OpacityMV.set(t2);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, line1OpacityMV, line2OpacityMV]);

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: "50%",
        left: "6%",
        right: "6%",
        maxWidth: 880,
        transform: "translateY(-50%)",
      }}
    >
      <h3 className="font-heading font-bold leading-[1.04] tracking-[-0.02em] text-[var(--landing-text)]">
        <motion.span
          className="block"
          style={{
            opacity: line1OpacityMV,
            fontSize: "clamp(40px, 5.2vw, 72px)",
            lineHeight: 1.04,
          }}
        >
          Antes, comprar era seguro.
        </motion.span>
        <motion.span
          className="block"
          style={{
            opacity: line2OpacityMV,
            fontSize: "clamp(40px, 5.2vw, 72px)",
            lineHeight: 1.04,
          }}
        >
          Hoy, hay que <span className="text-[#C8323C]">analizar.</span>
        </motion.span>
      </h3>
    </div>
  );
}

/* ============================ Mobile ============================ */

/* ============================ Mobile ============================ */

// Timings mobile (container 450vh). Cada stat ocupa pantalla completa, sin
// acumular visualmente. Antes del 92.1% un frame resumen muestra los 3 stats
// compactos coexistiendo — preserva el momento narrativo de la acumulación.
const M_TITLE_END = 0.15;
const M_STAT1_START = 0.15;
const M_STAT1_END = 0.27;
const M_STAT2_START = 0.27;
const M_STAT2_END = 0.40;
const M_STAT3_START = 0.40;
const M_STAT3_END = 0.52;
// [0.52, 0.65] gap de transición
const M_FRAME_START = 0.65;
const M_FRAME_VISIBLE_END = 0.70;
const M_FRAME_END = 0.72;
const M_RESULT_START = 0.72;
const M_RESULT_PHASE_B = 0.75;
const M_RESULT_FADE_OUT_START = 0.86;
const M_RESULT_FADE_OUT_END = 0.88;
const M_CIERRE_L1_START = 0.88;
const M_CIERRE_L1_END = 0.94;
const M_CIERRE_L2_START = 0.94;
const M_CIERRE_L2_END = 1.0;

// Textos cortos para el frame resumen (versión condensada de los kickers).
const FRAME_SHORTS = ["Tasas más altas", "Cap rate bajo", "Un tercio desaparece"];

function MobileLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <div ref={ref} className="relative" style={{ height: "450vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <MobileTitle scrollYProgress={scrollYProgress} />
        <MobileStatScreen
          scrollYProgress={scrollYProgress}
          data={STATS[0]}
          blockStart={M_STAT1_START}
          blockEnd={M_STAT1_END}
        />
        <MobileStatScreen
          scrollYProgress={scrollYProgress}
          data={STATS[1]}
          blockStart={M_STAT2_START}
          blockEnd={M_STAT2_END}
        />
        <MobileStatScreen
          scrollYProgress={scrollYProgress}
          data={STATS[2]}
          blockStart={M_STAT3_START}
          blockEnd={M_STAT3_END}
        />
        <MobileFrame scrollYProgress={scrollYProgress} />
        <MobileResultBlock scrollYProgress={scrollYProgress} />
        <MobileCierreBlock scrollYProgress={scrollYProgress} />
      </div>
    </div>
  );
}

/* ============================ Mobile · Título ============================ */

function MobileTitle({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>;
}) {
  const opacityMV = useMotionValue(0);
  const line1MV = useMotionValue("105%");
  const line2MV = useMotionValue("105%");
  const subOpacityMV = useMotionValue(0);
  const eyebrowOpacityMV = useMotionValue(0);

  useEffect(() => {
    const update = (v: number) => {
      // Visible hasta 0.13, fade-out [0.13, 0.15]
      let op = 1;
      if (v >= 0.13) op = clamp01((M_TITLE_END - v) / 0.02);
      opacityMV.set(op);

      // Eyebrow fade-in primero
      const eyeT = clamp01(v / 0.025);
      eyebrowOpacityMV.set(eyeT);

      // Mask reveal H2 con stagger
      const t1 = clamp01((v - 0.025) / 0.04);
      line1MV.set(`${105 * (1 - easeOutQuart(t1))}%`);
      const t2 = clamp01((v - 0.06) / 0.04);
      line2MV.set(`${105 * (1 - easeOutQuart(t2))}%`);

      // Subhead al final
      const subT = clamp01((v - 0.09) / 0.04);
      subOpacityMV.set(subT);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, opacityMV, line1MV, line2MV, subOpacityMV, eyebrowOpacityMV]);

  return (
    <motion.div
      style={{ opacity: opacityMV }}
      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6"
    >
      <motion.p
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{
          opacity: eyebrowOpacityMV,
          fontSize: 11,
          letterSpacing: "0.06em",
          marginBottom: 16,
        }}
      >
        02 · El problema
      </motion.p>
      <h2
        className="font-heading font-bold leading-[1.08] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(26px, 6.8vw, 32px)" }}
      >
        <span className="block overflow-hidden" style={{ lineHeight: 1.08 }}>
          <motion.span className="block" style={{ y: line1MV }}>
            La matemática del depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.08 }}>
          <motion.span className="block" style={{ y: line2MV }}>
            de inversión <span className="text-[#C8323C]">cambió.</span>
          </motion.span>
        </span>
      </h2>
      <motion.p
        className="font-body text-[var(--landing-text-secondary)]"
        style={{
          opacity: subOpacityMV,
          fontSize: 15,
          lineHeight: 1.5,
          marginTop: 20,
          maxWidth: 360,
        }}
      >
        Antes los números calzaban. Hoy no.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Mobile · Stat full-screen ============================ */

function MobileStatScreen({
  scrollYProgress,
  data,
  blockStart,
  blockEnd,
}: {
  scrollYProgress: MotionValue<number>;
  data: StatData;
  blockStart: number;
  blockEnd: number;
}) {
  const opacityMV = useMotionValue(0);
  const yMV = useMotionValue(40);
  const IN_FADE = 0.03;
  const OUT_FADE = 0.02;

  useEffect(() => {
    const update = (v: number) => {
      let op = 0;
      let y = 40;
      if (v < blockStart || v >= blockEnd) {
        op = 0;
        y = 40;
      } else if (v < blockStart + IN_FADE) {
        const t = easeOutQuart((v - blockStart) / IN_FADE);
        op = t;
        y = 40 * (1 - t);
      } else if (v >= blockEnd - OUT_FADE) {
        op = clamp01((blockEnd - v) / OUT_FADE);
        y = 0;
      } else {
        op = 1;
        y = 0;
      }
      opacityMV.set(op);
      yMV.set(y);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, blockStart, blockEnd, opacityMV, yMV]);

  return (
    <motion.div
      style={{ opacity: opacityMV, y: yMV }}
      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6"
    >
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 14, letterSpacing: "0.18em", marginBottom: 18 }}
      >
        {data.id}
      </p>
      <p
        className="font-heading font-bold leading-[0.9] tracking-[-0.04em]"
        style={{
          fontSize: "clamp(80px, 22vw, 110px)",
          color: data.color,
          marginBottom: 24,
        }}
      >
        {data.big}
      </p>
      <p
        className="font-heading font-bold leading-[1.2] tracking-[-0.01em] text-[var(--landing-text)]"
        style={{
          fontSize: "clamp(24px, 6.8vw, 30px)",
          marginBottom: data.kickerSub ? 6 : 12,
        }}
      >
        {data.kicker}
      </p>
      {data.kickerSub && (
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            marginBottom: 12,
          }}
        >
          {data.kickerSub}
        </p>
      )}
      <p
        className="font-body text-[var(--landing-text-muted)]"
        style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 320 }}
      >
        {data.description}
      </p>
    </motion.div>
  );
}

/* ============================ Mobile · Frame resumen ============================ */

function MobileFrame({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>;
}) {
  const opacityMV = useMotionValue(0);

  useEffect(() => {
    const update = (v: number) => {
      let op = 0;
      if (v >= M_FRAME_START && v < M_FRAME_VISIBLE_END) op = 1;
      else if (v >= M_FRAME_VISIBLE_END && v < M_FRAME_END) {
        op = clamp01((M_FRAME_END - v) / (M_FRAME_END - M_FRAME_VISIBLE_END));
      }
      opacityMV.set(op);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, opacityMV]);

  return (
    <motion.div
      style={{ opacity: opacityMV }}
      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6"
    >
      <MobileFrameRow
        scrollYProgress={scrollYProgress}
        data={STATS[0]}
        rowStart={M_FRAME_START}
        short={FRAME_SHORTS[0]}
        hasDivider
      />
      <MobileFrameRow
        scrollYProgress={scrollYProgress}
        data={STATS[1]}
        rowStart={M_FRAME_START + 0.01}
        short={FRAME_SHORTS[1]}
        hasDivider
      />
      <MobileFrameRow
        scrollYProgress={scrollYProgress}
        data={STATS[2]}
        rowStart={M_FRAME_START + 0.02}
        short={FRAME_SHORTS[2]}
      />
    </motion.div>
  );
}

function MobileFrameRow({
  scrollYProgress,
  data,
  rowStart,
  short,
  hasDivider,
}: {
  scrollYProgress: MotionValue<number>;
  data: StatData;
  rowStart: number;
  short: string;
  hasDivider?: boolean;
}) {
  const opacityMV = useMotionValue(0);
  const yMV = useMotionValue(20);

  useEffect(() => {
    const update = (v: number) => {
      const t = easeOutQuart(clamp01((v - rowStart) / 0.03));
      opacityMV.set(t);
      yMV.set(20 * (1 - t));
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, rowStart, opacityMV, yMV]);

  return (
    <motion.div
      style={{
        opacity: opacityMV,
        y: yMV,
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        alignItems: "center",
        columnGap: 20,
        paddingTop: 18,
        paddingBottom: 18,
        borderBottom: hasDivider ? "0.5px solid var(--landing-divider)" : "none",
      }}
    >
      <p
        className="font-heading font-bold leading-none tracking-[-0.04em]"
        style={{ fontSize: 44, color: data.color }}
      >
        {data.big}
      </p>
      <p
        className="font-body leading-[1.3] text-[var(--landing-text)]"
        style={{ fontSize: 15, fontWeight: 600 }}
      >
        {short}
      </p>
    </motion.div>
  );
}

/* ============================ Mobile · Resultado 92,1% ============================ */

function MobileResultBlock({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>;
}) {
  const containerOpacityMV = useMotionValue(0);
  const labelSizeMV = useMotionValue(28);
  const labelMarginMV = useMotionValue(0);
  const containerYMV = useMotionValue(0);
  const mainOpacityMV = useMotionValue(0);
  const labelEntryYMV = useMotionValue(20);
  const [shown, setShown] = useState("0,0");

  useEffect(() => {
    const update = (v: number) => {
      // Phase A: "RESULTADO" grande aparece [0.72, 0.75]
      const phaseAT = clamp01((v - M_RESULT_START) / (M_RESULT_PHASE_B - M_RESULT_START));
      const easedA = easeOutQuart(phaseAT);

      // Phase B: label se reduce + 92.1% aparece [0.75, 0.85]
      const phaseBT = clamp01((v - M_RESULT_PHASE_B) / (0.85 - M_RESULT_PHASE_B));
      const easedB = easeOutQuart(phaseBT);

      // Fade-out [0.86, 0.88]
      const fadeT = clamp01(
        (v - M_RESULT_FADE_OUT_START) /
          (M_RESULT_FADE_OUT_END - M_RESULT_FADE_OUT_START),
      );

      const baseVisible = phaseAT > 0 ? 1 : 0;
      containerOpacityMV.set(baseVisible * (1 - fadeT));
      containerYMV.set(-30 * fadeT);

      labelEntryYMV.set(20 * (1 - easedA));
      labelSizeMV.set(28 - 17 * easedB); // 28 → 11
      labelMarginMV.set(8 * easedB);

      mainOpacityMV.set(easedB);

      const n = phaseBT * 92.1;
      setShown(n.toFixed(1).replace(".", ","));
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [
    scrollYProgress,
    containerOpacityMV,
    labelSizeMV,
    labelMarginMV,
    containerYMV,
    mainOpacityMV,
    labelEntryYMV,
  ]);

  return (
    <motion.div
      style={{ opacity: containerOpacityMV, y: containerYMV }}
      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6"
    >
      <motion.p
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{
          fontSize: labelSizeMV,
          letterSpacing: "0.16em",
          marginBottom: labelMarginMV,
          y: labelEntryYMV,
        }}
      >
        Resultado
      </motion.p>
      <motion.div style={{ opacity: mainOpacityMV }}>
        <p
          className="font-heading font-bold leading-[0.88] tracking-[-0.045em] text-[#C8323C]"
          style={{ fontSize: "clamp(96px, 32vw, 136px)" }}
        >
          {shown}%
        </p>
        <p
          className="mt-3 font-heading font-bold leading-[1.2] tracking-[-0.01em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(20px, 5.4vw, 24px)", maxWidth: 360 }}
        >
          de los deptos de inversión pierden plata cada mes.
        </p>
        <p
          className="mt-3 font-heading leading-[1.35] tracking-[-0.005em] text-[var(--landing-text)]"
          style={{ fontSize: 16, fontWeight: 600, maxWidth: 360 }}
        >
          <span style={{ fontWeight: 700 }}>$240.000</span> al mes.{" "}
          <span style={{ fontWeight: 700 }}>$71 millones</span> acumulados en 25
          años.
        </p>
        <p
          className="mt-3 font-mono text-[var(--landing-text-muted)]"
          style={{
            fontSize: 9,
            letterSpacing: "0.04em",
            lineHeight: 1.5,
            maxWidth: 360,
          }}
        >
          n=12.944 · 24 comunas · pie 20% · crédito 25 años · tasa 4,5% UF
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ============================ Mobile · Cierre ============================ */

function MobileCierreBlock({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>;
}) {
  const line1OpacityMV = useMotionValue(0);
  const line2OpacityMV = useMotionValue(0);

  useEffect(() => {
    const update = (v: number) => {
      const t1 = clamp01(
        (v - M_CIERRE_L1_START) / (M_CIERRE_L1_END - M_CIERRE_L1_START),
      );
      line1OpacityMV.set(t1);
      const t2 = clamp01(
        (v - M_CIERRE_L2_START) / (M_CIERRE_L2_END - M_CIERRE_L2_START),
      );
      line2OpacityMV.set(t2);
    };
    update(scrollYProgress.get());
    const unsub = scrollYProgress.on("change", update);
    return () => unsub();
  }, [scrollYProgress, line1OpacityMV, line2OpacityMV]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6">
      <h3 className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]">
        <motion.span
          className="block"
          style={{
            opacity: line1OpacityMV,
            fontSize: "clamp(28px, 8vw, 38px)",
            lineHeight: 1.08,
          }}
        >
          Antes, comprar era seguro.
        </motion.span>
        <motion.span
          className="block"
          style={{
            opacity: line2OpacityMV,
            fontSize: "clamp(28px, 8vw, 38px)",
            lineHeight: 1.08,
          }}
        >
          Hoy, hay que <span className="text-[#C8323C]">analizar.</span>
        </motion.span>
      </h3>
    </div>
  );
}

/* ============================ Reduced motion fallback ============================ */

function ReducedMotionFallback() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-[1280px] px-8 py-[12vh]">
        <p
          className="font-mono font-medium uppercase text-[#C8323C]"
          style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 16 }}
        >
          02 · El problema
        </p>
        <h2
          className="font-heading font-bold leading-[1.04] tracking-[-0.02em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(48px, 6vw, 72px)", maxWidth: 820 }}
        >
          La matemática del depto<br />de inversión{" "}
          <span className="text-[#C8323C]">cambió.</span>
        </h2>
        <p
          className="mt-4 font-body text-[var(--landing-text-secondary)]"
          style={{ fontSize: 16, lineHeight: 1.5, maxWidth: 540 }}
        >
          Antes los números calzaban. Hoy no.
        </p>

        <div className="mt-14 space-y-12">
          {STATS.map((s) => (
            <div
              key={s.id}
              className="grid items-center"
              style={{
                gridTemplateColumns: "clamp(240px, 26vw, 380px) 1fr",
                columnGap: 32,
              }}
            >
              <p
                className="font-heading font-bold leading-[0.9] tracking-[-0.04em]"
                style={{
                  fontSize: "clamp(72px, 8.4vw, 116px)",
                  color: s.color,
                }}
              >
                {s.big}
              </p>
              <div>
                <p
                  className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    marginBottom: 6,
                  }}
                >
                  {s.id}
                </p>
                <p
                  className="font-heading font-bold leading-[1.15] tracking-[-0.01em] text-[var(--landing-text)]"
                  style={{
                    fontSize: "clamp(20px, 1.8vw, 26px)",
                    marginBottom: s.kickerSub ? 4 : 8,
                  }}
                >
                  {s.kicker}
                </p>
                {s.kickerSub && (
                  <p
                    className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      marginBottom: 8,
                    }}
                  >
                    {s.kickerSub}
                  </p>
                )}
                <p
                  className="font-body text-[var(--landing-text-muted)]"
                  style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 420 }}
                >
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[10vh] flex flex-col items-center text-center">
          <p
            className="font-mono font-medium uppercase text-[#C8323C]"
            style={{ fontSize: 11, letterSpacing: "0.18em", marginBottom: 10 }}
          >
            Resultado
          </p>
          <p
            className="font-heading font-bold leading-[0.88] tracking-[-0.045em] text-[#C8323C]"
            style={{ fontSize: "clamp(140px, 15.5vw, 220px)" }}
          >
            92,1%
          </p>
          <p
            className="mt-4 max-w-[640px] font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
            style={{ fontSize: "clamp(22px, 2.6vw, 36px)" }}
          >
            de los deptos de inversión pierden plata cada mes.
          </p>
          <p
            className="mt-4 max-w-[640px] font-heading leading-[1.3] tracking-[-0.005em] text-[var(--landing-text)]"
            style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 600 }}
          >
            <span style={{ fontWeight: 700 }}>$240.000</span> al mes.{" "}
            <span style={{ fontWeight: 700 }}>$71 millones</span> acumulados en
            25 años.
          </p>
          <p
            className="mt-5 max-w-[720px] font-mono text-[var(--landing-text-muted)]"
            style={{ fontSize: 11, letterSpacing: "0.06em", lineHeight: 1.55 }}
          >
            n=12.944 · 24 comunas Gran Santiago · pie 20% · crédito 25 años ·
            tasa 4,5% UF · gastos 31,7%
          </p>
        </div>

        <h3
          className="mt-[10vh] max-w-[880px] font-heading font-bold leading-[1.04] tracking-[-0.02em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(40px, 5.2vw, 72px)" }}
        >
          <span className="block">Antes, comprar era seguro.</span>
          <span className="block">
            Hoy, hay que <span className="text-[#C8323C]">analizar.</span>
          </span>
        </h3>
      </div>
    </section>
  );
}
