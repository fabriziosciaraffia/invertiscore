"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — RESUMEN · DOCUMENTO MAESTRO (rediseño F6)
//
// El resumen es el documento maestro del deal: tres cards por acto (01/02/03),
// cada una con nivel 2 (campos decisivos) y niveles 3 colapsables. TODA edición
// ocurre EN el resumen, inline — no hay viaje lápiz→pantalla→volver.
//
// R2: EDICIÓN INLINE de valores + gramática visual.
//  · EDITABLE: valor con subrayado punteado + lápiz (hover desktop / fijo mobile)
//    + tinte Signal Red en hover; tap → editor en el lugar.
//  · CALCULADO: gris, sin affordance, sufijo "· calculada/o".
//  · COMMIT = blur o Enter (NO cada keystroke). El dry-run, los eventos y la
//    línea-resumen mobile se actualizan al COMMIT. Escape cancela.
//
// Estructurales (dirección/tipo/modalidad + cascada) y card al-filo apunta-adentro
// llegan en R3/R4. Se conserva: formato chileno, fuentes con caveat N<10, tags,
// botón tri-estado con micro-ancla, draft, a11y.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { ArrowRight, ChevronRight, Loader2, Pencil } from "lucide-react";
import { SINGLE_PRICE } from "@/lib/pricing";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { estimarContribuciones } from "@/lib/contribuciones";
import { antiguedadToNumber } from "@/components/formulario-v3/wizardV3State";
import type { useWizardV4 } from "./useWizardV4";
import type { WizardV4Answers } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { canAnalyzeFromTier, type TierInfo } from "./useWizardV4Tier";
import { comprarLocked, submitConCredito, type SubmitContext } from "./wizardV4Submit";
import { dormLabel, fmtCLP, fmtUF, parseNum, parseDecimalLocale, cuotaCLP, piePct, pieUF, precioUF } from "./derive";
import { calificaSubsidioV4, subsidioAplicadoV4, tasaConSubsidioV4 } from "./wizardV4Subsidio";
import { useWizardV4DryRun } from "./useWizardV4DryRun";
import { trackWizard } from "./track";

const LABEL_MOD: Record<string, string> = { ltr: "Renta larga", str: "Renta corta", both: "Comparativo" };
const LABEL_GATE: Record<string, string> = { si: "Sí permite", no: "No permite", no_seguro: "No estoy seguro" };

type Wizard = ReturnType<typeof useWizardV4>;

