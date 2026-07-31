// ─────────────────────────────────────────────────────────────────────────────
// CTA de entrada al wizard — fuente única de destino y texto
//
// Antes la decisión estaba repartida en 11 sitios y de tres formas distintas:
// siete `href="/register"` literales en la landing, dos condicionales con
// expresiones propias (nav y pricing) y dos sin gate (las páginas de comuna).
// La landing y las páginas de comuna hacían lo CONTRARIO entre sí para el mismo
// invitado.
//
// El destino es el wizard para todos, con y sin sesión. El middleware ya lo
// documenta —"/analisis/nuevo is public (guest can do 1 analysis)"— y el primer
// análisis es gratis: pedir el correo antes de entregar valor invertía el orden.
// Al desaparecer la bifurcación por sesión, el helper no necesita saber quién
// mira: es una constante más el origen para medir.
// ─────────────────────────────────────────────────────────────────────────────

export const RUTA_WIZARD = "/analisis/nuevo-v4";

/**
 * Texto del CTA. Vive acá porque estaba repetido literal en cinco archivos.
 *
 * Se mantiene "Analizar departamento": el problema nunca fueron las palabras
 * sino el destino. Antes prometía un análisis y entregaba un formulario de
 * registro; ahora hace lo que dice. Cumple la regla de CTA de la marca (verbo +
 * objeto, dos palabras) y evita el "gratis", que suena a promoción — Franco
 * informa, no vende.
 */
export const LABEL_ANALIZAR = "Analizar departamento";

/** Texto para quien ya tiene sesión y está dentro del producto. */
export const LABEL_ANALIZAR_LOGUEADO = "Nuevo análisis";

/**
 * Superficie desde la que se entra. Sirve para medir qué CTA trae gente: hoy
 * los siete de la landing comparten `$referrer` y son indistinguibles entre sí.
 */
export type OrigenCTA =
  | "landing_hero"
  | "landing_cta_primario"
  | "landing_cta_secundario"
  | "landing_cta_final"
  | "landing_casos_uso"
  | "nav"
  | "nav_mobile"
  | "comuna_detalle"
  | "comunas_indice"
  | "demo"
  | "aprende"
  | "about"
  | "cobertura"
  | "pricing"
  | "resultado_hook"
  | "resultado_cierre"
  | "dashboard"
  | "cuenta"
  | "comparativa";

export interface OpcionesCTA {
  /** Precarga la comuna en el wizard (páginas SEO por comuna). */
  comuna?: string;
}

/**
 * Destino del CTA. El `origen` viaja en la URL además de emitirse como evento:
 * así queda en el `$current_url` del pageview automático y la medición sobrevive
 * a un bloqueador que mate el evento propio.
 */
export function hrefAnalizar(origen: OrigenCTA, opts: OpcionesCTA = {}): string {
  const params = new URLSearchParams({ origen });
  if (opts.comuna) params.set("comuna", opts.comuna);
  return `${RUTA_WIZARD}?${params.toString()}`;
}

/** Nombre del evento de click. Un solo string para no perder la serie. */
export const EVENTO_CTA_ANALIZAR = "cta_analizar_click";
