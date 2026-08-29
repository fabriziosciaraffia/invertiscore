"use client";

/**
 * DrawerContentSTR — cuerpos de los drawers de detalle STR (Patrón 3).
 *
 * E.2 (2026-07): extraído verbatim de SubjectCardGridSTR (que muere). Los drawers
 * ya no cuelgan de un grid de cards paralelas: se abren desde la pirámide de
 * hallazgos (HALLAZGO_DRAWER_STR) y desde la card zona (tipoHuesped). El estado
 * `activeDrawer` vive en el orquestador (results-client), que renderiza
 * <DrawerSTR><DrawerContentSTR/></DrawerSTR> al pie de la página.
 *
 * Mapping AI ↔ drawer (ver of-e2-censo.md):
 *   rentabilidad   ← ai.rentabilidad
 *   sostenibilidad ← (motor) · flujo mensual + estacionalidad
 *   sensibilidad   ← (motor) · tabla P25-P90 + break-even
 *   ventajaLtr     ← ai.vsLTR + estrategiaSugerida
 *   factibilidad   ← ai.riesgos + ai.operacion  (ancla pirámide: ocupacion_vs_banda)
 *   tipoHuesped    ← DrawerTipoHuesped (endpoint guest-insight)
 */

import { useMemo, useState } from "react";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { AMOBLAMIENTO_FACTOR_HABILITACION } from "@/lib/engines/short-term-engine";
import type {
  AIAnalysisSTRv2,
  HallazgoTIR,
  HallazgoPatrimonio,
  HallazgoPlusvalia,
  HallazgoSobreprecio,
  HallazgoEstructuraFinanciamiento,
  HallazgoEstructuraCostosStr,
  HallazgoDistanciaVeredicto,
  HallazgoPuestaAPunto,
} from "@/lib/types";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import { extractRiesgos, DrawerCapexPuestaAPunto } from "@/components/ui/AnalysisDrawer";
import { renderPlumon, plumonInline } from "@/components/analysis/hallazgos/plumon";
import {
  Tabla,
  VViz,
  VProsa,
  VCierre,
  VFuente,
  Palancas,
  type FilaPalanca,
  Escenarios,
  Bars,
  Thermo,
} from "@/components/analysis/hallazgos/vocabulario";

import { DrawerKeySTR } from "./DrawerSTR";
import {
  DrawerFinanciamientoStr,
  DrawerPrecioStr,
  DrawerTIRStr,
  DrawerPatrimonioStr,
  DrawerPlusvaliaStr,
  DrawerEstructuraCostosStr,
  DrawerDistanciaStr,
} from "@/components/analysis/drawers/DrawersPropios";
import { FlujoEstacionalChartSTR } from "./FlujoEstacionalChartSTR";
import { DrawerTipoHuesped } from "./DrawerTipoHuesped";
import { fmtMoney, fmtPct, fmtDec, fmtAxisMoney} from "../utils";
import { metricaValorONull, esMetricaNoAplica } from "@/lib/types";
import type { NivelPie } from "@/lib/analysis";
import { NO_APLICA_VALOR, NO_APLICA_SUBLABEL } from "@/lib/no-aplica-copy";

/** Escala del rango de escenarios: el mayor (optimista) ocupa el 100%. */
function escalaNoi(v: number, techo: number): number {
  return techo > 0 ? Math.max(0, Math.min(100, (v / techo) * 100)) : 0;
}

/** % con un decimal y coma chilena, sin el signo (lo pone el caller). */
function pct1Str(n: number): string {
  return n.toFixed(1).replace(".", ",");
}


export interface InputDataSTR {
  edificioPermiteAirbnb?: "si" | "no" | "no_seguro";
  costoElectricidad?: number;
  costoAgua?: number;
  costoWifi?: number;
  costoInsumos?: number;
  mantencion?: number;
  gastosComunes?: number;
  contribuciones?: number; // CLP trimestrales
  lat?: number;
  lng?: number;
  zonaRadio?: { lat?: number; lng?: number };
}

/** Títulos del header de cada drawer (usados por DrawerSTR). */
export const DRAWER_TITULOS_STR: Record<DrawerKeySTR, string> = {
  capexPuestaAPunto: "Dejarlo listo para arrendar",
  rentabilidad: "Detalle de retorno y rentabilidad",
  sostenibilidad: "Flujo mensual y estacionalidad",
  sensibilidad: "Sensibilidad a ocupación y mercado",
  ventajaLtr: "STR vs arriendo largo",
  tipoHuesped: "Quién va a alojarse y cómo amoblar para él",
  largoPlazo: "¿Vale la pena a 10 años?",
  factibilidad: "Regulación, zona y riesgos",
  // Drawers propios (F2) — preguntas deterministas (el % de retorno vive en el body).
  financiamiento: "¿Cómo estás financiando?",
  precio: "¿Estás pagando caro?",
  retorno: "¿Por qué tu retorno no es el de un depósito?",
  patrimonio: "¿Cuánto es tuyo a 10 años?",
  plusvalia: "¿Cuánto se ha valorizado la comuna?",
  estructuraCostos: "¿En qué se va cada peso?",
  distanciaVeredicto: "¿Qué te separa del veredicto de arriba?",
};

