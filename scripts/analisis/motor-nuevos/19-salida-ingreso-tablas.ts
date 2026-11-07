// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 2 · LAS TABLAS de la salida por ingreso (lee out/18-salida-ingreso.json, out/18-golden.json y, para la comparación,
// out/11-fase4.json y out/14-anexo-salida.json). Solo lectura.
//   3 · por universo (nuevos / usados): TIR mediana, p25 y p75 por escenario; cuántos pasan 4 a 8 % con el desglose en tres
//       tramos de flujo (≥ 0 · entre 0 y −5 % del ingreso, la vara del gate 2 · bajo −5 % del ingreso); nuevos por comuna e
//       inmediata/futura en el escenario base (g 3 %, cap de hoy); el escalón implícito (valor por ingreso de hoy ÷ precio)
//       y el premio de estreno por ingreso (precio − valor por ingreso de hoy), medianas por comuna; y los usados Comprar de
//       hoy que quedan con TIR ≥ 5 % y ≥ 6 % en cada escenario.
//   4 · la celda TIR ≥ 5 %, flujo ≥ −200.000 con la regla del anexo: salida del motor, como usado del radio e ingreso, lado
//       a lado, sobre los avisos presentes en las tres corridas.
//   5 · los tres casos del golden con sus seis TIR.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, fmt, mediana, pct, tablaMd } from "./comun";
import { ESCENARIOS, ROTULO, type Cap, type Escenario, type FilaIngreso } from "./18-salida-ingreso";
import type { FilaFase4 } from "./11-fase4";
import type { FilaAnexo } from "./14-anexo-salida";

const TIR_MIN = [4, 5, 6, 7, 8];
const CENTRAL = { tir: 5, tol: -200000 };
const VARA_GATE2 = -0.05;
const DIR = "scripts/analisis/motor-nuevos/out";

const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null && Number.isFinite(x)));
const q = (xs: (number | null | undefined)[], p: number) => cuantil(xs.filter((x): x is number => x != null && Number.isFinite(x)), p);
const pf = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : fmt(x * 100, 1) + " %");
const grave = (g: FilaIngreso["gate1"]) => g.cocSevero || g.sobreprecioComunalConFlujo;
/** La regla del anexo: Buscar otra solo por señal grave; Comprar con flujo ≥ tolerancia y TIR ≥ mínima; el resto Ajustar. */
const comprar = (flujo: number | null, g: FilaIngreso["gate1"], tir: number | null | undefined, tirMin: number, tol: number) =>
  !grave(g) && flujo != null && flujo >= tol && tir != null && tir >= tirMin;
/** Tramo de flujo: 0 = flujo ≥ 0 · 1 = entre 0 y −5 % del ingreso · 2 = bajo −5 % del ingreso (−1 sin dato). */
function tramo(f: FilaIngreso): number {
  if (f.flujo == null) return -1;
  if (f.flujo >= 0) return 0;
  if (f.ingreso != null && f.ingreso > 0 && f.flujo / f.ingreso >= VARA_GATE2) return 1;
  return 2;
}
const porComuna = (xs: FilaIngreso[]) => [...new Set(xs.map((f) => f.comuna))].sort((p, r) => xs.filter((f) => f.comuna === r).length - xs.filter((f) => f.comuna === p).length);
const grupos = (xs: FilaIngreso[]): Array<[string, FilaIngreso[]]> => [["Gran Santiago", xs], ...porComuna(xs).map((c) => [c, xs.filter((f) => f.comuna === c)] as [string, FilaIngreso[]])];

