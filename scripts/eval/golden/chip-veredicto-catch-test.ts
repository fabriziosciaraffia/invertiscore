/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL CHIP DE VEREDICTO ES UNO SOLO — catch-test (25-sep-2026). 0 tokens, sin base.
// ============================================================================
// Decisión de Fabrizio: todo chip que nombra un veredicto en el informe WEB sale de
// `ChipVeredicto` (src/components/analysis/shared/ChipVeredicto.tsx). Antes convivían siete
// estilos: la píldora neutra de la card de Franco, el `Pill` local del capítulo «Cómo lo pagas»,
// el `Pill` `.pjx-v` del pop-up, los dos badges de AMBAS con la paleta vieja tinta/rojo en mono, y
// la columna de la segunda puerta, que imprimía el enum crudo («COMPRAR»).
//
// QUÉ ES «EL INFORME WEB» ACÁ: los componentes del análisis y de la comparativa, y las páginas de
// /analisis y /share/comparativa. FUERA, por decisión explícita: el PDF (`/documento/`, apagado,
// va aparte), el sello de la portada (es el veredicto mismo, no un chip), los diagramas (dials,
// barras, celdas de la matriz) y el texto coloreado.
//
// FIJA:
//   1 · NINGÚN CHIP DE VEREDICTO SE DIBUJA FUERA DEL COMPONENTE. Cada vez que el código escribe la
//       etiqueta o el signo de un veredicto (`etiquetaVeredicto(` / `signoVeredicto(`), el elemento
//       que la envuelve no puede tener forma de chip —clase pill/badge/chip, o estilo con fondo o
//       radio— salvo en la lista de excepciones, cada una con su razón.
//   2 · Nadie imprime el enum crudo de un veredicto como texto (`>{x.veredicto}<`).
//   3 · Los estilos locales que se retiraron no vuelven (`pjx-v`, `rec-pill-neutra`,
//       `MiniVerdictBadge`, el `badgeStyle` del modal de AMBAS).
//   4 · Las seis superficies migradas usan `<ChipVeredicto`, y la card en su variante sobre fondo.
//   5 · El CSS del chip está montado donde se dibuja: `DocTokens` (LTR y STR) y `ChipVeredictoTokens`
//       en AMBAS.
//   6 · El componente mismo: signo y etiqueta de la fuente única, clase por veredicto, variante.
//   7 · EL DASHBOARD (25-sep-2026): entra al alcance y usa el mismo chip —la tabla, las filas
//       agrupadas, «Continuar» y las muestras del onboarding—, con su CSS montado en las tres ramas
//       de la página; su paleta propia (`VERDICT_STYLE`, `VerdictBadge`, `--franco-v-*`) no vuelve,
//       y el color del puntaje es el del chip (`colorDeVeredicto`).
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/chip-veredicto-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ChipVeredicto, colorDeVeredicto, CSS_CHIP_VEREDICTO } from "../../../src/components/analysis/shared/ChipVeredicto";

const CL7: Record<string, string> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };
import { DetalleAlternativaComunas } from "../../../src/components/analysis/shared/DetalleAlternativaComunas";
import { etiquetaVeredicto, signoVeredicto } from "../../../src/lib/veredicto-etiqueta";

(globalThis as any).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sin comentarios: las actas nombran a propósito lo que se retiró, y el guard no puede leerlas
 *  como código (cuarta vez en este arco que una prosa satisface o acusa a un predicado). */
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** El informe web. El PDF (`/documento/`) y las páginas de desarrollo quedan fuera. */
const RAICES = ["src/components/analysis", "src/components/comparativa", "src/app/analisis", "src/app/share/comparativa", "src/app/dashboard"];
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx$/.test(n)) out.push(rel);
  }
  return out;
}
const ALCANCE = RAICES.flatMap(archivos)
  .map((p) => relative(RAIZ, join(RAIZ, p)).split(sep).join("/"))
  .filter((p) => !p.includes("/documento/") && !p.endsWith("/ChipVeredicto.tsx"));

