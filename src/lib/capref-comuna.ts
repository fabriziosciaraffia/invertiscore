// Benchmark de cap rate por comuna — la parte PURA (21-sep-2026).
//
// Referencia BRUTA de la comuna construida con avisos propios (`scraped_properties`): la mediana
// del arriendo por m² de los avisos de arriendo, sobre la mediana del precio por m² de los avisos
// de venta, en la MISMA celda que la mediana comunal del sobreprecio: comuna normalizada ×
// condición (nuevo | usado) × dormitorios, superficie ±20% del sujeto. Aviso contra aviso, SIN
// factor de cierre ni de arriendo: es la combinación que coincide con el neto de BDO (÷ 0,8)
// en las comunas núcleo, y ajustar solo el precio lo despega (FASE 0 del 21-sep). El factor
// de arriendo no se puede estimar (la tabla no guarda historia): queda en 1,0 como SUPUESTO.
//
// La referencia es SEÑAL DE PRECIO: entra al hallazgo `cap_rate` (dirección, brecha, frase) y a su
// decisividad. NO entra al score ni al veredicto: el gate 3 (neta ≥ 4) sigue literal.
//
// LA CASCADA QUEDA DECLARADA EN EL DATO (`nivel`), no inferida después:
//   celda    · comuna × condición × dormitorios, ±20% m², n ≥ 15 por lado (90 días, después 180)
//   comuna   · lo mismo sin dormitorios (todas las tipologías), rotulado
//   bdo      · el neto que BDO publica para la comuna (multifamily 4T-2025), citable
//   nacional · sin referencia de la comuna: el promedio nacional de siempre, y se dice
// Obra nueva: precio de venta nuevo y arriendo USADO como proxy (no hay avisos de arriendo
// nuevo), rotulado en `arriendoProxyUsado`.
//
// Se persiste en `analisis.capref_comuna_snapshot` al crear (migración 20260921), foto fija como
// la mediana; las filas anteriores resuelven vivo (capref-comuna-query.ts).
import { median, normalizeComuna, resolverCondicionMercado, type CondicionMercado } from "@/lib/comuna-stats";
import { BDO_CAPRATE_COMUNA, BDO_CITA_CORTA, bdoCapRateNetoComuna } from "@/lib/data/bdo-caprate-comuna";

/** Peldaño de la cascada que produjo la referencia. Va en el dato. */
export type NivelCapRef = "celda" | "comuna" | "bdo" | "nacional";

/** Muestra mínima de avisos válidos POR LADO (arriendo y venta) para publicar un peldaño. Es el
 *  mismo umbral que la mediana comunal (`MIN_VENTAS_MEDIANA`). */
export const MIN_AVISOS_CAPREF = 15;

/** Con esta muestra por lado la referencia se declara de confianza alta. */
export const AVISOS_CAPREF_CONFIANZA_ALTA = 30;

/** Ventanas de frescura, en días, en el orden en que se prueban. */
export const VENTANAS_CAPREF: readonly number[] = [90, 180];

/** Factor de arriendo publicado→contrato. SUPUESTO: 1,0. No hay forma de medirlo con la tabla
 *  (una fila por aviso, actualizada en el lugar, sin historia de precio) y el proxy declarado/
 *  mediana del parque es simétrico. Existe como constante para que el supuesto tenga nombre; no
 *  se aplica en ningún cálculo. */
export const FACTOR_ARRIENDO_SUPUESTO = 1.0;

/**
 * BDO publica NETO y declara su propia conversión: el neto es «NOI del 80% más la vacancia», o sea
 * neto ≈ bruto × 0,8. En el peldaño bdo el capítulo muestra el BRUTO IMPLÍCITO (neto ÷ 0,8) para
 * hablar de una sola base (decisión de Fabrizio, 21-sep-2026); el neto publicado sigue en el dato.
 * Es la única división por 0,8 del repo y vive acá, con su cita.
 */
export const BDO_NETO_A_BRUTO = 0.8;
export function brutoImplicitoBdo(netoPct: number): number {
  return Math.round((netoPct / BDO_NETO_A_BRUTO) * 100) / 100;
}

/** Los peldaños de avisos, en orden. El que resuelve vivo y el que corre en el gate iteran ESTA
 *  lista: no hay otra copia del orden. */
