// ============================================================================
// JUEZ EDITORIAL — Fase 1 (instrumento, no corrector)
// ============================================================================
// Evalúa el INFORME COMPLETO como pieza de lectura contra la rúbrica de 7
// dimensiones. La rúbrica vive en RUBRICA.md (fuente de verdad editable por
// Fabrizio) y se inyecta completa en el system prompt: cambiar el .md cambia
// el instrumento sin tocar código.
//
// Doctrina: lectura SEMÁNTICA por IA, no regex. El juez lee el informe en el
// orden en que el usuario lo lee y reporta fallas {dimension, severidad, pieza,
// cita, explicacion}. Solo mide; nunca corrige.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";

export const EVAL_MODEL = "claude-opus-4-8";

const anthropic = new Anthropic();

export function leerRubrica(): string {
  return readFileSync(path.join(__dirname, "RUBRICA.md"), "utf-8");
}

// ── System prompt ───────────────────────────────────────────────────────────
// La rúbrica manda; acá solo va el encuadre del rol y las guardas anti-ruido
// (calibración: si el juez inventa fallas en informes buenos, se ajusta ESTO,
// no la rúbrica).
export function buildSystemPrompt(rubrica: string): string {
  return `Eres un EDITOR DE CIERRE (el último par de ojos antes de imprenta) de los informes que "Franco", un asesor IA de inversión inmobiliaria chileno (refranco.ai), entrega a sus usuarios. NO eres Franco y NO reescribes: tu único trabajo es LEER el informe completo como pieza — de arriba a abajo, en el orden en que el usuario lo lee — y reportar las fallas editoriales según la rúbrica.

Recibirás el informe ENSAMBLADO en orden de lectura, pieza por pieza, con etiquetas [PIEZA: ...]. Las piezas etiquetadas [PIEZA: card:*] son tarjetas de una pirámide visual (titular + frase); las [PIEZA: drawer:*] son el detalle que se expande al tocar la card o secciones desplegables con prosa. El lector típico lee el hero completo, escanea las cards, y abre 1-3 drawers.

CONTEXTO DE FORMATO (no son fallas):
- El informe alterna montos CLP/UF vía un toggle; recibirás la variante CLP. Que una cifra aparezca en CLP y su gemela UF no llegue no es falla.
- Las cards resumen y los drawers expanden: la repetición card→drawer con más detalle es diseño, no redundancia.
- Los números vienen del motor de cálculo y NO los auditas contra fuentes externas: esta evaluación es EDITORIAL (cómo se lee), no numérica (si el número es correcto). Solo reporta cifras cuando dos piezas del MISMO informe se contradicen entre sí (dimensión 3) o cuando una cifra aparece sin su "qué prueba" (dimensión 1).
- El veredicto (COMPRAR / AJUSTA SUPUESTOS / BUSCAR OTRA) lo fija el motor; no lo cuestiones. Evalúa si la narración lo acompaña con coherencia.

DISCIPLINA DE CALIBRACIÓN (crítica — el instrumento vale por esto):
- Reporta SOLO fallas defendibles con la cita textual. Ante duda razonable, NO reportes: un instrumento que inventa fallas en informes buenos no sirve para medir.
- No conviertas preferencias de estilo en fallas. La rúbrica define qué es falla; tu gusto no.
- No repitas la misma falla N veces: si una muletilla aparece 4 veces, repórtala UNA vez citando la peor ocurrencia y anota "×4" en la explicación. Excepción: voseo y vocabulario prohibido se reportan POR ocurrencia (severidad alta cada una).
- CONTRADICCIÓN NUMÉRICA (dim 3) exige MISMO concepto, MISMA base y MISMO plazo. Estos informes manejan varias palancas de precio que conviven legítimamente con porcentajes distintos: el descuento para CAMBIAR DE VEREDICTO, el precio al que el arriendo CUBRE EL DIVIDENDO (break-even de caja), y el precio NEGOCIABLE sugerido son tres conceptos distintos — no se contradicen entre sí. Igual que una cifra a 5 años vs otra a 10, o la misma ventaja expresada en dos marcos (por m² vs total; % vs monto; UF vs CLP). Antes de reportar dim 3 numérica, nombra en la explicación el concepto ÚNICO que ambas cifras miden; si no puedes nombrarlo, no es dim 3. Si la convivencia de cifras genuinamente deja al lector sin saber cuál usar y no hay puente, repórtala UNA vez como dim 1 MEDIA (dato sin su "qué prueba"), no como contradicción.
- NO hagas aritmética propia para inferir contradicciones (nada de "X al mes ×120 debería dar Y"): los aportes, flujos y proyecciones varían año a año dentro del modelo, y tu extrapolación lineal no es evidencia. Solo reporta incompatibilidad numérica cuando las dos cifras nombran el mismo concepto en el mismo plazo y difieren más allá del redondeo.
- Máximo ~12 fallas por informe; si hay más, prioriza por severidad y representatividad.

═══════════════════ RÚBRICA (fuente de verdad) ═══════════════════

${rubrica}

═══════════════════ FIN DE LA RÚBRICA ═══════════════════

SALIDA: devuelve SOLO el objeto JSON del "Formato de salida del evaluador" de la rúbrica, sin texto alrededor, sin fences. Si el informe está limpio, "fallas": [].`;
}

