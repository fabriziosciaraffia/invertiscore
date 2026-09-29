// ─────────────────────────────────────────────────────────────────────────────
// Los chips del perfil inferido (30-sep-2026): tipología, comuna y modalidad del informe que la
// persona está leyendo. Los muestra el banner («Para ti:») y, ya dentro, «Estás dentro» los deja
// editar. Salen del input del análisis, nunca de una constante.
// ─────────────────────────────────────────────────────────────────────────────
import { tipologiaDe } from "./perfil";

export interface PerfilChips {
  tipologia: string | null;
  comuna: string | null;
  modalidad: "ltr" | "str";
}

export function perfilChipsDe(input: { comuna?: unknown; dormitorios?: unknown; banos?: unknown } | null | undefined, modalidad: "ltr" | "str"): PerfilChips {
  return {
    tipologia: tipologiaDe(input?.dormitorios, input?.banos),
    comuna: typeof input?.comuna === "string" && input.comuna.trim() ? input.comuna.trim() : null,
    modalidad,
  };
}

/** Las tipologías que se pueden elegir al editar el chip. */
export const TIPOLOGIAS_CHIP = ["Studio", "1D1B", "2D1B", "2D2B", "3D2B", "3D3B", "4D3B"] as const;
