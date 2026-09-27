"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LAS FILAS EDITABLES DEL WIZARD (entrega 2, 27-sep-2026)
//
// Un solo formato para editar en todo el wizard: los supuestos del arriendo, los costos de la
// tarifa y las tres tarjetas del resumen. Rótulo y procedencia a la izquierda; el valor en una
// píldora a la derecha, con su lápiz. Tocar la píldora la vuelve campo en el lugar.
//
// La CONDUCTA es la de `NumericInput` —mismas funciones puras, misma precisión por campo (`DEC`)—
// y la del editor inline que tenía el resumen: el commit es al salir del campo o con Enter, Esc
// cancela, y salir sin cambiar el valor NO es corregirlo (`esEdicionReal`). Lo escrito se guarda
// TAL CUAL aunque no se pueda leer; en reposo, la fila lo dice.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import type { Decimales } from "@/lib/numero-cl";
import { ecoPorDefecto, estadoNumericInput } from "./NumericInput";
import { esEdicionReal } from "./derive";
import type { AvisoEscala } from "./avisoEscala";

/** Aviso de magnitud bajo una fila: gris, sin rótulo. Nunca rojo (el rojo dice «no te entendí»). */
function Indicacion({ children }: { children: ReactNode }) {
  return <span className="wz-fe-nota wz-indic">{children}</span>;
}

/** La píldora del valor en reposo: el número, la unidad en gris y el lápiz. */
function Pildora({ texto, unidad, onClick, etiqueta }: { texto: ReactNode; unidad?: string; onClick: () => void; etiqueta: string }) {
  return (
    <button type="button" className="wz-v wz-v-btn" onClick={onClick} aria-label={`${etiqueta}: ${typeof texto === "string" ? texto : ""}${unidad ?? ""}. Toca para cambiarlo.`}>
      <span>{texto}</span>
      {unidad && <span className="wz-u">{unidad}</span>}
      <Pencil size={12} className="wz-lap" aria-hidden />
    </button>
  );
}

/** Campo numérico dentro de la píldora. Commit en blur / Enter, cancel en Escape. */
function PildoraInput({
  initial,
  decimales,
  formatEco,
  escala,
  fuente,
  unidad,
  etiqueta,
  onCommit,
  onCancel,
}: {
  initial: string;
  decimales: Decimales;
  formatEco: (valor: number) => string;
  escala?: (valor: number) => AvisoEscala | null;
  fuente?: ReactNode;
  unidad?: string;
  etiqueta: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  // Guard anti doble-fire: Enter llama onCommit y luego el unmount podría gatillar blur →
  // evento duplicado. Solo el primero pasa.
  const done = useRef(false);
  const commit = (val: string) => { if (done.current) return; done.current = true; onCommit(val); };
  const cancel = () => { if (done.current) return; done.current = true; onCancel(); };
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const r = estadoNumericInput(v, { decimales, blurred: false, formatEco, escala });

  return (
    <>
      <span className="wz-v wz-v-edita">
        <input
          ref={ref}
          value={v}
          inputMode={decimales === 0 ? "numeric" : "decimal"}
          aria-label={etiqueta}
          aria-invalid={r.estado === "error"}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => commit(v)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(v); }
            else if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
        />
        {unidad && <span className="wz-u">{unidad}</span>}
      </span>
      {/* Eco en vivo, igual que en los campos de las pantallas. */}
      {r.estado === "encurso" && <span className="wz-fe-nota wz-eco">Sigue escribiendo…</span>}
      {r.estado === "error" && <span className="wz-fe-nota wz-aviso fuerte">No se entiende ese número — {r.motivo}</span>}
      {(r.estado === "ok" || r.estado === "escala") && (
        <span className="wz-fe-nota wz-eco">
          = <b>{r.eco}</b>
        </span>
      )}
      {r.estado === "escala" && <Indicacion>{r.aviso}</Indicacion>}
      {/* La ayuda del campo se apaga SOLO con error: ahí el mensaje rojo ya dice qué pasa. */}
      {fuente && r.estado !== "error" && <span className="wz-fe-nota wz-eco">{fuente}</span>}
    </>
  );
}

/**
 * Fila numérica editable.
 *
 * `raw` es el texto TAL COMO está guardado; `decimales` sale de `DEC` y es el mismo que usa la
 * pantalla del acto. En reposo muestra `display` (+ `unidad` en gris); si lo guardado no se puede
 * leer, lo dice ahí mismo en vez de mostrar un «—» mudo.
 */
