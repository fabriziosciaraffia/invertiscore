// ─────────────────────────────────────────────────────────────────────────────
// UN NOMBRE POR PRECIO · catch-test (goal 02-sep-2026).
//
// Tres precios con nombre propio: umbral de veredicto ("donde cambia el veredicto"),
// sugerido ("donde el aporte se vuelve sostenible") y límite TIR 6%. El motor ya no
// colapsa el sugerido al umbral, y el bloque JERARQUÍA que lee el prompt nombra cada uno.
// Sobre cinco casos reales recomputados por la cadena del informe:
//   681c32e4 Ñuñoa      — sugerido BAJO el umbral (AJUSTA de destino)
//   26f4a631 La Florida — sugerido bajo el umbral (COMPRAR de destino)
//   12823999 San Miguel — estructural con mínimo fuera de rango (sin umbral, sin plan)
//   27e8de38 Lo Barnechea — estructural coherente (sugerido sobre el mínimo)
//   cb0e8f46 Huechuraba — el caso del contrato (umbral 3.945 · sugerido 3.827)
// Invariantes: umbral ≡ palanca precio de distancia; sugerido nunca pisado por el umbral
// (`sugeridoMandadoPorVeredicto` false); estructural ⇒ umbral null; el bloque de
// jerarquía no dice "techo", nombra cada precio y en el estructural no ofrece objetivo.
//
// Corre: node --env-file=.env.local --import tsx scripts/eval/golden/precios-nombre-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import { construirJerarquiaPrecios } from "../../../src/lib/precio-jerarquia";
import { lecturaPrecioFlujoNeutro } from "../../../src/lib/ai-generation";
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
    if (neg.sugeridoMandadoPorVeredicto) F("sugeridoMandadoPorVeredicto sigue en true");
    // 2. umbral ≡ palanca precio de distancia (o null si no cruza)
    if (palancaPrecio && umbral !== palancaPrecio.objetivo) F(`umbral ${umbral} ≠ palanca precio ${palancaPrecio.objetivo}`);
    if (!palancaPrecio && umbral !== null) F(`umbral ${umbral} sin palanca precio que cruce`);
    if (dv.valor.esEstructural && umbral !== null) F("estructural con umbral");
    // 3. expectativas por caso
    if (caso.espera === "sugeridoBajoUmbral") {
      if (umbral === null) F("debía tener umbral");
      else if (!(sugerido < umbral)) F(`sugerido ${sugerido} debía quedar bajo el umbral ${umbral}`);
    }
    if (caso.espera === "estructuralBajoMinimo" || caso.espera === "estructuralCoherente") {
      if (!dv.valor.esEstructural) F("debía ser estructural");
      if (!dm || dm.palanca !== "precio") F("debía traer mínimo fuera de tope por precio");
      else {
        const minimo = precio * (1 + dm.deltaPct / 100);
        if (caso.espera === "estructuralBajoMinimo" && !(sugerido < minimo)) F(`sugerido ${sugerido} debía quedar bajo el mínimo ${Math.round(minimo)}`);
        if (caso.espera === "estructuralCoherente" && !(sugerido > minimo)) F(`sugerido ${sugerido} debía quedar sobre el mínimo ${Math.round(minimo)}`);
      }
    }
    if (caso.espera === "contrato") {
      if (umbral !== 3945) F(`umbral ${umbral} ≠ 3945`);
      if (Math.round(sugerido) !== 3827) F(`sugerido ${sugerido} ≠ 3827`);
    }
    // 4. el bloque de jerarquía: sin "techo", con nombres; estructural sin objetivo
    const m = r.metrics;
    const jer = construirJerarquiaPrecios({
      precioPedidoUF: precio,
      objetivoUF: umbral,
      veredictoAlUmbral: neg.veredictoAlUmbral ?? null,
      sostenibleUF: Math.round(sugerido),
      modoSugerido: neg.modo ?? "alinear_mercado",
      esEstructural: dv.valor.esEstructural,
      minimoFueraDeRangoUF: dm?.palanca === "precio" ? Math.round(precio * (1 + dm.deltaPct / 100)) : null,
      minimoFueraDeRangoPct: dm?.palanca === "precio" ? dm.deltaPct : null,
      precioFlujoNeutroUF: m.precioFlujoNeutroUF ?? 0,
      descuentoParaNeutro: m.descuentoParaNeutro ?? 0,
      lecturaFlujoNeutro: lecturaPrecioFlujoNeutro(m.precioFlujoNeutroUF ?? 0, m.descuentoParaNeutro ?? 0),
      limiteTirUF: neg.precioLimiteUF ?? null,
      sinCapitalPropio: m.pieCLP === 0,
    });
    if (/techo/i.test(jer.bloque)) F("el bloque de jerarquía dice 'techo'");
    if (dv.valor.esEstructural) {
      if (jer.precios.some((x) => x.rol === "objetivo" || x.rol === "sostenible")) F("estructural con objetivo o sostenible en la jerarquía");
      if (dm?.palanca === "precio" && !jer.precios.some((x) => x.rol === "minimo_fuera_rango")) F("estructural sin el mínimo fuera de rango");
    } else {
      if (!jer.precios.some((x) => x.rol === "objetivo")) F("sin objetivo en la jerarquía");
      if (umbral !== null && !/donde cambia el veredicto/i.test(jer.bloque)) F("el objetivo no se llama 'donde cambia el veredicto'");
      if (umbral !== null && Math.abs(sugerido - umbral) / umbral >= 0.02 && !jer.precios.some((x) => x.rol === "sostenible")) F("sugerido distinto del umbral y sin línea 'sostenible'");
    }
    console.log(`\n── ${tag} · ${dv.valor.veredictoBase} · pedido UF ${Math.round(precio)} · umbral ${umbral ?? "—"} · sostenible ${Math.round(sugerido)} (${neg.modo}) · mínimo ${dm ? `${dm.palanca} ${dm.deltaPct}%` : "—"} · límite TIR ${neg.precioLimiteUF ?? "—"}`);
    console.log(`   roles: ${jer.precios.map((x) => `${x.rol}=${Math.round(x.uf)}`).join(" · ")}`);
  }
  console.log("\nUN NOMBRE POR PRECIO · catch-test");
  for (const x of fallas) console.log(`  ✗ ${x}`);
  if (fallas.length) { console.log("\n✗ ROJO"); process.exit(1); }
  console.log("\n✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
