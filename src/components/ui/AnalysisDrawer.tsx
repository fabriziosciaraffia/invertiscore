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

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, nunca literal.
import { InfoTooltip } from "@/components/ui/tooltip";
import { renderPlumon, plumonInline } from "@/components/analysis/hallazgos/plumon";
import { EscaleraPie } from "@/components/analysis/hallazgos/escalera-pie";
import { EscaleraPlazo } from "@/components/analysis/hallazgos/escalera-plazo";
import { EstructuraComparada } from "@/components/analysis/hallazgos/estructura-comparada";
import { simularPie, simularPlazo } from "@/lib/analysis";
import { MARKET_AVG_TASA_UF } from "@/lib/financing-health";
import {
  VProsa,
  VViz,
  VCierre,
  VCollapse,
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
import { ZonaCeldas } from "@/components/zone-insight/ZoneInsightMiniCard";
import { ZoneMap } from "@/components/zone-insight/ZoneMap";

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
  /** La prosa PUEDE faltar: un informe sin redacción IA sigue mostrando sus
   *  hallazgos (todos deterministas del motor). Los cuerpos que la necesitan
   *  traen su propio guard. */
  aiAnalysis: AIAnalysisV2 | null;
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
      // #17 pasada tooltips — el supuesto del modelo (0,3-1,5% según antigüedad)
      // subió al VFuente del cuerpo; el ⓘ queda como definición.
      tooltip: "Provisión mensual para reparaciones y mantenimiento del depto.",
    },
    {
      name: "Corretaje",
      value: desglose.corretajeProrrata,
      tooltip: "Comisión del corredor para captar arrendatario, prorrateada al mes.",
    },
    {
      name: "Recambio",
      value: desglose.recambio,
      tooltip: "Costo de turnover entre arrendatarios: pintura, limpieza profunda y reparaciones menores.",
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
      <div className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-4 whitespace-pre-wrap">
        {renderPlumon(currency === "CLP" ? data.contenido_clp : data.contenido_uf)}
      </div>

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

      {/* T4 (contrato CONGELADO): la fuente cita, no explica. Los supuestos del
          modelo (mantención por antigüedad, recambio) viven en "Cómo se calcula". */}
      <VFuente>Motor Franco · flujo mensual del análisis</VFuente>
    </div>
  );
}

// ─── Negociación drawer ─────────────────────────────

