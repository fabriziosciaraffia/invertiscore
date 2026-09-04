"use client";

import { useMemo, useState } from "react";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { Hallazgo, HallazgoDistanciaVeredicto, HallazgoEstructuraFinanciamiento, HallazgoSobreprecio, Veredicto } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import type { SimulacionStr, FronteraLado } from "@/lib/analysis/simular-str";
import { TIR_LIMITE_PCT } from "@/lib/tir-limite";
import { argsCierresStr, cierresStr, type EntradaCierresStr } from "@/lib/cierres-str-ensamblador";
import type { FmtCierre } from "@/lib/cierres-capitulos";
import { CAP_STR_UMBRAL_PCT } from "@/lib/rentabilidad-str-hallazgo";
import { barraDia1 } from "@/lib/plata-dia1";
import { costoOportunidad, calcDividendo } from "@/lib/analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { HallazgosAcordeon, type FilaHallazgo } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { VProsa, VViz, VSub, VPuente, VCierre, VFuente, Thermo, Dial, Bars, BarraApilada, type ZonaDial, type BordeDial } from "@/components/analysis/hallazgos/vocabulario";
import { EstructuraComparada } from "@/components/analysis/hallazgos/estructura-comparada";
import { PlanNegociacion } from "@/components/ui/AnalysisDrawer";
import { Matriz, FilaDato, FilasDato, BarraTramos, CurvaAnual, CurvaPatrimonio, BloqueDia1, SegsCierre } from "@/components/analysis/shared";

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

export const CAPITULO_DE_HALLAZGO_STR: Record<string, CapituloStrId> = {
  rentabilidad_str: "renta",
  flujo_str: "flujo",
  estructura_costos_str: "flujo",
  ocupacion_vs_estimacion: "noches",
  sensibilidad_str: "noches",
  sobreprecio: "pagas",
  estructura_financiamiento: "pagas",
  distancia_veredicto: "pagas",
  ventaja_vs_ltr: "gestion",
  capex_puesta_a_punto: "resultado",
  tir: "resultado",
  patrimonio: "resultado",
  plusvalia: "resultado",
};
export const anchorCapituloStr = (id: CapituloStrId) => `cap-str-${id}`;

