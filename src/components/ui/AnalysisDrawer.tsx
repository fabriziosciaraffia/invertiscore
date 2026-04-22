"use client";

import { useEffect, useState, useMemo } from "react";
import type {
  AIAnalysisV2,
  AISection,
  AINegociacionSection,
  FullAnalysisResult,
  AnalisisInput,
} from "@/lib/types";
import { calcFlujoDesglose } from "@/lib/analysis";
import { StateBox } from "@/components/ui/StateBox";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import { ZoneStatsCards } from "@/components/zone-insight/ZoneStatsCards";
import { ZoneMap } from "@/components/zone-insight/ZoneMap";
import { ZonePOIsList } from "@/components/zone-insight/ZonePOIsList";
import { ZoneInsightAI } from "@/components/zone-insight/ZoneInsightAI";

export type DrawerKey = "costoMensual" | "negociacion" | "largoPlazo" | "riesgos" | "zona";

interface DrawerProps {
  activeKey: DrawerKey;
  aiAnalysis: AIAnalysisV2;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  valorUF: number;
  onClose: () => void;
  onNavigate: (newKey: DrawerKey) => void;
  // Zone-insight (sección 06) — opcional, solo se usa cuando activeKey === "zona"
  zoneInsight?: ZoneInsightData | null;
  zoneLoading?: boolean;
  zoneError?: string | null;
  zoneCenter?: { lat: number; lng: number } | null;
  comuna?: string;
  arriendoUsuarioCLP?: number;
}

const DRAWER_META: Record<
  DrawerKey,
  { num: string; label: string; prev?: DrawerKey; next?: DrawerKey }
> = {
  costoMensual: { num: "02", label: "Costo mensual", prev: undefined, next: "negociacion" },
  negociacion: { num: "03", label: "Negociación", prev: "costoMensual", next: "largoPlazo" },
  largoPlazo: { num: "04", label: "Largo plazo", prev: "negociacion", next: "riesgos" },
  riesgos: { num: "05", label: "Riesgos", prev: "largoPlazo", next: "zona" },
  zona: { num: "06", label: "Zona", prev: "riesgos", next: undefined },
};

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}

function fmtMoney(n: number, currency: "CLP" | "UF", valorUF: number): string {
  if (currency === "UF") {
    const uf = Math.abs(n) / (valorUF || 1);
    const rounded = Math.round(uf * 100) / 100;
    if (rounded >= 100) return "UF " + Math.round(rounded).toLocaleString("es-CL");
    return "UF " + rounded.toFixed(2).replace(".", ",");
  }
  return fmtCLP(n);
}

// Compact format that always fits in narrow cards (~70px wide).
// CLP: $X,XB (billones, ≥1.000M) / $XM (≥100M) / $X,XM (<100M).
// UF: UF X,XK (≥10k) / UF X (redondeo).
function fmtCompact(n: number, currency: "CLP" | "UF", valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 10000) return "UF " + (uf / 1000).toFixed(1).replace(".", ",") + "K";
    if (uf >= 1000) return "UF " + Math.round(uf / 1000) + "K";
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  }
  const millones = abs / 1_000_000;
  if (millones >= 1000) return "$" + (millones / 1000).toFixed(1).replace(".", ",") + "B";
  if (millones >= 100) return "$" + Math.round(millones) + "M";
  if (millones >= 1) return "$" + millones.toFixed(1).replace(".", ",") + "M";
  if (abs >= 1000) return "$" + Math.round(abs / 1000) + "K";
  return "$" + Math.round(abs).toLocaleString("es-CL");
}

