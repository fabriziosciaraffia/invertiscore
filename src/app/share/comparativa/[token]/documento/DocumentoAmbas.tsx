// ─────────────────────────────────────────────────────────────────────────
// DocumentoAmbas — vista DOCUMENTO del informe comparativo LTR vs STR (server
// component, sin estado). Implementa el contrato assets-export/mockup-pdf-ambas.html
// (5 hojas) + su anexo de variantes A-G. Es un INFORME DE DECISIÓN: no concatena
// los dos análisis, los enfrenta.
//
// Cero recálculo: consume los results ya recomputados por la ruta (homologados a
// la UF congelada del LTR) y los builders puros compartidos con la web
// (comparativa-hero-copy, comparativa-apertura, comparativa-findings).
//
// Prosa IA (comparativaAI): 3 movimientos en slots que degradan en silencio —
// Plan C, el documento queda completo sin ellos (el motor escribe apertura,
// veredicto, posición y hallazgos).
// ─────────────────────────────────────────────────────────────────────────

import type { FullAnalysisResult, AIAnalysisComparativa } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { normalizeLegacyVerdict, metricaODefault, esMetricaNoAplica } from "@/lib/types";
import { NO_APLICA_VALOR, NO_APLICA_FOOTNOTE_DOC_AMBAS } from "@/lib/no-aplica-copy";
import { readVeredicto } from "@/lib/results-helpers";
import { fmtMoney, fmtUF } from "@/components/analysis/utils";
import { deriveRecomendacionFallback } from "@/lib/comparativa-recomendacion";
import {
  resolverEstado, VERDICT_LABEL, SUB, FRANCO_POS,
  SEGMENT_ORDER, SEGMENT_SHORT, SEGMENT_POS, FRAGIL_BANNER,
} from "@/lib/comparativa-hero-copy";
import { buildAperturaComparativa } from "@/lib/comparativa-apertura";
import { ctxFromResults, buildFindingsComparativa } from "@/lib/comparativa-findings";
import type { BandaComparativa } from "@/lib/engines/str-universo-santiago";
import { tieneEstacionalidad } from "@/app/analisis/renta-corta/[id]/documento/FlujoEstacionalChartSVG";
import { PatrimonioComparativoSVG, FlujoComparadoSVG } from "./ChartsComparativaSVG";

const pct = (n: number, d = 1) => n.toFixed(d).replace(".", ",") + "%";
const dec = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
function verdictClass(v: Verdict): string {
  if (v === "COMPRAR") return "comprar";
  if (v === "BUSCAR OTRA") return "buscar";
  return "ajusta";
}

export interface DocumentoAmbasProps {
  token: string;
  ltrResults: FullAnalysisResult | null;
  strResults: ShortTermResult | null;
  ai: AIAnalysisComparativa | null;
  ltrInput: Record<string, unknown> | null;
  strInput: Record<string, unknown> | null;
  ltrScore: number;
  strScore: number;
  ufFrozen: number;
  comuna: string;
  direccionLabel: string;
  costoAmoblamiento: number;
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;
  edificioPermiteAirbnb: string;
}

