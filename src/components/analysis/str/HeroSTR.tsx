"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BedDouble, Bath, Ruler, Building2, Scaling, Percent, Wrench } from "lucide-react";
import type { Hallazgo, AIAnalysisSTRv2 } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { fmtUF } from "@/components/analysis/utils";
import { findingDisplay } from "@/components/analysis/GenericFindingCard";
import { MapaThumbnail, type Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { formatDireccionDisplay } from "@/lib/format-direccion";

/**
 * Hero de resultados STR (E.5) — port del patrón HeroLTR al módulo renta corta.
 * Reemplaza el paradigma viejo (HeroVerdictBlockSTR: HeroTopStrip + callout
 * veredictoFrase + 3 DatoCards). UNA superficie continua dividida por hairlines:
 *   F1 identidad (dirección + toggle) · F3 score+gauge+chips | mapa (ubicación) ·
 *   F4 veredicto (prosa) | TOP-3 hallazgos + puente a la pirámide · pie firma.
 *
 * Decisiones de producto (⛔#1 Fabrizio):
 *  · Variante A CON mapa, con comparables igual que HeroLTR (mismo endpoint
 *    /api/data/suggestions type=venta; STR tiene comuna/superficie/dorm/lat/lng).
 *    ZonaCardSTR conserva el suyo — la redundancia de dos mapas se ajusta en rama
 *    posterior si molesta en producción, no recortando el del hero.
 *  · Título: conviene.pregunta ?? hardcode por veredicto (v3 podó `pregunta`).
 *  · veredictoFrase NO se renderiza (LTR lo mató; la prosa fundida lo dice).
 *
 * Los primitivos visuales (CurrencyToggle/ScoreBar/Chip/Wordmark/renderProsaMono/
 * FindingRow) se replican self-contained a propósito (HeroLTR queda intacto —
 * producción crítica). Consolidación en un shared: paso posterior.
 */

// ── Formato chileno ──
const pct1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// CLP en millones abreviados ("$158,8 MM"); bajo $1 MM en miles.
const fmtMM = (clp: number) => {
  if (!Number.isFinite(clp) || clp <= 0) return "—";
  if (Math.abs(clp) < 1_000_000) return "$" + Math.round(clp / 1000).toLocaleString("es-CL") + " mil";
  return "$" + (clp / 1_000_000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
};

const TIPO_LABEL: Record<string, string> = { nuevo: "Nuevo", usado: "Usado" };

export function HeroSTR({
  ai,
  results,
  veredicto,
  score,
  inputData,
  comuna,
  ciudad,
  currency,
  onCurrencyChange,
  valorUF,
  createdAt,
}: {
  ai: AIAnalysisSTRv2 | null;
  results: ShortTermResult;
  veredicto: STRVerdict;
  score: number | null;
  inputData: Record<string, unknown> | null;
  comuna: string;
  ciudad?: string;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  valorUF: number;
  createdAt?: string;
}) {
  const v = (normalizeLegacyVerdict(veredicto) as STRVerdict | null) ?? "BUSCAR OTRA";

  // ── F1 identidad ──
  const direccion = formatDireccionDisplay((inputData?.direccion as string) ?? "");
  const comunaLabel = comuna || (inputData?.comuna as string) || ciudad || "";
  const hasDireccion = direccion.length > 0;
  const fallbackTitle = `Depto en ${comunaLabel || "renta corta"}`;

  // ── F3 chips (leen del input_data persistido STR — piePct/superficieUtil/precioCompraUF) ──
  const dorm = inputData?.dormitorios as number | undefined;
  const banos = inputData?.banos as number | undefined;
  const superficie = Number(inputData?.superficieUtil) || 0;
  const precioUF = Number(inputData?.precioCompraUF) || 0;
  const precioCLP = Number(inputData?.precioCompra) || (precioUF > 0 ? precioUF * valorUF : 0);
  const precioM2UF = superficie > 0 && precioUF > 0 ? precioUF / superficie : 0;
  const piePct = Number(inputData?.piePct) || 0;
  const plazo = Number(inputData?.plazoCredito) || 0;
  const tasa = Number(inputData?.tasaInteres) || 0;
  const antiguedad = inputData?.antiguedad as number | undefined;
  const tipoPropiedad = (inputData?.tipoPropiedad as string) ?? "";
  const modoGestion = (inputData?.modoGestion as string) === "auto" ? "Auto" : "Admin";

  const precioChip = currency === "UF" ? fmtUF(precioUF) : fmtMM(precioCLP);
  const m2Chip = precioM2UF > 0 ? `UF ${pct1(precioM2UF)}` : "—";
  const lat = typeof inputData?.lat === "number" ? (inputData.lat as number) : null;
  const lng = typeof inputData?.lng === "number" ? (inputData.lng as number) : null;
  const mapLabel = hasDireccion ? direccion : comunaLabel;

  // Comparables de venta cercanos para el mapa — mismo endpoint y forma que HeroLTR
  // (STR también es una compra ⇒ type=venta). STR persiste lat/lng top-level.
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

  // ── F4 veredicto ──
  const conviene = ai?.conviene;
  const respuesta = conviene?.respuestaDirecta?.trim() || null;
  const reencuadre = conviene?.reencuadre?.trim() || null;
  const cajaAccionable = conviene?.cajaAccionable?.trim() || null;
  // v3 podó `pregunta` → fallback hardcode por veredicto es el caso dominante.
  const pregunta =
    conviene?.pregunta?.trim() ||
    (v === "BUSCAR OTRA"
      ? "¿Conviene operar este depto en renta corta?"
      : v === "AJUSTA SUPUESTOS"
        ? "¿Cómo puedes hacer rendir este depto en renta corta?"
        : "¿Es buena oportunidad para renta corta?");

  const isNeutro = v === "COMPRAR";
  const cajaLabel = isNeutro ? "Considera antes de cerrar" : "La posición de Franco";

  // ── TOP-3 hallazgos por decisividad (de la pirámide persistida) ──
  const top3 = gatherTop(results.hallazgos).slice(0, 3);
  const fechaFirma = formatFecha(createdAt);

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-3"
      style={{ background: "var(--franco-bg)", border: "0.5px solid var(--franco-border-strong)" }}
    >
      {/* F1 · IDENTIDAD */}
      <div className="flex items-start justify-between gap-6 px-6 md:px-8 pt-4 pb-3.5">
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-[23px] md:text-[27px] leading-[1.15] tracking-[-0.01em] text-[var(--franco-text)] m-0">
            {hasDireccion ? (
              <>
                {direccion}
                {comunaLabel && <span className="font-normal text-[var(--franco-text-secondary)]"> · {comunaLabel}</span>}
              </>
            ) : (
              fallbackTitle
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] whitespace-nowrap">
            Análisis renta corta
          </span>
          <CurrencyToggle currency={currency} onCurrencyChange={onCurrencyChange} />
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* F3 · SCORE+CHIPS | MAPA (66/34) */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,66fr)_minmax(0,34fr)] gap-x-8 gap-y-6 px-6 md:px-8 py-3">
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
            Franco Score
          </span>
          <div className="flex items-center gap-4 mt-3">
            <div className="font-mono font-bold text-[48px] md:text-[52px] leading-[0.9] tracking-[-0.02em] text-[var(--franco-text)]">
              {score === null ? "—" : score}
              <span className="text-[22px] font-normal text-[var(--franco-text-muted)]">/100</span>
            </div>
            <VerdictBadge veredicto={v} />
          </div>
          <ScoreBar score={score} />
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<BedDouble />} k={dorm != null ? String(dorm) : "—"} unit="dorm" />
              <Chip icon={<Bath />} k={banos != null ? String(banos) : "—"} unit="baño" />
              <Chip icon={<Ruler />} k={superficie > 0 ? String(superficie) : "—"} unit="m²" />
              <Chip icon={<Building2 />} k={antiguedad != null ? String(antiguedad) : (TIPO_LABEL[tipoPropiedad] ?? "—")} unit={antiguedad != null ? "años" : undefined} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<Building2 />} k={precioChip} />
              <Chip icon={<Scaling />} k={m2Chip} unit="/m²" />
              <Chip icon={<Percent />} k={piePct > 0 ? `${Math.round(piePct)}%` : "—"} unit="pie" sub={plazo > 0 ? `· ${plazo} años · ${pct1(tasa)}%` : undefined} />
              <Chip icon={<Wrench />} k={modoGestion} unit="gestión" />
            </div>
          </div>
        </div>
        <div className="flex">
          <div className="flex-1">
            <MapaThumbnail lat={lat} lng={lng} comparables={comparables} comparablesCount={comparablesCount} locationLabel={mapLabel} height={196} />
          </div>
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* F4 · VEREDICTO | FINDINGS (52/48) */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] gap-x-8 gap-y-8 px-6 md:px-8 py-[9px]">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] mb-3 m-0">
            Veredicto
          </p>
          <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0">
            {pregunta}
          </h2>
          <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
            {respuesta ? renderProsaMono(respuesta) : (
              <p className="m-0 italic text-[var(--franco-text-muted)]">Franco está completando el análisis…</p>
            )}
            {reencuadre && <div className="mt-3">{renderProsaMono(reencuadre)}</div>}
          </div>

          {cajaAccionable && (
            <div
              className="mt-5"
              style={{
                borderLeft: `3px solid ${isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)"}`,
                borderRadius: "0 8px 8px 0",
                background: isNeutro ? "var(--franco-bg-alt)" : "color-mix(in srgb, var(--signal-red) 5%, transparent)",
              }}
            >
              <div className="px-4 py-3.5">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold block mb-1.5"
                  style={{ color: isNeutro ? "var(--franco-text-tertiary)" : "var(--signal-red)" }}
                >
                  {cajaLabel}
                </span>
                <p
                  className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text)] m-0"
                  style={{ fontStyle: isNeutro ? "normal" : "italic" }}
                >
                  {cajaAccionable}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* TOP-3 findings */}
        <div>
          <div className="font-heading font-bold text-[15px] text-[var(--franco-text)] mb-0.5">
            Lo que define este veredicto
          </div>
          <div className="font-body text-[11.5px] text-[var(--franco-text-muted)] mb-4">
            {top3.length > 0
              ? `Los ${top3.length} hallazgos que más movieron el score, por decisividad.`
              : "Hallazgos que definen el score."}
          </div>

          {top3.map((h, i) => (
            <FindingRow key={h.id} rank={String(i + 1).padStart(2, "0")} h={h} currency={currency} valorUF={valorUF} />
          ))}

          {top3.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[var(--franco-border)]">
              <span className="block font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--franco-text-tertiary)]">
                Cómo pesa cada hallazgo ↓
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* PIE · FIRMA */}
      <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-2">
        <span className="font-body text-[11px] text-[var(--franco-text-muted)]">
          Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}
        </span>
        <Wordmark />
      </div>
    </div>
  );
}

