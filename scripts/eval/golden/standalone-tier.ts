// ============================================================================
// GOLDEN · los catch-tests standalone, adentro del gate (17-sep-2026). 0 tokens.
// ============================================================================
// EL PROBLEMA QUE CIERRA. 28 catch-tests de esta carpeta corrían SOLO si alguien
// tipeaba el comando. Ninguno mentía en su cabecera —todos declaran ser standalone—
// pero nueve estaban EN ROJO cuando se los corrió el 17-sep, y uno de ellos,
// `zona-catch-test.ts`, llevaba 14 días protegiendo una regla que el repo derogó a
// propósito el 03-sep (`b822cf1b`).
//
// Ese es el costo real de un guard fuera del gate: no es solo que deja de cazar, es
// que su rojo DEJA DE SER LEGIBLE. Cuando lo encontrás en rojo no sabés si el producto
// se rompió o si la regla se derogó, y averiguarlo cuesta una sesión.
//
// POR QUÉ SE LOS LANZA COMO PROCESO Y NO SE LOS REFACTORIZA. Los 28 corren todo en
// top-level y terminan con `process.exit()`: importarlos mataría al runner. Convertir
// cada uno en `export function runXTier()` son 28 refactors sobre guards que hoy pasan
// —o sea 28 oportunidades de romper algo que funciona— y no hacía falta: lanzarlos en
// PARALELO cuesta el más lento (~0,4 s), no la suma. El golden pasa de 5,0 s a ~5,5 s.
//
// Cuando la etapa 1 de la meta-validación traiga la costura compartida (README, §
// «Meta-validación: qué cubre y qué no»), estos pasan a exportar tier como el resto y
// este archivo se retira. Hasta entonces, corren.
// ============================================================================
import { spawn } from "node:child_process";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");

/**
 * LOS QUE ENTRAN: los que no tocan Supabase, o sea los que cuestan ~0,3 s de puro
 * arranque de proceso. Cronometrados uno por uno el 17-sep-2026.
 *
 * ⛔ LOS QUE NO ENTRAN, Y POR QUÉ — la lista es tan importante como la de arriba:
 *
 *  · LOS QUE RECOMPUTAN EL PARQUE (13): `decisividad-str` 3,9 s · `precios-nombre` 3,6 ·
 *    `ocupacion-vs-estimacion` 3,5 · `frase-estructural-str` 3,3 · `simulacion` 3,0 ·
 *    `str-congelado` 2,7 · `valor-mercado` 2,5 · `vias` 2,3 · `guards-v16-dump` 1,7 ·
 *    `guards-contables` 1,6 · `zona` 1,6 · `gate-sobreprecio` 0,9 · `mes-cierra-str` 0,7.
 *    Suman ~25 s: sextuplicarían el golden, y un golden lento no lo corre nadie — que es
 *    volver al mismo lugar por otra puerta.
 *
 *    ⚠ DOS RAZONES DISTINTAS, y conviene no confundirlas: la mayoría está afuera por el
 *    TIEMPO **y** porque fijaban cifras de filas vivas (la regla «un catch-test fija la
 *    REGLA, no la cifra», CLAUDE.md § Testing). Al 17-sep cuatro ya no fijan cifras
 *    —`vias`, `precios-nombre`, `frase-estructural-str` y `decisividad-str`, reescritos—,
 *    así que a esos solo los frena el reloj: `decisividad-str` cuesta 3,9 s él solo y
 *    entrar lo llevaría de ~8,6 s a ~12,5 s. Es una decisión de presupuesto de corrida,
 *    no de calidad del guard, y está sin tomar a propósito.
 *
 *  · `jerarquia-catch-test.ts` — ROJO por un bug VIVO de producto: el arbitraje de precios
 *    detecta la colisión y escribe en cinco campos muertos en v22. Está anotado en el
 *    jsdoc de `piezasDeAiLtr` y va en su propio goal. Cablearlo ahora pondría el golden en
 *    rojo permanente por algo que este goal no arregla.
 */
const STANDALONE = [
  "ambitos-zona",
  "dia1",
  "engineism-str",
  "estructural-str",
  "fecha-santiago",
  "hero-claim-str",
  "marcas",
  "mediacion-cards",
  "modalidad-str",
  "palabras-internas-str",
  "referencias-zona",
  "voseo",
];

function correr(nombre: string): Promise<{ nombre: string; ok: boolean; salida: string }> {
  return new Promise((res) => {
    const p = spawn(
      process.execPath,
      ["--import", "tsx", join(RAIZ, "scripts", "eval", "golden", `${nombre}-catch-test.ts`)],
      { cwd: RAIZ, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    p.stdout.on("data", (d) => { out += String(d); });
    p.stderr.on("data", (d) => { out += String(d); });
    p.on("close", (code) => res({ nombre, ok: code === 0, salida: out }));
    p.on("error", (e) => res({ nombre, ok: false, salida: `no se pudo lanzar: ${e.message}` }));
  });
}

export async function runStandaloneTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER STANDALONE (los catch-tests que corrían solo a mano · 0 tokens) ───");
  // En paralelo: el costo es el más lento, no la suma.
  const rs = await Promise.all(STANDALONE.map(correr));
  const rotos = rs.filter((r) => !r.ok);
  if (rotos.length === 0) {
    console.log(`  ✓ VERDE — ${rs.length} catch-tests que hasta hoy solo corrían si alguien los tipeaba`);
    return { hard: 0 };
  }
  for (const r of rotos) {
    console.log(`  ✗ ${r.nombre}`);
    // Solo las líneas de falla: la salida completa de doce procesos tapa el resumen.
    for (const l of r.salida.split("\n").filter((l) => /✗|Error/.test(l)).slice(0, 6)) {
      console.log(`      ${l.trim().slice(0, 140)}`);
    }
  }
  return { hard: rotos.length };
}

if (require.main === module) {
  runStandaloneTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
