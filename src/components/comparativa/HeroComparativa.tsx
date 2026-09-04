"use client";

// ─── Hero comparativo · patrón canon (F-C3b) ─────────────────────────────────
// Port del canon HeroLTR/HeroSTR al módulo comparativo, con la prosa comparativa
// (Fase C) INTEGRADA como cuerpo del hero — muere el bloque "ANÁLISIS GENERADO POR
// FRANCO IA" del acto 3. Superficie continua dividida por hairlines:
//   F1 identidad + toggle (G7) · F3 veredicto+segmentos(G4)+chips | mini-scores ·
//   F4 prosa(G1)+posición Signal Red(G2) | TOP-3 + puente al acto 2 (G8) · pie firma (G6).
// Intencionales confirmados (⛔#C3a): sin mapa · mini-scores en vez de score único ·
// banner frágil como está. El veredicto de modalidad es categórico (4 estados) → los
// segmentos marcan el activo (G4), no una barra continua de score.

import { fechaCortaCL } from "@/lib/fecha-cl";
import Link from "next/link";
import type { ReactNode } from "react";
import { BedDouble, Bath, Ruler, Clock, Building2, Scaling, Percent } from "lucide-react";
import type { AIAnalysisComparativa } from "@/lib/types";
import type { FindingComparativa } from "@/lib/comparativa-findings";
import { fmtUF } from "@/components/analysis/utils";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { ProgresoGeneracion, ETAPAS_GENERACION_AMBAS, COPY_TIEMPO_AMBAS, SkeletonLine } from "@/components/analysis/ProsaSkeleton";
import {
  type GanadorMetodo,
  type HeroAmbas,
  FRAGIL_CHIP,
  SEGMENT_ORDER,
  SEGMENT_SHORT,
  SEGMENT_POS,
} from "@/lib/comparativa-hero-copy";

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  // Hero 3 ejes (contrato mockup-hero-ambas-3ejes): estado/badge/copy vienen
  // del builder puro — este componente solo renderiza, cero lógica de estado.
  hero: HeroAmbas;
  // Property header
  nombre: string;
  comuna: string;
  direccion?: string;
  superficie: number;
  precioUF: number;
  dormitorios: number;
  banos: number;
  antiguedad?: number;
  piePct?: number;
  plazoAnios?: number;
  tasaPct?: number;
  // TOP-3 diferencial (los primeros del orden dinámico)
  findings: FindingComparativa[];
  // Mini-scores de los hijos (evidencia secundaria)
  ltrId: string;
  strId: string;
  ltrScore: number;
  ltrVerdict: Verdict | null;
  strScore: number;
  strVerdict: Verdict | null;
  // Línea "Lo que te separa" bajo cada mini-score (distancia-copy · contrato).
  ltrDistancia: string | null;
  strDistancia: string | null;
  // Prosa comparativa (Fase C) — integrada al hero (G1)
  ai: AIAnalysisComparativa | null;
  aiLoading: boolean;
  /**
   * Apertura escrita por el MOTOR (buildAperturaComparativa). Es la respuesta
   * literal a "Cuál te conviene" y no depende de la IA: cuando no hay prosa
   * (par sin generar, o versión vieja ocultada por el version-check) el bloque
   * se monta igual con esto en vez del placeholder que prometía y no entregaba.
   * Mismo patrón que el documento comparativo, que ya la afirma sin IA.
   */
  aperturaMotor: string;
  // Pie firma (G6)
  createdAt?: string;
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
  // UI · toggle integrado al header (G7). onCurrencyChange ausente ⇒ toggle oculto (print).
  currency: "CLP" | "UF";
  onCurrencyChange?: (c: "CLP" | "UF") => void;
  ufValue: number;
  // Fase D — cuando el par está bloqueado, las mini-cards de los hijos abren el
  // MODAL del resumen (onOpenChild) en vez de navegar al hijo (que redirigiría).
  childrenBlocked?: boolean;
  onOpenChild?: (role: "ltr" | "str") => void;
}

