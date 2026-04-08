"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingClient() {
  const router = useRouter();
  const [loading, setLoading] = useState<"primary" | "secondary" | null>(null);

  async function handleCta(target: "/analisis/nuevo" | "/pricing", which: "primary" | "secondary") {
    if (loading) return;
    setLoading(which);
    try {
      await fetch("/api/user/complete-onboarding", { method: "POST" });
    } catch {
      // fail silently — user still gets redirected
    }
    router.push(target);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#FAFAF8]">
      <div className="mx-auto max-w-[640px] px-5 py-12 sm:py-16">
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
        <div className="mt-12 flex flex-col gap-[14px]">
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
                  background: "rgba(200,50,60,0.15)",
                }}
              >
                <span className="font-mono font-semibold text-[#C8323C]" style={{ fontSize: 14 }}>
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
        <div
          className="mt-10"
          style={{ borderTop: "0.5px solid rgba(250,250,248,0.08)" }}
        />

        {/* Pricing */}
        <p className="mt-8 text-center font-body text-[13px] text-[#FAFAF8]/50">
          Elige cómo analizar
        </p>

        <div className="mt-5 grid grid-cols-1 gap-[10px] sm:grid-cols-3">
          {/* Gratis */}
          <div
            className="text-center"
            style={{
              background: "#1A1A1A",
              borderRadius: 10,
              padding: "14px 12px",
              border: "0.5px solid rgba(250,250,248,0.08)",
            }}
          >
            <div className="font-mono uppercase text-[#FAFAF8]/50" style={{ fontSize: 11 }}>
              GRATIS
            </div>
            <div className="font-heading font-bold text-[#FAFAF8]" style={{ fontSize: 20, marginTop: 4 }}>
              $0
            </div>
            <div className="font-body text-[#FAFAF8]/40" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              Análisis básico
              <br />
              sin panel de ajustes
            </div>
          </div>

          {/* Pro destacada */}
          <div
            className="relative text-center"
            style={{
              background: "#1A1A1A",
              borderRadius: 10,
              padding: "14px 12px",
              border: "1px solid rgba(200,50,60,0.4)",
            }}
          >
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
            <div className="font-mono" style={{ fontSize: 11, color: "#C8323C" }}>
              PRO
            </div>
            <div className="font-heading font-bold text-[#FAFAF8]" style={{ fontSize: 20, marginTop: 4 }}>
              $4.990
            </div>
            <div className="font-body text-[#FAFAF8]/40" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              Análisis completo
              <br />
              + panel de ajustes
            </div>
          </div>

          {/* Pack */}
          <div
            className="text-center"
            style={{
              background: "#1A1A1A",
              borderRadius: 10,
              padding: "14px 12px",
              border: "0.5px solid rgba(250,250,248,0.08)",
            }}
          >
            <div className="font-mono uppercase text-[#FAFAF8]/50" style={{ fontSize: 11 }}>
              PACK 3×
            </div>
            <div className="font-heading font-bold text-[#FAFAF8]" style={{ fontSize: 20, marginTop: 4 }}>
              $9.990
            </div>
            <div className="font-body text-[#FAFAF8]/40" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              3 análisis Pro
              <br />
              al precio de 2
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => handleCta("/analisis/nuevo", "primary")}
            disabled={loading !== null}
            className="font-body text-[#FAFAF8] disabled:opacity-60"
            style={{
              background: "#C8323C",
              borderRadius: 8,
              padding: "12px 32px",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {loading === "primary" ? "Cargando..." : "Analizar mi primer departamento →"}
          </button>
          <button
            type="button"
            onClick={() => handleCta("/pricing", "secondary")}
            disabled={loading !== null}
            className="font-body text-[#FAFAF8]/40 hover:text-[#FAFAF8]/70 disabled:opacity-60"
            style={{ fontSize: 13 }}
          >
            Ver todos los planes en detalle →
          </button>
        </div>
      </div>
    </div>
  );
}
