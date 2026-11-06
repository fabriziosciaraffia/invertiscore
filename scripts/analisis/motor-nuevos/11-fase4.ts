// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 · LA TIR DEL INFORME SOBRE EL UNIVERSO, CAMBIÁNDOLE LOS SUPUESTOS (STOP 4a con OK de Fabrizio). Para cada aviso de
// la base de referencia (5.599 nuevos limpios del universo completo + 21.191 usados, pie 20 %, 30 años, UF y tasa de hoy):
//   · el motor tal cual (`runAnalysis` → `exitScenario` a 10 años): flujo de operación, TIR, lo que queda al vender,
//     todo lo puesto, ganancia, múltiplo, cuotas del pie y máximo acumulado antes de la entrega;
//   · las versiones g = 1 % y g = 0 % (precio y arriendo): `calcProjections({plusvaliaAnual: g})` del motor, con el arriendo
//     reescalado por ((1+g)/(1+0,49 %))^(año−1) y el flujo corregido por la diferencia × (1 − vac/12 − 2/24), y
//     `calcExitScenario` del motor sobre esa proyección;
//   · la sensibilidad «todo el pie a la entrega» (entrega futura): el mismo vector anual que arma calcExitScenario (se
//     reconstruye y se verifica contra la TIR del motor), con la cuota única del pie movida del momento cero al año de la
//     entrega, y `calcIRRPct` del motor;
//   · las palancas sobre los nuevos: Negociar 5 % y 10 % (precio × 0,95 / 0,90), subsidio Ley 21.836 (tasa − 0,6 si es nuevo,
//     ≤ UF 6.000 y entrega inmediata o antes de mayo de 2028) y subsidio + Negociar 10 %.
//   · (agregados del OK al STOP 4a) la versión «salida a valor usado»: precio de salida al año 10 = mediana del usado de hoy
//     de su comuna y dormitorios (la celda de usados del motor, getComunaMedianaVentaUF con universo usado) × m² × (1+g)^10,
//     con g = 0 % y 1 %, sin descontar sobreprecio (es valor de mercado), para TODOS los avisos con la misma regla; y la
//     sensibilidad de edad: la salida de la versión g = 0 % con el precio de venta al año 10 × 0,85 (Santiago, 6-10 → 11-20).
// Lo guarda por aviso en out/11-fase4.json; las tablas y la grilla las arma 12-fase4-tablas.ts. Solo lectura.
//   TOPE=200 para probar.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { leerConfig, universoActivo, evaluarConMotor, conSuperficieDosDecimales, fmt, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { calcExitScenario, calcProjections, evalGate1Brazos } from "../../../src/lib/analysis";
import { getComunaMedianaVentaUF } from "../../../src/lib/comuna-stats";
import { calcIRRPct } from "../../../src/lib/finance/irr";
import { crecimientoReal } from "../../../src/lib/plusvalia-proyeccion";
import { cuotasDelAnio, cuotasPieValidas } from "../../../src/lib/obra-nueva";
import { REBAJA_SUBSIDIO, TECHO_UF_SUBSIDIO } from "../../../src/lib/constants/subsidio";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import type { AnalisisInput, YearProjection } from "../../../src/lib/types";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";

const TOPE = Number(process.env.TOPE ?? Infinity);
const HORIZONTE = 10;
const G_VERSIONES = { g1: 0.01, g0: 0 } as const;
const ARRIENDO_REAL = crecimientoReal(0.035);
const SALIDA = "scripts/analisis/motor-nuevos/out/11-fase4.json";
const LOG = "scripts/analisis/motor-nuevos/out/11-fase4.log";
const LIMITE_SUBSIDIO = new Date("2028-05-31T23:59:59Z");
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

