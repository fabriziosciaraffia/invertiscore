// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO», LA LLAMADA AL MODELO (entrega 4 de las láminas del 19-nov-2026). Una llamada por depto: hasta
// MAX_FOTOS_LECTURA fotos guardadas de la publicación (por URL; todas si tiene menos, 20-nov-2026), el título y el texto del
// publicador, y nuestros datos SIN precio
// (la lectura no juzga el precio). Salida estructurada; el saneado de lectura-franco.ts saca lo que no debe mostrarse.
//   · Modelo: CLAUDE_MODEL_LECTURA (ai-config.ts), el que eligió Fabrizio en la prueba A/B (Opus 5.5), esfuerzo medio.
//   · Las fotos las baja Franco y van a la API como imagen, no como URL (20-nov-2026): una foto borrada en la fuente se salta.
//   · Si el modelo se niega, falla o tarda: el error real (qué fue y su detalle), y la tarjeta queda sin el bloque. Ante un límite
//     de pedidos o un corte, reintenta ahí mismo con espera creciente; una corta que no cumple se rehace. Nunca rompe una pantalla.
// El cliente entra por parámetro para que el tier la pruebe sin red.
// ─────────────────────────────────────────────────────────────────────────────
import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL_LECTURA } from "@/lib/ai-config";
import { costoLlamada } from "./preaprobacion-ia";
import { ESQUEMA_LECTURA_FRANCO, INSTRUCCION_LECTURA_FRANCO, MAX_FOTOS_LECTURA, problemaCorta, sanearConRegistro, type Descarte, type LecturaFranco } from "./lectura-franco";

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

export type ResultadoLecturaFranco = { ok: true; lectura: LecturaFranco; descartes: Descarte[]; modelo: string; costoUsd: number | null; ms: number; fotosVistas: number } | { ok: false; motivo: MotivoFalla; detalle: string };

/** Una foto bajada por Franco para pasarla a la API: el modelo ya no recibe la URL de la fuente (20-nov-2026: la API rechazaba la
 *  lectura entera con «Unable to download the file» cuando UNA foto de la publicación ya no existía en la fuente). */
interface FotoBajada { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }
const TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
/** Lo más pesada que puede ser una foto para la API. */
export const MAX_BYTES_FOTO_LECTURA = 4_500_000;

