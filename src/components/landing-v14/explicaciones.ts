import type { Veredicto } from "@/lib/types";

/** Qué significa obtener cada veredicto, explicado en simple. No habla de un informe en
 *  particular: es la explicación del veredicto, por eso no lleva cifra. La usan «Tres respuestas
 *  posibles» de la landing y /metodologia: una sola escritura.
 *  «Los números», no «los supuestos»: supuesto es palabra nuestra, del motor (veredicto-etiqueta.ts). */
export const EXPLICACION_VEREDICTO: Record<Veredicto, string> = {
  "BUSCAR OTRA": "Ni el arriendo ni la plusvalía esperada justifican el precio.",
  "AJUSTA SUPUESTOS": "El depto sirve, los números no. A otro precio, con más pie o a otro plazo, el negocio cierra.",
  COMPRAR: "Rentabilidad, flujo y precio de entrada juegan a favor. Se paga solo y compite bien con la zona.",
};
