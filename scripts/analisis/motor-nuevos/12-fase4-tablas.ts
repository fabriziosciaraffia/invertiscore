// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 · LAS TABLAS: la grilla TIR mínima × flujo mínimo (4.3, g = 0 %, salida del motor), la celda central con las
// versiones (motor, g 1 %, g 0 %, salida a valor usado g 0 % y 1 %, sensibilidad de edad, todo el pie a la entrega), las
// palancas, el desglose por comuna, los 16 reactivados sin fecha aparte, y los Comprar que hoy caen en break-even imposible
// (punto 5). Lee out/11-fase4.json. Solo lectura.
//
// LA REGLA DE LA GRILLA (decisión de Fabrizio, OK al STOP 4a):
//   · Buscar otra: las señales graves que siguen: CoC severo (< −30 %) y sobreprecio comunal con flujo negativo (GATE 1).
//   · La tolerancia de flujo REEMPLAZA a los otros dos brazos del GATE 1 (break-even imposible y flujo severo) y al GATE 2.
//   · Comprar: sin señal grave, flujo de operación ≥ tolerancia y TIR ≥ mínima. Lo demás, Ajusta supuestos (un Comprar del
//     motor que no pasa la regla baja a Ajustar). El GATE 3 (sube a Comprar con flujo ≥ 0, neta ≥ 4 y plusvalía ≥ 0) tampoco
//     corre: la regla decide sola.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, mediana, fmt, pct, tablaMd } from "./comun";
import type { Corrida, FilaFase4 } from "./11-fase4";

type Version = "motor" | "g1" | "g0" | "usado0" | "usado1" | "edad" | "pieEntrega";
const TIR_MIN = [4, 5, 6, 7];
const TOL = [0, -100000, -200000, -300000];
const CENTRAL = { tir: 5, tol: -200000 };
const NOMBRE: Record<Version, string> = { g0: "g = 0 % (la de la grilla)", g1: "g = 1 %", motor: "motor de hoy (3 % precio, 0,49 % arriendo)", usado0: "salida a valor usado, g = 0 %", usado1: "salida a valor usado, g = 1 %", edad: "sensibilidad edad: g = 0 %, venta al año 10 × 0,85 (Santiago)", pieEntrega: "g = 0 %, todo el pie a la entrega (solo cambia la futura)" };

const grave = (c: Corrida) => c.gate1.cocSevero || c.gate1.sobreprecioComunalConFlujo;
function tirDe(c: Corrida, v: Version): number | null {
  if (v === "pieEntrega") return c.cuotas ? c.cuotas.tirPieEntrega.g0 : c.g0.tir;
  const s = c[v];
  return s ? s.tir : null;
}
function regla(c: Corrida, v: Version, tirMin: number, tol: number): "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA" {
  if (grave(c)) return "BUSCAR OTRA";
  const tir = tirDe(c, v);
  return c.flujo != null && c.flujo >= tol && tir != null && tir >= tirMin ? "COMPRAR" : "AJUSTA SUPUESTOS";
}