// ── Dedup + orden por decisividad (espejo de gatherTopHallazgos LTR) ──
function gatherTop(hallazgos: Hallazgo[] | null | undefined): Hallazgo[] {
  const list = Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : [];
  const byId = new Map<string, Hallazgo>();
  for (const h of list) {
    if (typeof h.decisividad !== "number") continue;
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.decisividad - a.decisividad || (b.magnitudContinua ?? 0) - (a.magnitudContinua ?? 0),
  );
}

// ── Wordmark refranco.ai ──
function Wordmark() {
  return (
    <span className="inline-flex items-baseline leading-none">
      <span className="font-heading italic font-light text-[17px]" style={{ color: "var(--franco-wm-re)", marginRight: "-0.08em" }}>re</span>
      <span className="font-heading font-bold text-[17px]" style={{ color: "var(--franco-wm-franco)" }}>franco</span>
      <span className="font-body font-semibold tracking-wide text-[#C8323C]" style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}>.ai</span>
    </span>
  );
}

// ── Badge veredicto (3 valores canónicos STR) ──
function VerdictBadge({ veredicto }: { veredicto: STRVerdict }) {
  const isCompra = veredicto === "COMPRAR";
  const isAjusta = veredicto === "AJUSTA SUPUESTOS";
  const bg = isCompra ? "var(--franco-text)" : isAjusta ? "transparent" : "var(--signal-red)";
  const color = isCompra ? "var(--franco-bg)" : isAjusta ? "var(--signal-red)" : "#fff";
  const border = isAjusta ? "0.5px solid color-mix(in srgb, var(--signal-red) 40%, transparent)" : undefined;
  return (
    <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] px-3 py-1.5 rounded-md whitespace-nowrap" style={{ background: bg, color, border }}>
      {veredicto}
    </span>
  );
}

