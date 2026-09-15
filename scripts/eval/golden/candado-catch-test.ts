// ============================================================================
// GOLDEN · candado de regeneración — catch-test (goal #3 · 07-sep-2026). 0 tokens, sin base.
// ============================================================================
// Tres cosas que el pipeline no puede probar a voluntad:
//   (a) enforcement: `generating_since` / `generating_kind` no se escriben fuera de
//       src/lib/candado-generacion.ts (grep sobre src/, comentarios excluidos);
//   (b) dos tomas concurrentes sobre la MISMA fila → exactamente una gana;
//   (c) toma sobre un candado vencido (>10 min) → gana; sobre uno vivo → no.
// El stub imita la semántica del UPDATE … WHERE (since IS NULL OR since < vence)
// RETURNING id de PostgREST: check-and-set atómico por fila.
//
// Corre dentro del QUICK del runner (tier "candado") y standalone:
//   node --import tsx scripts/eval/golden/candado-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CANDADO_TTL_MIN, conCandado, soltarCandado, tomarCandado, type CandadoDb } from "../../../src/lib/candado-generacion";

// ── (a) grep ──────────────────────────────────────────────────────────────────
const RAIZ = join(__dirname, "..", "..", "..", "src");
const FUENTE = /^src[\\/]lib[\\/]candado-generacion\.ts$/;

