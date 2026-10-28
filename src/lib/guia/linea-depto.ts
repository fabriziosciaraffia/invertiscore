// ─────────────────────────────────────────────────────────────────────────────
// LA LÍNEA DE CADA DEPTO (28-oct-2026, decisión de Fabrizio): «Las Condes · 2D2B · 77 m²» y, si el aviso dice si es nuevo o
// usado, « · Usado» o « · Nuevo» al final, del mismo tamaño y color que el resto de la línea —sin etiqueta ni color propio—.
// Si el aviso no lo dice, no se pone nada (nunca se supone). La misma línea en todas las fichas de un depto: «Estás dentro»,
// el dashboard, Explorar (la tarjeta y la hoja del pin), el correo semanal y el del día (y la selección diaria, que usa su
// tarjeta) y la tarjeta del pop-up de «Analizar este». La condición sale de `scraped_properties.condicion` (el listado:
// obra nueva o usado); el año de construcción no es lo que decide. Lo prueba el tier NUEVO-USADO.
// ─────────────────────────────────────────────────────────────────────────────

export type CondicionDepto = "nuevo" | "usado";

/** La condición tal como viene del aviso; cualquier otra cosa (null, vacío, un valor raro) es «no la dice». */
export function condicionDe(c: unknown): CondicionDepto | undefined {
  return c === "nuevo" || c === "usado" ? c : undefined;
}

/** La palabra de la línea, o null si el aviso no la dice. */
export function palabraCondicion(c: unknown): "Nuevo" | "Usado" | null {
  const k = condicionDe(c);
  return k === "nuevo" ? "Nuevo" : k === "usado" ? "Usado" : null;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** «Las Condes · 2D2B · 77 m² · Usado» (sin la condición, sin la última parte). */
export function lineaDepto(d: { comuna?: string | null; tipologia?: string | null; m2: number; condicion?: unknown }): string {
  return [d.comuna, d.tipologia, `${miles(d.m2)} m²`, palabraCondicion(d.condicion)].filter(Boolean).join(" · ");
}