// ─── Costo mensual drawer ───────────────────────────
function DrawerCostoMensual({
  data,
  currency,
  results,
  inputData,
  valorUF,
}: {
  data: AISection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  valorUF: number;
}) {
  const desglose = calcFlujoDesglose({
    arriendo: results.metrics?.ingresoMensual ?? inputData.arriendo ?? 0,
    dividendo: results.metrics?.dividendo ?? 0,
    ggcc: inputData.gastos ?? 0,
    contribuciones: inputData.contribuciones ?? 0,
    mantencion: inputData.provisionMantencion ?? 0,
    vacanciaMeses: inputData.vacanciaMeses ?? 0,
    usaAdministrador: inputData.usaAdministrador,
    comisionAdministrador: inputData.comisionAdministrador,
  });

  const arriendo = desglose.arriendo;
  const flujo = desglose.flujoNeto;
  const totalSale = Math.round(desglose.totalEgresos);
  const isNeg = flujo < 0;
  const fmt = (v: number) => fmtMoney(v, currency, valorUF);

  // Ítems del grupo "Sale" en orden de magnitud de los fijos primero, variables después.
  const saleItems: Array<{ name: string; value: number }> = [
    { name: "Dividendo hipotecario", value: desglose.dividendo },
    { name: "Gastos comunes", value: desglose.ggccVacancia },
    { name: "Contribuciones", value: desglose.contribucionesMes },
    { name: "Vacancia", value: desglose.vacanciaProrrata },
    { name: "Mantención", value: desglose.mantencion },
    { name: "Corretaje", value: desglose.corretajeProrrata },
    { name: "Recambio", value: desglose.recambio },
    { name: "Administración", value: desglose.administracion },
  ];
  const maxSale = Math.max(...saleItems.map((s) => s.value), 1);
  const resultLabel = isNeg ? "SALE DE TU BOLSILLO CADA MES" : "TE SOBRA CADA MES";
  const resultSub = isNeg ? "Tienes que poner este dinero tú" : "Queda a tu favor después de todos los gastos";
  const resultColor = isNeg ? "#C8323C" : "#B0BEC5";

  return (
    <div>
      <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-4 whitespace-pre-wrap">
        {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
      </p>

      {/* GRUPO "ENTRA" */}
      <div className="mb-4">
        <div
          className="flex items-baseline justify-between pb-1.5 mb-2"
          style={{ borderBottom: "0.5px solid color-mix(in srgb, #B0BEC5 35%, transparent)" }}
        >
          <span
            className="font-mono uppercase font-semibold"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "#B0BEC5" }}
          >
            Entra
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 13, color: "#B0BEC5" }}
          >
            +{fmt(arriendo)}
          </span>
        </div>
        <div
          className="grid items-center gap-3 py-1"
          style={{ gridTemplateColumns: "1fr 1fr 120px" }}
          role="img"
          aria-label={`Arriendo mensual ${fmt(arriendo)}`}
        >
          <span
            className="font-body"
            style={{ fontSize: 12, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)" }}
          >
            Arriendo mensual
          </span>
          <div
            className="relative rounded-[2px]"
            style={{ height: 8, background: "color-mix(in srgb, var(--franco-text) 5%, transparent)" }}
          >
            <div
              className="absolute top-0 left-0 h-full rounded-[2px]"
              style={{ width: "100%", background: "#B0BEC5" }}
            />
          </div>
          <span
            className="font-mono font-bold text-right"
            style={{ fontSize: 12, color: "#B0BEC5" }}
          >
            +{fmt(arriendo)}
          </span>
        </div>
      </div>

      {/* GRUPO "SALE" */}
      <div className="mb-4">
        <div
          className="flex items-baseline justify-between pb-1.5 mb-2"
          style={{ borderBottom: "0.5px solid color-mix(in srgb, #C8323C 35%, transparent)" }}
        >
          <span
            className="font-mono uppercase font-semibold"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "#C8323C" }}
          >
            Sale
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 13, color: "#C8323C" }}
          >
            −{fmt(totalSale)}
          </span>
        </div>
        <div className="flex flex-col">
          {saleItems.map((it) => {
            const zero = it.value <= 0;
            const widthPct = zero ? 0 : Math.max((it.value / maxSale) * 100, 2);
            return (
              <div
                key={it.name}
                className="grid items-center gap-3 py-[3px]"
                style={{ gridTemplateColumns: "1fr 1fr 120px" }}
                role="img"
                aria-label={`${it.name} ${zero ? "cero" : fmt(it.value)}`}
              >
                <span
                  className="font-body"
                  style={{
                    fontSize: 12,
                    color: zero
                      ? "color-mix(in srgb, var(--franco-text) 40%, transparent)"
                      : "color-mix(in srgb, var(--franco-text) 82%, transparent)",
                  }}
                >
                  {it.name}
                </span>
                <div
                  className="relative rounded-[2px]"
                  style={{ height: 8, background: "color-mix(in srgb, var(--franco-text) 5%, transparent)" }}
                >
                  <div
                    className="absolute top-0 left-0 h-full rounded-[2px]"
                    style={{ width: `${widthPct}%`, background: "#C8323C", opacity: 0.85 }}
                  />
                </div>
                <span
                  className="font-mono font-bold text-right"
                  style={{
                    fontSize: 12,
                    color: zero ? "color-mix(in srgb, var(--franco-text) 40%, transparent)" : "#C8323C",
                  }}
                >
                  {zero ? fmt(0) : `−${fmt(it.value)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CAJA RESULTADO */}
      <div
        className="mt-4 grid items-center gap-3"
        style={{
          gridTemplateColumns: "1fr auto",
          background: isNeg
            ? "color-mix(in srgb, #C8323C 10%, var(--franco-card))"
            : "color-mix(in srgb, #B0BEC5 10%, var(--franco-card))",
          border: `1px solid color-mix(in srgb, ${resultColor} 40%, transparent)`,
          borderLeft: `3px solid ${resultColor}`,
          borderRadius: "0 8px 8px 0",
          padding: "14px 16px",
        }}
      >
        <div>
          <p
            className="font-mono uppercase font-semibold m-0"
            style={{ fontSize: 10, letterSpacing: "2px", color: resultColor }}
          >
            = {resultLabel}
          </p>
          <p
            className="font-heading italic m-0 mt-1"
            style={{ fontSize: 11, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)" }}
          >
            {resultSub}
          </p>
        </div>
        <p
          className="font-mono font-bold m-0 text-right"
          style={{ fontSize: 28, color: resultColor, lineHeight: 1 }}
        >
          {isNeg ? "−" : "+"}{fmt(Math.abs(flujo))}
        </p>
      </div>

      <StateBox
        variant="left-border"
        state="info"
        label={data.cajaLabel || "Hazte esta pregunta:"}
        className="mt-5"
      >
        {currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf}
      </StateBox>
    </div>
  );
}

// ─── Negociación drawer ─────────────────────────────
function parseUF(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/[\d.,]+/);
  if (!m) return 0;
  const clean = m[0].replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function DrawerNegociacion({
  data,
  currency,
  inputData,
  results,
}: {
  data: AINegociacionSection;
  currency: "CLP" | "UF";
  inputData: AnalisisInput;
  results: FullAnalysisResult;
}) {
  const listaUF = inputData.precio || 0;
  const listaFmt = `UF ${listaUF.toLocaleString("es-CL")}`;
  const sugeridoRaw = data.precioSugerido || listaFmt;
  const sugeridoUF = parseUF(sugeridoRaw) || listaUF;

  // Use motor's precioFlujoNeutroUF when available; hide the "paga solo" dot if it
  // isn't meaningful (≥ sugerido, too close, or non-positive).
  const pagaSoloRaw = results.metrics?.precioFlujoNeutroUF ?? 0;
  const pagaSoloUF = pagaSoloRaw > 0 ? Math.round(pagaSoloRaw) : 0;
  const showPagaSolo = pagaSoloUF > 0 && pagaSoloUF < sugeridoUF - 50 && pagaSoloUF < listaUF - 50;
  const pagaSoloFmt = `UF ${pagaSoloUF.toLocaleString("es-CL")}`;

  // Position the 3 (or 2) dots on the bar.
  // With paga-solo: paga-solo=14%, lista=86%, sugerido interpolated in between.
  // Without: sugerido=30%, lista=80%.
  const posPagaSolo = 14;
  const posLista = 86;
  const range = Math.max(listaUF - (showPagaSolo ? pagaSoloUF : 0), 1);
  const posSugeridoRaw = showPagaSolo
    ? posPagaSolo + ((sugeridoUF - pagaSoloUF) / range) * (posLista - posPagaSolo)
    : 30 + ((sugeridoUF / listaUF) * (posLista - 30));
  const posSugerido = Math.min(Math.max(posSugeridoRaw, (showPagaSolo ? posPagaSolo + 10 : 22)), posLista - 10);

  const guion = currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf;

  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!guion) return;
    navigator.clipboard.writeText(guion).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {/* ignore */});
  };

  return (
    <div>
      <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-5 whitespace-pre-wrap">
        {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
      </p>

      {/* Horizontal bar with up to 3 dots */}
      {(() => {
        // Build the list of dots (skip paga-solo when motor data isn't meaningful).
        type DotSpec = {
          key: string;
          pos: number;
          valueFmt: string;
          labelText: string;
          color: string;
          valueTop: number;  // px offset for value label above the dot
          fontSize: number;  // px
        };
        const raw: DotSpec[] = [];
        if (showPagaSolo) {
          raw.push({ key: "pagaSolo", pos: posPagaSolo, valueFmt: pagaSoloFmt, labelText: "Se paga solo", color: "#B0BEC5", valueTop: 0, fontSize: 11 });
        }
        raw.push({ key: "sugerido", pos: posSugerido, valueFmt: sugeridoRaw, labelText: "Sugerido", color: "#FBBF24", valueTop: 0, fontSize: 11 });
        raw.push({ key: "lista", pos: posLista, valueFmt: listaFmt, labelText: "Lista", color: "#C8323C", valueTop: 0, fontSize: 11 });

        // Anti-overlap pass: if two adjacent dots are closer than ~10% of the bar,
        // stack the earlier value higher and shrink both fonts so they breathe.
        raw.sort((a, b) => a.pos - b.pos);
        const MIN_GAP_PCT = 10;
        for (let i = 1; i < raw.length; i++) {
          const prev = raw[i - 1];
          const curr = raw[i];
          if (curr.pos - prev.pos < MIN_GAP_PCT) {
            prev.valueTop = -14;
            curr.valueTop = 4;
            prev.fontSize = 9;
            curr.fontSize = 9;
          }
        }

        return (
          <div className="relative h-[82px] my-6">
            <div
              className="absolute top-[38px] left-0 right-0 h-[6px] rounded-[3px]"
              style={{
                background: "linear-gradient(to right, rgba(176,190,197,0.5), rgba(251,191,36,0.5) 50%, rgba(200,50,60,0.5))",
              }}
            />
            {raw.map((d) => (
              <div key={d.key}>
                {/* Dot */}
                <div className="absolute top-[28px]" style={{ left: `${d.pos}%`, transform: "translateX(-50%)" }}>
                  <div
                    className="w-[26px] h-[26px] rounded-full bg-[var(--franco-card)]"
                    style={{ border: `2.5px solid ${d.color}` }}
                  />
                </div>
                {/* Value */}
                <span
                  className="absolute font-mono font-bold whitespace-nowrap"
                  style={{
                    left: `${d.pos}%`,
                    top: `${d.valueTop}px`,
                    transform: "translateX(-50%)",
                    color: d.color,
                    fontSize: `${d.fontSize}px`,
                  }}
                >
                  {d.valueFmt}
                </span>
                {/* Label under the dot */}
                <span
                  className="absolute top-[62px] font-mono text-[9px] uppercase tracking-[1px] whitespace-nowrap"
                  style={{ left: `${d.pos}%`, transform: "translateX(-50%)", color: d.color }}
                >
                  {d.labelText}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Guión box — neutral left-border */}
      <div
        className="mt-6 p-4 rounded-r-lg"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-2 font-semibold m-0">
          {data.cajaLabel || "Guión para la contraoferta:"}
        </p>
        <p className="font-heading italic text-[13px] leading-[1.6] text-[var(--franco-text)] m-0">
          {guion}
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-3 font-mono text-[9px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] bg-[var(--franco-bar-track)] hover:bg-[var(--franco-border)] border border-[var(--franco-border)] px-2.5 py-1.5 rounded transition-colors"
        >
          {copied ? "✓ Copiado" : "⧉ Copiar guion"}
        </button>
      </div>
    </div>
  );
}

// ─── Largo plazo drawer ─────────────────────────────
function DrawerLargoPlazo({
  data,
  currency,
  results,
  valorUF,
}: {
  data: AISection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  valorUF: number;
}) {
  const exit = results.exitScenario;
  const pieCLP = results.metrics?.pieCLP ?? 0;
  const precioCLP = results.metrics?.precioCLP ?? 0;
  const valorVenta = exit?.valorVenta ?? 0;
  const saldoCredito = exit?.saldoCredito ?? 0;
  const comisionVenta = exit?.comisionVenta ?? 0;
  const gananciaNeta = exit?.gananciaNeta ?? 0; // valorVenta − saldoCredito − comisionVenta

  // Fallbacks para análisis guardados antes del cambio del motor.
  const aniosPlazo = exit?.anios ?? 10;
  const projs = results.projections ?? [];
  const flujoMensualAcumFallback = projs
    .slice(0, aniosPlazo)
    .filter((p) => p.flujoAnual < 0)
    .reduce((s, p) => s + Math.abs(p.flujoAnual), 0);

  const inversionInicial = exit?.inversionInicial ?? (pieCLP + Math.round(precioCLP * 0.02));
  const flujoMensualAcum = exit?.flujoMensualAcumuladoNegativo ?? flujoMensualAcumFallback;
  const totalAportado = exit?.totalAportado ?? (inversionInicial + flujoMensualAcum);
  const gananciaSobreTotal = exit?.gananciaSobreTotal ?? (gananciaNeta - totalAportado);
  const pctSobreTotal = exit?.porcentajeGananciaSobreTotal
    ?? (totalAportado > 0 ? (gananciaSobreTotal / totalAportado) * 100 : 0);

  const plazoMeses = aniosPlazo * 12;
  const aporteMensualPromedio = plazoMeses > 0 ? flujoMensualAcum / plazoMeses : 0;

  // Helpers de formato
  const fmtFull = (v: number) => {
    if (currency === "CLP") return "$" + Math.round(v).toLocaleString("es-CL");
    const uf = valorUF > 0 ? v / valorUF : 0;
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  };
  const fmtShort = (v: number) => fmtCompact(v, currency, valorUF);

  const esPositiva = gananciaSobreTotal >= 0;
  const colorAccent = esPositiva ? "#B0BEC5" : "#C8323C";

  // Bloque 3: waterfall matemáticamente exacto.
  // valorVenta − saldoCredito − comisionVenta === gananciaNeta (por definición del motor).
  const maxEjeB3 = Math.max(valorVenta, 1) * 1.05;
  const pctB3 = (v: number) => (maxEjeB3 > 0 ? (v / maxEjeB3) * 100 : 0);

  const b3Rows = [
    {
      key: "depto",
      label: "Depto valorizado",
      sub: `precio + plusvalía ${aniosPlazo}a`,
      value: valorVenta,
      fmtValue: "+" + fmtShort(valorVenta),
      fillLeft: 0,
      fillWidth: pctB3(valorVenta),
      fillColor: "color-mix(in srgb, var(--franco-text) 40%, transparent)",
      fillTextColor: "var(--franco-card)",
      valueColor: "var(--franco-text)",
      isNeg: false,
    },
    {
      key: "deuda",
      label: "− Deuda pendiente",
      sub: "saldo del crédito",
      value: saldoCredito,
      fmtValue: "−" + fmtShort(saldoCredito),
      fillLeft: pctB3(valorVenta - saldoCredito),
      fillWidth: pctB3(saldoCredito),
      fillColor: "#C8323C",
      fillTextColor: "#FAFAF8",
      valueColor: "#C8323C",
      isNeg: true,
    },
    {
      key: "comision",
      label: "− Comisión venta",
      sub: "2% sobre precio de venta",
      value: comisionVenta,
      fmtValue: "−" + fmtShort(comisionVenta),
      fillLeft: pctB3(valorVenta - saldoCredito - comisionVenta),
      fillWidth: pctB3(comisionVenta),
      fillColor: "#C8323C",
      fillTextColor: "#FAFAF8",
      valueColor: "#C8323C",
      isNeg: true,
    },
  ];
  const b3Total = {
    key: "total",
    label: "= Al vender recibes",
    sub: "patrimonio neto",
    value: gananciaNeta,
    fmtValue: fmtFull(gananciaNeta),
    fillLeft: 0,
    fillWidth: pctB3(gananciaNeta),
    fillColor: "color-mix(in srgb, #B0BEC5 40%, var(--franco-card))",
    fillTextColor: "var(--franco-text)",
    valueColor: "#B0BEC5",
    isNeg: false,
  };

  // Header del bloque 3 incluye el monto patrimonio abreviado
  const headerMonto = fmtShort(gananciaNeta);

  // Copy narrativo (templates estilo brand-voice)
  const b1Intro = `Si vendes en el año ${aniosPlazo}, tu ganancia neta es`;
  const b1Contexto = `Sale de la diferencia entre los ${fmtShort(gananciaNeta)} que recibes al vender y los ${fmtShort(totalAportado)} que aportaste en total.`;
  const b2Intro = `La plata que tienes que poner durante los ${aniosPlazo} años de tenencia.`;
  const b3Intro = "El depto valorizado menos lo que debes al banco y los gastos de venta.";

  // Común: render de una fila de waterfall B3
  const renderB3Row = (r: typeof b3Rows[number] | typeof b3Total, isTotal: boolean) => {
    const height = isTotal ? 30 : 24;
    const border = isTotal ? "1px solid #B0BEC5" : "none";
    return (
      <div
        key={r.key}
        className="grid items-center gap-3"
        style={{ gridTemplateColumns: "130px 1fr 92px" }}
        role="img"
        aria-label={`${r.label} ${r.fmtValue}`}
      >
        <div className="flex flex-col gap-[1px]">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "1px",
              color: "color-mix(in srgb, var(--franco-text) 85%, transparent)",
              fontWeight: 500,
            }}
          >
            {r.label}
          </span>
          <span
            className="font-heading italic"
            style={{ fontSize: 10, color: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }}
          >
            {r.sub}
          </span>
        </div>
        <div
          className="relative rounded-[3px]"
          style={{
            height,
            background: isTotal
              ? "color-mix(in srgb, #B0BEC5 8%, transparent)"
              : "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            overflow: "visible",
          }}
        >
          {r.fillWidth > 0 && (
            <div
              className="absolute top-0 rounded-[3px] flex items-center"
              style={{
                left: `${r.fillLeft}%`,
                width: `${r.fillWidth}%`,
                height: "100%",
                background: r.fillColor,
                border,
                paddingLeft: 8,
                paddingRight: 8,
              }}
            >
              {r.fillWidth >= 8 && (
                <span
                  className="font-mono font-bold whitespace-nowrap"
                  style={{ fontSize: isTotal ? 12 : 11, color: r.fillTextColor }}
                >
                  {isTotal ? r.fmtValue : fmtShort(r.value)}
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className="font-mono font-bold text-right whitespace-nowrap"
          style={{
            fontSize: isTotal ? 14 : 12,
            color: r.valueColor,
          }}
        >
          {r.fmtValue}
        </span>
      </div>
    );
  };

  // Label de bloque "N DE 3"
  const blockBadge = (n: number) => (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: 10,
        letterSpacing: "1.5px",
        color: "color-mix(in srgb, var(--franco-text) 45%, transparent)",
      }}
    >
      {n} de 3
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ─── BLOQUE 1 · EL VEREDICTO ─────────────────── */}
      <div
        style={{
          background: `color-mix(in srgb, ${colorAccent} 6%, var(--franco-card))`,
          border: `0.5px solid color-mix(in srgb, ${colorAccent} 25%, transparent)`,
          borderLeft: `3px solid ${colorAccent}`,
          borderRadius: "0 10px 10px 0",
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: colorAccent, fontWeight: 600 }}
          >
            El veredicto
          </span>
          {blockBadge(1)}
        </div>

        <p
          className="font-body m-0"
          style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.5 }}
        >
          {b1Intro}
        </p>

        <p
          className="font-mono font-bold m-0 whitespace-nowrap text-[32px] sm:text-[40px]"
          style={{ color: colorAccent, lineHeight: 1, marginTop: 8 }}
        >
          {esPositiva ? "+" : "−"}{fmtFull(Math.abs(gananciaSobreTotal))}
        </p>

        <p
          className="font-mono font-bold m-0"
          style={{ fontSize: 14, color: colorAccent, marginTop: 6 }}
        >
          {esPositiva ? "+" : "−"}{Math.round(Math.abs(pctSobreTotal))}% sobre lo que pusiste
        </p>

        <p
          className="font-body m-0"
          style={{
            fontSize: 12,
            color: "color-mix(in srgb, var(--franco-text) 60%, transparent)",
            lineHeight: 1.6,
            marginTop: 12,
          }}
        >
          {b1Contexto}
        </p>
      </div>

      {/* ─── BLOQUE 2 · TU ESFUERZO TOTAL ─────────────── */}
      <div
        style={{
          background: "color-mix(in srgb, var(--franco-text) 2%, var(--franco-card))",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
          borderRadius: 10,
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "var(--franco-text)", fontWeight: 600 }}
          >
            Tu esfuerzo total
          </span>
          {blockBadge(2)}
        </div>

        <p
          className="font-body m-0 mb-3"
          style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.5 }}
        >
          {b2Intro}
        </p>

        <div className="flex flex-col gap-2">
          {/* Fila 1 — Día 1 */}
          <div className="grid items-baseline gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
            <div className="flex flex-col">
              <span
                className="font-body"
                style={{ fontSize: 13, color: "var(--franco-text)" }}
              >
                Día 1 (pie + cierre)
              </span>
              <span
                className="font-heading italic"
                style={{ fontSize: 11, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
              >
                pago al notario, CBR, timbres
              </span>
            </div>
            <span
              className="font-mono font-semibold whitespace-nowrap"
              style={{ fontSize: 14, color: "var(--franco-text)" }}
            >
              {fmtFull(inversionInicial)}
            </span>
          </div>

          {/* Fila 2 — Aporte mensual */}
          <div className="grid items-baseline gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
            <div className="flex flex-col">
              <span
                className="font-body"
                style={{ fontSize: 13, color: "var(--franco-text)" }}
              >
                + Aporte mensual × {aniosPlazo} años
              </span>
              <span
                className="font-heading italic"
                style={{ fontSize: 11, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
              >
                ~{fmtShort(aporteMensualPromedio)} × {plazoMeses} meses (asciende con UF)
              </span>
            </div>
            <span
              className="font-mono font-semibold whitespace-nowrap"
              style={{ fontSize: 14, color: "var(--franco-text)" }}
            >
              {fmtFull(flujoMensualAcum)}
            </span>
          </div>

          {/* Separador + total */}
          <div
            style={{
              borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 20%, transparent)",
              marginTop: 6,
              paddingTop: 10,
            }}
          >
            <div className="grid items-baseline gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: "1px", color: "var(--franco-text)", fontWeight: 600 }}
              >
                = Total aportado
              </span>
              <span
                className="font-mono font-bold whitespace-nowrap"
                style={{ fontSize: 18, color: "var(--franco-text)" }}
              >
                {fmtFull(totalAportado)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BLOQUE 3 · DE DÓNDE SALEN LOS $N ─────────── */}
      <div
        style={{
          background: "color-mix(in srgb, var(--franco-text) 2%, var(--franco-card))",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 8%, transparent)",
          borderRadius: 10,
          padding: "18px 20px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "1.5px", color: "#FBBF24", fontWeight: 600 }}
          >
            De dónde salen los {headerMonto}
          </span>
          {blockBadge(3)}
        </div>

        <p
          className="font-body m-0 mb-3"
          style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.5 }}
        >
          {b3Intro}
        </p>

        <div className="flex flex-col gap-2">
          {b3Rows.map((r) => renderB3Row(r, false))}

          {/* Separador + total */}
          <div
            className="pt-2 mt-1"
            style={{ borderTop: "0.5px dashed color-mix(in srgb, #B0BEC5 30%, transparent)" }}
          >
            {renderB3Row(b3Total, true)}
          </div>
        </div>

        {/* Eje */}
        <div
          className="flex justify-between mt-2"
          style={{ paddingLeft: 142, paddingRight: 104 }}
        >
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }}
          >
            {currency === "CLP" ? "$0" : "UF 0"}
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "color-mix(in srgb, var(--franco-text) 50%, transparent)" }}
          >
            {fmtShort(maxEjeB3)}
          </span>
        </div>
      </div>

      {/* ─── La apuesta que haces (narrativa IA editorial) ─── */}
      <StateBox
        variant="left-border"
        state="info"
        label={data.cajaLabel || "La apuesta que haces:"}
        className="mt-1"
      >
        {currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf}
      </StateBox>
    </div>
  );
}

// ─── Riesgos drawer ─────────────────────────────────
function extractRiesgos(
  content: string
): { titulo: string; descripcion: string }[] {
  if (!content || typeof content !== "string") return [];
  // Split markdown bold segments like "**Titulo.** resto..."
  // Strategy: find matches of `**...**` and take that as title, then text until next `**`.
  const boldMatches = Array.from(content.matchAll(/\*\*([^*]+)\*\*/g));
  if (boldMatches.length >= 2) {
    const results: { titulo: string; descripcion: string }[] = [];
    for (let i = 0; i < boldMatches.length; i++) {
      const match = boldMatches[i];
      const titleRaw = match[1].trim().replace(/[.:]$/, "");
      const start = match.index! + match[0].length;
      const end = i + 1 < boldMatches.length ? boldMatches[i + 1].index! : content.length;
      const desc = content.slice(start, end).trim();
      if (desc.length > 10) {
        results.push({ titulo: titleRaw, descripcion: desc.slice(0, 220) });
      }
    }
    if (results.length > 0) return results.slice(0, 3);
  }

  // Fallback: split by double newline or numbered list
  const blocks = content
    .split(/\n\s*\n|\n\s*(?:\d+\.|•|·|-)\s+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  return blocks.slice(0, 3).map((block, i) => {
    const firstSentence = block.split(/[.:]/)[0];
    const titulo = firstSentence.trim().slice(0, 60) || `Riesgo ${i + 1}`;
    const descripcion = block.replace(firstSentence, "").replace(/^[.:]\s*/, "").trim().slice(0, 220) || block.slice(0, 220);
    return { titulo, descripcion };
  });
}

function DrawerRiesgos({
  data,
  currency,
}: {
  data: AISection;
  currency: "CLP" | "UF";
}) {
  const content = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
  const riesgos = useMemo(() => {
    const parsed = extractRiesgos(content);
    if (parsed.length > 0) return parsed;
    return [
      { titulo: "Subida de tasas", descripcion: "Si las tasas suben, tu dividendo mensual aumenta y el flujo empeora." },
      { titulo: "Vacancia prolongada", descripcion: "Si el depto queda sin arrendatario, asumes todos los costos sin ingreso." },
      { titulo: "Plusvalía inferior", descripcion: "Si la zona no crece al ritmo histórico, tu ganancia a 10 años baja." },
    ];
  }, [content]);

  return (
    <div>
      <p className="font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-4 m-0">
        Toda inversión tiene flancos. Los más relevantes para este depto:
      </p>

      <div className="flex flex-col gap-2.5 my-4">
        {riesgos.map((r, i) => (
          <div
            key={i}
            className="rounded-r-lg p-3"
            style={{
              borderLeft: "3px solid #FBBF24",
              background: "color-mix(in srgb, #FBBF24 6%, transparent)",
              border: "0.5px solid color-mix(in srgb, #FBBF24 25%, transparent)",
              borderLeftWidth: "3px",
            }}
          >
            <h4 className="font-body font-semibold text-[13px] mb-1 m-0" style={{ color: "#FBBF24" }}>
              {r.titulo}
            </h4>
            <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 leading-[1.45]">
              {r.descripcion}
            </p>
          </div>
        ))}
      </div>

      <StateBox
        variant="left-border"
        state="warning"
        label={data.cajaLabel || "Si decides avanzar, protege estos flancos:"}
        className="mt-5"
      >
        {currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf}
      </StateBox>
    </div>
  );
}

// ─── Main drawer ────────────────────────────────────
function ZoneSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 rounded-[8px] animate-pulse" style={{ background: "var(--franco-bar-track)" }} />
      <div className="h-[280px] rounded-[10px] animate-pulse" style={{ background: "var(--franco-bar-track)" }} />
      <div className="h-40 rounded-[6px] animate-pulse" style={{ background: "var(--franco-bar-track)" }} />
      <div className="h-28 rounded-[8px] animate-pulse" style={{ background: "var(--franco-bar-track)" }} />
    </div>
  );
}

function ZoneErrorState({ message }: { message: string | null }) {
  return (
    <div
      className="rounded-[8px] p-8 text-center"
      style={{
        background: "var(--franco-bar-track)",
        border: "0.5px solid var(--franco-border)",
      }}
    >
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 mb-3">
        No pudimos cargar el análisis de la zona.{message ? ` (${message})` : ""}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#C8323C] hover:underline"
      >
        Reintentar
      </button>
    </div>
  );
}

function DrawerZona({
  zoneInsight,
  zoneLoading,
  zoneError,
  zoneCenter,
  currency,
  comuna,
  arriendoUsuarioCLP,
  valorUF,
}: {
  zoneInsight?: ZoneInsightData | null;
  zoneLoading?: boolean;
  zoneError?: string | null;
  zoneCenter?: { lat: number; lng: number } | null;
  currency: "CLP" | "UF";
  comuna: string;
  arriendoUsuarioCLP: number;
  valorUF: number;
}) {
  if (zoneLoading && !zoneInsight) return <ZoneSkeleton />;
  if (zoneError && !zoneInsight) return <ZoneErrorState message={zoneError} />;
  if (!zoneInsight) return <ZoneErrorState message={null} />;

  return (
    <div className="flex flex-col gap-5">
      <ZoneInsightAI insight={zoneInsight.insight} currency={currency} />
      <ZoneStatsCards
        stats={zoneInsight.stats}
        currency={currency}
        comuna={comuna}
        arriendoUsuarioCLP={arriendoUsuarioCLP}
        valorUF={valorUF}
      />
      {zoneCenter && (
        <ZoneMap
          centerLat={zoneCenter.lat}
          centerLng={zoneCenter.lng}
          pois={zoneInsight.pois}
        />
      )}
      <ZonePOIsList pois={zoneInsight.pois} />
    </div>
  );
}

export function AnalysisDrawer({
  activeKey,
  aiAnalysis,
  currency,
  results,
  inputData,
  valorUF,
  onClose,
  onNavigate,
  zoneInsight,
  zoneLoading,
  zoneError,
  zoneCenter,
  comuna,
  arriendoUsuarioCLP,
}: DrawerProps) {
  const meta = DRAWER_META[activeKey];
  // Zone section isn't part of aiAnalysis — use a placeholder pregunta.
  const zonaTitle = "Lo que no ves a simple vista";
  const section =
    activeKey === "zona"
      ? ({ pregunta: zonaTitle } as { pregunta: string })
      : aiAnalysis[activeKey];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && meta.next) onNavigate(meta.next);
      if (e.key === "ArrowLeft" && meta.prev) onNavigate(meta.prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, meta]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="
          fixed z-50 bg-[var(--franco-card)] overflow-y-auto
          md:top-0 md:right-0 md:bottom-0 md:w-[75vw] lg:w-[70vw] xl:w-[min(960px,65vw)] md:border-l md:border-[var(--franco-border)] md:animate-slideInRight
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[85vh] max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--franco-border)] max-md:animate-slideInUp
        "
      >
        <div className="p-5 md:p-6">
          <div className="flex justify-between items-start mb-4 pb-4 border-b border-[var(--franco-border)]">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-1 m-0">
                {meta.num} · {meta.label}
              </p>
              <h2 className="font-heading font-bold text-[18px] md:text-[20px] leading-[1.25] text-[var(--franco-text)] m-0">
                {section.pregunta}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[14px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5 shrink-0"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {activeKey === "costoMensual" && (
            <DrawerCostoMensual
              data={section as AISection}
              currency={currency}
              results={results}
              inputData={inputData}
              valorUF={valorUF}
            />
          )}
          {activeKey === "negociacion" && (
            <DrawerNegociacion
              data={section as AINegociacionSection}
              currency={currency}
              inputData={inputData}
              results={results}
            />
          )}
          {activeKey === "largoPlazo" && (
            <DrawerLargoPlazo
              data={section as AISection}
              currency={currency}
              results={results}
              valorUF={valorUF}
            />
          )}
          {activeKey === "riesgos" && (
            <DrawerRiesgos
              data={section as AISection}
              currency={currency}
            />
          )}
          {activeKey === "zona" && (
            <DrawerZona
              zoneInsight={zoneInsight}
              zoneLoading={zoneLoading}
              zoneError={zoneError}
              zoneCenter={zoneCenter ?? null}
              currency={currency}
              comuna={comuna ?? (inputData.comuna || "tu comuna")}
              arriendoUsuarioCLP={arriendoUsuarioCLP ?? Number(inputData.arriendo) ?? 0}
              valorUF={valorUF}
            />
          )}

          <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-[var(--franco-border)]">
            {meta.prev ? (
              <button
                type="button"
                onClick={() => onNavigate(meta.prev!)}
                className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                ← {DRAWER_META[meta.prev].num} {DRAWER_META[meta.prev].label}
              </button>
            ) : (
              <span />
            )}

            {meta.next ? (
              <button
                type="button"
                onClick={() => onNavigate(meta.next!)}
                className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                {DRAWER_META[meta.next].num} {DRAWER_META[meta.next].label} →
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                Cerrar análisis ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
