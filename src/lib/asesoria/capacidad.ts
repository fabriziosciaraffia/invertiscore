// ─────────────────────────────────────────────────────────────────────────────
// LA CAPACIDAD DE LA ASESORÍA (27-nov-2026, entrega 1 de «la asesoría en el mapa», decisiones de Fabrizio). Corre en el NAVEGADOR:
// la renta, las deudas, el pie y la edad no salen de él sin cuenta. Encima de la regla de Invierte (perfil.ts › REGLA_TOPE: pie
// 20 %, dividendo ≤ 25 %), con lo que pregunta la tarjeta «Tus números»:
//   · la renta computable: con contrato el 100 %, con boletas el 70 %, con las dos el 85 % (constantes con nombre: es una
//     estimación y el perfil lo dice);
//   · la carga total (dividendo + deudas): 40 %, o 35 % si hay boletas;
//   · el plazo según la edad: edad + plazo ≤ 75 con la edad más alta del rango, tope 30 → hasta 39: 30 · 40–49: 25 · 50–54: 20 ·
//     55+: 15;
//   · cada chip con su valor MÁS BAJO, salvo las deudas, que van con el MÁS ALTO (decisión del 27-nov-2026); la cifra se muestra
//     como «hasta aprox.»;
//   · el pie «menos de UF 300» calcula solo por la renta (pie de 20 %) y dice qué pie hace falta.
// Lo fija el tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
// LA REGLA ES UNA SOLA (27-nov-2026): la del módulo compartido con Invierte (src/lib/tope/regla.ts), con los gastos de la compra.
import {
  CAMINOS, CAMINO_DE_HOY, CARGA_MAX_PCT, DIVIDENDO_MAX_PCT, EDAD_MAS_PLAZO_MAX, PLAZO_MAX, RENTA_COMPUTABLE_PCT, creditoDeCuota, creditoPorRentaRegla,
  cuota, pieMasGastosPct, topesDeCompra, type Camino, type TipoRenta,
} from "@/lib/tope/regla";
export { CAMINOS, CAMINO_DE_HOY, CARGA_MAX_PCT, DIVIDENDO_MAX_PCT, EDAD_MAS_PLAZO_MAX, PLAZO_MAX, RENTA_COMPUTABLE_PCT, creditoDeCuota, cuota, pieMasGastosPct };
export type { Camino, TipoRenta };
/** El pie del camino de hoy (sin gastos): el banco financia el 80 %. */
export const PIE_PCT = CAMINOS[CAMINO_DE_HOY].piePct;

export type RangoEdad = "hasta_39" | "40_49" | "50_54" | "55_mas";

// ── LOS CHIPS DE «TUS NÚMEROS» (lámina P3Numeros) ───────────────────────────
/** La renta líquida al mes. El primero no tiene piso: se calcula con RENTA_SIN_PISO (y la fórmula lo dice). */
export const RENTA_SIN_PISO = 1_000_000;
export const CHIPS_RENTA = [
  { id: "r1", texto: "< $1,5M", valor: RENTA_SIN_PISO },
  { id: "r2", texto: "$1,5–2,5M", valor: 1_500_000 },
  { id: "r3", texto: "$2,5–3,5M", valor: 2_500_000 },
  { id: "r4", texto: "+$3,5M", valor: 3_500_000 },
] as const;
export const CHIPS_TIPO_RENTA = [
  { id: "contrato", texto: "Contrato" },
  { id: "boletas", texto: "Boletas" },
  { id: "ambas", texto: "Las dos" },
] as const;
/** La edad: el rango de la lámina «50+» se parte en dos porque el plazo cambia a los 55. */
export const CHIPS_EDAD = [
  { id: "e1", texto: "< 30", rango: "hasta_39", edadMax: 29 },
  { id: "e2", texto: "30–39", rango: "hasta_39", edadMax: 39 },
  { id: "e3", texto: "40–49", rango: "40_49", edadMax: 49 },
  { id: "e4", texto: "50–54", rango: "50_54", edadMax: 54 },
  { id: "e5", texto: "55+", rango: "55_mas", edadMax: 60 },
] as const;
/** El pie ahorrado, en UF. El primero (menos de UF 300) calcula solo por la renta. */
export const CHIPS_PIE = [
  { id: "p1", texto: "< UF 300", valor: null },
  { id: "p2", texto: "UF 300–600", valor: 300 },
  { id: "p3", texto: "UF 600–900", valor: 600 },
  { id: "p4", texto: "+UF 900", valor: 900 },
] as const;
/** Las deudas al mes (con dividendos), con el valor MÁS ALTO de cada rango. El último no tiene techo: DEUDA_SIN_TECHO. */
export const DEUDA_SIN_TECHO = 750_000;
export const CHIPS_DEUDAS = [
  { id: "d0", texto: "Ninguna", valor: 0 },
  { id: "d1", texto: "< $200 mil", valor: 200_000 },
  { id: "d2", texto: "$200–500 mil", valor: 500_000 },
  { id: "d3", texto: "+$500 mil", valor: DEUDA_SIN_TECHO },
] as const;
export const CHIPS_PREAPROBACION = [
  { id: "tengo", texto: "Sí" },
  { id: "tramite", texto: "En trámite" },
  { id: "no", texto: "No" },
] as const;