export const CASCADA_CAPREF: ReadonlyArray<{ nivel: "celda" | "comuna"; ventana: number }> = [
  { nivel: "celda", ventana: 90 },
  { nivel: "celda", ventana: 180 },
  { nivel: "comuna", ventana: 90 },
  { nivel: "comuna", ventana: 180 },
];

/** La celda del sujeto: la misma geometría que `getComunaMedianaVentaUF`. */
export interface CeldaCapRef {
  /** Comuna canónica de `scraped_properties` (alias ya resueltos). */
  comuna: string;
  condicion: CondicionMercado;
  /** null = el sujeto no declaró dormitorios (la celda no filtra por tipología). */
  dormitorios: number | null;
  superficieM2: number;
  supMin: number;
  supMax: number;
}

export function construirCeldaCapRef(input: {
  comuna: string;
  superficie: number;
  dormitorios?: number | null;
  esNuevo?: boolean | null;
  antiguedad?: number | null;
}): CeldaCapRef {
  const sup = Number(input.superficie) > 0 ? Number(input.superficie) : 0;
  const d = input.dormitorios;
  return {
    comuna: normalizeComuna(input.comuna),
    condicion: resolverCondicionMercado(input),
    dormitorios: typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null,
    superficieM2: sup,
    supMin: sup * 0.8,
    supMax: sup * 1.2,
  };
}

/** Una muestra de un peldaño: los dos lados YA en UF por m² (arriendo al mes, venta total). */
export interface MuestraCapRef {
  arriendoUFm2Mes: number[];
  ventaUFm2: number[];
}

