// Copy canónico del estado "no aplica" (pie cero · fase 3b) — contrato del
// mockup aprobado mockups/pie-cero-fase3.html (98e2319). Fuente ÚNICA de estos
// strings: toda superficie que renderice una métrica sobre capital en estado
// 'no_aplica' importa de acá (D1: decisión del análisis, no dato faltante).
//
// Reglas D1: valor "No aplica" en JetBrains Mono, peso 500, color secundario —
// NUNCA Signal Red (no es criticidad) — + sublabel mono uppercase (el casing lo
// pone el CSS; acá viaja en sentence case para reuso en texto plano).

import type { RazonSinCapital } from "./types";

export const NO_APLICA_VALOR = "No aplica";

export const NO_APLICA_SUBLABEL = "Sin capital propio (pie $0)";

export const NO_APLICA_TOOLTIP =
  "Compraste con financiamiento del 100%: sin pie, no existe una rentabilidad " +
  "sobre capital propio que medir. Este caso se evalúa por flujo mensual y plusvalía.";

// ─── Pre-entrega: las métricas del simulador no se emiten antes de la escritura ──
//
// Estado HERMANO del pie cero: mismo tratamiento D1 (valor "No aplica" en mono
// peso 500 color secundario + sublabel mono uppercase, CERO Signal Red — es una
// decisión del análisis, no una alarma) y razón distinta. No falta capital
// propio: todavía no existe la operación que la métrica mide.
//
// Cubre las 4 métricas del strip cuando el horizonte del slider termina antes
// de la entrega, porque las 4 se apoyan en algo que aún no ocurre:
//   · TIR y Múltiplo liquidan por `valorVenta − saldoCredito − comisión`, y el
//     motor deja `saldoCredito = 0` en esos años porque el banco no cursa hasta
//     escriturar (correcto para el flujo), no porque no debas nada — el saldo
//     del precio sigue siendo deuda con la inmobiliaria. Sin guard, esa caja es
//     el 98% del precio contra una inversión de ~22%: TIR mediana 345% y hasta
//     741%, contra 6,5% cuando el horizonte sí cruza la entrega.
//   · Payback busca el año en que esa misma caja cubre lo aportado ⇒ año 1 por
//     construcción.
//   · Cash-on-Cash promedia flujo operativo que todavía no empieza ⇒ 0,0% en
//     36 de 36, indistinguible de un depto entregado que empata justo.
//
// Misma doctrina que SaleRefiBlock ("No puedes vender ni refinanciar antes de
// la entrega") y patrimonio-series (`valorDepto = null` pre-entrega). Si cambia
// allá, cambia acá.

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * `fechaEntrega` viaja en el input con formato irregular ("2028-12",
 * "2028-12-01", "2029-9" conviven en la base). Parsea las tres y devuelve null
 * cuando no hay fecha o no calza — la superficie cae al texto sin fecha en vez
 * de mostrar "undefined".
 */
function parseFechaEntrega(fechaEntrega?: string | null): { mes: number; anio: number } | null {
  if (!fechaEntrega) return null;
  const [anio, mes] = fechaEntrega.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return null;
  return { mes, anio };
}

// ─── TIR sin raíz del VPN ('no_calculable') ──────────────────────────────────
//
// Tercera razón de ausencia de la TIR, y la única que NO es una decisión del
// análisis: el flujo simplemente no tiene tasa que lo anule en [−99%, 1000%].
// Hereda el tratamiento visual D1 (mismo "No aplica", misma escala de grises,
// CERO Signal Red) porque la ausencia se lee igual; lo que cambia es el porqué.
//
// PROVISORIO a propósito. El censo de of-audit-tir.md encontró UN caso en las
// 710 filas, y es una fila de test (precio 0,1 UF, arriendo 0). Cuando aparezca
// un caso real, este copy va a su propio mockup con Fabrizio — no se diseña
// definitivo sobre una población de cero.
export const NO_CALCULABLE_SUBLABEL = "Sin retorno que calcular";

export const NO_CALCULABLE_TOOLTIP =
  "Con estos números el retorno no tiene solución: no existe una tasa que haga " +
  "que lo que pones y lo que recibes se igualen. Suele indicar un dato mal " +
  "cargado (precio o arriendo). Revisa los supuestos del análisis.";

/** Sublabel D1 pre-entrega. Mes corto: la celda es angosta en mobile. */
export function noAplicaSublabelPreEntrega(fechaEntrega?: string | null): string {
  const f = parseFechaEntrega(fechaEntrega);
  return f ? `Hasta la entrega · ${MESES_CORTOS[f.mes - 1]} ${f.anio}` : "Hasta la entrega";
}

