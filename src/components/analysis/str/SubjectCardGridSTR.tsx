"use client";

import { useMemo, useState } from "react";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { AIAnalysisSTRv2 } from "@/lib/types";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import { extractRiesgos } from "@/components/ui/AnalysisDrawer";
import { MiniCardSTR, type MiniCardSTRPunchline } from "./MiniCardSTR";
import { DrawerSTR, type DrawerKeySTR } from "./DrawerSTR";
import { FlujoEstacionalChartSTR } from "./FlujoEstacionalChartSTR";
import { DrawerTipoHuesped } from "./DrawerTipoHuesped";
import { calcGuestProfile, PERFIL_LABEL } from "@/lib/str-guest-profile";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Subject Card Grid — variante Renta Corta (Patrón 2 del design system).
 * Grid 2-col responsive de 5 dimensiones STR + drawers de detalle.
 *
 * Iteración Commit 2 — 2026-05-11:
 * Cada drawer embebe la narrativa IA correspondiente + tabla motor +
 * cajaAccionable Franco obligatoria (Patrón 3 conclusivo). Paridad estructural
 * con AnalysisDrawer LTR.
 *
 * Iteración Commit 2b — 2026-05-11:
 * - 5 drawers (era 4): se inserta 04 SENSIBILIDAD. Renumeración:
 *     02 Rentabilidad | 03 Sostenibilidad | 04 Sensibilidad (NUEVO)
 *     05 Ventaja LTR (ex-04) | 06 Factibilidad y riesgos (ex-05)
 * - Drawer 02 expone desglose costos operativos detallado.
 * - Drawer 03 expone flujo estacional 12 meses (chart).
 * - Drawer 04 SENSIBILIDAD nuevo: P25/P50/P75/P90 + breakeven explícito.
 *
 * Mapping AI ↔ drawer:
 *   02 Rentabilidad    ← ai.rentabilidad
 *   03 Sostenibilidad  ← ai.largoPlazo  (horizonte + estacionalidad mensual)
 *   04 Sensibilidad    ← ai.rentabilidad (reusado contexto — sensibilidad
 *                        responde "qué tan robusta es esta proyección")
 *   05 Ventaja vs LTR  ← ai.vsLTR + estrategiaSugerida
 *   06 Factibilidad+R  ← ai.riesgos (parseado en 3-5 ítems) + ai.operacion
 *
 * Las cifras del punchline siguen viniendo del motor (no de IA) — coherencia
 * con la doctrina §1.1 (motor produce datos, Franco interpreta).
 */

interface DimMeta {
  key: DrawerKeySTR;
  numero: string;
  label: string;
}

const DIMENSIONS: DimMeta[] = [
  { key: "rentabilidad", numero: "02", label: "RENTABILIDAD" },
  { key: "sostenibilidad", numero: "03", label: "SOSTENIBILIDAD" },
  { key: "sensibilidad", numero: "04", label: "SENSIBILIDAD" },
  { key: "ventajaLtr", numero: "05", label: "VENTAJA vs LTR" },
  { key: "tipoHuesped", numero: "06", label: "TIPO DE HUÉSPED" },
  { key: "factibilidad", numero: "07", label: "FACTIBILIDAD Y RIESGOS" },
];

interface InputDataSTR {
  edificioPermiteAirbnb?: "si" | "no" | "no_seguro";
  // Costos operativos detallados (Commit 2b — desglose drawer 02).
  // Se persisten en `analisis.input_data` jsonb desde el wizard v3.
  // Opcionales por backward-compat con análisis legacy pre-2026-05.
  costoElectricidad?: number;
  costoAgua?: number;
  costoWifi?: number;
  costoInsumos?: number;
  mantencion?: number;
  gastosComunes?: number;
  contribuciones?: number; // CLP trimestrales
  // Coordenadas (Commit 2c — drawer 06 Tipo de huésped). Opcionales para
  // backward-compat con análisis legacy sin geocodificación.
  lat?: number;
  lng?: number;
  zonaRadio?: { lat?: number; lng?: number };
}