export type IdRenta = (typeof CHIPS_RENTA)[number]["id"];
export type IdEdad = (typeof CHIPS_EDAD)[number]["id"];
export type IdPie = (typeof CHIPS_PIE)[number]["id"];
export type IdDeudas = (typeof CHIPS_DEUDAS)[number]["id"];
export type Preaprobado = (typeof CHIPS_PREAPROBACION)[number]["id"];

export interface Numeros {
  renta: IdRenta;
  tipoRenta: TipoRenta;
  edad: IdEdad;
  pie: IdPie;
  deudas: IdDeudas;
  preaprobado: Preaprobado;
}

const de = <T extends { id: string }>(xs: readonly T[], id: string): T | null => xs.find((x) => x.id === id) ?? null;

/** ¿Están las seis respuestas, y son de la lista? */
export function numerosValidos(n: Partial<Record<keyof Numeros, unknown>> | null | undefined): n is Numeros {
  if (!n) return false;
  return !!de(CHIPS_RENTA, String(n.renta)) && !!de(CHIPS_TIPO_RENTA, String(n.tipoRenta)) && !!de(CHIPS_EDAD, String(n.edad))
    && !!de(CHIPS_PIE, String(n.pie)) && !!de(CHIPS_DEUDAS, String(n.deudas)) && !!de(CHIPS_PREAPROBACION, String(n.preaprobado));
}

/** El plazo que la edad permite: edad + plazo ≤ 75 con la edad más alta del rango, tope 30, en pasos de 5 años. */
export function plazoDeEdad(edadMax: number): number {
  const libre = EDAD_MAS_PLAZO_MAX - edadMax;
  return Math.max(5, Math.min(PLAZO_MAX, Math.floor(libre / 5) * 5));
}

/** El rango de edad que se guarda y su plazo. */
export function edadDeChip(id: IdEdad): { rango: RangoEdad; plazo: number } {
  const c = de(CHIPS_EDAD, id)!;
  // 55+: la edad más alta del rango no existe; la regla de Fabrizio le da 15 años.
  return { rango: c.rango, plazo: c.rango === "55_mas" ? 15 : plazoDeEdad(c.edadMax) };
}

export type Limita = "pie" | "renta" | "deudas";

export interface Capacidad {
  /** El camino con que se calculó el pie (hoy, siempre «usado»). */
  camino: Camino;
  /** Hasta cuánto puede comprar, en UF, redondeado hacia abajo a 10 (se muestra «hasta aprox.»): el menor de los dos topes. 0 si las
   *  deudas no dejan cuota. */
  topeUF: number;
  /** LOS DOS TOPES, por separado (se guardan los dos en el perfil), con los gastos de la compra: el de la renta ((pie + crédito) ÷
   *  1,044, o crédito ÷ 80 % sin pie) y el del pie (pie ÷ 24,4 %; null con menos de UF 300). Redondeados hacia abajo a 10: son las
   *  MISMAS cifras que muestra la fórmula (una sola cifra, un solo redondeo). */
  topeRentaUF: number;
  topePieUF: number | null;
  limita: Limita;
  /** El pie con que se calculó (null: menos de UF 300, solo por la renta). */
  pieUF: number | null;
  /** El pie que hace falta para el tope, contando los gastos (solo sin pie: «Para eso necesitas un pie de UF Y»). */
  pieNecesarioUF: number | null;
  /** Por la renta (= topeRentaUF). */
  porRentaUF: number;
  creditoUF: number;
  /** Por el pie (= topePieUF). */
  porPieUF: number | null;
  plazo: number;
  rangoEdad: RangoEdad;
  tasaPct: number;
  rentaCLP: number;
  rentaComputableCLP: number;
  rentaComputablePct: number;
  cargaMaxPct: number;
  deudasCLP: number;
  /** La cuota máxima que deja la regla (25 % y la carga). */
  cuotaMaxCLP: number;
  /** El dividendo al tope y la carga que deja (dividendo + deudas) / renta computable, en %. */
  dividendoCLP: number;
  cargaPct: number;
}

const abajo10 = (x: number) => Math.max(0, Math.floor(x / 10) * 10);

