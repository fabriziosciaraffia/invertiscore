/**
 * Tests de la preservación de la intención de destino entre pantallas de auth.
 *
 *   npx tsx scripts/test-auth-next.ts
 *
 * Cubre el bug del round-trip (el invitado que llena el wizard, salta a login y
 * termina en /dashboard) y el guard de open redirect, que es la parte con
 * consecuencias de seguridad.
 */

import assert from "node:assert/strict";
import { conNext, esDestinoSeguro, hrefAuth, queryDeIntencion } from "../src/lib/auth-next";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try { fn(); pass++; console.log(`  OK   ${nombre}`); }
  catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}
function seccion(t: string) { console.log(`\n${t}`); }

// El search tal como lo deja el CTA del resumen del wizard.
const SEARCH_WIZARD = "?next=%2Fanalisis%2Fnuevo-v4%3Fresume%3D1";

// ─────────────────────────────────────────────────────────────────────────────
seccion("1 · El round-trip del wizard (el bug reportado)");

test("register -> login conserva el next del wizard", () => {
  const href = hrefAuth("/login", SEARCH_WIZARD);
  assert.equal(href, "/login?next=%2Fanalisis%2Fnuevo-v4%3Fresume%3D1");
  // Y al leerlo del otro lado vuelve el path completo, con su ?resume=1.
  const next = new URLSearchParams(new URL("https://x" + href).search).get("next");
  assert.equal(next, "/analisis/nuevo-v4?resume=1");
});

test("login -> register conserva el next (el salto simétrico)", () => {
  assert.equal(
    hrefAuth("/register", SEARCH_WIZARD),
    "/register?next=%2Fanalisis%2Fnuevo-v4%3Fresume%3D1",
  );
});

