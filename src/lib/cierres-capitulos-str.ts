// ─────────────────────────────────────────────────────────────────────────────
// CIERRES DETERMINISTAS DE LOS CAPÍTULOS STR · I–VI (contrato mockup-str-CONGELADO.html,
// T0 · 04-sep-2026). Mismo estilo que `cierres-capitulos.ts` (LTR): cero prosa IA, cada
// cierre es una cadena de oraciones con ramas por condición y devuelve SEGMENTOS (texto +
// si lleva plumón) para que el render pinte el <mark>.
//
// Doctrina: el cierre no emite veredicto; cita los que el motor midió, en MAYÚSCULAS. Las
// cifras vienen del motor (metrics, simularStr, distancia_veredicto, comparativa,
// zonaSTR); acá no se recalcula nada. El VI reusa `cierreResultado` de LTR: la composición
// de tu parte, el multiplicador y la caja son los mismos conceptos.
// ─────────────────────────────────────────────────────────────────────────────
import type { Veredicto } from "./types";
import { brechaEnPalabras, type FmtCierre, type SegCierre } from "./cierres-capitulos";
import type { FronterasIngresoStr, MatrizTarifaOcupacion } from "./analysis/simular-str";
import type { OcupacionVsComuna } from "./engines/str-universo-santiago";
import { DIST_STR_TOPE_ADR_PCT } from "./distancia-veredicto-str-hallazgo";
import type { QuiebreGestionSTR } from "./engines/short-term-engine";

export { cierreResultado as cierreResultadoStr, type ArgsCierreResultado as ArgsCierreResultadoStr } from "./cierres-capitulos";

const trimUltimo = (segs: SegCierre[]) => {
  if (segs.length) segs[segs.length - 1].t = segs[segs.length - 1].t.trimEnd();
  return segs;
};
const fmtPctSigno = (n: number, pct1: (n: number) => string) => `${n >= 0 ? "+" : "−"}${pct1(Math.abs(n))}`;

// ═══════════ CIERRE I · Cuánto renta (cap rate + fronteras del ingreso + matriz) ═══════════

export interface ArgsCierreRentaStr {
  veredictoBase: Veredicto;
  /** Tarifa por noche del caso (CLP) y si es la mediana de la zona o un dato del usuario. */
  adr: number;
  adrEsDelUsuario: boolean;
  capPct: number;
  capRefPct: number;
  /** capPct − capRefPct, en puntos. */
  gapPts: number;
  /** Tarifa a la que rendirías como el umbral (CLP/noche). */
  adrRef: number;
  fronteras: FronterasIngresoStr | null;
  matriz: MatrizTarifaOcupacion | null;
}

