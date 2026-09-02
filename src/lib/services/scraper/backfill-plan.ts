// ─── Plan y checkpoint del backfill de TocToc ────────────────────────────────
//
// Lógica PURA (sin red ni DB) de /api/data/backfill-toctoc: qué operaciones
// recorrer, desde qué página, y bajo qué id de pase. Vive aparte para poder
// testearla sin levantar la ruta (scripts/test-backfill-plan.ts).
//
// EL PASE. Un pase es un recorrido completo del universo (venta usada +
// arriendo). Cada fila que el pase escribe recibe `seen_pass_id = pase`; al
// terminar un pase completo y sin errores, lo que NO lleva ese id se desactiva
// (Fase C). Por eso reanudar tiene que conservar el id: si un corte a mitad de
// camino arrancara un pase nuevo, la mitad ya escrita quedaría con el id viejo
// y la desactivación la mataría.
//
// EL CHECKPOINT vive en `config` (key CONFIG_KEY_CHECKPOINT, value JSON) y se
// actualiza después de CADA página upserteada, así un corte por tiempo o por
// error deja un punto exacto desde donde seguir.

export type OperacionBackfill = "venta" | "arriendo";

export const OPERACIONES: OperacionBackfill[] = ["venta", "arriendo"];

export const CONFIG_KEY_CHECKPOINT = "backfill_toctoc_checkpoint";

export interface EstadoOperacion {
  /** Universo según la fuente (resultados.Total) en la última página vista. */
  total: number | null;
  /** Última página upserteada con éxito (0 = ninguna). */
  ultimaPagina: number;
  /** Filas escritas acumuladas en este pase. */
  filas: number;
  /** Filas que no existían antes del pase (created_at dentro de la corrida). */
  nuevas: number;
  /** true cuando la última página cubrió el total. */
  completa: boolean;
  terminadoEn: string | null;
}

export interface DesactivacionPase {
  en: string;
  pase: string;
  /** Filas que pasaron a is_active = false. */
  filas: number;
  /** Activas del universo (toctoc, usado + arriendo) antes de desactivar. */
  activasAntes: number;
}

export interface CheckpointBackfill {
  pase: string;
  iniciadoEn: string;
  actualizadoEn: string;
  operaciones: Partial<Record<OperacionBackfill, EstadoOperacion>>;
  /** Errores acumulados del pase (upserts fallidos, páginas sin respuesta). */
  errores: string[];
  /** Presente cuando el pase completo ya desactivó lo que no vio (una sola vez por pase). */
  desactivacion?: DesactivacionPase | null;
}

export interface Tramo {
  operacion: OperacionBackfill;
  desdePagina: number;
}

export interface PlanBackfill {
  pase: string;
  checkpoint: CheckpointBackfill;
  tramos: Tramo[];
  /** Por qué se armó así, para el log. */
  motivo: string;
}

/** Id de pase legible y único: fecha compacta + sufijo aleatorio. */
export function nuevoPaseId(ahora: Date = new Date(), aleatorio: string = Math.random().toString(36).slice(2, 6)): string {
  const iso = ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `p${iso}-${aleatorio}`;
}

/** `?operacion=` → lista de operaciones. Vacío o ausente = ambas. */
export function parsearOperacion(raw: string | null | undefined): OperacionBackfill[] | null {
  if (!raw || raw === "ambas") return [...OPERACIONES];
  if (raw === "venta" || raw === "arriendo") return [raw];
  return null;
}

export function estadoVacio(): EstadoOperacion {
  return { total: null, ultimaPagina: 0, filas: 0, nuevas: 0, completa: false, terminadoEn: null };
}

/** Un pase está completo cuando las DOS operaciones terminaron sin errores. */
export function paseCompleto(cp: CheckpointBackfill | null): boolean {
  if (!cp || cp.errores.length > 0) return false;
  return OPERACIONES.every((op) => cp.operaciones[op]?.completa === true);
}

