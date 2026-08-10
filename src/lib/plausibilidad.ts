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
  campo:
    | "precio"
    | "superficie"
    | "arriendo"
    | "tasa"
    | "pie"
    | "ocupacion"
    | "tarifaNoche"
    | "vacancia"
    | "comisionAdmin";
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
  | "pie_fuera_rango"
  | "pie_ausente"
  | "pie_cero_sin_razon"
  | "str_ocupacion_fuera_rango"
  | "str_tarifa_fuera_rango"
  | "str_yield_imposible"
  | "vacancia_fuera_rango"
  | "comision_admin_fuera_rango";

export interface PlausibilidadInput {
  /** Precio de compra en UF. */
  precioUF: number;
  /** Superficie útil en m². */
  superficieM2: number;
  /** UF del día en CLP (para derivar los yields). */
  ufCLP: number;
  /** Tasa anual del crédito en % (ej. 4.72). */
  tasaAnualPct?: number;
  /** Pie en PORCENTAJE del precio (0-100). Fase 5b: el 0 es LEGÍTIMO
   *  (financiamiento 100%); lo que esta regla caza es el rango imposible. */
  piePct?: number;
  /**
   * Origen del pie 0 declarado en el wizard (`bono_pie` | `otra_fuente` |
   * `no_declarada`). Solo pesa junto a `piePct === 0`: un cero SIN razón es el
   * "cero silencioso" (fix pie-cero) — un pie que el usuario nunca declaró y
   * que produce un informe con financiamiento 100% que no pidió.
   */
  razonSinPie?: string;
  /**
   * true SOLO en los adaptadores de body COMPLETO (`desdeBodyLtr`/`desdeBodyStr`):
   * en un body de creación el pie es obligatorio y su ausencia se rechaza. El
   * input PARCIAL de la alerta temprana no lo setea, así que el fail-open por
   * regla sigue intacto pantalla a pantalla.
   */
  pieObligatorio?: boolean;
  /** Arriendo largo mensual en CLP. Solo se evalúa si es > 0. */
  arriendoMensualCLP?: number;
  /**
   * Vacancia en PORCENTAJE del año (0-100), no en meses. El body LTR la manda
   * como `vacanciaMeses`; el adaptador la devuelve a porcentaje, que es la
   * unidad en la que el usuario la tipea y la ve.
   */
  vacanciaPct?: number;
  /**
   * Comisión de administración en PORCENTAJE del arriendo (0-100), no fracción.
   * LTR la manda ya en porcentaje y STR en fracción — los adaptadores unifican.
   */
  comisionAdminPct?: number;
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
// Fase 5b: el piso es 0 INCLUSIVE — pie 0 (bono pie / financiamiento 100%) es un
// caso real que el producto soporta de punta a punta. El techo 100 es aritmético:
// sobre el precio completo no hay pie que poner.
export const RANGO_PIE_PCT: [number, number] = [0, 100];
export const RANGO_STR_OCUPACION_PCT: [number, number] = [0, 100];
export const RANGO_STR_YIELD_BRUTO: [number, number] = [0.005, 0.4];
// El techo 25 no es una elección nueva: es el tope que ya tienen los sliders de
// vacancia de los wizards v1 y v3 (`max={25}`), o sea 3 meses al año vacío. Lo
// que caza es el tipeo del resumen v4, donde el campo es texto libre y el
// sanitizer borra la coma ("7,5" → "75").
export const RANGO_VACANCIA_PCT: [number, number] = [0, 25];
// Mismo criterio: los sliders LTR llegan hasta 15% y el de la renta corta hasta
// 30%. El techo se pone en el más alto de los dos para no rechazar un STR
// legítimo con administrador caro.
export const RANGO_COMISION_ADMIN_PCT: [number, number] = [0, 30];

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

// Razones que hacen del pie 0 un dato DECLARADO (mismos valores que el selector
// del wizard, `PIE_RAZON_OPCIONES`). `sin_pie` queda fuera a propósito: en el
// tipo del motor significa "no se preguntó" — el cero silencioso, no el declarado.
const RAZONES_PIE_CERO = new Set(["bono_pie", "otra_fuente", "no_declarada"]);

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
  "pie_fuera_rango",
  "pie_ausente",
  "pie_cero_sin_razon",
  "vacancia_fuera_rango",
  "comision_admin_fuera_rango",
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
 * `unidad` — sufijo del número grande, lo que va DESPUÉS del espacio.
 */
// El "%" NUNCA va acá: pertenece al número y viaja pegado a él (ver
// `valorParaMostrar`). El modal separa número y unidad con 7-9px, así que un
// "%" en la unidad quedaba despegado de su cifra — "0,006 % anual" — contra el
// formato del resto del sistema, que lo escribe pegado.
export const META_REGLA: Record<Regla, { deriva: boolean; unidad: string }> = {
  uf_m2_fuera_rango: { deriva: true, unidad: "UF / m²" },
  yield_imposible: { deriva: true, unidad: "anual" },
  str_yield_imposible: { deriva: true, unidad: "anual" },
  precio_total_fuera_rango: { deriva: false, unidad: "UF" },
  superficie_fuera_rango: { deriva: false, unidad: "m²" },
  arriendo_fuera_rango: { deriva: false, unidad: "al mes" },
  tasa_fuera_rango: { deriva: false, unidad: "anual" },
  pie_fuera_rango: { deriva: false, unidad: "del precio" },
  pie_ausente: { deriva: false, unidad: "del precio" },
  pie_cero_sin_razon: { deriva: false, unidad: "del precio" },
  str_ocupacion_fuera_rango: { deriva: false, unidad: "de ocupación" },
  str_tarifa_fuera_rango: { deriva: false, unidad: "por noche" },
  vacancia_fuera_rango: { deriva: false, unidad: "del año" },
  comision_admin_fuera_rango: { deriva: false, unidad: "del arriendo" },
};

/** Reglas cuyo `valor` es una fracción y se muestra como porcentaje. */
const REGLAS_PCT = new Set<Regla>(["yield_imposible", "str_yield_imposible"]);
/** Reglas cuyo `valor` YA es un porcentaje (no una fracción) y lleva "%" pegado. */
const REGLAS_PCT_DIRECTO = new Set<Regla>([
  "tasa_fuera_rango",
  "str_ocupacion_fuera_rango",
  "pie_fuera_rango",
  "pie_ausente",
  "pie_cero_sin_razon",
  "vacancia_fuera_rango",
  "comision_admin_fuera_rango",
]);
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
  // El "%" viaja PEGADO al número, nunca en la unidad: el modal las separa con
  // 7-9px y el símbolo quedaba huérfano de su cifra.
  const numero = REGLAS_PCT.has(a.regla)
    ? pct(a.valor, dir, limite)
    : REGLAS_PCT_DIRECTO.has(a.regla)
      ? `${num(a.valor, dir, limite)}%`
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

/** Tramos de decimales del porcentaje: >=10% ninguno · 1-10% uno · <1% tres. */
function decimalesPct(p: number): number {
  return p >= 10 ? 0 : p >= 1 ? 1 : 3;
}

/**
 * Número dentro de rango, con miles chilenos y los decimales útiles de su escala.
 * Lo usa el estado LIMPIO del modal (PIEZA B1) para que no tenga formateadores
 * propios: "106667" y "106.667" para el mismo valor era el síntoma de tenerlos.
 */
export function formatearNumero(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return fmt(v, decimalesUtiles(v));
}

/** Porcentaje dentro de rango, con los MISMOS tramos que usa `pct`. */
export function formatearPct(fraccion: number): string {
  if (!Number.isFinite(fraccion)) return "—";
  const p = fraccion * 100;
  return `${fmt(p, decimalesPct(p))}%`;
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
/**
 * Meses derivados sin límite propio (la traducción de la vacancia). Un entero se
 * muestra entero — mismo criterio que `fueraDeRango`: "9 meses", no "9,0 meses".
 */
function meses(n: number): string {
  return fmt(n, Number.isInteger(n) ? 0 : 1);
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
  const base = decimalesPct(p);
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

  // ── Pie (fase 5b) ──
  // Valida RANGO, no la existencia: pie 0 es legítimo (financiamiento 100%,
  // típicamente bono pie) y el producto lo soporta de punta a punta. Lo que se
  // caza es lo imposible — negativo, o más que el precio completo. El techo SÍ
  // se nombra en el mensaje (misma excepción que la ocupación >100%: es una
  // verdad aritmética, no un umbral elegido por nosotros).
  const pie = input.piePct;
  if (input.pieObligatorio && !finito(pie)) {
    // Un body de creación sin pie no es un dato parcial: es un cliente que va a
    // hacer calcular el motor con NaN. Antes esto pasaba en silencio (el guard
    // solo validaba rango SI el pie venía).
    out.push({
      campo: "pie",
      regla: "pie_ausente",
      valor: 0,
      rango: RANGO_PIE_PCT,
      mensaje: `Falta el pie. Escribe el monto en el paso de financiamiento — y si va en $0, indica cómo se cubre.`,
    });
  }
  if (finito(pie)) {
    const [min, max] = RANGO_PIE_PCT;
    if (pie < min || pie > max) {
      out.push({
        campo: "pie",
        regla: "pie_fuera_rango",
        valor: pie,
        rango: RANGO_PIE_PCT,
        mensaje:
          pie > max
            ? `Un pie de ${num(pie, "alto", max)}% no existe: el máximo es ${max}%, o sea pagar el depto completo al contado.`
            : `El pie no puede ser negativo. Revisa el monto.`,
      });
    }
    // Cero silencioso (fix pie-cero): pie 0 sigue siendo legítimo, pero SOLO
    // declarado — con una razón del wizard. `sin_pie` NO califica: es el estado
    // "no se preguntó", exactamente lo que esta regla mata. Producción mostró
    // ~18% de análisis con este estado desde que el 0 dejó de bloquear (fase 5b).
    if (pie === 0 && !RAZONES_PIE_CERO.has(String(input.razonSinPie))) {
      out.push({
        campo: "pie",
        regla: "pie_cero_sin_razon",
        valor: 0,
        rango: RANGO_PIE_PCT,
        mensaje: `El pie quedó en $0 sin indicar cómo se cubre. Vuelve al pie: escribe el monto real, o declara por qué va en cero.`,
      });
    }
  }

  // ── Vacancia ──
  // `finito` a secas, sin `> 0`: la vacancia 0 es una declaración legítima (el
  // usuario que asume arriendo continuo), igual que el pie 0. Lo que se caza es
  // el rango imposible. El caso real que lo motiva es el resumen del wizard v4,
  // donde el campo es texto libre y su sanitizer borra la coma: "7,5" entra como
  // "75", pasa al motor y cobra el crédito.
  const vacancia = input.vacanciaPct;
  if (finito(vacancia)) {
    const [min, max] = RANGO_VACANCIA_PCT;
    if (vacancia < min || vacancia > max) {
      out.push({
        campo: "vacancia",
        regla: "vacancia_fuera_rango",
        valor: vacancia,
        rango: RANGO_VACANCIA_PCT,
        // El umbral no se nombra (regla de copy). Lo que se nombra es la
        // traducción a meses, que es el dato que le hace ver el error: un 75%
        // son nueve meses al año con el depto vacío.
        mensaje:
          vacancia > max
            ? `Una vacancia de ${num(vacancia, "alto", max)}% son ${meses((vacancia * 12) / 100)} meses al año con el depto vacío. Revisa el porcentaje.`
            : `La vacancia no puede ser negativa. Revisa el porcentaje.`,
      });
    }
  }

  // ── Comisión de administración ──
  // LTR manda `undefined` cuando es 0 (autogestión), así que ese caso llega como
  // NaN y no dispara. STR manda siempre un valor. Cero es legítimo en ambos.
  const comision = input.comisionAdminPct;
  if (finito(comision)) {
    const [min, max] = RANGO_COMISION_ADMIN_PCT;
    if (comision < min || comision > max) {
      out.push({
        campo: "comisionAdmin",
        regla: "comision_admin_fuera_rango",
        valor: comision,
        rango: RANGO_COMISION_ADMIN_PCT,
        mensaje:
          comision > max
            ? `Una comisión de administración de ${num(comision, "alto", max)}% del arriendo no existe en el mercado chileno. Revisa el porcentaje.`
            : `La comisión de administración no puede ser negativa. Revisa el porcentaje.`,
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
    piePct?: unknown;
    razonSinPie?: unknown;
    vacanciaMeses?: unknown;
    comisionAdministrador?: unknown;
  },
  ufCLP: number,
): PlausibilidadInput {
  // El body LTR manda la vacancia en MESES/año (los tres wizards convierten
  // `pct * 12 / 100` antes de postear). El módulo evalúa PORCENTAJE, que es la
  // unidad que el usuario tipea, así que se deshace la conversión. NaN se
  // propaga solo por la aritmética y mantiene el fail-open.
  const vacanciaMeses = numOrNaN(body?.vacanciaMeses);

  return {
    precioUF: numOrNaN(body?.precio),
    superficieM2: numOrNaN(body?.superficie),
    ufCLP,
    tasaAnualPct: numOrNaN(body?.tasaInteres),
    arriendoMensualCLP: numOrNaN(body?.arriendo),
    piePct: numOrNaN(body?.piePct),
    razonSinPie: typeof body?.razonSinPie === "string" ? body.razonSinPie : undefined,
    // Body completo de creación → el pie es obligatorio (fix pie-cero).
    pieObligatorio: true,
    vacanciaPct: (vacanciaMeses * 100) / 12,
    // LTR ya viaja en porcentaje (0-100) y llega `undefined` cuando es 0.
    comisionAdminPct: numOrNaN(body?.comisionAdministrador),
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
    piePct?: unknown;
    razonSinPie?: unknown;
    comisionAdministrador?: unknown;
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
    piePct: numOrNaN(body?.piePct),
    razonSinPie: typeof body?.razonSinPie === "string" ? body.razonSinPie : undefined,
    // Body completo de creación → el pie es obligatorio (fix pie-cero).
    pieObligatorio: true,
    // El body STR manda la comisión como FRACCIÓN (0.20 = 20%; así lo declara
    // `ShortTermInput` en short-term-engine.ts y así la dividen los tres
    // emisores). Se pasa a porcentaje, mismo criterio que `occOverride`.
    // Sin vacancia: la renta corta no tiene ese campo → fail-open.
    comisionAdminPct: numOrNaN(body?.comisionAdministrador) * 100,
    str: {
      tarifaNocheCLP: Number.isNaN(adr) ? null : adr,
      ocupacionPct: Number.isNaN(occ) ? null : occ * 100,
    },
  };
}
