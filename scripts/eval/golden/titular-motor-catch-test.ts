/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL TITULAR DEL MOTOR Y LA PÁGINA QUE NO ESPERA A LA IA — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: la portada lee el titular del motor en TODAS las filas y el de la IA deja
// de mostrarse; la página no espera a la prosa (sin skeleton, sin «¿Conviene o no conviene?»),
// todo al primer render. La maquinaria de la IA sigue viva: se retira por partes.
// Contrato: docs/wireframes/rediseno-informe/titular-motor-vs-ia.html.
//
// FIJA, verificado EN ROJO por mutación:
//   1 · EL TITULAR NO CONTRADICE SU VEREDICTO: abre con la fórmula del suyo («Conviene» /
//       «Para Comprar:» · «Llega a Comprar» · «Así no cierra» / «No conviene»).
//   2 · EL TITULAR NO CITA NADA QUE LA CARD NO DIGA: cada cifra del titular está en la card
//       RENDERIZADA (LoQueHariaYoBloque / CardBuscarOtra), y la banda, el «depende del mercado» y
//       el «muy difícil» también.
//   3 · NO PASA DE 15 PALABRAS, un solo plumón, sin montos (`validarTitular`).
//   4 · LA PORTADA LEE EL TITULAR DEL MOTOR, construido con la misma card que el hero, y no el de
//       la IA, en LTR y en STR.
//   5 · LA PÁGINA NO MONTA NADA QUE ESPERE A LA PROSA: sin sondeo de /ai-status, sin generar ni
//       rescatar desde el cliente, sin bloque de espera ni skeleton, sin «¿Conviene o no
//       conviene?», sin CTA que espere a la prosa, sin el aviso «Análisis generado por IA».
// Las filas son las del golden (AUDIT_FIXTURES LTR con el motor vivo, y las seeds STR
// recomputadas con su simulación). Un piso de cobertura exige que las ramas de la card que el
// golden ejercita sigan midiéndose.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/titular-motor-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { AUDIT_FIXTURES, AUDIT_UF } from "../fixtures";
import { construirCardLtr, construirCardStr, type CardRecomendacion } from "../../../src/lib/card-recomendacion";
import { titularMotor, type RamaTitular } from "../../../src/lib/titular-motor";
import { validarTitular, stripMarcas } from "../../../src/lib/prosa-marcas";
import { ETIQUETA_BANDA } from "../../../src/lib/banda-esfuerzo";
import { LoQueHariaYoBloque, CardBuscarOtra } from "../../../src/components/analysis/shared/LoQueHariaYoBloque";
import { recomputeStrSeed } from "./str-recompute";
import { STR_GE_SEEDS } from "./str-seeds";
import type { Veredicto } from "../../../src/lib/types";

(globalThis as any).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const numeros = (t: string) => (stripMarcas(t).match(/\d+(?:,\d+)?/g) ?? []);

const APERTURA: Record<Veredicto, RegExp> = {
  COMPRAR: /^Conviene\b/,
  "AJUSTA SUPUESTOS": /^(Para Comprar:|Llega a Comprar\b|Así no cierra\b)/,
  "BUSCAR OTRA": /^No conviene\b/,
};

/** La card como la ve el lector: el mismo componente que dibuja la página. */
function textoCard(v: Veredicto, card: CardRecomendacion): string {
  const el = card.buscar
    ? createElement(CardBuscarOtra, { causa: card.buscar.causa, distancia: card.buscar.distancia })
    : card.bloque
      ? createElement(LoQueHariaYoBloque, { bloque: card.bloque, veredicto: v })
      : null;
  return el ? renderToStaticMarkup(el).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "";
}

/** Los chequeos 1-3 sobre UNA fila. Devuelve las fallas. */
export function chequearTitular(id: string, v: Veredicto, modalidad: "ltr" | "str", card: CardRecomendacion): { fallas: string[]; rama: RamaTitular } {
  const f: string[] = [];
  const { titular, rama } = titularMotor({ veredicto: v, modalidad, card });
  const plano = stripMarcas(titular);
  if (!APERTURA[v].test(plano)) f.push(`1 · ${id}: el titular no abre con la fórmula de ${v}: «${plano}»`);
  // Minúscula después de los dos puntos (25-sep-2026, Fabrizio): «No conviene: llegar a Comprar…».
  if (/^No conviene: [A-ZÁÉÍÓÚÑ]/.test(plano)) f.push(`1 · ${id}: mayúscula después de «No conviene:»: «${plano}»`);
  const val = validarTitular(titular);
  if (!val.ok) f.push(`3 · ${id}: el titular no pasa el formato (${val.motivo}): «${plano}»`);
  const card_ = textoCard(v, card);
  const enCard = new Set(numeros(card_));
  const faltan = numeros(titular).filter((n) => !enCard.has(n));
  if (faltan.length) f.push(`2 · ${id}: el titular cita ${faltan.join(", ")} y la card no: «${plano}» · card: «${card_.trim().slice(0, 160)}»`);
  for (const b of Object.values(ETIQUETA_BANDA)) {
    if (v !== "BUSCAR OTRA" && plano.includes(b) && !card_.includes(b)) f.push(`2 · ${id}: el titular dice «${b}» y la card no`);
  }
  if (/depende del mercado/.test(plano) && v !== "BUSCAR OTRA" && !/depende del mercado/.test(card_)) f.push(`2 · ${id}: el titular dice «depende del mercado» y la card no`);
  if (/muy difícil/.test(plano) && !/muy difícil/.test(card_)) f.push(`2 · ${id}: el titular dice «muy difícil» y la card no`);
  return { fallas: f, rama };
}

