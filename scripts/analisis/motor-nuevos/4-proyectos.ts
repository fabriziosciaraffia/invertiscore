// ─────────────────────────────────────────────────────────────────────────────
// FASE 2.1, 2.2 y 2.4 (sin lecturas) · PROYECTOS Y UNIDADES DETRÁS DE LOS AVISOS NUEVOS. Lee los 7.585 nuevos activos en
// venta de scraped_properties (unidades y filas de proyecto), los agrupa por proyecto (la llave es la URL de la ficha del
// proyecto: `url`; en las unidades, `source_id` = `url#<número>`), y cuenta:
//   · 2.1 proyectos, unidades por proyecto, tipologías, proyectos por comuna, entrega, y qué son los no evaluados;
//   · 2.2 por proyecto, el precio «desde» (la unidad más barata) contra la unidad mediana y la más cara, por comuna y
//     tipología (precios reales por unidad del GraphQL viejo, 29-sep al 01-oct); y el precio estimado de hoy
//     (precio_estimado_uf, interpolado del desde/hasta del proyecto) contra ese precio real, error mediano y máximo;
//   · 2.4 cuántas unidades conocemos por proyecto, para extrapolar con lo que digan las fichas.
// Solo lectura. Salida: out/4-proyectos.json (la muestra para las lecturas sale de acá).
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cliente, paginar, cuantil, mediana, fmt, pct, tablaMd, muestraConSemilla } from "./comun";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { ventaPlausible } from "../../../src/lib/avisos/plausible";
import type { FilaBase } from "./1-base-corregida";

type Fila = { id: string; url: string | null; source_id: string; comuna: string | null; lat: number | string | null; lng: number | string | null; titulo: string | null; direccion: string | null; superficie_m2: number | string | null; dormitorios: number | null; banos: number | null; precio: number | string | null; moneda: string | null; precio_estimado_uf: number | string | null; fecha_entrega: string | null; seen_pass_id: string | null; scraped_at: string; created_at: string | null };

