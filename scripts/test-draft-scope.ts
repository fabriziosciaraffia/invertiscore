/**
 * Tests del scope por dueño del borrador del wizard v4.
 *
 * Cubre lo que el navegador no puede probar sin dos cuentas reales: la ADOPCIÓN
 * del borrador de invitado al registrarse (camino de conversión que no se puede
 * romper) y el aislamiento entre dueños.
 *
 *   npx tsx scripts/test-draft-scope.ts
 *
 * Shim de localStorage/sessionStorage en memoria — los módulos bajo test solo
 * tocan storage, nada de red ni DOM.
 */

import assert from "node:assert/strict";

// ── Shim de storage ──────────────────────────────────────────────────────────
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const g = globalThis as unknown as { localStorage: MemStorage; sessionStorage: MemStorage };
g.localStorage = new MemStorage();
g.sessionStorage = new MemStorage();

// Imports estáticos: ninguno de los dos módulos toca storage al evaluarse —
// solo dentro de sus funciones— así que alcanza con que el shim exista antes de
// la primera llamada.
import {
  adoptarDraftInvitado, cleanupOrphans, keyFor, mostRecentDraft, removeDraft, writeDraft,
} from "../src/components/formulario-v4/wizardV4Draft";
import { purgarTodosLosDrafts, purgarDraftsLegacyUnaVez, OWNER_INVITADO } from "../src/lib/draft-keys";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  g.localStorage.clear();
  g.sessionStorage.clear();
  try { fn(); pass++; console.log(`  OK   ${nombre}`); }
  catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}
function seccion(t: string) { console.log(`\n${t}`); }

const A = "usuario-A-uuid";
const B = "usuario-B-uuid";
const TAB1 = "tab-uno";
const TAB2 = "tab-dos";

/** Escribe un draft coherente directo al storage. */
function sembrar(owner: string, tabId: string, precio: string, hace = 0) {
  const d = {
    v: 4, version: 1, savedAt: Date.now() - hace,
    answers: { modalidad: "ltr", precio, direccion: "Suecia 750", comuna: "Providencia" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  };
  g.localStorage.setItem(keyFor(owner, tabId), JSON.stringify(d));
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("1 · Aislamiento entre dueños — el bug que esto cierra");

test("el draft de A NO se le ofrece a B", () => {
  sembrar(A, TAB1, "6.400");
  assert.equal(mostRecentDraft(B), null);
});

test("el draft de A NO se le ofrece a un invitado", () => {
  sembrar(A, TAB1, "6.400");
  assert.equal(mostRecentDraft(OWNER_INVITADO), null);
});

test("cada dueño ve el suyo, aunque coexistan", () => {
  sembrar(A, TAB1, "6.400");
  sembrar(B, TAB2, "9.900");
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "6.400");
  assert.equal(mostRecentDraft(B)?.draft.answers.precio, "9.900");
});

test("con varios drafts propios gana el más reciente", () => {
  sembrar(A, TAB1, "viejo", 60_000);
  sembrar(A, TAB2, "nuevo", 0);
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "nuevo");
});

