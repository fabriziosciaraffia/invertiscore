"use client";

import { useState } from "react";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { InfoTooltip } from "@/components/ui/tooltip";
import { MiniCardSTR, type MiniCardSTRPunchline } from "./MiniCardSTR";
import { DrawerSTR, type DrawerKeySTR } from "./DrawerSTR";
import { fmtMoney, fmtPct } from "../utils";

/**
 * Subject Card Grid — variante Renta Corta (Patrón 2 del design system).
 * Grid 2×2 de 4 dimensiones STR + drawers de detalle.
 *
 * Las 4 dimensiones (orden fijo) y las cifras del punchline vienen del motor
 * STR (Ronda 4b), nunca de IA — coherencia con la doctrina LTR.
 */

interface DimMeta {
  key: DrawerKeySTR;
  numero: string;
  label: string;
}

const DIMENSIONS: DimMeta[] = [
  { key: "rentabilidad", numero: "02", label: "RENTABILIDAD" },
  { key: "sostenibilidad", numero: "03", label: "SOSTENIBILIDAD" },
  { key: "ventajaLtr", numero: "04", label: "VENTAJA vs LTR" },
  { key: "factibilidad", numero: "05", label: "FACTIBILIDAD" },
];

interface InputDataSTR {
  edificioPermiteAirbnb?: "si" | "no" | "no_seguro";
}

