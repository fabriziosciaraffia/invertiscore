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
import { UMBRAL_PRECIO_PCT, distanciaDelTuyo, indicadorContraElegido } from "./detalles-modo";
import { fmtUF, pieDe } from "./opciones";

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
  /** Ninguna alternativa supera al suyo en nada relevante (decisión de Fabrizio, 19-nov-2026): el subtítulo lo dice. Con el nivel
   *  más lejano de la lista, para que «cerca» no mienta. */
  tuyoMejor: (nivel: NivelAlt, comuna: string | null) =>
    nivel === "perfil" ? "El tuyo es el que más conviene entre los parecidos. Estos te sirven de respaldo si no se da."
    : nivel === "comuna" ? `El tuyo es el mejor de los parecidos que hay en ${comuna ?? "la comuna"}. Estos te sirven de respaldo si no se da.`
    : nivel === "tres_km" ? "El tuyo es el mejor de los parecidos que hay a menos de 3 km. Estos te sirven de respaldo si no se da."
    : "El tuyo es el mejor de los parecidos que hay cerca. Estos te sirven de respaldo si no se da.",
  marca: "Marca los que te interesen. Puedes seguir con varios.",
  soloElegido: "Hoy no hay otros parecidos que convengan. Te avisamos si aparece uno.",
  elQueElegiste: "El que elegiste",
  precio: "Precio",
  arriendo: "Arriendo estimado",
  alMes: "Al mes",
  sigo: "Sigo con este",
  /** La casilla de una alternativa (20-nov-2026): «Sumar»; la del elegido sigue «Sigo con este». */
  sumar: "Sumar",
  neutro: "Parecido al tuyo",
  comparar: (n: number) => `Comparar los ${n} lado a lado`,
  compararTitulo: (n: number) => `Los ${n} lado a lado`,
  volverResultado: "Volver a tu resultado",
  foto: (i: number, n: number) => `Foto ${i} de ${n}`,
  fotoAnterior: "Foto anterior",
  fotoSiguiente: "Foto siguiente",
} as const;

/** «UF 3.180 · a 4 cuadras del tuyo», «UF 3.180 · a 1,8 km del tuyo» o, en otra comuna, «UF 3.180 · en La Florida, a 12 km del
 *  tuyo»: la comuna se nombra solo cuando es otra que la del suyo (decisión de Fabrizio, 20-nov-2026). */
export function lineaPrecioDistancia(precioUF: number, distanciaM: number | null, comuna: string | null, modo: Donde, comunaDelSuyo: string | null = null): string {
  const precio = `UF ${fmtUF(precioUF)}`;
  const otra = comuna && (!comunaDelSuyo || comuna.trim().toLowerCase() !== comunaDelSuyo.trim().toLowerCase()) ? comuna : null;
  return distanciaM == null ? precio : `${precio} · ${distanciaDelTuyo(distanciaM, otra, modo === "convenga")}`;
}

const km = (m: number) => { const k = m / 1000; return k < 10 ? k.toLocaleString("es-CL", { maximumFractionDigits: 1 }) : String(Math.round(k)); };
const unir = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/**
 * EL SUBTÍTULO CON NIVELES MEZCLADOS (decisión de Fabrizio, 20-nov-2026): si todas las alternativas salieron del mismo nivel, el
 * subtítulo de ese nivel; si se mezclan, cuántas hay de cada uno: «Otros 3 parecidos: 2 cerca del tuyo y 1 a 1,8 km.».
 */
