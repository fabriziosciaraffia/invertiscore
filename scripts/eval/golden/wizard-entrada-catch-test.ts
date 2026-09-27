// ============================================================================
// GOLDEN · LA ENTRADA DEL WIZARD: UNA PUERTA, DOS ACCESOS — catch-test (26-sep-2026)
// ============================================================================
//   1 · LA LLEGADA DESDE LA LANDING. Con número y cobertura arranca en `tipo`; sin número, en el
//       mapa; fuera de cobertura, en la portada. La precisión manda si viene; si no, se lee del texto.
//       Con un borrador de otra dirección, la portada pregunta antes de escribir nada.
//   2 · EL MAPA ES UN DESVÍO DE `dir`. `dir` conserva su nombre, el mapa no cuenta como progreso y
//       sigue a `tipo`. La reacción de la pregunta siguiente nombra la dirección.
//   3 · LA PORTADA VIEJA SALIÓ ENTERA: chips de comuna, buscador, «¿se paga solo?», «todavía no
//       tengo uno», sus eventos y la ruta de cifras por comuna que solo ella leía.
//   4 · UN SOLO COMPONENTE. La portada es `HeroEntrada` sobre el hook compartido, con los tres
//       caminos: escribir, «Estoy en el depto» y «Marcarlo en el mapa».
//   5 · LOS EVENTOS: camino, permiso y pin movido; `entrada` en los eventos de paso; el embudo cuenta
//       a quien llega desde la landing y tiene su hito.
//   6 · LA GEOCODIFICACIÓN INVERSA: `/api/geocode?lat&lng` nombra el punto con su comuna, y no
//       devuelve nada que no sea una calle. El respaldo por texto ya no exige comuna.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
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
  if (!conNumero || !conNumero.cubierta || conNumero.precision !== "numero" || destinoDeLlegada(conNumero) !== "tipo") F("1 · una dirección con número y cubierta no arranca en «tipo»");
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
  if (!/const destino = destinoDeLlegada\(d\);[\s\S]{0,300}?if \(destino === "tipo"\) \{\s*\n\s*w\.answer\("dir",[\s\S]{0,200}?\} else if \(destino === "mapa"\) \{\s*\n\s*w\.goDetour\("dirMapa",/.test(shell)) F("1 · la llegada no reparte entre «tipo», el mapa y la portada");
  if (!/const retomarBorrador = \(\) => \{ llegadaAplicada\.current = true; w\.resumeDraft\(\); \};/.test(shell)) F("1 · retomar el borrador no descarta la llegada: se aplicaría encima");
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
  const r1 = reactionText("dir", a, { comparables: 26 });
  if (!r1 || !r1.startsWith("Av. Irarrázaval 2100, Ñuñoa · zona cubierta, 26 propiedades")) F(`2 · la reacción de la pregunta siguiente no nombra la dirección (${r1})`);
  if (reactionText("dirMapa", a, { comparables: 24 }) === null) F("2 · confirmar el mapa no lleva la reacción de la dirección");
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
  if (!/const precision = !movido\.current && origen === "sin_numero" \? "calle" : "pin";/.test(ent)) F("4 · el mapa confirma como «pin» una calle que nadie movió");

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
  if (!/const INICIO_WIZARD = "\(properties\.node = 'dir' OR properties\.entrada = 'landing'\)";/.test(ph) || (ph.match(/\$\{INICIO_WIZARD\}/g) ?? []).length !== 3) F("5 · el embudo no cuenta a quien llega desde la landing");
  if (/properties\.node = 'dir' AND/.test(ph)) F("5 · queda una consulta del embudo que solo cuenta `dir`");

  // ── 6 · LA GEOCODIFICACIÓN INVERSA ─────────────────────────────────────────
  const calleConNumero = { types: ["street_address"], formatted_address: "Av. Irarrázaval 2098, Ñuñoa, Región Metropolitana, Chile", address_components: [{ long_name: "2098", types: ["street_number"] }, { long_name: "Avenida Irarrázaval", types: ["route"] }, { long_name: "Ñuñoa", types: ["locality", "political"] }], geometry: { location: { lat: -33.4535, lng: -70.6091 } } };
  const soloComuna = { types: ["locality", "political"], formatted_address: "Ñuñoa, Chile", address_components: [{ long_name: "Ñuñoa", types: ["locality", "political"] }] };
  const inv = await conFetch({ status: "OK", results: [calleConNumero] }, async () => (await geocodeGET(new Request("http://x/api/geocode?lat=-33.4535&lng=-70.6091"))).json());
  if (inv?.direccion !== calleConNumero.formatted_address || inv?.comuna !== "Ñuñoa" || inv?.cubierta !== true || inv?.precision !== "numero") F(`6 · la inversa no nombra el punto con su comuna (${JSON.stringify(inv)})`);
  const invArea = await conFetch({ status: "OK", results: [soloComuna] }, async () => (await geocodeGET(new Request("http://x/api/geocode?lat=-33.45&lng=-70.6"))).json());
  if (invArea?.direccion !== null) F("6 · la inversa nombra un punto con una comuna en vez de una calle");
  const directa = await conFetch({ status: "OK", results: [calleConNumero] }, async () => geocodeGET(new Request("http://x/api/geocode?q=Irarrazaval%202098")));
  if (directa.status !== 200) F("6 · el respaldo por texto sin comuna da error (el hero no tiene comuna)");

  if (fallas.length) {
    console.log(`  ✗ WIZARD-ENTRADA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la portada es el hero compartido con tres caminos; la llegada reparte entre tipo, mapa y portada, y pregunta ante un borrador ajeno; el mapa nombra el punto; los eventos llevan su puerta");
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
