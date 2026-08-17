import { fmtNumber } from "@/lib/admin-format";
import {
  construirSankey,
  type Camino,
  type EntradaSankey,
  type Orientacion,
} from "@/lib/admin-sankey-modelo";

/**
 * Sankey de dos caminos: cómo estamos AHORA. Reemplaza las barras del funnel de
 * 7 pasos, que mostraban la secuencia pero no la BIFURCACIÓN — y la bifurcación
 * es el hecho central del mundo post-cap: se puede probar el producto sin
 * cuenta, así que el embudo dejó de ser una fila india.
 *
 * SVG a mano y no una librería de Sankey: cuatro etapas fijas, diez nodos y
 * doce flujos no justifican una dependencia. La geometría vive en
 * `admin-sankey-modelo.ts` (puro); acá solo se pinta.
 *
 * ── Color ──
 * El panel admin NO es superficie de producto: acá manda la claridad analítica,
 * no la doctrina Ink + Signal Red. El color CODIFICA CATEGORÍA (qué camino),
 * nunca decora, y cada categoría conserva su color en el gráfico de tasas para
 * que la lectura sea continua entre las dos vistas. Los hues salen de la paleta
 * Okabe-Ito (segura para daltonismo) y viven en globals.css como --viz-*.
 *
 * Server component: no hay interacción y el SVG se sirve ya resuelto.
 */

const COLOR: Record<Camino, string> = {
  entrada: "var(--viz-entrada)",
  anonimo: "var(--viz-anonimo)",
  cuenta: "var(--viz-cuenta)",
  abandono: "var(--viz-abandono)",
};

/** Las bandas van translúcidas para que se lean los cruces; el abandono más. */
const OPACIDAD_BANDA: Record<Camino, number> = {
  entrada: 0.42,
  anonimo: 0.46,
  cuenta: 0.46,
  abandono: 0.2,
};

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
  orientacion = "vertical",
}: {
  entrada: EntradaSankey;
  metricas: MetricaSankey[];
  frescura?: string;
  nota: string;
  orientacion?: Orientacion;
}) {
  const { nodos, flujos, etapas, ancho, alto, descripcion } = construirSankey(entrada, orientacion);
  const vertical = orientacion === "vertical";

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      {/* En vertical el diagrama crece hacia abajo, que es la dimensión libre de
          una página: no necesita scroll lateral ni siquiera en 900px. En
          horizontal el ancho es la restricción y hay que scrollear. */}
      <div className={`p-4 ${vertical ? "" : "overflow-x-auto"}`}>
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className={`block h-auto w-full ${vertical ? "" : "min-w-[900px]"}`}
          role="img"
          aria-labelledby="sankey-titulo sankey-desc"
        >
          <title id="sankey-titulo">
            Flujo del embudo por camino: entrada, anónimo, con cuenta y abandono
          </title>
          <desc id="sankey-desc">{descripcion}</desc>

          {etapas.map((et) => (
            <text
              key={et.titulo}
              x={et.x}
              y={et.y}
              textAnchor={et.anchor}
              className="fill-[var(--franco-text-tertiary)] font-mono text-[11px] uppercase tracking-wider"
            >
              {et.titulo}
            </text>
          ))}

          {flujos.map((f) => (
            <path key={f.id} d={f.d} fill={COLOR[f.camino]} fillOpacity={OPACIDAD_BANDA[f.camino]} />
          ))}

          {/* Etiquetas de flujo. Van con halo (paint-order stroke) para que
              nunca queden ilegibles sobre una banda oscura. */}
          {flujos
            .filter((f) => f.etiqueta)
            .map((f) => (
              <text
                key={`lbl-${f.id}`}
                x={f.labelX}
                y={f.labelY}
                textAnchor={f.labelAnchor}
                paintOrder="stroke"
                stroke="var(--franco-card)"
                strokeWidth={3.5}
                strokeLinejoin="round"
                className="fill-[var(--franco-text-secondary)] font-mono text-[11px]"
              >
                {f.etiqueta}
              </text>
            ))}

          {nodos.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={n.ancho}
                height={n.alto}
                rx={4}
                fill={n.esAbandono ? "transparent" : COLOR[n.camino]}
                fillOpacity={n.esAbandono ? 0 : 0.16}
                stroke={COLOR[n.camino]}
                strokeWidth={n.esAbandono ? 1 : 1.75}
                strokeDasharray={n.esAbandono ? "4 3" : undefined}
              />
              {/* La cifra SIEMPRE visible y dentro del nodo: con piso mínimo de
                  grosor el tamaño ya no es fuente fiable de magnitud, la cifra
                  sí. Nunca baja de 11px — el requisito prohíbe achicar texto
                  para resolver espacio. */}
              <text
                x={n.x + n.ancho / 2}
                y={n.y + n.alto / 2 + 6}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="var(--franco-card)"
                strokeWidth={3}
                strokeLinejoin="round"
                className="fill-[var(--franco-text)] font-mono text-[16px] font-bold"
              >
                {fmtNumber(n.valor)}
              </text>
              <text
                x={n.labelX}
                y={n.labelY}
                textAnchor={n.labelAnchor}
                paintOrder="stroke"
                stroke="var(--franco-card)"
                strokeWidth={3.5}
                strokeLinejoin="round"
                className="fill-[var(--franco-text-secondary)] font-mono text-[11px]"
              >
                {n.etiqueta}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--franco-border)] px-4 py-2.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
        {(
          [
            ["entrada", "entrada"],
            ["anonimo", "camino anónimo"],
            ["cuenta", "camino con cuenta"],
          ] as Array<[Camino, string]>
        ).map(([c, texto]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: COLOR[c] }}
            />
            {texto}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px] border border-dashed"
            style={{ borderColor: COLOR.abandono }}
          />
          abandono
        </span>
        {frescura && <span className="text-[var(--franco-text-muted)]">· {frescura}</span>}
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-[var(--franco-border)] bg-[var(--franco-border)] sm:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.titulo} className="bg-[var(--franco-card)] px-4 py-3.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
              {m.titulo}
            </div>
            <div className="mt-1 font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]">
              {m.valor}
            </div>
            <div className="mt-0.5 font-body text-[12px] text-[var(--franco-text-muted)]">
              {m.detalle}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--franco-border)] px-4 py-2.5 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
        {nota}
      </div>
    </div>
  );
}
