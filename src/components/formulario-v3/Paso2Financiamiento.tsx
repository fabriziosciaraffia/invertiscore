"use client";

import { useEffect } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  calcDividendo,
  fmtCLP,
  fmtCLPShort,
  mesesHastaEntrega,
  parseDecimalLocale,
  parseNum,
  type WizardV3State,
} from "./wizardV3State";

function fmtPiePct(pct: number): string {
  if (Number.isInteger(pct)) return String(pct);
  return (Math.round(pct * 10) / 10).toString().replace(".", ",");
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function Paso2Financiamiento({
  state,
  setState,
  ufCLP,
  precioM2UF,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  ufCLP: number;
  /** UF/m² sugerido del radio (venta). Cuando llega, mostramos hint debajo del precio. */
  precioM2UF?: number | null;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = Number(state.tasaInteres) || 4.72;
  const superficie = parseNum(state.superficieUtil);

  const precioCLP = precioUF * ufCLP;
  const pieCLP = precioCLP * (piePct / 100);
  const dividendo = calcDividendo(precioUF, piePct, plazo, tasa, ufCLP);

  // Sugerencia de precio: UF/m² × superficie. Solo si ambos datos existen.
  // Techo de seguridad: 50.000 UF (realista para Santiago; si el cálculo lo
  // excede casi con seguridad hay un bug de unidades — ocultar el hint en vez
  // de mostrar basura al usuario).
  const precioSugeridoUFRaw = precioM2UF && precioM2UF > 0 && superficie > 0
    ? Math.round(precioM2UF * superficie)
    : null;
  const precioSugeridoUF = precioSugeridoUFRaw !== null && precioSugeridoUFRaw > 50000
    ? null
    : precioSugeridoUFRaw;
  if (precioSugeridoUFRaw !== null && precioSugeridoUFRaw > 50000) {
    console.warn(
      "[Paso2] precioSugeridoUF fuera de rango — ocultando hint",
      { precioSugeridoUFRaw, precioM2UF, superficie },
    );
  }

  // Prefill reactivo del precio con la sugerencia de mercado. Solo corre si:
  //   (1) el input está vacío
  //   (2) el usuario no editó manualmente "precio"
  //   (3) hay una sugerencia válida (post safety cap)
  // Al cambiar comuna/superficie la sugerencia se recalcula y este effect
  // re-dispara el prefill (respeta editedFields para no sobrescribir ediciones).
  useEffect(() => {
    if (state.precio !== "") return;
    if (state.editedFields.includes("precio")) return;
    if (!precioSugeridoUF || precioSugeridoUF <= 0) return;
    setState({ precio: String(precioSugeridoUF) });
  }, [precioSugeridoUF, state.precio, state.editedFields, setState]);

  const mesesSugeridos = state.estadoVenta === "futura"
    ? mesesHastaEntrega(state.fechaEntregaMes, state.fechaEntregaAnio)
    : 0;

  const inputBase =
    "w-full h-10 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

  // ─── Pie auto-derivado para Nuevo ──────────────────────
  // En Nuevo el user edita Cuotas y/o Cuota mensual (UF). piePct se calcula
  // como `(montoUF × cuotas / precio) × 100`. Source of truth para el motor
  // sigue siendo `piePct`; `montoCuotaPieUF` es buffer de UI.
  const cuotasNum = Number(state.cuotasPie) || mesesSugeridos || 1;
  const cuotaUFDerived = precioUF > 0 && cuotasNum > 0
    ? (precioUF * piePct / 100 / cuotasNum)
    : 0;
  const cuotaUFDisplay = state.montoCuotaPieUF !== ""
    ? state.montoCuotaPieUF
    : cuotaUFDerived > 0
      ? cuotaUFDerived.toFixed(2).replace(".", ",")
      : "";

  // TODO: si user editó monto y luego cambia precio, piePct chip puede
  // divergir levemente. Trade-off conocido, no es bug.
  function handleCuotasChange(v: string) {
    const cuotas = Number(v) || 0;
    const monto = parseDecimalLocale(state.montoCuotaPieUF);
    if (cuotas > 0 && monto > 0 && precioUF > 0) {
      const newPiePct = (monto * cuotas / precioUF) * 100;
      setState({ cuotasPie: v, piePct: newPiePct.toFixed(4) });
    } else {
      setState({ cuotasPie: v });
    }
  }

  function handleMontoChange(v: string) {
    const monto = parseDecimalLocale(v);
    const cuotas = Number(state.cuotasPie) || 0;
    if (monto > 0 && cuotas > 0 && precioUF > 0) {
      const newPiePct = (monto * cuotas / precioUF) * 100;
      setState({ montoCuotaPieUF: v, piePct: newPiePct.toFixed(4) });
    } else {
      setState({ montoCuotaPieUF: v });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Precio ── */}
      <div>
        <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
          Precio de compra
        </label>
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
              UF
            </span>
            <MoneyInput
              placeholder="3.200"
              className={`${inputBase} pl-10`}
              value={state.precio}
              onChange={(raw) => {
                const patch: Partial<WizardV3State> = { precio: raw };
                // Al editar manualmente, bloquear el re-prefill automático.
                if (!state.editedFields.includes("precio")) {
                  patch.editedFields = [...state.editedFields, "precio"];
                }
                setState(patch);
              }}
            />
          </div>
          <div className="flex items-center px-3 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-[var(--franco-text-secondary)]">
            ≈ {precioCLP > 0 ? fmtCLPShort(precioCLP) : "$—"}
          </div>
        </div>
        {precioSugeridoUF && (
          <p className="font-mono text-[11px] mt-1.5 m-0 text-[var(--franco-text-secondary)]">
            ● Mercado sugiere UF {precioSugeridoUF.toLocaleString("es-CL")}
            {superficie > 0 && precioM2UF
              ? ` (UF ${(Math.round(precioM2UF * 100) / 100).toLocaleString("es-CL")}/m² × ${superficie}m²)`
              : ""}
          </p>
        )}
      </div>

      {/* ── Estado del proyecto (solo nuevo) ── */}
      {state.tipoPropiedad === "nuevo" && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.06em] font-medium text-[var(--franco-text-secondary)]">
              Estado del proyecto
            </label>
            <InfoTooltip content="Inmediata = proyecto entregado o por entregar en menos de 6 meses. Futura = compra antes de entrega (en verde o en blanco), pagas cuotas hasta la entrega." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["inmediata", "futura"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  if (e === "inmediata") {
                    // Limpiar fecha (defensivo, igual que modal viejo).
                    setState({
                      estadoVenta: e,
                      fechaEntregaMes: "",
                      fechaEntregaAnio: "",
                    });
                  } else {
                    // Prefill fecha = hoy + 24 meses si vacía.
                    const future = new Date();
                    future.setMonth(future.getMonth() + 24);
                    const defaultMes = String(future.getMonth() + 1).padStart(2, "0");
                    const defaultAnio = String(future.getFullYear());
                    const newMes = state.fechaEntregaMes || defaultMes;
                    const newAnio = state.fechaEntregaAnio || defaultAnio;
                    // Prefill cuotasPie = mesesHastaEntrega(fechaResuelta) si vacío.
                    const newCuotas = state.cuotasPie || String(mesesHastaEntrega(newMes, newAnio));
                    setState({
                      estadoVenta: e,
                      fechaEntregaMes: newMes,
                      fechaEntregaAnio: newAnio,
                      cuotasPie: newCuotas,
                    });
                  }
                }}
                className={`h-10 rounded-lg font-body text-[13px] font-medium capitalize transition-colors ${
                  state.estadoVenta === e
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          {state.estadoVenta === "futura" && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                    Mes
                  </label>
                  <select
                    className={`${inputBase} appearance-none text-[13px]`}
                    value={state.fechaEntregaMes}
                    onChange={(e) => setState({ fechaEntregaMes: e.target.value })}
                  >
                    <option value="">—</option>
                    {MESES_ES.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                    Año
                  </label>
                  <select
                    className={`${inputBase} appearance-none text-[13px]`}
                    value={state.fechaEntregaAnio}
                    onChange={(e) => setState({ fechaEntregaAnio: e.target.value })}
                  >
                    <option value="">—</option>
                    {Array.from({ length: 7 }, (_, i) => 2026 + i).map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              {mesesSugeridos > 0 && (
                <p className="font-mono text-[11px] m-0 text-[var(--franco-text-secondary)]">
                  ● Pagás el pie en ~{mesesSugeridos} cuotas hasta la entrega
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Pie ── */}
      {state.tipoPropiedad === "usado" ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
              Pie
            </label>
            <span className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
              {piePct}% · {pieCLP > 0 ? fmtCLPShort(pieCLP) : "$—"}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={50}
            step={5}
            value={piePct}
            onChange={(e) => setState({ piePct: e.target.value })}
            className="w-full h-1.5 bg-[var(--franco-border)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[9px] text-[var(--franco-text-muted)] mt-1">
            <span>10%</span>
            <span>20%</span>
            <span>30%</span>
            <span>40%</span>
            <span>50%</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Chip readonly: piePct auto-derivado + pie absoluto en UF */}
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
              Pie
            </label>
            <span className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
              {fmtPiePct(piePct)}% · {precioUF > 0 ? `UF ${(Math.round((precioUF * piePct / 100) * 10) / 10).toLocaleString("es-CL")}` : "—"}
            </span>
          </div>

          {/* Toggle Contado/Cuotas (solo inmediata) */}
          {state.estadoVenta === "inmediata" && (
            <div className="grid grid-cols-2 gap-2">
              {(["contado", "cuotas"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (m === "cuotas") {
                      // Prefill 12 cuotas (1 año) en inmediata si vacío.
                      setState({
                        pieModoPago: m,
                        cuotasPie: state.cuotasPie || "12",
                      });
                    } else {
                      setState({ pieModoPago: m });
                    }
                  }}
                  className={`h-10 rounded-lg font-body text-[13px] font-medium capitalize transition-colors ${
                    state.pieModoPago === m
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                      : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)]"
                  }`}
                >
                  {m === "contado" ? "Contado" : "En cuotas"}
                </button>
              ))}
            </div>
          )}

          {/* Inputs cuotas + cuota mensual UF.
              Visible cuando: futura (siempre) o inmediata+cuotas. */}
          {(state.estadoVenta === "futura" || (state.estadoVenta === "inmediata" && state.pieModoPago === "cuotas")) && (
            <div className={state.estadoVenta === "inmediata" ? "mt-3 grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3"}>
              <div>
                <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                  Cuotas del pie
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={84}
                  placeholder={String(mesesSugeridos || 1)}
                  className={inputBase}
                  value={state.cuotasPie}
                  onChange={(e) => handleCuotasChange(e.target.value)}
                />
                {state.estadoVenta === "futura" && mesesSugeridos > 0 && (
                  <p className="font-mono text-[11px] mt-1 m-0 text-[var(--franco-text-secondary)]">
                    ● Sugerido: {mesesSugeridos} (hasta entrega)
                  </p>
                )}
              </div>
              <div>
                <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                  Cuota mensual (UF)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  className={inputBase}
                  value={cuotaUFDisplay}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*[.,]?\d*$/.test(v)) handleMontoChange(v);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dividendo readonly ── */}
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
            Dividendo estimado
          </p>
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] m-0">
            Plazo {plazo}a · Tasa {tasa}%
          </p>
        </div>
        <p className="font-mono text-[18px] font-semibold text-[var(--franco-text)] m-0">
          {dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"}
        </p>
      </div>
    </div>
  );
}
