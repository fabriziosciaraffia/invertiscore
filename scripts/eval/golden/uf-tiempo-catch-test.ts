// ─────────────────────────────────────────────────────────────────────────────
// Tier UF-TIEMPO (09-oct-2026, 0 tokens) — la UF nunca cuelga un pedido.
//
// El incidente: a las 9:26–9:28 de Chile, mindicador.cl respondía 500/502 después de ~2 minutos.
// `getUFValue` lo pedía sin tiempo máximo y sin recordar la falla: cada llamada volvía a esperar, y
// `/api/data/suggestions` (que la pide varias veces por pedido) llegaba al corte de 300 s de Vercel. El
// wizard se quedaba en «Buscando comparables cerca…». Encima, el respaldo era 38.800 fijo cuando la UF del
// día (en `config.uf_value`, del Banco Central) era 41.131: 5,7% abajo.
//
// Fija: (1) tiempo máximo por intento, aunque el pedido ignore la señal; (2) tras una falla no se vuelve a
// pedir por un rato, y la base se lee una vez en ese rato; (3) dos llamadas a la vez comparten un solo
// pedido; (4) el respaldo es la última UF buena o la de la base, y el número fijo solo si las dos faltan;
// (5) el respaldo tampoco cuelga.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/uf-tiempo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as UF from "../../../src/lib/uf";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

type Lector = () => Promise<number>;
type Opciones = {
  pedir?: (signal: AbortSignal) => Promise<Response>;
  respaldo?: () => Promise<number | null>;
  ahora?: () => number;
  tiempoMaxMs?: number;
  esperaTrasFallaMs?: number;
};

const colgado = () => new Promise<Response>(() => { /* mindicador que no responde nunca, ni con la señal */ });
const okUF = (valor: number) => new Response(JSON.stringify({ serie: [{ valor }] }), { status: 200 });
const conReloj = () => {
  const r = { t: 1_000_000 };
  return { r, ahora: () => r.t };
};

// Con GUARDIA: una lectura que cuelga no puede colgar el tier. Sin esto, una promesa que nunca se resuelve
// deja a Node sin trabajo, el proceso termina sin imprimir nada y eso se leía como verde (mutación Z5).
const GUARDIA_MS = 2000;
async function medir<T>(p: Promise<T>): Promise<{ v: T | undefined; ms: number; colgo: boolean }> {
  const t0 = Date.now();
  let t: NodeJS.Timeout | undefined;
  const guardia = new Promise<"colgo">((r) => { t = setTimeout(() => r("colgo"), GUARDIA_MS); });
  const v = await Promise.race([p, guardia]);
  clearTimeout(t);
  return v === "colgo" ? { v: undefined, ms: Date.now() - t0, colgo: true } : { v: v as T, ms: Date.now() - t0, colgo: false };
}

