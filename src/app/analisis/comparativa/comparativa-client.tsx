"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Home, Building2 } from "lucide-react";

type LTRVerdict = "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";
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

// ─── Verdict configs ───────────────────────────────
const LTR_VERDICT: Record<LTRVerdict, { color: string; bg: string; border: string; icon: typeof CheckCircle2; label: string }> = {
  "COMPRAR": { color: "#B0BEC5", bg: "rgba(176,190,197,0.10)", border: "rgba(176,190,197,0.4)", icon: CheckCircle2, label: "COMPRAR" },
  "AJUSTA EL PRECIO": { color: "#FBBF24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.4)", icon: AlertTriangle, label: "AJUSTA EL PRECIO" },
  "BUSCAR OTRA": { color: "#C8323C", bg: "rgba(200,50,60,0.10)", border: "rgba(200,50,60,0.4)", icon: XCircle, label: "BUSCAR OTRA" },
};

const STR_VERDICT: Record<STRVerdict, { color: string; bg: string; border: string; icon: typeof CheckCircle2; label: string }> = {
  "VIABLE": { color: "#B0BEC5", bg: "rgba(176,190,197,0.10)", border: "rgba(176,190,197,0.4)", icon: CheckCircle2, label: "VIABLE" },
  "AJUSTA ESTRATEGIA": { color: "#FBBF24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.4)", icon: AlertTriangle, label: "AJUSTA ESTRATEGIA" },
  "NO RECOMENDADO": { color: "#C8323C", bg: "rgba(200,50,60,0.10)", border: "rgba(200,50,60,0.4)", icon: XCircle, label: "NO RECOMENDADO" },
};

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

  // Diferencia de flujo STR vs LTR (positivo = STR gana)
  const deltaFlujo = p.strFlujoMensual - p.ltrFlujoMensual;
  const deltaPctFlujo = p.ltrFlujoMensual !== 0
    ? Math.abs(deltaFlujo / p.ltrFlujoMensual) * 100
    : 0;

  // Veredicto comparativo (texto principal)
  const ambasNegativas = p.ltrFlujoMensual < 0 && p.strFlujoMensual < 0;
  const sobreRentaSignificativa = Math.abs(p.strSobreRentaPct) >= 0.05;
  const strMejorNOI = p.strNOI > p.ltrNOI;

  let veredictoTitulo: string;
  let veredictoSubtitulo: string;
  if (!sobreRentaSignificativa) {
    veredictoTitulo = "Ambas modalidades rinden parecido para este departamento.";
    veredictoSubtitulo = ambasNegativas
      ? "Ninguna cubre el dividendo. La diferencia entre rentar largo o corto es marginal."
      : "La diferencia es chica. Decide según cuánto tiempo quieras dedicarle.";
  } else if (strMejorNOI) {
    veredictoTitulo = "La renta corta genera más, pero requiere más gestión.";
    veredictoSubtitulo = ambasNegativas
      ? `STR genera ${fmtCompact(deltaFlujo, currency, uf)}/mes más que LTR (+${fmtPctRaw(deltaPctFlujo)}). Aun así, ambas modalidades tienen flujo negativo.`
      : `STR genera ${fmtCompact(deltaFlujo, currency, uf)}/mes más que LTR (+${fmtPctRaw(deltaPctFlujo)}).`;
  } else {
    veredictoTitulo = "Para este departamento, el arriendo tradicional rinde más.";
    veredictoSubtitulo = `LTR genera ${fmtCompact(-deltaFlujo, currency, uf)}/mes más que STR. Los costos operativos de la renta corta no se justifican aquí.`;
  }

  // Texto "Siendo franco:"
  let siendoFranco: string;
  if (!sobreRentaSignificativa) {
    siendoFranco = "Ambas modalidades generan resultados similares. La decisión depende de cuánto tiempo quieras dedicarle: la renta larga es casi pasiva, la renta corta exige operación constante (o pagar a un administrador).";
  } else if (strMejorNOI) {
    siendoFranco = "La renta corta genera más, pero asegúrate de que el reglamento del edificio lo permita y de que estés dispuesto a gestionar huéspedes (o pagar a un administrador). Si no, el arriendo tradicional es la opción tranquila.";
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

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
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

        {/* Veredicto comparativo */}
        <div
          className="mb-8 rounded-2xl border p-6 sm:p-8"
          style={{
            background: strMejorNOI && sobreRentaSignificativa ? "rgba(176,190,197,0.06)" : "var(--franco-card)",
            borderColor: "var(--franco-border)",
          }}
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

        {/* Side-by-side scores */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LTR card */}
          <div
            className="rounded-2xl border p-6"
            style={{ background: ltrCfg?.bg ?? "var(--franco-card)", borderColor: ltrCfg?.border ?? "var(--franco-border)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Home size={14} className="text-[var(--franco-text-secondary)]" />
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">RENTA LARGA</p>
            </div>
            <p className="font-mono text-[52px] font-semibold text-[var(--franco-text)] leading-none">{p.ltrScore}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: ltrCfg?.bg, color: ltrCfg?.color }}>
              <LtrIcon size={12} />
              <span className="font-body text-[11px] font-semibold tracking-wide">{ltrCfg?.label ?? "—"}</span>
            </div>

            <div className="mt-5 space-y-2 border-t border-[var(--franco-border)] pt-4">
              <MetricRow label="Flujo mensual" value={fmtCompact(p.ltrFlujoMensual, currency, uf)} negative={p.ltrFlujoMensual < 0} />
              <MetricRow label="Rentabilidad bruta" value={fmtPctRaw(p.ltrRentBruta)} />
              <MetricRow label="Retorno 10 años" value={p.ltrMultiplicador > 0 ? `${p.ltrMultiplicador.toFixed(1).replace(".", ",")}x` : "—"} />
            </div>

            <Link
              href={`/analisis/${p.ltrId}`}
              className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-[var(--franco-text)] hover:text-[#C8323C] transition-colors"
            >
              Ver análisis completo
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* STR card */}
          <div
            className="rounded-2xl border p-6"
            style={{ background: strCfg?.bg ?? "var(--franco-card)", borderColor: strCfg?.border ?? "var(--franco-border)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={14} className="text-[var(--franco-text-secondary)]" />
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">RENTA CORTA</p>
            </div>
            <p className="font-mono text-[52px] font-semibold text-[var(--franco-text)] leading-none">{p.strScore}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: strCfg?.bg, color: strCfg?.color }}>
              <StrIcon size={12} />
              <span className="font-body text-[11px] font-semibold tracking-wide">{strCfg?.label ?? "—"}</span>
            </div>

            <div className="mt-5 space-y-2 border-t border-[var(--franco-border)] pt-4">
              <MetricRow label="Flujo mensual" value={fmtCompact(p.strFlujoMensual, currency, uf)} negative={p.strFlujoMensual < 0} />
              <MetricRow label="CAP rate" value={fmtPctDecimal(p.strCapRate)} />
              <MetricRow
                label="vs Renta larga"
                value={`${p.strSobreRentaPct >= 0 ? "+" : ""}${fmtPctDecimal(p.strSobreRentaPct, 0)}`}
                negative={p.strSobreRentaPct < 0}
              />
            </div>

            <Link
              href={`/analisis/renta-corta/${p.strId}`}
              className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-[var(--franco-text)] hover:text-[#C8323C] transition-colors"
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
                  return (
                    <tr key={r.label} className="border-b border-[var(--franco-border)] last:border-0">
                      <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">{r.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-[var(--franco-text)]">
                        {fmtMoney(r.ltr, currency, uf)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-[var(--franco-text)]">
                        {fmtMoney(r.str, currency, uf)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-[11px] font-medium" style={{ color: empate ? "var(--franco-text-secondary)" : ganaSTR ? "#B0BEC5" : "#71717A" }}>
                        {ganador}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-[var(--franco-border)] last:border-0 bg-[var(--franco-bg)]/40">
                  <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">Gestión requerida</td>
                  <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Baja</td>
                  <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Alta</td>
                  <td className="px-6 py-3 text-right font-mono text-[11px] font-medium text-[#71717A]">LTR</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-body text-[13px] text-[var(--franco-text)]">Riesgo de vacancia</td>
                  <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Bajo</td>
                  <td className="px-4 py-3 text-right font-body text-[13px] text-[var(--franco-text-secondary)]">Medio</td>
                  <td className="px-6 py-3 text-right font-mono text-[11px] font-medium text-[#71717A]">LTR</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Siendo franco */}
        <div className="mb-8 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 sm:p-8">
          <p className="font-mono text-[9px] uppercase tracking-[3px] text-[#C8323C] mb-3">SIENDO FRANCO</p>
          <p className="font-body text-[15px] text-[var(--franco-text)] leading-relaxed">
            {siendoFranco}
          </p>
        </div>

        {/* Links finales */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/analisis/${p.ltrId}`}
            className="flex-1 inline-flex items-center justify-between rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 hover:border-[#C8323C] transition-colors"
          >
            <span className="font-body text-[14px] font-medium text-[var(--franco-text)]">Ver análisis renta larga completo</span>
            <ArrowRight size={16} className="text-[var(--franco-text-secondary)]" />
          </Link>
          <Link
            href={`/analisis/renta-corta/${p.strId}`}
            className="flex-1 inline-flex items-center justify-between rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 hover:border-[#C8323C] transition-colors"
          >
            <span className="font-body text-[14px] font-medium text-[var(--franco-text)]">Ver análisis renta corta completo</span>
            <ArrowRight size={16} className="text-[var(--franco-text-secondary)]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-[12px] text-[var(--franco-text-secondary)]">{label}</span>
      <span
        className="font-mono text-[13px] font-medium"
        style={{ color: negative ? "#C8323C" : "var(--franco-text)" }}
      >
        {value}
      </span>
    </div>
  );
}
