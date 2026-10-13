// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · la tabla `config` leída DIRECTO en Supabase con la anon key —la que va en el código del
// navegador— (13-oct-2026). Con la anon key solo se ve `tasa_hipotecaria`: pedir otra clave (las internas que
// existen, `backfill_toctoc_checkpoint` y `uf_value`) devuelve VACÍO, y pedir la tabla entera devuelve una fila.
// Solo GET; nunca imprime la anon key ni el valor de una clave interna (pide solo la columna `key`).
// Sale con 1 si algo falla y con 2 si no pudo hablar con Supabase o faltan las variables.
// ACTA (13-oct-2026). ROJO antes de la migración 20261013_config_lectura_solo_tasa (14:06:15 UTC: la anon key veía
// las tres claves; el checkpoint y la UF, una fila cada una) y VERDE después (14:06:47 UTC: la tabla entera, una
// fila; las internas y una inexistente, vacío; la tasa, una fila). El service role siguió leyendo las tres.
// Uso: node --env-file=.env.local --import tsx scripts/eval/golden/config-rls-sonda.ts
// ─────────────────────────────────────────────────────────────────────────────
import { CLAVES_CONFIG_PUBLICAS } from "../../../src/lib/config-publica";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function pedir(query: string): Promise<{ status: number; filas: Array<{ key: string }> | null }> {
  const r = await fetch(`${URL_SB}/rest/v1/config?${query}`, {
    headers: { apikey: ANON!, Authorization: `Bearer ${ANON}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await r.text();
  let filas: Array<{ key: string }> | null = null;
  try { const j = JSON.parse(texto); if (Array.isArray(j)) filas = j; } catch { /* no es JSON */ }
  return { status: r.status, filas };
}

async function main() {
  if (!URL_SB || !ANON) { console.log("✗ NO CORRIÓ — faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY (correr con --env-file=.env.local)"); process.exit(2); }
  const fallas: string[] = [];
  let todas;
  try { todas = await pedir("select=key"); } catch (e) { console.log(`✗ NO CORRIÓ — Supabase no respondió (${e instanceof Error ? e.message : String(e)})`); process.exit(2); }
  const vistas = (todas.filas ?? []).map((f) => f.key).sort();
  console.log(`  · la tabla entera con la anon key → ${todas.status}, ${vistas.length} fila(s): ${vistas.join(", ") || "ninguna"}`);
  const publicas = [...CLAVES_CONFIG_PUBLICAS].sort();
  if (todas.status !== 200 || vistas.join() !== publicas.join()) fallas.push(`con la anon key se ven ${vistas.length} claves (${vistas.join(", ")}); deberían verse solo ${publicas.join(", ")}`);

  for (const k of ["backfill_toctoc_checkpoint", "uf_value", `sonda_no_existe_${Date.now()}`]) {
    const r = await pedir(`select=key&key=eq.${encodeURIComponent(k)}`);
    console.log(`  · ${k} con la anon key → ${r.status}, ${r.filas?.length ?? "?"} fila(s)`);
    if (r.status !== 200 || r.filas === null || r.filas.length !== 0) fallas.push(`pedir «${k}» con la anon key no devuelve vacío (${r.status}, ${r.filas?.length ?? "?"} filas)`);
  }
  for (const k of publicas) {
    const r = await pedir(`select=key&key=eq.${encodeURIComponent(k)}`);
    console.log(`  · ${k} con la anon key → ${r.status}, ${r.filas?.length ?? "?"} fila(s)`);
    if (r.status !== 200 || r.filas?.length !== 1) fallas.push(`la clave pública «${k}» no se puede leer con la anon key (${r.status}): /api/config caería al respaldo`);
  }

  console.log("─── SONDA CONFIG-RLS (anon key, directo a Supabase) ───");
  if (fallas.length) {
    for (const f of fallas) console.log(`  ✗ ${f}`);
    console.log(`  ✗ ROJO — ${fallas.length} falla(s)`);
    process.exit(1);
  }
  console.log(`  ✓ VERDE — con la anon key solo se ve ${publicas.join(", ")}; cualquier otra clave devuelve vacío`);
}

main().catch((e) => { console.log(`✗ NO CORRIÓ — ${e instanceof Error ? e.message : String(e)}`); process.exit(2); });
