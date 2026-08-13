// ============================================================================
// CENSO EDITORIAL LTR/STR — corrida completa con doble voto en ALTAs
// ============================================================================
// Corre el instrumento sobre los informes LTR y STR con prosa IA VIGENTE
// (promptVersion === PROMPT_VERSION_LTR / PROMPT_VERSION_STR; prosa de
// versiones anteriores queda fuera: el censo mide lo que el usuario ve hoy).
// AMBAS/comparativa tiene su propio censo (censo-ambas.ts). Por informe:
//   1. Ensambla la pieza de lectura (ensamblar.ts) UNA vez.
//   2. DOS corridas independientes del juez (juez.ts) — el muestreo del modelo
//      es la fuente de independencia.
//   3. CONSOLIDACIÓN con un modelo liviano: una falla ALTA solo se CONFIRMA si
//      ambas corridas la reportan (matching semántico por dimensión + pieza +
//      concepto, no string exacto). Las ALTAs de una sola corrida bajan a
//      "señal débil". MEDIAs/BAJAs: unión deduplicada (basta una corrida).
// Dimensiones: 1-7 generales + 9-13 extendidas (re-scoping 2026-08-13).
// D8 queda fuera: es exclusiva del comparativo AMBAS.
// Solo mide: NO escribe en la base, NO corrige informes.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/eval/editorial/censo.ts
//     [--limit N] [--solo id1,id2] [--tipo ltr|str] [--dry] [--presupuesto USD]
//   --dry: solo arma la cohorte y ensambla (escribe .informe.txt; cero llamadas
//          al juez). Sirve para validar el ensamblador y dimensionar la corrida.
//   --presupuesto: presupuesto esperado en USD para esta corrida (default 30).
//          El freno duro sigue siendo 2x el presupuesto.
// Outputs (untracked): scripts/eval/editorial/out-censo/
//   <id8>.informe.txt · <id8>.v1.json · <id8>.v2.json · <id8>.merged.json
//   _censo.json (resumen por informe + todas las fallas consolidadas, para el análisis)
//
// Guard de presupuesto: si el gasto supera 2x el presupuesto, el script FRENA
// y reporta (mandato del goal).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { ensamblarInforme, type FilaAnalisis } from "./ensamblar";
import { buildSystemPrompt, evaluarInforme, leerRubrica, EVAL_MODEL, type EvalEditorial, type FallaEditorial } from "./juez";
import { PROMPT_VERSION_LTR } from "../../../src/lib/ai-generation";
import { PROMPT_VERSION_STR } from "../../../src/lib/ai-generation-str";

const MERGE_MODEL = "claude-sonnet-5";
// Precios por MTok
const P = { opusIn: 15, opusOut: 75, sonnetIn: 3, sonnetOut: 15 };

// Alcance de dimensiones para informes simples (LTR/STR): las generales más las
// extendidas re-scopeadas. D8 se excluye explícitamente — el juez no debe
// buscar mini-scores ni marco comparativo en un informe que no los tiene.
const DIMENSIONES_LTR_STR =
  "las dimensiones 1-7 (generales) y 9-13 (extendidas a LTR/STR/AMBAS) de la rúbrica. La dimensión 8 NO aplica: es exclusiva del comparativo AMBAS y este informe es simple (LTR o STR)";

const anthropic = new Anthropic();
const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const limit = flag("limit") ? Number(flag("limit")) : Infinity;
const solo = flag("solo")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const soloTipo = flag("tipo"); // "ltr" | "str" | null (ambas modalidades)
const dry = args.includes("--dry");
const BUDGET_USD = flag("presupuesto") ? Number(flag("presupuesto")) : 30;
const BUDGET_HARD_STOP_USD = BUDGET_USD * 2;
const outDir = path.join(__dirname, "out-censo");

interface FallaMerged extends FallaEditorial {
  confirmada?: boolean; // ALTAs: true si ambas corridas la vieron
}
interface ResumenInforme {
  id8: string; tipo: string; veredicto: string; pv: number | null; comuna: string;
  altasConfirmadas: number; altasDebiles: number; medias: number; bajas: number;
  fallas: FallaMerged[];
  tokens: { opusIn: number; opusOut: number; sonnetIn: number; sonnetOut: number };
  ms: number; error?: string;
}

