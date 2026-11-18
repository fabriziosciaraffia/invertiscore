// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 4 · LA SALIDA AL MAYOR CAP (18-nov-2026). Solo lectura: nada se escribe en la base.
// Regla: cap de salida = el mayor entre el cap de entrada del depto (arriendo bruto anual de hoy ÷ precio) y el cap de
// mercado de su celda (comuna × dormitorios, universo usado: el del anexo 2, con el respaldo de la comuna marcado). Valor de
// venta al año 10 = arriendo bruto del año 11 ÷ ese cap. Donde el cap de la celda ya es el mayor, la salida es la del anexo 2
// y su TIR está guardada; donde el cap de entrada es mayor, la salida baja y su TIR no está guardada.
// Para poner al lado la salida con tope de 1,10 × el valor del radio en los TRES escenarios (el anexo 3 solo la hizo con
// g = 0 %), se calcula también ese tope con g = 3 % y 1 % (1,10 × valor del radio de hoy × (1+g)^10).
// Para cada aviso donde alguna de las dos cambia la salida se corre la MISMA cadena de la corrida del 07-nov (misma UF y tasa,
// el mismo «hoy» congelado, el mismo cap de celda), releyendo la fila aunque el aviso ya no esté publicado, y se exige que
// las tres TIR sin cambio de salida (g 3, 1 y 0 %) calcen con las guardadas. Si no calzan (fila reevaluada) o no hay fila,
// queda «no reproducible» / «sin fila» y las tablas estiman (24-anexo4-tablas.ts).
// También el nuevo de Ñuñoa del Golden Set (17b4e10d), con su input y la UF del día en que se creó.
// Salida: out/23-mayor-cap.json.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conHoyCongelado, conSuperficieDosDecimales, evaluarConMotor, fmt, universoActivo, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { medianaDesdeSnapshot } from "../../../src/lib/analysis/mediana-snapshot";
import { ufDelDia } from "./uf-historica";
import { exitValorMercado, proyeccionConG, type Cap, type Escenario, type FilaIngreso } from "./18-salida-ingreso";
import type { FilaAnexo } from "./14-anexo-salida";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";
import type { AnalisisInput } from "../../../src/lib/types";

const DIR = "scripts/analisis/motor-nuevos/out";
const LOG = `${DIR}/23-mayor-cap.log`;
const HORIZONTE = 10;
const LOTE = 150;
export const TOPE_RADIO = 1.1;
export const GS = { g3: 0.03, g1: 0.01, g0: 0 } as const;
export type G = keyof typeof GS;
const GOLDEN_ID = "17b4e10d-2afd-4554-b914-fe731ee2c9a0";
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };
const valorMetrica = (t: unknown): number | null => (typeof t === "number" ? t : t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : null);

/** Cap de entrada del depto, en %: arriendo bruto anual de hoy ÷ precio. */
export const capEntrada = (f: Pick<FilaIngreso, "arriendoHoyCLP" | "precioUF">, uf: number) => (f.arriendoHoyCLP / (f.precioUF * uf)) * 100;
/** ¿El tope de 1,10 × radio × (1+g)^10 muerde la salida por ingreso con cap de mercado? */
export const topeMuerde = (f: FilaIngreso, radioUF: number | null | undefined, g: G) => radioUF != null && f.valorUF[`${g}h` as Escenario] != null && f.valorUF[`${g}h` as Escenario]! > TOPE_RADIO * radioUF * Math.pow(1 + GS[g], HORIZONTE);

export interface PorG { sin: number | null; mayor?: number | null; tope?: number | null }
export interface Recalculo { estado: "ok" | "no reproducible" | "sin fila"; g: Partial<Record<G, PorG>> }

