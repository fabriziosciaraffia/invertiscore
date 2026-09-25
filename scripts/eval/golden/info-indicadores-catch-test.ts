/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER INFO-INDICADORES (23-sep-2026) · el ⓘ de los indicadores y sus nombres de mercado.
// Mockup aprobado: docs/wireframes/rediseno-informe/info-indicadores.html (opción A).
//
// Decisiones de Fabrizio que fija:
//   1 · EL ⓘ SE APILA SIN CERRAR LA HOJA DE ABAJO. La hoja chica de una glosa se abre encima de la
//       hoja de un capítulo o de la planilla; atrás y Esc cierran SOLO la de arriba. Se ejercita la
//       pila (`hoja-pila.ts`) con un entorno falso —historial y teclado de mentira— y se fija el
//       cableado: el ⓘ abre la hoja chica por `Modal variante="glosa"` y el popover entra a la pila.
//   2 · «RETORNO SOBRE LO PUESTO» NO EXISTE en lo que se dibuja. Afuera, declarados: los prompts de
//       IA (`ai-generation*.ts`), que enseñan la expresión a propósito y la fija el tier
//       prompt-v20-str; sacarla de ahí es un bump de prompt, no este cambio.
//   3 · EL CAP RATE STR NO DICE «NETO» NI «POR DÍA»: tiene uno solo y es anual.
//   4 · EL HERO Y EL CAPÍTULO I LEEN LA MISMA REFERENCIA STR (`referenciaCapRateStr`), no la
//       constante de 5%. Se renderiza el hero con una referencia de zona de 2,2 y se exige que diga
//       2,2 y no 5,0; y sin referencia, que no compare.
//   5 · SIN CURSIVA EN CAP RATE NI EN CASH ON CASH, en ningún lado: sin `<Ang>`, sin `angliza`, sin
//       `.ang{font-style:italic}`, sin `<em>`/`<i>` alrededor del nombre, y «cash on cash» sin guiones.
//   6 · FILADATO NO USA `title`: se renderiza una fila con `tip` y se exige el botón del ⓘ, sin
//       atributo `title`.
//   + los cortes del score, a constante, y el texto del ⓘ del Franco Score leyéndolos.
//
// Verificado EN ROJO por mutación (ver el acta en el mensaje del commit).
// Corre solo: node --import tsx scripts/eval/golden/info-indicadores-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { crearPila } from "../../../src/lib/hoja-pila";
import { GLOSAS, rotuloCapRate } from "../../../src/lib/glosas-indicadores";
import { SCORE_CORTE_AJUSTA, SCORE_CORTE_COMPRAR } from "../../../src/lib/score-cortes";
import { TIR_LIMITE_PCT } from "../../../src/lib/tir-limite";
import { FilaDato } from "../../../src/components/analysis/shared/FilaDato";
import { SeisCifrasStr } from "../../../src/components/analysis/str/SeisCifrasStr";

// Los componentes compilan con runtime clásico bajo tsx (mismo recurso que scripts/of-render-documento.tsx).
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Lo que se dibuja o se escribe: sin comentarios de bloque, de JSX ni de línea. */
const visible = (s: string) =>
  s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const archivos = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, n);
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
};

