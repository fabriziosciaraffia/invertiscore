// ─────────────────────────────────────────────────────────────────────────────
// Obra nueva en el motor (02-oct-2026, decisiones de Fabrizio tras la FASE 0). Fuente única de:
//   · EL ARRIENDO DE LO NUEVO: el sugerido sube 3% (medido +3%, IC +1% a +5%; el tope que fijó Fabrizio es
//     5%). Solo el SUGERIDO —el que sale de los comparables de la zona—, nunca el que escribe la persona.
//   · EL PIE EN CUOTAS: de 1 («al contado») a 60, con entrega futura o inmediata. La primera cuota se paga
//     al firmar (mes 0) y las demás mes a mes; la TIR (anual) descuenta cada una en el año en que se paga.
//     Las que caen después de la entrega se pagan junto al dividendo, y el flujo lo dice.
//   · EL RIESGO DE LA ESPERA: ya no resta puntaje. El informe con entrega futura lo dice en una línea, sin
//     escenarios ni cálculo de tasa.
// Puro: lo prueba el tier OBRA-NUEVA.
// ─────────────────────────────────────────────────────────────────────────────

export const PREMIO_ARRIENDO_NUEVO = 0.03;
export const MAX_CUOTAS_PIE = 60;

export const FRASE_RIESGO_ENTREGA = "Tu crédito se firma en la entrega: si la tasa sube en la espera, estos números cambian.";

/** El arriendo SUGERIDO para un depto: con obra nueva, 3% más que los comparables de la zona. */
export function arriendoSugeridoObraNueva(monto: number | null | undefined, condicion: string | null | undefined): number | null {
  if (monto == null || !Number.isFinite(monto) || monto <= 0) return monto ?? null;
  return condicion === "nuevo" ? Math.round(monto * (1 + PREMIO_ARRIENDO_NUEVO)) : monto;
}

/** Las cuotas del pie, entero entre 1 y 60 (1 = al contado). */
export function cuotasPieValidas(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(MAX_CUOTAS_PIE, v);
}

/** Las cuotas por defecto: con entrega futura, hasta la entrega (tope 60); con entrega inmediata, al contado. */
export function cuotasPorDefecto(futura: boolean, mesesHastaEntrega: number): number {
  return futura ? cuotasPieValidas(mesesHastaEntrega) : 1;
}

/** Cuántas cuotas caen después de la entrega (la k-ésima se paga en el mes k, k = 0…n−1; el arriendo y el
 *  dividendo corren desde el mes siguiente a la entrega). */
export function cuotasConDividendo(cuotas: number, mesesHastaEntrega: number): number {
  const n = cuotasPieValidas(cuotas);
  return Math.max(0, n - 1 - Math.max(0, Math.round(mesesHastaEntrega)));
}

/** El monto de las cuotas que se pagan en el año `i` (0 = primer año, meses 1–12) de la TIR. La del mes 0 va
 *  en el momento cero, con los gastos de cierre. */
