// ─────────────────────────────────────────────────────────────────────────────
// LO QUE `/api/config` SIRVE AL PÚBLICO (13-oct-2026): una lista CERRADA de claves de la tabla `config`, las que
// el sitio lee desde el navegador. Hasta hoy el endpoint devolvía cualquier clave que le pidieran —con su valor y
// su fecha—, y en `config` también vive estado interno (el checkpoint del backfill de avisos).
//
// Cualquier otra clave —exista o no en la tabla— recibe el MISMO 404, y sin tocar la base: ni el cuerpo, ni el
// código, ni el tiempo de respuesta dicen si la clave existe. Lo que cambia la lista es que el navegador empiece
// a leer otra clave; el tier CONFIG-PUBLICA exige que la lista sea exactamente la que lee el código cliente.
// Puro: el tier lo prueba con un lector falso.
// ─────────────────────────────────────────────────────────────────────────────

/** Las claves que el navegador lee por `/api/config?key=` (hoy, solo el wizard: `useWizardV4Data`). */
export const CLAVES_CONFIG_PUBLICAS = ["tasa_hipotecaria"] as const;
export type ClaveConfigPublica = (typeof CLAVES_CONFIG_PUBLICAS)[number];

export function esClaveConfigPublica(key: string | null): key is ClaveConfigPublica {
  return key !== null && (CLAVES_CONFIG_PUBLICAS as readonly string[]).includes(key);
}

/** Si la fila faltara. `tasa_hipotecaria` va alineada con la referencia del motor (`MARKET_AVG_TASA_UF` en
 *  `financing-health.ts`): el wizard prellena la MISMA tasa contra la que el motor juzga, sin sesgo. El tier
 *  CONFIG-PUBLICA exige que coincidan. */
export const DEFAULTS_CONFIG_PUBLICA: Record<ClaveConfigPublica, string> = {
  tasa_hipotecaria: "4.1",
};

/** El cuerpo de toda clave que no se sirve: el mismo para la que no existe y para la que existe y es interna. */
export const CUERPO_NO_ENCONTRADA = { error: "No encontrada" } as const;

export type LectorConfig = (key: ClaveConfigPublica) => Promise<{ value: string; updated_at: string } | null>;

export async function respuestaConfig(
  key: string | null,
  leer: LectorConfig,
): Promise<{ status: 200; body: { key: ClaveConfigPublica; value: string; updated_at: string | null } } | { status: 404; body: typeof CUERPO_NO_ENCONTRADA }> {
  // Antes de leer la base: lo que no está en la lista no se consulta.
  if (!esClaveConfigPublica(key)) return { status: 404, body: CUERPO_NO_ENCONTRADA };
  const fila = await leer(key);
  return { status: 200, body: { key, value: fila?.value ?? DEFAULTS_CONFIG_PUBLICA[key], updated_at: fila?.updated_at ?? null } };
}
