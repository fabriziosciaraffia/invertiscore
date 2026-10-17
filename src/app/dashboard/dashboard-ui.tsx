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
// En el sistema nuevo (02-oct-2026): Inter, en minúscula de frase, sin mayúsculas espaciadas.
const TEXTO_MODALIDAD = { LARGA: "Larga", CORTA: "Corta", AMBAS: "Ambas" } as const;

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
      className="inline-flex shrink-0 whitespace-nowrap rounded-full text-[12px] font-medium"
      style={{ padding: "1px 8px", border: "1px solid", ...style }}
    >
      {TEXTO_MODALIDAD[label]}
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

// El anillo del puntaje y el rótulo de zona eran de «Continuar» y de la tira de cifras, que salieron el 17-oct-2026.

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