/* ─── Helpers de presentación ─────────────────────────── */

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p
        className="font-mono uppercase mb-2"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-secondary)", fontWeight: 500 }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function DataRow({ label, value, isCritical = false, tooltip }: { label: string; value: string; isCritical?: boolean; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b-[0.5px] border-[var(--franco-border)]">
      <span className="inline-flex items-center gap-1 font-body text-[13px] text-[var(--franco-text)]">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span
        className="font-mono text-[13px] font-medium"
        style={{ color: isCritical ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Narrativa IA — primera línea del drawer. Placeholder breve si no hay
 * contenido IA todavía.
 */
function NarrativeIA({ text }: { text: string | null | undefined }) {
  if (!text || !text.trim()) {
    return (
      <p className="font-body italic text-[13px] text-[var(--franco-text-secondary)] leading-[1.6] mb-5 m-0">
        Franco está preparando este detalle…
      </p>
    );
  }
  return (
    <div className="font-body text-[14px] text-[var(--franco-text)] leading-[1.65] mb-5">
      {renderPlumon(text)}
    </div>
  );
}

/**
 * Estrategia sugerida (drawer Ventaja vs LTR).
 */
function EstrategiaSugerida({ text }: { text: string | null | undefined }) {
  if (!text || !text.trim()) return null;
  return (
    <div
      className="mt-4 mb-2 p-3"
      style={{
        background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
        borderLeft: "3px solid var(--franco-text)",
        borderRadius: "0 8px 8px 0",
      }}
    >
      <p
        className="font-mono uppercase mb-1.5 m-0"
        style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
      >
        ESTRATEGIA SUGERIDA
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.55]">
        {plumonInline(text)}
      </p>
    </div>
  );
}

/**
 * Lista de riesgos parseada — paralelo al DrawerRiesgos LTR.
 */
function RiesgosLista({ contenido }: { contenido: string | null | undefined }) {
  const parsed = useMemo(() => extractRiesgos(contenido ?? ""), [contenido]);
  const usandoFallback = parsed.length === 0;
  const riesgos = usandoFallback
    ? [
        { titulo: "Caída de ocupación", descripcion: "Si la ocupación baja a la cuarta parte más baja del mercado (p25), el flujo se da vuelta. Mantén un fondo de reserva de 3-6 meses de costos fijos." },
        { titulo: "Regulación cambia", descripcion: "La asamblea del edificio o la municipalidad pueden restringir Airbnb. Revisa el reglamento antes de invertir en amoblamiento." },
        { titulo: "Costos de rotación subestimados", descripcion: "Sábanas, toallas y amenidades suelen ser 5-8% del bruto, no 3%. Subestimar este rubro infla artificialmente la rentabilidad." },
      ]
    : parsed;

  return (
    <>
      {usandoFallback && (
        <p className="font-mono text-[11px] mb-3 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
          ● Lista genérica de riesgos típicos STR. El análisis específico no generó riesgos personalizados.
        </p>
      )}
      <div className="flex flex-col gap-2.5 mb-4">
        {riesgos.map((r, i) => (
          <div
            key={i}
            className="rounded-r-lg p-3"
            style={{
              borderLeft: "3px solid var(--signal-red)",
              background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--signal-red) 25%, transparent)",
              borderLeftWidth: "3px",
            }}
          >
            <h4 className="font-body font-medium text-[13px] mb-1 m-0" style={{ color: "var(--signal-red)" }}>
              {r.titulo}
            </h4>
            {/* v9 — texto íntegro (el truncado murió) y tokens --doc-* del documento. */}
            <p className="font-body text-[11.5px] text-[var(--doc-tx2)] m-0 leading-[1.5]">
              {r.descripcion}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * CajaFranco (Patrón 3 cierre obligatorio §1.10).
 */
function CajaFranco({ text, label, variant = "info" }: { text: string | null | undefined; label: string; variant?: "info" | "attention" | "negative" }) {
  if (!text || !text.trim()) return null;
  return (
    <StateBox variant="left-border" state={variant} label={label} className="mt-5">
      {plumonInline(text)}
    </StateBox>
  );
}

/**
 * Desglose de costos operativos (drawer rentabilidad).
 */
function CostosBreakdown({ inputData, currency, valorUF }: {
  inputData: InputDataSTR | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const [open, setOpen] = useState(false);
  if (!inputData) return null;

  const electricidad = inputData.costoElectricidad ?? 0;
  const agua = inputData.costoAgua ?? 0;
  const wifi = inputData.costoWifi ?? 0;
  const insumos = inputData.costoInsumos ?? 0;
  const mantencion = inputData.mantencion ?? 0;
  const ggcc = inputData.gastosComunes ?? 0;
  const contribsTrim = inputData.contribuciones ?? 0;
  const contribsMes = Math.round(contribsTrim / 3);

  const total = electricidad + agua + wifi + insumos + mantencion + ggcc + contribsMes;
  if (total === 0) return null;

  const items = [
    { name: "Electricidad", value: electricidad },
    { name: "Agua", value: agua },
    { name: "Internet (wifi)", value: wifi },
    { name: "Insumos (toallas, sábanas, amenidades)", value: insumos },
    { name: "Mantención y reparaciones", value: mantencion },
    { name: "Gastos comunes", value: ggcc },
    { name: "Contribuciones (trimestral prorrateada)", value: contribsMes },
  ].sort((a, b) => b.value - a.value);
  const top = items[0];
  const topPct = total > 0 ? top.value / total : 0;

  return (
    <DrawerSection label="Desglose de costos operativos">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors mb-2"
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}>▸</span>
        {open ? "Ocultar desglose" : `Ver desglose (total ${fmtMoney(total, currency, valorUF)}/mes)`}
      </button>
      {open && (
        <>
          {items.map((it) => (
            <DataRow
              key={it.name}
              label={it.name}
              value={fmtMoney(it.value, currency, valorUF)}
            />
          ))}
          <DataRow
            label="Total mensual operativo"
            value={fmtMoney(total, currency, valorUF)}
          />
          {topPct >= 0.25 && (
            <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-2 m-0 italic leading-[1.5]">
              El grueso del costo operativo es {top.name.toLowerCase()} ({fmtPct(topPct * 100, 0)} del total). Si estimaste este rubro a la ligera, todo el cálculo se mueve.
            </p>
          )}
        </>
      )}
    </DrawerSection>
  );
}

const LABEL_HAB: Record<string, string> = { basico: "Básico", estandar: "Estándar", premium: "Premium" };

/**
 * Contexto de habilitación (drawer rentabilidad · E.2). El nivel de habilitación
 * NO mueve la tarifa (factor ADR neutralizado jun-2026): su efecto vivo es escalar
 * el amoblamiento inicial → capital invertido → Cash-on-Cash. Vive acá, junto al
 * capex, no en el panel "¿Cómo llegamos?" (que explica el ingreso).
 */
function HabilitacionContext({ ejes }: { ejes: ShortTermResult["ejesAplicados"] }) {
  const hab = ejes?.habilitacion;
  if (!hab) return null;
  const factor = AMOBLAMIENTO_FACTOR_HABILITACION[hab] ?? 1;
  const label = LABEL_HAB[hab] ?? hab;
  const efecto = factor > 1
    ? `escala tu amoblamiento inicial ×${fmtDec(factor, factor % 1 === 0 ? 0 : 1)} sobre el nivel básico`
    : "usa el amoblamiento base, sin recargo";
  // AUDITORÍA fase42 (8) — era una DrawerSection apilada entre el breakdown y el
  // cierre (tres cajas seguidas). El contenido es una sola idea de contexto: va como
  // prosa del cuerpo, y el cierre queda uno (la caja de Franco).
  return (
    <p className="font-body text-[12.5px] text-[var(--franco-text-secondary)] m-0 mb-4 italic leading-[1.55]">
      Tu habilitación es {label}: {efecto}. No cambia la tarifa diaria — sube (o no) el
      capital que pones al inicio, y con eso el Cash-on-Cash. Es la palanca del capex, no del ingreso.
    </p>
  );
}

/* ─── Drawer content por dimensión ─────────────────────────── */

export function DrawerContentSTR({
  activeKey,
  analysisId,
  results,
  inputData,
  comuna,
  currency,
  valorUF,
  ai,
  nivelesPie,
}: {
  activeKey: DrawerKeySTR;
  analysisId: string;
  results: ShortTermResult;
  inputData: InputDataSTR | null | undefined;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
  /** Escalera del pie, calculada en el SERVIDOR (ver DrawerFinanciamientoStr). */
  nivelesPie?: NivelPie[];
  ai: AIAnalysisSTRv2 | null;
}) {
  const base = results.escenarios.base;
  const conservador = results.escenarios.conservador;
  const agresivo = results.escenarios.agresivo;
  const ltr = results.comparativa.ltr;
  const regulacion = inputData?.edificioPermiteAirbnb ?? "no_seguro";

  // fix-occfuente-override 2026-07 — cuando el usuario definió la ocupación a mano, el drawer
  // NO la presenta como "mediana observada": declara procedencia y muestra ambos valores.
  const occEsOverride = results.occFuente === "override";
  const occBasePct = Math.round(base.ocupacionReferencia * 100);
  const occObsPct = Math.round((typeof results.occObservada === "number" ? results.occObservada : base.ocupacionReferencia) * 100);

  // Drawer Tipo de huésped — delega a DrawerTipoHuesped (lazy fetch guest-insight).
  if (activeKey === "tipoHuesped") {
    return <DrawerTipoHuesped analysisId={analysisId} />;
  }

  // ── Drawers propios STR (F2) — plantillas deterministas motor-templated ──
  // El hallazgo persistido en results.hallazgos alimenta cada plantilla. Sin él
  // (fila legacy), fallback breve — la card no debería abrir sin su hallazgo.
  const hById = <T,>(id: string): T | undefined =>
    (results.hallazgos?.find((h) => h.id === id) as T | undefined);
  const faltaHallazgo = (
    <p className="font-body italic text-[13px] text-[var(--franco-text-secondary)] leading-[1.6] m-0">
      Este detalle no está disponible para este análisis.
    </p>
  );
  if (activeKey === "financiamiento") {
    const h = hById<HallazgoEstructuraFinanciamiento>("estructura_financiamiento");
    return h ? (
      <DrawerFinanciamientoStr
        hallazgo={h}
        results={results}
        currency={currency}
        valorUF={valorUF}
        nivelesPie={nivelesPie}
      />
    ) : (
      faltaHallazgo
    );
  }
  if (activeKey === "precio") {
    const h = hById<HallazgoSobreprecio>("sobreprecio");
    return h ? <DrawerPrecioStr hallazgo={h} results={results} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }
  if (activeKey === "retorno") {
    const h = hById<HallazgoTIR>("tir");
    return h ? <DrawerTIRStr hallazgo={h} results={results} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }
  if (activeKey === "patrimonio") {
    const h = hById<HallazgoPatrimonio>("patrimonio");
    return h ? <DrawerPatrimonioStr hallazgo={h} results={results} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }
  if (activeKey === "plusvalia") {
    const h = hById<HallazgoPlusvalia>("plusvalia");
    return h ? <DrawerPlusvaliaStr hallazgo={h} results={results} comuna={comuna} /> : faltaHallazgo;
  }
  if (activeKey === "estructuraCostos") {
    const h = hById<HallazgoEstructuraCostosStr>("estructura_costos_str");
    return h ? <DrawerEstructuraCostosStr hallazgo={h} results={results} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }
  if (activeKey === "capexPuestaAPunto") {
    // FASE 4 — cuerpo propio (antes: card sin drawer). Reusa el cuerpo LTR: el
    // hallazgo es el MISMO tipo y la lectura es idéntica (qué cuesta dejarlo
    // listo y qué fracción del desembolso inicial se lleva). Cero fork.
    const h = hById<HallazgoPuestaAPunto>("capex_puesta_a_punto");
    return h ? <DrawerCapexPuestaAPunto hallazgo={h} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }
  if (activeKey === "distanciaVeredicto") {
    const h = hById<HallazgoDistanciaVeredicto>("distancia_veredicto");
    return h ? <DrawerDistanciaStr hallazgo={h} currency={currency} valorUF={valorUF} /> : faltaHallazgo;
  }

  // largoPlazo (paridad drawer) — prose-only: JUICIO del horizonte (contrafactual de
  // instrumentos + condicional de plusvalía + posición). El equity al vender, el valor a
  // 10 años, la TIR y el multiplicador viven en los drawers patrimonio/plusvalia y en
  // IndicatorsSTR — este drawer NO los recita (guard en el prompt v2). Sin waterfall.
  if (activeKey === "largoPlazo") {
    const seccion = ai?.largoPlazo;
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />
        <CajaFranco text={seccion?.cajaAccionable} label="La apuesta que estás haciendo:" />
      </>
    );
  }

  if (activeKey === "rentabilidad") {
    const seccion = ai?.rentabilidad;
    // ═══ CONVERSIÓN 15 (FASE 4.2) ═══
    // La referencia del CAP rate NO se inventa: sale de `rentabilidad_str.valor.umbralPct`
    // (umbral STR del motor, con su propia procedencia). Sin el hallazgo no se dibuja la
    // matriz — el mismo criterio que cerró el "óptimo de pie" sin fundamento.
    const hRent = results.hallazgos?.find((h) => h.id === "rentabilidad_str");
    const vRent = hRent && hRent.id === "rentabilidad_str" ? hRent.valor : null;
    const occBase = base.ocupacionReferencia;
    const occTecho = agresivo.ocupacionReferencia;
    // `cashOnCash` viaja como FRACCIÓN (0,097 = 9,7%): se escala acá, igual que en el
    // DataRow de más abajo. Usarlo crudo mostraba −0,1% donde el dato dice −9,7%.
    const cocFrac = metricaValorONull(base.cashOnCash);
    const coc = cocFrac != null ? cocFrac * 100 : null;
    const filasRent: FilaPalanca[] = [];
    if (vRent) {
      filasRent.push({
        nombre: "CAP rate",
        glosa: "lo que el arriendo deja al año sobre el precio, ya descontados los gastos",
        delta: `${vRent.gapPts >= 0 ? "+" : "−"}${pct1Str(Math.abs(vRent.gapPts))} pt`,
        alcanza: vRent.gapPts >= 0,
        origen: `${pct1Str(vRent.capRatePct)}%`,
        destino: `${pct1Str(vRent.umbralPct)}% de referencia`,
        razon: vRent.gapPts >= 0 ? "rinde sobre la referencia" : "rinde bajo la referencia",
      });
    }
    // Pie cero (fase 3b · D1): sin capital propio el retorno sobre capital NO APLICA —
    // se dice, no se omite en silencio. La fila viajaba en el DataRow que la matriz
    // absorbió; recuperarla acá evita perder la explicación honesta.
    if (esMetricaNoAplica(base.cashOnCash)) {
      filasRent.push({
        nombre: "Retorno sobre tu capital",
        glosa: "lo que rinde al año la plata que pusiste",
        delta: NO_APLICA_VALOR,
        alcanza: false,
        razon: NO_APLICA_SUBLABEL.toLowerCase(),
      });
    } else if (coc != null) {
      filasRent.push({
        nombre: "Retorno sobre tu capital",
        glosa: "lo que rinde al año la plata que pusiste",
        delta: `${coc >= 0 ? "+" : "−"}${pct1Str(Math.abs(coc))}%`,
        alcanza: coc >= 0,
        // En negativo se dice en plata, que es lo que se entiende: "por cada $100 que
        // pusiste, este año pones $X más" en vez de un "0% para no perder" abstracto.
        razon:
          coc >= 0
            ? `por cada $100 que pusiste, este año recibes $${pct1Str(Math.abs(coc))}`
            : `por cada $100 que pusiste, este año pones $${pct1Str(Math.abs(coc))} más`,
      });
    }
    if (occTecho > occBase) {
      filasRent.push({
        nombre: "Ocupación",
        glosa: "cuántas noches del mes se llenan",
        delta: `+${Math.round((occTecho - occBase) * 100)} pts posibles`,
        alcanza: true,
        // AUDITORÍA fase42 (7b): la lista de DataRows que duplicaba esta fila murió;
        // el matiz del override (ocupación definida a mano, no observada) sube acá.
        origen: occEsOverride
          ? `${Math.round(occBase * 100)}% definida por ti`
          : `${Math.round(occBase * 100)}% hoy en la zona`,
        destino: `${Math.round(occTecho * 100)}% con gestión pro`,
        razon: "es la palanca real",
        // Degradado aprobado (propuesta-15-pie-v3): la palanca real, en verde.
        wash: "good",
      });
    }
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />

        {filasRent.length > 0 && (
          <VViz t="Tus números contra su referencia">
            <Palancas
              filas={filasRent}
              pie={
                occEsOverride
                  ? `Definiste la ocupación a mano (${occBasePct}%). No es un dato observado de la zona (donde se observa ${occObsPct}%); trátalo como un supuesto que confirmas recién operando.`
                  : results.occFuente === "fallback_mercado"
                    ? "No hubo ocupación observada para esta dirección; se usó la mediana de Santiago (~45%). Tómalo como referencia, no como dato propio de la zona."
                    : undefined
              }
            />
          </VViz>
        )}

        {/* ESCENARIOS — la asimetría se DECLARA (§2.2 A12 del skill: el supuesto va en
            palabras, nunca "P25"/"P50", que quedan reservados para la tabla de
            percentiles de sensibilidad). El conservador mueve DOS variables (ocupación
            y tarifa al cuartil bajo) y el optimista solo UNA (ocupación): un lector que
            ve tres barras asume el mismo experimento en tres intensidades, así que si
            no se dice, el diagrama engaña por omisión. */}
        <VViz t="Cuánto puede variar tu ingreso neto mensual">
          <Escenarios
            filas={[
              {
                k: "Pesimista",
                supuesto: "cuartil bajo observado · ocupación y tarifa",
                v: fmtMoney(conservador.noiMensual, currency, valorUF),
                pct: escalaNoi(conservador.noiMensual, agresivo.noiMensual),
                tono: "pes",
              },
              {
                k: "Base",
                supuesto: occEsOverride
                  ? `ocupación ${occBasePct}% definida por ti`
                  : "mediana observada de la zona · solo ocupación",
                v: fmtMoney(base.noiMensual, currency, valorUF),
                pct: escalaNoi(base.noiMensual, agresivo.noiMensual),
                tono: "base",
              },
              {
                k: "Optimista",
                supuesto: "estabilizado con gestión profesional · solo ocupación",
                v: fmtMoney(agresivo.noiMensual, currency, valorUF),
                pct: escalaNoi(agresivo.noiMensual, agresivo.noiMensual),
                tono: "opt",
              },
            ]}
            pie="Los tres escenarios no mueven las mismas variables: el pesimista baja ocupación y tarifa a la vez; el optimista sube solo la ocupación."
          />
        </VViz>

        {/* AUDITORÍA fase42 (7b) — la matriz REEMPLAZA la lista, no convive con
            ella: la ocupación salía dos veces (matriz + DataRow) y el NOI base ya es
            la fila Base de los escenarios. Sobreviven los dos datos que ningún
            diagrama muestra; los caveats del override subieron a la matriz. */}
        <DrawerSection label={occEsOverride ? "Escenario base (ocupación definida por ti)" : "Escenario base (mediana observada de la zona · P50)"}>
          <DataRow
            label="Ingresos brutos anuales"
            value={fmtMoney(base.revenueAnual, currency, valorUF)}
            tooltip={occEsOverride
              ? "Total de ingresos del año asumiendo la ocupación que definiste. Sin descontar costos."
              : "Total de ingresos del año asumiendo la mediana observada de la zona. Sin descontar costos."}
          />
          <DataRow
            label="Rentabilidad bruta"
            value={fmtPct(base.rentabilidadBruta * 100, 2)}
            tooltip="Ingresos brutos anuales divididos por precio de compra, sin descontar nada. Útil sólo como referencia rápida — es el número de portada."
          />
        </DrawerSection>
        <CostosBreakdown inputData={inputData} currency={currency} valorUF={valorUF} />
        <HabilitacionContext ejes={results.ejesAplicados} />
        {/* D-15(a) — "HAZTE ESTA PREGUNTA:" no existe en el v12: el cierre es el
            VCierre con título rotativo. Contenido IA → sin destacado nuestro (T2);
            los plumones que la IA traiga los pinta plumonInline. */}
        {seccion?.cajaAccionable?.trim() && (
          <VCierre titulo="Qué significa">{plumonInline(seccion.cajaAccionable)}</VCierre>
        )}
        {/* T1 — línea de fuente al pie del cuerpo. */}
        <VFuente>
          AirROI · {occEsOverride ? "ocupación definida por ti" : "ocupación observada de la zona (mediana P50)"} · costos operativos {fmtMoney(base.costosOperativos, currency, valorUF)}/mes
        </VFuente>
      </>
    );
  }

  if (activeKey === "sostenibilidad") {
    const isCritical = base.flujoCajaMensual < 0;
    return (
      <>
        <DrawerSection label="Flujo mensual promedio">
          <DataRow
            label="Ingreso bruto mensual"
            value={fmtMoney(base.ingresoBrutoMensual, currency, valorUF)}
            tooltip="Tarifa diaria × ocupación × días del mes. Lo que entra antes de comisiones y costos operativos."
          />
          <DataRow
            label="Comisión gestión"
            value={"-" + fmtMoney(base.comisionMensual, currency, valorUF)}
            tooltip="Lo que cobra la plataforma o el administrador. Auto-gestión: 3% (Airbnb). Administrador profesional: 18-22% del bruto."
          />
          <DataRow
            label="Costos operativos (suma)"
            value={"-" + fmtMoney(base.costosOperativos, currency, valorUF)}
            tooltip="Suma mensual de electricidad, agua, wifi, insumos (sábanas/amenidades), mantención, gastos comunes y contribuciones."
          />
          <DataRow
            label="Cuota del crédito"
            value={"-" + fmtMoney(results.dividendoMensual, currency, valorUF)}
            tooltip="Cuota mensual del crédito hipotecario. Lo que pagas al banco hasta terminar el plazo."
          />
          <DataRow
            label="Flujo neto promedio"
            value={(base.flujoCajaMensual >= 0 ? "+" : "") + fmtMoney(base.flujoCajaMensual, currency, valorUF)}
            isCritical={isCritical}
            tooltip="Lo que queda en tu bolsillo después de cubrir todos los costos. Si es negativo, pones plata cada mes. Es el promedio del año — la estacionalidad lo varía mes a mes."
          />
        </DrawerSection>

        {/* Estacionalidad: 12 meses. Motor calcula flujoEstacional[] con factor por mes. */}
        {results.flujoEstacional && results.flujoEstacional.length > 0 && (
          <DrawerSection label="Estacionalidad — flujo neto mes a mes">
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-3 m-0 leading-[1.5]">
              El flujo neto no es plano: varía con la temporada turística y de
              negocios de la zona. Picos y valles aquí abajo. El promedio
              anual es la línea de cero como referencia.
            </p>
            <FlujoEstacionalChartSTR
              data={results.flujoEstacional}
              currency={currency}
              valorUF={valorUF}
            />
          </DrawerSection>
        )}
      </>
    );
  }

  if (activeKey === "sensibilidad") {
    // Drawer solo-motor (E.2): patrón cap_rate LTR. Sin narrativa IA.
    const rows = results.sensibilidad;
    const breakEvenPct = results.breakEvenPctDelMercado;
    const breakEvenAnual = results.breakEvenRevenueAnual;
    return (
      <>
        {/* ═══ CONVERSIÓN 11 (FASE 4.2) — el equilibrio, antes de la tabla ═══
            La pregunta que la tabla responde en frío ("¿alcanza?") se muestra primero
            como comparación directa: lo que la zona mediana factura contra lo que este
            deal necesita para no pedir plata. Acá las dos magnitudes SÍ difieren en
            orden visible, así que la barra desde cero es la forma correcta. */}
        {/* D-11(b) — apertura del cuerpo (mockup 13-11): encuadre determinista. */}
        <VProsa>
          Tu flujo depende de cuánto rinda la zona. Esto es lo que necesitas — y lo que la zona
          realmente da.
        </VProsa>

        {(() => {
          // AUDITORÍA fase42 (1) — acá vivía un bug de ESCALA: `breakEvenPct` viaja
          // como FRACCIÓN (1,44 = 144%) y el código la dividía por 100 como si fuera
          // porcentaje. Efecto doble en la misma pantalla: la barra de la zona quedaba
          // inflada ×100 (mezcla mensual/anual aparente) y el pie decía "necesitas
          // facturar 1%" (Math.round(1,44)) junto a un encabezado que decía 144%.
          // Ambas magnitudes son ANUALES y se rotulan "/año" (propuesta-13-11).
          const necesitas = breakEvenAnual;
          const zonaMediana = breakEvenPct > 0 ? necesitas / breakEvenPct : 0;
          if (!(necesitas > 0) || !(zonaMediana > 0)) return null;
          const techo = Math.max(necesitas, zonaMediana);
          return (
            <VViz t="Lo que necesitas contra lo que rinde la zona">
              <Bars
                rows={[
                  // T3 — compacto: el valor cuelga del borde de la barra (posición
                  // dependiente del dato), así que va en forma corta ($9,7M/año).
                  {
                    k: "Lo que genera la zona mediana",
                    v: `${fmtAxisMoney(zonaMediana, currency, valorUF)}/año`,
                    pct: (zonaMediana / techo) * 100,
                  },
                  {
                    k: "Lo que necesitas para no poner plata",
                    v: `${fmtAxisMoney(necesitas, currency, valorUF)}/año`,
                    pct: (necesitas / techo) * 100,
                    destacada: necesitas > zonaMediana,
                  },
                ]}
              />
              <div className="compo-total" style={{ marginTop: 10 }}>
                <span className="k">Necesitas facturar</span>
                {/* CROSS-CHECK de pantalla: misma derivación que la cifra del encabezado
                    del hallazgo (sensibilidad-str-hallazgo.ts: round(fracción × 100)),
                    sobre el MISMO snapshot persistido — coinciden por construcción. */}
                <span className="v">{Math.round(breakEvenPct * 100)}% de lo que factura la zona mediana</span>
              </div>
            </VViz>
          );
        })()}

        {/* D-11(a) — la etiqueta absorbe el párrafo ("Tu NOI mensual si…" era la
            etiqueta con otras palabras); el matiz de procedencia (AirROI, sin factor
            de tu propiedad) baja al VFuente del pie (T1). */}
        <DrawerSection label="Tu NOI mensual según cuánto rinda el mercado">
          {/* FASE 4 — tabla del VOCABULARIO: scroll horizontal CONTENIDO + cue.
              Es el arquetipo "datos pesados": la matriz nunca empuja el ancho
              del documento, se desliza dentro de su caja. */}
          {(() => {
            // Traducción aprobada de los percentiles (propuesta-13-11): el rótulo
            // estadístico queda, la glosa lo vuelve legible.
            const GLOSA_PCT: Record<string, string> = {
              P25: "P25 · cuarta parte más baja",
              P50: "P50 · mediana del mercado",
              P75: "P75 · cuarta parte más alta",
              P90: "P90 · 10% más alto",
            };
            // El CRUCE: primera fila donde el corto le gana al largo, marcada solo si
            // hay cambio de signo real (si todo es positivo o todo negativo, no hay
            // frontera que señalar).
            const idxCruce = rows.findIndex((r) => r.sobreRenta >= 0);
            const hayCruce = idxCruce > 0;
            return (
              <Tabla
                headers={["Escenario", "NOI/mes", "vs arriendo largo"]}
                filas={rows.map((r, i) => ({
                  celdas: [
                    GLOSA_PCT[r.label] ?? r.label,
                    fmtMoney(r.noiMensual, currency, valorUF),
                    `${r.sobreRenta >= 0 ? "+" : ""}${fmtMoney(r.sobreRenta, currency, valorUF)}`,
                  ],
                  destacada: r.label === "P50",
                  cruce: hayCruce && i === idxCruce,
                  tonos: [null, r.noiMensual < 0 ? "neg" : null, r.sobreRenta < 0 ? "neg" : "pos"],
                }))}
                cruceLbl={hayCruce ? `↑ recién sobre ${rows[idxCruce].label} el corto le gana al arriendo largo` : undefined}
              />
            );
          })()}
        </DrawerSection>

        {!(breakEvenAnual > 0 && breakEvenPct > 0) && (
        <DrawerSection label="Punto de equilibrio">
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-3 m-0 leading-[1.5]">
            Para que tu flujo no quede en aporte mensual, necesitas generar
            al menos estos ingresos brutos:
          </p>
          <DataRow
            label="Ingresos brutos anuales de equilibrio"
            value={fmtMoney(breakEvenAnual, currency, valorUF)}
            tooltip="Ingresos brutos mínimos anuales que cubren costos operativos + cuota del crédito. Por debajo de este número, pones plata cada mes."
          />
          <DataRow
            label="% de los ingresos brutos medianos (p50)"
            value={fmtPct(breakEvenPct * 100, 0)}
            isCritical={breakEvenPct > 1}
            tooltip="Si esta cifra es >100%, ni siquiera operando al nivel mediano del mercado cubres costos. Riesgo estructural — la operación depende de superar al mercado típico."
          />
        </DrawerSection>
        )}

        {results.sensibilidadPrecio && results.sensibilidadPrecio.length > 0 && (
          <DrawerSection label="¿Y si negocias el precio?">
            <div className="grid grid-cols-1 gap-0">
              <div className="flex items-center font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] py-1.5 border-b-[0.5px] border-[var(--franco-border)]">
                <span className="flex-1">Precio</span>
                <span className="w-20 text-right">CAP</span>
                <span className="w-20 text-right">CoC</span>
                <span className="w-28 text-right">Flujo/mes</span>
              </div>
              {results.sensibilidadPrecio.map((r) => {
                const isActual = r.label === "actual";
                const flujoNeg = r.flujoCajaMensual < 0;
                return (
                  <div
                    key={r.label}
                    className="flex items-center py-2 border-b-[0.5px] border-[var(--franco-border)]"
                    style={isActual ? { background: "color-mix(in srgb, var(--franco-text) 4%, transparent)", padding: "8px 8px", borderRadius: 4 } : undefined}
                  >
                    <span className="flex-1 font-body text-[13px] text-[var(--franco-text)]" style={{ fontWeight: isActual ? 600 : 400 }}>
                      {/* T3 — compacto (mockup: "−5% · $252,2 MM"), el completo desbordaba. */}
                      {isActual
                        ? `Actual · ${fmtAxisMoney(r.precioCLP, currency, valorUF)}`
                        : `${r.label} · ${fmtAxisMoney(r.precioCLP, currency, valorUF)}`}
                    </span>
                    <span className="w-20 text-right font-mono text-[13px] font-medium">
                      {fmtPct(r.capRate * 100, 2)}
                    </span>
                    {/* Pie cero (fase 3b · D1): 'no_aplica' → "No aplica" neutro, sin rojo. */}
                    <span
                      className="w-20 text-right font-mono text-[13px]"
                      style={{
                        color: esMetricaNoAplica(r.cashOnCash)
                          ? "var(--franco-text-secondary)"
                          : (metricaValorONull(r.cashOnCash) ?? 0) < 0
                            ? "var(--signal-red)"
                            : "var(--franco-text)",
                      }}
                    >
                      {esMetricaNoAplica(r.cashOnCash)
                        ? NO_APLICA_VALOR
                        : metricaValorONull(r.cashOnCash) !== null
                          ? fmtPct((metricaValorONull(r.cashOnCash) as number) * 100, 1)
                          : "—"}
                    </span>
                    <span className="w-28 text-right font-mono text-[13px]" style={{ color: flujoNeg ? "var(--signal-red)" : "var(--franco-text)" }}>
                      {(r.flujoCajaMensual >= 0 ? "+" : "")}
                      {fmtMoney(r.flujoCajaMensual, currency, valorUF)}
                    </span>
                  </div>
                );
              })}
            </div>
          </DrawerSection>
        )}

        {/* AUDITORÍA fase42 (8) — el subsidio deja de ser caja apilada y pasa a
            VProsa del cuerpo (texto verbatim del trabajo paralelo Ley 21.748). */}
        {results.subsidioTasa?.califica && !results.subsidioTasa.aplicado && (
          <VProsa>
            Tu depto califica para el subsidio del MINVU (Ley 21.748): vivienda nueva en
            primera venta hasta 6.000 UF. Te baja la tasa hipotecaria desde 0,6 puntos —{" "}
            {fmtPct(results.subsidioTasa.tasaConSubsidio, 1)} en el escenario más
            conservador; cuánto más, lo define tu banco. No está reflejado en este
            cálculo — la tasa que ingresaste no corresponde a la subsidiada. Si la
            negocias con el banco, el flujo mensual mejora porque baja la cuota. Pídela
            como “subsidio al crédito hipotecario Ley 21.748”.
          </VProsa>
        )}

        {/* AUDITORÍA fase42 (6) — el cuerpo terminaba EN FRÍO (arquetipo 3: datos
            pesados sin conclusión — justo lo que la conversión 11 venía a corregir).
            Cierre derivado del dato, rama por rama; nada de IA. */}
        {(() => {
          if (!(breakEvenPct > 0)) return null;
          const veces = (Math.round(breakEvenPct * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1 });
          const idxCruce = rows.findIndex((r) => r.sobreRenta >= 0);
          const hayCruce = idxCruce > 0;
          const nadiePositivo = idxCruce < 0;
          // T2 — cada rama declara su frase-fuerza (cierre determinista → mark).
          const fraseEquilibrio =
            breakEvenPct > 1 ? (
              <>
                <mark>Necesitas rendir {veces} veces lo que rinde la zona mediana</mark> solo para no
                poner plata cada mes
              </>
            ) : (
              <>
                <mark>Te basta el {Math.round(breakEvenPct * 100)}% de lo que rinde la zona mediana</mark>{" "}
                para no poner plata — hay colchón
              </>
            );
          const fraseCruce = nadiePositivo
            ? ", y ni en el escenario del 10% más alto el corto le gana al arriendo largo"
            : hayCruce
              ? `, y el corto recién le gana al arriendo largo sobre el ${rows[idxCruce].label}`
              : ", y el corto le gana al arriendo largo en todos los escenarios";
          const ultimaNeg = results.sensibilidadPrecio && results.sensibilidadPrecio.length > 0
            ? results.sensibilidadPrecio[results.sensibilidadPrecio.length - 1]
            : null;
          // La magnitud sale del label del motor ("-10%" → "10%"), no de una constante.
          const magNeg = ultimaNeg && ultimaNeg.label !== "actual" ? ultimaNeg.label.replace(/^-/, "") : null;
          const fraseNegocia = ultimaNeg && magNeg
            ? ultimaNeg.flujoCajaMensual < 0
              ? ` Ni negociando ${magNeg} del precio el flujo se da vuelta: la brecha no está en el precio, está en lo que la zona factura por noche.`
              : ` Negociando ${magNeg} del precio el flujo alcanza a darse vuelta — ahí hay una palanca real.`
            : "";
          return (
            <VCierre titulo="Qué significa">
              {fraseEquilibrio}
              {fraseCruce}.{fraseNegocia}
            </VCierre>
          );
        })()}

        {/* T1 — línea de fuente al pie, posición única del v12 (absorbe el matiz
            "sin factor de tu propiedad" que vivía como párrafo sobre la tabla). */}
        <VFuente>
          AirROI · estimación de mercado, no transacciones cerradas · sin el factor de tu propiedad
          (a diferencia del cuerpo de rentabilidad, que sí lo aplica)
        </VFuente>
      </>
    );
  }

  if (activeKey === "ventajaLtr") {
    const isCritical = results.comparativa.sobreRenta < 0;
    const payback = results.comparativa.paybackMeses;
    const seccion = ai?.vsLTR;
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />
        <DrawerSection label="Comparativa NOI mensual">
          <DataRow
            label="Largo plazo (LTR)"
            value={fmtMoney(ltr.noiMensual, currency, valorUF)}
            tooltip="NOI mensual si arriendas el depto a un solo inquilino por contrato anual. Sin esfuerzo operativo, sin estacionalidad."
          />
          <DataRow
            label="Renta corta (Auto)"
            value={fmtMoney(results.comparativa.str_auto.noiMensual, currency, valorUF)}
            tooltip="NOI con auto-gestión: pagas sólo 3% de comisión Airbnb pero requiere ~8-12 hrs semanales tuyas."
          />
          <DataRow
            label="Renta corta (Admin)"
            value={fmtMoney(results.comparativa.str_admin.noiMensual, currency, valorUF)}
            tooltip="NOI con administrador profesional: pagas 18-22% de comisión pero la operación es 100% pasiva."
          />
          <DataRow
            label="Sobre-renta vs LTR"
            value={(results.comparativa.sobreRenta >= 0 ? "+" : "") + fmtMoney(results.comparativa.sobreRenta, currency, valorUF)}
            isCritical={isCritical}
            tooltip="Cuánto más genera STR vs LTR cada mes. Bajo 30% suele no compensar el esfuerzo operativo adicional."
          />
        </DrawerSection>
        <DrawerSection label="Recuperación amoblamiento">
          <DataRow
            label="Recuperación de inversión en amoblamiento"
            value={
              payback < 0
                ? "Sobre-renta no compensa"
                : payback === 0
                  ? "Sin amoblamiento"
                  : `${payback} meses`
            }
            isCritical={payback < 0}
            tooltip="Meses de sobre-renta necesarios para recuperar la inversión inicial en muebles, electrodomésticos y decoración."
          />
        </DrawerSection>
        <EstrategiaSugerida text={seccion?.estrategiaSugerida} />
        <CajaFranco
          text={seccion?.cajaAccionable}
          label="Guión para decidir:"
          variant="info"
        />
      </>
    );
  }

  // factibilidad y riesgos (ancla pirámide: ocupacion_vs_banda)
  const isCriticalReg = regulacion === "no";
  const riesgosSec = ai?.riesgos;
  const operacionSec = ai?.operacion;
  const aperturaText = !riesgosSec?.contenido && operacionSec?.contenido
    ? operacionSec.contenido
    : null;
  return (
    <>
      {aperturaText && <NarrativeIA text={aperturaText} />}
      <DrawerSection label="Datos de factibilidad">
        <DataRow
          label="Regulación edificio"
          value={
            regulacion === "si"
              ? "Permitido"
              : regulacion === "no"
                ? "Prohibido"
                : "No verificado"
          }
          isCritical={isCriticalReg}
          tooltip="Si el reglamento de copropiedad del edificio permite arriendo corto plazo. 'Permitido' no garantiza permanencia — la asamblea puede modificarlo."
        />
        <DataRow
          label="Zona"
          value={comuna}
          tooltip="Comuna donde está la propiedad. Cada zona tiene perfil de demanda distinto: turismo, negocios, salud, residencial."
        />
      </DrawerSection>

      {/* CUERPO 14 · VIZ ÚNICA (decisión 28-ago) — ocupación observada contra la
          banda comunal: el 42% del encabezado por fin tiene contra qué leerse. Eje
          posicional (la forma aprobada para diferencias de un dígito), escala real
          0-100 de la ocupación — sin barras desde cero. Solo se dibuja con dato
          observado o supuesto declarado: en fallback (sin dato, supuesto 45%) una
          comparación "observada vs banda" mentiría. */}
      {(() => {
        const hOcc = results.hallazgos?.find((h) => h.id === "ocupacion_vs_banda");
        const v = hOcc && hOcc.id === "ocupacion_vs_banda" ? hOcc.valor : null;
        if (!v || v.esFallback || !(v.bandaComunalPct > 0)) return null;
        const gap = Math.round(v.gapPts);
        return (
          <VViz t="Tu ocupación contra la banda de la comuna">
            <Thermo
              invertido
              pct={v.ocupacionPct}
              refPct={v.bandaComunalPct}
              legend={[
                { k: v.esOverride ? "tu supuesto" : "tu ocupación", v: `${Math.round(v.ocupacionPct)}%` },
                { k: "banda comunal", v: `${Math.round(v.bandaComunalPct)}%` },
                { k: "brecha", v: `${gap >= 0 ? "+" : "−"}${Math.abs(gap)} pts` },
              ]}
            />
          </VViz>
        );
      })()}

      <DrawerSection label="Riesgos identificados">
        <p className="font-mono text-[11px] mt-1 mb-3 m-0 leading-[1.5] text-[var(--doc-tx3)]">
          ● Toda inversión STR tiene flancos. Los más relevantes para este depto:
        </p>
        <RiesgosLista contenido={riesgosSec?.contenido} />
      </DrawerSection>

      {riesgosSec?.contenido && operacionSec?.contenido && (
        <DrawerSection label="Contexto operativo">
          <p className="font-body text-[14px] text-[var(--doc-tx2)] leading-[1.65] m-0 whitespace-pre-wrap">
            {operacionSec.contenido}
          </p>
        </DrawerSection>
      )}

      {/* Decisión 28-ago — el último cuerpo fuera del vocabulario entra: el StateBox
          pasa a VCierre con título rotativo; la prosa (IA) conserva su tono y el
          destacador lo trae la propia caja desde v9 (plumonInline lo pinta). */}
      {(riesgosSec?.cajaAccionable || operacionSec?.cajaAccionable)?.trim() && (
        <VCierre titulo="Si decides avanzar">
          {plumonInline(riesgosSec?.cajaAccionable || operacionSec?.cajaAccionable)}
        </VCierre>
      )}

      {/* T1 — el matiz del tooltip de regulación sube a la línea de fuente; el ⓘ
          queda como profundidad. La cláusula de ocupación dice la verdad del caso
          (observada / definida por ti / supuesto sin dato). */}
      <VFuente>
        Motor Franco · regulación declarada por el usuario, no verificada ·{" "}
        {(() => {
          const hOcc = results.hallazgos?.find((h) => h.id === "ocupacion_vs_banda");
          const v = hOcc && hOcc.id === "ocupacion_vs_banda" ? hOcc.valor : null;
          if (v?.esOverride) return "ocupación definida por ti, no observada";
          if (v?.esFallback) return "ocupación supuesta (45%, sin dato observado)";
          return "ocupación observada de la zona (AirROI)";
        })()}
      </VFuente>
    </>
  );
}
