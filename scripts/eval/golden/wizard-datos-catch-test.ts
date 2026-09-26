// ============================================================================
// GOLDEN · TRES ARREGLOS DE DATOS DEL WIZARD v4 — catch-test (26-sep-2026)
// ============================================================================
//   1 · EL STUDIO ES STUDIO EN LOS TRES LUGARES. La pantalla de tarifa, el resumen y la
//       estimación de AirROI leían `Number(dormitorios) || 2`, y el studio guarda "0": veían
//       y pedían un 2D mientras el submit mandaba 0. Una sola lectura (`dormitoriosNum`) y una
//       sola regla de huéspedes (`capacidadHuespedesDe`) para los cuatro consumidores.
//   2 · «COSTOS OPERATIVOS» ES UN TOTAL Y SE GUARDA COMO TOTAL. El resumen lo editaba como
//       luz + agua + wifi + insumos pero lo escribía en `costoInsumos`, y el submit le sumaba
//       encima los tres defaults: editado, se contaba dos veces. Ahora el total se reparte entre
//       los cuatro y la suma que llega al motor es exactamente lo que el usuario escribió.
//   3 · NADA SE CONFIRMA SIN UNA CALLE REAL. `/api/geocode` tomaba `results[0]` de Google sin
//       mirar qué era: «asdf» en Ñuñoa volvía como el centroide de la comuna y el wizard lo
//       confirmaba. Ahora un resultado de área no es una dirección, Places sin `route` tampoco
//       (en la portada y en el editor del resumen), y sin número la pantalla lo dice y deja
//       mover el pin, solo dentro de la comuna. La precisión viaja en el payload.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/wizard-datos-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLtrPayload, buildStrPayload, type SubmitContext } from "../../../src/components/formulario-v4/wizardV4Submit";
import { getCostosDefault } from "../../../src/lib/engines/short-term-engine";
import type { WizardV4Answers } from "../../../src/components/formulario-v4/wizardV4Nodes";
import {
  pinDentroDeComuna,
  precisionDeComponentes,
  precisionDeResultadoGoogle,
  precisionDeResultadoNominatim,
} from "../../../src/lib/geocoding-precision";
import { geocodeAddress } from "../../../src/lib/services/geocoding";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

const CTX: SubmitContext = {
  ufCLP: 40000, tasaMercado: 4.04, arriendoSugerido: null, arriendoN: 0, arriendoFuente: "sin-dato",
  arriendoRango: null, precioM2UF: null, radiusUsed: null, ggccSugerido: 80000,
  ventaN: 0, ventaFuente: "sin-dato", ventaUniverso: null, ventaRadio: null,
};
const BASE: WizardV4Answers = {
  direccion: "Av. Irarrázaval 2100, Ñuñoa", direccionConfirmada: "Av. Irarrázaval 2100, Ñuñoa",
  comuna: "Ñuñoa", ciudad: "Santiago", lat: -33.45, lng: -70.6, tipoPropiedad: "usado", antiguedad: "11-20",
  superficieUtil: "32", banos: "1", precio: "3100", pieMonto: "20", pieUnidad: "pct",
  plazoCredito: "25", tasaInteres: "4,04", modalidad: "str", adrModo: "estimacion",
};
const suma4 = (p: { costoElectricidad: number; costoAgua: number; costoWifi: number; costoInsumos: number }) =>
  p.costoElectricidad + p.costoAgua + p.costoWifi + p.costoInsumos;

// Resultados con la forma del Geocoding API de Google.
const R_COMUNA = { types: ["locality", "political"], address_components: [{ long_name: "Ñuñoa", types: ["locality", "political"] }], formatted_address: "Ñuñoa, Región Metropolitana, Chile", geometry: { location: { lat: -33.4549, lng: -70.5983 } } };
const R_CALLE = { types: ["route"], address_components: [{ long_name: "Avenida Irarrázaval", types: ["route"] }, { long_name: "Ñuñoa", types: ["locality", "political"] }], formatted_address: "Av. Irarrázaval, Ñuñoa, Región Metropolitana, Chile", geometry: { location: { lat: -33.4539, lng: -70.6016 } } };
const R_NUMERO = { types: ["street_address"], address_components: [{ long_name: "2100", types: ["street_number"] }, { long_name: "Avenida Irarrázaval", types: ["route"] }, { long_name: "Ñuñoa", types: ["locality", "political"] }], formatted_address: "Av. Irarrázaval 2100, Ñuñoa", geometry: { location: { lat: -33.4535, lng: -70.6091 } } };
const R_CRUCE = { types: ["intersection"], address_components: [{ long_name: "Avenida Irarrázaval", types: ["route"] }, { long_name: "Ñuñoa", types: ["locality", "political"] }] };
const R_BARRIO_CON_CALLE = { types: ["neighborhood", "political"], address_components: [{ long_name: "Avenida Irarrázaval", types: ["route"] }] };

