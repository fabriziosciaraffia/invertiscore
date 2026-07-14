"use client";

import { useEffect, useMemo } from "react";
import type {
  AIAnalysisV2,
  AISection,
  AINegociacionSection,
  AIReestructuracionSection,
  FullAnalysisResult,
  AnalisisInput,
  HallazgoPuestaAPunto,
  HallazgoEstructuraFinanciamiento,
  HallazgoCapRate,
} from "@/lib/types";
import { calcFlujoDesglose, tirForPrice } from "@/lib/analysis";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, nunca literal.
const PROY_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import {
  DrawerTIRLtr,
  DrawerSensibilidadLtr,
  DrawerPatrimonioLtr,
  DrawerPlusvaliaLtr,
} from "@/components/analysis/drawers/DrawersPropios";
import type {
  HallazgoTIR,
  HallazgoSensibilidad,
  HallazgoPatrimonio,
  HallazgoPlusvalia,
} from "@/lib/types";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import { ZoneStatsCards } from "@/components/zone-insight/ZoneStatsCards";
import { ZoneMap } from "@/components/zone-insight/ZoneMap";
import { ZonePOIsList } from "@/components/zone-insight/ZonePOIsList";
import { ZoneInsightAI } from "@/components/zone-insight/ZoneInsightAI";

export type DrawerKey =
  | "costoMensual"
  | "capRate"
  | "negociacion"
  | "reestructuracion"
  | "largoPlazo"
  | "zona"
  | "capexPuestaAPunto"
  // rama drawers-propios (F2) — 4 drawers propios LTR (dejan de cablear a hermanos).
  | "tir"
  | "sensibilidad"
  | "patrimonio"
  | "plusvalia";

interface DrawerProps {
  activeKey: DrawerKey;
  aiAnalysis: AIAnalysisV2;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  valorUF: number;
  onClose: () => void;
  onNavigate: (newKey: DrawerKey) => void;
  /** Secuencia de drawers en el ORDEN VISUAL de la pirámide (la arma el orquestador
   *  desde ordenarHallazgosPiramide + HALLAZGO_DRAWER). prev/next se derivan de acá:
   *  un solo orden de verdad. Un drawer fuera de la secuencia (ej. `zona`) no tiene
   *  flechas — se abre solo desde su punto de entrada propio. */
  sequence: DrawerKey[];
  // Zone-insight (sección 06) — opcional, solo se usa cuando activeKey === "zona"
  zoneInsight?: ZoneInsightData | null;
  zoneLoading?: boolean;
  zoneError?: string | null;
  zoneCenter?: { lat: number; lng: number } | null;
  comuna?: string;
  arriendoUsuarioCLP?: number;
}

