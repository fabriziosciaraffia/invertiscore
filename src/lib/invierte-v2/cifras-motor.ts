// ─────────────────────────────────────────────────────────────────────────────
// LAS CIFRAS DE UN DEPTO A CUALQUIER PRECIO, CON EL MOTOR (etapa 3, 23-nov-2026; decisión de Fabrizio: una sola fuente de números).
// Al confirmar la ubicación, el servidor arma una vez los DATOS FIJOS del depto (el cuerpo que recibe la sonda del motor, con la
// ubicación confirmada, pie 20 %, 30 años y la tasa del motor: negociar.ts › cuerpoDeCandidato) y los guarda en
// inv_ubicaciones.analisis.motor. Con eso, el cap rate y lo que queda al mes a otro precio salen de la MISMA función del motor
// (sondaConPatch) cambiando solo el precio: en el servidor (la ficha, la contraoferta) y en el navegador (el punto de la oferta).
// Al precio publicado da lo mismo que el análisis rehecho (medido el 23-nov-2026: $101.554 y Comprar en los dos).
// El cap rate es el bruto de todo Invierte (arriendo × 12 / precio, explorar.ts › capRatePct).
// ─────────────────────────────────────────────────────────────────────────────
import { sondaConPatch } from "@/lib/analysis";
import { capRatePct } from "@/lib/explorar/explorar";
import { pocosComparables, OFERTA_ACORDADA_CIFRAS, OFERTA_VIVA_CIFRAS, type BloqueCifrasOferta, type CifrasAPrecio, type CifrasDepto } from "./cifras";

/** Los datos fijos del depto para la sonda. `asOf` y `uf` son los del análisis: así el número al precio publicado es el guardado. */
export interface MotorFijo {
  v: 1;
  cuerpo: Record<string, unknown>;
  mediana: unknown;
  uf: number;
  asOf: string;
  arriendoCLP: number;
}

export function esMotorFijo(m: unknown): m is MotorFijo {
  const x = m as MotorFijo | null;
  return !!x && x.v === 1 && typeof x.cuerpo === "object" && x.cuerpo != null && Number(x.uf) > 0 && Number(x.arriendoCLP) > 0 && typeof x.asOf === "string";
}

/** EL CAP RATE Y LO QUE QUEDA AL MES A UN PRECIO: la sonda del motor con el precio cambiado, nada más. */
export function cifrasAPrecio(m: MotorFijo, precioUF: number): CifrasAPrecio {
  if (!(precioUF > 0)) return { precioUF, capRatePct: null, flujoCLP: null };
  const s = sondaConPatch(m.cuerpo as never, m.uf, m.mediana as never, new Date(m.asOf), { precio: precioUF } as never);
  const f = s.metricas?.flujoMensual;
  return { precioUF, capRatePct: capRatePct(m.arriendoCLP, precioUF, m.uf), flujoCLP: f != null && Number.isFinite(f) ? Math.round(f) : null };
}

/** Lo que trae un análisis con la ubicación confirmada (depto-servidor.ts › AnalisisUbicacion), en lo que estas cifras leen. */
export interface AnalisisParaCifras {
  arriendoCLP: number | null;
  flujoCLP: number | null;
  precioUF?: number | null;
  motor?: unknown;
  comparables?: number | null;
}

/**
 * LAS CUATRO CIFRAS DE UN DEPTO, DE UNA SOLA FUENTE (23-nov-2026). Con la ubicación confirmada y sus datos fijos: todas del motor al
 * precio publicado (arriendo incluido: antes salía el de la noche junto al cap rate del análisis rehecho). Con la ubicación confirmada
 * sin datos fijos: las del análisis rehecho. Sin ubicación confirmada: las de la noche. `flujoNoche` es el que ya trae el depto.
 */
export function cifrasDeDepto(p: { publicadoUF: number | null; arriendoNoche: number | null; flujoNoche: number | null; analisis: AnalisisParaCifras | null | undefined; uf: number | null; comparables: number | null | undefined }): CifrasDepto {
  const a = p.analisis ?? null;
  const pocos = pocosComparables(a?.comparables ?? p.comparables);
  const precio = p.publicadoUF != null && p.publicadoUF > 0 ? p.publicadoUF : null;
  if (a && esMotorFijo(a.motor) && precio) {
    const c = cifrasAPrecio(a.motor, precio);
    return { publicadoUF: precio, arriendoCLP: a.motor.arriendoCLP, capRatePct: c.capRatePct, flujoCLP: c.flujoCLP, pocosComparables: pocos };
  }
  if (a) {
    const arriendo = a.arriendoCLP ?? p.arriendoNoche;
    return { publicadoUF: precio, arriendoCLP: arriendo, capRatePct: precio ? capRatePct(arriendo, precio, p.uf) : null, flujoCLP: a.flujoCLP ?? p.flujoNoche, pocosComparables: pocos };
  }
  return { publicadoUF: precio, arriendoCLP: p.arriendoNoche, capRatePct: precio ? capRatePct(p.arriendoNoche, precio, p.uf) : null, flujoCLP: p.flujoNoche, pocosComparables: pocos };
}

/** El bloque de la oferta de la ficha: con una oferta viva, a su monto; con precio acordado (aceptada, en firme), a ese precio. Solo
 *  con datos fijos (una oferta existe solo con la ubicación confirmada). */
export function bloqueOfertaCifras(motor: unknown, oferta: { estado: string; montoUF: number | null; precioFinalUF?: number | null } | null, publicadoUF: number | null): BloqueCifrasOferta | null {
  if (!oferta || !esMotorFijo(motor) || !(publicadoUF && publicadoUF > 0)) return null;
  const viva = (OFERTA_VIVA_CIFRAS as readonly string[]).includes(oferta.estado);
  const acordada = (OFERTA_ACORDADA_CIFRAS as readonly string[]).includes(oferta.estado);
  const precio = acordada ? oferta.precioFinalUF ?? oferta.montoUF : viva ? oferta.montoUF : null;
  if (!precio || !(precio > 0)) return null;
  const pub = cifrasAPrecio(motor, publicadoUF);
  return { tipo: acordada ? "acordado" : "oferta", a: cifrasAPrecio(motor, precio), publicado: { capRatePct: pub.capRatePct, flujoCLP: pub.flujoCLP } };
}
