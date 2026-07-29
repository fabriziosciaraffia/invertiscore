/**
 * Agrupación por propiedad del archivo (Dashboard v2 · 3/3).
 *
 * El uso dominante detrás de esto: el usuario re-analiza el MISMO depto varias
 * veces cambiando supuestos (pie, tasa, precio de oferta). Sin agrupar, esas 8
 * corridas son 8 filas indistinguibles que empujan al resto del archivo hacia
 * abajo.
 *
 * ═══ CRITERIO ═══════════════════════════════════════════════════════════════
 * Clave = dirección normalizada + comuna. Fila sin `direccion` → NO agrupa.
 *
 * Por qué NO por `nombre`: el wizard lo autogenera como «Depto 2D1B
 * Providencia» (wizardV4Submit.ts:75). Decenas de propiedades distintas
 * comparten ese string — agruparía cosas que no son la misma propiedad, que es
 * el peor error posible acá.
 *
 * Por qué NO con `superficie` en la clave: desagrega justo el caso que
 * queremos juntar. La superficie es uno de los supuestos que el usuario corrige
 * entre corridas; con ella en la clave, dos análisis del mismo depto (54 y
 * 54,5 m²) caen en grupos distintos.
 *
 * ═══ RIESGOS ASUMIDOS ═══════════════════════════════════════════════════════
 * 1. SOBRE-AGRUPACIÓN POR EDIFICIO. Google Places devuelve la dirección del
 *    edificio sin número de depto, así que dos unidades distintas del mismo
 *    edificio caen en el mismo grupo. Mitigación: la fila del grupo muestra
 *    dormitorios/superficie del vigente, y si los hijos difieren en esos
 *    campos el grupo lo declara («2 tipologías»). Si duele en datos reales, la
 *    salida es clave = dirección + dormitorios.
 * 2. SUB-AGRUPACIÓN POR FORMATO. «Pedro de Valdivia 181» vs «Av. Pedro de
 *    Valdivia 0181» no matchean: la normalización cubre abreviaturas de vía y
 *    tildes, pero no el cero a la izquierda (que en Providencia es real y
 *    significativo — 0181 y 181 son direcciones distintas). Costo: grupos
 *    duplicados. Molesto, no peligroso.
 * 3. FILAS SIN DIRECCIÓN nunca agrupan. Es correcto (no hay clave confiable),
 *    pero implica que un archivo viejo agrupa poco. Por eso el modo es opt-in.
 * 4. EL PAR AMBAS YA ES UN GRUPO. Esto es un SEGUNDO nivel encima del colapso
 *    que hace la vista (`es_unidad`). Un hijo del grupo puede ser un par AMBAS
 *    colapsado; los dos niveles no se resuelven en una pasada.
 */

import type { AnalisisDashboardRow, DashboardSortKey, SortDir } from "@/lib/dashboard-query";

/** Abreviaturas de vía que significan lo mismo y deben colapsar a una sola. */
const VIAS: Array<[RegExp, string]> = [
  [/^av(e|da|enida)?\.?\s+/, "avenida "],
  [/^psje\.?\s+|^pje\.?\s+|^pasaje\s+/, "pasaje "],
  [/^cl\.?\s+|^calle\s+/, "calle "],
];

/**
 * Normaliza una dirección para comparar. Idempotente.
 * Toma solo el primer segmento (calle + número): el `formatted_address` de
 * Google arrastra código postal, comuna, región y país.
 */
export function normalizarDireccion(direccion: string): string {
  let s = direccion.split(",")[0].trim().toLowerCase();
  // Tildes fuera: «Irarrázaval» y «Irarrazaval» son la misma calle escrita por
  // dos fuentes distintas. El rango va escapado porque son marcas combinantes:
  // pegarlas literales en el fuente es pedir que un editor las normalice sola.
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/\s+/g, " ");
  for (const [re, canon] of VIAS) {
    if (re.test(s)) { s = s.replace(re, canon); break; }
  }
  return s.replace(/[^a-z0-9ñ ]/g, "").trim();
}

