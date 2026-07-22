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

import Link from "next/link";
import type { ReactNode } from "react";
import { BedDouble, Bath, Ruler, Clock, Building2, Scaling, Percent } from "lucide-react";
import type { RecomendacionModalidadAmbas, AIAnalysisComparativa } from "@/lib/types";
import type { FindingComparativa } from "@/lib/comparativa-findings";
import { fmtUF } from "@/components/analysis/utils";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { ProsaSkeleton, SkeletonLine } from "@/components/analysis/ProsaSkeleton";

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  recomendacion: RecomendacionModalidadAmbas;   // 3-estados
  fragil: boolean;
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
  // Delta de lo que renta la operación (NOI): STR − LTR
  deltaNOIMensual: number;
  // TOP-3 diferencial (los primeros del orden dinámico)
  findings: FindingComparativa[];
  // Mini-scores de los hijos (evidencia secundaria)
  ltrId: string;
  strId: string;
  ltrScore: number;
  ltrVerdict: Verdict | null;
  strScore: number;
  strVerdict: Verdict | null;
  // Prosa comparativa (Fase C) — integrada al hero (G1)
  ai: AIAnalysisComparativa | null;
  aiLoading: boolean;
  // Pie firma (G6)
  createdAt?: string;
  // UI · toggle integrado al header (G7). onCurrencyChange ausente ⇒ toggle oculto (print).
  currency: "CLP" | "UF";
  onCurrencyChange?: (c: "CLP" | "UF") => void;
  ufValue: number;
  // Fase D — cuando el par está bloqueado, las mini-cards de los hijos abren el
  // MODAL del resumen (onOpenChild) en vez de navegar al hijo (que redirigiría).
  childrenBlocked?: boolean;
  onOpenChild?: (role: "ltr" | "str") => void;
}

type Estado = "larga" | "corta" | "fragil" | "parejas";

function resolverEstado(reco: RecomendacionModalidadAmbas, fragil: boolean): Estado {
  if (fragil) return "fragil";
  if (reco === "LTR_PREFERIDO") return "larga";
  if (reco === "STR_VENTAJA_CLARA") return "corta";
  return "parejas";
}

const VERDICT_LABEL: Record<Estado, string> = {
  larga: "RENTA LARGA",
  corta: "RENTA CORTA",
  fragil: "VENTAJA FRÁGIL",
  parejas: "PAREJAS",
};

const SUB: Record<Estado, string> = {
  larga: "Renta larga es la jugada acá; el corto no paga su esfuerzo.",
  corta: "Renta corta paga el esfuerzo acá: rinde más y el margen aguanta.",
  fragil: "El corto rinde más en caja, pero con un margen que no aguanta un mal mes.",
  parejas: "Las dos rinden casi igual; lo que decide es cuánto tiempo quieres dedicarle.",
};

// Posición de Franco — motor-templated por estado (voz Franco, tuteo chileno). Va en la
// caja Signal Red (G2), seguida del cierre-condición de la prosa (mov. 3) cuando llega.
const FRANCO_POS: Record<Estado, string> = {
  larga: "Renta larga es la jugada sólida acá. Airbnb te pide más plata de entrada, más horas cada semana y más estómago para la estacionalidad, para terminar con el mismo patrimonio y menos caja en el bolsillo. Si el tiempo no te sobra, ni lo mires: el número no paga el esfuerzo.",
  corta: "Renta corta paga el esfuerzo en este depto: rinde más que la larga y el margen aguanta un traspié. Si puedes poner las 8-12 horas a la semana, o aceptar la comisión de un administrador, es la mejor jugada. La ventaja es real, no de papel.",
  fragil: "El corto gana, pero por un pelo. La pregunta no es cuál rinde más — es si aguantas un mes flojo sin que la ventaja se dé vuelta. Si vas a operar Airbnb tú, con un colchón de reserva, tiene sentido probar. Si no, la larga te deja dormir tranquilo por casi la misma plata.",
  parejas: "Las dos rinden casi lo mismo, así que la plata no decide: decide tu tiempo. Si buscas algo pasivo, renta larga. Si te entusiasma operar y tienes las horas, el corto no te va a rendir menos. No hay respuesta equivocada acá, hay preferencia.",
};

// Orden de los segmentos (G4): del lado claramente-larga al claramente-corta, con la
// ventaja frágil como el corto caveateado (entre parejas y corta).
const SEGMENT_ORDER: Estado[] = ["larga", "parejas", "fragil", "corta"];
const SEGMENT_SHORT: Record<Estado, string> = {
  larga: "Larga",
  parejas: "Parejas",
  fragil: "Frágil",
  corta: "Corta",
};

