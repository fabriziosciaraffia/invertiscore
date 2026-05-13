"use client";

import Link from "next/link";
import { ArrowRight, Home, Building2 } from "lucide-react";
import { fmtMoney, fmtPct } from "@/components/analysis/utils";

// Commit E.3 · 2026-05-13 — Veredicto canónico unificado a 3 valores.
// "RECONSIDERA LA ESTRUCTURA" se fundió en "AJUSTA SUPUESTOS".
type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  ltrId: string;
  strId: string;
  // LTR KPIs
  ltrScore: number;
  ltrVerdict: Verdict | null;
  ltrFlujoMensual: number;
  ltrRentBruta: number;       // % raw (4.5)
  ltrCapRate: number;         // decimal (0.045)
  // STR KPIs
  strScore: number;
  strVerdict: "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA" | null;
  strFlujoMensual: number;
  strRentBruta: number;       // decimal (0.045)
  strCapRate: number;         // decimal
  // UI
  currency: "CLP" | "UF";
  ufValue: number;
}

// ─── Resúmenes LTR + STR (cards compactas) · Patrón Subject Card adaptado ─
// Cada card: 3-4 KPIs clave + link "Ver análisis completo →"
// Apertura a análisis individuales (results-client LTR / STR).
export function ResumenCards(p: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <ResumenCard
        Icon={Home}
        label="RENTA LARGA"
        score={p.ltrScore}
        verdict={p.ltrVerdict}
        kpis={[
          { label: "Flujo mensual", value: fmtMoney(p.ltrFlujoMensual, p.currency, p.ufValue), negative: p.ltrFlujoMensual < 0 },
          { label: "Rentabilidad bruta", value: fmtPct(p.ltrRentBruta) },
          { label: "CAP rate", value: fmtPct(p.ltrCapRate * 100) },
        ]}
        href={`/analisis/${p.ltrId}`}
      />
      <ResumenCard
        Icon={Building2}
        label="RENTA CORTA"
        score={p.strScore}
        verdict={p.strVerdict}
        kpis={[
          { label: "Flujo mensual", value: fmtMoney(p.strFlujoMensual, p.currency, p.ufValue), negative: p.strFlujoMensual < 0 },
          { label: "Rentabilidad bruta", value: fmtPct(p.strRentBruta * 100) },
          { label: "CAP rate", value: fmtPct(p.strCapRate * 100) },
        ]}
        href={`/analisis/renta-corta/${p.strId}`}
      />
    </div>
  );
}

interface KPI {
  label: string;
  value: string;
  negative?: boolean;
}

function ResumenCard({
  Icon, label, score, verdict, kpis, href,
}: {
  Icon: typeof Home;
  label: string;
  score: number;
  verdict: Verdict | null;
  kpis: KPI[];
  href: string;
}) {
  // Tono visual del badge según severidad (mismo lenguaje que Patrón 1).
  const tone: "neutral" | "warn" | "avoid" =
    verdict === "BUSCAR OTRA" ? "avoid" :
    verdict === "AJUSTA SUPUESTOS" ? "warn" :
    "neutral";

  const badgeBg = tone === "avoid"
    ? "var(--signal-red)"
    : tone === "warn"
      ? "var(--franco-card)"
      : "var(--franco-text)";
  const badgeColor = tone === "avoid"
    ? "var(--ink-100)"
    : tone === "warn"
      ? "var(--signal-red)"
      : "var(--franco-bg)";
  const badgeBorder = tone === "warn" ? "0.5px solid var(--signal-red)" : "none";

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-[var(--franco-text-secondary)]" />
        <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">
          {label}
        </p>
      </div>

      <div className="flex items-end justify-between gap-3 mb-3">
        <p className="font-mono text-[44px] font-semibold text-[var(--franco-text)] leading-none">
          {score}
        </p>
        <div
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 mb-1"
          style={{ background: badgeBg, color: badgeColor, border: badgeBorder }}
        >
          <span className="font-body text-[10px] font-semibold tracking-wide">
            {verdict ?? "—"}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--franco-border)] pt-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center justify-between">
            <span className="font-body text-[12px] text-[var(--franco-text-secondary)]">{k.label}</span>
            <span
              className="font-mono text-[13px] font-medium"
              style={{ color: k.negative ? "var(--signal-red)" : "var(--franco-text)" }}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-[var(--franco-text)] hover:text-signal-red transition-colors"
      >
        Ver análisis completo
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