/** Clave de propiedad, o null si la fila no tiene dirección utilizable. */
export function clavePropiedad(row: AnalisisDashboardRow): string | null {
  const d = row.direccion?.trim();
  if (!d) return null;
  const norm = normalizarDireccion(d);
  if (!norm) return null;
  return `${norm}|${(row.comuna ?? "").trim().toLowerCase()}`;
}

export interface GrupoPropiedad {
  key: string;
  /** Fila más reciente del grupo: la que representa el estado actual. */
  vigente: AnalisisDashboardRow;
  /** Todas las filas, de la más reciente a la más antigua. */
  hijos: AnalisisDashboardRow[];
  /** Mejor score alcanzado por esta propiedad. */
  mejorScore: number;
  /** ¿Los hijos difieren en dormitorios o superficie? (síntoma del riesgo 1) */
  tipologiasDistintas: number;
}

/** Un ítem del archivo agrupado: o una fila suelta, o un grupo de ≥2. */
export type ItemArchivo =
  | { kind: "fila"; row: AnalisisDashboardRow }
  | { kind: "grupo"; grupo: GrupoPropiedad };

/** Valor por el que ordena un ítem: el del vigente, tanto para filas como grupos. */
function representante(item: ItemArchivo): AnalisisDashboardRow {
  return item.kind === "fila" ? item.row : item.grupo.vigente;
}

/**
 * Agrupa las unidades por propiedad y ordena los ítems resultantes.
 *
 * Un grupo de UNA sola fila no es un grupo: se degrada a fila suelta, porque
 * una fila con chevron y «1 análisis» es ruido.
 *
 * El orden se aplica sobre el VIGENTE de cada grupo, no sobre el mejor valor:
 * ordenar por score con el máximo histórico haría que un grupo suba por un
 * análisis que el usuario ya descartó.
 */
export function agruparPorPropiedad(
  rows: AnalisisDashboardRow[],
  sort: DashboardSortKey,
  dir: SortDir,
): ItemArchivo[] {
  const porClave = new Map<string, AnalisisDashboardRow[]>();
  const sueltas: AnalisisDashboardRow[] = [];

  for (const row of rows) {
    const key = clavePropiedad(row);
    if (!key) { sueltas.push(row); continue; }
    const arr = porClave.get(key);
    if (arr) arr.push(row);
    else porClave.set(key, [row]);
  }

  const items: ItemArchivo[] = sueltas.map((row) => ({ kind: "fila" as const, row }));

  porClave.forEach((miembros, key) => {
    if (miembros.length === 1) {
      items.push({ kind: "fila", row: miembros[0] });
      return;
    }
    const hijos = [...miembros].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const tipologias = new Set(hijos.map((h) => `${h.dormitorios}·${h.banos}·${Math.round(Number(h.superficie))}`));
    items.push({
      kind: "grupo",
      grupo: {
        key,
        vigente: hijos[0],
        hijos,
        mejorScore: hijos.reduce((m, h) => Math.max(m, h.score_efectivo), 0),
        tipologiasDistintas: tipologias.size,
      },
    });
  });

  const signo = dir === "asc" ? 1 : -1;
  const valor = (r: AnalisisDashboardRow): number | null => {
    switch (sort) {
      case "score": return r.score_efectivo;
      case "flujo": return Number(r.flujo);
      case "cap": return r.cap_rate === null ? null : Number(r.cap_rate);
      case "multiplicador": return r.multiplicador === null ? null : Number(r.multiplicador);
      default: return null;
    }
  };

  items.sort((a, b) => {
    const ra = representante(a);
    const rb = representante(b);
    if (sort === "fecha") return signo * ra.created_at.localeCompare(rb.created_at);
    const va = valor(ra);
    const vb = valor(rb);
    // Los NULL (filas legacy sin cap ni multiplicador) siempre al final, igual
    // que en la consulta SQL — nunca encabezan un ranking.
    if (va === null && vb === null) return rb.created_at.localeCompare(ra.created_at);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return signo * (va - vb);
    return rb.created_at.localeCompare(ra.created_at);
  });

  return items;
}

/** Cuántas UNIDADES representa la lista agrupada (no cuántos ítems). */
export function contarUnidades(items: ItemArchivo[]): number {
  return items.reduce((n, i) => n + (i.kind === "fila" ? 1 : i.grupo.hijos.length), 0);
}