export function cierreRentaStr(a: ArgsCierreRentaStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const ref = `${f.pct1(a.capRefPct)}%`;
  const cobras = a.adrEsDelUsuario ? `Cobras ${f.money(a.adr)} por noche, un dato tuyo,` : "Cobras la mediana de la zona";
  // Oración A · dónde cae el cap rate (banda neutral ±0,2 como el hallazgo)
  if (a.gapPts <= -0.2) {
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} bajo el umbral (${ref}): para rendir como una renta corta necesitarías cerca de ${f.money(a.adrRef)} por noche. ` });
  } else if (a.gapPts >= 0.2) {
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} sobre el umbral (${ref}): incluso cobrando ${f.money(a.adrRef)} por noche rendirías como una renta corta, hay holgura. ` });
  } else {
    segs.push({ t: `${cobras} y rindes en línea con el umbral (${ref}): la tarifa de la zona es justo la que hace que este precio se justifique. ` });
  }
  // Oración B · hacia arriba (frontera del ingreso)
  const fr = a.fronteras;
  if (a.veredictoBase !== "COMPRAR") {
    if (fr?.arriba && fr.tarifa.arriba != null) {
      const d = (fr.arriba.factor - 1) * 100;
      if (d <= DIST_STR_TOPE_ADR_PCT) {
        segs.push(
          { t: "Hacia arriba la frontera está cerca: " },
          { t: `si sostienes ${f.money(fr.tarifa.arriba)} por noche, un ${fmtPctSigno(d, f.pct1)}% sobre lo que hoy cobras, el veredicto sube a ${fr.arriba.veredicto}`, mark: true },
          { t: ". Es una apuesta a rendir sobre lo que hoy cobra la zona, no un supuesto que tú controlas. " },
        );
      } else {
        // Fuera del tope de honestidad de la tarifa (§1.12.4): se dice el hecho, no se ofrece.
        segs.push({ t: `Hacia arriba no hay ajuste realista: recién cobrando ${f.money(fr.tarifa.arriba)} por noche, un ${fmtPctSigno(d, f.pct1)}% sobre lo que hoy cobra la zona, cruzaría a ${fr.arriba.veredicto}, y eso ya no es un ajuste sino otro mercado. ` });
      }
    } else if (fr) {
      segs.push({ t: "Hacia arriba no hay frontera a la vista: ni con el triple de ingreso cambia el veredicto. " });
    }
  }
  // Oración C · hacia abajo (colchón)
  if (fr) {
    if (fr.abajo && fr.tarifa.abajo != null) {
      const colchon = a.adr - fr.tarifa.abajo;
      const d = (1 - fr.abajo.factor) * 100;
      segs.push(
        { t: d < 5 ? "Hacia abajo el colchón es mínimo: " : d < 15 ? "Hacia abajo el colchón es corto: " : "Hacia abajo aguanta: " },
        { t: `${f.money(colchon)} por noche antes de caer a ${fr.abajo.veredicto}`, mark: a.veredictoBase === "COMPRAR" },
        { t: ". " },
      );
    } else {
      segs.push({ t: "Hacia abajo el veredicto es firme: ni con el ingreso a un tercio cambia. " });
    }
  }
  // Oración D · la matriz: cruza aunque el mes quede negativo (la celda existe o no)
  const negCruza = a.matriz?.celdas.find((c) => c.cruza && c.flujoMensual < 0);
  if (negCruza) {
    segs.push(
      { t: `En la matriz, ${f.money(negCruza.tarifaCLP)} por noche con ${Math.round(negCruza.ocupacion * 100)}% de ocupación ` },
      { t: `cruza a ${negCruza.veredicto} aunque el mes quede en ${f.money(negCruza.flujoMensual)}: el veredicto lo decide el Franco Score, no el signo del mes`, mark: true },
      { t: ". " },
    );
  } else if (a.matriz && a.matriz.celdas.length) {
    const cruzan = a.matriz.celdas.filter((c) => c.cruza).length;
    if (cruzan > 0) segs.push({ t: `En la matriz, ${cruzan} de las ${a.matriz.celdas.length} combinaciones de tarifa y ocupación cruzan, todas cobrando más o con más ocupación que hoy. ` });
  }
  return trimUltimo(segs);
}

// ⛔ CIERRE II · Tu flujo mensual — RETIRADO el 16-sep-2026.
//
// Decía cuatro cosas y las cuatro quedaron mejor dichas en otra parte: el monto lo dice
// la tabla del capítulo (fila «Sale de tu bolsillo» / «Te queda»), QUÉ MES es lo declara
// ahora el sub —antes iba enterrado acá, al final de una cláusula: «…con la ocupación
// estimada»—, la estabilización la absorbe el gráfico de diez años, y el contraste con
// el otro modo de gestión vive en el capítulo V, donde además viene con el punto de
// quiebre.
//
// Con él muere `fraccionEnPalabras`, que no tenía otro consumidor.
//
// LA COMPARACIÓN CONTRA EL ARRIENDO LARGO SE DEJA MORIR, y es decisión, no olvido. Este
// cierre decía «no es una sangría: es dos tercios de lo que te pediría el mismo depto
// arrendado largo», y el capítulo V lleva ese hilo solo cuando la sobre-renta es negativa —
// o sea que para una fila con flujo negativo y sobre-renta positiva la frase ya no está en
// ninguna parte. Va igual: el V YA compara largo contra corto en su segunda mitad, y tener
// la misma comparación en dos capítulos CON DOS MÉTRICAS DISTINTAS (acá el flujo, allá el
// NOI) es peor que no tenerla en uno.
//
// 👉 PARA EL GOAL DEL CAPÍTULO V: si al abrirlo el hilo largo-vs-corto queda flojo, esto es
// lo que hay que mirar — el V es el único lugar donde esa comparación existe ahora, y su
// métrica es el NOI. Se resuelve ahí, que es donde vive.

// ═══════════ CIERRE III · Cuántas noches necesitas (estimación + frontera + zona + año) ═══════════

export interface ArgsCierreNochesStr {
  veredictoBase: Veredicto;
  /** Noches al año con la ocupación del caso y con la de la frontera (null sin frontera). */
  noches: number;
  nochesArriba: number | null;
  ocupacionPct: number;
  ocupacionArribaPct: number | null;
  veredictoArriba: Veredicto | null;
  ocupacionEsDelUsuario: boolean;
  vsComuna: OcupacionVsComuna | null;
  comuna: string;
  mesesEnVerde: number;
  estabilizacionCLP: number;
}

