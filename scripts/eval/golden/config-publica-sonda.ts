// ─────────────────────────────────────────────────────────────────────────────
// SONDA VIVA · `/api/config` contra un servidor (13-oct-2026). La clave pública (`tasa_hipotecaria`) responde 200
// con una tasa plausible; las internas que existen en la tabla (`backfill_toctoc_checkpoint`, `uf_value`), una que
// no existe, ninguna y la pública con otra caja responden 404 con EL MISMO cuerpo. Nunca imprime el valor de una
// clave interna: solo el código y el largo del cuerpo.
// Sale con 1 si algo falla y con 2 si no pudo hablar con el servidor. Solo GET.
// Uso: node --import tsx scripts/eval/golden/config-publica-sonda.ts [--base https://refranco.ai]
// ─────────────────────────────────────────────────────────────────────────────
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = (arg("--base") ?? "https://refranco.ai").replace(/\/$/, "");

async function pedir(query: string): Promise<{ status: number; texto: string }> {
  const r = await fetch(`${BASE}/api/config${query}`, { headers: { "cache-control": "no-cache" }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  return { status: r.status, texto: await r.text() };
}

async function main() {
  const fallas: string[] = [];
  let publica;
  try {
    publica = await pedir("?key=tasa_hipotecaria");
  } catch (e) {
    console.log(`✗ NO CORRIÓ — ${BASE} no respondió (${e instanceof Error ? e.message : String(e)})`);
    process.exit(2);
  }
  let tasa = NaN;
  try { tasa = Number(JSON.parse(publica.texto).value); } catch { /* no es JSON */ }
  console.log(`  · tasa_hipotecaria → ${publica.status}, tasa ${tasa}`);
  if (publica.status !== 200 || !(tasa > 2 && tasa < 10)) fallas.push(`la clave pública no responde 200 con una tasa plausible (${publica.status}, ${tasa})`);

  const fuera: Array<[string, string]> = [
    ["backfill_toctoc_checkpoint (interna, existe)", "?key=backfill_toctoc_checkpoint"],
    ["uf_value (interna, existe)", "?key=uf_value"],
    ["una que no existe", `?key=sonda_no_existe_${Date.now()}`],
    ["sin clave", ""],
    ["TASA_HIPOTECARIA (otra caja)", "?key=TASA_HIPOTECARIA"],
  ];
  const cuerpos = new Set<string>();
  for (const [nombre, q] of fuera) {
    const r = await pedir(q);
    cuerpos.add(r.texto);
    console.log(`  · ${nombre} → ${r.status}, cuerpo de ${r.texto.length} caracteres`);
    if (r.status !== 404) fallas.push(`${nombre} responde ${r.status}, no 404`);
  }
  if (cuerpos.size !== 1) fallas.push(`el 404 no es el mismo para todas las claves fuera de la lista (${cuerpos.size} cuerpos distintos)`);

  console.log(`─── SONDA CONFIG-PUBLICA · ${BASE} ───`);
  if (fallas.length) {
    for (const f of fallas) console.log(`  ✗ ${f}`);
    console.log(`  ✗ ROJO — ${fallas.length} falla(s)`);
    process.exit(1);
  }
  console.log("  ✓ VERDE — solo la tasa responde; las internas, una inexistente, sin clave y otra caja reciben el mismo 404");
}

main().catch((e) => { console.log(`✗ NO CORRIÓ — ${e instanceof Error ? e.message : String(e)}`); process.exit(2); });
