/**
 * Tests de SECUENCIA del guard de plausibilidad: parse → guard → cobro.
 *
 *   npx tsx scripts/test-guard-cobro.ts
 *
 * QUÉ CUBRE ESTO QUE test-plausibilidad.ts NO
 * ───────────────────────────────────────────
 * Los 91 tests de `test-plausibilidad.ts` prueban `evaluarPlausibilidad` puro y
 * los adaptadores `desdeBodyLtr/desdeBodyStr`. Ninguno monta la secuencia. Que
 * el guard corra ANTES del cobro estaba verificado por posición de línea, no por
 * ejecución: si alguien sube `ensureCreditCharged` arriba del guard, los 91
 * siguen verdes y volvemos a cobrar por análisis imposibles.
 *
 * POR QUÉ SE IMPORTAN LOS HANDLERS REALES Y NO SE EXTRAE UN SEAM
 * ─────────────────────────────────────────────────────────────
 * El seam ya existe: `guardPlausibilidad` y `ensureCreditCharged` son funciones
 * exportadas de `analisis-pipeline.ts`, y los tests viejos ya prueban las piezas.
 * Lo que NO está cubierto es el ORDEN en que el handler las llama, y eso vive
 * dentro de `POST`. Un seam nuevo movería el hueco un nivel más abajo: si el
 * cobro sube arriba del guard EN LA RUTA, el test del seam sigue verde. Es la
 * misma trampa de la réplica que dejó pasar la regresión del tabId.
 *
 * CÓMO
 * ────
 * El repo es CommonJS y tsx transpila a CJS, así que `Module._load` es el punto
 * real de resolución. Se intercepta ahí, ANTES de cargar la ruta:
 *
 *   - `guardPlausibilidad`  queda REAL (es lo que se prueba).
 *   - `ensureCreditCharged` queda REAL, envuelto en un contador que delega.
 *   - `chargeAnalysisCredit` / `consumeLedgerCredit` son espías: la puerta del
 *     ledger. No se ejecutan — se registra que fueron llamados.
 *   - Supabase y la UF son dobles deterministas.
 *
 * Producción no se toca. El `POST` que corre acá es el que corre en Vercel.
 *
 * SOBRE `welcomeMarcado` — LEER ANTES DE CONFIAR EN ESA ASERCIÓN
 * ─────────────────────────────────────────────────────────────
 * En producción el flag `welcome_credit_used` lo escribe `chargeAnalysisCredit`
 * por dentro (access.ts:142). El espía NO ejecuta ese cuerpo: modela el efecto
 * (si el cobro corre en modo welcome, marca).
 *
 * Por lo tanto `assert.equal(ctx.welcomeMarcado, false)` prueba UNA sola cosa:
 * que el cobro no corrió antes del guard. Es una aserción de ORDEN.
 *
 * NO prueba que el UPDATE de `welcome_credit_used` funcione, ni que su cláusula
 * condicional `.eq('welcome_credit_used', false)` sea correcta, ni que el flag
 * se escriba de verdad en la base. Nada de eso está cubierto acá ni en ningún
 * otro test del repo. Si algún día se rompe esa escritura, esta suite sigue
 * verde — y tiene que seguir verde, porque no es lo que mira.
 *
 * CÓMO VERIFICAR QUE ESTOS TESTS SIRVEN (el rojo)
 * ──────────────────────────────────────────────
 * Un test de orden que nunca se vio rojo no prueba nada. Para reproducirlo,
 * invertí el orden en los cuatro handlers y corré la suite:
 *
 *   · /api/analisis y /api/analisis/short-term — mové el bloque
 *     `const charge = await ensureCreditCharged(...)` ARRIBA del
 *     `const plausible = guardPlausibilidad(...)`.
 *   · /api/credits/charge — mové el bloque `if (body?.ltr || body?.str) {...}`
 *     ABAJO del bloque `if (isAdmin) ... else chargeAnalysisCredit(...)`.
 *   · /api/analisis/locked (3 ramas) — no cobra: mové cada
 *     `if (!plausibleX.ok) return plausibleX.response;` DEBAJO de su insert.
 *
 * Resultado esperado: 4 OK · 6 FAIL. Los seis "imposible" caen; los cuatro
 * "sano" siguen verdes (invertir el orden no rompe el camino feliz, y por eso
 * esos cuatro no son tests de orden sino de no-regresión del canónico).
 * Revertir con `git checkout -- src/app/api/`.
 */

