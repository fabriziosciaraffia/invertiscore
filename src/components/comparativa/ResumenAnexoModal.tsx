"use client";

import { useState, useEffect, useCallback } from "react";
import { usePostHog } from "posthog-js/react";
import type { ResumenAnexoData } from "@/lib/resumen-anexo";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { metaTrack } from "@/lib/meta/pixel";

const SIGNAL_RED = "#C8323C";

/**
 * Fase D — MODAL centrado con el resumen (Variante A) de un hijo BLOQUEADO de un
 * par AMBAS, sobre el comparativo. Diferenciado de los drawers laterales: el
 * drawer es profundidad del informe; el modal es CONTENIDO PREMIUM (lo que abrís
 * pagando). Se abre con "Ver análisis" en la mini-card del hijo; cerrar vuelve al
 * comparativo sin navegación.
 *
 * Desktop: diálogo centrado. Mobile: sheet casi-fullscreen (sube desde abajo).
 *
 * Dos variantes de CTA:
 *   - unlock (owner): cobra el desbloqueo del informe íntegro de AMBOS hijos.
 *   - adquisicion (tercero vía share): invita a analizar lo suyo (no puede comprar
 *     el unlock ajeno).
 */
export function ResumenAnexoModal({
  open,
  onClose,
  data,
  nombre,
  comuna,
  direccion,
  analysisId,
  ambasGroupId,
  ctaVariant,
  isLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  data: ResumenAnexoData | null;
  nombre: string;
  comuna: string;
  direccion?: string;
  analysisId: string;
  ambasGroupId: string;
  ctaVariant: "unlock" | "adquisicion";
  isLoggedIn: boolean;
}) {
  const posthog = usePostHog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cerrar con Esc + lock del scroll del body mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const handleUnlock = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    posthog?.capture("unlock_cta_click", { analysisId, modalidad: data?.modalidad });
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "unlock", analysisId, ambasGroupId }),
      });
      const json = await res.json();
      if (json.url) {
        // Meta Pixel: InitiateCheckout antes de redirigir a Flow (unlock AMBAS).
        // Browser-only, sin event_id (no requiere dedup con CAPI).
        metaTrack('InitiateCheckout', { value: FLOW_PRODUCTS.unlock.amount, currency: 'CLP' });
        window.location.href = json.url;
      } else {
        setError(json.error || "No se pudo iniciar el pago. Intenta de nuevo.");
        setLoading(false);
      }
    } catch {
      setError("No se pudo iniciar el pago. Intenta de nuevo.");
      setLoading(false);
    }
  }, [loading, posthog, analysisId, ambasGroupId, data]);

  if (!open || !data) return null;

  const modalidadLabel = data.modalidad === "LTR" ? "renta larga" : "renta corta";
  // A1 — título canon "Dirección corta · Comuna" (formatDireccionDisplay = calle+
  // número antes de la 1ª coma). Fallback al nombre si no hay dirección.
  const tituloPrincipal = formatDireccionDisplay(direccion) || nombre || "";

  // VerdictBadge — mismo tratamiento cromático que los heros (Capa 1).
  const v = data.veredicto;
  const badgeStyle =
    v === "COMPRAR"
      ? { background: "var(--franco-text)", color: "var(--franco-bg)" }
      : v === "AJUSTA SUPUESTOS"
        ? { background: "transparent", color: SIGNAL_RED, border: `0.5px solid color-mix(in srgb, ${SIGNAL_RED} 40%, transparent)` }
        : { background: SIGNAL_RED, color: "#fff" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Resumen de ${modalidadLabel}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — mobile: sheet apilado (sube desde abajo). Desktop: diálogo ANCHO
          (~1150px, ≤90vw) a 2 columnas (identidad | factores) → el contenido cabe
          vertical sin scroll interno. Espíritu del hero canon (veredicto | TOP-3).
          Scrollea solo si excede max-h (no ocurre en desktop normal). */}
      <div
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-xl sm:max-h-[90vh] sm:w-[90vw] sm:max-w-[1150px] sm:rounded-2xl"
      >
        {/* Header del modal: label anexo + contexto + cerrar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--franco-border)] px-5 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="shrink-0 rounded font-mono text-[9px] font-bold uppercase tracking-wide"
              style={{ padding: "3px 8px", background: "color-mix(in srgb, var(--franco-text) 10%, transparent)", color: "var(--franco-text)" }}
            >
              Anexo · {modalidadLabel}
            </span>
            <span className="truncate font-body text-[12px] text-[var(--franco-text-muted)]">
              Detalle de tu comparativa
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--franco-text-tertiary)] transition-colors hover:bg-[var(--franco-elevated)] hover:text-[var(--franco-text)]"
          >
            <span className="font-body text-[20px] leading-none">×</span>
          </button>
        </div>

        {/* Contenido — desktop en 2 columnas (identidad | factores) para que quepa
            vertical sin scroll; mobile apilado. Scrollea solo si excede el max-h. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Desktop: grid con placement explícito — identidad (full, fila 1),
              [score+gauge | factores] alineados (fila 2), KPIs full-width (fila 3).
              Mobile: mismo orden DOM apilado (identidad → score+gauge → KPIs → factores). */}
          <div className="sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
            {/* ── IDENTIDAD + SCORE + GAUGE · col 1, fila 1 (bloque izquierdo) ── */}
            <div className="sm:col-start-1 sm:row-start-1">
              <h2 className="font-serif text-[20px] font-bold leading-tight text-[var(--franco-text)]">
                {tituloPrincipal}
                {comuna && <span className="font-normal text-[var(--franco-text-secondary)]"> · {comuna}</span>}
              </h2>
              {data.specsSub && (
                <p className="mt-0.5 font-body text-[12px] text-[var(--franco-text-secondary)]">{data.specsSub}</p>
              )}
              {data.specsFin && (
                <p className="mt-1 font-mono text-[11px] text-[var(--franco-text-muted)]">{data.specsFin}</p>
              )}

              {/* Score + veredicto + gauge — mismo bloque izquierdo (llena la columna) */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                    Franco Score
                  </span>
                  <span className="font-mono text-[32px] font-bold leading-none text-[var(--franco-text)]">
                    {data.score ?? "—"}
                  </span>
                  <span className="font-mono text-[12px] text-[var(--franco-text-muted)]">/100</span>
                </div>
                <span
                  className="rounded font-mono text-[10px] font-bold uppercase tracking-[0.06em]"
                  style={{ padding: "4px 10px", ...badgeStyle }}
                >
                  {v}
                </span>
              </div>
              {typeof data.score === "number" && (
                <div className="mt-2">
                  <div
                    className="relative h-[6px] rounded-full"
                    style={{ background: "linear-gradient(90deg,#C8323C 0%,#C8323C 14%,#B9793E 46%,#6E6C66 74%,#4A4A46 100%)" }}
                  >
                    <span
                      className="absolute top-[-3px] h-[12px] w-[12px] -translate-x-1/2 rounded-full border-2"
                      style={{ left: `${Math.max(0, Math.min(100, data.score))}%`, background: "var(--franco-text)", borderColor: "var(--franco-card)" }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--franco-text-muted)]">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── KPIs · full-width (fila 2), 4 en fila en desktop, 2×2 en mobile ── */}
            {data.kpis.length > 0 && (
              <div className="mt-4 sm:mt-0 sm:col-span-2 sm:row-start-2">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {data.kpis.map((k) => (
                    <div key={k.label} className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-bg)] p-2">
                      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                        {k.label}
                      </span>
                      <p
                        className="mt-1 font-mono text-[18px] font-bold leading-none"
                        style={{ color: k.red ? SIGNAL_RED : "var(--franco-text)" }}
                      >
                        {k.value}
                      </p>
                      {k.sub && (
                        <span className="mt-1 block font-body text-[11px] leading-snug text-[var(--franco-text-muted)]">
                          {k.sub}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FACTORES · col 2, fila 1 (arriba, junto a la identidad) ── */}
          {/* Top-3 findings como LÍNEAS con cifra — tratamiento del mockup Variante A:
              header "LO QUE PESA · Los 3 factores decisivos", marcador 01/02/03,
              titular + número (color por dirección: adverso=Signal Red, a favor=Ink).
              Sub del KPI (M1) bajo el número. Cifras del mismo mapper del hero. */}
          {data.findings.length > 0 && (
            <div className="mt-5 sm:mt-0 sm:col-start-2 sm:row-start-1">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                  Lo que pesa
                </span>
                <span className="font-serif text-[15px] font-bold text-[var(--franco-text)]">
                  Los 3 factores decisivos
                </span>
              </div>
              {data.findings.map((f, i) => (
                // Mobile: apila — [ordinal + titular a ancho completo] arriba, [número
                // + contexto] debajo (indentado bajo el titular). Desktop: fila —
                // ordinal+titular a la izquierda (flex-1), número+sub a la derecha.
                // Sin anchos fijos que no colapsen (fix M5: no más columna-de-palabras
                // ni overlap del titular con el sub).
                <div
                  key={i}
                  className="flex flex-col gap-1.5 border-t border-[var(--franco-border)] py-2.5 first:border-t-0 sm:flex-row sm:items-start sm:gap-2.5"
                >
                  <div className="flex items-start gap-2.5 sm:min-w-0 sm:flex-1">
                    <span className="w-[18px] shrink-0 pt-[1px] font-mono text-[11px] text-[var(--franco-text-tertiary)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1 font-body text-[13px] leading-[1.35] text-[var(--franco-text)]">
                      {f.text}
                    </div>
                  </div>
                  {f.kpi && (
                    <div className="mt-1 pl-[28px] sm:mt-0 sm:shrink-0 sm:whitespace-nowrap sm:pl-0 sm:text-right">
                      <span
                        className="block whitespace-nowrap font-mono text-[14px] font-bold leading-none"
                        style={{ color: f.adverso ? SIGNAL_RED : "var(--franco-text)" }}
                      >
                        {f.kpi}
                      </span>
                      {f.kpiSub && (
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.04em] text-[var(--franco-text-muted)] sm:mt-1">
                          {f.kpiSub}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* CTA — bloque fijo al pie (shrink-0). Card dashed Signal Red (mockup) + disclaimer. */}
        <div className="shrink-0 border-t border-[var(--franco-border)] px-5 py-3 sm:px-6">
          <div
            className="rounded-xl p-3"
            style={{
              border: `1px dashed color-mix(in srgb, ${SIGNAL_RED} 45%, transparent)`,
              background: `color-mix(in srgb, ${SIGNAL_RED} 4.5%, transparent)`,
            }}
          >
          {ctaVariant === "unlock" ? (
            <>
              <h3 className="font-serif text-[16px] font-bold leading-tight text-[var(--franco-text)]">
                El comparativo decidió. El informe completo lo demuestra.
              </h3>
              <p className="mt-1.5 font-body text-[12.5px] leading-relaxed text-[var(--franco-text-secondary)]">
                Abre el análisis íntegro de renta larga y renta corta por separado: cada métrica, cada
                escenario, cada supuesto detrás del veredicto. Una vez, por los dos lados.
              </p>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={loading}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.03em] text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-5 sm:text-[12px] sm:tracking-[0.06em]"
                style={{ background: SIGNAL_RED }}
              >
                {loading ? "Abriendo pago…" : "Ver ambos informes completos — $4.990"}
              </button>
              <p className="mt-2 font-body text-[11px] text-[var(--franco-text-muted)]">
                Pago único · con boleta.
              </p>
              {error && (
                <p className="mt-2 font-body text-[12px]" style={{ color: SIGNAL_RED }}>
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-serif text-[16px] font-bold leading-tight text-[var(--franco-text)]">
                Este es el análisis de otra persona. Corre el tuyo.
              </h3>
              <p className="mt-1.5 font-body text-[12.5px] leading-relaxed text-[var(--franco-text-secondary)]">
                Analiza tu propio departamento y recibe el veredicto completo —renta larga, renta corta y
                cuál conviene.
              </p>
              <a
                href={isLoggedIn ? "/analisis/nuevo-v2" : "/register"}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.03em] text-white transition-opacity hover:opacity-90 sm:w-auto sm:px-5 sm:text-[12px] sm:tracking-[0.06em]"
                style={{ background: SIGNAL_RED }}
              >
                Analiza tu propiedad →
              </a>
            </>
          )}
          </div>
          <p className="mt-3 text-center font-body text-[10.5px] leading-snug text-[var(--franco-text-muted)]">
            Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
          </p>
        </div>
      </div>
    </div>
  );
}
