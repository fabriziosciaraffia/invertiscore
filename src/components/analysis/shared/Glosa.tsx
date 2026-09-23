"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal, useEsHoja } from "@/components/analysis/hallazgos/vocabulario";
import { pilaHojas } from "@/lib/hoja-pila";
import { GLOSAS, type Glosa as GlosaTexto, type GlosaId } from "@/lib/glosas-indicadores";

/**
 * EL ⓘ DEL INFORME (23-sep-2026, mockup docs/wireframes/rediseno-informe/info-indicadores.html,
 * opción A). Un solo componente para toda glosa del informe: los indicadores y las filas de
 * `FilaDato`. Reemplaza el `title` nativo —que en un teléfono no abre, no se alcanza con
 * teclado y medía 11 × 13 px— y el `InfoTooltip` de «Caro o barato».
 *  · Disparador: botón de 24 × 24 con el glifo de 15 px, enfocable, `aria-expanded`.
 *  · ≤767 px: la hoja chica (`Modal variante="glosa"`), apilable sobre la hoja de un capítulo
 *    o de la planilla. Atrás y Esc cierran solo ella (hoja-pila.ts).
 *  · ≥768 px: popover de 300 px anclado al ⓘ, arriba si cabe. Esc, clic afuera o abrir otro
 *    lo cierran. Entra a la misma pila, así que Esc no se lleva el panel de abajo.
 * Uno abierto a la vez.
 */
const EVENTO_ABRE = "franco:glosa-abre";

export function Glosa({ titulo, texto, aca }: { titulo: string; texto: string; aca?: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const esHoja = useEsHoja();
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Uno abierto a la vez: al abrir, avisa; al recibir el aviso de otro, se cierra.
  useEffect(() => {
    const onOtro = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setAbierto(false);
    };
    window.addEventListener(EVENTO_ABRE, onOtro);
    return () => window.removeEventListener(EVENTO_ABRE, onOtro);
  }, [id]);

  const alternar = (e: React.MouseEvent) => {
    // Dentro de la fila de un acordeón o de una celda clicable el ⓘ no abre lo de afuera.
    e.stopPropagation();
    if (!abierto) window.dispatchEvent(new CustomEvent(EVENTO_ABRE, { detail: id }));
    setAbierto((v) => !v);
  };
  const cerrar = () => setAbierto(false);

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={`v-i${abierto ? " on" : ""}`}
        aria-label={`Qué es: ${titulo}`}
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-glosa` : undefined}
        onClick={alternar}
      />
      {esHoja ? (
        <Modal abierto={abierto} onClose={cerrar} titulo={titulo} variante="glosa" ancla={boton.current}>
          <div id={`${id}-glosa`}>
            <p className="v-glosa-txt">{texto}</p>
            {aca != null && (
              <div className="v-glosa-aca">
                <span>En este depto</span>
                <b>{aca}</b>
              </div>
            )}
          </div>
        </Modal>
      ) : (
        abierto && <Popover id={`${id}-glosa`} titulo={titulo} texto={texto} ancla={boton.current} onClose={cerrar} />
      )}
    </>
  );
}

/** El ⓘ de un indicador: nombre y texto de `glosas-indicadores.ts`. */
export function GlosaIndicador({ glosa, aca }: { glosa: GlosaId | GlosaTexto; aca?: ReactNode }) {
  const g = typeof glosa === "string" ? GLOSAS[glosa] : glosa;
  return <Glosa titulo={g.nombre} texto={g.texto} aca={aca} />;
}

const ANCHO_POP = 300;
const MARGEN = 12;

function Popover({ id, titulo, texto, ancla, onClose }: { id: string; titulo: string; texto: string; ancla: HTMLElement | null; onClose: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flecha: number; arriba: boolean } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Esc por la pila (no se lleva el panel de abajo) y clic afuera.
  useEffect(() => {
    const pila = pilaHojas();
    const nivel = pila.apilar(() => onCloseRef.current(), { conHistorial: false });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t) || ancla?.contains(t)) return;
      onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      pila.desapilar(nivel);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [ancla]);

  // Posición: arriba del ⓘ si cabe, si no abajo; siempre dentro de la ventana.
  useLayoutEffect(() => {
    if (!ancla) return;
    const medir = () => {
      const r = ancla.getBoundingClientRect();
      const alto = caja.current?.offsetHeight ?? 160;
      const cx = r.left + r.width / 2;
      const left = Math.min(Math.max(cx - ANCHO_POP / 2, MARGEN), window.innerWidth - ANCHO_POP - MARGEN);
      const arriba = r.top - alto - 10 >= MARGEN;
      const top = arriba ? r.top - alto - 10 : r.bottom + 10;
      setPos({ top, left, flecha: Math.min(Math.max(cx - left, 16), ANCHO_POP - 16), arriba });
    };
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [ancla]);

  const destino = (ancla?.closest(".doc-dictamen") as HTMLElement | null) ?? document.body;
  return createPortal(
    <div className="doc-tokens">
      <div
        ref={caja}
        id={id}
        role="dialog"
        aria-label={titulo}
        className={`v-pop${pos?.arriba ? " arriba" : ""}`}
        style={pos ? { top: pos.top, left: pos.left, ["--flecha" as string]: `${pos.flecha}px` } : { visibility: "hidden", top: 0, left: 0 }}
      >
        <div className="v-pop-t">{titulo}</div>
        <p>{texto}</p>
      </div>
    </div>,
    destino,
  );
}
