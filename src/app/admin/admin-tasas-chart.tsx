"use client";

import { useEffect, useState } from "react";
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
import { HITOS_FUNNEL } from "@/lib/admin-funnel-hitos";

/**
 * Evolución de las tasas de conversión: ¿vamos mejorando o no?
 *
 * Recharts y no SVG propio ni una dependencia nueva: ya está en el bundle y el
 * panel lo usa en `admin-tendencia-chart.tsx`, de donde sale la estética de ejes
 * y tooltip. Sumar Chart.js habría sido una segunda librería de gráficos para el
 * mismo panel.
 *
 * ── Color ──
 * Cada tramo conserva el color de la categoría que produce en el Sankey, para
 * que las dos vistas se lean como una sola: "wizard → análisis" va en el hue de
 * los anónimos, "análisis → cuenta" en el de las cuentas, y "visita → wizard"
 * en el de la entrada. Tokens --viz-* de globals.css (Okabe-Ito).
 *
 * ── Los tramos que NO se dibujan antes de su hito ──
 * Dos veces pasa lo mismo: un cambio de plataforma redefine el numerador o el
 * denominador, y comparar los dos lados hace leer como mérito (o como desplome)
 * lo que fue un deploy.
 *
 *  · 16-ago, apertura del cap: hasta ahí no se podía generar un análisis sin
 *    cuenta, así que "análisis → cuenta" era 100% POR DEFINICIÓN.
 *  · 14-ago, identidad anónima: con el cap, cada visitante sin cuenta pasó a
 *    tener su propio person_id en PostHog; antes muchos colapsaban en pocos.
 *    Los EVENTOS del wizard casi no se movieron (387 → 534 del 13 al 14-ago)
 *    pero las PERSONAS se multiplicaron por ocho (33 → 112, y 266 el 16). Las
 *    tasas con denominador de personas cambiaron de significado, no de valor.
 *
 * En los dos casos la línea no se dibuja antes de su hito (null + connectNulls
 * desactivado) y el hueco se explica DENTRO del área: el gris fantasma seguiría
 * invitando a comparar —que es justo lo que hay que impedir— y una nota al pie
 * se lee después del daño.
 */

export interface PuntoTasa {
  dia: string;
  /** Etiqueta corta ya formateada por el server ("16 ago"). */
  label: string;
  visitaWizard: number | null;
  wizardAnalisis: number | null;
  analisisCuenta: number | null;
}

const TRAMOS = [
  { key: "visitaWizard", nombre: "visita → wizard", color: "var(--viz-entrada)", dash: undefined },
  { key: "wizardAnalisis", nombre: "wizard → análisis", color: "var(--viz-anonimo)", dash: undefined },
  { key: "analisisCuenta", nombre: "análisis → cuenta", color: "var(--viz-cuenta)", dash: "5 3" },
] as const;

/**
 * ¿Pantalla angosta? Decide si los hitos usan su etiqueta corta.
 *
 * `matchMedia` y no un breakpoint de CSS porque la etiqueta viaja como PROP a
 * Recharts, que la pinta dentro del SVG: no hay clase que la pueda cambiar
 * desde afuera. Arranca en false (desktop) y el efecto corrige tras montar —
 * el gráfico es client-only de todos modos, así que no hay HTML del server que
 * pueda quedar desincronizado.
 */
function usePantallaAngosta(): boolean {
  const [angosta, setAngosta] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const leer = () => setAngosta(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return angosta;
}

export function AdminTasasChart({ datos }: { datos: PuntoTasa[] }) {
  const angosta = usePantallaAngosta();
  // La zona anterior al primer hito se sombrea y lleva la explicación adentro.
  const primerHito = HITOS_FUNNEL[0]?.fecha;
  const previos = primerHito ? datos.filter((d) => d.dia < primerHito) : [];
  const labelPrimerHito = datos.find((d) => d.dia === primerHito)?.label;

  return (
    <div className="h-[320px] w-full sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        {/* Márgenes: el `left: -14` de antes empujaba el "100%" del eje Y FUERA
            del área pintada —medido a 390 y 360 px: se cortaba— y el `right: 18`
            no alcanzaba para el último día del eje X, que perdía 2 px. En
            desktop sobra ancho y no se notaba; en un teléfono se ve. */}
        <LineChart data={datos} margin={{ top: 14, right: 26, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--franco-border)" vertical={false} />

          {/* La zona muerta se pinta ANTES de las líneas para quedar por
              debajo. El fill necesita ir explícito: heredado quedaba invisible. */}
          {previos.length > 0 && labelPrimerHito && (
            <ReferenceArea
              x1={previos[0].label}
              x2={labelPrimerHito}
              fill="var(--franco-text)"
              fillOpacity={0.05}
              label={{
                // En un teléfono la zona muerta ocupa tres días y su rótulo
                // largo se mete 27px adentro del primer hito ("identidad") —
                // medido a 390 y a 360. La frase entera vive en el respaldo
                // accesible de abajo, así que acá se recorta.
                value: angosta ? "sin base" : "sin base comparable",
                position: "insideTop",
                fill: "var(--franco-text-muted)",
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
              }}
            />
          )}

          {HITOS_FUNNEL.map((h, i) => {
            const label = datos.find((d) => d.dia === h.fecha)?.label;
            if (!label) return null;
            return (
              <ReferenceLine
                key={h.fecha}
                x={label}
                stroke="var(--franco-text)"
                strokeDasharray="4 3"
                label={{
                  value: angosta ? (h.etiquetaCorta ?? h.etiqueta) : h.etiqueta,
                  // Se alternan arriba y abajo: dos hitos a cuatro días de
                  // distancia con la etiqueta en la misma altura se pisarían.
                  position: i % 2 === 0 ? "insideTopLeft" : "insideBottomRight",
                  fill: "var(--franco-text-secondary)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            );
          })}

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--franco-border-strong)" }}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            unit="%"
            domain={[0, 100]}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", fill: "var(--franco-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
            width={46}
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

          {/* El orden de <Line> fija el orden de la leyenda: se declaran en el
              orden del embudo, no al azar. connectNulls en false — un hueco es
              un hueco, no una recta inventada entre los días que lo rodean. */}
          {TRAMOS.map((t) => (
            <Line
              key={t.key}
              type="monotone"
              dataKey={t.key}
              name={t.nombre}
              stroke={t.color}
              strokeWidth={2.25}
              strokeDasharray={t.dash}
              dot={false}
              connectNulls={false}
              // Sin animación de entrada: Recharts dibuja la línea animando su
              // stroke-dasharray, así que durante el primer segundo el gráfico
              // está literalmente vacío. En un panel que se abre para mirar un
              // número, eso es un parpadeo sin ganancia — y hace que cualquier
              // captura automática salga en blanco.
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
