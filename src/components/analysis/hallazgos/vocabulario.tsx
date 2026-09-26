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

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { pilaHojas } from "@/lib/hoja-pila";

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
 *  ("Qué haces con esto").
 *
 *  FORMA (17-sep-2026): regla de 1px arriba, sin caja, sin barra roja y sin itálica; el
 *  rótulo en `--doc-tx3` y el cuerpo en la misma escala que la prosa del capítulo. El
 *  plumón se conserva en `VProsa` y está NEUTRALIZADO acá. Todo eso vive en un solo bloque
 *  de `HallazgosAcordeon`, con su acta.
 *
 *  `data-v="cierre"` ya no habilita nada: la regla de cierre único que decía habilitar
 *  (`.hall-body .v-cierre:has(~ .v-cierre)`) se retiró con la forma nueva, y además
 *  seleccionaba por CLASE, no por este atributo. Se conserva como gancho de QA. */
export function VCierre({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div className="v-cierre" data-v="cierre">
      <div className="t">{titulo}</div>
      <p>{children}</p>
    </div>
  );
}

/** 4 · Línea de fuente/procedencia.
 *  `aviso` la sube de nota al pie a advertencia: se usa cuando lo que declara NO es de
 *  dónde salió un dato sino que ese dato no está contrastado. Sin color nuevo — toma el
 *  borde izquierdo de 3px en --doc-tx3, no Signal Red: un caveat no es una alarma. */
export function VFuente({ children, aviso = false }: { children: ReactNode; aviso?: boolean }) {
  return <div className={aviso ? "v-fuente aviso" : "v-fuente"}>{children}</div>;
}

// ═══════════════════ PRIMITIVAS DE DIAGRAMA ═══════════════════

/* `Thermo` se retiró el 22-sep-2026 con el capítulo III de STR, su único consumidor: comparaba el
 * estimador contra su propia mediana comunal y pintaba verde→ocre→rojo (al revés para ocupación). */

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
        ? "var(--doc-tx2)"
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
  /** T1 (STR · V): la serie "tuya" en Ink, sin criticidad — el modo de gestión que
   *  elegiste no es una alerta. Sin `tono` y sin `destacada` la barra es neutra. */
  tono?: "ink";
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
                background: r.destacada ? "var(--signal-red)" : r.tono === "ink" ? "var(--doc-tx)" : "var(--doc-neutral)",
              }}
            />
          </div>
          <span className={`bv${r.neg ? " neg" : ""}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/* `Spark` se retiró el 22-sep-2026: no lo montaba ninguna superficie y su leyenda usaba la CSS del Thermo. */

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
      {/* Ticks: una raya fina por frontera cruzando el riel (T1, contrato del CONGELADO). */}
      {bordes.map((b, i) => (
        <div key={`t${i}`} className="dial-tick" style={{ left: `${clamp(b.pos)}%` }} />
      ))}
      {/* Línea 2 · los bordes en DOS CELDAS bajo el riel (abajo a la izquierda, arriba a la
          derecha), estáticas: nunca se solapan aunque las fronteras queden pegadas. Antes
          iban absolutas sobre su posición y chocaban en PC y en 390. */}
      {bordes.length > 0 && (
        <div className="dial-edges">
          {(["abajo", "arriba"] as const).map((dir) => {
            const b = bordes.find((x) => x.dir === dir);
            return (
              <div key={dir} className={`dial-edge ${dir}`}>
                {b && (
                  <>
                    <span className="d">{b.delta}</span>
                    <span className="v">{b.v}</span>
                    <span className="k">{b.k}</span>
                  </>
                )}
              </div>
            );
          })}
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

// ⛔ `Cien` y `ParBarras` (con su tipo `FilaPar`) SE RETIRARON el 17-sep-2026.
// Su único consumidor eran los seis `Drawer*Str`, inalcanzables desde el 5-sep. No las
// marcaba el lint —estaban exportadas, así que nunca son «unused»— ni ningún gate: una
// primitiva del vocabulario sin consumidor se ve igual que una con consumidor.
// `CmpPares` estaba en el mismo lote y NO salió: la usa `EstructuraComparada`, que los
// capítulos sí montan.

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

// ⛔ `Escalera` y su tipo `FilaEscalera` SE RETIRARON el 17-sep-2026. Sus dos únicos
// consumidores eran `escalera-pie.tsx` y `escalera-plazo.tsx`: la del pie se retiró porque
// el capítulo IV ya dice lo mismo con más detalle (matriz pie × plazo con toggle Flujo/TIR),
// y la del plazo se convirtió en `LineaPlazo` —dos renglones— porque lo único que decía y
// nadie más dice es el interés total del crédito, que no necesita cuatro filas para caber.

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

/** Subtítulo de tramo dentro de un capítulo: serif, un escalón bajo el título del
 *  capítulo, Ink, 24px de aire arriba. Reemplaza los eyebrows mono que separaban
 *  tramos; la etiqueta mono del diagrama (VViz) se conserva debajo. */
export function VSub({ children }: { children: ReactNode }) {
  return <h4 className="v-sub">{children}</h4>;
}

/** Línea puente entre dos diagramas de un mismo capítulo: mono, Ink al 60%, una
 *  frase que justifica el segundo diagrama. */
export function VPuente({ children }: { children: ReactNode }) {
  return <p className="v-puente">{children}</p>;
}

export type HitoLinea = { k: string; sub?: string; v: string; tono?: "base" | "mid" | "end" };

/** Línea de tiempo con hitos y el delta entre cada par (compra en verde: firma →
 *  entrega → año 10). En mobile los hitos se apilan y las flechas apuntan abajo. */
export function LineaTiempo({ hitos, deltas, lectura }: { hitos: HitoLinea[]; deltas: { v: string; k: string }[]; lectura?: ReactNode }) {
  if (!hitos.length) return null;
  return (
    <>
      <div className="tl" style={{ gridTemplateColumns: hitos.map(() => "1fr").join(" auto ") }}>
        {hitos.map((h, i) => (
          <Fragment key={`h${i}`}>
            <div className={`hito ${h.tono ?? (i === 0 ? "base" : i === hitos.length - 1 ? "end" : "mid")}`}>
              <span className="k">{h.k}</span>
              {h.sub && <span className="d">{h.sub}</span>}
              <span className="v">{h.v}</span>
            </div>
            {i < hitos.length - 1 && deltas[i] && (
              <div className="tl-delta">
                <b>{deltas[i].v}</b>
                {deltas[i].k}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {lectura && <p className="lectura">{lectura}</p>}
    </>
  );
}


/** Hasta este ancho (px) el modal es HOJA desde abajo; desde el siguiente, panel centrado de 720. */
export const HOJA_MAX_ANCHO_PX = 767;
/** Lo que la hoja deja ver del informe por arriba, en px (el velo tocable que cierra). */
export const HOJA_VELO_PX = 56;
/** Arrastre hacia abajo (px) a partir del cual soltar cierra la hoja. */
export const HOJA_UMBRAL_CIERRE_PX = 90;

export type OrigenArrastre = "cabecera" | "cuerpo";

/**
 * El gesto sigue al dedo (y puede cerrar) desde la cabecera siempre, y desde el cuerpo
 * solo cuando el cuerpo está en el tope: a media lectura, arrastrar hacia abajo es scroll.
 */
export function arrastreSigueAlDedo(origen: OrigenArrastre, scrollTop: number): boolean {
  return origen === "cabecera" || scrollTop <= 0;
}

/** Soltar cierra si el gesto seguía al dedo y pasó el umbral. */
export function debeCerrarPorArrastre(a: { dy: number; origen: OrigenArrastre; scrollTop: number }): boolean {
  return a.dy >= HOJA_UMBRAL_CIERRE_PX && arrastreSigueAlDedo(a.origen, a.scrollTop);
}

/** `true` bajo 768 px de ancho (la forma hoja); `false` en el primer render, hasta medir. */
export function useEsHoja(): boolean {
  const [esHoja, setEsHoja] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${HOJA_MAX_ANCHO_PX}px)`);
    const leer = () => setEsHoja(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return esHoja;
}

