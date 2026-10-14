"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL RESULTADO EN UN POP-UP (14-oct-2026, decisión de Fabrizio). Cuando «Analizar este» de renta corta mide fino y el
// depto no da Comprar, no se cobra y se abre esto: el mensaje (`NO_DA`, o `NINGUNO_DA` si ningún parecido sobrevive)
// y los parecidos con su botón. Nada se inserta en la lista: la tarjeta original queda marcada «No da para renta
// corta · no cobrado», sin botón (semanal-lista.tsx). El armazón es el del modal del wizard (ModalPlausibilidad:
// el velo, el panel, Escape y el foco dentro); las tarjetas, las de la guía (guia.css).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { mensajeNoDa } from "@/lib/guia/semanal-str";
import "@/components/formulario-v4/wizard-v4.css";

export const POPUP_NO_DA = { titulo: "Renta corta", cerrar: "Cerrar" } as const;

export function PopupNoDa({ parecidos, children, alCerrar }: {
  /** Cuántos parecidos se ofrecen (las tarjetas van en `children`). */
  parecidos: number;
  children?: ReactNode;
  alCerrar: () => void;
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
          <p id="popup-no-da-msg" className="wz-modal-msg" data-popup="mensaje">{mensajeNoDa(parecidos)}</p>
          {parecidos > 0 && <div className="guia guia-pop-lista" data-popup="parecidos">{children}</div>}
        </div>
        <div className="wz-modal-mb">
          <button ref={cerrarRef} type="button" onClick={cerrar} className="wz-btn2">{POPUP_NO_DA.cerrar}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
