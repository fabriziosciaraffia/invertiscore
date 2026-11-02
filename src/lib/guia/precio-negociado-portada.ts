// ─────────────────────────────────────────────────────────────────────────────
// EL PRECIO NEGOCIADO, EN LA PORTADA (02-nov-2026, goal «Filtros v2 y negociar»). El informe que sale de «Analizar a UF 2.950» en la
// capa «Si negocias» de Explorar se hace a ese precio y lo dice bajo el veredicto: «Analizado a UF 2.950, un 4,2 % bajo el precio
// publicado». Los dos precios y el descuento quedan en `input_data.origenAviso.precioNegociado` (la ruta de analizar). Sin
// importar el código de Explorar: entra al informe.
// ─────────────────────────────────────────────────────────────────────────────
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type NegociadoPortada = { publicadoUF: number; negociadoUF: number; descuentoPct: number } | null;

/** El precio negociado del informe, si lo hubo (`input_data.origenAviso.precioNegociado`), con los dos precios. */
export function negociadoDePortada(inputData: unknown): NegociadoPortada {
  const n = (inputData as { origenAviso?: { precioNegociado?: { publicadoUF?: unknown; negociadoUF?: unknown; descuentoPct?: unknown } } } | null | undefined)?.origenAviso?.precioNegociado;
  const p = Number(n?.publicadoUF), q = Number(n?.negociadoUF), d = Number(n?.descuentoPct);
  if (!(p > 0) || !(q > 0) || !(q < p) || !(d > 0)) return null;
  return { publicadoUF: p, negociadoUF: q, descuentoPct: d };
}

/** «Analizado a UF 2.950, un 4,2 % bajo el precio publicado». */
export function lineaNegociadoPortada(n: NonNullable<NegociadoPortada>): string {
  return `Analizado a UF ${miles(n.negociadoUF)}, un ${pct1(n.descuentoPct)} % bajo el precio publicado`;
}
