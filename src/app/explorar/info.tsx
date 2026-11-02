"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA ⓘ CON SU TOOLTIP (02-nov-2026, mockup docs/puerta-b-mockups/8-filtros-v2-negociar.html): la de cada tarjeta de Filtros y la de
// «¿Cómo se calcula?» en la barra del teléfono. En el teléfono no hay «pasar el mouse»: el primer toque muestra el tooltip, tocar
// fuera o Escape lo cierra. En la barra (decisión de Fabrizio, 02-nov-2026) tocar el tooltip abre la hoja: `alTocarTooltip`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react";

export function Info({ texto, etiqueta, alTocarTooltip, lado = "der", clase, marca }: {
  texto: string;
  /** Para los lectores de pantalla: «Qué es Tu financiamiento». */
  etiqueta: string;
  /** Con esto el tooltip es un botón (la barra: abre «¿Cómo se calcula?»). */
  alTocarTooltip?: () => void;
  /** Hacia dónde se abre: desde la derecha (la ⓘ a la derecha de su fila) o desde la izquierda. */
  lado?: "der" | "izq";
  clase?: string;
  marca?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAbierto(false); } };
    document.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", fuera, true); window.removeEventListener("keydown", esc, true); };
  }, [abierto]);
  return (
    <span className={`ex-info-caja${clase ? ` ${clase}` : ""}`} ref={caja} data-explorar={marca}>
      <button type="button" className="ex-info" aria-label={etiqueta} aria-expanded={abierto} aria-describedby={abierto ? id : undefined} onClick={(e) => { e.stopPropagation(); setAbierto((x) => !x); }} data-abierto={abierto ? "1" : undefined}>i</button>
      {abierto && (alTocarTooltip ? (
        <button type="button" id={id} role="tooltip" className={`ex-tip ex-tip-${lado} ex-tip-boton`} onClick={() => { setAbierto(false); alTocarTooltip(); }} data-explorar="tooltip">{texto}</button>
      ) : (
        <span id={id} role="tooltip" className={`ex-tip ex-tip-${lado}`} data-explorar="tooltip">{texto}</span>
      ))}
    </span>
  );
}
