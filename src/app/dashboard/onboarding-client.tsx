"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanKey = "demo" | "plan10" | "planPro";

interface PlanConfig {
  key: PlanKey;
  label: string;
  price: string;
  priceSuffix?: string;
  desc: [string, string];
  popular?: boolean;
  ctaText: string;
}

const PLANS: PlanConfig[] = [
  {
    key: "demo",
    label: "DEMO",
    price: "$0",
    desc: ["1 análisis para probar", "sin tarjeta"],
    ctaText: "Analizar mi primer departamento →",
  },
  {
    key: "plan10",
    label: "PLAN 10",
    price: "$49.990",
    priceSuffix: "/mes",
    desc: ["10 análisis al mes", "para inversionistas activos"],
    popular: true,
    ctaText: "Ver más planes →",
  },
  {
    key: "planPro",
    label: "PLAN PRO",
    price: "$499.990",
    priceSuffix: "/mes",
    desc: ["Análisis ilimitados", "para profesionales"],
    ctaText: "Ver más planes →",
  },
];

export function OnboardingClient() {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);

  async function markOnboardingComplete() {
    try {
      await fetch("/api/user/complete-onboarding", { method: "POST" });
    } catch {
      // fail silently
    }
  }

  async function handlePrimaryCta() {
    if (!selected || loading) return;
    setLoading(true);
    await markOnboardingComplete();

    // demo → analizar directo. plan10/planPro → /pricing (backend de pagos
    // para los nuevos productos aún no existe; redirigir mantiene el flow
    // honesto hasta que se implementen).
    if (selected === "demo") {
      router.push("/analisis/nuevo-v2");
      return;
    }
    router.push("/pricing");
  }

  async function handleSecondary() {
    if (secondaryLoading) return;
    setSecondaryLoading(true);
    await markOnboardingComplete();
    router.push("/pricing");
  }

  const currentPlan = PLANS.find((p) => p.key === selected);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <div className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center">
          <p className="font-body text-[13px] uppercase text-[var(--franco-text-secondary)]" style={{ letterSpacing: "0.05em" }}>
            BIENVENIDO A
          </p>
          <div className="mt-3 flex items-baseline justify-center" style={{ fontSize: "28px" }}>
            <span
              className="font-heading"
              style={{ color: "var(--franco-wm-re)", fontStyle: "italic", marginRight: "-0.08em", fontWeight: 400 }}
            >
              re
            </span>
            <span className="font-heading font-bold" style={{ color: "var(--franco-wm-franco)" }}>
              franco
            </span>
            <span
              className="font-body font-medium"
              style={{ color: "var(--signal-red)", fontSize: "18px", marginLeft: "1px" }}
            >
              .ai
            </span>
          </div>
          <p className="mx-auto mt-5 max-w-[480px] font-body text-[15px] leading-[1.5] text-[var(--franco-text)]">
            Analiza cualquier departamento en Santiago y descubre si es buena inversión — con datos reales, no intuición.
          </p>
        </div>

        {/* 3 pasos */}
        <div className="mx-auto mt-12 flex max-w-[480px] flex-col gap-[14px]">
          {[
            { n: "1", title: "Ingresa los datos del departamento", sub: "Precio, ubicación, superficie, dormitorios" },
            { n: "2", title: "Franco analiza con datos reales", sub: "20.000+ propiedades, 24 comunas, plusvalía histórica" },
            { n: "3", title: "Recibe un veredicto claro", sub: "COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA" },
          ].map((step) => (
            <div key={step.n} className="flex items-center gap-4">
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "color-mix(in srgb, var(--signal-red) 15%, transparent)",
                }}
              >
                <span
                  className="font-mono"
                  style={{ fontSize: 14, fontWeight: 600, color: "var(--signal-red)" }}
                >
                  {step.n}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-body text-[14px] font-medium text-[var(--franco-text)]">{step.title}</div>
                <div className="font-body text-[12px] text-[var(--franco-text-secondary)]">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pills veredictos */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: 11,
              background: "var(--franco-v-buy-bg)",
              color: "var(--franco-v-buy)",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            COMPRAR
          </span>
          <span
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: 11,
              background: "var(--franco-v-adjust-bg)",
              color: "var(--franco-v-adjust)",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            AJUSTA SUPUESTOS
          </span>
          <span
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: 11,
              background: "var(--franco-v-avoid-bg)",
              color: "var(--franco-v-avoid)",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            BUSCAR OTRA
          </span>
        </div>

        {/* Separador */}
        <div className="mt-10" style={{ borderTop: "0.5px solid var(--franco-border)" }} />

        {/* Pricing */}
        <p className="mt-8 text-center font-body text-[13px] text-[var(--franco-text-secondary)]">
          Elige cómo analizar
        </p>

        <div className="mt-5 grid grid-cols-1 gap-[10px] sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isSelected = selected === plan.key;
            const isPro = plan.popular;

            // Border priority: selected > popular > default
            let border: string;
            if (isSelected) {
              border = "1px solid color-mix(in srgb, var(--signal-red) 60%, transparent)";
            } else if (isPro) {
              border = "1px solid color-mix(in srgb, var(--signal-red) 40%, transparent)";
            } else {
              border = "0.5px solid var(--franco-border)";
            }

            return (
              <button
                type="button"
                key={plan.key}
                onClick={() => setSelected(plan.key)}
                className="relative text-center transition-all hover:border-[var(--franco-border-hover)]"
                style={{
                  background: isSelected ? "var(--franco-elevated)" : "var(--franco-card)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  border,
                  cursor: "pointer",
                }}
              >
                {isPro && (
                  <span
                    className="absolute font-mono font-semibold text-white"
                    style={{
                      top: -8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--signal-red)",
                      padding: "2px 10px",
                      borderRadius: 10,
                      fontSize: 9,
                    }}
                  >
                    POPULAR
                  </span>
                )}
                <div
                  className="font-mono uppercase"
                  style={{ fontSize: 11, color: isPro ? "var(--signal-red)" : "var(--franco-text-secondary)" }}
                >
                  {plan.label}
                </div>
                <div
                  className="font-heading font-bold text-[var(--franco-text)]"
                  style={{ fontSize: 20, marginTop: 4 }}
                >
                  {plan.price}
                  {plan.priceSuffix && (
                    <span
                      className="font-body"
                      style={{ fontSize: 12, color: "var(--franco-text-muted)", fontWeight: 400 }}
                    >
                      {plan.priceSuffix}
                    </span>
                  )}
                </div>
                <div
                  className="font-body"
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    lineHeight: 1.4,
                    color: "var(--franco-text-muted)",
                  }}
                >
                  {plan.desc[0]}
                  <br />
                  {plan.desc[1]}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA principal — solo cuando hay plan seleccionado */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div
            className="flex min-h-[48px] items-center justify-center transition-opacity duration-300"
            style={{ opacity: currentPlan ? 1 : 0, pointerEvents: currentPlan ? "auto" : "none" }}
          >
            {currentPlan && (
              <button
                type="button"
                onClick={handlePrimaryCta}
                disabled={loading}
                className="font-body text-white disabled:opacity-60"
                style={{
                  background: "var(--signal-red)",
                  borderRadius: 8,
                  padding: "12px 32px",
                  fontSize: 15,
                  fontWeight: 500,
                  display: "inline-block",
                  width: "auto",
                }}
              >
                {loading ? "Cargando..." : currentPlan.ctaText}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSecondary}
            disabled={secondaryLoading}
            className="font-body text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] disabled:opacity-60"
            style={{ fontSize: 13 }}
          >
            {secondaryLoading ? "Cargando..." : "Ver todos los planes en detalle →"}
          </button>
        </div>
      </div>
    </div>
  );
}
