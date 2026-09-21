"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import type {
  AIAnalysisV2,
  AISection,
  FullAnalysisResult,
  AnalisisInput,
  HallazgoPuestaAPunto,
} from "@/lib/types";
import { calcFlujoDesglose, calcMesVacio } from "@/lib/analysis";
import { fraseReparto } from "@/lib/reparto-ingreso";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, nunca literal.
import { InfoTooltip } from "@/components/ui/tooltip";
import { renderPlumon, plumonInline } from "@/components/analysis/hallazgos/plumon";
import { FilaDato, FilasDato } from "@/components/analysis/shared";
import {
  VProsa,
  VViz,
  VCierre,
  VFuente,
  VSub,
  Fall,
  type FallRow,
} from "@/components/analysis/hallazgos/vocabulario";
import type { HallazgoSobreprecio } from "@/lib/types";
import type { ZoneInsightData } from "@/hooks/useZoneInsight";
import { ZonaCeldasLtr, buildZonaLtr, sintesisZonaLtr } from "@/components/analysis/zona/ZonaLtr";
import { ZoneMap } from "@/components/zone-insight/ZoneMap";

// ⛔ `capRate` y `largoPlazo` SALIERON el 17-sep-2026. Sin ruta desde `81b05cce`
// (`drawerSequence = ["zona"]`) y su contenido vive en superficies que sí se ven: el cap
// rate contra su referencia lo dibuja el capítulo I (`CapitulosInversion.tsx:202`), y la
// caja «La apuesta que haces» la imprime el PDF de LTR (`DocumentoLTR.tsx:393`).
// Quedan en el tipo las claves cuyo contenido SÍ monta alguien: `costoMensual`,
// `negociacion` y `capexPuestaAPunto` los montan los capítulos por su cuenta, y `zona` es
// la única que el ruteo alcanza.
export type DrawerKey =
  | "costoMensual"
  | "negociacion"
  | "zona"
  | "capexPuestaAPunto";

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
  /** Zona LTR (goal "LTR hereda"): la mediana comunal de la celda es la del hallazgo de
   *  sobreprecio, fechada con el snapshot. */
  sobreprecio?: HallazgoSobreprecio | null;
  medianaResolvedAt?: string;
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
  negociacion: { label: "El precio" },
  zona: { label: "La zona" },
  capexPuestaAPunto: { label: "Puesta a punto" },
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

