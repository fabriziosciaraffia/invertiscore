"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Motor de navegación (hook)
//
// Maneja: nodo actual + historial (chevron atrás), modo edición (retorno directo
// al resumen), reask de rama al cambiar modalidad/tipo (invalidación explícita),
// reacciones de Franco (una pantalla), y draft en localStorage con resume.
//
// El grafo y las transiciones son puros (wizardV4Nodes.ts). Este hook solo
// orquesta estado; NO tiene lógica de negocio (eso llega en Fases 2-4).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeNext,
  nodeReacts,
  progressFor,
  type NodeId,
  type WizardV4Answers,
} from "./wizardV4Nodes";
import {
  adoptarDraftInvitado,
  adoptarEnEstaPestana,
  cleanupOrphans,
  descartarBorradores,
  getTabId,
  keyFor,
  mostRecentDraft,
  mostrarBannerDraft,
  writeDraft,
  type PersistedDraft,
} from "./wizardV4Draft";
import { purgarDraftsLegacyUnaVez } from "@/lib/draft-keys";

type Mode = "flow" | "edit" | "reask";

export interface WizardV4Nav {
  current: NodeId;
  history: NodeId[];
  answers: WizardV4Answers;
  completed: Partial<Record<NodeId, boolean>>;
  mode: Mode;
  editContext: { node: NodeId; prev: unknown } | null;
  /** Nodo cuya reacción de Franco debe mostrarse en la pantalla actual (o null). */
  reactionSource: NodeId | null;
  /** Dirección de la transición para la animación slide+fade. */
  dir: "forward" | "back";
}

const DEFAULT_NAV: WizardV4Nav = {
  current: "dir",
  history: [],
  answers: {},
  completed: {},
  mode: "flow",
  editContext: null,
  reactionSource: null,
  dir: "forward",
};

/** Callback de instrumentación (PostHog). El hook lo llama FUERA del updater de
 *  setNav — nada de side-effects en el reducer (evita doble-fire en StrictMode).
 *  El hook no conoce PostHog; solo emite nombres+props semánticos. */
export type WizardV4Event = (name: string, props?: Record<string, unknown>) => void;

export interface UseWizardV4 {
  nav: WizardV4Nav;
  /** Draft recuperable ofrecido vía banner (null si no hay o ya se resolvió). */
  draftPendiente: PersistedDraft | null;
  /** Progreso 0..1 monotónico para la barra (nunca retrocede). */
  progress: number;
  /** Actualiza campos en vivo (inputs) SIN navegar. */
  patchAnswers: (patch: Partial<WizardV4Answers>) => void;
  /** Responde la pantalla actual y navega según el grafo / modo. */
  answer: (node: NodeId, patch?: Partial<WizardV4Answers>) => void;
  /** Chevron atrás (no-op si no hay historial). */
  goBack: () => void;
  /** Entra a una pantalla de corrección inline (tasaFix/arrFix/adrFix). */
  goDetour: (fix: NodeId, patch?: Partial<WizardV4Answers>) => void;
  /** gateNo: cambia a renta larga e invalida la rama STR. */
  gateNoSwitchToLtr: () => void;
  /** gateNo: "me equivoqué, volver" → regresa al gate. */
  gateNoBack: () => void;
  /** Retoma el draft ofrecido. */
  resumeDraft: () => void;
  /** Descarta el draft ofrecido y arranca limpio. */
  discardDraft: () => void;
  /** ¿Se muestra el banner de retomar? (solo en la primera pantalla). */
  bannerDraftVisible: boolean;
  /** ¿Se puede mostrar el chevron atrás? (oculto en primera pantalla y en edición). */
  canGoBack: boolean;
}

