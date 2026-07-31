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
// TRES PALANCAS, cada una biseccionada por separado hasta el primer valor que cruza:
//   · arriendo — sube (CLP/mes)
//   · precio   — baja (UF)
//   · plazo    — sube (años enteros, tope duro 30)
// Pie y tasa NO se emiten aunque `veredictoAtPatch` los soporte: son condiciones del banco
// y del bolsillo del comprador, no propiedades del deal (decisión de producto).
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
  Veredicto,
} from "./types";

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
function biseccionFactor(
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
  /** Reevalúa el veredicto sobre un clon del input con el patch aplicado. */
  veredictoAtPatch: (patch: { arriendo?: number; precio?: number; plazoCredito?: number }) => Veredicto;
  /** Brazos del GATE 1 activos hoy (nombres). Informativo: no decide esEstructural. */
  brazosGate1Activos: string[];
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoDistanciaVeredicto | null {
  // Caso de omisión 1: COMPRAR ⇒ no hay veredicto superior.
  if (p.veredictoBase === "COMPRAR") return null;
  // Caso de omisión 2: palancas no escalables.
  if (!Number.isFinite(p.arriendo) || p.arriendo <= 0) return null;
  if (!Number.isFinite(p.precioUF) || p.precioUF <= 0) return null;

  const veredictoObjetivo: Veredicto =
    p.veredictoBase === "BUSCAR OTRA" ? "AJUSTA SUPUESTOS" : "COMPRAR";

  const alcanzaMeta = (v: Veredicto, meta: Veredicto) => RANK[v] >= RANK[meta];
  // El tope gobierna el SALTO que se está midiendo, no el veredicto de partida: el salto de
  // una banda usa el tope del veredicto base; el de dos bandas (BUSCAR → COMPRAR, solo
  // informativo) usa el de AJUSTA, que es el tramo que decide llegar a COMPRAR.
  const topeDe = (meta: Veredicto) =>
    meta === "COMPRAR" ? DIST_TOPE_AJUSTA_PCT : topeParaVeredicto(p.veredictoBase);
  const topeAplicado = topeParaVeredicto(p.veredictoBase);

  /** Busca las 3 palancas para una meta dada. Devuelve solo las que cruzan dentro del tope. */
  const palancasHasta = (meta: Veredicto): PalancaDistancia[] => {
    const out: PalancaDistancia[] = [];
    const tope = topeDe(meta);
    const topeFactor = 1 + tope / 100; // arriendo: sube hasta +tope%
    const pisoFactor = 1 - tope / 100; // precio: baja hasta −tope%

    const fArr = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ arriendo: Math.round(p.arriendo * f) }), meta),
      topeFactor,
      true,
    );
    if (fArr != null) {
      const objetivo = Math.ceil(p.arriendo * fArr);
      out.push({
        palanca: "arriendo",
        objetivo,
        actual: p.arriendo,
        deltaPct: Math.round((objetivo / p.arriendo - 1) * 1000) / 10,
        deltaAbs: objetivo - p.arriendo,
      });
    }

    const fPre = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ precio: p.precioUF * f }), meta),
      pisoFactor,
      false,
    );
    if (fPre != null) {
      const objetivo = Math.floor(p.precioUF * fPre);
      out.push({
        palanca: "precio",
        objetivo,
        actual: p.precioUF,
        deltaPct: Math.round((objetivo / p.precioUF - 1) * 1000) / 10, // negativo
        deltaAbs: objetivo - p.precioUF,
      });
    }

    // Plazo: entero, del actual+1 al tope. Barrido lineal (≤ 30 evaluaciones, sin bisección
    // porque el dominio es discreto y chico). El plazo exacto que cruza NO es el que se
    // emite: los bancos chilenos ofrecen tramos de 5 años (15/20/25/30), así que un "28
    // años" es un número que el usuario no puede pedir. Se redondea hacia ARRIBA al
    // múltiplo de 5 siguiente (más plazo ⇒ cuota más baja ⇒ el cruce se mantiene) y se
    // RE-VERIFICA el veredicto en ese plazo comercial antes de emitirlo: si por cualquier
    // no-monotonía el redondeo no cruzara, la palanca no se emite en vez de prometer algo
    // falso. Si ya estás en el tope (30), no hay tramo al que moverse ⇒ tampoco se emite.
    if (
      Number.isFinite(p.plazoCredito) &&
      p.plazoCredito > 0 &&
      p.plazoCredito < DIST_PLAZO_TOPE_ANIOS
    ) {
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
          out.push({
            palanca: "plazo",
            objetivo: comercial,
            actual: p.plazoCredito,
            deltaPct: Math.round((comercial / p.plazoCredito - 1) * 1000) / 10,
            deltaAbs: comercial - p.plazoCredito,
          });
        }
        break;
      }
    }

    // Más barata primero: |deltaPct| ascendente. Comparable entre palancas porque las tres
    // se expresan como cambio relativo sobre el valor declarado.
    return out.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
  };

  const palancas = palancasHasta(veredictoObjetivo);
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
    candidatos.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
    deltaMinimoFueraDeTope = candidatos[0] ?? null;
  }

  // Solo para BUSCAR OTRA: ¿el salto de DOS bandas cae en rango? Informativo; si no, null.
  const palancaHastaComprar =
    p.veredictoBase === "BUSCAR OTRA" && !esEstructural
      ? (palancasHasta("COMPRAR")[0] ?? null)
      : null;

  // magnitudContinua: cercanía normalizada (1 = pegado al umbral, 0 = en el tope o fuera).
  // Solo desempate secundario del sort entre pares de igual decisividad (E4).
  const magnitudContinua = palancaMasBarata
    ? clamp01(1 - Math.abs(palancaMasBarata.deltaPct) / topeAplicado)
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
    if (dm) {
      const via =
        dm.palanca === "precio"
          ? `bajando el precio un ${fmtPct(Math.abs(dm.deltaPct))}%`
          : `subiendo el arriendo un ${fmtPct(Math.abs(dm.deltaPct))}%`;
      fraseCanonica =
        `Ni ${via} este depto llega a ${objetivoNombre}, y estirar el crédito a ${DIST_PLAZO_TOPE_ANIOS} años ` +
        `tampoco alcanza. La brecha es del deal, no de cómo lo estás mirando.`;
    } else {
      fraseCanonica =
        `No hay ajuste de supuestos que lleve esto a ${objetivoNombre}: ni subiendo el arriendo a más del ` +
        `doble, ni pagando un tercio del precio, ni estirando el crédito a ${DIST_PLAZO_TOPE_ANIOS} años. ` +
        `La brecha es del deal, no de cómo lo estás mirando.`;
    }
  } else {
    const l = palancaMasBarata!;
    const d = fmtPct(Math.abs(l.deltaPct));
    if (l.palanca === "arriendo") {
      titular = "Está cerca del veredicto de arriba por el lado del arriendo.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} si el arriendo llega a ${fmtCLP(l.objetivo)} ` +
        `al mes —un ${d}% sobre los ${fmtCLP(l.actual)} que declaraste—. Antes de descartarlo, confirma ese ` +
        `techo de arriendo contra publicaciones reales de la zona.`;
    } else if (l.palanca === "precio") {
      titular = "Está cerca del veredicto de arriba por el lado del precio.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} si cierras en ${fmtUF(l.objetivo)} en vez de ` +
        `${fmtUF(l.actual)} —un ${d}% menos—. Es una diferencia de negociación, no de otro departamento.`;
    } else {
      titular = "Está cerca del veredicto de arriba por el lado del crédito.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} estirando el crédito de ${l.actual} a ` +
        `${l.objetivo} años, sin cambiar el precio ni el arriendo. Alarga la deuda y pagas más intereses en total; ` +
        `a cambio, el aporte mensual baja lo suficiente para cruzar.`;
    }
  }

  return {
    id: "distancia_veredicto",
    tipo: "distancia_umbral",
    valor: {
      veredictoBase: p.veredictoBase,
      veredictoObjetivo,
      palancas,
      palancaMasBarata,
      palancaHastaComprar,
      esEstructural,
      deltaMinimoFueraDeTope,
      topePct: topeAplicado,
      brazosGate1Activos: p.brazosGate1Activos,
      modalidad: p.modalidad,
    },
    // Siempre adverso: el hallazgo solo existe cuando el veredicto no es COMPRAR.
    direccion: "adverso",
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad
    magnitudContinua,
    procedencia: {
      base: "Reevaluación del veredicto subiendo el arriendo, bajando el precio y estirando el plazo, una palanca a la vez",
      // alta: recálculo determinístico sobre tus propios datos, no una estimación externa.
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