export function SubjectCardGridSTR({
  results,
  inputData,
  comuna,
  currency,
  valorUF,
}: {
  results: ShortTermResult;
  inputData: InputDataSTR | null | undefined;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
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
    ventajaLtr: {
      value: `${sobreRenta >= 0 ? "+" : ""}${fmtMoney(sobreRenta, currency, valorUF)}/mes`,
      sub: paybackMeses > 0
        ? `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR · payback amoblamiento ${paybackMeses}m`
        : paybackMeses === 0
          ? `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR`
          : `${fmtPct(sobreRentaPct * 100, 0)} sobre LTR · payback no recupera`,
      color: sobreRenta < 0 ? "var(--signal-red)" : "var(--franco-text)",
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
    ventajaLtr: sobreRenta >= 0
      ? "¿Cuánto más te da STR vs LTR?"
      : "¿Vale más arrendar largo en este depto?",
    factibilidad: regulacion === "no"
      ? "¿Por qué no se puede operar acá?"
      : "¿Es posible operar STR en este depto?",
  };

  // ─── Drawer titles ───────────────────────
  const drawerTitulos: Record<DrawerKeySTR, string> = {
    rentabilidad: "Detalle de retorno y rentabilidad",
    sostenibilidad: "Tu flujo mes a mes",
    ventajaLtr: "STR vs arriendo largo",
    factibilidad: "Regulación, zona y operativa",
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {DIMENSIONS.map((dim) => (
          <MiniCardSTR
            key={dim.key}
            numero={dim.numero}
            label={dim.label}
            pregunta={preguntas[dim.key]}
            punchline={punchlines[dim.key]}
            onClick={() => setActiveDrawer(dim.key)}
          />
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
            results={results}
            inputData={inputData}
            comuna={comuna}
            currency={currency}
            valorUF={valorUF}
          />
        )}
      </DrawerSTR>
    </>
  );
}

/* ─── Drawer content por dimensión ─────────────────────────── */

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

function ConclusionBlock({ label, text, kpi, kpiLabel }: { label: string; text: string; kpi?: string; kpiLabel?: string }) {
  return (
    <div
      className="mt-4 p-4"
      style={{
        background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
        borderLeft: "3px solid var(--signal-red)",
        borderRadius: "0 8px 8px 0",
      }}
    >
      <p
        className="font-mono uppercase mb-1.5"
        style={{
          fontSize: 9,
          letterSpacing: "0.08em",
          color: "var(--signal-red)",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p className="font-body italic text-[13px] text-[var(--franco-text)] m-0 leading-[1.5] mb-2">
        {text}
      </p>
      {kpi && (
        <p className="font-mono text-[24px] font-bold m-0" style={{ color: "var(--signal-red)" }}>
          {kpi}
          {kpiLabel && <span className="font-mono text-[11px] text-[var(--franco-text-secondary)] ml-2 font-normal">{kpiLabel}</span>}
        </p>
      )}
    </div>
  );
}

function DrawerContent({
  activeKey,
  results,
  inputData,
  comuna,
  currency,
  valorUF,
}: {
  activeKey: DrawerKeySTR;
  results: ShortTermResult;
  inputData: InputDataSTR | null | undefined;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const base = results.escenarios.base;
  const conservador = results.escenarios.conservador;
  const agresivo = results.escenarios.agresivo;
  const ltr = results.comparativa.ltr;
  const regulacion = inputData?.edificioPermiteAirbnb ?? "no_seguro";

  if (activeKey === "rentabilidad") {
    return (
      <>
        <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.6] mb-5">
          La rentabilidad operacional del escenario base — el más probable según la mediana de la zona — y cómo varía si cae al p25 (conservador) o sube al p75 (agresivo).
        </p>
        <DrawerSection label="Escenario base (P50)">
          <DataRow
            label="Revenue anual bruto"
            value={fmtMoney(base.revenueAnual, currency, valorUF)}
            tooltip="Total de ingresos del año asumiendo la mediana del mercado de la zona. Sin descontar costos."
          />
          <DataRow
            label="NOI mensual"
            value={fmtMoney(base.noiMensual, currency, valorUF)}
            tooltip="Ingresos del Airbnb menos costos operativos (limpieza, comisiones, suministros, administrador), antes del dividendo."
          />
          <DataRow
            label="CAP Rate"
            value={fmtPct(base.capRate * 100, 2)}
            tooltip="NOI anual dividido por precio de compra. En STR saludable: 6-8%. Bajo 5% indica precio alto vs lo que el activo genera."
          />
          <DataRow
            label="Cash-on-Cash"
            value={fmtPct(base.cashOnCash * 100, 1)}
            isCritical={base.cashOnCash < 0}
            tooltip="Retorno anual sobre el capital efectivamente invertido (pie + gastos cierre + amoblamiento). Si es negativo, pones plata extra cada mes."
          />
          <DataRow
            label="Rentabilidad bruta"
            value={fmtPct(base.rentabilidadBruta * 100, 2)}
            tooltip="Revenue anual dividido por precio de compra, sin descontar nada. Útil sólo como referencia rápida — el corredor te muestra esto."
          />
        </DrawerSection>
        <DrawerSection label="Rango por percentil">
          <DataRow
            label="Conservador (p25)"
            value={fmtMoney(conservador.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="NOI si tu propiedad opera al nivel del 25% más bajo del mercado de la zona. Mala temporada, reviews flojos o competencia fuerte."
          />
          <DataRow
            label="Base (p50)"
            value={fmtMoney(base.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="Mediana de la zona: el escenario más probable si operas a nivel promedio del mercado."
          />
          <DataRow
            label="Agresivo (p75)"
            value={fmtMoney(agresivo.noiMensual, currency, valorUF) + "/mes NOI"}
            tooltip="NOI si superas al 75% del mercado de la zona. Requiere pricing dinámico, fotografía profesional y reviews ≥4,7."
          />
        </DrawerSection>
      </>
    );
  }

  if (activeKey === "sostenibilidad") {
    const breakEvenPct = results.breakEvenPctDelMercado;
    const isCritical = base.flujoCajaMensual < 0;
    return (
      <>
        <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.6] mb-5">
          {isCritical
            ? `Tu operación pierde ${fmtMoney(Math.abs(base.flujoCajaMensual), currency, valorUF)} cada mes en el escenario base. Hace falta que el mercado opere al ${fmtPct(breakEvenPct * 100, 0)} del nivel base solo para cubrir costos + dividendo.`
            : `Te quedan ${fmtMoney(base.flujoCajaMensual, currency, valorUF)} mensuales después de cubrir costos + dividendo. Tu break-even queda al ${fmtPct(breakEvenPct * 100, 0)} del mercado base.`}
        </p>
        <DrawerSection label="Flujo mensual base">
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
            label="Costos operativos"
            value={"-" + fmtMoney(base.costosOperativos, currency, valorUF)}
            tooltip="Suma mensual de electricidad, agua, wifi, insumos (sábanas/amenities), mantención, gastos comunes y contribuciones."
          />
          <DataRow
            label="Dividendo"
            value={"-" + fmtMoney(results.dividendoMensual, currency, valorUF)}
            tooltip="Cuota mensual del crédito hipotecario. Lo que pagas al banco hasta terminar el plazo."
          />
          <DataRow
            label="Flujo neto"
            value={(base.flujoCajaMensual >= 0 ? "+" : "") + fmtMoney(base.flujoCajaMensual, currency, valorUF)}
            isCritical={isCritical}
            tooltip="Lo que queda en tu bolsillo después de cubrir todos los costos. Si es negativo, pones plata cada mes."
          />
        </DrawerSection>
        {isCritical && (
          <ConclusionBlock
            label="ANTES DE FIRMAR"
            text="Necesitas un fondo de reserva de al menos 6 meses de aporte: cualquier vacancia prolongada o caída temporal de tarifas borra el equilibrio."
            kpi={fmtMoney(Math.abs(base.flujoCajaMensual) * 6, currency, valorUF)}
            kpiLabel="reserva mínima sugerida"
          />
        )}
      </>
    );
  }

  if (activeKey === "ventajaLtr") {
    const isCritical = results.comparativa.sobreRenta < 0;
    const payback = results.comparativa.paybackMeses;
    return (
      <>
        <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.6] mb-5">
          {isCritical
            ? `Tu STR rinde menos que arrendar largo plazo. La diferencia mensual de ${fmtMoney(Math.abs(results.comparativa.sobreRenta), currency, valorUF)} es a favor del LTR.`
            : `Tu STR genera ${fmtMoney(results.comparativa.sobreRenta, currency, valorUF)} más que arrendar largo plazo. Eso compensa el mayor esfuerzo operativo siempre que la ocupación se sostenga.`}
        </p>
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
            tooltip="Cuánto más genera STR vs LTR cada mes. Bajo 30% suele no compensar el esfuerzo operacional adicional."
          />
        </DrawerSection>
        <DrawerSection label="Recuperación amoblamiento">
          <DataRow
            label="Payback amoblamiento"
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
      </>
    );
  }

  // factibilidad
  const isCriticalReg = regulacion === "no";
  return (
    <>
      <p className="font-body text-[14px] text-[var(--franco-text)] leading-[1.6] mb-5">
        {isCriticalReg
          ? "El edificio prohíbe explícitamente la renta corta. Cualquier proyección STR es teórica salvo que se desafíe la regulación interna — riesgo legal alto."
          : regulacion === "si"
            ? `El edificio acepta operar en renta corta y la zona ${comuna} tiene demanda turística/transitoria activa. Validar reglamento interno antes de firmar.`
            : `Por defecto la regulación se asume "no segura". Confirma con la administración del edificio antes de cerrar — un reglamento que prohíbe STR invalida toda la proyección.`}
      </p>
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
      {regulacion === "no_seguro" && (
        <div
          className="mt-4 p-4"
          style={{
            background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
            borderLeft: "3px solid var(--franco-text-secondary)",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <p className="font-mono uppercase mb-1.5" style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}>
            HAZTE ESTA PREGUNTA
          </p>
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 leading-[1.5]">
            ¿Cómo verificarás antes de firmar que el reglamento del edificio no prohíbe arriendos por noche?
          </p>
        </div>
      )}
    </>
  );
}
