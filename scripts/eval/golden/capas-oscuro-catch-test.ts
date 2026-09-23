// ─────────────────────────────────────────────────────────────────────────────
// TIER CAPAS-OSCURO (23-sep-2026) · en oscuro cada capa que sube es un escalón más clara.
// Aprobado sobre capturas: docs/wireframes/rediseno-informe/shots-capas/*-par.png.
//
// En oscuro la sombra casi no se ve y las capas no se separaban: la hoja grande era del mismo color
// que el informe de atrás (ΔL* 0,0) y la hoja chica del mismo que la grande (1,0). La separación
// la da ahora la superficie, con los tokens del informe y sin colores nuevos:
//   página --page → hoja grande --card → hoja chica --sunk → popover --line-sunk,
// más un velo más fuerte y un borde fino arriba de cada hoja. Fija, sobre el CSS real:
//   1 · LA ESCALERA SUBE: con los valores oscuros de la portada y los velos de TokensShared
//       compuestos encima de lo de atrás, cada capa tiene ΔL* ≥ 4 sobre la de abajo (una diferencia
//       apenas perceptible es 1 a 2). Hoja grande / página, hoja chica / hoja grande velada,
//       popover / panel.
//   2 · SOLO OSCURO: cada regla del bloque va detrás de html:not([data-theme="light"]); el claro
//       no cambia.
//   3 · LA SUBIDA NO SE LEE A SÍ MISMA: los valores de partida se capturan en la hoja (--esc-*) y
//       los hijos redeclaran los crudos y los --doc-* SOLO desde --esc-*. Un `var(--card)` en la
//       regla de los hijos se resolvería en cadena contra el --card redeclarado ahí mismo.
//   4 · EL .doc-tokens DE ADENTRO TAMBIÉN SUBE («.doc-dictamen .doc-tokens» redeclara los crudos con
//       hex literal y bajaría el pop-up entero), y la hoja chica arranca un escalón más arriba.
// Lo que el CSS no dice —que ninguna pieza de adentro quede del color de su contenedor— lo mide la
// sonda viva `capas-oscuro-sonda.ts` contra el dev server.
// Verificado EN ROJO por mutación. Corre solo: node --import tsx scripts/eval/golden/capas-oscuro-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lEstrella = (c: number[]) => {
  const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const y = 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};
const velar = (c: number[], v: number[], a: number) => c.map((x, i) => x * (1 - a) + v[i] * a);