test("el ?resume=1 sobrevive al ida y vuelta completo", () => {
  // resumen -> register -> login -> (login hace router.push(next))
  const aRegister = `/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`;
  const searchRegister = new URL("https://x" + aRegister).search;
  const aLogin = hrefAuth("/login", searchRegister);
  const destino = new URLSearchParams(new URL("https://x" + aLogin).search).get("next");
  assert.equal(destino, "/analisis/nuevo-v4?resume=1");
  assert.equal(new URL("https://x" + destino).searchParams.get("resume"), "1");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("2 · ?plan= — la intención de compra, que se perdía igual");

test("conserva plan", () => {
  assert.equal(hrefAuth("/login", "?plan=plan10_mensual"), "/login?plan=plan10_mensual");
});

test("conserva next y plan juntos", () => {
  const href = hrefAuth("/login", "?next=%2Fcheckout&plan=plan50_anual");
  const q = new URL("https://x" + href).searchParams;
  assert.equal(q.get("next"), "/checkout");
  assert.equal(q.get("plan"), "plan50_anual");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("3 · Whitelist — no arrastra el estado de la pantalla actual");

test("no copia confirm_error al saltar", () => {
  assert.equal(hrefAuth("/register", "?confirm_error=1"), "/register");
});

test("no copia params ajenos aunque haya next", () => {
  const href = hrefAuth("/login", "?next=%2Fdashboard&confirm_error=1&utm_source=x");
  assert.equal(href, "/login?next=%2Fdashboard");
});

test("sin query, el href queda limpio", () => {
  assert.equal(hrefAuth("/login", ""), "/login");
  assert.equal(hrefAuth("/register", "?"), "/register");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("4 · Open redirect — la parte con consecuencias");

test("rechaza next absoluto a otro dominio", () => {
  assert.equal(esDestinoSeguro("https://evil.cl"), false);
  assert.equal(hrefAuth("/login", "?next=https%3A%2F%2Fevil.cl"), "/login");
});

test("rechaza el truco de la doble barra (//evil.cl)", () => {
  assert.equal(esDestinoSeguro("//evil.cl"), false);
  assert.equal(hrefAuth("/login", "?next=%2F%2Fevil.cl"), "/login");
});

/**
 * Estos son los que se le escapan a un chequeo de prefijos. El parser WHATWG
 * trata la barra invertida como barra para esquemas especiales y descarta
 * tab/newline/CR, así que varias escrituras distintas resuelven al mismo
 * dominio externo. Por eso el guard compara ORIGEN resuelto, no prefijos.
 */
const VECTORES_EXTERNOS = [
  "//evil.cl",
  "/\\evil.cl", // barra invertida: pasaba un !startsWith("//")
  "\\\\evil.cl",
  "/\t/evil.cl", // el parser descarta el tab y queda //
  "/\n/evil.cl",
  "/\r/evil.cl",
  "https://evil.cl",
  "http://evil.cl",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
];

test("ningún vector de escritura llega a otro dominio", () => {
  const fugas: string[] = [];
  for (const v of VECTORES_EXTERNOS) {
    if (!esDestinoSeguro(v)) continue;
    // Si el guard lo aceptó, tiene que resolver DENTRO del sitio.
    const origen = (() => { try { return new URL(v, "https://refranco.ai/login").origin; } catch { return "(no parsea)"; } })();
    if (origen !== "https://refranco.ai") fugas.push(`${JSON.stringify(v)} -> ${origen}`);
  }
  assert.deepEqual(fugas, [], `destinos que salen del sitio: ${fugas.join(" | ")}`);
});

test("el destino de router.push cae a /dashboard ante cualquier vector", () => {
  // Espeja lo que hacen login/page.tsx y register/page.tsx tras autenticar.
  for (const v of VECTORES_EXTERNOS) {
    const destino = esDestinoSeguro(v) ? v : "/dashboard";
    assert.equal(destino, "/dashboard", `${JSON.stringify(v)} deberia caer a /dashboard`);
  }
});

test("los destinos legítimos siguen pasando", () => {
  for (const v of ["/dashboard", "/analisis/nuevo-v4?resume=1", "/cuenta?tab=facturacion", "/checkout?product=plan10_mensual"]) {
    assert.equal(esDestinoSeguro(v), true, `deberia aceptar: ${v}`);
  }
});

test("rechaza esquemas raros y vacíos", () => {
  for (const malo of ["javascript:alert(1)", "", null, undefined, "dashboard"]) {
    assert.equal(esDestinoSeguro(malo as string), false, `deberia rechazar: ${malo}`);
  }
});

test("acepta paths relativos con query", () => {
  assert.equal(esDestinoSeguro("/analisis/nuevo-v4?resume=1"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("5 · conNext — el que usan middleware y callback");

test("agrega next al destino", () => {
  const u = conNext(new URL("https://x/login"), "/cuenta?tab=facturacion");
  assert.equal(u.searchParams.get("next"), "/cuenta?tab=facturacion");
});

test("conserva params que el destino ya traía", () => {
  const base = new URL("https://x/login");
  base.searchParams.set("confirm_error", "1");
  const u = conNext(base, "/analisis/nuevo-v4?resume=1");
  assert.equal(u.searchParams.get("confirm_error"), "1");
  assert.equal(u.searchParams.get("next"), "/analisis/nuevo-v4?resume=1");
});

test("no agrega next inseguro", () => {
  const u = conNext(new URL("https://x/login"), "https://evil.cl");
  assert.equal(u.searchParams.get("next"), null);
});

test("no agrega un next redundante al propio destino", () => {
  const u = conNext(new URL("https://x/login"), "/login");
  assert.equal(u.searchParams.get("next"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("6 · queryDeIntencion aislada");

test("devuelve string vacío cuando no hay nada que preservar", () => {
  assert.equal(queryDeIntencion("?foo=bar"), "");
});

test("tolera basura sin romper", () => {
  assert.equal(queryDeIntencion("%%%"), "");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(56)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Round-trip de auth: todos los tests pasan.");
