// ============================================================================
// GUARDS DE SALIDA STR (Goal 2 · 04-sep-2026) — detección PURA, fuente única
// ============================================================================
// Cinco reglas que la prosa de renta corta no puede violar, con el mismo patrón que
// LTR: el generador (ai-generation-str.ts) las evalúa, hace UN reintento quirúrgico por
// campo y acepta solo si mejora; los fixtures del golden y el reporte sobre el dump
// evalúan EXACTAMENTE estas funciones. Ninguna cambia lo que el modelo lee.
//
//   1. [HERO-CLAIM]     múltiplos verbales (doble / mitad / triple / N veces) contra la
//                       razón del motor que la oración nombra — núcleo compartido con LTR
//                       (hero-claim-core.ts), tablas de renta corta acá.
//   2. [STR-ENGINEISM]  verbo-trayectoria del modelo ("cruza a positivo", "converge") —
//                       antes solo detección; ahora reintenta.
//   3. [STR-INTERNAS]   palabras de la mecánica interna ("fallback", "override"…) que el
//                       propio prompt nombra como fuentes y el modelo copia.
//   4. [STR-ESTRUCTURAL] con distancia estructural, ninguna caja ofrece negociar,
//                       descuento ni "si logras": regla contable pegada al campo.
//   5. [STR-COPIA]      ninguna oración de NINGÚN campo copia una fraseCanonica (≥ 60%
//                       de la frase, mínimo 8 palabras) — la card ya la muestra.

import type { ShortTermResult } from "./engines/short-term-engine";
import type { AIAnalysisSTRv2, Hallazgo } from "./types";
import { datosComunaSTR } from "./engines/str-universo-santiago";
import type { SimulacionStr } from "./analysis/simular-str";
import type { HallazgoDistanciaVeredicto } from "./types";
import { CAP_STR_UMBRAL_PCT } from "./rentabilidad-str-hallazgo";
import { CLAIMS_HERO, CLAIMS_VECES, violacionesClaims, type ClaimHero } from "./hero-claim-core";
import { frasesCanonicasDe, oracionQueCopia } from "./copia-frase";

// ─── Campos de prosa (paths `sección.campo`; `titular` y `francoCaveat` top-level) ───
export const PROSA_PATHS_STR = [
  "titular",
  "conviene.respuestaDirecta", "conviene.veredictoFrase", "conviene.reencuadre", "conviene.cajaAccionable",
  "rentabilidad.contenido", "rentabilidad.cajaAccionable",
  "vsLTR.contenido", "vsLTR.estrategiaSugerida", "vsLTR.cajaAccionable",
  "operacion.contenido", "operacion.cajaAccionable",
  "largoPlazo.contenido", "largoPlazo.cajaAccionable",
  "riesgos.contenido", "riesgos.cajaAccionable",
  "francoCaveat",
] as const;
export type ProsaPathStr = (typeof PROSA_PATHS_STR)[number];

/** Las cajas (una por sección) y la estrategia: lo que el usuario lee como recomendación. */
export const CAJAS_PATHS_STR: ProsaPathStr[] = [
  "conviene.cajaAccionable", "rentabilidad.cajaAccionable", "vsLTR.cajaAccionable", "vsLTR.estrategiaSugerida",
  "operacion.cajaAccionable", "largoPlazo.cajaAccionable", "riesgos.cajaAccionable",
];

export function leerCampo(ai: unknown, path: string): string | null {
  const rec = ai as Record<string, unknown> | null;
  if (!rec) return null;
  const [sec, field] = path.split(".");
  const v = field ? (rec[sec] as Record<string, unknown> | undefined)?.[field] : rec[sec];
  return typeof v === "string" ? v : null;
}
export function escribirCampo(ai: unknown, path: string, valor: string): void {
  const rec = ai as Record<string, unknown>;
  const [sec, field] = path.split(".");
  if (!field) { rec[sec] = valor; return; }
  const s = rec[sec];
  if (s && typeof s === "object") (s as Record<string, unknown>)[field] = valor;
}
export function camposProsa(ai: unknown, paths: readonly string[] = PROSA_PATHS_STR): { path: string; texto: string }[] {
  const out: { path: string; texto: string }[] = [];
  for (const path of paths) { const t = leerCampo(ai, path); if (t && t.trim()) out.push({ path, texto: t }); }
  return out;
}

