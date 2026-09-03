/**
 * Estado del pase semanal de TocToc para /admin/operacion, leído del
 * checkpoint que /api/data/backfill-toctoc deja en `config`.
 *
 * CONVIVE CON CRONS_VIGILADOS. Desde el 04-sep-2026 el backfill también late
 * en cron-heartbeat.ts, pero el latido genérico solo dice "el cron se ejecutó";
 * del backfill importa más QUÉ hizo: si el pase cerró completo, cuántas filas
 * escribió por operación y cuántas desactivó en la Fase C. Todo eso está en el
 * checkpoint, así que esta tarjeta se lee de ahí y no se duplica en metrics_daily.
 *
 * La lectura del estado es pura y se testea en scripts/test-admin-operacion.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIG_KEY_CHECKPOINT,
  OPERACIONES,
  parsearCheckpoint,
  paseCompleto,
  type CheckpointBackfill,
} from "@/lib/services/scraper/backfill-plan";

/**
 * El cron corre los lunes a las 03:00 UTC (vercel.json) y un pase completo
 * tarda 2-3 minutos. Umbral de atraso: 8 días, no 2× el intervalo como en
 * cron-heartbeat. Ahí el 2× absorbe el jitter de minutos de Vercel; acá el
 * jitter es el mismo, pero 2× serían 14 días — dos semanas ciegos por una
 * corrida que se perdió el lunes. Con 8 días, el martes siguiente ya se sabe.
 */
export const DIAS_ATRASO_PASE = 8;

export interface EstadoPase {
  estado: "ok" | "warn" | "error";
  /** Una línea para la pastilla y el título de la tarjeta. */
  resumen: string;
  /** true si pasaron más de DIAS_ATRASO_PASE días (o no hay fecha). */
  atrasado: boolean;
  pase: string | null;
  /** Cuándo terminó la última operación; si el pase está a medias, la última
   *  actualización del checkpoint. */
  fecha: string | null;
  dias: number | null;
  completo: boolean;
  filas: { venta: number; arriendo: number; total: number };
  nuevas: number;
  /** Filas que la Fase C puso en is_active = false. null = no desactivó. */
  desactivadas: number | null;
  forzada: boolean;
  /** Motivo por el que la salvaguarda omitió la desactivación, si lo hizo. */
  omitida: string | null;
  errores: string[];
}

function diasEntre(desde: string | null, ahora: Date): number | null {
  if (!desde) return null;
  const ms = ahora.getTime() - new Date(desde).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / (1000 * 60 * 60 * 24)) : null;
}

export function estadoPase(cp: CheckpointBackfill | null, ahora: Date = new Date()): EstadoPase {
  if (!cp) {
    return {
      estado: "error",
      resumen: "sin checkpoint",
      atrasado: true,
      pase: null,
      fecha: null,
      dias: null,
      completo: false,
      filas: { venta: 0, arriendo: 0, total: 0 },
      nuevas: 0,
      desactivadas: null,
      forzada: false,
      omitida: null,
      errores: [],
    };
  }

  const venta = cp.operaciones.venta?.filas ?? 0;
  const arriendo = cp.operaciones.arriendo?.filas ?? 0;
  const nuevas = OPERACIONES.reduce((a, op) => a + (cp.operaciones[op]?.nuevas ?? 0), 0);
  const completo = paseCompleto(cp);

  const terminados = OPERACIONES.map((op) => cp.operaciones[op]?.terminadoEn ?? null)
    .filter((t): t is string => !!t)
    .sort();
  const fecha = completo && terminados.length ? terminados[terminados.length - 1] : cp.actualizadoEn || null;
  const dias = diasEntre(fecha, ahora);

  const desactivadas = cp.desactivacion?.filas ?? null;
  const forzada = cp.desactivacion?.forzada === true;
  const omitida = cp.desactivacionOmitida ?? null;
  const atrasado = dias === null || dias > DIAS_ATRASO_PASE;

  let estado: EstadoPase["estado"];
  let resumen: string;
  if (atrasado) {
    estado = "error";
    resumen = dias === null ? "sin fecha" : `atrasado · ${dias} d sin pase`;
  } else if (!completo && cp.errores.length > 0) {
    estado = "error";
    resumen = `incompleto · ${cp.errores.length} error${cp.errores.length === 1 ? "" : "es"}`;
  } else if (!completo) {
    estado = "warn";
    resumen = "a medias";
  } else if (desactivadas === null && omitida) {
    estado = "warn";
    resumen = "completo · desactivación omitida";
  } else {
    estado = "ok";
    resumen = desactivadas === null ? "completo" : `completo · desactivó ${desactivadas}`;
  }

  return {
    estado,
    resumen,
    atrasado,
    pase: cp.pase,
    fecha,
    dias,
    completo,
    filas: { venta, arriendo, total: venta + arriendo },
    nuevas,
    desactivadas,
    forzada,
    omitida,
    errores: cp.errores,
  };
}

/** Lee el checkpoint de `config`. Nunca lanza: sin fila o JSON raro = null. */
export async function leerCheckpointBackfill(sb: SupabaseClient): Promise<CheckpointBackfill | null> {
  const { data, error } = await sb.from("config").select("value").eq("key", CONFIG_KEY_CHECKPOINT).maybeSingle();
  if (error) {
    console.error("[admin-backfill-toctoc] leer checkpoint:", error);
    return null;
  }
  return parsearCheckpoint((data?.value as string | null | undefined) ?? null);
}