export async function runUfTiempoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER UF-TIEMPO (la UF nunca cuelga un pedido · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const valor = async (p: Promise<number>, que: string): Promise<number | undefined> => {
    const r = await medir(p);
    if (r.colgo) F(`${que}: la lectura de la UF COLGÓ (más de ${GUARDIA_MS} ms sin responder)`);
    return r.v;
  };
  const FIJO = (UF as unknown as { UF_CLP_FALLBACK: number }).UF_CLP_FALLBACK;
  const crear = (UF as unknown as { crearLectorUF?: (o?: Opciones) => Lector }).crearLectorUF;
  const errorOriginal = console.error;
  console.error = () => { /* el [UF-FALLBACK] esperado no ensucia la salida del tier */ };
  try {
    if (typeof crear !== "function") {
      F("1 · no existe `crearLectorUF`: la UF se pide sin tiempo máximo (con mindicador colgado, /api/data/suggestions llega al corte de 300 s)");
    } else {
      if ((UF as unknown as { UF_TIEMPO_MAX_MS?: number }).UF_TIEMPO_MAX_MS !== 3000) F("1 · el tiempo máximo de mindicador no es 3 s");
      // EL CASO EXACTO: mindicador colgado (ignora hasta la señal) y la base con la UF del día.
      {
        const { ahora } = conReloj();
        let pedidos = 0;
        let lecturasBase = 0;
        const leerUF = crear({ pedir: () => { pedidos++; return colgado(); }, respaldo: async () => { lecturasBase++; return 41131; }, ahora, tiempoMaxMs: 60 });
        const primera = await medir(leerUF());
        if (primera.colgo) F("1 · con mindicador colgado, la UF COLGÓ (el caso del incidente)");
        else if (primera.ms > 1000) F(`1 · con mindicador colgado, la UF tardó ${primera.ms} ms (tiene que cortar al tiempo máximo)`);
        if (!primera.colgo && primera.v !== 41131) F(`4 · con mindicador colgado, la UF no es la de la base (${primera.v})`);
        // 2 · tras la falla, no se vuelve a pedir enseguida.
        const segunda = await medir(leerUF());
        if (segunda.colgo) F("2 · tras una falla, la segunda lectura COLGÓ");
        if (pedidos !== 1) F(`2 · tras una falla se vuelve a pedir a mindicador enseguida (${pedidos} pedidos)`);
        if (!segunda.colgo && segunda.ms > 50) F(`2 · tras una falla, la segunda lectura volvió a esperar (${segunda.ms} ms)`);
        // Durante la espera, la UF de la base se lee una vez (el endpoint pide la UF varias veces por pedido).
        await valor(leerUF(), "2 · tercera lectura");
        if (lecturasBase !== 1) F(`2 · durante la espera tras la falla, la base se leyó ${lecturasBase} veces (una basta)`);
      }
      // 2 · pasada la espera, se vuelve a intentar.
      {
        const { r, ahora } = conReloj();
        let pedidos = 0;
        const leerUF = crear({ pedir: () => { pedidos++; return colgado(); }, respaldo: async () => 41131, ahora, tiempoMaxMs: 30, esperaTrasFallaMs: 60_000 });
        await valor(leerUF(), "2 · espera");
        r.t += 59_999;
        await valor(leerUF(), "2 · espera");
        if (pedidos !== 1) F("2 · se vuelve a pedir antes de que pase la espera tras la falla");
        r.t += 2;
        await valor(leerUF(), "2 · espera");
        if (pedidos !== 2) F("2 · pasada la espera, no se vuelve a intentar mindicador");
      }
      // 3 · tres llamadas a la vez (el endpoint pide la UF varias veces) comparten un pedido.
      {
        const { ahora } = conReloj();
        let pedidos = 0;
        const leerUF = crear({ pedir: () => { pedidos++; return colgado(); }, respaldo: async () => 41131, ahora, tiempoMaxMs: 60 });
        const todas = await medir(Promise.all([leerUF(), leerUF(), leerUF()]));
        if (todas.colgo) F("3 · las llamadas a la vez COLGARON");
        if (pedidos !== 1) F(`3 · tres llamadas a la vez hicieron ${pedidos} pedidos a mindicador`);
        const [a, b, c] = todas.v ?? [];
        if (!todas.colgo && (a !== 41131 || b !== 41131 || c !== 41131)) F("3 · las llamadas a la vez no recibieron la misma UF");
      }
      // 4 · con mindicador bien, su valor manda y queda en memoria; si después falla, se usa esa.
      {
        const { r, ahora } = conReloj();
        let modo: "ok" | "colgado" = "ok";
        let pedidos = 0;
        const leerUF = crear({ pedir: async () => { pedidos++; return modo === "ok" ? okUF(41131.4) : colgado(); }, respaldo: async () => 99999, ahora, tiempoMaxMs: 60 });
        if ((await valor(leerUF(), "4 · mindicador bien")) !== 41131) F("4 · con mindicador bien, la UF no es la suya redondeada");
        await valor(leerUF(), "4 · en memoria");
        if (pedidos !== 1) F("4 · con la UF en memoria se vuelve a pedir");
        r.t += 25 * 60 * 60 * 1000; // vence la memoria de 24 h
        modo = "colgado";
        const v = await valor(leerUF(), "4 · memoria vencida");
        if (v !== undefined && v !== 41131) F(`4 · con mindicador caído y una UF buena en memoria, no se usa esa (${v})`);
      }
      // 4/5 · sin memoria ni base, el número fijo; la base que cuelga tampoco cuelga la UF; una implausible no vale.
      {
        const { ahora } = conReloj();
        const sinBase = crear({ pedir: colgado, respaldo: async () => null, ahora, tiempoMaxMs: 40 });
        const v1 = await valor(sinBase(), "4 · sin base");
        if (v1 !== undefined && v1 !== FIJO) F("4 · sin mindicador ni base, la UF no es el respaldo fijo");
        const baseColgada = crear({ pedir: colgado, respaldo: () => new Promise<number | null>(() => {}), ahora, tiempoMaxMs: 40 });
        const bc = await medir(baseColgada());
        if (bc.colgo) F("5 · con la base colgada, la UF COLGÓ");
        else if (bc.ms > 1000) F(`5 · con la base colgada, la UF tardó ${bc.ms} ms`);
        const basePorLasNubes = crear({ pedir: colgado, respaldo: async () => 4113100, ahora, tiempoMaxMs: 40 });
        const v3 = await valor(basePorLasNubes(), "4 · base implausible");
        if (v3 !== undefined && v3 !== FIJO) F("4 · una UF implausible de la base se usa como respaldo");
      }
    }
    // El cableado: `getUFValue` es el lector, con mindicador, la señal y el respaldo de la base.
    const src = leer("src/lib/uf.ts");
    if (!/export const getUFValue: \(\) => Promise<number> = crearLectorUF\(\);/.test(src)) F("1 · `getUFValue` no es el lector con tiempo máximo");
    if (!/fetch\("https:\/\/mindicador\.cl\/api\/uf", \{ next: \{ revalidate: 86400 \}, signal \}\)/.test(src)) F("1 · el pedido a mindicador no lleva la señal del tiempo máximo");
    // Presencia no es cableado (Z4): la consulta a la base tiene que ser el respaldo POR DEFECTO del lector.
    if (!/const respaldo = o\.respaldo \?\? ufDeLaBase;/.test(src)) F("4 · el lector no usa la base como respaldo (la consulta existe, pero nadie la llama)");
    if (!/\.from\("config"\)\.select\("value"\)\.eq\("key", "uf_value"\)/.test(src)) F("4 · el respaldo no lee la UF del día de la base (`config.uf_value`)");
    if (!/typeof window !== "undefined"/.test(src) || !/await import\("\.\/supabase\/service"\)/.test(src)) F("4 · el respaldo de la base no queda solo en el servidor (import dinámico)");
  } finally {
    console.error = errorOriginal;
  }

  if (fallas.length) {
    console.log(`  ✗ UF-TIEMPO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — mindicador corta a los 3 s aunque ignore la señal, no se reintenta enseguida tras una falla, las llamadas a la vez comparten un pedido, el respaldo es la última UF buena o la de la base y nunca cuelga");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runUfTiempoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (09-oct-2026) — cada una aplicada sobre el código arreglado, corrida contra este tier y
// restaurada desde una copia en memoria. Antes del arreglo el tier dio 5 fallas. Las 8 en ROJO; restauradas,
// VERDE. Dos debilidades del propio tier se corrigieron en el camino: (a) Z5 salió VERDE porque una lectura
// colgada dejaba a Node sin trabajo y el proceso terminaba sin imprimir nada; ahora cada lectura va con
// guardia de 2 s y el corredor exige la línea de verde; (b) Z4 salió VERDE porque el chequeo miraba que la
// consulta a `config` EXISTIERA, no que fuera el respaldo del lector (presencia no es cableado).
//    Z1 sin tiempo máximo (el bug)          Z5 la base sin tiempo máximo
//    Z2 sin espera tras la falla            Z6 una UF implausible de la base vale
//    Z3 sin pedido compartido               Z7 la base se lee en cada llamada
//    Z4 el respaldo no es la base           Z8 sin la señal en el pedido real
