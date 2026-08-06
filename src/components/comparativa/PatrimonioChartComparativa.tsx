"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line, XAxis, YAxis, CartesianGrid, Customized,
  Tooltip as RechartsTooltip, ResponsiveContainer, LineChart,
  useOffset, useChartWidth, useChartHeight,
} from "recharts";
import type { FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fmtAxisMoney, fmtMoney } from "@/components/analysis/utils";
import { hayAsimetriaDeEntrega } from "@/lib/comparativa-patrimonio";

interface Props {
  ltrResults: FullAnalysisResult;
  strResults: ShortTermResult;
  currency: "CLP" | "UF";
  ufValue: number;
}

// ─── Gráfica 1 · Patrimonio del activo + riqueza total LTR vs STR (10 años) ──
//
// Tres series, no dos. Antes el chart dibujaba patrimonioNeto de LTR y de STR
// superpuestas: son idénticas por construcción (patrimonio = valor del activo −
// deuda, y ni la apreciación ni la amortización dependen de la modalidad de
// renta), así que la punteada quedaba enterrada bajo la sólida y el gráfico
// gastaba dos series en decir una sola cosa. Ahora:
//
//   1. ACTIVO      — patrimonioNeto, UNA línea gruesa (2.5) Ink sólido. Es el
//                    destino común de las dos modalidades.
//   2. RIQUEZA LTR — patrimonioNeto + flujoAcumulado del LTR. Línea fina (1.5)
//                    Ink secundario sólida.
//   3. RIQUEZA STR — ídem con datos STR. Fina (1.5) Ink secundario punteada.
//
// La riqueza total es lo que efectivamente tienes: el activo MENOS lo que
// pusiste de tu bolsillo por el camino (en este caso ambos flujos acumulados son
// negativos, así que las dos finas corren por debajo de la gruesa). Ahí está la
// diferencia real entre modalidades, y el bracket del último año la cuantifica.
//
// Capa Cromática: Ink en dos stops (--franco-text para el activo,
// --franco-text-secondary para las dos riquezas), diferenciadas por grosor y
// dash. Sin Signal Red — ver nota del bracket más abajo.
//
// EXCEPCIÓN · asimetría de entrega. Las tres series de arriba asumen que los dos
// lados arrancan el mismo día. Cuando UNO espera la escritura y el otro no
// (`hayAsimetriaDeEntrega`), esa premisa cae y el chart pasa a dibujar SOLO el
// lado de renta larga: activo + riqueza larga, sin la punteada del corto y sin
// el bracket de brecha.
//
// Por qué retirar la serie y no separarla en dos: dibujar dos curvas de activo
// invita justamente a leer la distancia entre ellas como diferencia de
// modalidad, cuando es diferencia de punto de partida — el error que el finding
// de patrimonio ya dejó de cometer. Y la riqueza del corto arrastra el mismo
// vicio, porque se construye sobre su activo. Una línea única es una afirmación
// que el usuario no puede matizar; dos líneas no comparables son una invitación
// a restarlas. Se muestra el lado que sí cuenta la espera y se dice cuál es.
export function PatrimonioChartComparativa(p: Props) {
  // El label del bracket vive en el margen derecho; cuando el chart es angosto
  // ese margen se come el área de plot, así que ahí el bracket se retira y la
  // brecha la carga la anotación de abajo (que siempre trae el monto).
  //
  // El criterio es el ancho REAL del chart, no una media query: la card vive en
  // una columna, así que el viewport no dice cuánto espacio hay. Con
  // ResizeObserver también sobrevive un resize de ventana sin recarga — con
  // matchMedia el margen ancho quedaba aplicado y desbordaba la card.
  // Arranca en compacto (chartWidth 0) para que el primer frame nunca desborde.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setChartWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setChartWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 40px de margen para el label vertical + un área de plot que valga la pena.
  const compact = chartWidth < 340;

  // Los dos lados no arrancan el mismo día ⇒ el chart no compara (ver nota de
  // arriba). Se mide con LAS DOS series: desde que el motor de renta corta
  // modela la espera, que el LTR espere ya no implica asimetría — si el STR
  // también espera, la comparación vuelve a ser legítima.
  const asimetria = hayAsimetriaDeEntrega(p.ltrResults.projections, p.ltrResults.metrics, p.strResults.projections);

  const chartData = useMemo(() => {
    const ltrProj = p.ltrResults.projections ?? [];
    const strProj = p.strResults.projections ?? [];

    // Capar a la intersección de ambas projections + max 10 años (spec 3b).
    // Si capamos al min(LTR.length, STR.length) hasta 10, comparamos manzanas
    // con manzanas. Antes el chart extendía a 20 años con STR=null y la
    // leyenda decía "STR llega a $0" falsamente.
    const overlap = Math.min(ltrProj.length, strProj.length, 10);
    const data: Array<{
      year: number;
      activo: number | null;
      riquezaLTR: number | null;
      riquezaSTR: number | null;
    }> = [];

    let divergente = false;

    for (let i = 0; i < overlap; i++) {
      const ltrRow = ltrProj[i];
      const strRow = strProj[i];
      const year = ltrRow?.anio ?? strRow?.year ?? (i + 1);

      // El activo se toma SIEMPRE del LTR. Si algún día los dos motores dejaran
      // de coincidir (inputs distintos, pre-entrega, cambio de supuestos), no
      // promediamos ni inventamos una tercera curva: avisamos y seguimos con LTR.
      const activoLTR = ltrRow?.patrimonioNeto ?? null;
      const activoSTR = strRow?.patrimonioNeto ?? null;
      if (
        activoLTR !== null && activoSTR !== null &&
        Math.abs(activoLTR - activoSTR) > Math.max(1, Math.abs(activoLTR) * 0.005)
      ) {
        divergente = true;
      }

      data.push({
        year,
        activo: activoLTR,
        riquezaLTR: activoLTR !== null ? activoLTR + (ltrRow?.flujoAcumulado ?? 0) : null,
        riquezaSTR: activoSTR !== null ? activoSTR + (strRow?.flujoAcumulado ?? 0) : null,
      });
    }

    if (divergente) {
      console.warn(
        "[PatrimonioChartComparativa] patrimonioNeto difiere entre LTR y STR más allá del redondeo. " +
        "Se grafica la serie del LTR como activo único.",
      );
    }

    return data;
  }, [p.ltrResults, p.strResults]);

  // Techo del eje Y fijado a mano, en un múltiplo redondo con headroom. No es
  // cosmética: `useYAxisDomain()` (el que usa el bracket para posicionarse)
  // devuelve el dominio de DATOS, mientras que un dominio "auto" se pinta con un
  // máximo extendido distinto — el bracket quedaría desalineado de las curvas.
  // Con el dominio explícito, dato y render son el mismo número.
  const yMax = useMemo(() => {
    const max = Math.max(
      0,
      ...chartData.flatMap((d) => [d.activo ?? 0, d.riquezaLTR ?? 0, d.riquezaSTR ?? 0]),
    );
    if (max <= 0) return 0;
    const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
    return Math.ceil((max * 1.04) / step) * step;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        Sin proyecciones disponibles para una de las modalidades.
      </p>
    );
  }

  const last = chartData[chartData.length - 1];
  const lastYear = last.year;
  const activoFinal = last.activo ?? 0;
  const riquezaLTRFinal = last.riquezaLTR ?? 0;
  const riquezaSTRFinal = last.riquezaSTR ?? 0;
  const brecha = riquezaLTRFinal - riquezaSTRFinal;
  const ganadora = brecha >= 0 ? "renta larga" : "renta corta";

  // Desambiguación bruto vs neto. La línea del activo es patrimonio BRUTO (activo
  // − deuda); "tu parte al vender" del detalle ya descuenta el 2% de comisión +
  // costos de cierre (short-term-engine `GASTOS_CIERRE_VENTA` · analysis.ts
  // `comisionVenta`). Sin glosa quedaban dos cifras separadas ~4% conviviendo en
  // la app sin explicación.
  const idxFinal = chartData.length - 1;
  const valorActivoFinal = p.ltrResults.projections?.[idxFinal]?.valorPropiedad ?? 0;
  const comisionVentaFinal = Math.round(valorActivoFinal * 0.02);

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 mb-6">
      <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1">
        PATRIMONIO Y RIQUEZA · {lastYear} AÑOS
      </p>
      <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] mb-4">
        El activo construye igual; tu bolsillo hace la diferencia
      </h3>

      <div ref={wrapRef} style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: compact ? 16 : 40, left: 0, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--franco-border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
              label={{
                value: "Años",
                position: "insideBottom",
                offset: -4,
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fill: "var(--franco-text-muted)",
                letterSpacing: "0.06em",
              }}
            />
            <YAxis
              domain={yMax > 0 ? [0, yMax] : undefined}
              tickFormatter={(v) => fmtAxisMoney(Number(v), p.currency, p.ufValue)}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--franco-text-secondary)" }}
              axisLine={{ stroke: "var(--franco-border)" }}
              tickLine={false}
              width={70}
            />
            <RechartsTooltip
              contentStyle={{
                background: "var(--franco-card)",
                border: "0.5px solid var(--franco-border)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  activo: "Activo (ambas)",
                  riquezaLTR: "Riqueza · renta larga",
                  riquezaSTR: "Riqueza · renta corta",
                };
                const v = typeof value === "number" ? value : Number(value) || 0;
                const n = typeof name === "string" ? name : String(name);
                return [fmtMoney(v, p.currency, p.ufValue), labels[n] ?? n];
              }}
              labelFormatter={(year) => `Año ${year}`}
            />
            {/* Activo — el destino común. Gruesa, Ink sólido. Dots SOLO en los
                extremos (contrato del mockup): con 10 dots por serie el gráfico
                se ensuciaba y las tres curvas competían por atención. */}
            <Line
              type="monotone"
              dataKey="activo"
              stroke="var(--franco-text)"
              strokeWidth={2.5}
              dot={<ExtremosDot total={chartData.length} fill="var(--franco-text)" />}
              activeDot={{ r: 3, fill: "var(--franco-text)" }}
              name="activo"
              connectNulls
            />
            {/* Riqueza renta larga — fina, Ink secundario sólida. Sin dots. */}
            <Line
              type="monotone"
              dataKey="riquezaLTR"
              stroke="var(--franco-text-secondary)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 2.5, fill: "var(--franco-text-secondary)" }}
              name="riquezaLTR"
              connectNulls
            />
            {/* Riqueza renta corta — fina, Ink secundario punteada. Sin dots.
                Se retira con asimetría de entrega: su serie arranca a operar en
                el mes 1 y la del lado largo espera la escritura. */}
            {!asimetria && (
              <Line
                type="monotone"
                dataKey="riquezaSTR"
                stroke="var(--franco-text-secondary)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 2.5, fill: "var(--franco-text-secondary)" }}
                name="riquezaSTR"
                connectNulls
              />
            )}
            {/* El bracket mide la brecha ENTRE las dos riquezas: sin la del
                corto no hay brecha que marcar. */}
            {!asimetria && !compact && brecha !== 0 && (
              <Customized
                component={
                  <BracketBrecha
                    top={Math.max(riquezaLTRFinal, riquezaSTRFinal)}
                    bottom={Math.min(riquezaLTRFinal, riquezaSTRFinal)}
                    // Abreviado, como el mockup: el monto completo no cabe rotado
                    // y la anotación de abajo ya lo da al peso.
                    label={fmtAxisMoney(Math.abs(brecha), p.currency, p.ufValue)}
                    yMax={yMax}
                  />
                }
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Separador de la leyenda — contrato del mockup (border-top + padding). */}
      <div
        className="flex flex-wrap items-center justify-center gap-5 mt-3.5 pt-3.5"
        style={{ borderTop: "1px solid var(--franco-border)" }}
      >
        <LegendItem variant="thick" label={asimetria ? "Activo · renta larga" : "Activo · ambas"} />
        <LegendItem variant="thin" label={asimetria ? "Riqueza · renta larga" : "Riqueza · larga"} />
        {!asimetria && <LegendItem variant="dashed" label="Riqueza · corta" />}
      </div>

      <div
        className="mt-5 p-4"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <p
          className="font-mono uppercase mb-1"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
        >
          {asimetria
            ? `AL AÑO ${lastYear} · SOLO RENTA LARGA`
            : `AL AÑO ${lastYear} · EL ACTIVO EMPATA, EL CAMINO NO`}
        </p>
        <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-snug">
          {asimetria ? (
            <>
              Acá va solo la renta larga: {fmtMoney(activoFinal, p.currency, p.ufValue)} de activo neto de deuda
              al año {lastYear}, y {fmtMoney(riquezaLTRFinal, p.currency, p.ufValue)} descontando lo que pones de
              tu bolsillo por el camino. La renta corta no se dibuja porque este depto todavía no se entrega: con
              renta larga el crédito recién empieza a correr cuando lo recibas, y su proyección aún no descuenta
              esa espera. Superponerlas mostraría una brecha de punto de partida, no de modalidad.
            </>
          ) : (
            <>
              El depto se aprecia igual y la deuda se amortiza igual, arriendes corto o largo: {fmtMoney(activoFinal, p.currency, p.ufValue)}{" "}
              de activo neto de deuda en las dos modalidades. Lo que cambia es cuánto pones de tu bolsillo por el camino.
              Descontándolo, terminas con {fmtMoney(riquezaLTRFinal, p.currency, p.ufValue)} en renta larga y{" "}
              {fmtMoney(riquezaSTRFinal, p.currency, p.ufValue)} en renta corta — {fmtMoney(Math.abs(brecha), p.currency, p.ufValue)}{" "}
              de diferencia a favor de la {ganadora}. Esa brecha es la decisión, no el activo.
            </>
          )}
        </p>
        <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0 mt-2 leading-snug">
          {comisionVentaFinal > 0 ? (
            <>
              Es patrimonio bruto: el activo menos la deuda. Si vendes, la comisión de venta (2%) resta{" "}
              <span className="font-mono">{fmtMoney(comisionVentaFinal, p.currency, p.ufValue)}</span> de esa cifra.
            </>
          ) : (
            <>Es patrimonio bruto: el activo menos la deuda. La comisión de venta (2%) no está descontada.</>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Bracket de brecha en el último año ──────────────────────────────────────
// Recharts 3 movió la geometría del chart a hooks (`useOffset`, `useChartWidth`,
// `useChartHeight`, `useYAxisDomain`) — ya no la inyecta por props al hijo de
// <Customized>, como hacía la 2.x. Los hooks se releen en cada render del chart,
// así que el bracket sobrevive resize sin listeners propios.
//
// Color: Ink (`--franco-text`), NO Signal Red. La brecha es un delta entre dos
// resultados positivos, no un egreso ni un valor negativo crítico — no calza en
// ninguno de los 9 usos permitidos de la Capa 1 del design system, y ese sistema
// es explícito en que un uso nuevo requiere validación, no criterio propio.
// Dot que solo se pinta en el primer y último punto de la serie (contrato del
// mockup: la línea del activo se ancla en sus extremos, no punto por punto).
function ExtremosDot(props: { cx?: number; cy?: number; index?: number; total?: number; fill?: string }) {
  const { cx, cy, index, total, fill } = props;
  if (typeof cx !== "number" || typeof cy !== "number" || typeof index !== "number") return null;
  if (index !== 0 && index !== (total ?? 0) - 1) return null;
  return <circle cx={cx} cy={cy} r={3} fill={fill} />;
}

interface BracketProps {
  top: number;
  bottom: number;
  label: string;
  yMax: number;
}

function BracketBrecha({ top, bottom, label, yMax }: BracketProps) {
  // `useOffset` da los cuatro márgenes que Recharts descuenta para construir sus
  // escalas; `usePlotArea` NO descuenta el margin top y deja el bracket ~6px
  // arriba de las curvas. Con offset + dimensiones del chart la escala coincide
  // exactamente con la que posiciona los dots.
  //
  // El dominio llega por prop, no por `useYAxisDomain`: ese hook despacha al
  // store de Recharts durante el render y React lo reportaba como "Cannot update
  // a component while rendering a different component". Como el dominio del eje
  // ya lo fija este componente (`yMax`), el hook era redundante.
  const offset = useOffset();
  const chartWidth = useChartWidth();
  const chartHeight = useChartHeight();

  const dMin = 0;
  const dMax = yMax;
  if (!offset || !chartWidth || !chartHeight || dMax <= dMin) {
    return null;
  }

  const plotTop = offset.top ?? 0;
  const plotHeight = chartHeight - plotTop - (offset.bottom ?? 0);
  if (plotHeight <= 0) return null;

  // Escala lineal reconstruida sobre el dominio ya resuelto por Recharts.
  const toY = (v: number) => plotTop + plotHeight * (1 - (v - dMin) / (dMax - dMin));
  // El último punto de una serie de categorías cae en el borde derecho del plot.
  const x = chartWidth - (offset.right ?? 0);
  const yTop = toY(top);
  const yBottom = toY(bottom);
  if (!Number.isFinite(x) || !Number.isFinite(yTop) || !Number.isFinite(yBottom)) return null;

  // Geometría del mockup: vertical 11px a la derecha del último punto, serifs de
  // 4px hacia la izquierda, y el monto rotado 90° al lado. El label vertical es
  // lo que permite un margen derecho de 40px en vez de 100 — con el texto
  // horizontal el label se comía un tercio del área de plot.
  const xBar = x + 11;
  const serif = 4;
  const stroke = "var(--franco-text)";
  const yMid = (yTop + yBottom) / 2;
  const xLabel = xBar + 8;

  return (
    <g pointerEvents="none">
      <line x1={xBar} y1={yTop} x2={xBar} y2={yBottom} stroke={stroke} strokeWidth={1.5} />
      <line x1={xBar - serif} y1={yTop} x2={xBar} y2={yTop} stroke={stroke} strokeWidth={1.5} />
      <line x1={xBar - serif} y1={yBottom} x2={xBar} y2={yBottom} stroke={stroke} strokeWidth={1.5} />
      <text
        x={xLabel}
        y={yMid}
        transform={`rotate(90 ${xLabel} ${yMid})`}
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={11}
        fontWeight={700}
        fill="var(--franco-text)"
      >
        {label}
      </text>
    </g>
  );
}

function LegendItem({ variant, label }: { variant: "thick" | "thin" | "dashed"; label: string }) {
  const color = variant === "thick" ? "var(--franco-text)" : "var(--franco-text-secondary)";
  const borderTop =
    variant === "thick"
      ? `2.5px solid ${color}`
      : variant === "thin"
        ? `1.5px solid ${color}`
        : `1.5px dashed ${color}`;
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ display: "inline-block", width: 22, height: 0, borderTop }} />
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--franco-text-secondary)" }}
      >
        {label}
      </span>
    </span>
  );
}
