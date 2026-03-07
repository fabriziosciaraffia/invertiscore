"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Menu,
  X as XIcon,
  Target,
  DollarSign,
  TrendingUp,
  LogOut,
  Activity,
  BarChart3,
  ShieldCheck,
  Database,
  Bot,
  AlertTriangle,
  X,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// CountUp — animates a number when it enters viewport
// ============================================================
function CountUp({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const numMatch = value.match(/^([-]?)(\d+(?:\.\d+)?)/);
    if (!numMatch) return;

    const sign = numMatch[1];
    const target = parseFloat(numMatch[2]);
    const rest = value.slice(numMatch[0].length);
    const hasDecimal = numMatch[2].includes(".");
    const decimalPlaces = hasDecimal ? numMatch[2].split(".")[1].length : 0;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const duration = 1000;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            setDisplay(`${sign}${current.toFixed(decimalPlaces)}${rest}${suffix}`);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, suffix]);

  return <span ref={ref}>{display}</span>;
}

// ============================================================
// Main Page
// ============================================================
export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showChevron, setShowChevron] = useState(true);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > window.innerHeight * 0.8);
    setShowChevron(window.scrollY < 100);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Fetch analysis count for CTA
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const supabase = createClient();
        const { count } = await supabase.from("analisis").select("*", { count: "exact", head: true });
        if (count !== null) setAnalysisCount(count);
      } catch {
        // silently fail
      }
    };
    fetchCount();
  }, []);

  return (
    <div className="bg-white text-[#1a1a1a]">
      {/* Global animations */}
      <style jsx global>{`
        @keyframes scoreGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(5,150,105,0.2), 0 0 40px rgba(5,150,105,0.1); }
          50% { box-shadow: 0 0 30px rgba(5,150,105,0.35), 0 0 60px rgba(5,150,105,0.15); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
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
          {/* Desktop */}
          <div className="hidden items-center gap-6 sm:flex">
            <Link href="/pricing" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
              Iniciar Sesion
            </Link>
            <Link href="/analisis/nuevo">
              <Button size="sm" className="rounded-xl bg-[#059669] text-white transition-all duration-200 hover:bg-[#047857] hover:shadow-md hover:shadow-[#059669]/20">
                Analizar gratis
              </Button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button className="p-2 text-[#6b7280] sm:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[#e5e7eb] bg-white px-6 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Pricing</Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Iniciar Sesion</Link>
              <Link href="/analisis/nuevo" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full rounded-xl bg-[#059669] text-white hover:bg-[#047857]">Analizar gratis</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ============ S1: HERO — 100vh ============ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-[#1a1a1a] md:text-6xl md:leading-[1.1]">
              El <span className="text-[#059669]">67%</span> de los departamentos de inversion en Santiago tienen flujo negativo.
            </h1>
          </FadeIn>
          <FadeIn delay={100}>
            <p className="mx-auto mt-8 max-w-xl text-lg text-[#6b7280] md:text-xl">
              Tu corredor no te va a decir eso. Nosotros si.
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#9ca3af] md:text-lg">
              InvertiScore analiza cualquier propiedad en Chile y te dice la verdad en 30 segundos. Sin sesgos, sin comisiones, sin letra chica.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10">
              <Link href="/analisis/nuevo">
                <Button size="lg" className="gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/25 transition-all duration-200 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30">
                  Analiza gratis tu proxima inversion <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="mt-4 text-sm text-[#9ca3af]">Sin tarjeta de credito · Analisis ilimitados</p>
            </div>
          </FadeIn>
          {/* Mini score mockup */}
          <FadeIn delay={400}>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white px-6 py-4 shadow-xl shadow-black/5">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[#059669]"
                style={{ animation: "scoreGlow 3s ease-in-out infinite" }}
              >
                <div className="text-center">
                  <div className="text-xl font-bold text-[#059669]">72</div>
                  <div className="text-[8px] text-[#9ca3af]">SCORE</div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-[#1a1a1a]">Inversion Buena</div>
                <div className="text-xs text-[#9ca3af]">Depto 2D1B Nunoa</div>
              </div>
            </div>
          </FadeIn>
        </div>
        {/* Animated chevron */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
          style={{ opacity: showChevron ? 0.5 : 0, animation: "bounceDown 2s ease-in-out infinite" }}
        >
          <ChevronDown className="h-6 w-6 text-[#9ca3af]" />
        </div>
      </section>

      {/* ============ S2: EJEMPLO REAL ============ */}
      <section className="bg-white px-6 py-[60px] md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Lo que tu corredor te muestra vs lo que no te dice
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Lo que te dicen — slides from left */}
            <SlideIn delay={100} direction="left">
              <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-all duration-200 hover:shadow-md">
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
                <p className="mt-5 text-sm italic text-[#059669]">&ldquo;Excelente oportunidad de inversion!&rdquo;</p>
              </div>
            </SlideIn>
            {/* Lo que InvertiScore te muestra — slides from right */}
            <SlideIn delay={200} direction="right">
              <div
                className="h-full rounded-2xl border-2 border-[#059669] p-6 transition-all duration-200 hover:shadow-lg"
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
                  <p className="text-sm text-[#6b7280]">Pones $5M al ano de tu bolsillo</p>
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
                    <span className="text-[#6b7280]">Plusvalia compensa en 10 anos</span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3 w-3 text-[#059669]" /></span>
                      <span className="font-semibold text-[#059669]">2.83x tu inversion</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-400">
                    <span className="text-sm font-bold text-orange-500">58</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">InvertiScore: 58</div>
                    <div className="text-xs text-[#6b7280]">Inversion Regular</div>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>
          <FadeIn delay={300}>
            <p className="mt-10 text-center text-base text-[#6b7280]">
              El mismo departamento. La diferencia es la informacion.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ S3: POR QUE PASA ESTO ============ */}
      <section className="px-6 py-[60px] md:py-[100px]" style={{ background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              El conflicto de interes que nadie menciona
            </h2>
          </FadeIn>
          <div className="mt-14 space-y-6">
            {[
              { title: "Su comision depende de la venta, no de tu resultado", desc: "Un corredor gana entre $2M y $5M por venta cerrada. Si te dice \u201Cno compres\u201D, pierde esa comision. Su incentivo es venderte, no asesorarte." },
              { title: "Te muestran el yield bruto, no el flujo real", desc: "El yield bruto de 4.1% suena bien. Pero cuando sumas dividendo, gastos comunes, contribuciones y mantencion, la realidad es que pierdes $416.000 cada mes." },
              { title: "No hay accountability", desc: "Si la inversion sale mal, el corredor ya cobro. No responde por tu resultado. Tu necesitas tus propios numeros para negociar en igualdad de condiciones." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 200}>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-all duration-200 hover:shadow-md" style={{ borderLeft: "4px solid #ef4444" }}>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">{item.title}</h3>
                      <p className="mt-2 leading-relaxed text-[#6b7280]">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ S4: QUE HACE INVERTISCORE ============ */}
      <section className="px-6 py-[60px] md:py-[100px]" style={{ background: "#f0fdf4" }}>
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              La verdad completa, en 30 segundos
            </h2>
            <p className="mt-4 text-center text-[#6b7280]">
              Ingresa los datos de cualquier propiedad y obten:
            </p>
          </FadeIn>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {[
              { icon: Target, title: "Score 1-100", desc: "Evaluacion objetiva de la inversion en 5 dimensiones" },
              { icon: DollarSign, title: "Flujo real", desc: "Cuanto vas a poner de tu bolsillo cada mes, sin maquillaje" },
              { icon: TrendingUp, title: "Proyeccion a 20 anos", desc: "Valor del patrimonio, saldo credito y ganancia neta ano a ano" },
              { icon: LogOut, title: "Escenario de salida", desc: "Cuanto ganas si vendes en 5, 10 o 15 anos. O si refinancias." },
              { icon: Activity, title: "Sensibilidad", desc: "Que pasa si suben las tasas, baja el arriendo o tienes meses vacios" },
              { icon: BarChart3, title: "Datos de mercado", desc: "Comparacion con arriendos y precios reales de la zona" },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 80}>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5 transition-all duration-200 hover:border-[#059669] hover:shadow-md">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#ecfdf5]">
                    <item.icon className="h-6 w-6 text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-[#1a1a1a]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#6b7280]">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ S5: DEMO DEL PRODUCTO ============ */}
      <section className="relative px-6 py-[60px] md:py-[100px]">
        {/* Subtle grid pattern */}
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Asi se ve un InvertiScore
            </h2>
          </FadeIn>
          <FadeIn delay={150}>
            <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-[#059669]/20 bg-white shadow-2xl">
              {/* Score header */}
              <div className="flex flex-col items-center gap-5 border-b border-[#e5e7eb] p-8 sm:flex-row sm:items-start">
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#059669]"
                  style={{ animation: "scoreGlow 3s ease-in-out infinite" }}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#059669]">72</div>
                    <div className="text-[9px] text-[#9ca3af]">SCORE</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-500">Inversion Buena</div>
                  <h3 className="text-lg font-bold text-[#1a1a1a]">Depto 2D1B Nunoa</h3>
                  <p className="text-sm text-[#9ca3af]">Nunoa, Santiago · 52 m2 · 8 anos</p>
                </div>
              </div>
              {/* 8 Metrics with count-up */}
              <div className="grid grid-cols-2 gap-px bg-[#e5e7eb] sm:grid-cols-4">
                {[
                  { l: "Yield Bruto", v: "5.2%" },
                  { l: "Yield Neto", v: "3.1%" },
                  { l: "CAP Rate", v: "3.8%" },
                  { l: "Cash-on-Cash", v: "4.2%" },
                  { l: "ROI Total", v: "2.3x" },
                  { l: "TIR", v: "12.4%" },
                  { l: "Payback Pie", v: "186 meses" },
                  { l: "UF/m2", v: "61.5" },
                ].map((m) => (
                  <div key={m.l} className="bg-white p-4 text-center">
                    <div className="text-[10px] text-[#9ca3af]">{m.l}</div>
                    <div className="mt-0.5 text-lg font-bold text-[#1a1a1a]">
                      <CountUp value={m.v} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Score dimensions + cashflow */}
              <div className="grid gap-px bg-[#e5e7eb] md:grid-cols-2">
                {/* Dimension bars */}
                <div className="bg-white p-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Dimensiones del Score</div>
                  {[
                    { d: "Rentabilidad", v: 68, w: 30 },
                    { d: "Flujo de Caja", v: 55, w: 25 },
                    { d: "Plusvalia", v: 78, w: 20 },
                    { d: "Bajo Riesgo", v: 65, w: 15 },
                    { d: "Ubicacion", v: 80, w: 10 },
                  ].map((r) => (
                    <div key={r.d} className="mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6b7280]">{r.d} ({r.w}%)</span>
                        <span className="font-medium text-[#1a1a1a]">{r.v}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-[#f3f4f6]">
                        <div className="h-full rounded-full bg-[#059669]" style={{ width: `${r.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Cashflow preview */}
                <div className="bg-white p-6">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Flujo de caja — 12 meses</div>
                  <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                    {[0, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85].map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                        <div className="w-full rounded-sm bg-[#059669]/70" style={{ height: `${Math.max(v * 0.7, 2)}px` }} />
                        <div className="w-full rounded-sm bg-red-400/70" style={{ height: `${Math.max((100 - v) * 0.7, 2)}px` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#9ca3af]">
                    <span>M1</span><span>M6</span><span>M12</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#059669]/70" /> Ingreso</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400/70" /> Egresos</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-8 text-center">
              <Link href="/analisis/nuevo" className="inline-flex items-center gap-1 font-medium text-[#059669] transition-colors duration-200 hover:text-[#047857] hover:underline">
                Pruebalo gratis con tu proxima inversion <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ S6: COMO FUNCIONA ============ */}
      <section className="px-6 py-[60px] md:py-[100px]" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              3 pasos. 30 segundos.
            </h2>
          </FadeIn>
          <div className="relative mt-14">
            {/* Connecting line */}
            <div className="absolute left-6 top-6 hidden h-[calc(100%-48px)] w-px border-l-2 border-dashed border-[#059669]/30 md:block" />
            <div className="space-y-10">
              {[
                { n: "1", title: "Ingresa los datos de la propiedad", desc: "O pegalos desde la publicacion. La IA sugiere arriendo, gastos y contribuciones automaticamente." },
                { n: "2", title: "IA analiza contra datos reales", desc: "Evaluamos rentabilidad, flujo, plusvalia, riesgo y ubicacion usando datos de +3.000 publicaciones en Santiago." },
                { n: "3", title: "Decide con informacion", desc: "Score de 1-100, proyecciones, escenarios y un veredicto claro. Sin jerga. Sin letra chica." },
              ].map((step, i) => (
                <FadeIn key={step.n} delay={i * 200}>
                  <div className="flex gap-6">
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#059669] text-xl font-bold text-white shadow-lg shadow-[#059669]/20">
                      {step.n}
                    </div>
                    <div className="pt-1">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">{step.title}</h3>
                      <p className="mt-1 text-[#6b7280]">{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ S7: GRATIS VS PRO ============ */}
      <section className="bg-white px-6 py-[60px] md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Gratis. En serio.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[#6b7280]">
              El analisis basico es gratis para siempre. El informe completo cuesta menos que un cafe con tu corredor.
            </p>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Gratis */}
            <FadeIn delay={100}>
              <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-8 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Gratis</h3>
                  <span className="text-2xl font-bold text-[#1a1a1a]">$0</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Score de inversion 1-100",
                    "8 metricas de rentabilidad",
                    "Analisis de sensibilidad",
                    "Comparacion con la zona",
                    "Puntos criticos",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5]">
                        <Check className="h-3 w-3 text-[#059669]" />
                      </span>
                      <span className="text-[#374151]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/analisis/nuevo" className="mt-6 block">
                  <Button variant="outline" className="w-full rounded-xl border-[#e5e7eb] text-[#1a1a1a] transition-all duration-200 hover:bg-[#fafafa] hover:shadow-sm">
                    Comenzar gratis
                  </Button>
                </Link>
              </div>
            </FadeIn>
            {/* Pro */}
            <FadeIn delay={200}>
              <div
                className="relative h-full rounded-2xl border-2 border-[#059669] p-8 transition-all duration-200 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.12)" }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#059669] px-4 py-1 text-xs font-semibold text-white">
                  Popular
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Informe Pro</h3>
                  <span className="text-2xl font-bold text-[#1a1a1a]">$4.990</span>
                </div>
                <p className="mt-2 text-xs text-[#9ca3af]">Todo lo gratis, mas:</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    "Cascada de costos detallada",
                    "Analisis IA personalizado",
                    "Flujo de caja 1-20 anos",
                    "Proyeccion de patrimonio",
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
                <Link href="/analisis/nuevo" className="mt-6 block">
                  <Button className="w-full rounded-xl bg-[#059669] text-white shadow-md shadow-[#059669]/20 transition-all duration-200 hover:bg-[#047857] hover:shadow-lg">
                    Obtener informe
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ S8: CONFIANZA ============ */}
      <section className="bg-[#fafafa] px-6 py-[60px] md:py-[100px]">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Solo datos. Sin conflictos de interes.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[#6b7280]">
              InvertiScore no vende propiedades. No cobra comisiones. No trabaja para inmobiliarias. Solo analizamos datos para que tu decidas mejor.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
              {[
                { icon: ShieldCheck, text: "Sin comisiones" },
                { icon: Database, text: "Datos publicos" },
                { icon: Bot, text: "IA independiente" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-3 transition-all duration-200 hover:shadow-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ecfdf5]">
                    <item.icon className="h-4 w-4 text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium text-[#374151]">{item.text}</span>
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

      {/* ============ S9: CTA FINAL ============ */}
      <section className="px-6 py-[60px] md:py-[100px]" style={{ background: "linear-gradient(135deg, #0f172a 0%, #064e3b 100%)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-3xl font-bold text-white md:text-5xl">
              Antes de firmar, conoce los numeros reales.
            </h2>
            <div className="mt-10">
              <Link href="/analisis/nuevo">
                <Button size="lg" className="gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/30 transition-all duration-200 hover:bg-[#10b981] hover:shadow-xl hover:shadow-[#059669]/40">
                  Analiza gratis tu proxima inversion <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {analysisCount !== null && analysisCount > 0 && (
              <p className="mt-6 text-sm text-white/50">
                Ya analizaron {analysisCount.toLocaleString("es-CL")} propiedades con InvertiScore
              </p>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#111] px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <span className="font-serif text-lg font-bold text-white">InvertiScore</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#6b7280]">
            <Link href="/" className="transition-colors duration-200 hover:text-white">Inicio</Link>
            <span className="text-[#333]">·</span>
            <Link href="/pricing" className="transition-colors duration-200 hover:text-white">Pricing</Link>
            <span className="text-[#333]">·</span>
            <Link href="/dashboard" className="transition-colors duration-200 hover:text-white">Dashboard</Link>
            <span className="text-[#333]">·</span>
            <Link href="/login" className="transition-colors duration-200 hover:text-white">Iniciar Sesion</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-5xl text-center text-xs text-[#444]">
          &copy; 2026 InvertiScore · Datos de Portal Inmobiliario, Banco Central, SII
        </div>
      </footer>
    </div>
  );
}
