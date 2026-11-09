// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 2 · LA SALIDA POR INGRESO (corrida de confirmación del método, 07-nov-2026; solo lectura, nada se implementa).
// Para cada aviso de la base de referencia de la FASE 4 (las activas con evaluación + las reactivadas, limpias):
//   · valor de venta al año 10 = arriendo bruto anual del año 11 (la proyección del motor con g: `calcProjections` con el
//     arriendo reescalado a g, como en la FASE 4) ÷ cap bruto de salida;
//   · cap de salida = el cap bruto que calcula la pasada (`brutoDeMuestra`: mediana del arriendo UF/m²/mes × 12 sobre la
//     mediana del precio UF/m², avisos publicados sin factor), en la celda comuna × dormitorios con universo USADO para
//     nuevos y usados por igual, con la cascada de la pasada (celda 90 días → celda 180 → comuna 90 → comuna 180, n ≥ 15 por
//     lado); donde la celda cae al respaldo, el cap de la comuna (todas las tipologías), marcado `nivel = comuna`. Sin la
//     banda de ±20 % de m² del sujeto (que haría una celda por aviso): la mediana por m² ya normaliza el tamaño.
//   · dos caps: el de hoy y el de hoy + 50 puntos base; tres g (3 %, 1 % y 0 %, precio y arriendo): seis TIR por aviso, con
//     `calcExitScenario` del motor (comisión de venta y saldo del crédito como siempre; precio de venta reemplazado y, como
//     es valor de mercado, sin descontar el sobreprecio de hoy: igual que la salida como usado del radio del anexo 1).
//   · de paso: el flujo del motor y el ingreso mensual (para los tramos de −5 % del ingreso), el valor por ingreso de HOY
//     (arriendo bruto de hoy ÷ cap) para el escalón implícito y el premio de estreno por ingreso, y la TIR del motor.
//   · los tres casos del golden (7710a017, 17b4e10d, f3522eac) con las mismas seis TIR, por `runAnalysis` con su input.
// Salida: out/18-salida-ingreso.json y out/18-golden.json; las tablas las arma 19-salida-ingreso-tablas.ts.
//   TOPE=200 para probar; SOLO_GOLDEN=1 rehace solo los tres casos del golden (y conserva los ya guardados).
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conSuperficieDosDecimales, evaluarConMotor, fmt, leerConfig, paginar, universoActivo, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { calcExitScenario, calcProjections, evalGate1Brazos, runAnalysis } from "../../../src/lib/analysis";
import { CASCADA_CAPREF, MIN_AVISOS_CAPREF, brutoDeMuestra } from "../../../src/lib/capref-comuna";
import { crecimientoReal } from "../../../src/lib/plusvalia-proyeccion";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { medianaDesdeSnapshot } from "../../../src/lib/analysis/mediana-snapshot";
import { ufDelDia } from "./uf-historica";
import type { AnalisisInput, YearProjection } from "../../../src/lib/types";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";

const TOPE = Number(process.env.TOPE ?? Infinity);
const HORIZONTE = 10;
const GS = { g3: 0.03, g1: 0.01, g0: 0 } as const;
const MAS_PB = 0.5;
const ARRIENDO_REAL = crecimientoReal(0.035);
const DIR = "scripts/analisis/motor-nuevos/out";
const SALIDA = `${DIR}/18-salida-ingreso.json`;
const LOG = `${DIR}/18-salida-ingreso.log`;
const IDS_GOLDEN = ["7710a017-8066-47a6-8b3e-8fc64143e256", "17b4e10d-2afd-4554-b914-fe731ee2c9a0", "f3522eac-dd28-4a83-bee1-1cd2d35a2e43"];
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

export type Escenario = "g3h" | "g3m" | "g1h" | "g1m" | "g0h" | "g0m";
export const ESCENARIOS: Escenario[] = ["g3h", "g3m", "g1h", "g1m", "g0h", "g0m"];
export const ROTULO: Record<Escenario, string> = { g3h: "g 3 %, cap de hoy", g3m: "g 3 %, cap + 50 pb", g1h: "g 1 %, cap de hoy", g1m: "g 1 %, cap + 50 pb", g0h: "g 0 %, cap de hoy", g0m: "g 0 %, cap + 50 pb" };

