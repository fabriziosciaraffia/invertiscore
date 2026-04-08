"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanKey = "free" | "pro" | "pack3" | "subscription";

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
    key: "free",
    label: "GRATIS",
    price: "$0",
    desc: ["Análisis básico", "sin panel de ajustes"],
    ctaText: "Analizar mi primer departamento →",
  },
  {
    key: "pro",
    label: "PRO",
    price: "$4.990",
    desc: ["Análisis completo", "+ panel de ajustes"],
    popular: true,
    ctaText: "Comprar Pro y analizar →",
  },
  {
    key: "pack3",
    label: "PACK 3×",
    price: "$9.990",
    desc: ["3 análisis Pro", "al precio de 2"],
    ctaText: "Comprar Pack y analizar →",
  },
  {
    key: "subscription",
    label: "MENSUAL",
    price: "$19.990",
    priceSuffix: "/mes",
    desc: ["Análisis ilimitados", "+ todas las variables"],
    ctaText: "Suscribirme y analizar →",
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

    if (selected === "free") {
      router.push("/analisis/nuevo");
      return;
    }

    if (selected === "subscription") {
      try {
        const res = await fetch("/api/subscriptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } catch {
        // fall through
      }
      router.push("/checkout?product=subscription");
      return;
    }

    // pro / pack3 → /api/payments/create
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selected }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // fall through
    }
    router.push(`/checkout?product=${selected}`);
  }

  async function handleSecondary() {
    if (secondaryLoading) return;
    setSecondaryLoading(true);
    await markOnboardingComplete();
    router.push("/pricing");
  }

  const currentPlan = PLANS.find((p) => p.key === selected);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#FAFAF8]">
      <div className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center">
          <p className="font-body text-[13px] uppercase text-[#FAFAF8]/50" style={{ letterSpacing: "0.05em" }}>
            BIENVENIDO A
          </p>
          <div className="mt-3 flex items-baseline justify-center" style={{ fontSize: "28px" }}>
            <span
              className="font-heading"
              style={{ color: "rgba(255,255,255,0.32)", fontStyle: "italic", marginRight: "-0.08em", fontWeight: 400 }}
            >
              re
            </span>
            <span className="font-heading font-bold" style={{ color: "#FAFAF8" }}>
              franco
            </span>
            <span
              className="font-body font-semibold"
              style={{ color: "#C8323C", fontSize: "18px", marginLeft: "1px" }}
            >
              .ai
            </span>
          </div>
          <p className="mx-auto mt-5 max-w-[480px] font-body text-[15px] leading-[1.5] text-[#FAFAF8]/70">
            Analiza cualquier departamento en Santiago y descubre si es buena inversión — con datos reales, no intuición.
          </p>
        </div>

        {/* 3 pasos */}
        <div className="mx-auto mt-12 flex max-w-[480px] flex-col gap-[14px]">
          {[
            { n: "1", title: "Ingresa los datos del departamento", sub: "Precio, ubicación, superficie, dormitorios" },
            { n: "2", title: "Franco analiza con datos reales", sub: "20.000+ propiedades, 24 comunas, plusvalía histórica" },
            { n: "3", title: "Recibe un veredicto claro", sub: "COMPRAR · AJUSTA EL PRECIO · BUSCAR OTRA" },
          ].map((step) => (
            <div key={step.n} className="flex items-center gap-4">
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "rgba(200, 50, 60, 0.15)",
                }}
              >
                <span
                  className="font-mono"
                  style={{ fontSize: 14, fontWeight: 600, color: "#C8323C" }}
                >
                  {step.n}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-body text-[14px] font-medium text-[#FAFAF8]">{step.title}</div>
                <div className="font-body text-[12px] text-[#FAFAF8]/50">{step.sub}</div>
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
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
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
              background: "rgba(250,204,21,0.15)",
              color: "#facc15",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            AJUSTA EL PRECIO
          </span>
          <span
            className="font-mono font-semibold uppercase"
            style={{
              fontSize: 11,
              background: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            BUSCAR OTRA
          </span>
        </div>

        {/* Separador */}
        <div className="mt-10" style={{ borderTop: "0.5px solid rgba(250,250,248,0.08)" }} />

        {/* Pricing */}
        <p className="mt-8 text-center font-body text-[13px] text-[#FAFAF8]/50">
          Elige cómo analizar
        </p>

        <div className="mt-5 grid grid-cols-1 gap-[10px] sm:grid-cols-2 md:grid-cols-4">
          {PLANS.map((plan) => {
            const isSelected = selected === plan.key;
            const isPro = plan.popular;

            // Border priority: selected > popular > default
            let border: string;
            if (isSelected) {
              border = "1px solid rgba(200,50,60,0.6)";
            } else if (isPro) {
              border = "1px solid rgba(200,50,60,0.4)";
            } else {
              border = "0.5px solid rgba(250,250,248,0.08)";
            }

            return (
              <button
                type="button"
                key={plan.key}
                onClick={() => setSelected(plan.key)}
                className="relative text-center transition-all hover:border-[rgba(250,250,248,0.2)]"
                style={{
                  background: isSelected ? "#1F1F1F" : "#1A1A1A",
                  borderRadius: 10,
                  padding: "14px 12px",
                  border,
                  cursor: "pointer",
                }}
              >
                {isPro && (
                  <span
                    className="absolute font-mono font-semibold text-[#FAFAF8]"
                    style={{
                      top: -8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#C8323C",
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
                  style={{ fontSize: 11, color: isPro ? "#C8323C" : "rgba(250,250,248,0.5)" }}
                >
                  {plan.label}
                </div>
                <div
                  className="font-heading font-bold text-[#FAFAF8]"
                  style={{ fontSize: 20, marginTop: 4 }}
                >
                  {plan.price}
                  {plan.priceSuffix && (
                    <span
                      className="font-body"
                      style={{ fontSize: 12, color: "rgba(250,250,248,0.4)", fontWeight: 400 }}
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
                    color: "rgba(250,250,248,0.4)",
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
                className="font-body text-[#FAFAF8] disabled:opacity-60"
                style={{
                  background: "#C8323C",
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
            className="font-body text-[#FAFAF8]/40 hover:text-[#FAFAF8]/70 disabled:opacity-60"
            style={{ fontSize: 13 }}
          >
            {secondaryLoading ? "Cargando..." : "Ver todos los planes en detalle →"}
          </button>
        </div>
      </div>
    </div>
  );
}