/**
 * Tooltip D1 pre-entrega: por qué no aplica y qué hacer para verlo. Uno solo
 * para las 4 métricas del strip — dice el hecho que las apaga a todas (todavía
 * no arriendas ni puedes vender), no el detalle de cada una, así que sirve
 * igual en TIR, Cash-on-Cash, Payback y Múltiplo.
 */
export function noAplicaTooltipPreEntrega(fechaEntrega?: string | null): string {
  const f = parseFechaEntrega(fechaEntrega);
  const cuando = f ? ` (${MESES_LARGOS[f.mes - 1]} ${f.anio})` : "";
  return (
    `Tu horizonte termina antes de la escritura${cuando}. Hasta entonces el depto no es ` +
    "tuyo: no hay arriendo que rente ni depto que vender, y el saldo del precio sigue " +
    "siendo deuda con la inmobiliaria. Sube el plazo por sobre la entrega para ver esta cifra."
  );
}

// Footnote única de los documentos imprimibles (DocumentoLTR / DocumentoSTR):
// las celdas marcan "No aplica*" y esta nota aparece UNA vez al pie del bloque.
export const NO_APLICA_FOOTNOTE_DOC =
  "* Sin capital propio (pie $0): las métricas sobre tu capital no aplican. " +
  "Este caso se evalúa por flujo mensual y plusvalía.";

/**
 * Variante para el documento COMPARATIVO (DocumentoAmbas · hoja 2). Hermana de
 * la de arriba, no reemplazo: LTR y STR siguen usando aquella tal cual.
 *
 * Cambia lo mínimo por dos razones de layout, no de doctrina: (a) "este caso"
 * es singular y en el comparativo hay DOS modalidades; (b) en una fila de dos
 * columnas la información que falta no es solo el valor — es el ganador, que
 * las otras filas sí tienen. Por eso agrega la consecuencia visible ("esta fila
 * no compara"): sin ella el lector no sabe por qué esa fila se quedó sin lado.
 *
 * Si cambia la doctrina de fondo, las dos se editan juntas.
 */
export const NO_APLICA_FOOTNOTE_DOC_AMBAS =
  "* Sin capital propio (pie $0): las métricas sobre tu capital no aplican en " +
  "ninguna de las dos modalidades, así que esta fila no compara. " +
  "Las dos se evalúan por flujo mensual y plusvalía.";

// Valor que reciben los PROMPTS IA (fase 4) en las líneas de métricas sobre
// capital cuando el estado es 'no_aplica' — derivado del sublabel canónico
// (fuente única). La doctrina pie-0 del system prompt (## 5.bis) referencia
// este string textual: si cambia acá, cambia allá.
export const NO_APLICA_PROMPT = `no aplica: ${NO_APLICA_SUBLABEL.toLowerCase()}`;

/**
 * Glosa de la razón para el PROMPT (fase 5b). Fuente única: acá se decide qué
 * sabe Franco del origen del pie 0 y, por lo tanto, cuánto puede afirmar.
 *
 * El eje que importa para la doctrina ## 5.bis.d (dureza con el precio) es
 * QUIÉN cubre el pie: si es la inmobiliaria (bono), el costo suele viajar en el
 * precio de lista y la comparación contra la zona se endurece; si lo cubre el
 * comprador con fondos propios, esa sospecha NO aplica. Sin declaración,
 * Franco no afirma el origen (§1.4 — no inventar lo que no está en el input).
 */
export function razonSinCapitalPrompt(razon: RazonSinCapital): string {
  switch (razon) {
    case "bono_pie":
      return (
        "bono_pie — el usuario declaró que la INMOBILIARIA cubre el pie (bono pie). " +
        "Nómbralo así, y aplica ## 5.bis.d en su forma FUERTE: ese bono suele estar " +
        "cargado en el precio de lista, así que el precio/m² contra la zona se compara " +
        "con dureza explícita"
      );
    case "otra_fuente":
      return (
        "otra_fuente — el usuario cubre el pie con fondos propios (ahorro, familia, otra " +
        "propiedad), NO la inmobiliaria. NO insinúes que el bono viaja en el precio: esa " +
        "advertencia de ## 5.bis.d no aplica acá. El riesgo estructural (## 5.bis.b) sí"
      );
    case "no_declarada":
      return (
        "no_declarada — se le preguntó y prefirió no decirlo. NO afirmes el origen ni lo " +
        "supongas; la cautela de precio de ## 5.bis.d se mantiene en su forma genérica"
      );
    case "sin_pie":
    default:
      return "sin_pie — compra sin pie declarado, financiamiento del 100%; el origen no se preguntó (no lo afirmes)";
  }
}
