"use client";

import { SegsCierre } from "./shared/SegsCierre";
import { Matriz } from "./shared/Matriz";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { useMemo, useState } from "react";
import type {
  AIAnalysisV2,
  AnalisisInput,
  FullAnalysisResult,
  HallazgoCapRate,
  HallazgoDistanciaVeredicto,
  HallazgoPatrimonio,
  HallazgoPlusvalia,
  HallazgoSensibilidad,
  HallazgoSobreprecio,
  HallazgoTIR,
  HallazgoEstructuraFinanciamiento,
  HallazgoPuestaAPunto,
} from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { calcDividendo, costoOportunidad, simularPieYPlazo, INSTRUMENTOS_REFERENCIA } from "@/lib/analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { PLUSVALIA_DEFAULT_RANGO } from "@/lib/plusvalia-estimado.gen";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";
import { barraDia1 } from "@/lib/plata-dia1";
import { cierrePlusvalia, cierreRenta, cierreResultado, type FmtCierre } from "@/lib/cierres-capitulos";
import { HallazgosAcordeon, type FilaHallazgo } from "./hallazgos/HallazgosAcordeon";
import {
  BarraApilada,
  Bars,
  DataRow,
  LineaTiempo,
  Thermo,
  VCierre,
  VFuente,
  VProsa,
  VPuente,
  VSub,
  VViz,
} from "./hallazgos/vocabulario";
import { SensibilidadDial } from "./drawers/DrawersPropios";
import { DrawerCostoMensual, DrawerNegociacion } from "@/components/ui/AnalysisDrawer";
import { EstructuraComparada } from "./hallazgos/estructura-comparada";
import { PatrimonioChart } from "./PatrimonioChart";

/**
 * LA INVERSIÓN — cinco capítulos (contrato CONGELADO 02-sep-2026, T3).
 *
 *   I   Cuánto renta          cap rate vs referencia → colchón del arriendo (Dial)
 *   II  Tu flujo mensual      waterfall del arriendo → pregunta de la IA
 *   III Cómo lo pagas         dial de precio + plan → crédito (tasa) → matriz pie×plazo
 *   IV  Plusvalía             comuna (Thermo) → proyección → compra en verde (línea)
 *   V   Tu resultado a 10 años  patrimonio año a año → composición → misma plata en
 *                             otro lado → venta o refinanciamiento
 *
 * Cada cuerpo es una unidad v12: VProsa → viz → puente → viz → UN cierre → VFuente.
 * Los cierres de I, IV y V son deterministas (src/lib/cierres-capitulos.ts, ramas
 * aprobadas); II y III conservan la caja de la IA. Reusa entero lo que ya existía:
 * el Dial de sensibilidad, el waterfall de costo mensual, el dial de precio y el
 * plan de negociación, la estructura comparada, la matriz pie×plazo de T0/T1, el
 * PatrimonioChart (fijo a 10 años) y las primitivas del contrato.
 *
 * Muere en LTR con este componente: el acordeón de hallazgos, AdvancedSection con
 * sus sliders e Indicators, el render de largoPlazo y "La apuesta", las escaleras
 * separadas y DrawerTIRLtr como cuerpo. STR no cambia.
 */

export type CapituloId = "renta" | "flujo" | "pagas" | "plusvalia" | "resultado";

/** A qué capítulo lleva «↓ Ver detalle» de cada hallazgo de la sección 3. */
export const CAPITULO_DE_HALLAZGO: Record<string, CapituloId> = {
  cap_rate: "renta",
  sensibilidad: "renta",
  flujo_mensual: "flujo",
  sobreprecio: "pagas",
  estructura_financiamiento: "pagas",
  distancia_veredicto: "pagas",
  capex_puesta_a_punto: "pagas",
  plusvalia: "plusvalia",
  patrimonio: "resultado",
  tir: "resultado",
};

export function anchorCapitulo(id: CapituloId): string {
  return `cap-${id}`;
}

