// ============================================================================
// TIER EXPLORAR-NEGOCIAR — Filtros v2 y los que convienen si negocias (02-nov-2026, goal de Fabrizio; mockup
// docs/puerta-b-mockups/8-filtros-v2-negociar.html).
//
//   1 · «AL PRECIO PUBLICADO»: «conviene» y «✓ Comprar» quieren decir a ese precio, y se dice —«¿Cómo se calcula?», la
//       bienvenida, el pop-up («Comprar 84 al precio publicado»), la barra de abajo, la lista y la tarjeta—. Todo chip de Comprar
//       con número al precio publicado lo dice al lado, y todo el copy de Explorar que dice «conviene» dice a qué precio.
//   2 · LOS CHIPS SON EL DE LA CASA: todo veredicto que se nombra en Explorar, la lista, Filtros y el pop-up es ChipVeredicto
//       (`chip-v`), con su puntaje adentro; ningún chip inventado.
//   3 · LOS NEGOCIADOS VAN APARTE: nunca se suman a «convienen» (el número, la lista, el botón de Filtros: «Ver 201 + 48 si
//       negocias»), van después de los Comprar en la lista, y su pin es ciruela (el color de Ajustar) con el número en blanco:
//       ni el pin, ni el interruptor, ni la marca de la tasa usan el rojo (decisión de Fabrizio, 02-nov-2026: en tinta).
//   4 · UN BUSCAR OTRO NUNCA ENTRA: la noche calcula el descuento solo para los Ajustar (y la base lo confirma), la capa los da
//       Ajustar y deja fuera a los que ya convienen.
//   5 · EL INFORME NEGOCIADO LLEVA LOS DOS PRECIOS: la ruta acepta el precio con el piso del tope ANTES de gastar nada, el informe
//       se hace a ese precio, guarda los dos y la portada dice «Analizado a UF 2.950, un 4,2 % bajo el precio publicado»;
//       `analisis_creado` lleva la marca.
//   6 · EL SLIDER DE LA TASA: de 3,0 a 6,0 de a 0,25, la marca y el valor de la tasa del mes, «Usar la del mes» la deja
//       siguiendo al motor (null); `explorar_tasa_slider` al soltarlo. Con otra tasa la capa no existe y Filtros lo dice.
//   7 · «APLICAR MI PERFIL DE BÚSQUEDA» muestra el resumen del perfil antes de tocarlo, con su tooltip.
//   8 · LA MEDICIÓN DEL CHIP: `explorar_negociar` con el tope, desde la barra y desde Filtros.
//   9 · LA CAPA SOLO CON LO QUE CALCULA LA NOCHE, Y SIN CUENTA BORROSA: pie 20 o 30, 30 años, la tasa del motor, renta larga; el
//       tope mayor es el de la noche. Sin cuenta, el precio negociado y el flujo no viajan y la tarjeta los dibuja borrosos.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. §4 cuenta contra la base (dos conteos); lo demás, 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-negociar-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import * as po from "../../../src/lib/explorar/portal";
import * as cn from "../../../src/lib/explorar/capa-negociar";
import { BIENVENIDA_COPY } from "../../../src/lib/explorar/abierto";
import { AL_PRECIO_PUBLICADO, NEGOCIADO_COPY } from "../../../src/lib/precio-publicado";
import { lineaVeredicto } from "../../../src/lib/guia/aviso-analizar";
import { lineaNegociadoPortada, negociadoDePortada } from "../../../src/lib/guia/precio-negociado-portada";
import { eventoAnalisisCreado } from "../../../src/lib/medicion-activacion";
import { TASAS_ELEGIBLES } from "../../../src/lib/deptos/estandar";
import { TOPE_NEGOCIAR_PCT } from "../../../src/lib/avisos/negociar-tope";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
/** El cuerpo de una función: de su firma a la siguiente declaración de primer nivel (sin comentarios). "" si no está. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export |async function |function |const [A-Za-z]+ = )/);
  return src.slice(i, j < 0 ? undefined : i + firma.length + j);
}
/** Un elemento JSX por su marca: desde la etiqueta que abre (la que lleva `data-explorar="<marca>"`) hasta su cierre del mismo
 *  nombre, contando anidados. "" si no está. */
