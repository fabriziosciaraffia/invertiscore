// ============================================================================
// GOLDEN · «CÓMO LO PAGAS» SE ANCLA AL PRECIO RECOMENDADO — catch-test (21-sep-2026).
// Tier puro: 0 tokens, sin base. El standalone agrega una sonda viva.
// ============================================================================
// El capítulo (LTR III / STR IV) dejó de ser un plan de cuatro precios y pasó a tres
// bloques colgados del precio que la card §5 recomienda. Fija:
//
//   1. EL ANCLA ES `mixAComprar`, SIN CAER AL ESCALÓN. En BUSCAR OTRA con `mixPalancas`
//      (hacia AJUSTA) y sin `mixPalancasHastaComprar` —null o ausente— NO hay precio
//      recomendado: el caso es `sin_salida`. Esa caída fue el bug del 13-sep en el pop-up y
//      el que el mockup reintrodujo el 21-sep. Es el invariante más importante del tier.
//   2. Con el mix redundante con la palanca sola, el ancla es esa palanca (`precio_solo`),
//      que es lo que la card muestra como línea principal. Con mix sin descuento, el caso
//      es `sin_descuento` y el precio es el de hoy.
//   3. EL CASO lo decide la evidencia: adverso y el recomendado en/sobre la mediana ⇒
//      `mercado`; adverso y bajo la mediana ⇒ `mercado_hasta_mediana`; favorable con banda
//      difícil ⇒ `dificil_sin_evidencia`; favorable si no ⇒ `caja`; COMPRAR ⇒ `comprar`.
//   4. LA COPIA FIJADA: «Hasta dónde» con la redacción de Fabrizio (TIR 6% + flujo positivo
//      recién en …), sin la frase de la TIR cuando no hay límite, y la variante de sin salida
//      («no es una oferta, es la medida del problema»). La puesta a punto dice la RAZÓN
//      antes del monto («Antes de cobrar hay que gastar» precede a la cifra), con
//      arriendo en LTR y tarifa por noche en STR. La nota del ⓘ dice «avisos, no de
//      transacciones».
//   5. LA FRASE DEL HALLAZGO por cuartil: con posición, el titular nombra el cuarto; sin
//      cuartiles, la redacción vieja byte-idéntica.
//   6. CABLEADO (acotado al símbolo): los dos capítulos montan `construirComoLoPagas` +
//      `CapituloComoLoPagas` y ya no importan el drawer, el plan, la línea ni la
//      estructura comparada; el pop-up importa `mixAComprar` de la lib y no lo define.
//
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · `recomendacionPagas` con `?? dv.mixPalancas` de fallback → cae 1.
//   · `casoPagas` intercambiando mercado/caja → cae 3.
//   · «Hasta dónde» con la redacción vieja («ahí conviene más otra inversión») → cae 4.
//   · la intro del capex con el monto antes de la razón → cae 4.
//   · el builder de sobreprecio sin la rama por cuartil → cae 5.
//   · `CapitulosInversion.tsx` importando `DrawerNegociacion` → cae 6.
//   · el puente de COMPRAR (`adverso` forzado a false) → cae 1; forzado a true → cae 2.
//
// Standalone (agrega una fila STR real: el hallazgo de sobreprecio declara universo):
//   node --env-file=.env.local --import tsx scripts/eval/golden/como-lo-pagas-catch-test.ts
// ============================================================================
import { readFileSync } from "fs";
import { resolve } from "path";
import { construirComoLoPagas, recomendacionPagas, casoPagas, pasoHastaDonde, fraseFranja, notaFranja, POSICION_TEXTO } from "../../../src/lib/como-lo-pagas";
import type { EntradaComoLoPagas, RecomendacionPagas } from "../../../src/lib/como-lo-pagas";
import { mixAComprar } from "../../../src/lib/mix-a-comprar";
import { buildHallazgoSobreprecio } from "../../../src/lib/sobreprecio-hallazgo";
import { buildPrecioVsComuna } from "../../../src/lib/precio-vs-comuna";
import type { HallazgoDistanciaVeredicto, HallazgoPuestaAPunto, HallazgoSobreprecio, MixPalancas } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const texto = (segs: { t: string }[]) => segs.map((s) => s.t).join("");

