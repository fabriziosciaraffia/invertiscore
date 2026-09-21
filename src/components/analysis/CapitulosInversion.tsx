"use client";
import { SegsCierre } from "./shared/SegsCierre";
import { FilaDato, FilasDato } from "./shared/FilaDato";
import { Ang } from "./shared/Ang";
import { useMemo, type ReactNode } from "react";
import { fechaCortaCL } from "@/lib/fecha-cl";
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
  HallazgoPuestaAPunto,
} from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { calcDividendo, calcFlujoDesglose, calcMesVacio, costoOportunidad, INSTRUMENTOS_REFERENCIA } from "@/lib/analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { fuenteHistoricaPlusvalia, glosaPeriodoPlusvalia, procedenciaPlusvalia } from "@/lib/plusvalia-procedencia";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";
import { respaldoArriendo } from "@/lib/arriendo-referencia";
import { barraDia1 } from "@/lib/plata-dia1";
import { cierrePlusvalia, cierreRenta, cierreResultado, type FmtCierre } from "@/lib/cierres-capitulos";
import { HallazgosAcordeon, type FilaHallazgo } from "./hallazgos/HallazgosAcordeon";
import {
  BarraApilada,
  Bars,
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
import { CurvaAnios, type PuntoAnio } from "./shared/CurvaAnios";
import { fraseReparto } from "@/lib/reparto-ingreso";
import { resolverModeloCostos } from "@/lib/modelo-costos";
import { ROTULO_MES_LTR, SUB_TOTAL_MES_LTR, serieFlujoMensualPorAnioLtr, descomposicionFlujoLtr, pieCurvaFlujoLtr, cierreMesVacioLtr, type SegFlujo } from "@/lib/flujo-mensual-ltr";
import { construirComoLoPagas } from "@/lib/como-lo-pagas";
import { CapituloComoLoPagas } from "./shared/CapituloComoLoPagas";
import { construirAlternativaComunas, lineaAlternativaComunas } from "@/lib/alternativa-comunas";
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
/* CAPITULO_DE_HALLAZGO SE RETIRA CON ACTA (09-sep-2026).
 * Mapeaba cada hallazgo al capitulo donde vive su desarrollo, y su unico consumidor
 * era el atajo de la fila de hallazgos. Con la fila ya no clicable el mapa quedo sin
 * lector: un export vivo sin consumidor se lee como un vinculo que existe, y no existe.
 * Nada queda inalcanzable — cada capitulo es su propio boton en el acordeon. La
 * relacion hallazgo↔capitulo, si vuelve a hacer falta, esta en el historial. */
export function anchorCapitulo(id: CapituloId): string {
  return `cap-${id}`;
}
const PROY_PCT = String(Math.round(PLUSVALIA_PROYECCION_ANUAL * 100));
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const mult2 = (n: number) => n.toFixed(2).replace(".", ",");
/** Margen de sensibilidad: entero sin decimal (−6%), coma chilena si no (−6,2%). */
const pctMargin = (n: number) => (Number.isInteger(Math.round(n * 10) / 10) ? String(Math.round(n)) : pct1(n));
/**
 * LA CIFRA CON APELLIDO (contrato §7). Regla general del informe: un numero sin apellido
 * no se entiende solo, salvo que el contexto lo de pegado.
 *
 * En las tarjetas de cifra y en las de zona el contexto SI esta pegado —el rotulo va
 * justo encima del numero—, asi que ahi la cifra va sola. En la fila de capitulo no: el
 * titulo es una pregunta («Cuanto renta») y la cifra vive al otro extremo de la fila, a
 * cuatrocientos pixeles. «4,3%» ahi no dice de que.
 */
export const conApellido = (apellido: string, cifra: ReactNode): ReactNode => (
  <>
    <span className="val-ap">{apellido}</span> {cifra}
  </>
);
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
  // `prosa` sigue en el tipo (lo pasa SubjectCardGrid) pero desde el 21-sep-2026 ningún
  // capítulo la lee: el II era el último y pasó a ser determinista.
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
  const pieCLP = m?.pieCLP ?? 0;
  const pe = m?.preEntrega ?? null;
  const preEntrega = pe && pe.aniosEspera > 0 ? pe : null;
  const anios = exit?.anios ?? 10;
  const tir = metricaValorONull(exit?.tir);
  // LA ALTERNATIVA DE COMUNAS para «Cómo lo pagas» (plan B del bloque 2). Son 23 corridas
  // del motor: solo cuando el veredicto no es COMPRAR, y memoizadas por input.
  const lineaAlternativa = useMemo(
    () => (veredicto !== "COMPRAR" ? lineaAlternativaComunas(construirAlternativaComunas({ input: inputData, ufClp: valorUF, asOf: new Date(createdAt ?? Date.now()) })) : null),
    [veredicto, inputData, valorUF, createdAt],
  );
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
          valor: conApellido("Cap rate", `${pct1(v.capRatePct)}%`),
          valorRojo: capRate.direccion === "adverso",
          ksub: (
            <>
              <Ang>cap rate</Ang> neto {pct1(v.capRatePct)}% · referencia {pct1(v.capRefPct)}%{aguanta ? ` · ${aguanta}` : ""}
            </>
          ),
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
    valor: conApellido("Flujo", signed(flujo)),
    valorRojo: flujo < 0,
    ksub: `de los ${money(arriendo)} del arriendo, después de cuota, gastos y vacancia`,
    anchorId: anchorCapitulo("flujo"),
    cuerpo: (
      <>
      {/* F1 · QUÉ RESPALDA EL ARRIENDO. Va primero y pegado al número, porque todo lo
          que sigue en este capítulo cuelga de él. Es el único caveat epistémico del
          informe: el arriendo lo puso el usuario y hasta hoy solo la prosa decía si
          estaba contrastado — en 17 de 30 generaciones medidas, o sea que en 13 no.
          Determinista: `respaldoArriendo` resuelve los cinco estados con la referencia
          de zona que el motor ya tenía. Nunca se calla: sin referencia, ESO es el dato. */}
      {(() => {
        const r = respaldoArriendo(inputData, arriendo);
        // El tratamiento marca UNA cosa: que el dato de respaldo es débil. Los tres
        // estados donde la referencia no sirve para contrastar —sin referencia (424 de
        // 1.200 filas), muestra chica, orden de magnitud— suben a aviso; con mediana
        // sólida detrás esto es procedencia y se lee como pie, aunque el declarado tenga
        // brecha contra ella.
        //
        // Por eso NO se usa `r.advertencia`, que es un flag más ancho: incluye el
        // declarado POR SOBRE la mediana, que es un hallazgo del caso y no una debilidad
        // del dato. Mezclarlos haría que el borde signifique dos cosas.
        const dudoso = r.estado === "sin_referencia" || r.estado === "muestra_chica" || r.estado === "orden_de_magnitud";
        return <VFuente aviso={dudoso}>{r.texto}</VFuente>;
      })()}
      {/* EL CAPÍTULO DE VERDAD (21-sep-2026), como STR: deja de ser `DrawerCostoMensual`
          embebido. Contrato: docs/wireframes/rediseno-informe/capitulo-ii-flujo-ltr.html, al
          lado del STR aprobado. Se reusa casi todo de STR; lo distinto por modalidad lo emite
          `src/lib/flujo-mensual-ltr.ts` (rótulo del mes, serie ÷ meses, pie del gráfico con
          la historia inversa, mes vacío como cierre) y acá solo se pinta.
          Salió con esto: la bajada fija, el rótulo «Qué pasa con los $X del arriendo», la caja
          IA de `costoMensual` (prosa de contrato ≤ v20, que solo veía el invitado) y el
          «¿Tienes $X disponibles cada mes?», que repetía la fila del total. */}
      {(() => {
        const d = calcFlujoDesglose({
          arriendo,
          dividendo: m?.dividendo ?? 0,
          ggcc: m?.gastos ?? 0,
          contribuciones: m?.contribuciones ?? 0,
          mantencion: m?.provisionMantencionAjustada ?? 0,
          vacanciaMeses: inputData.vacanciaMeses ?? 0,
          usaAdministrador: inputData.usaAdministrador,
          comisionAdministrador: inputData.comisionAdministrador,
        });
        const reparto = m?.repartoIngreso ?? null;
        const gastosComunes = m?.gastos ?? 0;
        const contribTrim = m?.contribuciones ?? 0;
        // EL MES VACÍO lo pone el motor (`calcMesVacio`: cuota completa + gastos comunes ENTEROS +
        // contribuciones del mes); acá no se recalcula. Gate: mes-vacio-catch-test.
        const mesVacio = calcMesVacio({ dividendo: d.dividendo, ggcc: gastosComunes, contribuciones: contribTrim });
        const declarada = (inputData.provisionMantencion ?? 0) > 0;
        const reset = resolverModeloCostos(inputData.methodologyVersion) === "v3" && (m?.capexPuestaAPuntoCLP ?? 0) > 0 && !declarada;
        const vacTxt = String(inputData.vacanciaMeses ?? 0).replace(".", ",");
        const credito = precioCLP - pieCLP;
        const plazoCred = Number(inputData.plazoCredito) || 0;
        const tasaCred = Number(inputData.tasaInteres) || 0;
        const neg = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;
        // Las filas que salen: las de $0 no se dibujan (gestión del arriendo es 2,7% del parque).
        const salidas: Array<{ k: string; v: number; tip: string; sub?: string }> = [
          { k: "Cuota del crédito", v: d.dividendo, tip: "Cuota mensual del crédito hipotecario (capital + interés).", sub: credito > 0 ? `${compact(credito)} a ${plazoCred} años al ${pct1(tasaCred)}%` : "sin crédito" },
          { k: "Gastos comunes", v: d.ggccVacancia, tip: "Los paga el arrendatario; los asumes tú los meses sin arrendar.", sub: `${money(gastosComunes)} completos; acá solo la vacancia` },
          { k: "Contribuciones", v: d.contribucionesMes, tip: "Impuesto territorial trimestral del SII, prorrateado a mensual. Lo paga el propietario.", sub: `${money(contribTrim)} al trimestre` },
          { k: "Vacancia", v: d.vacanciaProrrata, tip: "Ingreso perdido por meses sin arrendatario, prorrateado al mes.", sub: `${vacTxt} meses al año, prorrateados` },
          { k: "Mantención", v: d.mantencion, tip: "Provisión mensual para reparaciones y mantenimiento del depto.", sub: declarada ? "declarada por ti" : reset ? "recién puesto a punto: parte en la banda más baja y sube con los años" : undefined },
          { k: "Corretaje", v: d.corretajeProrrata, tip: "Comisión del corredor para captar arrendatario, prorrateada al mes." },
          { k: "Recambio", v: d.recambio, tip: "Costo de turnover entre arrendatarios: pintura, limpieza profunda y reparaciones menores, prorrateado al mes." },
          { k: "Gestión del arriendo", v: d.administracion, tip: "Comisión del corredor que gestiona el arriendo (publicación, cobranza, contacto arrendatario)." },
        ]
          .filter((r) => r.v > 0)
          .sort((a, b) => b.v - a.v);
        const isNeg = d.flujoNeto < 0;
        // LA SERIE Y SU DESCOMPOSICIÓN LAS HACE EL MOTOR (÷ meses operativos, diez años); acá
        // no se deriva nada, para que el gate lea lo mismo que el render.
        const serie = serieFlujoMensualPorAnioLtr(results.projections);
        const puntos: PuntoAnio[] = serie.map((p) => ({ anio: p.anio, v: p.flujoMensual }));
        const desc = descomposicionFlujoLtr(results.projections);
        const pie = desc ? pieCurvaFlujoLtr(desc, { mantencionPorBandas: !declarada, money }) : null;
        const cierre = cierreMesVacioLtr({ mesVacio, cuota: d.dividendo, gastosComunes, contribucionesMes: d.contribucionesMes, money });
        const pinta = (segs: SegFlujo[]) =>
          segs.map((s, i) => (s.b ? <b key={i} style={{ fontWeight: 600, color: s.rojo ? "var(--signal-red)" : "var(--doc-tx)" }}>{s.t}</b> : <span key={i}>{s.t}</span>));
        return (
          <>
            <VViz>
              <VSub>{ROTULO_MES_LTR}</VSub>
              {reparto && (() => {
                const fr = fraseReparto(reparto, "los gastos", money);
                return (
                  <p className="doc-reparto">
                    {fr.antes}
                    <b style={fr.sale ? { color: "var(--signal-red)" } : undefined}>{fr.monto}</b>
                    {fr.despues}
                  </p>
                );
              })()}
              <FilasDato>
                <FilaDato tono="in" k="Arriendo mensual" tip="Lo que entra cada mes, antes de cuota y gastos" sub={`${vacTxt} meses de vacancia al año, prorrateados`} v={money(arriendo)} unidad="/mes" />
                {salidas.map((r) => (
                  <FilaDato key={r.k} k={r.k} tip={r.tip} sub={r.sub} v={`−${money(r.v)}`} unidad="/mes" />
                ))}
                <FilaDato
                  tono="tot"
                  k={isNeg ? "Sale de tu bolsillo" : "Te queda"}
                  tip="Arriendo − cuota − gastos"
                  sub={SUB_TOTAL_MES_LTR}
                  v={<span style={{ color: isNeg ? "var(--signal-red)" : undefined }}>{`${isNeg ? "−" : "+"}${money(Math.abs(d.flujoNeto))}`}</span>}
                  unidad="/mes"
                />
              </FilasDato>
            </VViz>
            {puntos.length >= 2 && (
              <>
                <VPuente>Y lo mismo a diez años, que es donde se ve hacia dónde va.</VPuente>
                <VViz>
                  <VSub>Lo que queda cada mes, año por año</VSub>
                  <CurvaAnios puntos={puntos} fmt={neg} />
                  {pie && (
                    <p className="doc-reparto" style={{ marginTop: 2 }}>
                      {pinta(pie)}
                    </p>
                  )}
                </VViz>
              </>
            )}
            <VCierre titulo="Qué significa">{pinta(cierre)}</VCierre>
            <VFuente>Motor Franco · {ufFecha} · gastos y contribuciones declarados por ti · cada año a sus precios</VFuente>
          </>
        );
      })()}
      </>
    ),
  };
  // ═══════════════ III · CÓMO LO PAGAS ═══════════════
  // TRES BLOQUES ANCLADOS AL PRECIO RECOMENDADO (21-sep-2026, contrato
  // docs/wireframes/rediseno-informe/capitulo-como-lo-pagas.html): caro o barato → cómo
  // llegar al precio recomendado → puesta a punto. El modelo es `construirComoLoPagas`
  // (puro, compartido con STR); acá solo se juntan las entradas del motor LTR.
  //
  // LO QUE SALIÓ CON ESTO, y por qué: el drawer embebido (`DrawerNegociacion` con el prop
  // `capitulo`, que tenía dos bloques muertos por `!capitulo` y el hero de sobreprecio
  // inalcanzable), el dial de precio y el plan de cuatro precios —ninguno era el
  // recomendado: coincidían solo cuando la card no dibujaba el mix por redundante (65/65) y
  // en pantalla juntos diferían siempre—, la primera oferta a −5% (sin fuente), el
  // financiamiento (pie en el hero, cuota en el cap. II, movimiento en el pop-up) y la
  // línea del interés total (cola-popup-interes-total-del-credito).
  // `plazo` y `tasaPct` los leen los capítulos IV y V (pre-entrega, escenarios).
  const tasaPct = Number(inputData.tasaInteres) || 0;
  const plazo = Number(inputData.plazoCredito) || 0;
  const modeloPagas = construirComoLoPagas({
    modalidad: "LTR",
    veredicto: results.veredicto ?? veredicto,
    precioUF: inputData.precio,
    superficieM2: inputData.superficie,
    comuna,
    piePctActual: Number(inputData.piePct) || 0,
    plazoActual: Number(inputData.plazoCredito) || 0,
    distancia: dist?.valor ?? null,
    sobre,
    limiteTirUF: typeof results.negociacion?.precioLimiteUF === "number" && results.negociacion.precioLimiteUF > 0 ? results.negociacion.precioLimiteUF : null,
    mesCierraUF: typeof m.precioFlujoNeutroUF === "number" && m.precioFlujoNeutroUF > 0 ? m.precioFlujoNeutroUF : null,
    precioMaximoComprarUF: sens?.valor.precioMaximoComprarUF ?? null,
    caeA: sens?.valor.veredictoSobrePrecioMaximo ?? null,
    alternativa: lineaAlternativa,
    capex: capexV,
    valorUF,
  });
  const filaIII: FilaHallazgo = {
    id: "pagas",
    numero: "III",
    pregunta: "Cómo lo pagas",
    // §7: la fila dice el precio que manda. Con recomendación, el recomendado; en COMPRAR,
    // el de hoy (no hay descuento que pedir); sin salida, lo dice.
    valor: conApellido(
      modeloPagas.rec ? "Precio recomendado" : "Precio",
      modeloPagas.rec ? `UF ${ufN(modeloPagas.rec.precioUF)}` : modeloPagas.caso === "comprar" ? `UF ${ufN(inputData.precio)}` : "sin recomendación",
    ),
    valorRojo: false,
    anchorId: anchorCapitulo("pagas"),
    cuerpo: <CapituloComoLoPagas modelo={modeloPagas} valorUF={valorUF} />,
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
        // Período y fuente de ESTA comuna (plusvalia-procedencia.ts): antes el capítulo decía
        // "Providencia 2014-2024" con la cifra GfK 2015-2025 en la zona.
        const fuenteHist = v.fuente && !/umbral/i.test(v.fuente) ? v.fuente : fuenteHistoricaPlusvalia(comuna, v.tieneData);
        const rango = procedenciaPlusvalia(comuna).rango;
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
          valor: conApellido("Plusvalía", `${pct1(anual)}% anual`),
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
                  {/* F3 · el caveat del período. Va pegado a la frase que ya nombra el rango:
                      el pie declara el número y esta línea dice qué tiene ese número de raro.
                      Determinista (plusvalia-procedencia.ts); antes lo decía la prosa en 9 de
                      30 generaciones, o sea que en 21 el lector no se enteraba. */}
                  {glosaPeriodoPlusvalia(rango) ? ` ${glosaPeriodoPlusvalia(rango)}` : ""}
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
            valor: conApellido("Resultado", compact(patrimonio)),
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
                    <FilasDato>
                      <FilaDato k={`Depósito a plazo en UF al ${Math.round(INSTRUMENTOS_REFERENCIA.depositoUF * 100)}%`} tip={`${compact(inversionInicial)} a ${Math.round(INSTRUMENTOS_REFERENCIA.depositoUF * 100)}% anual por ${anios} años`} v={money(oport.depositoUF)} />
                      <FilaDato k={`Fondo mutuo al ${Math.round(INSTRUMENTOS_REFERENCIA.fondoMutuo * 100)}%`} tip={`${compact(inversionInicial)} a ${Math.round(INSTRUMENTOS_REFERENCIA.fondoMutuo * 100)}% anual por ${anios} años`} v={money(oport.fondoMutuo)} />
                      <FilaDato k="Este depto" tip={`Tu parte al vender el año ${anios}`} v={money(patrimonio)} tono="in" />
                    </FilasDato>
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
                      <FilasDato>
                        <FilaDato k="Valor de venta estimado" tip={`Precio de hoy proyectado a ${PROY_PCT}% al año por ${anios} años`} sub={`${PROY_PCT}% al año desde la compra`} v={money(exit.valorVenta)} />
                        <FilaDato k="Deuda pendiente" tip="Saldo del crédito al vender" sub={`lo que queda del crédito el año ${anios}`} v={`−${money(exit.saldoCredito)}`} tono="neg" />
                        <FilaDato k="Comisión de venta" tip="Corretaje de la venta" sub="2% del valor de venta" v={`−${money(exit.comisionVenta)}`} tono="neg" />
                        <FilaDato k="Te queda" tip="Valor − deuda − comisión" v={money(exit.equityCLP)} tono="tot" />
                      </FilasDato>
                    </div>
                    {plazo > 0 && liquidez > 0 && (
                      <div>
                        <h4>Si refinancias</h4>
                        <p className="ex">Sacas parte de tu plusvalía como liquidez sin vender ni pagar impuesto, a cambio de una cuota más alta.</p>
                        <FilasDato>
                          <FilaDato k="Nuevo crédito" tip={`Crédito nuevo sobre el valor del año ${anios}`} sub={`${Math.round(ltv * 100)}% del valor`} v={money(nuevoCredito)} />
                          <FilaDato k="Deuda pendiente" tip="Se paga con el crédito nuevo" v={`−${money(exit.saldoCredito)}`} tono="neg" />
                          <FilaDato k="Cuota nueva" tip="Dividendo del crédito nuevo" sub={`${plazo} años al ${pct1(tasaPct)}%`} v={money(cuotaNueva)} unidad="/mes" />
                          <FilaDato k="Liquidez sin vender" tip="Crédito nuevo − deuda pendiente" v={money(liquidez)} tono="tot" />
                        </FilasDato>
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