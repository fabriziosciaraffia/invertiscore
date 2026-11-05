// ─────────────────────────────────────────────────────────────────────────────
// FASE 0 · ¿Cuánto pesa la superficie perdida? Las filas cuyo m² tiene dos decimales (1.515 nuevos y 217 usados activos)
// entraron al motor con superficie 0: `respuestasDeAviso` escribe el m² con dos decimales («51,46») y el campo de
// superficie del wizard admite uno (DEC.superficie = 1), así que `leerNum` lo lee como 0. Con 0 m², la mediana comunal y
// el cap de referencia se resuelven sobre una ventana de 0 a 0 m² (n = 0 → sin mediana, nivel bdo), los gastos comunes
// quedan en 0 y lo que el motor calcula por m² (mantención, CapEx, DFL2) sale sin superficie.
//
// Sobre la MUESTRA del instrumento (las filas con superficie 0 de los 300), tres cuentas con el motor real:
//   a) como está guardada (reproduce la fila);
//   b) con el m² redondeado a un decimal (lo que el wizard aceptaría) y la mediana guardada (vacía);
//   c) con el m² y la mediana comunal + cap de referencia resueltos en vivo con la MISMA función de la pasada
//      (prefetchMedianaComunaVenta), de a una y con pausa. Solo lectura.
//   node … scripts/analisis/motor-nuevos/0b-superficie.ts   (lee out/0-instrumento-<SEMILLA>.json)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cliente, leerConfig, universoActivo, evaluarConMotor, tablaMd, fmt, type FilaUniverso } from "./comun";
import { configDeEvaluacion, precargarUf } from "./uf-historica";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";

const SEMILLA = Number(process.env.SEMILLA ?? 20261105);
const PAUSA_MS = 150;
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith("[calcIRR]")) warnOriginal(...a); };

/** El m² con un decimal: lo único que cambia respecto de la fila guardada. */
function conSuperficieLegible(f: FilaUniverso): FilaUniverso {
  return { ...f, sp: { ...f.sp, superficie_m2: Math.round(Number(f.sp.superficie_m2) * 10) / 10 } };
}

async function main() {
  const sb = cliente();
  const cfgHoy = await leerConfig(sb);
  const inst = JSON.parse(readFileSync(`scripts/analisis/motor-nuevos/out/0-instrumento-${SEMILLA}.json`, "utf8")) as { comparaciones: Array<{ aviso_id: string; pie: number; superficieBody: unknown }> };
  const ids = new Set(inst.comparaciones.filter((c) => c.pie === 20 && Number(c.superficieBody) === 0).map((c) => c.aviso_id));
  const universo = await universoActivo(sb);
  const filas = universo.filter((f) => ids.has(f.aviso_id));
  console.log(`filas con superficie 0 en la muestra: ${filas.length} (usados ${filas.filter((f) => f.condicion === "usado").length}, nuevos ${filas.filter((f) => f.condicion === "nuevo").length})`);
  await precargarUf(filas.map((f) => f.evaluado_at));

  type R = { v: string | null; s: number | null; f: number | null; gastos: number; mediana: number | null; nivel: string | null };
  const res: Array<{ id: string; cond: string; comuna: string; m2: number; a: R; b: R; c: R }> = [];
  const leer = (r: ReturnType<typeof evaluarConMotor>, mediana: unknown): R => {
    const m = (mediana ?? {}) as { mediana?: number | null; capRefComuna?: { nivel?: string } };
    return { v: r?.veredicto ?? null, s: r?.score ?? null, f: r?.flujo ?? null, gastos: Number(r?.body.gastos ?? 0), mediana: m.mediana ?? null, nivel: m.capRefComuna?.nivel ?? null };
  };
  for (const f of filas) {
    const cfg = await configDeEvaluacion(f.evaluado_at);
    const a = evaluarConMotor(f, cfg, 20, { congelarHoy: true });
    const fb = conSuperficieLegible(f);
    // Los gastos comunes guardados (0) son lo que el m² = 0 produjo; con el m² correcto la pasada los habría estimado
    // por comuna y m² (getGgccFallback: la sugerencia de la zona siempre viene vacía), así que acá no se reutilizan.
    const sinGgcc = { ctxPatch: { ggccSugerido: null } };
    const b = evaluarConMotor(fb, cfg, 20, { congelarHoy: true, ...sinGgcc });
    // c) la mediana y el cap de referencia como los habría resuelto la pasada con el m² correcto (datos de hoy).
    const mediana = await prefetchMedianaComunaVenta(sb as never, b!.body as never, cfgHoy.uf).catch(() => null);
    const c = evaluarConMotor(fb, cfg, 20, { congelarHoy: true, medianaComuna: mediana, ...sinGgcc });
    res.push({ id: f.aviso_id, cond: f.condicion, comuna: f.comuna, m2: Number(f.sp.superficie_m2), a: leer(a, f.mediana_comuna), b: leer(b, f.mediana_comuna), c: leer(c, mediana) });
    await new Promise((r) => setTimeout(r, PAUSA_MS));
  }

  const cuenta = (xs: typeof res, k: "a" | "b" | "c", v: string) => xs.filter((x) => x[k].v === v).length;
  for (const cond of ["nuevo", "usado"]) {
    const xs = res.filter((x) => x.cond === cond);
    if (!xs.length) continue;
    console.log(`\n${cond} (n = ${xs.length}), pie 20 %, 30 años:`);
    console.log(tablaMd(["cuenta", "Comprar", "Ajustar", "Buscar otro", "flujo mediano", "gastos comunes medianos", "con mediana comunal", "nivel celda/comuna"], (["a", "b", "c"] as const).map((k) => [
      { a: "a) como está guardada (m² = 0)", b: "b) m² correcto, mediana vacía", c: "c) m² correcto, mediana y cap en vivo" }[k],
      cuenta(xs, k, "COMPRAR"), cuenta(xs, k, "AJUSTA SUPUESTOS"), cuenta(xs, k, "BUSCAR OTRA"),
      fmt(medianaDe(xs.map((x) => x[k].f ?? NaN))), fmt(medianaDe(xs.map((x) => x[k].gastos))),
      xs.filter((x) => x[k].mediana != null).length, xs.filter((x) => x[k].nivel === "celda" || x[k].nivel === "comuna").length,
    ])));
    const cambios = new Map<string, number>();
    for (const x of xs) { const k = `${x.a.v} → ${x.c.v}`; cambios.set(k, (cambios.get(k) ?? 0) + 1); }
    console.log("de a) a c): " + [...cambios.entries()].sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k}: ${n}`).join(" · "));
    const dScore = xs.map((x) => (x.c.s ?? 0) - (x.a.s ?? 0));
    console.log(`Δ puntaje c − a: mediana ${fmt(medianaDe(dScore))} · min ${Math.min(...dScore)} · max ${Math.max(...dScore)}`);
  }
}

function medianaDe(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : NaN;
}

main().catch((e) => { console.error(e); process.exit(1); });
