// ─────────────────────────────────────────────────────────────────────────────
// «TU FLUJO MENSUAL» LTR (capítulo II) — lo que el capítulo dice y el render no decide.
//
// Contrato: docs/wireframes/rediseno-informe/capitulo-ii-flujo-ltr.html (aprobado el
// 21-sep-2026), al lado del STR resuelto el 16/17-sep. Se reusa casi todo de STR; lo que es
// distinto por modalidad vive acá, en el motor, para que el gate lo lea en vez de recalcularlo:
//
//   · EL RÓTULO DEL MES. STR dice «mes estabilizado» porque tiene ramp-up. LTR no lo tiene:
//     el mes de la tabla es el PROMEDIO del año 1 a precios de hoy, con la vacancia, el
//     corretaje y el recambio prorrateados. Decirlo evita leer «$20.000 de vacancia» como un
//     cobro mensual.
//   · LA SERIE A DIEZ AÑOS, ÷ MESES OPERATIVOS. `serieFlujoMensualPorAnio` (STR) divide por
//     12 porque ese motor resta cargos de una sola vez sin prorratear. LTR prorratea TODO por
//     meses operativos (`buildProjections`: flujoAnual = flujoMes × mesesOperativos), así que
//     ÷12 en un año parcial muestra el 42% del mes real (100 filas del parque). Acá va ÷meses,
//     que reproduce exacto el mes del año. Los años sin operación no entran (pre-entrega), y
//     el motor emite 20 años: el gráfico dibuja 10.
//   · EL PIE DEL GRÁFICO, CON LA HISTORIA INVERSA. En STR el año 1 es el peor y desde ahí
//     sube. En LTR la serie BAJA en 913 de 1.213 filas (75%): el arriendo sube al 3,5%, pero
//     la cuota crece con la UF (3%) sobre una base que suele ser mayor que el arriendo (p50
//     110%) y los gastos operativos suben con la inflación y, sin provisión declarada, con las
//     bandas de mantención por edad. El pie se ESCRIBE desde la descomposición del motor
//     (año 10 − año 1 por término), no desde una frase fija: si la serie sube, dice que sube.
//   · EL MES VACÍO COMO CIERRE. No hay contrafáctico de gestión en LTR; en su lugar va la
//     condición que ninguna fila muestra: cuota completa + gastos comunes enteros +
//     contribuciones del mes (`calcMesVacio`, gate `mes-vacio-catch-test`), con la fórmula a la
//     vista.
//
// Sin React, sin fetch, sin moneda: emite números y segmentos; el componente formatea.
// ─────────────────────────────────────────────────────────────────────────────

import type { YearProjection } from "./types";

/** Un tramo de texto; `b` = negrita; `rojo` = cifra con signo negativo. */
export interface SegFlujo {
  t: string;
  b?: boolean;
  rojo?: boolean;
}

export const ROTULO_MES_LTR = "Lo que entra y lo que sale en un mes promedio del año 1, a precios de hoy";
export const SUB_TOTAL_MES_LTR = "en un mes promedio del año 1, a precios de hoy";
export const HORIZONTE_CURVA_ANIOS = 10;

export interface PuntoFlujoAnualLtr {
  anio: number;
  /** Flujo mensual de ese año: flujoAnual ÷ meses operativos (no ÷12). */
  flujoMensual: number;
  mesesOperativos: number;
}

/**
 * La serie del gráfico «Lo que queda cada mes, año por año» (capítulo II LTR).
 * ÷ meses operativos, sin años sin operación, los primeros `horizonte` años operativos.
 */
export function serieFlujoMensualPorAnioLtr(projections: YearProjection[] | undefined, horizonte = HORIZONTE_CURVA_ANIOS): PuntoFlujoAnualLtr[] {
  return (projections ?? [])
    .map((p) => ({ anio: p.anio, meses: p.mesesOperativos ?? 12, flujoAnual: p.flujoAnual }))
    .filter((p) => p.meses > 0)
    .slice(0, horizonte)
    .map((p) => ({ anio: p.anio, flujoMensual: Math.round(p.flujoAnual / p.meses), mesesOperativos: p.meses }));
}

export interface DescomposicionFlujoLtr {
  primero: PuntoFlujoAnualLtr;
  ultimo: PuntoFlujoAnualLtr;
  /** Δ mensual (último − primero) por término; positivo = sube. Gastos = operativos + vacancia/rotación. */
  dArriendo: number;
  dCuota: number;
  dGastos: number;
  /** Cuota del primer año como % del arriendo del primer año. */
  cuotaPor100: number;
}

/**
 * Por qué la serie va hacia donde va: la diferencia mensual entre el último y el primer
 * año operativo, término por término. Solo con años completos en los dos extremos y con el
 * desglose anual presente (filas legacy sin él ⇒ null, y el pie no se escribe).
 */