// ─── 1. [HERO-CLAIM] STR ─────────────────────────────────────────────────────
export interface RazonesHeroClaimStr {
  /** Flujo mensual del escenario base y del upside (gestión estabilizada), CLP con signo. */
  flujoBase?: number | null;
  flujoUpside?: number | null;
  dividendoM?: number | null;
  /** Ingreso bruto mensual del corto y arriendo largo mensual (bruto). */
  ingresoBrutoM?: number | null;
  ingresoUpsideM?: number | null;
  arriendoLargoM?: number | null;
  noiCorto?: number | null;
  noiLargo?: number | null;
  flujoLargo?: number | null;
  /** Tarifa efectiva y su referencia de mercado (p50 de la zona), CLP/noche. */
  adrFinal?: number | null;
  adrRef?: number | null;
  /** Ocupación efectiva, estimación (p50 de la dirección), mediana comunal V2 y objetivo del upside, en fracción. */
  occFinal?: number | null;
  occRef?: number | null;
  occBanda?: number | null;
  occTarget?: number | null;
  capPct?: number | null;
  /** Break-even como fracción del ingreso de mercado (1,53 = 153%). */
  breakEvenPct?: number | null;
  sujetoUfM2?: number | null;
  medianaUfM2?: number | null;
  medianaConfiable?: boolean;
  // ── T0 CONGELADO (04-sep-2026): vías y simulaciones del motor ──
  /** Palancas que cruzan (de `distancia_veredicto.vias`), para la regla "única vía". undefined = filas sin vias (no se evalúa). */
  viasCruzan?: string[];
  /** Fronteras del ingreso (una bisección para tarifa y ocupación), en % sobre el caso. */
  fronteraArribaPct?: number | null;
  fronteraAbajoPct?: number | null;
  /** Celdas que cruzan en la matriz tarifa × ocupación y en la de pie × plazo. */
  celdasCruzanTarifaOcupacion?: number | null;
  celdasCruzanPiePlazo?: number | null;
}

/** Razones del motor para un resultado STR ya computado (con sus hallazgos). */
export function razonesHeroClaimStr(
  r: ShortTermResult & { hallazgos?: Hallazgo[] },
  inp: Record<string, unknown>,
  comuna: string,
  sim?: SimulacionStr | null,
): RazonesHeroClaimStr {
  const dv = (r.hallazgos ?? []).find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
  const vias = dv?.valor.vias;
  const base = r.escenarios?.base;
  const up = r.escenarios?.agresivo;
  const ejes = r.ejesAplicados;
  const sobre = (r.hallazgos ?? []).find((h) => h.id === "sobreprecio") as
    | { valor?: { sujetoUfM2?: number; medianaComunaUfM2?: number | null } } | undefined;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const comunaOcc = datosComunaSTR(comuna)?.ocupacion.valor ?? null;
  return {
    flujoBase: num(base?.flujoCajaMensual),
    flujoUpside: num(up?.flujoCajaMensual),
    dividendoM: num(r.dividendoMensual),
    ingresoBrutoM: num(base?.ingresoBrutoMensual),
    ingresoUpsideM: num(up?.ingresoBrutoMensual),
    arriendoLargoM: num(r.comparativa?.ltr?.ingresoBruto) ?? num(inp.arriendoLargoMensual),
    noiCorto: num(base?.noiMensual),
    noiLargo: num(r.comparativa?.ltr?.noiMensual),
    flujoLargo: num(r.comparativa?.ltr?.flujoCaja),
    adrFinal: num(ejes?.adrFinal),
    adrRef: num(ejes?.adrBaselineP50),
    occFinal: num(ejes?.ocupacionFinal) ?? num(base?.ocupacionReferencia),
    occRef: num(ejes?.ocupacionBaselineP50),
    occBanda: comunaOcc,
    occTarget: num(ejes?.ocupacionTarget),
    capPct: base && Number.isFinite(base.capRate) ? base.capRate * 100 : null,
    breakEvenPct: num(r.breakEvenPctDelMercado),
    sujetoUfM2: num(sobre?.valor?.sujetoUfM2),
    medianaUfM2: num(sobre?.valor?.medianaComunaUfM2),
    medianaConfiable: !!sobre && num(sobre.valor?.medianaComunaUfM2) !== null,
    viasCruzan: vias ? vias.filter((v) => v.estado === "cruza").map((v) => v.palanca) : undefined,
    fronteraArribaPct: sim?.fronterasIngreso.arriba ? Math.round((sim.fronterasIngreso.arriba.factor - 1) * 1000) / 10 : null,
    fronteraAbajoPct: sim?.fronterasIngreso.abajo ? Math.round((sim.fronterasIngreso.abajo.factor - 1) * 1000) / 10 : null,
    celdasCruzanTarifaOcupacion: sim ? sim.matrizTarifaOcupacion.celdas.filter((c) => c.cruza).length : null,
    celdasCruzanPiePlazo: sim ? sim.matrizPiePlazo.celdas.filter((c) => c.cruza).length : null,
  };
}