export function HeroComparativa(p: Props) {
  const hero = p.hero;
  const critico = hero.badgeCritico;
  const top3 = p.findings.slice(0, 3);
  // Mini-scores: el ganador primero (contrato E3; con parejas/E2 manda el LTR).
  const minisOrden: Array<"ltr" | "str"> = hero.ganador === "corta" ? ["str", "ltr"] : ["ltr", "str"];

  const precioM2UF = p.superficie > 0 ? p.precioUF / p.superficie : 0;
  const cierreCondicion = p.ai?.conviene?.cierre?.trim() || "";
  const fechaFirma = formatFecha(p.fechaProsa ?? p.createdAt);
  // A1 · título canon "Dirección corta · Comuna" (formatDireccionDisplay = calle+número
  // antes de la 1ª coma, sin código postal/región). Fallback al nombre / "Depto NDNB".
  const direccionCorta = formatDireccionDisplay(p.direccion);
  const tituloPrincipal = direccionCorta || p.nombre || `Depto ${p.dormitorios}D${p.banos}B`;

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-6 franco-hero-block"
      // E2 · tratamiento de veredicto crítico (wash BUSCAR OTRA, canon Capa 1).
      style={
        critico
          ? {
              background: "linear-gradient(var(--franco-v-avoid-bg), var(--franco-v-avoid-bg)), var(--franco-card)",
              borderColor: "color-mix(in srgb, var(--signal-red) 35%, transparent)",
            }
          : undefined
      }
    >
      {/* ═══ F1 · IDENTIDAD + toggle (G7) ═══ */}
      <div className="flex items-start justify-between gap-6 px-6 md:px-8 pt-4 pb-3.5">
        <div className="min-w-0">
          <h1 className="franco-hero-title font-heading font-bold text-[23px] md:text-[27px] leading-[1.15] tracking-[-0.01em] text-[var(--franco-text)] m-0">
            {tituloPrincipal}
            {p.comuna && <span className="font-normal text-[var(--franco-text-secondary)]"> · {p.comuna}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)] whitespace-nowrap">
            Comparativa · Ambas
          </span>
          {p.onCurrencyChange && <CurrencyToggle currency={p.currency} onCurrencyChange={p.onCurrencyChange} />}
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ F3 · VEREDICTO + SEGMENTOS (G4) + CHIPS | MINI-SCORES (sin mapa) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,66fr)_minmax(0,34fr)] gap-x-8 gap-y-6 px-6 md:px-8 py-3">
        {/* Veredicto (3 ejes) + margen + barra de método + chips */}
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
            {critico ? "Veredicto" : "Veredicto de modalidad"}
          </span>
          <div
            className="font-mono font-bold leading-[0.98] text-[34px] sm:text-[40px] mt-2"
            style={{ color: critico ? "var(--signal-red)" : "var(--franco-text)", letterSpacing: "-0.01em" }}
          >
            {hero.badge}
          </div>
          <p className="font-body text-[13px] leading-snug mt-2 m-0 max-w-[56ch]" style={{ color: "var(--franco-text-secondary)" }}>
            {hero.sub}
          </p>

          {/* Eje 1 · margen del ganador, visible y con escala */}
          {hero.margen && <MargenBar margen={hero.margen} />}

          {/* Barra de método (3 posiciones). En E2 se RETIRA (contrato). */}
          {hero.mostrarBarra && <VeredictoSegments ganador={hero.ganador} />}

          {/* E2 · el método subordinado a una línea, sin celebración */}
          {hero.subordinada && (
            <div
              className="mt-4 px-3.5 py-2.5"
              style={{
                borderLeft: "3px solid var(--franco-text-secondary)",
                borderRadius: "0 8px 8px 0",
                background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              }}
            >
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] block mb-0.5" style={{ color: "var(--franco-text-tertiary)" }}>
                {hero.subordinada.kicker}
              </span>
              <p className="font-body text-[12.5px] leading-snug m-0" style={{ color: "var(--franco-text)" }}>
                {hero.subordinada.texto}
              </p>
            </div>
          )}

          {/* Eje 2 · robustez como chip calificador (nunca en E2) */}
          {hero.fragilChip && (
            <span
              className="inline-flex items-center gap-2 mt-3 rounded-full px-3 py-1"
              style={{ background: "var(--franco-v-avoid-bg)", border: "0.5px solid color-mix(in srgb, var(--signal-red) 35%, transparent)" }}
            >
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--signal-red)" }}>
                {FRAGIL_CHIP.kicker}
              </span>
              <span className="font-body text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>
                {FRAGIL_CHIP.texto}
              </span>
            </span>
          )}

          {/* Chips físicos / financieros (canon F3), 2 filas envueltas */}
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<BedDouble />} k={p.dormitorios != null ? String(p.dormitorios) : "—"} unit="dorm" />
              <Chip icon={<Bath />} k={p.banos != null ? String(p.banos) : "—"} unit="baño" />
              <Chip icon={<Ruler />} k={p.superficie > 0 ? String(p.superficie) : "—"} unit="m²" />
              {p.antiguedad != null && <Chip icon={<Clock />} k={String(p.antiguedad)} unit="años" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={<Building2 />} k={p.currency === "UF" ? fmtUF(p.precioUF) : fmtMM(p.precioUF * p.ufValue)} />
              <Chip icon={<Scaling />} k={`UF ${(Math.round(precioM2UF * 10) / 10).toLocaleString("es-CL")}`} unit="/m²" />
              {p.piePct != null && (
                <Chip
                  icon={<Percent />}
                  k={`${Math.round(p.piePct)}%`}
                  unit="pie"
                  sub={p.plazoAnios != null && p.tasaPct != null ? `· ${p.plazoAnios} años · ${p.tasaPct.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%` : undefined}
                />
              )}
            </div>
          </div>
        </div>

        {/* Mini-scores de los hijos — el ganador primero; cada uno con su línea
            de distancia al veredicto ("Lo que te separa", contrato 3 ejes). */}
        <div className="flex flex-col gap-3">
          {minisOrden.map((role) =>
            role === "ltr" ? (
              <MiniScore
                key="ltr"
                href={`/analisis/${p.ltrId}`}
                label="RENTA LARGA"
                score={p.ltrScore}
                verdict={p.ltrVerdict}
                distancia={p.ltrDistancia}
                onOpen={p.childrenBlocked && p.onOpenChild ? () => p.onOpenChild!("ltr") : undefined}
              />
            ) : (
              <MiniScore
                key="str"
                href={`/analisis/renta-corta/${p.strId}`}
                label="RENTA CORTA"
                score={p.strScore}
                verdict={p.strVerdict}
                distancia={p.strDistancia}
                onOpen={p.childrenBlocked && p.onOpenChild ? () => p.onOpenChild!("str") : undefined}
              />
            ),
          )}
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ F4 · PROSA (G1) + POSICIÓN Signal Red (G2) | TOP-3 + puente (G8) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] gap-x-8 gap-y-8 px-6 md:px-8 py-[9px]">
        {/* Cuerpo: apertura + movimientos 1-2 + caja posición */}
        <div className="min-w-0">
          <p className="font-heading font-bold text-[15px] text-[var(--franco-text)] mb-3 m-0">
            Cuál te conviene
          </p>

          {p.aiLoading && !p.ai ? (
            /* Goal F3-c: la espera hereda ProgresoGeneracion (E.2) con etapas y
               copy AMBAS propios. El segundo slot (cierre-condición, dentro de
               "La posición de Franco") conserva su SkeletonLine: un solo
               indicador de trabajo por hero — nada de avisos duplicados. */
            <ProgresoGeneracion etapas={ETAPAS_GENERACION_AMBAS} copyTiempo={COPY_TIEMPO_AMBAS} />
          ) : p.ai ? (
            <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
              {/* Apertura (motor) como lead — mismo formato de prosa que los
                  movimientos de abajo (sin destacado bold/italic/serif). */}
              {(p.ai.apertura ?? p.ai.headline) && (
                <div className="mb-4">
                  {renderProsaMono(p.ai.apertura ?? p.ai.headline ?? "")}
                </div>
              )}
              {p.ai.conviene?.quienDeberiasSer && (
                <Movimiento label="Quién tienes que ser" body={p.ai.conviene.quienDeberiasSer} />
              )}
              {p.ai.conviene?.switchPath && (
                <Movimiento label="¿Y si migro después?" body={p.ai.conviene.switchPath} />
              )}
            </div>
          ) : (
            // Sin prosa IA: el bloque NO se vacía ni promete de más — lo carga la
            // apertura del motor, que responde exactamente la pregunta del título.
            <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[65ch]">
              {renderProsaMono(p.aperturaMotor)}
            </div>
          )}
        </div>

        {/* TOP-3 diferencial + puente al acto 2 (G8) */}
        <div className="min-w-0">
          <div className="font-heading font-bold text-[15px] text-[var(--franco-text)] mb-0.5">
            Lo que define este veredicto
          </div>
          <div className="font-body text-[11.5px] text-[var(--franco-text-muted)] mb-4">
            {top3.length > 0
              ? `Las ${top3.length} diferencias que más pesan en la decisión.`
              : "Diferencias que definen el veredicto."}
          </div>

          {top3.map((f, i) => (
            <Top3Row key={f.id} idx={i + 1} finding={f} />
          ))}

          {top3.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[var(--franco-border)]">
              <a
                href="#piramide-comparativa"
                className="block font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text)] transition-colors"
              >
                Cómo pesa cada diferencia ↓
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ═══ POSICIÓN DE FRANCO — full-width, ambas columnas (A5) · borde Signal Red (G2) ═══ */}
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
              {hero.posicion}
            </p>
            {/* Cierre-condición (mov. 3 de la prosa) — junto a la posición */}
            {p.aiLoading && !p.ai ? (
              <div className="mt-2.5"><SkeletonLine width="60%" /></div>
            ) : cierreCondicion ? (
              <div className="font-body text-[13px] leading-[1.55] text-[var(--franco-text-secondary)] mt-2.5 pt-2.5" style={{ borderTop: "0.5px solid color-mix(in srgb, var(--signal-red) 20%, transparent)" }}>
                {renderProsaMono(cierreCondicion)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* ═══ PIE · FIRMA (G6) ═══ */}
      <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-2">
        <span className="font-body text-[11px] text-[var(--franco-text-muted)]">
          Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}
        </span>
        <Wordmark />
      </div>
    </div>
  );
}