// Label humano del header y de los botones prev/next — nombra la card de destino en
// lenguaje humano, sin numeración (rama drawers-propios: la vieja num 02/02+/03+ se
// retiró; el orden ya lo dan la pirámide y las flechas, no un rótulo). El ORDEN de
// navegación vive en `sequence` (orden de la pirámide), no acá.
const DRAWER_META: Record<DrawerKey, { label: string }> = {
  costoMensual: { label: "Flujo mensual" },
  capRate: { label: "Lo que renta hoy" },
  negociacion: { label: "El precio" },
  reestructuracion: { label: "Tu estructura" },
  largoPlazo: { label: "A 10 años" },
  zona: { label: "La zona" },
  capexPuestaAPunto: { label: "Puesta a punto" },
  tir: { label: "Retorno total" },
  sensibilidad: { label: "Margen del veredicto" },
  patrimonio: { label: "Patrimonio a 10 años" },
  plusvalia: { label: "Plusvalía de la comuna" },
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
    ggcc: results.metrics?.gastos ?? 0,
    contribuciones: results.metrics?.contribuciones ?? 0,
    mantencion: results.metrics?.provisionMantencionAjustada ?? 0,
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
      name: "Cuota del crédito",
      value: desglose.dividendo,
      tooltip: "Cuota mensual del crédito hipotecario (capital + interés).",
    },
    {
      name: "Gastos comunes",
      value: desglose.ggccVacancia,
      tooltip: "Cuota mensual a la administración del edificio. Lo paga el arrendatario, pero lo asumes tú cuando el depto está sin arrendar (período de vacancia).",
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
      tooltip: "Provisión mensual para reparaciones y mantenimiento del depto. Calculada como % anual del precio según antigüedad (0,3% en deptos nuevos hasta 1,5% en sobre 20 años).",
    },
    {
      name: "Corretaje",
      value: desglose.corretajeProrrata,
      tooltip: "Comisión del corredor para captar arrendatario, prorrateada al mes.",
    },
    {
      name: "Recambio",
      value: desglose.recambio,
      tooltip: "Costo de turnover entre arrendatarios: pintura, limpieza profunda y reparaciones menores. Estimado en medio mes de arriendo cada 2 años, prorrateado al mes.",
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

  // Items SALE ordenados por value desc; los zero al final (manteniendo
  // grayed-out). Tooltips se asocian por nombre (no por posición), así que
  // un sort no rompe el mapeo.
  const saleItemsSorted = [...saleItems].sort((a, b) => {
    const aZero = a.value <= 0;
    const bZero = b.value <= 0;
    if (aZero && !bZero) return 1;
    if (!aZero && bZero) return -1;
    return b.value - a.value;
  });

  return (
    <div>
      <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-4 whitespace-pre-wrap">
        {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
      </p>

      {/* Mensaje educativo (dot pattern Fase 4.8): justifica por qué incluimos
          gastos que otros análisis omiten. */}
      <p className="font-mono text-[11px] mt-1 mb-4 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● A diferencia de otros análisis, Franco considera todos los gastos que impactan tu flujo real: vacancia, mantención, corretaje, recambio y gestión. Una evaluación honesta los incluye.
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
          {saleItemsSorted.map((it) => {
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
    const tirSug = tirForPrice(inputData, precioSugUF, valorUF);
    const tirVm = tirForPrice(inputData, vmFrancoUF, valorUF);
    // Precio límite por bisección simple solo si la TIR actual es > 6
    let precioLimUF: number | null = null;
    let tirLim: number | null = null;
    if (tirActual > 6) {
      let lo = inputData.precio;
      // P2 (Fase 20): rango ampliado a vmFranco × 1.5 (era × 1.3) para que
      // Límite ≥ vmFranco en deals con ventaja extrema (>30% bajo mercado).
      let hi = Math.max(inputData.precio * 1.5, vmFrancoUF * 1.5);
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const t = tirForPrice(inputData, mid, valorUF);
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

  // Guard P3: data corrupta o legacy sin precio válido — el resto del drawer
  // produciría barras NaN y veredicto sin sentido. Después de hooks por
  // las reglas de React.
  if (!Number.isFinite(precioCLP) || precioCLP <= 0) {
    return (
      <div>
        <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text-secondary)]">
          Datos insuficientes para análisis de negociación.
        </p>
      </div>
    );
  }

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
  // Híbrido: CLP se abrevia ($230M); UF muestra completo (UF 8.450) porque
  // los rangos típicos (3.000-15.000 UF) abreviados quedan ilegibles ("UF 8K").
  const fmtPrecio = (v: number) => (currency === "UF" ? fmtFull(v) : fmtShort(v));
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
  let veredictoTooltip: string;
  let veredictoDesc: string;
  let veredictoColor: string;
  let veredictoMonto: string;
  let veredictoSub: string;
  // P1 (Fase 20): KPI Hero solo visible cuando hay diferencia material.
  // En "Precio alineado" se oculta para evitar el ambiguo "≈ $0".
  let mostrarKPI = true;
  if (esPasada) {
    veredictoLabel = "Ventaja de compra";
    veredictoTooltip = "Compras bajo el valor estimado de mercado de la zona. Diferencia favorable entre precio y valor estimado de mercado.";
    veredictoDesc = `Estás pagando ${fmtPrecio(precioCLP)} por algo que vale ${fmtPrecio(vmFrancoCLP)}`;
    veredictoMonto = "+" + fmtFull(diferenciaCLP);
    veredictoSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% bajo mercado`;
    veredictoColor = "var(--ink-400)";
  } else if (esSobreprecio) {
    veredictoLabel = "Sobreprecio";
    veredictoTooltip = "Pagas más que el valor estimado de mercado de la zona.";
    veredictoDesc = `Estás pagando ${fmtPrecio(precioCLP)} por algo que vale ${fmtPrecio(vmFrancoCLP)}`;
    veredictoMonto = "−" + fmtFull(Math.abs(diferenciaCLP));
    veredictoSub = `${pctDiferencia.toFixed(1).replace(".", ",")}% sobre mercado`;
    veredictoColor = "var(--signal-red)";
  } else {
    veredictoLabel = "Precio alineado";
    veredictoTooltip = "Tu precio coincide con el valor estimado de mercado (±2% diferencia).";
    veredictoDesc = `El precio está cerca del valor estimado de mercado`;
    veredictoMonto = ""; // unused — mostrarKPI=false
    veredictoSub = "";
    veredictoColor = "color-mix(in srgb, var(--franco-text) 75%, transparent)";
    mostrarKPI = false;
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

  // Confianza del VM: cuando vmFranco ≈ precio no hay un valor de mercado total
  // independiente (cayó al precio pedido por falta de comparables directos). Es la
  // MISMA señal que condiciona el caveat de negociacion.contenido en la prosa
  // (ai-generation.ts:980, tieneDiferenciaValida = |vmFranco − precio| > $1M ≈ UF 25):
  // así la fila de la tabla baja a la honestidad de la prosa en vez de mostrar el
  // precio pedido como un "valor estimado" a secas. VM sólido → fila intacta.
  const vmDebil = Math.abs(vmFrancoCLP - precioCLP) <= 1_000_000;

  const filas = [
    {
      key: "tu",
      nombre: "Tu precio",
      sub: "lo que pide el corredor",
      precio: precioCLP,
      tir: tirActual,
      barColor: "rgba(250,250,248,0.55)",
      highlight: false,
      tooltip: "Precio publicado por el corredor que estás analizando.",
    },
    {
      key: "vm",
      nombre: "Valor estimado de mercado",
      sub: vmDebil
        ? "pocos comparables directos · referencia firme: precio/m²"
        : "estimado según comparables de zona",
      precio: vmFrancoCLP,
      tir: tirAlVmFranco ?? tirActual,
      barColor: "var(--ink-400)",
      highlight: false,
      tooltip: vmDebil
        ? "No hay comparables directos suficientes para un valor de mercado total confiable de este depto. La referencia sólida es el precio por m² de la zona, no este valor total."
        : "Valor estimado de mercado calculado por Franco según comparables de la zona, no según el precio publicado.",
    },
    {
      key: "sug",
      nombre: "Sugerido",
      sub: "cierra acá si puedes",
      precio: precioSugeridoCLP,
      tir: tirAlSugerido,
      barColor: "var(--franco-text)",
      highlight: true,
      tooltip: "Precio recomendado por Franco para que la inversión cierre con TIR razonable. Punto de partida para negociar.",
    },
    {
      key: "lim",
      nombre: "Límite",
      // Sub varía: si esSobreprecio + null → fila se oculta directamente más abajo.
      // Si null + no-sobreprecio → reescritura clara. Default: "máximo que conviene pagar".
      sub: precioLimiteCLP === null
        ? "sin límite definido — tu precio ya rinde bajo el umbral 6%"
        : "máximo que conviene pagar",
      precio: precioLimiteCLP,
      tir: tirAlLimite,
      barColor: "var(--signal-red)",
      highlight: false,
      tooltip: "Precio máximo bajo el cual la TIR cae bajo 6%. Sobre 6% es el umbral mínimo para que la inversión sea más atractiva que instrumentos de bajo riesgo (depósitos a plazo, fondos mutuos conservadores).",
    },
  ].filter((f) => {
    // PARTE 7.1: ocultar fila Límite cuando esSobreprecio + null (combo ilógico).
    if (f.key === "lim" && esSobreprecio && precioLimiteCLP === null) return false;
    return true;
  });

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
          className="inline-flex items-center gap-1 mb-2"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: esSobreprecio ? "var(--signal-red)" : "var(--franco-text-secondary)",
            fontWeight: 600,
          }}
        >
          <span className="font-mono uppercase">{veredictoLabel}</span>
          <InfoTooltip content={veredictoTooltip} />
        </span>
        <p
          className="font-heading m-0"
          style={{ fontSize: 14, color: "color-mix(in srgb, var(--franco-text) 85%, transparent)", lineHeight: 1.5 }}
        >
          {veredictoDesc}
        </p>
        {mostrarKPI && (
          <>
            <p
              className="font-mono font-bold m-0 mt-3 whitespace-nowrap"
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
          </>
        )}
      </div>

      {/* Mensaje educativo dot Fase 4.8 — explica la lógica de comparación. */}
      <p className="font-mono text-[11px] m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Franco compara contra un valor estimado de mercado (mediana de avisos ajustada a precio de cierre estimado), no contra el precio publicado. La &ldquo;ventaja&rdquo; o &ldquo;sobreprecio&rdquo; es una estimación, no una tasación.
      </p>

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
            gridTemplateColumns: "minmax(160px, 1.4fr) 1fr 90px 60px",
            fontSize: 9,
            letterSpacing: "0.06em",
            color: "color-mix(in srgb, var(--franco-text) 45%, transparent)",
            borderBottom: "0.5px dashed color-mix(in srgb, var(--franco-text) 15%, transparent)",
          }}
        >
          <span></span>
          <span></span>
          <span className="text-right">Precio</span>
          <span className="inline-flex items-center justify-end gap-1">
            <span>TIR</span>
            <InfoTooltip content="Tasa Interna de Retorno: rentabilidad anual proyectada de la inversión incluyendo flujo, plusvalía y venta a 10 años." />
          </span>
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
                  style={{ gridTemplateColumns: "minmax(160px, 1.4fr) 1fr 90px 60px" }}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className="inline-flex items-center gap-1 font-body font-medium"
                      style={{ fontSize: 13, color: "var(--franco-text)" }}
                    >
                      <span className="truncate">{f.nombre}</span>
                      {f.tooltip && <InfoTooltip content={f.tooltip} />}
                    </span>
                    <span
                      className="font-heading italic"
                      style={{ fontSize: 10, lineHeight: 1.3, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
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
                    {isNull ? "—" : fmtPrecio(f.precio as number)}
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
                      className="font-heading italic"
                      style={{ fontSize: 10, lineHeight: 1.3, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
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
                      {isNull ? "—" : fmtPrecio(f.precio as number)}
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

      {/* Aunque negocies al máximo (negociacion.contenido — Entrega B).
          break-even del arriendo + palanca de financiamiento. Contrato reescrito
          (:561): no repite sobreprecio/m², ni la tesis "buscar otra", ni afirma/
          niega el valor de mercado — la tabla de arriba ya lo muestra. */}
      {(currency === "CLP" ? data.contenido_clp : data.contenido_uf)?.trim() && (
        <div
          style={{
            borderLeft: "3px solid var(--franco-text-secondary)",
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <span
            className="font-mono uppercase block mb-1.5"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
          >
            Aunque negocies al máximo
          </span>
          <p
            className="font-body m-0 whitespace-pre-wrap"
            style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.55 }}
          >
            {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
          </p>
        </div>
      )}

      {/* BLOQUE C · ESTRATEGIA — wash condicional (Fase 20 PARTE 6).
          Signal Red SOLO cuando esSobreprecio (caso que requiere atención).
          Ventaja y Alineado: Ink wash neutro. Capa 1 binaria respetada. */}
      <div
        style={{
          background: esSobreprecio
            ? "color-mix(in srgb, var(--signal-red) 6%, var(--franco-card))"
            : "color-mix(in srgb, var(--franco-text) 3%, transparent)",
          border: esSobreprecio
            ? "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)"
            : "none",
          borderLeft: esSobreprecio
            ? "3px solid var(--signal-red)"
            : "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
        }}
      >
        <p
          className="font-mono uppercase m-0 mb-2"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: esSobreprecio ? "var(--signal-red)" : "var(--franco-text-secondary)",
            fontWeight: 600,
          }}
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

      {/* Fase 3.6 v9 — Plan de negociación (3 slots discretos).
          Solo se renderiza si data.precios viene del motor v9. Cache pre-v9 cae
          al bloque "Estrategia sugerida" arriba como fallback. */}
      {data.precios && (
        <PlanNegociacion precios={data.precios} currency={currency} />
      )}

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

// ─── Fase 3.6 v9 — Plan de negociación (3 slots) ──────────────────────────
// Patrón 2 (zona): Ink neutro, sin Signal Red. Slots apilados con border-left
// Ink secundario. Cada slot: label mono uppercase + precio mono bold + glosa.
function PlanNegociacion({
  precios,
  currency,
}: {
  precios: NonNullable<AINegociacionSection["precios"]>;
  currency: "CLP" | "UF";
}) {
  const fmtPrecio = (clp: number, uf: number) => {
    if (currency === "UF") return `UF ${Math.round(uf).toLocaleString("es-CL")}`;
    return "$" + Math.round(clp).toLocaleString("es-CL");
  };

  const glosaPrimera = (currency === "CLP" ? precios.glosaPrimeraOferta_clp : precios.glosaPrimeraOferta_uf) || "";
  const glosaTecho = (currency === "CLP" ? precios.glosaTecho_clp : precios.glosaTecho_uf) || "";
  const glosaWalk = (currency === "CLP" ? precios.glosaWalkAway_clp : precios.glosaWalkAway_uf) || "";

  // Item 1 Sesión B2: cuando primeraOferta == techo (modo cerrar_actual del
  // motor), ambos slots muestran el mismo número. Fusionamos en uno solo.
  const slotsUnificados = precios.primeraOferta_uf === precios.techo_uf;
  const slots: Array<{ label: string; valor: string; glosa: string; razon?: string }> = slotsUnificados
    ? [
        {
          label: "Oferta única",
          valor: fmtPrecio(precios.techo_clp, precios.techo_uf),
          glosa: glosaTecho || glosaPrimera || "Cierra a este precio — no hay margen para negociar a la baja.",
        },
      ]
    : [
        {
          label: "Primera oferta",
          valor: fmtPrecio(precios.primeraOferta_clp, precios.primeraOferta_uf),
          glosa: glosaPrimera || "Con qué número partir.",
        },
        {
          label: "Techo",
          valor: fmtPrecio(precios.techo_clp, precios.techo_uf),
          glosa: glosaTecho || "Hasta dónde subir si rechazan.",
        },
      ];

  if (precios.walkAway) {
    if (precios.walkAway.precio_uf === null) {
      slots.push({
        label: "Walk-away",
        valor: "Buscar otra propiedad",
        glosa: glosaWalk || precios.walkAway.razon,
      });
    } else if (precios.walkAway.precio_clp !== null) {
      slots.push({
        label: "Walk-away",
        valor: fmtPrecio(precios.walkAway.precio_clp, precios.walkAway.precio_uf),
        glosa: glosaWalk || precios.walkAway.razon,
      });
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p
        className="font-mono uppercase m-0 mb-1"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--franco-text-secondary)",
          fontWeight: 600,
        }}
      >
        Plan de negociación
      </p>
      {slots.map((s, i) => (
        <div
          key={i}
          style={{
            borderLeft: "3px solid var(--franco-text-secondary)",
            background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <div className="flex items-baseline justify-between mb-1.5">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--franco-text-secondary)",
                fontWeight: 500,
              }}
            >
              {s.label}
            </span>
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{ fontSize: 14, color: "var(--franco-text)" }}
            >
              {s.valor}
            </span>
          </div>
          {s.glosa && (
            <p
              className="font-body m-0"
              style={{ fontSize: 12, color: "color-mix(in srgb, var(--franco-text) 75%, transparent)", lineHeight: 1.55 }}
            >
              {s.glosa}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Largo plazo drawer ─────────────────────────────
function DrawerLargoPlazo({
  data,
  currency,
  results,
  valorUF,
  inputData,
}: {
  data: AISection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  valorUF: number;
  inputData: AnalisisInput;
}) {
  // Modelo B3: la plusvalía solo se acumula desde la entrega. Para depto en
  // construcción, los tooltips lo explicitan.
  const entregaFutura = inputData.estadoVenta === "futura";
  const exit = results.exitScenario;
  const valorVenta = exit?.valorVenta ?? 0;
  // P1 Fase 21: análisis legacy sin exit data → fallback explícito.
  if (!Number.isFinite(valorVenta) || valorVenta <= 0) {
    return (
      <div>
        <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text-secondary)]">
          Datos insuficientes para análisis a largo plazo.
        </p>
      </div>
    );
  }
  const pieCLP = results.metrics?.pieCLP ?? 0;
  const precioCLP = results.metrics?.precioCLP ?? 0;
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
  // Corretaje inicial (usados, análisis nuevos): ya incluido en inversionInicial
  // vía el motor. Solo condiciona el label/tooltip del "Día 1" para itemizarlo.
  const tieneCorretaje = (results.metrics?.corretajeInicialCLP ?? 0) > 0;
  const flujoMensualAcum = exit?.flujoMensualAcumuladoNegativo ?? flujoMensualAcumFallback;
  const totalAportado = exit?.totalAportado ?? (inversionInicial + flujoMensualAcum);
  const gananciaSobreTotal = exit?.gananciaSobreTotal ?? (gananciaNeta - totalAportado);
  const pctSobreTotal = exit?.porcentajeGananciaSobreTotal
    ?? (totalAportado > 0 ? (gananciaSobreTotal / totalAportado) * 100 : 0);

  // Fase 3.9 v11 — usar flujo año 1 para coherencia cross-section (header /
  // costo mensual / IA citan el aporte año 1, no el promedio del horizonte).
  // El total acumulado (flujoMensualAcum) sigue siendo el dato de derecha.
  const aporteMensualAnio1 = Math.abs(results.metrics?.flujoNetoMensual ?? 0);

  // Helpers de formato
  const fmtFull = (v: number) => {
    if (currency === "CLP") return "$" + Math.round(v).toLocaleString("es-CL");
    const uf = valorUF > 0 ? v / valorUF : 0;
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  };
  const fmtShort = (v: number) => fmtCompact(v, currency, valorUF);
  // Híbrido CLP abreviado / UF completo (Fase 20.1 → replicado acá Fase 21).
  const fmtPrecio = (v: number) => (currency === "UF" ? fmtFull(v) : fmtShort(v));

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
  // Math.abs para que filas con value negativo (ej. gananciaNeta < 0 cuando
  // el saldo del crédito + comisión exceden el valor venta) tengan width
  // positiva CSS-válida. El signo se conserva en el label/valor.
  const pctB3 = (v: number) => (maxEjeB3 > 0 ? (Math.abs(v) / maxEjeB3) * 100 : 0);

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
    tooltip?: string;
  }> = [];

  // 1. Precio que pagaste
  b3Rows.push({
    key: "precio",
    label: "Precio que pagaste",
    sub: "lo que sale de tu crédito + pie",
    value: precioCLP,
    fmtValue: "+" + fmtPrecio(precioCLP),
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
      fmtValue: "+" + fmtPrecio(diferenciaCLP),
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
      fmtValue: "−" + fmtPrecio(sobre),
      fillLeft: pctB3(vmFrancoCLP),
      fillWidth: pctB3(sobre),
      fillColor: "var(--signal-red)",
      fillTextColor: "var(--ink-100)",
      valueColor: "var(--signal-red)",
      isNeg: true,
    });
  }

  // 3. Plusvalía (sobre vmFranco) — solo si > 0 (P1 Fase 21).
  // Si plusvaliaCalc === 0 (caso "precio user > vmFranco"), ocultar fila
  // para evitar "+$0" sin contexto.
  // TODO(franco-design): plusvalía es valor proyectado, no realizado — el
  // skill sugiere diferenciar proyectados con pattern (diagonales) o stroke
  // hatching. Refactor estructural pendiente para futura ronda.
  if (plusvaliaCalc > 0) {
    b3Rows.push({
      key: "plusvalia",
      label: `+ Plusvalía ${aniosPlazo} años`,
      sub: `+${PROY_PCT} anual sobre valor estimado`,
      value: plusvaliaCalc,
      fmtValue: "+" + fmtPrecio(plusvaliaCalc),
      fillLeft: pctB3(vmFrancoCLP),
      fillWidth: pctB3(plusvaliaCalc),
      fillColor: "var(--ink-400)",
      fillTextColor: "var(--ink-900)",
      valueColor: "var(--franco-text)",
      isNeg: false,
      tooltip: entregaFutura
        ? `Franco asume ${PROY_PCT} anual parejo (la proyección estándar Franco a futuro) sobre el valor estimado de mercado de la zona. El histórico real de la comuna es el contexto de riesgo sobre ese supuesto. En depto en construcción, la plusvalía cuenta solo desde la entrega.`
        : `Franco asume ${PROY_PCT} anual parejo (la proyección estándar Franco a futuro) sobre el valor estimado de mercado de la zona. El histórico real de la comuna es el contexto de riesgo sobre ese supuesto.`,
    });
  }

  // 4. Deuda
  b3Rows.push({
    key: "deuda",
    label: "− Deuda pendiente",
    sub: "saldo del crédito",
    value: saldoCredito,
    fmtValue: "−" + fmtPrecio(saldoCredito),
    fillLeft: pctB3(valorVenta - saldoCredito),
    fillWidth: pctB3(saldoCredito),
    fillColor: "var(--signal-red)",
    fillTextColor: "var(--ink-100)",
    valueColor: "var(--signal-red)",
    isNeg: true,
    tooltip: "Saldo del crédito que queda por pagar al banco al momento de vender.",
  });

  // 5. Comisión
  b3Rows.push({
    key: "comision",
    label: "− Comisión venta",
    sub: "2% sobre precio de venta",
    value: comisionVenta,
    fmtValue: "−" + fmtPrecio(comisionVenta),
    fillLeft: pctB3(valorVenta - saldoCredito - comisionVenta),
    fillWidth: pctB3(comisionVenta),
    fillColor: "var(--signal-red)",
    fillTextColor: "var(--ink-100)",
    valueColor: "var(--signal-red)",
    isNeg: true,
    tooltip: "2% sobre el precio de venta proyectado, cobrado por el corredor que vende la propiedad.",
  });
  const b3Total = {
    key: "total",
    label: "= Al vender recibes",
    sub: "lo que recibes al cerrar la venta",
    value: gananciaNeta,
    fmtValue: fmtFull(gananciaNeta),
    fillLeft: 0,
    fillWidth: pctB3(gananciaNeta),
    fillColor: "color-mix(in srgb, var(--ink-400) 40%, var(--franco-card))",
    fillTextColor: "var(--franco-text)",
    valueColor: "var(--ink-400)",
    isNeg: false,
    tooltip: "Patrimonio líquido que recibes al cerrar la venta, después de pagar deuda y comisión. No incluye lo que aportaste durante la tenencia.",
  };

  // Header del bloque 3 incluye el monto patrimonio abreviado
  const headerMonto = fmtPrecio(gananciaNeta);

  // Copy narrativo (templates estilo brand-voice)
  const b1Intro = `Si vendes en el año ${aniosPlazo}, tu ganancia neta es`;
  const b1Contexto = `Sale de la diferencia entre los ${fmtPrecio(gananciaNeta)} que recibes al vender y los ${fmtPrecio(totalAportado)} que aportaste en total.`;
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
            style={{ gridTemplateColumns: "minmax(140px, 1.1fr) 1fr 92px" }}
          >
            <div className="flex flex-col gap-[1px]">
              <span
                className="inline-flex items-center gap-1 font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: "color-mix(in srgb, var(--franco-text) 85%, transparent)",
                  fontWeight: 500,
                }}
              >
                <span>{r.label}</span>
                {r.tooltip && <InfoTooltip content={r.tooltip} />}
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
              className="inline-flex items-center gap-1 font-mono uppercase whitespace-nowrap"
              style={{
                fontSize: 10,
                letterSpacing: "0.06em",
                color: "var(--franco-text)",
                fontWeight: 600,
              }}
            >
              <span>{r.label}</span>
              {r.tooltip && <InfoTooltip content={r.tooltip} />}
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
        style={{ gridTemplateColumns: "minmax(140px, 1.1fr) 1fr 92px" }}
        role="img"
        aria-label={`${r.label} ${r.fmtValue}`}
      >
        <div className="flex flex-col gap-[1px]">
          <span
            className="inline-flex items-center gap-1 font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "color-mix(in srgb, var(--franco-text) 85%, transparent)",
              fontWeight: 500,
            }}
          >
            <span>{r.label}</span>
            {r.tooltip && <InfoTooltip content={r.tooltip} />}
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
                  {fmtPrecio(r.value)}
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

        {totalAportado > 0 && (
          <p
            className="inline-flex items-center gap-1 font-mono font-bold m-0"
            style={{ fontSize: 14, color: colorAccent, marginTop: 6 }}
          >
            <span>{esPositiva ? "+" : "−"}{Math.round(Math.abs(pctSobreTotal))}% sobre lo que pusiste</span>
            <InfoTooltip content="Ganancia neta dividida por el total que aportaste (pie + cierre + flujos negativos acumulados). Es la rentabilidad real sobre todo lo que sale de tu bolsillo." />
          </p>
        )}

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

      {/* Mensaje educativo dot Fase 4.8 — supuesto plusvalía */}
      <p className="font-mono text-[11px] m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Franco proyecta plusvalía de {PROY_PCT} anual parejo (la proyección estándar Franco) sobre el valor estimado de mercado de la zona. El histórico de la comuna —arriba o abajo de ese supuesto— es el contexto de riesgo sobre esa apuesta.
      </p>

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
                className="inline-flex items-center gap-1 font-body"
                style={{ fontSize: 13, color: "var(--franco-text)" }}
              >
                <span>{tieneCorretaje ? "Día 1 (pie + cierre + corretaje)" : "Día 1 (pie + cierre)"}</span>
                <InfoTooltip content={tieneCorretaje
                  ? "Pie del crédito + 2% de gastos de cierre (notario, Conservador de Bienes Raíces, timbres) + 2% de corretaje del comprador, usual al comprar una propiedad usada en Chile. CBR = oficina pública que registra la propiedad a tu nombre."
                  : "Pie del crédito + 2% de gastos de cierre (notario, Conservador de Bienes Raíces, timbres). CBR = oficina pública que registra la propiedad a tu nombre."} />
              </span>
              <span
                className="font-heading italic"
                style={{ fontSize: 11, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
              >
                {tieneCorretaje ? "pago al notario, CBR, timbres + corretaje" : "pago al notario, CBR, timbres"}
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
          {/* Fase 3.9 v11: sub-label muestra flujo año 1 (mismo número que IA + header
              cita en el resto del análisis). Total acumulado se mantiene en columna der. */}
          <div className="grid items-baseline gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
            <div className="flex flex-col">
              <span
                className="inline-flex items-center gap-1 font-body"
                style={{ fontSize: 13, color: "var(--franco-text)" }}
              >
                <span>+ Aporte mensual × {aniosPlazo} años</span>
                <InfoTooltip content={`Aporte mensual del primer año: ${fmtFull(aporteMensualAnio1)}. Asciende con UF en años siguientes; el total acumulado en ${aniosPlazo} años aparece a la derecha.`} />
              </span>
              <span
                className="font-heading italic"
                style={{ fontSize: 11, color: "color-mix(in srgb, var(--franco-text) 55%, transparent)" }}
              >
                {fmtPrecio(aporteMensualAnio1)} mensual hoy · asciende con UF
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
            {fmtPrecio(maxEjeB3)}
          </span>
        </div>
      </div>

      {/* ─── VS. OTRO INSTRUMENTO (largoPlazo.contenido — Entrega B) ─────────
          El waterfall de arriba da el patrimonio; este bloque responde "¿vale la
          pena vs poner la misma plata en otro lado?" (depósito UF / fondo mutuo +
          costo de oportunidad). Contrato :570 recortado: no repite ganancia
          neta / total aportado / pie (viven en el waterfall). */}
      {(currency === "CLP" ? data.contenido_clp : data.contenido_uf)?.trim() && (
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
              Vs. poner la misma plata en otro lado
            </span>
          </div>
          <p
            className="font-body m-0 whitespace-pre-wrap"
            style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 78%, transparent)", lineHeight: 1.6 }}
          >
            {currency === "CLP" ? data.contenido_clp : data.contenido_uf}
          </p>
        </div>
      )}

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
// Fase 3.6 v9 — truncado limpio con ellipsis. Reemplaza slice(0, n) que cortaba
// mid-word/mid-sentence sin "…". Busca último espacio o cierre de oración antes
// del límite y agrega ellipsis solo si realmente truncó.
function truncateClean(str: string, max: number): string {
  if (!str) return "";
  if (str.length <= max) return str.trim();
  const slice = str.slice(0, max);
  // 1ª preferencia: cortar en último ". ", "! ", "? "
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd > max * 0.5) {
    return slice.slice(0, sentenceEnd + 1).trim() + "…";
  }
  // 2ª preferencia: último espacio
  const wordEnd = slice.lastIndexOf(" ");
  if (wordEnd > max * 0.5) {
    return slice.slice(0, wordEnd).trim() + "…";
  }
  // Último recurso: cortar al límite duro
  return slice.trim() + "…";
}

export function extractRiesgos(
  content: string
): { titulo: string; descripcion: string }[] {
  if (!content || typeof content !== "string") return [];

  // Fase 3.6 v9 — primero intentar split por doble newline (formato v9 §R8).
  const dobleSalto = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  if (dobleSalto.length >= 2) {
    return dobleSalto.slice(0, 3).map((block, i) => {
      // Primera oración como título (separada por ". " o ".\n").
      const firstSentenceMatch = block.match(/^([^.!?]+[.!?])/);
      const titulo = firstSentenceMatch
        ? truncateClean(firstSentenceMatch[1].replace(/[.:]$/, "").trim(), 60)
        : truncateClean(block, 60) || `Riesgo ${i + 1}`;
      const rest = firstSentenceMatch
        ? block.slice(firstSentenceMatch[0].length).trim()
        : "";
      const descripcion = truncateClean(rest || block, 220);
      return { titulo, descripcion };
    });
  }

  // Fallback compat — cache pre-v9 con **bold** o bullets.
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
        results.push({ titulo: truncateClean(titleRaw, 60), descripcion: truncateClean(desc, 220) });
      }
    }
    if (results.length > 0) return results.slice(0, 3);
  }

  const blocks = content
    .split(/\n\s*(?:\d+\.|•|·|-)\s+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  return blocks.slice(0, 3).map((block, i) => {
    const firstSentence = block.split(/[.:]/)[0];
    const titulo = truncateClean(firstSentence.trim(), 60) || `Riesgo ${i + 1}`;
    const descripcion = truncateClean(
      block.replace(firstSentence, "").replace(/^[.:]\s*/, "").trim() || block,
      220
    );
    return { titulo, descripcion };
  });
}

// ─── Reestructuración drawer ────────────────────────
// Aparece solo cuando aiAnalysis.reestructuracion existe (Nivel 3 del
// escalonado financingHealth, skill §1.5). Commit E.3 · 2026-05-13 — la
// presencia del drawer es independiente del veredicto: el veredicto sigue
// siendo el del motor (típicamente AJUSTA SUPUESTOS cuando aplica Nivel 3),
// y el drawer aparece como tab adicional con la palanca de reestructuración
// financiera. No es un veredicto distinto.
function DrawerReestructuracion({
  data,
  currency,
  results,
  valorUF,
}: {
  data: AIReestructuracionSection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  valorUF: number;
}) {
  const content = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
  const est = data.estructuraSugerida;

  // Cuota actual desde el motor para el contraste con la sugerida.
  const cuotaActual = results.metrics?.dividendo ?? 0;
  const cuotaSugerida = Math.max(0, cuotaActual - (est.impactoCuotaMensual_clp || 0));

  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>El depto está bien. Lo que no cierra es la matemática del financiamiento.</span>
        <InfoTooltip content="Reestructuración del crédito sugerida cuando el problema dominante es pie/tasa/plazo, no el precio del depto." />
      </p>

      <div className="font-body text-[13px] leading-[1.65] text-[var(--franco-text)] my-4 whitespace-pre-line">
        {content}
      </div>

      {/* Estructura sugerida — 3 chips numéricos en mono */}
      <div
        className="rounded-[8px] p-4 mb-4"
        style={{
          background: "var(--franco-elevated)",
          border: "0.5px solid var(--franco-border)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-3">
          Estructura sugerida
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Pie
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {est.pieSugerido_pct}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Plazo
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {est.plazoSugerido_anios} <span className="text-[14px] font-medium">años</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Tasa objetivo
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {est.tasaObjetivo_pct.toFixed(1).replace(".", ",")}%
            </p>
          </div>
        </div>
      </div>

      {/* Bloque conclusivo destacado — KPI ahorro mensual */}
      {est.impactoCuotaMensual_clp > 0 && (
        <div
          className="rounded-r-[8px] p-4 mb-4"
          style={{
            borderLeft: "3px solid var(--franco-text)",
            background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
            Cuota mensual baja en
          </p>
          <p className="font-mono font-bold text-[24px] text-[var(--franco-text)] m-0 leading-tight">
            {fmtMoney(est.impactoCuotaMensual_clp, currency, valorUF)}
          </p>
          <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mt-1">
            de {fmtMoney(cuotaActual, currency, valorUF)} a {fmtMoney(cuotaSugerida, currency, valorUF)}
          </p>
        </div>
      )}
    </div>
  );
}

// Fallback del drawer de estructura/financiamiento: cuando NO existe
// aiAnalysis.reestructuracion (salud financiera sana, sin Nivel 3), el "ver
// detalle" del hallazgo estructura abre este contenido liviano solo-motor. Sin
// IA, sin chart. Confirma que la estructura está sana (pie, tasa, cuota actual
// desde el hallazgo + results.metrics) y que no hay palanca urgente que mover.
// Estilo sobrio de DrawerCapexPuestaAPunto.
function DrawerEstructuraSana({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoEstructuraFinanciamiento;
  results: FullAnalysisResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { piePct, tasaPct, tasaMarketPct } = hallazgo.valor;
  const cuotaActual = results.metrics?.dividendo ?? 0;
  const pieFmt = Number.isInteger(piePct) ? String(piePct) : piePct.toFixed(1).replace(".", ",");

  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>Tu estructura de financiamiento está sana: el pie y la tasa no están frenando el deal.</span>
        <InfoTooltip content="Cuando el pie y la tasa están en rango, el problema —si lo hay— está en el precio o el flujo, no en cómo financias." />
      </p>

      {/* Estructura actual — chips numéricos en mono */}
      <div
        className="rounded-[8px] p-4 mb-4"
        style={{ background: "var(--franco-elevated)", border: "0.5px solid var(--franco-border)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-3">
          Tu estructura actual
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Pie
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {pieFmt}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Tasa
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {tasaPct.toFixed(1).replace(".", ",")}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Cuota mensual
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {fmtMoney(cuotaActual, currency, valorUF)}
            </p>
          </div>
        </div>
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mt-3">
          Óptimo de pie 25% · tasa de mercado {tasaMarketPct.toFixed(1).replace(".", ",")}%.
        </p>
      </div>

      {/* Procedencia — de dónde sale el dato (builder determinístico, reemplaza el
          eco de fraseCanonica que ya mostró la card) */}
      <div
        className="rounded-r-[8px] p-4 mb-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
          De dónde sale
        </p>
        <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
          {procedenciaExtendida(hallazgo, currency, valorUF)}
        </p>
      </div>

      {/* Bloque conclusivo — sin palanca urgente */}
      <div
        className="rounded-r-[8px] p-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
          Sin palanca urgente
        </p>
        <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
          No hay una palanca de financiamiento urgente que mover. Si este deal necesita ajuste, está en el precio o el flujo, no en cómo lo financias.
        </p>
      </div>
    </div>
  );
}

// Drawer del hallazgo CapEx puesta a punto (motor, no IA). Muestra los montos
// precomputados + decisividad + procedencia visible (no audit-only).
function DrawerCapexPuestaAPunto({
  hallazgo,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoPuestaAPunto;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { montoCLP, montoUF, ufM2, antiguedadAnios, superficieUtilM2 } = hallazgo.valor;
  const montoFmt =
    currency === "CLP"
      ? "$" + Math.round(montoCLP).toLocaleString("es-CL")
      : "UF " + Math.round(montoUF).toLocaleString("es-CL");
  // fraccionInversion (capex/inversión inicial), NO decisividad — que desde E2 es
  // la "Δdecisión" calibrada. Esta cifra es display: "X% de tu plata día 1".
  const pctInversion = Math.round(hallazgo.valor.fraccionInversion * 100);

  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>No es flipping: es dejar el depto en estándar de arriendo para captar el precio de mercado.</span>
        <InfoTooltip content="Pintura, pisos, cocina/baño al día. Un usado sin puesta a punto suele arrendar bajo el precio de mercado de la zona." />
      </p>

      {/* Cifras del hallazgo — chips numéricos en mono */}
      <div
        className="rounded-[8px] p-4 mb-4"
        style={{ background: "var(--franco-elevated)", border: "0.5px solid var(--franco-border)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-3">
          Puesta a punto estimada
        </p>
        {/* Stack en móvil: el monto CLP (largo) se monta sobre los otros chips
            si se fuerzan 3 columnas a 380px. 3 cols recién desde sm. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Inversión
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {montoFmt}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Por m²
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {ufM2.toFixed(1).replace(".", ",")} <span className="text-[14px] font-medium">UF/m²</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              De tu plata día 1
            </p>
            <p
              className={`font-mono font-bold text-[20px] m-0 leading-tight ${
                hallazgo.valor.fraccionInversion > 0.2 ? "text-signal-red" : "text-[var(--franco-text)]"
              }`}
            >
              {pctInversion}%
            </p>
          </div>
        </div>
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mt-3">
          Depto de {antiguedadAnios} años · {superficieUtilM2} m² útiles.
        </p>
      </div>

      {/* Procedencia visible */}
      <div
        className="rounded-r-[8px] p-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
          De dónde sale
        </p>
        <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
          {procedenciaExtendida(hallazgo, currency, valorUF)}
        </p>
      </div>
    </div>
  );
}

// Drawer del hallazgo cap_rate (motor, no IA). Contenido liviano solo-motor, sin
// chart: cap rate del deal vs referencia comunal, traducción a plata (arriendo
// anual neto vs precio) y qué arriendo mensual pediría para alcanzar la
// referencia. Los montos se derivan del cap rate × precio para ser 100%
// consistentes con los % mostrados (no se recalcula NOI por otra vía).
function DrawerCapRate({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoCapRate;
  results: FullAnalysisResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const { capRatePct, capRefPct, gapPts } = hallazgo.valor;
  const adverso = hallazgo.direccion === "adverso"; // rinde bajo la referencia
  const precioCLP = results.metrics?.precioCLP ?? 0;
  const arriendoActual = results.metrics?.ingresoMensual ?? 0;

  // Arriendo anual neto (NOI) derivado del cap rate mostrado × precio — misma
  // base que el %, sin recomputar por otra vía. El objetivo usa la referencia.
  const noiAnual = (capRatePct / 100) * precioCLP;
  const noiObjetivoAnual = (capRefPct / 100) * precioCLP;
  // Gastos operativos constantes ⇒ Δneto ≈ Δarriendo bruto. Cálculo directo.
  const gapNetoMensual = (noiObjetivoAnual - noiAnual) / 12; // >0 ⇒ falta rendimiento
  const arriendoObjetivo = arriendoActual + gapNetoMensual;

  const fmt = (n: number) => fmtMoney(n, currency, valorUF);
  const pct = (n: number) => n.toFixed(1).replace(".", ",");

  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>El cap rate es lo que el depto renta al año, como % del precio, antes de la deuda.</span>
        <InfoTooltip content="Cap rate = arriendo anual neto (tras gastos operativos, antes de la cuota del crédito) ÷ precio. Mide la rentabilidad del activo, sin el efecto del crédito." />
      </p>

      {/* Cap rate vs referencia — chips numéricos en mono */}
      <div
        className="rounded-[8px] p-4 mb-4"
        style={{ background: "var(--franco-elevated)", border: "0.5px solid var(--franco-border)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-3">
          Rendimiento operativo
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Tu cap rate
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {pct(capRatePct)}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Referencia
            </p>
            <p className="font-mono font-bold text-[20px] text-[var(--franco-text)] m-0 leading-tight">
              {pct(capRefPct)}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Brecha
            </p>
            <p
              className={`font-mono font-bold text-[20px] m-0 leading-tight ${
                adverso ? "text-signal-red" : "text-[var(--franco-text)]"
              }`}
            >
              {gapPts > 0 ? "+" : gapPts < 0 ? "−" : ""}
              {pct(Math.abs(gapPts))} pts
            </p>
          </div>
        </div>
        <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 mt-3">
          Hoy: {fmt(noiAnual)} netos al año sobre un precio de {fmt(precioCLP)}.
        </p>
      </div>

      {/* Procedencia — de dónde sale el dato (builder determinístico, reemplaza el
          eco de fraseCanonica que ya mostró la card) */}
      <div
        className="rounded-r-[8px] p-4 mb-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
          De dónde sale
        </p>
        <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
          {procedenciaExtendida(hallazgo, currency, valorUF)}
        </p>
      </div>

      {/* Bloque conclusivo — arriendo que pediría la referencia (cálculo directo) */}
      <div
        className="rounded-r-[8px] p-4"
        style={{
          borderLeft: "3px solid var(--franco-text)",
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
          {adverso ? "Para rendir como el mercado" : "Ya rinde sobre el mercado"}
        </p>
        {adverso ? (
          <>
            <p className="font-mono font-bold text-[24px] text-[var(--franco-text)] m-0 leading-tight">
              {fmt(arriendoObjetivo)}
              <span className="text-[14px] font-medium"> /mes</span>
            </p>
            <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mt-1">
              Hoy arriendas en {fmt(arriendoActual)}. Para rendir como la referencia de mercado ({pct(capRefPct)}%) necesitarías arrendar en torno a {fmt(arriendoObjetivo)} al mes — o pagar menos por el depto.
            </p>
          </>
        ) : (
          <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
            Tu arriendo de {fmt(arriendoActual)} al mes ya renta por sobre la referencia de mercado ({pct(capRefPct)}%). El activo trabaja a tu favor.
          </p>
        )}
      </div>
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
  // Ramifica por señal de error (D-D): el 400 sin coordenadas es una condición de la
  // dirección (atribuible); un transitorio (red/500) no lo es → no culpar a la dirección
  // y ofrecer un reintento honesto. La señal viene del hook useZoneInsight.
  const esCoords = !!message && (/\b400\b/.test(message) || /coordenada/i.test(message));
  const texto = esCoords
    ? "Zona no disponible para esta dirección — no pudimos ubicarla en el mapa."
    : "No pudimos cargar la zona ahora. Reintenta.";
  return (
    <div
      className="rounded-[8px] p-8 text-center"
      style={{
        background: "var(--franco-bar-track)",
        border: "0.5px solid var(--franco-border)",
      }}
    >
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 mb-3">
        {texto}
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

      {/* Mensaje educativo dot Fase 4.8 — diferenciar plusvalía histórica
          (esta sección) vs proyectada (Drawer 04 Largo Plazo). Resuelve
          confusión potencial cuando los números no coinciden. */}
      <p className="font-mono text-[11px] m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● La plusvalía histórica de la comuna refleja el pasado real. Para proyectar tu venta a 10 años, Franco usa la proyección estándar Franco: {PROY_PCT} anual parejo, distinta de ese histórico.
      </p>

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
  sequence,
  zoneInsight,
  zoneLoading,
  zoneError,
  zoneCenter,
  comuna,
  arriendoUsuarioCLP,
}: DrawerProps) {
  // Hallazgo cap_rate (carrier del motor o persistido) — alimenta el drawer capRate.
  const capRateHallazgo =
    results.hallazgos?.find((h): h is HallazgoCapRate => h.id === "cap_rate") ??
    results.metrics?.hallazgoCapRate ??
    undefined;

  // Hallazgos de los 4 drawers propios LTR (motor-seeded en results.hallazgos; plusvalía
  // también puede venir del carrier de métricas). Alimentan plantillas determinísticas.
  const tirHallazgo = results.hallazgos?.find((h): h is HallazgoTIR => h.id === "tir");
  const sensibilidadHallazgo = results.hallazgos?.find(
    (h): h is HallazgoSensibilidad => h.id === "sensibilidad",
  );
  const patrimonioHallazgo = results.hallazgos?.find(
    (h): h is HallazgoPatrimonio => h.id === "patrimonio",
  );
  const plusvaliaHallazgo =
    results.hallazgos?.find((h): h is HallazgoPlusvalia => h.id === "plusvalia") ??
    results.metrics?.hallazgoPlusvalia ??
    undefined;

  // Fallback simétrico al de STR (DrawerContentSTR): si la card abrió un drawer propio
  // pero el hallazgo no está (fila legacy), se muestra una constatación honesta, no un
  // cuerpo vacío. En el flujo normal es inalcanzable (la card solo existe con su hallazgo).
  const faltaHallazgoLtr = (
    <p className="font-body italic text-[13px] text-[var(--franco-text-secondary)] leading-[1.6] m-0">
      Este detalle no está disponible para este análisis.
    </p>
  );

  const meta = DRAWER_META[activeKey];

  // prev/next = vecinos en la secuencia de la pirámide (un solo orden de verdad).
  // Un drawer fuera de la secuencia (ej. `zona`, que se abre desde su MiniCard)
  // tiene idx = -1 → sin flechas, solo cierra. Sin dead-ends por construcción: si
  // está en la secuencia tiene vecinos; si no, no es alcanzable por flechas.
  const { prevKey, nextKey } = useMemo(() => {
    const idx = sequence.indexOf(activeKey);
    return {
      prevKey: idx > 0 ? sequence[idx - 1] : undefined,
      nextKey: idx >= 0 && idx < sequence.length - 1 ? sequence[idx + 1] : undefined,
    };
  }, [sequence, activeKey]);

  // Zone y reestructuracion no encajan con AISection — placeholder pregunta.
  const zonaTitle = "Lo que no ves a simple vista";
  // Sin IA de reestructuración (estructura sana), el título del fallback no debe
  // insinuar una palanca que mover.
  const reestructuracionTitle = aiAnalysis.reestructuracion
    ? "¿Y si cambias la estructura?"
    : "¿Cómo está tu estructura?";
  const capexTitle = "Dejarlo listo para arrendar";
  const capRateTitle = "Lo que renta hoy vs lo que debería";
  // Preguntas de los 4 drawers propios LTR (deterministas, cero IA). La de TIR se
  // completa con el % real más abajo (drawerPregunta); las otras son estables.
  const sensibilidadTitle = "¿Cuánto aguanta tu veredicto?";
  const patrimonioTitle = "¿Cuánto es tuyo a 10 años?";
  const plusvaliaTitle = "¿Cuánto se ha valorizado la comuna?";
  const tirTitle = "¿Por qué tu retorno no es el de un depósito?";

  // Hallazgo estructura (motor-seeded, siempre presente en LTR) — alimenta el
  // fallback del drawer de reestructuración cuando no hay sección IA.
  const estructuraHallazgo = results.hallazgos?.find(
    (h): h is HallazgoEstructuraFinanciamiento => h.id === "estructura_financiamiento",
  );
  // Hallazgo capex (motor-seeded) — .find por id, NO índice posicional (paridad con
  // capRate/estructura). Antes se gateaba con results.hallazgos[0] y el drawer no
  // renderizaba si otro hallazgo quedaba en [0].
  const capexHallazgo = results.hallazgos?.find(
    (h): h is HallazgoPuestaAPunto => h.id === "capex_puesta_a_punto",
  );
  const section =
    activeKey === "zona"
      ? ({ pregunta: zonaTitle } as { pregunta: string })
      : activeKey === "reestructuracion"
        ? ({ pregunta: reestructuracionTitle } as { pregunta: string })
        : activeKey === "capexPuestaAPunto"
          ? ({ pregunta: capexTitle } as { pregunta: string })
          : activeKey === "capRate"
            ? ({ pregunta: capRateTitle } as { pregunta: string })
            : activeKey === "tir"
              ? ({ pregunta: tirTitle } as { pregunta: string })
              : activeKey === "sensibilidad"
                ? ({ pregunta: sensibilidadTitle } as { pregunta: string })
                : activeKey === "patrimonio"
                  ? ({ pregunta: patrimonioTitle } as { pregunta: string })
                  : activeKey === "plusvalia"
                    ? ({ pregunta: plusvaliaTitle } as { pregunta: string })
                    : aiAnalysis[activeKey];

  // Override de pregunta por drawer + estado. La pregunta IA es genérica;
  // hardcoded varía según el "veredicto numérico" del bloque para evitar
  // disonancia (ej. "¿Qué te cuesta?" cuando el flujo es positivo).
  const flujoNetoMensual = results.metrics?.flujoNetoMensual ?? 0;
  const drawerPregunta = (() => {
    if (activeKey === "costoMensual") {
      if (flujoNetoMensual < -1000) return "¿Cuánto te cuesta mes a mes?";
      if (flujoNetoMensual > 1000) return "¿Cuánto te queda mes a mes?";
      return "¿Cómo queda tu flujo mensual?";
    }
    if (activeKey === "negociacion") {
      const precioActual = (inputData?.precio || 0);
      const vmFranco = results.metrics?.valorMercadoFrancoUF ?? precioActual;
      const dev = vmFranco > 0 ? (vmFranco - precioActual) / vmFranco : 0;
      const absDev = Math.abs(dev);
      if (absDev <= 0.02) return "¿Vale la pena negociar?";
      if (dev > 0) return "¿Vale la pena seguir negociando?"; // esPasada
      return "¿Cuánto bajar el precio?"; // esSobreprecio
    }
    if (activeKey === "largoPlazo") {
      const exit = results.exitScenario;
      const gananciaSobreTotal = exit?.gananciaSobreTotal ?? 0;
      const aniosPlazo = exit?.anios ?? 10;
      if (gananciaSobreTotal < -1000) return `¿Cuánto pierdes a ${aniosPlazo} años?`;
      if (gananciaSobreTotal > 1000) return `¿Cuánto ganas a ${aniosPlazo} años?`;
      return `¿Vale la pena a ${aniosPlazo} años?`;
    }
    if (activeKey === "tir" && tirHallazgo) {
      const tp = tirHallazgo.valor.tirPct.toFixed(1).replace(".", ",");
      return `¿Por qué tu ${tp}% no es el ${tp}% de un depósito?`;
    }
    return section.pregunta;
  })();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && nextKey) onNavigate(nextKey);
      if (e.key === "ArrowLeft" && prevKey) onNavigate(prevKey);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, nextKey, prevKey]);

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
                {meta.label}
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
          {activeKey === "reestructuracion" &&
            (aiAnalysis.reestructuracion ? (
              <DrawerReestructuracion
                data={aiAnalysis.reestructuracion}
                currency={currency}
                results={results}
                valorUF={valorUF}
              />
            ) : estructuraHallazgo ? (
              <DrawerEstructuraSana
                hallazgo={estructuraHallazgo}
                results={results}
                currency={currency}
                valorUF={valorUF}
              />
            ) : null)}
          {activeKey === "capexPuestaAPunto" && capexHallazgo && (
            <DrawerCapexPuestaAPunto
              hallazgo={capexHallazgo}
              currency={currency}
              valorUF={valorUF}
            />
          )}
          {activeKey === "capRate" && capRateHallazgo && (
            <DrawerCapRate
              hallazgo={capRateHallazgo}
              results={results}
              currency={currency}
              valorUF={valorUF}
            />
          )}
          {activeKey === "largoPlazo" && (
            <DrawerLargoPlazo
              data={section as AISection}
              currency={currency}
              results={results}
              valorUF={valorUF}
              inputData={inputData}
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
          {activeKey === "tir" &&
            (tirHallazgo ? (
              <DrawerTIRLtr hallazgo={tirHallazgo} results={results} currency={currency} valorUF={valorUF} />
            ) : (
              faltaHallazgoLtr
            ))}
          {activeKey === "sensibilidad" &&
            (sensibilidadHallazgo ? (
              <DrawerSensibilidadLtr hallazgo={sensibilidadHallazgo} results={results} currency={currency} valorUF={valorUF} />
            ) : (
              faltaHallazgoLtr
            ))}
          {activeKey === "patrimonio" &&
            (patrimonioHallazgo ? (
              <DrawerPatrimonioLtr hallazgo={patrimonioHallazgo} results={results} currency={currency} valorUF={valorUF} />
            ) : (
              faltaHallazgoLtr
            ))}
          {activeKey === "plusvalia" &&
            (plusvaliaHallazgo ? (
              <DrawerPlusvaliaLtr
                hallazgo={plusvaliaHallazgo}
                results={results}
                valorUF={valorUF}
                comuna={comuna ?? (inputData.comuna || "la comuna")}
              />
            ) : (
              faltaHallazgoLtr
            ))}

          <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-[var(--franco-border)]">
            {prevKey ? (
              <button
                type="button"
                onClick={() => onNavigate(prevKey)}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                ← {DRAWER_META[prevKey].label}
              </button>
            ) : (
              <span />
            )}

            {nextKey ? (
              <button
                type="button"
                onClick={() => onNavigate(nextKey)}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                {DRAWER_META[nextKey].label} →
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
