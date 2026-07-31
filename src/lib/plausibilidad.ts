// ─────────────────────────────────────────────────────────────────────────────
// Guard de plausibilidad de inputs — PIEZA A
//
// Módulo PURO: sin red, sin DB, sin imports. Es el ÚNICO lugar donde viven los
// umbrales. Cualquier cambio de rango se hace acá y en ningún otro archivo.
//
// Qué es y qué NO es
// ──────────────────
// Es un guard de RECHAZO DURO contra el error de tipeo que hace que el pipeline
// cobre un crédito por un análisis imposible (el caso que lo motivó: precio
// UF 4.800.000 cuando el usuario quiso UF 4.800 — se procesó completo y se cobró).
// Los rangos son deliberadamente ANCHOS: dejan pasar el depto caro, el yield
// flaco y el crédito malo. Solo cazan lo aritméticamente imposible.
//
// NO es un detector de "esto se ve raro" — la zona gris (avisar sin bloquear)
// vive en el dry-run y en las `anomalias` de ai-generation.ts, no acá. Por eso
// no hay severidades: si `evaluarPlausibilidad` devuelve algo, no se cobra.
//
// FAIL-OPEN por diseño: una regla solo se evalúa si sus insumos son números
// finitos. Un campo ausente o no numérico NO dispara — un guard nuevo en un
// camino de cobro vivo nunca debe bloquear tráfico legítimo por un dato que
// algún cliente viejo no manda.
// ─────────────────────────────────────────────────────────────────────────────