// ── fixtures mínimos ──
const mix = (o: Partial<MixPalancas>): MixPalancas =>
  ({ descuentoPct: 10, sinDescuento: false, piePct: 30, plazoAnios: 30, piePctDelta: 10, plazoAniosDelta: 0, destino: "COMPRAR", costoDiaUnoUF: 200, descuentoSoloPrecioPct: 14, dentroDelAlcance: true, redundanteConPalancaSola: false, celdas: [], ...o }) as unknown as MixPalancas;
const dv = (o: Record<string, unknown>): HallazgoDistanciaVeredicto["valor"] =>
  ({ veredictoBase: "AJUSTA SUPUESTOS", veredictoObjetivo: "COMPRAR", esEstructural: false, palancas: [], vias: [], piePctActual: 20, ...o }) as unknown as HallazgoDistanciaVeredicto["valor"];
const sobre = (desv: number, o: Record<string, unknown> = {}): HallazgoSobreprecio =>
  ({ id: "sobreprecio", direccion: desv > 2 ? "adverso" : desv < -2 ? "favorable" : "neutral", valor: { sujetoUfM2: 100 * (1 + desv / 100), medianaComunaUfM2: 100, desviacionPct: desv, n: 120, universo: "usado", p25UfM2: 90, p75UfM2: 110, posicion: desv > 10 ? "sobre_p75" : desv > 0 ? "mediana_p75" : desv > -10 ? "p25_mediana" : "bajo_p25", ...o } }) as unknown as HallazgoSobreprecio;
const capex = (): HallazgoPuestaAPunto["valor"] => ({ montoUF: 213.5, montoCLP: 8724251, ufM2: 3.5, antiguedadAnios: 8, superficieUtilM2: 61, origen: "derivado", fraccionInversion: 0.2 }) as unknown as HallazgoPuestaAPunto["valor"];
const entrada = (o: Partial<EntradaComoLoPagas>): EntradaComoLoPagas => ({
  modalidad: "LTR", veredicto: "AJUSTA SUPUESTOS", precioUF: 3000, superficieM2: 30, comuna: "Ñuñoa", piePctActual: 20, plazoActual: 25,
  distancia: dv({ mixPalancas: mix({}) }), sobre: sobre(-10), limiteTirUF: 3500, mesCierraUF: 2500, alternativa: null, capex: capex(), valorUF: 40000, ...o,
});

