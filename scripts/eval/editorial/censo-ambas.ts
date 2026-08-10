// ============================================================================
// CENSO EDITORIAL AMBAS — corrida completa sobre los pares del parque
// ============================================================================
// Espejo de censo.ts para el producto comparativo. Diferencias estructurales:
//   1. El universo no son filas: son PARES (LTR + STR del mismo depto). El
//      pareo es el mismo del discover (of-ambas-calib-discover.mjs): propKey
//      `user_id|direccion` + un LTR y un STR creados con <120 s de diferencia.
//   2. El ensamblado es a pares con base homologada (ensamblar-ambas.ts): la
//      UF real del lado LTR re-escala el STR, igual que comparativa/page.tsx.
//   3. El juez evalúa contra 13 dimensiones: las 7 generales + las 8-13
//      "SOLO AMBAS" de RUBRICA.md.
//   4. Pares SIN prosa (`comparativaAI` ausente) se censan igual (el hero, la
//      pirámide y la evidencia son motor); meta.sinProsa los marca.
// Solo mide: NO escribe en la base, NO corrige informes.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/eval/editorial/censo-ambas.ts
//     [--limit N] [--solo ltrId8,ltrId8] [--dry]
//   --dry: solo ensambla y escribe los .informe.txt (cero llamadas al juez).
// Outputs (untracked, cubiertos por scripts/eval/editorial/out*/):
//   out-censo-ambas/<id8par>.informe.txt · .v1.json · .v2.json · .merged.json
//   _censo-ambas.json (resumen por par + todas las fallas consolidadas)
//
// Guard de presupuesto: espejo de censo.ts (~USD 30 esperado; freno duro 2x).
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { ensamblarAMBAS, type FilaParAmbas, type InformeEnsambladoAmbas } from "./ensamblar-ambas";
import { buildSystemPrompt, evaluarInforme, leerRubrica, EVAL_MODEL, type EvalEditorial, type FallaEditorial } from "./juez";

const MERGE_MODEL = "claude-sonnet-5";
const BUDGET_USD = 30;
const BUDGET_HARD_STOP_USD = BUDGET_USD * 2;
const P = { opusIn: 15, opusOut: 75, sonnetIn: 3, sonnetOut: 15 };

const DIMENSIONES_AMBAS =
  "las 13 dimensiones de la rúbrica (1-7 generales + 8-13 de la sección SOLO AMBAS: este informe ES un comparativo AMBAS)";

const anthropic = new Anthropic();
const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const limit = flag("limit") ? Number(flag("limit")) : Infinity;
const solo = flag("solo")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const dry = args.includes("--dry");
const outDir = path.join(__dirname, "out-censo-ambas");

interface FallaMerged extends FallaEditorial {
  confirmada?: boolean;
}
interface ResumenPar {
  id8: string; banda: string; veredicto: string; comuna: string; pv: number | null;
  sinProsa: boolean; parRoto38800: boolean;
  altasConfirmadas: number; altasDebiles: number; medias: number; bajas: number;
  fallas: FallaMerged[];
  tokens: { opusIn: number; opusOut: number; sonnetIn: number; sonnetOut: number };
  ms: number; error?: string;
  ltrId: string; strId: string;
}

const gasto = { opusIn: 0, opusOut: 0, sonnetIn: 0, sonnetOut: 0 };
const usd = () =>
  (gasto.opusIn / 1e6) * P.opusIn + (gasto.opusOut / 1e6) * P.opusOut +
  (gasto.sonnetIn / 1e6) * P.sonnetIn + (gasto.sonnetOut / 1e6) * P.sonnetOut;

