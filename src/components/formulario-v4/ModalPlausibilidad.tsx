"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmación y alerta de plausibilidad — PIEZA B1
//
// UN componente, DOS estados (contrato · mockup-modal-plausibilidad.html):
//
//   LIMPIO (02b)   — lo que ve el 99%. Barra Ink. Dirección + modalidad, mini
//                    resumen de 4 DERIVADOS (nunca los valores tipeados) y el
//                    bloque de consumo según tier. Primario + "Revisar".
//   ANOMALÍA (02)  — barra Signal Red, el DERIVADO en 46px como protagonista,
//                    el mensaje de anomalias[0], las otras en lista breve, y
//                    los datos de origen como BOTONES que llevan a su campo.
//                    Un solo botón: "Volver y corregir". Sin "continuar igual".
//
// Props-driven a propósito: no sabe que está en el resumen. B2 (alerta en cada
// transición del wizard) lo monta igual, pasando otras `origenes` y sin
// `resumen`/`consumo`.
//
// Signal Red — exactamente 3 usos en el estado anomalía: barra superior,
// eyebrow, y el botón del campo sospechoso. El número grande va en Ink.
// Tipografía: derivados y datos en JetBrains Mono, mensaje en IBM Plex Sans.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { valorParaMostrar, type Anomalia } from "@/lib/plausibilidad";

/** Dato de origen: a qué campo puede volver el usuario desde el modal. */
export interface OrigenCampo {
  /** Id del campo. El caller decide qué hacer (abrir card, navegar, iluminar). */
  key: string;
  /** Rótulo corto: "Precio", "Superficie". */
  label: string;
  /** Valor tal como lo tipeó el usuario: "UF 4.800.000". */
  valor: string;
  /** Sospecha más probable → se marca en Signal Red. No es una sentencia. */
  sospechoso?: boolean;
}

export interface ResumenConfirmacion {
  direccion: string;
  modalidad: string;
  /** Los 4 derivados: UF/m², dividendo, pie en pesos, retorno bruto. */
  derivados: Array<{ label: string; valor: string }>;
}

export interface ModalPlausibilidadProps {
  open: boolean;
  /** Vacío ⇒ estado LIMPIO. Con elementos ⇒ estado ANOMALÍA (ya priorizadas). */
  anomalias: Anomalia[];
  /** Campos a los que el usuario puede volver. Solo se usa en estado anomalía. */
  origenes?: OrigenCampo[];
  /** Datos del estado limpio. */
  resumen?: ResumenConfirmacion;
  /** Línea de consumo según tier. `null` ⇒ no se renderiza (ilimitado/admin). */
  consumo?: string | null;
  /** Copy del primario en estado limpio (cambia en el camino de compra). */
  labelConfirmar?: string;
  /**
   * Qué hace el modal cuando hay anomalías.
   *
   *  · "bloqueo" (default) — el del RESUMEN. Un solo botón, sin salida: el
   *    siguiente paso es cobrar y el server rechaza igual, así que frenar es
   *    honesto.
   *  · "aviso" — el de la ALERTA TEMPRANA (B2). Avisa y deja seguir: acá el
   *    siguiente paso es otra pregunta, y si el dato malo está cinco pantallas
   *    atrás, bloquear deja al usuario atascado. El resumen y el server siguen
   *    siendo las redes duras.
   */
  modo?: "bloqueo" | "aviso";
  /** Solo en modo "aviso": avanzar igual a la pantalla siguiente. */
  onSeguir?: () => void;
  submitting?: boolean;
  onOrigen?: (key: string) => void;
  onConfirmar?: () => void;
  onCerrar: () => void;
}

const MONO = "font-mono";

