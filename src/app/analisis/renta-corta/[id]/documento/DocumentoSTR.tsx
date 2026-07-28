// ─────────────────────────────────────────────────────────────────────────
// DocumentoSTR — vista DOCUMENTO del informe STR (server component, sin estado).
// Implementa el contrato assets-export/mockup-pdf-str.html (6 hojas) + su anexo
// de variantes por veredicto (A-I). Cero recálculo ni lógica de motor: consume
// `results` (ShortTermResult ya recomputado por la ruta, con francoScore),
// `ai` (ai_analysis STR persistido) y los builders/mappers puros compartidos con
// la web (findingDisplay, ordenarHallazgosPiramideSTR, buildPatrimonioSeriesSTR).
//
// Moneda: CLP fija (documento estático, sin toggle) — espejo de DocumentoLTR.
// Charts: SVG estático server-side (FlujoEstacionalChartSVG · PatrimonioChartSVG).
// ─────────────────────────────────────────────────────────────────────────

import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { AIAnalysisSTRv2, Hallazgo } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import { fmtMoney, fmtUF } from "@/components/analysis/utils";
import { findingDisplay } from "@/components/analysis/GenericFindingCard";
import { ordenarHallazgosPiramideSTR } from "@/lib/piramide-orden-str";
import { buildPatrimonioSeriesSTR } from "@/lib/patrimonio-series-str";
import { PatrimonioChartSVG } from "../../../[id]/documento/PatrimonioChartSVG";
import { FlujoEstacionalChartSVG, tieneEstacionalidad } from "./FlujoEstacionalChartSVG";

const pct = (n: number, d = 1) => n.toFixed(d).replace(".", ",") + "%";
const dec = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

function verdictClass(v: STRVerdict): string {
  if (v === "COMPRAR") return "comprar";
  if (v === "BUSCAR OTRA") return "buscar";
  return "ajusta"; // AJUSTA SUPUESTOS
}

export interface DocumentoSTRProps {
  id: string;
  results: ShortTermResult & { francoScore?: FrancoScoreSTR };
  ai: AIAnalysisSTRv2 | null;
  inputData: Record<string, unknown> | null;
  ufFrozen: number;
  nombre: string | null;
  comuna: string | null;
  ciudad: string | null;
  direccionLabel: string;
}

