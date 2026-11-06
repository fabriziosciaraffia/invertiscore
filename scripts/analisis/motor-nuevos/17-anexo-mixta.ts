// ─────────────────────────────────────────────────────────────────────────────
// ANEXO · DOS TABLAS MÁS, sin recalcular (leen out/14-anexo-salida.json y out/11-fase4.json):
//   1. Los usados Comprar de hoy que se caen con g = 3 %, flujo ≥ 0 y TIR ≥ 4 % pero no con flujo ≥ −200.000 y TIR ≥ 5 %:
//      cuántos tienen flujo negativo (el `flujo` de la grilla es `metrics.flujoNetoMensual` del motor, el mismo número que
//      lee el gate 3 y que la noche guarda en `flujo_30`) y cuántos TIR < 4 %.
//   2. La celda de continuidad con salida MIXTA: usados con la salida del motor (precio × (1+g)^10 − sobreprecio: g 3 % =
//      `tirMotor` de 14-anexo-salida, g 1 % = la versión `g1` de 11-fase4) y nuevos con la salida como usado del radio
//      (r3 / r1 de 14-anexo-salida). Misma regla del anexo; TIR mínima 4 a 8 %; flujo ≥ 0 y ≥ −200.000. Solo lectura.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, fmt, mediana, tablaMd } from "./comun";
import type { FilaAnexo } from "./14-anexo-salida";
import type { FilaFase4 } from "./11-fase4";
import { grave, regla, type G } from "./15-anexo-tablas";

const TIR_MIN = [4, 5, 6, 7, 8];
const TOL = [0, -200000];
const MARCA = 6;

