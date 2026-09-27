// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPTOR DE AMBAS (comparativo LTR + STR) — fuente única
//
// AMBAS se apaga como OPCIÓN NUEVA, no como código borrado: la tercera opción
// sesgaba la elección (se lee como "dos informes por uno") y complicaba una
// decisión que debería ser binaria. Puede volver como cross-selling desde un
// informe LTR ya entregado.
//
// SEMÁNTICA: ENCENDIDO SOLO SI LA VARIABLE VALE EXACTAMENTE "true" (27-sep-2026).
// Ausente o cualquier otro valor = apagado. Es el mismo contrato que tuvo el
// interruptor de la prosa IA (`PROSA_IA_ENABLED === "true"`) y que tiene el
// kill-switch de OpenFactura: un producto apagado no revive por una variable que
// falta.
//
// Hasta el 27-sep-2026 era al revés —apagado solo con "false" exacto; ausente =
// encendido—, con el argumento de «no romper un deploy que no conoce la
// variable». Lo que rompía era lo contrario: el entorno Preview de Vercel no tenía
// la variable y el wizard del preview ofrecía «Comparativo», un producto que en
// producción está apagado. Visto en la prueba de la entrega 2 del wizard.
//
// UNA SOLA FUENTE PARA UI Y SERVIDOR. `NEXT_PUBLIC_` no significa "solo cliente":
// Next la inlinea en el bundle del navegador Y sigue disponible en el runtime del
// servidor. Con dos variables (una pública y una privada) el gate podría quedar
// medio encendido — la pantalla escondiendo la opción mientras el endpoint la
// acepta, o peor, al revés: la opción visible contra un servidor que la rechaza,
// que es exactamente el fallo que este goal prohíbe.
//
// NO lleva "use client": es un módulo neutro que importan componentes de cliente
// y route handlers por igual. Marcarlo lo convertiría en un proxy al importarlo
// desde el servidor.
//
// QUÉ **NO** GATEA (a propósito):
//   · La LECTURA de los pares ya creados — dashboard, /analisis/comparativa, los
//     hijos, los PDFs, /share/comparativa/[token] y la prosa comparativa siguen
//     funcionando con el flag apagado. Creación y lectura están desacopladas.
//   · El upsell `unlock` ($4.990) de los hijos: es un producto aparte que no
//     comparte código con la creación del par.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Se pueden crear análisis AMBAS? Solo con `NEXT_PUBLIC_AMBAS_ENABLED="true"`
 * (exacto). Sin la variable, apagado.
 *
 * Se lee como constante de módulo y no como función porque Next inlinea el
 * literal `process.env.NEXT_PUBLIC_AMBAS_ENABLED` en tiempo de build: escribirlo
 * de otra forma (destructuring, índice dinámico) deja `undefined` en el cliente
 * y el gate quedaría encendido en la UI para siempre.
 */
export const AMBAS_ENABLED = process.env.NEXT_PUBLIC_AMBAS_ENABLED === "true";

/** Error único para los endpoints que rechazan la creación de un par AMBAS. */
export const AMBAS_OFF_ERROR =
  "El informe comparativo no está disponible. Elige renta larga o renta corta.";
