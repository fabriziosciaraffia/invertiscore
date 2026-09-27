/**
 * EL REPARTO DEL INGRESO — qué se lleva la plata que entra cada mes.
 *
 * Nace el 16-sep-2026 al retirar `BarraTramos` del capítulo II de las dos modalidades. La
 * barra intentaba decir esto con píxeles y no podía: **cambiaba de unidad a mitad del parque
 * sin avisar**. Su escala era `max(ingreso, costosOperar + cuota)`, así que mientras la cuota
 * cabe en el ingreso el ancho del negro dice «qué fracción de lo que ENTRA se lleva la cuota»,
 * y cuando no cabe pasa a decir «qué fracción de lo que SALE es la cuota». Dos preguntas
 * distintas, el mismo píxel, ninguna leyenda. Medido: la cuota supera el 100% del ingreso en
 * más de la mitad de las filas LTR (p50 = 110%), o sea que el segundo modo es la mayoría.
 *
 * ⛔ Y EL REPARTO SE CALCULA ACÁ, NO EN EL RENDER, porque antes estaba de las dos formas: STR
 * lo emitía el motor (`tramosBarra`) y LTR lo derivaba el call site del capítulo
 * (`arriendo − dividendo − flujo`). El acta de la pieza decía «lee del motor tal cual» y era
 * cierto sólo en una de las dos. Una sola función para las dos modalidades es lo que impide
 * que vuelvan a separarse.
 *
 * LO QUE NO SE METE EN LA PROPORCIÓN ES EL RESIDUO, y es la lección del gráfico aplicada a la
 * frase: los dos tramos grandes van en PORCENTAJE —que es como se comparan— y el residuo va
 * en PESOS, porque redondeado a porcentaje se vuelve $0 justo en los casos donde es lo único
 * que importa. Medido sobre el parque: el residuo es el 44,2% del ingreso en la mediana LTR y
 * el 31,0% en STR, y es NEGATIVO —plata que sale de tu bolsillo— en el 88,0% y el 76,6%.
 */

/** Los cuatro tramos crudos, en pesos. `exceso` y `libre` son excluyentes y ≥ 0. */
export interface TramosIngreso {
  ingreso: number;
  costosOperar: number;
  cuota: number;
  exceso: number;
  libre: number;
}

export interface RepartoIngreso extends TramosIngreso {
  /**
   * La cuota del crédito con que se cubre el pie («otra fuente» con crédito, 27-sep-2026), ya
   * incluida en `cuota`. Solo existe cuando es > 0: sin ella el reparto es idéntico al de antes.
   * La frase la usa para nombrar las dos cuotas, igual que las filas del capítulo.
   */
  cuotaPie?: number;
  /** Porcentaje del ingreso que se lleva la cuota. Puede pasar de 100: ahí la cuota sola no cabe. */
  cuotaPor100: number;
  /** Porcentaje del ingreso que se llevan los gastos. */
  gastosPor100: number;
  /** El residuo CON SIGNO: positivo queda, negativo sale de tu bolsillo. En pesos, nunca en %. */
  residuoCLP: number;
  /**
   * Qué forma toma la frase. No es cosmético: son dos oraciones distintas porque son dos
   * hechos distintos, y la población está partida casi por la mitad.
   *  · `cabe`   — la cuota entra en el ingreso: se puede repartir el 100% entre los tres.
   *  · `supera` — la cuota sola se lleva más de lo que entra: repartir el 100% mentiría.
   */
  forma: "cabe" | "supera";
}

/**
 * @param ingreso        lo que entra al mes (arriendo en LTR, ingreso de operación en STR)
 * @param cuota          el dividendo del crédito hipotecario
 * @param cuotaPie       la cuota del crédito del pie, si lo hay. Entra a la «cuota» del reparto:
 *                       el capítulo la dibuja como salida propia y la frase tiene que contarla con
 *                       la misma cuota que el resto del capítulo. Antes de esto quedaba escondida
 *                       en «los gastos» (el residuo de la identidad).
 * @param flujo          el flujo neto mensual CON SIGNO, tal como lo emite el motor
 */
