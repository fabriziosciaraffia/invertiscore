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
  X,
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
// Tab content components for preview section
// ============================================================
function TabComparacion() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        El mismo presupuesto, tres resultados muy distintos. El score te dice cuáles valen la pena.
      </p>
      <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none">
        {[
          {
            score: 45, color: "#f59e0b", label: "Inversión Débil",
            title: "Depto 1D1B · Santiago Centro",
            info: "UF 2.100 · 32m2 · $320.000/mes",
            metrics: [
              { l: "Yield bruto", v: "3.2%", c: "text-red-500" },
              { l: "Flujo mensual", v: "-$380.000", c: "text-red-500" },
              { l: "Cash-on-Cash", v: "-24%", c: "text-red-500" },
            ],
            tag: "Oversupply en la zona, flujo muy negativo",
            tagIcon: "warning",
            borderColor: "border-[#f59e0b]/40",
          },
          {
            score: 58, color: "#eab308", label: "Inversión Regular",
            title: "Depto 2D1B · Providencia",
            info: "UF 3.200 · 55m2 · $420.000/mes",
            metrics: [
              { l: "Yield bruto", v: "4.1%", c: "text-orange-500" },
              { l: "Flujo mensual", v: "-$416.000", c: "text-red-500" },
              { l: "Cash-on-Cash", v: "-20%", c: "text-red-500" },
            ],
            tag: "Flujo negativo pero plusvalía alta compensa a largo plazo",
            tagIcon: "chart",
            borderColor: "border-[#eab308]/40",
          },
          {
            score: 78, color: "#059669", label: "Inversión Buena",
            title: "Depto 2D2B · La Florida",
            info: "UF 2.400 · 50m2 · $380.000/mes",
            metrics: [
              { l: "Yield bruto", v: "5.8%", c: "text-[#059669]" },
              { l: "Flujo mensual", v: "+$45.000", c: "text-[#059669]" },
              { l: "Cash-on-Cash", v: "3.2%", c: "text-[#059669]" },
            ],
            tag: "Flujo positivo, buena rentabilidad, zona en crecimiento",
            tagIcon: "check",
            borderColor: "border-[#059669]/40",
          },
        ].map((card) => (
          <div
            key={card.score}
            className={`h-full min-w-[260px] shrink-0 snap-center rounded-2xl border ${card.borderColor} bg-white p-4 transition-all duration-200 hover:shadow-lg sm:min-w-[300px] sm:p-7 md:min-w-0 md:shrink`}
            style={card.score === 78 ? { boxShadow: "0 4px 20px rgba(5,150,105,0.1)" } : {}}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 sm:h-[52px] sm:w-[52px] sm:border-[2.5px]" style={{ borderColor: card.color }}>
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

function TabFlujoCaja() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        El flujo de caja te muestra la película completa, mes a mes.
      </p>
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl md:p-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Flujo mensual — 12 meses</div>
        <div className="mt-4">
          <div className="flex items-end gap-2" style={{ height: 200 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const arriendo = 420;
              const dividendo = 559;
              const gastos = 125;
              const total = dividendo + gastos;
              const scale = 180 / total;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                  <div className="flex w-full flex-col items-stretch gap-px">
                    <div className="w-full rounded-t-sm bg-[#059669]/80" style={{ height: `${arriendo * scale}px` }} />
                    <div className="w-full bg-[#ef4444]/70" style={{ height: `${dividendo * scale * 0.6}px` }} />
                    <div className="w-full rounded-b-sm bg-[#f97316]/60" style={{ height: `${gastos * scale * 0.5}px` }} />
                  </div>
                  <span className="text-[9px] text-[#9ca3af]">{i === 0 ? "M1" : i === 5 ? "M6" : i === 11 ? "M12" : ""}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#059669]/80" /> Arriendo ($420K)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]/70" /> Dividendo ($559K)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]/60" /> Gastos ($125K)</span>
          </div>
          <div className="mt-6 rounded-xl bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
                <ArrowRight className="h-3 w-3 rotate-90 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">
                  Este depto te cuesta $416.788 cada mes de tu bolsillo. Eso son $5 millones al año.
                </p>
                <p className="mt-1 text-sm text-red-600/70">¿Tu corredor te lo dijo?</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabPatrimonio() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        Aunque pierdas flujo cada mes, tu patrimonio puede crecer significativamente.
      </p>
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl md:p-8">
        <div className="grid gap-8 md:grid-cols-[1fr,280px]">
          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Proyección a 10 años (millones CLP)</div>
            <svg viewBox="0 0 400 220" className="w-full" preserveAspectRatio="xMidYMid meet">
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="40" y1={30 + i * 45} x2="390" y2={30 + i * 45} stroke="#f3f4f6" strokeWidth="1" />
              ))}
              <text x="35" y="35" textAnchor="end" className="text-[9px]" fill="#9ca3af">$200M</text>
              <text x="35" y="80" textAnchor="end" className="text-[9px]" fill="#9ca3af">$150M</text>
              <text x="35" y="125" textAnchor="end" className="text-[9px]" fill="#9ca3af">$100M</text>
              <text x="35" y="170" textAnchor="end" className="text-[9px]" fill="#9ca3af">$50M</text>
              <text x="35" y="215" textAnchor="end" className="text-[9px]" fill="#9ca3af">$0</text>
              {[0, 2, 4, 6, 8, 10].map((y) => (
                <text key={y} x={40 + y * 35} y="210" textAnchor="middle" className="text-[9px]" fill="#9ca3af">A{y}</text>
              ))}
              <polyline fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points="40,72 75,68 110,63 145,58 180,53 215,48 250,42 285,37 320,32 355,27 390,22" />
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points="40,165 75,155 110,145 145,134 180,122 215,110 250,97 285,84 320,70 355,56 390,42" />
              <polyline fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3"
                points="40,105 75,108 110,111 145,115 180,118 215,122 250,126 285,130 320,134 355,138 390,142" />
              <polyline fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,4"
                points="40,195 75,192 110,189 145,186 180,183 215,180 250,178 285,176 320,174 355,172 390,170" />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-[10px]">
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-sm bg-[#059669]" /> Valor propiedad</span>
              <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-sm bg-[#3b82f6]" /> Patrimonio neto</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-6 border-t-2 border-dashed border-[#ef4444]" /> Saldo crédito</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-6 border-t border-dashed border-[#9ca3af]" /> Flujo acumulado</span>
            </div>
          </div>
          <div className="flex flex-col justify-center space-y-5">
            <div className="rounded-xl bg-[#ecfdf5] p-4">
              <div className="text-2xl font-bold text-[#059669]">2.83x</div>
              <div className="text-sm text-[#059669]">Multiplicador</div>
            </div>
            <div className="rounded-xl bg-[#fafafa] p-4">
              <p className="text-sm text-[#374151]">Tu pie de <span className="font-semibold">$24.8M</span> se convierte en <span className="font-semibold text-[#059669]">$70.2M</span> en 10 años</p>
            </div>
            <div className="rounded-xl bg-[#fafafa] p-4">
              <p className="text-sm text-[#374151]">TIR: <span className="font-semibold text-[#059669]">7.8% anual</span></p>
              <p className="mt-0.5 text-xs text-[#9ca3af]">Mejor que un depósito a plazo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabAnalisisIA() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        Sin jerga financiera. Sin letra chica. La verdad en español.
      </p>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6" style={{ borderLeft: "4px solid #059669" }}>
          <h3 className="mb-4 text-sm font-semibold text-[#059669]">A favor de esta inversión</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5 text-sm text-[#374151]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]"><Check className="h-3 w-3 text-[#059669]" /></span>
              Con pocos años de uso, la mantención debiera ser baja. Los gastos grandes (ascensores, fachada) aún están lejos.
            </li>
            <li className="flex items-start gap-2.5 text-sm text-[#374151]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]"><Check className="h-3 w-3 text-[#059669]" /></span>
              Zona con alta demanda de arriendo. Menos riesgo de vacancia y mejor potencial de plusvalía.
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6" style={{ borderLeft: "4px solid #ef4444" }}>
          <h3 className="mb-4 text-sm font-semibold text-red-500">Puntos de atención</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5 text-sm text-[#374151]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-3 w-3 text-red-500" /></span>
              El retorno neto (CAP rate 1.5%) esta bajo el promedio. Podrías negociar el precio de compra o buscar una propiedad más rentable en la zona.
            </li>
            <li className="flex items-start gap-2.5 text-sm text-[#374151]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-3 w-3 text-red-500" /></span>
              Cada mes tendrás que poner $416.788 de tu bolsillo para cubrir los costos. Asegúrate de tener ese flujo disponible de forma estable.
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-6" style={{ borderLeft: "4px solid #9ca3af" }}>
          <h3 className="mb-3 text-sm font-semibold text-[#6b7280]">Veredicto</h3>
          <p className="text-sm leading-relaxed text-[#374151]">
            El arriendo genera $420.000 al mes y los costos suman $836.788. Falta cubrir $416.788 de tu bolsillo. La inversión apuesta a la plusvalía futura — negociar el precio mejoraría los números significativamente.
          </p>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-[#9ca3af]">
        Este análisis se genera automáticamente con IA para cada propiedad que evalúes.
      </p>
    </div>
  );
}

function TabSensibilidad() {
  return (
    <div>
      <p className="mb-8 text-center text-[#6b7280]">
        Mira qué pasa si suben las tasas, baja el arriendo, o tienes meses sin arrendatario.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            label: "Pesimista", score: 49, color: "#ef4444", borderColor: "border-red-300",
            scenario: "+1.5% tasa, -15% arriendo, +2 meses vacancia",
            flujo: "-$621.548/mes", yield: "0.3%",
            flujoColor: "text-red-500", yieldColor: "text-red-500",
          },
          {
            label: "Base", score: 58, color: "#eab308", borderColor: "border-[#e5e7eb]",
            scenario: "Valores actuales",
            flujo: "-$416.788/mes", yield: "1.4%",
            flujoColor: "text-red-500", yieldColor: "text-orange-500",
          },
          {
            label: "Optimista", score: 63, color: "#059669", borderColor: "border-[#059669]/40",
            scenario: "-1% tasa, +10% arriendo",
            flujo: "-$323.645/mes", yield: "1.8%",
            flujoColor: "text-orange-500", yieldColor: "text-[#059669]",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border ${s.borderColor} bg-white p-6 transition-all duration-200 hover:shadow-md`}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</div>
            <div className="my-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ borderColor: s.color }}>
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: s.color }}>{s.score}</div>
                  <div className="text-[7px] text-[#9ca3af]">SCORE</div>
                </div>
              </div>
            </div>
            <p className="mb-4 text-center text-xs text-[#6b7280]">{s.scenario}</p>
            <div className="space-y-2 border-t border-[#f3f4f6] pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Flujo</span>
                <span className={`font-semibold ${s.flujoColor}`}>{s.flujo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Yield neto</span>
                <span className={`font-semibold ${s.yieldColor}`}>{s.yield}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-[#6b7280]">
        En el peor escenario, tu score baja a 49. En el mejor, sube a 63. Así tomas decisiones con los ojos abiertos.
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

  const tabs = [
    { label: "Comparación", content: <TabComparacion /> },
    { label: "Flujo de caja", content: <TabFlujoCaja /> },
    { label: "Patrimonio", content: <TabPatrimonio /> },
    { label: "Análisis IA", content: <TabAnalisisIA /> },
    { label: "Sensibilidad", content: <TabSensibilidad /> },
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
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
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
          <div className="border-t border-[#e5e7eb] bg-white px-6 py-4 sm:hidden">
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
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-5 sm:min-h-screen sm:px-6" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)" }}>
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
      <section className="bg-white px-5 py-12 sm:px-6 md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Lo que tu corredor te muestra vs lo que no te dice
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <SlideIn delay={100} direction="left">
              <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:shadow-md sm:p-6">
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Lo que te dicen</div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Depto 2D1B en Providencia</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Precio</span>
                    <span className="font-medium text-[#1a1a1a]">UF 3.200</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Arriendo</span>
                    <span className="font-medium text-[#1a1a1a]">$420.000/mes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Yield</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3 w-3 text-[#059669]" /></span>
                      <span className="font-semibold text-[#059669]">4.1%</span>
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-sm italic text-[#059669]">&ldquo;Excelente oportunidad de inversión!&rdquo;</p>
              </div>
            </SlideIn>
            <SlideIn delay={200} direction="right">
              <div
                className="h-full rounded-2xl border-2 border-[#059669] p-4 transition-all duration-200 hover:shadow-lg sm:p-6"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.15)" }}
              >
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#059669]">Lo que InvertiScore te muestra</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Flujo mensual</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-50"><X className="h-3 w-3 text-red-500" /></span>
                      <span className="text-lg font-bold text-red-500">-$416.788</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#6b7280]">Pones $5M al año de tu bolsillo</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Cash-on-Cash</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-50"><X className="h-3 w-3 text-red-500" /></span>
                      <span className="font-semibold text-red-500">-20.1%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Yield neto real</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-50"><AlertTriangle className="h-3 w-3 text-orange-500" /></span>
                      <span className="font-semibold text-orange-500">1.4%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Plusvalia compensa en 10 años</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3 w-3 text-[#059669]" /></span>
                      <span className="font-semibold text-[#059669]">2.83x tu inversión</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-400">
                    <span className="text-sm font-bold text-orange-500">58</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">InvertiScore: 58</div>
                    <div className="text-xs text-[#6b7280]">Inversión Regular</div>
                  </div>
                </div>
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
      <section className="bg-[#f5f5f5] px-5 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="text-[13px] font-semibold leading-relaxed text-[#374151] sm:text-base">
              Banco Central de Chile <span className="mx-2 text-[#9ca3af] sm:mx-3">·</span> Servicio de Impuestos Internos <span className="mx-2 text-[#9ca3af] sm:mx-3">·</span> Comisión para el Mercado Financiero
            </p>
            <p className="mt-3 text-sm text-[#9ca3af]">Datos de mercado actualizados diariamente</p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 3. POR QUE PASA ESTO ============ */}
      <section className="px-5 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              ¿Por qué nadie te muestra estos números?
            </h2>
          </FadeIn>
          <div className="mt-10 space-y-4">
            {[
              { icon: Briefcase, title: "La comisión depende de la venta, no de tu resultado", desc: "Si te dice \u201Cno compres\u201D, pierde entre $2M y $5M de comisión." },
              { icon: Eye, title: "Te muestran el yield bruto, no el flujo real", desc: "El 4.1% suena bien. Pero sumando todos los costos, pierdes $416K cada mes." },
              { icon: Scale, title: "No hay accountability", desc: "Si la inversión sale mal, el corredor ya cobró. Tú necesitas tus propios números." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 150}>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:shadow-md sm:p-5" style={{ borderLeft: "4px solid #ef4444" }}>
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6]">
                      <item.icon className="h-4 w-4 text-[#374151]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-snug text-[#111827] sm:text-base">{item.title}</h3>
                      <p className="mt-1 text-[13px] leading-[1.4] text-[#6b7280] sm:text-sm">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 4. QUE HACE INVERTISCORE ============ */}
      <section className="px-5 py-12 sm:px-6 md:py-[100px]" style={{ background: "#f0fdf4" }}>
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              La verdad completa, en 30 segundos
            </h2>
            <p className="mt-4 text-center text-[#6b7280]">
              Ingresa los datos de cualquier propiedad y obtén:
            </p>
          </FadeIn>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 md:grid-cols-3">
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
      <section className="relative px-5 py-12 sm:px-6 md:py-[100px]">
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Mira lo que obtienes con cada análisis
            </h2>
          </FadeIn>
          {/* Tabs */}
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
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent md:hidden" />
            </div>
          </FadeIn>
          {/* Tab content */}
          <div className="mt-10">
            <div
              key={activeTab}
              style={{
                animation: "fadeInTab 0.3s ease-out",
              }}
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
      <section className="px-5 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
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
      <section className="bg-white px-5 py-12 sm:px-6 sm:py-[60px] md:py-[100px]">
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
      <section className="bg-[#fafafa] px-5 py-12 sm:px-6 sm:py-[60px] md:py-[100px]">
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
      <section className="px-5 py-12 sm:px-6 sm:py-[60px] md:py-[100px]" style={{ background: "linear-gradient(135deg, #0f172a 0%, #064e3b 100%)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-[28px] font-bold leading-tight text-white sm:text-3xl md:text-5xl">
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
      <footer className="bg-[#111] px-5 py-8 sm:px-6 sm:py-10">
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
