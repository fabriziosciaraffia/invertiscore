"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Calculator, Home, Building2 } from "lucide-react";
import { AppNav } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { Button } from "@/components/ui/button";
import type { FrancoVerdict } from "@/lib/types";

type LTRVerdict = FrancoVerdict;
type STRVerdict = "VIABLE" | "AJUSTA ESTRATEGIA" | "NO RECOMENDADO";
type AccessLevel = "guest" | "free" | "premium" | "subscriber";

interface Props {
  ltrId: string;
  strId: string;
  nombre: string;
  comuna: string;
  ciudad: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  precioUF: number;
  arriendoLTR: number;
  ltrScore: number;
  ltrVeredicto: LTRVerdict | null;
  ltrFlujoMensual: number;
  ltrRentBruta: number;
  ltrNOI: number;
  ltrDividendo: number;
  ltrEgresos: number;
  ltrMultiplicador: number;
  strScore: number;
  strVeredicto: STRVerdict | null;
  strIngresoBruto: number;
  strNOI: number;
  strFlujoMensual: number;
  strCapRate: number;
  strComisionMensual: number;
  strCostosOperativos: number;
  strDividendo: number;
  strSobreRentaPct: number;
  ufValue: number;
  accessLevel: AccessLevel;
  isOwner: boolean;
}

// ─── Format helpers ────────────────────────────────
function fmtCLP(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}
function fmtUFLabel(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return "UF " + Math.round(rounded).toLocaleString("es-CL");
  const [int, dec] = rounded.toFixed(1).split(".");
  return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
}
function fmtMoney(n: number, currency: "CLP" | "UF", uf: number): string {
  if (currency === "UF") {
    const sign = n < 0 ? "-" : "";
    return sign + fmtUFLabel(Math.abs(n) / uf);
  }
  return fmtCLP(n);
}
function fmtCompact(n: number, currency: "CLP" | "UF", uf: number): string {
  if (currency === "UF") return fmtMoney(n, "UF", uf);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (abs >= 1_000) return sign + "$" + Math.round(abs / 1_000).toLocaleString("es-CL") + "K";
  return sign + "$" + Math.round(abs).toLocaleString("es-CL");
}
function fmtPctRaw(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(".", ",") + "%";
}
function fmtPctDecimal(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals).replace(".", ",") + "%";
}

// ─── Verdict configs (Capa 1: solo Ink + Signal Red) ───────
// COMPRAR / VIABLE → neutral Ink (sin wash, badge invertido).
// AJUSTA EL PRECIO / AJUSTA ESTRATEGIA → surface neutral con badge texto Signal Red (sin wash amber).
// BUSCAR OTRA / NO RECOMENDADO → wash Signal Red (--franco-sc-bad-*) + badge sólido.
type VerdictTone = "neutral" | "warn" | "avoid";

const LTR_VERDICT: Record<LTRVerdict, { tone: VerdictTone; icon: typeof CheckCircle2; label: string }> = {
  "COMPRAR": { tone: "neutral", icon: CheckCircle2, label: "COMPRAR" },
  "AJUSTA EL PRECIO": { tone: "warn", icon: AlertTriangle, label: "AJUSTA EL PRECIO" },
  "BUSCAR OTRA": { tone: "avoid", icon: XCircle, label: "BUSCAR OTRA" },
  // 4to veredicto: el depto está bien, la matemática del financiamiento no.
  "RECONSIDERA LA ESTRUCTURA": { tone: "neutral", icon: Calculator, label: "RECONSIDERA LA ESTRUCTURA" },
};

const STR_VERDICT: Record<STRVerdict, { tone: VerdictTone; icon: typeof CheckCircle2; label: string }> = {
  "VIABLE": { tone: "neutral", icon: CheckCircle2, label: "VIABLE" },
  "AJUSTA ESTRATEGIA": { tone: "warn", icon: AlertTriangle, label: "AJUSTA ESTRATEGIA" },
  "NO RECOMENDADO": { tone: "avoid", icon: XCircle, label: "NO RECOMENDADO" },
};

