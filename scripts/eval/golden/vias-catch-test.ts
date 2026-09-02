// ─────────────────────────────────────────────────────────────────────────────
// VÍAS · catch-test del goal "cuatro palancas siempre" (02-sep-2026).
//
// Invariantes que caza, sobre el caso real del contrato (cb0e8f46 · Huechuraba ·
// AJUSTA) y dos seeds del Golden Set (GS-5 Peñalolén: cruza solo el precio;
// GS-6 Ñuñoa: estructural con pie 10% explorado):
//   1. `vias` trae las CUATRO palancas LTR, cada una una vez, en orden canónico
//      precio · arriendo · plazo · pie.
//   2. `palancas` ≡ `vias.filter(cruza)` (mismo objetivo, misma cifra).
//   3. Estado por construcción: plazo en 30 ⇒ noAplica; pie ≥ 30 o bono ⇒ noAplica;
//      lo demás cruza o noCruza con el tope explorado de las constantes del motor.
//   4. `pieEsPalanca` ≡ "el pie se exploró" (no bono, bajo 30).
//   5. En el estructural, la vía del delta mínimo lleva `deltaMinimoPct` igual al
//      `deltaMinimoFueraDeTope` del hallazgo.
//   6. Expectativas del caso del contrato: precio cruza (−22,5%), arriendo noCruza
//      (tope 30), plazo noAplica (30 años), pie explorado hasta 30.
//
// Corre con: node --env-file=.env.local --import tsx scripts/eval/golden/vias-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import {
  DIST_PIE_TOPE_PCT,
  DIST_PLAZO_TOPE_ANIOS,
  topeParaVeredicto,
} from "../../../src/lib/distancia-veredicto-hallazgo";
import type { AnalisisInput, FullAnalysisResult, HallazgoDistanciaVeredicto, ViaDistancia } from "../../../src/lib/types";
import { GOLDEN_SEEDS, GOLDEN_ASOF } from "./seeds";

const CASO_CONTRATO_ID = "cb0e8f46-8dc5-4fc0-b24b-e68e2a927f2d";
const SEEDS = ["GS-5", "GS-6", "GS-7"];
/** Estructurales reales del parque para la FRASE (fix del signo, 02-sep-2026):
 *  12823999 San Miguel (plazo 30 ⇒ noAplica) y b47570e0 La Florida (plazo noAplica). */
const ESTRUCTURALES_FRASE = ["12823999", "b47570e0"];

/** La fraseCanonica estructural dice lo que el motor sabe, sin invertir el signo:
 *  topes probados + la cifra que recién cruzaría (de `vias`), plazo/pie por estado. */
function verificarFraseEstructural(tag: string, dv: HallazgoDistanciaVeredicto, fallas: string[]) {
  const f = (msg: string) => fallas.push(`${tag} · frase · ${msg}`);
  const v = dv.valor;
  if (!v.esEstructural || !v.vias) return;
  const fr = dv.fraseCanonica;
  if (/Ni bajando el precio|Ni subiendo el arriendo/.test(fr)) f(`sigue con el signo invertido: "${fr.slice(0, 80)}"`);
  const vP = v.vias.find((x) => x.palanca === "precio");
  const vA = v.vias.find((x) => x.palanca === "arriendo");
  if (vP?.estado === "noCruza" && !fr.includes(`hasta −${vP.topeExplorado}%`)) f(`no cita el tope del precio −${vP.topeExplorado}%`);
  if (vA?.estado === "noCruza" && !fr.includes(`hasta +${vA.topeExplorado}%`)) f(`no cita el tope del arriendo +${vA.topeExplorado}%`);
  const dm = v.deltaMinimoFueraDeTope;
  if (dm) {
    const cifra = `${dm.deltaPct < 0 ? "−" : "+"}${Number.isInteger(Math.abs(dm.deltaPct)) ? Math.abs(dm.deltaPct) : Math.abs(dm.deltaPct).toFixed(1).replace(".", ",")}%`;
    if (!fr.includes(`recién con ${cifra}`)) f(`no cita el mínimo que cruza (${cifra}) como lo que recién cruzaría`);
  } else if (!fr.includes("ningún ajuste en rango")) f("sin mínimo debía cerrar con 'ningún ajuste en rango'");
  const vPlazo = v.vias.find((x) => x.palanca === "plazo");
  const vPie = v.vias.find((x) => x.palanca === "pie");
  if (vPlazo?.estado === "noCruza" && !fr.includes(`a ${vPlazo.topeExplorado} años`)) f("plazo noCruza sin su tope en la segunda oración");
  if (vPlazo?.estado === "noAplica" && /años/.test(fr)) f("plazo noAplica y la frase igual habla de años");
  if (vPie?.estado === "noCruza" && !fr.includes(`con pie ${vPie.topeExplorado}%`)) f("pie noCruza sin su tope en la segunda oración");
  if (vPie?.estado === "noAplica" && /\bpie\b/.test(fr)) f("pie noAplica y la frase igual habla del pie");
}
const ORDEN: ViaDistancia["palanca"][] = ["precio", "arriendo", "plazo", "pie"];

