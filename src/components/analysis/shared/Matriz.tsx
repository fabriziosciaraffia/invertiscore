"use client";

import type { ReactNode } from "react";
import type { Veredicto } from "@/lib/types";

/**
 * Matriz de sensibilización 4×4 (contrato `mockup-tablas.html`, sección "matriz").
 * Celdas cuadradas con cifra corta, ejes con dirección, la celda "hoy" con anillo y
 * rótulo, negativas en Signal Red. Sin scroll en 390: en mobile las columnas reparten
 * el ancho.
 *
 * Dos señales por celda, deterministas y del motor (goal "cruza por veredicto",
 * 06-sep-2026):
 *   · `umbral`: la celda supera el umbral de la serie visible (flujo ≥ 0 "cierra el
 *     mes" · TIR ≥ límite "sobre TIR 6%"). Borde verde + punto, como siempre.
 *   · `veredicto`: el veredicto ternario del motor con esa combinación. Si difiere del
 *     del caso (`veredictoBase`), la celda lleva la marca en JetBrains Mono e Ink
 *     ("↑ Comprar", "↓ Buscar"): sin color nuevo, porque la matriz no es uno de los
 *     usos permitidos de Signal Red (franco-design-system, lista cerrada).
 * La leyenda muestra solo los saltos que ocurren en esa matriz: sin celda, sin oración.
 *
 * Es render puro: el caller trae las celdas ya calculadas y formateadas (el motor
 * recomputa, la pieza dibuja). El toggle entre métricas (Flujo / TIR) también lo
 * maneja el caller; acá solo se pinta.
 */
export type CeldaMatriz = {
  /** Cifra corta ya formateada ("−$84k", "9,3%"). */
  v: string;
  neg?: boolean;
  /** Supera el umbral de la serie visible (flujo ≥ 0 · TIR ≥ límite). */
  umbral?: boolean;
  /** Veredicto del motor con esa combinación; se marca solo si difiere de `veredictoBase`. */
  veredicto?: Veredicto;
  hoy?: boolean;
  /** Tooltip nativo con la cifra completa y el veredicto. */
  title?: string;
};

const RANK: Record<Veredicto, number> = { "BUSCAR OTRA": 0, "AJUSTA SUPUESTOS": 1, COMPRAR: 2 };
/** Nombre del veredicto en lenguaje de usuario (compartido LTR / STR). */
export const nombreVeredicto = (v: Veredicto | string): string =>
  v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta supuestos" : "Buscar otra";
