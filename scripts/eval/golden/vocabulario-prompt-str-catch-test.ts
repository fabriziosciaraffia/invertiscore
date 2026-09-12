/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL VOCABULARIO DEL PROMPT STR — catch-test (12-sep-2026 · v19). 0 tokens.
// ============================================================================
// El modelo escribe como lee. Medido sobre las 169 prosas STR persistidas antes de v19:
// «brecha» en 68, «palanca» en 63, «estructural» en 48, «vía» en 29 — y ninguna de esas
// palabras es del lector: salen del texto con que se le pide la prosa (20 «palanca», 9
// «vía», 3 «brecha», 4 «estructural» en el system y el user de v18). Este tier fija que el
// TEXTO DIRIGIDO AL MODELO no las use. Los identificadores de código (`dv.palancas`,
// `NOMBRE_VIA[v.palanca]`, la regla "estructural" del switch) no son texto del modelo y
// no se miran acá.
//
// QUÉ MIRA:
//   1. `SYSTEM_PROMPT_STR` sin palanca / vía / brecha / estructural. «motor» solo dentro
//      de la regla A11, que cita la palabra prohibida para prohibirla: a lo sumo 5.
//   2. Los user prompts armados sobre cuatro fixtures reales —con simulación, como los
//      arma la página— sin ninguna de las cinco. Cubren AJUSTA podada, BUSCAR con mix al
//      escalón, COMPRAR y AJUSTA estructural con mix a COMPRAR: pasan por el bloque de
//      vías, por el de salida combinada y por los avisos del precio.
//   3. Las instrucciones de los reintentos quirúrgicos (el tramo de `reintentoQuirurgico`
//      en ai-generation-str.ts) tampoco: van al modelo igual que el prompt.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/vocabulario-prompt-str-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_PROMPT_STR, buildUserPromptSTR } from "../../../src/lib/ai-generation-str";
import { simularStrDesdePersistido } from "../../../src/lib/analysis/simular-str";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

const PROHIBIDAS: [string, RegExp][] = [
  ["palanca", /\bpalancas?\b/gi],
  ["vía", /\bv[íi]as?\b/gi],
  ["brecha", /\bbrechas?\b/gi],
  ["estructural", /\bestructural(?:es|mente)?\b/gi],
];
const MOTOR = /\bmotor\b/gi;

function contar(texto: string, etiqueta: string, topeMotor: number): void {
  for (const [nombre, re] of PROHIBIDAS) {
    const hits = [...texto.matchAll(re)];
    if (hits.length) {
      const ctx = hits.slice(0, 3).map((m) => `«…${texto.slice(Math.max(0, m.index! - 40), m.index! + 40).replace(/\n/g, " ")}…»`).join(" · ");
      F(`${etiqueta} · «${nombre}» aparece ${hits.length} vez/veces en texto dirigido al modelo: ${ctx}`);
    }
  }
  const motor = [...texto.matchAll(MOTOR)].length;
  if (motor > topeMotor) F(`${etiqueta} · «motor» aparece ${motor} veces (tope ${topeMotor}: solo la regla A11 puede citarlo)`);
}

// ── 1 · el system ───────────────────────────────────────────────────────────
contar(SYSTEM_PROMPT_STR, "system", 5);

// ── 2 · los user prompts de cuatro fixtures reales, con simulación ─────────
{
  const fixtures = JSON.parse(leer("src/app/dev/drawers-pixel/fixtures.json")) as Record<string, any>;
  for (const clave of ["staRosaStr", "grajalesStr", "lasCondesStr", "estructuralMixStr"]) {
    const fx = fixtures[clave];
    if (!fx) { F(`2 · falta el fixture ${clave}`); continue; }
    const d = fx.input_data as Record<string, unknown>;
    const uf = Number(d.precioCompra) / Number(d.precioCompraUF);
    const sim = simularStrDesdePersistido(d, fx.results, uf, new Date(fx.created_at));
    const { userPrompt } = buildUserPromptSTR(d as never, fx.results, fx.comuna, sim);
    // LAS FRASES DEL MOTOR (titular, fraseCanonica, frase de cada hallazgo) entran al user
    // prompt tal cual y son COPY DE LA CARD, no texto de este archivo: se enmascaran acá y
    // quedan en cola (distancia-veredicto-str-hallazgo.ts:572-597 dice «brecha» y «vía»).
    const motor: string[] = [];
    const juntar = (n: unknown) => { if (typeof n === "string") { if (n.length >= 12) motor.push(n); } else if (Array.isArray(n)) n.forEach(juntar); else if (n && typeof n === "object") Object.values(n as Record<string, unknown>).forEach(juntar); };
    juntar(fx.results?.hallazgos);
    // El prompt las inyecta sin las marcas «**» del render: se comparan sin marcas.
    const sinMarcas = (t: string) => t.replace(/\*\*/g, "");
    let texto = sinMarcas(userPrompt);
    // Las más largas primero: una frase corta contenida en la fraseCanonica la partiría antes.
    for (const m of [...motor].sort((a, b) => b.length - a.length)) texto = texto.split(sinMarcas(m)).join(" ");
    contar(texto, `user ${clave}`, 0);
  }
}

// ── 3 · las instrucciones de los reintentos ────────────────────────────────
{
  const src = leer("src/lib/ai-generation-str.ts");
  const a = src.indexOf("const reintentoQuirurgico = async (");
  const b = src.indexOf("// Garantía de veredicto", a);
  if (a === -1 || b === -1) F("3 · no se encontró el tramo de reintentos quirúrgicos en ai-generation-str.ts");
  else {
    // Solo las cadenas (comillas y backticks) de ese tramo: son lo que el modelo lee.
    // Fuera: el nombre de la regla ("estructural", clave del switch) y las etiquetas de log
    // ("[STR-ESTRUCTURAL]"): van al log y al residuo, no al modelo.
    const cadenas = (src.slice(a, b).match(/`[^`]*`|"(?:[^"\\]|\\.)*"/g) ?? []).filter((c) => !/^"(?:estructural|niega-mix)"$/.test(c) && !/^"\[STR-[A-Z-]+\]"$/.test(c));
    contar(cadenas.join("\n"), "reintentos quirúrgicos", 0);
  }
}

/** Tier para el runner: cada palabra nuestra en texto del modelo es una falla dura. */
export function runVocabularioPromptStrTier(): { hard: number } {
  console.log("\n─── TIER VOCABULARIO-PROMPT-STR (v19 · el modelo escribe como lee · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — ni palanca, ni vía, ni brecha, ni estructural en el system, en cuatro user prompts reales ni en los reintentos; «motor» solo donde A11 lo prohíbe");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runVocabularioPromptStrTier();
  process.exit(hard ? 1 : 0);
}
