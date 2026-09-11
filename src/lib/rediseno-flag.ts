// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPTOR DEL REDISEÑO DEL INFORME (10-sep-2026) — fuente única
//
// El rediseño del informe se hace en cuatro partes (fundamentos · hero ·
// recomendación · capítulos y zona). Ninguna sirve sola: la tipografía nueva sobre
// el papel cálido viejo, o los radios de 16 px sobre la estructura de hoy, se ven
// peor que cualquiera de los dos diseños completos. Este interruptor existe para
// que prod no vea el rediseño hasta que las cuatro estén.
//
// ES UNA CONSTANTE DEL REPO, NO UNA VARIABLE DE ENTORNO, y es deliberado: no
// hace falta un sistema de flags para algo que se enciende UNA vez y se borra.
// `ambas-flag.ts` usa `NEXT_PUBLIC_*` porque ahí el interruptor es de producto y
// se opera desde Vercel sin deploy; acá es de obra y se opera con un commit.
//
// CÓMO SE RETIRA, Y EN QUÉ GOAL:
//   1. En el GOAL 4 (capítulos y zona), cuando la última parte esté lista, este
//      archivo pasa a `true` en su propio commit. Ese commit es el que estrena el
//      rediseño y es el único que hay que revertir si algo sale mal.
//   2. En el COMMIT DE CIERRE de ese mismo goal 4 se borra todo: este archivo, el
//      import de `layout.tsx`, la clase `doc-r2` de `DocumentoFrame`, el `?rediseno=1`
//      de la ruta dev, y el prefijo `.doc-r2 ` de las reglas nuevas — que quedan como
//      las reglas del informe, a secas.
//
// EL GATE ES POR MODALIDAD, y eso tiene su propio retiro. `DocumentoFrame` recibe
// `rediseno` y HOY solo LTR lo pasa: STR se queda con el informe de siempre hasta que
// tenga su pasada, porque encender un rediseño en un informe que nadie diseñó es
// justo lo que este interruptor vino a evitar (contrato §11). Cuando STR llegue:
//   a. STR agrega `rediseno` en `results-client.tsx` de renta corta.
//   b. Con las dos modalidades pasándola, la prop deja de discriminar: se borra de
//      `DocumentoFrame` y de los dos call sites.
//   c. Y recién ahí cae el resto del andamio, que son los dos pasos de arriba.
//
// LOS DRAWERS NO ENTRAN por ninguno de los dos gates, y no es un olvido: montan fuera
// de `DocumentoFrame`, así que nunca reciben `doc-r2`. El contenido de los pop-ups no
// está definido (contrato §11) y es un arco propio.
//
// No lleva "use client": lo leen un layout de servidor y componentes de cliente.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿El informe se dibuja con el rediseño? ENCENDIDO desde el goal 4d (11-sep-2026), y
 * solo para LTR: STR no pasa la prop ni monta el provider, y el contexto tiene default
 * `false`, así que su informe queda exactamente como estaba (contrato §11).
 *
 * PARA APAGAR: `git revert` del commit que puso esto en `true`. Es lo único que ese
 * commit cambia —esta línea y el `preload` de Inter— justamente para que el revert sea
 * limpio y no arrastre nada del rediseño construido, que sigue detrás del interruptor.
 */
export const REDISENO_INFORME = true;

/** La clase que abre las reglas del rediseño. Vacía cuando el interruptor está en
 *  `false`, así que se puede interpolar sin condicionales en el call site. */
export const CLASE_REDISENO = REDISENO_INFORME ? "doc-r2" : "";