type SujetoStr = "aporte" | "flujo" | "ingreso" | "noi" | "tarifa" | "ocupacion" | "cap" | "breakEven" | "precioM2" | "cuota" | "precio";
type ComparadorStr = "cuota" | "corto" | "upside" | "largo" | "banda" | "referencia" | "mediana" | "base" | "umbral" | "deposito" | "fondo";

const SUJETOS_STR: { re: RegExp; s: SujetoStr }[] = [
  { re: /\baport(?:e|es|as|ar|ando)\b|\bpon(?:es|er|iendo|drías|drás|gas)\b|de tu (?:propio )?bolsillo|te faltan|sale de tu/gi, s: "aporte" },
  { re: /\bflujo\b|\bte queda(?:n|r[íi]an?)?\b|\bmargen\b|\bsobra\b/gi, s: "flujo" },
  { re: /\bingresos?\b|\bgenera\b|\bfactura\b/gi, s: "ingreso" },
  { re: /\bnoi\b|\brenta neta\b|\bmargen operativo\b/gi, s: "noi" },
  { re: /\btarifa\b|\badr\b|\bpor noche\b|\bla noche\b/gi, s: "tarifa" },
  { re: /\bocupaci[oó]n\b|\bnoches\b|\bllenar\b/gi, s: "ocupacion" },
  { re: /\bcap rate\b|\bcap\b|\brinde\b|\brentabilidad\b|\brendimiento\b|\bretorno\b/gi, s: "cap" },
  { re: /break-?even|punto de equilibrio|\boperar\b/gi, s: "breakEven" },
  { re: /precio por m[²2]|\bm[²2]\b|\bpor (?:cada )?metro\b|\bel metro\b/gi, s: "precioM2" },
  { re: /\bcuota\b|\bdividendo\b/gi, s: "cuota" },
  { re: /\bprecio\b/gi, s: "precio" },
];
const COMPARADORES_STR: { re: RegExp; c: ComparadorStr }[] = [
  { re: /\bcuota\b|\bdividendo\b/gi, c: "cuota" },
  { re: /\b(?:el |del )?corto\b|\bstr\b|renta corta|\bairbnb\b/gi, c: "corto" },
  { re: /\bupside\b|\bpotencial\b|gesti[oó]n (?:profesional|estabilizada)|\bestabilizad[oa]\b|\bestabilizaci[oó]n\b/gi, c: "upside" },
  { re: /arriendo largo|renta larga|\bltr\b|largo plazo|\b(?:el |del |al )?largo\b|arriendo tradicional/gi, c: "largo" },
  { re: /\bbanda\b|zona t[ií]pica|comuna t[ií]pica|\bt[ií]pic[oa]\b|lo t[ií]pico de la comuna/gi, c: "banda" },
  { re: /\breferencia\b|\bmercado\b|\bp50\b|\bobservad[oa]\b|\bestimaci[oó]n\b|\bestimad[oa]\b/gi, c: "referencia" },
  { re: /\bmediana\b|\bcomuna\b|\bzona\b/gi, c: "mediana" },
  { re: /escenario base|\bbase\b|\bhoy\b|\bactual\b/gi, c: "base" },
  { re: /\bumbral\b/gi, c: "umbral" },
  { re: /dep[oó]sito/gi, c: "deposito" },
  { re: /\bfondo\b/gi, c: "fondo" },
];
const NOMBRE_RAZON_STR: Record<string, string> = {
  "aporte/cuota": "aporte/cuota", "flujo/cuota": "flujo/cuota",
  "ingreso/largo": "ingreso bruto corto/arriendo largo", "noi/largo": "NOI corto/NOI largo", "flujo/largo": "flujo corto/flujo largo",
  "flujo/corto": "flujo largo/flujo corto", "noi/corto": "NOI largo/NOI corto", "ingreso/corto": "arriendo largo/ingreso corto",
  "flujo/base": "flujo upside/flujo base", "flujo/upside": "flujo upside/flujo base", "ocupacion/upside": "ocupación objetivo/ocupación base", "ingreso/upside": "ingreso upside/ingreso base",
  "tarifa/referencia": "tarifa/p50 de la zona", "tarifa/mediana": "tarifa/p50 de la zona", "tarifa/base": "tarifa/p50 de la zona",
  "ocupacion/banda": "ocupación/típica de la comuna", "ocupacion/referencia": "ocupación/estimación de mercado", "ocupacion/mediana": "ocupación/estimación de mercado", "ocupacion/base": "ocupación objetivo/ocupación base",
  "cap/umbral": "CAP rate/umbral 5%", "cap/referencia": "CAP rate/umbral 5%", "cap/deposito": "CAP rate/depósito UF 5%", "cap/fondo": "CAP rate/fondo mutuo 7%",
  "precioM2/mediana": "precio por m²/mediana comunal", "precio/mediana": "precio por m²/mediana comunal", "precioM2/referencia": "precio por m²/mediana comunal",
  "breakEven/referencia": "break-even/ingreso de mercado", "breakEven/mediana": "break-even/ingreso de mercado", "breakEven/base": "break-even/ingreso de mercado", "breakEven/banda": "break-even/ingreso de mercado",
};
const RE_UPSIDE = /mejor escenario|\bupside\b|\bpotencial\b|gesti[oó]n (?:profesional|estabilizada)|\bestabilizad[oa]\b/i;

