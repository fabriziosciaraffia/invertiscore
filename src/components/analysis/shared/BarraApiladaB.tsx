"use client";

import { useAncho } from "./useAncho";

/**
 * «De dónde sale tu parte» — UNA barra apilada firme/proyectado, forma B (rótulo y cifra
 * sobre cada tramo, se lee sin tocar), del capítulo «Tu resultado» (mockup
 * capitulo-v-resultado.html, aprobado 22-sep-2026). Reemplaza a la barra del día 1 + la
 * apilada con filas, tags y subs.
 *
 * Los tres tramos son plata que te queda, así que ninguno es rojo: pie y amortización en dos
 * intensidades de tinta (`--doc-ink1` / `--doc-tx`), plusvalía en trama de tinta. El rótulo va
 * DENTRO del tramo solo si es sólido y pasa del 30% del ancho (a 700 px son ~95 px); la
 * plusvalía va SIEMPRE debajo con guía (sobre la trama el texto no se lee) y los tramos
 * angostos también. Cuando tu parte cae bajo lo puesto, la leyenda dice «Pusiste / Te queda» y
 * el «Te queda» va en Signal Red, como el encabezado; la barra no cambia.
 */
export interface TramoApilado {
  tono: "pie" | "amort" | "plus";
  k: string;
  v: number;
}

const UMBRAL_DENTRO_PCT = 30;
/** Píxeles que necesita «Amortización $37,9 MM» a 10,5 px en negrita (medido en mobile: a 99 px se
 *  recortaba): bajo esto el rótulo baja con guía. */
const MIN_PX_DENTRO = 130;

export function BarraApiladaB({
  tramos,
  leyenda,
  fmt,
  nota,
}: {
  tramos: TramoApilado[];
  /** «Firme · 57% / Proyectado · 43%», o «Pusiste X / Te queda Y» (con `rojo`) cuando no cierra. */
  leyenda: { izq: string; der: string; rojo?: boolean };
  fmt: (n: number) => string;
  /** Una línea: qué es cada tramo. */
  nota?: string;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const vivos = tramos.filter((t) => t.v > 0);
  const total = vivos.reduce((s, t) => s + t.v, 0);
  if (!(total > 0)) return null;
  const conPct = vivos.map((t) => ({ ...t, pct: (t.v / total) * 100 }));
  // Dentro del tramo solo si es sólido, pasa del 30% y, medido el ancho, caben los píxeles del rótulo.
  const dentro = (t: { tono: string; pct: number }) => t.tono !== "plus" && t.pct >= UMBRAL_DENTRO_PCT && (ancho == null || (t.pct / 100) * ancho >= MIN_PX_DENTRO);
  let acc = 0;
  const centros = conPct.map((t) => { const c = acc + t.pct / 2; acc += t.pct; return c; });
  const abajo = conPct.map((t, i) => ({ t, c: centros[i] })).filter(({ t }) => !dentro(t));
  return (
    <div className="bb" ref={ref}>
      <div className="bb-fp">
        <span>{leyenda.izq}</span>
        <span className={leyenda.rojo ? "bb-rojo" : undefined}>{leyenda.der}</span>
      </div>
      <div className="bb-bar">
        {conPct.map((t) => (
          <div key={t.tono} className={`bb-s ${t.tono}${dentro(t) ? " bb-lab" : ""}`} style={{ width: `${t.pct}%` }} aria-label={`${t.k}: ${fmt(t.v)}`}>
            {dentro(t) ? `${t.k} ${fmt(t.v)}` : ""}
          </div>
        ))}
      </div>
      {abajo.length > 0 && (
        <div className="bb-rotulos">
          {abajo.map(({ t, c }) => (
            <span key={t.tono} style={{ left: `${Math.min(88, Math.max(12, c))}%` }}>
              <b>{t.k}</b>
              {fmt(t.v)}
            </span>
          ))}
        </div>
      )}
      {nota && <p className="bb-nota">{nota}</p>}
    </div>
  );
}
