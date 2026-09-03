// ============================================================================
// JERARQUÍA DE PRECIOS — catch-test (determinístico, 0 tokens)
// ============================================================================
// Auto-test del guard §1.12.6 (patrón catch-test.ts): rompe la invariante en
// memoria y verifica que el guard la CAZA; y verifica que NO dispara donde no
// debe. Casos del goal: (1) el testigo 51acbc01 como regresión (varias cifras
// canónicas de roles distintos sin subordinación), (2) informe limpio con solo
// su protagonista, (3) el borde de la línea de arbitraje (mismas cifras CON
// marcador → no dispara). Más: colapso del bloque (merge techo==umbral,
// límite-TIR omitido a <2%, cerrar_actual) y el fallback de append.
//
//   node --import tsx scripts/eval/golden/jerarquia-catch-test.ts
// ============================================================================

import {
  construirJerarquiaPrecios,
  detectarColisionesEnTexto,
  detectarColisionesJerarquia,
  appendArbitrajeCanonico,
  MARCADOR_SUBORDINACION,
} from "../../../src/lib/precio-jerarquia";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

// ── Set canónico estilo 51acbc01: pedido UF 1.000; objetivo (sostenible, sin umbral)
// −31,4%; flujo-neutro −54,6%; límite TIR −23,6% (tres roles, todos activos) ──
const jer = construirJerarquiaPrecios({
  precioPedidoUF: 1000,
  objetivoUF: null,
  veredictoAlUmbral: null,
  sostenibleUF: 686,
  modoSugerido: "optimizar_flujo",
  esEstructural: false,
  minimoFueraDeRangoUF: null,
  minimoFueraDeRangoPct: null,
  precioFlujoNeutroUF: 454,
  descuentoParaNeutro: 54.6,
  lecturaFlujoNeutro: "UF 454 (descuento 54,6%)",
  limiteTirUF: 764,
  sinCapitalPropio: false,
});

console.log("── construcción del bloque ──");
check("tres roles activos", jer.precios.length === 3, jer.precios.map((p) => p.rol).join(","));
check("bloque nombra protagonista por pieza", /Protagonista por pieza/.test(jer.bloque));
check("subordinaciones del bloque pasan su propio marcador", jer.precios.filter((p) => p.subordinacion).every((p) => MARCADOR_SUBORDINACION.test(p.subordinacion)));

console.log("── (1) regresión 51acbc01: roles mezclados sin subordinación → DISPARA ──");
const textoSucio = "Puedes abrir pidiendo un 31,4% de descuento, aunque para que la caja cierre necesitarías un 54,6% menos, y la TIR deja de acompañar con una rebaja de 23,6%.";
const col1 = detectarColisionesEnTexto([{ pieza: "negociacion", texto: textoSucio }], jer.precios);
check("detecta la colisión", col1.length === 1 && col1[0].roles.length === 3, JSON.stringify(col1));

console.log("── (2) informe limpio: solo el protagonista → NO dispara ──");
const textoLimpio = "El objetivo de la mesa es UF 686 — un 31,4% bajo lo pedido, y llegar ahí requiere un vendedor motivado.";
check("no dispara con un solo rol", detectarColisionesEnTexto([{ pieza: "negociacion", texto: textoLimpio }], jer.precios).length === 0);

console.log("── (3) borde: mismas cifras CON línea de arbitraje → NO dispara ──");
const textoArbitrado = `Tu número es UF 686 (−31,4%). A UF 454 el arriendo cubre justo la cuota — referencia de caja: es el punto donde la caja queda en cero, no el número a pelear.`;
check("marcador satisface el guard", detectarColisionesEnTexto([{ pieza: "negociacion", texto: textoArbitrado }], jer.precios).length === 0);
const casiCanonica = "Un descuento de 30,9% te acerca, y con 54,0% la caja cierra."; // fuera de tolerancia ±0,25pp
check("cifras fuera de tolerancia no cuentan", detectarColisionesEnTexto([{ pieza: "negociacion", texto: casiCanonica }], jer.precios).length === 0);

