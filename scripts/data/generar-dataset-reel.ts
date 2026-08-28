// Dataset del reel de carrera de comunas (bar race 2015-2025).
//
//   node --import tsx scripts/data/generar-dataset-reel.ts
//
// Emite tools/reels/data/dataset-plusvalia-2015-2025.json.
//
// REGLA DURA: las cifras salen del módulo generado (src/lib/plusvalia-estimado.gen.ts),
// que a su vez sale del CSV de fuentes y de la tabla derivada del estimado. NUNCA se
// escriben a mano acá. Si el reel muestra un número, ese número es el mismo que muestra
// el producto — un reel que dice algo distinto de la página es peor que no publicar.
//
// Universo: las comunas con serie GfK completa Y cierre 2025 (13). Quedan fuera Maipú y
// Quilicura —tienen serie pero su cierre 2025 lo rechazaron las guardas del job— y el
// sentinel PROMEDIO GS, que es un agregado y no una comuna. No se rellena su 2025:
// ver el bloque de las 5 degradadas en generar-plusvalia-estimado.ts.
//
// La métrica es PLUSVALÍA ACUMULADA con base 0 en 2015: cuánto subió el m² de cada
// comuna desde el punto de partida, no su precio absoluto. Así compite Conchalí (que
// parte de UF 31) con Vitacura (que parte de UF 87,1) sin que la escala aplaste a nadie.
//
// Además del dato, el archivo lleva el AGRUPAMIENTO que el reel usa para pintar: quién
// es protagonista y quiénes son "las más caras" del titular. El grupo se deriva del
// nivel UF/m² del año base y una guarda verifica que el titular siga siendo cierto.

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import {
  GFK_SERIE,
  PLUSVALIA_ESTIMADO_2025,
  PLUSVALIA_ESTIMADO,
  ANIO_ESTIMADO,
} from "../../src/lib/plusvalia-estimado.gen";

const SALIDA = join(__dirname, "../../tools/reels/data/dataset-plusvalia-2015-2025.json");

/** Comuna protagonista: se pinta en Signal Red. El resto va en Ink o gris. */
const PROTAGONISTA = "Conchalí";

/**
 * Cuántas comunas forman el grupo "las más caras" del titular. Se eligen por su nivel
 * UF/m² del año base, no a mano: si mañana el ranking de precios cambia, cambia el
 * grupo — y la guarda del titular avisa si la frase dejó de ser cierta.
 */
const N_CARAS = 6;

interface FilaReel {
  nombre: string;
  /** Acumulado % con base 0 en el primer año, un valor por año. */
  valores: number[];
  /** UF/m² del año base. Define el grupo "cara"; no se dibuja. */
  nivelInicial: number;
  /** protagonista → Signal Red · cara → gris · resto → Ink. */
  grupo: "protagonista" | "cara" | "resto";
}

const comunas = Object.keys(GFK_SERIE)
  .filter((c) => PLUSVALIA_ESTIMADO_2025[c])
  .sort((a, b) => a.localeCompare(b, "es"));

const desde = GFK_SERIE[comunas[0]].desde;
const anios = Array.from(
  { length: GFK_SERIE[comunas[0]].valores.length + 1 },
  (_, i) => desde + i,
);

const filas: FilaReel[] = comunas.map((nombre) => {
  const s = GFK_SERIE[nombre];
  if (s.desde !== desde) throw new Error(`${nombre}: la serie no arranca en ${desde}`);
  // El cierre estimado entra como un punto más, igual que en la trayectoria del
  // producto (F4). Es el mismo número que dibuja /comunas.
  const ufM2 = [...s.valores, PLUSVALIA_ESTIMADO_2025[nombre].ufM2];
  if (ufM2.length !== anios.length) throw new Error(`${nombre}: ${ufM2.length} puntos, se esperaban ${anios.length}`);
  const base = ufM2[0];
  const valores = ufM2.map((v) => Math.round((v / base - 1) * 1000) / 10);

  // Guarda de coherencia: el acumulado final tiene que coincidir con el
  // `plusvalia10a` que el producto ya publica para esa comuna. Si difieren, el
  // reel estaría contando otra historia que la página.
  const finalReel = Math.round(valores[valores.length - 1]);
  const finalProducto = PLUSVALIA_ESTIMADO[nombre].plusvalia10a;
  if (Math.abs(finalReel - finalProducto) > 1) {
    throw new Error(`${nombre}: acumulado ${finalReel}% ≠ ${finalProducto}% del producto`);
  }
  return { nombre, valores, nivelInicial: base, grupo: "resto" as const };
});

