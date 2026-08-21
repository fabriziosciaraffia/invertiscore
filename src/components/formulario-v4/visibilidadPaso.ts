// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPCIÓN vs ABANDONO — contabilidad de la pestaña oculta, por paso.
//
// EL PROBLEMA QUE VIENE A ARREGLAR
// ────────────────────────────────
// La portada registraba ~41% de "abandono" contra 25% de la pantalla anterior,
// y al desglosar por tipo de salida resultó que 44 de sus 45 abandonos eran
// `tab_oculta_sin_retorno` — "cambió de app" — contra UNO de navegación. Las
// pantallas rápidas del wizard (`tipo`, `tasa`: medianas de 2-3 s) registraban
// CERO. Y entre esas "salidas" había dwells de 4.241 s, 1.465 s y 715 s: eso son
// pestañas olvidadas, no gente frustrada.
//
// La causa no es que la portada retenga peor. Es que retiene 42 s contra 10 s, y
// a más tiempo en pantalla, más probabilidad de que llegue un WhatsApp. El
// umbral de 30 s contaba la vida normal de un teléfono como abandono, y lo hacía
// exactamente donde la métrica más importaba.
//
// EL FONDO NO ERA EL UMBRAL, ERA QUE EL TIMER CERRABA EL PASO
// ───────────────────────────────────────────────────────────
// El diseño anterior decidía al vencer el timer: emitía `tab_oculta_sin_retorno`
// y marcaba el paso como emitido. Con eso, "volvió y después se fue de verdad"
// era INMEDIBLE con cualquier umbral — el paso ya estaba cerrado cuando pasaba
// lo interesante, y un usuario que se ausentó 31 s y volvió a completar el
// wizard quedaba archivado como abandono.
//
// Acá la decisión se toma al CERRAR el paso, no al vencer un timer. Cada ciclo
// ocultar/mostrar se acumula, y el evento real —avanzó, retrocedió, cerró la
// pestaña— sale con la historia completa. El timer sobrevive solo para el caso
// en que no hay cierre posible: el usuario que nunca vuelve.
//
// LOS NÚMEROS CRUDOS VIAJAN EN EL EVENTO, LA CLASIFICACIÓN ES CORTESÍA
// ────────────────────────────────────────────────────────────────────
// `clasificar` existe para leer los datos de un vistazo, pero el evento lleva
// los milisegundos. Es deliberado: el corte entre "interrupción" y "abandono" es
// una decisión de producto que va a cambiar cuando haya datos, y tiene que poder
// cambiar EN LA QUERY, sin volver a instrumentar y sin cortar la serie otra vez.
//
// LÍMITE CONOCIDO DEL TIMER (no es un bug, es la plataforma)
// ──────────────────────────────────────────────────────────
// Los navegadores móviles estrangulan y terminan congelando los timers de una
// pestaña en segundo plano. Cuanto más largo el umbral, menos probable que el
// timer llegue a dispararse — la pestaña se congela o se descarta antes. O sea
// que el bucket "nunca volvió, largo" está sub-representado POR CONSTRUCCIÓN, y
// eso se lee así en los datos: la ausencia de evento no prueba que el usuario
// siguiera ahí.
//
// Módulo puro y sin "use client": lo importan el hook del wizard y un script de
// node (`scripts/test-visibilidad-paso.ts`). La conducta se prueba de verdad,
// no en una réplica — misma razón que `entradaPlaces.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuánto tiene que estar oculta la pestaña, SIN volver, para dar el paso por
 * cerrado como "no volvió".
 *
 * 3 minutos, y el número tiene dos lados:
 *
 *  · Por abajo — una llamada corta o responder un mensaje se come entre 30 s y
 *    2-3 minutos. Los 30 s anteriores caían de lleno adentro de la vida normal
 *    de un teléfono, que es precisamente el sesgo que este cambio corrige.
 *  · Por arriba — con umbrales muy largos el timer no alcanza a dispararse: el
 *    navegador ya congeló la pestaña. Pasado cierto punto no se gana precisión,
 *    se pierde el evento entero.
 *
 * Y lo más importante: este número YA NO decide nada irreversible. El evento
 * lleva `oculta_ms`, así que mover el corte es un `WHERE` en la query, no un
 * deploy.
 */
export const MS_OCULTA_NO_VOLVIO = 180_000;

/** Contabilidad de ocultaciones de UN paso. Inmutable: cada transición devuelve
 *  un estado nuevo, que es lo que la hace testeable sin DOM. */
export interface VisibilidadPaso {
  /** ms acumulados de ocultaciones YA CERRADAS (no incluye la que esté en curso). */
  ocultaMsCerrado: number;
  /** Cuántas veces se ocultó la pestaña durante el paso. */
  veces: number;
  /** Duración de la última ocultación cerrada. `null` si nunca volvió o nunca se ocultó. */
  ultimaOcultaMs: number | null;
  /** Timestamp en que se ocultó, si sigue oculta. `null` si está visible. */
  ocultaDesde: number | null;
}

export function nuevaVisibilidad(): VisibilidadPaso {
  return { ocultaMsCerrado: 0, veces: 0, ultimaOcultaMs: null, ocultaDesde: null };
}

/** La pestaña pasó a oculta. Idempotente: dos `hidden` seguidos no cuentan dos. */
export function alOcultar(v: VisibilidadPaso, ahora: number): VisibilidadPaso {
  if (v.ocultaDesde != null) return v;
  return { ...v, veces: v.veces + 1, ocultaDesde: ahora };
}