/**
 * EXCEPCIONES, cada una con su razón. Se identifican por archivo + la clase del elemento que
 * envuelve la etiqueta, no por archivo entero: excluir el archivo dejaría pasar un chip nuevo
 * en el mismo archivo.
 */
const EXCEPCIONES: { archivo: string; envoltorio: RegExp; razon: string }[] = [
  { archivo: "src/components/analysis/portada/PortadaInforme.tsx", envoltorio: /doc-hero-pill/, razon: "el sello de la portada es el veredicto mismo, no un chip (decisión de Fabrizio)" },
  // (El filtro por veredicto del archivo del dashboard —`<Chip>` con conteo— es un CONTROL, no un
  // chip de veredicto: filtra la lista. No lleva forma en sus atributos, así que no necesita excepción.)
];

export function runChipVeredictoTier(): { hard: number } {
  console.log("\n─── TIER CHIP-VEREDICTO (un solo chip de veredicto en el informe web · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  if (ALCANCE.length < 50) F(`0 · el alcance leyó ${ALCANCE.length} archivos: el recorrido no encontró el informe`);

  let etiquetasVistas = 0;
  for (const p of ALCANCE) {
    const src = sinComentarios(leer(p));

    // ── 1 · la etiqueta de un veredicto nunca va en un envoltorio con forma de chip ──
    for (const m of src.matchAll(/(?:etiquetaVeredicto|signoVeredicto)\(/g)) {
      etiquetasVistas++;
      // El elemento que la envuelve: la última etiqueta JSX abierta antes de la llamada.
      const antes = src.slice(Math.max(0, (m.index ?? 0) - 600), m.index);
      const aperturas = [...antes.matchAll(/<([a-zA-Z][\w.]*)((?:\s[^<>]*?)?)>/g)];
      const ap = aperturas.at(-1);
      if (!ap) continue;
      const attrs = ap[2] ?? "";
      const forma = /className=\{?[`"'][^`"']*\b(pill|badge|chip|rounded)/.test(attrs) || /style=\{\{[^}]*\b(background|borderRadius)\b/.test(attrs);
      if (!forma) continue;
      const exc = EXCEPCIONES.find((e) => e.archivo === p && e.envoltorio.test(attrs));
      if (exc) continue;
      const linea = src.slice(0, m.index).split("\n").length;
      F(`1 · ${p}:~${linea}: un veredicto se dibuja como chip fuera de ChipVeredicto (<${ap[1]}${attrs.slice(0, 80)}>)`);
    }

    // ── 2 · el enum crudo no se imprime ──
    for (const m of src.matchAll(/>\s*\{\s*[\w.?]*\.veredicto\s*\}\s*</g)) {
      const linea = src.slice(0, m.index).split("\n").length;
      F(`2 · ${p}:~${linea}: imprime el enum crudo del veredicto (${m[0].trim()}); va con <ChipVeredicto>`);
    }

    // ── 3 · lo retirado no vuelve ──
    for (const [re, nombre] of [
      [/\bpjx-v\b/, "la píldora `.pjx-v` del pop-up"],
      [/\brec-pill-neutra\b/, "la píldora neutra `.rec-pill-neutra` de la card"],
      [/\bMiniVerdictBadge\b/, "el `MiniVerdictBadge` de AMBAS"],
      [/\bbadgeStyle\b/, "el `badgeStyle` del modal de AMBAS"],
    ] as const) {
      if (re.test(src)) F(`3 · ${p}: volvió ${nombre}`);
    }
  }
  if (etiquetasVistas === 0) F("0 · ninguna llamada a etiquetaVeredicto/signoVeredicto en el alcance: el guard no midió nada");

  // ── 4 · las seis superficies migradas usan el componente ──
  const USA: [string, RegExp, string][] = [
    ["src/components/analysis/shared/PosicionFranco.tsx", /estado === "con_salida" && <ChipVeredicto v="COMPRAR" variante="sobre-fondo" \/>/, "la card de Franco, en su variante sobre fondo"],
    ["src/components/analysis/shared/PopupAjustes.tsx", /const Pill = \(\{ v \}: \{ v: Veredicto \}\) => <ChipVeredicto v=\{v\} \/>/, "el pop-up de ajustes"],
    ["src/components/analysis/shared/CapituloComoLoPagas.tsx", /<ChipVeredicto v=\{r\.destino/, "el capítulo «Cómo lo pagas»"],
    ["src/components/analysis/shared/DetalleAlternativaComunas.tsx", /<ChipVeredicto v=\{c\.veredicto\} \/>/, "la columna de la segunda puerta"],
    ["src/components/comparativa/HeroComparativa.tsx", /return <ChipVeredicto v=\{verdict as Veredicto\} \/>/, "el veredicto de cada hijo en AMBAS"],
    ["src/components/comparativa/ResumenAnexoModal.tsx", /<ChipVeredicto v=\{v as Veredicto\} \/>/, "el badge del modal de resumen de AMBAS"],
  ];
  for (const [p, re, nombre] of USA) if (!re.test(sinComentarios(leer(p)))) F(`4 · ${nombre} no dibuja su chip con ChipVeredicto (${p})`);

  // ── 5 · el CSS está montado donde se dibuja ──
  const portada = leer("src/components/analysis/portada/PortadaInforme.tsx");
  if (!/export function DocTokens\(\) \{\s*return \(\s*<style dangerouslySetInnerHTML=\{\{ __html: `\$\{CSS_CHIP_VEREDICTO\}/.test(portada)) F("5 · DocTokens no monta el CSS del chip (CSS_CHIP_VEREDICTO): en LTR y STR el chip saldría sin estilo");
  if (!/<ChipVeredictoTokens \/>/.test(sinComentarios(leer("src/components/comparativa/HeroComparativa.tsx")))) F("5 · AMBAS no monta ChipVeredictoTokens: no tiene DocTokens y el chip saldría sin estilo");

  // ── 7 · el dashboard ──
  {
    const arch = sinComentarios(leer("src/app/dashboard/archive.tsx"));
    if ((arch.match(/<ChipVeredicto v=\{veredictoDisplay\(row\)\} \/>/g) ?? []).length < 3) F("7 · el archivo del dashboard no dibuja el veredicto de sus filas con ChipVeredicto (tabla y agrupadas)");
    const cont = sinComentarios(leer("src/app/dashboard/continuar.tsx"));
    if (!/<ChipVeredicto v=\{veredictoDisplay\(hero\)\} \/>/.test(cont) || !/<ChipVeredicto v=\{veredictoDisplay\(row\)\} \/>/.test(cont)) F("7 · «Continuar» no dibuja el veredicto con ChipVeredicto");
    const onb = sinComentarios(leer("src/app/dashboard/onboarding-client.tsx"));
    for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]) if (!onb.includes(`<ChipVeredicto v="${v}" />`)) F(`7 · el onboarding no muestra ${v} con ChipVeredicto`);
    const pag = sinComentarios(leer("src/app/dashboard/page.tsx"));
    if ((pag.match(/<ChipVeredictoTokens \/>/g) ?? []).length < 3) F("7 · la página del dashboard no monta el CSS del chip en sus tres ramas (onboarding, vacía, con análisis)");
    for (const p of ALCANCE.filter((x) => x.startsWith("src/app/dashboard/"))) {
      const s = sinComentarios(leer(p));
      if (/\bVERDICT_STYLE\b|\bVerdictBadge\b|--franco-v-(buy|adjust|avoid)/.test(s)) F(`7 · ${p}: volvió la paleta propia del dashboard para el veredicto`);
    }
    const ui = sinComentarios(leer("src/app/dashboard/dashboard-ui.tsx"));
    if (!/export function colorDelPuntaje\(veredicto: Veredicto\): string \{\s*return colorDeVeredicto\(veredicto\);/.test(ui)) F("7 · el color del puntaje no es el del chip (colorDeVeredicto)");
    for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"] as const) {
      if (colorDeVeredicto(v) !== `var(--chip-v-${CL7[v]})`) F(`7 · colorDeVeredicto(${v}) es ${colorDeVeredicto(v)}, no la variable del chip`);
    }
    if (!/:root\{--chip-v-c:#8DB0E3;--chip-v-a:#D8AECA;--chip-v-b:#F0858C\}/.test(CSS_CHIP_VEREDICTO) || !/\[data-theme="light"\]\{--chip-v-c:#2B558F;--chip-v-a:#6E4560;--chip-v-b:#C8323C\}/.test(CSS_CHIP_VEREDICTO)) F("7 · el CSS del chip no declara el color de cada veredicto en los dos temas");
  }

  // ── 6 · el componente ──
  const CL: Record<string, string> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };
  for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"] as const) {
    const h = renderToStaticMarkup(createElement(ChipVeredicto, { v }));
    const texto = h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!h.includes(`class="chip-v ${CL[v]}"`)) F(`6 · el chip de ${v} no lleva su clase (chip-v ${CL[v]}): ${h}`);
    if (texto !== `${signoVeredicto(v)} ${etiquetaVeredicto(v, "frase")}`) F(`6 · el chip de ${v} dice «${texto}», no el signo y la etiqueta de la fuente única`);
    const s = renderToStaticMarkup(createElement(ChipVeredicto, { v, variante: "sobre-fondo" }));
    if (!s.includes(`class="chip-v ${CL[v]} sobre"`)) F(`6 · la variante sobre fondo de ${v} no lleva la clase «sobre»`);
  }
  if (signoVeredicto("AJUSTA SUPUESTOS") !== "−") F("6 · el signo de Ajustar dejó de ser «−» (decisión de Fabrizio del 25-sep: el «~» de los mockups fue un error)");

  // La segunda puerta, renderizada: chip y no enum.
  const hd = renderToStaticMarkup(
    createElement(DetalleAlternativaComunas, {
      alternativa: { todas: [{ comuna: "Ñuñoa", nVenta: 40, nArriendo: 30, precioUF: 4000, arriendoCLP: 700000, veredicto: "COMPRAR" }], nombradas: [] } as any,
    } as any),
  );
  if (!/class="chip-v c"/.test(hd) || />\s*COMPRAR\s*</.test(hd)) F("2 · la segunda puerta no dibuja el chip de Comprar (o vuelve a imprimir «COMPRAR» crudo)");

  if (fallas.length) {
    console.log(`  ✗ CHIP-VEREDICTO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${ALCANCE.length} archivos del informe web, ${etiquetasVistas} etiquetas de veredicto: ningún chip fuera de ChipVeredicto, sin enum crudo, las seis superficies migradas, el CSS montado en LTR/STR y AMBAS, y el componente con signo y etiqueta de la fuente única`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runChipVeredictoTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN · BLOQUE 7, EL DASHBOARD (25-sep-2026) — cada una aplicada, corrida y restaurada;
// las siete en ROJO, restauradas en VERDE.
//   1 · la tabla vuelve a un badge propio con forma de chip           → bloque 1 (forma de chip)
//   2 · «Continuar» sin el chip del informe
//   3 · el onboarding vuelve a la paleta --franco-v-*
//   4 · una rama de la página (onboarding) sin ChipVeredictoTokens
//   5 · el puntaje con un color propio en Buscar otro
//   6 · el CSS del chip sin el color del veredicto en el tema claro
//   7 · vuelve VERDICT_STYLE al dashboard
