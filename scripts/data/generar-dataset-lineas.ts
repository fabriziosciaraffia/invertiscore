// Dataset del reel de líneas "Diez años de plusvalía" (top-5 + Promedio GS).
//
//   node --import tsx scripts/data/generar-dataset-lineas.ts
//   node --import tsx scripts/data/generar-dataset-lineas.ts "Recoleta,Macul,..."
//
// Emite tools/reels/data/dataset-lineas-top5.json.
//
// REGLA DURA, igual que en el reel de la carrera: las cifras salen del módulo generado
// y del CSV de fuentes. Ninguna se escribe a mano. Si el reel muestra un número, ese
// número es el mismo que muestra el producto.
//
// La lista de comunas se pasa por argumento: el reel del mes siguiente, con otro top-5,
// se hace corriendo este script con otra lista — sin tocar el código del reel.

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import {
  GFK_SERIE,
  GFK_GRAN_SANTIAGO,
  PLUSVALIA_ESTIMADO_2025,
  ANIO_ESTIMADO,
} from "../../src/lib/plusvalia-estimado.gen";

const SALIDA = join(__dirname, "../../tools/reels/data/dataset-lineas-top5.json");
const CSV_PATH = join(__dirname, "franco-fuentes-2025.csv");

/**
 * Las 5 comunas más analizadas en Franco. Es un hecho de uso del producto, no del dato
 * de mercado, así que entra como parámetro y no se deriva acá. El ORDEN importa: el
 * reel asigna color por posición, así que cambiarlo repinta las series.
 */
const COMUNAS_POR_DEFECTO = ["Providencia", "Santiago", "Ñuñoa", "Las Condes", "La Florida"];

/**
 * Valores de control del prototipo congelado `tools/reels/ref/lineas-top5-FINAL.html`.
 * El reel es una réplica de ese HTML: si el dataset no reproduce estos acumulados, la
 * réplica dejó de serlo y el script revienta.
 */
const CONTROL: Record<string, number> = {
  "La Florida": 66,
  Santiago: 50,
  "Las Condes": 36,
  "Promedio GS": 35,
  "Ñuñoa": 32,
  Providencia: 30,
};

const comunas = (process.argv[2]?.split(",").map((c) => c.trim()).filter(Boolean) ??
  COMUNAS_POR_DEFECTO);

// ─── Serie del agregado ──────────────────────────────────────────────────────
//
// El Gran Santiago no tiene cierre 2025 en la derivada: el job del estimado emite por
// comuna. Su punto 2025 se compone de los trimestres GfK publicados del PROPIO agregado
// —intra-fuente, el mismo método declarado del cierre— leídos del CSV, no fijados acá.
// Mezclar el nivel 1T suelto habría sido cruzar un trimestre con una serie anual.
const trimestres2025: number[] = [];
for (const linea of readFileSync(CSV_PATH, "utf8").trim().split(/\r?\n/).slice(1)) {
  const [fuente, comuna, , periodo, uf] = linea.split(",").map((c) => c.trim());
  if (fuente !== "GFK" || comuna !== "PROMEDIO GS") continue;
  if (!/^2025-T\d$/.test(periodo)) continue;
  trimestres2025.push(Number(uf));
}
if (trimestres2025.length < 3) {
  throw new Error(
    `PROMEDIO GS: se encontraron ${trimestres2025.length} trimestres GfK 2025 en el CSV; se necesitan al menos 3 para componer el cierre`,
  );
}
const cierreGs =
  Math.round((trimestres2025.reduce((a, b) => a + b, 0) / trimestres2025.length) * 10) / 10;

// ─── Series por comuna ───────────────────────────────────────────────────────

type Fila = {
  nombre: string;
  /** UF/m² por año. El último punto es el cierre estimado. */
  ufM2: number[];
  /** Acumulado % con base 0 en el primer año. */
  valores: number[];
  /** La referencia se dibuja punteada y sin emoji. */
  referencia: boolean;
};

const desde = GFK_GRAN_SANTIAGO.serie.desde;
const anios = Array.from(
  { length: GFK_GRAN_SANTIAGO.serie.valores.length + 1 },
  (_, i) => desde + i,
);

const acumulado = (v: number[]) => v.map((x) => Math.round((x / v[0] - 1) * 1000) / 10);

const filas: Fila[] = comunas.map((nombre) => {
  const s = GFK_SERIE[nombre];
  if (!s) throw new Error(`${nombre}: sin serie GfK en el módulo generado`);
  if (s.desde !== desde) throw new Error(`${nombre}: la serie no arranca en ${desde}`);
  const cierre = PLUSVALIA_ESTIMADO_2025[nombre];
  if (!cierre) throw new Error(`${nombre}: sin cierre ${ANIO_ESTIMADO} (lo degradaron las guardas del job)`);
  const ufM2 = [...s.valores, cierre.ufM2];
  if (ufM2.length !== anios.length) {
    throw new Error(`${nombre}: ${ufM2.length} puntos, se esperaban ${anios.length}`);
  }
  return { nombre, ufM2, valores: acumulado(ufM2), referencia: false };
});

const ufGs = [...GFK_GRAN_SANTIAGO.serie.valores, cierreGs];
filas.push({
  nombre: "Promedio GS",
  ufM2: ufGs,
  valores: acumulado(ufGs),
  referencia: true,
});

// ─── Guarda contra el prototipo ──────────────────────────────────────────────
//
// El acumulado final, redondeado igual que en pantalla, tiene que dar el valor que el
// prototipo ya rotula. Cubre las 6 series; una comuna nueva sin control declarado no
// bloquea (el control es del top-5 de este mes), pero se avisa.
const sinControl: string[] = [];
for (const f of filas) {
  const final = Math.round(f.valores[f.valores.length - 1]);
  const esperado = CONTROL[f.nombre];
  if (esperado == null) {
    sinControl.push(f.nombre);
    continue;
  }
  if (final !== esperado) {
    throw new Error(
      `${f.nombre}: acumulado final ${final}% ≠ ${esperado}% del prototipo congelado`,
    );
  }
}

const dataset = {
  meta: {
    titulo: "Diez años de plusvalía",
    subtitulo: `${anios[0]}–${anios[anios.length - 1]}`,
    anioEstimado: ANIO_ESTIMADO,
    cierreGranSantiago: {
      ufM2: cierreGs,
      trimestres: trimestres2025,
      nota: "Compuesto de los trimestres GfK publicados del propio agregado (intra-fuente).",
    },
    fuente:
      "Fuente: elaboración propia en base a datos públicos de GfK/NielsenIQ, Tinsa, Colliers y Arenas & Cayo. Deptos nuevos, UF/m². Las 5 comunas con más análisis en Franco.",
    generadoPor: "scripts/data/generar-dataset-lineas.ts",
  },
  anios,
  filas,
};

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify(dataset, null, 2) + "\n", "utf8");

console.log(`Escrito ${SALIDA}`);
console.log(`  ${filas.length} series · ${anios.length} años (${anios[0]}–${anios[anios.length - 1]})`);
console.log(`  cierre Gran Santiago ${ANIO_ESTIMADO}: ${cierreGs} UF/m² (promedio de ${trimestres2025.join(", ")})`);
for (const f of filas) {
  console.log(`  ${f.nombre.padEnd(14)} +${Math.round(f.valores[f.valores.length - 1])}%  (control ${CONTROL[f.nombre] ?? "—"})`);
}
if (sinControl.length) console.log(`  SIN control declarado: ${sinControl.join(", ")}`);
