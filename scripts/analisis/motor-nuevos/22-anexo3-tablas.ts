// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 3 · QUÉ ES COMPRAR: las tablas de la regla A (lee out/18-salida-ingreso.json y out/21-resguardo.json). Solo lectura.
//   Regla A: Comprar si la TIR por ingreso con g = 0 % y cap de hoy es ≥ 5 % y el flujo no es peor que −5 % del arriendo.
//   Con resguardo: la misma, con el valor de salida por ingreso limitado a 1,10 veces el valor por comparables usados del radio.
//   Variantes: TIR mínima 4, 5 y 6 %; flujo dentro de la vara (≥ −5 % del arriendo) o flujo ≥ −$200.000.
//   Por universo (nuevos / usados), con y sin resguardo: cuántos Comprar, cuántos Comprar de hoy se caen y cuántos Ajustar de
//   hoy entran, en total y por comuna; y dos listas: los 20 usados Comprar de hoy con la TIR más baja y los 20 Ajustar de hoy
//   con la TIR más alta (g 0 %, cap de hoy).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fmt, tablaMd, type Config } from "./comun";
import type { FilaIngreso } from "./18-salida-ingreso";
import type { Resguardo } from "./21-anexo3-resguardo";

const DIR = "scripts/analisis/motor-nuevos/out";
const TIRS = [4, 5, 6];
type Flujo = "vara" | "200";
const FLUJOS: Flujo[] = ["vara", "200"];
const ROT_FLUJO: Record<Flujo, string> = { vara: "flujo ≥ −5 % del arriendo", "200": "flujo ≥ −$200.000" };
interface Combo { tir: number; flujo: Flujo }
const COMBOS: Combo[] = FLUJOS.flatMap((flujo) => TIRS.map((tir) => ({ tir, flujo })));
const rotCombo = (c: Combo) => `TIR ≥ ${c.tir} %, ${c.flujo === "vara" ? "vara" : "−$200.000"}`;

const rel = (f: FilaIngreso) => (f.flujo != null && f.ingreso != null && f.ingreso > 0 ? f.flujo / f.ingreso : null);
const pasaFlujo = (f: FilaIngreso, fl: Flujo) => (fl === "vara" ? (rel(f) ?? -Infinity) >= -0.05 : f.flujo != null && f.flujo >= -200000);
const pf = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x, d) + " %");

