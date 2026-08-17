"use client";

import { useId, useState } from "react";
import { fmtNumber } from "@/lib/admin-format";
import {
  construirSankey,
  type Camino,
  type Densidad,
  type EntradaSankey,
  type ModeloSankey,
  type Orientacion,
} from "@/lib/admin-sankey-modelo";

/**
 * Sankey de dos caminos: cómo estamos AHORA. Reemplaza las barras del funnel de
 * 7 pasos, que mostraban la secuencia pero no la BIFURCACIÓN — y la bifurcación
 * es el hecho central del mundo post-cap: se puede probar el producto sin
 * cuenta, así que el embudo dejó de ser una fila india.
 *
 * SVG a mano y no una librería de Sankey: cinco etapas fijas, doce nodos y
 * catorce flujos no justifican una dependencia. La geometría vive en
 * `admin-sankey-modelo.ts` (puro); acá se pinta y se maneja la interacción.
 *
 * ── Color ──
 * El panel admin NO es superficie de producto: acá manda la claridad analítica,
 * no la doctrina Ink + Signal Red. El color CODIFICA CATEGORÍA (qué camino),
 * nunca decora, y cada categoría conserva su color en el gráfico de tasas para
 * que la lectura sea continua entre las dos vistas. Hues Okabe-Ito (seguros
 * para daltonismo) en globals.css como --viz-*.
 *
 * ── Densidad ──
 * Se arman DOS diagramas y el CSS elige: compacta en desktop, cómoda en mobile.
 * El server no sabe el ancho del viewport, y este panel lo mira una persona —
 * el HTML de más sale mucho más barato que una hidratación que reacomode el
 * layout al montar.
 */

const COLOR: Record<Camino, string> = {
  entrada: "var(--viz-entrada)",
  anonimo: "var(--viz-anonimo)",
  cuenta: "var(--viz-cuenta)",
  abandono: "var(--viz-abandono)",
};

const OPACIDAD_BANDA: Record<Camino, number> = {
  entrada: 0.42,
  anonimo: 0.46,
  cuenta: 0.46,
  abandono: 0.2,
};

/** Ancho fijo del tooltip, para poder decidir de qué lado del cursor cae. */
const ANCHO_TOOLTIP = 250;

/** Debajo de esto un desglose no se muestra: con 3 casos un % es una anécdota. */
export const APERTURA_MINIMA = 20;

export interface AperturaNodo {
  /** Qué dimensión se abre ("por fuente", "por modalidad", …). */
  titulo: string;
  items: Array<{ etiqueta: string; valor: number }>;
}

export interface MetricaSankey {
  titulo: string;
  valor: string;
  detalle: string;
}

interface Foco {
  clase: "nodo" | "flujo";
  id: string;
  x: number;
  y: number;
  /** Ancho de la card, para decidir de qué lado del cursor cae el tooltip. */
  ancho: number;
}

