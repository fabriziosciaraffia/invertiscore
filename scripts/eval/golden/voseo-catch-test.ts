// ============================================================================
// VOZ CHILENA — catch-test del guard de voseo (determinístico, 0 tokens)
// ============================================================================
// Auto-test de `voz-chilena.ts` tras la revisión del 17-ago-2026 (capa -ás con
// discriminador /rás$/ + altas de léxico + fix de precisión estés/Valdés).
// Cubre lo que el goal pidió: cada forma del corpus real del juez, los falsos
// amigos de la lista de exclusión, un caso corregible (swap, sin reintento) y
// uno no corregible (dispara reintento, NO se corrige en silencio).
//
//   node --import tsx scripts/eval/golden/voseo-catch-test.ts
// ============================================================================

import {
  scanVozChilenaTexto,
  sanitizeVozChilenaTexto,
  hitsQueExigenReintento,
  VOSEO_A_TUTEO,
} from "../../../src/lib/voz-chilena";
import { sanitizeComparativaAI } from "../../../src/lib/ai-generation-ambas";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

// ── (1) Corpus real: formas que el juez marcó en el re-censo + mini-censo.
// Todas deben CAZARSE y, por ser léxico, CORREGIRSE sin reintento.
console.log("── corpus real del juez (deben corregirse por swap) ──");
const CORPUS: [string, string][] = [
  ["comprometés", "comprometes"],   // 7710a017, e42f9e9f
  ["Comprometés", "Comprometes"],   // misma forma, capitalizada
  ["descartás", "descartas"],       // de1f3e8d (STR)
  ["eliminás", "eliminas"],         // de1f3e8d (STR)
  ["cerrás", "cierras"],            // d2a5b32e
  ["Verificá", "Verifica"],         // 7710a017 (mini-censo)
  ["fijás", "fijas"],
];
for (const [forma, esperado] of CORPUS) {
  const frase = `Si ${forma} el trato, revisa el flujo.`;
  const hits = scanVozChilenaTexto(frase);
  const salida = sanitizeVozChilenaTexto(frase);
  check(`${forma} → ${esperado}`, hits.length > 0 && hits.every((h) => h.sugerencia !== null) && salida.includes(esperado), salida.includes(esperado) ? "" : salida);
}

// ── (2) Formas del enunciado del goal (voseo clásico) ──
console.log("── voseo clásico del enunciado ──");
for (const forma of ["tenés", "podés", "querés", "sabés", "mirá", "verificá", "encontrás", "tenes", "podes"]) {
  check(`caza "${forma}"`, scanVozChilenaTexto(`Vos ${forma} razón.`).length > 0);
}
check("pronombre vos", scanVozChilenaTexto("Vos decides el precio.").some((h) => h.capa === "pronombre"));

// ── (3) Falsos amigos: prosa correcta que NO debe disparar ──
console.log("── falsos amigos (0 hits) ──");
const LIMPIAS = [
  "El interés del crédito baja después de firmar.",
  "A través del banco, el análisis del país llega este mes.",
  "Puedes pagar, tienes margen y verifica el dato antes.",
  "Comprarás en marzo, tendrás holgura y verás la diferencia.",
  "Quizás convenga, además del pie; atrás quedó el compás del mercado.",
  "Ojalá estés atento cuando Rodrigo Valdés lo confirme.",
  "Los parqués de la zona y los cafés del barrio suman.",
  "Estás pagando de más, y Andrés lo sabe.",
  "Si te comprometieras hoy, el dividendo sería otro.",
];
for (const frase of LIMPIAS) {
  const hits = scanVozChilenaTexto(frase);
  check(`limpia: "${frase.slice(0, 46)}…"`, hits.length === 0, hits.map((h) => `${h.token}[${h.capa}]`).join(","));
}

// ── (4) Contrato de las dos capas ──
console.log("── contrato de capas ──");
const corregible = scanVozChilenaTexto("Vos tenés el pie listo.");
check("léxico: corregible ⇒ NO dispara reintento", corregible.some((h) => h.capa === "lexico" && h.sugerencia !== null) && hitsQueExigenReintento(corregible).every((h) => h.capa === "pronombre"));
// -ás desconocido: se detecta y dispara reintento, pero NO se corrige en silencio
// (decisión Fabrizio 17-ago: nada de "quitar la tilde" — los diptongantes darían
// formas agramaticales).
const desconocido = scanVozChilenaTexto("Si trepás por el balcón, mira abajo.");
check("-ás desconocido: detecta", desconocido.some((h) => h.token.toLowerCase() === "trepás"));
check("-ás desconocido: exige reintento", hitsQueExigenReintento(desconocido).some((h) => h.token.toLowerCase() === "trepás"));
check("-ás desconocido: NO se corrige en silencio", sanitizeVozChilenaTexto("Si trepás por el balcón.").includes("trepás"));
check("futuro de tuteo intacto tras el swap", sanitizeVozChilenaTexto("Comprarás y tendrás margen.") === "Comprarás y tendrás margen.");

// ── (5) Integridad del léxico ──
console.log("── integridad del léxico ──");
const sinTilde = Object.keys(VOSEO_A_TUTEO).filter((k) => !/[áéí]/.test(k) && !/^(fijate|ponete)$/.test(k));
check("toda entrada sin tilde diptonga en tuteo", sinTilde.every((k) => /ie|ue/.test(VOSEO_A_TUTEO[k])), sinTilde.filter((k) => !/ie|ue/.test(VOSEO_A_TUTEO[k])).join(","));
check("ninguna entrada se mapea a sí misma", Object.entries(VOSEO_A_TUTEO).every(([k, v]) => k !== v));
check("swap idempotente", sanitizeVozChilenaTexto(sanitizeVozChilenaTexto("Si tenés y comprometés, cerrás.")) === sanitizeVozChilenaTexto("Si tenés y comprometés, cerrás."));

// -- (6) AMBAS: cobertura por WALKER, no por lista de campos --
// El canal comparativo enumeraba sus campos a mano; un campo de prosa nuevo
// escapaba al swap en silencio. Este check falla si alguien vuelve a la lista.
console.log("-- AMBAS: cobertura generica --");
{
  const ai = {
    apertura: "Apertura del motor.",
    conviene: { quienDeberiasSer: "Si tenes pie, mira el flujo.", switchPath: "Después podes migrar.", cierre: "Cerrá solo si aguantas." },
    // Campo de prosa HIPOTETICO: el walker debe cubrirlo sin que nadie lo liste.
    campoNuevoDeProsa: "Verificá el arriendo antes.",
    recomendacion: "LTR_PREFERIDO",
    promptVersion: 5,
    francoCaveat: "Sabes que el analisis puede errar.",
  } as unknown as Parameters<typeof sanitizeComparativaAI>[0];
  const out = sanitizeComparativaAI(ai) as unknown as Record<string, unknown>;
  const conv = out.conviene as Record<string, string>;
  check("conviene sanitizado", conv.quienDeberiasSer.includes("tienes") && conv.switchPath.includes("puedes") && conv.cierre.includes("Cierra"));
  check("francoCaveat sanitizado", String(out.francoCaveat).includes("Sabes"));
  check("campo de prosa NUEVO cubierto por el walker", String(out.campoNuevoDeProsa).includes("Verifica"));
  check("no-prosa intacta", out.recomendacion === "LTR_PREFERIDO" && out.promptVersion === 5 && out.apertura === "Apertura del motor.");
}

console.log(fallas === 0 ? "\n✓ VERDE — guard de voseo caza el corpus real y calla en prosa chilena" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