export type Anomalia = {
  /** Campo al que el usuario tiene que volver. */
  campo: "precio" | "superficie" | "arriendo" | "tasa" | "ocupacion" | "tarifaNoche";
  /** Id estable para contar en logs/analytics. No cambiar sin migrar los conteos. */
  regla: Regla;
  /** El valor DERIVADO que falla (UF/m², yield), no siempre el tipeado. */
  valor: number;
  /** Umbrales que se violaron. USO INTERNO (logs, tests) — NUNCA se muestran. */
  rango: [number, number];
  /** Tuteo chileno. Ver REGLA DE COPY abajo. */
  mensaje: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// REGLA DE COPY — leer antes de tocar cualquier `mensaje`
//
// El mensaje NUNCA expone el umbral del guard. Los rangos de acá abajo son
// fusibles de ingeniería, deliberadamente holgados: publicarlos los convierte en
// recomendación implícita. "En el Gran Santiago no pasa de UF 500" le está
// diciendo al usuario que UF 499/m² está bien — y en Providencia lo normal son
// 60-130. Es información falsa dicha por omisión.
//
// El mensaje lleva DOS cosas y nada más:
//   (a) el valor DERIVADO del usuario — eso es lo que delata el error;
//   (b) la acción a tomar, o la causa probable del error.
//
// Cuando hay un ancla del mundo real, se usa esa ("a ese precio no hay
// departamento en Chile", "ni un depósito a plazo rinde tan poco") — nunca
// nuestro rango.
//
// EXCEPCIÓN ÚNICA: si el límite es una verdad y no una elección nuestra
// (ocupación > 100%), ahí sí se nombra.
//
// Tono: directo, sin calificar al usuario. Se le fue un cero tipeando, no hizo
// nada tonto. "Hay un dígito de más" sí; "ridículo/absurdo/irrisorio" no.
// ─────────────────────────────────────────────────────────────────────────────

export type Regla =
  | "uf_m2_fuera_rango"
  | "precio_total_fuera_rango"
  | "superficie_fuera_rango"
  | "yield_imposible"
  | "arriendo_fuera_rango"
  | "tasa_fuera_rango"
  | "str_ocupacion_fuera_rango"
  | "str_tarifa_fuera_rango"
  | "str_yield_imposible";

export interface PlausibilidadInput {
  /** Precio de compra en UF. */
  precioUF: number;
  /** Superficie útil en m². */
  superficieM2: number;
  /** UF del día en CLP (para derivar los yields). */
  ufCLP: number;
  /** Tasa anual del crédito en % (ej. 4.72). */
  tasaAnualPct?: number;
  /** Arriendo largo mensual en CLP. Solo se evalúa si es > 0. */
  arriendoMensualCLP?: number;
  /**
   * Rama STR. Solo con valores CORREGIDOS por el usuario: cuando el wizard usa
   * la estimación de AirROI los overrides van en null y no hay input humano que
   * validar (los datos de mercado no son responsabilidad del usuario).
   */
  str?: {
    tarifaNocheCLP?: number | null;
    /** Ocupación en PORCENTAJE (0-100), no fracción. */
    ocupacionPct?: number | null;
  };
}

// ── Umbrales (fuente única) ──────────────────────────────────────────────────

export const RANGO_UF_M2: [number, number] = [10, 500];
export const RANGO_PRECIO_UF: [number, number] = [300, 100_000];
// Techo 1.000 y no 500: existen departamentos de 500-600 m² en Vitacura y Las
// Condes, así que 500 rechazaba propiedades REALES. Mil m² sí es genuinamente
// imposible para una unidad. El piso de 12 se queda — los microdeptos existen.
export const RANGO_SUPERFICIE_M2: [number, number] = [12, 1_000];
export const RANGO_YIELD_BRUTO: [number, number] = [0.005, 0.25];
export const RANGO_TASA_PCT: [number, number] = [0.5, 20];
export const RANGO_STR_OCUPACION_PCT: [number, number] = [0, 100];
export const RANGO_STR_YIELD_BRUTO: [number, number] = [0.005, 0.4];

// ── Reglas SIN techo (decisión de la revisión de redundancia) ────────────────
//
// Arriendo y tarifa/noche solo tienen PISO. Sus techos ($15M/mes y $2M/noche) se
// quitaron por el mismo patrón que bajó a la superficie:
//
//   · El error que pretendían cazar —pegar el precio de venta en el campo de
//     arriendo, o el ingreso mensual en el de tarifa— ya lo caza `yield_imposible`
//     / `str_yield_imposible`, porque el yield se calcula CON ese valor.
//   · Para disparar SOLOS necesitaban precio ≥ UF 18.557 (arriendo) o ≥ UF 23.500
//     (tarifa): o sea, el único caso que activaban por su cuenta era una propiedad
//     de lujo genuina. Valor añadido ≈ 0, riesgo de falso positivo > 0.
//
// Los pisos se quedan: disparan solos en escenarios de tipeo real (UF 1.000 con
// $50.000 de arriendo) y no chocan con nada legítimo.
export const RANGO_ARRIENDO_CLP: [number, number] = [80_000, Infinity];
export const RANGO_STR_TARIFA_CLP: [number, number] = [5_000, Infinity];

/**
 * Orden de presentación. El cliente muestra `anomalias[0].mensaje`, así que el
 * primero tiene que ser el MÁS EXPLICATIVO — el que le hace entender al usuario
 * qué se le fue. UF/m² gana siempre: es el derivado que delata el dígito de más
 * sin que el usuario tenga que comparar dos campos.
 *
 * Vive acá (no en el cliente) para que el orden sea el mismo en el 422, en los
 * logs y en la pantalla.
 */
const PRIORIDAD_REGLA: readonly Regla[] = [
  "uf_m2_fuera_rango",
  "precio_total_fuera_rango",
  "superficie_fuera_rango",
  "yield_imposible",
  "str_yield_imposible",
  "arriendo_fuera_rango",
  "str_tarifa_fuera_rango",
  "str_ocupacion_fuera_rango",
  "tasa_fuera_rango",
];

/**
 * Metadatos de PRESENTACIÓN por regla (PIEZA B1). No tocan rangos ni mensajes.
 *
 * `deriva` — ¿el `valor` es un número CALCULADO que el usuario nunca vio, o es
 * literalmente lo que tipeó? Define el label bajo el número grande del modal:
 * "lo que implica el precio que pusiste" vs "la tasa que ingresaste". Fingir
 * revelación donde no la hay es mentir, así que el flag vive acá y no como un
 * if en el componente.
 *
 * `unidad` — sufijo del número grande ("UF / m²", "% anual").
 */
export const META_REGLA: Record<Regla, { deriva: boolean; unidad: string }> = {
  uf_m2_fuera_rango: { deriva: true, unidad: "UF / m²" },
  yield_imposible: { deriva: true, unidad: "% anual" },
  str_yield_imposible: { deriva: true, unidad: "% anual" },
  precio_total_fuera_rango: { deriva: false, unidad: "UF" },
  superficie_fuera_rango: { deriva: false, unidad: "m²" },
  arriendo_fuera_rango: { deriva: false, unidad: "al mes" },
  tasa_fuera_rango: { deriva: false, unidad: "% anual" },
  str_ocupacion_fuera_rango: { deriva: false, unidad: "de ocupación" },
  str_tarifa_fuera_rango: { deriva: false, unidad: "por noche" },
};

/** Reglas cuyo `valor` es una fracción y se muestra como porcentaje. */
const REGLAS_PCT = new Set<Regla>(["yield_imposible", "str_yield_imposible"]);
/** Reglas cuyo `valor` es un monto en pesos. */
const REGLAS_CLP = new Set<Regla>(["arriendo_fuera_rango", "str_tarifa_fuera_rango"]);

/**
 * Número grande del modal, ya formateado. Vive acá para que respete el PRINCIPIO
 * DE REDONDEO de abajo — si el componente formateara por su cuenta podría
 * mostrar un valor que el guard acepta, que es justo el bug que ese principio
 * cierra.
 */
export function valorParaMostrar(a: Anomalia): {
  numero: string;
  unidad: string;
  deriva: boolean;
} {
  const meta = META_REGLA[a.regla];
  const [min, max] = a.rango;
  const dir: Direccion = a.valor > max ? "alto" : "bajo";
  const limite = dir === "alto" ? max : min;

  // El % del yield ya viene con su símbolo desde `pct`; se lo saco porque en el
  // modal la unidad va aparte, en gris y más chica.
  const numero = REGLAS_PCT.has(a.regla)
    ? pct(a.valor, dir, limite).replace("%", "")
    : REGLAS_CLP.has(a.regla)
      ? clp(a.valor, dir, limite)
      : num(a.valor, dir, limite);

  return { numero, unidad: meta.unidad, deriva: meta.deriva };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPIO DE REDONDEO — vale para los 9 mensajes
//
// El redondeo NUNCA puede mover el valor mostrado hacia adentro del rango
// aceptado. Si el guard rechazó 11,9 m² por un piso de 12, mostrar "12 m² no
// alcanza" es incoherente: el usuario lee un número que el guard sí acepta.
//
// Implementación: se redondea al decimal ÚTIL del campo y, si ese redondeo cae
// dentro (o justo sobre el límite), se agregan decimales hasta que vuelva a
// quedar estrictamente afuera. Nunca se renderiza 0 para un valor no nulo.
// ─────────────────────────────────────────────────────────────────────────────

type Direccion = "alto" | "bajo";

/** Decimales que aportan según la escala del número. */
function decimalesUtiles(v: number): number {
  const abs = Math.abs(v);
  if (abs >= 10) return 0;
  if (abs >= 1) return 1;
  if (abs >= 0.01) return 2;
  return 4;
}

/**
 * Redondea `valor` dejándolo SIEMPRE fuera de `limite` en la dirección de la
 * violación. Devuelve [valorRedondeado, decimalesUsados].
 */
function fueraDeRango(valor: number, dir: Direccion, limite: number): [number, number] {
  // Un entero se muestra entero: sin esto, -5 salía "-5,0%".
  const base = Number.isInteger(valor) ? 0 : decimalesUtiles(valor);
  for (let dec = base; dec <= base + 4; dec++) {
    const f = 10 ** dec;
    const r = Math.round(valor * f) / f;
    const sigueFuera = dir === "alto" ? r > limite : r < limite;
    if (sigueFuera && r !== 0) return [r, dec];
  }
  // Último recurso: truncar hacia afuera (ceil/floor nunca entran al rango).
  const f = 10 ** (base + 4);
  const r = dir === "alto" ? Math.ceil(valor * f) / f : Math.floor(valor * f) / f;
  return [r, base + 4];
}

function fmt(n: number, decimales: number): string {
  return n.toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Número crudo (superficie, ocupación) respetando el principio de redondeo. */
function num(valor: number, dir: Direccion, limite: number): string {
  const [n, dec] = fueraDeRango(valor, dir, limite);
  return fmt(n, dec);
}
function clp(valor: number, dir: Direccion, limite: number): string {
  return `$${num(valor, dir, limite)}`;
}
function uf(valor: number, dir: Direccion, limite: number): string {
  return `UF ${num(valor, dir, limite)}`;
}
/** Monto derivado sin límite propio (el CLP equivalente del precio). */
function clpLlano(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

/**
 * Porcentaje. Decimales solo cuando aportan: ≥10% ninguno · 1-10% uno ·
 * <1% tres. Si esa precisión metiera el valor dentro del rango, manda el
 * principio de redondeo y se agregan los decimales que hagan falta.
 */
function pct(fraccion: number, dir: Direccion, limiteFraccion: number): string {
  const p = fraccion * 100;
  const lim = limiteFraccion * 100;
  const base = p >= 10 ? 0 : p >= 1 ? 1 : 3;
  for (let dec = base; dec <= base + 4; dec++) {
    const f = 10 ** dec;
    const r = Math.round(p * f) / f;
    const sigueFuera = dir === "alto" ? r > lim : r < lim;
    if (sigueFuera && r !== 0) return `${fmt(r, dec)}%`;
  }
  const f = 10 ** (base + 4);
  const r = dir === "alto" ? Math.ceil(p * f) / f : Math.floor(p * f) / f;
  return `${fmt(r, base + 4)}%`;
}

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ── Evaluación ───────────────────────────────────────────────────────────────

/**
 * Devuelve la lista de anomalías duras del input. Lista vacía = plausible.
 * Puro y determinístico: mismo input, mismo output.
 */
export function evaluarPlausibilidad(input: PlausibilidadInput): Anomalia[] {
  const out: Anomalia[] = [];
  const { precioUF, superficieM2, ufCLP } = input;

  const precioOk = finito(precioUF) && precioUF > 0;
  const supOk = finito(superficieM2) && superficieM2 > 0;
  const ufOk = finito(ufCLP) && ufCLP > 0;

  // ── Precio total ──
  if (finito(precioUF)) {
    const [min, max] = RANGO_PRECIO_UF;
    if (precioUF < min || precioUF > max) {
      out.push({
        campo: "precio",
        regla: "precio_total_fuera_rango",
        valor: precioUF,
        rango: RANGO_PRECIO_UF,
        mensaje:
          precioUF > max
            ? `${uf(precioUF, "alto", max)}${ufOk ? ` son ${clpLlano(precioUF * ufCLP)}` : ""}. A ese precio no hay departamento en Chile — revisa si hay un dígito de más.`
            : `${uf(precioUF, "bajo", min)} no alcanza para un departamento en el Gran Santiago. Revisa el precio pedido.`,
      });
    }
  }

  // ── Superficie ──
  if (finito(superficieM2)) {
    const [min, max] = RANGO_SUPERFICIE_M2;
    if (superficieM2 < min || superficieM2 > max) {
      out.push({
        campo: "superficie",
        regla: "superficie_fuera_rango",
        valor: superficieM2,
        rango: RANGO_SUPERFICIE_M2,
        mensaje:
          superficieM2 > max
            ? `${num(superficieM2, "alto", max)} m² no es la superficie útil de un departamento. Revisa el dato — puede que sea la superficie del terreno o del edificio.`
            : `${num(superficieM2, "bajo", min)} m² no alcanza para un departamento habitable. Revisa la superficie útil.`,
      });
    }
  }

  // ── UF/m² (derivado) ──
  if (precioOk && supOk) {
    const ufM2 = precioUF / superficieM2;
    const [min, max] = RANGO_UF_M2;
    if (ufM2 < min || ufM2 > max) {
      out.push({
        campo: "precio",
        regla: "uf_m2_fuera_rango",
        valor: ufM2,
        rango: RANGO_UF_M2,
        mensaje: `El m² te queda en ${uf(ufM2, ufM2 > max ? "alto" : "bajo", ufM2 > max ? max : min)}. Eso está fuera de escala para Santiago — revisa el precio o la superficie.`,
      });
    }
  }

  // ── Arriendo mensual ──
  const arriendo = input.arriendoMensualCLP;
  if (finito(arriendo) && arriendo > 0) {
    // Solo PISO — ver la nota de "Reglas SIN techo" arriba.
    const [min] = RANGO_ARRIENDO_CLP;
    if (arriendo < min) {
      out.push({
        campo: "arriendo",
        regla: "arriendo_fuera_rango",
        valor: arriendo,
        rango: RANGO_ARRIENDO_CLP,
        // No decimos "no cubre ni los gastos comunes": hay GGCC de $40.000 en
        // comunas periféricas, así que esa afirmación no siempre es cierta.
        mensaje: `${clp(arriendo, "bajo", min)} al mes está por debajo de cualquier arriendo real en Santiago. Revisa el monto.`,
      });
    }

    // ── Yield bruto LTR (derivado) ──
    if (precioOk && ufOk) {
      const yieldBruto = (arriendo * 12) / (precioUF * ufCLP);
      const [yMin, yMax] = RANGO_YIELD_BRUTO;
      if (yieldBruto < yMin || yieldBruto > yMax) {
        out.push({
          campo: "arriendo",
          regla: "yield_imposible",
          valor: yieldBruto,
          rango: RANGO_YIELD_BRUTO,
          mensaje:
            yieldBruto > yMax
              ? `Con ese arriendo el retorno bruto te da ${pct(yieldBruto, "alto", yMax)} al año. Ningún arriendo en Santiago rinde así — revisa el precio o el arriendo.`
              : `Con ese arriendo el retorno bruto te da ${pct(yieldBruto, "bajo", yMin)} al año. Ni un depósito a plazo rinde tan poco — revisa el precio o el arriendo.`,
        });
      }
    }
  }

  // ── Tasa ──
  // `> 0` deliberado, igual que arriendo y tarifa: ningún wizard puede emitir
  // tasa 0 (ambos caen a 4,72 con `|| 4.72`), así que un 0 significa "no
  // capturada", no "el usuario tipeó cero". Sin este guard, la calibración
  // contra las filas reales rechazaba un análisis legítimo con tasa ausente.
  const tasa = input.tasaAnualPct;
  if (finito(tasa) && tasa > 0) {
    const [min, max] = RANGO_TASA_PCT;
    if (tasa < min || tasa > max) {
      out.push({
        campo: "tasa",
        regla: "tasa_fuera_rango",
        valor: tasa,
        rango: RANGO_TASA_PCT,
        mensaje: `Una tasa de ${String(tasa).replace(".", ",")}% anual no existe en el mercado hipotecario chileno. Revisa el dato que te dio el banco.`,
      });
    }
  }

  // ── STR (solo valores corregidos por el usuario) ──
  const tarifa = input.str?.tarifaNocheCLP;
  const ocupacion = input.str?.ocupacionPct;

  if (finito(ocupacion)) {
    const [min, max] = RANGO_STR_OCUPACION_PCT;
    if (ocupacion < min || ocupacion > max) {
      out.push({
        campo: "ocupacion",
        regla: "str_ocupacion_fuera_rango",
        valor: ocupacion,
        rango: RANGO_STR_OCUPACION_PCT,
        // EXCEPCIÓN de la regla de copy: acá el límite SÍ se nombra, porque 100%
        // es una verdad aritmética (las 365 noches del año), no una elección
        // nuestra. Decirlo explica el error en vez de esconder un umbral.
        mensaje:
          ocupacion > max
            ? `Una ocupación de ${num(ocupacion, "alto", max)}% no existe: el máximo es ${max}%, o sea las 365 noches del año arrendadas.`
            : `Una ocupación de ${num(ocupacion, "bajo", min)}% no existe. Revisa el porcentaje.`,
      });
    }
  }

  if (finito(tarifa) && tarifa > 0) {
    // Solo PISO — ver la nota de "Reglas SIN techo" arriba.
    const [min] = RANGO_STR_TARIFA_CLP;
    if (tarifa < min) {
      out.push({
        campo: "tarifaNoche",
        regla: "str_tarifa_fuera_rango",
        valor: tarifa,
        rango: RANGO_STR_TARIFA_CLP,
        mensaje: `${clp(tarifa, "bajo", min)} por noche no cubre ni el aseo entre huéspedes. Revisa la tarifa.`,
      });
    }

    // ── Yield bruto STR (derivado) ──
    if (precioOk && ufOk && finito(ocupacion) && ocupacion > 0) {
      const yieldStr = (tarifa * 365 * (ocupacion / 100)) / (precioUF * ufCLP);
      const [yMin, yMax] = RANGO_STR_YIELD_BRUTO;
      if (yieldStr < yMin || yieldStr > yMax) {
        out.push({
          campo: "tarifaNoche",
          regla: "str_yield_imposible",
          valor: yieldStr,
          rango: RANGO_STR_YIELD_BRUTO,
          mensaje:
            yieldStr > yMax
              ? `Con esa tarifa y ocupación el retorno bruto te da ${pct(yieldStr, "alto", yMax)} al año. Ninguna renta corta en Santiago rinde así — revisa el precio, la tarifa o la ocupación.`
              : `Con esa tarifa y ocupación el retorno bruto te da ${pct(yieldStr, "bajo", yMin)} al año. Ni un depósito a plazo rinde tan poco — revisa el precio, la tarifa o la ocupación.`,
        });
      }
    }
  }

  // Orden estable por prioridad: el cliente muestra `anomalias[0].mensaje`, así
  // que el más explicativo tiene que quedar primero. Sin esto el orden lo daría
  // la secuencia de evaluación, que es un detalle de implementación.
  return out.sort(
    (a, b) => PRIORIDAD_REGLA.indexOf(a.regla) - PRIORIDAD_REGLA.indexOf(b.regla),
  );
}

// ── Adaptadores desde los bodies de las rutas ────────────────────────────────
//
// Viven acá (y no en cada ruta) para que el mapeo body → PlausibilidadInput
// tenga un solo dueño. Tipos laxos a propósito: los bodies llegan de
// `request.json()` sin validar y estos adaptadores son justamente el borde.

/**
 * Coerción numérica del borde. `null`/`undefined`/basura → NaN, NO 0.
 * `Number(null)` es 0, y ese 0 se leería como "el usuario puso cero" cuando en
 * realidad el campo no vino — con la rama STR eso convertía un override ausente
 * en una ocupación declarada de 0%. NaN es lo que activa el fail-open.
 */
function numOrNaN(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Body de POST /api/analisis (AnalisisInput). */
export function desdeBodyLtr(
  body: {
    precio?: unknown;
    superficie?: unknown;
    arriendo?: unknown;
    tasaInteres?: unknown;
  },
  ufCLP: number,
): PlausibilidadInput {
  return {
    precioUF: numOrNaN(body?.precio),
    superficieM2: numOrNaN(body?.superficie),
    ufCLP,
    tasaAnualPct: numOrNaN(body?.tasaInteres),
    arriendoMensualCLP: numOrNaN(body?.arriendo),
  };
}

/** Body de POST /api/analisis/short-term (ShortTermAnalysisBody). */
export function desdeBodyStr(
  body: {
    precioCompraUF?: unknown;
    precioCompra?: unknown;
    superficieUtil?: unknown;
    tasaInteres?: unknown;
    arriendoLargoMensual?: unknown;
    adrOverride?: unknown;
    occOverride?: unknown;
  },
  ufCLP: number,
): PlausibilidadInput {
  // precioCompraUF es lo que manda el wizard; precioCompra (CLP) es el fallback
  // para clientes que solo mandan el monto en pesos.
  const precioUFDirecto = numOrNaN(body?.precioCompraUF);
  const precioCLP = numOrNaN(body?.precioCompra);
  const precioUF =
    precioUFDirecto > 0
      ? precioUFDirecto
      : precioCLP > 0 && ufCLP > 0
        ? precioCLP / ufCLP
        : NaN;

  // adrOverride/occOverride son NULL cuando el usuario aceptó la estimación de
  // AirROI: ahí no hay input humano que validar. occOverride viaja como FRACCIÓN
  // (0-1) en el body; el módulo evalúa PORCENTAJE.
  const adr = numOrNaN(body?.adrOverride);
  const occ = numOrNaN(body?.occOverride);

  return {
    precioUF,
    superficieM2: numOrNaN(body?.superficieUtil),
    ufCLP,
    tasaAnualPct: numOrNaN(body?.tasaInteres),
    arriendoMensualCLP: numOrNaN(body?.arriendoLargoMensual),
    str: {
      tarifaNocheCLP: Number.isNaN(adr) ? null : adr,
      ocupacionPct: Number.isNaN(occ) ? null : occ * 100,
    },
  };
}
