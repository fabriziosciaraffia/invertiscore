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
  /** Activas del universo (toctoc, usado + arriendo) medidas AL INICIO del pase
   *  (checkpoint.activasAlInicio); null si el pase venía de antes de esa medición. */
  activasAntes: number | null;
  /** true si se saltó la salvaguarda de proporción con ?forzarDesactivacion=1. */
  forzada?: boolean;
}

export interface CheckpointBackfill {
  pase: string;
  iniciadoEn: string;
  actualizadoEn: string;
  operaciones: Partial<Record<OperacionBackfill, EstadoOperacion>>;
  /** Errores acumulados del pase (upserts fallidos, páginas sin respuesta). */
  errores: string[];
  /**
   * Activas del universo (toctoc, usado + arriendo) medidas AL INICIO del pase,
   * antes del primer upsert. Es el denominador de la salvaguarda de proporción:
   * medirlo después infla el denominador con las filas nuevas del propio pase
   * (corrida real p20260902T223350Z-2aqb: 35.382 sobre 74.482 = 0,48 post-upsert
   * vs 0,67 sobre las 52.674 que había antes). null en pases anteriores a esta
   * medición.
   */
  activasAlInicio?: number | null;
  /** Presente cuando el pase completo ya desactivó lo que no vio (una sola vez por pase). */
  desactivacion?: DesactivacionPase | null;
  /** Motivo por el que la desactivación se omitió (salvaguarda). NO es un error
   *  del pase: el pase sigue completo y se puede reintentar con ?reanudar=1
   *  (y ?forzarDesactivacion=1 si corresponde). */
  desactivacionOmitida?: string | null;
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

/** Prefijo con que la versión anterior anotaba la salvaguarda dentro de `errores`. */
export const PREFIJO_OMITIDA = "desactivación omitida:";

/** Lee el JSON del checkpoint con tolerancia: cualquier cosa rara es null. */
export function parsearCheckpoint(value: string | null | undefined): CheckpointBackfill | null {
  if (!value) return null;
  try {
    const cp = JSON.parse(value) as Partial<CheckpointBackfill>;
    if (typeof cp?.pase !== "string" || typeof cp.operaciones !== "object" || cp.operaciones === null) return null;
    // Compatibilidad: la primera versión anotaba la salvaguarda como error
    // ("desactivación omitida: …"), lo que dejaba el pase como incompleto y sin
    // forma de reintentar. Se migra al campo propio.
    const erroresCrudos = Array.isArray(cp.errores) ? cp.errores.map(String) : [];
    const omitidas = erroresCrudos.filter((e) => e.startsWith(PREFIJO_OMITIDA));
    const errores = erroresCrudos.filter((e) => !e.startsWith(PREFIJO_OMITIDA));
    return {
      pase: cp.pase,
      iniciadoEn: typeof cp.iniciadoEn === "string" ? cp.iniciadoEn : "",
      actualizadoEn: typeof cp.actualizadoEn === "string" ? cp.actualizadoEn : "",
      operaciones: cp.operaciones,
      errores,
      activasAlInicio: typeof cp.activasAlInicio === "number" ? cp.activasAlInicio : null,
      desactivacion: cp.desactivacion && typeof cp.desactivacion === "object" ? cp.desactivacion : null,
      desactivacionOmitida:
        typeof cp.desactivacionOmitida === "string"
          ? cp.desactivacionOmitida
          : omitidas.length
            ? omitidas[omitidas.length - 1].slice(PREFIJO_OMITIDA.length).trim()
            : null,
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

/**
 * `activasAntes` es el conteo AL INICIO del pase (checkpoint.activasAlInicio).
 * null = el pase no lo midió (checkpoint anterior a esa medición): la proporción
 * no se puede evaluar y NO se desactiva, salvo `forzar`.
 *
 * `forzar` (?forzarDesactivacion=1) salta SOLO esta salvaguarda de proporción.
 * Las demás —pase completo, ambas operaciones, cero errores, universo no
 * vacío— las decide paseCompleto() en la ruta y no se pueden saltar.
 */
export function debeDesactivar(opts: {
  escritasPase: number;
  activasAntes: number | null;
  forzar?: boolean;
}): { ok: boolean; motivo: string; forzada: boolean } {
  const { escritasPase, activasAntes, forzar = false } = opts;
  const razon = activasAntes && activasAntes > 0 ? escritasPase / activasAntes : null;
  const detalle = activasAntes === null
    ? `escribió ${escritasPase}; sin activasAlInicio en el checkpoint`
    : `escribió ${escritasPase} sobre ${activasAntes} activas al inicio (${razon === null ? "—" : razon.toFixed(2)})`;
  if (forzar) return { ok: true, forzada: true, motivo: `FORZADA por parámetro, salvaguarda de proporción omitida: ${detalle}` };
  if (activasAntes === null) {
    return { ok: false, forzada: false, motivo: `${detalle}: no se puede evaluar la proporción; usa forzarDesactivacion=1 si el pase es confiable` };
  }
  if (activasAntes === 0) return { ok: true, forzada: false, motivo: "no hay activas que desactivar" };
  if ((razon as number) < UMBRAL_PASE_MINIMO) {
    return { ok: false, forzada: false, motivo: `pase sospechosamente chico: ${detalle} < ${UMBRAL_PASE_MINIMO}` };
  }
  return { ok: true, forzada: false, motivo: detalle };
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
  /** Activas del universo medidas antes del primer upsert; solo la usa un pase nuevo. */
  activasAlInicio?: number | null;
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
  const cp: CheckpointBackfill = {
    pase,
    iniciadoEn: iso,
    actualizadoEn: iso,
    operaciones: {},
    errores: [],
    activasAlInicio: opts.activasAlInicio ?? null,
    desactivacion: null,
    desactivacionOmitida: null,
  };
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
