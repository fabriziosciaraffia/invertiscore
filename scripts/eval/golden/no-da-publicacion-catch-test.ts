// ============================================================================
// TIER NO-DA-PUBLICACION — el pop-up «no da» de renta corta con salida (27-oct-2026, decisión de Fabrizio)
//
//   El caso: el 26-oct un cliente tocó «Analizar este» en un depto de renta corta de su selección (aviso 9bfe6906, Las
//   Condes), pagó el pack, y la medición fina dio AJUSTA 68 donde la zona decía COMPRAR 85: no hubo informe, el pop-up
//   «no da» no tenía el enlace que el pop-up de antes le prometía, y se sintió engañado. Desde hoy, CON SU MEDICIÓN REAL
//   (`comparaciones_zona_str`, la fila de ese aviso):
//   1 · EL «NO DA» TRAE LA MEDICIÓN y no cobra; «Analizar igual» (`igual`) cobra una vez y crea el informe.
//   2 · POR QUÉ, EN UNA LÍNEA: la tarifa y la ocupación medidas contra las de la zona, con las cifras de la fila; se nombra
//       lo que cayó 5 % o más, y sin contra qué comparar la línea no inventa cifras.
//   3 · EL POP-UP, DIBUJADO: «no da», el porqué, «Ver la publicación» con el enlace del aviso en otra pestaña, «Analizar
//       igual · usa 1 de tus 3» y después los parecidos (o que no queda ninguno), en ese orden.
//   4 · LA CADENA: la ruta guarda el enlace de la ficha que chequea y el saldo con que mide, recibe `igual` y devuelve todo
//       en «no-da»; la lista se lo da al pop-up y «Analizar igual» llama con `igual`; el pop-up se lo da a su cuerpo.
//   5 · EL POP-UP DE ANTES, EN RENTA CORTA: «Si da, el informe incluye el enlace a la publicación; si no da, no gastas y te
//       mostramos la publicación igual.», entera (en el modo compacto se envuelve, no se corta); renta larga, como antes.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/no-da-publicacion-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import {
  CAIDA_QUE_SE_NOMBRA, NINGUNO_MAS, NO_DA_DEPTO, PARECIDOS_DAN, analizarStrDeSemanal, porQueNoDa, textoAnalizarIgual, type LadoMedicion,
} from "../../../src/lib/guia/semanal-str";
import { SEMANAL_PAGINA } from "../../../src/lib/guia/semanal";
import { AVISO_ANALIZAR } from "../../../src/lib/guia/aviso-analizar";
import { PUBLICACION_PORTADA } from "../../../src/lib/guia/copy";

// tsx compila el JSX de los componentes al React clásico: `React` tiene que existir en el ámbito global.
(globalThis as unknown as { React: typeof React }).React = React;
// El pop-up importa su CSS: en Node no se carga (el componente se importa adentro del tier, después de esto).
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const escaparAtributo = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const pct = (o: number) => `${Math.round(o * 100)} %`;

/** El caso del 26-oct: la persona y el aviso. */
const CASO = { userId: "f3768afd-1c72-4789-a016-f848c9f6d838", avisoId: "9bfe6906-21bd-4557-816b-2ebf38456a8f" };

/** El elemento JSX `<Nombre …>` entero, hasta el `>` que lo cierra fuera de toda llave. "" si no está. */
function elementoJsx(src: string, nombre: string): string {
  const i = src.search(new RegExp(`<${nombre}\\b`));
  if (i < 0) return "";
  let prof = 0;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "{") prof++;
    else if (c === "}") prof--;
    else if (prof === 0 && c === ">") return src.slice(i, j + 1);
  }
  return "";
}

/** Los atributos de PRIMER nivel de un elemento JSX (`nombre={valor}`), con su valor crudo. */
function atributosJsx(el: string): Map<string, string> {
  const m = new Map<string, string>();
  let prof = 0, desde = -1, nombre = "";
  for (let j = 0; j < el.length; j++) {
    const c = el[j];
    if (c === "{") {
      if (prof === 0) { nombre = el.slice(0, j).match(/([A-Za-z_]\w*)=$/)?.[1] ?? ""; desde = j + 1; }
      prof++;
    } else if (c === "}") {
      prof--;
      if (prof === 0 && nombre) { m.set(nombre, el.slice(desde, j).trim()); nombre = ""; }
    }
  }
  return m;
}