function main() {
  const { filas, cfg } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: Config; filas: FilaIngreso[] };
  const { resguardo, tope } = JSON.parse(readFileSync(`${DIR}/21-resguardo.json`, "utf8")) as { tope: number; resguardo: Record<string, Resguardo> };
  const regs = Object.values(resguardo);
  const nOk = regs.filter((r) => r.estado === "ok").length, nNoRep = regs.filter((r) => r.estado !== "ok").length;

  /** TIR g 0 % con resguardo: la guardada si el tope no muerde; la recalculada si muerde y la fila se reprodujo; si no se
   *  reprodujo (fila reevaluada o dada de baja desde la corrida), la ESTIMADA: con g 0 % hay dos salidas guardadas del mismo
   *  vector de flujos (cap de hoy y cap + 50 pb), y la TIR se interpola en el logaritmo del valor de salida hasta el tope.
   *  La estimación se valida abajo contra las recalculadas exactas. */
  const estimada = (f: FilaIngreso, topeUF: number): number | null => {
    const vh = f.valorUF.g0h, vm = f.valorUF.g0m, th = f.tir.g0h, tm = f.tir.g0m;
    if (vh == null || vm == null || th == null || tm == null || !(vh > vm)) return null;
    return th + ((Math.log(topeUF) - Math.log(vh)) * (th - tm)) / (Math.log(vh) - Math.log(vm));
  };
  const tirCon = (f: FilaIngreso): { t: number | null; incierta: boolean } => {
    const r = resguardo[f.id];
    if (!r) return { t: f.tir.g0h ?? null, incierta: false };
    if (r.estado === "ok") return { t: r.tirConTope, incierta: false };
    return { t: estimada(f, r.topeUF), incierta: true };
  };
  const comprar = (f: FilaIngreso, c: Combo, conResguardo: boolean) => {
    const t = conResguardo ? tirCon(f).t : f.tir.g0h ?? null;
    return t != null && t >= c.tir && pasaFlujo(f, c.flujo);
  };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const conRadio = filas.filter((f) => resguardo[f.id] != null).length;
  console.log(`universo: ${fmt(filas.length)} avisos (nuevos ${fmt(nuevos.length)}, Comprar de hoy ${nuevos.filter((f) => f.v === "COMPRAR").length}; usados ${fmt(usados.length)}, Comprar de hoy ${fmt(usados.filter((f) => f.v === "COMPRAR").length)}) · UF ${fmt(cfg.uf)}`);
  console.log(`resguardo (valor por ingreso ≤ ${fmt(tope, 2)} × valor del radio): muerde en ${fmt(conRadio)} avisos (nuevos ${fmt(nuevos.filter((f) => resguardo[f.id]).length)}, usados ${fmt(usados.filter((f) => resguardo[f.id]).length)}); recalculados exactos ${fmt(nOk)}, estimados ${fmt(nNoRep)} (no reproducibles ${fmt(regs.filter((r) => r.estado === "no reproducible").length)}, sin fila ${fmt(regs.filter((r) => r.estado === "sin fila").length)})`);
  // Validación de la estimación contra las recalculadas exactas.
  const val = filas.filter((f) => resguardo[f.id]?.estado === "ok" && resguardo[f.id].tirConTope != null).map((f) => ({ f, exacta: resguardo[f.id].tirConTope!, est: estimada(f, resguardo[f.id].topeUF) })).filter((x) => x.est != null);
  const errs = val.map((x) => Math.abs(x.est! - x.exacta)).sort((a, b) => a - b);
  const qe = (p: number) => fmt(errs[Math.floor(p * (errs.length - 1))], 2);
  console.log(`validación de la estimación sobre ${fmt(val.length)} recalculados exactos: |error| mediano ${qe(0.5)} puntos, p90 ${qe(0.9)}, p99 ${qe(0.99)} (los errores grandes están en TIR muy negativas, lejos de los umbrales)`);
  console.log(tablaMd(["regla", "veredicto de la regla A con resguardo, exacta: Comprar", "estimada: Comprar", "coinciden", "Comprar exacta y no estimada", "Comprar estimada y no exacta"], COMBOS.map((c) => {
    const pasa = (t: number | null, f: FilaIngreso) => t != null && t >= c.tir && pasaFlujo(f, c.flujo);
    const a = val.filter((x) => pasa(x.exacta, x.f)), b = val.filter((x) => pasa(x.est, x.f));
    return [rotCombo(c), fmt(a.length), fmt(b.length), fmt(val.filter((x) => pasa(x.exacta, x.f) === pasa(x.est, x.f)).length), fmt(val.filter((x) => pasa(x.exacta, x.f) && !pasa(x.est, x.f)).length), fmt(val.filter((x) => !pasa(x.exacta, x.f) && pasa(x.est, x.f)).length)];
  })));

  // Resumen de una celda.
  const celda = (xs: FilaIngreso[], c: Combo, conR: boolean) => {
    const C = xs.filter((f) => comprar(f, c, conR));
    return {
      comprar: C.length,
      caen: xs.filter((f) => f.v === "COMPRAR" && !comprar(f, c, conR)).length,
      entranAjustar: xs.filter((f) => f.v === "AJUSTA SUPUESTOS" && comprar(f, c, conR)).length,
      entranBuscar: xs.filter((f) => f.v === "BUSCAR OTRA" && comprar(f, c, conR)).length,
      inciertos: conR ? C.filter((f) => tirCon(f).incierta).length : 0,
      gate1: C.filter((f) => f.gate1.cocSevero || f.gate1.sobreprecioComunalConFlujo || f.gate1.breakEvenImposible || f.gate1.flujoSevero).length,
      inm: C.filter((f) => f.entrega === "inmediata").length, fut: C.filter((f) => f.entrega === "futura").length,
    };
  };
  const txt = (r: ReturnType<typeof celda>) => `${fmt(r.comprar)} (−${fmt(r.caen)} / +${fmt(r.entranAjustar)})${r.inciertos ? ` [${fmt(r.inciertos)} est.]` : ""}`;

  // 1 · La grilla en total.
  console.log("\n1 · Regla A en total. Celda: Comprar (− Comprar de hoy que se caen / + Ajustar de hoy que entran); [est.] = Comprar con resguardo cuya TIR con tope es estimada (fila reevaluada o dada de baja desde la corrida)");
  console.log(tablaMd(["regla", "nuevos, sin resguardo", "nuevos, con resguardo", "usados, sin resguardo", "usados, con resguardo"], COMBOS.map((c) => [rotCombo(c), txt(celda(nuevos, c, false)), txt(celda(nuevos, c, true)), txt(celda(usados, c, false)), txt(celda(usados, c, true))])));
  console.log("\nDetalle de la celda: Buscar otra de hoy que entran, Comprar con algún brazo del gate 1 activo hoy, y nuevos Comprar por entrega (inmediata / futura)");
  console.log(tablaMd(["regla", "resguardo", "nuevos: Buscar otra que entran", "nuevos: con gate 1", "nuevos: inmediata / futura", "usados: Buscar otra que entran", "usados: con gate 1"], COMBOS.flatMap((c) => [false, true].map((conR) => {
    const n = celda(nuevos, c, conR), u = celda(usados, c, conR);
    return [rotCombo(c), conR ? "con" : "sin", fmt(n.entranBuscar), fmt(n.gate1), `${n.inm} / ${n.fut}`, fmt(u.entranBuscar), fmt(u.gate1)];
  }))));

  // 2 · Por comuna.
  const nNuevos = (c: string) => nuevos.filter((f) => f.comuna === c).length;
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, q) => nNuevos(q) - nNuevos(p) || usados.filter((f) => f.comuna === q).length - usados.filter((f) => f.comuna === p).length);
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    for (const conR of [false, true]) {
      const grupos: Array<[string, FilaIngreso[]]> = [["Gran Santiago", xs], ...comunas.map((c) => [c, xs.filter((f) => f.comuna === c)] as [string, FilaIngreso[]]).filter(([, g]) => g.length > 0)];
      console.log(`\n2 · Por comuna, ${u}, ${conR ? "con" : "sin"} resguardo. Celda: Comprar (− Comprar de hoy que se caen / + Ajustar de hoy que entran)`);
      console.log(tablaMd(["comuna", "avisos", "Comprar de hoy", ...COMBOS.map(rotCombo)], grupos.map(([c, g]) => [c, fmt(g.length), fmt(g.filter((f) => f.v === "COMPRAR").length), ...COMBOS.map((cb) => txt(celda(g, cb, conR)))])));
    }
  }

  // 3 · Las dos listas.
  const capEntrada = (f: FilaIngreso) => (f.arriendoHoyCLP / (f.precioUF * cfg.uf)) * 100;
  const filaLista = (f: FilaIngreso) => {
    const tc = tirCon(f);
    return [f.id.slice(0, 8), f.comuna, `${f.dorms}D · ${fmt(f.m2, f.m2 % 1 ? 1 : 0)} m²`, `UF ${fmt(f.precioUF)}`, `$${fmt(f.flujo)} (${pf((rel(f) ?? NaN) * 100)})`, pf(capEntrada(f), 2), `${pf(f.cap.cap, 2)}${f.cap.nivel === "comuna" ? " (comuna)" : ""}`, `${f.v} ${f.s ?? ""}`, f.tir.g0h == null ? "no calculable" : pf(f.tir.g0h), resguardo[f.id] ? (tc.t == null ? "no calculable" : `${pf(tc.t)}${tc.incierta ? " (est.)" : ""}`) : "= (el tope no muerde)"];
  };
  const cab = ["aviso", "comuna", "tipología", "precio", "flujo mensual (% del arriendo)", "cap de entrada", "cap de salida", "veredicto de hoy", "TIR g 0 %, cap de hoy", "con resguardo"];
  const uComp = usados.filter((f) => f.v === "COMPRAR" && f.cap.cap != null);
  const bajas = [...uComp].sort((p, q) => (p.tir.g0h ?? -Infinity) - (q.tir.g0h ?? -Infinity)).slice(0, 20);
  console.log(`\n3a · Los 20 usados Comprar de hoy con la TIR más baja (g 0 %, cap de hoy), de ${fmt(uComp.length)} con cap de salida (${uComp.filter((f) => f.tir.g0h == null).length} sin TIR calculable, que van primero):`);
  console.log(tablaMd(cab, bajas.map(filaLista)));
  const uAj = usados.filter((f) => f.v === "AJUSTA SUPUESTOS" && f.tir.g0h != null);
  const altas = [...uAj].sort((p, q) => q.tir.g0h! - p.tir.g0h!).slice(0, 20);
  console.log(`\n3b · Los 20 usados Ajustar de hoy con la TIR más alta (g 0 %, cap de hoy), de ${fmt(uAj.length)} con TIR:`);
  console.log(tablaMd(cab, altas.map(filaLista)));
  const nAj = nuevos.filter((f) => f.v === "AJUSTA SUPUESTOS" && f.tir.g0h != null);
  const altasN = [...nAj].sort((p, q) => q.tir.g0h! - p.tir.g0h!).slice(0, 20);
  console.log(`\n3c · Como referencia, los 20 nuevos Ajustar de hoy con la TIR más alta (g 0 %, cap de hoy), de ${fmt(nAj.length)} con TIR:`);
  console.log(tablaMd(cab, altasN.map(filaLista)));
}

main();