/** Lo que una corrida del motor deja para la grilla: por versión de g, la TIR y lo del exit; una vez, el flujo y los gates. */
export interface Salida { tir: number | null; equityUF: number; puestoUF: number; gananciaUF: number; multiplo: number | null }
export interface Corrida {
  v: string | null; s: number | null; flujo: number | null; gate1: ReturnType<typeof evalGate1Brazos>;
  motor: Salida; g1: Salida; g0: Salida;
  /** Salida a valor usado (g 0 % y 1 %), o null sin celda de usados; y la sensibilidad de edad sobre g 0 %. */
  usado0: Salida | null; usado1: Salida | null; edad: Salida;
  /** Precio de salida al año 10 en UF: el del motor (valor − sobreprecio de hoy), el de valor usado con g 0 %, y la mediana usada. */
  salidaMotorUF: number; salidaUsadoUF: number | null; medianaUsadoUFm2: number | null;
  /** Solo entrega futura: cuotas, monto mensual (CLP), máximo acumulado antes de la entrega (UF) y la TIR con todo el pie en la entrega. */
  cuotas?: { n: number; montoCLP: number; mesesAntes: number; maxAcumuladoUF: number; tirControl: number | null; tirPieEntrega: { motor: number | null; g1: number | null; g0: number | null } };
}
export interface FilaFase4 {
  id: string; cond: "usado" | "nuevo"; comuna: string; origen: string; entrega: "inmediata" | "futura" | "sin dato"; mesesEntrega: number; precioUF: number; m2: number; dorms: number;
  elegibleSubsidio: boolean;
  base: Corrida;
  negociar5?: Corrida; negociar10?: Corrida; subsidio?: Corrida; subsidioNegociar10?: Corrida;
  /** Plusvalía durante la construcción, en UF (precio congelado hoy × ((1+g)^(meses/12) − 1)). */
  plusvaliaConstruccionUF?: { g1: number; g3: number };
}

const tirDe = (t: unknown): number | null => (t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : typeof t === "number" ? t : null);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : x && typeof x === "object" && (x as { tipo?: string }).tipo === "valor" ? Number((x as { valor: number }).valor) : null);

function salidaDe(exit: ReturnType<typeof calcExitScenario>, uf: number): Salida {
  return { tir: tirDe(exit.tir), equityUF: Math.round(exit.equityCLP / uf), puestoUF: Math.round(exit.totalAportado / uf), gananciaUF: Math.round(exit.gananciaSobreTotal / uf), multiplo: num(exit.multiplicadorCapital) };
}

/** La proyección del motor con g para el precio y el arriendo reescalado (ver cabecera). */
function proyeccionConG(input: AnalisisInput, r: ResultadoMotor, cfg: Config, asOf: Date, g: number): YearProjection[] {
  const proj = calcProjections({ input, metrics: r.resultado.metrics, ufClp: cfg.uf, asOf, plazoVenta: 20, plusvaliaAnual: g });
  const vac = Number(input.vacanciaMeses) || 0;
  const propArriendo = 1 - vac / 12 - 2 / 24;
  return proj.map((p) => {
    const factor = Math.pow((1 + g) / (1 + ARRIENDO_REAL), p.anio - 1);
    const arriendoAnual = p.arriendoAnual ?? Math.round(p.arriendoMensual * p.mesesOperativos!);
    const arriendoG = Math.round(arriendoAnual * factor);
    return { ...p, arriendoAnual: arriendoG, arriendoMensual: Math.round(p.arriendoMensual * factor), flujoAnual: Math.round(p.flujoAnual + (arriendoG - arriendoAnual) * propArriendo) };
  });
}

/** El vector anual de calcExitScenario, reconstruido con lo que el motor expone, para mover la cuota del pie a la entrega. */
function vectorExit(input: AnalisisInput, r: ResultadoMotor, proj: YearProjection[], exit: ReturnType<typeof calcExitScenario>): number[] {
  const m = r.resultado.metrics;
  const nCuotas = cuotasPieValidas(input.cuotasPie);
  const montoCuota = nCuotas > 1 ? m.pieCLP / nCuotas : 0;
  const flujos = [-(exit.inversionInicial - (nCuotas > 1 ? m.pieCLP - montoCuota : 0))];
  for (let i = 0; i < HORIZONTE; i++) flujos.push(proj[i].flujoAnual - cuotasDelAnio(i, nCuotas, montoCuota) + (i === HORIZONTE - 1 ? exit.equityCLP : 0));
  return flujos;
}

/** calcExitScenario con otro precio de venta al año 10 (y, si es valor de mercado, sin descontar el sobreprecio de hoy). */
function exitConSalida(input: AnalisisInput, r: ResultadoMotor, proj: YearProjection[], precioVentaCLP: number, esValorDeMercado: boolean) {
  const p = proj.map((x, i) => (i === HORIZONTE - 1 ? { ...x, valorPropiedad: Math.round(precioVentaCLP) } : x));
  const m = esValorDeMercado ? { ...r.resultado.metrics, precioVsComuna: null } : r.resultado.metrics;
  return calcExitScenario(input, m, p, HORIZONTE);
}

