"use client";

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { ForceDark } from "@/components/force-dark";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import type { User } from "@supabase/supabase-js";

// ─── FadeIn ─────────────────────────────────────────
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
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── FAQ Accordion (only one open at a time) ────────
function FAQGroup({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="border-b border-th-border-strong">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between py-4 text-left"
          >
            <span className="font-body text-[15px] font-semibold text-th-text pr-4">{item.q}</span>
            <ChevronDown className={`h-4 w-4 text-[#71717A] shrink-0 transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`} />
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: openIndex === i ? "200px" : "0", opacity: openIndex === i ? 1 : 0 }}
          >
            <p className="font-body text-sm text-white/50 leading-relaxed pb-4">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Feature row (dark mode) ────────────────────────
function Feature({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Check className="w-4 h-4 text-[#B0BEC5] mt-0.5 shrink-0" />
      <span className={`font-body text-sm ${bold ? "font-semibold text-th-text" : "text-white/60"}`}>{children}</span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────
export default function PricingPage() {
  const posthog = usePostHog();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    posthog?.capture('pricing_viewed');
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const ctaHref = user ? "/analisis/nuevo" : "/register";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0F0F0F 0%, #1A1A2E 40%, #0F0F0F 70%, #2A2A2A 100%)" }}>
      <ForceDark />
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-th-border-strong bg-th-page/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" inverted href="/" />
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="font-body text-sm text-white/50 hover:text-white/80 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="font-body text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-2">
                  Iniciar sesión
                </Link>
                <Link href="/register" className="bg-[#C8323C] text-white font-body text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#b02a33] transition-colors">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <FadeIn>
            <h1 className="font-heading font-bold text-2xl md:text-4xl text-th-text tracking-tight leading-tight">
              Transparencia tiene precio.<br className="hidden md:block" /> Menos del que piensas.
            </h1>
            <p className="font-body text-base md:text-lg text-white/50 mt-4 max-w-[520px] mx-auto">
              Mejor información que la de tu corredor. Una fracción del costo.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Pricing cards — same height grid */}
      <section className="px-4 pb-20">
        <div className="max-w-[1020px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:items-stretch">

          {/* ── GRATIS ── */}
          <FadeIn delay={0} className="flex">
            <div className="rounded-2xl border border-th-border-strong bg-th-card p-6 md:p-7 flex flex-col w-full">
              <p className="font-body text-sm font-semibold text-white/50">Gratis</p>
              <p className="font-body text-xs text-white/30 mt-0.5">Evalúa sin límites</p>

              <div className="mt-5 mb-6">
                <span className="font-mono text-4xl md:text-5xl font-bold text-th-text">$0</span>
                <p className="font-body text-xs text-white/30 mt-1">para siempre</p>
              </div>

              <div className="space-y-3 flex-1">
                <Feature>Análisis básicos ilimitados</Feature>
                <Feature>Franco Score + 8 métricas</Feature>
                <Feature>Comparación con tu zona</Feature>
                <Feature>Sensibilidad (3 escenarios)</Feature>
                <Feature>Datos de mercado reales</Feature>
              </div>

              <Link
                href={ctaHref}
                className="block w-full text-center font-body text-sm font-semibold py-3 rounded-lg mt-6 border border-white/20 text-th-text hover:bg-white/[0.06] transition-colors min-h-[44px]"
              >
                Empezar gratis →
              </Link>
              <p className="font-body text-[10px] text-white/25 text-center mt-2">Sin tarjeta. Sin límites.</p>
            </div>
          </FadeIn>

          {/* ── PRO ── (elevated) */}
          <FadeIn delay={100} className="flex">
            <div className="relative rounded-2xl border-2 border-[#C8323C] bg-th-surface p-6 md:p-7 md:-mt-4 md:pb-[calc(1.75rem+16px)] flex flex-col w-full" style={{ boxShadow: "0 8px 40px rgba(200,50,60,0.12)" }}>
              <span className="absolute top-[-12px] left-1/2 -translate-x-1/2 bg-[#C8323C] text-white font-mono text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Más elegido
              </span>

              <p className="font-body text-sm font-semibold text-th-text">Informe Pro</p>
              <p className="font-body text-xs text-white/30 mt-0.5">La verdad completa</p>

              <div className="mt-5 mb-1">
                <span className="font-mono text-4xl md:text-5xl font-bold text-th-text">$4.990</span>
                <p className="font-body text-xs text-white/30 mt-1">por análisis</p>
              </div>
              <Link
                href="/checkout?product=pack3"
                className="font-body text-xs text-[#C8323C] font-semibold hover:underline text-left mb-5 block"
              >
                o 3 por $9.990 (ahorra 33%) →
              </Link>

              <div className="space-y-3 flex-1">
                <p className="font-body text-[11px] text-white/30 uppercase tracking-wide font-semibold">Todo lo gratis, más:</p>
                <Feature bold>Análisis IA personalizado</Feature>
                <Feature bold>Proyecciones a 20 años</Feature>
                <Feature bold>Escenario de salida</Feature>
                <Feature bold>Veredicto con precio sugerido</Feature>
                <Feature bold>Ajusta el financiamiento</Feature>
              </div>

              <Link
                href="/checkout?product=pro"
                onClick={() => { posthog?.capture('pro_cta_clicked', { source: 'pricing' }); }}
                className="block w-full text-center font-body text-sm font-bold py-3.5 rounded-lg mt-6 bg-[#C8323C] text-white hover:bg-[#b02a33] transition-colors min-h-[44px]"
                style={{ boxShadow: "0 4px 16px rgba(200,50,60,0.3)" }}
              >
                Desbloquear la verdad →
              </Link>
            </div>
          </FadeIn>

          {/* ── SUSCRIPCIÓN ── */}
          <FadeIn delay={200} className="flex">
            <div className="relative rounded-2xl border border-th-border-strong bg-th-card p-6 md:p-7 flex flex-col w-full">
              <span className="absolute top-[-12px] left-1/2 -translate-x-1/2 bg-[#FAFAF8] text-[#0F0F0F] font-mono text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Mejor valor
              </span>

              <p className="font-body text-sm font-semibold text-th-text">Suscripción</p>
              <p className="font-body text-xs text-white/30 mt-0.5">Tu herramienta de inversión</p>

              <div className="mt-5 mb-6">
                <span className="font-mono text-4xl md:text-5xl font-bold text-th-text">$19.990</span>
                <p className="font-body text-xs text-white/30 mt-1">/mes</p>
              </div>

              <div className="space-y-3 flex-1">
                <p className="font-body text-[11px] text-white/30 uppercase tracking-wide font-semibold">Todo lo Pro, más:</p>
                <Feature bold>Análisis con IA ilimitados</Feature>
                <Feature bold>Ajusta TODAS las variables</Feature>
                <Feature>Historial completo de análisis</Feature>
                <Feature>Compara deptos lado a lado</Feature>
                <Feature>Alertas de nuevas propiedades</Feature>
                <Feature>Monitoreo de mercado</Feature>
                <Feature>Exportar informes en PDF</Feature>
              </div>

              <Link
                href="/checkout?product=subscription"
                onClick={() => { posthog?.capture('pro_cta_clicked', { source: 'pricing' }); }}
                className="block w-full text-center font-body text-sm font-bold py-3 rounded-lg mt-6 border-2 border-[#C8323C] text-[#C8323C] hover:bg-[#C8323C] hover:text-white transition-colors min-h-[44px]"
              >
                Suscribirme →
              </Link>
              <p className="font-body text-[10px] text-white/25 text-center mt-2">Cancela cuando quieras</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ¿Para quién? */}
      <section className="bg-white/[0.02] border-t border-th-border py-16 px-6">
        <div className="max-w-[820px] mx-auto">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-th-text text-center mb-10">
              ¿Para quién es cada plan?
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-stretch">
            <FadeIn delay={0} className="flex">
              <div className="rounded-xl bg-th-input-bg border border-white/[0.1] p-6 flex flex-col w-full">
                <p className="font-mono text-xs font-bold text-white/50 uppercase tracking-wide mb-2">Gratis</p>
                <p className="font-body text-[15px] text-white/60 leading-relaxed">
                  Estás empezando a evaluar inversiones y quieres entender los números antes de hablar con cualquier corredor.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={80} className="flex">
              <div className="rounded-xl bg-[#C8323C]/[0.06] border border-[#C8323C]/25 p-6 flex flex-col w-full">
                <p className="font-mono text-xs font-bold text-[#C8323C] uppercase tracking-wide mb-2">Pro</p>
                <p className="font-body text-[15px] text-white/60 leading-relaxed">
                  Tienes un depto en la mira y necesitas saber la verdad completa antes de firmar.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={160} className="flex">
              <div className="rounded-xl bg-th-input-bg border border-white/[0.1] p-6 flex flex-col w-full">
                <p className="font-mono text-xs font-bold text-th-text uppercase tracking-wide mb-2">Suscripción</p>
                <p className="font-body text-[15px] text-white/60 leading-relaxed">
                  Inviertes activamente y necesitas una herramienta profesional para evaluar múltiples propiedades.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
        <p className="text-[11px] text-[#71717A] text-center mt-8 max-w-md mx-auto leading-relaxed font-body">
          Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión. Consulta con un profesional antes de decidir.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-th-border bg-black/20 py-16 px-6">
        <div className="max-w-[600px] mx-auto">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-th-text text-center mb-10">
              Preguntas frecuentes
            </h2>
          </FadeIn>

          <FadeIn delay={100}>
            <FAQGroup items={[
              { q: "¿Franco es asesor financiero?", a: "No. Franco es una herramienta de análisis. La información es referencial y no constituye recomendación de inversión." },
              { q: "¿De dónde vienen los datos?", a: "Usamos fuentes públicas e información de mercado actualizada semanalmente. Tasas del Banco Central, datos del SII, y precios de mercado reales." },
              { q: "¿Puedo cancelar la suscripción?", a: "Sí, en cualquier momento. Sin contratos, sin letra chica." },
              { q: "¿Qué incluye el análisis IA?", a: "Un análisis personalizado generado por inteligencia artificial que evalúa tu inversión considerando contexto de mercado, proyecciones, y escenarios de salida." },
              { q: "¿Los créditos del pack expiran?", a: "No. Úsalos cuando los necesites." },
              { q: "¿Qué métodos de pago aceptan?", a: "Tarjeta de crédito, débito y transferencia bancaria a través de Flow.cl." },
            ]} />
          </FadeIn>
          <div className="text-center mt-8">
            <Link href="/faq" className="font-body text-xs text-[#C8323C] hover:underline underline-offset-4 transition-colors">
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-th-border bg-th-page py-9 px-6">
        <div className="max-w-[780px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <FrancoLogo inverted size="header" href="/" />
              <p className="font-mono text-[8px] text-white/25 uppercase tracking-[0.1em] mt-1">
                RE FRANCO CON TU INVERSIÓN
              </p>
            </div>
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
                  <Link href="/about" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Sobre Franco</Link>
                  <Link href="/aprende" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Aprende</Link>
                  <Link href="/contact" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Contacto</Link>
                </div>
              </div>
              <div>
                <p className="font-body text-[9px] text-white/25 uppercase tracking-[0.1em] mb-2">Legal</p>
                <div className="space-y-1.5">
                  <Link href="/terms" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Términos</Link>
                  <Link href="/privacy" className="block font-body text-[11px] text-white/45 hover:text-white/70 transition-colors">Privacidad</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.05] mt-6 pt-3.5">
            <p className="font-body text-[10px] text-white/[0.18]">
              © 2026 refranco.ai — No somos asesores financieros. Somos francos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
