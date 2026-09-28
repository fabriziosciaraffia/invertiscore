// ============================================================================
// GOLDEN · LA ENTRADA DEL WIZARD: UNA PUERTA, DOS ACCESOS — catch-test (26-sep-2026)
// ============================================================================
//   1 · LA LLEGADA DESDE LA LANDING. Con cobertura arranca en el mapa (con número o sin él); fuera
//       de cobertura, en la portada. La precisión manda si viene; si no, se lee del texto. Con un
//       borrador de otra dirección, la portada pregunta antes de escribir nada.
//   2 · EL MAPA ES UN DESVÍO DE `dir`. `dir` conserva su nombre, el mapa no cuenta como progreso y
//       sigue a `tipo`. La reacción de la pregunta siguiente nombra la dirección.
//   7 · EL MAPA ES SIEMPRE LA SEGUNDA (27-sep-2026, prueba en el teléfono): con número también; el
//       pin parte en la dirección elegida, que no se rebautiza si nadie lo mueve; el mapa lleva los
//       comparables y el conteo del mismo hook que la reacción, y se sigue con «Continuar».
//   8 · EN EL TELÉFONO, UNA HOJA: bajo 768 px el campo abre la hoja de los capítulos —el mismo Modal,
//       con asa, velo y cierre—, con el campo arriba y las sugerencias fijas justo debajo; el widget
//       se vuelve a atar al input de la hoja y cinco sugerencias caben sobre el teclado.
//   3 · LA PORTADA VIEJA SALIÓ ENTERA: chips de comuna, buscador, «¿se paga solo?», «todavía no
//       tengo uno», sus eventos y la ruta de cifras por comuna que solo ella leía.
//   4 · UN SOLO COMPONENTE. La portada es `HeroEntrada` sobre el hook compartido, con los tres
//       caminos: escribir, «Estoy en el depto» y «Marcarlo en el mapa».
//   5 · LOS EVENTOS: camino, permiso y pin movido; `entrada` en los eventos de paso; el embudo cuenta
//       a quien llega desde la landing y tiene su hito.
//   6 · LA GEOCODIFICACIÓN INVERSA: `/api/geocode?lat&lng` nombra el punto con su comuna, y no
//       devuelve nada que no sea una calle. El respaldo por texto ya no exige comuna.
//  10 · LA LEYENDA Y LOS PUNTOS SON LA MISMA LISTA (28-sep-2026, foto de Fabrizio: el mapa dibujaba
//       los 125 arriendos del radio y la leyenda decía «22 propiedades en el sector»). El resumen del
//       radio entrega la muestra y sus puntos desde UNA lista ordenada; el endpoint los pasa como
//       `comparables`; el hook los guarda tal cual; la leyenda cuenta `data.comparables.length` y
//       dice a qué radio; el resto del radio va en gris más tenue y la leyenda lo distingue; y la
//       reacción de la dirección usa el mismo rótulo.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
//   Acta 28-sep-2026 (punto 10): la leyenda con `data.arriendoN` → 2 fallas; `orden.slice(1)` en los puntos → 6
//   fallas; el hook de vuelta a `nearbyProperties` → 2 fallas; `restoRadio = bestMap.all` → 1 falla. Restaurado: verde.
// Solo:  node --import tsx scripts/eval/golden/wizard-entrada-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  borradorEsDeOtraDireccion,
  destinoDeLlegada,
  leerDireccionLlegada,
  leerModoLlegada,
} from "../../../src/components/entrada/llegada";
import { decidirBorrador } from "../../../src/components/formulario-v4/wizardV4Draft";
import {
  ALL_NODES,
  FIX_NODES,
  NODE_TITLE,
  computeNext,
  computePlannedPath,
  progressFor,
  reactionText,
  type WizardV4Answers,
} from "../../../src/components/formulario-v4/wizardV4Nodes";
import { HITOS_FUNNEL } from "../../../src/lib/admin-funnel-hitos";
import { GET as geocodeGET } from "../../../src/app/api/geocode/route";
import { sinCodigoPostal } from "../../../src/lib/geocoding-precision";
import { resumirComparablesRadio } from "../../../src/lib/services/comparables-radio";
import { rotuloComparables } from "../../../src/components/formulario-v4/comparablesRotulo";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

async function conFetch<T>(respuesta: unknown, fn: () => Promise<T>): Promise<T> {
  const previo = globalThis.fetch;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async () => ({ ok: true, json: async () => respuesta })) as any;
  process.env.GOOGLE_MAPS_API_KEY = "k";
  try { return await fn(); } finally {
    globalThis.fetch = previo;
    if (key === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = key;
  }
}

