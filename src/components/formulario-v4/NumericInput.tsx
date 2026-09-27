"use client";

// ─────────────────────────────────────────────────────────────────────────────
// NumericInput — entrada numérica del wizard v4
//
// Contrato visual: assets-export/mockup-numeric-input.html (vinculante).
// Lectura del texto: src/lib/numero-cl.ts (parseNumeroCL / formatNumeroCL).
//
// EL ECO ES LA DEFENSA, NO EL FILTRO DE TECLAS
// ────────────────────────────────────────────
// Los ocho filtros que este componente reemplaza peleaban con el teclado: le
// borraban al usuario el separador "equivocado" y soldaban los dígitos, así que
// "4,5" quedaba como 45 sin una sola señal en pantalla. Todos los errores
// conocidos de esa familia son ×10.
//
// Acá se invierte el mecanismo. El campo ACEPTA lo que se escribe —dígitos,
// coma, punto— y muestra debajo, en vivo, cómo lo está entendiendo. Si no lo
// entiende, el eco se apaga y lo tipeado queda intacto en pantalla: el usuario
// ve qué fue lo que no se entendió, en vez de descubrir un número plausible y
// equivocado tres pantallas después.
//
// CINCO ESTADOS, Y SOLO UNO ES ROJO
// ─────────────────────────────────
//   vacío       — solo el input
//   en curso    — todavía no se puede leer, pero alguna tecla puede salvarlo
//   ok          — eco encendido
//   escala      — eco encendido + aviso: se entendió, pero es imposible
//   error       — eco apagado, borde marcado, mensaje. La tecla NO se borra.
//
// La distinción que sostiene el diseño: "todavía no se puede leer" no es lo
// mismo que "no se va a poder leer". Mientras exista una continuación que salve
// lo escrito, el campo se calla. Marcar cada estado intermedio entrena a ignorar
// el rojo, y un rojo que aparece mientras escribís deja de significar algo.
//
// PRESUPUESTO DE SIGNAL RED — un solo uso, el #6 (error de formulario)
// ────────────────────────────────────────────────────────────────────
// El aviso de ESCALA deliberadamente NO va en rojo: ahí el número se entendió y
// lo que falla es su magnitud. Si los dos estados fueran rojos, el usuario no
// podría distinguir "no te entendí" de "te entendí y es imposible" — que son dos
// acciones distintas de su parte. El aviso usa el reemplazo que el design system
// define para el ámbar de alerta: Ink + label uppercase + borde lateral.
//
// Los UMBRALES de escala NO viven acá. `plausibilidad.ts` declara ser "el ÚNICO
// lugar donde viven los umbrales"; por eso el componente recibe una función
// `escala` y el llamador la arma desde ese módulo. Acá vive el mecanismo, no los
// números.
//
// LA CONDUCTA ES PURA Y ESTÁ EXPORTADA
// ────────────────────────────────────
// `estadoNumericInput` y sus ayudantes son funciones sin React. El repo no tiene
// runner de componentes, así que si la conducta viviera dentro del componente
// los tests solo podrían probar una RÉPLICA — y una réplica que se edita junto
// al arreglo no prueba nada. `scripts/test-numeric-input.ts` llama exactamente
// al mismo código que corre en producción.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { formatNumeroCL, parseNumeroCL, type Decimales } from "@/lib/numero-cl";
import { FieldLabel } from "./ui";
import { reportarValidacionRechazo } from "./stepTelemetry";
import type { AvisoEscala } from "./avisoEscala";

// ── Conducta pura ────────────────────────────────────────────────────────────

export type EstadoNumericInput =
  | { estado: "vacio" }
  | { estado: "encurso" }
  | { estado: "ok"; valor: number; eco: string }
  | { estado: "escala"; valor: number; eco: string; aviso: string }
  | { estado: "error"; motivo: string };

/**
 * ¿Lo escrito puede TODAVÍA terminar bien agregando dígitos?
 *
 * Se prueba agregando 1, 2 y 3: es lo que hace falta para cerrar un grupo de
 * miles, y por lo tanto el horizonte completo en el que un prefijo ambiguo puede
 * resolverse. Si ninguna continuación parsea, no hay tecla que lo salve y el
 * error es definitivo — recién ahí se marca con el foco todavía adentro.
 */
export function esPrefijoViable(texto: string, decimales: Decimales): boolean {
  for (const sufijo of ["0", "00", "000"]) {
    if (parseNumeroCL(texto + sufijo, decimales) !== null) return true;
  }
  return false;
}

/**
 * Por qué no se pudo leer. Se completa después de "No se entiende ese número —",
 * así que cada motivo es la SEGUNDA mitad de la frase.
 *
 * Copy: dice qué corresponde en el campo, no qué hizo mal el usuario (se le fue
 * una tecla, no hizo nada tonto). Y dice una cosa sola: el motivo del
 * agrupamiento decía "revisa los puntos: los miles van de a tres", con dos
 * dos-puntos en la misma frase y una orden que el ejemplo ya da solo.
 */