export function ModalPlausibilidad({
  open,
  anomalias,
  origenes = [],
  resumen,
  consumo,
  labelConfirmar = "Generar el análisis",
  modo = "bloqueo",
  onSeguir,
  submitting = false,
  onOrigen,
  onConfirmar,
  onCerrar,
}: ModalPlausibilidadProps) {
  const esAnomalia = anomalias.length > 0;
  const panelRef = useRef<HTMLDivElement>(null);
  const primarioRef = useRef<HTMLButtonElement>(null);
  // Control que abrió el modal: el foco vuelve ahí al cerrar.
  const disparadorRef = useRef<Element | null>(null);

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  // Foco al primario al abrir · devolución al disparador al cerrar · lock del
  // scroll del body. El backdrop NO cierra (toque accidental, sobre todo mobile).
  useEffect(() => {
    if (!open) return;
    disparadorRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => primarioRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      const d = disparadorRef.current;
      if (d instanceof HTMLElement) d.focus();
    };
  }, [open]);

  // Escape cierra + trap de tab dentro del panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key !== "Tab") return;
      const foco = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!foco || foco.length === 0) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cerrar]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const principal = anomalias[0];
  const resto = anomalias.slice(1);
  const grande = principal ? valorParaMostrar(principal) : null;

  return createPortal(
    <div
      // 100dvh y no 100vh: en Safari la barra de URL hace que vh mienta y el
      // modal queda cortado abajo. Anclado ARRIBA con margen (no centrado
      // vertical): con el teclado abierto o varias anomalías, centrar deja la
      // mitad del contenido fuera de pantalla. z-30 > CTA sticky del wizard (z-20).
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-3.5 sm:px-5 pt-[52px] sm:pt-10 pb-5 sm:pb-10"
      style={{ height: "100dvh", background: "rgba(15,15,15,0.72)", backdropFilter: "blur(2px)" }}
      // Sin onClick: el backdrop NO cierra (dismissOnBackdropClick=false).
      role={esAnomalia ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby="modal-plausibilidad-titulo"
    >
      <div
        ref={panelRef}
        className="w-full max-w-[470px] max-h-full flex flex-col rounded-[3px] bg-[var(--franco-card)] shadow-[0_24px_60px_rgba(0,0,0,0.34)] overflow-hidden modal-plausibilidad-panel"
      >
        {/* Signal Red · uso 1 de 3 — solo cuando algo está mal. */}
        <div className={`h-[3px] shrink-0 ${esAnomalia ? "bg-signal-red" : "bg-[var(--franco-text)]"}`} />

        {/* Cuerpo scrolleable: los botones quedan fijos abajo. Nunca un modal
            donde haya que scrollear para encontrar cómo salir. */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 pt-5 sm:pt-6 pb-2">
          <div className="flex items-start justify-between gap-3">
            {/* Signal Red · uso 2 de 3 */}
            <p
              className={`${MONO} text-[10px] uppercase tracking-[0.17em] font-medium m-0 ${
                esAnomalia ? "text-signal-red" : "text-[var(--franco-text-muted)]"
              }`}
            >
              {esAnomalia
                ? anomalias.length > 1
                  ? "Revisa estos datos"
                  : "Revisa este dato"
                : "Confirma antes de generar"}
            </p>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="shrink-0 -mt-1 -mr-1 p-1 rounded-md text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-border)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {esAnomalia && grande && principal ? (
            <>
              {/* El derivado es la firma: 46px desktop / 34px mobile, en INK.
                  El rojo pierde fuerza si lo pinta todo. */}
              <div className="mt-5 mb-1">
                <span className={`${MONO} font-bold text-[34px] sm:text-[46px] leading-none tracking-[-0.02em] text-[var(--franco-text)]`}>
                  {grande.numero}
                </span>
                <span className={`${MONO} text-[12px] sm:text-[14px] tracking-[0.04em] text-[var(--franco-text-muted)] ml-[7px] sm:ml-[9px]`}>
                  {grande.unidad}
                </span>
                {/* Label adaptativo: la revelación solo se nombra cuando existe. */}
                <p className={`${MONO} text-[9px] sm:text-[10px] uppercase tracking-[0.13em] text-[var(--franco-text-muted)] mt-[7px] sm:mt-[9px] m-0`}>
                  {grande.deriva ? "lo que implica el precio que pusiste" : `${etiquetaTipeada(principal)} que ingresaste`}
                </p>
              </div>

              <p
                id="modal-plausibilidad-titulo"
                className="font-body text-[14px] sm:text-[15px] leading-[1.55] text-[var(--franco-text)] mt-4 sm:mt-5 mb-0 max-w-[44ch]"
              >
                {principal.mensaje}
              </p>

              {resto.length > 0 && (
                <div className="mt-4 border-t border-[var(--franco-border)] pt-3">
                  <p className={`${MONO} text-[9px] uppercase tracking-[0.11em] text-[var(--franco-text-muted)] m-0 mb-2`}>
                    {resto.length === 1 ? "Y arrastra una cosa más" : `Y arrastra ${numeroEnPalabras(resto.length)} cosas más`}
                  </p>
                  <ul className="m-0 p-0 list-none">
                    {resto.map((a) => (
                      <li key={a.regla} className="relative pl-4 mb-1.5 font-body text-[13.5px] text-[var(--franco-text-secondary)]">
                        {/* Bullet en gris, NO Signal Red. El CSS del mockup (§02)
                            los pinta rojos, pero §05 y el brief fijan un máximo de
                            tres usos —barra, eyebrow, campo culpable— y estos serían
                            un cuarto. Gana la regla: el rojo pierde fuerza si lo
                            pinta todo. Discrepancia reportada. */}
                        <span className="absolute left-0 top-[8px] w-[5px] h-[5px] rounded-full bg-[var(--franco-text-muted)]" />
                        {a.mensaje}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {origenes.length > 0 && (
                <>
                  <div className="mt-5 border-t border-[var(--franco-border)] pt-3.5 flex flex-wrap gap-2">
                    {origenes.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => onOrigen?.(o.key)}
                        // Signal Red · uso 3 de 3: la sospecha más probable.
                        className={`flex items-baseline gap-2 rounded-[2px] border px-3 py-2 min-h-[44px] text-left transition-colors ${
                          o.sospechoso
                            ? "border-signal-red bg-[color-mix(in_srgb,var(--signal-red)_5%,transparent)]"
                            : "border-[var(--franco-border)] bg-[var(--franco-bg)] hover:border-[var(--franco-text)]"
                        }`}
                      >
                        <span className={`${MONO} text-[9px] uppercase tracking-[0.11em] text-[var(--franco-text-muted)]`}>{o.label}</span>
                        <span className={`${MONO} text-[13px] ${o.sospechoso ? "text-signal-red font-medium" : "text-[var(--franco-text)]"}`}>{o.valor}</span>
                        <span className={`${MONO} text-[11px] text-[var(--franco-text-muted)]`}>→</span>
                      </button>
                    ))}
                  </div>
                  <p className={`${MONO} text-[9.5px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] mt-2 mb-0`}>
                    {origenes.length === 1 ? "Toca para corregir" : "Toca el que quieras corregir"}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              {/* Estado limpio. La dirección es lo único en Source Serif: es el
                  sujeto del documento, no una interrupción. */}
              <h2
                id="modal-plausibilidad-titulo"
                className="font-heading text-[20px] sm:text-[22px] font-semibold tracking-[-0.01em] text-[var(--franco-text)] mt-4 mb-1"
              >
                {resumen?.direccion ?? "Tu análisis"}
              </h2>
              {resumen?.modalidad && (
                <p className={`${MONO} text-[11.5px] tracking-[0.03em] text-[var(--franco-text-muted)] m-0`}>{resumen.modalidad}</p>
              )}

              {resumen && resumen.derivados.length > 0 && (
                <div className="mt-5 border-t border-[var(--franco-border)] pt-4 grid grid-cols-2 gap-x-5 gap-y-3">
                  {resumen.derivados.map((d) => (
                    <div key={d.label}>
                      <p className={`${MONO} text-[9px] uppercase tracking-[0.11em] text-[var(--franco-text-muted)] m-0`}>{d.label}</p>
                      <p className={`${MONO} text-[14px] text-[var(--franco-text)] mt-0.5 mb-0`}>{d.valor}</p>
                    </div>
                  ))}
                </div>
              )}

              {consumo && (
                <div className="mt-4 border-t border-[var(--franco-border)] pt-3">
                  <p className="font-body text-[13.5px] text-[var(--franco-text-secondary)] m-0">{consumo}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Acciones fijas. Mobile: apiladas, ancho completo, primario arriba. */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-2.5 px-5 sm:px-7 pt-4 pb-5 sm:pb-6">
          {esAnomalia ? (
            modo === "aviso" ? (
              <>
                <button ref={primarioRef} type="button" onClick={cerrar} className={btnPrimario}>
                  Corregir
                </button>
                <button type="button" onClick={onSeguir} className={btnGhost}>
                  Seguir así
                </button>
              </>
            ) : (
              // Sin "continuar igual": el server lo rechaza de todos modos.
              <button ref={primarioRef} type="button" onClick={cerrar} className={btnPrimario}>
                Volver y corregir
              </button>
            )
          ) : (
            <>
              <button ref={primarioRef} type="button" onClick={onConfirmar} disabled={submitting} className={btnPrimario}>
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generando…
                  </span>
                ) : (
                  labelConfirmar
                )}
              </button>
              <button type="button" onClick={cerrar} disabled={submitting} className={btnGhost}>
                Revisar
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const btnPrimario =
  "flex-1 font-mono text-[11.5px] uppercase tracking-[0.09em] px-5 py-3.5 min-h-[44px] rounded-[2px] bg-[var(--franco-text)] text-[var(--franco-bg)] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed";
const btnGhost =
  "font-mono text-[11.5px] uppercase tracking-[0.09em] px-5 py-3.5 min-h-[44px] rounded-[2px] border border-[var(--franco-border)] text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] transition-colors disabled:opacity-60";

/** Rótulo del campo tipeado, para el label "la tasa que ingresaste". */
function etiquetaTipeada(a: Anomalia): string {
  switch (a.campo) {
    case "precio": return "el precio";
    case "superficie": return "la superficie";
    case "arriendo": return "el arriendo";
    case "tasa": return "la tasa";
    case "pie": return "el pie";
    case "ocupacion": return "la ocupación";
    case "tarifaNoche": return "la tarifa";
    case "vacancia": return "la vacancia";
    case "comisionAdmin": return "la comisión de administración";
  }
}

function numeroEnPalabras(n: number): string {
  return n === 2 ? "dos" : n === 3 ? "tres" : String(n);
}
