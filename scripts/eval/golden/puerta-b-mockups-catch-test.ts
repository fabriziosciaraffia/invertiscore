// ============================================================================
// TIER PUERTA-B-MOCKUPS — la puerta B, parte 1, según los mockups (23-oct-2026, decisión de Fabrizio; `docs/puerta-b-mockups/`:
// `1b-deptos.html`, `2-estas-dentro.html` y los pop-ups D1 y D2 de `4-ticket-y-popups.html`).
//
//   1 · /deptos: SIN COMUNA ELEGIDA NO HAY CORREO —ni el campo, ni Google, ni el número—; con ella, la tarjeta del número
//       («12 de 310 publicados convienen») y la del correo con «Entrar con Google» primero, «o con tu correo», el campo y
//       «Quiero verlos». Dibujado de verdad (renderToStaticMarkup), no leído del código.
//   2 · «ESTÁS DENTRO» SIN LAS DOS PREGUNTAS: «Bienvenido, estás dentro.», la tarjeta roja del regalo, «Tu selección», «Tu
//       perfil de búsqueda» con «Editar» al dashboard y «Ir a mi dashboard»; sin modalidad, sin «cuándo», sin pie ni plazo,
//       sin lo del correo. La cabecera de «Tu selección» dibujada.
//   3 · EL POP-UP RECALCULA AL CAMBIAR EL PIE: la combinación elegida se valida, el cambio de veredicto se dice con las cifras
//       de antes y de ahora, el botón pasa a «Analizar igual», y NUNCA SE COBRA SIN EL VEREDICTO RECALCULADO (bloqueaAnalizar,
//       cableado al botón). La ruta de recálculo y la de analizar aceptan la combinación elegida solo sobre una selección
//       propia (la de otra cuenta, 403 antes de leer nada). D1 dibujado.
//   4 · EL ORDEN ES FIJO: `ordenFijo` respeta lo que ya estaba y pone lo nuevo después; `elegirSemanal` y `primerosDeptos`
//       son deterministas a igual puntaje (dos órdenes de entrada, una misma lista); la cola del día, el armado del domingo y
//       los primeros de la noche lo usan.
//   5 · LOS TRES CAMPOS SE REUTILIZAN en el perfil de la casa (valorDePerfil, con lo que el perfil tiene y no es una opción).
// Verificado EN ROJO contra el código de hoy (HEAD 7c0264b7) y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/puerta-b-mockups-catch-test.ts
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
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
function dibujarConRouter(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up se monta en un portal sobre `document.body`: en el servidor se dibuja en el lugar con un `document` de mentira. */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujarConRouter(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
const textos = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const orden = (s: string, marcas: string[]) => { const ix = marcas.map((m) => s.indexOf(m)); return ix.every((i) => i >= 0) && ix.every((i, k) => k === 0 || i > ix[k - 1]); };

type Respuesta = typeof import("../../../src/lib/deptos/respuesta");
type Aviso = typeof import("../../../src/lib/guia/aviso-analizar");
type Semanal = typeof import("../../../src/lib/guia/semanal");
type DelDia = typeof import("../../../src/lib/guia/del-dia");

export async function runPuertaBMockupsTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PUERTA-B-MOCKUPS (/deptos sin comuna no pide el correo; «Estás dentro» sin las dos preguntas; el pop-up recalcula; el orden es fijo · 0 tokens) ───");
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const respuesta = cargar<Respuesta>("src/lib/deptos/respuesta");
  const aviso = cargar<Aviso>("src/lib/guia/aviso-analizar");
  const semanal = cargar<Semanal>("src/lib/guia/semanal");
  const delDia = cargar<DelDia>("src/lib/guia/del-dia");

  try {
    // ── 1 · /deptos: SIN COMUNA NO HAY CORREO ──
    try {
      const cli = cargar<typeof import("../../../src/app/deptos/deptos-cliente")>("src/app/deptos/deptos-cliente");
      if (!cli || !respuesta) throw new Error("no carga /deptos");
      const R = respuesta;
      const rango = R.ELECCIONES_POR_DEFECTO.rango;
      const sin = dibujarConRouter(createElement(cli.DeptosCliente, { sesion: null, portada: { noche: { revisados: 21453, convienen: 4886 }, inicial: null, comunas: [], rango } }));
      if (/type="email"|data-deptos="banda"|data-deptos="google"|data-deptos="respuesta"|Quiero verlos|Entrar con Google/.test(sin)) F("1 · /deptos sin comuna elegida muestra el correo, Google o el número");
      const t = textos(sin);
      if (!t.includes(R.DEPTOS_COPY.titulo) || !t.includes("Se van rápido.") || !t.includes("¿Qué buscas?") || !t.includes("Elige una comuna") || !t.includes(R.DEPTOS_COPY.eligeYTeDecimos)) F("1 · /deptos sin comuna no muestra el título, la bajada y la tarjeta «¿Qué buscas?» con «Elige una comuna»");
      if (!/<select[^>]*data-campo="comuna"[^>]*data-vacio="1"/.test(sin) || !/<select[^>]*data-campo="tipologia"/.test(sin) || !/<select[^>]*data-campo="rango"/.test(sin)) F("1 · los tres campos no son selects con la comuna vacía marcada");
      if (!/<option value="2" selected="">2 dormitorios<\/option>|<option selected="" value="2">2 dormitorios<\/option>/.test(sin) || !/UF 3\.000 a 4\.000/.test(sin)) F("1 · la tipología y el rango no vienen puestos (2 dormitorios, UF 3.000 a 4.000)");
      if (!t.includes("las +21.000 publicaciones") || !t.includes("Anoche, 4.886 deptos.") || !/data-deptos="ver-analisis" href="\/demo">Ver un análisis real/.test(sin)) F("1 · la prueba con las cifras de la noche y «Ver un análisis real» no está");
      // Con la comuna elegida (la portada con `?comuna=` trae la respuesta): el número y el correo, en ese orden.
      const v = R.validarElecciones({ comunas: ["Providencia"], tipologias: ["2"], rango, modalidad: "ltr" });
      if (!v.ok) throw new Error("validación");
      const inicial = R.respuestaDeptos(v, [{ comuna: "Providencia", total: 310, comprar20: 12, comprar30: 20 }], []);
      const con = dibujarConRouter(createElement(cli.DeptosCliente, { sesion: null, portada: { noche: null, inicial, comunas: ["Providencia"], rango } }));
      const tc = textos(con);
      if (!/data-deptos="cifra">12<\/span><span class="dp-resto">de 310 publicados convienen</.test(con) || !tc.includes(R.DEPTOS_COPY.nota)) F("1 · con la comuna, la tarjeta del número no dice «12 de 310 publicados convienen» con su nota");
      if (!orden(con, ['data-deptos="campos"', 'data-deptos="respuesta"', 'data-deptos="banda"', 'data-deptos="google"', "o con tu correo", 'type="email"', "Quiero verlos", "Sin contraseña: te mandamos un código", 'data-deptos="prueba"']))
        F("1 · con la comuna, el correo no va después del número con Google primero, «o con tu correo», el campo, «Quiero verlos» y la nota, y la prueba al final");
      if (!tc.includes("Regístrate gratis y revísalos ahora mismo.") || !tc.includes("Los 12 te llegan al correo en minutos, con un análisis de regalo para el que más te interese.")) F("1 · la tarjeta del correo no dice el título y la bajada del mockup con el número");
      if (!/<button type="button" class="dp-google"[^>]*data-deptos="google"><svg/.test(con)) F("1 · «Entrar con Google» no lleva la G oficial");
      if (/pie 20|25 años|plazo/i.test(tc)) F("1 · la pantalla de elegir habla del pie o del plazo");
      // Las dos puertas cortan sin comuna en el código, no solo en lo que se dibuja.
      const dc = codigo("src/app/deptos/deptos-cliente.tsx");
      for (const fn of ["async function pedirCodigo", "async function conGoogle"]) {
        if (!/if \(!puedePedirCorreo\(comunas\)\) return;/.test(entre(dc, fn, "\n  }\n"))) F(`1 · ${fn.replace("async function ", "")} no corta sin comuna`);
      }
    } catch (e) {
      F(`1 · no corrió: ${(e as Error).message}`);
    }

    // ── 2 · «ESTÁS DENTRO» SIN LAS DOS PREGUNTAS ──
    try {
      if (!respuesta) throw new Error("no carga respuesta");
      const E = respuesta.ESTAS_DENTRO_DEPTOS;
      if (E.titulo !== "Bienvenido, estás dentro." || E.regalo.kicker !== "Regalo de bienvenida" || E.regalo.titulo !== "Tienes un análisis de regalo." || E.regalo.bajada !== "Úsalo en el depto que más te interese de abajo."
        || E.perfil.kicker !== "Tu perfil de búsqueda" || E.perfil.editar !== "Editar" || E.perfil.hrefEditar !== "/dashboard#perfil"
        || E.perfil.nota !== "Con este perfil te hacemos llegar una selección actualizada todos los lunes. Puedes editar los parámetros y la frecuencia en tu dashboard."
        || E.dashboard !== "Ir a mi dashboard" || E.hrefDashboard !== "/dashboard") F("2 · el copy de «Estás dentro» no es el del mockup");
      const dc = codigo("src/app/deptos/deptos-cliente.tsx");
      const dentro = entre(dc, 'if (paso === "dentro") {', 'if (paso === "agregar" && agregar) {');
      if (!dentro) F("2 · no se encuentra la pantalla «Estás dentro»");
      if (/data-deptos="cuando"|data-deptos="modalidad"|elegirCuando|elegirModalidad|MODALIDADES_DEPTOS|horizonte/i.test(dentro) || /elegirCuando|elegirModalidad|MODALIDADES_DEPTOS|HorizonteCompra/.test(dc))
        F("2 · «Estás dentro» (o /deptos) sigue preguntando la modalidad o el «cuándo» (van al perfil del dashboard)");
      if (/type="email"|PIE_DEPTOS|PLAZO_DEPTOS|piePct|plazoAnios|DEPTOS_FIN|correo/i.test(dentro)) F("2 · «Estás dentro» habla del pie, el plazo o el correo");
      if (!orden(dentro, ['<h1 className="dp-titulo">{ESTAS_DENTRO_DEPTOS.titulo}</h1>', 'data-deptos="regalo"', "{ESTAS_DENTRO_DEPTOS.regalo.kicker}", "{ESTAS_DENTRO_DEPTOS.regalo.titulo}", "{ESTAS_DENTRO_DEPTOS.regalo.bajada} {textoVence(regaloVence)}", '<PrimeraSeleccion encabezado="dentro" />', 'data-deptos="perfil"', "{lineaPerfil(busca)}", 'data-deptos="editar"', "{ESTAS_DENTRO_DEPTOS.perfil.nota}", 'data-deptos="ir-panel"']))
        F("2 · «Estás dentro» no es el título, la tarjeta roja del regalo, «Tu selección», «Tu perfil de búsqueda» con «Editar» y «Ir a mi dashboard», en ese orden");
      if (!/\{regaloVence && \(\s*<section className="dp-regalo" data-deptos="regalo"/.test(dentro)) F("2 · la tarjeta roja no va solo con el regalo vivo");
      // La cabecera de «Tu selección», dibujada (sin datos todavía: el título sin contar y la bajada).
      const ps = cargar<typeof import("../../../src/components/deptos/PrimeraSeleccion")>("src/components/deptos/PrimeraSeleccion");
      if (!ps || !delDia) throw new Error("no carga la selección");
      // El título cuenta los deptos y el botón dice el regalo (lo que la cabecera dibujada, sin datos, no puede mostrar).
      if (delDia.tituloSeleccion(5) !== "Franco eligió estos 5 deptos para tu búsqueda." || delDia.textoAnalizar(true) !== "Analizar este · usa tu regalo" || delDia.textoAnalizar(false) !== "Analizar este")
        F("2 · el título no cuenta los deptos o el botón no dice «Analizar este · usa tu regalo»");
      const html = dibujarConRouter(createElement(ps.PrimeraSeleccion, { encabezado: "dentro" }));
      const th = textos(html);
      if (!/<p class="dp-kicker">Tu selección<\/p><h2 class="dp-h2" data-primera="titulo">Tu selección<\/h2>/.test(html) || !th.includes(delDia.PRIMERA_SELECCION.bajada) || !th.includes(delDia.PRIMERA_SELECCION.cargando)) F("2 · la cabecera de «Tu selección» no se dibuja con el kicker, el título y la bajada");
      if (/guia-av|guia-bloque|Visto publicado|Elegido para tu búsqueda/.test(html)) F("2 · la selección vuelve a las tarjetas viejas o a la marca por tarjeta");
      const psc = codigo("src/components/deptos/PrimeraSeleccion.tsx");
      if (!/\{generando === it\.avisoId \? GUIA\.analizando : textoAnalizar\(usaRegalo\)\}/.test(psc)) F("2 · el botón de la tarjeta no dice el regalo cuando lo hay (textoAnalizar(usaRegalo))");
      if (!/<span className="sel-pin" aria-hidden="true">\{i \+ 1\}<\/span>/.test(psc) || !/data-primario=\{i === 0 \? "1" : undefined\}/.test(psc)) F("2 · las tarjetas no llevan el pin numerado, o el primero no va en tinta");
      if (!/<span className="sel-v" data-veredicto=\{it\.veredicto\}>\{etiquetaVeredicto\(it\.veredicto, "frase"\)\}\{it\.score != null \? ` · \$\{it\.score\}` : ""\}<\/span>/.test(psc)) F("2 · el veredicto de la tarjeta no es «Comprar · 91» con su color");
    } catch (e) {
      F(`2 · no corrió: ${(e as Error).message}`);
    }

    // ── 3 · EL POP-UP RECALCULA AL CAMBIAR EL PIE ──
    try {
      if (!aviso) throw new Error("no carga aviso-analizar");
      const A = aviso;
      // La combinación elegida: válida dentro de los topes; lo demás, null (se usa la de la selección).
      if (JSON.stringify(A.combinacionElegida({ piePct: 10, plazoAnios: 25 })) !== '{"piePct":10,"plazoAnios":25}' || A.combinacionElegida({ piePct: 70, plazoAnios: 25 }) || A.combinacionElegida({ piePct: 20, plazoAnios: 25.5 })
        || A.combinacionElegida({ piePct: 20, plazoAnios: 45 }) || A.combinacionElegida({}) || A.combinacionElegida({ piePct: "10", plazoAnios: "25" }) || A.combinacionElegida({ piePct: 20, plazoAnios: 5 }))
        F("3 · la combinación elegida no se valida (o acepta cualquier cosa)");
      if (JSON.stringify(A.PIES_AVISO) !== "[10,20,30]" || JSON.stringify(A.PLAZOS_AVISO) !== "[20,25,30]" || JSON.stringify(A.conActual(A.PIES_AVISO, 15)) !== "[10,15,20,30]" || JSON.stringify(A.conActual(A.PLAZOS_AVISO, 25)) !== "[20,25,30]")
        F("3 · los selectores no son 10/20/30 % y 20/25/30 años (con el actual sumado)");
      const base = { combo: { piePct: 20, plazoAnios: 25 }, veredicto: "COMPRAR", score: 88, flujo: 88363 };
      const peor = { combo: { piePct: 10, plazoAnios: 25 }, veredicto: "AJUSTA SUPUESTOS", score: 71, flujo: -45120 };
      const c = A.cambioDeVeredicto(base, peor);
      if (c?.titulo !== "Con pie 10 % este depto da Ajustar." || c.detalle !== "Flujo mensual −$45.120 de tu bolsillo. Con 20 % daba Comprar 88 y +$88.363.") F(`3 · la tarjeta del cambio no dice lo del mockup: ${JSON.stringify(c)}`);
      if (A.cambioDeVeredicto(base, { ...base, combo: { piePct: 30, plazoAnios: 25 }, score: 92 })) F("3 · la tarjeta del cambio sale aunque el veredicto no cambió");
      const c2 = A.cambioDeVeredicto(base, { ...peor, combo: { piePct: 10, plazoAnios: 30 } });
      if (c2?.titulo !== "Con pie 10 % y 30 años este depto da Ajustar." || !c2.detalle.includes("Con 20 % y 25 años daba Comprar 88")) F("3 · con el plazo cambiado, la tarjeta no lo nombra");
      if (A.textoBotonAnalizar(true) !== "Analizar igual" || A.textoBotonAnalizar(false) !== "Analizar") F("3 · el botón no pasa a «Analizar igual» cuando el veredicto cambió");
      if (A.lineaVeredicto(base) !== "Comprar 88 · flujo +$88.363 te queda" || A.lineaVeredicto(peor) !== "Ajustar 71 · flujo −$45.120 de tu bolsillo" || A.lineaVeredicto({ veredicto: null, score: null, flujo: null }) !== null) F("3 · la línea del veredicto no es «Comprar 88 · flujo +$88.363 te queda»");
      if (A.textoGuardarPerfil({ piePct: 10, plazoAnios: 25 }) !== "Guardar 10 % y 25 años como mi perfil de búsqueda") F("3 · la casilla no dice «Guardar 10 % y 25 años como mi perfil de búsqueda»");
      // NUNCA SE COBRA SIN EL VEREDICTO RECALCULADO.
      if (!A.bloqueaAnalizar({ sin: false, esBase: false, recalculando: true, evaluacion: null }) || !A.bloqueaAnalizar({ sin: false, esBase: false, recalculando: false, evaluacion: null })
        || A.bloqueaAnalizar({ sin: false, esBase: false, recalculando: false, evaluacion: peor }) || A.bloqueaAnalizar({ sin: false, esBase: true, recalculando: false, evaluacion: null }) || A.bloqueaAnalizar({ sin: true, esBase: false, recalculando: true, evaluacion: null }))
        F("3 · con otra combinación se puede analizar sin el veredicto recalculado (o la base queda bloqueada)");
      const av = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
      if (!/const bloqueado = bloqueaAnalizar\(\{ sin, esBase, recalculando, evaluacion \}\);/.test(av) || !/async function analizar\(\) \{\s*if \(bloqueado \|\| guardando\) return;/.test(av) || !/bloqueado=\{bloqueado\}/.test(av)) F("3 · el pop-up no bloquea «Analizar» mientras recalcula");
      if (!/disabled=\{submitting \|\| bloqueado\}/.test(codigo("src/components/formulario-v4/ModalPlausibilidad.tsx"))) F("3 · el modal no deshabilita el principal con el bloqueo");
      // Cada cambio recalcula; una respuesta tardía de otra combinación no pisa; «Analizar» lleva la combinación a la vista y
      // la casilla guarda el perfil antes.
      if (!/void recalcular\(combo\)\.then\(\(r\) => \{\s*if \(n !== pedido\.current\) return;/.test(av) || !/\}, \[combo\.piePct, combo\.plazoAnios, esBase\]\);/.test(av) || !/setEvaluacion\(\{ combo, veredicto: r\.veredicto, score: r\.score, flujo: r\.flujo \}\);/.test(av))
        F("3 · el pop-up no recalcula en cada cambio (o una respuesta tardía pisa a la nueva)");
      if (!/if \(!esBase && guardar\) \{\s*setGuardando\(true\);\s*await fetch\("\/api\/perfil-busqueda", \{ method: "PUT"[^\n]*piePct: combo\.piePct, plazoAnios: combo\.plazoAnios[^\n]*\n\s*setGuardando\(false\);/.test(av) || !/\n\s*alAnalizar\(combo\);\s*\n\s*\}/.test(av) || !/submitting=\{analizando \|\| guardando\}/.test(av)) F("3 · «Analizar» no lleva la combinación a la vista, o la casilla no guarda el perfil antes");
      if (!/data-aviso="pie"/.test(av) || !/data-aviso="plazo"/.test(av) || !/\{cambio && \(\s*<div className="av-cambio" data-aviso="cambio">/.test(av) || !/labelConfirmar=\{sin \? \(compras \? compras\.pack\.label : AVISO_ANALIZAR\.comprar\) : textoBotonAnalizar\(!!cambio\)\}/.test(av) || !/onClick=\{\(\) => setCambiando\(true\)\} data-aviso="cambiar"/.test(av))
        F("3 · faltan los selectores, la tarjeta del cambio, «Cambiar» o el botón «Analizar igual»");
      // Las rutas: el recálculo valida la combinación y la selección; analizar acepta la elegida solo con el token.
      const rr = codigo("src/app/api/deptos/recalcular/route.ts");
      if (!/const combo = combinacionElegida\(b\);/.test(rr) || !/!combo\) return NextResponse\.json\(\{ error: "datos" \}, \{ status: 400 \}\);/.test(rr) || !/recalcularAviso\(createServiceClient\(\), \{ userId: user\.id, token: b\.semanal, origenId, avisoId: b\.avisoId, combo \}\)/.test(rr)) F("3 · la ruta de recálculo no valida la combinación o no exige el token");
      const rs = codigo("src/lib/guia/recalcular-servidor.ts");
      if (!/if \(!sel \|\| sel\.user_id !== p\.userId \|\| sel\.origen_analysis_id !== p\.origenId\) return \{ ok: false, status: 403, error: "seleccion" \};/.test(rs) || !/sondaConPatch\(body as never, cfg\.uf, aviso\.medianaComuna as never, ahora, \{\}\)/.test(rs)) F("3 · el recálculo no exige una selección propia, o no usa la sonda del motor");
      const an = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
      if (!/const elegida = typeof b\.semanal === "string" \? combinacionElegida\(b\) : null;/.test(an) || (an.match(/combo = deLaFila \? elegida \?\? deLaFila : null;/g) ?? []).length !== 2) F("3 · «Analizar» no analiza con la combinación elegida en el pop-up (o la acepta sin el token)");
      // Con una base de mentira: la selección de OTRA cuenta corta en 403 antes de leer nada más.
      const srv = cargar<typeof import("../../../src/lib/guia/recalcular-servidor")>("src/lib/guia/recalcular-servidor");
      if (!srv) F("3 · falta lib/guia/recalcular-servidor.ts");
      else {
        const lecturas: string[] = [];
        const fila = { id: "s1", user_id: "otra", semana: "2026-10-27", token: "a".repeat(32), items: [{ avisoId: "11111111-1111-4111-8111-111111111111" }], combinacion: { piePct: 20, plazoAnios: 25 }, origen_analysis_id: null, variante: "tarjetas", enviada_at: null, perfil: {}, items_str: [], estado_str: null, combinacion_str: null, origen_str_analysis_id: null };
        const cadena = (tabla: string) => { const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: async () => ({ data: tabla === "semanal_selecciones" ? fila : null, error: null }), then: undefined }; lecturas.push(tabla); return q; };
        const admin = { from: cadena, rpc: async () => ({ data: null, error: null }) } as never;
        const r = await srv.recalcularAviso(admin, { userId: "yo", token: fila.token, origenId: null, avisoId: fila.items[0].avisoId, combo: { piePct: 10, plazoAnios: 25 } });
        if (r.ok || r.status !== 403 || lecturas.some((t) => t !== "semanal_selecciones" && t !== "avisos_inmediatos")) F(`3 · el recálculo sobre la selección de otra cuenta no corta en 403 antes de leer el aviso (${JSON.stringify(r)}; leyó ${lecturas.join()})`);
        const r2 = await srv.recalcularAviso(admin, { userId: "otra", token: fila.token, origenId: null, avisoId: "22222222-2222-4222-8222-222222222222", combo: { piePct: 10, plazoAnios: 25 } });
        if (r2.ok || r2.status !== 403) F("3 · el recálculo de un depto que no está en la selección no corta en 403");
      }
      // D1, dibujado: la tarjeta gris, «Con pie de 20 % y plazo de 25 años · Cambiar», el dividendo y el retorno, «Usa tu
      // análisis de regalo.», «Analizar» y «Cancelar».
      const cmp = cargar<typeof import("../../../src/components/guia/AvisoAntesDeAnalizar")>("src/components/guia/AvisoAntesDeAnalizar");
      if (!cmp) throw new Error("no carga el pop-up");
      const html = dibujarPopup(createElement(cmp.AvisoAntesDeAnalizar, {
        depto: { comuna: "Providencia", tipologia: "2D1B", m2: 46, precioUF: 3275, veredicto: "COMPRAR", score: 88, flujo: 88363 },
        combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.2, uf: 39500, arriendo: 620000 }, uso: { tipo: "regalo", vence: null }, rutaCompra: "/dashboard",
        alAnalizar: () => {}, alCancelar: () => {}, recalcular: async () => null,
      }));
      const th = textos(html);
      if (!orden(html, ['data-modal="aviso-analizar"', "¿Analizar este depto?", 'data-aviso="depto"', "Providencia · 2D1B · 46 m² · UF 3.275", 'data-aviso="veredicto"', "Comprar 88 · flujo +$88.363 te queda", "el enlace a la publicación", 'data-aviso="combo"', "Con pie de <b>20 %</b> y plazo de <b>25 años</b>", 'data-aviso="cambiar"', "Cambiar", 'data-aviso="derivados"', "Dividendo", "Retorno bruto", "Usa tu análisis de regalo.", ">Analizar<", ">Cancelar<"]))
        F(`3 · D1 no se dibuja como el mockup: ${th.slice(0, 300)}`);
      if (/data-aviso="pie"|data-aviso="guardar"|Analizar igual|Precio por m²|Renta larga|de tu perfil/.test(html)) F("3 · D1 muestra los selectores, la casilla, «Analizar igual» o lo del wizard antes de tocar «Cambiar»");
    } catch (e) {
      F(`3 · no corrió: ${(e as Error).message}`);
    }

    // ── 4 · EL ORDEN ES FIJO ──
    try {
      if (!semanal) throw new Error("no carga semanal");
      const S = semanal;
      const it = (id: string) => ({ avisoId: id });
      if (S.ordenFijo([it("a"), it("b"), it("c")], [it("c"), it("x"), it("a"), it("y")]).map((i) => i.avisoId).join() !== "a,c,x,y") F("4 · ordenFijo no respeta el orden de lo que ya estaba con lo nuevo después");
      if (S.ordenFijo(null, [it("b"), it("a")]).map((i) => i.avisoId).join() !== "b,a" || S.ordenFijo([], [it("b"), it("a")]).map((i) => i.avisoId).join() !== "b,a") F("4 · sin previos, ordenFijo cambia el orden");
      if (S.ordenFijo([it("z"), it("b"), it("a")], [it("a"), it("b")]).map((i) => i.avisoId).join() !== "b,a") F("4 · un previo que ya no está rompe el orden");
      // elegirSemanal es determinista a igual puntaje: dos órdenes de entrada, una misma lista (puntaje, flujo, id).
      type C = { avisoId: string; scoreCron: number | null; flujo: number };
      const cands: C[] = [{ avisoId: "d", scoreCron: 80, flujo: 100 }, { avisoId: "b", scoreCron: 80, flujo: 300 }, { avisoId: "c", scoreCron: 80, flujo: 300 }, { avisoId: "a", scoreCron: 80, flujo: 100 }];
      const evaluar = async (c: C) => ({ veredicto: "COMPRAR", score: 80, flujo: c.flujo });
      const publicado = async () => "publicado" as const;
      const uno = await S.elegirSemanal(cands, evaluar, publicado);
      const otro = await S.elegirSemanal([...cands].reverse(), evaluar, publicado);
      const ids = (g: { items: Array<{ c: C }> }) => g.items.map((x) => x.c.avisoId).join();
      if (ids(uno) !== "b,c,a,d" || ids(otro) !== "b,c,a,d") F(`4 · a igual puntaje la selección depende del orden de entrada (${ids(uno)} / ${ids(otro)})`);
      // La cola del día, el domingo y los primeros de la noche lo usan.
      const dd = codigo("src/lib/guia/del-dia-servidor.ts");
      if (!/export const COLUMNAS_DEL_DIA = "id, user_id, token, armada_at, intentos, items, items_str";/.test(dd) || !/const aItems = \(g: Elegidos, previos: ItemSemanal\[\] \| null \| undefined\): ItemSemanal\[\] =>\s*ordenFijo\(previos,/.test(dd)
        || !/const \{ data: actual \} = await admin\.from\("semanal_selecciones"\)\.select\("items, items_str"\)\.eq\("id", fila\.id\)\.maybeSingle\(\);/.test(dd)
        || !/largo: \(\(actual\?\.items \?\? fila\.items \?\? null\) as ItemSemanal\[\] \| null\),/.test(dd)
        || !/items: x\.largo \? aItems\(x\.largo, previos\.largo\) : \[\],\s*items_str: x\.corto \? aItems\(x\.corto, previos\.corto\) : \[\],/.test(dd)) F("4 · la cola del correo del día no respeta el orden de lo que la fila tiene AHORA (la pantalla escribe los de la noche mientras la vuelta corre)");
      const ss = codigo("src/lib/guia/semanal-servidor.ts");
      if (!/select\("estado, tipo, items, items_str"\)\.eq\("user_id", userId\)\.eq\("semana", semana\)\.maybeSingle\(\);/.test(ss) || !/items: aItems\(g, informeVisto, previos\.largo\)/.test(ss) || !/items_str: aItems\(g, undefined, previos\.corto\)/.test(ss) || !/ordenFijo\(previosDe,/.test(ss))
        F("4 · el armado del domingo no respeta el orden de lo que la fila ya tenía");
      // Los primeros de la noche: a igual puntaje, por flujo y por id, venga como venga la RPC.
      const dep = cargar<typeof import("../../../src/lib/deptos/servidor")>("src/lib/deptos/servidor");
      if (!dep) F("4 · no carga lib/deptos/servidor");
      else {
        const filas = ["b", "a", "c"].map((id) => ({ id, comuna: "Ñuñoa", superficie_m2: 50, dormitorios: 2, banos: 1, precio_uf: 3500, score_cron: 80, flujo: id === "c" ? 200 : 100, pub_estado: null, pub_at: null }));
        const admin = (orden: typeof filas) => ({ rpc: async () => ({ data: orden, error: null }) }) as never;
        const p = { comunas: ["Ñuñoa"], dorms: [2], ufMin: 0, ufMax: 4000, pie: 20 };
        const uno2 = (await dep.primerosDeptos(admin(filas), p)).map((d) => d.avisoId).join();
        const otro2 = (await dep.primerosDeptos(admin([...filas].reverse()), p)).map((d) => d.avisoId).join();
        if (uno2 !== "c,a,b" || otro2 !== "c,a,b") F(`4 · los primeros de la noche cambian de orden con el orden de la RPC (${uno2} / ${otro2})`);
      }
    } catch (e) {
      F(`4 · no corrió: ${(e as Error).message}`);
    }

    // ── 5 · LOS TRES CAMPOS EN EL PERFIL DE LA CASA ──
    try {
      const casa = cargar<typeof import("../../../src/app/dashboard/casa")>("src/app/dashboard/casa");
      if (!casa?.valorDePerfil) throw new Error("la casa no expone valorDePerfil");
      const a = casa.valorDePerfil({ comunas: ["Ñuñoa", "Macul"], dormitorios: [2], precioMinUf: 3000, precioMaxUf: 4000 });
      if (JSON.stringify(a) !== '{"valor":{"comunas":["Ñuñoa","Macul"],"tipologia":"2","rango":"3000-4000"},"tipologiaExtra":null,"rangoExtra":null}') F(`5 · el perfil no vuelve a los tres campos: ${JSON.stringify(a)}`);
      const b = casa.valorDePerfil({ comunas: ["Ñuñoa"], dormitorios: [1, 2], precioMinUf: null, precioMaxUf: 4500 });
      if (b.valor.tipologia !== "" || b.tipologiaExtra !== "1 y 2 dormitorios" || b.rangoExtra?.chip !== "Hasta UF 4.500" || b.valor.rango !== b.rangoExtra.id) F(`5 · lo que el perfil tiene y no es una opción no se muestra como la actual: ${JSON.stringify(b)}`);
      const cs = codigo("src/app/dashboard/casa.tsx");
      if (!/<CamposBusqueda multiple valor=\{campos\.valor\} tipologiaExtra=\{campos\.tipologiaExtra\} rangoExtra=\{campos\.rangoExtra\} ocupado=\{campoOcupado\} onChange=\{cambiarCampo\} ids="casa" \/>/.test(cs)
        || !/if \(campo === "comuna"\) \{ if \(v\.comunas\.length > 0\) void cambiar\(\{ comunas: v\.comunas \}, \{ comunas: v\.comunas \}\); return; \}/.test(cs)
        || !/if \(r\) void cambiar\(\{ precioMinUf: r\.min, precioMaxUf: r\.max \}, \{ precioMinUf: r\.min, precioMaxUf: r\.max \}\);/.test(cs) || /data-chip="rango"|data-chip="tope"|masComuna|masDormitorio/.test(cs))
        F("5 · el perfil de la casa no usa los tres campos (o no guarda cada cambio)");
      const cb = codigo("src/components/deptos/CamposBusqueda.tsx");
      if (!/\{multiple && \(extras\.length > 0 \|\| \(comuna && valor\.comunas\.length < MAX_COMUNAS_PERFIL\)\) && \(/.test(cb) || !/\{CAMPOS_COPY\.agregarComuna\}/.test(cb)) F("5 · con varias comunas, los campos no ofrecen «+ agregar otra comuna»");
    } catch (e) {
      F(`5 · no corrió: ${(e as Error).message}`);
    }
  } finally {
    if (posthog === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY; else process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }

  if (fallas.length) {
    console.log(`  ✗ PUERTA-B-MOCKUPS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — /deptos sin comuna no pide el correo y con ella muestra el número y la tarjeta del correo del mockup; «Estás dentro» sin las dos preguntas; el pop-up recalcula y nunca cobra sin el veredicto; el orden de la selección es fijo; los tres campos viven en la casa");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (23-oct-2026). CONTRA EL CÓDIGO DE HOY (un worktree limpio en HEAD 7c0264b7 con este archivo copiado): 13
// fallas —los nueve puntos de §1 sobre la página dibujada (el correo sin comuna no, pero los selects, el número «publicados»,
// Google primero, la prueba, el pie y el plazo en la pantalla) y §2 a §5 sin sus módulos (ESTAS_DENTRO_DEPTOS,
// combinacionElegida, ordenFijo, valorDePerfil)—. Y 25 mutaciones (scratchpad mutar-mockups.cjs), cada una restaurada byte a
// byte y verificada por hash, todas ROJAS: M1 el correo sin comuna · M2 sin «o con tu correo» · M3 la comuna no se marca vacía
// · M4 vuelve el «cuándo» a «Estás dentro» · M5 la tarjeta roja sin regalo · M6 otro título · M7 el título de la selección
// sin el número · M8 bloqueaAnalizar nunca bloquea · M9 el pop-up analiza bloqueado · M10 el modal ignora el bloqueo · M11
// analizar ignora la combinación elegida · M12 el recálculo no mira de quién es la selección · M13 otra tarjeta del cambio ·
// M14 la respuesta tardía pisa · M15 ordenFijo no ordena · M16 sin desempate a igual puntaje · M17 la cola del día sin los
// previos · M18 el domingo sin los previos · M19 los primeros sin el desempate por id · M20 la casa esconde los dormitorios
// de varios informes · M21 la ruta de recálculo acepta cualquier combinación · M22 las tarjetas sin el pin · M23 «Analizar
// este» sin «usa tu regalo» · M24 D1 abre con los selectores · M25 la cola lee los previos del encolado y no los de ahora.
// M7, M23 y M25 salieron VERDES la primera vez: el tier medía el módulo (tituloSeleccion, textoAnalizar) o solo una de las
// dos líneas de la cola; se le sumó el cableado al componente y la lectura fresca de la fila. M25 nació del QA en WebKit:
// la primera vuelta de la cola partía con la fila vacía y mandaba el correo con los deptos 3 y 4 al revés que la pantalla.
// Reescritos con acta: CARGA (botones y chips de /deptos y la casa), PUERTA-B §2·§8·§9·§10, PUERTA-B-RECORRIDO §1·§2,
// PRIMERA-SELECCION §6·§7·§9·§12, ENTRADA-ALTA §1, CORREOS-RECORRIDO §5, COMPRA §3, SEMANAL §6, SEMANAL-STR §2,
// WIZARD-INTERIOR §11 (el rojo de la tarjeta del cambio), COMUNAS-DISENO §2 (los rangos).

if (require.main === module) {
  runPuertaBMockupsTier().then((r) => process.exit(r.hard ? 1 : 0));
}