// ── Barra de método (eje 1, 3 posiciones) — contrato 3 ejes ──────────────────
// La fragilidad dejó de ser banda (es chip calificador): el eje queda de MENOS
// a MÁS sobre-renta (larga → parejas → corta). SEGMENT_POS viene de la lib
// (fuente única; acá vivía una copia local de 4 posiciones — murió con el
// contrato). Track monocromo, marcador siempre Ink (color = solo atención).
function VeredictoSegments({ ganador }: { ganador: GanadorMetodo }) {
  const pos = SEGMENT_POS[ganador];
  return (
    <div className="mt-4">
      <div
        className="relative h-[7px] rounded-[4px]"
        style={{ background: "linear-gradient(90deg, var(--franco-border) 0%, var(--franco-text-tertiary) 100%)" }}
      >
        {/* Ticks de las 3 posiciones (recesivos) */}
        {SEGMENT_ORDER.map((s) => (
          <div
            key={s}
            className="absolute top-1/2 w-[2px] h-[2px] rounded-full"
            style={{ left: `${SEGMENT_POS[s]}%`, transform: "translate(-50%,-50%)", background: "var(--franco-bg)", opacity: s === ganador ? 0 : 0.6 }}
            aria-hidden
          />
        ))}
        {/* Marcador en la posición activa */}
        <div
          className="absolute top-1/2 w-[14px] h-[14px] rounded-full"
          style={{
            left: `${pos}%`,
            transform: "translate(-50%,-50%)",
            background: "var(--franco-text)",
            border: "3px solid var(--franco-bg)",
            boxShadow: "0 0 0 1px var(--franco-border-strong)",
          }}
        />
      </div>
      <div className="flex mt-2.5">
        {SEGMENT_ORDER.map((s) => {
          const on = s === ganador;
          return (
            <span
              key={s}
              className="flex-1 text-center font-mono text-[9.5px] uppercase tracking-[0.05em]"
              style={{
                color: on ? "var(--franco-text)" : "var(--franco-text-muted)",
                fontWeight: on ? 700 : 500,
              }}
            >
              {SEGMENT_SHORT[s]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Eje 1 · margen del ganador (barra con escala, contrato) ──────────────────
function MargenBar({ margen }: { margen: NonNullable<HeroAmbas["margen"]> }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: "var(--franco-text-tertiary)" }}>
          Margen del ganador
        </span>
        <span className="font-mono text-[12px] font-bold" style={{ color: "var(--franco-text)" }}>
          {margen.texto}
        </span>
      </div>
      <div className="relative h-[6px] rounded-[3px] overflow-hidden" style={{ background: "var(--franco-sunken, rgba(255,255,255,0.05))" }}>
        <div className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${margen.fillPct}%`, background: "var(--franco-text-secondary)" }} />
      </div>
      {/* El rótulo cualitativo se calla cuando otro eje ya calificó la ventaja
          (chip de fragilidad o ventaja inoperable): una sola voz por caso. La
          cifra de arriba se mantiene siempre. */}
      {margen.mostrarRotulo && (
        <div className="flex justify-between mt-1 font-mono text-[8.5px] uppercase tracking-[0.06em]" style={{ color: "var(--franco-text-muted)" }}>
          <span style={margen.escala === "estrecho" ? { color: "var(--franco-text)", fontWeight: 700 } : undefined}>Estrecho &lt;10%</span>
          <span style={margen.escala === "claro" ? { color: "var(--franco-text)", fontWeight: 700 } : undefined}>Claro</span>
          <span style={margen.escala === "amplio" ? { color: "var(--franco-text)", fontWeight: 700 } : undefined}>Amplio &gt;30%</span>
        </div>
      )}
    </div>
  );
}

// ── Movimiento de prosa con kicker mono ──────────────────────────────────────
function Movimiento({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-4 first:mt-0">
      <span className="font-heading font-bold text-[15px] text-[var(--franco-text)] block mb-1">
        {label}
      </span>
      <div>{renderProsaMono(body)}</div>
    </div>
  );
}

// CLP abreviado en millones ("$139,7 MM"), miles bajo $1 MM. Espejo de HeroLTR/HeroSTR.
function fmtMM(clp: number): string {
  if (Math.abs(clp) < 1_000_000) return "$" + Math.round(clp / 1000).toLocaleString("es-CL") + " mil";
  return "$" + (clp / 1_000_000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
}

// ── Fecha firma "3 jul 2026" (es-CL) ──
function formatFecha(iso?: string): string {
  return fechaCortaCL(iso);
}

// ── Wordmark refranco.ai (mismo tratamiento que HeroLTR/HeroSTR) ──
function Wordmark() {
  return (
    <span className="inline-flex items-baseline leading-none">
      <span className="font-heading italic font-light text-[17px]" style={{ color: "var(--franco-wm-re)", marginRight: "-0.08em" }}>re</span>
      <span className="font-heading font-bold text-[17px]" style={{ color: "var(--franco-wm-franco)" }}>franco</span>
      <span className="font-body font-semibold tracking-wide text-[#C8323C]" style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}>.ai</span>
    </span>
  );
}

// ── Toggle CLP/UF (canon, G7) ──
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

// ── Prosa con cifras ($/UF/%) en JetBrains Mono inline — cajitas (G1, canon) ──
function renderProsaMono(texto: string): ReactNode {
  if (!texto) return null;
  const RE = /((?:−|-)?\$\s?[\d.]+(?:,\d+)?|UF\s?[\d.]+(?:,\d+)?|(?:\+|−|-)?\d+(?:[.,]\d+)?\s?%)/g;
  return texto.split(/\n\n+/).map((par, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {par.split(RE).map((part, j) =>
        j % 2 === 1 ? (
          <span key={j} className="font-mono text-[13px] text-[var(--franco-text)] px-1 rounded" style={{ background: "color-mix(in srgb, var(--franco-text) 5%, transparent)" }}>{part}</span>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </p>
  ));
}

// ── Chip fino con ícono — réplica del canon HeroLTR/HeroSTR ──
function Chip({ icon, k, unit, sub }: { icon: ReactNode; k: string; unit?: string; sub?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap flex-none"
      style={{ border: "0.5px solid var(--franco-border)", background: "var(--franco-bg-alt)" }}
    >
      <span className="w-3 h-3 shrink-0 text-[var(--franco-text-tertiary)] [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
      <span className="font-mono text-[12px] font-medium text-[var(--franco-text)]">{k}</span>
      {unit && <span className="font-mono text-[10px] text-[var(--franco-text-muted)] tracking-[0.02em]">{unit}</span>}
      {sub && <span className="font-mono text-[9.5px] text-[var(--franco-text-muted)]">{sub}</span>}
    </span>
  );
}

function Top3Row({ idx, finding: f }: { idx: number; finding: FindingComparativa }) {
  const ladoLabel = f.lado === "ltr" ? "a favor renta larga" : f.lado === "str" ? "a favor renta corta" : "educativo";
  return (
    <div className="grid grid-cols-[20px_1fr_auto] gap-3 py-3 items-start border-t border-[var(--franco-border)] first:border-t-0">
      <div className="font-mono text-[12px] font-bold text-[var(--franco-text-tertiary)] pt-0.5">
        {String(idx).padStart(2, "0")}
      </div>
      <div className="min-w-0">
        <div className="font-body text-[12.5px] leading-[1.4]" style={{ color: "var(--franco-text)" }}>{f.titular}</div>
        {/* Término + tooltip (paridad canon): la procedencia glosa el KPI on-hover */}
        <FindingTooltip term={`${f.kicker} · ${ladoLabel}`} tip={f.procedencia} />
      </div>
      <div className="text-right whitespace-nowrap">
        <div className="font-mono text-[15px] font-bold leading-none" style={{ color: f.kpiRed ? "var(--signal-red)" : "var(--franco-text)" }}>
          {f.kpi}
        </div>
      </div>
    </div>
  );
}

// Término técnico con tooltip on-hover — espejo del Tooltip de HeroLTR/HeroSTR.
function FindingTooltip({ term, tip }: { term: string; tip: string }) {
  return (
    <span className="relative group inline-flex items-center gap-1 mt-1">
      <span className={`font-mono text-[8.5px] uppercase tracking-[0.04em] text-[var(--franco-text-tertiary)] ${tip ? "border-b border-dotted border-[var(--franco-border-strong)] cursor-help" : ""}`}>
        {term}
      </span>
      {tip && (
        <>
          <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-[var(--franco-border-strong)] text-[8px] font-mono text-[var(--franco-text-muted)]">i</span>
          <span
            className="pointer-events-none absolute bottom-[135%] left-0 z-10 w-[236px] rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: "var(--franco-card)", border: "0.5px solid var(--franco-border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            <span className="font-body text-[11px] leading-[1.45] text-[var(--franco-text-secondary)]">{tip}</span>
          </span>
        </>
      )}
    </span>
  );
}

// Badge de veredicto de la mini-card — espejo del VerdictBadge canon (HeroLTR/STR),
// tamaño reducido. COMPRAR = Ink/blanco · AJUSTA = outline rojo · BUSCAR OTRA = rojo/blanco.
function MiniVerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="font-mono text-[10px]" style={{ color: "var(--franco-text-muted)" }}>—</span>;
  const isCompra = verdict === "COMPRAR";
  const isAjusta = verdict === "AJUSTA SUPUESTOS";
  const bg = isCompra ? "var(--franco-text)" : isAjusta ? "transparent" : "var(--signal-red)";
  const color = isCompra ? "var(--franco-bg)" : isAjusta ? "var(--signal-red)" : "#fff";
  const border = isAjusta ? "0.5px solid color-mix(in srgb, var(--signal-red) 40%, transparent)" : undefined;
  return (
    <span className="inline-block font-mono text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded" style={{ background: bg, color, border }}>
      {verdict}
    </span>
  );
}

function MiniScore({ href, label, score, verdict, distancia, onOpen }: { href: string; label: string; score: number; verdict: Verdict | null; distancia?: string | null; onOpen?: () => void }) {
  // Contenido común. Bloqueado (onOpen) → botón que abre el modal del resumen; si
  // no, Link al hijo íntegro. Mismo look; el CTA cambia "Ver →" por "Ver análisis →".
  // La línea de distancia ("Lo que te separa") va bajo la fila principal, en los
  // 3 estados del hero — contrato mockup-hero-ambas-3ejes.
  const inner = (
    <>
      <div className="flex items-center gap-3.5 w-full">
        <span className="font-mono font-bold text-[32px] leading-none tracking-[-0.02em]" style={{ color: "var(--franco-text)" }}>{score}</span>
        <div className="min-w-0 flex flex-col gap-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.05em] m-0" style={{ color: "var(--franco-text-muted)" }}>{label}</p>
          <MiniVerdictBadge verdict={verdict} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] ml-auto shrink-0" style={{ color: "var(--signal-red)" }}>
          {onOpen ? "Ver análisis →" : "Ver →"}
        </span>
      </div>
      {distancia && (
        <div className="w-full mt-2.5 pt-2.5" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
          <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] block mb-0.5" style={{ color: "var(--franco-text-tertiary)" }}>
            Lo que te separa
          </span>
          <p className="font-body text-[11.5px] leading-[1.45] m-0" style={{ color: "var(--franco-text-secondary)" }}>{distancia}</p>
        </div>
      )}
    </>
  );
  const cls =
    "rounded-xl border p-3.5 flex flex-col transition-colors hover:border-[var(--franco-text-secondary)] text-left w-full";
  const style = { borderColor: "var(--franco-border)", background: "var(--franco-sunken, #101114)" };

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={cls} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  );
}