export function cuotasDelAnio(i: number, cuotas: number, montoCuota: number): number {
  const n = cuotasPieValidas(cuotas);
  if (n <= 1) return 0;
  const desde = i * 12 + 1, hasta = i * 12 + 12;
  const k = Math.max(0, Math.min(hasta, n - 1) - desde + 1);
  return k * montoCuota;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAS CUOTAS DEL PIE SE TIENEN QUE VER (02-oct-2026, Fabrizio tras mirar los dos informes): los tramos del
// flujo desde hoy —«Hasta la entrega» (cuotas sin arriendo), «Cuota del pie + dividendo» (los meses en que
// se juntan), «Después»— y las frases de la portada, de «Qué significa» y de «Esto es lo que pesa». El motor
// emite los datos (`metrics.pieEnCuotas`); acá se redactan.
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el motor emite del pie en cuotas (`metrics.pieEnCuotas`). */
export interface PieEnCuotas {
  cuotas: number;
  montoCuotaCLP: number;
  mesesConDividendo: number;
  /** Cuotas que se pagan antes de la entrega, sin arriendo (la de la firma incluida). 0 con entrega inmediata. */
  mesesAntesEntrega?: number;
  /** Lo que queda al mes con arriendo y sin cuotas (el flujo del primer año con arrendatario). */
  flujoDespuesCLP?: number;
}

export interface TramoCuotas {
  id: "antes" | "juntas" | "despues";
  nombre: string;
  /** Meses del tramo; «Después» no tiene fin (null). */
  meses: number | null;
  /** Lo que queda al mes en el tramo (negativo = sale de tu bolsillo). */
  valorCLP: number;
}

/** ¿Las cuotas cambian lo que la persona vive mes a mes? (hay tramo sin arriendo o tramo junto al dividendo) */
export function cuotasSeVen(p: PieEnCuotas | null | undefined): p is PieEnCuotas {
  return !!p && p.cuotas > 1 && ((p.mesesAntesEntrega ?? 0) > 0 || p.mesesConDividendo > 0);
}

/** Los tramos del flujo desde hoy. */
export function tramosCuotas(p: PieEnCuotas): TramoCuotas[] {
  const despues = Math.round(p.flujoDespuesCLP ?? 0);
  const out: TramoCuotas[] = [];
  if ((p.mesesAntesEntrega ?? 0) > 0) out.push({ id: "antes", nombre: "Hasta la entrega", meses: p.mesesAntesEntrega!, valorCLP: -Math.round(p.montoCuotaCLP) });
  if (p.mesesConDividendo > 0) out.push({ id: "juntas", nombre: "Cuota del pie + dividendo", meses: p.mesesConDividendo, valorCLP: despues - Math.round(p.montoCuotaCLP) });
  out.push({ id: "despues", nombre: "Después", meses: null, valorCLP: despues });
  return out;
}

/** Un trozo de frase: texto, o monto (que el render destaca; `rojo` si sale de tu bolsillo). */
export interface SegCuotas { t: string; monto?: boolean; rojo?: boolean }

const meses = (n: number) => (n === 1 ? "1 mes" : `${n} meses`);

/** «… pones $X de tu bolsillo» o «… te quedan $X», según el signo. */
function saldo(v: number, money: (n: number) => string, cierre: string): SegCuotas[] {
  return v < 0
    ? [{ t: "pones " }, { t: money(Math.abs(v)), monto: true, rojo: true }, { t: ` de tu bolsillo${cierre}` }]
    : [{ t: "te quedan " }, { t: money(v), monto: true }, { t: cierre }];
}

/** La portada, con el mismo peso que el flujo: «Los primeros N meses pones $X más; después, te quedan $Y al mes.» o
 *  la versión con entrega futura. */
export function fraseCuotasPortada(p: PieEnCuotas, money: (n: number) => string): SegCuotas[] {
  const cuota = Math.round(p.montoCuotaCLP);
  const despues = Math.round(p.flujoDespuesCLP ?? 0);
  const antes = p.mesesAntesEntrega ?? 0;
  const juntas = p.mesesConDividendo;
  if (antes > 0) {
    const segs: SegCuotas[] = [{ t: "Hasta la entrega pagas " }, { t: money(cuota), monto: true, rojo: true }, { t: " al mes, sin arriendo; " }];
    if (juntas > 0) segs.push({ t: `después, ${meses(juntas)} ` }, ...saldo(despues - cuota, money, ", y luego "));
    else segs.push({ t: "después, " });
    segs.push(...saldo(despues, money, " al mes."));
    return segs;
  }
  return [{ t: `Los primeros ${meses(juntas)} pones ` }, { t: money(cuota), monto: true, rojo: true }, { t: " más; después, " }, ...saldo(despues, money, " al mes.")];
}

/** «Qué significa» suma una o dos frases. */
export function cierreCuotas(p: PieEnCuotas, money: (n: number) => string): SegCuotas[] {
  const cuota = Math.round(p.montoCuotaCLP);
  const despues = Math.round(p.flujoDespuesCLP ?? 0);
  const segs: SegCuotas[] = [];
  if ((p.mesesAntesEntrega ?? 0) > 0) segs.push({ t: "Hasta la entrega pagas " }, { t: money(cuota), monto: true, rojo: true }, { t: " al mes, sin arriendo. " });
  if (p.mesesConDividendo > 0) {
    segs.push({ t: `Durante ${meses(p.mesesConDividendo)}, la cuota del pie se junta con el dividendo: ` }, ...saldo(despues - cuota, money, " cada mes. "));
  }
  return segs;
}

/** La línea de «Esto es lo que pesa»: el monto y los meses de las cuotas. */
export function filaPesaCuotas(p: PieEnCuotas): { frase: string; meses: string } {
  const antes = p.mesesAntesEntrega ?? 0;
  const juntas = p.mesesConDividendo;
  const frase = antes > 0 && juntas > 0
    ? `El pie en ${p.cuotas} cuotas: ${antes} sin arriendo y ${juntas} junto al dividendo`
    : antes > 0
      ? `El pie en ${p.cuotas} cuotas, todas antes de la entrega, sin arriendo`
      : `El pie en ${p.cuotas} cuotas: ${juntas} junto al dividendo`;
  return { frase, meses: `al mes · ${meses(antes + juntas)}` };
}

/** «Te queda» dice qué incluye: el primer año con arrendatario tiene cuotas → es lo de después. */
export const TE_QUEDA_DESPUES_CUOTAS = "después de terminar las cuotas del pie";