function tierPuro() {
  // 1 · el ancla es mixAComprar, sin escalón
  const escalon = mix({ destino: "AJUSTA SUPUESTOS", descuentoPct: 6.7 });
  const buscarAusente = dv({ veredictoBase: "BUSCAR OTRA", veredictoObjetivo: "AJUSTA SUPUESTOS", mixPalancas: escalon, deltaMinimoComprarFueraDeTope: { palanca: "precio", deltaPct: -35.3 } });
  const buscarNull = dv({ veredictoBase: "BUSCAR OTRA", veredictoObjetivo: "AJUSTA SUPUESTOS", mixPalancas: escalon, mixPalancasHastaComprar: null });
  if (mixAComprar(buscarAusente) !== null) F("1 · mixAComprar en BUSCAR sin hastaComprar debía ser null");
  if (mixAComprar(buscarNull) !== null) F("1 · mixAComprar en BUSCAR con hastaComprar null debía ser null");
  for (const [k, d] of [["ausente", buscarAusente], ["null", buscarNull]] as const) {
    const rec = recomendacionPagas({ veredicto: "BUSCAR OTRA", precioUF: 2500, piePctActual: 15, plazoActual: 25, distancia: d });
    if (rec !== null) F(`1 · BUSCAR con hastaComprar ${k} no debía tener precio recomendado (cayó al escalón: −${rec?.descuentoPct}%)`);
    const m = construirComoLoPagas(entrada({ veredicto: "BUSCAR OTRA", precioUF: 2500, distancia: d, sobre: sobre(18) }));
    if (m.caso !== "sin_salida" || m.rec !== null) F(`1 · BUSCAR con hastaComprar ${k} debía ser sin_salida, dio ${m.caso}`);
    if (m.tituloBloque2 !== "Por qué no hay un precio que negociar") F("1 · sin salida debía titular «Por qué no hay un precio que negociar»");
  }
  const mSin = construirComoLoPagas(entrada({ veredicto: "BUSCAR OTRA", precioUF: 2500, distancia: buscarAusente, sobre: sobre(18) }));
  if (!mSin.pasos.some((p) => p.k === "Qué haría falta" && /35,3% menos de precio/.test(texto(p.segs)))) F("1 · sin salida debía decir lo que haría falta, fuera de rango (−35,3%)");
  if (mSin.fueraDeRango?.deltaPct !== -35.3) F("1 · fueraDeRango debía venir del deltaMinimoComprarFueraDeTope");
  const buscarCon = dv({ veredictoBase: "BUSCAR OTRA", mixPalancas: escalon, mixPalancasHastaComprar: mix({ descuentoPct: 23.7, piePct: 30, piePctDelta: 20 }) });
  const recCon = recomendacionPagas({ veredicto: "BUSCAR OTRA", precioUF: 5000, piePctActual: 10, plazoActual: 30, distancia: buscarCon });
  if (!recCon || recCon.descuentoPct !== 23.7 || Math.round(recCon.precioUF) !== 3815 || recCon.via !== "mix") F("1 · BUSCAR con hastaComprar debía anclar al mix hacia Comprar (−23,7% → UF 3.815)");
  const recAjusta = recomendacionPagas({ veredicto: "AJUSTA SUPUESTOS", precioUF: 3000, piePctActual: 20, plazoActual: 25, distancia: dv({ mixPalancas: mix({ descuentoPct: 12.9 }) }) });
  if (!recAjusta || recAjusta.descuentoPct !== 12.9) F("1 · AJUSTA debía anclar a mixPalancas (que ya apunta a Comprar)");

  // 2 · redundante ⇒ palanca sola; sin descuento ⇒ el precio de hoy
  const red = recomendacionPagas({ veredicto: "AJUSTA SUPUESTOS", precioUF: 3000, piePctActual: 20, plazoActual: 25, distancia: dv({ mixPalancas: mix({ redundanteConPalancaSola: true }), palancas: [{ palanca: "precio", actual: 3000, objetivo: 2670, deltaPct: -11 }] }) });
  if (!red || red.via !== "precio_solo" || red.precioUF !== 2670 || red.descuentoPct !== 11 || red.pieA !== 20) F("2 · con mix redundante el ancla debía ser la palanca precio sola (UF 2.670, −11%)");
  const sinD = construirComoLoPagas(entrada({ distancia: dv({ mixPalancas: mix({ sinDescuento: true, descuentoPct: 0 }) }) }));
  if (sinD.caso !== "sin_descuento" || sinD.rec?.precioUF !== 3000 || sinD.rec?.descuentoPct !== 0) F("2 · mix sin descuento debía ser sin_descuento con el precio de hoy");
  if (!sinD.pasos.some((p) => p.k === "Qué pides" && /sin pedirle un peso/.test(texto(p.segs)))) F("2 · sin_descuento debía decir «sin pedirle un peso»");
  const fuera = recomendacionPagas({ veredicto: "AJUSTA SUPUESTOS", precioUF: 3000, piePctActual: 20, plazoActual: 25, distancia: dv({ mixPalancas: mix({ dentroDelAlcance: false }) }) });
  if (fuera !== null) F("2 · mix fuera de alcance sin palanca sola no debía anclar nada");

  // 3 · el caso lo decide la evidencia
  const rec = (d: number): RecomendacionPagas => ({ precioUF: 3000 * (1 - d / 100), descuentoPct: d, via: "mix", pieDe: 20, pieA: 30, plazoDe: 25, plazoA: 25, destino: "COMPRAR", costoDiaUnoUF: 100, descuentoSoloPrecioPct: null, banda: d <= 5 ? "normal" : d <= 12 ? "con_argumentos" : "dificil" });
  const casos: Array<[string, Parameters<typeof casoPagas>[0], string]> = [
    ["comprar", { veredicto: "COMPRAR", rec: null, sobre: null, recVsMedianaPct: null }, "comprar"],
    ["sin salida", { veredicto: "BUSCAR OTRA", rec: null, sobre: sobre(18), recVsMedianaPct: null }, "sin_salida"],
    ["adverso, rec sobre mediana", { veredicto: "AJUSTA SUPUESTOS", rec: rec(6), sobre: sobre(18), recVsMedianaPct: 10 }, "mercado"],
    ["adverso, rec en la mediana", { veredicto: "AJUSTA SUPUESTOS", rec: rec(23.7), sobre: sobre(31), recVsMedianaPct: 0.1 }, "mercado"],
    ["adverso, rec bajo mediana", { veredicto: "AJUSTA SUPUESTOS", rec: rec(17.2), sobre: sobre(7), recVsMedianaPct: -11 }, "mercado_hasta_mediana"],
    ["favorable, normal", { veredicto: "AJUSTA SUPUESTOS", rec: rec(4.9), sobre: sobre(-19), recVsMedianaPct: -23 }, "caja"],
    ["favorable, con argumentos", { veredicto: "AJUSTA SUPUESTOS", rec: rec(9.5), sobre: sobre(-6), recVsMedianaPct: -15 }, "caja"],
    ["favorable, difícil", { veredicto: "AJUSTA SUPUESTOS", rec: rec(12.9), sobre: sobre(-17), recVsMedianaPct: -28 }, "dificil_sin_evidencia"],
    ["neutral, difícil", { veredicto: "AJUSTA SUPUESTOS", rec: rec(13.3), sobre: sobre(0), recVsMedianaPct: -13 }, "dificil_sin_evidencia"],
    ["sin descuento", { veredicto: "AJUSTA SUPUESTOS", rec: { ...rec(0), banda: "normal" }, sobre: sobre(-5), recVsMedianaPct: -5 }, "sin_descuento"],
  ];
  for (const [k, p, esperado] of casos) { const got = casoPagas(p); if (got !== esperado) F(`3 · ${k}: esperaba ${esperado}, dio ${got}`); }
  // …y el modelo entero mueve «con qué» con el caso
  const mMerc = construirComoLoPagas(entrada({ distancia: dv({ mixPalancas: mix({ descuentoPct: 6 }) }), sobre: sobre(56, { medianaComunaUfM2: 55.3, sujetoUfM2: 86.2 }), precioUF: 2845, superficieM2: 33 }));
  if (mMerc.caso !== "mercado" || !mMerc.pasos.some((p) => p.k === "Con qué" && /Tu argumento es el mercado\./.test(texto(p.segs)))) F(`3 · mercado debía abrir con «Tu argumento es el mercado.» (caso ${mMerc.caso})`);
  const mCaja = construirComoLoPagas(entrada({ distancia: dv({ mixPalancas: mix({ descuentoPct: 4.9 }) }), sobre: sobre(-19) }));
  if (mCaja.caso !== "caja" || !mCaja.pasos.some((p) => p.k === "Con qué" && /Tu argumento es tu caja, no el mercado\./.test(texto(p.segs)))) F(`3 · caja debía abrir con «Tu argumento es tu caja» (caso ${mCaja.caso})`);
  const mDif = construirComoLoPagas(entrada({ distancia: dv({ mixPalancas: mix({ descuentoPct: 12.9 }) }), sobre: sobre(-17) }));
  if (mDif.caso !== "dificil_sin_evidencia" || !mDif.pasos.some((p) => p.k === "Con qué" && /No hay argumento de mercado\./.test(texto(p.segs)))) F("3 · difícil sin evidencia debía abrir con «No hay argumento de mercado.»");
  if (!mDif.pasos.some((p) => p.k === "Si no cede")) F("3 · en difícil el paso «Si no cede» es obligatorio");
  if (mCaja.pasos.some((p) => p.k === "Si no cede")) F("3 · en caja sin alternativa no va «Si no cede»");
  const mAlt = construirComoLoPagas(entrada({ alternativa: "En Puente Alto o Conchalí un departamento como este sí convendría." }));
  if (!mAlt.pasos.some((p) => p.k === "Si no cede" && /Puente Alto/.test(texto(p.segs)))) F("3 · con alternativa de comunas, «Si no cede» la cita");

  // 4 · la copia fijada
  const hd = pasoHastaDonde({ limiteTirUF: 10664, mesCierraUF: 8656, precioUF: 10500 });
  if (texto(hd?.segs ?? []) !== "Sobre UF 10.664 la TIR a 10 años baja del 6%: ahí conviene más otro tipo de inversión. Y el flujo mensual es positivo recién en UF 8.656, 18% bajo tu precio — no es el número a pelear, es el marco.") F(`4 · «Hasta dónde» no tiene la redacción fijada: «${texto(hd?.segs ?? [])}»`);
  const hdSinTir = pasoHastaDonde({ limiteTirUF: null, mesCierraUF: 7558, precioUF: 8900 });
  if (!texto(hdSinTir?.segs ?? []).startsWith("El flujo mensual es positivo recién en UF 7.558, 15% bajo tu precio")) F("4 · sin límite TIR la frase arranca en el flujo");
  const hdSin = pasoHastaDonde({ limiteTirUF: 2813, mesCierraUF: 1527, precioUF: 2500, sinSalida: true });
  if (/TIR/.test(texto(hdSin?.segs ?? [])) || !/no es una oferta, es la medida del problema/.test(texto(hdSin?.segs ?? []))) F("4 · en sin salida no va la TIR y el cierre es «la medida del problema»");
  if (pasoHastaDonde({ limiteTirUF: null, mesCierraUF: null, precioUF: 3000 }) !== null) F("4 · sin límite ni mes no hay paso");
  const cx = construirComoLoPagas(entrada({})).capex; const cxStr = construirComoLoPagas(entrada({ modalidad: "STR" })).capex;
  const intro = texto(cx?.intro ?? []); const introStr = texto(cxStr?.intro ?? []);
  if (!intro.startsWith("Antes de cobrar hay que gastar")) F("4 · la puesta a punto abre con la razón, no con el monto");
  if (intro.indexOf("el arriendo que el análisis asume") < 0 || intro.indexOf("el arriendo que el análisis asume") > intro.indexOf("UF 214")) F("4 · la razón (arriendo de mercado) va ANTES del monto");
  if (!/tarifa por noche/.test(introStr) || /arriendo que el análisis/.test(introStr)) F("4 · en STR la razón es la tarifa por noche");
  if (!/más de un quinto/.test(intro)) F("4 · con fracción ≥ 20% la intro lo dice");
  const f = construirComoLoPagas(entrada({})).franja!;
  if (!/avisos, no de transacciones/.test(notaFranja(f, "Ñuñoa"))) F("4 · la nota del ⓘ dice «avisos, no de transacciones»");
  if (!/departamentos usados/.test(notaFranja(f, "Ñuñoa"))) F("4 · la nota declara el universo cuando lo hay");
  // la fixture de −10% cae en `bajo_p25` (el borde va con el cuartil de abajo)
  if (!/en el cuarto más barato de tu comuna/.test(texto(fraseFranja(f)))) F(`4 · la frase de la franja usa la posición (dio «${texto(fraseFranja(f))}»)`);
  if (!/en la mitad central de tu comuna, del lado caro/.test(texto(fraseFranja({ ...f, posicion: "mediana_p75" })))) F("4 · la frase cambia con la posición");
  const fSinQ = fraseFranja({ ...f, p25UfM2: null, p75UfM2: null, posicion: null });
  if (!/10% bajo/.test(texto(fSinQ))) F("4 · sin cuartiles la frase cae a la desviación");
  if (Object.keys(POSICION_TEXTO).length !== 4) F("4 · cuatro posiciones, cuatro textos");
  const mC = construirComoLoPagas(entrada({ veredicto: "COMPRAR", distancia: null, precioMaximoComprarUF: 3300, caeA: "AJUSTA SUPUESTOS" }));
  if (mC.caso !== "comprar" || mC.tituloBloque2 !== "Qué margen tienes" || !mC.pasos.some((p) => p.k === "Hasta dónde" && /Sigue siendo Comprar hasta UF 3\.300 \(\+10,0%\); sobre eso cae a Ajustar/.test(texto(p.segs)))) F("4 · COMPRAR muestra el margen con a dónde cae");
  // el puente (21-sep): COMPRAR con el metro caro retoma el argumento del mercado; barato o en línea, no
  const pideC = texto(mC.pasos.find((p) => p.k === "Qué pides")?.segs ?? []);
  if (!/^Nada: a UF 3\.000 el caso ya es Comprar\. Cierra al precio pedido\.$/.test(pideC) || /argumento del mercado/.test(pideC)) F(`4 · COMPRAR con el metro barato cierra al precio pedido, sin puente (dio «${pideC}»)`);
  const mCaro = construirComoLoPagas(entrada({ veredicto: "COMPRAR", distancia: null, sobre: sobre(12) }));
  const pideCaro = texto(mCaro.pasos.find((p) => p.k === "Qué pides")?.segs ?? []);
  if (pideCaro !== "Nada que necesites: a UF 3.000 el caso ya cierra. Si igual quieres negociar, tienes el argumento del mercado: el vendedor pide 12% más que la mediana de 120 avisos comparables de usados en Ñuñoa.") F(`4 · COMPRAR con el metro caro retoma el argumento del mercado (dio «${pideCaro}»)`);
  const mLinea = construirComoLoPagas(entrada({ veredicto: "COMPRAR", distancia: null, sobre: sobre(1) }));
  if (/argumento del mercado/.test(texto(mLinea.pasos.find((p) => p.k === "Qué pides")?.segs ?? []))) F("4 · COMPRAR con el metro en línea no lleva puente");
  const mPin = construirComoLoPagas(entrada({}));
  if (mPin.franja?.recUfM2 == null || Math.abs(mPin.franja.recUfM2 - (3000 * 0.9) / 30) > 1e-9) F("4 · el pin del recomendado es el precio recomendado en UF/m²");
  if (mSin.franja?.recUfM2 !== null) F("4 · sin recomendación no hay pin del recomendado");

  // 5 · la frase del hallazgo por cuartil
  const conQ = buildHallazgoSobreprecio(buildPrecioVsComuna({ sujetoUfM2: 112, medianaComunaUfM2: 100, confiable: true, n: 120, universo: "usado", p25UfM2: 90, p75UfM2: 110 }), 0.5, 0.5, "Ñuñoa");
  if (conQ?.titular !== "Pagas el metro en el cuarto más caro de la comuna.") F(`5 · con posición sobre_p75 el titular nombra el cuarto (dio «${conQ?.titular}»)`);
  if (!/está en el cuarto más caro de la comuna: la mediana de 120 publicaciones de departamentos usados de la comuna es UF 100,0 y la mitad de los avisos comparables va de UF 90,0 a UF 110,0\./.test(conQ?.fraseCanonica ?? "")) F(`5 · la fraseCanonica por cuartil (dio «${conQ?.fraseCanonica}»)`);
  if (conQ?.direccion !== "adverso") F("5 · la dirección sigue por desviación");
  const sinQ = buildHallazgoSobreprecio(buildPrecioVsComuna({ sujetoUfM2: 112, medianaComunaUfM2: 100, confiable: true, n: 120, universo: "usado" }), 0.5, 0.5, "Ñuñoa");
  if (sinQ?.titular !== "Estás pagando caro el metro para esta comuna.") F("5 · sin cuartiles el titular es el de siempre, byte-idéntico");
  const bajo = buildHallazgoSobreprecio(buildPrecioVsComuna({ sujetoUfM2: 80, medianaComunaUfM2: 100, confiable: true, n: 120, universo: "usado", p25UfM2: 90, p75UfM2: 110 }), 0.5, 0.5, "Ñuñoa");
  if (bajo?.titular !== "Entras en el cuarto más barato de la comuna." || bajo.direccion !== "favorable") F("5 · bajo_p25: «Entras en el cuarto más barato de la comuna.» y favorable");

  // 6 · cableado, acotado al símbolo
  const src = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");
  const ltr = src("src/components/analysis/CapitulosInversion.tsx"), str = src("src/components/analysis/str/CapitulosInversionStr.tsx");
  for (const [nombre, s] of [["LTR", ltr], ["STR", str]] as const) {
    if (!/construirComoLoPagas\(\{/.test(s) || !/<CapituloComoLoPagas modelo=\{modeloPagas\}/.test(s)) F(`6 · ${nombre} no monta el capítulo nuevo`);
    // Acotado a las líneas de IMPORT: las actas del capítulo nombran las piezas retiradas
    // a propósito, y un guard sobre el archivo entero las leería como cableado.
    if (/^import .*\b(DrawerNegociacion|PlanNegociacion|EstructuraComparada|LineaPlazo|simularPlazo)\b/m.test(s)) F(`6 · ${nombre} sigue importando piezas retiradas`);
  }
  const lib = src("src/lib/como-lo-pagas.ts");
  if (/mixPalancasHastaComprar \?\?|\?\? (dv|v)\.mixPalancas\b/.test(lib)) F("6 · como-lo-pagas.ts no puede tener un fallback al escalón");
  if (!/from "\.\/mix-a-comprar"/.test(lib)) F("6 · como-lo-pagas.ts lee mixAComprar de la lib");
  const popup = src("src/components/analysis/shared/PopupAjustes.tsx");
  if (!/import \{ mixAComprar, solasAComprar \} from "@\/lib\/mix-a-comprar"/.test(popup) || /^function mixAComprar/m.test(popup)) F("6 · el pop-up importa mixAComprar de la lib y no lo define");
  const drawer = src("src/components/ui/AnalysisDrawer.tsx");
  if (/export function (DrawerNegociacion|PlanNegociacion)\b/.test(drawer)) F("6 · el drawer de negociación y el plan tienen que estar retirados");
  const strH = src("src/lib/str-hallazgos.ts");
  if (!/universo: ctx\.mediana\.universo/.test(strH)) F("6 · STR pasa el universo al sobreprecio");
}

export function runComoLoPagasTier(): { hard: number } {
  fallas.length = 0;
  tierPuro();
  if (fallas.length === 0) {
    console.log("   como-lo-pagas ✓ (el ancla es mixAComprar sin escalón, seis casos, la copia fijada, la frase por cuartil, cableado)");
  } else {
    console.log(`   como-lo-pagas ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  }
  return { hard: fallas.length };
}

async function sondaViva() {
  const { createClient } = await import("@supabase/supabase-js");
  const { recomputeShortTermForLegacy } = await import("../../../src/lib/analysis/recompute-short-term-for-legacy");
  const { prefetchMedianaComunaVenta } = await import("../../../src/lib/api-helpers/analisis-pipeline");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const { data } = await sb.from("analisis").select("id, input_data, results, created_at").eq("tipo_analisis", "short-term").not("results", "is", null).order("created_at", { ascending: false }).limit(5);
  type Fila = { id: string; input_data: Record<string, unknown>; results: Parameters<typeof recomputeShortTermForLegacy>[1]; created_at: string };
  for (const row of (data ?? []) as Fila[]) {
    const input = row.input_data as { precioCompra?: number; precioCompraUF?: number; comuna?: string; superficieUtil?: number; dormitorios?: number; tipoPropiedad?: string; antiguedad?: number };
    if (typeof input.precioCompra !== "number") continue;
    const uf = (input.precioCompraUF ?? 0) > 0 ? input.precioCompra / (input.precioCompraUF as number) : 39000;
    const viva = await prefetchMedianaComunaVenta(sb, { comuna: input.comuna ?? "", superficie: Number(input.superficieUtil) || 0, dormitorios: Number(input.dormitorios) || 0, esNuevo: input.tipoPropiedad === "nuevo", antiguedad: typeof input.antiguedad === "number" ? input.antiguedad : undefined } as Parameters<typeof prefetchMedianaComunaVenta>[1], uf);
    if (viva.mediana == null) continue;
    const r = recomputeShortTermForLegacy(input, row.results, uf, new Date(row.created_at), viva);
    const s = (r?.hallazgos ?? []).find((h) => h.id === "sobreprecio") as HallazgoSobreprecio | undefined;
    console.log(`   vivo · STR ${row.id.slice(0, 8)} · universo ${s?.valor.universo ?? "—"} · posición ${s?.valor.posicion ?? "—"} · «${s?.titular}»`);
    if (!s?.valor.universo) fallas.push("vivo · el sobreprecio STR debía declarar universo");
    return;
  }
  fallas.push("vivo · no hubo fila STR con mediana para la sonda");
}

if (require.main === module) {
  (async () => {
    runComoLoPagasTier();
    await sondaViva();
    if (fallas.length) { console.log(`\n✗ ${fallas.length} falla(s)`); process.exit(1); }
    console.log("\n✓ como-lo-pagas: tier puro + sonda viva en verde");
  })().catch((e) => { console.error(e); process.exit(1); });
}
