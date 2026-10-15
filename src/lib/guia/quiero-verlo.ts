// ─────────────────────────────────────────────────────────────────────────────
// «Quiero verlo» automático (01-oct-2026, decisión de Fabrizio): al tocar el botón, a la persona le
// llega al instante un correo con el aviso. Reglas, todas acá:
//   · ANTES DE MANDARLO SE CHEQUEA LA FICHA (publicacion.ts, con la memoria de 24 horas). Si ya no
//     está publicada, no sale nada y la pantalla lo dice; si no se pudo chequear, tampoco sale (la
//     persona puede intentar de nuevo).
//   · EL CORREO SALE UNA SOLA VEZ POR INTERÉS: se reclama la fila (`correo_enviado_at`) antes de
//     mandar; un segundo toque, una segunda pestaña o un reintento no lo repiten. Si el envío falla,
//     la fila se suelta y el siguiente toque lo intenta otra vez.
//   · Nada sale a hola@: el interés queda en `interes_avisos` y en PostHog.
// Puro: las piezas se inyectan (el tier GUIA-BUSQUEDA §10 lo prueba con dobles y cuenta los correos).
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoPublicacion } from "./publicacion";
import { readVeredicto } from "@/lib/results-helpers";

/**
 * Lo que «Quiero verlo» lee de un informe (15-oct-2026: también de renta corta): de qué aviso salió y lo que el correo
 * cuenta —el veredicto y el flujo— más lo que se guarda del interés. null: el informe no salió de un aviso. El flujo de
 * renta larga está en `metrics.flujoNetoMensual`; el de renta corta, en su escenario base.
 */
export function datosDeInformeDeAviso(an: { score?: unknown; results?: unknown; input_data?: unknown }): {
  avisoId: string; veredicto: string | null; score: number | null; flujo: number | null;
  perfil: { piePct: number | null; plazo: number | null; tasa: number | null; amoblado: boolean };
} | null {
  const input = (an.input_data ?? {}) as Record<string, unknown> & { origenAviso?: { avisoId?: unknown } };
  const avisoId = input.origenAviso?.avisoId;
  if (typeof avisoId !== "string" || !avisoId) return null;
  const results = (an.results ?? {}) as { metrics?: { flujoNetoMensual?: unknown }; escenarios?: { base?: { flujoCajaMensual?: unknown } } };
  const flujoNum = typeof results.metrics?.flujoNetoMensual === "number" ? results.metrics.flujoNetoMensual : results.escenarios?.base?.flujoCajaMensual;
  return {
    avisoId,
    veredicto: readVeredicto(results as never) ?? null,
    score: typeof an.score === "number" ? Math.round(an.score) : null,
    flujo: typeof flujoNum === "number" && Number.isFinite(flujoNum) ? Math.round(flujoNum) : null,
    perfil: { piePct: Number(input.piePct) || null, plazo: Number(input.plazoCredito) || null, tasa: Number(input.tasaInteres) || null, amoblado: input.amoblado === true || input.estaAmoblado === true },
  };
}

export interface PiezasQuieroVerlo {
  /** ¿Ya salió el correo de este interés? */
  yaEnviado(): Promise<boolean>;
  chequear(): Promise<EstadoPublicacion>;
  marcarDespublicado(): Promise<void>;
  /** Toma la fila para mandar (correo_enviado_at null → ahora); false si otro ya la tomó. */
  reclamar(): Promise<boolean>;
  enviar(): Promise<boolean>;
  /** Devuelve la fila si el envío falló, para que el siguiente toque lo intente. */
  soltar(): Promise<void>;
}

export type ResultadoQuieroVerlo = "enviado" | "ya-enviado" | "despublicado" | "sin-chequeo" | "fallo-envio";

export async function mandarAvisoUnaVez(p: PiezasQuieroVerlo): Promise<ResultadoQuieroVerlo> {
  if (await p.yaEnviado()) return "ya-enviado";
  const estado = await p.chequear();
  if (estado === "despublicado") {
    await p.marcarDespublicado();
    return "despublicado";
  }
  if (estado !== "publicado") return "sin-chequeo";
  if (!(await p.reclamar())) return "ya-enviado";
  let salio = false;
  try {
    salio = await p.enviar();
  } catch {
    salio = false;
  }
  if (!salio) {
    await p.soltar();
    return "fallo-envio";
  }
  return "enviado";
}