export async function runWizardEntradaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER WIZARD-ENTRADA (una puerta, dos accesos · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · LA LLEGADA ─────────────────────────────────────────────────────────
  const conNumero = leerDireccionLlegada({ direccion: "Av. Irarrázaval 2100, Ñuñoa, Región Metropolitana, Chile", lat: "-33.4535", lng: "-70.6091", comuna: "Ñuñoa" });
  // ACTA 27-sep-2026: arrancaba en `tipo`; desde la prueba en el teléfono el mapa es siempre la segunda.
  if (!conNumero || !conNumero.cubierta || conNumero.precision !== "numero" || destinoDeLlegada(conNumero) !== "mapa") F("1 · una dirección con número y cubierta no arranca en el mapa");
  const sinNumero = leerDireccionLlegada({ direccion: "Av. Irarrázaval, Ñuñoa, Región Metropolitana, Chile", lat: "-33.4539", lng: "-70.6016", comuna: "Ñuñoa" });
  if (!sinNumero || sinNumero.precision !== "calle" || destinoDeLlegada(sinNumero) !== "mapa") F("1 · una dirección sin número no arranca en el mapa");
  const declarada = leerDireccionLlegada({ direccion: "Av. Irarrázaval 2100, Ñuñoa", lat: "-33.4535", lng: "-70.6091", comuna: "Ñuñoa", precision: "calle" });
  if (declarada?.precision !== "calle") F("1 · la precisión que viene en el enlace no manda sobre la que se lee del texto");
  const fuera = leerDireccionLlegada({ direccion: "Av. Alemania 0671, Temuco", lat: "-38.7359", lng: "-72.5904", comuna: "Temuco" });
  if (!fuera || fuera.cubierta || destinoDeLlegada(fuera) !== "portada") F("1 · una comuna fuera de cobertura no arranca en la portada");
  const coordsAjenas = leerDireccionLlegada({ direccion: "Av. Irarrázaval 2100, Ñuñoa", lat: "-33.0245", lng: "-71.5518", comuna: "Ñuñoa" });
  if (!coordsAjenas || coordsAjenas.cubierta) F("1 · unas coordenadas fuera de la cobertura se confirman por enlace");
  if (leerDireccionLlegada({ direccion: "Av. Irarrázaval 2100, Ñuñoa", lng: "-70.6", comuna: "Ñuñoa" }) !== null) F("1 · una llegada sin latitud se acepta");
  // Un parámetro vacío (`?lat=`) es 0 para Number(): sin el guard entraría en el Golfo de Guinea.
  if (leerDireccionLlegada({ direccion: "Av. Irarrázaval 2100, Ñuñoa", lat: "", lng: "-70.6", comuna: "Ñuñoa" }) !== null) F("1 · una llegada con la latitud vacía se acepta como 0");
  if (leerModoLlegada("mapa") !== "mapa" || leerModoLlegada("ubicacion") !== "ubicacion" || leerModoLlegada("otra") !== null) F("1 · `?modo` no se lee como ubicacion|mapa");
  if (borradorEsDeOtraDireccion("Av. Irarrazaval 2100, Ñuñoa, Chile", "Av. Irarrázaval 2100, Ñuñoa") || !borradorEsDeOtraDireccion("Linares 1415, Providencia", "Av. Irarrázaval 2100, Ñuñoa") || borradorEsDeOtraDireccion(null, "x")) F("1 · el borrador de otra dirección no se distingue del de la misma");
  const shell = sinComentarios(leer("src/components/formulario-v4/WizardV4.tsx"));
  if (!/if \(!hayLlegada \|\| llegadaAplicada\.current \|\| !w\.inicializado \|\| w\.draftPendiente\) return;/.test(shell)) F("1 · la llegada no espera a saber si hay un borrador pendiente");
  // ACTA 27-sep-2026: la llegada ya no reparte a `tipo`; con cobertura va al mapa con la precisión que trae.
  if (!/const destino = destinoDeLlegada\(d\);[\s\S]{0,300}?if \(destino === "mapa"\) \{\s*\n\s*const numero = d\.precision === "numero";\s*\n\s*w\.goDetour\("dirMapa", \{ \.\.\.base, direccionConfirmada: undefined, lat: d\.lat, lng: d\.lng, ubicacionPrecision: numero \? "numero" : "calle", mapaOrigen: numero \? "numero" : "sin_numero" \}\);\s*\n\s*\} else \{/.test(shell)) F("1 · la llegada no reparte entre el mapa y la portada");
  if (/w\.answer\("dir"/.test(shell)) F("1 · la llegada confirma una dirección sin pasar por el mapa");
  if (!/const retomarBorrador = \(\) => \{ llegadaAplicada\.current = true; setLlegadaLista\(true\); w\.resumeDraft\(\); \};/.test(shell)) F("1 · retomar el borrador no descarta la llegada: se aplicaría encima");
  if (!/Seguir con \{calle\(direccionInicial\?\.direccion\)\}/.test(shell) || !/Retomar \{calle\(w\.draftPendiente\?\.answers\?\.direccion\)\}/.test(shell)) F("1 · con un borrador de otra dirección la portada no pregunta seguir o retomar");
  const pagina = sinComentarios(leer("src/app/analisis/nuevo-v4/page.tsx"));
  if (!/entrada=\{direccionInicial \|\| modoInicial \? "landing" : "wizard"\}/.test(pagina)) F("1 · la página no marca por qué puerta entró la sesión");

  // ── 2 · EL MAPA, DESVÍO DE `dir` ───────────────────────────────────────────
  if (!ALL_NODES.has("dirMapa") || !FIX_NODES.has("dirMapa")) F("2 · el mapa no es un desvío registrado");
  if (computeNext("dirMapa", {}) !== "tipo") F("2 · después del mapa no viene «tipo»");
  if (computePlannedPath({}).includes("dirMapa")) F("2 · el mapa cuenta como paso del progreso");
  if (computePlannedPath({})[0] !== "dir") F("2 · `dir` dejó de ser la primera pantalla");
  if (progressFor("dirMapa", {}) !== progressFor("dir", {})) F("2 · la barra se mueve en el mapa");
  if (NODE_TITLE.dirMapa !== "¿Dónde queda exactamente?") F("2 · el mapa no pregunta «¿Dónde queda exactamente?»");
  const a: WizardV4Answers = { direccionConfirmada: "Av. Irarrázaval 2100, Ñuñoa, Región Metropolitana, Chile" };
  const r1 = reactionText("dir", a, { comparables: 26, radioM: 1500 });
  if (!r1 || !r1.startsWith("Av. Irarrázaval 2100, Ñuñoa · zona cubierta, 26 comparables a 1,5 km.")) F(`2 · la reacción de la pregunta siguiente no nombra la dirección con el rótulo de la leyenda (${r1})`);
  if (reactionText("dirMapa", a, { comparables: 24, radioM: 500 }) === null) F("2 · confirmar el mapa no lleva la reacción de la dirección");
  // El conteo llega segundos después de confirmar: mientras tanto la frase va sin número (se leía
  // «N propiedades» literal en el preview del 26-sep, en el camino del mapa).
  const sinConteo = reactionText("dirMapa", a, {});
  if (sinConteo !== "Av. Irarrázaval 2100, Ñuñoa · zona cubierta.") F(`2 · sin el conteo todavía, la reacción muestra un marcador (${sinConteo})`);
  if (reactionText("dir", {}, undefined) !== "Zona cubierta.") F(`2 · sin dirección ni conteo, la reacción muestra un marcador (${reactionText("dir", {}, undefined)})`);

  // ── 3 · LA PORTADA VIEJA SALIÓ ─────────────────────────────────────────────
  const ent = sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx"));
  for (const [re, m] of [
    [/se paga solo/i, "«¿se paga solo?»"],
    [/COMUNAS_CHIP|ChipComuna|BuscadorComuna/, "los chips o el buscador de comuna"],
    [/Todavía no tengo uno elegido|SinDeptoScreen/, "«todavía no tengo uno»"],
    [/wizard4_entrada_comuna|wizard4_entrada_sin_depto|wizard4_entrada_cambiar_desde_error/, "los eventos de la portada vieja"],
    [/\/api\/comunas\//, "la lectura de cifras por comuna"],
  ] as const) if (re.test(ent)) F(`3 · vuelve ${m} a la entrada`);
  if (existsSync(join(RAIZ, "src/app/api/comunas/[slug]/stats/route.ts"))) F("3 · la ruta de cifras por comuna sigue viva sin quien la lea");
  if (existsSync(join(RAIZ, "src/components/formulario-v4/useDireccionPlaces.ts"))) F("3 · hay dos hooks de dirección: uno en formulario-v4 y otro compartido");

  // ── 4 · UN SOLO COMPONENTE, TRES CAMINOS ───────────────────────────────────
  if (!/<HeroEntrada\b/.test(ent)) F("4 · la portada no es HeroEntrada");
  const hero = sinComentarios(leer("src/components/entrada/HeroEntrada.tsx"));
  if (!/import \{ useDireccionPlaces, type SeleccionDireccion \} from "\.\/useDireccionPlaces";/.test(hero)) F("4 · el hero no usa el hook compartido");
  if (!/onClick=\{\(\) => onCamino\("ubicacion"\)\}/.test(hero) || !/onClick=\{\(\) => onCamino\("mapa"\)\}/.test(hero)) F("4 · faltan los caminos sin dirección en el hero");
  if (!/¿Ese depto es<br \/><mark>buena inversión<\/mark>\?/.test(hero)) F("4 · el título del hero no es el de la landing");
  if (!/if \(esPortada\) \{\s*\n\s*return \(\s*\n\s*<div ref=\{screenRef\}>\s*\n\s*<EntradaScreen \{\.\.\.screenProps\} banner=\{bannerPortada\}/.test(shell)) F("4 · la portada no se dibuja a pantalla completa con su banner");
  if (!/case "dirMapa":\s*\n\s*return <MapaScreen \{\.\.\.screenProps\} onVolver=\{w\.goBack\} \/>;/.test(shell)) F("4 · el router no monta el mapa");
  if (!/const r = await pedirUbicacion\(\);/.test(ent)) F("4 · «Estoy en el depto» no pide la ubicación del teléfono");
  // Y el sitio tiene que dejar que el navegador la dé: con `geolocation=()` la niega antes de
  // preguntar (medido en el preview del 26-sep: «disabled in this document by permissions policy»).
  const cfg = sinComentarios(leer("next.config.mjs"));
  if (!/key: 'Permissions-Policy', value: '[^']*\bgeolocation=\(self\)[^']*'/.test(cfg)) F("4 · el Permissions-Policy niega la ubicación: «Estoy en el depto» nunca la recibe");
  if (!/if \(r\.estado !== "concedido"\) \{[\s\S]{0,120}?goDetour\("dirMapa", \{ \.\.\.limpio, lat: undefined, lng: undefined, mapaOrigen: "ubicacion", mapaAviso: "sin_ubicacion" \}\);/.test(ent)) F("4 · sin permiso, el mapa no abre sin pin");
  if (!/if \(camino === "mapa"\) \{\s*\n\s*goDetour\("dirMapa", \{ \.\.\.limpio, lat: undefined, lng: undefined, mapaOrigen: "mapa" \}\);/.test(ent)) F("4 · «Marcarlo en el mapa» no abre el mapa sin pin");
  if (!/const listo = !!punto && !!nombre && nombre\.cubierta && !nombrando;/.test(ent)) F("4 · el mapa deja confirmar un punto sin nombre o fuera de cobertura");
  // ACTA 27-sep-2026: se suma el origen «numero», que sin mover conserva su precisión.
  if (!/const sinMover = !movido\.current;\s*\n\s*const precision = sinMover && origen === "numero" \? "numero" : sinMover && origen === "sin_numero" \? "calle" : "pin";/.test(ent)) F("4 · el mapa confirma como «pin» una dirección o una calle que nadie movió");

  // ── 7 · EL MAPA ES SIEMPRE LA SEGUNDA ──────────────────────────────────────
  const onDir = (ent.match(/const onDireccion = \(sel: SeleccionDireccion\) => \{([\s\S]*?)\n  \};/) ?? [])[1] ?? "";
  if (!onDir) F("7 · no encuentro onDireccion en la portada (el extractor no corrió)");
  if (/answer\(/.test(onDir)) F("7 · la portada confirma una dirección sin pasar por el mapa");
  if (!/const numero = sel\.precision === "numero";\s*\n\s*goDetour\("dirMapa", \{ \.\.\.base, direccionConfirmada: undefined, ubicacionPrecision: numero \? "numero" : "calle", mapaOrigen: numero \? "numero" : "sin_numero" \}\);/.test(onDir)) F("7 · con número, la portada no manda al mapa");
  const mapaScr = (ent.match(/export function MapaScreen\(([\s\S]*)$/) ?? [])[1] ?? "";
  if (!mapaScr) F("7 · no encuentro MapaScreen (el extractor no corrió)");
  if (!/<MapaPinAjustable[\s\S]{0,400}?puntos=\{data\.comparables\}\s*\n\s*contexto=\{data\.restoRadio\}\s*\n\s*etiqueta=\{conteo\}/.test(mapaScr)) F("7 · el mapa no muestra los comparables, el resto del radio y la leyenda");
  if (!/<FieldLabel>Ubicación en el mapa<\/FieldLabel>/.test(mapaScr)) F("7 · el mapa no dice «Ubicación en el mapa»");
  if (!/if \(n && n\.cubierta\) patchAnswers\(\{ lat: punto\.lat, lng: punto\.lng, comuna: n\.comuna, ciudad: n\.ciudad \}\);/.test(mapaScr)) F("7 · el punto movido no llega a las respuestas: los comparables son del punto viejo");
  if (!/if \(!movido\.current && nombreInicial\) return;/.test(mapaScr)) F("7 · el mapa rebautiza la dirección elegida sin que nadie mueva el pin");
  if (!/const direccion = sinMover && nombreInicial \? nombreInicial\.direccion : nombre\.direccion;/.test(mapaScr)) F("7 · sin mover el pin, el mapa confirma otra dirección que la elegida");
  if (!/<PrimaryBtn onClick=\{usar\} disabled=\{!listo\}>Continuar →<\/PrimaryBtn>/.test(mapaScr)) F("7 · el mapa no sigue con «Continuar»");
  if (!/numero: \{\s*\n\s*titulo: "Tu dirección"/.test(ent)) F("7 · con número el mapa no dice qué revisar");
  const pinSrc = sinComentarios(leer("src/components/formulario-v4/MapaPinAjustable.tsx"));
  if (!/for \(const p of validos\) \{\s*\n\s*puntosRef\.current\.push\(new google\.maps\.Marker\(/.test(pinSrc) || !/\}, \[puntos, listo\]\);/.test(pinSrc)) F("7 · el mapa no dibuja los comparables ni los redibuja al cambiar");

  // ── 8 · EN EL TELÉFONO, UNA HOJA ───────────────────────────────────────────
  // ACTA 27-sep-2026 (segunda prueba de Fabrizio): la hoja a pantalla completa se sentía como salir
  // de Franco a un formulario. Ahora es el Modal de los capítulos, y estas reglas fijan eso.
  if (!/export const MQ_HOJA = "\(max-width: 767px\)";/.test(hero) || !/window\.matchMedia\(MQ_HOJA\)/.test(hero)) F("8 · el hero no distingue el teléfono");
  if (!/clave: !usaHoja \? "hero" : hoja && Hoja \? "hoja" : "cerrada",/.test(hero)) F("8 · el widget no se vuelve a atar al input de la hoja");
  // desde el 28-sep-2026 el mismo toque arranca Google Maps (`prepararPlaces()`) antes de abrir
  if (!/const abrirHoja = \(\) => \{\s*\n\s*prepararPlaces\(\);\s*\n\s*flushSync\(\(\) => setHoja\(true\)\);\s*\n\s*inputRef\.current\?\.focus\(\);/.test(hero)) F("8 · la hoja no se enfoca en el mismo toque (iOS no abre el teclado)");
  if (!/\{usaHoja \? \(\s*\n\s*<button[^>]*onClick=\{abrirHoja\}/.test(hero)) F("8 · en el teléfono, tocar el campo no abre la hoja");
  if (!/import\("\.\/HojaDireccion"\)\.then\(\(m\) => \{ if \(vivo\) setHojaComp\(\(\) => m\.default\); \}\);/.test(hero) || !/if \(!usaHoja \|\| Hoja\) return;/.test(hero)) F("8 · la hoja no se precarga en el teléfono: el primer toque no alcanzaría a enfocarla");
  if (!/\{Hoja && hoja && \(\s*\n\s*<Hoja abierto onClose=\{\(\) => setHoja\(false\)\}>\s*\n\s*<form className="he-hoja-campo"[^>]*>\s*\n\s*<input\s*\n\s*ref=\{inputRef\}/.test(hero)) F("8 · la hoja no lleva el campo arriba con el input vivo");
  const hojaSrc = sinComentarios(leer("src/components/entrada/HojaDireccion.tsx"));
  if (!/import \{ Modal \} from "@\/components\/analysis\/hallazgos\/vocabulario";/.test(hojaSrc) || !/<Modal abierto=\{abierto\} onClose=\{onClose\}/.test(hojaSrc)) F("8 · la hoja no es el Modal de los capítulos y los pop-ups");
  // Dentro de `.doc-dictamen`, como las hojas del informe: `.doc-tokens` solo trae la paleta cálida
  // vieja y el título en serif (visto en el preview del 27-sep).
  if (!/<div className="doc-dictamen[^"]*"[^>]*>\s*\n\s*<DocTokens \/>\s*\n\s*<TokensHallazgos \/>\s*\n\s*<Modal/.test(hojaSrc)) F("8 · la hoja no monta los tokens y el CSS del Modal dentro de .doc-dictamen (saldría sin asa ni velo, o con la paleta vieja)");
  if (!/createPortal\(/.test(hojaSrc)) F("8 · la hoja no va en portal: una transformación del wizard la dejaría fuera de lugar");
  const hook = sinComentarios(leer("src/components/entrada/useDireccionPlaces.ts"));
  if (!/\}, \[activo, clave, prepararPlaces\]\);/.test(hook)) F("8 · el hook no vuelve a atar el widget cuando cambia el input");
  const css = leer("src/components/entrada/hero-entrada.css");
  if (/\.he-hoja \{[^}]*inset: 0/.test(css) || /he-hoja-cancelar/.test(css + hero)) F("8 · vuelve la hoja a pantalla completa");
  if (!/html\.he-hoja-abierta \.pac-container \{\s*\n\s*position: fixed !important; top: var\(--he-pac-top, [0-9]+px\) !important; left: 0 !important; width: 100% !important; max-width: none !important;/.test(css)) F("8 · las sugerencias no quedan fijas bajo el campo de la hoja, a lo ancho");
  // desde el QA en el teléfono (28-sep-2026) la hoja termina en el pie del ÁREA VISIBLE (visualViewport), no de la ventana
  if (!/const dentro = inp\.getBoundingClientRect\(\)\.bottom - modal\.getBoundingClientRect\(\)\.top;\s*\n\s*const vv = window\.visualViewport;\s*\n\s*const fondo = vv \? vv\.offsetTop \+ vv\.height : window\.innerHeight;\s*\n\s*html\.style\.setProperty\("--he-pac-top", `\$\{Math\.round\(fondo - modal\.offsetHeight \+ dentro \+ 6\)\}px`\);/.test(hero)) F("8 · la posición de las sugerencias no se mide sin la animación de entrada y contra el área visible");

  // ── 9 · EL QA EN EL IPHONE (28-sep-2026): elegir navega, el borrador solo cuando vale, cada paso arranca arriba ──
  const soloMapa = { current: "tipo", history: ["dir", "dirMapa"], answers: { direccion: "Linares 1415, Providencia" } } as never;
  const avanzado = { current: "ent", history: ["dir", "dirMapa", "tipo"], answers: { direccion: "Linares 1415, Providencia" } } as never;
  if (decidirBorrador(soloMapa, "Zañartu 980, Ñuñoa") !== "reemplazar") F("9 · un borrador con solo dirección y mapa no se reemplaza en silencio");
  if (decidirBorrador(avanzado, "Linares 1415, Providencia, Chile") !== "retomar") F("9 · un borrador avanzado de la misma dirección no se retoma en silencio");
  if (decidirBorrador(avanzado, "Zañartu 980, Ñuñoa") !== "ofrecer") F("9 · un borrador avanzado de otra dirección no se ofrece");
  if (decidirBorrador(avanzado, null) !== "ofrecer" || decidirBorrador(null, "x") !== null) F("9 · sin dirección que llegue, un borrador avanzado no se ofrece (o sin borrador no devuelve null)");
  if (!/const decision = decidirBorrador\(w\.draftPendiente, direccionInicial\?\.direccion \?\? null\);/.test(shell) || !/if \(decision === "reemplazar"\) w\.reemplazarBorrador\(\);\s*\n\s*else if \(decision === "retomar"\) retomarBorrador\(\);/.test(shell)) F("9 · el wizard no decide el borrador con decidirBorrador (reemplazar / retomar / ofrecer)");
  if (!/window\.scrollTo\(\{ top: 0, left: 0, behavior: "instant" \}\);\s*\n\s*\}, \[nav\.current\]\);/.test(shell)) F("9 · el wizard no vuelve arriba al cambiar de paso");
  const landingEnt = sinComentarios(leer("src/components/landing-v14/Entrada.tsx"));
  if (!/mantenerHojaAlEntregar: true,/.test(landingEnt) || !/setNavegando\("escribir"\);\s*\n\s*router\.push\(urlDeLlegada\(sel, origen\)\);/.test(landingEnt) || !/setNavegando\(modo\);\s*\n\s*router\.push\(urlDeLlegada\(\{ modo \}, origen\)\);/.test(landingEnt)) F("9 · elegir en la landing no navega con la hoja abierta y el campo ocupado");
  if (!/if \(!mantenerHojaAlEntregar\) setHoja\(false\);\s*\n\s*onDireccion\(sel\);/.test(hero) || !/onClick=\{\(\) => tomarCamino\("mapa"\)\}/.test(hero)) F("9 · la hoja se cierra al entregar aunque quien monta vaya a navegar");
  // Si la hoja se toca antes de que llegue su código, la medición tiene que volver a correr cuando
  // llega (visto en local: sin `Hoja` en las dependencias, las sugerencias quedaban en el valor por defecto).
  if (!/html\.style\.removeProperty\("--he-pac-top"\);\s*\n\s*\};\s*\n\s*\}, \[hoja, Hoja, inputRef\]\);/.test(hero)) F("8 · la posición de las sugerencias no se vuelve a medir cuando llega la hoja");
  // CINCO SUGERENCIAS SOBRE EL TECLADO. El presupuesto sale del CSS: con el teclado abierto a 390
  // quedan unos 464 px visibles, y el campo de la hoja termina cerca de 190 (velo 56, asa, cabecera,
  // campo): a las cinco les quedan ~270 px. Medido además en el navegador en cada preview.
  const item = css.match(/html\.he-hoja-abierta \.pac-item \{ line-height: ([0-9.]+); padding: ([0-9]+)px [0-9]+px;[^}]*font-size: ([0-9]+)px;/);
  const query = css.match(/html\.he-hoja-abierta \.pac-item-query \{ display: block; font-size: ([0-9]+)px;/);
  if (!item || !query) F("8 · no encuentro el alto de las sugerencias en el CSS (el extractor no corrió)");
  else {
    const alto = 2 * Number(item[2]) + Number(item[1]) * (Number(query[1]) + Number(item[3]));
    if (5 * alto > 270) F(`8 · cinco sugerencias miden ${Math.round(5 * alto)} px: no caben sobre el teclado (tope 270)`);
  }

  // ── 10 · LA LEYENDA Y LOS PUNTOS SON LA MISMA LISTA (28-sep-2026) ──────────
  // (a) El resumen del radio: la muestra que se guarda y los puntos que se dibujan salen de una lista.
  const filas10 = [
    { id: "a", precio: 610000, superficie_m2: 34, lat: -33.45, lng: -70.60, distance_meters: 66.4 },
    { id: "b", precio: 490000, superficie_m2: 40, lat: -33.451, lng: -70.601, distance_meters: 84 },
    { id: "c", precio: 430000, superficie_m2: 34, lat: -33.452, lng: -70.602, distance_meters: 119 },
    { id: "d", precio: 540000, superficie_m2: 32, lat: -33.453, lng: -70.603, distance_meters: 154 },
    { id: "e", precio: 495000, superficie_m2: 33, lat: -33.454, lng: -70.604, distance_meters: 210 },
    { id: "f", precio: 520000, superficie_m2: 36, lat: -33.455, lng: -70.605, distance_meters: 218 },
    { id: "x", precio: 5000000, superficie_m2: 36, lat: -33.456, lng: -70.606, distance_meters: 20 }, // extremo: la limpieza lo saca
  ];
  const res10 = resumirComparablesRadio(filas10, 38, { modo: "conDorms", factorCierre: 1 });
  if (!res10) F("10 · el resumen del radio no dio muestra con seis avisos limpios (el extractor no corrió)");
  else {
    if (res10.puntos.length !== res10.sampleSize || res10.muestra.avisos.length !== res10.sampleSize) F(`10 · el n (${res10.sampleSize}), los puntos (${res10.puntos.length}) y la muestra (${res10.muestra.avisos.length}) no son la misma lista`);
    if (res10.puntos.some((p) => p.id === "x")) F("10 · los puntos dibujan un aviso que la limpieza descartó");
    res10.puntos.forEach((p, i) => {
      const a = res10.muestra.avisos[i];
      if (!a || Math.round(p.precio) !== a.precio || Math.round(p.distance_meters ?? -1) !== a.distanciaM) F(`10 · el punto ${i} (${p.precio} a ${p.distance_meters} m) no es el aviso ${i} de la muestra (${a?.precio} a ${a?.distanciaM} m)`);
      if (typeof p.lat !== "number" || typeof p.lng !== "number") F(`10 · el punto ${i} va sin coordenadas: el mapa no podría dibujar lo que la leyenda cuenta`);
    });
  }
  // (b) El endpoint pasa esa lista como `comparables` y el resto del radio sin esas filas.
  const sug = sinComentarios(leer("src/lib/services/market-suggestions.ts"));
  if (!/const \{ muestra, puntos, \.\.\.resto \} = best as Sugerencias & \{ muestra\?: MuestraArriendo; puntos\?: PuntoComparable\[\] \};/.test(sug) || !/const comparables = puntos \?\? \[\];/.test(sug)) F("10 · el endpoint no saca `comparables` de los puntos de la muestra");
  if (!/const restoRadio = bestMap\.all\.filter\(\(p\) => !\(p\.id && idsComparables\.has\(p\.id\)\)\);/.test(sug) || !/comparables,\s*\n\s*restoRadio,\s*\n\s*nearbyProperties: bestMap\.all,/.test(sug)) F("10 · el resto del radio no excluye los comparables (se dibujarían dos veces)");
  // (c) El hook guarda la lista tal cual: sin conteo aparte, sin `sampleSize` ni `totalInRadius` como número del mapa.
  const hookDatos = sinComentarios(leer("src/components/formulario-v4/useWizardV4Data.ts"));
  if (!/setComparables\(arr\?\.source === "radio" && Array\.isArray\(arr\?\.comparables\) \? arr\.comparables : \[\]\);/.test(hookDatos)) F("10 · el hook no dibuja los `comparables` del endpoint");
  if (!/setRestoRadio\(arr\?\.source === "radio" && Array\.isArray\(arr\?\.restoRadio\) \? arr\.restoRadio : \[\]\);/.test(hookDatos)) F("10 · el hook no guarda el resto del radio");
  if (/comparablesCount|totalInRadius|nearbyProperties/.test(hookDatos)) F("10 · el hook vuelve a tener un conteo aparte de la lista (comparablesCount / totalInRadius / nearbyProperties)");
  // (d) La leyenda cuenta la lista dibujada, dice a qué radio y distingue el gris.
  if (!/rotuloComparables\(data\.comparables\.length, data\.radiusUsed\)/.test(mapaScr)) F("10 · la leyenda no cuenta `data.comparables.length` con su radio");
  if (!/\{data\.restoRadio\.length > 0 && <span className="[^"]*"> · otros \{data\.restoRadio\.length\} en gris<\/span>\}/.test(mapaScr)) F("10 · la leyenda no distingue el resto del radio («otros N en gris»)");
  if (/comparablesCount|arriendoN|sampleSize|propiedades en el sector/.test(mapaScr)) F("10 · la leyenda del mapa usa otro número que la lista dibujada");
  if (/comparablesCount/.test(shell) || !/live\.comparables = data\.comparables\.length; live\.radioM = data\.radiusUsed;/.test(shell)) F("10 · la reacción no recibe el largo de la lista dibujada y su radio");
  // (e) El rótulo: número + radio legible.
  const rot = [[22, 1500, "22 comparables a 1,5 km"], [5, 500, "5 comparables a 500 m"], [30, 1000, "30 comparables a 1 km"], [20, 2000, "20 comparables a 2 km"], [1, 750, "1 comparable a 750 m"], [9, null, "9 comparables cerca"]] as const;
  for (const [n, r, esperado] of rot) if (rotuloComparables(n, r) !== esperado) F(`10 · rotuloComparables(${n}, ${r}) = «${rotuloComparables(n, r)}», no «${esperado}»`);
  // (f) El mapa: el contexto en un gris más tenue, debajo y fuera del encuadre; el encuadre es de los comparables.
  const efectoPuntos = (pinSrc.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[puntos, listo\]\);/) ?? [])[0] ?? "";
  if (!efectoPuntos || /contexto/.test(efectoPuntos)) F("10 · el encuadre del mapa mete el contexto (o el extractor no corrió)");
  if (!/for \(const p of validos\) caja\.extend\(p\);/.test(efectoPuntos)) F("10 · el encuadre no sigue a los comparables");
  if (!/contextoRef\.current\.push\(new google\.maps\.Marker\(\{[\s\S]{0,200}?zIndex: 0,[\s\S]{0,200}?fillColor: "#B4B2A9", fillOpacity: 0\.55,[\s\S]{0,120}?\}\)\);[\s\S]{0,40}?\}\s*\n\s*\}, \[contexto, listo\]\);/.test(pinSrc)) F("10 · el resto del radio no va en un gris más tenue, debajo de los comparables");
  if (!/fillColor: "#71717A", fillOpacity: 0\.85/.test(efectoPuntos)) F("10 · los comparables perdieron su gris");

  // ── 5 · EVENTOS Y EMBUDO ───────────────────────────────────────────────────
  if (!/"wizard4_entrada_camino", \{ camino: "escribir"/.test(ent) || !/trackWizard\(posthog, "wizard4_entrada_camino", \{ camino \}\);/.test(ent)) F("5 · falta el evento del camino elegido");
  if (!/"wizard4_ubicacion_permiso", \{ resultado: r\.estado/.test(ent)) F("5 · falta el evento del permiso de ubicación");
  if (!/"wizard4_pin_movido", \{ origen/.test(ent)) F("5 · falta el evento del pin movido");
  if (!/trackWizard\(posthog, "wizard4_step_viewed", \{ node: nav\.current, entrada \}\);/.test(shell) || !/extra: \{ entrada \},/.test(shell)) F("5 · los eventos de paso no llevan `entrada`");
  const tel = sinComentarios(leer("src/components/formulario-v4/stepTelemetry.ts"));
  if (!/trackWizard\(posthog, "wizard4_step_left", \{\s*\n\s*\.\.\.extraRef\.current,/.test(tel)) F("5 · `wizard4_step_left` no lleva las propiedades de la sesión");
  const hito = HITOS_FUNNEL.find((h) => h.etiqueta === "entrada nueva");
  if (!hito || !hito.invalida.includes("visitaWizard") || !hito.invalida.includes("wizardAnalisis")) F("5 · el embudo no tiene el hito de la entrada nueva");
  const ph = leer("src/lib/posthog-admin.ts");
  // 28-sep-2026: sin el `dir` fantasma; la landing cuenta por el mapa.
  if (!/const INICIO_WIZARD = "\(properties\.node = 'dirMapa' OR \(properties\.node = 'dir' AND coalesce\(properties\.entrada, ''\) != 'landing'\)\)";/.test(ph) || (ph.match(/\$\{INICIO_WIZARD\}/g) ?? []).length !== 3) F("5 · el embudo no cuenta a quien llega desde la landing (o vuelve a contar el dir fantasma)");
  if (/properties\.node = 'dir' AND/.test(ph.replace(/const INICIO_WIZARD = "[^"]*";/, ""))) F("5 · queda una consulta del embudo que solo cuenta `dir`");

  // ── 6 · LA GEOCODIFICACIÓN INVERSA ─────────────────────────────────────────
  const calleConNumero = { types: ["street_address"], formatted_address: "Av. Irarrázaval 2098, Ñuñoa, Región Metropolitana, Chile", address_components: [{ long_name: "2098", types: ["street_number"] }, { long_name: "Avenida Irarrázaval", types: ["route"] }, { long_name: "Ñuñoa", types: ["locality", "political"] }], geometry: { location: { lat: -33.4535, lng: -70.6091 } } };
  const soloComuna = { types: ["locality", "political"], formatted_address: "Ñuñoa, Chile", address_components: [{ long_name: "Ñuñoa", types: ["locality", "political"] }] };
  const inv = await conFetch({ status: "OK", results: [calleConNumero] }, async () => (await geocodeGET(new Request("http://x/api/geocode?lat=-33.4535&lng=-70.6091"))).json());
  if (inv?.direccion !== calleConNumero.formatted_address || inv?.comuna !== "Ñuñoa" || inv?.cubierta !== true || inv?.precision !== "numero") F(`6 · la inversa no nombra el punto con su comuna (${JSON.stringify(inv)})`);
  const invArea = await conFetch({ status: "OK", results: [soloComuna] }, async () => (await geocodeGET(new Request("http://x/api/geocode?lat=-33.45&lng=-70.6"))).json());
  if (invArea?.direccion !== null) F("6 · la inversa nombra un punto con una comuna en vez de una calle");
  const directa = await conFetch({ status: "OK", results: [calleConNumero] }, async () => geocodeGET(new Request("http://x/api/geocode?q=Irarrazaval%202098")));
  if (directa.status !== 200) F("6 · el respaldo por texto sin comuna da error (el hero no tiene comuna)");
  // El código postal no llega a la pantalla: el preview del 26-sep mostraba «8330215 Santiago».
  if (sinCodigoPostal("Av. Sta. Rosa 200, 8330215 Santiago, Región Metropolitana, Chile") !== "Av. Sta. Rosa 200, Santiago, Región Metropolitana, Chile") F("6 · el código postal pegado a la comuna (Google) se queda");
  if (sinCodigoPostal("200, Avenida Santa Rosa, Santiago, Región Metropolitana de Santiago, 8330215, Chile") !== "200, Avenida Santa Rosa, Santiago, Región Metropolitana de Santiago, Chile") F("6 · el código postal como tramo propio (Nominatim) se queda");
  if (sinCodigoPostal("Av. Apoquindo 3000, Las Condes") !== "Av. Apoquindo 3000, Las Condes") F("6 · quitar el código postal le toca el número a la calle");
  const conPostal = { ...calleConNumero, formatted_address: "Av. Sta. Rosa 200, 8330215 Santiago, Región Metropolitana, Chile" };
  const invPostal = await conFetch({ status: "OK", results: [conPostal] }, async () => (await geocodeGET(new Request("http://x/api/geocode?lat=-33.45&lng=-70.64"))).json());
  if (invPostal?.direccion !== "Av. Sta. Rosa 200, Santiago, Región Metropolitana, Chile") F(`6 · la inversa nombra el punto con el código postal (${invPostal?.direccion})`);
  const directaPostal = await conFetch({ status: "OK", results: [conPostal] }, async () => (await geocodeGET(new Request("http://x/api/geocode?q=Santa%20Rosa%20200"))).json());
  if (directaPostal?.formattedAddress !== "Av. Sta. Rosa 200, Santiago, Región Metropolitana, Chile") F(`6 · el respaldo por texto confirma con el código postal (${directaPostal?.formattedAddress})`);
  const places = sinComentarios(leer("src/components/entrada/useDireccionPlaces.ts"));
  if (!/const addr = sinCodigoPostal\(place\.formatted_address/.test(places)) F("6 · la selección de Places guarda la dirección con el código postal");

  if (fallas.length) {
    console.log(`  ✗ WIZARD-ENTRADA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la portada es el hero compartido con tres caminos y, en el teléfono, una hoja; el mapa es siempre la segunda, dibuja los comparables que la leyenda cuenta (misma lista, con su radio) y el resto del radio en gris; la llegada va al mapa o a la portada y pregunta ante un borrador ajeno; los eventos llevan su puerta");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runWizardEntradaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (26-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las 28 en ROJO; restauradas, VERDE. La primera tanda dejó una en verde (1e): el test no probaba
// `?lat=` vacío, que Number() lee como 0; se agregó el caso.
//   1a con número va al mapa · 1b sin precisión todo es «numero» · 1c la cobertura ignora las
//   coordenadas · 1d fuera de cobertura arranca en tipo · 1e sin latitud se acepta · 1f el borrador
//   ajeno no se distingue · 1g la llegada no espera al borrador · 1h retomar no descarta la llegada
//   · 1i la página no marca la puerta · 2a el mapa sale de los desvíos · 2b después del mapa viene
//   precio · 2c la barra se mueve en el mapa · 2d la reacción no nombra la dirección · 3a vuelve «¿se
//   paga solo?» · 3b vuelve un evento de la portada vieja · 4a los caminos salen del hero · 4b la
//   portada deja de ser el hero · 4c sin permiso el mapa abre con pin · 4d el mapa confirma fuera de
//   cobertura · 4e el mapa confirma «pin» sin mover · 5a sin evento de permiso · 5b step_viewed sin
//   entrada · 5c step_left sin las props de sesión · 5d sin hito · 5e una consulta vuelve a contar
//   solo dir · 6a la inversa acepta una comuna · 6b la inversa no normaliza la comuna · 6c el texto
//   vuelve a exigir comuna
// Segunda tanda (26-sep-2026, tras el primer preview), las tres en ROJO: 2e la reacción vuelve a
//   «?? "N"» · 2f sin dirección vuelve el marcador · 4f el Permissions-Policy vuelve a
//   `geolocation=()`.
// Tercera tanda (26-sep-2026), las cinco en ROJO: 6d el helper no quita el postal pegado · 6e no
//   quita el tramo propio · 6f la inversa sin el helper · 6g la directa sin el helper · 6h Places
//   sin el helper.
// Cuarta tanda (27-sep-2026, el mapa siempre segundo), las 12 en ROJO: 1j la llegada con número
//   vuelve a tipo · 1k la llegada confirma sin mapa · 4g sin mover, con número queda «pin» · 7a la
//   portada confirma con número · 7b con número no va al mapa · 7c el mapa sin comparables · 7d sin
//   «propiedades en el sector» · 7e el punto movido no llega a las respuestas · 7f la inversa
//   rebautiza sin mover · 7g sin mover confirma el nombre de la inversa · 7h «Usar este punto» en
//   vez de «Continuar» · 7i los puntos no se redibujan.
// Quinta tanda (27-sep-2026, la hoja del teléfono), las 4 en ROJO: 8a sin distinguir el teléfono ·
//   8b el hook no re-ata · 8c la hoja se enfoca tarde · 8d las sugerencias no quedan fijas.
//   Tras el preview, 8e (en ROJO): sin `max-width: none` la regla global de globals.css las dejaba
//   32 px cortas; medido en el preview (358 de 390).
// Sexta tanda (27-sep-2026, la hoja es el Modal de los capítulos), las 11 en ROJO: 8f la hoja deja de
//   ser el Modal · 8g sin los tokens del Modal · 8h sin portal · 8i sin precarga · 8j vuelve la hoja
//   a pantalla completa · 8k las sugerencias sin la posición medida · 8l la medición con la
//   animación · 8m cinco sugerencias no caben (padding 14) · 8n el campo sale de arriba de la hoja ·
//   8o la medición no re-corre cuando llega el código de la hoja · 8p la hoja fuera de
//   `.doc-dictamen` (la paleta cálida vieja y el título en serif; visto en el preview).
