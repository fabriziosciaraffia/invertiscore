// ============================================================================
// GOLDEN · EL RESUMEN NO OFRECE UNA MODALIDAD QUE LA PANTALLA DE MODALIDAD NO OFRECE — catch-test
// (25-sep-2026)
// ============================================================================
// El chip «Informe» del resumen del wizard pintaba ["ltr","str","both"] sin mirar AMBAS_ENABLED,
// mientras la pantalla de modalidad escondía «Comparativo». Con el flag apagado, un anónimo que lo
// elegía en el resumen terminaba con un LTR suelto que no pidió y sin su análisis gratis (el
// servidor ignora el `ambasGroupId` y el STR hermano sale 403).
//
// FIJA, verificado EN ROJO por mutación:
//   1 · FUENTE ÚNICA: la pantalla de modalidad pinta `OPCIONES_VISIBLES`, y `MODALIDADES_OFRECIDAS`
//       sale de esa misma lista.
//   2 · EL FLAG GOBIERNA LA LISTA, medido al importar el módulo en un proceso aparte: con
//       NEXT_PUBLIC_AMBAS_ENABLED="false" no hay «both»; sin la variable, están las tres.
//   3 · EL RESUMEN ofrece exactamente `MODALIDADES_OFRECIDAS` (importada de la pantalla, sin una
//       lista propia de modalidades) y su cambio de modalidad rechaza lo que no está en ella.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/selector-modalidad-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Importa la pantalla en un proceso aparte con el flag dado: el flag es constante de módulo. */
function ofrecidasCon(flag: string | undefined): string[] | null {
  const env = { ...process.env };
  if (flag === undefined) delete env.NEXT_PUBLIC_AMBAS_ENABLED;
  else env.NEXT_PUBLIC_AMBAS_ENABLED = flag;
  try {
    const out = execFileSync(
      process.execPath,
      ["--import", "tsx", "-e", 'import("./src/components/formulario-v4/screenInforme.tsx").then(m=>console.log(JSON.stringify(m.MODALIDADES_OFRECIDAS ?? m.default?.MODALIDADES_OFRECIDAS ?? null)))'],
      { cwd: RAIZ, env, encoding: "utf8" },
    );
    return JSON.parse(out.trim().split("\n").pop() ?? "null");
  } catch {
    return null;
  }
}

export function runSelectorModalidadTier(): { hard: number } {
  console.log("\n─── TIER SELECTOR-MODALIDAD (el resumen no ofrece lo que la pantalla de modalidad no ofrece · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · fuente única en la pantalla de modalidad ──
  const INF = sinComentarios(leer("src/components/formulario-v4/screenInforme.tsx"));
  if (!/export const MODALIDADES_OFRECIDAS: readonly Modalidad\[\] = OPCIONES_VISIBLES\.map\(\(o\) => o\.value\);/.test(INF)) {
    F("1 · MODALIDADES_OFRECIDAS no sale de OPCIONES_VISIBLES: la pantalla y el resumen podrían ofrecer cosas distintas");
  }
  if (!/\{OPCIONES_VISIBLES\.map\(/.test(INF)) {
    F("1 · la pantalla de modalidad no pinta OPCIONES_VISIBLES");
  }

  // ── 2 · el flag gobierna la lista (medido, no leído) ──
  const apagado = ofrecidasCon("false");
  const encendido = ofrecidasCon(undefined);
  if (!apagado) F("2 · no pude importar la pantalla con el flag apagado: el tier no midió");
  else if (apagado.includes("both") || apagado.join() !== "ltr,str") F(`2 · con AMBAS apagado se ofrece ${JSON.stringify(apagado)}; debería ser ["ltr","str"]`);
  if (!encendido) F("2 · no pude importar la pantalla con el flag encendido: el tier no midió");
  else if (encendido.join() !== "ltr,str,both") F(`2 · con AMBAS encendido se ofrece ${JSON.stringify(encendido)}; debería ser las tres`);

  // ── 3 · el resumen ofrece exactamente esa lista ──
  const RES = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/import \{ MODALIDADES_OFRECIDAS \} from "\.\/screenInforme";/.test(RES)) F("3 · el resumen no importa MODALIDADES_OFRECIDAS de la pantalla de modalidad");
  const selector = RES.match(/\{editingMod && \([\s\S]*?\.map\(\(m\) =>/);
  if (!selector) F("3 · no encuentro el selector de modalidad del resumen: el tier no lo mide");
  else if (!/MODALIDADES_OFRECIDAS\.map\(\(m\) =>$/.test(selector[0])) F("3 · el selector del resumen no recorre MODALIDADES_OFRECIDAS");
  if (/\[\s*"ltr"\s*,\s*"str"(\s*,\s*"both")?\s*\]/.test(RES)) F("3 · el resumen tiene su propia lista de modalidades");
  const cambio = RES.match(/const onModalidadChange = \([^)]*\) => \{[\s\S]*?w\.patchAnswers\(\{ modalidad: nuevo \}\)/);
  if (!cambio) F("3 · no encuentro onModalidadChange: el tier no lo mide");
  else if (!/if \(nuevo === mod \|\| !MODALIDADES_OFRECIDAS\.includes\(nuevo\)\) return;/.test(cambio[0])) F("3 · onModalidadChange acepta una modalidad que la pantalla no ofrece");

  if (fallas.length) {
    console.log(`  ✗ SELECTOR-MODALIDAD · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — la pantalla y el resumen ofrecen la misma lista (apagado: ${JSON.stringify(apagado)} · encendido: ${JSON.stringify(encendido)}), y el resumen rechaza lo que no está en ella`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runSelectorModalidadTier();
  process.exit(hard ? 1 : 0);
}
