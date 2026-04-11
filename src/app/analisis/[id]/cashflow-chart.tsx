"use client";

interface CashflowChartProps {
  arriendoMensual: number;
  dividendo: number;
  gastos: number;
  contribucionesMes: number;
  currency: "CLP" | "UF";
  ufValue: number;
}

export function CashflowChart({
  arriendoMensual,
  dividendo,
  gastos,
  contribucionesMes,
  currency,
  ufValue,
}: CashflowChartProps) {
  const corretaje = arriendoMensual * 0.5;

  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    let ingreso = arriendoMensual;
    let gastoExtra = 0;

    // Mes 1: vacancia (sin arriendo)
    if (mes === 1) ingreso = 0;
    // Mes 2: corretaje
    if (mes === 2) gastoExtra = corretaje;

    const egreso = dividendo + gastos + contribucionesMes + gastoExtra;
    const flujo = ingreso - egreso;

    return { mes, ingreso, egreso, flujo, gastoExtra };
  });

  let acumulado = 0;
  const mesConAcumulado = meses.map((m) => {
    acumulado += m.flujo;
    return { ...m, acumulado };
  });

  const maxVal = Math.max(
    ...meses.map((m) => Math.max(m.ingreso, m.egreso)),
    1
  );
  const minAcum = Math.min(...mesConAcumulado.map((m) => m.acumulado), 0);
  const maxAcum = Math.max(...mesConAcumulado.map((m) => m.acumulado), 1);
  const acumRange = maxAcum - minAcum || 1;

  const chartH = 200;

  const fmt = (n: number) => {
    if (currency === "UF") {
      const uf = n / ufValue;
      const rounded = Math.round(uf * 10) / 10;
      if (Number.isInteger(rounded)) return "UF " + Math.round(rounded).toLocaleString("es-CL");
      const [int, dec] = rounded.toFixed(1).split(".");
      return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
    }
    return "$" + Math.round(n).toLocaleString("es-CL");
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-th-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-th-bar-fill" />
            Ingreso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#C8323C]" />
            Egreso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-th-text" />
            Acumulado
          </span>
        </div>

        {/* Chart */}
        <div className="relative" style={{ height: chartH + 40 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-th-border"
              style={{ top: (1 - pct) * chartH }}
            />
          ))}

          {/* Bars */}
          <div className="flex h-full items-end justify-around" style={{ height: chartH }}>
            {mesConAcumulado.map((m) => {
              const ingresoH = (m.ingreso / maxVal) * chartH * 0.85;
              const egresoH = (m.egreso / maxVal) * chartH * 0.85;

              return (
                <div
                  key={m.mes}
                  className="group relative flex flex-col items-center"
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-20 z-10 hidden rounded-md border border-th-border-hover bg-th-elevated px-2 py-1.5 text-[10px] shadow-lg group-hover:block">
                    <div className="text-th-text">
                      Ingreso: {fmt(m.ingreso)}
                    </div>
                    <div className="text-[#C8323C]">
                      Egreso: {fmt(m.egreso)}
                    </div>
                    <div
                      className={
                        m.flujo >= 0 ? "text-th-text" : "text-[#C8323C]"
                      }
                    >
                      Flujo: {fmt(m.flujo)}
                    </div>
                    {m.gastoExtra > 0 && (
                      <div className="text-[#C8323C]">
                        Corretaje: {fmt(m.gastoExtra)}
                      </div>
                    )}
                  </div>

                  {/* Bar pair */}
                  <div className="flex items-end gap-0.5">
                    <div
                      className="w-3 rounded-t-sm bg-th-text/60 transition-all group-hover:bg-th-text/80"
                      style={{ height: ingresoH }}
                    />
                    <div
                      className="w-3 rounded-t-sm bg-[#C8323C]/80 transition-all group-hover:bg-[#C8323C]"
                      style={{ height: egresoH }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accumulated line */}
          <svg
            className="pointer-events-none absolute inset-0"
            viewBox={`0 0 600 ${chartH}`}
            preserveAspectRatio="none"
            style={{ height: chartH }}
          >
            <polyline
              fill="none"
              stroke="var(--franco-text-primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              points={mesConAcumulado
                .map((m, i) => {
                  const x = (i + 0.5) * (600 / 12);
                  const y =
                    chartH -
                    ((m.acumulado - minAcum) / acumRange) * chartH * 0.85 -
                    chartH * 0.05;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
            {mesConAcumulado.map((m, i) => {
              const x = (i + 0.5) * (600 / 12);
              const y =
                chartH -
                ((m.acumulado - minAcum) / acumRange) * chartH * 0.85 -
                chartH * 0.05;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="var(--franco-text-primary)"
                />
              );
            })}
          </svg>

          {/* Month labels */}
          <div className="mt-2 flex justify-around text-[10px] text-th-text-secondary">
            {mesConAcumulado.map((m) => (
              <span key={m.mes} className="w-7 text-center">
                M{m.mes}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
