"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — RESUMEN (FASE 4). Tres zonas:
//   1) Informe a generar (lápiz → edita modalidad; el hook invalida la rama)
//   2) Respuestas y estimaciones (lápices → retorno directo; rótulos
//      "· estimado" / "· corregido por ti")
//   3) Supuestos de Franco (plegado, editables INLINE, cada uno con su FUENTE
//      también acá; rótulo "· corregido por ti" al editar)
// Botón final tri-estado (guest / sin créditos / con créditos) — el gate real es
// server-side; acá solo el copy. CTA sticky (excepción de layout: el resumen
// scrollea pero el botón nunca se esconde). Eventos PostHog del funnel.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { SINGLE_PRICE } from "@/lib/pricing";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { estimarContribuciones } from "@/lib/contribuciones";
import type { useWizardV4 } from "./useWizardV4";
import type { WizardV4Data } from "./useWizardV4Data";
import { canAnalyzeFromTier, type TierInfo } from "./useWizardV4Tier";
import { comprarLocked, submitConCredito, type SubmitContext } from "./wizardV4Submit";
import { fmtCLP, fmtUF, parseNum, parseDecimalLocale, piePct, pieUF, precioUF } from "./derive";
import { TextInput } from "./ui";

const LABEL_MOD: Record<string, string> = { ltr: "Renta larga", str: "Renta corta", both: "Comparativo" };
const LABEL_GATE: Record<string, string> = { si: "Sí permite", no: "No permite", no_seguro: "No estoy seguro" };

type Wizard = ReturnType<typeof useWizardV4>;

