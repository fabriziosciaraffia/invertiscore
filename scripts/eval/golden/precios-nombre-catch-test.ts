// ─────────────────────────────────────────────────────────────────────────────
// UN NOMBRE POR PRECIO · catch-test (goal 02-sep-2026).
//
// Tres precios con nombre propio: umbral de veredicto ("donde cambia el veredicto"),
// sugerido ("donde el aporte se vuelve sostenible") y límite TIR 6%. El motor ya no
// colapsa el sugerido al umbral. (El bloque JERARQUÍA del prompt se fue con la IA, 25-sep-2026.)
// Sobre cinco casos reales recomputados por la cadena del informe:
//   681c32e4 Ñuñoa      — sugerido BAJO el umbral (AJUSTA de destino)
//   26f4a631 La Florida — sugerido bajo el umbral (COMPRAR de destino)
//   12823999 San Miguel — estructural con mínimo fuera de rango (sin umbral, sin plan)
//   27e8de38 Lo Barnechea — estructural coherente (sugerido sobre el mínimo)
//   cb0e8f46 Huechuraba — el caso del contrato (umbral 3.945 · sugerido 3.827)
// Invariantes: umbral ≡ palanca precio de distancia; sugerido nunca pisado por el umbral
// (el motor ya no lo colapsa); estructural ⇒ umbral null.
//
// Corre: node --env-file=.env.local --import tsx scripts/eval/golden/precios-nombre-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import type { AnalisisInput, FullAnalysisResult, HallazgoDistanciaVeredicto } from "../../../src/lib/types";

const CASOS: { pref: string; espera: "sugeridoBajoUmbral" | "estructuralBajoMinimo" | "estructuralCoherente" | "contrato" }[] = [
  { pref: "681c32e4", espera: "sugeridoBajoUmbral" },
  { pref: "26f4a631", espera: "sugeridoBajoUmbral" },
  { pref: "12823999", espera: "estructuralBajoMinimo" },
  { pref: "27e8de38", espera: "estructuralCoherente" },
  { pref: "cb0e8f46", espera: "contrato" },
];
type Fila = { id: string; comuna: string | null; input_data: AnalisisInput | null; results: FullAnalysisResult | null; created_at: string; mediana_comuna_snapshot: { mediana: number | null; n?: number } | null };
const dist = (r: FullAnalysisResult) =>
  (((r.hallazgos ?? []) as { id: string }[]).find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;

// ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: se fueron NEG-TECHO (el guard de «techo» sobre la prosa de negociación) y el
// bloque de jerarquía de precios que leía el prompt. Quedan las reglas del motor.

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const fallas: string[] = [];
  const pendientes = new Map(CASOS.map((c) => [c.pref, c]));
  const filas: Fila[] = [];
  for (let from = 0; from < 3000 && pendientes.size; from += 500) {
    const { data, error } = await sb.from("analisis").select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("tipo_analisis", "long-term").order("created_at", { ascending: false }).range(from, from + 499);
    if (error || !data?.length) break;
    for (const f of data as Fila[]) {
      const pref = [...pendientes.keys()].find((p) => f.id.startsWith(p));
      if (pref) { filas.push(f); pendientes.delete(pref); }
    }
  }
  for (const p of pendientes.keys()) fallas.push(`${p} · no se encontró en el parque`);

  for (const f of filas) {
    const caso = CASOS.find((c) => f.id.startsWith(c.pref))!;
    const tag = `${caso.pref} ${f.comuna ?? ""}`;
    const F = (m: string) => fallas.push(`${tag} · ${m}`);
    if (!f.input_data) { F("sin input"); continue; }
    const uf = resolveUfForAnalysis(f.results, f.input_data, 39000, f.id);
    const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0 } : undefined;
    const r = recomputeResultsForLegacy(f.input_data, uf, mediana, new Date(f.created_at));
    const neg = r.negociacion;
    const dv = dist(r);
    if (!neg || !dv) { F("sin negociación o sin distancia"); continue; }
    const precio = f.input_data.precio;
    const sugerido = neg.precioSugeridoUF;
    const umbral = neg.precioUmbralVeredictoUF ?? null;
    const palancaPrecio = dv.valor.palancas.find((x) => x.palanca === "precio") ?? null;
    const dm = dv.valor.deltaMinimoFueraDeTope;
    // 1. el sugerido ya no se colapsa al umbral
    // 2. umbral ≡ palanca precio de distancia (o null si no cruza)
    if (palancaPrecio && umbral !== palancaPrecio.objetivo) F(`umbral ${umbral} ≠ palanca precio ${palancaPrecio.objetivo}`);
    if (!palancaPrecio && umbral !== null) F(`umbral ${umbral} sin palanca precio que cruce`);
    if (dv.valor.esEstructural && umbral !== null) F("estructural con umbral");
    // ⛔ LAS «EXPECTATIVAS POR CASO» SE FUERON (17-sep-2026). Eran clasificaciones y cifras
    // escritas a mano por FILA VIVA del parque —una tabla `CASOS` con `espera:
    // "estructuralBajoMinimo"`, y un `if (umbral !== 3945)` con el número literal—. El motor
    // las movió por decisión de producto (cf5264d7, 12-sep) y el test quedó rojo sin que nada
    // estuviera roto. En rojo se quedó, porque tampoco estaba cableado al runner.
    //
    // Lo que queda arriba son REGLAS, y pasan con cualquier calibración: que el umbral que
    // publica la negociación sea EXACTAMENTE la palanca de precio de la distancia; que sin
    // palanca que cruce no haya umbral; que un estructural no traiga umbral. Son acuerdos
    // entre dos salidas del motor, no fotos de una fila. Y abajo sigue el bloque de jerarquía,
    // que se mide sobre lo que el recompute devuelva.
    // (CLAUDE.md § Testing: «un catch-test fija la REGLA, no la cifra».)
    console.log(`\n── ${tag} · ${dv.valor.veredictoBase} · pedido UF ${Math.round(precio)} · umbral ${umbral ?? "—"} · sostenible ${Math.round(sugerido)} (${neg.modo}) · mínimo ${dm ? `${dm.palanca} ${dm.deltaPct}%` : "—"} · límite TIR ${neg.precioLimiteUF ?? "—"}`);
  }
  console.log("\nUN NOMBRE POR PRECIO · catch-test");
  for (const x of fallas) console.log(`  ✗ ${x}`);
  if (fallas.length) { console.log("\n✗ ROJO"); process.exit(1); }
  console.log("\n✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
