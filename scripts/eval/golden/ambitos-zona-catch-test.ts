// ============================================================================
// GUARD DE ÁMBITOS ZONALES — catch-test (determinístico, 0 tokens)
// ============================================================================
// El bloque REFERENCIAS DE ZONA pide la frase que reconcilia las dos lecturas de
// precio; este guard DETECTA si falta. Casos:
//   · regresión 05462488: prosa que etiqueta AMBOS ámbitos pero no los junta;
//   · limpio: prosa que sí reconcilia (con la canónica y con formas orgánicas);
//   · el piso de magnitud: conflicto trivial no arma nada.
//
// v22 (09-sep-2026): la sección «fallback: append determinístico» SE RETIRA con el
// writer que probaba. `appendReconciliacion` murió con sus dos anfitriones — ver el
// acta en referencias-zona.ts. Lo que queda es detección audit-only, y estos casos
// la cubren: son los únicos que ejercitan este subsistema en todo el repo (el
// golden no tiene ninguna seed con lados opuestos — 0 de 30 en v21, 0 de 20 en v22).
//
//   node --import tsx scripts/eval/golden/ambitos-zona-catch-test.ts
// ============================================================================

import {
  construirReferenciasZona,
  faltaReconciliacion,
  MARCADOR_RECONCILIACION,
} from "../../../src/lib/referencias-zona";
import { esCasoPrecioJusto } from "../../../src/lib/distancia-veredicto-hallazgo";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

const BASE = {
  precioPedidoUF: 2600, superficieM2: 27, vmFrancoUF: 1256, tieneDiferenciaValida: true,
  radioMetros: 500, sampleSizeVenta: 38, medianaComunaUfM2: 103.5, desviacionPct: -7,
  medianaConfiable: true, nComuna: 723, universo: "nuevo" as const, sujetoUfM2: 96.3,
};

console.log("── piso de magnitud (el conflicto tiene que ser perceptible) ──");
{
  // El testigo real: radio +107% vs comuna −7%.
  const r = construirReferenciasZona(BASE);
  check("el testigo arma", r.signosOpuestos === true);
  check("trae la frase canónica", r.fraseReconciliacion.length > 0 && MARCADOR_RECONCILIACION.test(r.fraseReconciliacion));
  check("el bloque cita esa MISMA frase (fuente única)", r.bloque.includes(r.fraseReconciliacion));
}
{
  // Trivial: precio ≈ vm (radio ~0%) contra comuna −6%. Antes del piso esto
  // armaba y exigía una frase de reconciliación absurda.
  const r = construirReferenciasZona({ ...BASE, vmFrancoUF: 2600, desviacionPct: -6 });
  check("conflicto trivial NO arma", r.signosOpuestos === false && r.fraseReconciliacion === "");
}
{
  // Separación < 20 pts: −6 vs +8 = 14 pts.
  const r = construirReferenciasZona({ ...BASE, vmFrancoUF: 2407, desviacionPct: -6 });
  check("separación bajo el piso NO arma", r.signosOpuestos === false, `sep=${(((2600 - 2407) / 2407) * 100 + 6).toFixed(0)} pts`);
}
{
  // Una lectura bajo el 5%: comuna −2%.
  const r = construirReferenciasZona({ ...BASE, desviacionPct: -2 });
  check("magnitud bajo el piso NO arma", r.signosOpuestos === false);
}

console.log("── REGRESIÓN 05462488: etiqueta los dos ámbitos pero no los junta ──");
const refs = construirReferenciasZona(BASE);
{
  const piezas = [
    { pieza: "conviene.respuestaDirecta", texto: "Tu precio por m² (UF 96,3) está 7% bajo la mediana de la comuna (UF 103,5). Entras barato para esta comuna." },
    { pieza: "negociacion", texto: "El argumento es el valor estimado de tu cuadra: los comparables publicados en 500 m valoran este depto en UF 1.256 — pagas 107% sobre eso." },
  ];
  check("detecta la ausencia del puente", faltaReconciliacion(piezas, refs) === true);
}
{
  const piezas = [
    { pieza: "conviene.respuestaDirecta", texto: "Entras 7% bajo la mediana de la comuna, pero contra los comparables de tu cuadra pagas de más: no es contradicción, la comuna es un promedio amplio." },
  ];
  check("prosa que SÍ reconcilia no dispara", faltaReconciliacion(piezas, refs) === false);
}
{
  // Forma orgánica: dice lo mismo con otras palabras (lección del guard de jerarquía).
  const piezas = [{ pieza: "conviene.respuestaDirecta", texto: "Son dos formas de mirar el mismo precio: la comuna entera y tu cuadra." }];
  check("forma orgánica satisface el guard", faltaReconciliacion(piezas, refs) === false);
}
{
  const trivial = construirReferenciasZona({ ...BASE, vmFrancoUF: 2600, desviacionPct: -6 });
  check("sin conflicto material el guard ni se arma", faltaReconciliacion([{ pieza: "x", texto: "nada" }], trivial) === false);
}

// ── «fallback: append determinístico» — RETIRADA CON ACTA (v22) ───────────
// Probaba que `appendReconciliacion` appendeara en las dos variantes de moneda,
// alojara en `negociacion` y no en la respuesta directa, conservara el texto y
// fuera idempotente. Los DOS campos que alojaba murieron en v22, así que el writer
// se retiró: no había dónde appendear. El test se va con su sujeto.
//
// Vale la pena dejar escrito lo que probaba, porque es la restricción que hay que
// respetar el día que se decida dónde vive el puente: alojaba en `negociacion`
// DELIBERADAMENTE, para NO tocar el campo con tope duro de palabras.

console.log("── NO descalibra la pata vm de precio-justo ──");
{
  const insumos = {
    desviacionPct: 0, precioUF: 2000, vmFrancoUF: 2040, ufClp: 39000,
    arriendoCLP: 420000, arriendoRefCLP: 420000, arriendoEsEstimacionFranco: false,
    veredicto: "AJUSTA SUPUESTOS" as const,
  };
  const antes = esCasoPrecioJusto(insumos);
  check("esCasoPrecioJusto estable (el guard narra, no calcula)", esCasoPrecioJusto(insumos) === antes && antes === true);
  check("vm divergente sigue rechazando precio-justo", esCasoPrecioJusto({ ...insumos, vmFrancoUF: 3400 }) === false);
}

console.log(fallas === 0 ? "\n✓ VERDE — el puente entre ámbitos se pide en el prompt y su ausencia se detecta (audit-only)" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
