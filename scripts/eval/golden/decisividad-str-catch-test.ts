// ============================================================================
// GOLDEN · DECISIVIDAD REAL STR — catch-test (03-sep-2026). 0 tokens, read-only.
// ============================================================================
// REESCRITO EL 17-sep-2026: fijaba cifras de filas vivas, ahora fija la regla.
//
// LO QUE HABÍA. Una tabla `CASOS` con cuatro pins escritos a mano POR FILA del parque: el
// `veredicto` recomputado, cuál hallazgo es el `primero` de la pirámide, la lista de
// `pisos` que llegan a 0,85 y un `gateDesarmadoSinDelta`. El motor los movió por decisión
// de producto y el tier quedó rojo con dos fallas —`ventaja_vs_ltr` da 0,56 donde se
// esperaba el piso, y `estructura_financiamiento` da 0,85/0,08 donde se esperaba 0,85/0—
// sin que nada estuviera roto. En rojo se quedó, porque tampoco estaba cableado al runner.
// (CLAUDE.md § Testing: «un catch-test fija la REGLA, no la cifra».)
//
// LO QUE QUEDA, que es más de lo que había y vale para CUALQUIER fila:
//   · los siete con knob viven en [0,1] y magnitud ≤ decisividad;
//   · decisividad es EXACTAMENTE la magnitud, o EXACTAMENTE el piso — nunca un valor
//     intermedio. Es la forma de `decisividadDesdeStr` (decisividades-str.ts:89),
//     `flip || gateDesarmado ? Math.max(FLOOR, magnitud) : magnitud`, y los siete factores
//     pasan por ese mismo helper. El predicado viejo solo miraba el caso decisividad ≥
//     piso, así que un 0,50 con magnitud 0,30 —imposible por construcción— pasaba;
//   · los seis informativos (INFORMATIVOS_STR) declaran 0;
//   · LA PIRÁMIDE Y EL MÓDULO DAN EL MISMO NÚMERO. Este es el invariante que protege al
//     informe: si se separan, la card y el orden dicen cosas distintas del mismo hallazgo;
//   · el ORDEN, como propiedad de lo que sale y no como una lista esperada — ver el bloque 3;
//   · CapEx neutro: antigüedad 0 sin override ⇒ 0 CLP (el knob del capex), y ni calibrado
//     sin CapEx ni duplicado tras el merge.
//
// LO QUE YA NO CUBRE, dicho para que el próximo que lo lea no le suponga alcance de más:
// no verifica CUÁL hallazgo llega al piso en una fila dada (eso depende de qué gate
// desarma cada supuesto, y modelarlo acá sería reimplementar el módulo dentro de su propio
// test), ni el veredicto recomputado — eso lo fija el tier STR del golden sobre sus seeds.
//
// Las tres filas siguen siendo una MUESTRA (una por veredicto), no un contrato: se leen
// para ejercitar el módulo sobre datos reales, no para congelar sus salidas. La mediana
// comunal es viva en las tres, así que sobreprecio puede estar ausente y eso no es falla.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/decisividad-str-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { calcDecisividadesSTR, INFORMATIVOS_STR, type DecisividadesSTR } from "../../../src/lib/decisividades-str";
import { ordenarHallazgosPiramideSTR } from "../../../src/lib/piramide-orden-str";
import { DECISIVIDAD_FLOOR_ORDEN } from "../../../src/lib/orden-hallazgos";
import type { Hallazgo } from "../../../src/lib/types";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { calcCapexPuestaAPunto } from "../../../src/lib/capex-puesta-a-punto";
import { DECISIVIDAD_FLOOR } from "../../../src/lib/analysis";

// MUESTRA, no contrato: una fila por veredicto para correr el módulo sobre datos reales.
// Solo el id — el veredicto, el 01 y los pisos de cada una eran los cuatro pins que este
// archivo dejó de fijar. Si alguna se borra del parque, se cambia por otra del mismo
// veredicto y no hay nada más que actualizar: eso es la señal de que ya no hay cifras acá.
const CASOS: { id: string }[] = [
  { id: "bc61f612-f1d0-44c9-af0c-a689ca4ab7fd" },
  { id: "29bbcd75-96a8-4f9f-bef1-5e0a179b4d83" },
  { id: "9102b7e6-3bae-4174-971f-afb8bd99547c" },
];
const CON_KNOB: (keyof DecisividadesSTR)[] = ["rentabilidad_str", "flujo_str", "ocupacion_vs_estimacion", "ventaja_vs_ltr", "sobreprecio", "estructura_financiamiento", "capex_puesta_a_punto"];

