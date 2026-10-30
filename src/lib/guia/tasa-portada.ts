// ─────────────────────────────────────────────────────────────────────────────
// LA TASA ELEGIDA, EN LA PORTADA (30-oct-2026, goal «la tasa editable en Filtros»). El informe que sale de «Analizar este»
// con una tasa elegida —en Filtros, en el pop-up o en el perfil— se hace con ella y lo dice bajo el veredicto, con las
// palabras de Fabrizio: «Calculado con tu tasa, 4,5 % (tasa promedio sistema financiero: 4,07 %)». Con la tasa de hoy no
// dice nada. La tasa y la del motor de ese momento quedan en `input_data.origenAviso` (las rutas de analizar).
// ─────────────────────────────────────────────────────────────────────────────
/** «4,5», «4,07»: sin importar portal.ts (no entra al informe el código de Explorar). */
const tasaTexto = (t: number): string => t.toLocaleString("es-CL", { maximumFractionDigits: 2 });

export type TasaPortada = { elegida: number; mercado: number | null } | null;

/** La tasa elegida del informe, si la hubo (`input_data.origenAviso.tasaElegida`). */
export function tasaDePortada(inputData: unknown): TasaPortada {
  const o = (inputData as { origenAviso?: { tasaElegida?: unknown; tasaMercado?: unknown } } | null | undefined)?.origenAviso;
  const t = typeof o?.tasaElegida === "number" && o.tasaElegida > 0 ? o.tasaElegida : null;
  if (t == null) return null;
  const m = typeof o?.tasaMercado === "number" && o.tasaMercado > 0 ? o.tasaMercado : null;
  return { elegida: t, mercado: m };
}

/** «Calculado con tu tasa, 4,5 % (tasa promedio sistema financiero: 4,07 %)». */
export function lineaTasaPortada(t: NonNullable<TasaPortada>): string {
  return `Calculado con tu tasa, ${tasaTexto(t.elegida)} %${t.mercado != null ? ` (tasa promedio sistema financiero: ${tasaTexto(t.mercado)} %)` : ""}`;
}
