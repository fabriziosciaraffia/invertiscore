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

import { useState, type ReactNode } from "react";

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
  ceroPct,
  legend,
  invertido,
}: {
  pct: number;
  refPct?: number | null;
  /** Posición del CERO cuando la escala baja bajo cero (goal plusvalía): sin este
   *  hito, una marca a la izquierda de la referencia no distingue "creció menos"
   *  de "retrocedió". Se omite cuando el dominio arranca en 0 — ahí el cero es el
   *  borde y dibujarlo sería ruido. */
  ceroPct?: number | null;
  legend: [{ k: string; v: string }, { k: string; v: string }, { k: string; v: string }];
  /** true ⇒ el degradado corre rojo→ámbar→verde (la calidad CRECE hacia la
   *  derecha: ocupación, ingresos). El default (verde a la izquierda) es para
   *  ejes donde crecer es empeorar (caída de arriendo que aguanta el veredicto).
   *  El color codifica CALIDAD, no posición — misma semántica que el Dial. */
  invertido?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="thermo">
      <div className={`thermo-track${invertido ? " inv" : ""}`}>
        {ceroPct != null && <div className="thermo-cero" style={{ left: `${clamp(ceroPct)}%` }} />}
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

export type FallRow = {
  k: string;
  v: string;
  pct: number;
  tone?: "neutral" | "warn" | "muted" | "red";
  /** CORRECCIÓN 5 (FASE 4.1) — glosa de la fila. La migración de `costoMensual` al
   *  waterfall dejó de pasar el `tooltip` de cada `saleItem` al mapear a `Fall`: ~150
   *  palabras de explicación real ("Impuesto territorial trimestral del SII, prorrateado
   *  a mensual"…) quedaron vivas en el código y muertas en pantalla. Vuelven acá, en la
   *  pieza que ya existe, sin inventar un bloque nuevo. Se recibe montado para que el
   *  vocabulario no dependa del componente de tooltip. */
  tip?: ReactNode;
};

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
              {r.tip}
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

export type BarRow = {
  k: string;
  v: string;
  pct: number;
  /** Destaca el FILL de la barra (Signal Red). Es criticidad de la SERIE — la usa
   *  el equilibrio STR para "lo que necesitas". Ya NO pinta el numeral. */
  destacada?: boolean;
  /** El NUMERAL en Signal Red. Lo decide el SIGNO (Capa 1, uso #2: monetario
   *  negativo), no el destaque: una serie destacada con valor positivo mantiene su
   *  cifra en Ink. */
  neg?: boolean;
};

/** Barras comparativas: una fila por término de comparación.
 *
 *  REGLA DE USO (FASE 4.2) — una barra que arranca en CERO solo comunica cuando las
 *  magnitudes difieren en órdenes visibles. Para diferencias porcentuales pequeñas no
 *  sirve: la tabla de negociación comparaba cuatro precios que difieren ~10% y las
 *  cuatro barras caían entre el 65% y el 95% del ancho, así que la diferencia que
 *  decide el veredicto era indistinguible del ruido. Para esos casos va un eje
 *  posicional (`Dial`) o la comparación explícita del par (`CmpPares`). */
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
          <span className={`bv${r.neg ? " neg" : ""}`}>{r.v}</span>
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

export type TablaFila = {
  celdas: string[];
  destacada?: boolean;
  tonos?: (("neg" | "pos") | null)[];
  /** Marca el CRUCE: borde superior en tono good. La fila donde la comparación
   *  cambia de signo (aprobado: "recién sobre P75 el corto le gana al largo"). */
  cruce?: boolean;
};

/** Tabla con scroll horizontal CONTENIDO + cue. El scroll nunca es del documento. */
export function Tabla({
  headers,
  filas,
  cue = true,
  cruceLbl,
}: {
  headers: string[];
  filas: TablaFila[];
  cue?: boolean;
  /** Etiqueta del cruce, colgada bajo la tabla ("↑ recién sobre P75 …"). */
  cruceLbl?: ReactNode;
}) {
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
              <tr key={i} className={[f.destacada && "hl", f.cruce && "cruce"].filter(Boolean).join(" ") || undefined}>
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
      {cruceLbl && <span className="tbl-crucelbl">{cruceLbl}</span>}
      {cue && <div className="tbl-scrollcue">↔ desliza la tabla</div>}
    </>
  );
}

