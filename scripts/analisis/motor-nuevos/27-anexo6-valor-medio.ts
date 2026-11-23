// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 6 · EL VALOR DEL MEDIO (24-nov-2026). Solo lectura: nada se escribe en la base.
// Universo: los avisos de hoy (activos con evaluación en `avisos_evaluados`, usados y nuevos) más las unidades nuevas
// reactivadas de la medición que siguen publicadas (como en el anexo 5), limpios. Motor real por la cadena de la noche, UF y
// tasa de hoy, pie 20 %, 30 años, la superficie de dos decimales corregida en memoria (con la mediana en vivo donde el error la
// dejaba en 0) y el subsidio por defecto en los nuevos elegibles (tasa − 0,6 si el precio es ≤ UF 6.000 y entrega inmediata, sin
// fecha o hasta el 31-may-2028).
// Regla de venta: valor base de hoy = la mediana entre el precio pagado, el valor por ingreso (arriendo bruto anual ÷ cap de
// mercado usado de su celda, anexo 2) y el valor por comparables usados del radio (anexo 1); venta al año 10 = valor base ×
// (1+g)^10, con g = 1 %, 3 % y 4,5 % para precio y arriendo. Si falta una de las dos valoraciones, valor base = el menor entre el
// precio y la disponible (marcado); si faltan las dos, sin valor base.
// Valor del radio: usados, la sugerencia de venta guardada en su fila de hoy (universo usado, fuente radio); nuevos, el del anexo
// 1 si el aviso ya estaba (out/14-anexo-salida.json, fuente radio) y, si no, `getSugerencias(…, "venta", "usado")` en vivo, de a
// una con pausa y caché. Sin comparables del radio, falta.
// Salida: out/27-valor-medio.json.   TOPE=200 para probar.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conHoyCongelado, conSuperficieDosDecimales, cuerpoDeFila, evaluarConMotor, fmt, leerConfig, universoActivo, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { evalGate1Brazos, runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { medianaDesdeSnapshot } from "../../../src/lib/analysis/mediana-snapshot";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { getSugerencias } from "../../../src/lib/services/market-suggestions";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { idProyectoDeUrl } from "../../../src/lib/services/scraper/toctoc-unidades";
import { REBAJA_SUBSIDIO, TECHO_UF_SUBSIDIO } from "../../../src/lib/constants/subsidio";
import { exitValorMercado, proyeccionConG, type Cap, type FilaIngreso } from "./18-salida-ingreso";
import type { FilaAnexo } from "./14-anexo-salida";
import type { FilaCompleta } from "./6-universo-completo";
import type { AnalisisInput } from "../../../src/lib/types";

const TOPE = Number(process.env.TOPE ?? Infinity);
const DIR = "scripts/analisis/motor-nuevos/out";
const LOG = `${DIR}/27-valor-medio.log`;
const HORIZONTE = 10;
const LIMITE_SUBSIDIO = new Date("2028-05-31T23:59:59Z");
const PAUSA_MS = 120;
export const GS = { g1: 0.01, g3: 0.03, g45: 0.045 } as const;
export type G = keyof typeof GS;
const GOLDEN_ID = "17b4e10d-2afd-4554-b914-fe731ee2c9a0";
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };
const valorMetrica = (t: unknown): number | null => (typeof t === "number" ? t : t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : null);

export type Medio = "precio" | "ingreso" | "radio" | "menor: precio" | "menor: ingreso" | "menor: radio" | "sin valor";
export interface FilaMedio {
  id: string; cond: "usado" | "nuevo"; comuna: string; proyecto: string; entrega: "inmediata" | "futura" | "sin dato";
  precioUF: number; m2: number; dorms: number; origen: string;
  v: string | null; s: number | null; flujo: number | null; ingreso: number | null; gate1: ReturnType<typeof evalGate1Brazos>;
  elegible: boolean; sup0: boolean; capCelda: number | null;
  ingresoUF: number | null; radioUF: number | null; radioFuente: "fila de hoy" | "anexo 1" | "en vivo" | null;
  baseUF: number | null; medio: Medio;
  tir: Partial<Record<G, number | null>>; tirMotor: number | null;
}

/** El valor base: la mediana de los tres; con una sola valoración, el menor entre ella y el precio. */
export function valorBase(precio: number, ingreso: number | null, radio: number | null): { base: number | null; medio: Medio } {
  if (ingreso != null && radio != null) {
    const xs: Array<[number, Medio]> = [[precio, "precio"], [ingreso, "ingreso"], [radio, "radio"]];
    xs.sort((a, b) => a[0] - b[0]);
    return { base: xs[1][0], medio: xs[1][1] };
  }
  const otra = ingreso ?? radio;
  if (otra == null) return { base: null, medio: "sin valor" };
  return otra < precio ? { base: otra, medio: ingreso != null ? "menor: ingreso" : "menor: radio" } : { base: precio, medio: "menor: precio" };
}

