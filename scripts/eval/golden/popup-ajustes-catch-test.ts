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
// ⛔ ACTA 25-sep-2026 · MOCKUP FINAL, tras la prueba de Fabrizio en el teléfono. En AJUSTAR el
// color de la celda deja de ser el veredicto al precio pedido: en las filas donde todo es Ajustar
// la matriz quedaba entera ciruela y se leía «nunca llega». Ahora es la ESCALA DE CERCANÍA A
// COMPRAR, toda azul (`escalaCelda`), sin la palabra del veredicto en la celda; el veredicto real
// de la combinación lo dice la FRASE al tocarla («pasa de Ajustar a Comprar»). Por eso G1 se
// reescribe: en Ajustar fija que el color sea la escala del descuento real de esa celda y que la
// frase nombre su veredicto real; en Comprar sigue fijando el color del veredicto, sin cambios.
// La anatomía (6) pasa a la del mockup final: leyenda en escala en vez de la tríada, «Toca una
// celda para ver cómo queda.», la TABLA Hoy / Así de nueve filas en vez de las cuatro cifras (que
// quedan en Comprar), bordes finos (Franco 2 px sólido, hoy 1,5 px punteado) y el tope real en
// las celdas fuera de alcance. «Cash on cash» deja de estar prohibido: vuelve como fila de la tabla.
//
// FIJA, y los cinco primeros son los gates pedidos por Fabrizio, verificados EN ROJO por mutación:
//   G1 · LA CELDA DICE LA VERDAD DE ESA COMBINACIÓN. En Ajustar, su color es la escala de su
//        descuento real (fuera de alcance · difícil · con argumentos · fácil · ya es Comprar) y
//        la frase al tocarla nombra su veredicto real al precio pedido (`veredictoSinDescuento`).
//        En Comprar, el color es ese veredicto. En el modelo y en el HTML renderizado.
//   G2 · FRANCO NUNCA MARCA UNA CELDA MÁS DIFÍCIL QUE LA MÁS FÁCIL DISPONIBLE.
//   G3 · LA CARD, EL POP-UP Y «A QUÉ PRECIO CERRAR» LEEN LA MISMA RECOMENDACIÓN.
//   G4 · COMPRAR NO TIENE CELDA DE FRANCO.
//   G5 · BUSCAR OTRA NO TIENE POP-UP (ni grilla, ni botón en los dos heros).
//   6 · La anatomía del contrato: la línea «Toca una celda…», las flechas (cuatro en Ajustar,
//       dos en Comprar), la leyenda (escala en Ajustar, tríada en Comprar), la tabla Hoy / Así en
//       Ajustar y las cuatro cifras en Comprar, los bordes finos, y que no vuelvan el menú, los
//       pares ni «Un cambio a la vez».
//   7 · El arriendo o la tarifa, en su bloque «Un camino que no depende de ti».
//
// ⛔ ACTA 25-sep-2026 (segunda versión del mockup) · la leyenda pasa de escala a REGLA de
// descuento (ya es Comprar → fuera de alcance, fronteras 0 · 5 · 10 · tope abajo, título
// «Descuento que hay que negociar»); la tabla gana la fila de veredicto arriba, el ⓘ del informe
// en cash on cash, cap rate, TIR y Franco Score, y el puntaje con el color de su veredicto; y la
// línea del mercado pasa a bloque propio con lo supuesto contra lo que haría falta y su contexto.
// El chequeo de filas se reescribe por `data-fila` (el rótulo ahora lleva el ⓘ adentro, y leerlo
// por texto contaba el botón como parte del nombre).
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
import { celdaFranco, grillaDelPopup, hayAjustesQueMostrar, lecturaCelda, nivelMasFacilDisponible, pieDiaUnoUF } from "../../../src/lib/matriz-popup";
import { nivelDeDescuento, BANDA_TOPE_FACTIBLE_PCT, BANDA_TOPE_ARGUMENTOS_PCT } from "../../../src/lib/banda-esfuerzo";
import { construirLoQueHariaYo } from "../../../src/lib/lo-que-haria-yo";
import { recomendacionPagas } from "../../../src/lib/como-lo-pagas";
import type { HallazgoDistanciaVeredicto, Veredicto } from "../../../src/lib/types";

