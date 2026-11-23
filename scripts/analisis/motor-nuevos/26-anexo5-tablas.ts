// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 5 · LAS TABLAS (lee out/25-subsidio.json). Solo lectura.
//   2 · Comprar con la regla de veredicto de hoy en seis casos (sin nada, subsidio, subsidio + 5 %, subsidio + 10 %, 5 %, 10 %),
//       por entrega (inmediata / futura / sin fecha) y por comuna, en unidades y en proyectos distintos.
//   3 · Puerta personal: TIR ≥ 5 % con g = 3 % y salida al mayor cap, con flujo ≥ −$100.000 y ≥ −$200.000, sin y con subsidio,
//       con los mismos cortes.
//   4 · Bono pie en tres unidades reales: sin nada, descuento real de 10 % y bono pie de 10 %.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fmt, tablaMd, type Config } from "./comun";
import type { BonoPie, Esc, FilaSub } from "./25-anexo5-subsidio";

const DIR = "scripts/analisis/motor-nuevos/out";
const ROT: Record<Esc, string> = { base: "a) sin subsidio", sub: "b) con subsidio", sub5: "c) subsidio + 5 %", sub10: "d) subsidio + 10 %", d5: "e) 5 % sin subsidio", d10: "e) 10 % sin subsidio" };
const ORDEN: Esc[] = ["base", "sub", "sub5", "sub10", "d5", "d10"];
const ENT = ["inmediata", "futura", "sin dato"] as const;

