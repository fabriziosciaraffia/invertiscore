"use client";

import type { ReactNode } from "react";

/**
 * Matriz de sensibilización 4×4 (contrato `mockup-tablas.html`, sección "matriz").
 * Celdas cuadradas con cifra corta, ejes con dirección, la celda "hoy" con anillo y
 * rótulo, las que cruzan con borde verde y punto, negativas en Signal Red. Sin scroll
 * en 390: en mobile las columnas reparten el ancho.
 *
 * Es render puro: el caller trae las celdas ya calculadas y formateadas (el motor
 * bisecciona, la pieza dibuja). El toggle entre métricas (Flujo / TIR) también lo
 * maneja el caller; acá solo se pinta.
 */
export type CeldaMatriz = {
  /** Cifra corta ya formateada ("−$84k", "9,3%"). */
  v: string;
  neg?: boolean;
  cruza?: boolean;
  hoy?: boolean;
  /** Tooltip nativo con la cifra completa y el veredicto. */
  title?: string;
};

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
  /** Textos de la leyenda; `cruza` en versión larga y corta (mobile). */
  leyenda?: { hoy: string; cruza: string; cruzaCorto?: string; neg?: string };
  toggle?: { opciones: { id: string; label: string }[]; activo: string; onChange: (id: string) => void };
  /** Texto a la izquierda del toggle (etiqueta mono del diagrama). */
  cabecera?: ReactNode;
  nota?: ReactNode;
}) {
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
            <RowCells key={`f${fi}`} fila={f} celdas={celdas[fi] ?? []} />
          ))}
        </div>
      </div>
      {leyenda && (
        <div className="mz-leg">
          <span>
            <i className="hoy" /> {leyenda.hoy}
          </span>
          <span>
            <i className="cruza" /> <span className="lg">{leyenda.cruza}</span>
            <span className="sh">{leyenda.cruzaCorto ?? leyenda.cruza}</span>
          </span>
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

function RowCells({ fila, celdas }: { fila: { k: string; sub?: string }; celdas: CeldaMatriz[] }) {
  return (
    <>
      <div className="mz-rowh">
        {fila.k}
        {fila.sub && <small>{fila.sub}</small>}
      </div>
      {celdas.map((c, i) => (
        <div key={i} className={`mz-cell${c.neg ? " neg" : ""}${c.cruza ? " cruza" : ""}${c.hoy ? " hoy" : ""}`} title={c.title}>
          {c.hoy && <span className="mz-hoy">hoy</span>}
          <span className="mz-v">{c.v}</span>
        </div>
      ))}
    </>
  );
}