export function DocumentoSTR({
  id,
  results,
  ai,
  inputData,
  ufFrozen,
  comuna,
  ciudad,
  direccionLabel,
}: DocumentoSTRProps) {
  const money = (n: number) => fmtMoney(n, "CLP", ufFrozen);
  const zona = comuna || ciudad || "tu zona";

  // ── Veredicto + score + dimensiones (variante A) ──
  const fs = results.francoScore;
  const score = fs?.score ?? null;
  const veredicto = normalizeLegacyVerdict((fs?.veredicto ?? results.veredicto) as string) as STRVerdict;
  const d = fs?.desglose;

  // ── Escenario base + comparativa (motor) ──
  const base = results.escenarios.base;
  const c = results.comparativa;
  const capBasePct = base.capRate * 100;
  const cocBasePct = base.cashOnCash * 100;

  // ── Portada · metadata ──
  const precioUF = Number(inputData?.precioCompraUF) || (Number(inputData?.precioCompra) || 0) / (ufFrozen || 1);
  const superficie = Number(inputData?.superficieUtil) || Number(inputData?.superficie) || 0;
  const ufM2 = superficie > 0 ? precioUF / superficie : 0;
  const piePct = Math.round((Number(inputData?.piePercent) || 0) * 100);
  const plazoAnios = Number(inputData?.plazoCredito) || 25;
  const tasaPct = (Number(inputData?.tasaCredito) || 0) * 100;
  const modoGestion = (inputData?.modoGestion as string) === "auto" ? "auto" : "administrador";
  const comisionPct = modoGestion === "auto" ? 3 : Math.round((Number(inputData?.comisionAdministrador) || 0.18) * 100);

  // ── Supuestos STR (motor: ejesAplicados / escenario base) ──
  const ej = results.ejesAplicados;
  const adr = ej?.adrFinal ?? base.adrReferencia;
  const occPct = Math.round((ej?.ocupacionFinal ?? base.ocupacionReferencia) * 100);
  const occTargetPct = ej ? Math.round(ej.ocupacionTarget * 100) : null;
  const nochesMes = Math.round((occPct / 100) * 30);

  // ── Hallazgos (pirámide · orden adversos-first) ──
  const hallazgos = ordenarHallazgosPiramideSTR(results.hallazgos);
  const adversos = hallazgos.filter((h) => h.direccion === "adverso");
  const favorables = hallazgos.filter((h) => h.direccion !== "adverso");
  // Variante D — título de la pirámide según haya o no adversos.
  const tituloPiramide = adversos.length > 0 ? "Empezando por lo adverso" : "Empezando por lo que lo sostiene";

  // ── Comparativa de gestión (motor: str_admin vs str_auto) ──
  const admin = c.str_admin;
  const auto = c.str_auto;
  const adminEsBase = modoGestion === "administrador";

  // Variante E (anexo) — palanca de gestión, 3 ramas deterministas (espejo del
  // tirMejoraMaterial del LTR, usando flipGestion + los flujos de str_auto/str_admin).
  const flujoAlto = Math.max(auto.flujoCajaMensual, admin.flujoCajaMensual); // = auto (menor comisión)
  const flujoBajo = Math.min(auto.flujoCajaMensual, admin.flujoCajaMensual); // = admin
  const gestionLever: { label: string; text: string } =
    flujoBajo >= 0
      ? {
          label: "La gestión es margen, no rescate",
          text: `La operación deja caja positiva incluso pagando administración (${money(admin.flujoCajaMensual)}/mes). Autogestionar (comisión 3%) la sube a ${money(auto.flujoCajaMensual)}, pero acá la gestión es margen extra, no lo que decide la compra.`,
        }
      : flujoAlto >= 0
        ? {
            label: "Estrategia sugerida",
            text: `Si autogestionas en vez de pagar ${comisionPct}% de administración, tu flujo pasa de ${money(admin.flujoCajaMensual)} a ${money(auto.flujoCajaMensual)} al mes y el CAP sube a ${pct(auto.capRate * 100)}. Es la misma propiedad: la diferencia entera está en quién opera. Empieza autogestionando y contrata administración solo cuando el volumen lo justifique.`,
          }
        : {
            label: "La gestión no es la palanca acá",
            text: `Ni autogestionando (comisión 3%) el flujo se da vuelta: pasa de ${money(admin.flujoCajaMensual)} a ${money(auto.flujoCajaMensual)} al mes, sigue negativo. El problema no es quién opera — es estructural (precio, ocupación o costos). La palanca de gestión no salva este caso.`,
          };

  // ── Sensibilidad P25–P90 (motor) ──
  const sens = results.sensibilidad ?? [];
  const breakEvenPct = (results.breakEvenPctDelMercado ?? 0) * 100;
  // Variante E — rama del box break-even (espejo del hallazgo sensibilidad_str).
  const breakEvenFragil = breakEvenPct > 110;
  const breakEvenBorde = breakEvenPct >= 100 && breakEvenPct <= 110;
  const breakEvenBox =
    breakEvenFragil
      ? { red: true, label: "Punto de equilibrio", text: `Para no perder plata necesitas facturar ${money(results.breakEvenRevenueAnual ?? 0)} al año — el ${Math.round(breakEvenPct)}% de los ingresos brutos medianos de la zona (P50). Estás pidiéndole al listing que rinda sobre lo típico solo para quedar en cero: por debajo del P50, el corto ya no cubre la cuota. Es el número más frágil del análisis.` }
      : breakEvenBorde
        ? { red: true, label: "Punto de equilibrio", text: `Tu punto de equilibrio está en el ${Math.round(breakEvenPct)}% de los ingresos brutos medianos de la zona (P50) — justo en el borde. Cuadras si la zona rinde lo típico, pero sin colchón para un mal trimestre de ocupación o tarifa.` }
        : { red: false, label: "Punto de equilibrio", text: `Tu punto de equilibrio está en el ${Math.round(breakEvenPct)}% de los ingresos brutos medianos de la zona (P50): cuadras facturando por debajo de lo que rinde la zona típica. Hay colchón si la ocupación o la tarifa vienen algo más bajas de lo asumido.` };

  // ── Ventaja vs LTR (motor) ──
  const sobreRentaPct = c.sobreRentaPct * 100;
  const sobreRentaConfiable = c.sobreRentaPctConfiable;

  // ── Factibilidad · banda (variante F) ──
  const banda = results.veredictoComparativo?.banda ?? results.recomendacionModalidad;
  const bandaLabel =
    banda === "STR_VENTAJA_CLARA" ? "STR ventaja clara"
    : banda === "STR_FRAGIL" ? "STR frágil"
    : banda === "LTR_PREFERIDO" ? "LTR preferido"
    : "Indiferente";
  const tierZona = results.zonaSTR?.tierZona;
  const tierLabel = tierZona === "alta" ? "Alta" : tierZona === "baja" ? "Baja" : "Media";

  // Variante G — banner de viabilidad (condicional · zona baja / LTR preferido).
  const mostrarViab = tierZona === "baja" || results.recomendacionModalidad === "LTR_PREFERIDO";
  const viabTitulo = results.recomendacionModalidad === "LTR_PREFERIDO"
    ? "LTR es la apuesta más sólida acá, no STR"
    : "Zona con demanda STR baja";
  const viabCuerpo = results.recomendacionModalidad === "LTR_PREFERIDO" && tierZona === "baja"
    ? "El arriendo largo rinde más neto que el corto en esta zona, y la demanda STR no compensa la complejidad operativa adicional. Antes de invertir en amoblamiento y gestión, considera quedarte con arriendo tradicional."
    : results.recomendacionModalidad === "LTR_PREFERIDO"
      ? "Tu sobre-renta STR vs LTR es muy chica (bajo 5% neto). El esfuerzo operativo del corto no se justifica con ese margen. El arriendo largo queda como opción principal."
      : "La demanda turística y corporativa en esta zona es baja frente al resto de Santiago. Operar corto acá depende de superar al mercado típico para no quedar en aporte mensual. Revisa antes de invertir en amoblamiento.";

  // ── Simulación (proyección · exit) ──
  const exit = results.exitScenario;
  const patrimonioRows = buildPatrimonioSeriesSTR(results);
  const flujoEstacional = results.flujoEstacional ?? [];
  const hayEstacionalidad = tieneEstacionalidad(flujoEstacional);
  const peak = flujoEstacional.length ? flujoEstacional.reduce((a, b) => (b.flujo > a.flujo ? b : a)) : null;
  const valle = flujoEstacional.length ? flujoEstacional.reduce((a, b) => (b.flujo < a.flujo ? b : a)) : null;
  const flujoPromMensual = flujoEstacional.length
    ? Math.round(flujoEstacional.reduce((s, m) => s + m.flujo, 0) / flujoEstacional.length)
    : base.flujoCajaMensual;

  // ── AI slots (v3 · CLP fijo) ──
  const conviene = ai?.conviene;
  const aiRent = ai?.rentabilidad;
  const aiOper = ai?.operacion;
  const aiVs = ai?.vsLTR;
  const aiLargo = ai?.largoPlazo;
  const aiRiesgos = ai?.riesgos;

  const headline = conviene?.respuestaDirecta; // solo si hay prosa IA fresca; si no, el badge habla solo.
  // riesgos.contenido: 3 riesgos separados por \n\n; 1ª oración = heading.
  const riesgosParsed = (aiRiesgos?.contenido ?? "")
    .split(/\n\n+/)
    .map((blk) => blk.trim())
    .filter(Boolean)
    .map((blk) => {
      const m = blk.match(/^([\s\S]+?[.:])\s*([\s\S]*)$/);
      return m ? { head: m[1], rest: m[2] } : { head: blk, rest: "" };
    });

  const HallRow = ({ h, rank }: { h: Hallazgo; rank: number }) => {
    const fd = findingDisplay(h, "CLP", ufFrozen);
    const adverso = h.direccion === "adverso";
    return (
      <div className={`hall ${adverso ? "adverso" : "favorable"}`}>
        <div className="rank">{rank}</div>
        <div>
          {h.titular && <p className="h-titular">{h.titular}</p>}
          <p className="h-frase">{h.fraseCanonica}</p>
        </div>
        <div className="h-val">
          <div className={`hv ${fd.kpiRed ? "neg" : ""}`}>{fd.kpi}</div>
          <div className="hd">{fd.ksub}</div>
        </div>
      </div>
    );
  };

  let rank = 0;

  return (
    <div className="franco-doc" data-doc-ready>
      {/* ═══════════ SECCIÓN 1 · PORTADA / VEREDICTO ═══════════ */}
      <section className="doc-section">
        <p className="eyebrow">01 · Veredicto</p>
        <h1 className="display">{direccionLabel || `Depto en ${zona}`}</h1>
        <p className="body sec" style={{ marginTop: 6 }}>Análisis de inversión · renta corta (STR)</p>

        <div className="prop-meta">
          <div className="cell"><p className="k">Superficie</p><div className="v">{superficie} m²</div></div>
          <div className="cell"><p className="k">Precio</p><div className="v">{fmtUF(precioUF)}</div></div>
          <div className="cell"><p className="k">$/m²</p><div className="v">UF {dec(ufM2)}</div></div>
          <div className="cell"><p className="k">Pie</p><div className="v">{piePct}%</div></div>
          <div className="cell"><p className="k">Financiamiento</p><div className="v">{plazoAnios} años · {dec(tasaPct)}%</div></div>
          <div className="cell"><p className="k">Ingreso bruto</p><div className="v">{money(base.ingresoBrutoMensual)}/mes</div></div>
        </div>

        <div className="verdict avoid-break">
          <span className={`badge ${verdictClass(veredicto)}`}>{veredicto}</span>
          {headline && <p className="headline">{headline}</p>}
          <p className="modal">Modalidad: renta corta · gestión por {modoGestion === "auto" ? "autogestión" : "administrador"}</p>
        </div>

        <div className="score-wrap avoid-break">
          <div>
            <p className="score-label">Franco Score</p>
            <div className="score-num">{score ?? "—"}<small>/100</small></div>
          </div>
          <div>
            <div className="gauge"><div className="dot" style={{ left: `${Math.max(0, Math.min(100, score ?? 0))}%` }} /></div>
            <div className="gauge-axis"><span>0 · Buscar otra</span><span>Ajusta</span><span>Comprar · 100</span></div>
          </div>
        </div>

        {d && (
          <div className="dims avoid-break">
            <div className="dim"><p className="dk">Rentabilidad</p><div className="dbar"><i style={{ width: `${d.rentabilidad.score}%` }} /></div><div className="dv">{Math.round(d.rentabilidad.score)}</div><div className="dw">peso {d.rentabilidad.peso}%</div></div>
            <div className="dim"><p className="dk">Sostenibilidad</p><div className="dbar"><i style={{ width: `${d.sostenibilidad.score}%` }} /></div><div className="dv">{Math.round(d.sostenibilidad.score)}</div><div className="dw">peso {d.sostenibilidad.peso}%</div></div>
            <div className="dim"><p className="dk">Ventaja vs LTR</p><div className="dbar"><i style={{ width: `${d.ventaja.score}%` }} /></div><div className="dv">{Math.round(d.ventaja.score)}</div><div className="dw">peso {d.ventaja.peso}%</div></div>
            <div className="dim"><p className="dk">Factibilidad</p><div className="dbar"><i style={{ width: `${d.factibilidad.score}%` }} /></div><div className="dv">{Math.round(d.factibilidad.score)}</div><div className="dw">peso {d.factibilidad.peso}%</div></div>
          </div>
        )}

        {conviene?.reencuadre && (
          <div className="exec avoid-break"><p>{conviene.reencuadre}</p></div>
        )}

        <div className="cover-lower avoid-break">
          <div>
            <p className="block-label">Supuestos del análisis</p>
            <div className="assump">
              <span className="ak">Tarifa diaria promedio (ADR)</span><span className="av">{money(adr)} <span className="u">/noche</span></span>
              <span className="sep" />
              <span className="ak">Ocupación · mediana de la zona</span><span className="av">{occPct}% <span className="u">· {nochesMes} noches/mes</span></span>
              {occTargetPct != null && (<><span className="sep" /><span className="ak">Potencial con gestión pro</span><span className="av">{occTargetPct}% <span className="u">estabilizado</span></span></>)}
              <span className="sep" />
              <span className="ak">Estabilización inicial</span><span className="av">6 <span className="u">meses</span></span>
              <span className="sep" />
              <span className="ak">Gestión · comisión</span><span className="av">{modoGestion === "auto" ? "Autogestión" : "Administrador"} <span className="u">· {comisionPct}%</span></span>
              <span className="sep" />
              <span className="ak">Costos operativos</span><span className="av">{money(base.costosOperativos)} <span className="u">/mes</span></span>
              <span className="sep" />
              <span className="ak">Dividendo mensual</span><span className="av">{money(results.dividendoMensual)}</span>
              <span className="sep" />
              <span className="ak">Amoblamiento</span><span className="av">{money(Number(inputData?.costoAmoblamiento) || 0)}</span>
            </div>
          </div>
          <div>
            <p className="block-label">En este informe</p>
            <div className="toc">
              <div className="titem"><span className="tno">·</span><span className="tname">El detalle · {hallazgos.length} hallazgos</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">02</span><span className="tname">Rentabilidad y costos</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">03</span><span className="tname">Sostenibilidad · estacionalidad</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">04</span><span className="tname">Sensibilidad</span><span className="tlead" /></div>
              <div className={`titem ${veredicto !== "COMPRAR" ? "tcrit" : ""}`}><span className="tno">05</span><span className="tname">Ventaja vs arriendo largo</span><span className="tlead" /></div>
              <div className={`titem ${veredicto !== "COMPRAR" ? "tcrit" : ""}`}><span className="tno">06</span><span className="tname">Factibilidad y riesgos</span><span className="tlead" /></div>
              <div className="titem"><span className="tno">·</span><span className="tname">Simulación · zona</span><span className="tlead" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECCIÓN 2 · HALLAZGOS ═══════════ */}
      <section className="doc-section">
        <p className="eyebrow">El detalle · {hallazgos.length} hallazgos</p>
        <h2 className="title">{tituloPiramide}</h2>
        <p className="body sec" style={{ marginTop: 6, marginBottom: 2 }}>
          Ordenados por cuánto pesan en la decisión. Cada frase es la lectura determinística del motor; el detalle de cada uno abre su capítulo más adelante.
        </p>

        {adversos.length > 0 && <p className="hall-group-label first">Adversos — lo que baja el veredicto</p>}
        {adversos.map((h) => <HallRow key={h.id} h={h} rank={++rank} />)}

        {favorables.length > 0 && <p className="hall-group-label">Favorables — lo que lo sostiene</p>}
        {favorables.map((h) => <HallRow key={h.id} h={h} rank={++rank} />)}
      </section>

      {/* ═══════════ SECCIÓN 3 · 02 RENTABILIDAD Y COSTOS ═══════════ */}
      <section className="doc-section">
        <div className="chapter"><span className="no">02</span><h2 className="subtitle">Rentabilidad y costos — qué rinde el metro en corto</h2></div>

        {aiRent?.contenido && <p className="body">{aiRent.contenido}</p>}

        <div className="chips">
          <p className="cl">La operación mes a mes · escenario base</p>
          <div className="grid g4">
            <div className="c"><p className="ck">Ingreso bruto</p><div className="cv">{money(base.ingresoBrutoMensual)}<small>/mes</small></div></div>
            <div className="c"><p className="ck">NOI mensual</p><div className="cv">{money(base.noiMensual)}</div></div>
            <div className="c"><p className="ck">CAP rate</p><div className={`cv ${capBasePct < 5 ? "neg" : "pos"}`}>{pct(capBasePct)}</div></div>
            <div className="c"><p className="ck">Cash-on-cash</p><div className={`cv ${cocBasePct < 0 ? "neg" : "pos"}`}>{pct(cocBasePct)}</div></div>
          </div>
          <p className="foot">El escenario base factura la ocupación mediana observada de la zona ({occPct}%), no la potencial con gestión profesional.</p>
        </div>

        <div className="decomp">
          <div className="row"><span className="dl">Ingreso bruto</span><span className="track"><i className="fill-strong" style={{ width: "100%" }} /></span><span className="dv">+{money(base.ingresoBrutoMensual)}</span></div>
          <div className="row"><span className="dl">Comisión gestión {comisionPct}%</span><span className="track"><i className="fill-red" style={{ width: `${Math.min(100, comisionPct)}%` }} /></span><span className="dv neg">−{money(base.comisionMensual)}</span></div>
          <div className="row"><span className="dl">Costos operativos</span><span className="track"><i className="fill-mid" style={{ width: `${Math.min(100, Math.round((base.costosOperativos / base.ingresoBrutoMensual) * 100))}%` }} /></span><span className="dv neg">−{money(base.costosOperativos)}</span></div>
          <div className="net"><span className="nl">NOI · antes de la cuota</span><span className="nv">{money(base.noiMensual)} / mes</span></div>
        </div>

        {/* Comparativa de gestión — motor real (comparativa.str_admin vs str_auto) */}
        <p className="sbl" style={{ margin: "16px 0 8px", fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Qué cambia según quién opera · la comisión de gestión</p>
        <div className="gest">
          <div className="hdr"><div>Escenario base</div><div className={adminEsBase ? "hl" : ""}>Administrador · {Math.round((Number(inputData?.comisionAdministrador) || 0.18) * 100)}%</div><div className={!adminEsBase ? "hl" : ""}>Autogestión · 3%</div></div>
          <div className="row"><div className="gm">NOI mensual</div><div className={`gv ${adminEsBase ? "col-hl" : ""}`}>{money(admin.noiMensual)}</div><div className={`gv ${!adminEsBase ? "col-hl" : ""}`}>{money(auto.noiMensual)}</div></div>
          <div className="row"><div className="gm">Flujo mensual</div><div className={`gv ${admin.flujoCajaMensual < 0 ? "neg" : "pos"} ${adminEsBase ? "col-hl" : ""}`}>{money(admin.flujoCajaMensual)}</div><div className={`gv ${auto.flujoCajaMensual < 0 ? "neg" : "pos"} ${!adminEsBase ? "col-hl" : ""}`}>{money(auto.flujoCajaMensual)}</div></div>
          <div className="row"><div className="gm">CAP rate</div><div className={`gv ${adminEsBase ? "col-hl" : ""}`}>{pct(admin.capRate * 100)}</div><div className={`gv ${!adminEsBase ? "col-hl" : ""}`}>{pct(auto.capRate * 100)}</div></div>
        </div>
        <p className="note" style={{ marginBottom: 0 }}>Ambas columnas las calcula el análisis con la misma ocupación y tarifa; lo único que cambia es la comisión — el costo operativo evitable más grande.</p>

        {aiRent?.cajaAccionable && (
          <div className="box"><p className="bl">{capBasePct < 5 ? "Cotiza la gestión" : "Qué haces con esto"}</p><p className="bt">{aiRent.cajaAccionable}</p></div>
        )}
      </section>

      {/* ═══════════ SECCIÓN 4 · 03 SOSTENIBILIDAD + 04 SENSIBILIDAD (hoja compartida) ═══════════ */}
      <section className="doc-section">
        <div className="chapter"><span className="no">03</span><h2 className="subtitle">Sostenibilidad — el promedio esconde la estacionalidad</h2></div>

        {aiOper?.contenido && <p className="body">{aiOper.contenido}</p>}

        <p className="sbl" style={{ margin: "6px 0 8px", fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Flujo neto mes a mes · escenario base (estabilizado)</p>
        {hayEstacionalidad ? (
          <>
            <FlujoEstacionalChartSVG rows={flujoEstacional} valorUF={ufFrozen} />
            <div className="chart-legend">
              <span><i className="sw ink" />Mes con caja positiva</span>
              <span><i className="sw red" />Mes que aportas de tu bolsillo</span>
              <span>Línea $0 = el corto cubre exacto la cuota y los costos</span>
            </div>
            {peak && valle && (
              <div className="chips" style={{ marginTop: 14 }}>
                <p className="cl">Los dos extremos del año</p>
                <div className="grid g3">
                  <div className="c"><p className="ck">Mes peak · {peak.mes}</p><div className="cv pos">{money(peak.flujo)}</div></div>
                  <div className="c"><p className="ck">Mes valle · {valle.mes}</p><div className="cv neg">{money(valle.flujo)}</div></div>
                  <div className="c"><p className="ck">Promedio del año</p><div className={`cv ${flujoPromMensual < 0 ? "neg" : "pos"}`}>{money(flujoPromMensual)}<small>/mes</small></div></div>
                </div>
                <p className="foot">La estacionalidad la traen los factores mensuales de ingresos brutos de la zona; los costos y la cuota son parejos todo el año. El valle define cuánto colchón necesitas.</p>
              </div>
            )}
          </>
        ) : (
          <div className="chart-slot">Sin curva estacional observada para esta propiedad. Los ingresos de referencia no traen distribución mes a mes, así que el análisis asume un año parejo — el flujo mensual promedio es {money(flujoPromMensual)}.</div>
        )}

        <div className="divider" />

        <div className="chapter"><span className="no">04</span><h2 className="subtitle">Sensibilidad — cómo se mueve si el mercado rinde distinto</h2></div>
        <p className="body sec" style={{ marginTop: 2, marginBottom: 10 }}>
          Cada fila toma un nivel de ingresos brutos anuales de la zona —de su cuarto más bajo (P25) al décimo superior (P90)— y recalcula el NOI mensual y la sobre-renta frente al arriendo largo. El P50 es tu escenario base.
        </p>

        <div className="sens">
          <div className="hdr"><div>Nivel de mercado</div><div>Ingresos brutos/año</div><div>NOI mensual</div><div>Sobre-renta vs LTR</div></div>
          {sens.map((r) => {
            const es50 = r.label === "P50";
            const srPos = r.sobreRenta >= 0;
            const nivelLabel =
              r.label === "P25" ? "cuarto bajo" : r.label === "P50" ? "base"
              : r.label === "P75" ? "cuarto alto" : r.label === "P90" ? "décimo sup." : "";
            return (
              <div className={`row ${es50 ? "base" : ""}`} key={r.label}>
                <div className="pk">{r.label} {nivelLabel && <small>· {nivelLabel}</small>}</div>
                <div className="sv">{money(r.revenueAnual)}</div>
                <div className="sv">{money(r.noiMensual)}</div>
                <div className={`sv ${srPos ? "pos" : "neg"}`}>{r.sobreRentaPctConfiable ? `${srPos ? "+" : ""}${money(r.sobreRenta)} · ${srPos ? "+" : ""}${Math.round(r.sobreRentaPct * 100)}%` : money(r.sobreRenta)}</div>
              </div>
            );
          })}
        </div>

        <div className={`box ${breakEvenBox.red ? "red" : ""}`}>
          <p className="bl">{breakEvenBox.label}</p>
          <p className="bt">{breakEvenBox.text}</p>
        </div>

        <p className="note">Estimación de mercado (AirROI), no transacciones cerradas. Los percentiles P25–P90 refieren al nivel de ingresos brutos de la zona, no a escenarios de ocupación.</p>
      </section>

      {/* ═══════════ SECCIÓN 5 · 05 VENTAJA VS LTR + 06 FACTIBILIDAD (hoja compartida) ═══════════ */}
      <section className="doc-section">
        <div className={`chapter ${veredicto !== "COMPRAR" ? "crit" : ""}`}><span className="no">05</span><h2 className="subtitle">Ventaja vs arriendo largo — ¿rinde lo suficiente más?</h2></div>

        {aiVs?.contenido && <p className="body">{aiVs.contenido}</p>}

        {!aiVs?.contenido && (
          <p className="body">
            En corto tu NOI es {money(base.noiMensual)} al mes contra {money(c.ltr.noiMensual)} del arriendo largo{sobreRentaConfiable ? ` —un ${Math.round(sobreRentaPct)}% ${sobreRentaPct >= 0 ? "más" : "menos"} neto` : ""}. La ventaja compara un corto estabilizado, con la ocupación proyectada, contra un arriendo largo contractual y garantizado.
          </p>
        )}

        <div className="strat">
          <p className="sl">{aiVs?.estrategiaSugerida ? "Estrategia sugerida" : gestionLever.label}</p>
          <p className="st">{aiVs?.estrategiaSugerida ?? gestionLever.text}</p>
        </div>

        <div className="divider" />

        <div className={`chapter ${veredicto !== "COMPRAR" ? "crit" : ""}`}><span className="no">06</span><h2 className="subtitle">Factibilidad y riesgos — lo que puede salir distinto</h2></div>

        {/* Variante G — banner de viabilidad (condicional). */}
        {mostrarViab && (
          <div className="viab">
            <p className="vl">Antes de seguir — STR no conviene acá</p>
            <p className="vh">{viabTitulo}</p>
            <p className="vt">{viabCuerpo}</p>
          </div>
        )}

        <div className="chips">
          <p className="cl">Datos de factibilidad</p>
          <div className="grid g3">
            <div className="c"><p className="ck">Reglamento del edificio</p><div className="cv">No verificado</div></div>
            <div className="c"><p className="ck">Zona · demanda STR</p><div className="cv">{tierLabel}</div></div>
            <div className="c"><p className="ck">Recomendación</p><div className="cv">{bandaLabel}</div></div>
          </div>
          <p className="foot">El reglamento de copropiedad no está confirmado — es lo primero a verificar antes de comprar para renta corta.</p>
        </div>

        {riesgosParsed.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 4 }}>Riesgos identificados</p>
            <div style={{ marginBottom: 14 }}>
              {riesgosParsed.map((r, i) => (
                <div className="risk" key={i}>
                  <div className="ri">{String(i + 1).padStart(2, "0")}</div>
                  <p className="rt"><b>{r.head}</b> {r.rest}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {aiRiesgos?.cajaAccionable && (
          <>
            <p className="eyebrow" style={{ marginTop: 6 }}>Siendo franco</p>
            <div className="cierre"><p>{aiRiesgos.cajaAccionable}</p></div>
          </>
        )}
      </section>

      {/* ═══════════ SECCIÓN 6 · SIMULACIÓN + ZONA + CIERRE (abre hoja propia) ═══════════ */}
      <section className="doc-section break-page">
        <p className="eyebrow">Simulación · patrimonio a {exit?.yearVenta ?? 10} años</p>
        <h2 className="title">A {exit?.yearVenta ?? 10} años construyes patrimonio, no un sueldo</h2>
        {aiLargo?.contenido && <p className="body sec" style={{ marginTop: 6, marginBottom: 11 }}>{aiLargo.contenido}</p>}

        <div className="sim-grid">
          <div className="sim-block">
            <p className="sbl">Patrimonio — barras apiladas</p>
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
            <p className="sbl">Indicadores @ {exit?.yearVenta ?? 10} años</p>
            <div className="kpis">
              <div className="kpi"><p className="kk">TIR a {exit?.yearVenta ?? 10} años</p><div className="kv">{exit ? pct(exit.tirAnual) : "—"}</div></div>
              <div className="kpi"><p className="kk">CAP rate</p><div className={`kv ${capBasePct < 5 ? "neg" : ""}`}>{pct(capBasePct)}</div></div>
              <div className="kpi"><p className="kk">Cash-on-cash</p><div className={`kv ${cocBasePct < 0 ? "neg" : ""}`}>{pct(cocBasePct)}</div></div>
              <div className="kpi"><p className="kk">NOI mensual</p><div className="kv">{money(base.noiMensual)}</div></div>
              <div className="kpi"><p className="kk">Recup. amoblam.</p><div className="kv">{c.paybackMeses > 0 ? `${c.paybackMeses} m` : c.paybackMeses === 0 ? "—" : "N/A"}</div></div>
              <div className="kpi"><p className="kk">Ocupación</p><div className="kv">{occPct}%</div></div>
            </div>
            <div className="box" style={{ marginTop: 14 }}>
              <p className="bl">Escenario base · congelado</p>
              <p className="bt">Escenario del análisis: ocupación {occPct}%, gestión por {modoGestion === "auto" ? "autogestión" : "administrador"}. En la versión interactiva ajustas ocupación, tarifa y gestión y todos recalculan; en el documento quedan fijos.</p>
            </div>
          </div>
        </div>

        {exit && (
          <>
            <p className="sbl" style={{ margin: "10px 0 5px" }}>Venta a {exit.yearVenta} años — si decides salir del activo</p>
            <div className="waterfall">
              <div className="wrow"><span className="wl">Valor de venta estimado <span className="wl sub">(año {exit.yearVenta})</span></span><span className="wv">{money(exit.valorVenta)}</span></div>
              <div className="wrow"><span className="wl sub">− Saldo del crédito al vender</span><span className="wv neg">−{money(exit.saldoCreditoAlVender)}</span></div>
              <div className="wrow"><span className="wl sub">− Comisión de venta + cierre (2%)</span><span className="wv neg">−{money(exit.gastosCierre)}</span></div>
              <div className="wrow total"><span className="wl">Tu parte, en la mano</span><span className="wv">{money(exit.equityCLP)}</span></div>
              <div className="wrow"><span className="wl sub">Flujo operativo acumulado (aparte)</span><span className={`wv ${exit.flujoAcumuladoAlVender < 0 ? "neg" : ""}`}>{money(exit.flujoAcumuladoAlVender)}</span></div>
              <div className="wrow"><span className="wl sub">Sobre lo aportado ({money(exit.totalAportado)})</span><span className="wv">{dec(exit.multiplicadorCapital)}×</span></div>
            </div>
          </>
        )}

        <div className="zona">
          <div className="zicon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6A6A71" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" /></svg>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 3 }}>Zona · ¿quién va a alojarse acá?</p>
            <p className="zq">El detalle del huésped, cómo amoblar para él y los atractores del radio del depto viven en la versión interactiva.</p>
          </div>
          <div className="zcount">Explorar →</div>
        </div>

        <div className="doc-close">
          <p className="cl">Versión interactiva de este análisis</p>
          <span className="clink">refranco<span className="ai">.ai</span>/analisis/renta-corta/{id.slice(0, 8)}</span>
          <p className="cdis">Ajusta ocupación, tarifa y gestión en vivo, abre cada hallazgo en detalle, mira la estacionalidad mes a mes y comparte el análisis con quien quieras.</p>
        </div>

        <div className="legal">
          <p className="ll">Disclaimer</p>
          <p>
            <b style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Franco no es asesor financiero.</b> Este informe es referencial y educativo: no constituye una recomendación de inversión, una asesoría personalizada ni una oferta. Las cifras de renta corta se basan en supuestos de ocupación y tarifa —estimaciones de mercado (AirROI), no transacciones cerradas— y en proyecciones que pueden no cumplirse; verifícalas en su fuente. La regulación de arriendo por temporada del edificio debe confirmarse antes de comprar. Antes de decidir, contrasta los números y consulta a un profesional para tu caso. Análisis generado por Franco · refranco.ai · {direccionLabel || zona}, Santiago de Chile.
          </p>
        </div>
      </section>
    </div>
  );
}
