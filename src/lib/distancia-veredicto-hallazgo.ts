// Hallazgo tipado de DISTANCIA AL VEREDICTO SUPERIOR para LTR — motor determinístico.
// 10º hallazgo y el cuarto SOLO-LECTURA (tras TIR, sensibilidad y patrimonio).
//
// Espejo de `sensibilidad-hallazgo.ts` con el signo invertido: aquella mide cuánto puede
// CAER el arriendo antes de que el veredicto baje; esta mide cuánto tiene que MEJORAR
// alguna palanca para que el veredicto SUBA. Responde la pregunta que el informe hoy deja
// muda: "¿y ahora qué?".
//
// MÉTODO (bisección por palanca, veredicto-only). El builder NO corre el pipeline: recibe
// de runAnalysis el closure `veredictoAtPatch(patch)` que reevalúa el veredicto sobre un
// clon del input, usando la MISMA ruta que produce el veredicto canónico (calcMetrics →
// score → breakEven → deriveVeredicto, vía veredictoConPatch). Como el hallazgo se siembra
// en runAnalysis y no dentro de calcMetrics, esa ruta NO reconstruye hallazgos → sin
// recursión. Idéntico contrato al de sensibilidad, que usa el mismo closure.
//
// TRES PALANCAS SIEMPRE, cada una biseccionada por separado hasta el primer valor que cruza:
//   · arriendo — sube (CLP/mes)
//   · precio   — baja (UF)
//   · plazo    — sube (años enteros, tope duro 30)
// La TASA no se emite aunque `veredictoAtPatch` la soporte: es condición del banco, no del
// deal (decisión de producto).
//
// CUARTA PALANCA — el PIE. Se explora SIEMPRE hasta `DIST_PIE_TOPE_PCT` salvo bono pie o
// pie ya en el techo (decisión Fabrizio 02-sep-2026, goal "cuatro palancas siempre": la
// banda de `classifyPieLevel` dejó de decidir la exploración). Cuando cruza va PRIMERA:
// es la única que no depende de que el vendedor acepte ni de que el mercado acompañe.
//
// CUATRO VÍAS SIEMPRE (`valor.vias`): cada palanca sale con su estado por construcción —
// cruza · noCruza (con el tope explorado y una razón de catálogo) · noAplica—, en orden
// canónico precio · arriendo · plazo · pie. `palancas` es `vias.filter(cruza)`.
//
// TOPE DE HONESTIDAD: los rangos de búsqueda SON el tope. Si ninguna palanca cruza dentro
// de su rango realista, `esEstructural = true` y la frase deja de prometer un ajuste. El
// tope se calibró sobre 315 filas no-COMPRAR de prod (of-sweep-distancia.ts) — ver
// DIST_TOPE_AJUSTA_PCT / DIST_TOPE_BUSCAR_PCT abajo para la justificación numérica.
//
// DOS CASOS DE OMISIÓN (return null):
//   1. veredicto base COMPRAR ⇒ no hay veredicto superior al que llegar.
//   2. arriendo o precio no computables ⇒ no se puede escalar una palanca.

import type {
  HallazgoDistanciaVeredicto,
  PalancaDistancia,
  RazonSinCapital,
  Veredicto,
  ViaDistancia,
} from "./types";
import { classifyPieLevel } from "./financing-health";

// ── Tope de honestidad (calibrado, no inventado) ──────────────────────────────
// Sweep sobre 315 filas no-COMPRAR de prod (143 AJUSTA + 172 BUSCAR OTRA), midiendo el
// delta mínimo por palanca hasta el veredicto superior (of-sweep-distancia.ts):
//   AJUSTA → COMPRAR : arriendo p25 10,9% · MEDIANA 23,8% · p90 31,4% · máx 37,3%
//   BUSCAR → AJUSTA  : arriendo MEDIANA 72,7% · p90 99,3%   (precio: mediana 40,8%)
//
// El tope es POR VEREDICTO porque las dos poblaciones no se parecen en nada:
//
// · AJUSTA SUPUESTOS ⇒ 30%. Un tope de 15% dejaría al 61% de los AJUSTA rotulados
//   "estructural" — el veredicto que literalmente se llama "ajusta supuestos" diría que no
//   hay ajuste posible. Con 30% quedan 11% según el sweep — y solo 1% (2 de 143) una vez
//   que el plazo pasa a tramos comerciales, porque el redondeo a 30 años rescata la cola.
//   Ninguna de estas filas dispara Gate 1 (0 brazos en las 143).
//
// · BUSCAR OTRA ⇒ 15%. Acá el veredicto YA disparó al menos un brazo del Gate 1, así que
//   la vara para declararlo "recuperable" es más alta a propósito. El corpus lo respalda:
//   con UN brazo activo el delta mediano es 4,0% (p90 11,2% — cae entero bajo 15%), y con
//   dos o más salta a ~74%. El 15% separa esas dos poblaciones sin hardcodear los brazos,
//   y deja 90% de los BUSCAR OTRA como estructurales.
export const DIST_TOPE_AJUSTA_PCT = 30;
export const DIST_TOPE_BUSCAR_PCT = 15;

