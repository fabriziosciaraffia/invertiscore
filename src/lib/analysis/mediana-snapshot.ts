// ─────────────────────────────────────────────────────────────────────────────
// LA MEDIANA COMUNAL, LEÍDA DEL SNAPSHOT (22-oct-2026, decisión de Fabrizio tras el recorrido real).
//
// Cada lector del informe —la portada, el PDF, comparar, la landing— rearmaba a mano la mediana que el motor recibe a
// partir de `analisis.mediana_comuna_snapshot`, y los cuatro se dejaban el `universo` en el camino. El brazo de
// sobreprecio comunal del gate 1 (analysis.ts › evalGate1Brazos) exige que el universo de la muestra sea el del depto:
// sin el campo, el brazo no dispara, y un informe que el motor cerró en BUSCAR OTRA al crearlo (el correo «tu informe
// está listo» y el dashboard lo dicen) se mostraba como Ajustar en la portada. Visto el 22-oct-2026 en un informe de
// fsm@ (8678e963, score 51): 17 informes guardados así.
//
// Desde acá sale UNA sola reconstrucción, con todo lo que el snapshot trae (universo, cuartiles, «estimada»). La
// referencia de cap rate entra por `extra`, porque la resuelve quien llama (snapshot propio o vivo). Puro, sin Next:
// lo fija el tier VEREDICTO-GUARDADO.
// ─────────────────────────────────────────────────────────────────────────────
import type { CapRefComunaSnapshot } from "@/lib/capref-comuna";
import type { CondicionMercado, MedianaComunaInyectada } from "@/lib/comuna-stats";

/** Lo que el informe guarda en `mediana_comuna_snapshot` (analisis-pipeline.ts › buildMedianaSnapshot). */
export interface SnapshotMedianaLeido {
  mediana: number | null;
  n?: number;
  universo?: CondicionMercado;
  p25?: number | null;
  p75?: number | null;
  estimada?: boolean;
}

/** La mediana que recibe el motor, con TODO lo que el snapshot trae. Sin cuartiles en el snapshot, sin posición. */
export function medianaDesdeSnapshot(snap: SnapshotMedianaLeido, extra: { capRefComuna?: CapRefComunaSnapshot | null } = {}): MedianaComunaInyectada {
  return {
    mediana: snap.mediana,
    n: snap.n ?? 0,
    ...(snap.universo ? { universo: snap.universo } : {}),
    p25: snap.p25,
    p75: snap.p75,
    ...(snap.estimada ? { estimada: true } : {}),
    ...(extra.capRefComuna !== undefined ? { capRefComuna: extra.capRefComuna } : {}),
  };
}
