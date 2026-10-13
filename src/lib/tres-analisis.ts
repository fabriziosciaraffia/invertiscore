// ─────────────────────────────────────────────────────────────────────────────
// TRES ANÁLISIS POR $19.990, PARA QUIEN TIENE CUENTA (13-oct-2026, decisión de Fabrizio). Se ofrece en el dashboard,
// en el aviso antes de gastar un análisis («Analizar este» sin análisis disponibles), en la página del correo semanal
// en lugar de «Analizar uno · $9.990», y en una línea del correo semanal a quien no tiene análisis (por el clic, con
// `ir=tres`; el `ir=comprar` de los correos ya enviados sigue llevando al suelto que esos correos ofrecían). Otorga 3
// créditos sin caducidad (payments/confirm). Solo con sesión (payments/create).
//
// NO es el ticket de $14.990 (`pack3`, lib/lo-que-sigue/oferta-pack.ts): ese sigue siendo solo del usuario nuevo en
// sus primeras 24 horas, atado a su primer informe. Y el regalo de un análisis a los 14 días no cambia.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtCLP } from "@/lib/pricing";

export const PRODUCTO_TRES = "tres_analisis" as const;
export const TRES_CANTIDAD = 3;
export const TRES_PRECIO_CLP = 19_990;

/** De dónde se compró: el dashboard, el correo semanal (y su página), el aviso inmediato (su página) o la guía. El aviso
 *  antes de gastar compra con el origen de la página donde se abre. */
export const ORIGENES_TRES = ["dashboard", "semanal", "inmediato", "guia"] as const;
export type OrigenTres = (typeof ORIGENES_TRES)[number];
export const esOrigenTres = (o: unknown): o is OrigenTres => typeof o === "string" && (ORIGENES_TRES as readonly string[]).includes(o);

/** Adónde vuelve después de pagar: solo un camino del propio sitio (empieza con una barra, sin «//» ni esquema). */
export function volverSeguro(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || /[\\\s]|^\/[^/]*:/.test(v) || v.length > 300) return null;
  return v;
}

/** El checkout del pack, con su origen (y la variante del correo, y adónde volver). */
export function rutaTres(origen: OrigenTres, opts: { variante?: "banda" | "tarjetas" | null; volver?: string | null } = {}): string {
  const p = new URLSearchParams({ product: PRODUCTO_TRES, origen });
  if (opts.variante) p.set("variante", opts.variante);
  const v = volverSeguro(opts.volver);
  if (v) p.set("volver", v);
  return `/checkout?${p.toString()}`;
}

export const TRES_COPY = {
  boton: `3 análisis · ${fmtCLP(TRES_PRECIO_CLP)}`,
  /** La línea del correo semanal para quien no tiene análisis: el enlace va en «3 análisis por $19.990». */
  lineaCorreo: { antes: "Para analizarlos: ", enlace: `3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}`, despues: ", sin caducidad." },
  titulo: "Franco — 3 análisis",
  subtitulo: "3 análisis, sin caducidad",
  listo: "Listo: tienes 3 análisis más.",
  seguir: "Seguir",
} as const;