/** Baja las fotos en paralelo (de a seis), en su orden; las que no bajan (404, no son imagen, muy pesadas, tardan) se saltan. */
export async function bajarFotos(urls: readonly string[], pedir: typeof fetch = fetch): Promise<(FotoBajada | null)[]> {
  const out: (FotoBajada | null)[] = new Array(urls.length).fill(null);
  let k = 0;
  const trabajador = async () => {
    while (k < urls.length) {
      const i = k++;
      try {
        const r = await pedir(urls[i], { signal: AbortSignal.timeout(8000), redirect: "follow" });
        const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (!r.ok || !(TIPOS as readonly string[]).includes(tipo)) continue;
        const b = Buffer.from(await r.arrayBuffer());
        if (!b.length || b.length > MAX_BYTES_FOTO_LECTURA) continue;
        out[i] = { media_type: tipo as FotoBajada["media_type"], data: b.toString("base64") };
      } catch { /* la foto se salta */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, trabajador));
  return out;
}

export type MotivoFalla = "rechazo" | "vacio" | "formato" | "corta" | "limite" | "corte" | "solicitud" | "error";

/** El error real de una llamada (20-nov-2026, Fabrizio: «guarda siempre el error real»): qué fue y su detalle, y si vale reintentar
 *  ahí mismo (límite de pedidos, API sobrecargada, corte o tiempo de espera). */
export function clasificarError(err: unknown): { motivo: MotivoFalla; detalle: string; reintentar: boolean } {
  const e = err as { status?: number; name?: string; message?: string; error?: { error?: { type?: string; message?: string } } };
  const tipo = e?.error?.error?.type ?? null;
  const msj = (e?.error?.error?.message ?? e?.message ?? String(err)).replace(/\s+/g, " ").slice(0, 300);
  const detalle = `${e?.status ?? e?.name ?? "sin estado"}${tipo ? ` ${tipo}` : ""}: ${msj}`;
  if (e?.status === 429) return { motivo: "limite", detalle, reintentar: true };
  if (e?.status === 529 || (e?.status != null && e.status >= 500)) return { motivo: "corte", detalle, reintentar: true };
  if (/timeout|timed out|ECONNRESET|socket|network|fetch failed|Connection/i.test(`${e?.name} ${msj}`)) return { motivo: "corte", detalle, reintentar: true };
  if (e?.status === 400) return { motivo: "solicitud", detalle, reintentar: false };
  return { motivo: "error", detalle, reintentar: false };
}

/** Intentos dentro de una misma llamada a la ruta, y la espera creciente entre ellos. */
export const INTENTOS_LLAMADA = 3;
export const ESPERAS_MS = [2000, 6000] as const;

export async function generarLecturaFranco(cliente: Anthropic, e: EntradaLectura, opts: { pedirFoto?: typeof fetch; esperar?: (ms: number) => Promise<void> } = {}): Promise<ResultadoLecturaFranco> {
  const urls = e.fotos.slice(0, MAX_FOTOS_LECTURA);
  const bajadas = await bajarFotos(urls, opts.pedirFoto);
  const fotos = bajadas.filter((x): x is FotoBajada => !!x);
  // «Todas las fotos» solo si la publicación tiene 24 o menos Y bajaron todas: si una no bajó, puede ser justo la del baño.
  const completas = fotosCompletas(e.fotos) && fotos.length === urls.length;
  const cuantas = !fotos.length
    ? "No se pudo ver ninguna foto de la publicación: no digas nada de las fotos ni de lo que falta en ellas."
    : completas
      ? `Arriba van las ${fotos.length} fotos de la publicación, en su orden: son TODAS sus fotos.`
      : `Arriba van ${fotos.length} fotos de la publicación, en su orden: la publicación tiene más (o algunas no se pudieron ver), así que no digas que falta una foto de algo ni pidas fotos.`;
  const texto = `PUBLICACIÓN (lo que escribió quien publica):\n${JSON.stringify({ titulo: e.titulo, descripcion: e.descripcion }, null, 2)}\n\nNUESTROS DATOS:\n${JSON.stringify(e.datos, null, 2)}\n\n${cuantas} Escribe la lectura.`;
  const esperar = opts.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const t0 = Date.now();
  let ultima: { motivo: MotivoFalla; detalle: string } = { motivo: "error", detalle: "sin intentos" };
  // El costo es el de TODOS los intentos (una corta que se rehace también se paga).
  let gastado: number | null = null;
  for (let intento = 0; intento < INTENTOS_LLAMADA; intento++) {
    if (intento > 0) await esperar(ESPERAS_MS[Math.min(intento - 1, ESPERAS_MS.length - 1)]);
    try {
      const params = {
        model: CLAUDE_MODEL_LECTURA,
        max_tokens: 8000,
        system: INSTRUCCION_LECTURA_FRANCO,
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_LECTURA_FRANCO } },
        messages: [{ role: "user", content: [...fotos.map((f) => ({ type: "image", source: { type: "base64", media_type: f.media_type, data: f.data } })), { type: "text", text: texto }] }],
      } as unknown as Anthropic.MessageCreateParamsNonStreaming;
      // Con hasta 24 fotos la llamada tarda ~15 s; cada intento tiene 50 s (la ruta, 180).
      const r = await cliente.messages.create(params, { timeout: 50_000, maxRetries: 0 });
      const c = costoLlamada(r.model, r.usage);
      if (c != null) gastado = (gastado ?? 0) + c;
      if (r.stop_reason === "refusal") return { ok: false, motivo: "rechazo", detalle: "el modelo se negó" };
      const txt = r.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
      if (!txt) { ultima = { motivo: "vacio", detalle: `sin texto (stop_reason ${r.stop_reason})` }; continue; }
      const { lectura, descartes } = sanearConRegistro(JSON.parse(txt), { fotosCompletas: completas });
      // Cada línea que el saneado borra queda en el log (y quien llama la guarda en la fila): qué línea y por qué regla.
      for (const d of descartes) console.warn(`[inv2] lectura de Franco: el saneado borró una línea (${d.campo}, regla ${d.regla}): ${d.texto}`);
      if (!lectura) { ultima = { motivo: "formato", detalle: "sin líneas que mostrar" }; continue; }
      // Una corta que no cumple (tres frases de 110 caracteres) se rehace: no se corta a la mitad.
      const problema = problemaCorta(lectura);
      if (problema) { ultima = { motivo: "corta", detalle: problema }; console.warn(`[inv2] lectura de Franco: se rehace, ${problema}`); continue; }
      return { ok: true, lectura, descartes, modelo: r.model, costoUsd: gastado, ms: Date.now() - t0, fotosVistas: fotos.length };
    } catch (err) {
      const c = clasificarError(err);
      console.error(`[inv2] lectura de Franco (intento ${intento + 1}): ${c.motivo} · ${c.detalle}`);
      ultima = { motivo: c.motivo, detalle: c.detalle };
      if (!c.reintentar) break;
    }
  }
  return { ok: false, ...ultima };
}