/** La pestaña volvió a estar visible. Cierra la ocultación en curso. */
export function alMostrar(v: VisibilidadPaso, ahora: number): VisibilidadPaso {
  if (v.ocultaDesde == null) return v;
  const duracion = Math.max(0, ahora - v.ocultaDesde);
  return {
    ocultaMsCerrado: v.ocultaMsCerrado + duracion,
    veces: v.veces,
    ultimaOcultaMs: duracion,
    ocultaDesde: null,
  };
}

/** Total oculto, incluyendo la ocultación en curso si la hay. */
export function ocultaMsTotal(v: VisibilidadPaso, ahora: number): number {
  const enCurso = v.ocultaDesde == null ? 0 : Math.max(0, ahora - v.ocultaDesde);
  return v.ocultaMsCerrado + enCurso;
}

/**
 * Tiempo que el paso estuvo REALMENTE en pantalla.
 *
 * El `dwell_ms` de siempre es reloj de pared y suma el rato en que el usuario
 * estaba en otra app. Eso infla justo las pantallas donde la gente se distrae
 * —las que más retienen— y las vuelve incomparables con las rápidas. Las dos
 * cifras se emiten por separado: `dwell_ms` no cambia de significado y
 * `dwell_activo_ms` es la que sirve para comparar pantallas entre sí.
 *
 * Nunca negativo: los relojes se pueden mover y un dwell negativo es basura que
 * después nadie sabe interpretar.
 */
export function dwellActivoMs(inicioPaso: number, ahora: number, v: VisibilidadPaso): number {
  return Math.max(0, ahora - inicioPaso - ocultaMsTotal(v, ahora));
}

/**
 * Lectura de un vistazo. Los cuatro casos que el producto necesita separar —
 * conveniencia sobre los milisegundos del evento, nunca la fuente de verdad.
 *
 *  · `sin_interrupcion` — nunca se ocultó la pestaña.
 *  · `volvio_breve`     — se ocultó y volvió dentro del umbral. Interrupción
 *                         normal: si después abandona, el abandono es real y
 *                         viene en `salida`, no acá.
 *  · `volvio_largo`     — volvió, pero después del umbral. Ambiguo: estuvo lejos
 *                         un rato largo y aun así regresó.
 *  · `no_volvio`        — sigue oculta al momento de cerrar el paso. Con
 *                         `oculta_ms` se separa el "se fue" del "se olvidó la
 *                         pestaña abierta".
 */
export type ClaseInterrupcion = "sin_interrupcion" | "volvio_breve" | "volvio_largo" | "no_volvio";

export function clasificar(
  v: VisibilidadPaso,
  ahora: number,
  umbralMs: number = MS_OCULTA_NO_VOLVIO,
): ClaseInterrupcion {
  if (v.ocultaDesde != null) return "no_volvio";
  if (v.veces === 0) return "sin_interrupcion";
  // Se mira la ocultación MÁS LARGA que se pueda establecer, no la suma: tres
  // pausas de 40 s son tres interrupciones normales, no una ausencia de dos
  // minutos. Con una sola ocultación cerrada, `ultimaOcultaMs` ES esa duración.
  const masLarga = v.ultimaOcultaMs ?? 0;
  return masLarga >= umbralMs ? "volvio_largo" : "volvio_breve";
}

/**
 * Propiedades de visibilidad que viajan en `wizard4_step_left`.
 *
 * Se arman acá y no en el hook para que el contrato del evento esté en el mismo
 * archivo que la contabilidad, y para poder testear lo que se emite —no una
 * reconstrucción de lo que se emite.
 */
export interface PropsVisibilidad {
  dwell_ms: number;
  dwell_activo_ms: number;
  oculta_ms: number;
  oculta_veces: number;
  /** Duración de la última ocultación CERRADA (o sea, cuánto tardó en volver). */
  oculta_ultima_ms: number | null;
  /** ¿El paso se cierra con la pestaña todavía oculta? */
  oculta_al_salir: boolean;
  clase_interrupcion: ClaseInterrupcion;
}

export function propsVisibilidad(
  inicioPaso: number,
  ahora: number,
  v: VisibilidadPaso,
  umbralMs: number = MS_OCULTA_NO_VOLVIO,
): PropsVisibilidad {
  return {
    dwell_ms: Math.max(0, ahora - inicioPaso),
    dwell_activo_ms: dwellActivoMs(inicioPaso, ahora, v),
    oculta_ms: ocultaMsTotal(v, ahora),
    oculta_veces: v.veces,
    oculta_ultima_ms: v.ultimaOcultaMs,
    oculta_al_salir: v.ocultaDesde != null,
    clase_interrupcion: clasificar(v, ahora, umbralMs),
  };
}

/**
 * Versión del esquema de `wizard4_step_left`.
 *
 * 1 — hasta el 20-ago-2026. `tab_oculta_sin_retorno` a los 30 s y `dwell_ms` de
 *     reloj de pared. Los valores de `salida` significan otra cosa en esta
 *     versión: no mezclar las dos en una misma serie.
 * 2 — desde el 21-ago-2026. Umbral de 3 minutos, la decisión se toma al cerrar
 *     el paso y no al vencer el timer, y viajan las propiedades de visibilidad.
 *
 * Va en el evento porque el goal pedía poder distinguir el antes del después sin
 * adivinar por fecha — y una fecha en la query es exactamente la clase de
 * supuesto que envejece mal.
 */
export const ESQUEMA_SALIDA = 2;
