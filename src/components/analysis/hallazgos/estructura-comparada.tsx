"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ESTRUCTURA COMPARADA — superficie única para los dos cuerpos de estructura de
// financiamiento (13 financiamiento STR · L2 estructura LTR).
//
// AUDITORÍA fase42 D-13/L2: ambos cuerpos habían degradado la comparación a
// KPIs pelados + prosa que narraba el veredicto de la tasa ("Tu tasa está bajo
// el promedio…") — el mockup 13 la pide DIBUJADA: barras apareadas para la tasa
// contra su referencia real (el promedio de mercado, con chip de juicio), y el
// pie como barra propia SIN fila de referencia fija — su contexto lo da la
// escalera, calculado nivel por nivel, no un "óptimo" declarado.
//
// Escalas honestas, no decorativas: el pie ES un porcentaje del precio, así que
// su barra usa la escala natural 0-100. La tasa usa la escala del par (el mayor
// llena, el otro queda proporcional). La cuota es una fila de dato (barra llena
// del mockup = sin información): va como valor, no como barra.
//
// Vive en módulo propio por la misma razón que escalera-pie: AnalysisDrawer y
// DrawersPropios no se importan entre sí, y las dos superficies no pueden
// divergir.
// ─────────────────────────────────────────────────────────────────────────────

import { CmpPares, type ParCmp } from "./vocabulario";

const pct1 = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function EstructuraComparada({
  piePct,
  tasaPct,
  tasaMarketPct,
  cuotaFmt,
  pie,
}: {
  piePct: number;
  tasaPct: number;
  tasaMarketPct: number;
  /** Cuota mensual ya formateada por el caller (dueño de moneda y UF). */
  cuotaFmt: string;
  /** Nota al pie del diagrama (opcional). */
  pie?: string;
}) {
  // Juicio de la tasa con la MISMA convención round-una-vez de la fraseCanonica
  // del hallazgo: spread sobre tasas ya redondeadas a 1 decimal.
  const t = Math.round(tasaPct * 10) / 10;
  const m = Math.round(tasaMarketPct * 10) / 10;
  const spreadPb = Math.round((t - m) * 100);
  const tagTasa: ParCmp["tag"] =
    Math.abs(spreadPb) <= 25
      ? { texto: "en línea", tono: "par" }
      : spreadPb > 0
        ? { texto: "el punto flojo", tono: "flojo" }
        : { texto: "bajo el promedio", tono: "ok" };

  const escalaPar = (valor: number, contra: number) => {
    const max = Math.max(valor, contra);
    return max > 0 ? (valor / max) * 100 : 0;
  };

  const filas: ParCmp[] = [
    {
      k: "Pie",
      sub: "su efecto, calculado nivel por nivel, está en la escalera",
      tuyo: { lbl: "tuyo", v: `${Number.isInteger(piePct) ? piePct : pct1(piePct)}%`, pct: Math.max(0, Math.min(100, piePct)) },
    },
    {
      k: "Tasa",
      tag: tagTasa,
      tuyo: { lbl: "tuya", v: `${pct1(tasaPct)}%`, pct: escalaPar(tasaPct, tasaMarketPct) },
      ref: { lbl: "mercado", v: `${pct1(tasaMarketPct)}%`, pct: escalaPar(tasaMarketPct, tasaPct) },
    },
    {
      k: "Cuota mensual",
      tuyo: { lbl: "hoy", v: cuotaFmt, pct: 100 },
    },
  ];

  return <CmpPares filas={filas} pie={pie} />;
}
