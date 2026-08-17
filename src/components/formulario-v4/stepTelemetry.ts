"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Ciclo de vida por paso del wizard (I-1) — capa GENÉRICA.
//
// Principio: para cualquier pantalla, "se fue" tiene causas distinguibles. Un
// solo evento uniforme, `wizard4_step_left`, las separa sin instrumentar
// pantalla por pantalla:
//
//   · no cargó / lento      → dwell corto + interactuo=false (cruzar con $web_vitals)
//   · vio y no tocó nada    → interactuo=false, dwell largo
//   · tocó y se atascó      → interactuo=true, control_principal_usado=false
//   · rechazo de validación → validacion_rechazos > 0
//   · completó y se arrepintió → salida="retrocedio" con control_principal_usado=true
//   · interrupción externa  → salida="tab_oculta_sin_retorno"
//
// La emisión vive en WizardV4 (dueño del nav): las pantallas no se tocan.
// `wizard4_step_viewed` NO cambia (continuidad histórica de los funnels) y
// `wizard4_abandoned` se conserva; step_left convive con ambos.
//
// UN step_left por VISITA a un paso: el primero que se emite gana y marca el
// paso como cerrado. Consecuencia asumida: si un paso emite
// `tab_oculta_sin_retorno` y el usuario vuelve y avanza, ese "avanzo" no se
// emite — el `step_viewed` del paso siguiente conserva el funnel intacto y el
// evento de interrupción es la señal más informativa de las dos.
//
// Fire-and-forget: todo pasa por `trackWizard` (capture envuelto), nada bloquea
// ni lanza. Cardinalidad acotada: cero texto libre del usuario.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import type { PostHog } from "posthog-js";
import { trackWizard } from "./track";
import { computePlannedPath, type NodeId, type WizardV4Answers } from "./wizardV4Nodes";

export type SalidaPaso =
  | "avanzo"
  | "retrocedio"
  | "abandono_navegacion"
  | "tab_oculta_sin_retorno";

/**
 * Reglas de validación que RECHAZAN input, enum cerrado. Corresponden a
 * rechazos que ya existen en el producto — esto no agrega validaciones nuevas.
 *  · cobertura        — comuna fuera del Gran Santiago (paso dir)
 *  · gate_reglamento  — el edificio no permite renta corta (gateNo)
 *  · escala           — el aviso de magnitud de un campo numérico
 *  · pie_incompleto   — pie sin declarar / 0 sin razón (resumen)
 * `plausibilidad` NO entra: ya tiene sus propios eventos (`wizard4_input_implausible`
 * cliente+server y `wizard4_alerta_temprana`) y duplicarla ensuciaría ambos.
 */
export type ReglaValidacion = "cobertura" | "gate_reglamento" | "escala" | "pie_incompleto";

/** Segundos que la pestaña debe estar oculta SIN volver para contarlo como interrupción. */
const MS_TAB_OCULTA = 30_000;

/**
 * Rechazos sufridos en el paso VIGENTE. Vive a nivel de módulo a propósito: las
 * pantallas lo alimentan llamando `reportarValidacionRechazo` sin que haya que
 * bajar un callback por props hasta cada input. El hook lo lee al cerrar el paso
 * y lo resetea al abrir el siguiente.
 */
let rechazosPasoActual = 0;

/**
 * Nodo vigente, para que quien reporta un rechazo no tenga que saber en qué
 * paso vive. Lo mantiene `useStepTelemetry` (un solo escritor). Existe por
 * `NumericInput`, que es el punto único donde se pinta el aviso de escala y es
 * un componente genérico reusado por media docena de pantallas: pasarle el
 * nodo por props sería plomería en cinco call-sites para un dato que el wizard
 * ya conoce.
 */
let nodoVigente: NodeId | null = null;

