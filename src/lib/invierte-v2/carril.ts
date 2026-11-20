// ─────────────────────────────────────────────────────────────────────────────
// EL CARRIL DE INVIERTE (etapa 2, entrega 2, 18-nov-2026; aprobado por Fabrizio). Las lecturas de la ficha que hace el flujo
// nuevo —al elegir un depto, al abrir uno que no estaba preparado y la relectura de la noche— van por un carril propio:
//   · SU TOPE: TOPE_CARRIL_POR_HORA pedidos a la ficha por hora (cada chequeo son hasta dos: la ficha vieja y la nueva), contados
//     en SU bitácora (`lecturas_invierte`). El tope de 30 por hora de las personas del mapa (`lecturas_ficha`) no lo ve ni lo gasta.
//   · LA MEMORIA: un depto leído hace menos de RELECTURA_MS no se vuelve a leer (abrir lo ya preparado no lee nada).
//   · EL FUSIBLE: un bloqueo (403/429/desafío) o una respuesta rara (un 200 que no es la ficha) lo detienen PAUSA_FUSIBLE_CARRIL_MS;
//     mientras tanto no se lee y vale lo que se sabe.
//   · Y A DIFERENCIA DE LA GUÍA, lee también los que la memoria da por despublicados: así se sabe si volvieron a publicarse.
// Puro: la memoria, el fusible y la lectura se inyectan (el tier INVIERTE-V2-E2 lo prueba con dobles).
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoPublicacion, ResultadoLectura } from "@/lib/guia/publicacion";

/** Pedidos a la ficha por hora del carril (aprobado por Fabrizio, 18-nov-2026). */
export const TOPE_CARRIL_POR_HORA = 60;
/** Una relectura como mucho cada 24 horas por depto (aprobado por Fabrizio, 18-nov-2026). */
export const RELECTURA_MS = 24 * 60 * 60 * 1000;
export const PAUSA_FUSIBLE_CARRIL_MS = 6 * 60 * 60 * 1000;
export const CLAVE_FUSIBLE_CARRIL = "invierte_carril_fusible";

/** «firma» (el depto elegido, apenas se firma) y «resultado» (los deptos del resultado, apenas se muestran): 20-nov-2026, para que
 *  las fotos y «Lo que ve Franco» estén donde se decide. */
export type OrigenLectura = "elegir" | "abrir" | "noche" | "firma" | "resultado";

export const leidaFresca = (leidaAt: Date | null, ahora: Date): boolean => !!leidaAt && ahora.getTime() - leidaAt.getTime() < RELECTURA_MS;

export interface DepsCarril {
  /** Lo que se sabe: el estado guardado (publicacion_avisos) y cuándo leyó el carril por última vez este depto. */
  memoria(): Promise<{ estado: "publicado" | "despublicado" | null; leidaAt: Date | null }>;
  /** ¿El fusible está puesto? */
  fusible(): Promise<boolean>;
  saltarFusible(motivo: "bloqueo" | "rara", detalle: string): Promise<void>;
  /** Una lectura de la ficha con el tope del carril. */
  leer(): Promise<ResultadoLectura>;
}

export type SinLeer = "fresca" | "fusible" | "tope" | "sin-url";

export async function chequearPorCarril(d: DepsCarril, ahora: Date, opts: { forzar?: boolean } = {}): Promise<{ estado: EstadoPublicacion; lectura: ResultadoLectura | null; sinLeer: SinLeer | null }> {
  const mem = await d.memoria();
  const sabido: EstadoPublicacion = mem.estado ?? "sin-chequeo";
  if (!opts.forzar && leidaFresca(mem.leidaAt, ahora)) return { estado: sabido, lectura: null, sinLeer: "fresca" };
  if (await d.fusible()) return { estado: sabido, lectura: null, sinLeer: "fusible" };
  const l = await d.leer();
  if (!l.leida) return { estado: sabido, lectura: l, sinLeer: l.razon };
  if (l.motivo === "bloqueo") await d.saltarFusible("bloqueo", `código ${l.codigo ?? "-"}`);
  else if (l.motivo === "publicado" && l.rara) await d.saltarFusible("rara", "un 200 que no es la ficha");
  if ((l.motivo === "publicado" && !l.rara) || l.motivo === "despublicado") return { estado: l.motivo, lectura: l, sinLeer: null };
  return { estado: sabido, lectura: l, sinLeer: null };
}