export function cierreNochesStr(a: ArgsCierreNochesStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const origen = a.ocupacionEsDelUsuario ? "Tú supusiste" : "El mercado estima";
  if (a.veredictoBase !== "COMPRAR" && a.nochesArriba != null && a.ocupacionArribaPct != null) {
    const faltan = a.nochesArriba - a.noches;
    const pts = a.ocupacionArribaPct - a.ocupacionPct;
    segs.push(
      { t: `${origen} ${a.noches} noches al año para tu depto y el veredicto sube con ${a.nochesArriba}: ` },
      { t: faltan <= 30 ? `faltan ${faltan} noches al año, ${pts < 2 ? "menos de dos puntos" : `${f.pct1(pts)} puntos`} de ocupación, no un mercado distinto` : `faltan ${faltan} noches al año, ${f.pct1(pts)} puntos de ocupación: eso ya es otro mercado`, mark: true },
      { t: ". " },
    );
    if (!a.ocupacionEsDelUsuario) segs.push({ t: "Pero son noches por sobre la estimación, que ya es la de un depto estabilizado" });
    else segs.push({ t: "Y son noches por sobre tu propio supuesto, que el mercado no confirma" });
  } else if (a.veredictoBase !== "COMPRAR") {
    segs.push({ t: `${origen} ${a.noches} noches al año para tu depto y ninguna ocupación realista cambia el veredicto` });
  } else {
    segs.push({ t: `${origen} ${a.noches} noches al año para tu depto y el veredicto ya no necesita más` });
  }
  if (a.vsComuna && a.vsComuna !== "sin_datos") {
    segs.push({ t: a.vsComuna === "mas" ? `, y tu zona ocupa más que el resto de ${a.comuna}. ` : a.vsComuna === "menos" ? `, y tu zona ocupa menos que el resto de ${a.comuna}. ` : `, y tu zona no ocupa más que el resto de ${a.comuna}. ` });
  } else {
    segs.push({ t: ". " });
  }
  const meses = a.mesesEnVerde;
  segs.push({
    t: meses === 0
      ? `El año además es parejo hacia abajo, sin un solo mes en verde, y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`
      : meses <= 3
      ? `El año además es parejo hacia abajo, con ${meses === 1 ? "un solo mes" : `${meses} meses`} en verde, y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`
      : `El año reparte ${meses} meses en verde y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`,
  });
  return trimUltimo(segs);
}

// ═══════════ CIERRE IV · «Cómo lo pagas» — RETIRADO (21-sep-2026) ═══════════
// El capítulo ya no cierra con prosa: se ancla al precio recomendado y sus cuatro pasos
// (`como-lo-pagas.ts`). `cierrePagasStr` y `ArgsCierrePagasStr` salieron con él.

// ═══════════ CIERRE V · Cómo lo gestionas (ventaja sobre el largo + qué se lleva la gestión) ═══════════

export interface ArgsCierreGestionStr {
  modo: "auto" | "administrador";
  /** Sobre-renta del corto sobre el largo (ingreso neto), en el modo del caso. */
  sobreRenta: number;
  flujoMensual: number;
  flujoOtroModo: number;
  /** Ingreso neto del largo, para decir "no le gana" cuando la sobre-renta es negativa. */
  ltrIngresoNeto: number;
  /** Lo que el motor mide sobre la comisión. Sin él, el cierre dice solo lo que cuesta. */
  quiebre: QuiebreGestionSTR | null;
}

/**
 * ⛔ REESCRITO el 16-sep-2026. Este cierre era la TESIS del capítulo — decía «La ventaja
 * existe y es tuya mientras pongas las horas» y «La ventaja existe solo si pones las horas
 * tú». Las dos salían del contrafáctico `str_admin`, que corre con el MISMO ingreso, ADR y
 * ocupación que `str_auto` y solo cambia la comisión: delegar salía peor en el 100% del
 * parque POR CONSTRUCCIÓN, no por medición.
 *
 * ⛔ Y PARTIDO EN DOS el 17-sep-2026, cuando el capítulo V se fundió con el II. Este cierre
 * ahora cierra EL CAPÍTULO II, debajo de las filas del administrador. Dice dos cosas:
 *   1 · EL PUNTO DE QUIEBRE, que es aritmética de las dos comisiones y por eso es verdadero
 *       con cualquier calibración de ocupación. Lleva el plumón.
 *   2 · La línea CUALITATIVA, sin números, más la pregunta que el usuario le hace al operador.
 *
 * LO QUE SE FUE, y por qué:
 *   · QUÉ CUESTA la comisión (las cuatro redacciones) — lo dicen ahora las DOS FILAS que la
 *     fusión trajo al capítulo II: «Un administrador cobra el 20%» con su monto, y «Te
 *     quedaría, con administrador» con el total y el sobrecosto en el sub. Repetirlo en prosa
 *     debajo de la tabla que lo acaba de mostrar es la regla del repo al revés: si un dato se
 *     puede mostrar, no se cuenta. El cierre arranca directo en el quiebre, que es lo único
 *     que las filas NO pueden decir.
 *   · EL HILO DEL LARGO — se fue a `cierreLargoStr`, que cierra lo que queda del capítulo V.
 *     No es sobre delegar y no tiene por qué viajar con la comisión.
 */
