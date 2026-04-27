import type { Tone } from "@/lib/analysis/kpi-calculations";

// TODO(franco-design): tone "warn" mapeado a Signal Red (mismo color que "bad").
// Skill elimina ámbar y prefiere resolver warning vía composición (label
// uppercase + border-left Ink 600). Refactor a composición queda fuera del
// scope Fase 2 — la distinción semántica warn/bad se pierde temporalmente.
const TONE_COLORS: Record<Tone, string> = {
  good: "var(--ink-400)",
  warn: "var(--signal-red)",
  bad: "var(--signal-red)",
  neutral: "var(--franco-text)",
};

export type KPICardProps = {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  size: "hero" | "small";
};

export default function KPICard({ label, value, sub, tone, size }: KPICardProps) {
  const color = TONE_COLORS[tone];
  return (
    <div
      className="flex flex-col gap-1"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        border: "0.5px solid color-mix(in srgb, var(--franco-text) 12%, transparent)",
        borderRadius: 8,
        padding: size === "hero" ? "16px 18px" : "12px 14px",
      }}
    >
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "1.2px",
          color: "color-mix(in srgb, var(--franco-text) 55%, transparent)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className="font-mono font-bold whitespace-nowrap"
        style={{
          color,
          lineHeight: 1,
          marginTop: 2,
          fontSize: size === "hero" ? 28 : 20,
        }}
      >
        {value}
      </span>
      <span
        className="font-body"
        style={{
          fontSize: 11,
          color: "color-mix(in srgb, var(--franco-text) 65%, transparent)",
          marginTop: 4,
        }}
      >
        {sub}
      </span>
    </div>
  );
}
