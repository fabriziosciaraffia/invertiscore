"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «¿Cuándo piensas comprar?» DESPUÉS DE PAGAR (02-oct-2026, decisión de Fabrizio). La pregunta vivía solo
// en «Estás dentro» (el registro del primer informe), y el comprador del pack nunca la veía: paga desde el
// ticket, sin pasar por ahí. Acá va discreta, debajo de la guía (o de «Tienes N análisis» donde no hay
// guía), con los mismos tres horizontes y el mismo destino: `perfiles_inversion.horizonte_compra` por
// POST /api/lo-que-sigue/perfil. Con sesión basta la sesión; sin ella, la firma del pago (`pago`).
// Opcional: no bloquea nada ni se repite si ya respondió en esta pantalla.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { ESTAS_DENTRO, type HorizonteCompra } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import type { LlavePago } from "@/lib/lo-que-sigue/retorno-pago";
import "../guia/guia.css";

export function HorizontePostPago({ ctx, pago }: { ctx: ContextoLqs; pago: LlavePago | null }) {
  const posthog = usePostHog();
  const [horizonte, setHorizonte] = useState<HorizonteCompra | null>(null);
  const [error, setError] = useState(false);

  async function elegir(h: HorizonteCompra) {
    setHorizonte(h);
    setError(false);
    capturarLqs(posthog, EVENTOS_LQS.horizonteElegido, ctx, { horizonte: h, donde: "post_pago" });
    try {
      const res = await fetch("/api/lo-que-sigue/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: ctx.analysisId, horizonte: h, ...(pago ? { order: pago.order, t: pago.firma } : {}) }),
      });
      setError(!res.ok);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="guia-cuando" data-lqs="horizonte-post-pago">
      <p className="guia-cuando-t">{ESTAS_DENTRO.cuando}</p>
      <div className="guia-cuando-op" role="radiogroup" aria-label={ESTAS_DENTRO.cuando}>
        {ESTAS_DENTRO.horizontes.map((h) => (
          <button
            key={h.id}
            type="button"
            role="radio"
            aria-checked={horizonte === h.id}
            className="guia-opcion"
            data-activa={horizonte === h.id ? "1" : "0"}
            onClick={() => elegir(h.id)}
          >
            {h.texto}
          </button>
        ))}
      </div>
      {error && <p className="guia-error" role="alert">{ESTAS_DENTRO.errorGuardar}</p>}
    </div>
  );
}
