// ─────────────────────────────────────────────────────────────────────────────
// El relleno de publicadores (12-nov-2026, decisión de Fabrizio): lee la ficha de los deptos que importan para saber quién
// los publica. Primero los deptos con inscripciones en Invierte con Franco, después los que convienen (Comprar con pie 20 %
// y 30 años), de mayor a menor puntaje.
//
//   · VA POR DECODO, NO POR LA IP DE LAS PERSONAS. Su bajada usa su propio proxy (`DECODO_RELLENO_URL`); sin esa variable no
//     lee nada. Las lecturas de las personas (la guía, «Analizar este», «Quiero verlo») siguen por `PROXY_URL` con su tope
//     de 30 por hora intacto: el relleno no lo cuenta ni lo gasta, porque anota en su propia bitácora (`lecturas_relleno`).
//   · RITMO: 200 fichas por hora como máximo (`RITMO_RELLENO_POR_HORA`), a cualquier hora. Cada corrida lee un lote
//     (`LOTE_RELLENO`) con una pausa entre ficha y ficha, y el tope por hora se mira antes de cada GET.
//   · FUSIBLE: se corta la corrida y el relleno queda detenido `PAUSA_FUSIBLE_MS` ante un bloqueo (403/429/desafío), una
//     respuesta rara (un 200 que no es la ficha), errores seguidos o fichas seguidas sin publicador (la fuente cambió la forma).
//   · MISMA PUERTA, MISMAS REGLAS: lee con `leerFicha` (dos GETs como mucho, sin seguir redirecciones solas, sin reintentos),
//     así que un despublicado sale de `avisos_evaluados` y un año se comparte con el edificio, igual que en la guía.
// Puro: los datos, la lectura y el reloj se inyectan (lo prueba el tier PUBLICADORES).
// ─────────────────────────────────────────────────────────────────────────────
import type { ResultadoLectura } from "@/lib/guia/publicacion";

/** Fichas por hora como máximo, entre todas las corridas. */
export const RITMO_RELLENO_POR_HORA = 200;
/** Fichas por corrida. El cron corre cada 10 minutos: 6 × 40 = 240, y el tope de 200 por hora corta antes. */
export const LOTE_RELLENO = 40;
/** Pausa entre ficha y ficha dentro de una corrida. */
export const PAUSA_ENTRE_FICHAS_MS = 1000;
/** Cuánto queda detenido el relleno después de que salta el fusible. */
export const PAUSA_FUSIBLE_MS = 6 * 60 * 60 * 1000;
/** Errores o tiempos seguidos que hacen saltar el fusible. */
export const ERRORES_SEGUIDOS_FUSIBLE = 3;
/** Fichas publicadas seguidas sin publicador que hacen saltar el fusible. */
export const SIN_PUBLICADOR_SEGUIDAS_FUSIBLE = 5;

export type MotivoFusible = "bloqueo" | "rara" | "errores" | "sin-publicador";

export interface CandidatoRelleno {
  avisoId: string;
  url: string;
  edificio: string;
  /** 0 = tiene inscripción en Invierte con Franco · 1 = conviene. */
  prioridad: number;
}

export interface DepsRelleno {
  /** El fusible vigente, si saltó hace menos de PAUSA_FUSIBLE_MS. */
  fusible(): Promise<{ hasta: Date; motivo: string } | null>;
  saltarFusible(motivo: MotivoFusible, detalle: string, hasta: Date): Promise<void>;
  candidatos(limite: number): Promise<CandidatoRelleno[]>;
  /** Lee UNA ficha por Decodo, con el tope del relleno. */
  leer(c: CandidatoRelleno): Promise<ResultadoLectura>;
  esperar(ms: number): Promise<void>;
  ahora(): Date;
}

export interface ResumenRelleno {
  estado: "detenido" | "sin-candidatos" | "tope" | "fusible" | "completo";
  leidas: number;
  conPublicador: number;
  despublicadas: number;
  inscripciones: number;
  fusible: { motivo: MotivoFusible; detalle: string } | null;
}

/** El motivo por el que una lectura hace saltar el fusible, contando las rachas. null si sigue. */
export function evaluarFusible(
  l: ResultadoLectura,
  racha: { errores: number; sinPublicador: number },
): { motivo: MotivoFusible; detalle: string } | null {
  if (!l.leida) return null;
  if (l.motivo === "bloqueo") return { motivo: "bloqueo", detalle: `la fuente respondió ${l.codigo ?? "un desafío"}` };
  if (l.motivo === "publicado" && l.rara) return { motivo: "rara", detalle: "un 200 que no es la ficha de la fuente" };
  if (l.motivo === "error" || l.motivo === "tiempo") {
    racha.errores++;
    if (racha.errores >= ERRORES_SEGUIDOS_FUSIBLE) return { motivo: "errores", detalle: `${racha.errores} fichas seguidas en error o sin respuesta` };
    return null;
  }
  racha.errores = 0;
  if (l.motivo === "publicado") {
    if (l.publicador) racha.sinPublicador = 0;
    else if (++racha.sinPublicador >= SIN_PUBLICADOR_SEGUIDAS_FUSIBLE) return { motivo: "sin-publicador", detalle: `${racha.sinPublicador} fichas publicadas seguidas sin publicador` };
  }
  return null;
}

/** Una corrida del relleno: un lote, en orden de prioridad, hasta el tope por hora o el fusible. */
export async function correrRelleno(deps: DepsRelleno, lote: number = LOTE_RELLENO): Promise<ResumenRelleno> {
  const r: ResumenRelleno = { estado: "completo", leidas: 0, conPublicador: 0, despublicadas: 0, inscripciones: 0, fusible: null };
  if (await deps.fusible()) return { ...r, estado: "detenido" };
  const lista = await deps.candidatos(lote);
  if (!lista.length) return { ...r, estado: "sin-candidatos" };
  const racha = { errores: 0, sinPublicador: 0 };
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) await deps.esperar(PAUSA_ENTRE_FICHAS_MS);
    const c = lista[i];
    const l = await deps.leer(c);
    if (!l.leida) {
      if (l.razon === "tope") return { ...r, estado: "tope" };
      continue;
    }
    r.leidas++;
    if (c.prioridad === 0) r.inscripciones++;
    if (l.motivo === "despublicado") r.despublicadas++;
    if (l.motivo === "publicado" && l.publicador) r.conPublicador++;
    const f = evaluarFusible(l, racha);
    if (f) {
      await deps.saltarFusible(f.motivo, f.detalle, new Date(deps.ahora().getTime() + PAUSA_FUSIBLE_MS));
      return { ...r, estado: "fusible", fusible: f };
    }
  }
  return r;
}