export interface Cap { cap: number | null; nivel: "celda" | "comuna" | "sin"; ventana: number | null; nArr: number; nVenta: number }
export interface FilaIngreso {
  id: string; cond: "usado" | "nuevo"; comuna: string; origen: string; entrega: "inmediata" | "futura" | "sin dato"; precioUF: number; m2: number; dorms: number;
  v: string | null; s: number | null; flujo: number | null; ingreso: number | null; gate1: ReturnType<typeof evalGate1Brazos>;
  tirMotor: number | null;
  cap: Cap;
  /** Arriendo bruto de hoy (CLP/año) y el valor por ingreso de hoy (UF): arriendo de hoy ÷ cap de hoy. */
  arriendoHoyCLP: number; valorIngresoHoyUF: number | null;
  /** Arriendo bruto del año 11 (CLP) por g, el valor de salida (UF) y la TIR por escenario. */
  arriendo11CLP: Record<"g3" | "g1" | "g0", number>;
  valorUF: Partial<Record<Escenario, number>>;
  tir: Partial<Record<Escenario, number | null>>;
}

type FilaSP = { precio: unknown; moneda: unknown; superficie_m2: unknown; dormitorios: unknown; scraped_at: string };
const tirDe = (t: unknown): number | null => (t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : typeof t === "number" ? t : null);

/** Los avisos usados activos de una comuna y un lado, 180 días, paginados (PostgREST capa en 1.000). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function traerUsados(sb: any, comuna: string, lado: "venta" | "arriendo"): Promise<FilaSP[]> {
  const desde = new Date(Date.now() - 180 * 864e5).toISOString();
  return paginar<FilaSP>((d, h) =>
    sb.from("scraped_properties").select("precio, moneda, superficie_m2, dormitorios, scraped_at")
      .eq("comuna", comuna).eq("type", lado).eq("is_active", true).gte("scraped_at", desde).gt("precio", 0).gt("superficie_m2", 0)
      .or("condicion.is.null,condicion.eq.usado").order("id", { ascending: true }).range(d, h));
}

/** El cap bruto de la celda comuna × dormitorios (usado) con la cascada de la pasada. Puro sobre las filas ya traídas. */
export function capDe(arr: FilaSP[], venta: FilaSP[], dorms: number, uf: number, ahora = Date.now()): Cap {
  const ufm2 = (xs: FilaSP[], ventana: number, conDorms: boolean) => xs
    .filter((r) => ahora - Date.parse(r.scraped_at) <= ventana * 864e5 && (!conDorms || Number(r.dormitorios) === dorms))
    .map((r) => { const s = Number(r.superficie_m2), p = Number(r.precio); return (r.moneda === "UF" ? p : p / uf) / s; })
    .filter((x) => Number.isFinite(x) && x > 0);
  let nA = 0, nV = 0;
  for (const paso of CASCADA_CAPREF) {
    const a = ufm2(arr, paso.ventana, paso.nivel === "celda"), v = ufm2(venta, paso.ventana, paso.nivel === "celda");
    nA = Math.max(nA, a.length); nV = Math.max(nV, v.length);
    if (a.length >= MIN_AVISOS_CAPREF && v.length >= MIN_AVISOS_CAPREF) {
      const b = brutoDeMuestra({ arriendoUFm2Mes: a, ventaUFm2: v });
      if (b != null) return { cap: b, nivel: paso.nivel, ventana: paso.ventana, nArr: a.length, nVenta: v.length };
    }
  }
  return { cap: null, nivel: "sin", ventana: null, nArr: nA, nVenta: nV };
}

/** La proyección del motor con g para el precio y el arriendo reescalado (la misma de la FASE 4). */
export function proyeccionConG(input: AnalisisInput, r: ResultadoMotor, cfg: Config, asOf: Date, g: number): YearProjection[] {
  const proj = calcProjections({ input, metrics: r.resultado.metrics, ufClp: cfg.uf, asOf, plazoVenta: 20, plusvaliaAnual: g });
  const vac = Number(input.vacanciaMeses) || 0;
  const propArriendo = 1 - vac / 12 - 2 / 24;
  return proj.map((p) => {
    const factor = Math.pow((1 + g) / (1 + ARRIENDO_REAL), p.anio - 1);
    const arriendoAnual = p.arriendoAnual ?? Math.round(p.arriendoMensual * (p.mesesOperativos ?? 12));
    const arriendoG = Math.round(arriendoAnual * factor);
    return { ...p, arriendoAnual: arriendoG, arriendoMensual: Math.round(p.arriendoMensual * factor), flujoAnual: Math.round(p.flujoAnual + (arriendoG - arriendoAnual) * propArriendo) };
  });
}
/** calcExitScenario con el precio de venta al año 10 reemplazado por un valor de mercado (sin descontar el sobreprecio de hoy). */
export function exitValorMercado(input: AnalisisInput, r: ResultadoMotor, proj: YearProjection[], precioVentaCLP: number) {
  const p = proj.map((x, i) => (i === HORIZONTE - 1 ? { ...x, valorPropiedad: Math.round(precioVentaCLP) } : x));
  return calcExitScenario(input, { ...r.resultado.metrics, precioVsComuna: null }, p, HORIZONTE);
}

