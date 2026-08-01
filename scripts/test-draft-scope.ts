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
  adoptarDraftInvitado, adoptarEnEstaPestana, cleanupOrphans, descartarBorradores, getTabId,
  keyFor, mostRecentDraft, mostrarBannerDraft, removeDraft, writeDraft,
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
seccion("6 · HIGIENE DEL BANNER — secuencias, no llamadas sueltas");

/**
 * Las tres acciones del banner ("Empezar de cero", "Retomar", mostrarse o no)
 * viven en `wizardV4Draft` justamente para que estos tests llamen al MISMO
 * código que corre en producción. El hook es un llamador de una línea. Si la
 * conducta viviera adentro del hook, acá solo se podría probar una réplica — y
 * una réplica se edita junto al arreglo, así que no prueba nada.
 *
 * Todo lo de abajo es SECUENCIA: montaje → acción → montaje siguiente. El bug
 * de estos tres nunca se ve en una llamada aislada; se ve en lo que sobrevive
 * al recargar.
 */

/** Simula abrir una pestaña NUEVA: el tabId se acuña de cero en el próximo montaje. */
function nuevaPestana(): void {
  g.sessionStorage.removeItem("franco_wizard_v4_tab");
}

/**
 * Navegador de usuario RECURRENTE: la purga retroactiva ya corrió alguna vez.
 * Va SIEMPRE antes de `sembrar`, si no el primer `montarWizard` se lleva las
 * semillas (la purga barre todo borrador v4 la primera vez, por diseño).
 */
function purgaYaCorrida(): void {
  g.localStorage.setItem("franco_drafts_purgados_v1", "ya");
}

/** Todas las keys de borrador v4 de un dueño, tal como quedaron en el storage. */
function keysDe(owner: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < g.localStorage.length; i++) {
    const k = g.localStorage.key(i);
    if (k && k.startsWith(`franco_wizard_v4_draft__${owner}__`)) out.push(k);
  }
  return out;
}

test("con DOS borradores, 'Empezar de cero' no deja ninguno vivo al recargar", () => {
  purgaYaCorrida();
  // Dos pestañas del mismo usuario dejaron borrador. Una tercera monta y recibe
  // la oferta del más reciente — la otra queda huérfana pero sigue ahí.
  sembrar(A, TAB1, "el-huerfano", 60_000);
  sembrar(A, TAB2, "el-ofrecido", 0);
  sembrar(B, TAB1, "de-otro-usuario"); // testigo del scope

  const m1 = montarWizard(A);
  assert.equal(m1.draft, keyFor(A, TAB2), "debía ofrecerse el más reciente");

  // Click en "Empezar de cero".
  descartarBorradores(A);

  // Recarga: no puede quedar NADA que ofrecer.
  const m2 = montarWizard(A);
  assert.equal(m2.draft, null, "un borrador sobrevivió al descarte y revivió al recargar");
  assert.equal(keysDe(A).length, 0, `quedaron keys de A: ${keysDe(A).join(", ")}`);

  // Y el descarte NO se pasó de scope: el borrador de B sigue intacto.
  assert.equal(mostRecentDraft(B)?.draft.answers.precio, "de-otro-usuario");
});

test("con TRES borradores tampoco: 'Empezar de cero' es de cero", () => {
  purgaYaCorrida();
  sembrar(A, TAB1, "uno", 60_000);
  sembrar(A, TAB2, "dos", 30_000);
  sembrar(A, "tab-tres", "tres", 0);
  montarWizard(A);
  descartarBorradores(A);
  assert.equal(keysDe(A).length, 0, `quedaron keys de A: ${keysDe(A).join(", ")}`);
  assert.equal(montarWizard(A).draft, null);
});