function razonStr(r: RazonesHeroClaimStr, s: SujetoStr, c: ComparadorStr, oracion: string): { nombre: string; valor: number | null } | null {
  const k = `${s}/${c}`;
  const nombre = NOMBRE_RAZON_STR[k];
  if (!nombre) return null;
  const div = (a?: number | null, b?: number | null) => (a != null && b != null && a > 0 && b > 0 ? a / b : null);
  const abs = (v?: number | null) => (v == null ? null : Math.abs(v));
  const flujoCortoRef = RE_UPSIDE.test(oracion) ? r.flujoUpside : r.flujoBase;
  switch (k) {
    case "aporte/cuota": return { nombre, valor: r.flujoBase != null && r.flujoBase < 0 ? div(abs(r.flujoBase), r.dividendoM) : null };
    case "flujo/cuota": return { nombre, valor: div(abs(r.flujoBase), r.dividendoM) };
    case "ingreso/largo": return { nombre, valor: div(r.ingresoBrutoM, r.arriendoLargoM) };
    case "noi/largo": return { nombre, valor: div(r.noiCorto, r.noiLargo) };
    case "flujo/largo": return { nombre, valor: div(abs(r.flujoBase), abs(r.flujoLargo)) };
    case "flujo/corto": return { nombre: RE_UPSIDE.test(oracion) ? "flujo largo/flujo corto (upside)" : nombre, valor: div(r.flujoLargo, flujoCortoRef) };
    case "noi/corto": return { nombre, valor: div(r.noiLargo, r.noiCorto) };
    case "ingreso/corto": return { nombre, valor: div(r.arriendoLargoM, r.ingresoBrutoM) };
    case "flujo/base": case "flujo/upside": return { nombre, valor: div(r.flujoUpside, r.flujoBase) };
    case "ocupacion/upside": return { nombre, valor: div(r.occTarget, r.occFinal) };
    case "ingreso/upside": return { nombre, valor: div(r.ingresoUpsideM, r.ingresoBrutoM) };
    case "tarifa/referencia": case "tarifa/mediana": case "tarifa/base": return { nombre, valor: div(r.adrFinal, r.adrRef) };
    case "ocupacion/banda": return { nombre, valor: div(r.occFinal, r.occBanda) };
    case "ocupacion/referencia": case "ocupacion/mediana": return { nombre, valor: div(r.occFinal, r.occRef) };
    case "ocupacion/base": return { nombre, valor: div(r.occTarget, r.occFinal) };
    case "cap/umbral": case "cap/referencia": return { nombre, valor: div(r.capPct, CAP_STR_UMBRAL_PCT) };
    case "cap/deposito": return { nombre, valor: div(r.capPct, 5) };
    case "cap/fondo": return { nombre, valor: div(r.capPct, 7) };
    case "precioM2/mediana": case "precio/mediana": case "precioM2/referencia":
      return { nombre, valor: r.medianaConfiable ? div(r.sujetoUfM2, r.medianaUfM2) : null };
    case "breakEven/referencia": case "breakEven/mediana": case "breakEven/base": case "breakEven/banda":
      return { nombre, valor: r.breakEvenPct != null && r.breakEvenPct > 0 ? r.breakEvenPct : null };
    default: return null;
  }
}