// ─── Costo mensual drawer ───────────────────────────
export function DrawerCostoMensual({
  data,
  currency,
  results,
  inputData,
  valorUF,
  capitulo,
}: {
  /** Prosa IA de la sección; puede faltar (informe sin redacción). */
  data?: AISection;
  currency: "CLP" | "UF";
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  valorUF: number;
  /** T3 (capítulo II del CONGELADO): intro fija en vez del párrafo IA, sin la nota
   *  educativa, subtítulo serif de tramo y la fuente con la UF del análisis. */
  capitulo?: { intro: ReactNode; fuente: ReactNode };
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
  // El reparto del ingreso lo emite el motor desde el 16-sep-2026 (`reparto-ingreso.ts`);
  // acá NO se deriva nada, que era justo lo que hacía el call site de la barra retirada.
  const reparto = results.metrics?.repartoIngreso ?? null;

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
      // ⛔ SE SACÓ «0% si autogestionas» (16-sep-2026). La fila se dibuja con
      // `.filter((r) => r.value > 0)`, así que cuando autogestionas NO EXISTE: la
      // frase solo podía leerla quien no está en el caso que explicaba. Y es la fila
      // de menor población de la tabla —29 de 1.179 (2,5%)— con el tooltip más largo.
      tooltip: "Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario). Distinto de gastos comunes del edificio.",
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

  // EL MES VACÍO, COMPLETO. Hasta acá esta frase decía solo el dividendo y se quedaba
  // corta: en Providencia (7710a017) anunciaba $978.290 cuando el golpe real es
  // $1.149.025 — 14,9% menos de lo que el dueño paga (le faltaban los $90.000 de
  // gastos comunes completos y los $80.735 de contribuciones del mes). Desde v21 este cierre es el ÚNICO
  // lugar del informe LTR donde el lector ve el escenario (la prosa de `costoMensual`
  // murió y el bloque del drawer de estructura es inalcanzable), así que la cifra
  // incompleta era la única que quedaba en pie.
  const mesVacio = calcMesVacio({
    dividendo: desglose.dividendo,
    ggcc: results.metrics?.gastos ?? inputData.gastos ?? 0,
    contribuciones: results.metrics?.contribuciones ?? inputData.contribuciones ?? 0,
  });
  const caja = data ? (currency === "CLP" ? data.cajaAccionable_clp : data.cajaAccionable_uf) : "";
  const contenido = data ? (currency === "CLP" ? data.contenido_clp : data.contenido_uf) : "";
  return (
    <div>
      {capitulo ? (
        <VProsa>{capitulo.intro}</VProsa>
      ) : (
        <>
          {contenido && (
            <div className="font-body text-[14px] leading-[1.65] text-[var(--franco-text)] mb-4 whitespace-pre-wrap">
              {renderPlumon(contenido)}
            </div>
          )}

          {/* Mensaje educativo (dot pattern Fase 4.8): justifica por qué incluimos
              gastos que otros análisis omiten. */}
          <p className="font-mono text-[11px] mt-1 mb-4 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
            ● A diferencia de otros análisis, Franco considera todos los gastos que impactan tu flujo real: vacancia, mantención, corretaje, recambio y gestión. Una evaluación honesta los incluye.
          </p>
        </>
      )}

      {/* FASE 4 — el flujo mensual pasa al WATERFALL del vocabulario: el arriendo
          entero como banda y cada egreso comiéndose su parte, con el resultado
          como total. Reemplaza los dos grupos de barras ENTRA/SALE. */}
      <VViz t={`Qué pasa con los ${fmt(arriendo)} del arriendo`}>
        {capitulo && <VSub>Lo que entra y lo que sale cada mes</VSub>}
        {capitulo ? (
          /* Goal "LTR hereda" (05-sep-2026): el capítulo II usa las mismas piezas que STR II
             (barra de tramos + filas de dato). Mismos ítems y mismas cifras que el waterfall. */
          <>
            {/* LA BARRA DE TRAMOS SALIÓ Y NO SE REEMPLAZA POR OTRO GRÁFICO (16-sep-2026).
              No se fue por fea: **cambiaba de unidad a mitad del parque sin avisar**. Su escala
              era `max(ingreso, costosOperar + cuota)`, así que mientras la cuota cabe en el
              ingreso el ancho del negro decía «qué fracción de lo que ENTRA se lleva la cuota»,
              y cuando no cabe pasaba a decir «qué fracción de lo que SALE es la cuota». Medido:
              la cuota supera el 100%% del ingreso en más de la mitad de las filas LTR (p50 =
              110%%), o sea que el segundo modo era la mayoría. Y encima el negro se dibujaba
              ENCIMA de la banda gris, así que el gris dejaba de leerse como continente.
              Lo que la barra intentaba decir ahora está escrito, que es lo único que este
              capítulo no decía: qué se lleva la plata. El reparto lo emite el MOTOR
              (`metrics.repartoIngreso`), no el render. */}
            {reparto && (() => {
              const f = fraseReparto(reparto, "los gastos", fmt);
              return (
                <p className="doc-reparto">
                  {f.antes}
                  <b style={f.sale ? { color: "var(--signal-red)" } : undefined}>{f.monto}</b>
                  {f.despues}
                </p>
              );
            })()}
            <FilasDato>
              <FilaDato tono="in" k="Arriendo mensual" tip="Lo que entra cada mes, antes de cuota y gastos" v={fmt(arriendo)} unidad="/mes" />
              {saleItemsSorted
                .filter((r) => r.value > 0)
                .map((r) => (
                  <FilaDato key={r.name} k={r.name} tip={r.tooltip} v={`−${fmt(r.value)}`} unidad="/mes" />
                ))}
              <FilaDato
                tono="tot"
                k={isNeg ? "Sale de tu bolsillo" : "Te queda cada mes"}
                tip="Arriendo − cuota − gastos"
                v={<span style={{ color: isNeg ? "var(--signal-red)" : undefined }}>{`${isNeg ? "−" : "+"}${fmt(Math.abs(flujo))}`}</span>}
                unidad="/mes"
              />
            </FilasDato>
          </>
        ) : (
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
        )}
      </VViz>

      {caja ? (
        <VCierre titulo={capitulo ? "Qué haces con esto" : data?.cajaLabel || "Hazte esta pregunta:"}>{plumonInline(caja)}</VCierre>
      ) : (
        <VCierre titulo="Qué haces con esto">
          {isNeg
            ? `¿Tienes ${fmt(Math.abs(flujo))} disponibles cada mes sin comprometer otro gasto fijo? Un mes sin arrendatario son ${fmt(mesVacio)} de tu bolsillo: el dividendo completo más gastos comunes y contribuciones.`
            : `El arriendo cubre la cuota y los gastos y deja ${fmt(flujo)} al mes. Un mes sin arrendatario son ${fmt(mesVacio)} de tu bolsillo: el dividendo completo más gastos comunes y contribuciones.`}
        </VCierre>
      )}

      {/* T4 (contrato CONGELADO): la fuente cita, no explica. Los supuestos del
          modelo (mantención por antigüedad, recambio) viven en "Cómo se calcula". */}
      <VFuente>{capitulo ? capitulo.fuente : "Motor Franco · flujo mensual del análisis"}</VFuente>
    </div>
  );
}

// ─── Negociación drawer — RETIRADO (21-sep-2026) ─────────────────────────
// `DrawerNegociacion` y `PlanNegociacion` salieron enteros con el rediseño de «Cómo lo
// pagas»: el capítulo se ancla al precio recomendado (`src/lib/como-lo-pagas.ts` +
// `shared/CapituloComoLoPagas.tsx`). El drawer tenía dos bloques muertos por `!capitulo`
// (el hero de sobreprecio y el argumento IA) y un plan de cuatro precios de los que
// ninguno era el recomendado. La rama `activeKey === "negociacion"` del registro se fue
// con él; `DrawerKey` conserva la clave porque la leen `DRAWER_META` y la telemetría.

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
  const { montoCLP, montoUF, ufM2, antiguedadAnios, superficieUtilM2, montoMinUF, montoMaxUF, montoMinCLP, montoMaxCLP, ufM2Min, ufM2Max } = hallazgo.valor;
  const fmtN = (n: number) => Math.round(n).toLocaleString("es-CL");
  const montoFmt = currency === "CLP" ? "$" + fmtN(montoCLP) : "UF " + fmtN(montoUF);
  // Rango (modelo v3): extremos como display + el punto que entró al cálculo.
  // Override (cotización real), legacy y filas persistidas sin rango → valor único.
  const rango = montoMinUF != null && montoMaxUF != null && montoMaxUF > montoMinUF;
  const rangoFmt = rango
    ? (currency === "CLP"
        ? `$${fmtN(montoMinCLP ?? montoCLP)}–$${fmtN(montoMaxCLP ?? montoCLP)}`
        : `UF ${fmtN(montoMinUF)}–${fmtN(montoMaxUF)}`)
    : montoFmt;
  const ufM2Fmt = (v: number) => v.toFixed(1).replace(".", ",");
  const porM2Fmt = rango && ufM2Min != null && ufM2Max != null ? `${ufM2Fmt(ufM2Min)}–${ufM2Fmt(ufM2Max)}` : ufM2Fmt(ufM2);
  // fraccionInversion (capex/inversión inicial), NO decisividad — que desde E2 es
  // la "Δdecisión" calibrada. Esta cifra es display: "X% de tu plata día 1".
  const pctInversion = Math.round(hallazgo.valor.fraccionInversion * 100);
  const lbl: React.CSSProperties = { fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 };
  const val: React.CSSProperties = { fontSize: rango ? 18 : 20, lineHeight: 1.05, color: "var(--doc-tx)" };

  // FASE 4 — migrado al VOCABULARIO ÚNICO (2º de los 3 cuerpos con markup a mano).
  return (
    <div>
      <VProsa>
        <p className="inline-flex items-center gap-1 m-0">
          <span>No es remodelar para revender: es dejar el depto en estándar de arriendo para captar el precio de mercado.</span>
          <InfoTooltip content="Pintura, grifería, calefont, filtraciones y terminaciones al día. Un usado sin puesta a punto suele arrendar bajo el precio de mercado de la zona." />
        </p>
      </VProsa>

      <VViz t="Puesta a punto estimada">
        <div className={`grid grid-cols-2 gap-3 ${rango ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <div>
            <p className="font-mono uppercase m-0" style={lbl}>{rango ? "Rango estimado" : "Inversión"}</p>
            <p className="font-mono font-bold m-0" style={val}>{rangoFmt}</p>
          </div>
          {rango && (
            <div>
              <p className="font-mono uppercase m-0" style={lbl}>Corre el caso con</p>
              <p className="font-mono font-bold m-0" style={val}>{montoFmt}</p>
            </div>
          )}
          <div>
            <p className="font-mono uppercase m-0" style={lbl}>Por m²</p>
            <p className="font-mono font-bold m-0" style={val}>
              {porM2Fmt} <span style={{ fontSize: 13, fontWeight: 500 }}>UF/m²</span>
            </p>
          </div>
          <div>
            <p className="font-mono uppercase m-0" style={lbl}>De tu plata día 1</p>
            <p
              className="font-mono font-bold m-0"
              style={{ ...val, color: hallazgo.valor.fraccionInversion > 0.2 ? "var(--signal-red)" : "var(--doc-tx)" }}
            >
              {pctInversion}%
            </p>
          </div>
        </div>
        <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginTop: 12 }}>
          Depto de {antiguedadAnios} años · {superficieUtilM2} m² útiles.
          {rango && " El punto medio del rango es lo que entra a la inversión inicial, al cash-on-cash y a la TIR; los extremos son la banda de la estimación."}
        </p>
      </VViz>

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
  sobreprecio,
  medianaResolvedAt,
}: {
  zoneInsight?: ZoneInsightData | null;
  zoneLoading?: boolean;
  zoneError?: string | null;
  zoneCenter?: { lat: number; lng: number } | null;
  currency: "CLP" | "UF";
  comuna: string;
  arriendoUsuarioCLP: number;
  valorUF: number;
  sobreprecio?: HallazgoSobreprecio | null;
  medianaResolvedAt?: string;
}) {
  if (zoneLoading && !zoneInsight) return <ZoneSkeleton />;
  if (zoneError && !zoneInsight) return <ZoneErrorState message={zoneError} />;
  if (!zoneInsight) return <ZoneErrorState message={null} />;
  // T4 (contrato CONGELADO): el drawer al vocabulario v12 — VProsa (la síntesis),
  // las tres celdas de la sección, el mapa, los lugares como filas y la fuente.
  // Murió la nota educativa sobre plusvalía histórica vs proyectada: es método,
  // y la celda de valorización ya dice qué proyección usa el informe.
  // Síntesis determinista desde las celdas (goal "síntesis de zona LTR", 05-sep-2026): la
  // prosa IA cacheada en zone_insight ya no se muestra (contradecía las celdas); la cache
  // sigue siendo la fuente del rango de arriendos y de los lugares.
  const zonaLtr = buildZonaLtr({ stats: zoneInsight.stats, sobre: sobreprecio, medianaResolvedAt, arriendoUsuarioCLP, comuna });
  const avisos = zoneInsight.stats.ofertaComparable?.totalDeptos ?? 0;
  return (
    <div className="doc-tokens">
      <VProsa>{sintesisZonaLtr(zonaLtr)}</VProsa>
      {/* Goal "LTR hereda": las mismas tres celdas de la sección (mediana del hallazgo con
          procedencia, rango de arriendos con n y fecha, valorización con fuente). Sin P71. */}
      <ZonaCeldasLtr zona={zonaLtr} currency={currency} valorUF={valorUF} />
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
  sobreprecio,
  medianaResolvedAt,
}: DrawerProps) {



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

  // Zona no encaja con AISection — placeholder pregunta.
  const zonaTitle = `La zona · ${comuna ?? (inputData.comuna || "tu comuna")}`;
  const capexTitle = "Dejarlo listo para arrendar";
  // Hallazgo capex (motor-seeded) — .find por id, NO índice posicional (paridad con
  // capRate/estructura). Antes se gateaba con results.hallazgos[0] y el drawer no
  // renderizaba si otro hallazgo quedaba en [0].
  const capexHallazgo = results.hallazgos?.find(
    (h): h is HallazgoPuestaAPunto => h.id === "capex_puesta_a_punto",
  );
  const section =
    activeKey === "zona"
      ? ({ pregunta: zonaTitle } as { pregunta: string })
        : activeKey === "capexPuestaAPunto"
          ? ({ pregunta: capexTitle } as { pregunta: string })
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
      const vmFranco = results.metrics?.valorMercadoRef?.valorUF ?? precioActual;
      const dev = vmFranco > 0 ? (vmFranco - precioActual) / vmFranco : 0;
      const absDev = Math.abs(dev);
      if (absDev <= 0.02) return "¿Vale la pena negociar?";
      if (dev > 0) return "¿Vale la pena seguir negociando?"; // esPasada
      return "¿Cuánto bajar el precio?"; // esSobreprecio
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
      {activeKey === "capexPuestaAPunto" && capexHallazgo && (
        <DrawerCapexPuestaAPunto
          hallazgo={capexHallazgo}
          currency={currency}
          valorUF={valorUF}
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
          sobreprecio={sobreprecio}
          medianaResolvedAt={medianaResolvedAt}
        />
      )}
      {/* ⛔ LAS DOS MONTURAS DE `sensibilidad` Y `distanciaVeredicto` SE RETIRARON
          (17-sep-2026). Las dos eran inalcanzables —`drawerSequence = ["zona"]` desde
          `81b05cce`, y `HeroLTR` recibe `onOpenDrawer` y nunca lo llama— y las dos tenían
          su contenido ya mudado a superficies mejores:
           · sensibilidad → el dial vive en `CapitulosInversion.tsx`, el margen y su banda
             («colchón amplio/acotado») en el pop-up, que además dice a qué veredicto CAE,
             cosa que el drawer no decía;
           · distanciaVeredicto → el pop-up de ajustes entero, al que se llega por «Ver
             ajustes» en `PosicionFranco`.
          No es limpieza de código huérfano: es retirar la copia vieja de algo que ya se
          dice mejor en otro lado. */}

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
