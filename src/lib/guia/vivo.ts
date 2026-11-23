// ─────────────────────────────────────────────────────────────────────────────
// EL CORREO CON LOS NÚMEROS DEL INFORME (23-nov-2026, decisión de Fabrizio tras el caso e828d352). El semanal y el inmediato elegían
// con la evaluación guardada de la noche (`sondaConPatch` sobre `avisos_evaluados`), una foto que solo se rehace si cambia el precio;
// el informe lee los comparables EN VIVO. El 23-nov, 19 de los 293 avisos del semanal daban otro veredicto al recalcularlos.
//
// Ahora cada depto que va a salir se confirma en vivo con LA MISMA función del informe (analizar-servidor.ts › cuerpoDelAviso, la
// misma mediana comunal, `runAnalysis`) y con los supuestos de la persona (su pie, su plazo, su tasa):
//   · si el veredicto cambió, el depto sale y entra el siguiente candidato (la elección sigue su recorrido);
//   · si solo cambiaron los números, se mandan los nuevos.
// Las sugerencias y la mediana dependen del aviso, no de la persona: se leen una vez por aviso en cada corrida y se comparten.
// Sin poder confirmarlo (sin arriendo, una lectura que falla), el depto no sale: preferimos uno menos a uno que contradiga el informe.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/analysis";
import { readVeredicto } from "@/lib/results-helpers";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { sugerenciasDeAviso } from "@/lib/avisos/evaluar-aviso";
import { avisoDeCandidato, type CandidatoGuia, type OrigenGuia } from "./guia-servidor";
import { cuerpoDelAviso, type AntiguedadAviso } from "./analizar-servidor";
import type { Combinacion, Evaluado } from "./seleccion";

/**
 * ¿Sale con los números de hoy? Puro: el mismo veredicto que la evaluación de la noche → los números en vivo; otro veredicto, o
 * sin evaluación en vivo → no sale (null). Solo el veredicto decide; el puntaje y el flujo se reemplazan.
 */
export function confirmarConVivo(noche: Evaluado, vivo: Evaluado | null): Evaluado | null {
  if (!vivo || !vivo.veredicto || !noche.veredicto) return null;
  return vivo.veredicto === noche.veredicto ? vivo : null;
}

/** La edad con que el informe lo analizaría sin leer la ficha: la conocida (ficha u otro aviso del edificio) o la supuesta. */
export function antiguedadDeCandidato(c: CandidatoGuia): AntiguedadAviso {
  if (c.condicion === "nuevo") return { anios: null, origen: "nuevo" };
  return c.antiguedadAnios != null ? { anios: c.antiguedadAnios, origen: "ficha" } : { anios: null, origen: "supuesta" };
}

export interface EvaluadorVivo {
  /** El aviso con la función del informe, los supuestos de la persona y los datos de hoy. null si no se pudo. */
  evaluar(c: CandidatoGuia, p: { origen: OrigenGuia; combo: Combinacion }): Promise<Evaluado | null>;
  /** `confirmarConVivo` sobre `evaluar`: lo que la elección usa antes de tomar un depto. */
  confirmar(c: CandidatoGuia, noche: Evaluado, p: { origen: OrigenGuia; combo: Combinacion }): Promise<Evaluado | null>;
  /** Cuántos avisos se leyeron en vivo y cuántos se descartaron por cambiar de veredicto (para el resumen del cron). */
  cuenta: { avisos: number; confirmados: number; descartados: number; sinVivo: number };
}

export function evaluadorVivo(admin: SupabaseClient, cfg: { uf: number; tasa: number }): EvaluadorVivo {
  type Sug = Awaited<ReturnType<typeof sugerenciasDeAviso>>;
  const sugs = new Map<string, Promise<Sug | null>>();
  const medianas = new Map<string, Promise<Awaited<ReturnType<typeof prefetchMedianaComunaVenta>> | null>>();
  const cuenta = { avisos: 0, confirmados: 0, descartados: 0, sinVivo: 0 };

  const evaluar: EvaluadorVivo["evaluar"] = async (c, p) => {
    const antiguedad = antiguedadDeCandidato(c);
    const clave = `${c.avisoId}:${antiguedad.anios ?? antiguedad.origen}:${c.precioUF}`;
    let sp = sugs.get(clave);
    if (!sp) {
      cuenta.avisos++;
      sp = sugerenciasDeAviso(avisoDeCandidato(c, antiguedad.anios)).catch(() => null);
      sugs.set(clave, sp);
    }
    const sug = await sp;
    if (!sug) return null;
    // La tasa de la persona va en el origen (como en «Analizar este»: `conTasa`).
    const body = await cuerpoDelAviso(c, p.origen, p.combo, antiguedad, cfg, sug).catch(() => null);
    if (!body) return null;
    if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
    body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
    let mp = medianas.get(clave);
    if (!mp) { mp = prefetchMedianaComunaVenta(admin, body, cfg.uf).catch(() => null); medianas.set(clave, mp); }
    const mediana = await mp;
    if (!mediana) return null;
    const r = runAnalysis(body, cfg.uf, mediana);
    return {
      veredicto: readVeredicto(r) ?? null,
      score: typeof r.score === "number" ? Math.round(r.score) : null,
      flujo: typeof r.metrics?.flujoNetoMensual === "number" ? Math.round(r.metrics.flujoNetoMensual) : null,
    };
  };

  return {
    evaluar,
    async confirmar(c, noche, p) {
      const vivo = await evaluar(c, p).catch(() => null);
      const r = confirmarConVivo(noche, vivo);
      if (!vivo) cuenta.sinVivo++;
      else if (r) cuenta.confirmados++;
      else cuenta.descartados++;
      return r;
    },
    cuenta,
  };
}

/** Cuánto vive el evaluador compartido: una corrida de cron cabe entera; la siguiente corrida lee de nuevo. */
export const VIVO_COMPARTIDO_MS = 20 * 60_000;
let compartido: { clave: string; desde: number; ev: EvaluadorVivo } | null = null;

/**
 * El evaluador de la corrida: el mismo para todas las personas que arma una invocación (las sugerencias y la mediana de un aviso
 * se leen una vez). Se renueva pasados VIVO_COMPARTIDO_MS o si cambian la UF o la tasa del motor.
 */
export function evaluadorVivoCompartido(admin: SupabaseClient, cfg: { uf: number; tasa: number }, ahora: number = Date.now()): EvaluadorVivo {
  const clave = `${cfg.uf}:${cfg.tasa}`;
  if (!compartido || compartido.clave !== clave || ahora - compartido.desde > VIVO_COMPARTIDO_MS) {
    compartido = { clave, desde: ahora, ev: evaluadorVivo(admin, cfg) };
  }
  return compartido.ev;
}