export function runTitularMotorTier(): { hard: number } {
  console.log("\n─── TIER TITULAR-MOTOR (el titular reproduce la card · la página no espera a la IA · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const ramas = new Set<RamaTitular>();
  let filas = 0;

  // LTR: las filas del golden con el motor vivo.
  for (const fx of AUDIT_FIXTURES.filter((x: any) => x.ltrInput) as any[]) {
    const res: any = runAnalysis(fx.ltrInput, AUDIT_UF, fx.ltrMediana, new Date("2026-09-25T12:00:00Z"));
    const v = res.veredicto as Veredicto;
    const card = construirCardLtr({ veredicto: v, results: res, inputData: fx.ltrInput, currency: "CLP", valorUF: AUDIT_UF });
    const r = chequearTitular(`ltr ${fx.id}`, v, "ltr", card);
    fallas.push(...r.fallas);
    ramas.add(r.rama);
    filas++;
  }
  // STR: las seeds recomputadas con su simulación, como la página.
  const frozen = JSON.parse(readFileSync(join(__dirname, "str-seeds-frozen.json"), "utf8"));
  for (const seed of STR_GE_SEEDS) {
    const r0 = recomputeStrSeed(seed, frozen);
    if (!r0) continue;
    const v = r0.score.veredicto as Veredicto;
    const results = { ...r0.rec, hallazgos: r0.hz, francoScore: r0.score } as any;
    const card = construirCardStr({ veredicto: v, results, simulacion: r0.sim, currency: "CLP", valorUF: r0.d.precioCompra / r0.d.precioCompraUF });
    const r = chequearTitular(`str ${seed.key}`, v, "str", card);
    fallas.push(...r.fallas);
    ramas.add(r.rama);
    filas++;
  }
  // PISO DE COBERTURA: las ramas que el golden ejercita hoy tienen que seguir midiéndose. Si una
  // desaparece, el tier deja de probarla sin avisar (un cero que no distingue «no corrió»).
  const PISO: RamaTitular[] = ["comprar_fuerte", "ajustar_mix_sin_descuento", "ajustar_mix_descuento", "buscar_distancia"];
  for (const r of PISO) if (!ramas.has(r)) F(`0 · ninguna fila del golden ejercita la rama «${r}» del titular: el tier no la mide`);
  if (filas < 10) F(`0 · el tier midió ${filas} filas: el golden no llegó`);

  // ── 4 · la portada lee el titular del motor, con la misma card que el hero ──
  const GRID = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  const STR = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
  const HERO_LTR = sinComentarios(leer("src/components/analysis/HeroLTR.tsx"));
  const HERO_STR = sinComentarios(leer("src/components/analysis/str/HeroStrDictamen.tsx"));
  for (const [nombre, src, cons] of [["LTR (SubjectCardGrid)", GRID, "construirCardLtr"], ["STR (results-client)", STR, "construirCardStr"]] as const) {
    if (!new RegExp(`titularMotor\\(\\{[\\s\\S]{0,200}card: ${cons}\\(`).test(src)) F(`4 · la portada ${nombre} no escribe el titular con titularMotor sobre ${cons}`);
    if (!/titular=\{titularPortada\}/.test(src)) F(`4 · la portada ${nombre} no recibe el titular del motor`);
    if (/\?\.titular\b|\.titular \?\?/.test(src)) F(`4 · ${nombre} volvió a leer el titular de la IA`);
  }
  if (!/construirCardLtr\(/.test(HERO_LTR)) F("4 · HeroLTR no construye la card con construirCardLtr: la portada y la card podrían decir cosas distintas");
  if (!/construirCardStr\(/.test(HERO_STR)) F("4 · HeroStrDictamen no construye la card con construirCardStr: la portada y la card podrían decir cosas distintas");

  // ── 5 · la página no monta nada que espere a la prosa ──
  const PAGINA: [string, string][] = [
    ["LTR results-client", sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"))],
    ["SubjectCardGrid", GRID],
    ["HeroLTR", HERO_LTR],
    ["STR results-client", STR],
    ["HeroStrDictamen", HERO_STR],
  ];
  const ESPERA: [RegExp, string][] = [
    [/ai-status/, "sondea /ai-status"],
    [/["`]\/api\/analisis\/(short-term\/)?ai["`]/, "genera o rescata la prosa desde el cliente"],
    [/\bBloqueEsperaInforme\b|\bProgresoGeneracion\b/, "monta el bloque de espera o el skeleton de la prosa"],
    [/¿Conviene o no conviene\?/, "monta «¿Conviene o no conviene?»"],
    [/\baiLoading\b|\bsetAiAnalysis\b|\bprosaLista\b|\bmaterializa\b/, "tiene estado que espera a la prosa"],
    [/aiAnalysis != null/, "gatea contenido a que llegue la prosa"],
    [/generado por IA/, "dice «Análisis generado por IA»"],
  ];
  for (const [nombre, src] of PAGINA) for (const [re, que] of ESPERA) if (re.test(src)) F(`5 · ${nombre} ${que}`);

  if (fallas.length) {
    console.log(`  ✗ TITULAR-MOTOR · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${filas} filas del golden: el titular abre con su veredicto, no cita nada que la card no diga y cabe en 15 palabras (${ramas.size} ramas de la card); la portada lo lee del motor con la misma card que el hero, y la página no espera a la prosa`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runTitularMotorTier();
  process.exit(hard ? 1 : 0);
}
