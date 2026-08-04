"use client";

// Wizard v4 — Pantallas del Acto 3 (CÓMO LO RENTABILIZAS).
// arr + arrFix (arriendo LTR: mediana real + N comparables), adr + adrFix
// (baseline AirROI: tarifa/noche + ocupación), con supuestos DIFERIDOS plegados
// (valor + fuente, read-only acá; se editan en el resumen).

import { estimarContribuciones } from "@/lib/contribuciones";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import type { ScreenProps } from "./screensActo1";
import { DEC } from "./wizardV4Nodes";
import { FuenteLine, GhostBtn, PrimaryBtn } from "./ui";
import { NumericInput } from "./NumericInput";
import { dormLabel, fmtCLP, fuenteArriendoLine, leerNum, precioUF, superficieM2 } from "./derive";

// ── Supuestos plegados (details) ──────────────────────────────────────────────

function SupuestoRow({ label, value, fuente }: { label: string; value: string; fuente: string }) {
  return (
    <div className="py-2 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body text-[13px] text-[var(--franco-text-secondary)]">{label}</span>
        <span className="font-mono text-[13px] text-[var(--franco-text)]">{value}</span>
      </div>
      <p className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-0.5 m-0">{fuente}</p>
    </div>
  );
}

function SupuestosDetails({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3 group">
      <summary className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] cursor-pointer list-none flex items-center justify-between">
        {summary}
        <span className="text-[var(--franco-text-muted)] group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="mt-2">{children}</div>
      <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-3 mb-0">
        Estos valores los edita Franco por ti. Los revisas y ajustas en el resumen.
      </p>
    </details>
  );
}

// ── arr (arriendo LTR) ────────────────────────────────────────────────────────

export function ArrScreen({ answers, data, answer, goDetour, patchAnswers }: ScreenProps) {
  const sugerido = data.arriendoSugerido;
  const listo = sugerido != null && sugerido > 0;
  // Tres estados, no dos: con dato, buscando y SIN dato. El tercero apareció el
  // 2026-08-04, cuando se retiraron los dos niveles de relleno — antes siempre
  // llegaba un número, aunque fuera inventado.
  const buscando = data.suggestionsLoading;
  const sinDato = !listo && !buscando;

  const sup = superficieM2(answers);
  const ggcc = data.ggccSugerido ?? getGgccFallback(answers.comuna ?? "", sup) ?? 0;
  const contrib = estimarContribuciones(precioUF(answers) * data.ufCLP, answers.tipoPropiedad === "nuevo");
  const supuestos = (
    <SupuestosDetails summary="Supuestos — GGCC, contribuciones, vacancia">
      <SupuestoRow label="Gastos comunes" value={`${fmtCLP(ggcc)}/mes`} fuente="gastos comunes típicos de la comuna" />
      <SupuestoRow label="Contribuciones" value={`${fmtCLP(contrib)}/trim`} fuente="fórmula SII según avalúo estimado" />
      <SupuestoRow label="Vacancia" value={`${answers.vacanciaPct ?? "5"}%`} fuente="promedio de meses sin arrendatario al año" />
    </SupuestosDetails>
  );

  // Sin comparables no hay estimación que ofrecer. Franco lo dice y pide el número
  // en vez de rellenar el campo con una cifra que no puede respaldar.
  if (sinDato) {
    const val = answers.arriendo ?? "";
    return (
      <div className="flex flex-col gap-5">
        <div>
          <NumericInput
            label="Arriendo mensual"
            value={val}
            onChange={(v) => patchAnswers({ arriendo: v })}
            decimales={DEC.arriendo}
            placeholder="650.000"
            sufijo="$"
            ecoPrefijo="$"
            ecoSufijo="/mes"
          />
          <FuenteLine>
            No hay arriendos publicados cerca de esta dirección para comparar. Ingresa el que estimas cobrar.
          </FuenteLine>
        </div>

        {supuestos}

        <PrimaryBtn onClick={() => answer("arr", { arrModo: "corregir" })} disabled={leerNum(val, DEC.arriendo) <= 0}>
          Guardar y continuar →
        </PrimaryBtn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
          Arriendo estimado
        </p>
        <p className="font-mono text-[28px] font-bold text-[var(--franco-text)] m-0 leading-none">
          {listo ? `${fmtCLP(sugerido ?? 0)}/mes` : "Estimando…"}
        </p>
        {listo && (
          <FuenteLine>{fuenteArriendoLine(data.arriendoFuente, data.arriendoN, data.radiusUsed)}</FuenteLine>
        )}
      </div>

      {supuestos}

      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryBtn
          onClick={() => answer("arr", { arrModo: "estimacion", arriendo: listo ? String(sugerido) : "" })}
          disabled={!listo}
        >
          Usar estimación →
        </PrimaryBtn>
        <GhostBtn onClick={() => goDetour("arrFix", { arrModo: "corregir" })}>Corregir</GhostBtn>
      </div>
    </div>
  );
}

export function ArrFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const val = answers.arriendo ?? (data.arriendoSugerido ? String(data.arriendoSugerido) : "");
  const valido = leerNum(val, DEC.arriendo) > 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <NumericInput
          label="Arriendo mensual"
          value={answers.arriendo ?? ""}
          onChange={(v) => patchAnswers({ arriendo: v })}
          decimales={DEC.arriendo}
          placeholder={data.arriendoSugerido ? String(data.arriendoSugerido) : "650.000"}
          sufijo="$"
          ecoPrefijo="$"
          ecoSufijo="/mes"
        />
        <FuenteLine>Lo que crees que puedes cobrar de arriendo al mes.</FuenteLine>
      </div>
      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("arrFix")} disabled={!valido}>Guardar y continuar →</PrimaryBtn>
      </div>
    </div>
  );
}

