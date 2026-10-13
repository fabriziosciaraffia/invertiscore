// ─────────────────────────────────────────────────────────────────────────────
// Tier CONFIG-PUBLICA (13-oct-2026, 0 tokens) — `/api/config` sirve solo una lista cerrada de claves públicas.
//
//   1 · LA LISTA CERRADA: la clave de la lista responde 200 con su valor (o el de respaldo); cualquier otra —las
//       internas que SÍ existen en la tabla (`backfill_toctoc_checkpoint`, `uf_value`), una que no existe, ninguna,
//       una con otra caja o un espacio— responde 404 con EL MISMO cuerpo, sin nombrar la clave y SIN consultar la
//       base (el lector falso cuenta las llamadas).
//   2 · LA LISTA ES LA DEL NAVEGADOR: las claves que el código de `src/` pide por `/api/config?key=` son exactamente
//       las de la lista (si el navegador empieza a leer otra, la lista se amplía a propósito; si deja de leer una,
//       sale). Una clave armada en tiempo de ejecución no se puede auditar: ROJO.
//   3 · LA RUTA DELEGA: el GET pasa por `respuestaConfig` con `getConfig` y no lee la tabla por su cuenta.
//   4 · EL RESPALDO de la tasa es la referencia del motor (`MARKET_AVG_TASA_UF`).
// La medida en vivo es `config-publica-sonda.ts` (contra un servidor: refranco.ai o `next dev`).
//
// ACTA (13-oct-2026). En la tabla hay tres claves —`backfill_toctoc_checkpoint` (estado interno del backfill, un
// JSON de 579 caracteres), `tasa_hipotecaria` y `uf_value`— y el navegador lee UNA por este endpoint: la tasa, desde
// el wizard (la UF va por `/api/uf`). 10/10 mutaciones en ROJO: M1 la ruta vieja · M2 la lista acepta cualquier clave
// · M3 se lee la base antes de mirar la lista · M4 el 404 nombra la clave · M5 `uf_value` en la lista · M6 la lista
// sin mayúsculas ni espacios · M7 el navegador pide otra clave · M8 una clave armada en ejecución · M9 el respaldo de
// la tasa separado del motor · M10 la ruta lee la tabla aparte. La sonda contra `next dev`: VERDE con la ruta nueva,
// ROJO con la vieja (200 para las internas y para una que no existe, 400 sin clave: cinco cuerpos distintos).
// Solo:  node --import tsx scripts/eval/golden/config-publica-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as CP from "../../../src/lib/config-publica";
import { MARKET_AVG_TASA_UF } from "../../../src/lib/financing-health";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(ts|tsx|js|jsx)$/.test(n)) out.push(rel);
  }
  return out;
}

/** La tabla como está en producción (13-oct-2026): dos claves internas y la pública. */
const TABLA: Record<string, { value: string; updated_at: string }> = {
  tasa_hipotecaria: { value: "4.32", updated_at: "2026-10-13T10:00:43Z" },
  uf_value: { value: "39512", updated_at: "2026-10-13T10:00:47Z" },
  backfill_toctoc_checkpoint: { value: '{"pagina":12,"usuario":"x"}', updated_at: "2026-10-13T03:03:17Z" },
};

