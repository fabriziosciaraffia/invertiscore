// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · LA LÍNEA BASE CORREGIDA (decisión de Fabrizio, 05-nov-2026). Para TODOS los avisos activos en venta con
// evaluación, pie 20 %, 30 años, con la UF y la tasa de HOY (lo que «convienen» significa hoy):
//   0a) los insumos guardados tal cual (superficie 0 incluida): aísla el efecto de la UF y la tasa frente a lo guardado;
//   0b) la superficie legible con dos decimales, los gastos comunes por el estimador de comuna y m² (la sugerencia de la
//       zona siempre viene vacía) y la mediana comunal + cap de referencia resueltos EN VIVO con la función de la pasada
//       (prefetchMedianaComunaVenta), de a una y con pausa, con caché por celda (comuna, condición, dormitorios, m²).
//       Para las filas sin el error, 0b = 0a y la mediana es la guardada.
// Guarda por fila: lo guardado, 0a, 0b, la mediana (n, mediana, nivel del cap) y los brazos del GATE 1 de 0b; y aparte las
// medianas resueltas por celda (out/1-medianas-celda.json), que los escenarios reutilizan sin volver a consultar.
// Solo lectura. Salida: out/1-base-corregida.json (la base de los escenarios 1.1 a 1.4).
//   node … scripts/analisis/motor-nuevos/1-base-corregida.ts      (TOPE=200 para probar)
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { cliente, leerConfig, universoActivo, evaluarConMotor, conSuperficieDosDecimales, fmt, tipoEntrega } from "./comun";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { evalGate1Brazos } from "../../../src/lib/analysis";

const TOPE = Number(process.env.TOPE ?? Infinity);
const PAUSA_MS = 120;
const SALIDA = "scripts/analisis/motor-nuevos/out/1-base-corregida.json";
const LOG = "scripts/analisis/motor-nuevos/out/1-base-corregida.log";
/** Las medianas resueltas en vivo, por celda, para que los escenarios no vuelvan a consultarlas. */
const CELDAS = "scripts/analisis/motor-nuevos/out/1-medianas-celda.json";
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

export interface Cuenta { v: string | null; s: number | null; f: number | null }
export interface MedianaInfo { n: number; mediana: number | null; nivelCap: string | null; nVentaCap: number | null; nArrCap: number | null; universo: string | null }
export interface Gate1 { cocSevero: boolean; breakEvenImposible: boolean; sobreprecioComunalConFlujo: boolean; flujoSevero: boolean }
export interface FilaBase {
  id: string; cond: "usado" | "nuevo"; comuna: string; entrega: "inmediata" | "futura" | "sin dato"; dorms: number; m2: number;
  precioUF: number; arriendo: number; sospechoso: boolean; degradado: boolean; sup0: boolean;
  guardado: Cuenta; a: Cuenta; b: Cuenta;
  mediana: MedianaInfo; gate1: Gate1;
  /** precio/m² del depto sobre la mediana comunal, en % (metrics.precioVsComuna.desviacionPct de 0b), null si no confiable. */
  desvPct: number | null; confiable: boolean; gastosB: number;
}

const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

function medianaDe(m: unknown): MedianaInfo {
  const x = (m ?? {}) as { n?: number; mediana?: number | null; universo?: string; capRefComuna?: { nivel?: string; nVenta?: number; nArriendo?: number } };
  return { n: Number(x.n ?? 0), mediana: x.mediana ?? null, nivelCap: x.capRefComuna?.nivel ?? null, nVentaCap: x.capRefComuna?.nVenta ?? null, nArrCap: x.capRefComuna?.nArriendo ?? null, universo: x.universo ?? null };
}

async function main() {
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync(LOG, "");
  const sb = cliente();
  const cfg = await leerConfig(sb);
  log(`config de hoy: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} %`);
  const t0 = Date.now();
  const universo = (await universoActivo(sb)).slice(0, TOPE);
  log(`universo: ${fmt(universo.length)} filas (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

  const cacheMediana = new Map<string, unknown>();
  let consultas = 0;
  const filas: FilaBase[] = [];
  let i = 0;
  for (const f of universo) {
    i++;
    const guardado: Cuenta = { v: f.veredicto_20, s: f.score_20, f: f.flujo_20 };
    const base: Omit<FilaBase, "a" | "b" | "mediana" | "gate1" | "desvPct" | "confiable" | "gastosB" | "sup0"> = {
      id: f.aviso_id, cond: f.condicion, comuna: f.comuna, entrega: tipoEntrega(f.entrega), dorms: Number(f.sp.dormitorios), m2: Number(f.sp.superficie_m2),
      precioUF: f.precio_uf, arriendo: f.arriendo?.monto ?? 0, sospechoso: !!f.arriendo_sospechoso, degradado: !!f.radio_degradado, guardado,
    };
    const ra = evaluarConMotor(f, cfg, 20);
    const a: Cuenta = ra ? { v: ra.veredicto, s: ra.score, f: ra.flujo } : { v: null, s: null, f: null };
    const sup0 = !!ra && Number(ra.body.superficie) === 0;
    let rb = ra;
    let medianaB: unknown = f.mediana_comuna;
    if (sup0) {
      // El body con la superficie entera, para pedir la mediana con la celda correcta; después el motor con esa mediana.
      const sinGgcc = { ctxPatch: { ggccSugerido: null } };
      const bodyB = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, sinGgcc))!.body;
      const clave = `${f.comuna}|${f.condicion}|${base.dorms}|${base.m2}`;
      if (!cacheMediana.has(clave)) {
        consultas++;
        const m = await prefetchMedianaComunaVenta(sb as never, bodyB as never, cfg.uf).catch((e) => { log(`mediana falló ${f.aviso_id}: ${String(e).slice(0, 120)}`); return null; });
        cacheMediana.set(clave, m);
        await new Promise((r) => setTimeout(r, PAUSA_MS));
      }
      medianaB = cacheMediana.get(clave);
      rb = conSuperficieDosDecimales(() => evaluarConMotor(f, cfg, 20, { ...sinGgcc, medianaComuna: medianaB }));
    }
    const b: Cuenta = rb ? { v: rb.veredicto, s: rb.score, f: rb.flujo } : { v: null, s: null, f: null };
    const gate1: Gate1 = rb ? evalGate1Brazos(rb.resultado.metrics, rb.resultado.breakEvenTasa) : { cocSevero: false, breakEvenImposible: false, sobreprecioComunalConFlujo: false, flujoSevero: false };
    const pvc = rb?.resultado.metrics.precioVsComuna as { confiable?: boolean; desviacionPct?: number } | null | undefined;
    filas.push({ ...base, sup0, a, b, mediana: medianaDe(medianaB), gate1, desvPct: pvc?.confiable && typeof pvc.desviacionPct === "number" ? pvc.desviacionPct : null, confiable: !!pvc?.confiable, gastosB: Number(rb?.body.gastos ?? 0) });
    if (i % 500 === 0 || i === universo.length) {
      log(`${fmt(i)} / ${fmt(universo.length)} · consultas en vivo ${consultas} (celdas distintas) · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
      writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas }));
      writeFileSync(CELDAS, JSON.stringify(Object.fromEntries(cacheMediana)));
    }
  }
  writeFileSync(CELDAS, JSON.stringify(Object.fromEntries(cacheMediana)));
  writeFileSync(SALIDA, JSON.stringify({ cfg, calculadoAt: new Date().toISOString(), filas }));
  log(`listo: ${fmt(filas.length)} filas, ${consultas} celdas resueltas en vivo, guardado en ${SALIDA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
