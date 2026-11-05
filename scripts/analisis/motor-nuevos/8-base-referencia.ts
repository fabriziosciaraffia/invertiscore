// ─────────────────────────────────────────────────────────────────────────────
// PUNTO 2 DEL STOP 2 · LA BASE DE REFERENCIA SOBRE EL UNIVERSO COMPLETO. Junta las 2.072 unidades evaluadas (0b de
// 1-base-corregida.json: m² corregido, mediana en vivo, UF y tasa de hoy, premio 3 %) con las que evaluó
// 6-universo-completo.ts (la pasada real sobre las reactivadas y las viejas), y compara el universo de 2.072 contra el
// completo: Comprar, entrega, Ajustar, Buscar otra, los gates de flujo y por comuna. Lo que sale es la base de las FASES 3 y 4.
// Solo lectura. Salida: out/8-base-referencia.json
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fmt, pct, tablaMd } from "./comun";
import type { FilaBase } from "./1-base-corregida";
import type { FilaCompleta } from "./6-universo-completo";

export interface FilaReferencia {
  id: string; cond: "usado" | "nuevo"; comuna: string; entrega: "inmediata" | "futura" | "sin dato"; dorms: number; m2: number; precioUF: number;
  origen: "evaluada" | "reactivada" | "vieja sin cruce"; limpio: boolean;
  v: string | null; s: number | null; f: number | null;
  gate1: FilaBase["gate1"];
}

function main() {
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { cfg: unknown; filas: FilaBase[] };
  const completo = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/6-universo-completo.json", "utf8")) as { filas: FilaCompleta[] };
  const ref: FilaReferencia[] = [
    ...base.filas.map((f) => ({ id: f.id, cond: f.cond, comuna: f.comuna, entrega: f.entrega, dorms: f.dorms, m2: f.m2, precioUF: f.precioUF, origen: "evaluada" as const, limpio: !f.sospechoso && !f.degradado && f.arriendo > 0, v: f.b.v, s: f.b.s, f: f.b.f, gate1: f.gate1 })),
    ...completo.filas.map((f) => ({ id: f.id, cond: "nuevo" as const, comuna: f.comuna, entrega: f.entrega, dorms: f.dorms, m2: f.m2, precioUF: f.precioUF, origen: f.grupo, limpio: !f.evaluacion.arriendo_sospechoso && !f.evaluacion.radio_degradado && !!f.evaluacion.arriendo, v: f.evaluacion.veredicto_20, s: f.evaluacion.score_20, f: f.evaluacion.flujo_20, gate1: f.gate1 })),
  ];
  const nuevos = ref.filter((f) => f.cond === "nuevo" && f.limpio);
  const u2072 = nuevos.filter((f) => f.origen === "evaluada");
  const fila = (nombre: string, xs: FilaReferencia[]) => {
    const c = xs.filter((f) => f.v === "COMPRAR");
    return [nombre, xs.length, `${c.length} (${pct(c.length, xs.length)})`, c.filter((f) => f.entrega === "inmediata").length, c.filter((f) => f.entrega === "futura").length, c.filter((f) => f.entrega === "sin dato").length,
      xs.filter((f) => f.v === "AJUSTA SUPUESTOS").length, xs.filter((f) => f.v === "BUSCAR OTRA").length, xs.filter((f) => f.gate1.breakEvenImposible).length, xs.filter((f) => f.gate1.flujoSevero).length, xs.filter((f) => f.gate1.sobreprecioComunalConFlujo).length];
  };
  const cab = ["universo", "nuevos limpios", "Comprar", "inmediata", "futura", "sin dato", "Ajustar", "Buscar otra", "break-even imposible", "flujo severo", "sobreprecio con flujo"];
  console.log(`control de la cadena (evaluarAviso = contextoDeFila): ${completo.filas.filter((f) => f.control).length} de ${completo.filas.length}`);
  console.log(tablaMd(cab, [fila("2.072 evaluadas (0b)", u2072), fila("reactivadas por el cruce", nuevos.filter((f) => f.origen === "reactivada")), fila("viejas sin cruce", nuevos.filter((f) => f.origen === "vieja sin cruce")), fila("UNIVERSO COMPLETO", nuevos)]));
  const comunas = [...new Set(nuevos.map((f) => f.comuna))].sort((p, q) => nuevos.filter((f) => f.comuna === q).length - nuevos.filter((f) => f.comuna === p).length);
  console.log("\nPor comuna (nuevos limpios): universo 2.072 contra completo");
  console.log(tablaMd(["comuna", "n 2.072", "Comprar 2.072", "n completo", "Comprar completo", "% completo", "inmediata / futura (completo)"], comunas.map((c) => {
    const a = u2072.filter((f) => f.comuna === c), b = nuevos.filter((f) => f.comuna === c), bc = b.filter((f) => f.v === "COMPRAR");
    return [c, a.length, a.filter((f) => f.v === "COMPRAR").length, b.length, bc.length, pct(bc.length, b.length), `${bc.filter((f) => f.entrega === "inmediata").length} / ${bc.filter((f) => f.entrega === "futura").length}`];
  })));
  const usados = ref.filter((f) => f.cond === "usado" && f.limpio);
  console.log(`\nusados limpios ${fmt(usados.length)}, Comprar ${fmt(usados.filter((f) => f.v === "COMPRAR").length)} (sin cambio: 0b)`);
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/8-base-referencia.json", JSON.stringify({ cfg: base.cfg, calculadoAt: new Date().toISOString(), filas: ref }));
  console.log(`guardado: ${fmt(ref.length)} filas (nuevos ${fmt(ref.filter((f) => f.cond === "nuevo").length)}, usados ${fmt(ref.filter((f) => f.cond === "usado").length)})`);
}

main();
