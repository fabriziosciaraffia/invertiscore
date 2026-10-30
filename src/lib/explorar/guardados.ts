// ─────────────────────────────────────────────────────────────────────────────
// LOS GUARDADOS EN EL DASHBOARD (28-oct-2026, goal «Explorar como portal»): los deptos que la persona guardó con el corazón
// en Explorar aparecen en el dashboard en una fila plegada «Guardados», con «Comparar» para los que marque (de 2 a 4,
// lado a lado). La parte pura: cada depto en una fila y la tabla de la comparación, con los supuestos de la vista global
// (el financiamiento por defecto, arriendo tradicional: el número de anoche). La lectura vive en guardados-servidor.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { lineaDepto, type CondicionDepto } from "@/lib/guia/linea-depto";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { capRatePct, flujoTexto, pctUno, ufPorM2 } from "./explorar";
import { urlDePortal, FILTROS_GLOBALES } from "./portal";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";

export interface DeptoGuardado {
  avisoId: string;
  comuna: string;
  m2: number;
  tipologia: string | null;
  condicion?: CondicionDepto;
  precioUF: number | null;
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
  arriendo: number | null;
  /** El aviso sigue publicado y activo (si no, la fila lo dice y no se compara). */
  activo: boolean;
  /** Su informe, si ya lo analizó. */
  informeId: string | null;
}

export const COMPARAR_MIN_GUARDADOS = 2;
export const COMPARAR_MAX_GUARDADOS = 4;

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export const GUARDADOS_COPY = {
  titulo: "Guardados",
  sub: `Con pie ${PIE_POR_DEFECTO} % y ${PLAZO_POR_DEFECTO} años, arriendo tradicional`,
  comparar: (n: number) => (n >= COMPARAR_MIN_GUARDADOS ? `Comparar ${n}` : "Comparar"),
  marca: `Marca de ${COMPARAR_MIN_GUARDADOS} a ${COMPARAR_MAX_GUARDADOS} para compararlos.`,
  verEnMapa: "Ver en el mapa",
  verInforme: "Ver informe",
  quitar: "Quitar",
  yaNo: "Ya no está publicado",
  cerrarComparacion: "Cerrar la comparación",
} as const;

/** El depto en el mapa de Explorar: la vista global con su tarjeta abierta. */
export const hrefEnMapa = (avisoId: string): string => {
  const q = urlDePortal(FILTROS_GLOBALES);
  return `/explorar?${q ? `${q}&` : ""}a=${encodeURIComponent(avisoId)}`;
};

/** «Comprar · 84 · +$142.264 al mes»: la segunda línea de la fila. */
export function lineaGuardado(d: DeptoGuardado): string {
  if (!d.activo) return GUARDADOS_COPY.yaNo;
  const v = d.veredicto ? `${etiquetaVeredicto(d.veredicto, "frase")}${d.score != null ? ` · ${d.score}` : ""}` : null;
  const f = d.flujo != null ? `${flujoTexto(d.flujo)} al mes` : null;
  return [v, f].filter(Boolean).join(" · ");
}

/** La tabla de la comparación: una fila por dato, una columna por depto. */
export function tablaComparacion(ds: readonly DeptoGuardado[], uf: number | null): Array<{ dato: string; valores: string[] }> {
  const c = (f: (d: DeptoGuardado) => string | null) => ds.map((d) => f(d) ?? "—");
  return [
    { dato: "Depto", valores: c((d) => lineaDepto(d)) },
    { dato: "Precio", valores: c((d) => (d.precioUF ? `UF ${miles(d.precioUF)}` : null)) },
    { dato: "UF por m²", valores: c((d) => { const x = d.precioUF ? ufPorM2(d.precioUF, d.m2) : null; return x != null ? `${miles(x)} UF` : null; }) },
    { dato: "Veredicto", valores: c((d) => (d.veredicto ? `${etiquetaVeredicto(d.veredicto, "frase")}${d.score != null ? ` · ${d.score}` : ""}` : null)) },
    { dato: "Flujo mensual", valores: c((d) => (d.flujo != null ? flujoTexto(d.flujo) : null)) },
    { dato: "Cap rate", valores: c((d) => { const x = d.precioUF ? capRatePct(d.arriendo, d.precioUF, uf) : null; return x != null ? pctUno(x) : null; }) },
    { dato: "Arriendo estimado", valores: c((d) => (d.arriendo ? `$${miles(d.arriendo)}` : null)) },
  ];
}
