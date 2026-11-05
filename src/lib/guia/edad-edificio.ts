// ─────────────────────────────────────────────────────────────────────────────
// LA EDAD DEL EDIFICIO EN EL INFORME (03-nov-2026, goal «la edad del edificio»). Cuando el informe sale de un aviso y el año
// se conoce —la ficha del aviso, o la de otro aviso del mismo edificio (`anios_edificio`)—, el motor recibe la edad real
// (helpers-wizard.ts › aniosDelUsado) y el informe la dice con el año y la fuente: la ficha de la portada («Usado · 75 años,
// edificio de 1951», con «según la ficha» debajo) y la puesta a punto de «Cómo lo pagas». Quedan en
// `input_data.origenAviso.edad` las dos cosas que el motor no guarda: el año y de dónde salió.
// Sin año, 25 supuestos, y la nota dice por qué (`origenAviso.supuestaPor`): la ficha se leyó y no lo trae, o no se pudo leer.
// Los informes de antes no tienen `supuestaPor`: los 44 con la antigüedad supuesta tuvieron su ficha leída al tocar (medido
// el 03-nov-2026 en `lecturas_ficha`; el único sin lectura es de una cuenta de prueba del 01-oct), así que leen «no dice».
// Puro y sin servidor: lo leen la portada, el capítulo y la nota (cliente) y el tier EDAD-EDIFICIO.
// Desde el 05-nov-2026 la noche usa la MISMA edad (edadConocida, tier EDAD-NOCHE): hasta entonces suponía 25 años para todos.
// ─────────────────────────────────────────────────────────────────────────────
import { aniosDesde } from "./ficha-anio";

export type FuenteEdad = "ficha" | "edificio";
export interface EdadEdificio {
  anio: number;
  fuente: FuenteEdad;
}
/** Por qué se supusieron 25 años: la ficha se leyó y no dice el año, o no se pudo leer (tope, error, bloqueo o sin enlace). */
export type SupuestaPor = "no-dice" | "no-leida";

export const EDAD_COPY = {
  fuente: { ficha: "según la ficha", edificio: "según otro aviso del edificio" } satisfies Record<FuenteEdad, string>,
} as const;

const esAnio = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1800 && v <= 2200;

function origenDe(inputData: unknown): Record<string, unknown> | null {
  const o = (inputData as { origenAviso?: unknown } | null | undefined)?.origenAviso;
  return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
}

/** El año y la fuente de la edad del informe, si el informe salió de un aviso con el año conocido. */
export function edadDelInforme(inputData: unknown): EdadEdificio | null {
  const e = origenDe(inputData)?.edad as { anio?: unknown; fuente?: unknown } | undefined;
  if (!e || !esAnio(e.anio) || (e.fuente !== "ficha" && e.fuente !== "edificio")) return null;
  return { anio: e.anio, fuente: e.fuente };
}

/** Por qué el informe supuso 25 años, o null si no los supuso. Sin el campo (informes de antes), «no dice». */
export function supuestaDelInforme(inputData: unknown): SupuestaPor | null {
  const o = origenDe(inputData);
  if (o?.antiguedad !== "supuesta") return null;
  return o.supuestaPor === "no-leida" ? "no-leida" : "no-dice";
}

/** «Usado · 75 años, edificio de 1951» con el año; sin él, «Usado · 25 años» (o «Usado» con cero años). */
export function estadoUsado(anios: number, edad: EdadEdificio | null): string {
  const a = anios > 0 ? `${anios} ${anios === 1 ? "año" : "años"}` : "";
  if (edad) return `Usado · ${a ? `${a}, ` : ""}edificio de ${edad.anio}`;
  return a ? `Usado · ${a}` : "Usado";
}

/** La línea chica de la fuente: «según la ficha» / «según otro aviso del edificio». */
export const fuenteEdad = (edad: EdadEdificio) => EDAD_COPY.fuente[edad.fuente];

/** De dónde puede salir la edad de un usado: el año que dijo SU ficha (recién leída, o la última lectura en `fichas_leidas`)
 *  y el año del edificio (`anios_edificio`: el que dio la primera ficha que lo trajo, de este u otro aviso). */
export interface FuentesEdad {
  avisoId: string;
  anioPropio: number | null;
  edificio: { anio: number; avisoId: string | null } | null;
}

/**
 * LA EDAD CONOCIDA DE UN USADO (05-nov-2026, decisión de Fabrizio): UNA regla para la evaluación de cada noche
 * (avisos/edad-conocida.ts › conEdadConocida) y para el informe (analizar-servidor.ts › antiguedadDelAviso), así el mismo
 * depto tiene la misma edad en la tarjeta y en su informe. Primero el año de su propia ficha; si no, el del edificio; si no,
 * null (la noche supone 25 años y el informe dice por qué). Los años, contados como el informe (ficha-anio.ts › aniosDesde).
 */
export function edadConocida(f: FuentesEdad, ahora: Date = new Date()): { anios: number; edad: EdadEdificio } | null {
  if (f.anioPropio != null) return { anios: aniosDesde(f.anioPropio, ahora), edad: { anio: f.anioPropio, fuente: "ficha" } };
  if (f.edificio) return { anios: aniosDesde(f.edificio.anio, ahora), edad: { anio: f.edificio.anio, fuente: f.edificio.avisoId === f.avisoId ? "ficha" : "edificio" } };
  return null;
}
