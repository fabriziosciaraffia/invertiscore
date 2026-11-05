// ============================================================================
// TIER INFORME-EN-CAMINO — lo que pasa entre tocar «Analizar» y ver el informe, en Explorar, la selección y el dashboard
// (03-nov-2026, decisión de Fabrizio tras el caso de fsm@ en /explorar: el aviso se despublicó al analizar, la ruta respondió 410
// sin cobrar y el pop-up desapareció sin decir nada; la persona terminó en la tarjeta del depto vecino, ya analizado el 13-oct).
//
//   1 · EL POP-UP NO SE CIERRA ANTES DEL INFORME: después de «Analizar» pasa a «Generando el informe de [depto]…» con su barra,
//       sin X ni Escape; listo, lo abre él solo. Ninguna de las tres superficies lo cierra al llegar el informe.
//   2 · LA APERTURA FALLIDA NO QUEDA SIN AVISO: a los 10 s desde «Analizar», con el informe listo, «Abrir informe» (un enlace de
//       verdad); si se cierra sin abrirlo, la tarjeta dice «Ya lo analizaste · Ver informe» y arriba queda «Tu informe de [depto]
//       está listo · Abrirlo», que no se cierra solo. Y se mide la apertura fallida.
//   3 · EL VEREDICTO DISTINTO SE DICE: si con los datos de hoy salió otro veredicto que el de la tarjeta, el pop-up lo dice antes
//       de abrir el informe («Con los datos de hoy dio Ajustar 68, no Comprar 82. Igual puedes verlo completo.»); la ruta devuelve
//       el veredicto y el puntaje del informe.
//   4 · EL FALLO SE DICE CON PALABRAS: «No pudimos generar el informe. No se usó ningún análisis.» y qué hacer; el despublicado
//       y el que salió de la selección, también. Ninguna superficie vuelve a la lista o al mapa en silencio.
//   5 · LA MEDICIÓN: el tiempo entre «Analizar» y el informe en pantalla, y la apertura fallida aparte.
//   6 · LA TARJETA ANALIZADA CONSERVA SU IMAGEN: la misma foto de la calle (o el mapa chico) que antes de analizar.
//   7 · LA GUÍA DE BÚSQUEDA Y LA VUELTA DEL PAGO (mismo día, segunda entrega): la guía es una superficie más de §1-§4; la vuelta
//       del pago desde un depto aplica la regla sin pop-up, debajo de «Pago confirmado.»: la barra avanza, lo abre en su lugar, a
//       los 10 s «Abrir informe», el veredicto distinto se dice, y si no salió lo dice ahí mismo (ya no manda al dashboard en
//       silencio). El suelto y el desbloqueo, que ya tienen su informe, también ofrecen «Abrir informe» a los 10 s.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, 0 lecturas.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/informe-en-camino-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ie from "../../../src/lib/guia/informe-en-camino";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e).replace(/\s+/g, " ").trim();
/** El cuerpo de una función: de su firma a la siguiente declaración con su misma sangría o menos. "" si no está. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const sangria = i - (src.lastIndexOf("\n", i) + 1);
  const resto = src.slice(i + firma.length);
  const j = resto.search(new RegExp(`\\n {0,${sangria}}(?:export |async function |function |const [A-Za-z]+ = |let [A-Za-z]+ = )`));
  return src.slice(i, j < 0 ? undefined : i + firma.length + j);
}
/** Un bloque `{ … }` desde la primera `{` de `marca` (la marca empieza donde abre), contando llaves. "" si no está. */
function bloque(src: string, marca: string): string {
  const i = src.indexOf(marca);
  if (i < 0) return "";
  const a = src.indexOf("{", i);
  let prof = 0;
  for (let k = a; k < src.length; k++) {
    if (src[k] === "{") prof++;
    else if (src[k] === "}") { prof--; if (prof === 0) return src.slice(a, k + 1); }
  }
  return "";
}
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
const NADA = () => {};
const DEPTO = "Providencia · 2D2B · 80 m² · Usado · UF 4.991";
const ESPERADO = { veredicto: "COMPRAR", score: 82 };
const T0 = 1_800_000_000_000;

// Las tres superficies: dónde vive su «Analizar» y cómo se llama lo que cierra el pop-up del informe.
const SUPERFICIES = [
  { nombre: "Explorar", archivo: "src/app/explorar/explorar-cliente.tsx", ruta: "`/analisis/${d.id}`" },
  { nombre: "la selección («Estás dentro»)", archivo: "src/components/deptos/PrimeraSeleccion.tsx", ruta: "`/analisis/${d.id}`" },
  { nombre: "el dashboard (SemanalLista)", archivo: "src/app/semanal/semanal-lista.tsx", ruta: "corta ? `/analisis/renta-corta/${d.id}` : `/analisis/${d.id}`" },
  { nombre: "la guía de búsqueda", archivo: "src/components/guia/GuiaBusqueda.tsx", ruta: "`/analisis/${d.id}`" },
] as const;

