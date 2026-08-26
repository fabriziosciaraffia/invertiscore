"use client";

import { type ReactNode } from "react";
import type { AIAnalysisSTRv2, Hallazgo } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { ProgresoGeneracion, ETAPAS_GENERACION_STR, COPY_TIEMPO_STR } from "@/components/analysis/ProsaSkeleton";
import { IndiceRow } from "@/components/analysis/IndiceHallazgos";
import { ordenarHallazgosPiramideSTR } from "@/lib/piramide-orden-str";
import { numeroHallazgo } from "@/lib/orden-hallazgos";
import { describirMotivosSTR } from "@/lib/no-cierra-copy";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";

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
// CLP en millones abreviados ("$158,8 MM"); bajo $1 MM en miles.


export function HeroSTR({
  ai,
  results,
  veredicto,
  currency,
  valorUF,
  createdAt,
  fechaProsa,
  aiLoading,
  onOpenDrawer,
}: {
  ai: AIAnalysisSTRv2 | null;
  // `francoScore` viaja colgado del results persistido (mismo shape que usa el caller
  // y ai-generation-str). Se necesita para los motivos del gate — ver `motivos` abajo.
  results: ShortTermResult & { francoScore?: FrancoScoreSTR };
  veredicto: STRVerdict;
  score: number | null;
  inputData: Record<string, unknown> | null;
  comuna: string;
  ciudad?: string;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  valorUF: number;
  createdAt?: string;
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
  aiLoading?: boolean;
  /** Abre un drawer del informe. Ausente ⇒ la caja de posición no es clickeable. */
  onOpenDrawer?: (key: DrawerKeySTR) => void;
}) {
  const v = (normalizeLegacyVerdict(veredicto) as STRVerdict | null) ?? "BUSCAR OTRA";

  // FASE 3: F1/F3 murieron — identidad, chips, score, gauge y mapa viven en
  // la PORTADA (PortadaInforme + useComparablesCercanos). Acá queda solo F4.

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

  // Destino del drawer de la posición de Franco, por veredicto (espejo de HeroLTR):
  //  · no-COMPRAR con hallazgo de distancia → "Lo que te separa". El label distingue el
  //    caso estructural: prometer "vías" donde no las hay sería mentir en el botón.
  //  · COMPRAR → el margen (sensibilidad), porque ahí la pregunta que sigue no es qué
  //    falta sino cuánto aguanta antes de dejar de convenir.
  // Sin destino, la caja queda como estaba: texto sin callback (no un botón muerto).
  const hallazgosHero = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaHero = hallazgosHero.find((h) => h.id === "distancia_veredicto");
  const posicionDrawer: { key: DrawerKeySTR; label: string } | null = distanciaHero
    ? {
        key: "distanciaVeredicto",
        label:
          distanciaHero.id === "distancia_veredicto" && distanciaHero.valor.esEstructural
            ? "Por qué no cierra"
            : "Ver las vías",
      }
    : hallazgosHero.some((h) => h.id === "sensibilidad_str")
      ? { key: "sensibilidad", label: "Ver el margen" }
      : null;
  const posicionClickeable = posicionDrawer != null && onOpenDrawer != null;

  // POR QUÉ NO CIERRA — los motivos que decidieron el veredicto, cuando lo decidió un
  // gate y no la banda del score. Sin esto, en 12 de 96 análisis el lector ve un score
  // que no explica su veredicto (el peor: 59 con BUSCAR OTRA) y no tiene dónde
  // entenderlo. Cuando el veredicto viene de la banda, `motivos` es null y NO se
  // muestra nada: inventar una causa sería peor que no darla.
  const motivos = describirMotivosSTR(results.francoScore?.gates?.motivos ?? []);

  // ── ÍNDICE del informe: primeros 3 del ORDEN ÚNICO (el MISMO array que renderiza
  // la pirámide STR — fuente única: ordenarHallazgosPiramideSTR). El hero numera
  // 01-03 y cada fila ancla a su card; la pirámide continúa hasta 12. ──
  const ordenados = ordenarHallazgosPiramideSTR(results.hallazgos);
  const top3 = ordenados.slice(0, 3);
  const restantes = Math.max(0, ordenados.length - top3.length);
  const fechaFirma = formatFecha(fechaProsa ?? createdAt);

  return (
    <div className="rounded-[16px] overflow-hidden mb-3 franco-hero-block">
      {/* F4 · VEREDICTO | FINDINGS (52/48) */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] gap-x-8 gap-y-8 px-6 md:px-8 py-[9px]">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] mb-3 m-0">
            Veredicto
          </p>
          {/* Por qué no cierra — entre el veredicto y la pregunta, que es donde el
              lector se pregunta "¿y por qué?". Borde izquierdo en Ink y sin esquinas
              redondeadas: es una nota al margen del veredicto, no una alerta. Sin wash
              de Signal Red a propósito — el rojo ya lo carga el badge, y repetirlo acá
              convertiría una explicación en un segundo golpe. */}
          {motivos && (
            <p
              className="font-body text-[13.5px] md:text-[14px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mb-3.5 pl-3 max-w-[62ch]"
              style={{ borderLeft: "2px solid var(--franco-border-strong)", borderRadius: 0 }}
            >
              {motivos.frase}
            </p>
          )}
          <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0">
            {pregunta}
          </h2>
          <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
            {/* Goal F: la espera hereda ProgresoGeneracion (E.2) con etapas y
                copy STR propios — skeleton didáctico en vez del mensaje fijo. */}
            {respuesta ? renderProsaMono(respuesta) : aiLoading ? <ProgresoGeneracion etapas={ETAPAS_GENERACION_STR} copyTiempo={COPY_TIEMPO_STR} /> : null}
            {reencuadre && <div className="mt-3">{renderProsaMono(reencuadre)}</div>}
          </div>
        </div>

        {/* ÍNDICE — primeros 3 del orden único, numerados y clickeables (ancla a su card) */}
        <div>
          {top3.length > 0 && (
            <>
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text)] mb-2.5">
                Léelo en este orden ↓
              </div>
              {top3.map((h, i) => (
                <IndiceRow key={h.id} rank={numeroHallazgo(i)} h={h} currency={currency} valorUF={valorUF} />
              ))}
              {restantes > 0 && (
                <div className="font-body text-[11.5px] text-[var(--franco-text-muted)] mt-2">
                  …y {restantes} hallazgos más, abajo, en el mismo orden.
                </div>
              )}
              <div className="mt-3 pt-2.5 border-t border-[var(--franco-border)]">
                <span className="block font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--franco-text-tertiary)]">
                  Cómo pesa cada hallazgo ↓
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ POSICIÓN DE FRANCO — full-width, ambas columnas (A5) · isNeutro preservado ═══ */}
      {cajaAccionable && (
        <div className="px-6 md:px-8 pb-4">
          <div
            style={{
              borderLeft: `3px solid ${isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)"}`,
              borderRadius: "0 8px 8px 0",
              background: isNeutro ? "var(--franco-bg-alt)" : "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            }}
          >
            <div className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold"
                  style={{ color: isNeutro ? "var(--franco-text-tertiary)" : "var(--signal-red)" }}
                >
                  {cajaLabel}
                </span>
                {/* El destino ya no es un rótulo muerto: la posición de Franco abre el
                    drawer que la sostiene. Botón real (no un div con onClick) para que
                    teclado y lectores de pantalla lo alcancen. */}
                {posicionClickeable && (
                  <button
                    type="button"
                    onClick={() => onOpenDrawer!(posicionDrawer!.key)}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] font-semibold underline underline-offset-2 decoration-dotted hover:opacity-70 transition-opacity"
                    style={{ color: isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)" }}
                  >
                    {posicionDrawer!.label} →
                  </button>
                )}
              </div>
              <p
                className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text)] m-0"
                style={{ fontStyle: isNeutro ? "normal" : "italic" }}
              >
                {cajaAccionable}
              </p>
            </div>
          </div>
        </div>
      )}

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

// Fecha firma "3 jul 2026" (es-CL).
function formatFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}
