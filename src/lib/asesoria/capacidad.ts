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
import { REGLA_TOPE } from "@/lib/invierte-v2/perfil";

/** Cuánto de la renta cuenta el banco, según cómo se recibe (estimación: el perfil lo dice). */
export const RENTA_COMPUTABLE_PCT = { contrato: 100, boletas: 70, ambas: 85 } as const;
/** La carga total máxima (dividendo + deudas): 40 %, o 35 % si parte de la renta es por boletas. */
export const CARGA_MAX_PCT = { contrato: 40, boletas: 35, ambas: 35 } as const;
/** El dividendo no pasa del 25 % de la renta computable (la regla de Invierte). */
export const DIVIDENDO_MAX_PCT = REGLA_TOPE.dividendoMaxPct;
/** El pie: el banco financia el 80 %. */
export const PIE_PCT = REGLA_TOPE.piePct;
/** Edad + plazo no pasa de esto (con la edad más alta del rango). */
export const EDAD_MAS_PLAZO_MAX = 75;
export const PLAZO_MAX = 30;

export type TipoRenta = keyof typeof RENTA_COMPUTABLE_PCT;
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

/** La cuota de un crédito (sistema francés, sin seguros): la misma fórmula que calcDividendo. */
export function cuota(creditoCLP: number, tasaPct: number, plazoAnios: number): number {
  if (creditoCLP <= 0) return 0;
  const i = tasaPct / 100 / 12, n = plazoAnios * 12;
  return i === 0 ? creditoCLP / n : (creditoCLP * i) / (1 - Math.pow(1 + i, -n));
}
/** El crédito que paga una cuota (la inversa). */
export function creditoDeCuota(cuotaCLP: number, tasaPct: number, plazoAnios: number): number {
  if (cuotaCLP <= 0) return 0;
  const i = tasaPct / 100 / 12, n = plazoAnios * 12;
  return i === 0 ? cuotaCLP * n : (cuotaCLP * (1 - Math.pow(1 + i, -n))) / i;
}

export type Limita = "pie" | "renta" | "deudas";

export interface Capacidad {
  /** Hasta cuánto puede comprar, en UF, redondeado hacia abajo a 10 (se muestra «hasta aprox.»). 0 si las deudas no dejan cuota. */
  topeUF: number;
  limita: Limita;
  /** El pie con que se calculó (null: menos de UF 300, solo por la renta). */
  pieUF: number | null;
  /** El pie que hace falta para el tope (solo sin pie: «Para eso necesitas un pie de UF Y»). */
  pieNecesarioUF: number | null;
  /** Por la renta: crédito + pie (o crédito / 80 % sin pie). */
  porRentaUF: number;
  creditoUF: number;
  /** Por el pie: pie / 20 % (null sin pie). */
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

export function capacidad(n: Numeros, cfg: { tasaPct: number; uf: number }): Capacidad {
  const renta = de(CHIPS_RENTA, n.renta)!.valor;
  const pct = RENTA_COMPUTABLE_PCT[n.tipoRenta];
  const cargaMax = CARGA_MAX_PCT[n.tipoRenta];
  const rentaComp = (renta * pct) / 100;
  const deudas = de(CHIPS_DEUDAS, n.deudas)!.valor;
  const { rango, plazo } = edadDeChip(n.edad);
  const cuotaMax = Math.max(0, Math.min((rentaComp * DIVIDENDO_MAX_PCT) / 100, (rentaComp * cargaMax) / 100 - deudas));
  const creditoUF = cfg.uf > 0 ? creditoDeCuota(cuotaMax, cfg.tasaPct, plazo) / cfg.uf : 0;
  const pieUF = de(CHIPS_PIE, n.pie)!.valor;
  const f = PIE_PCT / 100;
  let topeExacto: number, limita: Limita, porRenta: number, porPie: number | null, pieNecesario: number | null = null;
  if (pieUF == null) {
    porRenta = creditoUF / (1 - f);
    porPie = null;
    topeExacto = porRenta;
    limita = cuotaMax < (rentaComp * DIVIDENDO_MAX_PCT) / 100 ? "deudas" : "renta";
    pieNecesario = abajo10(topeExacto) * f;
  } else {
    porRenta = pieUF + creditoUF;
    porPie = pieUF / f;
    topeExacto = Math.min(porPie, porRenta);
    limita = porPie <= porRenta ? "pie" : cuotaMax < (rentaComp * DIVIDENDO_MAX_PCT) / 100 ? "deudas" : "renta";
  }
  const topeUF = creditoUF <= 0 ? 0 : abajo10(topeExacto);
  const creditoUsadoUF = pieUF == null ? topeUF * (1 - f) : Math.max(0, topeUF - pieUF);
  const dividendo = cuota(creditoUsadoUF * cfg.uf, cfg.tasaPct, plazo);
  return {
    topeUF, limita, pieUF, pieNecesarioUF: pieNecesario == null ? null : Math.round(pieNecesario),
    porRentaUF: Math.round(porRenta), creditoUF: Math.round(creditoUF), porPieUF: porPie == null ? null : Math.round(porPie),
    plazo, rangoEdad: rango, tasaPct: cfg.tasaPct, rentaCLP: renta, rentaComputableCLP: Math.round(rentaComp), rentaComputablePct: pct,
    cargaMaxPct: cargaMax, deudasCLP: deudas, cuotaMaxCLP: Math.round(cuotaMax), dividendoCLP: Math.round(dividendo),
    cargaPct: rentaComp > 0 ? Math.round(((dividendo + deudas) / rentaComp) * 100) : 0,
  };
}

/** LA PRUEBA DE ESTRÉS del perfil: cuánto sube el dividendo si la tasa sube 1 punto, y cuánto pone con 1 mes vacío al año
 *  (el arriendo de un mes repartido en los 12, sobre lo que ya pone). */
export function estres(c: Pick<Capacidad, "topeUF" | "pieUF" | "plazo" | "tasaPct">, uf: number, p: { aporteCLP: number; arriendoCLP: number | null }): { subeTasaCLP: number; mesVacioCLP: number | null } {
  const f = PIE_PCT / 100;
  const creditoCLP = (c.pieUF == null ? c.topeUF * (1 - f) : Math.max(0, c.topeUF - c.pieUF)) * uf;
  const sube = cuota(creditoCLP, c.tasaPct + 1, c.plazo) - cuota(creditoCLP, c.tasaPct, c.plazo);
  return { subeTasaCLP: Math.round(sube), mesVacioCLP: p.arriendoCLP == null ? null : Math.round(p.aporteCLP + p.arriendoCLP / 12) };
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
