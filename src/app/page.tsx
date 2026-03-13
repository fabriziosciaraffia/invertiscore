"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Menu, X as XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import type { User } from "@supabase/supabase-js";

// ============================================================
// FadeIn — standard slide-up animation
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
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// MAIN LANDING
// ============================================================
export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = user ? "/analisis/nuevo" : "/register";
  const transparent = !scrolled;

  return (
    <div className="min-h-screen">
      {/* ============================================================ */}
      {/* HEADER */}
      {/* ============================================================ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent
            ? "bg-transparent border-transparent"
            : "bg-white/90 backdrop-blur-xl border-b border-[#E6E6E2]"
        }`}
      >
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <FrancoLogo size="header" inverted={transparent} href="/" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#como-funciona" className={`font-body text-sm transition-colors ${transparent ? "text-white/50 hover:text-white/80" : "text-[#71717A] hover:text-[#0F0F0F]"}`}>
              Cómo funciona
            </a>
            <a href="#pricing" className={`font-body text-sm transition-colors ${transparent ? "text-white/50 hover:text-white/80" : "text-[#71717A] hover:text-[#0F0F0F]"}`}>
              Precios
            </a>
            {user && (
              <Link href="/dashboard" className={`font-body text-sm transition-colors ${transparent ? "text-white/50 hover:text-white/80" : "text-[#71717A] hover:text-[#0F0F0F]"}`}>
                Dashboard
              </Link>
            )}
            <Link
              href={ctaHref}
              className="bg-[#C8323C] text-white font-body text-sm font-bold px-5 py-2 rounded-lg hover:bg-[#b02a33] transition-colors"
            >
              Analizar gratis
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu
              ? <XIcon className={transparent ? "text-white" : "text-[#0F0F0F]"} size={22} />
              : <Menu className={transparent ? "text-white" : "text-[#0F0F0F]"} size={22} />
            }
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-[#E6E6E2] px-6 py-4 flex flex-col gap-3">
            <a href="#como-funciona" className="font-body text-sm text-[#71717A]" onClick={() => setMobileMenu(false)}>Cómo funciona</a>
            <a href="#pricing" className="font-body text-sm text-[#71717A]" onClick={() => setMobileMenu(false)}>Precios</a>
            {user && <Link href="/dashboard" className="font-body text-sm text-[#71717A]" onClick={() => setMobileMenu(false)}>Dashboard</Link>}
            <Link href={ctaHref} className="bg-[#C8323C] text-white font-body text-sm font-bold px-5 py-2.5 rounded-lg text-center" onClick={() => setMobileMenu(false)}>
              Analizar gratis
            </Link>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* SECTION 1 — HERO */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden pt-14"
        style={{ background: "linear-gradient(135deg, #0F0F0F 0%, #2A2A2A 100%)" }}
      >
        {/* Red glow */}
        <div
          className="absolute top-[-40px] right-[-40px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,50,60,0.03), transparent 70%)" }}
        />
        {/* Bottom red line */}
        <div
          className="absolute bottom-0 w-full h-[2px] pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,50,60,0.12), transparent)" }}
        />

        <div className="max-w-[960px] mx-auto px-6 py-[72px] pb-20">
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-8 md:gap-12 items-center">
            {/* Left column — text */}
            <div>
              <FadeIn>
                <h1 className="font-heading font-bold text-4xl md:text-[44px] text-white leading-[1.08] tracking-tight">
                  ¿Ese depto es buena inversión?
                </h1>
              </FadeIn>

              <FadeIn delay={100}>
                <p className="font-body text-[17px] text-white/50 mt-5 leading-relaxed max-w-[460px]">
                  Tu corredor dice que sí — él gana <span className="text-white/75 font-semibold">$3.5M si compras</span>. Franco te muestra los números reales. Gratis, en 30 segundos.
                </p>
              </FadeIn>

              <FadeIn delay={200}>
                <Link
                  href={ctaHref}
                  className="inline-block bg-[#C8323C] text-white font-body text-base font-bold px-8 py-4 rounded-lg mt-8 hover:bg-[#b02a33] transition-colors"
                  style={{ boxShadow: "0 4px 20px rgba(200,50,60,0.3)" }}
                >
                  Analizar un departamento →
                </Link>
                <p className="font-body text-xs text-white/25 mt-3">
                  Sin registro. Sin tarjeta. Resultado inmediato.
                </p>
              </FadeIn>

              {/* Stats bar */}
              <FadeIn delay={300}>
                <div className="flex mt-9 border-t border-white/[0.08] pt-5 gap-0">
                  <div className="flex-1 pr-5 border-r border-white/[0.08]">
                    <p className="font-mono text-xl font-bold text-[#C8323C]">73%</p>
                    <p className="font-body text-[10px] text-white/35 mt-0.5">de los deptos analizados tienen flujo negativo</p>
                  </div>
                  <div className="flex-1 px-5 border-r border-white/[0.08]">
                    <p className="font-mono text-xl font-bold text-[#C8323C]">-$412K</p>
                    <p className="font-body text-[10px] text-white/35 mt-0.5">flujo mensual promedio en Santiago Centro</p>
                  </div>
                  <div className="flex-1 pl-5">
                    <p className="font-mono text-xl font-bold text-[#C8323C]">0</p>
                    <p className="font-body text-[10px] text-white/35 mt-0.5">corredores que te muestran estos datos</p>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Right column — score card preview */}
            <FadeIn delay={200} className="flex flex-col items-center">
              <p className="font-mono text-[8px] text-white/30 uppercase tracking-[0.1em] text-center mb-2">
                Ejemplo de análisis
              </p>
              <div className="bg-white rounded-2xl p-5 w-[260px]" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
                <p className="font-mono text-[8px] text-[#71717A] uppercase tracking-[0.1em]">Franco Score</p>
                <p className="font-heading font-bold text-[42px] text-[#0F0F0F] leading-none">54</p>
                <p className="font-body text-[11px] text-[#C8323C] font-bold mt-1">No compres — negocia primero</p>

                {/* Mini bars */}
                <div className="mt-4 space-y-2.5">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-body text-[9px] text-[#71717A]">Rent.</span>
                      <span className="font-mono text-[9px] font-bold text-[#0F0F0F]">3.9%</span>
                    </div>
                    <div className="h-1.5 bg-[#F0F0EC] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F0F0F]/30 rounded-full" style={{ width: "39%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-body text-[9px] text-[#71717A]">Flujo</span>
                      <span className="font-mono text-[9px] font-bold text-[#C8323C]">-$378K</span>
                    </div>
                    <div className="h-1.5 bg-[#F0F0EC] rounded-full overflow-hidden">
                      <div className="h-full bg-[#C8323C]/40 rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-body text-[9px] text-[#71717A]">Plusv.</span>
                      <span className="font-mono text-[9px] font-bold text-[#0F0F0F]">Alta</span>
                    </div>
                    <div className="h-1.5 bg-[#F0F0EC] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F0F0F]/30 rounded-full" style={{ width: "75%" }} />
                    </div>
                  </div>
                </div>

                {/* Badge NEGOCIAR */}
                <div className="mt-4 flex justify-center">
                  <span className="font-mono text-[10px] font-bold text-[#C8323C] bg-[#C8323C]/10 px-3 py-1 rounded-md tracking-wide">
                    NEGOCIAR
                  </span>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Scroll indicator */}
          <div className="text-center mt-10">
            <p className="font-body text-[11px] text-white/20">Descubre cómo funciona</p>
            <p className="font-body text-lg text-white/15 mt-1 animate-bounce">↓</p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — CÓMO FUNCIONA */}
      {/* ============================================================ */}
      <section id="como-funciona" className="bg-white py-16">
        <div className="max-w-[800px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-[28px] text-[#0F0F0F] text-center tracking-tight">
              Así de simple
            </h2>
            <p className="font-body text-sm text-[#71717A] text-center mt-1.5 mb-10">
              30 segundos. Sin registro. Sin letra chica.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { emoji: "📝", num: "1", title: "Ingresa los datos", desc: "Precio, arriendo, gastos. O pega el link de la publicación y Franco extrae todo." },
              { emoji: "⚡", num: "2", title: "Franco analiza", desc: "Flujo real, rentabilidad neta, plusvalía y 8 métricas más. Con datos de mercado, no supuestos." },
              { emoji: "✓", num: "3", title: "Decide informado", desc: "Score de 1-100 y un veredicto claro: COMPRAR, NEGOCIAR o BUSCAR OTRA. Sin jerga." },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 100} className="text-center">
                <p className="text-[28px] mb-3">{step.emoji}</p>
                <div className="w-6 h-6 rounded-full bg-[#0F0F0F] flex items-center justify-center mx-auto mb-2.5">
                  <span className="font-mono text-[11px] font-bold text-white">{step.num}</span>
                </div>
                <p className="font-body text-sm font-bold text-[#0F0F0F] mb-1.5">{step.title}</p>
                <p className="font-body text-[13px] text-[#71717A] leading-snug">{step.desc}</p>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={300}>
            <div className="text-center mt-8">
              <Link
                href={ctaHref}
                className="inline-block bg-[#0F0F0F] text-white font-body text-sm font-semibold px-7 py-3 rounded-lg hover:bg-[#2A2A2A] transition-colors"
              >
                Probar ahora — es gratis →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — DEMO */}
      {/* ============================================================ */}
      <section className="bg-[#FAFAF8] py-16">
        <div className="max-w-[560px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-[28px] text-[#0F0F0F] text-center tracking-tight">
              Mira un análisis real
            </h2>
            <p className="font-body text-sm text-[#71717A] text-center mt-1.5 mb-8">
              Depto 2D1B en Providencia. Sin filtros, sin maquillaje.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="bg-white rounded-2xl border border-[#E6E6E2] p-8 shadow-sm">
              {/* Score + Badge */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[9px] text-[#71717A] uppercase tracking-[0.1em]">Franco Score</p>
                  <p className="font-heading font-bold text-[42px] text-[#0F0F0F] leading-none">54</p>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#C8323C] bg-[#C8323C]/10 px-3 py-1 rounded-md tracking-wide mt-2">
                  NEGOCIAR
                </span>
              </div>
              <p className="font-body text-xs text-[#71717A] mt-1">Depto 2D1B · Providencia · 55m²</p>

              {/* 3 metrics */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="bg-[#FAFAF8] rounded-[10px] p-3.5 text-center">
                  <p className="font-body text-[9px] text-[#71717A] uppercase tracking-wide">Flujo mensual</p>
                  <p className="font-mono text-lg font-bold text-[#C8323C]">-$378K</p>
                </div>
                <div className="bg-[#FAFAF8] rounded-[10px] p-3.5 text-center">
                  <p className="font-body text-[9px] text-[#71717A] uppercase tracking-wide">Rent. neta</p>
                  <p className="font-mono text-lg font-bold text-[#0F0F0F]">2.3%</p>
                </div>
                <div className="bg-[#FAFAF8] rounded-[10px] p-3.5 text-center">
                  <p className="font-body text-[9px] text-[#71717A] uppercase tracking-wide">Retorno 10a</p>
                  <p className="font-mono text-lg font-bold text-[#0F0F0F]">1.9x</p>
                </div>
              </div>

              {/* Siendo franco box */}
              <div className="mt-5 p-3.5 bg-[#C8323C]/[0.03] rounded-[10px] border-l-[3px] border-[#C8323C]">
                <p className="font-body text-[13px] text-[#0F0F0F] leading-relaxed">
                  <strong>Siendo franco:</strong> este depto te cuesta $378K/mes de tu bolsillo. Con plusvalía de 4%, en 10 años tu patrimonio se multiplica 1.9x. Negociable si consigues mejor precio.
                </p>
              </div>

              {/* Link to demo */}
              <div className="text-center mt-5">
                <Link
                  href="/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1"
                  className="font-body text-[13px] font-semibold text-[#C8323C] hover:underline"
                >
                  Ver análisis completo →
                </Link>
                <p className="font-body text-[10px] text-[#71717A] mt-1">Es gratis. Sin registro.</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 — POR QUÉ FRANCO */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden py-[68px]"
        style={{ background: "linear-gradient(160deg, #0F0F0F 0%, #1A1A2E 50%, #2A2A2A 100%)" }}
      >
        {/* Red glow bottom-left */}
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,50,60,0.03), transparent 70%)" }}
        />

        <div className="max-w-[800px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-[28px] text-white text-center">
              Tu corredor gana si compras.
            </h2>
            <h2 className="font-heading font-bold text-[28px] text-[#C8323C] text-center mt-2">
              Franco gana si decides bien.
            </h2>
          </FadeIn>

          {/* Comparador */}
          <FadeIn delay={100}>
            <div className="flex flex-col md:flex-row gap-4 md:gap-5 mt-9 mb-8">
              {/* Card corredor */}
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 md:p-8 opacity-50">
                <p className="font-mono text-[9px] text-white/40 uppercase tracking-[0.1em] mb-3">TU CORREDOR TE MUESTRA</p>
                <p className="font-heading font-bold text-4xl md:text-5xl text-white/50">5.2%</p>
                <p className="font-body text-xs text-white/30 mt-1">Rentabilidad bruta</p>
                <p className="font-body text-[11px] text-white/20 italic mt-3">&ldquo;Excelente oportunidad&rdquo;</p>
              </div>

              {/* Card Franco */}
              <div className="flex-1 relative bg-white/[0.05] border-2 border-[#C8323C] rounded-xl p-6 md:p-8" style={{ boxShadow: "0 0 30px rgba(200,50,60,0.06)" }}>
                <span className="absolute top-[-10px] right-3.5 bg-[#C8323C] text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded">
                  LA VERDAD
                </span>
                <p className="font-mono text-[9px] text-white uppercase tracking-[0.1em] font-semibold mb-3">FRANCO TE MUESTRA</p>
                <p className="font-heading font-bold text-4xl md:text-5xl text-[#C8323C]">2.3%</p>
                <p className="font-body text-xs text-white font-semibold mt-1">Rentabilidad neta real</p>
                <p className="font-body text-[11px] text-white/50 mt-3">-$378K/mes de tu bolsillo</p>
              </div>
            </div>
          </FadeIn>

          {/* Punchline */}
          <FadeIn delay={200}>
            <p className="font-body text-[13px] text-white/40 text-center mb-8">
              El mismo departamento. Las mismas 4 paredes. <span className="text-white font-semibold">Distintos incentivos.</span>
            </p>
          </FadeIn>

          {/* 3 reason cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "Su comisión: $3.5M",
                text: "El corredor gana entre 1% y 2% del precio. Los cobra el día que firmas. Si el depto pierde plata, él ya cobró.",
              },
              {
                title: "Te muestra el 5%, no el 2.3%",
                text: "La rentabilidad bruta no descuenta nada. El flujo real — cuánto sale de tu bolsillo — nunca aparece en la cotización.",
              },
              {
                title: "Si sale mal, no devuelve nada",
                text: "Tú asumes el riesgo por 25 años. Franco no vende propiedades ni cobra comisiones de venta.",
              },
            ].map((card, i) => (
              <FadeIn key={i} delay={250 + i * 80}>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-4">
                  <p className="font-body text-[13px] font-bold text-white mb-2">{card.title}</p>
                  <p className="font-body text-[11px] text-white/40 leading-relaxed">{card.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — PRICING */}
      {/* ============================================================ */}
      <section id="pricing" className="bg-white py-16">
        <div className="max-w-[620px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-[28px] text-[#0F0F0F] text-center">
              Gratis. En serio.
            </h2>
            <p className="font-body text-sm text-[#71717A] text-center mt-1.5 mb-8">
              Analiza gratis. El Informe Pro incluye proyecciones a 20 años y análisis IA.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Free tier */}
            <FadeIn delay={0}>
              <div className="bg-white border border-[#E6E6E2] rounded-xl p-6 h-full flex flex-col">
                <p className="font-body text-sm font-bold text-[#0F0F0F]">Gratis</p>
                <p className="font-heading font-bold text-[32px] text-[#0F0F0F] mt-1">$0</p>
                <p className="font-body text-[11px] text-[#71717A] mt-1 mb-4">Score + métricas + comparación</p>
                <div className="space-y-2.5 flex-1">
                  {["Franco Score 1-100", "8 métricas de rentabilidad", "Comparación con la zona", "Análisis de sensibilidad"].map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0F0F0F] mt-0.5 flex-shrink-0" />
                      <span className="font-body text-[11.5px] text-[#71717A]">{f}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={ctaHref}
                  className="block w-full bg-[#0F0F0F] text-white font-body text-[13px] font-semibold py-2.5 rounded-lg mt-4 text-center hover:bg-[#2A2A2A] transition-colors"
                >
                  Comenzar gratis
                </Link>
              </div>
            </FadeIn>

            {/* Pro tier */}
            <FadeIn delay={100}>
              <div className="relative bg-white border-2 border-[#C8323C] rounded-xl p-6 h-full flex flex-col">
                <span className="absolute top-[-10px] right-3.5 bg-[#C8323C] text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded">
                  POPULAR
                </span>
                <p className="font-body text-sm font-bold text-[#0F0F0F]">Informe Pro</p>
                <p className="font-heading font-bold text-[32px] text-[#0F0F0F] mt-1">$4.990</p>
                <p className="font-body text-[11px] text-[#71717A] mt-1 mb-4">Todo lo gratis + análisis profundo</p>
                <div className="space-y-2.5 flex-1">
                  {[
                    "Todo lo gratuito",
                    "Flujo de caja 1-20 años",
                    "Proyección de patrimonio",
                    "Escenario de salida",
                    "Análisis IA personalizado",
                    "Veredicto con precio sugerido",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C8323C] mt-0.5 flex-shrink-0" />
                      <span className="font-body text-[11.5px] text-[#71717A]">{f}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={ctaHref}
                  className="block w-full bg-[#C8323C] text-white font-body text-[13px] font-bold py-2.5 rounded-lg mt-4 text-center hover:bg-[#b02a33] transition-colors"
                  style={{ boxShadow: "0 2px 12px rgba(200,50,60,0.2)" }}
                >
                  Desbloquear la verdad
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — TRUST */}
      {/* ============================================================ */}
      <section className="bg-[#FAFAF8] py-12">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <FadeIn>
            <p className="font-body text-sm font-semibold text-[#0F0F0F]">Solo datos. Cero comisiones.</p>
            <p className="font-body text-[13px] text-[#71717A] leading-relaxed mt-1.5 mb-5">
              Franco no vende propiedades. No trabaja para inmobiliarias. Analizamos datos públicos para que decidas mejor.
            </p>
          </FadeIn>

          {/* Sources */}
          <FadeIn delay={100}>
            <div className="flex justify-center gap-6">
              {[
                { abbr: "BC", name: "Banco Central" },
                { abbr: "SII", name: "SII" },
                { abbr: "CMF", name: "CMF" },
              ].map((src) => (
                <div key={src.abbr} className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-md bg-[#F0F0EC] flex items-center justify-center">
                    <span className="font-mono text-[8px] text-[#71717A] font-semibold">{src.abbr}</span>
                  </div>
                  <span className="font-body text-[11px] text-[#71717A]">{src.name}</span>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Double RE reading */}
          <FadeIn delay={200}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 max-w-[340px] mx-auto">
              <div className="bg-white border border-[#E6E6E2] rounded-lg p-4 text-center">
                <p className="font-mono text-[14px] font-bold text-[#C8323C]">RE</p>
                <p className="font-body text-[10px] text-[#71717A] mt-0.5">= Real Estate</p>
                <p className="font-body text-[10px] font-semibold text-[#0F0F0F] mt-0.5">Inmobiliario</p>
              </div>
              <div className="bg-white border border-[#E6E6E2] rounded-lg p-4 text-center">
                <p className="font-mono text-[14px] font-bold text-[#C8323C]">RE</p>
                <p className="font-body text-[10px] text-[#71717A] mt-0.5">= Re franco</p>
                <p className="font-body text-[10px] font-semibold text-[#0F0F0F] mt-0.5">Muy honesto</p>
              </div>
            </div>
          </FadeIn>

          {/* ChatGPT note */}
          <FadeIn delay={300}>
            <p className="mt-5 font-body text-xs text-[#71717A] italic">
              ¿Y ChatGPT? Inventa datos de arriendo y te da un resultado distinto cada vez. Franco usa datos reales y metodología consistente.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 7 — CTA FINAL */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden py-[72px] text-center"
        style={{ background: "linear-gradient(145deg, #0F0F0F 0%, #1C1917 60%, #292524 100%)" }}
      >
        {/* Red glow central */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,50,60,0.03), transparent 70%)" }}
        />

        <div className="relative z-10 px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-[32px] text-white tracking-tight">
              Antes de firmar, sé franco.
            </h2>
            <p className="font-body text-sm text-white/40 mt-2.5">
              Tu corredor gana si compras. Franco gana si decides bien.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <Link
              href={ctaHref}
              className="inline-block bg-[#C8323C] text-white font-body text-[15px] font-bold px-8 py-4 rounded-lg mt-6 hover:bg-[#b02a33] transition-colors"
              style={{ boxShadow: "0 4px 20px rgba(200,50,60,0.3)" }}
            >
              Analizar un departamento →
            </Link>
            <p className="font-body text-[11px] text-white/20 mt-2.5">
              Gratis. Sin registro. 30 segundos.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER */}
      {/* ============================================================ */}
      <footer className="bg-[#0F0F0F] py-9 px-6">
        <div className="max-w-[780px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            {/* Left */}
            <div>
              <FrancoLogo inverted size="sm" href="/" />
              <p className="font-mono text-[8px] text-white/25 uppercase tracking-[0.1em] mt-1">
                RE FRANCO CON TU INVERSIÓN
              </p>
            </div>

            {/* Right — 3 columns */}
            <div className="flex gap-9 flex-wrap">
              <div>
                <p className="font-body text-[9px] text-white/25 uppercase tracking-[0.1em] mb-2">Producto</p>
                <div className="space-y-1.5">
                  <Link href={ctaHref} className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Análisis gratis</Link>
                  <Link href="/pricing" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Informe Pro</Link>
                  <Link href="/dashboard" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Dashboard</Link>
                </div>
              </div>
              <div>
                <p className="font-body text-[9px] text-white/25 uppercase tracking-[0.1em] mb-2">Empresa</p>
                <div className="space-y-1.5">
                  <span className="block font-body text-[11px] text-white/45">Sobre Franco</span>
                  <span className="block font-body text-[11px] text-white/45">Blog</span>
                  <span className="block font-body text-[11px] text-white/45">Contacto</span>
                </div>
              </div>
              <div>
                <p className="font-body text-[9px] text-white/25 uppercase tracking-[0.1em] mb-2">Legal</p>
                <div className="space-y-1.5">
                  <span className="block font-body text-[11px] text-white/45">Términos</span>
                  <span className="block font-body text-[11px] text-white/45">Privacidad</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-white/[0.05] mt-6 pt-3.5">
            <p className="font-body text-[10px] text-white/[0.18]">
              © 2026 refranco.ai — No somos asesores financieros. Somos francos.
            </p>
            <p className="font-body text-[9px] text-white/10 mt-2">
              Franco es una herramienta informativa. Los resultados son estimaciones basadas en los datos ingresados y no constituyen asesoría financiera, tributaria ni legal.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
