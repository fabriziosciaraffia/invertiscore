// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 3 · EL RESGUARDO DE LA SALIDA POR INGRESO (18-nov-2026). Solo lectura: nada se escribe en la base.
// La regla A mira la TIR por ingreso con g = 0 % y cap de hoy (ya guardada en out/18-salida-ingreso.json). El resguardo limita
// el valor de salida por ingreso a 1,10 veces el valor por comparables usados del radio del anexo 1 (out/14-anexo-salida.json;
// con g = 0 % es el valor de hoy, `valorUsadoHoyUF`). Donde el tope no muerde, la TIR no cambia; donde muerde, la salida baja y
// su TIR no está guardada. Para esos avisos se corre la MISMA cadena de la corrida 18 (misma UF y tasa, el mismo «hoy»
// congelado en el instante de esa corrida, el mismo cap de celda) y se exige que la TIR SIN tope calce con la guardada antes de
// usar la TIR CON tope. La fila se relee de `avisos_evaluados` aunque el aviso ya no esté publicado; si la fila cambió desde
// la corrida (reevaluada o borrada), la TIR sin tope no calza y el aviso queda marcado «no reproducible».
// Salida: out/21-resguardo.json.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { conHoyCongelado, conSuperficieDosDecimales, evaluarConMotor, fmt, universoActivo, type Config, type FilaUniverso } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { exitValorMercado, proyeccionConG, type FilaIngreso } from "./18-salida-ingreso";
import type { FilaAnexo } from "./14-anexo-salida";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";
import type { AnalisisInput } from "../../../src/lib/types";

const DIR = "scripts/analisis/motor-nuevos/out";
const LOG = `${DIR}/21-resguardo.log`;
const HORIZONTE = 10;
export const TOPE_RADIO = 1.1;
const LOTE = 150;
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };
const valorMetrica = (t: unknown): number | null => (typeof t === "number" ? t : t && typeof t === "object" && (t as { tipo?: string }).tipo === "valor" ? Number((t as { valor: number }).valor) : null);

export interface Resguardo {
  /** Valor de salida por ingreso (g 0 %, cap de hoy), el tope (1,10 × radio) y el valor con resguardo, en UF. */
  valorUF: number; topeUF: number; valorConTopeUF: number;
  /** TIR sin tope recalculada (control contra la guardada) y TIR con tope; null si no se pudo correr. */
  tirSinTope: number | null; tirConTope: number | null;
  estado: "ok" | "no reproducible" | "sin fila";
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOG, "");
  const { filas, cfg } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: Config; filas: FilaIngreso[] };
  const radio = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.map((f) => [f.id, f.valorUsadoHoyUF]));
  const asOfRun = new Date(readFileSync(`${DIR}/18-salida-ingreso.log`, "utf8").split("\n")[0].split("· ").pop()!.trim());
  // Los que muerden: valor por ingreso (g 0 %) sobre 1,10 × el valor del radio.
  const muerden = filas.filter((f) => { const r = radio.get(f.id); return r != null && f.valorUF.g0h != null && f.valorUF.g0h > TOPE_RADIO * r && f.cap.cap != null; });
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · «hoy» de la corrida 18: ${asOfRun.toISOString()} · filas ${fmt(filas.length)} · sin valor del radio ${fmt(filas.filter((f) => radio.get(f.id) == null).length)} · el tope muerde en ${fmt(muerden.length)}`);

  const sb = createServiceClient();
  const ids = muerden.map((f) => f.id);
  const leidas: FilaUniverso[] = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    leidas.push(...(await universoActivo(sb, { ids: ids.slice(i, i + LOTE), incluirInactivos: true })));
    await new Promise((res) => setTimeout(res, 120));
  }
  const completo = JSON.parse(readFileSync(`${DIR}/6-universo-completo.json`, "utf8")) as { filas: FilaCompleta[] };
  const idsSet = new Set(ids);
  const reactivadas: FilaUniverso[] = completo.filas.filter((f) => idsSet.has(f.id)).map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  // Una reactivada se reproduce con su fila de la corrida (la de 6-universo-completo), como en la corrida 18.
  const porId = new Map<string, FilaUniverso>([...leidas.map((f) => [f.aviso_id, f] as [string, FilaUniverso]), ...reactivadas.map((f) => [f.aviso_id, f] as [string, FilaUniverso])]);
  log(`filas leídas: ${fmt(leidas.length)} de avisos_evaluados (también las ya despublicadas) + ${fmt(reactivadas.length)} reactivadas de la corrida`);

  const base = new Map((JSON.parse(readFileSync(`${DIR}/1-base-corregida.json`, "utf8")) as { filas: FilaBase[] }).filas.map((f) => [f.id, f]));
  const celdas = JSON.parse(readFileSync(`${DIR}/1-medianas-celda.json`, "utf8")) as Record<string, unknown>;
  const salida: Record<string, Resguardo> = {};
  const t0 = Date.now();
  let k = 0;
  for (const g of muerden) {
    k++;
    const topeUF = TOPE_RADIO * radio.get(g.id)!;
    const reg: Resguardo = { valorUF: g.valorUF.g0h!, topeUF: Math.round(topeUF), valorConTopeUF: Math.round(topeUF), tirSinTope: null, tirConTope: null, estado: "sin fila" };
    const f = porId.get(g.id);
    if (f) {
      const b = base.get(f.aviso_id);
      const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
      const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
      conHoyCongelado(asOfRun, () => {
        const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
        if (!r) return;
        const input = r.body as unknown as AnalisisInput;
        const proj = proyeccionConG(input, r, cfg, asOfRun, 0);
        const valor = (proj[HORIZONTE].arriendoMensual * 12) / (g.cap.cap! / 100);
        reg.tirSinTope = valorMetrica(exitValorMercado(input, r, proj, valor).tir);
        reg.tirConTope = valorMetrica(exitValorMercado(input, r, proj, Math.min(valor, topeUF * cfg.uf)).tir);
      });
      const calza = reg.tirSinTope == null ? g.tir.g0h == null : g.tir.g0h != null && Math.abs(reg.tirSinTope - g.tir.g0h) < 0.011;
      reg.estado = calza ? "ok" : "no reproducible";
    }
    salida[g.id] = reg;
    if (k % 1000 === 0) log(`${fmt(k)} / ${fmt(muerden.length)} · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  const est = (e: Resguardo["estado"]) => Object.values(salida).filter((r) => r.estado === e).length;
  log(`listo en ${((Date.now() - t0) / 60000).toFixed(1)} min: reproducen ${fmt(est("ok"))} · no reproducibles ${fmt(est("no reproducible"))} · sin fila ${fmt(est("sin fila"))}`);
  writeFileSync(`${DIR}/21-resguardo.json`, JSON.stringify({ cfg, asOfRun: asOfRun.toISOString(), tope: TOPE_RADIO, calculadoAt: new Date().toISOString(), resguardo: salida }));
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("21-anexo3-resguardo.ts")) main().catch((e) => { console.error(e); process.exit(1); });