/** Lo que se persiste en `analisis.capref_comuna_snapshot` y viaja al motor. */
export interface CapRefComunaSnapshot {
  nivel: NivelCapRef;
  /** Cap rate BRUTO de avisos, en % (niveles celda y comuna); null en bdo y nacional. */
  bruto: number | null;
  /** Cap rate NETO que BDO publica para la comuna, en %: la referencia en el nivel bdo y el
   *  cruce citable en los demás. null si BDO no cubre la comuna. */
  bdoNeto: number | null;
  nArriendo: number;
  nVenta: number;
  /** Ventana de frescura (días) que produjo la muestra; null si no fue por avisos. */
  ventana: number | null;
  celda: {
    comuna: string;
    condicion: CondicionMercado;
    /** null cuando el peldaño es «comuna» (sin tipología) o el sujeto no declaró dormitorios. */
    dormitorios: number | null;
    superficieM2: number;
  };
  /** Obra nueva comparada con arriendos de usado (no hay avisos de arriendo nuevo). */
  arriendoProxyUsado: boolean;
  /** Procedencia legible, para la fuente del informe. */
  fuente: string;
  resolvedAt: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Bruto de una muestra: mediana del arriendo/m² × 12 sobre la mediana del precio/m², en %.
 *  Mediana sobre mediana POR m² (no de totales): donde el mix de tamaños difiere, la de totales
 *  se corre hasta 1,5 puntos. Sin factor alguno. */
export function brutoDeMuestra(m: MuestraCapRef): number | null {
  if (m.arriendoUFm2Mes.length === 0 || m.ventaUFm2.length === 0) return null;
  const arr = median(m.arriendoUFm2Mes);
  const venta = median(m.ventaUFm2);
  if (!(arr > 0) || !(venta > 0)) return null;
  return r2(((arr * 12) / venta) * 100);
}

const rotuloDorms = (d: number | null) => (d === null ? "todas las tipologías" : `${d}D`);

/**
 * Evalúa UN peldaño de avisos: publica la referencia si los DOS lados alcanzan
 * `MIN_AVISOS_CAPREF`; si no, null y la cascada sigue. Puro.
 */
export function evaluarPeldanoCapRef(
  paso: { nivel: "celda" | "comuna"; ventana: number },
  muestra: MuestraCapRef,
  celda: CeldaCapRef,
  resolvedAt: string,
): CapRefComunaSnapshot | null {
  const nArriendo = muestra.arriendoUFm2Mes.length;
  const nVenta = muestra.ventaUFm2.length;
  if (nArriendo < MIN_AVISOS_CAPREF || nVenta < MIN_AVISOS_CAPREF) return null;
  const bruto = brutoDeMuestra(muestra);
  if (bruto === null) return null;
  const dormitorios = paso.nivel === "celda" ? celda.dormitorios : null;
  const proxy = celda.condicion === "nuevo";
  const tipologia = paso.nivel === "celda" ? rotuloDorms(celda.dormitorios) : "todas las tipologías";
  const fuente =
    `avisos de arriendo (${nArriendo}) y de venta (${nVenta}) de ${celda.comuna}, ` +
    `${celda.condicion === "nuevo" ? "obra nueva" : "usado"}, ${tipologia}, ` +
    `${Math.round(celda.supMin)}–${Math.round(celda.supMax)} m², últimos ${paso.ventana} días` +
    `${proxy ? "; arriendo de usado como proxy" : ""}: precios y arriendos pedidos, no cerrados`;
  return {
    nivel: paso.nivel,
    bruto,
    bdoNeto: bdoCapRateNetoComuna(celda.comuna),
    nArriendo,
    nVenta,
    ventana: paso.ventana,
    celda: { comuna: celda.comuna, condicion: celda.condicion, dormitorios, superficieM2: celda.superficieM2 },
    arriendoProxyUsado: proxy,
    fuente,
    resolvedAt,
  };
}

/** Los dos últimos peldaños, cuando ningún peldaño de avisos alcanzó: BDO si cubre la comuna;
 *  si no, el promedio nacional, y se dice. Puro. */
export function capRefSinAvisos(celda: CeldaCapRef, resolvedAt: string, nMax: { nArriendo: number; nVenta: number }): CapRefComunaSnapshot {
  const bdoNeto = bdoCapRateNetoComuna(celda.comuna);
  const base = {
    bruto: null,
    bdoNeto,
    nArriendo: nMax.nArriendo,
    nVenta: nMax.nVenta,
    ventana: null,
    celda: { comuna: celda.comuna, condicion: celda.condicion, dormitorios: null, superficieM2: celda.superficieM2 },
    arriendoProxyUsado: false,
    resolvedAt,
  };
  if (bdoNeto !== null) {
    return {
      ...base,
      nivel: "bdo",
      fuente: `sin avisos suficientes en ${celda.comuna}; cap rate neto de edificios multifamily de la comuna según ${BDO_CITA_CORTA} (${BDO_CAPRATE_COMUNA.reporte})`,
    };
  }
  return {
    ...base,
    nivel: "nacional",
    fuente: `sin referencia de ${celda.comuna} (ni avisos suficientes ni cobertura de BDO): se compara con el promedio nacional`,
  };
}

/**
 * La cascada completa sobre un muestreador SÍNCRONO. Es la que corre el gate con fixtures; la
 * resolución viva (capref-comuna-query.ts) itera la misma `CASCADA_CAPREF` con una consulta por
 * peldaño y las mismas dos funciones de arriba.
 */
export function resolverCapRefCascada(
  celda: CeldaCapRef,
  muestrear: (paso: { nivel: "celda" | "comuna"; ventana: number }) => MuestraCapRef,
  resolvedAt: string = new Date().toISOString(),
): CapRefComunaSnapshot {
  let nArriendoMax = 0;
  let nVentaMax = 0;
  for (const paso of CASCADA_CAPREF) {
    const m = muestrear(paso);
    nArriendoMax = Math.max(nArriendoMax, m.arriendoUFm2Mes.length);
    nVentaMax = Math.max(nVentaMax, m.ventaUFm2.length);
    const r = evaluarPeldanoCapRef(paso, m, celda, resolvedAt);
    if (r) return r;
  }
  return capRefSinAvisos(celda, resolvedAt, { nArriendo: nArriendoMax, nVenta: nVentaMax });
}

/** Rótulo corto de la celda para el informe («Ñuñoa · usado · 2D · 45–68 m²»). */
export function rotuloCeldaCapRef(s: CapRefComunaSnapshot): string {
  const c = s.celda;
  const cond = c.condicion === "nuevo" ? "obra nueva" : "usado";
  if (s.nivel === "celda" || s.nivel === "comuna") {
    return `${c.comuna} · ${cond} · ${rotuloDorms(c.dormitorios)} · ${Math.round(c.superficieM2 * 0.8)}–${Math.round(c.superficieM2 * 1.2)} m²`;
  }
  return s.nivel === "bdo" ? `${c.comuna} · multifamily (${BDO_CITA_CORTA})` : `${c.comuna} · sin referencia de la comuna`;
}

/** Redondeo de display del bruto de referencia (una vez, a un decimal). */
export const capRefDisplayPct = r1;
