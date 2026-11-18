// ─────────────────────────────────────────────────────────────────────────────
// ANEXO 4 · LAS TABLAS DE LA SALIDA AL MAYOR CAP, al lado de las dos salidas anteriores (lee out/18-salida-ingreso.json,
// out/14-anexo-salida.json, out/23-mayor-cap.json y out/20-fichas.json). Solo lectura.
//   Tres salidas: «ingreso» (anexo 2: arriendo del año 11 ÷ cap de mercado de la celda, sin tope), «tope» (la misma limitada a
//   1,10 × el valor por comparables usados del radio × (1+g)^10; el anexo 3 la hizo con g 0 %) y «mayor cap» (arriendo del año
//   11 ÷ el mayor entre el cap de entrada del depto y el de su celda).
//   La TIR es exacta donde la fila se reprodujo (23-anexo4-mayor-cap.ts) y estimada donde no: con cada g hay dos salidas
//   guardadas del mismo vector de flujos (cap de hoy y cap + 50 pb), y la TIR se interpola en el logaritmo del valor de salida.
//   La validación de la estimación contra las exactas se imprime primero.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { cuantil, fmt, mediana, pct, tablaMd, type Config } from "./comun";
import type { Escenario, FilaIngreso } from "./18-salida-ingreso";
import type { FilaAnexo } from "./14-anexo-salida";
import { GS, TOPE_RADIO, capEntrada, topeMuerde, type G, type PorG, type Recalculo } from "./23-anexo4-mayor-cap";

const DIR = "scripts/analisis/motor-nuevos/out";
const HORIZONTE = 10;
type Salida = "ingreso" | "tope" | "mayor";
const SALIDAS: Salida[] = ["ingreso", "tope", "mayor"];
const ROT_S: Record<Salida, string> = { ingreso: "ingreso (cap de mercado)", tope: "ingreso con tope 1,10", mayor: "mayor cap" };
const GG: G[] = ["g3", "g1", "g0"];
const ROT_G: Record<G, string> = { g3: "g 3 %", g1: "g 1 %", g0: "g 0 %" };
const TIRS = [4, 5, 6];
type Flujo = "vara" | "200";
interface Combo { tir: number; flujo: Flujo }
const COMBOS: Combo[] = (["vara", "200"] as Flujo[]).flatMap((flujo) => TIRS.map((tir) => ({ tir, flujo })));
const rotCombo = (c: Combo) => `TIR ≥ ${c.tir} %, ${c.flujo === "vara" ? "vara" : "−$200.000"}`;
const CENTRAL: Combo = { tir: 5, flujo: "vara" };

const rel = (f: FilaIngreso) => (f.flujo != null && f.ingreso != null && f.ingreso > 0 ? f.flujo / f.ingreso : null);
const enVara = (f: FilaIngreso) => (rel(f) ?? -Infinity) >= -0.05;
const pasaFlujo = (f: FilaIngreso, fl: Flujo) => (fl === "vara" ? enVara(f) : f.flujo != null && f.flujo >= -200000);
const enBanda = (f: FilaIngreso) => !enVara(f) && rel(f) != null && f.flujo! >= -200000;
const pf = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x, d) + " %");
const med = (xs: (number | null | undefined)[]) => mediana(xs.filter((x): x is number => x != null && Number.isFinite(x)));
const q = (xs: (number | null | undefined)[], p: number) => cuantil(xs.filter((x): x is number => x != null && Number.isFinite(x)), p);

