// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 5 · NUEVOS CON SUBSIDIO POR DEFECTO (23-nov-2026). Solo lectura: nada se escribe en la base.
// Universo: los nuevos de hoy (activos con evaluación en `avisos_evaluados`) más las unidades reactivadas de la medición que
// siguen publicadas (`6-universo-completo.json`, chequeadas hoy contra `scraped_properties.is_active`), limpios (sin arriendo
// sospechoso ni radio degradado). Motor real (`runAnalysis` por la cadena de la noche), UF y tasa de hoy, pie 20 %, 30 años,
// «hoy» = el instante de la corrida, con la superficie de dos decimales corregida en memoria y, para los avisos que el error
// dejaba en 0, la mediana comunal resuelta en vivo (como en la FASE 1, con caché por celda).
// Por aviso, seis corridas del motor: sin nada · con subsidio (tasa − 0,6 si es elegible: precio ≤ UF 6.000 y entrega
// inmediata, sin fecha o hasta el 31-may-2028) · subsidio + 5 % · subsidio + 10 % · 5 % · 10 % (precio × 0,95 / 0,90; la
// elegibilidad se mira con el precio efectivo). Para sin nada y con subsidio, además, la TIR a 10 años con g = 3 % y salida al
// mayor cap (anexo 4: arriendo del año 11 ÷ el mayor entre el cap de entrada y el de la celda, la celda del anexo 2).
// Y el bono pie en tres unidades reales cercanas a la mediana de precio de su comuna (Santiago, Ñuñoa, Puente Alto; entrega
// inmediata): sin nada, descuento real de 10 % y bono pie de 10 % (precio igual, pie 10 %, crédito por el 90 %).
// Salida: out/25-subsidio.json.   TOPE=100 para probar.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conHoyCongelado, conSuperficieDosDecimales, evaluarConMotor, fmt, leerConfig, universoActivo, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { idProyectoDeUrl } from "../../../src/lib/services/scraper/toctoc-unidades";
import { REBAJA_SUBSIDIO, TECHO_UF_SUBSIDIO } from "../../../src/lib/constants/subsidio";
import { exitValorMercado, proyeccionConG, type Cap } from "./18-salida-ingreso";
import type { FilaCompleta } from "./6-universo-completo";
import type { AnalisisInput } from "../../../src/lib/types";

const TOPE = Number(process.env.TOPE ?? Infinity);
const DIR = "scripts/analisis/motor-nuevos/out";
const LOG = `${DIR}/25-subsidio.log`;
const HORIZONTE = 10;
const LIMITE_SUBSIDIO = new Date("2028-05-31T23:59:59Z");
const LOTE = 300;
const PAUSA_MS = 120;
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };
const valorMetrica = (t: unknown): number | null => (typeof t === "number" ? t : t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : null);