export function DocumentoAmbas({
  token, ltrResults, strResults, ai, ltrInput,
  ltrScore, strScore, ufFrozen, comuna, direccionLabel,
  costoAmoblamiento, modoGestion, comisionAdministrador, edificioPermiteAirbnb,
}: DocumentoAmbasProps) {
  const money = (n: number) => fmtMoney(n, "CLP", ufFrozen);
  const zona = comuna || "tu zona";

  // ── Variante A/B — banda, estado y copy motor-templated ──
  const recomendacion = deriveRecomendacionFallback(strResults);
  const fragil = strResults?.veredictoComparativo?.fragil ?? false;
  const estado = resolverEstado(recomendacion, fragil);
  const banda: BandaComparativa =
    strResults?.veredictoComparativo?.banda ??
    (fragil ? "STR_FRAGIL" : (recomendacion as BandaComparativa));
  const apertura = buildAperturaComparativa({ topId: "flujo", topLado: "neutro", banda });

  // ── Variante G — veredicto propio de cada modalidad ──
  const ltrVerdict = (readVeredicto(ltrResults) ?? "AJUSTA SUPUESTOS") as Verdict;
  const strVerdict = normalizeLegacyVerdict(strResults?.veredicto ?? "AJUSTA SUPUESTOS") as Verdict;

  // ── Métricas por lado (mismas derivaciones que la web comparativa) ──
  const ltrNOIMensual = (ltrResults?.metrics?.noi ?? 0) / 12;
  const ltrFlujoMensual = ltrResults?.metrics?.flujoNetoMensual ?? 0;
  const ltrRetorno = ltrResults as unknown as { retorno?: { inversionInicial?: number }; exitScenario?: { inversionInicial?: number } } | null;
  const ltrCapital = ltrRetorno?.retorno?.inversionInicial ?? ltrRetorno?.exitScenario?.inversionInicial ?? ltrResults?.metrics?.pieCLP ?? 0;
  // Pie cero (RESUELTO · mockup pie-cero-ambas.html): con pie 0 la TIR LTR es
  // 'no_aplica' y aplanarla a 0 no dejaba un hueco — dejaba una MENTIRA con
  // ganador: winMoney comparaba ese cero contra la TIR STR (que el motor sigue
  // entregando como number, decisión de fase 1-2 documentada en
  // short-term-score.ts:369) y le daba la fila a renta corta. En el seed AG-6
  // (LTR_PREFERIDO) eso contradecía al veredicto de la hoja 1 y a las otras 7
  // filas. Tratamiento SIMÉTRICO: si la métrica no aplica de un lado, la fila no
  // compara — las dos celdas dicen "No aplica*" y ninguna gana. El flag va acá y
  // no depende del motor STR: cuando una rama futura migre `tirAnual` a
  // MetricaSobreCapital, esta fila ya se comporta igual.
  const tirNoAplica = esMetricaNoAplica(ltrResults?.exitScenario?.tir);
  const ltrTir = metricaODefault(ltrResults?.exitScenario?.tir, 0);
  const ltrCap = ltrResults?.metrics?.rentabilidadNeta ?? 0;

  const strBase = strResults?.escenarios?.base;
  const strNOIMensual = strBase?.noiMensual ?? 0;
  const strFlujoMensual = strBase?.flujoCajaMensual ?? 0;
  const strCapital = strResults?.capitalInvertido ?? 0;
  // Rama A: `tirAnual` STR pasó a MetricaSobreCapital. Solo se usa en la rama
  // pie > 0 de la fila (con pie 0 la fila entera es "No aplica*"), pero el
  // desenvuelto es obligatorio: la unión no es un number.
  const strTir = metricaODefault(strResults?.exitScenario?.tirAnual, 0);
  const strCap = (strBase?.capRate ?? 0) * 100;

  const ltrProj = ltrResults?.projections ?? [];
  const strProj = strResults?.projections ?? [];
  const idxPat = Math.min(ltrProj.length, strProj.length, 10) - 1;
  const ltrPatY10 = idxPat >= 0 ? (ltrProj[idxPat]?.patrimonioNeto ?? 0) : 0;
  const strPatY10 = idxPat >= 0 ? (strProj[idxPat]?.patrimonioNeto ?? 0) : 0;
  const patrimonioIgual = Math.abs(strPatY10 - ltrPatY10) < Math.max(1, Math.abs(ltrPatY10) * 0.005);

  // ── Riqueza acumulada = activo + flujo acumulado ─────────────────────────
  // El activo empata por construcción (se aprecia y se amortiza igual arriendes
  // corto o largo). Lo que separa a las modalidades es cuánto pusiste —o te
  // dejaron— por el camino. Mismas series que alimentan el chart, para que el
  // copy y la curva no puedan contradecirse.
  const ltrFlujoAcumY10 = idxPat >= 0 ? (ltrProj[idxPat]?.flujoAcumulado ?? 0) : 0;
  const strFlujoAcumY10 = idxPat >= 0 ? (strProj[idxPat]?.flujoAcumulado ?? 0) : 0;
  const riquezaLtrY10 = ltrPatY10 + ltrFlujoAcumY10;
  const riquezaStrY10 = strPatY10 + strFlujoAcumY10;
  const brechaRiqueza = riquezaLtrY10 - riquezaStrY10;
  const ganadoraRiqueza = brechaRiqueza >= 0 ? "renta larga" : "renta corta";
  // Los dos flujos acumulados son negativos en el caso típico (pones de tu
  // bolsillo). Si alguna modalidad acumula caja positiva, la frase se invierte.
  const ambosAportan = ltrFlujoAcumY10 <= 0 && strFlujoAcumY10 <= 0;

  // ── Face-off: columna "Mejor" por comparación simple (cero derivación nueva) ──
  const winMoney = (l: number, s: number, altoGana = true) =>
    l === s ? "—" : (altoGana ? s > l : s < l) ? "STR" : "LTR";
  const rows: { label: string; sub?: string; l: string; s: string; lNeg?: boolean; sNeg?: boolean; win: string; txt?: boolean; tie?: string; na?: boolean }[] = [
    { label: "NOI mensual", sub: "neto de gastos, antes de la cuota", l: money(ltrNOIMensual), s: money(strNOIMensual), win: winMoney(ltrNOIMensual, strNOIMensual) },
    { label: "Flujo mensual", sub: "después de la cuota", l: money(ltrFlujoMensual), s: money(strFlujoMensual), lNeg: ltrFlujoMensual < 0, sNeg: strFlujoMensual < 0, win: winMoney(ltrFlujoMensual, strFlujoMensual) },
    { label: "Rentabilidad neta / CAP", l: pct(ltrCap), s: pct(strCap), win: winMoney(ltrCap, strCap) },
    // Simetría deliberada: con pie 0 la celda STR tampoco muestra su número, aunque
    // el motor lo entregue. `win: "—"` + `na: true` apagan el realce y TODA etiqueta
    // de la fila — incluida la de empate, que acá sería tan falsa como el 0%: no
    // empatan, no aplica.
    tirNoAplica
      ? { label: "TIR a 10 años", l: `${NO_APLICA_VALOR}*`, s: `${NO_APLICA_VALOR}*`, win: "—", na: true }
      : { label: "TIR a 10 años", l: pct(ltrTir), s: pct(strTir), win: winMoney(ltrTir, strTir) },
    { label: "Capital de entrada", l: money(ltrCapital), s: money(strCapital), win: winMoney(ltrCapital, strCapital, false) },
    { label: "Esfuerzo operativo", l: "~0,5 hrs/sem", s: modoGestion === "auto" ? "8-12 hrs/sem" : `${Math.round(comisionAdministrador * 100)}% al admin`, win: "LTR", txt: true },
    { label: "Riesgo principal", l: "Vacancia entre arriendos", s: "Estacionalidad + ocupación", win: "LTR", txt: true },
    // "Activo neto de deuda", no "patrimonio": la fila mide el activo, que empata
    // por construcción. El patrimonio que sí separa a las modalidades (la riqueza,
    // con el flujo acumulado adentro) vive en el chart y su anotación.
    { label: "Activo neto de deuda a 10 años", l: money(ltrPatY10), s: money(strPatY10), win: patrimonioIgual ? "—" : winMoney(ltrPatY10, strPatY10), tie: "igual en las dos" },
  ];

  // ── Hallazgos comparativos (builder puro compartido con la web) ──
  const ctx = ctxFromResults(ltrResults, strResults, {
    modoGestion, comisionAdministrador, costoAmoblamiento, edificioPermiteAirbnb,
  });
  const findings = ctx ? buildFindingsComparativa(ctx, "CLP", ufFrozen) : [];

  // ── Variante F — el flip de gestión como bisagra ──
  const flip = strResults?.veredictoComparativo?.flipGestion;
  const strAuto = strResults?.comparativa?.str_auto;
  const strAdmin = strResults?.comparativa?.str_admin;
  const comisionPct = Math.round(comisionAdministrador * 100);

  // ── Sensibilidad (P25–P90 · percentiles de ingresos de la zona) ──
  const sens = strResults?.sensibilidad ?? [];
  const breakEvenPct = (strResults?.breakEvenPctDelMercado ?? 0) * 100;
  // P3 (Rama 0b) — cuando el % de sobre-renta no es confiable la celda cae a CLP absoluto.
  // Sin glosa eso se lee como columna incompleta. `ltr_noiMensual = noiMensual − sobreRenta`
  // es identidad exacta del motor (short-term-engine.ts:1114) y es constante entre filas.
  // Filas legacy sin el flag (persistidas antes de P3) caen al mismo camino: undefined es falsy.
  const hayPctNoConfiable = sens.some((r) => !r.sobreRentaPctConfiable);
  const ltrNoiSens = sens.length > 0 ? sens[0].noiMensual - sens[0].sobreRenta : 0;

  // ── Charts (series server-side) ──
  // flujoAcumulado viaja con la serie: el chart construye las dos curvas de
  // riqueza con él (activo + flujo). Sin este campo el chart solo puede dibujar
  // el activo, que es idéntico en las dos modalidades.
  const patLtr = ltrProj.slice(0, 10).map((p) => ({ anio: p.anio, patrimonioNeto: p.patrimonioNeto, flujoAcumulado: p.flujoAcumulado }));
  const patStr = strProj.slice(0, 10).map((p) => ({ anio: p.year, patrimonioNeto: p.patrimonioNeto, flujoAcumulado: p.flujoAcumulado }));
  const flujoEstacional = strResults?.flujoEstacional ?? [];
  const hayEstacionalidad = tieneEstacionalidad(flujoEstacional);

  // ── Supuestos ──
  const precioUF = Number(ltrInput?.precio) || 0;
  const superficie = Number(ltrInput?.superficie) || 0;
  const piePct = Number(ltrInput?.piePct) || 20;
  const plazoAnios = Number(ltrInput?.plazoCredito) || 25;
  const tasaPct = Number(ltrInput?.tasaInteres) || 0;
  const arriendoLtr = Number(ltrInput?.arriendo) || 0;
  const adr = strResults?.ejesAplicados?.adrFinal ?? strBase?.adrReferencia ?? 0;
  const occPct = Math.round((strResults?.ejesAplicados?.ocupacionFinal ?? strBase?.ocupacionReferencia ?? 0) * 100);

  // ── Prosa IA (3 movimientos · degradan en silencio) ──
  const mov1 = ai?.conviene?.quienDeberiasSer?.trim();
  const mov2 = ai?.conviene?.switchPath?.trim();
  const cierreCondicion = ai?.conviene?.cierre?.trim();

  return (
    <div className="franco-doc" data-doc-ready>
      {/* ═══════════ HOJA 1 · VEREDICTO COMPARATIVO ═══════════ */}
      <section className="doc-section">
        <p className="eyebrow">Análisis comparativo · renta larga (LTR) vs renta corta (STR)</p>
        <h1 className="display">{direccionLabel || `Depto en ${zona}`}</h1>
        <p className="body sec" style={{ marginTop: 6 }}>Mismo depto, dos estrategias. Cuál te conviene depende menos de la plata de lo que crees.</p>

        <div className="prop-meta">
          <div className="cell"><p className="k">Superficie</p><div className="v">{superficie} m²</div></div>
          <div className="cell"><p className="k">Precio</p><div className="v">{fmtUF(precioUF)}</div></div>
          <div className="cell"><p className="k">Pie</p><div className="v">{piePct}%</div></div>
          <div className="cell"><p className="k">Financiamiento</p><div className="v">{plazoAnios} años · {dec(tasaPct)}%</div></div>
          <div className="cell"><p className="k">Dividendo</p><div className="v">{money(ltrResults?.metrics?.dividendo ?? 0)}/mes</div></div>
          <div className="cell"><p className="k">Gestión del corto</p><div className="v">{modoGestion === "auto" ? "Autogestión" : `Admin ${comisionPct}%`}</div></div>
        </div>

        {/* Variantes A + B — badge por estado + barra de segmentos */}
        <div className="reco avoid-break">
          <span className={`badge ${estado}`}>{VERDICT_LABEL[estado]}</span>
          <p className="headline">{SUB[estado]}</p>
          <div className="segments">
            <div className="track" />
            <div className="dotwrap">
              <div className={`dot ${estado === "fragil" ? "fragil" : ""}`} style={{ left: `${SEGMENT_POS[estado]}%` }} />
            </div>
            <div className="axis">
              {SEGMENT_ORDER.map((s) => (
                <span key={s} className={s === estado ? `on ${s === "fragil" ? "fragil" : ""}` : ""}>{SEGMENT_SHORT[s]}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Variante D — banner de fragilidad (condicional) */}
        {fragil && (
          <div className="fragil-banner">
            <p className="fl">{FRAGIL_BANNER.kicker}</p>
            <p className="ft">{FRAGIL_BANNER.cuerpo}</p>
          </div>
        )}

        {/* Variante G — mini-scores con veredicto propio */}
        <div className="minis">
          <div className="mini">
            <p className="ml">Renta larga (LTR)</p>
            <div className="mrow">
              <span className="mscore">{ltrScore}<small>/100</small></span>
              <span className={`mbadge ${verdictClass(ltrVerdict)}`}>{ltrVerdict}</span>
            </div>
          </div>
          <div className="mini">
            <p className="ml">Renta corta (STR)</p>
            <div className="mrow">
              <span className="mscore">{strScore}<small>/100</small></span>
              <span className={`mbadge ${verdictClass(strVerdict)}`}>{strVerdict}</span>
            </div>
          </div>
        </div>

        {/* Variante E — apertura motor-templated por banda (afirmable sin IA) */}
        <div className="exec avoid-break"><p>{apertura}</p></div>

        <div className="cover-lower avoid-break">
          <div>
            <p className="block-label">Supuestos del análisis</p>
            <div className="assump">
              <span className="grouplbl">Compartidos</span>
              <span className="ak">Precio · pie</span><span className="av">{fmtUF(precioUF)} <span className="u">· {piePct}%</span></span>
              <span className="ak">Crédito</span><span className="av">{plazoAnios} años <span className="u">· {dec(tasaPct)}%</span></span>
              <span className="ak">Dividendo</span><span className="av">{money(ltrResults?.metrics?.dividendo ?? 0)} <span className="u">/mes</span></span>
              <span className="sep" />
              <span className="grouplbl">Renta larga</span>
              <span className="ak">Arriendo</span><span className="av">{money(arriendoLtr)} <span className="u">/mes</span></span>
              <span className="sep" />
              <span className="grouplbl">Renta corta</span>
              <span className="ak">Tarifa diaria promedio (ADR)</span><span className="av">{money(adr)}</span>
              <span className="ak">Ocupación · gestión</span><span className="av">{occPct}% <span className="u">· {modoGestion === "auto" ? "autogestión" : `admin ${comisionPct}%`}</span></span>
              {costoAmoblamiento > 0 && (<><span className="ak">Amoblamiento</span><span className="av">{money(costoAmoblamiento)}</span></>)}
            </div>
          </div>
          <div>
            <p className="block-label">En este informe</p>
            <div className="toc">
              <div className="titem"><span className="tno">·</span><span className="tname">De un vistazo · frente a frente</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">·</span><span className="tname">El detalle · {findings.length} hallazgos</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">02</span><span className="tname">Renta larga · el caso</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">03</span><span className="tname">Renta corta · el caso</span><span className="tlead" /></div>
              <div className="titem tcrit"><span className="tno">04</span><span className="tname">La decisión · dónde se cruzan</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">·</span><span className="tname">Versión interactiva</span><span className="tlead" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ HOJA 2 · DE UN VISTAZO + EVIDENCIA ═══════════ */}
      <section className="doc-section break-page">
        <p className="eyebrow">De un vistazo · frente a frente</p>
        <h2 className="title">El destino es el mismo; el camino, distinto</h2>
        <p className="body sec" style={{ marginTop: 6, marginBottom: 12 }}>
          Cada número sale del análisis propio de su modalidad. La columna «mejor» compara la fila, nada más.
        </p>

        <div className="faceoff">
          <div className="hdr">
            <div>Indicador</div>
            <div className="hl">Renta larga <span className="modtag">LTR</span></div>
            <div className="hl">Renta corta <span className="modtag">STR</span></div>
          </div>
          {rows.map((r) => (
            <div className="row" key={r.label}>
              <div className="m">{r.label}{r.sub && <> <small>· {r.sub}</small></>}</div>
              <div className={`val ${r.txt ? "txt" : ""} ${r.na ? "na" : ""} ${r.lNeg ? "neg" : ""} ${r.win === "LTR" ? "col-win" : ""}`}>
                {r.l}{r.win === "LTR" && <small>gana larga</small>}
              </div>
              <div className={`val ${r.txt ? "txt" : ""} ${r.na ? "na" : ""} ${r.sNeg ? "neg" : ""} ${r.win === "STR" ? "col-win" : ""}`}>
                {r.s}{r.win === "STR" && <small>gana corta</small>}
                {r.win === "—" && !r.na && <small>{r.tie ?? "empatan"}</small>}
              </div>
            </div>
          ))}
          {/* Footnote del asterisco: una sola línea, antes del cierre narrativo. */}
          {tirNoAplica && <div className="fn">{NO_APLICA_FOOTNOTE_DOC_AMBAS}</div>}
          <div className="foot">
            {patrimonioIgual
              ? `A 10 años el activo es el mismo con cualquiera de las dos: el depto se aprecia igual y la deuda se amortiza igual. Lo que cambia es cuánto pones de tu bolsillo por el camino${brechaRiqueza !== 0 ? ` — y eso abre una diferencia de ${money(Math.abs(brechaRiqueza))} a favor de la ${ganadoraRiqueza}` : ""}.`
              : `A 10 años la diferencia de activo entre las dos es de ${money(Math.abs(strPatY10 - ltrPatY10))}. Lo que más separa a las modalidades no es dónde llegas, sino cuánta caja y cuántas horas te pide llegar.`}
          </div>
        </div>

        <p className="eyebrow" style={{ marginTop: 16 }}>La evidencia · mismo destino, dos caminos</p>
        <div className="chart-grid">
          <div>
            <p className="sbl">Patrimonio y riqueza · {Math.min(patLtr.length, patStr.length)} años</p>
            {patLtr.length > 1 && patStr.length > 1 ? (
              <>
                <PatrimonioComparativoSVG ltr={patLtr} str={patStr} valorUF={ufFrozen} />
                <div className="chart-legend">
                  <span><i className="sw line" />Activo · ambas</span>
                  <span><i className="sw thin" />Riqueza · larga</span>
                  <span><i className="sw thin-dash" />Riqueza · corta</span>
                </div>
                <p className="chart-annot">
                  El activo termina en <span className="m">{money(ltrPatY10)}</span> con cualquiera de las dos: el depto se aprecia igual y la deuda se amortiza igual.{" "}
                  {ambosAportan
                    ? "Lo que cambia es cuánto pones de tu bolsillo por el camino. Descontándolo, terminas con "
                    : "Lo que cambia es el flujo que acumula cada una por el camino. Contándolo, terminas con "}
                  <span className="m">{money(riquezaLtrY10)}</span> en renta larga y <span className="m">{money(riquezaStrY10)}</span> en renta corta.
                </p>
              </>
            ) : (
              <div className="chart-slot">Sin proyecciones disponibles para una de las modalidades.</div>
            )}
          </div>
          <div>
            <p className="sbl">Flujo mensual · 12 meses</p>
            {hayEstacionalidad ? (
              <>
                <FlujoComparadoSVG meses={flujoEstacional} flujoLtrMensual={ltrFlujoMensual} valorUF={ufFrozen} />
                <div className="chart-legend">
                  <span><i className="sw ink" />Corto positivo</span>
                  <span><i className="sw red" />Corto · aportas</span>
                  <span><i className="sw dash" />Largo plano</span>
                </div>
              </>
            ) : (
              <div className="chart-slot">
                Sin curva estacional observada para esta propiedad: los ingresos de referencia no traen distribución mes a mes. El corto promedia {money(strFlujoMensual)} al mes; el largo, {money(ltrFlujoMensual)}.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ HOJA 3 · HALLAZGOS COMPARATIVOS ═══════════ */}
      <section className="doc-section break-page">
        <p className="eyebrow">El detalle · {findings.length} hallazgos</p>
        <h2 className="title">Dónde se juega la diferencia</h2>
        <p className="body sec" style={{ marginTop: 6, marginBottom: 2 }}>
          Solo lo que habla de la comparación — no las dos pirámides completas. Cada frase es la lectura determinística del análisis.
        </p>
        {findings.map((f, i) => (
          <div className="hall" key={f.id}>
            <div className="rank">{i + 1}</div>
            <div>
              <p className="h-titular">{f.titular}</p>
              <p className="h-frase">{f.cuerpo}</p>
            </div>
            <div className="h-val">
              <div className={`hv ${f.kpiRed ? "neg" : ""}`}>{f.kpi}</div>
              <div className="hd">{f.ksub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ═══════════ HOJA 4 · LOS DOS CASOS ═══════════ */}
      <section className="doc-section break-page">
        <div className="chapter"><span className="no">02</span><h2 className="subtitle">Renta larga — el caso, en corto</h2></div>
        <div className="chips">
          <p className="cl">Renta larga · veredicto propio: {ltrVerdict} <span style={{ color: "var(--text-muted)" }}>· score {ltrScore}</span></p>
          <div className="grid g4">
            <div className="c"><p className="ck">NOI mensual</p><div className="cv">{money(ltrNOIMensual)}</div></div>
            <div className="c"><p className="ck">Flujo mensual</p><div className={`cv ${ltrFlujoMensual < 0 ? "neg" : "pos"}`}>{money(ltrFlujoMensual)}</div></div>
            <div className="c"><p className="ck">Rent. neta</p><div className="cv">{pct(ltrCap)}</div></div>
            <div className="c"><p className="ck">TIR a 10 años</p><div className="cv">{pct(ltrTir)}</div></div>
          </div>
          <p className="foot">
            {ltrFlujoMensual < 0
              ? `El arriendo de ${money(arriendoLtr)} no alcanza a cubrir la cuota: pones ${money(Math.abs(ltrFlujoMensual))} de tu bolsillo cada mes. La palanca del largo es el precio de entrada.`
              : `El arriendo de ${money(arriendoLtr)} cubre la cuota y te deja ${money(ltrFlujoMensual)} al mes. El largo se sostiene solo, con poco esfuerzo operativo.`}
          </p>
        </div>
        <p className="note" style={{ marginBottom: 16 }}>Análisis LTR completo (hallazgos, negociación, largo plazo, riesgos) en la versión interactiva y en su PDF propio.</p>

        <div className="divider" />

        <div className="chapter"><span className="no">03</span><h2 className="subtitle">Renta corta — el caso, en corto</h2></div>
        <div className="chips">
          <p className="cl">Renta corta · veredicto propio: {strVerdict} <span style={{ color: "var(--text-muted)" }}>· score {strScore}</span></p>
          <div className="grid g4">
            <div className="c"><p className="ck">NOI mensual</p><div className="cv">{money(strNOIMensual)}</div></div>
            <div className="c"><p className="ck">Flujo mensual</p><div className={`cv ${strFlujoMensual < 0 ? "neg" : "pos"}`}>{money(strFlujoMensual)}</div></div>
            <div className="c"><p className="ck">CAP rate</p><div className={`cv ${strCap < 5 ? "neg" : "pos"}`}>{pct(strCap)}</div></div>
            <div className="c"><p className="ck">TIR a 10 años</p><div className="cv">{pct(strTir)}</div></div>
          </div>
          <p className="foot">
            Con ocupación {occPct}% ({modoGestion === "auto" ? "autogestión" : `administrador ${comisionPct}%`}), el corto deja {money(strNOIMensual)} de NOI. Su punto de equilibrio está en el {Math.round(breakEvenPct)}% de lo que rinde la zona.
          </p>
        </div>

        {strAuto && strAdmin && (
          <>
            <p className="sbl">Qué cambia según quién opera</p>
            <div className="gest">
              <div className="hdr">
                <div>Renta corta</div>
                <div className={modoGestion === "auto" ? "hl" : ""}>Autogestión · 3%</div>
                <div className={modoGestion === "admin" ? "hl" : ""}>Administrador · {comisionPct}%</div>
              </div>
              <div className="row"><div className="gm">NOI mensual</div><div className={`gv ${modoGestion === "auto" ? "col-hl" : ""}`}>{money(strAuto.noiMensual)}</div><div className={`gv ${modoGestion === "admin" ? "col-hl" : ""}`}>{money(strAdmin.noiMensual)}</div></div>
              <div className="row"><div className="gm">Flujo mensual</div><div className={`gv ${strAuto.flujoCajaMensual < 0 ? "neg" : "pos"} ${modoGestion === "auto" ? "col-hl" : ""}`}>{money(strAuto.flujoCajaMensual)}</div><div className={`gv ${strAdmin.flujoCajaMensual < 0 ? "neg" : "pos"} ${modoGestion === "admin" ? "col-hl" : ""}`}>{money(strAdmin.flujoCajaMensual)}</div></div>
              {flip && (
                <div className="row"><div className="gm">Recomendación</div><div className={`gv ${modoGestion === "auto" ? "col-hl" : ""}`}>{flip.recomendacionAuto === "LTR_PREFERIDO" ? "LTR preferido" : flip.recomendacionAuto === "STR_VENTAJA_CLARA" ? "STR ventaja clara" : "Indiferente"}</div><div className={`gv ${flip.recomendacionAdmin === "LTR_PREFERIDO" ? "neg" : ""} ${modoGestion === "admin" ? "col-hl" : ""}`}>{flip.recomendacionAdmin === "LTR_PREFERIDO" ? "LTR preferido" : flip.recomendacionAdmin === "STR_VENTAJA_CLARA" ? "STR ventaja clara" : "Indiferente"}</div></div>
              )}
            </div>
          </>
        )}
        <p className="note" style={{ marginBottom: 0 }}>La estacionalidad mes a mes y el detalle STR completo viven en la versión interactiva y en su PDF propio.</p>
      </section>

      {/* ═══════════ HOJA 5 · LA DECISIÓN + CIERRE ═══════════ */}
      <section className="doc-section break-page">
        <div className="chapter crit"><span className="no">04</span><h2 className="subtitle">La decisión — dónde se cruzan</h2></div>

        {/* Movimiento IA 1 — degrada en silencio */}
        {mov1 && <p className="body">{mov1}</p>}

        {/* Variante F — la bisagra: flip de gestión (3 ramas) */}
        {strAuto && strAdmin && (
          <div className="strat">
            <p className="sl">{flip?.cambiaVeredicto ? "La bisagra · quién opera" : "Quién opera · cuánto pesa"}</p>
            <p className="st">
              {flip?.cambiaVeredicto ? (
                <>Operándolo tú (comisión 3%), el corto deja {money(strAuto.flujoCajaMensual)} al mes. Delegando en un administrador ({comisionPct}%), cae a {money(strAdmin.flujoCajaMensual)} — y ahí la recomendación se da vuelta. No hay un ganador absoluto; hay un ganador según tus horas.</>
              ) : (
                <>Entre autogestionar y delegar hay {money(Math.abs(strAuto.flujoCajaMensual - strAdmin.flujoCajaMensual))} al mes de diferencia, pero la recomendación no cambia: la modalidad que conviene es la misma operes tú o delegues. La gestión mueve el margen, no la decisión.</>
              )}
            </p>
          </div>
        )}

        {/* Sensibilidad — cuánto aguanta la ventaja */}
        {sens.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 4 }}>Cuánto aguanta la ventaja del corto</p>
            <div className="sens">
              <div className="hdr"><div>Nivel de mercado</div><div>Ingresos brutos/año</div><div>NOI mensual STR</div><div>Sobre-renta vs LTR</div></div>
              {sens.filter((r) => r.label !== "Promedio").map((r) => {
                const nivel = r.label === "P25" ? "cuarto bajo" : r.label === "P50" ? "base" : r.label === "P75" ? "cuarto alto" : r.label === "P90" ? "décimo sup." : "";
                const pos = r.sobreRenta >= 0;
                return (
                  <div className={`row ${r.label === "P50" ? "base" : ""}`} key={r.label}>
                    <div className="pk">{r.label} {nivel && <small>· {nivel}</small>}</div>
                    <div className="sv">{money(r.revenueAnual)}</div>
                    <div className="sv">{money(r.noiMensual)}</div>
                    <div className={`sv ${pos ? "pos" : "neg"}`}>
                      {r.sobreRentaPctConfiable
                        ? `${pos ? "+" : ""}${money(r.sobreRenta)} · ${pos ? "+" : ""}${Math.round(r.sobreRentaPct * 100)}%`
                        : <>{money(r.sobreRenta)} <small>· % n/a</small></>}
                    </div>
                  </div>
                );
              })}
            </div>
            {hayPctNoConfiable && (
              <p className="note">
                {ltrNoiSens <= 0
                  ? "El % queda en n/a: el arriendo largo deja NOI ≤ 0, así que dividirlo no entrega un porcentaje que signifique algo. Compara la diferencia en pesos."
                  : "El % queda en n/a donde el ratio se dispara sobre ±300% y deja de ordenar. Compara la diferencia en pesos."}
              </p>
            )}
            <div className={`box ${breakEvenPct > 100 ? "red" : ""}`}>
              <p className="bl">Dónde se cruza</p>
              <p className="bt">
                El corto empata sus costos facturando el {Math.round(breakEvenPct)}% de lo que rinde una operación típica de la zona.{" "}
                {breakEvenPct > 110
                  ? "Está pidiendo más de lo que la zona da: la ventaja no se sostiene sin superar al mercado."
                  : breakEvenPct > 90
                    ? "Es un margen sin colchón: un mal trimestre de ocupación da vuelta la comparación."
                    : "Cuadra facturando bajo el nivel típico, así que la ventaja aguanta un traspié."}
              </p>
            </div>
          </>
        )}

        {/* Movimiento IA 2 — degrada en silencio */}
        {mov2 && (
          <div className="box">
            <p className="bl">¿Y si migro después?</p>
            <p className="bt">{mov2}</p>
          </div>
        )}

        {/* Variante E — posición de Franco por estado (motor · afirmable sin IA) */}
        <p className="eyebrow" style={{ marginTop: 6 }}>Siendo franco</p>
        <div className="cierre">
          <p>{FRANCO_POS[estado]}{cierreCondicion ? ` ${cierreCondicion}` : ""}</p>
        </div>

        <div className="doc-close">
          <p className="cl">Versión interactiva de esta comparativa</p>
          <span className="clink">refranco<span className="ai">.ai</span>/share/comparativa/{token.slice(0, 8)}</span>
          <p className="cdis">Abre cada modalidad en detalle, cambia el modo de gestión y mira cómo se mueve la recomendación, ajusta ocupación y tarifa en vivo, y comparte la comparativa con quien quieras.</p>
        </div>

        <div className="legal">
          <p className="ll">Disclaimer</p>
          <p>
            <b style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Franco no es asesor financiero.</b> Este informe comparativo es referencial y educativo: no constituye una recomendación de inversión, una asesoría personalizada ni una oferta. Compara dos estrategias para el mismo depto; las cifras de renta corta se basan en supuestos de ocupación y tarifa —estimaciones de mercado (AirROI), no transacciones cerradas—, y ambas modalidades usan proyecciones que pueden no cumplirse. La regulación de arriendo por temporada del edificio debe confirmarse antes de operar en renta corta. Antes de decidir, contrasta los números y consulta a un profesional para tu caso. Análisis generado por Franco · refranco.ai · {direccionLabel || zona}, Santiago de Chile.
          </p>
        </div>
      </section>
    </div>
  );
}