export async function runInformeEnCaminoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER INFORME-EN-CAMINO (después de «Analizar»: el pop-up no se cierra, la apertura fallida avisa, el veredicto distinto se dice, el fallo con palabras, la medición, la tarjeta con su imagen, la guía y la vuelta del pago · 0 tokens) ───");
  const modPop = cargar<{ PopupInforme: FC<Record<string, unknown>>; InformeListoAviso: FC<Record<string, unknown>>; VueltaInforme?: FC<Record<string, unknown>> }>("src/components/guia/InformeEnCamino", F);
  const modTar = cargar<{ TarjetaPin: FC<Record<string, unknown>> }>("src/app/explorar/tarjeta-pin", F);
  const pop = (paso: ie.PasoInforme, ahora: number, conReintentar = false) => (modPop ? dibujar(createElement(modPop.PopupInforme, { paso, ahora, alCerrar: NADA, alReintentar: conReintentar ? NADA : null })) : "");
  const gen = ie.informeGenerando(DEPTO, ESPERADO, T0);
  const listo = ie.informeListo(gen, { id: "inf-1", ruta: "/analisis/inf-1", veredicto: "COMPRAR", score: 80 }, T0 + 7_000);
  const pantallas = SUPERFICIES.map((s) => ({ ...s, src: codigo(s.archivo) }));

  // ══ §1 · EL POP-UP NO SE CIERRA ANTES DEL INFORME ══════════════════════════
  {
    if (ie.cerrable(gen, T0 + 60_000)) F("1 · mientras genera, el pop-up se puede cerrar");
    if (ie.cerrable(listo, T0 + 9_000)) F("1 · con el informe listo y abriéndose, el pop-up se puede cerrar antes de los 10 s");
    const g = pop(gen, T0 + 4_000);
    if (!texto(g).includes(ie.INFORME_COPY.generando(DEPTO)) || !/data-informe="barra"/.test(g) || /data-informe="cerrar"/.test(g) || /<button|<a /.test(g.replace(/<div[^>]*role="progressbar"[^>]*>/, ""))) F("1 · generando, el pop-up no dice «Generando el informe de [depto]…» con su barra, o trae cómo cerrarlo o algún botón");
    if (texto(g) !== `${ie.INFORME_COPY.cabecera} ${ie.INFORME_COPY.generando(DEPTO)}`) F(`1 · generando, el pop-up dice otra cosa: «${texto(g)}»`);
    const comp = codigo("src/components/guia/InformeEnCamino.tsx");
    // ⚠ ACTA (03-nov-2026, QA del preview) · y no sigue de largo (stopPropagation): la tarjeta de atrás se cerraba por debajo.
    if (!/if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); if \(puedeCerrar\) alCerrar\(\); \}/.test(comp) || !/const puedeCerrar = cerrable\(paso, ahora\);/.test(cuerpo(comp, "export function InformeEnCamino("))) F("1 · Escape cierra el pop-up aunque esté generando");
    // Listo, se abre solo y una sola vez (con el viaje anotado para medir).
    // ⚠ ACTA (03-nov-2026, la guía y la vuelta del pago) · abrirlo y medir pasaron a useInformeEnCamino, que usan el pop-up y la
    // vuelta del pago; el pop-up lo abre con push y la vuelta, en su lugar (`reemplazar`). Se exige el hook y que el pop-up lo use.
    const gancho = cuerpo(comp, "export function useInformeEnCamino(");
    const abre = bloque(gancho, "useEffect(() => {\n    if (paso.paso !== \"listo\" || abierto.current === paso.id) return;");
    if (!/if \(paso\.paso !== "listo" \|\| abierto\.current === paso\.id\) return;\s*abierto\.current = paso\.id;/.test(abre) || !/try \{ if \(reemplazar\) router\.replace\(paso\.ruta\); else router\.push\(paso\.ruta\); \}/.test(abre) || !/anotarViaje\(almacen\(\), \{ id: paso\.id, t0: paso\.t0, desde: desde \?\? desdeDeRuta\(window\.location\.pathname\), via: "auto" \}\)/.test(abre)) F("1 · con el informe listo, el pop-up no lo abre solo (o no anota el viaje)");
    if (!/const \{ ahora, anotar \} = useInformeEnCamino\(paso\);/.test(cuerpo(comp, "export function InformeEnCamino("))) F("1 · el pop-up no usa el gancho que abre el informe solo");
    const aviso = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
    if (!/if \(informe\) return <InformeEnCamino paso=\{informe\} alCerrar=\{alCerrarInforme \?\? alCancelar\} alReintentar=\{alReintentarInforme\} \/>;/.test(aviso)) F("1 · el pop-up de «Analizar este» no pasa a «Generando el informe…»: se cierra o se reemplaza por otro");
    for (const s of pantallas) {
      const analizar = cuerpo(s.src, "async function analizar(");
      const exito = bloque(analizar, "if (res.ok && d.id) {");
      if (!analizar || !exito) { F(`1 · ${s.nombre}: no se encontró su «Analizar» o la rama del informe listo`); continue; }
      if (/setConfirmar\(null\)|setInforme\(null\)|router\.push\(/.test(exito) || !exito.includes(`informeListo(paso0, { id: d.id, ruta: ${s.ruta}, veredicto: d.veredicto ?? null, score: d.score ?? null })`) || !/setInforme\(listo\);/.test(exito)) F(`1 · ${s.nombre}: al llegar el informe se cierra el pop-up o navega por su cuenta (en vez de pasarle el informe al pop-up)`);
      if (!/setInforme\(paso0\);/.test(analizar)) F(`1 · ${s.nombre}: al tocar «Analizar» el pop-up no pasa a «Generando el informe…»`);
      const monta = s.src.slice(s.src.indexOf("<AvisoAntesDeAnalizar"), s.src.indexOf("/>", s.src.indexOf("<AvisoAntesDeAnalizar")));
      if (!/informe=\{informe\}/.test(monta) || !/alCerrarInforme=\{cerrarInforme\}/.test(monta) || !/alReintentarInforme=\{reintentarInforme\}/.test(monta)) F(`1 · ${s.nombre}: el pop-up no recibe el informe en camino`);
    }
  }

  // ══ §2 · LA APERTURA FALLIDA NO QUEDA SIN AVISO ═══════════════════════════
  {
    if (ie.muestraAbrir(listo, T0 + 9_999) || !ie.muestraAbrir(listo, T0 + 10_000) || ie.ABRIR_INFORME_TRAS_MS !== 10_000) F("2 · «Abrir informe» no aparece a los 10 s de «Analizar»");
    const l = pop(listo, T0 + 11_000);
    if (!/<a [^>]*href="\/analisis\/inf-1"[^>]*data-informe="abrir"[^>]*>Abrir informe<\/a>/.test(l) || !/data-informe="cerrar"/.test(l)) F("2 · pasados 10 s, el pop-up no ofrece «Abrir informe» como un enlace al informe (o no deja cerrarlo)");
    if (/data-informe="abrir"/.test(pop(listo, T0 + 8_000))) F("2 · «Abrir informe» aparece antes de los 10 s");
    const q = ie.alCerrarQueda(listo);
    if (!q || q.id !== "inf-1" || q.ruta !== "/analisis/inf-1" || ie.alCerrarQueda(gen) || ie.alCerrarQueda(ie.informeFallo(gen, "error"))) F("2 · al cerrarlo con el informe listo no queda el informe para el aviso (o queda uno que no existe)");
    if (modPop) {
      const a = dibujar(createElement(modPop.InformeListoAviso, { depto: DEPTO, ruta: "/analisis/inf-1", id: "inf-1", t0: T0, alCerrar: NADA }));
      if (texto(a) !== `${ie.INFORME_COPY.listo(DEPTO)} · ${ie.INFORME_COPY.abrirlo} ×` || !/<a href="\/analisis\/inf-1"[^>]*>Abrirlo<\/a>/.test(a)) F(`2 · el aviso de arriba no dice «Tu informe de [depto] está listo · Abrirlo» con el enlace: «${texto(a)}»`);
    }
    const comp = codigo("src/components/guia/InformeEnCamino.tsx");
    if (/setTimeout|setInterval/.test(cuerpo(comp, "export function InformeListoAviso("))) F("2 · el aviso de arriba se cierra solo");
    for (const s of pantallas) {
      const cerrar = cuerpo(s.src, "function cerrarInforme(");
      if (!/const queda = informe \? alCerrarQueda\(informe\) : null;/.test(cerrar) || !/setListoSinAbrir\(\{ \.\.\.queda, t0: informe\.t0 \}\);/.test(cerrar) || !/\[it\.avisoId\]: queda\.id/.test(cerrar)) F(`2 · ${s.nombre}: al cerrar con el informe listo no deja el aviso de arriba ni marca el depto como analizado`);
      if (!/\{listoSinAbrir && (?:\(\s*<div className="ex-aviso-informe">\s*)?<InformeListoAviso depto=\{listoSinAbrir\.depto\} ruta=\{listoSinAbrir\.ruta\} id=\{listoSinAbrir\.id\} t0=\{listoSinAbrir\.t0\}/.test(s.src)) F(`2 · ${s.nombre}: el aviso «Tu informe de [depto] está listo · Abrirlo» no se dibuja`);
    }
    // La tarjeta de cada superficie lee los analizados de esta visita.
    const [exp, pri, sem, gui] = pantallas.map((s) => s.src);
    // ⚠ ACTA (03-nov-2026, QA del preview de la guía) · el aviso de arriba quedaba pegado a la primera tarjeta: lleva el aire de la lista.
    const cssGuia = leer("src/components/guia/guia.css").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/\n\.guia \.ie-aviso \{ margin-bottom: 10px; \}/.test(cssGuia) || !/@media \(min-width: 768px\) \{ \.guia \.ie-aviso \{ margin-bottom: 14px; \} \}/.test(cssGuia) || !/\.guia-lista \{ display: grid; gap: 10px; \}/.test(cssGuia) || !/@media \(min-width: 768px\) \{ \.guia-lista \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); gap: 14px; \} \}/.test(cssGuia)) F("2 · la guía: el aviso «Tu informe … está listo» queda pegado a las tarjetas (sin el aire de la lista)");
    if (!/\) : informesAqui\[it\.avisoId\] \? \(\s*<p className="guia-acc guia-ya" data-guia="ya-analizado">\s*<span>\{YA_ANALIZADO\.texto\} ·<\/span>\s*<EnlaceCarga href=\{`\/analisis\/\$\{informesAqui\[it\.avisoId\]\}`\}>\{YA_ANALIZADO\.enlace\}<\/EnlaceCarga>/.test(gui)) F("2 · la guía: la tarjeta no dice «Ya lo analizaste · Ver informe» con los analizados de esta visita");
    if (!/const analizadosVivos = useMemo\(\(\) => \(\{ \.\.\.cuenta\.analizados, \.\.\.analizadosAqui \}\)/.test(exp) || (exp.match(/analizados=\{analizadosVivos\}/g) ?? []).length !== 2) F("2 · Explorar: la tarjeta y la lista no leen los analizados de esta visita");
    // ⚠ ACTA (05-nov-2026, tier TARJETA-ANALIZADA) · el informe de la tarjeta se nombra una vez (`const informe = …`) porque lo
    // leen dos ramas: el chip de su informe y «Ya lo analizaste · Ver informe». Se exige el nombre y que gobierne esa rama.
    if (!/const informe = it\.informeId \?\? informesAqui\[it\.avisoId\] \?\? null;/.test(pri) || !/\{informe \? \(\s*<p className="sel-ya" data-primera="ya-analizado">/.test(pri)) F("2 · la selección: la tarjeta no lee los analizados de esta visita");
    if (!/const informeDe = \(it: ItemSemanal\): string \| undefined => it\.informeId \?\? informes\[it\.avisoId\] \?\? informesAqui\[it\.avisoId\];/.test(sem)) F("2 · el dashboard: la tarjeta no lee los analizados de esta visita");
    // La medición de la apertura fallida: 10 s después de pedir abrirlo, si la página sigue acá.
    const fallida = bloque(comp, "useEffect(() => {\n    if (paso.paso !== \"listo\") return;");
    if (!/const falta = APERTURA_FALLIDA_TRAS_MS - \(Date\.now\(\) - paso\.listoEn\);/.test(fallida) || !/posthog\?\.capture\(EVENTO_APERTURA_FALLIDA, \{ analysis_id: paso\.id,/.test(fallida) || !/window\.clearTimeout\(t\)/.test(fallida) || ie.APERTURA_FALLIDA_TRAS_MS !== 10_000) F("2 · la apertura fallida no se mide (o se mide sin esperar los 10 s)");
  }

  // ══ §3 · EL VEREDICTO DISTINTO SE DICE ═════════════════════════════════════
  {
    const d = ie.informeListo(gen, { id: "inf-2", ruta: "/analisis/inf-2", veredicto: "AJUSTA SUPUESTOS", score: 68 }, T0 + 6_000);
    if (d.paso !== "distinto") F("3 · un informe con otro veredicto que la tarjeta se abre sin decirlo");
    else {
      const h = pop(d, T0 + 6_500);
      const dice = "Con los datos de hoy dio Ajustar 68, no Comprar 82. Igual puedes verlo completo.";
      if (!texto(h).includes(dice) || !/<a [^>]*href="\/analisis\/inf-2"[^>]*data-informe="abrir"[^>]*>Ver el informe<\/a>/.test(h)) F(`3 · el pop-up no dice «${dice}» con «Ver el informe»: «${texto(h)}»`);
    }
    if (ie.informeListo(gen, { id: "x", ruta: "/x", veredicto: "COMPRAR", score: 79 }).paso !== "listo") F("3 · el mismo veredicto con otro puntaje frena la apertura");
    if (ie.informeListo(ie.informeGenerando(DEPTO, null), { id: "x", ruta: "/x", veredicto: "AJUSTA SUPUESTOS", score: 60 }).paso !== "listo") F("3 · sin un veredicto visto, el pop-up inventa una comparación");
    // La ruta devuelve el veredicto y el puntaje del informe, el nuevo y el que ya estaba.
    const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
    if (!/delInforme = \{ veredicto: readVeredicto\(result\) \?\? null, score: result\.score \?\? null \};/.test(ruta) || !/if \(!delInforme\) \{\s*const \{ data: fila \} = await admin\.from\("analisis"\)\.select\("results"\)\.eq\("id", r\.id\)\.maybeSingle\(\);/.test(ruta)
      || !/return salir\(NextResponse\.json\(\{ id: r\.id, estado: r\.estado, veredicto: delInforme\?\.veredicto \?\? null, score: delInforme\?\.score \?\? null \}\)\);/.test(ruta)) F("3 · la ruta de analizar no devuelve el veredicto y el puntaje del informe");
    // Lo que vio: lo recalculado en el pop-up si cambió el pie o el plazo; si no, la tarjeta.
    const aviso = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
    if (!/const vista: VeredictoVisto \| null = cambio \? \(cambiada && recal \? \{ veredicto: recal\.veredicto, score: recal\.score \} : \{ veredicto: cambio\.base\.veredicto, score: cambio\.base\.score \}\) : null;/.test(aviso) || !/alAnalizar\(cambio \? \{ combinacion: combo, guardarPerfil: cambiada && guardar, vista \} : undefined\)/.test(aviso)) F("3 · el pop-up no cuenta qué veredicto vio la persona al tocar «Analizar»");
    const [exp, pri, sem, gui] = pantallas.map((s) => s.src);
    if (!/informeGenerando\(nombreDelDepto\(it\), it\.veredicto \? \{ veredicto: it\.veredicto, score: it\.score \} : null\)/.test(gui)) F("3 · la guía no compara con lo que mostró la tarjeta");
    if (!/const esperado: VeredictoVisto \| null = eleccion\?\.vista \?\? \(esNegociado\(it\) && conCifrasNegociado\(it\) \? \{ veredicto: "COMPRAR", score: it\.neg\.s \} : \{ veredicto: it\.veredicto, score: it\.score \}\);/.test(exp) || !/informeGenerando\(nombreDelDepto\(it\), esperado\)/.test(exp)) F("3 · Explorar no compara con lo que mostró la tarjeta (o el negociado, a su precio)");
    if (!/informeGenerando\(nombreDelDepto\(it\), eleccion\?\.vista \?\? \{ veredicto: it\.veredicto, score: it\.score \}\)/.test(pri)) F("3 · la selección no compara con lo que mostró la tarjeta");
    if (!/informeGenerando\(nombreDelDepto\(it\), corta \? null : eleccion\?\.vista \?\? \(it\.veredicto \? \{ veredicto: it\.veredicto, score: it\.score \?\? null \} : null\)\)/.test(sem)) F("3 · el dashboard no compara con lo que mostró la tarjeta");
  }

  // ══ §4 · EL FALLO SE DICE CON PALABRAS ═════════════════════════════════════
  {
    const e = pop(ie.informeFallo(gen, "error"), T0 + 3_000, true);
    if (!texto(e).includes("No pudimos generar el informe. No se usó ningún análisis.") || !texto(e).includes(ie.INFORME_COPY.falloQue) || !/data-informe="reintentar"/.test(e) || !/data-informe="fallo-cerrar"/.test(e)) F(`4 · el fallo no se dice con palabras y qué hacer (con «Reintentar»): «${texto(e)}»`);
    const p = pop(ie.informeFallo(gen, "despublicado"), T0 + 3_000);
    // ⚠ ACTA (04-nov-2026, la pasada de Fabrizio por /explorar, tier EXPLORAR-PASADA-0411) · la baja dice por qué y de dónde se saca, según dónde se analizó (textoFallo con el lugar).
    if (!texto(p).includes(ie.INFORME_COPY.despublicadoTitulo) || !texto(p).includes(ie.textoFallo("despublicado").que)) F("4 · el depto que se dio de baja al analizar no se dice (el caso de fsm@)");
    const f = pop(ie.informeFallo(gen, "fuera"), T0 + 3_000);
    if (!texto(f).includes(ie.INFORME_COPY.fueraTitulo)) F("4 · el depto que salió de la selección no se dice");
    for (const s of pantallas) {
      const analizar = cuerpo(s.src, "async function analizar(");
      if (!/const fallar = \(motivo: (?:MotivoFallo|"error" \| "despublicado")\) => \{[^\n]*setInforme\(informeFallo\(paso0, motivo\)\); \};/.test(analizar)) F(`4 · ${s.nombre}: sin el fallo dicho en el pop-up`);
      if (!/if \(res\.status === 410 && d\.error === "despublicado"\) \{[^\n]*fallar\("despublicado"\); break; \}/.test(analizar)) F(`4 · ${s.nombre}: el despublicado vuelve en silencio`);
      if (!/\} catch \{[\s\S]{0,160}fallar\("error"\)/.test(analizar) || /setError\(\{ avisoId: it\.avisoId, texto: GUIA\.error \}\)/.test(analizar)) F(`4 · ${s.nombre}: un error cierra el pop-up y lo deja como nota en la tarjeta`);
      if (!/if \(intento (?:===|>=) [^)]+\) \{ fallar\("error"\); break; \}/.test(analizar)) F(`4 · ${s.nombre}: si la ruta sigue ocupada en el último intento, vuelve en silencio`);
    }
    // La guía (segunda entrega): entrar con otra cuenta que la del pago se dice con su qué hacer; el despublicado, al cerrarlo,
    // rearma la guía sin él (la tarjeta lo dice mientras).
    const o = pop(ie.informeFallo(gen, "otra-cuenta"), T0 + 3_000);
    if (!texto(o).includes(ie.INFORME_COPY.falloTitulo) || !texto(o).includes("Esa cuenta no es la del pago. Entra con el correo con que pagaste.")) F(`4 · la cuenta que no es la del pago no se dice con qué hacer: «${texto(o)}»`);
    const gui = pantallas[3].src;
    if (!/fallar\(d\.error === "origen" \? "otra-cuenta" : "error"\);/.test(cuerpo(gui, "async function analizar("))) F("4 · la guía: la cuenta que no es la del pago cae en el error genérico");
    if (!/if \(despublicado && it\) \{ setError\(\{ avisoId: it\.avisoId, texto: GUIA\.despublicado \}\); void reemplazar\(\); \}/.test(cuerpo(gui, "function cerrarInforme("))) F("4 · la guía: al cerrar el despublicado, la guía no se arma de nuevo sin él");
  }

  // ══ §5 · LA MEDICIÓN ═══════════════════════════════════════════════════════
  {
    if (ie.EVENTO_INFORME_ABIERTO !== "analisis_informe_abierto" || ie.EVENTO_APERTURA_FALLIDA !== "analisis_apertura_fallida") F("5 · los eventos cambiaron de nombre");
    const mem = new Map<string, string>();
    const alm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
    ie.anotarViaje(alm, { id: "inf-1", t0: T0, desde: "explorar", via: "auto" });
    if (ie.leerViaje(alm, "otro", T0 + 9_000) !== null || !mem.has(ie.CLAVE_EN_CAMINO)) F("5 · el informe de otro análisis se lleva el viaje");
    const v = ie.leerViaje(alm, "inf-1", T0 + 9_000);
    if (!v || v.ms !== 9_000 || v.desde !== "explorar" || v.via !== "auto" || mem.has(ie.CLAVE_EN_CAMINO)) F(`5 · el tiempo entre «Analizar» y el informe no se cuenta (o no se consume): ${JSON.stringify(v)}`);
    ie.anotarViaje(alm, { id: "inf-1", t0: T0, desde: "explorar", via: "auto" });
    if (ie.leerViaje(alm, "inf-1", T0 + 31 * 60_000) !== null) F("5 · un viaje de hace más de media hora cuenta como la espera de «Analizar»");
    if (ie.desdeDeRuta("/explorar") !== "explorar" || ie.desdeDeRuta("/dashboard") !== "dashboard" || ie.desdeDeRuta("/deptos") !== "seleccion" || ie.desdeDeRuta("/semanal") !== "semanal" || ie.desdeDeRuta("/payments/return") !== "guia") F("5 · el «desde» de la medición no sale de la página (la guía vive en la vuelta del pago)");
    const visto = codigo("src/lib/informe-visto.ts");
    if (!/const viaje = leerViaje\(window\.sessionStorage, args\.ids\[0\]\);\s*if \(viaje\) args\.posthog\?\.capture\(EVENTO_INFORME_ABIERTO, \{ analysis_id: args\.ids\[0\], modalidad: args\.modalidad, ms: viaje\.ms, desde: viaje\.desde, via: viaje\.via \}\);/.test(visto)) F("5 · el informe no cuenta el tiempo desde «Analizar»");
    const comp = codigo("src/components/guia/InformeEnCamino.tsx");
    if (!/onClick=\{\(\) => anotar\("boton"\)\}|alAbrir=\{\(\) => anotar\("boton"\)\}/.test(comp) || !/via: "aviso"/.test(cuerpo(comp, "export function InformeListoAviso("))) F("5 · abrir a mano (el botón o el aviso) no queda anotado");
  }

  // ══ §6 · LA TARJETA ANALIZADA CONSERVA SU IMAGEN ═══════════════════════════
  // El caso de fsm@: antes, foto de la calle; después, el mapa chico. Eran dos deptos (913f257e, despublicado al analizar, con
  // foto; y ce069cef, el vecino del mismo edificio analizado el 13-oct, sin foto). Para un mismo depto, analizado o no, la
  // imagen es la misma: se exige con la tarjeta dibujada las dos veces.
  if (modTar) {
    const PIN = { avisoId: "c1c1c1c1-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.42, lng: -70.61, m2: 80, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4991, veredicto: "COMPRAR", score: 82, flujo: 54000, arriendo: 900000, condicion: "usado" as const, alta: null };
    const tarjeta = (analizados: Record<string, string>) => dibujar(createElement(modTar.TarjetaPin, { pines: [PIN], seleccionado: PIN.avisoId, uf: 39600, analizados, guardados: new Set(), generando: null, error: null, alCambiar: NADA, alCerrar: NADA, alGuardar: NADA, alAnalizar: NADA, alCompartir: NADA }));
    const imagen = (h: string) => h.match(/<span class="ex-img"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? "";
    // Sin los separadores que React mete entre dos textos de un mismo elemento (`<!-- -->`).
    const antes = tarjeta({}).replace(/<!-- -->/g, ""), despues = tarjeta({ [PIN.avisoId]: "inf-1" }).replace(/<!-- -->/g, "");
    if (!imagen(antes) || imagen(antes) !== imagen(despues)) F(`6 · la tarjeta cambia de imagen al pasar a analizada: «${imagen(antes).slice(0, 120)}» → «${imagen(despues).slice(0, 120)}»`);
    const ver = despues.match(/<a [^>]*data-explorar="ver-informe"[^>]*>([^<]*)<\/a>/);
    if (!ver || ver[1] !== "Ya lo analizaste · Ver informe" || !/href="\/analisis\/inf-1"/.test(ver[0]) || /data-explorar="ver-informe"/.test(antes)) F("6 · la tarjeta analizada no dice «Ya lo analizaste · Ver informe» con el enlace a su informe (o la no analizada lo dice)");
  }
  const tar = codigo("src/app/explorar/tarjeta-pin.tsx");
  if (!/<ImagenDepto avisoId=\{p\.avisoId\} tipo=\{tipos\[p\.avisoId\]\} clase="ex-img" ajustar=\{esNegociado\(p\)\} \/>/.test(tar)) F("6 · la imagen de la tarjeta depende de otra cosa que el depto (y su clase)");

  // ══ §7 · LA VUELTA DEL PAGO DESDE UN DEPTO ═════════════════════════════════
  // Comprado desde un depto de la selección, la vuelta de Flow genera el informe sola: la misma regla, sin pop-up, debajo de
  // «Pago confirmado.». Antes, si no salía, mandaba al dashboard sin decir nada a intentarlo de nuevo.
  {
    const vu = (paso: ie.PasoInforme, ahora: number, conReintentar = false) =>
      modPop?.VueltaInforme ? dibujar(createElement(modPop.VueltaInforme, { paso, ahora, saldo: 3, alReintentar: conReintentar ? NADA : null })).replace(/<!-- -->/g, "") : "";
    if (!modPop?.VueltaInforme) F("7 · no existe lo que se ve en la vuelta del pago (VueltaInforme)");
    const g = vu(gen, T0 + 4_000);
    // El depto va en negrita dentro de la frase: sin la etiqueta, para leer la frase entera.
    const dice = texto(g.replace(/<\/?b\b[^>]*>/g, ""));
    if (dice !== `Franco está analizando ${DEPTO}. En unos segundos se abre el informe. Te quedan 2 análisis para cualquier otro depto.` || !/role="progressbar"[^>]*aria-valuenow="30"/.test(g) || /<a |<button/.test(g)) F(`7 · generando, la vuelta no dice qué depto con la barra que avanza y cuántos le quedan (o trae una salida): «${dice}»`);
    if (/data-informe="abrir"/.test(vu(listo, T0 + 9_000)) || !/<a href="\/analisis\/inf-1"[^>]*data-informe="abrir"[^>]*>Abrir informe<\/a>/.test(vu(listo, T0 + 10_000))) F("7 · la vuelta no ofrece «Abrir informe» a los 10 s (o lo ofrece antes)");
    const dist = ie.informeListo(gen, { id: "inf-2", ruta: "/analisis/inf-2", veredicto: "AJUSTA SUPUESTOS", score: 68 }, T0 + 6_000);
    const dv = vu(dist, T0 + 6_500);
    if (!texto(dv).includes("Con los datos de hoy dio Ajustar 68, no Comprar 82. Igual puedes verlo completo.") || !/<a href="\/analisis\/inf-2"[^>]*data-informe="abrir"[^>]*>Ver el informe<\/a>/.test(dv)) F(`7 · la vuelta no dice el veredicto distinto antes de abrir: «${texto(dv)}»`);
    const e = vu(ie.informeFallo(gen, "error"), T0 + 3_000, true);
    if (texto(e) !== `${ie.INFORME_COPY.falloTitulo} ${ie.INFORME_COPY.falloQue} ${ie.INFORME_COPY.reintentar} Volver a los deptos` || !/data-informe="reintentar"/.test(e) || !/<a [^>]*href="\/dashboard"[^>]*>Volver a los deptos<\/a>/.test(e)) F(`7 · la vuelta no dice el fallo con palabras, «Reintentar» y la vuelta a los deptos: «${texto(e)}»`);
    const p = vu(ie.informeFallo(gen, "despublicado"), T0 + 3_000, true);
    if (!texto(p).includes(ie.INFORME_COPY.despublicadoTitulo) || !texto(p).includes(ie.textoFallo("despublicado", "seleccion").que) || /data-informe="reintentar"/.test(p) || !/>Volver a los deptos<\/a>/.test(p)) F("7 · la vuelta no dice que el depto se dio de baja (o ofrece reintentarlo)");
    // La página: genera con lo que mostró la tarjeta, le pasa el informe a la vuelta y no se va sola a ningún lado.
    const ret = codigo("src/app/payments/return/page.tsx");
    const iG = ret.indexOf("async function generarDepto("), fG = iG < 0 ? -1 : ret.indexOf("\n  useEffect(() => {", iG);
    const genera = iG < 0 || fG < 0 ? "" : ret.slice(iG, fG);
    if (!/const paso0 = informeGenerando\(depto\.nombre, depto\.esperado\);\s*setInforme\(paso0\);/.test(genera)) F("7 · la vuelta no pasa a «generando» con el veredicto de la tarjeta");
    if (!/if \(res\.ok && d\.id\) \{ setInforme\(informeListo\(paso0, \{ id: d\.id, ruta: `\/analisis\/\$\{d\.id\}`, veredicto: d\.veredicto \?\? null, score: d\.score \?\? null \}\)\); return; \}/.test(genera)) F("7 · la vuelta no le pasa el informe listo (ni su veredicto) a quien lo abre");
    if (!genera || /router\.(?:push|replace)\(|window\.location/.test(genera)) F("7 · la vuelta se va sola a otra página en vez de decir qué pasó");
    if (!/if \(res\.status === 410 && d\.error === "despublicado"\) \{ fallar\("despublicado"\); return; \}/.test(genera) || !/\} catch \{\s*fallar\("error"\);\s*return;\s*\}/.test(genera) || !/\}\s*fallar\("error"\);\s*\}\s*$/.test(genera)) F("7 · la vuelta no dice el despublicado, el error o las vueltas agotadas");
    if (!/\{alDepto && informe \? \(\s*<InformeEnLaVuelta paso=\{informe\} saldo=\{saldo\} alReintentar=\{\(\) => void generarDepto\(alDepto\)\} \/>/.test(ret)) F("7 · la página de la vuelta no muestra lo que pasa con el informe del depto");
    const comp = codigo("src/components/guia/InformeEnCamino.tsx");
    if (!/const \{ ahora, anotar \} = useInformeEnCamino\(paso, \{ desde: "pago", reemplazar: true \}\);/.test(cuerpo(comp, "export function InformeEnLaVuelta("))) F("7 · la vuelta no abre el informe en su lugar (atrás lo pediría otra vez) o no se mide como «pago»");
    // El veredicto de la tarjeta viaja con el estado del pago, saneado.
    if (!/nombre: nombreDelDepto\(it\), esperado: it\.veredicto \? \{ veredicto: it\.veredicto, score: it\.score \?\? null \} : null \}/.test(codigo("src/app/api/payments/status/route.ts"))) F("7 · el estado del pago no trae el veredicto que mostraba la tarjeta");
    const modC = cargar<{ leerDeptoDelPago: (x: unknown) => { esperado: ie.VeredictoVisto | null } | null }>("src/lib/guia/compra-desde-depto", F);
    if (modC) {
      const base = { token: "0123456789abcdef0123456789abcdef", avisoId: "a1", nombre: DEPTO };
      const bien = modC.leerDeptoDelPago({ ...base, esperado: { veredicto: "COMPRAR", score: 82 } });
      if (bien?.esperado?.veredicto !== "COMPRAR" || bien.esperado.score !== 82 || modC.leerDeptoDelPago({ ...base, esperado: { veredicto: 7 } })?.esperado !== null || modC.leerDeptoDelPago(base)?.esperado !== null) F("7 · el veredicto de la tarjeta se pierde o pasa sin sanear");
    }
    // Un informe ya hecho (el suelto, el desbloqueo): si a los 10 s sigue en «Abriendo tu análisis…», «Abrir informe».
    if (!/const abrirDestino = \(href: string\) => \{ setDestino\(href\); router\.push\(href\); \};/.test(ret) || (ret.match(/abrirDestino\(/g) ?? []).length !== 3 || (ret.match(/router\.push\(/g) ?? []).length !== 1) F("7 · el suelto o el desbloqueo navegan sin dejar «Abrir informe» por si no abre");
    if (!/const t = window\.setTimeout\(\(\) => setConAbrir\(true\), ABRIR_INFORME_TRAS_MS\);/.test(ret) || !/\{destino && conAbrir && \(\s*<div className=\{PLANO\.seccion\}>\s*<a href=\{destino\} className=\{PLANO\.principal\} data-informe="abrir">\{INFORME_COPY\.abrir\}<\/a>/.test(ret)) F("7 · «Abriendo tu análisis…» no ofrece «Abrir informe» a los 10 s");
  }

  for (const m of fallas) console.log(`  ✗ ${m}`);
  console.log(fallas.length === 0 ? "  ✓ INFORME-EN-CAMINO: todo en orden" : `  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runInformeEnCaminoTier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (03-nov-2026, meta-runner `mutar-gen.cjs` con `mutaciones-camino.cjs` del scratchpad de la sesión 087cc148,
// que restaura byte a byte con hash y exige que el texto mutado aparezca UNA vez): 44 de 44 en ROJO, cada una por su invariante.
//   §1 N1-N10: Explorar cierra el pop-up al llegar el informe, la selección lo suelta, el dashboard navega por su cuenta, el
//      pop-up generando con X, cerrable mientras genera, Escape que cierra siempre, el informe listo que no se abre solo, el aviso
//      que ignora el informe, Explorar que no pasa a «Generando…», el dashboard que monta el pop-up sin el informe; y N44
//      (tras el QA del preview) Escape que sigue de largo y cierra la tarjeta de atrás.
//   §2 N11-N20: «Abrir informe» a los 15 s o sin enlace, al cerrar listo no queda nada, el aviso que se cierra solo, Explorar que
//      cierra sin dejar el aviso o no lo dibuja, las tres tarjetas sin los analizados de la visita, la apertura fallida sin esperar.
//   §3 N21-N28: nunca distinto, distinto también por el puntaje, otro texto, la ruta sin el veredicto o sin leer el que ya estaba,
//      el pop-up que no pasa lo que vio, Explorar que compara el negociado con el publicado, la selección que no compara.
//   §4 N29-N34: el fallo con otro texto, Explorar con el despublicado en silencio, la selección con el error como nota en la
//      tarjeta, el dashboard que vuelve en silencio si la ruta sigue ocupada, sin «Reintentar», el despublicado con el texto del
//      error.
//   §5 N35-N40: el viaje de otro informe, que no se consume o no vence, el informe que no cuenta el tiempo, el aviso que no anota
//      cómo se abrió, el evento con otro nombre.
//   §6 N41-N43: la tarjeta analizada que pasa al mapa chico o al pin de otro color, y la que vuelve a «✓ Analizado».
// Tres arreglos del instrumento antes del acta (la primera corrida del tier, sobre el código sano): `bloque()` buscaba la llave
// después del FINAL de la marca y tomaba otra; React mete `<!-- -->` entre dos textos de un enlace; y el orden de los atributos
// del enlace no es el de la fuente (`href` va después de `data-explorar`).
// PREDICADOS REESCRITOS EN OTROS TIERS (mismo día, con su acta en cada uno; `mutaciones-tiers-camino.cjs` y `mutaciones-negociar-camino.cjs`): 16 de 16 en ROJO,
// cada uno en su tier — SEMANAL §13 y §15, SEMANAL-AJUSTES §5 y §10, CORREOS-RECORRIDO §5 (dos), MEDICION-META §1,
// PRIMERA-SELECCION §7 (dos), PUERTA-B-RECORRIDO §6, CARGA §4 (la ida al informe pasó al pop-up, con la barra encendida desde
// «Analizar»; tres), EXPLORAR §7 y EXPLORAR-NEGOCIAR §10 (dos: el error genérico y el precio movido). Fijaban el `router.push` de cada superficie, el cierre silencioso del 410 y la respuesta de la
// ruta sin el veredicto.
// SEGUNDA ENTREGA, LA GUÍA Y LA VUELTA DEL PAGO (03-nov-2026, `mutaciones-guia-vuelta.cjs` con el mismo meta-runner): 44 de 44 en
// ROJO, cada una por su invariante.
//   En este tier, 31: G1-G17, la guía como superficie de §1-§5 (cierra o navega al llegar el informe, no pasa a «Generando…», monta
//      el pop-up sin el informe, cierra sin dejar el aviso o no lo dibuja, la tarjeta sin los analizados, no compara con la
//      tarjeta, el despublicado en silencio, el error como nota, ocupada en el último intento, la otra cuenta como error genérico
//      o sin su qué hacer, cerrar el despublicado sin rearmar la guía, el gancho que no abre, el pop-up que abre en su lugar, la
//      guía medida como «pago»); V1-V14, la vuelta del pago de §7 (la barra que no avanza, «Abrir informe» antes de los 10 s, el
//      distinto callado, sin «Reintentar», las vueltas agotadas al dashboard, el despublicado como error, sin el veredicto de la
//      tarjeta, navegar por su cuenta, abrir con push, el estado del pago sin el veredicto, leerDeptoDelPago que lo pierde, el
//      «Abrir informe» del suelto a los 30 s, el suelto sin anotar el destino, la página sin la vuelta).
//   En otros tiers, 13 predicados reescritos con su acta: CORREOS-RECORRIDO §5, PUERTA-B-RECORRIDO §5, PUERTA-B-DASHBOARD §7,
//      VUELTA-FLOW §3 (tres; su recorte de generarDepto cortaba en el primer `useEffect` del archivo, que ahora va antes: quedaba
//      vacío), CARGA §4 (tres: la barra de la guía, su rama del informe listo y su cuenta de navegaciones, de 1 a 0), REANALISIS §3
//      y GUIA-BUSQUEDA §8 (dos) y §9. Fijaban el `router.push` de la guía, el `router.replace(vuelta ?? "/dashboard")` de la
//      vuelta y la nota del despublicado en la tarjeta.
//   Tras el QA del preview (WebKit 390 y Chromium 1440, 48 de 48): el aviso de arriba quedaba pegado a la primera tarjeta de la
//      guía. Con su aire, 3 de 3 en ROJO (`mutaciones-aviso-guia.cjs`): sin él en el teléfono, sin él en el PC, otro que el de la lista.
// ─────────────────────────────────────────────────────────────────────────────
