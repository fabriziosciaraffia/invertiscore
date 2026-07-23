"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Persistencia del draft (HALLAZGO-6a)
//
// Draft POR PESTAÑA: cada pestaña tiene un tabId en sessionStorage (per-pestaña,
// sobrevive reload y navegación del round-trip guest→registro en la MISMA
// pestaña) y escribe su propia key en localStorage. Así dos ventanas del
// producto abiertas a la vez NO se pisan (fue corrupción orgánica real, no seed).
//
// Guard de integridad (de la opción c): al cargar se descarta cualquier draft
// incoherente en vez de resumir corrupto; cada escritura lleva versión monotónica.
//
// Banner "análisis sin terminar": apunta al draft más reciente entre todas las
// keys de pestaña. Limpieza TTL de keys huérfanas para no acumular basura.
// ─────────────────────────────────────────────────────────────────────────────

import { ALL_NODES, type NodeId, type WizardV4Answers } from "./wizardV4Nodes";

const PREFIX = "franco_wizard_v4_draft";
const TAB_ID_KEY = "franco_wizard_v4_tab";
const LEGACY_KEY = "franco_wizard_v4_draft"; // draft mono-key previo (se migra/limpia)
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const VERSION = 4;

export interface PersistedDraft {
  v: number;
  version: number; // monotónica por escritura (última gana dentro de la pestaña)
  savedAt: number;
  answers: WizardV4Answers;
  completed: Partial<Record<NodeId, boolean>>;
  current: NodeId;
  history: NodeId[];
  mode: "flow" | "edit" | "reask";
}

/** tabId estable por pestaña (sessionStorage sobrevive reload y navegación same-tab). */
export function getTabId(): string {
  try {
    let id = sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `t_${Math.floor(performance.now())}_${sessionStorage.length}`;
      sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return "no-session";
  }
}

function keyFor(tabId: string): string {
  return `${PREFIX}__${tabId}`;
}

/** ¿El draft tiene forma y estado internamente coherentes? (guard de integridad) */
function isCoherent(d: unknown): d is PersistedDraft {
  if (!d || typeof d !== "object") return false;
  const x = d as Record<string, unknown>;
  if (x.v !== VERSION) return false;
  if (typeof x.savedAt !== "number") return false;
  if (!x.answers || typeof x.answers !== "object") return false;
  if (typeof x.current !== "string" || !ALL_NODES.has(x.current as NodeId)) return false;
  if (!Array.isArray(x.history)) return false;
  if (!x.completed || typeof x.completed !== "object") return false;
  // `mod` es la primera pantalla → cualquier `current` posterior implica modalidad
  // elegida. Un draft con current ≠ "mod" y sin modalidad es incoherente
  // (típico desync de dos pestañas pisándose) → se descarta.
  const modalidad = (x.answers as WizardV4Answers).modalidad;
  if (x.current !== "mod" && !modalidad) return false;
  return true;
}

function readKey(key: string): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isCoherent(parsed)) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function allDraftKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(`${PREFIX}__`) || k === LEGACY_KEY)) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/** Borra keys de draft vencidas (TTL) y la mono-key legacy. No toca las vigentes. */
export function cleanupOrphans(currentKey: string): void {
  try {
    for (const k of allDraftKeys()) {
      if (k === currentKey) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let stale = true;
      try {
        const p = JSON.parse(raw);
        stale = typeof p?.savedAt !== "number" || Date.now() - p.savedAt > TTL_MS;
      } catch {
        stale = true;
      }
      // La mono-key legacy siempre se retira (migración a per-tab).
      if (stale || k === LEGACY_KEY) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** Draft coherente más reciente entre todas las keys (para el banner cross-sesión). */
export function mostRecentDraft(): { key: string; draft: PersistedDraft } | null {
  let best: { key: string; draft: PersistedDraft } | null = null;
  for (const k of allDraftKeys()) {
    const d = readKey(k);
    if (!d) continue;
    if (!best || d.savedAt > best.draft.savedAt) best = { key: k, draft: d };
  }
  return best;
}

export function writeDraft(tabId: string, draft: Omit<PersistedDraft, "v" | "version" | "savedAt">, prevVersion: number): number {
  const version = prevVersion + 1;
  try {
    localStorage.setItem(
      keyFor(tabId),
      JSON.stringify({ ...draft, v: VERSION, version, savedAt: Date.now() }),
    );
  } catch {
    /* quota / privado → ignorar */
  }
  return version;
}

export function removeDraft(tabId: string, extraKey?: string): void {
  try {
    localStorage.removeItem(keyFor(tabId));
    if (extraKey && extraKey !== keyFor(tabId)) localStorage.removeItem(extraKey);
  } catch {
    /* ignore */
  }
}

export { keyFor };