/**
 * Sonda de salida de una pantalla concreta (I-2: `mod` y `dir`). La pantalla
 * registra QUÉ quiere contar al cerrarse; el disparo lo hace `emitir`, junto al
 * `step_left`.
 *
 * Por qué no un cleanup de `useEffect` en la pantalla, que sería lo obvio: en
 * StrictMode (dev) React monta, desmonta y vuelve a montar, así que el cleanup
 * emitía un evento fantasma con los contadores en cero — verificado en el E2E,
 * con `mod_interaccion` saliendo dos veces y `dir_tipeo` con chars_rango "0"
 * después de tipear 28 caracteres. Además el desmontaje ocurre ANTES de que el
 * efecto de sincronización copie la respuesta recién elegida, así que el evento
 * salía además con `seleccion: "ninguna"`. Colgarlo del cierre de paso —que ya
 * tiene el guard anti-StrictMode y corre una sola vez por visita— arregla las
 * dos cosas de raíz.
 *
 * El callback se re-registra en cada render (cierre siempre fresco) y se lee
 * una sola vez, al cerrar el paso.
 *
 * Mapa POR NODO y no un slot único: al cambiar de paso, la pantalla entrante
 * renderiza —y registra— ANTES de que corran los efectos que cierran la
 * saliente, así que un slot único quedaba pisado y la sonda del paso que se iba
 * no salía nunca (visto en el E2E: `step_left` sí, `mod_interaccion` no).
 */
type SondaSalida = () => { name: string; props: Record<string, unknown> } | null;
const sondasSalida = new Map<NodeId, SondaSalida>();

export function registrarSondaSalida(node: NodeId, fn: SondaSalida): void {
  sondasSalida.set(node, fn);
}

/**
 * Emite `wizard4_validacion_rechazo` y suma al contador del paso vigente.
 * Llamar en el momento en que el rechazo se le MUESTRA al usuario (no en cada
 * render del mensaje: el caller decide la unicidad). `node` opcional: por
 * defecto, el paso vigente.
 */
export function reportarValidacionRechazo(
  posthog: PostHog | null | undefined,
  regla: ReglaValidacion,
  node?: NodeId,
): void {
  const n = node ?? nodoVigente;
  if (!n) return;
  rechazosPasoActual += 1;
  trackWizard(posthog, "wizard4_validacion_rechazo", { node: n, regla });
}

interface PasoEnCurso {
  node: NodeId;
  inicio: number;
  interacciones: number;
  /** Timestamp de la primera interacción; null si nunca tocó nada. */
  primera: number | null;
  emitido: boolean;
}