/** "al doble" no está en la tabla base de LTR (se agregará con su propio goal); STR la estrena
 *  junto con "N veces". */
const CLAIMS_STR: ClaimHero[] = [
  { re: /\bal doble\b/i, regla: "doble", min: 1.9 },
  ...CLAIMS_HERO,
  ...CLAIMS_VECES,
];

/** Violaciones [HERO-CLAIM] de un texto STR contra las razones del motor. Desde T0
 *  CONGELADO el hallazgo emite `vias`, así que la regla "única vía" se evalúa con las que
 *  cruzan (igual que LTR); en filas sin vias no se evalúa. */
export function violacionesHeroClaimStr(texto: string, r: RazonesHeroClaimStr): string[] {
  return violacionesClaims<SujetoStr, ComparadorStr>(texto, {
    claims: CLAIMS_STR,
    sujetos: SUJETOS_STR,
    comparadores: COMPARADORES_STR,
    viasCruzan: r.viasCruzan,
    razon: (s, c, o) => razonStr(r, s, c, o),
  });
}

export function razonesHeroClaimStrTexto(r: RazonesHeroClaimStr): string {
  const pares: [SujetoStr, ComparadorStr][] = [
    ["aporte", "cuota"], ["flujo", "cuota"], ["ingreso", "largo"], ["noi", "largo"], ["flujo", "corto"], ["flujo", "base"],
    ["tarifa", "referencia"], ["ocupacion", "banda"], ["ocupacion", "referencia"], ["ocupacion", "upside"],
    ["cap", "umbral"], ["precioM2", "mediana"], ["breakEven", "referencia"],
  ];
  const out: string[] = [];
  for (const [s, c] of pares) { const z = razonStr(r, s, c, ""); if (z && z.valor !== null) out.push(`${z.nombre} = ${z.valor.toFixed(2)}×`); }
  if (r.viasCruzan) out.push(`vías que cruzan: ${r.viasCruzan.length}${r.viasCruzan.length ? ` (${r.viasCruzan.join(", ")})` : ""}`);
  if (r.fronteraArribaPct != null || r.fronteraAbajoPct != null) out.push(`frontera del ingreso: ${r.fronteraAbajoPct != null ? `cae a ${r.fronteraAbajoPct}%` : "no cae"} · ${r.fronteraArribaPct != null ? `sube a +${r.fronteraArribaPct}%` : "no sube"}`);
  if (r.celdasCruzanTarifaOcupacion != null) out.push(`matriz tarifa × ocupación: ${r.celdasCruzanTarifaOcupacion} de 16 cruzan · pie × plazo: ${r.celdasCruzanPiePlazo ?? 0} de 16`);
  return out.length ? out.join(", ") : "ninguna razón disponible";
}

