// Canon visual del reel, en píxeles de lienzo (1080×1920).
//
// La geometría viene del prototipo `ref/carrera-comunas-v2.html` de Fabrizio, escalada
// ×2,667 desde su preview de 405×720, con dos correcciones deliberadas:
//
//  1. DIRECCIÓN LIGHT. El v2 es sobre Ink; la dirección aprobada es papel. Los neutros
//     salen del prototipo light (`carrera-lineas-v4-light.html`).
//  2. ZONAS SEGURAS DE INSTAGRAM. El riel derecho (120px) y la franja inferior (400px)
//     quedan libres de contenido. En el v2 el sello caía bajo la UI de IG; acá el
//     bloque de pie termina en y=1520 y el año gigante vive dentro del gráfico, en el
//     triángulo vacío de abajo a la derecha — que es donde el canon FT lo pone.
//
// Cromática: la marca tiene DOS colores (Ink y Signal Red) y resuelve jerarquía con
// escala de grises. Por eso las barras no son un arcoíris como en el prototipo: la
// protagonista va en rojo, "las más caras" del titular en gris medio y el resto en Ink.

export const LIENZO = { w: 1080, h: 1920 } as const;
export const FPS = 30;

/** Guion aprobado: hook · arranque lento · carrera · payoff. */
export const GUION = { hook: 60, arranque: 120, carrera: 420, total: 480 } as const;

export const COLOR = {
  papel: "#F7F5F0",
  ink: "#0F0F0F",
  gris: "#6B6B72",
  grisSuave: "#9A9A9A",
  rojo: "#C8323C",
  grilla: "rgba(15,15,15,0.07)",
} as const;

/** Zonas que la UI de Instagram tapa. Nada legible entra acá. */
export const SEGURO = { derecha: 128, abajo: 400 } as const;

export const PISTA = {
  /** Cuántas barras se ven a la vez. */
  n: 8,
  x: 48,
  ancho: LIENZO.w - 48 - SEGURO.derecha, // 904
  topeEje: 440,
  altoEje: 44,
  altoFila: 94,
  altoBarra: 74,
  radio: 8,
  /** Sobre este ancho de barra la etiqueta se mete adentro. */
  minEtiquetaDentro: 315,
  /** Piso del eje: sin él, el 2015 (todo en 0%) daría una escala degenerada. */
  pisoEje: 12,
} as const;

export const filaY = (rango: number) => PISTA.topeEje + PISTA.altoEje + rango * PISTA.altoFila;
