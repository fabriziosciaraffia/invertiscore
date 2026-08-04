// Solver de TIR (tasa interna de retorno) — bracketing + bisección.
//
// REEMPLAZA a los dos Newton-Raphson gemelos que vivían en analysis.ts:95
// (`calcTIR`) y short-term-engine.ts:782 (`calcTIRSTR`). Aquel solver tenía tres
// defectos que se combinaban en un modo de falla silencioso:
//
//   1. Seed fijo 0.1 sin bracketing: con TIR real muy lejos del seed, Newton se
//      dispara en vez de converger.
//   2. Clamps del iterando (`if (rate > 10) rate = 1`, `if (rate < -0.99) rate = -0.5`):
//      cada vez que la iteración se disparaba, el iterando se REINICIABA en 1.0.
//   3. `return rate` incondicional: agotadas las 100 iteraciones devolvía el
//      iterando igual, sin señal de no-convergencia.
//
// El resultado era que `1.0` (el clamp) salía por la puerta como si fuera un
// resultado y se renderizaba "100%". Medido sobre el análisis ab0b2d3a:
// 55 de 480 combinaciones de plazo × plusvalía devolvían exactamente 100, y el
// peor caso mostraba 100% donde la TIR real era −14,07%. El error invertía el
// signo del mensaje y además pintaba tono "good" (tonoTIR(100) === "good").
//
// Este módulo NO puede devolver un número que no sea una raíz del VPN:
//   · cero clamps, cero reasignaciones del iterando fuera de la bisección;
//   · si no hay bracket, devuelve { ok: false } — nunca un número de consuelo;
//   · la tolerancia es sobre la TASA (1e-7), no sobre el VPN en pesos. El
//     `Math.abs(npv) < 1` del solver viejo dependía de la escala: "un peso de
//     VPN" es una tolerancia distinta en un flujo de $19MM que en uno de $900MM.
//
// El costo es ~1.100 evaluaciones de VPN para el bracketing + hasta 200 de
// bisección. Sobre vectores de ≤31 flujos es despreciable y corre igual en el
// motor (server) que en el simulador (cliente).

/** Por qué no hay TIR. No son errores: son estados legítimos de un flujo. */
export type IRRFailReason =
  /** El VPN no cambia de signo en [-99%, 1000%]: no existe raíz que reportar. */
  | "sin-bracket"
  /** Vector inutilizable: <2 flujos, algún no-finito, o sin cambio de signo. */
  | "flujos-invalidos";

export type IRRResult =
  | { ok: true; rate: number }
  | { ok: false; reason: IRRFailReason };

/** Extremos de la grilla de bracketing. −99% es el piso donde (1+r) sigue > 0. */
const R_MIN = -0.99;
const R_MAX = 10.0;
/** Paso de la grilla. 0,01 ⇒ 1.100 puntos entre R_MIN y R_MAX. */
const GRID_STEP = 0.01;
/** Tolerancia sobre la TASA, no sobre el VPN. Independiente de la escala del flujo. */
const TOL_RATE = 1e-7;
const MAX_ITER = 200;

/**
 * Valor presente neto a la tasa `r`. El flujo `i` se descuenta `i` períodos, así
 * que `flujos[0]` es T0 (típicamente la inversión inicial, negativa).
 *
 * Devuelve un no-finito cuando el descuento desborda (tasas cerca de −99% con
 * vectores largos). El bracketing descarta esos puntos en vez de confiar en ellos.
 */
function npv(flujos: number[], r: number): number {
  let acc = 0;
  for (let i = 0; i < flujos.length; i++) {
    acc += flujos[i] / Math.pow(1 + r, i);
  }
  return acc;
}

/** Cambios de signo del vector, ignorando los ceros (regla de Descartes). */
function cambiosDeSigno(flujos: number[]): number {
  let cambios = 0;
  let signoPrevio = 0;
  for (const f of flujos) {
    if (f === 0) continue;
    const signo = f > 0 ? 1 : -1;
    if (signoPrevio !== 0 && signo !== signoPrevio) cambios++;
    signoPrevio = signo;
  }
  return cambios;
}

