// ─────────────────────────────────────────────────────────────────────────────
// RETRY QUIRÚRGICO POR CAMPO — núcleo compartido (goal "retry por campo en
// generateStrProse", 05-sep-2026).
//
// Patrón LTR (HERO-CLAIM, UNIDAD-M2, NEG-TECHO): cuando un guard rechaza uno o varios
// campos de una prosa YA generada, se reescriben SOLO esos campos con un prompt acotado
// (campo · problema · texto actual · instrucción · JSON de reemplazos), UNA llamada, y el
// candidato se acepta solo si baja el conteo de violaciones de esa regla y no empeora lo
// que ya estaba bien (drift, voz, cifras). Si no, se conserva el previo. Nunca se
// regenera el JSON completo: una pasada completa cuesta ~7k tokens y ~53 s; un quirúrgico
// ~1k tokens y ~6 s (medido en pipeline_timing, sep-2026).
//
// Consumidores: STR (los tres detectores que antes disparaban pasada completa —cifras,
// drift duro, voz— y los seis guards de str-guards). LTR conserva sus retries propios;
// migrarlo es otro goal.
// ─────────────────────────────────────────────────────────────────────────────
import type Anthropic from "@anthropic-ai/sdk";
import type { RegistroLlamadas } from "./pipeline-timing";
import { acumularUsage, type AiUsage } from "./ai-usage";

export interface CampoQuirurgico {
  /** Path del campo dentro de la prosa ("conviene.respuestaDirecta_clp", "titular"). */
  path: string;
  /** Texto actual del campo. */
  actual: string;
  /** Violaciones detectadas en ese campo (citas para el prompt). */
  viol: string[];
}

export interface ArgsRetryQuirurgico<T> {
  anthropic: Anthropic;
  model: string;
  system: Anthropic.MessageCreateParams["system"];
  reg: RegistroLlamadas;
  usage: AiUsage;
  /** Nombre corto del guard: viaja a pipeline_timing (`guard`) y al residuo. */
  guard: string;
  /** Etiqueta del log ("[STR-CIFRA]"). */
  etiqueta: string;
  base: T;
  campos: CampoQuirurgico[];
  /** Primera línea del prompt (default: "…de un análisis YA generado y validado…"). */
  encabezado?: string;
  problema: (viol: string[]) => string;
  instruccion: string;
  /** Violaciones de ESTA regla en una prosa (debe bajar para aceptar). */
  evaluar: (ai: T) => number;
  /** false si el candidato empeora lo que ya estaba bien (drift, voz, cifras fuera del input). */
  noEmpeora: (base: T, candidato: T) => boolean;
  escribir: (ai: T, path: string, valor: string) => void;
  maxTokens?: number;
  log: (m: string) => void;
}

export interface ResultadoRetryQuirurgico<T> {
  ai: T;
  /** true si hubo llamada al modelo (cuenta para el tope del caller). */
  llamo: boolean;
  aceptado: boolean;
  antes: number;
  despues: number;
}

export function promptQuirurgico(campos: CampoQuirurgico[], problema: (v: string[]) => string, instruccion: string, encabezado?: string): string {
  const cab = encabezado ?? `Estás corrigiendo SOLO ${campos.length} campo(s) de un análisis de renta corta YA generado y validado. El resto de la prosa no se toca y no lo ves.`;
  return `${cab}

${campos.map((c) => `CAMPO ${c.path}\nPROBLEMA: ${problema(c.viol)}\nTEXTO ACTUAL:\n${c.actual}`).join("\n\n")}

TU TAREA: ${instruccion} Conserva el mismo contenido, las mismas cifras (ninguna cifra nueva), el mismo largo aproximado y las marcas \`**…**\` que ya tenía cada campo. Tuteo chileno neutro, sin voseo.

Responde SOLO este JSON, sin texto alrededor:
{${campos.map((c) => `"${c.path}": "..."`).join(", ")}}`;
}

/** Reescribe `campos` de `base` con una llamada acotada; devuelve el candidato aceptado
 *  o la base intacta. Nunca lanza: un fallo del modelo es best-effort (el análisis sigue). */
export async function retryQuirurgico<T>(a: ArgsRetryQuirurgico<T>): Promise<ResultadoRetryQuirurgico<T>> {
  const campos = a.campos.filter((c) => c.actual);
  const antes = a.evaluar(a.base);
  if (!campos.length || antes === 0) return { ai: a.base, llamo: false, aceptado: false, antes, despues: antes };
  a.log(`${a.etiqueta} ${campos.map((c) => `${c.path}: ${c.viol.map((v) => `«${v.slice(0, 100)}»`).join(" · ")}`).join(" | ")} — 1 reintento quirúrgico`);
  try {
    const prompt = promptQuirurgico(campos, a.problema, a.instruccion, a.encabezado);
    const msg = await a.reg.medir(`guard-${a.guard}`, a.model, () => a.anthropic.messages.create({
      model: a.model,
      max_tokens: a.maxTokens ?? 1500,
      messages: [{ role: "user", content: prompt }],
      system: a.system,
    }), { guard: a.guard, campos: campos.map((c) => c.path) });
    acumularUsage(a.usage, msg);
    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    let reemplazos: Record<string, unknown> = {};
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      reemplazos = JSON.parse(m ? m[0] : rawText) as Record<string, unknown>;
    } catch { /* no parseó — candidato vacío, se conserva el previo */ }
    const candidato = JSON.parse(JSON.stringify(a.base)) as T;
    let aplicados = 0;
    for (const c of campos) {
      const nuevo = reemplazos[c.path];
      if (typeof nuevo === "string" && nuevo.trim()) { a.escribir(candidato, c.path, nuevo.trim()); aplicados++; }
    }
    const despues = a.evaluar(candidato);
    if (aplicados > 0 && despues < antes && a.noEmpeora(a.base, candidato)) {
      a.log(`${a.etiqueta} retry mejoró ${antes}→${despues} — aceptado`);
      return { ai: candidato, llamo: true, aceptado: true, antes, despues };
    }
    a.log(`${a.etiqueta} retry no mejoró (${antes}→${despues}), no parseó o empeoró cifras/drift/voz — conservo el previo`);
    return { ai: a.base, llamo: true, aceptado: false, antes, despues: antes };
  } catch (e) {
    a.log(`${a.etiqueta} falló (best-effort, el análisis sigue normal): ${(e as Error)?.message ?? e}`);
    return { ai: a.base, llamo: true, aceptado: false, antes, despues: antes };
  }
}

/** Agrupa violaciones `path="cita"` (formato de cifras-guard / scanWith) por campo. */
export function agruparPorCampo(viols: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const v of viols) {
    const i = v.indexOf("=");
    const path = i > 0 ? v.slice(0, i) : v;
    m.set(path, [...(m.get(path) ?? []), v]);
  }
  return m;
}
