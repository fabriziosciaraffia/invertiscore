"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmación y alerta de plausibilidad — PIEZA B1
//
// UN componente, DOS estados (contrato · mockup-modal-plausibilidad.html):
//
//   LIMPIO (02b)   — lo que ve el 99%. Dirección + modalidad, mini resumen de 4
//                    DERIVADOS (nunca los valores tipeados) y el bloque de
//                    consumo según tier. Primario + "Revisar".
//   ANOMALÍA (02)  — el DERIVADO grande como protagonista, el mensaje de
//                    anomalias[0], las otras en lista breve, y los datos de
//                    origen como BOTONES que llevan a su campo.
//
// Props-driven a propósito: no sabe que está en el resumen. B2 (alerta en cada
// transición del wizard) lo monta igual, pasando otras `origenes` y sin
// `resumen`/`consumo`.
//
// FORMATO DEL INFORME (27-sep-2026, entrega 2 del wizard): radio 16, Inter, el
// rótulo sin rojo. EL ROJO QUEDA SOLO EN EL VALOR SOSPECHOSO, que es atención
// real (se retiraron la barra y el rótulo rojos). «Corregir» va en tinta y no en
// rojo: no es avanzar, y «Seguir igual» no se empuja. El único botón rojo es el
// de generar, en el estado limpio: ése sí es avanzar. Clases en wizard-v4.css;
// el panel lleva `.wz4` porque se monta en el body, fuera del interior.
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
      // mitad del contenido fuera de pantalla. Sobre la barra fija del wizard.
      className="wz4 wz-modal-velo"
      style={{ height: "100dvh" }}
      // Sin onClick: el backdrop NO cierra (dismissOnBackdropClick=false).
      role={esAnomalia ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby="modal-plausibilidad-titulo"
    >
      <div ref={panelRef} className="wz-modal modal-plausibilidad-panel">
        {/* Cuerpo scrolleable: los botones quedan fijos abajo. Nunca un modal
            donde haya que scrollear para encontrar cómo salir. */}
        <div className="wz-modal-mc">
          <div className="wz-modal-mt">
            <span>
              {esAnomalia
                ? anomalias.length > 1
                  ? "Revisa estos datos"
                  : "Revisa este dato"
                : "Confirma antes de generar"}
            </span>
            <button type="button" onClick={cerrar} aria-label="Cerrar" className="wz-disco">
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

          {esAnomalia && grande && principal ? (
            <>
              {/* El derivado es la firma, grande y en tinta: el rojo pierde fuerza si lo pinta todo. */}
              <div className="wz-modal-grandote">
                {grande.numero}
                <small>{grande.unidad}</small>
              </div>
              {/* Rótulo adaptativo: la revelación solo se nombra cuando existe. */}
              <div className="wz-modal-gl">
                {grande.deriva ? "lo que implica el precio que pusiste" : `${etiquetaTipeada(principal)} que ingresaste`}
              </div>

              <p id="modal-plausibilidad-titulo" className="wz-modal-msg">
                {principal.mensaje}
              </p>

              {resto.length > 0 && (
                <div className="wz-modal-resto">
                  <div className="wz-modal-gl">
                    {resto.length === 1 ? "Y arrastra una cosa más" : `Y arrastra ${numeroEnPalabras(resto.length)} cosas más`}
                  </div>
                  <ul>
                    {resto.map((a) => (
                      <li key={a.regla}>{a.mensaje}</li>
                    ))}
                  </ul>
                </div>
              )}

              {origenes.length > 0 && (
                <>
                  <div className="wz-modal-orig">
                    {origenes.map((o) => (
                      <button key={o.key} type="button" onClick={() => onOrigen?.(o.key)} className="wz-modal-o">
                        <span className="ol">{o.label}</span>
                        {/* El rojo, en el único lugar donde es atención: la sospecha más probable. */}
                        <span className={`ov${o.sospechoso ? " sosp" : ""}`}>{o.valor}</span>
                        <span className="wz-disco wz-disco-chico" aria-hidden>›</span>
                      </button>
                    ))}
                  </div>
                  <div className="wz-modal-gl">
                    {origenes.length === 1 ? "Toca para corregir" : "Toca el que quieras corregir"}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2 id="modal-plausibilidad-titulo" className="wz-modal-dir">
                {resumen?.direccion ?? "Tu análisis"}
              </h2>
              {resumen?.modalidad && <div className="wz-modal-gl">{resumen.modalidad}</div>}

              {resumen && resumen.derivados.length > 0 && (
                <div className="wz-modal-der">
                  {resumen.derivados.map((d) => (
                    <div key={d.label}>
                      <div className="ol">{d.label}</div>
                      <div className="ov">{d.valor}</div>
                    </div>
                  ))}
                </div>
              )}

              {consumo && <p className="wz-modal-consumo">{consumo}</p>}
            </>
          )}
        </div>

        {/* Acciones fijas, apiladas y a todo el ancho, el primario arriba. */}
        <div className="wz-modal-mb">
          {esAnomalia ? (
            modo === "aviso" ? (
              <>
                <button ref={primarioRef} type="button" onClick={cerrar} className="wz-btn2 tinta">
                  Corregir
                </button>
                <button type="button" onClick={onSeguir} className="wz-btn2">
                  Seguir igual
                </button>
              </>
            ) : (
              // Sin "continuar igual": el server lo rechaza de todos modos.
              <button ref={primarioRef} type="button" onClick={cerrar} className="wz-btn2 tinta">
                Volver y corregir
              </button>
            )
          ) : (
            <>
              <button ref={primarioRef} type="button" onClick={onConfirmar} disabled={submitting} className="wz-cta wz-cta-modal">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Generando…
                  </>
                ) : (
                  labelConfirmar
                )}
              </button>
              <button type="button" onClick={cerrar} disabled={submitting} className="wz-btn2">
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
