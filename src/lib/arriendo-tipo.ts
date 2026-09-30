// ─────────────────────────────────────────────────────────────────────────────
// Qué clase de arriendo es un aviso (30-sep-2026). Los amoblados se colaban en los comparables del
// arriendo sugerido: 21% de los arriendos de Las Condes y 20% de Vitacura se publican amoblados, y un
// depto sin amoblar no se arrienda a ese precio. Con el filtro, el arriendo sugerido compara contra lo
// mismo que ofrece la persona: sin amoblar por defecto, solo amoblados si dice que el suyo lo es.
//
// La señal es el TÍTULO del aviso (la fila del GetProps lo trae completo en [39]; se guarda desde el
// 30-sep en scraped_properties.titulo). Mientras un aviso no tenga título guardado se lee el slug de la
// URL, que es el mismo título recortado. Puro: lo prueba el tier ARRIENDO-AMOBLADO.
// ─────────────────────────────────────────────────────────────────────────────

export type ClaseArriendo = "amoblado" | "temporada" | "corporativo" | "pieza";

const PATRONES: Array<[ClaseArriendo, RegExp]> = [
  // Pieza primero: «pieza amoblada» es una pieza, no un depto amoblado.
  ["pieza", /\bpiezas?\b|\bhabitaci[oó]n(es)?\b|\broom\b/i],
  ["temporada", /temporada|por\s*d[ií]as?\b|diari[oa]s?\b|vacacion|airbnb|semanal|arriendo\s*temporal/i],
  ["corporativo", /corporativ|ejecutiv|\bservice\b|apart\s*hotel|aparthotel/i],
  ["amoblado", /amobl|amuebl|furnish|full\s*equip/i],
];

/** El texto a clasificar: el título si hay, si no el slug de la URL con los guiones como espacios. */
export function textoDelAviso(a: { titulo?: string | null; url?: string | null }): string {
  if (a.titulo && a.titulo.trim()) return a.titulo;
  const partes = String(a.url ?? "").split("/");
  const slug = partes.length > 7 ? partes[7] : "";
  return slug.replace(/-/g, " ");
}

/** La clase del aviso, o null si es un arriendo corriente (sin amoblar). */
export function claseDeArriendo(a: { titulo?: string | null; url?: string | null }): ClaseArriendo | null {
  const t = textoDelAviso(a);
  for (const [clase, re] of PATRONES) if (re.test(t)) return clase;
  return null;
}

/**
 * ¿Entra este aviso a los comparables de un depto amoblado o no? Sin amoblar (lo por defecto): solo los
 * corrientes —fuera amoblados, temporada, corporativos y piezas—. Amoblado: solo los amoblados.
 */
export function entraComoComparable(a: { titulo?: string | null; url?: string | null }, amoblado: boolean): boolean {
  const c = claseDeArriendo(a);
  return amoblado ? c === "amoblado" : c === null;
}
