/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ofertasNegociacion, violacionesPorCampo, contextoGuardsStr, type ContextoGuardsStr } from "../../../src/lib/str-guards";
import { simularStrDesdePersistido } from "../../../src/lib/analysis/simular-str";
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

// v19 (12-sep-2026) · EL GUARD SE ACOTA: «estructural» acá es «ningún cambio por separado
// alcanza Y el motor tampoco encontró combinación» (la fuente de la card, salidaPorMixStr).
// Con combinación, la instrucción nueva le pide al modelo nombrar el descuento que el mix
// además pide: si este guard siguiera colgando de `esEstructural`, borraría en el reintento
// justo lo que el prompt manda escribir. Medido en dos fixtures reales, con simulación.
{
  const fixtures = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "src", "app", "dev", "drawers-pixel", "fixtures.json"), "utf8")) as Record<string, any>;
  const ctxDe = (clave: string): ContextoGuardsStr => {
    const fx = fixtures[clave];
    const d = fx.input_data as Record<string, unknown>;
    const uf = Number(d.precioCompra) / Number(d.precioCompraUF);
    return contextoGuardsStr(fx.results, d, fx.comuna, simularStrDesdePersistido(d, fx.results, uf, new Date(fx.created_at)));
  };
  if (ctxDe("estructuralMixStr").estructural) F("acotado · estructuralMixStr (AJUSTA, ningún cambio solo pero mix pie 30% + plazo 30 años + −17,5%) NO puede quedar como estructural para este guard: la caja tiene que poder nombrar ese descuento");
  if (!ctxDe("maculStrSinSalida").estructural) F("acotado · maculStrSinSalida no tiene combinación: sigue siendo estructural y la caja no puede ofrecer negociar");
  if (ctxDe("grajalesStr").estructural) F("acotado · grajalesStr (BUSCAR con combinación solo al escalón) tampoco cierra la puerta entera: no es estructural para este guard");
}

console.log("\n[STR-ESTRUCTURAL] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