async function main() {
  const sb = cliente();
  const filas = await paginar<Fila>((a, b) => sb.from("scraped_properties")
    .select("id, url, source_id, comuna, lat, lng, titulo, direccion, superficie_m2, dormitorios, banos, precio, moneda, precio_estimado_uf, fecha_entrega, seen_pass_id, scraped_at, created_at")
    .eq("type", "venta").eq("is_active", true).eq("condicion", "nuevo").order("id").range(a, b));
  const base = JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/1-base-corregida.json", "utf8")) as { filas: FilaBase[] };
  const evaluada = new Map(base.filas.filter((f) => f.cond === "nuevo").map((f) => [f.id, f]));
  const uf = Number((await sb.from("config").select("value").eq("key", "uf_value").single()).data?.value);
  console.log(`nuevos activos en venta: ${fmt(filas.length)} · evaluados: ${fmt(evaluada.size)} · UF ${fmt(uf)}`);

  // La llave de proyecto: la URL de la ficha (sin el «#unidad» del source_id).
  const llave = (f: Fila) => (f.url ?? f.source_id.split("#")[0]).replace(/\/$/, "");
  const esUnidad = (f: Fila) => f.source_id.includes("#");
  const precioUF = (f: Fila) => (f.moneda === "UF" ? Number(f.precio) : Number(f.precio) / uf);
  const proyectos = new Map<string, Fila[]>();
  for (const f of filas) proyectos.set(llave(f), [...(proyectos.get(llave(f)) ?? []), f]);

  // 2.1 · Confiabilidad de la llave: 20 proyectos al azar, mirados a mano (coordenadas, dirección, título, comuna).
  const nombresProyecto = [...proyectos.keys()];
  const muestra20 = muestraConSemilla(nombresProyecto.filter((k) => proyectos.get(k)!.length >= 3), 20, 20261105);
  console.log("\n2.1 · 20 proyectos al azar para revisar la llave (una fila por proyecto):");
  console.log(tablaMd(["proyecto (final de la URL)", "filas", "unidades", "comunas", "puntos (lat,lng)", "direcciones", "títulos", "entregas", "m² min–max"], muestra20.map((k) => {
    const xs = proyectos.get(k)!;
    const u = (g: (f: Fila) => string) => new Set(xs.map(g)).size;
    const m2 = xs.map((f) => Number(f.superficie_m2)).filter((m) => m > 0);
    return [k.split("/").slice(-2).join("/").slice(0, 48), xs.length, xs.filter(esUnidad).length, u((f) => f.comuna ?? ""), u((f) => `${Number(f.lat).toFixed(4)},${Number(f.lng).toFixed(4)}`), u((f) => (f.direccion ?? "").trim().toLowerCase()), u((f) => (f.titulo ?? "").trim().toLowerCase().slice(0, 40)), u((f) => f.fecha_entrega ?? ""), `${fmt(Math.min(...m2), 1)}–${fmt(Math.max(...m2), 1)}`];
  })));
  const inconsistentes = nombresProyecto.filter((k) => { const xs = proyectos.get(k)!; return new Set(xs.map((f) => f.comuna)).size > 1 || new Set(xs.map((f) => `${Number(f.lat).toFixed(3)},${Number(f.lng).toFixed(3)}`)).size > 1; });
  console.log(`proyectos con más de una comuna o más de un punto (a 3 decimales): ${inconsistentes.length} de ${nombresProyecto.length}`);

  // 2.1 · Conteos sobre las 2.072 evaluadas y sobre todas.
  const resumen = (nombre: string, filtro: (f: Fila) => boolean) => {
    const ps = new Map<string, Fila[]>();
    for (const f of filas.filter(filtro)) ps.set(llave(f), [...(ps.get(llave(f)) ?? []), f]);
    const porProyecto = [...ps.values()];
    const unidades = porProyecto.map((xs) => xs.filter(esUnidad).length);
    const tipologias = porProyecto.map((xs) => new Set(xs.map((f) => f.dormitorios ?? -1)).size);
    const entrega = (xs: Fila[]) => { const e = parsearFechaEntrega(xs[0].fecha_entrega); return !e ? "sin dato" : e.inmediata ? "inmediata" : "futura"; };
    const ent = { inmediata: 0, futura: 0, "sin dato": 0 };
    for (const xs of porProyecto) ent[entrega(xs)]++;
    const porComuna = new Map<string, number>();
    for (const xs of porProyecto) porComuna.set(xs[0].comuna ?? "?", (porComuna.get(xs[0].comuna ?? "?") ?? 0) + 1);
    return { nombre, avisos: filas.filter(filtro).length, proyectos: porProyecto.length, unidadesMed: mediana(unidades), unidadesMax: Math.max(...unidades), tipologiasMed: mediana(tipologias), tipologiasMax: Math.max(...tipologias), ent, porComuna: [...porComuna.entries()].sort((p, q) => q[1] - p[1]) };
  };
  const rEval = resumen("evaluados (2.072)", (f) => evaluada.has(f.id));
  const rTodos = resumen("todos los nuevos activos", () => true);
  console.log("\n2.1 · Proyectos:");
  console.log(tablaMd(["universo", "avisos", "proyectos", "unidades por proyecto (mediana / máx)", "tipologías por proyecto (mediana / máx)", "proyectos: inmediata / futura / sin dato"], [rEval, rTodos].map((r) => [r.nombre, r.avisos, r.proyectos, `${fmt(r.unidadesMed)} / ${r.unidadesMax}`, `${fmt(r.tipologiasMed)} / ${r.tipologiasMax}`, `${r.ent.inmediata} / ${r.ent.futura} / ${r.ent["sin dato"]}`])));
  console.log("\nProyectos por comuna (evaluados · todos):");
  const comunas = [...new Set([...rEval.porComuna, ...rTodos.porComuna].map(([c]) => c))];
  console.log(tablaMd(["comuna", "proyectos (evaluados)", "proyectos (todos)", "unidades evaluadas", "unidades activas"], comunas.map((c) => [c, rEval.porComuna.find(([k]) => k === c)?.[1] ?? 0, rTodos.porComuna.find(([k]) => k === c)?.[1] ?? 0, filas.filter((f) => f.comuna === c && evaluada.has(f.id)).length, filas.filter((f) => f.comuna === c).length]).sort((p, q) => Number(q[4]) - Number(p[4]))));

  // Qué son los no evaluados.
  const marca = (f: Fila) => (f.seen_pass_id ?? "").split("@")[0] || "(sin marca)";
  const grupos = new Map<string, Fila[]>();
  for (const f of filas) { const k = `${evaluada.has(f.id) ? "evaluada" : "no evaluada"} · ${marca(f)} · ${esUnidad(f) ? "unidad" : "fila proyecto"}`; grupos.set(k, [...(grupos.get(k) ?? []), f]); }
  console.log("\nQué hay en los 7.585 (marca del cruce, unidad o fila de proyecto):");
  console.log(tablaMd(["grupo", "n", "proyectos", "creadas", "scraped_at", "con precio estimado"], [...grupos.entries()].sort((p, q) => q[1].length - p[1].length).map(([k, xs]) => [k, xs.length, new Set(xs.map(llave)).size, `${xs.map((f) => (f.created_at ?? "").slice(0, 10)).sort()[0]} a ${xs.map((f) => (f.created_at ?? "").slice(0, 10)).sort().at(-1)}`, `${xs.map((f) => f.scraped_at.slice(0, 10)).sort()[0]} a ${xs.map((f) => f.scraped_at.slice(0, 10)).sort().at(-1)}`, xs.filter((f) => f.precio_estimado_uf != null).length])));

  // 2.2 · Desde contra mediana y máxima, por proyecto, con los precios reales por unidad.
  type Pr = { k: string; comuna: string; dorms: number; n: number; desde: number; med: number; max: number; medRatio: number; maxRatio: number };
  const prs: Pr[] = [];
  for (const [k, xs] of proyectos) {
    const porTipo = new Map<number, number[]>();
    for (const f of xs.filter(esUnidad)) { const p = precioUF(f); if (p > 0) porTipo.set(f.dormitorios ?? -1, [...(porTipo.get(f.dormitorios ?? -1) ?? []), p]); }
    for (const [d, ps] of porTipo) {
      if (ps.length < 3) continue;
      const desde = Math.min(...ps), med = mediana(ps)!, max = Math.max(...ps);
      prs.push({ k, comuna: xs[0].comuna ?? "?", dorms: d, n: ps.length, desde, med, max, medRatio: med / desde - 1, maxRatio: max / desde - 1 });
    }
  }
  console.log(`\n2.2 · Proyecto × tipología con 3 o más unidades con precio real: ${prs.length} celdas (${new Set(prs.map((p) => p.k)).size} proyectos). Unidad mediana y más cara sobre el «desde» del proyecto:`);
  const grupo = (nombre: string, xs: Pr[]) => [nombre, xs.length, fmt(xs.reduce((s, p) => s + p.n, 0)), pct(mediana(xs.map((p) => p.medRatio))! * 100, 100, 1), pct(cuantil(xs.map((p) => p.medRatio), 0.25)! * 100, 100, 1), pct(cuantil(xs.map((p) => p.medRatio), 0.75)! * 100, 100, 1), pct(mediana(xs.map((p) => p.maxRatio))! * 100, 100, 1)];
  const porDorm = [0, 1, 2, 3, 4].map((d) => prs.filter((p) => p.dorms === d)).filter((xs) => xs.length >= 5);
  const porCom = [...new Set(prs.map((p) => p.comuna))].map((c) => [c, prs.filter((p) => p.comuna === c)] as const).filter(([, xs]) => xs.length >= 5).sort((p, q) => q[1].length - p[1].length);
  console.log(tablaMd(["grupo", "celdas", "unidades", "mediana / desde (mediana)", "p25", "p75", "máxima / desde (mediana)"], [
    grupo("Gran Santiago", prs),
    ...porDorm.map((xs) => grupo(`${xs[0].dorms}D`, xs)),
    ...porCom.map(([c, xs]) => grupo(c, [...xs])),
  ]));

  // 2.2 · El precio estimado de hoy contra el precio real por unidad.
  // Solo los precios plausibles (la regla de la pasada, plausible.ts): un precio en pesos leído como UF da errores de millones por ciento.
  const conAmbos = filas.filter((f) => esUnidad(f) && f.precio_estimado_uf != null && precioUF(f) > 0 && ventaPlausible(precioUF(f), Number(f.superficie_m2)));
  const noPlausibles = filas.filter((f) => esUnidad(f) && f.precio_estimado_uf != null && precioUF(f) > 0 && !ventaPlausible(precioUF(f), Number(f.superficie_m2))).length;
  const err = conAmbos.map((f) => Number(f.precio_estimado_uf) / precioUF(f) - 1);
  const abs = err.map(Math.abs).sort((p, q) => p - q);
  console.log(`\nprecio_estimado_uf contra el precio real por unidad (${fmt(conAmbos.length)} unidades plausibles; ${noPlausibles} fuera de rango): error mediano ${pct(mediana(err)! * 100, 100, 1)} (sesgo), |error| mediano ${pct(mediana(abs)! * 100, 100, 1)}, p90 ${pct(cuantil(abs, 0.9)! * 100, 100, 1)}, máximo ${pct(Math.max(...abs) * 100, 100, 1)}; dentro de ±5 %: ${pct(abs.filter((e) => e <= 0.05).length, abs.length)}; dentro de ±10 %: ${pct(abs.filter((e) => e <= 0.1).length, abs.length)}`);

  // 2.4 · Unidades conocidas por proyecto (activas; las vendidas ya no están activas).
  const unidadesPorProyecto = [...proyectos.values()].map((xs) => xs.filter(esUnidad).length).filter((n) => n > 0);
  console.log(`\n2.4 · unidades activas conocidas: ${fmt(unidadesPorProyecto.reduce((s, n) => s + n, 0))} en ${unidadesPorProyecto.length} proyectos (mediana ${fmt(mediana(unidadesPorProyecto))}, p75 ${fmt(cuantil(unidadesPorProyecto, 0.75))}, máx ${Math.max(...unidadesPorProyecto)}); proyectos solo con fila de proyecto (sin unidades): ${proyectos.size - unidadesPorProyecto.length}`);

  // La muestra para las lecturas (FASE 2.3): 2 de los 29 Comprar, 3 con break-even imposible, 2 de entrega futura y el resto
  // diverso en comuna y tipología; proyectos con unidades evaluadas, uno por proyecto.
  const proyectoDe = new Map(filas.map((f) => [f.id, llave(f)]));
  const elegidos = new Map<string, string>();
  const tomar = (ids: string[], n: number, motivo: string) => { for (const id of muestraConSemilla(ids, ids.length, 7)) { const k = proyectoDe.get(id)!; if (!elegidos.has(k)) { elegidos.set(k, motivo); if ([...elegidos.values()].filter((m) => m === motivo).length >= n) break; } } };
  const ev = [...evaluada.values()].filter((f) => !f.sospechoso);
  tomar(ev.filter((f) => f.b.v === "COMPRAR").map((f) => f.id), 2, "Comprar");
  tomar(ev.filter((f) => f.gate1.breakEvenImposible).map((f) => f.id), 3, "break-even imposible");
  tomar(ev.filter((f) => f.entrega === "futura").map((f) => f.id), 2, "entrega futura");
  const comunasVistas = new Set([...elegidos.keys()].map((k) => proyectos.get(k)![0].comuna));
  for (const f of muestraConSemilla(ev, ev.length, 11)) { if (elegidos.size >= 12) break; const k = proyectoDe.get(f.id)!; const c = proyectos.get(k)![0].comuna; if (!elegidos.has(k) && !comunasVistas.has(c)) { elegidos.set(k, "diverso"); comunasVistas.add(c); } }
  console.log("\nMuestra para las lecturas (2.3):");
  console.log(tablaMd(["proyecto", "motivo", "comuna", "unidades activas", "evaluadas", "tipologías", "entrega"], [...elegidos.entries()].map(([k, m]) => { const xs = proyectos.get(k)!; return [k.split("/").slice(-2).join("/").slice(0, 48), m, xs[0].comuna, xs.filter(esUnidad).length, xs.filter((f) => evaluada.has(f.id)).length, [...new Set(xs.map((f) => f.dormitorios))].sort().join("/"), xs[0].fecha_entrega ?? "—"]; })));

  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/4-proyectos.json", JSON.stringify({ uf, calculadoAt: new Date().toISOString(), proyectos: proyectos.size, muestraLecturas: [...elegidos.entries()].map(([k, motivo]) => ({ url: k, motivo, comuna: proyectos.get(k)![0].comuna, idsUnidades: proyectos.get(k)!.filter(esUnidad).map((f) => f.id), unidadesActivas: proyectos.get(k)!.filter(esUnidad).length })), celdas22: prs }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
