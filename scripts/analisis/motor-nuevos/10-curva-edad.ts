// ─────────────────────────────────────────────────────────────────────────────
// PUNTO 1.2 DEL STOP 3 · LA CURVA POR EDAD con los usados activos que tienen año: por ficha (fichas_leidas), por
// edificio (anios_edificio, la regla del informe) o por las lecturas locales de 9-fichas-usados.ts (que no están en la
// base). Por comuna y tramo de edad (0-2, 3-5, 6-10, 11-20, 21-30, 31 o más): mediana de UF/m² (precio publicado) y de
// arriendo por m², n, p25 y p75; celdas con n < 15 marcadas. Y la comparación 0-2 contra 3-5 y contra 21-30 por comuna.
// El arriendo por m² es el SUGERIDO por radio con que se evaluó el aviso (la base no tiene el arriendo del edificio), así
// que mide lo que el motor le pone, no lo que el edificio cobra: se dice. Solo lectura. Salida: out/10-curva-edad.json
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { paginar, cuantil, mediana, fmt, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { claveEdificio } from "../../../src/lib/guia/ficha-anio";
import type { LecturaLocal } from "./9-fichas-usados";
import type { FilaBase } from "./1-base-corregida";

const TRAMOS: Array<[string, number, number]> = [["0-2", 0, 2], ["3-5", 3, 5], ["6-10", 6, 10], ["11-20", 11, 20], ["21-30", 21, 30], ["31+", 31, 999]];

async function main() {
  const sb = createServiceClient();
  const hoy = new Date().getFullYear();
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { filas: FilaBase[] };
  const locales: LecturaLocal[] = existsSync("scripts/analisis/motor-nuevos/out/9-fichas-usados.json") ? (JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/9-fichas-usados.json", "utf8")) as { lecturas: LecturaLocal[] }).lecturas : [];
  type U = { aviso_id: string; comuna: string; scraped_properties: { lat: number | string; lng: number | string } };
  const usados = await paginar<U>((a, b) => sb.from("avisos_evaluados").select("aviso_id, comuna, scraped_properties!inner(lat, lng)")
    .eq("condicion", "usado").eq("scraped_properties.is_active", true).eq("scraped_properties.type", "venta").order("aviso_id").range(a, b) as never);
  const fichas = await paginar<{ aviso_id: string; anio: number | null; edificio: string | null }>((a, b) => sb.from("fichas_leidas").select("aviso_id, anio, edificio").not("anio", "is", null).order("aviso_id").range(a, b));
  const edificios = await paginar<{ edificio: string; anio: number }>((a, b) => sb.from("anios_edificio").select("edificio, anio").order("edificio").range(a, b));
  const anioEdificio = new Map<string, number>(edificios.map((e) => [e.edificio, e.anio]));
  for (const f of fichas) if (f.anio && f.edificio && !anioEdificio.has(f.edificio)) anioEdificio.set(f.edificio, f.anio);
  const anioAviso = new Map<string, number>(fichas.filter((f) => f.anio).map((f) => [f.aviso_id, f.anio!]));
  for (const l of locales) if (l.anio) { anioAviso.set(l.avisoId, l.anio); if (!anioEdificio.has(l.edificio)) anioEdificio.set(l.edificio, l.anio); }
  const porId = new Map(base.filas.map((f) => [f.id, f]));

  type Fila = { id: string; comuna: string; edad: number; ufm2: number; arrm2: number; fuente: "ficha" | "edificio" | "lectura local" };
  const filas: Fila[] = [];
  for (const u of usados) {
    const b = porId.get(u.aviso_id);
    if (!b || b.sospechoso || b.degradado || !(b.arriendo > 0)) continue;
    const k = claveEdificio({ comuna: u.comuna, lat: Number(u.scraped_properties.lat), lng: Number(u.scraped_properties.lng) });
    const local = locales.find((l) => l.avisoId === u.aviso_id && l.anio);
    const anio = local?.anio ?? anioAviso.get(u.aviso_id) ?? anioEdificio.get(k);
    if (!anio) continue;
    filas.push({ id: u.aviso_id, comuna: u.comuna, edad: Math.max(0, hoy - anio), ufm2: b.precioUF / b.m2, arrm2: b.arriendo / b.m2, fuente: local ? "lectura local" : anioAviso.has(u.aviso_id) ? "ficha" : "edificio" });
  }
  console.log(`usados activos con año: ${fmt(filas.length)} (ficha ${filas.filter((f) => f.fuente === "ficha").length} · por edificio ${filas.filter((f) => f.fuente === "edificio").length} · lectura local ${filas.filter((f) => f.fuente === "lectura local").length}) de ${fmt(usados.length)}`);

  const celda = (xs: Fila[]) => ({ n: xs.length, uf: mediana(xs.map((f) => f.ufm2)), ufp25: cuantil(xs.map((f) => f.ufm2), 0.25), ufp75: cuantil(xs.map((f) => f.ufm2), 0.75), arr: mediana(xs.map((f) => f.arrm2)) });
  const comunas = [...new Set(filas.map((f) => f.comuna))].sort((p, q) => filas.filter((f) => f.comuna === q).length - filas.filter((f) => f.comuna === p).length);
  const filasTabla: (string | number)[][] = [];
  const comparacion: (string | number)[][] = [];
  const salida: Record<string, Record<string, ReturnType<typeof celda>>> = {};
  for (const c of ["Gran Santiago", ...comunas]) {
    const xs = c === "Gran Santiago" ? filas : filas.filter((f) => f.comuna === c);
    if (xs.length < 15) continue;
    salida[c] = {};
    for (const [t, lo, hi] of TRAMOS) {
      const ys = xs.filter((f) => f.edad >= lo && f.edad <= hi);
      const r = celda(ys);
      salida[c][t] = r;
      filasTabla.push([c, t, `${r.n}${r.n < 15 ? " ⚠" : ""}`, fmt(r.uf, 1), fmt(r.ufp25, 1), fmt(r.ufp75, 1), fmt(r.arr)]);
    }
    const r02 = salida[c]["0-2"], r35 = salida[c]["3-5"], r2130 = salida[c]["21-30"];
    const rel = (a: ReturnType<typeof celda>, b: ReturnType<typeof celda>) => (a.uf && b.uf ? fmt((a.uf / b.uf - 1) * 100, 1) + " %" : "—");
    comparacion.push([c, xs.length, `${r02.n} / ${r35.n} / ${r2130.n}`, rel(r02, r35), rel(r02, r2130), r35.uf && r2130.uf ? fmt((r35.uf / r2130.uf - 1) * 100, 1) + " %" : "—"]);
  }
  console.log("\nCurva por comuna y tramo de edad (usados activos con año; UF/m² = precio publicado; arriendo/m² = sugerido por radio, no el del edificio):");
  console.log(tablaMd(["comuna", "tramo", "n", "UF/m² mediana", "p25", "p75", "arriendo $/m² mediana"], filasTabla));
  console.log("\n0-2 contra 3-5 y contra 21-30 (UF/m² mediana):");
  console.log(tablaMd(["comuna", "n con año", "n 0-2 / 3-5 / 21-30", "0-2 sobre 3-5", "0-2 sobre 21-30", "3-5 sobre 21-30"], comparacion));
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/10-curva-edad.json", JSON.stringify({ calculadoAt: new Date().toISOString(), n: filas.length, curva: salida, filas }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
