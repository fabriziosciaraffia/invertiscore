// ─────────────────────────────────────────────────────────────────────────────
// Tier CHIP-COMPARABLES (09-oct-2026, 0 tokens) — el chip del mapa del wizard nunca se queda buscando.
//
// El incidente: con `/api/data/suggestions` colgado hasta los 300 s de Vercel (tier UF-TIEMPO), el chip
// decía «Buscando comparables cerca…» para siempre: los dos fetch del wizard no tenían tiempo máximo y un
// error terminaba igual que «sin dato». Ahora: mientras carga, un indicador giratorio a la izquierda del
// texto; si el pedido falla o pasa de 10 s, «No pudimos cargar los comparables. Reintentar», y el botón
// vuelve a pedir.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/chip-comparables-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx compila el JSX de los componentes con el runtime clásico: como en los otros tiers que dibujan.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\s*\}/g, "{}");
const req = (p: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(p);
  } catch {
    return null;
  }
};

const GUARDIA_MS = 2000;
async function resultado(p: Promise<unknown>): Promise<"resolvio" | "rechazo" | "colgo"> {
  let t: NodeJS.Timeout | undefined;
  const guardia = new Promise<"colgo">((r) => { t = setTimeout(() => r("colgo"), GUARDIA_MS); });
  const r = await Promise.race([p.then(() => "resolvio" as const, () => "rechazo" as const), guardia]);
  clearTimeout(t);
  return r;
}

