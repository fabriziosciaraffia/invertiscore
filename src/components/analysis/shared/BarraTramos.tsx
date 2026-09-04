"use client";

/**
 * Barra semántica del Fall (CONGELADO · II, `.fbar`): el ingreso como base, los
 * costos de operar encima desde la izquierda, la cuota a continuación, y lo que sale
 * de tu bolsillo (exceso) en Signal Red más allá del ingreso — o lo que queda libre en
 * verde si el ingreso alcanza. Lee `metrics.tramosBarra` del motor tal cual: no suma
 * ni resta nada, solo escala.
 */
export function BarraTramos({
  ingreso,
  costosOperar,
  cuota,
  exceso,
  libre,
  title,
}: {
  ingreso: number;
  costosOperar: number;
  cuota: number;
  /** Lo que sale de tu bolsillo (≥ 0). */
  exceso: number;
  /** Lo que queda después de costos y cuota (≥ 0). */
  libre: number;
  title?: string;
}) {
  const escala = Math.max(ingreso, costosOperar + cuota, 1);
  const pct = (n: number) => `${((Math.max(0, n) / escala) * 100).toFixed(1)}%`;
  const ingPct = pct(ingreso);
  const opPct = pct(costosOperar);
  return (
    <div className="fbar" title={title}>
      <span className="fb-ing" style={{ width: ingPct }} />
      <span className="fb-op" style={{ width: opPct }} />
      <span className="fb-cu" style={{ left: opPct, width: pct(cuota) }} />
      {exceso > 0 && <span className="fb-rojo" style={{ left: ingPct, width: pct(exceso) }} />}
      {libre > 0 && <span className="fb-libre" style={{ left: pct(costosOperar + cuota), width: pct(libre) }} />}
    </div>
  );
}
