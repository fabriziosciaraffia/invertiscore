"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";

/**
 * Banner de viabilidad STR (Commit 4 · 2026-05-12).
 *
 * Aparece SOLO cuando la zona no tracciona STR (tierZona = "baja") o la
 * recomendación del motor es LTR_PREFERIDO. Coherente con doctrina Franco:
 * decir cuando STR no conviene, sin endulzar.
 *
 * Diseño (per franco-design-system Capa 1 + Patrón 4):
 *   • Card Ink translúcido con border-left Signal Red (Uso #1 — criticidad).
 *   • Esquinas izquierdas cuadradas (border-radius: 0 X X 0).
 *   • Tipografía: label uppercase mono + heading Serif Bold + body Sans.
 *   • Sin amber, sin verde — sólo Ink + Signal Red.
 *
 * Posición: post-Hero, antes de la apertura IA (consistente con la jerarquía
 * de Patrón 4 — primero el motor advierte, luego la IA contextualiza).
 */
export function ViabilidadSTRBanner({ results }: { results: ShortTermResult }) {
  const tier = results.zonaSTR?.tierZona;
  const reco = results.recomendacionModalidad;

  // Mostrar solo cuando hay señal honesta para advertir.
  const showBanner =
    tier === "baja" || reco === "LTR_PREFERIDO";
  if (!showBanner) return null;

  const zonaTexto = results.zonaSTR?.comunaNoListada
    ? "Esta zona no tiene historial STR consolidado en nuestros benchmarks"
    : tier === "baja"
      ? `Esta zona (${results.zonaSTR?.comuna ?? "—"}) está en el tier bajo de demanda STR de Santiago`
      : null;

  const titulo = reco === "LTR_PREFERIDO"
    ? "LTR es la apuesta más sólida acá, no STR"
    : "Zona con demanda STR baja";

  const cuerpo = reco === "LTR_PREFERIDO" && tier === "baja"
    ? "Los números del motor muestran que el arriendo largo rinde más neto que el corto en esta zona, y la demanda STR no compensa la complejidad operativa adicional. Antes de invertir en amoblamiento + gestión, considera quedarte con arriendo tradicional."
    : reco === "LTR_PREFERIDO"
      ? "Tu sobre-renta STR vs LTR es muy chica (<5% neto). El esfuerzo operativo de Airbnb (8-12 hrs/sem auto o 20% comisión admin) no se justifica con ese margen. LTR queda como opción principal."
      : "La demanda turística + corporativa en esta zona es baja vs el resto de Santiago. Operar STR acá depende de superar al mercado típico para no quedar en aporte mensual. Revisa antes de invertir en amoblamiento.";

  return (
    <div
      className="p-5 md:p-6 mb-6"
      style={{
        background: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
        borderLeft: "3px solid var(--signal-red)",
        border: "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)",
        borderLeftWidth: "3px",
        borderRadius: "0 12px 12px 0",
      }}
    >
      <p
        className="font-mono uppercase mb-2 m-0"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "var(--signal-red)",
          fontWeight: 600,
        }}
      >
        ANTES DE SEGUIR — STR NO CONVIENE ACÁ
      </p>
      <h3 className="font-heading font-bold text-[18px] md:text-[20px] text-[var(--franco-text)] m-0 mb-2 leading-[1.3]">
        {titulo}
      </h3>
      <p className="font-body text-[14px] text-[var(--franco-text)] m-0 leading-[1.6]">
        {cuerpo}
      </p>
      {zonaTexto && (
        <p
          className="font-mono mt-2 m-0"
          style={{
            fontSize: 11,
            color: "var(--franco-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          ● {zonaTexto}
          {results.zonaSTR && !results.zonaSTR.comunaNoListada
            ? ` · ADR p${results.zonaSTR.percentilADR} · Ocupación p${results.zonaSTR.percentilOcupacion}`
            : ""}
          .
        </p>
      )}
    </div>
  );
}
