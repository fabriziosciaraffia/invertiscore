// ============================================================================
// REGEN DE PROSA POR HALLAZGO NUEVO — operación de datos, por lote
// ============================================================================
// Cuando el motor estrena un hallazgo que la prosa debe narrar, las filas con
// `ai_analysis` ya cacheado quedan ciegas: el recompute on-load regenera `results`
// en cada carga, pero la prosa vive en columna aparte y no se toca nunca. Este
// script cierra esa brecha por lote.
//
// Estrenado para `distancia_veredicto` (LTR). Volverá a hacer falta con STR y
// AMBAS, por eso queda parametrizado por hallazgo y no hardcodeado al caso.
//
//   # 1. Ver la lista sin tocar nada (default)
//   node --env-file=.env.local --import tsx scripts/regen-prosa-hallazgo.ts
//
//   # 2. Regenerar de verdad
//   node --env-file=.env.local --import tsx scripts/regen-prosa-hallazgo.ts --write
//
//   # Opciones: --dias=60 · --limite=N · --excluir=id1,id2 · --hallazgo=<id>
//
// GARANTÍAS
// ---------
// · NO cobra créditos. El cobro vive en la ruta HTTP (/api/analisis/ai) y solo
//   dispara cuando `!hadPriorProse`; acá el criterio de selección EXIGE prosa
//   previa, así que por construcción ninguna fila elegible podría cobrar. Este
//   script además llama a generateAiAnalysis directo, que no toca créditos.
// · Usa el MISMO pipeline que la ruta (generateAiAnalysis). No hay camino ad-hoc:
//   la ruta solo agrega auth, cache-check, gate de crédito y lock — nada de eso
//   aplica a una regen administrativa.
// · GUARD ESTRUCTURAL: si el motor dice que ningún ajuste salva el deal y la prosa
//   nueva igual ofrece negociación, se reintenta. Si no converge, la fila queda
//   SIN regenerar y con su prosa vieja: imperfecta es mejor que rota. El guard se
//   lee del warn real que emite ai-generation ([DISTANCIA-ESTRUCTURAL]) — no se
//   replica la regla acá, para que no drifte.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { AnalisisInput } from "@/lib/types";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { generateAiAnalysis } from "@/lib/ai-generation";

const arg = (n: string, def?: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const WRITE = process.argv.includes("--write");
const DIAS = Number(arg("dias", "60"));
const LIMITE = Number(arg("limite", "0"));
const HALLAZGO = arg("hallazgo", "distancia_veredicto")!;
const EXCLUIR = new Set((arg("excluir", "") || "").split(",").filter(Boolean));
const MAX_INTENTOS = 2;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Captura los console.warn de una llamada (mismo patrón que el Golden Set). */
async function conWarns<T>(fn: () => Promise<T>): Promise<{ result: T; warns: string[] }> {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => {
    warns.push(a.map(String).join(" "));
    orig(...(a as []));
  };
  try {
    return { result: await fn(), warns };
  } finally {
    console.warn = orig;
  }
}

async function main() {
  const desde = new Date(Date.now() - DIAS * 864e5).toISOString();
  const { data: rows } = await sb
    .from("analisis")
    .select("*")
    .eq("tipo_analisis", "long-term")
    .gte("created_at", desde)
    .not("ai_analysis", "is", null)
    .order("created_at", { ascending: false });

  const elegibles: { id: string; comuna: string; ver: string; estructural: boolean }[] = [];
  for (const row of rows ?? []) {
    if (EXCLUIR.has(row.id)) continue;
    const input: AnalisisInput = row.input_data;
    if (!input?.precio || !input?.arriendo || !row.results?.metrics?.precioCLP) continue;
    const uf = Math.round(row.results.metrics.precioCLP / input.precio);
    if (!Number.isFinite(uf) || uf <= 0) continue;
    let R: any;
    try {
      R = recomputeResultsForLegacy(input, uf, row.mediana_comuna_snapshot ?? undefined, new Date(row.created_at));
    } catch {
      continue;
    }
    const h: any = (R.hallazgos ?? []).find((x: any) => x.id === HALLAZGO);
    if (!h) continue;
    elegibles.push({
      id: row.id,
      comuna: row.comuna ?? "—",
      ver: R.veredicto,
      estructural: h.valor?.esEstructural === true,
    });
  }

  const lista = LIMITE > 0 ? elegibles.slice(0, LIMITE) : elegibles;
  const estructurales = lista.filter((x) => x.estructural);
  console.log(`═══ REGEN DE PROSA · hallazgo "${HALLAZGO}" · últimos ${DIAS} días ═══`);
  console.log(`  elegibles: ${lista.length}  (recuperables ${lista.length - estructurales.length} · estructurales ${estructurales.length})`);
  if (EXCLUIR.size) console.log(`  excluidos por flag: ${[...EXCLUIR].join(", ")}`);
  console.log("");
  for (const x of lista) {
    console.log(`  ${x.id}  ${x.comuna.padEnd(16)} ${x.ver.padEnd(17)} ${x.estructural ? "ESTRUCTURAL" : "recuperable"}`);
  }

  if (!WRITE) {
    console.log(`\n  (dry-run — pasar --write para regenerar las ${lista.length})`);
    return;
  }

  console.log(`\n═══ REGENERANDO ${lista.length} ═══`);
  const ok: string[] = [];
  const fallidos: { id: string; motivo: string }[] = [];
  let llamadas = 0;

  for (const [i, x] of lista.entries()) {
    // Prosa previa, para poder VOLVER atrás si la nueva no pasa el guard. Genero con
    // persist:true y reviero si hace falta, en vez de generar dos veces (una para
    // validar y otra para persistir): así lo que queda en la fila es exactamente lo
    // que validé. Con dos llamadas separadas persistiría una prosa distinta de la
    // aprobada, que es justo el bug que este guard existe para evitar.
    const { data: previa } = await sb.from("analisis").select("ai_analysis").eq("id", x.id).single();
    let hecho = false;
    let motivo = "";
    for (let intento = 1; intento <= MAX_INTENTOS && !hecho; intento++) {
      const { result: ai, warns } = await conWarns(() => generateAiAnalysis(x.id, sb as any, { persist: true }));
      llamadas++;
      if (!ai) {
        motivo = "la generación devolvió null";
        continue;
      }
      if (warns.some((w) => w.includes("[DISTANCIA-ESTRUCTURAL]"))) {
        motivo = `guard estructural en ${MAX_INTENTOS} intentos — queda con su prosa vieja`;
        // Revertir de inmediato: la fila nunca queda con prosa que ofrece una salida
        // que el motor ya descartó, ni siquiera entre intentos.
        await sb.from("analisis").update({ ai_analysis: previa?.ai_analysis ?? null }).eq("id", x.id);
        continue;
      }
      ok.push(x.id);
      hecho = true;
    }
    if (!hecho) fallidos.push({ id: x.id, motivo });
    console.log(`  [${i + 1}/${lista.length}] ${x.id} ${hecho ? "✓" : "✗ " + motivo}${x.estructural ? " (estructural)" : ""}`);
  }

  console.log(`\n═══ RESULTADO ═══`);
  console.log(`  regeneradas : ${ok.length}`);
  console.log(`  fallidas    : ${fallidos.length}`);
  for (const f of fallidos) console.log(`    ${f.id} — ${f.motivo}`);
  console.log(`  llamadas LLM: ~${llamadas}`);
}

main();