function main() {
  const { filas, cfg, bono, ahora } = JSON.parse(readFileSync(`${DIR}/25-subsidio.json`, "utf8")) as { filas: FilaSub[]; cfg: Config; bono: BonoPie[]; ahora: string };
  const proyectos = (xs: FilaSub[]) => new Set(xs.map((f) => f.proyecto)).size;
  const up = (xs: FilaSub[]) => `${fmt(xs.length)} · ${fmt(proyectos(xs))}`;
  const elig = filas.filter((f) => f.c.sub?.elegible);
  console.log(`universo: ${fmt(filas.length)} nuevos limpios en ${fmt(proyectos(filas))} proyectos (activos ${fmt(filas.filter((f) => f.origen === "activa").length)}, reactivadas ${fmt(filas.filter((f) => f.origen === "reactivada").length)}) · por entrega ${ENT.map((e) => `${e} ${fmt(filas.filter((f) => f.entrega === e).length)}`).join(" · ")} · UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} % · ${ahora}`);
  console.log(`elegibles al subsidio (precio ≤ UF 6.000 y entrega hasta mayo de 2028 o sin fecha): ${fmt(elig.length)} (${ENT.map((e) => `${e} ${fmt(elig.filter((f) => f.entrega === e).length)}`).join(" · ")}); con el precio rebajado 10 % lo son ${fmt(filas.filter((f) => f.c.sub10?.elegible).length)}`);

  // 2 · Comprar por caso.
  const comprar = (e: Esc) => (f: FilaSub) => f.c[e]?.v === "COMPRAR";
  console.log("\n2 · Comprar con la regla de veredicto de hoy. Celda: unidades · proyectos distintos");
  console.log(tablaMd(["caso", "Comprar", "inmediata", "futura", "sin fecha", "% de los nuevos"], ORDEN.map((e) => {
    const C = filas.filter(comprar(e));
    return [ROT[e], up(C), ...ENT.map((en) => up(C.filter((f) => f.entrega === en))), fmt((C.length / filas.length) * 100, 1) + " %"];
  })));
  const nNuevos = (c: string) => filas.filter((f) => f.comuna === c).length;
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, q) => nNuevos(q) - nNuevos(p));
  const grupos: Array<[string, FilaSub[]]> = [["Gran Santiago", filas], ...comunas.map((c) => [c, filas.filter((f) => f.comuna === c)] as [string, FilaSub[]])];
  console.log("\n2 · Por comuna. Celda: Comprar en unidades (proyectos) · inmediata / futura / sin fecha");
  console.log(tablaMd(["comuna", "nuevos (proyectos)", "elegibles", ...ORDEN.map((e) => ROT[e])], grupos.map(([c, xs]) => [c, `${fmt(xs.length)} (${fmt(proyectos(xs))})`, fmt(xs.filter((f) => f.c.sub?.elegible).length), ...ORDEN.map((e) => {
    const C = xs.filter(comprar(e));
    return `${fmt(C.length)} (${fmt(proyectos(C))}) · ${ENT.map((en) => C.filter((f) => f.entrega === en).length).join(" / ")}`;
  })])));

  // 3 · Puerta personal.
  type Puerta = { nombre: string; esc: "base" | "sub"; tol: number };
  const puertas: Puerta[] = [
    { nombre: "sin subsidio, flujo ≥ −$100.000", esc: "base", tol: -100000 },
    { nombre: "sin subsidio, flujo ≥ −$200.000", esc: "base", tol: -200000 },
    { nombre: "con subsidio, flujo ≥ −$100.000", esc: "sub", tol: -100000 },
    { nombre: "con subsidio, flujo ≥ −$200.000", esc: "sub", tol: -200000 },
  ];
  const pasa = (p: Puerta) => (f: FilaSub) => { const c = f.c[p.esc]; return !!c && c.flujo != null && c.flujo >= p.tol && c.tirMayorG3 != null && c.tirMayorG3 >= 5; };
  console.log(`\n3 · Puerta personal: TIR ≥ 5 % con g = 3 % y salida al mayor cap, y flujo mínimo. Celda: unidades · proyectos distintos (sin cap de celda: ${fmt(filas.filter((f) => f.capCelda == null).length)} nuevos, quedan fuera)`);
  console.log(tablaMd(["puerta", "pasan", "inmediata", "futura", "sin fecha", "% de los nuevos", "de ellos Comprar hoy (motor)"], puertas.map((p) => {
    const P = filas.filter(pasa(p));
    return [p.nombre, up(P), ...ENT.map((en) => up(P.filter((f) => f.entrega === en))), fmt((P.length / filas.length) * 100, 1) + " %", fmt(P.filter((f) => f.c[p.esc]?.v === "COMPRAR").length)];
  })));
  console.log("\n3 · Puerta personal por comuna. Celda: pasan en unidades (proyectos) · inmediata / futura / sin fecha");
  console.log(tablaMd(["comuna", "nuevos", ...puertas.map((p) => p.nombre)], grupos.map(([c, xs]) => [c, fmt(xs.length), ...puertas.map((p) => {
    const P = xs.filter(pasa(p));
    return `${fmt(P.length)} (${fmt(proyectos(P))}) · ${ENT.map((en) => P.filter((f) => f.entrega === en).length).join(" / ")}`;
  })])));

  // 4 · Bono pie.
  const uf = cfg.uf;
  const pu = (clp: number) => `$${fmt(clp)} · UF ${fmt(clp / uf, clp / uf < 100 ? 1 : 0)}`;
  const pf = (x: number | null) => (x == null ? "no calculable" : fmt(x, 1) + " %");
  for (const b of bono) {
    console.log(`\n4 · Bono pie · ${b.comuna}: ${b.id.slice(0, 8)} (proyecto ${b.proyecto}), ${b.dorms}D · ${fmt(b.m2, b.m2 % 1 ? 1 : 0)} m², UF ${fmt(b.precioUF)}`);
    const cs = [b.casos.nada, b.casos.descuento10, b.casos.bono10];
    console.log(tablaMd(["", "sin nada (pie 20 %)", "descuento real de 10 % (pie 20 %)", "bono pie de 10 % (precio igual, pie 10 %)"], [
      ["precio", ...cs.map((c) => `UF ${fmt(c.precioUF)}`)],
      ["lo que pones hoy (pie + costos)", ...cs.map((c) => pu(c.poneHoyCLP))],
      ["crédito", ...cs.map((c) => pu(c.creditoCLP))],
      ["dividendo mensual", ...cs.map((c) => pu(c.dividendoCLP))],
      ["flujo mensual", ...cs.map((c) => pu(c.flujoCLP))],
      ["veredicto de hoy", ...cs.map((c) => `${c.v} · score ${c.s}`)],
      ["saldo del crédito al año 10", ...cs.map((c) => pu(c.saldo10CLP))],
      ["lo que recibes al vender (g 3 %, mayor cap)", ...cs.map((c) => pu(c.recibeCLP))],
      ["TIR con g 3 % (mayor cap)", ...cs.map((c) => pf(c.tirG3))],
      ["TIR con g 0 % (mayor cap)", ...cs.map((c) => pf(c.tirG0))],
      ["TIR del motor (su salida)", ...cs.map((c) => pf(c.tirMotor))],
    ]));
  }
}

main();
