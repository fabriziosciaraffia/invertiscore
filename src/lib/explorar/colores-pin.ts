// ─────────────────────────────────────────────────────────────────────────────
// LOS COLORES DE LOS PINES (03-nov-2026, la pasada real de Fabrizio), EN TODOS LOS MAPAS: /explorar (Google Maps), el mapa del
// dashboard y de «Estás dentro» (el SVG sobre la imagen quieta, claro y oscuro: casa.css), el mapa chico de la tarjeta y de la
// vista previa de un enlace compartido (el marcador de Static Maps: calle.ts) y el número de las tarjetas de la selección.
//   · ✓ COMPRAR en el azul del chip Comprar; − AJUSTAR en la ciruela del chip Ajustar (ChipVeredicto.tsx, los tonos que
//     identifican a cada chip en cada tema: --chip-v-c y --chip-v-a); los YA ANALIZADOS en tinta con un ✓ blanco.
//   · EL ELEGIDO es el mismo color, más grande y con el anillo blanco más grueso.
//   · LOS GRUPOS (los números) siguen el color de su clase.
//   · ROJO: BOTÓN PRINCIPAL Y VEREDICTO NO CONVIENE (acta del 25-nov-2026, decisión 1 de Fabrizio para el mapa con todos los deptos;
//     reemplaza a «rojo en ningún pin» del 03-nov). El mapa de /explorar muestra los usados con veredicto en tres colores: Comprar
//     azul, Ajustar ciruela y No conviene en el rojo del chip BUSCAR OTRA (--chip-v-b). El rojo de un pin dice siempre «no conviene a
//     este precio»: ningún otro pin ni grupo lo usa (los grupos van en tinta). Fuera de los pines, el rojo sigue siendo del botón
//     principal (comprar, la oferta, el regalo). Lo fija el tier EXPLORAR-TODOS, que compara estos valores con los del chip; el
//     invariante viejo de EXPLORAR-PASADA se reescribió con esta acta.
//     Hasta el 03-nov los que convienen iban en rojo y los ya analizados en azul; del 03 al 25-nov ningún pin fue rojo.
// Sin dependencias: lo leen el mapa del navegador, el servidor (Static Maps) y la imagen de la vista previa.
// ─────────────────────────────────────────────────────────────────────────────

// «no» (25-nov-2026): No conviene, en el rojo del chip BUSCAR OTRA. Lo usa solo /explorar (el mapa con todos los deptos); el mapa
// del dashboard y el de la landing siguen con azul, ciruela y tinta.
export type ClasePin = "comprar" | "ajustar" | "analizado" | "no";
export type TemaPin = "claro" | "oscuro";

/** El relleno y lo que va encima (el número, el texto o el ✓), por tema. En oscuro, los del chip sobre fondo oscuro (el azul y
 *  la ciruela aclarados, con la letra oscura de su tono): el relleno oscuro del chip se perdería sobre el mapa oscuro. */
export const COLORES_PIN: Readonly<Record<TemaPin, Readonly<Record<ClasePin, { fondo: string; texto: string }>>>> = {
  claro: {
    comprar: { fondo: "#2B558F", texto: "#FFFFFF" },
    ajustar: { fondo: "#6E4560", texto: "#FFFFFF" },
    analizado: { fondo: "#0F0F0F", texto: "#FFFFFF" },
    no: { fondo: "#C8323C", texto: "#FFFFFF" },
  },
  oscuro: {
    comprar: { fondo: "#8DB0E3", texto: "#0B1A2E" },
    ajustar: { fondo: "#D8AECA", texto: "#2A1622" },
    analizado: { fondo: "#0F0F0F", texto: "#FFFFFF" },
    no: { fondo: "#F0858C", texto: "#3A0D11" },
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