/**
 * Modal del contrato, con DOS FORMAS por ancho en un solo componente (23-sep-2026):
 *  · ≥768 px: overlay Ink al 60%, panel centrado de 720 px máx, título serif, cierre
 *    con ✕, con Esc y con click fuera. Como estaba.
 *  · ≤767 px: HOJA desde abajo. Deja HOJA_VELO_PX del informe a la vista, radio arriba,
 *    asa, cabecera fija (título, sub y ✕) y el cuerpo es lo único que scrollea, con
 *    `overscroll-behavior: contain`. Cierra con la ✕, arrastrando hacia abajo (desde la
 *    cabecera, o desde el cuerpo en el tope), con el botón atrás del navegador (la hoja
 *    empuja un estado de historial al abrir y lo consume al cerrar) y tocando el velo.
 * En las dos formas el body queda bloqueado mientras está abierto y el scroll de la
 * página vuelve a la posición de apertura al cerrar. Motivo: medido el 22-sep en 390,
 * el modal a pantalla completa cerraba solo por la ✕ (que se iba con el scroll) y al
 * llegar al fondo encadenaba el scroll a la página, que quedaba 385 px más abajo.
 *
 * APILABLE (23-sep-2026, el ⓘ de los indicadores): la hoja chica de una glosa se abre ENCIMA
 * de la hoja de un capítulo o de la planilla. Atrás y Esc los administra `pilaHojas()` y cierran
 * solo la de arriba; el body lo bloquea solo el primer nivel (el segundo, al abrir, leería
 * `scrollY` = 0 y al cerrar devolvería la página al principio).
 * `variante="glosa"`: la hoja del alto del contenido con tope cerca de media pantalla, sin
 * sub ni pie, y en PORTAL al `.doc-dictamen` más cercano (fuera de la hoja de abajo, que
 * recorta y se transforma al arrastrar, pero dentro de los tokens del informe).
 */