// ═══════════ PRIMITIVAS DE FASE 4.1 (conversiones aprobadas) ═══════════
//
// REGLA DE ETIQUETAS (vinculante para las cuatro): una etiqueta de REFERENCIA
// (banda, zona, umbral) y una de MARCA (el dato del usuario) nunca comparten
// línea cuando su posición depende de datos — se solapan en cuanto los valores
// se acercan. La referencia ancla a su propio borde; la marca va en otra línea.

export type FilaPalanca = {
  nombre: string;
  /** Delta ya formateado por el caller ("+11,0%", "−40%", "+5 años"). */
  delta: string;
  /** true ⇒ cruza el umbral dentro del tope de honestidad. */
  alcanza: boolean;
  origen?: string;
  destino?: string;
  /** Razón corta de por qué no basta. Catálogo determinista del motor, nunca IA. */
  razon?: string;
  /** Lavado de la fila (degradado aprobado): "warn" = la palanca que alcanza en
   *  distancia (propuesta-01-v2) · "good" = la palanca real en rentabilidad
   *  (propuesta-15-pie-v3). Explícito por caller: la primitiva no adivina. */
  wash?: "warn" | "good";
  /** Traducción de la jerga bajo el nombre (fase42 D-15c): "cuántas noches del
   *  mes se llenan". Determinista del caller, nunca IA. */
  glosa?: string;
};

/** Matriz de palancas: una fila por palanca, con delta, veredicto y magnitudes
 *  origen→destino. Lista vacía ⇒ no se dibuja (el caller cae a prosa). */
