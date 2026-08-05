// ─────────────────────────────────────────────────────────────────────────
// Charts del documento comparativo — SVG PURO server-side (patrón
// PatrimonioChartSVG). Sin "use client", sin Recharts.
//
// Por qué NO reusa PatrimonioChartSVG: ese componente dibuja barras apiladas
// (aporte + valor) + UNA línea de patrimonio, para una sola modalidad. Acá hay
// que enfrentar dos modalidades sobre la misma escala, así que se necesita un
// chart de líneas — variante comparativa propia, no una extensión del genérico.
//
// Ambos charts consumen series ya emitidas por el motor (projections de cada
// lado · flujoEstacional del STR); cero recálculo.
// ─────────────────────────────────────────────────────────────────────────

import type { FlujoEstacionalMes } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney } from "@/components/analysis/utils";

// ── Patrimonio y riqueza comparados (3 series + bracket de brecha) ────────
//
// Contrato: assets-export/mockup-pdf-ambas-patrimonio-v2.html (spec vinculante).
// Espejo en el documento de la migración ya mergeada en la web
// (src/components/comparativa/PatrimonioChartComparativa.tsx).
//
// TRES series, no dos. Antes se dibujaban los patrimonioNeto de LTR y STR
// superpuestos: son idénticos por construcción (patrimonio = valor del activo −
// deuda, y ni la apreciación ni la amortización dependen de la modalidad de
// renta), así que la punteada quedaba enterrada bajo la sólida y el gráfico
// gastaba dos curvas en decir una sola cosa. Ahora:
//
//   1. ACTIVO      — patrimonioNeto, UNA línea gruesa (2.2) Ink. Destino común
//                    de las dos modalidades. Dots solo en los extremos.
//   2. RIQUEZA LTR — patrimonioNeto + flujoAcumulado del LTR. Fina (1.1) Ink-400
//                    sólida, sin dots.
//   3. RIQUEZA STR — ídem con datos STR. Fina (1.1) Ink-400 punteada (3 2).
//
// La riqueza total es lo que efectivamente tienes: el activo más el flujo que
// acumulaste por el camino (negativo cuando pones de tu bolsillo, que es el caso
// típico → las dos finas corren por debajo de la gruesa). Ahí está la diferencia
// real entre modalidades, y el bracket del último año la cuantifica.
//
// Sin Signal Red: la brecha es un delta entre dos resultados, no un egreso ni un
// negativo crítico — no cae en ninguno de los usos permitidos de la Capa 1.
const P_W = 320, P_H = 200;
// Plot acortado 40px a la derecha (P_X1 288 → 248) para alojar bracket + label
// DENTRO del viewBox: el documento no tiene margen de chart como la web.
const P_X0 = 38, P_X1 = 248, P_TOP = 16, P_BASE = 170, P_LABEL_Y = 180;
const P_AXIS_Y = 192;
// Bracket: vertical a la derecha del último punto, serifs hacia adentro, monto
// HORIZONTAL (no rotado: en impresión el texto vertical de 7px no se lee).
const BR_X = 254, BR_SERIF = 2.5, BR_LABEL_X = 258;

export interface PatrimonioPunto {
  anio: number;
  patrimonioNeto: number;
  flujoAcumulado: number;
}

// Techo redondo del eje Y. Igual que la web, el dominio es EXPLÍCITO (no "auto"):
// el bracket se posiciona con la misma escala que dibuja las curvas, así que dato
// y render tienen que ser el mismo número. Prueba 4 y 5 intervalos y se queda con
// el techo más ajustado; en empate gana 4 (menos ticks = menos ruido en 320px).
const TICK_MULTS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceAxis(max: number): { yMax: number; ticks: number } {
  if (!(max > 0)) return { yMax: 1, ticks: 4 };
  const conHeadroom = max * 1.04;
  let best = { yMax: Number.POSITIVE_INFINITY, ticks: 4 };
  for (const n of [4, 5]) {
    const raw = conHeadroom / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const mult = TICK_MULTS.find((m) => raw / mag <= m) ?? 10;
    const yMax = mag * mult * n;
    if (yMax < best.yMax) best = { yMax, ticks: n };
  }
  return best;
}