export type Esc = "base" | "sub" | "sub5" | "sub10" | "d5" | "d10";
export const ESCS: Esc[] = ["base", "sub", "sub5", "sub10", "d5", "d10"];
export interface Corrida { v: string | null; s: number | null; flujo: number | null; ingreso: number | null; elegible: boolean; tirMayorG3?: number | null }
export interface FilaSub {
  id: string; comuna: string; proyecto: string; entrega: "inmediata" | "futura" | "sin dato"; precioUF: number; m2: number; dorms: number;
  origen: "activa" | "reactivada"; sup0: boolean; capCelda: number | null; capEntrada: number | null;
  c: Partial<Record<Esc, Corrida>>;
}
export interface BonoPie {
  id: string; comuna: string; proyecto: string; m2: number; dorms: number; precioUF: number;
  casos: Record<"nada" | "descuento10" | "bono10", { precioUF: number; pie: number; poneHoyCLP: number; creditoCLP: number; dividendoCLP: number; flujoCLP: number; v: string | null; s: number | null; saldo10CLP: number; recibeCLP: number; tirG3: number | null; tirG0: number | null; tirMotor: number | null }>;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOG, "");
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const ahora = new Date();
  const caps = (JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { caps: Record<string, Cap> }).caps;
  const cacheMediana = new Map<string, unknown>(Object.entries(JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>));
  log(`config de hoy: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · tasa con subsidio ${fmt(cfg.tasa - REBAJA_SUBSIDIO, 2)} % · «hoy» ${ahora.toISOString()}`);

  // Universo: activos de hoy + reactivadas que siguen publicadas.
  const activas = await universoActivo(sb, { condicion: "nuevo" });
  const idsActivas = new Set(activas.map((f) => f.aviso_id));
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const candidatas = completo.filas.filter((f) => !idsActivas.has(f.id));
  const siguen = new Set<string>();
  for (let i = 0; i < candidatas.length; i += LOTE) {
    const ids = candidatas.slice(i, i + LOTE).map((f) => f.id);
    const { data, error } = await sb.from("scraped_properties").select("id").in("id", ids).eq("is_active", true).order("id").limit(LOTE);
    if (error) throw new Error(`is_active: ${error.message}`);
    for (const r of data ?? []) siguen.add(String((r as { id: string }).id));
    await new Promise((res) => setTimeout(res, PAUSA_MS));
  }
  const reactivadas: FilaUniverso[] = candidatas.filter((f) => siguen.has(f.id)).map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const filas = [...activas.map((f) => ({ f, origen: "activa" as const })), ...reactivadas.map((f) => ({ f, origen: "reactivada" as const }))].slice(0, TOPE);
  log(`universo: ${fmt(activas.length)} nuevos activos con evaluación + ${fmt(reactivadas.length)} reactivadas que siguen publicadas (de ${fmt(candidatas.length)}) = ${fmt(filas.length)}`);

  const salida: FilaSub[] = [];
  const corridas = new Map<string, { f: FilaUniverso; opts: Parameters<typeof evaluarConMotor>[3] }>();
  let consultas = 0, sup0n = 0, sucias = 0, sinArriendo = 0;
  const t0 = Date.now();
  let k = 0;
  for (const { f, origen } of filas) {
    k++;
    if (f.arriendo_sospechoso || f.radio_degradado) { sucias++; continue; }
    if (!f.arriendo) { sinArriendo++; continue; }
    // Superficie: ¿el error de los dos decimales la deja en 0? Si es así, mediana en vivo con la superficie entera.
    const ra = conHoyCongelado(ahora, () => evaluarConMotor(f, cfg, 20, { asOf: ahora }));
    let opts: Parameters<typeof evaluarConMotor>[3] = { asOf: ahora };
    const sup0 = !!ra && Number(ra.body.superficie) === 0;
    if (sup0) {
      sup0n++;
      const sinGgcc = { asOf: ahora, ctxPatch: { ggccSugerido: null } };
      const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
      if (!cacheMediana.has(clave)) {
        const bodyB = conHoyCongelado(ahora, () => conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, sinGgcc)))!.body;
        consultas++;
        cacheMediana.set(clave, await prefetchMedianaComunaVenta(sb as never, bodyB as never, cfg.uf).catch(() => null));
        await new Promise((res) => setTimeout(res, PAUSA_MS));
      }
      opts = { ...sinGgcc, medianaComuna: cacheMediana.get(clave) };
    }
    const e = parsearFechaEntrega(f.sp.fecha_entrega, ahora);
    const entrega: FilaSub["entrega"] = !e ? "sin dato" : e.inmediata ? "inmediata" : e.anio != null ? "futura" : "sin dato";
    const fechaEntrega = entrega === "futura" && e ? new Date(Date.UTC(e.anio!, e.mes! - 1, 28)) : null;
    const elegible = (precioUF: number) => precioUF <= TECHO_UF_SUBSIDIO && (!fechaEntrega || fechaEntrega.getTime() <= LIMITE_SUBSIDIO.getTime());
    const capCelda = caps[`${f.comuna}|${Number(f.sp.dormitorios)}`]?.cap ?? null;
    const proyecto = String(idProyectoDeUrl(f.sp.url) ?? (f.sp.source_id ?? f.aviso_id).split("#")[0]);
    const fila: FilaSub = { id: f.aviso_id, comuna: f.comuna, proyecto, entrega, precioUF: f.precio_uf, m2: Number(f.sp.superficie_m2), dorms: Number(f.sp.dormitorios), origen, sup0, capCelda, capEntrada: null, c: {} };
    const correr = (factor: number, sub: boolean, conTir: boolean): Corrida | undefined => conHoyCongelado(ahora, () => {
      const precio = Math.round(f.precio_uf * factor * 100) / 100;
      const el = elegible(precio);
      const r = conSuperficieDosDecimales(() => evaluarConMotor({ ...f, precio_uf: precio }, cfg, 20, { ...opts, ...(sub && el ? { tasaCredito: cfg.tasa - REBAJA_SUBSIDIO } : {}) }));
      if (!r) return undefined;
      const m = r.resultado.metrics;
      const out: Corrida = { v: r.veredicto, s: r.score, flujo: r.flujo, ingreso: Number.isFinite(m.ingresoMensual) ? Math.round(m.ingresoMensual) : null, elegible: el };
      if (conTir) {
        const ce = ((m.ingresoMensual * 12) / (precio * cfg.uf)) * 100;
        if (factor === 1 && !sub) fila.capEntrada = ce;
        out.tirMayorG3 = capCelda != null ? tirMayorCap(r, cfg, ahora, 0.03, Math.max(ce, capCelda)) : null;
      }
      return out;
    });
    fila.c.base = correr(1, false, true);
    fila.c.sub = correr(1, true, true);
    fila.c.sub5 = correr(0.95, true, false);
    fila.c.sub10 = correr(0.9, true, false);
    fila.c.d5 = correr(0.95, false, false);
    fila.c.d10 = correr(0.9, false, false);
    if (!fila.c.base) continue;
    salida.push(fila);
    corridas.set(fila.id, { f, opts });
    if (k % 500 === 0) log(`${fmt(k)} / ${fmt(filas.length)} · ${((Date.now() - t0) / 60000).toFixed(1)} min · medianas en vivo ${consultas}`);
  }
  log(`listo: ${fmt(salida.length)} nuevos limpios (sin limpiar: arriendo sospechoso o radio degradado ${fmt(sucias)}, sin arriendo ${fmt(sinArriendo)}; con la superficie que el error dejaba en 0: ${fmt(sup0n)}, medianas resueltas en vivo ${consultas}) en ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // Bono pie: tres unidades reales, la de entrega inmediata más cercana a la mediana de precio de los nuevos de su comuna.
  const bono: BonoPie[] = [];
  for (const comuna of ["Santiago", "Ñuñoa", "Puente Alto"]) {
    const grupo = salida.filter((x) => x.comuna === comuna && x.entrega === "inmediata" && x.capCelda != null);
    if (!grupo.length) { log(`bono pie: ${comuna} sin unidades de entrega inmediata con cap`); continue; }
    const precios = salida.filter((x) => x.comuna === comuna).map((x) => x.precioUF).sort((a, b) => a - b);
    const med = precios[Math.floor((precios.length - 1) / 2)];
    const elegida = [...grupo].sort((a, b) => Math.abs(a.precioUF - med) - Math.abs(b.precioUF - med) || a.id.localeCompare(b.id))[0];
    const { f, opts } = corridas.get(elegida.id)!;
    const caso = (factor: number, pie: number) => conHoyCongelado(ahora, () => {
      const precio = Math.round(f.precio_uf * factor * 100) / 100;
      const r = conSuperficieDosDecimales(() => evaluarConMotor({ ...f, precio_uf: precio }, cfg, pie, opts))!;
      const m = r.resultado.metrics;
      const ce = ((m.ingresoMensual * 12) / (precio * cfg.uf)) * 100;
      const capS = Math.max(ce, elegida.capCelda!);
      const g3 = exitMayorCap(r, cfg, ahora, 0.03, capS), g0 = exitMayorCap(r, cfg, ahora, 0, capS);
      return { precioUF: precio, pie, poneHoyCLP: Math.round(g3.inversionInicial), creditoCLP: Math.round(m.precioCLP - m.pieCLP), dividendoCLP: Math.round(m.dividendo), flujoCLP: Math.round(m.flujoNetoMensual), v: r.veredicto, s: r.score, saldo10CLP: Math.round(g3.saldoCredito), recibeCLP: Math.round(g3.equityCLP), tirG3: valorMetrica(g3.tir), tirG0: valorMetrica(g0.tir), tirMotor: valorMetrica(r.resultado.exitScenario.tir) };
    });
    bono.push({ id: elegida.id, comuna, proyecto: elegida.proyecto, m2: elegida.m2, dorms: elegida.dorms, precioUF: elegida.precioUF, casos: { nada: caso(1, 20), descuento10: caso(0.9, 20), bono10: caso(1, 10) } });
    log(`bono pie: ${comuna} → ${elegida.id.slice(0, 8)} (UF ${fmt(elegida.precioUF)}, mediana de la comuna UF ${fmt(med)})`);
  }
  writeFileSync(`${DIR}/25-subsidio.json`, JSON.stringify({ cfg, ahora: ahora.toISOString(), calculadoAt: new Date().toISOString(), filas: salida, bono }));
}

/** El exit con salida al mayor cap: arriendo del año 11 (proyección con g) ÷ `capSalida`. */
function exitMayorCap(r: ResultadoMotor, cfg: Config, asOf: Date, g: number, capSalida: number) {
  const input = r.body as unknown as AnalisisInput;
  const proj = proyeccionConG(input, r, cfg, asOf, g);
  return exitValorMercado(input, r, proj, (proj[HORIZONTE].arriendoMensual * 12) / (capSalida / 100));
}
function tirMayorCap(r: ResultadoMotor, cfg: Config, asOf: Date, g: number, capSalida: number): number | null {
  return valorMetrica(exitMayorCap(r, cfg, asOf, g, capSalida).tir);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("25-anexo5-subsidio.ts")) main().catch((e) => { console.error(e); process.exit(1); });
