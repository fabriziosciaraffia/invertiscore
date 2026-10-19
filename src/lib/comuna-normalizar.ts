// ─────────────────────────────────────────────────────────────────────────────
// El alias de comuna, SIN imports de servidor (19-oct-2026, LCP de la landing). `comunas-disponibles.ts` lo usa en el
// campo de la dirección del hero (cliente); lo importaba de `comuna-stats.ts`, que importa `observabilidad.ts`, que
// importa `@sentry/nextjs`: el SDK de Sentry entraba estático al primer paquete de la landing, antes del titular, aunque
// sentry.client.config.ts lo carga a propósito cuando la página está quieta. `comuna-stats.ts` lo reexporta: sigue siendo
// el ÚNICO mapa de alias del repo (21-sep-2026).
// ─────────────────────────────────────────────────────────────────────────────

// Alias de comuna (form/UI/prosa) -> forma canónica almacenada en scraped_properties.
// El form usa "Santiago Centro" pero la tabla guarda "Santiago"; un mismatch en
// .eq("comuna", ...) devuelve 0 filas. ÚNICO mapa de alias del repo (21-sep-2026): la mediana
// comunal, el benchmark de cap rate, la tabla de BDO, el guard de comunas de la prosa
// (`cifras-guard.ts`), el roster (`comunas-disponibles.ts`) y el universo STR pasan por acá.
// Había tres copias y «Santiago Centro» sin normalizar dejó 17 filas fuera del cruce con BDO.
// Extensible: agregar alias acá si aparecen.
export const COMUNA_ALIASES: Record<string, string> = {
  "Santiago Centro": "Santiago",
  // El prompt viejo le enseñó al modelo a escribir «Santiago centro» (minúscula).
  "Santiago centro": "Santiago",
};
export function normalizeComuna(comuna: string): string {
  return COMUNA_ALIASES[comuna] ?? comuna;
}