export function FilaNum({
  label,
  sub,
  raw,
  display,
  unidad,
  decimales,
  formatEco,
  escala,
  fuente,
  derivado,
  highlight,
  commitCeroDesdeVacio,
  onCommit,
}: {
  label: string;
  /** Procedencia o rótulo bajo el nombre, en reposo («Típicos de la comuna», «corregido por ti»). */
  sub?: ReactNode;
  raw: string;
  display: string;
  unidad?: string;
  decimales: Decimales;
  formatEco?: (valor: number) => string;
  /** Aviso de magnitud. Los umbrales y el copy los pone el guard, no esta fila. */
  escala?: (valor: number) => AvisoEscala | null;
  /** Ayuda del campo mientras se edita. */
  fuente?: ReactNode;
  /** Un valor calculado que cuelga de éste (la cuota bajo la tasa), en gris. */
  derivado?: string;
  /** Anillo transitorio cuando el modal o la card al filo apuntan a esta fila. */
  highlight?: boolean;
  /**
   * Fix pie-cero: tratar lo escrito sobre un campo VACÍO como edición real aunque `esEdicionReal`
   * lea el mismo valor ("" y "0" son ambos 0). Para el pie, escribir "0" sobre el vacío ES la
   * declaración. Solo el pie lo pasa.
   */
  commitCeroDesdeVacio?: boolean;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const eco = formatEco ?? ecoPorDefecto();
  const enReposo = estadoNumericInput(raw, { decimales, blurred: true, formatEco: eco, escala });

  return (
    <div className={`wz-fe${highlight ? " wz-ilumina" : ""}`}>
      <span className="wz-k">{label}</span>
      {sub && <span className="wz-f">{sub}</span>}
      {editing ? (
        <PildoraInput
          initial={raw}
          unidad={unidad}
          etiqueta={label}
          decimales={decimales}
          formatEco={eco}
          escala={escala}
          fuente={fuente}
          onCommit={(v) => {
            setEditing(false);
            // Salir del campo no es corregirlo: el commit solo se propaga si el valor cambió.
            if (esEdicionReal(v, raw, decimales) || (commitCeroDesdeVacio && raw.trim() === "" && v.trim() !== "")) onCommit(v);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <Pildora texto={display} unidad={unidad} etiqueta={label} onClick={() => setEditing(true)} />
          {enReposo.estado === "error" && <span className="wz-fe-nota wz-aviso fuerte">No se entiende ese número — {enReposo.motivo}</span>}
          {/* En reposo el aviso también se ve: esconderlo hasta reabrir el editor no ayuda. */}
          {enReposo.estado === "escala" && <Indicacion>{enReposo.aviso}</Indicacion>}
        </>
      )}
      {derivado && <span className="wz-fe-nota wz-eco">{derivado}</span>}
    </div>
  );
}

/** Fila de opciones discretas (plazo, tipo, quién lo opera). En reposo, la opción elegida en la
 *  píldora; al tocarla, las opciones debajo. Commit al elegir; reelegir la misma no es corregir. */
export function FilaOpciones<T extends string>({
  label,
  sub,
  value,
  options,
  fuente,
  onCommit,
}: {
  label: string;
  sub?: ReactNode;
  value: string | undefined;
  options: Array<{ value: T; label: string }>;
  fuente?: ReactNode;
  onCommit: (v: T) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "—";
  return (
    <div className="wz-fe">
      <span className="wz-k">{label}</span>
      {sub && <span className="wz-f">{sub}</span>}
      <Pildora texto={current} etiqueta={label} onClick={() => setEditing((e) => !e)} />
      {editing && (
        <span className="wz-fe-nota">
          <span className="wz-seg wz-seg-fila" role="group" aria-label={label}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={o.value === value}
                onClick={() => { setEditing(false); if (o.value !== value) onCommit(o.value); }}
              >
                {o.label}
              </button>
            ))}
          </span>
          {fuente && <span className="wz-eco wz-bloque-nota">{fuente}</span>}
        </span>
      )}
    </div>
  );
}

/** Fila que no se edita: un valor que se deriva de otro (la comisión fija con «lo opero yo»). */
export function FilaFija({ label, sub, valor }: { label: string; sub?: ReactNode; valor: ReactNode }) {
  return (
    <div className="wz-fe fija">
      <span className="wz-k">{label}</span>
      {sub && <span className="wz-f">{sub}</span>}
      <span className="wz-v">{valor}</span>
    </div>
  );
}

/** Fila con un control propio a la derecha (el stepper de huéspedes, un sí/no). */
export function FilaControl({ label, sub, children }: { label: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="wz-fe">
      <span className="wz-k">{label}</span>
      {sub && <span className="wz-f">{sub}</span>}
      <span className="wz-v-control">{children}</span>
    </div>
  );
}
