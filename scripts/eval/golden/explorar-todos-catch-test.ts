// ============================================================================
// TIER EXPLORAR-TODOS — el mapa con todos los deptos (25-nov-2026, láminas 5, 6, 7 y 8 del canvas «La asesoría en el mapa»; las
// decisiones de Fabrizio del 25-nov, una prueba por cada una):
//   1 · TRES COLORES: Comprar azul, Ajustar ciruela, No conviene en el rojo del chip BUSCAR OTRA (claro y oscuro). Acta del rojo:
//       «rojo: botón principal y veredicto No conviene» (colores-pin.ts) reemplaza a «rojo en ningún pin» del 03-nov.
//   2 · UN AJUSTAR QUE NECESITA MÁS DE 10 % ES NO CONVIENE: todo Ajustar que se ve trae su «Conviene desde UF X»; el descuento máximo
//       5 o 10 % se fue del panel (siempre 10).
//   3 · EL CONTADOR «X de Y convienen» sale de UNA función: X es `cuantosConvienen`, el mismo número de la landing y de /deptos.
//   4 · LA BARRA: solo Usados o Proyectos y Filtros; Proyectos escondido (PROYECTOS_VISIBLE).
//   5 · LA TARJETA DEL CONTADOR: los tres veredictos como chips con su número; tocar uno lo apaga; en el teléfono, fila que se desliza.
//   6 · LOS PINES: el precio con su unidad; al mover una barra, Comprar y Ajustar dicen esa cifra; No conviene siempre el precio;
//       lejos, grupos con número; si dos chocan, la cifra la conserva el de mejor puntaje.
//   7 · LA TARJETA DEL DEPTO: comuna en mayúsculas, metro a menos de 1 km (si no, barrio o sector; si no, avenida), tipología y m²;
//       la franja de cuatro cifras; Ajustar suma «Conviene desde UF X · N % menos»; No conviene, solo el publicado.
//   8 · SIN CUENTA: pines con color y precio; en la tarjeta solo el publicado nítido; en el panel solo precio y dormitorios.
//   9 · EL PANEL: cinco barras con la distribución dibujada, dormitorios como botones, los supuestos en una línea y la renta corta
//       con «se estima por zona».
//  10 · RENTA CORTA CON LOS TRES VEREDICTOS: el «Conviene desde UF X» también en renta corta.
//  11 · «NUEVO HOY» SIN REPUBLICADOS: el alta es la del primer eslabón de avisos_gemelos.
//  + LOS TRAMOS: los cortes del código son los de la función explorar_mapa_todos, y el cap rate del tramo es el de la tarjeta.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. §3, §11 y los tramos leen la base (solo lectura).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-todos-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import * as po from "../../../src/lib/explorar/portal";
import * as mt from "../../../src/lib/explorar/mapa-todos";
import * as cc from "../../../src/lib/explorar/capa-canvas";
import * as cn from "../../../src/lib/explorar/capa-negociar";
import * as cp from "../../../src/lib/explorar/colores-pin";
import * as lu from "../../../src/lib/explorar/lugar";
import { capRatePct } from "../../../src/lib/explorar/explorar";
import { sinCifras } from "../../../src/lib/explorar/abierto";
import { todosDeLaNoche } from "../../../src/lib/explorar/portal-servidor";

