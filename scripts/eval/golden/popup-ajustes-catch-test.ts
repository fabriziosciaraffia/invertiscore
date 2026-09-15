// ============================================================================
// GOLDEN · EL POP-UP DE AJUSTES — catch-test (13-sep-2026). 0 tokens, sin base.
// ============================================================================
// Contrato visual: docs/wireframes/rediseno-informe/popup-palancas-final.html
// Datos: los emite el bloque A (`mixPalancas.celdas`, `.score`, `.despues` y
// `palancas[].score/destino`). Este tier fija el RENDER: que lea del motor y no invente,
// que cada estado dibuje lo suyo, y que el estado sin nada no abra pop-up.
//
// LOS CUATRO ESTADOS (medidos sobre el parque recomputado, 13-sep-2026):
//
//              con grilla   sin grilla+solas   sin nada   COMPRAR
//   LTR            772             0             270        160
//   STR            114             6              73         56
//
// Fija TRECE cosas:
//
//   1. EL POP-UP LEE DEL MOTOR. La matriz sale de `mixPalancas.celdas` y la tabla de
//      `palancas[]`; el componente no recalcula descuentos ni scores. Si alguien mete
//      aritmética de veredicto en el render, el informe puede decir dos cosas distintas
//      del mismo caso.
//
//   2. LA CELDA MUESTRA VEREDICTO Y SCORE, no el descuento. El descuento es del panel de
//      detalle, con el pie extra, y aparece al tocar la celda.
//
//   3. «HOY» NO SE INVENTA. 16 filas LTR y 2 STR no tienen celda actual porque su plazo
//      declarado no está en la grilla del mix. Ahí no se marca nada ni se nombra en la
//      leyenda (decisión Fabrizio, 13-sep-2026).
//
//   4. EL ÓPTIMO SON SIETE PARES y el del retorno va SIEMPRE, con guion cuando no aplica
//      (pie 0: 21 filas LTR, 8 STR). No se omite la fila.
//
//   5. EN COMPRAR NO HAY MATRIZ NI ÓPTIMO: no hay a dónde subir. Van los márgenes de la
//      card —Margen, Precio, Verifica— y la tabla de las solas si alguna mueve algo.
//
//   6. SIN GRILLA NI PALANCAS, NO HAY POP-UP. La card ya lo dice todo —«no hay forma», el
//      número y la alternativa de comunas— y repetirlo en un pop-up es ruido. El botón no
//      se dibuja (decisión Fabrizio, 13-sep-2026).
//
//   9. EL COLOR VA POR FAMILIA. Lo que nombra un VEREDICTO se pinta con la tríada
//      (`--doc-comprar`), no con el verde `--doc-good` del semáforo del dato. Son dos
//      afirmaciones distintas —«este caso pasa a Comprar» contra «este dato está bien»— y
//      con el mismo color el pop-up decía las dos a la vez. El verde queda donde hay un
//      dato con signo: flujo mensual y retorno. Y la selección de una celda es un aro de
//      tinta, no un color de veredicto (decisión Fabrizio, 13-sep-2026).
//
//   7. EL CTA VA INERTE. Se dibuja con el precio negociado y no navega: la decisión de
//      créditos es del bloque C. Un CTA que navega antes de esa decisión cobraría un
//      análisis sin que nadie lo haya decidido.
//
//   8. EL CUARTO ESTADO TIENE FIXTURE. «Sin grilla, con palancas solas» son 6 filas STR y
//      ninguna estaba volcada: el estado no se podía ver ni fotografiar.
//      `providenciaStrSoloPalancas` lo cubre, y el invariante fija que ahí el pop-up no
//      dibuje matriz vacía ni óptimo inventado.
//
// Corre dentro del QUICK (tier "popup-ajustes") y standalone:
//   node --import tsx scripts/eval/golden/popup-ajustes-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fixtures from "../../../src/app/dev/drawers-pixel/fixtures.json";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };


const POPUP = leer("src/components/analysis/shared/PopupAjustes.tsx");
const HERO_LTR = leer("src/components/analysis/HeroLTR.tsx");
const HERO_STR = leer("src/components/analysis/str/HeroStrDictamen.tsx");
const CSS = leer("src/components/analysis/shared/PopupAjustesTokens.tsx");
const PORTADA = leer("src/components/analysis/portada/PortadaInforme.tsx");

// ── 1 · existe y lee del motor ─────────────────────────────────────────────
{
  if (!POPUP) F("1 · no existe `src/components/analysis/shared/PopupAjustes.tsx`");
  else {
    if (!/mixPalancas/.test(POPUP) || !/\.celdas/.test(POPUP)) F("1 · el pop-up no lee `mixPalancas.celdas`: la matriz saldría de otra fuente que la del motor");
    if (!/despues/.test(POPUP)) F("1 · el pop-up no lee `despues`: los pares del óptimo no tendrían lado derecho");
    // El render NO decide veredictos: nada de recomputar ni de comparar bandas acá.
    if (/deriveVeredicto|calcMetrics|calcScoreFromMetrics|calcularMixPalancas/.test(POPUP)) {
      F("1 · el pop-up llama al motor: el render pinta lo que el motor ya decidió, no lo recalcula");
    }
  }
}

