// ─────────────────────────────────────────────────────────────────────────────
// El aviso inmediato (05-oct-2026, decisiones de Fabrizio). A quien respondió «Ya» a «¿Cuándo piensas
// comprar?», el mismo día que la evaluación de avisos encuentra uno NUEVO que da Comprar con su perfil
// —sus comunas, su tipología, su precio, su pie y su plazo— y que sigue publicado. Reglas (puras, las
// prueba el tier INMEDIATO):
//   · SOLO COMPRAR: sin vecinas ni Ajustar negociables (eso es del semanal).
//   · SIN SATURAR: un correo por día por persona; si hay varios, van juntos (hasta TOPE_INMEDIATO). Un
//     depto ya avisado no se vuelve a avisar, y no se repite en el semanal.
//   · EL «YA» VENCE: a los 60 días sin compra (desde que dijo «Ya» o desde su última compra, lo más
//     reciente) se le vuelve a preguntar «¿Cuándo piensas comprar?» con un clic. Mientras no responda,
//     no hay avisos: le queda el semanal. Si responde «Ya», vuelve a correr el plazo.
//   · LA BAJA de los avisos es propia: dejar de recibirlos no toca el semanal.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import type { EstadoPublicacion } from "./publicacion";
import type { Evaluado } from "./seleccion";
import type { CandidatoSemanal } from "./semanal";

export const DIAS_VENCE_YA = 60;
/** Hasta cuántos deptos lleva un aviso (si en el día aparecen varios). */
export const TOPE_INMEDIATO = 5;
/** Cuántos candidatos nuevos se recalculan con los números de la persona. */
export const MAX_CANDIDATOS_INMEDIATO = 40;
/** «Nuevo»: entró al listado en las últimas 48 horas (la evaluación corre dos veces al día). */
export const VENTANA_NUEVOS_HORAS = 48;
/** Cuántos días atrás miran el semanal y el aviso para no repetir un depto ya avisado. */
export const DIAS_NO_REPETIR = 30;

export const RUTA_SUELTO_INMEDIATO = "/checkout?product=single&origen=inmediato";

export type HorizonteCompra = "ya" | "meses" | "mirando";

/** ¿Le corren los avisos? «vigente»; «preguntar» (cumplió 60 días: toca la pregunta); «vencido» (se le
 *  preguntó y no respondió: solo el semanal); «no» (no dijo «Ya», o se dio de baja de los avisos). */
export function estadoYa(p: {
  horizonte: HorizonteCompra | null;
  yaDesde: Date | null;
  ultimaCompra: Date | null;
  preguntaAt: Date | null;
  bajaAt: Date | null;
  ahora?: Date;
}): "vigente" | "preguntar" | "vencido" | "no" {
  const ahora = p.ahora ?? new Date();
  if (p.horizonte !== "ya" || !p.yaDesde || p.bajaAt) return "no";
  // Se le preguntó después de su último «Ya» y no respondió: queda en el semanal.
  if (p.preguntaAt && p.preguntaAt.getTime() >= p.yaDesde.getTime()) return "vencido";
  const base = Math.max(p.yaDesde.getTime(), p.ultimaCompra?.getTime() ?? 0);
  return ahora.getTime() - base >= DIAS_VENCE_YA * 864e5 ? "preguntar" : "vigente";
}

/** El día del aviso, en hora de Chile (YYYY-MM-DD): el «un correo por día». */
export function diaDelAviso(ahora: Date = new Date()): string {
  const chile = new Date(ahora.getTime() - 3 * 3600_000);
  return chile.toISOString().slice(0, 10);
}

/**
 * Elige los deptos del aviso: los candidatos nuevos que no se le avisaron, recalculados con sus números;
 * SOLO Comprar, por puntaje; y la ficha se chequea de a uno hasta `TOPE_INMEDIATO` publicados. Con uno
 * basta. Un candidato sin chequear (sin cupo) no entra: se intenta en la corrida siguiente.
 */
export async function elegirInmediato<T extends CandidatoSemanal>(
  candidatos: T[],
  yaAvisados: ReadonlySet<string>,
  evaluar: (c: T) => Promise<Evaluado | null>,
  publicado: (c: T) => Promise<EstadoPublicacion>,
): Promise<Array<{ c: T; ev: Evaluado }>> {
  const pool = candidatos.filter((c) => !yaAvisados.has(c.avisoId))
    .sort((a, b) => (b.scoreCron ?? -1) - (a.scoreCron ?? -1)).slice(0, MAX_CANDIDATOS_INMEDIATO);
  const evs = await Promise.all(pool.map((c) => evaluar(c).catch(() => null)));
  const comprar = pool.map((c, i) => ({ c, ev: evs[i] }))
    .filter((x): x is { c: T; ev: Evaluado } => x.ev?.veredicto === "COMPRAR")
    .sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1));
  const items: Array<{ c: T; ev: Evaluado }> = [];
  for (const it of comprar) {
    if (items.length >= TOPE_INMEDIATO) break;
    if ((await publicado(it.c).catch((): EstadoPublicacion => "sin-chequeo")) === "publicado") items.push(it);
  }
  return items;
}

/** El copy del aviso y de la pregunta (05-oct-2026). */
export const INMEDIATO = {
  asunto: "Apareció un depto que conviene con lo que buscas",
  titular: "Apareció un depto que conviene con lo que buscas",
  titularVarios: (n: number) => `Aparecieron ${n} deptos que convienen con lo que buscas`,
  intro: (n: number, busca: string, pie: string, plazo: number) =>
    n === 1
      ? `Apareció hoy un depto publicado como los que buscas —${busca}— que resulta con tu pie de ${pie}% y tu plazo de ${plazo} años.`
      : `Aparecieron hoy ${n} deptos publicados como los que buscas —${busca}— que resultan con tu pie de ${pie}% y tu plazo de ${plazo} años.`,
  porQue: "Te llega porque nos dijiste que piensas comprar ya.",
  baja: "Dejar de recibir estos avisos",
  bajaSigue: "El resumen de cada semana sigue llegando.",
  botonConSaldo: "Analizar uno",
  botonSinSaldo: `Analizar uno · ${fmtCLP(SINGLE_PRICE)}`,
  bajaLista: "Listo. Ya no te avisamos al momento.",
  bajaVolver: "El resumen de cada semana sigue llegando. Si cambias de idea, escríbenos a hola@refranco.ai.",
  pregunta: {
    asunto: "¿Cuándo piensas comprar?",
    titular: "¿Cuándo piensas comprar?",
    cuerpo: "Hace dos meses nos dijiste que piensas comprar ya, y por eso te avisamos apenas aparece un depto que conviene con lo que buscas. ¿Sigue igual?",
    sinRespuesta: "Si no respondes, dejamos los avisos al momento y te seguimos mandando el resumen de cada semana.",
    opciones: [
      { id: "ya", texto: "Ya" },
      { id: "meses", texto: "En los próximos meses" },
      { id: "mirando", texto: "Solo estoy mirando" },
    ] as ReadonlyArray<{ id: HorizonteCompra; texto: string }>,
    gracias: "Listo, lo anotamos.",
    graciasYa: "Te seguimos avisando apenas aparezca un depto que conviene con lo que buscas.",
    graciasOtro: "Te seguimos mandando el resumen de cada semana.",
    error: "No pudimos anotarlo con ese enlace. Escríbenos a hola@refranco.ai y lo hacemos.",
  },
} as const;