/* eslint-disable @typescript-eslint/no-require-imports --
 * Acá `require` no es estilo, es la técnica. Los `import` se hoistean: cargarían
 * las rutas ANTES de que el hook de Module._load esté instalado, y resolverían
 * contra los módulos reales (Supabase real, Anthropic real, ledger real). El
 * orden carga-después-del-hook es todo el punto, y sólo se consigue con require.
 */

import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

// ── Rutas absolutas de los módulos a interceptar ─────────────────────────────
const R = (p: string) => path.resolve(__dirname, "..", p);

const MOD = {
  pipeline: R("src/lib/api-helpers/analisis-pipeline.ts"),
  access: R("src/lib/access.ts"),
  creditsGrant: R("src/lib/credits-grant.ts"),
  uf: R("src/lib/uf.ts"),
  aiGeneration: R("src/lib/ai-generation.ts"),
  email: R("src/lib/email.ts"),
  capi: R("src/lib/meta/capi.ts"),
  welcome: R("src/lib/welcome.ts"),
};

const RUTA = {
  ltr: R("src/app/api/analisis/route.ts"),
  str: R("src/app/api/analisis/short-term/route.ts"),
  locked: R("src/app/api/analisis/locked/route.ts"),
  charge: R("src/app/api/credits/charge/route.ts"),
};

const UF_DEL_DIA = 39_000;

// ── Contexto por test ────────────────────────────────────────────────────────
//
// Los dobles leen SIEMPRE de `ctx`, que se reemplaza entero antes de cada test.
// Así los módulos se cargan una vez y no hace falta cirugía en require.cache.

interface Ctx {
  /** Puertas de cobro que se llamaron, en orden. */
  cobros: string[];
  /** Tablas y filas insertadas por la ruta. */
  inserts: Array<{ tabla: string; row: Record<string, unknown> }>;
  /** Modela el UPDATE de welcome_credit_used que hace chargeAnalysisCredit. */
  welcomeMarcado: boolean;
  /** Modo que devuelve el cobro simulado. */
  modoCobro: "welcome" | "paid" | "subscription";
  /** Fila que devuelve el insert (para que el happy path siga). */
  idInsertado: string;
}

function nuevoCtx(over: Partial<Ctx> = {}): Ctx {
  return {
    cobros: [],
    inserts: [],
    welcomeMarcado: false,
    modoCobro: "welcome",
    idInsertado: "00000000-0000-4000-8000-000000000001",
    ...over,
  };
}

let ctx: Ctx = nuevoCtx();

/** Filas insertadas en `analisis` — el "no queda fila" del contrato. */
function filasAnalisis(): number {
  return ctx.inserts.filter((i) => i.tabla === "analisis").length;
}

// ── Doble de Supabase ────────────────────────────────────────────────────────
//
// Encadenable y registrador. Cubre los usos reales de las cuatro rutas:
//   .from(t).insert(row).select().single()
//   .from(t).update(row).eq(...)
//   .from(t).select(...).eq(...).maybeSingle()
//   .auth.getUser()

const USUARIO = { id: "user-test-uuid", email: "test@franco.cl", user_metadata: {} };

