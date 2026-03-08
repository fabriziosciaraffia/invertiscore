"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Menu,
  X as XIcon,
  LogOut,
  ShieldCheck,
  Database,
  Bot,
  AlertTriangle,
  ChevronDown,
  LayoutDashboard,
  Award,
  TrendingDown,
  LineChart,
  ArrowRightLeft,
  SlidersHorizontal,
  MapPin,
  Scale,
  Briefcase,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// ============================================================
// FadeIn — standard slide-up, 30px, 0.6s desktop / 0.4s mobile
// ============================================================
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-gpu ${className}`}
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
// SlideIn — horizontal slide for desktop, fallback to slide-up on mobile
// ============================================================
function SlideIn({ children, className = "", delay = 0, direction = "left" }: { children: React.ReactNode; className?: string; delay?: number; direction?: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hiddenTransform = isMobile
    ? "translateY(30px)"
    : direction === "left" ? "translateX(-40px)" : "translateX(40px)";
  const duration = isMobile ? "0.4s" : "0.6s";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0)" : hiddenTransform,
        transition: `opacity ${duration} ease-out ${delay}ms, transform ${duration} ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// Tooltip icon (?) for fields with extra info
// ============================================================
function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<"above" | "below">("above");

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 120 ? "below" : "above");
    }
  }, [show]);

  return (
    <span ref={ref} className="relative ml-1 inline-flex">
      <span
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] font-medium leading-none text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-600"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </span>
      {show && (
        <span
          className={`absolute z-50 w-[220px] sm:w-[250px] rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg ${
            pos === "above" ? "bottom-full mb-2" : "top-full mt-2"
          } left-1/2 -translate-x-1/2`}
        >
          {text}
          <span className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            pos === "above" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900"
          }`} />
        </span>
      )}
    </span>
  );
}

// ============================================================
// Tab content components for preview section
// ============================================================
function TabComparacion() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        El mismo presupuesto, tres resultados muy distintos. El score te dice cuáles valen la pena.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:gap-6 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none">
        {[
          {
            score: 45, color: "#ef4444", label: "Inversión Débil",
            title: "Depto 1D1B · Santiago Centro",
            info: "UF 2.100 · 32m² · $320.000/mes",
            metrics: [
              { l: "Yield bruto", v: "3.2%", c: "text-red-500" },
              { l: "Flujo mensual", v: "-$380.000", c: "text-red-500" },
              { l: "Cash-on-Cash", v: "-24%", c: "text-red-500" },
            ],
            tag: "Oversupply en la zona, flujo muy negativo",
            tagIcon: "warning",
            borderColor: "border-red-300",
            bgScore: "bg-red-50",
          },
          {
            score: 58, color: "#f59e0b", label: "Inversión Regular",
            title: "Depto 2D1B · Providencia",
            info: "UF 3.200 · 55m² · $420.000/mes",
            metrics: [
              { l: "Yield bruto", v: "4.1%", c: "text-orange-500" },
              { l: "Flujo mensual", v: "-$416.000", c: "text-red-500" },
              { l: "Cash-on-Cash", v: "-20%", c: "text-red-500" },
            ],
            tag: "Flujo negativo pero plusvalía alta compensa a largo plazo",
            tagIcon: "chart",
            borderColor: "border-amber-300",
            bgScore: "bg-amber-50",
          },
          {
            score: 78, color: "#059669", label: "Inversión Buena",
            title: "Depto 2D2B · La Florida",
            info: "UF 2.400 · 50m² · $380.000/mes",
            metrics: [
              { l: "Yield bruto", v: "5.8%", c: "text-[#059669]" },
              { l: "Flujo mensual", v: "+$45.000", c: "text-[#059669]" },
              { l: "Cash-on-Cash", v: "3.2%", c: "text-[#059669]" },
            ],
            tag: "Flujo positivo, buena rentabilidad, zona en crecimiento",
            tagIcon: "check",
            borderColor: "border-[#059669]/40",
            bgScore: "bg-emerald-50",
          },
        ].map((card) => (
          <div
            key={card.score}
            className={`h-full min-w-[240px] shrink-0 snap-center rounded-2xl border ${card.borderColor} bg-white p-4 transition-all duration-200 hover:shadow-lg sm:min-w-[280px] sm:p-7 md:min-w-0 md:shrink`}
            style={card.score === 78 ? { boxShadow: "0 4px 20px rgba(5,150,105,0.1)" } : {}}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${card.bgScore} sm:h-[52px] sm:w-[52px] sm:border-[2.5px]`} style={{ borderColor: card.color }}>
                <div className="text-center">
                  <div className="text-base font-bold sm:text-xl" style={{ color: card.color }}>{card.score}</div>
                  <div className="text-[7px] text-[#9ca3af]">SCORE</div>
                </div>
              </div>
              <div>
                <div className="text-[13px] font-medium" style={{ color: card.color }}>{card.label}</div>
                <div className="text-[15px] font-semibold text-[#111827]">{card.title}</div>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#9ca3af]">{card.info}</p>
            <div className="mt-5 space-y-2.5">
              {card.metrics.map((m) => (
                <div key={m.l} className="flex items-center justify-between text-[14px]">
                  <span className="text-[#6b7280]">{m.l}</span>
                  <span className={`font-semibold ${m.c}`}>{m.v}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-[#fafafa] p-3 text-[13px] text-[#6b7280]">
              <span>{card.tagIcon === "warning" ? "\u26A0\uFE0F" : card.tagIcon === "chart" ? "\uD83D\uDCCA" : "\u2705"} {card.tag}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-[#6b7280]">
        Mismo rango de precio. Resultados completamente distintos. ¿Cuál elegirías tú?
      </p>
    </div>
  );
}

function TabFlujoCaja({ animate }: { animate: boolean }) {
  const items = [
    { label: "Arriendo mensual", value: 420000, type: "income" as const },
    { label: "Dividendo hipotecario", value: -580000, type: "expense" as const },
    { label: "Gastos comunes", value: -65000, type: "expense" as const },
    { label: "Contribuciones (mens.)", value: -15000, type: "expense" as const },
    { label: "Seguro desgravamen", value: -12000, type: "expense" as const },
    { label: "Mantención estimada", value: -18000, type: "expense" as const },
    { label: "Vacancia (1 mes/año)", value: -35000, type: "expense" as const },
  ];
  const neto = items.reduce((sum, i) => sum + i.value, 0);
  const maxVal = 580000;
  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : "-";
    return `${sign}$${Math.abs(v).toLocaleString("es-CL")}`;
  };

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[1fr,280px] lg:grid-cols-[1fr,300px]">
        {/* Left — Waterfall */}
        <div
          className="rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:p-5"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
          }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Desglose mensual</div>
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const barW = (Math.abs(item.value) / maxVal) * 100;
              const isIncome = item.type === "income";
              return (
                <div key={i}>
                  {i === 1 && <div className="my-1.5 border-t border-dashed border-[#e5e7eb]" />}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-[140px] sm:w-[170px] shrink-0 text-[13px] text-[#6b7280] truncate">{item.label}</span>
                    <div className="flex-1 h-5 rounded bg-[#f9fafb] overflow-hidden">
                      <div
                        className={`h-full rounded ${isIncome ? "bg-[#059669]" : "bg-[#ef4444]"}`}
                        style={{
                          width: animate ? `${barW}%` : "0%",
                          transition: `width 0.5s ease-out ${i * 80}ms`,
                        }}
                      />
                    </div>
                    <span className={`w-[100px] sm:w-[110px] shrink-0 text-right font-mono text-[13px] font-medium ${isIncome ? "text-[#059669]" : "text-red-500"}`}>
                      {fmt(item.value)}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Neto */}
            <div className="mt-1.5 border-t border-dashed border-[#e5e7eb] pt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-[140px] sm:w-[170px] shrink-0 text-[13px] font-semibold text-[#1a1a1a]">FLUJO NETO MENSUAL</span>
                <div className="flex-1 h-6 rounded bg-red-50 overflow-hidden">
                  <div
                    className="h-full rounded bg-[#ef4444]"
                    style={{
                      width: animate ? `${(Math.abs(neto) / maxVal) * 100}%` : "0%",
                      transition: "width 0.5s ease-out 600ms",
                    }}
                  />
                </div>
                <span className="w-[100px] sm:w-[110px] shrink-0 text-right font-mono text-[13px] font-bold text-red-600">
                  {fmt(neto)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Summary */}
        <div
          className="flex flex-col justify-between rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-5"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out 300ms, transform 0.4s ease-out 300ms",
          }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Resultado</div>
            <div className="mt-3">
              <div className="text-xs text-[#6b7280]">Mensual</div>
              <div className="text-2xl font-bold text-red-600">{fmt(neto)}</div>
            </div>
            <div className="mt-2">
              <div className="text-xs text-[#6b7280]">Anual</div>
              <div className="text-lg font-bold text-red-600">{fmt(neto * 12)}</div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#6b7280]">
              Cada mes pones ${Math.abs(neto).toLocaleString("es-CL")} de tu bolsillo. En un año son ${Math.abs(neto * 12).toLocaleString("es-CL")}.
            </p>
          </div>
          <div className="mt-4 rounded-xl bg-[#ecfdf5] p-3">
            <p className="text-[13px] font-medium text-[#059669]">
              ¿Vale la pena? InvertiScore calcula si la plusvalía compensa este flujo negativo.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-[#9ca3af]">
        Ejemplo: Depto 2D1B en Providencia — UF 3.200, arriendo $420.000/mes
      </p>
    </div>
  );
}

function TabPatrimonio({ animate }: { animate: boolean }) {
  const milestones = [
    { label: "Hoy", value: "UF -200", color: "text-red-500", bg: "bg-white" },
    { label: "Año 5", value: "UF 0", sub: "Break-even", color: "text-amber-500", bg: "bg-white" },
    { label: "Año 10", value: "UF +800", sub: "~$31M CLP", color: "text-[#059669]", bg: "bg-white" },
  ];

  return (
    <div>
      <p className="mb-6 text-center text-[#6b7280]">
        Aunque pierdas flujo cada mes, tu patrimonio puede crecer significativamente.
      </p>
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Patrimonio neto proyectado</div>

        {/* Mini-cards */}
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
          }}
        >
          {milestones.map((m) => (
            <div key={m.label} className={`rounded-xl border border-[#e5e7eb] ${m.bg} p-3 text-center`}>
              <div className="text-[11px] text-[#9ca3af] sm:text-xs">{m.label}</div>
              <div className={`mt-1 text-lg font-bold sm:text-xl ${m.color}`}>{m.value}</div>
              {m.sub && <div className="text-[11px] text-[#9ca3af]">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div
          className="mt-5"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out 200ms, transform 0.4s ease-out 200ms",
          }}
        >
          <div className="relative">
            <div className="flex h-3 overflow-hidden rounded-full bg-[#f3f4f6]">
              {/* Red segment: 0-5 years */}
              <div
                className="bg-gradient-to-r from-red-400 to-red-300 transition-all duration-700 ease-out"
                style={{ width: animate ? "50%" : "0%" }}
              />
              {/* Green segment: 5-10 years */}
              <div
                className="bg-gradient-to-r from-[#059669] to-emerald-400 transition-all duration-700 ease-out delay-300"
                style={{ width: animate ? "50%" : "0%" }}
              />
            </div>
            {/* Break-even dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-[3px] border-white bg-amber-400 shadow-md transition-all duration-500"
              style={{
                left: animate ? "50%" : "0%",
                transform: `translate(-50%, -50%)`,
                transitionDelay: "400ms",
              }}
            />
          </div>
          {/* Labels */}
          <div className="mt-2 flex justify-between text-[11px] text-[#9ca3af] sm:text-xs">
            <span>Hoy</span>
            <span className="font-medium text-amber-500">Año 5 (Break-even)</span>
            <span>Año 10</span>
          </div>
          {/* Segment labels */}
          <div className="mt-1 flex text-[10px] sm:text-[11px]">
            <span className="w-1/2 text-center text-red-400">Recuperando inversión</span>
            <span className="w-1/2 text-center text-[#059669]">Generando ganancia</span>
          </div>
        </div>

        {/* Summary */}
        <div
          className="mt-4 rounded-xl bg-[#ecfdf5] p-3"
          style={{
            opacity: animate ? 1 : 0,
            transition: "opacity 0.4s ease-out 500ms",
          }}
        >
          <p className="text-sm text-[#059669]">
            En 5 años recuperas lo invertido. En 10 años, tu patrimonio neto crece UF +800 (~$31M CLP).
          </p>
        </div>
      </div>
    </div>
  );
}

function TabAnalisisIA({ animate }: { animate: boolean }) {
  const favorItems = [
    "Con pocos años de uso, la mantención debiera ser baja. Los gastos grandes (ascensores, fachada) aún están lejos.",
    "Zona con alta demanda de arriendo. Menos riesgo de vacancia y mejor potencial de plusvalía.",
    "El precio por m² está un 8% bajo el promedio de la zona, lo que da margen de negociación.",
  ];
  const atencionItems = [
    "El retorno neto (CAP rate 1.5%) está bajo el promedio. Podrías negociar el precio de compra.",
    "Cada mes tendrás que poner $416.788 de tu bolsillo para cubrir los costos.",
  ];
  const veredicto = "La inversión apuesta a la plusvalía futura. El arriendo cubre solo la mitad de los costos — negociar el precio mejoraría los números.";

  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        Sin jerga financiera. Sin letra chica. La verdad en español.
      </p>
      <div className="mx-auto max-w-3xl space-y-4">
        {/* A favor */}
        <div
          className="rounded-2xl border border-[#e5e7eb] bg-white p-5"
          style={{
            borderLeft: "4px solid #059669",
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
          }}
        >
          <h3 className="mb-3 text-sm font-semibold text-[#059669]">A favor</h3>
          <ul className="space-y-2.5">
            {favorItems.map((text, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-[#374151]"
                style={{
                  opacity: animate ? 1 : 0,
                  transform: animate ? "translateY(0)" : "translateY(10px)",
                  transition: `opacity 0.4s ease-out ${(i + 1) * 200}ms, transform 0.4s ease-out ${(i + 1) * 200}ms`,
                }}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]"><Check className="h-3 w-3 text-[#059669]" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        {/* Atención */}
        <div
          className="rounded-2xl border border-[#e5e7eb] bg-white p-5"
          style={{
            borderLeft: "4px solid #ef4444",
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out 600ms, transform 0.4s ease-out 600ms",
          }}
        >
          <h3 className="mb-3 text-sm font-semibold text-red-500">Atención</h3>
          <ul className="space-y-2.5">
            {atencionItems.map((text, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-[#374151]"
                style={{
                  opacity: animate ? 1 : 0,
                  transform: animate ? "translateY(0)" : "translateY(10px)",
                  transition: `opacity 0.4s ease-out ${800 + i * 200}ms, transform 0.4s ease-out ${800 + i * 200}ms`,
                }}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-3 w-3 text-red-500" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        {/* Veredicto */}
        <div
          className="rounded-2xl border border-[#e5e7eb] bg-[#f0f7ff] p-5"
          style={{
            borderLeft: "4px solid #3b82f6",
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out 1200ms, transform 0.4s ease-out 1200ms",
          }}
        >
          <h3 className="mb-2 text-sm font-semibold text-[#3b82f6]">Veredicto</h3>
          <p className="text-sm leading-relaxed text-[#374151]">
            {veredicto}
            <span
              className="ml-0.5 inline-block h-4 w-0.5 bg-[#3b82f6] align-middle"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          </p>
        </div>
        {/* CTA */}
        <div className="text-center pt-2">
          <Link href="/register" className="inline-flex items-center gap-1 text-sm font-medium text-[#059669] transition-colors hover:text-[#047857] hover:underline">
            Ver análisis completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TabSensibilidad({ animate }: { animate: boolean }) {
  const sliders = [
    { label: "Tasa", low: "3.5%", mid: "4.5%", high: "5.5%", pos: 50 },
    { label: "Vacancia", low: "0 mes", mid: "1 mes", high: "2 mes", pos: 33 },
    { label: "Plusvalía", low: "2%", mid: "4%", high: "6%", pos: 50 },
  ];

  const table = {
    headers: ["0 vac.", "1 mes", "2 mes"],
    rows: [
      { label: "3.5%", values: ["-$180K", "-$215K", "-$250K"], bgs: ["bg-green-50", "bg-yellow-50", "bg-yellow-50"], colors: ["text-green-700", "text-yellow-700", "text-yellow-700"] },
      { label: "4.5%", values: ["-$320K", "-$380K", "-$416K"], bgs: ["bg-yellow-50", "bg-red-50", "bg-red-50"], colors: ["text-yellow-700", "text-red-700", "text-red-700"] },
      { label: "5.5%", values: ["-$480K", "-$540K", "-$621K"], bgs: ["bg-red-50", "bg-red-50", "bg-red-100"], colors: ["text-red-700", "text-red-700", "text-red-800"] },
    ],
  };

  return (
    <div>
      <p className="mb-5 text-center text-[#6b7280]">
        Mira qué pasa si suben las tasas, baja el arriendo, o tienes meses sin arrendatario.
      </p>
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Sliders — horizontal row on desktop */}
        <div
          className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-3 sm:grid-cols-3 sm:p-4"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
          }}
        >
          {sliders.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-[#374151]">{s.label}</span>
                <span className="text-sm font-bold text-[#059669]">{s.mid}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#059669]/20 via-[#f59e0b]/20 to-[#ef4444]/20">
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-[#059669] shadow"
                  style={{ left: `${s.pos}%`, transform: "translate(-50%, -50%)" }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] text-[#9ca3af]">
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 3x3 Scenario table — compact */}
        <div
          className="rounded-2xl border border-[#e5e7eb] bg-white p-3 sm:p-4"
          style={{
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease-out 250ms, transform 0.4s ease-out 250ms",
          }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Flujo mensual por escenario</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="pb-1.5 pr-2 text-left text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">Tasa</th>
                  {table.headers.map((h) => (
                    <th key={h} className="pb-1.5 px-2 text-center text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="py-1 pr-2 text-xs font-medium text-[#6b7280]">{row.label}</td>
                    {row.values.map((val, ci) => (
                      <td key={ci} className={`py-1 px-2 text-center rounded ${row.bgs[ci]}`}>
                        <span className={`text-sm font-semibold ${row.colors[ci]}`}>{val}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-[#9ca3af]">
            <span className="h-2 w-2 rounded-sm bg-green-50 border border-green-200" />
            <span>Menor pérdida</span>
            <span className="h-2 w-2 rounded-sm bg-red-100 border border-red-300 ml-1" />
            <span>Mayor pérdida</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-[#6b7280]">
        Pequeños cambios en la tasa o vacancia impactan fuerte en tu flujo. InvertiScore te muestra exactamente cuánto.
      </p>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showChevron, setShowChevron] = useState(true);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > window.innerHeight * 0.8);
    setShowChevron(window.scrollY < 100);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const supabase = createClient();
    const fetchData = async () => {
      try {
        const [{ data: { user: currentUser } }, { count }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("analisis").select("*", { count: "exact", head: true }),
        ]);
        if (currentUser) setUser(currentUser);
        if (count !== null) setAnalysisCount(count);
      } catch {
        // silently fail
      }
    };
    fetchData();
  }, []);

  const [tabAnimated, setTabAnimated] = useState(false);
  useEffect(() => {
    setTabAnimated(false);
    const t = setTimeout(() => setTabAnimated(true), 50);
    return () => clearTimeout(t);
  }, [activeTab]);

  const tabs = [
    { label: "Comparación", content: <TabComparacion /> },
    { label: "Flujo de caja", content: <TabFlujoCaja animate={tabAnimated} /> },
    { label: "Patrimonio", content: <TabPatrimonio animate={tabAnimated} /> },
    { label: "Análisis IA", content: <TabAnalisisIA animate={tabAnimated} /> },
    { label: "Sensibilidad", content: <TabSensibilidad animate={tabAnimated} /> },
  ];

  return (
    <div className="overflow-x-hidden bg-white text-[#1a1a1a]">
      <style jsx global>{`
        @keyframes scoreGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(5,150,105,0.2), 0 0 40px rgba(5,150,105,0.1); }
          50% { box-shadow: 0 0 30px rgba(5,150,105,0.35), 0 0 60px rgba(5,150,105,0.15); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        @keyframes fadeInTab {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @media (max-width: 767px) {
          .transition-gpu { transition-duration: 0.4s !important; }
        }
      `}</style>

      {/* ============ NAVBAR ============ */}
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? "bg-white/95 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-serif text-xl font-bold text-[#1a1a1a]">
            InvertiScore
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <Link href="/pricing" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
              Pricing
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setUser(null);
                    router.refresh();
                  }}
                  className="flex items-center gap-1.5 text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]"
                >
                  <LogOut className="h-4 w-4" /> Cerrar Sesión
                </button>
              </>
            ) : (
              <Link href="/login" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
                Iniciar Sesión
              </Link>
            )}
            <Link href="/analisis/nuevo">
              <Button size="sm" className="rounded-xl bg-[#059669] text-white transition-all duration-200 hover:bg-[#047857] hover:shadow-md hover:shadow-[#059669]/20">
                Analizar gratis
              </Button>
            </Link>
          </div>
          <button className="p-2 text-[#6b7280] sm:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[#e5e7eb] bg-white px-4 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Pricing</Link>
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-[#6b7280]">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setUser(null);
                      setMobileMenuOpen(false);
                      router.refresh();
                    }}
                    className="flex items-center gap-1.5 text-sm text-[#6b7280]"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar Sesión
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Iniciar Sesión</Link>
              )}
              <Link href="/analisis/nuevo" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full rounded-xl bg-[#059669] text-white hover:bg-[#047857]">Analizar gratis</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ============ 1. HERO — 100vh ============ */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 sm:min-h-screen sm:px-6" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)" }}>
        <div className="mx-auto grid max-w-5xl items-center gap-8 lg:gap-12 lg:grid-cols-[3fr,2fr]">
          <div className="text-center lg:text-left">
            <FadeIn>
              <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-[#111827] sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
                La mayoría de los deptos de inversión en Santiago pierden plata cada mes.
              </h1>
            </FadeIn>
            <FadeIn delay={100}>
              <p className="mx-auto mt-8 max-w-xl text-lg text-[#6b7280] lg:mx-0 lg:text-xl">
                Eso no aparece en la cotización. Nosotros te lo mostramos.
              </p>
            </FadeIn>
            <FadeIn delay={200}>
              <p className="mx-auto mt-4 max-w-2xl text-base text-[#9ca3af] lg:mx-0 lg:text-lg">
                InvertiScore analiza cualquier propiedad en Chile y te dice la verdad en 30 segundos. Sin sesgos, sin comisiones, sin letra chica.
              </p>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="mt-10">
                <Link href="/analisis/nuevo">
                  <Button size="lg" className="w-full gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/25 transition-all duration-200 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30 sm:w-auto">
                    Analiza gratis tu próxima inversión <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-4 text-sm text-[#9ca3af]">Sin tarjeta de crédito · Tu primer análisis en 30 segundos</p>
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={400}>
            <div className="flex justify-center lg:justify-end">
              <div className="inline-flex flex-row items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-xl shadow-black/5 sm:flex-col sm:gap-5 sm:px-8 sm:py-7">
                <div
                  className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#059669] sm:h-24 sm:w-24"
                  style={{ animation: "scoreGlow 3s ease-in-out infinite" }}
                >
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#059669] sm:text-3xl">72</div>
                    <div className="text-[7px] text-[#9ca3af] sm:text-[9px]">SCORE</div>
                  </div>
                </div>
                <div className="min-w-0 sm:text-center">
                  <div className="text-sm font-semibold text-[#111827] sm:text-base">Inversión Buena</div>
                  <div className="text-xs text-[#9ca3af] sm:text-sm">Depto 2D1B · Ñuñoa</div>
                  <div className="mt-2 flex gap-3 text-xs sm:hidden">
                    <span className="text-[#059669] font-semibold">5.2%</span>
                    <span className="text-[#059669] font-semibold">+$32K</span>
                    <span className="text-[#059669] font-semibold">2.8%</span>
                  </div>
                </div>
                <div className="hidden w-full space-y-2 border-t border-[#f3f4f6] pt-4 sm:block">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Yield bruto</span>
                    <span className="font-semibold text-[#059669]">5.2%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Flujo mensual</span>
                    <span className="font-semibold text-[#059669]">+$32.000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Cash-on-Cash</span>
                    <span className="font-semibold text-[#059669]">2.8%</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
          style={{ opacity: showChevron ? 0.5 : 0, animation: "bounceDown 2s ease-in-out infinite" }}
        >
          <ChevronDown className="h-6 w-6 text-[#9ca3af]" />
        </div>
      </section>

      {/* ============ 2. EJEMPLO REAL ============ */}
      <section className="bg-white px-4 py-12 sm:px-6 md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Lo que tu corredor te muestra vs lo que no te dice
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Card IZQUIERDA — Lo que tu corredor te dice */}
            <SlideIn delay={100} direction="left">
              <div className="group h-full rounded-2xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:shadow-md sm:p-6">
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Lo que tu corredor te dice</div>
                <h3 className="text-lg font-bold text-[#1a1a1a]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#e5e7eb]" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#f9fafb] p-3">
                    <span className="text-xs text-[#6b7280]">Precio</span>
                    <div className="mt-1 text-sm font-medium text-[#1a1a1a]">UF 3.200</div>
                  </div>
                  <div className="rounded-lg bg-[#f9fafb] p-3">
                    <span className="text-xs text-[#6b7280]">Arriendo</span>
                    <div className="mt-1 text-sm font-medium text-[#1a1a1a]">$420.000/mes</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <span className="flex items-center text-xs text-[#6b7280]">Yield<TooltipIcon text="Rentabilidad bruta anual sin descontar gastos" /></span>
                    <div className="mt-1 text-sm font-semibold text-[#059669]">4.1%</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <span className="text-xs text-[#6b7280]">Conclusión</span>
                    <div className="mt-1 text-sm font-medium italic text-[#059669]">&ldquo;Excelente oportunidad!&rdquo;</div>
                  </div>
                </div>
              </div>
            </SlideIn>
            {/* Card DERECHA — Lo que InvertiScore te muestra */}
            <SlideIn delay={200} direction="right">
              <div
                className="group h-full rounded-2xl border-2 border-[#059669] p-4 transition-all duration-200 hover:shadow-lg sm:p-6"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.15)" }}
              >
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#059669]">Lo que InvertiScore te muestra</div>
                <h3 className="text-lg font-bold text-[#1a1a1a]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#d1fae5]" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-[#6b7280]">Flujo mensual<TooltipIcon text="Ingreso por arriendo menos todos los gastos: dividendo, GGCC, contribuciones, seguro, mantención y vacancia" /></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🔴</span>
                      <span className="text-lg font-bold text-red-500">-$416.788</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-[#6b7280]">Cash-on-Cash<TooltipIcon text="Retorno anual sobre el capital que pusiste de tu bolsillo (pie + gastos)" /></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🔴</span>
                      <span className="font-semibold text-red-500">-20.1%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-[#6b7280]">Yield neto real<TooltipIcon text="Rentabilidad anual descontando TODOS los gastos operativos" /></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🟡</span>
                      <span className="font-semibold text-orange-500">1.4%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-[#6b7280]">Plusvalía 10 años<TooltipIcon text="Cuántas veces se multiplica tu inversión inicial en 10 años considerando plusvalía del sector" /></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🟢</span>
                      <span className="font-semibold text-[#059669]">2.83x</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-400 bg-orange-50">
                    <span className="text-sm font-bold text-orange-500">58</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">Score: 58 <span className="text-orange-500">&ldquo;Regular&rdquo;</span></div>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-red-500">Pones $5M al año de tu bolsillo</p>
              </div>
            </SlideIn>
          </div>
          <FadeIn delay={300}>
            <p className="mt-10 text-center text-base text-[#6b7280]">
              El mismo departamento. La diferencia es la información.
            </p>
            <div className="mt-6 text-center">
              <Link href="/analisis/nuevo" className="inline-flex items-center gap-1 font-medium text-[#059669] transition-colors duration-200 hover:text-[#047857] hover:underline">
                Pruébalo con tu propiedad <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ SOCIAL PROOF ============ */}
      <section className="bg-[#f5f5f5] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="text-base font-bold text-[#111827] sm:text-lg">
              Análisis respaldado por datos públicos oficiales
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 sm:gap-10">
              {/* Banco Central */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h1"/><path d="M14 10h1"/><path d="M9 14h1"/><path d="M14 14h1"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">Banco Central</span>
              </div>
              {/* SII */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">SII</span>
              </div>
              {/* CMF */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">CMF</span>
              </div>
            </div>
            <div className="mx-auto mt-4 max-w-lg rounded-lg px-3 py-2.5 sm:px-4 sm:py-3" style={{ background: "#f0fdf4" }}>
              <p className="text-sm font-medium text-[#166534]">
                <span className="mr-1">✨</span> Motor de IA que analiza +3.000 publicaciones activas en Santiago en tiempo real
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 3. POR QUE PASA ESTO ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              ¿Por qué tu corredor no te muestra estos números?
            </h2>
          </FadeIn>
          <div className="mt-10 space-y-4">
            {[
              { icon: Briefcase, title: "Su comisión depende de que compres", desc: "Un corredor gana entre $2M y $5M si cierras la compra. Si te dice \u201Ceste depto es mala inversión\u201D, pierde esa plata. ¿De verdad crees que te va a decir la verdad?" },
              { icon: Eye, title: "Te muestra solo los números bonitos", desc: "Yield bruto de 4.1% suena increíble. Pero cuando sumas dividendo, gastos comunes, contribuciones y mantención, resulta que pierdes $416.000 al mes. Eso nunca aparece en la cotización del corredor." },
              { icon: Scale, title: "Si la inversión sale mal, el corredor ya cobró", desc: "Tú asumes todo el riesgo. El corredor cobra su comisión el día de la firma y desaparece. Si en 3 años el depto vale menos, si el arriendo no alcanza, si los gastos suben — ese es tu problema, no el de él." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 150}>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:shadow-md sm:p-5" style={{ borderLeft: "4px solid #ef4444" }}>
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6]">
                      <item.icon className="h-4 w-4 text-[#374151]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-snug text-[#111827] sm:text-base">{item.title}</h3>
                      <p className="mt-1 text-[13px] leading-[1.5] text-[#6b7280] sm:text-sm">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 4. QUE HACE INVERTISCORE ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "#f0fdf4" }}>
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              La verdad completa, en 30 segundos
            </h2>
            <p className="mt-4 text-center text-[#6b7280]">
              Ingresa los datos de cualquier propiedad y obtén:
            </p>
          </FadeIn>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-5 md:grid-cols-3">
            {[
              { icon: Award, title: "Score 1-100", desc: "Evaluación objetiva de la inversión en 5 dimensiones", bg: "bg-[#ecfdf5]", iconColor: "text-[#059669]" },
              { icon: TrendingDown, title: "Flujo real", desc: "Cuánto vas a poner de tu bolsillo cada mes, sin maquillaje", bg: "bg-red-50", iconColor: "text-red-500" },
              { icon: LineChart, title: "Proyección a 20 años", desc: "Valor del patrimonio, saldo crédito y ganancia neta año a año", bg: "bg-blue-50", iconColor: "text-blue-500" },
              { icon: ArrowRightLeft, title: "Escenario de salida", desc: "Cuánto ganas si vendes en 5, 10 o 15 años. O si refinancias.", bg: "bg-purple-50", iconColor: "text-purple-500" },
              { icon: SlidersHorizontal, title: "Sensibilidad", desc: "Qué pasa si suben las tasas, baja el arriendo o tienes meses vacíos", bg: "bg-amber-50", iconColor: "text-amber-500" },
              { icon: MapPin, title: "Datos de mercado", desc: "Comparación con arriendos y precios reales de la zona", bg: "bg-teal-50", iconColor: "text-teal-500" },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 80}>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-3 transition-all duration-200 hover:border-[#059669] hover:shadow-md sm:p-5">
                  <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full sm:mb-3 sm:h-12 sm:w-12 ${item.bg}`}>
                    <item.icon className={`h-4 w-4 sm:h-6 sm:w-6 ${item.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[13px] font-semibold text-[#1a1a1a] sm:text-base">{item.title}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-[#6b7280] sm:text-sm">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 5. PREVIEW CON TABS ============ */}
      <section className="bg-[#fafafa] px-4 py-12 sm:px-6 md:py-[100px]">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Mira lo que obtienes con cada análisis
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="relative mt-10">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex min-w-max justify-center gap-1 border-b border-[#e5e7eb]">
                  {tabs.map((tab, i) => (
                    <button
                      key={tab.label}
                      onClick={() => setActiveTab(i)}
                      className={`whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-all duration-200 sm:px-5 sm:py-3 sm:text-sm ${
                        activeTab === i
                          ? "border-b-2 border-[#059669] text-[#059669]"
                          : "text-[#6b7280] hover:text-[#1a1a1a]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#fafafa] to-transparent md:hidden" />
            </div>
          </FadeIn>
          <div className="mt-8 sm:mt-10">
            <div
              key={activeTab}
              style={{ animation: "fadeInTab 0.3s ease-out" }}
            >
              {tabs[activeTab].content}
            </div>
          </div>
          <FadeIn delay={200}>
            <div className="mt-10 text-center">
              <Link href="/analisis/nuevo">
                <Button size="lg" className="w-full gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/25 transition-all duration-200 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30 sm:w-auto">
                  Haz tu primer análisis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 6. COMO FUNCIONA ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              3 pasos. 30 segundos.
            </h2>
          </FadeIn>
          {/* Mobile: vertical layout with dashed line */}
          <div className="relative mt-10 md:hidden">
            <div className="absolute left-[16px] top-8 h-[calc(100%-48px)] w-px border-l-2 border-dashed border-[#059669]/30" />
            <div className="space-y-4">
              {[
                { n: "1", title: "Ingresa los datos de la propiedad", desc: "O pégalos desde la publicación. La IA sugiere arriendo, gastos y contribuciones." },
                { n: "2", title: "IA analiza contra datos reales", desc: "Evaluamos rentabilidad, flujo, plusvalía, riesgo y ubicación con +3.000 publicaciones." },
                { n: "3", title: "Decide con información", desc: "Score de 1-100, proyecciones, escenarios y un veredicto claro. Sin jerga." },
              ].map((step, i) => (
                <FadeIn key={step.n} delay={i * 200}>
                  <div className="flex gap-6">
                    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#059669] text-base font-bold text-white shadow-lg shadow-[#059669]/20">
                      {step.n}
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-[15px] font-semibold text-[#111827]">{step.title}</h3>
                      <p className="mt-1 text-[13px] text-[#6b7280]">{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
          {/* Desktop: horizontal layout with dashed connector */}
          <div className="relative mt-14 hidden md:block">
            <div className="absolute left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] top-6 border-t-2 border-dashed border-[#059669]/30" />
            <div className="grid grid-cols-3 gap-8">
              {[
                { n: "1", title: "Ingresa los datos de la propiedad", desc: "O pégalos desde la publicación. La IA sugiere arriendo, gastos y contribuciones." },
                { n: "2", title: "IA analiza contra datos reales", desc: "Evaluamos rentabilidad, flujo, plusvalía, riesgo y ubicación con +3.000 publicaciones." },
                { n: "3", title: "Decide con información", desc: "Score de 1-100, proyecciones, escenarios y un veredicto claro. Sin jerga." },
              ].map((step, i) => (
                <FadeIn key={step.n} delay={i * 200}>
                  <div className="flex flex-col items-center text-center">
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#059669] text-xl font-bold text-white shadow-lg shadow-[#059669]/20">
                      {step.n}
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#111827]">{step.title}</h3>
                    <p className="mt-2 text-[#6b7280]">{step.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 7. GRATIS VS PRO ============ */}
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-[60px] md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Gratis. En serio.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[#6b7280]">
              Analiza gratis. Si quieres las proyecciones a futuro y el análisis IA completo, desbloquea el Informe Pro por $4.990 en un click.
            </p>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <FadeIn delay={100}>
              <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-5 transition-all duration-200 hover:shadow-lg sm:p-8">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Gratis</h3>
                  <span className="text-2xl font-bold text-[#1a1a1a]">$0</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Score de inversión 1-100",
                    "8 métricas de rentabilidad",
                    "Análisis de sensibilidad",
                    "Comparación con la zona",
                    "Puntos críticos",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]">
                        <Check className="h-3 w-3 text-[#059669]" />
                      </span>
                      <span className="text-[#374151]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 block">
                  <Button variant="outline" className="w-full rounded-xl border-[#e5e7eb] text-[#1a1a1a] transition-all duration-200 hover:bg-[#fafafa] hover:shadow-sm">
                    Comenzar gratis
                  </Button>
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div
                className="relative h-full rounded-2xl border-2 border-[#059669] p-5 transition-all duration-200 hover:shadow-lg sm:p-8"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.12)" }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#059669] px-4 py-1 text-xs font-semibold text-white">
                  Popular
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Informe Pro</h3>
                  <span className="text-2xl font-bold text-[#1a1a1a]">$4.990</span>
                </div>
                <p className="mt-2 text-xs text-[#9ca3af]">Todo lo gratis, más:</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    "Cascada de costos detallada",
                    "Análisis IA personalizado",
                    "Flujo de caja 1-20 años",
                    "Proyección de patrimonio",
                    "Escenario de salida y refinanciamiento",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]">
                        <Check className="h-3 w-3 text-[#059669]" />
                      </span>
                      <span className="text-[#374151]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={user ? "/analisis/nuevo" : "/register"} className="mt-6 block">
                  <Button size="lg" className="w-full rounded-xl bg-[#059669] py-6 text-base font-semibold text-white shadow-lg shadow-[#059669]/25 transition-all duration-200 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30">
                    Obtener informe <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ 8. CONFIANZA ============ */}
      <section className="bg-[#fafafa] px-4 py-12 sm:px-6 sm:py-[60px] md:py-[100px]">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Solo datos. Sin conflictos de interés.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[#6b7280]">
              InvertiScore no vende propiedades. No cobra comisiones. No trabaja para inmobiliarias. Solo analizamos datos para que tú decidas mejor.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
              {[
                { icon: ShieldCheck, text: "Sin comisiones" },
                { icon: Database, text: "Datos públicos" },
                { icon: Bot, text: "IA independiente" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2.5 transition-all duration-200 hover:shadow-md sm:gap-3 sm:px-5 sm:py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ecfdf5] sm:h-8 sm:w-8">
                    <item.icon className="h-3.5 w-3.5 text-[#059669] sm:h-4 sm:w-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-[12px] font-medium text-[#374151] sm:text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-xs text-[#9ca3af]">
              Datos de Portal Inmobiliario · Banco Central · SII
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 9. CTA FINAL ============ */}
      <section className="px-4 py-12 sm:px-6 sm:py-[60px] md:py-[100px]" style={{ background: "linear-gradient(135deg, #0f172a 0%, #064e3b 100%)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-2xl font-bold leading-tight text-white sm:text-3xl md:text-5xl">
              Antes de firmar, conoce los números reales.
            </h2>
            <div className="mt-10">
              <Link href="/analisis/nuevo">
                <Button size="lg" className="w-full gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/30 transition-all duration-200 hover:bg-[#10b981] hover:shadow-xl hover:shadow-[#059669]/40 sm:w-auto">
                  Empieza ahora — es gratis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {analysisCount !== null && analysisCount >= 50 && (
              <p className="mt-6 text-sm text-white/50">
                Ya analizaron {analysisCount.toLocaleString("es-CL")} propiedades con InvertiScore
              </p>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#111] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <span className="font-serif text-lg font-bold text-white">InvertiScore</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#6b7280]">
            <Link href="/" className="transition-colors duration-200 hover:text-white">Inicio</Link>
            <span className="text-[#333]">·</span>
            <Link href="/pricing" className="transition-colors duration-200 hover:text-white">Pricing</Link>
            <span className="text-[#333]">·</span>
            <Link href="/dashboard" className="transition-colors duration-200 hover:text-white">Dashboard</Link>
            <span className="text-[#333]">·</span>
            <Link href="/login" className="transition-colors duration-200 hover:text-white">Iniciar Sesión</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-5xl text-center text-xs text-[#444]">
          &copy; 2026 InvertiScore · Datos de Portal Inmobiliario, Banco Central, SII
        </div>
      </footer>
    </div>
  );
}
