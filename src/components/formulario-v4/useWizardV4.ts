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
  BRANCH_ACTO3,
  computeNext,
  isBranchNode,
  progressFor,
  reactionText,
  type NodeId,
  type WizardV4Answers,
} from "./wizardV4Nodes";

const DRAFT_KEY = "franco_wizard_v4_draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h, mismo criterio que v3
const DRAFT_VERSION = 4;

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

interface PersistedDraft {
  v: number;
  savedAt: number;
  answers: WizardV4Answers;
  completed: Partial<Record<NodeId, boolean>>;
  current: NodeId;
  history: NodeId[];
  mode: Mode;
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

/** Valor previo del campo de rama de `node` (para detectar cambio en edición). */
function branchPrevValue(node: NodeId, a: WizardV4Answers): unknown {
  if (node === "mod") return a.modalidad;
  if (node === "tipo") return a.tipoPropiedad;
  if (node === "gate") return a.edificioPermiteAirbnb;
  return undefined;
}

function branchChanged(node: NodeId, prev: unknown, a: WizardV4Answers): boolean {
  if (node === "mod") return prev !== a.modalidad;
  if (node === "tipo") return prev !== a.tipoPropiedad;
  if (node === "gate") return prev !== a.edificioPermiteAirbnb;
  return false;
}

/**
 * Invalida las respuestas aguas abajo tras editar un nodo de rama. Cambiar
 * modalidad borra toda la rama del Acto 3; cambiar tipo borra el ent/ant que ya
 * no aplica; poner gate="no" borra el adr (nace muerto → salida gateNo).
 */
function clearDownstream(
  node: NodeId,
  a: WizardV4Answers,
  completed: Partial<Record<NodeId, boolean>>,
): { answers: WizardV4Answers; completed: Partial<Record<NodeId, boolean>> } {
  if (node === "mod") {
    const answers: WizardV4Answers = {
      ...a,
      edificioPermiteAirbnb: undefined,
      arrModo: undefined,
      adrModo: undefined,
    };
    const c = { ...completed };
    for (const n of BRANCH_ACTO3) delete c[n];
    return { answers, completed: c };
  }
  if (node === "tipo") {
    const c = { ...completed };
    if (a.tipoPropiedad === "nuevo") delete c["ant"];
    else delete c["ent"];
    return { answers: a, completed: c };
  }
  if (node === "gate" && a.edificioPermiteAirbnb === "no") {
    const c = { ...completed };
    delete c["adr"];
    delete c["adrFix"];
    return { answers: { ...a, adrModo: undefined }, completed: c };
  }
  return { answers: a, completed };
}

/** Primer nodo aún no completado siguiendo el flujo desde `node`, o "resumen". */
function firstUncompletedAfter(
  node: NodeId,
  a: WizardV4Answers,
  completed: Partial<Record<NodeId, boolean>>,
): NodeId {
  let n = computeNext(node, a);
  const guard = new Set<NodeId>();
  while (n && n !== "resumen" && !guard.has(n)) {
    guard.add(n);
    if (!completed[n]) return n;
    n = computeNext(n, a);
  }
  return "resumen";
}

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
  /** Abre una pantalla en modo edición desde el resumen (retorno directo). */
  editField: (node: NodeId) => void;
  /** gateNo: cambia a renta larga e invalida la rama STR. */
  gateNoSwitchToLtr: () => void;
  /** gateNo: "me equivoqué, volver" → regresa al gate. */
  gateNoBack: () => void;
  /** Retoma el draft ofrecido. */
  resumeDraft: () => void;
  /** Descarta el draft ofrecido y arranca limpio. */
  discardDraft: () => void;
  /** ¿Se puede mostrar el chevron atrás? (oculto en primera pantalla y en edición). */
  canGoBack: boolean;
}

