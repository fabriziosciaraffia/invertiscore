// ============================================================================
// GOLDEN · PUERTA-B-DASHBOARD (24-oct-2026) — catch-test
// ============================================================================
//   El dashboard y el ticket según los mockups de la puerta B (docs/puerta-b-mockups/3b-dashboard.html y
//   4-ticket-y-popups.html; decisión de Fabrizio), parte 2:
//   §1  LAS REGLAS PURAS (lib/casa/reglas.ts): la oferta roja mientras el ticket viva, CON O SIN SALDO (no con el plan);
//       las dos preguntas pendientes solo a quien entró por /deptos (B) o invitación (C), y solo las no contestadas;
//       «Se renueva todos los días» con «Quiero comprar ya», el lunes con las otras; la píldora del saldo.
//   §2  EL ORDEN DEL DASHBOARD (3b): saludo + píldora → oferta → «Invita a alguien» en fila → «Tu selección de esta
//       semana» con la línea del perfil → el mapa → las tarjetas → plegados, el perfil (con la etiqueta de pendientes) e
//       «Informes realizados». Y el copy, frase por frase. Lo viejo (el banner, el saldo plano, casa-arriba) ya no existe.
//   §3  EL MAPA (lib/casa/mapa-casa.ts): el encuadre hace entrar a la selección con margen; la proyección cae donde debe;
//       la URL es cacheable y sin marcadores; dibujado de verdad: los 5 en rojo numerados en orden y los demás en gris;
//       el botón a /explorar.
//   §4  EL YA ANALIZADO COMO FILA COMPACTA EN SU POSICIÓN (dibujado de verdad con SemanalLista): no al final, no como
//       tarjeta; tres a la vista y «Ver los N que faltan».
//   §5  LAS DOS PREGUNTAS OCULTAS PARA LA PUERTA A (dibujado de verdad con PerfilBusquedaCasa): sin pendientes, nada; con
//       ellas, las dos preguntas, el título rojo y la regla de la frecuencia; «Editar» despliega los campos con pie y plazo.
//   §6  LA SELECCIÓN DIARIA PARA «QUIERO COMPRAR YA» (lib/guia/inmediato.ts): diaria con «ya», semanal con las otras;
//       si no hay nuevos que convengan, no se manda nada (cableado en avisarPersona); el cron corre cada día.
//   §7  EL TICKET COMO OFERTA (4-ticket-y-popups.html): el pop-up sin saldo (A) dibujado de verdad —título rojo, tarjeta
//       gris, tarjeta roja del ticket, «Aprovechar · 3 por $14.990», «Comprar solo 1 · $9.990» como botón, Cancelar—; la
//       pantalla de compra (B) con la etiqueta, el vencimiento, el tachado y el depto; «Pago confirmado» (C) desde un depto.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/puerta-b-dashboard-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|cambialo|vos)(?![a-záéíóúñ])/i;

function dibujarConRouter(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujarConRouter(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&quot;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const orden = (s: string, marcas: string[]): number[] => marcas.map((m) => s.indexOf(m));
const enOrden = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]));