export function cierreGestionStr(a: ArgsCierreGestionStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const auto = a.modo === "auto";
  // `flujoMensual` y `flujoOtroModo` ya no se leen acá: los mostraba la parte «qué cuesta»,
  // que ahora son las dos filas del capítulo II. Siguen en los args porque `cierreLargoStr`
  // comparte la misma estructura y porque el contrato del ensamblador es uno solo.
  const q = a.quiebre;

  // ── 1 · el punto de quiebre ──
  // Arranca acá y no en «qué cuesta»: el costo son las dos filas de arriba. Ver el acta.
  if (q && q.puntosExtra > 0) {
    const pts = f.pct1(Math.round(q.puntosExtra * 1000) / 10);
    segs.push(
      { t: "Para que esa comisión se pague sola, " },
      { t: `${auto ? `el administrador tendría que conseguirte ${pts} puntos de ocupación más que tú` : `tu administrador tiene que estar consiguiéndote ${pts} puntos de ocupación más de los que conseguirías tú`}, a la misma tarifa: de ${f.pct1(q.ocupacionActual * 100)}% a ${f.pct1(q.ocupacionNecesaria * 100)}%`, mark: true },
      { t: ". " },
    );
  }

  // ── 2 · la línea cualitativa, sin números ──
  segs.push({ t: `${auto ? "Puede conseguirlos" : "Puede estar consiguiéndolos"}, o puede conseguir mejor tarifa, y te saca la operación de encima; cuánto más, no lo medimos. Pídele su ocupación de los últimos doce meses en deptos parecidos.` });

  return trimUltimo(segs);
}

/**
 * Cierre de lo que queda del capítulo V tras la fusión (17-sep-2026): el corto contra el
 * arriendo largo. Era el segmento 4 de `cierreGestionStr`, que solo se emitía cuando la
 * sobre-renta era NEGATIVA — colgado de un cierre sobre delegar, y mudo en la mayoría de las
 * filas.
 *
 * Acá habla SIEMPRE, porque ahora es el cierre del capítulo y un capítulo no puede cerrar en
 * blanco. Dos redacciones, por el SIGNO de la sobre-renta y nada más.
 *
 * La unidad es INGRESO NETO (NOI), no flujo, y por eso el capítulo se quedó en NOI: el largo y
 * el corto comparten el mismo dividendo, así que el MONTO de la diferencia es el mismo en las
 * dos unidades, pero el PORCENTAJE no — y en flujo el denominador del largo es negativo en el
 * 92% del parque (medido 16-sep-2026: flujo del largo > 0 en 20 de 252 filas).
 */
export function cierreLargoStr(a: ArgsCierreGestionStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const auto = a.modo === "auto";
  if (a.sobreRenta < 0) {
    segs.push(
      { t: `Ni ${auto ? "autogestionado" : "delegado"} el corto le gana al largo: ` },
      { t: `deja ${f.money(-a.sobreRenta)} menos al mes que arrendar el mismo depto`, mark: true },
      { t: `, con un ingreso neto largo de ${f.money(a.ltrIngresoNeto)}. Lo que decide acá no es quién opera, sino la modalidad.` },
    );
  } else {
    segs.push(
      { t: `${auto ? "Autogestionado" : "Delegado"}, el corto ` },
      { t: `deja ${f.money(a.sobreRenta)} más al mes que arrendar el mismo depto`, mark: true },
      { t: `, sobre un ingreso neto largo de ${f.money(a.ltrIngresoNeto)}. Esa diferencia es la que tiene que pagar el amoblamiento y las horas: compara un corto ya estabilizado contra un largo sin gestión, así que es el techo, no el primer año.` },
    );
  }
  return trimUltimo(segs);
}
