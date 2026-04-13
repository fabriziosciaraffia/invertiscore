"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X as XIcon } from "lucide-react";
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

  const ctaHref = "/analisis/nuevo";
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
            <a href="#como-funciona" className={`font-body text-sm transition-colors ${transparent ? "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]" : "text-[var(--franco-text-muted)] hover:text-[var(--franco-bg)]"}`}>
              Cómo funciona
            </a>
            <Link href="/comunas" className={`font-body text-sm transition-colors ${transparent ? "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]" : "text-[var(--franco-text-muted)] hover:text-[var(--franco-bg)]"}`}>
              Comunas
            </Link>
            <a href="#pricing" className={`font-body text-sm transition-colors ${transparent ? "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]" : "text-[var(--franco-text-muted)] hover:text-[var(--franco-bg)]"}`}>
              Precios
            </a>
            {user && (
              <Link href="/dashboard" className={`font-body text-sm transition-colors ${transparent ? "text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]" : "text-[var(--franco-text-muted)] hover:text-[var(--franco-bg)]"}`}>
                Dashboard
              </Link>
            )}
            <Link
              href={ctaHref}
              className="bg-[#C8323C] text-white font-body text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#b02a33] transition-colors min-h-[44px] flex items-center"
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
              ? <XIcon className={transparent ? "text-white" : "text-[var(--franco-bg)]"} size={22} />
              : <Menu className={transparent ? "text-white" : "text-[var(--franco-bg)]"} size={22} />
            }
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-[#E6E6E2] px-6 py-4 flex flex-col gap-1">
            <a href="#como-funciona" className="font-body text-base text-[var(--franco-text-muted)] py-2 min-h-[44px] flex items-center" onClick={() => setMobileMenu(false)}>Cómo funciona</a>
            <Link href="/comunas" className="font-body text-base text-[var(--franco-text-muted)] py-2 min-h-[44px] flex items-center" onClick={() => setMobileMenu(false)}>Comunas</Link>
            <a href="#pricing" className="font-body text-base text-[var(--franco-text-muted)] py-2 min-h-[44px] flex items-center" onClick={() => setMobileMenu(false)}>Precios</a>
            {user && <Link href="/dashboard" className="font-body text-base text-[var(--franco-text-muted)] py-2 min-h-[44px] flex items-center" onClick={() => setMobileMenu(false)}>Dashboard</Link>}
            <Link href={ctaHref} className="bg-[#C8323C] text-white font-body text-sm font-bold px-5 py-3 rounded-lg text-center min-h-[44px] mt-1" onClick={() => setMobileMenu(false)}>
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
        style={{ background: "var(--franco-bg)" }}
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

        <div className="max-w-[1100px] mx-auto px-6 py-[72px] pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-10 items-center">
            {/* Left column — text */}
            <div>
              <FadeIn>
                <h1 className="font-heading font-bold text-3xl md:text-[44px] text-white leading-[1.08] tracking-tight">
                  ¿Ese depto es buena inversión?
                </h1>
              </FadeIn>

              <FadeIn delay={100}>
                <p className="font-body text-lg md:text-xl text-[var(--franco-text-secondary)] mt-5 leading-relaxed max-w-[460px]">
                  Tu corredor dice que sí — él gana <span className="text-white/90 font-semibold">$3.5M si compras</span>. Franco te muestra los números reales. Gratis, en 30 segundos.
                </p>
              </FadeIn>

              <FadeIn delay={200}>
                <Link
                  href={ctaHref}
                  className="inline-block bg-[#C8323C] text-white font-body text-base font-bold px-8 py-4 rounded-lg mt-8 hover:bg-[#b02a33] transition-colors min-h-[48px]"
                  style={{ boxShadow: "0 4px 20px rgba(200,50,60,0.3)" }}
                >
                  Analizar un departamento →
                </Link>
                <p className="font-body text-sm md:text-base text-[var(--franco-text-muted)] mt-3">
                  Gratis. Sin tarjeta. Resultado en 30 segundos.
                </p>
              </FadeIn>

              {/* Stats bar */}
              <FadeIn delay={300}>
                <p className="font-body text-xs text-[var(--franco-text-muted)] mt-9 mb-3 uppercase tracking-wide">Con las condiciones actuales del mercado</p>
                <div className="grid grid-cols-3 border-t border-[var(--franco-border)] pt-5 gap-4">
                  <div className="md:border-r md:border-[var(--franco-border)] md:pr-5">
                    <p className="font-mono text-2xl md:text-3xl font-bold text-[#C8323C]">95%</p>
                    <p className="font-body text-xs md:text-sm text-[var(--franco-text-secondary)] mt-1">de los deptos en Santiago tienen flujo negativo</p>
                  </div>
                  <div className="md:border-r md:border-[var(--franco-border)] md:px-5">
                    <p className="font-mono text-2xl md:text-3xl font-bold text-[#C8323C]">-$200K</p>
                    <p className="font-body text-xs md:text-sm text-[var(--franco-text-secondary)] mt-1">flujo mensual promedio en Santiago</p>
                  </div>
                  <div className="md:pl-5">
                    <p className="font-mono text-2xl md:text-3xl font-bold text-[#C8323C]">Cero</p>
                    <p className="font-body text-xs md:text-sm text-[var(--franco-text-secondary)] mt-1">corredores te dicen esto antes de firmar</p>
                  </div>
                </div>
                <p className="font-body text-xs text-[var(--franco-text-muted)] text-center mt-3">
                  Basado en 20.000+ propiedades en 24 comunas · Santiago, 2026
                </p>
              </FadeIn>
            </div>

            {/* Right column — floating dark cards mockup */}
            <FadeIn delay={200} className="hidden lg:block">
              <div className="relative" style={{ perspective: "1400px", height: "560px" }}>

                {/* ── Card izquierda: Patrimonio ── */}
                <div
                  className="absolute top-4 -left-2 w-[220px] rounded-[14px] border border-[var(--franco-border)] p-4"
                  style={{ background: "#141414", opacity: 0.6, transform: "rotateY(7deg) translateZ(-50px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
                >
                  <p className="font-heading text-[9px] text-[var(--franco-text-secondary)] font-semibold mb-3">Proyección patrimonio — 10 años</p>
                  <svg viewBox="0 0 180 80" className="w-full mb-2">
                    {/* Stacked bars */}
                    {[12,20,28,38,50,60,72,82,92,100].map((h, i) => (
                      <g key={i}>
                        <rect x={i*18+2} y={80-h*0.7} width="12" height={h*0.25} rx="1" fill="var(--franco-bar-fill)" />
                        <rect x={i*18+2} y={80-h*0.7+h*0.25} width="12" height={h*0.2} rx="1" fill="var(--franco-bar-fill)" />
                        <rect x={i*18+2} y={80-h*0.7+h*0.45} width="12" height={h*0.25} rx="1" fill="var(--franco-bar-fill)" />
                      </g>
                    ))}
                    {/* Debt line */}
                    <polyline points="8,25 26,27 44,30 62,33 80,37 98,42 116,48 134,55 152,63 170,72" fill="none" stroke="#C8323C" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.7" />
                    {/* Patrimonio line */}
                    <polyline points="8,62 26,55 44,47 62,38 80,30 98,23 116,17 134,12 152,8 170,5" fill="none" stroke="var(--franco-text)" strokeWidth="1.5" opacity="0.8" />
                  </svg>
                  <p className="font-mono text-[9px] text-white/70">Patrimonio neto: <span className="text-white font-bold">$177M</span></p>
                </div>

                {/* ── Card principal: Score ── */}
                <div
                  className="absolute top-0 left-[100px] w-[280px] rounded-[18px] border border-[var(--franco-border)] p-5 z-10"
                  style={{ background: "#151515", transform: "translateZ(30px)", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}
                >
                  {/* Score + info */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="shrink-0 w-[72px]">
                      <p className="font-mono text-[6px] text-[var(--franco-text)]/35 uppercase tracking-[1.5px]">FRANCO SCORE</p>
                      <p className="font-mono text-[32px] font-bold text-[var(--franco-text)] leading-none">61</p>
                      <div className="relative mt-1 h-[4px] rounded-full overflow-hidden flex">
                        <div className="w-[40%] bg-[#C8323C]/15" />
                        <div className="w-[30%] bg-[var(--franco-border)]" />
                        <div className="w-[30%] bg-[#B0BEC5]/15" />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-[#FBBF24]" style={{ width: "61%" }} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-[13px] font-bold text-white truncate">Depto 3D2B Las Condes</p>
                      <p className="font-body text-[9px] text-[var(--franco-text-muted)] mt-0.5">78m² · UF 5.201 · Pie 20%</p>
                      <span className="inline-block mt-1.5 font-mono text-[8px] font-bold text-[#FBBF24] bg-[#FBBF24]/12 border border-[#FBBF24]/30 px-2 py-0.5 rounded">
                        AJUSTA EL PRECIO
                      </span>
                    </div>
                  </div>

                  {/* 3 metrics */}
                  <div className="flex gap-2 mb-3.5">
                    {[
                      { label: "FLUJO", value: "-$382K", color: "text-[#C8323C]" },
                      { label: "RENT.", value: "5.1%", color: "text-[var(--franco-text)]" },
                      { label: "RETORNO", value: "3.98x", color: "text-[var(--franco-text)]" },
                    ].map((m) => (
                      <div key={m.label} className="flex-1 bg-[var(--franco-card)] rounded-lg p-2 text-center">
                        <p className="font-body text-[7px] text-[var(--franco-text-muted)] uppercase tracking-wider">{m.label}</p>
                        <p className={`font-mono text-[13px] font-bold ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Siendo franco */}
                  <div className="border-l-2 border-[#C8323C] pl-2.5 mb-3.5">
                    <p className="font-body text-[9px] text-[var(--franco-text-secondary)] leading-relaxed">
                      <span className="font-semibold text-[var(--franco-text)]">Siendo franco:</span> este depto te cuesta $382K/mes. Negociable si consigues mejor precio.
                    </p>
                  </div>

                  {/* Dimension bars */}
                  <div className="flex gap-1.5 mb-3.5">
                    {[
                      { label: "Rent.", v: 75 },
                      { label: "Flujo", v: 38 },
                      { label: "Plusv.", v: 82 },
                      { label: "Riesgo", v: 55 },
                      { label: "Efic.", v: 34 },
                    ].map((d) => (
                      <div key={d.label} className="flex-1 text-center">
                        <div className="h-[32px] bg-[var(--franco-card)] rounded-sm overflow-hidden flex flex-col justify-end">
                          <div
                            className="rounded-t-sm"
                            style={{ height: `${d.v * 0.32}px`, background: d.v < 40 ? "#C8323C" : d.v < 70 ? "#FBBF24" : "#B0BEC5" }}
                          />
                        </div>
                        <p className="font-body text-[6px] text-[var(--franco-text-muted)] mt-1">{d.label}</p>
                        <p className={`font-mono text-[7px] font-medium ${d.v < 40 ? "text-[#C8323C]" : d.v < 70 ? "text-[#FBBF24]" : "text-[var(--franco-positive)]"}`}>{d.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Desglose bolsillo */}
                  <div className="border-t border-[var(--franco-border)] pt-3">
                    <p className="font-body text-[8px] text-[var(--franco-text-muted)] uppercase tracking-wider mb-2">¿Cuánto sale de tu bolsillo?</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Arriendo", value: "$917K", neg: false },
                        { label: "Dividendo", value: "-$885K", neg: true },
                        { label: "Gastos", value: "-$289K", neg: true },
                        { label: "Flujo", value: "-$257K", neg: true, highlight: true },
                      ].map((item) => (
                        <div key={item.label} className={`rounded-md p-1.5 text-center ${item.highlight ? "bg-[#C8323C]/10 border border-[#C8323C]/20" : "bg-[var(--franco-card)]"}`}>
                          <p className="font-body text-[6px] text-[var(--franco-text-muted)]">{item.label}</p>
                          <p className={`font-mono text-[9px] font-bold ${item.neg ? "text-[#C8323C]" : "text-[var(--franco-text)]"}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Card derecha: IA + Escenarios ── */}
                <div
                  className="absolute top-8 right-[-30px] w-[210px] rounded-[14px] border border-[var(--franco-border)] p-4"
                  style={{ background: "#141414", opacity: 0.65, transform: "rotateY(-7deg) translateZ(-40px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="font-mono text-[7px] font-bold text-[#C8323C] bg-[#C8323C]/15 px-1.5 py-0.5 rounded">IA</span>
                    <span className="font-body text-[9px] text-[var(--franco-text-secondary)] font-semibold">Análisis IA</span>
                  </div>
                  <p className="font-body text-[8px] text-[var(--franco-text-secondary)] leading-relaxed mb-3">
                    <span className="text-white/70 font-semibold">Siendo franco:</span> Excelente oportunidad. Negocia hasta UF 4.418 para mejorar el flujo...
                  </p>
                  <div className="border-t border-[var(--franco-border)] pt-2.5 mb-2">
                    <p className="font-body text-[7px] text-[var(--franco-text-muted)] uppercase tracking-wider mb-2">3 escenarios</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Pesimista", flujo: "-$445K", ret: "1.6x", bg: "bg-[#C8323C]/8" },
                        { label: "Base", flujo: "-$86K", ret: "4.5x", bg: "bg-[var(--franco-card)]" },
                        { label: "Optimista", flujo: "+$144K", ret: "7.3x", bg: "bg-[#B0BEC5]/8" },
                      ].map((s) => (
                        <div key={s.label} className={`flex justify-between items-center ${s.bg} rounded-md px-2 py-1`}>
                          <span className="font-body text-[7px] text-[var(--franco-text-muted)]">{s.label}</span>
                          <div className="flex gap-2">
                            <span className="font-mono text-[8px] text-[var(--franco-text-secondary)]">{s.flujo}</span>
                            <span className="font-mono text-[8px] font-bold text-[var(--franco-text)]">{s.ret}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-center mt-2">
                    <span className="font-mono text-[7px] font-bold text-[#FBBF24] bg-[#FBBF24]/12 border border-[#FBBF24]/25 px-2 py-0.5 rounded">AJUSTA EL PRECIO</span>
                  </div>
                </div>

                {/* ── Card inferior: Comparación zona ── */}
                <div
                  className="absolute bottom-0 left-[80px] w-[300px] rounded-[14px] border border-[var(--franco-border)] p-4"
                  style={{ background: "#141414", opacity: 0.5, transform: "rotateX(5deg) translateZ(-25px)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
                >
                  <p className="font-body text-[8px] text-[var(--franco-text-muted)] uppercase tracking-wider mb-2.5">Comparación con la zona</p>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-[7px] text-[var(--franco-text-muted)]">Precio/m²</span>
                        <span className="font-mono text-[8px] text-[var(--franco-text-secondary)]">$2.7M vs $2.9M</span>
                      </div>
                      <div className="flex gap-0.5">
                        <div className="h-[6px] rounded-full" style={{ width: "88%", background: "var(--franco-text-muted)" }} />
                        <div className="h-[6px] rounded-full flex-1" style={{ background: "var(--franco-border)" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-[7px] text-[var(--franco-text-muted)]">Arriendo</span>
                        <span className="font-mono text-[8px] text-[var(--franco-text-secondary)]">$917K vs $612K</span>
                      </div>
                      <div className="flex gap-0.5">
                        <div className="h-[6px] rounded-full" style={{ width: "100%", background: "var(--franco-text-muted)" }} />
                      </div>
                      <div className="mt-0.5 flex gap-0.5">
                        <div className="h-[6px] rounded-full" style={{ width: "67%", background: "var(--franco-border-strong)" }} />
                        <div className="flex-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Mobile: full cards stacked vertically */}
            <FadeIn delay={200} className="lg:hidden flex flex-col items-center gap-3 w-full">
              <p className="font-mono text-[8px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] text-center">Ejemplo de análisis</p>

              {/* Main card */}
              <div className="rounded-[18px] border border-[var(--franco-border)] p-5 w-[92%] max-w-[400px]" style={{ background: "#151515", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                {/* Score + info */}
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="shrink-0 w-[80px]">
                    <p className="font-mono text-[6px] text-[var(--franco-text)]/35 uppercase tracking-[1.5px]">FRANCO SCORE</p>
                    <p className="font-mono text-[36px] font-bold text-[var(--franco-text)] leading-none">61</p>
                    <div className="relative mt-1 h-[4px] rounded-full overflow-hidden flex">
                      <div className="w-[40%] bg-[#C8323C]/15" />
                      <div className="w-[30%] bg-[var(--franco-border)]" />
                      <div className="w-[30%] bg-[#B0BEC5]/15" />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-[#FBBF24]" style={{ width: "61%" }} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-[15px] font-bold text-white">Depto 3D2B Las Condes</p>
                    <p className="font-body text-[10px] text-[var(--franco-text-muted)] mt-0.5">78m² · UF 5.201 · Pie 20%</p>
                    <span className="inline-block mt-1.5 font-mono text-[9px] font-bold text-[#FBBF24] bg-[#FBBF24]/12 border border-[#FBBF24]/30 px-2 py-0.5 rounded">AJUSTA EL PRECIO</span>
                  </div>
                </div>

                {/* 3 metrics */}
                <div className="flex gap-2 mb-4">
                  {[
                    { label: "FLUJO", value: "-$382K", color: "text-[#C8323C]" },
                    { label: "RENT.", value: "5.1%", color: "text-[var(--franco-text)]" },
                    { label: "RETORNO", value: "3.98x", color: "text-[var(--franco-text)]" },
                  ].map((m) => (
                    <div key={m.label} className="flex-1 bg-[var(--franco-card)] rounded-lg p-2.5 text-center">
                      <p className="font-body text-[9px] text-[var(--franco-text-muted)] uppercase tracking-wider">{m.label}</p>
                      <p className={`font-mono text-base font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Siendo franco */}
                <div className="border-l-2 border-[#C8323C] pl-3 mb-4">
                  <p className="font-body text-xs text-[var(--franco-text-secondary)] leading-relaxed">
                    <span className="font-semibold text-[var(--franco-text)]">Siendo franco:</span> este depto te cuesta $382K/mes. Negociable si consigues mejor precio.
                  </p>
                </div>

                {/* Dimension bars */}
                <div className="flex gap-2 mb-4">
                  {[
                    { label: "Rent.", v: 75 },
                    { label: "Flujo", v: 38 },
                    { label: "Plusv.", v: 82 },
                    { label: "Riesgo", v: 55 },
                    { label: "Efic.", v: 34 },
                  ].map((d) => (
                    <div key={d.label} className="flex-1 text-center">
                      <div className="h-[36px] bg-[var(--franco-card)] rounded-sm overflow-hidden flex flex-col justify-end">
                        <div className="rounded-t-sm" style={{ height: `${d.v * 0.36}px`, background: d.v < 40 ? "#C8323C" : d.v < 70 ? "#FBBF24" : "#B0BEC5" }} />
                      </div>
                      <p className="font-body text-[7px] text-[var(--franco-text-muted)] mt-1">{d.label}</p>
                      <p className={`font-mono text-[8px] font-medium ${d.v < 40 ? "text-[#C8323C]" : d.v < 70 ? "text-[#FBBF24]" : "text-[var(--franco-positive)]"}`}>{d.v}</p>
                    </div>
                  ))}
                </div>

                {/* Desglose bolsillo */}
                <div className="border-t border-[var(--franco-border)] pt-3">
                  <p className="font-body text-[9px] text-[var(--franco-text-muted)] uppercase tracking-wider mb-2">¿Cuánto sale de tu bolsillo?</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Arriendo", value: "$917K", neg: false },
                      { label: "Dividendo", value: "-$885K", neg: true },
                      { label: "Gastos", value: "-$289K", neg: true },
                      { label: "Flujo", value: "-$257K", neg: true, highlight: true },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-md p-1.5 text-center ${item.highlight ? "bg-[#C8323C]/10 border border-[#C8323C]/20" : "bg-[var(--franco-card)]"}`}>
                        <p className="font-body text-[7px] text-[var(--franco-text-muted)]">{item.label}</p>
                        <p className={`font-mono text-[10px] font-bold ${item.neg ? "text-[#C8323C]" : "text-[var(--franco-text)]"}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* IA + Scenarios card */}
              <div className="rounded-[14px] border border-[var(--franco-border)] p-4 w-[92%] max-w-[400px]" style={{ background: "#141414", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="font-mono text-[8px] font-bold text-[#C8323C] bg-[#C8323C]/15 px-1.5 py-0.5 rounded">IA</span>
                  <span className="font-body text-[10px] text-[var(--franco-text-secondary)] font-semibold">Análisis IA</span>
                </div>
                <p className="font-body text-[10px] text-[var(--franco-text-secondary)] leading-relaxed mb-3">
                  <span className="text-white/70 font-semibold">Siendo franco:</span> Excelente oportunidad. Negocia hasta UF 4.418 para mejorar el flujo...
                </p>
                <div className="border-t border-[var(--franco-border)] pt-2.5">
                  <p className="font-body text-[8px] text-[var(--franco-text-muted)] uppercase tracking-wider mb-2">3 escenarios</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Pesimista", flujo: "-$445K", ret: "1.6x", bg: "bg-[#C8323C]/8" },
                      { label: "Base", flujo: "-$86K", ret: "4.5x", bg: "bg-[var(--franco-card)]" },
                      { label: "Optimista", flujo: "+$144K", ret: "7.3x", bg: "bg-[#B0BEC5]/8" },
                    ].map((s) => (
                      <div key={s.label} className={`flex justify-between items-center ${s.bg} rounded-md px-3 py-1.5`}>
                        <span className="font-body text-[9px] text-[var(--franco-text-muted)]">{s.label}</span>
                        <div className="flex gap-3">
                          <span className="font-mono text-[10px] text-[var(--franco-text-secondary)]">{s.flujo}</span>
                          <span className="font-mono text-[10px] font-bold text-[var(--franco-text)]">{s.ret}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Scroll indicator */}
          <div className="text-center mt-10">
            <p className="font-body text-sm md:text-base text-[var(--franco-text-muted)]">Descubre cómo funciona</p>
            <p className="font-body text-2xl md:text-3xl text-[var(--franco-text-muted)] mt-1 animate-bounce">↓</p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — CÓMO FUNCIONA */}
      {/* ============================================================ */}
      <section id="como-funciona" className="bg-white py-16">
        <div className="max-w-[800px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[var(--franco-bg)] text-center tracking-tight">
              Así de simple
            </h2>
            <p className="font-body text-base text-[var(--franco-text-muted)] text-center mt-2 mb-10">
              30 segundos. Un email y listo. Sin letra chica.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { emoji: "📝", num: "1", title: "Ingresa los datos", desc: <>Precio, arriendo, gastos. O pega el link de la publicación y Franco extrae todo.</> },
              { emoji: "⚡", num: "2", title: "Franco analiza", desc: <>Flujo real, rentabilidad neta, plusvalía y 8 métricas más. Con datos de mercado, no supuestos.</> },
              { emoji: "✓", num: "3", title: "Decide informado", desc: <>Score de 1-100 y un veredicto claro. Sin jerga.<span className="flex justify-center gap-1.5 mt-2.5"><span className="font-mono text-[10px] font-bold text-[var(--franco-positive)] bg-[#B0BEC5]/10 border border-[#B0BEC5]/30 px-2 py-1 rounded-md">COMPRAR</span><span className="font-mono text-[10px] font-bold text-[#FBBF24] bg-[#FBBF24]/10 border border-[#FBBF24]/30 px-2 py-1 rounded-md">AJUSTA EL PRECIO</span><span className="font-mono text-[10px] font-bold text-[#C8323C] bg-[#C8323C]/10 border border-[#C8323C]/30 px-2 py-1 rounded-md">BUSCAR OTRA</span></span></> },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 100} className="text-center">
                <p className="text-[28px] mb-3">{step.emoji}</p>
                <div className="w-8 h-8 rounded-full bg-[var(--franco-bg)] flex items-center justify-center mx-auto mb-2.5">
                  <span className="font-mono text-sm font-bold text-white">{step.num}</span>
                </div>
                <p className="font-body text-lg font-semibold text-[var(--franco-bg)] mb-1.5">{step.title}</p>
                <p className="font-body text-base text-[var(--franco-text-muted)] leading-snug">{step.desc}</p>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={300}>
            <div className="text-center mt-8">
              <Link
                href={ctaHref}
                className="inline-block bg-[var(--franco-bg)] text-white font-body text-sm font-semibold px-7 py-3.5 rounded-lg hover:bg-[#2A2A2A] transition-colors min-h-[44px]"
              >
                Probar con un depto real →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — DEMO */}
      {/* ============================================================ */}
      <section className="bg-[var(--franco-text)] py-16">
        <div className="max-w-[560px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[var(--franco-bg)] text-center tracking-tight">
              Mira un análisis real
            </h2>
            <p className="font-body text-base text-[var(--franco-text-muted)] text-center mt-2 mb-8">
              Depto 2D1B en Providencia. Sin filtros, sin maquillaje.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="bg-white rounded-2xl border border-[#E6E6E2] p-5 md:p-8 shadow-sm">
              {/* Score + Badge */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em]">Franco Score</p>
                  <p className="font-heading font-bold text-[42px] text-[var(--franco-bg)] leading-none">58</p>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#FBBF24] bg-[#FBBF24]/10 px-3 py-1.5 rounded-md tracking-wide mt-2">
                  AJUSTA EL PRECIO
                </span>
              </div>
              <p className="font-body text-sm text-[var(--franco-text-muted)] mt-1">Depto 2D1B · Providencia · 55m²</p>

              {/* 3 metrics */}
              <div className="grid grid-cols-3 gap-2 md:gap-3 mt-5">
                <div className="bg-[var(--franco-text)] rounded-[10px] p-2.5 md:p-3.5 text-center">
                  <p className="font-body text-[9px] md:text-[10px] text-[var(--franco-text-muted)] uppercase tracking-wide">Flujo mensual</p>
                  <p className="font-mono text-lg md:text-xl font-bold text-[#C8323C]">-$290K</p>
                </div>
                <div className="bg-[var(--franco-text)] rounded-[10px] p-2.5 md:p-3.5 text-center">
                  <p className="font-body text-[9px] md:text-[10px] text-[var(--franco-text-muted)] uppercase tracking-wide">Rent. neta</p>
                  <p className="font-mono text-lg md:text-xl font-bold text-[var(--franco-bg)]">2.3%</p>
                </div>
                <div className="bg-[var(--franco-text)] rounded-[10px] p-2.5 md:p-3.5 text-center">
                  <p className="font-body text-[9px] md:text-[10px] text-[var(--franco-text-muted)] uppercase tracking-wide">Retorno 10a</p>
                  <p className="font-mono text-lg md:text-xl font-bold text-[var(--franco-bg)]">3.21x</p>
                </div>
              </div>

              {/* Siendo franco box */}
              <div className="mt-5 p-3.5 bg-[#C8323C]/[0.03] rounded-[10px] border-l-[3px] border-[#C8323C]">
                <p className="font-body text-sm md:text-[15px] text-[var(--franco-bg)] leading-relaxed">
                  <strong>Siendo franco:</strong> este depto te cuesta $290K/mes de tu bolsillo. Con plusvalía de 4%, en 10 años tu patrimonio se multiplica 3.21x. Negociable si consigues mejor precio.
                </p>
              </div>

              {/* Link to demo */}
              <div className="text-center mt-6">
                <Link
                  href="/demo"
                  className="inline-block bg-[#C8323C] text-white font-body text-sm font-bold px-6 py-3 rounded-lg hover:bg-[#b02a33] transition-colors min-h-[44px]"
                >
                  Ver demo completo →
                </Link>
                <p className="font-body text-xs text-[var(--franco-text-muted)] mt-2">Registro gratis. Resultado en 30 segundos.</p>
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
        style={{ background: "var(--franco-bg)" }}
      >
        {/* Red glow bottom-left */}
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,50,60,0.03), transparent 70%)" }}
        />

        <div className="max-w-[800px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-white text-center">
              Tu corredor gana si compras.
            </h2>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[#C8323C] text-center mt-2">
              Franco gana si decides bien.
            </h2>
          </FadeIn>

          {/* Comparador */}
          <FadeIn delay={100}>
            <div className="flex flex-col md:flex-row gap-4 md:gap-5 mt-9 mb-8">
              {/* Card corredor */}
              <div className="flex-1 bg-[var(--franco-card)] border border-[var(--franco-border)] rounded-xl p-6 md:p-8">
                <p className="font-mono text-[10px] text-[var(--franco-text-secondary)] uppercase tracking-[0.1em] mb-3">TU CORREDOR TE MUESTRA</p>
                <p className="font-heading font-bold text-3xl md:text-5xl text-white/70">5.2%</p>
                <p className="font-body text-sm text-[var(--franco-text-secondary)] mt-1">Rentabilidad bruta</p>
                <p className="font-body text-sm text-white/35 italic mt-3">&ldquo;Excelente oportunidad&rdquo;</p>
              </div>

              {/* Card Franco */}
              <div className="flex-1 relative bg-[var(--franco-card)] border-2 border-[#C8323C] rounded-xl p-6 md:p-8" style={{ boxShadow: "0 0 30px rgba(200,50,60,0.06)" }}>
                <span className="absolute top-[-10px] right-3.5 bg-[#C8323C] text-white font-mono text-[9px] font-bold px-2.5 py-1 rounded">
                  LA VERDAD
                </span>
                <p className="font-mono text-[10px] text-[var(--franco-text)] uppercase tracking-[0.1em] font-semibold mb-3">FRANCO TE MUESTRA</p>
                <p className="font-heading font-bold text-3xl md:text-5xl text-[#C8323C]">2.3%</p>
                <p className="font-body text-sm text-white font-semibold mt-1">Rentabilidad neta real</p>
                <p className="font-body text-sm text-white/55 mt-3">-$290K/mes de tu bolsillo</p>
              </div>
            </div>
          </FadeIn>

          {/* Punchline */}
          <FadeIn delay={200}>
            <p className="font-body text-base text-[var(--franco-text-secondary)] text-center mb-8">
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
                <div className="bg-[var(--franco-card)] border border-[var(--franco-border)] rounded-[10px] p-4 md:p-5">
                  <p className="font-body text-base font-bold text-white mb-2">{card.title}</p>
                  <p className="font-body text-sm text-[var(--franco-text-secondary)] leading-relaxed">{card.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — TRUST */}
      {/* ============================================================ */}
      <section className="bg-[var(--franco-text)] py-12">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <FadeIn>
            <p className="font-body text-lg md:text-xl font-semibold text-[var(--franco-bg)]">Solo datos. Cero comisiones.</p>
            <p className="font-body text-base text-[var(--franco-text-muted)] leading-relaxed mt-2 mb-6">
              Franco no vende propiedades. No trabaja para inmobiliarias. Analizamos datos públicos para que decidas mejor.
            </p>
          </FadeIn>

          {/* Sources — real institutional logos */}
          <FadeIn delay={100}>
            <div className="flex justify-center items-center gap-6 md:gap-10 flex-wrap">
              {/* Datos de mercado */}
              <div className="flex flex-col items-center gap-2.5">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-50">
                  <rect x="2" y="2" width="32" height="32" rx="4" stroke="var(--franco-text-muted)" strokeWidth="1.5" fill="none" />
                  <rect x="8" y="18" width="4" height="10" rx="1" fill="var(--franco-text-muted)" />
                  <rect x="16" y="12" width="4" height="16" rx="1" fill="var(--franco-text-muted)" />
                  <rect x="24" y="8" width="4" height="20" rx="1" fill="var(--franco-text-muted)" />
                  <circle cx="10" cy="14" r="1.5" fill="var(--franco-text-muted)" />
                  <circle cx="18" cy="9" r="1.5" fill="var(--franco-text-muted)" />
                  <circle cx="26" cy="6" r="1.5" fill="var(--franco-text-muted)" />
                  <path d="M10 14 L18 9 L26 6" stroke="var(--franco-text-muted)" strokeWidth="1" />
                </svg>
                <span className="font-body text-xs text-[var(--franco-text-muted)]">Datos de mercado</span>
              </div>
              {/* Banco Central */}
              <div className="flex flex-col items-center gap-2.5">
                <Image src="/logos/banco-central.png" alt="Banco Central de Chile" width={36} height={36} className="h-9 w-9 opacity-40" />
                <span className="font-body text-xs text-[var(--franco-text-muted)]">Banco Central</span>
              </div>
              {/* SII */}
              <div className="flex flex-col items-center gap-2.5">
                <Image src="/logos/sii.jpg" alt="Servicio de Impuestos Internos" width={120} height={40} className="h-7 w-auto opacity-40 grayscale" />
                <span className="font-body text-xs text-[var(--franco-text-muted)]">Serv. Impuestos</span>
              </div>
              {/* CMF */}
              <div className="flex flex-col items-center gap-2.5">
                <Image src="/logos/cmf.svg" alt="Comisión para el Mercado Financiero" width={120} height={40} className="h-7 w-auto opacity-40 grayscale" />
                <span className="font-body text-xs text-[var(--franco-text-muted)]">Com. Mercado Fin.</span>
              </div>
            </div>
          </FadeIn>

          {/* ChatGPT note */}
          <FadeIn delay={200}>
            <p className="mt-6 font-body text-xs text-[var(--franco-text-muted)] italic">
              ¿Y las herramientas de IA genéricas? Inventan datos de arriendo y dan un resultado distinto cada vez. Franco usa datos reales del mercado chileno y metodología consistente.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — PRICING */}
      {/* ============================================================ */}
      <section id="pricing" className="bg-white py-16">
        <div className="max-w-[900px] mx-auto px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[var(--franco-bg)] text-center tracking-tight">
              Transparencia tiene precio. Menos del que piensas.
            </h2>
            <p className="font-body text-base text-[var(--franco-text-muted)] text-center mt-2 mb-10">
              Mejor información que la de tu corredor. Una fracción del costo.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
            {/* Gratis */}
            <FadeIn delay={0}>
              <div className="rounded-xl border border-[#E6E6E2] bg-white p-5 h-full flex flex-col">
                <p className="font-body text-sm font-bold text-[var(--franco-bg)]">Gratis</p>
                <p className="font-mono text-3xl font-bold text-[var(--franco-bg)] mt-1">$0</p>
                <p className="font-body text-sm text-[var(--franco-text-muted)] mt-1 mb-4">Score + métricas + comparación zona</p>
                <Link
                  href={ctaHref}
                  className="block w-full bg-[var(--franco-bg)] text-white font-body text-sm font-semibold py-3 rounded-lg text-center hover:bg-[#2A2A2A] transition-colors min-h-[44px] mt-auto"
                >
                  Empezar gratis →
                </Link>
              </div>
            </FadeIn>

            {/* Pro — highlighted */}
            <FadeIn delay={80}>
              <div className="relative rounded-xl border-2 border-[#C8323C] bg-white p-5 md:-mt-2 md:mb-[-8px] flex flex-col" style={{ boxShadow: "0 4px 24px rgba(200,50,60,0.07)" }}>
                <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-[#C8323C] text-white font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  Popular
                </span>
                <p className="font-body text-sm font-bold text-[var(--franco-bg)]">Informe Pro</p>
                <p className="font-mono text-3xl font-bold text-[var(--franco-bg)] mt-1">$4.990<span className="font-body text-sm font-normal text-[var(--franco-text-muted)]"> /análisis</span></p>
                <p className="font-body text-sm text-[var(--franco-text-muted)] mt-1">Todo gratis + análisis IA completo</p>
                <p className="font-body text-xs text-[#C8323C] font-semibold mt-1 mb-4">o 3 por $9.990</p>
                <Link
                  href="/pricing"
                  className="block w-full bg-[#C8323C] text-white font-body text-sm font-bold py-3 rounded-lg text-center hover:bg-[#b02a33] transition-colors min-h-[44px] mt-auto"
                  style={{ boxShadow: "0 2px 12px rgba(200,50,60,0.2)" }}
                >
                  Ver qué incluye →
                </Link>
              </div>
            </FadeIn>

            {/* Suscripción */}
            <FadeIn delay={160}>
              <div className="relative rounded-xl border border-[#E6E6E2] bg-white p-5 h-full flex flex-col">
                <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-[var(--franco-bg)] text-white font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  Mejor valor
                </span>
                <p className="font-body text-sm font-bold text-[var(--franco-bg)]">Suscripción</p>
                <p className="font-mono text-3xl font-bold text-[var(--franco-bg)] mt-1">$19.990<span className="font-body text-sm font-normal text-[var(--franco-text-muted)]"> /mes</span></p>
                <p className="font-body text-sm text-[var(--franco-text-muted)] mt-1 mb-4">Todo ilimitado + monitoreo + alertas</p>
                <Link
                  href="/pricing"
                  className="block w-full border-2 border-[var(--franco-bg)] text-[var(--franco-bg)] font-body text-sm font-bold py-3 rounded-lg text-center hover:bg-[var(--franco-bg)] hover:text-white transition-colors min-h-[44px] mt-auto"
                >
                  Ver qué incluye →
                </Link>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={200}>
            <div className="text-center mt-7">
              <Link href="/pricing" className="font-body text-sm font-semibold text-[#C8323C] hover:underline">
                Compara los planes en detalle →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 7 — CTA FINAL */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden py-[72px] text-center"
        style={{ background: "var(--franco-bg)" }}
      >
        {/* Red glow central */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,50,60,0.03), transparent 70%)" }}
        />

        <div className="relative z-10 px-6">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[32px] text-white tracking-tight">
              Antes de firmar, sé franco.
            </h2>
            <p className="font-body text-base md:text-lg text-[var(--franco-text-secondary)] mt-3">
              Tu corredor gana si compras. Franco gana si decides bien.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <Link
              href={ctaHref}
              className="inline-block bg-[#C8323C] text-white font-body text-base font-bold px-8 py-4 rounded-lg mt-6 hover:bg-[#b02a33] transition-colors min-h-[48px]"
              style={{ boxShadow: "0 4px 20px rgba(200,50,60,0.3)" }}
            >
              Antes de firmar, analiza gratis →
            </Link>
            <p className="font-body text-sm text-[var(--franco-text-muted)] mt-3">
              Gratis. Un email y listo. 30 segundos.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER */}
      {/* ============================================================ */}
      <footer className="bg-[var(--franco-bg)] py-9 px-6">
        <div className="max-w-[780px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            {/* Left */}
            <div>
              <FrancoLogo inverted size="header" href="/" />
              <p className="font-mono text-[8px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mt-1">
                RE FRANCO CON TU INVERSIÓN
              </p>
            </div>

            {/* Right — 3 columns */}
            <div className="flex gap-9 flex-wrap">
              <div>
                <p className="font-body text-[9px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-2">Producto</p>
                <div className="space-y-1.5">
                  <Link href={ctaHref} className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Análisis gratis</Link>
                  <Link href="/pricing" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Informe Pro</Link>
                  <Link href="/dashboard" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Dashboard</Link>
                </div>
              </div>
              <div>
                <p className="font-body text-[9px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-2">Empresa</p>
                <div className="space-y-1.5">
                  <Link href="/about" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Sobre Franco</Link>
                  <Link href="/aprende" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Aprende</Link>
                  <Link href="/faq" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Preguntas frecuentes</Link>
                  <Link href="/contact" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Contacto</Link>
                </div>
              </div>
              <div>
                <p className="font-body text-[9px] text-[var(--franco-text-muted)] uppercase tracking-[0.1em] mb-2">Legal</p>
                <div className="space-y-1.5">
                  <Link href="/terms" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Términos</Link>
                  <Link href="/privacy" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Privacidad</Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-[var(--franco-border)] mt-6 pt-3.5">
            <p className="font-body text-[10px] text-[var(--franco-text-muted)]">
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