export function corridaDe(r: ResultadoMotor, cfg: Config, asOf: Date, medianaUsadoUFm2: number | null, m2: number): Corrida {
  const input = r.body as unknown as AnalisisInput;
  const res = r.resultado;
  const motorProj = res.projections;
  const exits = {
    motor: res.exitScenario,
    g1: calcExitScenario(input, res.metrics, proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g1), HORIZONTE),
    g0: calcExitScenario(input, res.metrics, proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g0), HORIZONTE),
  };
  const projG0 = proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g0), projG1 = proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g1);
  const salidaUsado = (g: number) => (medianaUsadoUFm2 ? medianaUsadoUFm2 * m2 * cfg.uf * Math.pow(1 + g, HORIZONTE) : null);
  const su0 = salidaUsado(0), su1 = salidaUsado(0.01);
  const out: Corrida = {
    v: r.veredicto, s: r.score, flujo: r.flujo, gate1: evalGate1Brazos(res.metrics, res.breakEvenTasa),
    motor: salidaDe(exits.motor, cfg.uf), g1: salidaDe(exits.g1, cfg.uf), g0: salidaDe(exits.g0, cfg.uf),
    usado0: su0 ? salidaDe(exitConSalida(input, r, projG0, su0, true), cfg.uf) : null,
    usado1: su1 ? salidaDe(exitConSalida(input, r, projG1, su1, true), cfg.uf) : null,
    edad: salidaDe(exitConSalida(input, r, projG0, projG0[HORIZONTE - 1].valorPropiedad * 0.85, false), cfg.uf),
    salidaMotorUF: Math.round(exits.motor.precioVentaEsperado / cfg.uf), salidaUsadoUF: su0 ? Math.round(su0 / cfg.uf) : null, medianaUsadoUFm2,
  };
  const pc = res.metrics.pieEnCuotas;
  if (pc && pc.cuotas > 1) {
    const mesesAntes = pc.mesesAntesEntrega ?? 0;
    const anioEntrega = Math.min(HORIZONTE, Math.ceil(mesesAntes / 12));
    const mover = (proj: YearProjection[], exit: ReturnType<typeof calcExitScenario>): number | null => {
      const v = vectorExit(input, r, proj, exit);
      // Todo el pie en el año de la entrega: se saca la cuota del momento cero y las de cada año, y el pie entero cae en anioEntrega.
      const nCuotas = cuotasPieValidas(input.cuotasPie), montoCuota = res.metrics.pieCLP / nCuotas;
      v[0] += montoCuota;
      for (let i = 0; i < HORIZONTE; i++) v[i + 1] += cuotasDelAnio(i, nCuotas, montoCuota);
      v[anioEntrega] -= res.metrics.pieCLP;
      const t = calcIRRPct(v);
      return t.ok ? t.rate : null;
    };
    const control = calcIRRPct(vectorExit(input, r, motorProj, exits.motor));
    out.cuotas = {
      n: pc.cuotas, montoCLP: pc.montoCuotaCLP, mesesAntes,
      maxAcumuladoUF: Math.round((exits.motor.inversionInicial - res.metrics.pieCLP + pc.montoCuotaCLP * Math.min(pc.cuotas, mesesAntes + 1)) / cfg.uf),
      tirControl: control.ok ? control.rate : null,
      tirPieEntrega: { motor: mover(motorProj, exits.motor), g1: mover(proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g1), exits.g1), g0: mover(proyeccionConG(input, r, cfg, asOf, G_VERSIONES.g0), exits.g0) },
    };
  }
  return out;
}

function corrida(f: FilaUniverso, cfg: Config, asOf: Date, medianaUsadoUFm2: number | null, opts: Parameters<typeof evaluarConMotor>[3] = {}): Corrida | null {
  const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
  return r ? corridaDe(r, cfg, asOf, medianaUsadoUFm2, Number(f.sp.superficie_m2)) : null;
}