function main() {
  const { filas, cfg, caps } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: { uf: number; tasa: number }; caps: Record<string, Cap>; filas: FilaIngreso[] };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const hoy = usados.filter((f) => f.v === "COMPRAR");
  console.log(`universo: ${fmt(filas.length)} avisos · nuevos ${fmt(nuevos.length)} (Comprar del motor ${nuevos.filter((f) => f.v === "COMPRAR").length}) · usados ${fmt(usados.length)} (Comprar ${fmt(hoy.length)}) · UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} %`);
  console.log(`cap de salida: celda comuna × dormitorios (usado) en ${fmt(filas.filter((f) => f.cap.nivel === "celda").length)} avisos · respaldo de la comuna en ${fmt(filas.filter((f) => f.cap.nivel === "comuna").length)} (nuevos ${nuevos.filter((f) => f.cap.nivel === "comuna").length}) · sin cap ${filas.filter((f) => f.cap.cap == null).length} · cap mediano de los avisos: nuevos ${fmt(med(nuevos.map((f) => f.cap.cap)), 2)} %, usados ${fmt(med(usados.map((f) => f.cap.cap)), 2)} %`);

  // El cap por celda, por comuna.
  const comunasTodas = [...new Set(filas.map((f) => f.comuna))].sort((p, r) => filas.filter((f) => f.comuna === r).length - filas.filter((f) => f.comuna === p).length);
  const capTxt = (c: Cap | undefined) => (!c || c.cap == null ? "—" : `${fmt(c.cap, 2)}${c.nivel === "comuna" ? " (comuna)" : ""} · ${c.nArr}/${c.nVenta}`);
  console.log("\nCap bruto de salida por celda (usado; mediana arriendo UF/m²/mes × 12 ÷ mediana venta UF/m²; n arriendo/n venta; «comuna» = respaldo de la comuna):");
  console.log(tablaMd(["comuna", "avisos", "1D", "2D", "3D", "4D"], comunasTodas.map((c) => [c, filas.filter((f) => f.comuna === c).length, ...[1, 2, 3, 4].map((d) => capTxt(caps[`${c}|${d}`]))])));

  // 3a · TIR por escenario.
  console.log("\n3a · TIR a 10 años con salida por ingreso, por escenario (mediana · p25 · p75; n con TIR):");
  console.log(tablaMd(["universo", "escenario", "n con TIR", "TIR mediana", "p25", "p75", "valor de salida UF mediana", "TIR del motor (mediana)"], (["nuevos", "usados"] as const).flatMap((u) => {
    const xs = u === "nuevos" ? nuevos : usados;
    return ESCENARIOS.map((e) => { const t = xs.map((f) => f.tir[e]); return [u, ROTULO[e], t.filter((x) => x != null).length, fmt(med(t), 1), fmt(q(t, 0.25), 1), fmt(q(t, 0.75), 1), fmt(med(xs.map((f) => f.valorUF[e]))), fmt(med(xs.map((f) => f.tirMotor)), 1)]; });
  })));

  // 3b · Cuántos pasan 4 a 8 %, con los tres tramos de flujo.
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    const tr = [0, 1, 2].map((t) => xs.filter((f) => tramo(f) === t).length);
    console.log(`\n3b · ${u} (${fmt(xs.length)}; flujo ≥ 0: ${fmt(tr[0])} · entre 0 y −5 % del ingreso: ${fmt(tr[1])} · bajo −5 %: ${fmt(tr[2])}): cuántos pasan la TIR mínima, en total y por tramo de flujo (≥ 0 / 0 a −5 % / bajo −5 %)`);
    console.log(tablaMd(["escenario", ...TIR_MIN.map((t) => `TIR ≥ ${t} %`)], ESCENARIOS.map((e) => [ROTULO[e], ...TIR_MIN.map((tm) => {
      const p = xs.filter((f) => f.tir[e] != null && f.tir[e]! >= tm);
      return `${fmt(p.length)} (${fmt(p.filter((f) => tramo(f) === 0).length)} / ${fmt(p.filter((f) => tramo(f) === 1).length)} / ${fmt(p.filter((f) => tramo(f) === 2).length)})`;
    })])));
  }

  // 3c · Nuevos por comuna e inmediata / futura, escenario base.
  const inmFut = (xs: FilaIngreso[]) => `${xs.filter((f) => f.entrega === "inmediata").length} / ${xs.filter((f) => f.entrega === "futura").length} / ${xs.filter((f) => f.entrega === "sin dato").length}`;
  console.log("\n3c · Nuevos, escenario base (g 3 %, cap de hoy), por comuna: TIR mediana, los que pasan 5 % y 6 % (inmediata / futura / sin fecha) y los que además tienen flujo ≥ 0");
  console.log(tablaMd(["comuna", "nuevos", "inmediata / futura / sin fecha", "cap (mediana)", "TIR mediana", "TIR ≥ 5 %", "TIR ≥ 6 %", "TIR ≥ 5 % y flujo ≥ 0", "TIR ≥ 6 % y flujo ≥ 0"], grupos(nuevos).map(([c, xs]) => {
    const p5 = xs.filter((f) => (f.tir.g3h ?? -Infinity) >= 5), p6 = xs.filter((f) => (f.tir.g3h ?? -Infinity) >= 6);
    return [c, xs.length, inmFut(xs), fmt(med(xs.map((f) => f.cap.cap)), 2), fmt(med(xs.map((f) => f.tir.g3h)), 1), `${p5.length} (${inmFut(p5)})`, `${p6.length} (${inmFut(p6)})`, p5.filter((f) => tramo(f) === 0).length, p6.filter((f) => tramo(f) === 0).length];
  })));

  // 3d · Escalón implícito y 3e · premio de estreno por ingreso.
  const esc = (f: FilaIngreso) => (f.valorIngresoHoyUF != null ? f.valorIngresoHoyUF / f.precioUF : null);
  const premioUF = (f: FilaIngreso) => (f.valorIngresoHoyUF != null ? f.precioUF - f.valorIngresoHoyUF : null);
  const premioPct = (f: FilaIngreso) => (f.valorIngresoHoyUF != null ? (f.precioUF - f.valorIngresoHoyUF) / f.precioUF : null);
  console.log("\n3d · Escalón implícito: valor por ingreso de hoy (arriendo bruto de hoy ÷ cap de salida) ÷ precio pagado, mediana por comuna, nuevos y usados");
  console.log(tablaMd(["comuna", "nuevos", "escalón nuevos (mediana)", "p25", "p75", "usados", "escalón usados (mediana)", "p25", "p75"], grupos(filas).map(([c, xs]) => {
    const n = xs.filter((f) => f.cond === "nuevo"), u = xs.filter((f) => f.cond === "usado");
    return [c, n.length, pf(med(n.map(esc))), pf(q(n.map(esc), 0.25)), pf(q(n.map(esc), 0.75)), fmt(u.length), pf(med(u.map(esc))), pf(q(u.map(esc), 0.25)), pf(q(u.map(esc), 0.75))];
  })));
  console.log("\n3e · Premio de estreno por ingreso: precio pagado − valor por ingreso de hoy, UF y % del precio, mediana por comuna (nuevos; usados como control)");
  console.log(tablaMd(["comuna", "nuevos", "premio UF (mediana)", "premio % (mediana)", "p25", "p75", "usados", "usados: UF (mediana)", "usados: % (mediana)"], grupos(filas).map(([c, xs]) => {
    const n = xs.filter((f) => f.cond === "nuevo"), u = xs.filter((f) => f.cond === "usado");
    return [c, n.length, fmt(med(n.map(premioUF))), pf(med(n.map(premioPct))), pf(q(n.map(premioPct), 0.25)), pf(q(n.map(premioPct), 0.75)), fmt(u.length), fmt(med(u.map(premioUF))), pf(med(u.map(premioPct)))];
  })));

  // 3f · Los usados Comprar de hoy que quedan con TIR ≥ 5 % y ≥ 6 %.
  console.log(`\n3f · Usados Comprar de hoy (${fmt(hoy.length)}): cuántos quedan con TIR ≥ 5 % y ≥ 6 % en cada escenario (y de ellos cuántos con flujo ≥ 0); como referencia, con la TIR del motor: ≥ 5 % ${fmt(hoy.filter((f) => (f.tirMotor ?? -Infinity) >= 5).length)}, ≥ 6 % ${fmt(hoy.filter((f) => (f.tirMotor ?? -Infinity) >= 6).length)}`);
  console.log(tablaMd(["escenario", "TIR ≥ 5 %", "%", "de ellos flujo ≥ 0", "TIR ≥ 6 %", "%", "de ellos flujo ≥ 0", "sin TIR"], ESCENARIOS.map((e) => {
    const p5 = hoy.filter((f) => (f.tir[e] ?? -Infinity) >= 5), p6 = hoy.filter((f) => (f.tir[e] ?? -Infinity) >= 6);
    return [ROTULO[e], fmt(p5.length), pct(p5.length, hoy.length), fmt(p5.filter((f) => tramo(f) === 0).length), fmt(p6.length), pct(p6.length, hoy.length), fmt(p6.filter((f) => tramo(f) === 0).length), hoy.filter((f) => f.tir[e] == null).length];
  })));

  // 4 · Comparación en la celda 5 %, flujo ≥ −200.000: motor · radio · ingreso, sobre los avisos presentes en las tres corridas.
  const f4 = new Map((JSON.parse(readFileSync(`${DIR}/11-fase4.json`, "utf8")) as { filas: FilaFase4[] }).filas.map((f) => [f.id, f]));
  const an = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.map((f) => [f.id, f]));
  const comunes = filas.filter((f) => f4.has(f.id) && an.has(f.id));
  const cn = comunes.filter((f) => f.cond === "nuevo"), cu = comunes.filter((f) => f.cond === "usado");
  console.log(`\n4 · Celda TIR ≥ ${CENTRAL.tir} %, flujo ≥ ${fmt(CENTRAL.tol)} (regla del anexo), las tres salidas lado a lado sobre los ${fmt(comunes.length)} avisos presentes en las tres corridas (nuevos ${fmt(cn.length)}, usados ${fmt(cu.length)}; flujo y gates de la corrida de hoy):`);
  type Fuente = { nombre: string; tir: (f: FilaIngreso) => number | null | undefined };
  const fuentes: Fuente[] = [
    { nombre: "motor, g 3 % (precio × 1,03^10 − sobreprecio)", tir: (f) => f4.get(f.id)!.base.motor.tir },
    { nombre: "como usado del radio, g 3 %", tir: (f) => an.get(f.id)!.r3?.tir },
    { nombre: "ingreso, g 3 %, cap de hoy", tir: (f) => f.tir.g3h },
    { nombre: "ingreso, g 3 %, cap + 50 pb", tir: (f) => f.tir.g3m },
    { nombre: "motor, g 1 %", tir: (f) => f4.get(f.id)!.base.g1.tir },
    { nombre: "como usado del radio, g 1 %", tir: (f) => an.get(f.id)!.r1?.tir },
    { nombre: "ingreso, g 1 %, cap de hoy", tir: (f) => f.tir.g1h },
    { nombre: "ingreso, g 1 %, cap + 50 pb", tir: (f) => f.tir.g1m },
    { nombre: "motor, g 0 %", tir: (f) => f4.get(f.id)!.base.g0.tir },
    { nombre: "ingreso, g 0 %, cap de hoy", tir: (f) => f.tir.g0h },
    { nombre: "ingreso, g 0 %, cap + 50 pb", tir: (f) => f.tir.g0m },
  ];
  const hoyC = cu.filter((f) => f.v === "COMPRAR");
  console.log(tablaMd(["salida", "nuevos Comprar", "%", "inmediata / futura / sin fecha", "usados Comprar", "%", "usados Comprar de hoy que se caen", "entran", "TIR mediana nuevos", "TIR mediana usados"], fuentes.map((s) => {
    const nC = cn.filter((f) => comprar(f.flujo, f.gate1, s.tir(f), CENTRAL.tir, CENTRAL.tol)), uC = cu.filter((f) => comprar(f.flujo, f.gate1, s.tir(f), CENTRAL.tir, CENTRAL.tol));
    return [s.nombre, nC.length, pct(nC.length, cn.length), inmFut(nC), fmt(uC.length), pct(uC.length, cu.length), fmt(hoyC.filter((f) => !comprar(f.flujo, f.gate1, s.tir(f), CENTRAL.tir, CENTRAL.tol)).length), fmt(uC.filter((f) => f.v !== "COMPRAR").length), fmt(med(cn.map(s.tir)), 1), fmt(med(cu.map(s.tir)), 1)];
  })));

  // 5 · Los tres casos del golden.
  const golden = JSON.parse(readFileSync(`${DIR}/18-golden.json`, "utf8")) as Record<string, { comuna: string; esNuevo: boolean; antiguedad: number | null; precioUF: number; m2: number; dorms: number; v: string; s: number; flujo: number; ingreso: number; tirMotor: number | null; cap: Cap; valorIngresoHoyUF: number | null; salidaMotorUF: number; valorUF: Partial<Record<Escenario, number>>; tir: Partial<Record<Escenario, number | null>> }>;
  console.log("\n5 · Los tres casos del golden: TIR con salida por ingreso en los seis escenarios (y la del motor), con su cap de hoy y su valor por ingreso de hoy");
  console.log(tablaMd(["análisis", "veredicto · score · flujo", "cap (nivel; n arr/venta)", "precio UF · valor por ingreso hoy UF · salida motor UF", "TIR motor", ...ESCENARIOS.map((e) => ROTULO[e])], Object.entries(golden).map(([id, g]) => [
    `${id} · ${g.comuna} · ${g.esNuevo ? "nuevo" : `usado ${g.antiguedad ?? "?"} años`} · ${g.dorms}D ${fmt(g.m2)} m²`, `${g.v} ${g.s} · ${fmt(g.flujo)} (${g.ingreso > 0 ? pct(g.flujo, g.ingreso) : "—"} del ingreso)`, `${g.cap.cap ?? "—"} (${g.cap.nivel}; ${g.cap.nArr}/${g.cap.nVenta})`, `${fmt(g.precioUF)} · ${fmt(g.valorIngresoHoyUF)} · ${fmt(g.salidaMotorUF)}`, fmt(g.tirMotor, 2), ...ESCENARIOS.map((e) => `${fmt(g.tir[e] ?? null, 1)} (UF ${fmt(g.valorUF[e])})`),
  ])));
}

main();
