"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Persistencia del draft
//
// Key: `franco_wizard_v4_draft__<owner>__<tabId>`.
//
//   owner — `user.id` con sesión, o `guest` sin ella. Es el SCOPE: un draft
//           solo se lee para su propio dueño. Antes la key era
//           `…__<tabId>` y `mostRecentDraft()` escaneaba TODAS las keys sin
//           mirar quién las escribió, así que en un equipo compartido el
//           usuario B —o incluso un invitado— veía el borrador de A con su
//           dirección, precio, pie, tasa y arriendo.
//   tabId — por pestaña (sessionStorage, sobrevive reload y el round-trip
//           guest→registro en la MISMA pestaña). Evita que dos ventanas del
//           producto se pisen; fue corrupción orgánica real, no seed.
//
// El único cruce de scope permitido es la ADOPCIÓN: al volver del registro, el
// draft `guest` de ESTA pestaña pasa a nombre del usuario recién logueado. Es
// un camino de conversión real —el invitado llena el wizard, se registra y
// vuelve con ?resume=1— y romperlo le costaría el trabajo justo en el momento
// de mayor intención. Solo se adopta el de esta pestaña: nunca el de otra.
//
// Guard de integridad: al cargar se descarta cualquier draft incoherente en vez
// de resumir corrupto; cada escritura lleva versión monotónica. Limpieza TTL de
// keys huérfanas para no acumular basura.
// ─────────────────────────────────────────────────────────────────────────────

import { OWNER_INVITADO, V4_DRAFT_PREFIX, V4_TAB_KEY } from "@/lib/draft-keys";
import { ALL_NODES, type NodeId, type WizardV4Answers } from "./wizardV4Nodes";

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
    let id = sessionStorage.getItem(V4_TAB_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `t_${Math.floor(performance.now())}_${sessionStorage.length}`;
      sessionStorage.setItem(V4_TAB_KEY, id);
    }
    return id;
  } catch {
    return "no-session";
  }
}

function keyFor(owner: string, tabId: string): string {
  return `${V4_DRAFT_PREFIX}__${owner}__${tabId}`;
}

/**
 * Dueño y pestaña de una key. `null` para el formato viejo (`…__<tabId>`, sin
 * dueño): esas keys no se pueden atribuir a nadie, así que NUNCA se ofrecen —
 * la purga retroactiva las borra en el primer montaje.
 */
function parseKey(key: string): { owner: string; tabId: string } | null {
  if (!key.startsWith(`${V4_DRAFT_PREFIX}__`)) return null;
  const partes = key.slice(V4_DRAFT_PREFIX.length + 2).split("__");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  return { owner: partes[0], tabId: partes[1] };
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

/** Keys de draft v4 presentes, con su dueño resuelto. Excluye las de formato viejo. */
function keysConDueno(): Array<{ key: string; owner: string; tabId: string }> {
  const out: Array<{ key: string; owner: string; tabId: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const p = parseKey(k);
      if (p) out.push({ key: k, ...p });
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Borra keys de draft vencidas (TTL) y las de formato viejo. No toca las vigentes. */
export function cleanupOrphans(currentKey: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${V4_DRAFT_PREFIX}__`) || k === currentKey) continue;
      // Formato viejo (sin dueño): no se puede atribuir → se retira siempre.
      if (!parseKey(k)) {
        localStorage.removeItem(k);
        continue;
      }
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let stale = true;
      try {
        const p = JSON.parse(raw);
        stale = typeof p?.savedAt !== "number" || Date.now() - p.savedAt > TTL_MS;
      } catch {
        stale = true;
      }
      if (stale) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Draft coherente más reciente DEL DUEÑO indicado. El scope es el fix: sin el
 * filtro por owner esto devolvía el borrador de cualquiera.
 */
export function mostRecentDraft(owner: string): { key: string; draft: PersistedDraft } | null {
  let best: { key: string; draft: PersistedDraft } | null = null;
  for (const { key, owner: dueno } of keysConDueno()) {
    if (dueno !== owner) continue;
    const d = readKey(key);
    if (!d) continue;
    if (!best || d.savedAt > best.draft.savedAt) best = { key, draft: d };
  }
  return best;
}

/**
 * ADOPCIÓN — el round-trip invitado → registro.
 *
 * Al volver del registro (misma pestaña, mismo tabId), el draft que se escribió
 * como `guest` pasa a nombre del usuario. Es el ÚNICO cruce de scope permitido,
 * y está acotado a esta pestaña: el borrador `guest` de otra pestaña —que puede
 * ser de otra persona— nunca se toca.
 *
 * Devuelve la key nueva si adoptó algo.
 */
export function adoptarDraftInvitado(tabId: string, owner: string): string | null {
  if (!owner || owner === OWNER_INVITADO) return null;
  try {
    const keyInvitado = keyFor(OWNER_INVITADO, tabId);
    const raw = localStorage.getItem(keyInvitado);
    if (!raw) return null;
    const draft = readKey(keyInvitado);
    if (!draft) {
      localStorage.removeItem(keyInvitado); // incoherente o vencido: no se hereda
      return null;
    }
    const keyPropia = keyFor(owner, tabId);
    localStorage.setItem(keyPropia, raw);
    localStorage.removeItem(keyInvitado);
    return keyPropia;
  } catch {
    return null;
  }
}

export function writeDraft(
  owner: string,
  tabId: string,
  draft: Omit<PersistedDraft, "v" | "version" | "savedAt">,
  prevVersion: number,
): number {
  const version = prevVersion + 1;
  try {
    localStorage.setItem(
      keyFor(owner, tabId),
      JSON.stringify({ ...draft, v: VERSION, version, savedAt: Date.now() }),
    );
  } catch {
    /* quota / privado → ignorar */
  }
  return version;
}

export function removeDraft(owner: string, tabId: string, extraKey?: string): void {
  try {
    const propia = keyFor(owner, tabId);
    localStorage.removeItem(propia);
    if (extraKey && extraKey !== propia) localStorage.removeItem(extraKey);
  } catch {
    /* ignore */
  }
}

export { keyFor };
