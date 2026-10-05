// ============================================================================
// GOLDEN · ZONA-COMUNA (05-oct-2026) — catch-test
// ============================================================================
//   La marca de «arriendo sospechoso» compara el arriendo sugerido contra la mediana de la ZONA del depto
//   (2 km). El sugerido sale de un radio limitado a la comuna del aviso; la zona no tenía ese filtro. En
//   el borde poniente de Ñuñoa la zona la dominaba Santiago (7.587 de ~11.900 comparables, $10.119/m²
//   contra $12.174/m² de Ñuñoa) y la marca acusaba a arriendos que salían de sus propios vecinos.
//   Decisión de Fabrizio (05-oct-2026): la zona usa el MISMO filtro de comuna que el radio.
//   1 · LA CONSULTA de la zona lleva la comuna que se le pasa (2 km, arriendo, la tipología del depto).
//   2 · LA MEDIANA de la zona arma su consulta con esa comuna.
//   3 · LA MARCA del aviso le pasa a la zona la MISMA comuna con que se piden sus sugerencias.
//   4 · LA VERSIÓN de las sugerencias sube (s4): los avisos se reevalúan.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/zona-comuna-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { argsRadioZona, RADIO_ZONA_M, SUGERENCIAS_VERSION } from "../../../src/lib/services/market-suggestions";
import { VERSION_EVALUACION } from "../../../src/lib/avisos/evaluar-aviso";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

export function runZonaComunaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER ZONA-COMUNA (la zona de la marca con la comuna del radio · 0 tokens) ───");

  // ── 1 · la consulta ──
  {
    const con = argsRadioZona(-33.456, -70.62, 2, "Ñuñoa");
    const sin = argsRadioZona(-33.456, -70.62, 2, null);
    if (con.prop_comuna !== "Ñuñoa") F(`1 · la consulta de la zona no lleva la comuna del aviso (${con.prop_comuna})`);
    if (sin.prop_comuna !== null) F(`1 · sin comuna la consulta inventa una (${sin.prop_comuna})`);
    if (con.radius_meters !== RADIO_ZONA_M || RADIO_ZONA_M !== 2000 || con.prop_type !== "arriendo" || con.prop_dorms !== 2 || argsRadioZona(-33.4, -70.6, 0, "Ñuñoa").prop_dorms !== null || con.center_lat !== -33.456 || con.center_lng !== -70.62)
      F(`1 · la consulta de la zona dejó de ser 2 km de arriendos de la tipología del depto (${JSON.stringify(con)})`);
  }

  // ── 2 · la mediana usa esa consulta con la comuna ──
  {
    const ms = sinComentarios(leer("src/lib/services/market-suggestions.ts"));
    const cuerpo = ms.match(/export async function medianaArriendoZonaM2\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/);
    if (!cuerpo || !/comuna\?: string \| null/.test(cuerpo[1]) || !/leerRadio\(getSupabase\(\), reg, argsRadioZona\(lat, lng, dormitorios, comuna\), amoblado\)/.test(cuerpo[2]))
      F("2 · la mediana de la zona no arma su consulta con la comuna que recibe");
  }

  // ── 3 · la marca le pasa la misma comuna que el radio ──
  {
    const ev = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
    const zona = ev.match(/const zonaM2 = await medianaArriendoZonaM2\(a\.lat, a\.lng, a\.dormitorios \|\| null, false, a\.m2, ([^)]+)\)/);
    const radio = ev.match(/getSugerencias\(([^,]+), a\.m2, dorms, a\.precioUF, a\.lat, a\.lng, 800, "arriendo", null\)/);
    if (!zona) F("3 · la marca del aviso no le pasa una comuna a la zona");
    else if (!radio || zona[1].trim() !== radio[1].trim()) F(`3 · la zona y el radio no usan la misma comuna (zona ${zona[1]}, radio ${radio?.[1] ?? "?"})`);
  }

  // ── 4 · la versión ──
  if (SUGERENCIAS_VERSION !== "s4" || !VERSION_EVALUACION.endsWith("+s4")) F(`4 · la versión de las sugerencias no sube a s4 (${SUGERENCIAS_VERSION}, ${VERSION_EVALUACION})`);

  if (fallas.length) {
    console.log(`  ✗ ZONA-COMUNA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la zona de la marca de sospechoso consulta 2 km con la misma comuna que el radio de la sugerencia; sugerencias s4");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const r = runZonaComunaTier();
  process.exit(r.hard ? 1 : 0);
}

// ACTA · verificado EN ROJO (scratchpad mutar-zona.py, restauradas byte a byte), 05-oct-2026: 7/7.
//   Z1 la consulta de la zona sin la comuna ...................... 1
//   Z2 la consulta con otro radio (3 km) ......................... 1
//   Z3 la mediana no le pasa la comuna a la consulta ............. 2
//   Z4 la mediana con la consulta vieja escrita a mano, sin comuna  2
//   Z5 la marca no le pasa comuna a la zona ...................... 3
//   Z6 la marca con otra comuna que la del radio ................. 3
//   Z7 la versión no sube ........................................ 4