/** Dobles de las piezas: cuentan cobros y creaciones, y la medición es la que se les da. */
function dobles(m: { mostrado: string; mostradoScore: number | null; zona: LadoMedicion | null; fino: LadoMedicion }) {
  const n = { cobrar: 0, crear: 0, reclamar: 0 };
  const correr = (igual: boolean) => analizarStrDeSemanal({
    igual,
    yaCreado: async () => null,
    chequear: async () => "publicado",
    alDespublicar: async () => {},
    preparar: async () => ({
      ok: true,
      m: {
        mostrado: { veredicto: m.mostrado, score: m.mostradoScore }, zona: m.zona, fino: m.fino,
        piezas: {
          reclamar: async () => { n.reclamar++; return { nueva: true }; },
          retomar: async () => false,
          cobrar: async () => { n.cobrar++; return { ok: true, mode: "ledger" }; },
          marcarCobrado: async () => {},
          crear: async () => { n.crear++; return { id: "informe-caso" }; },
          marcarCreado: async () => {},
          soltar: async () => {},
        },
      },
    }),
    registrar: async () => {},
    alternativas: async () => [],
  });
  return { n, correr };
}

export async function runNoDaPublicacionTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const { CuerpoNoDa } = await import("../../../src/components/guia/PopupNoDa");
  console.log("\n─── TIER NO-DA-PUBLICACION (el «no da» de renta corta con el enlace, el porqué y «Analizar igual»; el caso del 26-oct · 0 tokens) ───");

  // ── 4 · la cadena ──
  const ruta = codigo("src/app/api/semanal/analizar-str/route.ts");
  if (!/const r = await analizarStrDeSemanal\(\{\s*igual: b\.igual === true,/.test(ruta)) F("4 · la ruta no pasa «Analizar igual» (`igual`) al orquestador");
  const chequear = ruta.slice(ruta.indexOf("async chequear()"), ruta.indexOf("async alDespublicar()"));
  if (!/const c = await chequearPublicacion\(ficha,[^\n]*\n[\s\S]*?publicacion = ficha\.url;/.test(chequear)) F("4 · la ruta no guarda el enlace de la ficha que chequea");
  const iSin = ruta.indexOf('if (saldo.tipo === "sin") return { ok: false, status: 402, error: "sin-creditos" };'), iGuarda = ruta.indexOf("saldoAlMedir = saldo;");
  if (iSin < 0 || iGuarda < 0 || iGuarda < iSin) F("4 · la ruta no guarda el saldo con que mide");
  if (!/estado: "no-da", alternativas: r\.alternativas, publicacion, porQue: porQueNoDa\(r\.zona, r\.fino\), saldo: saldoAlMedir/.test(ruta)) F("4 · el «no-da» de la ruta no trae el enlace, el porqué y el saldo");
  const lista = codigo("src/app/semanal/semanal-lista.tsx");
  if (!/body: JSON\.stringify\(\{ token, avisoId: it\.avisoId, \.\.\.\(igual \? \{ igual: true \} : \{\}\) \}\)/.test(lista)) F("4 · la lista no manda `igual` a la ruta de renta corta");
  const pop = atributosJsx(elementoJsx(lista, "PopupNoDa"));
  if (pop.get("publicacion") !== "popup.publicacion" || pop.get("porQue") !== "popup.porQue") F("4 · la lista no le da al pop-up el enlace y el porqué que trajo la ruta");
  const igual = pop.get("analizarIgual") ?? "";
  if (!/texto: textoAnalizarIgual\(popup\.uso\)/.test(igual) || !/ocupado: analizandoIgual/.test(igual) || !/alTocar: \(\) => void analizar\(popup\.it, false, undefined, true\)/.test(igual)) F("4 · «Analizar igual» no llama a analizar con `igual`, o no dice el uso, o no gira");
  const cuerpo = atributosJsx(elementoJsx(codigo("src/components/guia/PopupNoDa.tsx"), "CuerpoNoDa"));
  if (cuerpo.get("publicacion") !== "publicacion" || cuerpo.get("porQue") !== "porQue" || cuerpo.get("analizarIgual") !== "analizarIgual") F("4 · el pop-up no le da a su cuerpo el enlace, el porqué y «Analizar igual»");

  // ── 5 · el pop-up de antes, en renta corta ──
  const promesa = `${AVISO_ANALIZAR.incluyeCorta.antes}${AVISO_ANALIZAR.incluyeCorta.fuerte}${AVISO_ANALIZAR.incluyeCorta.despues}`;
  if (promesa !== "Si da, el informe incluye el enlace a la publicación; si no da, no gastas y te mostramos la publicación igual.") F(`5 · la promesa de renta corta no es la pedida: «${promesa}»`);
  if (`${AVISO_ANALIZAR.incluye.antes}${AVISO_ANALIZAR.incluye.fuerte}${AVISO_ANALIZAR.incluye.despues}` !== "El informe incluye el enlace a la publicación.") F("5 · la de renta larga cambió");
  const aviso = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
  if (!/const incluye = modalidad === "str" \? AVISO_ANALIZAR\.incluyeCorta : AVISO_ANALIZAR\.incluye;/.test(aviso)
    || !/<span className=\{modalidad === "str" \? "av-incluye av-incluye-corta" : "av-incluye"\} data-aviso="incluye">\{incluye\.antes\}<b>\{incluye\.fuerte\}<\/b>\{incluye\.despues\}<\/span>/.test(aviso)) F("5 · el pop-up de antes no dice la promesa de renta corta en renta corta");
  if (!/\.wz-modal-compacto \.av-incluye-corta \{ white-space: normal; \}/.test(leer("src/components/formulario-v4/wizard-v4.css"))) F("5 · en el modo compacto la promesa de renta corta se corta con puntos suspensivos");

  // ── 2 · el porqué, con casos de borde ──
  const Z = { veredicto: "COMPRAR", score: 80, adr: 100000, ocupacion: 0.5 };
  const soloOcup = porQueNoDa(Z, { veredicto: "AJUSTA SUPUESTOS", score: 60, adr: 99000, ocupacion: 0.4 });
  if (!soloOcup.includes("ocupación es 40 %") || !soloOcup.includes("50 %") || soloOcup.includes("tarifa")) F(`2 · con solo la ocupación caída la línea no nombra solo la ocupación: «${soloOcup}»`);
  const nada = porQueNoDa(null, { veredicto: "AJUSTA SUPUESTOS", score: 60, adr: 61143, ocupacion: 0.44 });
  if (/\$|%/.test(nada)) F(`2 · sin la zona la línea inventa una comparación: «${nada}»`);
  if (CAIDA_QUE_SE_NOMBRA !== 0.05) F("2 · el umbral de lo que se nombra no es 5 %");

  // ── 1, 2 y 3 · con la medición real del caso ──
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    F("1 · sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no se lee el caso del 26-oct (no es un verde)");
  } else {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const [{ data: c, error: ec }, { data: sp }] = await Promise.all([
      admin.from("comparaciones_zona_str").select("zona_mostrado, zona_score, zona_veredicto, zona_adr, zona_ocupacion, fino_veredicto, fino_score, fino_adr, fino_ocupacion").eq("user_id", CASO.userId).eq("aviso_id", CASO.avisoId).maybeSingle(),
      admin.from("scraped_properties").select("url").eq("id", CASO.avisoId).order("id").limit(1),
    ]);
    const enlace = (sp?.[0] as { url?: string } | undefined)?.url ?? null;
    if (ec || !c) F(`1 · no está la medición del caso del 26-oct: ${ec?.message ?? "sin fila"}`);
    else if (!enlace) F("1 · el aviso del caso no tiene enlace en scraped_properties");
    else {
      const num = (v: unknown) => (v == null ? null : Number(v));
      const zona: LadoMedicion = { veredicto: c.zona_veredicto as string, score: num(c.zona_score), adr: num(c.zona_adr), ocupacion: num(c.zona_ocupacion) };
      const fino: LadoMedicion = { veredicto: c.fino_veredicto as string, score: num(c.fino_score), adr: num(c.fino_adr), ocupacion: num(c.fino_ocupacion) };
      console.log(`  · el caso: zona ${zona.veredicto} ${zona.score} (${zona.adr}/${zona.ocupacion}) → fino ${fino.veredicto} ${fino.score} (${fino.adr}/${fino.ocupacion})`);
      // 1 · el «no da» trae la medición y no cobra; «Analizar igual» cobra una vez y crea.
      const a = dobles({ mostrado: c.zona_mostrado as string, mostradoScore: num(c.zona_score), zona, fino });
      const r = await a.correr(false);
      if (r.estado !== "no-da" || a.n.cobrar !== 0 || a.n.crear !== 0) F(`1 · con la medición del caso no sale «no da» sin cobrar (${r.estado}, cobros ${a.n.cobrar})`);
      else if (r.zona !== zona || r.fino !== fino) F("1 · el «no da» no trae la medición con que se explica");
      const b = dobles({ mostrado: c.zona_mostrado as string, mostradoScore: num(c.zona_score), zona, fino });
      const rb = await b.correr(true);
      if (rb.estado !== "creado" || b.n.cobrar !== 1 || b.n.crear !== 1) F(`1 · «Analizar igual» no cobra una vez y crea el informe (${rb.estado}, cobros ${b.n.cobrar}, informes ${b.n.crear})`);
      // 2 · el porqué con las cifras de la fila: lo que cayó 5 % o más, nombrado con su cifra y la de la zona.
      const porQue = porQueNoDa(zona, fino);
      const cayo = (z: number | null, f: number | null) => z != null && f != null && f < z * (1 - CAIDA_QUE_SE_NOMBRA);
      if (!cayo(zona.adr, fino.adr) && !cayo(zona.ocupacion, fino.ocupacion)) F("2 · la fila del caso ya no tiene caídas que nombrar: el tier no mide el porqué");
      if (cayo(zona.adr, fino.adr) && (!porQue.includes(`tarifa por noche es ${pesos(fino.adr!)}`) || !porQue.includes(pesos(zona.adr!)))) F(`2 · el porqué no nombra la tarifa medida contra la de la zona: «${porQue}»`);
      if (cayo(zona.ocupacion, fino.ocupacion) && (!porQue.includes(pct(fino.ocupacion!)) || !porQue.includes(pct(zona.ocupacion!)))) F(`2 · el porqué no nombra la ocupación medida contra la de la zona: «${porQue}»`);
      // 3 · el pop-up dibujado con el caso.
      const uso = textoAnalizarIgual(SEMANAL_PAGINA.usaUno(3));
      if (uso !== "Analizar igual · usa 1 de tus 3") F(`3 · el botón no dice «Analizar igual · usa 1 de tus 3»: «${uso}»`);
      const html = renderToStaticMarkup(createElement(CuerpoNoDa, { parecidos: 0, publicacion: enlace, porQue, analizarIgual: { texto: uso, ocupado: false, alTocar: () => {} } }));
      const a_ = html.match(/<a\b[^>]*data-popup="publicacion"[^>]*>[^<]*<\/a>/)?.[0] ?? "";
      if (!a_.includes(`href="${escaparAtributo(enlace)}"`) || !a_.includes(PUBLICACION_PORTADA.enlace)) F("3 · el pop-up no lleva «Ver la publicación» con el enlace del aviso");
      if (!/target="_blank"/.test(a_) || !/rel="[^"]*noopener/.test(a_)) F("3 · «Ver la publicación» no abre en otra pestaña con noopener");
      const btn = html.match(/<button\b[^>]*data-popup="analizar-igual"[^>]*>([^<]*)<\/button>/)?.[1] ?? "";
      if (btn !== uso) F(`3 · el pop-up no ofrece «${uso}» («${btn}»)`);
      const orden = [NO_DA_DEPTO, escaparAtributo(porQue).replace(/&quot;/g, '"'), 'data-popup="publicacion"', 'data-popup="analizar-igual"', NINGUNO_MAS].map((t) => html.indexOf(t));
      if (orden.some((i) => i < 0) || orden.some((i, k) => k > 0 && i < orden[k - 1])) F(`3 · el pop-up no dice «no da», el porqué, el enlace, «Analizar igual» y que no queda otro, en ese orden (${orden.join(",")})`);
      const con = renderToStaticMarkup(createElement(CuerpoNoDa, { parecidos: 2, publicacion: enlace, porQue, analizarIgual: null }, createElement("p", { "data-x": "par" }, "parecido")));
      if (!con.includes(PARECIDOS_DAN) || con.includes(NINGUNO_MAS) || con.indexOf(PARECIDOS_DAN) > con.indexOf('data-x="par"')) F("3 · con parecidos el pop-up no los presenta después de las salidas");
    }
  }

  if (fallas.length) {
    console.log(`  ✗ NO-DA-PUBLICACION · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — con la medición real del caso del 26-oct, el «no da» no cobra y trae la medición; el pop-up dice por qué (la tarifa y la ocupación contra la zona), lleva «Ver la publicación» con el enlace del aviso y «Analizar igual · usa 1 de tus 3», que cobra una vez; el pop-up de antes, en renta corta, promete los dos casos");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (27-oct-2026, scratchpad mutar-no-da.cjs, cada una restaurada byte a byte, todas con la medición real del
// caso): M1 «Analizar igual» no salta la regla · M2 el «no da» sin la medición · M3 el porqué siempre genérico · M4 el porqué
// sin la ocupación · M5 el pop-up sin el enlace · M6 el enlace en la misma pestaña · M7 sin el porqué · M8 sin «Analizar
// igual» · M9 sin lo que sigue a las salidas · M10 la ruta no guarda el enlace · M11 la ruta no pasa `igual` · M12 el
// «no-da» sin el porqué · M13 la lista no manda `igual` · M14 la lista no da el enlace al pop-up · M15 «Analizar igual»
// llama sin `igual` · M16 el pop-up no se lo da a su cuerpo · M17 el pop-up de antes con la promesa vieja en renta corta ·
// M18 la promesa sin el segundo caso · M19 en el compacto la promesa se corta. 19/19 ROJO. M5 no se aplicó en la primera
// pasada (el ancla tenía la sangría de antes de sacar el cuerpo a `CuerpoNoDa`); corregida, ROJO. El tier sale con
// `process.exitCode` y no con `process.exit`: con el pop-up importado, `process.exit` abortaba en Windows con un assert de
// libuv (código 127) aunque el tier estuviera verde, y el runner de mutaciones habría leído ROJO todo.

if (require.main === module) {
  runNoDaPublicacionTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
