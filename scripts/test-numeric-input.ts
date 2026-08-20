/**
 * Tests del NumericInput del wizard v4 (`src/components/formulario-v4/NumericInput.tsx`).
 *
 * El repo no tiene framework de testing instalado (jest/vitest/etc.). Este
 * script usa `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-plausibilidad.ts` y `scripts/test-numero-cl.ts`.
 *
 *   npx tsx scripts/test-numeric-input.ts
 *
 * Salida: lista de tests con OK/FAIL y exit code != 0 si alguno falla.
 *
 * Importa el MÓDULO REAL, no una réplica: la conducta del componente vive en
 * funciones puras exportadas justamente para que estos asserts corran el mismo
 * código que producción. Probar una copia editada junto al arreglo no prueba
 * nada — es la lección de la regresión del tabId.
 *
 * La conducta bajo test es el contrato de assets-export/mockup-numeric-input.html.
 */

import assert from "node:assert/strict";
import {
  convertirUnidad,
  decimalesUtiles,
  ecoPorDefecto,
  esPrefijoViable,
  estadoNumericInput,
  motivoError,
  type EstadoNumericInput,
} from "../src/components/formulario-v4/NumericInput";
import type { Decimales } from "../src/lib/numero-cl";
import type { AvisoEscala } from "../src/components/formulario-v4/avisoEscala";

// ── Runner mínimo ────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const fallidos: string[] = [];

