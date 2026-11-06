// ─────────────────────────────────────────────────────────────────────────────
// ANEXO · LA CELDA DE CONTINUIDAD (lee out/14-anexo-salida.json; no recalcula nada). Con la salida como usado del radio y
// la regla del anexo (Buscar otra solo por CoC severo o sobreprecio comunal con flujo; Comprar si flujo ≥ tolerancia y
// TIR ≥ mínima; el resto Ajustar), para g = 3 % y g = 1 % y para flujo ≥ 0 y flujo ≥ −200.000: qué TIR mínima (4 a 8 %, de a
// uno) deja a los usados Comprar más cerca de los Comprar de hoy (los que se caen, los que entran y el neto), y cuántos
// nuevos Comprar da cada una, en total y por comuna, inmediata y futura. Solo lectura.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fmt, tablaMd } from "./comun";
import type { FilaAnexo } from "./14-anexo-salida";
import { regla, type G } from "./15-anexo-tablas";

const TIR_MIN = [4, 5, 6, 7, 8];
const TOL = [0, -200000];
const GS: Array<[G, string]> = [["r3", "3 %"], ["r1", "1 %"]];

function main() {
  const { filas } = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/14-anexo-salida.json", "utf8")) as { filas: FilaAnexo[] };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const usadosHoy = usados.filter((f) => f.v === "COMPRAR").length;
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q) => nuevos.filter((f) => f.comuna === q).length - nuevos.filter((f) => f.comuna === p).length);
  console.log(`universo: nuevos ${fmt(nuevos.length)} · usados ${fmt(usados.length)} · usados Comprar de hoy (motor) ${fmt(usadosHoy)} · nuevos Comprar de hoy ${nuevos.filter((f) => f.v === "COMPRAR").length}`);
  const inmFut = (xs: FilaAnexo[]) => `${xs.filter((f) => f.entrega === "inmediata").length} / ${xs.filter((f) => f.entrega === "futura").length}`;
  const inmFutSin = (xs: FilaAnexo[]) => `${inmFut(xs)} / ${xs.filter((f) => f.entrega === "sin dato").length}`;

  for (const [g, gl] of GS) {
    for (const tol of TOL) {
      const porTir = TIR_MIN.map((tm) => {
        const uC = usados.filter((f) => regla(f, g, tm, tol) === "COMPRAR");
        const caen = usados.filter((f) => f.v === "COMPRAR" && regla(f, g, tm, tol) !== "COMPRAR").length;
        const entran = usados.filter((f) => f.v !== "COMPRAR" && regla(f, g, tm, tol) === "COMPRAR").length;
        const nC = nuevos.filter((f) => regla(f, g, tm, tol) === "COMPRAR");
        return { tm, uC: uC.length, caen, entran, neto: uC.length - usadosHoy, nC };
      });
      const mejor = porTir.reduce((a, b) => (Math.abs(b.neto) < Math.abs(a.neto) ? b : a));
      console.log(`\nCelda de continuidad · salida como usado del radio, g = ${gl}, flujo ≥ ${fmt(tol)}. Usados Comprar contra los ${fmt(usadosHoy)} de hoy; nuevos Comprar en total (inmediata / futura / sin fecha). Más cerca: TIR ≥ ${mejor.tm} % (neto ${mejor.neto >= 0 ? "+" : ""}${fmt(mejor.neto)}).`);
      console.log(tablaMd(["TIR mínima", "usados Comprar", "se caen", "entran", "neto contra hoy", "nuevos Comprar", "inmediata / futura / sin dato", "nuevos Comprar (%)"], porTir.map((r) => [
        `${r.tm} %${r === mejor ? " ◀" : ""}`, fmt(r.uC), fmt(r.caen), fmt(r.entran), `${r.neto >= 0 ? "+" : ""}${fmt(r.neto)}`, r.nC.length, inmFutSin(r.nC), fmt((r.nC.length / nuevos.length) * 100, 1) + " %",
      ])));
      console.log(`Nuevos Comprar por comuna (inmediata / futura), g = ${gl}, flujo ≥ ${fmt(tol)}:`);
      console.log(tablaMd(["comuna", "nuevos", ...TIR_MIN.map((tm) => `TIR ≥ ${tm} %`)], [["Gran Santiago", nuevos] as [string, FilaAnexo[]], ...comunas.map((c) => [c, nuevos.filter((f) => f.comuna === c)] as [string, FilaAnexo[]])].map(([c, xs]) => [
        c, xs.length, ...TIR_MIN.map((tm) => { const nC = xs.filter((f) => regla(f, g, tm, tol) === "COMPRAR"); return `${nC.length} (${inmFut(nC)})`; }),
      ])));
    }
  }
}

main();
