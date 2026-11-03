// ============================================================================
// TIER EXPLORAR-PASADA — los ajustes de la pasada real de Fabrizio por /explorar del 03-nov-2026, en el teléfono y en el PC.
//
//   1 · LA HOJA ABRE DIRECTO: «¿Cómo se calcula?» es UN botón, visible en el teléfono y en el PC, que abre la hoja sin tooltip
//       intermedio (el tooltip de la ⓘ se retiró); en el teléfono, redondo, en tinta con la ⓘ en blanco y más grande que un chip.
//   2 · EL TEXTO DE LA HOJA: el perfil estándar en tres viñetas con los números del motor, «Filtros» en negrita (sin cuenta,
//       «registrándote gratis»), los dos chips de la casa y el enlace en negrita a la metodología. Ni la nota de 70 ni las señales
//       graves: viven en la metodología.
//   3 · DE ENTRADA, LAS DOS CLASES: los ✓ Comprar y los − Ajustar que llegan con hasta 10 %, en el mismo pedido del mapa, con y sin
//       cuenta; «Ver solo ✓ Comprar» las deja en una (y se mide al prenderlo, con el tope). «Convienen» sigue siendo solo ✓ Comprar.
//       En Filtros, «Descuento máximo para − Ajustar» con 5 % y 10 %, y el botón con las dos cuentas y sus chips.
//   4 · EL DESGLOSE DE LA BARRA SUMA: «10.040 deptos» = «6.802 ✓ Comprar…» + «3.238 − Ajustar…», en el teléfono y en el PC (la
//       píldora negra del PC se retiró), con «Ver lista» a la derecha y sin coma después del chip − Ajustar.
//   5 · NINGÚN PIN USA EL ROJO: ✓ Comprar en el azul del chip, − Ajustar en su ciruela, los analizados en tinta con ✓, el elegido
//       más grande con anillo blanco; en el mapa de Explorar, el del dashboard y «Estás dentro» (claro y oscuro), el número de las
//       tarjetas, el mapa chico de la tarjeta y de la vista previa. Y la etiqueta con zoom «−4,2 % dcto.».
//   6 · EL TOOLTIP QUEDA DENTRO DE LA PANTALLA: con su ⓘ en cualquier esquina, a 320, 390 y 1440, se corre o cambia de lado.
//   7 · EL DASHBOARD EN DOS COLUMNAS en el PC (y «Estás dentro»): el mapa a la izquierda, fijo, y su imagen pedida al tamaño que
//       ocupa.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. §3 cuenta las dos clases contra la base (dos lecturas); lo
// demás, 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-pasada-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import * as po from "../../../src/lib/explorar/portal";
import * as cn from "../../../src/lib/explorar/capa-negociar";
import * as cp from "../../../src/lib/explorar/colores-pin";
import { iconoPin, type FormaPin } from "../../../src/lib/explorar/iconos-pin";
import { colocarTooltip, MARGEN_TOOLTIP } from "../../../src/lib/explorar/tooltip";
import { claseDeImagen, rutaImagenCalle, urlMapaChico } from "../../../src/lib/explorar/calle";
import { clasePinDeItem, MAPA_CASA, MAPA_CASA_PC, MAPA_DENTRO_PC } from "../../../src/lib/casa/mapa-casa";
import { CSS_CHIP_VEREDICTO } from "../../../src/components/analysis/shared/ChipVeredicto";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "../../../src/lib/deptos/estandar";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
/** El texto que se lee: los bloques separan con un espacio y los elementos en línea (chips, negritas, enlaces) no. */
const textoPlano = (html: string) => html.replace(/<\/?(?:p|li|ul|ol|h1|h2|h3|div|section|button|br)\b[^>]*>/g, " ").replace(/<[^>]+>/g, "").replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e).replace(/\s+/g, " ").trim();
/** El cuerpo de una función: de su firma a la siguiente declaración con su misma sangría o menos (la de primer nivel, o la
 *  siguiente del mismo componente). "" si no está. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const sangria = i - (src.lastIndexOf("\n", i) + 1);
  const resto = src.slice(i + firma.length);
  const j = resto.search(new RegExp(`\\n {0,${sangria}}(?:export |async function |function |const [A-Za-z]+ = |let [A-Za-z]+ = )`));
  return src.slice(i, j < 0 ? undefined : i + firma.length + j);
}
/** Un elemento JSX desde el `<` que lo abre en `ini` hasta su cierre del mismo nombre, contando anidados. */
function elementoDesde(src: string, ini: number): string {
  if (ini < 0) return "";
  const nombre = src.slice(ini + 1).match(/^[A-Za-z]+/)?.[0];
  if (!nombre) return "";
  const re = new RegExp(`<${nombre}\\b|</${nombre}>`, "g");
  re.lastIndex = ini;
  let prof = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0].startsWith("</")) { prof--; if (prof === 0) return src.slice(ini, m.index + m[0].length); }
    else {
      // La etiqueta que abre termina en el primer «>» que no es de una flecha ni está entre llaves.
      let k = m.index, llaves = 0;
      for (; k < src.length; k++) { const c = src[k]; if (c === "{") llaves++; else if (c === "}") llaves--; else if (c === ">" && llaves === 0 && src[k - 1] !== "=") break; }
      if (src[k - 1] !== "/") prof++;
      // Una etiqueta que se cierra sola (`<MapaExplorar … />`) es el elemento entero.
      else if (prof === 0) return src.slice(ini, k + 1);
    }
  }
  return "";
}
const elemento = (src: string, marca: string) => { const k = src.indexOf(`data-explorar="${marca}"`); return k < 0 ? "" : elementoDesde(src, src.lastIndexOf("<", k)); };
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}