function* archivos(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (/\.(ts|tsx)$/.test(e)) yield p;
  }
}
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => { const i = l.search(/(^|[^:'"`])\/\//); return i === -1 ? l : l.slice(0, i + (l[i] === "/" ? 0 : 1)); })
    .join("\n");
}
function grepFueraDelHelper(): string[] {
  const hits: string[] = [];
  for (const abs of archivos(RAIZ)) {
    const rel = relative(join(RAIZ, ".."), abs);
    if (FUENTE.test(rel)) continue;
    sinComentarios(readFileSync(abs, "utf-8")).split("\n").forEach((l, i) => {
      if (/generating_since|generating_kind/.test(l)) hits.push(`${rel}:${i + 1} — ${l.trim().slice(0, 100)}`);
    });
  }
  return hits;
}

// ── stub de PostgREST: una TABLA, check-and-set por fila ──────────────────────
//
// ⛔ EL STUB VIEJO MODELABA LA INTENCIÓN, NO LA CONSULTA (17-sep-2026). Tenía DOS cegueras
// y las dos dejaban pasar un cambio que rompe producción entera:
//
//  1 · `or(expr)` extraía solo el valor del `lt` y después empujaba un filtro con la
//      semántica deseada ESCRITA A MANO: `since === null || since < vence`. La rama
//      `generating_since.is.null` del código nunca se verificaba. Borrarla de producción
//      dejaba el tier VERDE — y en PostgREST `lt` sobre NULL da NULL, no true, así que
//      ninguna fila nueva podría tomar el candado nunca: cero informes generados.
//
//  2 · `eq(col, v)` descartaba el filtro de `id` sin registrarlo, y la tabla tenía UNA
//      fila. Borrar `.eq("id", analysisId)` dejaba los cuatro casos VERDES, y en
//      producción el UPDATE estampa `generating_since` sobre TODAS las filas que cumplan
//      el `or`: ninguna otra fila del parque vuelve a generar prosa.
//
// Ahora el stub INTERPRETA la consulta: parsea el `or` término a término y filtra por
// cualquier columna, `id` incluida, sobre una tabla de varias filas. No sabe qué querría
// el código: aplica lo que el código pide.
interface Fila { id: string; generating_since: string | null; generating_kind: string | null }

/** Un término PostgREST: `columna.op.valor`. Soporta los dos que el helper usa. */
function predicadoDeTermino(t: string): (f: Fila) => boolean {
  const [col, op, ...resto] = t.split(".");
  const valor = resto.join(".");
  const leer = (f: Fila) => (f as unknown as Record<string, unknown>)[col];
  if (op === "is" && valor === "null") return (f) => leer(f) === null;
  // En PostgREST una comparación contra NULL da NULL, no true: la fila NO entra.
  if (op === "lt") return (f) => { const v = leer(f); return typeof v === "string" && v < valor; };
  throw new Error(`stub: operador PostgREST no modelado en «${t}»`);
}

function stubDb(filas: Fila[] | Fila): CandadoDb & { filas: Fila[]; fila: Fila; updates: number } {
  const tabla = Array.isArray(filas) ? filas : [filas];
  const estado = { filas: tabla, fila: tabla[0], updates: 0 };
  const builder = (payload: Partial<Fila>) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    const aplicar = () => {
      estado.updates += 1;
      const tocadas = estado.filas.filter((f) => filtros.every((p) => p(f)));
      for (const f of tocadas) Object.assign(f, payload);
      return { data: tocadas.map((f) => ({ id: f.id })), error: null };
    };
    const b = {
      eq(col: string, v: unknown) {
        filtros.push((f) => (f as unknown as Record<string, unknown>)[col] === v);
        return b;
      },
      or(expr: string) {
        const terminos = expr.split(",").map((t) => t.trim()).filter(Boolean).map(predicadoDeTermino);
        if (!terminos.length) throw new Error("stub: `or` vacío");
        filtros.push((f) => terminos.some((p) => p(f)));
        return b;
      },
      select() { return Promise.resolve(aplicar()); },
      // `.eq(...).eq(...)` sin select (soltar): thenable que aplica igual.
      then(res: (v: { data: unknown[]; error: null }) => void) { res(aplicar()); },
    };
    return b;
  };
  return Object.assign({ from: () => ({ update: builder }) } as unknown as CandadoDb, estado);
}

interface Caso { nombre: string; check: () => Promise<string | null> }
const min = (n: number) => n * 60_000;

const CASOS: Caso[] = [
  {
    nombre: "(a) generating_since / generating_kind solo se escriben en candado-generacion.ts",
    check: async () => { const h = grepFueraDelHelper(); return h.length ? `fuera del helper: ${h.join(" · ")}` : null; },
  },
  {
    nombre: "(b) dos tomas concurrentes sobre la misma fila → una gana, una recibe null",
    check: async () => {
      const db = stubDb({ id: "x", generating_since: null, generating_kind: null });
      const ahora = new Date();
      const [a, b] = await Promise.all([tomarCandado("x", "ltr", db, ahora), tomarCandado("x", "str", db, ahora)]);
      const ganadores = [a, b].filter((t) => t && !t.sinCandado).length;
      if (ganadores !== 1) return `ganaron ${ganadores}`;
      if (db.fila.generating_kind !== (a ? "ltr" : "str")) return `kind persistido ${db.fila.generating_kind}`;
      return null;
    },
  },
  {
    nombre: "(c) el TTL son 10 minutos: a los 11 la toma gana, a los 9 no",
    check: async () => {
      // ⛔ LOS MINUTOS VAN LITERALES, Y ESO ES LA MITAD DEL INVARIANTE (17-sep-2026). Antes
      // los dos fixtures se calculaban DESDE la constante (`CANDADO_TTL_MIN ± 1`), así que
      // el test probaba que el helper es coherente CONSIGO MISMO y no que el TTL sea 10:
      // poner la constante en 1 lo dejaba VERDE, y en producción un proceso vivo
      // (maxDuration 300 s) pierde el candado al minuto y arranca una segunda generación
      // encima — la doble prosa pagada que el goal #3 vino a matar.
      if (CANDADO_TTL_MIN !== 10) return `CANDADO_TTL_MIN es ${CANDADO_TTL_MIN} y el TTL acordado son 10 minutos`;
      const ahora = new Date();
      const vencido = stubDb({ id: "x", generating_since: new Date(ahora.getTime() - min(11)).toISOString(), generating_kind: "ltr" });
      const t1 = await tomarCandado("x", "ltr", vencido, ahora);
      if (!t1 || t1.sinCandado) return "a los 11 min no ganó";
      const vivo = stubDb({ id: "x", generating_since: new Date(ahora.getTime() - min(9)).toISOString(), generating_kind: "ltr" });
      const t2 = await tomarCandado("x", "ltr", vivo, ahora);
      if (t2) return "a los 9 min ganó y no debía";
      return null;
    },
  },
  {
    nombre: "(d) el UPDATE es POR FILA: tomar en una no toca a las demás",
    check: async () => {
      // La cabecera del stub declara «check-and-set atómico POR FILA» y esa mitad no se
      // medía: el stub tenía UNA fila y descartaba el filtro de `id` sin registrarlo, así
      // que borrar `.eq("id", analysisId)` dejaba los cuatro casos verdes. En producción",
      // ese UPDATE estampa `generating_since` sobre TODAS las filas que cumplan el `or`.
      const db = stubDb([
        { id: "x", generating_since: null, generating_kind: null },
        { id: "y", generating_since: null, generating_kind: null },
      ]);
      const t = await tomarCandado("x", "ltr", db, new Date());
      if (!t || t.sinCandado) return "no tomó";
      const y = db.filas.find((f) => f.id === "y")!;
      if (y.generating_since !== null) return `tomar en «x» estampó también a «y» (${y.generating_since})`;
      await soltarCandado(t, db);
      const x = db.filas.find((f) => f.id === "x")!;
      if (x.generating_since !== null) return "no soltó la propia";
      return null;
    },
  },
  {
    nombre: "soltarCandado solo suelta con la marca propia; conCandado suelta en finally aunque fn lance",
    check: async () => {
      const db = stubDb({ id: "x", generating_since: null, generating_kind: null });
      const t = await tomarCandado("x", "ltr", db);
      if (!t) return "no tomó";
      await soltarCandado({ ...t, since: "1999-01-01T00:00:00.000Z" }, db);
      if (db.fila.generating_since !== t.since) return "soltó con marca ajena";
      await soltarCandado(t, db);
      if (db.fila.generating_since !== null) return "no soltó con marca propia";
      let lanzo = false;
      try { await conCandado("x", "str", async () => { throw new Error("boom"); }, db); } catch { lanzo = true; }
      if (!lanzo) return "conCandado se tragó el error";
      if (db.fila.generating_since !== null) return "conCandado no soltó tras el error";
      const r = await conCandado("x", "str", async () => 42, db);
      if (!r.tomado || r.resultado !== 42) return "conCandado no devolvió el resultado";
      return null;
    },
  },
];

/** Tier para el runner: cada caso roto es una falla dura. */
export async function runCandadoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CANDADO (regeneración: una por fila, cross-instance · candado-generacion.ts, 0 tokens, sin base) ───");
  let hard = 0;
  for (const c of CASOS) {
    let err: string | null;
    try { err = await c.check(); } catch (e) { err = `lanzó: ${(e as Error).message}`; }
    if (err) { hard += 1; console.log(`  ✗ ${c.nombre} — ${err}`); }
  }
  if (!hard) console.log(`  ✓ VERDE — ${CASOS.length} casos: enforcement, carrera, TTL y liberación`);
  return { hard };
}

if (require.main === module) {
  runCandadoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