export async function runPuertaBDashboardTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PUERTA-B-DASHBOARD (el dashboard y el ticket según los mockups · 0 tokens) ───");

  // Sin los módulos nuevos (el código de antes del goal) cada sección cae en rojo, no el runner.
  const faltantes = ["src/lib/casa/reglas.ts", "src/lib/casa/mapa-casa.ts", "src/lib/casa/mapa-casa-servidor.ts", "src/app/dashboard/mapa-casa.tsx", "src/app/dashboard/oferta-casa.tsx"].filter((f) => !existe(f));
  if (faltantes.length > 0) {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) F(`${n} · faltan los módulos del dashboard nuevo: ${faltantes.join(", ")}`);
    for (const f of fallas) console.log(`  ✗ ${f}`);
    return { hard: fallas.length };
  }

  const reglas = require(join(RAIZ, "src/lib/casa/reglas")) as typeof import("../../../src/lib/casa/reglas");
  const mapa = require(join(RAIZ, "src/lib/casa/mapa-casa")) as typeof import("../../../src/lib/casa/mapa-casa");
  const inmediato = require(join(RAIZ, "src/lib/guia/inmediato")) as typeof import("../../../src/lib/guia/inmediato");
  const { CASA, lineaBusqueda } = require(join(RAIZ, "src/app/dashboard/casa-copy")) as typeof import("../../../src/app/dashboard/casa-copy");
  const { AVISO_ANALIZAR } = require(join(RAIZ, "src/lib/guia/aviso-analizar")) as typeof import("../../../src/lib/guia/aviso-analizar");
  const { RETORNO } = require(join(RAIZ, "src/lib/compra/compra")) as typeof import("../../../src/lib/compra/compra");
  const { CHECKOUT_PACK } = require(join(RAIZ, "src/lib/lo-que-sigue/copy")) as typeof import("../../../src/lib/lo-que-sigue/copy");
  const sin = { tipo: "sin" as const }, con = { tipo: "con" as const, n: 2, noVencen: true }, plan = { tipo: "plan" as const }, regalo = { tipo: "regalo" as const, vence: null };

  // ── §1 · las reglas puras ───────────────────────────────────────────────────
  if (!reglas.ofertaEnCasa({ ticket: true, saldo: sin }) || !reglas.ofertaEnCasa({ ticket: true, saldo: con }) || !reglas.ofertaEnCasa({ ticket: true, saldo: regalo })) F("1 · con el ticket vivo la oferta no va con o sin saldo");
  if (reglas.ofertaEnCasa({ ticket: false, saldo: sin }) || reglas.ofertaEnCasa({ ticket: true, saldo: plan })) F("1 · la oferta va sin ticket, o con el plan");
  const pq = reglas.preguntasPendientes;
  if (pq({ puerta: "A", modalidad: null, horizonte: null }).length !== 0 || pq({ puerta: "D", modalidad: null, horizonte: null }).length !== 0 || pq({ puerta: null, modalidad: null, horizonte: null }).length !== 0) F("1 · a quien entró con su informe (A, D, sin puerta) se le preguntan las dos preguntas");
  if (pq({ puerta: "B", modalidad: null, horizonte: null }).join() !== "modalidad,cuando" || pq({ puerta: "C", modalidad: null, horizonte: null }).join() !== "modalidad,cuando") F("1 · a la puerta B o C no se le hacen las dos preguntas");
  if (pq({ puerta: "B", modalidad: "ltr", horizonte: null }).join() !== "cuando" || pq({ puerta: "B", modalidad: "str", horizonte: "ya" }).length !== 0) F("1 · una pregunta contestada sigue pendiente");
  if (reglas.etiquetaPendientes(2) !== "2 preguntas pendientes" || reglas.etiquetaPendientes(1) !== "1 pregunta pendiente" || reglas.etiquetaPendientes(0) !== null) F("1 · la etiqueta de pendientes no es «2 preguntas pendientes» / «1 pregunta pendiente» / nada");
  const lunes = new Date("2026-10-24T15:00:00Z");
  if (reglas.lineaRenueva("ya", lunes) !== "Se renueva todos los días." || !/^Se renueva el lunes 26\.$/.test(reglas.lineaRenueva("meses", lunes)) || !/^Se renueva el lunes 26\.$/.test(reglas.lineaRenueva(null, lunes))) F(`1 · «Se renueva…» no distingue «comprar ya» (diaria) de las otras (lunes): ${reglas.lineaRenueva("ya", lunes)} / ${reglas.lineaRenueva("meses", lunes)}`);
  const pil = reglas.pildoraSaldo;
  if (pil(sin).texto !== "Sin análisis" || !pil(sin).planes || pil(con).texto !== "Te quedan 2" || pil(con).planes || pil({ tipo: "con", n: 1, noVencen: false }).texto !== "Te queda 1" || pil(regalo).planes || pil(plan).planes) F("1 · la píldora del saldo no dice «Sin análisis · Ver planes» / «Te quedan N»");

  // ── §2 · el orden del dashboard y el copy ──────────────────────────────────
  const pag = codigo("src/app/dashboard/page.tsx");
  const casa = codigo("src/app/dashboard/casa.tsx");
  const copy = codigo("src/app/dashboard/casa-copy.ts");
  const cuerpo = pag.slice(pag.indexOf('data-casa="pagina"'));
  const marcas = ['className="ca-cabecera"', "{CASA.saludo(firstName || null)}", 'data-casa="saldo"', "<OfertaCasa cuentaCreadaAt={user.created_at} />", '<InvitaAlguien variante="fila" />', "{CASA.seleccion.titulo}", 'data-casa="seleccion-linea"', "<MapaCasa datos={mapa} totalNoche={totalNoche} />", "<SeleccionEnCasa sel={sel} autoAnalizar={autoAnalizar}", '<div className="ca-plegadas">', "<PerfilBusquedaCasa", '<FilaPlegada id="informes" titulo={CASA.informes}', "<Archive"];
  const pos = orden(cuerpo, marcas);
  if (!enOrden(pos)) F(`2 · el orden del dashboard no es saludo → píldora → oferta → invitar → selección (título, línea, mapa, tarjetas) → perfil → informes (${pos.join(",")})`);
  if (!/\{ofertaEnCasa\(\{ ticket, saldo \}\) && user\.created_at && <OfertaCasa cuentaCreadaAt=\{user\.created_at\} \/>\}/.test(pag)) F("2 · la oferta no la decide ofertaEnCasa con el ticket y el saldo");
  if (!/const pildora = pildoraSaldo\(saldo\);/.test(pag) || !/\{pildora\.texto\}\s*\{pildora\.planes && <> · <EnlaceCarga href="\/pricing" data-casa="planes">\{CASA\.verPlanes\}<\/EnlaceCarga><\/>\}/.test(pag)) F("2 · la píldora del saldo no sale de pildoraSaldo con «Ver planes» solo sin análisis");
  if (!/const pendientes = preguntasPendientes\(\{ puerta, modalidad: perfilPersona\.manual\.modalidad, horizonte: pb\.horizonte \}\);/.test(pag) || !/admin\.from\("user_attribution"\)\.select\("puerta"\)\.eq\("user_id", user\.id\)\.maybeSingle\(\)/.test(pag) || !/const puerta = esPuerta\(atr\?\.puerta\) \? atr\.puerta : null;/.test(pag) || !/pendientes=\{pendientes\}/.test(pag)) F("2 · las preguntas pendientes no se deciden con la puerta de user_attribution y lo contestado a mano");
  if (!/lineaRenueva\(pb\.horizonte\)/.test(pag) || !/lineaBusqueda\(\{ comunas: pb\.comunas, dormitorios: pb\.dormitorios/.test(pag)) F("2 · la línea de la selección no lleva el perfil y cuándo se renueva");
  // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · el mapa se lee junto con el total de anoche de /deptos (portadaDeptos), para el botón.
  if (!/const \[mapa, portada\] = await Promise\.all\(\[\s*itemsSel\.length > 0 \? datosMapaCasa\(admin, user\.id, itemsSel\.map\(\(i\) => \(\{ avisoId: i\.avisoId, comuna: i\.comuna \}\)\)\) : Promise\.resolve\(null\),\s*portadaDeptos\(\),\s*\]\);\s*const totalNoche = portada\.noche\?\.convienen \?\? null;/.test(pag) || !/\(sel\.largo\?\.filas \?\? \[\]\)\.map\(\(f\) => f\.reemplazo \?\? f\.item\)/.test(pag)) F("2 · el mapa no se arma con los deptos de la selección (el reemplazo del caído)");
  if (!/abierta=\{abrirInformes\}/.test(pag) || !/const abrirInformes = \["q", "mod", "v", "o", "page", "group", "open"\]\.some/.test(pag)) F("2 · «Informes realizados» no llega abierto con un filtro puesto");
  for (const viejo of ["BloqueArribaCasa", "SaldoPlano", "ExplorarEnCasa", "GuiaBusqueda", "casa-arriba", "ca-banda", "packDeCasa"]) if (pag.includes(viejo) || casa.includes(viejo)) F(`2 · vuelve lo viejo: ${viejo}`);
  if (existe("src/lib/casa-arriba.ts") || existe("src/app/dashboard/explorar-en-casa.tsx")) F("2 · casa-arriba.ts o explorar-en-casa.tsx siguen en el repo");
  const exactos: Array<[string, string]> = [
    [CASA.oferta.kicker("mañana 11:17"), "Solo para cuentas nuevas · vence mañana 11:17"],
    [CASA.oferta.titulo, "3 análisis por $14.990"],
    [CASA.oferta.boton, "Aprovechar"],
    [CASA.invita.titulo, "Invita a alguien"],
    [CASA.invita.bajada, "Si entra con tu enlace, los dos reciben un análisis."],
    [CASA.invita.boton, "Compartir"],
    [CASA.seleccion.titulo, "Tu selección de esta semana"],
    [CASA.seleccion.verMas(3), "Ver los 3 que faltan"],
    [CASA.seleccion.analizar, "Analizar este"],
    [CASA.verPlanes, "Ver planes"],
    [CASA.perfil.titulo, "Tu perfil de búsqueda"],
    [CASA.perfil.queBuscas, "¿Qué buscas?"],
    [CASA.perfil.editar, "Editar"],
    [CASA.perfil.pendientes, "Dos preguntas pendientes"],
    [CASA.perfil.como, "¿Cómo lo arriendas?"],
    [CASA.perfil.modalidad.ltr, "Arriendo tradicional"],
    [CASA.perfil.modalidad.str, "Renta corta"],
    [CASA.perfil.cuando, "¿Cuándo piensas comprar?"],
    [CASA.perfil.horizonte.ya, "Quiero comprar ya"],
    [CASA.perfil.horizonte.meses, "En los próximos meses"],
    [CASA.perfil.horizonte.mirando, "Solo estoy mirando"],
    [CASA.perfil.nota, "Con «Quiero comprar ya» te enviamos una selección todos los días. Con las otras, una selección cada lunes."],
    [CASA.perfil.guardar, "Guardar"],
    [CASA.perfil.proxima, "Tu próxima selección se arma con esto."],
    [CASA.perfil.agregarComuna, "+ agregar otra comuna"],
    [CASA.informes, "Informes realizados"],
    // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · la píldora dice dónde están los grises y el botón, el total de anoche en Santiago.
    [mapa.pildoraMapa(5, 11, ["Providencia"]), "5 en tu selección · 11 más en Providencia"],
    [mapa.pildoraMapa(5, 11, ["Providencia", "Ñuñoa"]), "5 en tu selección · 11 más en Providencia y Ñuñoa"],
    [mapa.pildoraMapa(5, 0, ["Providencia"]), "5 en tu selección"],
    [mapa.botonExplorar(4807), "Explorar los 4.807 de Santiago"],
    [mapa.botonExplorar(null), "Explorar en el mapa"],
    [lineaBusqueda({ comunas: ["Providencia"], dormitorios: [2], precioMinUf: 3000, precioMaxUf: 4000 }), "Providencia · 2 dormitorios · UF 3.000 a 4.000"],
  ];
  for (const [real, esperado] of exactos) if (real !== esperado) F(`2 · «${real}» debía ser «${esperado}»`);
  for (const t of [...exactos.map((x) => x[0]), CASA.perfil.pendiente, CASA.perfil.guardado, CASA.perfil.error]) if (VOSEO.test(t)) F(`2 · voseo: «${t}»`);
  // El perfil, plegado: la etiqueta de pendientes en la fila y la línea corta; «Invita a alguien» en una fila con «Compartir».
  // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · la fila es controlada (se pliega al guardar), su línea es el resumen completo y la
  // etiqueta cuenta lo GUARDADO.
  if (!/<FilaPlegada id="perfil" titulo=\{CASA\.perfil\.titulo\} etiqueta=\{etiqueta\} sub=\{resumen\} marca="perfil" controlada=\{\{ abierta, alCambiar: setAbierta \}\} aviso=\{vistoGuardado \? CASA\.perfil\.guardado : null\}>/.test(casa)
    || !/const etiqueta = etiquetaPendientes\(pendientes\.filter\(\(q\) => !guardadas\[q === "modalidad" \? "modalidad" : "cuando"\]\)\.length\);/.test(casa)) F("2 · «Tu perfil de búsqueda» no es una fila plegada controlada con la etiqueta de lo guardado y el resumen");
  const invita = codigo("src/components/invitacion/InvitaAlguien.tsx");
  if (!/if \(variante === "fila"\) \{[\s\S]*?<section id="invitar" className="iv-destacado iv-fila"[\s\S]*?\{REFERIDO_COPY\.invitaTitulo\}[\s\S]*?\{REFERIDO_COPY\.invitaTexto\}[\s\S]*?\{REFERIDO_COPY\.compartir\}[\s\S]*?<\/section>/.test(invita)) F("2 · «Invita a alguien» no tiene la variante de una fila con «Compartir»");
  const copyLibre = copy.replace(/^import .*$/gm, "");
  if (/14\.990|14990|9\.990|9990|19\.990|19990/.test(copyLibre)) F("2 · un precio escrito a mano en el copy del dashboard");

  // ── §3 · el mapa ────────────────────────────────────────────────────────────
  const cinco = [{ lat: -33.4300, lng: -70.6100 }, { lat: -33.4350, lng: -70.6200 }, { lat: -33.4400, lng: -70.6050 }, { lat: -33.4250, lng: -70.6300 }, { lat: -33.4380, lng: -70.6150 }];
  const e = mapa.encuadrar(cinco);
  if (e.zoom < mapa.MAPA_CASA.zoomMin || e.zoom > mapa.MAPA_CASA.zoomMax) F(`3 · el zoom del encuadre se sale del rango: ${e.zoom}`);
  const dentro = cinco.map((p) => mapa.enImagen(p, e));
  if (dentro.some((q) => !q)) F("3 · el encuadre deja un depto de la selección fuera de la imagen");
  const m = mapa.MAPA_CASA.margen;
  if (dentro.some((q) => q && (q.x < m || q.x > mapa.MAPA_CASA.ancho - m || q.y < m || q.y > mapa.MAPA_CASA.alto - m))) F("3 · el encuadre no respeta el margen");
  if (mapa.encuadrar([...cinco, { lat: -33.60, lng: -70.80 }]).zoom >= e.zoom) F("3 · con un depto más lejos el zoom no se abre");
  // El margen de verdad: dos deptos que al zoom 14 caben en la imagen pero no con el margen (170 puntos del centro, con el
  // borde a 175 y el margen en 22) tienen que ir al zoom 13. Sin margen, el encuadre los pondría pegados al borde.
  {
    const dlng = ((2 * (mapa.MAPA_CASA.ancho / 2 - mapa.MAPA_CASA.margen / 4)) / (256 * Math.pow(2, 14))) * 360;
    const par = [{ lat: -33.43, lng: -70.62 }, { lat: -33.43, lng: -70.62 + dlng }];
    if (mapa.encuadrar(par).zoom !== 13) F(`3 · el encuadre no respeta el margen: dos deptos a 170 puntos del centro al zoom 14 quedan en zoom ${mapa.encuadrar(par).zoom}, no 13`);
  }
  const centro = mapa.enImagen({ lat: e.lat, lng: e.lng }, e);
  if (!centro || Math.abs(centro.x - mapa.MAPA_CASA.ancho / 2) > 0.5 || Math.abs(centro.y - mapa.MAPA_CASA.alto / 2) > 0.5) F("3 · el centro del encuadre no cae en el centro de la imagen");
  if (mapa.enImagen({ lat: -34.5, lng: -71.5 }, e) !== null) F("3 · un depto fuera del encuadre no da null");
  if (mapa.encuadrar([]).zoom !== mapa.CENTRO_SANTIAGO.zoom) F("3 · sin puntos el encuadre no es el centro de Santiago");
  if (mapa.urlMapaCasa(e, undefined) !== null) F("3 · sin la llave la URL no es null");
  const url = mapa.urlMapaCasa(e, "LLAVE") ?? "";
  if (!/^https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap\?center=-33\.\d{5},-70\.\d{5}&zoom=\d+&size=350x200&scale=2&maptype=roadmap&style=/.test(url) || !/&key=LLAVE$/.test(url) || /markers=/.test(url)) F("3 · la URL del mapa no es cacheable (centro a 5 decimales, zoom, tamaño, estilo, llave) o lleva marcadores");
  if (mapa.urlMapaCasa(e, "LLAVE") !== mapa.urlMapaCasa({ ...e, lat: e.lat + 0.000001 }, "LLAVE")) F("3 · la URL cambia con una milésima de grado: no se cachea");
  const { MapaCasa } = require(join(RAIZ, "src/app/dashboard/mapa-casa")) as typeof import("../../../src/app/dashboard/mapa-casa");
  const datosMapa = {
    encuadre: e, url: "https://maps.googleapis.com/maps/api/staticmap?x=1",
    seleccion: dentro.map((q, i) => ({ n: i + 1, avisoId: `a${i + 1}`, x: q!.x, y: q!.y })),
    grises: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }], nSeleccion: 5, nConvienen: 312, nOtros: 307, desdePerfil: true, comunas: ["Providencia"],
  };
  const htmlMapa = renderToStaticMarkup(createElement(MapaCasa, { datos: datosMapa, totalNoche: 4807 }));
  const pines = Array.from(htmlMapa.matchAll(/<g data-casa="pin" data-n="(\d)"><circle[^>]*><\/circle><text[^>]*>(\d)<\/text><\/g>/g)).map((x) => `${x[1]}${x[2]}`);
  if (pines.join(",") !== "11,22,33,44,55") F(`3 · el mapa no dibuja los 5 de la selección numerados en su orden (${pines.join(",")})`);
  if ((htmlMapa.match(/<circle/g) ?? []).length !== 8) F("3 · los demás que convienen no van en gris (3 grises + 5 rojos = 8 círculos)");
  // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio).
  if (!htmlMapa.includes("5 en tu selección · 307 más en Providencia") || !/href="\/explorar"[^>]*>Explorar los 4\.807 de Santiago</.test(htmlMapa)) F("3 · la píldora o el botón del mapa no dicen lo suyo, o el botón no va a /explorar");
  // EL MAPA DE «ESTÁS DENTRO»: solo los pines rojos numerados —sin grises, sin píldora, sin botón de Explorar—.
  const htmlSel = renderToStaticMarkup(createElement(MapaCasa, { datos: datosMapa, variante: "seleccion", totalNoche: 4807 }));
  const pinesSel = Array.from(htmlSel.matchAll(/<g data-casa="pin" data-n="(\d)">/g)).map((x) => x[1]).join(",");
  if (pinesSel !== "1,2,3,4,5" || (htmlSel.match(/<circle/g) ?? []).length !== 5 || /data-casa="grises"|mapa-pildora|explorar-boton|Explorar|href=/.test(htmlSel)) F(`1 · el mapa de «Estás dentro» no es solo la selección (pines ${pinesSel}, ${(htmlSel.match(/<circle/g) ?? []).length} círculos)`);
  const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
  if (!/if \(encabezado === "dentro"\) qs\.set\("mapa", "1"\);/.test(ps) || !/data-primera="titulo">\{titulo\}<\/h2>\s*\{encabezado === "dentro" && datos\?\.mapa && items\.length > 0 && <div data-primera="mapa"><MapaCasa datos=\{datos\.mapa\} variante="seleccion" \/><\/div>\}/.test(ps)) F("1 · «Estás dentro» no pide el mapa o no lo dibuja bajo el título con la variante de la selección");
  if (!/sp\.get\("mapa"\) === "1"[\s\S]{0,120}\? await datosMapaCasa\(admin, user\.id, r\.items\.map\(\(i\) => \(\{ avisoId: i\.avisoId, comuna: i\.comuna \}\)\), undefined, \{ grises: false \}\)/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("1 · la ruta de los primeros no arma el mapa sin grises");
  if (!/class="ca-mapa-fondo" style="background-image:url\(&quot;https:\/\/maps\.googleapis\.com/.test(htmlMapa) || renderToStaticMarkup(createElement(MapaCasa, { datos: { ...datosMapa, url: null } })).includes("ca-mapa-fondo")) F("3 · la imagen de fondo no va como fondo (o aparece sin URL)");
  const srv = codigo("src/lib/casa/mapa-casa-servidor.ts");
  if (!/const otros = explorar\.pines\.filter\(\(p\) => !enSel\.has\(p\.avisoId\)\);/.test(srv) || !/pinesExplorar\(admin, filtros\)/.test(srv) || !srv.includes('.from("scraped_properties").select("id, lat, lng").in("id", ids.slice(0, 50)).order("id").limit(50)')) F("3 · los grises no son los de Explorar menos la selección, o las coordenadas no salen de la tabla de avisos");
  if (htmlMapa.includes("ca-mapa-rojo") && !/\.ca-mapa-rojo circle \{ fill: var\(--signal-red\)/.test(leer("src/app/dashboard/casa.css")) || !/\.ca-mapa-gris circle \{ fill: #C9C5BB; \}/.test(leer("src/app/dashboard/casa.css"))) F("3 · los pines de la selección no son rojos o los demás no son grises");

  // ── §4 · el ya analizado como fila compacta, en su posición ────────────────
  const { SemanalLista } = require(join(RAIZ, "src/app/semanal/semanal-lista")) as typeof import("../../../src/app/semanal/semanal-lista");
  const item = (id: string, extra: Record<string, unknown> = {}) => ({ avisoId: id, comuna: "Providencia", tipologia: "2D1B", m2: 59, precioUF: 3500, veredicto: "COMPRAR", score: 91, flujo: 88363, ...extra });
  const filas = [item("a"), item("b"), item("c"), item("d")].map((it) => ({ item: it, caido: false, reemplazo: null }));
  const props = { token: "t".repeat(24), origenId: null, combinacion: { piePct: 20, plazoAnios: 25 }, filas, destacado: null, saldo: con, variante: null, informes: { a: "informe-a" }, enCasa: true, aLaVista: 3 };
  const htmlLista = dibujarConRouter(createElement(SemanalLista, props));
  const bloques = Array.from(htmlLista.matchAll(/<(a|article) [^>]*class="(sel-fila|sel-av)"[^>]*data-n="(\d)"/g)).map((x) => `${x[2]}:${x[3]}`);
  if (bloques.join(",") !== "sel-fila:1,sel-av:2,sel-av:3") F(`4 · el analizado no es la fila compacta en su posición, con tres a la vista (${bloques.join(",")})`);
  const fila = htmlLista.slice(htmlLista.indexOf('class="sel-fila"'), htmlLista.indexOf('class="sel-av"'));
  if (!/href="\/analisis\/informe-a"/.test(fila) || !/Providencia · 2D1B · 59 m² · UF 3\.500 · Comprar 91/.test(fila) || !/Ya lo analizaste/.test(fila) || !/Ver informe/.test(fila) || /sel-precio|Analizar este/.test(fila)) F("4 · la fila compacta no dice el depto con su veredicto, «Ya lo analizaste» y «Ver informe» (o es una tarjeta)");
  if (!/data-semanal="ver-mas"[^>]*>Ver el que falta</.test(htmlLista)) F("4 · con cuatro deptos y tres a la vista no está «Ver el que falta»");
  if ((htmlLista.match(/Analizar este/g) ?? []).length !== 2 || /guia-titulo|guia-pie|Revisados con tu pie/.test(htmlLista)) F("4 · las tarjetas visibles no llevan «Analizar este», o la casa repite el título, la bajada o el pie de la lista");
  const htmlRegalo = dibujarConRouter(createElement(SemanalLista, { ...props, saldo: regalo }));
  if ((htmlRegalo.match(/Analizar este · usa tu regalo/g) ?? []).length !== 2) F("4 · con el regalo el botón no dice «Analizar este · usa tu regalo»");
  const htmlTodos = dibujarConRouter(createElement(SemanalLista, { ...props, aLaVista: null }));
  if (Array.from(htmlTodos.matchAll(/data-n="(\d)"/g)).map((x) => x[1]).join(",") !== "1,2,3,4" || /ver-mas/.test(htmlTodos)) F("4 · sin tope no salen las cuatro numeradas en orden");
  const lista = codigo("src/app/semanal/semanal-lista.tsx");
  if (!/if \(informe\) return filaAnalizada\(it, informe, n\);/.test(lista) || !/const filasALaVista = aLaVista != null && !verTodos \? filas\.slice\(0, aLaVista\) : filas;/.test(lista)) F("4 · la fila compacta o las tarjetas a la vista no están cableadas como deben");
  const sec = codigo("src/app/dashboard/seleccion-en-casa.tsx");
  const { TARJETAS_EN_CASA } = require(join(RAIZ, "src/lib/guia/seleccion-casa")) as typeof import("../../../src/lib/guia/seleccion-casa");
  if (!/enCasa: true, aLaVista: TARJETAS_EN_CASA/.test(sec) || TARJETAS_EN_CASA !== 2) F("4 · el dashboard no monta la lista con dos a la vista (mockup 3b: dos y «Ver los 3 que faltan»)");

  // ── §5 · las dos preguntas ocultas para la puerta A ────────────────────────
  const { PerfilBusquedaCasa } = require(join(RAIZ, "src/app/dashboard/casa")) as typeof import("../../../src/app/dashboard/casa");
  const inicial = { dormitorios: [2], comunas: ["Providencia"], precioMaxUf: 4000, precioMinUf: 3000, modalidad: "ltr" as const, piePct: 20, plazoAnios: 25, horizonte: null };
  const htmlA = dibujarConRouter(createElement(PerfilBusquedaCasa, { inicial, pendientes: [], modalidadRespondida: false }));
  if (/data-casa="preguntas"|¿Cómo lo arriendas\?|¿Cuándo piensas comprar\?|preguntas pendientes|pregunta pendiente/.test(htmlA)) F("5 · a quien entró con su informe (sin pendientes) se le muestran las preguntas");
  const htmlB = dibujarConRouter(createElement(PerfilBusquedaCasa, { inicial, pendientes: ["modalidad", "cuando"], modalidadRespondida: false }));
  const tB = texto(htmlB);
  if (!/data-casa="preguntas" data-pendientes="2"/.test(htmlB) || !tB.includes("Dos preguntas pendientes") || !tB.includes("¿Cómo lo arriendas?") || !tB.includes("Arriendo tradicional") || !tB.includes("Renta corta") || !tB.includes("¿Cuándo piensas comprar?") || !tB.includes("Quiero comprar ya") || !tB.includes(inmediato.FRECUENCIA_COPY.nota)) F("5 · a la puerta B no se le hacen las dos preguntas con el título rojo y la regla de la frecuencia");
  if (!/data-casa="pendientes-etiqueta">2 preguntas pendientes</.test(htmlB) || /pendientes-etiqueta/.test(htmlA)) F("5 · la etiqueta «2 preguntas pendientes» no está en la fila plegada (o aparece sin pendientes)");
  // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · «Guardar» (y «Tu próxima selección se arma con esto.») solo con algo que guardar: con el
  // perfil ya guardado no queda a la vista.
  if (!tB.includes("¿Qué buscas?") || !tB.includes("Providencia · 2 dormitorios · UF 3.000 a 4.000 · Pie 20 % · 25 años") || !/data-casa="editar"[^>]*>Editar</.test(htmlB)) F("5 · el perfil abierto no tiene «¿Qué buscas?» y la frase con «Editar»");
  if (/data-casa="guardar"|Tu próxima selección se arma con esto\./.test(htmlB)) F("5 · «Guardar» queda a la vista sin nada que guardar");
  if (!/const conGuardar = hayCambios \|\| estado === "guardando" \|\| estado === "error";/.test(casa) || !/\{conGuardar && \(\s*<>\s*<button type="button" className="ca-guardar"/.test(casa)) F("5 · «Guardar» no depende de que haya algo que guardar");
  // AL GUARDAR: se pliega, «Guardado.» dos segundos en la fila, y la fila dice el resumen completo.
  const { resumenDeFila, GUARDADO_VISIBLE_MS } = require(join(RAIZ, "src/app/dashboard/casa")) as typeof import("../../../src/app/dashboard/casa");
  const perfilB = { ...inicial, precioMinUf: 4000, precioMaxUf: 6000, modalidad: "ltr" as const, horizonte: "ya" as const };
  if (resumenDeFila(perfilB, { modalidad: true, cuando: true }) !== "Providencia · 2D · UF 4.000 a 6.000 · 20 % · 25 años · Arriendo tradicional · Quiero comprar ya" || resumenDeFila(perfilB, { modalidad: false, cuando: false }) !== "Providencia · 2D · UF 4.000 a 6.000 · 20 % · 25 años") F(`5 · la fila cerrada no dice el resumen completo: «${resumenDeFila(perfilB, { modalidad: true, cuando: true })}»`);
  if (GUARDADO_VISIBLE_MS !== 2000 || !/if \(!ok\) \{ setEstado\("error"\); return; \}[\s\S]*?setAbierta\(false\);\s*setVistoGuardado\(true\);\s*if \(reloj\.current\) window\.clearTimeout\(reloj\.current\);\s*reloj\.current = window\.setTimeout\(\(\) => setVistoGuardado\(false\), GUARDADO_VISIBLE_MS\);/.test(casa)) F("5 · al guardar no se pliega o «Guardado.» no se va a los dos segundos");
  // El pie y el plazo van en la columna de campo de /deptos (`dp-campo-b`), no en `dp-campo`, que es el correo sobre el material
  // (alto fijo de 48): con esa el select se salía de su caja y pisaba «Una pregunta pendiente» (25-oct-2026).
  if (!/<label className="dp-campo-b" htmlFor="casa-pie">/.test(casa) || !/<label className="dp-campo-b" htmlFor="casa-plazo">/.test(casa) || /className="dp-campo"/.test(casa)) F("5 · el pie o el plazo del perfil van en la caja del correo de /deptos y se salen de ella");
  // ⚠ ACTA (25-oct-2026, recorrido de Fabrizio en el teléfono con +qadeptos5) · la fila ya no es un <details> (Safari en iOS no recalculaba
  // su alto al crecer y el perfil en edición quedaba cortado): una sección con un botón, el cuerpo en el flujo, sin recorte.
  if (!/const estaAbierta = controlada \? controlada\.abierta : propia;/.test(casa) || !/aria-expanded=\{estaAbierta\}/.test(casa) || !/hidden=\{!estaAbierta\}/.test(casa) || !/onClick=\{\(\) => poner\(!estaAbierta\)\}/.test(casa)) F("5 · la fila plegada no se puede plegar desde el perfil");
  {
    const fila = (casa.match(/export function FilaPlegada[\s\S]*?\n\}\n/) ?? [""])[0];
    const cssCasa = leer("src/app/dashboard/casa.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const reglaFila = (cssCasa.match(/\.ca-plegada \{[^}]*\}/) ?? [""])[0];
    if (!fila || /<details|<summary/.test(fila) || /overflow|max-height|height:/.test(reglaFila)) F("5 · la fila plegada vuelve a ser un <details> o recorta su contenido (el perfil en edición quedaría cortado)");
    // «Nuevo análisis» sigue como botón en el dashboard (el header lo dejó como enlace), con contorno.
    if (!/<CtaAnalizar origen="dashboard" className="ca-boton-nuevo">\{CASA\.nuevoAnalisis\}<\/CtaAnalizar>/.test(pag) || CASA.nuevoAnalisis !== "Nuevo análisis" || !/\.ca-boton-nuevo \{[^}]*border: 1px solid var\(--franco-text\)/.test(cssCasa)) F("5 · el dashboard no tiene «Nuevo análisis» como botón");
    // «Explorar los N de Santiago» con el material de la tríada, texto blanco (el rojo pleno es para comprar).
    const btn = (cssCasa.match(/\.ca-boton-triada \{[^}]*\}/) ?? [""])[0];
    if (!/className="ca-boton-triada" data-casa="explorar-boton"/.test(leer("src/app/dashboard/mapa-casa.tsx")) || !/color: #FFFFFF/.test(btn) || !/url\("\/landing\/hero-liso-m2x\.webp"\)/.test(btn) || /signal-red|#C8323C/i.test(btn)) F("5 · el botón «Explorar los N de Santiago» no va con el material de la tríada");
  }
  if (!tB.includes("Providencia · 2D · UF 3.000 a 4.000 · 20 % · 25 años")) F("5 · la línea corta de la fila plegada no es «Providencia · 2D · UF 3.000 a 4.000 · 20 % · 25 años»");
  const htmlC = dibujarConRouter(createElement(PerfilBusquedaCasa, { inicial, pendientes: ["cuando"], modalidadRespondida: true }));
  if (!/data-pendientes="1"/.test(htmlC) || !texto(htmlC).includes("Una pregunta pendiente") || /¿Cómo lo arriendas\?/.test(htmlC)) F("5 · con una sola pendiente no se dice «Una pregunta pendiente» ni se oculta la contestada");
  // «Editar» despliega los tres campos de /deptos más el pie y el plazo (el estado `editando`).
  if (!/\{!editando \? \(\s*<div className="ca-perfil-frase" data-casa="perfil-frase">/.test(casa) || !/<CamposBusqueda multiple valor=\{campos\.valor\}[^>]*onChange=\{cambiarCampo\} ids="casa" \/>/.test(casa) || !/data-campo="pie"/.test(casa) || !/data-campo="plazo"/.test(casa) || !/onClick=\{\(\) => setEditando\(true\)\} data-casa="editar"/.test(casa)) F("5 · «Editar» no despliega los tres campos con pie y plazo");
  // Todo se guarda junto, con «Guardar», y la página se vuelve a pedir.
  if (!/const ok = await guardar\(cambios\);/.test(casa) || !/router\.refresh\(\);/.test(casa) || !/const cambios = cambiosDelPerfil\(base, p, contestadas\);/.test(casa)) F("5 · el perfil no guarda todo junto con «Guardar» y se vuelve a pedir la página");
  const { cambiosDelPerfil } = require(join(RAIZ, "src/app/dashboard/casa")) as typeof import("../../../src/app/dashboard/casa");
  const c1 = cambiosDelPerfil(inicial, { ...inicial, modalidad: "str", horizonte: "ya", piePct: 10 });
  if (JSON.stringify(c1) !== JSON.stringify({ piePct: 10, modalidad: "str", horizonte: "ya" })) F(`5 · lo que se manda al PUT no es solo lo que cambió: ${JSON.stringify(c1)}`);
  if (Object.keys(cambiosDelPerfil(inicial, inicial)).length !== 0) F("5 · sin cambios se manda algo");
  // La modalidad contestada igual a la inferida («Arriendo tradicional» sobre un perfil que ya suponía renta larga) va al PUT.
  if (JSON.stringify(cambiosDelPerfil(inicial, inicial, ["modalidad"])) !== JSON.stringify({ modalidad: "ltr" })) F("5 · contestar «Arriendo tradicional» sobre un perfil que ya suponía renta larga no se guarda");
  if (!/const contestadas = pendientes\.filter\(\(q\) => !faltan\.includes\(q\) && !enviadas\.includes\(q\) && \(q === "modalidad" \? !modalidadRespondida : inicial\.horizonte == null\)\);\s*const cambios = cambiosDelPerfil\(base, p, contestadas\);/.test(casa)) F("5 · el perfil no manda las preguntas contestadas en esta pantalla");

  // ── §6 · la selección diaria para «Quiero comprar ya» ──────────────────────
  if (inmediato.frecuenciaSeleccion("ya") !== "diaria" || inmediato.frecuenciaSeleccion("meses") !== "semanal" || inmediato.frecuenciaSeleccion("mirando") !== "semanal" || inmediato.frecuenciaSeleccion(null) !== "semanal") F("6 · la frecuencia no es diaria con «ya» y semanal con las otras");
  if (inmediato.mandaSeleccionDiaria(0) || !inmediato.mandaSeleccionDiaria(1)) F("6 · un día sin nuevos manda algo, o con nuevos no manda");
  const inmSrv = codigo("src/lib/guia/inmediato-servidor.ts");
  if (!/const elegidos = await elegirInmediato\(candidatos, await avisadosAlMomento\(admin, userId\), evaluar, publicadoConPresupuesto\(admin, presupuesto\)\);\s*if \(!mandaSeleccionDiaria\(elegidos\.length\)\) return "nada";/.test(inmSrv)) F("6 · avisarPersona no corta en «nada» cuando no hay nuevos que convengan");
  if (!/const nuevosDesde = new Date\(ahora\.getTime\(\) - VENTANA_NUEVOS_HORAS \* 3600_000\)/.test(inmSrv) || !/prepararSeleccion\(admin, userId, cfg, \{ nuevosDesde \}\)/.test(inmSrv)) F("6 · la selección diaria no se arma solo con los nuevos");
  const vercel = JSON.parse(leer("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
  const cronInm = vercel.crons.find((c) => c.path === "/api/cron/aviso-inmediato");
  if (!cronInm || !/^\d+ \d+ \* \* \*$/.test(cronInm.schedule)) F(`6 · el cron de la selección diaria no corre todos los días (${cronInm?.schedule})`);
  if (CASA.perfil.nota !== inmediato.FRECUENCIA_COPY.nota || CASA.seleccion.renuevaDiaria !== inmediato.FRECUENCIA_COPY.renuevaDiaria) F("6 · el copy del perfil y el de la regla no son el mismo");
  if (!/return frecuenciaSeleccion\(horizonte\) === "diaria" \? FRECUENCIA_COPY\.renuevaDiaria : textoRenueva\(ahora\);/.test(codigo("src/lib/casa/reglas.ts"))) F("6 · «Se renueva…» no sale de la frecuencia");

  // ── §7 · el ticket como oferta ──────────────────────────────────────────────
  const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
  const depto = { comuna: "Providencia", tipologia: "2D1B", m2: 46, precioUF: 3275 };
  const compras = { pack: { href: "/checkout?product=pack3", label: "3 análisis · $14.990", ticket: true }, suelto: { href: "/checkout?product=single", label: "Comprar solo 1 · $9.990" }, sin: "Para analizar este depto: 3 análisis por $14.990, sin caducidad." };
  const base = { depto, combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.5, uf: 39000, arriendo: 450000 }, uso: { tipo: "sin" as const }, rutaCompra: "/x", alAnalizar: () => {}, alCancelar: () => {}, cambio: { recalcular: async () => null, base: { veredicto: "COMPRAR", score: 88, flujo: 88363 } } };
  const htmlA7 = dibujarPopup(createElement(AvisoAntesDeAnalizar, { ...base, compras, ticketVence: "mañana 11:17" }));
  const tA = texto(htmlA7);
  // ⚠ ACTA (24-oct-2026, goal «los pop-ups caben en 390 × 740», decisión de Fabrizio) · el pop-up sin saldo se compactó:
  // sin «Para analizar este depto:», la oferta en una fila («Solo para cuentas nuevas · vence mañana 11:17») y una línea
  // («3 análisis por $14.990 · $4.997 cada uno», sin el $9.990 tachado), «Comprar solo 1» como botón de borde MÁS BAJO
  // (wz-btn2-bajo) y «Cancelar» como texto (wz-modal-cancelar). El alto lo mide la sonda popups-alto-webkit-sonda.ts.
  const marcasA = ['data-aviso="sin-titulo"', "No te quedan análisis.", "Providencia · 2D1B · 46 m² · UF 3.275", "Comprar 88 · flujo +$88.363 te queda", "el enlace a la publicación", 'data-aviso="ticket"', "Solo para cuentas nuevas", "· vence mañana 11:17", "3 análisis por $14.990", " · $4.997 cada uno", "Aprovechar · 3 por $14.990", "Comprar solo 1 · $9.990", "Cancelar"];
  const posA = orden(htmlA7, marcasA);
  if (!enOrden(posA)) F(`7 · el pop-up sin saldo con el ticket no es título rojo → tarjeta gris → tarjeta roja → Aprovechar → Comprar solo 1 → Cancelar (${posA.join(",")})`);
  if (!/<h2 id="modal-plausibilidad-titulo" class="av-sin-titulo" data-aviso="sin-titulo">No te quedan análisis\.<\/h2>/.test(htmlA7)) F("7 · «No te quedan análisis.» no es el título grande en rojo");
  if (!/<button type="button" class="wz-btn2 wz-btn2-bajo" data-modal-secundario(?:="[^"]*")?>Comprar solo 1 · \$9\.990<\/button>/.test(htmlA7)) F("7 · «Comprar solo 1 · $9.990» no es un botón con borde más bajo");
  if (!/<button type="button" class="wz-modal-cancelar" data-modal-cancelar(?:="[^"]*")?>Cancelar<\/button>/.test(htmlA7) || !/class="wz-modal modal-plausibilidad-panel wz-modal-compacto"/.test(htmlA7)) F("7 · el pop-up no va compacto («Cancelar» como texto)");
  if (/Para analizar este depto:|<s>/.test(htmlA7.replace(/wz-modal-consumo[^<]*<[^>]*>[^<]*/g, ""))) F("7 · el pop-up sin saldo vuelve a «Para analizar este depto:» o al precio tachado");
  if (!/<div class="av-ticket-t">3 análisis por \$14\.990<span class="av-ticket-s"> · \$4\.997 cada uno<\/span><\/div>/.test(htmlA7)) F("7 · la oferta no es una línea: «3 análisis por $14.990 · $4.997 cada uno»");
  if (/wz-modal-consumo/.test(htmlA7) || /Con pie de|Dividendo|Retorno bruto/.test(tA)) F("7 · con la tarjeta roja el pop-up repite la línea del pack, o muestra el pie y los derivados sin saldo");
  const htmlSinTicket = dibujarPopup(createElement(AvisoAntesDeAnalizar, { ...base, compras: { ...compras, pack: { ...compras.pack, ticket: false, label: "3 análisis · $19.990" }, sin: "Para analizar este depto: 3 análisis por $19.990, sin caducidad." }, ticketVence: null }));
  if (/data-aviso="ticket"|Aprovechar/.test(htmlSinTicket) || !texto(htmlSinTicket).includes("3 análisis por $19.990") || !/wz-cta-modal[^>]*>3 análisis · \$19\.990</.test(htmlSinTicket)) F("7 · sin el ticket el pop-up sin saldo no vuelve al pack de tres de siempre");
  const htmlCon = dibujarPopup(createElement(AvisoAntesDeAnalizar, { ...base, uso: con, compras, ticketVence: "mañana 11:17" }));
  if (/sin-titulo|data-aviso="ticket"/.test(htmlCon) || !texto(htmlCon).includes("¿Analizar este depto?")) F("7 · con saldo aparecen el título rojo o la tarjeta del ticket");
  const copyA: Array<[string, string]> = [[AVISO_ANALIZAR.tituloSin, "No te quedan análisis."], [AVISO_ANALIZAR.aprovechar, "Aprovechar · 3 por $14.990"], [AVISO_ANALIZAR.packTicket, "3 análisis por $14.990"], [AVISO_ANALIZAR.unitario, " · $4.997 cada uno"], [AVISO_ANALIZAR.vence("mañana 11:17"), "· vence mañana 11:17"], [AVISO_ANALIZAR.soloNuevas, "Solo para cuentas nuevas"]];
  for (const [real, esperado] of copyA) if (real !== esperado) F(`7 · «${real}» debía ser «${esperado}»`);
  // Los tres llamadores pasan hasta cuándo vence.
  for (const [f, re] of [["src/app/semanal/semanal-lista.tsx", /ticketVence=\{ticket && cuentaCreadaAt \? cuandoVenceCorto\(cuentaCreadaAt\) : null\}/], ["src/components/deptos/PrimeraSeleccion.tsx", /ticketVence=\{datos\.ticket && datos\.cuentaCreadaAt \? cuandoVenceCorto\(datos\.cuentaCreadaAt\) : null\}/], ["src/app/explorar/explorar-cliente.tsx", /ticketVence=\{datos\.ticket && datos\.cuentaCreadaAt \? cuandoVenceCorto\(datos\.cuentaCreadaAt\) : null\}/]] as const) {
    if (!re.test(codigo(f))) F(`7 · ${f} no le pasa al pop-up hasta cuándo vence el ticket`);
  }
  // B · la pantalla de compra con el ticket vivo.
  const compra = codigo("src/app/checkout/compra-cliente.tsx");
  const posB = orden(compra, ['data-compra="ticket"', "{CHECKOUT_PACK.soloNuevas}", 'data-compra="vence"', "{CHECKOUT_PACK.venceCorto(cuandoVenceCorto(packCreadoAt))}", 'data-compra="producto"', 'data-compra="precio"', 'data-compra="tachado">{fmtCLP(TRES_PRECIO_CLP)}', 'data-compra="incluye"', "{CHECKOUT_PACK.primeroAlPagar.antes}", 'data-compra="depto"', "{CHECKOUT_PACK.primeroAlPagar.despues}"]);
  if (!enOrden(posB)) F(`7 · la pantalla de compra con el ticket no es etiqueta → vence → Pack de 3 → precio con el tachado → «3 análisis que no vencen. El primero, para X, se genera al pagar.» (${posB.join(",")})`);
  if (!/\{esPack && packCreadoAt && !packVencido && \(\s*<p className="mt-5 flex items-center justify-between gap-3" data-compra="ticket">/.test(compra)) F("7 · la etiqueta y el vencimiento aparecen sin el ticket vivo");
  if (CHECKOUT_PACK.soloNuevas !== "Solo para cuentas nuevas" || CHECKOUT_PACK.venceCorto("mañana 11:17") !== "Vence mañana 11:17" || `${CHECKOUT_PACK.primeroAlPagar.antes}X${CHECKOUT_PACK.primeroAlPagar.despues}` !== "El primero, para X, se genera al pagar.") F("7 · el copy del ticket en la compra no es el del mockup");
  // C · «Pago confirmado» desde un depto.
  const ret = codigo("src/app/payments/return/page.tsx");
  if (!/\{alDepto \? \(\s*<>[\s\S]*?<p className=\{PLANO\.bajada\} data-retorno="al-depto">\{RETORNO\.desdeDepto\.antes\}<b className="text-\[var\(--franco-text\)\]">\{alDepto\.nombre\}<\/b>\{RETORNO\.desdeDepto\.despues\}<\/p>\s*<div [^>]*role="progressbar"[^>]*data-retorno-barra>/.test(ret) || !/\{saldo != null && saldo > 0 && <p [^>]*data-retorno="quedan">\{RETORNO\.quedanOtros\(saldo - 1\)\}<\/p>\}/.test(ret)) F("7 · «Pago confirmado» desde un depto no dice «Franco está analizando X. En unos segundos se abre el informe.» con la barra y cuántos le quedan");
  if (`${RETORNO.desdeDepto.antes}X${RETORNO.desdeDepto.despues}` !== "Franco está analizando X. En unos segundos se abre el informe." || RETORNO.quedanOtros(2) !== "Te quedan 2 análisis para cualquier otro depto." || RETORNO.pagado.titulo !== "Pago confirmado.") F("7 · el copy de «Pago confirmado» no es el del mockup");
  // E · el aviso de Explorar sin saldo sigue (tier EXPLORAR): acá solo que la entrada sin saldo lo abre.
  if (!/const entrada = estadoDeEntrada\(inicial\.saldo\);\s*const \[avisoSinSaldo, setAvisoSinSaldo\] = useState\(entrada\.aviso\);/.test(codigo("src/app/explorar/explorar-cliente.tsx"))) F("7 · /explorar sin saldo no abre el aviso E al entrar");

  if (fallas.length === 0) console.log("  ✓ PUERTA-B-DASHBOARD: la oferta con o sin saldo mientras el ticket vive; el analizado como fila compacta en su posición; las dos preguntas ocultas para la puerta A; la selección diaria para «comprar ya»; el orden del dashboard, el mapa y el ticket como oferta");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  void runPuertaBDashboardTier().then(({ hard }) => process.exit(hard > 0 ? 1 : 0));
}

// ─── ACTA · verificado EN ROJO (24-oct-2026) ─────────────────────────────────
//   Contra el código de antes del goal (383e6aae, en un árbol aparte): los módulos nuevos no existen y las 7 secciones
//   caen en rojo por construcción (7 fallas); el runner no se cae.
//   Por mutación (scratchpad mutar-dashboard.cjs, cada archivo restaurado byte a byte):
//   M1  la oferta solo sin saldo ............................................... ROJO (§1)
//   M2  las preguntas también a la puerta A .................................... ROJO (§1, §5)
//   M3  «Se renueva» siempre el lunes .......................................... ROJO (§1, §6)
//   M4  la oferta debajo de «Invita a alguien» ................................. ROJO (§2)
//   M5  la página decide la oferta sin la regla ................................ ROJO (§2)
//   M6  el analizado como tarjeta .............................................. ROJO (§4)
//   M7  el analizado al final .................................................. ROJO (§4)
//   M8  las preguntas siempre .................................................. ROJO (§5)
//   M9  la frecuencia siempre semanal .......................................... ROJO (§6)
//   M10 manda aunque no haya nuevos ............................................ ROJO (§6)
//   M11 avisarPersona no corta en «nada» ....................................... ROJO (§6)
//   M12 el cron de la diaria, los lunes ........................................ ROJO (§6)
//   M13 los pines numerados al revés ........................................... ROJO (§3)
//   M14 la URL con marcadores .................................................. ROJO (§3)
//   M15 el encuadre sin margen ................................................. VERDE con la fixture de cinco deptos (el
//       zoom elegido era el mismo con o sin margen) → fixture nueva: dos deptos a 170 puntos del centro al zoom 14, que con
//       margen van al 13 ..................................................... ROJO (§3)
//   M16 el pop-up sin la tarjeta del ticket .................................... ROJO (§7)
//   M17 el pop-up sin el título rojo ........................................... ROJO (§7)
//   M18 la compra sin el tachado ............................................... ROJO (§7)
//   M19 «Pago confirmado» sin cuántos quedan ................................... ROJO (§7)
//   M20 otro copy de la frecuencia ............................................. ROJO (§2, §6)
//   M21 «Comprar solo 1» como enlace ........................................... ROJO (§7)
//   M22 la etiqueta sin las pendientes ......................................... ROJO (§5)
//   M23 la píldora sin «Ver planes» ............................................ ROJO (§1)
//   23/23 en rojo. Lo que el QA cazó y el tier no medía antes: la modalidad nacía escrita por defecto en /deptos (la pregunta
//   nacía contestada; perfilManualDeElecciones) y contestar «Arriendo tradicional» igual a lo inferido no llegaba al PUT
//   (cambiosDelPerfil con `contestadas`): los dos entraron en §5.
