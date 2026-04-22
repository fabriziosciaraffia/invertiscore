import type { ReactNode, CSSProperties } from "react";

export type StateBoxVariant = "left-border" | "full-border";
export type StateBoxState = "positive" | "warning" | "negative" | "neutral" | "info";

interface StateBoxProps {
  variant: StateBoxVariant;
  state: StateBoxState;
  label?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Color expression per state. positive/warning use theme-aware CSS variables so they
// adapt between dark and light modes; negative uses the invariant Signal Red; neutral
// maps to the current text color (so it flips between off-white/ink across modes);
// info is a fixed zinc that reads in both.
const STATE_COLORS: Record<StateBoxState, string> = {
  positive: "var(--franco-v-buy)",
  warning: "var(--franco-v-adjust)",
  negative: "#C8323C",
  neutral: "var(--franco-text)",
  info: "#71717A",
};

function mix(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function buildStyles(variant: StateBoxVariant, color: string): CSSProperties {
  if (variant === "left-border") {
    return {
      borderLeft: `3px solid ${color}`,
      background: mix(color, 8),
      borderRadius: "0 8px 8px 0",
      padding: "14px 18px",
    };
  }
  return {
    border: `1px solid ${mix(color, 28)}`,
    background: mix(color, 10),
    borderRadius: "8px",
    padding: "14px 18px",
  };
}

export function StateBox({
  variant,
  state,
  label,
  children,
  className = "",
  style,
}: StateBoxProps) {
  const color = STATE_COLORS[state];
  const mergedStyles = { ...buildStyles(variant, color), ...style };
  // For state=neutral the color equals the body text color, so using it for the label
  // makes the label indistinguishable from the content. Fall back to the secondary token.
  const labelColor = state === "neutral" ? "var(--franco-text-secondary)" : color;

  return (
    <div style={mergedStyles} className={className}>
      {label && (
        <p
          className="font-mono text-[10px] uppercase tracking-[2px] mb-1.5 m-0 font-semibold"
          style={{ color: labelColor }}
        >
          {label}
        </p>
      )}
      <div className="font-body text-[13px] md:text-sm leading-[1.6] text-[var(--franco-text)]">
        {children}
      </div>
    </div>
  );
}
