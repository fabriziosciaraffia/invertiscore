"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DEL RECÁLCULO (04-nov-2026, la pasada de Fabrizio): con otra tasa, otro pie u otro plazo, mientras Franco calcula
// comuna por comuna, un pop-up centrado como el de «Analizar», con un spinner: «Franco está recalculando con tu tasa de 5 %» y
// debajo el avance «9 de 25 comunas». Se cierra solo al terminar: no tiene X ni se cierra con Escape (lo monta explorar-cliente.tsx
// mientras hay avance). Reemplaza a la línea «Calculando con tu tasa… 9 de 25 comunas» que iba abajo. Texto en portal.ts.
// EL TOPE Y EL FUSIBLE (04-nov-2026, después de la caída de la base; cola-recalculo.ts): con los dos turnos del sitio tomados,
// el título dice «Franco está ocupado con otro cálculo, un momento…» y el spinner sigue; con la base lenta, la cola para, el
// spinner se va y el pop-up ofrece ver el mapa con la tasa del mes (o lo que ya cargó, en renta corta) o intentarlo de nuevo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { PORTAL_COPY } from "@/lib/explorar/portal";
import type { EstadoRecalculo } from "@/lib/explorar/cola-recalculo";
import "@/components/formulario-v4/wizard-v4.css";

export function PopupRecalculo({ texto, hechas, total, estado = "calculando", respaldo = null, alRespaldo, alCerrar, alReintentar }: {
  texto: string; hechas: number; total: number; estado?: EstadoRecalculo;
  /** El texto del botón del respaldo («Ver con la tasa del mes»); null en renta corta. */
  respaldo?: string | null;
  alRespaldo?: () => void; alCerrar?: () => void; alReintentar?: () => void;
}) {
  const pausado = estado === "pausado";
  const primario = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (pausado) primario.current?.focus(); }, [pausado]);
  return (
    <div className="wz4 wz-modal-velo wz-modal-velo-compacto" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby="ex-recalculo-t" data-explorar="recalculando" data-estado={estado}>
      <div className="wz-modal wz-modal-compacto ex-recalculo">
        {!pausado && <span className="ex-recalculo-gira" aria-hidden="true" data-explorar="recalculo-spinner" />}
        <h2 id="ex-recalculo-t" className="ex-recalculo-t" data-explorar="recalculo-texto">
          {pausado ? PORTAL_COPY.recalculoPausado : estado === "ocupado" ? PORTAL_COPY.recalculoOcupado : texto}
        </h2>
        {pausado
          ? <p className="ex-recalculo-avance" role="status" data-explorar="recalculo-pausado">{respaldo ? PORTAL_COPY.recalculoPausadoQue : PORTAL_COPY.recalculoPausadoSinRespaldo}</p>
          : <p className="ex-recalculo-avance" role="status" aria-live="polite" data-explorar="recalculo-avance">{PORTAL_COPY.avanceComunas(hechas, total)}</p>}
        {pausado && (
          <div className="wz-modal-mb ex-recalculo-acciones">
            {/* En tinta: ver el mapa no compra nada (el rojo es para comprar, la oferta y el regalo). */}
            {respaldo
              ? <button ref={primario} type="button" className="wz-btn2 tinta" onClick={alRespaldo} data-explorar="recalculo-respaldo">{respaldo}</button>
              : <button ref={primario} type="button" className="wz-btn2 tinta" onClick={alCerrar} data-explorar="recalculo-cerrar">{PORTAL_COPY.recalculoVerLoCargado}</button>}
            <button type="button" className="wz-modal-cancelar" onClick={alReintentar} data-explorar="recalculo-reintentar">{PORTAL_COPY.recalculoReintentar}</button>
          </div>
        )}
      </div>
    </div>
  );
}