function main() {
  const { filas, cfg } = JSON.parse(readFileSync(`${DIR}/18-salida-ingreso.json`, "utf8")) as { cfg: Config; filas: FilaIngreso[] };
  const radio = new Map((JSON.parse(readFileSync(`${DIR}/14-anexo-salida.json`, "utf8")) as { filas: FilaAnexo[] }).filas.map((f) => [f.id, f.valorUsadoHoyUF]));
  const { recalculo: R, golden } = JSON.parse(readFileSync(`${DIR}/23-mayor-cap.json`, "utf8")) as { recalculo: Record<string, Recalculo>; golden: { capEntrada: number; cap: number; g: Record<G, PorG> } | null };
  const ce = (f: FilaIngreso) => capEntrada(f, cfg.uf);
  const cambiaMayor = (f: FilaIngreso) => f.cap.cap != null && ce(f) > f.cap.cap;

  /** TIR estimada a otro valor de salida: interpolación en log del valor entre las dos salidas guardadas del mismo vector. */
  const estimada = (f: FilaIngreso, g: G, valorUF: number): number | null => {
    const vh = f.valorUF[`${g}h` as Escenario], vm = f.valorUF[`${g}m` as Escenario], th = f.tir[`${g}h` as Escenario], tm = f.tir[`${g}m` as Escenario];
    if (vh == null || vm == null || th == null || tm == null || !(vh > vm) || !(valorUF > 0)) return null;
    return th + ((Math.log(valorUF) - Math.log(vh)) * (th - tm)) / (Math.log(vh) - Math.log(vm));
  };
  const valorObjetivo = (f: FilaIngreso, s: Salida, g: G): number | null => {
    const vh = f.valorUF[`${g}h` as Escenario];
    if (vh == null) return null;
    if (s === "mayor") return (vh * f.cap.cap!) / ce(f);
    const r = radio.get(f.id);
    return r != null ? TOPE_RADIO * r * Math.pow(1 + GS[g], HORIZONTE) : null;
  };
  /** La TIR de una salida y un g, y si es estimada. */
  const tir = (f: FilaIngreso, s: Salida, g: G): { t: number | null; est: boolean } => {
    const base = f.tir[`${g}h` as Escenario] ?? null;
    if (f.cap.cap == null) return { t: null, est: false };
    if (s === "ingreso") return { t: base, est: false };
    const muerde = s === "mayor" ? cambiaMayor(f) : topeMuerde(f, radio.get(f.id), g);
    if (!muerde) return { t: base, est: false };
    const rec = R[f.id];
    if (rec?.estado === "ok") return { t: (s === "mayor" ? rec.g[g]?.mayor : rec.g[g]?.tope) ?? null, est: false };
    const v = valorObjetivo(f, s, g);
    return { t: v != null ? estimada(f, g, v) : null, est: true };
  };

  const nuevos = filas.filter((f) => f.cond === "nuevo"), usados = filas.filter((f) => f.cond === "usado");
  const regs = Object.values(R);
  console.log(`universo: ${fmt(filas.length)} avisos (nuevos ${fmt(nuevos.length)}, usados ${fmt(usados.length)}; con cap de mercado ${fmt(filas.filter((f) => f.cap.cap != null).length)}) · UF ${fmt(cfg.uf)}`);
  console.log(`la regla del mayor cap cambia la salida en ${fmt(filas.filter(cambiaMayor).length)} avisos (nuevos ${fmt(nuevos.filter(cambiaMayor).length)}, usados ${fmt(usados.filter(cambiaMayor).length)}); el tope 1,10 muerde en ${GG.map((g) => `${ROT_G[g]} ${fmt(filas.filter((f) => f.cap.cap != null && topeMuerde(f, radio.get(f.id), g)).length)}`).join(" · ")}`);
  console.log(`recalculados: ${fmt(regs.length)} avisos · exactos ${fmt(regs.filter((r) => r.estado === "ok").length)} · estimados ${fmt(regs.filter((r) => r.estado !== "ok").length)} (no reproducibles ${fmt(regs.filter((r) => r.estado === "no reproducible").length)}, sin fila ${fmt(regs.filter((r) => r.estado === "sin fila").length)})`);

  // Validación.
  console.log("\nValidación de la TIR estimada contra la exacta (avisos recalculados exactos):");
  const filasVal: (string | number)[][] = [];
  for (const s of ["mayor", "tope"] as Salida[]) for (const g of GG) {
    const xs = filas.filter((f) => R[f.id]?.estado === "ok" && (s === "mayor" ? cambiaMayor(f) : topeMuerde(f, radio.get(f.id), g))).map((f) => {
      const exacta = (s === "mayor" ? R[f.id].g[g]?.mayor : R[f.id].g[g]?.tope) ?? null;
      const v = valorObjetivo(f, s, g);
      return { f, exacta, est: v != null ? estimada(f, g, v) : null };
    }).filter((x) => x.exacta != null && x.est != null);
    const e = xs.map((x) => Math.abs(x.est! - x.exacta!)).sort((a, b) => a - b);
    const qe = (p: number) => (e.length ? fmt(e[Math.floor(p * (e.length - 1))], 2) : "—");
    const decide = (t: number, f: FilaIngreso) => (g === "g0" ? t >= 5 && enVara(f) : t >= 5 && enVara(f));
    const a = xs.filter((x) => decide(x.exacta!, x.f)).length, b = xs.filter((x) => decide(x.est!, x.f)).length;
    const dif = xs.filter((x) => decide(x.exacta!, x.f) !== decide(x.est!, x.f)).length;
    filasVal.push([ROT_S[s], ROT_G[g], fmt(xs.length), qe(0.5), qe(0.9), qe(0.99), fmt(a), fmt(b), `${fmt(dif)} (${pct(dif, xs.length, 2)})`]);
  }
  console.log(tablaMd(["salida", "escenario", "n", "|error| mediano (pt)", "p90", "p99", "TIR ≥ 5 % y vara: con la exacta", "con la estimada", "decisiones distintas"], filasVal));

  // a · TIR mediana, p25 y p75.
  console.log("\na · TIR a 10 años: mediana · p25 · p75 (n con TIR)");
  console.log(tablaMd(["universo", "escenario", ...SALIDAS.map((s) => ROT_S[s])], (["nuevos", "usados"] as const).flatMap((u) => GG.map((g) => {
    const xs = u === "nuevos" ? nuevos : usados;
    return [u, ROT_G[g], ...SALIDAS.map((s) => { const t = xs.map((f) => tir(f, s, g).t); return `${pf(med(t))} · ${pf(q(t, 0.25))} · ${pf(q(t, 0.75))} (${fmt(t.filter((x) => x != null).length)})`; })];
  }))));

  // b · Cuántos cambia la regla frente al cap de mercado, por comuna.
  const nNuevos = (c: string) => nuevos.filter((f) => f.comuna === c).length;
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, r) => nNuevos(r) - nNuevos(p) || usados.filter((f) => f.comuna === r).length - usados.filter((f) => f.comuna === p).length);
  const grupos = (xs: FilaIngreso[]): Array<[string, FilaIngreso[]]> => [["Gran Santiago", xs], ...comunas.map((c) => [c, xs.filter((f) => f.comuna === c)] as [string, FilaIngreso[]]).filter(([, g]) => g.length > 0)];
  console.log("\nb · Avisos donde el cap de entrada supera al de su celda (la regla cambia la salida), por comuna");
  console.log(tablaMd(["comuna", "nuevos con cap", "cambia (n · %)", "cap de entrada nuevos (mediana)", "usados con cap", "cambia (n · %)", "cap de entrada usados (mediana)", "cap de la celda (mediana)"], grupos(filas).map(([c, xs]) => {
    const n = xs.filter((f) => f.cond === "nuevo" && f.cap.cap != null), u = xs.filter((f) => f.cond === "usado" && f.cap.cap != null);
    return [c, fmt(n.length), `${fmt(n.filter(cambiaMayor).length)} · ${pct(n.filter(cambiaMayor).length, n.length)}`, pf(med(n.map(ce)), 2), fmt(u.length), `${fmt(u.filter(cambiaMayor).length)} · ${pct(u.filter(cambiaMayor).length, u.length)}`, pf(med(u.map(ce)), 2), pf(med(xs.map((f) => f.cap.cap)), 2)];
  })));

  // c · Regla A.
  const comprar = (f: FilaIngreso, s: Salida, c: Combo) => { const t = tir(f, s, "g0").t; return t != null && t >= c.tir && pasaFlujo(f, c.flujo); };
  const celda = (xs: FilaIngreso[], s: Salida, c: Combo) => {
    const C = xs.filter((f) => comprar(f, s, c));
    return { comprar: C.length, caen: xs.filter((f) => f.v === "COMPRAR" && !comprar(f, s, c)).length, entran: xs.filter((f) => f.v === "AJUSTA SUPUESTOS" && comprar(f, s, c)).length, est: C.filter((f) => tir(f, s, "g0").est).length, C };
  };
  const txt = (r: ReturnType<typeof celda>) => `${fmt(r.comprar)} (−${fmt(r.caen)} / +${fmt(r.entran)})${r.est ? ` [${fmt(r.est)} est.]` : ""}`;
  console.log("\nc · Regla A (TIR con g 0 % y flujo) en total. Celda: Comprar (− Comprar de hoy que se caen / + Ajustar de hoy que entran) [est. = Comprar con TIR estimada]");
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    console.log(`\n${u} (Comprar de hoy ${fmt(xs.filter((f) => f.v === "COMPRAR").length)}):`);
    console.log(tablaMd(["regla", ...SALIDAS.map((s) => ROT_S[s])], COMBOS.map((c) => [rotCombo(c), ...SALIDAS.map((s) => txt(celda(xs, s, c)))])));
  }
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    console.log(`\nc · Por comuna, ${u}, TIR ≥ 5 % y vara, las tres salidas:`);
    console.log(tablaMd(["comuna", "avisos", "Comprar de hoy", ...SALIDAS.map((s) => ROT_S[s])], grupos(xs).map(([c, g]) => [c, fmt(g.length), fmt(g.filter((f) => f.v === "COMPRAR").length), ...SALIDAS.map((s) => txt(celda(g, s, CENTRAL)))])));
    console.log(`\nc · Por comuna, ${u}, salida al mayor cap, las seis variantes:`);
    console.log(tablaMd(["comuna", "avisos", "Comprar de hoy", ...COMBOS.map(rotCombo)], grupos(xs).map(([c, g]) => [c, fmt(g.length), fmt(g.filter((f) => f.v === "COMPRAR").length), ...COMBOS.map((cb) => txt(celda(g, "mayor", cb)))])));
  }

  // c' · Corrección de la regla A al mayor cap por la validación. Con g 0 % la TIR al mayor cap se agolpa cerca de los umbrales
  // (vender al precio pagado deja una TIR chica), así que un error chico de la estimación cambia decisiones. Con los avisos
  // recalculados exactos se mide, por umbral, la precisión p = P(exacta Comprar | estimada Comprar) y la tasa q =
  // P(exacta Comprar | estimada no Comprar), y el conteo corregido es exactos Comprar + p × estimados Comprar + q × estimados no.
  console.log("\nc' · Regla A al mayor cap (g 0 %): corrección del conteo por la validación de la estimación");
  const filasCorr: (string | number)[][] = [];
  for (const c of COMBOS) {
    const valid = filas.filter((f) => R[f.id]?.estado === "ok" && cambiaMayor(f) && pasaFlujo(f, c.flujo)).map((f) => {
      const v = valorObjetivo(f, "mayor", "g0");
      return { ex: (R[f.id].g.g0?.mayor ?? -Infinity) >= c.tir, es: (v != null ? estimada(f, "g0", v) ?? -Infinity : -Infinity) >= c.tir };
    });
    const estSi = valid.filter((x) => x.es), estNo = valid.filter((x) => !x.es);
    const pr = estSi.length ? estSi.filter((x) => x.ex).length / estSi.length : 1, qr = estNo.length ? estNo.filter((x) => x.ex).length / estNo.length : 0;
    for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
      const cand = xs.filter((f) => pasaFlujo(f, c.flujo));
      const exactSi = cand.filter((f) => comprar(f, "mayor", c) && !tir(f, "mayor", "g0").est).length;
      const estimados = cand.filter((f) => cambiaMayor(f) && tir(f, "mayor", "g0").est);
      const eSi = estimados.filter((f) => (tir(f, "mayor", "g0").t ?? -Infinity) >= c.tir).length, eNo = estimados.length - eSi;
      filasCorr.push([rotCombo(c), u, fmt(exactSi + eSi), fmt(eSi), fmt(pr * 100, 1) + " %", fmt(qr * 100, 1) + " %", fmt(Math.round(exactSi + pr * eSi + qr * eNo))]);
    }
  }
  console.log(tablaMd(["regla", "universo", "Comprar (tabla c)", "de ellos con TIR estimada", "precisión p", "tasa q", "Comprar corregido"], filasCorr));

  // d · g 3 %: TIR ≥ 5 % dentro de la vara y en la banda, por comuna.
  for (const [u, xs] of [["nuevos", nuevos], ["usados", usados]] as Array<[string, FilaIngreso[]]>) {
    console.log(`\nd · ${u}, g 3 %: TIR ≥ 5 % dentro de la vara / con flujo entre −5 % del arriendo y −$200.000, por comuna`);
    console.log(tablaMd(["comuna", "avisos", ...SALIDAS.map((s) => ROT_S[s])], grupos(xs).map(([c, g]) => [c, fmt(g.length), ...SALIDAS.map((s) => {
      const p = g.filter((f) => (tir(f, s, "g3").t ?? -Infinity) >= 5);
      return `${fmt(p.filter(enVara).length)} / ${fmt(p.filter(enBanda).length)}`;
    })])));
  }

  // e · Usados Comprar de hoy con TIR ≥ 5 %.
  const hoy = usados.filter((f) => f.v === "COMPRAR");
  console.log(`\ne · Usados Comprar de hoy (${fmt(hoy.length)}) con TIR ≥ 5 %, por escenario y salida (y cuántos con TIR estimada)`);
  console.log(tablaMd(["escenario", ...SALIDAS.map((s) => ROT_S[s])], GG.map((g) => [ROT_G[g], ...SALIDAS.map((s) => {
    const p = hoy.filter((f) => (tir(f, s, g).t ?? -Infinity) >= 5);
    const e = p.filter((f) => tir(f, s, g).est).length;
    return `${fmt(p.length)} (${pct(p.length, hoy.length)})${e ? ` [${fmt(e)} est.]` : ""}`;
  })])));

  // f · Las ocho fichas del anexo 2.
  const fichas = (JSON.parse(readFileSync(`${DIR}/20-fichas.json`, "utf8")) as { fichas: Array<{ letra: string; titulo: string; id: string; comuna: string; capEntrada: number; cap: { cap: number | null } }> }).fichas;
  const porId = new Map(filas.map((f) => [f.id, f]));
  const t3 = (x: { t: number | null; est: boolean }) => `${pf(x.t)}${x.est ? " (est.)" : ""}`;
  console.log("\nf · Las ocho fichas del anexo 2: TIR por ingreso (anexo 2) y TIR al mayor cap, en los tres escenarios");
  console.log(tablaMd(["ficha", "aviso", "cap de entrada", "cap de la celda", "cambia", ...GG.map((g) => `anexo 2, ${ROT_G[g]}`), ...GG.map((g) => `mayor cap, ${ROT_G[g]}`)], fichas.map((fi) => {
    if (fi.letra === "h" && golden) {
      const anexo2 = (JSON.parse(readFileSync(`${DIR}/18-golden.json`, "utf8")) as Record<string, { tir: Partial<Record<Escenario, number | null>> }>)[fi.id.slice(0, 8)].tir;
      return [`(${fi.letra})`, `${fi.id.slice(0, 8)} · ${fi.comuna}`, pf(golden.capEntrada, 2), pf(golden.cap, 2), golden.capEntrada > golden.cap ? "sí" : "no", ...GG.map((g) => pf(anexo2[`${g}h` as Escenario])), ...GG.map((g) => pf(golden.capEntrada > golden.cap ? golden.g[g].mayor : anexo2[`${g}h` as Escenario]))];
    }
    const f = porId.get(fi.id)!;
    return [`(${fi.letra})`, `${fi.id.slice(0, 8)} · ${fi.comuna}`, pf(ce(f), 2), pf(f.cap.cap, 2), cambiaMayor(f) ? "sí" : "no", ...GG.map((g) => pf(f.tir[`${g}h` as Escenario])), ...GG.map((g) => t3(tir(f, "mayor", g)))];
  })));

  // g · Las dos listas del anexo 3.
  const uComp = usados.filter((f) => f.v === "COMPRAR" && f.cap.cap != null);
  const bajas = [...uComp].sort((p, r) => (p.tir.g0h ?? -Infinity) - (r.tir.g0h ?? -Infinity)).slice(0, 20);
  const altas = [...usados.filter((f) => f.v === "AJUSTA SUPUESTOS" && f.tir.g0h != null)].sort((p, r) => r.tir.g0h! - p.tir.g0h!).slice(0, 20);
  const filaLista = (f: FilaIngreso) => [f.id.slice(0, 8), f.comuna, `UF ${fmt(f.precioUF)}`, `$${fmt(f.flujo)} (${pf((rel(f) ?? NaN) * 100)})`, pf(ce(f), 2), `${pf(f.cap.cap, 2)}${f.cap.nivel === "comuna" ? " (comuna)" : ""}`, ...SALIDAS.map((s) => t3(tir(f, s, "g0"))), t3(tir(f, "mayor", "g3")), t3(tir(f, "mayor", "g1"))];
  const cabL = ["aviso", "comuna", "precio", "flujo (% del arriendo)", "cap de entrada", "cap de la celda", "g 0 %: ingreso", "g 0 %: tope 1,10", "g 0 %: mayor cap", "mayor cap, g 3 %", "mayor cap, g 1 %"];
  console.log("\ng · Los 20 usados Ajustar de hoy con la TIR más alta a g 0 % (anexo 3)");
  console.log(tablaMd(cabL, altas.map(filaLista)));
  console.log("\ng · Los 20 usados Comprar de hoy con la TIR más baja a g 0 % (anexo 3)");
  console.log(tablaMd(cabL, bajas.map(filaLista)));

  // h · Comprar de la regla A (mayor cap) que dependen del cap de respaldo de la comuna.
  console.log("\nh · Comprar de la regla A con la salida al mayor cap cuyo cap de salida es el de respaldo de la comuna (el cap de mercado ganó y es el de la comuna), y Comprar con respaldo de comuna donde ganó el cap de entrada (el respaldo no decide)");
  console.log(tablaMd(["regla", "nuevos Comprar", "dependen del respaldo de la comuna", "respaldo sin efecto (ganó el de entrada)", "usados Comprar", "dependen del respaldo de la comuna", "respaldo sin efecto"], COMBOS.map((c) => {
    const n = celda(nuevos, "mayor", c).C, u = celda(usados, "mayor", c).C;
    const dep = (xs: FilaIngreso[]) => xs.filter((f) => f.cap.nivel === "comuna" && !cambiaMayor(f)).length;
    const sin = (xs: FilaIngreso[]) => xs.filter((f) => f.cap.nivel === "comuna" && cambiaMayor(f)).length;
    return [rotCombo(c), fmt(n.length), fmt(dep(n)), fmt(sin(n)), fmt(u.length), fmt(dep(u)), fmt(sin(u))];
  })));
  const depC = celda(usados, "mayor", CENTRAL).C.filter((f) => f.cap.nivel === "comuna" && !cambiaMayor(f));
  const porC = new Map<string, number>();
  for (const f of depC) porC.set(f.comuna, (porC.get(f.comuna) ?? 0) + 1);
  console.log(`usados que dependen del respaldo (TIR ≥ 5 %, vara), por comuna: ${[...porC.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "ninguno"}`);
}

main();