export async function runConfigPublicaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CONFIG-PUBLICA (/api/config sirve solo la lista cerrada · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la lista cerrada ─────────────────────────────────────────────────────
  const pedidas: string[] = [];
  const lector: CP.LectorConfig = async (k) => { pedidas.push(k); return TABLA[k] ?? null; };
  const ok = await CP.respuestaConfig("tasa_hipotecaria", lector);
  if (ok.status !== 200 || (ok.body as { value?: string }).value !== "4.32" || (ok.body as { updated_at?: string }).updated_at !== TABLA.tasa_hipotecaria.updated_at)
    F(`1 · la clave pública no responde 200 con su valor y su fecha (${ok.status} ${JSON.stringify(ok.body)})`);
  const sinFila = await CP.respuestaConfig("tasa_hipotecaria", async () => null);
  if (sinFila.status !== 200 || (sinFila.body as { value?: string }).value !== CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria) F("1 · sin la fila, la clave pública no cae a su valor de respaldo");
  pedidas.length = 0;
  const fuera: Array<string | null> = ["backfill_toctoc_checkpoint", "uf_value", "no_existe_xyz", null, "", "TASA_HIPOTECARIA", "tasa_hipotecaria ", "constructor", "__proto__", "toString"];
  const cuerpos = new Set<string>();
  for (const k of fuera) {
    const r = await CP.respuestaConfig(k, lector);
    const cuerpo = JSON.stringify(r.body);
    cuerpos.add(cuerpo);
    if (r.status !== 404) F(`1 · la clave ${JSON.stringify(k)} responde ${r.status}, no 404${k && TABLA[k] ? " (es interna y existe en la tabla)" : ""}`);
    if (k && k.length > 2 && cuerpo.includes(k.trim())) F(`1 · el 404 de ${JSON.stringify(k)} nombra la clave`);
  }
  if (cuerpos.size !== 1) F(`1 · el 404 no es el mismo para todas las claves fuera de la lista (${cuerpos.size} cuerpos distintos: revela cuáles existen)`);
  if (pedidas.length) F(`1 · se consulta la base con claves fuera de la lista (${pedidas.join(", ")}): el tiempo de respuesta revela si existen`);

  // ── 2 · la lista es exactamente la del navegador ─────────────────────────────
  const fuentes = archivos("src").filter((p) => !p.startsWith("src/app/api/config/"));
  const leidas = new Set<string>();
  let dinamicas = 0;
  for (const p of fuentes) {
    const s = sinComentarios(leer(p));
    for (const m of s.matchAll(/\/api\/config\?key=([A-Za-z0-9_]*)/g)) {
      if (m[1]) leidas.add(m[1]);
      else { dinamicas++; F(`2 · ${p} pide /api/config con una clave armada en ejecución: no se puede auditar contra la lista`); }
    }
  }
  if (!leidas.size && !dinamicas) F("2 · el censo no encontró ningún lector de /api/config (¿corrió?)");
  const lista = new Set<string>(CP.CLAVES_CONFIG_PUBLICAS);
  for (const k of leidas) if (!lista.has(k)) F(`2 · el navegador pide «${k}», que no está en la lista: recibirá 404`);
  for (const k of lista) if (!leidas.has(k)) F(`2 · la lista sirve «${k}» y ningún código la pide: sobra en la lista pública`);

  // ── 3 · la ruta delega en la lista ───────────────────────────────────────────
  const ruta = sinComentarios(leer("src/app/api/config/route.ts"));
  if (!/const r = await respuestaConfig\(key, getConfig\);\s*return NextResponse\.json\(r\.body, \{ status: r\.status \}\);/.test(ruta)) F("3 · el GET de /api/config no pasa por la lista cerrada");
  if (/from\(["']config["']\)|supabase|getConfig\((?!\))/i.test(ruta.replace(/respuestaConfig\(key, getConfig\)/, "")) || (ruta.match(/getConfig/g) ?? []).length !== 2) F("3 · la ruta lee la tabla por su cuenta, fuera de la lista");
  if (/export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(ruta)) F("3 · /api/config expone otro método además de GET");

  // ── 4 · el respaldo de la tasa es la referencia del motor ────────────────────
  if (Number(CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria) !== MARKET_AVG_TASA_UF) F(`4 · el respaldo de la tasa (${CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria}) no es la referencia del motor (${MARKET_AVG_TASA_UF}): el wizard prellenaría una tasa y el motor juzgaría contra otra`);

  if (fallas.length) {
    console.log(`  ✗ CONFIG-PUBLICA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — /api/config sirve solo ${[...lista].join(", ")} (lo que pide el navegador); toda otra clave, exista o no, recibe el mismo 404 sin consultar la base; el respaldo de la tasa es la referencia del motor`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runConfigPublicaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
