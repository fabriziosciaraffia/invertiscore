// ─────────────────────────────────────────────────────────────────────────────
// FASE 0.4 · El instrumento: ¿reproduce el motor real, con los insumos guardados, lo que la pasada nocturna dejó
// en avisos_evaluados? 300 avisos activos (150 usados y 150 nuevos, al azar con semilla fija), pie 20 % y 30 %,
// 30 años. Tiene que calzar veredicto, puntaje y flujo. Solo lectura.
//
//   SEMILLA=20261105 N=150 node … scripts/analisis/motor-nuevos/0-instrumento.ts
//   ASOF=hoy      → fecha de análisis «hoy» en vez de evaluado_at (para medir cuánto pesa la fecha)
//   UF=41274 TASA=4.07 → forzar la UF o la tasa del cálculo (por defecto, las de config)
//   HOY=libre     → no congelar «hoy» en evaluado_at (las cuotas del pie por defecto de una entrega futura se cuentan desde hoy)
//   CONFIG=hoy    → evaluar todo con la UF y la tasa de hoy; por defecto, las del día de evaluación de cada fila
//                   (uf-historica.ts): sin eso el flujo no calza al peso, porque la UF cambia todos los días
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from "node:fs";
import { cliente, leerConfig, universoActivo, evaluarConMotor, muestraConSemilla, tablaMd, fmt, type Config, type FilaUniverso } from "./comun";
import { configDeEvaluacion, precargarUf } from "./uf-historica";

const SEMILLA = Number(process.env.SEMILLA ?? 20261105);
const N = Number(process.env.N ?? 150);
const ASOF_HOY = process.env.ASOF === "hoy";
const CONFIG_HOY = process.env.CONFIG === "hoy" || !!process.env.UF || !!process.env.TASA;
// «Hoy» congelado en evaluado_at (las cuotas del pie de una entrega futura se cuentan desde hoy); HOY=libre lo apaga.
const CONGELAR_HOY = process.env.HOY !== "libre";
// Las advertencias del solver de TIR ([calcIRR] flujo no convencional) no son de este goal: fuera del log.
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

type Pie = 20 | 30;
interface Comparacion {
  aviso_id: string; condicion: string; comuna: string; pie: Pie; evaluado_at: string;
  guardado: { v: string | null; s: number | null; f: number | null };
  motor: { v: string | null; s: number | null; f: number | null };
  superficieBody: unknown; gastosBody: unknown;
  calza: { v: boolean; s: boolean; f: boolean };
}

