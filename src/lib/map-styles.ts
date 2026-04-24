/**
 * Franco map styles — fuente única de verdad.
 *
 * Se consumen en dos formatos:
 *  - Google Maps JS API: arrays de MapTypeStyle (Drawer Zona / ZoneMap)
 *  - Google Static Maps API: parámetros `style=` URL (MapaThumbnail wizard)
 *
 * Si se ajusta la paleta, ambos consumidores quedan sincronizados automáticamente.
 */

type StylerEntry = Record<string, string | number>;
interface FrancoMapTypeStyle {
  featureType?: string;
  elementType?: string;
  stylers: StylerEntry[];
}

export const FRANCO_MAP_STYLE_DARK: FrancoMapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f0f0f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#a0a0a0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export const FRANCO_MAP_STYLE_LIGHT: FrancoMapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a5a56" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#e0e0dc" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e8e8e4" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8d9a8" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6a6a66" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8d6db" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export type FrancoMapTheme = "dark" | "light";

export function francoMapStyleForTheme(theme: FrancoMapTheme): FrancoMapTypeStyle[] {
  return theme === "light" ? FRANCO_MAP_STYLE_LIGHT : FRANCO_MAP_STYLE_DARK;
}

/**
 * Convierte un FrancoMapTypeStyle al formato de parámetro URL que acepta la
 * Static Maps API: `feature:X|element:Y|color:0xRRGGBB|visibility:off|...`.
 *
 * Static Maps requiere colores como `0xRRGGBB` (no `#RRGGBB`).
 */
function styleToStaticParam(style: FrancoMapTypeStyle): string {
  const parts: string[] = [];
  if (style.featureType) parts.push(`feature:${style.featureType}`);
  if (style.elementType) parts.push(`element:${style.elementType}`);
  for (const styler of style.stylers) {
    for (const [key, value] of Object.entries(styler)) {
      const v = typeof value === "string" && value.startsWith("#")
        ? value.replace("#", "0x")
        : value;
      parts.push(`${key}:${v}`);
    }
  }
  return parts.join("|");
}

/**
 * Devuelve un array de strings de la forma `style=feature:X|color:0xRRGGBB|...`
 * listos para concatenar a la URL de Static Maps (con `&`).
 *
 * No URL-encodea: Static Maps acepta los pipes y colons crudos y la URL es más
 * corta que encodeada (importante por el límite de 8KB por request).
 */
export function francoMapStaticStyleParams(theme: FrancoMapTheme): string[] {
  const styles = francoMapStyleForTheme(theme);
  return styles.map((s) => `style=${styleToStaticParam(s)}`);
}
