// ============================================================================
// GOLDEN · EL MIX DE PALANCAS DEL COMPRADOR — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Las cuatro palancas se prueban DE A UNA. El mix combina las tres que dependen
// del comprador —precio, pie y plazo— y devuelve, para cada combinación de pie ×
// plazo, el descuento mínimo de precio que cruza. El arriendo lo pone el mercado
// y la tasa el banco: quedan fuera por definición, no por costo.
//
// Fija DOCE cosas, y los bordes van sintéticos porque ningún seed del golden
// cubre — por eso van sintéticas (las 9 a 12 tienen su acta en el cuerpo):
//
//   1. LA GRILLA ES LA ACORDADA, EN MODO «CRUZAR». Pie del declarado hasta el techo
//      30, paso 5 y NUNCA hacia abajo (menos pie empeora el mes: no es
//      recomendación). Plazo solo el enum que el wizard acepta —20/25/30— y solo
//      hacia arriba. Precio por bisección con el MISMO tope que la palanca sola: si
//      el mix pudiera pedir un descuento que la palanca sola tiene prohibido, Franco
//      se contradiría dentro del mismo informe.
//      (El modo «mejorar» —la grilla de COMPRAR— tiene otras reglas y las fija el
//      invariante 12, que es donde están sus razones y sus mediciones.)
//
//   2. «SIN DESCUENTO» SE DICE, NO SE REDONDEA. Cuando pie y plazo solos ya
//      cruzan, `descuentoPct` es 0 y `sinDescuento` es true. Devolver el piso de
//      la bisección (−0,1%) invitaría a la prosa a pedir un 0,1% de descuento, que
//      es ridículo; el hecho que hay que poder decir es «no necesitas negociar
//      nada, mueve lo tuyo».
//
//   3. EL CONTRASTE SE CONSERVA. `descuentoSoloPrecioPct` es lo que pediría el
//      precio con pie y plazo como están — null si no cruza. Es donde el mix más
//      vale: los casos en que solo-precio NO cruza y el mix sí.
//
//   4. EL COSTO DEL DÍA UNO VA SIEMPRE CONTRA EL PIE DECLARADO HOY, y el campo
//      declara qué base usó. Es la única base que el usuario reconoce y la única
//      que existe cuando solo-precio no cruza.
//
//   5. BORDE · PLAZO EN EL MÁXIMO ⇒ el mix se reduce a una palanca. Si esa
//      palanca es una que el motor YA reporta sola, `redundanteConPalancaSola` lo
//      declara: un mix que repite una palanca con otro nombre es ruido y el render
//      tiene que poder no dibujarlo.
//
//   6. BORDE · BONO PIE ⇒ el pie no se mueve (la inmobiliaria lo cubre; subirlo
//      desarma el trato). Y BORDE · NADA CRUZA ⇒ null explícito, no un objeto
//      vacío.
//
//   7. EL TOPE DE ALCANCE — 15 puntos del precio, CON SIGNO. El pie 0% (que el tope
//      filtra), el costo NEGATIVO (que tiene que pasar: con el absoluto quedaría
//      afuera por barato) y el borde EXACTO en 15, que entra porque el tope es <=.
//
//   8. «SIN SALIDA» ≠ «SIN PALANCA SOLA». Que un caso gane salida por mix NO mueve
//      `esEstructural`: los 281 que siguen sin salida conservan copy, guards y el
//      invariante del catch-test de vías.
//
// Corre dentro del QUICK (tier "mix") y standalone:
//   node --import tsx scripts/eval/golden/mix-palancas-catch-test.ts
// ============================================================================
import { calcularMixPalancas, MIX_COSTO_TOPE_PTS_PRECIO, MIX_PIE_PASO_PCT, MIX_PLAZOS_WIZARD } from "../../../src/lib/mix-palancas";
import { buildHallazgoDistanciaVeredicto, DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

type Patch = { precio?: number; piePct?: number; plazoCredito?: number };

function mix(o: {
  piePct?: number;
  plazoCredito?: number;
  pieCalifica?: boolean;
  topePct?: number;
  palancasQueCruzan?: ("precio" | "arriendo" | "plazo" | "pie")[];
  regla: (patch: Patch) => Veredicto;
}) {
  return calcularMixPalancas({
    meta: "AJUSTA SUPUESTOS",
    precioUF: 3_000,
    piePct: o.piePct ?? 20,
    plazoCredito: o.plazoCredito ?? 25,
    pieCalifica: o.pieCalifica ?? true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: o.topePct ?? 15,
    palancasQueCruzan: o.palancasQueCruzan ?? [],
    sondaAtPatch: (patch) => ({ veredicto: o.regla(patch), score: null }),
  });
}

/** Hallazgo completo con veredicto dirigido — para los invariantes de `sinSalida`. */
function construirHallazgo(o: { piePct?: number; plazoCredito?: number; regla: (patch: Patch) => Veredicto }) {
  return buildHallazgoDistanciaVeredicto({
    veredictoBase: "BUSCAR OTRA",
    arriendo: 500_000,
    precioUF: 3_000,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    sondaAtPatch: (patch) => ({ veredicto: o.regla(patch), score: null }),
    brazosGate1Activos: [],
    modalidad: "ltr",
  });
}

// ── 1 · la grilla es la acordada ────────────────────────────────────────────
{
  const vistos: Patch[] = [];
  mix({
    piePct: 10,
    plazoCredito: 25,
    regla: (patch) => {
      vistos.push({ ...patch });
      return "BUSCAR OTRA";
    },
  });
  const pies = [...new Set(vistos.map((v) => v.piePct))].filter((x): x is number => x != null).sort((a, b) => a - b);
  const plazos = [...new Set(vistos.map((v) => v.plazoCredito))].filter((x): x is number => x != null).sort((a, b) => a - b);
  if (pies.some((x) => x < 10)) F(`1 · la grilla del pie bajó del declarado (10%): ${pies.join(",")}`);
  if (pies.some((x) => x > DIST_PIE_TOPE_PCT)) F(`1 · la grilla del pie pasó el techo ${DIST_PIE_TOPE_PCT}: ${pies.join(",")}`);
  if (pies.some((x, i) => i > 0 && x - pies[i - 1] !== MIX_PIE_PASO_PCT)) F(`1 · el paso del pie no es ${MIX_PIE_PASO_PCT}: ${pies.join(",")}`);
  if (plazos.some((x) => x < 25)) F(`1 · la grilla del plazo bajó del declarado (25a): ${plazos.join(",")}`);
  if (plazos.some((x) => !MIX_PLAZOS_WIZARD.includes(x as never))) F(`1 · plazo fuera del enum del wizard: ${plazos.join(",")}`);
  const fuera = vistos.filter((v) => v.precio != null && v.precio < 3_000 * (1 - 15 / 100) - 0.01);
  if (fuera.length) F(`1 · la bisección de precio pasó el tope 15% (${fuera.length} sondas)`);
}

// ── 2 · «sin descuento» se dice, no se redondea ─────────────────────────────
{
  // Con 30 años cruza sin tocar el precio. La bisección tocaría fondo en el paso.
  const r = mix({
    plazoCredito: 25,
    regla: (patch) => (patch.plazoCredito === 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!r) F("2 · con 30 años cruza: el mix no puede ser null");
  else {
    if (r.descuentoPct !== 0) F(`2 · pie y plazo solos ya cruzan: descuentoPct debe ser 0, dio ${r.descuentoPct}`);
    if (!r.sinDescuento) F("2 · `sinDescuento` debe ser true cuando el precio no se toca");
  }
}

// ── 3 · el contraste con solo-precio se conserva ────────────────────────────
{
  // El precio solo cruza en −10%; con 30 años cruza sin descuento.
  const regla = (patch: Patch): Veredicto => {
    const plazo = patch.plazoCredito ?? 25;
    const desc = patch.precio != null ? (1 - patch.precio / 3_000) * 100 : 0;
    if (plazo >= 30) return "AJUSTA SUPUESTOS";
    return desc >= 10 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  };
  const r = mix({ regla });
  if (!r) F("3 · el mix no puede ser null");
  else {
    if (r.descuentoSoloPrecioPct == null) F("3 · el precio solo cruza en −10%: `descuentoSoloPrecioPct` no puede ser null");
    else if (Math.abs(r.descuentoSoloPrecioPct - 10) > 0.6) F(`3 · solo-precio debía rondar 10%, dio ${r.descuentoSoloPrecioPct}`);
    if (!r.sinDescuento) F("3 · el mejor mix cruza sin descuento (30 años): sinDescuento debía ser true");
  }
  // Y el caso que más importa: solo-precio NO cruza y el mix sí.
  const r2 = mix({ regla: (patch) => ((patch.plazoCredito ?? 25) >= 30 && (patch.piePct ?? 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  if (!r2) F("3 · con pie 25 y 30 años cruza: no puede ser null");
  else if (r2.descuentoSoloPrecioPct !== null) F(`3 · solo-precio no cruza acá: debía ser null, dio ${r2.descuentoSoloPrecioPct}`);
}

// ── 4 · el costo del día uno, contra el pie declarado ───────────────────────
{
  const r = mix({
    piePct: 20,
    regla: (patch) => ((patch.piePct ?? 20) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!r) F("4 · con pie 30 cruza: no puede ser null");
  else {
    if (r.costoDiaUnoBase !== "pie_declarado") F(`4 · la base del costo debe declararse como "pie_declarado", dio «${r.costoDiaUnoBase}»`);
    // pie 30% de UF 3.000 = 900 · pie declarado 20% de UF 3.000 = 600 ⇒ +300
    if (Math.abs(r.costoDiaUnoUF - 300) > 1) F(`4 · costo del día uno debía ser ~UF 300 (900 − 600), dio ${r.costoDiaUnoUF}`);
    if (r.piePctDelta !== 10) F(`4 · el movimiento del pie debía ser +10 pts, dio ${r.piePctDelta}`);
  }
}

// ── 5 · BORDE · plazo en el máximo ⇒ una palanca, y puede ser redundante ────
{
  const r = mix({
    piePct: 8,
    plazoCredito: 30,
    palancasQueCruzan: ["pie"],
    regla: (patch) => ((patch.piePct ?? 8) >= 13 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!r) F("5 · el pie cruza en 13%: el mix no puede ser null");
  else {
    if (r.plazoAniosDelta !== 0) F(`5 · el plazo ya está en el máximo: no puede moverse, dio ${r.plazoAniosDelta}`);
    if (r.combinacionesProbadas !== Math.floor((DIST_PIE_TOPE_PCT - 8) / MIX_PIE_PASO_PCT) + 1) {
      F(`5 · con el plazo en el techo la grilla es de una sola columna, dio ${r.combinacionesProbadas} combinaciones`);
    }
    if (!r.redundanteConPalancaSola) {
      F("5 · el mix se redujo a la palanca de pie que el motor YA reporta sola: `redundanteConPalancaSola` debe ser true");
    }
  }
}

// ── 6 · BORDE · bono pie, y BORDE · nada cruza ──────────────────────────────
{
  // (a) Bono pie: el pie no califica, así que no se mueve ni una vez.
  const vistos: number[] = [];
  const r = mix({
    piePct: 0,
    pieCalifica: false,
    regla: (patch) => {
      if (patch.piePct != null) vistos.push(patch.piePct);
      return (patch.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    },
  });
  if (vistos.some((x) => x !== 0)) F(`6a · bono pie: el pie no se puede mover, se probó ${[...new Set(vistos)].join(",")}`);
  if (r && r.piePctDelta !== 0) F(`6a · bono pie: piePctDelta debe ser 0, dio ${r.piePctDelta}`);
  // (b) Nada cruza en ninguna combinación ⇒ null explícito.
  const nada = mix({ regla: () => "BUSCAR OTRA" });
  if (nada !== null) F(`6b · ninguna combinación cruza: debía ser null explícito, dio ${JSON.stringify(nada)}`);
  // (c) La segunda mejor existe cuando hay más de una.
  const dos = mix({ regla: (patch) => ((patch.piePct ?? 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  if (dos && dos.combinacionesQueCruzan > 1 && dos.segunda === null) {
    F(`6c · cruzan ${dos.combinacionesQueCruzan} combinaciones y «segunda» quedó null`);
  }
}

// ── 7 · EL TOPE DE ALCANCE DE LA EQUILIBRADA: 15 puntos del precio, CON SIGNO ──
//
// TODO ESTE BLOQUE MIDE UN SOLO TOPE, Y DESDE EL MENÚ DE RESPUESTAS HAY DOS (16-sep-2026).
// Acá se mide `dentroDelAlcance` de la RAÍZ, que contesta siempre por la equilibrada y por
// sus 15 puntos. La respuesta de flujo corre con 25 y no toca nada de lo de acá: su borde
// tiene su propio gemelo en `grilla-popup-catch-test.ts` (invariante 13). Los mensajes
// nombran el tope que miden para que nadie lea un rojo de acá como un rojo del otro.
{
  // (a) pie 0% → el mix pide poner los 30 puntos completos: 30 pts > 15 ⇒ fuera de
  //     alcance. Es la población que el tope existe para separar (medido: los más caros
  //     del parque son casi todos `pie 0% → 30%`).
  const r = mix({
    piePct: 0,
    regla: (patch) => ((patch.piePct ?? 0) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!r) F("7a · la combinación cruza: el mix no puede ser null");
  else {
    if (Math.abs(r.costoPtsPrecio - 30) > 0.6) F(`7a · pie 0→30 cuesta 30 pts del precio, dio ${r.costoPtsPrecio}`);
    if (r.dentroDelAlcance) F(`7a · 30 pts > ${MIX_COSTO_TOPE_PTS_PRECIO} (el tope de la EQUILIBRADA): debía quedar FUERA de alcance`);
  }

  // (b) COSTO NEGATIVO: el descuento achica el pie en plata más de lo que lo agranda el
  //     porcentaje. Un tope sobre el ABSOLUTO lo sacaría por barato — el tope va con signo.
  const barato = mix({
    piePct: 25,
    // Cruza con 12% de descuento manteniendo el pie: 3.000×0,88×25% = 660 vs 750 ⇒ −UF 90.
    regla: (patch) => {
      const desc = patch.precio != null ? (1 - patch.precio / 3_000) * 100 : 0;
      return desc >= 12 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    },
  });
  if (!barato) F("7b · cruza con −12%: no puede ser null");
  else {
    if (barato.costoDiaUnoUF >= 0) F(`7b · este mix ABARATA el día uno: el costo debía ser negativo, dio ${barato.costoDiaUnoUF}`);
    if (!barato.dentroDelAlcance) F("7b · un costo negativo está dentro del tope de la equilibrada: con el valor absoluto quedaría afuera por barato");
    // La regla del signo es doctrina COMPARTIDA: el tope de la respuesta de flujo la hereda
    // entera. Una celda que ABARATA el día uno no puede quedar afuera de ningún tope.
    if (barato.respuestas?.some((x) => x.costoDiaUnoUF < 0 && !x.dentroDeSuTope)) {
      F("7b · una respuesta con costo NEGATIVO se declara fuera de SU tope: la regla del signo vale para los dos topes");
    }
  }

  // (c) EL BORDE EXACTO. pie 20 → 35 no existe (techo 30), así que se fabrica el borde con
  //     un precio tal que el salto de pie valga exactamente 15 puntos: 20% → 35% no; usar
  //     pie 15 → 30 = 15 puntos justos. `<=` incluye el borde.
  const borde = mix({
    piePct: 15,
    regla: (patch) => ((patch.piePct ?? 15) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!borde) F("7c · cruza con pie 30: no puede ser null");
  else {
    if (Math.abs(borde.costoPtsPrecio - 15) > 0.6) F(`7c · pie 15→30 son 15 puntos justos, dio ${borde.costoPtsPrecio}`);
    if (!borde.dentroDelAlcance) F(`7c · el borde EXACTO del tope de la EQUILIBRADA (${MIX_COSTO_TOPE_PTS_PRECIO} pts) entra: el tope es <=, no <`);
  }

  // (d) Cuando NINGUNA combinación entra en el tope, el mix igual se devuelve —con
  //     `dentroDelAlcance: false`— para poder decir cuánto costaría. Es el mismo criterio
  //     que `deltaMinimoFueraDeTope`: el número existe aunque la puerta esté cerrada.
  const fuera = mix({
    piePct: 0,
    regla: (patch) => ((patch.piePct ?? 0) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!fuera) F("7d · la combinación cruza: no puede ser null aunque esté fuera de alcance");
  else if (fuera.dentroDelAlcance) {
    F(`7d · pie 0→25 son 25 pts > ${MIX_COSTO_TOPE_PTS_PRECIO} (el tope de la EQUILIBRADA): fuera de alcance`);
  }
  // ⚠ ESTA SEED CUESTA EXACTAMENTE 25 PUNTOS, que es el tope de la respuesta de FLUJO
  // (16-sep-2026). No es coincidencia aprovechable: es la trampa de este bloque. La misma
  // celda está FUERA del alcance de la equilibrada y DENTRO del de flujo, y las dos cosas
  // son ciertas. Lo que se fija acá es que el campo de la raíz NO se contagie del tope
  // nuevo — si algún día `dentroDelAlcance` empieza a mirar la unión de los dos topes,
  // este invariante se pone rojo y hace bien, porque con él se moverían de rama las ocho
  // superficies de copy que cuelgan de `sinSalida`.
  if (fuera) {
    const flujo = fuera.respuestas?.find((x) => x.criterio === "flujo") ?? null;
    if (flujo && !flujo.dentroDeSuTope) F("7d · la respuesta de flujo declara FUERA de su tope una celda de 25 pts: su tope es 25 y es <=");
    if (flujo && flujo.topePtsPrecio !== 25) F(`7d · la respuesta de flujo declara tope ${flujo.topePtsPrecio}; tiene que declarar el suyo, no heredar el de la raíz`);
  }
}

// ── 8 · «SIN SALIDA» — el concepto nuevo, sin tocar «sin palanca sola» ─────
{
  // El caso donde NADA cruza: sigue siendo estructural Y sin salida. Es la prueba de que
  // los que hoy no tienen mix no se movieron.
  const nada = construirHallazgo({ regla: () => "BUSCAR OTRA" });
  if (nada) {
    if (!nada.valor.esEstructural) F("8 · sin ninguna palanca que cruce debía seguir siendo estructural");
    if (nada.valor.sinSalida !== true) F("8 · sin palanca sola y sin mix ⇒ `sinSalida` debe ser true");
    if (nada.valor.mixPalancas !== null) F("8 · sin ninguna combinación que cruce el mix debe ser null");
  }
  // El caso que cambia: ninguna palanca sola cruza, pero el mix sí y es pagable.
  const conSalida = construirHallazgo({
    piePct: 20,
    regla: (patch) => {
      const pie = patch.piePct ?? 20;
      const plazo = patch.plazoCredito ?? 25;
      // Ninguna palanca SOLA alcanza; la combinación pie 30 + 30 años sí.
      return pie >= 30 && plazo >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    },
  });
  if (conSalida) {
    if (!conSalida.valor.esEstructural) F("8 · «sin palanca sola» NO cambia: ninguna cruza sola, sigue estructural");
    if (conSalida.valor.sinSalida !== false) F("8 · el mix cruza dentro del tope ⇒ `sinSalida` debe ser false");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
// ── 9 · EL DESTINO SE DECLARA, no se deduce ────────────────────────────────
{
  // El mix apunta a `meta`, y `meta` es el veredicto inmediatamente superior al base:
  // partiendo de BUSCAR OTRA es AJUSTA SUPUESTOS, NO COMPRAR. Que el campo exista es
  // el punto: el bloque «Lo que haría yo» mide sus filas contra COMPRAR, así que un
  // consumidor que dedujera el destino del mix por su cuenta publicaría dos descuentos
  // del mismo precio sin decir a dónde va cada uno. Ya pasó.
  const aAjustar = mix({ regla: (x) => ((x.piePct ?? 20) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  if (!aAjustar) F("9 · el mix hacia AJUSTA no se construyó");
  else if (aAjustar.destino !== "AJUSTA SUPUESTOS") F(`9 · el mix declara su destino y es AJUSTA SUPUESTOS, dio «${aAjustar.destino}»`);

  // Y el mismo mix con meta COMPRAR lo declara COMPRAR: el campo sigue a `meta`, no al
  // veredicto base ni a una constante.
  const aComprar = calcularMixPalancas({
    meta: "COMPRAR",
    precioUF: 3_000,
    piePct: 20,
    plazoCredito: 25,
    pieCalifica: true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: 30,
    palancasQueCruzan: [],
    sondaAtPatch: (x: Patch) => ({ veredicto: ((x.piePct ?? 20) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS") as Veredicto, score: null }),
  });
  if (!aComprar) F("9 · el mix hacia COMPRAR no se construyó");
  else if (aComprar.destino !== "COMPRAR") F(`9 · con meta COMPRAR el destino es COMPRAR, dio «${aComprar.destino}»`);

  // Y el hallazgo lo persiste: si se pierde en el camino, el render vuelve a adivinar.
  const h = construirHallazgo({ regla: (x) => ((x.piePct ?? 20) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  const m = h?.valor.mixPalancas;
  if (m && m.destino !== h?.valor.veredictoObjetivo) {
    F(`9 · el destino del mix persistido tiene que ser el veredicto objetivo, dio «${m.destino}» contra «${h?.valor.veredictoObjetivo}»`);
  }
}

// ── 10 · EL DESCUENTO QUE SE PUBLICA TIENE QUE CRUZAR ──────────────────────
//
// La bisección garantiza que `hi` cruza, pero después el valor se redondea a un decimal.
// Con `Math.round` ese redondeo puede caer HACIA ABAJO hasta 0,05 puntos y dejar el número
// publicado por debajo del umbral: la celda queda marcada «llega a Comprar» y, recomputada
// en el descuento que ella misma publica, dice otra cosa. Medido sobre el parque el
// 13-sep-2026: 388 de 1.806 celdas alcanzables (21,5%) publicaban un descuento que no cruza.
//
// El umbral 7,72 no es decorativo: es un punto donde la bisección de paso 0,1 termina en
// hi = 7,734375, que redondea a 7,7 y NO alcanza, y que con `ceil` publica 7,8 y sí.
{
  const UMBRAL = 7.72;
  const r = mix({
    piePct: 30, // pie en el techo ⇒ una sola fila, la grilla no distrae
    plazoCredito: 30, // plazo en el máximo ⇒ una sola columna
    regla: (patch) => {
      const d = patch.precio != null ? 100 * (1 - patch.precio / 3_000) : 0;
      return d >= UMBRAL ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    },
  });
  if (!r) F("10 · el mix no cruzó donde debía: el caso del umbral fino no se está ejerciendo");
  else {
    for (const c of r.celdas ?? []) {
      if (c.descuentoPct === null) continue;
      if (c.descuentoPct < UMBRAL) {
        F(`10 · la celda pie ${c.piePct}% · ${c.plazoAnios}a publica −${c.descuentoPct}%, que NO alcanza el umbral ${UMBRAL}: el número publicado no hace lo que dice`);
      }
    }
    if (r.descuentoPct < UMBRAL) {
      F(`10 · el mix publica −${r.descuentoPct}% y el umbral es ${UMBRAL}: el descuento coronado no cruza`);
    }
  }
}

// ── 11 · LAS MÉTRICAS VIAJAN POR CELDA, NO SOLO EN LA CORONADA ─────────────
//
// El motor sondea cada celda que cruza y la sonda devuelve cuota, flujo, retorno, cap rate
// y TIR en la misma pasada. Hasta hoy todas esas cifras se tiraban salvo las de la celda
// coronada (`despues`), así que nadie podía comparar dos celdas por otra cosa que el score.
// Cero sondas nuevas: el dato ya está en la mano cuando la celda se arma.
{
  const METRICAS = { cuotaMensual: 111_111, flujoMensual: -22_222, cocPct: -1.5, capRateNetoPct: 4.4, tirPct: 9.9 };
  const r = calcularMixPalancas({
    meta: "AJUSTA SUPUESTOS",
    precioUF: 3_000,
    piePct: 20,
    plazoCredito: 25,
    pieCalifica: true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: 15,
    palancasQueCruzan: [],
    sondaAtPatch: (patch) => {
      const d = patch.precio != null ? 100 * (1 - patch.precio / 3_000) : 0;
      return { veredicto: d >= 5 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA", score: 70, metricas: METRICAS };
    },
  });
  if (!r) F("11 · el mix no cruzó: el caso de métricas no se está ejerciendo");
  else {
    const cruzan = (r.celdas ?? []).filter((c) => c.descuentoPct !== null);
    if (!cruzan.length) F("11 · ninguna celda cruza en el caso de métricas");
    for (const c of cruzan) {
      const m = (c as unknown as { metricas?: unknown }).metricas;
      if (m == null) {
        F(`11 · la celda pie ${c.piePct}% · ${c.plazoAnios}a cruza pero no lleva métricas: sin ellas no se puede comparar dos celdas por flujo ni por TIR`);
        break;
      }
      const mm = m as typeof METRICAS;
      if (mm.tirPct !== METRICAS.tirPct || mm.flujoMensual !== METRICAS.flujoMensual) {
        F(`11 · la celda pie ${c.piePct}% · ${c.plazoAnios}a lleva métricas que no son las de su sonda`);
        break;
      }
    }
    // Y las que NO cruzan no inventan métricas: su lectura es la de precio de hoy.
    for (const c of (r.celdas ?? []).filter((x) => x.descuentoPct === null)) {
      const m = (c as unknown as { metricas?: unknown }).metricas;
      if (m === undefined) F(`11 · la celda pie ${c.piePct}% que no cruza no declara el campo de métricas (debe existir, aunque sea null)`);
    }
  }
}

// ── 12 · EL MODO «MEJORAR» — la grilla de COMPRAR (15-sep-2026) ─────────────
//
// En COMPRAR no hay umbral que cruzar, así que «cuánto descuento pedir» no tiene respuesta
// honesta: cualquier descuento mejora y el máximo sería «todo el que consigas». La grilla
// deja de contestar «qué necesito para cruzar» y pasa a contestar «cómo queda cada opción».
//
// TRES COSAS CAMBIAN, y van juntas porque son la misma decisión:
//
//  1. NO HAY DESCUENTO. No hay que apagarlo: con la meta ya alcanzada, `explorarCelda` corta
//     en su primera línea y toda la grilla sale en 0. Se fija igual, porque el día que
//     alguien cambie esa salida temprana la grilla empezaría a pedir descuentos sin umbral.
//
//  2. EL PIE BAJA UN ESCALÓN. La doctrina de «solo hacia arriba» existe porque para AJUSTAR
//     menos pie empeora el mes y sería una recomendación al revés. En COMPRAR la pregunta es
//     otra: menos pie es menos capital inmovilizado. Medido sobre las 160 filas COMPRAR del
//     parque: un escalón mejora la TIR en 142 (88,8%) con p50 +2,5 puntos, contra p50 +11 y
//     máx +120,7 si se explora hasta el piso —ahí la mejor TIR cae en pie 5% el 81,1% de las
//     veces y la grilla sería una máquina de apalancamiento—. Un escalón lo acota.
//     Y el plazo deja de filtrarse a los ≥ declarado: acortarlo también es una opción real
//     cuando no hay nada que cruzar, y es la grilla que se midió.
//
//  3. NO HAY TOPE DE ALCANCE. Los 15 puntos significaban «cuánto capital extra sigue siendo
//     una salida», y acá no hay salida. Medido: muerde en 14 de 160 filas (8,8%) —las del
//     pie declarado bajo 15— y en LAS 14 cambia la corona del flujo, en 8 la del score y en
//     NINGUNA la de la TIR, porque el tope solo recortaba por arriba y la TIR mira al revés.
{
  // Base que YA alcanza la meta: es una fila COMPRAR mirándose a sí misma.
  const vistos: Patch[] = [];
  const m = calcularMixPalancas({
    meta: "COMPRAR",
    modo: "mejorar",
    precioUF: 3_000,
    piePct: 20,
    plazoCredito: 25,
    pieCalifica: true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: 15,
    palancasQueCruzan: [],
    sondaAtPatch: (patch) => { vistos.push(patch); return { veredicto: "COMPRAR", score: 80 }; },
  });
  if (!m || !m.celdas) F("12 · el modo «mejorar» no devolvió grilla con la meta ya alcanzada");
  else {
    // 1 · ninguna celda pide descuento.
    const conDescuento = m.celdas.filter((c) => (c.descuentoPct ?? 0) !== 0);
    if (conDescuento.length) F(`12 · ${conDescuento.length} celdas piden descuento en COMPRAR: sin umbral no hay descuento que justificar`);
    if (m.celdas.some((c) => c.descuentoPct === null)) F("12 · hay celdas sin descuento calculado: con la meta alcanzada todas cruzan en 0");
    // 2 · el pie baja UN escalón y no más.
    const pies = [...new Set(m.celdas.map((c) => c.piePct))].sort((a, b) => a - b);
    if (pies[0] !== 15) F(`12 · el pie más bajo de la grilla es ${pies[0]} y tiene que ser 15 (un escalón bajo el declarado)`);
    if (pies.includes(10)) F("12 · la grilla bajó DOS escalones: se midió con uno, y hasta el piso la TIR se vuelve apalancamiento");
    if (pies[pies.length - 1] !== DIST_PIE_TOPE_PCT) F(`12 · el pie más alto es ${pies[pies.length - 1]} y el techo sigue siendo ${DIST_PIE_TOPE_PCT}`);
    // 2b · el plazo deja de filtrarse a los ≥ declarado.
    const plazos = [...new Set(m.celdas.map((c) => c.plazoAnios))].sort((a, b) => a - b);
    if (!plazos.includes(20)) F("12 · la grilla no ofrece el plazo corto: en COMPRAR acortar también es una opción");
    // 3 · el tope de alcance no filtra: la elegida puede costar más de 15 puntos.
    if (!m.dentroDelAlcance) F("12 · `dentroDelAlcance` es false en COMPRAR: sin salida que buscar, el tope no aplica");
  }

  // ⚠ LA CELDA QUE CAE, QUE ES POR DONDE SE ESCAPABA. El fixture de arriba devuelve COMPRAR
  // siempre, así que nunca ejercita el caso que importa: con el pie un escalón abajo la celda
  // puede NO alcanzar a precio de hoy, y ahí `explorarCelda` se iba a la bisección y volvía
  // con un descuento. Medido antes del arreglo: 48 filas del parque tenían celdas pidiendo
  // plata al vendedor dentro de la grilla de COMPRAR, y esas celdas mostraban «Comprar» —su
  // lectura en el descuento— en vez de decir que te sacan del veredicto.
  // Un fixture que no modela la celda que cae no falla: miente.
  {
    const sondas: Patch[] = [];
    const conCaida = calcularMixPalancas({
      meta: "COMPRAR", modo: "mejorar", precioUF: 3_000, piePct: 20, plazoCredito: 25,
      pieCalifica: true, pieTopePct: DIST_PIE_TOPE_PCT, topePct: 15, palancasQueCruzan: [],
      sondaAtPatch: (patch) => {
        sondas.push({ ...patch });
        // Con el pie bajo el declarado se cae a AJUSTA, pase lo que pase con el precio.
        return { veredicto: (patch.piePct ?? 20) < 20 ? "AJUSTA SUPUESTOS" : "COMPRAR", score: 70 };
      },
    });
    if (!conCaida || !conCaida.celdas) F("12 · con una celda que cae el modo «mejorar» no devolvió grilla");
    else {
      const caidas = conCaida.celdas.filter((c) => c.veredicto !== "COMPRAR");
      if (!caidas.length) F("12 · el fixture tenía que producir celdas que caen y no produjo ninguna");
      if (caidas.some((c) => (c.descuentoPct ?? 0) !== 0)) {
        F("12 · la celda que cae pidió descuento: en COMPRAR toda la grilla se lee a precio de hoy");
      }
      if (caidas.some((c) => c.veredicto === "COMPRAR")) {
        F("12 · la celda que cae dice «Comprar»: está mostrando su lectura con descuento en vez del hecho");
      }
    }
    // ⛔ Y NINGUNA RESPUESTA PUEDE CORONAR UNA CELDA QUE PERDIÓ EL VEREDICTO (17-sep-2026).
    //
    // En «mejorar» `explorarCelda` corta en su primera línea y devuelve `pct: 0` para TODAS,
    // así que todas entran a `combos` — incluidas las que a precio de hoy ya no sostienen la
    // meta. De ahí salen las tres coronas, y `elegirCelda(…, "tir")` coronaba la de pie más
    // bajo sin preguntar qué veredicto tiene.
    //
    // Medido sobre el parque: 8 de 138 filas COMPRAR con menú (5,8%) ofrecían, bajo el título
    // «La que más rinde» y una bajada que dice «Las dos siguen en Comprar», una celda que la
    // leyenda de la misma matriz marca «baja a Ajustar». Siempre el criterio TIR, siempre el
    // pie bajado un escalón — que es la puerta que el modo «mejorar» abrió.
    //
    // La celda SIGUE DIBUJÁNDOSE: bajar el pie te saca de Comprar y eso es información real,
    // y el gris de la leyenda existe para decirlo. Lo que no puede es ser una RESPUESTA: el
    // menú lista lo que Franco ofrece, y no se ofrece salir del veredicto que ya tienes.
    // Son dos preguntas con dos superficies — el color dice qué pasa, el menú dice qué hacer—,
    // la misma separación que ya gobierna el azul huérfano.
    if (conCaida?.respuestas?.length) {
      const caidas = new Set(
        (conCaida.celdas ?? [])
          .filter((c) => (c.esActual ? c.veredictoSinDescuento : c.veredicto) !== "COMPRAR")
          .map((c) => `${c.piePct}|${c.plazoAnios}|${c.descuentoPct}`),
      );
      for (const r of conCaida.respuestas) {
        if (caidas.has(`${r.piePct}|${r.plazoAnios}|${r.descuentoPct}`)) {
          F(`12 · la respuesta «${r.criterio}» corona pie ${r.piePct}% / ${r.plazoAnios}a, una celda que NO sostiene el veredicto: el menú estaría ofreciendo salir de Comprar bajo «las dos siguen en Comprar»`);
        }
      }
    }
    // Y la corona por score tampoco: es la raíz, o sea lo que el resto del informe lee.
    if (conCaida) {
      const raiz = (conCaida.celdas ?? []).find((c) => c.piePct === conCaida.piePct && c.plazoAnios === conCaida.plazoAnios);
      if (raiz && (raiz.esActual ? raiz.veredictoSinDescuento : raiz.veredicto) !== "COMPRAR") {
        F("12 · la raíz del mix cayó sobre una celda que perdió el veredicto: los veinte consumidores que leen la raíz publicarían una recomendación que saca del veredicto");
      }
    }
    // Y no se gastan sondas de bisección: una por celda, ni una más.
    const celdas = conCaida?.celdas?.length ?? 0;
    if (celdas > 0 && sondas.length > celdas) {
      F(`12 · el modo «mejorar» sondeó ${sondas.length} veces para ${celdas} celdas: no puede biseccionar`);
    }
  }

  // EL TOPE, MEDIDO EN SU BORDE. Con el pie declarado en 5 la grilla llega a 30, o sea 25
  // puntos de precio sobre el declarado: en modo «cruzar» esa celda queda fuera de la
  // elección y en «mejorar» tiene que poder coronar.
  const alto = (modo: "cruzar" | "mejorar") =>
    calcularMixPalancas({
      meta: "COMPRAR", modo, precioUF: 3_000, piePct: 5, plazoCredito: 30,
      pieCalifica: true, pieTopePct: DIST_PIE_TOPE_PCT, topePct: 15, palancasQueCruzan: [],
      // El score sube con el pie: la mejor es siempre la de pie más alto.
      sondaAtPatch: (patch) => ({ veredicto: "COMPRAR", score: 60 + (patch.piePct ?? 5) }),
    });
  const cruzar = alto("cruzar");
  const mejorar = alto("mejorar");
  if (cruzar && cruzar.piePct > 20) F(`12 · en modo «cruzar» el tope tiene que seguir filtrando y coronó pie ${cruzar.piePct}`);
  if (mejorar && mejorar.piePct !== DIST_PIE_TOPE_PCT) F(`12 · en modo «mejorar» la corona tiene que poder ser la de pie ${DIST_PIE_TOPE_PCT}, dio ${mejorar?.piePct}`);
}

export function runMixPalancasTier(): { hard: number } {
  console.log("\n─── TIER MIX (las tres palancas del comprador combinadas · mix-palancas.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — grilla acordada, «sin descuento» explícito, contraste con solo-precio, costo contra el pie declarado, el tope de 15 pts con signo, «sin salida» sin mover «sin palanca sola», el descuento publicado CRUZA y las métricas viajan por celda");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMixPalancasTier();
  process.exit(hard ? 1 : 0);
}