export async function runChipComparablesTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CHIP-COMPARABLES (el chip del mapa nunca se queda buscando · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  const P = req("../../../src/components/formulario-v4/pedirSugerencias");
  const C = req("../../../src/components/formulario-v4/ChipComparables");
  if (!P) F("0 · no carga `pedirSugerencias`: los comparables se piden sin tiempo máximo");
  if (!C) F("0 · no carga `ChipComparables`: el chip no tiene estado de error");

  // ── 1 · EL TIEMPO MÁXIMO ──────────────────────────────────────────────────
  if (P) {
    if (P.TIEMPO_MAX_SUGERENCIAS_MS !== 10000) F("1 · el tiempo máximo de los comparables no es 10 s");
    const colgado = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const r1 = await resultado(P.pedirJsonConTiempo("/api/data/suggestions?x", { tiempoMaxMs: 60, pedir: colgado }));
    if (r1 !== "rechazo") F(`1 · con el endpoint colgado, el pedido de comparables ${r1 === "colgo" ? "COLGÓ" : "resolvió"} (tiene que rechazar al tiempo máximo)`);
    const conError = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    const r2 = await resultado(P.pedirJsonConTiempo("/api/data/suggestions?x", { tiempoMaxMs: 500, pedir: conError }));
    if (r2 !== "rechazo") F("2 · un 500 del endpoint no cuenta como falla (antes terminaba igual que «sin dato»)");
    const caido = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    if ((await resultado(P.pedirJsonConTiempo("/x", { tiempoMaxMs: 500, pedir: caido }))) !== "rechazo") F("2 · un corte de red no cuenta como falla");
    const bien = (async () => new Response(JSON.stringify({ source: "radio" }), { status: 200 })) as unknown as typeof fetch;
    let json: unknown = null;
    await P.pedirJsonConTiempo("/x", { tiempoMaxMs: 500, pedir: bien }).then((j: unknown) => { json = j; }, () => {});
    if ((json as { source?: string } | null)?.source !== "radio") F("1 · con el endpoint bien, el pedido no devuelve su JSON");
    // El estado del chip: error antes que «buscando»; nombrar el punto también es buscar.
    const e = P.estadoChipComparables;
    if (typeof e !== "function") F("2 · no existe `estadoChipComparables`");
    else {
      if (e({ cargando: true, error: false, nombrando: false }) !== "buscando") F("2 · cargando, el chip no dice que busca");
      if (e({ cargando: false, error: true, nombrando: false }) !== "error") F("2 · con el pedido fallado, el chip no pasa a error");
      if (e({ cargando: false, error: false, nombrando: true }) !== "buscando") F("2 · nombrando el punto, el chip no dice que busca");
      if (e({ cargando: false, error: false, nombrando: false }) !== "listo") F("2 · con los comparables, el chip no queda listo");
    }
    const t = P.CHIP_COMPARABLES ?? {};
    if (t.buscando !== "Buscando comparables cerca…" || t.error !== "No pudimos cargar los comparables." || t.reintentar !== "Reintentar") F("2 · el copy del chip no es el aprobado («No pudimos cargar los comparables. Reintentar»)");
  }

  // ── 2 · EL CHIP: indicador mientras carga, error con «Reintentar» ───────────
  if (C?.ChipComparables) {
    const dibujar = (props: Record<string, unknown>, hijos?: string) => renderToStaticMarkup(createElement(C.ChipComparables, props, hijos ?? null));
    const buscando = dibujar({ estado: "buscando", onReintentar: () => {} });
    if (!/^<span class="wz-chip-fila"><span class="wz-girando" aria-hidden="true"><\/span>Buscando comparables cerca…<\/span>$/.test(buscando)) F(`2 · mientras carga, el chip no lleva el indicador giratorio a la izquierda del texto (${buscando.slice(0, 120)})`);
    const error = dibujar({ estado: "error", onReintentar: () => {} });
    if (!/No pudimos cargar los comparables\./.test(error) || !/<button type="button" class="[^"]*wz-reintentar[^"]*"[^>]*>Reintentar<\/button>/.test(error)) F(`2 · con el pedido fallado, el chip no dice «No pudimos cargar los comparables. Reintentar» con el botón (${error.slice(0, 160)})`);
    if (/wz-girando/.test(error)) F("2 · con el pedido fallado, el chip sigue girando");
    if (!/pointer-events-auto/.test(error)) F("2 · el botón «Reintentar» no se puede tocar (la etiqueta del mapa tiene pointer-events-none)");
    const listo = dibujar({ estado: "listo", onReintentar: () => {} }, "27 comparables");
    if (/wz-girando|Reintentar|Buscando/.test(listo) || !/27 comparables/.test(listo)) F("2 · con los comparables, el chip no muestra solo el conteo");
  }

  // ── 3 · EL CABLEADO ───────────────────────────────────────────────────────
  {
    const hook = sinComentarios(leer("src/components/formulario-v4/useWizardV4Data.ts"));
    if ((hook.match(/pedirJsonConTiempo\(`\/api\/data\/suggestions\?\$\{q(Arriendo|Venta)\}`\)/g) ?? []).length !== 2) F("3 · los dos pedidos de comparables no van con tiempo máximo");
    if (/fetch\(`\/api\/data\/suggestions/.test(hook)) F("3 · queda un fetch de comparables sin tiempo máximo");
    if (!/setSuggestionsError\(true\)/.test(hook) || !/setSuggestionsError\(false\)/.test(hook)) F("3 · el hook no marca ni limpia el error de los comparables");
    if (!/reintentarSugerencias: \(\) => setIntento\(\(n\) => n \+ 1\)/.test(hook) || !/\[lat, lng, comuna, superficie, dormitorios, tipoPropiedad, amoblado, intento\]/.test(hook)) F("3 · «Reintentar» no vuelve a pedir los comparables");
    const pantalla = sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx"));
    if (!/estadoChipComparables\(\{ cargando: data\.suggestionsLoading, error: data\.suggestionsError, nombrando \}\)/.test(pantalla)) F("3 · el chip del mapa no sale del estado de los comparables");
    if (!/<ChipComparables estado=\{estadoChip\} onReintentar=\{data\.reintentarSugerencias\}>/.test(pantalla)) F("3 · el chip del mapa no es `ChipComparables` con «Reintentar»");
    if (/"Buscando comparables cerca…"/.test(pantalla)) F("3 · el texto «Buscando…» sigue suelto en la pantalla (sin indicador ni error)");
    const css = leer("src/components/formulario-v4/wizard-v4.css");
    if (!/\.wz-girando \{[^}]*animation: wz-girar/.test(css) || !/@keyframes wz-girar/.test(css)) F("2 · el indicador giratorio no gira (falta la animación)");
  }

  if (fallas.length) {
    console.log(`  ✗ CHIP-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — los comparables se piden con tiempo máximo de 10 s; un cuelgue, un 500 o un corte pasan a «No pudimos cargar los comparables. Reintentar»; mientras carga, el indicador giratorio a la izquierda; el botón vuelve a pedir");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runChipComparablesTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (09-oct-2026) — mismo método que los otros tiers: aplicada, corrida, restaurada desde
// una copia en memoria. Antes del arreglo el tier dio 10 fallas. Las 10 en ROJO; restauradas, VERDE. Cada
// lectura colgada va con guardia de 2 s y el corredor exige la línea de verde (lección del tier UF-TIEMPO).
//    C1 el arriendo sin tiempo máximo (el bug)   C6 sin indicador giratorio
//    C2 el pedido no corta nunca                 C7 el botón no se puede tocar
//    C3 un 500 cuenta como respuesta             C8 el error nunca se muestra
//    C4 la falla no marca el error               C9 el indicador no gira
//    C5 «Reintentar» no vuelve a pedir           C10 el tiempo máximo a 30 s
