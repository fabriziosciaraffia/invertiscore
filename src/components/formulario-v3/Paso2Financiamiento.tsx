"use client";

import { useEffect } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  calcDividendo,
  fmtCLP,
  fmtCLPShort,
  mesesHastaEntrega,
  parseNum,
  type WizardV3State,
} from "./wizardV3State";

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

      {/* ── Pie ── */}
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

      {/* ── Modo de pago del pie ── */}
      {state.tipoPropiedad === "nuevo" && state.estadoVenta === "inmediata" && (
        <div>
          <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
            ¿Cómo pagas el pie?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["contado", "cuotas"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setState({ pieModoPago: m })}
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
          {state.pieModoPago === "cuotas" && (
            <div className="mt-3">
              <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)] block mb-1">
                ¿Cuántas cuotas?
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={84}
                placeholder="12"
                className={inputBase}
                value={state.cuotasPie}
                onChange={(e) => setState({ cuotasPie: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Cuotas futura (editable) ── */}
      {state.tipoPropiedad === "nuevo" && state.estadoVenta === "futura" && mesesSugeridos > 0 && (
        <div>
          <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
            Cuotas del pie
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={84}
            placeholder={String(mesesSugeridos)}
            className={inputBase}
            value={state.cuotasPie}
            onChange={(e) => setState({ cuotasPie: e.target.value })}
          />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1 m-0">
            Sugerido: {mesesSugeridos} cuotas (hasta entrega)
          </p>
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
