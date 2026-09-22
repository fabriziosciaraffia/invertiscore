"use client";

import { useMemo } from "react";
import { serieFlujoMensualPorAnio, type ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { Hallazgo, HallazgoDistanciaVeredicto, HallazgoPuestaAPunto, HallazgoRentabilidadStr, HallazgoSensibilidadStr, HallazgoSobreprecio, Veredicto } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import type { SimulacionStr, FronteraLado } from "@/lib/analysis/simular-str";
import { argsCierresStr, cierresStr, type EntradaCierresStr } from "@/lib/cierres-str-ensamblador";
import type { FmtCierre } from "@/lib/cierres-capitulos";
import { CAP_STR_UMBRAL_PCT } from "@/lib/rentabilidad-str-hallazgo";
import { NOMBRE_RENTABILIDAD, explicacionUmbralStr, fuenteUmbralStr } from "@/lib/capref-copy";
import { barraDia1 } from "@/lib/plata-dia1";
import { costoOportunidad, calcDividendo } from "@/lib/analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { HallazgosAcordeon, type FilaHallazgo } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { VProsa, VViz, VSub, VPuente, VCierre, VFuente, Thermo, Dial, BarraApilada, type ZonaDial, type BordeDial } from "@/components/analysis/hallazgos/vocabulario";
import { construirComoLoPagas } from "@/lib/como-lo-pagas";
import { CapituloComoLoPagas } from "@/components/analysis/shared/CapituloComoLoPagas";
import { nombreVeredicto, FilaDato, FilasDato, CurvaAnual, CurvaAnios, CurvaPatrimonio, BloqueDia1, SegsCierre, type PuntoAnio } from "@/components/analysis/shared";
import { fraseReparto } from "@/lib/reparto-ingreso";
import { conApellido } from "@/components/analysis/CapitulosInversion";

/**
 * LA INVERSIÓN · STR — los seis capítulos del CONGELADO (T1 · 04-sep-2026):
 *   I Cuánto renta · II Tu flujo mensual · III Cuántas noches necesitas · IV Cómo lo
 *   pagas · V Cómo lo gestionas · VI Tu resultado a 10 años.
 * Cáscara propia (LTR intacto en CapitulosInversion): arma `FilaHallazgo[]` y monta el
 * mismo acordeón con `variante="capitulo"` y `tipo="str"` (telemetría
 * `informe_capitulo_abierto` con tipo str). Todo lee del motor T0: `metrics`,
 * `simulacionStr` (fronteras + matrices), `cierresStr` y las `vias` del hallazgo de
 * distancia. Nada se calcula ni se bisecciona acá: las cifras derivadas salen de
 * `argsCierresStr`, la misma fuente de los cierres.
 * Fallback por pieza: sin `metrics` o sin simulación (filas sin airbnbRaw) cada viz que
 * los necesita no se dibuja; el capítulo sigue con lo que tiene.
 */
export type CapituloStrId = "renta" | "flujo" | "noches" | "pagas" | "gestion" | "resultado";

/* CAPITULO_DE_HALLAZGO_STR SE RETIRA CON ACTA (09-sep-2026).
 * Mapeaba cada hallazgo al capitulo donde vive su desarrollo, y su unico consumidor
 * era el atajo de la fila de hallazgos. Con la fila ya no clicable el mapa quedo sin
 * lector: un export vivo sin consumidor se lee como un vinculo que existe, y no existe.
 * Nada queda inalcanzable — cada capitulo es su propio boton en el acordeon. La
 * relacion hallazgo↔capitulo, si vuelve a hacer falta, esta en el historial. */
export const anchorCapituloStr = (id: CapituloStrId) => `cap-str-${id}`;

const ROMANO: Record<CapituloStrId, string> = { renta: "I", flujo: "II", noches: "III", pagas: "IV", gestion: "V", resultado: "VI" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const EN_PALABRAS = ["Ninguno", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Los doce"];
const tonoVeredicto = (v: Veredicto | string): ZonaDial["tono"] => (v === "COMPRAR" ? "comprar" : v === "AJUSTA SUPUESTOS" ? "ajusta" : "buscar");
// `nombreVeredicto` vive en la pieza compartida (Matriz.tsx) desde el goal "cruza por veredicto".

/** Zonas y bordes del dial a partir de las dos fronteras del motor (una bisección en el
 *  server). El eje es el factor sobre el valor actual; las zonas se cortan en las
 *  fronteras y el veredicto de cada tramo es el que el motor dice. */
function dialDesdeFronteras(base: Veredicto | string, abajo: FronteraLado | null, arriba: FronteraLado | null, fmtBorde: (f: FronteraLado, dir: "abajo" | "arriba") => { v: string; k: string }) {
  const lo = Math.min(0.7, abajo ? abajo.factor - 0.05 : 0.8);
  const hi = Math.max(1.3, arriba ? arriba.factor + 0.05 : 1.2);
  const pos = (f: number) => ((f - lo) / (hi - lo)) * 100;
  const zonas: ZonaDial[] = [];
  const bordes: BordeDial[] = [];
  let cursor = lo;
  if (abajo) {
    zonas.push({ k: nombreVeredicto(abajo.veredicto), pct: pos(abajo.factor) - pos(cursor), tono: tonoVeredicto(abajo.veredicto) });
    cursor = abajo.factor;
    const b = fmtBorde(abajo, "abajo");
    bordes.push({ pos: pos(abajo.factor), delta: `−${((1 - abajo.factor) * 100).toFixed(1).replace(".", ",")}%`, v: b.v, k: b.k, dir: "abajo" });
  }
  const finBase = arriba ? arriba.factor : hi;
  zonas.push({ k: nombreVeredicto(base), pct: pos(finBase) - pos(cursor), tono: tonoVeredicto(base) });
  if (arriba) {
    zonas.push({ k: nombreVeredicto(arriba.veredicto), pct: pos(hi) - pos(arriba.factor), tono: tonoVeredicto(arriba.veredicto) });
    const b = fmtBorde(arriba, "arriba");
    bordes.push({ pos: pos(arriba.factor), delta: `+${((arriba.factor - 1) * 100).toFixed(1).replace(".", ",")}%`, v: b.v, k: b.k, dir: "arriba" });
  }
  return { zonas, bordes, marcaPct: pos(1) };
}

export function CapitulosInversionStr({
  results,
  francoScore,
  hallazgos,
  simulacion,
  inputData,
  currency,
  valorUF,
  comuna,
  createdAt,
  veredicto,
  accessLevel,
  abrir,
}: {
  results: ShortTermResult;
  francoScore: FrancoScoreSTR;
  hallazgos: Hallazgo[];
  simulacion: SimulacionStr | null;
  inputData: Record<string, unknown> | null;
  currency: "CLP" | "UF";
  valorUF: number;
  comuna: string;
  createdAt?: string;
  veredicto: string;
  accessLevel: string;
  abrir?: { id: string; nonce: number } | null;
}) {
  const m = results.metrics;
  const base = results.escenarios.base;
  const exit = results.exitScenario;
  const modo: "auto" | "administrador" = inputData?.modoGestion === "administrador" ? "administrador" : "auto";
  const dist = hallazgos.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const sobre = hallazgos.find((h): h is HallazgoSobreprecio => h.id === "sobreprecio");
  const hRenta = hallazgos.find((h): h is HallazgoRentabilidadStr => h.id === "rentabilidad_str");
  const sensStr = hallazgos.find((h): h is HallazgoSensibilidadStr => h.id === "sensibilidad_str");

  // ── formato (dueño de moneda y UF): los cierres siguen el toggle ──
  const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
  const money = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") {
      const uf = abs / (valorUF || 1);
      return "UF " + (uf >= 100 ? Math.round(uf).toLocaleString("es-CL") : pct1(uf));
    }
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  // Contrato §7 (bloque C · 11-sep-2026): las seis filas llevan su cifra APELLIDADA —Cap
  // rate · Flujo · Al año · Precio · vs arriendo largo · Resultado—, con el helper de LTR.
  const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${money(n)}`;
  const neg = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;
  const compact = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") return "UF " + Math.round(abs / (valorUF || 1)).toLocaleString("es-CL");
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace(".", ",")} MM`;
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const ufTxt = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
  const f: FmtCierre = { money, compact, pct1: (n) => pct1(n) };
  const fecha = fechaCortaCL(createdAt);
  const ufFecha = `UF ${Math.round(valorUF).toLocaleString("es-CL")}${fecha ? ` al ${fecha}` : ""}`;

  const entrada: EntradaCierresStr = useMemo(
    () => ({ result: results, francoScore, hallazgos, simulacion, comuna, ufValue: valorUF, modoGestion: modo }),
    [results, francoScore, hallazgos, simulacion, comuna, valorUF, modo],
  );
  const args = useMemo(() => argsCierresStr(entrada), [entrada]);
  const cierres = useMemo(() => cierresStr(entrada, f), [entrada, currency, valorUF]); // eslint-disable-line react-hooks/exhaustive-deps

  const adr = args.renta.adr;
  const occ = args.noches.ocupacionPct / 100;
  const noches = args.noches.noches;
  const ingreso = m?.ingresoEstabilizadoMensual ?? base.ingresoBrutoMensual;
  // Misma fuente que usaba el ensamblador para el cierre II, ahora retirado.
  const flujo = m?.flujoMensual ?? base.flujoCajaMensual;

  // La serie del gráfico de diez años. LA DERIVACIÓN LA HACE EL MOTOR
  // (`serieFlujoMensualPorAnio`), no este render: ahí están las dos decisiones —÷12 y no
  // dibujar los años sin operación— con su medición, y ahí las lee el gate. Si se
  // recalculara acá, mutar el motor dejaría el gate en verde.
  const serieAnios: PuntoAnio[] = serieFlujoMensualPorAnio(results.projections).map((p) => ({
    anio: p.anio,
    v: p.flujoMensualPromedio,
  }));
  const cap = args.renta.capPct;
  const precioCLP = results.pie + results.montoCredito;
  const precioUF = valorUF > 0 ? precioCLP / valorUF : 0;
  const piePct = Number(inputData?.piePct) || (precioCLP > 0 ? (results.pie / precioCLP) * 100 : 0);
  const plazo = Number(inputData?.plazoCredito) || 0;
  const tasa = Number(inputData?.tasaInteres) || 0;
  const fr = simulacion?.fronterasIngreso ?? null;
  const adrEsTuya = results.adrFuente === "override";
  const occEsTuya = results.occFuente === "override";
  const vsComuna = results.zonaSTR?.ocupacionVsComuna ?? null;
  const comunaOcc = results.zonaSTR?.comunaOcupacion ?? null;
  const vsTxt = vsComuna === "mas" ? "más que" : vsComuna === "menos" ? "menos que" : vsComuna === "similar" ? "parecido a" : null;

  // ═══════════════ I · CUÁNTO RENTA ═══════════════
  // Habla AL USUARIO (21-sep-2026): «Rentabilidad», sin «cap rate», contra lo que proyectan los
  // Airbnb de la misma comuna y tipología (strref-zona.ts + rentabilidad-str-hallazgo.ts): el
  // número y la fuente en una línea. La tarifa que hace falta al centro, el dial desde las
  // fronteras, el break-even en una frase con su banda. Salen: la tabla tarifa × ocupación (tres
  // de las seis cifras del hero), el termómetro y la matriz (es del capítulo II).
  // SIN REFERENCIA (nivel «sin_referencia»): el capítulo lo dice y NO compara — ni centro «para
  // rendir X», ni cruce contra el umbral, ni rojo en el valor; el 5% de respaldo es del motor,
  // no del informe. Quedan el dial de la tarifa y el break-even, que no dependen de la referencia.
  const filaI: FilaHallazgo = (() => {
    const umbral = hRenta?.valor.umbralPct ?? CAP_STR_UMBRAL_PCT;
    const refTxt = `${pct1(umbral)}%`;
    const vRef = { nivel: hRenta?.valor.nivel ?? "sin_referencia", comuna: hRenta?.valor.comuna ?? comuna, celdaDormitorios: hRenta?.valor.celdaDormitorios ?? null } as const;
    const hayRef = vRef.nivel !== "sin_referencia";
    const adrRef = args.renta.adrRef;
    const holgura = adrRef <= adr;
    const dial = fr ? dialDesdeFronteras(veredicto, fr.abajo, fr.arriba, (fl, dir) => ({ v: `${money(adr * fl.factor)} por noche`, k: `y ${dir === "abajo" ? "cae" : "sube"} a ${nombreVeredicto(fl.veredicto)}` })) : null;
    const colchon = fr?.abajo ? adr - adr * fr.abajo.factor : null;
    const occPct = Math.round(occ * 100);
    const cobras = adrEsTuya ? <>Cobras <b>{money(adr)}</b> por noche, un dato tuyo, al {occPct}% de ocupación ({money(ingreso)} al mes)</> : <>El sector tiene una tarifa de <b>{money(adr)}</b> por noche al {occPct}% de ocupación ({money(ingreso)} al mes)</>;
    // El break-even (sensibilidad_str) se lee antes: la copy de COMPRAR bajo el umbral lo cita.
    const be = sensStr ? Math.round(sensStr.valor.beRatioPct) : null;
    const cruce = holgura
      ? <>{cobras}: llegarías a la rentabilidad de referencia ({refTxt}) incluso cobrando <b>{money(adr - adrRef)} menos</b> por noche.</>
      : veredicto === "COMPRAR" && cap < umbral
        // COMPRAR bajo la referencia de la comuna (decisión de Fabrizio, 21-sep-2026): no se dice
        // «apuesta». Se nombra la tensión —rinde algo menos de lo que Franco pide para renta corta
        // en esa zona— y por qué no cambia el veredicto: el caso cierra igual y el break-even lo
        // confirma. Misma resolución que el «cuarto más caro» en COMPRAR.
        ? <>{cobras}: rinde algo menos de lo que Franco pide para una renta corta en {vRef.comuna} ({refTxt}), y el caso cierra igual. {be !== null ? (be <= 100 ? <>Lo confirma el punto de equilibrio: cuadras facturando el {be}% de lo que rinde la zona.</> : <>El punto de equilibrio, más abajo, dice con cuánto margen: necesitas facturar el {be}% de lo que rinde la zona.</>) : <>Lo que deja cada mes lo sostiene.</>}</>
        : <>{cobras}: para una rentabilidad de {refTxt} hacen falta <b>{money(adrRef - adr)} más</b> por noche, un <span className="neg">+{Math.round((adrRef / adr - 1) * 100)}%</span> sobre lo que paga la zona. No es un supuesto tuyo: es una apuesta a rendir sobre el mercado.</>;
    // 3 · el break-even, dicho en una frase (la del hallazgo) y en una barra con las puertas.
    const beBar = (() => {
      if (!sensStr || be === null) return null;
      const fr1 = sensStr.valor.corteFragil, inv = sensStr.valor.corteInviable ?? 130, fav = sensStr.valor.corteFavorable;
      const lo = Math.min(70, be - 5), hi = Math.max(150, be + 5);
      const pos = (x: number) => ((Math.min(Math.max(x, lo), hi) - lo) / (hi - lo)) * 100;
      const zonas: ZonaDial[] = [
        { k: "hay colchón", pct: pos(fav) - pos(lo), tono: "comprar" },
        { k: "poco margen", pct: pos(fr1) - pos(fav), tono: "ajusta" },
        { k: "frágil", pct: pos(inv) - pos(fr1), tono: "ajusta" },
        { k: "no cierra", pct: pos(hi) - pos(inv), tono: "buscar" },
      ];
      const bordes: BordeDial[] = [
        { pos: pos(fr1), delta: `+${fr1 - 100}%`, v: "sobre la zona", k: "frágil", dir: "abajo" },
        { pos: pos(inv), delta: `+${inv - 100}%`, v: "sobre la zona", k: "no cierra", dir: "arriba" },
      ];
      return <Dial zonas={zonas} bordes={bordes} marcaPct={pos(be)} marcaK="Tu equilibrio" marcaV={`${be}% de la zona`} />;
    })();
    return {
      id: "renta",
      numero: ROMANO.renta,
      pregunta: "Cuánto renta",
      valor: conApellido(NOMBRE_RENTABILIDAD.str, `${pct1(cap)}%`),
      valorRojo: hayRef && cap < umbral,
      ksub: hayRef ? `referencia ${refTxt}` : "sin referencia en la zona",
      anchorId: anchorCapituloStr("renta"),
      cuerpo: (
        <div>
          {hayRef ? (
            <VViz t={`Para rendir como la referencia: ${refTxt}`}>
              <p className="v-explica">{explicacionUmbralStr(vRef)}</p>
              <div className="v-centro">
                <div className="hoy">
                  <div className="k">{adrEsTuya ? "Tu tarifa" : "La zona cobra"}</div>
                  <div className="n">{money(adr)}<small>/noche · rinde {pct1(cap)}%</small></div>
                </div>
                <div className="fl">→</div>
                <div>
                  <div className="k">Para rendir {refTxt}</div>
                  <div className="n">{money(adrRef)}<small>/noche · {Math.round(Math.abs(adrRef / adr - 1) * 100)}% {holgura ? "menos" : "más"}, a la misma ocupación</small></div>
                </div>
              </div>
              <p className="v-cruce">{cruce}</p>
            </VViz>
          ) : (
            <VViz t="Qué rinde, sin referencia de la zona">
              <p className="v-explica">{explicacionUmbralStr(vRef)}</p>
              <p className="v-cruce">{cobras}: rinde <b>{pct1(cap)}%</b> sobre el precio, después de operar. No hay Airbnb suficientes de {vRef.comuna} en nuestra base para decir si eso es mucho o poco para la zona, así que este capítulo no lo compara. Lo que sí se puede leer es cuánto aguanta la tarifa y cuánto tienes que facturar para no perder plata.</p>
            </VViz>
          )}
          {dial && (
            <VViz t="Cuánto aguanta la tarifa antes de que cambie el veredicto">
              <Dial zonas={dial.zonas} bordes={dial.bordes} marcaPct={dial.marcaPct} marcaK={adrEsTuya ? "Tu tarifa" : "Mediana de la zona"} marcaV={money(adr)} />
              {colchon != null && (
                <div className="compo-total">
                  <span className="k">Colchón hasta el borde de abajo</span>
                  <span className="v">
                    {money(colchon)} <small>/noche</small>
                  </span>
                </div>
              )}
            </VViz>
          )}
          {sensStr && beBar && (
            <VViz t="Cuánto tienes que facturar para no perder plata">
              <p className="v-cruce"><b>{sensStr.titular}</b> {sensStr.fraseCanonica}</p>
              {beBar}
            </VViz>
          )}
          <VFuente>
            {fuenteUmbralStr(vRef)} Tarifa {adrEsTuya ? "definida por ti" : "de los avisos de la zona"}; ocupación {occEsTuya ? "definida por ti" : "estimada para este depto"}.
          </VFuente>
        </div>
      ),
    };
  })();
  // ═══════════════ II · TU FLUJO MENSUAL ═══════════════
  const filaII: FilaHallazgo = (() => {
    const fl = m?.desgloseFall ?? null;
    const reparto = m?.repartoIngreso ?? null;
    // ⛔ EL 20% SALÍA DE UN LITERAL EN EL RENDER (`Math.round(ingreso * 0.2)`), no del motor.
    // Hoy no mordía porque `state.adminPct` no lo escribe ningún componente del wizard
    // —aparece solo en `nuevo-v2/page.tsx:492-493`— así que `comisionAdministrador` siempre
    // cae al default. Pero era una SEGUNDA VERDAD sobre la misma cifra: el motor la calcula
    // con `input.comisionAdministrador` y acá se recalculaba con otra constante. El día que
    // el wizard pregunte la comisión (ver cola-wizard-comision-str-escondida), este capítulo
    // habría dicho 20% con cualquier valor declarado.
    const q = results.comparativa.quiebreGestion ?? null;
    const escAuto = results.comparativa.str_auto;
    const escAdmin = results.comparativa.str_admin;
    const comAdminPct = q ? Math.round(q.comisionAdminDec * 100) : 20;
    const adminMonto = q ? q.comisionMensual : escAdmin.comisionMensual;
    return {
      id: "flujo",
      numero: ROMANO.flujo,
      pregunta: "Tu flujo mensual",
      valor: conApellido("Flujo", signed(flujo)),
      valorRojo: flujo < 0,
      ksub: `de los ${money(ingreso)} del ingreso, después de comisión, costos y cuota`,
      anchorId: anchorCapituloStr("flujo"),
      cuerpo: (
        <div>
          {/* LA BAJADA SALIÓ, Y CON ELLA EL RÓTULO «Qué pasa con los $X del ingreso»
              (16-sep-2026). Las dos decían lo que la tabla de abajo ya dice fila por fila —
              qué entra, qué sale y qué queda—, y el rótulo además repetía el ingreso, que es
              la primera fila. La bajada anunciaba una lista que empieza tres líneas más
              abajo; la tabla no necesita que se la presente. */}
          <VViz>
            {/* El sub declara QUÉ MES es éste. Antes esto vivía en el cierre en prosa, al
                final de una cláusula («…con la ocupación estimada»), y el lector llegaba a
                la tabla sin saber si miraba el primer mes o uno cualquiera. Es el mes
                ESTABILIZADO —después del ramp-up— y a precios de hoy, sin inflación. */}
            <VSub>Lo que entra y lo que sale en un mes estabilizado, a precios de hoy</VSub>
            {/* LA BARRA DE TRAMOS SALIÓ Y NO SE REEMPLAZA POR OTRO GRÁFICO (16-sep-2026).
              No se fue por fea: **cambiaba de unidad a mitad del parque sin avisar**. Su escala
              era `max(ingreso, costosOperar + cuota)`, así que mientras la cuota cabe en el
              ingreso el ancho del negro decía «qué fracción de lo que ENTRA se lleva la cuota»,
              y cuando no cabe pasaba a decir «qué fracción de lo que SALE es la cuota». Medido:
              la cuota supera el 100%% del ingreso en más de la mitad de las filas LTR (p50 =
              110%%), o sea que el segundo modo era la mayoría. Y encima el negro se dibujaba
              ENCIMA de la banda gris, así que el gris dejaba de leerse como continente.
              Lo que la barra intentaba decir ahora está escrito, que es lo único que este
              capítulo no decía: qué se lleva la plata. El reparto lo emite el MOTOR
              (`metrics.repartoIngreso`), no el render. */}
            {reparto && (() => {
              const f = fraseReparto(reparto, "operar el depto", money);
              return (
                <p className="doc-reparto">
                  {f.antes}
                  <b style={f.sale ? { color: "var(--signal-red)" } : undefined}>{f.monto}</b>
                  {f.despues}
                </p>
              );
            })()}
            {fl ? (
              <FilasDato>
                <FilaDato tono="in" k="Ingreso mensual" tip="Tarifa por noche × ocupación × 365 ÷ 12" sub="lo que factura un mes típico con la ocupación estimada" v={money(fl.ingreso)} unidad="/mes" />
                {/* EL SUB SE ADAPTA AL MODO Y EL ⓘ DEJA DE REPETIRLO (16-sep-2026).
                  Decía «3% del ingreso» en el sub y «La plataforma cobra 3% al anfitrión» en el
                  tooltip: el mismo hecho dos veces, y las dos veces FALSO en modo administrador,
                  donde esta fila vale $0. Medido: 14 de 252 filas (5,6%) mostraban «$0» con dos
                  explicaciones insistiendo en un 3%.
                  El precedente estaba dos líneas abajo: la fila «Administrador» ya adapta su sub
                  al modo y su ⓘ dice «si lo hubiera». Mismo tratamiento acá.
                  Y el ⓘ pasa a decir lo que el sub NO puede: que estas dos filas son UN SOLO
                  costo con dos nombres. En el motor son la misma variable —`base.comisionMensual`,
                  que se rotula `comisionPlataforma` en auto y `administrador` con operador
                  (short-term-engine.ts:1415-1416)—, así que una de las dos SIEMPRE vale cero y
                  nunca se suman. Eso es lo que el lector no puede deducir mirando la tabla. */}
                {/* LAS DOS FILAS DE $0 SE FUERON (fusión 17-sep-2026). Había una fila
                  «Comisión de la plataforma» y otra «Administrador», y una de las dos SIEMPRE
                  valía $0 —en el motor son la misma variable, `base.comisionMensual`, rotulada
                  `comisionPlataforma` en auto y `administrador` con operador
                  (short-term-engine.ts:1524-1525)—. La que valía cero llevaba encima un sub y
                  un ⓘ explicando un cobro que no existe. Ahora se muestra LA QUE SE COBRA, con
                  su nombre; la otra bajó al bloque del contrafáctico, donde es una alternativa
                  y no un cargo. */}
                <FilaDato
                  k={modo === "administrador" ? "Comisión del administrador" : "Comisión de la plataforma"}
                  tip={modo === "administrador"
                    ? `El administrador cobra ${comAdminPct}% del ingreso y reemplaza el 3% de la plataforma: no se suman.`
                    : "La plataforma cobra 3% al anfitrión. Con un administrador este cobro se reemplaza por su comisión, no se suma."}
                  sub={modo === "administrador" ? `${comAdminPct}% del ingreso` : "3% del ingreso"}
                  v={neg(-(fl.comisionPlataforma + fl.administrador))}
                  unidad="/mes"
                />
                <FilaDato k="Luz, agua, internet e insumos" tip="Costos directos declarados por ti" sub="limpieza y reposición incluidas en insumos" v={neg(-fl.costosDirectos)} unidad="/mes" />
                <FilaDato k="Gastos comunes y mantención" tip="Declarados por ti" v={neg(-fl.gastosComunesMantencion)} unidad="/mes" />
                <FilaDato k="Contribuciones" tip="Contribuciones ÷ 3" sub={`${money(fl.contribucionesMensuales * 3)} al trimestre`} v={neg(-fl.contribucionesMensuales)} unidad="/mes" />
                <FilaDato k="Cuota del crédito" tip="Dividendo del crédito hipotecario" sub={results.montoCredito > 0 ? `${compact(results.montoCredito)} a ${plazo} años al ${pct1(tasa)}%` : "sin crédito"} v={neg(-fl.cuota)} unidad="/mes" />
                <FilaDato tono="tot" k={fl.saleDeTuBolsillo < 0 ? "Sale de tu bolsillo" : "Te queda"} tip="Ingreso − comisión − costos − cuota" v={<span style={{ color: fl.saleDeTuBolsillo < 0 ? "var(--signal-red)" : undefined }}>{neg(fl.saleDeTuBolsillo)}</span>} unidad="/mes" />
              </FilasDato>
            ) : (
              <FilasDato>
                <FilaDato tono="in" k="Ingreso mensual" v={money(ingreso)} unidad="/mes" />
                <FilaDato k="Comisión y costos" v={neg(-(base.comisionMensual + base.costosOperativos))} unidad="/mes" />
                <FilaDato k="Cuota del crédito" v={neg(-results.dividendoMensual)} unidad="/mes" />
                <FilaDato tono="tot" k={flujo < 0 ? "Sale de tu bolsillo" : "Te queda"} v={neg(flujo)} unidad="/mes" />
              </FilasDato>
            )}
            {/* ═══ EL BLOQUE QUE BAJÓ DEL CAPÍTULO V (fusión 17-sep-2026) ═══
              El capítulo «Cómo lo gestionas» abría con esta comparación en INGRESO NETO,
              mientras el capítulo II hablaba en FLUJO, y las dos cifras del administrador se
              contradecían en el 100% de las filas. Acá hay una sola unidad —flujo, la del
              capítulo— y una sola definición del costo.

              LA SUMA CIERRA A TRES FILAS, NO A DOS. El mockup mostraba solo «un administrador
              cobra −$274.663» y el total, y un lector que restara obtenía $71.027 en vez de
              $112.226: faltaba el 3% que DEJA de pagarse. La fila del medio lo hace explícito,
              y de paso demuestra en aritmética lo que antes era una afirmación en un sub
              («reemplaza al 3%, no se suma»). Las dos comisiones son la MISMA variable del
              motor (short-term-engine.ts:1226, ternario), así que nunca coexisten.

              ⛔ SIN VERDE, Y NO POR CONTRASTE. `--doc-good` existe y `.drow.cruza` lo aplica,
              pero el VERDE NO ENTRÓ NUNCA a ninguna superficie del informe nuevo: el capítulo
              II pinta `--signal-red` lo que sale y deja en TINTA lo que queda, y esa es la
              doctrina viva (la fila total, abajo, hace exactamente eso). Un verde acá sería el
              único de la página, y encima pintaría de «bueno» la PEOR de las dos cifras.
              La comparación la carga el SUB («$233.464 menos al mes · $2.801.568 al año»), que
              es donde vive el juicio.
              Aparte —y esto es cola, no la razón— `--doc-good` en claro da 3,44-4,00:1 contra
              los tres papeles, bajo AA para 14px semibold. Ver cola-signal-red-contraste-oscuro. */}
            {fl && q && (
              <>
                <VPuente>{modo === "administrador" ? "Y si lo operaras tú:" : "Y si no vas a operarlo tú:"}</VPuente>
                <FilasDato>
                  {modo === "administrador" ? (
                    <>
                      <FilaDato k={`Dejas de pagar la comisión del ${comAdminPct}%`} tip="La comisión del administrador que hoy pagas" v={signed(adminMonto)} unidad="/mes" />
                      <FilaDato tono="neg" k="La plataforma te cobra su 3%" tip="Al operar tú, el cobro del administrador se reemplaza por el de la plataforma" v={signed(-escAuto.comisionMensual)} unidad="/mes" />
                      <FilaDato
                        tono="tot"
                        k="Te quedaría, operándolo tú"
                        tip="Mismo ingreso, mismos costos, misma cuota: solo cambia la comisión"
                        sub={`${money(Math.abs(q.sobrecostoMensual))} más al mes · ${money(Math.abs(q.sobrecostoAnual))} al año`}
                        v={<span style={{ color: escAuto.flujoCajaMensual < 0 ? "var(--signal-red)" : undefined }}>{neg(escAuto.flujoCajaMensual)}</span>}
                        unidad="/mes"
                      />
                    </>
                  ) : (
                    <>
                      <FilaDato tono="neg" k={`Un administrador cobra el ${comAdminPct}% del ingreso`} tip="Comisión del administrador sobre el ingreso bruto del mes" v={signed(-adminMonto)} unidad="/mes" />
                      <FilaDato k="Dejas de pagar el 3% de la plataforma" tip="El cobro del administrador reemplaza al de la plataforma: no se suman" v={signed(escAuto.comisionMensual)} unidad="/mes" />
                      <FilaDato
                        tono="tot"
                        k="Te quedaría, con administrador"
                        tip="Mismo ingreso, mismos costos, misma cuota: solo cambia la comisión"
                        sub={`${money(Math.abs(q.sobrecostoMensual))} menos al mes · ${money(Math.abs(q.sobrecostoAnual))} al año`}
                        v={<span style={{ color: escAdmin.flujoCajaMensual < 0 ? "var(--signal-red)" : undefined }}>{neg(escAdmin.flujoCajaMensual)}</span>}
                        unidad="/mes"
                      />
                    </>
                  )}
                </FilasDato>
              </>
            )}
          </VViz>
          {serieAnios.length >= 2 && (() => {
            const primero = serieAnios[0];
            const ultimo = serieAnios[serieAnios.length - 1];
            const minimo = serieAnios.reduce((a, b) => (b.v < a.v ? b : a));
            // El primer año operativo es el peor porque ahí cae la estabilización entera.
            // Se AFIRMA solo si el dato lo respalda: si el mínimo está en otro año, la frase
            // sería falsa y el capítulo estaría haciendo lo mismo que vino a corregir.
            const primeroEsElPeor = minimo.anio === primero.anio;
            // La estabilización en escala entendible: cuántos meses de facturación cuesta.
            // Se DERIVA (perdidaRampUp / ingreso); con STR_RAMP_UP actual da 1,5 exacto, pero
            // si la curva cambia el texto cambia solo.
            const mesesFact = ingreso > 0 ? results.perdidaRampUp / ingreso : 0;
            const enPalabras =
              Math.abs(mesesFact - 1.5) < 0.05
                ? "un mes y medio"
                : Math.abs(mesesFact - 1) < 0.05
                  ? "un mes"
                  : `${pct1(mesesFact).replace("%", "")} meses`;
            const sube = ultimo.v > primero.v;
            return (
              <>
                <VPuente>Y lo mismo a diez años, que es donde la estabilización deja de pesar.</VPuente>
                <VViz>
                  <VSub>Lo que queda cada mes, año por año</VSub>
                  <CurvaAnios puntos={serieAnios} fmt={(n) => neg(n)} />
                  <p className="doc-reparto" style={{ marginTop: 2 }}>
                    {primeroEsElPeor && mesesFact > 0 ? (
                      <>
                        El año {primero.anio} es el más duro: el aviso todavía no tiene reseñas y se ocupa
                        menos, y esa estabilización cuesta <b>{enPalabras} de facturación</b>.{" "}
                      </>
                    ) : null}
                    {sube
                      ? `Desde ahí el arriendo sube con la inflación y la deuda baja, así que cada año deja más que el anterior.`
                      : `De ahí en adelante la serie no mejora: el arriendo sube con la inflación, pero no alcanza a compensar lo que crecen los costos y la cuota.`}
                  </p>
                </VViz>
              </>
            );
          })()}
          {/* EL CIERRE EN PROSA SALIÓ ENTERO (16-sep-2026). Decía cuatro cosas y las cuatro
              están mejor dichas en otra parte: el monto lo dice la tabla (fila «Sale de tu
              bolsillo» / «Te queda»), el mes que es lo declara ahora el sub, la
              estabilización la absorbe el gráfico de diez años, y el contraste con el otro
              modo de gestión vive en el capítulo V — donde además viene con el punto de
              quiebre, que acá nunca estuvo.
              La comparación contra el arriendo largo («no es una sangría: es dos tercios de
              lo que te pediría el mismo depto arrendado largo») SE DEJA MORIR, por decisión y
              no por olvido: el capítulo V ya compara largo contra corto en su segunda mitad, y
              tener la misma comparación en dos capítulos CON DOS MÉTRICAS DISTINTAS —acá el
              flujo, allá el NOI— es peor que no tenerla en uno. Si al abrir el goal del V ese
              hilo queda flojo, se resuelve ahí, que es donde vive.

              ⛔ Y EL CIERRE VOLVIÓ, pero diciendo otra cosa (fusión 17-sep-2026). No es el
              cierre que se retiró: aquél reponía en prosa lo que la tabla mostraba. Éste dice
              EL PUNTO DE QUIEBRE de la comisión —cuántos puntos de ocupación tendría que
              agregar el administrador para pagarse solo—, que es lo único de este capítulo que
              ninguna fila puede mostrar, porque no es una cifra del mes sino una condición. */}
          {q && q.puntosExtra > 0 && (
            <VCierre titulo="Qué significa">
              <SegsCierre segs={cierres.gestion} />
            </VCierre>
          )}
          <VFuente>
            Motor Franco · {ufFecha} · costos declarados por ti; comisión de plataforma 3%
            {q ? ` · administrador: ${comAdminPct}% del ingreso, declarado por ti` : ""}
          </VFuente>
        </div>
      ),
    };
  })();

  // ═══════════════ III · CUÁNTAS NOCHES NECESITAS ═══════════════
  const filaIII: FilaHallazgo = (() => {
    const arribaTxt = args.noches.nochesArriba != null && args.noches.veredictoArriba ? `sube a ${nombreVeredicto(args.noches.veredictoArriba)} con ${args.noches.nochesArriba} (${pct1(args.noches.ocupacionArribaPct ?? 0)}%)` : "";
    const zonaTxt = vsTxt ? `tu zona ocupa ${vsTxt} lo típico de ${comuna}` : "";
    const dial = fr ? dialDesdeFronteras(veredicto, fr.abajo, fr.arriba, (fl, dir) => ({ v: `${pct1(occ * fl.factor * 100)}% · ${Math.round(occ * fl.factor * 365)} noches`, k: `y ${dir === "abajo" ? "cae" : "sube"} a ${nombreVeredicto(fl.veredicto)}` })) : null;
    const fe = results.flujoEstacional ?? [];
    const ingresos = fe.map((x) => x.ingresoBruto);
    const prom = ingresos.length ? ingresos.reduce((a, b) => a + b, 0) / ingresos.length : 0;
    const iMax = ingresos.length ? ingresos.indexOf(Math.max(...ingresos)) : -1;
    const iMin = ingresos.length ? ingresos.indexOf(Math.min(...ingresos)) : -1;
    const enVerde = args.noches.mesesEnVerde;
    const enRojo = fe.length - enVerde;
    return {
      id: "noches",
      numero: ROMANO.noches,
      pregunta: "Cuántas noches necesitas",
      // «Al año 171 noches»: la unidad va con la cifra porque el apellido solo no la da.
      valor: conApellido("Al año", `${noches} noches`),
      ksub: [`${noches} noches al año con la ocupación ${occEsTuya ? "que definiste" : "estimada"} (${Math.round(occ * 100)}%)`, arribaTxt, zonaTxt].filter(Boolean).join(" · "),
      anchorId: anchorCapituloStr("noches"),
      cuerpo: (
        <div>
          <VProsa>
            Una renta corta vive de la ocupación: las noches que se venden en el año. Dónde está la tuya frente a la zona, cuántas noches más hacen cambiar el veredicto y
            cómo se reparte el año.
          </VProsa>
          <VViz t={`La ocupación ${occEsTuya ? "que definiste" : "estimada para tu depto"} frente a lo típico de ${comuna}`}>
            <VSub>Tu ocupación frente a la zona</VSub>
            <Thermo
              pct={Math.max(0, Math.min(100, ((occ * 100 - 20) / 60) * 100))}
              refPct={comunaOcc ? Math.max(0, Math.min(100, ((comunaOcc.valor * 100 - 20) / 60) * 100)) : null}
              marca={`Tú · ${Math.round(occ * 100)}%`}
              legend={[
                { k: "Se ocupa poco", v: "20%" },
                { k: comunaOcc ? `Típico de ${comuna}` : "Referencia", v: comunaOcc ? `${Math.round(comunaOcc.valor * 100)}%` : "—" },
                { k: "Se ocupa mucho", v: "80%" },
              ]}
            />
            <p className="v-copy" style={{ marginTop: 10 }}>
              {occEsTuya ? `Definiste ${Math.round(occ * 100)}% de ocupación` : `Los datos de mercado estiman ${Math.round(occ * 100)}% para un depto como el tuyo en esta zona`}: {noches} noches al año, {Math.round(noches / 12)} al mes.
              {comunaOcc && vsTxt ? ` Tu zona ocupa ${vsTxt} lo típico de ${comuna} (${Math.round(comunaOcc.valor * 100)}%, sobre ${comunaOcc.n} estimaciones de la comuna).` : ""}
              {occEsTuya ? "" : " No pusiste un supuesto propio: el cálculo usa la estimación."}
            </p>
          </VViz>
          {dial && (
            <>
              <VPuente>{occEsTuya ? "Ese es tu supuesto." : "Esa es la estimación."} ¿Cuántas noches más hacen cambiar el veredicto?</VPuente>
              <VViz t="Tu veredicto según las noches que se ocupan">
                <VSub>La ocupación a la que cambia el veredicto</VSub>
                <Dial zonas={dial.zonas} bordes={dial.bordes} marcaPct={dial.marcaPct} marcaK={occEsTuya ? "Tu supuesto" : "Estimada"} marcaV={`${pct1(occ * 100)}%`} />
              </VViz>
            </>
          )}
          {fe.length === 12 && (
            <>
              <VPuente>Y el año no es parejo: así se reparte, y así arranca.</VPuente>
              <VViz t="Ingreso de cada mes frente al mes promedio · curva real de la zona">
                <VSub>Cómo se reparte el año</VSub>
                <CurvaAnual puntos={fe.map((x) => ({ v: x.ingresoBruto, positivo: x.flujo > 0 }))} promedio={prom} />
                <p className="v-copy" style={{ marginTop: 10 }}>
                  {iMax >= 0 && iMin >= 0 ? (
                    <>
                      {MESES[iMax].charAt(0).toUpperCase() + MESES[iMax].slice(1)} es el pico ({money(ingresos[iMax])}
                      {fe[iMax].flujo > 0 ? `, ${enVerde === 1 ? "el único mes con flujo positivo" : "con flujo positivo"}: ${money(fe[iMax].flujo)}` : `, y aun así pones ${money(-fe[iMax].flujo)}`}); {MESES[iMin]} el valle ({money(ingresos[iMin])}
                      {fe[iMin].flujo < 0 ? `, pones ${money(-fe[iMin].flujo)}` : ""}).{" "}
                    </>
                  ) : null}
                  {enRojo > 0 ? `${enRojo === 12 ? "Los doce" : `${EN_PALABRAS[enRojo]} de doce`} meses pones plata.` : "Ningún mes pones plata."}
                  {results.perdidaRampUp > 0 ? ` Y antes de eso, los primeros meses el aviso se ocupa menos mientras gana reseñas: ${money(results.perdidaRampUp)} acumulados que tienes que tener en caja antes de arrancar.` : ""}
                </p>
              </VViz>
            </>
          )}
          <VCierre titulo="Qué significa">
            <SegsCierre segs={cierres.noches} />
          </VCierre>
          <VFuente>
            Datos de mercado · ocupación {occEsTuya ? "definida por ti" : "estimada para este depto"} y curva mensual de la zona{fecha ? ` · ${fecha}` : ""}
            {comunaOcc ? ` · típico de la comuna: mediana de ${comunaOcc.n} estimaciones en ${comuna}` : ""}
          </VFuente>
        </div>
      ),
    };
  })();

  // ═══════════════ IV · CÓMO LO PAGAS ═══════════════
  // TRES BLOQUES ANCLADOS AL PRECIO RECOMENDADO (21-sep-2026), el MISMO modelo y el mismo
  // render que LTR (`construirComoLoPagas` + `CapituloComoLoPagas`); acá solo se juntan
  // las entradas del motor STR: la distancia (el mix hacia COMPRAR sale de `mixAComprar`,
  // nunca del escalón), el sobreprecio con universo, el límite TIR y «donde el mes cierra»
  // de la simulación, y el capex que siembra `calcShortTerm`. Salieron el dial de precio,
  // `PlanNegociacion`, la matriz pie × plazo (vive en el pop-up), el financiamiento y la
  // línea del plazo (cola del pop-up), y el cierre `cierrePagasStr`.
  const capexStr = hallazgos.find((h): h is HallazgoPuestaAPunto => h.id === "capex_puesta_a_punto");
  const modeloPagas = construirComoLoPagas({
    modalidad: "STR",
    veredicto,
    precioUF,
    superficieM2: Number(inputData?.superficieUtil) || 0,
    comuna,
    piePctActual: piePct,
    plazoActual: plazo,
    distancia: dist?.valor ?? null,
    sobre: sobre ?? null,
    limiteTirUF: simulacion?.limiteTir?.precioUF ?? null,
    mesCierraUF: simulacion?.mesCierra?.precioUF ?? null,
    precioMaximoComprarUF: simulacion?.fronteraPrecio?.caeA?.precioUF ?? null,
    caeA: simulacion?.fronteraPrecio?.caeA?.veredicto ?? null,
    // Las comunas alternativas de STR quedan para cuando el motor STR las calcule (§12).
    alternativa: null,
    capex: capexStr?.valor ?? null,
    valorUF,
  });
  const filaIV: FilaHallazgo = {
    id: "pagas",
    numero: ROMANO.pagas,
    pregunta: "Cómo lo pagas",
    // §7: la fila dice el precio que manda —el recomendado; en COMPRAR el de hoy; sin salida,
    // lo dice—. Un solo apellido por fila (el tier «card-str» los cuenta).
    valor: conApellido(
      modeloPagas.rec ? "Precio recomendado" : "Precio",
      modeloPagas.rec ? ufTxt(modeloPagas.rec.precioUF) : modeloPagas.caso === "comprar" ? ufTxt(precioUF) : "sin recomendación",
    ),
    valorRojo: false,
    anchorId: anchorCapituloStr("pagas"),
    cuerpo: <CapituloComoLoPagas modelo={modeloPagas} valorUF={valorUF} />,
  };


  // ═══════════════ V · CORTO O LARGO ═══════════════
  // ⛔ ERA «CÓMO LO GESTIONAS» Y SE FUNDIÓ CON EL II el 17-sep-2026. Su primera mitad
  // —autogestión contra administrador— bajó al capítulo II, donde ya vivía la otra mitad de
  // esa comparación en OTRA UNIDAD: el V hablaba en ingreso neto y el II en flujo, y las dos
  // cifras del administrador se contradecían en el 100% de las filas. Con la fusión hay una
  // sola unidad y una sola definición del costo.
  //
  // LO QUE QUEDA es la segunda mitad, que nunca fue sobre gestión: el corto contra el arriendo
  // largo. El TÍTULO cambia con ella —un capítulo llamado «Cómo lo gestionas» que no habla de
  // gestión miente más que el desajuste que teníamos—, pero el `id`, el romano y el ancla NO
  // se tocan: son claves de navegación y de la prosa ya generada.
  //
  // DÓNDE VIVE ESTO AL FINAL está sin decidir (el hero es candidato y quedó fuera de alcance).
  // Mientras tanto se queda acá, que es la única opción que no pierde el contenido.
  // Ver [[cola-capitulo-v-str-hilo-largo]].
  const filaV: FilaHallazgo = (() => {
    const auto = results.comparativa.str_auto;
    const admin = results.comparativa.str_admin;
    const ltr = results.comparativa.ltr;
    const sr = results.comparativa.sobreRenta;
    const srPct = results.comparativa.sobreRentaPct;
    const confiable = results.comparativa.sobreRentaPctConfiable;
    const srAuto = auto.noiMensual - ltr.noiMensual;
    const srAdmin = admin.noiMensual - ltr.noiMensual;
    const pctDe = (x: number) => (ltr.noiMensual > 0 ? `${x >= 0 ? "+" : "−"}${Math.round(Math.abs((x / ltr.noiMensual) * 100))}%` : null);
    const valorV = confiable ? `${srPct >= 0 ? "+" : "−"}${Math.round(Math.abs(srPct * 100))}%` : signed(sr);
    const payback = results.comparativa.paybackMeses;
    const amob = m?.dia1.amoblamientoCLP ?? Number(inputData?.costoAmoblamiento) ?? 0;
    return {
      id: "gestion",
      numero: ROMANO.gestion,
      pregunta: "Corto o largo",
      valor: conApellido("vs arriendo largo", valorV),
      valorRojo: sr < 0,
      // El ksub ya no trae las dos cifras de gestión: se fueron al capítulo II con su bloque.
      ksub: [`${valorV} sobre el arriendo largo`, `ingreso neto largo ${money(ltr.noiMensual)} al mes`].join(" · "),
      anchorId: anchorCapituloStr("gestion"),
      cuerpo: (
        <div>
          {/* LAS BARRAS «AUTOGESTIÓN CONTRA ADMINISTRADOR» Y SUS TRES FILAS SE FUERON AL
            CAPÍTULO II (17-sep-2026), convertidas en el bloque «Y si no vas a operarlo tú».
            Con ellas se fue la fila «Lo que cuesta no poner las horas», que rotulaba como
            COSTO DE LAS HORAS una diferencia que es solo de comisión: `str_auto` y `str_admin`
            corren con el mismo ingreso, el mismo ADR y la misma ocupación (ver
            `QuiebreGestionSTR`), así que las horas no estaban medidas en ningún lado de esa
            resta. En el capítulo II la misma cifra se llama por su nombre.

            La prosa de apertura también salió: presentaba un capítulo sobre gestión. */}
          <VProsa>
            La renta corta pide amoblar, operar y reponer. Lo que tiene que justificar todo eso es
            la diferencia contra lo simple: arrendar el mismo depto a un arrendatario largo.
          </VProsa>
          <VViz t="Cuánto más deja el corto que arrendar largo el mismo depto">
            <VSub>La ventaja sobre el arriendo largo</VSub>
            <div className="colchon">
              <span className="k">
                Autogestionado · sobre el ingreso neto del largo ({money(ltr.noiMensual)}
                {ltr.ingresoBruto > 0 ? ` con ${money(ltr.ingresoBruto)} de arriendo` : ""})
              </span>
              <span className={`v${srAuto < 0 ? " neg" : ""}`}>
                {signed(srAuto)} <small>/mes{pctDe(srAuto) ? ` · ${pctDe(srAuto)}` : ""}</small>
              </span>
            </div>
            <div className="colchon" style={{ marginTop: 8 }}>
              <span className="k">Con administrador</span>
              <span className={`v${srAdmin < 0 ? " neg" : ""}`}>
                {signed(srAdmin)} <small>/mes{pctDe(srAdmin) ? ` · ${pctDe(srAdmin)}` : ""}</small>
              </span>
            </div>
            <p className="v-copy" style={{ marginTop: 10 }}>
              {amob > 0
                ? payback > 0
                  ? `El amoblamiento (${money(amob)}) se recupera con la ventaja ${modo === "auto" ? "autogestionada" : "con administrador"} en ${payback} meses. `
                  : `El amoblamiento (${money(amob)}) no se recupera con la sobre-renta: la ventaja no alcanza. `
                : ""}
              La ventaja compara un corto estabilizado, con la ocupación {occEsTuya ? "que definiste" : "estimada"}, contra un arriendo largo sin gestión.
            </p>
          </VViz>
          <VCierre titulo="Qué significa">
            <SegsCierre segs={cierres.largo} />
          </VCierre>
          <VFuente>Arriendo largo declarado por ti · ingreso neto largo: arriendo menos administración, gastos comunes, mantención y contribuciones · Motor Franco</VFuente>
        </div>
      ),
    };
  })();

  // ═══════════════ VI · TU RESULTADO A 10 AÑOS ═══════════════
  const filaVI: FilaHallazgo | null =
    exit && exit.valorVenta > 0
      ? (() => {
          const anios = exit.yearVenta;
          const pr = (results.projections ?? []).slice(0, anios);
          const mult = metricaValorONull(exit.multiplicadorCapital);
          const tir = m?.tirPct ?? metricaValorONull(exit.tirAnual);
          const inversion = exit.inversionInicial ?? m?.dia1.inversionInicial ?? results.capitalInvertido;
          const amort = Math.max(results.montoCredito - exit.saldoCreditoAlVender, 0);
          const plusNeta = exit.valorVenta - precioCLP - exit.gastosCierre;
          const patrimonio = exit.equityCLP;
          const d1 = m?.dia1 ?? { pieCLP: results.pie, gastosCompraCLP: Math.max(0, inversion - results.pie), amoblamientoCLP: 0, capexCLP: 0, inversionInicial: inversion };
          const barra = barraDia1({ ...d1, patrimonio });
          const altMoney = (n: number) => (currency === "UF" ? "$" + Math.round(n).toLocaleString("es-CL") : "UF " + Math.round(n / (valorUF || 1)).toLocaleString("es-CL"));
          const oport = costoOportunidad(inversion, anios);
          const bolsillo = args.resultado.bolsilloCLP;
          const pctFirme = patrimonio > 0 ? Math.round(((results.pie + amort) / patrimonio) * 100) : 0;
          const pctPlus = patrimonio > 0 ? Math.max(0, 100 - pctFirme) : 0;
          const ltv = 0.7;
          const nuevoCredito = Math.round(exit.valorVenta * ltv);
          const liquidez = nuevoCredito - exit.saldoCreditoAlVender;
          const cuotaNueva = plazo > 0 ? calcDividendo(nuevoCredito, tasa, plazo) : 0;
          const proyPct = Math.round(PLUSVALIA_PROYECCION_ANUAL * 100);
          return {
            id: "resultado",
            numero: ROMANO.resultado,
            pregunta: `Tu resultado a ${anios} años`,
            valor: conApellido("Resultado", compact(patrimonio)),
            valorRojo: patrimonio < 0,
            ksub: [`tu parte al vender el año ${anios}`, mult != null ? `×${mult.toFixed(2).replace(".", ",")} sobre lo puesto` : "", tir != null ? `TIR ${pct1(tir)}%` : ""].filter(Boolean).join(" · "),
            anchorId: anchorCapituloStr("resultado"),
            cuerpo: (
              <div>
                <VProsa>
                  Lo que llevas puesto contra lo que vale el depto, año a año — y con qué te quedas si vendes o refinancias en el año {anios}. La plusvalía entra como
                  supuesto: {proyPct}% al año, parejo.
                </VProsa>
                {pr.length > 0 && (
                  <VViz t="Lo que pusiste, lo que vale y tu parte · año a año">
                    <VSub>Cómo crece tu parte, año a año</VSub>
                    <CurvaPatrimonio
                      anios={pr.map((p) => ({ year: p.year, valor: p.valorDepto, aporte: inversion + Math.max(0, -p.flujoAcumulado), patrimonio: p.patrimonioNeto }))}
                      etiquetaFinal={compact(pr[pr.length - 1].patrimonioNeto)}
                      fmtLeyenda={{ aporte: "Aporte acumulado", valor: `Valor del depto · ${proyPct}% al año`, parte: "Tu parte (valor − deuda)" }}
                    />
                  </VViz>
                )}
                <VViz t={`De dónde salen tus ${compact(patrimonio)} si vendes el año ${anios}`}>
                  <VSub>De dónde sale tu parte</VSub>
                  <BloqueDia1 barra={barra} total={money(inversion)} totalAlt={altMoney(inversion)} multiplicador={mult != null ? `×${mult.toFixed(2).replace(".", ",")}` : null} fmt={money} />
                  <BarraApilada
                    llaves={patrimonio > 0 ? [{ k: <><b>Firme</b> · {pctFirme}%</>, pct: pctFirme }, { k: <><b>Proyectado</b> · {pctPlus}%</>, pct: pctPlus }] : []}
                    segmentos={patrimonio > 0 ? [{ tono: "pie", pct: (results.pie / patrimonio) * 100 }, { tono: "amort", pct: (amort / patrimonio) * 100 }, { tono: "plus", pct: Math.max(0, (plusNeta / patrimonio) * 100) }] : []}
                    filas={[
                      { tono: "pie", k: "Tu pie", sub: "lo que desembolsas el día 1, vuelve entero", v: money(results.pie), tag: "firme" },
                      { tono: "gastos", k: "Gastos de compra", sub: "el día 1 — no vuelve", v: money(d1.gastosCompraCLP), tag: "no vuelve" },
                      ...(d1.amoblamientoCLP > 0 ? [{ tono: "amoblamiento" as const, k: "Amoblamiento", sub: "se compra el día 1 — no vuelve como patrimonio", v: money(d1.amoblamientoCLP), tag: "no vuelve" }] : []),
                      ...(d1.capexCLP > 0 ? [{ tono: "capex" as const, k: "Puesta a punto", sub: "el día 1 — no vuelve", v: money(d1.capexCLP), tag: "no vuelve" }] : []),
                      { tono: "amort", k: "Deuda que amortizó la operación", sub: `lo que bajó el crédito en ${anios} años`, v: money(amort), tag: "firme" },
                      { tono: "plus", k: "Plusvalía neta de gastos de venta", sub: `${proyPct}% al año, supuesto`, v: neg(plusNeta), tag: "proyectado" },
                    ]}
                    total={{ k: `Tu parte el año ${anios}`, v: money(patrimonio) }}
                    nota={{
                      texto:
                        bolsillo > 0
                          ? `Los ${money(d1.gastosCompraCLP + d1.amoblamientoCLP + d1.capexCLP)} del día 1 que no son pie no vuelven como patrimonio, y los ${money(bolsillo)} que pusiste mes a mes pagaron intereses y costos.`
                          : `Los ${money(d1.gastosCompraCLP + d1.amoblamientoCLP + d1.capexCLP)} del día 1 que no son pie no vuelven como patrimonio.`,
                      v: mult != null ? `×${mult.toFixed(2).replace(".", ",")}` : undefined,
                    }}
                  />
                  <div className="oport">
                    <div className="bt">La misma plata en otro lado</div>
                    <FilasDato>
                      <FilaDato k="Depósito a plazo en UF al 5%" tip={`${money(inversion)} a 5% anual por ${anios} años`} v={money(oport.depositoUF)} />
                      <FilaDato k="Fondo mutuo al 7%" tip={`${money(inversion)} a 7% anual por ${anios} años`} v={money(oport.fondoMutuo)} />
                      <FilaDato k="Este depto" tip={`Tu parte al vender el año ${anios}`} v={money(patrimonio)} tono="in" />
                    </FilasDato>
                    <p className="nota">
                      Los tres parten de los mismos {compact(inversion)}. El depto es el único que te pide {bolsillo > 0 ? `${compact(bolsillo)} más en el camino, ` : ""}horas cada semana, y el único cuya ganancia depende de que la plusvalía ocurra.
                    </p>
                  </div>
                </VViz>
                <VPuente>Así crece tu parte. Y esto es lo que te llevas si vendes.</VPuente>
                <VViz t={`Venta o refinanciamiento en el año ${anios}`}>
                  <VSub>Si vendes o refinancias en el año {anios}</VSub>
                  <div className="venta">
                    <div>
                      <h4>Si vendes</h4>
                      <p className="ex">Vendes al valor proyectado, pagas lo que queda del crédito y los gastos de venta. Lo que sobra es tu parte.</p>
                      <FilasDato>
                        <FilaDato k="Valor de venta estimado" tip={`Precio × 1,0${proyPct} elevado a ${anios}`} sub={`${proyPct}% al año desde la compra`} v={money(exit.valorVenta)} />
                        <FilaDato k="Deuda pendiente" tip="Saldo del crédito al vender" sub={`lo que queda del crédito el año ${anios}`} v={neg(-exit.saldoCreditoAlVender)} />
                        <FilaDato k="Gastos de venta" tip="Comisión de corretaje" sub="2% del valor de venta" v={neg(-exit.gastosCierre)} />
                        <FilaDato k="Te queda" tip="Valor − deuda − gastos" v={money(patrimonio)} tono="tot" />
                      </FilasDato>
                    </div>
                    <div>
                      <h4>Si refinancias</h4>
                      <p className="ex">Sacas parte de tu plusvalía como liquidez sin vender ni pagar impuesto, a cambio de una cuota más alta.</p>
                      <FilasDato>
                        <FilaDato k="Nuevo crédito" tip={`Crédito nuevo sobre el valor del año ${anios}`} sub={`70% del valor del año ${anios}`} v={money(nuevoCredito)} />
                        <FilaDato k="Deuda pendiente" tip="Se paga con el crédito nuevo" v={neg(-exit.saldoCreditoAlVender)} />
                        {cuotaNueva > 0 && <FilaDato k="Cuota nueva" tip="Dividendo del crédito nuevo" sub={`${plazo} años al ${pct1(tasa)}%`} v={money(cuotaNueva)} unidad="/mes" />}
                        <FilaDato k="Liquidez sin vender" tip="Crédito nuevo − deuda pendiente" v={neg(liquidez)} tono="tot" />
                      </FilasDato>
                    </div>
                  </div>
                </VViz>
                <VCierre titulo="Qué significa">
                  <SegsCierre segs={cierres.resultado} />
                </VCierre>
                <VFuente>
                  Motor Franco · proyección a {proyPct}% anual · {ufFecha}
                </VFuente>
              </div>
            ),
          };
        })()
      : null;

  const filas = [filaI, filaII, filaIII, filaIV, filaV, filaVI].filter((x): x is FilaHallazgo => x !== null);
  return <HallazgosAcordeon variante="capitulo" tipo="str" filas={filas} veredicto={veredicto} accessLevel={accessLevel} abrir={abrir} />;
}