// ── Consolidación (doble voto) — espejo de censo.ts. No se importa de allá
// porque censo.ts es un script que ejecuta main() al ser importado. ──────────
const MERGE_SYSTEM = `Consolidas dos corridas independientes de un evaluador editorial sobre el MISMO informe. Recibes fallas de la corrida A y de la corrida B, cada una {dimension, severidad, pieza, cita, explicacion}.

REGLAS:
1. Dos fallas (una de A, una de B) MATCHEAN si apuntan al mismo problema de fondo: misma dimensión (o adyacente si el problema es idéntico), misma pieza o piezas solapadas, y mismo CONCEPTO según cita/explicación. El matching es semántico, no de string: "CAP rate sin glosa en respuestaDirecta" matchea "CAP rate se usa sin explicar al primer uso" aunque el texto difiera.
2. ALTA CONFIRMADA: severidad alta en ambas corridas (o alta en una y el mismo problema en la otra con cualquier severidad) → confirmada=true, severidad "alta".
3. ALTA DÉBIL: alta en UNA corrida sin match en la otra → confirmada=false, severidad "alta" (señal débil).
4. MEDIAS/BAJAS: unión deduplicada (si A y B reportan lo mismo, UNA entrada). confirmada se omite.
5. Conserva de cada falla la versión con mejor cita (más literal/completa). NO inventes fallas nuevas, NO re-juzgues el informe, NO cambies dimensiones salvo para unificar un match obvio.

SALIDA: SOLO JSON válido, sin texto alrededor:
{ "fallas": [ { "dimension": n, "severidad": "alta|media|baja", "pieza": "...", "cita": "...", "explicacion": "...", "confirmada": true|false } ] }
(confirmada solo en severidad alta).`;

async function consolidar(a: FallaEditorial[], b: FallaEditorial[]): Promise<FallaMerged[]> {
  if (a.length === 0 && b.length === 0) return [];
  const msg = await anthropic.messages.create({
    model: MERGE_MODEL,
    max_tokens: 4000,
    system: MERGE_SYSTEM,
    messages: [{ role: "user", content: `CORRIDA A:\n${JSON.stringify(a, null, 1)}\n\nCORRIDA B:\n${JSON.stringify(b, null, 1)}\n\nConsolida según las reglas. Devuelve SOLO el JSON.` }],
  });
  gasto.sonnetIn += msg.usage.input_tokens;
  gasto.sonnetOut += msg.usage.output_tokens;
  const text = msg.content.filter((bl) => bl.type === "text").map((bl) => (bl as { text: string }).text).join("");
  try {
    const parsed = JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    return Array.isArray(parsed.fallas) ? parsed.fallas : [];
  } catch {
    return [
      ...a.map((f) => ({ ...f, confirmada: f.severidad === "alta" ? false : undefined })),
      ...b.filter((f) => f.severidad === "alta").map((f) => ({ ...f, confirmada: false })),
    ];
  }
}

// ── Pareo propKey (mismo criterio que of-ambas-calib-discover.mjs) ───────────
interface Par { ltr: FilaParAmbas; str: FilaParAmbas }

const tipoDe = (r: FilaParAmbas): "ltr" | "str" => {
  if (r.tipo_analisis === "short-term") return "str";
  if (r.tipo_analisis != null) return "ltr";
  return (r.results as { tipoAnalisis?: string } | null)?.tipoAnalisis === "short-term" ? "str" : "ltr";
};