type Fila = {
  id: string;
  nombre?: string | null;
  input_data: AnalisisInput | null;
  results: FullAnalysisResult | null;
  created_at: string;
  mediana_comuna_snapshot: { mediana: number | null; n?: number } | null;
};

function distanciaDe(r: FullAnalysisResult): HallazgoDistanciaVeredicto | null {
  return ((r.hallazgos ?? []) as { id: string }[]).find((h) => h.id === "distancia_veredicto") as
    | HallazgoDistanciaVeredicto
    | undefined ?? null;
}

function verificar(tag: string, input: AnalisisInput, dv: HallazgoDistanciaVeredicto | null, fallas: string[]) {
  const f = (msg: string) => fallas.push(`${tag} · ${msg}`);
  if (!dv) return f("sin hallazgo distancia_veredicto");
  const v = dv.valor;
  const vias = v.vias;
  if (!vias) return f("sin `vias`");
  // 1. cuatro, únicas, en orden canónico
  if (vias.length !== 4) f(`vias.length ${vias.length} ≠ 4`);
  if (vias.map((x) => x.palanca).join(",") !== ORDEN.join(",")) f(`orden ${vias.map((x) => x.palanca).join(",")} ≠ ${ORDEN.join(",")}`);
  // 2. palancas ≡ vias.filter(cruza)
  const cruzan = vias.filter((x): x is Extract<ViaDistancia, { estado: "cruza" }> => x.estado === "cruza");
  if (cruzan.length !== v.palancas.length) f(`${cruzan.length} vías cruzan pero palancas tiene ${v.palancas.length}`);
  for (const c of cruzan) {
    const p = v.palancas.find((x) => x.palanca === c.palanca);
    if (!p) f(`la vía ${c.palanca} cruza y no está en palancas`);
    else if (p.objetivo !== c.objetivo || p.deltaPct !== c.deltaPct) f(`la vía ${c.palanca} difiere de palancas (${c.objetivo}/${c.deltaPct} vs ${p.objetivo}/${p.deltaPct})`);
  }
  if (v.esEstructural !== (cruzan.length === 0)) f(`esEstructural=${v.esEstructural} con ${cruzan.length} vías que cruzan`);
  // 3. estados por construcción
  const plazo = vias.find((x) => x.palanca === "plazo")!;
  const pie = vias.find((x) => x.palanca === "pie")!;
  if (input.plazoCredito >= DIST_PLAZO_TOPE_ANIOS && plazo.estado !== "noAplica") f(`plazo ${input.plazoCredito} debía ser noAplica y es ${plazo.estado}`);
  if (input.plazoCredito > 0 && input.plazoCredito < DIST_PLAZO_TOPE_ANIOS && plazo.estado === "noAplica") f(`plazo ${input.plazoCredito} no debía ser noAplica`);
  if (input.piePct >= DIST_PIE_TOPE_PCT && pie.estado !== "noAplica") f(`pie ${input.piePct} debía ser noAplica y es ${pie.estado}`);
  const tope = topeParaVeredicto(v.veredictoBase);
  for (const x of vias) {
    if (x.estado === "noCruza") {
      const esperado = x.palanca === "plazo" ? DIST_PLAZO_TOPE_ANIOS : x.palanca === "pie" ? DIST_PIE_TOPE_PCT : tope;
      if (x.topeExplorado !== esperado) f(`${x.palanca} noCruza con tope ${x.topeExplorado} ≠ ${esperado}`);
      if (!x.razon) f(`${x.palanca} noCruza sin razón`);
    }
    if (x.estado === "noAplica" && !x.razon) f(`${x.palanca} noAplica sin razón`);
  }
  // 3b. prioridad: un pie ≥ 20% que cruza no es palancaMasBarata si hay otra que cruza
  if (pie.estado === "cruza" && input.piePct >= 20 && v.palancas.length > 1 && v.palancaMasBarata?.palanca === "pie") {
    f(`pie ${input.piePct}% cruza y quedó como palancaMasBarata teniendo otra vía que cruza`);
  }
  if (pie.estado === "cruza" && input.piePct >= 20 && v.palancas[v.palancas.length - 1]?.palanca !== "pie") {
    f(`pie ${input.piePct}% cruza y no está al final de palancas`);
  }
  // 4. pieEsPalanca ≡ se exploró
  const pieExplorado = pie.estado !== "noAplica";
  if (!!v.pieEsPalanca !== pieExplorado) f(`pieEsPalanca=${v.pieEsPalanca} pero el pie ${pieExplorado ? "sí" : "no"} se exploró`);
  // 5. estructural: deltaMinimoPct en la vía del delta mínimo
  if (v.esEstructural && v.deltaMinimoFueraDeTope) {
    const dm = v.deltaMinimoFueraDeTope;
    const via = vias.find((x) => x.palanca === dm.palanca);
    if (!via || via.estado !== "noCruza" || via.deltaMinimoPct !== dm.deltaPct) f(`la vía ${dm.palanca} no lleva deltaMinimoPct ${dm.deltaPct}`);
  }
  // 6. la frase estructural, sin el signo invertido
  verificarFraseEstructural(tag, dv, fallas);
}

