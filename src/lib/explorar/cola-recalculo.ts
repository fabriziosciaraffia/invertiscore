// ─────────────────────────────────────────────────────────────────────────────
// LA COLA DEL RECÁLCULO EN EL NAVEGADOR (04-nov-2026, goal de Fabrizio después de la caída de la base del 04-nov): con otra tasa,
// otro pie u otro plazo, Explorar pide las comunas DE A UNA, y la siguiente sale cuando la anterior respondió —el servidor
// responde después de guardar (turnos-recalculo.ts), así que la siguiente empieza cuando terminó el guardado de la anterior—.
// Si el servidor dice «ocupado» (los dos turnos del sitio están tomados), se espera y se pide la misma comuna de nuevo, y el
// pop-up lo dice: «Franco está ocupado con otro cálculo, un momento…». Si dice «pausado» (el fusible: la base viene lenta), la
// cola para y el pop-up ofrece ver el mapa con la tasa del mes (respaldoDelFusible) en vez de esperar. Puro: sin React.
// ─────────────────────────────────────────────────────────────────────────────
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { PIES_NEGOCIAR } from "./capa-negociar";
import type { FiltrosPortal } from "./portal";

export type EstadoRecalculo = "calculando" | "ocupado" | "pausado";
export interface AvanceRecalculo { hechas: number; total: number; estado: EstadoRecalculo }

/** Lo que contestó el servidor por una comuna. */
export type RespuestaDeComuna<T> = { tipo: "ok"; datos: T } | { tipo: "ocupado" } | { tipo: "pausado" } | { tipo: "error" };

/** Cuánto se espera antes de volver a pedir una comuna cuando el sitio está ocupado. */
export const ESPERA_OCUPADO_MS = 3_000;
/** Cuántas veces se espera por la misma comuna (unos dos minutos) antes de darla por perdida. */
export const MAX_ESPERAS_POR_COMUNA = 40;

/** La respuesta de GET /api/explorar (o de /negociar) para una comuna: 503 con `error: "ocupado" | "pausado"` es esperar o parar. */
export async function respuestaDeComuna<T>(res: Response): Promise<RespuestaDeComuna<T>> {
  if (res.ok) return { tipo: "ok", datos: (await res.json()) as T };
  if (res.status === 503) {
    const d = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (d?.error === "ocupado") return { tipo: "ocupado" };
    if (d?.error === "pausado") return { tipo: "pausado" };
  }
  return { tipo: "error" };
}

/** Las comunas, de a una. Devuelve las que no llegaron y si la cola paró por el fusible (las que faltaban van en `perdidas`). */
export async function recalcularEnCola<T>(o: {
  comunas: readonly string[];
  pedir: (comuna: string) => Promise<RespuestaDeComuna<T>>;
  alListo: (comuna: string, datos: T) => void;
  alAvance: (a: AvanceRecalculo) => void;
  esperar?: (ms: number) => Promise<void>;
  /** false si la página se fue: la cola para sin avisar nada. */
  vivo?: () => boolean;
}): Promise<{ perdidas: string[]; pausado: boolean }> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const total = o.comunas.length;
  const perdidas: string[] = [];
  let hechas = 0;
  o.alAvance({ hechas, total, estado: "calculando" });
  for (let i = 0; i < total; i++) {
    const comuna = o.comunas[i];
    for (let esperas = 0; ; esperas++) {
      if (o.vivo && !o.vivo()) return { perdidas: [...perdidas, ...o.comunas.slice(i)], pausado: false };
      let r: RespuestaDeComuna<T>;
      try { r = await o.pedir(comuna); } catch { r = { tipo: "error" }; }
      if (r.tipo === "ocupado" && esperas < MAX_ESPERAS_POR_COMUNA) {
        o.alAvance({ hechas, total, estado: "ocupado" });
        await esperar(ESPERA_OCUPADO_MS);
        continue;
      }
      if (r.tipo === "pausado") {
        o.alAvance({ hechas, total, estado: "pausado" });
        return { perdidas: [...perdidas, ...o.comunas.slice(i)], pausado: true };
      }
      if (r.tipo === "ok") o.alListo(comuna, r.datos);
      else perdidas.push(comuna);
      break;
    }
    hechas++;
    o.alAvance({ hechas, total, estado: "calculando" });
  }
  return { perdidas, pausado: false };
}

/** EL RESPALDO DEL FUSIBLE: la vista que no calcula nada —la tasa del mes y, si hace falta, el pie y el plazo de la noche—, con
 *  el texto del botón. Renta corta no tiene respaldo (siempre se calcula): el pop-up ofrece ver lo que ya cargó. */
export function respaldoDelFusible(f: FiltrosPortal): { filtros: FiltrosPortal; etiqueta: string } | null {
  if (f.modalidad !== "ltr") return null;
  const pie = ((PIES_NEGOCIAR as readonly number[]).includes(f.pie) ? f.pie : PIE_POR_DEFECTO) as FiltrosPortal["pie"];
  const plazo = PLAZO_POR_DEFECTO as FiltrosPortal["plazo"];
  if (f.tasa == null && pie === f.pie && plazo === f.plazo) return null;
  const etiqueta = pie === f.pie && plazo === f.plazo ? "Ver con la tasa del mes"
    : f.tasa != null ? `Ver con la tasa del mes, pie ${pie} % y ${plazo} años`
    : `Ver con pie ${pie} % y ${plazo} años`;
  return { filtros: { ...f, tasa: null, pie, plazo }, etiqueta };
}