const ROMANO: Record<CapituloStrId, string> = { renta: "I", flujo: "II", noches: "III", pagas: "IV", gestion: "V", resultado: "VI" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const EN_PALABRAS = ["Ninguno", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Los doce"];
const tonoVeredicto = (v: Veredicto | string): ZonaDial["tono"] => (v === "COMPRAR" ? "comprar" : v === "AJUSTA SUPUESTOS" ? "ajusta" : "buscar");
const nombreVeredicto = (v: Veredicto | string) => (v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta supuestos" : "Buscar otra");

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
  const [serieIV, setSerieIV] = useState<"flujo" | "tir">("flujo");
  const m = results.metrics;
  const base = results.escenarios.base;
  const exit = results.exitScenario;
  const modo: "auto" | "administrador" = inputData?.modoGestion === "administrador" ? "administrador" : "auto";
  const dist = hallazgos.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const fin = hallazgos.find((h): h is HallazgoEstructuraFinanciamiento => h.id === "estructura_financiamiento");
  const sobre = hallazgos.find((h): h is HallazgoSobreprecio => h.id === "sobreprecio");

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
  const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${money(n)}`;
  const neg = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;
  const compact = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") return "UF " + Math.round(abs / (valorUF || 1)).toLocaleString("es-CL");
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace(".", ",")} MM`;
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const corto = (n: number) => `${n < 0 ? "−" : ""}${currency === "UF" ? `UF ${Math.round(Math.abs(n) / (valorUF || 1))}` : `$${Math.round(Math.abs(n) / 1000)}k`}`;
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
  const flujo = args.flujo.flujoMensual;
  const cap = args.renta.capPct;
  const precioCLP = results.pie + results.montoCredito;
  const precioUF = valorUF > 0 ? precioCLP / valorUF : 0;
  const piePct = Number(inputData?.piePct) || (precioCLP > 0 ? (results.pie / precioCLP) * 100 : 0);
  const plazo = Number(inputData?.plazoCredito) || 0;
  const tasa = Number(inputData?.tasaInteres) || 0;
  const fr = simulacion?.fronterasIngreso ?? null;
  const objetivo = dist?.valor.veredictoObjetivo ?? "COMPRAR";
  const adrEsTuya = results.adrFuente === "override";
  const occEsTuya = results.occFuente === "override";
  const vsComuna = results.zonaSTR?.ocupacionVsComuna ?? null;
  const comunaOcc = results.zonaSTR?.comunaOcupacion ?? null;
  const vsTxt = vsComuna === "mas" ? "más que" : vsComuna === "menos" ? "menos que" : vsComuna === "similar" ? "parecido a" : null;

  // ═══════════════ I · CUÁNTO RENTA ═══════════════
  const filaI: FilaHallazgo = (() => {
    const aguanta = fr?.abajo ? `la tarifa aguanta −${pct1((1 - fr.abajo.factor) * 100)}%` : "";
    const lo = Math.min(CAP_STR_UMBRAL_PCT - 3, cap - 0.5);
    const hi = Math.max(CAP_STR_UMBRAL_PCT + 3, cap + 0.5);
    const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
    const dial = fr ? dialDesdeFronteras(veredicto, fr.abajo, fr.arriba, (fl, dir) => ({ v: `${money(adr * fl.factor)} por noche`, k: `y ${dir === "abajo" ? "cae" : "sube"} a ${nombreVeredicto(fl.veredicto)}` })) : null;
    const colchon = fr?.abajo ? adr - adr * fr.abajo.factor : null;
    const mto = simulacion?.matrizTarifaOcupacion ?? null;
    return {
      id: "renta",
      numero: ROMANO.renta,
      pregunta: "Cuánto renta",
      valor: `${pct1(cap)}%`,
      valorRojo: cap < CAP_STR_UMBRAL_PCT,
      ksub: [`${money(adr)} × ${Math.round(occ * 100)}% = ${money(ingreso)} al mes`, `cap rate STR ${pct1(cap)}%`, `referencia ${pct1(CAP_STR_UMBRAL_PCT)}%`, aguanta].filter(Boolean).join(" · "),
      anchorId: anchorCapituloStr("renta"),
      cuerpo: (
        <div>
          <VProsa>
            El ingreso de una renta corta es una multiplicación: la tarifa por noche por las noches que se ocupan. Lo que ese ingreso deja al año sobre el precio, ya
            descontados los costos, es la rentabilidad operativa.{fr?.abajo ? " Y cuánto aguanta la tarifa antes de que el veredicto cambie." : ""}
          </VProsa>
          <VViz t="Tarifa × ocupación = lo que factura un mes típico">
            <VSub>De dónde sale el ingreso</VSub>
            <p className="v-copy">
              {money(adr)} por noche × {noches} noches ÷ 12 meses.{" "}
              {adrEsTuya ? "La tarifa es la que tú definiste" : "La tarifa es la mediana que cobra la zona hoy"}
              {occEsTuya ? " y la ocupación es el supuesto que tú definiste." : " y la ocupación es la que el mercado estima para un depto como el tuyo: ninguna de las dos es un supuesto tuyo."}
            </p>
            <FilasDato>
              <FilaDato k="Tarifa por noche" tip={adrEsTuya ? "La tarifa que definiste" : "Mediana de la zona"} v={money(adr)} />
              <FilaDato k="Ocupación" tip={occEsTuya ? "El supuesto que definiste" : "Estimación de mercado para este depto"} sub={`${noches} noches al año · ${Math.round(noches / 12)} al mes`} v={`${Math.round(occ * 100)}%`} />
              <FilaDato k="Ingreso mensual estabilizado" tip="Tarifa × ocupación × 365 ÷ 12" v={money(ingreso)} unidad="/mes" tono="tot" />
            </FilasDato>
          </VViz>
          <VPuente>Ese ingreso, menos los costos, sobre el precio: la rentabilidad operativa.</VPuente>
          <VViz t="Dónde cae tu cap rate">
            <VSub>Cuánto rinde frente a la referencia</VSub>
            <Thermo
              invertido
              pct={pos(cap)}
              refPct={pos(CAP_STR_UMBRAL_PCT)}
              marca={`Tú · ${pct1(cap)}%`}
              legend={[
                { k: "Rinde poco", v: `${pct1(lo)}%` },
                { k: "Umbral renta corta", v: `${pct1(CAP_STR_UMBRAL_PCT)}%` },
                { k: "Rinde mucho", v: `${pct1(hi)}%` },
              ]}
            />
          </VViz>
          {dial && (
            <>
              <VPuente>Eso es con {adrEsTuya ? "tu tarifa" : "la tarifa mediana"}. ¿Y si cobras distinto?</VPuente>
              <VViz t="Tu veredicto según la tarifa por noche">
                <VSub>Cuánto aguanta la tarifa antes de que cambie el veredicto</VSub>
                <Dial zonas={dial.zonas} bordes={dial.bordes} marcaPct={dial.marcaPct} marcaK={adrEsTuya ? "Tu tarifa" : "Mediana de la zona"} marcaV={money(adr)} />
                {colchon != null && (
                  <div className="colchon">
                    <span className="k">Colchón hasta el borde de abajo</span>
                    <span className="v">
                      {money(colchon)} <small>/noche</small>
                    </span>
                  </div>
                )}
              </VViz>
            </>
          )}
          {mto && mto.celdas.length > 0 && (
            <>
              <VPuente>Y las dos juntas, tarifa y ocupación, en lo que queda cada mes.</VPuente>
              <VViz t="Lo que queda cada mes después de comisión, costos y cuota">
                <VSub>Tarifa por ocupación: tu flujo mensual</VSub>
                <Matriz
                  id="mz-str-i"
                  ejeX={{ label: "→ más tarifa", niveles: mto.tarifas.map((t) => ({ k: money(t), sub: "por noche" })) }}
                  ejeY={{ label: "↓ más ocupación", niveles: mto.ocupaciones.map((o) => ({ k: `${Math.round(o * 100)}%`, sub: `${Math.round((o * 365) / 12)} noches` })) }}
                  celdas={mto.ocupaciones.map((o) =>
                    mto.tarifas.map((t) => {
                      const c = mto.celdas.find((x) => x.tarifaCLP === t && x.ocupacion === o);
                      return c ? { v: corto(c.flujoMensual), neg: c.flujoMensual < 0, cruza: c.cruza, hoy: c.esActual, title: `${neg(c.flujoMensual)} al mes · ${c.veredicto} · ${money(t)} por noche al ${Math.round(o * 100)}%` } : { v: "—" };
                    }),
                  )}
                  leyenda={{ hoy: "hoy", cruza: `cruza a ${nombreVeredicto(objetivo)}`, cruzaCorto: "cruza" }}
                  nota="Cada celda es el flujo mensual con esa tarifa y esa ocupación, con la misma comisión, costos y cuota de tu caso. Cruza = el ingreso alcanza la frontera del dial."
                />
              </VViz>
            </>
          )}
          <VCierre titulo="Qué significa">
            <SegsCierre segs={cierres.renta} />
          </VCierre>
          <VFuente>
            Datos de mercado · {adrEsTuya ? "tarifa definida por ti" : "mediana de tarifa"} y {occEsTuya ? "ocupación definida por ti" : "ocupación estimada para este depto"}
            {fecha ? ` · ${fecha}` : ""} · umbral {pct1(CAP_STR_UMBRAL_PCT)}%: piso de renta corta Franco para Santiago
            {mto ? " · matriz: misma aritmética del motor (comisión, costos declarados, cuota)" : ""}
          </VFuente>
        </div>
      ),
    };
  })();

  // ═══════════════ II · TU FLUJO MENSUAL ═══════════════
  const filaII: FilaHallazgo = (() => {
    const fl = m?.desgloseFall ?? null;
    const t = m?.tramosBarra ?? null;
    // Lo que cobraría un operador al 20% del ingreso (CONGELADO: "con operador al 20% serían −$118.402").
    const adminMonto = Math.round(ingreso * 0.2);
    return {
      id: "flujo",
      numero: ROMANO.flujo,
      pregunta: "Tu flujo mensual",
      valor: signed(flujo),
      valorRojo: flujo < 0,
      ksub: `de los ${money(ingreso)} del ingreso, después de comisión, costos y cuota`,
      anchorId: anchorCapituloStr("flujo"),
      cuerpo: (
        <div>
          <VProsa>
            Lo que factura cada mes contra todo lo que sale: la comisión de la plataforma, lo que cuesta tener el depto operando y la cuota del crédito.{" "}
            {flujo < 0 ? "Lo que queda es lo que pones tú." : "Lo que queda es lo que te llevas."}
          </VProsa>
          <VViz t={`Qué pasa con los ${money(ingreso)} del ingreso`}>
            <VSub>Lo que entra y lo que sale cada mes</VSub>
            {t && <BarraTramos {...t} title={`Ingreso ${money(t.ingreso)} · costos de operar ${money(t.costosOperar)} · cuota ${money(t.cuota)} · ${t.exceso > 0 ? `sale de tu bolsillo ${money(t.exceso)}` : `queda libre ${money(t.libre)}`}`} />}
            {fl ? (
              <FilasDato>
                <FilaDato tono="in" k="Ingreso mensual estabilizado" tip="Tarifa por noche × ocupación × 365 ÷ 12" sub="lo que factura un mes típico con la ocupación estimada" v={money(fl.ingreso)} unidad="/mes" />
                <FilaDato k="Comisión de la plataforma" tip="La plataforma cobra 3% al anfitrión" sub="3% del ingreso" v={neg(-fl.comisionPlataforma)} unidad="/mes" />
                <FilaDato k="Luz, agua, internet e insumos" tip="Costos directos declarados por ti" sub="limpieza y reposición incluidas en insumos" v={neg(-fl.costosDirectos)} unidad="/mes" />
                <FilaDato
                  k="Administrador"
                  tip="Comisión del administrador, si lo hubiera"
                  sub={modo === "administrador" ? "operador al 20% del ingreso" : adminMonto > 0 ? `autogestionas · con operador al 20% serían ${neg(-adminMonto)}` : "autogestionas"}
                  v={neg(-fl.administrador)}
                  unidad="/mes"
                />
                <FilaDato k="Gastos comunes y mantención" tip="Declarados por ti" v={neg(-fl.gastosComunesMantencion)} unidad="/mes" />
                <FilaDato k="Contribuciones" tip="Contribuciones ÷ 3" sub={`${money(fl.contribucionesMensuales * 3)} al trimestre`} v={neg(-fl.contribucionesMensuales)} unidad="/mes" />
                <FilaDato k="Cuota del crédito" tip="Dividendo del crédito hipotecario" sub={results.montoCredito > 0 ? `${compact(results.montoCredito)} a ${plazo} años al ${pct1(tasa)}%` : "sin crédito"} v={neg(-fl.cuota)} unidad="/mes" />
                <FilaDato tono="tot" k={fl.saleDeTuBolsillo < 0 ? "Sale de tu bolsillo" : "Te queda"} tip="Ingreso − comisión − costos − cuota" v={<span style={{ color: fl.saleDeTuBolsillo < 0 ? "var(--signal-red)" : undefined }}>{neg(fl.saleDeTuBolsillo)}</span>} unidad="/mes" />
              </FilasDato>
            ) : (
              <FilasDato>
                <FilaDato tono="in" k="Ingreso mensual estabilizado" v={money(ingreso)} unidad="/mes" />
                <FilaDato k="Comisión y costos" v={neg(-(base.comisionMensual + base.costosOperativos))} unidad="/mes" />
                <FilaDato k="Cuota del crédito" v={neg(-results.dividendoMensual)} unidad="/mes" />
                <FilaDato tono="tot" k={flujo < 0 ? "Sale de tu bolsillo" : "Te queda"} v={neg(flujo)} unidad="/mes" />
              </FilasDato>
            )}
          </VViz>
          <VCierre titulo="Qué haces con esto">
            <SegsCierre segs={cierres.flujo} />
          </VCierre>
          <VFuente>Motor Franco · {ufFecha} · costos declarados por ti; comisión de plataforma 3%</VFuente>
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
      valor: String(noches),
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
  const filaIV: FilaHallazgo = (() => {
    const fp = simulacion?.fronteraPrecio ?? null;
    const techoUF = args.pagas.techoUF;
    const techoDeltaPct = techoUF != null && precioUF > 0 ? ((techoUF - precioUF) / precioUF) * 100 : null;
    const valorIV = techoDeltaPct != null ? `${techoDeltaPct < 0 ? "−" : "+"}${pct1(Math.abs(techoDeltaPct))}%` : ufTxt(precioUF);
    const subeTxt = techoUF != null && args.pagas.veredictoObjetivo ? `sube a ${nombreVeredicto(args.pagas.veredictoObjetivo)} bajo ${ufTxt(techoUF)}` : "";
    const dialPrecio = fp
      ? (() => {
          const pts = [fp.precioUFActual, fp.subeA?.precioUF, fp.caeA?.precioUF].filter((x): x is number => typeof x === "number" && x > 0);
          const lo = Math.min(...pts) * 0.9;
          const hi = Math.max(...pts) * 1.1;
          const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
          const zonas: ZonaDial[] = [];
          const bordes: BordeDial[] = [];
          let cursor = lo;
          if (fp.subeA) {
            zonas.push({ k: nombreVeredicto(fp.subeA.veredicto), pct: pos(fp.subeA.precioUF) - pos(cursor), tono: tonoVeredicto(fp.subeA.veredicto) });
            cursor = fp.subeA.precioUF;
            bordes.push({ pos: pos(fp.subeA.precioUF), delta: `−${pct1((1 - fp.subeA.factor) * 100)}%`, v: ufTxt(fp.subeA.precioUF), k: `y sube a ${nombreVeredicto(fp.subeA.veredicto)}`, dir: "abajo" });
          }
          const fin = fp.caeA ? fp.caeA.precioUF : hi;
          zonas.push({ k: nombreVeredicto(veredicto), pct: pos(fin) - pos(cursor), tono: tonoVeredicto(veredicto) });
          if (fp.caeA) {
            zonas.push({ k: nombreVeredicto(fp.caeA.veredicto), pct: pos(hi) - pos(fp.caeA.precioUF), tono: tonoVeredicto(fp.caeA.veredicto) });
            bordes.push({ pos: pos(fp.caeA.precioUF), delta: `+${pct1((fp.caeA.factor - 1) * 100)}%`, v: ufTxt(fp.caeA.precioUF), k: `y cae a ${nombreVeredicto(fp.caeA.veredicto)}`, dir: "arriba" });
          }
          return { zonas, bordes, marcaPct: pos(fp.precioUFActual) };
        })()
      : null;
    const mpp = simulacion?.matrizPiePlazo ?? null;
    const cuota = m?.desgloseFall.cuota ?? results.dividendoMensual;
    const planObjetivo = techoUF != null && techoDeltaPct != null && techoDeltaPct < 0 ? { uf: techoUF, clp: techoUF * valorUF, veredicto: args.pagas.veredictoObjetivo ?? objetivo } : null;
    // ESTRUCTURAL SIN PLAN, como LTR (T2): cuando ninguna vía cruza no hay plan que
    // ofrecer; "donde el mes cierra" sigue existiendo para la zona y el cierre del
    // capítulo, pero no como oferta de negociación. Es el mismo caso que cubre el guard
    // [STR-ESTRUCTURAL] en la prosa (esDistanciaEstructural lee dist.valor.esEstructural).
    const esEstructural = dist?.valor.esEstructural === true;
    return {
      id: "pagas",
      numero: ROMANO.pagas,
      pregunta: "Cómo lo pagas",
      valor: valorIV,
      valorRojo: false,
      ksub: [`precio ${ufTxt(precioUF)}`, `pie ${Math.round(piePct)}%`, plazo > 0 ? `${plazo} años al ${pct1(tasa)}%` : "sin crédito", subeTxt].filter(Boolean).join(" · "),
      anchorId: anchorCapituloStr("pagas"),
      cuerpo: (
        <div>
          <VProsa>Dos decisiones fijan cuánto cargas cada mes: el precio al que cierras y el crédito con el que lo pagas. Esto es lo que cambia en tu caso con cada una.</VProsa>
          {dialPrecio && (
            <VViz t="Qué veredicto tiene este depto según el precio">
              <VSub>A qué precio conviene cerrar</VSub>
              <Dial zonas={dialPrecio.zonas} bordes={dialPrecio.bordes} marcaPct={dialPrecio.marcaPct} marcaK="Tu precio" marcaV={ufTxt(precioUF)} />
            </VViz>
          )}
          {/* Un nombre por precio, el MISMO componente que LTR: Primera oferta · Objetivo (donde
              cambia el veredicto) · estructural: lo que haría falta, fuera de rango. "Donde el mes
              cierra" solo si el motor lo trae (STR aún no lo emite). La conversión va junto a la
              cifra (el componente formatea por moneda). */}
          {!esEstructural && (planObjetivo || simulacion?.mesCierra) && (
            <VViz>
              <VSub>Cómo negociarlo: tu plan</VSub>
              {/* Un nombre por precio (T2): umbral = donde cambia el veredicto (objetivo) ·
                  sugerido = donde el mes cierra (caja en cero, del motor) · límite = donde la
                  TIR baja del 6% (walk-away). Los tres salen de bisecciones en el server. */}
              <PlanNegociacion
                objetivo={planObjetivo}
                primeraOferta={planObjetivo ? { uf: planObjetivo.uf * 0.95, clp: planObjetivo.clp * 0.95 } : null}
                sostenible={null}
                minimoFueraDeRango={null}
                labelLimite={`Límite · TIR ${TIR_LIMITE_PCT}%`}
                walkAway={
                  simulacion?.limiteTir
                    ? { precio_uf: simulacion.limiteTir.precioUF, precio_clp: simulacion.limiteTir.precioCLP, razon: `Sobre este precio la TIR a 10 años baja del ${TIR_LIMITE_PCT}%: conviene más otra inversión.` }
                    : null
                }
                currency={currency}
                precioActualCLP={precioCLP}
                valorUF={valorUF}
                neutroUF={simulacion?.mesCierra?.precioUF}
                neutroCLP={simulacion?.mesCierra?.precioCLP}
                descuentoNeutroPct={simulacion?.mesCierra && precioCLP > 0 ? ((precioCLP - simulacion.mesCierra.precioCLP) / precioCLP) * 100 : undefined}
                sinCredito={!(results.montoCredito > 0)}
              />
            </VViz>
          )}
          <VPuente>El precio es lo primero. Ahora veamos cómo lo financias: el crédito.</VPuente>
          <VViz t="Tu estructura contra la referencia">
            <VSub>Cómo lo financias: el crédito que tienes</VSub>
            {/* Como en LTR: solo la tasa se compara (tuya vs mercado); pie y cuota son datos sin
                referencia y van como fila de dato. */}
            {fin && results.montoCredito > 0 && <EstructuraComparada soloTasa piePct={fin.valor.piePct} tasaPct={fin.valor.tasaPct} tasaMarketPct={fin.valor.tasaMarketPct} cuotaFmt={money(cuota)} />}
            <FilasDato>
              <FilaDato k="Pie" tip="Lo que pones el día 1 sobre el precio" sub={money(results.pie)} v={`${Number.isInteger(piePct) ? piePct : pct1(piePct)}%`} />
              <FilaDato k="Cuota mensual" tip="Dividendo del crédito hipotecario" sub={results.montoCredito > 0 ? `crédito de ${compact(results.montoCredito)} a ${plazo} años al ${pct1(tasa)}%` : "sin crédito"} v={money(cuota)} unidad="/mes" />
            </FilasDato>
          </VViz>
          {mpp && mpp.celdas.length > 0 && (
            <VViz t="Tu flujo mensual según pie y plazo">
              <Matriz
                id="mz-str-iv"
                cabecera="Cuánto cambia el mes según pie y plazo"
                toggle={{ opciones: [{ id: "flujo", label: "Flujo" }, { id: "tir", label: "TIR" }], activo: serieIV, onChange: (id) => setSerieIV(id as "flujo" | "tir") }}
                ejeX={{ label: "→ más plazo", niveles: mpp.plazos.map((p) => ({ k: String(p), sub: "años" })) }}
                ejeY={{ label: "↓ más pie", niveles: mpp.pies.map((p) => ({ k: `${p}%`, sub: compact(precioCLP * (p / 100)) })) }}
                celdas={mpp.pies.map((p) =>
                  mpp.plazos.map((pl) => {
                    const c = mpp.celdas.find((x) => x.piePct === p && x.plazoAnios === pl);
                    if (!c) return { v: "—" };
                    const v = serieIV === "flujo" ? corto(c.flujoMensual) : c.tirPct != null ? `${pct1(c.tirPct)}%` : "—";
                    return { v, neg: serieIV === "flujo" && c.flujoMensual < 0, cruza: c.cruza, hoy: c.esActual, title: `${neg(c.flujoMensual)} al mes · TIR ${c.tirPct != null ? `${pct1(c.tirPct)}%` : "—"} · ${c.veredicto} · pie ${p}% a ${pl} años` };
                  }),
                )}
                leyenda={{ hoy: "hoy", cruza: `cruza a ${nombreVeredicto(objetivo)}`, cruzaCorto: "cruza" }}
              />
            </VViz>
          )}
          <VCierre titulo="Guión para la contraoferta">
            <SegsCierre segs={cierres.pagas} />
          </VCierre>
          <VFuente>
            {sobre && sobre.valor.n > 0 ? `Mediana de ${sobre.valor.n} publicaciones de venta en ${sobre.valor.comuna || comuna}` : "Precio declarado por ti"}
            {fin ? ` · tasa de referencia: promedio de mercado ${pct1(fin.valor.tasaMarketPct)}%` : ""} · matriz: misma aritmética del motor
          </VFuente>
        </div>
      ),
    };
  })();

  // ═══════════════ V · CÓMO LO GESTIONAS ═══════════════
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
    const maxNoi = Math.max(auto.noiMensual, admin.noiMensual, 1);
    const horas = auto.noiMensual - admin.noiMensual;
    const payback = results.comparativa.paybackMeses;
    const amob = m?.dia1.amoblamientoCLP ?? Number(inputData?.costoAmoblamiento) ?? 0;
    return {
      id: "gestion",
      numero: ROMANO.gestion,
      pregunta: "Cómo lo gestionas",
      valor: valorV,
      valorRojo: sr < 0,
      ksub: [`autogestión ${signed(auto.flujoCajaMensual)} al mes`, `con administrador ${signed(admin.flujoCajaMensual)}`, `${valorV} sobre el arriendo largo`].join(" · "),
      anchorId: anchorCapituloStr("gestion"),
      cuerpo: (
        <div>
          <VProsa>
            Una renta corta la operas tú o la opera un administrador. Cambian la comisión y las horas; el ingreso es el mismo. Y al lado, la cifra que justifica cualquiera de
            las dos: cuánto más deja el corto que arrendar largo el mismo depto.
          </VProsa>
          <VViz t="Lo que deja cada forma de gestionar al mes · después de costos, antes de la cuota">
            <VSub>Autogestión contra administrador</VSub>
            <Bars
              rows={[
                // Ink para autogestión, gris para administrador; Signal Red solo en lo que sale del bolsillo.
                { k: "Autogestión", v: money(auto.noiMensual), pct: (auto.noiMensual / maxNoi) * 100, tono: "ink", neg: auto.noiMensual < 0 },
                { k: "Con administrador", v: money(admin.noiMensual), pct: (admin.noiMensual / maxNoi) * 100, neg: admin.noiMensual < 0 },
              ]}
            />
            <FilasDato style={{ marginTop: 8 }}>
              <FilaDato k={auto.flujoCajaMensual < 0 ? "Lo que pones cada mes, autogestionando" : "Lo que te queda cada mes, autogestionando"} tip="Flujo mensual con autogestión" sub={`ingreso neto menos la cuota de ${money(m?.desgloseFall.cuota ?? results.dividendoMensual)}`} v={neg(auto.flujoCajaMensual)} unidad="/mes" tono={auto.flujoCajaMensual < 0 ? "neg" : undefined} />
              <FilaDato k={admin.flujoCajaMensual < 0 ? "Lo que pones cada mes, con administrador" : "Lo que te queda cada mes, con administrador"} tip="Flujo mensual con administrador al 20%" v={neg(admin.flujoCajaMensual)} unidad="/mes" tono={admin.flujoCajaMensual < 0 ? "neg" : undefined} />
              <FilaDato k="Lo que cuesta no poner las horas" tip="Diferencia de ingreso neto entre autogestión y administrador" sub={`${money(horas * 12)} al año`} v={money(horas)} unidad="/mes" />
            </FilasDato>
          </VViz>
          <VPuente>Y la cifra que justifica el esfuerzo: la ventaja sobre el largo.</VPuente>
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
            <SegsCierre segs={cierres.gestion} />
          </VCierre>
          <VFuente>Arriendo largo declarado por ti · ingreso neto largo: arriendo menos administración, gastos comunes, mantención y contribuciones · administrador: 20% del ingreso · Motor Franco</VFuente>
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
            valor: compact(patrimonio),
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