(globalThis as { React?: unknown }).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
const COMUNAS = ["Santiago", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea", "Ñuñoa", "La Reina", "Macul", "Peñalolén", "La Florida", "San Joaquín", "Maipú", "Pudahuel", "Cerrillos", "Estación Central", "Quinta Normal", "Independencia", "Recoleta", "Huechuraba", "Conchalí", "Quilicura", "Renca", "San Miguel", "La Cisterna", "Puente Alto"];

/** Un pin de prueba (Comprar), con lo justo. */
const pin = (x: Partial<po.PinMapa> = {}): po.PinMapa => ({ avisoId: "a", comuna: "Santiago", lat: -33.45, lng: -70.65, m2: 50, dormitorios: 2, banos: 1, tipologia: "2D1B", precioUF: 2800, veredicto: "COMPRAR", score: 76, flujo: 20457, arriendo: 520000, alta: null, tramos: [5, 12, 13], ...x });

export async function runExplorarTodosTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-TODOS (el mapa con todos los deptos: tres colores, el Ajustar con su UF X, el contador único, la barra, los chips, los pines, la tarjeta, sin cuenta, el panel, renta corta, «Nuevo hoy», los tramos · 0 tokens + 4 lecturas) ───");

  // ── 1 · tres colores; el rojo es el del chip BUSCAR OTRA ──
  const chip = leer("src/components/analysis/shared/ChipVeredicto.tsx");
  const rojoChip = { claro: chip.match(/\[data-theme="light"\]\{[^}]*--chip-v-b:(#[0-9A-Fa-f]{6})/)?.[1], oscuro: chip.match(/:root\{[^}]*--chip-v-b:(#[0-9A-Fa-f]{6})/)?.[1] };
  if (!rojoChip.claro || !rojoChip.oscuro) F("1 · no encuentro --chip-v-b en ChipVeredicto (el instrumento no corrió)");
  for (const tema of ["claro", "oscuro"] as const) {
    if (cp.COLORES_PIN[tema].no?.fondo?.toUpperCase() !== rojoChip[tema]?.toUpperCase()) F(`1 · el pin No conviene (${tema}) no es el rojo del chip BUSCAR OTRA: ${cp.COLORES_PIN[tema].no?.fondo} ≠ ${rojoChip[tema]}`);
    if (cp.COLORES_PIN[tema].comprar.fondo === cp.COLORES_PIN[tema].no?.fondo || cp.COLORES_PIN[tema].ajustar.fondo === cp.COLORES_PIN[tema].no?.fondo) F(`1 · Comprar o Ajustar comparten el rojo (${tema})`);
  }
  if (!/ROJO: BOTÓN PRINCIPAL Y VEREDICTO NO CONVIENE/.test(leer("src/lib/explorar/colores-pin.ts"))) F("1 · falta el acta del rojo en colores-pin.ts");
  // Cada pin del canvas lleva la clase de su veredicto (claseDePin), y el canvas pinta con colorPin de esa clase.
  if (cn.claseDePin(pin()) !== "comprar" || cn.claseDePin(pin({ veredicto: "BUSCAR OTRA", score: null })) !== "no" || cn.claseDePin({ ...pin({ veredicto: "AJUSTA SUPUESTOS" }), neg: { d: 3, p: 2700, s: 70, f: 1 } } as cn.PinNegociado) !== "ajustar") F("1 · claseDePin no da las tres clases");
  const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
  if (!/colorPin\(d\.clase, tema\)\.fondo/.test(mapa)) F("1 · el canvas no pinta cada punto con el color de su clase (colorPin(d.clase, tema))");

  // ── 2 · un Ajustar sin descuento a 10 % es No conviene; el descuento máximo se fue ──
  if (mt.claseDeVeredicto("AJUSTA SUPUESTOS", false) !== "no") F("2 · un Ajustar sin «Conviene desde UF X» no pasa a No conviene");
  if (mt.claseDeVeredicto("AJUSTA SUPUESTOS", true) !== "ajustar" || mt.claseDeVeredicto("BUSCAR OTRA", true) !== "no" || mt.claseDeVeredicto("COMPRAR", false) !== "comprar") F("2 · claseDeVeredicto no respeta las tres clases");
  if (po.validarPortal({ negociar: 5 }).negociar !== 10) F("2 · un enlace con n=5 sigue pidiendo el descuento máximo de 5 % (debía quedar en 10)");
  const hoja = codigo("src/app/explorar/hoja-filtros.tsx");
  if (/tope-\$\{t\}|TOPES_NEGOCIAR/.test(hoja)) F("2 · el panel sigue ofreciendo el descuento máximo 5 o 10 %");

  // ── 3 · el contador «X de Y convienen» y la función única ──
  const t3 = mt.textoContador({ comprar: 4513, ajustar: 3016, no: 11527 });
  if (t3.cifra !== "4.513 de 19.056" || t3.resto !== "convienen") F(`3 · el contador no dice «4.513 de 19.056 convienen»: «${t3.cifra} ${t3.resto}»`);
  const guardado = codigo("src/lib/explorar/convienen-guardado.ts");
  if (!/cuantosConvienen\(compactar\(await universoDeLaNoche\(/.test(guardado)) F("3 · el número guardado (landing y /deptos) ya no sale de cuantosConvienen sobre universoDeLaNoche");
  const serv = codigo("src/lib/explorar/portal-servidor.ts");
  if (!/if \(plazo >= 30\) return \(await todosDeLaNoche\(admin, pie, ahora\)\)\.pines;/.test(serv)) F("3 · universoDeLaNoche a 30 años no sale de los Comprar de explorar_mapa_todos: el contador y la landing podrían diferir");

  // ── 4 · la barra: Usados (Proyectos escondido) y Filtros; sin «Ver solo Comprar» ──
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  if (mt.PROYECTOS_VISIBLE !== false) F("4 · Proyectos está visible y todavía no hay nuevos evaluados");
  if (!/\{PROYECTOS_VISIBLE && <button[^>]*data-explorar="proyectos"/.test(cli)) F("4 · el botón Proyectos no depende de PROYECTOS_VISIBLE");
  if (!/data-explorar="usados"/.test(cli)) F("4 · falta «Usados» en la barra");
  if (/data-explorar="solo-comprar"/.test(cli)) F("4 · la barra sigue con «Ver solo ✓ Comprar»");

  // ── 5 · la tarjeta del contador: tres chips con su número, apagables, fila deslizable en el teléfono ──
  const modCont = cargar<{ Contador: FC<Record<string, unknown>> }>("src/app/explorar/contador", F);
  if (modCont) {
    const html = renderToStaticMarkup(createElement(modCont.Contador, { conteo: { comprar: 4513, ajustar: 3016, no: 11527 }, ocultar: ["no"], alAlternar: () => {}, alComo: () => {}, alVerLista: () => {} }));
    if (!/4\.513 de 19\.056/.test(html)) F("5 · la tarjeta del contador no dice «4.513 de 19.056»");
    for (const [c, txt] of [["comprar", "4.513 Comprar"], ["ajustar", "3.016 Ajustar"], ["no", "11.527 No conviene"]]) if (!html.includes(txt) || !new RegExp(`data-clase="${c}"`).test(html)) F(`5 · falta el chip «${txt}»`);
    if (!/data-clase="no"[^>]*data-off="1"[^>]*aria-pressed="false"/.test(html)) F("5 · el chip apagado no se marca apagado (data-off, aria-pressed=false)");
    if (!/data-explorar="como-se-calcula"/.test(html)) F("5 · falta la (i) de «¿Cómo se calcula?» en la tarjeta del contador");
    if (!/data-explorar="ver-lista"/.test(html)) F("5 · falta «Ver lista» (teclado y lector de pantalla)");
  }
  const f5 = po.validarPortal({ ocultar: ["ajustar"] });
  if (f5.ocultar.join() !== "ajustar" || po.portalDeUrl(new URLSearchParams(po.urlDePortal(f5))).filtros.ocultar.join() !== "ajustar") F("5 · apagar un chip no viaja en la URL");
  if (po.validarPortal({ ocultar: ["comprar", "ajustar", "no"] }).ocultar.length !== 0) F("5 · las tres apagadas dejan el mapa vacío (debían volver a verse)");
  if (!/const todos = useMemo\(\(\): PinMapa\[\] => \[\.\.\.\(seVe\("comprar"\) \? visibles : \[\]\), \.\.\.\(seVe\("ajustar"\) \? visiblesNeg : \[\]\), \.\.\.\(seVe\("no"\) \? visiblesNo : \[\]\)\]/.test(cli)) F("5 · los chips apagados no esconden sus pines del mapa");
  // «Ver lista» (el camino del teclado y del lector de pantalla) lleva lo mismo que el mapa: las tres clases, sin las apagadas.
  if (!/noConviene=\{seVe\("no"\) \? ordenar\(visiblesNo, "precio", uf\) : \[\]\}/.test(cli) || !/pines=\{seVe\("comprar"\) \? visibles : \[\]\}/.test(cli)) F("5 · «Ver lista» no lleva los No conviene o no respeta los chips apagados");
  const lista = codigo("src/app/explorar/lista-portal.tsx");
  if (!/const filas: PinMapa\[\] = \[\.\.\.pines, \.\.\.negociados, \.\.\.noConviene\];/.test(lista) || !/p\.veredicto === "BUSCAR OTRA" \? \(\s*<span className="ex-linea2"><span className="chip-v b"[^>]*>\{TARJETA_COPY\.noConviene\}/.test(lista)) F("5 · la lista no dibuja los No conviene con «No conviene a este precio»");
  const css = leer("src/app/explorar/explorar.css");
  if (!/\.ex-contador-chips \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/.test(css)) F("5 · en el teléfono los chips no van en una fila que se desliza");

  // ── 6 · los pines: precio con su unidad; la cifra de la barra; No conviene siempre el precio; choques por puntaje ──
  const p6 = pin();
  if (mt.textoCifraPin(p6, "comprar", "precio", 38000) !== "UF 2.800") F("6 · por defecto el pin no dice el precio con su unidad");
  if (mt.textoCifraPin(p6, "comprar", "arriendo", 38000) !== "$520 mil") F(`6 · con la barra del arriendo, Comprar no dice el arriendo: ${mt.textoCifraPin(p6, "comprar", "arriendo", 38000)}`);
  if (mt.textoCifraPin(p6, "ajustar", "flujo", 38000) !== "+$20 mil") F(`6 · con la barra del flujo, Ajustar no dice el flujo: ${mt.textoCifraPin(p6, "ajustar", "flujo", 38000)}`);
  if (mt.textoCifraPin(p6, "no", "arriendo", 38000) !== "UF 2.800") F("6 · No conviene muestra otra cifra que el precio");
  if (mt.textoCifraPin(p6, "comprar", "arriendo", 38000, true) !== "UF 2.800") F("6 · sin cuenta el pin muestra una cifra que no viaja");
  const aPx = (lat: number, lng: number) => ({ x: (lng + 70.65) * 100000, y: (-33.45 - lat) * 100000 });
  const dib = cc.componerCapa([
    { id: "bajo", lat: -33.45, lng: -70.65, clase: "comprar", texto: "UF 1.000", puntaje: 60 },
    { id: "alto", lat: -33.45, lng: -70.65001, clase: "ajustar", texto: "UF 2.000", puntaje: 80 },
    { id: "no", lat: -33.45001, lng: -70.65, clase: "no", texto: "UF 3.000", puntaje: null },
  ], { zoom: 16, elegido: null, aPixel: aPx, ancho: () => 50, vista: { w: 400, h: 400 } });
  const etq = dib.filter((d) => d.tipo === "etiqueta").map((d) => (d as { id: string }).id);
  if (etq.join() !== "alto") F(`6 · al chocar, la cifra no la conserva el de mejor puntaje (etiquetas: ${etq.join() || "ninguna"})`);
  if (dib.filter((d) => d.tipo === "punto").length !== 2) F("6 · los que chocan no quedan como punto");
  const lejos = cc.componerCapa(Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, lat: -33.45 + i * 1e-6, lng: -70.65, clase: "comprar" as const, texto: "x", puntaje: 1 })), { zoom: 12, elegido: null, aPixel: aPx, ancho: () => 20, vista: { w: 400, h: 400 } });
  if (!lejos.some((d) => d.tipo === "grupo" && d.n === 30)) F("6 · lejos, los muchos no van en un grupo con su número");
  if (cc.tocado(dib, 0, 0)?.tipo !== "etiqueta") F("6 · tocar la cifra no la encuentra");

  // ── 7 · la tarjeta del depto ──
  if (lu.metroCercano(-33.4374, -70.6505)?.nombre == null) F("7 · no encuentra el metro a menos de 1 km (Plaza de Armas)");
  if (lu.metroCercano(-33.37, -70.5) != null) F("7 · encuentra metro donde no hay a menos de 1 km");
  if (lu.textoLugar({ nombre: "Parque Almagro" }, { barrio: "X", avenida: "Y" }) !== "Metro Parque Almagro") F("7 · con metro, el lugar no es el metro");
  if (lu.textoLugar(null, { barrio: "Lo Hermida", avenida: "Grecia" }) !== "Sector Lo Hermida") F("7 · sin metro, el lugar no es el barrio o sector");
  if (lu.textoLugar(null, { barrio: null, avenida: "Avenida Grecia" }) !== "Cerca de Avenida Grecia") F("7 · sin metro ni barrio, el lugar no es la avenida");
  const modTar = cargar<{ TarjetaPin: FC<Record<string, unknown>> }>("src/app/explorar/tarjeta-pin", F);
  const tarjeta = (p: po.PinMapa, sinCuenta = false) => modTar ? renderToStaticMarkup(createElement(modTar.TarjetaPin, { pines: [p], seleccionado: p.avisoId, uf: 38000, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar: () => {}, alCerrar: () => {}, alGuardar: () => {}, alAnalizar: () => {}, alCompartir: () => {}, sinCuenta })) : "";
  const hC = tarjeta(pin());
  if (modTar) {
    if (!/data-explorar="comuna">SANTIAGO</.test(hC)) F("7 · el título no es la comuna en mayúsculas");
    if (!/data-explorar="linea">2D1B · 50 m²</.test(hC)) F("7 · la línea no lleva tipología y m²");
    for (const [k, v] of [["precio", "UF 2.800"], ["arriendo", "\\$520\\.000"], ["cap-rate", "5,9 %"], ["flujo", "\\$20\\.457"]]) if (!new RegExp(`data-explorar="${k}"[^>]*>${v}<`).test(hC)) F(`7 · la franja no trae ${k} = ${v}`);
    if (!/data-explorar="analizar"[^>]*>Ver este depto</.test(hC)) F("7 · el botón principal no dice «Ver este depto»");
    // «Cap rate bruto» (26-nov-2026): la tarjeta dice el bruto con su nombre (el informe muestra el neto), con y sin cuenta.
    if (!/<span>Cap rate bruto<\/span><b data-explorar="cap-rate">/.test(hC) || !/<span>Cap rate bruto<\/span><b class="ex-borroso"/.test(tarjeta(pin(), true))) F("7 · la tarjeta no dice «Cap rate bruto» (con y sin cuenta)");
    const hA = tarjeta({ ...pin({ veredicto: "AJUSTA SUPUESTOS", flujo: -45000 }), neg: { d: 3.2, p: 2810, s: 70, f: 1 } } as po.PinMapa);
    if (!/Conviene desde UF 2\.810 · 3,2 % menos/.test(hA)) F("7 · Ajustar no suma «Conviene desde UF X · N % menos»");
    if (!/>Pones al mes</.test(hA)) F("7 · con flujo negativo la franja no dice «Pones al mes»");
    const hN = tarjeta(pin({ veredicto: "BUSCAR OTRA", score: null, flujo: null, arriendo: null }));
    if (!/data-n="1"/.test(hN) || /data-explorar="arriendo"/.test(hN) || !/No conviene a este precio/.test(hN)) F("7 · No conviene no muestra solo el publicado con «No conviene a este precio»");
  }

  // ── 8 · sin cuenta ──
  if (modTar) {
    const hS = tarjeta(pin(), true);
    if (!/data-explorar="precio">UF 2\.800</.test(hS)) F("8 · sin cuenta, el publicado no se ve");
    if ((hS.match(/data-explorar="borroso"/g) ?? []).length !== 3 || /\$520\.000|20\.457/.test(hS)) F("8 · sin cuenta, las otras tres cifras no van difuminadas (o viajan)");
  }
  const u8 = po.compactar([pin()]);
  if ((sinCifras(u8).filas[0] as unknown[]).length !== 13) F("8 · sin cuenta viajan los tramos");
  if (mt.BARRAS_SIN_CUENTA.join() !== "precio") F("8 · sin cuenta el panel muestra otra barra que el precio");

  // ── 9 · el panel ──
  const modHoja = cargar<{ HojaFiltros: FC<Record<string, unknown>> }>("src/app/explorar/hoja-filtros", F);
  if (modHoja) {
    const props = { filtros: po.FILTROS_GLOBALES, tasa: { tasa: 4.07 }, contarTodos: () => 19056, distribucion: () => new Array(24).fill(3), asegurar: () => {}, alAplicar: () => {}, alCerrar: () => {} };
    const h9 = renderToStaticMarkup(createElement(modHoja.HojaFiltros, props));
    for (const b of mt.BARRAS_PANEL) if (!new RegExp(`data-explorar="barra-${b}"`).test(h9)) F(`9 · falta la barra ${b}`);
    if ((h9.match(/<span style="height:\d+px"/g) ?? []).length !== 24 * 5) F("9 · las barras no dibujan su distribución (24 tramos cada una)");
    if (!/data-explorar="dormitorios"/.test(h9) || !/data-tipologia="2"/.test(h9)) F("9 · los dormitorios no van como botones");
    if (!/data-explorar="barra-cap"[^>]*><legend class="ex-grupo-t">Cap rate bruto<\/legend>/.test(h9)) F("9 · la barra del cap rate no dice «Cap rate bruto»");
    if (!/Con pie de <b>20 %<\/b>, crédito a <b>30 años<\/b> y tasa de <b>4,07 %<\/b>/.test(h9) || !/data-explorar="cambiar-supuestos"/.test(h9)) F("9 · los supuestos no van en una línea editable");
    if (!h9.includes(mt.PANEL_COPY.cortaPorZona) || !/data-explorar="renta-corta"/.test(h9)) F("9 · falta renta corta con «se estima por zona»");
    if (!/Ver 19\.056 deptos/.test(h9)) F("9 · el botón no dice «Ver N deptos»");
    const h8 = renderToStaticMarkup(createElement(modHoja.HojaFiltros, { ...props, alPedirRegistro: () => {} }));
    if ((h8.match(/-cuenta"/g) ?? []).length !== 4 || !/data-explorar="barra-precio-min"/.test(h8)) F("8 · sin cuenta, el panel no deja solo precio (y dormitorios) y pide la cuenta en las otras cuatro");
  }
  const f9 = po.validarPortal({ rangos: { arriendo: [5, 23] }, cifra: "arriendo" });
  if (!po.pasaRangos({ tramos: [6, 0, 0], precioUF: 2000, m2: 50 }, f9.rangos) || po.pasaRangos({ tramos: [4, 0, 0], precioUF: 2000, m2: 50 }, f9.rangos)) F("9 · la barra del arriendo no filtra por tramo");
  if (po.pasaRangos({ precioUF: 2000, m2: 50 }, f9.rangos)) F("9 · un depto sin tramo pasa una barra con rango (sin cuenta debía quedar fuera)");

  // ── 10 · renta corta con los tres veredictos ──
  if (!cn.capaNegociarDisponible({ modalidad: "str", pie: 20, plazo: 30, tasa: null })) F("10 · en renta corta no hay «Conviene desde UF X»");
  const ruta = codigo("src/app/api/explorar/route.ts");
  if (!/const conCapa = true;/.test(ruta) || !/respuestaUniverso\(pines, \{ \.\.\.q, comunas \}, cuenta, negociados, noConviene\)/.test(ruta)) F("10 · la API no devuelve las tres clases en lo calculado (renta corta incluida)");
  if (!/c\.n = n;/.test(serv) || !/negociarStrReal/.test(serv)) F("10 · lo calculado en renta corta no calcula el descuento de los Ajustar");

  // ── 11, los tramos y §3 contra la base (solo lectura) ──
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) F("11 · sin credenciales de la base: no corrieron las lecturas");
  else {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const desde = new Date(Date.now() - 7 * 864e5).toISOString().replace("Z", "");
    const { data, error } = await admin.rpc("explorar_mapa_todos", { comunas: COMUNAS, desde, pie: 20 });
    const filas = (data ?? []) as unknown[][];
    if (error || filas.length < 1000) F(`3 · explorar_mapa_todos no respondió (${error?.message ?? filas.length})`);
    else {
      const [c0, c1, c2] = [0, 1, 2].map((v) => filas.filter((f) => Number(f[8]) === v));
      if (c1.some((f) => f[13] == null || f[14] == null)) F("2 · hay un Ajustar sin «Conviene desde UF X» en el mapa");
      if (c2.some((f) => f[9] != null || f[10] != null || f[11] != null || f[13] != null)) F("2 · un No conviene viaja con cifras");
      if (filas.some((f) => [15, 16, 17].some((i) => f[i] == null))) F("tramos · hay filas sin tramo");
      const { data: n } = await admin.from("config").select("value").eq("key", "explorar_convienen_mapa").maybeSingle();
      void n; void c0;
      // Los cortes del código, los de la función (pg_get_functiondef por la RPC de diagnóstico no existe: se comparan con los tramos que
      // devuelve la base sobre un arriendo y un flujo conocidos).
      for (const f of filas.slice(0, 400)) {
        const arr = f[11] as number | null, flu = f[10] as number | null, precio = Number(f[7]);
        if (arr != null && mt.tramoDe(arr, mt.CORTES_TRAMOS.arriendo) !== Number(f[15])) { F(`tramos · el tramo de arriendo del código (${mt.tramoDe(arr, mt.CORTES_TRAMOS.arriendo)}) no es el de la base (${f[15]}) para $${arr}`); break; }
        if (flu != null && mt.tramoDe(flu, mt.CORTES_TRAMOS.flujo) !== Number(f[17])) { F(`tramos · el tramo de flujo del código no es el de la base para ${flu}`); break; }
        void precio;
      }
      // §11: un republicado del mapa lleva el alta del primer eslabón, no la suya.
      // Solo cuentan los pares con el viejo creado ANTES que el nuevo: hay pares del mismo pase con el viejo creado después (ahí el alta
      // propia ya es la más antigua y no prueban nada).
      const { data: g } = await admin.from("avisos_gemelos").select("nuevo_id, viejo_id, nuevo_visto_desde").order("nuevo_id").limit(1000);
      // El alta, como la arma el código del servidor (todosDeLaNoche), no la columna cruda: así el guard vigila al código.
      const t = await todosDeLaNoche(admin, 20);
      const porId = new Map([...t.pines, ...t.negociados, ...t.noConviene].map((p) => [p.avisoId, Number(p.alta)]));
      const enMapa = ((g ?? []) as Array<{ nuevo_id: string; viejo_id: string; nuevo_visto_desde: string }>).filter((x) => porId.has(x.nuevo_id)).slice(0, 200);
      const { data: viejos } = await admin.from("scraped_properties").select("id, created_at").in("id", enMapa.map((x) => x.viejo_id)).order("id").limit(200);
      const creado = new Map(((viejos ?? []) as Array<{ id: string; created_at: string }>).map((v) => [v.id, Math.floor(Date.parse(`${v.created_at}Z`) / 1000)]));
      const caso = enMapa.find((x) => (creado.get(x.viejo_id) ?? Infinity) < Math.floor(Date.parse(`${x.nuevo_visto_desde}Z`) / 1000));
      if (!caso) F("11 · no hay republicados en el mapa con el viejo anterior para probar la cadena (el instrumento no corrió)");
      else if (porId.get(caso.nuevo_id)! > creado.get(caso.viejo_id)!) F("11 · un republicado lleva su propia alta, no la del primer eslabón");
    }
  }
  // El cap rate del tramo es el de la tarjeta.
  const capT = mt.capParaTramo(520000, 2800, 38000), capC = capRatePct(520000, 2800, 38000);
  if (capT == null || capC == null || Math.abs(capT - capC) > 0.005) F(`tramos · el cap rate del tramo (${capT}) no es el de la tarjeta (${capC})`);

  // ACTA (25-nov-2026): verificado EN ROJO mutando el código que vigila —el resultado de cada mutación, en el reporte del goal—.
  console.log(fallas.length ? fallas.map((f) => `  ✗ ${f}`).join("\n") : "  ✓ las once decisiones y los tramos");
  return { hard: fallas.length };
}

if (require.main === module) runExplorarTodosTier().then((r) => process.exit(r.hard ? 1 : 0));
