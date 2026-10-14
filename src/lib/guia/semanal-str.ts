// ─────────────────────────────────────────────────────────────────────────────
// El semanal de RENTA CORTA, la parte pura (14-oct-2026, decisiones de Fabrizio). Las prueba el tier SEMANAL-STR.
//   · QUIÉN: toda persona con un perfil de renta corta (sus informes de renta corta). Quien tiene los dos perfiles
//     recibe UN correo con DOS bloques —arriendo tradicional y renta corta—; quien solo tiene renta corta, solo ese.
//     La línea provisoria («Estos convienen para arriendo tradicional…», 13-oct) salió.
//   · ESTIMADO POR ZONA, SIN CONSULTAS: el motor de renta corta corre sobre los avisos de sus comunas (y las vecinas
//     como respaldo) con la tarifa y la ocupación típicas de la zona —la respuesta de mercado típica guardada de la
//     celda comuna × dormitorios—, con las MISMAS reglas que renta larga: hasta cinco que den Comprar, chequeados,
//     respaldo con vecinas y con los negociables. El correo y la página lo dicen con la marca `MARCA_ZONA`.
//   · LA MEDICIÓN FINA, SOLO EN «ANALIZAR ESTE»: ahí se consulta al proveedor por la dirección del depto, como en el
//     wizard (el costo lo asume Franco). Si esa medición CAMBIA EL VEREDICTO respecto del que vio la persona, el
//     análisis no se cobra ni se descuenta nunca, y en lugar del informe se muestra `NO_DA` con los siguientes de su
//     selección. Cada comparación queda registrada (`comparaciones_zona_str`) para saber cuántas veces cambia.
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoPublicacion } from "./publicacion";
import { analizarUnaVez, type PiezasAnalizar, type ResultadoAnalizar } from "./analizar-una-vez";

/** La marca de un depto del bloque de renta corta: se estimó con la tarifa y la ocupación típicas de su zona. */
export const MARCA_ZONA = "Estimado por zona";

/** Lo que dice el bloque de renta corta (correo y página). */
export const SEMANAL_STR = {
  bloqueLargo: "Para arriendo tradicional",
  bloqueCorto: "Para renta corta",
  intro: (n: number, busca: string, pie: string, plazo: number) =>
    `${n === 1 ? "Este depto publicado como los que buscas" : `Estos ${n} deptos publicados como los que buscas`} —${busca}— ${n === 1 ? "resulta" : "resultan"} para renta corta con tu pie de ${pie}% y tu plazo de ${plazo} años.`,
  zona: "Están estimados por zona: con la tarifa y la ocupación típicas de su sector. Al analizar uno, Franco lo mide con los datos de su dirección; si así no da para renta corta, no te cobramos el análisis.",
  /** Quien tiene los dos perfiles y una semana sin ninguno en un bloque. */
  sinLargo: "Para arriendo tradicional, esta semana no apareció ninguno que te convenga.",
  sinCorto: "Para renta corta, esta semana no apareció ninguno que te convenga.",
} as const;

/** «Analizar este» cuando la medición fina cambia el veredicto (texto de Fabrizio, 14-oct-2026). */
export const NO_DA = "Con los datos de hoy, este depto no da para renta corta. No te cobramos el análisis. Prueba con estos, que son parecidos.";

/** Cuántos de los siguientes de su selección se ofrecen cuando uno no da («los dos o tres siguientes»). */
export const ALTERNATIVAS_NO_DA = 3;

/** ¿La medición fina cambió el veredicto que vio la persona? Cualquier diferencia cuenta: el informe diría otra cosa
 *  que lo prometido, y eso no se cobra. */
export function cambiaVeredicto(mostrado: string | null | undefined, fino: string | null | undefined): boolean {
  return !mostrado || !fino || mostrado !== fino;
}

/** Los siguientes de su selección, en orden: sin el que no dio, sin los caídos y sin los que ya se sabe que no dan. */
export function alternativasNoDa<I extends { avisoId: string }>(items: I[], avisoId: string, excluir: ReadonlySet<string>): I[] {
  const i = items.findIndex((x) => x.avisoId === avisoId);
  const orden = i < 0 ? items : [...items.slice(i + 1), ...items.slice(0, i)];
  return orden.filter((x) => x.avisoId !== avisoId && !excluir.has(x.avisoId)).slice(0, ALTERNATIVAS_NO_DA);
}

/** Lo que se mide de un lado (zona o fino): el veredicto, su puntaje y la tarifa y ocupación con que se calculó. */
export interface LadoMedicion {
  veredicto: string | null;
  score: number | null;
  adr: number | null;
  ocupacion: number | null;
}

/** Una fila de `comparaciones_zona_str`. */
export interface ComparacionStr {
  /** El veredicto que vio la persona en su selección (por zona) y su puntaje. */
  mostrado: string;
  mostradoScore: number | null;
  /** La zona recalculada al medir, con el mismo cuerpo que la medición fina: aísla lo que mide el proveedor. */
  zona: LadoMedicion | null;
  fino: LadoMedicion;
  cambio: boolean;
  cobrado: boolean;
  analysisId: string | null;
}