export function PatrimonioComparativoSVG({
  ltr,
  str,
  valorUF,
  soloLtr = false,
}: {
  ltr: PatrimonioPunto[];
  str: PatrimonioPunto[];
  valorUF: number;
  /**
   * Asimetría de entrega: el lado LTR espera la escritura y el STR no, así que
   * las series no arrancan el mismo día. Se dibuja SOLO renta larga (activo +
   * su riqueza), sin la punteada del corto y sin el bracket de brecha —
   * superponerlas mostraría una distancia de punto de partida, no de modalidad.
   * Espejo del mismo estado en la web (PatrimonioChartComparativa).
   */
  soloLtr?: boolean;
}) {
  // Capado a la intersección: comparar manzanas con manzanas. El documento ya
  // recorta a 10 años aguas arriba; esto cubre largos distintos entre motores.
  const n = Math.min(ltr.length, str.length);
  if (n === 0) return null;

  // El activo se toma SIEMPRE del LTR. Si algún día los dos motores dejaran de
  // coincidir (inputs distintos, pre-entrega, cambio de supuestos), no promediamos
  // ni inventamos una tercera curva: avisamos y seguimos con LTR. Espejo exacto
  // del guard de la web.
  let divergente = false;
  const activo: number[] = [];
  const riquezaLtr: number[] = [];
  const riquezaStr: number[] = [];
  for (let i = 0; i < n; i++) {
    const l = ltr[i];
    const s = str[i];
    if (Math.abs(l.patrimonioNeto - s.patrimonioNeto) > Math.max(1, Math.abs(l.patrimonioNeto) * 0.005)) {
      divergente = true;
    }
    activo.push(l.patrimonioNeto);
    riquezaLtr.push(l.patrimonioNeto + l.flujoAcumulado);
    riquezaStr.push(s.patrimonioNeto + s.flujoAcumulado);
  }
  if (divergente) {
    console.warn(
      "[PatrimonioComparativoSVG] patrimonioNeto difiere entre LTR y STR más allá del redondeo. " +
      "Se grafica la serie del LTR como activo único.",
    );
  }

  const { yMax, ticks } = niceAxis(Math.max(0, ...activo, ...riquezaLtr, ...riquezaStr));

  // Dominio fijo [0, techo redondo]. Una riqueza negativa (aporte acumulado mayor
  // que el activo, evento raro) se apoya en el piso en vez de escaparse del
  // viewBox; la cifra real siempre vive en la anotación de abajo, que trae los
  // montos al peso. Mismo criterio de clamp que PatrimonioChartSVG.
  const yFor = (v: number) =>
    Math.max(P_TOP, Math.min(P_BASE, P_BASE - (v / yMax) * (P_BASE - P_TOP)));
  const xFor = (i: number) => (n === 1 ? P_X0 : P_X0 + ((P_X1 - P_X0) * i) / (n - 1));
  const pts = (serie: number[]) =>
    serie.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");

  const gridVals = Array.from({ length: ticks + 1 }, (_, k) => (yMax * k) / ticks);
  const step = Math.max(1, Math.ceil(n / 10));

  // Bracket de brecha en el último año — solo si hay algo que acotar.
  const rLtrFin = riquezaLtr[n - 1];
  const rStrFin = riquezaStr[n - 1];
  const brecha = rLtrFin - rStrFin;
  const brY = [yFor(Math.max(rLtrFin, rStrFin)), yFor(Math.min(rLtrFin, rStrFin))];
  // El par de labels (monto + eyebrow) se centra en el medio del bracket; el
  // clamp evita que se salga del viewBox cuando la brecha queda pegada a un borde.
  const brMid = Math.max(12, Math.min(P_H - 12, (brY[0] + brY[1]) / 2));

  return (
    <svg viewBox={`0 0 ${P_W} ${P_H}`} width="100%" role="img" aria-label="Activo y riqueza acumulada a 10 años en ambas modalidades" preserveAspectRatio="xMidYMid meet">
      {/* Gridlines + labels Y. La línea de $0 es el eje: Ink, sin dash. */}
      {gridVals.map((v, k) => {
        const y = yFor(v);
        return (
          <g key={`g${k}`}>
            <line x1={P_X0} y1={y} x2={P_X1} y2={y} stroke={k === 0 ? "var(--text)" : "var(--border)"} strokeWidth={k === 0 ? 0.6 : 0.5} />
            <text x={P_X0 - 4} y={y + 2} textAnchor="end" fontFamily="var(--mono)" fontSize={6} fill="var(--text-muted)">
              {fmtAxisMoney(v, "CLP", valorUF)}
            </text>
          </g>
        );
      })}

      {/* Orden de pintado: las finas abajo, el activo encima — la gruesa manda. */}
      {!soloLtr && n >= 2 && <polyline points={pts(riquezaStr)} fill="none" stroke="var(--ink-400)" strokeWidth={1.1} strokeDasharray="3 2" />}
      {n >= 2 && <polyline points={pts(riquezaLtr)} fill="none" stroke="var(--ink-400)" strokeWidth={1.1} />}
      {n >= 2 && <polyline points={pts(activo)} fill="none" stroke="var(--text)" strokeWidth={2.2} />}
      {/* Dots SOLO en los extremos del activo (contrato del mockup): con 10 dots
          por serie el gráfico se ensucia y las tres curvas compiten por atención. */}
      <circle cx={xFor(0)} cy={yFor(activo[0])} r={1.8} fill="var(--text)" />
      <circle cx={xFor(n - 1)} cy={yFor(activo[n - 1])} r={1.8} fill="var(--text)" />

      {/* Bracket de brecha — mide la distancia ENTRE las dos riquezas: sin la
          del corto no hay brecha que marcar. */}
      {!soloLtr && brecha !== 0 && (
        <g>
          <line x1={BR_X} y1={brY[0]} x2={BR_X} y2={brY[1]} stroke="var(--text)" strokeWidth={0.9} />
          <line x1={BR_X - BR_SERIF} y1={brY[0]} x2={BR_X} y2={brY[0]} stroke="var(--text)" strokeWidth={0.9} />
          <line x1={BR_X - BR_SERIF} y1={brY[1]} x2={BR_X} y2={brY[1]} stroke="var(--text)" strokeWidth={0.9} />
          <text x={BR_LABEL_X} y={brMid - 1.9} fontFamily="var(--mono)" fontSize={7} fontWeight={700} fill="var(--text)">
            {fmtAxisMoney(Math.abs(brecha), "CLP", valorUF)}
          </text>
          <text x={BR_LABEL_X} y={brMid + 5.3} fontFamily="var(--mono)" fontSize={5.5} fill="var(--text-muted)">
            BRECHA
          </text>
        </g>
      )}

      {/* Labels de año + título del eje X */}
      {Array.from({ length: n }).map((_, i) =>
        i % step === 0 || i === n - 1 ? (
          <text key={`x${i}`} x={xFor(i)} y={P_LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={6} fill="var(--text-muted)">
            {ltr[i]?.anio ?? str[i]?.anio ?? i + 1}
          </text>
        ) : null,
      )}
      <text x={(P_X0 + P_X1) / 2} y={P_AXIS_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={6} fill="var(--text-muted)">
        Años
      </text>
    </svg>
  );
}

// ── Flujo comparado (LTR plano vs STR estacional) ────────────────────────
const F_W = 320, F_H = 200;
const F_X0 = 46, F_X1 = 314, F_TOP = 14, F_BOT = 168, F_LABEL_Y = 182;

const MES_ABREV: Record<string, string> = {
  Enero: "E", Febrero: "F", Marzo: "M", Abril: "A", Mayo: "M", Junio: "J",
  Julio: "J", Agosto: "A", Septiembre: "S", Octubre: "O", Noviembre: "N", Diciembre: "D",
};

export function FlujoComparadoSVG({
  meses,
  flujoLtrMensual,
  valorUF,
}: {
  meses: FlujoEstacionalMes[];
  flujoLtrMensual: number;
  valorUF: number;
}) {
  const n = meses.length;
  if (n === 0) return null;

  const vals = [...meses.map((m) => m.flujo), flujoLtrMensual, 0];
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const span = maxV - minV || 1;

  const yFor = (v: number) => F_BOT - ((v - minV) / span) * (F_BOT - F_TOP);
  const zeroY = yFor(0);
  const slot = (F_X1 - F_X0) / n;
  const barW = Math.max(4, Math.min(18, slot * 0.6));
  const xCenter = (i: number) => F_X0 + slot * (i + 0.5);

  return (
    <svg viewBox={`0 0 ${F_W} ${F_H}`} width="100%" role="img" aria-label="Flujo mensual: renta larga plana vs renta corta estacional" preserveAspectRatio="xMidYMid meet">
      {/* Línea $0 */}
      <line x1={F_X0} y1={zeroY} x2={F_X1} y2={zeroY} stroke="var(--border-strong)" strokeWidth={1} />
      <text x={F_X0 - 6} y={zeroY + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">$0</text>
      <text x={F_X0 - 6} y={yFor(maxV) + 2.5} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">{fmtAxisMoney(maxV, "CLP", valorUF)}</text>
      <text x={F_X0 - 6} y={yFor(minV) - 1} textAnchor="end" fontFamily="var(--mono)" fontSize={7} fill="var(--text-muted)">{fmtAxisMoney(minV, "CLP", valorUF)}</text>

      {/* STR: barras estacionales (Ink positivo · Signal Red cuando aportas) */}
      {meses.map((m, i) => {
        const x = xCenter(i) - barW / 2;
        const y = m.flujo >= 0 ? yFor(m.flujo) : zeroY;
        const h = Math.abs(yFor(m.flujo) - zeroY);
        return <rect key={`b${i}`} x={x} y={y} width={barW} height={h} fill={m.flujo >= 0 ? "var(--text)" : "var(--signal-red)"} />;
      })}

      {/* LTR: línea plana — el mismo número todos los meses */}
      <line x1={F_X0} y1={yFor(flujoLtrMensual)} x2={F_X1} y2={yFor(flujoLtrMensual)} stroke="var(--ink-400)" strokeWidth={1.5} strokeDasharray="4 3" />

      {meses.map((m, i) => (
        <text key={`x${i}`} x={xCenter(i)} y={F_LABEL_Y} textAnchor="middle" fontFamily="var(--mono)" fontSize={6.5} fill="var(--text-muted)">
          {MES_ABREV[m.mes] ?? m.mes.slice(0, 1).toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
