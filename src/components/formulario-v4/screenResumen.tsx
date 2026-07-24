"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — RESUMEN · DOCUMENTO MAESTRO (rediseño F6)
//
// El resumen es el documento maestro del deal: tres cards por acto (01 Qué
// compras · 02 Cómo lo financias · 03 Cómo lo rentabilizas), cada una con un
// nivel 2 (campos decisivos) y niveles 3 colapsables (detalle / supuestos).
//
// R1 (esta fase): ESTRUCTURA render-only — 3 cards numeradas, niveles, acordeón,
// responsive (desktop grid 3-col siempre abierto · mobile stack acordeón con
// línea-resumen), derivados en gris "· calculada/o". La EDICIÓN inline llega en
// R2; las estructurales (dirección/tipo/modalidad + cascada) en R3.
//
// Se conserva: formato chileno, fuentes con caveat N<10, tags de subsidio,
// botón tri-estado con micro-ancla, "el informe es final", draft, a11y.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { SINGLE_PRICE } from "@/lib/pricing";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { estimarContribuciones } from "@/lib/contribuciones";
import { antiguedadToNumber } from "@/components/formulario-v3/wizardV3State";
import type { useWizardV4 } from "./useWizardV4";
import type { WizardV4Data } from "./useWizardV4Data";
import { canAnalyzeFromTier, type TierInfo } from "./useWizardV4Tier";
import { comprarLocked, submitConCredito, type SubmitContext } from "./wizardV4Submit";
import { dormLabel, fmtCLP, fmtUF, parseNum, parseDecimalLocale, cuotaCLP, piePct, pieUF, precioUF } from "./derive";
import { subsidioAplicadoV4 } from "./wizardV4Subsidio";
import { useWizardV4DryRun } from "./useWizardV4DryRun";
import { trackWizard } from "./track";

const LABEL_MOD: Record<string, string> = { ltr: "Renta larga", str: "Renta corta", both: "Comparativo" };
const LABEL_GATE: Record<string, string> = { si: "Sí permite", no: "No permite", no_seguro: "No estoy seguro" };

type Wizard = ReturnType<typeof useWizardV4>;

