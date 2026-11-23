// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 6 · LAS TABLAS DEL VALOR DEL MEDIO (lee out/27-valor-medio.json y, para los avisos de las fichas y listas que ya no tienen
// fila, out/18-salida-ingreso.json y out/14-anexo-salida.json). Solo lectura.
//   a · los dos testigos (valor por ingreso y valor del radio) contra el precio: los dos sobre, los dos bajo, no coinciden.
//   b · TIR mediana, p25 y p75 con g = 1 %, 3 % y 4,5 %, al lado de la del motor.
//   c · Camino A: veredicto de hoy + los que tienen TIR ≥ 5 % con g = 3 % y flujo ≥ −$100.000 / −$200.000 / −$300.000.
//   d · Camino B: Comprar si la TIR con g = 1 % es ≥ 5 % (y 4 % y 6 %) y no hay señal grave, sin condición de flujo.
//   e · c y d por comuna (nuevos en unidades y proyectos, con entrega).
//   f · las ocho fichas del anexo 2;  g · los 20 Ajustar de Lo Barnechea del anexo 3.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, fmt, mediana, pct, tablaMd, type Config } from "./comun";
import type { FilaMedio, G } from "./27-anexo6-valor-medio";
import { valorBase } from "./27-anexo6-valor-medio";
import type { FilaIngreso } from "./18-salida-ingreso";
import type { FilaAnexo } from "./14-anexo-salida";

const DIR = "scripts/analisis/motor-nuevos/out";
const GG: G[] = ["g1", "g3", "g45"];
const ROT_G: Record<G, string> = { g1: "g 1 % (pesimista)", g3: "g 3 % (normal)", g45: "g 4,5 %" };
const ENT = ["inmediata", "futura", "sin dato"] as const;
const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null && Number.isFinite(x)));
const q = (xs: (number | null | undefined)[], p: number) => cuantil(xs.filter((x): x is number => x != null && Number.isFinite(x)), p);
const pf = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x, d) + " %");
const grave = (f: FilaMedio) => f.gate1.cocSevero || f.gate1.sobreprecioComunalConFlujo;

