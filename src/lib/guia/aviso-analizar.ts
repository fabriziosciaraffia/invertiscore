// ─────────────────────────────────────────────────────────────────────────────
// EL AVISO ANTES DE GASTAR UN ANÁLISIS (13-oct-2026, decisión de Fabrizio). En la página semanal y en la guía,
// «Analizar este» ya no genera nada de una: abre un aviso con el depto (comuna, tipología y precio) y lo que va a
// usar —«Usa 1 de tus N análisis.»—, con Analizar y Cancelar. Sin análisis, el mismo aviso ofrece el pack de tres
// (lib/tres-analisis.ts) y vuelve a la misma página después de pagar: ya no hay callejón «Ya usaste tus análisis.».
// Puro: el componente es components/guia/AvisoAntesDeAnalizar.tsx. Lo fija el tier CORREOS-RECORRIDO.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtCLP } from "@/lib/pricing";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { TRES_COPY, TRES_PRECIO_CLP } from "@/lib/tres-analisis";

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
  analizar: "Analizar",
  cancelar: "Cancelar",
  sin: `Para analizar este depto: 3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}, sin caducidad.`,
  comprar: TRES_COPY.boton,
} as const;

/** «Usa 1 de tus N análisis.» y sus casos: el último, el regalo, el plan, y sin número. */
export function textoUso(u: UsoAnalisis): string {
  switch (u.tipo) {
    case "con": return u.n === 1 ? "Usa tu último análisis." : `Usa 1 de tus ${u.n} análisis.`;
    case "regalo": return "Usa el análisis que va por cuenta de Franco.";
    case "plan": return "Tu plan está activo: no descuenta de tu saldo.";
    case "sin": return AVISO_ANALIZAR.sin;
    default: return "Usa 1 de tus análisis.";
  }
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** «Ñuñoa · 2D1B · UF 3.980»: la comuna, la tipología y el precio. */
export function lineaDepto(d: { comuna: string; tipologia: string | null; precioUF: number }): string {
  return [d.comuna, d.tipologia, `UF ${miles(d.precioUF)}`].filter(Boolean).join(" · ");
}