function DrawerNegociacion({
  data: dataProp,
  currency,
  inputData,
  results,
  valorUF,
  createdAt,
}: {
  /** Puede llegar UNDEFINED: ver el guard de abajo. */
  data: AINegociacionSection | undefined;
  currency: "CLP" | "UF";
  inputData: AnalisisInput;
  results: FullAnalysisResult;
  valorUF: number;
  createdAt?: string;
}) {
  // GUARD DE PROSA AUSENTE (GOAL 16). El caller pasa `aiAnalysis?.[activeKey]`
  // SIN comprobar que exista —a diferencia de `reestructuracion`, que sí tiene su
  // ternario— y este cuerpo leía `data.estrategiaSugerida_*` de entrada: con la
  // prosa ausente reventaba con "Cannot read properties of undefined" y el
  // ErrorBoundary se comía la PÁGINA ENTERA, no solo el cuerpo.
  //
  // Latente hasta hoy porque `negociacion` está en toda prosa persistida. Lo
  // destapó el bump a v13: mientras el informe regenera su prosa stale, la
  // sección no está, y el bump deja stale al parque LTR completo — o sea que sin
  // este guard el crash pasaba de imposible a garantizado durante toda la ventana
  // de drenado. Reproducido en /analisis/1920fd35-… con el motor en v13.
  //
  // Degrada a objeto vacío en vez de a un placeholder: casi todo este cuerpo es
  // DETERMINISTA (hero de veredicto, eje del Dial, escenarios de pie cero) y sale
  // de `results`, no de la IA. Con `{}` el lector conserva el diagrama y pierde
  // solo lo que de verdad depende del texto; las piezas IA ya se auto-guardan
  // (`data.precios &&`, el fallback de `estrategia`, el ternario del cierre).
  const data = dataProp ?? ({} as AINegociacionSection);

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

      {/* GOAL 16 — el ARGUMENTO, en su lugar del v12. Lo que sobrevive de
          `negociacion.contenido` tras el recorte es la razón que el comprador pone
          sobre la mesa (y, condicional, la palanca de financiamiento): eso es
          prosa de encuadre, así que va PRIMERO y como `VProsa`, respetando el
          orden congelado [prosa] → viz⁺ → cierre → fuente. La caja "Aunque
          negocies al máximo" murió con su rótulo y su marco; el argumento no.
          Un guard de presupuesto (40 palabras) y otro de precios del plan lo
          mantienen en una o dos frases que no repiten nada de abajo. */}
      {(currency === "CLP" ? data.contenido_clp : data.contenido_uf)?.trim() && (
        <VProsa>{plumonInline(currency === "CLP" ? data.contenido_clp : data.contenido_uf)}</VProsa>
      )}

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
        // AUDITORÍA fase42 (3) — las zonas nombran su VEREDICTO, no la posición
        // ("Como está hoy" no decía qué veredicto rige ahí). La del medio es el
        // veredicto de esa banda: AJUSTA cuando bajo el sugerido se llega a COMPRAR;
        // si el sugerido solo alcanza AJUSTA, la banda del medio es BUSCAR OTRA (y su
        // tono acompaña). La roja lleva su nombre; en zonas angostas el Dial lo oculta.
        const kMedio = destinoUmbral === "Comprar" ? "Ajusta supuestos" : "Buscar otra";
        const zonas: ZonaDial[] = [
          // El TONO sigue al veredicto, no a la posición. fase42 (3) arregló las
          // etiquetas y dejó este `tono` fijo en "comprar": la primera zona se
          // pintaba verde por ser la mejor del eje, aunque su veredicto fuera
          // AJUSTA SUPUESTOS (visto en Peñalolén — banda rotulada AJUSTA y pintada
          // de COMPRAR). Verde es el color de COMPRAR, no el de "la zona buena".
          { k: destinoUmbral, pct: pUmbral, tono: destinoUmbral === "Comprar" ? "comprar" : "ajusta" },
          { k: kMedio, pct: pLimite - pUmbral, tono: destinoUmbral === "Comprar" ? "ajusta" : "buscar" },
          ...(limite ? [{ k: "Buscar otra", pct: 100 - pLimite, tono: "buscar" as const }] : []),
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

      {/* GOAL 16 — "Aunque negocies al máximo" se desarmó. El bloque narraba dos
          cifras que ya viven abajo con forma propia: el break-even de caja (ahora
          CHIP determinista del plan, leído del motor) y el techo (slot del plan,
          impreso a dos centímetros). Medido sobre las 318 prosas v12 del parque:
          65% citaba el techo, 63% narraba el break-even y un 6% arrastraba además
          la frase-puente que solo existía para desambiguar su propia duplicación.
          Peor que la duplicación: en la rama sin descuento (28 casos) 9 narraban
          una rebaja que el motor prohíbe, y en el demo de la landing la cifra
          estaba FABRICADA (UF 2.676 contra UF 3.262,65 del motor, con el signo
          invertido). Lo que el campo sí aporta —el argumento negociador y la
          palanca de financiamiento— sigue vivo en el contrato del prompt v13, que
          ahora tiene prohibido citar los precios del plan.
          El párrafo IA ya no se renderiza acá. */}

      {/* AUDITORÍA fase42 (7c) — la caja "Estrategia sugerida" murió: narraba los
          mismos montos del plan impreso debajo (duplicación literal). El cierre es
          UNO: la cajaAccionable de la IA si existe; si no (cache pre-v9 o IA muda),
          la estrategia ocupa su lugar como cierre — nunca las dos apiladas. */}
      {data.precios && (
        <PlanNegociacion
          precios={data.precios}
          currency={currency}
          precioActualCLP={precioCLP}
          valorUF={valorUF}
          neutroUF={mtr?.precioFlujoNeutroUF}
          neutroCLP={mtr?.precioFlujoNeutroCLP}
          descuentoNeutroPct={mtr?.descuentoParaNeutro}
          sinCredito={(inputData.piePct ?? 0) >= 100}
        />
      )}

      {/* T1 — la línea de fuente (el bullet educativo de Fase 4.8) baja al pie del
          cuerpo, formato del v12. */}
      {(() => {
        const caja = currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf;
        // D-16 — el título del cierre va sin ":" final (la IA a veces lo trae).
        const tituloCierre = (data.cajaLabel || "Qué haces con esto").replace(/\s*:\s*$/, "");
        return caja ? (
          <VCierre titulo={tituloCierre}>{plumonInline(caja)}</VCierre>
        ) : (
          <VCierre titulo="Qué haces con esto">{estrategia}</VCierre>
        );
      })()}

      <VFuente>Mediana de publicaciones de venta en {inputData.comuna || "la comuna"} · avisos, no transacciones</VFuente>
    </div>
  );
}