export function capacidad(n: Numeros, cfg: { tasaPct: number; uf: number }, camino: Camino = CAMINO_DE_HOY): Capacidad {
  const renta = de(CHIPS_RENTA, n.renta)!.valor;
  const deudas = de(CHIPS_DEUDAS, n.deudas)!.valor;
  const { rango, plazo } = edadDeChip(n.edad);
  const cr = creditoPorRentaRegla({ rentaCLP: renta, tipoRenta: n.tipoRenta, otrasCuotasCLP: deudas, plazoAnios: plazo, tasaPct: cfg.tasaPct, uf: cfg.uf });
  const pieUF = de(CHIPS_PIE, n.pie)!.valor;
  const t = topesDeCompra({ pieUF, creditoUF: cr.creditoUF, camino });
  const sinCuota = cr.creditoUF <= 0;
  const topeRenta = sinCuota ? 0 : abajo10(t.topeRentaUF ?? 0);
  const topePie = t.topePieUF == null ? null : abajo10(t.topePieUF);
  const topeUF = sinCuota ? 0 : topePie == null ? topeRenta : Math.min(topeRenta, topePie);
  const limita: Limita = pieUF != null && t.limita === "pie" ? "pie" : cr.limitanDeudas ? "deudas" : "renta";
  const f = CAMINOS[camino].piePct / 100;
  // El crédito que usaría al tope: el precio menos lo que pone de pie después de los gastos (sin pie, el 80 % del precio).
  const gastosUF = (topeUF * CAMINOS[camino].gastosPct) / 100;
  const creditoUsadoUF = pieUF == null ? topeUF * (1 - f) : Math.max(0, Math.min(cr.creditoUF, topeUF + gastosUF - pieUF));
  const dividendo = cuota(creditoUsadoUF * cfg.uf, cfg.tasaPct, plazo);
  return {
    camino, topeUF, topeRentaUF: topeRenta, topePieUF: topePie,
    limita, pieUF, pieNecesarioUF: pieUF == null ? Math.round((topeUF * pieMasGastosPct(camino)) / 100) : null,
    porRentaUF: topeRenta, creditoUF: abajo10(cr.creditoUF), porPieUF: topePie,
    plazo, rangoEdad: rango, tasaPct: cfg.tasaPct, rentaCLP: renta, rentaComputableCLP: Math.round(cr.rentaComputableCLP), rentaComputablePct: RENTA_COMPUTABLE_PCT[n.tipoRenta],
    cargaMaxPct: cr.cargaMaxPct, deudasCLP: deudas, cuotaMaxCLP: Math.round(cr.cuotaMaxCLP), dividendoCLP: Math.round(dividendo),
    cargaPct: cr.rentaComputableCLP > 0 ? Math.round(((dividendo + deudas) / cr.rentaComputableCLP) * 100) : 0,
  };
}

/** LA PRUEBA DE TASA DE UN DEPTO (decisión de Fabrizio, 27-nov-2026: reemplaza a «Si algo se mueve» del perfil): cuánto le cambia el
 *  flujo si la tasa sube 1 punto, con el crédito del 80 % a su plazo. `flujoCLP` es el de la evaluación (ya cuenta un mes vacío). */
export function pruebaTasa(p: { precioUF: number; flujoCLP: number; plazo: number; tasaPct: number; uf: number }): { aguanta: boolean; poneCLP: number } {
  const creditoCLP = p.precioUF * (1 - PIE_PCT / 100) * p.uf;
  const sube = cuota(creditoCLP, p.tasaPct + 1, p.plazo) - cuota(creditoCLP, p.tasaPct, p.plazo);
  const queda = p.flujoCLP - sube;
  return { aguanta: queda >= 0, poneCLP: queda >= 0 ? 0 : Math.round(-queda) };
}

// ── EL TIPO DE PERFIL ────────────────────────────────────────────────────────
export type Experiencia = "primera" | "uno" | "varios";
export type ObjetivoAsesoria = "arriendo" | "plusvalia" | "ambas" | "no_se";
export type TipoPerfil = "primer_paso" | "rentista" | "patrimonial" | "equilibrado";

/** Primer paso: primera inversión. Rentista: ya tiene y quiere que se pague solo. Patrimonial: ya tiene y quiere que gane valor.
 *  Equilibrado: ya tiene y quiere las dos, o no sabe. */
export function tipoPerfil(e: Experiencia, o: ObjetivoAsesoria): TipoPerfil {
  if (e === "primera") return "primer_paso";
  return o === "arriendo" ? "rentista" : o === "plusvalia" ? "patrimonial" : "equilibrado";
}

/** El objetivo como lo guarda inv_perfiles (su check no cambia: «No sé» va como «ambas» y el tipo queda «equilibrado»). */
export const objetivoDePerfil = (o: ObjetivoAsesoria): "arriendo" | "plusvalia" | "ambas" => (o === "no_se" ? "ambas" : o);

/** Los avisos que acompañan al perfil, en orden. */
export function avisosDelPerfil(p: { tipoRenta: TipoRenta; experiencia: Experiencia }): Array<"boletas" | "segunda" | "estimacion"> {
  return [
    ...(p.tipoRenta !== "contrato" ? (["boletas"] as const) : []),
    ...(p.experiencia !== "primera" ? (["segunda"] as const) : []),
    "estimacion" as const,
  ];
}
