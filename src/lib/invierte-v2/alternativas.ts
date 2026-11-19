// ─────────────────────────────────────────────────────────────────────────────
// LAS ALTERNATIVAS DEL RESULTADO (láminas del 19-nov-2026, 3.2-resultado y 3.2-resultado-pc). Puro: lo usan el servidor, la
// pantalla y el tier.
//   · TOPE DE TRES en todo el flujo (decisión de Fabrizio, 19-nov-2026): Franco nunca recomienda más de MAX_RECOMENDADOS deptos
//     además del elegido —ni en el resultado, ni en la base («Otras opciones que convienen»), ni en la tabla de comparar, ni en
//     los correos—. Si la persona suma una, el cupo NO se rellena con otra nueva: cuentan las que siguen como opción y las que
//     ya eligió. Se libera solo un cupo que deja de valer (ya no conviene, no le alcanza o se despublicó) o al cambiar su perfil.
//   · Las busca la función `invierte_alternativas` (aplicada por Claude el 19-nov-2026) según «¿Dónde buscamos?»; devuelve el
//     NIVEL que usó y el subtítulo dice la verdad de ese nivel.
//   · El indicador único de cada una se arma por reglas, contra el elegido, según lo que la persona dijo que busca.
// ─────────────────────────────────────────────────────────────────────────────
import type { Donde, Objetivo, Preocupacion } from "./perfil";
import { distanciaDelTuyo, indicadorContraElegido } from "./detalles-modo";
import { fmtCLP, fmtUF, pieDe } from "./opciones";

export const MAX_RECOMENDADOS = 3;

export type NivelAlt = "cerca" | "tres_km" | "comuna" | "perfil" | "solo_elegido";
export const NIVELES_ALT: readonly NivelAlt[] = ["cerca", "tres_km", "comuna", "perfil", "solo_elegido"];
export const esNivel = (x: unknown): x is NivelAlt => typeof x === "string" && (NIVELES_ALT as readonly string[]).includes(x);

/** El nivel de un bloque con alternativas de búsquedas distintas (las que siguen de antes y las nuevas): el más lejano. */
export function nivelDelBloque(niveles: readonly (NivelAlt | null | undefined)[]): NivelAlt {
  const vs = niveles.filter(esNivel).filter((n) => n !== "solo_elegido");
  // Hay alternativas pero ninguna dice de dónde salió (las que eligió antes de las láminas del 19-nov-2026): sin inventar un
  // «cerca», el subtítulo neutro.
  if (!vs.length) return niveles.length ? "perfil" : "solo_elegido";
  if (vs.includes("perfil")) return "perfil";
  return vs.includes("comuna") ? "comuna" : vs.includes("tres_km") ? "tres_km" : "cerca";
}

const parecidos = (n: number) => (n === 1 ? "1 parecido" : `${n} parecidos`);

export const ALTERNATIVAS_COPY = {
  /** El título del resultado cuando el suyo le alcanza (lámina 3.2): «Tu depto te alcanza. Y hay 3 parecidos cerca que también convienen.» */
  titulo: (n: number, nivel: NivelAlt, comuna: string | null) => {
    if (!n || nivel === "solo_elegido") return "Tu depto te alcanza.";
    const conv = n === 1 ? "que también conviene" : "que también convienen";
    const donde = nivel === "cerca" ? " cerca" : nivel === "tres_km" ? " a menos de 3 km" : nivel === "comuna" && comuna ? ` en ${comuna}` : "";
    return `Tu depto te alcanza. Y hay ${parecidos(n)}${donde} ${conv}.`;
  },
  /** El subtítulo del bloque: dice la verdad del nivel usado (LEEME del 19-nov-2026; «Donde más convenga», decisión de Fabrizio). */
  subtitulo: (n: number, nivel: NivelAlt, modo: Donde, comuna: string | null) => {
    const otros = n === 1 ? "Otro parecido" : `Otros ${n} parecidos`;
    if (nivel === "perfil") return "Los que más convienen, parecidos al tuyo";
    if (nivel === "cerca") return `${otros}, cerca del tuyo`;
    if (nivel === "tres_km") return `${otros}, un poco más lejos: a menos de 3 km del tuyo`;
    if (modo === "cerca") return `Cerca del tuyo no hay otros que convengan; ${n === 1 ? "este está" : "estos están"} en el resto de ${comuna ?? "la comuna"}`;
    return comuna ? `${otros}, en ${comuna}` : `${otros}, en la comuna`;
  },
  marca: "Marca los que te interesen. Puedes seguir con varios.",
  soloElegido: "Hoy no hay otros parecidos que convengan. Te avisamos si aparece uno.",
  elQueElegiste: "El que elegiste",
  precio: "Precio",
  arriendo: "Arriendo estimado",
  alMes: "Al mes",
  sigo: "Sigo con este",
  sigoCorto: "Sigo",
  comparar: (n: number) => `Comparar los ${n} lado a lado`,
  compararTitulo: (n: number) => `Los ${n} lado a lado`,
  volverResultado: "Volver a tu resultado",
  foto: (i: number, n: number) => `Foto ${i} de ${n}`,
  fotoAnterior: "Foto anterior",
  fotoSiguiente: "Foto siguiente",
} as const;