/** Formatea dígitos con separador de miles chileno (63000 → "63.000"). */
function fmtMiles(v: string | number): string {
  return String(v).replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function tasaStr(t: number): string {
  return t.toFixed(2).replace(".", ",");
}

function joinVars(vars: string[]): string {
  if (vars.length <= 1) return vars[0] ?? "";
  return `${vars.slice(0, -1).join(", ")} y ${vars[vars.length - 1]}`;
}
function sensibleA(vars: string[]): string {
  const s = joinVars(vars);
  return s.startsWith("el ") ? `al ${s.slice(3)}` : `a ${s}`;
}

// Variable al-filo (label de la card) → campo del resumen (para wizard4_alfilo_edited).
const FIELD_FOR_VAR: Record<string, string> = {
  "el arriendo": "arr",
  "la tasa": "tasa",
  "la tarifa": "adr",
  "la ocupación": "adr",
};

// ── Envoltorio de campo (label + valor/editor + tag + fuente) ────────────────

function FieldShell({ label, children, fuente }: { label: string; children: ReactNode; fuente?: string }) {
  return (
    <div className="py-2 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--franco-text-muted)] m-0 mb-0.5">{label}</p>
      {children}
      {fuente && <p className="font-mono text-[10px] text-[var(--franco-text-muted)] m-0 mt-0.5 leading-snug">{fuente}</p>}
    </div>
  );
}

/** Campo estático (no editable) — dirección en R2 (estructural, edita en R3). */
function StaticField({ label, value, derived, fuente }: { label: string; value: string; derived?: string; fuente?: string }) {
  return (
    <FieldShell label={label} fuente={fuente}>
      <p className="font-mono text-[14px] text-[var(--franco-text)] m-0 leading-snug break-words">{value}</p>
      {derived && <p className="font-mono text-[12px] text-[var(--franco-text-muted)] m-0 mt-0.5">{derived}</p>}
    </FieldShell>
  );
}

/** Valor derivado/calculado — gris, sin affordance. */
function DerivedLine({ text }: { text: string }) {
  return <p className="font-mono text-[12px] text-[var(--franco-text-muted)] m-0 mt-0.5">{text}</p>;
}

/** Tag "· estimado" / "· corregido por ti" / "· con subsidio". */
function Tag({ tag }: { tag?: string }) {
  return tag ? <span className="text-[var(--franco-text-muted)] text-[11px]"> · {tag}</span> : null;
}

/** Display editable: valor con punteado + lápiz + tinte rojo en hover. */
function EditableDisplay({ text, tag, onStart }: { text: string; tag?: string; onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="group/edit inline-flex items-center gap-1.5 text-left"
    >
      <span className="font-mono text-[14px] text-[var(--franco-text)] group-hover/edit:text-signal-red transition-colors border-b border-dashed border-[var(--franco-border-strong)] leading-snug break-words">
        {text}
        <Tag tag={tag} />
      </span>
      <Pencil size={12} className="shrink-0 text-[var(--franco-text-muted)] opacity-60 lg:opacity-0 lg:group-hover/edit:opacity-100 transition-opacity" />
    </button>
  );
}

/** Input inline con commit en blur/Enter, cancel en Escape. */
function InlineInput({
  initial,
  format,
  suffix,
  inputMode = "numeric",
  onCommit,
  onCancel,
}: {
  initial: string;
  format?: (v: string) => string;
  suffix?: string;
  inputMode?: "numeric" | "decimal" | "text";
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  // Guard anti doble-fire: Enter llama onCommit y luego el unmount podría gatillar
  // blur → evento edit_from_summary duplicado. Solo el primero pasa.
  const done = useRef(false);
  const commit = (val: string) => { if (done.current) return; done.current = true; onCommit(val); };
  const cancel = () => { if (done.current) return; done.current = true; onCancel(); };
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <span className="relative inline-flex items-center">
      <input
        ref={ref}
        value={v}
        inputMode={inputMode}
        onChange={(e) => setV(format ? format(e.target.value) : e.target.value)}
        onBlur={() => commit(v)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(v); }
          else if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className={`w-[130px] h-9 rounded-lg border-[1.5px] border-signal-red bg-[var(--franco-card)] px-2 font-mono text-[14px] text-[var(--franco-text)] focus:outline-none ${suffix ? "pr-8" : ""}`}
      />
      {suffix && <span className="absolute right-2 font-mono text-[11px] text-[var(--franco-text-muted)] pointer-events-none">{suffix}</span>}
    </span>
  );
}

/** Campo numérico editable (precio/arriendo/tarifa/occ/supuestos). `kind` define
 *  el display; el editor guarda dígitos formateados (parseNum revierte). */
function NumField({
  label,
  raw,
  display,
  suffix,
  inputMode = "numeric",
  format,
  tag,
  fuente,
  derived,
  onCommit,
}: {
  label: string;
  raw: string;
  display: string;
  suffix: string;
  inputMode?: "numeric" | "decimal";
  format?: (v: string) => string;
  tag?: string;
  fuente?: string;
  derived?: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <FieldShell label={label} fuente={fuente}>
      {editing ? (
        <InlineInput
          initial={raw}
          suffix={suffix}
          inputMode={inputMode}
          format={format ?? fmtMiles}
          onCommit={(v) => { setEditing(false); onCommit(v); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <EditableDisplay text={display} tag={tag} onStart={() => setEditing(true)} />
      )}
      {derived && <DerivedLine text={derived} />}
    </FieldShell>
  );
}

/** Campo de opciones discretas (plazo/gate) — chips. Commit al seleccionar. */
function ChipsField<T extends string>({
  label,
  value,
  options,
  tag,
  fuente,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: T; label: string }>;
  tag?: string;
  fuente?: string;
  onCommit: (v: T) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "—";
  return (
    <FieldShell label={label} fuente={fuente}>
      {editing ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setEditing(false); onCommit(o.value); }}
              className={`font-mono text-[12px] px-2.5 h-8 rounded-lg border-[0.5px] transition-colors ${
                o.value === value
                  ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                  : "border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <EditableDisplay text={current} tag={tag} onStart={() => setEditing(true)} />
      )}
    </FieldShell>
  );
}

// ── Estructura de cards ──────────────────────────────────────────────────────

function Nivel3({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
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

function ActCard({ num, title, summaryLine, open, onToggle, children }: { num: string; title: string; summaryLine: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="lg:pointer-events-none w-full text-left px-4 py-3 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          {/* Número mono Signal Red + título Source Serif 4 (14px/500, tinta) —
              rima editorial con la pantalla del informe (mockup aprobado). */}
          <p className="m-0 mb-0.5 flex items-baseline gap-1.5">
            <span className="font-mono text-[11px] font-medium text-signal-red">{num}</span>
            <span className="font-heading text-[14px] font-medium text-[var(--franco-text)] leading-tight">{title}</span>
          </p>
          {!open && <p className="lg:hidden font-mono text-[12px] text-[var(--franco-text-secondary)] m-0 truncate">{summaryLine}</p>}
        </div>
        <ChevronRight size={16} className={`lg:hidden shrink-0 mt-0.5 text-[var(--franco-text-muted)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`${open ? "block" : "hidden"} lg:block px-4 pb-3`}>{children}</div>
    </section>
  );
}

export function ResumenScreen({ w, data, tier, isLoggedIn, onTerminal }: { w: Wizard; data: WizardV4Data; tier: TierInfo | null; isLoggedIn: boolean; onTerminal: () => void }) {
  const posthog = usePostHog();
  const a = w.nav.answers;
  const mod = a.modalidad;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Acordeón mobile: las 3 cards nacen COLAPSADAS (la línea-resumen es la
  // revisión de un vistazo). Desktop las muestra todas. null = ninguna abierta.
  const [openCard, setOpenCard] = useState<"01" | "02" | "03" | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [l3, setL3] = useState<"sup" | "gest" | null>(null);

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

  // Commit de una edición inline: persiste, emite edit_from_summary (+ alfilo_edited
  // si la card nombró esa variable) y re-dispara el dry-run (vía cambio de answers).
  const commitEdit = (field: string, patch: Partial<WizardV4Answers>) => {
    w.patchAnswers(patch);
    trackWizard(posthog, "wizard4_edit_from_summary", { field });
    if (alFilo) {
      const v = dryRun.variablesSensibles.find((x) => FIELD_FOR_VAR[x] === field);
      if (v) trackWizard(posthog, "wizard4_alfilo_edited", { field, variable: v });
    }
  };

  // ── Derivaciones de display ──
  const pUF = precioUF(a);
  const precioCLP = pUF > 0 ? `≈ ${fmtCLP(pUF * data.ufCLP)} · calculada` : undefined;
  const pct = piePct(a, data.ufCLP);
  const pieStr = pct > 0 ? `${Math.round(pct)}% · ${fmtUF(pieUF(a, data.ufCLP))}` : "—";
  const cuota = cuotaCLP(a, data.ufCLP);
  const cuotaStr = cuota > 0 ? `Cuota ≈ ${fmtCLP(cuota)}/mes · calculada` : undefined;
  const sup = parseDecimalLocale(a.superficieUtil ?? "");
  const tamStr = sup > 0 ? `${a.superficieUtil} m² · ${a.esStudio ? "Studio" : (a.dormitorios ?? "—") + "D"} · ${a.banos ?? "—"}B` : "—";

  const conSubsidio = subsidioAplicadoV4(a, data.tasaMercado);
  const tasaTag = conSubsidio ? "con subsidio" : a.tasaModo === "preaprobada" ? "corregido por ti" : a.tasaModo === "estimada" ? "estimado" : undefined;

  // Detalle del depto (nivel 3 · card 01).
  const tipoStr = a.tipoPropiedad === "nuevo" ? "Nuevo" : a.tipoPropiedad === "usado" ? "Usado" : "—";
  const entregaAntig =
    a.tipoPropiedad === "nuevo"
      ? a.estadoVenta === "futura" && a.fechaEntregaMes && a.fechaEntregaAnio ? `Entrega ${a.fechaEntregaMes}/${a.fechaEntregaAnio}` : "Entrega inmediata"
      : a.antiguedad ? `${antiguedadToNumber(a.antiguedad)} años` : "—";
  const nEstac = Number(a.estacionamientos) || 0;
  const nBodega = Number(a.bodegas) || 0;

  // Supuestos (nivel 3 · card 03).
  const ggccDef = data.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
  const contribDef = estimarContribuciones(pUF * data.ufCLP, a.tipoPropiedad === "nuevo");
  const dorm = Number(a.dormitorios) || 2;
  const costos = getCostosDefault(dorm, "basico");

  const esLtr = mod === "ltr" || mod === "both";
  const esStr = mod === "str" || mod === "both";

  async function onGenerar() {
    setError(""); setSubmitting(true); onTerminal();
    trackWizard(posthog, "wizard4_submitted", { modalidad: mod });
    const res = await submitConCredito(a, ctx);
    if (res.ok && res.redirect) window.location.href = res.redirect;
    else { setError(res.error || "No pudimos generar el análisis."); setSubmitting(false); }
  }
  async function onDesbloquear() {
    setError(""); setSubmitting(true); onTerminal();
    trackWizard(posthog, "wizard4_checkout_initiated", { modalidad: mod });
    const res = await comprarLocked(a, ctx);
    if (res.ok && res.redirect) window.location.href = res.redirect;
    else { setError(res.error || "No se pudo crear el análisis."); setSubmitting(false); }
  }

  // Líneas-resumen (mobile) — se recomputan de answers → se actualizan al commit.
  const summary01 = [a.direccion, tipoStr !== "—" ? tipoStr.toLowerCase() : null, sup > 0 ? `${a.superficieUtil} m²` : null, pUF > 0 ? fmtUF(pUF) : null].filter(Boolean).join(" · ") || "—";
  const summary02 = [pct > 0 ? `${Math.round(pct)}% pie` : null, a.plazoCredito ? `${a.plazoCredito} años` : null, a.tasaInteres ? `${a.tasaInteres}%` : null].filter(Boolean).join(" · ") || "—";
  const summary03 = esStr
    ? [a.adrTarifa ? `${fmtCLP(parseNum(a.adrTarifa))}/noche` : null, a.adrOcupacion ? `${a.adrOcupacion}%` : null, a.edificioPermiteAirbnb ? LABEL_GATE[a.edificioPermiteAirbnb] : null].filter(Boolean).join(" · ") || "—"
    : (a.arriendo ? `${fmtCLP(parseNum(a.arriendo))}/mes` : "—");

  const toggleCard = (c: "01" | "02" | "03") => setOpenCard((prev) => (prev === c ? null : c));

  // Validador % (0-99, tolera coma para tasa).
  const pctInt = (v: string) => v.replace(/\D/g, "").slice(0, 2);
  const tasaInput = (v: string) => v.replace(/[^\d,]/g, "").slice(0, 5);

  return (
    <div className="pb-44 lg:pb-8">
      {/* Header: chip de informe (editable en R3). */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          aria-label={`Informe: ${mod ? LABEL_MOD[mod] : "—"}. Editable más adelante.`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-signal-red px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--franco-text)]"
        >
          <span className="text-[var(--franco-text-muted)]">Informe:</span>
          <span className="font-medium">{mod ? LABEL_MOD[mod] : "—"}</span>
          <span className="text-signal-red">▾</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* 01 · Qué compras */}
        <ActCard num="01" title="Qué compras" summaryLine={summary01} open={openCard === "01"} onToggle={() => toggleCard("01")}>
          {/* Dirección: estructural → editable en R3. */}
          <StaticField label="Dirección" value={a.direccion || "—"} />
          <NumField
            label="Precio" raw={fmtMiles(a.precio ?? "")} display={pUF > 0 ? fmtUF(pUF) : "—"} suffix="UF"
            derived={precioCLP} onCommit={(v) => commitEdit("precio", { precio: fmtMiles(v) })}
          />
          <Nivel3 title="Detalle del depto" open={detalleOpen} onToggle={() => setDetalleOpen((o) => !o)}>
            {/* Tipo: estructural → editable en R3. */}
            <StaticField label="Tipo" value={tipoStr} />
            <StaticField label={a.tipoPropiedad === "nuevo" ? "Entrega" : "Antigüedad"} value={entregaAntig} />
            <StaticField label="Tamaño" value={tamStr} />
            <StaticField label="Estacionamiento y bodega" value={`${nEstac} estac · ${nBodega} bodega`} />
          </Nivel3>
        </ActCard>

        {/* 02 · Cómo lo financias */}
        <ActCard num="02" title="Cómo lo financias" summaryLine={summary02} open={openCard === "02"} onToggle={() => toggleCard("02")}>
          <NumField
            label="Pie (% del precio)" raw={String(Math.round(pct) || "")} display={pieStr} suffix="%" format={pctInt}
            onCommit={(v) => commitEdit("pie", { pieUnidad: "pct", pieMonto: v })}
          />
          <ChipsField
            label="Plazo" value={a.plazoCredito}
            options={[{ value: "15", label: "15" }, { value: "20", label: "20" }, { value: "25", label: "25" }, { value: "30", label: "30" }]}
            onCommit={(v) => commitEdit("plazo", { plazoCredito: v })}
          />
          {calificaSubsidioV4(a) ? (
            <ChipsField
              label="Tasa" value={conSubsidio ? "sub" : a.tasaModo === "estimada" ? "mer" : undefined}
              tag={tasaTag}
              options={[{ value: "sub", label: `Subsidio ${tasaStr(tasaConSubsidioV4(data.tasaMercado))}%` }, { value: "mer", label: `Mercado ${tasaStr(data.tasaMercado)}%` }]}
              onCommit={(v) => commitEdit("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(v === "sub" ? tasaConSubsidioV4(data.tasaMercado) : data.tasaMercado) })}
              fuente={conSubsidio ? "subsidio estatal a la tasa (Ley 21.748) — solo primera vivienda" : undefined}
            />
          ) : (
            <NumField
              label="Tasa" raw={a.tasaInteres ?? ""} display={a.tasaInteres ? `${a.tasaInteres}%` : "—"} suffix="%" inputMode="decimal" format={tasaInput}
              tag={tasaTag} derived={cuotaStr}
              onCommit={(v) => commitEdit("tasa", { tasaModo: "preaprobada", tasaInteres: v })}
            />
          )}
          {calificaSubsidioV4(a) && cuotaStr && <DerivedLine text={cuotaStr} />}
        </ActCard>

        {/* 03 · Cómo lo rentabilizas */}
        <ActCard num="03" title="Cómo lo rentabilizas" summaryLine={summary03} open={openCard === "03"} onToggle={() => toggleCard("03")}>
          {esStr && (
            <ChipsField
              label="Edificio permite Airbnb" value={a.edificioPermiteAirbnb}
              options={[{ value: "si", label: "Sí permite" }, { value: "no", label: "No permite" }, { value: "no_seguro", label: "No estoy seguro" }]}
              onCommit={(v) => commitEdit("gate", { edificioPermiteAirbnb: v })}
            />
          )}
          {esLtr && (
            <NumField
              label="Arriendo" raw={fmtMiles(a.arriendo ?? "")} display={a.arriendo ? `${fmtCLP(parseNum(a.arriendo))}/mes` : "—"} suffix="$"
              tag={a.arrModo === "corregir" ? "corregido por ti" : a.arrModo === "estimacion" ? "estimado" : undefined}
              fuente={fuenteArriendo(data.arriendoN)}
              onCommit={(v) => commitEdit("arr", { arriendo: fmtMiles(v), arrModo: "corregir" })}
            />
          )}
          {esStr && (
            <>
              <NumField
                label="Tarifa por noche" raw={fmtMiles(a.adrTarifa ?? "")} display={a.adrTarifa ? `${fmtCLP(parseNum(a.adrTarifa))}/noche` : "—"} suffix="$"
                tag={a.adrModo === "corregir" ? "corregido por ti" : a.adrModo === "estimacion" ? "estimado" : undefined}
                fuente="datos de mercado Airbnb de la zona, últimos 90 días"
                onCommit={(v) => commitEdit("adr", { adrTarifa: fmtMiles(v), adrModo: "corregir" })}
              />
              <NumField
                label="Ocupación" raw={a.adrOcupacion ?? ""} display={a.adrOcupacion ? `${a.adrOcupacion}%` : "—"} suffix="%" format={pctInt}
                onCommit={(v) => commitEdit("adr", { adrOcupacion: v, adrModo: "corregir" })}
              />
            </>
          )}

          {esLtr && (
            <Nivel3 title="Supuestos del arriendo" open={l3 === "sup"} onToggle={() => setL3((v) => (v === "sup" ? null : "sup"))}>
              <NumField label="Gastos comunes" raw={fmtMiles(a.gastosComunes ?? String(Math.round(ggccDef)))} display={`$${fmtMiles(a.gastosComunes ?? String(Math.round(ggccDef)))}/mes`} suffix="$" tag={a.gastosComunes ? "corregido por ti" : undefined} fuente="gastos comunes típicos de la comuna" onCommit={(v) => commitEdit("gastosComunes", { gastosComunes: fmtMiles(v) })} />
              <NumField label="Contribuciones (trim.)" raw={fmtMiles(a.contribuciones ?? String(Math.round(contribDef)))} display={`$${fmtMiles(a.contribuciones ?? String(Math.round(contribDef)))}`} suffix="$" tag={a.contribuciones ? "corregido por ti" : undefined} fuente="fórmula SII según avalúo estimado" onCommit={(v) => commitEdit("contribuciones", { contribuciones: fmtMiles(v) })} />
              <NumField label="Vacancia" raw={a.vacanciaPct ?? "5"} display={`${a.vacanciaPct ?? "5"}%`} suffix="%" format={pctInt} tag={a.vacanciaPct ? "corregido por ti" : undefined} fuente="promedio de meses sin arrendatario al año" onCommit={(v) => commitEdit("vacanciaPct", { vacanciaPct: v })} />
              <NumField label="Comisión administración" raw={a.comisionAdminPct ?? "0"} display={`${a.comisionAdminPct ?? "0"}%`} suffix="%" format={pctInt} tag={a.comisionAdminPct ? "corregido por ti" : undefined} fuente="0 = autogestión; corredor típico 7-10%" onCommit={(v) => commitEdit("comisionAdminPct", { comisionAdminPct: v })} />
            </Nivel3>
          )}
          {esStr && (
            <Nivel3 title="Gestión y costos" open={l3 === "gest"} onToggle={() => setL3((v) => (v === "gest" ? null : "gest"))}>
              <NumField label="Costos operativos" raw={fmtMiles(a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos))} display={`$${fmtMiles(a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos))}/mes`} suffix="$" tag={a.costoInsumos ? "corregido por ti" : undefined} fuente={`consumo operativo típico para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("costoInsumos", { costoInsumos: fmtMiles(v) })} />
              <NumField label="Mantención" raw={fmtMiles(a.mantencionStr ?? String(costos.mantencion))} display={`$${fmtMiles(a.mantencionStr ?? String(costos.mantencion))}/mes`} suffix="$" tag={a.mantencionStr ? "corregido por ti" : undefined} fuente={`provisión mensual de mantención para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("mantencionStr", { mantencionStr: fmtMiles(v) })} />
              <NumField label="Amoblamiento (capex)" raw={fmtMiles(a.costoAmoblamiento ?? String(costos.costoAmoblamiento))} display={`$${fmtMiles(a.costoAmoblamiento ?? String(costos.costoAmoblamiento))}`} suffix="$" tag={a.costoAmoblamiento ? "corregido por ti" : undefined} fuente="capex inicial estimado si el depto no está amoblado" onCommit={(v) => commitEdit("costoAmoblamiento", { costoAmoblamiento: fmtMiles(v) })} />
            </Nivel3>
          )}
        </ActCard>
      </div>

      {alFilo && (
        <div className="mt-4 lg:hidden rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</p>
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">Una diferencia pequeña cambia el veredicto. Si no estás seguro, tócalo antes de generar.</p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--signal-red)_5%,transparent)] px-4 py-3">
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0">{error}</p>
        </div>
      )}

      {/* Desktop: fila final al-filo (izq) + generar (der). */}
      <div className="hidden lg:grid grid-cols-2 gap-4 items-stretch mt-4">
        <div>
          {alFilo && (
            <div className="h-full rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</p>
              <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">Una diferencia pequeña cambia el veredicto. Revísalo antes de generar.</p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-end gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
        </div>
      </div>

      {/* Mobile: CTA sticky. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-bg)_92%,transparent)] backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-stretch gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
        </div>
      </div>
    </div>
  );
}

function fuenteArriendo(n: number): string {
  if (n >= 10) return `mediana de ${n} arriendos comparables publicados en la zona`;
  if (n > 0) return `mediana de solo ${n} ${n === 1 ? "arriendo comparable" : "arriendos comparables"} en la zona — muestra chica, ajústalo si conoces el arriendo real`;
  return "sin comparables publicados — estimación de mercado";
}

function ctaCaveat(isLoggedIn: boolean, canAnalyze: boolean, mod: string | undefined, comuna: string | undefined): string {
  if (isLoggedIn && !canAnalyze) return `Estás comprando este análisis${mod === "both" ? " comparativo" : ""}${comuna ? ` de ${comuna}` : ""}. Pagas y se desbloquea al instante.`;
  return "Después de esto, el informe es final.";
}

function FinalCTA({ mod, isLoggedIn, canAnalyze, submitting, onGenerar, onDesbloquear, onTerminal }: { mod: string | undefined; isLoggedIn: boolean; canAnalyze: boolean; submitting: boolean; onGenerar: () => void; onDesbloquear: () => void; onTerminal: () => void }) {
  const cls = "font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-60";
  if (canAnalyze) {
    return <button type="button" onClick={onGenerar} disabled={submitting} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar análisis · 1 crédito</>}</button>;
  }
  if (isLoggedIn) {
    return <button type="button" onClick={onDesbloquear} disabled={submitting} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</> : <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>}</button>;
  }
  return <Link href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`} onClick={onTerminal} className={cls}>Crear cuenta gratis <ArrowRight size={14} /></Link>;
}
