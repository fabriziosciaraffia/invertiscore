"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DEL RECÁLCULO (04-nov-2026, la pasada de Fabrizio): con otra tasa, otro pie u otro plazo, mientras Franco calcula
// comuna por comuna, un pop-up centrado como el de «Analizar», con un spinner: «Franco está recalculando con tu tasa de 5 %» y
// debajo el avance «9 de 25 comunas». Se cierra solo al terminar: no tiene X ni se cierra con Escape (lo monta explorar-cliente.tsx
// mientras hay avance). Reemplaza a la línea «Calculando con tu tasa… 9 de 25 comunas» que iba abajo. Texto en portal.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { PORTAL_COPY } from "@/lib/explorar/portal";
import "@/components/formulario-v4/wizard-v4.css";

export function PopupRecalculo({ texto, hechas, total }: { texto: string; hechas: number; total: number }) {
  return (
    <div className="wz4 wz-modal-velo wz-modal-velo-compacto" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby="ex-recalculo-t" data-explorar="recalculando">
      <div className="wz-modal wz-modal-compacto ex-recalculo">
        <span className="ex-recalculo-gira" aria-hidden="true" data-explorar="recalculo-spinner" />
        <h2 id="ex-recalculo-t" className="ex-recalculo-t" data-explorar="recalculo-texto">{texto}</h2>
        <p className="ex-recalculo-avance" role="status" aria-live="polite" data-explorar="recalculo-avance">{PORTAL_COPY.avanceComunas(hechas, total)}</p>
      </div>
    </div>
  );
}
