// ─────────────────────────────────────────────────────────────────────────────
// ANEXO · LAS TABLAS de la salida como usado del radio (lee out/14-anexo-salida.json). Solo lectura.
//   2.1 el escalón por comuna (salida como usado del radio ÷ salida del motor, g 3 % en las dos) y por unidad (precio pagado −
//       valor hoy como usado, UF y %, por tramos); 2.2 la prueba del piso con g 3 %; 2.3 el g de empate;
//   3   dos grillas completas (g 1 % y g 3 %, precio y arriendo) con la regla acordada, la celda central por comuna, los
//       Comprar que hoy son break-even imposible, y los usados Comprar de hoy que se caen y por qué.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, mediana, fmt, pct, tablaMd } from "./comun";
import type { FilaAnexo } from "./14-anexo-salida";

const TIR_MIN = [4, 5, 6, 7];
const TOL = [0, -100000, -200000, -300000];
const CENTRAL = { tir: 5, tol: -200000 };
export type G = "r1" | "r3";

export const grave = (f: FilaAnexo) => f.gate1.cocSevero || f.gate1.sobreprecioComunalConFlujo;
export const tirDe = (f: FilaAnexo, g: G) => f[g]?.tir ?? null;
export function regla(f: FilaAnexo, g: G, tirMin: number, tol: number): "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA" {
  if (grave(f)) return "BUSCAR OTRA";
  const t = tirDe(f, g);
  return f.flujo != null && f.flujo >= tol && t != null && t >= tirMin ? "COMPRAR" : "AJUSTA SUPUESTOS";
}
const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null));
const q = (xs: (number | null | undefined)[], p: number) => cuantil(xs.filter((x): x is number => x != null), p);
const pctF = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x * 100, d) + " %");