function parearAmbas(rows: FilaParAmbas[]): Par[] {
  const byKey = new Map<string, FilaParAmbas[]>();
  for (const a of rows) {
    if (!a.user_id || !a.direccion) continue;
    const key = `${a.user_id}|${a.direccion}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }
  const pares: Par[] = [];
  for (const items of byKey.values()) {
    if (items.length < 2) continue;
    const ltrs = items.filter((i) => tipoDe(i) === "ltr");
    const strs = items.filter((i) => tipoDe(i) === "str");
    if (!ltrs.length || !strs.length) continue;
    const usados = new Set<string>();
    for (const ltr of ltrs) {
      let best: FilaParAmbas | null = null;
      let bestDt = Infinity;
      for (const str of strs) {
        if (usados.has(str.id)) continue;
        const dt = Math.abs(new Date(ltr.created_at ?? 0).getTime() - new Date(str.created_at ?? 0).getTime()) / 1000;
        if (dt < 120 && dt < bestDt) { best = str; bestDt = dt; }
      }
      if (best) { usados.add(best.id); pares.push({ ltr, str: best }); }
    }
  }
  // Orden estable por fecha de creación del lado LTR (reproducible entre corridas).
  return pares.sort((a, b) => (a.ltr.created_at ?? "").localeCompare(b.ltr.created_at ?? ""));
}

// ── Un par ──────────────────────────────────────────────────────────────────
async function procesar(par: Par, sb: SupabaseClient, systemPrompt: string): Promise<ResumenPar> {
  const t0 = Date.now();
  const id8 = `${par.ltr.id.slice(0, 8)}+${par.str.id.slice(0, 8)}`;
  const base = { id8, banda: "?", veredicto: "?", comuna: par.ltr.comuna ?? "?", pv: null as number | null, sinProsa: false, parRoto38800: false, ltrId: par.ltr.id, strId: par.str.id };
  const vacio = { altasConfirmadas: 0, altasDebiles: 0, medias: 0, bajas: 0, fallas: [] as FallaMerged[], tokens: { opusIn: 0, opusOut: 0, sonnetIn: 0, sonnetOut: 0 }, ms: 0 };

  let informe: InformeEnsambladoAmbas;
  try {
    informe = await ensamblarAMBAS(par.ltr, par.str, sb);
  } catch (e) {
    return { ...base, ...vacio, ms: Date.now() - t0, error: `ensamblado: ${(e as Error)?.message ?? e}` };
  }
  const metaPlano = {
    ...base,
    banda: informe.meta.banda,
    veredicto: informe.meta.veredicto,
    comuna: informe.meta.comuna,
    pv: informe.meta.promptVersion,
    sinProsa: informe.meta.sinProsa,
    parRoto38800: informe.meta.parRoto38800,
  };
  writeFileSync(path.join(outDir, `${id8}.informe.txt`), informe.texto, "utf-8");
  if (dry) return { ...metaPlano, ...vacio, ms: Date.now() - t0 };

  // Meta para el juez: solo lo que necesita para leer (sin parRoto38800 — no
  // debe sesgar: es una columna informativa del reporte, no del instrumento).
  const metaJuez = {
    id8,
    tipo: "AMBAS",
    veredicto: `${informe.meta.veredicto} (banda ${informe.meta.banda}${informe.meta.sinProsa ? " · SIN prosa IA: informe motor-templated" : ""})`,
    comuna: informe.meta.comuna,
    promptVersion: informe.meta.promptVersion,
  };

  const tokAntes = { ...gasto };
  let v1: EvalEditorial, v2: EvalEditorial;
  try {
    [v1, v2] = await Promise.all([
      evaluarInforme({ systemPrompt, meta: metaJuez, informeTexto: informe.texto, dimensiones: DIMENSIONES_AMBAS }),
      evaluarInforme({ systemPrompt, meta: metaJuez, informeTexto: informe.texto, dimensiones: DIMENSIONES_AMBAS }),
    ]);
  } catch (e) {
    return { ...metaPlano, ...vacio, ms: Date.now() - t0, error: `juez: ${(e as Error)?.message ?? e}` };
  }
  gasto.opusIn += (v1._usage?.input_tokens ?? 0) + (v2._usage?.input_tokens ?? 0);
  gasto.opusOut += (v1._usage?.output_tokens ?? 0) + (v2._usage?.output_tokens ?? 0);
  writeFileSync(path.join(outDir, `${id8}.v1.json`), JSON.stringify(v1, null, 2), "utf-8");
  writeFileSync(path.join(outDir, `${id8}.v2.json`), JSON.stringify(v2, null, 2), "utf-8");

  let fallas: FallaMerged[];
  try {
    fallas = await consolidar(v1.fallas, v2.fallas);
  } catch (e) {
    return { ...metaPlano, ...vacio, ms: Date.now() - t0, error: `merge: ${(e as Error)?.message ?? e}` };
  }

  const resumen: ResumenPar = {
    ...metaPlano,
    altasConfirmadas: fallas.filter((f) => f.severidad === "alta" && f.confirmada === true).length,
    altasDebiles: fallas.filter((f) => f.severidad === "alta" && f.confirmada !== true).length,
    medias: fallas.filter((f) => f.severidad === "media").length,
    bajas: fallas.filter((f) => f.severidad === "baja").length,
    fallas,
    tokens: {
      opusIn: gasto.opusIn - tokAntes.opusIn, opusOut: gasto.opusOut - tokAntes.opusOut,
      sonnetIn: gasto.sonnetIn - tokAntes.sonnetIn, sonnetOut: gasto.sonnetOut - tokAntes.sonnetOut,
    },
    ms: Date.now() - t0,
  };
  writeFileSync(path.join(outDir, `${id8}.merged.json`), JSON.stringify(resumen, null, 2), "utf-8");
  return resumen;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function fetchAllAnalisis(sb: SupabaseClient): Promise<FilaParAmbas[]> {
  const out: FilaParAmbas[] = [];
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("analisis")
      .select("id, user_id, comuna, direccion, created_at, tipo_analisis, input_data, results, score")
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as FilaParAmbas[]));
    if (!data || data.length < page) break;
  }
  return out;
}

async function main() {
  const sb: SupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  mkdirSync(outDir, { recursive: true });
  const systemPrompt = buildSystemPrompt(leerRubrica());

  const rows = await fetchAllAnalisis(sb);
  let pares = parearAmbas(rows);
  if (solo) pares = pares.filter((p) => solo.some((pref) => p.ltr.id.startsWith(pref)));
  pares = pares.slice(0, limit);
  console.log(
    `Censo AMBAS: ${pares.length} pares · ${dry ? "DRY (solo ensamblado)" : `juez ${EVAL_MODEL} ×2 + merge ${MERGE_MODEL} · presupuesto USD ${BUDGET_USD} (freno duro ${BUDGET_HARD_STOP_USD})`}`,
  );

  const resumenes: ResumenPar[] = [];
  const t0 = Date.now();
  const CONCURRENCIA = dry ? 1 : 3;
  let idx = 0;
  let frenado = false;

  async function worker() {
    while (idx < pares.length) {
      if (!dry && usd() > BUDGET_HARD_STOP_USD) { frenado = true; return; }
      const par = pares[idx++];
      const r = await procesar(par, sb, systemPrompt);
      resumenes.push(r);
      const marca = r.error
        ? `✗ ${r.error.slice(0, 60)}`
        : dry
          ? "ensamblado"
          : `A✓${r.altasConfirmadas} A?${r.altasDebiles} M${r.medias} B${r.bajas}`;
      const tags = [r.sinProsa ? "SIN_PROSA" : null, r.parRoto38800 ? "ROTO_38800" : null].filter(Boolean).join(" ");
      console.log(`[${resumenes.length}/${pares.length}] ${r.id8} ${r.banda.padEnd(17)} ${r.comuna.padEnd(16)} ${tags.padEnd(20)} · ${marca}${dry ? "" : ` · USD ${usd().toFixed(2)}`}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));

  const totalMin = (Date.now() - t0) / 60000;
  writeFileSync(path.join(outDir, "_censo-ambas.json"), JSON.stringify({
    corrida: { pares: resumenes.length, dry, frenado, usd: usd(), minutos: totalMin, gasto },
    resumenes,
  }, null, 2), "utf-8");

  console.log(`\n${frenado ? "⚠ FRENADO POR PRESUPUESTO (>2x estimado) — reportar antes de seguir" : dry ? "Ensamblado completo (dry)" : "Censo AMBAS completo"}`);
  console.log(`Pares: ${resumenes.length} · errores: ${resumenes.filter((r) => r.error).length}`);
  if (!dry) console.log(`Costo real: USD ${usd().toFixed(2)} (opus ${gasto.opusIn}/${gasto.opusOut} tok · sonnet ${gasto.sonnetIn}/${gasto.sonnetOut} tok) · ${totalMin.toFixed(1)} min`);
}

main().catch((e) => { console.error(e); process.exit(1); });
