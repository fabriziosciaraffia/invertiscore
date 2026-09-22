"use client";

/**
 * «Ocupación estimada para tu depto, y la alcanzada por avisos parecidos al tuyo» — la primera
 * pieza del capítulo «Ocupación en renta corta» (III STR), mockup capitulo-iii-noches-str.html
 * aprobado el 22-sep-2026.
 *
 *   · dos celdas: la ocupación del caso (estimada, o el supuesto del usuario) con sus noches al
 *     año, y la mediana de ocupación que REALIZARON el último año los avisos con que se estimó
 *     (`ocupacionRealizadaComparables`: p50, p50Superhost, n, nSuperhost; display-only, la
 *     adjunta el pipeline al persistir y el recompute la conserva);
 *   · el eje 0–100 con divisiones cada 5 y rótulo cada 25, la estimación en tinta plena arriba
 *     y la de los avisos en tinta tenue abajo, cada una con su porcentaje;
 *   · sin comparables (42 de 254 filas): la segunda celda dice «sin dato» y no hay eje.
 *
 * La RAMA de la lectura la decide `ramaOcupacion`, que es lo que el gate mide: cerca cuando la
 * diferencia es de 5 puntos o menos (`OCC_CERCA_PTS`), lejos cuando los avisos ocuparon menos,
 * sobre cuando ocuparon más, sin cuando no hay comparables. Tinta y rojo: sin verde ni ocre.
 */
export interface OcupacionRealizada {
  p50: number;
  p50Superhost: number;
  n: number;
  nSuperhost: number;
}

export const OCC_CERCA_PTS = 5;

export type RamaOcupacion = "cerca" | "lejos" | "sobre" | "sin";

/** La diferencia en puntos, ya redondeados los dos lados (los enteros que se muestran deciden). */
export function ramaOcupacion(occPct: number, real: OcupacionRealizada | null | undefined): { rama: RamaOcupacion; deltaPts: number | null } {
  if (!real || !(real.n > 0)) return { rama: "sin", deltaPts: null };
  const deltaPts = Math.round(real.p50 * 100) - Math.round(occPct);
  const rama: RamaOcupacion = Math.abs(deltaPts) <= OCC_CERCA_PTS ? "cerca" : deltaPts < 0 ? "lejos" : "sobre";
  return { rama, deltaPts };
}

export function OcupacionComparables({
  occPct,
  noches,
  esTuya,
  real,
}: {
  /** Ocupación del caso en %, ya redondeada a entero. */
  occPct: number;
  noches: number;
  /** true cuando el usuario definió la ocupación a mano. */
  esTuya: boolean;
  real: OcupacionRealizada | null | undefined;
}) {
  const hayReal = !!real && real.n > 0;
  const realPct = hayReal ? Math.round(real!.p50 * 100) : null;
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  return (
    <div className="oc">
      <div className="oc-dos">
        <div className="oc-c">
          <div className="oc-k">{esTuya ? "Tu supuesto" : "Estimada para tu depto"}</div>
          <div className="oc-n">
            {occPct}%<small>{noches} noches al año</small>
          </div>
          <div className="oc-s">{esTuya ? "El número que definiste tú, no un dato de mercado." : "Lo que los datos de mercado estiman para un depto como el tuyo, estabilizado."}</div>
        </div>
        {hayReal ? (
          <div className="oc-c tenue">
            <div className="oc-k">Ocupación avisos similares</div>
            <div className="oc-n">
              {realPct}%<small>{Math.round(real!.p50 * 365)} noches</small>
            </div>
            <div className="oc-s">
              Mediana del último año de los {real!.n} avisos con que se estimó
              {real!.nSuperhost > 0 ? `; ${real!.nSuperhost} ${real!.nSuperhost === 1 ? "es superhost y ocupó" : "son superhost y ocuparon"} ${Math.round(real!.p50Superhost * 100)}%` : ""}.
            </div>
          </div>
        ) : (
          <div className="oc-c vacia">
            <div className="oc-k">Ocupación avisos similares</div>
            <div className="oc-n">sin dato</div>
            <div className="oc-s">Este análisis no guardó los avisos con que se estimó: no hay con qué contrastar.</div>
          </div>
        )}
      </div>
      {hayReal && (
        <div className="oc-eje" role="img" aria-label={`Ocupación ${esTuya ? "supuesta" : "estimada"} ${occPct}% frente a ${realPct}% de los avisos similares`}>
          {ticks.map((v) => (
            <span key={v}>
              <span className={`oc-tk${v % 25 === 0 ? " may" : ""}`} style={{ left: `${v}%` }} />
              {v % 25 === 0 && (
                <span className="oc-t" style={{ left: `${v}%` }}>
                  {v}%
                </span>
              )}
            </span>
          ))}
          <span className="oc-m est" style={{ left: `${occPct}%` }} />
          <span className="oc-l est" style={{ left: `${occPct}%` }}>
            {esTuya ? "tu supuesto" : "estimada"} {occPct}%
          </span>
          <span className="oc-m real" style={{ left: `${realPct}%` }} />
          <span className="oc-l real" style={{ left: `${realPct}%` }}>
            avisos similares {realPct}%
          </span>
        </div>
      )}
    </div>
  );
}