async function main() {
  const sb = cliente();
  const cfg = await leerConfig(sb);
  if (process.env.UF) cfg.uf = Number(process.env.UF);
  if (process.env.TASA) cfg.tasa = Number(process.env.TASA);
  console.log(`config de hoy: UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · semilla ${SEMILLA} · asOf ${ASOF_HOY ? "hoy" : "evaluado_at"} · UF y tasa ${CONFIG_HOY ? "de hoy" : "del día de evaluación"} · hoy ${CONGELAR_HOY && !ASOF_HOY ? "congelado en evaluado_at" : "libre"}`);

  const t0 = Date.now();
  const universo = await universoActivo(sb);
  console.log(`universo: ${fmt(universo.length)} avisos activos en venta con evaluación (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  const conResultado = universo.filter((f) => f.arriendo && f.veredicto_20 != null);
  const usados = conResultado.filter((f) => f.condicion === "usado");
  const nuevos = conResultado.filter((f) => f.condicion === "nuevo");
  console.log(`con arriendo y veredicto: usados ${fmt(usados.length)} · nuevos ${fmt(nuevos.length)} (sin veredicto: ${fmt(universo.length - conResultado.length)})`);

  const muestra = [...muestraConSemilla(usados, N, SEMILLA), ...muestraConSemilla(nuevos, N, SEMILLA + 1)];
  if (!CONFIG_HOY) await precargarUf(muestra.map((f) => f.evaluado_at));
  const comparaciones: Comparacion[] = [];
  for (const f of muestra) {
    const cfgFila: Config = CONFIG_HOY ? cfg : await configDeEvaluacion(f.evaluado_at);
    for (const pie of [20, 30] as Pie[]) {
      const r = evaluarConMotor(f, cfgFila, pie, { ...(ASOF_HOY ? { asOf: new Date() } : {}), congelarHoy: CONGELAR_HOY && !ASOF_HOY });
      const g = { v: f[`veredicto_${pie}`], s: f[`score_${pie}`], f: f[`flujo_${pie}`] };
      const m = r ? { v: r.veredicto, s: r.score, f: r.flujo } : { v: null, s: null, f: null };
      comparaciones.push({
        aviso_id: f.aviso_id, condicion: f.condicion, comuna: f.comuna, pie, evaluado_at: f.evaluado_at,
        guardado: g, motor: m,
        superficieBody: r?.body.superficie, gastosBody: r?.body.gastos,
        calza: { v: g.v === m.v, s: g.s === m.s, f: g.f === m.f },
      });
    }
  }

  const resumen = (xs: Comparacion[]) => ({
    n: xs.length,
    v: xs.filter((c) => c.calza.v).length,
    s: xs.filter((c) => c.calza.s).length,
    f: xs.filter((c) => c.calza.f).length,
    todo: xs.filter((c) => c.calza.v && c.calza.s && c.calza.f).length,
  });
  const filas: (string | number)[][] = [];
  for (const cond of ["usado", "nuevo"]) for (const pie of [20, 30]) {
    const xs = comparaciones.filter((c) => c.condicion === cond && c.pie === pie);
    const r = resumen(xs);
    filas.push([cond, `pie ${pie} %`, r.n, r.v, r.s, r.f, r.todo]);
  }
  const total = resumen(comparaciones);
  filas.push(["total", "", total.n, total.v, total.s, total.f, total.todo]);
  console.log("\n" + tablaMd(["condición", "perfil", "comparaciones", "veredicto calza", "puntaje calza", "flujo calza", "las tres"], filas));

  const fallas = comparaciones.filter((c) => !(c.calza.v && c.calza.s && c.calza.f));
  if (fallas.length) {
    console.log(`\n${fallas.length} comparaciones no calzan. Primeras 40:`);
    console.log(tablaMd(
      ["aviso", "cond", "comuna", "pie", "evaluado", "veredicto guardado → motor", "puntaje", "flujo", "superficie body", "gastos body"],
      fallas.slice(0, 40).map((c) => [
        c.aviso_id.slice(0, 8), c.condicion, c.comuna, c.pie, c.evaluado_at.slice(0, 10),
        `${c.guardado.v} → ${c.motor.v}`, `${c.guardado.s} → ${c.motor.s}`, `${fmt(c.guardado.f)} → ${fmt(c.motor.f)}`,
        String(c.superficieBody), String(c.gastosBody),
      ]),
    ));
    // Qué tan lejos: distribución de las diferencias de puntaje y de flujo.
    const ds = fallas.map((c) => (c.motor.s ?? 0) - (c.guardado.s ?? 0));
    const df = fallas.map((c) => (c.motor.f ?? 0) - (c.guardado.f ?? 0));
    console.log(`\nΔ puntaje (motor − guardado): min ${Math.min(...ds)} · max ${Math.max(...ds)} · |Δ|≤1: ${ds.filter((d) => Math.abs(d) <= 1).length}`);
    console.log(`Δ flujo (motor − guardado): min ${fmt(Math.min(...df))} · max ${fmt(Math.max(...df))} · |Δ|≤1.000: ${df.filter((d) => Math.abs(d) <= 1000).length}`);
    const porDia = new Map<string, number>();
    for (const c of fallas) porDia.set(c.evaluado_at.slice(0, 10), (porDia.get(c.evaluado_at.slice(0, 10)) ?? 0) + 1);
    console.log("fallas por día de evaluación: " + [...porDia.entries()].sort().map(([d, n]) => `${d}: ${n}`).join(" · "));
  }

  // Cuántas filas de la muestra llegaron al motor con superficie 0 (el hallazgo de la FASE 0.2).
  const sup0 = comparaciones.filter((c) => c.pie === 20 && Number(c.superficieBody) === 0);
  console.log(`\nfilas de la muestra cuyo body tiene superficie 0: ${sup0.length} de ${muestra.length} (usados ${sup0.filter((c) => c.condicion === "usado").length}, nuevos ${sup0.filter((c) => c.condicion === "nuevo").length})`);

  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  const salida = `scripts/analisis/motor-nuevos/out/0-instrumento-${SEMILLA}${ASOF_HOY ? "-asof-hoy" : ""}${CONFIG_HOY ? "-config-hoy" : ""}.json`;
  writeFileSync(salida, JSON.stringify({ cfg, semilla: SEMILLA, n: N, asOf: ASOF_HOY ? "hoy" : "evaluado_at", muestra: muestra.map((f: FilaUniverso) => f.aviso_id), comparaciones }, null, 1));
  console.log(`guardado en ${salida}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
