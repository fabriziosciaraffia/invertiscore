"use client";

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import PricingPlans from "@/components/landing/PricingPlans";
import SavingsCalculator from "@/components/landing/SavingsCalculator";
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

// ─── FAQ (Phase 2.38 · lista simple, body siempre visible) ───
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Los créditos caducan?",
    a: "1 análisis: no caduca. Suscripciones: acumulables hasta 1 año, luego se resetea.",
  },
  {
    q: "¿Puedo cambiar de plan?",
    a: "Sí, en cualquier momento. Ajustes aplican al siguiente ciclo.",
  },
  {
    q: "¿Qué pasa si cancelo?",
    a: "Mantienes acceso hasta el fin del ciclo pagado.",
  },
  {
    q: "¿Aceptan factura?",
    a: "Sí, todos los planes incluyen factura electrónica.",
  },
  {
    q: "¿Hay descuento adicional por volumen?",
    a: "Sí, los planes mayores ya incluyen el descuento por volumen. Para casos especiales contacta soporte.",
  },
];

// ─── Page ───────────────────────────────────────────
export default function PricingPage() {
  const posthog = usePostHog();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    posthog?.capture("pricing_viewed");
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const ctaHref = user ? "/analisis/nuevo-v2" : "/register";

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Nav */}
      <AppNav
        variant="marketing"
        ctaSlot={
          user ? (
            <Link href="/dashboard" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
                Iniciar sesión
              </Link>
              <NavPrimaryCTA href="/register" label="Registrarse" />
            </div>
          )
        }
      />

      {/* Hero */}
      <section className="px-6 pt-16 pb-10 md:pt-20">
        <div className="mx-auto max-w-[900px] text-center">
          <FadeIn>
            <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--signal-red)]">
              Precios
            </p>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-[var(--franco-text)] md:text-[40px]">
              Mientras más uses, más ahorras.
            </h1>
            <p className="mx-auto mt-4 max-w-[560px] font-body text-base leading-relaxed text-[var(--franco-text-secondary)] md:text-lg">
              Mismo análisis, mismo veredicto. Lo único que cambia es cuánto pagas por cada uno.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Planes (4 cards + toggle · compartido con landing · bundle fuerte) */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-[1180px]">
          <FadeIn>
            <PricingPlans emphasis="strong" />
          </FadeIn>
        </div>
      </section>

      {/* Calculadora de ahorro */}
      <section className="px-6 pt-16 pb-20">
        <FadeIn>
          <SavingsCalculator />
        </FadeIn>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-20" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
        <div className="mx-auto max-w-[720px] pt-16">
          <FadeIn>
            <h2 className="mb-10 text-center font-heading text-2xl font-bold text-[var(--franco-text)] md:text-[28px]">
              Preguntas frecuentes
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="flex flex-col gap-4">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q}>
                  <p className="font-body text-[14px] font-semibold text-[var(--franco-text)]">
                    {item.q}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
          <div className="mt-8 text-center">
            <Link href="/faq" className="font-body text-xs text-[var(--signal-red)] underline-offset-4 transition-colors hover:underline">
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
        </div>
      </section>

      {/* Nota cobertura geográfica · al pie */}
      <p
        className="px-6 pb-16 text-center font-mono uppercase text-[var(--franco-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.08em" }}
      >
        Análisis disponible para Gran Santiago. Más zonas próximamente.
      </p>

      {/* Footer */}
      <AppFooter
        variant="rich"
        linksSlot={
          <div className="flex gap-9 flex-wrap">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-2">Producto</p>
              <div className="flex flex-col gap-1.5">
                <Link href={ctaHref} className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Análisis gratis</Link>
                <Link href="/pricing" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Informe Pro</Link>
                <Link href="/dashboard" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Dashboard</Link>
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-2">Empresa</p>
              <div className="flex flex-col gap-1.5">
                <Link href="/about" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Sobre Franco</Link>
                <Link href="/aprende" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Aprende</Link>
                <Link href="/contact" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Contacto</Link>
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-2">Legal</p>
              <div className="flex flex-col gap-1.5">
                <Link href="/terms" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Términos</Link>
                <Link href="/privacy" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Privacidad</Link>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
