// ─────────────────────────────────────────────────────────────────────────────
// Tier NUEVO-USADO (28-oct-2026, 0 tokens, sin red) — decisión de Fabrizio: la línea de cada depto pasa de «Las Condes · 2D2B
// · 77 m²» a «Las Condes · 2D2B · 77 m² · Usado» (o «· Nuevo»), mismo tamaño y color que el resto de la línea, sin etiqueta
// ni color propio. Si el aviso no lo dice, no se pone nada. En todas las fichas de un depto.
//
//   1 · LA LÍNEA (lib/guia/linea-depto.ts): «· Usado» / «· Nuevo» al final; sin condición (null, vacío, otro valor) nada; la
//       palabra no tiene elemento propio (palabraCondicion solo la usa lineaDepto).
//   2 · DE DÓNDE SALE: la condición cruda del aviso, nunca la que el motor supone. candidatoDeFila la guarda solo si el aviso
//       la trae (el motor sigue suponiendo «usado»); itemDe la lleva a la selección; los primeros de la noche la traen de la
//       RPC; lo guardado antes de hoy se completa con la del aviso (conCondicion); y los pines de Explorar, con los que NO
//       dicen «usado» en la ventana (conCondicionDePines: fuera de esa lista, «usado»; si la lista falló, nada).
//   3 · LAS FICHAS: Explorar (la tarjeta y la hoja del pin, dibujadas), el correo semanal y el del día (la tarjeta del correo,
//       también la de la selección diaria y la lista de «los que casi» del vacío), la tarjeta del pop-up de «Analizar este»
//       (nombreDelDepto) y las tarjetas de «Estás dentro» y del dashboard; los tres que abren el pop-up le pasan la condición.
//   4 · EL CABLEADO DEL SERVIDOR: el dashboard y «Estás dentro» completan lo guardado; Explorar lee los no usados en paralelo
//       con los pines y sin el tope de mil.
//
// ACTA DE MUTACIONES (28-oct-2026), cada una corrida y devuelta:
//   M1 lineaDepto sin la condición → ROJO §1 y §3 · M2 la condición supuesta («usado» si no dice) → ROJO §1 y §2.
//   M3 candidatoDeFila guarda la del motor → ROJO §2 · M4 itemDe no la lleva → ROJO §2.
//   M5 un pin sin lista de no usados sale «usado» → ROJO §2 · M6 la tarjeta del correo vuelve a la línea vieja → ROJO §3.
//   M7 Explorar vuelve a su línea vieja → ROJO §3 · M8 PrimeraSeleccion no le pasa la condición al pop-up → ROJO §3.
//   M9 el dashboard no completa lo guardado → ROJO §4 · M10 los no usados sin paginar → ROJO §4.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/nuevo-usado-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import "./als-de-next";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { condicionDe, lineaDepto, palabraCondicion } from "../../../src/lib/guia/linea-depto";
import { candidatoDeFila, type FilaRpc } from "../../../src/lib/guia/semanal-candidatos";
import { conCondicion, itemDe } from "../../../src/lib/guia/semanal-servidor";
import { conCondicionDePines } from "../../../src/lib/explorar/servidor";
import { primerosDeptos } from "../../../src/lib/deptos/servidor";
import { nombreDelDepto } from "../../../src/lib/guia/compra-desde-depto";
import { correoSemanal, correoSemanalVacio } from "../../../src/lib/email/correo-semanal";
import { correoInmediato } from "../../../src/lib/email/correo-inmediato";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El cuerpo de una función (o const flecha) de un archivo, hasta la siguiente declaración de primer nivel. */
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`(?:function|const) ${nombre}\\b`));
  if (i < 0) return "";
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?(?:function|const|interface|type) /);
  return fin < 0 ? src.slice(i) : src.slice(i, i + 1 + fin);
}
function archivosSrc(dir = join(RAIZ, "src")): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivosSrc(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(relative(RAIZ, p).replace(/\\/g, "/"));
  }
  return out;
}