export function HeroComparativa(p: Props) {
  const estado = resolverEstado(p.recomendacion, p.fragil);
  const critico = estado === "fragil";
  const top3 = p.findings.slice(0, 3);

  const precioM2UF = p.superficie > 0 ? p.precioUF / p.superficie : 0;
  const cierreCondicion = p.ai?.conviene?.cierre?.trim() || "";
  const fechaFirma = formatFecha(p.createdAt);
  // A1 · título canon "Dirección corta · Comuna" (formatDireccionDisplay = calle+número
  // antes de la 1ª coma, sin código postal/región). Fallback al nombre / "Depto NDNB".
  const direccionCorta = formatDireccionDisplay(p.direccion);
  const tituloPrincipal = direccionCorta || p.nombre || `Depto ${p.dormitorios}D${p.banos}B`;

  return (
    <div className="rounded-[16px] overflow-hidden mb-6 franco-hero-block">
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
        {/* Veredicto de modalidad + segmentos + delta + chips */}
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--franco-text-tertiary)]">
            Veredicto de modalidad
          </span>
          <div
            className="font-mono font-bold leading-[0.98] text-[34px] sm:text-[40px] mt-2"
            style={{ color: critico ? "var(--signal-red)" : "var(--franco-text)", letterSpacing: "-0.01em" }}
          >
            {VERDICT_LABEL[estado]}
          </div>
          <p className="font-body text-[13px] leading-snug mt-2 m-0" style={{ color: "var(--franco-text-secondary)" }}>
            {SUB[estado]}
          </p>

          {/* Barra de estados categórica (A2): eje continuo con marcador en el activo */}
          <VeredictoSegments estado={estado} />

          {/* Banner de fragilidad (confirmado: como está) */}
          {p.fragil && (
            <div
              className="rounded-xl border p-3 mt-4 flex items-start gap-3"
              style={{ background: "var(--franco-v-avoid-bg)", borderColor: "color-mix(in srgb, var(--signal-red) 30%, transparent)" }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[2px] font-semibold shrink-0 mt-[2px]" style={{ color: "var(--signal-red)" }}>
                Margen<br />frágil
              </span>
              <p className="font-body text-[12px] leading-snug m-0" style={{ color: "var(--franco-text-secondary)" }}>
                El corto empata costos recién cuando factura casi todo lo que rinde la zona. Una temporada floja o una
                caída de ocupación se come la ventaja — por eso la damos como decisión pareja, no como clara.
              </p>
            </div>
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

        {/* Mini-scores de los hijos (evidencia secundaria) — stacked, donde el canon pone el mapa */}
        <div className="flex flex-col gap-3">
          <MiniScore
            href={`/analisis/${p.ltrId}`}
            label="RENTA LARGA"
            score={p.ltrScore}
            verdict={p.ltrVerdict}
            onOpen={p.childrenBlocked && p.onOpenChild ? () => p.onOpenChild!("ltr") : undefined}
          />
          <MiniScore
            href={`/analisis/renta-corta/${p.strId}`}
            label="RENTA CORTA"
            score={p.strScore}
            verdict={p.strVerdict}
            onOpen={p.childrenBlocked && p.onOpenChild ? () => p.onOpenChild!("str") : undefined}
          />
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
            <ProsaSkeleton />
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
            <p className="font-body text-[13px] italic m-0" style={{ color: "var(--franco-text-muted)" }}>
              Los datos y la tabla comparativa están disponibles arriba.
            </p>
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
              {FRANCO_POS[estado]}
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

// ── Barra de estados (A2) — adaptación categórica de la ScoreBar canon ───────
// Eje continuo (mismo shape que HeroLTR/HeroSTR ScoreBar) con marcador en el estado
// activo, en vez de una barra de score 0-100. Los 4 estados son 4 posiciones de MENOS
// a MÁS sobre-renta (larga → parejas → frágil → corta). Track monocromo (color = solo
// atención, §sistema); el marcador vira a Signal Red solo en VENTAJA FRÁGIL.
const SEGMENT_POS: Record<Estado, number> = { larga: 12.5, parejas: 37.5, fragil: 62.5, corta: 87.5 };
function VeredictoSegments({ estado }: { estado: Estado }) {
  const pos = SEGMENT_POS[estado];
  const red = estado === "fragil";
  return (
    <div className="mt-4">
      <div
        className="relative h-[7px] rounded-[4px]"
        style={{ background: "linear-gradient(90deg, var(--franco-border) 0%, var(--franco-text-tertiary) 100%)" }}
      >
        {/* Ticks de los 4 estados (recesivos) */}
        {SEGMENT_ORDER.map((s) => (
          <div
            key={s}
            className="absolute top-1/2 w-[2px] h-[2px] rounded-full"
            style={{ left: `${SEGMENT_POS[s]}%`, transform: "translate(-50%,-50%)", background: "var(--franco-bg)", opacity: s === estado ? 0 : 0.6 }}
            aria-hidden
          />
        ))}
        {/* Marcador en el estado activo */}
        <div
          className="absolute top-1/2 w-[14px] h-[14px] rounded-full"
          style={{
            left: `${pos}%`,
            transform: "translate(-50%,-50%)",
            background: red ? "var(--signal-red)" : "var(--franco-text)",
            border: "3px solid var(--franco-bg)",
            boxShadow: "0 0 0 1px var(--franco-border-strong)",
          }}
        />
      </div>
      <div className="flex mt-2.5">
        {SEGMENT_ORDER.map((s) => {
          const on = s === estado;
          return (
            <span
              key={s}
              className="flex-1 text-center font-mono text-[9.5px] uppercase tracking-[0.05em]"
              style={{
                color: on ? (s === "fragil" ? "var(--signal-red)" : "var(--franco-text)") : "var(--franco-text-muted)",
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
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
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

function MiniScore({ href, label, score, verdict, onOpen }: { href: string; label: string; score: number; verdict: Verdict | null; onOpen?: () => void }) {
  // Contenido común. Bloqueado (onOpen) → botón que abre el modal del resumen; si
  // no, Link al hijo íntegro. Mismo look; el CTA cambia "Ver →" por "Ver análisis →".
  const inner = (
    <>
      <span className="font-mono font-bold text-[32px] leading-none tracking-[-0.02em]" style={{ color: "var(--franco-text)" }}>{score}</span>
      <div className="min-w-0 flex flex-col gap-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.05em] m-0" style={{ color: "var(--franco-text-muted)" }}>{label}</p>
        <MiniVerdictBadge verdict={verdict} />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] ml-auto shrink-0" style={{ color: "var(--signal-red)" }}>
        {onOpen ? "Ver análisis →" : "Ver →"}
      </span>
    </>
  );
  const cls =
    "rounded-xl border p-3.5 flex items-center gap-3.5 transition-colors hover:border-[var(--franco-text-secondary)] text-left w-full";
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