// ── Resultado tipado ────────────────────────────────────────────────────────
export interface FallaEditorial {
  dimension: number;
  severidad: "alta" | "media" | "baja";
  pieza: string;
  cita: string;
  explicacion: string;
}

export interface EvalEditorial {
  resumen: string;
  fallas: FallaEditorial[];
  _usage?: { input_tokens: number; output_tokens: number };
  _ms?: number;
  _raw?: string;
}

// ── Llamada ─────────────────────────────────────────────────────────────────
export async function evaluarInforme(args: {
  systemPrompt: string;
  meta: { id8: string; tipo: string; veredicto: string; comuna: string; promptVersion: number | null };
  informeTexto: string;
  // Instrucción de alcance de dimensiones. Default: las 7 generales (LTR/STR).
  // El censo AMBAS pasa la suya (1-7 + 8-13 "SOLO AMBAS" de la rúbrica).
  dimensiones?: string;
}): Promise<EvalEditorial> {
  const dims = args.dimensiones ?? "las 7 dimensiones de la rúbrica";
  const userPrompt = `METADATOS DEL CASO (contexto, no es texto a evaluar): ${JSON.stringify(args.meta)}

═══ INFORME COMPLETO (ensamblado en orden de lectura) ═══

${args.informeTexto}

═══ FIN DEL INFORME ═══

Evalúa el informe contra ${dims} y devuelve SOLO el JSON.`;

  const t0 = Date.now();
  const msg = await anthropic.messages.create({
    model: EVAL_MODEL,
    max_tokens: 4000,
    system: args.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const ms = Date.now() - t0;

  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  let parsed: EvalEditorial;
  try {
    const jsonStr = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { resumen: "PARSE_ERROR — el juez no devolvió JSON válido", fallas: [], _raw: text.slice(0, 2000) };
  }
  if (!Array.isArray(parsed.fallas)) parsed.fallas = [];
  // Post-filtro determinístico (mismo patrón que scripts/eval/judge.ts): descarta
  // auto-omisiones que el modelo a veces cuela pese a la instrucción ("no es falla",
  // "se omite", "descartada tras revisión"). El reporte lista SOLO problemas.
  const SELF_OMIT = /no es falla|no\s+hallazgo|se omite|descartad[ao]|\(\s*retiro|no aplica como falla/i;
  parsed.fallas = parsed.fallas.filter((f) => !SELF_OMIT.test(f.explicacion ?? "") && !SELF_OMIT.test(f.cita ?? ""));
  parsed._usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  parsed._ms = ms;
  return parsed;
}
