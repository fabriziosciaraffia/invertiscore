import { fmtNumber } from "@/lib/admin-format";
import {
  ALTO_VIEWBOX,
  ANCHO_VIEWBOX,
  COLUMNAS_X,
  ANCHO_NODO,
  construirSankey,
  type Camino,
  type EntradaSankey,
} from "@/lib/admin-sankey-modelo";

/**
 * Sankey de dos caminos: cómo estamos AHORA. Reemplaza las barras del funnel de
 * 7 pasos, que mostraban la secuencia pero no la bifurcación — y la bifurcación
 * es el hecho central del mundo post-cap: se puede probar el producto sin
 * cuenta, así que el embudo dejó de ser una fila india.
 *
 * SVG a mano y no una librería de Sankey: cuatro columnas fijas, diez nodos y
 * doce flujos no justifican una dependencia. La geometría vive en
 * `admin-sankey-modelo.ts` (puro); acá solo se pinta.
 *
 * ── Color ──
 * La paleta de Franco son dos colores (Ink + Signal Red), así que los caminos NO
 * se distinguen por matiz sino por VALOR en la escala Ink: camino anónimo en
 * Ink sólido (es el dominante), camino con cuenta en ink-500, abandono en
 * punteado sin relleno. Signal Red queda para las CIFRAS de abandono — misma
 * semántica que la banda de caída que este componente reemplaza, donde el
 * "−N usuarios" ya iba en rojo.
 *
 * Server component: no hay interacción, y el SVG se sirve ya resuelto.
 */

const TRAZO: Record<Camino, string> = {
  anonimo: "var(--franco-text)",
  cuenta: "var(--ink-500)",
  abandono: "var(--franco-border-strong)",
};

/** Opacidad de las bandas. El abandono va más tenue: es el resto, no el hecho. */
const OPACIDAD: Record<Camino, number> = {
  anonimo: 0.26,
  cuenta: 0.3,
  abandono: 0.14,
};

const TITULOS_COLUMNA = ["origen", "wizard", "análisis gratis", "cuenta y pago"];

export interface MetricaSankey {
  titulo: string;
  valor: string;
  detalle: string;
}

export function AdminSankey({
  entrada,
  metricas,
  frescura,
  nota,
}: {
  entrada: EntradaSankey;
  metricas: MetricaSankey[];
  /** "actualizado hace X min" de PostHog. Vacío si la fuente está muda. */
  frescura?: string;
  /** Aclaración de unidades bajo el diagrama. */
  nota: string;
}) {
  const { nodos, flujos, descripcion } = construirSankey(entrada);

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      {/* Bajo 900px el diagrama no se comprime: se scrollea. Apretar cuatro
          columnas en un teléfono produce un dibujo ilegible, y este panel se
          mira en desktop — el scroll es la degradación honesta. */}
      <div className="overflow-x-auto p-4">
        <svg
          viewBox={`0 0 ${ANCHO_VIEWBOX} ${ALTO_VIEWBOX}`}
          className="block h-auto w-full min-w-[860px]"
          role="img"
          aria-labelledby="sankey-titulo sankey-desc"
        >
          <title id="sankey-titulo">Flujo del embudo por camino: anónimo, con cuenta y abandono</title>
          <desc id="sankey-desc">{descripcion}</desc>

          {/* Headers de columna */}
          {TITULOS_COLUMNA.map((t, i) => (
            <text
              key={t}
              x={COLUMNAS_X[i] + ANCHO_NODO / 2}
              y={26}
              textAnchor="middle"
              className="fill-[var(--franco-text-tertiary)] font-mono text-[11px] uppercase tracking-wider"
            >
              {t}
            </text>
          ))}

          {/* Bandas primero: los nodos van encima */}
          {flujos.map((f) => (
            <path
              key={f.id}
              d={f.d}
              fill={TRAZO[f.camino]}
              fillOpacity={OPACIDAD[f.camino]}
              stroke="none"
            />
          ))}

          {/* Etiquetas sobre las bandas que las llevan */}
          {flujos
            .filter((f) => f.etiqueta)
            .map((f) => (
              <text
                key={`lbl-${f.id}`}
                x={f.labelX}
                y={f.labelY - 6}
                textAnchor="middle"
                className="fill-[var(--franco-text-secondary)] font-mono text-[11px]"
              >
                {f.etiqueta}
              </text>
            ))}

          {/* Nodos */}
          {nodos.map((n) => {
            const centroY = n.y + n.alto / 2;
            const compacto = n.alto < 44;
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.ancho}
                  height={n.alto}
                  rx={4}
                  fill={n.esAbandono ? "transparent" : "var(--franco-sunken)"}
                  stroke={n.esAbandono ? "var(--franco-border-strong)" : TRAZO[n.camino]}
                  strokeWidth={n.esAbandono ? 1 : 1.5}
                  strokeDasharray={n.esAbandono ? "4 3" : undefined}
                />
                {/* El número SIEMPRE visible: con piso mínimo de grosor, el
                    tamaño ya no es fuente fiable de magnitud — la cifra sí. */}
                <text
                  x={n.x + n.ancho / 2}
                  y={compacto ? centroY + 4 : centroY - 3}
                  textAnchor="middle"
                  className={`font-mono text-[17px] font-bold ${
                    n.esAbandono ? "fill-[var(--signal-red)]" : "fill-[var(--franco-text)]"
                  }`}
                >
                  {fmtNumber(n.valor)}
                </text>
                {!compacto && (
                  <text
                    x={n.x + n.ancho / 2}
                    y={centroY + 13}
                    textAnchor="middle"
                    className="fill-[var(--franco-text-secondary)] font-mono text-[10px]"
                  >
                    {n.etiqueta}
                  </text>
                )}
                {/* Nodo bajo: la etiqueta no cabe adentro, va al costado */}
                {compacto && (
                  <text
                    x={n.x + n.ancho + 7}
                    y={centroY + 4}
                    className="fill-[var(--franco-text-secondary)] font-mono text-[10px]"
                  >
                    {n.etiqueta}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--franco-border)] px-4 py-2.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--franco-text)]" />
          camino anónimo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--ink-500)]" />
          camino con cuenta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-dashed border-[var(--franco-border-strong)]" />
          abandono
        </span>
        {frescura && <span className="text-[var(--franco-text-muted)]">· {frescura}</span>}
      </div>

      {/* Fila de métricas */}
      <div className="grid grid-cols-1 gap-px border-t border-[var(--franco-border)] bg-[var(--franco-border)] sm:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.titulo} className="bg-[var(--franco-card)] px-4 py-3.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
              {m.titulo}
            </div>
            <div className="mt-1 font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]">
              {m.valor}
            </div>
            <div className="mt-0.5 font-body text-[12px] text-[var(--franco-text-muted)]">{m.detalle}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--franco-border)] px-4 py-2.5 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
        {nota}
      </div>
    </div>
  );
}
