"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Evolución de las tasas de conversión: ¿vamos mejorando o no?
 *
 * Recharts y no SVG propio ni una dependencia nueva: ya está en el bundle y el
 * panel lo usa en `admin-tendencia-chart.tsx`, de donde sale la estética de ejes
 * y tooltip. Sumar Chart.js habría sido una segunda librería de gráficos para
 * el mismo panel.
 *
 * ── El tramo que NO se dibuja antes del 16-ago ──
 * Hasta la apertura del cap no se podía generar un análisis sin cuenta, así que
 * "análisis → cuenta creada" era 100% POR DEFINICIÓN, no por mérito. Dibujarlo
 * crudo hace leer un desplome donde hubo una apertura deliberada.
 *
 * Se resuelve NO dibujando la línea antes del hito (los puntos van en null con
 * connectNulls desactivado), y explicando el hueco DENTRO del área del gráfico,
 * no al pie: el gris fantasma seguiría invitando a comparar —que es justo lo que
 * hay que impedir— y una nota al pie se lee después del daño.
 */

/** Hitos del producto. Agregar uno acá lo dibuja en el gráfico; no hay más nada que tocar. */
export const HITOS_FUNNEL: Array<{ fecha: string; etiqueta: string }> = [
  { fecha: "2026-08-16", etiqueta: "apertura del cap" },
];

export interface PuntoTasa {
  /** YYYY-MM-DD, la clave del eje X. */
  dia: string;
  /** Etiqueta corta ya formateada por el server ("16 ago"). */
  label: string;
  /** % visita → abre wizard. null = PostHog mudo ese día. */
  visitaWizard: number | null;
  /** % wizard → análisis creado. null = PostHog mudo. */
  wizardAnalisis: number | null;
  /** % análisis → cuenta creada. null antes del hito, a propósito. */
  analisisCuenta: number | null;
}

export function AdminTasasChart({ datos }: { datos: PuntoTasa[] }) {
  const primerHito = HITOS_FUNNEL[0]?.fecha;
  // La zona previa al primer hito se sombrea apenas y lleva la explicación
  // adentro. Si no hay días previos en la ventana, no se dibuja nada.
  const hayPrevios = primerHito != null && datos.some((d) => d.dia < primerHito);
  const primerDia = datos[0]?.label;
  const labelHito = datos.find((d) => d.dia === primerHito)?.label;

  return (
    <div className="h-[300px] w-full sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 12, right: 16, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="var(--franco-border)" vertical={false} />

          {hayPrevios && labelHito && primerDia && (
            <ReferenceArea
              x1={primerDia}
              x2={labelHito}
              fill="var(--franco-sunken)"
              fillOpacity={0.7}
              label={{
                value: "antes del cap, análisis → cuenta era 100% por definición",
                position: "insideTop",
                fill: "var(--franco-text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono, monospace)",
              }}
            />
          )}

          {HITOS_FUNNEL.map((h) => {
            const label = datos.find((d) => d.dia === h.fecha)?.label;
            if (!label) return null;
            return (
              <ReferenceLine
                key={h.fecha}
                x={label}
                stroke="var(--franco-text)"
                strokeDasharray="4 3"
                label={{
                  value: h.etiqueta,
                  position: "insideTopRight",
                  fill: "var(--franco-text-secondary)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            );
          })}

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--franco-border-strong)" }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            unit="%"
            domain={[0, 100]}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            formatter={(v) => (typeof v === "number" ? `${v}%` : "—")}
            contentStyle={{
              background: "var(--franco-card)",
              border: "1px solid var(--franco-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--franco-text)", fontWeight: 500 }}
            itemStyle={{ color: "var(--franco-text-secondary)" }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
          />

          {/* connectNulls en false: un hueco es un hueco, no una recta inventada
              entre los dos días que lo rodean. */}
          <Line
            type="monotone"
            dataKey="visitaWizard"
            name="visita → wizard"
            stroke="var(--franco-text)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="wizardAnalisis"
            name="wizard → análisis"
            stroke="var(--ink-500)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="analisisCuenta"
            name="análisis → cuenta"
            stroke="var(--signal-red)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