export function SubjectCardGridSTR({
  analysisId,
  results,
  inputData,
  comuna,
  currency,
  valorUF,
  ai,
}: {
  /** Necesario para drawer 06 Tipo de huésped (lazy fetch del endpoint
   * guest-insight). */
  analysisId: string;
  results: ShortTermResult;
  inputData: InputDataSTR | null | undefined;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
  /** AI analysis v2. Si null o aún cargando, los drawers muestran solo la
   * tabla del motor con un placeholder "esperando análisis IA". */
  ai: AIAnalysisSTRv2 | null;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKeySTR | null>(null);

  const base = results.escenarios.base;
  const flujoMensual = base.flujoCajaMensual;
  const capRate = base.capRate;
  const cashOnCash = base.cashOnCash;
  const sobreRenta = results.comparativa.sobreRenta;
  const sobreRentaPct = results.comparativa.sobreRentaPct;
  const paybackMeses = results.comparativa.paybackMeses;
  const breakEvenPct = results.breakEvenPctDelMercado;
  const regulacion = inputData?.edificioPermiteAirbnb ?? "no_seguro";

  // Sensibilidad punchline — "cuán robusta es la proyección".
  // Tomamos la row P25 (escenario pesimista) y el delta vs base.
  const sensibilidadP25 = results.sensibilidad.find((r) => r.label === "P25");
  const noiP25 = sensibilidadP25?.noiMensual ?? 0;
  const sensibilidadGap = base.noiMensual > 0
    ? (base.noiMensual - noiP25) / base.noiMensual
    : 0;

  // Tipo de huésped punchline — calculado sincrónicamente desde el motor
  // (lat/lng + comuna + POIs). Si no hay coords, el card cae a placeholder
  // genérico y el drawer mostrará error al abrir.
  const lat = inputData?.lat ?? inputData?.zonaRadio?.lat ?? null;
  const lng = inputData?.lng ?? inputData?.zonaRadio?.lng ?? null;
  const guestProfileSync = useMemo(() => {
    if (typeof lat !== "number" || typeof lng !== "number" || !comuna) return null;
    try {
      return calcGuestProfile(lat, lng, comuna);
    } catch (e) {
      console.warn("SubjectCardGridSTR: calcGuestProfile failed", e);
      return null;
    }
  }, [lat, lng, comuna]);

  // ─── Punchlines por dimensión ───────────────────────
  const punchlines: Record<DrawerKeySTR, MiniCardSTRPunchline> = {
    rentabilidad: {
      value: `CAP ${fmtPct(capRate * 100, 1)}`,
      sub: `Cash-on-Cash ${fmtPct(cashOnCash * 100, 1)} anual`,
      color: capRate <= 0 || cashOnCash < 0 ? "var(--signal-red)" : "var(--franco-text)",
    },
    sostenibilidad: {
      value: `${flujoMensual >= 0 ? "+" : "-"}${fmtMoney(Math.abs(flujoMensual), currency, valorUF)}`,
      sub: flujoMensual < 0
        ? `Aporte mensual · break-even al ${fmtPct(breakEvenPct * 100, 0)} del mercado`
        : `Te queda mes a mes · break-even al ${fmtPct(breakEvenPct * 100, 0)} del mercado`,
      color: flujoMensual < 0 ? "var(--signal-red)" : "var(--franco-text)",
    },
    sensibilidad: {
      value: noiP25 < 0
        ? `NOI P25: −${fmtMoney(Math.abs(noiP25), currency, valorUF)}`
        : `NOI P25: ${fmtMoney(noiP25, currency, valorUF)}`,
      sub: sensibilidadGap > 0
        ? `Caída de ${fmtPct(sensibilidadGap * 100, 0)} en escenario pesimista`
        : "Proyección robusta a escenarios bajos",
      color: noiP25 < 0 || sensibilidadGap > 0.4 ? "var(--signal-red)" : "var(--franco-text)",
    },
    ventajaLtr: {
      value: `${sobreRenta >= 0 ? "+" : ""}${fmtMoney(sobreRenta, currency, valorUF)}/mes`,
      sub: paybackMeses > 0
        ? `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR · recupera amoblamiento en ${paybackMeses}m`
        : paybackMeses === 0
          ? `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR`
          : `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR · sobre-renta no compensa amoblamiento`,
      color: sobreRenta < 0 ? "var(--signal-red)" : "var(--franco-text)",
    },
    tipoHuesped: guestProfileSync
      ? {
          value: PERFIL_LABEL[guestProfileSync.dominante.perfil],
          sub: guestProfileSync.secundarios.length > 0
            ? `${guestProfileSync.dominante.porcentaje}% del flujo esperado · ${guestProfileSync.secundarios.length} perfil${guestProfileSync.secundarios.length > 1 ? "es" : ""} secundari${guestProfileSync.secundarios.length > 1 ? "os" : "o"}`
            : `${guestProfileSync.dominante.porcentaje}% del flujo esperado · perfil dominante claro`,
          color: "var(--franco-text)",
        }
      : {
          value: "Calculando perfil…",
          sub: "Abre el detalle para ver el perfil de huésped",
          color: "var(--franco-text-secondary)",
        },
    factibilidad: {
      value:
        regulacion === "si"
          ? "Permitido"
          : regulacion === "no"
            ? "Prohibido"
            : "Verificar",
      sub: regulacion === "si"
        ? `Edificio acepta · zona ${comuna}`
        : regulacion === "no"
          ? "Edificio NO permite renta corta"
          : `Confirma con la administración · zona ${comuna}`,
      color: regulacion === "no" ? "var(--signal-red)" : "var(--franco-text)",
    },
  };

  // ─── Preguntas dinámicas ───────────────────────
  const preguntas: Record<DrawerKeySTR, string> = {
    rentabilidad:
      capRate <= 0 || cashOnCash < 0
        ? "¿La rentabilidad cubre el riesgo?"
        : "¿Qué retorno entrega esta operación?",
    sostenibilidad: flujoMensual < 0
      ? "¿Cuánto te cuesta sostener este depto?"
      : "¿Cuánto te queda mes a mes?",
    sensibilidad: sensibilidadGap > 0.4 || noiP25 < 0
      ? "¿Qué tan frágil es esta proyección?"
      : "¿Qué tan robusta es esta proyección?",
    ventajaLtr: sobreRenta >= 0
      ? "¿Cuánto más te da STR vs LTR?"
      : "¿Vale más arrendar largo en este depto?",
    tipoHuesped: "¿Quién va a alojarse acá?",
    factibilidad: regulacion === "no"
      ? "¿Por qué no se puede operar acá?"
      : "¿Es posible operar STR en este depto?",
  };

  // ─── Drawer titles ───────────────────────
  const drawerTitulos: Record<DrawerKeySTR, string> = {
    rentabilidad: "Detalle de retorno y rentabilidad",
    sostenibilidad: "Flujo mensual y estacionalidad",
    sensibilidad: "Sensibilidad a ocupación y mercado",
    ventajaLtr: "STR vs arriendo largo",
    tipoHuesped: "Quién va a alojarse y cómo amoblar para él",
    factibilidad: "Regulación, zona y riesgos",
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key}>
            <MiniCardSTR
              numero={dim.numero}
              label={dim.label}
              pregunta={preguntas[dim.key]}
              punchline={punchlines[dim.key]}
              onClick={() => setActiveDrawer(dim.key)}
            />
          </div>
        ))}
      </div>

      <DrawerSTR
        activeKey={activeDrawer}
        titulo={activeDrawer ? drawerTitulos[activeDrawer] : ""}
        onClose={() => setActiveDrawer(null)}
        onNavigate={(k) => setActiveDrawer(k)}
      >
        {activeDrawer && (
          <DrawerContent
            activeKey={activeDrawer}
            analysisId={analysisId}
            results={results}
            inputData={inputData}
            comuna={comuna}
            currency={currency}
            valorUF={valorUF}
            ai={ai}
          />
        )}
      </DrawerSTR>
    </>
  );
}