/** Las TIR de un resultado del motor con cap de mercado `cap` y cap de entrada `ce`: sin cambio, al mayor cap y con tope. */
export function tirsDe(r: ResultadoMotor, cfg: Config, asOf: Date, cap: number, ce: number, radioUF: number | null): Partial<Record<G, PorG>> {
  const input = r.body as unknown as AnalisisInput;
  const out: Partial<Record<G, PorG>> = {};
  for (const g of Object.keys(GS) as G[]) {
    const proj = proyeccionConG(input, r, cfg, asOf, GS[g]);
    const arr11 = proj[HORIZONTE].arriendoMensual * 12;
    const valor = arr11 / (cap / 100);
    const p: PorG = { sin: valorMetrica(exitValorMercado(input, r, proj, valor).tir) };
    if (ce > cap) p.mayor = valorMetrica(exitValorMercado(input, r, proj, arr11 / (ce / 100)).tir);
    if (radioUF != null) {
      const tope = TOPE_RADIO * radioUF * Math.pow(1 + GS[g], HORIZONTE) * cfg.uf;
      if (valor > tope) p.tope = valorMetrica(exitValorMercado(input, r, proj, tope).tir);
    }
    out[g] = p;
  }
  return out;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOG, "");
  const { filas, cfg } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: Config; filas: FilaIngreso[] };
  const radio = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.map((f) => [f.id, f.valorUsadoHoyUF]));
  const asOfRun = new Date(readFileSync(`${DIR}/18-salida-ingreso.log`, "utf8").split("\n")[0].split("· ").pop()!.trim());
  const cambian = filas.filter((f) => f.cap.cap != null && (capEntrada(f, cfg.uf) > f.cap.cap || (Object.keys(GS) as G[]).some((g) => topeMuerde(f, radio.get(f.id), g))));
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · «hoy» de la corrida 18: ${asOfRun.toISOString()} · con cap de mercado ${fmt(filas.filter((f) => f.cap.cap != null).length)} · cap de entrada mayor que el de la celda ${fmt(filas.filter((f) => f.cap.cap != null && capEntrada(f, cfg.uf) > f.cap.cap).length)} · a recalcular (mayor cap o tope en algún g) ${fmt(cambian.length)}`);

  const sb = createServiceClient();
  const ids = cambian.map((f) => f.id);
  const leidas: FilaUniverso[] = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    leidas.push(...(await universoActivo(sb, { ids: ids.slice(i, i + LOTE), incluirInactivos: true })));
    await new Promise((res) => setTimeout(res, 120));
  }
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const idsSet = new Set(ids);
  const reactivadas: FilaUniverso[] = completo.filas.filter((f) => idsSet.has(f.id)).map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const porId = new Map<string, FilaUniverso>([...leidas.map((f) => [f.aviso_id, f] as [string, FilaUniverso]), ...reactivadas.map((f) => [f.aviso_id, f] as [string, FilaUniverso])]);
  log(`filas leídas: ${fmt(leidas.length)} de avisos_evaluados (también las despublicadas) + ${fmt(reactivadas.length)} reactivadas de la corrida`);

  const base = new Map((JSON.parse(readFileSync(`${DIR}/1-base-corregida.json`, "utf8")) as { filas: FilaBase[] }).filas.map((f) => [f.id, f]));
  const celdas = JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>;
  const salida: Record<string, Recalculo> = {};
  const t0 = Date.now();
  let k = 0;
  for (const g of cambian) {
    k++;
    const reg: Recalculo = { estado: "sin fila", g: {} };
    const f = porId.get(g.id);
    if (f) {
      const b = base.get(f.aviso_id);
      const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
      const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
      conHoyCongelado(asOfRun, () => {
        const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
        if (r) reg.g = tirsDe(r, cfg, asOfRun, g.cap.cap!, capEntrada(g, cfg.uf), radio.get(g.id) ?? null);
      });
      const calza = (Object.keys(GS) as G[]).every((gg) => {
        const nueva = reg.g[gg]?.sin ?? null, guardada = g.tir[`${gg}h` as Escenario] ?? null;
        return nueva == null ? guardada == null : guardada != null && Math.abs(nueva - guardada) < 0.011;
      });
      reg.estado = calza ? "ok" : "no reproducible";
    }
    salida[g.id] = reg;
    if (k % 1000 === 0) log(`${fmt(k)} / ${fmt(cambian.length)} · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  const est = (e: Recalculo["estado"]) => Object.values(salida).filter((r) => r.estado === e).length;
  log(`listo en ${((Date.now() - t0) / 60000).toFixed(1)} min: reproducen ${fmt(est("ok"))} · no reproducibles ${fmt(est("no reproducible"))} · sin fila ${fmt(est("sin fila"))}`);

  // El golden 17b4e10d: su input, su mediana guardada y la UF del día en que se creó; cap de mercado de su celda (anexo 2).
  const goldenCap = (JSON.parse(readFileSync(`${DIR}/18-golden.json`, "utf8")) as Record<string, { cap: Cap }>)[GOLDEN_ID.slice(0, 8)].cap;
  const { data } = await sb.from("analisis").select("id, comuna, created_at, input_data, mediana_comuna_snapshot, capref_comuna_snapshot").eq("id", GOLDEN_ID).single();
  let golden: Record<string, unknown> | null = null;
  if (data && goldenCap.cap != null) {
    const input = data.input_data as AnalisisInput;
    const creado = new Date(data.created_at as string);
    const uf = Math.round(await ufDelDia(creado.toISOString().slice(0, 10)));
    const mediana = data.mediana_comuna_snapshot ? medianaDesdeSnapshot(data.mediana_comuna_snapshot as never, { capRefComuna: (data.capref_comuna_snapshot as never) ?? null }) : undefined;
    const res = runAnalysis(input, uf, mediana as never, creado);
    const r: ResultadoMotor = { veredicto: readVeredicto(res as never) ?? null, score: Math.round(res.score), flujo: Math.round(res.metrics.flujoNetoMensual), resultado: res, body: input as unknown as Record<string, unknown> };
    const ce = ((res.metrics.ingresoMensual * 12) / (input.precio * uf)) * 100;
    golden = { id: GOLDEN_ID, uf, capEntrada: ce, cap: goldenCap.cap, g: tirsDe(r, { uf, tasa: Number(input.tasaMercado) || Number(input.tasaInteres) }, creado, goldenCap.cap, ce, null) };
    log(`golden 17b4e10d: cap de entrada ${fmt(ce, 2)} % · cap de la celda ${fmt(goldenCap.cap, 2)} % · TIR al mayor cap g 3/1/0: ${(["g3", "g1", "g0"] as G[]).map((gg) => fmt((golden!.g as Record<G, PorG>)[gg].mayor ?? null, 1)).join(" / ")}`);
  }
  writeFileSync(`${DIR}/23-mayor-cap.json`, JSON.stringify({ cfg, asOfRun: asOfRun.toISOString(), calculadoAt: new Date().toISOString(), recalculo: salida, golden }));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("23-anexo4-mayor-cap.ts")) main().catch((e) => { console.error(e); process.exit(1); });