export function runInfoIndicadoresTier(): { hard: number } {
  console.log("\n─── TIER INFO-INDICADORES (el ⓘ y los nombres de mercado · 0 tokens) ───");

  // ── 1 · la pila: atrás y Esc cierran solo la de arriba ─────────────────────
  {
    const historia: string[] = [];
    let onPop = () => {};
    let onEsc = () => {};
    const pila = crearPila({
      pushState: () => historia.push("hoja"),
      // back() dispara popstate en el navegador, de forma asíncrona: acá, en el acto.
      back: () => { historia.pop(); onPop(); },
      escuchar: (p, e) => { onPop = p; onEsc = e; },
    });
    const cerradas: string[] = [];
    // Como el Modal: el nivel sale de la pila cuando su dueño se cierra (efecto de limpieza).
    const abrir = (nombre: string, conHistorial: boolean) => {
      let id = 0;
      id = pila.apilar(() => { cerradas.push(nombre); pila.desapilar(id); }, { conHistorial });
      return id;
    };
    const atras = () => { historia.pop(); onPop(); };

    // a · capítulo (hoja) + glosa (hoja chica): atrás cierra la glosa y deja el capítulo.
    abrir("capítulo", true);
    abrir("glosa", true);
    if (historia.length !== 2) F(`1 · cada nivel con historial empuja su entrada (hay ${historia.length}, se esperaban 2)`);
    atras();
    if (cerradas.join() !== "glosa") F(`1 · atrás con la glosa encima cerró «${cerradas.join(", ")}», no solo la glosa`);
    if (pila.profundidad() !== 1) F("1 · tras atrás el capítulo tiene que seguir abierto");
    // b · Esc con los dos abiertos cierra solo el de arriba.
    cerradas.length = 0;
    abrir("glosa", true);
    onEsc();
    if (cerradas.join() !== "glosa") F(`1 · Esc con la glosa encima cerró «${cerradas.join(", ")}», no solo la glosa`);
    if (pila.profundidad() !== 1) F("1 · tras Esc el capítulo tiene que seguir abierto");
    // c · cerrar la glosa con ✕ consume SU entrada y ese popstate no llega al capítulo.
    cerradas.length = 0;
    const g = abrir("glosa", true);
    pila.desapilar(g); // la ✕ desmonta la glosa: el Modal la saca de la pila
    if (cerradas.length !== 0) F(`1 · cerrar la glosa con ✕ cerró además «${cerradas.join(", ")}»`);
    if (historia.length !== 1) F(`1 · cerrar la glosa con ✕ no consumió su entrada de historial (quedan ${historia.length})`);
    // d · el popover de escritorio no ocupa historial pero sí escucha Esc primero.
    const antes = historia.length;
    abrir("popover", false);
    if (historia.length !== antes) F("1 · el popover de escritorio empujó una entrada de historial");
    onEsc();
    if (cerradas.join() !== "popover" || pila.profundidad() !== 1) F("1 · Esc con el popover abierto no cerró solo el popover");
    // e · y el último atrás sí cierra el capítulo.
    cerradas.length = 0;
    atras();
    if (cerradas.join() !== "capítulo" || pila.profundidad() !== 0) F("1 · atrás con solo el capítulo no lo cerró");

    // El cableado: el ⓘ abre la hoja chica por el Modal, y el popover entra a la pila.
    const G = visible(leer("src/components/analysis/shared/Glosa.tsx"));
    if (!/<Modal abierto=\{abierto\} onClose=\{cerrar\} titulo=\{titulo\} variante="glosa" ancla=\{boton\.current\}>/.test(G)) F("1 · el ⓘ no abre la hoja chica con Modal variante=\"glosa\"");
    if (!/pila\.apilar\(\(\) => onCloseRef\.current\(\), \{ conHistorial: false \}\)/.test(G)) F("1 · el popover no entra a la pila (Esc cerraría también el panel de abajo)");
    if (!/pila\.desapilar\(nivel\)/.test(G)) F("1 · el popover no sale de la pila al cerrarse");
    const V = visible(leer("src/components/analysis/hallazgos/vocabulario.tsx"));
    if (!/createPortal\(<div className="doc-tokens">\{nodo\}<\/div>, destino\)/.test(V)) F("1 · la hoja chica no va en portal (quedaría dentro de la hoja de abajo, que recorta y se transforma)");
    if (!/if \(!primero\) return \(\) => pila\.desapilar\(id\);/.test(V)) F("1 · el segundo nivel vuelve a bloquear el body (al cerrar devolvería la página al principio)");
    const css = leer("src/components/analysis/shared/TokensShared.tsx");
    if (!/\.v-modal-overlay\.v-glosa-overlay\{z-index:70\}/.test(css)) F("1 · la hoja chica no queda por encima de la hoja de abajo (z-index)");
    if (!/\.v-i\{[^}]*width:24px;height:24px/.test(css)) F("1 · el disparador del ⓘ no mide 24 × 24");
  }

  // ── 2 · «Retorno sobre lo puesto» no existe en lo que se dibuja ────────────
  {
    const FUERA = /^src\/(app\/dev\/|lib\/ai-generation)/;
    for (const p of archivos("src")) {
      if (FUERA.test(p)) continue;
      const hits = visible(leer(p)).match(/retorno sobre (?:lo|el capital) puesto/gi);
      if (hits) F(`2 · ${p} dice «${hits[0]}» ${hits.length} vez/veces`);
    }
  }

  // ── 3 · el cap rate STR: uno solo, anual ──────────────────────────────────
  {
    if (rotuloCapRate("STR") !== "Cap rate") F(`3 · rotuloCapRate("STR") dice «${rotuloCapRate("STR")}»`);
    if (rotuloCapRate("LTR") !== "Cap rate neto" || rotuloCapRate("LTR", "bruta") !== "Cap rate bruto") F("3 · los rótulos LTR dejaron de ser «Cap rate neto» / «Cap rate bruto»");
    for (const p of ["src/components/analysis/str/SeisCifrasStr.tsx", "src/components/analysis/str/CapitulosInversionStr.tsx", "src/components/analysis/str/ModalCalculoStr.tsx", "src/components/analysis/str/HeroStrDictamen.tsx"]) {
      const v = visible(leer(p));
      if (/cap rate\W+(?:neto|por d[ií]a|STR)\b/i.test(v)) F(`3 · ${p} rotula el cap rate STR con «neto», «por día» o «STR»`);
    }
    const P = visible(leer("src/components/analysis/shared/PopupAjustes.tsx"));
    if (/"Cap rate neto"/.test(P)) F("3 · el pop-up volvió a escribir «Cap rate neto» a mano (en STR es «Cap rate»)");
    // ⚠ ACTA (25-sep-2026) · el cap rate VUELVE al pop-up, como fila de la tabla Hoy / Así del
    // mockup final (el 24-sep había salido con los pares y este chequeo quedó condicional). Vuelve
    // a ser obligatorio: la fila se rotula por modalidad, «Cap rate neto» en LTR y «Cap rate» en STR.
    if (!/r: rotuloCapRate\(modalidad\)/.test(P)) F("3 · el pop-up no rotula el cap rate de la tabla por modalidad");
    if (!/modalidad="STR"/.test(visible(leer("src/components/analysis/str/HeroStrDictamen.tsx")))) F("3 · el hero STR no le dice al pop-up que es STR");
    if (!/modalidad="LTR"/.test(visible(leer("src/components/analysis/HeroLTR.tsx")))) F("3 · el hero LTR no le dice al pop-up que es LTR");
  }

  // ── 4 · el hero y el capítulo I, con la misma referencia STR ─────────────
  {
    const fx = (JSON.parse(leer("src/app/dev/drawers-pixel/fixtures.json")) as Record<string, any>).staRosaStr;
    if (!fx) F("4 · falta el fixture staRosaStr");
    else {
      const render = (hallazgos: unknown[]) =>
        renderToStaticMarkup(createElement(SeisCifrasStr, { results: { ...fx.results, hallazgos } as never, currency: "CLP", valorUF: 40000 }));
      const conZona = render([{ id: "rentabilidad_str", valor: { umbralPct: 2.2, nivel: "celda", comuna: "Providencia", celdaDormitorios: 2 } }]);
      if (!/La referencia de la zona es 2,2%/.test(conZona)) F("4 · con la zona en 2,2 el hero no dice «la referencia de la zona es 2,2%»");
      if (/5,0%/.test(conZona)) F("4 · con la zona en 2,2 el hero sigue citando el 5,0% de la constante");
      const sinZona = render([]);
      if (!/No hay Airbnb suficientes de la zona para compararlo/.test(sinZona) || /La referencia de la zona/.test(sinZona)) F("4 · sin referencia de la zona el hero compara igual");
    }
    const H = visible(leer("src/components/analysis/str/SeisCifrasStr.tsx"));
    const C = visible(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
    if (/CAP_STR_UMBRAL_PCT/.test(H)) F("4 · el hero STR vuelve a leer la constante de 5%");
    if (!/referenciaCapRateStr\(results\.hallazgos\)/.test(H)) F("4 · el hero STR no lee referenciaCapRateStr");
    if (!/referenciaCapRateStr\(hallazgos, comuna\)/.test(C)) F("4 · el capítulo I STR no lee referenciaCapRateStr");
  }

  // ── 5 · sin cursiva en cap rate ni cash on cash, y sin guiones ────────────
  {
    if (existsSync(join(RAIZ, "src/components/analysis/shared/Ang.tsx"))) F("5 · volvió Ang.tsx (la cursiva del anglicismo)");
    for (const p of archivos("src")) {
      if (/^src\/app\/dev\//.test(p)) continue;
      const v = visible(leer(p));
      if (/\bangliza\(|<Ang>|from "[^"]*\/Ang"/.test(v)) F(`5 · ${p} vuelve a usar Ang/angliza`);
      if (/\.ang\{font-style:italic\}/.test(v)) F(`5 · ${p} vuelve a poner .ang en cursiva`);
      if (/<(?:em|i)\b[^>]*>\s*(?:cap rate|cash[- ]on[- ]cash)/i.test(v)) F(`5 · ${p} pone en cursiva «cap rate» o «cash on cash»`);
      if (p.endsWith(".tsx") && /cash-on-cash/i.test(v)) F(`5 · ${p} escribe «cash-on-cash» con guiones`);
    }
  }

  // ── 6 · FilaDato con el ⓘ del informe, sin title ─────────────────────────
  {
    const html = renderToStaticMarkup(createElement(FilaDato, { k: "Saldo de la deuda", tip: "Lo que queda del crédito al vender", v: "$1" }));
    if (/\btitle=/.test(html)) F("6 · FilaDato vuelve a usar el title nativo");
    if (!/<button[^>]*class="v-i"[^>]*aria-expanded="false"/.test(html)) F("6 · FilaDato no dibuja el botón del ⓘ con aria-expanded");
    if (!/aria-label="Qué es: Saldo de la deuda"/.test(html)) F("6 · el ⓘ de FilaDato no nombra la fila que explica");
    const C = visible(leer("src/components/analysis/shared/CapituloComoLoPagas.tsx"));
    if (/InfoTooltip/.test(C) || !/<Glosa titulo="Caro o barato"/.test(C)) F("6 · «Caro o barato» no pasó al ⓘ del informe");
  }

  // ── + los cortes del score, a constante, y la glosa del Franco Score leyéndolos ──
  {
    const t = GLOSAS.francoScore.texto;
    if (!t.includes(`Desde ${SCORE_CORTE_COMPRAR} el veredicto es Comprar`) || !t.includes(`desde ${SCORE_CORTE_AJUSTA}, Ajustar; bajo ${SCORE_CORTE_AJUSTA}, Buscar otro`)) F("+ · el ⓘ del Franco Score no cita los cortes de score-cortes.ts con las etiquetas visibles");
    if (!GLOSAS.tir.texto.includes(`bajo ${TIR_LIMITE_PCT}% al año`)) F("+ · el ⓘ de la TIR no cita TIR_LIMITE_PCT");
    for (const [k, g] of Object.entries(GLOSAS)) {
      const frases = g.texto.split(/(?<=[.])\s+(?=[A-ZÁÉÍÓÚÑ×])/).length;
      if (frases > 3) F(`+ · el ⓘ ${k} tiene ${frases} frases (tope 3)`);
      if (/[÷=]/.test(g.texto)) F(`+ · el ⓘ ${k} trae una fórmula`);
    }
    const P = visible(leer("src/components/analysis/portada/PortadaInforme.tsx"));
    if (!/<GlosaIndicador glosa="francoScore"/.test(P)) F("+ · la portada no lleva el ⓘ del Franco Score");
  }

  if (fallas.length) {
    console.log(`  ✗ INFO-INDICADORES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el ⓘ se apila sin cerrar la hoja de abajo con atrás ni Esc, «retorno sobre lo puesto» no se dibuja, el cap rate STR es uno solo y anual, hero y capítulo I leen la misma referencia, sin cursiva ni guiones, FilaDato sin title, y los cortes del score a constante");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runInfoIndicadoresTier();
  process.exit(hard ? 1 : 0);
}
