// ─────────────────────────────────────────────────────────────────────────────
// ANEXO · SALIDA COMO USADO DEL RADIO (respuesta al STOP 4, 06-nov-2026). Para cada aviso de la base de referencia (5.597
// nuevos limpios y 21.191 usados), el precio de venta al año 10 se calcula con el MISMO método de comparables con que el motor
// valora hoy —`getSugerencias(…, "venta", condicion)`: mediana de precio por m² de los avisos de venta del radio (dormitorios,
// tamaño ±20 %), con el factor publicado→cierre del motor— pero con UNIVERSO USADO, por (1+g)^10 con g = 1 % y g = 3 %
// (precio y arriendo). Reemplaza por completo a la salida del motor (precio × 1,03^10 − sobreprecio de hoy). Donde el radio no
// junta comparables usados (`source ≠ "radio"`), cae a la celda usado de comuna y dormitorios (la de 11-fase4), marcado.
//   · Nuevos: una consulta de comparables por punto, tipología y m² (caché), de a una con pausa.
//   · Usados: su propia sugerencia de venta guardada (universo usado) es ese mismo método; se compara con la salida del
//     motor y, como no coinciden, se aplica la misma regla a todos.
// La TIR sale de `calcExitScenario` del motor con el precio de venta reemplazado al año 10 (valor de mercado, sin descontar
// sobreprecio) sobre la proyección con g (precio y arriendo). Solo lectura. Salida: out/14-anexo-salida.json.
//   TOPE=200 para probar.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { leerConfig, universoActivo, evaluarConMotor, conSuperficieDosDecimales, fmt, type Config, type FilaUniverso, type ResultadoMotor } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { calcExitScenario, calcProjections, evalGate1Brazos } from "../../../src/lib/analysis";
import { getSugerencias } from "../../../src/lib/services/market-suggestions";
import { crecimientoReal } from "../../../src/lib/plusvalia-proyeccion";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import type { AnalisisInput, YearProjection } from "../../../src/lib/types";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";
import type { FilaFase4 } from "./11-fase4";

const TOPE = Number(process.env.TOPE ?? Infinity);
const HORIZONTE = 10;
const ARRIENDO_REAL = crecimientoReal(0.035);
const SALIDA = "scripts/analisis/motor-nuevos/out/14-anexo-salida.json";
const LOG = "scripts/analisis/motor-nuevos/out/14-anexo-salida.log";
const PAUSA_MS = 100;
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

export interface SalidaAnexo { tir: number | null; equityUF: number; gananciaUF: number }
export interface FilaAnexo {
  id: string; cond: "usado" | "nuevo"; comuna: string; entrega: "inmediata" | "futura" | "sin dato"; precioUF: number; m2: number; dorms: number;
  v: string | null; flujo: number | null; gate1: ReturnType<typeof evalGate1Brazos>;
  /** El valor hoy como usado del radio: UF/m² y de dónde salió (radio, celda, o ninguno). */
  usadoUFm2: number | null; fuente: "radio" | "celda" | "ninguno"; nComparables: number;
  valorUsadoHoyUF: number | null;
  /** Salida del motor al año 10 (precio × 1,03^10 − sobreprecio) y la salida como usado del radio con g 3 % y 1 %, en UF. */
  salidaMotorUF: number; salidaUsado3UF: number | null; salidaUsado1UF: number | null;
  /** TIR del motor (para control) y con la salida como usado del radio, g 1 % y g 3 %. */
  tirMotor: number | null; r1: SalidaAnexo | null; r3: SalidaAnexo | null;
}

