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
  correctivoJerarquia,
  detectarColisionesEnTexto,
  detectarColisionesJerarquia,
  piezasDeAiLtr,
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
// El predicado exigía «SIN plan», y b2bbb948 (bump 23→24) lo DEROGÓ a propósito: cuando
// ningún cambio por separado alcanza, el motor todavía puede tener salida combinando pie y
// plazo —136 filas del parque la tienen— así que el plan existe; lo que no existe es un
// PRECIO objetivo. El test quedó rojo sin que nada estuviera roto, y en rojo se quedó porque
// tampoco está cableado al runner. Lo que se fija ahora es la regla viva, que es además la
// que el caso estructural necesita: en `negociacion` no hay precio objetivo que ofrecer.
check("estructural solo con el mínimo fuera de rango", jerE.precios.length === 1 && jerE.precios[0].rol === "minimo_fuera_rango" && /SIN precio objetivo/.test(jerE.bloque) && !/techo/i.test(jerE.bloque));

// ── LO QUE SE FUE CON EL FALLBACK (17-sep-2026) ──────────────────────────────
// Acá vivían tres aserciones sobre `appendArbitrajeCanonico`: que appendeaba la línea
// de arbitraje a los campos de la pieza ofensora, que tocaba 2 campos y que post-append
// el guard quedaba satisfecho. El writer se RETIRÓ CON ACTA (precio-jerarquia.ts), así
// que fijar lo que hacía sería fijar código que no existe.
//
// Y su fixture —`negociacion.contenido_clp/_uf`— era de v21: el guard corría sobre una
// forma que el modelo ya no emite. De ahí que estas aserciones estuvieran en rojo sin
// que el producto estuviera roto en ese punto.
//
// LA COBERTURA NO SE VA CON ELLAS. Lo que el fallback prometía —que una colisión que
// sobrevive a los reintentos se corrige igual— pasa a estar cubierto por las dos cosas
// que SÍ tienen que ser ciertas ahora, y ninguna es un predicado solo-negativo (uno que
// prohíbe no afirma que lo correcto exista):
//   (a) las piezas declaran DETECCIÓN y nada más —`campos` era la lista de anfitriones
//       de escritura del writer, y sin writer no tiene consumidor—, y
//   (b) el ciclo cierra por el CORRECTIVO, que es lo que el modelo recibe para arreglarlo.
console.log("── el guard corrige por CORRECTIVO al modelo, no por parche determinista ──");
const forma = piezasDeAiLtr({});
check(
  "las piezas declaran solo {pieza, texto}",
  forma.length > 0 && forma.every((p) => Object.keys(p).sort().join(",") === "pieza,texto"),
  forma.map((p) => Object.keys(p).sort().join("+")).join(" | "),
);

// Fixture con la FORMA REAL de v22 —`negociacion` sin prosa, solo el objetivo y sus dos
// glosas—, que es por donde la detección de esta pieza sigue entrando: medido el
// 17-sep-2026 sobre el parque, 19 de 23 filas v22+ traen texto en las glosas y cero en
// los campos de prosa que v22 mató.
const aiV22 = {
  conviene: { cajaAccionable_clp: "ok", cajaAccionable_uf: "ok" },
  negociacion: {
    precioSugerido: "UF 686",
    precios: {
      glosaPrimeraOferta_clp: "Abre pidiendo un 31,4% de descuento.",
      glosaPrimeraOferta_uf: "Abre pidiendo un 31,4% de descuento.",
      glosaWalkAway_clp: "Para que la caja cierre necesitarías un 54,6% menos.",
      glosaWalkAway_uf: "Para que la caja cierre necesitarías un 54,6% menos.",
    },
  },
};
const colV22 = detectarColisionesJerarquia(aiV22, jer.precios);
check("la colisión se detecta en la forma v22 (por las glosas)", colV22.length === 1 && colV22[0].pieza === "negociacion", JSON.stringify(colV22));

const correctivo = correctivoJerarquia(colV22, jer.precios);
check("el correctivo nombra la pieza que chocó", /negociacion/.test(correctivo));
check("el correctivo nombra cada rol en colisión", colV22.length === 1 && colV22[0].roles.every((r) => correctivo.includes(r)), colV22[0]?.roles.join("+"));
check(
  "el correctivo le entrega al modelo la línea de subordinación de cada rol que la tiene",
  jer.precios.filter((p) => p.subordinacion).every((p) => correctivo.includes(p.subordinacion)),
);

console.log(fallas === 0 ? "\n✓ VERDE — guard jerarquía de precios caza y calla donde corresponde" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
