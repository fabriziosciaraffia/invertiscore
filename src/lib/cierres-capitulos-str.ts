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
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} bajo la referencia (${ref}): para rendir como una renta corta acá necesitarías cerca de ${f.money(a.adrRef)} por noche. ` });
  } else if (a.gapPts >= 0.2) {
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} sobre la referencia (${ref}): incluso cobrando ${f.money(a.adrRef)} por noche rendirías como una renta corta, hay holgura. ` });
  } else {
    segs.push({ t: `${cobras} y rindes en línea con la referencia (${ref}): la tarifa de la zona es justo la que hace que este precio se justifique. ` });
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

// ═══════════ CIERRE III · Ocupación en renta corta (confianza de las noches + forma del año) ═══════════
// UNA ORACIÓN (mockup capitulo-iii-noches-str.html, aprobado 22-sep-2026): las noches del caso contra
// las que REALIZARON los avisos parecidos (la rama la decide `ramaOcupacion`, 5 puntos), y cuántos
// meses del año quedan en rojo. No repite la cifra del ramp-up (vive en el bloque del año) ni la
// frontera del veredicto (vive en el capítulo I).

export interface ArgsCierreOcupacionStr {
  /** Noches al año con la ocupación del caso. */
  noches: number;
  ocupacionPct: number;
  ocupacionEsDelUsuario: boolean;
  /** Mediana de ocupación realizada por los avisos parecidos, en %; null sin comparables. */
  realizadaPct: number | null;
  /** cerca (|Δ| ≤ 5 pts) · lejos (realizaron menos) · sobre (realizaron más) · sin (sin comparables). */
  rama: "cerca" | "lejos" | "sobre" | "sin";
  /** Meses del año con flujo negativo (0-12). */
  mesesEnRojo: number;
}

const EN_ROJO = ["ningún mes", "un mes", "dos meses", "tres meses", "cuatro meses", "cinco meses", "seis meses", "siete meses", "ocho meses", "nueve meses", "diez meses", "once meses", "los doce meses"];

export function cierreOcupacionStr(a: ArgsCierreOcupacionStr): SegCierre[] {
  const rojo = EN_ROJO[Math.max(0, Math.min(12, a.mesesEnRojo))];
  // «no deja ningún mes en rojo» con cero: «deja ningún mes» no concuerda.
  const dejaRojo = a.mesesEnRojo === 0 ? "no deja ningún mes en rojo" : `deja ${rojo} en rojo`;
  const origen = a.ocupacionEsDelUsuario ? `Supusiste ${a.noches} noches al año` : `El mercado estima ${a.noches} noches al año para tu depto`;
  const nochesReal = a.realizadaPct != null ? Math.round((a.realizadaPct / 100) * 365) : null;
  if (a.rama === "sin" || nochesReal == null) {
    return [
      { t: `Las ${a.noches} noches son ${a.ocupacionEsDelUsuario ? "tu supuesto" : "la estimación del mercado"} sin avisos parecidos que ${a.ocupacionEsDelUsuario ? "lo" : "la"} contrasten: ` },
      { t: `tómalas como el techo de lo razonable, no como el piso, y el año con ellas ya ${dejaRojo}.`, mark: true },
    ];
  }
  if (a.rama === "cerca") {
    return [
      { t: `${origen} y los avisos parecidos ya las hacen: ` },
      { t: `lo que sigue no descansa en una ocupación optimista, sino en un año que ${dejaRojo}.`, mark: true },
    ];
  }
  if (a.rama === "sobre") {
    return [
      { t: `${origen}, ${nochesReal - a.noches} menos de las que hacen hoy los avisos parecidos: ` },
      { t: `el número es conservador, y aun así el año ${dejaRojo}.`, mark: true },
    ];
  }
  return [
    { t: `${origen}, ${a.noches - nochesReal} más de las que hacen hoy los avisos parecidos: ` },
    { t: a.ocupacionEsDelUsuario
        ? `el veredicto descansa en un número que el mercado no confirma, y aun con esas noches el año ${dejaRojo}.`
        : `todo lo que sigue supone que operas mejor que la mayoría, y aun con esas noches el año ${dejaRojo}.`, mark: true },
  ];
}

// ═══════════ CIERRE IV · «Cómo lo pagas» — RETIRADO (21-sep-2026) ═══════════
// El capítulo ya no cierra con prosa: se ancla al precio recomendado y sus cuatro pasos
// (`como-lo-pagas.ts`). `cierrePagasStr` y `ArgsCierrePagasStr` salieron con él.

// ═══════════ CIERRE V · Cómo lo gestionas (ventaja sobre el largo + qué se lleva la gestión) ═══════════

export interface ArgsCierreGestionStr {
  modo: "auto" | "administrador";
  flujoMensual: number;
  flujoOtroModo: number;
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

// `cierreLargoStr` (el cierre del capítulo V «Corto o largo») se retiró el 22-sep-2026 con la
// ventaja vs LTR.
