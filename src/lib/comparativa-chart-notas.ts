// ─────────────────────────────────────────────────────────────────────────
// Anotaciones de los charts de "LA EVIDENCIA" — módulo PURO server-safe.
//
// Fuente única del texto que PatrimonioChartComparativa y FlujoMensualChart
// muestran bajo el gráfico. Se extrajo del JSX inline de ambos componentes
// ("use client") para que el ensamblador editorial (scripts/eval/editorial/
// ensamblar-ambas.ts) lea EXACTAMENTE la prosa que la página renderiza —
// regla espejo: mismo import, misma función, nunca una copia de plantilla.
//
// Los montos que la página pinta en font-mono viajan como segmentos con
// `mono: true`: el componente los mapea a <span className="font-mono">, el
// ensamblador los une planos con `notaTexto`. Así el refactor no cambia un
// píxel del render ni un byte del texto.
// ─────────────────────────────────────────────────────────────────────────

import type { FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtMoney } from "@/components/analysis/utils";
import { hayAsimetriaDeEntrega, patrimoniosIguales } from "@/lib/comparativa-patrimonio";
import { deriveRecomendacionFallback } from "@/lib/comparativa-recomendacion";

export interface NotaSegmento {
  t: string;
  /** El render lo envuelve en <span className="font-mono">. */
  mono?: boolean;
}

/** Texto plano de una secuencia de segmentos (para el ensamblador editorial). */
export const notaTexto = (segs: NotaSegmento[]): string => segs.map((s) => s.t).join("");

type Currency = "CLP" | "UF";

// ── Chart 1 · Patrimonio y riqueza ───────────────────────────────────────────

export interface NotaPatrimonioChart {
  kicker: string;        // "AL AÑO N · …"
  cuerpo: string;        // párrafo principal (sin tramos mono en el render actual)
  glosa: NotaSegmento[]; // línea "patrimonio bruto / comisión de venta"
}

// ── Puente esfuerzo-vs-plata (D11) ───────────────────────────────────────────
// Cuando la riqueza favorece a la corta pero el veredicto NO va a la corta, la
// nota afirmaba "esa brecha es la decisión" empujando contra el veredicto que el
// usuario acaba de leer, sin ninguna pieza que reconciliara las dos cosas. Acá
// se hace la cuenta que faltaba: la ventaja repartida entre las horas que el
// corto pide (auto-gestión) o contra lo que cuesta delegarlas (administrador).
// Rango 8-12 hrs/semana = el mismo dato canónico que usa el finding de gestión.
const HRS_SEMANA_MIN = 8;
const HRS_SEMANA_MAX = 12;

function buildPuenteEsfuerzo(
  strResults: ShortTermResult,
  brechaAFavorCorta: number,
  anios: number,
  currency: Currency,
  ufValue: number,
): string {
  const m = (v: number) => fmtMoney(v, currency, ufValue);
  const modoGestion = strResults.veredictoComparativo?.flipGestion?.modoActual ?? "auto";

  if (modoGestion === "admin") {
    // Con administrador no pones las horas: pagas por no ponerlas. El costo de
    // delegar sale de los dos modos que el motor ya calcula.
    const costoMensual = (strResults.comparativa?.str_auto?.noiMensual ?? 0) - (strResults.comparativa?.str_admin?.noiMensual ?? 0);
    if (costoMensual <= 0) return "";
    const costoHorizonte = costoMensual * 12 * anios;
    return ` Ojo con de dónde sale esa ventaja: cuenta con que un administrador opere el corto, y su comisión se lleva ${m(costoHorizonte)} en los mismos ${anios} años. Puesto uno contra otro, la ventaja se achica hasta donde ya no manda en la decisión.`;
  }

  const horasMin = HRS_SEMANA_MIN * 52 * anios;
  const horasMax = HRS_SEMANA_MAX * 52 * anios;
  const porHoraAlto = brechaAFavorCorta / horasMin;
  const porHoraBajo = brechaAFavorCorta / horasMax;
  if (!Number.isFinite(porHoraAlto) || porHoraAlto <= 0) return "";
  return ` Esa ventaja no es gratis: operar el corto tú mismo son entre ${horasMin.toLocaleString("es-CL")} y ${horasMax.toLocaleString("es-CL")} horas en ${anios} años. Repartida ahí, la diferencia queda entre ${m(porHoraBajo)} y ${m(porHoraAlto)} por cada hora que le pones — con eso en la mano, el veredicto de arriba deja de sonar contradictorio.`;
}