async function main() {
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const asOf = new Date();
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { filas: FilaBase[] };
  const completo = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/6-universo-completo.json", "utf8")) as { filas: FilaCompleta[] };
  const celdas = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-medianas-celda.json", "utf8")) as Record<string, unknown>;
  const porId = new Map(base.filas.map((f) => [f.id, f]));
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} %`);

  // Las filas: las activas con evaluación (universoActivo) y las reactivadas (de 6-universo-completo).
  const activas = await universoActivo(sb);
  const reactivadas: FilaUniverso[] = completo.filas.map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const filas = [...activas, ...reactivadas].slice(0, TOPE);
  log(`filas: ${fmt(activas.length)} activas con evaluación + ${fmt(reactivadas.length)} reactivadas`);

  const salida: FilaFase4[] = [];
  const cacheUsado = new Map<string, number | null>();
  let consultasUsado = 0;
  const t0 = Date.now();
  let i = 0;
  for (const f of filas) {
    i++;
    const b = porId.get(f.aviso_id);
    const limpio = b ? !b.sospechoso && !b.degradado && b.arriendo > 0 : !f.arriendo_sospechoso && !f.radio_degradado && !!f.arriendo;
    if (!limpio || !f.arriendo) continue;
    // Las filas con el error del m² usan la mediana resuelta en vivo (1-base-corregida) y el estimador de gastos comunes.
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    // La celda de usados (comuna × dormitorios × m² ±20 %): para un usado es su propia mediana; para un nuevo se resuelve en vivo
    // con la misma función del motor, con caché por celda y pausa.
    let medianaUsado: number | null = null;
    if (f.condicion === "usado") {
      const m = (b?.sup0 ? celdas[clave] : f.mediana_comuna) as { mediana?: number | null } | null;
      medianaUsado = m?.mediana ?? null;
    } else {
      const claveU = `${f.comuna}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
      if (!cacheUsado.has(claveU)) {
        const m = await getComunaMedianaVentaUF(sb as never, f.comuna, Number(f.sp.superficie_m2), Number(f.sp.dormitorios), cfg.uf, "usado").catch(() => null);
        cacheUsado.set(claveU, m?.mediana ?? null);
        consultasUsado++;
        await new Promise((res) => setTimeout(res, 80));
      }
      medianaUsado = cacheUsado.get(claveU) ?? null;
    }
    const baseC = corrida(f, cfg, asOf, medianaUsado, opts);
    if (!baseC) continue;
    const e = f.condicion === "nuevo" ? parsearFechaEntrega(f.sp.fecha_entrega, asOf) : null;
    const entrega: FilaFase4["entrega"] = !e ? "sin dato" : e.inmediata ? "inmediata" : e.anio != null ? "futura" : "sin dato";
    const mesesEntrega = entrega === "futura" && e ? Math.max(1, (e.anio! - asOf.getFullYear()) * 12 + (e.mes! - (asOf.getMonth() + 1))) : 0;
    const fechaEntrega = entrega === "futura" && e ? new Date(Date.UTC(e.anio!, e.mes! - 1, 28)) : null;
    const elegibleSubsidio = f.condicion === "nuevo" && f.precio_uf <= TECHO_UF_SUBSIDIO && (!fechaEntrega || fechaEntrega.getTime() <= LIMITE_SUBSIDIO.getTime());
    const fila: FilaFase4 = { id: f.aviso_id, cond: f.condicion, comuna: f.comuna, origen: b ? "evaluada" : "reactivada", entrega, mesesEntrega, precioUF: f.precio_uf, m2: Number(f.sp.superficie_m2), dorms: Number(f.sp.dormitorios), elegibleSubsidio, base: baseC };
    if (f.condicion === "nuevo") {
      const con = (precioFactor: number, tasaCredito?: number) => corrida({ ...f, precio_uf: Math.round(f.precio_uf * precioFactor * 100) / 100 }, cfg, asOf, medianaUsado, { ...opts, ...(tasaCredito != null ? { tasaCredito } : {}) }) ?? undefined;
      fila.negociar5 = con(0.95);
      fila.negociar10 = con(0.9);
      if (elegibleSubsidio) { fila.subsidio = con(1, cfg.tasa - REBAJA_SUBSIDIO); fila.subsidioNegociar10 = con(0.9, cfg.tasa - REBAJA_SUBSIDIO); }
      if (entrega === "futura") fila.plusvaliaConstruccionUF = { g1: Math.round(f.precio_uf * (Math.pow(1.01, mesesEntrega / 12) - 1)), g3: Math.round(f.precio_uf * (Math.pow(1.03, mesesEntrega / 12) - 1)) };
    }
    salida.push(fila);
    if (i % 1000 === 0) { log(`${fmt(i)} / ${fmt(filas.length)} · celdas de usado consultadas ${consultasUsado} · ${((Date.now() - t0) / 60000).toFixed(1)} min`); writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas: salida })); }
  }
  writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas: salida }));
  const control = salida.filter((f) => f.base.cuotas).map((f) => Math.abs((f.base.cuotas!.tirControl ?? NaN) - (f.base.motor.tir ?? NaN)) < 0.011);
  log(`listo: ${fmt(salida.length)} filas (nuevos ${fmt(salida.filter((f) => f.cond === "nuevo").length)}; sin celda de usados ${fmt(salida.filter((f) => f.base.medianaUsadoUFm2 == null).length)}) en ${((Date.now() - t0) / 60000).toFixed(1)} min · control del vector del exit (entrega futura): ${control.filter(Boolean).length} de ${control.length} reproducen la TIR del motor`);
}

// Solo cuando es el script que se corre: 13-golden.ts importa corridaDe sin lanzar la pasada.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("11-fase4.ts")) main().catch((e) => { console.error(e); process.exit(1); });