function main() {
  const { filas, extras, golden, loBarnechea, cfg } = JSON.parse(readFileSync(`${DIR}/27-valor-medio.json`, "utf8")) as { filas: FilaMedio[]; extras: FilaMedio[]; golden: (FilaMedio & { ufCaso: number }) | null; loBarnechea: string[]; cfg: Config };
  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const proy = (xs: FilaMedio[]) => new Set(xs.map((f) => f.proyecto)).size;
  const cuentaMedio = (xs: FilaMedio[]) => ["precio", "ingreso", "radio", "menor: precio", "menor: ingreso", "menor: radio", "sin valor"].map((m) => `${m} ${fmt(xs.filter((f) => f.medio === m).length)}`).join(" · ");
  console.log(`universo: ${fmt(filas.length)} avisos (nuevos ${fmt(nuevos.length)} en ${fmt(proy(nuevos))} proyectos, con subsidio por defecto ${fmt(nuevos.filter((f) => f.elegible).length)}; usados ${fmt(usados.length)}) · UF ${fmt(cfg.uf)} · tasa ${cfg.tasa} %`);
  console.log(`valor del radio: nuevos ${["fila de hoy", "anexo 1", "en vivo"].map((s) => `${s} ${fmt(nuevos.filter((f) => f.radioFuente === s).length)}`).join(" · ")} · sin radio ${fmt(nuevos.filter((f) => f.radioUF == null).length)}; usados con radio ${fmt(usados.filter((f) => f.radioUF != null).length)}, sin radio ${fmt(usados.filter((f) => f.radioUF == null).length)} · sin cap de celda: nuevos ${fmt(nuevos.filter((f) => f.ingresoUF == null).length)}, usados ${fmt(usados.filter((f) => f.ingresoUF == null).length)}`);
  console.log(`qué quedó al medio — nuevos: ${cuentaMedio(nuevos)}`);
  console.log(`qué quedó al medio — usados: ${cuentaMedio(usados)}`);

  // a · Los dos testigos contra el precio.
  type Grupo = "los dos sobre el precio" | "los dos bajo el precio" | "no coinciden" | "un solo testigo" | "sin testigos";
  const grupo = (f: FilaMedio): Grupo => {
    if (f.ingresoUF == null && f.radioUF == null) return "sin testigos";
    if (f.ingresoUF == null || f.radioUF == null) return "un solo testigo";
    if (f.ingresoUF > f.precioUF && f.radioUF > f.precioUF) return "los dos sobre el precio";
    if (f.ingresoUF < f.precioUF && f.radioUF < f.precioUF) return "los dos bajo el precio";
    return "no coinciden";
  };
  const GRUPOS: Grupo[] = ["los dos sobre el precio", "los dos bajo el precio", "no coinciden", "un solo testigo", "sin testigos"];
  const dif = (x: number | null, p: number) => (x == null ? null : ((x - p) / p) * 100);
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaMedio[]]>) {
    console.log(`\na · ${u}: los dos testigos contra el precio (diferencias en % del precio, medianas)`);
    console.log(tablaMd(["grupo", "avisos", "%", "valor por ingreso vs precio", "valor del radio vs precio", "valor base vs precio"], GRUPOS.map((g) => {
      const G = xs.filter((f) => grupo(f) === g);
      return [g, fmt(G.length), pct(G.length, xs.length), pf(med(G.map((f) => dif(f.ingresoUF, f.precioUF)))), pf(med(G.map((f) => dif(f.radioUF, f.precioUF)))), pf(med(G.map((f) => dif(f.baseUF, f.precioUF))))];
    })));
  }
  const nNuevos = (c: string) => nuevos.filter((f) => f.comuna === c).length;
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, r) => nNuevos(r) - nNuevos(p) || usados.filter((f) => f.comuna === r).length - usados.filter((f) => f.comuna === p).length);
  const grupos = (xs: FilaMedio[]): Array<[string, FilaMedio[]]> => [["Gran Santiago", xs], ...comunas.map((c) => [c, xs.filter((f) => f.comuna === c)] as [string, FilaMedio[]]).filter(([, g]) => g.length > 0)];
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaMedio[]]>) {
    console.log(`\na · ${u} por comuna: los dos sobre / los dos bajo / no coinciden / un solo testigo; valor base vs precio (mediana)`);
    console.log(tablaMd(["comuna", "avisos", "los dos sobre", "los dos bajo", "no coinciden", "un testigo", "base vs precio", "ingreso vs precio", "radio vs precio"], grupos(xs).map(([c, g]) => [c, fmt(g.length), ...(["los dos sobre el precio", "los dos bajo el precio", "no coinciden", "un solo testigo"] as Grupo[]).map((gg) => fmt(g.filter((f) => grupo(f) === gg).length)), pf(med(g.map((f) => dif(f.baseUF, f.precioUF)))), pf(med(g.map((f) => dif(f.ingresoUF, f.precioUF)))), pf(med(g.map((f) => dif(f.radioUF, f.precioUF))))])));
  }

  // b · TIR.
  console.log("\nb · TIR a 10 años con el valor del medio: mediana · p25 · p75 (n con TIR); la del motor con su propia salida");
  console.log(tablaMd(["universo", ...GG.map((g) => ROT_G[g]), "TIR del motor"], (["nuevos", "usados"] as const).map((u) => {
    const xs = u === "nuevos" ? nuevos : usados;
    const c = (t: (number | null | undefined)[]) => `${pf(med(t))} · ${pf(q(t, 0.25))} · ${pf(q(t, 0.75))} (${fmt(t.filter((x) => x != null).length)})`;
    return [u, ...GG.map((g) => c(xs.map((f) => f.tir[g]))), c(xs.map((f) => f.tirMotor))];
  })));

  // c · Camino A.
  const TOLS = [-100000, -200000, -300000];
  const adicional = (tol: number) => (f: FilaMedio) => f.v !== "COMPRAR" && (f.tir.g3 ?? -Infinity) >= 5 && f.flujo != null && f.flujo >= tol;
  const uP = (xs: FilaMedio[], esNuevo: boolean) => (esNuevo ? `${fmt(xs.length)} (${fmt(proy(xs))}) · ${ENT.map((e) => xs.filter((f) => f.entrega === e).length).join(" / ")}` : fmt(xs.length));
  console.log("\nc · Camino A: Comprar de hoy (motor, con subsidio en los nuevos elegibles) + los que además tienen TIR ≥ 5 % con g = 3 % y flujo mínimo. Nuevos: unidades (proyectos) · inmediata / futura / sin fecha");
  console.log(tablaMd(["universo", "Comprar de hoy", ...TOLS.map((t) => `+ adicionales con flujo ≥ −$${fmt(-t)}`), ...TOLS.map((t) => `total con −$${fmt(-t)}`)], (["nuevos", "usados"] as const).map((u) => {
    const xs = u === "nuevos" ? nuevos : usados, n = u === "nuevos";
    const C = xs.filter((f) => f.v === "COMPRAR");
    return [u, uP(C, n), ...TOLS.map((t) => uP(xs.filter(adicional(t)), n)), ...TOLS.map((t) => uP([...C, ...xs.filter(adicional(t))], n))];
  })));

  // d · Camino B.
  const TIRS = [5, 4, 6];
  const B = (T: number) => (f: FilaMedio) => !grave(f) && (f.tir.g1 ?? -Infinity) >= T;
  const tramo = (fl: number | null) => (fl == null ? "sin flujo" : fl >= 0 ? "≥ 0" : fl >= -100000 ? "0 a −$100.000" : fl >= -200000 ? "−$100.000 a −$200.000" : fl >= -300000 ? "−$200.000 a −$300.000" : "peor que −$300.000");
  const TRAMOS = ["≥ 0", "0 a −$100.000", "−$100.000 a −$200.000", "−$200.000 a −$300.000", "peor que −$300.000"];
  for (const T of TIRS) {
    console.log(`\nd · Camino B con TIR ≥ ${T} % en el escenario pesimista (g = 1 %), sin señal grave y sin condición de flujo`);
    console.log(tablaMd(["universo", "Comprar", "Comprar de hoy", "se caen", "por señal grave", "por TIR pesimista baja", "sin valor base", "entran", "flujo de los que entran: mediana · p25 · p75", ...TRAMOS.map((t) => `entran con flujo ${t}`)], (["nuevos", "usados"] as const).map((u) => {
      const xs = u === "nuevos" ? nuevos : usados, n = u === "nuevos";
      const C = xs.filter(B(T)), hoy = xs.filter((f) => f.v === "COMPRAR");
      const caen = hoy.filter((f) => !B(T)(f)), entran = xs.filter((f) => f.v !== "COMPRAR" && B(T)(f));
      const fl = entran.map((f) => f.flujo);
      return [u, uP(C, n), uP(hoy, n), fmt(caen.length), fmt(caen.filter(grave).length), fmt(caen.filter((f) => !grave(f) && f.tir.g1 != null).length), fmt(caen.filter((f) => !grave(f) && f.tir.g1 == null).length), uP(entran, n), `$${fmt(med(fl))} · $${fmt(q(fl, 0.25))} · $${fmt(q(fl, 0.75))}`, ...TRAMOS.map((t) => fmt(entran.filter((f) => tramo(f.flujo) === t).length))];
    })));
  }

  // e · Por comuna.
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaMedio[]]>) {
    const n = u === "nuevos";
    console.log(`\ne · ${u} por comuna — Camino A (Comprar de hoy + adicionales) y Camino B (TIR pesimista ≥ 4, 5 y 6 %)${n ? ". Celda: unidades (proyectos) · inmediata / futura / sin fecha" : ""}`);
    console.log(tablaMd(["comuna", "avisos", "Comprar de hoy", ...TOLS.map((t) => `A: + con −$${fmt(-t)}`), ...TIRS.map((T) => `B: TIR ≥ ${T} %`)], grupos(xs).map(([c, g]) => [c, fmt(g.length), uP(g.filter((f) => f.v === "COMPRAR"), n), ...TOLS.map((t) => uP(g.filter(adicional(t)), n)), ...TIRS.map((T) => uP(g.filter(B(T)), n))])));
  }

  // f · Las ocho fichas del anexo 2 y g · los 20 de Lo Barnechea.
  const porId = new Map([...filas, ...extras].map((f) => [f.id, f]));
  const f18 = new Map((JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { filas: FilaIngreso[] }).filas.map((f) => [f.id, f]));
  const f14 = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.map((f) => [f.id, f]));
  /** Para un aviso ya dado de baja: el valor base con lo guardado (precio, valor por ingreso del anexo 2, radio del anexo 1). */
  const deGuardado = (id: string) => {
    const a = f18.get(id), b = f14.get(id);
    if (!a) return null;
    const radio = b?.fuente === "radio" ? b.valorUsadoHoyUF : null;
    const { base, medio } = valorBase(a.precioUF, a.valorIngresoHoyUF, radio);
    return { comuna: a.comuna, precioUF: a.precioUF, ingresoUF: a.valorIngresoHoyUF, radioUF: radio, baseUF: base != null ? Math.round(base) : null, medio };
  };
  const filaTabla = (etiqueta: string, id: string) => {
    const f = id === golden?.id ? golden : porId.get(id);
    if (f) return [etiqueta, `${id.slice(0, 8)} · ${f.comuna}${f.origen.startsWith("extra") ? " (hoy no publicado)" : f.origen === "golden" ? " (golden)" : ""}`, `UF ${fmt(f.precioUF)}`, f.ingresoUF != null ? `UF ${fmt(f.ingresoUF)}` : "—", f.radioUF != null ? `UF ${fmt(f.radioUF)}` : "—", f.baseUF != null ? `UF ${fmt(f.baseUF)}` : "—", f.medio, pf(f.baseUF != null ? ((f.baseUF - f.precioUF) / f.precioUF) * 100 : null), ...GG.map((g) => pf(f.tir[g])), pf(f.tirMotor)];
    const s = deGuardado(id);
    if (s) return [etiqueta, `${id.slice(0, 8)} · ${s.comuna} (dado de baja: valores guardados)`, `UF ${fmt(s.precioUF)}`, s.ingresoUF != null ? `UF ${fmt(s.ingresoUF)}` : "—", s.radioUF != null ? `UF ${fmt(s.radioUF)}` : "—", s.baseUF != null ? `UF ${fmt(s.baseUF)}` : "—", s.medio, pf(s.baseUF != null ? ((s.baseUF - s.precioUF) / s.precioUF) * 100 : null), "sin fila", "sin fila", "sin fila", "—"];
    return [etiqueta, id.slice(0, 8), "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"];
  };
  const cab = ["", "aviso", "precio", "valor por ingreso", "valor del radio", "valor base", "quedó al medio", "base vs precio", ...GG.map((g) => `TIR ${ROT_G[g]}`), "TIR del motor"];
  const fichas = (JSON.parse(readFileSync(`${DIR}/20-fichas.json`, "utf8")) as { fichas: Array<{ letra: string; id: string }> }).fichas;
  console.log("\nf · Las ocho fichas del anexo 2 con el valor del medio");
  console.log(tablaMd(cab, fichas.map((fi) => filaTabla(`(${fi.letra})`, fi.id))));
  console.log("\ng · Los 20 usados Ajustar con la TIR más alta a g 0 % del anexo 3 (casi todos de Lo Barnechea): su valor base");
  console.log(tablaMd(cab, loBarnechea.map((id, i) => filaTabla(String(i + 1), id))));
}

main();