/* ─── Helpers de presentación ─────────────────────────── */

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p
        className="font-mono uppercase mb-2"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--franco-text-secondary)",
          fontWeight: 500,
        }}
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
    <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.65] mb-5 m-0 whitespace-pre-wrap">
      {text}
    </p>
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
        {text}
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
        { titulo: "Caída de ocupación", descripcion: "Si la ocupación baja al p25 del mercado, el flujo se da vuelta. Mantén un fondo de reserva de 3-6 meses de costos fijos." },
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
            <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0 leading-[1.45]">
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
      {text}
    </StateBox>
  );
}

/**
 * Desglose de costos operativos (Commit 2b — drawer 02).
 * Expandible/colapsable para no abrumar el drawer cuando el inversor solo
 * quiere ver los headline numbers. Cifras vienen de `inputData` (motor las
 * suma agregadamente en `costosOperativos` del escenario base).
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

  // Detectar mayor componente para insight inline.
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

/* ─── Drawer content por dimensión ─────────────────────────── */

function DrawerContent({
  activeKey,
  analysisId,
  results,
  inputData,
  comuna,
  currency,
  valorUF,
  ai,
}: {
  activeKey: DrawerKeySTR;
  analysisId: string;
  results: ShortTermResult;
  inputData: InputDataSTR | null | undefined;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
  ai: AIAnalysisSTRv2 | null;
}) {
  const base = results.escenarios.base;
  const conservador = results.escenarios.conservador;
  const agresivo = results.escenarios.agresivo;
  const ltr = results.comparativa.ltr;
  const regulacion = inputData?.edificioPermiteAirbnb ?? "no_seguro";

  // Drawer 06 Tipo de huésped — Commit 2c · 2026-05-12.
  // Delega rendering a DrawerTipoHuesped (lazy fetch del endpoint guest-insight
  // via useGuestInsight hook).
  if (activeKey === "tipoHuesped") {
    return <DrawerTipoHuesped analysisId={analysisId} />;
  }

  if (activeKey === "rentabilidad") {
    const seccion = ai?.rentabilidad;
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />
        <DrawerSection label="Escenario base (P50)">
          <DataRow
            label="Ingresos brutos anuales"
            value={fmtMoney(base.revenueAnual, currency, valorUF)}
            tooltip="Total de ingresos del año asumiendo la mediana del mercado de la zona. Sin descontar costos."
          />
          <DataRow
            label="NOI mensual (ingreso neto operativo)"
            value={fmtMoney(base.noiMensual, currency, valorUF)}
            tooltip="Ingresos del Airbnb menos costos operativos (limpieza, comisiones, suministros, administrador), antes del dividendo."
          />
          <DataRow
            label="CAP Rate (rentabilidad bruta sobre precio)"
            value={fmtPct(base.capRate * 100, 2)}
            tooltip="NOI anual dividido por precio de compra. En STR saludable: 6-8%. Bajo 5% indica precio alto vs lo que el activo genera."
          />
          <DataRow
            label="Cash-on-Cash (retorno sobre capital invertido)"
            value={fmtPct(base.cashOnCash * 100, 1)}
            isCritical={base.cashOnCash < 0}
            tooltip="Retorno anual sobre el capital efectivamente invertido (pie + gastos cierre + amoblamiento). Si es negativo, pones plata extra cada mes."
          />
          <DataRow
            label="Rentabilidad bruta"
            value={fmtPct(base.rentabilidadBruta * 100, 2)}
            tooltip="Ingresos brutos anuales divididos por precio de compra, sin descontar nada. Útil sólo como referencia rápida — el corredor te muestra esto."
          />
        </DrawerSection>
        {/* Commit 3a · 2026-05-12: renombrado de "Conservador (p25) / Base (p50)
            / Agresivo (p75)" → "Pesimista / Base / Optimista" para desambiguar
            del drawer 04 SENSIBILIDAD que usa P25-P90 sobre el revenue raw del
            mercado. Acá los escenarios ya están CALIBRADOS a tu propiedad
            (factor ADR + occupancy ajustada por ejes operacionales). */}
        <DrawerSection label="Escenarios calibrados a tu propiedad">
          <DataRow
            label="Pesimista"
            value={fmtMoney(conservador.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="NOI si la operación rinde por debajo de tu base — mala temporada, reseñas flojas o competencia agresiva. Ya incluye el factor de tu edificio y nivel de amoblamiento."
          />
          <DataRow
            label="Base"
            value={fmtMoney(base.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="Escenario más probable: ADR y ocupación calibrados a la mediana de la zona, ajustados por los ejes operativos de tu propiedad (tipo de edificio + habilitación + gestión)."
          />
          <DataRow
            label="Optimista"
            value={fmtMoney(agresivo.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="NOI si superas al promedio del mercado. Requiere tarifas dinámicas por temporada, fotos profesionales y reseñas ≥4,7. Está calibrado sobre tu base — no es el percentil 75 del mercado sin ajustes."
          />
        </DrawerSection>
        <CostosBreakdown inputData={inputData} currency={currency} valorUF={valorUF} />
        <CajaFranco
          text={seccion?.cajaAccionable}
          label="Hazte esta pregunta:"
          variant="info"
        />
      </>
    );
  }

  if (activeKey === "sostenibilidad") {
    const isCritical = base.flujoCajaMensual < 0;
    const seccion = ai?.largoPlazo;
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />
        <DrawerSection label="Flujo mensual promedio">
          <DataRow
            label="Ingreso bruto mensual"
            value={fmtMoney(base.ingresoBrutoMensual, currency, valorUF)}
            tooltip="ADR × ocupación × días del mes. Lo que entra antes de comisiones y costos operativos."
          />
          <DataRow
            label="Comisión gestión"
            value={"-" + fmtMoney(base.comisionMensual, currency, valorUF)}
            tooltip="Lo que cobra la plataforma o el administrador. Auto-gestión: 3% (Airbnb). Administrador profesional: 18-22% del bruto."
          />
          <DataRow
            label="Costos operativos (suma)"
            value={"-" + fmtMoney(base.costosOperativos, currency, valorUF)}
            tooltip="Suma mensual de electricidad, agua, wifi, insumos (sábanas/amenidades), mantención, gastos comunes y contribuciones. Desglose disponible en el drawer 02."
          />
          <DataRow
            label="Dividendo"
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

        {/* ── Estacionalidad: 12 meses (Commit 2b) ──
            Motor calcula flujoEstacional[] con factor por mes desde AirROI. */}
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

        <CajaFranco
          text={seccion?.cajaAccionable}
          label="La apuesta que haces:"
          variant={isCritical ? "negative" : "info"}
        />
      </>
    );
  }

  if (activeKey === "sensibilidad") {
    // Nuevo drawer 04 (Commit 2b) — expone sensibilidad[] del motor.
    // Pregunta de fondo: ¿qué tan robusta es la proyección si el mercado
    // se mueve? La row P50 es nuestro escenario base; las demás dicen qué
    // pasa si ocurre cada percentil.
    const seccion = ai?.rentabilidad; // reusa contenido rentabilidad como narrativa
    const rows = results.sensibilidad;
    const breakEvenPct = results.breakEvenPctDelMercado;
    const breakEvenAnual = results.breakEvenRevenueAnual;
    return (
      <>
        <NarrativeIA text={seccion?.contenido} />

        <DrawerSection label="¿Qué pasa si el mercado se mueve?">
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-3 m-0 leading-[1.5]">
            Esta tabla muestra tu NOI mensual si la zona rinde a distintos
            percentiles de los ingresos brutos del mercado sin ajustes
            (percentil 25 a percentil 90 de AirROI sin factor de tu propiedad).
            Percentil 50 = mediana de zona. Distinto del drawer 02
            “Escenarios calibrados”, que ya aplica el factor de tu edificio
            y nivel de amoblamiento sobre la base.
          </p>
          <div className="grid grid-cols-1 gap-0">
            <div className="flex items-center font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] py-1.5 border-b-[0.5px] border-[var(--franco-border)]">
              <span className="flex-1">Escenario</span>
              <span className="w-24 text-right">NOI/mes</span>
              <span className="w-24 text-right">vs LTR</span>
            </div>
            {rows.map((r) => {
              const isBase = r.label === "P50";
              const isNeg = r.noiMensual < 0;
              return (
                <div
                  key={r.label}
                  className="flex items-center py-2 border-b-[0.5px] border-[var(--franco-border)]"
                  style={isBase ? { background: "color-mix(in srgb, var(--franco-text) 4%, transparent)", padding: "8px 8px", borderRadius: 4 } : undefined}
                >
                  <span className="flex-1 font-body text-[13px] text-[var(--franco-text)]" style={{ fontWeight: isBase ? 600 : 400 }}>
                    {r.label}
                    {isBase ? " · base" : null}
                  </span>
                  <span
                    className="w-24 text-right font-mono text-[13px] font-medium"
                    style={{ color: isNeg ? "var(--signal-red)" : "var(--franco-text)" }}
                  >
                    {fmtMoney(r.noiMensual, currency, valorUF)}
                  </span>
                  <span
                    className="w-24 text-right font-mono text-[12px]"
                    style={{ color: r.sobreRenta < 0 ? "var(--signal-red)" : "var(--franco-text-secondary)" }}
                  >
                    {(r.sobreRenta >= 0 ? "+" : "")}
                    {fmtMoney(r.sobreRenta, currency, valorUF)}
                  </span>
                </div>
              );
            })}
          </div>
        </DrawerSection>

        <DrawerSection label="Punto de equilibrio">
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-3 m-0 leading-[1.5]">
            Para que tu flujo no quede en aporte mensual, necesitas generar
            al menos estos ingresos brutos:
          </p>
          <DataRow
            label="Ingresos brutos anuales de equilibrio"
            value={fmtMoney(breakEvenAnual, currency, valorUF)}
            tooltip="Ingresos brutos mínimos anuales que cubren costos operativos + dividendo. Por debajo de este número, pones plata cada mes."
          />
          <DataRow
            label="% de los ingresos brutos medianos (percentil 50)"
            value={fmtPct(breakEvenPct * 100, 0)}
            isCritical={breakEvenPct > 1}
            tooltip="Si esta cifra es >100%, ni siquiera operando al nivel mediano del mercado cubres costos. Riesgo estructural — la operación depende de superar al mercado típico."
          />
        </DrawerSection>

        {/* Commit 3a · 2026-05-12 — Sensibilidad al precio (paridad con LTR
            calcNegociacionScenario). Recalcula CAP/CoC/flujo si negocias
            el precio a -5% o -10%. */}
        {results.sensibilidadPrecio && results.sensibilidadPrecio.length > 0 && (
          <DrawerSection label="¿Y si negocias el precio?">
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-3 m-0 leading-[1.5]">
              Cuánto mejoran CAP, Cash-on-Cash y flujo si rebajas el precio
              de compra. El ingreso del Airbnb no cambia; lo que baja es el
              crédito + dividendo + capital invertido.
            </p>
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
                      {isActual ? "Precio actual" : `${r.label} ${fmtMoney(r.precioCLP, currency, valorUF)}`}
                    </span>
                    <span className="w-20 text-right font-mono text-[13px] font-medium">
                      {fmtPct(r.capRate * 100, 2)}
                    </span>
                    <span className="w-20 text-right font-mono text-[13px]" style={{ color: r.cashOnCash < 0 ? "var(--signal-red)" : "var(--franco-text)" }}>
                      {fmtPct(r.cashOnCash * 100, 1)}
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

        {/* Commit 3a · 2026-05-12 — Subsidio Ley 21.748 (paridad LTR). Si el
            depto califica (Nuevo ≤ 4000 UF) y la tasa ingresada NO es la
            subsidiada, sugerir pedirla al banco. */}
        {results.subsidioTasa?.califica && !results.subsidioTasa.aplicado && (
          <DrawerSection label="Subsidio a la tasa hipotecaria (Ley 21.748)">
            <p className="font-body text-[13px] text-[var(--franco-text)] mb-2 m-0 leading-[1.55]">
              Tu depto califica para el subsidio del MINVU: vivienda nueva
              bajo 4.000 UF + primera vivienda. Te baja la tasa hipotecaria
              en ~0,6 puntos (a {fmtPct(results.subsidioTasa.tasaConSubsidio, 1)} aprox).
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mb-0 m-0 leading-[1.55] italic">
              No está reflejado en este cálculo — la tasa que ingresaste no
              corresponde a la subsidiada. Si la negocias con el banco, el
              flujo mensual mejora porque baja el dividendo. Pídela como
              “subsidio al crédito hipotecario Ley 21.748”.
            </p>
          </DrawerSection>
        )}

        <CajaFranco
          text={seccion?.cajaAccionable}
          label="Antes de firmar, valida:"
          variant={breakEvenPct > 0.85 ? "attention" : "info"}
        />
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

  // factibilidad y riesgos
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

      <DrawerSection label="Riesgos identificados">
        <p className="font-mono text-[11px] mt-1 mb-3 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
          ● Toda inversión STR tiene flancos. Los más relevantes para este depto:
        </p>
        <RiesgosLista contenido={riesgosSec?.contenido} />
      </DrawerSection>

      {riesgosSec?.contenido && operacionSec?.contenido && (
        <DrawerSection label="Contexto operativo">
          <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.65] m-0 whitespace-pre-wrap">
            {operacionSec.contenido}
          </p>
        </DrawerSection>
      )}

      <CajaFranco
        text={riesgosSec?.cajaAccionable || operacionSec?.cajaAccionable}
        label="Si decides avanzar, protege estos flancos:"
        variant={isCriticalReg ? "negative" : "attention"}
      />
    </>
  );
}
