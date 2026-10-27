// ─────────────────────────────────────────────────────────────────────────────
// El semanal de RENTA CORTA, la parte pura (14-oct-2026, decisiones de Fabrizio). Las prueba el tier SEMANAL-STR.
//   · QUIÉN: toda persona con un perfil de renta corta (sus informes de renta corta). Quien tiene los dos perfiles
//     recibe UN correo con DOS bloques —arriendo tradicional y renta corta—; quien solo tiene renta corta, solo ese.
//     La línea provisoria («Estos convienen para arriendo tradicional…», 13-oct) salió.
//   · ESTIMADO POR ZONA, SIN CONSULTAS: el motor de renta corta corre sobre los avisos de sus comunas (y las vecinas
//     como respaldo) con la tarifa y la ocupación típicas de la zona —la respuesta de mercado típica guardada de la
//     celda comuna × dormitorios—: hasta cinco que den Comprar, chequeados, con las vecinas de respaldo. SOLO COMPRAR
//     (14-oct-2026, segunda decisión): sin el respaldo de Ajustar negociable, y con menos de tres se mandan los que haya
//     (semanal.ts › REGLA_CORTA). El correo y la página lo dicen con la marca `MARCA_ZONA`.
//   · LA MEDICIÓN FINA, SOLO EN «ANALIZAR ESTE»: ahí se consulta al proveedor por la dirección del depto, como en el
//     wizard (el costo lo asume Franco). LA REGLA DE COBRO ES SIMPLE (14-oct-2026): si la medición fina no da Comprar,
//     no se cobra ni se descuenta nunca, y en lugar del informe se abre un pop-up con `NO_DA_DEPTO` y los parecidos de su
//     selección que SOBREVIVEN: reevaluados con la tarifa y la ocupación recién medidas, sin consultar de nuevo, se
//     ofrecen solo los que siguen dando Comprar; si no queda ninguno, `NINGUNO_MAS`. Desde el 27-oct-2026 el pop-up
//     dice además por qué, da el enlace a la publicación y ofrece «Analizar igual» (ése sí cobra). Cada comparación queda registrada
//     (`comparaciones_zona_str`, con `cambio` = el veredicto cambió respecto del que vio) para revisarla en un mes.
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
  zona: "Estimados con la tarifa y la ocupación típicas de su sector. Al analizar uno, Franco lo mide con los datos de esa dirección.",
  /** Quien tiene los dos perfiles y una semana sin ninguno en un bloque. */
  sinLargo: "Para arriendo tradicional, esta semana no apareció ninguno que te convenga.",
  sinCorto: "Para renta corta, esta semana no apareció ninguno que te convenga.",
} as const;

// ── EL POP-UP «NO DA» (27-oct-2026, decisión de Fabrizio tras el caso de un cliente que pagó el pack el 26-oct, cayó en
// «no da» y se quedó sin el enlace que el pop-up de antes le prometía). Cuando la medición fina cambia el veredicto, el
// pop-up dice que no da (`NO_DA_DEPTO`), POR QUÉ en una línea (`porQueNoDa`: la tarifa o la ocupación medidas contra las
// estimadas por zona), el enlace a la publicación («Ver la publicación») y «Analizar igual · usa 1 de tus N» para quien
// quiera el informe completo de todas formas (ése sí cobra: `igual` en analizarStrDeSemanal); debajo, los parecidos que sí
// dan (`PARECIDOS_DAN`) o, si no queda ninguno, `NINGUNO_MAS`. Las dos primeras frases son las de Fabrizio del 15-oct
// (`NO_DA` partido en dos: entre ellas van el porqué y las dos salidas). Lo fija el tier NO-DA-PUBLICACION.

/** La primera línea del pop-up (texto de Fabrizio, 15-oct-2026). */
export const NO_DA_DEPTO = "Con los datos de su dirección, este depto no da para renta corta.";
/** Antes de los parecidos que sí dan (texto de Fabrizio, 15-oct-2026). */
export const PARECIDOS_DAN = "Estos sí dan, con esos mismos datos:";
/** Sin parecidos que sobrevivan (antes `NINGUNO_DA`, que repetía la primera línea). */
export const NINGUNO_MAS = "Con esos mismos datos, ninguno más de tu selección da esta semana. Seguimos buscando.";

/** Lo que sigue al porqué y las salidas: los parecidos que sí dan o que no queda ninguno. */
export function continuacionNoDa(parecidos: number): string {
  return parecidos > 0 ? PARECIDOS_DAN : NINGUNO_MAS;
}

