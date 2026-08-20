// ─────────────────────────────────────────────────────────────────────────────
// Hitos que parten la serie de tasas del panel admin.
//
// Vive en lib/ y NO en el componente del gráfico por una razón dura: el gráfico
// es "use client", y una constante exportada desde un módulo cliente llega al
// server como proxy — llamarle .some() o .map() desde un Server Component tira
// "Attempted to call some() from the server". La página necesita los hitos para
// decidir qué puntos apaga ANTES de mandar los datos al cliente, así que el
// dato tiene que ser neutro respecto del límite server/cliente.
// ─────────────────────────────────────────────────────────────────────────────

/** Los tres tramos del embudo que grafica la vista de tasas. */
export type TramoTasa = "visitaWizard" | "wizardAnalisis" | "analisisCuenta";

export interface HitoFunnel {
  /** YYYY-MM-DD, día UTC. */
  fecha: string;
  etiqueta: string;
  /** Por qué invalida la comparación previa. Va al respaldo accesible. */
  motivo: string;
  /** Tramos que NO se dibujan antes de este hito. */
  invalida: TramoTasa[];
}

/**
 * Agregar un hito acá lo dibuja en el gráfico y recorta los tramos que liste en
 * `invalida`. No hay más nada que tocar.
 *
 * Los dos que hay responden al mismo problema: un cambio de plataforma redefinió
 * el numerador o el denominador, y comparar los dos lados hace leer como mérito
 * —o como desplome— lo que fue un deploy.
 */
export const HITOS_FUNNEL: HitoFunnel[] = [
  {
    fecha: "2026-08-14",
    etiqueta: "identidad anónima",
    motivo:
      "cada visitante sin cuenta pasó a tener su propio person_id; antes muchos colapsaban en pocos, así que el denominador de estas tasas cambió de significado, no de valor",
    invalida: ["visitaWizard", "wizardAnalisis"],
  },
  {
    fecha: "2026-08-16",
    etiqueta: "apertura del cap",
    motivo:
      "hasta acá no se podía generar un análisis sin cuenta, así que este tramo era 100% por definición",
    invalida: ["analisisCuenta"],
  },
  {
    fecha: "2026-08-19",
    etiqueta: "rediseño del wizard",
    motivo:
      "la primera pantalla dejó de ser la elección de modalidad y pasó a ser la portada del producto (comuna + dirección), y la modalidad se mudó al final; el wizard que empieza acá no es una versión mejorada del anterior sino otro flujo, así que su tasa de entrada mide otra cosa",
    invalida: ["visitaWizard", "wizardAnalisis"],
  },
];

/** ¿Este tramo es comparable ese día, o cae antes del hito que lo habilita? */
export function tramoApagado(tramo: TramoTasa, dia: string): boolean {
  return HITOS_FUNNEL.some((h) => h.invalida.includes(tramo) && dia < h.fecha);
}
