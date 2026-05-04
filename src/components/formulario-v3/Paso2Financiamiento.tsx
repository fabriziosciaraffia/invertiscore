"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Sliders } from "lucide-react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { InfoTooltip } from "@/components/ui/tooltip";
import { StateBox } from "@/components/ui/StateBox";
import { useDebouncedReady } from "@/hooks/useDebouncedReady";
import {
  calcTasaConSubsidio,
  calificaSubsidio as calificaSubsidioHelper,
} from "@/lib/constants/subsidio";
import {
  calcDividendo,
  fmtCLP,
  fmtCLPShort,
  fmtUF,
  mesesHastaEntrega,
  parseDecimalLocale,
  type WizardV3State,
} from "./wizardV3State";

function fmtPiePct(pct: number): string {
  if (Number.isInteger(pct)) return String(pct);
  return (Math.round(pct * 10) / 10).toString().replace(".", ",");
}

/** Render coma chilena para tasas (sin redondeo extra: preserva 4,72 vs 4,7). */
function fmtTasa(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function Paso2Financiamiento({
  state,
  setState,
  ufCLP,
  tasaMercado,
  precioM2UF,
  precioM2SampleSize,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  ufCLP: number;
  /** Tasa hipotecaria de mercado (referencia para subsidio + comparativa). */
  tasaMercado: number;
  /** UF/m² sugerido del radio (venta). Cuando llega, mostramos hint debajo del precio. */
  precioM2UF?: number | null;
  /** N comparables del fetch de venta. Si null o 0 → ocultar el sufijo. */
  precioM2SampleSize?: number | null;
}) {
  const precioUF = Number(state.precio) || 0;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = parseDecimalLocale(state.tasaInteres) || 4.72;
  // parseDecimalLocale (no parseNum): superficie nunca lleva separador de miles
  // y sí puede tener decimal con coma o punto (ej. "75,5" o "75.5"). parseNum
  // strippea todos los puntos asumiendo formato de miles → corrompe "75.5".
  const superficie = parseDecimalLocale(state.superficieUtil);

  // Toggle local: expansión inline de Plazo/Tasa editables. No persiste en
  // wizardV3State — al volver a Paso 2 vuelve a estado readonly aunque los
  // valores editados sí persistan en el state global.
  const [ajustePlazoTasaOpen, setAjustePlazoTasaOpen] = useState(false);

  // Debounce + on-blur para alertas suaves: mientras el user tipea precio o
  // tasa, las validaciones quedan suprimidas. Se muestran tras 600ms de pausa
  // o al hacer blur del input. Cálculos derivados (chips, dividendo, hint
  // mercado) siguen en vivo — esto solo afecta a los StateBox condicionales.
  const [precioReady, commitPrecio] = useDebouncedReady(state.precio);
  const [tasaReady, commitTasa] = useDebouncedReady(state.tasaInteres);

  // Subsidio a la Tasa (Ley 21.748). Se calcula vs tasa de mercado vigente
  // (no la editada por el user) — la editada se usa para detectar si "ya
  // está aplicando" el subsidio. Helpers centralizados en lib/constants.
  const tasaConSubsidio = calcTasaConSubsidio(tasaMercado);
  const calificaSubsidio = calificaSubsidioHelper(state.tipoPropiedad, precioUF);

  // Helper: setState + tracking en editedFields. Aplica al patrón de campos
  // editables del Paso 2 (sliders piePct, plazoCredito; input tasaInteres;
  // CTA subsidio). El precio usa este patrón inline desde Fase 4.
  function trackEdit(key: keyof WizardV3State, value: string) {
    const patch = { [key]: value } as Partial<WizardV3State>;
    if (!state.editedFields.includes(key as string)) {
      patch.editedFields = [...state.editedFields, key as string];
    }
    setState(patch);
  }

  const precioCLP = precioUF * ufCLP;
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

  // ─── Pie en Nuevo ──────────────────────────────────────
  // Fase 9: piePct se edita vía slider (igual que Usado). La cuota mensual UF
  // pasa a display readonly derivado de `pieUF / cuotasPie`. El user solo
  // puede editar piePct (slider) y cuotasPie (input). Source of truth: piePct.
  const cuotasNum = Number(state.cuotasPie) || mesesSugeridos || 1;
  const cuotaUFDerived = precioUF > 0 && cuotasNum > 0
    ? (precioUF * piePct / 100 / cuotasNum)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Precio ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
            Precio de compra
          </label>
          <InfoTooltip
            content="Ingresa el precio de venta del departamento en UF. La conversión a CLP se calcula automáticamente."
          />
        </div>
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
              onBlur={commitPrecio}
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
              ? ` (UF ${(Math.round(precioM2UF * 100) / 100).toLocaleString("es-CL")}/m² × ${superficie.toLocaleString("es-CL")}m²)`
              : ""}
            {precioM2SampleSize && precioM2SampleSize > 0
              ? ` · basado en ${precioM2SampleSize} ${precioM2SampleSize === 1 ? "unidad comparable" : "unidades comparables"} en la zona`
              : ""}
          </p>
        )}
        {/* Validación suave: precio/m² del usuario vs promedio de zona.
            3 tiers según |dev| (Capa 1 binaria, cero amber/verde):
              - aligned (|dev| <  5%) → dot pattern neutro confirmando alineación
              - soft    (5-15%)        → dot pattern direccional (sobreprecio / ventaja)
              - strong  (>15%)         → StateBox attention (alto) o info (bajo)
            Render mutuamente excluyente. Solo si hay datos suficientes (precio
            + superficie + precioM2 comuna). NO bloquea el flujo. */}
        {(() => {
          if (!precioReady) return null;
          if (!(superficie > 0 && precioUF > 0 && precioM2UF && precioM2UF > 0)) return null;
          const userM2 = precioUF / superficie;
          const dev = (userM2 - precioM2UF) / precioM2UF;
          const absDev = Math.abs(dev);
          const tier = absDev < 0.05 ? "aligned" : absDev <= 0.15 ? "soft" : "strong";
          const direction: "high" | "low" = dev > 0 ? "high" : "low";
          const pctStr = fmtPiePct(absDev * 100);
          const comuna = state.comuna || "la zona";

          if (tier === "aligned") {
            return (
              <p className="font-mono text-[11px] mt-3 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
                ● Precio dentro del rango de mercado de {comuna}.
              </p>
            );
          }

          if (tier === "soft") {
            if (direction === "high") {
              return (
                <div className="mt-3">
                  <StateBox variant="left-border" state="attention" label="Atención">
                    <span className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
                      <span>
                        El precio está {pctStr}% por encima del promedio de {comuna}. Se reflejará como sobreprecio en el análisis.
                      </span>
                    </span>
                  </StateBox>
                </div>
              );
            }
            return (
              <div className="mt-3">
                <StateBox variant="left-border" state="info" label="Información">
                  Estás comprando {pctStr}% bajo el promedio de {comuna}. Se reflejará como ventaja inicial.
                </StateBox>
              </div>
            );
          }

          // strong
          if (direction === "high") {
            return (
              <div className="mt-3">
                <StateBox variant="left-border" state="attention" label="Atención">
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
                    <span>
                      El precio por m² ingresado está un {pctStr}% por encima del promedio de {comuna} — desviación importante. Esto se reflejará como sobreprecio relevante en el análisis. Verifica el dato antes de continuar.
                    </span>
                  </span>
                </StateBox>
              </div>
            );
          }
          return (
            <div className="mt-3">
              <StateBox variant="left-border" state="info" label="Información">
                Estás comprando {pctStr}% bajo el promedio de {comuna} — diferencia importante. Se reflejará como ventaja inicial relevante. Verifica el dato.
              </StateBox>
            </div>
          );
        })()}
      </div>

      {/* ── Estado del proyecto (solo nuevo) ── */}
      {state.tipoPropiedad === "nuevo" && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.06em] font-medium text-[var(--franco-text-secondary)]">
              Estado del proyecto
            </label>
            <InfoTooltip
                content="Inmediata: proyecto terminado, entrega inmediata. Futura: compra antes de entrega (en verde o en blanco), pagas cuotas hasta la entrega."
            />
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
                  ● Pagas el pie en ~{mesesSugeridos} cuotas hasta la entrega (se calcula automáticamente con fecha de entrega).
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
            <div className="flex items-center gap-1.5">
              <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                Pie
              </label>
              <InfoTooltip
                content="Porcentaje del precio de venta que pagas con recursos propios, sin crédito hipotecario. Pago al contado para unidades usadas, en cuotas para unidades nuevas."
              />
            </div>
            <span className="font-mono text-[12px] text-[var(--franco-text-secondary)]">
              {fmtPiePct(piePct)}% · {precioUF > 0 ? `UF ${(Math.round((precioUF * piePct / 100) * 10) / 10).toLocaleString("es-CL")}` : "—"}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={50}
            step={1}
            value={piePct}
            onChange={(e) => trackEdit("piePct", e.target.value)}
            className="w-full h-1.5 bg-[var(--franco-border)] rounded-full accent-[var(--franco-text)] cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[9px] text-[var(--franco-text-secondary)] mt-1">
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
            <div className="flex items-center gap-1.5">
              <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                Pie
              </label>
              <InfoTooltip
                content="Porcentaje del precio de venta que pagas con recursos propios, sin crédito hipotecario. Pago al contado para unidades usadas, en cuotas para unidades nuevas."
              />
            </div>
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

          {/* Slider Pie editable — siempre en Nuevo (Fase 9).
              Reuso 1:1 del slider Pie Usado: range 10-50 step 5. mt-3 cuando
              hay toggle Contado/Cuotas encima (inmediata); sin mt cuando va
              directo bajo el header (futura). */}
          <div className={state.estadoVenta === "inmediata" ? "mt-3" : ""}>
            <input
              type="range"
              min={10}
              max={50}
              step={1}
              value={piePct}
              onChange={(e) => trackEdit("piePct", e.target.value)}
              className="w-full h-1.5 bg-[var(--franco-border)] rounded-full accent-[var(--franco-text)] cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[9px] text-[var(--franco-text-secondary)] mt-1">
              <span>10%</span>
              <span>20%</span>
              <span>30%</span>
              <span>40%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Inputs cuotas + cuota mensual UF (readonly derivada).
              Visible cuando: futura (siempre) o inmediata+cuotas. */}
          {(state.estadoVenta === "futura" || (state.estadoVenta === "inmediata" && state.pieModoPago === "cuotas")) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <span className="flex items-center gap-1.5 mb-1">
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)]">
                    Cuotas del pie
                  </label>
                  <InfoTooltip
                            content="Número de cuotas en que pagarás el pie."
                  />
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={84}
                  placeholder={String(mesesSugeridos || 1)}
                  className={inputBase}
                  value={state.cuotasPie}
                  onChange={(e) => setState({ cuotasPie: e.target.value })}
                />
                {state.estadoVenta === "futura" && mesesSugeridos > 0 && (
                  <p className="font-mono text-[11px] mt-1 m-0 text-[var(--franco-text-secondary)]">
                    ● Sugerido: {mesesSugeridos} (hasta entrega)
                  </p>
                )}
              </div>
              <div>
                <span className="flex items-center gap-1.5 mb-1">
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)]">
                    Cuota mensual (UF)
                  </label>
                  <InfoTooltip
                            content="Se calcula automáticamente según el monto del pie y el número de cuotas."
                  />
                </span>
                <div className="flex items-center px-3 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-[12px] text-[var(--franco-text-secondary)] h-10">
                  {cuotaUFDerived > 0 ? fmtUF(cuotaUFDerived, 2) : "—"}
                </div>
                {cuotaUFDerived > 0 && ufCLP > 0 && (
                  <p className="font-mono text-[11px] mt-1 m-0 text-[var(--franco-text-secondary)]">
                    ● ≈ {fmtCLPShort(cuotaUFDerived * ufCLP)} CLP/mes
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dividendo readonly + ajuste plazo/tasa inline ── */}
      <div>
        <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] m-0 mb-1">
              Dividendo estimado
            </p>
            <p className="font-body text-[11px] text-[var(--franco-text-secondary)] m-0">
              Plazo {plazo} años · Tasa {fmtTasa(tasa)}%
            </p>
          </div>
          <p className="font-mono text-[18px] font-semibold text-[var(--franco-text)] m-0">
            {dividendo > 0 ? `${fmtCLP(dividendo)}/mes` : "—"}
          </p>
        </div>

        {/* Trigger ajuste plazo/tasa — patrón Link CTA del skill franco-design-system
            (mono uppercase tracking + arrow, mismo nivel visual que "LEER ANÁLISIS
            COMPLETO →" en cards de resultados). Sin Signal Red: ajustar es
            opcional, no requiere atención. Chevron rotates on expand. */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setAjustePlazoTasaOpen((v) => !v)}
            aria-expanded={ajustePlazoTasaOpen}
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--franco-text)] hover:text-[var(--franco-text-secondary)] underline underline-offset-4 decoration-1 transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" />
            Ajustar plazo y tasa
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform"
              style={{ transform: ajustePlazoTasaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        </div>

        {ajustePlazoTasaOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {/* Card subsidio — solo si Nuevo + precio ≤ 4.000 UF (Ley 21.748).
                StateBox info Ink-only (Capa 1 binaria, cero Signal Red en bg/border).
                CTA "Usar X%" usa el patrón mono uppercase del trigger Fase 11. */}
            {calificaSubsidio && (
              <StateBox variant="left-border" state="info" label="Subsidio a la Tasa">
                <div className="flex flex-col gap-2">
                  <p className="m-0">
                    Tu depto califica al <strong className="font-semibold">Subsidio a la Tasa (Ley 21.748)</strong>.
                  </p>
                  <p className="font-mono text-[12px] m-0 text-[var(--franco-text-secondary)]">
                    Tasa promedio: {fmtTasa(tasaMercado)}% → Con subsidio: ~{fmtTasa(tasaConSubsidio)}%
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => trackEdit("tasaInteres", fmtTasa(tasaConSubsidio))}
                      className="inline-flex items-center font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--franco-text)] hover:text-[var(--franco-text-secondary)] underline underline-offset-4 decoration-1 transition-colors"
                    >
                      Usar {fmtTasa(tasaConSubsidio)}%
                    </button>
                    <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">
                      Vigente hasta mayo 2027 · Requiere primera vivienda
                    </span>
                  </div>
                  <a
                    href="https://www.minvu.gob.cl/nuevo-subsidio-al-credito-hipotecario/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-2 inline-flex items-center gap-1 mt-0.5"
                  >
                    Más información →
                  </a>
                </div>
              </StateBox>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Plazo slider — patrón idéntico al slider Pie Usado (auditoría C.1)
                  + ModalAjusteCondiciones · TabFinanciamiento (range 10-30 step 1). */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)]">
                      Plazo
                    </label>
                    <InfoTooltip
                      content="Plazo del crédito hipotecario en años. A mayor plazo, menor dividendo mensual pero mayor costo total en intereses."
                    />
                  </span>
                  <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">
                    {plazo} años
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={30}
                  step={1}
                  value={plazo}
                  onChange={(e) => trackEdit("plazoCredito", e.target.value)}
                  className="w-full h-1.5 bg-[var(--franco-border)] rounded-full accent-[var(--franco-text)] cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[9px] text-[var(--franco-text-secondary)] mt-1">
                  <span>10</span>
                  <span>15</span>
                  <span>20</span>
                  <span>25</span>
                  <span>30</span>
                </div>
              </div>

              {/* Tasa input — patrón idéntico a ModalAjusteCondiciones · Tasa
                  (text decimal regex /^\d*[.,]?\d*$/). Sufijo % inline mismo
                  pattern que Superficie m² (Paso 1). */}
              <div>
                <span className="flex items-center gap-1.5 mb-1.5">
                  <label className="font-body text-[11px] font-medium text-[var(--franco-text-secondary)]">
                    Tasa
                  </label>
                  <InfoTooltip
                    content="Tasa anual del crédito hipotecario. Default refleja la tasa promedio de mercado actual. Ajusta si tienes una pre-aprobación con tasa distinta."
                  />
                </span>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="4,72"
                    className={`${inputBase} pr-8`}
                    value={state.tasaInteres}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*[.,]?\d*$/.test(v)) trackEdit("tasaInteres", v);
                    }}
                    onBlur={commitTasa}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Microcopy referencial tasa — dot pattern Fase 4.8.
                Oculto cuando califica subsidio: la card de arriba ya entrega
                la referencia (tasa promedio + tasa con subsidio). */}
            {!calificaSubsidio && (
              <p className="font-mono text-[11px] m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
                ● Tasa promedio referencial del mercado hipotecario chileno, actualizada periódicamente.
              </p>
            )}

            {/* Validación suave tasa fuera de rango razonable UF Chile (3-7%).
                Mismo patrón que validación precio: Ink-only (Capa 1 binaria),
                StateBox attention + AlertTriangle. NO bloquea. Suprimida
                durante edición activa (debounce 600ms o blur del input). */}
            {tasaReady && (tasa < 3 || tasa > 7) && (
              <StateBox variant="left-border" state="attention" label="Atención">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--franco-text-secondary)]" />
                  <span>
                    {tasa < 3
                      ? "Tasa muy baja respecto al promedio del mercado. Verifica que el valor sea correcto."
                      : "Tasa muy alta respecto al promedio del mercado. Verifica que el valor sea correcto."}
                  </span>
                </span>
              </StateBox>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