// ── 2 · la celda dice veredicto y score; el descuento es del panel ─────────
{
  if (POPUP && !/score/.test(POPUP)) F("2 · la celda no muestra el score");
  if (POPUP && !/etiquetaVeredicto|veredicto/.test(POPUP)) F("2 · la celda no muestra el veredicto");
  if (POPUP && !/descuentoPct/.test(POPUP)) F("2 · el panel de detalle no muestra el descuento que se pide");
  if (POPUP && !/costoDiaUnoUF/.test(POPUP)) F("2 · el panel de detalle no muestra el pie extra del día uno");
  if (POPUP && !/no llega a/.test(POPUP)) F("2 · el panel no contempla la celda que no cruza («no llega a Comprar»)");
  // ENSANCHADO (16-sep-2026): «no llega» es de UNA sola celda, y antes era de dos.
  // La condición era `descuentoPct === null || !alcanzable` y las dos ramas escribían lo
  // mismo. Solo la primera es cierta: la segunda CRUZA y cuesta más de lo que la
  // recomendación pone, y en 43 filas del parque es justo la que el menú ofrece. El panel
  // tiene que separarlas o vuelve a decirle «no llega» a una celda que llega.
  if (POPUP) {
    // El corte va hasta el siguiente `function` de columna 0, no hasta el primer `\n}`: el
    // cuerpo de PanelCelda tiene llaves anidadas y un corte no-goloso se detenía adentro de
    // la destructuración, así que el guard leía un fragmento y daba rojo sano por la razón
    // equivocada. Es la misma trampa de «un guard se acota al componente, no al archivo».
    const panel = POPUP.match(/function PanelCelda\([^]*?\n(?=(?:\/\/|\/\*\*|function ))/)?.[0] ?? "";
    if (!panel) F("2 · no se encontró `PanelCelda` para auditar su condición");
    else {
      if (/descuentoPct === null \|\| !sel\.alcanzable/.test(panel)) {
        F("2 · el panel volvió a colapsar los dos casos: una celda que cruza y cuesta de más NO es una que no llega");
      }
      if (!/!sel\.alcanzable/.test(panel)) {
        F("2 · el panel dejó de declarar el caso de la celda que llega y cuesta más de lo que Franco recomienda poner");
      }
    }
  }
}

// ── 3 · «hoy» no se inventa ────────────────────────────────────────────────
{
  if (POPUP && !/esActual/.test(POPUP)) F("3 · el pop-up no mira `esActual`: no podría marcar la celda de hoy");
  // La leyenda de «hoy» solo existe si alguna celda lo es.
  if (POPUP && !/some\(\(?c\)? => c\.esActual\)|hayActual/.test(POPUP)) {
    F("3 · la leyenda nombra «hoy» sin comprobar que exista la celda: 16 filas LTR y 2 STR no la tienen");
  }
}

// ── 4 · los siete pares, con el retorno siempre ────────────────────────────
{
  if (!POPUP) F("4 · sin componente no hay pares que fijar");
  else {
    for (const [k, etiqueta] of [
      ["Pie el día uno", "el pie del día uno"],
      ["Cuota mensual", "la cuota"],
      ["Flujo mensual", "el flujo"],
      ["Por cada \\$100 que pones", "el retorno sobre lo puesto"],
      ["Cap rate neto", "el cap rate"],
      ["TIR a 10 años", "la TIR"],
      ["Franco Score", "el score"],
    ] as const) {
      if (!new RegExp(k).test(POPUP)) F(`4 · falta el par de ${etiqueta}`);
    }
    // El par del retorno NO se omite con pie 0: va con guion.
    if (!/PAR_SIN_VALOR|—/.test(POPUP)) F("4 · no hay marca de «sin valor»: con pie 0 el par del retorno tiene que ir con guion, no omitirse");
  }
}

// ── 5 · COMPRAR: márgenes, sin matriz ni óptimo ────────────────────────────
{
  if (POPUP && !/Margen/.test(POPUP)) F("5 · en COMPRAR el pop-up no muestra la fila «Margen» de la card");
  if (POPUP && !/Verifica/.test(POPUP)) F("5 · en COMPRAR el pop-up no muestra la fila «Verifica» de la card");
  if (POPUP && !/COMPRAR/.test(POPUP)) F("5 · el pop-up no distingue el caso COMPRAR");
}

// ── 6 · sin grilla ni palancas, no hay botón ───────────────────────────────
{
  for (const [src, quien] of [[HERO_LTR, "HeroLTR"], [HERO_STR, "HeroStrDictamen"]] as const) {
    if (!src) { F(`6 · no se pudo leer ${quien}`); continue; }
    if (!/abrePopupAjustes|hayAjustesQueMostrar/.test(src)) {
      F(`6 · ${quien} no decide si hay algo que mostrar antes de dibujar el botón: el estado sin grilla ni palancas no puede abrir un pop-up que repite la card`);
    }
  }
}

// ── 7 · el CTA va inerte ───────────────────────────────────────────────────
{
  if (POPUP) {
    if (!/Analízalo a UF/.test(POPUP)) F("7 · el CTA no dibuja el precio negociado («Analízalo a UF X»)");
    // Inerte de verdad: ni link ni handler de navegación.
    if (/<Link|href=|router\.push|window\.location/.test(POPUP)) {
      F("7 · el CTA navega: hasta el bloque C tiene que ser inerte (la decisión de créditos no está tomada)");
    }
    if (!/inerte/i.test(POPUP)) F("7 · el CTA no declara en el código que es inerte a propósito: sin esa nota, el próximo lector lo lee como un bug");
  }
}

// ── 8 · el cuarto estado: sin grilla, con palancas solas ───────────────────
//
// Son 6 filas STR del parque y ninguna estaba volcada, así que el estado vivía sin
// fixture: nadie podía verlo ni fotografiarlo. `providenciaStrSoloPalancas` lo cubre
// (13-sep-2026). Lo que este invariante protege es que el pop-up NO dibuje matriz vacía
// ni óptimo inventado cuando el motor no encontró combinación: solo la tabla.
{
  const fx = (fixtures as Record<string, unknown>)["providenciaStrSoloPalancas"] as
    | { results?: { hallazgos?: { id: string; valor?: Record<string, unknown> }[] } }
    | undefined;
  if (!fx) F("8 · falta el fixture `providenciaStrSoloPalancas`: el cuarto estado del pop-up quedaría sin cobertura");
  else {
    const dv = (fx.results?.hallazgos ?? []).find((h) => h.id === "distancia_veredicto")?.valor as
      | { mixPalancas?: { celdas?: unknown[] } | null; mixPalancasHastaComprar?: { celdas?: unknown[] } | null; palancas?: unknown[] }
      | undefined;
    if (!dv) F("8 · el fixture del cuarto estado no trae hallazgo de distancia");
    else {
      const celdas = (dv.mixPalancas ?? dv.mixPalancasHastaComprar)?.celdas ?? [];
      const solas = dv.palancas ?? [];
      if (celdas.length) F(`8 · el fixture del cuarto estado trae ${celdas.length} celdas: ya no es «sin grilla» y deja de cubrir el estado`);
      if (!solas.length) F("8 · el fixture del cuarto estado no trae palancas que crucen solas");
    }
  }
  // Y el componente tiene que sobrevivir a ese caso: la matriz y el óptimo cuelgan de que
  // HAYA celdas, y el CTA del mix. Si alguno se dibujara sin grilla, sería una caja vacía.
  if (POPUP) {
    if (!/celdas\.length > 0 && \(\s*\n?\s*<SeccionMatriz|celdas\.length > 0 &&/.test(POPUP)) {
      F("8 · la matriz no está condicionada a que haya celdas: sin grilla dibujaría una caja vacía");
    }
    if (!/celdas\.length > 0 && <Cta|celdas\.length > 0 && <SeccionOptimo/.test(POPUP)) {
      F("8 · el óptimo o el CTA no están condicionados a que haya grilla");
    }
    if (!/solas\.length > 0 &&/.test(POPUP)) F("8 · la tabla de las solas no está condicionada a que existan");
  }
}

// ── 9 · el color va por familia ─────────────────────────────────────────────
{
  // El token tiene que existir en los DOS temas: sin la variante clara la celda se pinta
  // con el azul de papel oscuro sobre blanco, o no se pinta.
  if (PORTADA) {
    const decls = PORTADA.match(/--doc-comprar:\s*#[0-9A-Fa-f]{6}/g) ?? [];
    if (decls.length < 2) {
      F(`9 · «--doc-comprar» está declarado ${decls.length} vez/veces: hacen falta las dos, oscuro y claro`);
    }
  }
  if (CSS) {
    // Cada regla que nombra un veredicto, con el color que le toca.
    const porVeredicto: [RegExp, string][] = [
      [/\.paj-mtx td\.cruza\{[^}]*\}/, "la celda que llega a Comprar"],
      [/\.paj-sw\.b\{[^}]*\}/, "el cuadrito de la leyenda"],
      [/\.paj-unica \.v\.cruza\{[^}]*\}/, "la celda única que cruza"],
      [/\.paj-nod \.dst\.comprar\{[^}]*\}/, "«llegas a Comprar» de la tabla de las solas"],
      [/\.paj-par \.b1\.destino\{[^}]*\}/, "el Franco Score de destino"],
    ];
    for (const [re, quien] of porVeredicto) {
      const m = CSS.match(re);
      if (!m) { F(`9 · no se encuentra la regla de ${quien}`); continue; }
      if (/--doc-good|--doc-warn/.test(m[0])) {
        F(`9 · ${quien} se pinta con el semáforo del dato: nombra un veredicto, va con «--doc-comprar»`);
      }
      if (!/--doc-comprar/.test(m[0])) F(`9 · ${quien} no usa «--doc-comprar»`);
    }
    // El verde sobrevive SOLO en el semáforo del dato. Cualquier otro uso es una cuarta
    // familia de color entrando por la ventana.
    const usos = (CSS.match(/^[ ]*\.[^{\n]*\{[^}]*--doc-good[^}]*\}/gm) ?? []).map((r) => r.split("{")[0].trim());
    const permitidos = [".paj-par .b1.bien"];
    for (const u of usos) {
      if (!permitidos.includes(u)) F(`9 · «${u}» usa el verde del dato fuera del semáforo`);
    }
    // La selección es tinta, no veredicto.
    const selRule = CSS.match(/\.paj-mtx td\.sel\{[^}]*\}/);
    if (!selRule) F("9 · no se encuentra la regla del aro de selección");
    else if (/--verdict/.test(selRule[0])) {
      F("9 · el aro de selección usa «--verdict»: en una fila Ajusta dibuja un aro ciruela alrededor de una celda que dice «llega a Comprar»");
    }
    // Las barras de COMPRAR se retiraron: las tres filas lo dicen con oraciones completas.
    if (/paj-fr/.test(CSS) || /BarraFrontera/.test(POPUP)) {
      F("9 · volvieron las barras de frontera de COMPRAR: repiten las tres filas y se leían en direcciones opuestas");
    }
  }
}

