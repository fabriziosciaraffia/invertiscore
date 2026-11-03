// ─────────────────────────────────────────────────────────────────────────────
// LOS COLORES DE LOS PINES (03-nov-2026, la pasada real de Fabrizio), EN TODOS LOS MAPAS: /explorar (Google Maps), el mapa del
// dashboard y de «Estás dentro» (el SVG sobre la imagen quieta, claro y oscuro: casa.css), el mapa chico de la tarjeta y de la
// vista previa de un enlace compartido (el marcador de Static Maps: calle.ts) y el número de las tarjetas de la selección.
//   · ✓ COMPRAR en el azul del chip Comprar; − AJUSTAR en la ciruela del chip Ajustar (ChipVeredicto.tsx, los tonos que
//     identifican a cada chip en cada tema: --chip-v-c y --chip-v-a); los YA ANALIZADOS en tinta con un ✓ blanco.
//   · EL ELEGIDO es el mismo color, más grande y con el anillo blanco más grueso.
//   · LOS GRUPOS (los números) siguen el color de su clase.
//   · ROJO EN NINGÚN PIN: el rojo queda para comprar, la oferta y el regalo. Hasta el 03-nov los que convienen iban en rojo y los
//     ya analizados en azul. Lo fija el tier EXPLORAR-PASADA, que compara estos valores con los del chip.
// Sin dependencias: lo leen el mapa del navegador, el servidor (Static Maps) y la imagen de la vista previa.
// ─────────────────────────────────────────────────────────────────────────────

export type ClasePin = "comprar" | "ajustar" | "analizado";
export type TemaPin = "claro" | "oscuro";

/** El relleno y lo que va encima (el número, el texto o el ✓), por tema. En oscuro, los del chip sobre fondo oscuro (el azul y
 *  la ciruela aclarados, con la letra oscura de su tono): el relleno oscuro del chip se perdería sobre el mapa oscuro. */
export const COLORES_PIN: Readonly<Record<TemaPin, Readonly<Record<ClasePin, { fondo: string; texto: string }>>>> = {
  claro: {
    comprar: { fondo: "#2B558F", texto: "#FFFFFF" },
    ajustar: { fondo: "#6E4560", texto: "#FFFFFF" },
    analizado: { fondo: "#0F0F0F", texto: "#FFFFFF" },
  },
  oscuro: {
    comprar: { fondo: "#8DB0E3", texto: "#0B1A2E" },
    ajustar: { fondo: "#D8AECA", texto: "#2A1622" },
    analizado: { fondo: "#0F0F0F", texto: "#FFFFFF" },
  },
};

/** El anillo de todo pin: blanco, de 2 px; el del elegido, de 3 px. */
export const ANILLO_PIN = "#FFFFFF";
export const ANILLO_PIN_PX = 2;
export const ANILLO_ELEGIDO_PX = 3;
/** Cuánto más grande es el elegido. */
export const ESCALA_ELEGIDO = 1.35;
/** La marca de los ya analizados. */
export const MARCA_ANALIZADO = "✓";

export const colorPin = (clase: ClasePin, tema: TemaPin): { fondo: string; texto: string } => COLORES_PIN[tema][clase];

/** El color para un marcador de Static Maps (`markers=color:0x2B558F|…`). */
export const colorStaticMaps = (hex: string): string => `0x${hex.replace("#", "").toUpperCase()}`;
