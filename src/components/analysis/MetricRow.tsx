import { InfoTooltip } from "@/components/ui/tooltip";

/**
 * Fila label · valor con tooltip opcional. Move verbatim desde results-client.tsx
 * LTR (Ronda 4a.1). Hoy sin usages activos en LTR — preservada para reuso
 * futuro en drawers Patrón 3 / tablas STR.
 */
export function MetricRow({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-[var(--franco-border)]">
      <span className="font-body text-[13px] text-[var(--franco-text)] flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className={`font-mono text-sm font-medium ${color || "text-[var(--franco-text)]"}`}>{value}</span>
    </div>
  );
}
