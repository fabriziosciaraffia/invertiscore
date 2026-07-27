// ─────────────────────────────────────────────────────────────────────────
// DocumentoLTR — vista DOCUMENTO del informe LTR (server component, sin estado).
// Implementa el contrato assets-export/mockup-pdf-ltr.html (v2.1). Cero
// recálculo ni lógica de motor: consume `results` (FullAnalysisResult ya
// recomputado por la ruta), `ai` (ai_analysis persistido) y los builders puros.
//
// Moneda: CLP fija (documento estático, sin toggle) — desviación documentada.
// Charts: slot placeholder con dimensiones correctas (GOAL-2 emite el SVG real).
// ─────────────────────────────────────────────────────────────────────────

import type {
  FullAnalysisResult,
  AnalisisInput,
  Veredicto,
  AIAnalysisV2,
  Hallazgo,
} from "@/lib/types";
import { ordenarHallazgosPiramide, esAdverso } from "@/components/analysis/PiramideHallazgos";
import { fmtUF, fmtMoney } from "@/components/analysis/utils";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { buildPatrimonioSeries } from "@/lib/patrimonio-series";
import { PatrimonioChartSVG } from "./PatrimonioChartSVG";

const pct = (n: number, d = 1) => n.toFixed(d).replace(".", ",") + "%";
const dec = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

function verdictClass(v: Veredicto): string {
  if (v === "COMPRAR") return "comprar";
  if (v === "BUSCAR OTRA") return "buscar";
  return "ajusta"; // AJUSTA SUPUESTOS
}

export interface DocumentoLTRProps {
  id: string;
  results: FullAnalysisResult;
  ai: AIAnalysisV2 | null;
  inputData: AnalisisInput | undefined;
  veredicto: Veredicto;
  score: number;
  ufFrozen: number;
  nombre: string | null;
  comuna: string | null;
  ciudad: string | null;
  direccionLabel: string;
  fechaCorta: string;
  zonaLugares: number | null;
}