/** Formatea dígitos con separador de miles chileno (63000 → "63.000"). */
function fmtMiles(v: string | number): string {
  return String(v).replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function joinVars(vars: string[]): string {
  if (vars.length <= 1) return vars[0] ?? "";
  return `${vars.slice(0, -1).join(", ")} y ${vars[vars.length - 1]}`;
}
function sensibleA(vars: string[]): string {
  const s = joinVars(vars);
  return s.startsWith("el ") ? `al ${s.slice(3)}` : `a ${s}`;
}

// ── Primitivos de presentación (render-only en R1) ──────────────────────────

/** Campo de nivel 2: label chico arriba + valor. En R1 render-only; la edición
 *  inline y la gramática visual (punteado/lápiz) llegan en R2. */
function Field({
  label,
  value,
  derived,
  tag,
  fuente,
}: {
  label: string;
  value: string;
  /** Valor calculado (gris, sin affordance) — ej. conversión CLP, cuota. */
  derived?: string;
  /** "estimado" / "corregido por ti" / "con subsidio". */
  tag?: string;
  /** Procedencia de la estimación (incluye caveat N<10). */
  fuente?: string;
}) {
  return (
    <div className="py-2 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--franco-text-muted)] m-0 mb-0.5">
        {label}
      </p>
      <p className="font-mono text-[14px] text-[var(--franco-text)] m-0 leading-snug break-words">
        {value}
        {tag && <span className="text-[var(--franco-text-muted)] text-[11px]"> · {tag}</span>}
      </p>
      {derived && (
        <p className="font-mono text-[12px] text-[var(--franco-text-muted)] m-0 mt-0.5">{derived}</p>
      )}
      {fuente && (
        <p className="font-mono text-[10px] text-[var(--franco-text-muted)] m-0 mt-0.5 leading-snug">{fuente}</p>
      )}
    </div>
  );
}

/** Bloque de nivel 3 colapsable (fondo hundido para marcar profundidad). Acordeón:
 *  el caller garantiza que solo un hermano esté abierto. */
function Nivel3({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "var(--franco-sunken, #161616)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
      >
        {title}
        <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}

/** Card de acto: número editorial (mono Signal Red) + título. En mobile es
 *  colapsable con línea-resumen; en desktop siempre muestra el nivel 2. */
function ActCard({
  num,
  title,
  summaryLine,
  open,
  onToggle,
  children,
}: {
  num: string;
  title: string;
  summaryLine: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm overflow-hidden">
      {/* Header: en mobile es botón acordeón; en desktop es rótulo estático. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="lg:pointer-events-none w-full text-left px-4 py-3 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] m-0 mb-0.5">
            <span className="text-signal-red">{num}</span>{" "}
            <span className="text-[var(--franco-text-tertiary)]">{title}</span>
          </p>
          {/* Línea-resumen: solo mobile y solo cuando la card está cerrada. */}
          {!open && (
            <p className="lg:hidden font-mono text-[12px] text-[var(--franco-text-secondary)] m-0 truncate">
              {summaryLine}
            </p>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`lg:hidden shrink-0 mt-0.5 text-[var(--franco-text-muted)] transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {/* Contenido: desktop siempre; mobile solo si open. */}
      <div className={`${open ? "block" : "hidden"} lg:block px-4 pb-3`}>{children}</div>
    </section>
  );
}

export function ResumenScreen({
  w,
  data,
  tier,
  isLoggedIn,
  onTerminal,
}: {
  w: Wizard;
  data: WizardV4Data;
  tier: TierInfo | null;
  isLoggedIn: boolean;
  onTerminal: () => void;
}) {
  const posthog = usePostHog();
  const a = w.nav.answers;
  const mod = a.modalidad;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Acordeón mobile entre cards (solo una abierta). Desktop las muestra todas.
  const [openCard, setOpenCard] = useState<"01" | "02" | "03">("01");
  // Nivel 3 de la card 01 (único → toggle simple).
  const [detalleOpen, setDetalleOpen] = useState(false);
  // Nivel 3 de la card 03 (dos hermanos → acordeón).
  const [l3, setL3] = useState<"sup" | "gest" | null>(null);

  // Dry-run silencioso (FASE 5): card de sensibilidad si el deal está al filo.
  const dryRun = useWizardV4DryRun(a, data);
  const alFilo = dryRun.alFilo && dryRun.variablesSensibles.length > 0;
  const alfiloKey = alFilo ? dryRun.variablesSensibles.join("|") : "";

  useEffect(() => {
    if (alfiloKey) trackWizard(posthog, "wizard4_alfilo_shown", { variablesSensibles: alfiloKey.split("|"), modalidad: mod });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alfiloKey]);

  const canAnalyze = canAnalyzeFromTier(tier);
  const ctx: SubmitContext = {
    ufCLP: data.ufCLP,
    arriendoSugerido: data.arriendoSugerido,
    arriendoN: data.arriendoN,
    precioM2UF: data.precioM2UF,
    radiusUsed: data.radiusUsed,
    ggccSugerido: data.ggccSugerido,
  };

  useEffect(() => {
    if (tier == null || !mod) return;
    if (!isLoggedIn) trackWizard(posthog, "wizard4_gate_auth_shown", { modalidad: mod });
    else if (!canAnalyze) trackWizard(posthog, "wizard4_gate_credits_shown", { modalidad: mod });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, isLoggedIn, canAnalyze, mod]);

  // ── Derivaciones de display ──
  const pUF = precioUF(a);
  const precioStr = pUF > 0 ? fmtUF(pUF) : "—";
  const precioCLP = pUF > 0 ? `≈ ${fmtCLP(pUF * data.ufCLP)} · calculada` : undefined;
  const pct = piePct(a, data.ufCLP);
  const pieStr = pct > 0 ? `${Math.round(pct)}% · ${fmtUF(pieUF(a, data.ufCLP))}` : "—";
  const cuota = cuotaCLP(a, data.ufCLP);
  const cuotaStr = cuota > 0 ? `Cuota ≈ ${fmtCLP(cuota)}/mes · calculada` : undefined;
  const sup = parseDecimalLocale(a.superficieUtil ?? "");
  const tamStr = sup > 0 ? `${a.superficieUtil} m² · ${a.esStudio ? "Studio" : (a.dormitorios ?? "—") + "D"} · ${a.banos ?? "—"}B` : "—";

  const tasaTag = subsidioAplicadoV4(a, data.tasaMercado)
    ? "con subsidio"
    : a.tasaModo === "preaprobada"
      ? "corregido por ti"
      : a.tasaModo === "estimada"
        ? "estimado"
        : undefined;

  // Detalle del depto (nivel 3 · card 01).
  const tipoStr = a.tipoPropiedad === "nuevo" ? "Nuevo" : a.tipoPropiedad === "usado" ? "Usado" : "—";
  const entregaAntig =
    a.tipoPropiedad === "nuevo"
      ? a.estadoVenta === "futura" && a.fechaEntregaMes && a.fechaEntregaAnio
        ? `Entrega ${a.fechaEntregaMes}/${a.fechaEntregaAnio}`
        : "Entrega inmediata"
      : a.antiguedad
        ? `${antiguedadToNumber(a.antiguedad)} años`
        : "—";
  const nEstac = Number(a.estacionamientos) || 0;
  const nBodega = Number(a.bodegas) || 0;
  const extrasStr = `${nEstac} estac · ${nBodega} bodega`;

  // Supuestos (nivel 3 · card 03). Defaults idénticos al plegado del wizard.
  const ggccDef = data.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
  const contribDef = estimarContribuciones(pUF * data.ufCLP, a.tipoPropiedad === "nuevo");
  const dorm = Number(a.dormitorios) || 2;
  const costos = getCostosDefault(dorm, "basico");

  const esLtr = mod === "ltr" || mod === "both";
  const esStr = mod === "str" || mod === "both";

  async function onGenerar() {
    setError("");
    setSubmitting(true);
    onTerminal();
    trackWizard(posthog, "wizard4_submitted", { modalidad: mod });
    const res = await submitConCredito(a, ctx);
    if (res.ok && res.redirect) window.location.href = res.redirect;
    else { setError(res.error || "No pudimos generar el análisis."); setSubmitting(false); }
  }

  async function onDesbloquear() {
    setError("");
    setSubmitting(true);
    onTerminal();
    trackWizard(posthog, "wizard4_checkout_initiated", { modalidad: mod });
    const res = await comprarLocked(a, ctx);
    if (res.ok && res.redirect) window.location.href = res.redirect;
    else { setError(res.error || "No se pudo crear el análisis."); setSubmitting(false); }
  }

  // Línea-resumen (mobile) por card.
  const sumamble01 = [a.direccion, tipoStr !== "—" ? tipoStr.toLowerCase() : null, sup > 0 ? `${a.superficieUtil} m²` : null, pUF > 0 ? fmtUF(pUF) : null].filter(Boolean).join(" · ") || "—";
  const summary02 = [pct > 0 ? `${Math.round(pct)}% pie` : null, a.plazoCredito ? `${a.plazoCredito} años` : null, a.tasaInteres ? `${a.tasaInteres}%` : null].filter(Boolean).join(" · ") || "—";
  const summary03 = esStr
    ? [a.adrTarifa ? `${fmtCLP(parseNum(a.adrTarifa))}/noche` : null, a.adrOcupacion ? `${a.adrOcupacion}%` : null, a.edificioPermiteAirbnb ? LABEL_GATE[a.edificioPermiteAirbnb] : null].filter(Boolean).join(" · ") || "—"
    : (a.arriendo ? `${fmtCLP(parseNum(a.arriendo))}/mes` : "—");

  const toggleCard = (c: "01" | "02" | "03") => setOpenCard((prev) => (prev === c ? prev : c));

  return (
    <div className="pb-44 lg:pb-8">
      {/* ── Header del documento: chip de informe (editable en R3) ── */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          aria-label={`Informe: ${mod ? LABEL_MOD[mod] : "—"}. Editar más adelante.`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-signal-red px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--franco-text)]"
        >
          <span className="text-[var(--franco-text-muted)]">Informe:</span>
          <span className="font-medium">{mod ? LABEL_MOD[mod] : "—"}</span>
          <span className="text-signal-red">▾</span>
        </button>
      </div>

      {/* ── Tres cards por acto ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* 01 · Qué compras */}
        <ActCard num="01" title="Qué compras" summaryLine={sumamble01} open={openCard === "01"} onToggle={() => toggleCard("01")}>
          <Field label="Dirección" value={a.direccion || "—"} />
          <Field label="Precio" value={precioStr} derived={precioCLP} />
          <Nivel3 title="Detalle del depto" open={detalleOpen} onToggle={() => setDetalleOpen((o) => !o)}>
            <Field label="Tipo" value={tipoStr} />
            <Field label={a.tipoPropiedad === "nuevo" ? "Entrega" : "Antigüedad"} value={entregaAntig} />
            <Field label="Tamaño" value={tamStr} />
            <Field label="Estacionamiento y bodega" value={extrasStr} />
          </Nivel3>
        </ActCard>

        {/* 02 · Cómo lo financias */}
        <ActCard num="02" title="Cómo lo financias" summaryLine={summary02} open={openCard === "02"} onToggle={() => toggleCard("02")}>
          <Field label="Pie" value={pieStr} />
          <Field label="Plazo" value={a.plazoCredito ? `${a.plazoCredito} años` : "—"} />
          <Field label="Tasa" value={a.tasaInteres ? `${a.tasaInteres}%` : "—"} tag={tasaTag} derived={cuotaStr} />
        </ActCard>

        {/* 03 · Cómo lo rentabilizas */}
        <ActCard num="03" title="Cómo lo rentabilizas" summaryLine={summary03} open={openCard === "03"} onToggle={() => toggleCard("03")}>
          {esStr && (
            <Field label="Edificio permite Airbnb" value={a.edificioPermiteAirbnb ? LABEL_GATE[a.edificioPermiteAirbnb] : "—"} />
          )}
          {esLtr && (
            <Field
              label="Arriendo"
              value={a.arriendo ? `${fmtCLP(parseNum(a.arriendo))}/mes` : "—"}
              tag={a.arrModo === "corregir" ? "corregido por ti" : a.arrModo === "estimacion" ? "estimado" : undefined}
              fuente={esLtr ? fuenteArriendo(data.arriendoN) : undefined}
            />
          )}
          {esStr && (
            <Field
              label="Tarifa · ocupación"
              value={a.adrTarifa ? `${fmtCLP(parseNum(a.adrTarifa))}/noche · ${a.adrOcupacion ?? "—"}%` : "—"}
              tag={a.adrModo === "corregir" ? "corregido por ti" : a.adrModo === "estimacion" ? "estimado" : undefined}
              fuente="datos de mercado Airbnb de la zona, últimos 90 días"
            />
          )}

          {esLtr && (
            <Nivel3 title="Supuestos del arriendo" open={l3 === "sup"} onToggle={() => setL3((v) => (v === "sup" ? null : "sup"))}>
              <Field label="Gastos comunes" value={`$${fmtMiles(a.gastosComunes ?? String(Math.round(ggccDef)))}/mes`} tag={a.gastosComunes ? "corregido por ti" : undefined} fuente="gastos comunes típicos de la comuna" />
              <Field label="Contribuciones (trim.)" value={`$${fmtMiles(a.contribuciones ?? String(Math.round(contribDef)))}`} tag={a.contribuciones ? "corregido por ti" : undefined} fuente="fórmula SII según avalúo estimado" />
              <Field label="Vacancia" value={`${a.vacanciaPct ?? "5"}%`} tag={a.vacanciaPct ? "corregido por ti" : undefined} fuente="promedio de meses sin arrendatario al año" />
              <Field label="Comisión administración" value={`${a.comisionAdminPct ?? "0"}%`} tag={a.comisionAdminPct ? "corregido por ti" : undefined} fuente="0 = autogestión; corredor típico 7-10%" />
            </Nivel3>
          )}
          {esStr && (
            <Nivel3 title="Gestión y costos" open={l3 === "gest"} onToggle={() => setL3((v) => (v === "gest" ? null : "gest"))}>
              <Field label="Costos operativos" value={`$${fmtMiles(a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos))}/mes`} tag={a.costoInsumos ? "corregido por ti" : undefined} fuente={`consumo operativo típico para ${dormLabel(dorm)}`} />
              <Field label="Mantención" value={`$${fmtMiles(a.mantencionStr ?? String(costos.mantencion))}/mes`} tag={a.mantencionStr ? "corregido por ti" : undefined} fuente={`provisión mensual de mantención para ${dormLabel(dorm)}`} />
              <Field label="Amoblamiento (capex)" value={`$${fmtMiles(a.costoAmoblamiento ?? String(costos.costoAmoblamiento))}`} tag={a.costoAmoblamiento ? "corregido por ti" : undefined} fuente="capex inicial estimado si el depto no está amoblado" />
            </Nivel3>
          )}
        </ActCard>
      </div>

      {/* ── Fila final: card al-filo + CTA. Desktop lado a lado; mobile apilado (CTA sticky). ── */}
      {alFilo && (
        <div className="mt-4 lg:hidden rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">
            Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}
          </p>
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">
            Una diferencia pequeña cambia el veredicto. Si no estás seguro, tócalo antes de generar.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--signal-red)_5%,transparent)] px-4 py-3">
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0">{error}</p>
        </div>
      )}

      {/* Desktop: fila final al-filo (izq) + generar (der), lado a lado. */}
      <div className="hidden lg:grid grid-cols-2 gap-4 items-stretch mt-4">
        <div>
          {alFilo && (
            <div className="h-full rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">
                Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}
              </p>
              <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">
                Una diferencia pequeña cambia el veredicto. Revísalo antes de generar.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-end gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
        </div>
      </div>

      {/* Mobile: CTA sticky al fondo. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-bg)_92%,transparent)] backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-stretch gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
        </div>
      </div>
    </div>
  );
}

/** Fuente del arriendo LTR en 3 tramos (idéntica al Acto 3 · incluye caveat N<10). */
function fuenteArriendo(n: number): string {
  if (n >= 10) return `mediana de ${n} arriendos comparables publicados en la zona`;
  if (n > 0) return `mediana de solo ${n} ${n === 1 ? "arriendo comparable" : "arriendos comparables"} en la zona — muestra chica, ajústalo si conoces el arriendo real`;
  return "sin comparables publicados — estimación de mercado";
}

/** Caveat bajo el CTA: ancla pre-pago en desbloquear, inmutabilidad en el resto. */
function ctaCaveat(isLoggedIn: boolean, canAnalyze: boolean, mod: string | undefined, comuna: string | undefined): string {
  if (isLoggedIn && !canAnalyze) {
    return `Estás comprando este análisis${mod === "both" ? " comparativo" : ""}${comuna ? ` de ${comuna}` : ""}. Pagas y se desbloquea al instante.`;
  }
  return "Después de esto, el informe es final.";
}

function FinalCTA({
  mod,
  isLoggedIn,
  canAnalyze,
  submitting,
  onGenerar,
  onDesbloquear,
  onTerminal,
}: {
  mod: string | undefined;
  isLoggedIn: boolean;
  canAnalyze: boolean;
  submitting: boolean;
  onGenerar: () => void;
  onDesbloquear: () => void;
  onTerminal: () => void;
}) {
  const cls =
    "font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-60";

  if (canAnalyze) {
    return (
      <button type="button" onClick={onGenerar} disabled={submitting} className={cls}>
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar análisis · 1 crédito</>}
      </button>
    );
  }
  if (isLoggedIn) {
    return (
      <button type="button" onClick={onDesbloquear} disabled={submitting} className={cls}>
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</> : <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>}
      </button>
    );
  }
  return (
    <Link href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`} onClick={onTerminal} className={cls}>
      Crear cuenta gratis <ArrowRight size={14} />
    </Link>
  );
}