test("una key de FORMATO VIEJO (sin dueño) no se ofrece a nadie", () => {
  // Es el formato que hoy está en los navegadores de producción.
  g.localStorage.setItem("franco_wizard_v4_draft__TAB-VIEJA", JSON.stringify({
    v: 4, version: 1, savedAt: Date.now(),
    answers: { modalidad: "ltr", precio: "6.400" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  }));
  assert.equal(mostRecentDraft(A), null);
  assert.equal(mostRecentDraft(OWNER_INVITADO), null);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("2 · ADOPCIÓN invitado → registro (el camino de conversión)");

test("al registrarse, el draft guest de ESTA pestaña pasa al usuario", () => {
  sembrar(OWNER_INVITADO, TAB1, "3.300");
  const nueva = adoptarDraftInvitado(TAB1, A);
  assert.equal(nueva, keyFor(A, TAB1));
  // El contenido sobrevive intacto…
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "3.300");
  // …y ya no queda copia a nombre de invitado.
  assert.equal(g.localStorage.getItem(keyFor(OWNER_INVITADO, TAB1)), null);
  assert.equal(mostRecentDraft(OWNER_INVITADO), null);
});

test("NO adopta el draft guest de OTRA pestaña (puede ser de otra persona)", () => {
  sembrar(OWNER_INVITADO, TAB2, "otro-invitado");
  assert.equal(adoptarDraftInvitado(TAB1, A), null);
  // Sigue ahí, a nombre de invitado, sin cambiar de dueño.
  assert.ok(g.localStorage.getItem(keyFor(OWNER_INVITADO, TAB2)));
  assert.equal(mostRecentDraft(A), null);
});

test("sin sesión no adopta nada (owner = guest o vacío)", () => {
  sembrar(OWNER_INVITADO, TAB1, "3.300");
  assert.equal(adoptarDraftInvitado(TAB1, OWNER_INVITADO), null);
  assert.equal(adoptarDraftInvitado(TAB1, ""), null);
  assert.ok(g.localStorage.getItem(keyFor(OWNER_INVITADO, TAB1)), "no debió tocarlo");
});

test("un draft guest vencido no se hereda: se descarta", () => {
  sembrar(OWNER_INVITADO, TAB1, "3.300", 25 * 60 * 60 * 1000); // 25h
  assert.equal(adoptarDraftInvitado(TAB1, A), null);
  assert.equal(g.localStorage.getItem(keyFor(OWNER_INVITADO, TAB1)), null);
  assert.equal(mostRecentDraft(A), null);
});

test("adoptar es idempotente: dos montajes seguidos no duplican", () => {
  sembrar(OWNER_INVITADO, TAB1, "3.300");
  adoptarDraftInvitado(TAB1, A);
  assert.equal(adoptarDraftInvitado(TAB1, A), null);
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "3.300");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("3 · Escritura y borrado con scope");

test("writeDraft escribe en la key del dueño", () => {
  writeDraft(A, TAB1, {
    answers: { modalidad: "ltr", precio: "6.400" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  }, 0);
  assert.ok(g.localStorage.getItem(keyFor(A, TAB1)));
  assert.equal(mostRecentDraft(B), null);
});

test("removeDraft borra la del dueño y la ofrecida", () => {
  sembrar(A, TAB1, "x");
  sembrar(A, TAB2, "y");
  removeDraft(A, TAB1, keyFor(A, TAB2));
  assert.equal(mostRecentDraft(A), null);
});

test("cleanupOrphans retira formato viejo y vencidas, conserva la propia vigente", () => {
  sembrar(A, TAB1, "vigente");
  sembrar(A, TAB2, "vencida", 25 * 60 * 60 * 1000);
  g.localStorage.setItem("franco_wizard_v4_draft__SIN-DUENO", JSON.stringify({ v: 4, savedAt: Date.now() }));
  cleanupOrphans(keyFor(A, TAB1));
  assert.ok(g.localStorage.getItem(keyFor(A, TAB1)), "la vigente propia debe quedar");
  assert.equal(g.localStorage.getItem(keyFor(A, TAB2)), null);
  assert.equal(g.localStorage.getItem("franco_wizard_v4_draft__SIN-DUENO"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("4 · Purga (logout y retroactiva)");

test("purgarTodosLosDrafts barre v4 de todos los dueños + v1/v2/v3 + tabId", () => {
  sembrar(A, TAB1, "x");
  sembrar(B, TAB2, "y");
  sembrar(OWNER_INVITADO, TAB1, "z");
  g.localStorage.setItem("franco_wizard_v4_draft__FORMATO-VIEJO", "{}");
  g.localStorage.setItem("franco_wizard_v3_draft", "{}");
  g.localStorage.setItem("franco_draft_v2", "{}");
  g.localStorage.setItem("franco_form_draft", "{}");
  g.localStorage.setItem("franco_draft_renta_corta", "{}");
  g.sessionStorage.setItem("franco_wizard_v4_tab", TAB1);

  const n = purgarTodosLosDrafts();
  assert.equal(n, 8, `esperaba 8 keys borradas, borró ${n}`);
  assert.equal(g.localStorage.length, 0);
  assert.equal(g.sessionStorage.getItem("franco_wizard_v4_tab"), null, "el tabId también se va");
});

test("purgarTodosLosDrafts NO toca keys ajenas al borrador", () => {
  sembrar(A, TAB1, "x");
  g.localStorage.setItem("franco_utm", "campaña");
  g.localStorage.setItem("franco_pro_cta_dismissed_at", "hoy");
  purgarTodosLosDrafts();
  assert.equal(g.localStorage.getItem("franco_utm"), "campaña");
  assert.equal(g.localStorage.getItem("franco_pro_cta_dismissed_at"), "hoy");
});

test("la purga retroactiva corre UNA vez y deja flag", () => {
  sembrar(A, TAB1, "x");
  g.localStorage.setItem("franco_wizard_v3_draft", "{}");
  const n1 = purgarDraftsLegacyUnaVez();
  assert.ok(n1 >= 2, `esperaba >= 2 borradas, borró ${n1}`);
  assert.ok(g.localStorage.getItem("franco_drafts_purgados_v1"), "debe dejar flag");

  // Segunda corrida: no-op, y un draft nuevo NO se pierde.
  sembrar(A, TAB1, "nuevo-post-purga");
  assert.equal(purgarDraftsLegacyUnaVez(), 0);
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "nuevo-post-purga");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(58)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Scope del borrador: todos los tests pasan.");