// ── Fila lectura (zona 2) ─────────────────────────────────────────────────────
function Row({ label, value, tag, onEdit }: { label: string; value: string; tag?: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <dt className="font-body text-[13px] text-[var(--franco-text-secondary)]">{label}</dt>
      <dd className="flex items-center gap-3 m-0 min-w-0">
        <span className="font-mono text-[13px] text-[var(--franco-text)] truncate max-w-[190px] text-right">
          {value}
          {tag && <span className="text-[var(--franco-text-muted)] text-[11px]"> · {tag}</span>}
        </span>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label}`}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-dotted"
        >
          Editar
        </button>
      </dd>
    </div>
  );
}

// ── Supuesto editable inline (zona 3) — valor + fuente + "corregido por ti" ──
function SupuestoEditable({
  label,
  field,
  value,
  fuente,
  suffix,
  edited,
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  fuente: string;
  suffix: string;
  edited: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="py-2.5 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`sup-${field}`} className="font-body text-[13px] text-[var(--franco-text-secondary)]">
          {label}
          {edited && <span className="text-[var(--franco-text-muted)] text-[11px]"> · corregido por ti</span>}
        </label>
        <div className="w-[130px] shrink-0">
          <TextInput value={value} onChange={onChange} inputMode="numeric" mono suffix={suffix} />
        </div>
      </div>
      <p className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1 m-0">{fuente}</p>
    </div>
  );
}

const numOk = (v: string) => v === "" || /^[\d.]*$/.test(v);

export function ResumenScreen({
  w,
  data,
  tier,
  isLoggedIn,
}: {
  w: Wizard;
  data: WizardV4Data;
  tier: TierInfo | null;
  isLoggedIn: boolean;
}) {
  const posthog = usePostHog();
  const a = w.nav.answers;
  const mod = a.modalidad;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = canAnalyzeFromTier(tier);
  const ctx: SubmitContext = {
    ufCLP: data.ufCLP,
    arriendoSugerido: data.arriendoSugerido,
    arriendoN: data.arriendoN,
    precioM2UF: data.precioM2UF,
    radiusUsed: data.radiusUsed,
    ggccSugerido: data.ggccSugerido,
  };

  // ── Eventos de funnel: gate mostrado según estado ──
  useEffect(() => {
    if (tier == null || !mod) return;
    if (!isLoggedIn) posthog?.capture("wizard4_gate_auth_shown", { modalidad: mod });
    else if (!canAnalyze) posthog?.capture("wizard4_gate_credits_shown", { modalidad: mod });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, isLoggedIn, canAnalyze, mod]);

  // ── Derivaciones de display ──
  const pUF = precioUF(a);
  const precioStr = pUF > 0 ? `${fmtUF(pUF)} ≈ ${fmtCLP(pUF * data.ufCLP)}` : "—";
  const pct = piePct(a, data.ufCLP);
  const pieStr = pct > 0 ? `${Math.round(pct)}% · ${fmtUF(pieUF(a, data.ufCLP))}` : "—";
  const sup = parseDecimalLocale(a.superficieUtil ?? "");
  const tamStr = sup > 0 ? `${a.superficieUtil} m² · ${a.esStudio ? "Studio" : (a.dormitorios ?? "—") + "D"} · ${a.banos ?? "—"}B` : "—";

  // Defaults de supuestos (mismos que el plegado en arr/adr).
  const ggccDef = data.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
  const contribDef = estimarContribuciones(pUF * data.ufCLP, a.tipoPropiedad === "nuevo");
  const dorm = Number(a.dormitorios) || 2;
  const costos = getCostosDefault(dorm, "basico");

  const esLtr = mod === "ltr" || mod === "both";
  const esStr = mod === "str" || mod === "both";

  async function onGenerar() {
    setError("");
    setSubmitting(true);
    posthog?.capture("wizard4_submitted", { modalidad: mod });
    const res = await submitConCredito(a, ctx);
    if (res.ok && res.redirect) {
      window.location.href = res.redirect;
    } else {
      setError(res.error || "No pudimos generar el análisis.");
      setSubmitting(false);
    }
  }

  async function onDesbloquear() {
    setError("");
    setSubmitting(true);
    posthog?.capture("wizard4_checkout_initiated", { modalidad: mod });
    const res = await comprarLocked(a, ctx);
    if (res.ok && res.redirect) {
      window.location.href = res.redirect;
    } else {
      setError(res.error || "No se pudo crear el análisis.");
      setSubmitting(false);
    }
  }

  const patchNum = (field: string) => (v: string) => { if (numOk(v)) w.patchAnswers({ [field]: v }); };

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* ── Zona 1 · Informe a generar ── */}
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
              Informe a generar
            </p>
            <p className="font-heading text-[20px] font-bold text-[var(--franco-text)] m-0 leading-tight">
              {mod ? LABEL_MOD[mod] : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => w.editField("mod")}
            aria-label="Editar informe"
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-dotted"
          >
            Editar
          </button>
        </div>
      </div>

      {/* ── Zona 2 · Respuestas y estimaciones ── */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] mb-2">
          Tus respuestas
        </p>
        <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
          <dl className="m-0">
            <Row label="Dirección" value={a.direccion || "—"} onEdit={() => w.editField("dir")} />
            <Row label="Tipo" value={a.tipoPropiedad === "nuevo" ? "Nuevo" : a.tipoPropiedad === "usado" ? "Usado" : "—"} onEdit={() => w.editField("tipo")} />
            <Row label="Tamaño" value={tamStr} onEdit={() => w.editField("tam")} />
            <Row label="Precio" value={precioStr} onEdit={() => w.editField("precio")} />
            <Row label="Pie" value={pieStr} onEdit={() => w.editField("pie")} />
            <Row
              label="Tasa"
              value={a.tasaInteres ? `${a.tasaInteres}%` : "—"}
              tag={a.tasaModo === "preaprobada" ? "corregido por ti" : a.tasaModo === "estimada" ? "estimado" : undefined}
              onEdit={() => w.editField("tasa")}
            />
            <Row label="Plazo" value={a.plazoCredito ? `${a.plazoCredito} años` : "—"} onEdit={() => w.editField("plazo")} />
            {esStr && (
              <Row label="Edificio permite Airbnb" value={a.edificioPermiteAirbnb ? LABEL_GATE[a.edificioPermiteAirbnb] : "—"} onEdit={() => w.editField("gate")} />
            )}
            {esLtr && (
              <Row
                label="Arriendo"
                value={a.arriendo ? `${fmtCLP(parseNum(a.arriendo))}/mes` : "—"}
                tag={a.arrModo === "corregir" ? "corregido por ti" : a.arrModo === "estimacion" ? "estimado" : undefined}
                onEdit={() => w.editField("arr")}
              />
            )}
            {esStr && (
              <Row
                label="Tarifa · ocupación"
                value={a.adrTarifa ? `${fmtCLP(parseNum(a.adrTarifa))}/noche · ${a.adrOcupacion ?? "—"}%` : "—"}
                tag={a.adrModo === "corregir" ? "corregido por ti" : a.adrModo === "estimacion" ? "estimado" : undefined}
                onEdit={() => w.editField("adr")}
              />
            )}
          </dl>
        </div>
      </div>

      {/* ── Zona 3 · Supuestos de Franco (plegado, editable inline) ── */}
      <details className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-3 group">
        <summary className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] cursor-pointer list-none flex items-center justify-between">
          Supuestos de Franco
          <span className="text-[var(--franco-text-muted)] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="mt-2">
          <SupuestoEditable
            label="Gastos comunes" field="gastosComunes" suffix="$"
            value={a.gastosComunes ?? String(Math.round(ggccDef))}
            edited={!!a.gastosComunes} fuente="gastos comunes típicos de la comuna"
            onChange={patchNum("gastosComunes")}
          />
          <SupuestoEditable
            label="Contribuciones (trim.)" field="contribuciones" suffix="$"
            value={a.contribuciones ?? String(Math.round(contribDef))}
            edited={!!a.contribuciones} fuente="fórmula SII según avalúo estimado"
            onChange={patchNum("contribuciones")}
          />
          {esLtr && (
            <>
              <SupuestoEditable
                label="Vacancia" field="vacanciaPct" suffix="%"
                value={a.vacanciaPct ?? "5"} edited={!!a.vacanciaPct}
                fuente="promedio de meses sin arrendatario al año"
                onChange={(v) => { if (v === "" || /^\d{0,2}$/.test(v)) w.patchAnswers({ vacanciaPct: v }); }}
              />
              <SupuestoEditable
                label="Comisión administración" field="comisionAdminPct" suffix="%"
                value={a.comisionAdminPct ?? "0"} edited={!!a.comisionAdminPct}
                fuente="0 = autogestión; corredor típico 7-10%"
                onChange={(v) => { if (v === "" || /^\d{0,2}$/.test(v)) w.patchAnswers({ comisionAdminPct: v }); }}
              />
            </>
          )}
          {esStr && (
            <>
              <SupuestoEditable
                label="Costos operativos (luz+agua+wifi+insumos)" field="costoInsumos" suffix="$"
                value={a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos)}
                edited={!!a.costoInsumos} fuente={`operación típica para ${dorm} dormitorios`}
                onChange={patchNum("costoInsumos")}
              />
              <SupuestoEditable
                label="Mantención" field="mantencionStr" suffix="$"
                value={a.mantencionStr ?? String(costos.mantencion)} edited={!!a.mantencionStr}
                fuente={`operación típica para ${dorm} dormitorios`}
                onChange={patchNum("mantencionStr")}
              />
              <SupuestoEditable
                label="Amoblamiento (capex)" field="costoAmoblamiento" suffix="$"
                value={a.costoAmoblamiento ?? String(costos.costoAmoblamiento)} edited={!!a.costoAmoblamiento}
                fuente="capex inicial estimado si el depto no está amoblado"
                onChange={patchNum("costoAmoblamiento")}
              />
            </>
          )}
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-3 mb-0">
            Toda estimación lleva su fuente. Edita cualquiera si tienes datos más finos.
          </p>
        </div>
      </details>

      {error && (
        <div className="rounded-xl border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--signal-red)_5%,transparent)] px-4 py-3">
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0">{error}</p>
        </div>
      )}

      {/* ── Botón final tri-estado (sticky, nunca escondido) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-bg)_92%,transparent)] backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-stretch gap-1.5">
          <FinalCTA
            mod={mod}
            isLoggedIn={isLoggedIn}
            canAnalyze={canAnalyze}
            submitting={submitting}
            onGenerar={onGenerar}
            onDesbloquear={onDesbloquear}
          />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">
            Después de esto, el informe es final.
          </p>
        </div>
      </div>
    </div>
  );
}

function FinalCTA({
  mod,
  isLoggedIn,
  canAnalyze,
  submitting,
  onGenerar,
  onDesbloquear,
}: {
  mod: string | undefined;
  isLoggedIn: boolean;
  canAnalyze: boolean;
  submitting: boolean;
  onGenerar: () => void;
  onDesbloquear: () => void;
}) {
  const cls =
    "font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-60";

  // Con créditos / subscriber / admin → generar (1 crédito).
  if (canAnalyze) {
    return (
      <button type="button" onClick={onGenerar} disabled={submitting} className={cls}>
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar análisis · 1 crédito</>}
      </button>
    );
  }
  // Logueado sin créditos → desbloquear (checkout).
  if (isLoggedIn) {
    return (
      <button type="button" onClick={onDesbloquear} disabled={submitting} className={cls}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</>
        ) : (
          <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>
        )}
      </button>
    );
  }
  // Guest → crear cuenta (preserva draft con resume).
  return (
    <Link
      href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`}
      className={cls}
    >
      Crear cuenta gratis <ArrowRight size={14} />
    </Link>
  );
}
