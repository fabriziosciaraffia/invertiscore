// ============================================================================
// GOLDEN · ARRIENDO-AMOBLADO (30-sep-2026) — catch-test
// ============================================================================
//   Los amoblados se colaban en los comparables del arriendo sugerido (21% en Las Condes, 20% en
//   Vitacura). Decisiones de Fabrizio, 30-sep-2026:
//   1 · FUERA LOS AMOBLADOS cuando el depto no es amoblado; en renta larga una fila editable «Amoblado:
//       No» en los supuestos del arriendo (sin pantalla nueva); con «Sí», los comparables son los
//       amoblados. El título del aviso (GetProps [39]) se guarda y es la señal; sin título, el slug.
//   3 · LA MARCA DE ARRIENDO SOSPECHOSO compara contra la ZONA del depto (2 km, misma tipología, sin
//       amoblar), no contra la comuna.
//   + la versión de las sugerencias sube (s2) y va en la versión de la fila evaluada.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/arriendo-amoblado-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { claseDeArriendo, entraComoComparable } from "../../../src/lib/arriendo-tipo";
import { arriendoSospechoso, UMBRAL_SOSPECHOSO_ZONA, VERSION_EVALUACION } from "../../../src/lib/avisos/evaluar-aviso";
import { SUGERENCIAS_VERSION, RADIO_ZONA_M } from "../../../src/lib/services/market-suggestions";
import { propertyToRow, filaSinPisarCoords } from "../../../src/lib/services/scraper/property-row";
import { parseMapProperty } from "../../../src/lib/services/scraper/toctoc";
import { buildLtrPayload } from "../../../src/components/formulario-v4/wizardV4Payload";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