const gasto = { opusIn: 0, opusOut: 0, sonnetIn: 0, sonnetOut: 0 };
const usd = () =>
  (gasto.opusIn / 1e6) * P.opusIn + (gasto.opusOut / 1e6) * P.opusOut +
  (gasto.sonnetIn / 1e6) * P.sonnetIn + (gasto.sonnetOut / 1e6) * P.sonnetOut;

// ── Consolidación (doble voto) ──────────────────────────────────────────────
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
    // Fallback determinístico: todo lo de A + ALTAs de B como débiles (sin dedupe).
    return [
      ...a.map((f) => ({ ...f, confirmada: f.severidad === "alta" ? false : undefined })),
      ...b.filter((f) => f.severidad === "alta").map((f) => ({ ...f, confirmada: false })),
    ];
  }
}

// ── Un informe ──────────────────────────────────────────────────────────────
async function procesar(fila: FilaAnalisis, systemPrompt: string): Promise<ResumenInforme> {
  const t0 = Date.now();
  const base: Omit<ResumenInforme, "fallas" | "altasConfirmadas" | "altasDebiles" | "medias" | "bajas" | "tokens" | "ms"> = {
    id8: fila.id.slice(0, 8), tipo: "?", veredicto: "?", pv: null, comuna: fila.comuna ?? "?",
  };
  const vacio = { altasConfirmadas: 0, altasDebiles: 0, medias: 0, bajas: 0, fallas: [], tokens: { opusIn: 0, opusOut: 0, sonnetIn: 0, sonnetOut: 0 }, ms: 0 };

  let informe;
  try {
    informe = ensamblarInforme(fila);
  } catch (e) {
    return { ...base, ...vacio, error: `ensamblado: ${(e as Error)?.message ?? e}` };
  }
  writeFileSync(path.join(outDir, `${informe.meta.id8}.informe.txt`), informe.texto, "utf-8");

  if (dry) {
    // Solo ensamblado: valida el instrumento y dimensiona la cohorte sin gastar.
    return {
      ...base, id8: informe.meta.id8, tipo: informe.meta.tipo, veredicto: informe.meta.veredicto,
      pv: informe.meta.promptVersion, comuna: informe.meta.comuna, ...vacio, ms: Date.now() - t0,
    };
  }

  const tokAntes = { ...gasto };
  let v1: EvalEditorial, v2: EvalEditorial;
  try {
    [v1, v2] = await Promise.all([
      evaluarInforme({ systemPrompt, meta: informe.meta, informeTexto: informe.texto, dimensiones: DIMENSIONES_LTR_STR }),
      evaluarInforme({ systemPrompt, meta: informe.meta, informeTexto: informe.texto, dimensiones: DIMENSIONES_LTR_STR }),
    ]);
  } catch (e) {
    return { ...base, ...informe.meta, ...vacio, error: `juez: ${(e as Error)?.message ?? e}` };
  }
  gasto.opusIn += (v1._usage?.input_tokens ?? 0) + (v2._usage?.input_tokens ?? 0);
  gasto.opusOut += (v1._usage?.output_tokens ?? 0) + (v2._usage?.output_tokens ?? 0);
  writeFileSync(path.join(outDir, `${informe.meta.id8}.v1.json`), JSON.stringify(v1, null, 2), "utf-8");
  writeFileSync(path.join(outDir, `${informe.meta.id8}.v2.json`), JSON.stringify(v2, null, 2), "utf-8");

  let fallas: FallaMerged[];
  try {
    fallas = await consolidar(v1.fallas, v2.fallas);
  } catch (e) {
    return { ...base, ...informe.meta, ...vacio, error: `merge: ${(e as Error)?.message ?? e}` };
  }

  const resumen: ResumenInforme = {
    id8: informe.meta.id8, tipo: informe.meta.tipo, veredicto: informe.meta.veredicto,
    pv: informe.meta.promptVersion, comuna: informe.meta.comuna,
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
  writeFileSync(path.join(outDir, `${informe.meta.id8}.merged.json`), JSON.stringify(resumen, null, 2), "utf-8");
  return resumen;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  mkdirSync(outDir, { recursive: true });
  const systemPrompt = buildSystemPrompt(leerRubrica());

  const { data, error } = await sb
    .from("analisis")
    .select("id, comuna, created_at, tipo_analisis, input_data, results, ai_analysis, mediana_comuna_snapshot, zone_insight, guest_insight")
    .limit(2000);
  if (error) { console.error(error.message); process.exit(1); }

  // ── Cohorte: prosa IA con la PROMPT_VERSION vigente de su modalidad ──────
  // El censo mide lo que el usuario ve HOY. Prosa de versiones anteriores queda
  // fuera (misma regla que la invalidación lazy-on-open del producto).
  const tipoDe = (r: FilaAnalisis): "ltr" | "str" => {
    const t = r.tipo_analisis ?? (r.results as { tipoAnalisis?: string } | null)?.tipoAnalisis ?? "long-term";
    return t === "short-term" ? "str" : "ltr";
  };
  const pvDe = (r: FilaAnalisis): number | null => {
    const pv = (r.ai_analysis as { promptVersion?: unknown } | null)?.promptVersion;
    return typeof pv === "number" ? pv : null;
  };
  const pvVigente = { ltr: PROMPT_VERSION_LTR, str: PROMPT_VERSION_STR } as const;

  const conProsa = (data as FilaAnalisis[]).filter((r) => r.ai_analysis);
  const excluidasPv: Record<string, number> = {};
  let filas = conProsa.filter((r) => {
    const tipo = tipoDe(r);
    const pv = pvDe(r);
    if (pv === pvVigente[tipo]) return true;
    const k = `${tipo} pv=${pv ?? "null"}`;
    excluidasPv[k] = (excluidasPv[k] ?? 0) + 1;
    return false;
  });
  if (soloTipo) filas = filas.filter((r) => tipoDe(r) === soloTipo);
  if (solo) filas = filas.filter((r) => solo.some((p) => r.id.startsWith(p)));
  filas = filas.slice(0, limit);

  const nLtr = filas.filter((r) => tipoDe(r) === "ltr").length;
  console.log(`Cohorte: ${filas.length} informes (LTR ${nLtr} · STR ${filas.length - nLtr}) de ${conProsa.length} con prosa IA`);
  console.log(`Excluidos por promptVersion no vigente (LTR=${PROMPT_VERSION_LTR}, STR=${PROMPT_VERSION_STR}): ${JSON.stringify(excluidasPv)}`);
  console.log(dry
    ? "Modo --dry: solo ensamblado, cero llamadas al juez."
    : `Juez ${EVAL_MODEL} ×2 + merge ${MERGE_MODEL} · dimensiones 1-7 + 9-13 (D8 excluida) · presupuesto USD ${BUDGET_USD} (freno duro ${BUDGET_HARD_STOP_USD})`);

  const resumenes: ResumenInforme[] = [];
  const t0 = Date.now();
  const CONCURRENCIA = 3;
  let idx = 0;
  let frenado = false;

  async function worker() {
    while (idx < filas.length) {
      if (usd() > BUDGET_HARD_STOP_USD) { frenado = true; return; }
      const fila = filas[idx++];
      const r = await procesar(fila, systemPrompt);
      resumenes.push(r);
      const marca = r.error ? `✗ ${r.error.slice(0, 60)}` : `A✓${r.altasConfirmadas} A?${r.altasDebiles} M${r.medias} B${r.bajas}`;
      console.log(`[${resumenes.length}/${filas.length}] ${r.id8} ${r.tipo} ${r.veredicto.padEnd(16)} pv=${r.pv ?? "-"} · ${marca} · USD ${usd().toFixed(2)}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));

  const totalMin = (Date.now() - t0) / 60000;
  writeFileSync(path.join(outDir, "_censo.json"), JSON.stringify({
    corrida: {
      informes: resumenes.length, frenado, usd: usd(), minutos: totalMin, gasto, dry,
      cohorte: { pvVigente, excluidasPv, conProsa: conProsa.length },
    },
    resumenes,
  }, null, 2), "utf-8");

  console.log(`\n${frenado ? "⚠ FRENADO POR PRESUPUESTO (>2x estimado) — reportar antes de seguir" : "Censo completo"}`);
  console.log(`Informes: ${resumenes.length} · errores: ${resumenes.filter((r) => r.error).length}`);
  console.log(`Costo real: USD ${usd().toFixed(2)} (opus ${gasto.opusIn}/${gasto.opusOut} tok · sonnet ${gasto.sonnetIn}/${gasto.sonnetOut} tok) · ${totalMin.toFixed(1)} min`);
}

main().catch((e) => { console.error(e); process.exit(1); });
