// Telemetría de la landing v14 — nombres en un solo lugar (GOAL landing v14).
//
// Todos viajan con las UTM que `useUTMCapture` registró en la persona. Excluir `utm_source=an` de cualquier dashboard.
// `landing_viewed` ya no es de acá: lo emite el servidor al servir la página, con los UTM de la URL y el `fbclid`
// (20-oct-2026, lib/vista-entrada.ts).

export const EV = {
  section: "landing_section_viewed",
  ctaFocus: "landing_cta_focus",
  ejemplo: "landing_ejemplo_click",
  /** «Verlos en el mapa →», el botón del hero (29-oct-2026; antes, el de la tarjeta de la puerta E). Va a /explorar. */
  explorar: "landing_explorar_click",
  // ⚠ ACTA (30-oct-2026, el hero limpio de 7c-landing-limpia) · `landing_mapa_click` (un toque en el mapa del hero, 29-oct) se
  // retiró con el mapa. El uso del campo de dirección sigue siendo `ctaFocus` (con `ubicacion` = hero) y `direccionElegida`.
  planes: "landing_planes_click",
  sinDireccion: "landing_sin_direccion",
  /** Pausar / seguir la rotación desde «Lo que haría Franco» (`accion`, `ejemplo`). */
  rotacion: "landing_rotacion",
  /** Eligió una dirección en el campo (`ubicacion`, `via`, `precision`, `cubierta`): el paso del
   *  hero que no tenía evento (auditoría 28-sep-2026); lo que sigue lo mide el wizard. */
  direccionElegida: "landing_direccion_elegida",
} as const;

/** Dónde vive el campo de dirección. `metodologia` es el CTA del interior:
 *  mismo componente, otro origen para el wizard y la telemetría. */
export type UbicacionCampo = "hero" | "cierre" | "metodologia";
