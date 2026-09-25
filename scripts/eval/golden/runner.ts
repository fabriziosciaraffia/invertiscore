// ============================================================================
// GOLDEN SET — runner (CLI orquestador)
// ============================================================================
// Fase 2.0 del sistema. Corre el eval de regresión y reporta matriz pasa/falla.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts [flags]
//     --quick        (default) solo recompute determinístico LTR (0 tokens)
//     --str          agrega el tier STR (GS-STR, BS1-BS8, 0 tokens)
//     --ambas        agrega el tier AMBAS (GS-AMBAS veredicto comparativo D1+D2, 0 tokens)
//     --all          LTR quick + STR + AMBAS (0 tokens)
//     --seed=ID[,ID] acota los tiers POR SEED (quick, STR) a esas claves. NO altera QUÉ
//                    tiers corren: los catch-tests siguen corriendo siempre (cuestan 0).
//                    Claves válidas: las 10 GS-* + 3 BE-* de LTR (seeds.ts) y las
//                    GE-* + BE-*-str de STR (str-seeds.ts).
//
// ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: se fueron los tiers que generaban prosa y
// la juzgaban (--full, --no-semantic, --ambas-semantic, --str-semantic, --k, --dump, --from,
// --ltr-only, --str-only). La IA salió del informe; el golden es todo de 0 tokens.
//     --catch-test   auto-test: rompe invariantes en memoria y verifica que FALLA
//
// Exit code 0 solo si no hay fallas duras. Drift de cifra clase (a) → warning
// (candidato a re-baseline, no bloquea).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { runRecomputeTier, type SeedReport } from "./recompute";
import { GOLDEN_SEEDS, BORDE_SEEDS } from "./seeds";
import { STR_GE_SEEDS } from "./str-seeds";
import { runCatchTest } from "./catch-test";
import { runStrTier } from "./str-recompute";
import { runEtiquetaTier } from "./etiqueta-veredicto-catch-test";
import { runInstrumentosTier } from "./instrumentos-catch-test";
import { runMesVacioTier } from "./mes-vacio-catch-test";
import { runRegulacionNoPesaTier } from "./regulacion-no-pesa-catch-test";
import { runScoreRetornoTier } from "./score-retorno-catch-test";
import { runGestionSinVeredictoTier } from "./gestion-sin-veredicto-catch-test";
import { runFlujoDiezAniosTier } from "./flujo-diez-anios-catch-test";
import { runFusionGestionFlujoTier } from "./fusion-gestion-flujo-catch-test";
import { runCierreSinBarraRojaTier } from "./cierre-sin-barra-roja-catch-test";
import { runPatchQueEmpeoraTier } from "./patch-que-empeora-catch-test";
import { runPlusvaliaGlosaTier } from "./plusvalia-glosa-catch-test";
import { runRespaldoArriendoTier } from "./respaldo-arriendo-catch-test";
import { runDistanciaComprarTier } from "./distancia-comprar-catch-test";
import { runDistanciaComprarStrTier } from "./distancia-comprar-str-catch-test";
import { runRepartoIngresoTier } from "./reparto-ingreso-catch-test";
import { runMixPalancasTier } from "./mix-palancas-catch-test";
import { runMixScoreTier } from "./mix-score-catch-test";
import { runGrillaPopupTier } from "./grilla-popup-catch-test";
import { runPopupAjustesTier } from "./popup-ajustes-catch-test";
import { runChipVeredictoTier } from "./chip-veredicto-catch-test";
import { runTitularMotorTier } from "./titular-motor-catch-test";
import { runRetiroIaTier } from "./retiro-ia-catch-test";
import { runSelectorModalidadTier } from "./selector-modalidad-catch-test";
import { runCopySinIaTier } from "./copy-sin-ia-catch-test";
import { runDispersionComunalTier } from "./dispersion-comunal-catch-test";
import { runComoLoPagasTier } from "./como-lo-pagas-catch-test";
import { runMantencionUnaSolaTier } from "./mantencion-una-sola-catch-test";
import { runFlujoLtrTier } from "./flujo-ltr-catch-test";
import { runCapRateRedondeoTier } from "./caprate-redondeo-catch-test";
import { runCapRefComunaTier } from "./capref-comuna-catch-test";
import { runCuantoRentaTier } from "./cuanto-renta-catch-test";
import { runStrRefZonaTier } from "./strref-zona-catch-test";
import { runRefinanciamientoTier } from "./refinanciamiento-catch-test";
import { runSobreprecioVentaTier } from "./sobreprecio-venta-catch-test";
import { runResultadoCapituloTier } from "./resultado-capitulo-catch-test";
import { runPlusvaliaCapituloTier } from "./plusvalia-capitulo-catch-test";
import { runOcupacionStrTier } from "./ocupacion-str-catch-test";
import { runHojaModalTier } from "./hoja-modal-catch-test";
import { runInfoIndicadoresTier } from "./info-indicadores-catch-test";
import { runCapasOscuroTier } from "./capas-oscuro-catch-test";
import { runSinSemaforoTier } from "./sin-semaforo-catch-test";
import { runPlanillaCalculoTier } from "./planilla-calculo-catch-test";
import { runCapRateNetoTier } from "./cap-rate-neto-catch-test";
import { runFindingDisplayLegacyTier } from "./finding-display-legacy-catch-test";
import { runFactibilidadDemandaTier } from "./factibilidad-demanda-catch-test";
import { runFichaComparablesTier } from "./ficha-comparables-catch-test";
import { runMudanzaCapitulosTier } from "./mudanza-capitulos-catch-test";
import { runRetiroVentajaLtrTier } from "./retiro-ventaja-ltr-catch-test";
import { runStandaloneTier } from "./standalone-tier";
import { runMixStrTier } from "./mix-str-catch-test";
import { runLoQueHariaYoTier } from "./lo-que-haria-yo-catch-test";
import { runSalidaPorMixTier } from "./salida-por-mix-catch-test";
import { runEscalaSuperficiesTier } from "./escala-superficies-catch-test";
import { runTipografiaRedisenoTier } from "./tipografia-rediseno-catch-test";
import { runPaletaRedisenoTier } from "./paleta-rediseno-catch-test";
import { runRadiosSombrasTier } from "./radios-sombras-catch-test";
import { runEstructuraRedisenoTier } from "./estructura-rediseno-catch-test";
import { runHeroRedisenoTier } from "./hero-rediseno-catch-test";
import { runRecomendacionRedisenoTier } from "./recomendacion-rediseno-catch-test";
import { runEstructuraStrRedisenoTier } from "./estructura-str-rediseno-catch-test";
import { runCardStrTier } from "./card-str-catch-test";
import { runSalidaStrCopyTier } from "./salida-str-copy-catch-test";
import { runComprarDosMargenesTier } from "./comprar-dos-margenes-catch-test";
import { runBajadaNoMienteTier } from "./bajada-no-miente-catch-test";
import { runAlternativaComunasTier } from "./alternativa-comunas-catch-test";
import { runGeneradorEnScriptsTier } from "./generador-en-scripts-catch-test";
import { runAmbasTier } from "./ambas-recompute";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);

