// La leyenda del mapa del wizard y la reacción de la dirección dicen lo mismo con el mismo número:
// cuántos comparables hay y a qué radio. El número es el largo de la lista que el mapa dibuja
// (`data.comparables`), no un conteo aparte del endpoint.

/** «500 m» · «1 km» · «1,5 km» · «2 km». null si el radio no llegó. */
export function fmtRadio(metros: number | null | undefined): string | null {
  if (!metros || metros <= 0) return null;
  if (metros < 1000) return `${Math.round(metros)} m`;
  const km = metros / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;
}

/** «22 comparables a 1,5 km» (o «22 comparables cerca» si el radio no llegó). */
export function rotuloComparables(n: number, radioM: number | null | undefined): string {
  const r = fmtRadio(radioM);
  const que = n === 1 ? "comparable" : "comparables";
  return r ? `${n} ${que} a ${r}` : `${n} ${que} cerca`;
}
