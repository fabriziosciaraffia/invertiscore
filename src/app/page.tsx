"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShieldAlert,
  EyeOff,
  Scale,
  ClipboardPaste,
  Brain,
  BarChart3,
  Check,
  X,
  Menu,
  X as XIcon,
  Sparkles,
  ShieldCheck,
  Eye,
  Zap,
} from "lucide-react";

// ============================================================
// CSS Mesh Gradient — animated aurora borealis for hero / CTA
// ============================================================
function MeshGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`${className} overflow-hidden`}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(5,150,105,0.5) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 70%, rgba(16,185,129,0.35) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 50% 10%, rgba(5,150,105,0.3) 0%, transparent 50%),
            radial-gradient(ellipse 50% 70% at 70% 50%, rgba(52,211,153,0.2) 0%, transparent 50%)
          `,
          animation: "meshMove 12s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 75% 20%, rgba(5,150,105,0.35) 0%, transparent 55%),
            radial-gradient(ellipse 50% 60% at 30% 80%, rgba(16,185,129,0.25) 0%, transparent 50%)
          `,
          animation: "meshMove2 15s ease-in-out infinite alternate",
        }}
      />
      <style jsx>{`
        @keyframes meshMove {
          0% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(5%, -3%) scale(1.05); }
          66% { transform: translate(-3%, 5%) scale(0.97); }
          100% { transform: translate(2%, -2%) scale(1.02); }
        }
        @keyframes meshMove2 {
          0% { transform: translate(0%, 0%) rotate(0deg) scale(1); }
          50% { transform: translate(-4%, 3%) rotate(3deg) scale(1.06); }
          100% { transform: translate(3%, -4%) rotate(-2deg) scale(0.98); }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Animated Score Circle for hero demo — with glow
// ============================================================
function AnimatedScore({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let current = 0;
          const step = () => {
            current += 1;
            if (current > target) { setValue(target); return; }
            setValue(current);
            requestAnimationFrame(step);
          };
          step();
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  const color = value >= 80 ? "#059669" : value >= 65 ? "#3b82f6" : value >= 50 ? "#eab308" : value >= 30 ? "#f97316" : "#ef4444";
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div ref={ref} className="relative inline-flex h-32 w-32 items-center justify-center">
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 30px ${color}40, 0 0 60px ${color}20`, animation: "scoreGlow 3s ease-in-out infinite alternate" }} />
      <svg className="absolute inset-0" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 0.05s", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="text-center">
        <div className="text-4xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-white/60">InvertiScore</div>
      </div>
      <style jsx>{`
        @keyframes scoreGlow {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Count-up metric for demo section
// ============================================================
function CountUp({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
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
          let start = 0;
          const duration = 1200;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            start = target * eased;
            setDisplay(`${sign}${start.toFixed(decimalPlaces)}${rest}${suffix}`);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, suffix]);

  return <span ref={ref}>{display}</span>;
}

// ============================================================
// Fade-in on scroll wrapper — 30px, 0.6s ease-out
// ============================================================
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
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
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="bg-white text-[#1a1a1a]">
      {/* ============ NAVBAR ============ */}
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? "border-b border-[#e5e5e5]/80 bg-white/95 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={scrolled ? "#059669" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className={`font-serif text-xl font-bold transition-colors ${scrolled ? "text-[#1a1a1a]" : "text-white"}`}>
              InvertiScore
            </span>
          </Link>
          {/* Desktop */}
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/pricing">
              <Button variant="ghost" size="sm" className={`${scrolled ? "text-[#6b7280] hover:text-[#1a1a1a]" : "text-white/70 hover:text-white"}`}>
                Pricing
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className={`${scrolled ? "text-[#6b7280] hover:text-[#1a1a1a]" : "text-white/70 hover:text-white"}`}>
                Iniciar Sesión
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="rounded-lg bg-[#059669] text-white shadow-md shadow-[#059669]/25 hover:bg-[#047857]">
                Registrarse
              </Button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button className={`p-2 sm:hidden ${scrolled ? "text-[#6b7280]" : "text-white/80"}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[#e5e5e5]/50 bg-white px-4 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-[#6b7280]">Pricing</Button>
              </Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-[#6b7280]">Iniciar Sesión</Button>
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full rounded-lg bg-[#059669] text-white hover:bg-[#047857]">Registrarse</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ============ S1: HERO ============ */}
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1a4731] to-[#0f172a]">
        {/* Mesh gradient aurora */}
        <MeshGradient className="absolute inset-0" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Decorative circles */}
        <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-emerald-500/8 blur-3xl" />

        <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4 pt-16 lg:flex-row lg:gap-16 lg:pt-0">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <FadeIn>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-emerald-300 backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                Análisis potenciado por IA
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <h1 className="max-w-2xl text-balance font-serif text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                No vendemos deptos.
                <br />
                <span className="text-emerald-400">Te decimos si deberías comprarlos.</span>
              </h1>
            </FadeIn>
            <FadeIn delay={200}>
              <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-white/60 lg:mx-0">
                InvertiScore analiza propiedades en Chile con inteligencia artificial. Score de inversión objetivo, sin sesgos, sin conflictos de interés.
              </p>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="mt-10">
                <Link href="/register">
                  <Button size="lg" className="gap-2 rounded-lg bg-[#059669] text-base text-white shadow-lg shadow-[#059669]/30 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/40 transition-all duration-300">
                    Analiza gratis tu próxima inversión <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-3 text-sm text-white/40">Sin tarjeta de crédito. Análisis ilimitados.</p>
              </div>
            </FadeIn>
          </div>
          {/* Hero Demo Card — 3D floating */}
          <FadeIn delay={400} className="mt-12 flex-shrink-0 lg:mt-0">
            <div
              className="w-[340px] rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:w-[380px] transition-transform duration-500 hover:scale-[1.02]"
              style={{
                transform: "perspective(1000px) rotateX(2deg) rotateY(-3deg)",
                animation: "float 6s ease-in-out infinite",
              }}
            >
              <div className="flex items-center gap-4">
                <AnimatedScore target={72} />
                <div>
                  <div className="text-sm font-semibold text-emerald-400">Inversión Buena</div>
                  <div className="text-xs text-white/50">Depto 2D1B Ñuñoa</div>
                  <div className="mt-1 text-xs text-white/40">3.200 UF · $420.000/mes</div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "Yield Bruto", val: "5.2%" },
                  { label: "Flujo Mensual", val: "-$48K", color: "text-red-400" },
                  { label: "Precio/m²", val: "61.5 UF" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-center">
                    <div className="text-[10px] text-white/40">{m.label}</div>
                    <div className={`mt-0.5 text-sm font-bold ${m.color || "text-white"}`}>{m.val}</div>
                  </div>
                ))}
              </div>
              {/* Mini radar */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
                {[
                  { d: "Rent.", v: 68 },
                  { d: "Flujo", v: 55 },
                  { d: "Plusv.", v: 78 },
                  { d: "Riesgo", v: 65 },
                  { d: "Ubic.", v: 80 },
                ].map((r) => (
                  <div key={r.d} className="text-center">
                    <div className="text-[9px] text-white/40">{r.d}</div>
                    <div className="mt-0.5 text-xs font-bold text-emerald-400">{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: perspective(1000px) rotateX(2deg) rotateY(-3deg) translateY(0px); }
            50% { transform: perspective(1000px) rotateX(1deg) rotateY(-1deg) translateY(-10px); }
          }
        `}</style>
      </section>

      {/* ============ S2: SOCIAL PROOF ============ */}
      <section className="border-b border-[#f0f0f0] bg-white py-8">
        <div className="container mx-auto px-4 text-center">
          <FadeIn>
            <p className="mb-4 text-sm text-[#9ca3af]">Basado en +3.000 publicaciones activas en Santiago</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-[#c4c4c4]">
              <span>Portal Inmobiliario</span>
              <span>·</span>
              <span>TocToc</span>
              <span>·</span>
              <span>Banco Central</span>
              <span>·</span>
              <span>SII</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ S3: EL PROBLEMA ============ */}
      <section className="bg-[#fafafa] py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                Tu corredor no es tu asesor financiero
              </h2>
              <p className="mt-4 text-[#6b7280]">
                Su incentivo es cerrar la venta, no proteger tu inversión.
              </p>
            </div>
          </FadeIn>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              { icon: ShieldAlert, title: "Sesgo de venta", desc: "Nunca te va a decir \"no compres\", aunque sea la decisión correcta." },
              { icon: Scale, title: "Sin accountability", desc: "Si la inversión sale mal, el corredor ya cobró su comisión." },
              { icon: EyeOff, title: "Asimetría de información", desc: "Tú necesitas tus propios datos para negociar en igualdad." },
            ].map((c, i) => (
              <FadeIn key={c.title} delay={i * 120}>
                <div className="group rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#d1d5db]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 transition-colors group-hover:bg-red-100">
                    <c.icon className="h-5 w-5 text-red-500" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-[#1a1a1a]">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6b7280]">{c.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ S4: DEMO DEL PRODUCTO ============ */}
      <section className="bg-white py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                Así se ve un InvertiScore
              </h2>
              <p className="mt-4 text-[#6b7280]">Análisis real de un departamento en Ñuñoa, Santiago</p>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-[#e5e5e5] bg-[#fafafa] shadow-lg transition-shadow duration-300 hover:shadow-xl">
              {/* Score header */}
              <div className="flex flex-col items-center gap-6 border-b border-[#e5e5e5] bg-white p-8 md:flex-row md:items-start">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[3px] border-[#059669]" style={{ boxShadow: "0 0 20px rgba(5,150,105,0.15)" }}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#059669]">72</div>
                    <div className="text-[9px] text-[#9ca3af]">SCORE</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-blue-500">Inversión Buena</div>
                  <h3 className="text-xl font-bold text-[#1a1a1a]">Depto 2D1B Ñuñoa</h3>
                  <p className="text-sm text-[#9ca3af]">Ñuñoa, Santiago · 52 m² · 8 años · Departamento</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#6b7280]">3.200 UF</span>
                    <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#6b7280]">$420.000/mes</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[#059669]">Yield 5.2%</span>
                  </div>
                </div>
              </div>
              {/* 8 Metrics with count-up */}
              <div className="grid grid-cols-2 gap-px bg-[#e5e5e5] sm:grid-cols-4">
                {[
                  { l: "Yield Bruto", v: "5.2%" },
                  { l: "Yield Neto", v: "3.1%" },
                  { l: "CAP Rate", v: "3.8%" },
                  { l: "Cash-on-Cash", v: "4.2%" },
                  { l: "ROI Total", v: "2.3x" },
                  { l: "TIR", v: "12.4%" },
                  { l: "Payback Pie", v: "186 meses" },
                  { l: "UF/m²", v: "61.5" },
                ].map((m) => (
                  <div key={m.l} className="bg-white p-4 text-center">
                    <div className="text-[10px] text-[#9ca3af]">{m.l}</div>
                    <div className="mt-0.5 text-lg font-bold text-[#1a1a1a]">
                      <CountUp value={m.v} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Radar + Cashflow preview */}
              <div className="grid gap-px bg-[#e5e5e5] md:grid-cols-2">
                {/* Radar bars */}
                <div className="bg-white p-6">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Dimensiones del Score</div>
                  {[
                    { d: "Rentabilidad", v: 68, w: 30 },
                    { d: "Flujo de Caja", v: 55, w: 25 },
                    { d: "Plusvalía", v: 78, w: 20 },
                    { d: "Bajo Riesgo", v: 65, w: 15 },
                    { d: "Ubicación", v: 80, w: 10 },
                  ].map((r) => (
                    <div key={r.d} className="mb-2">
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
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Flujo de caja — 12 meses</div>
                  <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                    {[0, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85].map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                        <div className="w-full rounded-sm bg-[#059669]/80" style={{ height: `${Math.max(v * 0.7, 2)}px` }} />
                        <div className="w-full rounded-sm bg-red-400/80" style={{ height: `${Math.max((100 - v) * 0.7, 2)}px` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#9ca3af]">
                    <span>M1</span><span>M6</span><span>M12</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#059669]/80" /> Ingreso</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400/80" /> Egresos</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 text-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 rounded-lg bg-[#059669] text-base text-white shadow-lg shadow-[#059669]/25 hover:bg-[#047857] hover:shadow-xl transition-all duration-300">
                  Pruébalo gratis con tu próxima inversión <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ S5: CÓMO FUNCIONA ============ */}
      <section className="bg-[#fafafa] py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                De datos a decisión en 30 segundos
              </h2>
            </div>
          </FadeIn>
          <div className="mx-auto mt-14 grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              { icon: ClipboardPaste, step: "01", title: "Ingresa los datos", desc: "Pega el link o ingresa manualmente. La IA sugiere arriendo, gastos y contribuciones." },
              { icon: Brain, step: "02", title: "IA analiza todo", desc: "Evaluamos rentabilidad, flujo, plusvalía, riesgo y ubicación contra datos reales del mercado." },
              { icon: BarChart3, step: "03", title: "Obtén tu InvertiScore", desc: "Score de 1-100 con análisis detallado, proyecciones y escenarios de salida." },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 120}>
                <div className="relative text-center">
                  {i < 2 && (
                    <div className="absolute right-0 top-8 hidden h-px w-1/3 -translate-x-0 bg-[#e5e5e5] md:block" style={{ right: "-16.5%" }} />
                  )}
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#059669]/10">
                    <s.icon className="h-6 w-6 text-[#059669]" />
                  </div>
                  <div className="mb-1 text-xs font-bold text-[#059669]">PASO {s.step}</div>
                  <h3 className="mb-2 text-lg font-semibold text-[#1a1a1a]">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6b7280]">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ S6: QUÉ INCLUYE ============ */}
      <section className="bg-white py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                Todo lo que necesitas para decidir
              </h2>
            </div>
          </FadeIn>
          <div className="mx-auto mt-14 grid max-w-3xl gap-8 md:grid-cols-2">
            <FadeIn>
              <div className="group rounded-xl border border-[#e5e5e5] bg-white p-6 transition-all duration-300 hover:shadow-md hover:border-[#d1d5db]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#6b7280]">GRATIS</div>
                <ul className="space-y-3 text-sm">
                  {[
                    "InvertiScore (1-100) + clasificación",
                    "Radar chart 5 dimensiones",
                    "3 métricas principales",
                    "8 métricas de inversión completas",
                    "Análisis de sensibilidad interactivo",
                    "Puntos críticos (break-even, precio máximo)",
                    "Comparación con zona + mapa",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                      <span className="text-[#374151]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <div className="group rounded-xl border-2 border-[#059669]/30 bg-emerald-50/30 p-6 transition-all duration-300 hover:shadow-md hover:border-[#059669]/50">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#059669] px-3 py-1 text-xs font-semibold text-white">PRO — $4.990</div>
                <p className="mb-4 text-xs text-[#6b7280]">Todo lo gratis, más:</p>
                <ul className="space-y-3 text-sm">
                  {[
                    "Cascada de costos mensuales",
                    "Análisis detallado IA (pros, contras, veredicto)",
                    "Flujo de caja dinámico (1-20 años)",
                    "Proyección de patrimonio neto",
                    "Escenario de salida (venta + refinanciamiento)",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                      <span className="text-[#374151]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ S7: PRICING ============ */}
      <section className="bg-[#fafafa] py-20 md:py-28">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                Elige tu nivel de análisis
              </h2>
              <p className="mt-4 text-[#6b7280]">Desde un score rápido hasta un sistema completo de gestión de portafolio.</p>
            </div>
          </FadeIn>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {/* Gratis */}
            <FadeIn>
              <div className="flex h-full flex-col rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[#d1d5db]">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Gratis</h3>
                  <div className="mt-1"><span className="text-3xl font-bold text-[#1a1a1a]">$0</span></div>
                </div>
                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {["InvertiScore + radar", "8 métricas de inversión", "Sensibilidad interactiva", "Comparación con zona"].map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" /><span className="text-[#374151]">{f}</span></li>
                  ))}
                  {["Flujo de caja proyectado", "Análisis detallado IA"].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[#c4c4c4]"><X className="mt-0.5 h-4 w-4 shrink-0" /><span>{f}</span></li>
                  ))}
                </ul>
                <Link href="/register" className="block">
                  <Button variant="outline" className="w-full rounded-lg border-[#d1d5db] text-[#1a1a1a] hover:bg-[#f3f4f6]">Comenzar gratis</Button>
                </Link>
              </div>
            </FadeIn>
            {/* Pro — with green glow */}
            <FadeIn delay={100}>
              <div
                className="relative flex h-full flex-col rounded-xl border-2 border-[#059669]/40 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl"
                style={{ boxShadow: "0 4px 30px rgba(5,150,105,0.12), 0 0 0 1px rgba(5,150,105,0.05)" }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-0.5 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>Popular</div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Informe Pro</h3>
                  <div className="mt-1"><span className="text-3xl font-bold text-[#1a1a1a]">$4.990</span><span className="text-sm text-[#6b7280]"> / análisis</span></div>
                </div>
                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {["Todo lo del plan gratis", "Cascada de costos", "Análisis detallado IA", "Flujo dinámico 1-20 años", "Proyección de patrimonio", "Escenario de salida"].map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" /><span className="text-[#374151]">{f}</span></li>
                  ))}
                </ul>
                <Link href="/register" className="block">
                  <Button className="w-full rounded-lg bg-[#059669] text-white shadow-md shadow-[#059669]/25 hover:bg-[#047857] hover:shadow-lg transition-all duration-300">Obtener informe</Button>
                </Link>
              </div>
            </FadeIn>
            {/* Monitor */}
            <FadeIn delay={200}>
              <div className="relative flex h-full flex-col rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[#d1d5db]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6b7280] px-3 py-0.5 text-xs font-semibold text-white">Próximamente</div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">Plan Monitor</h3>
                  <div className="mt-1"><span className="text-3xl font-bold text-[#1a1a1a]">$7.990</span><span className="text-sm text-[#6b7280]"> / mes</span></div>
                </div>
                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {["Todo lo del Informe Pro", "Informes ilimitados", "Monitoreo de portafolio", "Alertas de oportunidades", "Soporte prioritario"].map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" /><span className="text-[#374151]">{f}</span></li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-lg border-[#d1d5db] text-[#9ca3af]" disabled>Próximamente</Button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ S8: POSICIONAMIENTO ============ */}
      <section className="relative bg-white py-20 md:py-28">
        {/* Grid pattern background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, #059669 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="container relative mx-auto px-4">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
                Solo datos. Sin conflictos de interés.
              </h2>
              <p className="mt-4 text-[#6b7280]">
                InvertiScore no vende propiedades, no cobra comisiones de venta, y no trabaja para ninguna inmobiliaria. Nuestro único incentivo es que tomes la mejor decisión.
              </p>
            </div>
          </FadeIn>
          <div className="mx-auto mt-14 grid max-w-3xl gap-8 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Sin comisiones de venta", desc: "No ganamos un peso si compras o no compras." },
              { icon: Eye, title: "Datos públicos y verificables", desc: "Usamos fuentes abiertas que tú mismo puedes consultar." },
              { icon: Zap, title: "IA independiente", desc: "El algoritmo no tiene sesgo hacia ninguna propiedad ni zona." },
            ].map((p, i) => (
              <FadeIn key={p.title} delay={i * 120}>
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.1), rgba(16,185,129,0.15))" }}>
                    <p.icon className="h-5 w-5 text-[#059669]" />
                  </div>
                  <h3 className="mb-2 font-semibold text-[#1a1a1a]">{p.title}</h3>
                  <p className="text-sm text-[#6b7280]">{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ S9: CTA FINAL ============ */}
      <section className="relative overflow-hidden py-24 md:py-32" style={{ background: "linear-gradient(135deg, #0f172a 0%, #064e3b 40%, #0f172a 70%, #1a4731 100%)" }}>
        {/* Mesh gradient for CTA */}
        <MeshGradient className="absolute inset-0" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        {/* Decorative glows */}
        <div className="absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="container relative mx-auto px-4 text-center">
          <FadeIn>
            <h2 className="font-serif text-3xl font-bold text-white md:text-5xl">
              Obtén tu InvertiScore gratis
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/60">
              Deja de confiar en corredores. Empieza a tomar decisiones basadas en datos.
            </p>
            <div className="mt-10">
              <Link href="/register">
                <Button size="lg" className="gap-2 rounded-lg bg-[#059669] text-base text-white shadow-lg shadow-[#059669]/30 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/40 transition-all duration-300">
                  Analiza gratis tu próxima inversión <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#0f172a] py-12 text-center">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="font-serif text-lg font-bold text-white">InvertiScore</span>
          </div>
          <div className="mb-6 flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link href="/" className="text-white/50 transition-colors hover:text-white">Inicio</Link>
            <Link href="/pricing" className="text-white/50 transition-colors hover:text-white">Pricing</Link>
            <Link href="/dashboard" className="text-white/50 transition-colors hover:text-white">Dashboard</Link>
            <Link href="/login" className="text-white/50 transition-colors hover:text-white">Iniciar Sesión</Link>
          </div>
          <p className="mb-2 text-xs text-white/30">&copy; 2026 InvertiScore. Todos los derechos reservados.</p>
          <p className="text-xs text-white/20">Datos de Portal Inmobiliario, TocToc, Banco Central, SII</p>
        </div>
      </footer>
    </div>
  );
}