export function Palancas({ filas, pie }: { filas: FilaPalanca[]; pie?: ReactNode }) {
  if (!filas.length) return null;
  return (
    <div className="pal">
      {filas.map((f, i) => (
        <div key={i} className={`pal-row${f.alcanza ? " si" : ""}${f.wash ? ` wash-${f.wash}` : ""}`}>
          <div className="pal-name">
            {f.nombre}
            <span className={`pal-delta ${f.alcanza ? "si" : "no"}`}>{f.delta}</span>
            {f.glosa && <small className="pal-glosa">{f.glosa}</small>}
          </div>
          <div className={`pal-verdict ${f.alcanza ? "si" : "no"}`}>{f.alcanza ? "✓" : "✕"}</div>
          {(f.origen || f.razon) && (
            <div className="pal-detail">
              {f.origen && (
                <>
                  {f.origen}
                  {f.destino && (
                    <>
                      <span className="pal-arrow">→</span>
                      {f.destino}
                    </>
                  )}
                </>
              )}
              {f.razon && (
                <span className="pal-why">
                  {f.origen ? " · " : ""}
                  {f.razon}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      {pie && <div className="pal-pie">{pie}</div>}
    </div>
  );
}

export type ZonaDial = { k: string; pct: number; tono: "buscar" | "ajusta" | "comprar" };
export type BordeDial = { pos: number; delta: string; v: string; k: string; dir: "abajo" | "arriba" };

/** Dial de veredicto: zonas + aguja del valor declarado + bordes con su delta.
 *  Solo se pintan las zonas y los bordes que el caller puede posicionar con
 *  datos reales: sin veredicto de destino NO hay corte (corrección 7). */
export function Dial({
  zonas,
  marcaPct,
  marcaK,
  marcaV,
  bordes,
}: {
  zonas: ZonaDial[];
  marcaPct: number;
  marcaK: string;
  marcaV: string;
  bordes: BordeDial[];
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="dial">
      {/* Línea 1 · SOLO la marca (regla de etiquetas). */}
      <div className="dial-marklbl" style={{ left: `${clamp(marcaPct)}%` }}>
        <span className="k">{marcaK}</span>
        <span className="v">{marcaV}</span>
      </div>
      <div className="dial-track">
        {zonas.map((z, i) => (
          <div key={i} className={`dial-zone ${z.tono}`} style={{ width: `${clamp(z.pct)}%` }}>
            {z.pct >= 14 && <span>{z.k}</span>}
          </div>
        ))}
      </div>
      <div className="dial-mark" style={{ left: `${clamp(marcaPct)}%` }} />
      {/* Línea 2 · SOLO los bordes, cada uno anclado a su lado. */}
      {bordes.length > 0 && (
        <div className="dial-edges">
          {bordes.map((b, i) => (
            <div key={i} className={`dial-edge ${b.dir}`} style={{ left: `${clamp(b.pos)}%` }}>
              <span className="d">{b.delta}</span>
              <span className="v">{b.v}</span>
              <span className="k">{b.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type SegComposicion = {
  k: string;
  sub?: string;
  v: string;
  pct: number;
  tono: "pie" | "amort" | "plus" | "aporte";
  /** Rayado: depende de una proyección, no de un contrato. */
  proyectado?: boolean;
};

/** Barra de composición con llaves opcionales. Se usa SOLO cuando los segmentos
 *  suman el total; cuando no suman (multiplicador < 1) el caller compara con
 *  `Bars` en vez de forzar una composición que no cierra. */
export function Composicion({
  segmentos,
  llaves,
  total,
}: {
  segmentos: SegComposicion[];
  llaves?: { k: string; pct: number }[];
  total?: { k: string; v: string };
}) {
  const suma = segmentos.reduce((a, s) => a + Math.max(0, s.pct), 0) || 1;
  return (
    <div className="compo-wrap">
      {llaves && llaves.length > 0 && (
        <div className="compo-brackets">
          {llaves.map((l, i) => (
            <div key={i} className="compo-bracket" style={{ width: `${Math.max(0, Math.min(100, l.pct))}%` }}>
              {l.k} · <b>{Math.round(l.pct)}%</b>
            </div>
          ))}
        </div>
      )}
      <div className="compo-track">
        {segmentos.map((s, i) => (
          <div
            key={i}
            className={`compo-seg ${s.tono}${s.proyectado ? " proy" : ""}`}
            style={{ width: `${(Math.max(0, s.pct) / suma) * 100}%` }}
          />
        ))}
      </div>
      <div className="compo-leg">
        {segmentos.map((s, i) => (
          <div key={i} className="compo-leg-row">
            <span className={`compo-sw ${s.tono}${s.proyectado ? " proy" : ""}`} />
            <span className="compo-k">
              {s.k}
              {s.sub && <small>{s.sub}</small>}
            </span>
            <span className="compo-v">{s.v}</span>
          </div>
        ))}
      </div>
      {total && (
        <div className="compo-total">
          <span className="k">{total.k}</span>
          <span className="v">{total.v}</span>
        </div>
      )}
    </div>
  );
}

/** Barra de $100 con banda de referencia y corte marcado. `desborde` ⇒ el corte
 *  real excede 100: la barra se corta en 100 y la cifra va afuera; nunca se
 *  dibuja un segmento negativo. */
export function Cien({
  segmentos,
  banda,
  cortePct,
  corteLabel,
  desborde,
}: {
  segmentos: { k: string; v: string; sub?: string; pct: number; tono: "oper" | "com" | "util" }[];
  banda?: { desde: number; hasta: number; label: string } | null;
  cortePct: number;
  corteLabel: string;
  desborde?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const corte = clamp(cortePct);
  // Regla de etiquetas: la banda ancla al borde MÁS LEJANO del corte, para que
  // las dos se separen en vez de encimarse cuando el corte cae dentro o al lado.
  const bandaIzq = banda ? clamp(banda.desde) : 0;
  const bandaDer = banda ? clamp(banda.hasta) : 0;
  const bandaAncla = banda && corte >= bandaDer ? "izq" : "der";
  return (
    <div className="cien">
      {banda && (
        <>
          <div
            className="cien-banda"
            style={{ left: `${bandaIzq}%`, width: `${Math.max(0, bandaDer - bandaIzq)}%` }}
          />
          <div
            className={`cien-banda-lbl ${bandaAncla}`}
            style={bandaAncla === "izq" ? { left: `${bandaIzq}%` } : { left: `${bandaDer}%` }}
          >
            {banda.label}
          </div>
        </>
      )}
      <div className="cien-track">
        {segmentos.map((s, i) => (
          <div key={i} className={`cien-seg ${s.tono}`} style={{ width: `${clamp(s.pct)}%` }} />
        ))}
        {desborde && <div className="cien-desborde" />}
      </div>
      <div className="cien-corte" style={{ left: `${corte}%` }} />
      <div className="cien-corte-lbl" style={{ left: `${corte}%` }}>
        {corteLabel}
      </div>
      <div className="compo-leg">
        {segmentos.map((s, i) => (
          <div key={i} className="compo-leg-row">
            <span className={`compo-sw ${s.tono}`} />
            <span className="compo-k">
              {s.k}
              {s.sub && <small>{s.sub}</small>}
            </span>
            <span className="compo-v">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ParCmp = {
  /** Concepto comparado ("Por metro cuadrado", "Tasa de interés"). */
  k: string;
  sub?: string;
  /** Estado del par, ya resuelto por el caller: es juicio del motor, no del render. */
  tag?: { texto: string; tono: "ok" | "flojo" | "par" };
  tuyo: { lbl: string; v: string; pct: number };
  /** Opcional (fase42 D-13/L2): una fila sin referencia dibuja solo la barra
   *  propia — para magnitudes cuyo contexto vive en otro diagrama (el pie y su
   *  escalera) o cuya escala es natural (pie = % del precio). */
  ref?: { lbl: string; v: string; pct: number };
};

/** Comparación explícita tuyo-contra-referencia: dos barras apareadas por concepto.
 *  Es la forma correcta cuando los dos términos difieren poco (ver la regla de uso de
 *  `Bars`): al ponerlos uno sobre otro en la misma escala, la diferencia se lee aunque
 *  sea de un dígito, porque el ojo compara los extremos y no el largo absoluto. */
export function CmpPares({ filas, pie }: { filas: ParCmp[]; pie?: ReactNode }) {
  if (!filas.length) return null;
  return (
    <div className="cmp">
      {filas.map((f, i) => (
        <div key={i} className="cmp-row">
          <div className="cmp-top">
            <span className="cmp-k">
              {f.k}
              {f.sub && <small>{f.sub}</small>}
            </span>
            {f.tag && <span className={`cmp-tag ${f.tag.tono}`}>{f.tag.texto}</span>}
          </div>
          {[f.tuyo, ...(f.ref ? [f.ref] : [])].map((b, j) => (
            <div key={j} className="cmp-line">
              <span className="cmp-lbl">{b.lbl}</span>
              <div className="cmp-track">
                <div
                  className={`cmp-fill ${j === 0 ? "tuyo" : "ref"}${j === 0 && f.tag?.tono === "ok" ? " ok" : ""}`}
                  style={{ width: `${Math.max(0, Math.min(100, b.pct))}%` }}
                />
              </div>
              <span className="cmp-v">{b.v}</span>
            </div>
          ))}
        </div>
      ))}
      {pie && <div className="cmp-pie">{pie}</div>}
    </div>
  );
}

export type FilaEscenario = {
  k: string;
  /** Supuesto EN PALABRAS (§2.2 A12 del skill: nunca "P25"/"P50" fuera de la tabla de
   *  percentiles). Si los escenarios no mueven las mismas variables, acá se declara. */
  supuesto: string;
  v: string;
  pct: number;
  tono: "pes" | "base" | "opt";
};

/** Rango de escenarios: una barra por escenario con su supuesto declarado. */
export function Escenarios({ filas, pie }: { filas: FilaEscenario[]; pie?: ReactNode }) {
  if (!filas.length) return null;
  return (
    <div className="esc">
      {filas.map((f, i) => (
        <div key={i} className={`esc-row${f.tono === "base" ? " base" : ""}`}>
          <span className="esc-k">
            {f.k}
            <small>{f.supuesto}</small>
          </span>
          <div className="esc-track">
            <div className={`esc-fill ${f.tono}`} style={{ width: `${Math.max(0, Math.min(100, f.pct))}%` }} />
          </div>
          <span className="esc-v">{f.v}</span>
        </div>
      ))}
      {pie && <div className="esc-foot">{pie}</div>}
    </div>
  );
}

/** Una fila de escalera. Campos NEUTROS a propósito: la primitiva la comparten la
 *  escalera del pie (nivel = pie · costo = TIR) y la del plazo (nivel = años ·
 *  costo = interés total del crédito). Nombrarlos `pie`/`tir` obligaba al segundo
 *  llamador a usar campos que mienten sobre lo que llevan. */
export type FilaEscalera = {
  /** Columna 1: el nivel ("20%", "25 años"). */
  nivel: string;
  /** Subtexto del nivel ("$19,0M", "hoy"). */
  nivelSub: string;
  esActual: boolean;
  /** Columna 2: el efecto en el mes. Compartida por las dos escaleras. */
  flujo: string;
  flujoNegativo: boolean;
  /** Delta contra el nivel actual ("+$52K mejor"). Vacío en la fila actual. */
  flujoDelta?: string;
  /** Columna 3: el COSTO propio de esa palanca — TIR en el pie, interés total en el
   *  plazo. Sin ella la escalera muestra media verdad ("más siempre mejor"), que es
   *  el sesgo del óptimo fijo que este diagrama reemplazó. */
  costo: string;
  /** Subtexto del costo. En el plazo lleva el horizonte de ESA fila ("a 25 años"),
   *  que es la única cifra del informe que no habla a 10 años. */
  costoSub?: string;
};

/** Escalera: el trade-off completo, un nivel por fila. Las DOS columnas de valor son
 *  obligatorias. `cols` rota los rótulos entre las dos palancas; `ancha` da a la
 *  tercera columna el espacio que necesita un monto (la del pie lleva un porcentaje
 *  y le bastan 62px). */
export function Escalera({
  filas,
  pie,
  cols = ["Pie", "Tu flujo mensual", "TIR"],
  ancha,
}: {
  filas: FilaEscalera[];
  pie?: ReactNode;
  cols?: [string, string, string];
  ancha?: boolean;
}) {
  if (!filas.length) return null;
  return (
    <div className={`esca${ancha ? " ancha" : ""}`}>
      <div className="esca-head">
        <span>{cols[0]}</span>
        <span>{cols[1]}</span>
        <span>{cols[2]}</span>
      </div>
      {filas.map((f, i) => (
        <div key={i} className={`esca-row${f.esActual ? " hoy" : ""}`}>
          <span className="esca-pie">
            {f.nivel}
            <small>
              {f.nivelSub}
              {f.esActual ? " · hoy" : ""}
            </small>
          </span>
          <span className={`esca-v${f.flujoNegativo ? " neg" : " pos"}`}>
            {f.flujo}
            {f.flujoDelta && <small>{f.flujoDelta}</small>}
          </span>
          <span className="esca-v">
            {f.costo}
            {f.costoSub && <small>{f.costoSub}</small>}
          </span>
        </div>
      ))}
      {pie && <div className="esca-foot">{pie}</div>}
    </div>
  );
}

/** Plegable del vocabulario. El CSS (`.v-collapse`) existía desde el rediseño y no
 *  tenía llamador: se escribió para exactamente esto — una segunda lectura que no
 *  debe competir con la principal del cuerpo. */
export function VCollapse({ t, children }: { t: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {abierto && children}
      <button type="button" className="v-collapse" onClick={() => setAbierto((v) => !v)}>
        {abierto ? "↑ Ocultar" : t}
      </button>
    </>
  );
}

export type FilaPar = { k: string; consecuencia: string; v: string; pct: number; destacada?: boolean };

/** Par de barras con consecuencia: compara dos modos y muestra qué resulta de
 *  cada uno. La consecuencia va arriba de la barra, nunca sobre el track. */
export function ParBarras({ filas, cap }: { filas: FilaPar[]; cap?: ReactNode }) {
  if (!filas.length) return null;
  return (
    <div className="par">
      {cap && <div className="par-cap">{cap}</div>}
      {filas.map((f, i) => (
        <div key={i} className="par-row">
          <div className="par-top">
            <span className="par-k">{f.k}</span>
            <span className="par-cons">{f.consecuencia}</span>
          </div>
          <div className="par-bar">
            <div className="par-track">
              <div
                className={`par-fill${f.destacada ? " alta" : ""}`}
                style={{ width: `${Math.max(0, Math.min(100, f.pct))}%` }}
              />
            </div>
            <span className="par-v">{f.v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