// ── 10 · LA CELDA DEL ARO HABLA DEL HOY, Y LA MATRIZ LO DECLARA ────────────
//
// `esActual` significa «el pie y el plazo que tienes declarados», no «tu caso actual». El
// render dibujaba ahí la lectura EN EL DESCUENTO MÍNIMO, así que el aro prometía «tu
// situación» y el contenido mostraba «tu situación con un descuento encima». Medido el
// 14-sep-2026: en 501 de 739 filas esa celda mostraba un veredicto distinto al de la fila,
// y en el 100% de las 360 que el pop-up dibuja pasaba a decir «Comprar» sobre un caso que
// la propia página declara «Ajustar».
//
// Tres cosas que tienen que viajar juntas, o el arreglo se deshace solo:
//   · la celda del aro lee `veredictoSinDescuento` / `scoreSinDescuento`;
//   · la matriz DECLARA que tiene dos lecturas — el subtítulo lo dice en palabras y el aro
//     marca cuál es;
//   · cuando el aro coincide con la coronada, el fondo de tinta se retira (145 filas): un
//     fondo que dice «lo que Franco recomienda» sobre una celda que dice «Ajustar» promete
//     lo contrario de lo que pasa.
//
// LA MARCA ES EL ARO, NO UN CHIP (15-sep-2026). Entre el 14 y el 15 este invariante exigía
// un chip de tinta pegado a la celda. Se retiró, y la aserción no se borró: se reescribió
// leyendo del contrato visual (popup-palancas-final.html:77 y :189), que marca esa celda
// con el aro y nada más, y que ya la mostraba diciendo «Ajustar score 62».
// El chip era ambiguo acá porque la tinta plena de esta matriz ya significa «el óptimo»
// (td.mix y el swatch .paj-sw.a); en la matriz de origen ninguna celda lleva tinta.
{
  if (!POPUP) F("10 · sin componente no hay celda del aro que fijar");
  else {
    if (!/veredictoSinDescuento/.test(POPUP)) {
      F("10 · el render no lee `veredictoSinDescuento`: la celda del aro sigue mostrando su lectura con descuento y contradice el veredicto de la fila");
    }
    if (!/scoreSinDescuento/.test(POPUP)) F("10 · el render no lee `scoreSinDescuento`");
    // La declaración de las dos lecturas: el subtítulo tiene que nombrar el precio de hoy.
    if (!/precio de hoy/i.test(POPUP)) {
      F("10 · la matriz no declara que la celda del aro va a precio de hoy: sin esa línea el próximo lector deshace el arreglo");
    }
    // La regla de las 145: si el aro es la coronada, no hay tinta plena.
    if (!/esActual\s*&&\s*c\.esElegida|c\.esElegida\s*&&\s*!c\.esActual/.test(POPUP)) {
      F("10 · la clase de tinta plena no excluye la celda del aro: en 145 filas el fondo diría «lo que Franco recomienda» sobre el veredicto de partida");
    }
    // Y la marca tiene que existir en el render: sin la clase, el CSS del aro no cuelga de nada.
    if (!/c\.esActual \? "hoy"|esActual.*"hoy"/.test(POPUP)) {
      F("10 · el render no le pone la clase `hoy` a la celda del aro: la marca que la leyenda nombra no tendría de dónde colgar");
    }
  }
  // LA MARCA DEL ARO, EN EL CSS. No alcanza con que exista: tiene que ir en sombra inset y
  // NO en outline, porque `td.sel` también es outline, con la misma especificidad y
  // declarado después, así que se la lleva puesta y al tocar la celda del aro el aro gris
  // desaparece. Medido en el navegador el 14-sep-2026. Precedente: `.mz-cell.hoy`
  // (TokensShared.tsx:42) marca el hoy con box-shadow inset por esta misma razón.
  {
    const regla = CSS.match(/\.paj-mtx td\.hoy\{[^}]*\}/)?.[0] ?? "";
    if (CSS && !regla) F("10 · no existe la regla de `td.hoy`: la celda del aro quedaría sin marca");
    else if (regla && !/box-shadow:\s*inset/.test(regla)) {
      F("10 · el aro de hoy no va en sombra inset: con outline, el aro de selección lo reemplaza y la celda pierde la marca que la leyenda llama «hoy»");
    }
    // Y la sombra de hover es la misma propiedad, así que la celda de hoy tiene que listar
    // las dos o pierde el realce que dice que se puede tocar.
    if (CSS && regla && !/\.paj-mtx td\.hoy:hover\{[^}]*inset[^}]*,/.test(CSS)) {
      F("10 · `td.hoy` no repone la sombra de hover junto al aro: el aro gris se come el realce y la celda deja de parecer tocable");
    }
  }
}

