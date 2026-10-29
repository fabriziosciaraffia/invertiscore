// ─────────────────────────────────────────────────────────────────────────────
// EL HERO DE LA LANDING CON LAS DOS PUERTAS: los textos y el enlace a /explorar con la llegada. Entró el 29-oct-2026 con el
// mapa como hero (opción 3 de docs/puerta-b-mockups/7-landing-puertas.html); desde el 30-oct-2026 el hero es el limpio
// (7c-landing-limpia.html) y el mapa del hero se retiró con sus grupos (`gruposDeLanding`) y su dibujo. SIN DEPENDENCIAS a
// propósito: lo usa el servidor de la landing y nada de esto debe arrastrar código al primer pintado. Lo demás de la puerta
// E vive en abierto.ts, que reexporta esto.
// ─────────────────────────────────────────────────────────────────────────────

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** El hero lleva a /explorar con `?desde=landing` («Verlos en el mapa →»): así se separan, en el panel por puerta, las visitas
 *  que llegan desde la landing de las que llegan directo. */
export const DESDE_LANDING = "landing";
export const HREF_DESDE_LANDING = `/explorar?desde=${DESDE_LANDING}`;

/** Lo revisado anoche, hacia abajo a miles: «+21.000» con 21.247 revisados. Nunca promete más de lo medido. */
export const pisoDeMiles = (n: number) => Math.floor(n / 1000) * 1000;

/** Los textos del hero, en el orden del mockup. Los números salen de la noche: `revisados` del resumen de la noche
 *  (`deptos_resumen_noche`) y `convienen`, el número único de todo el sitio (portal-cache.ts › convienenHoy). Sin el número,
 *  la frase sale sin cifra: nunca una cifra escrita a mano. */
export const HERO_MAPA = {
  ojo: (revisados: number | null) =>
    revisados && revisados >= 1000
      ? `Cada noche Franco analiza los +${miles(pisoDeMiles(revisados))} deptos en venta de Santiago.`
      : "Cada noche Franco analiza los deptos en venta de Santiago.",
  titulo: (convienen: number | null) =>
    convienen && convienen > 0 ? `Invierte en uno de los ${miles(convienen)} deptos que convienen hoy.` : "Invierte en uno de los deptos que convienen hoy.",
  boton: "Verlos en el mapa →",
  separador: "¿Tienes uno en la mira?",
  ejemplo: { antes: "Franco te dice si conviene.", enlace: "Ver un ejemplo" },
  /** El camino sin dirección que ubica el depto en un mapa, dicho distinto para no confundirlo con el mapa de Explorar. */
  ubicarEnMapa: "Ubícalo tú en el mapa",
} as const;
