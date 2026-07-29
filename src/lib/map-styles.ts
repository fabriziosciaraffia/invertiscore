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

/**
 * Paleta light — neutros FRÍOS del design system (dirección "Galería").
 *
 * La versión anterior arrastraba los defaults de Google sin editar: el ámbar de
 * autopista (#f8d9a8) más una familia de grises cálidos, lo que teñía el mapa de
 * crema contra las cards blancas. Regla de marca: cero ámbar — la jerarquía se
 * resuelve con valor, no con color.
 *
 * Los hex espejan los tokens vivos de `globals.css` [data-theme="light"]:
 *   land         --franco-bg           #F6F6F7  (el lienzo bajo las cards)
 *   calles       --franco-card         #FFFFFF  (lo más claro = la trama vial)
 *   hairlines    --franco-border       #DDDDE1  (bordes, strokes y autopistas)
 *   labels       --franco-text-muted   #6B6B72
 *   labels vía   --franco-text-tertiary #6A6A71
 *
 * Jerarquía vial sin color: calles #FFFFFF (lo más claro del mapa) < land
 * #F6F6F7 < autopistas #DDDDE1. La autopista destaca por ser la cinta MÁS
 * oscura, no por ser la más saturada.
 *
 * Única excepción cromática: el agua queda azulada a propósito. Un mapa con agua
 * gris se lee roto — el azul acá es funcional (legibilidad), no decorativo.
 */
export const FRANCO_MAP_STYLE_LIGHT: FrancoMapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#F6F6F7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6B6B72" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#DDDDE1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#DDDDE1" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#DDDDE1" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6A6A71" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#CDD9DE" }] },
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

/**
 * Construye una URL completa para Google Static Maps con el estilo Franco
 * (dark o light). Sin markers — el caller dibuja los pins encima como
 * overlay SVG/HTML. Devuelve null si la API key no está disponible.
 *
 * Tamaños comunes:
 *   332×180 display + scale 2 → request 664×360 (ideal para hero mockup).
 */
export function getStaticMapUrl({
  lat,
  lng,
  zoom = 16,
  width,
  height,
  scale = 2,
  theme = "dark",
}: {
  lat: number;
  lng: number;
  zoom?: number;
  width: number;
  height: number;
  scale?: 1 | 2;
  theme?: FrancoMapTheme;
}): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const parts: string[] = [
    `center=${lat.toFixed(6)},${lng.toFixed(6)}`,
    `zoom=${zoom}`,
    `size=${width}x${height}`,
    `scale=${scale}`,
    "maptype=roadmap",
    ...francoMapStaticStyleParams(theme),
    `key=${apiKey}`,
  ];

  return `https://maps.googleapis.com/maps/api/staticmap?${parts.join("&")}`;
}
