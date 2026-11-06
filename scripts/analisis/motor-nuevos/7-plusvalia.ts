// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 · PLUSVALÍA DE ENTREGA Y CRECIMIENTO HISTÓRICO, con lo que la base aguanta. Solo lectura.
//   3.2a Corte transversal: entrega futura contra inmediata, UF/m² por comuna y dormitorios, agrupando la futura por
//        meses hasta la entrega (parsearFechaEntrega, la lectura de la pasada). Unidades activas con precio real plausible.
//   3.2b Serie de precios: scraped_properties_precios de los nuevos (activos y en bajas), primera contra última vista, con
//        el largo de la serie (la base no tiene 6 meses de historia: se reporta lo que hay y se dice).
//   3.2c Mismo proyecto antes y después de la entrega: no hay historia de fecha_entrega; se reporta como no medible.
//   3.3  Qué dicen plusvalia_fuentes_raw (GfK anual por comuna 2015-2025, INCOIN trimestral 2024Q4-2025Q4) y
//        plusvalia_indices_raw (CLAPES RealData 2007-2023 por zona, UF real): crecimiento real anual por comuna y zona.
// Salida: out/7-plusvalia.json
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from "node:fs";
import { paginar, cuantil, mediana, fmt, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { parsearFechaEntrega } from "../../../src/lib/avisos/fecha-entrega";
import { ventaPlausible } from "../../../src/lib/avisos/plausible";

type Fila = { id: string; comuna: string | null; source_id: string; superficie_m2: number | string | null; dormitorios: number | null; precio: number | string | null; moneda: string | null; fecha_entrega: string | null; is_active: boolean };
const pctF = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "—" : fmt(x * 100, d) + " %");

/** Zonas del índice CLAPES RealData (mapa de este goal, no del repo: CLAPES publica RM y cuatro zonas sin lista de comunas). */
const ZONA_CLAPES: Record<string, string> = {
  "Las Condes": "Oriente", Vitacura: "Oriente", "Lo Barnechea": "Oriente", Providencia: "Oriente", "Ñuñoa": "Oriente", "La Reina": "Oriente", "Peñalolén": "Oriente",
  Santiago: "Centro-Norte", Independencia: "Centro-Norte", Recoleta: "Centro-Norte", "Conchalí": "Centro-Norte", Huechuraba: "Centro-Norte", Quilicura: "Centro-Norte", Renca: "Centro-Norte", "Estación Central": "Centro-Norte", "Quinta Normal": "Centro-Norte",
  "La Florida": "Sur-Oriente", Macul: "Sur-Oriente", "Puente Alto": "Sur-Oriente", "San Joaquín": "Sur-Oriente", "La Granja": "Sur-Oriente",
  "Maipú": "Sur-Poniente", Pudahuel: "Sur-Poniente", Cerrillos: "Sur-Poniente", "San Miguel": "Sur-Poniente", "La Cisterna": "Sur-Poniente", "El Bosque": "Sur-Poniente", "San Bernardo": "Sur-Poniente", "Pedro Aguirre Cerda": "Sur-Poniente",
};

