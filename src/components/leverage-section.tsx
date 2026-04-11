"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";

// ============================================================
// Constants
// ============================================================
const PRECIO = 120_000_000;
const PIE = PRECIO * 0.2;
const CREDITO = PRECIO * 0.8;
const TASA_ANUAL = 4.72;
const TASA_MENSUAL = TASA_ANUAL / 100 / 12;
const PLAZO_MESES = 300;
const ARRIENDO = 420_000;
const COSTOS_MENSUALES = 145_000;
const DIVIDENDO =
  CREDITO *
  (TASA_MENSUAL * Math.pow(1 + TASA_MENSUAL, PLAZO_MESES)) /
  (Math.pow(1 + TASA_MENSUAL, PLAZO_MESES) - 1);
const FLUJO_MENSUAL = ARRIENDO - DIVIDENDO - COSTOS_MENSUALES;

// ============================================================
// Helpers
// ============================================================
function calcLeverageData(horizon: number, plusvaliaPct: number) {
  const plusv = plusvaliaPct / 100;
  const points = [];
  for (let y = 0; y <= horizon; y++) {
    const valorProp = PRECIO * Math.pow(1 + plusv, y);
    const meses = y * 12;
    const saldo =
      meses === 0
        ? CREDITO
        : CREDITO *
          (Math.pow(1 + TASA_MENSUAL, PLAZO_MESES) -
            Math.pow(1 + TASA_MENSUAL, meses)) /
          (Math.pow(1 + TASA_MENSUAL, PLAZO_MESES) - 1);
    const patrimonio = valorProp - saldo;
    const bolsillo = FLUJO_MENSUAL * meses;
    const totalInv = PIE + Math.abs(bolsillo);
    const retorno = totalInv > 0 ? patrimonio / totalInv : 0;
    points.push({ y, valorProp, saldo, patrimonio, bolsillo, totalInv, retorno });
  }
  return points;
}

