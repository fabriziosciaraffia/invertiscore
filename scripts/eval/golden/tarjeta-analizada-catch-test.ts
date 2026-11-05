// ============================================================================
// GOLDEN · TARJETA-ANALIZADA (05-nov-2026) — catch-test
// ============================================================================
//   Decisión de Fabrizio, 05-nov-2026: «La tarjeta de un depto ya analizado muestra lo que dice el informe de esa persona, no
//   lo de la noche: el chip con el veredicto y puntaje del informe y la fecha («✓ COMPRAR · 79 · tu informe del 13-oct»). Si
//   la noche hoy da distinto, una línea chica lo dice («hoy la noche da 82»). Aplica a Explorar, la selección y el dashboard.»
//   Gate en rojo con una tarjeta analizada que muestra el puntaje de la noche.
//
//   1 · EL TEXTO (lib/informe-propio.ts, puro): el chip, la fecha en hora de Chile y la línea de la noche, que sale solo si la
//       noche da distinto (el puntaje; el veredicto si cambió).
//   2 · DIBUJADO DE VERDAD, cada tarjeta con un depto analizado cuyo informe dio Comprar · 79 y la noche hoy da 82 (y un flujo
//       de la noche que no puede asomar): la tarjeta y la lista de Explorar, el depto compartido, la selección del dashboard,
//       los guardados del dashboard y la primera selección (de /deptos y del dashboard). En cada una: el chip del informe
//       (79), «tu informe del 13-oct», «hoy la noche da 82» y, fuera de esa línea, NI el 82 NI el flujo de la noche. Con la
//       noche igual al informe, sin línea; con otro veredicto, la línea lo nombra. Control: el mismo depto SIN analizar sí
//       muestra la noche (si no, la ausencia del 82 no probaría nada).
//   3 · LA GUÍA DE BÚSQUEDA (solo con estado de la visita, no se dibuja con datos): la tarjeta de un analizado va al chip y
//       la noche queda en la otra rama.
//   4 · EL CABLEADO: lo que el servidor lee (veredicto y puntaje guardados, solo los informes de esa persona) llega a cada
//       tarjeta, y lo recién analizado en la visita también.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/tarjeta-analizada-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "./lectura-paginada-catch-test";
import { chipInforme, fechaInforme, lineaNoche, type ResumenInforme } from "../../../src/lib/informe-propio";
import type { PinMapa } from "../../../src/lib/explorar/portal";

// El JSX de los componentes usa el React global; y los componentes importan CSS: en node, un módulo vacío (como
// EXPLORAR-PORTAL y COMPARTIR-DEPTO).
(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));

function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&quot;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** El html sin la línea chica de la noche (lo único donde el puntaje de la noche puede estar). */
const sinLineaNoche = (html: string) => html.replace(/<span[^>]*data-informe-propio="noche"[^>]*>[^<]*<\/span>/g, "");

const AVISO = "a1b2c3d4-0000-4000-8000-00000000aa01";
const INFORME = "f0e1d2c3-0000-4000-8000-00000000bb02";
/** El informe: Comprar · 79, creado el 13-oct a las 23:10 de Chile (02:10 UTC del 14: la fecha tiene que salir en hora de Chile). */
const R: ResumenInforme = { veredicto: "COMPRAR", score: 79, fecha: "2026-10-14T02:10:00.000Z" };
/** La noche: el mismo veredicto con 82, y un flujo que no puede asomar en la tarjeta del analizado. */
const NOCHE_SCORE = 82, NOCHE_FLUJO = 123457, NOCHE_FLUJO_TXT = "123.457";
const NADA = () => {};

const pin = (x: Partial<PinMapa> = {}): PinMapa => ({
  avisoId: AVISO, comuna: "Providencia", lat: -33.43, lng: -70.61, m2: 59, dormitorios: 2, banos: 1, tipologia: "2D1B",
  precioUF: 3500, veredicto: "COMPRAR", score: NOCHE_SCORE, flujo: NOCHE_FLUJO, arriendo: 650000, alta: null, ...x,
});

type Dibujo = (o: { analizado: boolean; noche?: { veredicto: string; score: number } }) => string;