/** Las seis TIR (y los valores de salida) de un resultado del motor con un cap. */
export function salidasPorIngreso(r: ResultadoMotor, cfg: Config, asOf: Date, cap: number | null) {
  const input = r.body as unknown as AnalisisInput;
  const arriendo11CLP = {} as Record<"g3" | "g1" | "g0", number>;
  const valorUF: Partial<Record<Escenario, number>> = {};
  const tir: Partial<Record<Escenario, number | null>> = {};
  for (const [k, g] of Object.entries(GS) as Array<["g3" | "g1" | "g0", number]>) {
    const proj = proyeccionConG(input, r, cfg, asOf, g);
    const arr11 = proj[HORIZONTE].arriendoMensual * 12;
    arriendo11CLP[k] = Math.round(arr11);
    if (cap == null) continue;
    for (const [suf, c] of [["h", cap], ["m", cap + MAS_PB]] as Array<["h" | "m", number]>) {
      const valor = arr11 / (c / 100);
      const esc = `${k}${suf}` as Escenario;
      valorUF[esc] = Math.round(valor / cfg.uf);
      tir[esc] = tirDe(exitValorMercado(input, r, proj, valor).tir);
    }
  }
  return { arriendo11CLP, valorUF, tir };
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const asOf = new Date();
  const base = JSON.parse(readFileSync(`${DIR}/1-base-corregida.json`, "utf8")) as { filas: FilaBase[] };
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const celdas = JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>;
  const porId = new Map(base.filas.map((f) => [f.id, f]));
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · ${asOf.toISOString()}`);

  const activas = await universoActivo(sb);
  const reactivadas: FilaUniverso[] = completo.filas.map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const filas = [...activas, ...reactivadas].slice(0, TOPE);
  log(`filas: ${fmt(activas.length)} activas con evaluación + ${fmt(reactivadas.length)} reactivadas = ${fmt(filas.length)}`);

  // 1 · El cap bruto por celda: una lectura por comuna y lado (180 días), la cascada en memoria.
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort();
  const porComuna = new Map<string, { arr: FilaSP[]; venta: FilaSP[] }>();
  const t0 = Date.now();
  for (const c of comunas) {
    const [arr, venta] = [await traerUsados(sb, c, "arriendo"), await traerUsados(sb, c, "venta")];
    porComuna.set(c, { arr, venta });
    await new Promise((res) => setTimeout(res, 150));
  }
  log(`cap: ${comunas.length} comunas leídas (${fmt([...porComuna.values()].reduce((s, x) => s + x.arr.length, 0))} arriendos, ${fmt([...porComuna.values()].reduce((s, x) => s + x.venta.length, 0))} ventas usadas) en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  const caps = new Map<string, Cap>();
  const capDeCelda = (comuna: string, dorms: number): Cap => {
    const k = `${comuna}|${dorms}`;
    if (!caps.has(k)) { const x = porComuna.get(comuna) ?? { arr: [], venta: [] }; caps.set(k, capDe(x.arr, x.venta, dorms, cfg.uf)); }
    return caps.get(k)!;
  };

  // 2 · Las filas (SOLO_GOLDEN=1 se las salta y rehace solo los tres casos del golden, por si una lectura falló).
  const salida: FilaIngreso[] = [];
  let i = 0;
  for (const f of process.env.SOLO_GOLDEN ? [] : filas) {
    i++;
    const b = porId.get(f.aviso_id);
    const limpio = b ? !b.sospechoso && !b.degradado && b.arriendo > 0 : !f.arriendo_sospechoso && !f.radio_degradado && !!f.arriendo;
    if (!limpio || !f.arriendo) continue;
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
    if (!r) continue;
    const m = r.resultado.metrics;
    const dorms = Number(f.sp.dormitorios);
    const cap = capDeCelda(f.comuna, dorms);
    const e = f.condicion === "nuevo" ? parsearFechaEntrega(f.sp.fecha_entrega, asOf) : null;
    const entrega: FilaIngreso["entrega"] = !e ? "sin dato" : e.inmediata ? "inmediata" : e.anio != null ? "futura" : "sin dato";
    const { arriendo11CLP, valorUF, tir } = salidasPorIngreso(r, cfg, asOf, cap.cap);
    const arriendoHoyCLP = Math.round(m.ingresoMensual * 12);
    salida.push({
      id: f.aviso_id, cond: f.condicion, comuna: f.comuna, origen: b ? "evaluada" : "reactivada", entrega, precioUF: f.precio_uf, m2: Number(f.sp.superficie_m2), dorms,
      v: r.veredicto, s: r.score, flujo: r.flujo, ingreso: Number.isFinite(m.ingresoMensual) ? Math.round(m.ingresoMensual) : null, gate1: evalGate1Brazos(m, r.resultado.breakEvenTasa),
      tirMotor: tirDe(r.resultado.exitScenario?.tir),
      cap, arriendoHoyCLP, valorIngresoHoyUF: cap.cap != null ? Math.round(arriendoHoyCLP / (cap.cap / 100) / cfg.uf) : null,
      arriendo11CLP, valorUF, tir,
    });
    if (i % 1000 === 0) { log(`${fmt(i)} / ${fmt(filas.length)} · ${((Date.now() - t0) / 60000).toFixed(1)} min`); writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), caps: Object.fromEntries(caps), filas: salida })); }
  }
  if (!process.env.SOLO_GOLDEN) writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), caps: Object.fromEntries(caps), filas: salida }));
  if (!process.env.SOLO_GOLDEN) log(`listo: ${fmt(salida.length)} filas (nuevos ${fmt(salida.filter((f) => f.cond === "nuevo").length)}; sin cap ${fmt(salida.filter((f) => f.cap.cap == null).length)}; cap de comuna (respaldo) ${fmt(salida.filter((f) => f.cap.nivel === "comuna").length)}) en ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // 3 · Los tres casos del golden, con su input y la UF del día en que se crearon (como 13-golden), y el cap de su celda de hoy.
  const golden: Record<string, unknown> = existsSync(`${DIR}/18-golden.json`) ? (JSON.parse(readFileSync(`${DIR}/18-golden.json`, "utf8")) as Record<string, unknown>) : {};
  for (const id of IDS_GOLDEN) {
    const { data, error } = await sb.from("analisis").select("id, comuna, created_at, input_data, results, mediana_comuna_snapshot, capref_comuna_snapshot").eq("id", id).single();
    if (error || !data) { log(`${id.slice(0, 8)}: no se encontró (${error?.message})`); continue; }
    const input = data.input_data as AnalisisInput & { esNuevo?: boolean; dormitorios: number; antiguedad?: number };
    const creado = new Date(data.created_at as string);
    const uf = Math.round(await ufDelDia(creado.toISOString().slice(0, 10)));
    const mediana = data.mediana_comuna_snapshot ? medianaDesdeSnapshot(data.mediana_comuna_snapshot as never, { capRefComuna: (data.capref_comuna_snapshot as never) ?? null }) : undefined;
    const res = runAnalysis(input, uf, mediana as never, creado);
    const r: ResultadoMotor = { veredicto: readVeredicto(res as never) ?? null, score: Math.round(res.score), flujo: Math.round(res.metrics.flujoNetoMensual), resultado: res, body: input as unknown as Record<string, unknown> };
    const comuna = data.comuna as string;
    if (!porComuna.has(comuna)) porComuna.set(comuna, { arr: await traerUsados(sb, comuna, "arriendo"), venta: await traerUsados(sb, comuna, "venta") });
    const cap = capDeCelda(comuna, Number(input.dormitorios));
    const cfgCaso = { uf, tasa: Number(input.tasaMercado) || Number(input.tasaInteres) };
    const s = salidasPorIngreso(r, cfgCaso, creado, cap.cap);
    golden[id.slice(0, 8)] = {
      comuna, creado: data.created_at, uf, esNuevo: !!input.esNuevo, antiguedad: input.antiguedad ?? null, precioUF: input.precio, m2: input.superficie, dorms: input.dormitorios,
      v: r.veredicto, s: r.score, flujo: r.flujo, ingreso: Math.round(res.metrics.ingresoMensual), tirMotor: tirDe(res.exitScenario?.tir),
      cap, arriendoHoyCLP: Math.round(res.metrics.ingresoMensual * 12), valorIngresoHoyUF: cap.cap != null ? Math.round((res.metrics.ingresoMensual * 12) / (cap.cap / 100) / uf) : null,
      salidaMotorUF: Math.round(res.exitScenario.precioVentaEsperado / uf), ...s,
    };
    log(`${id.slice(0, 8)} · ${comuna} · ${r.veredicto} ${r.score} · flujo ${fmt(r.flujo)} · cap ${cap.cap ?? "—"} (${cap.nivel}) · TIR motor ${fmt(tirDe(res.exitScenario?.tir), 2)} · ingreso: ${ESCENARIOS.map((e) => `${e} ${fmt(s.tir[e] ?? null, 1)}`).join(" · ")}`);
  }
  writeFileSync(`${DIR}/18-golden.json`, JSON.stringify(golden, null, 1));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("18-salida-ingreso.ts")) main().catch((e) => { console.error(e); process.exit(1); });