/** Tope aplicable según el veredicto de partida. */
export const topeParaVeredicto = (v: Veredicto): number =>
  v === "BUSCAR OTRA" ? DIST_TOPE_BUSCAR_PCT : DIST_TOPE_AJUSTA_PCT;

// ── Bandas de esfuerzo del descuento de precio (doctrina §1.12.1) ─────────────
// La banda se calcula ACÁ (función pura del delta — patrón §1.1: la clasificación
// se resuelve en la fuente) y llega al prompt como DATO con su lenguaje canónico;
// la IA la narra, nunca la clasifica. Los cortes 5/12 son doctrinales (lenguaje);
// los topes duros siguen siendo los DIST_TOPE_* de arriba. Sobre el tope no hay
// banda: es el caso estructural, que cierra la puerta con su propia frase.
export type BandaEsfuerzo = "normal" | "con_argumentos" | "dificil";

export function bandaEsfuerzoDescuento(deltaPctAbs: number): {
  banda: BandaEsfuerzo;
  lectura: string;
} {
  if (deltaPctAbs <= 5) {
    return {
      banda: "normal",
      lectura:
        "negociación normal — esto es lo que se conversa en cualquier compraventa; parte natural del cierre, sin épica",
    };
  }
  if (deltaPctAbs <= 12) {
    return {
      banda: "con_argumentos",
      lectura:
        "alcanzable con argumentos — exigente pero dentro de lo que se negocia cuando hay razones, y los argumentos van en la MISMA pieza",
    };
  }
  return {
    banda: "dificil",
    lectura:
      "difícil, requiere vendedor motivado — posible solo si el vendedor necesita vender; si no cede, la respuesta honesta es mirar otra propiedad, no forzar esta. Va SIEMPRE acompañado del plan B (la alternativa inter-comuna o esperar)",
  };
}

// ── Caso precio-justo (§1.12.4) — FUENTE ÚNICA de la detección ────────────────
// Condición dura Y-ada, nunca "o". La comparten runAnalysis (siembra el flag en
// el hallazgo → cierre estructural + render) y el builder del prompt LTR (que NO
// puede leer el flag del hallazgo recomputado: su recompute corre sin mediana —
// ai-generation.ts:902 — y ahí desviacionPct es null por construcción).
// La alineación se exige contra LAS DOS referencias de precio: la validación pv4
// cazó un caso (4daf13eb) con mediana "alineada" y vmFranco +69% — referencias
// contradictorias (dualidad D10); eso NO es precio-justo, es datos en pugna.
export function esCasoPrecioJusto(p: {
  /** metrics.precioVsComuna.desviacionPct — null sin mediana confiable. */
  desviacionPct: number | null | undefined;
  precioUF: number;
  /** valorMercadoFranco resuelto (con fallback al precio ya aplicado). */
  vmFrancoUF: number;
  ufClp: number;
  arriendoCLP: number;
  /** Referencia de comparables (null = sin dato ⇒ la condición NO se cumple). */
  arriendoRefCLP: number | null;
  /** Procedencia estimación propia ⇒ brecha 0 por construcción. */
  arriendoEsEstimacionFranco: boolean;
  veredicto: Veredicto;
}): boolean {
  if (p.desviacionPct == null || Math.abs(p.desviacionPct) > 5) return false;
  // Diferencia VÁLIDA contra el vm (> $1M CLP): excluye el fallback vm = precio,
  // que es "sin dato", no "alineado".
  if (Math.abs((p.vmFrancoUF - p.precioUF) * p.ufClp) <= 1_000_000) return false;
  if (!(p.precioUF > 0) || Math.abs(p.vmFrancoUF / p.precioUF - 1) > 0.05) return false;
  const arriendoEnBanda =
    p.arriendoEsEstimacionFranco ||
    (p.arriendoRefCLP != null && p.arriendoRefCLP > 0 && Math.abs(p.arriendoCLP / p.arriendoRefCLP - 1) <= 0.10);
  if (!arriendoEnBanda) return false;
  return p.veredicto === "AJUSTA SUPUESTOS" || p.veredicto === "BUSCAR OTRA";
}

/**
 * Variante STR de la detección (función HERMANA, documentada junto a la LTR a
 * propósito — parametrizar una sola ocultaría qué pata aplica a qué modalidad).
 * STR no tiene `valorMercadoFranco` en su input, así que la pata "dos
 * referencias" de LTR no es replicable; la robustez viene de exigir:
 *   (1) precio a mercado: |desviación| ≤ 5 contra mediana comunal CONFIABLE
 *       (misma banda que LTR; el dato sale del hallazgo de sobreprecio STR);
 *   (2) ingreso a mercado: tarifa Y ocupación ancladas a la mediana observada —
 *       CERO overrides del usuario (con override el caso corre sobre un
 *       supuesto humano, no sobre el mercado, y ese caveat ya tiene dueño:
 *       §3-override del prompt STR);
 *   (3) veredicto degradado.
 * Reencuadre canónico STR: "esta zona no sostiene renta corta a los precios de
 * compra actuales".
 */