export function runCapasOscuroTier(): { hard: number } {
  console.log("\n─── TIER CAPAS-OSCURO (cada capa un escalón más clara en oscuro · 0 tokens) ───");

  // Los valores oscuros de la paleta del informe (el bloque «.doc-dictamen .doc-tokens» sin tema).
  const P = leer("src/components/analysis/portada/PortadaInforme.tsx");
  const i = P.indexOf(".doc-dictamen,\n      .doc-dictamen.doc-dictamen,\n      .doc-dictamen .doc-tokens{\n        --page:");
  const bloque = i >= 0 ? P.slice(i, P.indexOf("}", i)) : "";
  const tok = (n: string) => (bloque.match(new RegExp(`--${n}:(#[0-9A-Fa-f]{6})`)) ?? [])[1];
  const T = { page: tok("page"), card: tok("card"), sunk: tok("sunk"), lineSunk: tok("line-sunk"), line2: tok("line2") };
  if (Object.values(T).some((v) => !v)) F(`0 · no se leyeron los tokens oscuros de la portada (${JSON.stringify(T)})`);

  // El bloque de las capas en TokensShared.
  const S = leer("src/components/analysis/shared/TokensShared.tsx");
  const a = S.indexOf("── LAS CAPAS EN OSCURO");
  const b = a >= 0 ? S.indexOf("\n      .", S.indexOf("v-pop::before", a)) : -1;
  const C = a >= 0 ? S.slice(S.indexOf("*/", a) + 2, b > a ? b : undefined) : "";
  if (!C.trim()) F("0 · no se encontró el bloque de las capas en oscuro en TokensShared");
  const regla = (sel: RegExp) => (C.match(new RegExp(sel.source + "\\{([^}]*)\\}")) ?? [])[1] ?? "";
  const alfa = (sel: RegExp) => Number((regla(sel).match(/background:rgba\(12,12,14,([.\d]+)\)/) ?? [])[1]);

  // ── 2 · solo oscuro ──
  const selectores = [...C.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).flatMap((s) => s.split(",").map((x) => x.trim())).filter(Boolean);
  if (selectores.length < 8) F(`2 · el bloque tiene ${selectores.length} selectores, se esperaban al menos 8`);
  for (const s of selectores) if (!s.startsWith('html:not([data-theme="light"])')) F(`2 · «${s}» no va detrás de html:not([data-theme="light"]): tocaría el claro`);

  // ── 3 · la subida se captura en la hoja y se declara en los hijos, solo desde --esc-* ──
  const hoja = regla(/html:not\(\[data-theme="light"\]\) \.v-modal-overlay\[role="dialog"\] \.v-modal/);
  if (!/--esc-1:var\(--card\); --esc-2:var\(--sunk\); --esc-3:var\(--line-sunk\);/.test(hoja)) F("3 · la hoja grande no captura la escalera de partida (--esc-1 card, --esc-2 sunk, --esc-3 line-sunk)");
  if (!/background:var\(--esc-1\)/.test(hoja) || !/border-top:1px solid var\(--line2\)/.test(hoja)) F("3 · la hoja grande no pinta --esc-1 o no lleva el borde fino arriba");
  const hijos = regla(/html:not\(\[data-theme="light"\]\) \.v-modal-overlay\[role="dialog"\] \.v-modal > \*,\s*html:not\(\[data-theme="light"\]\) \.v-modal-overlay\[role="dialog"\] \.v-modal \.doc-tokens/);
  if (!hijos) F("4 · la subida no cubre a la vez a los hijos de la hoja y a su .doc-tokens");
  for (const [k, v] of [["page", 1], ["card", 2], ["sunk", 3], ["doc-paper", 1], ["doc-paper2", 2], ["doc-paper3", 3], ["doc-inset-0", 1], ["doc-inset-1", 2], ["doc-inset-2", 3]] as const)
    if (!new RegExp(`--${k}:var\\(--esc-${v}\\)`).test(hijos)) F(`3 · los hijos no suben --${k} a --esc-${v}`);
  if (/var\(--(?!esc-)[a-z-]+\)/.test(hijos)) F("3 · la subida lee un token que ella misma redeclara (solo puede leer --esc-*): se resolvería en cadena");

  // ── 4 · la hoja chica arranca un escalón más arriba ──
  const glosa = regla(/html:not\(\[data-theme="light"\]\) \.v-modal-overlay\[role="dialog"\] \.v-modal\.v-glosa/);
  if (!/--esc-1:var\(--sunk\);/.test(glosa)) F("4 · la hoja chica no arranca en --sunk (un escalón sobre la grande)");
  const pop = regla(/html:not\(\[data-theme="light"\]\) \.v-pop/);
  if (!/background:var\(--line-sunk\)/.test(pop)) F("4 · el popover no pinta --line-sunk");

  // ── 1 · la escalera sube, con los velos compuestos ──
  if (T.page && T.card && T.sunk && T.lineSunk && T.line2) {
    const V = rgb("#0C0C0E");
    const aGrande = alfa(/html:not\(\[data-theme="light"\]\) \.v-modal-overlay\[role="dialog"\]/);
    const aChica = alfa(/html:not\(\[data-theme="light"\]\) \.v-modal-overlay\.v-glosa-overlay\[role="dialog"\]/);
    if (!(aGrande > 0.72)) F(`1 · el velo de la hoja grande no es más fuerte que el de antes (0,72): ${aGrande}`);
    if (!(aChica > 0 && aChica < aGrande)) F(`1 · el velo de la hoja chica no es más liviano que el de la grande: ${aChica}`);
    const pares: Array<[string, number[], number[]]> = [
      ["hoja grande / página velada", rgb(T.card), velar(rgb(T.page), V, aGrande)],
      ["hoja grande / sección --card velada", rgb(T.card), velar(rgb(T.card), V, aGrande)],
      ["hoja chica / hoja grande velada", rgb(T.sunk), velar(rgb(T.card), V, aChica)],
      ["popover / panel", rgb(T.lineSunk), rgb(T.card)],
      ["borde / hoja grande", rgb(T.line2), rgb(T.card)],
    ];
    for (const [k, arriba, abajo] of pares) {
      const d = lEstrella(arriba) - lEstrella(abajo);
      if (!(d >= 4)) F(`1 · ${k}: ΔL* ${d.toFixed(1)} (mínimo 4, y la de arriba tiene que ser la más clara)`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ CAPAS-OSCURO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — en oscuro la escalera sube con ΔL* ≥ 4 en cada escalón (velos compuestos), todo detrás de oscuro, la subida se captura en la hoja y se declara en los hijos sin leerse a sí misma, el .doc-tokens sube, la hoja chica arranca en --sunk y el popover en --line-sunk");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCapasOscuroTier();
  process.exit(hard ? 1 : 0);
}
