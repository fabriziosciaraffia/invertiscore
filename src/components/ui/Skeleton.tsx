import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

export function Skeleton({
  className = "",
  variant = "rect",
  width,
  height,
  style,
}: SkeletonProps) {
  const resolve = (v: string | number | undefined) =>
    typeof v === "number" ? `${v}px` : v;

  const radius =
    variant === "circle" ? "9999px" : variant === "text" ? "3px" : "6px";

  return (
    <div
      aria-hidden
      className={`bg-[var(--franco-bar-track)] animate-[pulse_1.5s_ease-in-out_infinite] ${className}`}
      style={{
        width: resolve(width) ?? "100%",
        height: resolve(height) ?? (variant === "text" ? "0.9em" : "16px"),
        borderRadius: radius,
        ...style,
      }}
    />
  );
}