const PROY_PCT = String(Math.round(PLUSVALIA_PROYECCION_ANUAL * 100));
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const mult2 = (n: number) => n.toFixed(2).replace(".", ",");
/** Margen de sensibilidad: entero sin decimal (−6%), coma chilena si no (−6,2%). */
const pctMargin = (n: number) => (Number.isInteger(Math.round(n * 10) / 10) ? String(Math.round(n)) : pct1(n));
const capVer = (v: string) => (v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta supuestos" : v === "BUSCAR OTRA" ? "Buscar otra" : v);

function formatearEntrega(fecha?: string | null): string {
  if (!fecha) return "";
  const [y, m] = String(fecha).split("-").map((x) => Number(x));
  if (!y || !m) return "";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[m - 1] ?? ""} ${y}`.trim();
}

const Segs = SegsCierre;

export function CapitulosInversion({
  results,
  inputData,
  prosa,
  currency,
  valorUF,
  comuna,
  createdAt,
  veredicto,
  accessLevel,
  abrir,
}: {
  results: FullAnalysisResult;
  inputData: AnalisisInput;
  prosa: AIAnalysisV2 | null;
  currency: "CLP" | "UF";
  valorUF: number;
  comuna: string;
  createdAt?: string;
  veredicto: string;
  accessLevel: string;
  /** Apertura pedida desde afuera («↓ Ver detalle» de Principales hallazgos). */
  abrir?: { id: string; nonce: number } | null;
}) {
  const m = results.metrics;
  const exit = results.exitScenario;
  const hs = results.hallazgos ?? [];
  const capRate = (hs.find((h) => h.id === "cap_rate") as HallazgoCapRate | undefined) ?? m?.hallazgoCapRate ?? undefined;
  const sens = hs.find((h): h is HallazgoSensibilidad => h.id === "sensibilidad");
  const dist = hs.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const plus = (hs.find((h) => h.id === "plusvalia") as HallazgoPlusvalia | undefined) ?? m?.hallazgoPlusvalia ?? undefined;
  const pat = hs.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  const tirH = hs.find((h): h is HallazgoTIR => h.id === "tir");
  const estr = hs.find((h): h is HallazgoEstructuraFinanciamiento => h.id === "estructura_financiamiento");
  const sobre = (m?.hallazgoSobreprecio as HallazgoSobreprecio | null | undefined) ?? (hs.find((h) => h.id === "sobreprecio") as HallazgoSobreprecio | undefined) ?? null;
  // Puesta a punto (usados). null con antigüedad ≤ 2 (CapEx 0): no se nombra en
  // ninguna parte. Se consume tal cual lo emite el motor — cero re-derivación.
  const capex =
    (hs.find((h) => h.id === "capex_puesta_a_punto") as HallazgoPuestaAPunto | undefined) ??
    (m?.hallazgoPuestaAPunto && m.hallazgoPuestaAPunto.valor.montoUF > 0 ? m.hallazgoPuestaAPunto : null) ??
    null;
  const capexV = capex && capex.valor.montoUF > 0 ? capex.valor : null;
  // Rango solo cuando el motor lo trae y no es degenerado (v3 derivado). Override
  // (cotización real) y filas legacy → valor único.
  const capexRango = !!capexV && capexV.montoMinUF != null && capexV.montoMaxUF != null && capexV.montoMaxUF > capexV.montoMinUF;
  const ufN = (n: number) => Math.round(n).toLocaleString("es-CL");
  const capexRangoUF = capexV && capexRango ? `UF ${ufN(capexV.montoMinUF!)}–${ufN(capexV.montoMaxUF!)}` : capexV ? `UF ${ufN(capexV.montoUF)}` : "";

  // ── formato (dueño de moneda y UF) ──
  const money = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") {
      const uf = abs / (valorUF || 1);
      return "UF " + (uf >= 100 ? Math.round(uf).toLocaleString("es-CL") : pct1(uf));
    }
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${money(n)}`;
  const compact = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") return "UF " + Math.round(abs / (valorUF || 1)).toLocaleString("es-CL");
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace(".", ",")} MM`;
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const f: FmtCierre = { money, compact, pct1 };
  const ufFecha = (() => {
    const f = fechaCortaCL(createdAt);
    const fecha = f ? ` al ${f}` : "";
    return `UF ${Math.round(valorUF).toLocaleString("es-CL")}${fecha}`;
  })();

  const precioCLP = m?.precioCLP ?? 0;
  const arriendo = m?.ingresoMensual ?? 0;
  const dividendo = m?.dividendo ?? 0;
  const pieCLP = m?.pieCLP ?? 0;
  const pe = m?.preEntrega ?? null;
  const preEntrega = pe && pe.aniosEspera > 0 ? pe : null;
  const anios = exit?.anios ?? 10;
  const tir = metricaValorONull(exit?.tir);

  // ── matriz pie × plazo (T0/T1): UF congelado del análisis, fecha del análisis ──
  const matriz = useMemo(() => {
    if (!inputData || !(inputData.precio > 0) || !createdAt) return null;
    const ufCongelado = precioCLP > 0 ? precioCLP / inputData.precio : valorUF;
    const mx = simularPieYPlazo(inputData, ufCongelado, new Date(createdAt));
    return mx.celdas.length ? mx : null;
  }, [inputData, createdAt, precioCLP, valorUF]);
  // Serie visible de la matriz del III (Flujo | TIR). Mismo toggle que STR IV.
  const [serieIII, setSerieIII] = useState<"flujo" | "tir">("flujo");

  if (!m) return null;

  // ═══════════════ I · CUÁNTO RENTA ═══════════════
  const filaI: FilaHallazgo | null = capRate
    ? (() => {
        const v = capRate.valor;
        const noi = m.noi ?? (v.capRatePct / 100) * precioCLP;
        const gastosOpAnual = Math.max(arriendo * 12 - noi, 0);
        const arriendoRef = ((v.capRefPct / 100) * precioCLP + gastosOpAnual) / 12;
        // Eje: referencia al centro, ±2 puntos (el CONGELADO: 2,0% · 4,0% · 6,0%).
        const lo = Math.min(v.capRefPct - 2, v.capRatePct - 0.5);
        const hi = Math.max(v.capRefPct + 2, v.capRatePct + 0.5);
        const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
        const aguanta = sens ? (sens.valor.firme ? "el arriendo aguanta −50% o más" : `el arriendo aguanta −${pctMargin(sens.valor.marginPct)}%`) : "";
        const arriba =
          dist && !dist.valor.esEstructural && dist.valor.palancaMasBarata
            ? { palanca: dist.valor.palancaMasBarata.palanca, deltaPct: dist.valor.palancaMasBarata.deltaPct, objetivo: dist.valor.palancaMasBarata.objetivo, veredictoObjetivo: dist.valor.veredictoObjetivo }
            : null;
        const viaArr = dist?.valor.vias?.find((x) => x.palanca === "arriendo") ?? null;
        const viaArriendo =
          viaArr?.estado === "cruza"
            ? { estado: "cruza" as const, deltaPct: viaArr.deltaPct }
            : viaArr?.estado === "noCruza"
              ? { estado: "noCruza" as const, topeExplorado: viaArr.topeExplorado }
              : viaArr?.estado === "noAplica"
                ? { estado: "noAplica" as const }
                : null;
        const segs = cierreRenta(
          {
            arriendo,
            gapPts: v.gapPts,
            capRefPct: v.capRefPct,
            arriendoRef,
            sens: sens
              ? { marginPct: sens.valor.marginPct, firme: sens.valor.firme, veredictoBase: sens.valor.veredictoBase, veredictoNuevo: sens.valor.veredictoNuevo, corteAdverso: sens.valor.corteAdverso, corteFavorable: sens.valor.corteFavorable }
              : null,
            arriba,
            viaArriendo,
          },
          f,
        );
        return {
          id: "renta",
          numero: "I",
          pregunta: "Cuánto renta",
          valor: `${pct1(v.capRatePct)}%`,
          valorRojo: capRate.direccion === "adverso",
          ksub: [`cap rate neto ${pct1(v.capRatePct)}%`, `referencia ${pct1(v.capRefPct)}%`, aguanta].filter(Boolean).join(" · "),
          anchorId: anchorCapitulo("renta"),
          cuerpo: (
            <div>
              <VProsa>
                Lo que el arriendo deja al año sobre el precio, ya descontados los gastos, contra lo que rinde el mercado.
                {sens ? " Y cuánto aguanta ese número si el arriendo real resulta distinto del declarado." : ""}
              </VProsa>
              <VViz t="Dónde cae tu rendimiento frente a la referencia">
                <VSub>Cuánto rinde frente al mercado</VSub>
                <Thermo
                  invertido
                  pct={pos(v.capRatePct)}
                  refPct={pos(v.capRefPct)}
                  marca={`Tú · ${pct1(v.capRatePct)}%`}
                  legend={[
                    { k: "Rinde poco", v: `${pct1(lo)}%` },
                    { k: "Referencia de mercado", v: `${pct1(v.capRefPct)}%` },
                    { k: "Rinde mucho", v: `${pct1(hi)}%` },
                  ]}
                />
              </VViz>
              {sens && arriendo > 0 && (
                <>
                  <VPuente>Eso es con el arriendo declarado. ¿Y si el arriendo real es menor?</VPuente>
                  <VViz t="Tu veredicto según el arriendo mensual">
                    <VSub>Cuánto aguanta ese arriendo antes de que cambie el veredicto</VSub>
                    <SensibilidadDial hallazgo={sens} results={results} currency={currency} valorUF={valorUF} />
                  </VViz>
                </>
              )}
              <VCierre titulo="Qué significa">
                <Segs segs={segs} />
              </VCierre>
              <VFuente>{procedenciaExtendida(capRate, currency, valorUF)}</VFuente>
            </div>
          ),
        };
      })()
    : null;

  // ═══════════════ II · TU FLUJO MENSUAL ═══════════════
  const flujo = m.flujoNetoMensual;
  const filaII: FilaHallazgo = {
    id: "flujo",
    numero: "II",
    pregunta: "Tu flujo mensual",
    valor: signed(flujo),
    valorRojo: flujo < 0,
    ksub: `de los ${money(arriendo)} del arriendo, después de cuota, gastos y vacancia`,
    anchorId: anchorCapitulo("flujo"),
    cuerpo: (
      <DrawerCostoMensual
        data={prosa?.costoMensual}
        currency={currency}
        results={results}
        inputData={inputData}
        valorUF={valorUF}
        capitulo={{
          intro:
            "Lo que entra cada mes contra todo lo que sale: la cuota, lo que no paga el arrendatario y lo que cuesta tener el depto arrendado. Lo que queda es lo que pones tú.",
          fuente: `Motor Franco · ${ufFecha}`,
        }}
      />
    ),
  };

  // ═══════════════ III · CÓMO LO PAGAS ═══════════════
  // La tira lee la MISMA fuente que el dial del cuerpo: el umbral de veredicto de
  // `results.negociacion` (idéntico al objetivo de distancia_veredicto en el motor);
  // sin ese campo (filas viejas), la palanca de precio de distancia.
  const neg = results.negociacion;
  const umbralNeg = neg && typeof neg.precioUmbralVeredictoUF === "number" && neg.precioUmbralVeredictoUF > 0 && neg.veredictoAlUmbral
    ? { objetivo: neg.precioUmbralVeredictoUF, veredicto: neg.veredictoAlUmbral, deltaPct: inputData.precio > 0 ? ((neg.precioUmbralVeredictoUF - inputData.precio) / inputData.precio) * 100 : 0 }
    : null;
  const palancaDist = dist && !dist.valor.esEstructural ? dist.valor.palancas.find((p) => p.palanca === "precio") ?? null : null;
  const palancaPrecio = umbralNeg
    ? { objetivo: umbralNeg.objetivo, deltaPct: umbralNeg.deltaPct, veredicto: umbralNeg.veredicto }
    : palancaDist && dist
      ? { objetivo: palancaDist.objetivo, deltaPct: palancaDist.deltaPct, veredicto: dist.valor.veredictoObjetivo }
      : null;
  const objetivoPrecioUF = palancaPrecio ? palancaPrecio.objetivo : null;
  const viaPrecio = dist?.valor.vias?.find((x) => x.palanca === "precio") ?? null;
  const precioNoCruza = !palancaPrecio && viaPrecio?.estado === "noCruza" ? viaPrecio : null;
  const tasaPct = Number(inputData.tasaInteres) || 0;
  const plazo = Number(inputData.plazoCredito) || 0;
  const piePct = Number(inputData.piePct) || 0;
  const ksubIII = [
    `precio UF ${Math.round(inputData.precio).toLocaleString("es-CL")}`,
    `pie ${Number.isInteger(piePct) ? piePct : pct1(piePct)}%`,
    plazo > 0 ? `${plazo} años al ${pct1(tasaPct)}%` : "sin crédito",
    // Cuarta pata: la plata del día 1 que no es pie. Rango (v3), cotización
    // (override) o valor único (legacy). Sin CapEx no aparece.
    capexV ? `puesta a punto ${capexRangoUF}${capexV.origen === "override" ? " (tu cotización)" : ""}` : "",
    objetivoPrecioUF && palancaPrecio
      ? `cierra en ${capVer(palancaPrecio.veredicto)} bajo UF ${Math.round(objetivoPrecioUF).toLocaleString("es-CL")}`
      : precioNoCruza && dist
        ? `ni con −${precioNoCruza.topeExplorado}% de precio sube a ${capVer(dist.valor.veredictoObjetivo)}`
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const valorIII = palancaPrecio
    ? { v: `−${pct1(Math.abs(palancaPrecio.deltaPct))}%`, rojo: true }
    : sobre
      ? { v: `${sobre.valor.desviacionPct > 0 ? "+" : ""}${pct1(sobre.valor.desviacionPct)}%`, rojo: sobre.direccion === "adverso" }
      : { v: money(dividendo), rojo: false };
  // Matriz pie × plazo sobre la pieza compartida (goal "LTR hereda", 05-sep-2026). El
  // motor LTR (`CeldaPiePlazo`) no emite `cruza`: acá "cruza" = la celda supera el umbral
  // de la serie activa (flujo ≥ 0 · TIR ≥ umbral), la misma lectura que coloreaba la
  // matriz vieja. Cruza por veredicto en LTR = goal de motor pendiente; la leyenda LTR
  // nunca nombra un veredicto.
  const umbralTir = tirH?.valor.umbralPct ?? 6;
  const cortoMx = (n: number) => `${n < 0 ? "−" : ""}${currency === "UF" ? `UF ${Math.round(Math.abs(n) / (valorUF || 1))}` : `$${Math.round(Math.abs(n) / 1000)}k`}`;
  const notaMatrizFlujo = (() => {
    if (!matriz) return "";
    const verde = matriz.celdas.filter((c) => c.flujoMensual >= 0).sort((a, b) => a.piePct - b.piePct || a.plazoAnios - b.plazoAnios)[0];
    return verde
      ? `El mes cierra desde ${Number.isInteger(verde.piePct) ? verde.piePct : pct1(verde.piePct)}% de pie a ${verde.plazoAnios} años. Más pie y más plazo alivian la cuota; el precio es lo que da vuelta el signo.`
      : "Ninguna combinación cierra el mes. Más pie y más plazo alivian la cuota; el precio es lo que da vuelta el signo.";
  })();
  const cuotasPie = Number(inputData.cuotasPie) || 0;
  const montoCuota = Number(inputData.montoCuota) || 0;
  const filaIII: FilaHallazgo = {
    id: "pagas",
    numero: "III",
    pregunta: "Cómo lo pagas",
    valor: valorIII.v,
    valorRojo: valorIII.rojo,
    ksub: ksubIII,
    anchorId: anchorCapitulo("pagas"),
    cuerpo: (
      <DrawerNegociacion
        data={prosa?.negociacion}
        currency={currency}
        inputData={inputData}
        results={results}
        valorUF={valorUF}
        createdAt={createdAt}
        capitulo={{
          intro: "Dos decisiones fijan cuánto cargas cada mes: el precio al que cierras y el crédito con el que lo pagas. Esto es lo que cambia en tu caso con cada una.",
          entreMedio: (
            <>
              {plazo > 0 && piePct < 100 && (
                <>
                  <VPuente>El precio es lo primero. Ahora veamos cómo lo financias: el crédito.</VPuente>
                  <VViz t="Tu estructura contra la referencia">
                    <VSub>Cómo lo financias: el crédito que tienes</VSub>
                    {estr && (
                      <EstructuraComparada
                        soloTasa
                        piePct={piePct}
                        tasaPct={estr.valor.tasaPct}
                        tasaMarketPct={estr.valor.tasaMarketPct}
                        cuotaFmt={money(dividendo)}
                      />
                    )}
                    <DataRow
                      k="Pie"
                      sub={`${compact(pieCLP)}${cuotasPie > 0 && montoCuota > 0 ? ` · ${cuotasPie} cuotas de ${compact(montoCuota)} durante la construcción` : ""}`}
                      v={`${Number.isInteger(piePct) ? piePct : pct1(piePct)}%`}
                    />
                    <DataRow k="Cuota mensual" sub={`crédito de ${compact(precioCLP - pieCLP)} a ${plazo} años`} v={money(dividendo)} />
                  </VViz>
                  {matriz && (
                    <VViz t={serieIII === "flujo" ? "Tu flujo mensual según pie y plazo" : "Tu TIR a 10 años según pie y plazo"}>
                      <Matriz
                        id="mz-ltr-iii"
                        cabecera="Cuánto cambia el mes según pie y plazo"
                        toggle={{ opciones: [{ id: "flujo", label: "Flujo" }, { id: "tir", label: "TIR" }], activo: serieIII, onChange: (id) => setSerieIII(id as "flujo" | "tir") }}
                        ejeX={{ label: "→ más plazo", niveles: matriz.plazos.map((z) => ({ k: String(z), sub: "años" })) }}
                        ejeY={{ label: "↓ más pie", niveles: matriz.pies.map((p) => ({ k: `${Number.isInteger(p) ? p : pct1(p)}%`, sub: compact(precioCLP * (p / 100)) })) }}
                        celdas={matriz.pies.map((p) =>
                          matriz.plazos.map((z) => {
                            const c = matriz.celdas.find((x) => x.piePct === p && x.plazoAnios === z);
                            if (!c) return { v: "—" };
                            const tir = c.tirPct != null ? `${pct1(c.tirPct)}%` : "—";
                            const v = serieIII === "flujo" ? cortoMx(c.flujoMensual) : tir;
                            const cruza = serieIII === "flujo" ? c.flujoMensual >= 0 : c.tirPct != null && c.tirPct >= umbralTir;
                            return { v, neg: serieIII === "flujo" && c.flujoMensual < 0, cruza, hoy: c.esActual, title: `${signed(c.flujoMensual)} al mes · TIR ${tir} · ${Number.isInteger(p) ? p : pct1(p)}% de pie a ${z} años` };
                          }),
                        )}
                        leyenda={{ hoy: "hoy", cruza: serieIII === "flujo" ? "cierra el mes" : `sobre TIR ${pct1(umbralTir)}%`, cruzaCorto: "cruza" }}
                        nota={serieIII === "flujo" ? notaMatrizFlujo : undefined}
                      />
                    </VViz>
                  )}
                </>
              )}
              {capexV && (
                <>
                  <VPuente>Y hay una parte de la plata del día 1 que no es pie ni crédito: dejar el depto listo para arrendar.</VPuente>
                  <VViz t="Puesta a punto antes de arrendar">
                    <VSub>Lo que cuesta dejarlo en estándar de arriendo</VSub>
                    {/* Viz duplicada de DrawerCapexPuestaAPunto (AnalysisDrawer.tsx):
                        extraerla creaba una abstracción de un consumidor y medio. Si
                        cambia allá, cambia acá. */}
                    <div className={`grid grid-cols-2 gap-3 ${capexRango ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
                      <div>
                        <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>
                          {capexRango ? "Rango estimado" : capexV.origen === "override" ? "Tu cotización" : "Inversión"}
                        </p>
                        <p className="font-mono font-bold m-0" style={{ fontSize: capexRango ? 18 : 20, lineHeight: 1.05, color: "var(--doc-tx)" }}>
                          {capexRango
                            ? (currency === "UF" ? capexRangoUF : `${compact(capexV.montoMinCLP ?? capexV.montoCLP)}–${compact(capexV.montoMaxCLP ?? capexV.montoCLP)}`)
                            : (currency === "UF" ? `UF ${ufN(capexV.montoUF)}` : money(capexV.montoCLP))}
                        </p>
                      </div>
                      {capexRango && (
                        <div>
                          <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>Corre el caso con</p>
                          {/* El punto es un entero en UF (múltiplo de 5): sin el decimal de money(). */}
                          <p className="font-mono font-bold m-0" style={{ fontSize: 18, lineHeight: 1.05, color: "var(--doc-tx)" }}>{currency === "UF" ? `UF ${ufN(capexV.montoUF)}` : money(capexV.montoCLP)}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>Por m²</p>
                        <p className="font-mono font-bold m-0" style={{ fontSize: capexRango ? 18 : 20, lineHeight: 1.05, color: "var(--doc-tx)" }}>
                          {capexRango && capexV.ufM2Min != null && capexV.ufM2Max != null
                            ? `${pct1(capexV.ufM2Min)}–${pct1(capexV.ufM2Max)}`
                            : pct1(capexV.ufM2)}{" "}
                          <span style={{ fontSize: 13, fontWeight: 500 }}>UF/m²</span>
                        </p>
                      </div>
                      <div>
                        <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>De tu plata día 1</p>
                        {/* Sin Signal Red acá: el rojo condicional del KPI vive en el drawer del hallazgo, no en el capítulo. */}
                        <p className="font-mono font-bold m-0" style={{ fontSize: capexRango ? 18 : 20, lineHeight: 1.05, color: "var(--doc-tx)" }}>
                          {Math.round(capexV.fraccionInversion * 100)}%
                        </p>
                      </div>
                    </div>
                    <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginTop: 12 }}>
                      Franco corre el caso con UF {ufN(capexV.montoUF)} · ${ufN(capexV.montoCLP)}.{" "}
                      {capexV.origen === "override"
                        ? "Es tu cotización: entra tal cual a la inversión inicial."
                        : `Estimación según la antigüedad del depto (${capexV.antiguedadAnios} años, ${capexV.superficieUtilM2} m² útiles). Con una cotización real, el número se ajusta.`}
                    </p>
                  </VViz>
                </>
              )}
            </>
          ),
          fuente: `${sobre ? procedenciaExtendida(sobre, currency, valorUF) : `Mediana de publicaciones de venta en ${comuna}`}${plazo > 0 ? " · tasa de referencia: promedio de mercado, Motor Franco" : ""}${capex && capexV ? ` · puesta a punto: ${procedenciaExtendida(capex, currency, valorUF)}` : ""}`,
        }}
      />
    ),
  };

  // ═══════════════ IV · PLUSVALÍA ═══════════════
  const filaIV: FilaHallazgo | null = plus
    ? (() => {
        const v = plus.valor;
        const anual = v.anualizadaPct;
        const lo = Math.min(0, Math.floor(anual - 1));
        const hi = Math.max(6, Math.ceil(anual + 1));
        const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
        const g = Math.round(v.gapPts * 10) / 10;
        const fuenteHist = v.fuente && !/umbral/i.test(v.fuente) ? v.fuente : v.tieneData ? "Arenas & Cayo, Tinsa, Propital, Activo Más" : "Promedio histórico Gran Santiago";
        const rango = PLUSVALIA_DEFAULT_RANGO;
        const [r0, r1] = rango.split("-");
        const segs = cierrePlusvalia(
          { comuna, anualizadaPct: anual, refPct: v.refPct, gapPts: v.gapPts, tieneData: v.tieneData, proyPct: PROY_PCT, preEntrega },
          f,
        );
        const proyeccion = !v.tieneData
          ? `Franco no usa el histórico de la comuna: proyecta ${PROY_PCT}% parejo para todos. Es un supuesto neutro: ni premia ni castiga. ${comuna} no tiene serie propia; el eje muestra el promedio del Gran Santiago.`
          : Math.abs(g) < 0.3
            ? `Franco no usa el histórico de la comuna: proyecta ${PROY_PCT}% parejo para todos. Es un supuesto neutro: ni premia ni castiga. En ${comuna} histórico y proyección coinciden.`
            : g > 0
              ? `Franco no usa el histórico de la comuna: proyecta ${PROY_PCT}% parejo para todos. Es un supuesto neutro: ni premia ni castiga. En ${comuna} el histórico fue mayor (${pct1(anual)}%): la proyección se queda corta si la comuna repite su década.`
              : `Franco no usa el histórico de la comuna: proyecta ${PROY_PCT}% parejo para todos. Es un supuesto neutro: ni premia ni castiga. En ${comuna} el histórico fue menor (${pct1(anual)}%): la proyección supone más de lo que la comuna hizo.`;
        const valorVenta = exit?.valorVenta ?? 0;
        const entregaTxt = formatearEntrega(inputData.fechaEntrega);
        const aniosPost = preEntrega ? anios - preEntrega.aniosEspera : anios;
        return {
          id: "plusvalia",
          numero: "IV",
          pregunta: "Plusvalía",
          valor: `${pct1(anual)}% anual`,
          valorRojo: plus.direccion === "adverso",
          ksub: [
            v.tieneData ? `${comuna} ${rango}` : `sin serie propia · promedio Gran Santiago`,
            `${pct1(anual)}% al año`,
            preEntrega ? `compra en verde +${pct1(preEntrega.gananciaPct)}% a la entrega` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          anchorId: anchorCapitulo("plusvalia"),
          cuerpo: (
            <div>
              <VProsa>
                {preEntrega
                  ? "Tres cosas distintas que suelen mezclarse: cuánto subió la comuna, cuánto proyecta Franco para este depto, y qué ganas por comprar en verde antes de que esté construido."
                  : "Dos cosas distintas que suelen mezclarse: cuánto subió la comuna y cuánto proyecta Franco para este depto."}
              </VProsa>
              <VViz>
                <VSub>{v.tieneData ? `Cuánto se ha valorizado ${comuna}` : "Cuánto se ha valorizado el Gran Santiago"}</VSub>
                <Thermo
                  invertido
                  pct={pos(anual)}
                  refPct={pos(v.refPct)}
                  ceroPct={lo < 0 ? pos(0) : null}
                  marca={`${v.tieneData ? comuna : "Gran Santiago"} · ${pct1(anual)}% al año`}
                  legend={[
                    { k: anual < 0 ? "Perdió valor" : "Subió poco", v: `${lo}%` },
                    { k: "Referencia de largo plazo", v: `${pct1(v.refPct)}%` },
                    { k: "Subió mucho", v: `${hi}%` },
                  ]}
                />
                <p className="viz-pie" style={{ marginTop: 12 }}>
                  Entre {r0} y {r1} los departamentos {v.tieneData ? "de la comuna" : "del Gran Santiago"} {anual < 0 ? "bajaron" : "subieron"} {pct1(Math.abs(anual))}% al año, ya descontada la inflación. La referencia de largo plazo es {pct1(v.refPct)}%.
                </p>
              </VViz>
              <VViz>
                <VSub>Lo que Franco proyecta para este depto</VSub>
                <p className="viz-pie" style={{ marginTop: 0 }}>{proyeccion}</p>
              </VViz>
              {preEntrega && valorVenta > 0 && (
                <VViz>
                  <VSub>Compras en verde: la plusvalía empieza antes de la entrega</VSub>
                  <p className="viz-pie" style={{ marginTop: 0 }}>
                    Comprar en verde es fijar hoy el precio de un depto que recibes en {preEntrega.aniosEspera === 1 ? "un año" : `${preEntrega.aniosEspera} años`}. Si la comuna sube en ese tramo, esa diferencia es tuya sin haber puesto la cuota todavía: es la ventaja de comprar antes.
                  </p>
                  <LineaTiempo
                    hitos={[
                      { k: "Firma · hoy", sub: "valor pactado", v: money(preEntrega.precioCompraCLP), tono: "base" },
                      { k: `Entrega${entregaTxt ? ` · ${entregaTxt}` : ""}`, sub: "valor estimado a esa fecha", v: money(preEntrega.valorEntregaCLP), tono: "mid" },
                      { k: `Año ${anios}`, sub: "valor proyectado", v: money(valorVenta), tono: "end" },
                    ]}
                    deltas={[
                      { v: `+${compact(preEntrega.gananciaCLP)}`, k: `+${pct1(preEntrega.gananciaPct)}% en ${preEntrega.aniosEspera === 1 ? "un año" : `${preEntrega.aniosEspera} años`}` },
                      {
                        v: `+${compact(valorVenta - preEntrega.valorEntregaCLP)}`,
                        k: `+${pct1(preEntrega.valorEntregaCLP > 0 ? ((valorVenta - preEntrega.valorEntregaCLP) / preEntrega.valorEntregaCLP) * 100 : 0)}% en ${aniosPost} años`,
                      },
                    ]}
                    lectura={`Compras a ${compact(preEntrega.precioCompraCLP)}; a la entrega ya vale ${compact(preEntrega.valorEntregaCLP)}; al año ${anios}, ${compact(valorVenta)}.`}
                  />
                </VViz>
              )}
              <VCierre titulo="Qué significa">
                <Segs segs={segs} />
              </VCierre>
              <VFuente>
                {fuenteHist}
                {fuenteHist.includes(rango) ? "" : ` · ${rango}`}
                {v.tieneData ? ` · ${comuna}` : ""}
              </VFuente>
            </div>
          ),
        };
      })()
    : null;

  // ═══════════════ V · TU RESULTADO A 10 AÑOS ═══════════════
  const filaV: FilaHallazgo | null =
    pat && exit && exit.valorVenta > 0
      ? (() => {
          const v = pat.valor;
          const patrimonio = v.patrimonioCLP;
          const aportado = v.aportadoCLP;
          const mult = v.multiplicador;
          const creditoInicial = precioCLP - pieCLP;
          const amort = Math.max(creditoInicial - exit.saldoCredito, 0);
          const plusvaliaNeta = patrimonio - pieCLP - amort;
          const bolsillo = exit.flujoMensualAcumuladoNegativo ?? 0;
          const plusvaliaBruta = exit.valorVenta - precioCLP;
          const composicionCierra = patrimonio > 0 && amort >= 0 && plusvaliaNeta >= 0 && mult >= 1;
          const pctFirme = patrimonio > 0 ? Math.round(((pieCLP + amort) / patrimonio) * 100) : 0;
          const inversionInicial = exit.inversionInicial ?? pieCLP;
          // Descomposición de la plata del día 1, tal cual la suma el motor:
          // pie + gastos de compra (cierre + corretaje) + puesta a punto === inversionInicial.
          // `gastosCompraCLP` lo emite calcMetrics desde el mismo lugar que
          // calcInversionInicialCLP; la resta es FALLBACK para filas persistidas
          // anteriores al campo, no la fuente. El invariante de la suma vive en
          // plata-dia1.ts (avisoDia1), que es quien posee estos montos.
          const capexDia1 = m.capexPuestaAPuntoCLP ?? 0;
          const gastosCompra = m.gastosCompraCLP ?? Math.max(0, inversionInicial - pieCLP - capexDia1);
          const capexSub = capexV
            ? `${capexRango ? `${capexRangoUF}, corre con UF ${ufN(capexV.montoUF)}` : `UF ${ufN(capexV.montoUF)}${capexV.origen === "override" ? ", tu cotización" : ""}`} — no vuelve`
            : "no vuelve";
          // Barra "Lo que pusiste · el día 1" a la MISMA escala que la de abajo
          // (ancho = inversión inicial / tu parte al vender). Geometría pura en
          // plata-dia1.ts; los montos son los mismos de las filas de la leyenda.
          // LTR no tiene amoblamiento: va en 0 y el tramo no se dibuja (cuarto tono, solo STR).
          const dia1 = barraDia1({ pieCLP, gastosCompraCLP: gastosCompra, amoblamientoCLP: 0, capexCLP: capexDia1, inversionInicial, patrimonio });
          const altMoney = (n: number) =>
            currency === "UF" ? "$" + Math.round(n).toLocaleString("es-CL") : "UF " + Math.round(n / (valorUF || 1)).toLocaleString("es-CL");
          const oport = costoOportunidad(inversionInicial, anios);
          const ltv = 0.7;
          const nuevoCredito = Math.round(exit.valorVenta * ltv);
          const liquidez = nuevoCredito - exit.saldoCredito;
          const cuotaNueva = plazo > 0 ? calcDividendo(nuevoCredito, tasaPct, plazo) : 0;
          const segs = cierreResultado(
            {
              comuna,
              patrimonioCLP: patrimonio,
              aportadoCLP: aportado,
              pieCLP,
              amortizacionCLP: amort,
              multiplicador: mult,
              sinCapitalPropio: !!v.sinCapitalPropio,
              flujoAcumulado: exit.flujoAcumulado,
              bolsilloCLP: bolsillo,
              tirPct: tir,
              depositoCLP: oport.depositoUF,
              proyPct: PROY_PCT,
            },
            f,
          );
          const pctSeg = (n: number) => (patrimonio > 0 ? Math.max(0, (n / patrimonio) * 100) : 0);
          return {
            id: "resultado",
            numero: "V",
            pregunta: `Tu resultado a ${anios} años`,
            valor: compact(patrimonio),
            valorRojo: mult < 1,
            ksub: [`tu parte al vender el año ${anios}`, v.sinCapitalPropio ? "" : `×${mult2(mult)} sobre lo puesto`, tir != null ? `TIR ${pct1(tir)}%` : ""].filter(Boolean).join(" · "),
            anchorId: anchorCapitulo("resultado"),
            cuerpo: (
              <div>
                <VProsa>
                  Lo que llevas puesto contra lo que vale el depto, año a año, y con qué te quedas si vendes o refinancias en el año {anios}.
                </VProsa>
                <VViz t="Lo que pusiste, lo que vale y tu parte · año a año">
                  <VSub>Cómo crece tu parte, año a año</VSub>
                  <PatrimonioChart projections={results.projections ?? []} metrics={m} inputData={inputData} currency={currency} valorUF={valorUF} plazoFijo={anios} capitulo />
                </VViz>
                <VViz t={`De dónde salen tus ${compact(patrimonio)} si vendes el año ${anios}`}>
                  <VSub>De dónde sale tu parte</VSub>
                  {composicionCierra && dia1.anchoPct > 0 && (
                    /* Barra ADITIVA sobre la actual: la plata del día 1, de tu bolsillo, a la
                       misma escala que "tu parte a N años". La barra de abajo, sus % y sus
                       filas no cambian. Tonos y trama: los mismos de BarraApilada (.ba-seg). */
                    <div style={{ marginBottom: 16 }}>
                      <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginBottom: 10 }}>
                        Las dos barras están a la misma escala.
                      </p>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                        <span className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)" }}>
                          Lo que pusiste · el día 1, de tu bolsillo
                        </span>
                        <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--doc-tx)", whiteSpace: "nowrap" }}>
                          {money(inversionInicial)}{" "}
                          <small style={{ fontSize: 10.5, fontWeight: 500, color: "var(--doc-tx3)" }}>{altMoney(inversionInicial)}</small>
                        </span>
                      </div>
                      <div style={{ display: "flex", height: 38, borderRadius: 3, overflow: "hidden", width: `${dia1.anchoPct}%`, maxWidth: "100%" }}>
                        {dia1.segmentos.map((s) => (
                          <div key={s.tono} className={`ba-seg ${s.tono}`} style={{ width: `${s.pct}%`, position: "relative" }}>
                            {s.tono === "capex" && (
                              <span
                                aria-hidden
                                style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(255,255,255,.5) 5px,rgba(255,255,255,.5) 10px)" }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {/* El multiplicador es el MISMO que ya muestra "Tu parte a N años" (v.multiplicador): no se recalcula. Ink, sin Signal Red. */}
                      {!v.sinCapitalPropio && (
                        <p className="font-mono m-0" style={{ fontSize: 12, color: "var(--doc-tx2)", marginTop: 10 }}>
                          <b style={{ color: "var(--doc-tx)", fontWeight: 700 }}>×{mult2(mult)}</b> por cada peso que pusiste
                        </p>
                      )}
                    </div>
                  )}
                  {composicionCierra ? (
                    <BarraApilada
                      llaves={[
                        { k: <>Firme · <b>{pctFirme}%</b></>, pct: pctFirme },
                        { k: <>Proyectado · <b>{100 - pctFirme}%</b></>, pct: 100 - pctFirme },
                      ]}
                      segmentos={[
                        { tono: "pie", pct: pctSeg(pieCLP) },
                        { tono: "amort", pct: pctSeg(amort) },
                        { tono: "plus", pct: pctSeg(plusvaliaNeta) },
                      ]}
                      filas={[
                        ...(pieCLP > 0 ? [{ tono: "pie" as const, k: "Tu pie", sub: "lo que desembolsaste el día 1, vuelve entero", v: compact(pieCLP), tag: "firme" }] : []),
                        // Lo demás que pusiste el día 1 y que NO es patrimonio: se lista, no entra a la barra.
                        ...(gastosCompra > 0 ? [{ tono: "gastos" as const, k: "Gastos de compra", sub: "notaría, CBR, corretaje — no vuelven", v: compact(gastosCompra), tag: "no vuelve" }] : []),
                        ...(capexDia1 > 0 ? [{ tono: "capex" as const, k: "Puesta a punto", sub: capexSub, v: compact(capexDia1), tag: "no vuelve" }] : []),
                        { tono: "amort", k: "Deuda que amortizó el arriendo", sub: "sale del contrato, no de una proyección", v: compact(amort), tag: "firme" },
                        {
                          tono: "plus",
                          k: "Plusvalía proyectada, neta de comisión",
                          sub: `${compact(plusvaliaBruta)} si la comuna rinde ${PROY_PCT}% · menos ${compact(exit.comisionVenta)} de venta`,
                          v: compact(plusvaliaNeta),
                          tag: "proyectado",
                        },
                      ]}
                      total={{ k: `Tu parte a ${anios} años`, v: money(patrimonio) }}
                      nota={{
                        texto:
                          // Con puesta a punto, la frase la nombra aparte de los gastos de compra;
                          // sin CapEx conserva su forma anterior.
                          bolsillo > 0
                            ? `Para llegar acá pusiste ${compact(aportado)}: ${compact(inversionInicial)} el día 1 y ${compact(bolsillo)} mes a mes. ${
                                capexDia1 > 0
                                  ? `Los ${compact(gastosCompra)} de gastos de compra, ${compact(capexDia1)} de puesta a punto y ${compact(bolsillo)} de aportes pagaron intereses y costos, no vuelven como patrimonio.`
                                  : `Los ${compact(aportado - pieCLP)} de gastos de compra y aportes pagaron intereses y costos, no vuelven como patrimonio.`
                              }`
                            : `Para llegar acá pusiste ${compact(aportado)} el día 1${
                                capexDia1 > 0
                                  ? `; ${compact(gastosCompra)} de gastos de compra y ${compact(capexDia1)} de puesta a punto pagaron costos, no vuelven como patrimonio`
                                  : aportado - pieCLP > 0
                                    ? `; los ${compact(aportado - pieCLP)} de gastos de compra pagaron costos, no vuelven como patrimonio`
                                    : ""
                              }.`,
                        v: v.sinCapitalPropio ? undefined : `×${mult2(mult)}`,
                      }}
                    />
                  ) : (
                    <Bars
                      rows={[
                        { k: "Pusiste", v: money(aportado), pct: aportado >= patrimonio ? 100 : (aportado / Math.max(patrimonio, 1)) * 100 },
                        { k: `Te queda a ${anios} años`, v: money(patrimonio), pct: patrimonio >= aportado ? 100 : (patrimonio / Math.max(aportado, 1)) * 100, destacada: mult < 1 },
                      ]}
                    />
                  )}
                  <div className="oport">
                    <div className="bt">La misma plata en otro lado</div>
                    <div className="kv">
                      <span>Depósito a plazo en UF al {Math.round(INSTRUMENTOS_REFERENCIA.depositoUF * 100)}%</span>
                      <span className="v">{money(oport.depositoUF)}</span>
                    </div>
                    <div className="kv">
                      <span>Fondo mutuo al {Math.round(INSTRUMENTOS_REFERENCIA.fondoMutuo * 100)}%</span>
                      <span className="v">{money(oport.fondoMutuo)}</span>
                    </div>
                    <div className="kv" style={{ borderBottom: "none" }}>
                      <span>Este depto</span>
                      <span className="v">{money(patrimonio)}</span>
                    </div>
                    <p className="nota">
                      Los tres parten de los mismos {compact(inversionInicial)}.{" "}
                      {bolsillo > 0
                        ? `El depto es el único que te pide ${compact(bolsillo)} más en el camino y el único cuya ganancia depende de que la plusvalía ocurra.`
                        : "El depto es el único cuya ganancia depende de que la plusvalía ocurra."}
                    </p>
                  </div>
                </VViz>
                <VPuente>Así crece tu parte. Y esto es lo que te llevas si vendes.</VPuente>
                <VViz t={`Venta o refinanciamiento en el año ${anios}`}>
                  <VSub>Si vendes o refinancias en el año {anios}</VSub>
                  <div className="venta">
                    <div>
                      <h4>Si vendes</h4>
                      <p className="ex">Vendes al valor proyectado, pagas lo que queda del crédito y la comisión. Lo que sobra es tu parte.</p>
                      <div className="kv"><span>Valor de venta estimado</span><span className="v">{money(exit.valorVenta)}</span></div>
                      <div className="kv"><span>− Deuda pendiente</span><span className="v neg">−{money(exit.saldoCredito)}</span></div>
                      <div className="kv"><span>− Comisión de venta (2%)</span><span className="v neg">−{money(exit.comisionVenta)}</span></div>
                      <div className="kv tot"><span>Te queda</span><span className="v">{money(exit.equityCLP)}</span></div>
                    </div>
                    {plazo > 0 && liquidez > 0 && (
                      <div>
                        <h4>Si refinancias</h4>
                        <p className="ex">Sacas parte de tu plusvalía como liquidez sin vender ni pagar impuesto, a cambio de una cuota más alta.</p>
                        <div className="kv"><span>Nuevo crédito · {Math.round(ltv * 100)}% del valor</span><span className="v">{money(nuevoCredito)}</span></div>
                        <div className="kv"><span>− Deuda pendiente</span><span className="v neg">−{money(exit.saldoCredito)}</span></div>
                        <div className="kv"><span>Cuota nueva · {plazo} años al {pct1(tasaPct)}%</span><span className="v">{money(cuotaNueva)}</span></div>
                        <div className="kv tot"><span>Liquidez sin vender</span><span className="v">{money(liquidez)}</span></div>
                      </div>
                    )}
                  </div>
                </VViz>
                <VCierre titulo="Qué significa">
                  <Segs segs={segs} />
                </VCierre>
                <VFuente>Motor Franco · proyección a {PROY_PCT}% anual · {ufFecha}</VFuente>
              </div>
            ),
          };
        })()
      : null;

  const filas = [filaI, filaII, filaIII, filaIV, filaV].filter((x): x is FilaHallazgo => x !== null);
  if (filas.length === 0) return null;

  return (
    <HallazgosAcordeon
      variante="capitulo"
      tipo="ltr"
      filas={filas}
      veredicto={veredicto}
      accessLevel={accessLevel}
      abrir={abrir}
    />
  );
}