// ─── 2. [STR-ENGINEISM] ─────────────────────────────────────────────────────
/** Verbo-trayectoria del modelo: cómo se mueve un número dentro del cálculo en vez de la
 *  consecuencia vivida. La lista que usaba el monitor (solo detección) más lo que la tanda
 *  v13 destapó: "converge", "cruza a positivo / el umbral / al territorio", "lo cruza". */
export const STR_ENGINEISM_RE =
  /flujo[^.]{0,30}(?:cruza|revier|da vuelta|vuelve positivo)|flujo neutro|inflexi[óo]n|punto de quiebre|\bconverg(?:e|en|er|i[óo]|iendo|ería|erían)\b|\bcruza(?:r|n|ría)? (?:a|al|el) (?:positivo|umbral|territorio)|\blo cruza\b|\bcruza el umbral\b|\bcruce (?:a|al|del) (?:positivo|umbral)|\b(?:puede|pueden|podr[ií]a|podr[ií]an) cruzar\b/i;
export function hitsEngineIsm(texto: string): string[] {
  const out: string[] = [];
  const re = new RegExp(STR_ENGINEISM_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) out.push(m[0]);
  return out;
}

// ─── 3. [STR-INTERNAS] ──────────────────────────────────────────────────────
/** Nombres de la mecánica interna que el prompt usa como fuentes ("override", "fallback")
 *  o como ramas del código y que nunca pueden llegar al usuario. */
export const PALABRAS_INTERNAS_RE =
  /\b(?:fallback|override|overrides|stub|recompute|recomputo|snapshot|no_seguro|fallback_mercado|calculator_direct|hard[- ]?drift|engine[- ]?ism|proto-?hallazgo)\b/i;
export function hitsPalabrasInternas(texto: string): string[] {
  const out: string[] = [];
  const re = new RegExp(PALABRAS_INTERNAS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) out.push(m[0]);
  return out;
}

// ─── 4. [STR-ESTRUCTURAL] ───────────────────────────────────────────────────
export function esDistanciaEstructural(r: { hallazgos?: Hallazgo[] }): boolean {
  const d = (r.hallazgos ?? []).find((h) => h.id === "distancia_veredicto") as { valor?: { esEstructural?: boolean } } | undefined;
  return d?.valor?.esEstructural === true;
}
/** Las palabras exactas que el bloque del prompt prohíbe ("si logras", "si consigues"). Sin
 *  "puedes": "si no puedes dedicar horas a la operación" no ofrece negociar nada. */
const RE_SI_LOGRAS = /\bsi (?:no )?(?:logras|consigues|lograras|consiguieras|lograses|consiguieses)\b/i;
const RE_OFERTA = /\bnegoci(?:a|as|ar|ando|ación|aciones)\b|\bdescuento\b|\brebaja\b/i;
/** Formas de "negociar" que son la acción misma (imperativo o infinitivo): "negocia el precio",
 *  "negociar con dureza". Con distancia estructural son oferta aunque la oración diga después
 *  que ningún descuento cambia el veredicto (GE-4 v14: "negocia el precio con dureza: aunque
 *  ningún descuento cambia el veredicto…"). Solo las salva una negación pegada ("no negocies",
 *  "sin negociar", "ni negociar"). */
