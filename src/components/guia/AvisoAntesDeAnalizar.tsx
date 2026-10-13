"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso antes de gastar un análisis (13-oct-2026; reglas y copy en lib/guia/aviso-analizar.ts). Lo abren
// «Analizar este» de la página semanal y de la guía: el depto, lo que usa, y Analizar / Cancelar. Sin análisis,
// el mismo aviso ofrece el pack de tres (el único rojo: es el botón de compra) y vuelve a la página al pagar.
// Va en un portal sobre el body, con Escape y el fondo para cerrar; en teléfono, abajo y con los botones a lo ancho.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { AVISO_ANALIZAR, lineaDepto, textoUso, type UsoAnalisis } from "@/lib/guia/aviso-analizar";
import "./guia.css";

export function AvisoAntesDeAnalizar({ depto, uso, rutaCompra, alAnalizar, alCancelar }: {
  depto: { comuna: string; tipologia: string | null; precioUF: number };
  uso: UsoAnalisis;
  /** El checkout del pack, con su origen y la vuelta a esta página. */
  rutaCompra: string;
  alAnalizar: () => void;
  alCancelar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);
  const sin = uso.tipo === "sin";

  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    if (!montado) return;
    caja.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") alCancelar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [montado, alCancelar]);

  if (!montado) return null;
  return createPortal(
    <div className="guia-aviso-fondo" onClick={(e) => { if (e.target === e.currentTarget) alCancelar(); }}>
      <div ref={caja} className="guia-aviso" role="dialog" aria-modal="true" aria-labelledby="guia-aviso-t" tabIndex={-1} data-aviso-analizar={sin ? "sin" : "con"}>
        <h2 id="guia-aviso-t" className="guia-aviso-t">{sin ? AVISO_ANALIZAR.tituloSin : AVISO_ANALIZAR.titulo}</h2>
        <p className="guia-aviso-depto">{lineaDepto(depto)}</p>
        <p className="guia-aviso-uso">{textoUso(uso)}</p>
        <div className="guia-aviso-acc">
          <button type="button" className="guia-aviso-no" onClick={alCancelar} data-aviso="cancelar">{AVISO_ANALIZAR.cancelar}</button>
          {sin ? (
            <EnlaceCarga href={rutaCompra} className="guia-aviso-si guia-aviso-compra" data-aviso="comprar">{AVISO_ANALIZAR.comprar}</EnlaceCarga>
          ) : (
            <button type="button" className="guia-aviso-si" onClick={alAnalizar} data-aviso="analizar">{AVISO_ANALIZAR.analizar}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
