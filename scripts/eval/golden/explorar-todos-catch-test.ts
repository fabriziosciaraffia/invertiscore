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
  // ACTA 26-nov-2026 (lámina 5d): antes «4.513 de 19.056» + «convienen»; ahora el número aparte, grande, y «de 19.056 deptos convienen».
  if (t3.numero !== "4.513" || t3.resto !== "de 19.056 deptos convienen") F(`3 · el contador no dice «4.513» y «de 19.056 deptos convienen»: «${t3.numero} ${t3.resto}»`);
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
    // ACTA 26-nov-2026 (lámina 5d «La tarjeta del contador»): el número grande y en azul, la barra de proporción, las casillas con su
    // número («Comprar · 4.513») y la flecha que pliega; la (i) y «Ver lista» salieron de la tarjeta.
    const html = renderToStaticMarkup(createElement(modCont.Contador, { conteo: { comprar: 4513, ajustar: 3016, no: 11527 }, ocultar: ["no"], alAlternar: () => {} }));
    if (!/<b class="ex-contador-big" data-explorar="contador-numero">4\.513<\/b> <span>de 19\.056 deptos convienen<\/span>/.test(html)) F("5 · la tarjeta no dice «4.513» grande y «de 19.056 deptos convienen»");
    if (!/\.ex-contador-big \{[^}]*font-size: 28px;[^}]*color: var\(--chip-v-c/.test(leer("src/app/explorar/explorar.css"))) F("5 · el número de los que convienen no va grande y en azul");
    if (!/data-explorar="contador-proporcion"[^>]*><span data-clase="comprar" style="width:23\.7%"><\/span><span data-clase="ajustar" style="width:15\.8%"><\/span><span data-clase="no" style="width:60\.5%"><\/span>/.test(html)) F("5 · falta la barra fina con la proporción de Comprar, Ajustar y No conviene");
    // ⚠ ACTA 26-nov-2026 (las tres casillas caben a 390): el texto de la casilla va en tres piezas —nombre, « · » y cifra— para que en
    // el teléfono la cifra baje bajo el nombre; antes era un solo texto «Comprar · 4.513». Se exige la casilla CON su clase y sus tres
    // piezas en orden, dentro del mismo botón.
    for (const [c, nom, n] of [["comprar", "Comprar", "4.513"], ["ajustar", "Ajustar", "3.016"], ["no", "No conviene", "11.527"]]) if (!new RegExp(`<button[^>]*data-clase="${c}"[^>]*>(?:(?!</button>)[^])*<span class="ex-vc-t">${nom}<span class="ex-vc-sep"> · </span><span class="ex-vc-n">${n}</span></span></button>`).test(html)) F(`5 · falta la casilla «${nom} · ${n}»`);
    // A 390 las tres caben: tres columnas, el separador fuera y la cifra bajo el nombre (no una fila que corre de lado).
    { const cssC = leer("src/app/explorar/explorar.css"); const iM = cssC.lastIndexOf("@media (max-width: 767px) {"); const blq = iM < 0 ? "" : cssC.slice(iM, cssC.indexOf("\n}", iM));
      if (!/\.ex-contador-chips \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[^}]*overflow: visible;/.test(blq) || !/\.ex-vc-sep \{ display: none; \}/.test(blq) || !/\.ex-vc-t \{ display: flex; flex-direction: column;/.test(blq)) F("5 · a 390 las tres casillas no caben (la fila vuelve a correr de lado o la cifra no baja bajo el nombre)"); }
    if (!/data-clase="no"[^>]*data-off="1"[^>]*aria-pressed="false"[^>]*><span class="ex-ck" aria-hidden="true"><\/span>/.test(html)) F("5 · la casilla apagada no queda apagada y vacía (data-off, aria-pressed=false, sin check)");
    if (!/data-clase="comprar"[^>]*aria-pressed="true"[^>]*><span class="ex-ck" aria-hidden="true"><svg/.test(html)) F("5 · la casilla prendida no lleva su check");
    if (/data-explorar="como-se-calcula"|data-explorar="ver-lista"/.test(html)) F("5 · la (i) o «Ver lista» siguen dentro de la tarjeta del contador");
    // §8 bis · QUE SE NOTE QUE SE TOCAN (26-nov-2026, pedido de Fabrizio): cada casilla dice lo que hace al pasar el mouse y reacciona
    // al pasar y al presionar.
    // ⚠ ACTA 26-nov-2026 (segunda vuelta): la línea de ayuda «Toca un veredicto…» se SACA — agregaba texto a la tarjeta que se está
    // achicando, y las casillas del punto 8 (prendida con color y check, apagada gris y vacía) ya se leen solas. Antes se exigía la
    // línea y que se fuera tras el primer toque; ahora se exige lo contrario, en positivo: el grupo de casillas CIERRA la tarjeta
    // (después de su </div> viene el </section>, nada en el medio) y cada casilla alterna directo, sin envoltorio que recuerde nada.
    if (!/data-clase="comprar"[^>]*title="Ocultar Comprar en el mapa"/.test(html) || !/data-clase="no"[^>]*title="Mostrar No conviene en el mapa"/.test(html)) F("8 · las casillas no dicen lo que hacen al pasar el mouse («Ocultar…» / «Mostrar…»)");
    if (/Toca un veredicto|ex-contador-ayuda/.test(html) || !/data-clase="no"[^>]*>(?:(?!<\/button>)[^])*<\/button><\/div><\/section>/.test(html)) F("8 · vuelve una línea bajo las casillas: el grupo de casillas ya no cierra la tarjeta del contador");
    const contA = codigo("src/app/explorar/contador.tsx");
    if (!/onClick=\{alAlternar \? \(\) => alAlternar\(c\) : undefined\}/.test(contA) || /CASILLAS_USADAS|usadas/.test(contA)) F("8 · la casilla no alterna directo (o vuelve el recuerdo de «ya las usó» de la línea de ayuda)");
    const cssA = leer("src/app/explorar/explorar.css");
    if (!/@media \(hover: hover\) \{ \.ex-vc:hover \{ box-shadow: [^;]+; transform: translateY\(-1px\); \}/.test(cssA) || !/\.ex-vc:active \{ transform: scale\(0\.96\);/.test(cssA)) F("8 · las casillas no reaccionan al pasar el mouse y al presionar");
    // §7 bis · LA CIFRA ES LA PROTAGONISTA (26-nov-2026, lámina 5d): 28 px en el PC, 26 en el teléfono, 20 plegada. El defecto que se fija
    // es la CASCADA: `.ex-contador-n b { font-size: 17px }` le ganaba a `.ex-contador-big` sola y la cifra quedaba del tamaño del texto.
    // Sin comentarios: el acta del CSS nombra la regla vieja, y un regex sobre el archivo crudo la confundiría con una regla viva.
    { const cssN = leer("src/app/explorar/explorar.css").replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\.ex-contador-n b \{[^}]*font-size/.test(cssN) || !/\.ex-contador-n \.ex-contador-big \{ font-size: 28px;[^}]*color: var\(--chip-v-c/.test(cssN)) F("7 · la cifra del contador no queda a 28 px en azul (una regla más específica le gana)");
      const i26 = cssN.indexOf("@media (max-width: 767px) { .ex-contador-n .ex-contador-big { font-size: 26px; } }"), i20 = cssN.indexOf('.ex-contador[data-plegada="1"] .ex-contador-n .ex-contador-big { font-size: 20px; }');
      if (i26 < 0 || i20 < 0 || i26 > i20) F("7 · la cifra no baja a 26 px en el teléfono o a 20 px plegada (o el teléfono le gana a la plegada)");
      if (!/\.ex-contador-n span \{ font-size: 14px; color: var\(--franco-text\); \}/.test(cssN)) F("7 · «de N deptos convienen» no va en el tamaño de texto normal"); }
    // §12 · PLEGABLE: la flecha con nombre («Plegar»/«Desplegar»), botón (teclado), y el navegador lo recuerda.
    if (!/<button type="button" class="ex-contador-pliegue" aria-expanded="true" aria-label="Plegar"/.test(html)) F("12 · falta la flecha «Plegar» como botón con nombre accesible");
    const cont = codigo("src/app/explorar/contador.tsx");
    if (!/localStorage\.getItem\(CLAVE_CONTADOR_PLEGADO\) === "1"\) setPlegada\(true\)/.test(cont) || !/localStorage\.setItem\(CLAVE_CONTADOR_PLEGADO, x \? "0" : "1"\)/.test(cont)) F("12 · el navegador no recuerda si la tarjeta quedó plegada");
    if (!/\{!plegada && \(/.test(cont) || !/aria-label=\{plegada \? CONTADOR_COPY\.desplegar : CONTADOR_COPY\.plegar\}/.test(cont)) F("12 · plegada no deja solo la línea del número, o la flecha no cambia a «Desplegar»");
  }
  // §9 y §10 · la (i) vuelve a la barra de arriba (texto en el PC, ícono en el teléfono) y «Ver lista» flota abajo al centro.
  if (!/data-explorar="filtros"[\s\S]{0,600}?<button type="button" className="ex-como2" data-explorar="como-se-calcula"/.test(cli)) F("9 · «¿Cómo se calcula?» no está en la barra, junto a Filtros");
  if (!/\.ex-como2-t \{ display: none; \}/.test(leer("src/app/explorar/explorar.css")) || !/@media \(min-width: 768px\) \{ \.ex-como2-t \{ display: inline; \} \}/.test(leer("src/app/explorar/explorar.css"))) F("9 · en el teléfono «¿Cómo se calcula?» no queda solo con el ícono");
  if (!/<button type="button" className="ex-ver-lista" data-explorar="ver-lista" onClick=\{\(\) => setVista\("lista"\)\}>/.test(cli) || !/\.ex-ver-lista \{ position: absolute; left: 50%;[^}]*background: #141414;/.test(leer("src/app/explorar/explorar.css"))) F("10 · «Ver lista» no flota abajo al centro como botón negro");
  {
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
  // ACTA 26-nov-2026 (cambio 2 de la revisión): antes la etiqueta la conservaba el de mejor puntaje sin importar la clase; ahora primero
  // Comprar, después Ajustar (y dentro de cada clase, el mejor puntaje); No conviene solo si hay espacio.
  if (etq.join() !== "bajo") F(`2 · al chocar, la etiqueta no la lleva el Comprar antes que el Ajustar (etiquetas: ${etq.join() || "ninguna"})`);
  const solo = cc.componerCapa([{ id: "no", lat: -33.45, lng: -70.65, clase: "no", texto: "UF 3.000", puntaje: null }], { zoom: 16, elegido: null, aPixel: aPx, ancho: () => 50, vista: { w: 400, h: 400 } });
  if (!solo.some((d) => d.tipo === "etiqueta")) F("2 · un No conviene sin choques no lleva su precio aunque haya espacio");
  // §1 · A MEDIA DISTANCIA, PUNTOS DE COLOR SIN PRECIO (los rojos abajo): ni grupos negros ni etiquetas.
  const media = cc.componerCapa([
    { id: "c", lat: -33.45, lng: -70.65, clase: "comprar", texto: "x", puntaje: 1 },
    { id: "n", lat: -33.45, lng: -70.65, clase: "no", texto: "x", puntaje: null },
  ], { zoom: 14, elegido: null, aPixel: aPx, ancho: () => 20, vista: { w: 400, h: 400 } });
  if (media.length !== 2 || media.some((d) => d.tipo !== "punto") || (media[1] as { id: string }).id !== "c") F("1 · a media distancia no van puntos de color sin precio, con los Comprar encima");
  if (cc.ZOOM_PUNTOS !== 13 || cc.ZOOM_CIFRAS !== 16) F("1 · las tres distancias no son grupos ≤ 12, puntos 13-15 y precio desde 16");
  // §3 · ABRE ENCUADRADO EN GRAN SANTIAGO: la caja sin el 2 % más extremo de cada lado.
  const muchos = [...Array.from({ length: 98 }, (_, i) => ({ lat: -33.45 + i * 1e-3, lng: -70.65 })), { lat: -33.7, lng: -71.2 }, { lat: -33.2, lng: -70.3 }];
  const caja3 = cc.cajaRecortada(muchos);
  if (!caja3 || caja3.w < -70.7 || caja3.s < -33.5) F("3 · el encuadre incluye los avisos sueltos (Melipilla, la cordillera)");
  if (!/const caja = cajaRecortada\(ps\) \?\? CAJA_GRAN_SANTIAGO;/.test(codigo("src/app/explorar/mapa-explorar.tsx"))) F("3 · el mapa no abre con la caja recortada de Gran Santiago");
  // §11 · EL TEXTO DE «¿CÓMO SE CALCULA?» (26-nov-2026): el pedido, con pie, plazo, tasa y el 10 % de la misma fuente que el mapa.
  const tc = mt.textoComoSeCalcula(4.07, true);
  if (tc.intro !== "Cada noche Franco revisa los deptos usados en venta en Gran Santiago y calcula si convienen como inversión, con pie de 20 %, crédito a 30 años y tasa de 4,1 % (el promedio del Banco Central). Con tu cuenta gratis cambias eso en Filtros.") F(`11 · el texto de «¿Cómo se calcula?» no es el pedido: «${tc.intro}»`);
  if (tc.clases.map((k) => `${k.nombre}: ${k.texto}`).join(" | ") !== "Comprar: conviene al precio publicado. | Ajustar: conviene negociando hasta 10 % menos. La tarjeta dice desde qué precio. | No conviene: ni al precio publicado ni con 10 % menos.") F("11 · las tres líneas de los veredictos no son las pedidas");
  if (`${tc.capRate.nombre}: ${tc.capRate.texto} ${tc.rentaCorta.nombre}: ${tc.rentaCorta.texto}` !== "Cap rate bruto: el arriendo de un año dividido por el precio. En los detalles del depto ves también el neto, que descuenta gastos. Renta corta: se estima por zona, no por depto.") F("11 · la línea del cap rate bruto y la renta corta no es la pedida");
  const fuenteCalc = codigo("src/lib/explorar/mapa-todos.ts");
  if (!/con pie de \$\{PIE_POR_DEFECTO\} %, crédito a \$\{PLAZO_POR_DEFECTO\} años y \$\{t\}/.test(fuenteCalc) || !/hasta \$\{TOPE_NEGOCIAR_PCT\} % menos/.test(fuenteCalc)) F("11 · pie, plazo o el 10 % del texto están escritos a mano (no salen de las constantes del mapa)");
  if (!/const t = textoComoSeCalcula\(tasa\?\.tasa \?\? null, sinCuenta\);/.test(codigo("src/app/explorar/hoja-calculo.tsx"))) F("11 · la hoja no usa el texto con la tasa del motor");
  // §4 · «Buscar en esta zona» se fue.
  if (/data-explorar="buscar-zona"/.test(cli)) F("4 · sigue el botón «Buscar en esta zona»");
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
    // ⚠ ACTA 26-nov-2026 (la tarjeta se arma de una vez): antes fijaba la línea «2D1B · 50 m²» sola, porque el lugar llegaba del servidor
    // uno o dos segundos después (y la línea saltaba). Ahora el metro sale de la lista del repo AL INSTANTE: el primer pintado (este
    // render del servidor, sin pedido alguno) ya dice «Metro Parque Almagro» —el pin está a 163 m—; sin metro, un espacio gris del
    // tamaño del lugar mientras el barrio o la avenida llegan, y la tipología y los m² enteros en la misma fila.
    if (!/data-explorar="linea"><span class="ex-lugar" data-explorar="lugar">Metro Parque Almagro<\/span><span class="ex-linea-resto"><span class="ex-sep"> · <\/span>2D1B · 50 m²<\/span><\/span>/.test(hC)) F("7 · el primer pintado de la tarjeta no trae el metro (o la línea no lleva tipología y m²)");
    const hSinMetro = tarjeta(pin({ lat: -33.37, lng: -70.5 }));
    if (!/data-explorar="linea"><span class="ex-lugar ex-lugar-carga" aria-hidden="true" data-explorar="lugar-carga"><\/span><span class="ex-linea-resto"><span class="ex-sep"> · <\/span>2D1B · 50 m²<\/span><\/span>/.test(hSinMetro) || /data-explorar="lugar">/.test(hSinMetro)) F("7 · sin metro, la línea no le reserva el espacio al barrio o la avenida mientras llegan");
    const tarA = codigo("src/app/explorar/tarjeta-pin.tsx");
    if (!/const lugares = useLugares\(pines\.filter\(\(p\) => !metros\.get\(p\.avisoId\)\)\.map\(\(p\) => p\.avisoId\)\);/.test(tarA) || !/metroCercano\(p\.lat, p\.lng\)/.test(tarA)) F("7 · el metro no sale de la lista del repo (o se le sigue pidiendo al servidor a los que tienen metro)");
    // La reserva no queda para siempre: un pedido fallido o cortado por el tope suelta el espacio (null, no undefined).
    if (!/signal: corte\.signal/.test(tarA) || !/window\.setTimeout\(\(\) => corte\.abort\(\), TOPE_LUGAR_MS\)/.test(tarA) || !/\.catch\(\(\) => \{ for \(const id of faltan\) lugaresFallidos\.add\(id\);/.test(tarA) || !/lugaresFallidos\.has\(id\) \? null : undefined/.test(tarA)) F("7 · un pedido del lugar que falla o no vuelve deja la reserva gris para siempre");
    // Quien redibuja: toda tarjeta montada al llegar la respuesta (suscripción), no solo la que pidió. La marca `montada` que la limpieza
    // apagaba para siempre dejaba la línea sin lugar o con la reserva gris tras el doble montaje de React o un cierre y reapertura.
    if (/montada\.current/.test(tarA) || !/lugaresOyentes\.add\(f\); return \(\) => \{ lugaresOyentes\.delete\(f\); \};/.test(tarA) || (tarA.match(/avisarLugares\(\);/g) ?? []).length < 2) F("7 · la respuesta del lugar no redibuja a las tarjetas montadas (se pierde si la tarjeta se volvió a montar)");
    const cssT = leer("src/app/explorar/explorar.css").replace(/\/\*[\s\S]*?\*\//g, "");
    // ⚠ ACTA 26-nov-2026 (revisión de Fabrizio en el celular: «Metro Cri…», «Sector Vati…»): antes se fijaba UNA sola fila con el lugar
    // cortado con «…»; ahora el lugar va ENTERO y, si no cabe junto a la tipología y los m², ellos bajan a su propia línea. Se exige: la
    // fila envuelve, el lugar no se encoge (solo se corta si ni en su propia línea cabe), y el « · » se recorta al envolver (mide 1em y
    // el resto arranca 1em antes, dentro de una línea que recorta lo que se sale). La reserva gris del barrio sigue.
    if (!/\.ex-linea-lugar \{ display: flex; flex-wrap: wrap; align-items: baseline; min-width: 0; overflow: hidden; white-space: nowrap; \}/.test(cssT) || !/\.ex-lugar \{ flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; margin-right: 1em; \}/.test(cssT) || !/\.ex-lugar-carga \{ display: inline-block; flex: none; width: 8em;/.test(cssT)) F("7 · el lugar se corta en vez de pasar a su propia línea (o se perdió la reserva gris del barrio)");
    if (!/\.ex-lugar \+ \.ex-linea-resto \{ margin-left: -1em; \}/.test(cssT) || !/\.ex-sep \{ display: inline-block; width: 1em;/.test(cssT) || !/\.ex-linea-resto \{ flex: none; \}/.test(cssT)) F("7 · al bajar a su línea, la tipología arranca con « · » (o se parte)");
    // Y la línea no ensancha la tarjeta: cada tarjeta del carrusel puede quedar en su 100 %.
    if (!/\.ex-tarjeta \{ min-width: 0; \}/.test(cssT)) F("7 · un lugar largo ensancha la tarjeta más allá de la pantalla");
    // LA MINIATURA CON EL COLOR DEL PIN (26-nov-2026: un No conviene salía azul). Los tres veredictos: la tarjeta pide la imagen con la
    // letra de su clase, y el color que la ruta le da a esa letra es EL MISMO con que el canvas pinta el pin (colorPin ∘ claseDePin).
    {
      const calleM = cargar<{ claseDeImagen: (v: string | null) => string }>("src/lib/explorar/calle", F);
      const coloresM = cargar<{ colorPin: (c: string, t: string) => { fondo: string } }>("src/lib/explorar/colores-pin", F);
      const negM = cargar<{ claseDePin: (p: po.PinMapa) => string }>("src/lib/explorar/capa-negociar", F);
      const casos: Array<[string, po.PinMapa, string | null]> = [
        ["Comprar", pin(), null],
        ["Ajustar", { ...pin({ veredicto: "AJUSTA SUPUESTOS", flujo: -45000 }), neg: { d: 3.2, p: 2810, s: 70, f: 1 } } as po.PinMapa, "a"],
        ["No conviene", pin({ veredicto: "BUSCAR OTRA", score: null, flujo: null, arriendo: null }), "n"],
      ];
      if (calleM && coloresM && negM) for (const [nombre, p, letra] of casos) {
        const src = /<img [^>]*src="([^"]+)"/.exec(tarjeta(p))?.[1]?.replace(/&amp;/g, "&") ?? "";
        const v = new URLSearchParams(src.split("?")[1] ?? "").get("v");
        const deLaImagen = coloresM.colorPin(calleM.claseDeImagen(v), "claro").fondo, delPin = coloresM.colorPin(negM.claseDePin(p), "claro").fondo;
        if (!src || v !== letra || deLaImagen !== delPin) F(`7 · la miniatura de un ${nombre} no sale en el color de su pin (pide v=${v}: ${deLaImagen}, el pin es ${delPin})`);
      }
    }
    // LA FOTO: mientras carga, un gris del mismo tamaño que se ve en los dos temas, y la imagen aparece recién cargada.
    if (!/<span class="ex-img" data-explorar="imagen"><img /.test(hC)) F("7 · la imagen se pinta marcada como cargada antes de cargar");
    const imgA = codigo("src/components/guia/ImagenDepto.tsx");
    if (!/onLoad=\{\(\) => setCargada\(src\)\}/.test(imgA) || !/if \(el\?\.complete && el\.naturalWidth > 0\) setCargada\(src\);/.test(imgA) || !/data-cargada=\{cargada === src \? "1" : undefined\}/.test(imgA)) F("7 · la imagen no avisa cuándo cargó (ni mira la que ya estaba en la caché)");
    if (!/\[data-explorar="imagen"\]:not\(\[data-cargada="1"\]\) img \{ opacity: 0; \}/.test(cssT) || !/\.ex-img \{[^}]*width: 96px; height: 96px;[^}]*background: color-mix\(in srgb, var\(--franco-text\) 12%, var\(--franco-card\)\); \}/.test(cssT)) F("7 · mientras carga la foto no hay un gris visible del mismo tamaño");
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
    // ACTA 26-nov-2026 (cambio 5): antes cuatro «Crea tu cuenta gratis para filtrar por…»; ahora una sola línea.
    if ((h8.match(/data-explorar="barras-con-cuenta"/g) ?? []).length !== 1 || !h8.includes("Con tu cuenta gratis filtras también por arriendo, cap rate, lo que te sobra y UF por m²") || /data-explorar="barra-[a-z0-9]+-cuenta"/.test(h8) || !/data-explorar="barra-precio-min"/.test(h8) || /data-explorar="barra-arriendo"/.test(h8)) F("8 · sin cuenta, el panel no deja solo precio (y dormitorios) con una sola línea que pide la cuenta");
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
  // §13 · EN EL TELÉFONO (26-nov-2026, revisión de Fabrizio en celular; bajo 768 px). Una prueba por pedido.
  {
    const cssM = leer("src/app/explorar/explorar.css").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
    const iMed = cssM.indexOf("@media (max-width: 767px) {\n  .ex-capa { display: none; }"), medM = iMed < 0 ? "" : cssM.slice(iMed, cssM.indexOf("\n}", iMed));
    const mapaC = codigo("src/app/explorar/mapa-explorar.tsx");
    // 1 · «Mapa | Satélite» se vuelve un botón redondo de 40 px con capas, «Tipo de mapa», que abre las dos opciones; en el PC, la píldora.
    const modMapa = cargar<{ ConmutadorCapa: FC<Record<string, unknown>> }>("src/app/explorar/mapa-explorar", F);
    if (modMapa) {
      const hCapa = renderToStaticMarkup(createElement(modMapa.ConmutadorCapa, { capa: "mapa", alCambiar: () => {} }));
      if (!/<div class="ex-capa" role="radiogroup"[^>]*data-explorar="capa-mapa">/.test(hCapa) || !/<button type="button" class="ex-capa-boton" aria-label="Tipo de mapa" aria-haspopup="true" aria-expanded="false" aria-controls="ex-capa-menu" data-explorar="capa-boton"><svg/.test(hCapa) || /data-explorar="capa-menu"/.test(hCapa)) F("13.1 · no está el botón «Tipo de mapa» (cerrado, con su ícono) junto a la píldora del PC");
    }
    if (!/\.ex-capa-movil \{ display: none;/.test(cssM) || !/\.ex-capa-boton \{ width: 40px; height: 40px;[^}]*border-radius: 999px;/.test(cssM) || !/\.ex-capa \{ display: none; \}/.test(medM) || !/\.ex-capa-movil \{ display: block; \}/.test(medM)) F("13.1 · bajo 768 px no se cambia la píldora por el botón redondo de 40 px (o en el PC se ven los dos)");
    if (!/onClick=\{\(\) => \{ alCambiar\(c\); cerrar\(true\); \}\}/.test(mapaC) || !/document\.addEventListener\("pointerdown", fuera, true\)/.test(mapaC) || !/if \(e\.key === "Escape"\) \{ e\.stopPropagation\(\); cerrar\(true\); \}/.test(mapaC) || !/e\.key !== "ArrowDown" && e\.key !== "ArrowUp"/.test(mapaC)) F("13.1 · las opciones no se cierran al elegir, al tocar fuera o con Escape (o no se recorren con las flechas)");
    // 2 · sin Proyectos, el selector «Usados» (una sola opción) no se muestra; vuelve con los proyectos.
    // ⚠ ACTA 26-nov-2026 (segunda vuelta, pedido de Fabrizio): primero se sacaba solo en el teléfono (la regla iba dentro del bloque de
    // bajo 768 px); ahora tampoco en el PC. Se exige la regla FUERA de todo @media —vale para los dos tamaños— y que no quede encerrada
    // en el del teléfono.
    { const sinMedia = cssM.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
      if (!/data-explorar="selector" data-una-opcion=\{PROYECTOS_VISIBLE \? undefined : "1"\}/.test(cli) || !/\.ex-selector\[data-una-opcion="1"\] \{ display: none; \}/.test(sinMedia) || /\.ex-selector\[data-una-opcion/.test(medM)) F("13.2 · sin Proyectos, el selector «Usados» se sigue mostrando (en el teléfono o en el PC)"); }
    // 3 · sin el más y el menos en el teléfono (se acerca con dos dedos), sí en el PC, siguiendo al ancho.
    if (!/const MEDIA_TELEFONO = "\(max-width: 767px\)";/.test(mapaC) || !/zoomControl: !esTelefono\(\)/.test(mapaC) || !/map\.setOptions\(\{ zoomControl: !telefono\.matches \}\)/.test(mapaC)) F("13.3 · el zoom del mapa no se va en el teléfono (o no vuelve en el PC)");
    // 4 · sin Street View ni pantalla completa, en los dos anchos: en el mapa y en la vista de calle que Google le monta adentro.
    if (!/streetViewControl: false, fullscreenControl: false/.test(mapaC) || !/map\.getStreetView\(\)\?\.setOptions\(\{ fullscreenControl: false/.test(mapaC)) F("13.4 · el mapa deja los controles de Street View o de pantalla completa");
    // 5 · con la tarjeta de un depto abierta en el teléfono, el contador se ve plegado sin tocar lo elegido, y «Ver lista» no va.
    if (modCont) {
      const conTar = renderToStaticMarkup(createElement(modCont.Contador, { conteo: { comprar: 4513, ajustar: 3016, no: 11527 }, ocultar: [], alAlternar: () => {}, plegarPorTarjeta: true }));
      const sinTar = renderToStaticMarkup(createElement(modCont.Contador, { conteo: { comprar: 4513, ajustar: 3016, no: 11527 }, ocultar: [], alAlternar: () => {}, plegarPorTarjeta: false }));
      if (!/data-explorar="contador" data-plegada="1"/.test(conTar) || /data-explorar="chip-comprar"/.test(conTar) || /data-plegada="1"/.test(sinTar) || !/data-explorar="chip-comprar"/.test(sinTar)) F("13.5 · con la tarjeta abierta el contador no se ve plegado (o sin tarjeta no vuelve abierto)");
    }
    const contM = codigo("src/app/explorar/contador.tsx");
    if (!/const plegada = plegarPorTarjeta \? !abiertaConTarjeta : elegida;/.test(contM) || !/const alternarPliegue = \(\) => plegarPorTarjeta \? setAbiertaConTarjeta\(\(x\) => !x\) : setPlegada\(/.test(contM)) F("13.5 · plegarse por la tarjeta cambia lo que eligió la persona (o la flecha no la abre mientras dure la tarjeta)");
    if (!/plegarPorTarjeta=\{!!tarjeta && esTelefono\}/.test(cli) || !/window\.matchMedia\("\(max-width: 767px\)"\)/.test(cli) || !/\{tarjeta \? \(\s*<TarjetaPin[\s\S]*?\) : vista === "mapa" && \([\s\S]{0,400}?<button type="button" className="ex-ver-lista"/.test(cli)) F("13.5 · el contador no se pliega con la tarjeta abierta en el teléfono, o «Ver lista» sigue con la tarjeta abierta");
  }
  // §14 · LA TARJETA ES UNA HOJA ABAJO EN EL TELÉFONO (26-nov-2026, revisión de Fabrizio en el celular: flotaba en la mitad, tapaba el
  // mapa y costaba cerrarla). Pegada al borde inferior, sube desde abajo; se cierra con la X de 44 px «Cerrar», deslizándola hacia abajo
  // o tocando el mapa; el pin elegido queda visible arriba de ella. En el PC, la tarjeta flotante de siempre.
  {
    const cssH = leer("src/app/explorar/explorar.css").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
    const iH = cssH.indexOf("@media (max-width: 767px) {\n  .ex-tarjeta-wrap { left: 0;"), medH = iH < 0 ? "" : cssH.slice(iH, cssH.indexOf("\n}", iH));
    const tarH = codigo("src/app/explorar/tarjeta-pin.tsx"), mapaH = codigo("src/app/explorar/mapa-explorar.tsx");
    if (!/<div class="ex-hoja-cab"><span class="ex-hoja-asa" aria-hidden="true"><\/span><button type="button" class="ex-hoja-cerrar" aria-label="Cerrar" data-explorar="cerrar-tarjeta"><svg/.test(hC) || !/data-explorar="cerrar-tarjeta" onClick=\{alCerrar\}>/.test(tarH)) F("14 · la hoja no trae su asa y la X «Cerrar» que la cierra");
    if (!/\.ex-hoja-cab \{ display: none; \}/.test(cssH) || !/\.ex-tarjeta-wrap \{ left: 0; right: 0; bottom: 0;[^}]*border-radius: 18px 18px 0 0;[^}]*touch-action: pan-x;[^}]*animation: ex-hoja-sube/.test(medH) || !/\.ex-hoja-cerrar \{[^}]*width: 44px; height: 44px;/.test(medH) || !/\.ex-hoja-cab \{[^}]*display: flex;[^}]*height: 44px; \}/.test(medH) || !/@keyframes ex-hoja-sube \{ from \{ transform: translateY\(100%\); \}/.test(cssH)) F("14 · en el teléfono la tarjeta no es una hoja pegada abajo que sube, con la X de 44 px (o en el PC aparece su cabecera)");
    if (!/a\.vertical = Math\.abs\(dy\) > Math\.abs\(dx\);/.test(tarH) || !/soltar\(!!a\.vertical && a\.dy > CIERRE_DESLIZAR_PX\)/.test(tarH) || !/el\.style\.transform = `translateY\(\$\{a\.dy\}px\)`;/.test(tarH) || !/if \(esTelefonoAhora\(\)\) arrastre\.current = /.test(tarH)) F("14 · la hoja no se cierra deslizándola hacia abajo (o el deslizar choca con el carrusel, o corre en el PC)");
    if (!/onTocarMapa=\{\(\) => setSel\(null\)\}/.test(cli)) F("14 · tocar el mapa no cierra la tarjeta");
    // El pin elegido, arriba de la hoja: la tarjeta dice su alto, el mapa lo recibe en el teléfono y se corre si el pin queda tapado —ahora y
    // al terminar cada movimiento mientras quede pendiente, también después de encuadrar—.
    if (!/alMedir=\{setAltoTarjeta\}/.test(cli) || !/tapaAbajo=\{esTelefono && tarjeta \? altoTarjeta : 0\}/.test(cli)) F("14 · el mapa no sabe cuánto tapa la hoja");
    if (!/const arriba = TAPA_ARRIBA_PX, abajo = div\.clientHeight - tapaRef\.current - AIRE_PIN_PX;/.test(mapaH) || !/map\.panBy\(0, Math\.round\(px\.y - \(arriba \+ abajo\) \/ 2\)\);/.test(mapaH) || !/if \(pendienteVisible\.current > 0\) \{ pendienteVisible\.current -= 1; if \(asegurarVisible\(\) === "ok"\) pendienteVisible\.current = 0; \}/.test(mapaH) || !/pendienteVisible\.current = INTENTOS_VISIBLE;\s*const f = focoRef\.current;\s*if \(f\) \{ map\.setCenter\(f\)/.test(mapaH)) F("14 · el pin elegido puede quedar tapado por la hoja (el mapa no se corre, o no vuelve a revisar después de encuadrar)");
    // Y la hoja mide lo que la tarjeta elegida, no lo que la más alta del carrusel (sin hueco abajo).
    if (!/el\.style\.height = `\$\{elegida\.offsetHeight\}px`;/.test(tarH) || !/\.ex-tarjeta-wrap \.ex-tarjetas \{ align-items: flex-start; overflow-y: hidden;/.test(medH)) F("14 · la hoja queda con un hueco abajo (el carrusel mide lo que la tarjeta más alta)");
  }
  // §15 · LA CIFRA DE LOS PINES, CON FORMATEADORES COMPARTIDOS (26-nov-2026, entrega 2 › A1). En un celular, armar un formateador por
  // pin costaba 1.076 ms de los 3,9 s hasta ver los pines. Dos exigencias: la salida es IDÉNTICA a la de `toLocaleString` (la referencia
  // va acá, escrita a mano) y las funciones que corren una vez por pin no vuelven a llamar `toLocaleString`.
  {
    const ref = {
      miles: (n: number) => Math.round(n).toLocaleString("es-CL"),
      monto: (n: number) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1_000_000 ? `${s}$${(Math.round(a / 100_000) / 10).toLocaleString("es-CL")} MM` : a >= 1000 ? `${s}$${Math.round(a / 1000).toLocaleString("es-CL")} mil` : `${s}$${Math.round(a).toLocaleString("es-CL")}`; },
      cap: (c: number) => `${c.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
    };
    const precios = [0, 7, 999, 1000, 1150, 1590.4, 2810, 4513, 10119, 19052, 32006, 123456.7];
    const montos = [-1_250_000, -541_439, -999, 0, 450, 1000, 20_457, 142_264, 865_000, 1_000_000, 1_950_000, 12_345_678];
    for (const n of precios) if (mt.textoCifraPin({ precioUF: n, m2: 50, arriendo: null, flujo: null }, "comprar", "precio", 38000) !== `UF ${ref.miles(n)}`) F(`15 · el precio del pin cambió de formato (${n})`);
    for (const n of montos) if (mt.montoCorto(n) !== ref.monto(n)) F(`15 · un monto corto cambió de formato (${n}: «${mt.montoCorto(n)}» en vez de «${ref.monto(n)}»)`);
    for (const [arr, uf] of [[520000, 2800], [865000, 4591], [300000, 9000], [1_200_000, 3000]] as const) {
      const c = mt.capParaTramo(arr, uf, 38000);
      if (c != null && mt.textoCifraPin({ precioUF: uf, m2: 50, arriendo: arr, flujo: 1 }, "comprar", "cap", 38000) !== ref.cap(c)) F(`15 · el cap rate del pin cambió de formato (${arr}/${uf})`);
    }
    const c3 = { comprar: 4531, ajustar: 3012, no: 11509 };
    if (mt.textoContador(c3).numero !== "4.531" || mt.textoContador(c3).resto !== "de 19.052 deptos convienen") F("15 · el contador cambió de formato");
    const mtC = codigo("src/lib/explorar/mapa-todos.ts"), ccC = codigo("src/lib/explorar/capa-canvas.ts");
    const cuerpo = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); return i < 0 ? "" : src.slice(i, src.indexOf(hasta, i + desde.length)); };
    const caliente = [cuerpo(mtC, "const miles =", "\n"), cuerpo(mtC, "export function montoCorto", "\n}"), cuerpo(mtC, "export function textoCifraPin", "\n}")];
    if (caliente.some((b) => !b) || caliente.some((b) => /toLocaleString\(/.test(b)) || !/const FMT_ES = new Intl\.NumberFormat\("es-CL"\);/.test(mtC) || /c\.ids\.length\.toLocaleString/.test(ccC)) F("15 · la cifra de los pines vuelve a armar un formateador por llamada (toLocaleString)");
  }
  // §16 · EL PEDIDO PARTIDO (26-nov-2026, entrega 2 › A2). Sin `parte`, la noche trae ✓ Comprar y − Ajustar y se dibuja al tiro; con
  // `parte=no`, los No conviene (el 60 % del JSON), pedidos después del primer dibujo. Sin SQL: cada parte lee su propia entrada de caché.
  {
    const un = cargar<{ parteDelPedido: (sp: URLSearchParams) => string; conParteNo: (u: string) => string; conSello: (u: string, s: string | null) => string; urlUniverso: (f: unknown, sin: boolean) => string }>("src/lib/explorar/url-noche", F);
    const pc = cargar<{ respuestaDeLaNoche: (pie: number, plazo: number, o: Record<string, unknown>, leer: (p: number, z: number, s: string | null, parte: string) => Promise<unknown>) => Promise<Record<string, unknown>> }>("src/lib/explorar/portal-cache", F);
    if (un) {
      if (un.parteDelPedido(new URLSearchParams("m=ltr&parte=no")) !== "no" || un.parteDelPedido(new URLSearchParams("m=ltr")) !== "base" || un.parteDelPedido(new URLSearchParams("parte=todo")) !== "base") F("16 · la ruta no distingue la segunda parte (`parte=no`) de la primera");
      if (un.conSello(un.conParteNo(un.urlUniverso({ modalidad: "ltr", pie: 20, plazo: 30, tasa: null }, true)), "S1") !== "/api/explorar/abierto?m=ltr&parte=no&s=S1") F("16 · la dirección de la segunda parte no es la de la primera con `parte=no`");
    }
    if (pc) {
      const u = (n: number) => ({ comunas: ["Santiago"], filas: Array.from({ length: n }, (_, i) => [`id${i}`, 0, -33.4, -70.6, 50, 2, 1, 2800, 70, 1000, 500000, "usado", null, 1, 2, 3]) });
      const pedidas: string[] = [];
      // La lectura falsa trae los No conviene en TODAS las partes: la primera tiene que dejarlos fuera igual (si no, una mutación que los
      // devuelve no se notaría).
      const leer = async (_p: number, _z: number, _s: string | null, parte: string) => { pedidas.push(parte); return { sello: "S1", universo: parte === "no" ? { comunas: [], filas: [] } : u(3), negociados: null, noConviene: u(5) }; };
      const base = await pc.respuestaDeLaNoche(20, 30, { sinCifras: true, sello: "S1" }, leer);
      const no = await pc.respuestaDeLaNoche(20, 30, { sinCifras: true, sello: "S1", parte: "no" }, leer);
      const filasDe = (x: unknown) => ((x as { filas?: unknown[] } | undefined)?.filas ?? []).length;
      if (pedidas.join() !== "base,no") F(`16 · cada parte no lee solo su entrada (leyó: ${pedidas.join()})`);
      if ("noConviene" in base || filasDe(base.universo) !== 3) F("16 · la primera parte trae los No conviene (o pierde los Comprar)");
      if (filasDe(no.noConviene) !== 5 || filasDe(no.universo) !== 0 || no.sello !== "S1") F("16 · la segunda parte no trae solo los No conviene con el mismo sello");
      if (((no.noConviene as { filas: unknown[][] }).filas[0] ?? []).length > 13) F("16 · sin cuenta, la segunda parte trae cifras o tramos de los No conviene");
    }
    // Y cada parte lee SOLO su entrada de caché: `nocheExplorar` le pasa la parte a la lectura, y la lectura se salta la otra entrada.
    { const pcx = cargar<{ nocheExplorar: (pie: number, plazo: number, sello: string | null, f: unknown, parte: string) => Promise<unknown> }>("src/lib/explorar/portal-cache", F);
      const partes: string[] = [];
      if (pcx) await pcx.nocheExplorar(20, 30, null, { vigente: async () => 7, leerToken: () => null, token: () => "S7", deSello: async (n: number, _pie: number, _plazo: number, parte?: string) => { partes.push(parte ?? "(nada)"); return { n, universo: { comunas: [], filas: [] }, negociados: null, noConviene: null }; } }, "no");
      const srcPc = codigo("src/lib/explorar/portal-cache.ts");
      if (partes.join() !== "no" || !/parte !== "no" \? nocheDeSello\(n, pie, plazo\) : Promise\.resolve\(null\)/.test(srcPc) || !/parte !== "base" && plazo >= 30 \? noConvieneDeSello\(n, pie\)/.test(srcPc)) F(`16 · una parte lee las dos entradas de la caché (o no le llega a la lectura: ${partes.join()})`); }
    // El navegador: los No conviene quedan PENDIENTES (no «cero») hasta su parte; se piden después del primer dibujo, con el mismo sello,
    // y el encuadre no depende de ellos (no mueve el mapa al llegar).
    if (!/no: d\.noConviene \? noDe\(d\.noConviene\) : undefined/.test(cli) || !/return universo && u && u\.no \? u\.no : null;/.test(cli)) F("16 · mientras llega la segunda parte, el contador diría «No conviene · 0» (pendiente confundido con vacío)");
    if (!/const asegurarNoConviene = useCallback\(async \(clave: string, base: string\) => \{[\s\S]{0,400}?await new Promise<void>\(\(listo\) => requestAnimationFrame\(\(\) => setTimeout\(listo, 0\)\)\);[\s\S]{0,300}?fetch\(conSello\(conParteNo\(base\), selloRef\.current\)/.test(cli) || !/if \(vivo\.current\) void asegurarNoConviene\(clave, base\);/.test(cli)) F("16 · los No conviene no se piden aparte, después del primer dibujo y con el mismo sello");
    const enc = /encuadre=\{`([^`]*)`\}/.exec(cli)?.[1] ?? "";
    if (!enc || /[Nn]o\b|universoNo|visiblesNo/.test(enc)) F("16 · el encuadre depende de los No conviene: el mapa saltaría al llegar la segunda parte");
    if (!/: filtros === inicial\.filtros && inicial\.n != null && inicial\.nAjustar != null && inicial\.nNo != null \? \{ comprar: inicial\.n, ajustar: inicial\.nAjustar, no: inicial\.nNo \}/.test(cli)) F("16 · el contador no muestra sus tres números desde el HTML mientras llega la segunda parte");
  }
  // §17 · EL PEDIDO SALE JUNTO CON LA PÁGINA (26-nov-2026, entrega 2 › A3): la página precarga la primera parte con EXACTAMENTE la
  // dirección que pedirá el navegador (url-noche.ts, con el sello de la noche), sin cuenta y con cuenta; si las direcciones difirieran, el
  // navegador pediría dos veces.
  {
    const pag = codigo("src/app/explorar/page.tsx");
    if (!/preload\(conSello\(urlUniverso\(filtros, sinCuenta\), sello\), \{ as: "fetch", crossOrigin: "anonymous" \}\);/.test(pag) || !/import \{ preload \} from "react-dom";/.test(pag)) F("17 · la página no precarga la primera parte con la dirección de url-noche (como fetch, sin credenciales cruzadas)");
    if (!/if \(filtros\.modalidad === "ltr"\) precargarNoche\(filtros, true, noche\?\.sello\);/.test(pag) || !/if \(universoDeLaNoche\(filtros\)\) precargarNoche\(filtros, false, noche\?\.sello\);/.test(pag)) F("17 · la precarga no corre sin cuenta y con cuenta (o precarga lo que no es la noche)");
    if (!/fetch\(conSello\(base, selloRef\.current\), \{ cache: "default" \}\)/.test(cli) || !/const base = urlUniverso\(f, sinCuentaRef\.current\);/.test(cli)) F("17 · el navegador arma la dirección de otra forma que la página: lo precargado no se usaría");
  }
  // §18 · LAS CAPAS DE REFERENCIA (26-nov-2026, entrega 2 › B y C, lámina 5c): comunas de lejos, Metro de cerca, tenues, debajo de los
  // pines, sin toque y pedidas después de los primeros pines. Fuente: OpenStreetMap (ODbL), el crédito que ya está en el mapa.
  {
    const cr = cargar<{ ZOOMS_REFERENCIA: Record<string, { pc: readonly number[]; telefono: readonly number[] }>; capaSeVe: (c: string, z: number, t: boolean) => boolean; componerReferencias: (r: unknown, o: unknown) => { limites: unknown[]; lineas: unknown[]; estaciones: Array<{ nombre: string }>; nombres: Array<{ texto: string; tipo: string }> }; ESTACIONES_ACTIVAS: unknown[] }>("src/lib/explorar/capas-referencia", F);
    if (cr) {
      // Los zooms de la tabla aprobada, como constantes.
      const tabla: Record<string, [number[], number[]]> = { limites: [[9, 13], [9, 13]], nombresComuna: [[10, 12], [10, 11]], lineasMetro: [[13, 22], [14, 22]], estaciones: [[15, 22], [16, 22]], nombresEstacion: [[16, 22], [17, 22]] };
      for (const [capa, [pc, tel]] of Object.entries(tabla)) {
        const z = cr.ZOOMS_REFERENCIA[capa];
        if (!z || z.pc.join() !== pc.join() || z.telefono.join() !== tel.join()) F(`18 · los zooms de «${capa}» no son los de la tabla (${z ? `${z.pc}/${z.telefono}` : "falta"})`);
        for (const [t, [d, h]] of [[false, pc], [true, tel]] as const) if (!cr.capaSeVe(capa, d, t) || !cr.capaSeVe(capa, h, t) || cr.capaSeVe(capa, d - 1, t) || (h < 22 && cr.capaSeVe(capa, h + 1, t))) F(`18 · «${capa}» no aparece y desaparece en sus zooms (${t ? "teléfono" : "PC"})`);
      }
      // Lo que se compone a cada zoom, con datos chicos: una comuna, una línea, la estación Baquedano.
      const datos = { comunas: { fuente: "x", comunas: [{ n: "Providencia", e: [-33.43, -70.61], a: [[-33.40, -70.64, -33.40, -70.58, -33.46, -70.58, -33.46, -70.64]] }] }, metro: { fuente: "x", lineas: { L1: { color: "#cc0000", tramos: [[-33.437, -70.634, -33.437, -70.630]] } } } };
      const vista = { w: 1000, h: 800 };
      const aPixel = (lat: number, lng: number) => ({ x: 500 + (lng + 70.61) * 9000, y: 400 - (lat + 33.43) * 9000 });
      const comp = (zoom: number, telefono: boolean, ocupados: unknown[] = []) => cr.componerReferencias(datos, { zoom, telefono, vista, ocupados, aPixel, ancho: (t: string) => t.length * 7 });
      const z11 = comp(11, false), z12t = comp(12, true), z13 = comp(13, false), z13t = comp(13, true), z15 = comp(15, false), z16 = comp(16, false), z16t = comp(16, true), z17t = comp(17, true);
      if (!z11.limites.length || !z11.nombres.some((n) => n.texto === "PROVIDENCIA") || z11.lineas.length || z11.estaciones.length) F("18 · de lejos (zoom 11) no se ven los límites con el nombre de la comuna, o ya se ve el Metro");
      if (z12t.nombres.some((n) => n.tipo === "comuna") || !comp(12, false).nombres.some((n) => n.tipo === "comuna")) F("18 · en el teléfono el nombre de la comuna no se va antes que en el PC (zoom 12)");
      if (!z13.lineas.length || !z13.limites.length || z13.estaciones.length || z13t.lineas.length) F("18 · a zoom 13 el Metro no aparece en el PC (o ya aparece en el teléfono, o salen estaciones)");
      if (!z15.estaciones.some((s) => s.nombre === "Baquedano") || z15.nombres.some((n) => n.tipo === "estacion") || z15.limites.length) F("18 · a zoom 15 no salen las estaciones sin nombre (o siguen los límites)");
      if (!z16.nombres.some((n) => n.texto === "Baquedano") || z16t.nombres.some((n) => n.tipo === "estacion") || !z16t.estaciones.length || !z17t.nombres.some((n) => n.texto === "Baquedano")) F("18 · los nombres de estación no aparecen a 16 en el PC y a 17 en el teléfono");
      // Los nombres ceden ante los pines: con una etiqueta encima del nombre de la comuna, el nombre no va.
      const pEt = aPixel(-33.43, -70.61);
      if (comp(11, false, [{ tipo: "etiqueta", x: pEt.x, y: pEt.y, w: 120, h: 22, id: "a", clase: "comprar", texto: "UF 1", elegido: false }]).nombres.some((n) => n.tipo === "comuna")) F("18 · el nombre de una comuna tapa un pin (no le cede el lugar)");
      if ((cr.ESTACIONES_ACTIVAS as Array<{ status: string }>).some((s) => s.status !== "active") || cr.ESTACIONES_ACTIVAS.length < 100) F("18 · las estaciones no son las activas de metro-stations.ts");
    }
    // Los archivos: livianos, solo Gran Santiago (las comunas con avisos), los siete colores de OpenStreetMap y el logo intacto.
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    const leerBin = (p: string) => readFileSync(join(RAIZ, p));
    const pesos = { "public/explorar/capa-comunas.v1.json": 60 * 1024, "public/explorar/capa-metro.v1.json": 20 * 1024, "public/explorar/metro-logo.svg": 6 * 1024 };
    for (const [p, tope] of Object.entries(pesos)) { let b: Buffer | null = null; try { b = leerBin(p); } catch { /* falta */ } if (!b || b.length > tope) F(`18 · ${p} falta o pesa más de ${tope / 1024} kB`); }
    try {
      const com = JSON.parse(leerBin("public/explorar/capa-comunas.v1.json").toString("utf8")) as { fuente: string; comunas: Array<{ n: string }> };
      const disp = (require(join(RAIZ, "src/lib/comunas-disponibles")) as { COMUNAS_DISPONIBLES: readonly string[] }).COMUNAS_DISPONIBLES;
      if (com.comunas.map((c) => c.n).sort().join() !== [...disp].sort().join() || !/OpenStreetMap/.test(com.fuente)) F("18 · la capa de comunas no son exactamente las comunas con avisos (o perdió el crédito de OpenStreetMap)");
      const met = JSON.parse(leerBin("public/explorar/capa-metro.v1.json").toString("utf8")) as { fuente: string; lineas: Record<string, { color: string }> };
      const colores: Record<string, string> = { L1: "#cc0000", L2: "#ffbe2e", L3: "#83441d", L4: "#292d91", L4A: "#0099ff", L5: "#006633", L6: "#8e16a1" };
      if (Object.keys(met.lineas).sort().join() !== Object.keys(colores).sort().join() || Object.entries(colores).some(([l, c]) => met.lineas[l]?.color !== c) || !/OpenStreetMap/.test(met.fuente)) F("18 · las líneas de Metro no traen los siete colores de OpenStreetMap (o perdieron el crédito)");
    } catch { F("18 · las capas no se pueden leer como JSON"); }
    let hashLogo = ""; try { hashLogo = createHash("sha256").update(leerBin("public/explorar/metro-logo.svg")).digest("hex"); } catch { /* falta */ }
    if (!hashLogo.startsWith("f5a9feb89a293e07")) F("18 · el logo de Metro no es el archivo de Commons tal cual (se modificó o falta)");
    // El marcador: un solo módulo con la constante; el logo chico y sin tocar; el neutro a una línea.
    const mk = codigo("src/lib/explorar/marcador-estacion.ts");
    if (!/export const MARCADOR_ESTACION: "logo" \| "neutro" = "logo";/.test(mk) || !/if \(MARCADOR_ESTACION === "logo" && logo/.test(mk) || !/ctx\.arc\(x, y, RADIO_NEUTRO_PX, 0, Math\.PI \* 2\);/.test(mk) || !/export const ANCHO_LOGO_PX = 18;/.test(mk) || /filter|globalCompositeOperation|fillStyle = .*\n\s*ctx\.drawImage/.test(mk)) F("18 · el marcador de estación no está en un solo módulo con su constante (o el logo se modifica)");
    for (const archivo of ["src/app/explorar/mapa-explorar.tsx", "src/app/explorar/explorar-cliente.tsx", "src/app/explorar/tarjeta-pin.tsx", "src/lib/explorar/capa-canvas.ts"]) if (/metro-logo\.svg|drawImage/.test(codigo(archivo))) F(`18 · ${archivo} dibuja el logo por su cuenta (debe pasar por marcador-estacion.ts)`);
    // En el mapa: debajo de los pines (se pintan antes que ellos), pedidas después del primer dibujo con pines, y fuera del toque.
    const mpC = codigo("src/app/explorar/mapa-explorar.tsx");
    if (!/pintarReferencias\(ctx, componerReferencias\(refs, [\s\S]{0,400}?\} else if \(dibujos\.length > 0 && !refsPedidas\.current\) \{\s*refsPedidas\.current = true;\s*window\.setTimeout\(\(\) => \{ void cargarReferencias\(\)/.test(mpC) || !/window\.setTimeout\(\(\) => \{ void cargarReferencias\(\)[\s\S]{0,200}?\}, 0\);\s*\}\s*dibujosRef\.current = dibujos;\s*pintar\(ctx, dibujos, temaPin\(\)\);/.test(mpC)) F("18 · las capas no van debajo de los pines, o se piden antes del primer dibujo con pines");
    { const ccS = codigo("src/lib/explorar/capa-canvas.ts"), iT = ccS.indexOf("export function tocado"), tc = iT < 0 ? "" : ccS.slice(iT, ccS.indexOf("\n}", iT));
      if (!tc || /[Rr]eferencia|limites|estacion|lineas/.test(tc) || !/tocado\(dibujosRef\.current/.test(mpC)) F("18 · el toque mira las capas de referencia (no se pueden tocar)"); }
    if ((mpC.match(/pintarReferencias\(/g) ?? []).length !== 2) F("18 · las capas se pintan más de una vez (o encima de los pines)");
    if (!/CREDITO_OSM/.test(mpC)) F("18 · el mapa perdió el crédito de OpenStreetMap");
  }
  // El cap rate del tramo es el de la tarjeta.
  const capT = mt.capParaTramo(520000, 2800, 38000), capC = capRatePct(520000, 2800, 38000);
  if (capT == null || capC == null || Math.abs(capT - capC) > 0.005) F(`tramos · el cap rate del tramo (${capT}) no es el de la tarjeta (${capC})`);

  // ACTA (25-nov-2026): verificado EN ROJO mutando el código que vigila —el resultado de cada mutación, en el reporte del goal—.
  console.log(fallas.length ? fallas.map((f) => `  ✗ ${f}`).join("\n") : "  ✓ las once decisiones y los tramos");
  return { hard: fallas.length };
}

if (require.main === module) runExplorarTodosTier().then((r) => process.exit(r.hard ? 1 : 0));