function fakeDb() {
  let tabla = "";
  const api: Record<string, unknown> = {
    auth: { getUser: async () => ({ data: { user: USUARIO }, error: null }) },
    from(t: string) { tabla = t; return api; },
    insert(row: Record<string, unknown>) {
      ctx.inserts.push({ tabla, row });
      return api;
    },
    update() { return api; },
    delete() { return api; },
    select() { return api; },
    eq() { return api; },
    is() { return api; },
    order() { return api; },
    limit() { return api; },
    single: async () => ({ data: { id: ctx.idInsertado }, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    // Un `await client.from(...).update(...).eq(...)` sin .single() resuelve acá.
    then(res: (v: unknown) => unknown) { return Promise.resolve({ data: null, error: null }).then(res); },
  };
  return api;
}

// ── Instalación de los dobles ────────────────────────────────────────────────
//
// Los reales se cargan ANTES de instalar el hook: si se cargaran adentro, el
// require re-entraría en el hook y reventaría por recursión.

const realAccess = require(MOD.access) as Record<string, unknown>;
const realCreditsGrant = require(MOD.creditsGrant) as Record<string, unknown>;
const realUf = require(MOD.uf) as Record<string, unknown>;

const fakes: Record<string, unknown> = {
  [MOD.access]: {
    ...realAccess,
    // LA PUERTA DEL LEDGER. Si esto se llama con un input imposible, el bug volvió.
    chargeAnalysisCredit: async () => {
      ctx.cobros.push("chargeAnalysisCredit");
      if (ctx.modoCobro === "welcome") ctx.welcomeMarcado = true; // modela access.ts:142
      return { ok: true, mode: ctx.modoCobro };
    },
  },
  [MOD.creditsGrant]: {
    ...realCreditsGrant,
    consumeCredit: async () => { ctx.cobros.push("consumeLedgerCredit"); return true; },
  },
  [MOD.uf]: { ...realUf, getUFValue: async () => UF_DEL_DIA },
  "next/headers": { cookies: () => ({ get: () => undefined, getAll: () => [], set: () => {} }) },
  "@supabase/ssr": { createServerClient: () => fakeDb() },
  "@supabase/supabase-js": { createClient: () => fakeDb() },
  "@vercel/functions": { waitUntil: () => {} },
  // Cola del happy path (IA, correo, píxel). Se doblan por dos razones: sin
  // esto el test le pega de verdad a Anthropic y a Resend, y el ruido de sus
  // errores tapa el output. Nada de esto corre antes del cobro, que es lo que
  // se está probando.
  [MOD.aiGeneration]: { generateAiAnalysis: async () => null },
  [MOD.email]: { sendAnalysisReadyEmail: async () => {}, sendBoletaEmail: async () => {} },
  [MOD.capi]: { sendMetaCapiEvent: async () => {} },
  [MOD.welcome]: { resolveDisplayName: async () => "Test", ensureWelcomeEmail: async () => {} },
};

const M = Module as unknown as {
  _load: (r: string, p: unknown, m: boolean) => unknown;
  _resolveFilename: (r: string, p: unknown, m: boolean) => string;
};
const loadOriginal = M._load;
M._load = function (request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(fakes, request)) return fakes[request];
  let archivo = "";
  try { archivo = M._resolveFilename(request, parent, isMain); } catch { archivo = ""; }
  if (archivo && Object.prototype.hasOwnProperty.call(fakes, archivo)) return fakes[archivo];
  return loadOriginal.call(this, request, parent, isMain);
};

// El pipeline se carga CON el hook ya puesto: así su `chargeAnalysisCredit`
// interno resuelve al espía y no al real (que intentaría abrir un cliente
// Supabase). Recién con el módulo cargado se arma su doble, que reusa las
// funciones reales — `guardPlausibilidad` entre ellas.
const realPipeline = require(MOD.pipeline) as Record<string, unknown>;
type EnsureFn = (o: unknown) => Promise<unknown>;
const ensureReal = realPipeline.ensureCreditCharged as EnsureFn;

fakes[MOD.pipeline] = {
  ...realPipeline,
  createSupabaseServer: () => fakeDb(),
  createPaymentsAdminClient: () => fakeDb(),
  // REAL, envuelto: el test observa el cableado, no una sustitución.
  ensureCreditCharged: async (o: unknown) => {
    ctx.cobros.push("ensureCreditCharged");
    return ensureReal(o);
  },
  // AirROI + motor STR: doble determinista (no es lo que se prueba acá).
  buildShortTermAnalysisRow: async () => ({
    ok: true,
    row: { nombre: "STR test", comuna: "Providencia", tipo_analisis: "short-term", results: {} },
  }),
  prefetchMedianaComunaVenta: async () => ({ mediana: null, n: 0 }),
};

// Las rutas se cargan DESPUÉS del hook, para que resuelvan contra los dobles.
type Handler = (r: Request) => Promise<Response>;
const POST_ltr = (require(RUTA.ltr) as { POST: Handler }).POST;
const POST_str = (require(RUTA.str) as { POST: Handler }).POST;
const POST_locked = (require(RUTA.locked) as { POST: Handler }).POST;
const POST_charge = (require(RUTA.charge) as { POST: Handler }).POST;

// ── Runner ───────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const fallidos: string[] = [];
const pendientes: Array<() => Promise<void>> = [];

function test(nombre: string, fn: () => Promise<void>) {
  pendientes.push(async () => {
    ctx = nuevoCtx();
    try { await fn(); pass++; console.log(`  OK   ${nombre}`); }
    catch (err) {
      fail++; fallidos.push(nombre);
      console.log(`  FAIL ${nombre}`);
      console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  });
}
function seccion(t: string) { pendientes.push(async () => console.log(`\n${t}`)); }

function req(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Los dos casos ────────────────────────────────────────────────────────────
//
// IMPOSIBLE: UF 4.800.000 · 45 m² · $950.000 — el tipeo de "UF 4.800" que se
// procesaba completo y cobraba (UF 106.666/m², yield 0,006%).
// SANO: Providencia UF 5.500 · 60 m² · $950.000 — el canónico que debe pasar.

const LTR_IMPOSIBLE = {
  nombre: "Imposible", comuna: "Providencia", ciudad: "Santiago", direccion: "Suecia 750",
  tipo: "Departamento", dormitorios: 2, banos: 1, superficie: 45, antiguedad: 5,
  precio: 4_800_000, arriendo: 950_000, gastos: 80_000, contribuciones: 30_000,
  pie: 20, tasa: 4.5, plazo: 25,
};
const LTR_SANO = {
  ...LTR_IMPOSIBLE, nombre: "Sano", superficie: 60, precio: 5_500, arriendo: 950_000,
};

const STR_IMPOSIBLE = {
  direccion: "Suecia 750", comuna: "Providencia", ciudad: "Santiago",
  dormitorios: 2, banos: 1, superficieUtil: 45, capacidadHuespedes: 4,
  precioCompra: 4_800_000 * UF_DEL_DIA, precioCompraUF: 4_800_000,
  piePct: 20, tasaInteres: 4.5, plazoCredito: 25,
  modoGestion: "auto" as const, comisionAdministrador: 0,
  costoElectricidad: 40_000, costoAgua: 20_000, costoWifi: 25_000, costoInsumos: 30_000,
  gastosComunes: 80_000, mantencion: 30_000, contribuciones: 30_000,
  arriendoLargoMensual: 950_000,
};
const STR_SANO = {
  ...STR_IMPOSIBLE, superficieUtil: 60,
  precioCompra: 5_500 * UF_DEL_DIA, precioCompraUF: 5_500,
};

/** Las cuatro aserciones del contrato, juntas: nada del ledger se tocó. */
async function assertRechazoSinCobro(res: Response, ruta: string) {
  const json = await res.json() as { error?: string; anomalias?: Array<{ regla: string }> };
  assert.equal(res.status, 422, `${ruta}: esperaba 422, vino ${res.status}`);
  assert.equal(json.error, "input_implausible", `${ruta}: otro error`);
  assert.ok((json.anomalias?.length ?? 0) > 0, `${ruta}: 422 sin anomalías`);
  // 1 · no se tocó el ledger
  assert.deepEqual(ctx.cobros, [], `${ruta}: SE COBRÓ antes del guard → ${ctx.cobros.join(",")}`);
  // 2 · no quedó fila
  assert.equal(filasAnalisis(), 0, `${ruta}: quedó fila en analisis pese al 422`);
  // 3 · el welcome no se quemó. OJO: esto prueba el ORDEN (el cobro no corrió
  // antes del guard), NO que el UPDATE de welcome_credit_used funcione — el
  // espía modela ese efecto, no lo ejecuta. Ver el header.
  assert.equal(ctx.welcomeMarcado, false, `${ruta}: se marcó welcome_credit_used`);
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("1 · POST /api/analisis (LTR)");

test("/api/analisis · imposible → 422 antes de tocar el ledger", async () => {
  await assertRechazoSinCobro(await POST_ltr(req(LTR_IMPOSIBLE)), "POST /api/analisis");
});

test("/api/analisis · sano → pasa el guard y SÍ cobra", async () => {
  const res = await POST_ltr(req(LTR_SANO));
  assert.notEqual(res.status, 422, "el canónico sano fue rechazado por el guard");
  assert.ok(ctx.cobros.includes("chargeAnalysisCredit"), `no cobró: ${ctx.cobros.join(",") || "(nada)"}`);
  assert.equal(filasAnalisis(), 1, "no insertó la fila del análisis");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("2 · POST /api/analisis/short-term (STR)");

test("/short-term · imposible → 422 antes de tocar el ledger", async () => {
  await assertRechazoSinCobro(await POST_str(req(STR_IMPOSIBLE)), "POST /api/analisis/short-term");
});

test("/short-term · sano → pasa el guard y SÍ cobra", async () => {
  const res = await POST_str(req(STR_SANO));
  assert.notEqual(res.status, 422, "el canónico sano fue rechazado por el guard");
  assert.ok(ctx.cobros.includes("chargeAnalysisCredit"), `no cobró: ${ctx.cobros.join(",") || "(nada)"}`);
  assert.equal(filasAnalisis(), 1, "no insertó la fila del análisis");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("3 · POST /api/analisis/locked (3 ramas)");

// locked NO cobra por diseño (termina en /checkout con pago real por Flow). Las
// aserciones de ledger igual corren: son la guarda de que nadie AGREGUE un cobro
// arriba del guard más adelante. Lo que sí importa acá es que no quede fila
// pending_payment de un análisis imposible que después alguien pague.

test("/locked BOTH · imposible → 422 sin fila ni cobro", async () => {
  await assertRechazoSinCobro(
    await POST_locked(req({ tipoAnalisis: "both", ltr: LTR_IMPOSIBLE, str: STR_IMPOSIBLE })),
    "POST /api/analisis/locked (both)",
  );
});

test("/locked STR · imposible → 422 sin fila ni cobro", async () => {
  await assertRechazoSinCobro(
    await POST_locked(req({ tipoAnalisis: "short-term", ...STR_IMPOSIBLE })),
    "POST /api/analisis/locked (str)",
  );
});

test("/locked LTR · imposible → 422 sin fila ni cobro", async () => {
  await assertRechazoSinCobro(
    await POST_locked(req(LTR_IMPOSIBLE)),
    "POST /api/analisis/locked (ltr)",
  );
});

test("/locked BOTH · sano → pasa el guard e inserta las dos filas locked", async () => {
  const res = await POST_locked(req({ tipoAnalisis: "both", ltr: LTR_SANO, str: STR_SANO }));
  assert.notEqual(res.status, 422, "el canónico sano fue rechazado por el guard");
  assert.equal(filasAnalisis(), 2, `esperaba 2 filas locked, hubo ${filasAnalisis()}`);
  // locked no cobra: si algún día cobra, este assert lo delata.
  assert.deepEqual(ctx.cobros, [], `locked cobró: ${ctx.cobros.join(",")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("4 · POST /api/credits/charge (intent both)");

test("/credits/charge · imposible → 422 antes de tocar el ledger", async () => {
  await assertRechazoSinCobro(
    await POST_charge(req({ intent: "both", ltr: LTR_IMPOSIBLE, str: STR_IMPOSIBLE })),
    "POST /api/credits/charge",
  );
});

test("/credits/charge · sano → pasa el guard y SÍ cobra", async () => {
  const res = await POST_charge(req({ intent: "both", ltr: LTR_SANO, str: STR_SANO }));
  assert.notEqual(res.status, 422, "el canónico sano fue rechazado por el guard");
  assert.ok(ctx.cobros.includes("chargeAnalysisCredit"), `no cobró: ${ctx.cobros.join(",") || "(nada)"}`);
});

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  for (const p of pendientes) await p();
  console.log(`\n${"─".repeat(58)}`);
  console.log(`${pass} OK · ${fail} FAIL`);
  if (fail > 0) {
    console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Guard antes del cobro: todos los tests pasan.");
})();
