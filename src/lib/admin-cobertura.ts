/**
 * Cobertura de `scraped_properties` para /admin/operacion: activas por comuna
 * y tipo, antigüedad del último scrape y filas sin coordenadas.
 *
 * POR QUÉ UNA RPC. La versión anterior traía todas las activas a JS
 * (`select comuna, type, scraped_at`) y contaba acá. Sin `.limit`, PostgREST
 * devuelve como máximo 1.000 filas, así que la tabla sumaba 1.000 propiedades
 * mientras la pastilla "Propiedades" —un `count` con `head: true`, que no pasa
 * por ese tope— decía 44.798. Las dos cifras solo pueden coincidir si el
 * conteo se hace en la base. La función vive en docs/sql/admin-panel-rpcs.sql
 * y se aplica a mano (mismo criterio que admin_overview).
 *
 * El plegado a "roster + otras" es lógica pura y se testea en
 * scripts/test-admin-operacion.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";

export const RPC_COBERTURA = "admin_cobertura_scraped";

/** Fila cruda de la RPC: una por comuna tal como está escrita en la tabla. */
export interface CoberturaRpcRow {
  comuna: string;
  venta_usada: number;
  arriendo: number;
  obra_nueva: number;
  sin_coords: number;
  /** max(scraped_at) de las activas de la comuna; null si no hay ninguna. */
  ultimo: string | null;
}

export interface FilaCobertura {
  comuna: string;
  ventaUsada: number;
  arriendo: number;
  obraNueva: number;
  sinCoords: number;
  total: number;
  ultimo: string | null;
}

export interface FilaOtras extends FilaCobertura {
  /** Cuántas comunas fuera del roster quedaron agrupadas. */
  comunas: number;
}

export interface CoberturaPlegada {
  /** Una fila por comuna del roster, SIEMPRE las 25: la que no tiene activas
   *  sale en cero con `ultimo` null, que es justamente la que hay que ver. */
  roster: FilaCobertura[];
  /** Todo lo que no está en el roster, sumado. null si no hay nada afuera. */
  otras: FilaOtras | null;
  /** Suma de roster + otras: tiene que dar lo mismo que la pastilla. */
  total: FilaCobertura;
}

function filaVacia(comuna: string): FilaCobertura {
  return { comuna, ventaUsada: 0, arriendo: 0, obraNueva: 0, sinCoords: 0, total: 0, ultimo: null };
}

function sumar(acc: FilaCobertura, r: CoberturaRpcRow): FilaCobertura {
  const ventaUsada = acc.ventaUsada + r.venta_usada;
  const arriendo = acc.arriendo + r.arriendo;
  const obraNueva = acc.obraNueva + r.obra_nueva;
  return {
    comuna: acc.comuna,
    ventaUsada,
    arriendo,
    obraNueva,
    sinCoords: acc.sinCoords + r.sin_coords,
    total: ventaUsada + arriendo + obraNueva,
    ultimo: r.ultimo && (!acc.ultimo || r.ultimo > acc.ultimo) ? r.ultimo : acc.ultimo,
  };
}

/**
 * Pliega las filas de la RPC al roster. El match es por `nombre` exacto (con
 * acentos), que es como el scraper escribe `comuna`; verificado el 03-sep-2026
 * contra las 51 comunas distintas de la base.
 */
export function plegarCobertura(
  rows: readonly CoberturaRpcRow[],
  rosterNombres: readonly string[] = COMUNAS_ROSTER.map((c) => c.nombre)
): CoberturaPlegada {
  const porComuna = new Map<string, FilaCobertura>();
  for (const nombre of rosterNombres) porComuna.set(nombre, filaVacia(nombre));

  let otras: FilaOtras | null = null;
  let total = filaVacia("TOTAL");

  for (const r of rows) {
    total = sumar(total, r);
    const fila = porComuna.get(r.comuna);
    if (fila) {
      porComuna.set(r.comuna, sumar(fila, r));
    } else {
      const base: FilaOtras = otras ?? { ...filaVacia("Otras"), comunas: 0 };
      otras = { ...sumar(base, r), comunas: base.comunas + 1 };
    }
  }

  return { roster: Array.from(porComuna.values()), otras, total };
}

export type ResultadoCobertura =
  | { ok: true; rows: CoberturaRpcRow[] }
  /** `faltaRpc`: la función no existe en la base (docs/sql sin aplicar). */
  | { ok: false; faltaRpc: boolean; mensaje: string };

/**
 * Lee la cobertura. Nunca lanza: si la RPC no está aplicada, el panel tiene
 * que decirlo en vez de caerse entero (misma tolerancia que leerLatidos).
 */
export async function leerCobertura(sb: SupabaseClient): Promise<ResultadoCobertura> {
  const { data, error } = await sb.rpc(RPC_COBERTURA);
  if (error) {
    // PGRST202 = "Could not find the function" (schema cache de PostgREST);
    // 42883 = undefined_function de Postgres.
    const faltaRpc = ["PGRST202", "42883"].includes(error.code);
    if (!faltaRpc) console.error("[admin-cobertura] rpc error:", error);
    return { ok: false, faltaRpc, mensaje: error.message };
  }
  return { ok: true, rows: (data ?? []) as CoberturaRpcRow[] };
}