export function motivoError(texto: string, decimales: Decimales): string {
  const cuerpo = texto.trim().replace(/^[-+]/, "");
  if (!/^[\d.,]*$/.test(cuerpo)) return "solo números, punto y coma.";

  // ¿Se leería bien con MÁS decimales? Entonces el problema es la precisión del
  // campo, no cómo está escrito — y decírselo así es lo único accionable.
  for (const d of [1, 2] as Decimales[]) {
    if (d > decimales && parseNumeroCL(texto, d) !== null) {
      return decimales === 0
        ? "este campo va en números enteros."
        : `este campo toma ${decimales} decimal${decimales === 1 ? "" : "es"}.`;
    }
  }
  return "los miles van de a tres (1.234.567).";
}

/** Frase completa del error. Un solo lugar arma el "prefijo — motivo". */
export function fraseError(texto: string, decimales: Decimales): string {
  return `No se entiende ese número — ${motivoError(texto, decimales)}`;
}

/**
 * Decimales con los que mostrar un valor SIN redondearlo nunca.
 *
 * El eco no puede mentir: si mostrara "3.200,3" para 3200,25 estaría cometiendo,
 * justo en la línea de defensa, el mismo truncado silencioso que el componente
 * viene a matar.
 */
export function decimalesUtiles(valor: number): Decimales {
  if (Number.isInteger(valor)) return 0;
  return Math.round(valor * 10) / 10 === valor ? 1 : 2;
}

/**
 * Reexpresa el texto en otra unidad. Es lo que corre cuando el toggle UF/$
 * cambia la precisión en caliente.
 *
 * CONVIERTE EL VALOR, no reinterpreta el string: "3.200,5" en UF pasa a
 * "126.419.750" en pesos, no a un error por decimales de más. Re-parsear el
 * texto crudo con la nueva precisión tiraría error en un gesto que el usuario
 * percibe como "mostrar lo mismo en otra moneda".
 *
 * Devuelve `null` si el texto no se puede leer — ahí el llamador deja lo tipeado
 * como está en vez de borrárselo.
 */
export function convertirUnidad(
  texto: string,
  decimalesOrigen: Decimales,
  decimalesDestino: Decimales,
  factor: number,
): string | null {
  const valor = parseNumeroCL(texto, decimalesOrigen);
  if (valor === null || !Number.isFinite(factor)) return null;
  return formatNumeroCL(valor * factor, decimalesDestino);
}

export interface OpcionesEstado {
  decimales: Decimales;
  /** El campo ya perdió el foco con esto escrito. Endurece el veredicto. */
  blurred: boolean;
  /** Texto del eco a partir del valor leído. */
  formatEco: (valor: number) => string;
  /**
   * Aviso de magnitud, o `null` si el valor está en escala. Los umbrales los
   * pone el llamador desde `plausibilidad.ts` — acá no vive ninguno.
   */
  escala?: (valor: number) => AvisoEscala | null;
}

/** Estado completo del campo para un texto dado. Puro y determinístico. */
export function estadoNumericInput(texto: string, opts: OpcionesEstado): EstadoNumericInput {
  if (texto.trim() === "") return { estado: "vacio" };

  const valor = parseNumeroCL(texto, opts.decimales);

  if (valor === null) {
    // Rojo si ninguna tecla lo salva, o si ya soltó el campo así.
    if (!esPrefijoViable(texto, opts.decimales) || opts.blurred) {
      return { estado: "error", motivo: motivoError(texto, opts.decimales) };
    }
    return { estado: "encurso" };
  }

  const eco = opts.formatEco(valor);
  const aviso = opts.escala?.(valor) ?? null;
  // ── El prefijo incompleto NO es un valor fuera de escala (fix 19-ago-2026) ──
  //
  // Este es el mismo principio que ya gobierna `encurso` —"todavía no se puede
  // leer" ≠ "no se va a poder leer"— aplicado al eslabón que se había quedado
  // afuera. `escala` sí podía leer el número: lo que no podía era saber que
  // todavía le faltaban teclas.
  //
  // Al teclear el `6` de "65 m²" el guard leía 6 m² < 12 y avisaba. Medido: el
  // 100% de los usuarios veía "Fuera de escala" en `tam` y en `precio`, ~1,4
  // veces cada uno. Los umbrales (12 m², 300 UF) están bien; lo que estaba mal
  // era CUÁNDO se evaluaban.
  //
  // Debajo del mínimo y sin haber soltado el campo → se calla, porque cualquier
  // tecla lo puede salvar. Sobre el máximo → avisa igual, en el acto: ahí no hay
  // continuación que lo rescate y ese aviso temprano es la razón de ser del
  // módulo. Al blur se evalúa todo, sin excepciones.
  if (aviso && (opts.blurred || aviso.sobreMaximo)) {
    return { estado: "escala", valor, eco, aviso: aviso.mensaje };
  }
  return { estado: "ok", valor, eco };
}

