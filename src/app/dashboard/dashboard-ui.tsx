/**
 * Átomos visuales del Dashboard v2. Sin hooks ni estado: los usa igual el Server
 * Component y el island de cliente.
 *
 * Paridad de temas (design-system §5.0): nada de hex hardcodeado. Todo sale de
 * los tokens `--franco-*`, así el dashboard vive en light (default del producto)
 * y en dark con el mismo gesto. El mockup contrato es dark porque documenta la
 * app, no porque el dashboard sea dark-only.
 */

import type { Veredicto } from "@/lib/types";

// ─── Badge de veredicto ─────────────────────────────────────────────────────
// Capa 1 binaria: la jerarquía es Ink primario / Ink secundario / Signal Red.
// BUSCAR OTRA es el único con rojo (criticidad, uso permitido #3).
const VERDICT_STYLE: Record<Veredicto, { color: string; bg: string; border: string }> = {
  COMPRAR: {
    color: "var(--franco-text)",
    bg: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
    border: "color-mix(in srgb, var(--franco-text) 18%, transparent)",
  },
  "AJUSTA SUPUESTOS": {
    color: "var(--franco-text-secondary)",
    bg: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
    border: "color-mix(in srgb, var(--franco-text) 12%, transparent)",
  },
  "BUSCAR OTRA": {
    color: "var(--signal-red)",
    bg: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
    border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
  },
};

export function VerdictBadge({ verdict, mini = false }: { verdict: Veredicto; mini?: boolean }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex shrink-0 font-mono font-bold tracking-wide ${mini ? "text-[8px]" : "text-[9px]"}`}
      style={{
        padding: mini ? "2px 6px" : "3px 9px",
        borderRadius: 5,
        background: s.bg,
        border: `${mini ? 1 : 1.5}px solid ${s.border}`,
        color: s.color,
      }}
    >
      {verdict}
    </span>
  );
}

// ─── Chip de modalidad ──────────────────────────────────────────────────────
export function ModChip({ label }: { label: "LARGA" | "CORTA" | "AMBAS" }) {
  const style: React.CSSProperties =
    label === "AMBAS"
      ? {
          borderColor: "var(--franco-border-strong)",
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          color: "var(--franco-text)",
        }
      : label === "CORTA"
        ? {
            borderColor: "color-mix(in srgb, var(--signal-red) 35%, transparent)",
            color: "var(--franco-text-secondary)",
          }
        : { borderColor: "var(--franco-border-strong)", color: "var(--franco-text-secondary)" };

  return (
    <span
      className="inline-flex shrink-0 whitespace-nowrap rounded font-mono text-[8px] font-bold tracking-[0.08em]"
      style={{ padding: "2px 6px", border: "1px solid", ...style }}
    >
      {label}
    </span>
  );
}

// ─── Anillo de score ────────────────────────────────────────────────────────
// Mismo criterio cromático que el dashboard viejo: ≥75 Ink primario · 40-74 Ink
// secundario · <40 Signal Red (criticidad).
export function scoreColor(score: number): string {
  if (score >= 75) return "var(--franco-text)";
  if (score >= 40) return "var(--franco-text-secondary)";
  return "var(--signal-red)";
}

export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const stroke = size >= 52 ? 3.5 : 3;
  const r = size / 2 - stroke - 1;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  const font = size >= 52 ? 19 : size >= 44 ? 15 : 14;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--franco-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading font-bold leading-none text-[var(--franco-text)]" style={{ fontSize: font }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Rótulo de zona ─────────────────────────────────────────────────────────
export function ZoneLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="mb-2.5 mt-1.5 flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--franco-text-tertiary)]"
    >
      {children}
      <span className="h-px flex-1 bg-[var(--franco-border)]" aria-hidden="true" />
    </div>
  );
}
