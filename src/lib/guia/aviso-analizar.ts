// ─────────────────────────────────────────────────────────────────────────────
// EL AVISO ANTES DE GASTAR UN ANÁLISIS (13-oct-2026, decisión de Fabrizio). En la página semanal y en la guía,
// «Analizar este» ya no genera nada de una: abre un aviso con el depto —los datos del pop-up del wizard, con el pie y
// el plazo de la persona destacados (derivadosAviso)— y lo que va a usar —«Usa 1 de tus N análisis.»—, con Analizar y
// Cancelar. Sin análisis, el mismo aviso ofrece el pack de tres
// (lib/tres-analisis.ts) y vuelve a la misma página después de pagar: ya no hay callejón «Ya usaste tus análisis.».
// Puro: el componente es components/guia/AvisoAntesDeAnalizar.tsx. Lo fija el tier CORREOS-RECORRIDO.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtCLP } from "@/lib/pricing";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { formatearNumero, formatearPct } from "@/lib/plausibilidad";
import { calcDividendo } from "@/components/formulario-v4/helpers-wizard";
import { TRES_COPY, TRES_PRECIO_CLP } from "@/lib/tres-analisis";
import { REGALO_COPY } from "@/lib/regalo-alta";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pctTexto = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Lo que el aviso sabe del saldo: el estado de la casa, o «desconocido» cuando la pantalla no tiene el número. */
export type UsoAnalisis = EstadoSaldo | { tipo: "desconocido" };

/** Desde un saldo numérico (la guía): `null` = no se sabe; 0 o menos = no le quedan. */
export function usoDesdeSaldo(n: number | null | undefined): UsoAnalisis {
  if (n == null) return { tipo: "desconocido" };
  return n <= 0 ? { tipo: "sin" } : { tipo: "con", n, noVencen: false };
}

export const AVISO_ANALIZAR = {
  titulo: "¿Analizar este depto?",
  tituloSin: "No te quedan análisis",
  modalidad: "Renta larga",
  /** El bloque de renta corta del semanal (14-oct-2026). La última línea es la misma que en renta larga, «Usa 1 de tus N
   *  análisis», sin condición (15-oct-2026): la página no habla del cobro. */
  modalidadCorta: "Renta corta",
  analizar: "Analizar",
  cancelar: "Cancelar",
  sin: `Para analizar este depto: 3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}, sin caducidad.`,
  comprar: TRES_COPY.boton,
  /** La tarjeta gris del depto (D1): qué incluye el informe. En D2, la frase corta. */
  incluye: { antes: "El informe completo incluye ", fuerte: "el enlace a la publicación", despues: ", para que lo veas y contactes a quien lo vende." },
  incluyeCorto: ".",
  /** Sin saldo (A): la tarjeta dice para qué. */
  paraAnalizar: "Para analizar este depto:",
  sinRecalculo: "No pudimos recalcular con esa combinación. Prueba otra.",
} as const;

// ── EL POP-UP RECALCULA (23-oct-2026, mockups D1 y D2 de `docs/puerta-b-mockups/4-ticket-y-popups.html`, decisión de Fabrizio) ──
// Como se abre: la tarjeta gris del depto (comuna · tipología · m² · precio, el veredicto y el flujo, qué incluye el
// informe), «Con pie de 20 % y plazo de 25 años · Cambiar», el dividendo y el retorno, qué gasta, «Analizar». Al tocar
// Cambiar: los selectores de pie y plazo, el veredicto se recalcula al tiro y, si cambia, la tarjeta del cambio, la casilla
// «Guardar … como mi perfil de búsqueda» y «Analizar igual» si empeora. Las listas, el texto del cambio y la ruta de
// recálculo son los de Explorar (lib/explorar/explorar.ts, una sola API desde el 23-oct-2026); acá viven el copy del
// cuerpo, la línea del veredicto y la regla de NUNCA COBRAR SIN EL VEREDICTO RECALCULADO. Lo fija el tier PUERTA-B-MOCKUPS.

