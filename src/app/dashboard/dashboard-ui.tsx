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
import { colorDeVeredicto } from "@/components/analysis/shared/ChipVeredicto";

// ─── Veredicto ──────────────────────────────────────────────────────────────
// EL CHIP DEL INFORME (25-sep-2026). Hasta hoy el dashboard tenía su paleta propia —tinta, gris y
// rojo en mono— y un `VerdictBadge` suyo. Ahora el veredicto se dibuja con `ChipVeredicto`, el mismo
// del informe (✓ Comprar azul, − Ajustar ciruela, ✕ Buscar otro rojo), y su CSS lo monta la página
// (`ChipVeredictoTokens`). El tier CHIP-VEREDICTO cubre el dashboard.

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

// ─── Color del puntaje ───────────────────────────────────────────────────────
// SIGUE AL VEREDICTO, NO A LA NOTA, y es el color del CHIP DEL INFORME (25-sep-2026): azul en
// Comprar, ciruela en Ajustar, rojo en Buscar otro (`colorDeVeredicto`). Antes era la paleta propia
// del dashboard y, antes todavía, un color por la nota.
export function colorDelPuntaje(veredicto: Veredicto): string {
  return colorDeVeredicto(veredicto);
}

export function ScoreRing({ score, veredicto, size = 40 }: { score: number; veredicto: Veredicto; size?: number }) {
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
          stroke={colorDelPuntaje(veredicto)}
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

// ─── Chevron de grupo ───────────────────────────────────────────────────────
// Dibujado en CSS y no como glifo: JetBrains Mono no trae ▸/▾ y el fallback de
// fuente los renderiza de tamaños distintos entre estados.
export function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span className="relative inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <span
        className="absolute"
        style={
          abierto
            ? {
                left: 2, top: 5,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "5px solid var(--franco-text)",
              }
            : {
                left: 3, top: 4,
                borderTop: "4px solid transparent",
                borderBottom: "4px solid transparent",
                borderLeft: "5px solid var(--franco-text-secondary)",
              }
        }
      />
    </span>
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