const RE_NEGOCIAR_ACCION = /\bnegoci(?:a|á|ar|en|emos)\b/i;
/** La negación pegada al verbo ("no negocies", "sin negociar", "ni negociar") no es oferta. */
const RE_NEGACION_PEGADA = /\b(?:no|sin|ni)\s+negoci/i;
const RE_NEGACION = /\b(?:ni|ning[uú]n[oa]?|nadie|tampoco)\b|\bno (?:alcanza|basta|cambia|mueve|sirve|salva|justifica|arregla|lo (?:mueve|cambia|salva|justifica|arregla|logra))\b/i;
/** Oraciones que ofrecen negociar / descuento / "si logras" como salida. Solo tiene
 *  sentido cuando la distancia es estructural: el bloque del prompt lo prohíbe con esas
 *  mismas palabras y nadie lo hacía cumplir (GE-4: "si no logras negociar el precio…"). */
export function ofertasNegociacion(texto: string): string[] {
  const out: string[] = [];
  for (const o of texto.replace(/\*\*/g, "").split(/(?<=[.!?])\s+/)) {
    if (RE_SI_LOGRAS.test(o)) { out.push(o.trim()); continue; }
    if (RE_NEGACION_PEGADA.test(o)) continue;
    if (RE_NEGOCIAR_ACCION.test(o)) { out.push(o.trim()); continue; }
    // "sin negociar" / "no negocies" / "ni negociar": la negación pegada al verbo no es oferta.
    if (RE_OFERTA.test(o) && !RE_NEGACION.test(o)) out.push(o.trim());
  }
  return out;
}

// ─── 5. [STR-COPIA] ─────────────────────────────────────────────────────────
export function frasesCanonicasStr(r: { hallazgos?: Hallazgo[] }): string[][] {
  return frasesCanonicasDe(r.hallazgos ?? []);
}
/** La oración del texto que copia una fraseCanonica (≥ 60% de la frase, mínimo 8 palabras), o null. */
export function copiaFraseCanonica(texto: string, frases: string[][]): string | null {
  return oracionQueCopia(texto, frases);
}

// ─── Evaluación por campo (lo que consumen el generador, los fixtures y el reporte) ───
export interface ContextoGuardsStr {
  razones: RazonesHeroClaimStr;
  estructural: boolean;
  frases: string[][];
}
export function contextoGuardsStr(r: ShortTermResult & { hallazgos?: Hallazgo[] }, inp: Record<string, unknown>, comuna: string, sim?: SimulacionStr | null): ContextoGuardsStr {
  return { razones: razonesHeroClaimStr(r, inp, comuna, sim), estructural: esDistanciaEstructural(r), frases: frasesCanonicasStr(r) };
}

export type ReglaStr = "hero-claim" | "engineism" | "internas" | "estructural" | "copia";
/** path → violaciones (vacío si el campo está limpio). */
export function violacionesPorCampo(ai: AIAnalysisSTRv2 | null | undefined, regla: ReglaStr, ctx: ContextoGuardsStr): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!ai) return out;
  const paths = regla === "estructural" ? CAJAS_PATHS_STR : PROSA_PATHS_STR;
  for (const { path, texto } of camposProsa(ai, paths)) {
    let v: string[] = [];
    switch (regla) {
      case "hero-claim": v = violacionesHeroClaimStr(texto, ctx.razones); break;
      case "engineism": v = hitsEngineIsm(texto); break;
      case "internas": v = hitsPalabrasInternas(texto); break;
      case "estructural": v = ctx.estructural ? ofertasNegociacion(texto) : []; break;
      case "copia": { const c = copiaFraseCanonica(texto, ctx.frases); v = c ? [c] : []; break; }
    }
    if (v.length) out[path] = v;
  }
  return out;
}
export const totalViolaciones = (m: Record<string, string[]>): number => Object.values(m).reduce((n, v) => n + v.length, 0);
