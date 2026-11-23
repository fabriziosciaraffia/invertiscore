// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 6 · CONTROL: el veredicto de hoy recalculado (out/27-valor-medio.json) contra el que guarda la noche en
// `avisos_evaluados.veredicto_20` (pie 20 %, 30 años), aviso por aviso, separado por la fecha de la evaluación de la noche. Solo lectura.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fmt, tablaMd, universoActivo } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import type { FilaMedio } from "./27-anexo6-valor-medio";

async function main() {
  const { filas } = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/27-valor-medio.json", "utf8")) as { filas: FilaMedio[] };
  const mio = new Map(filas.map((f) => [f.id, f]));
  const activas = await universoActivo(createServiceClient());
  const tramos: Array<[string, (d: Date) => boolean]> = [
    ["evaluados antes del 07-nov", (d) => d < new Date("2026-11-07")],
    ["del 07 al 20-nov", (d) => d >= new Date("2026-11-07") && d < new Date("2026-11-21")],
    ["del 21-nov en adelante", (d) => d >= new Date("2026-11-21")],
  ];
  for (const cond of ["usado", "nuevo"] as const) {
    const pares = activas.filter((f) => f.condicion === cond && mio.has(f.aviso_id) && !mio.get(f.aviso_id)!.elegible).map((f) => ({ noche: f.veredicto_20, hoy: mio.get(f.aviso_id)!.v, d: new Date(f.evaluado_at), sup0: mio.get(f.aviso_id)!.sup0 }));
    console.log(`\n${cond}s (sin los nuevos elegibles al subsidio, que hoy van con otra tasa): ${fmt(pares.length)} avisos`);
    console.log(tablaMd(["fecha de la evaluación de la noche", "avisos", "Comprar de la noche", "Comprar recalculado hoy", "coinciden", "Comprar noche → no hoy", "no noche → Comprar hoy", "con superficie corregida"], tramos.map(([n, t]) => {
      const xs = pares.filter((p) => t(p.d));
      return [n, fmt(xs.length), fmt(xs.filter((p) => p.noche === "COMPRAR").length), fmt(xs.filter((p) => p.hoy === "COMPRAR").length), fmt(xs.filter((p) => p.noche === p.hoy).length), fmt(xs.filter((p) => p.noche === "COMPRAR" && p.hoy !== "COMPRAR").length), fmt(xs.filter((p) => p.noche !== "COMPRAR" && p.hoy === "COMPRAR").length), fmt(xs.filter((p) => p.sup0).length)];
    })));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