export function runArriendoAmobladoTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER ARRIENDO-AMOBLADO (los comparables se parecen al depto · 0 tokens) ───");

  // ── 1a · la clase del aviso, del título o del slug ──
  const casos: Array<[{ titulo?: string | null; url?: string | null }, string | null]> = [
    [{ titulo: "Departamento amoblado, El Golf" }, "amoblado"],
    [{ titulo: "Depto AMUEBLADO con vista" }, "amoblado"],
    [{ titulo: "ARRIENDO POR TEMPORADA DEPARTAMENTO 2HAB 2BA VITAC" }, "temporada"],
    [{ titulo: "Pieza amoblada a pasos del metro Manquehue" }, "pieza"],
    [{ titulo: "Departamento corporativo en Nueva Las Condes" }, "corporativo"],
    [{ titulo: "Departamento remodelado en sector exclusivo." }, null],
    [{ titulo: null, url: "https://www.toctoc.com/propiedades/arriendocorredorasr/departamento/las-condes/departamento-amoblado-el-golf/4255859" }, "amoblado"],
    [{ titulo: "", url: "https://www.toctoc.com/propiedades/arriendocorredorasr/departamento/nunoa/1-d-1-b-bodega-con-vista-despejada/4356306" }, null],
  ];
  for (const [a, esperado] of casos) if (claseDeArriendo(a) !== esperado) F(`1 · «${a.titulo || a.url}» se clasifica ${claseDeArriendo(a)}, no ${esperado}`);
  if (!entraComoComparable({ titulo: "Depto 2D" }, false) || entraComoComparable({ titulo: "Depto amoblado" }, false) || entraComoComparable({ titulo: "Pieza amoblada" }, true) || !entraComoComparable({ titulo: "Depto amoblado" }, true) || entraComoComparable({ titulo: "Depto 2D" }, true)) F("1 · sin amoblar entran solo los corrientes; amoblado, solo los amoblados");

  // ── 1b · el título se guarda (GetProps [39]) y otra fuente no lo borra ──
  const fila = Array.from({ length: 45 }, () => 0) as unknown[];
  Object.assign(fila, { 1: 4255859, 2: -70.6, 3: -33.41, 7: "Las Condes", 8: 2, 22: 1_200_000, 33: 60, 39: "Departamento amoblado, El Golf", 40: "https://www.toctoc.com/propiedades/arriendocorredorasr/departamento/las-condes/departamento-amoblado-el-golf/4255859" });
  const p = parseMapProperty(fila, "las-condes", "arriendo");
  if (p?.titulo !== "Departamento amoblado, El Golf" || propertyToRow(p!).titulo !== "Departamento amoblado, El Golf") F("1 · el título del GetProps ([39]) no llega a la fila");
  const sinTitulo = filaSinPisarCoords({ ...propertyToRow({ ...p!, titulo: undefined }) });
  if ("titulo" in sinTitulo) F("1 · una fila sin título pisaría el que ya estaba guardado");
  if (!/add column if not exists titulo text null/.test(leer("supabase/migrations/20260930_arriendos_amoblados.sql")) || !/url text,\s*titulo text\s*\)/.test(leer("supabase/migrations/20260930_arriendos_amoblados.sql"))) F("1 · la migración no agrega el título o la RPC no lo devuelve");

  // ── 1c · la sugerencia filtra, con la opción del wizard ──
  const ms = leer("src/lib/services/market-suggestions.ts");
  if (!/return filas\.filter\(\(f\) => entraComoComparable\(f, amoblado\)\);/.test(ms) || !/if \(args\.prop_type !== "arriendo" \|\| amoblado === null\) return filas;/.test(ms)) F("1 · el radio no filtra los comparables de arriendo por clase");
  if ((ms.match(/\}, amoblado\);/g)?.length ?? 0) < 5) F("1 · alguna lectura del radio no pasa la opción amoblado");
  if (!/const entran = rows\.filter\(\(r\) => entraComoComparable\(r, amoblado\)\)/.test(ms) || !/\.select\("precio, superficie_m2, dormitorios, url, titulo"\)/.test(ms)) F("1 · la referencia comunal del arriendo no filtra por clase");
  const ruta = leer("src/app/api/data/suggestions/route.ts");
  if (!/const amoblado = searchParams\.get\("amoblado"\) === "1";/.test(ruta) || !/propType, condicion, \{ amoblado \}/.test(ruta)) F("1 · la ruta de sugerencias no recibe «amoblado»");
  const dat = leer("src/components/formulario-v4/useWizardV4Data.ts");
  if (!/type: "arriendo", \.\.\.\(amoblado \? \{ amoblado: "1" \} : \{\}\)/.test(dat) || !/tipoPropiedad, amoblado\]\);/.test(dat)) F("1 · el wizard no pide la sugerencia con «amoblado» ni la rehace al cambiarlo");

  // ── 1d · la fila «Amoblado: No», en los dos lugares, sin pantalla nueva ──
  const a3 = leer("src/components/formulario-v4/screensActo3.tsx");
  const rs = leer("src/components/formulario-v4/screenResumen.tsx");
  if (!/label="Amoblado"[\s\S]{0,300}value=\{answers\.amoblado \?\? "no"\}/.test(a3)) F("1 · la pantalla del arriendo no tiene la fila «Amoblado» con No por defecto");
  if (!/label="Amoblado"[\s\S]{0,400}value=\{a\.amoblado \?\? "no"\}/.test(rs) || !/commitEdit\("amoblado", \{ amoblado: v, \.\.\.\(a\.arrModo === "corregir" \? \{\} : \{ arriendo: undefined \}\) \}\)/.test(rs)) F("1 · el resumen no tiene la fila, o no rehace el arriendo estimado al cambiarla");
  if (/["']amoblado["']\s*:\s*\{|id:\s*["']amoblado["']|NodeId.*amoblado/.test(leer("src/components/formulario-v4/wizardV4Nodes.ts"))) F("1 · «Amoblado» se volvió una pantalla nueva del wizard");
  const base = { tipoPropiedad: "usado", modalidad: "ltr", comuna: "Las Condes", superficieUtil: "60", dormitorios: "2", banos: "1", precio: "5000", pieUnidad: "pct", pieMonto: "20", plazoCredito: "30", tasaInteres: "4", arriendo: "1300000" };
  const ctx = { ufCLP: 41000, tasaMercado: 4, arriendoSugerido: 1300000, arriendoN: 20, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null, precioM2UF: 90, radiusUsed: 500, ggccSugerido: null, ventaN: 20, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 500 };
  const b1 = buildLtrPayload({ ...base, amoblado: "si" } as never, ctx as never) as { amoblado?: boolean };
  const b0 = buildLtrPayload(base as never, ctx as never) as { amoblado?: boolean };
  if (b1.amoblado !== true || b0.amoblado !== false) F("1 · el informe no guarda si el depto se arrienda amoblado");

  // ── 3 · la marca de sospechoso, contra la zona ──
  if (UMBRAL_SOSPECHOSO_ZONA !== 1.25 || RADIO_ZONA_M !== 2000) F("3 · el umbral o el radio de la zona cambiaron");
  // Oriente: la zona está a $18.500/m² y la comuna a $12.000. Un arriendo de $19.000/m² es de la zona, no sospechoso.
  if (arriendoSospechoso(19000 * 60, 60, 18500, "radio")) F("3 · un arriendo a precio de su zona se marca sospechoso (confunde ubicación con contaminación)");
  if (!arriendoSospechoso(24000 * 60, 60, 18500, "radio")) F("3 · un arriendo 30% sobre su zona no se marca");
  if (!arriendoSospechoso(800000, 60, null, "comuna-m2")) F("3 · el estimado comunal por m² no se marca");
  if (arriendoSospechoso(800000, 60, null, "radio")) F("3 · sin zona se marca igual (no hay contra qué comparar)");
  const ev = leer("src/lib/avisos/evaluar-aviso.ts");
  if (!/arriendo_sospechoso: arriendoSospechoso\(arriendo\?\.monto \?\? null, a\.m2, zonaM2, arriendo\?\.fuente \?\? null\),/.test(ev) || !/const zonaM2 = await medianaArriendoZonaM2\(a\.lat, a\.lng, a\.dormitorios \|\| null(, false, a\.m2)?\)/.test(ev)) F("3 · la fila evaluada no guarda la marca contra la zona");

  // ── la versión ──
  // s2 (30-sep, amoblados) → s3 (03-oct, el arriendo sigue al tamaño: ARRIENDO-TAMAÑO). Sube, no baja.
  if (!["s2", "s3"].includes(SUGERENCIAS_VERSION) || SUGERENCIAS_VERSION < "s2" || !VERSION_EVALUACION.endsWith(`+${SUGERENCIAS_VERSION}`) || !/motor_version: VERSION_EVALUACION,/.test(ev)) F("la versión de las sugerencias no sube o no va en la fila evaluada");

  if (fallas.length) {
    console.log(`  ✗ ARRIENDO-AMOBLADO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el título se guarda y clasifica; sin amoblar compara con corrientes y con «Sí» con amoblados, en el radio y en la comuna; la fila «Amoblado» vive en los supuestos del arriendo; la marca de sospechoso mira la zona");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES ─────────────────────────────────────────────────────────
// 30-sep-2026, scratchpad mutar.py: 17/17 en rojo, restauradas byte a byte.
//   A1 amoblado no se detecta ............................. 1 · se clasifica null
//   A2 la pieza amoblada cuenta como amoblado ............. 1 · se clasifica amoblado, no pieza
//   A3 sin título no mira el slug ......................... 1 · la URL se clasifica null
//   A4 con «Sí» entran todos .............................. 1 · amoblado, solo los amoblados
//   A5 el título no se lee del GetProps ([38]) ............ 1 · no llega a la fila
//   A6 una fila sin título borra el guardado .............. 1 · pisaría el guardado
//   A7 el radio no filtra ................................. 1 · no filtra por clase
//   A8 la comuna no filtra ................................ 1 · la referencia comunal no filtra
//   A9 la ruta ignora amoblado (quedó VERDE: el test miraba que la ruta leyera el parámetro, no que lo
//      pasara; ahora exige las dos cosas)
//   A10 el wizard no rehace al cambiar .................... 1 · no la rehace al cambiarlo
//   A11 el resumen deja el arriendo viejo ................. 1 · no rehace el arriendo estimado
//   A12 sin fila en la pantalla del arriendo .............. 1 · no tiene la fila
//   A13 el informe no guarda amoblado ..................... 1 · no guarda si es amoblado
//   S1 sospechoso contra un corte fijo (no la zona) ....... 3 · confunde ubicación con contaminación
//   S2 sin zona se marca .................................. 3 · sin zona se marca igual
//   S3 la fila no guarda la marca ......................... 3 · no guarda la marca
//   V1 la versión de sugerencias no sube .................. · no sube

if (require.main === module) {
  const { hard } = runArriendoAmobladoTier();
  process.exit(hard ? 1 : 0);
}
