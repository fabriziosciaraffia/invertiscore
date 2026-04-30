"use client";

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";
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
        <div key={i} className="border-b border-[var(--franco-border)]">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between py-4 text-left"
          >
            <span className="font-body text-[15px] font-semibold text-[var(--franco-text)] pr-4">{item.q}</span>
            <ChevronDown className={`h-4 w-4 text-[var(--franco-text-muted)] shrink-0 transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`} />
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: openIndex === i ? "200px" : "0", opacity: openIndex === i ? 1 : 0 }}
          >
            <p className="font-body text-sm text-[var(--franco-text-secondary)] leading-relaxed pb-4">{item.a}</p>
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
      <Check className="w-4 h-4 text-[var(--franco-positive)] mt-0.5 shrink-0" />
      <span className={`font-body text-sm ${bold ? "font-semibold text-[var(--franco-text)]" : "text-[var(--franco-text-secondary)]"}`}>{children}</span>
    </div>
  );
}

// ─── Tier model ─────────────────────────────────────
type BillingMode = "monthly" | "annual";

interface Tier {
  key: string;
  label: string;
  monthly: number | null; // null cuando es "gratis" (Demo)
  annual: number | null; // null cuando no aplica anual (Demo, Single)
  qty: string;
  perAnalysis: string | null;
  bullets: string[];
  cta: string;
  ctaHref: string;
  popular?: boolean;
  isDemo?: boolean;
}

const TIERS: Tier[] = [
  {
    key: "demo",
    label: "Demo",
    monthly: 0,
    annual: null,
    qty: "1 análisis (única vez)",
    perAnalysis: null,
    bullets: ["Misma experiencia Franco", "Sin tarjeta"],
    cta: "Empezar gratis",
    ctaHref: "/register",
    isDemo: true,
  },
  {
    key: "single",
    label: "Por análisis",
    monthly: 9990,
    annual: null,
    qty: "Sin vencimiento",
    perAnalysis: "$9.990",
    bullets: ["Misma experiencia Franco", "Sin vencimiento", "Pagás solo lo que usás"],
    cta: "Comprar",
    ctaHref: "/checkout?product=single",
  },
  {
    key: "plan10",
    label: "Plan 10",
    monthly: 49990,
    annual: 419900,
    qty: "10 análisis/mes",
    perAnalysis: "$4.999",
    bullets: ["Saldo acumulable hasta 12 meses", "Misma experiencia Franco", "Cancela cuando quieras"],
    cta: "Suscribirme",
    ctaHref: "/checkout?product=plan10",
    popular: true,
  },
  {
    key: "plan50",
    label: "Plan 50",
    monthly: 179990,
    annual: 1510900,
    qty: "50 análisis/mes",
    perAnalysis: "$3.599",
    bullets: ["Saldo acumulable hasta 12 meses", "Misma experiencia Franco", "Cancela cuando quieras"],
    cta: "Suscribirme",
    ctaHref: "/checkout?product=plan50",
  },
  {
    key: "plan100",
    label: "Plan 100",
    monthly: 279990,
    annual: 2351900,
    qty: "100 análisis/mes",
    perAnalysis: "$2.799",
    bullets: ["Saldo acumulable hasta 12 meses", "Misma experiencia Franco", "Cancela cuando quieras"],
    cta: "Suscribirme",
    ctaHref: "/checkout?product=plan100",
  },
  {
    key: "planPro",
    label: "Plan Pro",
    monthly: 499990,
    annual: 4199900,
    qty: "Análisis ilimitados",
    perAnalysis: null,
    bullets: ["Saldo acumulable hasta 12 meses", "Misma experiencia Franco", "Cancela cuando quieras"],
    cta: "Suscribirme",
    ctaHref: "/checkout?product=planPro",
  },
];

function fmtCLP(n: number): string {
  return "$" + n.toLocaleString("es-CL");
}