function resumen(dv: HallazgoDistanciaVeredicto | null): string {
  if (!dv?.valor.vias) return "sin vias";
  return dv.valor.vias
    .map((x) =>
      x.estado === "cruza"
        ? `${x.palanca}=cruza(${x.deltaPct > 0 ? "+" : ""}${x.deltaPct}→${x.objetivo})`
        : x.estado === "noCruza"
          ? `${x.palanca}=noCruza(tope ${x.topeExplorado}${x.deltaMinimoPct != null ? ` · mín ${x.deltaMinimoPct}` : ""})`
          : `${x.palanca}=noAplica`,
    )
    .join(" · ");
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const fallas: string[] = [];
  const casos: string[] = [];

  // (a) el caso del contrato, recomputado como lo hace el informe
  {
    const { data, error } = await sb
      .from("analisis")
      .select("id, nombre, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("id", CASO_CONTRATO_ID)
      .single();
    if (error || !data) fallas.push(`cb0e8f46 · no cargó: ${error?.message}`);
    else {
      const f = data as Fila;
      const uf = resolveUfForAnalysis(f.results, f.input_data, 39000, f.id);
      const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0 } : undefined;
      const r = recomputeResultsForLegacy(f.input_data!, uf, mediana, new Date(f.created_at));
      const dv = distanciaDe(r);
      verificar("cb0e8f46", f.input_data!, dv, fallas);
      // 6. expectativas del contrato (Huechuraba · AJUSTA · pie 20 · plazo 30)
      const v = dv?.valor;
      const precio = v?.vias?.find((x) => x.palanca === "precio");
      const arr = v?.vias?.find((x) => x.palanca === "arriendo");
      const plazo = v?.vias?.find((x) => x.palanca === "plazo");
      const pie = v?.vias?.find((x) => x.palanca === "pie");
      if (!(precio?.estado === "cruza" && precio.deltaPct === -22.5)) fallas.push(`cb0e8f46 · precio debía cruzar a −22,5 y es ${precio?.estado} ${precio?.estado === "cruza" ? precio.deltaPct : ""}`);
      if (!(arr?.estado === "noCruza" && arr.topeExplorado === 30)) fallas.push(`cb0e8f46 · arriendo debía ser noCruza tope 30 y es ${arr?.estado}`);
      if (plazo?.estado !== "noAplica") fallas.push(`cb0e8f46 · plazo (30 años) debía ser noAplica y es ${plazo?.estado}`);
      if (!pie || pie.estado === "noAplica") fallas.push(`cb0e8f46 · pie 20% debía explorarse hasta 30 y es ${pie?.estado}`);
      casos.push(`cb0e8f46 Huechuraba · ${v?.veredictoBase} → ${resumen(dv)}`);
    }
  }

  // (b) seeds del Golden Set, recomputados con la UF y la fecha congeladas del set
  for (const key of SEEDS) {
    const seed = GOLDEN_SEEDS.find((s) => s.key === key);
    if (!seed) { fallas.push(`${key} · no está en GOLDEN_SEEDS`); continue; }
    const { data, error } = await sb
      .from("analisis")
      .select("id, nombre, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("id", seed.uuid)
      .single();
    if (error || !data) { fallas.push(`${key} · no cargó: ${error?.message}`); continue; }
    const f = data as Fila;
    const p = f.results?.metrics?.precioCLP;
    const ufSeed = p && f.input_data?.precio ? Math.round(p / f.input_data.precio) : 38800;
    const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0 } : undefined;
    const r = recomputeResultsForLegacy(f.input_data!, ufSeed, mediana, GOLDEN_ASOF);
    const dv = distanciaDe(r);
    verificar(key, f.input_data!, dv, fallas);
    const cruzan = dv?.valor.vias?.filter((x) => x.estado === "cruza").length ?? 0;
    if (cruzan === 4) fallas.push(`${key} · las cuatro cruzan: el seed dejó de servir como caso con alguna vía que no cruza`);
    casos.push(`${key} ${seed.input.comuna} · ${dv?.valor.veredictoBase} → ${resumen(dv)}`);
  }

  // (c) estructurales reales del parque, para la FRASE (plazo noAplica incluido).
  // uuid no admite LIKE en PostgREST: se pagina y se filtra por prefijo en cliente.
  {
    const pendientes = new Set(ESTRUCTURALES_FRASE);
    for (let from = 0; from < 3000 && pendientes.size; from += 500) {
      const { data, error } = await sb
        .from("analisis")
        .select("id, nombre, input_data, results, created_at, mediana_comuna_snapshot")
        .eq("tipo_analisis", "long-term")
        .order("created_at", { ascending: false })
        .range(from, from + 499);
      if (error || !data?.length) break;
      for (const f of data as Fila[]) {
        const pref = [...pendientes].find((p) => f.id.startsWith(p));
        if (!pref || !f.input_data) continue;
        pendientes.delete(pref);
        const uf = resolveUfForAnalysis(f.results, f.input_data, 39000, f.id);
        const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0 } : undefined;
        const r = recomputeResultsForLegacy(f.input_data, uf, mediana, new Date(f.created_at));
        const dv = distanciaDe(r);
        verificar(pref, f.input_data, dv, fallas);
        if (!dv?.valor.esEstructural) fallas.push(`${pref} · debía ser estructural`);
        casos.push(`${pref} · ${dv?.valor.veredictoBase} → ${resumen(dv)}\n      frase: ${dv?.fraseCanonica}`);
      }
    }
    for (const p of pendientes) fallas.push(`${p} · no se encontró en el parque`);
  }

  console.log("\nVÍAS · catch-test (cuatro palancas siempre)");
  for (const c of casos) console.log(`  ${c}`);
  for (const x of fallas) console.log(`  ✗ ${x}`);
  if (fallas.length) {
    console.log("\n✗ ROJO");
    process.exit(1);
  }
  console.log("\n✓ VERDE");
}

main().catch((e) => { console.error(e); process.exit(1); });