export function esCasoPrecioJustoStr(p: {
  /** desviacionPct del hallazgo de sobreprecio STR — null sin mediana confiable. */
  desviacionPct: number | null | undefined;
  adrOverride: number | null | undefined;
  occOverride: number | null | undefined;
  veredicto: Veredicto;
}): boolean {
  if (p.desviacionPct == null || Math.abs(p.desviacionPct) > 5) return false;
  if (p.adrOverride != null || p.occOverride != null) return false;
  return p.veredicto === "AJUSTA SUPUESTOS" || p.veredicto === "BUSCAR OTRA";
}

// ── Palanca PIE (condicional) ─────────────────────────────────────────────────
//
// UMBRAL DE EMISIÓN: el pie es palanca solo cuando `classifyPieLevel` lo clasifica
// "mejorable" o "problematico" (< 20%). NO se usa el óptimo (25%) como corte, y la razón
// es del corpus: de 507 análisis LTR no-COMPRAR, 503 tienen pie bajo 25% — 433 de ellos
// exactamente en 20%, que es el default del wizard. Con corte en 25% la palanca dispararía
// en el 99% del parque, y una palanca que sale siempre no es condicional: es una cuarta
// palanca fija con un nombre equivocado.
//
// El corte en 20% además evita que Franco se contradiga dentro del mismo informe: entre
// 20% y 24% el hallazgo de estructura le dice al usuario "el pie de X% cumple" (nivel
// `aceptable`). Ofrecerle ahí el pie como la vía sería desdecir esa línea. Bajo 20% el pie
// ES el punto débil diagnosticado, y la doctrina (analysis-voice-franco §1.5 niveles 2-3)
// ya enmarca subirlo como la recomendación. Población real: 70 de 507 (14%).
//
// TECHO: el pie objetivo no puede pasar de 30%. Sobre el óptimo (25%) queda un escalón de
// margen; más arriba la frase deja de ser "afirma tu estructura" y pasa a ser "trae mucho
// más capital" — a alguien con 10% declarado, pedirle 40% es cuadruplicar el capital, que
// ya no es un ajuste de supuestos. Medido sobre los 66 elegibles: con techo 30 emiten 16
// (24%); con 40 emiten 23 y la mediana del pedido se va a 37%.
//
// El techo es ABSOLUTO (nivel de pie), no relativo al declarado: el pie es un nivel, no un
// cambio, y con pie 0 un tope relativo ni siquiera está definido.
export const DIST_PIE_TOPE_PCT = 30;

/**
 * Excepción BONO PIE: con `razonSinPie === "bono_pie"` la palanca NO se emite. El pie 0 es
 * la condición de esa compra —la inmobiliaria lo cubre—, así que "sube el pie" es consejo
 * inútil: desarma el trato que se está evaluando. La doctrina ya manda por otro lado
 * (analysis-voice-franco §1.11.4: con pie 0 la dureza va al precio).
 *
 * Las otras razones SÍ reciben la palanca:
 *   · "otra_fuente"  — el pie lo cubre el comprador con ahorro/familia/otra propiedad, o
 *     sea que SÍ puede movilizar capital. Ofrecerle poner más es accionable.
 *   · "no_declarada" — prefirió no decirlo. Conservador: se trata como sin_pie y se ofrece.
 *   · "sin_pie"      — no se preguntó (compat). Se ofrece.
 */
export const DIST_PIE_RAZON_EXCLUIDA = "bono_pie";

/** Tope duro del plazo del crédito (años). Sobre esto ningún banco chileno presta. */
export const DIST_PLAZO_TOPE_ANIOS = 30;

/** Tramo comercial del plazo: los bancos ofrecen 15/20/25/30, no años sueltos. */
export const DIST_PLAZO_TRAMO_ANIOS = 5;

// Rango EXTENDIDO para el caso estructural. Cuando ninguna palanca cruza dentro del tope,
// la frase necesita el delta mínimo REAL — "más de un 15%" es el umbral, no el dato, y deja
// al usuario sin saber si está a 16% o a 80%. Estos límites son de búsqueda, no promesas:
// lo que se encuentra acá NUNCA entra a `palancas` (esas son solo las accionables), solo
// alimenta `deltaMinimoFueraDeTope` para respaldar la frase dura con un número.
const DIST_EXT_ARRIENDO_MAX = 2.5;  // +150%
const DIST_EXT_PRECIO_MIN = 0.30;   // −70%

/** Precisión de la bisección de arriendo/precio, en puntos porcentuales. */
const DIST_PREC_PTS = 0.1;

