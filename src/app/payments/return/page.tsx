"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { usePostHog } from "posthog-js/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const posthog = usePostHog();
  const type = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const order = searchParams.get("order");
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  // Estado puente: tras detectar paid de un single con análisis, mostramos
  // "abriendo tu análisis…" mientras se hace el push (evita flash de la pantalla
  // genérica antes de la navegación).
  const [redirecting, setRedirecting] = useState(false);
  // Guard para que el push al análisis ocurra UNA sola vez: el polling puede
  // re-ejecutar checkStatus en re-renders y no queremos re-push ni loop.
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (type === "subscription") {
      setPaymentStatus(statusParam === "success" ? "paid" : "error");
      return;
    }

    // Check payment status
    const checkStatus = async () => {
      try {
        // Con order → identifica la compra exacta. Sin order (fallback legacy o
        // compras viejas sin el param) → status cae al "último pago del user".
        const res = await fetch(order ? `/api/payments/status?order=${encodeURIComponent(order)}` : "/api/payments/status");
        const data = await res.json();
        if (data.payment) {
          setAnalysisId(data.payment.analysis_id);
          if (data.payment.status === "paid") {
            posthog?.capture('pro_purchased', { product: data.payment.product, amount: data.payment.amount });
            setPaymentStatus("paid");
            // Single con análisis atado → llevar directo a la vista del análisis
            // comprado (la ruta auto-redirige a renta-corta si es STR). El push
            // va DENTRO de la rama paid: nunca antes de la confirmación, para no
            // aterrizar en un análisis aún bloqueado. Otros productos (pack
            // suelto, sin analysis_id) caen a la pantalla genérica con CTA.
            //
            // AMBAS pre-pago: si el pago trae un STR companion en payment_data,
            // el analysis_id es el LTR → ruteamos a la comparativa con ambos ids.
            const companionStrId = (data.payment.payment_data as { companion_str_id?: string } | null)?.companion_str_id;
            if (
              !redirectedRef.current &&
              data.payment.product === "single" &&
              data.payment.analysis_id
            ) {
              redirectedRef.current = true;
              setRedirecting(true);
              if (companionStrId) {
                router.push(`/analisis/comparativa?ltr=${data.payment.analysis_id}&str=${companionStrId}`);
              } else {
                router.push(`/analisis/${data.payment.analysis_id}`);
              }
            }
          } else if (data.payment.status === "rejected" || data.payment.status === "cancelled") {
            setPaymentStatus("error");
          } else {
            setPaymentStatus("pending");
            // Retry after 3 seconds
            setTimeout(checkStatus, 3000);
          }
        } else {
          setPaymentStatus("pending");
          setTimeout(checkStatus, 3000);
        }
      } catch {
        setPaymentStatus("error");
      }
    };

    checkStatus();
  }, [type, statusParam, order, router]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)]">
      <UnifiedNav variant="marketing" />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
<div className="w-full max-w-md text-center">
        {paymentStatus === "loading" && (
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-8">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--franco-text)]/20 border-t-[#C8323C]" />
            <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Procesando tu pago...</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">Esto toma unos segundos.</p>
          </div>
        )}

        {paymentStatus === "pending" && (
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-8">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--franco-text)]/20 border-t-[#FBBF24]" />
            <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Confirmando pago...</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">Estamos esperando la confirmación. No cierres esta página.</p>
          </div>
        )}

        {redirecting && (
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-8">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--franco-text)]/20 border-t-[#C8323C]" />
            <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Pago confirmado</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">Abriendo tu análisis…</p>
          </div>
        )}

        {paymentStatus === "paid" && !redirecting && (
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-8">
            <div className="mx-auto mb-4 text-4xl">✓</div>
            <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">
              {type === "subscription" ? "Suscripción activada" : "Pago exitoso"}
            </h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
              {type === "subscription"
                ? "Tu suscripción Franco está activa. Análisis ilimitados."
                : "Tu análisis está desbloqueado."
              }
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {analysisId && (
                <Link
                  href={`/analisis/${analysisId}`}
                  className="w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90"
                >
                  Ver mi análisis →
                </Link>
              )}
              <Link
                href="/dashboard"
                className="w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] py-3 font-body text-sm font-medium text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]"
              >
                Ir al dashboard
              </Link>
            </div>
          </div>
        )}

        {paymentStatus === "error" && (
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-8">
            <div className="mx-auto mb-4 text-4xl">✕</div>
            <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Pago no procesado</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
              El pago fue rechazado o cancelado. No se realizó ningún cargo.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90"
              >
                Volver al dashboard
              </Link>
            </div>
          </div>
        )}

        <p className="mt-6 font-body text-[11px] text-[var(--franco-text-muted)]">
          Pagos procesados de forma segura por Flow.cl
        </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--franco-bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--franco-text)]/20 border-t-[#C8323C]" />
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}