function fmtMonto(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtChart(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

// ============================================================
// FadeIn
// ============================================================
function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// StepNumber
// ============================================================
function StepNumber({ n }: { n: number }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-th-page">
      <span className="font-mono text-[13px] font-bold text-white">{n}</span>
    </div>
  );
}

// ============================================================
// Stacked bar column (reusable for step 3 and interactive)
// ============================================================
function BarColumn({
  patrimonio,
  saldo,
  maxVal,
  year,
  showLabel,
  chartHeight = 170,
  showDebtLabel = true,
}: {
  patrimonio: number;
  saldo: number;
  maxVal: number;
  year: number;
  showLabel: boolean;
  chartHeight?: number;
  showDebtLabel?: boolean;
}) {
  const barH = chartHeight - 10;
  const patrimonioH = Math.max(18, (patrimonio / maxVal) * barH);
  const deudaH = Math.max(14, (saldo / maxVal) * barH);
  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="mb-1 font-mono text-[8px] text-[#71717A] md:text-[9px]">
        Año {year}
      </p>
      <div
        className="flex w-full flex-col justify-end gap-px"
        style={{ height: chartHeight }}
      >
        <div
          className="flex min-h-[18px] items-center justify-center rounded-t-md"
          style={{
            height: `${patrimonioH}px`,
            background: "linear-gradient(180deg, #0F0F0F, #2A2A2A)",
          }}
        >
          {showLabel && (
            <span className="font-mono text-[7px] text-white md:text-[8px]">
              {fmtChart(patrimonio)}
            </span>
          )}
        </div>
        <div
          className="flex min-h-[14px] items-center justify-center rounded-b-md border border-[#C8323C]/[0.09] bg-[#C8323C]/[0.09]"
          style={{ height: `${deudaH}px` }}
        >
          {showDebtLabel && showLabel && (
            <span className="font-mono text-[6px] text-[#C8323C]/50 md:text-[7px]">
              {fmtChart(saldo)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Pre-computed static data
// ============================================================
const data10 = calcLeverageData(10, 4);
const dividendoGastos = Math.round(DIVIDENDO + COSTOS_MENSUALES);
const flujoNeto = Math.round(FLUJO_MENSUAL);
const flujoNetoAbs = Math.abs(flujoNeto);
const bolsillo12 = Math.abs(flujoNeto * 12);
const last10 = data10[data10.length - 1];
const maxValorProp10 = data10[10].valorProp;

// Step 3 data
const step3AllYears = data10.filter((d) => d.y >= 1); // years 1-10
const step3MobileYears = data10.filter((d) => [1, 3, 5, 7, 10].includes(d.y));

// ============================================================
// Main Component
// ============================================================
export default function LeverageSection() {
  const [horizon, setHorizon] = useState(10);
  const [plusvalia, setPlusvalia] = useState(4);
  const dynamicData = useMemo(
    () => calcLeverageData(horizon, plusvalia),
    [horizon, plusvalia]
  );
  const last = dynamicData[dynamicData.length - 1];
  const maxValorPropDynamic = dynamicData[dynamicData.length - 1].valorProp;

  // Mobile: filter bars for interactive chart
  const mobileData = useMemo(() => {
    if (horizon <= 10) return dynamicData;
    return dynamicData.filter(
      (d) => d.y === 0 || d.y === horizon || d.y % 2 === 0
    );
  }, [dynamicData, horizon]);

  return (
    <>
      {/* ============ HEADER ============ */}
      <section
        className="relative overflow-hidden px-6 py-16 pb-12"
        style={{
          background:
            "linear-gradient(160deg, #0F0F0F 0%, #1A1A2E 50%, #2A2A2A 100%)",
        }}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#C8323C]/[0.03] blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <FadeIn>
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#C8323C]">
              APALANCAMIENTO INMOBILIARIO
            </p>
            <h2 className="font-heading text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-[34px]">
              ¿Por qué invertir en un depto que pierde plata cada mes?
            </h2>
            <p className="mt-3.5 max-w-lg font-body text-[15px] leading-relaxed text-white/45">
              Porque el flujo negativo no es toda la historia. Es el precio de
              entrada a algo mucho más grande. Te lo explicamos en 4 pasos.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ PASO 1 — Pones 20%, controlas 100% ============ */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <StepNumber n={1} />
              <div>
                <h3 className="font-heading text-[22px] font-bold tracking-tight text-[#0F0F0F]">
                  Pones 20%, controlas 100%
                </h3>
                <p className="mt-1 font-body text-[13px] text-[#71717A]">
                  Así funciona el apalancamiento hipotecario
                </p>
              </div>
            </div>

            {/* Visual blocks — full width, centered */}
            <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-center md:justify-center md:gap-12">
              {/* Left: blocks */}
              <div className="flex items-end justify-center gap-4">
                {/* 20% block */}
                <div className="z-10 -mr-1.5 text-center">
                  <p className="mb-1.5 font-mono text-xs font-semibold text-[#0F0F0F]">
                    $24.0M
                  </p>
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[10px] border-2 border-white/90 bg-[#C8323C] shadow-[0_2px_12px_rgba(200,50,60,0.2)] md:h-20 md:w-20">
                    <span className="font-mono text-[11px] font-bold text-white md:text-[13px]">
                      20%
                    </span>
                  </div>
                  <p className="mt-1.5 font-body text-[10px] text-[#71717A]">
                    Tu pie
                  </p>
                </div>

                {/* Arrow */}
                <span className="mb-6 px-2 font-body text-xl text-[#71717A]">
                  →
                </span>

                {/* 100% block */}
                <div className="text-center">
                  <p className="mb-1.5 font-mono text-xs font-semibold text-[#0F0F0F]">
                    $120.0M
                  </p>
                  <div
                    className="flex h-[140px] w-[140px] flex-col justify-between rounded-xl p-2.5 md:h-[170px] md:w-[170px] md:p-3"
                    style={{
                      background: "linear-gradient(135deg, #0F0F0F, #2A2A2A)",
                    }}
                  >
                    <p className="text-right font-mono text-[10px] text-white/30">
                      100%
                    </p>
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#C8323C] opacity-85 md:h-16 md:w-16">
                      <span className="font-mono text-[9px] font-semibold text-white">
                        20%
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 font-body text-[10px] text-[#71717A]">
                    Lo que controlas
                  </p>
                </div>
              </div>

              {/* Right: multiplier */}
              <div className="min-w-[160px] rounded-xl bg-[#FAFAF8] p-6 text-center md:min-w-[180px]">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#71717A]">
                  MULTIPLICADOR
                </p>
                <p className="font-heading text-[52px] font-bold leading-none text-[#0F0F0F]">
                  5x
                </p>
                <p className="mt-2.5 font-body text-[11px] leading-snug text-[#71717A]">
                  Cada 1% de plusvalía te renta 5% sobre tu pie
                </p>
              </div>
            </div>

            {/* Explanation */}
            <div className="mt-5 rounded-[10px] bg-[#FAFAF8] p-4 px-5">
              <p className="font-body text-sm leading-relaxed text-[#0F0F0F]">
                Con <strong>$24.0M</strong> de pie controlas un activo de{" "}
                <strong>$120.0M</strong>. Si la propiedad sube 4% en un año, eso
                son <strong>$4.8M</strong> de plusvalía — un 20% sobre tu pie.
                Eso es apalancamiento.
              </p>
            </div>
          </FadeIn>
        </div>

        {/* Separator */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="h-px bg-[#E6E6E2]" />
        </div>
      </section>

      {/* ============ PASO 2 — Sí, pierdes plata cada mes ============ */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <StepNumber n={2} />
              <div>
                <h3 className="font-heading text-[22px] font-bold tracking-tight text-[#0F0F0F]">
                  Sí, pierdes plata cada mes
                </h3>
                <p className="mt-1 font-body text-[13px] text-[#71717A]">
                  El flujo negativo es el costo del apalancamiento
                </p>
              </div>
            </div>

            {/* Cards row */}
            <div className="mb-5 flex flex-col items-center gap-3 md:flex-row">
              <div className="w-full flex-1 rounded-xl bg-[#FAFAF8] p-4 text-center">
                <p className="mb-1.5 font-body text-[10px] uppercase tracking-wide text-[#71717A]">
                  ARRIENDO
                </p>
                <p className="font-mono text-[22px] font-semibold text-[#0F0F0F]">
                  +$420K
                </p>
              </div>

              <span className="font-mono text-lg text-[#E6E6E2]">−</span>

              <div className="w-full flex-1 rounded-xl bg-[#FAFAF8] p-4 text-center">
                <p className="mb-1.5 font-body text-[10px] uppercase tracking-wide text-[#71717A]">
                  DIVIDENDO + GASTOS
                </p>
                <p className="font-mono text-[22px] font-semibold text-[#C8323C]">
                  −{fmtMonto(dividendoGastos)}
                </p>
              </div>

              <span className="font-mono text-lg text-[#E6E6E2]">=</span>

              <div className="w-full flex-1 rounded-xl border-2 border-[#C8323C] bg-white p-4 text-center">
                <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wide text-[#C8323C]">
                  FLUJO NETO
                </p>
                <p className="font-mono text-[22px] font-bold text-[#C8323C]">
                  −{fmtMonto(flujoNetoAbs)}
                </p>
                <p className="mt-0.5 font-body text-[9px] text-[#71717A]">
                  por mes
                </p>
              </div>
            </div>

            {/* Insight */}
            <div className="rounded-[10px] border-l-[3px] border-[#C8323C] bg-[#C8323C]/[0.04] p-4 px-5">
              <p className="font-body text-sm leading-relaxed text-[#0F0F0F]">
                Este depto te cuesta{" "}
                <strong className="text-[#C8323C]">
                  {fmtMonto(flujoNetoAbs)}/mes
                </strong>{" "}
                de tu bolsillo. En un año son {fmtMonto(bolsillo12)}.{" "}
                <strong>Eso es lo que tu corredor no te dice.</strong> Pero no es
                toda la historia.
              </p>
            </div>
          </FadeIn>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="h-px bg-[#E6E6E2]" />
        </div>
      </section>

      {/* ============ PASO 3 — Mientras tanto, dos cosas pasan ============ */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <StepNumber n={3} />
              <div>
                <h3 className="font-heading text-[22px] font-bold tracking-tight text-[#0F0F0F]">
                  Mientras tanto, dos cosas pasan
                </h3>
                <p className="mt-1 font-body text-[13px] text-[#71717A]">
                  La propiedad sube y la deuda baja — la brecha es tu patrimonio
                </p>
              </div>
            </div>

            {/* Desktop chart: all 10 years */}
            <div className="mb-4 hidden gap-1.5 md:flex">
              {step3AllYears.map((d) => (
                <BarColumn
                  key={d.y}
                  patrimonio={d.patrimonio}
                  saldo={d.saldo}
                  maxVal={maxValorProp10}
                  year={d.y}
                  showLabel={true}
                  chartHeight={170}
                />
              ))}
            </div>

            {/* Mobile chart: 5 key years */}
            <div className="mb-4 flex gap-2 md:hidden">
              {step3MobileYears.map((d) => (
                <BarColumn
                  key={d.y}
                  patrimonio={d.patrimonio}
                  saldo={d.saldo}
                  maxVal={maxValorProp10}
                  year={d.y}
                  showLabel={true}
                  chartHeight={150}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="mb-4 flex justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-th-page" />
                <span className="font-body text-[10px] text-[#71717A]">
                  Tu patrimonio (sube)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm border border-[#C8323C]/20 bg-[#C8323C]/[0.12]" />
                <span className="font-body text-[10px] text-[#71717A]">
                  Deuda hipotecaria (baja)
                </span>
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-[10px] bg-[#FAFAF8] p-4 px-5">
              <p className="font-body text-sm leading-relaxed text-[#0F0F0F]">
                Cada mes, la propiedad vale más (plusvalía) y tu deuda baja
                (amortización).{" "}
                <strong>
                  La brecha entre ambas es tu patrimonio, y crece
                  aceleradamente.
                </strong>{" "}
                En 10 años pasas de $24.0M a {fmtMonto(last10.patrimonio)} de
                patrimonio neto.
              </p>
            </div>
          </FadeIn>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="h-px bg-[#E6E6E2]" />
        </div>
      </section>

      {/* ============ PASO 4 — El balance final ============ */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <StepNumber n={4} />
              <div>
                <h3 className="font-heading text-[22px] font-bold tracking-tight text-[#0F0F0F]">
                  El balance final
                </h3>
                <p className="mt-1 font-body text-[13px] text-[#71717A]">
                  Lo que perdiste mensual vs lo que ganaste en patrimonio
                </p>
              </div>
            </div>

            {/* Two cards */}
            <div className="mb-4 flex flex-col gap-3.5 md:flex-row">
              <div className="flex-1 rounded-xl border border-[#E6E6E2] bg-white p-5">
                <p className="mb-3.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#C8323C]">
                  LO QUE PUSISTE (10 AÑOS)
                </p>
                <div className="mb-2 flex justify-between">
                  <span className="font-body text-sm text-[#71717A]">Pie inicial</span>
                  <span className="font-mono text-sm text-[#0F0F0F]">{fmtMonto(PIE)}</span>
                </div>
                <div className="mb-2.5 flex justify-between">
                  <span className="font-body text-sm text-[#71717A]">Bolsillo acumulado</span>
                  <span className="font-mono text-sm text-[#C8323C]">{fmtMonto(Math.abs(last10.bolsillo))}</span>
                </div>
                <div className="border-t border-[#E6E6E2] pt-2.5">
                  <div className="flex justify-between">
                    <span className="font-body text-sm font-semibold">Total invertido</span>
                    <span className="font-mono text-sm font-bold text-[#0F0F0F]">{fmtMonto(last10.totalInv)}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 rounded-xl border-2 border-[#0F0F0F] bg-white p-5">
                <p className="mb-3.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#0F0F0F]">
                  LO QUE TIENES (AÑO 10)
                </p>
                <div className="mb-2 flex justify-between">
                  <span className="font-body text-sm text-[#71717A]">Valor propiedad</span>
                  <span className="font-mono text-sm text-[#0F0F0F]">{fmtMonto(last10.valorProp)}</span>
                </div>
                <div className="mb-2.5 flex justify-between">
                  <span className="font-body text-sm text-[#71717A]">Deuda restante</span>
                  <span className="font-mono text-sm text-[#C8323C]">−{fmtMonto(last10.saldo)}</span>
                </div>
                <div className="border-t border-[#E6E6E2] pt-2.5">
                  <div className="flex justify-between">
                    <span className="font-body text-sm font-semibold">Patrimonio neto</span>
                    <span className="font-mono text-sm font-bold text-[#0F0F0F]">{fmtMonto(last10.patrimonio)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Return bar */}
            <div
              className="flex flex-col items-center justify-between gap-4 rounded-xl p-6 md:flex-row"
              style={{ background: "linear-gradient(135deg, #0F0F0F, #2A2A2A)" }}
            >
              <div className="font-body text-[13px] leading-relaxed text-white/55">
                <p>Invertiste {fmtMonto(last10.totalInv)} en 10 años (pie + flujo negativo).</p>
                <p>
                  Tu patrimonio neto:{" "}
                  <span className="font-bold text-white">{fmtMonto(last10.patrimonio)}</span>
                </p>
              </div>
              <div className="text-center">
                <p className="font-heading text-[44px] font-bold leading-none text-white">
                  {last10.retorno.toFixed(1)}x
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-[#C8323C]">
                  RETORNO
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ INTERACTIVO — Juega con los números ============ */}
      <section className="border-t border-[#E6E6E2] bg-[#FAFAF8] px-5 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-7 text-center">
              <h3 className="font-heading text-[22px] font-bold tracking-tight text-[#0F0F0F]">
                Juega con los números
              </h3>
              <p className="mt-1.5 font-body text-[13px] text-[#71717A]">
                Mueve los sliders y ve cómo cambia el retorno de esta inversión.
              </p>
            </div>

            {/* Sliders card */}
            <div className="mb-7 rounded-xl border border-[#E6E6E2] bg-white p-5">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-xs font-semibold text-[#0F0F0F]">
                      Horizonte de venta
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#0F0F0F]">
                      {horizon} años
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#0F0F0F" }}
                  />
                  <div className="flex justify-between">
                    <span className="font-mono text-[9px] text-[#71717A]">1</span>
                    <span className="font-mono text-[9px] text-[#71717A]">20</span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-xs font-semibold text-[#0F0F0F]">
                      Plusvalía anual
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#C8323C]">
                      {plusvalia}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={0.5}
                    value={plusvalia}
                    onChange={(e) => setPlusvalia(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#C8323C" }}
                  />
                  <div className="flex justify-between">
                    <span className="font-mono text-[9px] text-[#71717A]">0%</span>
                    <span className="font-mono text-[9px] text-[#71717A]">8%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic chart */}
            <div className="mb-4 rounded-xl border border-[#E6E6E2] bg-white p-4 md:p-6">
              {/* Title + legend */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="font-body text-sm font-semibold text-[#0F0F0F]">
                  Evolución de tu patrimonio
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-th-page" />
                    <span className="font-body text-[9px] text-[#71717A]">Patrimonio</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm border border-[#C8323C]/30 bg-[#C8323C]/20" />
                    <span className="font-body text-[9px] text-[#71717A]">Deuda</span>
                  </div>
                </div>
              </div>

              {/* Desktop: all bars */}
              <div className="hidden md:block">
                <div className="flex gap-1">
                  {dynamicData.map((d) => {
                    const patrimonioH = Math.max(14, (d.patrimonio / maxValorPropDynamic) * 140);
                    const deudaH = Math.max(10, (d.saldo / maxValorPropDynamic) * 140);
                    return (
                      <div key={d.y} className="flex flex-1 flex-col items-center">
                        <div className="flex w-full flex-col justify-end gap-px" style={{ height: 160 }}>
                          <div
                            className="flex min-h-[14px] items-center justify-center rounded-t-sm"
                            style={{
                              height: `${patrimonioH}px`,
                              background: "linear-gradient(180deg, #0F0F0F, #2A2A2A)",
                              transition: "height 0.3s",
                            }}
                          >
                            {patrimonioH > 15 && (
                              <span className="font-mono text-[6px] text-white md:text-[7px]">
                                {fmtChart(d.patrimonio)}
                              </span>
                            )}
                          </div>
                          <div
                            className="flex min-h-[10px] items-center justify-center rounded-b-sm border border-[#C8323C]/[0.09] bg-[#C8323C]/[0.07]"
                            style={{
                              height: `${deudaH}px`,
                              transition: "height 0.3s",
                            }}
                          >
                            {deudaH > 15 && (
                              <span className="font-mono text-[6px] text-[#C8323C]/50 md:text-[7px]">
                                {fmtChart(d.saldo)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* X axis labels */}
                <div className="mt-1.5 flex">
                  {dynamicData.map((d) => (
                    <div key={d.y} className="flex-1 text-center">
                      <span className="font-mono text-[8px] text-[#71717A]">
                        {d.y}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: filtered bars */}
              <div className="md:hidden">
                <div className="flex gap-1.5">
                  {mobileData.map((d) => {
                    const patrimonioH = Math.max(12, (d.patrimonio / maxValorPropDynamic) * 120);
                    const deudaH = Math.max(8, (d.saldo / maxValorPropDynamic) * 120);
                    return (
                      <div key={d.y} className="flex flex-1 flex-col items-center">
                        <div className="flex w-full flex-col justify-end gap-px" style={{ height: 140 }}>
                          <div
                            className="flex min-h-[12px] items-center justify-center rounded-t-sm"
                            style={{
                              height: `${patrimonioH}px`,
                              background: "linear-gradient(180deg, #0F0F0F, #2A2A2A)",
                              transition: "height 0.3s",
                            }}
                          >
                            {patrimonioH > 15 && (
                              <span className="font-mono text-[6px] text-white">
                                {fmtChart(d.patrimonio)}
                              </span>
                            )}
                          </div>
                          <div
                            className="flex min-h-[8px] items-center justify-center rounded-b-sm border border-[#C8323C]/[0.09] bg-[#C8323C]/[0.07]"
                            style={{
                              height: `${deudaH}px`,
                              transition: "height 0.3s",
                            }}
                          >
                            {deudaH > 15 && (
                              <span className="font-mono text-[5px] text-[#C8323C]/50">
                                {fmtChart(d.saldo)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Mobile X axis */}
                <div className="mt-1.5 flex">
                  {mobileData.map((d) => (
                    <div key={d.y} className="flex-1 text-center">
                      <span className="font-mono text-[7px] text-[#71717A]">{d.y}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3 result cards */}
            <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <div className="rounded-xl border border-[#E6E6E2] bg-white p-4 text-center">
                <p className="mb-1 font-body text-[9px] uppercase text-[#71717A]">
                  BOLSILLO ({horizon}A)
                </p>
                <p
                  className="font-mono text-lg font-bold text-[#C8323C] md:text-xl"
                  style={{ transition: "all 0.3s" }}
                >
                  −{fmtMonto(Math.abs(last.bolsillo))}
                </p>
                <p className="mt-0.5 font-body text-[9px] text-[#71717A]">
                  flujo negativo acumulado
                </p>
              </div>

              <div className="rounded-xl border border-[#E6E6E2] bg-white p-4 text-center">
                <p className="mb-1 font-body text-[9px] uppercase text-[#71717A]">
                  PATRIMONIO ({horizon}A)
                </p>
                <p className="font-mono text-lg font-bold text-[#0F0F0F] md:text-xl">
                  {fmtMonto(last.patrimonio)}
                </p>
                <p className="mt-0.5 font-body text-[9px] text-[#71717A]">
                  patrimonio neto
                </p>
              </div>

              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "linear-gradient(135deg, #0F0F0F, #2A2A2A)" }}
              >
                <p className="mb-1 font-body text-[9px] uppercase text-white/35">RETORNO</p>
                <p className="font-heading text-[24px] font-bold text-white md:text-[28px]">
                  {last.retorno.toFixed(1)}x
                </p>
                <p className="mt-0.5 font-body text-[9px] text-white/35">sobre tu inversión</p>
              </div>
            </div>

            {/* Dynamic insight */}
            <div className="mt-4 rounded-[10px] border-l-[3px] border-[#C8323C] bg-[#C8323C]/[0.03] p-3.5 px-4">
              <p className="font-body text-[13px] leading-relaxed text-[#0F0F0F]">
                <span className="font-semibold">Siendo franco:</span>{" "}
                {last.retorno >= 2.5 ? (
                  <>
                    Con {plusvalia}% de plusvalía y {horizon} años, este depto
                    multiplica tu inversión {last.retorno.toFixed(1)}x. El flujo
                    negativo se paga solo.
                  </>
                ) : last.retorno >= 1.5 ? (
                  <>
                    Retorno de {last.retorno.toFixed(1)}x en {horizon} años.
                    Positivo, pero ajustado. Si puedes negociar mejor precio,
                    mejora bastante.
                  </>
                ) : last.retorno >= 1 ? (
                  <>
                    Apenas {last.retorno.toFixed(1)}x en {horizon} años.{" "}
                    <span className="font-semibold text-[#C8323C]">
                      Mucho riesgo para poco retorno.
                    </span>{" "}
                    Negocia o busca otra cosa.
                  </>
                ) : (
                  <span className="font-semibold text-[#C8323C]">
                    Pierdes plata incluso con plusvalía de {plusvalia}%. Este
                    depto no da en este escenario.
                  </span>
                )}
              </p>
            </div>

            {/* CTA */}
            <div className="mt-7 text-center">
              <p className="mb-3 font-body text-[13px] text-[#71717A]">
                ¿Quieres ver estos números con tu propiedad real?
              </p>
              <Link href="/analisis/nuevo">
                <button className="rounded-lg bg-th-page px-7 py-3 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  Analizar mi propiedad gratis →
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