// ── --seed: filtro de seeds, resuelto UNA vez y validado acá ────────────────
// Reemplaza al `--solo=` que `generate.ts` leía por su cuenta desde process.argv:
// indocumentado, sin validar y respetado por un solo tier.
const seedArg = argv.find((a) => a.startsWith("--seed="));
const SEED_FILTRO: Set<string> | null = seedArg
  ? new Set(seedArg.slice("--seed=".length).split(",").map((x) => x.trim()).filter(Boolean))
  : null;
const CLAVES_LTR = [...GOLDEN_SEEDS.map((x) => x.key), ...BORDE_SEEDS.map((x) => x.key)];
const CLAVES_STR = STR_GE_SEEDS.map((x) => x.key);
const CLAVES_SEED = [...CLAVES_LTR, ...CLAVES_STR];

// EL NAMESPACE DEL FILTRO DECIDE LA MODALIDAD. Nombrar solo seeds STR no es una falla
// de los tiers LTR: es el filtro funcionando, y esos tiers no tienen nada que hacer. Se
// SALTAN diciéndolo (nunca en silencio), y la capa 2 queda para la falla de verdad —
// una clave de la modalidad correcta que igual deja el tier en cero, como `BE-caprate`
// en el FULL AUTO de LTR.
const FILTRO_SOLO_LTR = !!SEED_FILTRO && [...SEED_FILTRO].every((k) => CLAVES_LTR.includes(k));
const FILTRO_SOLO_STR = !!SEED_FILTRO && [...SEED_FILTRO].every((k) => CLAVES_STR.includes(k));