export async function runNuevoUsadoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER NUEVO-USADO (la línea de cada depto dice «· Usado» o «· Nuevo» si el aviso lo dice · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const depto = { comuna: "Las Condes", tipologia: "2D2B", m2: 77, precioUF: 4200 };
  try {
    // ── 1 · la línea ──
    // Mutaciones: M1 sin la condición · M2 la condición supuesta.
    {
      if (lineaDepto({ ...depto, condicion: "usado" }) !== "Las Condes · 2D2B · 77 m² · Usado") F(`1 · la línea con «usado»: «${lineaDepto({ ...depto, condicion: "usado" })}»`);
      if (lineaDepto({ ...depto, condicion: "nuevo" }) !== "Las Condes · 2D2B · 77 m² · Nuevo") F(`1 · la línea con «nuevo»: «${lineaDepto({ ...depto, condicion: "nuevo" })}»`);
      for (const sin of [undefined, null, "", "a estrenar", "USADO"]) {
        if (lineaDepto({ ...depto, condicion: sin }) !== "Las Condes · 2D2B · 77 m²") F(`1 · sin condición (${JSON.stringify(sin)}) la línea igual dice algo: «${lineaDepto({ ...depto, condicion: sin })}»`);
      }
      if (lineaDepto({ comuna: "Ñuñoa", tipologia: null, m2: 1234.4, condicion: "usado" }) !== "Ñuñoa · 1.234 m² · Usado") F("1 · sin tipología o con miles, la línea no queda bien");
      if (palabraCondicion("usado") !== "Usado" || palabraCondicion(null) !== null || condicionDe("x") !== undefined) F("1 · la palabra de la condición");
      const usanPalabra = archivosSrc().filter((p) => p !== "src/lib/guia/linea-depto.ts" && /palabraCondicion/.test(codigo(p)));
      if (usanPalabra.length > 0) F(`1 · la palabra se dibuja aparte de la línea (con su propio elemento o color) en: ${usanPalabra.join(", ")}`);
    }

    // ── 2 · de dónde sale ──
    // Mutaciones: M2 · M3 candidatoDeFila guarda la del motor · M4 itemDe no la lleva · M5 sin lista, «usado».
    {
      const filaRpc = (condicion: string | null): FilaRpc => ({
        id: "a1", comuna: "Las Condes", lat: -33.4, lng: -70.5, superficie_m2: 77, dormitorios: 2, banos: 2, condicion: condicion as string, direccion: null,
        fecha_entrega: null, url: null, precio_uf: 4200, antiguedad_anios: 25, antiguedad_origen: "supuesta", arriendo: null, venta: null, gastos_comunes: null, mediana_comuna: null, score_cron: 80,
      });
      const cSin = candidatoDeFila(filaRpc(null)), cNuevo = candidatoDeFila(filaRpc("nuevo")), cUsado = candidatoDeFila(filaRpc("usado"));
      if (cSin.condicionAviso !== undefined || cSin.condicion !== "usado") F(`2 · un aviso que no dice su condición queda con una (${cSin.condicionAviso}), o el motor deja de suponer «usado»`);
      if (cNuevo.condicionAviso !== "nuevo" || cUsado.condicionAviso !== "usado") F("2 · candidatoDeFila no guarda la condición que trae el aviso");
      const ev = { veredicto: "COMPRAR", score: 80, flujo: 1000 } as Parameters<typeof itemDe>[1];
      if (itemDe(cUsado, ev).condicion !== "usado" || itemDe(cNuevo, ev).condicion !== "nuevo" || "condicion" in itemDe(cSin, ev)) F("2 · itemDe no lleva la condición del aviso a la selección (o le pone una al que no la dice)");
      // Los primeros de la noche: de la RPC (la trae).
      const rpcFila = (id: string, condicion: string | null) => ({ id, comuna: "Las Condes", superficie_m2: 77, dormitorios: 2, banos: 2, precio_uf: 4200, score_cron: 80, flujo: 1000, pub_estado: null, pub_at: null, condicion });
      const admin = { rpc: async () => ({ data: [rpcFila("p1", "usado"), rpcFila("p2", null)], error: null }) } as unknown as Parameters<typeof primerosDeptos>[0];
      const prim = await primerosDeptos(admin, { comunas: ["Las Condes"], dorms: [2], ufMin: 0, ufMax: 6000, pie: 20 });
      if (prim.find((p) => p.avisoId === "p1")?.condicion !== "usado" || prim.find((p) => p.avisoId === "p2")?.condicion !== undefined) F("2 · los primeros de la noche no traen la condición del aviso (o la suponen)");
      // Lo guardado antes de hoy, con la del aviso.
      const delAviso = new Map([["g1", "nuevo" as const]]);
      const guardado = (avisoId: string, condicion?: "nuevo" | "usado"): { avisoId: string; condicion?: "nuevo" | "usado" } => ({ avisoId, ...(condicion ? { condicion } : {}) });
      if (conCondicion(guardado("g1"), delAviso).condicion !== "nuevo" || conCondicion(guardado("g2"), delAviso).condicion !== undefined || conCondicion(guardado("g1", "usado"), delAviso).condicion !== "usado") F("2 · lo guardado no se completa con la condición del aviso (o se pisa la que traía)");
      // Los pines.
      const pin = (avisoId: string) => ({ avisoId, comuna: "Las Condes", lat: -33.4, lng: -70.5, m2: 77, dormitorios: 2, tipologia: "2D2B", precioUF: 4200, veredicto: "COMPRAR", score: 80, flujo: 1000, arriendo: 800000, vistoAt: null });
      const noUsados = new Map<string, unknown>([["n1", "nuevo"], ["s1", null]]);
      const [u, n, s] = conCondicionDePines([pin("u1"), pin("n1"), pin("s1")], noUsados);
      if (u.condicion !== "usado" || n.condicion !== "nuevo" || s.condicion !== undefined) F(`2 · los pines no toman su condición de los que no dicen «usado» (${u.condicion}, ${n.condicion}, ${s.condicion})`);
      if (conCondicionDePines([pin("u1")], null)[0].condicion !== undefined) F("2 · si la lista de no usados no se leyó, los pines salen «usado» (se supone)");
    }

    // ── 3 · las fichas ──
    // Mutaciones: M1 · M6 la tarjeta del correo vuelve a la línea vieja · M7 Explorar vuelve a su línea · M8 sin pasarla al pop-up.
    {
      // Explorar: la tarjeta del pin y la lista, dibujadas.
      // ⚠ ACTA (28-oct-2026, Explorar como portal) · la hoja del pin y sus tarjetas se reemplazaron por la tarjeta chica del pin
      // (tarjeta-pin.tsx) y la lista (lista-portal.tsx); las dos llevan la misma línea. Sin «visto publicado» al final.
      const { TarjetaPin } = require(join(RAIZ, "src/app/explorar/tarjeta-pin")) as typeof import("../../../src/app/explorar/tarjeta-pin");
      const { ListaPortal } = require(join(RAIZ, "src/app/explorar/lista-portal")) as typeof import("../../../src/app/explorar/lista-portal");
      const p1 = { avisoId: "a1", comuna: "Las Condes", lat: -33.41, lng: -70.55, m2: 77, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4200, veredicto: "COMPRAR", score: 80, flujo: 50000, arriendo: 900000, condicion: "usado" as const, alta: null };
      const p2 = { ...p1, avisoId: "a2", condicion: undefined };
      const ojosDe = (html: string) => Array.from(html.matchAll(/<span class="ex-ojo"[^>]*>([^<]*)<\/span>/g)).map((m) => m[1]);
      const nada = () => {};
      const ojos = ojosDe(dibujar(createElement(TarjetaPin as unknown as FC<Record<string, unknown>>, { pines: [p1, p2], seleccionado: "a1", uf: 39000, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar: nada, alCerrar: nada, alGuardar: nada, alAnalizar: nada })));
      if (!ojos.includes("Las Condes · 2D2B · 77 m² · Usado")) F(`3 · la tarjeta de Explorar no dice «· Usado»: ${JSON.stringify(ojos)}`);
      if (!ojos.includes("Las Condes · 2D2B · 77 m²")) F(`3 · en Explorar, el que no dice su condición igual lleva una: ${JSON.stringify(ojos)}`);
      const lista = ojosDe(dibujar(createElement(ListaPortal as unknown as FC<Record<string, unknown>>, { pines: [p1, p2], total: 2, calculando: false, orden: "puntaje", uf: 39000, analizados: {}, guardados: new Set(), alOrden: nada, alAbrir: nada, alGuardar: nada, alAvisame: nada, alMapa: nada })));
      if (!lista.includes("Las Condes · 2D2B · 77 m² · Usado") || !lista.includes("Las Condes · 2D2B · 77 m²")) F(`3 · la lista de Explorar no dice «· Usado» (o se lo pone al que no lo dice): ${JSON.stringify(lista)}`);
      if (!/\{lineaDepto\(p\)\}/.test(codigo("src/app/explorar/tarjeta-pin.tsx")) || !/\{lineaDepto\(p\)\}/.test(codigo("src/app/explorar/lista-portal.tsx"))) F("3 · la tarjeta o la lista de Explorar no usan la línea del depto");
      // El correo: la tarjeta (semanal, del día, la selección diaria) y «los que casi».
      const d = (condicion?: "usado" | "nuevo") => ({ ...depto, veredicto: "COMPRAR", score: 80, flujo: 1000, url: "https://x/u", ...(condicion ? { condicion } : {}) });
      const correo = correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "2D", piePct: 20, plazoAnios: 25, deptos: [d("usado"), d()], saldo: 1, conRegalo: false, presentacion: false, urlBoton: "u", urlTres: "c", urlBaja: "b" });
      const ojoTd = Array.from(correo.html.matchAll(/font-size: 13px; color: [^;]+;">([^<]*Las Condes[^<]*)<\/td>/g)).map((m) => m[1]);
      if (!ojoTd.includes("Las Condes · 2D2B · 77 m² · Usado") || !ojoTd.includes("Las Condes · 2D2B · 77 m²")) F(`3 · la tarjeta del correo no dice «· Usado» en la misma línea (o se lo pone al que no lo dice): ${JSON.stringify(ojoTd)}`);
      const inm = correoInmediato({ nombre: "Ana", busca: "2D", piePct: 20, plazoAnios: 25, deptos: [d("nuevo")], saldo: 1, urlBoton: "u", urlComprar: "c", urlBaja: "b" } as Parameters<typeof correoInmediato>[0]);
      if (!inm.html.includes("Las Condes · 2D2B · 77 m² · Nuevo")) F("3 · la selección diaria no dice «· Nuevo»");
      const vacio = correoSemanalVacio({ nombre: "Ana", presentacion: false, urlPerfil: "p", urlBaja: "b", casi: [{ ...depto, score: 60, flujo: -1000, condicion: "usado" }] } as Parameters<typeof correoSemanalVacio>[0]);
      if (!vacio.html.includes("Las Condes · 2D2B · 77 m² · Usado")) F("3 · «los que casi» del correo vacío no dicen «· Usado»");
      // El pop-up de «Analizar este».
      if (nombreDelDepto({ ...depto, condicion: "usado" }) !== "Las Condes · 2D2B · 77 m² · Usado · UF 4.200" || nombreDelDepto(depto) !== "Las Condes · 2D2B · 77 m² · UF 4.200") F(`3 · la tarjeta del pop-up: «${nombreDelDepto({ ...depto, condicion: "usado" })}»`);
      const pop = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
      if (!/direccion: nombreDelDepto\(depto\),/.test(pop) || !/depto: \{ comuna: string; tipologia: string \| null; m2: number; precioUF: number; condicion\?: CondicionDepto \};/.test(pop)) F("3 · la tarjeta del pop-up no recibe la condición o no la nombra con nombreDelDepto");
      // «Estás dentro» y el dashboard.
      const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
      if (!/<div className="sel-ojo"><span className="sel-pin" aria-hidden="true">\{i \+ 1\}<\/span>\{lineaDepto\(it\)\}<\/div>/.test(ps)) F("3 · las tarjetas de «Estás dentro» no usan la línea del depto");
      if (!/depto=\{\{ comuna: confirmar\.it\.comuna, tipologia: confirmar\.it\.tipologia, m2: confirmar\.it\.m2, precioUF: confirmar\.it\.precioUF, condicion: confirmar\.it\.condicion \}\}/.test(ps)) F("3 · «Estás dentro» no le pasa la condición al pop-up");
      if (!/depto=\{\{ comuna: confirmar\.it\.comuna, tipologia: confirmar\.it\.tipologia, m2: confirmar\.it\.m2, precioUF: confirmar\.it\.precioUF, condicion: confirmar\.it\.condicion \}\}/.test(codigo("src/app/explorar/explorar-cliente.tsx"))) F("3 · Explorar no le pasa la condición al pop-up");
      const sl = codigo("src/app/semanal/semanal-lista.tsx");
      if (!/const ojoDe = \(it: ItemSemanal\) => lineaDepto\(it\);/.test(sl) || !/<div className="sel-ojo">\{n != null && <span className="sel-pin" aria-hidden="true">\{n\}<\/span>\}\{ojoDe\(it\)\}<\/div>/.test(sl) || !/depto=\{confirmar\.it\}/.test(sl)) F("3 · las tarjetas del dashboard no usan la línea del depto (o no le pasan el depto entero al pop-up)");
      if (!/const ojo = escaparHtml\(lineaDepto\(d\)\);/.test(cuerpo(codigo("src/lib/email/correo-semanal.ts"), "tarjeta"))) F("3 · la tarjeta del correo no usa la línea del depto");
    }

    // ── 4 · el cableado del servidor ──
    // Mutaciones: M9 el dashboard no completa · M10 los no usados sin paginar.
    {
      const pag = codigo("src/lib/guia/seleccion-pagina-servidor.ts");
      if (!/const delAviso = await condicionesDeAvisos\(admin, /.test(pag) || !/const filas = completar\(filasGuardadas\), filasCortas = completar\(filasCortasGuardadas\);/.test(pag)) F("4 · el dashboard no completa con la condición del aviso lo guardado antes de hoy");
      const prim = codigo("src/lib/deptos/primeros-servidor.ts");
      if (!/condicionesDeAvisos\(admin, items\.filter\(\(i\) => !i\.condicion\)\.map\(\(i\) => i\.avisoId\)\)/.test(prim) || !/\.map\(\(i\) => conCondicion\(i, delAviso\)\)/.test(prim)) F("4 · «Estás dentro» no completa lo guardado con la condición del aviso");
      if (!/\.\.\.\(d\.condicion \? \{ condicion: d\.condicion \} : \{\}\)/.test(prim)) F("4 · los de la noche se escriben en la fila del día sin su condición");
      const srv = codigo("src/lib/explorar/servidor.ts");
      const pe = cuerpo(srv, "pinesExplorar");
      if (!/const \[pines, noUsados\] = await Promise\.all\(\[/.test(pe) || !/avisosNoUsados\(admin, ahora\),/.test(pe) || !/return conCondicionDePines\(pines, noUsados\);/.test(pe)) F("4 · Explorar no lee los no usados en paralelo con los pines");
      const anu = cuerpo(srv, "avisosNoUsados");
      if (!/\.or\("condicion\.is\.null,condicion\.neq\.usado"\)/.test(anu) || !/\.gte\("scraped_at", desdeVentana\(ahora\)\)/.test(anu) || !/\.order\("id"\)\.range\(desde, desde \+ PAGINA_POSTGREST - 1\)/.test(anu)) F("4 · los no usados no son los de la ventana de los pines, o se leen sin paginar (PostgREST corta en mil)");
    }
  } catch (e) {
    F(`no corrió: ${(e as Error).stack ?? (e as Error).message}`);
  }
  if (fallas.length) {
    console.log(`  ✗ NUEVO-USADO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — «· Usado» o «· Nuevo» al final de la línea, en la misma línea y color, solo si el aviso lo dice: Explorar (tarjeta y hoja), el correo semanal, el del día y la selección diaria, el pop-up, «Estás dentro» y el dashboard; lo guardado se completa con el aviso");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runNuevoUsadoTier().then((r) => process.exit(r.hard ? 1 : 0));
}