/** Lo que `preparar` entrega: el depto ya medido fino y las piezas para cobrar y crear su informe. */
export interface MedicionPreparada {
  mostrado: { veredicto: string; score: number | null };
  zona: LadoMedicion | null;
  fino: LadoMedicion;
  piezas: PiezasAnalizar;
}

export type ResultadoAnalizarStr =
  | ResultadoAnalizar
  | { estado: "despublicado" }
  | { estado: "sin-preparar"; status: number; error: string }
  | { estado: "no-da"; alternativas: string[] };

/**
 * «Analizar este» en un depto de la selección de renta corta, de punta a punta:
 *   chequear la ficha (despublicado: avisa y para, sin crédito) → preparar y MEDIR FINO (antes de reclamar nada) →
 *   registrar la comparación → si el veredicto cambió: NO_DA con los siguientes, sin reclamar, sin cobrar →
 *   si se sostiene: cobrar una vez y crear el informe (analizarUnaVez), y anotar en la comparación que se cobró.
 * Puro: las piezas se inyectan (el tier lo prueba con dobles y cuenta cobros y registros).
 */
export async function analizarStrDeSemanal(p: {
  /** El informe de renta corta de este aviso que la persona ya tiene: se abre sin medir ni cobrar de nuevo. */
  yaCreado(): Promise<string | null>;
  chequear(): Promise<EstadoPublicacion>;
  alDespublicar(): Promise<void>;
  preparar(): Promise<{ ok: true; m: MedicionPreparada } | { ok: false; status: number; error: string }>;
  registrar(c: ComparacionStr): Promise<void>;
  alternativas(): Promise<string[]>;
}): Promise<ResultadoAnalizarStr> {
  const ya = await p.yaCreado();
  if (ya) return { estado: "ya-creado", id: ya };
  if ((await p.chequear()) === "despublicado") {
    await p.alDespublicar();
    return { estado: "despublicado" };
  }
  const prep = await p.preparar();
  if (!prep.ok) return { estado: "sin-preparar", status: prep.status, error: prep.error };
  const { m } = prep;
  const base: ComparacionStr = {
    mostrado: m.mostrado.veredicto, mostradoScore: m.mostrado.score, zona: m.zona, fino: m.fino,
    cambio: cambiaVeredicto(m.mostrado.veredicto, m.fino.veredicto), cobrado: false, analysisId: null,
  };
  await p.registrar(base);
  if (base.cambio) return { estado: "no-da", alternativas: await p.alternativas() };
  const r = await analizarUnaVez(m.piezas);
  if (r.estado === "creado" || r.estado === "ya-creado") await p.registrar({ ...base, cobrado: true, analysisId: r.id });
  return r;
}

/** El ingreso de mercado de una estimación por año: tarifa p50 × ocupación p50 × 365 (la misma base que la referencia
 *  STR de la zona, strref-zona.ts). null si la respuesta no trae los dos. */
export function ingresoAnualDeEstimacion(percentiles: unknown): number | null {
  const p = (percentiles ?? {}) as { average_daily_rate?: { p50?: unknown }; occupancy?: { p50?: unknown } };
  const adr = Number(p.average_daily_rate?.p50), occ = Number(p.occupancy?.p50);
  return adr > 0 && occ > 0 && occ <= 1 ? adr * occ * 365 : null;
}

/** La respuesta típica de una celda: la de ingreso MEDIANO entre las guardadas (la de abajo si son pares). null con menos
 *  de `minN` respuestas: sin muestra no hay zona, y el depto no entra (nunca se consulta). */
export function respuestaTipica<R extends { ingresoAnual: number }>(respuestas: R[], minN: number): R | null {
  if (respuestas.length < minN) return null;
  const orden = [...respuestas].sort((a, b) => a.ingresoAnual - b.ingresoAnual);
  return orden[Math.floor((orden.length - 1) / 2)];
}

/** Mínimo de respuestas guardadas por celda para estimar por zona (el mismo piso del universo STR V2). */
export const MIN_RESPUESTAS_ZONA = 3;

export type EstadoBloque = "armada" | "pendiente" | "sin_match";

/**
 * El estado de la fila de la semana con sus dos bloques (null = no tiene ese perfil). Pendiente si alguno lo está (la
 * corrida siguiente vuelve a armar), armada si alguno se armó, y sin coincidencias si ninguno. Con un solo bloque es el
 * de ese bloque: quien solo tiene renta larga queda exactamente como antes.
 */
export function estadoDeFila(largo: EstadoBloque | null, corto: EstadoBloque | null): EstadoBloque {
  const bs = [largo, corto].filter((b): b is EstadoBloque => b != null);
  if (bs.includes("pendiente")) return "pendiente";
  if (bs.includes("armada")) return "armada";
  return "sin_match";
}
