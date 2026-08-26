"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VOCABULARIO ÚNICO del interior de hallazgos — FASE 4 (mockup v12 CONGELADO).
//
// Cuatro piezas y NINGUNA otra. Reemplaza los dos vocabularios que convivían en
// los 26 drawers (DataRow/Chips · CajaFranco/StateBox/Box · NarrativeIA/Lead):
//   1. VProsa   — prosa (IA o motor). El <mark> del plumón vive acá (weight 500).
//   2. VViz     — contenedor canónico de TODO diagrama, con su etiqueta mono.
//   3. VCierre  — UNA caja de cierre; el título rota entre "Qué significa"
//                 (interpretación) y "Qué haces con esto" (acción).
//   4. VFuente  — línea de procedencia.
//
// MANTRA (decisión 4 del contrato): si un dato se puede mostrar, no se cuenta —
// diagrama antes que párrafo. Las primitivas de diagrama (Thermo, Fall, Bars,
// Spark, Tabla) existen para que el motor tenga siempre una forma visual a mano.
//
// Tokens: reusa los `--doc-*` del DocumentoFrame (paleta papel v8, light
// primario + paridad dark). No define paleta propia: el interior es parte del
// mismo documento que la portada.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";

/** 1 · Prosa. El <mark> del plumón lo pinta el CSS del acordeón. */
export function VProsa({ children }: { children: ReactNode }) {
  return <div className="v-prosa">{children}</div>;
}

/** 2 · Bloque visual. `t` es la etiqueta mono que nombra QUÉ muestra el diagrama. */
export function VViz({ t, children }: { t?: ReactNode; children: ReactNode }) {
  return (
    <div className="v-viz">
      {t && <div className="v-viz-t">{t}</div>}
      {children}
    </div>
  );
}

/** 3 · Cierre único. `titulo` rota: interpretación ("Qué significa") vs acción
 *  ("Qué haces con esto"). El `data-v="cierre"` habilita la regla de cierre
 *  único del acordeón (ver TokensHallazgos). */
export function VCierre({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div className="v-cierre" data-v="cierre">
      <div className="t">{titulo}</div>
      <p>{children}</p>
    </div>
  );
}

/** 4 · Línea de fuente/procedencia. */
export function VFuente({ children }: { children: ReactNode }) {
  return <div className="v-fuente">{children}</div>;
}

// ═══════════════════ PRIMITIVAS DE DIAGRAMA ═══════════════════

/** Termómetro: posición en un rango, con marca propia y referencia opcional.
 *  `pct` y `refPct` en 0-100. Leyendas [izquierda, centro, derecha]. */
export function Thermo({
  pct,
  refPct,
  legend,
}: {
  pct: number;
  refPct?: number | null;
  legend: [{ k: string; v: string }, { k: string; v: string }, { k: string; v: string }];
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="thermo">
      <div className="thermo-track">
        {refPct != null && <div className="thermo-ref" style={{ left: `${clamp(refPct)}%` }} />}
        <div className="thermo-mark" style={{ left: `${clamp(pct)}%` }} />
      </div>
      <div className="thermo-legend">
        <span>
          {legend[0].k}
          <b>{legend[0].v}</b>
        </span>
        <span style={{ textAlign: "center" }}>
          {legend[1].k}
          <b>{legend[1].v}</b>
        </span>
        <span style={{ textAlign: "right" }}>
          {legend[2].k}
          <b>{legend[2].v}</b>
        </span>
      </div>
    </div>
  );
}

export type FallRow = { k: string; v: string; pct: number; tone?: "neutral" | "warn" | "muted" | "red" };

/** Waterfall de descomposición: banda proporcional + filas + total. */
export function Fall({ rows, total }: { rows: FallRow[]; total?: { k: string; v: string } }) {
  const color = (t: FallRow["tone"]) =>
    t === "red"
      ? "var(--signal-red)"
      : t === "warn"
        ? "var(--doc-warn)"
        : t === "muted"
          ? "var(--doc-tx4)"
          : "var(--doc-neutral)";
  const suma = rows.reduce((a, r) => a + Math.max(0, r.pct), 0) || 1;
  return (
    <>
      <div className="fall-visual">
        {rows.map((r, i) => (
          <span key={i} style={{ width: `${(Math.max(0, r.pct) / suma) * 100}%`, background: color(r.tone) }} />
        ))}
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={i} className="fall-row">
            <span className="fk" style={{ ["--c" as string]: color(r.tone) }}>
              {r.k}
            </span>
            <span className="fv">{r.v}</span>
          </div>
        ))}
        {total && (
          <div className="fall-row total">
            <span className="fk">{total.k}</span>
            <span className="fv">{total.v}</span>
          </div>
        )}
      </div>
    </>
  );
}

export type BarRow = { k: string; v: string; pct: number; destacada?: boolean };

/** Barras comparativas: una fila por término de comparación. */
export function Bars({ rows }: { rows: BarRow[] }) {
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div key={i} className="bar-row">
          <span className="bk">{r.k}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(0, Math.min(100, r.pct))}%`,
                background: r.destacada ? "var(--signal-red)" : "var(--doc-neutral)",
              }}
            />
          </div>
          <span className="bv" style={r.destacada ? { color: "var(--signal-red)" } : undefined}>
            {r.v}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Sparkline SVG: serie temporal con área. `puntos` normalizados 0-1. */
export function Spark({ puntos, ejeX, aria }: { puntos: number[]; ejeX: string[]; aria: string }) {
  if (puntos.length < 2) return null;
  const W = 600;
  const H = 150;
  const paso = (W - 20) / (puntos.length - 1);
  const y = (p: number) => H - 26 - Math.max(0, Math.min(1, p)) * (H - 52);
  const pts = puntos.map((p, i) => `${10 + i * paso},${y(p).toFixed(1)}`).join(" ");
  return (
    <>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={aria}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--doc-line2)" strokeWidth="1" strokeDasharray="4 4" />
        <polygon fill="var(--doc-hl)" points={`${pts} ${10 + (puntos.length - 1) * paso},${H} 10,${H}`} />
        <polyline fill="none" stroke="var(--signal-red)" strokeWidth="3" points={pts} />
      </svg>
      <div className="thermo-legend" style={{ marginTop: 4 }}>
        {ejeX.map((e, i) => (
          <span
            key={i}
            style={i === ejeX.length - 1 ? { textAlign: "right" } : i > 0 ? { textAlign: "center" } : undefined}
          >
            {e}
          </span>
        ))}
      </div>
    </>
  );
}

export type TablaFila = { celdas: string[]; destacada?: boolean; tonos?: (("neg" | "pos") | null)[] };

/** Tabla con scroll horizontal CONTENIDO + cue. El scroll nunca es del documento. */
export function Tabla({ headers, filas, cue = true }: { headers: string[]; filas: TablaFila[]; cue?: boolean }) {
  return (
    <>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className={f.destacada ? "hl" : undefined}>
                {f.celdas.map((c, j) => (
                  <td
                    key={j}
                    className={f.tonos?.[j] === "neg" ? "cell-neg" : f.tonos?.[j] === "pos" ? "cell-pos" : undefined}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cue && <div className="tbl-scrollcue">↔ desliza la tabla</div>}
    </>
  );
}
