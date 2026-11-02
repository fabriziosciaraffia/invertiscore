// ─────────────────────────────────────────────────────────────────────────────
// LA PUERTA A EXPLORAR EN LOS CORREOS Y EN LO QUE ENTRA POR /deptos (02-nov-2026, goal de Fabrizio). Después de la selección y
// antes del botón, una línea: «Estos son N de los 6.695 deptos que convienen hoy en Gran Santiago. Míralos todos en el mapa»,
// con el enlace a /explorar abierto con los filtros del perfil de esa persona. El número es el ÚNICO de la noche
// (el que guarda el cron, convienen-guardado.ts): ninguna superficie lo cuenta por su cuenta, y sin él la línea no sale.
//   · LOS CORREOS: el semanal, la selección diaria de «comprar ya» (el aviso inmediato) y el correo del día. El enlace pasa por
//     /api/semanal/clic (`ir=explorar`), que mide el clic aparte de los deptos y aterriza en /explorar con `desde=correo`: la
//     vista queda con la llegada «correo». Lo arma el servidor con `puertaExplorarCorreo` (puerta-correos-servidor.ts).
//   · EL VACÍO (decisión de Fabrizio, 02-nov-2026): «Hoy convienen 6.695 deptos en Gran Santiago.» y «Míralos todos en el
//     mapa» como una salida más, a la VISTA GLOBAL: con sus filtros el mapa sale vacío, que es por lo que el correo vino vacío.
//   · RENTA CORTA (decisión de Fabrizio, 02-nov-2026): la línea va igual, con el número de arriendo tradicional, y el enlace
//     abre /explorar en renta corta con su perfil.
//   · LAS PANTALLAS: «Estás dentro» y el dashboard, bajo la selección, la misma línea en texto discreto. El dashboard conserva
//     su botón «Explorar los N de Santiago», que abre la vista global.
// N cuenta los deptos de la selección que convienen: los que entran por negociar (Ajustar) no son de los que convienen.
// Puro: el tier EXPLORAR-CORREOS lo prueba.
// ─────────────────────────────────────────────────────────────────────────────
// SIN DEPENDENCIAS a propósito (02-nov-2026, medido por LANDING-RENDIMIENTO): «Estás dentro» lo usa en el navegador, y
// portal.ts arrastra Sentry al primer paquete de /deptos. Lo que necesita los filtros de Explorar vive en
// puerta-correos-filtros.ts, que solo usa el servidor.
import { DESDE_CORREO } from "./puertas-landing";

export { DESDE_CORREO };

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export const PUERTA_EXPLORAR = {
  /** El enlace al final de la línea (y el botón del vacío). */
  enlace: "Míralos todos en el mapa",
} as const;

/** El clic en el enlace, por correo (desde /api/semanal/clic) o por pantalla (desde el navegador). Aparte de los clics de
 *  los deptos: `semanal_clic` y `aviso_inmediato_clic` lo cuentan además con `destino: "explorar"`. */
export const EVENTO_PUERTA_EXPLORAR = "explorar_enlace_clic";

/** Qué correo trae el enlace (`de=` en el enlace, validado en la ruta del clic). */
export const CORREOS_CON_PUERTA = ["semanal", "del_dia", "inmediato", "semanal_vacio", "del_dia_vacio"] as const;
export type CorreoConPuerta = (typeof CORREOS_CON_PUERTA)[number];
export const esCorreoConPuerta = (x: unknown): x is CorreoConPuerta => typeof x === "string" && (CORREOS_CON_PUERTA as readonly string[]).includes(x);
export type PantallaConPuerta = "dashboard" | "estas_dentro";

/** Las propiedades del clic: el canal (correo o pantalla) y dónde. */
export function propsPuertaExplorar(canal: "correo" | "pantalla", donde: CorreoConPuerta | PantallaConPuerta, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { canal, donde, ...extra };
}

/**
 * LA LÍNEA. `n`: los de la selección que convienen (convienenEnSeleccion); `total`: el número único de la noche. Con cero
 * (el vacío), «Hoy convienen 6.695 deptos en Gran Santiago.». Sin el número de la noche, null: la línea no sale, nunca con
 * una cifra que no sea la única.
 */
export function lineaConvienen(n: number, total: number | null | undefined): string | null {
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  const t = miles(total);
  if (!(n > 0)) return `Hoy convienen ${t} deptos en Gran Santiago.`;
  return n === 1 ? `Este es 1 de los ${t} deptos que convienen hoy en Gran Santiago.` : `Estos son ${miles(n)} de los ${t} deptos que convienen hoy en Gran Santiago.`;
}

/** N: los deptos de la selección que convienen. Los que entran por negociar (`tramo: "negociar"`) no se cuentan. */
export const convienenEnSeleccion = (deptos: ReadonlyArray<object>): number => deptos.filter((d) => (d as { tramo?: unknown }).tramo !== "negociar").length;

/** El enlace del correo: pasa por la ruta del clic con la consulta (sin consulta, la vista global) y de qué correo es. */
export function enlacePuertaCorreo(baseClic: string, consulta: string, de: CorreoConPuerta): string {
  return `${baseClic}&ir=explorar&de=${de}${consulta ? `&q=${encodeURIComponent(consulta)}` : ""}`;
}

/** El enlace de las pantallas: /explorar con la consulta del perfil (el clic se mide en la pantalla). */
export const hrefPuertaPantalla = (consulta: string): string => (consulta ? `/explorar?${consulta}` : "/explorar");

/** Lo que el correo dibuja: la línea y el enlace. null = no va (sin el número de la noche). */
export interface PuertaExplorarCorreo {
  linea: string;
  url: string;
}