// ⛔ PISO DE COBERTURA — sin esto, TODO lo de abajo es condicional a la presencia.
//
// Lo encontró una revisión adversarial de este mismo archivo, y es una cobertura que la
// reescritura HABÍA PERDIDO: el `pisos` viejo, con toda su rigidez de cifras, al menos
// hacía `if (!f) F("debía calibrarse y está ausente")`. Al sacarlo quedaron los 21 chequeos
// —rango, magnitud ≤ decisividad, «o la magnitud o el piso»— y el invariante pirámide ≡
// módulo detrás de un `if (!f) continue`. Medido: con `return out;` puesto justo después de
// `const out: DecisividadesSTR = {}` en `calcDecisividadesSTR`, el módulo devuelve NADA, la
// pirámide entera cae a decisividad 0 vía `calibrar()` y el tier salía ✓ VERDE.
//
// Es el patrón «un cero de medición que no distingue NO CORRIÓ» aplicado a un objeto
// entero. La ausencia de un factor es indistinguible de un 0 medido porque `calibrar()
// (str-hallazgos.ts:49) hace `f?.decisividad ?? 0` y el hallazgo se emite igual.
//
// LOS CINCO QUE SIEMPRE ESTÁN son los que no dependen de datos vivos. Los otros dos faltan
// por razones legítimas y por eso NO entran acá: `sobreprecio` necesita mediana comunal
// (ausente en 9102b7e6) y `capex_puesta_a_punto` necesita CapEx > 0 (ausente en las tres,
// antigüedad 0). Exigirlos sería volver a fijar una cifra de fila viva por la puerta de atrás.
const SIEMPRE_PRESENTES: (keyof DecisividadesSTR)[] = ["rentabilidad_str", "flujo_str", "ocupacion_vs_estimacion", "ventaja_vs_ltr", "estructura_financiamiento"];

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  // Knob del capex: antigüedad 0 sin override es CapEx 0 en los dos modelos de costos.
  for (const modelo of ["legacy", "v3"] as const) {
    const c = calcCapexPuestaAPunto({ antiguedad: 0, superficieUtilM2: 45, valorUF: 39_000, overrideCLP: null, modelo });
    if (c.montoCLP !== 0) F(`capex neutro (${modelo}) · antigüedad 0 da ${c.montoCLP} CLP, no 0`);
  }

  // ── EL PISO ES UNO SOLO, ESCRITO DOS VECES ────────────────────────────────────
  // `orden-hallazgos.ts` declara `DECISIVIDAD_FLOOR_ORDEN = 0.85` con el comentario
  // «espejo de DECISIVIDAD_FLOOR (analysis.ts)», y son dos literales en dos archivos sin
  // nada que los ate. Si se separan, el módulo calibra contra un piso y el orden promueve
  // contra otro: un hallazgo levantado a 0,85 dejaría de abrir el informe, o uno que no
  // llega subiría igual. En silencio, porque cada archivo sigue siendo coherente consigo
  // mismo. Hasta hoy no lo miraba nadie.
  if (DECISIVIDAD_FLOOR !== DECISIVIDAD_FLOOR_ORDEN) {
    F(`el piso del módulo (${DECISIVIDAD_FLOOR}) y el del orden (${DECISIVIDAD_FLOOR_ORDEN}) se separaron: calibración y promoción del 01 dejarían de hablar del mismo umbral`);
  }

  // ── LA PROMOCIÓN DEL 01 ADVERSO, SOBRE FUNCIÓN PURA ───────────────────────────
  // Por qué un fixture sintético y no las filas de abajo: MEDIDO el 17-sep, en las tres
  // filas vivas el adverso más decisivo YA es el tope del ranking, o sea `iAdv === 0` y la
  // rama de promoción no se ejecuta. Las propiedades del bloque 3 se cumplirían igual con
  // la promoción borrada. Acá se la ejercita: el fixture declara los CUATRO campos que el
  // comparador lee (id, direccion, decisividad, magnitudContinua) y nada más, que es toda
  // la superficie de `cmpDecisividad` + `ordenarHallazgosUnico`.
  // Los ids son REALES (del union `Hallazgo["id"]`), no inventados: un fixture con ids que
  // el tipo no admite no habría compilado, y eso es el tipo haciendo su trabajo.
  const h = (id: Hallazgo["id"], direccion: Hallazgo["direccion"], decisividad: number) =>
    ({ id, direccion, decisividad, magnitudContinua: decisividad } as unknown as Hallazgo);
  const FAV = "ventaja_vs_ltr";
  const ADV = "rentabilidad_str";
  {
    // (i) el adverso bajo el tope PERO sobre el piso sube a 01.
    const o = ordenarHallazgosPiramideSTR([h(FAV, "favorable", 0.9), h(ADV, "adverso", 0.87)]);
    if (o[0]?.id !== ADV) F(`orden · un adverso 0,87 sobre el piso no abre por encima de un favorable 0,90 (abre ${o[0]?.id})`);
    // (ii) y el piso es VINCULANTE: bajo el piso no sube, aunque sea el único adverso.
    const o2 = ordenarHallazgosPiramideSTR([h(FAV, "favorable", 0.9), h(ADV, "adverso", 0.8)]);
    if (o2[0]?.id !== FAV) F(`orden · un adverso 0,80 BAJO el piso abre igual: el piso dejó de ser vinculante (abre ${o2[0]?.id})`);
    // (iii) la distancia al veredicto no es una parada de la pirámide.
    const o3 = ordenarHallazgosPiramideSTR([h("distancia_veredicto", "adverso", 1), h(FAV, "favorable", 0.1)]);
    if (o3.some((x) => x.id === "distancia_veredicto")) F("orden · `distancia_veredicto` volvió a entrar en la pirámide: corre la numeración de todos los demás");
  }

  // ── EL MERGE, TAMBIÉN SOBRE FUNCIÓN PURA ──────────────────────────────────────
  // Misma razón que arriba, medida igual: en las tres filas `result.hallazgos` viene VACÍO
  // —el motor solo siembra capex y con antigüedad 0 no siembra nada—, así que
  // `mergeHallazgosStr(motor, str)` es un pass-through 3/3 y su salida es byte-idéntica con
  // el dedup borrado o con `return str`. O sea: el bloque 2 lo llama en cada fila y no lo
  // prueba. Acá se le dan las dos entradas que lo definen.
  {
    const delMotor = h(ADV, "adverso", 0.2);
    const delStr = h(ADV, "adverso", 0.9);
    const otro = h(FAV, "favorable", 0.3);
    // (i) a mismo id gana la copia calibrada de STR, no la sembrada por el motor.
    const m = mergeHallazgosStr([delMotor], [delStr]);
    if (m.length !== 1) F(`merge · a mismo id debía quedar UNA copia y quedan ${m.length}: la pirámide mostraría el hallazgo dos veces`);
    else if (m[0].decisividad !== 0.9) F("merge · a mismo id ganó la copia del motor: la calibrada de STR es la que trae la decisividad del recompute");
    // (ii) y lo que el motor siembra y STR no reemplaza NO se tira.
    const m2 = mergeHallazgosStr([otro], [delStr]);
    if (!m2.some((x) => x.id === FAV)) F("merge · se perdió el hallazgo sembrado por el motor que STR no reemplaza");
  }

  for (const caso of CASOS) {
    const pref = caso.id.slice(0, 8);
    const { data: row, error } = await sb.from("analisis").select("id, comuna, input_data, results, created_at").eq("id", caso.id).single();
    if (error || !row) { F(`${pref} · fila no cargó: ${error?.message}`); continue; }
    const d = row.input_data as Record<string, number | string>;
    const uf = (d.precioCompra as number) / (d.precioCompraUF as number);
    const ctx = buildStrRecomputeCtx(row.input_data, row.results, uf);
    if (!ctx) { F(`${pref} · sin contexto de recompute`); continue; }
    const asOf = new Date(row.created_at);
    const result = calcShortTerm(ctx.inputs, asOf);
    const francoScore = calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra: ctx.inputs.precioCompra });
    let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
    try {
      mediana = await getComunaMedianaVentaUF(sb, row.comuna as string, d.superficieUtil as number, (d.dormitorios as number) ?? null, uf,
        resolverCondicionMercado({ esNuevo: d.tipoPropiedad === "nuevo", antiguedad: d.antiguedad as number | undefined }));
    } catch { /* sin mediana ⇒ sobreprecio ausente, contrato igual */ }
    const veredictoCtx = { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf };

    // 1) El módulo, directo.
    const dec = calcDecisividadesSTR(veredictoCtx, { comuna: row.comuna as string, medianaUfM2: mediana.mediana, medianaN: mediana.n, superficieM2: d.superficieUtil as number, valorUF: uf }, { result, francoScore });
    for (const k of SIEMPRE_PRESENTES) {
      if (!dec[k]) F(`${pref} · el módulo no devolvió \`${k}\`: el knob no depende de datos vivos, así que ausente es que dejó de calcularse — y ausente se lee como decisividad 0 en la pirámide, no como «no corrió»`);
    }
    for (const k of CON_KNOB) {
      const f = dec[k];
      if (!f) continue;
      if (!(f.decisividad >= 0 && f.decisividad <= 1)) F(`${pref} · ${k} decisividad fuera de [0,1]: ${f.decisividad}`);
      if (!(f.magnitud >= 0 && f.magnitud <= 1)) F(`${pref} · ${k} magnitud fuera de [0,1]: ${f.magnitud}`);
      if (f.magnitud > f.decisividad + 1e-9) F(`${pref} · ${k} magnitud ${f.magnitud} > decisividad ${f.decisividad}`);
      // O ES LA MAGNITUD, O ES EL PISO. No hay tercer valor: `decisividadDesdeStr` devuelve
      // `flip || gateDesarmado ? Math.max(FLOOR, magnitud) : magnitud`, y los siete factores
      // salen de ese mismo helper (`fin()` en calcDecisividadesSTR). Cualquier interpolación,
      // redondeo o piso nuevo rompe esto. Medido: 21 de 21 factores de las tres filas cumplen.
      const esMagnitud = Math.abs(f.decisividad - f.magnitud) <= 1e-9;
      const esPiso = Math.abs(f.decisividad - DECISIVIDAD_FLOOR) <= 1e-9;
      if (!esMagnitud && !esPiso)
        F(`${pref} · ${k} no es ni la magnitud ni el piso: ${f.decisividad}/${f.magnitud}`);
    }
    // LA MISMA FUENTE QUE LEE EL MÓDULO, no la réplica. Esto miraba `d.antiguedad`
    // (`input_data` crudo) mientras `calcDecisividadesSTR` mira `ctx.inputs.antiguedad`, que
    // `buildStrRecomputeCtx` resuelve como `inputData.antiguedad ?? (tipoPropiedad === "nuevo"
    // ? 0 : 5)`. En una fila usada sin `antiguedad`, el guard leía `undefined` —y `!(undefined
    // > 2)` es true— mientras el motor usaba 5 y calibraba capex con razón: rojo en falso.
    // El `?? 0` es el mismo del módulo (`antiguedad: inp.antiguedad ?? 0`): se lee la misma
    // entrada y se la normaliza igual, que es distinto de reimplementar lo que hace con ella.
    const antiguedadMotor = ctx.inputs.antiguedad ?? 0;
    if (!(antiguedadMotor > 2) && dec.capex_puesta_a_punto) F(`${pref} · capex calibrado con antigüedad ${antiguedadMotor}, que no genera CapEx`);

    // 2) La pirámide, como la ve el informe.
    const hz = ordenarHallazgosPiramideSTR(mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
      result, francoScore, comuna: row.comuna as string, precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
      piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number, mediana, valorUF: uf, incluyeCorretaje: false, veredictoCtx,
    })));
    // ── 3) EL ORDEN, COMO PROPIEDAD DE LO QUE SALE ─────────────────────────────
    // Reemplaza al `primero` fijado por fila. Lo que `ordenarHallazgosUnico` promete es una
    // disyunción, no un ganador: el 01 es el tope del ranking, SALVO que exista un adverso
    // sobre el piso, en cuyo caso ese adverso sube aunque sea menos decisivo que un favorable.
    //
    // ⚠ OJO — la regla «el 01 es el de mayor decisividad» es FALSA en general, y así se
    //   propuso antes de leer `orden-hallazgos.ts`: con la promoción activa el 01 puede tener
    //   MENOS decisividad que el hallazgo que quedó segundo. Escribirla habría dejado un guard
    //   que miente sobre el módulo que vigila. Va la disyunción exacta, en las dos ramas.
    if (hz.length) {
      const advSobrePiso = hz.filter((x) => x.direccion === "adverso" && x.decisividad >= DECISIVIDAD_FLOOR - 1e-9);
      const tope = Math.max(...hz.map((x) => x.decisividad));
      if (advSobrePiso.length) {
        // Rama (b): hay adverso vinculante ⇒ el informe ABRE adverso. Si no, la pirámide
        // entierra un golpe que flipea el veredicto debajo de una buena noticia.
        if (hz[0].direccion !== "adverso")
          F(`${pref} · hay adverso sobre el piso (${advSobrePiso.map((x) => `${x.id} ${x.decisividad.toFixed(2)}`).join(", ")}) y el 01 es ${hz[0].id} (${hz[0].direccion})`);
        else if (hz[0].decisividad < DECISIVIDAD_FLOOR - 1e-9)
          F(`${pref} · el 01 adverso ${hz[0].id} no pasa el piso: ${hz[0].decisividad.toFixed(2)}`);
      } else if (hz[0].decisividad < tope - 1e-9) {
        // Rama (a): sin adverso vinculante no se fuerza apertura adversa ⇒ manda el ranking.
        F(`${pref} · sin adverso sobre el piso el 01 debía ser el tope del ranking (${tope.toFixed(2)}) y ${hz[0].id} da ${hz[0].decisividad.toFixed(2)}`);
      }
      // Y en las DOS ramas: ningún adverso puede ser más decisivo que el que abre.
      const advMayor = hz.find((x) => x.direccion === "adverso" && x.decisividad > hz[0].decisividad + 1e-9);
      if (advMayor) F(`${pref} · ${advMayor.id} es adverso y más decisivo (${advMayor.decisividad.toFixed(2)}) que el 01 ${hz[0].id} (${hz[0].decisividad.toFixed(2)})`);
      // De la posición 1 en adelante el ranking es puro: decisividad no creciente.
      for (let i = 1; i + 1 < hz.length; i++) {
        if (hz[i].decisividad < hz[i + 1].decisividad - 1e-9)
          F(`${pref} · el ranking se rompe entre ${hz[i].id} (${hz[i].decisividad.toFixed(2)}) y ${hz[i + 1].id} (${hz[i + 1].decisividad.toFixed(2)})`);
      }
    }
    for (const h of hz) {
      const inf = (INFORMATIVOS_STR as readonly string[]).includes(h.id);
      if (inf && h.decisividad !== 0) F(`${pref} · informativo ${h.id} con decisividad ${h.decisividad}`);
      const f = dec[h.id as keyof DecisividadesSTR];
      if (!inf && f && Math.abs(h.decisividad - f.decisividad) > 1e-9) F(`${pref} · ${h.id} en la pirámide (${h.decisividad}) ≠ módulo (${f.decisividad})`);
      if (!inf && f && Math.abs((h.magnitudContinua ?? 0) - f.magnitud) > 1e-9) F(`${pref} · ${h.id} magnitud en la pirámide ≠ módulo`);
      // NaN no lo caza ninguna resta: `Math.abs(NaN - x) > 1e-9` es false y pasa de largo.
      if (!Number.isFinite(h.decisividad)) F(`${pref} · ${h.id} llega a la pirámide con decisividad ${h.decisividad}`);
    }
    console.log(`  ${pref} · ${francoScore.veredicto}/${francoScore.score} · 01 ${hz[0]?.id} · ${hz.slice(0, 4).map((h) => `${h.id} ${h.decisividad.toFixed(2)}`).join(" | ")}`);
  }

  console.log("\nDECISIVIDAD REAL STR · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