// ── adr (STR: tarifa/noche + ocupación) ───────────────────────────────────────

const DIAS_MES = 30.44;

export function AdrScreen({ answers, data, answer, goDetour }: ScreenProps) {
  const { airRoi } = data;
  const occ = airRoi.ocupacionReferencia;
  const tarifa = airRoi.ingresoBrutoMensual > 0 && occ > 0
    ? Math.round(airRoi.ingresoBrutoMensual / (DIAS_MES * occ))
    : 0;
  const listo = !airRoi.isLoading && tarifa > 0;
  const dorm = Number(answers.dormitorios) || 2;
  const costos = getCostosDefault(dorm, "basico");
  const totalOps = costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
              Tarifa / noche
            </p>
            <p className="font-mono text-[24px] font-bold text-[var(--franco-text)] m-0 leading-none">
              {listo ? fmtCLP(tarifa) : "…"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
              Ocupación
            </p>
            <p className="font-mono text-[24px] font-bold text-[var(--franco-text)] m-0 leading-none">
              {listo ? `${Math.round(occ * 100)}%` : "…"}
            </p>
          </div>
        </div>
        <FuenteLine>datos de mercado Airbnb de la zona, últimos 90 días</FuenteLine>
      </div>

      <SupuestosDetails summary="Gestión y costos">
        <SupuestoRow label="Modo de gestión" value={answers.modoGestion === "administrador" ? "Administrador" : "Auto-gestión"} fuente="por defecto operas tú; cámbialo si usas operador" />
        <SupuestoRow label="Costos operativos" value={`${fmtCLP(totalOps)}/mes`} fuente={`luz + agua + wifi + insumos — consumo operativo típico para ${dormLabel(dorm)}`} />
        <SupuestoRow label="Mantención" value={`${fmtCLP(costos.mantencion)}/mes`} fuente={`provisión mensual de mantención para ${dormLabel(dorm)}`} />
        <SupuestoRow label="Amoblamiento" value={fmtCLP(costos.costoAmoblamiento)} fuente="capex inicial estimado si el depto no está amoblado" />
      </SupuestosDetails>

      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryBtn
          onClick={() => answer("adr", {
            adrModo: "estimacion",
            adrTarifa: listo ? String(tarifa) : "",
            adrOcupacion: listo ? String(Math.round(occ * 100)) : "",
          })}
          disabled={!listo}
        >
          Usar estimación →
        </PrimaryBtn>
        <GhostBtn onClick={() => goDetour("adrFix", { adrModo: "corregir" })}>Corregir</GhostBtn>
      </div>
    </div>
  );
}

export function AdrFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const { airRoi } = data;
  const occ = airRoi.ocupacionReferencia;
  const tarifaDef = airRoi.ingresoBrutoMensual > 0 && occ > 0
    ? String(Math.round(airRoi.ingresoBrutoMensual / (DIAS_MES * occ)))
    : "";
  const valido =
    leerNum(answers.adrTarifa, DEC.tarifa) > 0 && leerNum(answers.adrOcupacion, DEC.ocupacion) > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <NumericInput
          label="Tarifa / noche"
          value={answers.adrTarifa ?? ""}
          onChange={(v) => patchAnswers({ adrTarifa: v })}
          decimales={DEC.tarifa}
          placeholder={tarifaDef || "55.000"}
          sufijo="$"
          ecoPrefijo="$"
          ecoSufijo="/noche"
        />
        <NumericInput
          label="Ocupación"
          value={answers.adrOcupacion ?? ""}
          onChange={(v) => patchAnswers({ adrOcupacion: v })}
          decimales={DEC.ocupacion}
          placeholder={occ > 0 ? String(Math.round(occ * 100)) : "60"}
          sufijo="%"
          ecoSufijo="% de ocupación"
        />
      </div>
      <FuenteLine>Ajusta si tienes datos propios de tarifa u ocupación para este depto.</FuenteLine>
      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("adrFix")} disabled={!valido}>Guardar y continuar →</PrimaryBtn>
      </div>
    </div>
  );
}