export function descomposicionFlujoLtr(projections: YearProjection[] | undefined, horizonte = HORIZONTE_CURVA_ANIOS): DescomposicionFlujoLtr | null {
  const serie = serieFlujoMensualPorAnioLtr(projections, horizonte);
  if (serie.length < 2) return null;
  const a = serie[0];
  const b = serie[serie.length - 1];
  const pa = (projections ?? []).find((p) => p.anio === a.anio);
  const pb = (projections ?? []).find((p) => p.anio === b.anio);
  if (!pa || !pb || a.mesesOperativos !== 12 || b.mesesOperativos !== 12) return null;
  if (pa.arriendoAnual == null || pa.dividendoAnual == null || pa.gastosOperativosAnual == null || pa.vacanciaRotacionAnual == null) return null;
  if (pb.arriendoAnual == null || pb.dividendoAnual == null || pb.gastosOperativosAnual == null || pb.vacanciaRotacionAnual == null) return null;
  const mes = (x: number) => Math.round(x / 12);
  return {
    primero: a,
    ultimo: b,
    dArriendo: mes(pb.arriendoAnual) - mes(pa.arriendoAnual),
    dCuota: mes(pb.dividendoAnual) - mes(pa.dividendoAnual),
    dGastos: mes(pb.gastosOperativosAnual + pb.vacanciaRotacionAnual) - mes(pa.gastosOperativosAnual + pa.vacanciaRotacionAnual),
    cuotaPor100: pa.arriendoAnual > 0 ? Math.round((pa.dividendoAnual / pa.arriendoAnual) * 100) : 0,
  };
}

/**
 * El pie del gráfico. Dice hacia dónde va la serie y por qué, con las cifras del motor.
 * `mantencionPorBandas` = sin provisión declarada (la mantención sube de banda con la edad):
 * solo entonces se nombra la causa de los gastos.
 */
export function pieCurvaFlujoLtr(d: DescomposicionFlujoLtr, p: { mantencionPorBandas: boolean; money: (n: number) => string }): SegFlujo[] {
  const money = p.money;
  const n = (x: number) => money(Math.abs(x));
  const con = (x: number) => `${x < 0 ? "−" : ""}${money(Math.abs(x))}`;
  const baja = d.ultimo.flujoMensual < d.primero.flujoMensual;
  const anios = d.ultimo.anio - d.primero.anio + 1;
  const segs: SegFlujo[] = [];
  const causaGastos = p.mantencionPorBandas ? ": la mantención cambia de banda con la edad" : "";
  if (baja) {
    segs.push({ t: `Cada año deja un poco menos. En ${anios} años el arriendo sube ` }, { t: n(d.dArriendo), b: true }, { t: " al mes, pero la cuota sube " });
    segs.push({ t: Math.abs(d.dCuota - d.dArriendo) <= d.dArriendo * 0.15 ? "casi lo mismo" : d.dCuota > d.dArriendo ? "más" : "menos" });
    segs.push({ t: " —" }, { t: n(d.dCuota), b: true }, { t: `, porque crece con la UF sobre una base que ya es el ${d.cuotaPor100}% del arriendo— y los gastos suben ` }, { t: n(d.dGastos), b: true }, { t: ` más${causaGastos}. De ` });
  } else {
    segs.push({ t: `Cada año deja un poco más. En ${anios} años el arriendo sube ` }, { t: n(d.dArriendo), b: true }, { t: " al mes y la cuota, " }, { t: n(d.dCuota), b: true });
    segs.push({ t: ` (crece con la UF sobre una base que es el ${d.cuotaPor100}% del arriendo); los gastos suben ` }, { t: n(d.dGastos), b: true }, { t: `${causaGastos}. De ` });
  }
  segs.push({ t: con(d.primero.flujoMensual), b: true, rojo: d.primero.flujoMensual < 0 }, { t: ` el año ${d.primero.anio} a ` }, { t: con(d.ultimo.flujoMensual), b: true, rojo: d.ultimo.flujoMensual < 0 }, { t: ` el año ${d.ultimo.anio}.` });
  return segs;
}

/**
 * El cierre del capítulo: el mes vacío con la fórmula a la vista. `mesVacio` viene de
 * `calcMesVacio` (cuota completa + gastos comunes ENTEROS + contribuciones del mes); acá no
 * se recalcula, se nombra.
 */
export function cierreMesVacioLtr(p: { mesVacio: number; cuota: number; gastosComunes: number; contribucionesMes: number; money: (n: number) => string }): SegFlujo[] {
  return [
    { t: "Un mes sin arrendatario son " },
    { t: p.money(p.mesVacio), b: true },
    { t: ` de tu bolsillo: la cuota completa (${p.money(p.cuota)}) más los gastos comunes enteros (${p.money(p.gastosComunes)}) y las contribuciones del mes (${p.money(p.contribucionesMes)}). No es el promedio: es el mes que sí vas a vivir.` },
  ];
}
