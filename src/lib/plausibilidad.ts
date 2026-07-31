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
  rango: [number, number];
  /** Tuteo chileno. Nombra la consecuencia, no el rango. */
  mensaje: string;
};

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
export const RANGO_SUPERFICIE_M2: [number, number] = [12, 500];
export const RANGO_YIELD_BRUTO: [number, number] = [0.005, 0.25];
export const RANGO_ARRIENDO_CLP: [number, number] = [80_000, 15_000_000];
export const RANGO_TASA_PCT: [number, number] = [0.5, 20];
export const RANGO_STR_OCUPACION_PCT: [number, number] = [0, 100];
export const RANGO_STR_TARIFA_CLP: [number, number] = [5_000, 2_000_000];
export const RANGO_STR_YIELD_BRUTO: [number, number] = [0.005, 0.4];

// ── Formato (local: el módulo no importa nada) ───────────────────────────────

/** Separador de miles con punto, formato chileno. */
function miles(n: number): string {
  return Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });
}
function clp(n: number): string {
  return `$${miles(n)}`;
}
function uf(n: number): string {
  return `UF ${miles(n)}`;
}
/** Porcentaje con coma decimal, sin ceros de relleno innecesarios. */
function pct(fraccion: number, decimales = 2): string {
  return `${(fraccion * 100).toFixed(decimales).replace(".", ",")}%`;
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
            ? `${uf(precioUF)} son ${ufOk ? clp(precioUF * ufCLP) : "una cifra"} — a ese precio no hay departamento en Chile. Revisa si te sobró un dígito.`
            : `${uf(precioUF)} no alcanza para un departamento en el Gran Santiago. Revisa el precio pedido.`,
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
            ? `${miles(superficieM2)} m² ya no es un departamento — Franco analiza hasta ${max} m². Revisa la superficie útil.`
            : `${miles(superficieM2)} m² no alcanza para un departamento habitable — Franco analiza desde ${min} m².`,
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
        mensaje:
          ufM2 > max
            ? `El m² te queda en ${uf(ufM2)} — en el Gran Santiago no pasa de ${uf(max)}. Revisa el precio o la superficie.`
            : `El m² te queda en ${uf(ufM2)} — en el Gran Santiago no baja de ${uf(min)}. Revisa el precio o la superficie.`,
      });
    }
  }

  // ── Arriendo mensual ──
  const arriendo = input.arriendoMensualCLP;
  if (finito(arriendo) && arriendo > 0) {
    const [min, max] = RANGO_ARRIENDO_CLP;
    if (arriendo < min || arriendo > max) {
      out.push({
        campo: "arriendo",
        regla: "arriendo_fuera_rango",
        valor: arriendo,
        rango: RANGO_ARRIENDO_CLP,
        mensaje:
          arriendo > max
            ? `${clp(arriendo)} al mes no es un arriendo de departamento — Franco analiza hasta ${clp(max)}.`
            : `${clp(arriendo)} al mes no cubre ni los gastos comunes — Franco analiza arriendos desde ${clp(min)}.`,
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
              ? `Con ese arriendo el retorno bruto te da ${pct(yieldBruto)} al año — no existe en el Gran Santiago. Revisa el precio o el arriendo.`
              : `Con ese arriendo el retorno bruto te da ${pct(yieldBruto, 3)} al año — ni un depósito a plazo rinde tan poco. Revisa el precio o el arriendo.`,
        });
      }
    }
  }

  // ── Tasa ──
  const tasa = input.tasaAnualPct;
  if (finito(tasa)) {
    const [min, max] = RANGO_TASA_PCT;
    if (tasa < min || tasa > max) {
      out.push({
        campo: "tasa",
        regla: "tasa_fuera_rango",
        valor: tasa,
        rango: RANGO_TASA_PCT,
        mensaje:
          tasa > max
            ? `Una tasa de ${String(tasa).replace(".", ",")}% anual no existe en el mercado hipotecario chileno — Franco analiza hasta ${max}%.`
            : `Una tasa de ${String(tasa).replace(".", ",")}% anual no existe en el mercado hipotecario chileno — Franco analiza desde ${String(min).replace(".", ",")}%.`,
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
        mensaje:
          ocupacion > max
            ? `Una ocupación de ${miles(ocupacion)}% no existe — el año tiene 365 noches y el tope es ${max}%.`
            : `Una ocupación de ${miles(ocupacion)}% no tiene sentido — el piso es ${min}%.`,
      });
    }
  }

  if (finito(tarifa) && tarifa > 0) {
    const [min, max] = RANGO_STR_TARIFA_CLP;
    if (tarifa < min || tarifa > max) {
      out.push({
        campo: "tarifaNoche",
        regla: "str_tarifa_fuera_rango",
        valor: tarifa,
        rango: RANGO_STR_TARIFA_CLP,
        mensaje:
          tarifa > max
            ? `${clp(tarifa)} por noche no es una tarifa de departamento en Santiago — Franco analiza hasta ${clp(max)}.`
            : `${clp(tarifa)} por noche no cubre ni el aseo entre huéspedes — Franco analiza tarifas desde ${clp(min)}.`,
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
              ? `Con esa tarifa y ocupación el retorno bruto te da ${pct(yieldStr)} al año — no existe en renta corta en Santiago. Revisa el precio, la tarifa o la ocupación.`
              : `Con esa tarifa y ocupación el retorno bruto te da ${pct(yieldStr, 3)} al año — ni un depósito a plazo rinde tan poco. Revisa el precio, la tarifa o la ocupación.`,
        });
      }
    }
  }

  return out;
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
