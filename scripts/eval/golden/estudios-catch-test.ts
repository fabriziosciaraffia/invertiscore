// ─────────────────────────────────────────────────────────────────────────────
// Tier ESTUDIOS (13-oct-2026) — quien busca estudio recibe estudios.
//
//   1 · EL CRITERIO (`esEstudio`, avisos/estudio.ts): 0 dormitorios; o 1 dormitorio con «Studio», «Home Studio»,
//       «Estudio», «Monoambiente» o «1 ambiente» en el título, sin «más / + / y / con estudio».
//   2 · EL SCRAPER GUARDA EL 0: del listado y del mapa, y la fila lo escribe (antes `|| null` lo volvía NULL).
//   3 · EL EVALUADOR busca los comparables de un estudio sin filtro de dormitorios (no como 2D).
//   4 · EN VIVO (lee la base, no escribe): el criterio en SQL (`es_estudio`) dice lo mismo que el de TypeScript, y
//       la consulta de candidatos del correo, con un perfil de estudio en Santiago, trae estudios —y solo estudios,
//       con 0 dormitorios—. Hasta hoy traía cero: diez personas no recibían nada.
// ACTA (13-oct-2026). ROJO contra la base de antes de la migración 20261013_estudios (un perfil de estudio en Santiago
// recibía 0 candidatos y es_estudio no existía) y VERDE después (40 candidatos, todos estudios). 7/7 mutaciones en ROJO:
// E1 el 0 deja de ser estudio · E2 «1D más estudio» cuenta · E3 el mapa descarta el 0 · E4 la fila lo vuelve NULL · E5 el
// listado lo pierde · E6 el evaluador lo trata como 2D · E7 TypeScript y SQL dejan de coincidir.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/estudios-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { esEstudio } from "../../../src/lib/avisos/estudio";
import { parsePropertyFromResult } from "../../../src/lib/services/scraper/toctoc";
import { propertyToRow } from "../../../src/lib/services/scraper/property-row";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

/** Títulos reales de la base (13-oct-2026) y casos de borde, con lo que tienen que dar con 1 dormitorio. */
const TITULOS: Array<[string, boolean]> = [
  ["ARGOMEDO STUDIO", true],
  ["ESTUDIO METRO PARQUE ALMAGRO", true],
  ["Vendo Homestudio Metro Franklin", true],
  ["Perfecto Home Studio en Estación Central En venta!", true],
  ["Oportunidad!!! Home Estudio, Ideal para inversioni", true],
  ["Departamento tipo estudio (1 ambiente)", true],
  ["DPTO EN VENTA | ESTUDIO | 1D + 1B | PISCINA | SANT", true],
  ["Monoambiente a pasos del metro", true],
  ["Depto 1 dormitorio más estudio", false],
  ["1D + estudio, metro Ñuble", false],
  ["Departamento con estudio y terraza", false],
  ["1 dormitorio y estudio", false],
  ["Departamento 1D1B metro Santa Lucía", false],
  ["Estudiantes bienvenidos, depto 1D", false],
];

export async function runEstudiosTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER ESTUDIOS (quien busca estudio recibe estudios) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · el criterio ─────────────────────────────────────────────────────────
  if (!esEstudio(0, null) || !esEstudio(0, "Depto 2D")) F("1 · un aviso con 0 dormitorios no es estudio");
  if (esEstudio(2, "Studio") || esEstudio(null, "Studio") || esEstudio(1, null)) F("1 · cuenta como estudio un 2D, uno sin dormitorios o un 1D sin título");
  for (const [t, esperado] of TITULOS) if (esEstudio(1, t) !== esperado) F(`1 · «${t}» con 1 dormitorio ${esperado ? "no cuenta como estudio" : "cuenta como estudio"}`);

  // ── 2 · el scraper guarda el 0 ──────────────────────────────────────────────
  const delListado = parsePropertyFromResult({ urlFicha: "https://x/venta/departamento/santiago/o_1", comuna: "Santiago", dormitorios: [0], bannos: [1], superficie: [24], precios: [{ prefix: "UF", value: "2.100" }] }, "venta", "Santiago");
  if (delListado?.dormitorios !== 0) F(`2 · el listado pierde el 0 de un estudio (${delListado?.dormitorios})`);
  if (propertyToRow({ ...(delListado ?? {}), dormitorios: 0 } as never).dormitorios !== 0) F("2 · la fila vuelve NULL el 0 de un estudio (`|| null`)");
  if (!/dormitorios: Number\.isFinite\(dormitorios\) && dormitorios >= 0 \? dormitorios : undefined,/.test(leer("src/lib/services/scraper/toctoc.ts"))) F("2 · el mapa (GetProps) descarta el 0 de un estudio");

  // ── 3 · el evaluador ────────────────────────────────────────────────────────
  if (!/const dorms = a\.dormitorios \?\? 2;/.test(leer("src/lib/avisos/evaluar-aviso.ts"))) F("3 · el evaluador busca comparables de 2D para un estudio (`|| 2`)");

  // ── 4 · en vivo ─────────────────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) F("4 · NO CORRIÓ: faltan las variables de Supabase (correr con --env-file=.env.local)");
  else {
    const sb = createClient(url, key);
    for (const [t, esperado] of [...TITULOS, ["", false] as [string, boolean]]) {
      const { data, error } = await sb.rpc("es_estudio", { dormitorios: 1, titulo: t });
      if (error) { F(`4 · es_estudio no responde: ${error.message}`); break; }
      if (data !== esperado) F(`4 · el criterio en SQL dice ${data} y el de TypeScript ${esperado} para «${t}»`);
    }
    const desde = new Date(Date.now() - 7 * 864e5).toISOString().replace("Z", "");
    const { data: filas, error } = await sb.rpc("semanal_candidatos", { comunas: ["Santiago"], dorms: [0], uf_min: 0, uf_max: 100000, desde, max_filas: 40 });
    if (error) F(`4 · semanal_candidatos no responde: ${error.message}`);
    else {
      const n = (filas ?? []).length;
      console.log(`  · un perfil de estudio en Santiago recibe ${n} candidatos`);
      if (n === 0) F("4 · con un perfil de estudio en Santiago la consulta del correo no trae ningún candidato");
      if ((filas ?? []).some((f: { dormitorios: number }) => f.dormitorios !== 0)) F("4 · a quien busca estudio le llegan avisos que no son estudios (o el estudio sale con 1 dormitorio)");
    }
    const { data: unoD } = await sb.rpc("semanal_candidatos", { comunas: ["Santiago"], dorms: [1], uf_min: 0, uf_max: 100000, desde, max_filas: 5 });
    if (!(unoD ?? []).length) F("4 · a quien busca 1D en Santiago dejó de llegarle nada");
  }

  if (fallas.length) {
    console.log(`  ✗ ESTUDIOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — un estudio es 0 dormitorios o un 1D que el título llama estudio; el scraper guarda el 0; el evaluador no lo trata como 2D; SQL y TypeScript dicen lo mismo, y un perfil de estudio en Santiago recibe estudios");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runEstudiosTier().then((r) => process.exit(r.hard ? 1 : 0));
}