function test(nombre: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

/** Estado con el eco por defecto y sin regla de escala. */
function est(
  texto: string,
  decimales: Decimales,
  opts: { blurred?: boolean; escala?: (v: number) => AvisoEscala | null } = {},
): EstadoNumericInput {
  return estadoNumericInput(texto, {
    decimales,
    blurred: opts.blurred ?? false,
    formatEco: ecoPorDefecto(),
    escala: opts.escala,
  });
}

/** ¿El campo queda MARCADO en rojo? Es el único estado que lo hace. */
const marcado = (r: EstadoNumericInput) => r.estado === "error";

// ─────────────────────────────────────────────────────────────────────────────
seccion("Los cinco estados");
// ─────────────────────────────────────────────────────────────────────────────

test("vacío — string vacío y solo espacios", () => {
  assert.equal(est("", 2).estado, "vacio");
  assert.equal(est("   ", 2).estado, "vacio");
});

test("ok — se entiende, con eco", () => {
  const r = est("3.200,5", 2);
  assert.equal(r.estado, "ok");
  assert.equal(r.estado === "ok" && r.valor, 3200.5);
  assert.equal(r.estado === "ok" && r.eco, "3.200,5");
});

test("en curso — null pero alguna tecla lo salva", () => {
  // "3.2" en un campo entero puede terminar en "3.200".
  assert.equal(est("3.2", 0).estado, "encurso");
});

test("error — null y ninguna tecla lo salva", () => {
  // El grupo "34" ya está roto: ningún dígito extra lo arregla.
  assert.equal(est("12.34.567", 2).estado, "error");
});

test("escala — se entendió, pero la magnitud es imposible", () => {
  const r = est("45", 2, { escala: (v) => (v > 20 ? { mensaje: "Una tasa de 45% no existe.", sobreMaximo: true } : null) });
  assert.equal(r.estado, "escala");
  assert.equal(r.estado === "escala" && r.valor, 45);
  assert.equal(r.estado === "escala" && r.aviso, "Una tasa de 45% no existe.");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("EL ROJO — solo el estado error marca");
// ─────────────────────────────────────────────────────────────────────────────

test("ni vacío, ni en curso, ni ok, ni escala marcan el campo", () => {
  assert.equal(marcado(est("", 2)), false);
  assert.equal(marcado(est("3.2", 0)), false);
  assert.equal(marcado(est("3.200", 2)), false);
  assert.equal(marcado(est("45", 2, { escala: () => ({ mensaje: "fuera de escala", sobreMaximo: true }) })), false);
});

test("el aviso de escala NO es un error — convive con el eco", () => {
  const r = est("999", 0, { escala: () => ({ mensaje: "imposible", sobreMaximo: true }) });
  assert.equal(r.estado, "escala");
  assert.equal(r.estado === "escala" && r.eco, "999", "el eco tiene que seguir encendido");
  assert.equal(marcado(r), false, "escala nunca marca en rojo");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El prefijo incompleto no es un valor fuera de escala");
// Estos cuatro son la red del fix del 19-ago-2026. Antes, el 100% de los
// usuarios veía "Fuera de escala" en `tam` y `precio` por teclear el primer
// dígito de un número perfectamente normal.
// ─────────────────────────────────────────────────────────────────────────────

/** Regla real de superficie: mínimo 12 m², sin techo que importe acá. */
const bajoMinimo12 = (v: number): AvisoEscala | null =>
  v < 12 ? { mensaje: "12 m² es muy poco.", sobreMaximo: false } : null;

test("debajo del mínimo y escribiendo — se calla (el 6 de '65 m²')", () => {
  assert.equal(est("6", 1, { escala: bajoMinimo12 }).estado, "ok");
});

test("debajo del mínimo pero YA soltó el campo — avisa", () => {
  const r = est("6", 1, { blurred: true, escala: bajoMinimo12 });
  assert.equal(r.estado, "escala");
  assert.equal(r.estado === "escala" && r.aviso, "12 m² es muy poco.");
});

test("terminar de escribir lo saca solo del aviso", () => {
  assert.equal(est("65", 1, { escala: bajoMinimo12 }).estado, "ok");
  assert.equal(est("65", 1, { blurred: true, escala: bajoMinimo12 }).estado, "ok");
});

test("sobre el máximo avisa EN EL ACTO — ninguna tecla lo rescata", () => {
  // La razón de ser del aviso temprano: la tasa de 45% que se descubría tres
  // pantallas después. Agregarle dígitos solo la aleja más del rango.
  const sobreTecho = (v: number): AvisoEscala | null =>
    v > 20 ? { mensaje: "Una tasa así no existe.", sobreMaximo: true } : null;
  assert.equal(est("45", 2, { escala: sobreTecho }).estado, "escala");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("esPrefijoViable — el horizonte de rescate son 3 dígitos");
// ─────────────────────────────────────────────────────────────────────────────

test("viable: lo que puede cerrar un grupo de miles", () => {
  assert.equal(esPrefijoViable("3.2", 0), true, '"3.2" → "3.200"');
  assert.equal(esPrefijoViable("1,5", 0), true, '"1,5" → "1,500"');
  assert.equal(esPrefijoViable(",", 2), true, '"," → ",5"');
});

test("no viable: lo que ya está roto de raíz", () => {
  assert.equal(esPrefijoViable("12.34.567", 2), false, "el grupo de 2 no se arregla");
  assert.equal(esPrefijoViable("1.2345", 2), false, "4 dígitos tras el separador");
  assert.equal(esPrefijoViable("abc", 2), false);
});

test("un prefijo no viable marca AUNQUE el foco siga adentro", () => {
  assert.equal(est("12.34.567", 2, { blurred: false }).estado, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El blur endurece el veredicto");
// ─────────────────────────────────────────────────────────────────────────────

test("el mismo texto: en curso con foco, error al salir", () => {
  assert.equal(est("3.2", 0, { blurred: false }).estado, "encurso");
  assert.equal(est("3.2", 0, { blurred: true }).estado, "error");
});

test("el blur no rompe lo que sí se entiende", () => {
  assert.equal(est("3.200", 0, { blurred: true }).estado, "ok");
  assert.equal(est("", 0, { blurred: true }).estado, "vacio");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("TRAZA · tipeando «3.200» tecla por tecla");
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El punto se lee como DECIMAL en el paso 3 y vuelca a MILES en el paso 5. El
 * usuario ve la reinterpretación ocurrir — que es la información que hoy no
 * tiene. Lo que este test fija es que NINGÚN paso intermedio queda marcado:
 * todos son prefijos que pueden terminar bien.
 */
const TRAZA_UF: Array<[string, string]> = [
  ["3", "3"],
  ["3.", "3"],
  ["3.2", "3,2"],
  ["3.20", "3,2"],
  ["3.200", "3.200"],
];

test("campo de 2 decimales (precio UF): los 5 pasos se entienden", () => {
  let texto = "";
  for (const [esperadoTexto, esperadoEco] of TRAZA_UF) {
    texto = esperadoTexto;
    const r = est(texto, 2);
    assert.equal(r.estado, "ok", `paso "${texto}" debería entenderse y dio ${r.estado}`);
    assert.equal(r.estado === "ok" && r.eco, esperadoEco, `eco de "${texto}"`);
  }
});

test("campo de 2 decimales: ningún paso intermedio queda marcado", () => {
  const marcados = TRAZA_UF.filter(([t]) => marcado(est(t, 2))).map(([t]) => t);
  assert.deepEqual(marcados, [], `no debería marcarse ninguno: ${marcados.join(", ")}`);
});

test("campo de 0 decimales: pasos intermedios en curso, nunca marcados", () => {
  const estados = TRAZA_UF.map(([t]) => est(t, 0).estado);
  assert.deepEqual(estados, ["ok", "ok", "encurso", "encurso", "ok"]);
  const marcados = TRAZA_UF.filter(([t]) => marcado(est(t, 0))).map(([t]) => t);
  assert.deepEqual(marcados, [], `no debería marcarse ninguno: ${marcados.join(", ")}`);
});

test("el volantazo del punto: decimal en el paso 3, miles en el paso 5", () => {
  const paso3 = est("3.2", 2);
  const paso5 = est("3.200", 2);
  assert.equal(paso3.estado === "ok" && paso3.valor, 3.2);
  assert.equal(paso5.estado === "ok" && paso5.valor, 3200);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("motivoError — qué pasó + cómo salir");
// ─────────────────────────────────────────────────────────────────────────────

test("decimal en campo entero", () => {
  assert.equal(motivoError("1,5", 0), "este campo va en números enteros.");
});

test("más decimales que los del campo", () => {
  assert.equal(motivoError("0,75", 1), "este campo toma 1 decimal.");
});

/**
 * En un campo de 2 decimales el exceso de decimales NO existe como diagnóstico
 * propio, y no es un hueco: el parser tapa a 2 por diseño. Tres dígitos tras el
 * separador se leen como grupo de MILES ("0,755" es 755, no un error), y cuatro
 * o más ya no son ni grupo válido ni decimal — ahí el mensaje correcto es el del
 * agrupamiento. Por eso `motivoError` solo sondea d=1 y d=2.
 */
test("campo de 2 decimales: «0,755» no es error, se lee como miles", () => {
  const r = est("0,755", 2);
  assert.equal(r.estado, "ok");
  assert.equal(r.estado === "ok" && r.valor, 755);
});

test("agrupamiento roto", () => {
  assert.match(motivoError("12.34.567", 2), /los miles van de a tres/);
  assert.match(motivoError("1,2345", 2), /los miles van de a tres/);
});

test("caracteres que no son número", () => {
  assert.equal(motivoError("abc", 2), "solo números, punto y coma.");
  assert.equal(motivoError("1e3", 0), "solo números, punto y coma.");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("decimalesUtiles — el eco NUNCA redondea");
// ─────────────────────────────────────────────────────────────────────────────

test("usa los decimales justos, ni uno más", () => {
  assert.equal(decimalesUtiles(3200), 0);
  assert.equal(decimalesUtiles(3200.5), 1);
  assert.equal(decimalesUtiles(3200.25), 2);
});

test("un valor de 2 decimales no se muestra con 1", () => {
  // Si esto fallara, el eco estaría truncando en silencio — el bug que el
  // componente viene a matar, cometido en la línea de defensa.
  const r = est("3.200,25", 2);
  assert.equal(r.estado === "ok" && r.eco, "3.200,25");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("convertirUnidad — el toggle convierte el VALOR, no reinterpreta el texto");
// ─────────────────────────────────────────────────────────────────────────────

const UF_CLP = 39500;

test("UF → $ : «3.200,5» con 2 decimales pasa a pesos enteros", () => {
  assert.equal(convertirUnidad("3.200,5", 2, 0, UF_CLP), "126.419.750");
});

test("$ → UF : vuelve al mismo valor", () => {
  const enPesos = convertirUnidad("3.200,5", 2, 0, UF_CLP)!;
  assert.equal(convertirUnidad(enPesos, 0, 2, 1 / UF_CLP), "3.200,50");
});

test("NO reinterpreta el string: un decimal no se vuelve error al bajar la precisión", () => {
  // El bug que se evita: re-parsear "3.200,5" con 0 decimales daría null.
  assert.notEqual(convertirUnidad("3.200,5", 2, 0, UF_CLP), null);
});

test("texto ilegible → null (el llamador deja lo tipeado como está)", () => {
  assert.equal(convertirUnidad("12.34.567", 2, 0, UF_CLP), null);
  assert.equal(convertirUnidad("", 2, 0, UF_CLP), null);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El caso de la auditoría: los filtros viejos vs. el componente");
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `pctInt` borraba la coma y truncaba a 2 dígitos, así que "7,5" en comisión de
 * administración quedaba guardado como 75 — sin error, sin aviso, y con el
 * análisis generado y el crédito cobrado sobre ese 75.
 */
test("«7,5» en un campo de 1 decimal vale 7,5 y no 75", () => {
  const r = est("7,5", 1);
  assert.equal(r.estado, "ok");
  assert.equal(r.estado === "ok" && r.valor, 7.5);
  assert.equal(r.estado === "ok" && r.eco, "7,5");
});

test("«4,5» en tasa vale 4,5 — la coma ya no se traga", () => {
  const r = est("4,5", 2);
  assert.equal(r.estado === "ok" && r.valor, 4.5);
});

test("«4.5» en tasa también vale 4,5 — la regla es posicional", () => {
  const r = est("4.5", 2);
  assert.equal(r.estado === "ok" && r.valor, 4.5);
});

test("nada se trunca en silencio: lo que no cabe en el campo, se marca", () => {
  // "0,75" en un campo de 1 decimal NO se convierte en 0,7 ni en 75.
  assert.equal(est("0,75", 1, { blurred: true }).estado, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Sweep — todo estado es exactamente uno de los cinco");
// ─────────────────────────────────────────────────────────────────────────────

test("ningún input produce un estado fuera del contrato", () => {
  const textos = [
    "", " ", "0", "1", "1,5", "1.5", "1.500", "1.234.567", "1.234.567,89",
    "12.34.567", "1.2345", ",", ".", "-", "4,", "0,75", "abc", "$100", "1e3",
    "-1.500", "+1.500", "  1.500  ", ",5", "999999999",
  ];
  const validos = new Set(["vacio", "encurso", "ok", "escala", "error"]);
  const fallas: string[] = [];
  for (const t of textos) {
    for (const d of [0, 1, 2] as Decimales[]) {
      for (const b of [false, true]) {
        const r = est(t, d, { blurred: b });
        if (!validos.has(r.estado)) fallas.push(`"${t}" d=${d} b=${b} → ${r.estado}`);
        // Coherencia: si hay eco, hay valor leído; si marca, no hay eco.
        if (r.estado === "ok" || r.estado === "escala") {
          if (typeof r.valor !== "number" || !Number.isFinite(r.valor)) {
            fallas.push(`"${t}" d=${d} b=${b} → eco sin valor finito`);
          }
        }
      }
    }
  }
  assert.deepEqual(fallas, [], `estados fuera de contrato:\n  ${fallas.join("\n  ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("NumericInput: todos los tests pasan.");