/** Los tiers por seed de la modalidad que el filtro no nombra se saltan, con línea. */
function saltadoPorFiltro(tier: string, esDeStr: boolean): boolean {
  if (!SEED_FILTRO) return false;
  const salta = esDeStr ? FILTRO_SOLO_LTR : FILTRO_SOLO_STR;
  if (salta) console.log(`\n─── ${tier} — SALTADO: el filtro --seed nombra solo seeds de ${esDeStr ? "LTR" : "STR"} ───`);
  return salta;
}

/** CAPA 1 de validación: una clave que no existe muere ANTES de tocar la base o gastar
 *  un token. Sin esto, un ID mal escrito recorre cero seeds y la tanda reporta verde. */
function validarFiltroSeed(): void {
  if (!SEED_FILTRO) return;
  if (SEED_FILTRO.size === 0) {
    console.error("\n✗ --seed= vino vacío. Claves válidas:\n   " + CLAVES_SEED.join(" "));
    process.exit(1);
  }
  const invalidas = [...SEED_FILTRO].filter((k) => !CLAVES_SEED.includes(k));
  if (invalidas.length > 0) {
    console.error(`\n✗ --seed: clave(s) inexistente(s): ${invalidas.join(", ")}`);
    console.error("   LTR:\n   " + CLAVES_LTR.join(" "));
    console.error("   STR:\n   " + CLAVES_STR.join(" "));
    process.exit(1);
  }
}

/** CAPA 2: cero seeds tras filtrar es FALLA DURA, por tier. Hace falta además de la
 *  capa 1 porque los tiers no comparten universo: `BE-caprate` es válida en el QUICK
 *  (que recorre GOLDEN + BORDE) y no existe en el tier FULL (solo GOLDEN). Sin este
 *  chequeo, `--seed=BE-caprate --full` pasaba la validación y corría cero generaciones
 *  reportando verde. */
function ceroSeedsEsFalla(tier: string, corridas: number): number {
  if (!SEED_FILTRO || corridas > 0) return 0;
  console.log(`\n  ✗ ${tier}: --seed=${[...SEED_FILTRO].join(",")} no dejó NINGUNA seed en este tier.`);
  console.log(`      El tier corrió y no probó nada. La clave es de esta modalidad pero no está en el`);
  console.log(`      universo de ESTE tier: el FULL AUTO de LTR solo conoce las GS-*, no las BE-*.`);
  return 1;
}

/** La línea de TANDA ACOTADA. Va en el encabezado Y pegada al veredicto: en una corrida
 *  larga el encabezado queda fuera de pantalla y lo último que se lee es el verde. */