function proyeccionConG(input: AnalisisInput, r: ResultadoMotor, cfg: Config, asOf: Date, g: number): YearProjection[] {
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
function exitValorMercado(input: AnalisisInput, r: ResultadoMotor, proj: YearProjection[], precioVentaCLP: number, uf: number): SalidaAnexo {
  const p = proj.map((x, i) => (i === HORIZONTE - 1 ? { ...x, valorPropiedad: Math.round(precioVentaCLP) } : x));
  const e = calcExitScenario(input, { ...r.resultado.metrics, precioVsComuna: null }, p, HORIZONTE);
  const t = e.tir as { tipo?: string; valor?: number } | number;
  return { tir: typeof t === "number" ? t : t?.tipo === "valor" ? Number(t.valor) : null, equityUF: Math.round(e.equityCLP / uf), gananciaUF: Math.round(e.gananciaSobreTotal / uf) };
}

async function main() {
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  const sb = createServiceClient();
  const cfg = await leerConfig(sb);
  const asOf = new Date();
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { filas: FilaBase[] };
  const completo = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/6-universo-completo.json", "utf8")) as { filas: FilaCompleta[] };
  const celdas = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-medianas-celda.json", "utf8")) as Record<string, unknown>;
  const fase4 = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/11-fase4.json", "utf8")) as { filas: FilaFase4[] };
  const celdaUsado = new Map(fase4.filas.map((f) => [f.id, f.base.medianaUsadoUFm2]));
  const porId = new Map(base.filas.map((f) => [f.id, f]));
  log(`config: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} %`);
  const activas = await universoActivo(sb);
  const reactivadas: FilaUniverso[] = completo.filas.map((f) => ({ ...(f.evaluacion as unknown as FilaUniverso), aviso_id: f.id, precio_uf: f.evaluacion.precio_uf, sp: f.sp }));
  const filas = [...activas, ...reactivadas].slice(0, TOPE);
  log(`filas: ${fmt(filas.length)}`);

  const cacheRadio = new Map<string, { precioM2CLP: number | null; source: string; n: number }>();
  let consultas = 0;
  const salida: FilaAnexo[] = [];
  const t0 = Date.now();
  let i = 0;
  for (const f of filas) {
    i++;
    const b = porId.get(f.aviso_id);
    const limpio = b ? !b.sospechoso && !b.degradado && b.arriendo > 0 : !f.arriendo_sospechoso && !f.radio_degradado && !!f.arriendo;
    if (!limpio || !f.arriendo) continue;
    const clave = `${f.comuna}|${f.condicion}|${Number(f.sp.dormitorios)}|${Number(f.sp.superficie_m2)}`;
    const opts = b?.sup0 ? { ctxPatch: { ggccSugerido: null }, medianaComuna: celdas[clave] ?? null } : {};
    const r = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, opts));
    if (!r) continue;
    const m2 = Number(f.sp.superficie_m2), dorms = Number(f.sp.dormitorios);
    // El valor hoy como usado, por el método del motor.
    let usadoUFm2: number | null = null, fuente: FilaAnexo["fuente"] = "ninguno", nComp = 0;
    if (f.condicion === "usado") {
      const v = f.venta;
      if (v?.fuente === "radio" && v.precioM2UF) { usadoUFm2 = v.precioM2UF; fuente = "radio"; nComp = v.n; }
    } else {
      const k = `${Number(f.sp.lat).toFixed(5)}|${Number(f.sp.lng).toFixed(5)}|${dorms}|${m2}`;
      if (!cacheRadio.has(k)) {
        const s = await getSugerencias(f.comuna, m2, dorms, f.precio_uf, Number(f.sp.lat), Number(f.sp.lng), 800, "venta", "usado").catch(() => null);
        cacheRadio.set(k, { precioM2CLP: s && typeof s.precioM2 === "number" ? s.precioM2 : null, source: s?.source ?? "error", n: Number(s?.sampleSize) || 0 });
        consultas++;
        await new Promise((res) => setTimeout(res, PAUSA_MS));
      }
      const c = cacheRadio.get(k)!;
      if (c.source === "radio" && c.precioM2CLP) { usadoUFm2 = c.precioM2CLP / cfg.uf; fuente = "radio"; nComp = c.n; }
    }
    if (usadoUFm2 == null) { const m = celdaUsado.get(f.aviso_id); if (m) { usadoUFm2 = m; fuente = "celda"; } }
    const input = r.body as unknown as AnalisisInput;
    const valorHoyCLP = usadoUFm2 ? usadoUFm2 * m2 * cfg.uf : null;
    const r1 = valorHoyCLP ? exitValorMercado(input, r, proyeccionConG(input, r, cfg, asOf, 0.01), valorHoyCLP * Math.pow(1.01, HORIZONTE), cfg.uf) : null;
    const r3 = valorHoyCLP ? exitValorMercado(input, r, proyeccionConG(input, r, cfg, asOf, 0.03), valorHoyCLP * Math.pow(1.03, HORIZONTE), cfg.uf) : null;
    const tm = r.resultado.exitScenario.tir as { tipo?: string; valor?: number } | number;
    const e = f.condicion === "nuevo" ? parsearFechaEntrega(f.sp.fecha_entrega, asOf) : null;
    salida.push({
      id: f.aviso_id, cond: f.condicion, comuna: f.comuna, entrega: !e ? "sin dato" : e.inmediata ? "inmediata" : e.anio != null ? "futura" : "sin dato", precioUF: f.precio_uf, m2, dorms,
      v: r.veredicto, flujo: r.flujo, gate1: evalGate1Brazos(r.resultado.metrics, r.resultado.breakEvenTasa),
      usadoUFm2, fuente, nComparables: nComp, valorUsadoHoyUF: usadoUFm2 ? Math.round(usadoUFm2 * m2) : null,
      salidaMotorUF: Math.round(r.resultado.exitScenario.precioVentaEsperado / cfg.uf), salidaUsado3UF: usadoUFm2 ? Math.round(usadoUFm2 * m2 * Math.pow(1.03, HORIZONTE)) : null, salidaUsado1UF: usadoUFm2 ? Math.round(usadoUFm2 * m2 * Math.pow(1.01, HORIZONTE)) : null,
      tirMotor: typeof tm === "number" ? tm : tm?.tipo === "valor" ? Number(tm.valor) : null, r1, r3,
    });
    if (i % 1000 === 0) { log(`${fmt(i)} / ${fmt(filas.length)} · consultas de radio ${consultas} · ${((Date.now() - t0) / 60000).toFixed(1)} min`); writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas: salida })); }
  }
  writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas: salida }));
  const n = salida.filter((f) => f.cond === "nuevo");
  log(`listo: ${fmt(salida.length)} filas (nuevos ${fmt(n.length)}: radio ${n.filter((f) => f.fuente === "radio").length} · celda ${n.filter((f) => f.fuente === "celda").length} · ninguno ${n.filter((f) => f.fuente === "ninguno").length}; usados radio ${salida.filter((f) => f.cond === "usado" && f.fuente === "radio").length}) · ${consultas} consultas · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("14-anexo-salida.ts")) main().catch((e) => { console.error(e); process.exit(1); });
