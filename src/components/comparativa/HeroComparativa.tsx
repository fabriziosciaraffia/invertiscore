"use client";

// ─── Hero comparativo · sistema de estados por banda (F-B2) ──────────────────
// Anatomía canon adaptada: donde LTR/STR ponen el Franco Score, acá va el VEREDICTO DE
// MODALIDAD (RENTA LARGA / RENTA CORTA / VENTAJA FRÁGIL / PAREJAS). Al costado el TOP-3
// diferencial (findings, orden dinámico). Posición de Franco motor-templated. Mini-scores
// de los hijos como evidencia secundaria. Banner de fragilidad integrado cuando aplica.
// Cero jerga sin glosa (nada de "p94"/"NOI"/"−152%"); delta con dirección en palabras.
// Solo tokens del design system — cero hardcode (prep light-mode).

import Link from "next/link";
import type { ReactNode } from "react";
import { BedDouble, Bath, Ruler, Clock, Building2, Scaling, Percent } from "lucide-react";
import type { RecomendacionModalidadAmbas } from "@/lib/types";
import type { FindingComparativa } from "@/lib/comparativa-findings";
import { fmtMoney, fmtUF } from "@/components/analysis/utils";

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
  // Datos de propiedad comunes a ambas modalidades (chips canon). El arriendo declarado
  // (LTR) y el modo de gestión (STR) NO van: son inputs de una modalidad, no de la propiedad.
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
  // UI
  currency: "CLP" | "UF";
  ufValue: number;
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

// Posición de Franco — motor-templated por estado (voz Franco, tuteo chileno). En Fase C la
// IA puede enriquecerla; hasta entonces es determinística y honesta.
const FRANCO_POS: Record<Estado, string> = {
  larga: "Renta larga es la jugada sólida acá. Airbnb te pide más plata de entrada, más horas cada semana y más estómago para la estacionalidad, para terminar con el mismo patrimonio y menos caja en el bolsillo. Si el tiempo no te sobra, ni lo mires: el número no paga el esfuerzo.",
  corta: "Renta corta paga el esfuerzo en este depto: rinde más que la larga y el margen aguanta un traspié. Si puedes poner las 8-12 horas a la semana, o aceptar la comisión de un administrador, es la mejor jugada. La ventaja es real, no de papel.",
  fragil: "El corto gana, pero por un pelo. La pregunta no es cuál rinde más — es si aguantas un mes flojo sin que la ventaja se dé vuelta. Si vas a operar Airbnb tú, con un colchón de reserva, tiene sentido probar. Si no, la larga te deja dormir tranquilo por casi la misma plata.",
  parejas: "Las dos rinden casi lo mismo, así que la plata no decide: decide tu tiempo. Si buscas algo pasivo, renta larga. Si te entusiasma operar y tienes las horas, el corto no te va a rendir menos. No hay respuesta equivocada acá, hay preferencia.",
};

function verdictTone(reco: RecomendacionModalidadAmbas, verdict: Verdict | null): boolean {
  // criticidad real: solo BUSCAR OTRA del lado ganador tiñe de rojo el mini-badge.
  return verdict === "BUSCAR OTRA";
}

