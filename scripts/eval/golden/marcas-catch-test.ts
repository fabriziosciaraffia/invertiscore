// ============================================================================
// MARCAS DE DESTACADOR — catch-test del invariante (determinístico, 0 tokens)
// ============================================================================
// Refuerzo 3 de FASE 2 (rediseño Dictamen). Tres cosas:
//   (1) el validador `marcasBalanceadas` caza un `**` impar y acepta prosa sana;
//   (2) `stripMarcas` deja texto plano (render tolerante FASE 2);
//   (3) demostración del RIESGO REAL: un sanitizer por-oración del pipeline
//       (stripCardEcho, STR) mutila un par que cruza el punto → queda `**`
//       impar → el invariante AS3/A10 lo caza. Es la clase de bug que motivó
//       el check; si stripCardEcho cambia y esto deja de reproducirse, mejor —
//       el caso (3b) verifica que el par DENTRO de una oración sobrevive.
//
//   node --import tsx scripts/eval/golden/marcas-catch-test.ts
// ============================================================================

import { contarTokensMarca, marcasBalanceadas, stripMarcas, stripMarcasDeep, validarTitular } from "../../../src/lib/prosa-marcas";
import { stripCardEcho } from "../../../src/lib/ai-generation-str";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

// ── (1) Validador: balance ──
console.log("── validador de balance ──");
check("prosa sin marcas es válida", marcasBalanceadas("El flujo mensual queda corto."));
check("un par es válido", marcasBalanceadas("El precio **está sobre la mediana** de la comuna."));
check("dos pares son válidos", marcasBalanceadas("**Pagas caro** y **el arriendo no cubre la cuota**."));
check("un `**` huérfano se caza", !marcasBalanceadas("El precio **está sobre la mediana de la comuna."));
check("tres tokens se cazan", !marcasBalanceadas("**Pagas caro** y el arriendo ** no llega."));
check("conteo exacto", contarTokensMarca("a **b** c **d** e") === 4);

// ── (2) Strip (render tolerante) ──
console.log("── stripMarcas ──");
check(
  "par completo → texto plano",
  stripMarcas("Pagas **caro** este arriendo.") === "Pagas caro este arriendo.",
);
check(
  "huérfano igual se stripea (nunca `**` crudo en pantalla)",
  !stripMarcas("Pagas **caro este arriendo.").includes("**"),
);
check("prosa sin marcas queda idéntica", stripMarcas("Sin marcas acá.") === "Sin marcas acá.");

// ── (3) Riesgo real: sanitizer por-oración mutila un par que cruza el punto ──
console.log("── stripCardEcho + par cruzado (la clase de bug que AS3/A10 caza) ──");
// vsLTR: la 1ª oración re-enuncia la dirección pelada (el patrón que stripCardEcho
// bota) y una marca ABRE en esa oración y CIERRA en la siguiente. El resto queda
// ≥18 palabras para que el strip proceda.
const aiSembrada = {
  vsLTR: {
    contenido:
      "El arriendo largo rinde más **en esta zona. Ese margen" +
      " no compensa** el esfuerzo operativo del corto cuando la ocupación real se queda bajo la banda observada de la comuna y la rotación te obliga a gestionar semana a semana.",
  },
} as never;
const logs: string[] = [];
stripCardEcho(aiSembrada, {}, (m: string) => logs.push(m));
const post = (aiSembrada as { vsLTR: { contenido: string } }).vsLTR.contenido;
const seEjecutoStrip = logs.some((l) => l.includes("STR-ECHO-STRIPPED"));
if (seEjecutoStrip) {
  check(
    "el strip por-oración dejó un `**` impar y el invariante lo caza",
    !marcasBalanceadas(post),
    `post: "${post.slice(0, 60)}…"`,
  );
} else {
  // El seed no disparó el strip (regex del echo cambió): el catch-test no puede
  // demostrar la mutilación, pero el par dentro de UNA oración debe estar intacto.
  check("(strip no disparó) prosa sembrada sigue balanceada", marcasBalanceadas(post));
  console.log("  ⚠ stripCardEcho no disparó sobre el seed — revisar el regex del catch-test");
}
// 3b — par contenido en una oración sobrevive al strip de la 1ª oración.
const aiSana = {
  vsLTR: {
    contenido:
      "En esta zona LTR rinde más. La brecha real está en la gestión: **administrarlo tú baja la comisión a cero** y ese ahorro mensual es la única palanca que mueve el flujo antes de renegociar el precio de compra con el vendedor.",
  },
} as never;
stripCardEcho(aiSana, {}, () => {});
check(
  "par dentro de una oración sobrevive al strip",
  marcasBalanceadas((aiSana as { vsLTR: { contenido: string } }).vsLTR.contenido),
);

// ── (4) validarTitular (checks A9/AS4 — clase "campo nuevo ausente") ──
console.log("── validarTitular ──");
check("titular del set aprobado pasa", validarTitular("Este depto no conviene: pagas caro y **el arriendo no cubre la cuota**.").ok);
check("ausente se caza", !validarTitular(undefined).ok);
check("vacío se caza", !validarTitular("  ").ok);
check("sin marca se caza", !validarTitular("Este depto no conviene: pagas caro.").ok);
check("dos pares se cazan", !validarTitular("**Pagas caro** y **el arriendo no cubre**.").ok);
check(">15 palabras se caza", !validarTitular("Este depto realmente no te conviene para nada porque pagas demasiado caro y además **el arriendo mensual no cubre**.").ok);
// Núcleo >7: regla de PROMPT, no del check (contrato §5.2) — el titular VIVE.
check("núcleo >7 palabras NO bloquea (regla de prompt)", validarTitular("No conviene: **pagas caro un arriendo que nunca cubre la cuota mensual**.").ok);
check("monto $ se caza", !validarTitular("No conviene: pierdes **$600.000 cada mes** operando.").ok);
check("monto UF se caza", !validarTitular("No conviene: pagas **UF 300 de más** por este depto.").ok);
check("porcentaje SÍ pasa (decisión i)", validarTitular("No conviene: pagas **20% sobre el precio de mercado**.").ok);

// ── (5) stripMarcasDeep (render tolerante en la raíz) ──
console.log("── stripMarcasDeep ──");
const prosa = { conviene: { respuestaDirecta: "No conviene. **Pagas caro** este arriendo.", cajaAccionable: "Sin marcas." }, titular: "No conviene: **pagas caro**." };
const strip = stripMarcasDeep(prosa);
check("deep strip limpia anidados", strip.conviene.respuestaDirecta === "No conviene. Pagas caro este arriendo." && strip.titular === "No conviene: pagas caro.");
check("no muta el original", prosa.conviene.respuestaDirecta.includes("**"));
check("strings sin marcas quedan idénticos", strip.conviene.cajaAccionable === "Sin marcas.");

console.log(`\n${fallas === 0 ? "✓ VERDE" : `✗ ROJO — ${fallas} fallas`}`);
process.exit(fallas === 0 ? 0 : 1);