/** El botón para quien quiere el informe de todas formas: «Analizar igual · usa 1 de tus 3» (sin el uso, con el plan). */
export const ANALIZAR_IGUAL = "Analizar igual";
export function textoAnalizarIgual(uso: string | null): string {
  return uso ? `${ANALIZAR_IGUAL} · ${uso}` : ANALIZAR_IGUAL;
}

/** Desde cuánto se nombra una caída: la tarifa o la ocupación medidas, 5 % o más bajo lo estimado por zona. */
export const CAIDA_QUE_SE_NOMBRA = 0.05;

/**
 * POR QUÉ NO DA, EN UNA LÍNEA: la tarifa por noche y la ocupación medidas en su dirección contra las que estimaba la zona.
 * Se nombra lo que cayó `CAIDA_QUE_SE_NOMBRA` o más (las dos si cayeron las dos); si nada cayó tanto, o no hay contra qué
 * comparar, la línea dice que con su pie y su plazo no alcanza, sin cifras inventadas.
 */
export function porQueNoDa(zona: LadoMedicion | null, fino: LadoMedicion): string {
  const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
  // Entre la cifra y el % va un espacio sin quiebre: el % no queda solo en la línea siguiente.
  const pct = (o: number) => `${Math.round(o * 100)} %`;
  const cae = (z: number | null | undefined, f: number | null | undefined): boolean => z != null && f != null && z > 0 && f < z * (1 - CAIDA_QUE_SE_NOMBRA);
  const tarifa = cae(zona?.adr, fino.adr), ocupacion = cae(zona?.ocupacion, fino.ocupacion);
  const pre = "Con tu pie y tu plazo no alcanza: en su dirección";
  if (tarifa && ocupacion) return `${pre} la tarifa por noche es ${pesos(fino.adr!)} y la ocupación ${pct(fino.ocupacion!)}; la zona estimaba ${pesos(zona!.adr!)} y ${pct(zona!.ocupacion!)}.`;
  if (tarifa) return `${pre} la tarifa por noche es ${pesos(fino.adr!)}; la zona estimaba ${pesos(zona!.adr!)}.`;
  if (ocupacion) return `${pre} la ocupación es ${pct(fino.ocupacion!)}; la zona estimaba ${pct(zona!.ocupacion!)}.`;
  return "Con tu pie y tu plazo no alcanza con la tarifa y la ocupación de su dirección.";
}

/** La tarjeta del depto que no dio: queda marcada, sin botón (no se inserta nada en la lista). */
export const MARCA_NO_DA = "No da con los datos de su dirección";

/** Mientras mide (14-oct-2026): el botón pasa a un indicador giratorio con este texto. */
export const MIDIENDO = "Midiendo con los datos de su dirección, unos 30 segundos";
/** Pasado este tiempo, la medición se da por caída: error con «Reintentar» (la ruta corta a los 60 s). */
export const MIDIENDO_TOPE_MS = 60_000;
/** El error con reintentar. Reintentar no cobra dos veces (el cobro es una vez por persona y aviso, analizarUnaVez), pero
 *  la página no habla del cobro (15-oct-2026). */
export const MIDIENDO_TARDO = "La medición tardó más de lo esperado.";
export const REINTENTAR = "Reintentar";

/** Cuántos de los siguientes de su selección se ofrecen cuando uno no da («los dos o tres siguientes»). */
export const ALTERNATIVAS_NO_DA = 3;

/** ¿La medición fina cambió el veredicto que vio la persona? Se REGISTRA (la revisión de un mes); lo que decide el cobro
 *  es `daComprar`. */
export function cambiaVeredicto(mostrado: string | null | undefined, fino: string | null | undefined): boolean {
  return !mostrado || !fino || mostrado !== fino;
}

/** LA REGLA DE COBRO (14-oct-2026): se cobra solo si la medición fina da Comprar. Cualquier otra cosa —Ajustar, Buscar
 *  otro, o sin veredicto— no da, y no se cobra. */
export function daComprar(fino: string | null | undefined): boolean {
  return fino === "COMPRAR";
}

/** Lo que una persona ya midió fino de un depto (`comparaciones_zona_str`) y, si se cobró, el informe que se creó. */
export interface MedicionFina {
  fino: string | null;
  finoScore: number | null;
  analysisId: string | null;
}

/** «Ya lo analizaste · Ver informe» en lugar de «Analizar este» (15-oct-2026). */
export const YA_ANALIZADO = { texto: "Ya lo analizaste", enlace: "Ver informe" } as const;

