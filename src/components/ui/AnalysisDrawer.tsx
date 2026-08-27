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
import { calcFlujoDesglose, tirForPrice, calcDividendo } from "@/lib/analysis";
import { metricaValorONull } from "@/lib/types";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, nunca literal.
const PROY_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;
import { InfoTooltip } from "@/components/ui/tooltip";
import { renderPlumon, plumonInline } from "@/components/analysis/hallazgos/plumon";
import { EscaleraPie } from "@/components/analysis/hallazgos/escalera-pie";
import {
  VProsa,
  VViz,
  VCierre,
  VFuente,
  Thermo,
  Fall,
  type FallRow,
  Dial,
  type ZonaDial,
  type BordeDial,
} from "@/components/analysis/hallazgos/vocabulario";
import {
  DrawerTIRLtr,
  DrawerSensibilidadLtr,
  DrawerDistanciaLtr,
  DrawerPatrimonioLtr,
  DrawerPlusvaliaLtr,
} from "@/components/analysis/drawers/DrawersPropios";
import type {
  HallazgoTIR,
  HallazgoSensibilidad,
  HallazgoPatrimonio,
  HallazgoDistanciaVeredicto,
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
  | "plusvalia"
  // rama superficies-distancia: drawer propio del 10º hallazgo (LTR-only).
  | "distanciaVeredicto";

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
  /** FASE 4 — modo INLINE: renderiza SOLO el cuerpo, sin overlay, panel, header
   *  ni navegación prev/next. Es lo que consume el acordeón de hallazgos, donde
   *  el chrome del drawer murió. Extiende, no muta: sin la prop el componente se
   *  comporta exactamente como antes (lo usa /dev/drawers-pixel). */
  inline?: boolean;
  /** created_at de la fila (ISO). Fecha de análisis CONGELADA para el recompute
   *  cliente de TIR en negociación (tirForPrice) — no la fecha viva del navegador.
   *  Ver of-datedrift-design.md. */
  createdAt?: string;
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
  distanciaVeredicto: { label: "Lo que te separa" },
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
        {renderPlumon(currency === "CLP" ? data.contenido_clp : data.contenido_uf)}
      </p>

      {/* Mensaje educativo (dot pattern Fase 4.8): justifica por qué incluimos
          gastos que otros análisis omiten. */}
      <p className="font-mono text-[11px] mt-1 mb-4 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● A diferencia de otros análisis, Franco considera todos los gastos que impactan tu flujo real: vacancia, mantención, corretaje, recambio y gestión. Una evaluación honesta los incluye.
      </p>

      {/* FASE 4 — el flujo mensual pasa al WATERFALL del vocabulario: el arriendo
          entero como banda y cada egreso comiéndose su parte, con el resultado
          como total. Reemplaza los dos grupos de barras ENTRA/SALE. */}
      <VViz t={`Qué pasa con los ${fmt(arriendo)} del arriendo`}>
        <Fall
          rows={saleItemsSorted
            .filter((r) => r.value > 0)
            .map((r, i) => ({
              k: r.name,
              v: `−${fmt(r.value)}`,
              pct: r.value,
              tone: (i === 0 ? "neutral" : i === 1 ? "warn" : i === 2 ? "muted" : "red") as FallRow["tone"],
              // CORRECCIÓN 5 — el mapeo al waterfall descartaba `tooltip` y se perdían las
              // glosas de cada egreso (contribuciones, provisión de mantención, etc.).
              tip: r.tooltip ? <InfoTooltip content={r.tooltip} /> : undefined,
            }))}
          total={{
            k: isNeg ? "Sale de tu bolsillo" : "Te queda cada mes",
            v: `${isNeg ? "−" : "+"}${fmt(Math.abs(flujo))}`,
          }}
        />
      </VViz>

      <VCierre titulo={data.cajaLabel || "Hazte esta pregunta:"}>{plumonInline(currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf)}</VCierre>
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
  createdAt,
}: {
  data: AINegociacionSection;
  currency: "CLP" | "UF";
  inputData: AnalisisInput;
  results: FullAnalysisResult;
  valorUF: number;
  createdAt?: string;
}) {
  const precioCLP = (inputData.precio || 0) * valorUF;
  const vmFrancoUF = results.metrics?.valorMercadoFrancoUF ?? (inputData.precio || 0);
  const vmFrancoCLP = vmFrancoUF * valorUF;

  const diferenciaCLP = vmFrancoCLP - precioCLP;
  const pctDiferencia = vmFrancoCLP > 0 ? (Math.abs(diferenciaCLP) / vmFrancoCLP) * 100 : 0;
  const esPasada = diferenciaCLP > 0 && pctDiferencia > 2;
  const esSobreprecio = diferenciaCLP < 0 && pctDiferencia > 2;

  // `metricaValorONull`, no `metricaODefault(…, 0)`: con la TIR ausente el 0 de
  // relleno se pintaba como una TIR real de 0,0% en Signal Red y alimentaba el
  // gate `tirActual > 6`. `fmtTir` y `tirColor` ya tratan null como "—" en gris,
  // así que la ausencia se muestra sin inventarle un número.
  const tirActual = metricaValorONull(results.exitScenario?.tir);
  // Pie cero (fase 3b · D2, mockup 98e2319): sin capital propio el beneficio de
  // negociar se mide en PLATA MENSUAL, no en TIR — la columna TIR pasa a
  // "Tu flujo/mes", la fila Límite (techo de retorno) se suprime y los
  // escenarios −5%/−10% se muestran como baja de dividendo.
  const mtr = results.metrics;
  const sinPie = mtr ? mtr.pieCLP === 0 : inputData.piePct === 0;
  const neg = results.negociacion;

  // Fallbacks si el análisis es viejo (sin motor.negociacion): recomputar en el
  // cliente con el mismo helper del motor (fuente única de verdad).
  const negData = useMemo(() => {
    if (neg) return neg;
    // Fecha de análisis congelada (created_at, no la viva) para el recompute de TIR
    // del fallback de negociación. of-datedrift-design.md.
    const asOf = createdAt ? new Date(createdAt) : new Date();
    const baseSugerido = Math.min(inputData.precio, vmFrancoUF);
    const precioSugUF = Math.round(baseSugerido * 0.97 * 10) / 10;
    // Pie cero: la TIR no aplica — el render plata-mensual no la consume y la
    // bisección del límite (techo de TIR) se omite entera.
    const tirSug = sinPie ? 0 : tirForPrice(inputData, precioSugUF, valorUF, asOf);
    const tirVm = sinPie ? 0 : tirForPrice(inputData, vmFrancoUF, valorUF, asOf);
    // Precio límite por bisección simple solo si la TIR actual es > 6
    let precioLimUF: number | null = null;
    let tirLim: number | null = null;
    if (!sinPie && tirActual !== null && tirActual > 6) {
      let lo = inputData.precio;
      // P2 (Fase 20): rango ampliado a vmFranco × 1.5 (era × 1.3) para que
      // Límite ≥ vmFranco en deals con ventaja extrema (>30% bajo mercado).
      let hi = Math.max(inputData.precio * 1.5, vmFrancoUF * 1.5);
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const t = tirForPrice(inputData, mid, valorUF, asOf);
        // Candidato sin TIR reportable: se descarta subiendo el piso, NO se trata
        // como TIR=0 (espejo exacto de calcNegociacionScenario en el motor).
        if (t === null) { lo = mid; continue; }
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
  }, [neg, inputData, vmFrancoUF, valorUF, tirActual, createdAt, sinPie]);

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
  const precioLimiteCLP = negData.precioLimiteCLP;
  // Jerarquía de precios (motor decide, drawer obedece): si el sugerido quedó fijado por
  // el umbral de veredicto, la escalera lo nombra como tal. Valores TIPADOS del motor.
  const mandadoPorVeredicto = negData.sugeridoMandadoPorVeredicto === true;
  const destinoUmbral =
    negData.veredictoAlUmbral === "COMPRAR" ? "Comprar" : "Ajusta supuestos";
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
  // Pie cero (D2): dividendo y flujo mensual estimados al cerrar a un precio
  // dado, con la MISMA estructura del análisis (piePct/tasa/plazo declarados).
  // Motor real (calcDividendo), nunca cifras hardcodeadas.
  const dividendoAt = (precioCLPTarget: number) =>
    calcDividendo(
      precioCLPTarget * (1 - (inputData.piePct ?? 0) / 100),
      inputData.tasaInteres,
      inputData.plazoCredito,
    );

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

  // La tabla comparativa de 4 filas y su escala (`maxPrecio`/`barW`) murieron con la
  // conversión 16: codificaban precio absoluto desde cero y no podían mostrar una
  // diferencia de un dígito porcentual. El eje de veredicto ocupa su lugar.

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
      {/* ═══ CONVERSIÓN 16 (FASE 4.2) — el eje de veredicto reemplaza la tabla ═══
          La tabla de cuatro barras codificaba PRECIO ABSOLUTO desde cero
          (barW = v / maxPrecio). Con cuatro precios que difieren ~10% entre sí, las
          cuatro barras caían entre el 65% y el 95% del ancho: la diferencia que decide
          el veredicto quedaba indistinguible del ruido. Una barra desde cero no puede
          mostrar una diferencia de un dígito porcentual. El eje posicional sí codifica
          lo que cambia — en qué veredicto cae cada precio. */}
      {(() => {
        const umbral = precioSugeridoCLP > 0 ? precioSugeridoCLP : null;
        const limite = precioLimiteCLP != null && precioLimiteCLP > 0 ? precioLimiteCLP : null;
        if (!umbral || !(precioCLP > 0)) return null;
        const puntos = [precioCLP, umbral, ...(limite ? [limite] : [])];
        const ejeMin = Math.min(...puntos) * 0.94;
        const ejeMax = Math.max(...puntos) * 1.06;
        const pos = (x: number) => ((x - ejeMin) / (ejeMax - ejeMin)) * 100;
        const pUmbral = pos(umbral);
        const pLimite = limite ? pos(limite) : 100;
        const zonas: ZonaDial[] = [
          { k: destinoUmbral, pct: pUmbral, tono: "comprar" },
          { k: "Como está hoy", pct: pLimite - pUmbral, tono: "ajusta" },
          ...(limite ? [{ k: "", pct: 100 - pLimite, tono: "buscar" as const }] : []),
        ];
        const bordes: BordeDial[] = [
          {
            pos: pUmbral,
            delta: `−${(((precioCLP - umbral) / precioCLP) * 100).toFixed(1).replace(".", ",")}%`,
            v: fmtPrecio(umbral),
            k: `bajo esto sube a ${destinoUmbral}${tirAlSugerido != null ? ` · TIR ${fmtTir(tirAlSugerido)}` : ""}`,
            dir: "abajo",
          },
          ...(limite
            ? [
                {
                  pos: pLimite,
                  delta: `+${(((limite - precioCLP) / precioCLP) * 100).toFixed(1).replace(".", ",")}%`,
                  v: fmtPrecio(limite),
                  k: `sobre esto no compensa${tirAlLimite != null ? ` · TIR ${fmtTir(tirAlLimite)}` : ""}`,
                  dir: "arriba" as const,
                },
              ]
            : []),
        ];
        return (
          <VViz t="Qué veredicto tiene este depto según el precio">
            <Dial
              zonas={zonas}
              marcaPct={pos(precioCLP)}
              marcaK="Tu precio"
              marcaV={fmtPrecio(precioCLP)}
              bordes={bordes}
            />
          </VViz>
        );
      })()}

      {/* Pie cero (D2): escenarios −5%/−10% en plata mensual + el número que
          cambia la conclusión. Motor real (calcDividendo), sin cifras fijas. */}
      {sinPie && mtr && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[0.05, 0.1].map((d) => {
              const nuevoDiv = dividendoAt(precioCLP * (1 - d));
              const baja = mtr.dividendo - nuevoDiv;
              const creditoBaja = precioCLP * d * (1 - (inputData.piePct ?? 0) / 100);
              return (
                <div
                  key={d}
                  className="rounded-[8px] p-3.5"
                  style={{ background: "var(--franco-elevated)", border: "0.5px solid var(--franco-border)" }}
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] m-0 mb-1.5">
                    Negociando −{Math.round(d * 100)}%
                  </p>
                  <p className="font-mono font-bold text-[17px] m-0 mb-1 text-[var(--franco-text)]">
                    −{fmtFull(baja)}/mes
                  </p>
                  <p className="font-body text-[10.5px] leading-[1.45] text-[var(--franco-text-secondary)] m-0">
                    El crédito baja {fmtShort(creditoBaja)} → el dividendo cae a {fmtFull(nuevoDiv)} y tu flujo mejora exactamente eso.
                  </p>
                </div>
              );
            })}
          </div>
          <div
            className="rounded-r-[8px] p-4"
            style={{
              borderLeft: "3px solid var(--franco-text)",
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--franco-text-secondary)] m-0 mb-1.5">
              El número que vale la pena pelear
            </p>
            <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
              Cerrando en{" "}
              <b className="font-mono font-bold">
                UF {Math.round(negData.precioSugeridoUF).toLocaleString("es-CL")}
              </b>{" "}
              ({precioCLP > 0 ? `−${((1 - precioSugeridoCLP / precioCLP) * 100).toFixed(1).replace(".", ",")}%` : ""}) el dividendo baja{" "}
              <b className="font-mono font-bold">{fmtFull(mtr.dividendo - dividendoAt(precioSugeridoCLP))}/mes</b>
              {mandadoPorVeredicto
                ? ` y el veredicto sube a ${destinoUmbral}. No es alinearse con comparables: es cambiar la conclusión.`
                : " — tu flujo mejora exactamente eso."}
            </p>
          </div>
        </>
      )}

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
            {renderPlumon(currency === "CLP" ? data.contenido_clp : data.contenido_uf)}
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
        <VCierre titulo={data.cajaLabel || "Qué haces con esto"}>
          {plumonInline(currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf)}
        </VCierre>
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
}: {
  data: AISection;
  currency: "CLP" | "UF";
}) {
  // paridad drawer STR — prose-only. El waterfall de patrimonio se retiró (espejo del
  // strip STR, decisión Fabrizio): vive en DrawerPatrimonioLtr. Este drawer es el JUICIO
  // del horizonte (contrafactual de instrumentos + condicional de plusvalía + posición) y
  // NO recita equity/valor/flujo (guard en el prompt v2). Antes traía un waterfall b3Rows
  // que duplicaba el drawer patrimonio y estaba huérfano desde la migración grid→pirámide.
  const contenido = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
  const caja = currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf;
  if (!contenido?.trim()) {
    return (
      <p className="font-body text-[14px] leading-[1.65] text-[var(--franco-text-secondary)]">
        Franco está preparando este detalle…
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {/* ─── VS. OTRO INSTRUMENTO (largoPlazo.contenido) ─── depósito UF / fondo mutuo +
          costo de oportunidad ajustado por esfuerzo. NO recita la planilla de patrimonio. */}
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
          {renderPlumon(contenido)}
        </p>
      </div>

      {/* ─── La apuesta que haces (narrativa IA editorial) ─── */}
      <VCierre titulo={data.cajaLabel || "La apuesta que haces"}>{plumonInline(caja)}</VCierre>
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
  inputData,
  createdAt,
}: {
  data: AIReestructuracionSection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  valorUF: number;
  inputData?: AnalisisInput;
  createdAt?: string;
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
        {renderPlumon(content)}
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

      {/* CONVERSIÓN 17 · la escalera va también en la rama con prosa IA: es el mismo
          hallazgo ("cómo estás financiando") y el trade-off del pie no depende de que
          la IA haya escrito su bloque. */}
      <EscaleraPie
        input={inputData}
        valorUF={valorUF}
        asOf={createdAt ? new Date(createdAt) : undefined}
        flujoPersistido={results.metrics?.flujoNetoMensual}
        precioCLPPersistido={results.metrics?.precioCLP}
        currency={currency}
      />
    </div>
  );
}

// Fallback del drawer de estructura/financiamiento: cuando NO existe
// aiAnalysis.reestructuracion (salud financiera sana, sin Nivel 3), el "ver
// detalle" del hallazgo estructura abre este contenido liviano solo-motor. Sin
// IA, sin chart. BIFURCA por direccion del hallazgo (fase 3b · D4): favorable →
// confirma que la estructura está sana; adverso → estructura tensionada (intro
// del hallazgo o del caso pie 0, vacancia en plata, palanca honesta).
// Estilo sobrio de DrawerCapexPuestaAPunto.
function DrawerEstructuraSana({
  hallazgo,
  results,
  currency,
  valorUF,
  inputData,
  createdAt,
}: {
  hallazgo: HallazgoEstructuraFinanciamiento;
  results: FullAnalysisResult;
  currency: "CLP" | "UF";
  valorUF: number;
  // La escalera del pie recompute sobre un clon del input: necesita el input y la
  // fecha del análisis (sin ella los meses hasta la entrega saldrían de "hoy").
  inputData?: AnalisisInput;
  createdAt?: string;
}) {
  const { piePct, tasaPct, tasaMarketPct, driver } = hallazgo.valor;
  const cuotaActual = results.metrics?.dividendo ?? 0;
  const pieFmt = Number.isInteger(piePct) ? String(piePct) : piePct.toFixed(1).replace(".", ",");

  // Pie cero (fase 3b · D4, mockup 98e2319): el drawer deja de ser fallback
  // ciego y BIFURCA por direccion del hallazgo. Favorable → texto "sana" de
  // siempre. Adverso → estructura tensionada (el caso pie 5% que antes caía en
  // "está sana" ahora cae acá), con pie 0 como caso extremo.
  const adverso = hallazgo.direccion === "adverso";
  const sinPie = piePct === 0;
  const m = results.metrics;
  // Obligaciones duras del dueño en un mes sin arrendatario: dividendo + GGCC
  // + contribuciones mensualizadas (m.contribuciones viene trimestral).
  const contribMes = m ? Math.round(m.contribuciones / 3) : 0;
  const vacanciaMes = m ? Math.round(m.dividendo + m.gastos + contribMes) : null;
  const creditoCLP = m ? m.precioCLP - m.pieCLP : null;
  // Spread de display sobre tasas ya redondeadas (round-una-vez, misma
  // convención que la fraseCanonica del hallazgo).
  const spreadDisplayPts = Math.abs(
    Math.round((Math.round(tasaPct * 10) / 10 - Math.round(tasaMarketPct * 10) / 10) * 100),
  );
  const tasaSobreMercado = Math.round(tasaPct * 10) / 10 > Math.round(tasaMarketPct * 10) / 10;

  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>
          {!adverso
            ? "Tu estructura de financiamiento está sana: el pie y la tasa no están frenando el deal."
            : sinPie
              ? "Tu estructura de financiamiento está tensionada: financias el 100% con crédito, el dividendo queda en su punto más alto y no hay colchón de capital."
              : hallazgo.fraseCanonica}
        </span>
        <InfoTooltip
          content={
            !adverso
              ? "Cuando el pie y la tasa están en rango, el problema —si lo hay— está en el precio o el flujo, no en cómo financias."
              : "Con la estructura fuera de rango el financiamiento no acompaña: la cuota queda más alta y el margen ante imprevistos, menor."
          }
        />
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
          {sinPie && creditoCLP !== null
            ? `Financiamiento 100% · tasa de mercado ${tasaMarketPct.toFixed(1).replace(".", ",")}%${tasaSobreMercado ? ` (+${spreadDisplayPts} pts)` : ""} · crédito ${fmtMoney(creditoCLP, currency, valorUF)}.`
            : `Tasa de mercado ${tasaMarketPct.toFixed(1).replace(".", ",")}%.`}
        </p>
      </div>

      {/* ═══ CONVERSIÓN 17 (FASE 4.2) · ESCALERA DEL PIE ═══
          Reemplaza la referencia de "óptimo de pie 25%". Ese 25 se rastreó hasta el
          fondo y no tiene fundamento: no marca umbral de mejora de tasa, ni el punto
          donde el flujo cruza a neutro, ni un requisito bancario — es una convención
          adoptada en may-2026 y nunca cuestionada. Dibujarla como referencia le habría
          dado autoridad de dato. Acá no se declara ningún óptimo: se muestra el
          intercambio calculado y el lector decide según su liquidez. */}
      <EscaleraPie
        input={inputData}
        valorUF={valorUF}
        asOf={createdAt ? new Date(createdAt) : undefined}
        flujoPersistido={results.metrics?.flujoNetoMensual}
        precioCLPPersistido={results.metrics?.precioCLP}
        currency={currency}
      />

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

      {!adverso ? (
        /* Bloque conclusivo — sin palanca urgente (estado a favor, texto de siempre) */
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
      ) : (
        /* Estado en contra (D4): la vacancia en plata + dónde está la palanca.
           Signal Red legítimo: monto negativo crítico que sale del bolsillo (uso #2). */
        <>
          {vacanciaMes !== null && m && (
            <div
              className="rounded-r-[8px] p-4 mb-4"
              style={{
                borderLeft: "3px solid var(--signal-red)",
                background: "color-mix(in srgb, var(--signal-red) 7%, transparent)",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--signal-red)] m-0 mb-1">
                Un mes de vacancia, en plata
              </p>
              <p className="font-mono font-bold text-[22px] leading-[1.1] text-[var(--signal-red)] m-0 mb-1">
                {fmtMoney(vacanciaMes, currency, valorUF)}
              </p>
              <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
                Sin arrendatario pagas el mes completo de tu bolsillo: dividendo {fmtMoney(m.dividendo, currency, valorUF)} + gastos comunes {fmtMoney(m.gastos, currency, valorUF)} + contribuciones {fmtMoney(contribMes, currency, valorUF)}.{" "}
                {sinPie
                  ? "Sin colchón de capital, no tienes margen ante vacancia prolongada o un alza de tasa al renovar."
                  : "Con la cuota en este nivel, una vacancia prolongada o un alza de tasa al renovar pegan directo en tu flujo."}
              </p>
            </div>
          )}
          <div
            className="rounded-r-[8px] p-4"
            style={{
              borderLeft: "3px solid var(--franco-text)",
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] m-0 mb-1">
              Dónde está la palanca
            </p>
            <p className="font-body text-[12.5px] leading-[1.55] text-[var(--franco-text)] m-0">
              {sinPie
                ? "Acá la palanca no es subir el pie que no tienes: es el precio (cada peso menos es crédito que no tomas) y asegurar flujo estable antes de firmar."
                : driver === "tasa"
                  ? "La palanca acá es la tasa: cotizar en otro banco puede bajar la cuota."
                  : driver === "ambos"
                    ? "Hay palanca en el pie y en la tasa: subir el pie y cotizar la tasa en otro banco bajan la cuota."
                    : "La palanca acá es el pie: subirlo baja el crédito y la cuota, y te acerca al rango sano."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Drawer del hallazgo CapEx puesta a punto (motor, no IA). Muestra los montos
// precomputados + decisividad + procedencia visible (no audit-only).
export function DrawerCapexPuestaAPunto({
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

  // FASE 4 — migrado al VOCABULARIO ÚNICO (2º de los 3 cuerpos con markup a mano).
  return (
    <div>
      <VProsa>
        <p className="inline-flex items-center gap-1 m-0">
          <span>No es remodelar para revender: es dejar el depto en estándar de arriendo para captar el precio de mercado.</span>
          <InfoTooltip content="Pintura, pisos, cocina/baño al día. Un usado sin puesta a punto suele arrendar bajo el precio de mercado de la zona." />
        </p>
      </VProsa>

      <VViz t="Puesta a punto estimada">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>
              Inversión
            </p>
            <p className="font-mono font-bold m-0" style={{ fontSize: 20, lineHeight: 1.05, color: "var(--doc-tx)" }}>{montoFmt}</p>
          </div>
          <div>
            <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>
              Por m²
            </p>
            <p className="font-mono font-bold m-0" style={{ fontSize: 20, lineHeight: 1.05, color: "var(--doc-tx)" }}>
              {ufM2.toFixed(1).replace(".", ",")} <span style={{ fontSize: 13, fontWeight: 500 }}>UF/m²</span>
            </p>
          </div>
          <div>
            <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>
              De tu plata día 1
            </p>
            <p
              className="font-mono font-bold m-0"
              style={{ fontSize: 20, lineHeight: 1.05, color: hallazgo.valor.fraccionInversion > 0.2 ? "var(--signal-red)" : "var(--doc-tx)" }}
            >
              {pctInversion}%
            </p>
          </div>
        </div>
        <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginTop: 12 }}>
          Depto de {antiguedadAnios} años · {superficieUtilM2} m² útiles.
        </p>
      </VViz>

      <VFuente>{procedenciaExtendida(hallazgo, currency, valorUF)}</VFuente>
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
  // Banda "en línea" (|gap| < 0,2 — direccion "neutral" en hallazgos nuevos). Se deriva
  // del gap y no de direccion para cubrir también filas legacy persistidas (binarias).
  const enLinea = Math.abs(gapPts) < 0.2;
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

  // FASE 4 — migrado al VOCABULARIO ÚNICO (era uno de los 3 cuerpos con markup
  // duplicado a mano). Mantra visual-first: el termómetro muestra dónde cae el
  // cap rate frente a la referencia; la prosa deja de contar lo que se ve.
  const rango = Math.max(capRatePct, capRefPct) * 1.35 || 1;
  return (
    <div>
      <VProsa>
        <p className="inline-flex items-center gap-1 m-0">
          <span>El cap rate es lo que el depto renta al año, como % del precio, antes de la deuda.</span>
          <InfoTooltip content="Cap rate = arriendo anual neto (tras gastos operativos, antes de la cuota del crédito) ÷ precio. Mide la rentabilidad del activo, sin el efecto del crédito." />
        </p>
      </VProsa>

      <VViz t="Dónde cae tu rendimiento frente a la referencia">
        <Thermo
          pct={(capRatePct / rango) * 100}
          refPct={(capRefPct / rango) * 100}
          legend={[
            { k: "Tu cap rate", v: `${pct(capRatePct)}%` },
            { k: "Referencia", v: `${pct(capRefPct)}%` },
            { k: "Brecha", v: `${gapPts > 0 ? "+" : gapPts < 0 ? "−" : ""}${pct(Math.abs(gapPts))} pts` },
          ]}
        />
        <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginTop: 12 }}>
          Hoy: {fmt(noiAnual)} netos al año sobre un precio de {fmt(precioCLP)}.
        </p>
      </VViz>

      <VCierre
        titulo={adverso ? "Qué haces con esto" : enLinea ? "Qué significa" : "Qué significa"}
      >
        {adverso ? (
          <>
            <span className="font-mono font-bold" style={{ fontSize: 20, fontStyle: "normal", marginRight: 8 }}>
              {fmt(arriendoObjetivo)}/mes
            </span>
            Hoy arriendas en {fmt(arriendoActual)}. Para rendir como la referencia de mercado ({pct(capRefPct)}%)
            necesitarías arrendar en torno a {fmt(arriendoObjetivo)} al mes — o pagar menos por el depto.
          </>
        ) : enLinea ? (
          <>
            Tu arriendo de {fmt(arriendoActual)} al mes renta lo esperable para la referencia de mercado (
            {pct(capRefPct)}%). Ni ventaja ni castigo por este lado: el caso se decide en las otras piezas.
          </>
        ) : (
          <>
            Tu arriendo de {fmt(arriendoActual)} al mes ya renta por sobre la referencia de mercado (
            {pct(capRefPct)}%). El activo trabaja a tu favor.
          </>
        )}
      </VCierre>

      <VFuente>{procedenciaExtendida(hallazgo, currency, valorUF)}</VFuente>
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
  inline = false,
  zoneInsight,
  zoneLoading,
  zoneError,
  zoneCenter,
  comuna,
  arriendoUsuarioCLP,
  createdAt,
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
  const distanciaHallazgo = results.hallazgos?.find(
    (h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto",
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
  const distanciaTitle = "¿Qué tendría que pasar para que suba?";
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
                    : activeKey === "distanciaVeredicto"
                      ? ({ pregunta: distanciaTitle } as { pregunta: string })
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
    if (inline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && nextKey) onNavigate(nextKey);
      if (e.key === "ArrowLeft" && prevKey) onNavigate(prevKey);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, nextKey, prevKey, inline]);

  useEffect(() => {
    if (inline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [inline]);

  // Cuerpo del drawer — lo comparten el modo overlay (histórico) y el modo
  // INLINE del acordeón de hallazgos (FASE 4).
  const cuerpoDrawer = (
    <>
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
          createdAt={createdAt}
        />
      )}
      {activeKey === "reestructuracion" &&
        (aiAnalysis.reestructuracion ? (
          <DrawerReestructuracion
            data={aiAnalysis.reestructuracion}
            currency={currency}
            results={results}
            valorUF={valorUF}
            inputData={inputData}
            createdAt={createdAt}
          />
        ) : estructuraHallazgo ? (
          <DrawerEstructuraSana
            hallazgo={estructuraHallazgo}
            results={results}
            currency={currency}
            valorUF={valorUF}
            inputData={inputData}
            createdAt={createdAt}
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
      {activeKey === "distanciaVeredicto" &&
        (distanciaHallazgo ? (
          <DrawerDistanciaLtr hallazgo={distanciaHallazgo} currency={currency} valorUF={valorUF} />
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

    </>
  );

  // Modo INLINE: el acordeón ya aporta encabezado, ancla y cierre.
  if (inline) return cuerpoDrawer;

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

          {cuerpoDrawer}

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