(globalThis as any).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const CLASE: Record<Veredicto, string> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };
/** La escala esperada, escrita ACÁ con los cortes crudos y no con `escalaCelda`: si el test
 *  llamara a la función que vigila, una escala rota se daría la razón a sí misma. */
const ESCALA_ESPERADA = (d: number | null) =>
  d === null ? "fx" : d === 0 ? "e0" : d <= BANDA_TOPE_FACTIBLE_PCT ? "e1" : d <= BANDA_TOPE_ARGUMENTOS_PCT ? "e2" : "e3";
const FILAS_TABLA = ["veredicto", "descuento", "precio", "pie", "cuota", "flujo", "coc", "cap", "tir", "score"];
/** Las filas que llevan el ⓘ del informe. */
const FILAS_CON_GLOSA = ["coc", "cap", "tir", "score"];
/** Una fila de la tabla por su `data-fila`, con sus dos celdas de datos. */
const filaTabla = (h: string, k: string) => {
  const m = h.match(new RegExp(`<tr data-fila="${k}">([\\s\\S]*?)</tr>`));
  if (!m) return null;
  const tds = m[1].match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
  return { rotulo: tds[0] ?? "", hoy: tds[1] ?? "", asi: tds[2] ?? "" };
};

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
      createElement(PopupAjustes, {
        veredicto: r.v, modalidad: "LTR", distancia: r.dist, mixComprar: r.res.mixComprar ?? null, currency: "CLP", valorUF: AUDIT_UF, precioUF: Number(r.input.precio),
        // «Hoy» con un score CENTINELA: la tabla tiene que imprimir el que le pasa el hero, no otro.
        antes: { cuotaMensual: r.res.metrics?.dividendo ?? null, flujoMensual: r.res.metrics?.flujoNetoMensual ?? null, cocPct: null, capRateNetoPct: null, tirPct: null, score: 7 },
      }),
    );
  const botones = (h: string) =>
    (h.match(/<button[^>]*data-pie="[^"]*"[^>]*>/g) ?? []).map((tag) => ({
      pie: Number(tag.match(/data-pie="([^"]*)"/)?.[1]),
      plazo: Number(tag.match(/data-plazo="([^"]*)"/)?.[1]),
      veredicto: tag.match(/data-veredicto="([^"]*)"/)?.[1] ?? "",
      clase: tag.match(/class="([^"]*)"/)?.[1] ?? "",
    }));

  /** La celda que el panel muestra al abrir: la de Franco, si no la tuya, si no la primera. */
  const fr0 = (r: (typeof filas)[number]) => {
    const g = grillaDelPopup({ veredicto: r.v, distancia: r.dist, mixComprar: r.res.mixComprar ?? null });
    const cs = g?.celdas ?? [];
    return celdaFranco({ veredicto: r.v, distancia: r.dist, grilla: g }) ?? cs.find((c) => c.esActual) ?? cs[0] ?? null;
  };
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

    // ── G1 · la celda dice la verdad de esa combinación ──────────────────────
    const tope = r.dist?.valor.topePct ?? 30;
    for (const c of celdas) {
      const l = lecturaCelda(c, esComprar, tope);
      if (l.veredicto !== c.veredictoSinDescuento) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: el modelo lee ${l.veredicto} y la combinación al precio pedido es ${c.veredictoSinDescuento}`);
      const b = bs.find((x) => x.pie === c.piePct && x.plazo === c.plazoAnios);
      if (!b) { F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: la celda no aparece en el HTML`); continue; }
      if (b.veredicto !== c.veredictoSinDescuento) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: el HTML dice ${b.veredicto} y la combinación al precio pedido es ${c.veredictoSinDescuento}`);
      const clases = b.clase.split(/\s+/);
      if (esComprar) {
        if (!clases.includes(CLASE[c.veredictoSinDescuento])) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: en Comprar el color (${b.clase}) no es el del veredicto ${c.veredictoSinDescuento}`);
      } else {
        const esp = ESCALA_ESPERADA(c.descuentoPct);
        if (!clases.includes(esp)) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: pide ${c.descuentoPct === null ? "más que el tope" : `−${c.descuentoPct}%`} y la escala (${b.clase}) no es «${esp}»`);
        if (clases.some((k) => k === "a" || k === "b" || k === "c")) F(`G1 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: en Ajustar la celda volvió a pintarse por veredicto (${b.clase})`);
      }
    }
    // Las celdas de Ajustar, SIN la palabra del veredicto: el veredicto lo dice la frase.
    if (!esComprar) {
      const cuerpos = h.match(/<button[^>]*data-pie="[^"]*"[^>]*>[\s\S]*?<\/button>/g) ?? [];
      if (cuerpos.some((x) => /\bAjustar\b|Buscar otr/i.test(x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) || /class="l1"/.test(x))) F(`G1 · ${r.id}: una celda de Ajustar escribe la palabra del veredicto`);
      // …y la frase de la celda seleccionada nombra su veredicto REAL al precio pedido.
      const s0 = fr0(r) ;
      if (s0 && s0.descuentoPct !== 0) {
        const panel = h.slice(h.indexOf("pjx-panel"));
        const primera = panel.match(/pjx-v (c|a|b)/)?.[1];
        if (primera !== CLASE[s0.veredictoSinDescuento]) F(`G1 · ${r.id}: la frase de pie ${s0.piePct} · ${s0.plazoAnios}a nombra «${primera}» y la combinación al precio pedido es ${s0.veredictoSinDescuento}`);
      }
      // …y fuera de alcance dice el tope REAL de la modalidad.
      for (const c of celdas.filter((x) => x.descuentoPct === null)) {
        const cuerpo = cuerpos.find((x) => x.includes(`data-pie="${c.piePct}"`) && x.includes(`data-plazo="${c.plazoAnios}"`)) ?? "";
        if (!cuerpo.includes(`más de ${tope}%`) || !/fuera de alcance/.test(cuerpo)) F(`6 · ${r.id} pie ${c.piePct} · ${c.plazoAnios}a: fuera de alcance no dice «más de ${tope}%» / «fuera de alcance»`);
      }
    }

    // ── G4 · Comprar no tiene celda de Franco ────────────────────────────────
    const fr = celdaFranco({ veredicto: r.v, distancia: r.dist, grilla });
    if (esComprar) {
      if (fr) F(`G4 · ${r.id}: Comprar marca una celda de Franco`);
      if (/pjx-tag fr/.test(h) || /\bfr\b/.test(bs.map((b) => b.clase).join(" "))) F(`G4 · ${r.id}: el HTML de Comprar lleva la marca «Franco»`);
      if (/más descuento/.test(h)) F(`6 · ${r.id}: Comprar dibuja las flechas de descuento (no hay descuento que pedir)`);
      if (/Analízalo a UF/.test(h)) F(`8 · ${r.id}: Comprar dibuja el botón de re-análisis`);
      // Comprar sigue como estaba: la tríada de leyenda y las cuatro cifras.
      if (!/pjx-ley/.test(h) || !/Toca una celda para ver qué pasa con esa combinación/.test(h)) F(`6 · ${r.id}: Comprar perdió la leyenda de la tríada o su línea «Toca una celda…»`);
      if (!/Pie el día uno/.test(h) || !/TIR a 10 años/.test(h) || !/Franco Score/.test(h) || !/pjx-cifras/.test(h)) F(`6 · ${r.id}: Comprar perdió sus cuatro cifras`);
      if (/pjx-tab/.test(h)) F(`6 · ${r.id}: Comprar dibuja la tabla de Ajustar`);
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
      const bloque = construirLoQueHariaYo({ veredicto: r.v, distancia: r.dist, currency: "CLP", valorUF: AUDIT_UF, precioUF: Number(r.input.precio) } as any);
      const pagas = recomendacionPagas({ veredicto: r.v, precioUF: Number(r.input.precio), piePctActual: Number(r.input.piePct), plazoActual: Number(r.input.plazoCredito), distancia: dv });
      const cardMix = bloque?.mix && bloque.mix.destino === "COMPRAR" ? bloque.mix : null;
      if (fr) {
        if (!cardMix) F(`G3 · ${r.id}: el pop-up marca a Franco en pie ${fr.piePct}% · ${fr.plazoAnios}a y la card no muestra esa combinación`);
        else {
          conCardMix++;
          const pieCard = cardMix.movimiento.pie?.a ?? dv.piePctActual ?? Number(r.input.piePct);
          const plazoCard = cardMix.movimiento.plazo?.a ?? Number(r.input.plazoCredito);
          const dCard = cardMix.descuento ? Number(cardMix.descuento.replace(/[^\d,]/g, "").replace(",", ".")) : 0;
          // «Poner ese pie cuesta X» = la diferencia de «Pie el día uno» de la tabla (25-sep-2026). El
          // motor redondea `costoDiaUnoUF` a UF enteras y la card lo usaba: media UF eran $20 mil de
          // diferencia en Providencia. Ahora las dos cuentas salen del mismo precio, exactas.
          if (cardMix.costo) {
            const precio = Number(r.input.precio);
            const esperado = Math.round((pieDiaUnoUF(fr, precio) - (Number(r.input.piePct) / 100) * precio) * AUDIT_UF);
            const enCard = Number(cardMix.costo.replace(/[^\d]/g, ""));
            if (Math.abs(enCard - esperado) > 1) F(`G3 · ${r.id}: la card dice que poner ese pie cuesta $${enCard} y la tabla del pop-up da $${esperado}`);
          }
          if (pieCard !== fr.piePct || plazoCard !== fr.plazoAnios || Math.abs(dCard - (fr.descuentoPct ?? 0)) > 0.05) F(`G3 · ${r.id}: la card recomienda pie ${pieCard}% · ${plazoCard}a · −${dCard}% y el pop-up marca pie ${fr.piePct}% · ${fr.plazoAnios}a · −${fr.descuentoPct}%`);
        }
        if (!pagas) F(`G3 · ${r.id}: «A qué precio cerrar» no tiene recomendación y el pop-up sí`);
        else if (pagas.pieA !== fr.piePct || pagas.plazoA !== fr.plazoAnios || Math.abs(pagas.descuentoPct - (fr.descuentoPct ?? 0)) > 0.05) F(`G3 · ${r.id}: «A qué precio cerrar» se ancla en pie ${pagas.pieA}% · ${pagas.plazoA}a · −${pagas.descuentoPct}% y el pop-up marca pie ${fr.piePct}% · ${fr.plazoAnios}a · −${fr.descuentoPct}%`);
      }
    }

    // ── 6 · anatomía (mockup final del 25-sep) ──────────────────────────────
    if (!/Toca una celda para ver cómo queda\./.test(h)) F(`6 · ${r.id}: falta la línea «Toca una celda para ver cómo queda.»`);
    if ((h.match(/<span>más descuento<\/span>/g) ?? []).length !== 2 || !/más pie/.test(h) || !/más plazo/.test(h)) F(`6 · ${r.id}: los ejes no son los cuatro del contrato (más pie, más plazo, más descuento ×2)`);
    // LA REGLA: tramos de ya es Comprar a fuera de alcance, fronteras 0 · 5 · 10 · tope real abajo.
    const sws = (h.match(/class="sw (fx|e0|e1|e2|e3)"/g) ?? []).map((x) => x.replace(/class="sw |"/g, ""));
    const regla = h.slice(h.indexOf("pjx-escala"), h.indexOf("pjx-tip"));
    const fronteras = (regla.match(/<b>(\d+)%<\/b>/g) ?? []).map((x) => x.replace(/<\/?b>/g, ""));
    if (!/Descuento que hay que negociar/.test(regla) || !/más descuento →/.test(regla) || sws.join(",") !== "e0,e1,e2,e3,fx") F(`6 · ${r.id}: la leyenda no es la regla del contrato, de ya es Comprar a fuera de alcance (${sws.join(",")})`);
    if (fronteras.join(",") !== `0%,5%,10%,${tope}%`) F(`6 · ${r.id}: las fronteras de la regla no son 0 · 5 · 10 · ${tope} (el tope real): ${fronteras.join(" · ")}`);
    if (/\(/.test(regla.replace(/<[^>]+>/g, ""))) F(`6 · ${r.id}: la regla volvió a los porcentajes entre paréntesis`);
    if (/pjx-ley/.test(h)) F(`6 · ${r.id}: Ajustar volvió a la leyenda de la tríada de veredictos`);
    const sel0 = fr0(r);
    if (sel0 && sel0.descuentoPct !== null) {
      const filasTab = (h.match(/<tr data-fila="([^"]+)">/g) ?? []).map((x) => x.replace(/<tr data-fila="|">/g, ""));
      if (filasTab.join("|") !== FILAS_TABLA.join("|")) F(`6 · ${r.id}: la tabla Hoy / Así no tiene las diez filas del contrato, veredicto arriba: ${filasTab.join(" · ")}`);
      // El veredicto arriba, con los chips: hoy el del informe; así el de la celda con su descuento.
      const ver = filaTabla(h, "veredicto");
      if (!ver || !ver.hoy.includes(`pjx-v ${CLASE[r.v]}`) || !ver.asi.includes(`pjx-v ${CLASE[sel0.veredicto]}`)) F(`6 · ${r.id}: la fila de veredicto no dice hoy ${r.v} y así ${sel0.veredicto} con los chips de la tríada`);
      // El ⓘ del informe en las cuatro filas de indicadores, y en ninguna otra.
      for (const k of FILAS_TABLA) {
        const f = filaTabla(h, k);
        const tiene = !!f && /class="v-i/.test(f.rotulo);
        if (FILAS_CON_GLOSA.includes(k) !== tiene) F(`6 · ${r.id}: la fila «${k}» ${tiene ? "lleva" : "no lleva"} el ⓘ del informe`);
      }
      // El puntaje: «Hoy» el del hero (7), «Así» el de la celda, cada uno con el color de SU veredicto.
      const sc = filaTabla(h, "score");
      const num = (td: string) => td.replace(/<[^>]+>/g, "");
      if (!sc || num(sc.hoy) !== "7" || num(sc.asi) !== String(sel0.score ?? "—")) F(`6 · ${r.id}: la fila Franco Score no es «Hoy» del hero (7) y «Así» de la celda (${sel0.score}): ${sc ? `${num(sc.hoy)} / ${num(sc.asi)}` : "sin fila"}`);
      else if (!sc.hoy.includes(`pjx-sc ${CLASE[r.v]}`) || (sel0.score != null && !sc.asi.includes(`pjx-sc ${CLASE[sel0.veredicto]}`))) F(`6 · ${r.id}: el puntaje no lleva el color de su veredicto (hoy ${r.v}, así ${sel0.veredicto})`);
      if (/pjx-cifras/.test(h)) F(`6 · ${r.id}: Ajustar volvió a las cuatro cifras en tarjetas; es una tabla`);
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

    // (c) FUERA DE ALCANCE Y FRASE CON OTRO VEREDICTO (25-sep-2026). Medido: en las 8 filas Ajustar
    //     del golden ninguna celda queda fuera de alcance, y la celda que abre el panel siempre es
    //     Comprar sin descuento o Ajustar. Sin esto, «más de X%» con el tope real y la frase que
    //     nombra el veredicto real no se ejercitaban nunca. Sobre la grilla real: una celda que no
    //     llega, con el tope de renta corta (25), y la celda Franco en Buscar otra al precio pedido.
    const g = dist.valor.mixPalancas!;
    const otra = g.celdas!.find((c) => !c.esElegida)!;
    const celdasC = g.celdas!.map((c) =>
      c.esElegida ? { ...c, descuentoPct: 4.2, veredictoSinDescuento: "BUSCAR OTRA" as Veredicto } : c === otra ? { ...c, descuentoPct: null } : c,
    );
    const distC = { ...dist, valor: { ...dist.valor, topePct: 25, mixPalancas: { ...g, celdas: celdasC } } } as HallazgoDistanciaVeredicto;
    const hC = renderToStaticMarkup(
      createElement(PopupAjustes, { veredicto: "AJUSTA SUPUESTOS", modalidad: "STR", distancia: distC, mixComprar: null, currency: "CLP", valorUF: AUDIT_UF, precioUF: Number(base.input.precio) }),
    );
    const cuerpoOtra = (hC.match(/<button[^>]*data-pie="[^"]*"[^>]*>[\s\S]*?<\/button>/g) ?? []).find((x) => x.includes(`data-pie="${otra.piePct}"`) && x.includes(`data-plazo="${otra.plazoAnios}"`)) ?? "";
    if (!/class="pjx-celda fx/.test(cuerpoOtra) || !cuerpoOtra.includes("más de 25%") || !/fuera de alcance/.test(cuerpoOtra)) F("6 · una celda que no llega no se dibuja rayada con «más de 25%» / «fuera de alcance» (el tope real de renta corta)");
    const reglaC = hC.slice(hC.indexOf("pjx-escala"), hC.indexOf("pjx-tip"));
    const frC = (reglaC.match(/<b>(\d+)%<\/b>/g) ?? []).map((x) => x.replace(/<\/?b>/g, "")).join(",");
    if (frC !== "0%,5%,10%,25%") F(`6 · con el tope de renta corta la regla no termina en 25%: ${frC}`);
    const panelC = hC.slice(hC.indexOf("pjx-panel"));
    if (panelC.match(/pjx-v (c|a|b)/)?.[1] !== "b") F("G1 · la frase de la celda Franco no nombra su veredicto real al precio pedido (Buscar otra): dice otro");
    if (!/pasa de/.test(panelC)) F("G1 · la frase de la celda con descuento no dice «pasa de … a Comprar»");
    if (!/Cap rate</.test(hC) || /Cap rate neto</.test(hC)) F("6 · en renta corta la tabla no rotula «Cap rate» (el neto es de renta larga)");

    // (d) EL CAMINO DE MERCADO (25-sep-2026). Sobre la misma fila, con una palanca de arriendo que
    //     cruza sola (actual 500.000 → objetivo 560.000, +12%): el bloque dice lo supuesto contra lo
    //     que haría falta y el contexto. En LTR, con avisos que piden MENOS que lo que haría falta,
    //     tiene que decir que queda sobre lo que piden; con avisos que piden MÁS, que está dentro.
    //     En STR, que es una señal: no guardamos tarifas de comparables.
    const arr = { palanca: "arriendo", actual: 500000, objetivo: 560000, deltaPct: 12 } as any;
    const conArr = (modalidad: "LTR" | "STR", palanca: any, ref: any) =>
      renderToStaticMarkup(
        createElement(PopupAjustes, {
          veredicto: "AJUSTA SUPUESTOS", modalidad, currency: "CLP", valorUF: AUDIT_UF, precioUF: Number(base.input.precio), referenciaArriendo: ref,
          distancia: { ...dist, valor: { ...dist.valor, palancas: [palanca], palancasHastaComprar: [palanca] } } as HallazgoDistanciaVeredicto,
        }),
      );
    const mkt = (x: string) => x.slice(x.indexOf("pjx-mkt"));
    const bajo = mkt(conArr("LTR", arr, { valorCLP: 520000, n: 18, radioMetros: 800, fuente: "radio" }));
    if (!/pjx-mkt/.test(bajo) || !/Un camino que no depende de ti/.test(bajo)) F("7 · con una palanca de arriendo que cruza, no aparece el bloque del camino de mercado");
    else {
      if (!/\$500\.000/.test(bajo) || !/\$560\.000/.test(bajo) || !/\+12,0%/.test(bajo)) F("7 · el bloque no compara lo supuesto ($500.000) contra lo que haría falta ($560.000, +12,0%)");
      if (!/18 avisos parecidos en 800 m piden \$520\.000/.test(bajo)) F("7 · en LTR el bloque no dice cuánto piden los avisos parecidos del radio");
      if (!/queda 7,7% sobre lo que piden/.test(bajo)) F("7 · en LTR, con la cifra que haría falta sobre lo que piden los avisos, el bloque no lo dice");
    }
    const alto = mkt(conArr("LTR", arr, { valorCLP: 600000, n: 18, radioMetros: 800, fuente: "radio" }));
    if (/sobre lo que piden/.test(alto) || !/dentro de lo que piden/.test(alto)) F("7 · en LTR, con avisos que piden más que lo que haría falta, el bloque no dice que está dentro");
    const str = mkt(conArr("STR", { ...arr, palanca: "adr", actual: 55000, objetivo: 60005, deltaPct: 9.1 }, { valorCLP: 70000, n: 18, radioMetros: 800, fuente: "radio" }));
    if (!/Tómalo como señal, no como plan/.test(str) || !/Tarifa por noche que supusiste/.test(str) || /avisos parecidos en/.test(str)) F("7 · en STR el bloque no dice que es una señal (sin tarifas de comparables) o no habla de la tarifa");
  }

  if (conGrilla === 0) F("0 · ninguna fila del golden tiene grilla: el tier no midió nada");
  if (conFranco === 0) F("0 · ninguna fila del golden tiene celda de Franco: G2 y G3 no midieron nada");
  if (conCardMix === 0) F("0 · ninguna fila comparó la card con el pop-up: G3 no midió nada");

  // ── Fuente: lo que salió no vuelve, y los heros no abren pop-up en Buscar otra ──
  const pop = sinComentarios(leer("src/components/analysis/shared/PopupAjustes.tsx"));
  if (!/grillaDelPopup\(/.test(pop) || !/lecturaCelda\(/.test(pop) || !/celdaFranco\(/.test(pop)) F("1 · el pop-up no lee la grilla, la lectura de la celda o la celda de Franco del modelo (`matriz-popup.ts`)");
  if (/Hay más de un camino|Lo que Franco recomienda|La que más rinde|La que más alivia el mes/.test(pop)) F("6 · volvió el menú de tres respuestas");
  if (/Cuota mensual|El ajuste óptimo/.test(pop)) F("6 · volvieron los pares hoy → después");
  // Los bordes finos del mockup final: Franco 2 px sólido, hoy 1,5 px punteado.
  const tok = leer("src/components/analysis/shared/PopupAjustesTokens.tsx");
  if (!/\.pjx-celda\.fr\{border:2px solid var\(--doc-tx\)\}/.test(tok) || !/\.pjx-celda\.hoy\{border:1\.5px dashed/.test(tok)) F("6 · los bordes de Franco (2 px sólido) y de hoy (1,5 px punteado) no son los del contrato");
  if (/\.pjx-celda\.(fr|hoy)\{outline:3px/.test(tok)) F("6 · volvieron los contornos gruesos de 3 px");
  if (/Un cambio a la vez/.test(pop)) F("6 · volvió «Un cambio a la vez»");
  if (!/Un camino que no depende de ti/.test(pop) || !/Si la zona paga más, también llega a/.test(pop)) F("7 · falta el bloque del camino de mercado («Un camino que no depende de ti»)");
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
    console.log(`  ✓ VERDE — ${conGrilla} grillas del golden: cada celda dice la verdad de su combinación (escala del descuento en Ajustar, veredicto en Comprar, frase con el veredicto real), Franco nunca más difícil que la más fácil (${conFranco} filas), card, pop-up y capítulo con la misma recomendación (${conCardMix}), Comprar sin Franco, Buscar otra sin pop-up, la anatomía del contrato y el botón inerte`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPopupAjustesTier();
  process.exit(hard ? 1 : 0);
}