// ─── Tier card ──────────────────────────────────────
function TierCard({ tier, billing }: { tier: Tier; billing: BillingMode }) {
  const showAnnual = billing === "annual" && tier.annual !== null;
  const monthlyTimes12 = (tier.monthly ?? 0) * 12;

  // Plan 10 (POPULAR): border-left 1.5px Signal Red.
  const cardStyle = tier.popular
    ? { borderLeft: "1.5px solid var(--signal-red)", border: "0.5px solid var(--franco-border)" }
    : { border: "0.5px solid var(--franco-border)" };

  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{ ...cardStyle, background: "var(--franco-card)" }}
    >
      {tier.popular && (
        <p
          className="font-mono uppercase font-semibold m-0 mb-3"
          style={{
            fontSize: 9,
            letterSpacing: "0.06em",
            color: "var(--signal-red)",
          }}
        >
          ★ Popular
        </p>
      )}

      <p
        className="font-mono uppercase m-0 mb-1"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "var(--franco-text-secondary)",
        }}
      >
        {tier.label}
      </p>

      {!tier.isDemo && (
        <h3 className="font-heading font-bold text-[24px] text-[var(--franco-text)] m-0 mb-2 leading-tight">
          {tier.qty}
        </h3>
      )}
      {tier.isDemo && (
        <h3 className="font-heading font-bold text-[20px] text-[var(--franco-text)] m-0 mb-2 leading-tight">
          {tier.qty}
        </h3>
      )}

      {/* Precio */}
      <div className="mt-1 mb-3">
        {showAnnual ? (
          <>
            <p className="font-heading font-bold text-[28px] text-[var(--franco-text)] m-0 leading-none">
              {fmtCLP(tier.annual!)}
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-tertiary)] m-0 mt-1">
              al año · <span style={{ textDecoration: "line-through" }}>{fmtCLP(monthlyTimes12)}</span>
            </p>
            <p
              className="font-mono uppercase font-semibold m-0 mt-1"
              style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--signal-red)" }}
            >
              Ahorrás 30%
            </p>
          </>
        ) : tier.monthly === 0 ? (
          <p className="font-heading font-bold text-[28px] text-[var(--franco-text)] m-0 leading-none">
            $0
          </p>
        ) : tier.annual === null ? (
          <>
            <p className="font-heading font-bold text-[28px] text-[var(--franco-text)] m-0 leading-none">
              {fmtCLP(tier.monthly!)}
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-tertiary)] m-0 mt-1">
              c/u
            </p>
          </>
        ) : (
          <>
            <p className="font-heading font-bold text-[28px] text-[var(--franco-text)] m-0 leading-none">
              {fmtCLP(tier.monthly!)}
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-tertiary)] m-0 mt-1">
              /mes
            </p>
          </>
        )}
      </div>

      {tier.perAnalysis && (
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 mb-4">
          Por análisis: {tier.perAnalysis}
        </p>
      )}

      <div className="flex flex-col gap-2 flex-1 mb-5">
        {tier.bullets.map((b, i) => (
          <Feature key={i}>{b}</Feature>
        ))}
      </div>

      <Link
        href={tier.ctaHref}
        className="block w-full text-center font-mono uppercase font-semibold rounded-lg transition-colors"
        style={{
          background: "var(--signal-red)",
          color: "white",
          fontSize: 11,
          letterSpacing: "0.06em",
          padding: "12px 16px",
          minHeight: 44,
          lineHeight: "20px",
        }}
      >
        {tier.cta} →
      </Link>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────