function main() {
  const { filas, cfg } = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/11-fase4.json", "utf8")) as { cfg: { uf: number; tasa: number }; filas: FilaFase4[] };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const sinFecha16 = (f: FilaFase4) => f.origen === "reactivada" && f.entrega === "sin dato" && f.base.v === "COMPRAR";
  console.log(`universo: nuevos ${fmt(nuevos.length)} (Comprar del motor ${nuevos.filter((f) => f.base.v === "COMPRAR").length}; de ellos reactivados sin fecha de entrega ${nuevos.filter(sinFecha16).length}) · usados ${fmt(usados.length)} (Comprar ${fmt(usados.filter((f) => f.base.v === "COMPRAR").length)}) · UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · sin celda de usados: nuevos ${nuevos.filter((f) => f.base.medianaUsadoUFm2 == null).length}, usados ${usados.filter((f) => f.base.medianaUsadoUFm2 == null).length}`);
  console.log(`gates en la base: nuevos con CoC severo ${nuevos.filter((f) => f.base.gate1.cocSevero).length} · sobreprecio con flujo ${nuevos.filter((f) => f.base.gate1.sobreprecioComunalConFlujo).length} · break-even imposible ${nuevos.filter((f) => f.base.gate1.breakEvenImposible).length} · flujo severo ${nuevos.filter((f) => f.base.gate1.flujoSevero).length}; usados: ${usados.filter((f) => f.base.gate1.cocSevero).length} · ${usados.filter((f) => f.base.gate1.sobreprecioComunalConFlujo).length} · ${usados.filter((f) => f.base.gate1.breakEvenImposible).length} · ${usados.filter((f) => f.base.gate1.flujoSevero).length}`);

  // 4.1 · Resúmenes.
  const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null));
  const q = (xs: (number | null | undefined)[], p: number) => cuantil(xs.filter((x): x is number => x != null), p);
  const versiones: Version[] = ["motor", "g1", "g0", "usado0", "usado1", "edad"];
  console.log("\n4.1 · TIR a 10 años (mediana · p25 · p75), ganancia en UF y múltiplo, por versión:");
  console.log(tablaMd(["universo", "versión", "n con TIR", "TIR mediana", "p25", "p75", "ganancia UF mediana", "múltiplo mediano", "flujo de operación mediano"], versiones.flatMap((v) => ([["nuevos", nuevos], ["nuevos inmediata", nuevos.filter((f) => f.entrega !== "futura")], ["nuevos futura", nuevos.filter((f) => f.entrega === "futura")], ["usados", usados]] as const).map(([n, xs]) => {
    const t = xs.map((f) => tirDe(f.base, v));
    const sal = (f: FilaFase4): Corrida["motor"] | null => (v === "pieEntrega" ? f.base.g0 : f.base[v] ?? null);
    return [n, NOMBRE[v], t.filter((x) => x != null).length, fmt(med(t), 1), fmt(q(t, 0.25), 1), fmt(q(t, 0.75), 1), fmt(med(xs.map((f) => sal(f)?.gananciaUF))), fmt(med(xs.map((f) => sal(f)?.multiplo)), 2), fmt(med(xs.map((f) => f.base.flujo)))];
  }))));
  const fut = nuevos.filter((f) => f.entrega === "futura" && f.base.cuotas);
  console.log(`\nEntrega futura (${fut.length} con cuotas): cuota mensual mediana $${fmt(med(fut.map((f) => f.base.cuotas!.montoCLP)))} · meses de cuotas mediana ${fmt(med(fut.map((f) => f.base.cuotas!.n)))} (máx ${Math.max(...fut.map((f) => f.base.cuotas!.n))}) · máximo acumulado antes de la entrega mediana UF ${fmt(med(fut.map((f) => f.base.cuotas!.maxAcumuladoUF)))} · plusvalía durante la construcción mediana UF ${fmt(med(fut.map((f) => f.plusvaliaConstruccionUF?.g1)))} (g 1 %) y UF ${fmt(med(fut.map((f) => f.plusvaliaConstruccionUF?.g3)))} (g 3 %) · TIR g 0 % con todo el pie a la entrega: mediana ${fmt(med(fut.map((f) => f.base.cuotas!.tirPieEntrega.g0)), 1)} (con cuotas: ${fmt(med(fut.map((f) => f.base.g0.tir)), 1)}) · control del vector: ${fut.filter((f) => Math.abs((f.base.cuotas!.tirControl ?? NaN) - (f.base.motor.tir ?? NaN)) < 0.011).length} de ${fut.length} reproducen la TIR del motor`);

  // Salida a valor usado contra la del motor, nuevos, por comuna.
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q2) => nuevos.filter((f) => f.comuna === q2).length - nuevos.filter((f) => f.comuna === p).length);
  console.log("\nPrecio de salida al año 10, nuevos: valor usado (g 0 %) contra el del motor (precio × 1,03^10 − sobreprecio de hoy), por comuna:");
  console.log(tablaMd(["comuna", "nuevos", "con celda de usados", "salida motor UF (mediana)", "salida valor usado UF (mediana)", "diferencia UF (mediana)", "diferencia % (mediana)", "mediana usado UF/m² (mediana de celdas)"], [["Gran Santiago", nuevos], ...comunas.map((c) => [c, nuevos.filter((f) => f.comuna === c)] as const)].map(([c, xs]) => {
    const con = (xs as FilaFase4[]).filter((f) => f.base.salidaUsadoUF != null);
    return [c as string, (xs as FilaFase4[]).length, con.length, fmt(med(con.map((f) => f.base.salidaMotorUF))), fmt(med(con.map((f) => f.base.salidaUsadoUF))), fmt(med(con.map((f) => f.base.salidaUsadoUF! - f.base.salidaMotorUF))), pct(med(con.map((f) => (f.base.salidaUsadoUF! / f.base.salidaMotorUF - 1) * 100)) ?? 0, 100, 1), fmt(med(con.map((f) => f.base.medianaUsadoUFm2)), 1)];
  })));
  // Para los usados: ¿coincide la salida a valor usado con la regla del motor?
  const u = usados.filter((f) => f.base.salidaUsadoUF != null);
  console.log(`Usados (${fmt(u.length)} con celda): salida del motor mediana UF ${fmt(med(u.map((f) => f.base.salidaMotorUF)))}, a valor usado g 0 % UF ${fmt(med(u.map((f) => f.base.salidaUsadoUF)))} (diferencia mediana ${pct(med(u.map((f) => (f.base.salidaUsadoUF! / f.base.salidaMotorUF - 1) * 100)) ?? 0, 100, 1)}): no coinciden, así que la salida a valor usado se aplica a todos con la misma regla.`);

  // 4.3 · La grilla con g = 0 %.
  const celda = (v: Version, tirMin: number, tol: number) => {
    const rn = nuevos.map((f) => ({ f, r: regla(f.base, v, tirMin, tol) }));
    const ru = usados.map((f) => ({ f, r: regla(f.base, v, tirMin, tol) }));
    const nC = rn.filter((x) => x.r === "COMPRAR");
    const uC = ru.filter((x) => x.r === "COMPRAR");
    return {
      nuevos: nC.length, inm: nC.filter((x) => x.f.entrega === "inmediata").length, fut: nC.filter((x) => x.f.entrega === "futura").length, sinDato: nC.filter((x) => x.f.entrega === "sin dato").length, los16: nC.filter((x) => sinFecha16(x.f)).length,
      usados: uC.length,
      pierden: [...rn, ...ru].filter((x) => x.f.base.v === "COMPRAR" && x.r !== "COMPRAR").length, pierdenNuevos: rn.filter((x) => x.f.base.v === "COMPRAR" && x.r !== "COMPRAR").length,
      ganan: [...rn, ...ru].filter((x) => x.f.base.v === "AJUSTA SUPUESTOS" && x.r === "COMPRAR").length, gananNuevos: rn.filter((x) => x.f.base.v === "AJUSTA SUPUESTOS" && x.r === "COMPRAR").length,
      breakEvenNuevos: nC.filter((x) => x.f.base.gate1.breakEvenImposible).length, breakEvenUsados: uC.filter((x) => x.f.base.gate1.breakEvenImposible).length,
      desdeBuscar: [...rn, ...ru].filter((x) => x.f.base.v === "BUSCAR OTRA" && x.r === "COMPRAR").length,
    };
  };
  console.log("\n4.3 · Grilla con g = 0 % y la salida del motor. Cada celda: nuevos Comprar (inmediata / futura / sin dato) · usados Comprar · Comprar del motor que dejarían de serlo (de ellos nuevos) / Ajustar del motor que pasarían a Comprar (de ellos nuevos)");
  console.log(tablaMd(["TIR mínima \\ flujo mínimo", ...TOL.map((t) => `≥ ${fmt(t)}`)], TIR_MIN.map((tm) => [`${tm} %`, ...TOL.map((t) => { const c = celda("g0", tm, t); return `nuevos ${c.nuevos} (${c.inm}/${c.fut}/${c.sinDato}) · usados ${fmt(c.usados)} · −${c.pierden} (${c.pierdenNuevos}) / +${c.ganan} (${c.gananNuevos})`; })])));

  // 4.4 · La celda central, todas las versiones.
  console.log(`\n4.4 · Celda central (TIR ≥ ${CENTRAL.tir} %, flujo ≥ ${fmt(CENTRAL.tol)}):`);
  const vs: Version[] = ["g0", "g1", "motor", "usado0", "usado1", "edad", "pieEntrega"];
  console.log(tablaMd(["versión", "nuevos Comprar", "inmediata", "futura", "sin dato", "de ellos los 16 reactivados sin fecha", "usados Comprar", "−/+ vs motor (todos)", "−/+ vs motor (nuevos)", "Buscar otra del motor que pasan a Comprar", "Comprar que hoy son break-even imposible (nuevos / usados)"], vs.map((v) => {
    const c = celda(v, CENTRAL.tir, CENTRAL.tol);
    return [NOMBRE[v], `${c.nuevos} (${pct(c.nuevos, nuevos.length)})`, c.inm, c.fut, c.sinDato, c.los16, fmt(c.usados), `−${c.pierden} / +${c.ganan}`, `−${c.pierdenNuevos} / +${c.gananNuevos}`, c.desdeBuscar, `${c.breakEvenNuevos} / ${fmt(c.breakEvenUsados)}`];
  })));

  // Punto 5 · Los Comprar de la celda central (g 0 %) que hoy caen en break-even imposible, por comuna y nuevo/usado.
  console.log("\nPunto 5 · Comprar de la celda central (g = 0 %) que hoy caen en break-even imposible (nunca se pagan solos; entran por la TIR), por comuna:");
  const be = (xs: FilaFase4[]) => xs.filter((f) => regla(f.base, "g0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR" && f.base.gate1.breakEvenImposible);
  const comunasTodas = [...new Set(filas.map((f) => f.comuna))].sort((p, q2) => be(filas.filter((f) => f.comuna === q2)).length - be(filas.filter((f) => f.comuna === p)).length);
  console.log(tablaMd(["comuna", "nuevos Comprar (celda)", "de ellos break-even imposible", "usados Comprar (celda)", "de ellos break-even imposible"], [["Gran Santiago", filas], ...comunasTodas.map((c) => [c, filas.filter((f) => f.comuna === c)] as const)].map(([c, xs]) => {
    const n = (xs as FilaFase4[]).filter((f) => f.cond === "nuevo"), us = (xs as FilaFase4[]).filter((f) => f.cond === "usado");
    return [c as string, n.filter((f) => regla(f.base, "g0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length, be(n).length, fmt(us.filter((f) => regla(f.base, "g0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length), fmt(be(us).length)];
  }).filter((r, i) => i === 0 || Number(r[2]) > 0 || Number(String(r[4]).replace(/\./g, "")) > 0)));

  // Palancas (nuevos), celda central.
  const palancas: Array<[string, (f: FilaFase4) => Corrida | undefined]> = [["base", (f) => f.base], ["Negociar 5 %", (f) => f.negociar5], ["Negociar 10 %", (f) => f.negociar10], ["Subsidio 0,6 pp (elegibles; los demás con su base)", (f) => f.subsidio], ["Subsidio + Negociar 10 %", (f) => f.subsidioNegociar10]];
  console.log(`\nPalancas sobre los nuevos (elegibles al subsidio: ${nuevos.filter((f) => f.elegibleSubsidio).length} de ${nuevos.length}):`);
  console.log(tablaMd(["palanca", "Comprar del motor", "inmediata / futura", "Comprar regla central g 0 %", "inmediata / futura", "regla central g 1 %", "regla central motor", "regla central valor usado g 0 %"], palancas.map(([n, pick]) => {
    const cs = nuevos.map((f) => ({ f, c: pick(f) ?? f.base }));
    const motor = cs.filter((x) => x.c.v === "COMPRAR");
    const r0 = cs.filter((x) => regla(x.c, "g0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR");
    return [n, motor.length, `${motor.filter((x) => x.f.entrega === "inmediata").length} / ${motor.filter((x) => x.f.entrega === "futura").length}`, r0.length, `${r0.filter((x) => x.f.entrega === "inmediata").length} / ${r0.filter((x) => x.f.entrega === "futura").length}`, cs.filter((x) => regla(x.c, "g1", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length, cs.filter((x) => regla(x.c, "motor", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length, cs.filter((x) => regla(x.c, "usado0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length];
  })));

  // Por comuna, celda central g = 0 %, con las palancas y las otras versiones.
  console.log("\nPor comuna, nuevos, celda central (g = 0 % salvo donde dice):");
  console.log(tablaMd(["comuna", "nuevos", "Comprar motor", "regla g 0 %", "inm. / fut.", "g 1 %", "valor usado g 0 %", "edad", "Negociar 10 %", "subsidio", "subsidio + Neg. 10 %", "usados Comprar regla g 0 %"], comunas.map((c) => {
    const xs = nuevos.filter((f) => f.comuna === c);
    const cnt = (pick: (f: FilaFase4) => Corrida | undefined, v: Version = "g0") => xs.filter((f) => regla(pick(f) ?? f.base, v, CENTRAL.tir, CENTRAL.tol) === "COMPRAR");
    const base = cnt((f) => f.base);
    return [c, xs.length, xs.filter((f) => f.base.v === "COMPRAR").length, base.length, `${base.filter((f) => f.entrega === "inmediata").length} / ${base.filter((f) => f.entrega === "futura").length}`, cnt((f) => f.base, "g1").length, cnt((f) => f.base, "usado0").length, cnt((f) => f.base, "edad").length, cnt((f) => f.negociar10).length, cnt((f) => f.subsidio).length, cnt((f) => f.subsidioNegociar10).length, usados.filter((f) => f.comuna === c && regla(f.base, "g0", CENTRAL.tir, CENTRAL.tol) === "COMPRAR").length];
  })));
}

main();
