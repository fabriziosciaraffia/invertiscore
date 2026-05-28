/**
 * Cobertura geográfica de Franco (beta).
 *
 * Hoy Franco solo analiza departamentos del Gran Santiago. Esta es la fuente
 * de verdad única para decidir si una comuna está cubierta — la usan la
 * validación del wizard (paso 1), copys de landing/checkout y cualquier gate
 * futuro. NO duplicar la lista en otros archivos: importar desde aquí.
 *
 * Reconciliación con el dataset (`src/lib/comunas.ts`):
 *  - El dataset interno llama "Santiago Centro" a la comuna que Google Places
 *    devuelve como "Santiago". Ambos nombres mapean a la misma comuna cubierta
 *    vía COMUNA_ALIASES.
 *  - El resto de los nombres coinciden con el dataset (acentos incluidos).
 */

export const COMUNAS_DISPONIBLES = [
  "Santiago",
  "Providencia",
  "Las Condes",
  "Vitacura",
  "Lo Barnechea",
  "Ñuñoa",
  "La Reina",
  "Macul",
  "Peñalolén",
  "La Florida",
  "San Joaquín",
  "Maipú",
  "Pudahuel",
  "Cerrillos",
  "Estación Central",
  "Quinta Normal",
  "Independencia",
  "Recoleta",
  "Huechuraba",
  "Conchalí",
  "Quilicura",
  "San Miguel",
  "La Cisterna",
  "Puente Alto",
] as const;

export type ComunaDisponible = (typeof COMUNAS_DISPONIBLES)[number];

/**
 * Normaliza para comparar: minúsculas, sin acentos, sin espacios extra.
 * "Ñuñoa" -> "nunoa", "  ESTACIÓN  CENTRAL " -> "estacion central".
 *
 * El rango \u0300-\u036f (combining diacritical marks) se escapa a propósito:
 * son caracteres invisibles y la versión literal es imposible de revisar.
 */
function normalizar(comuna: string): string {
  return comuna
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alias normalizados -> comuna disponible canónica (normalizada).
 * Cubre las distintas formas en que una misma comuna puede llegar
 * (Google Places vs dataset interno).
 */
const COMUNA_ALIASES: Record<string, string> = {
  "santiago centro": "santiago",
};

const DISPONIBLES_NORMALIZADAS = new Set(COMUNAS_DISPONIBLES.map(normalizar));

/**
 * ¿Franco analiza esta comuna hoy? Tolerante a acentos, mayúsculas y al alias
 * "Santiago Centro" / "Santiago". Devuelve false para null/undefined/"".
 */
export function isComunaDisponible(comuna: string | null | undefined): boolean {
  if (!comuna) return false;
  const n = normalizar(comuna);
  const canon = COMUNA_ALIASES[n] ?? n;
  return DISPONIBLES_NORMALIZADAS.has(canon);
}
