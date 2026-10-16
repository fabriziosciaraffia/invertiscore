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
} as const;

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

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

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

const pctTexto = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Lo que se destaca en el aviso: que el análisis va con SU pie y SU plazo, «Con el pie de 20% y el plazo de 25 años de
 *  tu perfil» (texto de Fabrizio, 13-oct-2026; igual en la página semanal y en la guía). Las cifras van en negrita (el
 *  componente); `texto` es la frase entera. */
export function destacadoCombinacion(combo: { piePct: number; plazoAnios: number }) {
  const pie = `${pctTexto(combo.piePct)}%`, plazo = `${combo.plazoAnios} años`;
  return { pie, plazo, texto: `Con el pie de ${pie} y el plazo de ${plazo} de tu perfil` };
}
