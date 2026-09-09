// ─────────────────────────────────────────────────────────────────────────────
// LA REGULACIÓN DEL EDIFICIO — el único riesgo STR que el motor no dibujaba.
//
// Auditoría del 09-sep-2026 sobre las 12 corridas v16 del prompt STR: de las nueve
// familias de riesgo que el modelo escribe en `riesgos.contenido`, OCHO ya están
// dibujadas por el motor (break-even en el capítulo III, ocupación baja en la matriz
// tarifa × ocupación, costos en `estructura_costos_str`, tarifa/ocupación en
// `ocupacion_vs_estimacion`, sobreprecio, ventaja vs LTR, ramp-up en el capítulo III,
// CAP rate en `rentabilidad_str`). La NOVENA —la regulación del edificio— era la más
// frecuente de todas y no se veía en ninguna parte de la página: vivía solo como
// anomalía que se le pasa al prompt (ai-generation-str.ts) y como dimensión de AMBAS.
//
// POR QUÉ LA DIBUJA EL MOTOR Y NO LA ESCRIBE EL MODELO. `edificioPermiteAirbnb` es un
// input del wizard con TRES valores y el monto en riesgo es otro input
// (`costoAmoblamiento`): no hay nada que interpretar. Pedirle prosa a un modelo para
// decir «no sabes si el edificio permite» costaba palabras por generación y dependía de
// que se acordara — en las 12 corridas apareció en 6. Acá aparece siempre.
//
// Módulo PURO (sin React, sin formato de moneda): el componente le pasa el monto ya
// formateado y el catch-test de 0 tokens lo importa tal cual.
// ─────────────────────────────────────────────────────────────────────────────

/** Los tres valores del wizard (`WizardV3State["edificioPermiteAirbnb"]`). */
export type EstadoRegulacion = "si" | "no" | "no_seguro";

/**
 * Normaliza el input. Dos nombres conviven en las filas persistidas
 * (`regulacionEdificio` es el que lee el prompt, `edificioPermiteAirbnb` el que escribe
 * el wizard) y una variante vieja del valor (`no_estoy_seguro`). Sin dato ⇒
 * `no_seguro`: el default del wizard, y el que NO da por buena una condición que nadie
 * confirmó.
 */
export function normalizarRegulacion(input: unknown): EstadoRegulacion {
  const raw = input && typeof input === "object"
    ? ((input as Record<string, unknown>).regulacionEdificio ?? (input as Record<string, unknown>).edificioPermiteAirbnb)
    : input;
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "si" || v === "sí") return "si";
  if (v === "no") return "no";
  return "no_seguro";
}

export interface BloqueRegulacion {
  titulo: string;
  cuerpo: string;
  /** `true` ⇒ el reglamento ya dijo no: tratamiento crítico. */
  critico: boolean;
}

/**
 * El texto por estado. `montoFmt` es el amoblamiento YA formateado (o `null` si la fila
 * no lo trae): es la plata que queda expuesta a la respuesta del reglamento.
 *
 * CON «si» DEVUELVE null Y NO SE RENDERIZA NADA. Un bloque que dice «el edificio sí
 * permite, todo en orden» ocupa el mismo espacio que una advertencia para no advertir
 * nada — y este informe no gasta una sección en tranquilizar. Que no aparezca ES la
 * señal de que no hay nada que confirmar.
 */
export function bloqueRegulacion(estado: EstadoRegulacion, montoFmt: string | null): BloqueRegulacion | null {
  if (estado === "si") return null;
  const enJuego = montoFmt
    ? ` Los ${montoFmt} de amoblamiento son la plata que queda colgando de esa respuesta: es el gasto que no recuperas si tienes que parar.`
    : "";
  if (estado === "no") {
    return {
      titulo: "El edificio no permite arriendo por día",
      cuerpo: `Lo declaraste así, y eso no es un riesgo del negocio: es su condición. Operar contra el reglamento expone a multa y a que la administración lo corte cuando quiera, sin importar qué tan bien den los números de arriba.${enJuego}`,
      critico: true,
    };
  }
  return {
    titulo: "No sabes si el edificio permite arriendo por día",
    cuerpo: `Lo decide el reglamento de copropiedad, y es lo único de este análisis que ningún número resuelve: si el reglamento lo prohíbe, la operación no existe y las cifras de arriba dejan de aplicar.${enJuego} Pídelo a la administración antes de comprar.`,
    critico: false,
  };
}
