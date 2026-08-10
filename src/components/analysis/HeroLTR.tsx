"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { BedDouble, Bath, Ruler, Clock, Building2, Scaling, Percent, Wallet } from "lucide-react";
import { fmtUF } from "@/components/analysis/utils";
import { MapaThumbnail, type Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { IndiceRow } from "./IndiceHallazgos";
import { numeroHallazgo } from "@/lib/orden-hallazgos";
import { ProgresoGeneracion } from "@/components/analysis/ProsaSkeleton";

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
  onOpenDrawer,
  veredicto,
  score,
  propiedadTitle,
  inputData,
  results,
  comuna,
  ciudad,
  valorUF,
  createdAt,
  prosaError,
  onRetryProsa,
}: {
  /** Prosa IA. `null` mientras se genera (Goal C/E/E.2: veredicto inmediato) —
   *  el hero renderiza todo lo que viene del motor y el slot de prosa muestra
   *  ProgresoGeneracion (skeleton didáctico) hasta que llegue. */
  data: AIAnalysisV2 | null;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  inputData: AnalisisInput | null | undefined;
  results: FullAnalysisResult | null | undefined;
  comuna?: string;
  /** Abre un drawer desde "La posición de Franco". Sin este callback el bloque queda
   *  informativo (sin affordance), que es el comportamiento previo. */
  onOpenDrawer?: (key: DrawerKey) => void;
  ciudad?: string;
  valorUF: number;
  createdAt?: string;
  /** Fallo de la generación de prosa: se muestra inline en el slot (el resto del
   *  hero sigue vivo) con CTA de reintento. */
  prosaError?: string | null;
  onRetryProsa?: () => void;
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
  // Con prosa en vuelo (data null): el slot muestra ProgresoGeneracion (Goal
  // E.2 — skeleton didáctico), o el error inline si la generación falló.
  const conviene = data?.conviene;
  const respuesta =
    (currency === "CLP" ? conviene?.respuestaDirecta_clp : conviene?.respuestaDirecta_uf) ?? null;
  const cajaAccionable =
    (currency === "CLP" ? conviene?.cajaAccionable_clp : conviene?.cajaAccionable_uf) ?? null;
  // veredictoFrase (schema.conviene) ya no se renderiza en el hero compacto — la
  // prosa fundida lo dice. El campo sigue en el schema (Entrega 2 decide su destino).
  const pregunta = conviene?.pregunta || "¿Conviene o no conviene?";
  // ÍNDICE del informe: los primeros 3 del ORDEN ÚNICO — el MISMO array que renderiza
  // la pirámide (fuente única: ordenarHallazgosPiramide). El hero los numera 01-03 y
  // cada fila ancla a su card; la pirámide continúa la numeración.
  const ordenados = ordenarHallazgosPiramide(results, data);
  const topHallazgos = ordenados.slice(0, 3);
  const restantes = Math.max(0, ordenados.length - topHallazgos.length);
  // Goal E.2 — la apertura estática del 01 MURIÓ (confundía: parecía prosa
  // cortada, no prosa creciendo — decisión post-deploy). El slot en carga es
  // ProgresoGeneracion: skeleton didáctico con stepper + barra conservadora +
  // rango honesto. Contrato: mockup-hero-skeleton-didactico.html.

  // Destino del drawer de la posición de Franco, por veredicto:
  //  · no-COMPRAR con hallazgo de distancia → "Lo que te separa" (las vías, o por qué no
  //    cierra si es estructural). El label distingue: prometer "vías" donde no las hay
  //    sería el mismo error que ya se corrigió en el kicker de la card.
  //  · COMPRAR → "Margen del veredicto". Acá la pregunta que sigue no es qué falta sino
  //    cuánto aguanta antes de dejar de convenir, y ese drawer ya existe (sensibilidad se
  //    emite en todo COMPRAR). Decisión de Fabrizio en el gate del mockup.
  const hallazgosRow = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaRow = hallazgosRow.find((h) => h.id === "distancia_veredicto");
  const posicionDrawer: { key: DrawerKey; label: string } | null = distanciaRow
    ? {
        key: "distanciaVeredicto",
        label:
          distanciaRow.id === "distancia_veredicto" && distanciaRow.valor.esEstructural
            ? "Por qué no cierra"
            : "Ver las vías",
      }
    : hallazgosRow.some((h) => h.id === "sensibilidad")
      ? { key: "sensibilidad", label: "Ver el margen" }
      : null;
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
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
            Franco Score
            <InfoTooltip content="Resume la calidad de la inversión en un número del 0 al 100: rentabilidad, flujo, plusvalía y riesgo juntos. De ahí sale el veredicto — sobre 70 conviene, bajo 45 no." />
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
          {respuesta ? (
            <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
              {renderProsaMono(respuesta)}
            </div>
          ) : prosaError ? (
            /* Error de generación inline: el hero (veredicto/score/índice) sigue
               vivo; solo el slot de prosa reporta y ofrece reintentar. */
            <div className="max-w-[65ch]">
              <p className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mb-2">
                No pudimos completar la redacción del análisis.
              </p>
              {onRetryProsa && (
                <button
                  type="button"
                  onClick={onRetryProsa}
                  className="font-body text-sm font-medium text-signal-red hover:underline"
                >
                  Reintentar
                </button>
              )}
            </div>
          ) : (
            /* Prosa en vuelo (Goal E.2): skeleton didáctico — inequívoco que se
               está generando, en qué etapa va y cuánto suele tomar. */
            <ProgresoGeneracion />
          )}
        </div>

        {/* ÍNDICE — primeros 3 del orden único, numerados y clickeables (ancla a su card) */}
        <div>
          {topHallazgos.length > 0 && (
            <>
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text)] mb-2.5">
                Léelo en este orden ↓
              </div>
              {topHallazgos.map((h, i) => (
                <IndiceRow key={h.id} rank={numeroHallazgo(i)} h={h} currency={currency} valorUF={valorUF} />
              ))}
              {restantes > 0 && (
                <div className="font-body text-[11.5px] text-[var(--franco-text-muted)] mt-2">
                  …y {restantes} hallazgos más, abajo, en el mismo orden.
                </div>
              )}
              {/* Puente a la pirámide (veredictoFrase ya no se renderiza) */}
              <div className="mt-3 pt-2.5 border-t border-[var(--franco-border)]">
                <span className="block font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--franco-text-tertiary)]">
                  Cómo pesa cada hallazgo ↓
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ POSICIÓN DE FRANCO — full-width, ambas columnas (A5) ═══
          Gana affordance de drawer: es donde vive la salida del análisis, así que es el
          lugar natural para abrir el detalle. Reusa el lenguaje que el usuario ya aprendió
          en la pirámide (franco-card-target + link mono al pie); cero primitivas nuevas.
          Qué abre depende del veredicto y el link SIEMPRE lo anuncia — la inconsistencia
          de destino no molesta si el label dice a dónde vas. */}
      {cajaAccionable && (
        <div className="px-6 md:px-8 pb-4">
          <div
            className={posicionDrawer ? "franco-card-target cursor-pointer" : undefined}
            style={{
              borderLeft: "3px solid var(--signal-red)",
              borderRadius: "0 8px 8px 0",
              background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            }}
            {...(posicionDrawer
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: () => onOpenDrawer?.(posicionDrawer.key),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDrawer?.(posicionDrawer.key);
                    }
                  },
                }
              : {})}
          >
            <div className="px-4 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--signal-red)] block mb-1.5">
                La posición de Franco
              </span>
              <p className="font-body text-[13.5px] leading-[1.55] italic text-[var(--franco-text)] m-0">
                {cajaAccionable}
              </p>
              {posicionDrawer && (
                /* Divisor en Signal Red al 20%: dentro de un bloque con wash rojo el
                   hairline neutro se ve sucio. Único ajuste de token del cambio. */
                <div
                  className="mt-3 pt-2.5 flex justify-end"
                  style={{ borderTop: "1px solid color-mix(in srgb, var(--signal-red) 20%, transparent)" }}
                >
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
                    {posicionDrawer.label} →
                  </span>
                </div>
              )}
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