export async function runTarjetaAnalizadaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n── TIER TARJETA-ANALIZADA · la tarjeta de un analizado dice su informe, no la noche ──");

  // ── 1 · el texto ───────────────────────────────────────────────────────────
  try {
    if (chipInforme(R) !== "✓ Comprar · 79 · tu informe del 13-oct") F(`1 · el chip del informe dice «${chipInforme(R)}», no «✓ Comprar · 79 · tu informe del 13-oct»`);
    if (fechaInforme(R.fecha) !== "13-oct") F(`1 · la fecha del informe no sale en hora de Chile («${fechaInforme(R.fecha)}»)`);
    if (lineaNoche(R, { veredicto: "COMPRAR", score: 79 }) !== null) F("1 · con la noche igual al informe igual sale la línea de la noche");
    if (lineaNoche(R, { veredicto: "COMPRAR", score: NOCHE_SCORE }) !== "hoy la noche da 82") F(`1 · con la noche en 82 la línea dice «${lineaNoche(R, { veredicto: "COMPRAR", score: NOCHE_SCORE })}», no «hoy la noche da 82»`);
    if (lineaNoche(R, { veredicto: "AJUSTA SUPUESTOS", score: 64 }) !== "hoy la noche da Ajustar · 64") F("1 · con otro veredicto la línea de la noche no lo nombra («hoy la noche da Ajustar · 64»)");
    if (lineaNoche(R, null) !== null || lineaNoche(R, { veredicto: "COMPRAR", score: null }) !== null) F("1 · sin nada que comparar sale una línea de la noche");
    const sinV: ResumenInforme = { veredicto: null, score: null, fecha: R.fecha };
    if (chipInforme(sinV) !== "✓ Tu informe del 13-oct") F("1 · un informe sin veredicto guardado no dice «✓ Tu informe del 13-oct»");
  } catch (e) {
    F(`1 · el módulo puro revienta: ${(e as Error).message}`);
  }

  // ── 2 · dibujado de verdad ─────────────────────────────────────────────────
  const { ChipVeredicto } = require(join(RAIZ, "src/components/analysis/shared/ChipVeredicto")) as typeof import("../../../src/components/analysis/shared/ChipVeredicto");
  const chip79 = renderToStaticMarkup(createElement(ChipVeredicto, { v: "COMPRAR", puntaje: 79 }));
  const resumenes = { [INFORME]: R };
  const con = { tipo: "con" as const, n: 3, noVencen: true };

  const superficies: Array<[string, Dibujo]> = [];
  const cargar = <T,>(ruta: string): T | null => {
    try { return require(join(RAIZ, ruta)) as T; } catch (e) { F(`2 · ${ruta} no carga: ${(e as Error).message}`); return null; }
  };
  const tp = cargar<typeof import("../../../src/app/explorar/tarjeta-pin")>("src/app/explorar/tarjeta-pin");
  const lp = cargar<typeof import("../../../src/app/explorar/lista-portal")>("src/app/explorar/lista-portal");
  const ch = cargar<typeof import("../../../src/app/explorar/compartido-hoja")>("src/app/explorar/compartido-hoja");
  const sl = cargar<typeof import("../../../src/app/semanal/semanal-lista")>("src/app/semanal/semanal-lista");
  const gc = cargar<typeof import("../../../src/app/dashboard/guardados-casa")>("src/app/dashboard/guardados-casa");
  const ps = cargar<typeof import("../../../src/components/deptos/PrimeraSeleccion")>("src/components/deptos/PrimeraSeleccion");

  if (tp) superficies.push(["Explorar · la tarjeta del pin", ({ analizado, noche }) => dibujar(createElement(tp.TarjetaPin, {
    pines: [pin(noche ?? {})], seleccionado: AVISO, uf: 39000, analizados: analizado ? { [AVISO]: INFORME } : {}, resumenes,
    guardados: new Set<string>(), generando: null, error: null, alCambiar: NADA, alCerrar: NADA, alGuardar: NADA, alAnalizar: NADA, alCompartir: NADA,
  }))]);
  if (lp) superficies.push(["Explorar · la lista", ({ analizado, noche }) => dibujar(createElement(lp.ListaPortal, {
    pines: [pin(noche ?? {})], desglose: null, calculando: null, orden: "puntaje", uf: 39000, analizados: analizado ? { [AVISO]: INFORME } : {}, resumenes,
    guardados: new Set<string>(), alOrden: NADA, alAbrir: NADA, alGuardar: NADA, alCompartir: NADA, alAvisame: NADA, alCerrar: NADA,
  }))]);
  if (ch) superficies.push(["Explorar · el depto compartido", ({ analizado, noche }) => dibujar(createElement(ch.HojaCompartida, {
    caso: { tipo: "pin", pin: pin(noche ?? {}) }, sinCuenta: false, informe: analizado ? INFORME : null, resumenes,
    alAnalizar: NADA, alAbrirParecido: NADA, alCerrar: NADA,
  }))]);
  const item = (noche?: { veredicto: string; score: number }) => ({ avisoId: AVISO, comuna: "Providencia", tipologia: "2D1B", m2: 59, precioUF: 3500, veredicto: noche?.veredicto ?? "COMPRAR", score: noche?.score ?? NOCHE_SCORE, flujo: NOCHE_FLUJO });
  if (sl) superficies.push(["la selección del dashboard", ({ analizado, noche }) => dibujar(createElement(sl.SemanalLista, {
    token: "t".repeat(24), origenId: null, combinacion: { piePct: 20, plazoAnios: 30 }, filas: [{ item: item(noche), caido: false, reemplazo: null }],
    destacado: null, saldo: con, variante: null, informes: analizado ? { [AVISO]: INFORME } : {}, resumenes, enCasa: true, aLaVista: 2,
  } as unknown as Parameters<typeof sl.SemanalLista>[0]))]);
  if (gc) superficies.push(["los guardados del dashboard", ({ analizado, noche }) => dibujar(createElement(gc.GuardadosCasa, {
    inicial: [{ avisoId: AVISO, comuna: "Providencia", m2: 59, tipologia: "2D1B", precioUF: 3500, veredicto: noche?.veredicto ?? "COMPRAR", score: noche?.score ?? NOCHE_SCORE,
      flujo: NOCHE_FLUJO, arriendo: 650000, activo: true, informeId: analizado ? INFORME : null, resumen: analizado ? R : null }],
    uf: 39000,
  }))]);
  if (ps) superficies.push(["la primera selección", ({ analizado, noche }) => dibujar(createElement(ps.PrimeraSeleccion, {
    encabezado: "casa",
    inicial: {
      revisando: false, token: "t".repeat(24), regaloVence: null, fuente: "del_dia", origenId: null, combinacion: { piePct: 20, plazoAnios: 30 }, faltan: [],
      saldo: con, finanzas: { tasa: null, uf: null, arriendos: {} }, resumenes,
      items: [{ ...item(noche), vistoAt: null, enSeleccion: true, informeId: analizado ? INFORME : null }],
    },
  }))]);

  if (superficies.length !== 6) F(`2 · se dibujaron ${superficies.length} de las 6 tarjetas`);
  for (const [nombre, d] of superficies) {
    try {
      // El control: sin analizar, la tarjeta dice la noche (si no, que falte el 82 no probaría nada).
      const libre = d({ analizado: false });
      if (!new RegExp(`\\b${NOCHE_SCORE}\\b`).test(texto(libre))) F(`2 · ${nombre}: sin analizar no muestra el puntaje de la noche (el control no sirve)`);
      if (/data-informe-propio=/.test(libre)) F(`2 · ${nombre}: un depto SIN analizar muestra el chip de un informe`);

      const h = d({ analizado: true });
      const fuera = sinLineaNoche(h);
      if (!h.includes(chip79)) F(`2 · ${nombre}: la tarjeta analizada no lleva el chip del informe (✓ Comprar · 79)`);
      if (!texto(h).includes("tu informe del 13-oct")) F(`2 · ${nombre}: la tarjeta analizada no dice «tu informe del 13-oct»`);
      if (!/data-informe-propio="noche"[^>]*>hoy la noche da 82</.test(h)) F(`2 · ${nombre}: con la noche en 82 no está la línea chica «hoy la noche da 82»`);
      if (new RegExp(`\\b${NOCHE_SCORE}\\b`).test(texto(fuera)) || fuera.includes(`data-puntaje="${NOCHE_SCORE}"`)) F(`2 · ${nombre}: LA TARJETA ANALIZADA MUESTRA EL PUNTAJE DE LA NOCHE (82) fuera de la línea chica`);
      if (texto(h).includes(NOCHE_FLUJO_TXT)) F(`2 · ${nombre}: la tarjeta analizada muestra el flujo de la noche`);
      if (/Analizar este/.test(texto(h))) F(`2 · ${nombre}: la tarjeta analizada ofrece «Analizar este»`);

      const igual = d({ analizado: true, noche: { veredicto: "COMPRAR", score: 79 } });
      if (/data-informe-propio="noche"/.test(igual) || !igual.includes(chip79)) F(`2 · ${nombre}: con la noche igual al informe sale la línea de la noche (o se pierde el chip)`);
      const otro = d({ analizado: true, noche: { veredicto: "AJUSTA SUPUESTOS", score: 64 } });
      if (!/data-informe-propio="noche"[^>]*>hoy la noche da Ajustar · 64</.test(otro) || !otro.includes(chip79)) F(`2 · ${nombre}: con otro veredicto la línea de la noche no lo nombra (o el chip deja de ser el del informe)`);
    } catch (e) {
      F(`2 · ${nombre}: no se dibuja (${(e as Error).message})`);
    }
  }

  // ── 3 · la guía de búsqueda ────────────────────────────────────────────────
  try {
    const g = sc("src/components/guia/GuiaBusqueda.tsx");
    if (!/const informePropio = informesAqui\[it\.avisoId\] \?\? null;\s*const resumen = informePropio \? resumenesAqui\[informePropio\] : undefined;/.test(g)) F("3 · la guía no busca el informe propio de la tarjeta");
    if (!/\{informePropio \? \(\s*resumen && <div className="guia-dos" data-guia="informe-propio"><ChipInformePropio resumen=\{resumen\} noche=\{\{ veredicto: it\.veredicto, score: it\.score \}\} \/><\/div>\s*\) : \(\s*<div className="guia-dos">\s*<div>\s*<div className="guia-k">\{GUIA\.veredicto\}<\/div>/.test(g)) F("3 · la tarjeta analizada de la guía no va al chip del informe, o la noche no queda en la otra rama");
    if ((g.match(/className="guia-ver"/g) ?? []).length !== 1) F("3 · la guía dibuja el veredicto de la noche en más de un lugar");
  } catch (e) {
    F(`3 · no se pudo leer la guía: ${(e as Error).message}`);
  }

  // ── 4 · el cableado ────────────────────────────────────────────────────────
  try {
    const srv = sc("src/lib/informe-propio-servidor.ts");
    if (!/\.select\("id, score, veredicto:results->>veredicto, created_at"\)\s*\.eq\("user_id", userId\)\s*\.in\("id", ids\.slice\(i, i \+ 100\)\)/.test(srv)) F("4 · el resumen no lee el veredicto y el puntaje GUARDADOS de los informes de esa persona (de a 100)");
    const servidores: Array<[string, RegExp]> = [
      ["src/lib/explorar/portal-servidor.ts", /const resumenes = await resumenesDeInformes\(admin, user\.id, Object\.values\(analizados\)\);[\s\S]*?analizados, resumenes, guardados,/],
      ["src/lib/guia/seleccion-pagina-servidor.ts", /const resumenes = await resumenesDeInformes\(admin, userId, \[\.\.\.idsDeInformes\(filas, informesLargos\), \.\.\.idsDeInformes\(filasCortas, informesCortos\)\]\);[\s\S]*?informes: informesLargos, resumenes \}[\s\S]*?informes: informesCortos, resumenes,/],
      ["src/lib/explorar/guardados-servidor.ts", /const resumenes = await resumenesDeInformes\(admin, userId, ids\.map\(\(id\) => informes\[id\]\)[^;]*\);[\s\S]*?resumen: informes\[id\] \? resumenes\[informes\[id\]\] \?\? null : null,/],
    ];
    for (const [ruta, re] of servidores) if (!re.test(sc(ruta))) F(`4 · ${ruta} no lee el resumen de los informes o no lo entrega`);
    const prim = sc("src/lib/deptos/primeros-servidor.ts");
    if ((prim.match(/const resumenes = await resumenesDeInformes\(admin, userId, Object\.values\(informes\)\);/g) ?? []).length !== 2 || (prim.match(/faltan: \[\], saldo, finanzas, resumenes,/g) ?? []).length !== 2) F("4 · la primera selección no entrega el resumen en sus dos caminos (del día y de la noche)");
    const casa = sc("src/app/dashboard/seleccion-en-casa.tsx");
    if (!/resumenes=\{sel\.largo\.resumenes\}/.test(casa) || !/resumenes=\{sel\.corto\.resumenes\}/.test(casa)) F("4 · la selección del dashboard no le pasa el resumen a sus dos bloques");
    const ex = sc("src/app/explorar/explorar-cliente.tsx");
    if (!/const resumenesVivos = useMemo\(\(\) => \(\{ \.\.\.\(cuenta\.resumenes \?\? \{\}\), \.\.\.resumenesAqui \}\), \[cuenta\.resumenes, resumenesAqui\]\);/.test(ex)) F("4 · Explorar no junta lo del servidor con lo analizado en la visita");
    for (const comp of ["TarjetaPin", "ListaPortal", "HojaCompartida"]) {
      const i = ex.indexOf(`<${comp}`), j = ex.indexOf("/>", i);
      if (i < 0 || !/\bresumenes=\{resumenesVivos\}/.test(ex.slice(i, j))) F(`4 · Explorar no le pasa el resumen a <${comp}>`);
    }
    // Lo recién analizado en la visita: el veredicto y el puntaje que respondió la ruta al crearlo.
    const VISITA = /setResumenesAqui\(\(m\) => \(\{ \.\.\.m, \[nuevo\]: \{ veredicto: d\.veredicto \?\? null, score: d\.score \?\? null, fecha: new Date\(\)\.toISOString\(\) \} \}\)\);/;
    for (const ruta of ["src/app/explorar/explorar-cliente.tsx", "src/app/semanal/semanal-lista.tsx", "src/components/deptos/PrimeraSeleccion.tsx", "src/components/guia/GuiaBusqueda.tsx"]) {
      if (!VISITA.test(sc(ruta))) F(`4 · ${ruta}: lo recién analizado en la visita no guarda el resumen de su informe`);
    }
    // La primera selección: el resumen del servidor y el de la visita, por el id del informe de la tarjeta.
    if (!/const informe = it\.informeId \?\? informesAqui\[it\.avisoId\] \?\? null;\s*const resumen = informe \? datos\.resumenes\?\.\[informe\] \?\? resumenesAqui\[informe\] : undefined;/.test(sc("src/components/deptos/PrimeraSeleccion.tsx"))) F("4 · la primera selección no busca el resumen del informe de la tarjeta");
    // /deptos no monta el CSS del chip: la primera selección lo trae.
    if (!/<div className="sel-lista" data-primera="lista">\s*(?:\{\}\s*)?<ChipVeredictoTokens \/>/.test(sc("src/components/deptos/PrimeraSeleccion.tsx"))) F("4 · la primera selección no monta el CSS del chip (en /deptos saldría sin color)");
  } catch (e) {
    F(`4 · no se pudo leer el cableado: ${(e as Error).message}`);
  }

  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length === 0 ? "  ✓ 6 tarjetas dibujadas con su informe, la guía y el cableado" : `  ${fallas.length} falla(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runTarjetaAnalizadaTier().then((r) => { process.exitCode = r.hard > 0 ? 1 : 0; });
}

// ============================================================================
// ACTA — verificado EN ROJO por mutación (05-nov-2026)
// ============================================================================
//   Runner `mutar.js` del scratchpad de la sesión e82e757c: aplica, corre el tier, exige la falla nombrada y restaura cada
//   archivo byte a byte (sha256).
//   M1  la tarjeta del pin vuelve a la noche (VeredictoDelPin + flujo) ....... ROJO (§2 «MUESTRA EL PUNTAJE DE LA NOCHE»)
//   M2  la lista de Explorar vuelve a la noche ................................ ROJO (§2, ídem)
//   M3  el depto compartido vuelve a la noche ................................. ROJO (§2, ídem)
//   M4  la fila de la selección vuelve a decir «Comprar 82» ................... ROJO (§2, ídem)
//   M5  los guardados vuelven a la línea de la noche .......................... ROJO (§2, ídem)
//   M6  la primera selección vuelve al veredicto de la noche .................. ROJO (§2, ídem)
//   M7  el chip lleva el puntaje de la noche .................................. ROJO (§2, sin el chip del informe)
//   M8  la línea de la noche no sale nunca .................................... ROJO (§2)
//   M9  la fecha en UTC (el informe de las 23:10 de Chile sale «14-oct») ...... ROJO (§1)
//   M10 el veredicto cambiado no se nombra .................................... ROJO (§1, §2)
//   M11 el resumen lee informes de cualquier cuenta (sin user_id) ............. ROJO (§4)
//   M12 la guía vuelve a la noche ............................................. ROJO (§3)
//   M13 Explorar no le pasa el resumen a la tarjeta ........................... ROJO (§4)
//   M14 lo analizado en la visita no guarda su resumen (selección) ............ ROJO (§4)
//   M15 la primera selección no entrega el resumen por el camino de la noche .. ROJO (§4)
//   M16 los guardados no leen el resumen ...................................... ROJO (§4)
//   M17 un depto SIN analizar muestra un chip de informe ...................... ROJO (§2, el control)
//   17/17 en rojo. Además, el tier PUERTA-B-DASHBOARD §4 exigía «Comprar 91» —la noche— en la fila del analizado: reescrito
//   con su acta (ahora exige el depto y su precio, y que el 91 no esté) y verificado en rojo con M4 sobre ese tier.
// ============================================================================