export function AdminSankey({
  entrada,
  metricas,
  frescura,
  nota,
  aperturas = {},
  orientacion = "vertical",
}: {
  entrada: EntradaSankey;
  metricas: MetricaSankey[];
  frescura?: string;
  nota: string;
  /** Desglose por nodo. Un nodo sin entrada acá no es clickeable. */
  aperturas?: Record<string, AperturaNodo>;
  orientacion?: Orientacion;
}) {
  const [foco, setFoco] = useState<Foco | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const comoda = construirSankey(entrada, orientacion, "comoda");
  const compacta = construirSankey(entrada, orientacion, "compacta");
  // Los dos diagramas tienen los mismos nodos y flujos, así que el tooltip y el
  // panel se resuelven contra uno solo: solo cambian las coordenadas.
  const nodoFoco = foco?.clase === "nodo" ? comoda.nodos.find((n) => n.id === foco.id) : undefined;
  const flujoFoco = foco?.clase === "flujo" ? comoda.flujos.find((f) => f.id === foco.id) : undefined;
  const nombreNodo = (id: string) => comoda.nodos.find((n) => n.id === id)?.etiqueta ?? id;

  const apertura = abierto ? aperturas[abierto] : undefined;
  const nodoAbierto = abierto ? comoda.nodos.find((n) => n.id === abierto) : undefined;
  const totalApertura = apertura?.items.reduce((s, i) => s + i.valor, 0) ?? 0;

  const props = { foco, setFoco, abierto, setAbierto, aperturas };

  return (
    <div className="relative rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      {/* Mobile: densidad cómoda CON SCROLL LATERAL. Un SVG con viewBox escala
          su texto junto al contenedor, así que dejar que 820 de viewBox entren
          en 326 de pantalla dibuja los 11px a ~4px: ilegible. El ancho mínimo
          mantiene el texto a tamaño real y se paga con un scroll horizontal,
          que es la degradación honesta en un viewport de 390.
          Desktop: compacta, que entra entera en pantalla sin scroll de ningún
          tipo — el objetivo de este ciclo. */}
      <div className="overflow-x-auto p-4 md:hidden">
        <div className="min-w-[820px]">
          <Diagrama modelo={comoda} densidad="comoda" {...props} />
        </div>
      </div>
      <div className="hidden p-4 md:block">
        <Diagrama modelo={compacta} densidad="compacta" {...props} />
      </div>

      {foco && (nodoFoco || flujoFoco) && (
        <div
          role="status"
          className="pointer-events-none absolute z-20 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2 shadow-lg"
          style={{
            // Al costado del cursor, nunca centrado encima: tapar el nodo que
            // se está describiendo obliga a mover el mouse para releer el
            // número, que es exactamente lo que el tooltip venía a evitar.
            // Salta al lado izquierdo cuando no hay lugar a la derecha.
            // Sujeto a los bordes de la card: sin el clamp, un nodo pegado a
            // un extremo manda el tooltip fuera del panel.
            left: Math.min(
              Math.max(
                foco.x + ANCHO_TOOLTIP + 24 < foco.ancho ? foco.x + 18 : foco.x - ANCHO_TOOLTIP - 18,
                8,
              ),
              Math.max(foco.ancho - ANCHO_TOOLTIP - 8, 8),
            ),
            top: foco.y + 14,
            width: ANCHO_TOOLTIP,
          }}
        >
          {nodoFoco && (
            <>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
                {nodoFoco.etiqueta}
              </div>
              <div className="mt-0.5 font-mono text-[19px] font-bold text-[var(--franco-text)]">
                {fmtNumber(nodoFoco.valor)}
              </div>
              <dl className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
                {/* La primera etapa no tiene etapa anterior: la línea repetiría
                    el mismo porcentaje y haría dudar de los dos. */}
                {nodoFoco.etapa > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt>de la etapa anterior</dt>
                    <dd className="text-[var(--franco-text)]">{nodoFoco.pctEtapaPrevia}%</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt>del total que entró</dt>
                  <dd className="text-[var(--franco-text)]">{nodoFoco.pctEntrada}%</dd>
                </div>
              </dl>
              {aperturas[nodoFoco.id] && (
                <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
                  {abierto === nodoFoco.id ? "clic para cerrar" : "clic para abrir"}
                </div>
              )}
            </>
          )}
          {flujoFoco && (
            <>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
                {nombreNodo(flujoFoco.desde)} → {nombreNodo(flujoFoco.hacia)}
              </div>
              <div className="mt-0.5 font-mono text-[19px] font-bold text-[var(--franco-text)]">
                {fmtNumber(flujoFoco.valor)}
              </div>
              <dl className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
                <div className="flex justify-between gap-3">
                  <dt>de {nombreNodo(flujoFoco.desde)}</dt>
                  <dd className="text-[var(--franco-text)]">{flujoFoco.pctOrigen}%</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>del total que entró</dt>
                  <dd className="text-[var(--franco-text)]">{flujoFoco.pctEntrada}%</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      )}

      {/* Desglose del nodo abierto. Inline y debajo del diagrama, no un drawer
          encima: el desglose se lee CONTRA el diagrama —"de estas 443, ¿cuántas
          de ig?"— y un panel flotante taparía justo el contexto que da sentido
          al número. Además funciona igual en mobile, sin capa nueva. */}
      {apertura && nodoAbierto && (
        <div className="border-t border-[var(--franco-border)] bg-[var(--franco-sunken)] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
              {nodoAbierto.etiqueta} · {apertura.titulo}
            </div>
            <button
              type="button"
              onClick={() => setAbierto(null)}
              className="font-mono text-[11px] text-[var(--franco-text-muted)] underline underline-offset-2 hover:text-[var(--franco-text)]"
            >
              cerrar
            </button>
          </div>

          {totalApertura < APERTURA_MINIMA ? (
            // Estado vacío honesto: con este volumen un desglose porcentual es
            // una anécdota disfrazada de dato. Se dice el número crudo y listo.
            <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
              Todavía no hay volumen para abrir esta dimensión:{" "}
              {totalApertura === 0
                ? "no hay casos registrados"
                : `${fmtNumber(totalApertura)} ${totalApertura === 1 ? "caso" : "casos"} en total`}
              . Con menos de {APERTURA_MINIMA} un porcentaje diría más de lo que sabemos.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {apertura.items.map((it) => {
                const pct = Math.round((it.valor / totalApertura) * 1000) / 10;
                return (
                  <li key={it.etiqueta} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate font-mono text-[12px] text-[var(--franco-text)]">
                      {it.etiqueta}
                    </span>
                    <span className="h-2.5 min-w-[2px] flex-1 overflow-hidden rounded-sm bg-[var(--franco-card)]">
                      <span
                        className="block h-full rounded-sm"
                        style={{ width: `${pct}%`, background: COLOR[nodoAbierto.camino] }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-[12px] text-[var(--franco-text-secondary)]">
                      {fmtNumber(it.valor)} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--franco-border)] px-4 py-2.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
        {(
          [
            ["entrada", "entrada"],
            ["anonimo", "camino anónimo"],
            ["cuenta", "camino con cuenta"],
          ] as Array<[Camino, string]>
        ).map(([c, texto]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR[c] }} />
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

function Diagrama({
  modelo,
  densidad,
  foco,
  setFoco,
  abierto,
  setAbierto,
  aperturas,
}: {
  modelo: ModeloSankey;
  densidad: Densidad;
  foco: Foco | null;
  setFoco: (f: Foco | null) => void;
  abierto: string | null;
  setAbierto: (id: string | null) => void;
  aperturas: Record<string, AperturaNodo>;
}) {
  const uid = useId();
  const { nodos, flujos, etapas, ancho, alto, descripcion } = modelo;

  // El tooltip se posiciona contra la CARD, no contra el SVG: el SVG está
  // escalado por viewBox y sus coordenadas internas no son píxeles de pantalla.
  const posicionar = (ev: React.MouseEvent) => {
    const card = ev.currentTarget.closest(".relative") as HTMLElement | null;
    const r = card?.getBoundingClientRect();
    return {
      x: ev.clientX - (r?.left ?? 0),
      y: ev.clientY - (r?.top ?? 0),
      ancho: r?.width ?? 0,
    };
  };

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="block h-auto w-full"
      role="img"
      aria-labelledby={`${uid}-t ${uid}-d`}
      onMouseLeave={() => setFoco(null)}
    >
      <title id={`${uid}-t`}>
        Flujo del embudo por camino: entrada, anónimo, con cuenta y abandono
      </title>
      <desc id={`${uid}-d`}>{descripcion}</desc>

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

      {flujos.map((f) => {
        const activo = foco?.clase === "flujo" && foco.id === f.id;
        return (
          <path
            key={f.id}
            d={f.d}
            fill={COLOR[f.camino]}
            fillOpacity={activo ? OPACIDAD_BANDA[f.camino] + 0.22 : OPACIDAD_BANDA[f.camino]}
            onMouseEnter={(ev) => setFoco({ clase: "flujo", id: f.id, ...posicionar(ev) })}
            onMouseMove={(ev) => setFoco({ clase: "flujo", id: f.id, ...posicionar(ev) })}
            className="cursor-help"
          />
        );
      })}

      {/* Guías a la columna lateral (solo en compacta). */}
      {flujos
        .filter((f) => f.guia)
        .map((f) => (
          <path
            key={`g-${f.id}`}
            d={f.guia}
            fill="none"
            stroke="var(--franco-border-strong)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}

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
            className="pointer-events-none fill-[var(--franco-text-secondary)] font-mono text-[11px]"
          >
            {f.etiqueta}
          </text>
        ))}

      {nodos.map((n) => {
        const abrible = Boolean(aperturas[n.id]);
        const activo = foco?.clase === "nodo" && foco.id === n.id;
        const seleccionado = abierto === n.id;
        return (
          <g
            key={n.id}
            onMouseEnter={(ev) => setFoco({ clase: "nodo", id: n.id, ...posicionar(ev) })}
            onMouseMove={(ev) => setFoco({ clase: "nodo", id: n.id, ...posicionar(ev) })}
            onClick={(ev) => {
              if (!abrible) return;
              // En touch no hay hover: el primer tap tiene que mostrar el
              // tooltip además de abrir, o el dato del tooltip sería inalcanzable.
              setFoco({ clase: "nodo", id: n.id, ...posicionar(ev) });
              setAbierto(seleccionado ? null : n.id);
            }}
            className={abrible ? "cursor-pointer" : "cursor-help"}
            role={abrible ? "button" : undefined}
            tabIndex={abrible ? 0 : undefined}
            aria-label={
              abrible
                ? `${n.etiqueta}: ${n.valor}. Abrir desglose por ${aperturas[n.id].titulo}`
                : undefined
            }
            onKeyDown={(ev) => {
              if (!abrible) return;
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                setAbierto(seleccionado ? null : n.id);
              }
            }}
          >
            <rect
              x={n.x}
              y={n.y}
              width={n.ancho}
              height={n.alto}
              rx={4}
              fill={n.esAbandono ? "transparent" : COLOR[n.camino]}
              fillOpacity={n.esAbandono ? 0 : activo || seleccionado ? 0.3 : 0.16}
              stroke={COLOR[n.camino]}
              strokeWidth={n.esAbandono ? 1 : seleccionado ? 3 : 1.75}
              strokeDasharray={n.esAbandono ? "4 3" : undefined}
            />
            <text
              x={n.x + n.ancho / 2}
              y={n.y + n.alto / 2 + (densidad === "compacta" ? 5 : 6)}
              textAnchor="middle"
              paintOrder="stroke"
              stroke="var(--franco-card)"
              strokeWidth={3}
              strokeLinejoin="round"
              className={`pointer-events-none fill-[var(--franco-text)] font-mono font-bold ${
                densidad === "compacta" ? "text-[14px]" : "text-[16px]"
              }`}
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
              className="pointer-events-none fill-[var(--franco-text-secondary)] font-mono text-[11px]"
            >
              {n.etiqueta}
              {abrible ? " ▸" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