const nombreCorto = (v: Veredicto): string => (v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta" : "Buscar");

/** El salto de una celda respecto del caso: null si no cambia el veredicto. */
export function saltoVeredicto(v: Veredicto | undefined, base: Veredicto | undefined): { sube: boolean; v: Veredicto; tag: string; frase: string } | null {
  if (!v || !base || v === base) return null;
  const sube = RANK[v] > RANK[base];
  return { sube, v, tag: `${sube ? "↑" : "↓"} ${nombreCorto(v)}`, frase: `${sube ? "sube a" : "baja a"} ${nombreVeredicto(v)}` };
}

export type EjeMatriz = {
  /** Rótulo del eje con dirección ("→ más plazo", "↓ más pie"). */
  label: string;
  niveles: { k: string; sub?: string }[];
};

export function Matriz({
  id,
  ejeX,
  ejeY,
  celdas,
  veredictoBase,
  leyenda,
  toggle,
  cabecera,
  nota,
}: {
  id?: string;
  ejeX: EjeMatriz;
  ejeY: EjeMatriz;
  /** `ejeY.niveles.length × ejeX.niveles.length`, en orden fila → columna. */
  celdas: CeldaMatriz[][];
  /** Veredicto del caso: contra él se marca cada celda cuyo veredicto difiere. */
  veredictoBase?: Veredicto;
  /** Textos de la leyenda; `umbral` en versión larga y corta (mobile). Los saltos de
   *  veredicto se derivan de las celdas y no se pasan. */
  leyenda?: { hoy: string; umbral: string; umbralCorto?: string; neg?: string };
  toggle?: { opciones: { id: string; label: string }[]; activo: string; onChange: (id: string) => void };
  /** Texto a la izquierda del toggle (etiqueta mono del diagrama). */
  cabecera?: ReactNode;
  nota?: ReactNode;
}) {
  // Saltos presentes en ESTA matriz, de mayor a menor veredicto: sin celda, sin oración.
  const saltos = (() => {
    const vistos = new Map<Veredicto, ReturnType<typeof saltoVeredicto>>();
    for (const fila of celdas) for (const c of fila) {
      const s = saltoVeredicto(c.veredicto, veredictoBase);
      if (s && !vistos.has(s.v)) vistos.set(s.v, s);
    }
    return Array.from(vistos.values()).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => RANK[b.v] - RANK[a.v]);
  })();
  return (
    <div>
      {(toggle || cabecera) && (
        <div className="mx-head">
          <div className="v-viz-t" style={{ marginBottom: 0 }}>
            {cabecera}
          </div>
          {toggle && (
            <div className="mx-toggle" role="tablist">
              {toggle.opciones.map((o) => (
                <button key={o.id} type="button" role="tab" aria-selected={o.id === toggle.activo} className={o.id === toggle.activo ? "on" : ""} onClick={() => toggle.onChange(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="matriz" id={id} style={{ ["--n" as string]: String(ejeX.niveles.length) }}>
        <div className="mz-axis-x">{ejeX.label}</div>
        <div className="mz-axis-y">{ejeY.label}</div>
        <div className="mz-grid">
          <div className="mz-corner" />
          {ejeX.niveles.map((c, i) => (
            <div key={`c${i}`} className="mz-colh">
              {c.k}
              {c.sub && <small>{c.sub}</small>}
            </div>
          ))}
          {ejeY.niveles.map((f, fi) => (
            <RowCells key={`f${fi}`} fila={f} celdas={celdas[fi] ?? []} veredictoBase={veredictoBase} />
          ))}
        </div>
      </div>
      {leyenda && (
        <div className="mz-leg">
          <span>
            <i className="hoy" /> {leyenda.hoy}
          </span>
          <span>
            <i className="umbral" /> <span className="lg">{leyenda.umbral}</span>
            <span className="sh">{leyenda.umbralCorto ?? leyenda.umbral}</span>
          </span>
          {saltos.map((s) => (
            <span key={s.v}>
              <i className="ver">{s.sube ? "↑" : "↓"}</i> {s.frase}
            </span>
          ))}
          {leyenda.neg && (
            <span>
              <i style={{ borderColor: "var(--signal-red)" }} /> {leyenda.neg}
            </span>
          )}
        </div>
      )}
      {nota && <p className="mz-note">{nota}</p>}
    </div>
  );
}

function RowCells({ fila, celdas, veredictoBase }: { fila: { k: string; sub?: string }; celdas: CeldaMatriz[]; veredictoBase?: Veredicto }) {
  return (
    <>
      <div className="mz-rowh">
        {fila.k}
        {fila.sub && <small>{fila.sub}</small>}
      </div>
      {celdas.map((c, i) => {
        const salto = saltoVeredicto(c.veredicto, veredictoBase);
        return (
          <div key={i} className={`mz-cell${c.neg ? " neg" : ""}${c.umbral ? " umbral" : ""}${c.hoy ? " hoy" : ""}${salto ? " conver" : ""}`} title={c.title}>
            {c.hoy && <span className="mz-hoy">hoy</span>}
            <span className="mz-v">{c.v}</span>
            {salto && <span className="mz-ver" aria-label={salto.frase}>{salto.tag}</span>}
          </div>
        );
      })}
    </>
  );
}