export function Modal({
  abierto,
  onClose,
  titulo,
  sub,
  pie,
  children,
  variante,
  ancla,
}: {
  abierto: boolean;
  onClose: () => void;
  titulo: ReactNode;
  sub?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
  /** «glosa»: la hoja chica del ⓘ (solo teléfono; en escritorio el ⓘ abre un popover). */
  variante?: "glosa";
  /** Para la glosa: un elemento de adentro del informe, para portalizar al `.doc-dictamen` que lo contiene. */
  ancla?: HTMLElement | null;
}) {
  // Los consumidores pasan `onClose` inline (identidad nueva en cada render); los efectos
  // con estado propio —historial, arrastre— leen la ref para no re-correr por eso.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hojaRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const esHoja = useEsHoja();
  const esGlosa = variante === "glosa";

  // La pila: atrás y Esc cierran solo el nivel de arriba (hoja-pila.ts). El primer nivel,
  // además, bloquea el body y restaura el scroll al cerrar (position:fixed en body:
  // `overflow:hidden` solo no frena el touch en iOS), sin el `scroll-behavior:smooth` de
  // html en el medio.
  useEffect(() => {
    if (!abierto) return;
    const pila = pilaHojas();
    const primero = pila.profundidad() === 0;
    const id = pila.apilar(() => onCloseRef.current(), { conHistorial: esHoja });
    if (!primero) return () => pila.desapilar(id);
    const body = document.body;
    const html = document.documentElement;
    const y = window.scrollY;
    const previo = {
      position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right,
      paddingRight: body.style.paddingRight, overflow: html.style.overflow,
    };
    const barra = window.innerWidth - html.clientWidth;
    if (barra > 0) body.style.paddingRight = `${barra}px`;
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    html.style.overflow = "hidden";
    return () => {
      pila.desapilar(id);
      body.style.position = previo.position;
      body.style.top = previo.top;
      body.style.left = previo.left;
      body.style.right = previo.right;
      body.style.paddingRight = previo.paddingRight;
      html.style.overflow = previo.overflow;
      const suave = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
      html.style.scrollBehavior = suave;
    };
  }, [abierto, esHoja]);

  // Arrastrar hacia abajo (solo hoja). Listeners nativos: React registra touchmove como
  // passive y no deja frenar el scroll del cuerpo mientras la hoja sigue al dedo.
  useEffect(() => {
    if (!abierto || !esHoja) return;
    const hoja = hojaRef.current;
    const cuerpo = cuerpoRef.current;
    if (!hoja || !cuerpo) return;
    let y0 = 0;
    let dy = 0;
    let origen: OrigenArrastre = "cabecera";
    let activo = false;
    const onStart = (e: TouchEvent) => {
      y0 = e.touches[0].clientY;
      dy = 0;
      origen = cuerpo.contains(e.target as Node) ? "cuerpo" : "cabecera";
      activo = arrastreSigueAlDedo(origen, cuerpo.scrollTop);
      if (activo) hoja.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (!activo) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) {
        hoja.style.transform = "";
        if (origen === "cuerpo") activo = false; // el gesto se volvió scroll
        return;
      }
      e.preventDefault();
      hoja.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = () => {
      if (!activo) return;
      activo = false;
      hoja.style.transition = "";
      if (debeCerrarPorArrastre({ dy, origen, scrollTop: cuerpo.scrollTop })) onCloseRef.current();
      else hoja.style.transform = "";
    };
    hoja.addEventListener("touchstart", onStart, { passive: true });
    hoja.addEventListener("touchmove", onMove, { passive: false });
    hoja.addEventListener("touchend", onEnd);
    hoja.addEventListener("touchcancel", onEnd);
    return () => {
      hoja.removeEventListener("touchstart", onStart);
      hoja.removeEventListener("touchmove", onMove);
      hoja.removeEventListener("touchend", onEnd);
      hoja.removeEventListener("touchcancel", onEnd);
    };
  }, [abierto, esHoja]);

  if (!abierto) return null;
  const nodo = (
    <div className={`v-modal-overlay${esGlosa ? " v-glosa-overlay" : ""}`} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`v-modal${esGlosa ? " v-glosa" : ""}`} ref={hojaRef}>
        <div className="v-modal-asa" aria-hidden="true" />
        <div className="v-modal-head">
          <div className="v-modal-tit">
            <h3>{titulo}</h3>
            {sub && <p className="v-modal-sub">{sub}</p>}
          </div>
          <button type="button" className="v-modal-x" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="v-modal-cuerpo" ref={cuerpoRef}>
          {children}
          {pie && <div className="v-modal-pie">{pie}</div>}
        </div>
      </div>
    </div>
  );
  if (!esGlosa) return nodo;
  const destino = (ancla?.closest(".doc-dictamen") as HTMLElement | null) ?? (typeof document !== "undefined" ? document.body : null);
  return destino ? createPortal(<div className="doc-tokens">{nodo}</div>, destino) : nodo;
}
