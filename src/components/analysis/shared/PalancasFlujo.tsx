// ─────────────────────────────────────────────────────────────────────────────
// LO QUE TE SEPARA — la matriz de palancas en el FLUJO principal (08-sep-2026).
//
// Variante (c) del mockup docs/mockups/informe-simplificado.html: las vías que
// CRUZAN van destacadas, una por bloque; las que no cruzan (y las que no aplican)
// se colapsan en una sola línea. La matriz completa vivía en un modal detrás de
// «Ver ajustes», donde el lector tenía que ir a buscarla; las cuatro palancas son
// motor, no IA, y son la respuesta a la única pregunta accionable del informe.
//
// SUBE SOLO LA MATRIZ. La intro del drawer y su cierre «Qué haces con esto» se
// quedan donde están: son plantilla determinista y traerían de vuelta el ruido que
// este goal viene a sacar.
//
// Presentacional puro: recibe filas ya armadas por `construirPalancas` (la misma
// fuente que el drawer) y no sabe de hallazgos ni de moneda.
// ─────────────────────────────────────────────────────────────────────────────

import type { FilaPalanca } from "@/components/analysis/hallazgos/vocabulario";

export function PalancasFlujo({
  filas,
  objetivo,
}: {
  /** Filas de `construirPalancas`. Vacío ⇒ no se dibuja (el caller decide el vacío). */
  filas: FilaPalanca[];
  /** Veredicto al que se quiere llegar, ya etiquetado. */
  objetivo: string;
}) {
  if (!filas.length) return null;
  const cruzan = filas.filter((f) => f.alcanza);
  const resto = filas.filter((f) => !f.alcanza);

  return (
    <div className="plf">
      <p className="plf-t">
        {cruzan.length === 0
          ? `Ninguna vía llega a ${objetivo}`
          : cruzan.length === 1
            ? `Una vía llega a ${objetivo}, por su cuenta`
            : `${cruzan.length} vías llegan a ${objetivo}, cada una por su cuenta`}
      </p>

      {cruzan.map((f, i) => (
        <div key={`si-${i}`} className="plf-si">
          <div className="plf-n">{f.nombre}</div>
          <div className="plf-d">{f.delta}</div>
          {f.origen && (
            <div className="plf-x">
              {f.origen}
              {f.destino && (
                <>
                  <span className="pal-arrow">→</span>
                  {f.destino}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {resto.length > 0 && (
        // Las que no cruzan no desaparecen —el lector tiene que saber que se probaron—
        // pero tampoco compiten: una línea, sin caja y sin cifra propia salvo el tope
        // que el motor exploró.
        <p className="plf-off">
          {resto.map((f, i) => (
            <span key={`no-${i}`}>
              {i > 0 ? " · " : ""}
              {f.nombre} {f.delta}
            </span>
          ))}
          {resto.length === 1 ? " — no cambia el veredicto." : " — ninguno cambia el veredicto."}
        </p>
      )}
    </div>
  );
}

/**
 * El mismo slot cuando NO hay palancas: con veredicto COMPRAR el motor no emite
 * `distancia_veredicto` (no hay veredicto superior al que llegar), así que la
 * pregunta cambia — de «qué te falta» a «cuánto margen tienes». Es exactamente lo
 * que el footer del hero ya hace desde T2; acá se replica para que el bloque del
 * flujo nunca quede vacío.
 */
export function MargenFlujo({
  marginPct,
  firme,
  veredictoNuevo,
}: {
  marginPct: number;
  firme: boolean;
  /** Veredicto al cruzar el margen, ya etiquetado. Vacío si es firme. */
  veredictoNuevo: string;
}) {
  const pct = marginPct.toFixed(1).replace(".", ",").replace(/,0$/, "");
  return (
    <div className="plf">
      <p className="plf-t">Cuánto aguanta este veredicto</p>
      <p className="plf-off plf-solo">
        {firme || !veredictoNuevo ? (
          <>El arriendo puede caer más de un {pct}% sin que la conclusión cambie.</>
        ) : (
          <>
            El arriendo puede caer un {pct}% antes de que el veredicto baje a {veredictoNuevo}.
          </>
        )}
      </p>
    </div>
  );
}