console.log("── umbral y sostenible iguales (±2%) ⇒ una sola entrada: el objetivo ──");
const jerMerge = construirJerarquiaPrecios({
  precioPedidoUF: 1000, objetivoUF: 800, veredictoAlUmbral: "COMPRAR", sostenibleUF: 805, modoSugerido: "alinear_mercado",
  esEstructural: false, minimoFueraDeRangoUF: null, minimoFueraDeRangoPct: null,
  precioFlujoNeutroUF: 0, descuentoParaNeutro: 0, lecturaFlujoNeutro: "no existe", limiteTirUF: null, sinCapitalPropio: false,
});
check("una sola entrada, el objetivo", jerMerge.precios.filter((p) => p.rol === "objetivo").length === 1 && !jerMerge.precios.some((p) => p.rol === "sostenible") && /donde cambia el veredicto/i.test(jerMerge.bloque));

console.log("── colapso: límite-TIR a <2% del objetivo se OMITE ──");
const jerLim = construirJerarquiaPrecios({
  precioPedidoUF: 1000, objetivoUF: null, veredictoAlUmbral: null, sostenibleUF: 800, modoSugerido: "alinear_mercado",
  esEstructural: false, minimoFueraDeRangoUF: null, minimoFueraDeRangoPct: null,
  precioFlujoNeutroUF: 0, descuentoParaNeutro: 0, lecturaFlujoNeutro: "no existe", limiteTirUF: 810, sinCapitalPropio: false,
});
check("límite omitido", !jerLim.precios.some((p) => p.rol === "limite_tir"));

console.log("── sostenible bajo el umbral → objetivo = umbral, sostenible subordinado como dato de caja ──");
const jerU = construirJerarquiaPrecios({
  precioPedidoUF: 1000, objetivoUF: 765, veredictoAlUmbral: "AJUSTA SUPUESTOS", sostenibleUF: 664, modoSugerido: "optimizar_flujo",
  esEstructural: false, minimoFueraDeRangoUF: null, minimoFueraDeRangoPct: null,
  precioFlujoNeutroUF: 0, descuentoParaNeutro: 0, lecturaFlujoNeutro: "no existe", limiteTirUF: null, sinCapitalPropio: false,
});
check("objetivo = umbral y sostenible subordinado", jerU.precios.some((p) => p.rol === "objetivo" && p.uf === 765) && jerU.precios.some((p) => p.rol === "sostenible" && /dato de caja/.test(p.subordinacion)) && /nunca "sobre esto no compras"/.test(jerU.bloque));

console.log("── estructural: sin objetivo ni sostenible; solo lo que haría falta ──");
const jerE = construirJerarquiaPrecios({
  precioPedidoUF: 3800, objetivoUF: null, veredictoAlUmbral: null, sostenibleUF: 2772, modoSugerido: "alinear_mercado",
  esEstructural: true, minimoFueraDeRangoUF: 3086, minimoFueraDeRangoPct: -18.8,
  precioFlujoNeutroUF: 0, descuentoParaNeutro: 0, lecturaFlujoNeutro: "no existe", limiteTirUF: null, sinCapitalPropio: false,
});
check("estructural solo con el mínimo fuera de rango", jerE.precios.length === 1 && jerE.precios[0].rol === "minimo_fuera_rango" && /SIN plan/.test(jerE.bloque) && !/techo/i.test(jerE.bloque));

console.log("── fallback: append determinístico a la 2ª falla ──");
const aiFalso = {
  conviene: { respuestaDirecta_clp: "ok", respuestaDirecta_uf: "ok", cajaAccionable_clp: "ok", cajaAccionable_uf: "ok" },
  negociacion: { contenido_clp: textoSucio, contenido_uf: textoSucio.replace("31,4", "31,4") },
  costoMensual: {}, largoPlazo: {},
};
const colFalso = detectarColisionesJerarquia(aiFalso, jer.precios);
check("colisión en el JSON", colFalso.length === 1 && colFalso[0].pieza === "negociacion");
const tocados = appendArbitrajeCanonico(aiFalso, colFalso, jer.precios);
check("append tocó los campos con texto", tocados === 2, `tocados=${tocados}`);
check("post-append el guard queda satisfecho", detectarColisionesJerarquia(aiFalso, jer.precios).length === 0);

console.log(fallas === 0 ? "\n✓ VERDE — guard jerarquía de precios caza y calla donde corresponde" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