/**
 * TIR del vector de flujos: la tasa que anula el VPN.
 *
 * `flujos[i]` ocurre al final del período `i` (T0 = índice 0, sin descontar).
 * La tasa devuelta es DECIMAL (0.0654 = 6,54%) — el callsite decide el formato.
 *
 * Contrato duro: `{ ok: true }` ⇒ `rate` es una raíz real del VPN dentro de
 * [−99%, 1000%] con tolerancia 1e-7. Nunca devuelve un número aproximado, un
 * default, ni un iterando clampeado. Si el flujo no tiene TIR reportable, eso se
 * dice explícitamente y el consumidor decide qué mostrar.
 *
 * Con más de un cambio de signo el VPN puede tener varias raíces (TIR múltiple,
 * el caso clásico del flujo no convencional). Devolvemos la PRIMERA desde la
 * izquierda — la convención de Excel/`IRR` — y avisamos por consola, porque en
 * ese régimen el número deja de ser interpretable como "rentabilidad" a secas.
 */
export function calcIRR(flujos: number[]): IRRResult {
  if (!Array.isArray(flujos) || flujos.length < 2) {
    return { ok: false, reason: "flujos-invalidos" };
  }
  if (!flujos.every((f) => Number.isFinite(f))) {
    return { ok: false, reason: "flujos-invalidos" };
  }

  const cambios = cambiosDeSigno(flujos);
  if (cambios === 0) {
    // Todos del mismo signo: el VPN nunca cruza cero. Es un flujo sin TIR, no un
    // fallo del solver — se distingue de 'sin-bracket' porque acá lo sabemos por
    // la forma del vector, sin evaluar nada.
    return { ok: false, reason: "flujos-invalidos" };
  }
  if (cambios > 1) {
    console.warn(
      `[calcIRR] flujo no convencional: ${cambios} cambios de signo — el VPN puede ` +
        `tener múltiples raíces. Se devuelve la primera desde la izquierda.`,
    );
  }

  // ── Bracketing: primer par consecutivo de la grilla donde el VPN cambia de signo.
  let rPrevio: number | null = null;
  let vPrevio = 0;
  const pasos = Math.round((R_MAX - R_MIN) / GRID_STEP);

  for (let k = 0; k <= pasos; k++) {
    const r = R_MIN + k * GRID_STEP;
    const v = npv(flujos, r);

    // Punto inutilizable (desborde del descuento): no sirve como extremo del
    // bracket. Se descarta y se rompe la continuidad con el punto anterior.
    if (!Number.isFinite(v)) {
      rPrevio = null;
      continue;
    }
    if (v === 0) return { ok: true, rate: r };

    if (rPrevio !== null && Math.sign(v) !== Math.sign(vPrevio)) {
      return { ok: true, rate: biseccion(flujos, rPrevio, r, vPrevio) };
    }
    rPrevio = r;
    vPrevio = v;
  }

  return { ok: false, reason: "sin-bracket" };
}

/**
 * Bisección sobre un bracket YA validado (el VPN cambia de signo entre `lo` y `hi`).
 * `vLo` se pasa para no re-evaluar el extremo que el bracketing ya calculó.
 *
 * Termina por ancho del intervalo (TOL_RATE), no por VPN: el criterio es
 * geométrico y no depende de la magnitud de los flujos.
 */
function biseccion(flujos: number[], lo: number, hi: number, vLo: number): number {
  let a = lo;
  let b = hi;
  let va = vLo;

  for (let i = 0; i < MAX_ITER && b - a > TOL_RATE; i++) {
    const mid = (a + b) / 2;
    const vMid = npv(flujos, mid);
    if (vMid === 0) return mid;
    if (Math.sign(vMid) === Math.sign(va)) {
      a = mid;
      va = vMid;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/**
 * Azúcar para los callsites que reportan la TIR en PORCENTAJE con 2 decimales
 * (el formato que ya persistían `calcExitScenario` y el motor STR: `6.54`).
 * Mantiene el redondeo en un solo lugar para que motor y simulador no diverjan
 * en el último decimal.
 */
export function calcIRRPct(flujos: number[]): IRRResult {
  const r = calcIRR(flujos);
  return r.ok ? { ok: true, rate: Math.round(r.rate * 10000) / 100 } : r;
}