const RANK: Record<Veredicto, number> = {
  "BUSCAR OTRA": 0,
  "AJUSTA SUPUESTOS": 1,
  COMPRAR: 2,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// Sin decimal si es entero (4%), coma chilena si no (4,2%) — misma regla que sensibilidad.
const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtUF = (n: number) => "UF " + Math.round(n).toLocaleString("es-CL");

/**
 * Bisección sobre un factor multiplicativo. `subiendo` indica si el factor crece para
 * alcanzar el objetivo (arriendo) o decrece (precio). Devuelve el factor más cercano a 1
 * que ya cruza, o null si ni el extremo del rango alcanza.
 */
export function biseccionFactor(
  alcanza: (factor: number) => boolean,
  extremo: number,
  subiendo: boolean,
): number | null {
  if (!alcanza(extremo)) return null;
  let lo = subiendo ? 1 : extremo;
  let hi = subiendo ? extremo : 1;
  const prec = DIST_PREC_PTS / 100;
  while (hi - lo > prec) {
    const mid = (lo + hi) / 2;
    // Invariante: el lado que YA cruza se acerca a 1; el que no cruza se aleja.
    if (alcanza(mid) === subiendo) hi = mid;
    else lo = mid;
  }
  return subiendo ? hi : lo;
}

/**
 * Construye el proto-hallazgo de DISTANCIA AL VEREDICTO SUPERIOR.
 * SOLO-LECTURA: decisividad 0 fija. Devuelve null en COMPRAR y con datos no computables.
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la reescribe
 * aguas abajo. Voz: tuteo neutro chileno, consecuencia vivida — nunca narra la mecánica
 * ("el gate", "la banda del score"), siempre "subir el arriendo a $X lo lleva a COMPRAR".
 */
export function buildHallazgoDistanciaVeredicto(p: {
  /** Veredicto al input declarado — el canónico ya computado por runAnalysis. */
  veredictoBase: Veredicto;
  arriendo: number;
  /** Precio en UF (unidad del input, no CLP). */
  precioUF: number;
  plazoCredito: number;
  /** Pie declarado como % del precio. Decide si la 4ª palanca se emite (ver DIST_PIE_*). */
  piePct: number;
  /** Origen del pie 0. Solo tiene sentido con piePct === 0; ausente ⇒ "sin_pie". */
  razonSinPie?: RazonSinCapital;
  /** Reevalúa el veredicto sobre un clon del input con el patch aplicado. */
  veredictoAtPatch: (patch: {
    arriendo?: number;
    precio?: number;
    plazoCredito?: number;
    piePct?: number;
  }) => Veredicto;
  /** Brazos del GATE 1 activos hoy (nombres). Informativo: no decide esEstructural. */
  brazosGate1Activos: string[];
  modalidad: "ltr" | "str" | "ambas";
  /**
   * Caso precio-justo (§1.12.4): precio Y arriendo a mercado con veredicto
   * degradado. Lo detecta runAnalysis con la condición dura Y-ada; acá solo
   * cambia el CIERRE del caso estructural — "la brecha es del deal" es falsa
   * cuando el deal está a mercado: la brecha es de lo que rinde la zona.
   */
  casoPrecioJusto?: boolean;
}): HallazgoDistanciaVeredicto | null {
  // Caso de omisión 1: COMPRAR ⇒ no hay veredicto superior.
  if (p.veredictoBase === "COMPRAR") return null;
  // Caso de omisión 2: palancas no escalables.
  if (!Number.isFinite(p.arriendo) || p.arriendo <= 0) return null;
  if (!Number.isFinite(p.precioUF) || p.precioUF <= 0) return null;

  const veredictoObjetivo: Veredicto =
    p.veredictoBase === "BUSCAR OTRA" ? "AJUSTA SUPUESTOS" : "COMPRAR";

  // ── ¿El pie SE EXPLORA como palanca? (goal "cuatro palancas siempre", 02-sep-2026) ──
  // Dos exclusiones, ninguna por banda: el bono pie (ver DIST_PIE_RAZON_EXCLUIDA) y el pie
  // que ya está en el techo (≥ DIST_PIE_TOPE_PCT: no hay tramo que probar). Hasta este goal
  // solo se exploraba con pie < 20% (`classifyPieLevel` mejorable/problemático); el drift
  // del Golden por pies entre 20 y 29 que ahora cruzan es esperado y está documentado.
  const razonPie: RazonSinCapital = p.razonSinPie ?? "sin_pie";
  const esBonoPie = p.piePct === 0 && razonPie === DIST_PIE_RAZON_EXCLUIDA;
  const pieEnTecho = !Number.isFinite(p.piePct) || p.piePct >= DIST_PIE_TOPE_PCT;
  const pieCalifica = !esBonoPie && !pieEnTecho;
  // ¿El pie tiene PRIORIDAD sobre las otras palancas cuando cruza? Solo bajo el nivel
  // aceptable (misma clasificación que el hallazgo de estructura, fuente única).
  const nivelPie = Number.isFinite(p.piePct) ? classifyPieLevel(p.piePct) : "optimo";
  const piePrioritario = nivelPie === "mejorable" || nivelPie === "problematico";

  const alcanzaMeta = (v: Veredicto, meta: Veredicto) => RANK[v] >= RANK[meta];
  // El tope gobierna el SALTO que se está midiendo, no el veredicto de partida: el salto de
  // una banda usa el tope del veredicto base; el de dos bandas (BUSCAR → COMPRAR, solo
  // informativo) usa el de AJUSTA, que es el tramo que decide llegar a COMPRAR.
  const topeDe = (meta: Veredicto) =>
    meta === "COMPRAR" ? DIST_TOPE_AJUSTA_PCT : topeParaVeredicto(p.veredictoBase);
  const topeAplicado = topeParaVeredicto(p.veredictoBase);

  /** Explora las CUATRO palancas para una meta dada. `palancas` = solo las que cruzan
   *  dentro del tope (orden: pie primero, luego por |delta|); `vias` = las cuatro con su
   *  estado, en orden canónico precio · arriendo · plazo · pie. */
  const palancasHasta = (meta: Veredicto): { palancas: PalancaDistancia[]; vias: ViaDistancia[] } => {
    const out: PalancaDistancia[] = [];
    const tope = topeDe(meta);
    let viaArriendo: ViaDistancia;
    let viaPrecio: ViaDistancia;
    let viaPlazo: ViaDistancia;
    let viaPie: ViaDistancia;
    const topeFactor = 1 + tope / 100; // arriendo: sube hasta +tope%
    const pisoFactor = 1 - tope / 100; // precio: baja hasta −tope%

    const fArr = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ arriendo: Math.round(p.arriendo * f) }), meta),
      topeFactor,
      true,
    );
    if (fArr != null) {
      const objetivo = Math.ceil(p.arriendo * fArr);
      const pal: PalancaDistancia = {
        palanca: "arriendo",
        objetivo,
        actual: p.arriendo,
        deltaPct: Math.round((objetivo / p.arriendo - 1) * 1000) / 10,
        deltaAbs: objetivo - p.arriendo,
      };
      out.push(pal);
      viaArriendo = { estado: "cruza", ...pal };
    } else {
      viaArriendo = {
        estado: "noCruza",
        palanca: "arriendo",
        actual: p.arriendo,
        topeExplorado: tope,
        razon: `ni con el arriendo un ${tope}% más alto cambia el veredicto`,
      };
    }

    const fPre = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ precio: p.precioUF * f }), meta),
      pisoFactor,
      false,
    );
    if (fPre != null) {
      const objetivo = Math.floor(p.precioUF * fPre);
      const pal: PalancaDistancia = {
        palanca: "precio",
        objetivo,
        actual: p.precioUF,
        deltaPct: Math.round((objetivo / p.precioUF - 1) * 1000) / 10, // negativo
        deltaAbs: objetivo - p.precioUF,
      };
      out.push(pal);
      viaPrecio = { estado: "cruza", ...pal };
    } else {
      viaPrecio = {
        estado: "noCruza",
        palanca: "precio",
        actual: p.precioUF,
        topeExplorado: tope,
        razon: `ni bajando el precio un ${tope}% cambia el veredicto`,
      };
    }

    // Plazo: entero, del actual+1 al tope. Barrido lineal (≤ 30 evaluaciones, sin bisección
    // porque el dominio es discreto y chico). El plazo exacto que cruza NO es el que se
    // emite: los bancos chilenos ofrecen tramos de 5 años (15/20/25/30), así que un "28
    // años" es un número que el usuario no puede pedir. Se redondea hacia ARRIBA al
    // múltiplo de 5 siguiente (más plazo ⇒ cuota más baja ⇒ el cruce se mantiene) y se
    // RE-VERIFICA el veredicto en ese plazo comercial antes de emitirlo: si por cualquier
    // no-monotonía el redondeo no cruzara, la palanca no se emite en vez de prometer algo
    // falso. Si ya estás en el tope (30), no hay tramo al que moverse ⇒ tampoco se emite.
    if (!Number.isFinite(p.plazoCredito) || p.plazoCredito <= 0) {
      viaPlazo = { estado: "noAplica", palanca: "plazo", actual: 0, razon: "sin crédito no hay plazo que estirar" };
    } else if (p.plazoCredito >= DIST_PLAZO_TOPE_ANIOS) {
      viaPlazo = {
        estado: "noAplica",
        palanca: "plazo",
        actual: p.plazoCredito,
        razon: `ya en ${DIST_PLAZO_TOPE_ANIOS} años: es el máximo que dan los bancos`,
      };
    } else {
      viaPlazo = {
        estado: "noCruza",
        palanca: "plazo",
        actual: p.plazoCredito,
        topeExplorado: DIST_PLAZO_TOPE_ANIOS,
        razon: `ni a ${DIST_PLAZO_TOPE_ANIOS} años cambia el veredicto`,
      };
      for (let anios = Math.floor(p.plazoCredito) + 1; anios <= DIST_PLAZO_TOPE_ANIOS; anios++) {
        if (!alcanzaMeta(p.veredictoAtPatch({ plazoCredito: anios }), meta)) continue;
        const comercial = Math.min(
          DIST_PLAZO_TOPE_ANIOS,
          Math.ceil(anios / DIST_PLAZO_TRAMO_ANIOS) * DIST_PLAZO_TRAMO_ANIOS,
        );
        // Re-verificación en el tramo comercial (no se asume la monotonía del motor).
        if (
          comercial > p.plazoCredito &&
          alcanzaMeta(p.veredictoAtPatch({ plazoCredito: comercial }), meta)
        ) {
          const pal: PalancaDistancia = {
            palanca: "plazo",
            objetivo: comercial,
            actual: p.plazoCredito,
            deltaPct: Math.round((comercial / p.plazoCredito - 1) * 1000) / 10,
            deltaAbs: comercial - p.plazoCredito,
          };
          out.push(pal);
          viaPlazo = { estado: "cruza", ...pal };
        }
        break;
      }
    }

    // Más barata primero: |deltaPct| ascendente. Comparable entre estas tres porque las
    // tres se expresan como cambio relativo sobre el valor declarado.
    out.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));

    // PIE — cuarta palanca, condicional y PRIORITARIA. Va al frente sin entrar al sort de
    // arriba: su deltaPct está en puntos porcentuales, no en cambio relativo, así que
    // compararla contra las otras por |deltaPct| mezclaría unidades. La prioridad no es
    // cosmética — es la única vía que no depende de que el vendedor acepte bajar el precio
    // ni de que el mercado de arriendo dé más.
    //
    // Barrido lineal por punto porcentual ENTERO (dominio chico, ≤30 evaluaciones) en vez
    // de bisección: el pie se elige en enteros, no en 26,4%. NO se redondea a múltiplos de
    // 5 como el plazo — los bancos ofrecen 15/20/25/30 años de plazo, pero el pie es un
    // monto continuo que el comprador arma. Redondear un 26% a 30% pediría 4 puntos de
    // capital extra que el caso no necesita (≈ UF 120 en un depto de UF 3.000).
    if (esBonoPie) {
      viaPie = { estado: "noAplica", palanca: "pie", actual: p.piePct, razon: "el pie lo cubre la inmobiliaria: subirlo desarma el trato" };
    } else if (pieEnTecho) {
      viaPie = {
        estado: "noAplica",
        palanca: "pie",
        actual: p.piePct,
        razon: `ya con ${fmtPct(p.piePct)}% de pie: sobre ${DIST_PIE_TOPE_PCT}% Franco no lo prueba como ajuste`,
      };
    } else {
      viaPie = {
        estado: "noCruza",
        palanca: "pie",
        actual: p.piePct,
        topeExplorado: DIST_PIE_TOPE_PCT,
        razon: `ni con un pie de ${DIST_PIE_TOPE_PCT}% cambia el veredicto`,
      };
      for (let pie = Math.floor(p.piePct) + 1; pie <= DIST_PIE_TOPE_PCT; pie++) {
        if (!alcanzaMeta(p.veredictoAtPatch({ piePct: pie }), meta)) continue;
        const pal: PalancaDistancia = {
          palanca: "pie",
          objetivo: pie,
          actual: p.piePct,
          // PUNTOS porcentuales (ver PalancaDistancia.deltaPct): con pie 0 el cambio
          // relativo no existe.
          deltaPct: Math.round((pie - p.piePct) * 10) / 10,
          deltaAbs: Math.round((pie - p.piePct) * 10) / 10,
        };
        // PRIORIDAD (decisión Fabrizio 02-sep-2026): el pie va PRIMERO —y por lo tanto es
        // `palancaMasBarata`, el titular del hero— solo cuando el pie actual está bajo el
        // nivel aceptable (< 20%, `classifyPieLevel` mejorable/problemático), que es donde
        // el pie ES el punto débil diagnosticado. Con pie ≥ 20% que igual cruza, la vía
        // existe y la matriz la muestra como `cruza`, pero va al FINAL: un pie que ya
        // cumple no debe desplazar al arriendo o al precio como la palanca del titular.
        // Medido en el parque antes de esta regla: 129 filas con pie 20-29 pasaban a
        // titular por el pie teniendo otra palanca que también cruzaba.
        // Si es la ÚNICA que cruza, queda como palancaMasBarata igual (no hay otra).
        if (piePrioritario) out.unshift(pal);
        else out.push(pal);
        viaPie = { estado: "cruza", ...pal };
        break;
      }
    }

    return { palancas: out, vias: [viaPrecio, viaArriendo, viaPlazo, viaPie] };
  };

  const explorado = palancasHasta(veredictoObjetivo);
  const palancas = explorado.palancas;
  let vias = explorado.vias;
  const palancaMasBarata = palancas[0] ?? null;
  const esEstructural = palancas.length === 0;

  // Estructural: se busca el delta mínimo en rango EXTENDIDO, solo para respaldar la frase
  // dura con el número real. No entra a `palancas` — no es accionable, es evidencia. Se
  // computa solo en este caso (2 bisecciones extra) para no pagarlo en los recuperables.
  let deltaMinimoFueraDeTope: HallazgoDistanciaVeredicto["valor"]["deltaMinimoFueraDeTope"] = null;
  if (esEstructural) {
    const candidatos: { palanca: "arriendo" | "precio"; deltaPct: number }[] = [];
    const fArrExt = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ arriendo: Math.round(p.arriendo * f) }), veredictoObjetivo),
      DIST_EXT_ARRIENDO_MAX,
      true,
    );
    if (fArrExt != null) {
      candidatos.push({ palanca: "arriendo", deltaPct: Math.round((fArrExt - 1) * 1000) / 10 });
    }
    const fPreExt = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ precio: p.precioUF * f }), veredictoObjetivo),
      DIST_EXT_PRECIO_MIN,
      false,
    );
    if (fPreExt != null) {
      candidatos.push({ palanca: "precio", deltaPct: Math.round((fPreExt - 1) * 1000) / 10 });
    }
    // El "mínimo" es el de menor esfuerzo relativo; null si ni el rango extendido cruza
    // (existe: hay deals que no llegan ni al +150% de arriendo).
    //
    // El PIE queda deliberadamente fuera de este candidato: su delta está en puntos
    // porcentuales y estos dos en cambio relativo, así que el sort los mezclaría. Un
    // "delta mínimo de pie fuera de tope" necesitaría campo y copy propios; hoy no se
    // emite y el caso estructural nombra el pie sin cifra (ver el Lead del drawer).
    candidatos.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
    deltaMinimoFueraDeTope = candidatos[0] ?? null;
    // La vía del delta mínimo lleva la cifra real (dato del motor, no invento del render).
    const dm = deltaMinimoFueraDeTope;
    if (dm) {
      vias = vias.map((v) => (v.estado === "noCruza" && v.palanca === dm.palanca ? { ...v, deltaMinimoPct: dm.deltaPct } : v));
    }
  }

  // Solo para BUSCAR OTRA: ¿el salto de DOS bandas cae en rango? Informativo; si no, null.
  const palancaHastaComprar =
    p.veredictoBase === "BUSCAR OTRA" && !esEstructural
      ? (palancasHasta("COMPRAR").palancas[0] ?? null)
      : null;

  // Cercanía al umbral (1 = pegado al veredicto de arriba, 0 = en el tope o estructural).
  // Va DENTRO de `valor`, NO en magnitudContinua: ese campo lo leen los comparadores de la
  // pirámide y del hero, donde compite contra |Δscore|/25 — otra escala, otra pregunta.
  // Se mide sobre la palanca RELATIVA más barata, no sobre `palancaMasBarata`: el pie va
  // primero por prioridad y su deltaPct está en puntos porcentuales, así que dividirlo por
  // un tope expresado en cambio relativo mezclaría unidades y daría una cercanía falsa.
  const masBarataRelativa = palancas.find((l) => l.palanca !== "pie") ?? null;
  const cercaniaUmbral = masBarataRelativa
    ? clamp01(1 - Math.abs(masBarataRelativa.deltaPct) / topeAplicado)
    : 0;

  const objetivoNombre = veredictoObjetivo;
  let titular: string;
  let fraseCanonica: string;

  if (esEstructural) {
    titular = "Ningún ajuste realista lo lleva al veredicto de arriba.";
    // Con delta mínimo real, la frase cita el HECHO ("ni bajando el precio un 34%") en vez del
    // umbral ("más de un 15%") — el umbral es nuestra vara, el hecho es del deal. Sin él
    // (rango extendido tampoco cruza) la frase es aún más dura y no necesita número.
    const dm = deltaMinimoFueraDeTope;
    // Cuando el pie calificaba como palanca y aun así no cruzó dentro del techo, la frase
    // tiene que decirlo: si no, un lector con pie 10% queda pensando que la vía obvia ni
    // se probó. Sin cifra a propósito — el pie fuera de techo no tiene delta emitido.
    const colaPie = pieCalifica ? ` Subir el pie hasta ${DIST_PIE_TOPE_PCT}% tampoco lo cruza.` : "";
    // Cierre del estructural (§1.12.4): con precio Y arriendo a mercado, "la
    // brecha es del deal" es falsa — el deal está a mercado; lo que no rinde a
    // estos precios es la zona. Variante canónica del skill.
    const cierreBrecha = p.casoPrecioJusto
      ? "La brecha no es de este depto ni del precio que pide — es de lo que esta zona rinde hoy. Otro depto igual, acá mismo, tendría el mismo problema."
      : "La brecha es del deal, no de cómo lo estás mirando.";
    if (dm) {
      const via =
        dm.palanca === "precio"
          ? `bajando el precio un ${fmtPct(Math.abs(dm.deltaPct))}%`
          : `subiendo el arriendo un ${fmtPct(Math.abs(dm.deltaPct))}%`;
      fraseCanonica =
        `Ni ${via} este depto llega a ${objetivoNombre}, y estirar el crédito a ${DIST_PLAZO_TOPE_ANIOS} años ` +
        `tampoco alcanza.${colaPie} ${cierreBrecha}`;
    } else {
      fraseCanonica =
        `No hay ajuste de supuestos que lleve esto a ${objetivoNombre}: ni subiendo el arriendo a más del ` +
        `doble, ni pagando un tercio del precio, ni estirando el crédito a ${DIST_PLAZO_TOPE_ANIOS} años.${colaPie} ` +
        `${cierreBrecha}`;
    }
  } else {
    const l = palancaMasBarata!;
    const d = fmtPct(Math.abs(l.deltaPct));
    // ¿CUÁNTAS MÁS CRUZAN? La frase se redacta para la palanca más barata, y hasta
    // acá afirmaba exclusividad ("es la única vía") aunque el hallazgo listara
    // cuatro. No era una licencia del modelo: la prosa copiaba esta oración tal
    // cual —medido en un caso con pie, arriendo, precio y plazo cruzando, donde el
    // informe terminó diciendo "la condición concreta es una sola"—. El motor
    // emite datos; cuando además redacta afirmaciones, el modelo las repite sin
    // poder verificarlas.
    const otrasVias = palancas.length - 1;
    const hayMas = otrasVias > 0;
    /** Cola honesta para la rama con varias vías: nombra la pluralidad sin
     *  adjetivar exclusividad y remite a la tabla, que es donde se comparan. */
    const colaOtrasVias = otrasVias === 1
      ? " Hay otra vía que también cruza; la tabla las compara."
      : ` Hay ${otrasVias} vías más que también cruzan; la tabla las compara.`;
    if (l.palanca === "pie") {
      // Pie 0 y pie bajo son dos historias distintas (analysis-voice-franco §1.11.1: con
      // pie 0 no hay "pie chico que subir", hay otra estructura de compra). El monto se
      // nombra como NIVEL de pie, nunca como "un X% más de pie", que se leería como
      // aumento relativo sobre un pie que puede ser cero.
      titular = hayMas
        ? "Hay más de una vía al veredicto de arriba."
        : "Está a un pie de distancia del veredicto de arriba.";
      // La cláusula de exclusividad SOLO cuando es cierta. Con más vías, el pie
      // conserva lo que sí lo distingue —es el que menos depende de terceros— sin
      // afirmar que es el único.
      const rasgoPie = hayMas
        ? `Es la que menos depende de terceros: no necesita que el vendedor acepte ni que el arriendo acompañe.${colaOtrasVias}`
        : `Es la única vía que no depende de que el vendedor acepte ni de que el mercado de arriendo acompañe: depende de tu liquidez.`;
      fraseCanonica =
        p.piePct === 0
          ? `Hoy estás financiando el 100%. Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ` +
            `poniendo un pie de ${fmtPct(l.objetivo)}%, sin tocar el precio ni el arriendo: menos crédito ` +
            `es menos cuota, y la cuota es lo que hoy no cierra.${hayMas ? colaOtrasVias : ""}`
          : `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} subiendo el pie de ${fmtPct(l.actual)}% ` +
            `a ${fmtPct(l.objetivo)}%, sin tocar el precio ni el arriendo. ${rasgoPie}`;
    } else if (l.palanca === "arriendo") {
      titular = "Está cerca del veredicto de arriba por el lado del arriendo.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} si el arriendo llega a ${fmtCLP(l.objetivo)} ` +
        `al mes —un ${d}% sobre los ${fmtCLP(l.actual)} que declaraste—. Antes de descartarlo, confirma ese ` +
        `techo de arriendo contra publicaciones reales de la zona.${hayMas ? colaOtrasVias : ""}`;
    } else if (l.palanca === "precio") {
      titular = "Está cerca del veredicto de arriba por el lado del precio.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} si cierras en ${fmtUF(l.objetivo)} en vez de ` +
        `${fmtUF(l.actual)} —un ${d}% menos—. Es una diferencia de negociación, no de otro departamento.${hayMas ? colaOtrasVias : ""}`;
    } else {
      titular = "Está cerca del veredicto de arriba por el lado del crédito.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} estirando el crédito de ${l.actual} a ` +
        `${l.objetivo} años, sin cambiar el precio ni el arriendo. Alarga la deuda y pagas más intereses en total; ` +
        `a cambio, el aporte mensual baja lo suficiente para cruzar.${hayMas ? colaOtrasVias : ""}`;
    }
  }

  return {
    id: "distancia_veredicto",
    tipo: "distancia_umbral",
    valor: {
      veredictoBase: p.veredictoBase,
      veredictoObjetivo,
      palancas,
      vias,
      palancaMasBarata,
      palancaHastaComprar,
      esEstructural,
      deltaMinimoFueraDeTope,
      topePct: topeAplicado,
      cercaniaUmbral,
      brazosGate1Activos: p.brazosGate1Activos,
      pieEsPalanca: pieCalifica,
      pieExcluidoPorBono: esBonoPie,
      piePctActual: Number.isFinite(p.piePct) ? p.piePct : undefined,
      casoPrecioJusto: p.casoPrecioJusto === true,
      modalidad: p.modalidad,
    },
    // NEUTRAL: es un mapa de la distancia al umbral, no una señal sobre el deal. Marcarlo
    // adverso lo hacía competir en el bloque de adversos y degradaba hallazgos decisivos.
    direccion: "neutral",
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad
    // SIN magnitudContinua: la cercanía vive en valor.cercaniaUmbral (fuera de los sorts).
    procedencia: {
      base: pieCalifica
        ? "Reevaluación del veredicto subiendo el pie, subiendo el arriendo, bajando el precio y estirando el plazo, una palanca a la vez"
        : "Reevaluación del veredicto subiendo el arriendo, bajando el precio y estirando el plazo, una palanca a la vez",
      // alta: recálculo determinístico sobre tus propios datos, no una estimación externa.
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
