// ─────────────────────────────────────────────────────────────────────────────
// «Analizar este» cobra UN crédito por persona y aviso, aunque haya doble clic, dos pestañas o un
// reintento después de una falla (30-sep-2026). La fila de `guia_analisis` (clave: persona + aviso) es
// el candado:
//   · el primero que la inserta sigue; el que la encuentra con informe, recibe ese informe; el que la
//     encuentra reciente sin informe, espera («en curso»);
//   · el cobro queda anotado en la fila (`cobrado_at`) ANTES de crear el informe: si la creación falla,
//     el reintento (pasado RECLAMO_VIGENTE_MS) retoma la fila y crea el informe SIN volver a cobrar;
//   · si el cobro no pasa (sin análisis disponibles), la fila se suelta y no queda nada cobrado.
// Puro: las piezas se inyectan (el tier lo prueba con dobles y cuenta los cobros).
//
// Y ANTES DE TODO, LA RED (01-oct-2026): la ficha se chequea de nuevo al tocar «Analizar este». Si el
// aviso se despublicó, no se reclama, no se cobra ni se prepara nada (`analizarAvisoDeGuia`).
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoPublicacion } from "./publicacion";

export const RECLAMO_VIGENTE_MS = 120_000;

export type Reclamo =
  | { nueva: true }
  | { nueva: false; analysisId: string | null; cobrado: boolean; chargeMode: string | null; reclamadoHaceMs: number };

export interface PiezasAnalizar {
  reclamar(): Promise<Reclamo>;
  /** Retoma una fila vieja sin informe; true si esta llamada la ganó. */
  retomar(): Promise<boolean>;
  cobrar(): Promise<{ ok: true; mode: string } | { ok: false; status: number; error: string }>;
  marcarCobrado(mode: string): Promise<void>;
  crear(mode: string): Promise<{ id: string }>;
  marcarCreado(id: string): Promise<void>;
  soltar(): Promise<void>;
}

export type ResultadoAnalizar =
  | { estado: "creado" | "ya-creado"; id: string }
  | { estado: "en-curso" }
  | { estado: "sin-cobro"; status: number; error: string };

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
  if (!r.nueva) {
    if (r.analysisId) return { estado: "ya-creado", id: r.analysisId };
    if (r.reclamadoHaceMs < RECLAMO_VIGENTE_MS) return { estado: "en-curso" };
    if (!(await p.retomar())) return { estado: "en-curso" };
    cobrado = r.cobrado;
    mode = r.chargeMode;
  }
  if (!cobrado) {
    const c = await p.cobrar();
    if (!c.ok) {
      await p.soltar();
      return { estado: "sin-cobro", status: c.status, error: c.error };
    }
    mode = c.mode;
    await p.marcarCobrado(mode);
  }
  const { id } = await p.crear(mode ?? "paid");
  await p.marcarCreado(id);
  return { estado: "creado", id };
}