export function useWizardV4({ resume }: { resume: boolean }): UseWizardV4 {
  const [nav, setNav] = useState<WizardV4Nav>(DEFAULT_NAV);
  const [draftPendiente, setDraftPendiente] = useState<PersistedDraft | null>(null);
  const mounted = useRef(false);
  // Máximo de progreso alcanzado — la barra es monotónica (ver más abajo).
  const highWater = useRef(0);

  // ── Mount: cargar draft. ?resume=1 (vuelta post-registro) rehidrata directo
  //    al resumen; si no, se ofrece vía banner y el form arranca limpio. ──
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedDraft;
      if (parsed.v !== DRAFT_VERSION) return;
      if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (resume) {
        // Retomar y aterrizar en el resumen (el guest completó el wizard antes
        // de registrarse; vuelve a pagar/generar).
        setNav({
          current: "resumen",
          history: parsed.history ?? [],
          answers: parsed.answers ?? {},
          completed: parsed.completed ?? {},
          mode: "flow",
          editContext: null,
          reactionSource: null,
          dir: "forward",
        });
      } else {
        setDraftPendiente(parsed);
      }
    } catch {
      /* draft corrupto → ignorar */
    }
  }, [resume]);

  // ── Persistencia debounced (500ms). No persiste mientras hay un draft
  //    pendiente sin resolver (evita pisar el guardado con el form limpio). ──
  useEffect(() => {
    if (draftPendiente) return;
    const t = setTimeout(() => {
      try {
        // Solo vale la pena guardar si el usuario avanzó algo.
        if (nav.current === "dir" && nav.history.length === 0 && Object.keys(nav.answers).length === 0) {
          return;
        }
        const draft: PersistedDraft = {
          v: DRAFT_VERSION,
          savedAt: Date.now(),
          answers: nav.answers,
          completed: nav.completed,
          current: nav.current,
          history: nav.history,
          mode: nav.mode === "edit" ? "flow" : nav.mode,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* quota / privado → ignorar */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nav, draftPendiente]);

  const patchAnswers = useCallback((patch: Partial<WizardV4Answers>) => {
    setNav((s) => ({ ...s, answers: { ...s.answers, ...patch } }));
  }, []);

  const answer = useCallback((node: NodeId, patch?: Partial<WizardV4Answers>) => {
    setNav((s) => {
      const answers: WizardV4Answers = { ...s.answers, ...patch };
      const completed = { ...s.completed, [node]: true };
      const hasReaction = reactionText(node, answers) !== null;

      // ── Modo edición: retorno directo al resumen, salvo que cambie una rama ──
      if (s.mode === "edit") {
        if (
          isBranchNode(node) &&
          s.editContext &&
          branchChanged(node, s.editContext.prev, answers)
        ) {
          const cleared = clearDownstream(node, answers, completed);
          const start = firstUncompletedAfter(node, cleared.answers, cleared.completed);
          if (start !== "resumen") {
            return {
              ...s,
              answers: cleared.answers,
              completed: cleared.completed,
              mode: "reask",
              editContext: null,
              current: start,
              history: [],
              reactionSource: null,
              dir: "forward",
            };
          }
          return {
            ...s,
            answers: cleared.answers,
            completed: cleared.completed,
            mode: "flow",
            editContext: null,
            current: "resumen",
            history: [],
            reactionSource: null,
            dir: "forward",
          };
        }
        // Edición normal de un campo → vuelve al resumen.
        return {
          ...s,
          answers,
          completed,
          mode: "flow",
          editContext: null,
          current: "resumen",
          history: [],
          reactionSource: null,
          dir: "forward",
        };
      }

      // ── Modo reask: recorre la rama nueva; salta lo ya completado; termina en resumen ──
      if (s.mode === "reask") {
        let next = computeNext(node, answers) ?? "resumen";
        const guard = new Set<NodeId>();
        while (next !== "resumen" && completed[next] && !guard.has(next)) {
          guard.add(next);
          next = computeNext(next, answers) ?? "resumen";
        }
        return {
          ...s,
          answers,
          completed,
          history: [...s.history, s.current],
          current: next,
          mode: next === "resumen" ? "flow" : "reask",
          reactionSource: hasReaction ? node : null,
          dir: "forward",
        };
      }

      // ── Modo flow: siguiente según el grafo ──
      const next = computeNext(node, answers) ?? "resumen";
      return {
        ...s,
        answers,
        completed,
        history: [...s.history, s.current],
        current: next,
        mode: "flow",
        reactionSource: hasReaction ? node : null,
        dir: "forward",
      };
    });
  }, []);

  const goBack = useCallback(() => {
    setNav((s) => {
      if (s.mode === "edit" || s.history.length === 0) return s;
      const history = s.history.slice(0, -1);
      const current = s.history[s.history.length - 1];
      return { ...s, current, history, dir: "back", reactionSource: null };
    });
  }, []);

  const goDetour = useCallback((fix: NodeId, patch?: Partial<WizardV4Answers>) => {
    setNav((s) => ({
      ...s,
      answers: patch ? { ...s.answers, ...patch } : s.answers,
      history: [...s.history, s.current],
      current: fix,
      reactionSource: null,
      dir: "forward",
    }));
  }, []);

  const editField = useCallback((node: NodeId) => {
    setNav((s) => ({
      ...s,
      mode: "edit",
      editContext: { node, prev: branchPrevValue(node, s.answers) },
      current: node,
      history: [],
      reactionSource: null,
      dir: "forward",
    }));
  }, []);

  const gateNoSwitchToLtr = useCallback(() => {
    setNav((s) => {
      const answers: WizardV4Answers = {
        ...s.answers,
        modalidad: "ltr",
        edificioPermiteAirbnb: undefined,
        adrModo: undefined,
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
        mode: current === "resumen" ? "flow" : s.mode === "reask" ? "reask" : "flow",
        reactionSource: null,
        dir: "forward",
      };
    });
  }, []);

  const gateNoBack = useCallback(() => {
    goBack();
  }, [goBack]);

  const resumeDraft = useCallback(() => {
    setDraftPendiente((d) => {
      if (d) {
        setNav({
          current: d.current ?? "dir",
          history: d.history ?? [],
          answers: d.answers ?? {},
          completed: d.completed ?? {},
          mode: "flow",
          editContext: null,
          reactionSource: null,
          dir: "forward",
        });
      }
      return null;
    });
  }, []);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftPendiente(null);
    highWater.current = 0; // reinicia la barra al empezar de cero
    setNav(DEFAULT_NAV);
  }, []);

  // Chevron atrás: oculto en primera pantalla (sin historial), en modo edición y
  // en el resumen (su único mecanismo de edición son los lápices; un "atrás"
  // genérico ahí es ambiguo tras un reask).
  const canGoBack =
    nav.mode !== "edit" && nav.current !== "resumen" && nav.history.length > 0;

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
    editField,
    gateNoSwitchToLtr,
    gateNoBack,
    resumeDraft,
    discardDraft,
    canGoBack,
  };
}
