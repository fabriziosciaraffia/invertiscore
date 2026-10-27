"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL RESULTADO EN UN POP-UP (14-oct-2026, decisión de Fabrizio). Cuando «Analizar este» de renta corta mide fino y el
// depto no da Comprar, no se cobra y se abre esto: el mensaje (`NO_DA`, o `NINGUNO_DA` si ningún parecido sobrevive)
// y los parecidos con su botón. Nada se inserta en la lista: la tarjeta original queda marcada (`MARCA_NO_DA`), sin
// botón (semanal-lista.tsx). Desde el 15-oct-2026 ningún texto de la página habla del cobro. El armazón es el del modal del wizard (ModalPlausibilidad:
// el velo, el panel, Escape y el foco dentro); las tarjetas, las de la guía (guia.css).
// CON SALIDA (27-oct-2026, decisión de Fabrizio, el caso de un cliente que pagó y se quedó sin nada del depto que pidió):
// debajo de «no da», por qué en una línea (`porQue`, de la ruta: la tarifa o la ocupación medidas contra las de la zona),
// el enlace a la publicación («Ver la publicación», en otra pestaña) y «Analizar igual · usa 1 de tus N» para quien
// quiera el informe completo igual (ése sí cobra). Después, los parecidos que sí dan, o que no queda ninguno.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NO_DA_DEPTO, continuacionNoDa } from "@/lib/guia/semanal-str";
import { GUIA, PUBLICACION_PORTADA } from "@/lib/guia/copy";
import { botonOcupado } from "@/lib/carga-global";
import "@/components/formulario-v4/wizard-v4.css";

export const POPUP_NO_DA = { titulo: "Renta corta", cerrar: "Cerrar" } as const;

export function PopupNoDa({ parecidos, children, alCerrar, publicacion = null, porQue = null, analizarIgual = null }: {
  /** Cuántos parecidos se ofrecen (las tarjetas van en `children`). */
  parecidos: number;
  children?: ReactNode;
  alCerrar: () => void;
  /** El enlace a la publicación del depto que no dio (el de la ficha recién chequeada). */
  publicacion?: string | null;
  /** Por qué no da, en una línea (semanal-str.ts › porQueNoDa). */
  porQue?: string | null;
  /** «Analizar igual · usa 1 de tus N»: el informe completo aunque no dé, cobrando. `ocupado` mientras se genera. */
  analizarIgual?: { texto: string; ocupado: boolean; alTocar: () => void } | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const disparadorRef = useRef<Element | null>(null);
  const cerrar = useCallback(() => alCerrar(), [alCerrar]);

  // Como el modal del wizard: foco adentro al abrir, de vuelta al cerrar, sin scroll detrás.
  useEffect(() => {
    disparadorRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      const d = disparadorRef.current;
      if (d instanceof HTMLElement && d.isConnected) d.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
      if (e.key !== "Tab") return;
      const foco = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!foco || foco.length === 0) return;
      const primero = foco[0], ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cerrar]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="wz4 wz-modal-velo" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby="popup-no-da-msg" data-modal="no-da">
      <div ref={panelRef} className="wz-modal guia-pop">
        <div className="wz-modal-mc">
          <div className="wz-modal-mt">
            <span>{POPUP_NO_DA.titulo}</span>
            <button type="button" onClick={cerrar} aria-label={POPUP_NO_DA.cerrar} className="wz-disco">
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
          <CuerpoNoDa parecidos={parecidos} publicacion={publicacion} porQue={porQue} analizarIgual={analizarIgual}>{children}</CuerpoNoDa>
        </div>
        <div className="wz-modal-mb">
          <button ref={cerrarRef} type="button" onClick={cerrar} className="wz-btn2">{POPUP_NO_DA.cerrar}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** EL CUERPO DEL POP-UP, SIN EL PORTAL (27-oct-2026): lo que dice y ofrece. Aparte para que el tier NO-DA-PUBLICACION lo
 *  dibuje en el servidor con el caso real (el portal no dibuja nada sin `document`). */
export function CuerpoNoDa({ parecidos, children, publicacion = null, porQue = null, analizarIgual = null }: {
  parecidos: number;
  children?: ReactNode;
  publicacion?: string | null;
  porQue?: string | null;
  analizarIgual?: { texto: string; ocupado: boolean; alTocar: () => void } | null;
}) {
  return (
    <>
      <p id="popup-no-da-msg" className="wz-modal-msg" data-popup="mensaje">{NO_DA_DEPTO}</p>
      {porQue && <p className="guia-pop-porque" data-popup="porque">{porQue}</p>}
      {(publicacion || analizarIgual) && (
        <div className="guia-pop-salidas" data-popup="salidas">
          {publicacion && (
            <a href={publicacion} target="_blank" rel="noopener noreferrer" className="guia-ver-informe" data-popup="publicacion">
              {PUBLICACION_PORTADA.enlace} ↗
            </a>
          )}
          {analizarIgual && (
            <button type="button" className="sel-btn guia-pop-igual" onClick={analizarIgual.alTocar} disabled={analizarIgual.ocupado} {...botonOcupado(analizarIgual.ocupado)} data-popup="analizar-igual">
              {analizarIgual.ocupado ? GUIA.analizando : analizarIgual.texto}
            </button>
          )}
        </div>
      )}
      <p className="guia-pop-sigue" data-popup="continuacion">{continuacionNoDa(parecidos)}</p>
      {parecidos > 0 && <div className="guia guia-pop-lista" data-popup="parecidos">{children}</div>}
    </>
  );
}