function elemento(src: string, marca: string): string {
  const k = src.indexOf(`data-explorar="${marca}"`);
  if (k < 0) return "";
  const ini = src.lastIndexOf("<", k);
  const nombre = src.slice(ini + 1).match(/^[A-Za-z]+/)?.[0];
  if (!nombre) return "";
  const re = new RegExp(`<${nombre}\\b|</${nombre}>`, "g");
  re.lastIndex = ini;
  let prof = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0].startsWith("</")) { prof--; if (prof === 0) return src.slice(ini, m.index + m[0].length); }
    else if (!src.slice(m.index, src.indexOf(">", m.index) + 1).endsWith("/>")) prof++;
  }
  return "";
}
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up va por un portal del navegador: acá el portal se dibuja en línea (como EXPLORAR-PORTAL). */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujar(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
/** Lo que queda de un HTML sin los chips de la casa: si ahí se nombra un veredicto como chip, es un chip inventado. */
const sinChipsDeLaCasa = (html: string) => html.replace(/<span class="chip-v [^"]*"[^>]*>[^<]*<\/span>/g, " ");
const CHIP_INVENTADO = /[✓−✕–—-]\s*(Comprar|Ajustar|Buscar otro)/;
/** Los chips de Comprar CON NÚMERO de un HTML y lo que viene después, hasta el cierre del elemento que los contiene. */
function chipsComprarConNumero(html: string): Array<{ chip: string; despues: string }> {
  const out: Array<{ chip: string; despues: string }> = [];
  for (const m of html.matchAll(/<span class="chip-v c[^"]*" data-veredicto="COMPRAR" data-puntaje="\d+">[^<]*<\/span>/g)) {
    const i = (m.index ?? 0) + m[0].length;
    out.push({ chip: m[0], despues: texto(html.slice(i, i + 220)) });
  }
  return out;
}

const NADA = () => {};
const PIN = { avisoId: "c1", comuna: "Ñuñoa", lat: -33.45, lng: -70.6, m2: 58, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4290, veredicto: "COMPRAR", score: 84, flujo: 64000, arriendo: 720000, condicion: "usado" as const, alta: null };
const NEG = { ...PIN, avisoId: "n1", precioUF: 3080, veredicto: "AJUSTA SUPUESTOS", score: 58, flujo: -40000, neg: { d: 4.2, p: 2950, s: 71, f: 12000 } };
const PERFIL: po.FiltrosPortal = { ...po.FILTROS_GLOBALES, comunas: ["Providencia"], tipologias: ["2"], ufMin: 4000, ufMax: 6000, pie: 20, plazo: 30, tasa: null };

export async function runExplorarNegociarTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-NEGOCIAR («al precio publicado» en cada superficie, los chips de la casa, la capa «Si negocias» aparte y sin rojo, nunca un Buscar otro, el informe negociado con los dos precios, el slider de 0,25 y «Usar la del mes», el perfil con su resumen · 0 tokens + 2 conteos) ───");

  const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
  const tarjetaSrc = codigo("src/app/explorar/tarjeta-pin.tsx");
  const filtrosSrc = codigo("src/app/explorar/hoja-filtros.tsx");
  const mapaSrc = codigo("src/app/explorar/mapa-explorar.tsx");
  const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
  const modTar = cargar<{ TarjetaPin: FC<Record<string, unknown>>; VeredictosNegociado: FC<Record<string, unknown>> }>("src/app/explorar/tarjeta-pin", F);
  const modLis = cargar<{ ListaPortal: FC<Record<string, unknown>> }>("src/app/explorar/lista-portal", F);
  const modFil = cargar<{ HojaFiltros: FC<Record<string, unknown>> }>("src/app/explorar/hoja-filtros", F);
  const modPop = cargar<{ AvisoAntesDeAnalizar: FC<Record<string, unknown>> }>("src/components/guia/AvisoAntesDeAnalizar", F);
  const modPor = cargar<{ PortadaInforme: FC<Record<string, unknown>> }>("src/components/analysis/portada/PortadaInforme", F);

  // Los dibujos que se miran en varias secciones.
  const tarjeta = (pines: unknown[], sel: string, sinCuenta = false) => modTar ? dibujar(createElement(modTar.TarjetaPin, { pines, seleccionado: sel, uf: 39000, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar: NADA, alCerrar: NADA, alGuardar: NADA, alAnalizar: NADA, sinCuenta })) : "";
  // (03-nov-2026) La cabecera de la lista es el desglose de la barra: dos ✓ Comprar y un − Ajustar.
  const lista = (sinCuenta = false) => modLis ? dibujar(createElement(modLis.ListaPortal, { pines: [PIN, { ...PIN, avisoId: "c2", score: 80 }], negociados: [NEG], tope: 5, desglose: po.desgloseBarra(2, 1, 5), calculando: null, orden: "puntaje", uf: 39000, analizados: {}, guardados: new Set(), alOrden: NADA, alAbrir: NADA, alGuardar: NADA, alAvisame: NADA, alCerrar: NADA, sinCuenta })) : "";
  const filtros = (f: po.FiltrosPortal, extra: Record<string, unknown> = {}) => modFil ? dibujar(createElement(modFil.HojaFiltros, { filtros: f, tasa: { tasa: 4.07 }, miBusqueda: { activa: false, alUsar() {}, perfil: PERFIL }, contar: () => 201, contarNegociados: () => 48, asegurar() {}, alAplicar() {}, alCerrar() {}, alPedirRegistro: null, ...extra })) : "";
  const popup = (negociado: unknown, movido: string | null = null) => modPop ? dibujarPopup(createElement(modPop.AvisoAntesDeAnalizar, {
    depto: { comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: negociado ? 3080 : 4290, condicion: "usado" }, negociado, movido,
    modalidad: "ltr", combinacion: { piePct: 20, plazoAnios: 30, tasaPct: null }, finanzas: { tasa: 4.07, uf: 39000, arriendo: 720000 },
    uso: { tipo: "con", n: 2, noVencen: false }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {}, avisoId: "c1",
    cambio: negociado ? null : { recalcular: async () => null, base: { veredicto: "COMPRAR", score: 84, flujo: 64000 } },
  })) : "";
  const hTarjetaC = tarjeta([PIN], "c1");
  const hTarjetaN = tarjeta([NEG], "n1");
  const hLista = lista();
  const hFiltros = filtros({ ...po.FILTROS_GLOBALES, negociar: 5 });
  const hPopN = popup({ precioUF: 2950, descuentoPct: 4.2, score: 71 });

  // ── 1 · «AL PRECIO PUBLICADO» ──
  // Mutaciones: M1 «¿Cómo se calcula?» sin la frase · M2 la barra de abajo sin la frase · M3 la tarjeta sin la frase · M4 un chip
  // nuevo con número que no la dice.
  {
    if (AL_PRECIO_PUBLICADO !== "al precio publicado") F(`1 · la frase es «${AL_PRECIO_PUBLICADO}»`);
    // (03-nov-2026) El primer párrafo de la hoja es texto fijo; el perfil, sus viñetas.
    const est = po.COMO_SE_CALCULA.estandar;
    if (!est.includes("calcula cuáles convienen al precio publicado")) F(`1 · «¿Cómo se calcula?» no dice «calcula cuáles convienen al precio publicado»: «${est.slice(0, 140)}»`);
    if (!/convienen[^.]*, al precio publicado\.$/.test(BIENVENIDA_COPY.titulo)) F(`1 · la bienvenida no dice «al precio publicado»: «${BIENVENIDA_COPY.titulo}»`);
    const lv = lineaVeredicto({ veredicto: "COMPRAR", score: 84, flujo: 88363 });
    if (!lv?.startsWith("Comprar 84 al precio publicado")) F(`1 · el pop-up no dice «Comprar 84 al precio publicado»: «${lv}»`);
    // La barra de abajo (teléfono y PC): el chip de Comprar y la frase, en la misma línea.
    // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · la barra es el desglose (desglose.tsx), el mismo en el teléfono y
    // en el PC: la línea de los ✓ Comprar dibujada dice «al precio publicado» junto al chip.
    {
      const modDes = cargar<{ BarraAbajo: FC<Record<string, unknown>> }>("src/app/explorar/desglose", F);
      const hb = modDes ? dibujar(createElement(modDes.BarraAbajo, { desglose: po.desgloseBarra(10, 3, 10), calculando: null, alVerLista() {} })) : "";
      const lc = hb.slice(hb.indexOf('data-explorar="linea-comprar"'), hb.indexOf('data-explorar="linea-ajustar"'));
      if (!/<span class="chip-v c"[^>]*data-veredicto="COMPRAR"[^>]*>[^<]*<\/span> al precio publicado/.test(lc)) F("1 · la barra de abajo no dice «al precio publicado» junto al chip ✓ Comprar");
    }
    // Todo chip de Comprar con número, en la tarjeta y la lista (sin los negociados, que dicen «Si consigues»), lo dice al lado.
    const conNumero = [...chipsComprarConNumero(hTarjetaC), ...chipsComprarConNumero(sinNegociadas(hLista))];
    if (conNumero.length < 3) F(`1 · la tarjeta y la lista dibujan ${conNumero.length} chips de Comprar con número (se esperaban 3: no se pudo medir)`);
    for (const c of conNumero) if (!c.despues.startsWith("al precio publicado")) F(`1 · un chip «${texto(c.chip)}» no dice «al precio publicado» al lado: «${c.despues.slice(0, 60)}»`);
    // ⚠ ACTA (03-nov-2026) · la cabecera de la lista es el desglose: el total y la línea de los ✓ Comprar «al precio publicado».
    const cab = texto(hLista.match(/<div[^>]*data-explorar="titulo-lista"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "");
    if (!/^3 deptos 2 ✓ Comprar al precio publicado/.test(cab)) F(`1 · el título de la lista no dice «al precio publicado»: «${cab}»`);
    // Todo el copy de Explorar que dice «conviene» dice a qué precio («al precio publicado», o «si negocias» en la capa): también
    // la barra y la lista sin ninguno y el tooltip de la tasa. Fuera, con su razón: el nombre de la pestaña, el tooltip del
    // financiamiento (copy del goal: habla de «a ti», no del precio) y el paso 1 de la bienvenida, cuyo título ya lo dice.
    const FUERA = ["PORTAL_COPY.pestana", "PORTAL_COPY.v2.financiamiento.tooltip", "BIENVENIDA_COPY.paso1"];
    const textos: [string, string][] = [["deptosN(0)", po.deptosN(0)], ["DESGLOSE_COPY.ninguno(10)", po.DESGLOSE_COPY.ninguno(10)]];
    const recorrer = (o: object, ruta: string) => {
      for (const [k, v] of Object.entries(o)) {
        const r = `${ruta}.${k}`;
        if (typeof v === "string") textos.push([r, v]);
        else if (typeof v === "function") {
          try { const x = (v as (...a: unknown[]) => unknown)(4.07, 20, 30); if (typeof x === "string") textos.push([`${r}()`, x]); } catch { /* otra firma */ }
        } else if (v && typeof v === "object") recorrer(v, r);
      }
    };
    recorrer(po.COMO_SE_CALCULA, "COMO_SE_CALCULA");
    recorrer(po.PORTAL_COPY, "PORTAL_COPY");
    recorrer(cn.NEGOCIAR_COPY, "NEGOCIAR_COPY");
    recorrer(BIENVENIDA_COPY, "BIENVENIDA_COPY");
    const conConviene = textos.filter(([, t]) => /convien/i.test(t));
    if (conConviene.length < 6) F(`1 · el barrido del copy encontró ${conConviene.length} textos con «conviene» (se esperaban 6 o más: no se pudo medir)`);
    for (const r of FUERA) if (!conConviene.some(([x]) => x === r)) F(`1 · la excepción ${r} ya no dice «conviene» (o no existe): sácala de la lista`);
    // ⚠ ACTA (03-nov-2026, el texto de Fabrizio en la hoja) · «Los que convienen solo con un descuento llevan − Ajustar» dice a qué
    // precio con «con un descuento»: cuenta como «si negocias».
    for (const [r, t] of conConviene) if (!FUERA.includes(r) && !/al precio publicado|si negocias|con un descuento/i.test(t)) F(`1 · ${r} dice «conviene» sin «al precio publicado»: «${t.slice(0, 90)}»`);
    // En el código: todo ChipVeredicto con puntaje en Explorar y el pop-up es el de VeredictoDelPin (que dice la frase) o el del
    // negociado (que dice «Si consigues»).
    for (const p of ["src/app/explorar/explorar-cliente.tsx", "src/app/explorar/tarjeta-pin.tsx", "src/app/explorar/lista-portal.tsx", "src/app/explorar/hoja-filtros.tsx", "src/components/guia/AvisoAntesDeAnalizar.tsx"]) {
      for (const m of codigo(p).matchAll(/<ChipVeredicto\b[^>]*\bpuntaje=\{([^}]+)\}[^>]*\/>/g)) {
        const linea = codigo(p).slice(codigo(p).lastIndexOf("\n", m.index ?? 0), codigo(p).indexOf("\n", m.index ?? 0));
        const ok = (m[1] === "p.score" && /\{AL_PRECIO_PUBLICADO\}/.test(linea)) || (/neg\.s|negociado\.score/.test(m[1]) && /\{siConsigues\.antes\}|\{NEGOCIAR_COPY\.consigues\}/.test(linea));
        if (!ok) F(`1 · ${p}: un chip con número («puntaje={${m[1]}}») sin «al precio publicado» ni «Si consigues» al lado`);
      }
    }
  }

  // ── 2 · LOS CHIPS SON EL DE LA CASA ──
  // Mutaciones: M5 la ayuda de Filtros con un chip inventado · M6 el chip de la casa sin el puntaje adentro.
  {
    const html = { tarjetaComprar: hTarjetaC, tarjetaNegociado: hTarjetaN, lista: hLista, filtros: hFiltros, popupNegociado: hPopN };
    for (const [k, h] of Object.entries(html)) {
      if (!h) { F(`2 · no se pudo dibujar ${k}`); continue; }
      const resto = texto(sinChipsDeLaCasa(h));
      if (CHIP_INVENTADO.test(resto)) F(`2 · ${k} nombra un veredicto como chip fuera de ChipVeredicto: «${resto.match(CHIP_INVENTADO)?.[0]}»`);
      if (!/class="chip-v /.test(h)) F(`2 · ${k} no dibuja ningún chip de la casa`);
    }
    const ayuda = hFiltros.match(/<p[^>]*data-explorar="ayuda-negociar"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? "";
    if (!/class="chip-v a"[^>]*data-veredicto="AJUSTA SUPUESTOS"/.test(ayuda) || !/class="chip-v c"[^>]*data-veredicto="COMPRAR"/.test(ayuda)) F("2 · la ayuda de «Si negocias el precio» no lleva los chips reales de Ajustar y Comprar");
    // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · el grupo es «Descuento máximo para − Ajustar» y la capa se ve de
    // entrada: la ayuda dice qué son y de cuánto descuento, sin «Suma» (ya no se prende acá).
    if (!/^Los deptos que al precio publicado dan − Ajustar , pero llegan a ✓ Comprar si consigues un descuento de hasta:$/.test(texto(ayuda))) F(`2 · la ayuda de negociar dice «${texto(ayuda)}»`);
    if (/factible|con argumentos/i.test(texto(hFiltros))) F("2 · Filtros dice «factible» o «con argumentos»");
    const conPuntaje = renderToStaticMarkup(createElement((require(join(RAIZ, "src/components/analysis/shared/ChipVeredicto")) as { ChipVeredicto: FC<Record<string, unknown>> }).ChipVeredicto, { v: "COMPRAR", puntaje: 71 }));
    if (!/^<span class="chip-v c" data-veredicto="COMPRAR" data-puntaje="71">✓ Comprar · 71<\/span>$/.test(conPuntaje)) F(`2 · el chip de la casa con puntaje dibuja ${conPuntaje}`);
  }

  // ── 3 · LOS NEGOCIADOS VAN APARTE Y SIN ROJO ──
  // Mutaciones: M7 el total suma los negociados · M8 la lista los pone primero · M9 el pin del negociado en rojo · M10 la marca de la
  // tasa en rojo · M11 el botón de Filtros suma las dos cuentas.
  {
    // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · las dos cuentas siguen separadas, ahora con los chips de la casa:
    // el botón de Filtros («Ver 201 [✓ Comprar] + 48 [− Ajustar]») y la barra (una línea por clase). El número de arriba de la
    // barra es «N deptos» del mapa —las dos clases—, y nunca se dice «convienen» de él.
    { const v = po.botonVer(201, 48); if (v.tipo !== "cuentas" || v.comprar !== "201" || v.ajustar !== "48") F(`3 · el botón de Filtros no separa las dos cuentas: ${JSON.stringify(v)}`); }
    { const v = po.botonVer(201, 0); if (v.tipo !== "cuentas" || v.ajustar !== null) F("3 · sin negociados, el botón de Filtros no es solo el de los ✓ Comprar"); }
    { const d = po.desgloseBarra(6802, 3238, 10); if (d.comprar?.n !== 6802 || d.ajustar?.n !== 3238 || /convien/i.test(d.titulo)) F(`3 · la barra no separa las dos clases (o llama «convienen» a la suma): ${JSON.stringify(d)}`); }
    const total = cliente.match(/const total = ([^;]+);/)?.[1] ?? "";
    if (!total || /neg/i.test(total) || !/visibles\.length/.test(total)) F(`3 · el número de «convienen» no es solo el de los Comprar: «${total || "no está"}»`);
    const iContar = cliente.indexOf("const contar = useCallback(");
    const contar = iContar < 0 ? "" : cliente.slice(iContar, cliente.indexOf("}, [", iContar));
    if (!contar || /negociad|Neg\b/i.test(contar)) F("3 · «contar» (el número de Filtros) mira la capa negociada");
    // ⚠ ACTA (03-nov-2026) · la cuenta aparte es la línea de los − Ajustar del desglose, que cuenta los que se ven en el mapa.
    if (!/const desglose = [^;]*desgloseBarra\(total, nAjustar, /.test(cliente) || !/const nAjustar = !capa \? 0 : negociadosDelPie \? visiblesNeg\.length :/.test(cliente)) F("3 · la barra de abajo no lleva la cuenta aparte de los negociados");
    // La lista: dos Comprar, el título de la capa y el negociado, en ese orden; el título cuenta 2.
    const filas = Array.from(hLista.matchAll(/data-explorar="(fila|fila-negociada|titulo-negociar)"/g)).map((m) => m[1]);
    if (filas.join(",") !== "fila,fila,titulo-negociar,fila-negociada") F(`3 · la lista no pone los negociados después de los Comprar, con su título: ${filas.join(",")}`);
    const lineaAjustar = hLista.slice(hLista.indexOf('data-explorar="linea-ajustar"'));
    if (!/^data-explorar="linea-ajustar" data-n="1"><b>1<\/b> <span class="ex-pegado"><span class="chip-v a"/.test(lineaAjustar)) F("3 · la lista no lleva la cuenta aparte de los negociados");
    // El mapa: la capa en la ciruela del chip Ajustar (colores-pin.ts, la de --verdict-ajusta en claro), con el número en blanco;
    // nunca el rojo. ⚠ ACTA (03-nov-2026) · los colores viven en colores-pin.ts y se dibujan por iconoPin (EXPLORAR-PASADA §5).
    const cpin = require(join(RAIZ, "src/lib/explorar/colores-pin")) as typeof import("../../../src/lib/explorar/colores-pin");
    const ajusta = leer("src/app/globals.css").match(/--verdict-ajusta:(#[0-9A-Fa-f]{6})/)?.[1];
    if (cpin.COLORES_PIN.claro.ajustar.fondo !== ajusta) F(`3 · el pin negociado no es el color de Ajustar (${cpin.COLORES_PIN.claro.ajustar.fondo} vs --verdict-ajusta ${ajusta})`);
    const capa = mapaSrc.slice(mapaSrc.indexOf("const negs ="), mapaSrc.indexOf("const e = sel ?"));
    if (capa.length < 200 || (capa.match(/"ajustar"/g) ?? []).length < 3 || /"comprar"|C8323C|signal-red/.test(capa)) F("3 · el mapa dibuja la capa negociada sin ciruela o con otro color");
    if (cpin.COLORES_PIN.claro.ajustar.texto.toUpperCase() !== "#FFFFFF") F("3 · el número del pin negociado no es blanco");
    // EL SATÉLITE (QA en el preview, 02-nov-2026): lejos, el grupo de la capa que un rojo tapa se corre a su borde con el número a
    // la vista; el que nada tapa no se mueve. Fixtures sobre la función pura, y el cableado en el mapa.
    {
      const fuera = (c: cn.Circulo, s: { dx: number; dy: number }, r: cn.Circulo) => Math.hypot(c.x + s.dx - r.x, c.y + s.dy - r.y) - r.r;
      const rojo = { x: 0, y: 0, r: 28 }, mismo = { x: 0, y: 0, r: 20 };
      const s1 = cn.satelite(mismo, [rojo]);
      if (Math.abs(fuera(mismo, s1, rojo) - 20 * cn.SATELITE_FUERA) > 1e-6 || !(s1.dx > 0 && s1.dy > 0)) F(`3 · el grupo tapado de lleno no queda pegado al borde del rojo, abajo a la derecha: ${JSON.stringify(s1)}`);
      const s2 = cn.satelite({ x: 100, y: 0, r: 20 }, [rojo]);
      if (s2.dx !== 0 || s2.dy !== 0) F("3 · un grupo que ningún rojo tapa se corre");
      const s3 = cn.satelite({ x: 28 + 20 * 0.9, y: 0, r: 20 }, [rojo]);
      if (s3.dx !== 0 || s3.dy !== 0) F("3 · un grupo que el rojo apenas roza se corre");
      // Otro rojo justo donde iría el satélite: gira y queda libre de los dos.
      const otro = { x: Math.cos(Math.PI / 4) * 44, y: Math.sin(Math.PI / 4) * 44, r: 24 };
      const s4 = cn.satelite(mismo, [rojo, otro]);
      if ([rojo, otro].some((r) => fuera(mismo, s4, r) < 20 * cn.SATELITE_FUERA - 1e-6)) F(`3 · con otro rojo en el camino, el satélite queda tapado: ${JSON.stringify(s4)}`);
      // ⚠ ACTA (03-nov-2026) · los de arriba ya no son rojos (azul ✓ Comprar): la lista se llama `arriba`; la regla es la misma.
      if (!/arriba\.push\(circulo\(gr\.lat, gr\.lng, icono\.w \/ 2\)\)/.test(mapaSrc)) F("3 · el mapa no anota los grupos de los ✓ Comprar para el satélite");
      if (!/const icono = grupo\("ajustar", gr\.n\);\s*marcador\(pos, icono, 0, [^\n]*, satelite\(circulo\(gr\.lat, gr\.lng, icono\.w \/ 2\), arriba\)\)/.test(capa)) F("3 · los grupos de la capa no se corren cuando un ✓ Comprar los tapa");
      if (!/anchor: new g\.maps\.Point\(icono\.w \/ 2 - corrido\.dx, icono\.h \/ 2 - corrido\.dy\)/.test(mapaSrc)) F("3 · el corrimiento no llega al ancla del ícono");
    }
    // El interruptor del chip y la marca de la tasa, en tinta (sin el rojo).
    const css = leer("src/app/explorar/explorar.css");
    const v2 = css.slice(css.indexOf("FILTROS V2"));
    for (const sel of [".ex-sw", ".ex-chip-neg", ".ex-slider-marca"]) {
      const reglas = Array.from(v2.matchAll(/([^{}]+)\{([^}]*)\}/g)).filter((m) => m[1].includes(sel)).map((m) => m[2]).join(" ");
      if (!reglas) F(`3 · no está el estilo de ${sel}`);
      else if (/signal-red|#C8323C|--franco-red|--verdict-buscar/i.test(reglas)) F(`3 · ${sel} usa el rojo`);
    }
    // El interruptor de la tarjeta «Si negocias el precio» en Filtros (el de siempre, fuera de la sección v2), prendido en tinta.
    const prendido = css.match(/\.ex-interruptor input:checked \{([^}]*)\}/)?.[1] ?? "";
    if (!/background: var\(--franco-text\)/.test(prendido)) F("3 · el interruptor de Filtros, prendido, no va en tinta");
  }

  // ── 4 · UN BUSCAR OTRO NUNCA ENTRA ──
  // Mutaciones: M12 la noche calcula también los Buscar otro · M13 el SQL de la capa no filtra por Ajustar · M14 la capa no deja
  // fuera a los que ya convienen.
  {
    const ng = cargar<typeof import("../../../src/lib/avisos/negociar")>("src/lib/avisos/negociar", F);
    if (ng) {
      // Un candidato que anota cada lectura: si la noche lo mirara para un Buscar otro o un Comprar, lo estaría calculando. Y para
      // un Ajustar tiene que mirarlo (si no, la regla no se midió).
      const espia = () => { const leidas: string[] = []; return { leidas, c: new Proxy({}, { get(_, k) { leidas.push(String(k)); return undefined; } }) as never }; };
      const noCalcula = espia();
      try {
        const r = ng.evaluarNegociar(noCalcula.c, { veredicto_20: "BUSCAR OTRA", veredicto_30: "COMPRAR" }, { uf: 39000, tasa: 4.07 });
        if (r.negociar_20 !== null || r.negociar_30 !== null) F("4 · la noche guarda un descuento para un Buscar otro o un Comprar");
      } catch { /* lo anota el espía */ }
      if (noCalcula.leidas.length > 0) F(`4 · la noche calcula el descuento de un Buscar otro o un Comprar (leyó ${noCalcula.leidas.slice(0, 3).join(", ")})`);
      const calcula = espia();
      try { ng.evaluarNegociar(calcula.c, { veredicto_20: "AJUSTA SUPUESTOS", veredicto_30: null }, { uf: 39000, tasa: 4.07 }); } catch { /* basta con que lo haya leído */ }
      if (calcula.leidas.length === 0) F("4 · la noche no calcula el descuento de un Ajustar: no se pudo medir la regla");
    }
    const sql = sinComentarios(leer("supabase/migrations/20261102_negociar_explorar.sql"));
    const fn = sql.slice(sql.indexOf("function public.explorar_negociar"));
    if (!/\(case when pie = 30 then ae\.veredicto_30 else ae\.veredicto_20 end\) = 'AJUSTA SUPUESTOS'/.test(fn)) F("4 · el SQL de la capa no se queda solo con los que dan Ajustar a ese pie");
    if (cn.descompactarNegociados(cn.compactarNegociados([NEG as cn.PinNegociado]))[0]?.veredicto !== "AJUSTA SUPUESTOS") F("4 · un negociado no viaja como Ajustar");
    const f = { ...po.FILTROS_GLOBALES, negociar: 5 as const };
    const dejados = cn.filtrarNegociados([NEG as cn.PinNegociado, { ...NEG, avisoId: "n2" } as cn.PinNegociado], f, 5, new Set(["n2"])).map((p) => p.avisoId);
    if (dejados.join() !== "n1") F(`4 · la capa no deja fuera a los que ya convienen: ${dejados.join()}`);
    if (cn.filtrarNegociados([{ ...NEG, neg: { ...NEG.neg, d: 7.5 } } as cn.PinNegociado], f, 5).length !== 0) F("4 · la capa con tope 5 % deja entrar un descuento de 7,5 %");
    // La base: ninguna fila con descuento que no dé Ajustar a ese pie.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) F("4 · sin credenciales de la base: no se pudo contar (un cero que no corrió no es un cero)");
    else {
      const db = createClient(url, key, { auth: { persistSession: false } });
      for (const pie of [20, 30]) {
        const { count, error } = await db.from("avisos_evaluados").select("aviso_id", { count: "exact", head: true }).not(`negociar_${pie}`, "is", null).or(`veredicto_${pie}.is.null,veredicto_${pie}.neq.AJUSTA SUPUESTOS`);
        if (error || count == null) F(`4 · no se pudo contar en la base a pie ${pie}: ${error?.message ?? "sin número"}`);
        else if (count > 0) F(`4 · la base tiene ${count} avisos con descuento a pie ${pie} que no dan Ajustar`);
      }
    }
  }

  // ── 5 · EL INFORME NEGOCIADO LLEVA LOS DOS PRECIOS ──
  // Mutaciones: M15 la portada sin la línea · M16 la ruta sin el piso antes del evento · M17 el informe al precio publicado · M18 el
  // informe sin los dos precios · M19 `analisis_creado` sin la marca.
  {
    const np = negociadoDePortada({ origenAviso: { precioNegociado: { publicadoUF: 3080, negociadoUF: 2950, descuentoPct: 4.2 } } });
    if (!np || lineaNegociadoPortada(np) !== "Analizado a UF 2.950, un 4,2 % bajo el precio publicado") F(`5 · la portada dice «${np ? lineaNegociadoPortada(np) : "nada"}»`);
    if (negociadoDePortada({ origenAviso: {} }) !== null || negociadoDePortada({ origenAviso: { precioNegociado: { publicadoUF: 3080, negociadoUF: 3080, descuentoPct: 0 } } }) !== null) F("5 · la portada dice un precio negociado que no lo es");
    if (modPor) {
      const portada = (precioNegociado: unknown) => renderToStaticMarkup(createElement(modPor.PortadaInforme, {
        veredicto: "COMPRAR", score: 71, direccion: "", comuna: "Ñuñoa", modalidadLabel: "Renta larga", fecha: "2 nov 2026", titular: null, cifra: null,
        ficha: { titulo: "Ñuñoa", sub: null, grupos: [], ufValue: 39000 }, precioNegociado, currency: "CLP", onCurrencyChange: () => {}, mapa: null,
      }));
      const con = portada(np);
      const linea = con.match(/<p[^>]*data-portada="precio-negociado"[^>]*>([^<]*)<\/p>/);
      if (!linea || linea[1] !== "Analizado a UF 2.950, un 4,2 % bajo el precio publicado" || !/title="Precio publicado: UF 3\.080"/.test(linea[0])) F(`5 · la portada no dibuja los dos precios: ${linea?.[0] ?? "sin la línea"}`);
      if (/data-portada="precio-negociado"/.test(portada(null))) F("5 · la portada dice un precio negociado sin haberlo");
    }
    if (!/precioNegociado=\{negociadoDePortada\(inputData\)\}/.test(codigo("src/components/analysis/SubjectCardGrid.tsx"))) F("5 · el informe no le pasa el precio negociado a la portada");
    // El piso: en UF enteras, bajo el publicado y no más abajo que el publicado menos el tope.
    const piso: Array<[number, number, number, boolean]> = [[2950, 3080, 5, true], [2926, 3080, 5, true], [2925, 3080, 5, false], [3080, 3080, 5, false], [2950.5, 3080, 5, false], [2950, 3080, 7, false], [2773, 3080, 10, true], [2771, 3080, 10, false]];
    for (const [n, p, t, esperado] of piso) if (cn.precioNegociadoValido(n, p, t) !== esperado) F(`5 · el piso acepta mal UF ${n} sobre UF ${p} con tope ${t} % (debía ser ${esperado})`);
    // La ruta: el piso ANTES del evento de Meta y de leer la ficha; el informe al precio negociado, con los dos precios; la marca.
    const post = ruta.slice(ruta.indexOf("export async function POST"));
    // El bloque entero, no la mención: un `if (false)` delante o un return que no corta dejarían la llamada en su lugar.
    const piso0 = post.match(/if \(negociadoUF != null\) \{\s*const avisoNeg = await leerAvisoGuia\(admin, b\.avisoId, origen\);\s*if \(!avisoNeg\) return NextResponse\.json\(\{ error: "aviso" \}, \{ status: 404 \}\);\s*if \(!precioNegociadoValido\(negociadoUF, avisoNeg\.precioUF, Number\(b\.topeNegociar\)\)\) return NextResponse\.json\(\{ error: "precio-negociado" \}, \{ status: 400 \}\);\s*\}/);
    const iPiso = piso0?.index ?? -1, iMeta = post.indexOf("emitirEventoMeta("), iFicha = post.indexOf("chequearPublicacion(");
    if (iPiso < 0 || iMeta < 0 || iFicha < 0 || iPiso > iMeta || iPiso > iFicha) F("5 · la ruta mira el piso del precio negociado después del evento o de leer la ficha (o no lo mira)");
    if (!/negociadoUF != null && !precioNegociadoValido\(negociadoUF, aviso\.precioUF, Number\(b\.topeNegociar\)\)\) return \{ ok: false, status: 400, error: "precio-negociado" \};/.test(post)) F("5 · `preparar` no vuelve a mirar el piso con el aviso que usa");
    if (!/cuerpoDelAviso\(precioNegociado \? \{ \.\.\.aviso, precioUF: precioNegociado\.negociadoUF \} : aviso,/.test(post)) F("5 · el informe negociado no se hace al precio negociado");
    if (!/body\.origenAviso\.precioNegociado = precioNegociado;/.test(post) || !/precioNegociado = negociadoUF != null \? \{ publicadoUF, negociadoUF, descuentoPct:/.test(post)) F("5 · el informe negociado no guarda los dos precios");
    if (!/capturarAnalisisCreado\(\{[^}]*\bprecioNegociado \}\)/.test(post)) F("5 · `analisis_creado` no recibe el precio negociado");
    const ev = eventoAnalisisCreado({ userId: "u", analysisId: "a", modalidad: "ltr", via: "explorar", precioNegociado: { descuentoPct: 4.2 } }).properties as Record<string, unknown>;
    const sin = eventoAnalisisCreado({ userId: "u", analysisId: "a", modalidad: "ltr", via: "explorar" }).properties as Record<string, unknown>;
    if (ev.precio_negociado !== true || ev.descuento_pct !== 4.2 || "precio_negociado" in sin) F(`5 · analisis_creado no lleva la marca del precio negociado: ${JSON.stringify(ev)}`);
    // El navegador manda el precio y el tope solo para un negociado con cifras.
    if (!/esNegociado\(it\) && conCifrasNegociado\(it\) && filtros\.negociar != null \? \{ precioNegociadoUF: it\.neg\.p, topeNegociar: filtros\.negociar \}/.test(cuerpo(cliente, "async function analizar("))) F("5 · «Analizar a UF X» no manda el precio negociado y el tope");
    // El pop-up y la tarjeta: los dos veredictos y el botón.
    const pop = texto(hPopN);
    if (!/Al precio publicado − Ajustar/.test(pop) || !/Si consigues UF 2\.950 \(−4,2 %\) ✓ Comprar · 71/.test(pop)) F(`5 · el pop-up del negociado no dice los dos veredictos: «${pop.slice(0, 200)}»`);
    const tn = texto(hTarjetaN);
    if (!/UF 3\.080 publicado/.test(tn) || !/Al precio publicado − Ajustar/.test(tn) || !/Si consigues UF 2\.950 \(−4,2 %\) ✓ Comprar · 71/.test(tn) || !/Analizar a UF 2\.950/.test(tn)) F(`5 · la tarjeta del negociado no dice los dos precios y «Analizar a UF 2.950»: «${tn.slice(0, 220)}»`);
  }

  // ── 6 · EL SLIDER DE LA TASA ──
  // Mutaciones: M20 «Usar la del mes» fija la del mes en vez de seguir al motor · M21 el slider sin paso de 0,25 · M22 soltarlo no
  // se mide.
  {
    const grilla = Array.from({ length: 13 }, (_, i) => 3 + i * 0.25);
    if (JSON.stringify([...TASAS_ELEGIBLES]) !== JSON.stringify(grilla)) F(`6 · las tasas elegibles no son 3,0 a 6,0 de a 0,25: ${JSON.stringify(TASAS_ELEGIBLES)}`);
    const rango = hFiltros.match(/<input[^>]*type="range"[^>]*>/)?.[0] ?? "";
    if (!/min="3"/.test(rango) || !/max="6"/.test(rango) || !/step="0.25"/.test(rango)) F(`6 · el slider no va de 3 a 6 de a 0,25: ${rango || "sin slider"}`);
    if (texto(hFiltros.match(/<span[^>]*data-explorar="tasa-valor"[^>]*>[\s\S]*?<\/span>\s*<\/span>/)?.[0] ?? "") !== "4,07 % · promedio del mes") F("6 · arriba no dice «4,07 % · promedio del mes»");
    if (!/data-explorar="tasa-marca"/.test(hFiltros)) F("6 · el slider no lleva la marca de la tasa del mes");
    if (!/<button[^>]*disabled=""[^>]*data-explorar="tasa-del-mes"/.test(hFiltros)) F("6 · «Usar la del mes» se puede tocar estando ya en la del mes");
    const otra = filtros({ ...po.FILTROS_GLOBALES, tasa: 4.25, negociar: 5 });
    if (!/data-explorar="tasa-valor"[^>]*>4,25 %</.test(otra) || /<button[^>]*disabled=""[^>]*data-explorar="tasa-del-mes"/.test(otra)) F("6 · con otra tasa, arriba no dice esa tasa o «Usar la del mes» no se puede tocar");
    if (!/data-explorar="sin-capa"/.test(otra) || /data-explorar="sin-capa"/.test(hFiltros)) F("6 · con otra tasa, Filtros no dice que la capa no se muestra (o lo dice con la del mes)");
    const usar = elemento(filtrosSrc, "tasa-del-mes");
    if (!/onClick=\{\(\) => poner\(\{ tasa: null \}\)\}/.test(usar)) F("6 · «Usar la del mes» no deja la tasa siguiendo al motor (null)");
    const slider = (filtrosSrc.match(/<input type="range"[\s\S]*?data-explorar="tasa" \/>/) ?? [""])[0];
    if (!/step=\{TASA_PASO\}/.test(slider) || !/const TASA_PASO = TASAS_ELEGIBLES\[1\] - TASAS_ELEGIBLES\[0\];/.test(filtrosSrc)) F("6 · el paso del slider no es el de las tasas elegibles");
    if (!/onPointerUp=\{soltarTasa\}/.test(slider) || !/onKeyUp=\{soltarTasa\}/.test(slider) || !/const soltarTasa = \(e: \{ currentTarget: HTMLInputElement \}\) => alMoverTasa\(Number\(e\.currentTarget\.value\)\);/.test(filtrosSrc)) F("6 · soltar el slider no avisa la tasa");
    if (po.EVENTOS_PORTAL.tasaSlider !== "explorar_tasa_slider" || !/alMoverTasa=\{\(t\) => posthog\?\.capture\(EVENTOS_PORTAL\.tasaSlider, propsDeTasa\(t,/.test(cliente)) F("6 · soltar el slider no se mide como explorar_tasa_slider");
  }

  // ── 7 · «APLICAR MI PERFIL DE BÚSQUEDA» ──
  // Mutación: M23 la tarjeta del perfil sin el resumen.
  {
    if (po.resumenPerfil(PERFIL) !== "Providencia · 2D · UF 4.000–6.000 · pie 20 % · 30 años · tasa del mes") F(`7 · el resumen del perfil dice «${po.resumenPerfil(PERFIL)}»`);
    const card = hFiltros.match(/<section[^>]*data-explorar="card-perfil"[\s\S]*?<\/section>/)?.[0] ?? "";
    if (texto(card.match(/<span[^>]*data-explorar="perfil-resumen"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? "") !== po.resumenPerfil(PERFIL)) F("7 · «Aplicar mi perfil de búsqueda» no muestra el resumen del perfil");
    if (!/Aplicar mi perfil de búsqueda/.test(texto(card)) || !/>Aplicar</.test(card)) F("7 · la tarjeta del perfil no dice «Aplicar mi perfil de búsqueda» con su botón");
    if (po.PORTAL_COPY.v2.perfil.tooltip !== "Es la búsqueda con la que Franco arma tu selección semanal. Al aplicarla, el mapa muestra solo lo que calza con ella. La editas en tu Dashboard.") F("7 · el tooltip del perfil cambió");
    if (!/<Info [^>]*texto=\{V\.perfil\.tooltip\}/.test(elemento(filtrosSrc, "card-perfil"))) F("7 · la tarjeta del perfil no lleva su tooltip");
  }

  // ── 8 · LA MEDICIÓN DEL CHIP ──
  // Mutación: M24 prender el chip no se mide.
  {
    if (cn.EVENTO_NEGOCIAR !== "explorar_negociar") F(`8 · el evento es «${cn.EVENTO_NEGOCIAR}»`);
    // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · el chip de la barra es «Ver solo ✓ Comprar» y se mide con
    // «explorar_solo_comprar» al prenderlo, con el tope (EXPLORAR-PASADA §3); «explorar_negociar» queda para el descuento máximo de
    // Filtros, con el tope elegido.
    if (JSON.stringify(cn.propsNegociar(5, "filtros", 48)) !== JSON.stringify({ tope: 5, donde: "filtros", n: 48 })) F(`8 · el evento del descuento máximo lleva ${JSON.stringify(cn.propsNegociar(5, "filtros", 48))}`);
    if (!/posthog\?\.capture\(EVENTO_SOLO_COMPRAR, propsSoloComprar\(filtros\.negociar,/.test(cliente)) F("8 · prender el chip de la barra no se mide");
    if (!/fuente === "filtros" && f\.negociar !== filtros\.negociar\) posthog\?\.capture\(EVENTO_NEGOCIAR, propsNegociar\(f\.negociar, "filtros",/.test(cliente)) F("8 · cambiar el tope en Filtros no se mide");
  }

  // ── 9 · LA CAPA SOLO CON LO QUE CALCULA LA NOCHE, Y SIN CUENTA BORROSA ──
  // Mutaciones: M25 la capa con cualquier tasa · M26 sin cuenta viaja el precio negociado · M27 la tarjeta sin cuenta dice el precio.
  {
    const g = po.FILTROS_GLOBALES;
    const casos: Array<[Partial<po.FiltrosPortal>, boolean]> = [[{}, true], [{ pie: 30 }, true], [{ tasa: 4.5 }, false], [{ plazo: 25 }, false], [{ pie: 10 }, false], [{ modalidad: "str" }, false]];
    for (const [c, esperado] of casos) if (cn.capaNegociarDisponible({ ...g, ...c }) !== esperado) F(`9 · la capa con ${JSON.stringify(c)} da ${!esperado} (debía ser ${esperado})`);
    if (Math.max(...cn.TOPES_NEGOCIAR) !== TOPE_NEGOCIAR_PCT || JSON.stringify([...cn.TOPES_NEGOCIAR]) !== "[5,10]") F(`9 · los topes (${cn.TOPES_NEGOCIAR}) no terminan en el de la noche (${TOPE_NEGOCIAR_PCT})`);
    const abierto = cn.sinCifrasNegociados(cn.compactarNegociados([NEG as cn.PinNegociado, { ...NEG, avisoId: "n2", neg: { ...NEG.neg, d: 7.5 } } as cn.PinNegociado]));
    const [a1, a2] = abierto.filas;
    if (a1[14] !== null || a1[16] !== null || a1[9] !== null || a1[10] !== null || a1[13] !== 5 || a2[13] !== 10 || a1[15] !== 71) F(`9 · sin cuenta viajan cifras del negociado (o el descuento no viaja como su tope): ${JSON.stringify(a1)}`);
    // ⚠ ACTA (03-nov-2026, «una sola caché, con una sola edad») · la capa aparte sale de la noche del sello del pedido
    // (nocheExplorar, EXPLORAR-PASADA §9); lo que se exige acá es lo mismo: que salga sin cifras.
    if (!/negociados: sinCifrasNegociados\(noche\.negociados\)/.test(codigo("src/app/api/explorar/abierto/negociar/route.ts"))) F("9 · la ruta abierta de la capa no quita las cifras");
    const pinAbierto = cn.descompactarNegociados(abierto)[0];
    const hAbierta = tarjeta([pinAbierto], "n1", true);
    const ta = texto(hAbierta);
    if (/2\.950|4,2/.test(ta) || (hAbierta.match(/data-explorar="borroso"/g) ?? []).length < 2 || !/Si consigues/.test(ta) || !/✓ Comprar · 71/.test(ta)) F(`9 · la tarjeta sin cuenta no dibuja borrosos el precio y el descuento: «${ta.slice(0, 200)}»`);
    const capaMapa = mapaSrc.slice(mapaSrc.indexOf("const negs ="), mapaSrc.indexOf("const e = sel ?"));
    if (!/if \(sinCifrasRef\.current\) marcador\(\{ lat: p\.lat, lng: p\.lng \}, punto\("ajustar", elegido\)/.test(capaMapa)) F("9 · sin cuenta, el mapa dibuja el descuento en el pin negociado");
  }

  // ── 10 · EL PRECIO NEGOCIADO SE VERIFICA CON LOS DATOS DE HOY ANTES DE COBRAR ──
  // QA en el preview (02-nov-2026): la noche deja el precio en el piso de Comprar con sus comparables y el informe se arma con los de
  // hoy; en 11 de 40 negociados el informe caía a Ajustar. Decisión de Fabrizio: verificar antes de cobrar y, si se movió, mostrar el
  // precio de hoy en el pop-up. Mutaciones: N72-N78 en el acta.
  {
    const ng = cargar<typeof import("../../../src/lib/avisos/negociar")>("src/lib/avisos/negociar", F);
    if (ng) {
      // Un depto que da Comprar en el informe desde UF `umbral` hacia abajo; la sonda, algo más optimista (`umbralSonda`).
      const caso = (umbral: number, umbralSonda: number, negociadoUF: number, tope = 5) => {
        const llamadas: number[] = [];
        return {
          llamadas,
          v: ng.verificarNegociado({
            publicadoUF: 2000, negociadoUF, tope,
            comprarEn: (p) => p <= umbralSonda,
            informeEn: async (p) => { llamadas.push(p); return { veredicto: p <= umbral ? "COMPRAR" : "AJUSTA SUPUESTOS", score: p <= umbral ? 70 : 69, flujo: -1000 }; },
          }),
        };
      };
      const sigue = caso(1960, 1960, 1950);
      const vs = await sigue.v;
      if (vs.estado !== "sigue" || sigue.llamadas.join() !== "1950") F(`10 · con el precio de la noche dando Comprar, la verificación no sigue sola (${vs.estado}, informes a ${sigue.llamadas.join(", ")})`);
      const mov = caso(1930, 1935, 1950);
      const vm = await mov.v;
      if (vm.estado !== "movido" || !(vm.negociado.p <= 1930) || !(vm.negociado.p < 1950) || !mov.llamadas.includes(vm.negociado.p)) F(`10 · el precio movido no es el que el informe de hoy verificó: ${JSON.stringify(vm)} (informes a ${mov.llamadas.join(", ")})`);
      else if (!cn.precioNegociadoValido(vm.negociado.p, 2000, 5) || vm.negociado.s !== 70) F(`10 · el precio movido queda fuera del piso o sin su puntaje: ${JSON.stringify(vm.negociado)}`);
      const nl = await caso(1880, 1880, 1950).v;
      if (nl.estado !== "no-llega") F(`10 · sin llegar a Comprar dentro del tope, la verificación dice «${nl.estado}»`);
    }
    // La ruta: dentro de `preparar`, después de armar el cuerpo y ANTES de reclamar y de cobrar; el informe de verdad a cada precio;
    // 412 con el precio nuevo o «no-llega»; el informe se crea con la mediana con que se verificó.
    const post = ruta.slice(ruta.indexOf("export async function POST"));
    const iPrep = post.indexOf("async preparar()"), iVer = post.indexOf("await verificarNegociado({"), iRec = post.indexOf("async reclamar()"), iCob = post.indexOf("async cobrar()");
    if (iPrep < 0 || iVer < iPrep || iRec < 0 || iVer > iRec || iVer > iCob) F("10 · la ruta no verifica el precio negociado dentro de `preparar`, antes de reclamar y de cobrar");
    if (!/if \(precioNegociado && negociadoUF != null\) \{\s*const mediana = await prefetchMedianaComunaVenta\(admin, body, ufValue\);\s*medianaDeHoy = mediana;/.test(post)) F("10 · la verificación no corre para todo precio negociado (o no guarda la mediana con que verifica)");
    if (!/const r = runAnalysis\(c, ufValue, mediana\);/.test(post) || !/cuerpoDelAviso\(\{ \.\.\.aviso, precioUF \}, conTasa, combinacion, antiguedad,/.test(post)) F("10 · la verificación no usa el informe de verdad a cada precio");
    if (!/negociadoFallo = NextResponse\.json\(\{ error: "precio-movido", negociado: v\.negociado \}, \{ status: 412 \}\);\s*return \{ ok: false, status: 412, error: "precio-movido" \};/.test(post)) F("10 · un precio movido no vuelve al pop-up sin cobrar");
    if (!/if \(v\.estado !== "sigue"\) \{\s*negociadoFallo = NextResponse\.json\(\{ error: "no-llega", tope \}, \{ status: 412 \}\);\s*return \{ ok: false/.test(post)) F("10 · un precio que ya no llega no corta sin cobrar");
    if (!/salir\(plausibleFallo \?\? negociadoFallo \?\? NextResponse\.json/.test(post)) F("10 · la respuesta del precio movido no sale de la ruta");
    if (!/const medianaComuna = medianaDeHoy \?\? await prefetchMedianaComunaVenta\(admin, body, ufValue\);/.test(post)) F("10 · el informe no usa la mediana con que se verificó");
    // El navegador: el precio nuevo al pop-up (y a la capa); el que ya no llega sale de la capa y el pop-up ofrece el publicado.
    const an = cuerpo(cliente, "async function analizar(");
    const iMov = an.indexOf('res.status === 412 && d.error === "precio-movido"'), iGen = an.indexOf("setError({ avisoId: it.avisoId, texto: GUIA.error });");
    if (iMov < 0 || iGen < 0 || iMov > iGen) F("10 · «Analizar a UF X» no atiende el precio movido antes del error genérico");
    if (!/setMovidos\(\(m\) => \(\{ \.\.\.m, \[it\.avisoId\]: nuevo \}\)\);\s*setConfirmar\(\{ it: \{ \.\.\.it, neg: nuevo \} as PinNegociado, sin: false, movido: NEGOCIADO_COPY\.movido\(nuevo\.p, nuevo\.d, it\.neg\.p\) \}\);/.test(an)) F("10 · el pop-up no queda con el precio nuevo y su aviso");
    if (!/d\.error === "no-llega"[\s\S]{0,200}setNoLlegan\([\s\S]{0,80}setConfirmar\(\{ it: alPublicado, sin: false, movido: NEGOCIADO_COPY\.noLlega\(/.test(an)) F("10 · el que ya no llega no sale de la capa o el pop-up no ofrece el publicado");
    if (!/\.map\(\(p\) => \(movidos\[p\.avisoId\] \? \{ \.\.\.p, neg: movidos\[p\.avisoId\] \} : p\)\)/.test(cliente) || !/!noLlegan\.includes\(p\.avisoId\)/.test(cliente)) F("10 · la capa no toma el precio verificado");
    if (!/movido=\{confirmar\.movido \?\? null\}/.test(cliente)) F("10 · el pop-up no recibe el aviso del precio movido");
    // El copy y el pop-up dibujado: el aviso en tinta, el precio nuevo en la línea y en el botón.
    if (NEGOCIADO_COPY.movido(2648, 4.7, 2654) !== "Con los datos de hoy, llega a Comprar con UF 2.648 (−4,7 %), no con UF 2.654. No se usó ningún análisis.") F(`10 · el aviso del precio movido dice «${NEGOCIADO_COPY.movido(2648, 4.7, 2654)}»`);
    if (NEGOCIADO_COPY.noLlega(5) !== "Con los datos de hoy ya no llega a Comprar con un descuento de hasta 5 %. No se usó ningún análisis; puedes analizarlo al precio publicado.") F(`10 · el aviso del que ya no llega dice «${NEGOCIADO_COPY.noLlega(5)}»`);
    const hMov = popup({ precioUF: 2648, descuentoPct: 4.7, score: 70 }, NEGOCIADO_COPY.movido(2648, 4.7, 2654));
    const aviso = texto(hMov.match(/<p[^>]*data-aviso="precio-movido"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? "");
    if (aviso !== NEGOCIADO_COPY.movido(2648, 4.7, 2654) || !/Si consigues UF 2\.648 \(−4,7 %\) ✓ Comprar · 70/.test(texto(hMov)) || !/Analizar a UF 2\.648/.test(texto(hMov))) F(`10 · el pop-up no dibuja el precio de hoy con su aviso: «${aviso || texto(hMov).slice(0, 160)}»`);
    if (/data-aviso="precio-movido"/.test(hPopN)) F("10 · el pop-up dibuja el aviso del precio movido sin que se haya movido");
    const regla = leer("src/components/formulario-v4/wizard-v4.css").match(/\.av-movido \{([^}]*)\}/)?.[1] ?? "";
    if (!regla || /signal-red|#C8323C|--franco-red|--verdict-buscar|var\(--red/i.test(regla)) F("10 · el aviso del precio movido no está en tinta");
  }

  for (const m of fallas) console.log(`  ✗ ${m}`);
  console.log(fallas.length === 0 ? "  ✓ EXPLORAR-NEGOCIAR: todo en orden" : `  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

/** La lista sin las filas negociadas (sus chips de Comprar dicen «Si consigues», no «al precio publicado»). */
function sinNegociadas(html: string): string {
  return html.replace(/<li[^>]*data-explorar="fila-negociada"[\s\S]*?<\/li>/g, "");
}

if (require.main === module) {
  runExplorarNegociarTier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (02-nov-2026, meta-runner que restaura byte a byte): 78 mutaciones a este tier y 26 a los predicados
// reescritos de otros nueve tiers, 104 de 104 en ROJO y cada una por su invariante.
//   §1 N1-N8: «¿Cómo se calcula?», la barra del teléfono, la píldora del PC, la tarjeta, la lista (y un chip nuevo con número),
//      la bienvenida, el pop-up y el título de la lista sin «al precio publicado».
//   §2 N9-N13: un chip inventado en la ayuda de Filtros y en la tarjeta del negociado, el chip de la casa sin el puntaje, la
//      ayuda sin el chip de Comprar, «factible» en los topes.
//   §3 N14-N25: «convienen», «contar» y el botón de Filtros que suman la capa; la lista con los negociados primero; el pin y el
//      grupo en rojo, la ciruela que no es la de Ajustar, el número que no es blanco; el chip, el interruptor y la marca de la
//      tasa en rojo; la barra sin la cuenta aparte.
//   §4 N26-N30: la noche que calcula los Buscar otro (o no calcula los Ajustar: el espía tiene que leer), el SQL sin el filtro
//      de Ajustar, la capa que no deja fuera a los que convienen o ignora el tope.
//   §5 N31-N45: la portada sin la línea, sin el publicado o sin el descuento; el informe que no le pasa el precio; el piso
//      desactivado con un `if (false)`, sin cortar, más ancho que el tope o que acepta el publicado; el informe al precio
//      publicado o sin los dos precios; `analisis_creado` sin la marca o sin recibirla; el navegador sin mandar el precio; el
//      pop-up y la tarjeta del negociado sin su Comprar o sin «Analizar a UF».
//   §6 N46-N51: «Usar la del mes» que fija la del mes, el paso de 0,01, soltar sin avisar o medido con otro evento, sin la marca,
//      Filtros sin decir que no hay capa con otra tasa.
//   §7 N52-N54 · §8 N55-N56 · §9 N57-N61: el perfil sin resumen, sin plazo o sin tooltip; el chip sin medir o sin el tope; la capa
//      con cualquier tasa, el precio negociado viajando sin cuenta, la tarjeta y el mapa sin cuenta con cifras, la ruta abierta
//      sin quitarlas.
//   §1 N62-N66 (el mismo día, después del rebase): la barra sin ninguno, la lista vacía y el tooltip de la tasa sin «al precio
//      publicado» (los tres se habían escapado: el §1 nombraba superficies y estas no estaban), un texto nuevo con «convienen»
//      en el copy, y una excepción que ya no existe.
//   §3 N67-N71 (el mismo día, QA de los pines en el preview: en el teléfono los grupos ciruela quedaban debajo de los rojos):
//      el satélite que no corre nada, el que corre al que ningún rojo tapa, el que no gira ante otro rojo, el grupo de la capa
//      sin satélite en el mapa y el ancla del ícono sin el corrimiento.
//   §10 N72-N78 (decisión de Fabrizio tras el QA: en 11 de 40 el informe a UF X caía a Ajustar): la verificación que siempre
//      sigue, el precio movido tomado de la sonda sin el informe, la ruta sin verificar, el movido que no corta (cobraría), el
//      informe con otra mediana que la verificada, el cliente que no atiende el precio movido y el pop-up sin su aviso.
// Dos trampas del instrumento, cazadas antes de mutar: `[^>]*` se corta en el «=>» de un onChange (el slider no se leía) y
// `cuerpo()` solo corta en declaraciones de primer nivel (el de «contar» se tragaba «contarNegociados»). Y un `{}` como
// candidato no prueba que la noche no calcula: `negociarCandidato` corta solo si no hay arriendo; por eso el espía (Proxy).
// ─────────────────────────────────────────────────────────────────────────────
