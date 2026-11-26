// ─────────────────────────────────────────────────────────────────────────────
// EL MARCADOR DE LAS ESTACIONES DE METRO (26-nov-2026, entrega 2 › C, lámina 5c). UN SOLO MÓDULO: si algún día hace falta, se cambia
// el logo por un marcador neutro en UNA línea (MARCADOR_ESTACION).
// EL LOGO: el isotipo clásico del Metro de Santiago (los rombos rojos en el óvalo), «Santiago Metro logo.svg» de Wikimedia Commons
// (https://commons.wikimedia.org/wiki/File:Santiago_Metro_logo.svg; dominio público por umbral de originalidad, PD-textlogo, con aviso de
// marca registrada). Fabrizio aprobó usarlo SOLO como marcador de estación: va tal cual (el archivo no se modifica ni se recolorea),
// chico, sin texto al lado del logo más que el nombre de la estación.
// ─────────────────────────────────────────────────────────────────────────────

/** Qué marcador llevan las estaciones: el logo de Metro o un círculo neutro. Cambiarlo es esta línea. */
export const MARCADOR_ESTACION: "logo" | "neutro" = "logo";

/** El archivo del logo, servido tal cual (public/explorar). Sus proporciones originales: 180 × 150. */
export const LOGO_METRO = { src: "/explorar/metro-logo.svg", ancho: 180, alto: 150 } as const;
/** El ancho del logo en el mapa: chico, como marcador. */
export const ANCHO_LOGO_PX = 18;
/** El radio del marcador neutro. */
export const RADIO_NEUTRO_PX = 4;

/** Dibuja el marcador de una estación centrado en (x, y). Sin el logo cargado (o con el neutro elegido), el círculo neutro. */
export function dibujarEstacion(ctx: CanvasRenderingContext2D, x: number, y: number, logo: HTMLImageElement | null, claro: boolean): void {
  if (MARCADOR_ESTACION === "logo" && logo && logo.complete && logo.naturalWidth > 0) {
    const h = Math.round((ANCHO_LOGO_PX * LOGO_METRO.alto) / LOGO_METRO.ancho);
    ctx.drawImage(logo, Math.round(x - ANCHO_LOGO_PX / 2), Math.round(y - h / 2), ANCHO_LOGO_PX, h);
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, RADIO_NEUTRO_PX, 0, Math.PI * 2);
  ctx.fillStyle = claro ? "#FFFFFF" : "#1A1A1A";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = claro ? "#141414" : "#E6E6E6";
  ctx.stroke();
}
