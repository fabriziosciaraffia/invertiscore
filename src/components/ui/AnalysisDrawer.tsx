"use client";

import { useEffect, useMemo } from "react";
import type {
  AIAnalysisV2,
  AISection,
  AINegociacionSection,
  FullAnalysisResult,
  AnalisisInput,
} from "@/lib/types";
import { calcFlujoDesglose, tirForPrice } from "@/lib/analysis";
import { InfoTooltip } from "@/components/ui/tooltip";
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
  const saleItems: Array<{ name: string; value: number; tooltip: string }> = [
    {
      name: "Dividendo hipotecario",
      value: desglose.dividendo,
      tooltip: "Cuota mensual del crédito hipotecario (capital + interés).",
    },
    {
      name: "Gastos comunes",
      value: desglose.ggccVacancia,
      tooltip: "Pago mensual a la administración del edificio. Lo paga el arrendatario, pero se considera por períodos de vacancia.",
    },
    {
      name: "Contribuciones",
      value: desglose.contribucionesMes,
      tooltip: "Impuesto territorial trimestral del SII, prorrateado a mensual. Lo paga el propietario.",
    },
    {
      name: "Vacancia",
      value: desglose.vacanciaProrrata,
      tooltip: "Ingreso perdido por meses sin arrendatario. Se prorratea al mes según el % de vacancia configurado.",
    },
    {
      name: "Mantención",
      value: desglose.mantencion,
      tooltip: "Provisión mensual para reparaciones y mantenimiento del depto. Default 0,3-1,5% del precio anual.",
    },
    {
      name: "Corretaje",
      value: desglose.corretajeProrrata,
      tooltip: "Comisión del corredor para captar arrendatario, prorrateada al mes.",
    },
    {
      name: "Recambio",
      value: desglose.recambio,
      tooltip: "Costo de recambios mayores (electrodomésticos, pinturas, refresh) prorrateado al mes.",
    },
    {
      name: "Gestión del arriendo",
      value: desglose.administracion,
      tooltip: "Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario). 0% si autogestionas. Distinto de gastos comunes del edificio.",
    },
  ];
  const maxSale = Math.max(...saleItems.map((s) => s.value), 1);
  const resultLabel = isNeg ? "SALE DE TU BOLSILLO" : "ENTRA A TU BOLSILLO";
  const resultSub = isNeg ? "Tienes que poner este dinero tú" : "Entra cada mes después de cubrir todos los gastos";
  // Bloque conclusivo Patrón 3 — treatment condicional según naturaleza del KPI:
  // - Negativo crítico: wash Signal Red 6% + borderLeft Signal Red + label/KPI Signal Red
  // - Positivo o neutro: wash Ink 3% + borderLeft Ink secundario + label Ink secundario
  //   + KPI Ink primary + sin border outline
  // Regla del sistema (formalizada Fase 4.9 Commit 4): el rojo solo aparece cuando
  // el dato comunica criticidad real. KPIs positivos/neutros usan Ink.
  const blockBg = isNeg
    ? "color-mix(in srgb, var(--signal-red) 6%, transparent)"
    : "color-mix(in srgb, var(--franco-text) 3%, transparent)";
  const blockBorder = isNeg
    ? "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)"
    : "none";
  const blockBorderLeftColor = isNeg ? "var(--signal-red)" : "var(--franco-text-secondary)";
  const blockLabelColor = isNeg ? "var(--signal-red)" : "var(--franco-text-secondary)";
  const blockKPIColor = isNeg ? "var(--signal-red)" : "var(--franco-text)";

  return (
    <div>
      <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-4 whitespace-pre-wrap">
        {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
      </p>

      {/* GRUPO "ENTRA" */}
      <div className="mb-4">
        <div
          className="flex items-baseline justify-between pb-1.5 mb-2"
          style={{ borderBottom: "0.5px solid color-mix(in srgb, var(--ink-400) 35%, transparent)" }}
        >
          <span
            className="font-mono uppercase font-semibold"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--ink-400)" }}
          >
            Entra
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 13, color: "var(--ink-400)" }}
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
              style={{ width: "100%", background: "var(--ink-400)" }}
            />
          </div>
          <span
            className="font-mono font-bold text-right"
            style={{ fontSize: 12, color: "var(--ink-400)" }}
          >
            +{fmt(arriendo)}
          </span>
        </div>
      </div>

      {/* GRUPO "SALE" */}
      <div className="mb-4">
        <div
          className="flex items-baseline justify-between pb-1.5 mb-2"
          style={{ borderBottom: "0.5px solid color-mix(in srgb, var(--signal-red) 35%, transparent)" }}
        >
          <span
            className="font-mono uppercase font-semibold"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--signal-red)" }}
          >
            Sale
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 13, color: "var(--signal-red)" }}
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
                  className="inline-flex items-center gap-1 font-body"
                  style={{
                    fontSize: 12,
                    color: zero
                      ? "color-mix(in srgb, var(--franco-text) 40%, transparent)"
                      : "color-mix(in srgb, var(--franco-text) 82%, transparent)",
                  }}
                >
                  <span>{it.name}</span>
                  <InfoTooltip content={it.tooltip} />
                </span>
                <div
                  className="relative rounded-[2px]"
                  style={{ height: 8, background: "color-mix(in srgb, var(--franco-text) 5%, transparent)" }}
                >
                  <div
                    className="absolute top-0 left-0 h-full rounded-[2px]"
                    style={{ width: `${widthPct}%`, background: "var(--signal-red)", opacity: 0.85 }}
                  />
                </div>
                <span
                  className="font-mono font-bold text-right"
                  style={{
                    fontSize: 12,
                    color: zero ? "color-mix(in srgb, var(--franco-text) 40%, transparent)" : "var(--signal-red)",
                  }}
                >
                  {zero ? fmt(0) : `−${fmt(it.value)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CAJA RESULTADO — bloque conclusivo Patrón 3 condicional pos/neg */}
      <div
        className="mt-4 grid items-center gap-3"
        style={{
          gridTemplateColumns: "1fr auto",
          background: blockBg,
          border: blockBorder,
          borderLeft: `3px solid ${blockBorderLeftColor}`,
          borderRadius: "0 8px 8px 0",
          padding: "14px 16px",
        }}
      >
        <div>
          <p
            className="font-mono uppercase font-semibold m-0"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: blockLabelColor }}
          >
            = {resultLabel}
          </p>
          <p
            className="font-body italic m-0 mt-1"
            style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)" }}
          >
            {resultSub}
          </p>
        </div>
        <p
          className="font-mono font-bold m-0 text-right"
          style={{ fontSize: 24, color: blockKPIColor, lineHeight: 1 }}
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

function DrawerNegociacion({
  data,
  currency,
  inputData,
  results,
  valorUF,
}: {
  data: AINegociacionSection;
  currency: "CLP" | "UF";
  inputData: AnalisisInput;
  results: FullAnalysisResult;
  valorUF: number;
}) {
  const precioCLP = (inputData.precio || 0) * valorUF;
  const vmFrancoUF = results.metrics?.valorMercadoFrancoUF ?? (inputData.precio || 0);
  const vmFrancoCLP = vmFrancoUF * valorUF;

  const diferenciaCLP = vmFrancoCLP - precioCLP;
  const pctDiferencia = vmFrancoCLP > 0 ? (Math.abs(diferenciaCLP) / vmFrancoCLP) * 100 : 0;
  const esPasada = diferenciaCLP > 0 && pctDiferencia > 2;
  const esSobreprecio = diferenciaCLP < 0 && pctDiferencia > 2;

  const tirActual = results.exitScenario?.tir ?? 0;
  const neg = results.negociacion;

  // Fallbacks si el análisis es viejo (sin motor.negociacion): recomputar en el
  // cliente con el mismo helper del motor (fuente única de verdad).
  const negData = useMemo(() => {
    if (neg) return neg;
    const baseSugerido = Math.min(inputData.precio, vmFrancoUF);
    const precioSugUF = Math.round(baseSugerido * 0.97 * 10) / 10;
    const tirSug = tirForPrice(inputData, precioSugUF);
    const tirVm = tirForPrice(inputData, vmFrancoUF);
    // Precio límite por bisección simple solo si la TIR actual es > 6
    let precioLimUF: number | null = null;
    let tirLim: number | null = null;
    if (tirActual > 6) {
      let lo = inputData.precio;
      let hi = Math.max(inputData.precio * 1.5, vmFrancoUF * 1.3);
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const t = tirForPrice(inputData, mid);
        if (t > 6) lo = mid; else hi = mid;
        if (Math.abs(t - 6) < 0.1) {
          precioLimUF = Math.round(mid * 10) / 10;
          tirLim = 6.0;
          break;
        }
      }
      if (precioLimUF === null && hi > lo) {
        precioLimUF = Math.round(((lo + hi) / 2) * 10) / 10;
        tirLim = 6.0;
      }
    }
    return {
      precioSugeridoUF: precioSugUF,
      precioSugeridoCLP: Math.round(precioSugUF * valorUF),
      tirAlSugerido: tirSug,
      precioLimiteUF: precioLimUF,
      precioLimiteCLP: precioLimUF ? Math.round(precioLimUF * valorUF) : null,
      tirAlLimite: tirLim,
      tirAlVmFranco: tirVm,
    };
  }, [neg, inputData, vmFrancoUF, valorUF, tirActual]);

  const precioSugeridoCLP = negData.precioSugeridoCLP;
  const tirAlSugerido = negData.tirAlSugerido;
  const tirAlVmFranco = negData.tirAlVmFranco;
  const precioLimiteCLP = negData.precioLimiteCLP;
  const tirAlLimite = negData.tirAlLimite;

  const fmtFull = (v: number) => {
    if (currency === "CLP") return "$" + Math.round(v).toLocaleString("es-CL");
    const uf = valorUF > 0 ? v / valorUF : 0;
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  };
  const fmtShort = (v: number) => fmtCompact(v, currency, valorUF);
  const fmtTir = (t: number | null | undefined) =>
    typeof t === "number" && !isNaN(t)
      ? t.toFixed(1).replace(".", ",") + "%"
      : "—";
  const tirColor = (t: number | null | undefined) => {
    if (typeof t !== "number" || isNaN(t)) return "color-mix(in srgb, var(--franco-text) 45%, transparent)";
    if (t >= 9) return "var(--ink-400)";
    // TODO(franco-design): rama intermedia 7-9% (antes ámbar) mapeada a Ink 500
    // como "ni positivo ni crítico". Skill colapsa la escala 3-niveles a binaria
    // Ink/Signal Red — la distinción semántica fina TIR aceptable vs TIR aprobada
    // se pierde. Evaluar si recuperarla por composición (peso/border) en futura ronda.
    if (t >= 7) return "var(--ink-500)";
    return "var(--signal-red)";
  };

  // Veredicto styling
  let veredictoLabel: string;
  let veredictoDesc: string;
  let veredictoColor: string;
  let veredictoMonto: string;
  let veredictoSub: string;
  if (esPasada) {
    veredictoLabel = "Ventaja de compra";
    veredictoDesc = `Estás pagando ${fmtShort(precioCLP)} por algo que vale ${fmtShort(vmFrancoCLP)}`;
    veredictoMonto = "+" + fmtFull(diferenciaCLP);
    veredictoSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% bajo mercado`;
    veredictoColor = "var(--ink-400)";
  } else if (esSobreprecio) {
    veredictoLabel = "Sobreprecio";
    veredictoDesc = `Estás pagando ${fmtShort(precioCLP)} por algo que vale ${fmtShort(vmFrancoCLP)}`;
    veredictoMonto = "−" + fmtFull(Math.abs(diferenciaCLP));
    veredictoSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% sobre mercado`;
    veredictoColor = "var(--signal-red)";
  } else {
    veredictoLabel = "Precio alineado";
    veredictoDesc = `El precio está cerca del valor real de mercado`;
    veredictoMonto = "≈ " + fmtFull(0);
    veredictoSub = "Alineado con el mercado";
    veredictoColor = "color-mix(in srgb, var(--franco-text) 75%, transparent)";
  }

  // Estrategia: ahora viene de la IA (estrategiaSugerida_clp/_uf). Para análisis
  // viejos sin el campo se muestra un fallback neutro.
  const estrategiaIA = currency === "UF"
    ? data.estrategiaSugerida_uf
    : data.estrategiaSugerida_clp;
  const estrategia = estrategiaIA?.trim()
    || "Intenta cerrar en el precio sugerido. Si el corredor no cede, evalúa según tu veredicto base.";

  // Tabla comparativa: 4 filas
  const maxPrecio = Math.max(precioCLP, vmFrancoCLP, precioSugeridoCLP, precioLimiteCLP ?? 0) * 1.05;
  const barW = (v: number) => (maxPrecio > 0 ? (v / maxPrecio) * 100 : 0);

  const filas = [
    {
      key: "tu",
      nombre: "Tu precio",
      sub: "lo que pide el corredor",
      precio: precioCLP,
      tir: tirActual,
      barColor: "rgba(250,250,248,0.55)",
      highlight: false,
    },
    {
      key: "vm",
      nombre: "vmFranco",
      sub: "valor real de mercado",
      precio: vmFrancoCLP,
      tir: tirAlVmFranco ?? tirActual,
      barColor: "var(--ink-400)",
      highlight: false,
    },
    {
      key: "sug",
      nombre: "⭐ Sugerido",
      sub: "cierra acá si puedes",
      precio: precioSugeridoCLP,
      tir: tirAlSugerido,
      barColor: "var(--franco-text)",
      highlight: true,
    },
    {
      key: "lim",
      nombre: "Límite",
      sub: precioLimiteCLP === null ? "tu precio ya rinde bajo 6%" : "máximo que conviene pagar",
      precio: precioLimiteCLP,
      tir: tirAlLimite,
      barColor: "var(--signal-red)",
      highlight: false,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* BLOQUE A · HERO VEREDICTO — bloque conclusivo Patrón 3 condicional */}
      {/* Regla pos/neg formalizada Fase 4.9 Commit 4:
          - esSobreprecio (KPI negativo crítico): wash Signal Red 6% + borderLeft
            Signal Red + label/KPI Signal Red
          - esPasada (Ventaja, KPI positivo) o alineado (neutro): wash Ink 3% +
            borderLeft Ink secundario + label Ink secundario + KPI Ink primary
            + sin border outline
          Sub-KPI veredictoSub mantiene veredictoColor (existing logic) per scope. */}
      <div
        style={{
          background: esSobreprecio
            ? "color-mix(in srgb, var(--signal-red) 6%, var(--franco-card))"
            : "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          border: esSobreprecio
            ? "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)"
            : "none",
          borderLeft: `3px solid ${esSobreprecio ? "var(--signal-red)" : "var(--franco-text-secondary)"}`,
          borderRadius: "0 8px 8px 0",
          padding: "18px 20px",
        }}
      >
        <span
          className="font-mono uppercase block mb-2"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: esSobreprecio ? "var(--signal-red)" : "var(--franco-text-secondary)",
            fontWeight: 600,
          }}
        >
          {veredictoLabel}
        </span>
        <p
          className="font-heading m-0 mb-3"
          style={{ fontSize: 14, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)", lineHeight: 1.5 }}
        >
          {veredictoDesc}
        </p>
        <p
          className="font-mono font-bold m-0 whitespace-nowrap"
          style={{
            fontSize: 24,
            color: esSobreprecio ? "var(--signal-red)" : "var(--franco-text)",
            lineHeight: 1,
          }}
        >
          {veredictoMonto}
        </p>
        <p
          className="font-mono font-bold m-0 mt-1"
          style={{ fontSize: 12, color: veredictoColor }}
        >
          {veredictoSub}
        </p>
      </div>

      {/* BLOQUE B · TABLA COMPARATIVA */}
      <div
        style={{
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 10%, transparent)",
          borderRadius: 10,
          padding: "16px 18px",
        }}
      >
        <p
          className="font-mono uppercase m-0 mb-3"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "color-mix(in srgb, var(--franco-text) 55%, transparent)", fontWeight: 600 }}
        >
          Comparativa de precios
        </p>

        {/* Header de columnas — solo desktop (mobile muestra precio+tir apilados) */}
        <div
          className="hidden sm:grid items-center gap-3 pb-2 mb-1 font-mono uppercase"
          style={{
            gridTemplateColumns: "140px 1fr 90px 60px",
            fontSize: 9,
            letterSpacing: "0.06em",
            color: "color-mix(in srgb, var(--franco-text) 45%, transparent)",
            borderBottom: "0.5px dashed color-mix(in srgb, var(--franco-text) 15%, transparent)",
          }}
        >
          <span></span>
          <span></span>
          <span className="text-right">Precio</span>
          <span className="text-right">TIR</span>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          {filas.map((f) => {
            const isNull = f.precio === null;
            const rowBg = f.highlight ? "color-mix(in srgb, var(--franco-text) 4%, transparent)" : "transparent";
            const rowBorder = f.highlight ? "0.5px solid color-mix(in srgb, var(--franco-text) 15%, transparent)" : "0.5px solid transparent";
            return (
              <div
                key={f.key}
                className="rounded py-1.5 px-2"
                style={{ background: rowBg, border: rowBorder }}
              >
                {/* Desktop: 4 columnas */}
                <div
                  className="hidden sm:grid items-center gap-3"
                  style={{ gridTemplateColumns: "140px 1fr 90px 60px" }}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-body font-medium truncate"
                      style={{ fontSize: 13, color: "var(--franco-text)" }}
                    >
                      {f.nombre}
                    </span>
                    <span
                      className="font-heading italic truncate"
                      style={{ fontSize: 10, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
                    >
                      {f.sub}
                    </span>
                  </div>
                  <div
                    className="relative rounded-[3px]"
                    style={{
                      height: 14,
                      background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
                    }}
                  >
                    {!isNull && f.precio !== null && (
                      <div
                        className="absolute top-0 left-0 rounded-[3px]"
                        style={{
                          width: `${barW(f.precio)}%`,
                          height: "100%",
                          background: f.barColor,
                        }}
                      />
                    )}
                  </div>
                  <span
                    className="font-mono font-semibold text-right whitespace-nowrap"
                    style={{
                      fontSize: 12,
                      color: isNull ? "color-mix(in srgb, var(--franco-text) 45%, transparent)" : "var(--franco-text)",
                    }}
                  >
                    {isNull ? "—" : fmtShort(f.precio as number)}
                  </span>
                  <span
                    className="font-mono font-bold text-right whitespace-nowrap"
                    style={{ fontSize: 12, color: tirColor(f.tir) }}
                  >
                    {fmtTir(f.tir)}
                  </span>
                </div>

                {/* Mobile: 2 columnas, sin barra, precio+TIR apilados a la derecha */}
                <div className="flex sm:hidden items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="font-body font-medium truncate"
                      style={{ fontSize: 13, color: "var(--franco-text)" }}
                    >
                      {f.nombre}
                    </span>
                    <span
                      className="font-heading italic truncate"
                      style={{ fontSize: 10, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
                    >
                      {f.sub}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      className="font-mono font-semibold whitespace-nowrap"
                      style={{
                        fontSize: 14,
                        color: isNull ? "color-mix(in srgb, var(--franco-text) 45%, transparent)" : "var(--franco-text)",
                      }}
                    >
                      {isNull ? "—" : fmtShort(f.precio as number)}
                    </span>
                    <span
                      className="font-mono font-bold whitespace-nowrap"
                      style={{ fontSize: 12, color: tirColor(f.tir) }}
                    >
                      {fmtTir(f.tir)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOQUE C · ESTRATEGIA */}
      <div
        style={{
          background: "color-mix(in srgb, var(--signal-red) 6%, var(--franco-card))",
          border: "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)",
          borderLeft: "3px solid var(--signal-red)",
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
        }}
      >
        <p
          className="font-mono uppercase m-0 mb-2"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--signal-red)", fontWeight: 600 }}
        >
          Estrategia sugerida
        </p>
        <p
          className="font-body italic m-0"
          style={{ fontSize: 13, color: "var(--franco-text)", lineHeight: 1.6 }}
        >
          {estrategia}
        </p>
      </div>

      {/* data.cajaAccionable (IA) si existe — mantener el guión editorial */}
      {(currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf) && (
        <StateBox
          variant="left-border"
          state="neutral"
          label={data.cajaLabel || "Guión para la contraoferta:"}
        >
          {currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf}
        </StateBox>
      )}
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
  const colorAccent = esPositiva ? "var(--ink-400)" : "var(--signal-red)";

  // Bloque 3: waterfall con pasada/sobreprecio explícito.
  // precio + pasada/−sobreprecio + plusvalía − deuda − comisión === gananciaNeta
  const vmFrancoUF = results.metrics?.valorMercadoFrancoUF ?? 0;
  const vmFrancoCLP = vmFrancoUF > 0 ? vmFrancoUF * valorUF : precioCLP;
  const diferenciaCLP = vmFrancoCLP - precioCLP;
  const pctDiferencia = vmFrancoCLP > 0 ? (Math.abs(diferenciaCLP) / vmFrancoCLP) * 100 : 0;
  const esPasada = diferenciaCLP > 0 && pctDiferencia > 2;
  const esSobreprecio = diferenciaCLP < 0 && pctDiferencia > 2;
  const plusvaliaCalc = Math.max(valorVenta - vmFrancoCLP, 0);

  const maxEjeB3 = Math.max(valorVenta, precioCLP, 1) * 1.05;
  const pctB3 = (v: number) => (maxEjeB3 > 0 ? (v / maxEjeB3) * 100 : 0);

  const b3Rows: Array<{
    key: string;
    label: string;
    sub: string;
    value: number;
    fmtValue: string;
    fillLeft: number;
    fillWidth: number;
    fillColor: string;
    fillTextColor: string;
    valueColor: string;
    isNeg: boolean;
  }> = [];

  // 1. Precio que pagaste
  b3Rows.push({
    key: "precio",
    label: "Precio que pagaste",
    sub: "lo que sale de tu crédito + pie",
    value: precioCLP,
    fmtValue: "+" + fmtShort(precioCLP),
    fillLeft: 0,
    fillWidth: pctB3(precioCLP),
    fillColor: "rgba(250,250,248,0.45)",
    fillTextColor: "var(--ink-900)",
    valueColor: "var(--franco-text)",
    isNeg: false,
  });

  // 2. Pasada o Sobreprecio (solo si > 2%)
  if (esPasada) {
    b3Rows.push({
      key: "pasada",
      label: "+ Ventaja (día 1)",
      sub: "compraste bajo mercado",
      value: diferenciaCLP,
      fmtValue: "+" + fmtShort(diferenciaCLP),
      fillLeft: pctB3(precioCLP),
      fillWidth: pctB3(diferenciaCLP),
      fillColor: "var(--ink-400)",
      fillTextColor: "var(--ink-900)",
      valueColor: "var(--ink-400)",
      isNeg: false,
    });
  } else if (esSobreprecio) {
    const sobre = Math.abs(diferenciaCLP);
    b3Rows.push({
      key: "sobreprecio",
      label: "− Sobreprecio (día 1)",
      sub: "pagaste sobre mercado",
      value: sobre,
      fmtValue: "−" + fmtShort(sobre),
      fillLeft: pctB3(vmFrancoCLP),
      fillWidth: pctB3(sobre),
      fillColor: "var(--signal-red)",
      fillTextColor: "var(--ink-100)",
      valueColor: "var(--signal-red)",
      isNeg: true,
    });
  }

  // 3. Plusvalía (sobre vmFranco)
  // TODO(franco-design): fillColor migrado a var(--ink-400) (mismo tratamiento
  // que valores positivos). Plusvalía es valor proyectado, no realizado — el
  // skill sugiere diferenciar proyectados con pattern (diagonales) o stroke
  // hatching. Refactor estructural pendiente para futura ronda.
  b3Rows.push({
    key: "plusvalia",
    label: `+ Plusvalía ${aniosPlazo}a`,
    sub: "+4% anual sobre valor real",
    value: plusvaliaCalc,
    fmtValue: "+" + fmtShort(plusvaliaCalc),
    fillLeft: pctB3(vmFrancoCLP),
    fillWidth: pctB3(plusvaliaCalc),
    fillColor: "var(--ink-400)",
    fillTextColor: "var(--ink-900)",
    valueColor: "var(--franco-text)",
    isNeg: false,
  });

  // 4. Deuda
  b3Rows.push({
    key: "deuda",
    label: "− Deuda pendiente",
    sub: "saldo del crédito",
    value: saldoCredito,
    fmtValue: "−" + fmtShort(saldoCredito),
    fillLeft: pctB3(valorVenta - saldoCredito),
    fillWidth: pctB3(saldoCredito),
    fillColor: "var(--signal-red)",
    fillTextColor: "var(--ink-100)",
    valueColor: "var(--signal-red)",
    isNeg: true,
  });

  // 5. Comisión
  b3Rows.push({
    key: "comision",
    label: "− Comisión venta",
    sub: "2% sobre precio de venta",
    value: comisionVenta,
    fmtValue: "−" + fmtShort(comisionVenta),
    fillLeft: pctB3(valorVenta - saldoCredito - comisionVenta),
    fillWidth: pctB3(comisionVenta),
    fillColor: "var(--signal-red)",
    fillTextColor: "var(--ink-100)",
    valueColor: "var(--signal-red)",
    isNeg: true,
  });
  const b3Total = {
    key: "total",
    label: "= Al vender recibes",
    sub: "patrimonio neto",
    value: gananciaNeta,
    fmtValue: fmtFull(gananciaNeta),
    fillLeft: 0,
    fillWidth: pctB3(gananciaNeta),
    fillColor: "color-mix(in srgb, var(--ink-400) 40%, var(--franco-card))",
    fillTextColor: "var(--franco-text)",
    valueColor: "var(--ink-400)",
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
    const border = isTotal ? "1px solid var(--ink-400)" : "none";

    // Mobile: fila total sin barra — solo label + valor, destacado con border-top
    if (isTotal) {
      return (
        <div
          key={r.key}
          role="img"
          aria-label={`${r.label} ${r.fmtValue}`}
        >
          {/* Desktop: grid con barra */}
          <div
            className="hidden sm:grid items-center gap-3"
            style={{ gridTemplateColumns: "130px 1fr 92px" }}
          >
            <div className="flex flex-col gap-[1px]">
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.06em",
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
                background: "color-mix(in srgb, var(--ink-400) 8%, transparent)",
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
                      style={{ fontSize: 12, color: r.fillTextColor }}
                    >
                      {r.fmtValue}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span
              className="font-mono font-bold text-right whitespace-nowrap"
              style={{ fontSize: 14, color: r.valueColor }}
            >
              {r.fmtValue}
            </span>
          </div>

          {/* Mobile: sin barra, línea destacada */}
          <div className="flex sm:hidden items-baseline justify-between gap-3 py-1">
            <span
              className="font-mono uppercase whitespace-nowrap"
              style={{
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--franco-text)",
                fontWeight: 600,
              }}
            >
              {r.label}
            </span>
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{ fontSize: 16, color: "var(--ink-400)" }}
            >
              {r.fmtValue}
            </span>
          </div>
        </div>
      );
    }

    // Filas normales (no total)
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
              letterSpacing: "0.06em",
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
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
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
                  className="hidden sm:inline font-mono font-bold whitespace-nowrap"
                  style={{ fontSize: 11, color: r.fillTextColor }}
                >
                  {fmtShort(r.value)}
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className="font-mono font-bold text-right whitespace-nowrap"
          style={{ fontSize: 12, color: r.valueColor }}
        >
          {r.fmtValue}
        </span>
      </div>
    );
  };

  // Label de bloque "N DE 3"
  return (
    <div className="flex flex-col gap-4">
      {/* ─── BLOQUE 1 · EL VEREDICTO — bloque conclusivo Patrón 3 condicional */}
      {/* Regla pos/neg formalizada Fase 4.9 Commit 4:
          - !esPositiva (gananciaSobreTotal < 0, pérdida): wash Signal Red 6% +
            borderLeft Signal Red + label/KPI principal Signal Red
          - esPositiva (ganancia o equilibrio): wash Ink 3% + borderLeft Ink
            secundario + label Ink secundario + KPI principal Ink primary
            + sin border outline
          colorAccent (ink-400/signal-red) se preserva SOLO para el sub-KPI
          "+/-X% sobre lo que pusiste" (per scope: no tocar sub-KPI L1099-1104). */}
      <div
        style={{
          background: esPositiva
            ? "color-mix(in srgb, var(--franco-text) 3%, transparent)"
            : "color-mix(in srgb, var(--signal-red) 6%, var(--franco-card))",
          border: esPositiva
            ? "none"
            : "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)",
          borderLeft: `3px solid ${esPositiva ? "var(--franco-text-secondary)" : "var(--signal-red)"}`,
          borderRadius: "0 8px 8px 0",
          padding: "18px 20px",
        }}
      >
        <div className="mb-2">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              color: esPositiva ? "var(--franco-text-secondary)" : "var(--signal-red)",
              fontWeight: 600,
            }}
          >
            El veredicto
          </span>
        </div>

        <p
          className="font-body m-0"
          style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.5 }}
        >
          {b1Intro}
        </p>

        <p
          className="font-mono font-bold m-0 whitespace-nowrap"
          style={{
            fontSize: 24,
            color: esPositiva ? "var(--franco-text)" : "var(--signal-red)",
            lineHeight: 1,
            marginTop: 8,
          }}
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
        <div className="mb-2">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text)", fontWeight: 600 }}
          >
            Tu esfuerzo total
          </span>
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
                style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--franco-text)", fontWeight: 600 }}
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
        <div className="mb-2">
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text)", fontWeight: 600 }}
          >
            De dónde salen los {headerMonto}
          </span>
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
            style={{ borderTop: "0.5px dashed color-mix(in srgb, var(--ink-400) 30%, transparent)" }}
          >
            {renderB3Row(b3Total, true)}
          </div>
        </div>

        {/* Separador sutil arriba del eje (solo mobile) */}
        <div
          className="block sm:hidden mt-3"
          style={{
            borderTop: "0.5px solid color-mix(in srgb, var(--franco-text) 6%, transparent)",
            paddingTop: 8,
          }}
        />
        {/* Eje */}
        <div
          className="flex justify-between mt-0 sm:mt-2 pl-0 pr-0 sm:pl-[142px] sm:pr-[104px]"
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
              borderLeft: "3px solid var(--signal-red)",
              background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)",
              borderLeftWidth: "3px",
            }}
          >
            <h4 className="font-body font-medium text-[13px] mb-1 m-0" style={{ color: "var(--signal-red)" }}>
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
        state="info"
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
        className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text)] hover:underline"
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

  // Override de pregunta para drawer 02 (Costo mensual): variable según el
  // signo del flujo. La pregunta IA es siempre "¿Qué te cuesta mes a mes?",
  // confusa cuando el flujo es positivo. Hardcoded por veredicto numérico.
  const flujoNetoMensual = results.metrics?.flujoNetoMensual ?? 0;
  const drawerPregunta = (() => {
    if (activeKey !== "costoMensual") return section.pregunta;
    if (flujoNetoMensual < -1000) return "¿Cuánto te cuesta mes a mes?";
    if (flujoNetoMensual > 1000) return "¿Cuánto te queda mes a mes?";
    return "¿Cómo queda tu flujo mensual?";
  })();

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
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] mb-1 m-0">
                {meta.num} · {meta.label}
              </p>
              <h2 className="font-heading font-bold text-[20px] md:text-[24px] leading-[1.25] text-[var(--franco-text)] m-0">
                {drawerPregunta}
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
              valorUF={valorUF}
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
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
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
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                {DRAWER_META[meta.next].num} {DRAWER_META[meta.next].label} →
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
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
