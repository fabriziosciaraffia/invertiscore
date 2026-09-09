// ============================================================================
// GOLDEN · el caveat del período de plusvalía — catch-test (09-sep-2026). 0 tokens.
// ============================================================================
// F3 de las cinco familias que la apertura decía y el motor no dibujaba. La prosa lo
// escribía en 9 de 30 generaciones medidas —«cruza el estallido y la pandemia, así que
// es ruidoso»— y en las otras 21 el lector no se enteraba de que el promedio que está
// leyendo mezcla una década rara.
//
// Fija TRES cosas:
//
//   1. LOS TRES PERÍODOS REALES. `procedenciaPlusvalia` devuelve hoy 2015-2025,
//      2014-2024 y 2015-2024, y los tres cruzan tramos. Si mañana entra una comuna con
//      otro rango, este test dice qué le toca.
//
//   2. SOLAPAMIENTO, NO CONTENCIÓN. 2015-2025 cruza el boom 2014-2018 aunque empiece
//      después: comparte 2015-2018. Un filtro de contención lo habría dejado fuera y la
//      glosa habría perdido un tramo sin que nadie lo notara.
//
//   3. QUE NO ADVIERTA EN VACÍO. Sin tramos —o con un rango que no parsea— la glosa es
//      `null`, no una frase que diga «es ruidoso» sin decir por qué. Una advertencia sin
//      su motivo es peor que ninguna: no se puede ni verificar ni descartar.
//
// Corre dentro del QUICK del runner (tier "plusvalía") y standalone:
//   node --import tsx scripts/eval/golden/plusvalia-glosa-catch-test.ts
// ============================================================================
import { glosaPeriodoPlusvalia, procedenciaPlusvalia, tramosDelPeriodo } from "../../../src/lib/plusvalia-procedencia";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

// ── 1 · los tramos por período ──────────────────────────────────────────────
const casos: [string, string[], string][] = [
  ["2015-2025", ["el boom de densificación (2014-18)", "el estallido (2019)", "la pandemia (2020-21)"], "período GfK: cruza los tres"],
  ["2014-2024", ["el boom de densificación (2014-18)", "el estallido (2019)", "la pandemia (2020-21)"], "Gran Santiago: cruza los tres"],
  ["2015-2024", ["el boom de densificación (2014-18)", "el estallido (2019)", "la pandemia (2020-21)"], "Maipú/Quilicura: cruza los tres"],
  ["2014-2018", ["el boom de densificación (2014-18)"], "solo el boom, sin estallido ni pandemia"],
  ["2022-2025", [], "posterior a todo: sin tramos"],
  ["2019-2019", ["el estallido (2019)"], "un año que ES el tramo"],
];
for (const [rango, esperado, nombre] of casos) {
  const got = tramosDelPeriodo(rango);
  if (JSON.stringify(got) !== JSON.stringify(esperado)) {
    F(`1 · ${nombre} (${rango}): dio [${got.join(" | ")}], se esperaba [${esperado.join(" | ")}]`);
  }
}

// ── 2 · solapamiento, no contención ─────────────────────────────────────────
// La trampa explícita: 2015-2025 NO contiene 2014-2018, pero lo cruza.
if (!tramosDelPeriodo("2015-2025").some((t) => /boom/.test(t))) {
  F("2 · 2015-2025 tiene que cruzar el boom 2014-2018 aunque empiece después (comparten 2015-2018)");
}
if (tramosDelPeriodo("2022-2025").some((t) => /boom|estallido|pandemia/.test(t))) {
  F("2 · 2022-2025 es posterior a los tres tramos: no debe cruzar ninguno");
}

// ── 3 · la glosa no advierte en vacío ───────────────────────────────────────
for (const malo of ["", "2015", "2015-", "veinte-veinticinco", "2025-2015"]) {
  if (glosaPeriodoPlusvalia(malo) !== null) F(`3 · rango inválido «${malo}» debe dar null, no una advertencia`);
}
if (glosaPeriodoPlusvalia(null) !== null) F("3 · sin rango ⇒ null");
if (glosaPeriodoPlusvalia("2022-2025") !== null) F("3 · sin tramos cruzados ⇒ null, no «es ruidoso» sin motivo");

const g = glosaPeriodoPlusvalia("2015-2025");
if (!g) F("3 · el período más común del parque tiene que producir glosa");
else {
  if (!/no una proyecci[óo]n/i.test(g)) F("3 · la glosa no dice lo único que importa: que no es una proyección");
  if (/\d+ ?%/.test(g)) F(`3 · la glosa NO cuantifica cuánto movió cada tramo (REGLA 9: marco temporal, no causa): «${g}»`);
  if (g.includes(",  ") || g.includes(" y  ")) F(`3 · la enumeración quedó mal armada: «${g}»`);
}

// ── 4 · el ancla: los períodos que el motor devuelve de verdad ──────────────
// Sin esto el test valida los rangos que supuso quien lo escribió. `procedenciaPlusvalia`
// es la fuente: si mañana entra una comuna con un período nuevo, acá se ve.
for (const comuna of ["Providencia", "Ñuñoa", "Recoleta", "Maipú", "(comuna inexistente)"]) {
  const rango = procedenciaPlusvalia(comuna).rango;
  if (!/^\d{4}-\d{4}$/.test(rango)) F(`4 · ${comuna}: el motor devuelve un rango que no parsea («${rango}»)`);
  else if (glosaPeriodoPlusvalia(rango) === null) F(`4 · ${comuna} (${rango}): período real del motor SIN glosa — o el rango es nuevo o la tabla quedó corta`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPlusvaliaGlosaTier(): { hard: number } {
  console.log("\n─── TIER PLUSVALÍA (el caveat del período · plusvalia-procedencia.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — 6 períodos, el solapamiento con el boom, la glosa que no advierte en vacío y los rangos reales del motor");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPlusvaliaGlosaTier();
  process.exit(hard ? 1 : 0);
}