/** «Comprar 88 · flujo +$88.363 te queda» (la segunda línea de la tarjeta gris). */
export function lineaVeredicto(e: { veredicto: string | null | undefined; score: number | null | undefined; flujo: number | null | undefined } | null): string | null {
  if (!e?.veredicto) return null;
  const v = `${etiquetaVeredicto(e.veredicto, "frase")}${e.score != null ? ` ${e.score}` : ""}`;
  return e.flujo == null ? v : `${v} · flujo ${textoFlujo(e.flujo)}`;
}

/** «+$88.363 te queda» / «−$45.120 de tu bolsillo». */
export function textoFlujo(flujo: number): string {
  return flujo < 0 ? `−$${miles(Math.abs(flujo))} de tu bolsillo` : `+$${miles(flujo)} te queda`;
}

/** NUNCA SE COBRA SIN EL VEREDICTO RECALCULADO: con una combinación distinta de la de la selección, mientras recalcula o si
 *  no llegó (o no pudo), «Analizar» no se puede tocar. Sin saldo no aplica (ahí el botón compra). */
export function bloqueaAnalizar(p: { sin: boolean; esBase: boolean; recalculando: boolean; evaluacion: unknown }): boolean {
  return !p.sin && !p.esBase && (p.recalculando || p.evaluacion == null);
}

/** «Usa 1 de tus N análisis.» y sus casos: el último, el regalo, el plan, y sin número. EL REGALO SE DICE (16-oct-2026):
 *  si el que se va a gastar es un regalo —todo lo que tiene, o el que vence primero—, «Usa tu análisis de regalo.». */
export function textoUso(u: UsoAnalisis): string {
  switch (u.tipo) {
    case "con": return u.proximoRegalo ? REGALO_COPY.usaRegalo : REGALO_COPY.usaUnoDe(u.n);
    case "regalo": return REGALO_COPY.usaRegalo;
    case "plan": return "Tu plan Ilimitado está activo: no descuenta de tu saldo.";
    case "sin": return AVISO_ANALIZAR.sin;
    default: return "Usa 1 de tus análisis.";
  }
}

/**
 * LOS DATOS DEL AVISO, COMO EN EL POP-UP DEL WIZARD (13-oct-2026, pedido de Fabrizio): el aviso antes de gastar monta
 * el mismo modal de confirmación del wizard (ModalPlausibilidad, estado limpio) con lo que el wizard muestra —precio por
 * m², pie, dividendo, retorno bruto—, más el precio y la superficie, y destacando que va con el pie y el plazo de la
 * persona. Los mismos formateadores (lib/plausibilidad) y el mismo dividendo (helpers-wizard › calcDividendo). Sin la
 * tasa, la UF o el arriendo, la celda dice «—»: no se inventa.
 */
export interface FinanzasAviso {
  tasa: number | null;
  uf: number | null;
  /** El arriendo con que Franco evaluó el aviso (avisos_evaluados). */
  arriendo: number | null;
}

export function derivadosAviso(
  d: { precioUF: number; m2: number },
  combo: { piePct: number; plazoAnios: number },
  f: FinanzasAviso,
): Array<{ label: string; valor: string }> {
  const uf = f.uf != null && f.uf > 0 ? f.uf : null;
  const cuota = uf && f.tasa != null && f.tasa > 0 ? calcDividendo(d.precioUF, combo.piePct, combo.plazoAnios, f.tasa, uf) : 0;
  const retorno = uf && f.arriendo != null && f.arriendo > 0 && d.precioUF > 0 ? (f.arriendo * 12) / (d.precioUF * uf) : 0;
  return [
    { label: "Precio", valor: `UF ${miles(d.precioUF)}` },
    { label: "Precio por m²", valor: d.m2 > 0 ? `${formatearNumero(d.precioUF / d.m2)} UF/m²` : "—" },
    { label: "Superficie", valor: d.m2 > 0 ? `${miles(d.m2)} m²` : "—" },
    { label: "Pie", valor: `UF ${miles((d.precioUF * combo.piePct) / 100)}` },
    { label: "Dividendo", valor: cuota > 0 ? `${fmtCLP(cuota)}/mes` : "—" },
    { label: "Retorno bruto", valor: retorno > 0 ? `${formatearPct(retorno)} anual` : "—" },
  ];
}