// ─── Fase 3.6 v9 — Plan de negociación (3 slots) ──────────────────────────
// Patrón 2 (zona): Ink neutro, sin Signal Red. Slots apilados con border-left
// Ink secundario. Cada slot: label mono uppercase + precio mono bold + glosa.
function PlanNegociacion({
  precios,
  currency,
  precioActualCLP,
  valorUF,
  neutroUF,
  neutroCLP,
  descuentoNeutroPct,
  sinCredito,
}: {
  precios: NonNullable<AINegociacionSection["precios"]>;
  currency: "CLP" | "UF";
  /** Tu precio (el del análisis): ancla de los deltas del plan (fase42 (4)). */
  precioActualCLP: number;
  /** Para la forma compacta del chip. */
  valorUF: number;
  /** Precio al que la CAJA queda en cero (`calcPrecioParaFlujo(0,…)` del motor,
   *  persistido en metrics). Opcional: los análisis anteriores al campo no lo
   *  traen y el chip no se dibuja. */
  neutroUF?: number;
  neutroCLP?: number;
  /** `(precio − neutro)/precio × 100`. Su SIGNO decide la rama del chip. */
  descuentoNeutroPct?: number;
  /** Pie 100%: no hay crédito, así que no hay cuota que cubrir. */
  sinCredito?: boolean;
}) {
  const fmtPrecio = (clp: number, uf: number) => {
    if (currency === "UF") return `UF ${Math.round(uf).toLocaleString("es-CL")}`;
    return "$" + Math.round(clp).toLocaleString("es-CL");
  };

  const glosaPrimera = (currency === "CLP" ? precios.glosaPrimeraOferta_clp : precios.glosaPrimeraOferta_uf) || "";
  const glosaTecho = (currency === "CLP" ? precios.glosaTecho_clp : precios.glosaTecho_uf) || "";
  const glosaWalk = (currency === "CLP" ? precios.glosaWalkAway_clp : precios.glosaWalkAway_uf) || "";

  // AUDITORÍA fase42 (4) — cada precio del plan lleva sus descuentos (aprobado en
  // propuesta-16-15-v2): contra tu precio, y la primera oferta además contra el
  // techo. Ahí se ve la estrategia que era invisible: cuánto margen deja la
  // apertura antes de tocar el techo. El % es el mismo en CLP y UF, así que se
  // calcula una vez sobre CLP.
  const deltaPct = (menor: number, mayor: number) =>
    mayor > 0 && menor > 0 && menor < mayor ? ((1 - menor / mayor) * 100).toFixed(1).replace(".", ",") : null;
  const chip = (b: string | null, resto: string) => (b ? { b: `−${b}%`, resto } : null);
  const noNulos = (xs: Array<{ b: string; resto: string } | null>) =>
    xs.filter((x): x is { b: string; resto: string } => x !== null);

  // Item 1 Sesión B2: cuando primeraOferta == techo (modo cerrar_actual del
  // motor), ambos slots muestran el mismo número. Fusionamos en uno solo.
  const slotsUnificados = precios.primeraOferta_uf === precios.techo_uf;
  const slots: Array<{ label: string; valor: string; glosa: string; razon?: string; deltas?: Array<{ b: string; resto: string }> }> = slotsUnificados
    ? [
        {
          label: "Oferta única",
          valor: fmtPrecio(precios.techo_clp, precios.techo_uf),
          glosa: glosaTecho || glosaPrimera || "Cierra a este precio — no hay margen para negociar a la baja.",
          deltas: noNulos([chip(deltaPct(precios.techo_clp, precioActualCLP), "de tu precio")]),
        },
      ]
    : [
        {
          label: "Primera oferta",
          valor: fmtPrecio(precios.primeraOferta_clp, precios.primeraOferta_uf),
          glosa: glosaPrimera || "Con qué número partir.",
          deltas: noNulos([
            chip(deltaPct(precios.primeraOferta_clp, precioActualCLP), "de tu precio"),
            chip(deltaPct(precios.primeraOferta_clp, precios.techo_clp), "bajo tu techo"),
          ]),
        },
        {
          label: "Techo",
          valor: fmtPrecio(precios.techo_clp, precios.techo_uf),
          glosa: glosaTecho || "Hasta dónde subir si rechazan.",
          deltas: noNulos([chip(deltaPct(precios.techo_clp, precioActualCLP), "de tu precio")]),
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

  // ── CHIP DE CAJA EN CERO (GOAL 16) ───────────────────────────────────────
  // El número sale del motor (`metrics.precioFlujoNeutro*`), no de la IA ni de un
  // recálculo en cliente: `calcMetrics` ya lo persiste y leerlo acá es la única
  // forma de que el chip y el motor no puedan divergir.
  //
  // NO ES UN SLOT, y por eso cuelga del rótulo en vez de sumarse a la lista: un
  // cuarto slot lo leería como "un precio más para ofrecer", que es exactamente lo
  // que la glosa viene a desmentir. Colgado del encabezado queda como el MARCO
  // dentro del cual se leen los tres precios que sí se ofrecen.
  //
  // TRES RAMAS, porque el motor tiene tres (espejo de `lecturaPrecioFlujoNeutro`):
  // el equilibrio bajo el precio (91% del parque), en o sobre el precio (9%) y el
  // que no existe. La rama del medio NUNCA muestra el número como delta: un
  // "+2,0%" junto a "−14,4% de tu precio" se lee como otra oferta posible, cuando
  // dice justo lo contrario — que ningún descuento llega hasta ahí.
  const chipCaja = (() => {
    // Pie 100% ⇒ NO HAY CHIP. `calcPrecioParaFlujo` devuelve 0 cuando el
    // financiamiento es 0, igual que cuando el arriendo no cubre los gastos
    // fijos — pero son dos cosas distintas y una sola glosa mentía en una de
    // ellas. Medido sobre el parque: de las 16 filas sin equilibrio, **15 son
    // pie 100%** y solo 1 es el caso del arriendo insuficiente. Sin crédito no
    // hay cuota que cubrir, así que la pregunta "¿a qué precio la caja queda en
    // cero?" no aplica; dibujar "no existe" la respondería con una causa falsa.
    if (sinCredito) return null;
    const dto = descuentoNeutroPct;
    const hayNeutro = typeof neutroUF === "number" && neutroUF > 0 && typeof neutroCLP === "number" && neutroCLP > 0;
    if (!hayNeutro || typeof dto !== "number") {
      // Sin dato (análisis anterior al campo) el chip no se dibuja: distinto de
      // "no existe", que sí es una respuesta del motor.
      if (!hayNeutro && typeof dto === "number") {
        return {
          valor: "no existe",
          delta: null,
          glosa: "Con esta estructura el arriendo no cubre los gastos fijos a ningún precio.",
        };
      }
      return null;
    }
    // Compacto ($106,6M), no completo: el chip comparte fila con el rótulo y el
    // monto entero desbordaba el contenedor en desktop (medido en el shot del
    // demo). Los slots sí van completos — ahí el número es el protagonista.
    const valor = currency === "UF"
      ? `UF ${Math.round(neutroUF!).toLocaleString("es-CL")}`
      : fmtCompact(neutroCLP!, currency, valorUF);
    if (dto > 0) {
      return {
        valor,
        delta: `−${dto.toFixed(1).replace(".", ",")}%`,
        glosa: "No es el número a pelear: es dónde el arriendo alcanza a cubrirlo todo.",
      };
    }
    return {
      valor,
      // Sin delta: la magnitud va en palabras dentro de la glosa, para que no
      // comparta forma con los descuentos negociables de los slots.
      delta: null,
      glosa:
        Math.abs(dto) >= 0.1
          ? `Está ${Math.abs(dto).toFixed(1).replace(".", ",")}% arriba de tu precio: ningún descuento lo alcanza — la caja no se arregla bajando el precio.`
          : "Coincide con tu precio: la caja no se arregla bajando el precio.",
    };
  })();

  return (
    <div className="flex flex-col gap-2.5">
      {/* `paddingRight` = el padding horizontal del slot (16px). Sin él, el chip
          cuelga del borde del CONTENEDOR mientras los montos de los slots cuelgan
          del borde interior de su caja, y el chip sobresalía esos 16px hacia la
          derecha en toda la columna. Con el padding, chip y montos comparten línea
          de fuga. El rótulo de la izquierda NO se mueve: alinea con la glosa y con
          el resto de los encabezados de sección. */}
      <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap" style={{ paddingRight: 16 }}>
        <p
          className="font-mono uppercase m-0"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--franco-text-secondary)",
            fontWeight: 600,
          }}
        >
          Tu plan de negociación
        </p>
        {chipCaja && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.03em",
              padding: "3px 7px",
              borderRadius: 3,
              background: "color-mix(in srgb, var(--franco-text) 5%, transparent)",
              color: "var(--franco-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            Caja en cero <b style={{ color: "var(--franco-text)" }}>{chipCaja.valor}</b>
            {chipCaja.delta ? <> · <b style={{ color: "var(--franco-text)" }}>{chipCaja.delta}</b></> : null}
          </span>
        )}
      </div>
      {chipCaja && (
        <p
          className="font-body m-0 mb-1"
          style={{ fontSize: 11.5, lineHeight: 1.5, color: "color-mix(in srgb, var(--franco-text) 65%, transparent)" }}
        >
          {chipCaja.glosa}
        </p>
      )}
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
          {s.deltas && s.deltas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {s.deltas.map((d, j) => (
                <span
                  key={j}
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.03em",
                    padding: "3px 7px",
                    borderRadius: 3,
                    background: "color-mix(in srgb, var(--franco-text) 5%, transparent)",
                    color: "var(--franco-text-secondary)",
                  }}
                >
                  <b style={{ color: "var(--franco-text)" }}>{d.b}</b> {d.resto}
                </span>
              ))}
            </div>
          )}
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
        <div
          className="font-body m-0 whitespace-pre-wrap"
          style={{ fontSize: 13, color: "color-mix(in srgb, var(--franco-text) 78%, transparent)", lineHeight: 1.6 }}
        >
          {renderPlumon(contenido)}
        </div>
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
  let dobleSalto = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  // Hardening prompt-v9 — el modelo a veces mete línea en blanco entre el título
  // y su explicación (visto en la primera generación v9): el split produce bloques
  // alternados título/explicación y el parseo de headings quedaba basura. Si un
  // bloque parece SOLO-título (una oración corta terminada en punto) y le sigue
  // una explicación, se re-aparean antes de parsear.
  if (dobleSalto.length > 3) {
    const esSoloTitulo = (b: string) => b.length <= 90 && /^[^.!?\n]+[.!?]$/.test(b);
    const emparejados: string[] = [];
    for (let i = 0; i < dobleSalto.length; i++) {
      if (esSoloTitulo(dobleSalto[i]) && i + 1 < dobleSalto.length && !esSoloTitulo(dobleSalto[i + 1])) {
        emparejados.push(dobleSalto[i] + "\n" + dobleSalto[i + 1]);
        i++;
      } else {
        emparejados.push(dobleSalto[i]);
      }
    }
    dobleSalto = emparejados;
  }
  if (dobleSalto.length >= 2) {
    return dobleSalto.slice(0, 3).map((block, i) => {
      // Primera oración como título (separada por ". " o ".\n").
      const firstSentenceMatch = block.match(/^([^.!?]+[.!?])/);
      // v9b — muere el corte del título a 60 con "…" (imitaba el truncado recién
      // eliminado de las descripciones). El ≤60 se exige en el CONTRATO del prompt;
      // si un título llega largo, se muestra entero y envuelve — nunca cortado.
      const titulo = firstSentenceMatch
        ? firstSentenceMatch[1].replace(/[.:]$/, "").trim()
        : truncateClean(block, 60) || `Riesgo ${i + 1}`;
      const rest = firstSentenceMatch
        ? block.slice(firstSentenceMatch[0].length).trim()
        : "";
      // v9 — el truncado de 220 murió: escondía el dato duro del riesgo detrás de
      // un "…" sin ninguna vía para leerlo. El largo se controla en GENERACIÓN
      // (BUDGET_POR_RIESGO, ai-generation-str v9); acá se muestra íntegro.
      const descripcion = (rest || block).trim();
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
  const nivelesPie = useMemo(() => {
    if (!inputData || !createdAt || !(inputData.precio > 0)) return [];
    const precioCLP = results.metrics?.precioCLP ?? 0;
    const ufCongelado = precioCLP > 0 ? precioCLP / inputData.precio : valorUF;
    return simularPie(inputData, ufCongelado, new Date(createdAt));
  }, [inputData, createdAt, results.metrics?.precioCLP, valorUF]);

  // Escalera del plazo — segunda palanca del mismo cuerpo. `simularPlazo` no necesita
  // `asOf`: no proyecta ni calcula TIR, solo cuota, flujo e interés del crédito.
  const nivelesPlazo = useMemo(() => {
    if (!inputData || !(inputData.precio > 0)) return [];
    const precioCLP = results.metrics?.precioCLP ?? 0;
    const ufCongelado = precioCLP > 0 ? precioCLP / inputData.precio : valorUF;
    return simularPlazo(inputData, ufCongelado);
  }, [inputData, results.metrics?.precioCLP, valorUF]);

  const content = currency === "CLP" ? data.contenido_clp : data.contenido_uf;
  // RESIDUO ANOTADO: con la caja muerta, `data.estructuraSugerida` ya no lo lee
  // NADIE en el render. El motor lo sigue sobrescribiendo determinísticamente
  // (`ai-generation.ts`, FASE A) y el prompt le sigue pidiendo al modelo que lo
  // copie. Retirarlo del contrato toca tipo + schema + filas persistidas: va al
  // backlog, no de rebote acá.


  return (
    <div>
      <p className="inline-flex items-center gap-1 font-body text-[13px] leading-[1.6] text-[var(--franco-text)] mb-3 m-0">
        <span>El depto está bien. Lo que no cierra es la matemática del financiamiento.</span>
        <InfoTooltip content="Reestructuración del crédito sugerida cuando el problema dominante es pie/tasa/plazo, no el precio del depto." />
      </p>

      <div className="font-body text-[13px] leading-[1.65] text-[var(--franco-text)] my-4 whitespace-pre-line">
        {renderPlumon(content)}
      </div>

      {/* LA CAJA "ESTRUCTURA SUGERIDA" MURIÓ (v14). Nació con tres chips —pie,
          plazo, tasa—. El pie salió en el tramo 1 (era la constante de 25%, no un
          óptimo) y el plazo salió acá (passthrough puro del input). Quedaba la
          tasa sola en una grilla de una columna: un número grande en mono, con
          borde y rótulo de recomendación, para un valor que no recomienda nada.
          Peor: `tasaObjetivo_pct` es `min(tu tasa, MARKET_AVG_TASA_UF)`, así que
          al comprador que ya negoció bien le devolvía SU PROPIA TASA rotulada
          como sugerencia — el mismo vicio del chip del plazo.
          La tasa no es una recomendación, es una REFERENCIA: contra qué se
          compara lo que tienes. Ese es exactamente el lugar de VFuente en el
          vocabulario, y ahí baja — al pie del drawer, junto a la escalera, que es
          la que sí muestra un trade-off. */}
      {/* EL BLOQUE DE AHORRO SALIÓ (v14). Mostraba `impactoCuotaMensual_clp`, que
          medido sobre 343 filas del parque era **97% efecto del pie** — y el pie
          que asumía era la constante de 25%, no un óptimo calculado. Muerta la
          constante, el número perdió su causa y no había forma honesta de
          recalcularlo: sobre la tasa sola daba 0 en el 92% de los casos.
          La escalera, justo abajo, ya muestra el delta de cuota por escalón y con
          niveles que el lector puede encontrar. Esto es una resta, no un hueco. */}
      {/* CONVERSIÓN 17 · la escalera va también en la rama con prosa IA: es el mismo
          hallazgo ("cómo estás financiando") y el trade-off del pie no depende de que
          la IA haya escrito su bloque. */}
      <EscaleraPie
        niveles={nivelesPie}
        valorUF={valorUF}
        flujoPersistido={results.metrics?.flujoNetoMensual}
        currency={currency}
      />

      {/* SEGUNDA LECTURA, PLEGADA. Las dos escaleras comparten la columna de flujo y
          se leen como dos maneras de mover el mismo número con costos distintos: el
          pie cuesta retorno, el plazo cuesta interés. Va colapsada porque el pie es la
          palanca dominante del cuerpo y dos tablas abiertas compiten. */}
      {nivelesPlazo.length > 0 && (
        <VCollapse t="↓ Ver qué pasa si cambias el plazo">
          <EscaleraPlazo
            niveles={nivelesPlazo}
            valorUF={valorUF}
            flujoPersistido={results.metrics?.flujoNetoMensual}
            currency={currency}
          />
        </VCollapse>
      )}

      <VFuente>{referenciaTasa(inputData?.tasaInteres)}</VFuente>
    </div>
  );
}

/** Procedencia de la tasa: qué es la referencia y dónde cae la del usuario contra
 *  ella. Reemplaza al chip "Tasa objetivo", que presentaba como recomendación un
 *  `min(tu tasa, referencia)` — y por lo tanto le repetía su propia tasa a quien
 *  ya estaba bajo el promedio. Acá la referencia se nombra una vez y la
 *  comparación se dice, que es lo que el lector necesita para saber si tiene
 *  margen que pedir. */
function referenciaTasa(tasaUsuario?: number): string {
  // T4 (contrato CONGELADO): la fuente cita fuente, fecha y alcance. La comparación
  // "la tuya está por encima" ya la muestra el diagrama de estructura.
  void tasaUsuario;
  return `Tasa de referencia: ${MARKET_AVG_TASA_UF.toFixed(1).replace(".", ",")}% anual en UF, promedio de mercado · Motor Franco, actualización manual`;
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
  const nivelesPie = useMemo(() => {
    if (!inputData || !createdAt || !(inputData.precio > 0)) return [];
    const precioCLP = results.metrics?.precioCLP ?? 0;
    const ufCongelado = precioCLP > 0 ? precioCLP / inputData.precio : valorUF;
    return simularPie(inputData, ufCongelado, new Date(createdAt));
  }, [inputData, createdAt, results.metrics?.precioCLP, valorUF]);

  // Escalera del plazo — segunda palanca del mismo cuerpo. `simularPlazo` no necesita
  // `asOf`: no proyecta ni calcula TIR, solo cuota, flujo e interés del crédito.
  const nivelesPlazo = useMemo(() => {
    if (!inputData || !(inputData.precio > 0)) return [];
    const precioCLP = results.metrics?.precioCLP ?? 0;
    const ufCongelado = precioCLP > 0 ? precioCLP / inputData.precio : valorUF;
    return simularPlazo(inputData, ufCongelado);
  }, [inputData, results.metrics?.precioCLP, valorUF]);

  const { piePct, tasaPct, tasaMarketPct, driver } = hallazgo.valor;
  const cuotaActual = results.metrics?.dividendo ?? 0;

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

      {/* AUDITORÍA fase42 D-L2 — los chips pelados se reemplazan por la MISMA
          comparación dibujada del 13 (componente compartido): tasa contra el
          promedio de mercado con chip de juicio (acá 4,7 vs 4,1 es justamente la
          floja), pie como barra propia con la escalera de contexto. */}
      <VViz t="Tu estructura contra la referencia">
        <EstructuraComparada
          piePct={piePct}
          tasaPct={tasaPct}
          tasaMarketPct={tasaMarketPct}
          cuotaFmt={fmtMoney(cuotaActual, currency, valorUF)}
          pie={sinPie && creditoCLP !== null
            ? `Financiamiento 100% · crédito ${fmtMoney(creditoCLP, currency, valorUF)}.`
            : undefined}
        />
      </VViz>

      {/* ═══ CONVERSIÓN 17 (FASE 4.2) · ESCALERA DEL PIE ═══
          Reemplaza la referencia de "óptimo de pie 25%". Ese 25 se rastreó hasta el
          fondo y no tiene fundamento: no marca umbral de mejora de tasa, ni el punto
          donde el flujo cruza a neutro, ni un requisito bancario — es una convención
          adoptada en may-2026 y nunca cuestionada. Dibujarla como referencia le habría
          dado autoridad de dato. Acá no se declara ningún óptimo: se muestra el
          intercambio calculado y el lector decide según su liquidez. */}
      <EscaleraPie
        niveles={nivelesPie}
        valorUF={valorUF}
        flujoPersistido={results.metrics?.flujoNetoMensual}
        currency={currency}
      />

      {/* SEGUNDA LECTURA, PLEGADA. Las dos escaleras comparten la columna de flujo y
          se leen como dos maneras de mover el mismo número con costos distintos: el
          pie cuesta retorno, el plazo cuesta interés. Va colapsada porque el pie es la
          palanca dominante del cuerpo y dos tablas abiertas compiten. */}
      {nivelesPlazo.length > 0 && (
        <VCollapse t="↓ Ver qué pasa si cambias el plazo">
          <EscaleraPlazo
            niveles={nivelesPlazo}
            valorUF={valorUF}
            flujoPersistido={results.metrics?.flujoNetoMensual}
            currency={currency}
          />
        </VCollapse>
      )}

      {!adverso ? (
        /* fase42 D-L2 — VCierre del vocabulario en vez de caja ad-hoc. */
        <VCierre titulo="Qué haces con esto">
          No hay una palanca de financiamiento urgente que mover. <mark>Si este deal necesita ajuste, está
          en el precio o el flujo</mark>, no en cómo lo financias.
        </VCierre>
      ) : (
        /* Estado en contra (D4): la vacancia en plata + dónde está la palanca.
           Signal Red legítimo: monto negativo crítico que sale del bolsillo (uso #2). */
        <>
          {/* fase42 D-L2 (decisión A) — la suma narrada era un waterfall contado:
              pasa a Fall de 3 filas + total, la forma del 17. La advertencia
              condicional baja al cierre (el orden v12 no admite prosa entre viz y
              cierre). Signal Red legítimo: plata que sale del bolsillo (uso #2). */}
          {vacanciaMes !== null && m && vacanciaMes > 0 && (
            <VViz t="Un mes de vacancia, en plata">
              <Fall
                rows={([
                  { k: "Dividendo", v: fmtMoney(m.dividendo, currency, valorUF), pct: (m.dividendo / vacanciaMes) * 100, tone: "red" },
                  { k: "Gastos comunes", v: fmtMoney(m.gastos, currency, valorUF), pct: (m.gastos / vacanciaMes) * 100, tone: "red" },
                  { k: "Contribuciones (mes)", v: fmtMoney(contribMes, currency, valorUF), pct: (contribMes / vacanciaMes) * 100, tone: "red" },
                ] as FallRow[])}
                total={{ k: "Un mes vacío, de tu bolsillo", v: fmtMoney(vacanciaMes, currency, valorUF) }}
              />
            </VViz>
          )}
          {/* fase42 D-L2 — las tres cajas apiladas quedan en UNA de cierre: "Dónde
              está la palanca" ES el "qué haces con esto" del cuerpo. */}
          <VCierre titulo="Qué haces con esto">
            {sinPie ? (
              <>Acá la palanca no es subir el pie que no tienes: <mark>es el precio — cada peso menos es
              crédito que no tomas</mark> — y asegurar flujo estable antes de firmar. Sin colchón de
              capital, no tienes margen ante vacancia prolongada o un alza de tasa al renovar.</>
            ) : driver === "tasa" ? (
              <>La palanca acá es la tasa: <mark>cotizar en otro banco puede bajar la cuota</mark>. Con la
              cuota en este nivel, una vacancia prolongada o un alza de tasa al renovar pegan directo en
              tu flujo.</>
            ) : driver === "ambos" ? (
              <>Hay palanca en el pie y en la tasa: <mark>subir el pie y cotizar la tasa en otro banco
              bajan la cuota</mark>. Con la cuota en este nivel, una vacancia prolongada o un alza de tasa
              al renovar pegan directo en tu flujo.</>
            ) : (
              <>La palanca acá es el pie: <mark>subirlo baja el crédito y la cuota</mark>, y te acerca al
              rango sano. Con la cuota en este nivel, una vacancia prolongada pega directo en tu flujo.</>
            )}
          </VCierre>
        </>
      )}

      {/* T1 — línea de fuente al pie, posición única del v12 (absorbe la frase de
          actualización manual que vivía en "De dónde sale"). */}
      <VFuente>Tasa de referencia: promedio de mercado en UF · Motor Franco, actualización manual</VFuente>
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
  // T4 (contrato CONGELADO): el drawer al vocabulario v12 — VProsa (la síntesis),
  // las tres celdas de la sección, el mapa, los lugares como filas y la fuente.
  // Murió la nota educativa sobre plusvalía histórica vs proyectada: es método,
  // y la celda de valorización ya dice qué proyección usa el informe.
  const sintesis =
    (currency === "CLP" ? zoneInsight.insight.narrative_clp : zoneInsight.insight.narrative_uf) ||
    (currency === "CLP" ? zoneInsight.insight.preview_clp : zoneInsight.insight.preview_uf) ||
    "";
  const avisos = zoneInsight.stats.ofertaComparable?.totalDeptos ?? 0;
  return (
    <div className="doc-tokens">
      {sintesis && <VProsa>{sintesis}</VProsa>}
      <ZonaCeldas stats={zoneInsight.stats} currency={currency} valorUF={valorUF} arriendoUsuarioCLP={arriendoUsuarioCLP} />
      {zoneCenter && (
        <VViz t="El depto y lo que hay alrededor">
          <ZoneMap centerLat={zoneCenter.lat} centerLng={zoneCenter.lng} pois={zoneInsight.pois} />
        </VViz>
      )}
      <VViz t="Lugares a menos de 2,5 km">
        <ZonaLugares pois={zoneInsight.pois} />
      </VViz>
      <VFuente>
        Zone insight Franco{avisos ? ` · ${avisos} avisos de arriendo en ${comuna}` : ""} · lugares: Google Places
      </VFuente>
    </div>
  );
}

const LUGAR_LABEL: Record<keyof ZoneInsightData["pois"], string> = {
  metro: "Metro",
  trenes: "Tren",
  parques: "Parque",
  clinicas: "Clínica",
  universidades: "Universidad",
  institutos: "Instituto",
  colegios: "Colegio",
  malls: "Centro comercial",
  negocios: "Zona de negocios",
};

/** Los lugares como filas (nombre · tipo y comuna · distancia), los más cercanos
 *  primero, y una línea con lo que NO hay en el radio. */
function ZonaLugares({ pois }: { pois: ZoneInsightData["pois"] }) {
  const cats = Object.keys(LUGAR_LABEL) as (keyof ZoneInsightData["pois"])[];
  const filas = cats
    .flatMap((k) => pois[k].map((p) => ({ ...p, tipo: LUGAR_LABEL[k] })))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 8);
  const faltan = cats.filter((k) => pois[k].length === 0 && ["metro", "clinicas", "malls"].includes(k)).map((k) => LUGAR_LABEL[k].toLowerCase());
  const dist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
  if (filas.length === 0) {
    return <p className="zona-sin">No detectamos transporte, comercio ni servicios a menos de 2,5 km. Zona residencial periférica.</p>;
  }
  return (
    <div>
      {filas.map((p, i) => (
        <div key={`${p.nombre}-${i}`} className="lugar">
          <span className="n">{p.nombre}</span>
          <span className="d">{dist(p.distancia)}</span>
          <span className="t">
            {p.tipo}
            {p.linea ? ` · ${p.linea}` : ""}
            {p.comuna ? ` · ${p.comuna}` : ""}
          </span>
        </div>
      ))}
      {faltan.length > 0 && <p className="zona-sin">Sin {faltan.join(", ").replace(/, ([^,]*)$/, " ni $1")} en el radio</p>}
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
  const zonaTitle = `La zona · ${comuna ?? (inputData.comuna || "tu comuna")}`;
  // Sin IA de reestructuración (estructura sana), el título del fallback no debe
  // insinuar una palanca que mover.
  const reestructuracionTitle = aiAnalysis?.reestructuracion
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
                      : aiAnalysis?.[activeKey];

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
    // Sin prosa no hay `section`: el header cae al label del drawer (DRAWER_META),
    // que es determinista. En modo inline este título ni se usa — lo muestra la
    // fila del acordeón — pero el overlay de zona sí lo necesita.
    return section?.pregunta ?? meta.label;
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
          data={section as AINegociacionSection | undefined}
          currency={currency}
          inputData={inputData}
          results={results}
          valorUF={valorUF}
          createdAt={createdAt}
        />
      )}
      {activeKey === "reestructuracion" &&
        (aiAnalysis?.reestructuracion ? (
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
            currency={currency}
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
          doc-tokens fixed z-50 bg-[var(--franco-card)] overflow-y-auto
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
              /* chip de cierre del v12 (mismo que el cuerpo del acordeón): cierra el
                 drawer, no el análisis */
              <button type="button" onClick={onClose} className="hall-close">
                ↑ Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