function main() {
  const { filas, cfg } = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/14-anexo-salida.json", "utf8")) as { cfg: { uf: number; tasa: number }; filas: FilaAnexo[] };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const con = (xs: FilaAnexo[]) => xs.filter((f) => f.valorUsadoHoyUF != null);
  console.log(`universo: nuevos ${fmt(nuevos.length)} (valor como usado por el radio ${nuevos.filter((f) => f.fuente === "radio").length}, por la celda ${nuevos.filter((f) => f.fuente === "celda").length}, sin valor ${nuevos.filter((f) => f.fuente === "ninguno").length}) · usados ${fmt(usados.length)} (radio ${usados.filter((f) => f.fuente === "radio").length}, celda ${usados.filter((f) => f.fuente === "celda").length}, sin valor ${usados.filter((f) => f.fuente === "ninguno").length}) · UF ${fmt(cfg.uf)}`);
  const u = con(usados);
  console.log(`usados: salida del motor mediana UF ${fmt(med(u.map((f) => f.salidaMotorUF)))} · como usado del radio con g 3 % UF ${fmt(med(u.map((f) => f.salidaUsado3UF)))} (cociente mediano ${pctF(med(u.map((f) => f.salidaUsado3UF! / f.salidaMotorUF)))}): no coinciden (el motor parte del precio pagado, el radio del valor de mercado), así que la misma regla se aplica a todos.`);

  // 2.1 · El escalón por comuna y por unidad.
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q2) => nuevos.filter((f) => f.comuna === q2).length - nuevos.filter((f) => f.comuna === p).length);
  const grupos: Array<[string, FilaAnexo[]]> = [["Gran Santiago", nuevos], ...comunas.map((c) => [c, nuevos.filter((f) => f.comuna === c)] as [string, FilaAnexo[]])];
  console.log("\n2.1 · El escalón por comuna (nuevos): salida como usado del radio ÷ salida del motor (g 3 % en las dos), y por unidad: precio pagado − valor hoy como usado (UF y %)");
  console.log(tablaMd(["comuna", "nuevos", "con valor (radio / celda)", "escalón mediana", "p25", "p75", "precio − valor usado, UF mediana", "% mediana", "< 10 %", "10–20 %", "20–30 %", "> 30 %"], grupos.map(([c, xs]) => {
    const cx = con(xs);
    const esc = cx.map((f) => f.salidaUsado3UF! / f.salidaMotorUF);
    const dUF = cx.map((f) => f.precioUF - f.valorUsadoHoyUF!), dPct = cx.map((f) => (f.precioUF - f.valorUsadoHoyUF!) / f.precioUF);
    const tr = (lo: number, hi: number) => dPct.filter((d) => d >= lo && d < hi).length;
    return [c, xs.length, `${cx.length} (${cx.filter((f) => f.fuente === "radio").length} / ${cx.filter((f) => f.fuente === "celda").length})`, pctF(med(esc)), pctF(q(esc, 0.25)), pctF(q(esc, 0.75)), fmt(med(dUF)), pctF(med(dPct)), tr(-Infinity, 0.1), tr(0.1, 0.2), tr(0.2, 0.3), tr(0.3, Infinity)];
  })));

  // 2.2 · La prueba del piso (g 3 %): ¿la venta como usado al año 10 recupera el precio pagado?
  console.log("\n2.2 · Prueba del piso (g = 3 %): salida como usado del radio al año 10 ÷ precio pagado, nuevos");
  console.log(tablaMd(["comuna", "con valor", "cociente mediana", "p25", "p75", "recuperan el precio (n)", "recuperan (%)"], grupos.map(([c, xs]) => {
    const cx = con(xs);
    const r = cx.map((f) => f.salidaUsado3UF! / f.precioUF);
    const rec = r.filter((x) => x >= 1).length;
    return [c, cx.length, pctF(med(r)), pctF(q(r, 0.25)), pctF(q(r, 0.75)), rec, pct(rec, cx.length)];
  })));

  // 2.3 · El g de empate: (precio / valor usado hoy)^(1/10) − 1.
  console.log("\n2.3 · g de empate (la tasa real anual que necesitan los usados comparables para que la venta al año 10 iguale el precio pagado), nuevos");
  console.log(tablaMd(["comuna", "con valor", "g de empate mediana", "p25", "p75", "bajo 1 %", "1 a 3 %", "sobre 3 %"], grupos.map(([c, xs]) => {
    const cx = con(xs);
    const g = cx.map((f) => Math.pow(f.precioUF / f.valorUsadoHoyUF!, 1 / 10) - 1);
    return [c, cx.length, pctF(med(g), 2), pctF(q(g, 0.25), 2), pctF(q(g, 0.75), 2), g.filter((x) => x < 0.01).length, g.filter((x) => x >= 0.01 && x <= 0.03).length, g.filter((x) => x > 0.03).length];
  })));

  // 3 · Las dos grillas.
  const celda = (g: G, tirMin: number, tol: number) => {
    const rn = nuevos.map((f) => ({ f, r: regla(f, g, tirMin, tol) })), ru = usados.map((f) => ({ f, r: regla(f, g, tirMin, tol) }));
    const nC = rn.filter((x) => x.r === "COMPRAR"), uC = ru.filter((x) => x.r === "COMPRAR");
    return {
      nuevos: nC.length, inm: nC.filter((x) => x.f.entrega === "inmediata").length, fut: nC.filter((x) => x.f.entrega === "futura").length, sinDato: nC.filter((x) => x.f.entrega === "sin dato").length,
      usados: uC.length,
      pierden: [...rn, ...ru].filter((x) => x.f.v === "COMPRAR" && x.r !== "COMPRAR").length, pierdenNuevos: rn.filter((x) => x.f.v === "COMPRAR" && x.r !== "COMPRAR").length,
      ganan: [...rn, ...ru].filter((x) => x.f.v === "AJUSTA SUPUESTOS" && x.r === "COMPRAR").length, gananNuevos: rn.filter((x) => x.f.v === "AJUSTA SUPUESTOS" && x.r === "COMPRAR").length,
      beNuevos: nC.filter((x) => x.f.gate1.breakEvenImposible).length, beUsados: uC.filter((x) => x.f.gate1.breakEvenImposible).length,
    };
  };
  for (const g of ["r1", "r3"] as G[]) {
    const gl = g === "r1" ? "1 %" : "3 %";
    console.log(`\n3 · Grilla con salida como usado del radio, g = ${gl} (precio y arriendo). Celda: nuevos Comprar (inmediata / futura / sin dato) · usados Comprar · Comprar del motor que dejarían de serlo (nuevos) / Ajustar del motor que pasarían a Comprar (nuevos)`);
    console.log(tablaMd(["TIR mínima \\ flujo mínimo", ...TOL.map((t) => `≥ ${fmt(t)}`)], TIR_MIN.map((tm) => [`${tm} %`, ...TOL.map((t) => { const c = celda(g, tm, t); return `nuevos ${c.nuevos} (${c.inm}/${c.fut}/${c.sinDato}) · usados ${fmt(c.usados)} · −${c.pierden} (${c.pierdenNuevos}) / +${c.ganan} (${c.gananNuevos})`; })])));
    const c = celda(g, CENTRAL.tir, CENTRAL.tol);
    console.log(`Celda central g = ${gl}: nuevos ${c.nuevos} (${pct(c.nuevos, nuevos.length)}; inmediata ${c.inm}, futura ${c.fut}, sin dato ${c.sinDato}) · usados ${fmt(c.usados)} (${pct(c.usados, usados.length)}) · Comprar que hoy son break-even imposible: nuevos ${c.beNuevos}, usados ${fmt(c.beUsados)} · para comparar, la misma celda con la salida del motor: ${g === "r1" ? "337 nuevos / 6.851 usados" : "2.054 nuevos / 10.710 usados"}`);
    console.log(tablaMd(["comuna", "nuevos", "Comprar motor", "Comprar celda central", "inmediata / futura", "break-even imposible entre ellos", "usados Comprar celda central", "usados Comprar motor"], [["Gran Santiago", filas] as [string, FilaAnexo[]], ...[...new Set(filas.map((f) => f.comuna))].sort((p, q2) => filas.filter((f) => f.comuna === q2).length - filas.filter((f) => f.comuna === p).length).map((cc) => [cc, filas.filter((f) => f.comuna === cc)] as [string, FilaAnexo[]])].map(([cc, xs]) => {
      const n = xs.filter((f) => f.cond === "nuevo"), us = xs.filter((f) => f.cond === "usado");
      const nC = n.filter((f) => regla(f, g, CENTRAL.tir, CENTRAL.tol) === "COMPRAR"), uC = us.filter((f) => regla(f, g, CENTRAL.tir, CENTRAL.tol) === "COMPRAR");
      return [cc, n.length, n.filter((f) => f.v === "COMPRAR").length, nC.length, `${nC.filter((f) => f.entrega === "inmediata").length} / ${nC.filter((f) => f.entrega === "futura").length}`, nC.filter((f) => f.gate1.breakEvenImposible).length, fmt(uC.length), fmt(us.filter((f) => f.v === "COMPRAR").length)];
    })));
    // Los usados Comprar de hoy que se caen, y por qué.
    const caen = usados.filter((f) => f.v === "COMPRAR" && regla(f, g, CENTRAL.tir, CENTRAL.tol) !== "COMPRAR");
    const porque = (f: FilaAnexo) => grave(f) ? "señal grave (sobreprecio con flujo o CoC)" : f.flujo != null && f.flujo < CENTRAL.tol ? "flujo bajo la tolerancia" : tirDe(f, g) == null ? "sin TIR (sin valor usado o sin raíz)" : (f.flujo ?? 0) >= 0 ? "TIR baja con flujo positivo" : "TIR baja con flujo negativo (dentro de la tolerancia)";
    const motivos = new Map<string, number>();
    for (const f of caen) motivos.set(porque(f), (motivos.get(porque(f)) ?? 0) + 1);
    console.log(`Usados Comprar de hoy que se caen en la celda central (g = ${gl}): ${fmt(caen.length)} de ${fmt(usados.filter((f) => f.v === "COMPRAR").length)}: ` + [...motivos.entries()].sort((p, q2) => q2[1] - p[1]).map(([k, n]) => `${k} ${fmt(n)}`).join(" · ") + `; TIR mediana de los que caen ${fmt(med(caen.map((f) => tirDe(f, g))), 1)} %`);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("15-anexo-tablas.ts")) main();
