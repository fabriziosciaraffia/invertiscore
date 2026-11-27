// La asesoría en el mapa (27-nov-2026): sin dependencias, para que el código del mapa no arrastre la lista de estaciones.
/** Cómo se dibujan las marcas de «Dónde» en el mapa (polígonos nativos, no pines): la comuna elegida en el azul de Comprar, el
 *  límite de las demás en gris. */
export const ESTILO_MARCAS = {
  elegida: { trazo: "#2B558F", relleno: "#2B558F", opacidad: 0.16 },
  otra: { trazo: "#9A9AA0" },
} as const;