/**
 * Reproduce las derivaciones del chart (overlap capado a 10 años, riqueza =
 * activo + flujo acumulado, asimetría con LAS DOS series) solo en lo que la
 * anotación necesita. `null` cuando el chart no se dibuja (sin proyecciones).
 */
export function buildNotaPatrimonioChart(
  ltrResults: FullAnalysisResult,
  strResults: ShortTermResult,
  currency: Currency,
  ufValue: number,
): NotaPatrimonioChart | null {
  const ltrProj = ltrResults.projections ?? [];
  const strProj = strResults.projections ?? [];
  const overlap = Math.min(ltrProj.length, strProj.length, 10);
  if (overlap === 0) return null;

  const i = overlap - 1;
  const ltrRow = ltrProj[i];
  const strRow = strProj[i] as { year?: number; patrimonioNeto?: number | null; flujoAcumulado?: number } | undefined;
  const lastYear = ltrRow?.anio ?? strRow?.year ?? overlap;

  const activoLTR = ltrRow?.patrimonioNeto ?? null;
  const activoSTR = strRow?.patrimonioNeto ?? null;
  const activoFinal = activoLTR ?? 0;
  const activoSTRFinal = activoSTR ?? 0;
  // "En las dos modalidades" solo es cierto cuando el activo COINCIDE. Con
  // patrimonios distintos la frase contradecía a la card, que en ese caso
  // muestra "LARGA X · CORTA Y" (mismo criterio de igualdad que el finding).
  const activoIgual = activoSTR == null || patrimoniosIguales(activoFinal, activoSTRFinal);
  const riquezaLTRFinal = activoLTR !== null ? activoLTR + (ltrRow?.flujoAcumulado ?? 0) : 0;
  const riquezaSTRFinal = activoSTR != null ? activoSTR + (strRow?.flujoAcumulado ?? 0) : 0;
  const brecha = riquezaLTRFinal - riquezaSTRFinal;
  const ganadora = brecha >= 0 ? "renta larga" : "renta corta";

  const asimetria = hayAsimetriaDeEntrega(ltrResults.projections, ltrResults.metrics, strResults.projections);

  const valorActivoFinal = ltrProj[i]?.valorPropiedad ?? 0;
  const comisionVentaFinal = Math.round(valorActivoFinal * 0.02);

  const m = (v: number) => fmtMoney(v, currency, ufValue);

  // D11 — el puente solo aparece cuando hay tensión REAL: la riqueza favorece a
  // la corta y el veredicto de modalidad no la corona. Si ambos apuntan al mismo
  // lado no hay nada que reconciliar y la nota se queda corta, como estaba.
  const recomendacion = deriveRecomendacionFallback(strResults);
  const brechaFavoreceCorta = brecha < 0;
  const hayTension = brechaFavoreceCorta && recomendacion !== "STR_VENTAJA_CLARA";
  const puenteEsfuerzo =
    !asimetria && hayTension
      ? buildPuenteEsfuerzo(strResults, Math.abs(brecha), lastYear, currency, ufValue)
      : "";

  return {
    kicker: asimetria
      ? `AL AÑO ${lastYear} · SOLO RENTA LARGA`
      : `AL AÑO ${lastYear} · EL ACTIVO EMPATA, EL CAMINO NO`,
    cuerpo: asimetria
      ? `Acá va solo la renta larga: ${m(activoFinal)} de activo neto de deuda al año ${lastYear}, y ${m(riquezaLTRFinal)} descontando lo que pones de tu bolsillo por el camino. La renta corta no se dibuja porque este depto todavía no se entrega: con renta larga el crédito recién empieza a correr cuando lo recibas, y su proyección aún no descuenta esa espera. Superponerlas mostraría una brecha de punto de partida, no de modalidad.`
      : `${activoIgual
          ? `El depto se aprecia igual y la deuda se amortiza igual, arriendes corto o largo: ${m(activoFinal)} de activo neto de deuda en las dos modalidades.`
          : `El depto se aprecia casi igual arriendes corto o largo: ${m(activoFinal)} de activo neto de deuda en renta larga y ${m(activoSTRFinal)} en renta corta, una diferencia que la modalidad apenas mueve.`
        } Lo que cambia es cuánto pones de tu bolsillo por el camino. Descontándolo, terminas con ${m(riquezaLTRFinal)} en renta larga y ${m(riquezaSTRFinal)} en renta corta — ${m(Math.abs(brecha))} de diferencia a favor de la ${ganadora}. Eso es lo que te queda descontando lo que pusiste: la otra cara de la misma compra, no un patrimonio distinto.${puenteEsfuerzo}`,
    glosa: comisionVentaFinal > 0
      ? [
          { t: "Es patrimonio bruto: el activo menos la deuda. Si vendes, la comisión de venta (2%) resta " },
          { t: m(comisionVentaFinal), mono: true },
          { t: " de esa cifra." },
        ]
      : [{ t: "Es patrimonio bruto: el activo menos la deuda. La comisión de venta (2%) no está descontada." }],
  };
}

