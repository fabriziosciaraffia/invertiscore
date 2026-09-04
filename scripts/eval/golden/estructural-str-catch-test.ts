// ============================================================================
// GOLDEN · [STR-ESTRUCTURAL] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Regla contable pegada al campo: cuando la distancia al veredicto es ESTRUCTURAL, ninguna
// caja ofrece negociar, un descuento ni "si logras / si consigues" como salida. El bloque
// del prompt lo prohíbe con esas palabras y nadie lo hacía cumplir. Testigo GE-4:
// "si no logras negociar el precio, al menos asegura que el edificio permite Airbnb".
// Lo que NO dispara: el cierre honesto ("ni un descuento de 10% alcanza"), y cualquier
// texto cuando la distancia NO es estructural.
//   node --env-file=.env.local --import tsx scripts/eval/golden/estructural-str-catch-test.ts
// ============================================================================
import { ofertasNegociacion, violacionesPorCampo, type ContextoGuardsStr } from "../../../src/lib/str-guards";
import type { AIAnalysisSTRv2 } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const casos: { nombre: string; texto: string; dispara: boolean }[] = [
  { nombre: "GE-4 · si no logras negociar", dispara: true, texto: "Antes de comprometerte, confirma la regulación del edificio; si no logras negociar el precio, al menos asegura que el edificio permite Airbnb." },
  { nombre: "si consigues un descuento", dispara: true, texto: "Si consigues un descuento de 8% el veredicto cambia." },
  { nombre: "negocia el precio (imperativo)", dispara: true, texto: "Negocia el precio: con UF 300 menos entras en zona de compra." },
  { nombre: "con un descuento ofrecido", dispara: true, texto: "Con un descuento de 10% el flujo queda positivo." },
  { nombre: "cierre honesto · ni un descuento", dispara: false, texto: "Ni un descuento de 10% en el precio alcanza: la brecha es del negocio." },
  { nombre: "cierre honesto · ningún ajuste", dispara: false, texto: "El negocio no cierra porque la zona premia el arriendo largo, no el corto, y ningún ajuste de tarifa o gestión cambia esa ecuación." },
  { nombre: "sin negociación", dispara: false, texto: "Busca otro departamento en una comuna con ocupación sobre 60%." },
  { nombre: "GE-4 · si no puedes dedicar horas (no es oferta)", dispara: false, texto: "Si no puedes dedicar 8-12 horas semanales a la operación, los números no cierran con administrador." },
  // v14 (tanda del 04-sep): la acción de negociar es oferta aunque la misma oración niegue el descuento.
  { nombre: "GE-4 v14 · negocia el precio con dureza aunque ningún descuento cambie", dispara: true, texto: "Antes de firmar, negocia el precio con dureza: aunque ningún descuento cambia el veredicto, cada UF que bajes reduce la herida patrimonial del día uno." },
  { nombre: "negociar con dureza (infinitivo)", dispara: true, texto: "Te conviene negociar con dureza antes de firmar." },
  { nombre: "no negocies (negación pegada)", dispara: false, texto: "No negocies el precio esperando que cambie el veredicto: no cambia." },
  { nombre: "sin negociar", dispara: false, texto: "Sin negociar nada, la conclusión es la misma: la zona no sostiene el corto." },
];
for (const c of casos) {
  const v = ofertasNegociacion(c.texto);
  if (c.dispara && v.length === 0) F(`${c.nombre}: debía disparar`);
  if (!c.dispara && v.length > 0) F(`${c.nombre}: no debía disparar y dio ${v.join(" | ")}`);
}

// Pegado al campo: la misma caja no dispara cuando la distancia no es estructural, y solo
// se evalúan las cajas (una caja limpia + un contenido con oferta ⇒ 0).
const ai = {
  conviene: { respuestaDirecta: "x", reencuadre: "x", cajaAccionable: "Si no logras negociar el precio, revisa la regulación." },
  rentabilidad: { contenido: "Si logras negociar, el cap sube.", cajaAccionable: "El CAP no alcanza el umbral." },
} as unknown as AIAnalysisSTRv2;
const base: ContextoGuardsStr = { razones: {}, estructural: true, frases: [], sobreRenta: 0 };
const conEstructural = violacionesPorCampo(ai, "estructural", base);
if (!conEstructural["conviene.cajaAccionable"]) F("estructural: la caja con oferta debía disparar");
if (conEstructural["rentabilidad.contenido"]) F("estructural: el contenido no es caja y no debía evaluarse");
if (Object.keys(violacionesPorCampo(ai, "estructural", { ...base, estructural: false })).length) F("no estructural: ninguna caja debía disparar");

console.log("\n[STR-ESTRUCTURAL] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
