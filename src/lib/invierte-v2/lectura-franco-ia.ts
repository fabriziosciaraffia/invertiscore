// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO», LA LLAMADA AL MODELO (entrega 4 de las láminas del 19-nov-2026). Una llamada por depto: hasta
// MAX_FOTOS_LECTURA fotos guardadas de la publicación (por URL; todas si tiene menos, 20-nov-2026), el título y el texto del
// publicador, y nuestros datos SIN precio
// (la lectura no juzga el precio). Salida estructurada; el saneado de lectura-franco.ts saca lo que no debe mostrarse.
//   · Modelo: CLAUDE_MODEL_LECTURA (ai-config.ts), el que eligió Fabrizio en la prueba A/B (Opus 5.5), esfuerzo medio.
//   · Si el modelo se niega, falla o tarda: null, y la tarjeta queda sin el bloque. Nunca rompe una pantalla.
// El cliente entra por parámetro para que el tier la pruebe sin red.
// ─────────────────────────────────────────────────────────────────────────────
import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL_LECTURA } from "@/lib/ai-config";
import { costoLlamada } from "./preaprobacion-ia";
import { ESQUEMA_LECTURA_FRANCO, INSTRUCCION_LECTURA_FRANCO, MAX_FOTOS_LECTURA, sanearLectura, type LecturaFranco } from "./lectura-franco";

export interface EntradaLectura {
  /** Todas las fotos guardadas de la publicación; a la llamada van las primeras MAX_FOTOS_LECTURA. */
  fotos: string[];
  titulo: string | null;
  descripcion: string | null;
  /** Nuestros datos, sin precio ni ninguna otra cifra del informe que la lectura pudiera repetir. */
  datos: { comuna: string | null; dormitorios: number | null; banos: number | null; superficie_m2: number | null; antiguedad: { anio: number } | "no informada"; metro: { estacion: string; a_pie: boolean } | null };
}

/** ¿La lectura recibe todas las fotos? Solo si la publicación tiene MAX_FOTOS_LECTURA o menos (las guardadas llegan hasta 40). */
export const fotosCompletas = (fotos: readonly string[]) => fotos.length <= MAX_FOTOS_LECTURA;

export type ResultadoLecturaFranco = { ok: true; lectura: LecturaFranco; modelo: string; costoUsd: number | null; ms: number } | { ok: false; motivo: "rechazo" | "vacio" | "formato" | "error" };

export async function generarLecturaFranco(cliente: Anthropic, e: EntradaLectura): Promise<ResultadoLecturaFranco> {
  const fotos = e.fotos.slice(0, MAX_FOTOS_LECTURA);
  const completas = fotosCompletas(e.fotos);
  const cuantas = completas
    ? `Arriba van las ${fotos.length} fotos de la publicación, en su orden: son TODAS sus fotos.`
    : `Arriba van las primeras ${fotos.length} fotos de la publicación, en su orden: la publicación tiene más, así que no digas que falta una foto de algo ni pidas fotos.`;
  const texto = `PUBLICACIÓN (lo que escribió quien publica):\n${JSON.stringify({ titulo: e.titulo, descripcion: e.descripcion }, null, 2)}\n\nNUESTROS DATOS:\n${JSON.stringify(e.datos, null, 2)}\n\n${cuantas} Escribe la lectura.`;
  const t0 = Date.now();
  try {
    const params = {
      model: CLAUDE_MODEL_LECTURA,
      max_tokens: 8000,
      system: INSTRUCCION_LECTURA_FRANCO,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_LECTURA_FRANCO } },
      messages: [{ role: "user", content: [...fotos.map((url) => ({ type: "image", source: { type: "url", url } })), { type: "text", text: texto }] }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;
    // Con hasta 24 fotos la llamada tarda más: el tope va a 100 s (la ruta corre en segundo plano o con la tarjeta esperando).
    const r = await cliente.messages.create(params, { timeout: 100_000, maxRetries: 0 });
    if (r.stop_reason === "refusal") return { ok: false, motivo: "rechazo" };
    const txt = r.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!txt) return { ok: false, motivo: "vacio" };
    const lectura = sanearLectura(JSON.parse(txt), { fotosCompletas: completas });
    if (!lectura) return { ok: false, motivo: "formato" };
    return { ok: true, lectura, modelo: r.model, costoUsd: costoLlamada(r.model, r.usage), ms: Date.now() - t0 };
  } catch (err) {
    console.error("[inv2] lectura de Franco:", err instanceof Error ? err.message : err);
    return { ok: false, motivo: "error" };
  }
}