// ── Chart 2 · Volatilidad del flujo ──────────────────────────────────────────

/**
 * Caption completa del chart de flujo mensual (rango STR, promedio, fondo de
 * reserva). `null` cuando el chart no se dibuja (sin flujo estacional).
 */
export function buildNotaFlujoChart(
  ltrResults: FullAnalysisResult,
  strResults: ShortTermResult,
  currency: Currency,
  ufValue: number,
): NotaSegmento[] | null {
  const flujoEst = strResults.flujoEstacional ?? [];
  if (flujoEst.length === 0) return null;

  const ltrFlujo = ltrResults.metrics?.flujoNetoMensual ?? 0;
  const flujos = flujoEst.map((mes) => mes.flujo);
  const minSTR = Math.min(...flujos);
  const maxSTR = Math.max(...flujos);
  const rangoSTR = maxSTR - minSTR;
  const promedioSTR = flujos.reduce((s, v) => s + v, 0) / flujos.length;

  const m = (v: number) => fmtMoney(v, currency, ufValue);

  // Voz de las cards: con flujo negativo se dice "pones $X", nunca "$-X".
  // fmtMoney deja el signo dentro del monto ("$-206.961") y contradecía a la card
  // hermana, que en el mismo caso dice "pones $206.961" (68 de 71 pares del
  // parque tienen algún flujo negativo). fmtMoney no se toca: lo usa medio
  // producto; se corrige la voz acá, que es donde vive la contradicción.
  const pone = (v: number) => m(Math.abs(v));
  const negL = ltrFlujo < 0;
  const negProm = promedioSTR < 0;
  // Sin signo, el mes MEJOR y el PEOR se ordenan al revés: con flujos negativos
  // el máximo (menos negativo) es el mes bueno. Se nombran por lo que son, así el
  // rango se lee de menor a mayor esfuerzo en vez de "entre $193.462 y $97.870".
  const ambosNeg = maxSTR < 0;
  const ambosPos = minSTR >= 0;

  const rangoSegs: NotaSegmento[] = ambosNeg
    ? [
        { t: " Por día pones entre " },
        { t: pone(maxSTR), mono: true },
        { t: " en el mejor mes y " },
        { t: pone(minSTR), mono: true },
        { t: " en el peor" },
      ]
    : ambosPos
      ? [
          { t: " Por día te deja entre " },
          { t: pone(minSTR), mono: true },
          { t: " en el peor mes y " },
          { t: pone(maxSTR), mono: true },
          { t: " en el mejor" },
        ]
      : [
          { t: " Por día va desde poner " },
          { t: pone(minSTR), mono: true },
          { t: " en el peor mes hasta quedarte con " },
          { t: pone(maxSTR), mono: true },
          { t: " en el mejor" },
        ];

  return [
    // Siglas fuera (lector-30%): el usuario no sabe qué es "LTR"/"STR".
    { t: negL ? "Arrendarlo por mes te pide " : "Arrendarlo por mes te deja " },
    { t: pone(ltrFlujo), mono: true },
    { t: negL ? " de tu bolsillo casi todos los meses, parejo." : " casi constante mes a mes." },
    ...rangoSegs,
    { t: ` — ${m(rangoSTR)} de diferencia — con un promedio de ` },
    { t: pone(promedioSTR), mono: true },
    { t: negProm ? " de tu bolsillo." : " a tu favor." },
    { t: " La temporada manda: julio llena y febrero vacía, así que arrendar por día pide un colchón de 3 a 4 meses de gastos guardado." },
  ];
}
