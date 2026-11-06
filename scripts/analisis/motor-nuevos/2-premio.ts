// ─────────────────────────────────────────────────────────────────────────────
// FASE 1.2 · EL PREMIO DE ARRIENDO DE LO NUEVO, MEDIDO. Hoy el motor sube 3 % el arriendo sugerido de un depto nuevo
// (obra-nueva.ts › PREMIO_ARRIENDO_NUEVO; el tope que fijó Fabrizio es 5 %). Acá se mide con los arriendos activos:
//   · «edificio nuevo»: el arriendo está en el mismo punto (comuna, lat y lng a 5 decimales, la clave de anios_edificio)
//     que una unidad de obra nueva activa con entrega inmediata, o a menos de 30 m de una; o su edificio tiene año
//     conocido (anios_edificio / fichas_leidas) de hace 3 años o menos.
//   · referencia: la mediana del arriendo por m² de los arriendos NO nuevos de la misma comuna y dormitorios, con
//     superficie ±20 % (la celda del motor), y aparte la del radio de 500 m (lo que usa la sugerencia), n ≥ 15.
//   · la curva por tramo de edad solo con los arriendos de edificio con año conocido (se reporta con su n).
// Sin amoblados, temporada, corporativos ni piezas (arriendo-tipo.ts › entraComoComparable, la regla de los comparables). Solo lectura. Salida: out/2-premio.json.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from "node:fs";
import { paginar, cuantil, mediana, fmt, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { entraComoComparable } from "../../../src/lib/arriendo-tipo";

type Fila = { id: string; comuna: string; lat: number | string; lng: number | string; superficie_m2: number | string; dormitorios: number | null; precio: number | string; moneda: string | null; titulo: string | null; url: string | null; fecha_entrega: string | null; scraped_at: string };
const clave = (c: string, lat: number, lng: number) => `${c}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
function distanciaM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const sb = createServiceClient();
  const uf = Number((await sb.from("config").select("value").eq("key", "uf_value").single()).data?.value);
  const anio = new Date().getFullYear();
  const arriendos = await paginar<Fila>((a, b) => sb.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, precio, moneda, titulo, url, fecha_entrega, scraped_at")
    .eq("type", "arriendo").eq("is_active", true).not("lat", "is", null).not("comuna", "is", null).gt("precio", 0).gt("superficie_m2", 0).order("id").range(a, b));
  const nuevos = await paginar<Fila>((a, b) => sb.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, precio, moneda, titulo, url, fecha_entrega, scraped_at")
    .eq("type", "venta").eq("is_active", true).eq("condicion", "nuevo").not("lat", "is", null).order("id").range(a, b));
  const aniosEdificio = await paginar<{ edificio: string; anio: number }>((a, b) => sb.from("anios_edificio").select("edificio, anio").order("edificio").range(a, b));
  const fichas = await paginar<{ edificio: string | null; anio: number | null }>((a, b) => sb.from("fichas_leidas").select("edificio, anio").not("anio", "is", null).order("aviso_id").range(a, b));
  const anioPorEdificio = new Map<string, number>();
  for (const f of fichas) if (f.edificio && f.anio) anioPorEdificio.set(f.edificio, f.anio);
  for (const a of aniosEdificio) anioPorEdificio.set(a.edificio, a.anio);
  console.log(`arriendos activos ${fmt(arriendos.length)} · unidades/proyectos nuevos activos ${fmt(nuevos.length)} · edificios con año ${fmt(anioPorEdificio.size)} · UF ${fmt(uf)}`);

  // Los puntos de obra nueva con entrega inmediata (por clave exacta y para el radio de 30 m).
  const puntosNuevoInmediato = nuevos.filter((n) => { const e = parsearFechaEntrega(n.fecha_entrega); return !e || e.inmediata; }).map((n) => ({ lat: Number(n.lat), lng: Number(n.lng), clave: clave(n.comuna, Number(n.lat), Number(n.lng)) }));
  const clavesNuevo = new Set(puntosNuevoInmediato.map((p) => p.clave));

  type Arr = { id: string; comuna: string; lat: number; lng: number; m2: number; dorms: number; clp: number; m2clp: number; anio: number | null; nuevoExacto: boolean; nuevo30m: boolean; edad: number | null };
  const arr: Arr[] = [];
  let amoblados = 0;
  for (const a of arriendos) {
    // La misma regla de los comparables del motor (arriendo-tipo.ts): sin amoblados, temporada, corporativos ni piezas.
    if (!entraComoComparable(a, false)) { amoblados++; continue; }
    const lat = Number(a.lat), lng = Number(a.lng), m2 = Number(a.superficie_m2);
    const clp = a.moneda === "UF" ? Number(a.precio) * uf : Number(a.precio);
    if (!(m2 >= 15 && m2 <= 400) || !(clp > 100000 && clp < 10000000)) continue;
    const k = clave(a.comuna, lat, lng);
    const an = anioPorEdificio.get(k) ?? null;
    const nuevoExacto = clavesNuevo.has(k);
    const nuevo30m = nuevoExacto || puntosNuevoInmediato.some((p) => Math.abs(p.lat - lat) < 0.0005 && Math.abs(p.lng - lng) < 0.0005 && distanciaM(p.lat, p.lng, lat, lng) <= 30);
    arr.push({ id: a.id, comuna: a.comuna, lat, lng, m2, dorms: a.dormitorios ?? 0, clp, m2clp: clp / m2, anio: an, nuevoExacto, nuevo30m, edad: an ? anio - an : null });
  }
  const conAnio = arr.filter((a) => a.edad != null);
  const esNuevo = (a: Arr) => a.nuevo30m || (a.edad != null && a.edad <= 3);
  const grupoNuevo = arr.filter(esNuevo);
  const resto = arr.filter((a) => !esNuevo(a));
  console.log(`sin amoblados/temporada: ${fmt(arr.length)} (fuera ${amoblados}) · con año de edificio: ${fmt(conAnio.length)} · en punto exacto de unidad nueva inmediata: ${fmt(arr.filter((a) => a.nuevoExacto).length)} · a ≤ 30 m: ${fmt(arr.filter((a) => a.nuevo30m).length)} · grupo «nuevo» (≤ 30 m o ≤ 3 años): ${fmt(grupoNuevo.length)}`);

  // Curva por tramo de edad (solo con año conocido): arriendo por m² sobre la mediana de su comuna y dormitorios.
  const refComuna = (a: Arr, universo: Arr[], minN = 15): number | null => {
    const xs = universo.filter((u) => u.id !== a.id && u.comuna === a.comuna && u.dorms === a.dorms && u.m2 >= a.m2 * 0.8 && u.m2 <= a.m2 * 1.2).map((u) => u.m2clp);
    return xs.length >= minN ? mediana(xs) : null;
  };
  const refRadio = (a: Arr, universo: Arr[], radioM = 500, minN = 15): number | null => {
    const xs = universo.filter((u) => u.id !== a.id && u.dorms === a.dorms && u.m2 >= a.m2 * 0.8 && u.m2 <= a.m2 * 1.2 && Math.abs(u.lat - a.lat) < 0.01 && Math.abs(u.lng - a.lng) < 0.01 && distanciaM(u.lat, u.lng, a.lat, a.lng) <= radioM).map((u) => u.m2clp);
    return xs.length >= minN ? mediana(xs) : null;
  };
  const tramos: Array<[string, number, number]> = [["0-3", 0, 3], ["4-10", 4, 10], ["11-20", 11, 20], ["21-30", 21, 30], ["31+", 31, 999]];
  const filasCurva = tramos.map(([t, lo, hi]) => {
    const xs = conAnio.filter((a) => a.edad! >= lo && a.edad! <= hi);
    const ratios = xs.map((a) => { const r = refComuna(a, resto); return r ? a.m2clp / r : NaN; }).filter(Number.isFinite);
    return [t, xs.length, ratios.length, fmt(mediana(xs.map((a) => a.m2clp))), ratios.length ? fmt((mediana(ratios)! - 1) * 100, 1) + " %" : "—"];
  });
  console.log("\nCurva por edad (arriendos con año de edificio conocido): $/m² mediano y premio sobre la celda comuna × dormitorios (±20 % m²) de los no nuevos");
  console.log(tablaMd(["tramo de edad", "n", "con referencia (n ≥ 15)", "$/m² mediano", "premio mediano"], filasCurva));

  // El premio del grupo «nuevo», por comuna, contra la celda y contra el radio de 500 m.
  type Pc = { comuna: string; n: number; nCelda: number; premioCelda: number | null; p25: number | null; p75: number | null; nRadio: number; premioRadio: number | null };
  const porComuna = new Map<string, Arr[]>();
  for (const a of grupoNuevo) porComuna.set(a.comuna, [...(porComuna.get(a.comuna) ?? []), a]);
  const salida: Pc[] = [];
  for (const [comuna, xs] of [...porComuna.entries()].sort((p, q) => q[1].length - p[1].length)) {
    const rc = xs.map((a) => { const r = refComuna(a, resto); return r ? a.m2clp / r - 1 : NaN; }).filter(Number.isFinite);
    const rr = xs.map((a) => { const r = refRadio(a, resto); return r ? a.m2clp / r - 1 : NaN; }).filter(Number.isFinite);
    salida.push({ comuna, n: xs.length, nCelda: rc.length, premioCelda: rc.length ? mediana(rc) : null, p25: rc.length ? cuantil(rc, 0.25) : null, p75: rc.length ? cuantil(rc, 0.75) : null, nRadio: rr.length, premioRadio: rr.length ? mediana(rr) : null });
  }
  const pctF = (x: number | null) => (x == null ? "—" : fmt(x * 100, 1) + " %");
  console.log(`\nPremio del grupo «nuevo» (${fmt(grupoNuevo.length)} arriendos) por comuna: arriendo/m² sobre la mediana de los no nuevos de su comuna y dormitorios (±20 % m²), y sobre el radio de 500 m`);
  console.log(tablaMd(["comuna", "n nuevos", "con celda", "premio mediano (celda)", "p25", "p75", "con radio", "premio mediano (radio 500 m)"],
    salida.map((p) => [p.comuna, p.n, p.nCelda, pctF(p.premioCelda), pctF(p.p25), pctF(p.p75), p.nRadio, pctF(p.premioRadio)])));
  const todos = grupoNuevo.map((a) => { const r = refComuna(a, resto); return r ? a.m2clp / r - 1 : NaN; }).filter(Number.isFinite);
  const todosR = grupoNuevo.map((a) => { const r = refRadio(a, resto); return r ? a.m2clp / r - 1 : NaN; }).filter(Number.isFinite);
  console.log(`\nGran Santiago: premio mediano contra la celda ${pctF(mediana(todos))} (p25 ${pctF(cuantil(todos, 0.25))} · p75 ${pctF(cuantil(todos, 0.75))}, n ${todos.length}); contra el radio ${pctF(mediana(todosR))} (n ${todosR.length})`);

  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/2-premio.json", JSON.stringify({ uf, calculadoAt: new Date().toISOString(), grupoNuevo: grupoNuevo.length, conAnio: conAnio.length, premioGranSantiago: mediana(todos), premioGranSantiagoRadio: mediana(todosR), porComuna: salida, curva: filasCurva }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
