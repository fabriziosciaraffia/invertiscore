// ─────────────────────────────────────────────────────────────────────────────
// LA LECTURA CON IA DE LA PREAPROBACIÓN (Invierte con Franco, entrega 3, 19-nov-2026). Una llamada: el documento (PDF o foto)
// y una instrucción corta; la respuesta sale en JSON con forma fija (salida estructurada). La IA PROPONE: banco, monto, moneda,
// vigencia y el nombre y RUT del titular, cada uno con su certeza. Lo que se decide (si el nombre coincide con la orden, el
// monto en UF) lo calcula el servidor; aprobar lo hace una persona de Franco.
//   · Modelo: CLAUDE_MODEL_DOCUMENTOS (ai-config.ts). Esfuerzo bajo: es transcribir, no razonar.
//   · Si la IA se niega, falla, tarda o el archivo es HEIC: devuelve null y la revisión es a mano. Nunca rompe la subida.
//   · El costo se guarda en USD con las tarifas de costo-ia.ts (inv_documentos.ia_costo_usd).
// Las dependencias entran por `cliente` para que el tier la pruebe sin red.
// ─────────────────────────────────────────────────────────────────────────────
import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL_DOCUMENTOS } from "@/lib/ai-config";
import { TARIFAS } from "@/lib/costo-ia";
import { MIMES_QUE_LEE_LA_IA } from "./preaprobacion";

export type Certeza = "alta" | "media" | "baja";
export interface LecturaIA {
  esPreaprobacion: boolean;
  banco: string | null;
  monto: number | null;
  moneda: "UF" | "CLP" | null;
  vigenteHasta: string | null;
  nombreTitular: string | null;
  rutTitular: string | null;
  observaciones: string | null;
  certeza: { banco: Certeza; monto: Certeza; vigencia: Certeza; nombre: Certeza };
}

const NULO_STR = { type: ["string", "null"] } as const;
const CERTEZA = { type: "string", enum: ["alta", "media", "baja"] } as const;
export const ESQUEMA_LECTURA = {
  type: "object",
  additionalProperties: false,
  required: ["es_preaprobacion", "banco", "monto", "moneda", "vigente_hasta", "nombre_titular", "rut_titular", "observaciones", "certeza"],
  properties: {
    es_preaprobacion: { type: "boolean" },
    banco: NULO_STR,
    monto: { type: ["number", "null"] },
    // Una lista de valores con nulo va con anyOf: `type: ["string","null"]` + `enum` lo rechaza la API (400, medido el 19-nov-2026).
    moneda: { anyOf: [{ type: "string", enum: ["UF", "CLP"] }, { type: "null" }] },
    vigente_hasta: NULO_STR,
    nombre_titular: NULO_STR,
    rut_titular: NULO_STR,
    observaciones: NULO_STR,
    certeza: { type: "object", additionalProperties: false, required: ["banco", "monto", "vigencia", "nombre"], properties: { banco: CERTEZA, monto: CERTEZA, vigencia: CERTEZA, nombre: CERTEZA } },
  },
} as const;

// En tuteo chileno neutro, sin voseo (CLAUDE.md: los prompts también).
export const INSTRUCCION_LECTURA = `Este documento lo subió una persona como su preaprobación de crédito hipotecario de un banco chileno (o el certificado de su banco).
Transcribe lo que dice el documento, sin inventar nada:
- es_preaprobacion: true si es una preaprobación, aprobación o precalificación de crédito hipotecario de un banco o mutuaria; false si es otra cosa.
- banco: el nombre del banco o la institución, como aparece.
- monto: el monto máximo del crédito que aprueba, como número, sin puntos de miles; moneda: "UF" o "CLP" según cómo lo expresa.
- vigente_hasta: la fecha hasta la que vale, en formato AAAA-MM-DD. Si solo dice una fecha de emisión y una vigencia en días, calcula la fecha final.
- nombre_titular y rut_titular: los del solicitante, como aparecen.
- observaciones: una frase corta solo si hay algo que una persona debería revisar (por ejemplo, que está vencida, ilegible o a nombre de otra persona); si no, null.
- certeza: alta si el dato se lee claro en el documento, media si hay que interpretarlo, baja si no aparece o no se distingue.
Si un dato no aparece, va null.`;

/** El costo de una llamada, en USD, con las tarifas del repo. Null si el modelo no tiene tarifa. */
export function costoLlamada(modelo: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number | null {
  const t = TARIFAS[modelo];
  if (!t) return null;
  const usd = (u.input_tokens * t.input + u.output_tokens * t.output + (u.cache_read_input_tokens ?? 0) * t.cacheRead + (u.cache_creation_input_tokens ?? 0) * t.cacheWrite) / 1e6;
  return Math.round(usd * 1e5) / 1e5;
}

function aLectura(j: Record<string, unknown>): LecturaIA {
  const s = (k: string) => (typeof j[k] === "string" && (j[k] as string).trim() ? (j[k] as string).trim() : null);
  const c = (j.certeza ?? {}) as Record<string, Certeza>;
  const v = s("vigente_hasta");
  return {
    esPreaprobacion: j.es_preaprobacion === true, banco: s("banco"), monto: typeof j.monto === "number" && j.monto > 0 ? j.monto : null,
    moneda: j.moneda === "UF" || j.moneda === "CLP" ? j.moneda : null, vigenteHasta: v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null,
    nombreTitular: s("nombre_titular"), rutTitular: s("rut_titular"), observaciones: s("observaciones"),
    certeza: { banco: c.banco ?? "baja", monto: c.monto ?? "baja", vigencia: c.vigencia ?? "baja", nombre: c.nombre ?? "baja" },
  };
}

export type ResultadoLectura = { ok: true; lectura: LecturaIA; modelo: string; costoUsd: number | null } | { ok: false; motivo: "formato" | "rechazo" | "error" | "vacio" };

export async function leerPreaprobacionIA(cliente: Anthropic, archivo: { bytes: Uint8Array; mime: string }): Promise<ResultadoLectura> {
  if (!MIMES_QUE_LEE_LA_IA.has(archivo.mime)) return { ok: false, motivo: "formato" };
  const data = Buffer.from(archivo.bytes).toString("base64");
  const bloque: Anthropic.Beta.BetaContentBlockParam = archivo.mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: archivo.mime as "image/jpeg" | "image/png" | "image/webp", data } };
  try {
    // El respaldo del servidor ante una negativa de los filtros de seguridad (`fallbacks: "default"`, beta): el SDK del repo
    // (0.78) todavía no lo tipa, así que va con un cast; lo demás va tipado.
    const params = {
      model: CLAUDE_MODEL_DOCUMENTOS,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_LECTURA } },
      messages: [{ role: "user", content: [bloque, { type: "text", text: INSTRUCCION_LECTURA }] }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
    const r = await cliente.beta.messages.create(params, { timeout: 45_000, maxRetries: 1 });
    if (r.stop_reason === "refusal") return { ok: false, motivo: "rechazo" };
    const texto = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!texto) return { ok: false, motivo: "vacio" };
    return { ok: true, lectura: aLectura(JSON.parse(texto) as Record<string, unknown>), modelo: r.model, costoUsd: costoLlamada(r.model, r.usage) };
  } catch (e) {
    console.error("[inv2] lectura de la preaprobación:", e instanceof Error ? e.message : e);
    return { ok: false, motivo: "error" };
  }
}