// Agrupamiento. El protagonista manda sobre "cara": hoy no se solapan, pero el orden
// deja el caso definido si alguna vez pasara.
const caras = new Set(
  [...filas].sort((a, b) => b.nivelInicial - a.nivelInicial).slice(0, N_CARAS).map((f) => f.nombre),
);
for (const f of filas) {
  if (f.nombre === PROTAGONISTA) f.grupo = "protagonista";
  else if (caras.has(f.nombre)) f.grupo = "cara";
}

// GUARDA DEL TITULAR. El reel abre afirmando que las comunas más caras terminaron
// "al fondo de la tabla". Formalizado: las N_CARAS caras caen todas dentro de las
// últimas N_CARAS+1 posiciones — se tolera exactamente una infiltrada (hoy es
// Estación Central, 11ª). Si un dato futuro lo desmiente, esto revienta el dataset
// en vez de dejar publicado un titular falso.
const final = (f: FilaReel) => f.valores[f.valores.length - 1];
const rankingFinal = [...filas].sort((a, b) => final(b) - final(a));
const posiciones = [...caras]
  .map((n) => rankingFinal.findIndex((f) => f.nombre === n) + 1)
  .sort((a, b) => a - b);
if (posiciones[0] < filas.length - N_CARAS) {
  throw new Error(
    `titular refutado: las ${N_CARAS} más caras ocupan las posiciones ${posiciones.join(", ")} de ${filas.length} — ya no están todas al fondo`,
  );
}

// EVENTOS de la pista. El reel marca con un pulso solo unos pocos momentos, pero la
// lista se calcula acá desde el dato: así el reel no puede destacar un adelantamiento
// que nunca ocurrió (asserta contra esta lista y revienta si no lo encuentra).
//
// El año base es degenerado —todos valen 0%— así que su orden se toma del año
// siguiente, la misma convención que usa el reel para el arranque.
const N_PISTA = 8;
const clave = (f: FilaReel, i: number) => (i === 0 ? f.valores[1] : f.valores[i]);
const posiciones2 = anios.map((_, i) => {
  const orden = [...filas].sort((a, b) => clave(b, i) - clave(a, i));
  return new Map(orden.map((f, k) => [f.nombre, k + 1]));
});

interface Evento {
  nombre: string;
  anio: number;
  /** entra/sale del top-8 · podio = primera vez que llega a 1º o 2º. */
  tipo: "entra" | "sale" | "podio";
}

const eventos: Evento[] = [];
for (const f of filas) {
  let mejorPrevia = Infinity;
  for (let i = 0; i < anios.length; i++) {
    const pos = posiciones2[i].get(f.nombre)!;
    if (i > 0) {
      const previa = posiciones2[i - 1].get(f.nombre)!;
      if (previa <= N_PISTA && pos > N_PISTA) eventos.push({ nombre: f.nombre, anio: anios[i], tipo: "sale" });
      if (previa > N_PISTA && pos <= N_PISTA) eventos.push({ nombre: f.nombre, anio: anios[i], tipo: "entra" });
    }
    if (pos <= 2 && mejorPrevia > 2) eventos.push({ nombre: f.nombre, anio: anios[i], tipo: "podio" });
    mejorPrevia = Math.min(mejorPrevia, pos);
  }
}
eventos.sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre, "es"));

const dataset = {
  meta: {
    titulo: "Plusvalía acumulada por comuna",
    subtitulo: `${anios[0]}–${anios[anios.length - 1]}`,
    metrica: "% acumulado desde " + anios[0],
    anioEstimado: ANIO_ESTIMADO,
    nCaras: N_CARAS,
    fuente:
      "Fuente: elaboración propia en base a datos públicos de GfK/NielsenIQ, Tinsa, Colliers y Arenas & Cayo.",
    // Generado, no editado. Este archivo se regenera y se compara, no se toca.
    generadoPor: "scripts/data/generar-dataset-reel.ts",
  },
  anios,
  filas,
  eventos,
};

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify(dataset, null, 2) + "\n", "utf8");

console.log(`Escrito ${SALIDA}`);
console.log(`  ${filas.length} comunas · ${anios.length} años (${anios[0]}–${anios[anios.length - 1]})`);
console.log(`  ganador: ${rankingFinal[0].nombre} +${final(rankingFinal[0])}%`);
console.log(`  las ${N_CARAS} más caras (${[...caras].join(", ")}) cierran en las posiciones ${posiciones.join(", ")} de ${filas.length}`);
console.log(`  ${eventos.length} eventos de pista (entra/sale/podio)`);
console.log(`  excluidas por no tener cierre ${ANIO_ESTIMADO}: ${Object.keys(GFK_SERIE).filter((c) => !PLUSVALIA_ESTIMADO_2025[c]).join(", ")}`);
