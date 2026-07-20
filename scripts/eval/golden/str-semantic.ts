// ============================================================================
// GOLDEN SET STR — tier SEMÁNTICO · coherencia MODO-GESTIÓN (F6 · audit b)
// ============================================================================
// Aserción DETERMINÍSTICA (regex, no juez LLM) del residuo de E.4: el chip Auto/Admin
// del hero STR viaja al prompt (ai-generation-str.ts:395,536) pero el bloque auto-vs-admin
// se inyecta incondicional (:572-576) → la coherencia es EMERGENTE, no enforced. Este tier
// la convierte en invariante testeada: para modoGestion=administrador la prosa NO afirma
// horas propias de gestión como hecho (solo hipotético condicional "si operas/pasaras a
// auto-gestión…"); para auto NO presenta la operación como "100% pasiva".
//
// Sintetiza AMBOS modos desde UN fixture frozen (GE-1, COMPRAR limpio) overrideando
// modoGestion — mismo patrón `sintesis` de str-seeds. Genera prosa FRESCA con generateStrProse
// (no persiste). NO toca prompt ni motor → cero REGLA ESPEJO; es test puro que LEE prosa.
//
// NO-BLOQUEANTE: reporta flags para Fabrizio, no aporta a totalHard (espejo ambas-semantic).
// Cuesta tokens de generación (2 modos × 1 seed = 2 llamadas LLM).
//   node --env-file=.env.local --import tsx scripts/eval/golden/str-semantic.ts
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from "@anthropic-ai/sdk";
import { generateStrProse } from "../../../src/lib/ai-generation-str";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";

type Modo = "auto" | "administrador";

interface StrModeCase {
  key: string;
  seedKey: string;
  mode: Modo;
  comision: number; // fracción; el motor la usa solo en modo administrador (short-term-engine.ts:966)
}

// Cobertura mínima: el mismo caso base en ambos modos (aísla el efecto del chip).
export const STR_MODE_CASES: StrModeCase[] = [
  { key: "SMS-auto", seedKey: "GE-1", mode: "auto", comision: 0.03 },
  { key: "SMS-admin", seedKey: "GE-1", mode: "administrador", comision: 0.20 },
];

export interface StrSemanticReport {
  key: string;
  mode: Modo;
  flags: Array<{ categoria: string; severidad: string; detalle: string }>;
  error?: string;
}

// ── Marcadores léxicos de la aserción ────────────────────────────────────────
// Condicional/hipotético: enmarca el modo NO elegido como escenario, no como hecho.
const CONDITIONAL = /\b(si\b|pasar[aá]s|oper[aá]s|eligieras|cambiaras|en vez de|en lugar de|auto-?gesti|autogesti|hipot)/i;
const HOURS = /\bhoras?\b/i;
// Verbo/posesivo que atribuye el esfuerzo de gestión AL USUARIO (no "el administrador…").
const SELF_EFFORT = /(dedic|pon[eé]s\b|pones\b|pondr|necesit|invert|destin|tu tiempo|tus?\b[^.]{0,20}\bhoras)/i;
const PASSIVE = /(100\s*%?\s*pasiv|inversi[oó]n\s+pasiva|totalmente\s+pasiv|renta\s+pasiva)/i;
const ADMIN_ANCHOR = /(administrador|operador|gesti[oó]n\s+profesional)/i;

function collectProse(ai: unknown): string[] {
  const out: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === "string") out.push(o);
    else if (o && typeof o === "object") Object.values(o as Record<string, unknown>).forEach(walk);
  };
  walk(ai);
  return out;
}

