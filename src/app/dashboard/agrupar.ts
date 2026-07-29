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
  s = s.replace(/[^a-z0-9ñ ]/g, "").trim();
  // Ceros iniciales de la numeración fuera: «0181» y «181» se escriben ambas
  // para la misma propiedad según de dónde venga el dato.
  //
  // CAVEAT (decidido por el goal, anotado acá para que no se re-descubra): en
  // varias comunas de Santiago el cero inicial es SIGNIFICATIVO — marca el
  // tramo anterior a la numeración principal, así que «Pedro de Valdivia 0181»
  // y «Pedro de Valdivia 181» son direcciones distintas y a partir de acá caen
  // en el mismo grupo. Es sobre-agrupación aceptada a cambio de no partir la
  // misma propiedad escrita de dos formas.
  return s.replace(/\b0+(\d)/g, "$1");
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
  /**
   * Hijas VISIBLES del grupo, ya ordenadas por el criterio activo. Los filtros
   * se aplican aguas arriba (la consulta ya vino filtrada), así que todo lo que
   * está acá pasó el filtro y el contador de la fila padre es el de estas.
   */
  hijos: AnalisisDashboardRow[];
  /** Mejor score alcanzado por esta propiedad. */
  mejorScore: number;
  /** ¿Los hijos difieren en dormitorios o superficie? (síntoma del riesgo 1) */
  tipologiasDistintas: number;
  /**
   * ¿El precio de compra difiere entre hermanas? Cuando sí, es lo único que
   * distingue una hija de otra a simple vista y se muestra en su fila.
   */
  preciosDistintos: boolean;
}

/** Un ítem del archivo agrupado: o una fila suelta, o un grupo de ≥2. */
export type ItemArchivo =
  | { kind: "fila"; row: AnalisisDashboardRow }
  | { kind: "grupo"; grupo: GrupoPropiedad };

/** Valor numérico de una fila para la columna por la que se está ordenando. */
function valorDe(r: AnalisisDashboardRow, sort: DashboardSortKey): number | null {
  switch (sort) {
    case "score": return r.score_efectivo;
    case "flujo": return Number(r.flujo);
    case "cap": return r.cap_rate === null ? null : Number(r.cap_rate);
    case "multiplicador": return r.multiplicador === null ? null : Number(r.multiplicador);
    default: return null;
  }
}

/**
 * Valor con el que un GRUPO entra al orden: el MEJOR de sus hijas, no el de la
 * vigente. Un grupo se posiciona por lo mejor que logró esa propiedad; si se
 * usara la vigente, un grupo con un análisis excelente quedaría enterrado por
 * una corrida posterior de tanteo.
 *
 * «Mejor» es el máximo también cuando el orden es ascendente: la dirección
 * aplica a cómo se comparan los grupos entre sí, no a qué representa a cada uno.
 */
function mejorValor(hijos: AnalisisDashboardRow[], sort: DashboardSortKey): number | null {
  let mejor: number | null = null;
  for (const h of hijos) {
    const v = valorDe(h, sort);
    if (v === null) continue;
    if (mejor === null || v > mejor) mejor = v;
  }
  return mejor;
}

/** Fecha con la que un grupo entra al orden: la más reciente de sus hijas. */
function fechaGrupo(hijos: AnalisisDashboardRow[]): string {
  return hijos.reduce((max, h) => (h.created_at > max ? h.created_at : max), hijos[0].created_at);
}

