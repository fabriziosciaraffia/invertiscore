/**
 * Margen por informe — la cascada de un análisis vendido, sobre pagos REALES.
 *
 * Nada de ejemplos hardcodeados: los precios salen de los pagos del período y la
 * comisión de lo que Flow efectivamente retuvo en cada uno. El único insumo que
 * no viene por pago es el costo de IA, porque un pago no sabe cuántos tokens
 * gastó el análisis que lo originó — se usa la MEDIANA medida del período, que
 * es representativa sin dejarse arrastrar por un outlier.
 *
 * DOS SUTILEZAS DE IVA, las dos deliberadas:
 *
 * 1. El IVA del precio de lista NO es ingreso: se entera al SII. Por eso la
 *    cascada baja de $9.990 a $8.395 antes de tocar ningún costo.
 * 2. El IVA de la comisión de Flow SÍ es crédito fiscal, así que NO resta del
 *    margen. Del retenido total de $344 solo pesan los $289 de comisión neta.
 *    Contar los $344 castigaría al margen con un impuesto recuperable.
 */

import { leerComision, type PagoParaComision } from "@/lib/comision-flow";

/** IVA chileno sobre el precio de venta. */
export const IVA = 0.19;

/** Un pago con lo mínimo para armar la cascada. */
export interface PagoParaMargen extends PagoParaComision {
  product: string | null;
}

/** Familias de producto que la cascada distingue. Un plan y un análisis suelto
 *  tienen estructuras de costo distintas: el plan amortiza hasta N análisis. */
export type FamiliaProducto = "single" | "suscripcion";

export function familiaDe(product: string | null): FamiliaProducto {
  return /mensual|anual|unlimited|subscription/i.test(product ?? "") ? "suscripcion" : "single";
}

/** Cuántos análisis cubre un plan al mes — el peor caso de costo de IA. */
const ANALISIS_POR_PLAN: Record<string, number> = {
  plan10_mensual: 10,
  plan10_anual: 10,
  plan50_mensual: 50,
  plan50_anual: 50,
};

export interface CascadaMargen {
  familia: FamiliaProducto;
  /** Etiqueta del producto representativo (el más frecuente de la familia). */
  producto: string;
  /** Cuántos cobros del período entraron. */
  cobros: number;
  precioLista: number;
  iva: number;
  neto: number;
  /** Comisión de Flow SIN IVA (el IVA es crédito fiscal). */
  comision: number;
  /** true si la comisión salió del dato de Flow y no de la tasa de respaldo. */
  comisionMedida: boolean;
  costoIa: number;
  /** Análisis que ese costo cubre (1 para single, N para un plan). */
  analisisCubiertos: number;
  margen: number;
  margenPct: number;
}

/**
 * Arma una cascada por familia de producto sobre los pagos del período.
 *
 * `costoIaPorAnalisis` en CLP: la mediana medida. Si no hay ninguna medición
 * llega `null` y la cascada devuelve `costoIa: 0` con `analisisCubiertos: 0`,
 * para que la UI muestre "sin dato" en esa línea en vez de un cero que se leería
 * como "la IA salió gratis".
 */
export function construirCascadas(
  pagos: PagoParaMargen[],
  costoIaPorAnalisis: number | null,
): CascadaMargen[] {
  // Solo cobros reales: las altas de suscripción no son un cargo (ver
  // comision-flow.ts) y meterlas duplicaría el precio de lista de la familia.
  const cobros = pagos.filter((p) => leerComision(p).fuente !== "sin-cobro");

  const porFamilia = new Map<FamiliaProducto, PagoParaMargen[]>();
  for (const p of cobros) {
    const f = familiaDe(p.product);
    porFamilia.set(f, [...(porFamilia.get(f) ?? []), p]);
  }

  const salida: CascadaMargen[] = [];

  for (const [familia, lista] of Array.from(porFamilia)) {
    // Producto representativo: el más frecuente. Con precios distintos dentro de
    // una familia se toma el del producto dominante, no un promedio — un
    // promedio entre plan 10 y plan 50 no es el precio de ningún producto real.
    const frecuencia = new Map<string, number>();
    lista.forEach((p) => {
      const k = p.product ?? "—";
      frecuencia.set(k, (frecuencia.get(k) ?? 0) + 1);
    });
    const producto = Array.from(frecuencia.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const delProducto = lista.filter((p) => (p.product ?? "—") === producto);

    const precioLista = delProducto[0]?.amount ?? 0;
    const comisiones = delProducto.map((p) => leerComision(p));
    // Comisión representativa: la del producto, no un promedio entre productos.
    const comision = comisiones[0]?.fee ?? 0;
    const comisionMedida = comisiones.every((c) => c.fuente === "medido");

    const iva = Math.round(precioLista - precioLista / (1 + IVA));
    const neto = precioLista - iva;

    const analisisCubiertos =
      costoIaPorAnalisis == null ? 0 : familia === "suscripcion" ? (ANALISIS_POR_PLAN[producto] ?? 1) : 1;
    const costoIa = costoIaPorAnalisis == null ? 0 : Math.round(costoIaPorAnalisis * analisisCubiertos);

    const margen = neto - comision - costoIa;

    salida.push({
      familia,
      producto,
      cobros: delProducto.length,
      precioLista,
      iva,
      neto,
      comision,
      comisionMedida,
      costoIa,
      analisisCubiertos,
      margen,
      margenPct: neto > 0 ? (margen / neto) * 100 : 0,
    });
  }

  // Single primero: es el producto de entrada y el que más se mira.
  return salida.sort((a) => (a.familia === "single" ? -1 : 1));
}
