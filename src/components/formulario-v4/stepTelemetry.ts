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
//   · interrupción externa  → salida="tab_oculta_sin_retorno" + props de visibilidad
//
// La emisión vive en WizardV4 (dueño del nav): las pantallas no se tocan.
// `wizard4_step_viewed` NO cambia (continuidad histórica de los funnels) y
// `wizard4_abandoned` se conserva; step_left convive con ambos.
//
// UN step_left por VISITA a un paso: el primero que se emite gana y marca el
// paso como cerrado.
//
// Eso convivía con un timer de 30 s que emitía `tab_oculta_sin_retorno` apenas
// la pestaña se ocultaba, y la combinación resultó cara: quien atendía un
// WhatsApp de 31 segundos quedaba archivado como abandono, y quien volvía y
// DESPUÉS se iba de verdad era inmedible —el paso ya estaba cerrado cuando
// pasaba lo interesante—. Medido: 44 de los 45 abandonos de la portada eran de
// ese timer, contra UNO de navegación.
//
// Desde el 21-ago-2026 el timer ya no decide: ocultar/mostrar solo acumula, y
// el evento sale al cerrar el paso de verdad, con cuánto estuvo oculta la
// pestaña. El timer queda para el único caso sin cierre posible —el que nunca
// vuelve— con umbral de 3 minutos. Ver `visibilidadPaso.ts`.
//
// Fire-and-forget: todo pasa por `trackWizard` (capture envuelto), nada bloquea
// ni lanza. Cardinalidad acotada: cero texto libre del usuario.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import type { PostHog } from "posthog-js";
import { trackWizard } from "./track";
import { computePlannedPath, type NodeId, type WizardV4Answers } from "./wizardV4Nodes";
import {
  ESQUEMA_SALIDA,
  MS_OCULTA_NO_VOLVIO,
  alMostrar,
  alOcultar,
  nuevaVisibilidad,
  propsVisibilidad,
  type VisibilidadPaso,
} from "./visibilidadPaso";

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
  /** Contabilidad de ocultaciones de la pestaña DURANTE este paso. */
  visibilidad: VisibilidadPaso;
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
      // ── `rama` es "sin_definir" en TODO el wizard salvo el tramo final ──
      // Desde que la modalidad se mudó al final (19-ago-2026) nadie la ha
      // elegido antes de `mod`, así que los pasos dir…plazo salen todos sin
      // rama. Es una CONSECUENCIA ACEPTADA del reordenamiento, no un bug: el
      // dato "abandonó en `precio` siendo STR" dejó de existir por construcción,
      // no por instrumentación rota.
      //
      // Se puede reconstruir en la query cuando haga falta: los eventos de los
      // pasos previos comparten `person_id` con el `wizard4_answered` de `mod`,
      // así que un argMax por persona recupera la rama. Lo que NO se puede es
      // comparar la serie contra la anterior — ver el hito del 19-ago en
      // `src/lib/admin-funnel-hitos.ts`.
      rama: a.modalidad ?? "sin_definir",
      rama_tipo: a.tipoPropiedad ?? "sin_definir",
      posicion: idx >= 0 ? idx + 1 : null,
      // Versión del esquema: los valores de `salida` significan otra cosa antes
      // del 21-ago-2026 (umbral de 30 s, decisión al vencer el timer). Va en el
      // evento para no tener que adivinar por fecha en la query.
      esquema_salida: ESQUEMA_SALIDA,
      // `dwell_ms` NO cambia de significado —sigue siendo reloj de pared— y
      // `dwell_activo_ms` descuenta el rato en que la pestaña estuvo oculta.
      // Las dos juntas: la vieja no rompe la serie, la nueva es la comparable
      // entre pantallas. Ver `visibilidadPaso.ts`.
      ...propsVisibilidad(paso.inicio, Date.now(), paso.visibilidad),
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
    pasoRef.current = {
      node, inicio: Date.now(), interacciones: 0, primera: null, emitido: false,
      // Contabilidad POR PASO: si el usuario se distrae en `precio` eso no debe
      // contaminar el dwell de `pie`.
      visibilidad: nuevaVisibilidad(),
    };
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

    // LA DECISIÓN SE TOMA AL CERRAR EL PASO, NO AL VENCER EL TIMER.
    //
    // Antes el timer emitía y marcaba el paso como cerrado, así que "se ausentó
    // y después volvió a completar" quedaba archivado como abandono y "volvió y
    // DESPUÉS se fue de verdad" era inmedible con cualquier umbral: el paso ya
    // estaba cerrado cuando pasaba lo interesante.
    //
    // Ahora cada ciclo ocultar/mostrar solo ACUMULA, y el cierre real —avanzó,
    // retrocedió, cerró la pestaña— sale con la historia completa. El timer
    // sobrevive únicamente para el caso donde no hay cierre posible: el que
    // nunca vuelve.
    const onVisibility = () => {
      const p = pasoRef.current;
      if (!p || p.emitido) return;
      if (document.visibilityState === "hidden") {
        p.visibilidad = alOcultar(p.visibilidad, Date.now());
        if (timerOculta) clearTimeout(timerOculta);
        timerOculta = setTimeout(() => {
          const actual = pasoRef.current;
          // Sigue oculta y sigue siendo el mismo paso: no volvió.
          if (actual === p && !actual.emitido) emitir(actual, "tab_oculta_sin_retorno");
        }, MS_OCULTA_NO_VOLVIO);
      } else {
        // Volvió: se cierra la ocultación y el paso SIGUE VIVO. No se emite
        // nada — el evento saldrá cuando el paso se cierre de verdad, y llevará
        // cuánto estuvo afuera.
        p.visibilidad = alMostrar(p.visibilidad, Date.now());
        if (timerOculta) { clearTimeout(timerOculta); timerOculta = null; }
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
