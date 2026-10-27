// ============================================================================
// TIER PUBLICACION-PORTADA — el enlace a la publicación, visible en la portada de todo informe que salió de un aviso
// (27-oct-2026, decisión de Fabrizio)
//
//   El caso: un cliente pagó el pack el 26-oct. El pop-up de antes de analizar le prometía «El informe incluye el enlace a
//   la publicación», y el enlace solo llegaba si tocaba «Quiero verlo» y abría el correo. Desde hoy:
//   1 · CON INFORMES REALES DE LA SELECCIÓN: los últimos informes de renta larga y de renta corta hechos desde un aviso
//       (`input_data.origenAviso`) pasan por la MISMA función que usa la página (`publicacionDelInforme`), y la portada se
//       DIBUJA con lo que devuelve: en la fila de «Ficha del depto» tiene que haber <a href=[la publicación]>Ver la
//       publicación</a>, en otra pestaña. Cero informes de la selección con enlace = falla: un cero que no distingue «no
//       corrió» no es un verde.
//   2 · LA PÁGINA LO LEE Y LO PASA: informe-ltr.tsx e informe-str.tsx llaman a `publicacionDelInforme` y lo pasan tal cual
//       (no `null`), y los dos clientes se lo dan a la portada. Que la prop exista en cada eslabón lo exige tsc: es
//       obligatoria en PortadaInforme, SubjectCardGrid, PremiumResults y STRResultsClient.
//   3 · DESPUBLICADO: la portada lo dice («Ya no está publicado»), sin enlace. Sin aviso: la fila queda como antes.
//   4 · EL BOTÓN DE ABAJO DICE «Mandármelo por correo» (antes «Quiero verlo»).
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/publicacion-portada-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { PortadaInforme } from "../../../src/components/analysis/portada/PortadaInforme";
import { avisoDelInforme, publicacionDelInforme, type PublicacionPortada } from "../../../src/lib/guia/publicacion-portada";
import { INFORME_DE_AVISO, PUBLICACION_PORTADA } from "../../../src/lib/guia/copy";

// tsx compila el JSX de los componentes al React clásico: `React` tiene que existir en el ámbito global.
(globalThis as unknown as { React: typeof React }).React = React;

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const escaparAtributo = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** El elemento JSX `<Nombre …>` entero, desde `<Nombre` hasta el `>` que lo cierra FUERA de toda llave (los `=>` y los
 *  `Record<…>` de los valores quedan adentro de llaves). "" si no está. */
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

/** Los atributos de PRIMER nivel de un elemento JSX (`nombre={valor}`), con su valor crudo: un `publicacion={…}` metido
 *  dentro del valor de otro atributo no cuenta. */
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

/** Las claves de PRIMER nivel del objeto literal que empieza en `inicio` (`const x = {`), sin lo anidado. */
function clavesObjeto(src: string, inicio: string): string {
  const i = src.indexOf(inicio);
  if (i < 0) return "";
  let prof = 0, plano = "";
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    const c = src[j];
    if (c === "{" || c === "(" || c === "[") prof++;
    else if (c === "}" || c === ")" || c === "]") { prof--; if (prof === 0) return plano; }
    else if (prof === 1) plano += c;
  }
  return "";
}

/** Cuántos informes por modalidad: los más recientes hechos desde un aviso. */
const POR_MODALIDAD = 4;

/** La portada dibujada con una publicación dada (lo demás, mínimo: no es lo que se mide). */
function dibujarPortada(publicacion: PublicacionPortada, modalidadLabel: string): string {
  return renderToStaticMarkup(createElement(PortadaInforme, {
    veredicto: "COMPRAR", score: 80, direccion: "", comuna: "Las Condes", modalidadLabel, fecha: "27 oct 2026",
    titular: null, cifra: null, ficha: { titulo: "Las Condes", sub: null, grupos: [], ufValue: 39000 },
    publicacion, currency: "CLP", onCurrencyChange: () => {}, mapa: null,
  }));
}

/** La fila de «Ficha del depto»: el `<div>` más cercano que contiene el botón de la ficha, hasta su cierre (adentro solo
 *  hay botón, enlace o texto). Se ubica por la FICHA, no por una marca propia: el enlace tiene que estar junto a ella.
 *  "" si la portada no tiene la ficha. */