function main() {
  const { filas } = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/14-anexo-salida.json", "utf8")) as { filas: FilaAnexo[] };
  const fase4 = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/11-fase4.json", "utf8")) as { cfg: { uf: number }; filas: FilaFase4[] };
  const g1Motor = new Map(fase4.filas.map((f) => [f.id, f.base.g1?.tir ?? null]));
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const hoy = usados.filter((f) => f.v === "COMPRAR");

  // 1 · Los que se caen con (g 3 %, flujo ≥ 0, TIR ≥ 4 %) y no con (g 3 %, flujo ≥ −200.000, TIR ≥ 5 %).
  const caen40 = hoy.filter((f) => regla(f, "r3", 4, 0) !== "COMPRAR");
  const caen5 = hoy.filter((f) => regla(f, "r3", 5, -200000) !== "COMPRAR");
  const solo40 = caen40.filter((f) => regla(f, "r3", 5, -200000) === "COMPRAR");
  const tir3 = (f: FilaAnexo) => f.r3?.tir ?? null;
  const fila = (nombre: string, xs: FilaAnexo[]) => [
    nombre, xs.length,
    xs.filter((f) => f.flujo != null && f.flujo < 0).length, xs.filter((f) => f.flujo != null && f.flujo < -200000).length,
    xs.filter((f) => tir3(f) != null && tir3(f)! < 4).length, xs.filter((f) => tir3(f) == null).length,
    xs.filter((f) => f.flujo != null && f.flujo < 0 && tir3(f) != null && tir3(f)! >= 5).length,
    xs.filter((f) => f.flujo != null && f.flujo >= 0 && tir3(f) != null && tir3(f)! < 4).length,
    xs.filter(grave).length,
    xs.length ? fmt(mediana(xs.map((f) => f.flujo!))) : "—", xs.length ? fmt(cuantil(xs.map((f) => f.flujo!), 0.25)) : "—", xs.length ? fmt(cuantil(xs.map((f) => f.flujo!), 0.75)) : "—",
  ];
  console.log(`1 · Usados Comprar de hoy: ${fmt(hoy.length)}; con flujo del motor < 0: ${fmt(hoy.filter((f) => f.flujo != null && f.flujo < 0).length)} (Comprar por banda de score, sin el gate 3); con flujo < −200.000: ${hoy.filter((f) => f.flujo != null && f.flujo < -200000).length}.`);
  console.log(tablaMd(["grupo (g = 3 %)", "n", "flujo < 0", "flujo < −200.000", "TIR < 4 %", "sin TIR", "flujo < 0 y TIR ≥ 5 %", "flujo ≥ 0 y TIR < 4 %", "señal grave", "flujo mediana", "p25", "p75"], [
    fila("se caen con flujo ≥ 0 y TIR ≥ 4 %", caen40),
    fila("se caen con flujo ≥ −200.000 y TIR ≥ 5 %", caen5),
    fila("se caen con la primera y no con la segunda", solo40),
  ]));

  // 2 · Continuidad con salida mixta.
  const tirMixta = (f: FilaAnexo, g: G): number | null => (f.cond === "nuevo" ? f[g]?.tir ?? null : g === "r3" ? f.tirMotor : g1Motor.get(f.id) ?? null);
  const reglaMixta = (f: FilaAnexo, g: G, tm: number, tol: number) => {
    if (grave(f)) return "BUSCAR OTRA";
    const t = tirMixta(f, g);
    return f.flujo != null && f.flujo >= tol && t != null && t >= tm ? "COMPRAR" : "AJUSTA SUPUESTOS";
  };
  const inmFutSin = (xs: FilaAnexo[]) => `${xs.filter((f) => f.entrega === "inmediata").length} / ${xs.filter((f) => f.entrega === "futura").length} / ${xs.filter((f) => f.entrega === "sin dato").length}`;
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q) => nuevos.filter((f) => f.comuna === q).length - nuevos.filter((f) => f.comuna === p).length);
  console.log(`\n2 · Salida mixta: usados con la salida del motor (g 3 % = TIR del motor; g 1 % = versión g1 de la FASE 4, UF ${fmt(fase4.cfg.uf)}; ${usados.filter((f) => g1Motor.get(f.id) == null).length} usados sin g1), nuevos con la salida como usado del radio. Usados Comprar de hoy: ${fmt(hoy.length)}.`);
  for (const [g, gl] of [["r3", "3 %"], ["r1", "1 %"]] as Array<[G, string]>) {
    for (const tol of TOL) {
      const porTir = TIR_MIN.map((tm) => {
        const uC = usados.filter((f) => reglaMixta(f, g, tm, tol) === "COMPRAR");
        const caen = hoy.filter((f) => reglaMixta(f, g, tm, tol) !== "COMPRAR").length;
        const entran = usados.filter((f) => f.v !== "COMPRAR" && reglaMixta(f, g, tm, tol) === "COMPRAR").length;
        const nC = nuevos.filter((f) => reglaMixta(f, g, tm, tol) === "COMPRAR");
        return { tm, uC: uC.length, caen, entran, neto: uC.length - hoy.length, nC };
      });
      const mejor = porTir.reduce((a, b) => (Math.abs(b.neto) < Math.abs(a.neto) ? b : a));
      console.log(`\nContinuidad con salida mixta · g = ${gl}, flujo ≥ ${fmt(tol)}. Más cerca de los ${fmt(hoy.length)}: TIR ≥ ${mejor.tm} % (neto ${mejor.neto >= 0 ? "+" : ""}${fmt(mejor.neto)}); la fila marcada es TIR ≥ ${MARCA} %.`);
      console.log(tablaMd(["TIR mínima", "usados Comprar", "se caen", "entran", "neto contra hoy", "nuevos Comprar", "inmediata / futura / sin fecha", "nuevos Comprar (%)"], porTir.map((r) => [
        `${r.tm} %${r.tm === MARCA ? " ◀" : ""}`, fmt(r.uC), fmt(r.caen), fmt(r.entran), `${r.neto >= 0 ? "+" : ""}${fmt(r.neto)}`, r.nC.length, inmFutSin(r.nC), fmt((r.nC.length / nuevos.length) * 100, 1) + " %",
      ])));
      console.log(`Nuevos Comprar por comuna (inmediata / futura), g = ${gl}, flujo ≥ ${fmt(tol)} (los nuevos llevan la misma salida que en § 5, así que esta tabla es la misma):`);
      console.log(tablaMd(["comuna", "nuevos", ...TIR_MIN.map((tm) => `TIR ≥ ${tm} %`)], [["Gran Santiago", nuevos] as [string, FilaAnexo[]], ...comunas.map((c) => [c, nuevos.filter((f) => f.comuna === c)] as [string, FilaAnexo[]])].map(([c, xs]) => [
        c, xs.length, ...TIR_MIN.map((tm) => { const nC = xs.filter((f) => reglaMixta(f, g, tm, tol) === "COMPRAR"); return `${nC.length} (${nC.filter((f) => f.entrega === "inmediata").length} / ${nC.filter((f) => f.entrega === "futura").length})`; }),
      ])));
    }
  }
}

main();
