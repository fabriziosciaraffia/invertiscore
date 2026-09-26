import type { Veredicto } from "@/lib/types";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

/** Nombre del veredicto en lenguaje de usuario (compartido LTR / STR): la escritura vive en
 *  veredicto-etiqueta.ts (goal 10a); esto queda como alias para los llamadores (los rótulos de los
 *  diales). Vivía en `Matriz.tsx`, retirado el 25-sep-2026 sin llamadores fuera de /dev. */
export const nombreVeredicto = (v: Veredicto | string): string => etiquetaVeredicto(v, "frase");
