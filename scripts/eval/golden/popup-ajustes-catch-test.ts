/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL POP-UP DE AJUSTES — catch-test. 0 tokens, sin base.
// ============================================================================
// ⛔ ACTA 24-sep-2026 · ESTE TIER SE REESCRIBIÓ CON EL POP-UP. Contrato visual nuevo:
// docs/wireframes/rediseno-informe/popup-matriz-aprobado.html (aprobado por Fabrizio). El
// pop-up dejó de ser «matriz de veredicto + menú de respuestas + siete pares + tabla de
// palancas solas» y pasó a ser un MAPA: cada celda dice, con el color, el veredicto de esa
// combinación al precio pedido, y con el número lo que falta (el descuento hasta Comprar con su
// banda; en Comprar, cuánto te queda al mes).
//
// DE LOS TRECE INVARIANTES DEL 13-sep, QUÉ PASÓ CON CADA UNO:
//  · SE CONSERVAN, reescritos contra el componente nuevo: el pop-up lee del motor (1); «hoy» no
//    se inventa (3); sin grilla no hay pop-up (7); el CTA va inerte y fuera de Comprar (8); la
//    celda habla del precio de hoy (10, que ahora vale para TODAS las celdas, no solo el aro).
//  · SE RETIRAN, porque la pieza que vigilaban salió por decisión del 24-sep: «la celda muestra
//    veredicto y score, no el descuento» (2: ahora muestra el descuento); los siete pares (4:
//    quedan cuatro cifras de la celda tocada); Comprar sin matriz y con los márgenes (5: Comprar
//    tiene matriz de flujo y el margen vive en la card); el cuarto estado «solo palancas» (6: la
//    tabla de palancas solas salió); el menú, el aro de la respuesta y el panel separado (9, 11,
//    12, 13: el mapa reemplaza al menú y el panel es uno solo).
//
// FIJA, y los cinco primeros son los gates pedidos por Fabrizio, verificados EN ROJO por mutación:
//   G1 · LA CELDA MUESTRA EL VEREDICTO REAL DE ESA COMBINACIÓN al precio pedido
//        (`veredictoSinDescuento`), en el modelo y en el HTML renderizado.
//   G2 · FRANCO NUNCA MARCA UNA CELDA MÁS DIFÍCIL QUE LA MÁS FÁCIL DISPONIBLE.
//   G3 · LA CARD, EL POP-UP Y «A QUÉ PRECIO CERRAR» LEEN LA MISMA RECOMENDACIÓN.
//   G4 · COMPRAR NO TIENE CELDA DE FRANCO.
//   G5 · BUSCAR OTRA NO TIENE POP-UP (ni grilla, ni botón en los dos heros).
//   6 · La anatomía del contrato: la línea «Toca una celda…», las flechas (cuatro en Ajustar,
//       dos en Comprar), la leyenda de la tríada, las cuatro cifras, y que no vuelvan el menú,
//       los pares ni «Un cambio a la vez».
//   7 · El arriendo o la tarifa, en su línea «pero eso depende del mercado».
//   8 · El CTA inerte, solo con descuento, nunca en Comprar.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/popup-ajustes-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { AUDIT_FIXTURES, AUDIT_UF } from "../fixtures";
import { PopupAjustes } from "../../../src/components/analysis/shared/PopupAjustes";
import { celdaFranco, grillaDelPopup, hayAjustesQueMostrar, lecturaCelda, nivelMasFacilDisponible } from "../../../src/lib/matriz-popup";
import { nivelDeDescuento } from "../../../src/lib/banda-esfuerzo";
import { construirLoQueHariaYo } from "../../../src/lib/lo-que-haria-yo";
import { recomendacionPagas } from "../../../src/lib/como-lo-pagas";
import type { HallazgoDistanciaVeredicto, Veredicto } from "../../../src/lib/types";

(globalThis as any).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const CLASE: Record<Veredicto, string> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };

export function runPopupAjustesTier(): { hard: number } {
  console.log("\n─── TIER POPUP-AJUSTES (el pop-up como mapa · matriz-popup.ts · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const fecha = new Date("2026-09-24T12:00:00Z");

  // Las filas del golden, recomputadas con el motor vivo: grillas reales, no fixtures a mano.
  const filas = AUDIT_FIXTURES.filter((f: any) => f.ltrInput).map((f: any) => {
    const res: any = runAnalysis(f.ltrInput, AUDIT_UF, f.ltrMediana, fecha);
    const dist = (res.hallazgos ?? []).find((h: any) => h?.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    return { id: f.id as string, input: f.ltrInput, res, v: res.veredicto as Veredicto, dist: dist ?? null };
  });
  const porVeredicto = (v: Veredicto) => filas.filter((r) => r.v === v);
  if (porVeredicto("AJUSTA SUPUESTOS").length === 0 || porVeredicto("COMPRAR").length === 0 || porVeredicto("BUSCAR OTRA").length === 0) {
    F("0 · el golden no trae filas LTR de los tres veredictos: los gates no tendrían sobre qué correr");
  }
  const html = (r: (typeof filas)[number]) =>
    renderToStaticMarkup(
      createElement(PopupAjustes, { veredicto: r.v, modalidad: "LTR", distancia: r.dist, mixComprar: r.res.mixComprar ?? null, currency: "CLP", valorUF: AUDIT_UF, precioUF: Number(r.input.precio) }),
    );
  const botones = (h: string) =>
    (h.match(/<button[^>]*data-pie="[^"]*"[^>]*>/g) ?? []).map((tag) => ({
      pie: Number(tag.match(/data-pie="([^"]*)"/)?.[1]),
      plazo: Number(tag.match(/data-plazo="([^"]*)"/)?.[1]),
      veredicto: tag.match(/data-veredicto="([^"]*)"/)?.[1] ?? "",
      clase: tag.match(/class="([^"]*)"/)?.[1] ?? "",
    }));

  let conGrilla = 0;
  let conFranco = 0;
  let conCardMix = 0;
  for (const r of filas) {
    const grilla = grillaDelPopup({ veredicto: r.v, distancia: r.dist, mixComprar: r.res.mixComprar ?? null });
    const celdas = grilla?.celdas ?? [];
    const esComprar = r.v === "COMPRAR";

    // ── G5 · Buscar otra no tiene pop-up ─────────────────────────────────────
    if (r.v === "BUSCAR OTRA") {
      if (grilla) F(`G5 · ${r.id}: Buscar otra devuelve grilla para el pop-up`);
      if (hayAjustesQueMostrar({ veredicto: r.v, distancia: r.dist, mixComprar: r.res.mixComprar ?? null })) F(`G5 · ${r.id}: Buscar otra abre pop-up`);
      if (html(r).trim()) F(`G5 · ${r.id}: el componente dibuja algo en Buscar otra`);
      continue;
    }
    if (!celdas.length) continue;
    conGrilla++;
    const h = html(r);
    const bs = botones(h);
    if (bs.length !== celdas.length) F(`1 · ${r.id}: la matriz dibuja ${bs.length} celdas y la grilla del motor tiene ${celdas.length}`);

    // ── G1 · la celda muestra el veredicto real de esa combinación ────────────
    for (const c of celdas) {
      const l = lecturaCelda(c, esComprar, r.dist?.valor.topePct ?? 30);
      if (l.veredicto !== c.veredictoSinDescuento) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: el modelo pinta ${l.veredicto} y la combinación al precio pedido es ${c.veredictoSinDescuento}`);
      const b = bs.find((x) => x.pie === c.piePct && x.plazo === c.plazoAnios);
      if (!b) { F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: la celda no aparece en el HTML`); continue; }
      if (b.veredicto !== c.veredictoSinDescuento) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: el HTML dice ${b.veredicto} y la combinación al precio pedido es ${c.veredictoSinDescuento}`);
      if (!b.clase.split(/\s+/).includes(CLASE[c.veredictoSinDescuento])) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: el color (${b.clase}) no es el del veredicto ${c.veredictoSinDescuento}`);
    }

    // ── G4 · Comprar no tiene celda de Franco ────────────────────────────────
    const fr = celdaFranco({ veredicto: r.v, distancia: r.dist, grilla });
    if (esComprar) {
      if (fr) F(`G4 · ${r.id}: Comprar marca una celda de Franco`);
      if (/pjx-tag fr/.test(h) || /\bfr\b/.test(bs.map((b) => b.clase).join(" "))) F(`G4 · ${r.id}: el HTML de Comprar lleva la marca «Franco»`);
      if (/más descuento/.test(h)) F(`6 · ${r.id}: Comprar dibuja las flechas de descuento (no hay descuento que pedir)`);
      if (/Analízalo a UF/.test(h)) F(`8 · ${r.id}: Comprar dibuja el botón de re-análisis`);
      continue;
    }

    // ── G2 · Franco nunca más difícil que la más fácil disponible ─────────────
    if (fr) {
      conFranco++;
      const facil = nivelMasFacilDisponible(celdas);
      if (fr.descuentoPct === null) F(`G2 · ${r.id}: Franco marca una celda que no llega`);
      else if (facil !== null && nivelDeDescuento(fr.descuentoPct) > facil) F(`G2 · ${r.id}: Franco marca −${fr.descuentoPct}% (nivel ${nivelDeDescuento(fr.descuentoPct)}) habiendo una celda de nivel ${facil} disponible`);
      const marcadas = bs.filter((b) => /\bfr\b/.test(b.clase));
      if (marcadas.length !== 1 || marcadas[0].pie !== fr.piePct || marcadas[0].plazo !== fr.plazoAnios) F(`G2 · ${r.id}: el HTML no marca exactamente la celda de Franco (${marcadas.length} marcadas)`);
    }

    // ── G3 · card, pop-up y capítulo leen la misma recomendación ─────────────
    const dv = r.dist?.valor;
    if (dv) {
      const bloque = construirLoQueHariaYo({ veredicto: r.v, distancia: r.dist, currency: "CLP", valorUF: AUDIT_UF } as any);
      const pagas = recomendacionPagas({ veredicto: r.v, precioUF: Number(r.input.precio), piePctActual: Number(r.input.piePct), plazoActual: Number(r.input.plazoCredito), distancia: dv });
      const cardMix = bloque?.mix && bloque.mix.destino === "COMPRAR" ? bloque.mix : null;
      if (fr) {
        if (!cardMix) F(`G3 · ${r.id}: el pop-up marca a Franco en pie ${fr.piePct}% · ${fr.plazoAnios}a y la card no muestra esa combinación`);
        else {
          conCardMix++;
          const pieCard = cardMix.movimiento.pie?.a ?? dv.piePctActual ?? Number(r.input.piePct);
          const plazoCard = cardMix.movimiento.plazo?.a ?? Number(r.input.plazoCredito);
          const dCard = cardMix.descuento ? Number(cardMix.descuento.replace(/[^\d,]/g, "").replace(",", ".")) : 0;
          if (pieCard !== fr.piePct || plazoCard !== fr.plazoAnios || Math.abs(dCard - (fr.descuentoPct ?? 0)) > 0.05) F(`G3 · ${r.id}: la card recomienda pie ${pieCard}% · ${plazoCard}a · −${dCard}% y el pop-up marca pie ${fr.piePct}% · ${fr.plazoAnios}a · −${fr.descuentoPct}%`);
        }
        if (!pagas) F(`G3 · ${r.id}: «A qué precio cerrar» no tiene recomendación y el pop-up sí`);
        else if (pagas.pieA !== fr.piePct || pagas.plazoA !== fr.plazoAnios || Math.abs(pagas.descuentoPct - (fr.descuentoPct ?? 0)) > 0.05) F(`G3 · ${r.id}: «A qué precio cerrar» se ancla en pie ${pagas.pieA}% · ${pagas.plazoA}a · −${pagas.descuentoPct}% y el pop-up marca pie ${fr.piePct}% · ${fr.plazoAnios}a · −${fr.descuentoPct}%`);
      }
    }

    // ── 6 · anatomía ────────────────────────────────────────────────────────
    if (!/Toca una celda para ver qué pasa con esa combinación/.test(h)) F(`6 · ${r.id}: falta la línea «Toca una celda para ver qué pasa con esa combinación»`);
    if ((h.match(/más descuento/g) ?? []).length !== 2 || !/más pie/.test(h) || !/más plazo/.test(h)) F(`6 · ${r.id}: los ejes no son los cuatro del contrato (más pie, más plazo, más descuento ×2)`);
    if (!/Te queda al mes|Pones al mes/.test(h) || !/Pie el día uno/.test(h) || !/TIR a 10 años/.test(h) || !/Franco Score/.test(h)) {
      // Sin celda seleccionable con cifras (la única llega «no llega») el panel no las dibuja: es legítimo.
      const sel = fr ?? celdas.find((c) => c.esActual) ?? celdas[0];
      if (sel && sel.descuentoPct !== null) F(`6 · ${r.id}: el panel no dibuja las cuatro cifras (te queda al mes, pie el día uno, TIR, Franco Score)`);
    }
  }
  // ── FIXTURES SOBRE FILAS REALES para las dos ramas que el golden no ejercita ──
  // (a) RECOMENDACIÓN REDUNDANTE CON LA PALANCA SOLA. Ninguna fila del golden la tiene, así que
  //     sin esto la card podía volver a esconder la combinación «redundante» y G3 seguía verde
  //     (se midió: la mutación no se puso roja). Se toma una fila con Franco y se marca su mix
  //     como redundante: la card tiene que seguir mostrando la MISMA combinación.
  // (b) BUSCAR OTRA CON GRILLA HACIA COMPRAR. LTR no la calcula desde Buscar otra, así que una
  //     fila LTR en Buscar nunca tiene grilla y G5 no distinguía la regla de su ausencia. STR sí
  //     la calcula (`mixPalancasHastaComprar`): se arma ese caso sobre una grilla real.
  const base = filas.find((r) => r.v === "AJUSTA SUPUESTOS" && r.dist?.valor.mixPalancas?.dentroDelAlcance);
  if (!base?.dist) F("0 · no hay fila Ajustar con mix para armar los fixtures de las ramas");
  else {
    const dist = base.dist;
    const mixRed = { ...dist.valor.mixPalancas!, redundanteConPalancaSola: true };
    const distRed = { ...dist, valor: { ...dist.valor, mixPalancas: mixRed } } as HallazgoDistanciaVeredicto;
    const bloqueRed = construirLoQueHariaYo({ veredicto: "AJUSTA SUPUESTOS", distancia: distRed, currency: "CLP", valorUF: AUDIT_UF } as any);
    const frRed = celdaFranco({ veredicto: "AJUSTA SUPUESTOS", distancia: distRed, grilla: mixRed });
    if (!bloqueRed?.mix || bloqueRed.mix.destino !== "COMPRAR") F("G3 · con la combinación marcada redundante la card deja de mostrarla: la card y la celda Franco del pop-up dirían cosas distintas");
    if (!frRed) F("G3 · con la combinación marcada redundante el pop-up deja de marcar a Franco");
    const distBuscar = { ...dist, valor: { ...dist.valor, veredictoBase: "BUSCAR OTRA", mixPalancasHastaComprar: dist.valor.mixPalancas } } as unknown as HallazgoDistanciaVeredicto;
    if (grillaDelPopup({ veredicto: "BUSCAR OTRA", distancia: distBuscar })) F("G5 · Buscar otra CON grilla hacia Comprar (el caso STR) devuelve grilla para el pop-up");
    if (hayAjustesQueMostrar({ veredicto: "BUSCAR OTRA", distancia: distBuscar })) F("G5 · Buscar otra con grilla hacia Comprar abre pop-up");
  }

  if (conGrilla === 0) F("0 · ninguna fila del golden tiene grilla: el tier no midió nada");
  if (conFranco === 0) F("0 · ninguna fila del golden tiene celda de Franco: G2 y G3 no midieron nada");
  if (conCardMix === 0) F("0 · ninguna fila comparó la card con el pop-up: G3 no midió nada");

  // ── Fuente: lo que salió no vuelve, y los heros no abren pop-up en Buscar otra ──
  const pop = sinComentarios(leer("src/components/analysis/shared/PopupAjustes.tsx"));
  if (!/grillaDelPopup\(/.test(pop) || !/lecturaCelda\(/.test(pop) || !/celdaFranco\(/.test(pop)) F("1 · el pop-up no lee la grilla, la lectura de la celda o la celda de Franco del modelo (`matriz-popup.ts`)");
  if (/Hay más de un camino|Lo que Franco recomienda|La que más rinde|La que más alivia el mes/.test(pop)) F("6 · volvió el menú de tres respuestas");
  if (/Cash on cash|Cuota mensual|El ajuste óptimo/.test(pop)) F("6 · volvieron los pares hoy → después");
  if (/Un cambio a la vez/.test(pop)) F("6 · volvió «Un cambio a la vez»");
  if (!/depende del mercado/.test(pop)) F("7 · falta la línea del arriendo o la tarifa «pero eso depende del mercado»");
  if (!/aria-disabled="true"/.test(pop) || /href=|onClick=\{[^}]*router|<Link\b/.test(pop.slice(pop.indexOf("pjx-cta")))) F("8 · el botón de re-análisis dejó de ser inerte");
  for (const hero of ["src/components/analysis/HeroLTR.tsx", "src/components/analysis/str/HeroStrDictamen.tsx"]) {
    const src = sinComentarios(leer(hero));
    if (!/esBuscar \? null :/.test(src)) F(`G5 · ${hero}: el footer (el botón del pop-up) no se apaga en Buscar otra`);
    if (!/hayAjustesQueMostrar\(\{[^}]*mixComprar/.test(src)) F(`G5 · ${hero}: el botón no pregunta a \`hayAjustesQueMostrar\` con la grilla de Comprar`);
  }

  if (fallas.length) {
    console.log(`  ✗ POPUP-AJUSTES · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
    if (fallas.length > 40) console.log(`     · … y ${fallas.length - 40} más`);
  } else {
    console.log(`  ✓ VERDE — ${conGrilla} grillas del golden: cada celda pinta el veredicto real de su combinación, Franco nunca más difícil que la más fácil (${conFranco} filas), card, pop-up y capítulo con la misma recomendación (${conCardMix}), Comprar sin Franco, Buscar otra sin pop-up, la anatomía del contrato y el botón inerte`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPopupAjustesTier();
  process.exit(hard ? 1 : 0);
}