export function DocumentoLTR({
  id,
  results,
  ai,
  inputData,
  veredicto,
  score,
  ufFrozen,
  comuna,
  ciudad,
  direccionLabel,
  zonaLugares,
}: DocumentoLTRProps) {
  const m = results.metrics;
  const money = (n: number) => fmtMoney(n, "CLP", ufFrozen);
  const zona = comuna || ciudad || "tu zona";

  // ── Portada — property metadata ──
  const precioUF = inputData?.precio ?? (m.precioCLP > 0 ? m.precioCLP / ufFrozen : 0);
  const superficie = inputData?.superficie ?? 0;
  const sujetoUfM2 = results.metrics.precioVsComuna?.sujetoUfM2 ?? (superficie > 0 ? precioUF / superficie : 0);
  const piePct = inputData?.piePct ?? 20;
  const plazoAnios = Number(inputData?.plazoCredito) || 25;
  const tasaPct = Number(inputData?.tasaInteres) || 4.1;
  const arriendoCLP = Number(inputData?.arriendo) || m.ingresoMensual || 0;

  // ── Desglose (4 dimensiones) ──
  const d = results.desglose;

  // ── Negociación (NegociacionScenario) ──
  const neg = results.negociacion;
  const razonNeg = neg?.razon ??
    "Este precio te alinea con comparables y mejora la matemática de la operación.";

  // ── Condiciones del gate COMPRAR (estado ACTUAL) ──
  const gates = [
    { label: "Flujo mensual ≥ 0", ok: m.flujoNetoMensual >= 0, val: money(m.flujoNetoMensual) },
    { label: "Rentabilidad neta ≥ 4%", ok: m.rentabilidadNeta >= 4, val: pct(m.rentabilidadNeta) },
    { label: "Plusvalía inmediata ≥ 0", ok: (m.plusvaliaInmediataFrancoPct ?? 0) >= 0, val: pct(m.plusvaliaInmediataFrancoPct ?? 0) },
  ];

  // ── Hallazgos (pirámide, orden Filosofía 1) ──
  const hallazgos = ordenarHallazgosPiramide(results, ai);
  const adversos = hallazgos.filter(esAdverso);
  const favorables = hallazgos.filter((h) => !esAdverso(h));

  // ── Exit scenario (waterfall + patrimonio) ──
  const exit = results.exitScenario;

  // ── Serie del chart de patrimonio (misma fuente que el chart web) ──
  const patrimonioRows = inputData
    ? buildPatrimonioSeries(results.projections, results.metrics, inputData, ufFrozen, exit.anios)
    : [];

  // ── AI narrative helpers (CLP fijo) ──
  const conviene = ai?.conviene;
  const costo = ai?.costoMensual;
  const negoc = ai?.negociacion;
  const largo = ai?.largoPlazo;
  const riesgos = ai?.riesgos; // OPTIONAL — retirado del prompt LTR; sólo legacy lo trae.

  const headline = conviene?.respuestaDirecta_clp || results.resumenEjecutivo;
  const plusvProyPct = pct(PLUSVALIA_PROYECCION_ANUAL * 100, 1);

  const HallRow = ({ h, rank }: { h: Hallazgo; rank: number }) => (
    <div className={`hall ${esAdverso(h) ? "adverso" : "favorable"}`}>
      <div className="rank">{rank}</div>
      <div>
        {h.titular && <p className="h-titular">{h.titular}</p>}
        <p className="h-frase">{h.fraseCanonica}</p>
      </div>
      <div className="h-val">
        <div className="hd">{esAdverso(h) ? "adverso" : "a favor"}</div>
      </div>
    </div>
  );

  let rank = 0;

  return (
    <div className="franco-doc" data-doc-ready>
      {/* ═══════════ SECCIÓN 1 · PORTADA / VEREDICTO ═══════════ */}
      <section className="doc-section">
        <p className="eyebrow">01 · Veredicto</p>
        <h1 className="display">{direccionLabel || `Depto en ${zona}`}</h1>
        <p className="body sec" style={{ marginTop: 6 }}>Análisis de inversión · renta larga (LTR)</p>

        <div className="prop-meta">
          <div className="cell"><p className="k">Superficie</p><div className="v">{superficie} m²</div></div>
          <div className="cell"><p className="k">Precio</p><div className="v">{fmtUF(precioUF)}</div></div>
          <div className="cell"><p className="k">$/m²</p><div className="v">UF {dec(sujetoUfM2)}</div></div>
          <div className="cell"><p className="k">Pie</p><div className="v">{piePct}%</div></div>
          <div className="cell"><p className="k">Financiamiento</p><div className="v">{plazoAnios} años · {dec(tasaPct)}%</div></div>
          <div className="cell"><p className="k">Arriendo</p><div className="v">{money(arriendoCLP)}/mes</div></div>
        </div>

        <div className="verdict avoid-break">
          <span className={`badge ${verdictClass(veredicto)}`}>{veredicto}</span>
          <p className="headline">{headline}</p>
        </div>

        <div className="score-wrap avoid-break">
          <div>
            <p className="score-label">Franco Score</p>
            <div className="score-num">{score}<small>/100</small></div>
          </div>
          <div>
            <div className="gauge"><div className="dot" style={{ left: `${Math.max(0, Math.min(100, score))}%` }} /></div>
            <div className="gauge-axis"><span>0 · Buscar otra</span><span>Ajusta</span><span>Comprar · 100</span></div>
          </div>
        </div>

        <div className="dims avoid-break">
          <div className="dim"><p className="dk">Rentabilidad</p><div className="dbar"><i style={{ width: `${d.rentabilidad}%` }} /></div><div className="dv">{Math.round(d.rentabilidad)}</div><div className="dw">peso 30%</div></div>
          <div className="dim"><p className="dk">Flujo de caja</p><div className="dbar"><i style={{ width: `${d.flujoCaja}%` }} /></div><div className="dv">{Math.round(d.flujoCaja)}</div><div className="dw">peso 25%</div></div>
          <div className="dim"><p className="dk">Plusvalía</p><div className="dbar"><i style={{ width: `${d.plusvalia}%` }} /></div><div className="dv">{Math.round(d.plusvalia)}</div><div className="dw">peso 25%</div></div>
          <div className="dim"><p className="dk">Eficiencia</p><div className="dbar"><i style={{ width: `${d.eficiencia}%` }} /></div><div className="dv">{Math.round(d.eficiencia)}</div><div className="dw">peso 20%</div></div>
        </div>

        <div className="exec avoid-break"><p>{results.resumenEjecutivo}</p></div>

        <div className="cover-lower avoid-break">
          <div>
            <p className="block-label">Supuestos del análisis</p>
            <div className="assump">
              <span className="ak">Pie</span><span className="av">{piePct}% <span className="u">· {money(m.pieCLP)}</span></span>
              <span className="sep" />
              <span className="ak">Plazo del crédito</span><span className="av">{plazoAnios} <span className="u">años</span></span>
              <span className="sep" />
              <span className="ak">Tasa de interés</span><span className="av">{dec(tasaPct)}% <span className="u">anual</span></span>
              <span className="sep" />
              <span className="ak">Dividendo mensual</span><span className="av">{money(m.dividendo)}</span>
              <span className="sep" />
              <span className="ak">Gastos comunes</span><span className="av">{money(Number(inputData?.gastos) || 0)} <span className="u">/mes</span></span>
              <span className="sep" />
              <span className="ak">Contribuciones</span><span className="av">{money(Number(inputData?.contribuciones) || 0)}</span>
              <span className="sep" />
              <span className="ak">Plusvalía proyectada</span><span className="av">{plusvProyPct} <span className="u">anual</span></span>
            </div>
          </div>
          <div>
            <p className="block-label">En este informe</p>
            <div className="toc">
              <div className="titem"><span className="tno">·</span><span className="tname">El detalle · {hallazgos.length} hallazgos</span><span className="tlead" /><span className="tpage">pág. 2</span></div>
              <div className="titem"><span className="tno">02</span><span className="tname">Costo mensual</span><span className="tlead" /><span className="tpage">pág. 3</span></div>
              <div className="titem tcrit"><span className="tno">03</span><span className="tname">Negociación</span><span className="tlead" /><span className="tpage">pág. 3</span></div>
              <div className="titem"><span className="tno">04</span><span className="tname">Largo plazo</span><span className="tlead" /><span className="tpage">pág. 4</span></div>
              <div className="titem tcrit"><span className="tno">05</span><span className="tname">La palanca del precio</span><span className="tlead" /><span className="tpage">pág. 5</span></div>
              <div className="titem"><span className="tno">06</span><span className="tname">Zona · simulación</span><span className="tlead" /><span className="tpage">pág. 6</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECCIÓN 2 · HALLAZGOS (abre hoja tras portada) ═══════════ */}
      <section className="doc-section break-page">
        <p className="eyebrow">El detalle · {hallazgos.length} hallazgos</p>
        <h2 className="title">Empezando por lo adverso</h2>
        <p className="body sec" style={{ marginTop: 6, marginBottom: 2 }}>
          Ordenados por cuánto pesan en la decisión. Cada frase es la lectura determinística del motor; el detalle abre su capítulo más adelante.
        </p>

        {adversos.length > 0 && <p className="hall-group-label first">Adversos — lo que baja el veredicto</p>}
        {adversos.map((h) => <HallRow key={h.id} h={h} rank={++rank} />)}

        {favorables.length > 0 && <p className="hall-group-label">Favorables — lo que lo sostiene</p>}
        {favorables.map((h) => <HallRow key={h.id} h={h} rank={++rank} />)}
      </section>

      {/* ═══════════ SECCIÓN 3 · 02 COSTO + 03 NEGOCIACIÓN ═══════════ */}
      <section className="doc-section">
        <div className="chapter"><span className="no">02</span><h2 className="subtitle">Costo mensual{costo?.pregunta ? ` — ${costo.pregunta}` : ""}</h2></div>
        {costo?.contenido_clp && <p className="body">{costo.contenido_clp}</p>}
        {costo?.cajaAccionable_clp && (
          <div className="box"><p className="bl">{costo.cajaLabel || "Hazte esta pregunta"}</p><p className="bt">{costo.cajaAccionable_clp}</p></div>
        )}

        <div className="divider" />

        <div className="chapter crit"><span className="no">03</span><h2 className="subtitle">Negociación{negoc?.pregunta ? ` — ${negoc.pregunta}` : " — dónde está la palanca"}</h2></div>
        {negoc?.contenido_clp && <p className="body">{negoc.contenido_clp}</p>}
        {negoc?.estrategiaSugerida_clp && (
          <div className="strat">
            <p className="sl">Estrategia sugerida</p>
            <p className="st">{negoc.estrategiaSugerida_clp}</p>
          </div>
        )}
      </section>

      {/* ═══════════ SECCIÓN 4 · 04 LARGO PLAZO ═══════════ */}
      <section className="doc-section">
        <div className="chapter"><span className="no">04</span><h2 className="subtitle">Largo plazo — de dónde sale tu retorno</h2></div>
        {largo?.contenido_clp && <p className="body">{largo.contenido_clp}</p>}

        <div className="chips">
          <p className="cl">Tu retorno vs el piso</p>
          <div className="grid g3">
            <div className="c"><p className="ck">Tu TIR</p><div className={`cv ${exit.tir >= 6 ? "pos" : "neg"}`}>{pct(exit.tir)}</div></div>
            <div className="c"><p className="ck">Piso exigible</p><div className="cv">6,0%</div></div>
            <div className="c"><p className="ck">Margen</p><div className={`cv ${exit.tir - 6 >= 0 ? "pos" : "neg"}`}>{(exit.tir - 6 >= 0 ? "+" : "") + dec(exit.tir - 6)} pts</div></div>
          </div>
          <p className="foot">6,0% es el mínimo que un crédito apalancado debe rendir para pagar el esfuerzo y la iliquidez de tener un depto.</p>
        </div>

        <div className="box avoid-break">
          <p className="bl">Patrimonio al año {exit.anios}</p>
          <p className="big">{money(exit.equityCLP)}</p>
          <p className="bt">
            Tras vender y saldar el crédito, tu parte es {money(exit.equityCLP)} frente a los {money(exit.totalAportado)} que aportaste — un multiplicador de {dec(exit.multiplicadorCapital)}× sobre lo que pusiste.
          </p>
        </div>
        {largo?.cajaAccionable_clp && (
          <div className="box"><p className="bl">{largo.cajaLabel || "Qué haces con esto"}</p><p className="bt">{largo.cajaAccionable_clp}</p></div>
        )}
      </section>

      {/* ═══════════ SECCIÓN 5 · LA PALANCA DEL PRECIO (NegociacionScenario) ═══════════ */}
      <section className="doc-section">
        <div className="chapter crit"><span className="no">05</span><h2 className="subtitle">La palanca: el precio</h2></div>

        {neg && (
          <div className="chips">
            <p className="cl">Precio objetivo · lo que el motor sugiere</p>
            <div className={`grid ${neg.precioLimiteUF != null ? "g3" : "g2"}`}>
              <div className="c"><p className="ck">Precio sugerido</p><div className="cv pos">{fmtUF(neg.precioSugeridoUF)}</div></div>
              <div className="c"><p className="ck">TIR al sugerido</p><div className="cv">{pct(neg.tirAlSugerido)}</div></div>
              {neg.precioLimiteUF != null && (
                <div className="c"><p className="ck">Techo (TIR 6%)</p><div className="cv">{fmtUF(neg.precioLimiteUF)}</div></div>
              )}
            </div>
            <p className="foot">
              {razonNeg} La TIR pasa de {pct(exit.tir)} a {pct(neg.tirAlSugerido)}.
              {neg.precioLimiteUF != null && (
                <> El <b>techo</b> es {fmtUF(neg.precioLimiteUF)}: por encima de ese precio la operación deja de rendir el 6% mínimo que un crédito apalancado debe pagar.</>
              )}
            </p>
          </div>
        )}

        <p className="eyebrow" style={{ marginTop: 2 }}>Qué exige el motor para COMPRAR — hoy</p>
        <div className="gatecheck">
          {gates.map((g) => (
            <div className="grow" key={g.label}>
              <span className={`gx ${g.ok ? "ok" : "no"}`}>{g.ok ? "✓" : "✗"}</span>
              <span className="gm">{g.label}</span>
              <span className={`gs ${g.ok ? "" : "red"}`}>hoy {g.val}</span>
            </div>
          ))}
          <p className="gatefoot">
            Las tres deben cumplirse a la vez para que el veredicto suba a Comprar. Negociar mueve estos números — cuánto exactamente, se recalcula con el precio de cierre en mano, no antes.
          </p>
        </div>

        {/* Riesgos: sólo si el análisis trae la sección (retirada del prompt LTR actual). */}
        {riesgos?.contenido_clp && (
          <>
            <p className="eyebrow" style={{ marginTop: 6 }}>Riesgos</p>
            <p className="body">{riesgos.contenido_clp}</p>
          </>
        )}

        {/* Cierre — posición personal de Franco (conviene.cajaAccionable). */}
        {conviene?.cajaAccionable_clp && (
          <>
            <p className="eyebrow" style={{ marginTop: 6 }}>Siendo franco</p>
            <div className="cierre"><p>{conviene.cajaAccionable_clp}</p></div>
          </>
        )}
      </section>

      {/* ═══════════ SECCIÓN 6 · SIMULACIÓN + ZONA + CIERRE (abre hoja propia) ═══════════ */}
      <section className="doc-section break-page">
        <p className="eyebrow">Simulación · patrimonio a {exit.anios} años</p>
        <h2 className="title">Cómo se construye tu patrimonio</h2>
        <p className="body sec" style={{ marginTop: 6, marginBottom: 14 }}>
          La simulación se congela al escenario base del análisis (plazo {exit.anios} años · plusvalía proyectada {plusvProyPct}). Los números no se recalculan aquí.
        </p>

        <div className="sim-grid">
          <div className="sim-block">
            <p className="sbl">09 · Patrimonio — barras apiladas</p>
            {patrimonioRows.length > 0 ? (
              <>
                <PatrimonioChartSVG rows={patrimonioRows} valorUF={ufFrozen} />
                <div className="chart-legend">
                  <span><i className="sw red" />Aporte acumulado</span>
                  <span><i className="sw ink50" />Valor depto</span>
                  <span><i className="sw line" />Patrimonio neto</span>
                </div>
              </>
            ) : (
              <div className="chart-slot">sin proyección disponible</div>
            )}
          </div>
          <div className="sim-block">
            <p className="sbl">08 · Indicadores @ {exit.anios} años</p>
            <div className="kpis">
              <div className="kpi"><p className="kk">TIR</p><div className="kv">{pct(exit.tir)}</div></div>
              <div className="kpi"><p className="kk">Rent. neta</p><div className="kv">{pct(m.rentabilidadNeta)}</div></div>
              <div className="kpi"><p className="kk">Cash-on-cash</p><div className={`kv ${m.cashOnCash < 0 ? "neg" : ""}`}>{pct(m.cashOnCash)}</div></div>
              <div className="kpi"><p className="kk">Múltiplo</p><div className="kv">{dec(exit.multiplicadorCapital)}×</div></div>
              <div className="kpi"><p className="kk">Rent. bruta</p><div className="kv">{pct(m.rentabilidadBruta)}</div></div>
              <div className="kpi"><p className="kk">Plusvalía proy.</p><div className="kv">{plusvProyPct}</div></div>
            </div>
          </div>
        </div>

        <p className="sbl" style={{ marginTop: 16 }}>10 · Venta a {exit.anios} años</p>
        <div className="waterfall">
          <div className="wrow"><span className="wl">Valor de venta estimado <span className="wl sub">(año {exit.anios})</span></span><span className="wv">{money(exit.valorVenta)}</span></div>
          <div className="wrow"><span className="wl sub">− Deuda pendiente del crédito</span><span className="wv neg">−{money(exit.saldoCredito)}</span></div>
          <div className="wrow"><span className="wl sub">− Comisión de venta</span><span className="wv neg">−{money(exit.comisionVenta)}</span></div>
          <div className="wrow total"><span className="wl">Recibes en la mano</span><span className="wv">{money(exit.equityCLP)}</span></div>
          <div className="wrow"><span className="wl sub">Sobre lo aportado ({money(exit.totalAportado)})</span><span className="wv">{dec(exit.multiplicadorCapital)}×</span></div>
        </div>

        <div className="zona">
          <div className="zicon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6A6A71" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" /></svg>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 3 }}>Zona · {zona}</p>
            <p className="zq">Análisis de zona disponible en la versión interactiva: metro, comparables y puntos de interés del radio del depto.</p>
          </div>
          {zonaLugares != null && <div className="zcount">{zonaLugares} lugares</div>}
        </div>

        <div className="doc-close">
          <p className="cl">Versión interactiva de este análisis</p>
          <span className="clink">refranco<span className="ai">.ai</span>/analisis/{id.slice(0, 8)}</span>
          <p className="cdis">Ajusta plazo, plusvalía y arriendo en vivo, abre cada hallazgo en detalle y comparte el análisis con quien quieras.</p>
        </div>

        <div className="legal">
          <p className="ll">Disclaimer</p>
          <p>
            <b style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Franco no es asesor financiero.</b> Este informe tiene carácter referencial y educativo: no constituye una recomendación de inversión, una asesoría personalizada ni una oferta. Las cifras se basan en supuestos y proyecciones que pueden no cumplirse, y datos de mercado estimados que conviene verificar en su fuente. Antes de tomar una decisión, contrasta los números y consulta a un profesional para tu situación particular. Análisis generado por Franco · refranco.ai · {direccionLabel || zona}, Santiago de Chile.
          </p>
        </div>
      </section>
    </div>
  );
}
