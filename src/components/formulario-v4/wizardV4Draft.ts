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
// v5 — migración a `NumericInput`. Los borradores escritos por los filtros
// viejos guardan valores que ya no se pueden interpretar: un "75" de comisión
// puede ser un 75% legítimo o el "7,5" al que `pctInt` le comió la coma, y no
// hay forma de distinguirlos. `isCoherent` descarta todo draft con otro `v`, así
// que subir el número los invalida a todos de una. El radio está acotado por el
// TTL: solo alcanza a los de menos de 24h.
// v6 — la modalidad se mudó al final del wizard (19-ago-2026). El invariante de
// coherencia se dio vuelta: antes "current ≠ mod ⇒ hay modalidad", ahora es al
// revés. Un borrador escrito por la versión anterior tiene la modalidad elegida
// en el paso 1 y un `current` que ya no significa lo mismo en el grafo nuevo, así
// que no se puede migrar: subir el número los invalida a todos de una. El radio
// está acotado por el TTL — solo alcanza a los de menos de 24h.
const VERSION = 6;

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
  // `mod` es ahora la ÚLTIMA pregunta (después de `plazo`) → un draft que ya
  // pasó de ese punto tiene que traer la modalidad elegida, y ninguno anterior
  // puede traerla. Las dos mitades son el mismo desync de dos pestañas
  // pisándose que cazaba el invariante viejo, leído en el grafo nuevo.
  const modalidad = (x.answers as WizardV4Answers).modalidad;
  const yaPasoLaModalidad = x.current !== "mod" && x.completed && (x.completed as Record<string, boolean>).mod === true;
  if (yaPasoLaModalidad && !modalidad) return false;
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

// ─────────────────────────────────────────────────────────────────────────────
// CONDUCTA DEL BANNER "análisis sin terminar"
//
// Las tres funciones de abajo son la conducta de las dos acciones del banner y
// de su visibilidad. Viven acá y no dentro del hook a propósito: el hook es un
// componente React y no se puede montar en el script de tests, así que si la
// lógica vive adentro solo se puede probar una RÉPLICA — y una réplica que se
// edita junto al arreglo no prueba nada (fue exactamente lo que dejó pasar la
// regresión del tabId). El hook es un llamador de una línea; el test llama al
// mismo código que corre en producción.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Corresponde mostrar el banner de retomar?
 *
 * Solo en la PRIMERA pantalla. El banner vive en el layout del `<main>`, fuera
 * del router de pantallas, así que sin esta condición se renderiza en las 12
 * pantallas del wizard — ofreciendo "retomar" a alguien que ya va por el pie.
 */
export function mostrarBannerDraft(
  draftPendiente: PersistedDraft | null,
  nav: { current: NodeId; history: NodeId[] },
): boolean {
  if (!draftPendiente) return false;
  return nav.current === "dir" && nav.history.length === 0;
}

/**
 * "Empezar de cero" — borra TODOS los borradores del dueño actual.
 *
 * No alcanza con borrar la de esta pestaña y la ofrecida: con tres o más keys
 * las huérfanas sobreviven al descarte y reviven en el próximo montaje, porque
 * `mostRecentDraft` escanea todas las del dueño. "Empezar de cero" tiene que
 * significar exactamente eso.
 *
 * El scope por dueño sigue intacto: nunca toca keys de otro usuario.
 */
export function descartarBorradores(owner: string): number {
  if (!owner) return 0;
  let n = 0;
  try {
    for (const { key, owner: dueno } of keysConDueno()) {
      if (dueno !== owner) continue;
      localStorage.removeItem(key);
      n++;
    }
  } catch {
    /* ignore */
  }
  return n;
}

/**
 * "Retomar" — esta pestaña pasa a ser la dueña del borrador ofrecido.
 *
 * El borrador puede venir de OTRA pestaña (`mostRecentDraft` cruza pestañas
 * dentro del mismo dueño). Al retomarlo, esta pestaña empieza a escribir en su
 * propia key; si la de origen queda viva, cada "Retomar" agrega una key más —
 * es el motor de la acumulación.
 *
 * MUEVE, no borra — igual que `adoptarDraftInvitado`. Borrar la de origen y
 * esperar a que la persistencia debounced (500ms) escriba la nueva deja una
 * ventana con CERO borradores: una recarga ahí adentro se lleva el trabajo.
 * Copiar primero y borrar después hace que el borrador exista siempre en alguna
 * key; la escritura debounced después solo lo pisa con lo mismo o más.
 *
 * No hace nada si la ofrecida ya ES la de esta pestaña (reload, o adopción
 * invitado→registro): ahí no hay nada que mover.
 */
export function adoptarEnEstaPestana(
  owner: string,
  tabId: string,
  offeredKey: string | null,
): void {
  if (!owner || !offeredKey) return;
  const propia = keyFor(owner, tabId);
  if (offeredKey === propia) return;
  try {
    const raw = localStorage.getItem(offeredKey);
    if (raw !== null) localStorage.setItem(propia, raw);
    localStorage.removeItem(offeredKey);
  } catch {
    /* ignore */
  }
}

export { keyFor };