export function useStepTelemetry(opts: {
  posthog: PostHog | null | undefined;
  node: NodeId;
  /** Dirección de la transición que trajo al usuario a `node`. */
  dir: "forward" | "back";
  answers: WizardV4Answers;
  completed: Partial<Record<NodeId, boolean>>;
  /** Contenedor de la pantalla: de ahí salen las interacciones del paso. */
  contenedorRef: React.RefObject<HTMLElement>;
  /** true cuando el usuario disparó la acción terminal (generar / pagar). */
  terminadoRef: React.MutableRefObject<boolean>;
}): void {
  const { posthog, node, dir, answers, completed, contenedorRef, terminadoRef } = opts;

  const pasoRef = useRef<PasoEnCurso | null>(null);
  // Espejos para leer lo último desde handlers que se registran una sola vez.
  const answersRef = useRef(answers);
  const completedRef = useRef(completed);
  const dirRef = useRef(dir);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { dirRef.current = dir; }, [dir]);

  const emitir = useCallback((paso: PasoEnCurso, salida: SalidaPaso) => {
    if (paso.emitido) return;
    paso.emitido = true;
    const a = answersRef.current;
    // Índice del paso EN SU RAMA: el mismo cálculo que alimenta la barra de
    // progreso, así "posición 3" significa lo mismo en el evento y en la UI.
    // Los detours (tasaFix/arrFix/adrFix) y gateNo no están en el camino
    // planificado → posicion null, que es la verdad: no son progreso.
    const idx = computePlannedPath(a).indexOf(paso.node);
    trackWizard(posthog, "wizard4_step_left", {
      node: paso.node,
      salida,
      rama: a.modalidad ?? "sin_definir",
      rama_tipo: a.tipoPropiedad ?? "sin_definir",
      posicion: idx >= 0 ? idx + 1 : null,
      dwell_ms: Date.now() - paso.inicio,
      t_primera_interaccion_ms: paso.primera != null ? paso.primera - paso.inicio : null,
      interactuo: paso.interacciones > 0,
      n_interacciones: paso.interacciones,
      control_principal_usado: completedRef.current[paso.node] === true,
      validacion_rechazos: rechazosPasoActual,
    });
    // Sonda específica de esta pantalla (mod / dir), si la registró.
    const sonda = sondasSalida.get(paso.node);
    if (sonda) {
      sondasSalida.delete(paso.node);
      const ev = sonda();
      if (ev) trackWizard(posthog, ev.name, ev.props);
    }
  }, [posthog]);

  // ── Cambio de paso: cierra el anterior y abre el nuevo ──
  // El guard por `node` cubre el doble render de StrictMode (la segunda pasada
  // ve el mismo nodo y no re-emite).
  useEffect(() => {
    const prev = pasoRef.current;
    if (prev && prev.node === node) return;
    if (prev) emitir(prev, dirRef.current === "back" ? "retrocedio" : "avanzo");
    pasoRef.current = { node, inicio: Date.now(), interacciones: 0, primera: null, emitido: false };
    rechazosPasoActual = 0;
    nodoVigente = node;
  }, [node, emitir]);

  // ── Interacciones del paso ──
  // El contenedor lleva key={node}, así que se remonta por paso y este efecto
  // se re-suscribe al elemento nuevo. Capture phase: cuenta aunque el handler
  // del control detenga la propagación.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const onInteract = () => {
      const p = pasoRef.current;
      if (!p || p.emitido) return;
      p.interacciones += 1;
      if (p.primera == null) p.primera = Date.now();
    };
    el.addEventListener("pointerdown", onInteract, true);
    el.addEventListener("keydown", onInteract, true);
    return () => {
      el.removeEventListener("pointerdown", onInteract, true);
      el.removeEventListener("keydown", onInteract, true);
    };
  }, [node, contenedorRef]);

  // ── Salidas que no pasan por el grafo: cerrar pestaña e interrupción ──
  useEffect(() => {
    let timerOculta: ReturnType<typeof setTimeout> | null = null;

    const onHide = () => {
      const p = pasoRef.current;
      if (!p) return;
      // Terminal (generar/pagar) es un avance real hacia fuera del wizard, no un
      // abandono: así el dwell del resumen de quien SÍ completa queda medido.
      emitir(p, terminadoRef.current ? "avanzo" : "abandono_navegacion");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timerOculta) clearTimeout(timerOculta);
        timerOculta = setTimeout(() => {
          const p = pasoRef.current;
          if (p) emitir(p, "tab_oculta_sin_retorno");
        }, MS_TAB_OCULTA);
      } else if (timerOculta) {
        // Volvió dentro de la ventana: no hubo interrupción que reportar.
        clearTimeout(timerOculta);
        timerOculta = null;
      }
    };

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerOculta) clearTimeout(timerOculta);
    };
  }, [emitir, terminadoRef]);
}

/** Rango acotado de altura de viewport — proxy del fold sin meter píxeles crudos. */
export function rangoViewportH(h: number): "<600" | "600-750" | "750-900" | ">900" {
  if (h < 600) return "<600";
  if (h < 750) return "600-750";
  if (h < 900) return "750-900";
  return ">900";
}

/** Rango acotado de caracteres tipeados (cardinalidad: 4 valores). */
export function rangoChars(n: number): "0" | "1-5" | "6-15" | "16+" {
  if (n <= 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 15) return "6-15";
  return "16+";
}
