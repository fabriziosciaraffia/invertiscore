"use client";

import { type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { IndiceRow } from "./IndiceHallazgos";
import { numeroHallazgo } from "@/lib/orden-hallazgos";
import { describirMotivosLTR } from "@/lib/no-cierra-copy";
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
  onOpenDrawer,
  veredicto,
  results,
  valorUF,
  createdAt,
  fechaProsa,
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
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
  /** Fallo de la generación de prosa: se muestra inline en el slot (el resto del
   *  hero sigue vivo) con CTA de reintento. */
  prosaError?: string | null;
  onRetryProsa?: () => void;
}) {
  // FASE 3: F1/F2/F3 murieron — identidad, chips, score y mapa viven en la
  // PORTADA (PortadaInforme + useComparablesCercanos). Acá queda solo F4.

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
  // POR QUÉ NO CIERRA (LTR) — puerto del patrón STR (§1.12.8): la glosa de los
  // motivos que decidieron el veredicto, SOLO cuando lo decidió un gate y no la
  // banda del score. Los brazos del Gate 1 viajan en el hallazgo de distancia
  // (recomputado — misma fuente que su drawer); la capa del Gate 2 no tiene
  // brazo persistido y se deriva: score en banda COMPRAR (≥70) con veredicto
  // AJUSTA ⇒ el gate capó. Veredicto de banda pura → null y no se muestra nada:
  // inventar una causa sería peor que no darla (§1.9.3).
  const gate2Capo = (results?.score ?? 0) >= 70 && veredicto === "AJUSTA SUPUESTOS";
  const motivosLTR = describirMotivosLTR(
    (distanciaRow?.valor as { brazosGate1Activos?: string[] } | undefined)?.brazosGate1Activos ?? [],
    gate2Capo,
  );
  const fechaFirma = formatFecha(fechaProsa ?? createdAt);

  // FASE 3 rediseño Dictamen: F1 (identidad+toggle), F2/F3 (chips, score 48px,
  // gauge, badge, mapa) MURIERON — la portada nueva (PortadaInforme) los absorbe:
  // eyebrow, banda semántica (M2: único color de estado), barra fina de score,
  // link de ficha y mapa. El hero conserva F4 (veredicto narrado + prosa +
  // índice), la posición de Franco y el pie de firma. Sin data-verdict: el wash
  // por veredicto del hero-block contradecía M2.
  return (
    <div className="rounded-[16px] overflow-hidden mb-3 franco-hero-block">
      {/* ═══ F4 · VEREDICTO | FINDINGS (misma grilla 52/48; sin borde vertical — A1) ═══ */}
      <div className={`grid grid-cols-1 ${SHARED_GRID} gap-x-8 gap-y-8 px-6 md:px-8 py-[9px]`}>
        {/* Veredicto */}
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] mb-3 m-0">
            Veredicto
          </p>
          {/* Por qué no cierra — puerto literal del patrón STR: entre el veredicto y
              la pregunta, borde izquierdo neutro, sin wash de Signal Red (el rojo ya
              lo carga el badge; repetirlo convertiría una explicación en un golpe). */}
          {motivosLTR && (
            <p
              className="font-body text-[13.5px] md:text-[14px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mb-3.5 pl-3 max-w-[62ch]"
              style={{ borderLeft: "2px solid var(--franco-border-strong)", borderRadius: 0 }}
            >
              {motivosLTR.frase}
            </p>
          )}
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

