"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { PAGO_OTRA_CUENTA, PAGO_PACK_NO_PASO, RETORNO_SIN_SESION } from "@/lib/lo-que-sigue/copy";
import { leerRetornoPack } from "@/lib/lo-que-sigue/oferta-pack";
import { estadoDelPago, type LlavePago } from "@/lib/lo-que-sigue/retorno-pago";
import { DespuesDePagar } from "@/components/lo-que-sigue/DespuesDePagar";
import { HorizontePostPago } from "@/components/lo-que-sigue/HorizontePostPago";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { metaTrack } from "@/lib/meta/pixel";
import { GuiaBusqueda } from "@/components/guia/GuiaBusqueda";
import { hayGuia } from "@/lib/guia/activa";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const order = searchParams.get("order");
  // «Lo que sigue» (30-sep-2026): el pack vuelve con el informe de origen y su veredicto.
  const retornoPack = leerRetornoPack(searchParams);
  // La llave del pago (02-oct-2026): la firma que el servidor puso en la URL de retorno. Sin sesión deja
  // leer el estado de ESTE pago, el saldo y la guía; sin ella, la pantalla no sabe nada y pide entrar.
  const llavePago: LlavePago | null = retornoPack?.firma && order ? { order, firma: retornoPack.firma } : null;
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "paid" | "pending" | "error" | "sin_sesion" | "otra_cuenta">("loading");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  // El saldo real de la cuenta dueña del pago (`null` = no se sabe; la pantalla no inventa un número).
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conSesion, setConSesion] = useState(true);
  // Estado puente: tras detectar paid de un single con análisis, mostramos
  // "abriendo tu análisis…" mientras se hace el push (evita flash de la pantalla
  // genérica antes de la navegación).
  const [redirecting, setRedirecting] = useState(false);
  // Guard para que el push al análisis ocurra UNA sola vez: el polling puede
  // re-ejecutar checkStatus en re-renders y no queremos re-push ni loop.
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (type === "subscription") {
      const success = statusParam === "success";
      setPaymentStatus(success ? "paid" : "error");
      // Meta Pixel: Subscribe browser-side. event_id sub-<subscriptionId> → dedup con
      // el Subscribe server-side (payment-callback / cron reconciler, solo primer
      // cobro). sub/val vienen del redirect de register-callback.
      //
      // OJO con el `value`: acá es el PRECIO DE CATÁLOGO del plan, no el monto que
      // cobró Flow. No es un descuido — este evento se dispara en el ALTA, cuando
      // todavía no ocurrió ningún cargo, así que el monto real no existe aún. El
      // server manda el monto real cuando llega el primer cobro. Meta se queda con el
      // PRIMER evento que recibe para un event_id dado y el browser casi siempre gana
      // la carrera (el redirect es inmediato; el cargo llega después) → en la práctica
      // Meta registra el precio de catálogo. Hoy coinciden.
      //
      // REAPERTURA: si aparece prorrateo, cupón o descuento, el fix es que
      // register-callback deje de mandar `val` y el server quede como única fuente de
      // value — no que el browser intente adivinarlo. Ver la nota gemela allá.
      if (success) {
        const sub = searchParams.get("sub");
        const val = searchParams.get("val");
        if (sub) {
          const value = val ? Number(val) : undefined;
          metaTrack(
            "Subscribe",
            Number.isFinite(value) ? { value, currency: "CLP" } : undefined,
            `sub-${sub}`
          );
        }
      }
      return;
    }

    // Check payment status
    const checkStatus = async () => {
      try {
        // Con order → identifica la compra exacta. Sin order (fallback legacy o
        // compras viejas sin el param) → status cae al "último pago del user".
        const firma = llavePago ? `&t=${encodeURIComponent(llavePago.firma)}` : "";
        const res = await fetch(order ? `/api/payments/status?order=${encodeURIComponent(order)}${firma}` : "/api/payments/status");
        // «Lo que sigue» (28-sep-2026): el pack se paga desde el ticket SIN sesión (la cuenta se crea con
        // el correo). Flow vuelve acá sin sesión. Con la firma del pago (02-oct-2026) el servidor responde
        // igual; sin ella, 401: la pantalla no sabe si el pago pasó y pide entrar, sin afirmar nada.
        if (res.status === 401) {
          setPaymentStatus("sin_sesion");
          return;
        }
        const data = await res.json();
        // Con la sesión de OTRA cuenta (02-oct-2026): se dice, en vez de quedarse cargando.
        if (data.otraCuenta) {
          setPaymentStatus("otra_cuenta");
          return;
        }
        if (data.payment) {
          setAnalysisId(data.payment.analysis_id);
          setConSesion(!data.sinSesion);
          setSaldo(typeof data.saldo === "number" && !data.ilimitado ? data.saldo : null);
          const estado = estadoDelPago(data.payment.status);
          if (estado === "paid") {
            // `pro_purchased` se retiró (28-sep-2026): el pago se mide desde el servidor con
            // `pago_confirmado` (medicion-pago.ts), que no depende de que esta página lo vea.
            // Meta Pixel: Purchase browser-side. event_id = commerce_order → dedup
            // con el Purchase server-side (payments/confirm). El pago está
            // confirmado en ambos lados (status paid), así que ambos llevan value.
            if (data.payment.commerce_order) {
              metaTrack(
                'Purchase',
                { value: data.payment.amount, currency: 'CLP' },
                data.payment.commerce_order
              );
            }
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
            // Fase D unlock: analysis_id es el hijo que se abrió → volvemos ahí
            // (ya desbloqueado; la ruta auto-redirige a renta-corta si es STR).
            if (
              !redirectedRef.current &&
              data.payment.analysis_id &&
              (data.payment.product === "single" || data.payment.product === "unlock")
            ) {
              redirectedRef.current = true;
              setRedirecting(true);
              if (data.payment.product === "single" && companionStrId) {
                router.push(`/analisis/comparativa?ltr=${data.payment.analysis_id}&str=${companionStrId}`);
              } else if (data.payment.product === "unlock") {
                // Fase D (decisión B): el unlock desbloqueó los DOS informes →
                // volvemos a la comparativa. Resolvemos ltr/str por ambas_group_id
                // (fuente canónica: filas `analisis` por ambas_role). Fallback
                // EXACTO al hijo abierto si falta cualquier id (o falla la query).
                let target = `/analisis/${data.payment.analysis_id}`;
                try {
                  const supa = createClient();
                  const { data: child } = await supa
                    .from("analisis")
                    .select("ambas_group_id")
                    .eq("id", data.payment.analysis_id)
                    .maybeSingle();
                  const groupId = (child as { ambas_group_id?: string } | null)?.ambas_group_id;
                  if (groupId) {
                    const { data: rows } = await supa
                      .from("analisis")
                      .select("id, ambas_role")
                      .eq("ambas_group_id", groupId);
                    const ltrId = rows?.find((r) => r.ambas_role === "ltr")?.id;
                    const strId = rows?.find((r) => r.ambas_role === "str")?.id;
                    if (ltrId && strId) target = `/analisis/comparativa?ltr=${ltrId}&str=${strId}`;
                  }
                } catch {
                  /* fallback al hijo abierto (comportamiento previo) */
                }
                router.push(target);
              } else {
                router.push(`/analisis/${data.payment.analysis_id}`);
              }
            }
          } else if (estado === "error") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, statusParam, order, router, searchParams]);

  // Adónde vuelve quien entra con su correo: a esta misma pantalla si es el pack (verá su saldo y la guía);
  // si no, al dashboard.
  const volverAca = typeof window === "undefined" ? "/dashboard" : window.location.pathname + window.location.search;
  const nextEntrar = `/registro?next=${encodeURIComponent(retornoPack ? volverAca : "/dashboard")}`;
  async function entrarConOtroCorreo() {
    try { await createClient().auth.signOut(); } catch { /* sin sesión: igual a entrar */ }
    window.location.assign(`/registro?next=${encodeURIComponent(volverAca)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)]">
      <HeaderFranco />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
<div className={retornoPack ? "w-full max-w-5xl text-left" : "w-full max-w-md text-center"}>
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

        {/* Después de pagar el pack, UNA idea (01-oct-2026): donde hay guía (renta larga, el mismo predicado
            que la línea del ticket que la promete), «Tienes 3 análisis. Empieza por estos.» con la guía; si
            el informe no tiene guía, o en renta corta, «Tienes 3 análisis.» con el próximo análisis. */}
        {/* 02-oct-2026: solo con el pago VERIFICADO (con sesión, o sin ella con la firma), y con el saldo
            real. Sin sesión ni firma, la pantalla de entrar (abajo), sin «Tienes 3 análisis». */}
        {retornoPack && paymentStatus === "paid" && (
          hayGuia(retornoPack.modalidad) ? (
            <GuiaBusqueda
              analysisId={retornoPack.analysisId}
              veredicto={retornoPack.veredicto}
              conSesion={conSesion}
              saldo={saldo}
              pago={llavePago}
              sinGuia={<DespuesDePagar analysisId={retornoPack.analysisId} veredicto={retornoPack.veredicto} modalidad={retornoPack.modalidad} conSesion={conSesion} saldo={saldo} />}
            />
          ) : (
            <DespuesDePagar analysisId={retornoPack.analysisId} veredicto={retornoPack.veredicto} modalidad={retornoPack.modalidad} conSesion={conSesion} saldo={saldo} />
          )
        )}
        {/* «¿Cuándo piensas comprar?», discreto, debajo (02-oct-2026): con sesión o con la firma del pago. */}
        {retornoPack && paymentStatus === "paid" && (conSesion || llavePago) && (
          <HorizontePostPago ctx={{ analysisId: retornoPack.analysisId, veredicto: retornoPack.veredicto, modalidad: retornoPack.modalidad }} pago={llavePago} />
        )}

        {!retornoPack && paymentStatus === "paid" && !redirecting && (
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

        {paymentStatus === "sin_sesion" && (
          <div className="mx-auto max-w-md text-center" data-lqs="retorno-sin-sesion">
            <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)] mb-3">{RETORNO_SIN_SESION.titulo}</h1>
            <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-6">{RETORNO_SIN_SESION.cuerpo}</p>
            <EnlaceCarga href={nextEntrar} className="inline-flex items-center justify-center rounded-full bg-[var(--franco-text)] px-6 py-3 font-body text-sm font-semibold text-[var(--franco-bg)] no-underline">
              {RETORNO_SIN_SESION.boton}
            </EnlaceCarga>
          </div>
        )}
        {paymentStatus === "otra_cuenta" && (
          <div className="mx-auto max-w-md text-center" data-lqs="retorno-otra-cuenta">
            <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)] mb-3">{PAGO_OTRA_CUENTA.titulo}</h1>
            <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-6">{PAGO_OTRA_CUENTA.cuerpo}</p>
            <button type="button" onClick={entrarConOtroCorreo} className="inline-flex items-center justify-center rounded-full bg-[var(--franco-text)] px-6 py-3 font-body text-sm font-semibold text-[var(--franco-bg)]">
              {PAGO_OTRA_CUENTA.boton}
            </button>
          </div>
        )}
        {paymentStatus === "error" && retornoPack && (
          <div className="mx-auto max-w-md text-center" data-lqs="retorno-pack-no-paso">
            <h1 className="font-heading font-bold text-2xl text-[var(--franco-text)] mb-3">{PAGO_PACK_NO_PASO.titulo}</h1>
            <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-6">{PAGO_PACK_NO_PASO.cuerpo}</p>
            <EnlaceCarga href={retornoPack.modalidad === "str" ? `/analisis/renta-corta/${retornoPack.analysisId}` : `/analisis/${retornoPack.analysisId}`} className="inline-flex items-center justify-center rounded-full bg-[var(--franco-text)] px-6 py-3 font-body text-sm font-semibold text-[var(--franco-bg)] no-underline">
              {PAGO_PACK_NO_PASO.volver}
            </EnlaceCarga>
          </div>
        )}
        {paymentStatus === "error" && !retornoPack && (
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