export function useWizardV4({
  resume,
  owner,
  onEvent,
}: {
  resume: boolean;
  /** `user.id` o `guest`. `null` = todavía resolviendo: no se toca el storage. */
  owner: string | null;
  onEvent?: WizardV4Event;
}): UseWizardV4 {
  const [nav, setNav] = useState<WizardV4Nav>(DEFAULT_NAV);
  const [draftPendiente, setDraftPendiente] = useState<PersistedDraft | null>(null);
  const mounted = useRef(false);
  // Estado más reciente para leer en los callbacks de acción sin re-crearlos, y
  // callback de instrumentación en ref (para emitir con [] deps). Ambos se leen
  // solo en event handlers, nunca durante el render.
  const navRef = useRef(nav);
  const onEventRef = useRef(onEvent);
  useEffect(() => { navRef.current = nav; }, [nav]);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  const emit = useCallback((name: string, props?: Record<string, unknown>) => {
    onEventRef.current?.(name, props);
  }, []);
  // Máximo de progreso alcanzado — la barra es monotónica (ver más abajo).
  const highWater = useRef(0);
  // Persistencia por pestaña (HALLAZGO-6a).
  const tabId = useRef<string>("");
  const draftVersion = useRef(0); // versión monotónica de la escritura de ESTA pestaña
  const offeredKey = useRef<string | null>(null); // key del draft ofrecido en el banner

  // ── Mount: limpiar huérfanas + ofrecer el draft más reciente entre pestañas.
  //    ?resume=1 (vuelta post-registro, misma pestaña) rehidrata directo al
  //    resumen; si no, se ofrece vía banner y el form arranca limpio. ──
  useEffect(() => {
    // Sin dueño resuelto no se lee ni se escribe nada: leer durante la ventana
    // de carga volvería a mostrar el borrador con el scope equivocado.
    if (owner == null || mounted.current) return;
    mounted.current = true;
    // La purga va ANTES de acuñar el tabId, para que el orden no importe: si
    // alguna vez volviera a tocar sessionStorage, el id se crea después y el
    // round-trip sobrevive igual. (Hoy `purgarBorradores` ya no lo toca.)
    //
    // Purga retroactiva, una vez por navegador: los borradores previos al scope
    // por dueño no se pueden atribuir a nadie, así que no hay forma segura de
    // conservarlos. Incluye los de v1/v2/v3, que tienen el mismo problema.
    purgarDraftsLegacyUnaVez();
    tabId.current = getTabId();
    // Round-trip invitado → registro: el borrador `guest` de ESTA pestaña pasa
    // a nombre del usuario recién logueado. Único cruce de scope permitido.
    adoptarDraftInvitado(tabId.current, owner);
    cleanupOrphans(keyFor(owner, tabId.current));
    const candidate = mostRecentDraft(owner);
    if (!candidate) return;
    offeredKey.current = candidate.key;
    const d = candidate.draft;
    if (resume) {
      draftVersion.current = d.version ?? 0;
      setNav({
        current: "resumen",
        history: d.history ?? [],
        answers: d.answers ?? {},
        completed: d.completed ?? {},
        mode: "flow",
        editContext: null,
        reactionSource: null,
        dir: "forward",
      });
    } else {
      setDraftPendiente(d);
    }
  }, [resume, owner]);

  // ── Persistencia debounced (500ms) en la key de ESTA pestaña. No persiste
  //    mientras hay un draft pendiente sin resolver (evita pisar con el form
  //    limpio). Versión monotónica por escritura. ──
  useEffect(() => {
    if (draftPendiente || !tabId.current || !owner) return;
    const t = setTimeout(() => {
      // Solo vale la pena guardar si el usuario avanzó algo.
      if (nav.current === "mod" && nav.history.length === 0 && Object.keys(nav.answers).length === 0) {
        return;
      }
      draftVersion.current = writeDraft(
        owner,
        tabId.current,
        {
          answers: nav.answers,
          completed: nav.completed,
          current: nav.current,
          history: nav.history,
          mode: nav.mode === "edit" ? "flow" : nav.mode,
        },
        draftVersion.current,
      );
    }, 500);
    return () => clearTimeout(t);
  }, [nav, draftPendiente, owner]);

  const patchAnswers = useCallback((patch: Partial<WizardV4Answers>) => {
    setNav((s) => ({ ...s, answers: { ...s.answers, ...patch } }));
  }, []);

  const answer = useCallback((node: NodeId, patch?: Partial<WizardV4Answers>) => {
    // Instrumentación FUERA del updater (evita doble-fire en StrictMode).
    const s0 = navRef.current;
    emit("wizard4_answered", { node, modalidad: patch?.modalidad ?? s0.answers.modalidad });
    setNav((s) => {
      // El resumen (documento maestro, F6) edita inline; ya no hay modo edición
      // ni reask hacia pantallas. answer() solo avanza el flujo por el grafo.
      const answers: WizardV4Answers = { ...s.answers, ...patch };
      const completed = { ...s.completed, [node]: true };
      const hasReaction = nodeReacts(node, answers);
      const next = computeNext(node, answers) ?? "resumen";
      return {
        ...s,
        answers,
        completed,
        history: [...s.history, s.current],
        current: next,
        reactionSource: hasReaction ? node : null,
        dir: "forward",
      };
    });
  }, [emit]);

  const goBack = useCallback(() => {
    const s0 = navRef.current;
    if (s0.history.length > 0) {
      emit("wizard4_back", { from: s0.current, to: s0.history[s0.history.length - 1] });
    }
    setNav((s) => {
      if (s.history.length === 0) return s;
      const history = s.history.slice(0, -1);
      const current = s.history[s.history.length - 1];
      return { ...s, current, history, dir: "back", reactionSource: null };
    });
  }, [emit]);

  const goDetour = useCallback((fix: NodeId, patch?: Partial<WizardV4Answers>) => {
    // goDetour solo entra a pantallas de corrección (tasaFix/arrFix/adrFix) → el
    // campo corregido es la base sin el sufijo "Fix".
    emit("wizard4_corrected", { field: fix.replace("Fix", "") });
    setNav((s) => ({
      ...s,
      answers: patch ? { ...s.answers, ...patch } : s.answers,
      history: [...s.history, s.current],
      current: fix,
      reactionSource: null,
      dir: "forward",
    }));
  }, [emit]);

  const gateNoSwitchToLtr = useCallback(() => {
    setNav((s) => {
      // Cambia a renta larga e invalida SOLO lo STR. En AMBAS el arriendo ya se
      // respondió (arr → gate → adr), así que se conserva y vamos directo al
      // resumen; en STR puro arr está pendiente y caemos en arr.
      const answers: WizardV4Answers = {
        ...s.answers,
        modalidad: "ltr",
        edificioPermiteAirbnb: undefined,
        adrModo: undefined,
        adrTarifa: undefined,
        adrOcupacion: undefined,
      };
      const completed = { ...s.completed };
      delete completed["gate"];
      delete completed["gateNo"];
      delete completed["adr"];
      delete completed["adrFix"];
      const current: NodeId = completed["arr"] ? "resumen" : "arr";
      return {
        ...s,
        answers,
        completed,
        history: [...s.history, s.current],
        current,
        reactionSource: null,
        dir: "forward",
      };
    });
  }, []);

  const gateNoBack = useCallback(() => {
    goBack();
  }, [goBack]);

  const resumeDraft = useCallback(() => {
    const d = draftPendiente;
    if (!d) return;
    // A partir de acá esta pestaña es la dueña del draft: continúa la versión
    // monotónica desde la ofrecida y escribe en su propia key. La de origen se
    // retira — si sobrevive, cada "Retomar" deja una key más.
    draftVersion.current = d.version ?? 0;
    adoptarEnEstaPestana(owner ?? "", tabId.current, offeredKey.current);
    offeredKey.current = null;
    setNav({
      current: d.current ?? "mod",
      history: d.history ?? [],
      answers: d.answers ?? {},
      completed: d.completed ?? {},
      mode: "flow",
      editContext: null,
      reactionSource: null,
      dir: "forward",
    });
    setDraftPendiente(null);
  }, [draftPendiente, owner]);

  const discardDraft = useCallback(() => {
    // "Empezar de cero" = ningún borrador del dueño sobrevive, no solo dos.
    descartarBorradores(owner ?? "");
    offeredKey.current = null;
    draftVersion.current = 0;
    setDraftPendiente(null);
    highWater.current = 0; // reinicia la barra al empezar de cero
    setNav(DEFAULT_NAV);
  }, [owner]);

  // El banner solo vive en la primera pantalla. Si el usuario arranca a llenar
  // sin resolverlo, la oferta se retira sola: dejarla colgada bloquearía la
  // persistencia el resto de la sesión (el efecto de escritura no corre con un
  // draft pendiente). No borra nada — el borrador viejo sigue en storage y se
  // vuelve a ofrecer en el próximo montaje.
  const bannerDraftVisible = mostrarBannerDraft(draftPendiente, nav);
  useEffect(() => {
    if (draftPendiente && !bannerDraftVisible) setDraftPendiente(null);
  }, [draftPendiente, bannerDraftVisible]);

  // Chevron atrás: oculto solo en la primera pantalla (sin historial). El resumen
  // SÍ lleva chevron (semántica = volver al último nodo del historial).
  const canGoBack = nav.history.length > 0;

  // Barra de progreso MONOTÓNICA: nunca retrocede. Al elegir el informe
  // comparativo el denominador crece (contador honesto "9 de 13"), pero si el %
  // bajara en ese instante se clampea al máximo ya alcanzado y avanza desde ahí
  // — no castigar visualmente la opción destacada. El contador (stepCounter) sí
  // dice la verdad; la barra solo avanza. Se reinicia con "empezar de cero".
  const raw = progressFor(nav.current, nav.answers);
  if (raw > highWater.current) highWater.current = raw;
  const progress = highWater.current;

  return {
    nav,
    draftPendiente,
    progress,
    patchAnswers,
    answer,
    goBack,
    goDetour,
    gateNoSwitchToLtr,
    gateNoBack,
    resumeDraft,
    discardDraft,
    bannerDraftVisible,
    canGoBack,
  };
}
