import type { CSSProperties } from "react";

// Pill de estado mono uppercase con borde fino. Molde extraído del markup inline
// que vivía duplicado en cuenta/perfil. La distinción de estado se resuelve SOLO
// con la escala Ink + Signal Red (Capa 1 binaria del skill franco-design-system):
// cero ámbar, cero verde. Signal Red queda reservado para el caso PRO existente
// (acento de marca); los estados neutros/atención usan stops de Ink.
export type StatusBadgeTone =
  | "ink-400" // suscriptor activo (neutro suave)
  | "ink-500" // cancelada (neutro)
  | "ink-700" // pago pendiente — Ink fuerte = atención sin Signal Red ni ámbar
  | "muted" // free (sin plan)
  | "signal-red"; // PRO (créditos) — único uso de acento

const TONE_COLORS: Record<StatusBadgeTone, string> = {
  "ink-400": "var(--ink-400)",
  "ink-500": "var(--ink-500)",
  "ink-700": "var(--ink-700)",
  muted: "var(--franco-text-muted)",
  "signal-red": "var(--signal-red)",
};

interface StatusBadgeProps {
  label: string;
  tone: StatusBadgeTone;
  className?: string;
  style?: CSSProperties;
}

export function StatusBadge({ label, tone, className = "", style }: StatusBadgeProps) {
  const color = TONE_COLORS[tone];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase ${className}`}
      style={{ color, borderColor: color, ...style }}
    >
      {label}
    </span>
  );
}
