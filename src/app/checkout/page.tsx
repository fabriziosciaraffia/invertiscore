"use client";

import { useState, useEffect, Suspense } from "react";
import { usePostHog } from "posthog-js/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ArrowLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const PRODUCTS = {
  pro: {
    title: "Franco Pro",
    subtitle: "Análisis Premium",
    price: "$4.990",
    period: "Pago único",
    features: [
      "Análisis IA personalizado",
      "Proyecciones a 20 años",
      "Escenario de salida",
      "Veredicto con precio sugerido",
      "Ajusta el financiamiento",
    ],
    endpoint: "/api/payments/create",
    body: { product: "pro" },
  },
  pack3: {
    title: "Franco Pack 3×",
    subtitle: "Ahorra 33%",
    price: "$9.990",
    period: "Pago único — 3 análisis premium",
    features: [
      "3 análisis con IA incluidos",
      "Usa cuando quieras, no expiran",
      "Proyecciones a 20 años",
      "Escenario de salida",
      "Veredicto con precio sugerido",
    ],
    endpoint: "/api/payments/create",
    body: { product: "pack3" },
  },
  subscription: {
    title: "Franco Suscripción",
    subtitle: "Acceso ilimitado",
    price: "$19.990",
    period: "/mes — cancela cuando quieras",
    features: [
      "Análisis con IA ilimitados",
      "Ajusta TODAS las variables",
      "Historial completo de análisis",
      "Compara deptos lado a lado",
      "Alertas de nuevas propiedades",
      "Monitoreo de mercado",
      "Exportar informes en PDF",
    ],
    endpoint: "/api/subscriptions/create",
    body: {},
  },
} as const;

type ProductKey = keyof typeof PRODUCTS;

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--franco-bg)]">
        <p className="font-body text-sm text-[var(--franco-text-secondary)]">Cargando...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const productKey = (searchParams.get("product") || "pro") as ProductKey;
  const analysisId = searchParams.get("analysisId");

  const product = PRODUCTS[productKey] || PRODUCTS.pro;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const returnUrl = `/checkout?product=${productKey}${analysisId ? `&analysisId=${analysisId}` : ""}`;
        window.location.href = `/login?next=${encodeURIComponent(returnUrl)}`;
      } else {
        setAuthenticated(true);
      }
    });
  }, [productKey, analysisId]);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const body = { ...product.body } as Record<string, string>;
      if (analysisId && productKey !== "subscription") {
        body.analysisId = analysisId;
      }

      const res = await fetch(product.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        posthog?.capture('payment_initiated', { product: productKey, amount: product.price });
        window.location.href = data.url;
      } else {
        setError(data?.details || data?.error || "Error al procesar el pago");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--franco-bg)]">
        <p className="font-body text-sm text-[var(--franco-text-secondary)]">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" inverted href="/" />
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-[480px] mx-auto px-4 py-12 md:py-20">
        {/* Back link */}
        <Link href="/pricing" className="inline-flex items-center gap-1.5 font-body text-sm text-[var(--franco-text-muted)] hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Volver a planes
        </Link>

        {/* Title */}
        <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)] mb-8">
          Confirma tu compra
        </h1>

        {/* Product card */}
        <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 md:p-8">
          <div className="mb-6">
            <p className="font-body text-sm font-semibold text-[var(--franco-text)]">{product.title}</p>
            <p className="font-body text-xs text-[var(--franco-text-muted)] mt-0.5">{product.subtitle}</p>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-mono text-3xl font-bold text-[var(--franco-text)]">{product.price}</span>
          </div>
          <p className="font-body text-xs text-[var(--franco-text-muted)] mb-6">{product.period}</p>

          <div className="border-t border-[var(--franco-border)] pt-5 mb-6">
            <p className="font-body text-[11px] text-[var(--franco-text-muted)] uppercase tracking-wide font-semibold mb-3">Incluye</p>
            <div className="space-y-2.5">
              {product.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[var(--franco-positive)] mt-0.5 shrink-0" />
                  <span className="font-body text-sm text-[var(--franco-text-secondary)]">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-body text-sm text-[#C8323C] mb-4">{error}</p>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={loading}
            className="w-full font-body text-sm font-bold py-3.5 rounded-lg bg-[#C8323C] text-white hover:bg-[#b02a33] transition-colors min-h-[44px] disabled:opacity-50"
            style={{ boxShadow: "0 4px 16px rgba(200,50,60,0.3)" }}
          >
            {loading ? "Redirigiendo a Flow..." : "Continuar al pago →"}
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-4">
            <Shield className="h-3.5 w-3.5 text-[var(--franco-text-muted)]" />
            <p className="font-body text-[11px] text-[var(--franco-text-muted)]">
              Serás redirigido a Flow.cl para completar el pago de forma segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
