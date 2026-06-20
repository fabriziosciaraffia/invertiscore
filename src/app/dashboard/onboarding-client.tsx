"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRICING_PLANS, productKeyFor, fmtCLP } from "@/lib/pricing";
import { PROPERTIES_COUNT } from "@/lib/stats";

// Planes recurrentes que se siembran como información SECUNDARIA debajo del
// héroe ("cuando quieras más"). NO son la decisión de entrada — el primer
// análisis gratis es la acción default. Cada uno linkea a /checkout con la
// product key real del catálogo (FLOW_PRODUCTS), facturación mensual.
const SECONDARY_PLANS = PRICING_PLANS.filter((p) =>
  ["plan10", "plan50", "unlimited"].includes(p.id),
).map((p) => ({
  id: p.id,
  label: p.label,
  price: p.monthly ? `${fmtCLP(p.monthly)}/mes` : "",
  blurb: p.id === "unlimited" ? "Análisis ilimitados" : `${p.capacity} análisis al mes`,
  href: `/checkout?product=${productKeyFor(p.id, "monthly")}`,
}));

export function OnboardingClient() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  async function markOnboardingComplete() {
    try {
      await fetch("/api/user/complete-onboarding", { method: "POST" });
    } catch {
      // fail silently — no debe bloquear la navegación
    }
  }

  // Marca el onboarding como completado y navega. Un solo clic, sin selección.
  async function go(href: string) {
    if (navigating) return;
    setNavigating(true);
    await markOnboardingComplete();
    router.push(href);
  }

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <div className="mx-auto max-w-[640px] px-5 py-12 sm:py-16">
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
            { n: "2", title: "Franco analiza con datos reales", sub: `${PROPERTIES_COUNT} propiedades, 24 comunas, plusvalía histórica` },
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

        {/* Pills veredictos — vocabulario decorativo, no interactivo */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span
            className="font-mono font-semibold uppercase"
            style={{ fontSize: 11, background: "var(--franco-v-buy-bg)", color: "var(--franco-v-buy)", padding: "4px 12px", borderRadius: 20 }}
          >
            COMPRAR
          </span>
          <span
            className="font-mono font-semibold uppercase"
            style={{ fontSize: 11, background: "var(--franco-v-adjust-bg)", color: "var(--franco-v-adjust)", padding: "4px 12px", borderRadius: 20 }}
          >
            AJUSTA SUPUESTOS
          </span>
          <span
            className="font-mono font-semibold uppercase"
            style={{ fontSize: 11, background: "var(--franco-v-avoid-bg)", color: "var(--franco-v-avoid)", padding: "4px 12px", borderRadius: 20 }}
          >
            BUSCAR OTRA
          </span>
        </div>

        {/* ── CTA HÉROE: acción default única y dominante ── */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => go("/analisis/nuevo-v2")}
            disabled={navigating}
            className="font-body text-white disabled:opacity-60"
            style={{
              background: "var(--signal-red)",
              borderRadius: 10,
              padding: "16px 36px",
              fontSize: 16,
              fontWeight: 600,
              width: "100%",
              maxWidth: 420,
            }}
          >
            {navigating ? "Cargando..." : "Analiza tu primer departamento gratis →"}
          </button>
          <p className="font-mono uppercase text-[var(--franco-text-secondary)]" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
            Gratis · sin tarjeta · resultado en 30 segundos
          </p>
        </div>

        {/* Separador */}
        <div className="mt-12" style={{ borderTop: "0.5px solid var(--franco-border)" }} />

        {/* ── Planes: información SECUNDARIA (sembrar precio, no bloquear) ── */}
        <p className="mt-8 text-center font-mono uppercase text-[var(--franco-text-secondary)]" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          Cuando quieras más
        </p>
        <p className="mx-auto mt-2 max-w-[440px] text-center font-body text-[13px] leading-[1.5] text-[var(--franco-text-muted)]">
          Si analizas varios deptos, un plan baja el costo por análisis. Sin apuro — empieza con el gratis.
        </p>

        <div className="mt-5 flex flex-col gap-[10px]">
          {SECONDARY_PLANS.map((plan) => (
            <button
              type="button"
              key={plan.id}
              onClick={() => go(plan.href)}
              disabled={navigating}
              className="flex items-center justify-between gap-4 text-left transition-colors hover:border-[var(--franco-border-hover)] disabled:opacity-60"
              style={{
                background: "var(--franco-card)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "0.5px solid var(--franco-border)",
              }}
            >
              <div className="min-w-0">
                <div className="font-mono uppercase text-[var(--franco-text-secondary)]" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
                  {plan.label}
                </div>
                <div className="font-body text-[13px] text-[var(--franco-text-muted)]" style={{ marginTop: 2 }}>
                  {plan.blurb}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-heading font-bold text-[var(--franco-text)]" style={{ fontSize: 16 }}>
                  {plan.price}
                </div>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--signal-red)", marginTop: 2 }}>
                  Ver plan →
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => go("/pricing")}
            disabled={navigating}
            className="font-body text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] disabled:opacity-60"
            style={{ fontSize: 13 }}
          >
            Ver todos los planes en detalle →
          </button>
        </div>
      </div>
    </div>
  );
}