export default function PricingPage() {
  const posthog = usePostHog();
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingMode>("monthly");
  useEffect(() => {
    posthog?.capture('pricing_viewed');
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
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <FadeIn>
            <h1 className="font-heading font-bold text-3xl md:text-[40px] text-[var(--franco-text)] tracking-tight leading-tight">
              Elegí cómo analizar
            </h1>
            <p className="font-body text-base md:text-lg text-[var(--franco-text-secondary)] mt-4 max-w-[560px] mx-auto leading-relaxed">
              Misma experiencia Franco en todos los planes. Solo cambia la cantidad.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Toggle Mensual/Anual */}
      <section className="px-4 mb-8">
        <FadeIn>
          <div
            className="mx-auto inline-flex rounded-lg overflow-hidden"
            style={{ border: "0.5px solid var(--franco-border)" }}
          >
            {(["monthly", "annual"] as const).map((m) => {
              const active = billing === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBilling(m)}
                  className="font-mono uppercase transition-colors"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    padding: "10px 18px",
                    background: active ? "var(--franco-text)" : "transparent",
                    color: active ? "var(--franco-bg)" : "var(--franco-text-secondary)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {m === "monthly" ? "Mensual" : "Anual · ahorrá 30%"}
                </button>
              );
            })}
          </div>
          <p className="block text-center mt-3 font-body text-[11px] text-[var(--franco-text-tertiary)]">
            {billing === "annual"
              ? "Pagás upfront una vez al año, sin sorpresas."
              : "Sin compromiso anual."}
          </p>
        </FadeIn>
      </section>

      {/* Tiers grid */}
      <section className="px-4 pb-20">
        <div className="max-w-[1020px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {TIERS.map((tier, i) => (
            <FadeIn key={tier.key} delay={i * 60} className="flex">
              <div className="w-full">
                <TierCard tier={tier} billing={billing} />
              </div>
            </FadeIn>
          ))}
        </div>
        <p className="text-center mt-8 font-body text-[12px] text-[var(--franco-text-tertiary)] max-w-[640px] mx-auto leading-relaxed">
          Sin features bloqueadas. Sin trucos. La diferencia entre planes es cantidad de análisis al mes — la experiencia Franco es la misma en todos.
        </p>
      </section>

      {/* ¿Para quién? */}
      <section className="bg-[var(--franco-card)] py-16 px-6" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
        <div className="max-w-[820px] mx-auto">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[var(--franco-text)] text-center mb-10">
              ¿Cómo elegir?
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-stretch">
            <FadeIn delay={0} className="flex">
              <div className="rounded-xl bg-[var(--franco-bg)] p-6 flex flex-col w-full" style={{ border: "0.5px solid var(--franco-border)" }}>
                <p className="font-mono uppercase mb-2 m-0" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--franco-text-secondary)", fontWeight: 600 }}>
                  Pagás por uso
                </p>
                <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed m-0">
                  Si analizás 1 depto al año, comprá créditos sueltos. No vencen.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={80} className="flex">
              <div className="rounded-xl bg-[var(--franco-bg)] p-6 flex flex-col w-full" style={{ borderLeft: "1.5px solid var(--signal-red)", border: "0.5px solid var(--franco-border)" }}>
                <p className="font-mono uppercase mb-2 m-0" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--signal-red)", fontWeight: 600 }}>
                  Suscripción
                </p>
                <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed m-0">
                  Si buscás activamente, suscribite. Saldo acumulable hasta 12 meses.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={160} className="flex">
              <div className="rounded-xl bg-[var(--franco-bg)] p-6 flex flex-col w-full" style={{ border: "0.5px solid var(--franco-border)" }}>
                <p className="font-mono uppercase mb-2 m-0" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--franco-text-secondary)", fontWeight: 600 }}>
                  Pro ilimitado
                </p>
                <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed m-0">
                  Para profesionales que evalúan portfolios completos sin límite.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
        <div className="max-w-[600px] mx-auto">
          <FadeIn>
            <h2 className="font-heading font-bold text-2xl md:text-[28px] text-[var(--franco-text)] text-center mb-10">
              Preguntas frecuentes
            </h2>
          </FadeIn>

          <FadeIn delay={100}>
            <FAQGroup items={[
              { q: "¿Puedo cambiar de plan?", a: "Sí, en cualquier momento. Tu saldo acumulable se mantiene." },
              { q: "¿Los créditos vencen?", a: "Pagás por uso (Por análisis) — no vencen nunca. En suscripciones, el saldo se acumula hasta 12 meses." },
              { q: "¿Qué pasa si no uso todo el mes?", a: "El saldo no consumido se acumula y queda disponible hasta 12 meses." },
              { q: "¿Puedo cancelar la suscripción?", a: "Sí, sin penalidad ni letra chica. Mantenés el saldo acumulado hasta usar todos los créditos." },
              { q: "¿Cuál es la diferencia entre planes?", a: "Solo cantidad. Misma experiencia Franco completa en todos: Score, IA, proyecciones, simulaciones, comparativas, exportación PDF." },
              { q: "¿Hay descuentos?", a: "Sí, 30% off pagando el plan anual upfront. Equivale a 3.6 meses gratis." },
            ]} />
          </FadeIn>
          <div className="text-center mt-8">
            <Link href="/faq" className="font-body text-xs text-[var(--signal-red)] hover:underline underline-offset-4 transition-colors">
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
        </div>
      </section>

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
