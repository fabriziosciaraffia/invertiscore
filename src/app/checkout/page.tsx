"use client";

import { useState, useEffect, Suspense } from "react";
import { usePostHog } from "posthog-js/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ArrowLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";
import { fmtCLP, BASE_FEATURES } from "@/lib/pricing";

/** Resumen de display derivado del catálogo único FLOW_PRODUCTS. */
function resolveProduct(key: string) {
  const p = (FLOW_PRODUCTS as Record<string, (typeof FLOW_PRODUCTS)[FlowProductKey]>)[key];
  if (!p) return null;

  const oneTime = p.kind === "one_time";
  const period = oneTime
    ? "Pago único — créditos sin caducidad"
    : p.billing === "annual"
      ? "Facturación anual · renueva automáticamente"
      : "Facturación mensual · cancela cuando quieras";
  const subtitle = p.isUnlimited
    ? "Análisis ilimitados cada mes"
    : p.capacity === 1
      ? "1 análisis"
      : `${p.capacity} análisis al mes`;

  return {
    title: p.subject,
    subtitle,
    price: fmtCLP(p.amount),
    period,
    features: BASE_FEATURES,
    endpoint: oneTime ? "/api/payments/create" : "/api/subscriptions/create",
    oneTime,
  };
}

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
  const productKey = searchParams.get("product") || "single";
  const analysisId = searchParams.get("analysisId");

  const product = resolveProduct(productKey);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // Auth-gate único: sin sesión → a registro, preservando el product key
        // (y analysisId si vino) en ?next= para retomar la compra al volver.
        const returnUrl = `/checkout?product=${productKey}${analysisId ? `&analysisId=${analysisId}` : ""}`;
        window.location.href = `/register?next=${encodeURIComponent(returnUrl)}`;
      } else {
        setAuthenticated(true);
      }
    });
  }, [productKey, analysisId]);

  async function handlePay() {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = { product: productKey };
      // analysisId solo aplica al pago único (single): desbloquea ese análisis.
      if (analysisId && product.oneTime) {
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

  // Product key inválido (link viejo/corrupto) → estado claro, sin romper.
  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--franco-bg)]">
        <UnifiedNav variant="marketing" />
        <div className="max-w-[480px] mx-auto px-4 py-20 text-center">
          <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)] mb-3">
            Plan no encontrado
          </h1>
          <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-8">
            El plan que buscas no existe o ya no está disponible.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 font-body text-sm font-semibold text-[#C8323C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Ver planes disponibles
          </Link>
        </div>
      </div>
    );
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
      <UnifiedNav variant="marketing" />

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

          {/* Banner defensivo de cobertura. La mayoría llega acá tras pasar por
              el wizard (ya sabe que su zona está cubierta), pero algunos compran
              créditos primero — recordatorio antes de pagar. */}
          <div
            className="mb-4 rounded-lg px-3 py-2.5"
            style={{
              border: "0.5px solid var(--franco-border)",
              background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] leading-[1.5] text-[var(--franco-text-muted)] m-0">
              Análisis solo disponible para Gran Santiago. Verifica que tu propiedad está en zona cubierta antes de comprar.
            </p>
          </div>

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