/** Lee el JSON del checkpoint con tolerancia: cualquier cosa rara es null. */
export function parsearCheckpoint(value: string | null | undefined): CheckpointBackfill | null {
  if (!value) return null;
  try {
    const cp = JSON.parse(value) as Partial<CheckpointBackfill>;
    if (typeof cp?.pase !== "string" || typeof cp.operaciones !== "object" || cp.operaciones === null) return null;
    return {
      pase: cp.pase,
      iniciadoEn: typeof cp.iniciadoEn === "string" ? cp.iniciadoEn : "",
      actualizadoEn: typeof cp.actualizadoEn === "string" ? cp.actualizadoEn : "",
      operaciones: cp.operaciones,
      errores: Array.isArray(cp.errores) ? cp.errores.map(String) : [],
      desactivacion: cp.desactivacion && typeof cp.desactivacion === "object" ? cp.desactivacion : null,
    };
  } catch {
    return null;
  }
}

// ─── Desactivación (Fase C) ──────────────────────────────────────────────────
//
// Al cerrar un pase COMPLETO (las dos operaciones, cero errores) se desactiva
// todo lo que el pase no vio: source = 'toctoc', universo usado + arriendo,
// activas, con seen_pass_id DISTINTO del pase — incluidas las que tienen
// seen_pass_id NULL (las escribió el pase diario y la fuente ya no las lista).
// SIN filtro de comuna: el viewport trae también comunas fuera del roster y
// esas filas se mantienen con la misma regla.
//
// `IS DISTINCT FROM`, no `<>`: en SQL `NULL <> 'x'` es NULL y dejaría vivas
// para siempre las filas sin pase (misma trampa que el cron expire-grace). En
// PostgREST se escribe como `or(seen_pass_id.is.null,seen_pass_id.neq.<pase>)`.
//
// Una segunda fuente futura tiene su propio pase y su propia desactivación: el
// `source = 'toctoc'` es explícito a propósito.

/**
 * Builder de filtros de supabase-js (`eq`, `in`, `or`). Va como `any` a
 * propósito: tiparlo con un genérico auto-referente sobre PostgrestFilterBuilder
 * hace que tsc caiga en "type instantiation is excessively deep". Los tests lo
 * ejercitan con un builder falso que registra las llamadas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFiltrable = any;

/** El id de pase viaja dentro de un filtro `or` de PostgREST: solo [A-Za-z0-9-]. */
export function validarPaseId(pase: string): void {
  if (!/^[A-Za-z0-9-]+$/.test(pase)) throw new Error(`pase inválido para filtro PostgREST: ${pase}`);
}

/** Universo que el pase mantiene: toctoc, venta usada + arriendo, activas. */
export function aplicarFiltrosUniverso(q: QueryFiltrable): QueryFiltrable {
  return q
    .eq("source", "toctoc")
    .in("type", [...OPERACIONES])
    .or("condicion.is.null,condicion.eq.usado")
    .eq("is_active", true);
}

/** Universo + "no vista por este pase" (seen_pass_id IS DISTINCT FROM pase). */
export function aplicarFiltrosDesactivacion(q: QueryFiltrable, pase: string): QueryFiltrable {
  validarPaseId(pase);
  return aplicarFiltrosUniverso(q).or(`seen_pass_id.is.null,seen_pass_id.neq.${pase}`);
}

/**
 * Salvaguarda de tamaño: un pase que escribió MENOS de esta fracción de las
 * activas actuales no desactiva nada. Un pase parcial ya no llega acá (exige
 * completo y sin errores); esto cubre a la fuente devolviendo un universo
 * recortado con status 200. Medido 02-sep-2026: el primer pase escribe ~35 mil
 * sobre ~52 mil activas (0,67); los semanales rondan 0,95.
 */
export const UMBRAL_PASE_MINIMO = 0.5;

