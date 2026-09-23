/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER FINDING-DISPLAY-LEGACY (23-sep-2026) · la card de un hallazgo GUARDADO no revienta.
//
// El 23-sep-2026 master se rompió: `findingDisplay` pasó a leer `valor.sujetoPct` del hallazgo
// `cap_rate` sin mirar, y los hallazgos guardados antes del 21-sep no traen ese campo. El build
// cayó en el prerender de /dev/finding-card (TypeError: reading 'toFixed'), y en producción el
// mismo camino lo toman el anexo, el PDF STR y la card de hallazgos con filas viejas. Ni `tsc`
// (el tipo dice number) ni `next lint` lo ven: es un error de EJECUCIÓN. Fija:
//   1 · UN HALLAZGO cap_rate EN FORMATO VIEJO (sin `sujetoPct` ni `base`) se muestra con la cifra
//       que comparaba (`capRatePct`), sin «bruto», y nada dice «undefined» ni «NaN».
//   2 · EL FORMATO ACTUAL dice «Cap rate bruto» con `sujetoPct`.
//   3 · TODOS LOS HALLAZGOS GUARDADOS de los fixtures del repo (la página dev y los fixtures de
//       drawers-pixel, filas reales de distintas fechas) pasan por `findingDisplay` sin tirar.
//   4 · El capítulo I cae a `capRatePct` cuando falta `sujetoPct`, y la página dev conserva el
//       formato viejo (así `next build` ejercita el camino en cada deploy).
// Verificado EN ROJO con la versión rota de 64b6e1ca. Corre solo:
//   node --import tsx scripts/eval/golden/finding-display-legacy-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { findingDisplay } from "../../../src/components/analysis/GenericFindingCard";

(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const roto = (d: any) => /undefined|NaN/.test(JSON.stringify(d));

const probar = (h: any, lugar: string): any => {
  try {
    const d = findingDisplay(h, "CLP", 39000);
    if (roto(d)) F(`${lugar} (${h.id}): la card dice «undefined» o «NaN»: ${JSON.stringify(d).slice(0, 160)}`);
    return d;
  } catch (e) {
    F(`${lugar} (${h.id}): findingDisplay tira ${(e as Error).message}`);
    return null;
  }
};

export function runFindingDisplayLegacyTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n─── TIER FINDING-DISPLAY-LEGACY (la card de un hallazgo guardado no revienta · 0 tokens) ───");

  // 1 · formato viejo (el de /dev/finding-card, igual a las filas anteriores al 21-sep)
  const viejo = {
    id: "cap_rate", tipo: "rentabilidad_operativa",
    valor: { capRatePct: 1.98, capRefPct: 4, gapPts: -2, banda: 2, fuente: "promedio nacional", scope: "nacional", modalidad: "ltr" },
    direccion: "adverso", decisividad: 0.88, magnitudContinua: 0.88, procedencia: { base: "x", confianza: "baja" }, fraseCanonica: "Tu CAP rate es 2,0%.",
  };
  const dv = probar(viejo, "1 · formato viejo");
  if (dv && (dv.kpi !== "2,0%" || dv.kick !== "Cap rate" || /bruto/.test(dv.ksub))) F(`1 · el formato viejo no se muestra con la cifra que comparaba (${dv.kick} ${dv.kpi} · ${dv.ksub})`);

  // 2 · formato actual
  const actual = { ...viejo, valor: { ...viejo.valor, capRatePct: 2.5, sujetoPct: 4.3, capRefPct: 5, gapPts: -0.7, base: "bruta", nivel: "nacional" } };
  const da = probar(actual, "2 · formato actual");
  if (da && (da.kpi !== "4,3%" || da.kick !== "Cap rate bruto" || !/cap rate bruto 4,3%/.test(da.ksub))) F(`2 · el formato actual no dice el bruto (${da.kick} ${da.kpi} · ${da.ksub})`);

  // 3 · todos los hallazgos guardados de los fixtures del repo
  let n = 0;
  const dev = leer("src/app/dev/finding-card/page.tsx");
  const fx = JSON.parse(leer("src/app/dev/drawers-pixel/fixtures.json")) as Record<string, any>;
  for (const [clave, f] of Object.entries(fx)) {
    for (const h of (f?.results?.hallazgos ?? []) as any[]) { probar(h, `3 · fixtures.json ${clave}`); n++; }
    const hc = f?.results?.metrics?.hallazgoCapRate;
    if (hc) { probar(hc, `3 · fixtures.json ${clave} metrics`); n++; }
  }
  if (n < 20) F(`3 · PISO · solo ${n} hallazgos guardados medidos: el fixture ya no cubre`);

  // 4 · el capítulo I y la página dev
  const cap = leer("src/components/analysis/CapitulosInversion.tsx");
  if (!/sujetoPct: capRate\.valor\.sujetoPct \?\? capRate\.valor\.capRatePct/.test(cap)) F("4 · el capítulo I no cae a capRatePct sin sujetoPct");
  const bloqueDev = dev.slice(dev.indexOf('id: "cap_rate"'), dev.indexOf("fraseCanonica", dev.indexOf('id: "cap_rate"')));
  if (!bloqueDev || /sujetoPct/.test(bloqueDev)) F("4 · la página dev ya no conserva el formato viejo: el build deja de ejercitar el camino");

  if (fallas.length) {
    console.log(`  ✗ FINDING-DISPLAY-LEGACY · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — el cap_rate en formato viejo se muestra con su cifra, el actual dice el bruto, y ${n} hallazgos guardados de los fixtures pasan por findingDisplay sin tirar ni decir «undefined»`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFindingDisplayLegacyTier();
  process.exit(hard ? 1 : 0);
}
