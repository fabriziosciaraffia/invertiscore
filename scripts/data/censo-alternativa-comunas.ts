// Censo de cobertura de la ALTERNATIVA DE COMUNAS (contrato §5).
//
//   node --env-file=.env.local --import tsx scripts/data/censo-alternativa-comunas.ts
//
// Responde dos preguntas sobre el parque LTR vivo:
//   · cuántas filas caen en el estado SIN SALIDA de la recomendación
//   · de ésas, cuántas tienen alternativa y cuántas quedan vacías
//
// CUÁNDO CORRERLO: después de cada regeneración de `comuna-mercado.gen.ts`. Ese
// módulo es una foto de 90 días del mercado, así que la cobertura se mueve con él —
// una comuna que pierde muestra deja de ser candidata para todas las filas de esa
// tipología, y nada más lo avisaría. El catch-test fija la FORMA del dato; esto
// mide su ALCANCE, que es lo que el catch-test no puede ver.
//
// MIDE CON LA FUNCIÓN DEL INFORME, NO CON UNA COPIA. `construirAlternativaComunas`
// es exactamente la que corre en la card: si este script reimplementara el
// contrafactual, mediría su propia versión y las dos podrían divergir sin que nadie
// lo note. La primera versión de este censo tenía esa copia y por eso se retiró.
//
// Read-only: no escribe una sola fila.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../src/lib/analysis/recompute-results-for-legacy";
import { construirAlternativaComunas } from "../../src/lib/alternativa-comunas";
import { construirLoQueHariaYo } from "../../src/lib/lo-que-haria-yo";
import { COMUNA_MERCADO_FECHA, VENTA_POR_COMUNA, ARRIENDO_POR_COMUNA } from "../../src/lib/comuna-mercado.gen";
import { resolveUfForAnalysis } from "../../src/lib/uf";
import { PAGINA_POSTGREST } from "../../src/lib/comuna-stats";
import type { AnalisisInput, Veredicto } from "../../src/lib/types";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * ¿La card cae al estado SIN SALIDA? La MISMA forma que usa el hero: sin mix útil
 * —o con uno que solo llega al escalón intermedio, que por §5 no es una
 * recomendación— y sin palancas que crucen solas.
 */
function esSinSalida(res: any, input: AnalisisInput, ufClp: number): boolean {
  // Los hallazgos salen de la LISTA por id, como en el hero. No existen campos
  // `hallazgoDistanciaVeredicto` ni `hallazgoSensibilidad` en el resultado:
  // leerlos por esos nombres da null en las dos y el censo mide 0 sin salida en
  // 1.201 filas. Pasó, y por eso queda escrito.
  const hs = (res?.hallazgos ?? []) as any[];
  const bloque = construirLoQueHariaYo({
    veredicto: res.veredicto as Veredicto,
    distancia: hs.find((h) => h.id === "distancia_veredicto") ?? null,
    sensibilidad: hs.find((h) => h.id === "sensibilidad") ?? null,
    arriendoDeclaradoCLP: input.arriendo ?? 0,
    currency: "CLP",
    valorUF: ufClp,
  });
  if (!bloque) return false;
  const mix = bloque.mix ?? null;
  const sinMixUtil = !mix || mix.destino !== "COMPRAR";
  return sinMixUtil && (bloque.filas?.length ?? 0) === 0;
}

async function main() {
  console.log(`mercado por comuna: ${COMUNA_MERCADO_FECHA} · ${Object.keys(VENTA_POR_COMUNA).length} celdas de venta · ${Object.keys(ARRIENDO_POR_COMUNA).length} comunas con arriendo`);

  const filas: any[] = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await sb
      .from("analisis")
      .select("id, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("tipo_analisis", "long-term")
      .not("results", "is", null)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  console.log(`parque LTR: ${filas.length} filas\n`);

  let conMotor = 0, sinSalida = 0, conAlternativa = 0, vacias = 0;
  const histo = new Map<number, number>();
  const ranking = new Map<string, number>();
  const ejemplos: string[] = [];

  for (const f of filas) {
    const input = f.input_data as AnalisisInput;
    if (!input?.precio || !input?.superficie) continue;
    // La UF CONGELADA, reconstruida igual que el render: precioCLP / precio.
    const ufClp = resolveUfForAnalysis(f.results, input, 39000, f.id);
    const snap = f.mediana_comuna_snapshot as any;
    const mediana = snap != null ? { mediana: snap.mediana, n: snap.n ?? 0, universo: snap.universo } : undefined;
    const asOf = new Date(f.created_at);

    let res;
    try { res = recomputeResultsForLegacy(input, ufClp, mediana, asOf); } catch { continue; }
    conMotor++;
    if (!esSinSalida(res, input, ufClp)) continue;
    sinSalida++;

    const alt = construirAlternativaComunas({ input, ufClp, asOf });
    if (!alt) { vacias++; continue; }
    conAlternativa++;
    histo.set(alt.todas.length, (histo.get(alt.todas.length) ?? 0) + 1);
    for (const c of alt.nombradas) ranking.set(c, (ranking.get(c) ?? 0) + 1);
    if (ejemplos.length < 5) ejemplos.push(`${f.id}  ${input.comuna} ${input.dormitorios}D → ${alt.nombradas.join(" o ")}`);
  }

  const pct = (x: number, t: number) => (t ? `${((x / t) * 100).toFixed(1)}%` : "—");
  console.log("════════ CENSO ════════");
  console.log(`filas recomputadas      ${conMotor}`);
  console.log(`estado SIN SALIDA       ${sinSalida}  (${pct(sinSalida, conMotor)} del parque)`);
  console.log(`  con alternativa       ${conAlternativa}  (${pct(conAlternativa, sinSalida)} de las sin salida)`);
  console.log(`  sin ninguna           ${vacias}  (${pct(vacias, sinSalida)})`);

  console.log("\ncuántas comunas cruzan, por fila:");
  for (const k of [...histo.keys()].sort((a, b) => a - b)) {
    console.log(`  ${String(k).padStart(2)} comuna(s): ${histo.get(k)}`);
  }
  console.log("\nlas más nombradas (las que la línea muestra):");
  for (const [c, n] of [...ranking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${c.padEnd(20)} ${n}`);
  }
  console.log("\nejemplos:");
  for (const e of ejemplos) console.log(`  ${e}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
