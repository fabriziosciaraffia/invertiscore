"use client";

import type { RecomendacionModalidadAmbas } from "@/lib/types";
import type { ZonaSTRScore } from "@/lib/engines/str-universo-santiago";
import { fmtMoney, fmtPct, fmtUF } from "@/components/analysis/utils";

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  recomendacion: RecomendacionModalidadAmbas;
  // Veredicto unificado (de la modalidad recomendada).
  verdictUnificado: Verdict;
  // Property header
  nombre: string;
  comuna: string;
  superficie: number;
  precioUF: number;
  dormitorios: number;
  banos: number;
  // KPIs Hero
  deltaNOIMensual: number;          // STR - LTR
  ltrFlujoMensual: number;
  strFlujoMensual: number;
  zona: ZonaSTRScore | undefined;
  // D1 — banda de fragilidad (break-even 90-110%). Cuando true, el par tiene ventaja de
  // flujo STR pero margen frágil → `recomendacion` colapsa a INDIFERENTE y el hero lo
  // explica en vez de decir "rinden parecido". `breakEvenPct` es el driver (1.00 = mercado).
  fragil?: boolean;
  breakEvenPct?: number;
  // UI state
  currency: "CLP" | "UF";
  ufValue: number;
}

// ─── Hero único · Patrón 1 adaptado · Driver = recomendacionModalidad ────
// La distinción entre 3 variantes vive en lenguaje + composición, NO en
// colores nuevos. Signal Red solo se usa cuando hay criticidad real
// (BUSCAR OTRA del veredicto unificado).
export function HeroComparativa(p: Props) {
  const deltaPctNOI = p.ltrFlujoMensual !== 0
    ? (p.strFlujoMensual - p.ltrFlujoMensual) / Math.abs(p.ltrFlujoMensual)
    : 0;

  const labelRecomendacion =
    p.fragil ? "RECOMENDACIÓN · VENTAJA FRÁGIL" :
    p.recomendacion === "LTR_PREFERIDO" ? "RECOMENDACIÓN · RENTA LARGA" :
    p.recomendacion === "STR_VENTAJA_CLARA" ? "RECOMENDACIÓN · RENTA CORTA" :
    "RECOMENDACIÓN · DECISIÓN POR ESFUERZO";

  const titulo =
    p.fragil
      ? "Renta corta rinde más, pero con margen frágil"
      : p.recomendacion === "LTR_PREFERIDO"
        ? "Tu mejor jugada acá es renta larga"
        : p.recomendacion === "STR_VENTAJA_CLARA"
          ? `Renta corta justifica el esfuerzo: ${deltaPctNOI > 0 ? "+" : ""}${fmtPct(deltaPctNOI * 100, 0)} en flujo neto`
          : "Ambas opciones rinden parecido — la decisión es por esfuerzo";

  const zonaInfo = p.zona
    ? `Tu zona (tier ${p.zona.tierZona}, p${p.zona.percentilADR} ADR · p${p.zona.percentilOcupacion} occ) `
    : "";

  const bajada =
    p.fragil
      ? `Renta corta supera a renta larga en flujo, pero su punto de equilibrio queda al ${fmtPct((p.breakEvenPct ?? 0) * 100, 0)} de la facturación típica de la zona — poco colchón. Una temporada floja o una caída de ocupación se come la ventaja, así que no la damos como clara.`
      : p.recomendacion === "LTR_PREFERIDO"
        ? p.zona?.tierZona === "baja"
          ? `La demanda STR en ${p.comuna} es baja (tier ${p.zona.tierZona}, score ${p.zona.score}/100). El esfuerzo operativo de Airbnb no compensa acá.`
          : "La sobre-renta STR vs LTR es marginal. La complejidad operativa no se justifica."
        : p.recomendacion === "STR_VENTAJA_CLARA"
          ? `${zonaInfo}${zonaInfo ? "sostiene" : "Los números sostienen"} el modelo. Si puedes asumir 8-12 hrs/semana o aceptar 20% al administrador, STR rinde más.`
          : "La diferencia neta es chica. Lo que decide es cuánto tiempo quieres dedicarle.";

  // Veredicto unificado — tono visual del Patrón 1 según severidad.
  // COMPRAR + AJUSTA → neutral. BUSCAR OTRA → Signal Red (criticidad real).
  const verdictTone: "neutral" | "warn" | "avoid" =
    p.verdictUnificado === "BUSCAR OTRA" ? "avoid" :
    p.verdictUnificado === "AJUSTA SUPUESTOS" ? "warn" :
    "neutral";

  const cardBg = verdictTone === "avoid"
    ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
    : "var(--franco-card)";
  const cardBorder = verdictTone === "avoid"
    ? "color-mix(in srgb, var(--signal-red) 35%, transparent)"
    : "var(--franco-border)";
  const badgeBg = verdictTone === "avoid"
    ? "var(--signal-red)"
    : verdictTone === "warn"
      ? "var(--franco-card)"
      : "var(--franco-text)";
  const badgeColor = verdictTone === "avoid"
    ? "var(--ink-100)"
    : verdictTone === "warn"
      ? "var(--signal-red)"
      : "var(--franco-bg)";
  const badgeBorder = verdictTone === "warn"
    ? "0.5px solid var(--signal-red)"
    : "none";

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8 mb-6"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {/* Property header */}
      <div className="mb-5 pb-5" style={{ borderBottom: "1px dashed var(--franco-border)" }}>
        <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-2">
          01 · VEREDICTO · COMPARATIVA AMBAS
        </p>
        <h1 className="font-heading text-[22px] sm:text-[26px] font-bold text-[var(--franco-text)] leading-tight">
          {p.nombre || `Depto ${p.dormitorios}D${p.banos}B`} en {p.comuna}
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Metadata label="SUPERFICIE" value={`${p.superficie} m²`} />
          <Metadata label="PRECIO" value={fmtUF(p.precioUF)} />
          <Metadata label="DORMITORIOS" value={`${p.dormitorios}`} />
          <Metadata label="BAÑOS" value={`${p.banos}`} />
        </div>
      </div>

      {/* Recomendación principal */}
      <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-2">
        {labelRecomendacion}
      </p>
      <div className="flex items-start gap-4 mb-3 flex-wrap">
        <h2 className="font-heading text-[24px] sm:text-[30px] font-bold text-[var(--franco-text)] leading-snug flex-1 min-w-[260px]">
          {titulo}
        </h2>
        <div
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 shrink-0"
          style={{ background: badgeBg, color: badgeColor, border: badgeBorder }}
        >
          <span className="font-body text-[11px] font-semibold tracking-wide">
            {p.verdictUnificado}
          </span>
        </div>
      </div>
      <p className="font-body text-[15px] text-[var(--franco-text-secondary)] leading-relaxed mb-5">
        {bajada}
      </p>

      {/* D1 — advertencia de fragilidad (break-even 90-110%). Signal Red en tono warn:
          atención real (la ventaja no es sólida), no criticidad de veredicto. */}
      {p.fragil && (
        <div
          className="rounded-xl border p-3.5 mb-5 flex items-start gap-3"
          style={{
            background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            borderColor: "color-mix(in srgb, var(--signal-red) 30%, transparent)",
          }}
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[2px] font-semibold shrink-0 mt-[3px]"
            style={{ color: "var(--signal-red)" }}
          >
            Margen<br />frágil
          </span>
          <p className="font-body text-[12.5px] text-[var(--franco-text-secondary)] leading-snug">
            El punto de equilibrio de renta corta queda al{" "}
            <span className="font-mono font-medium text-[var(--franco-text)]">
              {fmtPct((p.breakEvenPct ?? 0) * 100, 0)}
            </span>{" "}
            de la facturación típica de la zona. La ventaja de flujo existe, pero sin colchón:
            la dejamos como decisión pareja hasta que el margen aguante una temporada floja.
          </p>
        </div>
      )}

      {/* KPI principal: delta NOI mensual + tier zona */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KPICard
          label={p.deltaNOIMensual >= 0 ? "STR GANA EN NOI MENSUAL" : "LTR GANA EN NOI MENSUAL"}
          value={fmtMoney(Math.abs(p.deltaNOIMensual), p.currency, p.ufValue)}
          sub={`${p.deltaNOIMensual >= 0 ? "+" : "−"}${fmtPct(Math.abs(deltaPctNOI * 100), 0)} en flujo neto vs ${p.deltaNOIMensual >= 0 ? "LTR" : "STR"}`}
          critical={false}
        />
        <KPICard
          label="TIER DE ZONA STR"
          value={p.zona ? p.zona.tierZona.toUpperCase() : "NO DISPONIBLE"}
          sub={p.zona
            ? `${p.zona.comuna}${p.zona.comunaNoListada ? " · comuna fuera de benchmark V1" : ` · p${p.zona.percentilADR} ADR · p${p.zona.percentilOcupacion} occ`}`
            : "Análisis pre-Commit 4"}
          critical={p.zona?.tierZona === "baja"}
        />
      </div>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-0.5">
        {label}
      </p>
      <p className="font-mono text-[13px] font-medium text-[var(--franco-text)]">{value}</p>
    </div>
  );
}

function KPICard({ label, value, sub, critical }: { label: string; value: string; sub: string; critical: boolean }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "var(--franco-bg)",
        borderColor: critical
          ? "color-mix(in srgb, var(--signal-red) 35%, transparent)"
          : "var(--franco-border)",
      }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-1.5">
        {label}
      </p>
      <p
        className="font-mono text-[22px] font-semibold leading-tight"
        style={{ color: critical ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {value}
      </p>
      <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-1.5 leading-snug">
        {sub}
      </p>
    </div>
  );
}
