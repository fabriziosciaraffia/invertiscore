"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráfico de la serie semanal. Cliente porque Recharts mide el contenedor.
 *
 * Barras y no líneas: los registros son eventos contables por semana, no una
 * magnitud continua — una línea sugeriría interpolación entre semanas que no
 * existe. Y las semanas en cero se muestran igual: el hueco de junio y julio es
 * parte de la historia, no un dato faltante.
 *
 * Paleta: Ink sólido para registros, Ink 400 para activaciones. Sin Signal Red —
 * acá no hay nada crítico que señalar (regla del rojo, franco-design-system).
 */
export interface PuntoSemana {
  /** Etiqueta corta ya formateada por el server ("27 jul"). */
  label: string;
  registros: number;
  activaciones: number;
}

export function AdminTendenciaChart({ datos }: { datos: PuntoSemana[] }) {
  return (
    <div className="h-[220px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid stroke="var(--franco-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--franco-border-strong)" }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "var(--franco-sunken)" }}
            contentStyle={{
              background: "var(--franco-card)",
              border: "1px solid var(--franco-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--franco-text)", fontWeight: 500 }}
            itemStyle={{ color: "var(--franco-text-secondary)" }}
          />
          <Bar dataKey="registros" name="Registros" fill="var(--franco-text)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="activaciones" name="Activaciones" fill="var(--ink-400)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
