// ============================================================================
// GOLDEN · EL MIX DE PALANCAS DEL COMPRADOR — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Las cuatro palancas se prueban DE A UNA. El mix combina las tres que dependen
// del comprador —precio, pie y plazo— y devuelve, para cada combinación de pie ×
// plazo, el descuento mínimo de precio que cruza. El arriendo lo pone el mercado
// y la tasa el banco: quedan fuera por definición, no por costo.
//
// Fija OCHO cosas, y los bordes van sintéticos porque ningún seed del golden
// cubre — por eso van sintéticas:
//
//   1. LA GRILLA ES LA ACORDADA. Pie del declarado hasta el techo 30, paso 5 y
//      NUNCA hacia abajo (menos pie empeora el mes: no es recomendación).
//      Plazo solo el enum que el wizard acepta —20/25/30— y solo hacia arriba.
//      Precio por bisección con el MISMO tope que la palanca sola: si el mix
//      pudiera pedir un descuento que la palanca sola tiene prohibido, Franco se
//      contradiría dentro del mismo informe.
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
    veredictoAtPatch: o.regla,
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
    veredictoAtPatch: o.regla,
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

// ── 7 · EL TOPE DE ALCANCE: 15 puntos del precio, CON SIGNO ────────────────
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
    if (r.dentroDelAlcance) F(`7a · 30 pts > ${MIX_COSTO_TOPE_PTS_PRECIO}: debía quedar FUERA de alcance`);
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
    if (!barato.dentroDelAlcance) F("7b · un costo negativo está dentro del tope: con el valor absoluto quedaría afuera por barato");
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
    if (!borde.dentroDelAlcance) F(`7c · el borde EXACTO (${MIX_COSTO_TOPE_PTS_PRECIO} pts) entra: el tope es <=, no <`);
  }

  // (d) Cuando NINGUNA combinación entra en el tope, el mix igual se devuelve —con
  //     `dentroDelAlcance: false`— para poder decir cuánto costaría. Es el mismo criterio
  //     que `deltaMinimoFueraDeTope`: el número existe aunque la puerta esté cerrada.
  const fuera = mix({
    piePct: 0,
    regla: (patch) => ((patch.piePct ?? 0) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
  });
  if (!fuera) F("7d · la combinación cruza: no puede ser null aunque esté fuera de alcance");
  else if (fuera.dentroDelAlcance) F(`7d · pie 0→25 son 25 pts > ${MIX_COSTO_TOPE_PTS_PRECIO}: fuera de alcance`);
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
export function runMixPalancasTier(): { hard: number } {
  console.log("\n─── TIER MIX (las tres palancas del comprador combinadas · mix-palancas.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — grilla acordada, «sin descuento» explícito, contraste con solo-precio, costo contra el pie declarado, el tope de 15 pts con signo, y «sin salida» sin mover «sin palanca sola»");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMixPalancasTier();
  process.exit(hard ? 1 : 0);
}