async function main() {
  const sb = createServiceClient();
  const uf = Number((await sb.from("config").select("value").eq("key", "uf_value").single()).data?.value);
  const hoy = new Date();
  const filas = await paginar<Fila>((a, b) => sb.from("scraped_properties").select("id, comuna, source_id, superficie_m2, dormitorios, precio, moneda, fecha_entrega, is_active")
    .eq("type", "venta").eq("condicion", "nuevo").eq("is_active", true).order("id").range(a, b));
  type U = { id: string; comuna: string; dorms: number; ufm2: number; entrega: "inmediata" | "futura" | "sin dato"; meses: number | null };
  const unidades: U[] = [];
  for (const f of filas) {
    if (!f.source_id.includes("#") || !f.comuna) continue;
    const m2 = Number(f.superficie_m2), p = f.moneda === "UF" ? Number(f.precio) : Number(f.precio) / uf;
    if (!(m2 > 0) || !ventaPlausible(p, m2)) continue;
    const e = parsearFechaEntrega(f.fecha_entrega, hoy);
    const meses = e && !e.inmediata && e.anio != null && e.mes != null ? Math.max(1, Math.round(((e.anio - hoy.getFullYear()) * 12 + (e.mes - (hoy.getMonth() + 1))))) : null;
    unidades.push({ id: f.id, comuna: f.comuna, dorms: f.dormitorios ?? -1, ufm2: p / m2, entrega: !e ? "sin dato" : e.inmediata ? "inmediata" : "futura", meses });
  }
  console.log(`unidades nuevas activas plausibles: ${fmt(unidades.length)} · inmediata ${unidades.filter((u) => u.entrega === "inmediata").length} · futura ${unidades.filter((u) => u.entrega === "futura").length} · sin dato ${unidades.filter((u) => u.entrega === "sin dato").length}`);

  // 3.2a · Corte transversal por comuna × dormitorios: mediana UF/m² futura / inmediata − 1, con n ≥ 10 por lado.
  const celdas = new Map<string, U[]>();
  for (const u of unidades) if (u.entrega !== "sin dato") celdas.set(`${u.comuna}|${u.dorms}`, [...(celdas.get(`${u.comuna}|${u.dorms}`) ?? []), u]);
  const filasCT: (string | number)[][] = [];
  const porComuna = new Map<string, number[]>();
  for (const [k, xs] of [...celdas.entries()].sort((p, q) => q[1].length - p[1].length)) {
    const inm = xs.filter((u) => u.entrega === "inmediata").map((u) => u.ufm2), fut = xs.filter((u) => u.entrega === "futura").map((u) => u.ufm2);
    if (inm.length < 10 || fut.length < 10) continue;
    const d = mediana(fut)! / mediana(inm)! - 1;
    const [comuna, dorms] = k.split("|");
    porComuna.set(comuna, [...(porComuna.get(comuna) ?? []), d]);
    const mesesMed = mediana(xs.filter((u) => u.meses != null).map((u) => u.meses!));
    filasCT.push([comuna, `${dorms}D`, inm.length, fmt(mediana(inm), 1), fut.length, fmt(mediana(fut), 1), pctF(d), fmt(mesesMed)]);
  }
  console.log("\n3.2a · Corte transversal: entrega futura contra inmediata, UF/m² (celdas con n ≥ 10 por lado)");
  console.log(tablaMd(["comuna", "tipología", "n inmediata", "UF/m² inmediata", "n futura", "UF/m² futura", "futura / inmediata", "meses a la entrega (mediana)"], filasCT));
  // Por tramo de meses, pareado contra la inmediata de la misma celda.
  const tramos: Array<[string, number, number]> = [["1-6", 1, 6], ["7-12", 7, 12], ["13-24", 13, 24], ["25+", 25, 999]];
  const filasTr = tramos.map(([t, lo, hi]) => {
    const ds: number[] = [];
    let n = 0;
    for (const xs of celdas.values()) {
      const inm = xs.filter((u) => u.entrega === "inmediata").map((u) => u.ufm2);
      const fut = xs.filter((u) => u.entrega === "futura" && u.meses != null && u.meses >= lo && u.meses <= hi);
      if (inm.length < 10 || fut.length < 5) continue;
      n += fut.length;
      for (const u of fut) ds.push(u.ufm2 / mediana(inm)! - 1);
    }
    return [t, n, pctF(mediana(ds)), pctF(cuantil(ds, 0.25)), pctF(cuantil(ds, 0.75))];
  });
  console.log("\nPor meses hasta la entrega (cada unidad futura contra la mediana inmediata de su comuna y tipología; celdas con ≥ 10 inmediatas y ≥ 5 futuras):");
  console.log(tablaMd(["meses a la entrega", "n futuras", "descuento mediano", "p25", "p75"], filasTr));

  // 3.2b · Serie de precios: lo que hay.
  const idsNuevos = [...new Set([...filas.map((f) => f.id), ...(await paginar<{ aviso_id: string }>((a, b) => sb.from("bajas_avisos").select("aviso_id").eq("condicion", "nuevo").order("aviso_id").range(a, b))).map((r) => r.aviso_id)])];
  type P = { property_id: string; precio: number | string; moneda: string | null; visto_en: string };
  const historia = new Map<string, P[]>();
  for (let i = 0; i < idsNuevos.length; i += 300) {
    const { data, error } = await sb.from("scraped_properties_precios").select("property_id, precio, moneda, visto_en").in("property_id", idsNuevos.slice(i, i + 300)).order("visto_en");
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as P[]) historia.set(p.property_id, [...(historia.get(p.property_id) ?? []), p]);
    await new Promise((r) => setTimeout(r, 80));
  }
  const spans = [...historia.entries()].map(([id, ps]) => {
    const a = ps[0], z = ps[ps.length - 1];
    const dias = (new Date(z.visto_en).getTime() - new Date(a.visto_en).getTime()) / 864e5;
    const conv = (p: P) => (p.moneda === "UF" ? Number(p.precio) : Number(p.precio) / uf);
    return { id, n: ps.length, dias, cambio: conv(a) > 0 ? conv(z) / conv(a) - 1 : NaN, unidad: filas.find((f) => f.id === id)?.source_id.includes("#") ?? null };
  });
  const conCambio = spans.filter((s) => s.n > 1 && Number.isFinite(s.cambio));
  console.log(`\n3.2b · Serie de precios: ${fmt(historia.size)} propiedades nuevas con historia (${fmt(idsNuevos.length)} ids consultados); con más de una vista ${fmt(conCambio.length)}; largo de la serie: mediana ${fmt(mediana(spans.map((s) => s.dias)))} días, máximo ${fmt(Math.max(...spans.map((s) => s.dias)))} días; con 180 días o más: ${spans.filter((s) => s.dias >= 180).length}; con 90 o más: ${spans.filter((s) => s.dias >= 90).length}`);
  const u = conCambio.filter((s) => s.unidad === true), pr = conCambio.filter((s) => s.unidad === false);
  console.log(`      cambio primera → última vista: unidades (precio por unidad) n ${u.length}, mediana ${pctF(mediana(u.map((s) => s.cambio)))}, p25 ${pctF(cuantil(u.map((s) => s.cambio), 0.25))}, p75 ${pctF(cuantil(u.map((s) => s.cambio), 0.75))}; filas de proyecto («desde») n ${pr.length}, mediana ${pctF(mediana(pr.map((s) => s.cambio)))}`);

  // 3.3 · Las fuentes: GfK anual por comuna, INCOIN trimestral, CLAPES por zona.
  type F = { fuente: string; comuna: string; periodo: string; uf_m2: number | string; tipologia: string | null };
  const fuentes = await paginar<F>((a, b) => sb.from("plusvalia_fuentes_raw").select("fuente, comuna, periodo, uf_m2, tipologia").in("fuente", ["gfk", "incoin"]).order("id").range(a, b));
  type I = { ambito: string; tipologia: string; periodo: string; valor_indice: number | string };
  const indices = await paginar<I>((a, b) => sb.from("plusvalia_indices_raw").select("ambito, tipologia, periodo, valor_indice").eq("tipologia", "deptos").order("id").range(a, b));
  const cagr = (v0: number, v1: number, anios: number) => Math.pow(v1 / v0, 1 / anios) - 1;
  const gfkPorComuna = new Map<string, Array<{ periodo: string; v: number }>>();
  for (const f of fuentes.filter((f) => f.fuente === "gfk")) gfkPorComuna.set(f.comuna, [...(gfkPorComuna.get(f.comuna) ?? []), { periodo: f.periodo, v: Number(f.uf_m2) }]);
  const incoinPorComuna = new Map<string, Array<{ periodo: string; v: number; tip: string | null }>>();
  for (const f of fuentes.filter((f) => f.fuente === "incoin")) incoinPorComuna.set(f.comuna, [...(incoinPorComuna.get(f.comuna) ?? []), { periodo: f.periodo, v: Number(f.uf_m2), tip: f.tipologia }]);
  const clapes = new Map<string, number>();
  for (const z of ["RM", "Oriente", "Centro-Norte", "Sur-Oriente", "Sur-Poniente"]) {
    const xs = indices.filter((i) => i.ambito === z).sort((p, q) => p.periodo.localeCompare(q.periodo));
    if (xs.length) clapes.set(z, cagr(Number(xs[0].valor_indice), Number(xs[xs.length - 1].valor_indice), 16.75));
  }
  const anual = (serie: Array<{ periodo: string; v: number }>, desde: string, hasta: string) => {
    const a = serie.find((s) => s.periodo === desde), z = serie.find((s) => s.periodo === hasta);
    return a && z ? cagr(a.v, z.v, Number(hasta.slice(0, 4)) + (hasta.includes("Q1") ? 0.25 : 1) - Number(desde) - 1 + 1) : null;
  };
  const comunas = [...new Set([...gfkPorComuna.keys(), ...incoinPorComuna.keys()])].filter((c) => c !== "PROMEDIO GS").sort();
  const filas33 = comunas.map((c) => {
    const g = gfkPorComuna.get(c) ?? [];
    const g10 = anual(g, "2015", "2025-Q1");
    const g5 = anual(g, "2020", "2025-Q1");
    const inc = (incoinPorComuna.get(c) ?? []).sort((p, q) => p.periodo.localeCompare(q.periodo));
    const i1 = inc.length >= 2 ? inc[inc.length - 1].v / inc[0].v - 1 : null;
    return [c, g.length ? `${g[0].periodo}–${g[g.length - 1].periodo}` : "—", pctF(g10), pctF(g5), inc.length ? `${pctF(i1)} (${inc[0].periodo}→${inc[inc.length - 1].periodo}${inc[0].tip === "mixto_casas_deptos" ? ", mezcla casas" : ""})` : "—", ZONA_CLAPES[c] ? `${ZONA_CLAPES[c]} ${pctF(clapes.get(ZONA_CLAPES[c]))}` : "—"];
  });
  const prom = gfkPorComuna.get("PROMEDIO GS") ?? [];
  console.log(`\n3.3 · Crecimiento real (UF) del precio: GfK precio de oferta deptos nuevos (CAGR 2015→2025-Q1 y 2020→2025-Q1), INCOIN (Tinsa, 2024-Q4→2025-Q4, un año), CLAPES RealData deptos (transacciones CBR, índice real 2007-Q1→2023-Q4, por zona). Gran Santiago GfK 2015→2025-Q4: ${pctF(anual(prom, "2015", "2025-Q4"))} al año; CLAPES RM deptos: ${pctF(clapes.get("RM"))} al año.`);
  console.log(tablaMd(["comuna", "GfK serie", "GfK 10 años (anual)", "GfK 5 años (anual)", "INCOIN último año", "CLAPES zona (anual, 2007-2023)"], filas33));

  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync("scripts/analisis/motor-nuevos/out/7-plusvalia.json", JSON.stringify({ uf, calculadoAt: new Date().toISOString(), corteTransversal: filasCT, porTramo: filasTr, descuentoPorComuna: Object.fromEntries([...porComuna.entries()].map(([c, ds]) => [c, mediana(ds)])), serie: { props: historia.size, conCambio: conCambio.length, span180: spans.filter((s) => s.dias >= 180).length, cambioUnidades: mediana(u.map((s) => s.cambio)) }, gfk: Object.fromEntries(comunas.map((c) => [c, { g10: anual(gfkPorComuna.get(c) ?? [], "2015", "2025-Q1"), g5: anual(gfkPorComuna.get(c) ?? [], "2020", "2025-Q1") }])), clapes: Object.fromEntries(clapes), zonaClapes: ZONA_CLAPES }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
