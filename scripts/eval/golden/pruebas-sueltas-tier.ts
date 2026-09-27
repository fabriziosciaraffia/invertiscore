// ============================================================================
// GOLDEN · PRUEBAS SUELTAS EN EL RUNNER (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// `scripts/test-linea-consumo.ts` y `scripts/test-draft-scope.ts` son pruebas con su propio arnés
// (node:assert + process.exit). Ninguna corría en el golden, y las dos estaban en ROJO en master
// sin que nadie lo viera: la primera desde el cap anónimo (F2-2), la segunda desde que el formato
// del borrador subió a v6 (19-ago-2026) y la primera pantalla pasó a ser `dir`. Es el caso de
// CLAUDE.md § Testing: «un guard que no corre en el runner se pudre».
//
// Este tier las corre como proceso aparte —el mismo comando que se escribe a mano— y exige que
// salgan con 0. No re-implementa nada de lo que miden: si una se rompe, el QUICK se pone rojo y
// muestra su salida.
//
// Para sumar otra prueba suelta: agregarla a PRUEBAS, verificar que corre verde sola y que una
// mutación de lo que mide la pone roja ACÁ.
// Solo:  node --import tsx scripts/eval/golden/pruebas-sueltas-tier.ts
// ============================================================================
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");

/** Las pruebas sueltas que el runner exige verdes, con lo que miden. */
export const PRUEBAS: ReadonlyArray<{ script: string; mide: string }> = [
  { script: "scripts/test-linea-consumo.ts", mide: "la línea de consumo bajo el botón final, por tier (sin «crédito», el invitado por su cap)" },
  { script: "scripts/test-draft-scope.ts", mide: "el borrador del wizard por dueño y pestaña: aislamiento, adopción al registrarse, purga, «Empezar de cero», «Retomar» y el banner" },
];

export function runPruebasSueltasTier(): { hard: number } {
  console.log("\n─── TIER PRUEBAS-SUELTAS (las pruebas con arnés propio corren en el QUICK · 0 tokens) ───");
  const fallas: string[] = [];
  for (const p of PRUEBAS) {
    const r = spawnSync(process.execPath, ["--import", "tsx", p.script], { cwd: RAIZ, encoding: "utf8", timeout: 120_000 });
    if (r.status !== 0) {
      const fallidos = (r.stdout ?? "").split("\n").filter((l) => /^\s+(FAIL|·)/.test(l)).slice(0, 8).map((l) => l.trim());
      fallas.push(`${p.script} salió con ${r.status ?? r.signal}: ${fallidos.join(" | ") || (r.stderr ?? "").trim().slice(-200)}`);
    }
  }
  if (fallas.length) {
    console.log(`  ✗ PRUEBAS-SUELTAS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${PRUEBAS.length} pruebas sueltas en verde: ${PRUEBAS.map((p) => p.script.split("/").pop()).join(", ")}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runPruebasSueltasTier().hard ? 1 : 0);
}