/**
 * Agrupa las unidades por propiedad y ordena los ítems resultantes.
 *
 * Un grupo de UNA sola fila no es un grupo: se degrada a fila suelta, porque
 * una fila padre con chevron y «1 análisis» es ruido.
 *
 * Dos órdenes distintos y a propósito:
 *  · ENTRE ítems — un grupo entra por su MEJOR valor (ver `mejorValor`).
 *  · DENTRO del grupo — las hijas se ordenan por el mismo criterio activo, así
 *    que al expandir se lee de mejor a peor y no en un orden ajeno al header.
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

  const signo = dir === "asc" ? 1 : -1;

  /** Comparador de FILAS por el criterio activo. NULL siempre al final. */
  const compararFilas = (a: AnalisisDashboardRow, b: AnalisisDashboardRow): number => {
    if (sort === "fecha") return signo * a.created_at.localeCompare(b.created_at);
    const va = valorDe(a, sort);
    const vb = valorDe(b, sort);
    if (va === null && vb === null) return b.created_at.localeCompare(a.created_at);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return signo * (va - vb);
    return b.created_at.localeCompare(a.created_at);
  };

  const items: ItemArchivo[] = sueltas.map((row) => ({ kind: "fila" as const, row }));

  porClave.forEach((miembros, key) => {
    if (miembros.length === 1) {
      items.push({ kind: "fila", row: miembros[0] });
      return;
    }
    const hijos = [...miembros].sort(compararFilas);
    const vigente = miembros.reduce((m, h) => (h.created_at > m.created_at ? h : m), miembros[0]);
    const tipologias = new Set(hijos.map((h) => `${h.dormitorios}·${h.banos}·${Math.round(Number(h.superficie))}`));
    const precios = new Set(hijos.map((h) => Math.round(Number(h.precio) * 100)));
    items.push({
      kind: "grupo",
      grupo: {
        key,
        vigente,
        hijos,
        mejorScore: hijos.reduce((m, h) => Math.max(m, h.score_efectivo), 0),
        tipologiasDistintas: tipologias.size,
        preciosDistintos: precios.size > 1,
      },
    });
  });

  items.sort((a, b) => {
    if (sort === "fecha") {
      const fa = a.kind === "fila" ? a.row.created_at : fechaGrupo(a.grupo.hijos);
      const fb = b.kind === "fila" ? b.row.created_at : fechaGrupo(b.grupo.hijos);
      return signo * fa.localeCompare(fb);
    }
    const va = a.kind === "fila" ? valorDe(a.row, sort) : mejorValor(a.grupo.hijos, sort);
    const vb = b.kind === "fila" ? valorDe(b.row, sort) : mejorValor(b.grupo.hijos, sort);
    // Los NULL (filas legacy sin cap ni multiplicador) siempre al final, igual
    // que en la consulta SQL — nunca encabezan un ranking.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return signo * (va - vb);
    return 0;
  });

  return items;
}

/**
 * Fila con la que se pinta la fila PADRE de un grupo.
 *
 * Es la vigente, salvo en la columna por la que se está ordenando: ahí lleva el
 * mejor valor del grupo. Sin esto la tabla se lee rota — el grupo se posiciona
 * por su mejor score (96) pero muestra el de la vigente (76), y queda un «76»
 * arriba de un «96» en una tabla ordenada descendente.
 *
 * Las demás columnas siguen siendo las de la vigente: son el estado actual de
 * la propiedad, no un récord histórico.
 */
export function filaResumenGrupo(
  grupo: GrupoPropiedad,
  sort: DashboardSortKey,
): AnalisisDashboardRow {
  if (sort === "fecha") return grupo.vigente;
  const mejor = mejorValor(grupo.hijos, sort);
  if (mejor === null) return grupo.vigente;
  switch (sort) {
    case "score": return { ...grupo.vigente, score_efectivo: mejor };
    case "flujo": return { ...grupo.vigente, flujo: mejor };
    case "cap": return { ...grupo.vigente, cap_rate: mejor };
    case "multiplicador": return { ...grupo.vigente, multiplicador: mejor };
    default: return grupo.vigente;
  }
}

/** Cuántas UNIDADES representa la lista agrupada (no cuántos ítems). */
export function contarUnidades(items: ItemArchivo[]): number {
  return items.reduce((n, i) => n + (i.kind === "fila" ? 1 : i.grupo.hijos.length), 0);
}