function filaUtilidades(html: string): string {
  const i = html.indexOf("Ficha del depto");
  if (i < 0) return "";
  const ini = html.lastIndexOf("<div", i), fin = html.indexOf("</div>", i);
  return ini < 0 || fin < 0 ? "" : html.slice(ini, fin);
}

/** ¿La fila lleva la ficha y, junto a ella, el enlace a ESTA url en otra pestaña? Devuelve el porqué si no. */
function faltaEnlace(fila: string, url: string): string | null {
  if (!fila) return "la portada no tiene la fila de «Ficha del depto»";
  if (!fila.includes("Ficha del depto")) return "la fila no tiene «Ficha del depto»";
  const a = fila.match(/<a\b[^>]*>[^<]*<\/a>/g)?.find((x) => x.includes(`href="${escaparAtributo(url)}"`));
  if (!a) return `la fila no tiene un enlace a ${url}`;
  if (!a.includes(PUBLICACION_PORTADA.enlace)) return `el enlace no dice «${PUBLICACION_PORTADA.enlace}»`;
  if (!/target="_blank"/.test(a) || !/rel="[^"]*noopener/.test(a)) return "el enlace no abre en otra pestaña con noopener";
  return null;
}

export async function runPublicacionPortadaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PUBLICACION-PORTADA (el enlace a la publicación en la portada de todo informe hecho desde un aviso, «Mandármelo por correo» · 0 tokens) ───");

  // ── 3 · los tres estados de la fila, con la función pura y la portada dibujada ──
  const URL_X = "https://ejemplo.cl/aviso/123?a=1&b=2";
  const conEnlace = filaUtilidades(dibujarPortada({ url: URL_X, despublicado: false }, "Renta larga"));
  const porque = faltaEnlace(conEnlace, URL_X);
  if (porque) F(`3 · con una publicación viva: ${porque}`);
  const baja = filaUtilidades(dibujarPortada({ url: URL_X, despublicado: true }, "Renta larga"));
  if (/<a\b/.test(baja) || !baja.includes(PUBLICACION_PORTADA.baja) || !baja.includes("Ficha del depto")) F("3 · despublicado: la portada lleva el enlace o no dice «Ya no está publicado» junto a la ficha");
  const sinAviso = filaUtilidades(dibujarPortada(null, "Renta larga"));
  if (!sinAviso.includes("Ficha del depto") || sinAviso.includes(PUBLICACION_PORTADA.enlace) || sinAviso.includes(PUBLICACION_PORTADA.baja)) F("3 · sin aviso la fila no queda como antes (solo la ficha)");
  if (avisoDelInforme({ origenAviso: { avisoId: "abc" } }) !== "abc" || avisoDelInforme({}) !== null || avisoDelInforme(null) !== null || avisoDelInforme({ origenAviso: { avisoId: 7 } }) !== null) F("3 · avisoDelInforme no lee `input_data.origenAviso.avisoId`");

  // ── 4 · el botón de abajo ──
  if (INFORME_DE_AVISO.boton !== "Mandármelo por correo") F(`4 · el botón dice «${INFORME_DE_AVISO.boton}», no «Mandármelo por correo»`);
  if (PUBLICACION_PORTADA.enlace !== "Ver la publicación" || PUBLICACION_PORTADA.baja !== "Ya no está publicado") F("4 · el copy del enlace de la portada no es el pedido");

  // ── 2 · la página lo lee y lo pasa; los clientes se lo dan a la portada ──
  const ltr = codigo("src/app/analisis/[id]/informe-ltr.tsx"), str = codigo("src/app/analisis/renta-corta/[id]/informe-str.tsx");
  const LEE = /const publicacion = await publicacionDelInforme\(createServiceClient\(\), (inputDataRaw|data\.input_data)\);/;
  if (!LEE.test(ltr)) F("2 · informe-ltr.tsx no lee la publicación con publicacionDelInforme y el input del informe");
  if (!LEE.test(str)) F("2 · informe-str.tsx no lee la publicación con publicacionDelInforme y el input del informe");
  if (atributosJsx(elementoJsx(ltr, "PremiumResults")).get("publicacion") !== "publicacion") F("2 · informe-ltr.tsx no le pasa a PremiumResults la publicación que leyó");
  if (!/(^|[\s,])publicacion\s*(,|:\s*publicacion\s*,)/.test(clavesObjeto(str, "const sharedProps = "))) F("2 · informe-str.tsx no pone la publicación que leyó en las props del cliente");
  if (!/<STRResultsClient \{\.\.\.sharedProps\} \/>/.test(str)) F("2 · informe-str.tsx no le da sus props al cliente");
  for (const [archivo, elemento] of [
    ["src/app/analisis/[id]/results-client.tsx", "SubjectCardGrid"],
    ["src/components/analysis/SubjectCardGrid.tsx", "PortadaInforme"],
    ["src/app/analisis/renta-corta/[id]/results-client.tsx", "PortadaInforme"],
  ] as const) {
    if (atributosJsx(elementoJsx(codigo(archivo), elemento)).get("publicacion") !== "publicacion") F(`2 · ${archivo} no le pasa la publicación a <${elemento}>`);
  }

  // ── 1 · con informes reales de la selección ──
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    F("1 · sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no se pueden leer los informes de la selección (no es un verde)");
  } else {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    let medidos = 0;
    for (const [tipo, etiqueta] of [["long-term", "Renta larga"], ["short-term", "Renta corta"]] as const) {
      const { data, error } = await admin.from("analisis").select("id, input_data")
        .eq("tipo_analisis", tipo).not("input_data->origenAviso->>avisoId", "is", null)
        .order("created_at", { ascending: false }).limit(POR_MODALIDAD);
      if (error) { F(`1 · no se leyeron los informes de ${etiqueta.toLowerCase()}: ${error.message}`); continue; }
      let deEsta = 0;
      for (const fila of data ?? []) {
        const avisoId = avisoDelInforme(fila.input_data);
        // Lo que la portada tiene que enlazar: la url del aviso, leída aparte de la función que se mide.
        const { data: sp } = await admin.from("scraped_properties").select("url").eq("id", avisoId!).order("id").limit(1);
        const esperada = (sp?.[0] as { url?: string } | undefined)?.url;
        if (!esperada) continue; // el aviso salió de la tabla: no hay enlace que exigir
        const pub = await publicacionDelInforme(admin, fila.input_data);
        const corto = String(fila.id).slice(0, 8);
        if (!pub) { F(`1 · ${etiqueta} ${corto}: publicacionDelInforme no devuelve la publicación de su aviso`); continue; }
        if (pub.url !== esperada) { F(`1 · ${etiqueta} ${corto}: la publicación no es la de su aviso (${pub.url})`); continue; }
        const fila_ = filaUtilidades(dibujarPortada(pub, etiqueta));
        const falta = pub.despublicado ? (fila_.includes(PUBLICACION_PORTADA.baja) ? null : "despublicado sin «Ya no está publicado»") : faltaEnlace(fila_, esperada);
        if (falta) F(`1 · ${etiqueta} ${corto}: ${falta}`);
        deEsta++;
      }
      if (deEsta === 0) F(`1 · ningún informe de ${etiqueta.toLowerCase()} hecho desde un aviso con enlace: el tier no midió nada`);
      medidos += deEsta;
    }
    console.log(`  · medidos: ${medidos} informes reales de la selección (hasta ${POR_MODALIDAD} por modalidad)`);
  }

  if (fallas.length) {
    console.log(`  ✗ PUBLICACION-PORTADA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — los informes reales de la selección, de renta larga y de renta corta, llevan «Ver la publicación» junto a «Ficha del depto» en la portada, con el enlace de su aviso y en otra pestaña; despublicado lo dice sin enlace; el botón de abajo dice «Mandármelo por correo»");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (27-oct-2026, scratchpad mutar-publicacion.cjs, cada una restaurada byte a byte): M1 la portada sin el
// enlace · M2 el enlace a otra parte · M3 en la misma pestaña · M4 despublicado con enlace · M5 el enlace fuera de la fila
// de la ficha · M6 publicacionDelInforme no devuelve nada · M7 lee otro campo del input · M8 la página LTR pasa null · M9 la
// página LTR lee sin el input · M10 la página STR no la pone en sus props · M11 el cliente LTR no se la da a la grilla ·
// M12 la grilla no se la da a la portada · M13 el cliente STR no se la da a la portada · M14 el botón vuelve a «Quiero
// verlo». 14/14 ROJO. M5 salió VERDE en la primera pasada: la fila se ubicaba por la marca `data-portada` de la portada, y
// mover la marca movía la medición con ella; ahora se ubica por el botón de la ficha y quedó ROJO. M4 la cazan además los
// datos reales: un informe de renta corta de una cuenta de prueba tiene su aviso despublicado.

if (require.main === module) {
  runPublicacionPortadaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