// ── 13 · LA BANDA DE ESFUERZO SE DIBUJA, Y SOLO EN DOS LUGARES ─────────────
//
// El juicio sobre cuán conseguible es el descuento EXISTE desde hace tiempo:
// `bandaEsfuerzoDescuento` (distancia-veredicto-hallazgo.ts:85), tres bandas con cortes
// doctrinales 5 y 12 (§1.12.1 del skill analysis-voice-franco) y lenguaje canónico. Hasta
// el 15-sep-2026 sus únicos consumidores eran builders de prompt: el juicio se calculaba,
// se le pasaba al modelo para que lo narrara, y el usuario no lo veía nunca.
//
// Medido sobre el parque: de las 265 filas LTR con descuento de mix, el 86,8% cae en la
// banda «difícil, requiere vendedor motivado» y se publicaba con la misma cara que un 4%.
//
// DOS LUGARES Y NINGUNO MÁS, y el «ninguno más» es la mitad del invariante:
//   · `.paj-neg` del pop-up y `.rec-pides` de la card §5 — el MISMO número, el que Franco
//     recomienda pedir;
//   · NO la tabla de palancas solas ni el drawer. Ese es otro descuento —el precio como
//     palanca única— y cae en banda DISTINTA en el 10,5% de las filas. Las dos marcas en
//     el mismo modal emitirían dos juicios sobre «el descuento» en una pantalla.
//
// Y TRES BANDAS, NO CUATRO. `/comunas` tiene una segunda implementación con un cuarto
// corte en 25 que llama «estructural»; ese 25 es `DIST_STR_TOPE_AJUSTA_PCT`, el tope de
// RENTA CORTA. La doctrina dice «hasta el tope aplicable», que en LTR es 30, y medido:
// 0 de 265 filas superan 30. Llamar estructural a algo que está dentro de su tope diría
// algo falso, y el caso estructural de verdad ya tiene su propia frase, no una banda.
{
  const LQHY = leer("src/components/analysis/shared/LoQueHariaYoBloque.tsx");
  if (!LQHY) F("13 · no se pudo leer LoQueHariaYoBloque.tsx");
  const BUILDER = leer("src/lib/lo-que-haria-yo.ts");
  for (const [src, quien] of [[POPUP, "el pop-up"], [LQHY, "la card §5"]] as const) {
    if (!src) continue;
    // DIBUJARLA es usar la etiqueta canónica; de dónde sale la CLASE es otra pregunta y la
    // contesta el bloque de abajo. El pop-up clasifica al vuelo porque su descuento es un
    // número; la card lee `mix.bandaEsfuerzo`, que su builder ya clasificó — y eso es MÁS
    // doctrinal, no menos (§1.12.1: «la banda se calcula en el builder»).
    if (!/ETIQUETA_BANDA_ESFUERZO/.test(src)) {
      F(`13 · ${quien} no dibuja la banda de esfuerzo: el juicio existe en el motor y el usuario sigue sin verlo`);
    }
    // UNA SOLA VEZ POR SUPERFICIE. Dos usos en el mismo archivo ya serían la banda esparcida.
    const veces = (src.match(/ETIQUETA_BANDA_ESFUERZO\[/g) ?? []).length;
    if (veces > 1) F(`13 · ${quien} dibuja la banda ${veces} veces: va en un solo lugar por superficie`);
    // NO SE RECLASIFICA EN EL RENDER. Los cortes viven en la fuente, §1.1.
    if (/<=\s*5\b[^]{0,80}<=\s*12\b/.test(src)) {
      F(`13 · ${quien} reimplementa los cortes 5/12 en vez de llamar a la fuente`);
    }
    // NI CUARTA BANDA NI SU COLOR.
    if (/estructural/i.test(src)) F(`13 · ${quien} nombra una banda «estructural»: son TRES, y el caso estructural no es una banda`);
    if (/#C8323C/i.test(src)) F(`13 · ${quien} trae el rojo hardcodeado de la pill de /comunas`);
  }
  // LA TABLA DE PALANCAS SOLAS NO LLEVA BANDA: otro descuento, otro juicio.
  if (POPUP) {
    const tabla = POPUP.match(/paj-nod[^]*?<\/table>/)?.[0] ?? "";
    if (tabla && /bandaEsfuerzoDescuento/.test(tabla)) {
      F("13 · la tabla «Un cambio a la vez» lleva banda: es el precio como palanca sola y cae en otra banda en el 10,5% de las filas");
    }
  }
  // LA CLASE SALE DE LA FUENTE, NUNCA DEL RENDER. Una de las dos superficies la pide al
  // vuelo y la otra la recibe del builder, pero ninguna la deduce por su cuenta.
  if (BUILDER && !/bandaEsfuerzoDescuento\(/.test(BUILDER)) {
    F("13 · el builder de la card §5 no clasifica la banda: sin eso el render tendría que volver a parsear «−24,3%» a número para juzgarlo");
  }
  // Y CADA HUÉSPED CON SUS TOKENS. La card §5 es oscura en los DOS temas, así que su pill
  // no puede usar los `--doc-*` del pop-up ni al revés.
  if (CSS && !/\.paj-banda\{/.test(CSS)) F("13 · falta el CSS de la pill de banda en el pop-up");
  if (PORTADA && !/\.rec-banda\{/.test(PORTADA)) F("13 · falta el CSS de la pill de banda en la card §5");
  if (PORTADA && /\.rec-banda\{[^}]*--doc-/.test(PORTADA)) {
    F("13 · la pill de la card §5 usa tokens `--doc-*`: esa card es oscura en los dos temas y ahí resolverían al tema de la página, dejándola invisible");
  }
}

// ── 11 · EL PANEL DE DETALLE NO CONTRADICE A SU CELDA ──────────────────────
//
// Al tocar la celda del aro, el panel decía «Pides de descuento −24,2%» sobre la misma
// celda que ahora dice «Ajustar». Las dos lecturas conviven, pero separadas y con su
// rótulo cada una: la celda dice el hoy y el panel dice a dónde llega con descuento.
{
  if (POPUP && !/llegas a|Pidiendo/.test(POPUP)) {
    F("11 · el panel de detalle no distingue la celda del aro: sigue rotulando «Pides de descuento» sobre una celda que habla del hoy");
  }
}

// ── 12 · EL COLOR LEE DE LA MISMA FUENTE QUE LA PALABRA ────────────────────
//
// La primera versión de este arreglo cambió la palabra de la celda del aro y dejó el color
// leyendo `c.veredicto`. Cazado en el navegador el 14-sep-2026 sobre el análisis demo: la
// celda quedó con clase «cruza hoy», o sea fondo azul diciendo «llega a Comprar» con
// «Ajustar score 67» escrito adentro. Es la misma contradicción que el arreglo de color del
// 13-sep declaró prohibida —«acá manda la palabra»— reintroducida por la puerta de al lado,
// y el mismo argumento por el que la corona pierde la tinta cuando cae sobre el aro.
//
// Por eso el invariante no es «que exista veredictoSinDescuento en el archivo» (eso ya lo
// fija el 10) sino que el predicado del COLOR lea la misma función que la palabra.
{
  if (POPUP) {
    if (!/function veredictoMostrado/.test(POPUP)) {
      F("12 · no hay fuente única de lo que la celda escribe: sin `veredictoMostrado` la palabra y el color vuelven a separarse");
    }
    const cuerpo = POPUP.match(/function cruzaDeVerdad[^]*?\n\}/)?.[0] ?? "";
    if (!cuerpo) {
      F("12 · no se encontró `cruzaDeVerdad` para auditar de dónde saca el veredicto");
    } else if (!/veredictoMostrado\(/.test(cuerpo)) {
      F("12 · el color no lee `veredictoMostrado`: la celda del aro puede quedar pintada de «llega a Comprar» con «Ajustar» escrito adentro");
    }
    // Y EL PREDICADO RECIBE LA PALABRA, NO LA SACA. Mientras `cruzaDeVerdad` elegía por su
    // cuenta, arreglar la matriz desincronizó la rama de celda única en silencio: esa rama
    // siguió escribiendo `c.veredicto` y su color pasó a leer el hoy. La palabra decía
    // «Comprar» y el color dejaba de pintarla — el mismo divorcio, del otro lado.
    if (!/function cruzaSegun\(\s*veredictoEscrito/.test(POPUP)) {
      F("12 · el predicado del color no recibe la palabra escrita: con una sola fuente interna, la rama que escribe otra lectura se desincroniza sin que nada falle");
    }
    // ── ENSANCHADO CON EL MENÚ (16-sep-2026): EL COLOR NO PREGUNTA POR NINGÚN TOPE ──
    //
    // El predicado llevaba un tercer conjunto, `c.alcanzable`, que no es sobre la palabra
    // sino sobre el tope de la equilibrada. Con él, 57 de 1.912 celdas del parque decían
    // «Comprar» pintadas en gris, y 43 de esas son las que el menú ofrece como «la que más
    // alivia el mes». Quien manda es la leyenda: los DOS contratos rotulan el swatch azul
    // «llega a Comprar», así que el azul afirma que LLEGA, no que quepa en un tope — y el
    // contrato nuevo lo dibuja así, pintando `cruza` celdas sobre el tope que su propio menú
    // no ofrece (popup-menu-respuestas.html:264-265).
    //
    // Sin esta aserción, devolver el tope al predicado no rompe nada y la contradicción
    // vuelve sola. Vale para CUALQUIER tope: el de la equilibrada, el de flujo, o el de la
    // respuesta que se esté viendo.
    const cuerpoSegun = POPUP.match(/function cruzaSegun\([^]*?\n\}/)?.[0] ?? "";
    if (!cuerpoSegun) {
      F("12 · no se encontró el cuerpo de `cruzaSegun` para auditar por qué pregunta");
    } else if (/alcanzable|dentroDeSuTope|topePtsPrecio|costoPtsPrecio/.test(cuerpoSegun)) {
      F("12 · el predicado del color volvió a preguntar por un tope: el azul dice «llega a Comprar», y quién es una salida lo dice el menú");
    }
    const unaSola = POPUP.match(/if \(unaSola\) \{[^]*?\n  \}/)?.[0] ?? "";
    if (!unaSola) {
      F("12 · no se encontró la rama de celda única para auditar su color");
    } else {
      const palabraHoy = /veredictoMostrado\(c\)/.test(unaSola);
      const colorHoy = /cruzaSegun\(\s*veredictoMostrado\(c\)/.test(unaSola) || /cruzaDeVerdad\(/.test(unaSola);
      if (palabraHoy !== colorHoy) {
        F("12 · la rama de celda única escribe una lectura y pinta con la otra: las 12 filas LTR que la usan quedan con la palabra y el color divorciados");
      }
    }
  }
}

// ── 14 · EL PLAN QUE NO SE MUEVE A NINGUNA CELDA (16-sep-2026) ─────────────
//
// Cuando la respuesta elegida tiene las DOS deltas en cero, el plan es quedarse donde estás
// y negociar precio. Apuntar ahí con el aro dejaba la marca sobre la única celda del grillado
// que no dice «Comprar» —la de hoy muestra su lectura a precio de hoy— y con la tinta ya
// retirada, o sea sin ninguna marca en pantalla. Medido: 143 filas LTR (37,1% de las que
// tienen menú) y 7 STR abrían así. Y encima el mismo score salía escrito dos veces distinto:
// 74 en el menú y 54 en la celda.
//
// TRES COSAS QUE TIENEN QUE MOVERSE JUNTAS, y por eso van en un invariante y no en tres:
//  · la fila deja de mostrar coordenadas de celda y score de celda;
//  · no se dibuja aro;
//  · la cuarta entrada de la leyenda cuelga de que HAYA ARO, no de que haya menú — si no,
//    nombraría una marca ausente, que es el único bug de esa clase que el barrido de
//    coherencia buscó en 481 pop-ups y no encontró.
{
  if (POPUP) {
    if (!/const planSinCelda\s*=/.test(POPUP)) {
      F("14 · no existe `planSinCelda`: nada distingue el plan que no se mueve a ninguna celda");
    }
    // El predicado son LAS DOS DELTAS, no `redundanteConPalancaSola`: la bandera es un
    // superconjunto y toca 19 filas LTR más, donde el mix SÍ mueve una dimensión y su fila
    // no miente. Esas quedan fuera a propósito.
    const decl = POPUP.match(/const planSinCelda[^;]*;/)?.[0] ?? "";
    if (!/piePctDelta === 0[\s\S]*plazoAniosDelta === 0/.test(decl)) {
      F("14 · `planSinCelda` no se escribe con las dos deltas en cero");
    }
    if (/redundanteConPalancaSola/.test(decl)) {
      F("14 · `planSinCelda` se escribió con la bandera del motor: es un superconjunto y arrastra 19 filas que esta decisión no miró");
    }
    // El aro se apaga con ese predicado.
    if (!/planSinCelda \? null :/.test(POPUP)) {
      F("14 · el aro no se apaga con `planSinCelda`: volvería a pararse sobre la celda de hoy");
    }
    // Y la leyenda cuelga del aro, no del menú.
    const leyenda = POPUP.match(/\{hayAro && \([\s\S]{0,220}?la que estás viendo/)?.[0] ?? "";
    if (!leyenda) {
      F("14 · la cuarta entrada de la leyenda no cuelga de `hayAro`: con el aro apagado nombraría una marca que no está en pantalla");
    }
    // La fila muestra el destino, no el score de la celda. No basta con que la función
    // exista: tiene que ESTAR CABLEADA en la columna de la cifra, o la fila vuelve a escribir
    // el score de la celda —54— al lado del que el plan alcanza —74—.
    if (!/function destinoDe/.test(POPUP)) {
      F("14 · no existe `destinoDe`: la fila sin celda necesita el score como DESTINO, no como score de la celda que señala");
    }
    if (!/sinCelda \? destinoDe\(/.test(POPUP)) {
      F("14 · la columna de la cifra no usa `destinoDe` en la fila sin celda: vuelven los dos scores contradictorios en la misma pantalla");
    }
    if (!/sinCelda \?/.test(POPUP.match(/<span className="paj-opt-sub">[\s\S]{0,400}/)?.[0] ?? "")) {
      F("14 · la línea de coordenadas no se bifurca: la fila sin celda seguiría diciendo «Pie 20% · Plazo 25 años», que es decir «hoy»");
    }
  }
}

// ── 15 · SIN FILA DE TARIFA, SIN NOTA (16-sep-2026) ───────────────────────────
//
// La nota «La tarifa la pone el mercado, no tú» colgaba de `modalidad === "str"`, o sea se
// dibujaba SIEMPRE en renta corta. Medido sobre el parque recomputado: de los 91 pop-ups STR
// con tabla, 31 (34,1%) no tienen fila de tarifa —así que la nota explicaba una fila que no
// está— y en 22 de esos 31 la tabla sí tiene una fila del usuario, con una nota debajo
// hablando del mercado sobre una fila que no habla del mercado.
//
// Es la doctrina «sin celda, sin oración» que la matriz ya aplica en su subtítulo: la segunda
// mitad no se dice cuando no hay celda de hoy. Acá la oración entera cuelga de su fila.
{
  if (POPUP) {
    if (/modalidad === "str" && <p/.test(POPUP)) {
      F("15 · la nota de la tarifa sigue colgando de la modalidad: se dibuja en 31 pop-ups STR donde esa fila no existe");
    }
    if (!/const hayTarifa\s*=/.test(POPUP)) {
      F("15 · no existe `hayTarifa`: nada condiciona la nota a que la fila de tarifa exista");
    }
    const decl = POPUP.match(/const hayTarifa[^;]*;/)?.[0] ?? "";
    if (!/palanca === "adr"/.test(decl)) {
      F("15 · `hayTarifa` no se escribe mirando la fila `adr`: la nota volvería a hablar de lo que no está en la tabla");
    }
    if (!/\{hayTarifa && <p/.test(POPUP)) {
      F("15 · la nota no cuelga de `hayTarifa`");
    }
  }
}

// ── 16 · COMPRAR · LAS DOS SEGUNDAS LÍNEAS DE LA FILA (15-sep-2026) ──────────
//
// En COMPRAR el pop-up era la card palabra por palabra: los dos dibujan el MISMO array y
// escriben `rotuloCorto` + `oracion`. Medido: de las 9 cadenas que escribe con tres filas,
// 6 son literales de la card —83% por caracteres— y el botón que lo abre vive DENTRO de esa
// card, veinte píxeles debajo de la última fila que repite.
//
// Margen y Precio ganan contenido propio: la BANDA en la primera columna y el VEREDICTO AL
// QUE CAE en la segunda. Los dos ya los calculaba el motor y los tiraba.
//
// LA FORMA SALE DE LA TABLA DE ABAJO, que es la misma: `SeccionComprar` ya usa
// `paj-sec paj-nod`, así que la regla `.paj-nod td:first-child em` —la que pone «lo pone el
// vendedor» bajo el nombre— ya le aplica. La banda entra ahí sin CSS nuevo. El destino va
// como `small` bajo la oración, con una regla calcada de las dos que esa tabla ya tiene.
{
  if (POPUP) {
    const sec = POPUP.match(/function SeccionComprar\([^]*?\n(?=(?:\/\/|\/\*\*|function ))/)?.[0] ?? "";
    if (!sec) F("16 · no se encontró `SeccionComprar` para auditar sus filas");
    else {
      if (!/<em>\{[^}]*banda/.test(sec)) {
        F("16 · la fila no dibuja la banda en un `<em>`: sin ella un margen de 0 puntos se lee igual que uno de 48, y son 44 filas del parque");
      }
      if (!/ETIQUETA_BANDA_MARGEN/.test(POPUP)) {
        F("16 · el pop-up no usa `ETIQUETA_BANDA_MARGEN`: la etiqueta de la banda sale del motor, no del render");
      }
      if (!/<small>\{[^}]*caeA/.test(sec) && !/caeA[^]{0,120}<small>/.test(sec)) {
        F("16 · la fila no dibuja a qué veredicto cae: el motor lo guarda y nadie lo leía");
      }
      if (!/etiquetaVeredicto\(/.test(sec)) {
        F("16 · el destino no pasa por `etiquetaVeredicto`: es la fuente única de la escritura del veredicto");
      }
    }
    // La regla del `small` de la oración, calcada de las dos que ya existen.
    if (!/\.paj-nod \.paj-oracion small\{/.test(CSS)) {
      F("16 · falta la regla `.paj-nod .paj-oracion small`: la segunda línea del destino no tendría forma");
    }
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPopupAjustesTier(): { hard: number } {
  console.log("\n─── TIER POPUP-AJUSTES (el render del pop-up · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — lee del motor, la celda dice veredicto y score, «hoy» no se inventa, los siete pares con el retorno en guion, COMPRAR sin matriz, el cuarto estado con su fixture, sin grilla ni palancas no hay botón, el CTA va inerte, el color va por familia, la celda del aro habla del hoy, el panel no la contradice y el color lee la misma fuente que la palabra");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPopupAjustesTier();
  process.exit(hard ? 1 : 0);
}
