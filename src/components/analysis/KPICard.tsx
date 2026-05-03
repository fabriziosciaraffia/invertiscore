import type { Tone } from "@/lib/analysis/kpi-calculations";
import { InfoTooltip } from "@/components/ui/tooltip";

// Deuda técnica documentada: la distinción warn/bad colapsa a binario hoy.
// Refactor pendiente per skill Capa 3: warn debería resolverse con composición
// (label uppercase + border-left Ink 600), no con color. Scope fuera de Fase 4.8.
// Hoy: warn renderiza igual que good (Ink), bad usa Signal Red. Reserva el rojo
// para casos genuinamente críticos (per skill 8 usos permitidos de Signal Red).
const TONE_COLORS: Record<Tone, string> = {
  good: "var(--ink-400)",
  warn: "var(--franco-text)",
  bad: "var(--signal-red)",
  neutral: "var(--franco-text)",
};

export type KPICardProps = {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  size: "hero" | "small";
  tooltip?: string;
};

export default function KPICard({ label, value, sub, tone, size, tooltip }: KPICardProps) {
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
        className="inline-flex items-center gap-1 font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "1.2px",
          color: "color-mix(in srgb, var(--franco-text) 55%, transparent)",
          fontWeight: 500,
        }}
      >
        <span>{label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
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