export function repartoIngreso(p: { ingreso: number; cuota: number; cuotaPie?: number; flujo: number }): RepartoIngreso {
  const ingreso = Math.max(0, p.ingreso);
  const cuotaPie = Math.max(0, Math.round(p.cuotaPie ?? 0));
  const cuota = Math.max(0, p.cuota) + cuotaPie;
  // Los gastos son el residuo de la identidad del motor (ingreso − cuota − gastos = flujo), no
  // una suma aparte: así el reparto no puede desviarse del flujo que el informe publica.
  const costosOperar = Math.max(0, ingreso - cuota - p.flujo);
  const por100 = (n: number) => (ingreso > 0 ? Math.round((n / ingreso) * 100) : 0);
  return {
    ingreso,
    costosOperar,
    cuota,
    ...(cuotaPie > 0 ? { cuotaPie } : {}),
    exceso: Math.max(0, -p.flujo),
    libre: Math.max(0, p.flujo),
    cuotaPor100: por100(cuota),
    gastosPor100: por100(costosOperar),
    residuoCLP: Math.round(p.flujo),
    forma: cuota <= ingreso ? "cabe" : "supera",
  };
}

/**
 * LA FRASE, en sus dos formas. Determinista y en el motor por la misma razón que el reparto:
 * si la armara cada render, LTR y STR podrían terminar diciéndolo distinto.
 *
 * Devuelve las partes por separado —no una cadena— para que el render pueda pintar el monto
 * final en Signal Red cuando la plata SALE. Ese es el único color, y no es nuevo: la fila
 * total de este mismo capítulo ya lo hace (`color: isNeg ? var(--signal-red)`). Todo lo demás
 * va en tinta: la frase afirma un hecho, no emite un veredicto.
 *
 * @param gastosLabel  «los gastos» en LTR · «operar el depto» en STR. Cada modalidad ya nombra
 *                     así esa bolsa en su propia prosa, y el `title` de la barra retirada usaba
 *                     «costos de operar» para las dos, que en LTR nunca fue del todo cierto.
 */
export function fraseReparto(
  r: RepartoIngreso,
  gastosLabel: string,
  money: (n: number) => string,
): { antes: string; monto: string; despues: string; sale: boolean } {
  const sale = r.residuoCLP < 0;
  const monto = money(Math.abs(r.residuoCLP));
  // Con crédito del pie hay DOS cuotas, y el capítulo las muestra como dos filas: la frase las
  // nombra a las dos en vez de llamar «la cuota» a una suma que el lector no ve.
  const dos = (r.cuotaPie ?? 0) > 0;
  const sujeto = dos ? "Las dos cuotas —la del crédito y la del pie—" : "La cuota";
  // ⛔ EL REPARTO VA EN PORCENTAJE Y NO EN «$ POR CADA $100», aunque lo segundo se lea más
  // concreto: el informe tiene perilla CLP/UF, y «$75 por cada $100» al lado de un residuo en
  // UF mezcla dos monedas en la misma oración. El porcentaje es agnóstico a la perilla; el
  // residuo la respeta porque es un monto de verdad.
  if (r.forma === "cabe") {
    return {
      antes: `${sujeto} ${dos ? "se llevan" : "se lleva"} el ${r.cuotaPor100}% de lo que entra y ${gastosLabel}, el ${r.gastosPor100}%. ${sale ? "De tu bolsillo pones" : "Quedan"} `,
      monto,
      despues: " al mes.",
      sale,
    };
  }
  // «supera»: repartir 100 entre tres mentiría, porque la cuota sola ya se pasa.
  return {
    antes: `${dos ? "Las dos cuotas solas —la del crédito y la del pie— se llevan" : "La cuota sola se lleva"} el ${r.cuotaPor100}% de lo que entra. Con ${gastosLabel}, ${sale ? "de tu bolsillo pones" : "quedan"} `,
    monto,
    despues: " al mes.",
    sale,
  };
}