/** Las TIR a 10 años con la venta = valor base × (1+g)^10 y la proyección del motor con g para precio y arriendo. */
export function tirsValorMedio(r: ResultadoMotor, cfg: Config, asOf: Date, baseUF: number | null): Partial<Record<G, number | null>> {
  const input = r.body as unknown as AnalisisInput;
  const out: Partial<Record<G, number | null>> = {};
  for (const g of Object.keys(GS) as G[]) {
    if (baseUF == null) { out[g] = null; continue; }
    const proj = proyeccionConG(input, r, cfg, asOf, GS[g]);
    out[g] = valorMetrica(exitValorMercado(input, r, proj, baseUF * Math.pow(1 + GS[g], HORIZONTE) * cfg.uf).tir);
  }
  return out;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOG, "");
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const ahora = new Date();
  const caps = (JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { caps: Record<string, Cap> }).caps;
  const radio14 = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.filter((f) => f.fuente === "radio" && f.usadoUFm2).map((f) => [f.id, f.usadoUFm2!]));
  const cacheMediana = new Map<string, unknown>(Object.entries(JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>));
  const cacheRadio = new Map<string, number | null>();
  let consultasMediana = 0, consultasRadio = 0;
  log(`config de hoy: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % (con subsidio ${fmt(cfg.tasa - REBAJA_SUBSIDIO, 2)} %) · «hoy» ${ahora.toISOString()}`);

  /** Una fila del universo → su fila del valor del medio (null si no se puede evaluar). */
  async function procesar(f: FilaUniverso, origen: string): Promise<FilaMedio | null> {
    if (!f.arriendo) return null;
    const cuerpo = conHoyCongelado(ahora, () => cuerpoDeFila(f, cfg, 20, { asOf: ahora }));
    let opts: Parameters<typeof evaluarConMotor>[3] = { asOf: ahora };
    const sup0 = !!cuerpo && Number(cuerpo.superficie) === 0;
    if (sup0) {
      const sinGgcc = { asOf: ahora, ctxPatch: { ggccSugerido: null } };
      const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
      if (!cacheMediana.has(clave)) {
        const bodyB = conHoyCongelado(ahora, () => conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, sinGgcc)))!.body;
        consultasMediana++;
        cacheMediana.set(clave, await prefetchMedianaComunaVenta(sb as never, bodyB as never, cfg.uf).catch(() => null));
        await new Promise((res) => setTimeout(res, PAUSA_MS));
      }
      opts = { ...sinGgcc, medianaComuna: cacheMediana.get(clave) };
    }
    const e = f.condicion === "nuevo" ? parsearFechaEntrega(f.sp.fecha_entrega, ahora) : null;
    const entrega: FilaMedio["entrega"] = !e ? "sin dato" : e.inmediata ? "inmediata" : e.anio != null ? "futura" : "sin dato";
    const fechaEntrega = entrega === "futura" && e ? new Date(Date.UTC(e.anio!, e.mes! - 1, 28)) : null;
    const elegible = f.condicion === "nuevo" && f.precio_uf <= TECHO_UF_SUBSIDIO && (!fechaEntrega || fechaEntrega.getTime() <= LIMITE_SUBSIDIO.getTime());
    const r = conHoyCongelado(ahora, () => conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, { ...opts, ...(elegible ? { tasaCredito: cfg.tasa - REBAJA_SUBSIDIO } : {}) })));
    if (!r) return null;
    const m = r.resultado.metrics;
    const m2 = Number(f.sp.superficie_m2), dorms = Number(f.sp.dormitorios);
    const capCelda = caps[`${f.comuna}|${dorms}`]?.cap ?? null;
    const ingresoUF = capCelda != null ? (m.ingresoMensual * 12) / (capCelda / 100) / cfg.uf : null;
    let radioUFm2: number | null = null, radioFuente: FilaMedio["radioFuente"] = null;
    if (f.condicion === "usado") {
      const v = f.venta;
      if (v?.fuente === "radio" && v.precioM2UF) { radioUFm2 = v.precioM2UF; radioFuente = "fila de hoy"; }
    } else if (radio14.has(f.aviso_id)) {
      radioUFm2 = radio14.get(f.aviso_id)!; radioFuente = "anexo 1";
    } else if (Number.isFinite(Number(f.sp.lat)) && Number.isFinite(Number(f.sp.lng)) && f.sp.lat != null) {
      const k = `${Number(f.sp.lat).toFixed(5)}|${Number(f.sp.lng).toFixed(5)}|${dorms}|${m2}`;
      if (!cacheRadio.has(k)) {
        const s = await getSugerencias(f.comuna, m2, dorms, f.precio_uf, Number(f.sp.lat), Number(f.sp.lng), 800, "venta", "usado").catch(() => null);
        cacheRadio.set(k, s && s.source === "radio" && typeof s.precioM2 === "number" ? s.precioM2 / cfg.uf : null);
        consultasRadio++;
        await new Promise((res) => setTimeout(res, PAUSA_MS));
      }
      radioUFm2 = cacheRadio.get(k) ?? null;
      if (radioUFm2 != null) radioFuente = "en vivo";
    }
    const radioUF = radioUFm2 != null ? radioUFm2 * m2 : null;
    const { base, medio } = valorBase(f.precio_uf, ingresoUF, radioUF);
    return {
      id: f.aviso_id, cond: f.condicion, comuna: f.comuna, proyecto: String(idProyectoDeUrl(f.sp.url) ?? (f.sp.source_id ?? f.aviso_id).split("#")[0]), entrega,
      precioUF: f.precio_uf, m2, dorms, origen,
      v: r.veredicto, s: r.score, flujo: r.flujo, ingreso: Number.isFinite(m.ingresoMensual) ? Math.round(m.ingresoMensual) : null, gate1: evalGate1Brazos(m, r.resultado.breakEvenTasa),
      elegible, sup0, capCelda, ingresoUF: ingresoUF != null ? Math.round(ingresoUF) : null, radioUF: radioUF != null ? Math.round(radioUF) : null, radioFuente,
      baseUF: base != null ? Math.round(base) : null, medio,
      tir: conHoyCongelado(ahora, () => tirsValorMedio(r, cfg, ahora, base)), tirMotor: valorMetrica(r.resultado.exitScenario.tir),
    };
  }

  // Universo.
  const activas = await universoActivo(sb);
  const idsActivas = new Set(activas.map((f) => f.aviso_id));
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const candidatas = completo.filas.filter((f) => !idsActivas.has(f.id));
  const siguen = new Set<string>();
  for (let i = 0; i < candidatas.length; i += 300) {
    const ids = candidatas.slice(i, i + 300).map((f) => f.id);
    const { data, error } = await sb.from("scraped_properties").select("id").in("id", ids).eq("is_active", true).order("id").limit(300);
    if (error) throw new Error(`is_active: ${error.message}`);
    for (const r of data ?? []) siguen.add(String((r as { id: string }).id));
    await new Promise((res) => setTimeout(res, PAUSA_MS));
  }
  const reactivadas: FilaUniverso[] = candidatas.filter((f) => siguen.has(f.id)).map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const filas = [...activas.map((f) => ({ f, origen: "activa" })), ...reactivadas.map((f) => ({ f, origen: "reactivada" }))].slice(0, TOPE);
  log(`universo: ${fmt(activas.length)} activos con evaluación (nuevos ${fmt(activas.filter((f) => f.condicion === "nuevo").length)}, usados ${fmt(activas.filter((f) => f.condicion === "usado").length)}) + ${fmt(reactivadas.length)} nuevos reactivados que siguen publicados = ${fmt(filas.length)}`);

  const salida: FilaMedio[] = [];
  let sucias = 0;
  const t0 = Date.now();
  let k = 0;
  for (const { f, origen } of filas) {
    k++;
    if (f.arriendo_sospechoso || f.radio_degradado) { sucias++; continue; }
    const x = await procesar(f, origen);
    if (x) salida.push(x);
    if (k % 2000 === 0) log(`${fmt(k)} / ${fmt(filas.length)} · ${((Date.now() - t0) / 60000).toFixed(1)} min · medianas en vivo ${consultasMediana} · radio en vivo ${consultasRadio}`);
  }
  log(`listo: ${fmt(salida.length)} avisos limpios (nuevos ${fmt(salida.filter((x) => x.cond === "nuevo").length)}, usados ${fmt(salida.filter((x) => x.cond === "usado").length)}; sin limpiar ${fmt(sucias)}; superficie corregida ${fmt(salida.filter((x) => x.sup0).length)}; medianas en vivo ${consultasMediana}; radio en vivo ${consultasRadio}) en ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // Extras: las fichas del anexo 2 y los 20 Ajustar de Lo Barnechea del anexo 3, aunque hoy no estén publicados.
  const enSalida = new Set(salida.map((x) => x.id));
  const fichas = (JSON.parse(readFileSync(`${DIR}/20-fichas.json`, "utf8")) as { fichas: Array<{ letra: string; id: string }> }).fichas;
  const f18 = (JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { filas: FilaIngreso[] }).filas;
  const loBarnechea = f18.filter((f) => f.cond === "usado" && f.v === "AJUSTA SUPUESTOS" && f.tir.g0h != null).sort((a, b) => b.tir.g0h! - a.tir.g0h!).slice(0, 20).map((f) => f.id);
  const idsExtra = [...fichas.filter((x) => x.id !== GOLDEN_ID).map((x) => x.id), ...loBarnechea].filter((id) => !enSalida.has(id));
  const extras: FilaMedio[] = [];
  if (idsExtra.length) {
    const leidas = await universoActivo(sb, { ids: idsExtra, incluirInactivos: true });
    const porReact = new Map(completo.filas.map((f) => [f.id, f]));
    for (const id of idsExtra) {
      const f = leidas.find((x) => x.aviso_id === id) ?? (porReact.has(id) ? ({ ...(porReact.get(id)!.evaluacion as unknown as FilaUniverso), aviso_id: id, precio_uf: porReact.get(id)!.evaluacion.precio_uf, sp: porReact.get(id)!.sp }) : null);
      if (!f) { log(`extra ${id.slice(0, 8)}: sin fila (dado de baja)`); continue; }
      const x = await procesar(f, "extra (hoy no publicado o no limpio)");
      if (x) extras.push(x);
    }
  }
  log(`extras: ${extras.length} de ${idsExtra.length} fuera del universo de hoy`);

  // El golden 17b4e10d: su input, su mediana guardada y la UF del día en que se creó (como en los anexos 2 a 4); valor del radio en
  // vivo si el input trae coordenadas.
  let golden: (FilaMedio & { creado: string; ufCaso: number }) | null = null;
  const { data } = await sb.from("analisis").select("id, comuna, created_at, input_data, mediana_comuna_snapshot, capref_comuna_snapshot").eq("id", GOLDEN_ID).single();
  if (data) {
    const input = data.input_data as AnalisisInput & { dormitorios: number; lat?: number; lng?: number };
    const creado = new Date(data.created_at as string);
    const { ufDelDia } = await import("./uf-historica");
    const uf = Math.round(await ufDelDia(creado.toISOString().slice(0, 10)));
    const mediana = data.mediana_comuna_snapshot ? medianaDesdeSnapshot(data.mediana_comuna_snapshot as never, { capRefComuna: (data.capref_comuna_snapshot as never) ?? null }) : undefined;
    const res = runAnalysis(input, uf, mediana as never, creado);
    const r: ResultadoMotor = { veredicto: readVeredicto(res as never) ?? null, score: Math.round(res.score), flujo: Math.round(res.metrics.flujoNetoMensual), resultado: res, body: input as unknown as Record<string, unknown> };
    const cfgCaso = { uf, tasa: Number(input.tasaMercado) || Number(input.tasaInteres) };
    const capCelda = caps[`${data.comuna}|${input.dormitorios}`]?.cap ?? null;
    const ingresoUF = capCelda != null ? (res.metrics.ingresoMensual * 12) / (capCelda / 100) / uf : null;
    let radioUF: number | null = null;
    if (input.lat != null && input.lng != null) {
      const s = await getSugerencias(data.comuna as string, input.superficie, input.dormitorios, input.precio, Number(input.lat), Number(input.lng), 800, "venta", "usado").catch(() => null);
      if (s && s.source === "radio" && typeof s.precioM2 === "number") radioUF = (s.precioM2 / cfg.uf) * input.superficie;
    }
    const { base, medio } = valorBase(input.precio, ingresoUF, radioUF);
    golden = {
      id: GOLDEN_ID, cond: "nuevo", comuna: data.comuna as string, proyecto: "golden", entrega: "inmediata", precioUF: input.precio, m2: input.superficie, dorms: input.dormitorios, origen: "golden",
      v: r.veredicto, s: r.score, flujo: r.flujo, ingreso: Math.round(res.metrics.ingresoMensual), gate1: evalGate1Brazos(res.metrics, res.breakEvenTasa), elegible: false, sup0: false, capCelda,
      ingresoUF: ingresoUF != null ? Math.round(ingresoUF) : null, radioUF: radioUF != null ? Math.round(radioUF) : null, radioFuente: radioUF != null ? "en vivo" : null,
      baseUF: base != null ? Math.round(base) : null, medio, tir: tirsValorMedio(r, cfgCaso, creado, base), tirMotor: valorMetrica(res.exitScenario.tir), creado: data.created_at as string, ufCaso: uf,
    };
    log(`golden 17b4e10d: precio UF ${fmt(input.precio)} · ingreso ${golden.ingresoUF ?? "—"} · radio ${golden.radioUF ?? "—"} (coordenadas en el input: ${input.lat != null ? "sí" : "no"}) · base ${golden.baseUF ?? "—"} (${medio})`);
  }
  writeFileSync(`${DIR}/27-valor-medio.json`, JSON.stringify({ cfg, ahora: ahora.toISOString(), calculadoAt: new Date().toISOString(), filas: salida, extras, golden, loBarnechea }));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("27-anexo6-valor-medio.ts")) main().catch((e) => { console.error(e); process.exit(1); });
