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

// ── stub de PostgREST: una fila, check-and-set ────────────────────────────────
interface Fila { generating_since: string | null; generating_kind: string | null }
function stubDb(fila: Fila): CandadoDb & { fila: Fila; updates: number } {
  const estado = { fila, updates: 0 };
  const builder = (payload: Partial<Fila>) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    const aplicar = () => {
      estado.updates += 1;
      if (!filtros.every((p) => p(estado.fila))) return { data: [], error: null };
      Object.assign(estado.fila, payload);
      return { data: [{ id: "x" }], error: null };
    };
    const b = {
      eq(col: string, v: unknown) {
        if (col === "id") return b;
        filtros.push((f) => (f as unknown as Record<string, unknown>)[col] === v);
        return b;
      },
      or(expr: string) {
        const vence = expr.match(/generating_since\.lt\.([^,]+)/)?.[1] ?? "";
        filtros.push((f) => f.generating_since === null || f.generating_since < vence);
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
      const db = stubDb({ generating_since: null, generating_kind: null });
      const ahora = new Date();
      const [a, b] = await Promise.all([tomarCandado("x", "ltr", db, ahora), tomarCandado("x", "str", db, ahora)]);
      const ganadores = [a, b].filter((t) => t && !t.sinCandado).length;
      if (ganadores !== 1) return `ganaron ${ganadores}`;
      if (db.fila.generating_kind !== (a ? "ltr" : "str")) return `kind persistido ${db.fila.generating_kind}`;
      return null;
    },
  },
  {
    nombre: "(c) candado vencido (>10 min) → la toma gana; candado vivo (9 min) → no",
    check: async () => {
      const ahora = new Date();
      const vencido = stubDb({ generating_since: new Date(ahora.getTime() - min(CANDADO_TTL_MIN + 1)).toISOString(), generating_kind: "ltr" });
      const t1 = await tomarCandado("x", "ltr", vencido, ahora);
      if (!t1 || t1.sinCandado) return "vencido: no ganó";
      const vivo = stubDb({ generating_since: new Date(ahora.getTime() - min(CANDADO_TTL_MIN - 1)).toISOString(), generating_kind: "ltr" });
      const t2 = await tomarCandado("x", "ltr", vivo, ahora);
      if (t2) return "vivo: ganó y no debía";
      return null;
    },
  },
  {
    nombre: "soltarCandado solo suelta con la marca propia; conCandado suelta en finally aunque fn lance",
    check: async () => {
      const db = stubDb({ generating_since: null, generating_kind: null });
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