/** Eco por defecto: prefijo + número sin redondear + sufijo. */
export function ecoPorDefecto(prefijo = "", sufijo = "") {
  return (valor: number) => `${prefijo}${formatNumeroCL(valor, decimalesUtiles(valor))}${sufijo}`;
}

// ── Componente ───────────────────────────────────────────────────────────────

export interface NumericInputProps {
  /** Texto crudo. El componente NO lo filtra: lo que se tipea, se guarda. */
  value: string;
  onChange: (v: string) => void;
  /** Decimales que admite ESTE campo. Ver la tabla de precisiones del wizard. */
  decimales: Decimales;
  label?: string;
  tooltip?: string;
  placeholder?: string;
  /** Sufijo dentro del input (UF, $, %, m²). Decorativo. */
  sufijo?: string;
  /** Prefijo/sufijo del ECO. Ignorados si se pasa `formatEco`. */
  ecoPrefijo?: string;
  ecoSufijo?: string;
  /** Eco a medida (pluralización, unidades compuestas). Gana sobre los de arriba. */
  formatEco?: (valor: number) => string;
  /** Aviso de magnitud. Los umbrales los pone el llamador. */
  escala?: (valor: number) => AvisoEscala | null;
  /** El campo protagonista de la pantalla (precio): más alto y la cifra más grande. */
  strong?: boolean;
  autoFocus?: boolean;
  inputMode?: "decimal" | "numeric";
  /** Arranca ya evaluado como si hubiera perdido el foco (edición inline). */
  iniciaEvaluado?: boolean;
}

export function NumericInput({
  value,
  onChange,
  decimales,
  label,
  tooltip,
  placeholder,
  sufijo,
  ecoPrefijo = "",
  ecoSufijo = "",
  formatEco,
  escala,
  strong,
  autoFocus,
  inputMode,
  iniciaEvaluado = false,
}: NumericInputProps) {
  const [blurred, setBlurred] = useState(iniciaEvaluado);
  const idEco = useId();
  const idInput = useId();
  const posthog = usePostHog();

  const r = estadoNumericInput(value, {
    decimales,
    blurred,
    formatEco: formatEco ?? ecoPorDefecto(ecoPrefijo, ecoSufijo),
    escala,
  });
  const hayError = r.estado === "error";

  // Rechazo por ESCALA (I-1): punto único donde el aviso de magnitud se le
  // muestra al usuario, así que acá se reporta — una vez por ENTRADA al estado,
  // no en cada tecla mientras el valor sigue fuera de escala. El nodo lo pone
  // `stepTelemetry` (paso vigente): este componente es genérico y no lo conoce.
  const escalaPrevia = useRef(false);
  useEffect(() => {
    const enEscala = r.estado === "escala";
    if (enEscala && !escalaPrevia.current) reportarValidacionRechazo(posthog, "escala");
    escalaPrevia.current = enEscala;
  }, [r.estado, posthog]);

  // `inputMode` por defecto según la precisión: un campo entero no necesita
  // ofrecer la coma en el teclado móvil.
  const modo = inputMode ?? (decimales === 0 ? "numeric" : "decimal");

  // Formato del informe (27-sep-2026): el campo en --card, el foco en tinta, el error con borde
  // rojo (`aria-invalid`, en wizard-v4.css). El eco en Inter, con la cifra en negrita.
  return (
    <div className="wz-campo">
      {label && <FieldLabel tooltip={tooltip} htmlFor={idInput}>{label}</FieldLabel>}

      <div className="wz-input-caja">
        <input
          id={idInput}
          type="text"
          inputMode={modo}
          placeholder={placeholder}
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={value}
          aria-invalid={hayError}
          aria-label={label ? undefined : placeholder}
          aria-describedby={r.estado === "vacio" ? undefined : idEco}
          onChange={(e) => { setBlurred(false); onChange(e.target.value); }}
          onFocus={() => setBlurred(false)}
          onBlur={() => setBlurred(true)}
          className={`wz-input${strong ? " wz-grande" : ""}${sufijo ? " con-suf" : ""}`}
        />
        {sufijo && <span className="wz-suf">{sufijo}</span>}
      </div>

      {/* Eco / en curso / error — nunca dos a la vez, siempre en el mismo lugar. */}
      <div id={idEco} className="wz-eco-caja" aria-live="polite">
        {r.estado === "encurso" && <p className="wz-eco">Sigue escribiendo — todavía no se puede leer.</p>}
        {r.estado === "error" && <p className="wz-aviso fuerte">No se entiende ese número — {r.motivo}</p>}
        {(r.estado === "ok" || r.estado === "escala") && (
          <p className="wz-eco">
            = <b>{r.eco}</b>
          </p>
        )}
      </div>

      {/* Aviso de magnitud: una indicación bajo el campo, en gris. Sin el rótulo «Fuera de
          escala» (27-sep-2026): el mismo aviso servía para cosas que no son de escala —el pie 0
          sin razón— y el rótulo las nombraba mal. Nunca rojo: el rojo dice «no te entendí». */}
      {r.estado === "escala" && <p className="wz-indic">{r.aviso}</p>}
    </div>
  );
}