test("'Retomar' tres veces seguidas deja UNA key, no cuatro", () => {
  // Pestaña original: llena el wizard y deja su borrador.
  const m0 = montarWizard(A);
  writeDraft(A, m0.tabId, {
    answers: { modalidad: "ltr", precio: "5.500", direccion: "Suecia 750" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);

  // Tres pestañas nuevas lo retoman, una tras otra. Cada vuelta: montaje →
  // click en "Retomar" → persistencia debounced en la key de ESA pestaña.
  for (let vuelta = 1; vuelta <= 3; vuelta++) {
    nuevaPestana();
    const m = montarWizard(A);
    assert.ok(m.draft, `la vuelta ${vuelta} no recibió oferta de borrador`);
    adoptarEnEstaPestana(A, m.tabId, m.draft);
    writeDraft(A, m.tabId, {
      answers: { modalidad: "ltr", precio: "5.500", direccion: "Suecia 750" },
      completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
    } as never, vuelta);
  }

  const keys = keysDe(A);
  assert.equal(keys.length, 1, `cada 'Retomar' agregó una key: quedaron ${keys.length}`);
  // Y el borrador que quedó es el bueno, no una cáscara.
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "5.500");
});

test("'Retomar' no deja una ventana con CERO borradores", () => {
  // Guarda contra sobre-corregir el fix (lo cazó el paseo por el navegador):
  // si "Retomar" BORRA la de origen en vez de moverla, entre el click y la
  // escritura debounced (500ms) no existe ningún borrador — una recarga ahí
  // adentro se lleva el trabajo. Acá se mira JUSTO después de adoptar, sin
  // ningún writeDraft en el medio.
  const m0 = montarWizard(A);
  writeDraft(A, m0.tabId, {
    answers: { modalidad: "ltr", precio: "7.700", direccion: "Suecia 750" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);

  nuevaPestana();
  const m1 = montarWizard(A);
  adoptarEnEstaPestana(A, m1.tabId, m1.draft);

  const vivo = mostRecentDraft(A);
  assert.ok(vivo, "quedó una ventana sin ningún borrador: una recarga ahí lo pierde");
  assert.equal(vivo.key, keyFor(A, m1.tabId), "debe quedar en la key de esta pestaña");
  assert.equal(vivo.draft.answers.precio, "7.700", "el contenido no sobrevivió la mudanza");
  assert.equal(keysDe(A).length, 1, "movió pero dejó la de origen");
});

test("'Retomar' en la MISMA pestaña (reload) no se borra a sí mismo", () => {
  // La key ofrecida y la propia son la misma: no hay nada que mover, y sobre
  // todo no hay que borrarla.
  const m0 = montarWizard(A);
  writeDraft(A, m0.tabId, {
    answers: { modalidad: "str", precio: "3.300" },
    completed: { mod: true }, current: "pie", history: ["mod"], mode: "flow",
  } as never, 0);

  const m1 = montarWizard(A); // recarga, mismo tabId
  assert.equal(m1.draft, keyFor(A, m0.tabId));
  adoptarEnEstaPestana(A, m1.tabId, m1.draft);
  assert.equal(mostRecentDraft(A)?.draft.answers.precio, "3.300", "se borró el propio borrador");
});

test("el banner se ofrece en la pantalla 1 y NO en la 2", () => {
  purgaYaCorrida();
  sembrar(A, TAB1, "6.400");
  const m = montarWizard(A);
  assert.ok(m.draft, "el montaje debía ofrecer el borrador");
  const ofrecido = mostRecentDraft(A)!.draft;

  // Pantalla 1: recién montado, sin historial.
  assert.equal(
    mostrarBannerDraft(ofrecido, { current: "mod", history: [] }),
    true,
    "el banner tiene que aparecer en la primera pantalla",
  );

  // Pantalla 2: el usuario ya eligió informe y avanzó.
  assert.equal(
    mostrarBannerDraft(ofrecido, { current: "dir", history: ["mod"] }),
    false,
    "el banner se está renderizando fuera de la primera pantalla",
  );

  // Y en una pantalla profunda tampoco.
  assert.equal(
    mostrarBannerDraft(ofrecido, { current: "pie", history: ["mod", "dir", "tipo", "precio"] }),
    false,
    "el banner sobrevive hasta el fondo del wizard",
  );

  // Sin borrador pendiente no hay banner ni en la primera.
  assert.equal(mostrarBannerDraft(null, { current: "mod", history: [] }), false);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(58)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Scope del borrador: todos los tests pasan.");