// ── Gauge de score (acepta null: análisis legacy sin FrancoScore) ──
function ScoreBar({ score }: { score: number | null }) {
  const hasScore = score !== null && Number.isFinite(score);
  const pct = hasScore ? Math.max(0, Math.min(100, score as number)) : 0;
  return (
    <div className="mt-5">
      <div
        className="relative h-[7px] rounded-[4px]"
        style={{
          background: "linear-gradient(90deg,#C8323C 0%, #C8323C 14%, #B9793E 46%, #6E6C66 74%, #4A4A46 100%)",
          opacity: hasScore ? 1 : 0.35,
        }}
      >
        {hasScore && (
          <div
            className="absolute top-1/2 w-[14px] h-[14px] rounded-full"
            style={{ left: `${pct}%`, transform: "translate(-50%,-50%)", background: "var(--franco-text)", border: "3px solid var(--franco-bg)", boxShadow: "0 0 0 1px var(--franco-border-strong)" }}
          />
        )}
      </div>
      <div className="flex justify-between mt-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-secondary)]">Buscar otra</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)]">Ajusta supuestos</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)]">Comprar</span>
      </div>
    </div>
  );
}

// ── Toggle CLP/UF ──
function CurrencyToggle({ currency, onCurrencyChange }: { currency: "CLP" | "UF"; onCurrencyChange: (c: "CLP" | "UF") => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden shrink-0" style={{ border: "0.5px solid var(--franco-border-strong)" }} role="group" aria-label="Moneda">
      {(["CLP", "UF"] as const).map((c) => {
        const on = currency === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onCurrencyChange(c)}
            className="font-mono text-[11px] font-medium tracking-[0.06em] px-3 py-1.5 transition-colors"
            style={{ background: on ? "var(--franco-text)" : "transparent", color: on ? "var(--franco-bg)" : "var(--franco-text-muted)" }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ── Chip fino con ícono ──
function Chip({ icon, k, unit, sub }: { icon: ReactNode; k: string; unit?: string; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap flex-none" style={{ border: "0.5px solid var(--franco-border)", background: "var(--franco-bg-alt)" }}>
      <span className="w-3 h-3 shrink-0 text-[var(--franco-text-tertiary)] [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
      <span className="font-mono text-[12px] font-medium text-[var(--franco-text)]">{k}</span>
      {unit && <span className="font-mono text-[10px] text-[var(--franco-text-muted)] tracking-[0.02em]">{unit}</span>}
      {sub && <span className="font-mono text-[9.5px] text-[var(--franco-text-muted)]">{sub}</span>}
    </span>
  );
}

// ── Prosa con números ($/UF/%) en JetBrains Mono inline ──
function renderProsaMono(texto: string): ReactNode {
  if (!texto) return null;
  const RE = /((?:−|-)?\$\s?[\d.]+(?:,\d+)?|UF\s?[\d.]+(?:,\d+)?|(?:\+|−|-)?\d+(?:[.,]\d+)?\s?%)/g;
  return texto.split(/\n\n+/).map((par, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {par.split(RE).map((part, j) =>
        j % 2 === 1 ? (
          <span key={j} className="font-mono text-[13px] text-[var(--franco-text)] px-1 rounded" style={{ background: "rgba(250,250,248,0.05)" }}>{part}</span>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </p>
  ));
}

// Glosa canónica por tipo de hallazgo para el TOP-3 del hero (D-A · paridad con
// HeroLTR, que glosa cada término con tooltip). Una línea llana por tipo, alineada
// al glosario. Cubre los 6 hallazgos STR propios + los heredados que pueden coronar.
const GLOSA_TOP3: Partial<Record<Hallazgo["id"], string>> = {
  rentabilidad_str: "Cuánto renta la operación —el cap rate: lo que deja el arriendo tras los gastos de operarlo (NOI), sobre el precio— frente al umbral STR de referencia.",
  flujo_str: "Lo que te queda cada mes después de todos los costos, incluida la cuota del crédito.",
  ocupacion_vs_banda: "Qué porcentaje de las noches esperas ocupar, comparado con la banda de la comuna.",
  ventaja_vs_ltr: "Cuánto más (o menos) deja la renta corta frente a arrendar a un solo inquilino todo el año.",
  sensibilidad_str: "Cuánto puede caer el ingreso antes de llegar al punto de equilibrio (donde no ganas ni pones plata).",
  estructura_costos_str: "Qué parte del ingreso bruto se va en costos de operar el Airbnb.",
  sobreprecio: "Cuánto pagas por metro cuadrado frente a la mediana de publicación de la comuna.",
  plusvalia: "Cuánto se ha valorizado la comuna al año en la última década.",
  tir: "La rentabilidad anual de toda tu inversión (TIR), juntando flujo, plusvalía y venta al cierre.",
  patrimonio: "Cuánto vale tu parte al final del horizonte, frente a lo que pusiste.",
  capex_puesta_a_punto: "Lo que cuesta dejar el depto listo para operar, además del amoblamiento.",
  estructura_financiamiento: "Cómo financias la compra: cuánto de pie y a qué tasa, frente al óptimo.",
};

// Término técnico con tooltip on-hover — espejo del `Tooltip` local de HeroLTR (D-A).
// Self-contained a propósito (no toca el InfoTooltip compartido); paridad de affordance.
function FindingTooltip({ term, tip }: { term: string; tip: string }) {
  return (
    <span className="relative group inline-flex items-center gap-1 mt-1.5">
      <span className={`font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--franco-text-muted)] ${tip ? "border-b border-dotted border-[var(--franco-border-strong)] cursor-help" : ""}`}>
        {term}
      </span>
      {tip && (
        <>
          <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-[var(--franco-border-strong)] text-[8px] font-mono text-[var(--franco-text-muted)]">
            i
          </span>
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
        </>
      )}
    </span>
  );
}

// ── Fila de finding: rank + titular + término + KPI (reusa findingDisplay) ──
function FindingRow({ rank, h, currency, valorUF }: { rank: string; h: Hallazgo; currency: "CLP" | "UF"; valorUF: number }) {
  const d = findingDisplay(h, currency, valorUF);
  const desc = h.titular || d.title;
  return (
    <div className="grid grid-cols-[20px_1fr_auto] gap-3 py-3 items-start border-t border-[var(--franco-border)] first:border-t-0">
      <div className="font-mono text-[12px] font-bold text-[var(--franco-text-tertiary)] pt-0.5">{rank}</div>
      <div className="min-w-0">
        <div className="font-body text-[12.5px] leading-[1.4] text-[var(--franco-text)]">{desc}</div>
        <FindingTooltip term={d.kick} tip={GLOSA_TOP3[h.id] ?? ""} />
      </div>
      <div className="text-right whitespace-nowrap">
        <div className="font-mono text-[17px] font-bold leading-none" style={{ color: d.kpiRed ? "var(--signal-red)" : "var(--franco-text)" }}>{d.kpi}</div>
        {d.ksub && <span className="block mt-1.5 font-mono text-[9.5px] text-[var(--franco-text-muted)]">{d.ksub}</span>}
      </div>
    </div>
  );
}

// Fecha firma "3 jul 2026" (es-CL).
function formatFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}