// ── CSS: las reglas, con su @media ──
type Regla = { sel: string[]; decl: string; medio: string | null };
function reglasCss(css0: string): Regla[] {
  const css = css0.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Regla[] = [];
  const planas = (txt: string, medio: string | null) => { for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: m[1].split(",").map((s) => s.trim()).filter(Boolean), decl: m[2], medio }); };
  let resto = "";
  let i = 0;
  while (i < css.length) {
    const k = css.indexOf("@media", i);
    if (k < 0) { resto += css.slice(i); break; }
    resto += css.slice(i, k);
    const abre = css.indexOf("{", k);
    let prof = 1, j = abre + 1;
    for (; j < css.length && prof > 0; j++) { if (css[j] === "{") prof++; else if (css[j] === "}") prof--; }
    planas(css.slice(abre + 1, j - 1), css.slice(k + 6, abre).trim());
    i = j;
  }
  planas(resto, null);
  return out;
}
const decl = (d: string, prop: string) => d.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`))?.[1]?.trim() ?? null;

// ── el rojo ──
const ROJOS = new Set(["#C8323C", "#F0858C", "#3E1E21", "#5C2B30", "#F7DEDF", "#EDBFC2", "#7A1F27"]);
const hexes = (s: string) => Array.from(s.matchAll(/#[0-9A-Fa-f]{6}\b/g), (m) => m[0].toUpperCase());
/** Un color rojo: uno de los de la casa, o de tono rojo (±18° de 0) y saturado. */
function esRojo(hex: string): boolean {
  const h = hex.toUpperCase();
  if (ROJOS.has(h)) return true;
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.25 || max !== r) return false;
  const tono = (((g - b) / d) * 60 + 360) % 360;
  return tono <= 18 || tono >= 342;
}
const PALABRAS_ROJAS = /signal-red|--verdict-buscar|--chip-v-b|\bROJO\b|C8323C/i;

const NADA = () => {};
const PIN = { avisoId: "c1", comuna: "Ñuñoa", lat: -33.45, lng: -70.6, m2: 58, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4290, veredicto: "COMPRAR", score: 84, flujo: 64000, arriendo: 720000, condicion: "usado" as const, alta: null };
const NEG = (id: string, d: number) => ({ ...PIN, avisoId: id, precioUF: 3080, veredicto: "AJUSTA SUPUESTOS", score: 58, flujo: -40000, neg: { d, p: Math.floor(3080 * (1 - d / 100)), s: 71, f: 12000 } }) as cn.PinNegociado;

export async function runExplorarPasadaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-PASADA (la pasada real del 03-nov: la hoja abre directo y dice lo pedido, las dos clases de entrada y «solo Comprar», el desglose que suma, ningún pin rojo, el tooltip dentro de la pantalla, el dashboard en dos columnas · 0 tokens + 2 lecturas) ───");

  const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
  const css = leer("src/app/explorar/explorar.css");
  const reglas = reglasCss(css);
  const modHoja = cargar<{ HojaCalculo: FC<Record<string, unknown>> }>("src/app/explorar/hoja-calculo", F);
  const modDes = cargar<{ BarraAbajo: FC<Record<string, unknown>>; LineasDesglose: FC<Record<string, unknown>> }>("src/app/explorar/desglose", F);
  const modBien = cargar<{ Bienvenida: FC<Record<string, unknown>> }>("src/app/explorar/bienvenida", F);
  const modFil = cargar<{ HojaFiltros: FC<Record<string, unknown>> }>("src/app/explorar/hoja-filtros", F);
  const modLis = cargar<{ ListaPortal: FC<Record<string, unknown>> }>("src/app/explorar/lista-portal", F);
  const modCasa = cargar<{ MapaCasa: FC<Record<string, unknown>>; PinTarjeta: FC<Record<string, unknown>> }>("src/app/dashboard/mapa-casa", F);
  const modCache = cargar<{ respuestaDeLaNoche: (pie: number, plazo: number, o?: { sinCifras?: boolean }, leer?: unknown) => Promise<{ universo: po.UniversoCompacto; negociados?: cn.NegociadosCompactos }> }>("src/lib/explorar/portal-cache", F);

  // ══ §1 · LA HOJA ABRE DIRECTO ══════════════════════════════════════════════
  {
    if ("tooltip" in po.COMO_SE_CALCULA) F("1 · el tooltip de «¿Cómo se calcula?» sigue en el copy");
    if (/alTocarTooltip/.test(codigo("src/app/explorar/info.tsx"))) F("1 · la ⓘ todavía sabe abrir algo al tocar su tooltip");
    if ((cliente.match(/data-explorar="como-se-calcula"/g) ?? []).length !== 1) F("1 · «¿Cómo se calcula?» no es UN botón (el del PC y el del teléfono tienen que ser el mismo)");
    const boton = elemento(cliente, "como-se-calcula");
    if (!/^<button\b/.test(boton) || !/onClick=\{abrirCalculo\}/.test(boton)) F("1 · el botón de «¿Cómo se calcula?» no llama a abrirCalculo al tocarlo");
    if (!/className="ex-como-i"/.test(boton) || !/className="ex-como-t ex-como-t-pc"/.test(boton) || !/COMO_SE_CALCULA\.enlaceCorto/.test(boton)) F("1 · el botón no trae la ⓘ redonda y los dos textos (PC y teléfono)");
    if (!/setCalculo\(true\)/.test(cuerpo(cliente, "const abrirCalculo = () =>"))) F("1 · abrirCalculo no abre la hoja");
    if (!/\{calculo && <HojaCalculo\b/.test(cliente)) F("1 · la hoja no se monta con `calculo`");
    const barraIni = cliente.indexOf('className="ex-barra"');
    const barra = elementoDesde(cliente, cliente.lastIndexOf("<", barraIni));
    if (!barra) F("1 · no encuentro la barra de arriba");
    else if (/<Info\b|role="tooltip"/.test(barra)) F("1 · la barra todavía tiene una ⓘ con tooltip");
    // Visible en los dos: ninguna regla esconde el botón; en el teléfono, la ⓘ es redonda, en tinta y más grande que un chip.
    if (reglas.some((r) => r.sel.includes(".ex-como") && /display\s*:\s*none/.test(r.decl))) F("1 · una regla esconde «¿Cómo se calcula?» (en el teléfono o en el PC)");
    const movil = reglas.filter((r) => r.medio === "(max-width: 767px)");
    const redonda = movil.find((r) => r.sel.includes(".ex-como-i"));
    const altoChip = Number((decl(reglas.find((r) => r.medio == null && r.sel.includes(".ex-chip-neg"))?.decl ?? "", "height") ?? "").replace("px", ""));
    const lado = Number((decl(redonda?.decl ?? "", "width") ?? "").replace("px", ""));
    if (!redonda || decl(redonda.decl, "background") !== "var(--franco-text)" || decl(redonda.decl, "color") !== "var(--franco-card)" || !/999px|50%/.test(decl(redonda.decl, "border-radius") ?? "")) F("1 · en el teléfono la ⓘ no es un botón redondo en tinta con la letra en blanco");
    if (!(lado > altoChip && altoChip > 0)) F(`1 · en el teléfono la ⓘ (${lado} px) no es más grande que un chip (${altoChip} px)`);
    if (!movil.some((r) => r.sel.includes(".ex-como-t-pc") && /display\s*:\s*none/.test(r.decl))) F("1 · en el teléfono se ve el texto largo del PC");
    if (!reglas.some((r) => r.medio == null && r.sel.includes(".ex-como-i") && /display\s*:\s*none/.test(r.decl))) F("1 · en el PC se ve la ⓘ redonda del teléfono");
    // «Al lado si cabe»: se mide y, si no cabe, sale de la fila sin verse (nunca cortado).
    if (!/setComoCabe\(texto > 0 && libre - usado >= texto \+ gapComo\)/.test(cliente) || !/data-como-cabe=\{comoCabe \? "1" : undefined\}/.test(cliente)) F("1 · «Cómo se calcula» al lado de la ⓘ no se mide");
    if (!movil.some((r) => r.sel.some((s) => /:not\(\[data-como-cabe="1"\]\) \.ex-como-t-movil/.test(s)) && /visibility\s*:\s*hidden/.test(r.decl))) F("1 · sin espacio, el texto del teléfono no se esconde");
  }

  // ══ §2 · EL TEXTO DE LA HOJA ═══════════════════════════════════════════════
  if (modHoja) {
    const hoja = (sinCuenta: boolean, tasa: number | null = 4.07) => dibujar(createElement(modHoja.HojaCalculo, { tasa: tasa != null ? { tasa } : null, sinCuenta, alCerrar: NADA }));
    const base = (cambiar: string) => [
      "¿Cómo se calcula?",
      "Cada noche Franco revisa todos los deptos en venta de Santiago y calcula cuáles convienen al precio publicado, con un perfil de búsqueda estándar:",
      `pie de ${PIE_POR_DEFECTO} %`, `crédito a ${PLAZO_POR_DEFECTO} años`, "tasa de 4,07 %, el promedio mensual de los créditos hipotecarios según el Banco Central",
      cambiar,
      "En el mapa, los deptos que convienen al precio publicado llevan ✓ Comprar. Los que convienen solo con un descuento llevan − Ajustar, y su tarjeta te dice a qué precio.",
      "Cómo decide Franco: ver la metodología",
      "Entendido",
    ].join(" ");
    const con = hoja(false), sin = hoja(true);
    if (textoPlano(con) !== base("Puedes cambiar ese perfil en Filtros.")) F(`2 · la hoja con cuenta dice «${textoPlano(con)}»`);
    if (textoPlano(sin) !== base("Puedes cambiar ese perfil en Filtros, registrándote gratis.")) F(`2 · la hoja sin cuenta dice «${textoPlano(sin)}»`);
    for (const [h, quien] of [[con, "con"], [sin, "sin"]] as const) {
      if ((h.match(/<li\b/g) ?? []).length !== 3) F(`2 · (${quien} cuenta) el perfil no va en tres viñetas`);
      if (!/<strong>Filtros<\/strong>/.test(h)) F(`2 · (${quien} cuenta) «Filtros» no va en negrita`);
      if (!/<a [^>]*href="\/metodologia"[^>]*><strong>ver la metodología<\/strong><\/a>/.test(h)) F(`2 · (${quien} cuenta) el enlace a la metodología no va en negrita o no lleva a /metodologia`);
      if (!/<span class="chip-v c"[^>]*data-veredicto="COMPRAR"/.test(h) || !/<span class="chip-v a"[^>]*data-veredicto="AJUSTA SUPUESTOS"/.test(h)) F(`2 · (${quien} cuenta) los chips no son los de la casa`);
      if (/\b70\b|señales graves|1 a 100/i.test(textoPlano(h))) F(`2 · (${quien} cuenta) la hoja todavía habla de la nota de 70 o de las señales graves`);
    }
    // Los números del motor: la tasa que llega, nunca escrita a mano.
    if (!textoPlano(hoja(false, 5.12)).includes("tasa de 5,12 %, el promedio mensual")) F("2 · la tasa de la hoja no es la del motor");
    if (!existe("src/app/metodologia/page.tsx")) F("2 · no existe la página de metodología a la que lleva la hoja");
  }

  // ══ §3 · DE ENTRADA, LAS DOS CLASES; «SOLO COMPRAR» LAS DEJA EN UNA ══════════
  {
    const g = po.FILTROS_GLOBALES;
    if (g.negociar !== 10 || g.soloComprar !== false) F(`3 · la vista de entrada no trae el descuento máximo de 10 % con «solo Comprar» apagado (${g.negociar}, ${g.soloComprar})`);
    const deUrl = (q: string) => po.portalDeUrl(new URLSearchParams(q)).filtros;
    if (deUrl("").negociar !== 10 || deUrl("").soloComprar) F("3 · /explorar sin nada en la URL no abre con las dos clases");
    if (po.urlDePortal(g) !== "") F(`3 · la vista de entrada deja algo en la URL: «${po.urlDePortal(g)}»`);
    const solo = { ...g, soloComprar: true };
    if (!/(^|&)solo=1(&|$)/.test(po.urlDePortal(solo)) || !deUrl(po.urlDePortal(solo)).soloComprar) F("3 · el parámetro de la URL no dice si está «solo Comprar»");
    if (deUrl("n=5").negociar !== 5 || po.urlDePortal({ ...g, negociar: 5 }) !== "n=5" || deUrl("n=10").negociar !== 10 || deUrl("n=7").negociar !== 10) F("3 · el descuento máximo no va y vuelve de la URL (5, 10 por defecto)");
    const negs = [NEG("n1", 4.2), NEG("n2", 8), NEG("n3", 3)];
    const ids = (xs: cn.PinNegociado[]) => xs.map((p) => p.avisoId).sort().join();
    const comprar = new Set(["n3"]);
    if (ids(cn.negociadosVisibles(negs, g, comprar)) !== "n1,n2") F(`3 · de entrada no se ven los − Ajustar hasta 10 % (sin los que ya son ✓ Comprar): ${ids(cn.negociadosVisibles(negs, g, comprar))}`);
    if (cn.negociadosVisibles(negs, solo, comprar).length !== 0) F("3 · «Ver solo ✓ Comprar» no deja solo los ✓ Comprar");
    if (ids(cn.negociadosVisibles(negs, { ...g, negociar: 5 }, comprar)) !== "n1") F("3 · el descuento máximo de 5 % no deja fuera a los que necesitan más");
    if (cn.negociadosVisibles(negs, { ...g, plazo: 25 }, comprar).length !== 0) F("3 · la capa se ve con un plazo que la noche no calcula");
    // EL MISMO PEDIDO: el armado de la respuesta de la noche, con lecturas de mentira.
    if (modCache) {
      const U: po.UniversoCompacto = po.compactar([PIN, { ...PIN, avisoId: "c2" }]);
      const N: cn.NegociadosCompactos = cn.compactarNegociados(negs);
      let pidioCapa = 0;
      const leerOk = { universo: async () => U, capa: async () => { pidioCapa++; return N; } };
      const r1 = await modCache.respuestaDeLaNoche(20, 30, {}, leerOk);
      if (r1.universo.filas.length !== 2 || r1.negociados?.filas.length !== 3) F("3 · el pedido de la noche no trae los − Ajustar con el universo");
      const r2 = await modCache.respuestaDeLaNoche(20, 30, { sinCifras: true }, leerOk);
      if (!r2.negociados || r2.negociados.filas.some((f) => f[14] != null || f[16] != null || f[9] != null) || r2.universo.filas.some((f) => f[9] != null)) F("3 · sin cuenta, el pedido de la noche manda cifras de los − Ajustar o del universo");
      pidioCapa = 0;
      const r3 = await modCache.respuestaDeLaNoche(20, 25, {}, leerOk);
      if (r3.negociados || pidioCapa !== 0) F("3 · a 25 años (sin capa) el pedido igual trae o lee los − Ajustar");
      const r4 = await modCache.respuestaDeLaNoche(20, 30, {}, { universo: async () => U, capa: async () => { throw new Error("x"); } }).catch(() => null);
      if (!r4 || r4.negociados || r4.universo.filas.length !== 2) F("3 · si la capa falla, el pedido de la noche se cae o la inventa");
      // «Convienen» no cuenta a los − Ajustar.
      if (po.cuantosConvienen(r1.universo) !== 2) F("3 · «convienen» cuenta algo más que los ✓ Comprar");
    }
    if (!/return NextResponse\.json\(await respuestaDeLaNoche\(pie, plazo\)/.test(codigo("src/app/api/explorar/route.ts"))) F("3 · /api/explorar no manda la capa en el pedido de la noche");
    if (!/return NextResponse\.json\(await respuestaDeLaNoche\(PIE_ABIERTO, PLAZO_ABIERTO, \{ sinCifras: true \}\)/.test(codigo("src/app/api/explorar/abierto/route.ts"))) F("3 · sin cuenta, el pedido de la noche no trae la capa sin cifras");
    if (/negociab|negociad/i.test(codigo("src/lib/explorar/convienen-guardado.ts"))) F("3 · el número guardado de «convienen» mira a los negociados");
    // El navegador: la capa sale del mismo pedido y un solo lugar decide qué se ve.
    const asegurar = cuerpo(cliente, "const asegurar = useCallback(");
    if (!/if \(conCapa && d\.negociados\) \{[\s\S]*?setNegociados\(/.test(asegurar)) F("3 · el navegador no toma la capa del pedido del universo");
    if (!/const capa = capaVisible\(filtros\);/.test(cliente) || !/negociadosVisibles\(negociadosDelPie, filtros, idsComprar\)/.test(cliente)) F("3 · el navegador no decide las dos clases con capaVisible y negociadosVisibles");
    if (!/negociados=\{visiblesNeg\}/.test(elementoDesde(cliente, cliente.indexOf("<MapaExplorar")))) F("3 · el mapa no recibe los − Ajustar");
    // El chip de la barra: el filtro «Ver solo ✓ Comprar», con el chip de la casa adentro; se mide al prenderlo, con el tope.
    const chip = elemento(cliente, "solo-comprar");
    if (!/aria-checked=\{filtros\.soloComprar\}/.test(chip) || !/onClick=\{alternarSoloComprar\}/.test(chip) || !/NEGOCIAR_COPY\.soloComprar\} <ChipVeredicto v="COMPRAR" \/>/.test(chip)) F("3 · el chip de la barra no es «Ver solo [✓ Comprar]» con su estado");
    if (cn.NEGOCIAR_COPY.soloComprar !== "Ver solo") F(`3 · el chip dice «${cn.NEGOCIAR_COPY.soloComprar}»`);
    const alt = cuerpo(cliente, "function alternarSoloComprar()");
    if (!/soloComprar: !filtros\.soloComprar/.test(alt) || !/if \(f\.soloComprar\) posthog\?\.capture\(EVENTO_SOLO_COMPRAR, propsSoloComprar\(filtros\.negociar,/.test(alt)) F("3 · «explorar_solo_comprar» no se mide al prender el filtro, con el tope");
    if (cn.EVENTO_SOLO_COMPRAR !== "explorar_solo_comprar" || cn.propsSoloComprar(10, 6802, 3238, false).tope !== 10) F("3 · el evento no se llama explorar_solo_comprar o no lleva el tope");
    // La bienvenida: el número de «convienen» y, aparte, los que llegan negociando.
    if (modBien) {
      const h = dibujar(createElement(modBien.Bienvenida, { n: 6802, negociados: 3238, alCerrar: NADA }));
      const cifra = h.match(/data-explorar="bienvenida-n">([^<]*)</)?.[1];
      if (cifra !== "6.802" || !/data-explorar="bienvenida-negociados"[^>]*>y 3\.238 más si negocias el precio</.test(h) || /10\.040/.test(h)) F(`3 · la bienvenida no dice los que convienen y, aparte, «y 3.238 más si negocias el precio» (${cifra})`);
    }
    if (!/<Bienvenida n=\{inicial\.convienen \?\? inicial\.n \?\? total\} negociados=\{inicial\.negociadosGlobal\}/.test(cliente)) F("3 · la bienvenida no recibe los negociados de la vista global");
    // El número de «convienen» de la bienvenida lo cuenta la página sobre el universo de los ✓ Comprar, sin sumar la capa.
    const abierta = cuerpo(codigo("src/app/explorar/page.tsx"), "async function ExplorarAbierto(");
    if (!/const convienen = cuantosConvienen\(noche\);/.test(abierta) || /\bconvienen\s*(?:=|:)[^,;}]*negociad/i.test(abierta)) F("3 · la página suma los negociados al número de «convienen»");
    // Filtros: «Descuento máximo para − Ajustar» con 5 % y 10 %, y el botón con las dos cuentas y sus chips.
    if (modFil) {
      const fil = (contarNegociados: () => number) => dibujar(createElement(modFil.HojaFiltros, { filtros: g, tasa: { tasa: 4.07 }, miBusqueda: null, contar: () => 6802, contarNegociados, asegurar: NADA, alAplicar: NADA, alCerrar: NADA, alPedirRegistro: null }));
      const h = fil(() => 3238);
      const grupo = h.match(/<section[^>]*data-explorar="bloque-negociar"[\s\S]*?<\/section>/)?.[0] ?? "";
      if (!textoPlano(grupo).startsWith("Descuento máximo para − Ajustar")) F(`3 · el grupo de Filtros no se llama «Descuento máximo para − Ajustar»: «${textoPlano(grupo).slice(0, 50)}»`);
      if (/type="checkbox"/.test(grupo)) F("3 · el grupo de Filtros todavía tiene un interruptor");
      const radios = Array.from(grupo.matchAll(/<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>([^<]*)<\/button>/g), (m) => `${m[2]}:${m[1]}`).join("|");
      if (radios !== "5 %:false|10 %:true") F(`3 · los topes de Filtros no son 5 % y 10 % con 10 % de entrada: ${radios}`);
      const ver = textoPlano(h.match(/<button[^>]*data-explorar="ver-n"[\s\S]*?<\/button>/)?.[0] ?? "");
      if (ver !== "Ver 6.802 ✓ Comprar + 3.238 − Ajustar") F(`3 · el botón de Filtros dice «${ver}»`);
      const ver0 = textoPlano(fil(() => 0).match(/<button[^>]*data-explorar="ver-n"[\s\S]*?<\/button>/)?.[0] ?? "");
      if (ver0 !== "Ver 6.802 ✓ Comprar") F(`3 · sin − Ajustar el botón de Filtros dice «${ver0}»`);
    }
    // CON DATOS DE HOY (dos lecturas): de entrada hay de las dos clases.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("sin las llaves de Supabase");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const ps = await import("../../../src/lib/explorar/portal-servidor");
      const [u, n] = await Promise.all([ps.universoDeLaNoche(admin, g.pie, g.plazo), ps.negociablesDeLaNoche(admin, g.pie)]);
      const ajustar = cn.negociadosVisibles(n, g, new Set(u.map((p) => p.avisoId))).length;
      console.log(`  · hoy, de entrada: ${u.length.toLocaleString("es-CL")} ✓ Comprar y ${ajustar.toLocaleString("es-CL")} − Ajustar hasta 10 %`);
      if (u.length === 0 || ajustar === 0) F(`3 · con los datos de hoy, de entrada falta una clase (${u.length} ✓ Comprar, ${ajustar} − Ajustar)`);
    } catch (e) {
      F(`3 · no se pudo contar las dos clases con los datos de hoy (no corrió): ${(e as Error).message}`);
    }
  }

  // ══ §4 · EL DESGLOSE DE LA BARRA SUMA ══════════════════════════════════════
  {
    for (const c of [0, 1, 7, 6802]) for (const a of [0, 1, 3238]) {
      const d = po.desgloseBarra(c, a, 10);
      const suma = (d.comprar?.n ?? 0) + (d.ajustar?.n ?? 0);
      if (d.total !== c + a || suma !== d.total) F(`4 · el desglose de ${c} + ${a} no suma (${d.total}, líneas ${suma})`);
      if (!!d.comprar !== c > 0 || !!d.ajustar !== a > 0) F(`4 · el desglose de ${c} + ${a} muestra una línea vacía o esconde una con deptos`);
      if (d.total > 0 && d.titulo !== po.deptosN(d.total)) F(`4 · el título del desglose de ${c} + ${a} es «${d.titulo}»`);
    }
    if (modDes) {
      const h = dibujar(createElement(modDes.BarraAbajo, { desglose: po.desgloseBarra(6802, 3238, 10), calculando: null, alVerLista: NADA }));
      // Cada línea: desde su marca hasta donde empieza la siguiente (otra línea, «Ver lista» o el fin de la barra).
      const linea = (m: string) => {
        const i = h.indexOf(`data-explorar="${m}"`);
        if (i < 0) return "";
        const ini = h.lastIndexOf("<", i);
        const fin = [h.indexOf('<span class="ex-hoja-linea"', i), h.indexOf('<span class="ex-hoja-ver"', i)].filter((x) => x > 0);
        return textoPlano(h.slice(ini, fin.length ? Math.min(...fin) : undefined));
      };
      const nDe = (m: string) => Number(h.match(new RegExp(`data-explorar="${m}"[^>]*data-n="(\\d+)"`))?.[1] ?? NaN);
      if (linea("titulo-hoja") !== "10.040 deptos") F(`4 · la barra dice «${linea("titulo-hoja")}»`);
      const lc = linea("linea-comprar");
      const la = linea("linea-ajustar");
      if (lc !== "6.802 ✓ Comprar al precio publicado") F(`4 · la línea de los ✓ Comprar dice «${lc}»`);
      // Sin coma después del chip (decisión de Fabrizio, 03-nov-2026, mirando la barra a 390).
      if (la !== "3.238 − Ajustar requieren negociar el precio") F(`4 · la línea de los − Ajustar dice «${la}»`);
      if (nDe("titulo-hoja") !== nDe("linea-comprar") + nDe("linea-ajustar")) F(`4 · la barra dibujada no suma: ${nDe("titulo-hoja")} ≠ ${nDe("linea-comprar")} + ${nDe("linea-ajustar")}`);
      if (!/<span class="ex-hoja-ver" data-explorar="ver-lista">Ver lista<\/span><\/button>$/.test(h)) F("4 · «Ver lista» no va a la derecha de la barra");
      if (/<span class="chip-v a"[^>]*>[^<]*<\/span>(?:<\/span>)?,/.test(h)) F("4 · la barra pone una coma después del chip − Ajustar");
    }
    // El navegador: la barra es el desglose de los que se ven, en los dos tamaños; la píldora negra se retiró.
    if (!/<BarraAbajo desglose=\{desglose\}/.test(cliente)) F("4 · la barra de abajo no es el desglose");
    if (!/desgloseBarra\(total, nAjustar, capa \? filtros\.negociar : null\)/.test(cliente) || !/const nAjustar = !capa \? 0 : negociadosDelPie \? visiblesNeg\.length :/.test(cliente) || !/const total = universo \? visibles\.length :/.test(cliente)) F("4 · el desglose no cuenta lo que se ve en el mapa");
    if (/ex-pildora/.test(cliente) || reglas.some((r) => r.sel.some((s) => /\.ex-pildora/.test(s)))) F("4 · la píldora negra del PC sigue");
    if (reglas.some((r) => r.sel.includes(".ex-hoja") && /display\s*:\s*none/.test(r.decl))) F("4 · una regla esconde la barra de abajo (en el PC o en el teléfono)");
    const ver = reglas.find((r) => r.medio == null && r.sel.includes(".ex-hoja-ver"));
    if (!ver || !/underline/.test(decl(ver.decl, "text-decoration") ?? "")) F("4 · «Ver lista» no va subrayado");
    // «Ver lista» a la derecha del total, en su misma fila, en el teléfono y en el PC: lo pone la grilla de la barra.
    const fila = (medio: string | null, sel: string) => { let c: string | null = null, f: string | null = null; for (const r of reglas) if (r.medio === medio && r.sel.includes(sel)) { c = decl(r.decl, "grid-column") ?? c; f = decl(r.decl, "grid-row") ?? f; } return { c, f }; };
    const grilla = reglas.find((r) => r.medio == null && r.sel.includes(".ex-hoja"));
    const [vM, tM, vD, tD] = [fila(null, ".ex-hoja .ex-hoja-ver"), fila(null, ".ex-hoja .ex-hoja-t"), fila("(min-width: 768px)", ".ex-hoja .ex-hoja-ver"), fila("(min-width: 768px)", ".ex-hoja .ex-hoja-t")];
    if (decl(grilla?.decl ?? "", "display") !== "grid" || vM.c !== "2" || tM.c !== "1" || !vM.f || vM.f !== tM.f || (vD.f ?? vM.f) !== (tD.f ?? tM.f)) F(`4 · «Ver lista» no va a la derecha del total, en su fila (${JSON.stringify({ vM, tM, vD, tD })})`);
    if (!/<LineasDesglose desglose=\{desglose\}/.test(codigo("src/app/explorar/lista-portal.tsx"))) F("4 · la cabecera de la lista no dice el mismo desglose");
  }

  // ══ §5 · NINGÚN PIN USA EL ROJO ════════════════════════════════════════════
  {
    // Los colores son los del chip de la casa.
    const chip = CSS_CHIP_VEREDICTO;
    const claroC = chip.match(/\[data-theme="light"\] \.chip-v\.c\{background:(#[0-9A-F]{6})/i)?.[1]?.toUpperCase();
    const oscuroC = chip.match(/\n\s*\.chip-v\.c\{background:(#[0-9A-F]{6})/i)?.[1]?.toUpperCase();
    const claroA = chip.match(/\[data-theme="light"\]\{--chip-v-c:#[0-9A-F]{6};--chip-v-a:(#[0-9A-F]{6})/i)?.[1]?.toUpperCase();
    const oscuroA = chip.match(/:root\{--chip-v-c:#[0-9A-F]{6};--chip-v-a:(#[0-9A-F]{6})/i)?.[1]?.toUpperCase();
    const C = cp.COLORES_PIN;
    if (!claroC || C.claro.comprar.fondo.toUpperCase() !== claroC || C.oscuro.comprar.fondo.toUpperCase() !== oscuroC) F(`5 · el pin ✓ Comprar no es el azul del chip (${C.claro.comprar.fondo}/${C.oscuro.comprar.fondo} contra ${claroC}/${oscuroC})`);
    if (!claroA || C.claro.ajustar.fondo.toUpperCase() !== claroA || C.oscuro.ajustar.fondo.toUpperCase() !== oscuroA) F(`5 · el pin − Ajustar no es la ciruela del chip (${C.claro.ajustar.fondo}/${C.oscuro.ajustar.fondo} contra ${claroA}/${oscuroA})`);
    for (const t of ["claro", "oscuro"] as const) if (C[t].analizado.fondo.toUpperCase() !== "#0F0F0F" || C[t].analizado.texto.toUpperCase() !== "#FFFFFF") F(`5 · (${t}) el ya analizado no va en tinta con el ✓ blanco`);
    for (const t of ["claro", "oscuro"] as const) for (const k of ["comprar", "ajustar", "analizado"] as const) for (const v of [C[t][k].fondo, C[t][k].texto]) if (esRojo(v)) F(`5 · (${t}) el pin ${k} usa un rojo: ${v}`);
    if (cp.ANILLO_PIN.toUpperCase() !== "#FFFFFF" || !(cp.ANILLO_ELEGIDO_PX > cp.ANILLO_PIN_PX) || !(cp.ESCALA_ELEGIDO > 1)) F("5 · el elegido no es más grande con el anillo blanco más grueso");
    // Lo que se dibuja: cada ícono del mapa, en cada clase, tema, forma y elegido o no.
    const formas: FormaPin[] = [{ forma: "punto" }, { forma: "grupo", n: 1234 }, { forma: "etiqueta", texto: "−4,2 % dcto." }];
    for (const t of ["claro", "oscuro"] as const) for (const k of ["comprar", "ajustar", "analizado"] as const) for (const f of formas) for (const el of [false, true]) {
      if (f.forma === "grupo" && el) continue;
      const ic = iconoPin(k, t, f, el);
      const relleno = ic.svg.match(/<(?:circle|rect)[^>]*fill="(#[0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
      const anillo = ic.svg.match(/<(?:circle|rect)[^>]*stroke="(#[0-9A-Fa-f]{6})"[^>]*stroke-width="([\d.]+)"/);
      if (relleno !== C[t][k].fondo.toUpperCase()) F(`5 · (${t}) el ${f.forma} ${k}${el ? " elegido" : ""} se dibuja en ${relleno}`);
      if (anillo?.[1]?.toUpperCase() !== "#FFFFFF") F(`5 · (${t}) el ${f.forma} ${k} no lleva el anillo blanco`);
      if (el && Number(anillo?.[2]) !== cp.ANILLO_ELEGIDO_PX) F(`5 · (${t}) el ${f.forma} ${k} elegido no lleva el anillo grueso`);
      if (el && !(ic.w > iconoPin(k, t, f, false).w)) F(`5 · (${t}) el ${f.forma} ${k} elegido no es más grande`);
      if (f.forma !== "punto" && !new RegExp(`<text[^>]*fill="${C[t][k].texto}"`, "i").test(ic.svg)) F(`5 · (${t}) el ${f.forma} ${k} no lleva la letra de su clase`);
      if (f.forma === "punto" && k === "analizado" && !/<path[^>]*stroke="#FFFFFF"/i.test(ic.svg)) F(`5 · (${t}) el punto analizado no lleva el ✓ blanco`);
      for (const h of hexes(ic.svg)) if (esRojo(h)) F(`5 · (${t}) el ${f.forma} ${k} usa un rojo: ${h}`);
    }
    // El mapa de Explorar arma todo marcador con iconoPin, sin un color propio (salvo el fondo del mapa).
    const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
    const propios = hexes(mapa).filter((h) => !["#F6F6F7", "#1A1A1A"].includes(h));
    if (propios.length || PALABRAS_ROJAS.test(mapa) || /svgUrl|<circle|<rect/.test(mapa)) F(`5 · el mapa de Explorar dibuja pines con colores propios: ${propios.join(", ") || "(svg propio)"}`);
    for (const c of ['punto("comprar"', 'punto("ajustar"', 'grupo("ajustar"', 'etiqueta("ajustar"', 'grupo(gr.analizados === gr.n ? "analizado" : "comprar"', 'punto(an.has(id) ? "analizado" : "comprar")']) if (!mapa.includes(c)) F(`5 · el mapa de Explorar no dibuja ${c}…)`);
    if (!/const punto = \(c: ClasePin, elegido = false\) => iconoPin\(c, tema,/.test(mapa)) F("5 · el mapa de Explorar no saca sus íconos de iconoPin");
    // Los − Ajustar se dibujan solo en su clase: en su bucle (y en el elegido de su capa) no aparece otra.
    const bucleNeg = mapa.slice(mapa.indexOf("for (const gr of gruposNeg)"), mapa.indexOf("const e = sel ?"));
    const elegidoNeg = mapa.slice(mapa.indexOf("const en = sel && !e ?"), mapa.indexOf("encuadrarRef.current = () =>"));
    if (!bucleNeg || !elegidoNeg || /"comprar"|"analizado"/.test(bucleNeg + elegidoNeg) || (bucleNeg.match(/"ajustar"/g) ?? []).length < 4) F("5 · algún − Ajustar del mapa se dibuja con el color de otra clase");
    // La etiqueta con zoom de un − Ajustar.
    if (cn.NEGOCIAR_COPY.pin(4.2) !== "−4,2 % dcto.") F(`5 · la etiqueta de un − Ajustar dice «${cn.NEGOCIAR_COPY.pin(4.2)}»`);
    if (!/const texto = NEGOCIAR_COPY\.pin\(p\.neg\.d\);/.test(mapa)) F("5 · el mapa no usa la etiqueta del descuento");
    // El mapa chico (tarjeta, lista, pop-up y vista previa): el marcador de Static Maps.
    const pt = { lat: -33.4, lng: -70.6 };
    const marcador = (u: string) => u.match(/markers=color:(0x[0-9A-F]{6})/)?.[1];
    if (marcador(urlMapaChico(pt, "k")) !== "0x2B558F" || marcador(urlMapaChico(pt, "k", [], 100, cp.colorPin("ajustar", "oscuro").fondo)) !== "0xD8AECA") F("5 · el pin del mapa chico no es el de su clase");
    if (/0xC8323C/i.test(leer("src/lib/explorar/calle.ts"))) F("5 · el mapa chico todavía puede pedir el pin rojo");
    if (rutaImagenCalle("a1", true, true) !== "/api/explorar/calle/a1?tema=oscuro&v=a" || claseDeImagen("a") !== "ajustar" || claseDeImagen(null) !== "comprar") F("5 · la imagen de un − Ajustar no pide su color");
    if (!/const pin = colorPin\(claseDeImagen\(sp\.get\("v"\)\), tema === "dark" \? "oscuro" : "claro"\)\.fondo;/.test(codigo("src/app/api/explorar/calle/[avisoId]/route.ts"))) F("5 · la ruta de la imagen no pinta el pin con su clase");
    if (!/colorPin\(ajustar \? "ajustar" : "comprar", "claro"\)\.fondo/.test(codigo("src/app/api/og/depto/[avisoId]/route.tsx")) || !/imagenComoDato\(params\.avisoId\.toLowerCase\(\), tope != null\)/.test(codigo("src/app/api/og/depto/[avisoId]/route.tsx"))) F("5 · la vista previa del enlace no pinta el pin con su clase");
    for (const [archivo, marca] of [["src/app/explorar/tarjeta-pin.tsx", "ajustar={esNegociado(p)}"], ["src/app/explorar/lista-portal.tsx", "ajustar={negociado}"], ["src/components/guia/AvisoAntesDeAnalizar.tsx", "ajustar={!!negociado}"]] as const) if (!codigo(archivo).includes(marca)) F(`5 · ${archivo} no pide la imagen con la clase del depto`);
    // El dashboard y «Estás dentro» (el SVG sobre la imagen quieta) y el número de las tarjetas: CSS por clase y tema.
    for (const [archivo, sel, prop] of [["src/app/dashboard/casa.css", ".ca-mapa-pines", "fill"], ["src/app/deptos/deptos.css", ".sel-pin", "background"]] as const) {
      const rs = reglasCss(leer(archivo)).filter((r) => r.sel.some((s) => s.includes(sel)));
      for (const r of rs) if (PALABRAS_ROJAS.test(r.decl) || hexes(r.decl).some(esRojo)) F(`5 · ${archivo} pinta ${r.sel.join(", ")} de rojo`);
      const valor = (tema: "claro" | "oscuro", k: cp.ClasePin) => {
        const quiere = (s: string) => (tema === "claro" ? s.startsWith('[data-theme="light"]') : !s.startsWith("[data-theme")) && (k === "comprar" ? !/data-clase/.test(s) : s.includes(`[data-clase="${k}"]`)) && (sel === ".sel-pin" || /circle$/.test(s));
        let v: string | null = null;
        for (const r of rs) if (r.sel.some(quiere)) v = decl(r.decl, prop) ?? v;
        return v?.toUpperCase() ?? null;
      };
      for (const t of ["claro", "oscuro"] as const) for (const k of ["comprar", "ajustar", "analizado"] as const) {
        const v = valor(t, k);
        if (v !== C[t][k].fondo.toUpperCase()) F(`5 · ${archivo} (${t}) pinta el pin ${k} de ${v}`);
      }
    }
    if (modCasa) {
      const img = (n: number) => ({ ancho: 350, alto: 200, encuadre: { lat: -33.4, lng: -70.6, zoom: 13 }, url: null, urlOscuro: null, grises: [], seleccion: [{ n: 1, avisoId: "a", x: 10, y: 10, clase: "comprar" }, { n: 2, avisoId: "b", x: 20, y: 20, clase: "ajustar" }, { n: n, avisoId: "c", x: 30, y: 30, clase: "analizado" }] });
      const h = dibujar(createElement(modCasa.MapaCasa, { datos: { ...img(3), nSeleccion: 3, nConvienen: 0, nOtros: 0, desdePerfil: false, comunas: [] }, variante: "seleccion" }));
      const pines = Array.from(h.matchAll(/<g data-casa="pin" data-n="(\d+)" data-clase="(\w+)">([\s\S]*?)<\/g>/g), (m) => ({ n: m[1], clase: m[2], dentro: m[3] }));
      if (pines.map((p) => p.clase).join() !== "comprar,ajustar,analizado") F(`5 · el mapa de la selección no marca la clase de cada pin: ${pines.map((p) => p.clase).join()}`);
      const an = pines.find((p) => p.clase === "analizado");
      if (!an || !/class="ca-mapa-check"/.test(an.dentro) || /<text/.test(an.dentro)) F("5 · el pin ya analizado de la selección no lleva el ✓ en vez del número");
      if (/ca-mapa-rojo/.test(h)) F("5 · el mapa de la selección todavía dibuja «rojos»");
      const tj = (clase: string) => dibujar(createElement(modCasa.PinTarjeta, { n: 4, clase }));
      if (!/data-clase="analizado"[^>]*>✓</.test(tj("analizado")) || !/data-clase="ajustar"[^>]*>4</.test(tj("ajustar"))) F("5 · el número de la tarjeta no sigue la clase de su pin");
    }
    if (clasePinDeItem({ informeId: "x" }) !== "analizado" || clasePinDeItem({ tramo: "negociar" }) !== "ajustar" || clasePinDeItem({ veredicto: "AJUSTA SUPUESTOS" }) !== "ajustar" || clasePinDeItem({ avisoId: "q" }, { q: "i" }) !== "analizado" || clasePinDeItem({}) !== "comprar") F("5 · la clase de un depto de la selección no es la de su pin");
    if (!/clase: clasePinDeItem\(i, informes\)/.test(codigo("src/lib/guia/seleccion-pagina-servidor.ts")) || !/clase: clasePinDeItem\(i\)/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("5 · el dashboard o «Estás dentro» no le dan su clase a cada pin");
    for (const [archivo, marca] of [["src/app/semanal/semanal-lista.tsx", "<PinTarjeta n={n} clase={clasePinDeItem(it)} />"], ["src/app/semanal/semanal-lista.tsx", '<PinTarjeta n={n} clase="analizado" />'], ["src/components/deptos/PrimeraSeleccion.tsx", "<PinTarjeta n={i + 1} clase={clasePinDeItem(it)} />"]] as const) if (!codigo(archivo).includes(marca)) F(`5 · ${archivo} no dibuja el número de la tarjeta con su clase`);
  }

  // ══ §6 · EL TOOLTIP QUEDA DENTRO DE LA PANTALLA ═══════════════════════════
  {
    let casos = 0;
    // 250 de ancho: más angosta que el tooltip con sus márgenes (240 + 2 × 12): ahí tiene que achicarse.
    for (const vista of [{ ancho: 250, alto: 500 }, { ancho: 320, alto: 568 }, { ancho: 390, alto: 844 }, { ancho: 1440, alto: 900 }]) {
      // Con 300 px de alto (un tooltip largo en una pantalla baja) no cabe de ningún lado: igual tiene que quedar entero.
      for (const x of [2, 14, vista.ancho / 2 - 10, vista.ancho - 34, vista.ancho - 22]) for (const y of [4, 60, vista.alto / 2, vista.alto - 90, vista.alto - 24]) for (const alto of [44, 96, 160, 300]) {
        const b = { left: x, top: y, right: x + 20, bottom: y + 20 };
        const t = colocarTooltip(b, alto, vista);
        casos++;
        const m = MARGEN_TOOLTIP;
        if (t.left < m || t.left + t.ancho > vista.ancho - m) F(`6 · a ${vista.ancho} con la ⓘ en x=${x}, el tooltip se sale por un lado (${t.left}–${t.left + t.ancho})`);
        if (t.top < m || t.top + alto > vista.alto - m) F(`6 · a ${vista.ancho}×${vista.alto} con la ⓘ en y=${y}, el tooltip de ${alto} px se sale por arriba o por abajo (${t.top})`);
        if (t.ancho > vista.ancho - 2 * m) F(`6 · a ${vista.ancho} el tooltip es más ancho que la pantalla (${t.ancho})`);
        // Cambia de lado cuando abajo no cabe y arriba sí; y no tapa su ⓘ cuando cabe de algún lado.
        const cabeAbajo = b.bottom + 8 + alto <= vista.alto - m, cabeArriba = b.top - 8 - alto >= m;
        if (!cabeAbajo && cabeArriba && t.lado !== "arriba") F(`6 · a ${vista.ancho}×${vista.alto} con la ⓘ abajo (y=${y}) el tooltip no sube`);
        if ((cabeAbajo || cabeArriba) && t.top < b.bottom && t.top + alto > b.top) F(`6 · a ${vista.ancho}×${vista.alto} con la ⓘ en y=${y} el tooltip la tapa`);
      }
    }
    if (casos < 200) F(`6 · se probaron solo ${casos} posiciones`);
    // La ⓘ usa esa función con sus medidas, y el tooltip va sobre la página (portal, fijo), no dentro del panel que lo corta.
    const info = codigo("src/app/explorar/info.tsx");
    if (!/setLugar\(colocarTooltip\(\{ left: b\.left, top: b\.top, right: b\.right, bottom: b\.bottom \}, t\.offsetHeight, vista\)\)/.test(info) || !/t\.style\.width = `\$\{anchoTooltip\(vista\.ancho\)\}px`/.test(info)) F("6 · la ⓘ no coloca su tooltip con colocarTooltip y su alto real");
    if (!/createPortal\(\s*<span[\s\S]*?role="tooltip"[\s\S]*?style=\{lugar \? \{ left: lugar\.left, top: lugar\.top, width: lugar\.ancho \}/.test(info) || !/document\.body,\s*\)/.test(info)) F("6 · el tooltip no va en una capa sobre la página con el lugar calculado");
    if (!/window\.addEventListener\("scroll", recolocar, true\)/.test(info) || !/window\.addEventListener\("resize", recolocar\)/.test(info)) F("6 · el tooltip no se recoloca al hacer scroll o cambiar el tamaño");
    const tip = reglas.find((r) => r.medio == null && r.sel.includes(".ex-tip"));
    if (decl(tip?.decl ?? "", "position") !== "fixed") F("6 · el tooltip no va con position: fixed");
    if (reglas.some((r) => r.sel.some((s) => /\.ex-tip-(der|izq)/.test(s)))) F("6 · quedan los lados fijos del tooltip (.ex-tip-der / .ex-tip-izq)");
    const filtrosSrc = codigo("src/app/explorar/hoja-filtros.tsx");
    for (const m of ["info-depto", "info-financiamiento", "info-tasa", "info-perfil"]) if (!new RegExp(`<Info [^>]*marca="${m}"`).test(filtrosSrc)) F(`6 · la ⓘ ${m} de Filtros no es la de la casa`);
    for (const f of ["src/app/explorar/hoja-filtros.tsx", "src/app/explorar/explorar-cliente.tsx", "src/app/explorar/tarjeta-pin.tsx", "src/app/explorar/lista-portal.tsx"]) if (/role="tooltip"/.test(codigo(f))) F(`6 · ${f} arma un tooltip propio`);
  }

  // ══ §7 · EL DASHBOARD EN DOS COLUMNAS (y «Estás dentro») ═══════════════════
  {
    if (MAPA_CASA_PC.ancho > 640 || MAPA_CASA_PC.alto > 640 || !(MAPA_CASA_PC.ancho > MAPA_CASA.ancho)) F("7 · la imagen del PC no se puede pedir a Static Maps o es la del teléfono");
    if (!/\.\.\.imagen\(MAPA_CASA\),\s*pc: imagen\(opts\.pc \?\? MAPA_CASA_PC\),/.test(codigo("src/lib/casa/mapa-casa-servidor.ts"))) F("7 · el servidor no arma la imagen del PC");
    // «Estás dentro» es más angosta (712 px de contenido): su imagen del PC se pide al tamaño de SU columna, no al del dashboard.
    const dentro = (712 - 24) * 0.55;
    if (Math.abs(MAPA_DENTRO_PC.ancho - dentro) > 2 || MAPA_DENTRO_PC.alto > 640) F(`7 · la imagen de «Estás dentro» en el PC no es la de su columna (${MAPA_DENTRO_PC.ancho} contra ${dentro.toFixed(0)})`);
    if (!/pc: pideMapa === "casa" \? MAPA_CASA_PC : MAPA_DENTRO_PC/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("7 · «Estás dentro» pide la imagen del PC al tamaño del dashboard");
    if (modCasa) {
      const imagen = (ancho: number, alto: number) => ({ ancho, alto, encuadre: { lat: -33.4, lng: -70.6, zoom: 13 }, url: `https://maps.googleapis.com/maps/api/staticmap?size=${ancho}x${alto}`, urlOscuro: null, grises: [], seleccion: [] });
      const h = dibujar(createElement(modCasa.MapaCasa, { datos: { ...imagen(350, 200), pc: imagen(566, 420), nSeleccion: 0, nConvienen: 0, nOtros: 0, desdePerfil: false, comunas: [] }, variante: "casa", totalNoche: 6802 }));
      const d = h.match(/<div class="ca-mapa-img ca-mapa-img-d" style="([^"]*)" data-casa="mapa-d" data-ancho="(\d+)" data-alto="(\d+)">/);
      if (!d || d[2] !== "566" || d[3] !== "420" || !/aspect-ratio:566 \/ 420/.test(d[1]) || !/max-width:566px/.test(d[1])) F("7 · la imagen del PC no se dibuja a su tamaño (sin estirarse más allá de 566 px)");
      if (!/size=566x420/.test(h)) F("7 · la imagen del PC no se pide a 566 × 420");
    }
    const casa = reglasCss(leer("src/app/dashboard/casa.css"));
    const pc = casa.filter((r) => r.medio === "(min-width: 1024px)");
    const grilla = pc.find((r) => r.sel.includes('.ca-dos[data-con-mapa="1"]'));
    if (!grilla || decl(grilla.decl, "display") !== "grid" || !/minmax\(0, 55fr\) minmax\(0, 45fr\)/.test(decl(grilla.decl, "grid-template-columns") ?? "")) F("7 · en el PC el mapa y las tarjetas no van en dos columnas, el mapa al 55 %");
    const fijo = pc.find((r) => r.sel.includes('.ca-dos[data-con-mapa="1"] > .ca-dos-mapa'));
    if (decl(fijo?.decl ?? "", "position") !== "sticky") F("7 · en el PC el mapa no se queda fijo al bajar por las tarjetas");
    // En la columna de la derecha, las tarjetas una debajo de la otra (QA en local: de a tres quedaban aplastadas).
    const unaCol = pc.find((r) => r.sel.includes('.ca-dos[data-con-mapa="1"] .sel-lista'));
    if (!/^minmax\(0, 1fr\)$/.test(decl(unaCol?.decl ?? "", "grid-template-columns") ?? "")) F("7 · en el PC las tarjetas de la columna derecha no van una debajo de la otra");
    if (casa.some((r) => r.medio == null && r.sel.some((s) => s.startsWith(".ca-dos")) && /display\s*:\s*grid/.test(r.decl))) F("7 · en el teléfono el dashboard también va en dos columnas");
    const muestra = (r: Regla | undefined) => decl(r?.decl ?? "", "display");
    if (muestra(casa.find((r) => r.medio == null && r.sel.includes(".ca-mapa-img-d"))) !== "none" || muestra(casa.find((r) => r.medio === "(min-width: 768px)" && r.sel.includes(".ca-mapa-img-m"))) !== "none") F("7 · el teléfono y el PC no muestran cada uno su imagen");
    const pagina = codigo("src/app/dashboard/page.tsx");
    const dos = elementoDesde(pagina, pagina.lastIndexOf("<", pagina.indexOf('className="ca-dos"')));
    if (!/<div className="ca-dos-mapa"><MapaCasa /.test(dos) || !/<div className="ca-dos-tarjetas"><SeleccionEnCasa /.test(dos)) F("7 · el dashboard no pone el mapa y las tarjetas en sus columnas");
    const prim = codigo("src/components/deptos/PrimeraSeleccion.tsx");
    const dosP = elementoDesde(prim, prim.lastIndexOf("<", prim.indexOf('className="ca-dos"')));
    if (!/className="ca-dos-mapa" data-primera="mapa"><MapaCasa /.test(dosP) || !/<div className="ca-dos-tarjetas">[\s\S]*data-primera="lista"/.test(dosP)) F("7 · «Estás dentro» no pone el mapa y las tarjetas en sus columnas");
  }

  for (const m of fallas) console.log(`  ✗ ${m}`);
  console.log(fallas.length === 0 ? "  ✓ EXPLORAR-PASADA: todo en orden" : `  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runExplorarPasadaTier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (03-nov-2026, meta-runner `mutar-pasada.cjs` del scratchpad de la sesión 087cc148, que restaura byte a byte
// con hash y exige que el texto mutado aparezca UNA vez): 98 mutaciones a este tier, 98 de 98 en ROJO y cada una por su invariante.
//   §1 P1-P9: el botón que no abre la hoja, abrirCalculo que no abre, el tooltip de vuelta en el copy, una ⓘ con tooltip en la
//      barra, el botón escondido en el teléfono, la ⓘ redonda del tamaño de un chip o sin tinta, el texto sin medir, dos botones.
//   §2 P10-P18: la hoja sin «todos», «con tu correo», Filtros y el enlace sin negrita, el enlace a otra página, la nota de 70 de
//      vuelta, la tasa escrita a mano, el perfil en una viñeta, un chip inventado.
//   §3 P19-P43: de entrada solo Comprar o con 5 %, la URL que no escribe ni lee «solo», «solo Comprar» que no esconde, el tope
//      que no se aplica, la capa con los que ya son Comprar, el pedido de la noche sin la capa, con cifras sin cuenta, leyendo la
//      capa a 25 años o cayéndose si la capa falla, las dos rutas sin el pedido de la noche, el navegador que ignora la capa del
//      pedido o decide sin capaVisible, el mapa sin los − Ajustar, el chip con otro estado, el evento al apagar, sin el tope o con
//      otro nombre, la bienvenida o la página que suman la capa a «convienen», Filtros con el nombre viejo, con 5 % de entrada o
//      con el botón sin el chip − Ajustar.
//   §4 P44-P54: una línea vacía, el total sin la capa, la barra sin la línea de Ajustar, la coma de vuelta, el desglose de todo lo
//      cargado (no de lo que se ve), la píldora de vuelta, el PC sin barra, «Ver lista» sin subrayar, debajo y a la izquierda o
//      fuera de la barra, la lista con otra cabecera.
//   §5 P55-P77: ✓ Comprar en rojo, la ciruela oscura que no es la del chip, el analizado en azul, el grupo en rojo, el elegido sin
//      anillo grueso o del mismo tamaño, el analizado sin ✓, el mapa con su rojo, el grupo de los analizados en azul, un − Ajustar
//      en azul, la etiqueta sin «dcto.», el mapa chico en rojo, la imagen y la vista previa sin pedir su clase, la tarjeta sin la
//      clase de la imagen, el dashboard y el número de las tarjetas en rojo, el analizado de la selección con número, la clase
//      perdida en el dashboard, en la selección o en las tarjetas.
//   §6 P78-P86: el tooltip sin correrse de lado, siempre abajo, más ancho que una pantalla de 250, sin acotar arriba y abajo, la ⓘ
//      sin colocarTooltip, dentro del panel, sin recolocarse al hacer scroll, los lados fijos de vuelta, un tooltip propio.
//   §7 P87-P95: la imagen del PC demasiado grande, el servidor sin ella, estirada, dos columnas a la mitad, el mapa que no queda
//      fijo, dos columnas en el teléfono, el teléfono con la imagen del PC, el dashboard y «Estás dentro» sin columnas.
//      P96-P98 (el mismo día, tras el QA en local: en «Estás dentro», más angosta, la imagen del PC se mostraba al 66 % y las
//      tarjetas iban de a tres en la columna): «Estás dentro» con la imagen del dashboard o de su ancho, las tarjetas de a tres.
// Seis cosas que la primera corrida cazó y se arreglaron antes de cerrar el acta: dos mutaciones que no aplicaban (CRLF: el runner
// ahora lleva la mutación al fin de línea del archivo), una que mutaba OTRA aparición del mismo texto (el evento, no el desglose:
// el runner ahora exige una sola), una que salía roja por una excepción y no por su mensaje (el tier ahora atrapa la falla de la
// capa), y DOS HUECOS DEL TIER: «Ver lista a la derecha» se leía del orden del DOM y lo pone la grilla del CSS (ahora se lee la
// grilla), y el ancho del tooltip no se probaba en una pantalla más angosta que él (ahora, 250 px).
// PREDICADOS REESCRITOS EN OTROS TIERS (mismo día, con su acta en cada uno; `mutar-otros.cjs`): 62 de 62 en ROJO, cada uno en su
// tier — PUERTA-B §10, PRIMERA-SELECCION §12, PUERTA-B-DASHBOARD §1 y §3, PUERTA-B-MOCKUPS §2, PERFIL-OFERTA §2, RESPALDO-MAPA §3, EXPLORAR §6,
// EXPLORAR-PORTAL §1, §3, §6, §7 y §8, COMPARTIR-DEPTO §1, §6 y §7, PUERTA-E §2 y §3, EXPLORAR-CORREOS §4, NUEVO-USADO §3,
// EXPLORAR-RECORRIDO §5 y §9, CONVIENEN-UNO §1, §2 y §3, EXPLORAR-NEGOCIAR §1, §2, §3, §8 y §9.
// FUERA DE ESTE GOAL (respuesta de Fabrizio, 03-nov-2026): «el post del día» es una imagen para redes que todavía no existe; cuando
// exista, sus pines salen de colores-pin.ts.
// ─────────────────────────────────────────────────────────────────────────────