// Tone → CSS vars. Sin hex hardcoded.
function cardSurface(tone: VerdictTone): { background: string; borderColor: string } {
  if (tone === "avoid") {
    return { background: "var(--franco-sc-bad-bg)", borderColor: "var(--franco-sc-bad-border)" };
  }
  // neutral + warn comparten surface (la diferenciación vive en el badge).
  return { background: "var(--franco-card)", borderColor: "var(--franco-border)" };
}

function badgeSurface(tone: VerdictTone): { background: string; color: string } {
  if (tone === "avoid") {
    // Sólido Signal Red sobre fondo card → texto invertido (Ink 100).
    return { background: "var(--signal-red)", color: "var(--ink-100)" };
  }
  if (tone === "warn") {
    // Texto Signal Red sobre fondo card sin wash (Patrón 1: AJUSTA EL PRECIO).
    return { background: "var(--franco-card)", color: "var(--signal-red)" };
  }
  // neutral / COMPRAR: badge Ink sólido con texto invertido.
  return { background: "var(--franco-text)", color: "var(--franco-bg)" };
}

// ─── CurrencyToggle ─────────────────────────────────
function CurrencyToggle({ currency, onToggle, uf }: { currency: "CLP" | "UF"; onToggle: () => void; uf: number }) {
  return (
    <div className="flex items-center justify-between border border-[var(--franco-border)] bg-[var(--franco-card)] rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-8 w-20 items-center rounded-full bg-[var(--franco-border)] p-1 transition-colors"
          aria-label="Cambiar moneda"
        >
          <div
            className={`absolute h-6 w-9 rounded-full bg-[var(--franco-text)] transition-transform ${
              currency === "UF" ? "translate-x-[40px]" : "translate-x-0"
            }`}
          />
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "CLP" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>CLP</span>
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "UF" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>UF</span>
        </button>
        {currency === "CLP" && (
          <span className="text-xs text-[var(--franco-text-secondary)]">UF = ${uf.toLocaleString("es-CL")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────
export function ComparativaClient(p: Props) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const uf = p.ufValue;

  const ltrCfg = p.ltrVeredicto ? LTR_VERDICT[p.ltrVeredicto] : null;
  const strCfg = p.strVeredicto ? STR_VERDICT[p.strVeredicto] : null;
  const LtrIcon = ltrCfg?.icon ?? CheckCircle2;
  const StrIcon = strCfg?.icon ?? CheckCircle2;
  const ltrCardSurface = ltrCfg ? cardSurface(ltrCfg.tone) : { background: "var(--franco-card)", borderColor: "var(--franco-border)" };
  const strCardSurface = strCfg ? cardSurface(strCfg.tone) : { background: "var(--franco-card)", borderColor: "var(--franco-border)" };
  const ltrBadge = ltrCfg ? badgeSurface(ltrCfg.tone) : { background: "var(--franco-card)", color: "var(--franco-text-secondary)" };
  const strBadge = strCfg ? badgeSurface(strCfg.tone) : { background: "var(--franco-card)", color: "var(--franco-text-secondary)" };

  // Diferencia de flujo STR vs LTR (positivo = STR gana)
  const deltaFlujo = p.strFlujoMensual - p.ltrFlujoMensual;
  const deltaPctFlujo = p.ltrFlujoMensual !== 0
    ? Math.abs(deltaFlujo / p.ltrFlujoMensual) * 100
    : 0;

  // Veredicto comparativo — basado en FLUJO DE CAJA (lo que el inversionista siente)
  const ambasNegativas = p.ltrFlujoMensual < 0 && p.strFlujoMensual < 0;
  const strMejorFlujo = p.strFlujoMensual > p.ltrFlujoMensual;
  const sobreRentaClaraPositiva = p.strSobreRentaPct >= 0.05;
  const sobreRentaClaraNegativa = p.strSobreRentaPct <= -0.05;

  // KPIs simétricos: ambas columnas muestran Flujo · Rentabilidad bruta · CAP rate.
  // ltrRentBruta llega ya en % (4.5), strCapRate y strSobreRentaPct llegan en decimal (0.045).
  // Para STR rent bruta y LTR cap rate los derivamos client-side desde props existentes
  // (no podemos modificar page.tsx, restricción de Ronda 3).
  const precioCLP = p.precioUF * uf;
  const ltrCapRate = precioCLP > 0 ? (p.ltrNOI * 12) / precioCLP : 0;
  const strRentBrutaDec = precioCLP > 0 ? (p.strIngresoBruto * 12) / precioCLP : 0;

  let veredictoTitulo: string;
  let veredictoSubtitulo: string;
  if (strMejorFlujo && sobreRentaClaraPositiva) {
    veredictoTitulo = "La renta corta genera más, pero requiere más gestión.";
    veredictoSubtitulo = ambasNegativas
      ? `STR genera ${fmtCompact(deltaFlujo, currency, uf)}/mes más que LTR (+${fmtPctRaw(deltaPctFlujo)}). Aun así, ambas modalidades tienen flujo negativo.`
      : `STR genera ${fmtCompact(deltaFlujo, currency, uf)}/mes más que LTR (+${fmtPctRaw(deltaPctFlujo)}).`;
  } else if (strMejorFlujo) {
    veredictoTitulo = "Ambas generan parecido, pero STR tiene mejor flujo.";
    veredictoSubtitulo = `STR genera ${fmtCompact(deltaFlujo, currency, uf)}/mes más que LTR, pero la diferencia de ingresos netos es marginal.`;
  } else if (sobreRentaClaraNegativa || !strMejorFlujo) {
    veredictoTitulo = "Para este departamento, el arriendo tradicional rinde más.";
    veredictoSubtitulo = `LTR genera ${fmtCompact(-deltaFlujo, currency, uf)}/mes más que STR. Los costos operativos de la renta corta no se justifican aquí.`;
  } else {
    veredictoTitulo = "Ambas modalidades rinden parecido para este departamento.";
    veredictoSubtitulo = ambasNegativas
      ? "Ninguna cubre el dividendo. La diferencia entre rentar largo o corto es marginal."
      : "La diferencia es chica. Decide según cuánto tiempo quieras dedicarle.";
  }

  let siendoFranco: string;
  if (strMejorFlujo && sobreRentaClaraPositiva) {
    siendoFranco = "La renta corta genera más, pero asegúrate de que el reglamento del edificio lo permita y de que estés dispuesto a gestionar huéspedes (o pagar a un administrador). Si no, el arriendo tradicional es la opción tranquila.";
  } else if (strMejorFlujo) {
    siendoFranco = "STR tiene mejor flujo por un margen chico. El esfuerzo extra de gestionar huéspedes solo se justifica si estás cómodo con la operación.";
  } else {
    siendoFranco = "Para esta propiedad, el arriendo tradicional es la opción más eficiente. Los costos operativos de la renta corta (insumos, servicios, comisiones) se comen el ingreso adicional.";
  }

  // Filas comparativa
  type Row = { label: string; ltr: number; str: number; mejorAlto: boolean; tipo: "money" | "raw" };
  const rows: Row[] = [
    { label: "Ingreso bruto mensual", ltr: p.arriendoLTR, str: p.strIngresoBruto, mejorAlto: true, tipo: "money" },
    { label: "Costos operativos", ltr: -p.ltrEgresos, str: -(p.strCostosOperativos + p.strComisionMensual), mejorAlto: true, tipo: "money" },
    { label: "NOI mensual", ltr: p.ltrNOI, str: p.strNOI, mejorAlto: true, tipo: "money" },
    { label: "Dividendo crédito", ltr: -p.ltrDividendo, str: -p.strDividendo, mejorAlto: true, tipo: "money" },
    { label: "Flujo de caja mensual", ltr: p.ltrFlujoMensual, str: p.strFlujoMensual, mejorAlto: true, tipo: "money" },
  ];

  // Chrome global — top bar reusa AppNav variant="app" + ctaSlot "← Dashboard".
  const ctaSlot = (
    <Link href="/dashboard">
      <Button variant="ghost" size="sm" className="gap-2 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-card)]">
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
      </Button>
    </Link>
  );

  // Footer mínimo — links legales en linksSlot.
  const footerLinks = (
    <div className="flex items-center gap-4">
      <Link href="/terms" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Términos
      </Link>
      <Link href="/privacy" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Privacidad
      </Link>
      <Link href="/privacy#cookies" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Cookies
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] flex flex-col">
      <AppNav variant="app" ctaSlot={ctaSlot} />

      <main className="flex-1">
        <div className="container mx-auto max-w-[900px] px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-2">
              COMPARATIVA · RENTA LARGA vs RENTA CORTA
            </p>
            <h1 className="font-heading text-[28px] sm:text-[34px] font-bold text-[var(--franco-text)] leading-tight">
              ¿Qué conviene más para tu departamento?
            </h1>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
              {p.nombre || `Depto ${p.dormitorios}D${p.banos}B`} en {p.comuna}
              {" · "}{fmtUFLabel(p.precioUF)}{" · "}{p.superficie}m²
            </p>
          </div>

          {/* Toggle moneda */}
          <div className="mb-6">
            <CurrencyToggle currency={currency} onToggle={() => setCurrency(c => c === "CLP" ? "UF" : "CLP")} uf={uf} />
          </div>

          {/* Veredicto comparativo — surface neutro idéntico siempre (sin sesgo) */}
          <div
            className="mb-8 rounded-2xl border p-6 sm:p-8"
            style={{ background: "var(--franco-card)", borderColor: "var(--franco-border)" }}
          >
            <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-3">
              VEREDICTO COMPARATIVO
            </p>
            <h2 className="font-heading text-[22px] sm:text-[26px] font-bold text-[var(--franco-text)] leading-snug">
              {veredictoTitulo}
            </h2>
            <p className="mt-3 font-body text-[15px] text-[var(--franco-text-secondary)] leading-relaxed">
              {veredictoSubtitulo}
            </p>
          </div>

          {/* Side-by-side scores — KPIs simétricos */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LTR card */}
            <div
              className="rounded-2xl border p-6 flex flex-col"
              style={{ background: ltrCardSurface.background, borderColor: ltrCardSurface.borderColor }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Home size={14} className="text-[var(--franco-text-secondary)]" />
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">RENTA LARGA</p>
              </div>
              <p className="font-mono text-[52px] font-semibold text-[var(--franco-text)] leading-none">{p.ltrScore}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 self-start" style={{ background: ltrBadge.background, color: ltrBadge.color }}>
                <LtrIcon size={12} />
                <span className="font-body text-[11px] font-semibold tracking-wide">{ltrCfg?.label ?? "—"}</span>
              </div>

              <div className="mt-5 space-y-2 border-t border-[var(--franco-border)] pt-4">
                <MetricRow label="Flujo mensual" value={fmtCompact(p.ltrFlujoMensual, currency, uf)} negative={p.ltrFlujoMensual < 0} />
                <MetricRow label="Rentabilidad bruta" value={fmtPctRaw(p.ltrRentBruta)} />
                <MetricRow label="CAP rate" value={fmtPctDecimal(ltrCapRate)} />
              </div>

              {/* Métrica diferenciadora menor al pie */}
              <div className="mt-4 border-t border-[var(--franco-border)] pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-1">RETORNO 10A</p>
                <p className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
                  {p.ltrMultiplicador > 0 ? `${p.ltrMultiplicador.toFixed(1).replace(".", ",")}x del capital invertido` : "—"}
                </p>
              </div>

              <Link
                href={`/analisis/${p.ltrId}`}
                className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-[var(--franco-text)] hover:text-signal-red transition-colors"
              >
                Ver análisis completo
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* STR card */}
            <div
              className="rounded-2xl border p-6 flex flex-col"
              style={{ background: strCardSurface.background, borderColor: strCardSurface.borderColor }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={14} className="text-[var(--franco-text-secondary)]" />
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">RENTA CORTA</p>
              </div>
              <p className="font-mono text-[52px] font-semibold text-[var(--franco-text)] leading-none">{p.strScore}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 self-start" style={{ background: strBadge.background, color: strBadge.color }}>
                <StrIcon size={12} />
                <span className="font-body text-[11px] font-semibold tracking-wide">{strCfg?.label ?? "—"}</span>
              </div>

              <div className="mt-5 space-y-2 border-t border-[var(--franco-border)] pt-4">
                <MetricRow label="Flujo mensual" value={fmtCompact(p.strFlujoMensual, currency, uf)} negative={p.strFlujoMensual < 0} />
                <MetricRow label="Rentabilidad bruta" value={fmtPctDecimal(strRentBrutaDec)} />
                <MetricRow label="CAP rate" value={fmtPctDecimal(p.strCapRate)} />
              </div>

              {/* Métrica diferenciadora menor al pie */}
              <div className="mt-4 border-t border-[var(--franco-border)] pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-1">VS RENTA LARGA</p>
                <p
                  className="font-mono text-[12px]"
                  style={{ color: p.strSobreRentaPct < 0 ? "var(--signal-red)" : "var(--franco-text-secondary)" }}
                >
                  {`${p.strSobreRentaPct >= 0 ? "+" : ""}${fmtPctDecimal(p.strSobreRentaPct, 0)} en flujo neto`}
                </p>
              </div>

              <Link
                href={`/analisis/renta-corta/${p.strId}`}
                className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-[var(--franco-text)] hover:text-signal-red transition-colors"
              >
                Ver análisis completo
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Tabla comparativa detallada */}
          <div className="mb-8 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] overflow-hidden">
            <div className="border-b border-[var(--franco-border)] px-6 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1">DESGLOSE MENSUAL</p>
              <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)]">Comparativa línea por línea</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--franco-border)]">
                    <th className="text-left px-6 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">Concepto</th>
                    <th className="text-right px-4 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">Renta larga</th>
                    <th className="text-right px-4 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">Renta corta</th>
                    <th className="text-right px-6 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">Mejor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ganaSTR = r.mejorAlto ? r.str > r.ltr : r.str < r.ltr;
                    const empate = r.str === r.ltr;
                    const ganador = empate ? "—" : ganaSTR ? "STR" : "LTR";
                    // Tratamiento idéntico ambas columnas (sin sesgo): el ganador se marca en
                    // text-tertiary sólido sea STR o LTR. Empate en text-muted.
                    const ganadorColor = empate ? "var(--franco-text-muted)" : "var(--franco-text-tertiary)";
                    return (
                      <tr key={r.label} className="border-b border-[var(--franco-border)] last:border-0">
                        <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">{r.label}</td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] text-[var(--franco-text)]">
                          {fmtMoney(r.ltr, currency, uf)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] text-[var(--franco-text)]">
                          {fmtMoney(r.str, currency, uf)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-[11px] font-medium" style={{ color: ganadorColor }}>
                          {ganador}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-[var(--franco-border)] last:border-0 bg-[var(--franco-bg)]/40">
                    <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">Gestión requerida</td>
                    <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Baja</td>
                    <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Alta</td>
                    <td className="px-6 py-3 text-right font-mono text-[11px] font-medium" style={{ color: "var(--franco-text-tertiary)" }}>LTR</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">Riesgo de vacancia</td>
                    <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Bajo</td>
                    <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Medio</td>
                    <td className="px-6 py-3 text-right font-mono text-[11px] font-medium" style={{ color: "var(--franco-text-tertiary)" }}>LTR</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Siendo franco */}
          <div className="mb-8 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 sm:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[3px] text-signal-red mb-3">SIENDO FRANCO</p>
            <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed">
              {siendoFranco}
            </p>
          </div>

          {/* Links a análisis individuales */}
          <div className="mb-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/analisis/${p.ltrId}`}
              className="flex-1 inline-flex items-center justify-between rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 hover:border-signal-red transition-colors"
            >
              <span className="font-body text-[14px] font-medium text-[var(--franco-text)]">Ver análisis renta larga completo</span>
              <ArrowRight size={16} className="text-[var(--franco-text-secondary)]" />
            </Link>
            <Link
              href={`/analisis/renta-corta/${p.strId}`}
              className="flex-1 inline-flex items-center justify-between rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 hover:border-signal-red transition-colors"
            >
              <span className="font-body text-[14px] font-medium text-[var(--franco-text)]">Ver análisis renta corta completo</span>
              <ArrowRight size={16} className="text-[var(--franco-text-secondary)]" />
            </Link>
          </div>

          {/* Comparar otra propiedad */}
          <div className="mb-4 flex justify-center">
            <Link
              href="/analisis/nuevo-v2"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-signal-red hover:opacity-80 transition-opacity"
            >
              Comparar otra propiedad
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </main>

      <AppFooter variant="minimal" linksSlot={footerLinks} />
    </div>
  );
}

function MetricRow({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-[12px] text-[var(--franco-text-secondary)]">{label}</span>
      <span
        className="font-mono text-[13px] font-medium"
        style={{ color: negative ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {value}
      </span>
    </div>
  );
}