/**
 * LO YA MEDIDO, EN LAS SELECCIONES SIGUIENTES (15-oct-2026, decisión de Fabrizio). Para cada persona, un depto que ya
 * midió fino deja de valer por su estimación por zona: si la medición fina no dio Comprar, queda FUERA (null); si dio
 * Comprar y ya tiene informe, entra como Comprar con el puntaje de esa medición y el flujo de su informe, y lleva
 * `informeId`: la página muestra «Ya lo analizaste · Ver informe» y no se vuelve a cobrar. Sin medición, o medido
 * Comprar sin informe (el cobro no llegó a hacerse), la estimación por zona sigue igual.
 */
export function aplicarMedicion<E extends { veredicto: string | null; score: number | null; flujo: number | null; ingresoMensual?: number | null }>(
  ev: E | null,
  m: MedicionFina | undefined,
  informe?: { flujo: number | null; ingresoMensual: number | null },
): (E & { informeId?: string }) | null {
  if (!m) return ev;
  if (!daComprar(m.fino)) return null;
  if (!m.analysisId || !ev) return ev;
  return {
    ...ev,
    veredicto: "COMPRAR",
    score: m.finoScore ?? ev.score,
    flujo: informe?.flujo ?? ev.flujo,
    ingresoMensual: informe?.ingresoMensual ?? ev.ingresoMensual ?? null,
    informeId: m.analysisId,
  };
}

/** Los siguientes de su selección, en orden: sin el que no dio, sin los caídos y sin los que ya se sabe que no dan. */
function siguientesDe<I extends { avisoId: string }>(items: I[], avisoId: string, excluir: ReadonlySet<string>): I[] {
  const i = items.findIndex((x) => x.avisoId === avisoId);
  const orden = i < 0 ? items : [...items.slice(i + 1), ...items.slice(0, i)];
  return orden.filter((x) => x.avisoId !== avisoId && !excluir.has(x.avisoId));
}

export function alternativasNoDa<I extends { avisoId: string }>(items: I[], avisoId: string, excluir: ReadonlySet<string>): I[] {
  return siguientesDe(items, avisoId, excluir).slice(0, ALTERNATIVAS_NO_DA);
}

/**
 * LOS PARECIDOS QUE SOBREVIVEN (14-oct-2026, decisión de Fabrizio): antes de ofrecerlos, cada uno se reevalúa con la
 * tarifa y la ocupación recién medidas —`reevaluar` devuelve su veredicto, sin consultar al proveedor— y se ofrecen
 * solo los que siguen dando Comprar, en el orden de su selección y hasta `ALTERNATIVAS_NO_DA`. Vacío: ninguno da
 * (`NINGUNO_DA`). Uno que no se pudo reevaluar no se ofrece.
 */
export async function parecidosQueSobreviven<I extends { avisoId: string }>(
  items: I[],
  avisoId: string,
  excluir: ReadonlySet<string>,
  reevaluar: (i: I) => Promise<string | null>,
): Promise<I[]> {
  const out: I[] = [];
  for (const x of siguientesDe(items, avisoId, excluir)) {
    if (out.length >= ALTERNATIVAS_NO_DA) break;
    if (daComprar(await reevaluar(x).catch(() => null))) out.push(x);
  }
  return out;
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
  | { estado: "no-da"; alternativas: string[]; zona: LadoMedicion | null; fino: LadoMedicion };

/**
 * «Analizar este» en un depto de la selección de renta corta, de punta a punta:
 *   chequear la ficha (despublicado: avisa y para, sin crédito) → preparar y MEDIR FINO (antes de reclamar nada) →
 *   registrar la comparación → si la medición fina no da Comprar: «no da» con los parecidos que sobreviven y la medición
 *   (para el porqué), sin reclamar, sin cobrar →
 *   si se sostiene —o la persona tocó «Analizar igual» (`igual`, 27-oct-2026)—: cobrar una vez y crear el informe
 *   (analizarUnaVez), y anotar en la comparación que se cobró.
 * Puro: las piezas se inyectan (el tier lo prueba con dobles y cuenta cobros y registros).
 */
export async function analizarStrDeSemanal(p: {
  /** «Analizar igual» desde el pop-up «no da»: quiere el informe aunque no dé Comprar, y lo paga. */
  igual?: boolean;
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
  if (!p.igual && !daComprar(m.fino.veredicto)) return { estado: "no-da", alternativas: await p.alternativas(), zona: m.zona, fino: m.fino };
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
