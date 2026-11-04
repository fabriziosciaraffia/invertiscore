// ─────────────────────────────────────────────────────────────────────────────
// «Analizar este» cobra UN crédito por persona y aviso, aunque haya doble clic, dos pestañas o un
// reintento después de una falla (30-sep-2026). La fila de `guia_analisis` (clave: persona + aviso) es
// el candado:
//   · el primero que la inserta sigue; el que la encuentra con informe, recibe ese informe; el que la
//     encuentra reciente sin informe, espera («en curso»);
//   · el cobro queda anotado en la fila (`cobrado_at`) ANTES de crear el informe, para que un segundo clic no cobre;
//   · si la creación FALLA, el crédito se DEVUELVE en el acto y la fila se suelta (04-nov-2026, auditoría de promesas:
//     «nunca queda un crédito gastado sin informe»): el reintento empieza de cero y cobra una vez. Una fila cobrada sin
//     informe que quedó de una solicitud cortada a mitad (sin catch que devuelva) la retoma el reintento pasado
//     RECLAMO_VIGENTE_MS —crea sin volver a cobrar, y si vuelve a fallar devuelve según el `charge_mode` guardado— o la
//     devuelve el reconciliador diario (cron/reconciliar-pagos);
//   · si el cobro no pasa (sin análisis disponibles), la fila se suelta y no queda nada cobrado.
// Puro: las piezas se inyectan (el tier lo prueba con dobles y cuenta los cobros).
//
// Y ANTES DE TODO, LA RED (01-oct-2026): la ficha se chequea de nuevo al tocar «Analizar este». Si el
// aviso se despublicó, no se reclama, no se cobra ni se prepara nada (`analizarAvisoDeGuia`).
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoPublicacion } from "./publicacion";
import { devolucionDesdeModo, type Devolucion } from "@/lib/access-devolucion";

export const RECLAMO_VIGENTE_MS = 120_000;

export type Reclamo =
  | { nueva: true }
  | { nueva: false; analysisId: string | null; cobrado: boolean; chargeMode: string | null; reclamadoHaceMs: number };

export interface PiezasAnalizar {
  reclamar(): Promise<Reclamo>;
  /** Retoma una fila vieja sin informe; true si esta llamada la ganó. */
  retomar(): Promise<boolean>;
  cobrar(): Promise<{ ok: true; mode: string; devolucion: Devolucion } | { ok: false; status: number; error: string }>;
  /** Devuelve el crédito de un cobro cuyo informe no se creó (access.ts › devolverCobro). */
  devolver(d: Devolucion): Promise<void>;
  marcarCobrado(mode: string): Promise<void>;
  crear(mode: string): Promise<{ id: string }>;
  marcarCreado(id: string): Promise<void>;
  soltar(): Promise<void>;
}

export type ResultadoAnalizar =
  | { estado: "creado" | "ya-creado"; id: string }
  | { estado: "en-curso" }
  | { estado: "sin-cobro"; status: number; error: string }
  /** La creación falló: el crédito volvió y la fila quedó suelta. `error` va a Sentry. */
  | { estado: "fallo"; error: unknown };

/**
 * «Analizar este» de punta a punta: chequear la ficha → si se despublicó, avisar y parar (sin crédito)
 * → preparar el informe (antigüedad, body, plausibilidad) → cobrar una vez y crear.
 */
export async function analizarAvisoDeGuia(p: {
  chequear(): Promise<EstadoPublicacion>;
  alDespublicar(): Promise<void>;
  preparar(): Promise<{ ok: true; piezas: PiezasAnalizar } | { ok: false; status: number; error: string }>;
}): Promise<ResultadoAnalizar | { estado: "despublicado" } | { estado: "sin-preparar"; status: number; error: string }> {
  if ((await p.chequear()) === "despublicado") {
    await p.alDespublicar();
    return { estado: "despublicado" };
  }
  const prep = await p.preparar();
  if (!prep.ok) return { estado: "sin-preparar", status: prep.status, error: prep.error };
  return analizarUnaVez(prep.piezas);
}

export async function analizarUnaVez(p: PiezasAnalizar): Promise<ResultadoAnalizar> {
  const r = await p.reclamar();
  let cobrado = false;
  let mode: string | null = null;
  let devolucion: Devolucion | null = null;
  if (!r.nueva) {
    if (r.analysisId) return { estado: "ya-creado", id: r.analysisId };
    if (r.reclamadoHaceMs < RECLAMO_VIGENTE_MS) return { estado: "en-curso" };
    if (!(await p.retomar())) return { estado: "en-curso" };
    cobrado = r.cobrado;
    mode = r.chargeMode;
    // Cobrado en otra solicitud: de ese cobro solo quedó el modo.
    if (cobrado) devolucion = devolucionDesdeModo(mode);
  }
  if (!cobrado) {
    const c = await p.cobrar();
    if (!c.ok) {
      await p.soltar();
      return { estado: "sin-cobro", status: c.status, error: c.error };
    }
    mode = c.mode;
    devolucion = c.devolucion;
    await p.marcarCobrado(mode);
  }
  let id: string;
  try {
    ({ id } = await p.crear(mode ?? "paid"));
  } catch (error) {
    // Sin informe no queda crédito gastado: vuelve, y la fila se suelta para que el reintento empiece de cero.
    if (devolucion) await p.devolver(devolucion);
    await p.soltar();
    return { estado: "fallo", error };
  }
  await p.marcarCreado(id);
  return { estado: "creado", id };
}
