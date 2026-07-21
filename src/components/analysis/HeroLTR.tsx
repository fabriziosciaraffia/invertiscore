"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo } from "@/lib/types";
import { BedDouble, Bath, Ruler, Clock, Building2, Scaling, Percent, Wallet } from "lucide-react";
import { fmtCLP, fmtUF, fmtMoney } from "@/components/analysis/utils";
import { MapaThumbnail, type Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { formatDireccionDisplay } from "@/lib/format-direccion";

/**
 * Hero de resultados LTR — rediseño dark (Fase 1a). Referencia visual aprobada:
 * mockup-hero-dark.html. Reemplaza al HeroVerdictBlock legacy dentro del
 * SubjectCardGrid; las MiniCards 2×2, Zona y drawers quedan intactas.
 *
 * UNA superficie continua dividida por hairlines HORIZONTALES (no cajas
 * tintadas por sección; sin borde vertical entre columnas — A1). Estructura:
 *  F1 identidad · F2 chips · F3 score|mapa · F4 veredicto|findings · pie firma.
 *
 * Construcción por etapas: E1 = F1 + F2.
 */
export function HeroLTR({
  data,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadTitle,
  inputData,
  results,
  comuna,
  ciudad,
  valorUF,
  createdAt,
}: {
  data: AIAnalysisV2;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  inputData: AnalisisInput | null | undefined;
  results: FullAnalysisResult | null | undefined;
  comuna?: string;
  ciudad?: string;
  valorUF: number;
  createdAt?: string;
}) {
  // ── Identidad (F1): dirección + comuna de inputData; fallback al título legacy ──
  // Solo-calle: el H1 concatena "· {comuna}" aparte (línea ~150), así que NO le
  // pasamos comuna al helper para no duplicarla.
  const direccion = formatDireccionDisplay(inputData?.direccion);
  const comunaLabel = comuna || inputData?.comuna || ciudad || "";
  const hasDireccion = direccion.length > 0;
  const dorm = inputData?.dormitorios;
  const banos = inputData?.banos;

  // ── Chips financieros (F2): respetan el toggle CLP/UF (regla "cambia todos los valores") ──
  const precioUF = Number(inputData?.precio) || 0;
  const superficie = Number(inputData?.superficie) || 0;
  const precioM2UF = superficie > 0 ? precioUF / superficie : 0;
  const piePct = inputData?.piePct ?? 20;
  const plazoAnios = Number(inputData?.plazoCredito) || 25;
  const tasaPct = Number(inputData?.tasaInteres) || 4.5;
  const tasaStr = tasaPct.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const arriendoCLP = Number(inputData?.arriendo) || 0;

  // Chips financieros — UNA moneda según el toggle (el mismo que rige la prosa).
  // CLP en millones abreviados ("$139,7 MM"); bajo $1 MM en miles ("$600 mil"),
  // porque "$0,6 MM" para un arriendo lee mal. UF en su valor pleno ("UF 3.500").
  // fmtM de utils usa sufijo "M"/"K" (otra convención) — acá va "MM" (millones).
  const fmtMM = (clp: number) => {
    if (Math.abs(clp) < 1_000_000) return "$" + Math.round(clp / 1000).toLocaleString("es-CL") + " mil";
    return "$" + (clp / 1_000_000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
  };
  const precioChip = currency === "UF" ? fmtUF(precioUF) : fmtMM(precioUF * valorUF);
  // UF/m² SIEMPRE en UF: es la métrica de comparación contra la mediana de la
  // comuna (el finding "Precio/m² vs comuna" también la expresa en UF). No flipea
  // con el toggle — en CLP el $/m² sería un número enorme e inconsistente.
  const m2Main = `UF ${(Math.round(precioM2UF * 10) / 10).toLocaleString("es-CL")}`;
  const arriendoChip = arriendoCLP > 0
    ? (currency === "UF" ? fmtUF(arriendoCLP / valorUF) : fmtMM(arriendoCLP))
    : "—";

  // ── Score / mapa (F3) ──
  // Coords desde input_data (misma fuente que el resto de la página).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputAny = inputData as any;
  // Fallback a zonaRadio.lat/lng: el payload LTR (buildLtrPayload) persiste las
  // coords anidadas en input_data.zonaRadio, NO top-level (a diferencia del STR,
  // que sí las escribe top-level). Sin este fallback el mapa desaparecía en todo
  // LTR con coords capturadas (118 filas del corpus, incluida Cerro Colorado).
  const lat = typeof inputAny?.lat === "number" ? (inputAny.lat as number)
    : typeof inputAny?.zonaRadio?.lat === "number" ? (inputAny.zonaRadio.lat as number) : null;
  const lng = typeof inputAny?.lng === "number" ? (inputAny.lng as number)
    : typeof inputAny?.zonaRadio?.lng === "number" ? (inputAny.zonaRadio.lng as number) : null;
  const mapLabel = hasDireccion ? direccion : comunaLabel;

  // Comparables cercanos (venta) para el mapa — mismo endpoint que el wizard.
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [comparablesCount, setComparablesCount] = useState(0);
  useEffect(() => {
    if (!comunaLabel || lat === null || lng === null) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      comuna: comunaLabel,
      superficie: String(superficie > 0 ? superficie : 50),
      dormitorios: String(dorm ?? 2),
      lat: String(lat),
      lng: String(lng),
      type: "venta",
    });
    fetch(`/api/data/suggestions?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const np: unknown = d.nearbyProperties;
        const list = Array.isArray(np) ? np : [];
        setComparables(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          list.map((p: any) => ({ lat: p?.lat ?? null, lng: p?.lng ?? null })),
        );
        setComparablesCount(
          typeof d.totalInRadius === "number"
            ? d.totalInRadius
            : typeof d.filteredInRadius === "number"
              ? d.filteredInRadius
              : list.length,
        );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [comunaLabel, superficie, dorm, lat, lng]);

  // ── Veredicto / findings (F4) ──
  const respuesta =
    currency === "CLP" ? data.conviene.respuestaDirecta_clp : data.conviene.respuestaDirecta_uf;
  const cajaAccionable =
    currency === "CLP" ? data.conviene.cajaAccionable_clp : data.conviene.cajaAccionable_uf;
  // veredictoFrase (schema.conviene) ya no se renderiza en el hero compacto — la
  // prosa fundida lo dice. El campo sigue en el schema (Entrega 2 decide su destino).
  const pregunta = data.conviene.pregunta || "¿Conviene o no conviene?";
  const topHallazgos = gatherTopHallazgos(results, data).slice(0, 3);
  const fechaFirma = formatFecha(createdAt);

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-3 franco-hero-block"
      data-verdict={veredicto}
    >
      {/* ═══ F1 · IDENTIDAD (compacto: sin subtítulo · rótulo modalidad a la derecha) ═══ */}
      <div className="flex items-start justify-between gap-6 px-6 md:px-8 pt-4 pb-3.5">
        <div className="min-w-0">
          <h1 className="franco-hero-title font-heading font-bold text-[23px] md:text-[27px] leading-[1.15] tracking-[-0.01em] text-[var(--franco-text)] m-0">
            {hasDireccion ? (
              <>
                {direccion}
                {comunaLabel && (
                  <span className="font-normal text-[var(--franco-text-secondary)]"> · {comunaLabel}</span>
                )}
              </>
            ) : (
              propiedadTitle
            )}
          </h1>
        </div>
        {/* Rótulo de modalidad (Ink 500) + toggle — 0px de altura extra (comparten fila) */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] whitespace-nowrap">
            Análisis renta larga
          </span>
          <CurrencyToggle currency={currency} onCurrencyChange={onCurrencyChange} />
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ F3 · SCORE+CHIPS | MAPA (grilla propia 66/34; chips fundidos bajo el score) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,66fr)_minmax(0,34fr)] gap-x-8 gap-y-6 px-6 md:px-8 py-3">
        {/* Score + chips */}
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
            Franco Score
          </span>

          <div className="flex items-center gap-4 mt-3">
            <div className="franco-hero-score font-mono font-bold text-[48px] md:text-[52px] leading-[0.9] tracking-[-0.02em] text-[var(--franco-text)]">
              {score}
              <span className="text-[22px] font-normal text-[var(--franco-text-muted)]">/100</span>
            </div>
            <VerdictBadge veredicto={veredicto} />
          </div>

          <ScoreBar score={score} />

          {/* Chips fundidos: físicos / financieros, 2 filas envueltas (sin divisor) */}
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<BedDouble />} k={dorm != null ? String(dorm) : "—"} unit="dorm" />
              <Chip icon={<Bath />} k={banos != null ? String(banos) : "—"} unit="baño" />
              <Chip icon={<Ruler />} k={superficie > 0 ? String(superficie) : "—"} unit="m²" />
              <Chip
                icon={<Clock />}
                k={inputData?.antiguedad != null ? String(inputData.antiguedad) : "—"}
                unit="años"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<Building2 />} k={precioChip} />
              <Chip icon={<Scaling />} k={m2Main} unit="/m²" />
              <Chip icon={<Percent />} k={`${piePct}%`} unit="pie" sub={`· ${plazoAnios} años · ${tasaStr}%`} />
              <Chip icon={<Wallet />} k={arriendoChip} unit="arr." />
            </div>
          </div>
        </div>

        {/* Mapa — altura fija igualada a la col izquierda (score+chips) */}
        <div className="flex">
          <div className="flex-1">
            <MapaThumbnail
              lat={lat}
              lng={lng}
              comparables={comparables}
              comparablesCount={comparablesCount}
              locationLabel={mapLabel}
              height={196}
            />
          </div>
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ F4 · VEREDICTO | FINDINGS (misma grilla 52/48; sin borde vertical — A1) ═══ */}
      <div className={`grid grid-cols-1 ${SHARED_GRID} gap-x-8 gap-y-8 px-6 md:px-8 py-[9px]`}>
        {/* Veredicto */}
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] mb-3 m-0">
            Veredicto
          </p>
          <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0">
            {pregunta}
          </h2>
          {/* A3: alineación izquierda (no justificado), ~65ch, 14-15px */}
          <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
            {renderProsaMono(respuesta)}
          </div>
        </div>

        {/* Findings TOP-3 por decisividad */}
        <div>
          <div className="font-heading font-bold text-[15px] text-[var(--franco-text)] mb-0.5">
            Lo que define este veredicto
          </div>
          <div className="font-body text-[11.5px] text-[var(--franco-text-muted)] mb-4">
            {topHallazgos.length > 0
              ? `Los ${topHallazgos.length} hallazgos que más movieron el score, por decisividad.`
              : "Hallazgos que definen el score."}
          </div>

          {topHallazgos.map((h, i) => (
            <FindingRow
              key={h.id}
              rank={String(i + 1).padStart(2, "0")}
              f={describeHallazgo(h, currency, valorUF)}
            />
          ))}

          {/* Puente a la pirámide — pegado al TOP-3 (veredictoFrase ya no se renderiza) */}
          {topHallazgos.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[var(--franco-border)]">
              <span className="block font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--franco-text-tertiary)]">
                Cómo pesa cada hallazgo ↓
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ POSICIÓN DE FRANCO — full-width, ambas columnas (A5) ═══ */}
      {cajaAccionable && (
        <div className="px-6 md:px-8 pb-4">
          <div
            style={{
              borderLeft: "3px solid var(--signal-red)",
              borderRadius: "0 8px 8px 0",
              background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            }}
          >
            <div className="px-4 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--signal-red)] block mb-1.5">
                La posición de Franco
              </span>
              <p className="font-body text-[13.5px] leading-[1.55] italic text-[var(--franco-text)] m-0">
                {cajaAccionable}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ PIE · FIRMA (absorbe el disclaimer IA) ═══ */}
      <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-2">
        <span className="font-body text-[11px] text-[var(--franco-text-muted)]">
          Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}
        </span>
        <Wordmark />
      </div>
    </div>
  );
}

// Split compartido entre F3 (score|mapa) y F4 (veredicto|findings) — riel derecho
// continuo. ~52/48 (A2). Definido una sola vez para que ambas filas coincidan.
const SHARED_GRID = "md:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]";

// ── Wordmark refranco.ai (mismo tratamiento que FrancoLogo/UnifiedNav) ──
function Wordmark() {
  return (
    <span className="inline-flex items-baseline leading-none">
      <span
        className="font-heading italic font-light text-[17px]"
        style={{ color: "var(--franco-wm-re)", marginRight: "-0.08em" }}
      >
        re
      </span>
      <span className="font-heading font-bold text-[17px]" style={{ color: "var(--franco-wm-franco)" }}>
        franco
      </span>
      <span
        className="font-body font-semibold tracking-wide text-[#C8323C]"
        style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}
      >
        .ai
      </span>
    </span>
  );
}

// ── Badge veredicto en línea con el score ──
function VerdictBadge({ veredicto }: { veredicto: string }) {
  const isCompra = veredicto === "COMPRAR";
  const isAjusta = veredicto === "AJUSTA SUPUESTOS";
  const bg = isCompra ? "var(--franco-text)" : isAjusta ? "transparent" : "var(--signal-red)";
  const color = isCompra ? "var(--franco-bg)" : isAjusta ? "var(--signal-red)" : "#fff";
  const border = isAjusta ? "0.5px solid color-mix(in srgb, var(--signal-red) 40%, transparent)" : undefined;
  return (
    <span
      className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] px-3 py-1.5 rounded-md whitespace-nowrap"
      style={{ background: bg, color, border }}
    >
      {veredicto}
    </span>
  );
}

// ── Barra de score con degradé (rojo→ámbar→neutro) + marcador ──
// El ámbar del medidor es una excepción DOCUMENTADA del sistema cromático
// (franco-design-system §"Excepción medidor de score"): el degradé del gauge es
// más legible que Signal Red→Ink puro. No es color de marca ni decoración; es la
// escala del propio medidor. SIN verde.
function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="mt-5">
      <div
        className="relative h-[7px] rounded-[4px]"
        style={{
          background:
            "linear-gradient(90deg,#C8323C 0%, #C8323C 14%, #B9793E 46%, #6E6C66 74%, #4A4A46 100%)",
        }}
      >
        <div
          className="absolute top-1/2 w-[14px] h-[14px] rounded-full"
          style={{
            left: `${pct}%`,
            transform: "translate(-50%,-50%)",
            background: "var(--franco-text)",
            border: "3px solid var(--franco-bg)",
            boxShadow: "0 0 0 1px var(--franco-border-strong)",
          }}
        />
      </div>
      <div className="flex justify-between mt-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-secondary)]">
          Buscar otra
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)]">
          Ajusta supuestos
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)]">
          Comprar
        </span>
      </div>
    </div>
  );
}

// ── Toggle CLP/UF ──
function CurrencyToggle({
  currency,
  onCurrencyChange,
}: {
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg overflow-hidden shrink-0"
      style={{ border: "0.5px solid var(--franco-border-strong)" }}
      role="group"
      aria-label="Moneda"
    >
      {(["CLP", "UF"] as const).map((c) => {
        const on = currency === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onCurrencyChange(c)}
            className="font-mono text-[11px] font-medium tracking-[0.06em] px-3 py-1.5 transition-colors"
            style={{
              background: on ? "var(--franco-text)" : "transparent",
              color: on ? "var(--franco-bg)" : "var(--franco-text-muted)",
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ── Chip fino con ícono ──
function Chip({
  icon,
  k,
  unit,
  sub,
}: {
  icon: ReactNode;
  k: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap flex-none"
      style={{
        border: "0.5px solid var(--franco-border)",
        background: "var(--franco-bg-alt)",
      }}
    >
      <span className="w-3 h-3 shrink-0 text-[var(--franco-text-tertiary)] [&>svg]:w-3 [&>svg]:h-3">
        {icon}
      </span>
      <span className="font-mono text-[12px] font-medium text-[var(--franco-text)]">{k}</span>
      {unit && (
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)] tracking-[0.02em]">
          {unit}
        </span>
      )}
      {sub && (
        <span className="font-mono text-[9.5px] text-[var(--franco-text-muted)]">{sub}</span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// F4 helpers — findings, prosa con números en mono, firma
// ═══════════════════════════════════════════════════════════════════════════

// Fecha de la firma: "3 jul 2026" (es-CL). Vacío si no hay createdAt válido.
function formatFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

// Porcentaje con 1 decimal es-CL (2 → "2,0"). Signo del propio número.
function pct1(n: number): string {
  return n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Margen de sensibilidad: entero sin decimal (−7%), coma chilena si no (−7,5%).
function fmtMargin(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

// Monto con signo explícito (− real, U+2212) respetando el toggle.
function fmtSigned(clp: number, currency: "CLP" | "UF", valorUF: number): string {
  const s = clp < 0 ? "−" : "+";
  return s + fmtMoney(Math.abs(clp), currency, valorUF);
}

/**
 * Junta los proto-hallazgos disponibles (carriers en metrics + ai_analysis +
 * results.hallazgos), dedupe por id (mayor decisividad gana) y ordena por
 * decisividad desc. El caller toma el TOP-N.
 */
function gatherTopHallazgos(
  results: FullAnalysisResult | null | undefined,
  data: AIAnalysisV2,
): Hallazgo[] {
  const out: Hallazgo[] = [];
  const push = (h: Hallazgo | null | undefined) => {
    if (!h || typeof h.decisividad !== "number") return;
    // estructura_financiamiento ya NO se excluye: con la calibración a "Δdecisión"
    // su decisividad refleja cuánto mueve la decisión (no el 0,85 fijo por nivel),
    // así que cae bajo el aporte cuando no es vinculante y sube al TOP-3 solo si
    // realmente lo es. El sort de dos niveles (decisividad, magnitud) lo ordena bien.
    out.push(h);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = results?.metrics as any;
  push(m?.hallazgoSobreprecio);
  push(m?.hallazgoCapRate);
  push(m?.hallazgoFlujoMensual);
  push(m?.hallazgoPlusvalia);
  push(m?.hallazgoPuestaAPunto);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push((data as any)?.hallazgoSobreprecio);
  if (Array.isArray(results?.hallazgos)) results.hallazgos.forEach(push);

  const byId = new Map<string, Hallazgo>();
  for (const h of out) {
    const prev = byId.get(h.id);
    // El hallazgo CON titular gana SIEMPRE al que no lo tiene (presencia de titular
    // = clave primaria). Sobreprecio tiene copia persistida en ai_analysis (legacy,
    // sin titular, decisividad de calibración vieja) y otra recomputada fresca (con
    // titular). El fresco es la fuente de verdad: gana aunque su decisividad sea
    // menor, y así el RANKING usa la decisividad correcta (no la stale). Entre dos
    // con el mismo estado de titular, manda la mayor decisividad, como antes.
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  // Orden: decisividad DESC y, dentro del mismo valor, magnitud continua DESC
  // (desempate E4 — mismo comparador que la pirámide en ai-generation.ts).
  return Array.from(byId.values()).sort(
    (a, b) => b.decisividad - a.decisividad || (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0),
  );
}

interface FindingView {
  desc: string;
  term: string;
  tooltip: string;
  kpi: string;
  kpiSub?: string;
  kpiRed: boolean;
}

// Traduce un proto-hallazgo del motor a la fila de la card (desc de asesor +
// término técnico + KPI). Narrowing por `id` (unión discriminada).
function describeHallazgo(h: Hallazgo, currency: "CLP" | "UF", valorUF: number): FindingView {
  const tip = h.procedencia?.base ?? "";
  // Narrativa = titular del motor (direction-aware, 6-12 palabras, sin número).
  // Fuente única con la pirámide; la línea nunca contradice al KPI ni queda
  // descabezada (el bug de rebanar fraseCanonica, que tiene 2 familias invertidas).
  // Fallback SOLO para hallazgos legacy sin titular (sobreprecio persistido en
  // ai_analysis pre-deploy, cuando el recompute fresco no está disponible):
  // fraseCanonica COMPLETA — la línea jamás queda vacía. Se ve larga, nunca en blanco.
  const desc = h.titular || h.fraseCanonica;
  switch (h.id) {
    case "sobreprecio": {
      const v = h.valor;
      return {
        desc,
        term: "Precio/m² vs comuna",
        tooltip: `${tip}${v.n ? ` · n = ${v.n}` : ""}.`,
        // Signo direction-aware: antes hardcodeaba "+" → "+-12%" en favorable (desv<0).
        kpi: `${v.desviacionPct > 0 ? "+" : ""}${Math.round(v.desviacionPct)}%`,
        kpiSub: `UF ${pct1(v.sujetoUfM2)} vs UF ${pct1(v.medianaComunaUfM2)}`,
        kpiRed: false,
      };
    }
    case "cap_rate": {
      const v = h.valor;
      return {
        desc,
        term: "CAP rate",
        tooltip: tip ? `${tip}.` : "Rentabilidad operativa neta (NOI) sobre el precio.",
        kpi: `${pct1(v.capRatePct)}%`,
        kpiSub: `gap ${pct1(v.gapPts)} pts vs ${pct1(v.capRefPct)}%`,
        kpiRed: false,
      };
    }
    case "flujo_mensual": {
      const v = h.valor;
      return {
        desc,
        term: "Aporte mensual",
        tooltip: tip
          ? `${tip}.`
          : "Flujo neto tras la cuota del crédito y gastos. Negativo = sale de tu bolsillo.",
        kpi: fmtSigned(v.flujoNetoMensualCLP, currency, valorUF),
        kpiSub: "cada mes · toda la proyección",
        kpiRed: v.flujoNetoMensualCLP < 0,
      };
    }
    case "plusvalia": {
      const v = h.valor;
      return {
        desc,
        term: "Plusvalía histórica",
        tooltip: tip ? `${tip}.` : "Apreciación histórica de la comuna. Referencia, no garantía.",
        kpi: `${pct1(v.anualizadaPct)}%`,
        kpiSub: "anual · 2014-2024",
        kpiRed: false,
      };
    }
    case "capex_puesta_a_punto": {
      const v = h.valor;
      return {
        desc,
        term: "CapEx habilitación",
        tooltip: tip ? `${tip}.` : "Inversión estimada para dejarlo en estándar de arriendo.",
        kpi: currency === "UF" ? fmtUF(v.montoUF) : fmtCLP(v.montoCLP),
        kpiSub: "puesta a punto",
        kpiRed: false,
      };
    }
    case "estructura_financiamiento": {
      const v = h.valor;
      return {
        desc,
        term: "Estructura (pie/tasa)",
        tooltip: tip ? `${tip}.` : "Salud combinada de pie y tasa contra el mercado.",
        kpi: `${v.piePct}% / ${pct1(v.tasaPct)}%`,
        kpiSub: "pie / tasa",
        kpiRed: h.direccion === "adverso",
      };
    }
    case "tir": {
      const v = h.valor;
      return {
        desc,
        term: "TIR a 10 años",
        // Glosa inline en el tooltip: la card de la pirámide glosa TIR en su body, pero
        // la fila del hero es terse; el tooltip explica el concepto (skill §279).
        tooltip: `Rentabilidad anual de toda tu inversión — integra tus aportes y la venta a 10 años. Mínimo sano: ${v.umbralPct}%.`,
        kpi: `${pct1(v.tirPct)}%`,
        kpiSub: `vs mínimo ${v.umbralPct}% · a 10 años`,
        kpiRed: false, // espejo cap_rate — el punto de dirección carga la señal adversa
      };
    }
    case "sensibilidad": {
      const v = h.valor;
      return {
        desc,
        term: "Margen del veredicto",
        // Glosa inline (skill A11): consecuencia vivida, sin narrar la mecánica ("cruza"/
        // "breakeven"). La fila del hero es terse; el tooltip explica el concepto.
        tooltip: `Cuánto puede caer el arriendo real frente al que declaraste sin que cambie el veredicto — mide qué tan firme es la conclusión.`,
        // KPI Opción A (mismo formato que findingDisplay): el verbo carga la dirección.
        kpi: v.firme
          ? "Aguanta −50% o más"
          : h.direccion === "adverso"
            ? `Se cae con −${fmtMargin(v.marginPct)}%`
            : `Aguanta hasta −${fmtMargin(v.marginPct)}%`,
        kpiSub: v.firme ? "veredicto firme" : `pasa a ${v.veredictoNuevo}`,
        kpiRed: h.direccion === "adverso",
      };
    }
    case "patrimonio": {
      const v = h.valor;
      const multFmt = "×" + (Math.round(v.multiplicador * 10) / 10).toFixed(1).replace(".", ",");
      return {
        desc,
        term: "Patrimonio a 10 años",
        // Glosa inline: qué es el número (lo que te queda al vender) y contra qué se lee
        // (lo aportado). Sin narrar la mecánica ni comparar instrumentos (D5).
        tooltip: `Lo que te queda al vender a 10 años, neto de deuda y comisión, contra todo lo que pusiste. El multiplicador dice cuántas veces recuperas lo aportado.`,
        kpi: fmtMoney(v.patrimonioCLP, currency, valorUF),
        kpiSub: `${multFmt} lo aportado`,
        kpiRed: h.direccion === "adverso", // multiplicador < 1: terminas con menos
      };
    }
    default:
      return { desc: "", term: "", tooltip: "", kpi: "", kpiRed: false };
  }
}

/**
 * Renderiza prosa con los números (montos $/UF y porcentajes) en JetBrains Mono
 * inline. Split con grupo de captura: los tokens numéricos caen en índices impares.
 */
function renderProsaMono(texto: string): ReactNode {
  if (!texto) return null;
  const RE =
    /((?:−|-)?\$\s?[\d.]+(?:,\d+)?|UF\s?[\d.]+(?:,\d+)?|(?:\+|−|-)?\d+(?:[.,]\d+)?\s?%)/g;
  return texto.split(/\n\n+/).map((par, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {par.split(RE).map((part, j) =>
        j % 2 === 1 ? (
          <span
            key={j}
            className="font-mono text-[13px] text-[var(--franco-text)] px-1 rounded"
            style={{ background: "color-mix(in srgb, var(--franco-text) 5%, transparent)" }}
          >
            {part}
          </span>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </p>
  ));
}

// ── Fila de finding: rank + desc asesor + término con tooltip + KPI ──
function FindingRow({ rank, f }: { rank: string; f: FindingView }) {
  return (
    <div className="grid grid-cols-[20px_1fr_auto] gap-3 py-3 items-start border-t border-[var(--franco-border)] first:border-t-0">
      <div className="font-mono text-[12px] font-bold text-[var(--franco-text-tertiary)] pt-0.5">
        {rank}
      </div>
      <div className="min-w-0">
        <div className="font-body text-[12.5px] leading-[1.4] text-[var(--franco-text)]">
          {f.desc}
        </div>
        <Tooltip term={f.term} tip={f.tooltip} />
      </div>
      <div className="text-right whitespace-nowrap">
        <div
          className="font-mono text-[17px] font-bold leading-none"
          style={{ color: f.kpiRed ? "var(--signal-red)" : "var(--franco-text)" }}
        >
          {f.kpi}
        </div>
        {f.kpiSub && (
          <span className="block mt-1.5 font-mono text-[9.5px] text-[var(--franco-text-muted)]">
            {f.kpiSub}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Término técnico con tooltip on-hover ──
function Tooltip({ term, tip }: { term: string; tip: string }) {
  return (
    <span className="relative group inline-flex items-center gap-1 mt-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)] border-b border-dotted border-[var(--franco-border-strong)] cursor-help">
        {term}
      </span>
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-[var(--franco-border-strong)] text-[8px] font-mono text-[var(--franco-text-muted)]">
        i
      </span>
      {tip && (
        <span
          className="pointer-events-none absolute bottom-[135%] left-0 z-10 w-[236px] rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{
            background: "var(--franco-card)",
            border: "0.5px solid var(--franco-border-strong)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <span className="font-body text-[11px] leading-[1.45] text-[var(--franco-text-secondary)]">
            {tip}
          </span>
        </span>
      )}
    </span>
  );
}
