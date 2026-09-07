import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// §5.7 · ANGLICISMOS EN EL INFORME (franco-design-system, 04-sep-2026)
//
// Un anglicismo solo queda cuando el término en español no es el que usa el
// mercado (*cap rate*, *cash-on-cash*, *ADR*, *break-even*) y entonces va en
// cursiva en TODAS sus apariciones y glosado la primera vez por página. Este es
// el único patrón: `<Ang>cap rate</Ang>` donde el sitio acepta JSX, y
// `angliza(texto)` donde el texto llega como string (sub-label de
// findingDisplay, que resumen-anexo y el PDF consumen como string).
//
// La cursiva la da `em.ang` (TokensShared) y el `em` del navegador como respaldo.
// No compite con la cursiva editorial de IA (§5.2): esta marca una palabra
// prestada, la otra un bloque generado.
// ─────────────────────────────────────────────────────────────────────────────

export function Ang({ children }: { children: ReactNode }) {
  return <em className="ang">{children}</em>;
}

/** Anglicismos que el mercado usa y que van en cursiva cuando llegan en un string. */
const ANGLICISMOS = /(cap rate|cash-on-cash)/gi;

/** Envuelve en `<Ang>` cada anglicismo conocido de un texto plano. */
export function angliza(texto: string | null | undefined): ReactNode {
  if (!texto) return texto ?? null;
  const partes = texto.split(ANGLICISMOS);
  if (partes.length === 1) return texto;
  return partes.map((p, i) => (i % 2 === 1 ? <Ang key={i}>{p}</Ang> : p));
}