/** Corre `fn` con `fetch` devolviendo `respuesta` y la key de Google en `env` (undefined = sin key). */
async function conFetch<T>(respuesta: unknown, env: string | undefined, fn: () => Promise<T>): Promise<T> {
  const fetchPrevio = globalThis.fetch;
  const keyPrevia = process.env.GOOGLE_MAPS_API_KEY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async () => ({ ok: true, json: async () => respuesta })) as any;
  if (env === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = env;
  try {
    return await fn();
  } finally {
    globalThis.fetch = fetchPrevio;
    if (keyPrevia === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = keyPrevia;
  }
}

export async function runWizardDatosTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER WIZARD-DATOS (studio · costos operativos · dirección · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · STUDIO ──────────────────────────────────────────────────────────────
  const studio: WizardV4Answers = { ...BASE, esStudio: true, dormitorios: "0" };
  const pStudio = buildStrPayload(studio, CTX);
  if (pStudio.dormitorios !== 0) F(`1 · el payload STR de un studio manda ${pStudio.dormitorios} dormitorios`);
  if (pStudio.capacidadHuespedes !== 2) F(`1 · el payload STR de un studio pide ${pStudio.capacidadHuespedes} huéspedes (son 2)`);
  if (suma4(pStudio) !== suma4(getCostosDefault(0))) F("1 · los costos por defecto de un studio no son los de un studio");
  if (buildLtrPayload(studio, CTX).dormitorios !== 0) F("1 · el payload LTR de un studio no manda 0 dormitorios");
  // Un borrador con el studio marcado pero sin el "0" escrito: manda el esStudio, no el default.
  if (buildStrPayload({ ...BASE, esStudio: true, dormitorios: undefined }, CTX).dormitorios !== 0) F("1 · un studio sin dormitorios escritos cae al default de 2");
  // Las superficies que muestran o piden por tipología leen la MISMA función.
  const usos: Array<[string, RegExp]> = [
    ["src/components/formulario-v4/screensActo3.tsx", /const dorm = dormitoriosNum\(answers\);\s*\n\s*const costos = getCostosDefault\(dorm, "basico"\);/],
    ["src/components/formulario-v4/screenResumen.tsx", /const dorm = dormitoriosNum\(a\);\s*\n\s*const costos = getCostosDefault\(dorm, "basico"\);/],
    ["src/components/formulario-v4/useWizardV4Data.ts", /const dorm = dormitoriosNum\(answers\);[\s\S]{0,400}?dormitorios: dorm,[\s\S]{0,120}?capacidadHuespedes: capacidadHuespedesDe\(dorm\),/],
    ["src/components/formulario-v4/wizardV4Submit.ts", /capacidadHuespedes: capacidadHuespedesDe\(dorm\),/],
  ];
  for (const [f, re] of usos) if (!re.test(sinComentarios(leer(f)))) F(`1 · ${f} no lee la tipología con dormitoriosNum / capacidadHuespedesDe`);
  for (const f of ["screensActo3.tsx", "screenResumen.tsx", "useWizardV4Data.ts", "wizardV4Submit.ts", "screenInforme.tsx"]) {
    const s = sinComentarios(leer(`src/components/formulario-v4/${f}`));
    if (/Number\(\s*\w+\.dormitorios\s*\)\s*\|\|/.test(s)) F(`1 · ${f} vuelve a leer los dormitorios con Number(…) || default`);
  }

  // ── 2 · COSTOS OPERATIVOS ───────────────────────────────────────────────────
  const dosD: WizardV4Answers = { ...BASE, dormitorios: "2" };
  const def2 = getCostosDefault(2);
  const sinEditar = buildStrPayload(dosD, CTX);
  if (suma4(sinEditar) !== suma4(def2)) F(`2 · sin editar, los costos operativos suman ${suma4(sinEditar)} (default ${suma4(def2)})`);
  for (const [campo, total] of [["costosOperativos", 130000], ["costosOperativos", 30000], ["costosOperativos", 3], ["costoInsumos", 130000]] as const) {
    const p = buildStrPayload({ ...dosD, [campo]: String(total) }, CTX);
    if (suma4(p) !== total) F(`2 · editado a ${total} (${campo}), al motor llegan ${suma4(p)}`);
    for (const k of ["costoElectricidad", "costoAgua", "costoWifi", "costoInsumos"] as const) {
      if (!(p[k] >= 0)) F(`2 · editado a ${total}, ${k} queda en ${p[k]}`);
    }
  }
  const res = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/onCommit=\{\(v\) => commitEdit\("costoInsumos", \{ costosOperativos: v \}\)\}/.test(res)) F("2 · el resumen no guarda el total de costos operativos en su propio campo");
  if (/\{ costoInsumos: v \}/.test(res)) F("2 · el resumen vuelve a escribir el total en costoInsumos");

  // ── 3 · DIRECCIÓN ───────────────────────────────────────────────────────────
  if (precisionDeResultadoGoogle(R_COMUNA) !== null) F("3 · un resultado de COMUNA se acepta como dirección (el «asdf» que caía en el centroide)");
  if (precisionDeResultadoGoogle(R_BARRIO_CON_CALLE) !== null) F("3 · un resultado de barrio con una calle entre sus componentes se acepta como dirección");
  if (precisionDeResultadoGoogle(R_CALLE) !== "calle") F("3 · una calle sin número no se reconoce como «calle»");
  if (precisionDeResultadoGoogle(R_NUMERO) !== "numero") F("3 · una calle con número no se reconoce como «numero»");
  if (precisionDeResultadoGoogle(R_CRUCE) !== "calle") F("3 · una intersección no se reconoce como «calle»");
  if (precisionDeComponentes([]) !== null || precisionDeComponentes(R_COMUNA.address_components) !== null) F("3 · Places sin `route` se acepta");
  if (precisionDeComponentes(R_CALLE.address_components) !== "calle" || precisionDeComponentes(R_NUMERO.address_components) !== "numero") F("3 · Places no distingue calle de calle con número");
  if (precisionDeResultadoNominatim({ address: { city: "Ñuñoa" } }) !== null) F("3 · Nominatim acepta una comuna");
  if (
    precisionDeResultadoNominatim({ address: { road: "Avenida Irarrázaval" } }) !== "calle" ||
    precisionDeResultadoNominatim({ address: { road: "Avenida Irarrázaval", house_number: "2100" } }) !== "numero"
  ) F("3 · Nominatim no distingue calle de calle con número");
  // El geocodificador de verdad, con la respuesta simulada.
  const g1 = await conFetch({ status: "OK", results: [R_COMUNA] }, "k", () => geocodeAddress("asdf", "Ñuñoa"));
  if (g1 !== null) F(`3 · geocodeAddress("asdf") devuelve ${JSON.stringify(g1)}: el centroide se confirma`);
  const g2 = await conFetch({ status: "OK", results: [R_COMUNA, R_CALLE] }, "k", () => geocodeAddress("Irarrazaval", "Ñuñoa"));
  if (g2?.precision !== "calle" || g2.lat !== R_CALLE.geometry.location.lat) F("3 · geocodeAddress no salta el resultado de área para tomar la calle");
  const g3 = await conFetch({ status: "OK", results: [R_NUMERO] }, "k", () => geocodeAddress("Irarrazaval 2100", "Ñuñoa"));
  if (g3?.precision !== "numero") F("3 · geocodeAddress no marca la precisión «numero»");
  const g4 = await conFetch([{ lat: "-33.45", lon: "-70.59", display_name: "Ñuñoa", address: { city: "Ñuñoa" } }], undefined, () => geocodeAddress("asdf", "Ñuñoa"));
  if (g4 !== null) F("3 · por Nominatim, una comuna se confirma como dirección");
  // El pin se mueve dentro de la comuna, no a otra.
  if (!pinDentroDeComuna("Ñuñoa", -33.4535, -70.6091)) F("3 · un punto de Ñuñoa se rechaza como pin de Ñuñoa");
  if (pinDentroDeComuna("Ñuñoa", -33.51, -70.76)) F("3 · un punto de Maipú se acepta como pin de Ñuñoa");
  // La precisión viaja al análisis.
  if (buildLtrPayload({ ...BASE, dormitorios: "2", ubicacionPrecision: "calle" }, CTX).ubicacionPrecision !== "calle") F("3 · el payload LTR no lleva la precisión de la ubicación");
  if (buildStrPayload({ ...BASE, dormitorios: "2", ubicacionPrecision: "pin" }, CTX).ubicacionPrecision !== "pin") F("3 · el payload STR no lleva la precisión de la ubicación");
  // Cableado en las pantallas.
  const ent = sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx"));
  if (!/const precision: PrecisionUbicacion \| null = precisionDeComponentes\(comps\);/.test(ent)) F("3 · la portada no mide la precisión de la sugerencia de Places");
  if (!/\.\.\.\(cubierta && precision\s*\n\s*\? \{ direccionConfirmada: addr, lat: plat, lng: plng, ubicacionPrecision: precision \}/.test(ent)) F("3 · la portada confirma una sugerencia de Places sin calle");
  if (!/if \(!r\.ok \|\| j\.lat == null \|\| j\.lng == null \|\| !j\.precision\)/.test(ent)) F("3 · el respaldo de la portada confirma sin precisión");
  if (!/ubicacionPrecision === "calle" \|\| ubicacionPrecision === "pin"\) && \(\s*<div className="flex flex-col gap-2">\s*<AvisoSinNumero ajustada=\{ubicacionPrecision === "pin"\} \/>\s*<MapaPinAjustable[\s\S]{0,160}?onMover=\{\(la, ln\) => patchAnswers\(\{ lat: la, lng: ln, ubicacionPrecision: "pin" \}\)\}/.test(ent)) F("3 · sin número, la portada no avisa ni deja mover el pin");
  const res3 = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/const precision = precisionDeComponentes\(comps\);\s*\n\s*if \(!precision\) \{ setNoEsCalle\(true\); return; \}\s*\n\s*setNoEsCalle\(false\);\s*\n\s*doneRef\.current = true;\s*\n\s*onConfirm\(\{[^}]*precision \}\);/.test(res3)) F("3 · el editor de dirección del resumen confirma sin calle");
  if (!/ubicacionPrecision: d\.precision \}/.test(res3)) F("3 · el resumen no guarda la precisión de la dirección editada");
  if (!/<AvisoSinNumero ajustada=\{a\.ubicacionPrecision === "pin"\} \/>\s*<MapaPinAjustable/.test(res3)) F("3 · sin número, el resumen no avisa ni deja mover el pin");
  const pin = sinComentarios(leer("src/components/formulario-v4/MapaPinAjustable.tsx"));
  if (!/if \(!pinDentroDeComuna\(comuna, la, ln\)\) \{[\s\S]{0,160}?return;\s*\}[\s\S]{0,200}?onMoverRef\.current\(la, ln\);/.test(pin)) F("3 · el pin se puede mover fuera de la comuna");
  if (!/draggable: true/.test(pin) || !/map\.addListener\("click"/.test(pin)) F("3 · el pin no se puede arrastrar ni poner con un toque");

  if (fallas.length) {
    console.log(`  ✗ WIZARD-DATOS · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el studio es studio en pantalla, AirROI y submit; los costos operativos llegan una sola vez; nada se confirma sin calle, y sin número el pin se mueve");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runWizardDatosTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (26-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las veinte en ROJO; restauradas, VERDE. La primera tanda dejó dos en verde (1a y 2b): el guard
// no probaba un studio sin el "0" escrito ni un total chico; se agregaron esos dos casos.
//    1a · dormitoriosNum deja de mirar esStudio          2b · el reparto se pasa del total
//    1b · la pantalla de tarifa vuelve a Number()||2     2c · el borrador viejo ya no se lee como total
//    1c · el resumen vuelve a Number()||2                2d · el resumen vuelve a escribir costoInsumos
//    1d · AirROI del wizard vuelve a pedir un 2D         3a · un resultado de área cuenta como calle
//    1e · los huéspedes del submit con regla propia      3b · Places sin route cuenta como calle
//    2a · el submit suma los defaults sobre el total     3c · geocodeAddress vuelve a results[0]
//    3d · Nominatim acepta una comuna                    3h · el editor del resumen confirma sin calle
//    3e · la portada confirma sin calle                  3i · el pin sale de la comuna
//    3f · el respaldo confirma sin precisión             3j · la caja de la comuna se ignora
//    3g · sin número la portada no muestra el pin        3k · el payload STR pierde la precisión