function lineaTandaAcotada(): void {
  if (!SEED_FILTRO) return;
  const claves = [...SEED_FILTRO].join(",");
  const enQuick = CLAVES_LTR.filter((k) => SEED_FILTRO.has(k)).length;
  const enStr = CLAVES_STR.filter((k) => SEED_FILTRO.has(k)).length;
  console.log(`\n⚠ TANDA ACOTADA · --seed=${claves} — QUICK ${enQuick} de ${CLAVES_LTR.length} · STR ${enStr} de ${CLAVES_STR.length}`);
  console.log("  El verde NO cubre las otras seeds.");
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function printSeed(r: SeedReport) {
  const fails = r.checks.filter((c) => !c.pass);
  const status = r.hardFail > 0 ? "✗ FAIL" : r.rebaseline > 0 ? "~ DRIFT" : "✓ PASS";
  console.log(`\n  ${status}  ${r.key}  (${r.checks.length} reglas, ${r.hardFail} duras, ${r.rebaseline} drift)`);
  for (const c of fails) {
    console.log(`      ${c.rebaseline ? "~" : "✗"} ${c.rule}: ${c.detail}`);
  }
}

(async () => {
  console.log("════════════════════ GOLDEN SET · runner ════════════════════");
  validarFiltroSeed();
  lineaTandaAcotada();

  if (has("--catch-test")) {
    const ok = await runCatchTest();
    process.exit(ok ? 0 : 1);
  }

  let totalHard = 0;
  let totalDrift = 0;

  // ── Tier QUICK (corre siempre, salvo que el filtro sea solo de STR) ─────
  if (!saltadoPorFiltro("TIER QUICK", false)) {
    console.log("\n─── TIER QUICK (recompute §1, 0 tokens) ───");
    const quick = await runRecomputeTier(sb(), { seeds: SEED_FILTRO });
    quick.forEach(printSeed);
    totalHard += quick.reduce((n, r) => n + r.hardFail, 0);
    totalDrift += quick.reduce((n, r) => n + r.rebaseline, 0);
    totalHard += ceroSeedsEsFalla("TIER QUICK", quick.length);
  }

  // ── Tier ETIQUETA (goal 10a · 07-sep-2026, 0 tokens): ningún literal de etiqueta de
  // veredicto fuera de src/lib/veredicto-etiqueta.ts. Corre siempre con el QUICK. ──
  totalHard += runEtiquetaTier().hard;

  // ── Tier TITULAR retirado. ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: `titular-final.ts` (el titular de la
  // IA con sus escalones) se borró; el de la portada lo fija TITULAR-MOTOR. ──

  // ── Tier INSTRUMENTOS (#11 · 07-sep-2026, 0 tokens): el matcher A8·D1 acepta los
  // wordings legítimos del instrumento y rechaza el género. Corre siempre con el QUICK. ──
  totalHard += runInstrumentosTier().hard;

  // ── Tier MES VACÍO (v21.1 · 09-sep-2026, 0 tokens): el escenario de vacancia en plata
  // lo pone el MOTOR (cierre del capítulo II) con la aritmética completa — dividendo +
  // gastos comunes COMPLETOS + contribuciones del mes. Reemplaza a A-PC2.vacancia, que
  // lo exigía en la prosa y se retiró con acta. Corre siempre con el QUICK. ──
  totalHard += runMesVacioTier().hard;

  // ── Tier REGULACIÓN NO PESA (retiro V1 · 11-sep-2026, 0 tokens, sin base): sin gate
  // g1_regulacion, «no» = «no_seguro» = «sí» en score y veredicto, y las «sí» byte-idénticas
  // a la baseline. Verificado en rojo con la fila «no» del golden. Corre siempre con el QUICK. ──
  totalHard += runRegulacionNoPesaTier().hard;
  // ── Tier SCORE-RETORNO (12-sep-2026, 0 tokens, sin base): cash-on-cash y TIR como dimensiones
  // ponderadas (esquema A, curva calibrada), pie cero con rendimiento neto sobre el precio,
  // puertas intactas. Corre siempre con el QUICK. ──
  totalHard += runScoreRetornoTier().hard;
  // ── Tier PROMPT-V25 (12-sep-2026, 0 tokens): las seis dimensiones al user prompt, el system las
  // explica, y el guard de puntajes con sujeto está cableado. Corre siempre con el QUICK. ──
  // ── Tier GESTIÓN-SIN-VEREDICTO (16-sep-2026, 0 tokens, sin base): el informe dejó de tomar
  // posición sobre delegar. Fija la identidad del quiebre (razón entre comisiones, LEÍDA del
  // motor, no recalculada), que ninguna de las cuatro redacciones emita veredicto, que las cuatro
  // SÍ digan costo + quiebre + «no lo medimos», y un piso de cobertura que exige las cuatro
  // distintas. Verificado en rojo con 5 mutaciones. Corre siempre con el QUICK. ──
  totalHard += runGestionSinVeredictoTier().hard;
  // ── Tier FLUJO-DIEZ-AÑOS (16-sep-2026, 0 tokens, sin base): el gráfico del capítulo II
  // STR. Fija que el promedio mensual se divide por 12 —también en los años parciales, que
  // llevan cargos que el motor no prorratea—, que los años sin operación no se dibujan, que
  // el cero siempre está en el dominio, y que `CierresStr` no trae `flujo`. Fixtures
  // sintéticos con piso POR FIXTURE. Verificado en rojo con 5 mutaciones. Siempre con el QUICK.
  totalHard += runFlujoDiezAniosTier().hard;
  // ── Tier FUSIÓN-GESTIÓN-FLUJO (17-sep-2026, 0 tokens, sin base): la primera mitad del
  // capítulo V dentro del capítulo II. Fija que las dos comisiones nunca coexisten —son la
  // misma variable del motor—, que el bloque del administrador CIERRA LA SUMA a tres filas y
  // no a dos, que la comisión sale del motor y no de un `* 0.2` en el render, que el cierre
  // del II arranca en el quiebre sin repetir el costo que las filas ya muestran, y que el
  // cierre del V habla con los dos signos de la sobre-renta. Verificado en rojo con 5
  // mutaciones. Siempre con el QUICK.
  totalHard += runFusionGestionFlujoTier().hard;
  // -- Tier CIERRE-SIN-BARRA-ROJA (17-sep-2026, 0 tokens, sin base): la forma nueva de
  // `VCierre`, que gobierna los 28 cierres del informe desde un solo bloque de CSS. Fija que
  // el cierre no lleva Signal Red, ni italica, ni serif; que el plumon esta NEUTRALIZADO y
  // no sacado del selector (sin regla propia cae al amarillo del navegador); que la prosa si
  // lo conserva; que el rotulo NO baja a --doc-tx4 (2,2:1 medido); y que la regla degradada
  // no vuelve. Lee el CSS SIN COMENTARIOS, porque el acta nombra todo lo que el predicado
  // prohibe. Verificado en rojo con 7 mutaciones, una de ellas borrando el bloque entero.
  totalHard += runCierreSinBarraRojaTier().hard;
  // ── Tier PATCH-QUE-EMPEORA (16-sep-2026, 0 tokens, sin base): un patch que empeora el caso
  // no puede cruzar hacia un veredicto mejor, así que no se prueba. Con el caso en auto el
  // builder no sondea «administrador» NI CON UNA SONDA MENTIROSA — que es lo que distingue
  // «no cruza» de «no pregunta»—, y el tramo de gestión entra a la frase estructural solo del
  // lado que probó sacar un costo real. Verificado en rojo con 3 mutaciones. Siempre con el QUICK.
  totalHard += runPatchQueEmpeoraTier().hard;
  totalHard += runPlusvaliaGlosaTier().hard;
  totalHard += runRespaldoArriendoTier().hard;
  totalHard += runDistanciaComprarTier().hard;
  // Tier DISTANCIA-COMPRAR-STR (11-sep-2026, 0 tokens, sin base): las cinco vias a COMPRAR y
  // el mix hacia COMPRAR desde BUSCAR en el builder STR, espejo del tier LTR. Siempre con el QUICK.
  totalHard += runDistanciaComprarStrTier().hard;
  totalHard += runRepartoIngresoTier().hard;
  totalHard += runMixPalancasTier().hard;
  totalHard += runMixScoreTier().hard;
  totalHard += runGrillaPopupTier().hard;
  // ⛔ EL TIER DEL RENDER NUNCA HABÍA CORRIDO ACÁ (17-sep-2026). `popup-ajustes-catch-test`
  // existe desde el 13-sep con su acta —«corre dentro del QUICK (tier popup-ajustes) y
  // standalone»— y el runner no lo importaba: veinte invariantes del pop-up vivían fuera del
  // gate, verdes solo si alguien los invocaba a mano. Un guard que no corre no es un guard.
  totalHard += runPopupAjustesTier().hard;
  totalHard += runChipVeredictoTier().hard;
  totalHard += runTitularMotorTier().hard;
  totalHard += runRetiroIaTier().hard;
  totalHard += runSelectorModalidadTier().hard;
  totalHard += runCopySinIaTier().hard;
  // Tier DISPERSIÓN-COMUNAL (21-sep-2026, 0 tokens, sin base): p25/p75 salen de las mismas
  // filas que la mediana, se persisten en el snapshot y el motor deriva la posición del
  // sujeto por cuartiles — sin inventarla cuando el snapshot es anterior al campo.
  // Verificado en rojo con 5 mutaciones. Siempre con el QUICK; la sonda viva va standalone.
  totalHard += runDispersionComunalTier().hard;
  // Tier COMO-LO-PAGAS (21-sep-2026, 0 tokens, sin base): el capítulo se ancla al precio
  // recomendado leído de `mixAComprar` —sin caer al escalón—, los seis casos, la copia
  // fijada, la frase del hallazgo por cuartil y el cableado en los dos capítulos.
  // Verificado en rojo con 6 mutaciones. Siempre con el QUICK; la sonda viva va standalone.
  totalHard += runComoLoPagasTier().hard;
  // ── Tier MANTENCIÓN UNA SOLA (21-sep-2026): el mes de la tabla y el año 1 del loop salen
  //    de la misma función; declarada respetada, legacy sin +1, v3 con reset. ──
  totalHard += runMantencionUnaSolaTier().hard;
  // ── Tier FLUJO LTR (21-sep-2026): el capítulo II de LTR como capítulo — rótulo del mes,
  //    serie ÷ meses a diez años, pie por datos, mes vacío como cierre. ──
  totalHard += runFlujoLtrTier().hard;
  // ── Tier CAP RATE REDONDEO (21-sep-2026): una sola forma de redondear; hero ≡ capítulo I. ──
  totalHard += runCapRateRedondeoTier().hard;
  totalHard += runCapRefComunaTier().hard;
  totalHard += runCuantoRentaTier().hard;
  totalHard += runStrRefZonaTier().hard;
  totalHard += runRefinanciamientoTier().hard;
  totalHard += runSobreprecioVentaTier().hard;
  totalHard += runResultadoCapituloTier().hard;
  totalHard += runPlusvaliaCapituloTier().hard;
  totalHard += runOcupacionStrTier().hard;
  totalHard += runRetiroVentajaLtrTier().hard;
  // ── Tier HOJA-MODAL (23-sep-2026): el Modal con dos formas por ancho — hoja bajo 768 (body
  //    bloqueado, historial consumido, arrastre) y panel de 720 arriba. 26 mutaciones en rojo. ──
  totalHard += runHojaModalTier().hard;
  // ── El ⓘ de los indicadores (23-sep-2026): la pila de hojas, los nombres de mercado, la
  //    referencia STR única, sin cursiva y FilaDato sin title. ──
  totalHard += runInfoIndicadoresTier().hard;
  // ── Las capas en oscuro (23-sep-2026): cada capa un escalón más clara. Lo del DOM —ninguna
  //    pieza del color de su contenedor— lo mide `capas-oscuro-sonda.ts`, standalone contra el dev server. ──
  totalHard += runCapasOscuroTier().hard;
  // ── Sin ocre ni verde fuera de la tríada (23-sep-2026). Lo del DOM lo mide
  //    `sin-ocre-verde-sonda.ts`, standalone contra el dev server. ──
  totalHard += runSinSemaforoTier().hard;
  // ── «Cómo se calcula» del mockup aprobado (23-sep-2026): sin la venta, el cash on cash con el
  //    denominador del motor, textos desde el dato y la moneda del toggle. Lo del DOM (tres filas ×
  //    390/350/1100 × temas × monedas) lo mide `planilla-calculo-sonda.ts`, standalone. ──
  totalHard += runPlanillaCalculoTier().hard;
  // ── Una sola «cap rate neto» (23-sep-2026): rentabilidadNeta en el hero, el pop-up, la planilla,
  //    el anexo y el prompt; capRate no se muestra; el capítulo I compara siempre bruto contra bruto. ──
  totalHard += runCapRateNetoTier().hard;
  // ── La card de un hallazgo GUARDADO no revienta (23-sep-2026): leer `sujetoPct` sin mirar
  //    rompió el build de master (prerender de /dev/finding-card) y el anexo con filas viejas. ──
  totalHard += runFindingDisplayLegacyTier().hard;
  // ── La factibilidad STR mide la demanda de la zona (23-sep-2026): sin constante, ingreso ni
  //    tipología; el nivel de ocupación realizada, no la brecha; las filas sin el dato lo leen
  //    del caché; el ancla es del filtro vigente. Lo que necesita base: `factibilidad-demanda-sonda.ts`. ──
  totalHard += runFactibilidadDemandaTier().hard;
  // ── La ficha del depto y los comparables LTR (24-sep-2026): tu arriendo aparece sin referencia
  //    de radio; el resto de los invariantes entra con la ficha y el modal de comparables. ──
  totalHard += runFichaComparablesTier().hard;
  // ── Tier MUDANZA-CAPÍTULOS (23-sep-2026): los once capítulos abren en el pop-up, el hash y la
  //    apertura externa abren, medir dispara, useAncho mide al montar, el PDF no importa de la
  //    superficie mudada, título y tinta. La medición viva (width del SVG dentro de la hoja) es
  //    `mudanza-capitulos-sonda.ts`, standalone contra el dev server. ──
  totalHard += runMudanzaCapitulosTier().hard;
  // ── Tier STANDALONE (17-sep-2026): los catch-tests que corrían SOLO a mano. Nueve de los
  // 28 estaban en rojo cuando se los corrió, y `zona` llevaba 14 días protegiendo una regla
  // derogada a propósito — o sea que su rojo ya no se podía leer. Entran los 12 que no tocan
  // Supabase; los que recomputan el parque y el que tapa un bug vivo quedan fuera, con su
  // lista y su razón en `standalone-tier.ts`.
  totalHard += (await runStandaloneTier()).hard;
  // ── Tier MIX STR (11-sep-2026, 0 tokens, sin base): el builder STR emite el mismo mix
  // que LTR a través del adaptador UF→CLP / %→decimal; destino = escalón, tope 25/15,
  // redundancia con palanca sola y «sin salida» coherente. Corre siempre con el QUICK. ──
  totalHard += runMixStrTier().hard;
  totalHard += runLoQueHariaYoTier().hard;
  totalHard += runSalidaPorMixTier().hard;
  totalHard += runEscalaSuperficiesTier().hard;
  totalHard += runTipografiaRedisenoTier().hard;
  totalHard += runPaletaRedisenoTier().hard;
  totalHard += runRadiosSombrasTier().hard;
  totalHard += runEstructuraRedisenoTier().hard;
  totalHard += runHeroRedisenoTier().hard;
  totalHard += runRecomendacionRedisenoTier().hard;
  // interruptor-rediseno: RETIRADO CON ACTA el 12-sep-2026 (retiro del andamio). Fijaba las
  // dos constantes en `true`, la derivación de la prop STR, la clase derivada y el default del
  // contexto: todo eso ya no existe. Inter con preload pasó a tipografia-rediseno 4.
  // ── Tier STR AL REDISEÑO (11-sep-2026, 0 tokens, sin base): lo propio de §11, bloque por
  // bloque. Corre siempre con el QUICK. ──
  totalHard += runEstructuraStrRedisenoTier().hard;
  // Tier CARD-STR (bloque C · 11-sep-2026, 0 tokens, sin base): el constructor por modalidad, los
  // cuatro estados con el motor STR, Verifica solo con override, renta larga solo con el hallazgo. ──
  totalHard += runCardStrTier().hard;
  // Tier NIEGA-SALIDA-STR y VOCABULARIO-PROMPT-STR (v19 · 12-sep-2026, 0 tokens, sin base): el mix llega
  // al modelo desde la fuente de la card y la prosa no lo niega; y el texto dirigido al modelo sin
  // palanca / vía / brecha / estructural. ──
  // Tier SALIDA-STR-COPY (12-sep-2026, 0 tokens, sin base): la frase estructural STR y sus cuatro
  // superficies dejan de negar la combinación; el copy en un solo módulo. ──
  totalHard += runSalidaStrCopyTier().hard;
  // Tier COMPRAR-DOS-MARGENES (12-sep-2026, 0 tokens, sin base): el precio maximo de COMPRAR en
  // LTR, las tres filas con oracion en las dos modalidades y «(c/u por separado)» solo con dos. ──
  totalHard += runComprarDosMargenesTier().hard;
  totalHard += runBajadaNoMienteTier().hard;
  totalHard += runAlternativaComunasTier().hard;

  // ── Tier CANDADO retirado (25-sep-2026): el candado de regeneración se fue con los
  // generadores, en la parte 2 del retiro de la IA. ──

  // ── Tier INSTRUMENTO (07-sep-2026, 0 tokens): ningún call site del generador en scripts/
  // escribe en la base sin declararlo (persist:false o trigger). Corre siempre con el QUICK. ──
  totalHard += runGeneradorEnScriptsTier().hard;

  // ── Tier STR (E.1b · GS-STR, 0 tokens). Corre con --str o --all/--full. ──
  if ((has("--str") || has("--all")) && !saltadoPorFiltro("TIER STR · recompute", true)) {
    const str = runStrTier({ seeds: SEED_FILTRO });
    totalHard += str.hard;
    totalDrift += str.drift;
    totalHard += ceroSeedsEsFalla("TIER STR · recompute", str.corridas);
  }

  // ── Tier AMBAS (D1+D2 · GS-AMBAS veredicto comparativo, 0 tokens). --ambas o --all/--full. ──
  if (has("--ambas") || has("--all")) {
    const ambas = runAmbasTier();
    totalHard += ambas.hard;
    totalDrift += ambas.drift;
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  console.log("\n════════════════════ RESUMEN ════════════════════");
  console.log(`  fallas duras:        ${totalHard}`);
  console.log(`  drift clase (a):     ${totalDrift} (candidatos a re-baseline)`);
  console.log(totalHard === 0 ? "  ✓ VERDE — sin regresiones estructurales" : "  ✗ ROJO — hay regresiones");
  lineaTandaAcotada();
  process.exit(totalHard === 0 ? 0 : 1);
})();
