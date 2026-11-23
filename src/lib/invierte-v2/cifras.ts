// ─────────────────────────────────────────────────────────────────────────────
// LAS CUATRO CIFRAS DE UN DEPTO (etapa 3, ficha del 23-nov-2026; lámina 4.2-ficha-del-depto y su LEEME, parte 1). Siempre las mismas y
// en este orden: Publicado, Arriendo estimado, Cap rate y la cuarta, «Pones al mes» o «Te sobran al mes» con el número solo. Van en la
// página del depto, la base y el resultado (CuatroCifras.tsx). Ninguna se esconde (decisión de Fabrizio, 23-nov-2026: el veredicto sale
// de esos mismos números): con menos de MIN_ARRIENDOS_COMPARABLES arriendos de su tamaño, una marca gris bajo las cifras.
// Este archivo no calcula nada: los números salen del motor (cifras-motor.ts). Sin el motor adentro: lo lee el navegador.
// ─────────────────────────────────────────────────────────────────────────────
import { MIN_ARRIENDOS_COMPARABLES } from "./lectura-franco";

/** El cap rate (bruto) y lo que queda al mes a un precio. */
export interface CifrasAPrecio {
  precioUF: number;
  capRatePct: number | null;
  /** Flujo neto mensual con pie 20 % y 30 años: negativo = lo que pone cada mes. */
  flujoCLP: number | null;
}

export interface CifrasDepto {
  publicadoUF: number | null;
  arriendoCLP: number | null;
  capRatePct: number | null;
  flujoCLP: number | null;
  /** Menos de MIN_ARRIENDOS_COMPARABLES arriendos de su tamaño cerca: las cifras van igual, con la marca gris. */
  pocosComparables: boolean;
}

/** El bloque de la oferta en la ficha: con una oferta viva, a su monto; con precio acordado, a ese precio. */
export interface BloqueCifrasOferta {
  tipo: "oferta" | "acordado";
  a: CifrasAPrecio;
  publicado: { capRatePct: number | null; flujoCLP: number | null };
}

/** ¿Hay pocos arriendos comparables? `n` desconocido (no se pudo contar) no marca. */
export const pocosComparables = (n: number | null | undefined): boolean => n != null && n < MIN_ARRIENDOS_COMPARABLES;

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
/** «5,1 %», con espacio que no corta. */
export const pctCifra = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `${(Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);
export const clpCifra = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `$${miles(Math.abs(n))}`);
export const ufCifra = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `UF ${miles(n)}`);

/** ¿Deja plata al mes? (la misma regla que opciones.ts › dejaPlata). */
export const sobra = (flujo: number | null | undefined) => flujo != null && flujo > 0;

export const CIFRAS_COPY = {
  publicado: "Publicado",
  arriendo: "Arriendo estimado",
  arriendoCorto: "Arriendo est.",
  capRate: "Cap rate",
  pones: "Pones al mes",
  sobran: "Te sobran al mes",
  pocos: "Estimado con pocos arriendos comparables",
  aEstePrecio: "A este precio",
  conOferta: (uf: number) => `Con tu oferta de UF ${miles(uf)}`,
  acordado: (uf: number) => `Con el precio acordado de UF ${miles(uf)}`,
  /** «Al precio publicado: 5,1 % · pones $30.000». */
  alPublicado: (cap: number | null, flujo: number | null) =>
    `Al precio publicado: ${pctCifra(cap)}${flujo == null ? "" : ` · ${sobra(flujo) ? "te sobran" : "pones"} ${clpCifra(flujo)}`}`,
} as const;

/** La cuarta cifra: la etiqueta dice si pone o le sobra; el número va solo y en negro (24-nov-2026: en Invierte el rojo es solo el
 *  botón principal). `pones` queda para quien lo necesite, no para el color. */
export function cuartaCifra(flujo: number | null | undefined): { et: string; v: string; pones: boolean } {
  if (flujo == null || !Number.isFinite(flujo)) return { et: CIFRAS_COPY.pones, v: "—", pones: false };
  return sobra(flujo) ? { et: CIFRAS_COPY.sobran, v: clpCifra(flujo), pones: false } : { et: CIFRAS_COPY.pones, v: clpCifra(flujo), pones: flujo < 0 };
}

/** Las cuatro, en su orden fijo: [clave, etiqueta, valor]. Una sola lista para todas las pantallas. */
export function listaCifras(c: CifrasDepto, corto = false): { clave: "publicado" | "arriendo" | "cap-rate" | "al-mes"; et: string; v: string; pones?: boolean }[] {
  const cuarta = cuartaCifra(c.flujoCLP);
  return [
    { clave: "publicado", et: CIFRAS_COPY.publicado, v: ufCifra(c.publicadoUF) },
    { clave: "arriendo", et: corto ? CIFRAS_COPY.arriendoCorto : CIFRAS_COPY.arriendo, v: clpCifra(c.arriendoCLP) },
    { clave: "cap-rate", et: CIFRAS_COPY.capRate, v: pctCifra(c.capRatePct) },
    { clave: "al-mes", et: cuarta.et, v: cuarta.v, pones: cuarta.pones },
  ];
}

/** Los estados de la oferta con un bloque en la ficha: viva (a su monto) o con precio acordado. */
export const OFERTA_VIVA_CIFRAS = ["firmada", "en_cola", "presentada", "contraoferta"] as const;
export const OFERTA_ACORDADA_CIFRAS = ["aceptada_sujeta", "en_firme"] as const;
