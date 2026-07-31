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
const g = globalThis as unknown as {
  localStorage: MemStorage;
  sessionStorage: MemStorage;
  crypto: { randomUUID: () => string };
};
g.localStorage = new MemStorage();
g.sessionStorage = new MemStorage();
// `getTabId` acuña con crypto.randomUUID; ids incrementales para que el test
// pueda afirmar "es el mismo" / "es distinto" sin ambigüedad.
let seqTab = 0;
g.crypto = { randomUUID: () => `TAB-${++seqTab}` };

// Imports estáticos: ninguno de los dos módulos toca storage al evaluarse —
// solo dentro de sus funciones— así que alcanza con que el shim exista antes de
// la primera llamada.
import {
  adoptarDraftInvitado, cleanupOrphans, getTabId, keyFor, mostRecentDraft, removeDraft, writeDraft,
} from "../src/components/formulario-v4/wizardV4Draft";
import { purgarBorradores, purgarBorradoresYPestana, purgarDraftsLegacyUnaVez, OWNER_INVITADO } from "../src/lib/draft-keys";

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

test("purgarBorradoresYPestana barre v4 de todos los dueños + v1/v2/v3 + tabId", () => {
  sembrar(A, TAB1, "x");
  sembrar(B, TAB2, "y");
  sembrar(OWNER_INVITADO, TAB1, "z");
  g.localStorage.setItem("franco_wizard_v4_draft__FORMATO-VIEJO", "{}");
  g.localStorage.setItem("franco_wizard_v3_draft", "{}");
  g.localStorage.setItem("franco_draft_v2", "{}");
  g.localStorage.setItem("franco_form_draft", "{}");
  g.localStorage.setItem("franco_draft_renta_corta", "{}");
  g.sessionStorage.setItem("franco_wizard_v4_tab", TAB1);

  const n = purgarBorradoresYPestana();
  assert.equal(n, 8, `esperaba 8 keys borradas, borró ${n}`);
  assert.equal(g.localStorage.length, 0);
  assert.equal(g.sessionStorage.getItem("franco_wizard_v4_tab"), null, "el tabId también se va");
});

test("purgarBorradores NO toca keys ajenas al borrador", () => {
  sembrar(A, TAB1, "x");
  g.localStorage.setItem("franco_utm", "campaña");
  g.localStorage.setItem("franco_pro_cta_dismissed_at", "hoy");
  purgarBorradores();
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
seccion("5 · SECUENCIA REAL — el montaje completo, no las piezas sueltas");

/**
 * Este es el test que faltaba, y el que más vale.
 *
 * Los 16 de arriba probaban `adoptarDraftInvitado` en aislamiento, con el tabId
 * correcto puesto a mano — y pasaban mientras el round-trip estaba roto en
 * producción. La regresión no vivía en ninguna pieza sino en el ORDEN: la purga
 * de arranque borraba el `tabId` de sessionStorage justo después de acuñarlo,
 * así que al volver del login se acuñaba otro y la adopción buscaba en una key
 * que no existía.
 *
 * Por eso acá se replica el efecto de montaje entero, dos veces, con el cambio
 * de dueño en el medio. Si alguna pieza vuelve a romper la cadena, este cae.
 */

/** Replica el efecto de montaje de `useWizardV4` en el orden real. */
function montarWizard(owner: string): { tabId: string; draft: string | null } {
  purgarDraftsLegacyUnaVez();          // idempotente por flag
  const tabId = getTabId();
  adoptarDraftInvitado(tabId, owner);
  cleanupOrphans(keyFor(owner, tabId));
  const candidato = mostRecentDraft(owner);
  return { tabId, draft: candidato ? candidato.key : null };
}

test("invitado -> registro -> login: el borrador sobrevive el cambio de dueño", () => {
  // 1. Navegador virgen. El invitado abre el wizard: acá corre la purga retroactiva.
  const m1 = montarWizard(OWNER_INVITADO);
  assert.equal(m1.draft, null, "arranca sin borrador");

  // 2. Llena el wizard. Se persiste con el tabId de ESTA pestaña.
  writeDraft(OWNER_INVITADO, m1.tabId, {
    answers: { modalidad: "ltr", precio: "5.500", direccion: "Suecia 750" },
    completed: { mod: true }, current: "resumen", history: ["mod"], mode: "flow",
  } as never, 0);

  // 3. El tabId TIENE que seguir en sessionStorage: es lo único que conecta al
  //    invitado con el usuario que va a volver del login en esta misma pestaña.
  assert.equal(
    g.sessionStorage.getItem("franco_wizard_v4_tab"),
    m1.tabId,
    "la purga se llevó el tabId — la adopción va a buscar en la key equivocada",
  );

  // 4. Vuelve del login con sesión. Mismo tab, otro dueño.
  const m2 = montarWizard(A);
  assert.equal(m2.tabId, m1.tabId, "el tabId cambió entre montajes");
  assert.equal(m2.draft, keyFor(A, m1.tabId), "el borrador NO se adoptó");

  // 5. Y el contenido llegó entero, no una cáscara.
  const adoptado = mostRecentDraft(A);
  assert.equal(adoptado?.draft.answers.precio, "5.500");
  assert.equal(adoptado?.draft.current, "resumen");

  // 6. No quedó copia a nombre de invitado.
  assert.equal(mostRecentDraft(OWNER_INVITADO), null);
});

test("el mismo camino con la purga YA corrida (segundo navegador-sesión)", () => {
  // El flag ya puesto es el caso del usuario recurrente: la purga es no-op y la
  // adopción tiene que funcionar igual.
  g.localStorage.setItem("franco_drafts_purgados_v1", "ya");
  const m1 = montarWizard(OWNER_INVITADO);
  writeDraft(OWNER_INVITADO, m1.tabId, {
    answers: { modalidad: "str", precio: "3.300" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);
  const m2 = montarWizard(B);
  assert.equal(m2.draft, keyFor(B, m1.tabId));
  assert.equal(mostRecentDraft(B)?.draft.answers.precio, "3.300");
});

test("el invitado que NO se registra sigue viendo lo suyo al volver", () => {
  const m1 = montarWizard(OWNER_INVITADO);
  writeDraft(OWNER_INVITADO, m1.tabId, {
    answers: { modalidad: "ltr", precio: "4.400" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);
  const m2 = montarWizard(OWNER_INVITADO);
  assert.equal(m2.draft, keyFor(OWNER_INVITADO, m1.tabId));
  assert.equal(mostRecentDraft(OWNER_INVITADO)?.draft.answers.precio, "4.400");
});

test("el logout SÍ corta el hilo de la pestaña", () => {
  // La otra mitad de la separación: en el logout el tabId debe irse, para que la
  // próxima sesión no herede el scope de pestaña de la anterior.
  const m1 = montarWizard(A);
  writeDraft(A, m1.tabId, {
    answers: { modalidad: "ltr", precio: "9.900" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);
  purgarBorradoresYPestana();
  assert.equal(g.sessionStorage.getItem("franco_wizard_v4_tab"), null);
  assert.equal(mostRecentDraft(A), null);
  // Y el siguiente montaje acuña un tabId distinto.
  const m2 = montarWizard(A);
  assert.notEqual(m2.tabId, m1.tabId);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(58)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Scope del borrador: todos los tests pasan.");