export function HeroComparativa(p: Props) {
  const estado = resolverEstado(p.recomendacion, p.fragil);
  const critico = estado === "fragil";
  const top3 = p.findings.slice(0, 3);

  // Delta con dirección en palabras (mata el "−152%").
  const ganaLarga = p.deltaNOIMensual < 0;
  const deltaAbs = Math.abs(p.deltaNOIMensual);
  const ganador = ganaLarga ? "renta larga" : "renta corta";

  const precioM2UF = p.superficie > 0 ? p.precioUF / p.superficie : 0;

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8 mb-6"
      style={{
        background: critico ? "var(--franco-v-avoid-bg)" : "var(--franco-card)",
        borderColor: critico ? "color-mix(in srgb, var(--signal-red) 35%, transparent)" : "var(--franco-border)",
      }}
    >
      {/* Property header */}
      <div className="mb-5 pb-5" style={{ borderBottom: "1px dashed var(--franco-border)" }}>
        <p className="font-mono text-[10px] uppercase tracking-[3px] mb-2" style={{ color: "var(--franco-text-secondary)" }}>
          01 · VEREDICTO · COMPARATIVA AMBAS
        </p>
        <h1 className="font-heading text-[22px] sm:text-[26px] font-bold leading-tight" style={{ color: "var(--franco-text)" }}>
          {p.nombre || `Depto ${p.dormitorios}D${p.banos}B`} en {p.comuna}
        </h1>
        {p.direccion && (
          <p className="font-body text-[12px] mt-1" style={{ color: "var(--franco-text-secondary)" }}>{p.direccion}</p>
        )}
        {/* Chips canon (HeroLTR/HeroSTR): físicos / financieros comunes a ambas modalidades.
            Respetan el toggle CLP/UF. Sin chip de arriendo (LTR) ni de gestión (STR). */}
        <div className="mt-3 flex flex-col gap-1.5">
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

      {/* Verdict grid: veredicto + delta + fragilidad + minis  |  TOP-3 */}
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_.85fr] gap-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[3px] mb-2" style={{ color: "var(--franco-text-secondary)" }}>
            VEREDICTO DE MODALIDAD
          </p>
          <div
            className="font-mono font-bold leading-[1.02] text-[32px] sm:text-[38px]"
            style={{ color: critico ? "var(--signal-red)" : "var(--franco-text)", letterSpacing: "-0.01em" }}
          >
            {VERDICT_LABEL[estado]}
          </div>
          <p className="font-heading font-bold text-[17px] leading-snug mt-3" style={{ color: "var(--franco-text)" }}>
            {SUB[estado]}
          </p>

          {/* Delta badge — dirección en palabras */}
          <div
            className="inline-flex items-baseline gap-2 mt-4 px-3 py-2 rounded-lg border"
            style={{ borderColor: "var(--franco-border)", background: "var(--franco-bg)" }}
          >
            <span className="font-mono font-bold text-[16px]" style={{ color: "var(--franco-text)" }}>
              {fmtMoney(deltaAbs, p.currency, p.ufValue)}/mes
            </span>
            <span className="font-body text-[11px]" style={{ color: "var(--franco-text-secondary)" }}>
              gana {ganador} en lo que renta la operación
            </span>
          </div>

          {/* Banner de fragilidad integrado */}
          {p.fragil && (
            <div
              className="rounded-xl border p-3 mt-4 flex items-start gap-3"
              style={{ background: "var(--franco-v-avoid-bg)", borderColor: "color-mix(in srgb, var(--signal-red) 30%, transparent)" }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[2px] font-semibold shrink-0 mt-[2px]" style={{ color: "var(--signal-red)" }}>
                Margen<br />frágil
              </span>
              <p className="font-body text-[12px] leading-snug" style={{ color: "var(--franco-text-secondary)" }}>
                El corto empata costos recién cuando factura casi todo lo que rinde la zona. Una temporada floja o una
                caída de ocupación se come la ventaja — por eso la damos como decisión pareja, no como clara.
              </p>
            </div>
          )}

          {/* Mini-scores — evidencia secundaria */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <MiniScore href={`/analisis/${p.ltrId}`} label="RENTA LARGA" score={p.ltrScore} verdict={p.ltrVerdict} red={verdictTone(p.recomendacion, p.ltrVerdict)} />
            <MiniScore href={`/analisis/renta-corta/${p.strId}`} label="RENTA CORTA" score={p.strScore} verdict={p.strVerdict} red={verdictTone(p.recomendacion, p.strVerdict)} />
          </div>
        </div>

        {/* TOP-3 diferencial */}
        <div className="md:border-l md:pl-6" style={{ borderColor: "var(--franco-border)" }}>
          <p className="font-mono text-[9.5px] uppercase tracking-[2px] mb-3" style={{ color: "var(--franco-text-secondary)" }}>
            Lo que define este veredicto
          </p>
          <div className="flex flex-col">
            {top3.map((f, i) => (
              <Top3Row key={f.id} idx={i + 1} finding={f} />
            ))}
          </div>
        </div>
      </div>

      {/* Posición de Franco */}
      <div
        className="mt-6 pt-4 pl-4"
        style={{ borderLeft: `3px solid ${critico ? "var(--signal-red)" : "var(--franco-text)"}`, borderRadius: "0 12px 12px 0", background: "color-mix(in srgb, var(--franco-text) 3%, transparent)", paddingTop: 12, paddingBottom: 12, paddingRight: 14 }}
      >
        <p className="font-mono text-[9.5px] uppercase tracking-[2px] font-semibold mb-1.5" style={{ color: critico ? "var(--signal-red)" : "var(--franco-text-secondary)" }}>
          ★ La posición de Franco
        </p>
        <p className="font-body text-[13.5px] italic leading-relaxed" style={{ color: "var(--franco-text)" }}>
          {FRANCO_POS[estado]}
        </p>
      </div>
    </div>
  );
}

// CLP abreviado en millones ("$139,7 MM"), miles bajo $1 MM. Espejo de HeroLTR/HeroSTR.
function fmtMM(clp: number): string {
  if (Math.abs(clp) < 1_000_000) return "$" + Math.round(clp / 1000).toLocaleString("es-CL") + " mil";
  return "$" + (clp / 1_000_000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
}

// ── Chip fino con ícono — réplica del canon HeroLTR/HeroSTR (mismos tokens) ──
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
    <div className="flex gap-3 py-2.5" style={{ borderTop: idx === 1 ? "none" : "0.5px solid var(--franco-border)" }}>
      <span className="font-mono text-[10px] shrink-0 pt-0.5" style={{ color: "var(--franco-text-tertiary)", width: 14 }}>
        {String(idx).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[12.5px] leading-snug" style={{ color: "var(--franco-text)" }}>{f.titular}</p>
        <p className="font-mono text-[8.5px] uppercase tracking-[0.04em] mt-1" style={{ color: "var(--franco-text-tertiary)" }}>
          {f.kicker} · {ladoLabel}
        </p>
      </div>
      <span
        className="font-mono font-bold text-[13px] whitespace-nowrap pt-0.5"
        style={{ color: f.kpiRed ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {f.kpi}
      </span>
    </div>
  );
}

function MiniScore({ href, label, score, verdict, red }: { href: string; label: string; score: number; verdict: Verdict | null; red: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-3 flex items-center gap-3 transition-colors"
      style={{ borderColor: "var(--franco-border)", background: "var(--franco-bg)" }}
    >
      <span className="font-mono font-bold text-[26px] leading-none" style={{ color: "var(--franco-text)" }}>{score}</span>
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.05em]" style={{ color: "var(--franco-text-muted)" }}>{label}</p>
        <p className="font-mono text-[10.5px] font-medium mt-0.5" style={{ color: red ? "var(--signal-red)" : "var(--franco-text)" }}>
          {verdict ?? "—"}
        </p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] ml-auto" style={{ color: "var(--signal-red)" }}>Ver →</span>
    </Link>
  );
}