/** «UF 3.180 · a 4 cuadras del tuyo» (o, en «Donde más convenga», «UF 3.180 · en La Florida, a 12 km del tuyo»). */
export function lineaPrecioDistancia(precioUF: number, distanciaM: number | null, comuna: string | null, modo: Donde): string {
  const precio = `UF ${fmtUF(precioUF)}`;
  return distanciaM == null ? precio : `${precio} · ${distanciaDelTuyo(distanciaM, comuna, modo === "convenga")}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * EL INDICADOR ÚNICO de una alternativa, contra el suyo (LEEME del 19-nov-2026). Solo lo que la favorece, y de eso lo que más
 * pesa según lo que dijo: si el pie es lo que hoy lo limita, «El pie más bajo» (si es el más bajo del grupo y bajo el suyo);
 * después lo que pide o deja al mes, o el precio (indicadorContraElegido decide el orden por objetivo y preocupaciones); y si
 * nada de eso la favorece, el puntaje; si tampoco, lo que deja o pide al mes, sin compararlo.
 */
export function indicadorAlternativa(
  alt: { avisoId: string; precioUF: number; flujoCLP: number | null; score: number | null },
  ele: { precioUF: number; flujoCLP: number | null; score: number | null },
  grupo: readonly { avisoId: string; precioUF: number }[],
  perfil: { objetivo: Objetivo | null; preocupaciones: readonly Preocupacion[]; limitaPie: boolean },
): string | null {
  const pieAlt = pieDe(alt.precioUF);
  const elMasBajo = grupo.every((g) => g.avisoId === alt.avisoId || pieDe(g.precioUF) > pieAlt) && pieAlt < pieDe(ele.precioUF);
  if (perfil.limitaPie && elMasBajo) return `El pie más bajo: UF ${fmtUF(pieAlt)}`;
  const ind = indicadorContraElegido(alt, ele, perfil);
  if (ind) {
    if (ind.tipo === "mes" && /^te deja \$[\d.]+ al mes$/.test(ind.frase)) return `${cap(ind.frase)}, sin poner plata`;
    return `${cap(ind.frase)} que el tuyo`;
  }
  if (elMasBajo) return `El pie más bajo: UF ${fmtUF(pieAlt)}`;
  if (alt.score != null && ele.score != null && alt.score > ele.score) return `Mejor puntaje que el tuyo: ${alt.score}`;
  // Nada la favorece contra el suyo (que ya es muy bueno): se dice lo que deja o pide al mes, sin compararlo, que es lo primero
  // que mira el resultado y es verdad.
  if (alt.flujoCLP != null) return alt.flujoCLP >= 0 ? `Te deja ${fmtCLP(Math.round(alt.flujoCLP / 1000) * 1000)} al mes` : `Pide ${fmtCLP(Math.round(-alt.flujoCLP / 1000) * 1000)} al mes`;
  return null;
}

/** Las recomendaciones que cuentan para el cupo: de Franco, como opción o ya elegidas. */
export function cupoUsado(filas: readonly { origen: string; estado: string }[]): number {
  return filas.filter((f) => f.origen === "franco" && (f.estado === "opcion" || f.estado === "elegido")).length;
}

/** Cuántas nuevas se pueden pedir: nunca más de MAX_RECOMENDADOS en total, contando las que ya eligió. */
export const cuantasPedir = (usado: number) => Math.max(0, MAX_RECOMENDADOS - usado);
