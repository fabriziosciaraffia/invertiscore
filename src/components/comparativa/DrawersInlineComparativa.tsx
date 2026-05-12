"use client";

import type { FullAnalysisResult } from "@/lib/types";
import type { ShortTermResult, SensibilidadPrecioRow } from "@/lib/engines/short-term-engine";
import { fmtMoney, fmtPct } from "@/components/analysis/utils";

// ─── Versión INLINE de los drawers para la vista pública /share/... ─────
// Renderiza el mismo contenido pero como secciones de página (no side-panel).
// Sin close-button, sin escape-handler, sin tooltips. Pensado para print PDF
// y vista compartida pública. Componentes paralelos a DrawersComparativa.tsx.

// ─── Header de sección reusable ─────────────────────────────────────────
function SectionHeader({ numero, label, titulo }: { numero: string; label: string; titulo: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1.5">
        {numero} · {label}
      </p>
      <h2 className="font-heading text-[22px] sm:text-[24px] font-bold text-[var(--franco-text)] leading-tight">
        {titulo}
      </h2>
    </div>
  );
}

function SectionWrap({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6 sm:p-8 mb-6">
      {children}
    </section>
  );
}

function DataRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-[13px] text-[var(--franco-text-secondary)]">{label}</span>
      <span className="text-right">
        <span className="font-mono text-[13px] font-medium text-[var(--franco-text)] block">{value}</span>
        {hint && (
          <span className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[1px]">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Inline · Zona STR (06) ─────────────────────────────────────────────
export function InlineZona({
  strResults, currency, ufValue,
}: { strResults: ShortTermResult; currency: "CLP" | "UF"; ufValue: number }) {
  const zona = strResults.zonaSTR;
  const comp = strResults.comparativa;
  return (
    <SectionWrap>
      <SectionHeader numero="06" label="ZONA · TIPO DE HUÉSPED" titulo="Cómo tracciona STR en esta zona" />
      <p className="font-body text-[14px] text-[var(--franco-text)] leading-relaxed mb-5">
        El motor compara tu zona contra el universo Santiago (ADR + ocupación + revenue p50) para
        decir qué tan viable es operar Airbnb acá. La señal alimenta directamente la recomendación
        de modalidad.
      </p>

      {zona ? (
        <div className="space-y-3 mb-5">
          <DataRow label="Tier de zona" value={zona.tierZona.toUpperCase()} />
          <DataRow label="Score zona" value={`${zona.score}/100`} />
          <DataRow label="ADR vs Santiago" value={`p${zona.percentilADR}`} />
          <DataRow label="Ocupación vs Santiago" value={`p${zona.percentilOcupacion}`} />
          <DataRow label="Revenue mensual vs Santiago" value={`p${zona.percentilRevenue}`} />
          {zona.comunaNoListada && (
            <p className="font-body text-[12px] text-[var(--franco-text-muted)] italic mt-2">
              ⚠ {zona.comuna} no está en el universo benchmark V1. Los percentiles se calculan contra
              la distribución pero el caveat aplica.
            </p>
          )}
        </div>
      ) : (
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mb-5">
          Análisis pre-Commit 4 · sin clasificación de zona.
        </p>
      )}

      <div
        className="p-4 mb-2"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
          borderLeft: "3px solid var(--franco-text-secondary)",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <p
          className="font-mono uppercase mb-1"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
        >
          SOBRE-RENTA STR vs LTR
        </p>
        <p className="font-mono text-[24px] font-bold text-[var(--franco-text)]">
          {comp.sobreRentaPct >= 0 ? "+" : ""}{fmtPct(comp.sobreRentaPct * 100, 0)}
        </p>
        <p className="font-body text-[12px] text-[var(--franco-text-secondary)] mt-1">
          NOI mensual de STR vs LTR · ventaja {comp.sobreRenta >= 0 ? "a favor de STR" : "a favor de LTR"} de{" "}
          <span className="font-mono">{fmtMoney(Math.abs(comp.sobreRenta), currency, ufValue)}</span>/mes.
        </p>
      </div>
    </SectionWrap>
  );
}

// ─── Inline · Sensibilidad precio (03) ──────────────────────────────────
export function InlineSensibilidad({
  ltrResults, strResults, currency, ufValue,
}: { ltrResults: FullAnalysisResult; strResults: ShortTermResult; currency: "CLP" | "UF"; ufValue: number }) {
  const ltrNeg = ltrResults.negociacion;
  const strSens: SensibilidadPrecioRow[] = strResults.sensibilidadPrecio ?? [];

  return (
    <SectionWrap>
      <SectionHeader numero="03" label="SENSIBILIDAD AL PRECIO" titulo="Qué pasa si negocias el precio" />
      <p className="font-body text-[14px] text-[var(--franco-text)] leading-relaxed mb-5">
        Antes de firmar, mide cómo se mueve tu retorno con descuentos del precio. El precio de compra
        es la palanca más rápida — antes que tasa, ramp-up o estabilización.
      </p>

      {ltrNeg && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-2">
            RENTA LARGA · NEGOCIACIÓN
          </p>
          <div className="rounded-xl border border-[var(--franco-border)] p-4 space-y-2">
            <DataRow label="Precio actual" value={fmtMoney(ltrResults.metrics.precioCLP, currency, ufValue)} />
            {ltrNeg.precioSugeridoCLP > 0 && (
              <DataRow
                label="Precio sugerido"
                value={fmtMoney(ltrNeg.precioSugeridoCLP, currency, ufValue)}
                hint={`TIR ${ltrNeg.tirAlSugerido.toFixed(1).replace(".", ",")}%`}
              />
            )}
            {ltrNeg.precioLimiteCLP !== null && ltrNeg.precioLimiteCLP > 0 && (
              <DataRow
                label="Precio límite (walk-away)"
                value={fmtMoney(ltrNeg.precioLimiteCLP, currency, ufValue)}
                hint={ltrNeg.tirAlLimite !== null ? `TIR ${ltrNeg.tirAlLimite.toFixed(1).replace(".", ",")}%` : ""}
              />
            )}
          </div>
        </div>
      )}

      {strSens.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)] mb-2">
            RENTA CORTA · SENSIBILIDAD
          </p>
          <div className="rounded-xl border border-[var(--franco-border)] overflow-hidden">
            <table className="w-full">
              <thead style={{ background: "var(--franco-card)" }}>
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)]">Δ Precio</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)]">CAP</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)]">CoC</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-secondary)]">Flujo</th>
                </tr>
              </thead>
              <tbody>
                {strSens.map((s) => (
                  <tr key={s.label} className="border-t border-[var(--franco-border)]">
                    <td className="px-3 py-2 font-body text-[12px] text-[var(--franco-text)]">
                      {s.label === "actual" ? "Actual" : s.label}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-[var(--franco-text)]">
                      {fmtPct(s.capRate * 100, 1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-[var(--franco-text)]">
                      {fmtPct(s.cashOnCash * 100, 1)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono text-[12px]"
                      style={{ color: s.flujoCajaMensual < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
                    >
                      {fmtMoney(s.flujoCajaMensual, currency, ufValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionWrap>
  );
}

// ─── Inline · Subsidio Ley 21.748 (04) ──────────────────────────────────
export function InlineSubsidio({
  ltrResults, strResults,
}: { ltrResults: FullAnalysisResult; strResults: ShortTermResult }) {
  const ltrSub = ltrResults.metrics?.subsidioTasa;
  const strSub = strResults.subsidioTasa;
  const califica = ltrSub?.califica || strSub?.califica;
  const aplicado = ltrSub?.aplicado || strSub?.aplicado;
  const tasaSub = ltrSub?.tasaConSubsidio ?? strSub?.tasaConSubsidio;

  return (
    <SectionWrap>
      <SectionHeader numero="04" label="SUBSIDIO LEY 21.748" titulo="Una palanca que casi nadie pide" />
      <p className="font-body text-[14px] text-[var(--franco-text)] leading-relaxed mb-5">
        La Ley 21.748 baja la tasa hipotecaria ~0,6 puntos porcentuales para viviendas nuevas de ≤
        4.000 UF en primera vivienda. Lo pides al banco como{" "}
        <span className="italic">subsidio al crédito hipotecario</span>. Aplica a ambas modalidades —
        quien firma el crédito eres tú, no el modelo de renta.
      </p>

      {califica === undefined ? (
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] italic">
          Análisis pre-Commit 3a · subsidio no calculado.
        </p>
      ) : califica ? (
        aplicado ? (
          <div
            className="p-4"
            style={{
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              borderLeft: "3px solid var(--franco-text-secondary)",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <p
              className="font-mono uppercase mb-1"
              style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--franco-text-secondary)", fontWeight: 600 }}
            >
              ✓ SUBSIDIO YA APLICADO
            </p>
            <p className="font-body text-[13px] text-[var(--franco-text)]">
              La tasa que ingresaste coincide con la tasa subsidiada
              ({tasaSub?.toFixed(1).replace(".", ",")}%). No queda margen adicional acá.
            </p>
          </div>
        ) : (
          <div
            className="p-4"
            style={{
              background: "color-mix(in srgb, var(--signal-red) 5%, transparent)",
              borderLeft: "3px solid var(--signal-red)",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <p
              className="font-mono uppercase mb-1"
              style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--signal-red)", fontWeight: 600 }}
            >
              CALIFICAS · NO ESTÁS USÁNDOLO
            </p>
            <p className="font-body text-[13px] text-[var(--franco-text)] leading-relaxed">
              Tu depto cumple los requisitos (vivienda nueva ≤ 4.000 UF). La tasa con subsidio sería{" "}
              <span className="font-mono">{tasaSub?.toFixed(1).replace(".", ",")}%</span>. Llama al
              banco y pide explícitamente que apliquen la Ley 21.748 — baja el dividendo ~0,6 pp del
              crédito y mejora el flujo en ambas modalidades.
            </p>
          </div>
        )
      ) : (
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
          No califica · vivienda usada o precio sobre 4.000 UF.
        </p>
      )}
    </SectionWrap>
  );
}

// ─── Inline · Riesgos consolidados (05) ─────────────────────────────────
export function InlineRiesgos({
  ltrResults, strResults,
}: { ltrResults: FullAnalysisResult; strResults: ShortTermResult }) {
  const ltrFlujo = ltrResults.metrics?.flujoNetoMensual ?? 0;
  const strRampUp = strResults.perdidaRampUp ?? 0;
  const zonaBaja = strResults.zonaSTR?.tierZona === "baja";
  const breakEven = strResults.breakEvenPctDelMercado ?? 0;

  const ltrRisks: Array<{ titulo: string; descripcion: string }> = [
    {
      titulo: "Vacancia entre arriendos",
      descripcion: "Asume 1-2 meses cada 2-3 años. Si tu flujo neto ya es bajo (" +
        (ltrFlujo < 0 ? "negativo en " + Math.abs(Math.round(ltrFlujo / 1000)) + "K mensual" : Math.round(ltrFlujo / 1000) + "K mensual") +
        "), una vacancia larga te exige aporte adicional.",
    },
    {
      titulo: "Morosidad del inquilino",
      descripcion: "Sin garantías reales, el desalojo en Chile toma 6-12 meses. Pide aval, mes de garantía + adelantado, y verifica historial DICOM antes de firmar.",
    },
    {
      titulo: "Plusvalía ajustada por mercado",
      descripcion: "El supuesto de 3-4% anual no aplica en todas las comunas. Si la zona está estancada, el patrimonio Y10 sufre.",
    },
  ];

  const strRisks: Array<{ titulo: string; descripcion: string }> = [
    {
      titulo: "Estabilización inicial",
      descripcion: `Los primeros ~6 meses operas bajo target (50-90%). Pérdida estimada estos meses: ${strRampUp > 0 ? "$" + Math.round(strRampUp).toLocaleString("es-CL") : "calculada en el análisis STR"}. Necesitas fondo de reserva.`,
    },
    {
      titulo: "Estacionalidad",
      descripcion: "Santiago: julio peak ski, febrero low (todos en la costa). Rango anual entre meses puede superar 35-50% del flujo. Sin tarifas dinámicas, pierdes el peak y mueres en el valle.",
    },
    ...(zonaBaja ? [{
      titulo: "Zona con demanda baja",
      descripcion: "Tu zona está en tier baja del universo Santiago. Operar STR acá depende de superar la mediana del mercado para no quedar en aporte mensual.",
    }] : []),
    ...(breakEven > 0.85 ? [{
      titulo: "Punto de equilibrio alto",
      descripcion: `Necesitas ${Math.round(breakEven * 100)}% del revenue P50 solo para cubrir costos. Margen para vacancia o competencia agresiva es chico.`,
    }] : []),
    {
      titulo: "Regulación del edificio",
      descripcion: "Antes de invertir en amoblamiento, lee el reglamento de copropiedad. Si lo prohíbe (o el comité está en disputa), todo el modelo se cae.",
    },
    {
      titulo: "Reviews tempranos",
      descripcion: "Un review 1-3★ en los primeros meses te baja en el algoritmo de búsqueda. Invierte en check-in impecable, sábanas de calidad y un kit de bienvenida pensado.",
    },
  ];

  return (
    <SectionWrap>
      <SectionHeader numero="05" label="RIESGOS CONSOLIDADOS" titulo="Lo que puede salir mal en cada modalidad" />

      <RiskBlock label="RENTA LARGA" items={ltrRisks} />
      <div className="mt-6">
        <RiskBlock label="RENTA CORTA" items={strRisks} />
      </div>
    </SectionWrap>
  );
}

function RiskBlock({ label, items }: { label: string; items: Array<{ titulo: string; descripcion: string }> }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-3">
        {label}
      </p>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.titulo} className="rounded-lg border border-[var(--franco-border)] p-3">
            <p className="font-body text-[13px] font-semibold text-[var(--franco-text)] mb-1">
              {r.titulo}
            </p>
            <p className="font-body text-[12px] text-[var(--franco-text-secondary)] leading-relaxed">
              {r.descripcion}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