export function subtituloAlternativas(items: readonly { nivel: NivelAlt | null; distanciaM: number | null }[], modo: Donde, comuna: string | null): string {
  const n = items.length;
  const niveles = Array.from(new Set(items.map((x) => x.nivel ?? "perfil")));
  if (niveles.length <= 1) return ALTERNATIVAS_COPY.subtitulo(n, nivelDelBloque(items.map((x) => x.nivel)), modo, comuna);
  const de = (nv: NivelAlt) => items.filter((x) => (x.nivel ?? "perfil") === nv);
  const partes: string[] = [];
  const cerca = de("cerca"), tres = de("tres_km"), com = de("comuna"), otras = de("perfil");
  if (cerca.length) partes.push(`${cerca.length} cerca del tuyo`);
  if (tres.length) partes.push(tres.length === 1 && tres[0].distanciaM != null ? `1 a ${km(tres[0].distanciaM)} km` : `${tres.length} a menos de 3 km`);
  if (com.length) partes.push(`${com.length} en el resto de ${comuna ?? "la comuna"}`);
  if (otras.length) partes.push(`${otras.length} más`);
  return `Otros ${n} parecidos: ${unir(partes)}.`;
}

/** El título con niveles mezclados no nombra un lugar: «Y hay 3 parecidos que también convienen.». */
export function nivelDelTitulo(items: readonly { nivel: NivelAlt | null }[]): NivelAlt {
  const niveles = Array.from(new Set(items.map((x) => x.nivel ?? "perfil")));
  if (!items.length) return "solo_elegido";
  return niveles.length === 1 ? (niveles[0] as NivelAlt) : "perfil";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * EL INDICADOR ÚNICO de una alternativa, contra el suyo (LEEME del 19-nov-2026). Solo lo que la favorece, y de eso lo que más
 * pesa según lo que dijo: si el pie es lo que hoy lo limita, «El pie más bajo» (si es el más bajo del grupo y bajo el suyo);
 * después lo que pide o deja al mes, o el precio (indicadorContraElegido decide el orden por objetivo y preocupaciones). Solo
 * ventajas relevantes: $20.000 o más al mes, 5 % o más en precio o pie. Si no hay ninguna, «Parecido al tuyo», sin cifra.
 */
export function indicadorAlternativa(
  alt: { avisoId: string; precioUF: number; flujoCLP: number | null; score: number | null },
  ele: { precioUF: number; flujoCLP: number | null; score: number | null },
  grupo: readonly { avisoId: string; precioUF: number }[],
  perfil: { objetivo: Objetivo | null; preocupaciones: readonly Preocupacion[]; limitaPie: boolean },
): { texto: string; supera: boolean } {
  const pieAlt = pieDe(alt.precioUF);
  // El pie más bajo cuenta solo si es relevante: 5 % o más bajo que el suyo (20-nov-2026).
  const elMasBajo = grupo.every((g) => g.avisoId === alt.avisoId || pieDe(g.precioUF) > pieAlt) && pieAlt <= pieDe(ele.precioUF) * (1 - UMBRAL_PRECIO_PCT / 100);
  if (perfil.limitaPie && elMasBajo) return { texto: `El pie más bajo: UF ${fmtUF(pieAlt)}`, supera: true };
  const ind = indicadorContraElegido(alt, ele, perfil);
  if (ind) {
    if (ind.tipo === "mes" && /^te deja \$[\d.]+ al mes$/.test(ind.frase)) return { texto: `${cap(ind.frase)}, sin poner plata`, supera: true };
    return { texto: `${cap(ind.frase)} que el tuyo`, supera: true };
  }
  if (elMasBajo) return { texto: `El pie más bajo: UF ${fmtUF(pieAlt)}`, supera: true };
  // Ninguna ventaja relevante (decisión de Fabrizio, 20-nov-2026): algo neutro, sin una cifra que se lea como ventaja.
  return { texto: ALTERNATIVAS_COPY.neutro, supera: false };
}

/** Las recomendaciones que cuentan para el cupo: de Franco, como opción o ya elegidas. */
export function cupoUsado(filas: readonly { origen: string; estado: string }[]): number {
  return filas.filter((f) => f.origen === "franco" && (f.estado === "opcion" || f.estado === "elegido")).length;
}

/** Cuántas nuevas se pueden pedir: nunca más de MAX_RECOMENDADOS en total, contando las que ya eligió. */
export const cuantasPedir = (usado: number) => Math.max(0, MAX_RECOMENDADOS - usado);
