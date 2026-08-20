// ─────────────────────────────────────────────────────────────────────────
// ROSTER DE COMUNAS PUBLICADAS — fuente única de verdad.
//
// Qué comunas tienen página pública es DECISIÓN DE PRODUCTO, no un resultado
// del scraping. Agregar o quitar una comuna es editar esta lista a mano.
//
// Antes el roster EMERGÍA del dato: `comunas-seo.ts` publicaba la comuna solo
// si superaba sus umbrales (≥20 arriendos y ≥20 ventas en algún segmento,
// ≥50 propiedades totales). Con eso, una semana de scraping flojo bajaba a una
// comuna del umbral y su URL —ya indexada por Google— pasaba a 404 y
// desaparecía del sitemap sin que nadie se enterara. Un 404 en una URL recién
// indexada es señal de calidad negativa para todo el dominio.
//
// Ahora la separación es explícita:
//   · esta lista decide QUÉ páginas existen (siempre responden 200);
//   · los umbrales de `comunas-seo.ts` deciden QUÉ DATOS se muestran adentro.
// Sin datos suficientes la página degrada (omite las cifras), nunca 404.
//
// El `slug` es `slugify(nombre)` (ver `@/lib/utils`) — es la forma en que
// `comunas-seo.ts` arma su propio slug, así que ambos tienen que calzar para
// que la comuna encuentre sus datos. Los 25 slugs de acá son exactamente los
// que servía el sitemap de producción al 20-ago-2026.
// ─────────────────────────────────────────────────────────────────────────

export const COMUNAS_ROSTER = [
  { slug: "cerrillos", nombre: "Cerrillos" },
  { slug: "conchali", nombre: "Conchalí" },
  { slug: "estacion-central", nombre: "Estación Central" },
  { slug: "huechuraba", nombre: "Huechuraba" },
  { slug: "independencia", nombre: "Independencia" },
  { slug: "la-cisterna", nombre: "La Cisterna" },
  { slug: "la-florida", nombre: "La Florida" },
  { slug: "la-reina", nombre: "La Reina" },
  { slug: "las-condes", nombre: "Las Condes" },
  { slug: "lo-barnechea", nombre: "Lo Barnechea" },
  { slug: "macul", nombre: "Macul" },
  { slug: "maipu", nombre: "Maipú" },
  { slug: "nunoa", nombre: "Ñuñoa" },
  { slug: "penalolen", nombre: "Peñalolén" },
  { slug: "providencia", nombre: "Providencia" },
  { slug: "pudahuel", nombre: "Pudahuel" },
  { slug: "puente-alto", nombre: "Puente Alto" },
  { slug: "quilicura", nombre: "Quilicura" },
  { slug: "quinta-normal", nombre: "Quinta Normal" },
  { slug: "recoleta", nombre: "Recoleta" },
  { slug: "renca", nombre: "Renca" },
  { slug: "san-joaquin", nombre: "San Joaquín" },
  { slug: "san-miguel", nombre: "San Miguel" },
  { slug: "santiago", nombre: "Santiago" },
  { slug: "vitacura", nombre: "Vitacura" },
] as const;

/** Slugs con página pública. Cualquier otro slug es 404 legítimo. */
export type ComunaSlug = (typeof COMUNAS_ROSTER)[number]["slug"];

/** Nombre canónico (con acentos) de una comuna del roster. */
export type ComunaNombre = (typeof COMUNAS_ROSTER)[number]["nombre"];

const PorSlug: ReadonlyMap<string, ComunaNombre> = new Map(
  COMUNAS_ROSTER.map((c) => [c.slug, c.nombre])
);

/** Narrowing: `true` solo para los slugs del roster. */
export function esComunaDelRoster(slug: string): slug is ComunaSlug {
  return PorSlug.has(slug);
}

/** Nombre canónico del slug. Devuelve null fuera del roster. */
export function nombreDeComuna(slug: string): ComunaNombre | null {
  return PorSlug.get(slug) ?? null;
}