function toSentences(texts: string[]): string[] {
  return texts
    .flatMap((t) => t.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

// Aserción determinística de coherencia de modo-gestión sobre la prosa generada.
export function assertModeCoherent(ai: unknown, mode: Modo): StrSemanticReport["flags"] {
  const flags: StrSemanticReport["flags"] = [];
  const prose = collectProse(ai);
  const sents = toSentences(prose);
  const joined = prose.join(" ");

  if (mode === "administrador") {
    // FALLA: frase que atribuye horas de gestión AL USUARIO como hecho (no condicional).
    const bad = sents.filter((s) => HOURS.test(s) && SELF_EFFORT.test(s) && !CONDITIONAL.test(s));
    for (const s of bad) {
      flags.push({ categoria: "modo-gestion", severidad: "alta", detalle: `admin recibe horas propias como HECHO (no hipotético): "${s}"` });
    }
    // Coherencia positiva: el modo elegido debe estar anclado en alguna parte.
    if (!ADMIN_ANCHOR.test(joined)) {
      flags.push({ categoria: "modo-gestion", severidad: "media", detalle: "admin: la prosa no ancla el modo elegido (sin 'administrador'/'operador'/'gestión profesional')" });
    }
  } else {
    // FALLA: presenta la operación como pasiva/administrada siendo que el usuario auto-gestiona.
    const bad = sents.filter((s) => PASSIVE.test(s) && !CONDITIONAL.test(s) && !/administrador/i.test(s));
    for (const s of bad) {
      flags.push({ categoria: "modo-gestion", severidad: "alta", detalle: `auto recibe "pasiva/administrada" como su modo (no hipotético): "${s}"` });
    }
  }
  return flags;
}

export async function runStrSemanticTier(): Promise<StrSemanticReport[]> {
  const anthropic = new Anthropic();
  const frozen = loadFrozen();
  const reports: StrSemanticReport[] = [];

  for (const c of STR_MODE_CASES) {
    const seed = STR_GE_SEEDS.find((s) => s.key === c.seedKey);
    const baseFx = frozen[c.seedKey];
    if (!seed || !baseFx) {
      reports.push({ key: c.key, mode: c.mode, flags: [], error: `sin fixture frozen para ${c.seedKey}` });
      continue;
    }
    // Override del modo sobre el frozen (mismo patrón `sintesis`). El motor recomputa la
    // comisión por modo (short-term-engine.ts:966); la prosa se genera del recompute.
    const fxMode = {
      ...baseFx,
      input_data: { ...baseFx.input_data, modoGestion: c.mode, comisionAdministrador: c.comision, adminPro: c.mode === "administrador" },
    };
    try {
      const r = recomputeStrSeed(seed, { [c.seedKey]: fxMode });
      if (!r) throw new Error("recompute devolvió null");
      const rForProse = { ...r.rec, francoScore: r.score, hallazgos: r.hz };
      const gen = await generateStrProse({
        anthropic,
        inp: fxMode.input_data,
        r: rForProse as any,
        comuna: (fxMode.input_data.comuna as string) || "",
      });
      reports.push({ key: c.key, mode: c.mode, flags: assertModeCoherent(gen.ai, c.mode) });
    } catch (e: any) {
      reports.push({ key: c.key, mode: c.mode, flags: [], error: e?.message ?? String(e) });
    }
  }
  return reports;
}

// Ejecución directa (standalone). El runner lo importa vía runStrSemanticTier().
if (process.argv[1] && /str-semantic\.ts$/.test(process.argv[1])) {
  runStrSemanticTier().then((reports) => {
    console.log("\n─── TIER STR · coherencia modo-gestión (determinístico) ───");
    let totalFlags = 0;
    for (const s of reports) {
      const head = s.error ? `⚠ ERROR (${s.error})` : `${s.flags.length === 0 ? "✓" : "⚑"} ${s.flags.length} flags`;
      console.log(`\n  ${s.key}  modo=${s.mode} — ${head}`);
      for (const fl of s.flags) console.log(`      ⚑ [${fl.severidad}/${fl.categoria}] ${fl.detalle}`);
      totalFlags += s.flags.length;
    }
    console.log(`\n  total flags: ${totalFlags} (reporte, NO bloquea; test puro, prompts intactos)`);
    process.exit(0);
  }).catch((e) => { console.error("FATAL", e); process.exit(1); });
}
