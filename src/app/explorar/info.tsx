"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA ⓘ CON SU TOOLTIP (02-nov-2026, mockup docs/puerta-b-mockups/8-filtros-v2-negociar.html): la de cada tarjeta de Filtros y la
// de la tasa. En el teléfono no hay «pasar el mouse»: el primer toque muestra el tooltip, tocar fuera o Escape lo cierra.
// DENTRO DE LA PANTALLA (03-nov-2026, la pasada real de Fabrizio: se cortaban en los bordes): el tooltip va en una capa sobre la
// página (un portal al <body>, con `position: fixed`), así ningún panel con `overflow` lo corta, y su lugar lo decide
// tooltip.ts › colocarTooltip con las medidas reales —debajo de la ⓘ y centrado, corrido hasta quedar entero, arriba si abajo no
// cabe, nunca más ancho que la pantalla—; se recoloca al hacer scroll (la hoja de Filtros se desplaza) y al cambiar el tamaño.
// La ⓘ de «¿Cómo se calcula?» en la barra del teléfono ya no es esta: desde el 03-nov abre la hoja directo (explorar-cliente.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anchoTooltip, colocarTooltip } from "@/lib/explorar/tooltip";

/** En el navegador, antes de pintar (el tooltip sale ya en su lugar); en el servidor no hay nada que medir. */
const useAntesDePintar = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Info({ texto, etiqueta, clase, marca }: {
  texto: string;
  /** Para los lectores de pantalla: «Qué es Tu financiamiento». */
  etiqueta: string;
  /** Hasta el 03-nov-2026 decía hacia dónde se abría («der» o «izq»); hoy lo decide colocarTooltip. Se acepta y no se usa. */
  lado?: "der" | "izq";
  clase?: string;
  marca?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lugar, setLugar] = useState<{ left: number; top: number; ancho: number; lado: "abajo" | "arriba" } | null>(null);
  const caja = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const id = useId();

  const colocar = useCallback(() => {
    const b = boton.current?.getBoundingClientRect();
    const t = tip.current;
    if (!b || !t) return;
    const vista = { ancho: document.documentElement.clientWidth || window.innerWidth, alto: window.innerHeight };
    // El alto depende del ancho (el texto se parte en líneas): se fija el ancho y recién ahí se mide.
    t.style.width = `${anchoTooltip(vista.ancho)}px`;
    setLugar(colocarTooltip({ left: b.left, top: b.top, right: b.right, bottom: b.bottom }, t.offsetHeight, vista));
  }, []);

  useAntesDePintar(() => {
    if (!abierto) { setLugar(null); return; }
    colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => {
      const n = e.target as Node;
      if (caja.current?.contains(n) || tip.current?.contains(n)) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAbierto(false); } };
    let cuadro = 0;
    const recolocar = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(colocar); };
    document.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", recolocar, true);
    window.addEventListener("resize", recolocar);
    return () => {
      cancelAnimationFrame(cuadro);
      document.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", recolocar, true);
      window.removeEventListener("resize", recolocar);
    };
  }, [abierto, colocar]);

  return (
    <span className={`ex-info-caja${clase ? ` ${clase}` : ""}`} ref={caja} data-explorar={marca}>
      <button ref={boton} type="button" className="ex-info" aria-label={etiqueta} aria-expanded={abierto} aria-describedby={abierto ? id : undefined} onClick={(e) => { e.stopPropagation(); setAbierto((x) => !x); }} data-abierto={abierto ? "1" : undefined}>i</button>
      {abierto && typeof document !== "undefined" && createPortal(
        <span
          ref={tip}
          id={id}
          role="tooltip"
          className="ex-tip"
          data-explorar="tooltip"
          data-lado={lugar?.lado}
          // Hasta medirlo, invisible y arriba a la izquierda: el primer cuadro ya sale en su lugar.
          style={lugar ? { left: lugar.left, top: lugar.top, width: lugar.ancho } : { left: 0, top: 0, visibility: "hidden" }}
        >
          {texto}
        </span>,
        document.body,
      )}
    </span>
  );
}