export function debeDesactivar(opts: { escritasPase: number; activasAntes: number }): { ok: boolean; motivo: string } {
  const { escritasPase, activasAntes } = opts;
  if (activasAntes === 0) return { ok: true, motivo: "no hay activas que desactivar" };
  const razon = escritasPase / activasAntes;
  if (razon < UMBRAL_PASE_MINIMO) {
    return {
      ok: false,
      motivo: `pase sospechosamente chico: escribió ${escritasPase} sobre ${activasAntes} activas (${razon.toFixed(2)} < ${UMBRAL_PASE_MINIMO})`,
    };
  }
  return { ok: true, motivo: `escribió ${escritasPase} sobre ${activasAntes} activas (${razon.toFixed(2)})` };
}

/**
 * Decide el plan. Tres modos, excluyentes:
 *  · nuevo pase (default): id nuevo, todas las operaciones pedidas desde la 1.
 *  · `desde` (una sola operación): reanuda el pase del checkpoint desde esa
 *    página, la operación vuelve a "incompleta".
 *  · `reanudar`: reanuda el pase del checkpoint; cada operación pedida sigue
 *    desde su última página + 1 y las ya completas se saltan.
 */
export function planificar(opts: {
  operaciones: OperacionBackfill[];
  desde: number | null;
  reanudar: boolean;
  checkpoint: CheckpointBackfill | null;
  ahora: Date;
  paseId?: string;
}): PlanBackfill | { error: string } {
  const { operaciones, desde, reanudar, checkpoint, ahora } = opts;
  const iso = ahora.toISOString();

  if (desde !== null) {
    if (!Number.isInteger(desde) || desde < 1) return { error: "desde debe ser un entero >= 1" };
    if (operaciones.length !== 1) return { error: "desde= exige una sola operacion (venta o arriendo), no ambas" };
    if (!checkpoint) return { error: "no hay pase que reanudar: falta el checkpoint en config" };
    if (reanudar) return { error: "desde= y reanudar=1 son excluyentes" };
    const op = operaciones[0];
    const prev = checkpoint.operaciones[op] ?? estadoVacio();
    const cp: CheckpointBackfill = {
      ...checkpoint,
      actualizadoEn: iso,
      operaciones: {
        ...checkpoint.operaciones,
        [op]: { ...prev, ultimaPagina: Math.max(0, desde - 1), completa: false, terminadoEn: null },
      },
    };
    return {
      pase: checkpoint.pase,
      checkpoint: cp,
      tramos: [{ operacion: op, desdePagina: desde }],
      motivo: `reanuda pase ${checkpoint.pase}: ${op} desde la página ${desde}`,
    };
  }

  if (reanudar) {
    if (!checkpoint) return { error: "no hay pase que reanudar: falta el checkpoint en config" };
    const tramos: Tramo[] = [];
    const saltadas: string[] = [];
    for (const op of operaciones) {
      const est = checkpoint.operaciones[op];
      if (est?.completa) {
        saltadas.push(op);
        continue;
      }
      tramos.push({ operacion: op, desdePagina: (est?.ultimaPagina ?? 0) + 1 });
    }
    return {
      pase: checkpoint.pase,
      checkpoint: { ...checkpoint, actualizadoEn: iso },
      tramos,
      motivo: `reanuda pase ${checkpoint.pase}: ${tramos.map((t) => `${t.operacion} desde ${t.desdePagina}`).join(", ") || "nada pendiente"}${saltadas.length ? ` (ya completas: ${saltadas.join(", ")})` : ""}`,
    };
  }

  const pase = opts.paseId ?? nuevoPaseId(ahora);
  const cp: CheckpointBackfill = { pase, iniciadoEn: iso, actualizadoEn: iso, operaciones: {}, errores: [] };
  for (const op of operaciones) cp.operaciones[op] = estadoVacio();
  return {
    pase,
    checkpoint: cp,
    tramos: operaciones.map((operacion) => ({ operacion, desdePagina: 1 })),
    motivo: checkpoint && !paseCompleto(checkpoint)
      ? `pase nuevo ${pase}; el anterior (${checkpoint.pase}) quedó incompleto y se abandona`
      : `pase nuevo ${pase}`,
  };
}
