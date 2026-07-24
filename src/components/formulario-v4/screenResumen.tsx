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
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
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

// Campo → card (para limpiar la nota de cascada al interactuar con esa card).
const FIELD_CARD: Record<string, "01" | "02" | "03"> = {
  precio: "01", gastosComunes: "01", contribuciones: "01",
  pie: "02", plazo: "02", tasa: "02",
  gate: "03", arr: "03", adr: "03",
  vacanciaPct: "03", comisionAdminPct: "03",
  costoInsumos: "03", mantencionStr: "03", costoAmoblamiento: "03",
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
  highlight,
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
  /** Anillo Signal Red transitorio cuando la card al-filo apunta a este campo. */
  highlight?: boolean;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={highlight ? "rounded-lg -mx-1 px-1 ring-2 ring-signal-red transition-shadow duration-300" : ""}>
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
    </div>
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

const DIAS_MES = 30.44;

/** Nota de cascada (estilo reacción de Franco) dentro de una card afectada. Vive
 *  hasta la próxima interacción con esa card (R3). */
function CascadeNote({ text }: { text: string }) {
  return (
    <div className="mb-2 rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-3 pr-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-signal-red m-0 mb-0.5">Franco</p>
      <p className="font-body text-[12px] italic text-[var(--franco-text-secondary)] m-0 leading-snug">{text}</p>
    </div>
  );
}

/** Editor inline de dirección: el mismo Places Autocomplete embebido en la card,
 *  con gate de cobertura. Confirma solo comunas cubiertas; devuelve los datos de
 *  la nueva dirección al padre (que decide la invalidación + cascada). */
function DireccionEdit({ initial, onConfirm, onCancel }: {
  initial: string;
  onConfirm: (d: { direccion: string; comuna: string; ciudad: string; lat: number; lng: number }) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);
  const [fuera, setFuera] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!inputRef.current || acRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.maps?.places) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"], componentRestrictions: { country: "cl" },
        fields: ["geometry", "formatted_address", "address_components"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr = place.formatted_address || inputRef.current?.value || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comps = (place.address_components || []) as any[];
        const comunaRaw = comps.find((c) => c.types.includes("locality"))?.long_name
          || comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name || "";
        const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
        const comunaFinal = match?.comuna || comunaRaw;
        if (!isComunaDisponible(comunaFinal)) { setFuera(comunaFinal); return; }
        setFuera(null);
        doneRef.current = true;
        onConfirm({ direccion: addr, comuna: comunaFinal, ciudad: match?.ciudad || "Santiago", lat, lng });
      });
      acRef.current = ac;
      inputRef.current.focus();
    }).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        defaultValue={initial}
        placeholder="Ej: Av. Providencia 1234, Providencia"
        onBlur={() => { if (!doneRef.current) setTimeout(() => { if (!doneRef.current) onCancel(); }, 150); }}
        onKeyDown={(e) => { if (e.key === "Escape") { doneRef.current = true; onCancel(); } }}
        className="w-full h-9 rounded-lg border-[1.5px] border-signal-red bg-[var(--franco-card)] px-2 font-body text-[14px] text-[var(--franco-text)] focus:outline-none"
      />
      {fuera ? (
        <p className="font-body text-[11px] mt-1 text-signal-red leading-snug">{fuera} está fuera del Gran Santiago — Franco no tiene datos suficientes acá.</p>
      ) : (
        <p className="font-body text-[10px] mt-1 text-[var(--franco-text-muted)]">Elige una opción de la lista. Cambiar de comuna re-estima la zona.</p>
      )}
    </div>
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
    <section className="h-full rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm overflow-hidden">
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
  const [l3c01, setL3c01] = useState<"detalle" | "gastos" | null>(null); // card 01 acordeón
  const [l3, setL3] = useState<"sup" | "gest" | null>(null); // card 03 acordeón
  // R3: notas de cascada por card (viven hasta la próxima interacción con la card).
  const [cascade, setCascade] = useState<Record<string, string>>({});
  const [editingDir, setEditingDir] = useState(false);
  const [editingTipo, setEditingTipo] = useState(false);
  const [editingMod, setEditingMod] = useState(false);
  // R4: campo iluminado transitoriamente cuando la card al-filo apunta-adentro.
  const [highlight, setHighlight] = useState<string | null>(null);

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
    // Interacción con la card → limpia su nota de cascada.
    const card = FIELD_CARD[field];
    if (card) setCascade((c) => (c[card] ? { ...c, [card]: "" } : c));
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

  // Estimados de zona (fallback de display cuando el override queda vacío tras
  // invalidar en una cascada de dirección).
  const sugArriendo = data.arriendoSugerido ?? 0;
  const occRef = data.airRoi.ocupacionReferencia;
  const sugTarifa = data.airRoi.ingresoBrutoMensual > 0 && occRef > 0 ? Math.round(data.airRoi.ingresoBrutoMensual / (DIAS_MES * occRef)) : 0;
  const sugOcc = occRef > 0 ? Math.round(occRef * 100) : 0;
  const arriendoVal = parseNum(a.arriendo ?? "") || sugArriendo;
  const tarifaVal = parseNum(a.adrTarifa ?? "") || sugTarifa;
  const occVal = Number(a.adrOcupacion) || sugOcc;

  // POR COMPLETAR (R3): tras cambiar de modalidad, la rama STR exige el gate
  // (sin estimación posible). Bloquea generar hasta responderlo.
  const gatePorCompletar = esStr && !a.edificioPermiteAirbnb;
  const incompleto = gatePorCompletar;

  // Confirmación de dirección nueva → invalidación + nota de cascada. Comuna
  // distinta descarta TODO (estimados y corregidos); misma comuna conserva
  // correcciones y solo refresca comparables.
  const onDireccionConfirm = (d: { direccion: string; comuna: string; ciudad: string; lat: number; lng: number }) => {
    setEditingDir(false);
    const comunaCambio = d.comuna.toLowerCase() !== (a.comuna ?? "").toLowerCase();
    const base = { direccion: d.direccion, direccionConfirmada: d.direccion, comuna: d.comuna, ciudad: d.ciudad, lat: d.lat, lng: d.lng };
    if (comunaCambio) {
      const teniaCorrecciones = a.arrModo === "corregir" || a.adrModo === "corregir" || !!a.gastosComunes || !!a.contribuciones;
      w.patchAnswers({
        ...base,
        arriendo: undefined, arrModo: "estimacion",
        adrTarifa: undefined, adrOcupacion: undefined, adrModo: "estimacion",
        gastosComunes: undefined, contribuciones: undefined,
      });
      const listado = esStr && esLtr ? "arriendo, tarifa y ocupación" : esStr ? "tarifa y ocupación" : "arriendo";
      let msg = `Cambié la zona a ${d.comuna} — re-estimé ${listado} y los supuestos de la zona.`;
      if (teniaCorrecciones) msg += " Tus correcciones anteriores eran de la otra zona, las descarté.";
      setCascade({ "03": msg });
    } else {
      w.patchAnswers(base);
      setCascade({ "03": "Actualicé los comparables para la nueva dirección." });
    }
    setOpenCard("03"); // en mobile, abre la card afectada para que la nota se vea
    trackWizard(posthog, "wizard4_edit_from_summary", { field: "dir", cascada: true });
  };

  const onTipoChange = (nuevo: "usado" | "nuevo") => {
    setEditingTipo(false);
    if (nuevo === a.tipoPropiedad) return;
    const antesSub = calificaSubsidioV4(a);
    w.patchAnswers({ tipoPropiedad: nuevo });
    const despuesSub = calificaSubsidioV4({ ...a, tipoPropiedad: nuevo });
    if (antesSub !== despuesSub) {
      setCascade((c) => ({ ...c, "02": despuesSub ? "Este tipo califica para el subsidio a la tasa — revisá la opción en la tasa." : "Este tipo ya no califica para el subsidio; volví la tasa a mercado." }));
      setOpenCard("02"); // en mobile, abre la card afectada para que la nota se vea
    }
    trackWizard(posthog, "wizard4_edit_from_summary", { field: "tipo", cascada: true });
  };

  const onModalidadChange = (nuevo: "ltr" | "str" | "both") => {
    setEditingMod(false);
    if (nuevo === mod) return;
    w.patchAnswers({ modalidad: nuevo });
    trackWizard(posthog, "wizard4_edit_from_summary", { field: "mod", cascada: true });
  };

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

  const toggleCard = (c: "01" | "02" | "03") => {
    setOpenCard((prev) => (prev === c ? null : c));
    setCascade((prev) => (prev[c] ? { ...prev, [c]: "" } : prev));
  };

  // Nivel 3: emite summary_level_opened solo al ABRIR (dato para futura poda).
  const openL3c01 = (which: "detalle" | "gastos") => {
    setL3c01((v) => { const next = v === which ? null : which; if (next) trackWizard(posthog, "wizard4_summary_level_opened", { card: "01", nivel: 3 }); return next; });
  };
  const openL3 = (which: "sup" | "gest") => {
    setL3((v) => { const next = v === which ? null : which; if (next) trackWizard(posthog, "wizard4_summary_level_opened", { card: "03", nivel: 3 }); return next; });
  };

  // Card al-filo apunta-adentro (R4): abre la card de la 1ª variable sensible y
  // la ilumina ~1.5s.
  const onAlfiloTap = () => {
    const field = FIELD_FOR_VAR[dryRun.variablesSensibles[0]];
    if (!field) return;
    const card = FIELD_CARD[field];
    if (card) { setOpenCard(card); setCascade((c) => (c[card] ? { ...c, [card]: "" } : c)); }
    setHighlight(field);
    window.setTimeout(() => setHighlight(null), 1500);
  };

  // Validador % (0-99, tolera coma para tasa).
  const pctInt = (v: string) => v.replace(/\D/g, "").slice(0, 2);
  const tasaInput = (v: string) => v.replace(/[^\d,]/g, "").slice(0, 5);

  return (
    <div className="pb-44 lg:pb-8">
      {/* Header: chip de informe editable — tap abre el selector de modalidad. */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setEditingMod((o) => !o)}
          aria-expanded={editingMod}
          aria-label={`Informe: ${mod ? LABEL_MOD[mod] : "—"}. Toca para cambiar.`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-signal-red px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--franco-text)]"
        >
          <span className="text-[var(--franco-text-muted)]">Informe:</span>
          <span className="font-medium">{mod ? LABEL_MOD[mod] : "—"}</span>
          <span className="text-signal-red">▾</span>
        </button>
        {editingMod && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["ltr", "str", "both"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModalidadChange(m)}
                className={`font-mono text-[11px] uppercase tracking-[0.06em] px-3 h-9 rounded-lg border-[0.5px] transition-colors ${
                  m === mod ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]" : "border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"
                }`}
              >
                {LABEL_MOD[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* 01 · Qué compras */}
        <ActCard num="01" title="Qué compras" summaryLine={summary01} open={openCard === "01"} onToggle={() => toggleCard("01")}>
          {/* Dirección: editor inline = Places embebido con gate de cobertura. */}
          <FieldShell label="Dirección">
            {editingDir ? (
              <DireccionEdit initial={a.direccion || ""} onConfirm={onDireccionConfirm} onCancel={() => setEditingDir(false)} />
            ) : (
              <EditableDisplay text={a.direccion || "—"} onStart={() => setEditingDir(true)} />
            )}
          </FieldShell>
          <NumField
            label="Precio" raw={fmtMiles(a.precio ?? "")} display={pUF > 0 ? fmtUF(pUF) : "—"} suffix="UF"
            derived={precioCLP} onCommit={(v) => commitEdit("precio", { precio: fmtMiles(v) })}
          />
          <Nivel3 title="Detalle del depto" open={l3c01 === "detalle"} onToggle={() => openL3c01("detalle")}>
            {/* Tipo: estructural → chips inline (muta el detalle + recalcula subsidio). */}
            <FieldShell label="Tipo">
              {editingTipo ? (
                <div className="flex flex-wrap gap-1.5">
                  {(["usado", "nuevo"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => onTipoChange(t)}
                      className={`font-mono text-[12px] px-2.5 h-8 rounded-lg border-[0.5px] transition-colors ${t === a.tipoPropiedad ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]" : "border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"}`}>
                      {t === "nuevo" ? "Nuevo" : "Usado"}
                    </button>
                  ))}
                </div>
              ) : (
                <EditableDisplay text={tipoStr} onStart={() => setEditingTipo(true)} />
              )}
            </FieldShell>
            <StaticField label={a.tipoPropiedad === "nuevo" ? "Entrega" : "Antigüedad"} value={entregaAntig} />
            <StaticField label="Tamaño" value={tamStr} />
            <StaticField label="Estacionamiento y bodega" value={`${nEstac} estac · ${nBodega} bodega`} />
          </Nivel3>
          {/* Gastos del depto: GGCC + contribuciones son del inmueble, no de la
              modalidad → viven acá en las 3 modalidades (taxonomía de v3 "Comunes"). */}
          <Nivel3 title="Gastos del depto" open={l3c01 === "gastos"} onToggle={() => openL3c01("gastos")}>
            <NumField label="Gastos comunes" raw={fmtMiles(a.gastosComunes ?? String(Math.round(ggccDef)))} display={`$${fmtMiles(a.gastosComunes ?? String(Math.round(ggccDef)))}/mes`} suffix="$" tag={a.gastosComunes ? "corregido por ti" : undefined} fuente="gastos comunes típicos de la comuna" onCommit={(v) => commitEdit("gastosComunes", { gastosComunes: fmtMiles(v) })} />
            <NumField label="Contribuciones (trim.)" raw={fmtMiles(a.contribuciones ?? String(Math.round(contribDef)))} display={`$${fmtMiles(a.contribuciones ?? String(Math.round(contribDef)))}`} suffix="$" tag={a.contribuciones ? "corregido por ti" : undefined} fuente="fórmula SII según avalúo estimado" onCommit={(v) => commitEdit("contribuciones", { contribuciones: fmtMiles(v) })} />
          </Nivel3>
        </ActCard>

        {/* 02 · Cómo lo financias */}
        <ActCard num="02" title="Cómo lo financias" summaryLine={summary02} open={openCard === "02"} onToggle={() => toggleCard("02")}>
          {cascade["02"] && <CascadeNote text={cascade["02"]} />}
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
              tag={tasaTag} derived={cuotaStr} highlight={highlight === "tasa"}
              onCommit={(v) => commitEdit("tasa", { tasaModo: "preaprobada", tasaInteres: v })}
            />
          )}
          {calificaSubsidioV4(a) && cuotaStr && <DerivedLine text={cuotaStr} />}
        </ActCard>

        {/* 03 · Cómo lo rentabilizas */}
        <ActCard num="03" title="Cómo lo rentabilizas" summaryLine={summary03} open={openCard === "03"} onToggle={() => toggleCard("03")}>
          {cascade["03"] && <CascadeNote text={cascade["03"]} />}
          {esStr && (
            gatePorCompletar ? (
              // POR COMPLETAR: tras cambiar a una modalidad STR, el gate no tiene
              // estimación posible → hay que responderlo. Bloquea generar.
              <FieldShell label="Edificio permite Airbnb · por completar">
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-signal-red p-1.5">
                  {(["si", "no", "no_seguro"] as const).map((g) => (
                    <button key={g} type="button" onClick={() => commitEdit("gate", { edificioPermiteAirbnb: g })}
                      className="font-mono text-[12px] px-2.5 h-8 rounded-lg border-[0.5px] border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
                      {LABEL_GATE[g]}
                    </button>
                  ))}
                </div>
              </FieldShell>
            ) : (
              <ChipsField
                label="Edificio permite Airbnb" value={a.edificioPermiteAirbnb}
                options={[{ value: "si", label: "Sí permite" }, { value: "no", label: "No permite" }, { value: "no_seguro", label: "No estoy seguro" }]}
                onCommit={(v) => commitEdit("gate", { edificioPermiteAirbnb: v })}
              />
            )
          )}
          {esLtr && (
            <NumField
              label="Arriendo" raw={fmtMiles(a.arriendo ?? String(sugArriendo || ""))} display={arriendoVal > 0 ? `${fmtCLP(arriendoVal)}/mes` : "—"} suffix="$"
              tag={a.arrModo === "corregir" ? "corregido por ti" : "estimado"}
              fuente={fuenteArriendo(data.arriendoN)} highlight={highlight === "arr"}
              onCommit={(v) => commitEdit("arr", { arriendo: fmtMiles(v), arrModo: "corregir" })}
            />
          )}
          {esStr && (
            <>
              <NumField
                label="Tarifa por noche" raw={fmtMiles(a.adrTarifa ?? String(sugTarifa || ""))} display={tarifaVal > 0 ? `${fmtCLP(tarifaVal)}/noche` : "—"} suffix="$"
                tag={a.adrModo === "corregir" ? "corregido por ti" : "estimado"}
                fuente="datos de mercado Airbnb de la zona, últimos 90 días" highlight={highlight === "adr"}
                onCommit={(v) => commitEdit("adr", { adrTarifa: fmtMiles(v), adrModo: "corregir" })}
              />
              <NumField
                label="Ocupación" raw={String(a.adrOcupacion ?? (sugOcc || ""))} display={occVal > 0 ? `${occVal}%` : "—"} suffix="%" format={pctInt}
                tag={a.adrModo === "corregir" ? "corregido por ti" : "estimado"} highlight={highlight === "adr"}
                onCommit={(v) => commitEdit("adr", { adrOcupacion: v, adrModo: "corregir" })}
              />
            </>
          )}

          {esLtr && (
            // En AMBAS el eyebrow "Solo renta larga" desambigua la pertenencia; en
            // LTR puro no hay ambigüedad → título neutro.
            <Nivel3 title={esStr ? "Solo renta larga" : "Supuestos del arriendo"} open={l3 === "sup"} onToggle={() => openL3("sup")}>
              <NumField label="Vacancia" raw={a.vacanciaPct ?? "5"} display={`${a.vacanciaPct ?? "5"}%`} suffix="%" format={pctInt} tag={a.vacanciaPct ? "corregido por ti" : undefined} fuente="promedio de meses sin arrendatario al año" onCommit={(v) => commitEdit("vacanciaPct", { vacanciaPct: v })} />
              <NumField label="Comisión administración" raw={a.comisionAdminPct ?? "0"} display={`${a.comisionAdminPct ?? "0"}%`} suffix="%" format={pctInt} tag={a.comisionAdminPct ? "corregido por ti" : undefined} fuente="0 = autogestión; corredor típico 7-10%" onCommit={(v) => commitEdit("comisionAdminPct", { comisionAdminPct: v })} />
            </Nivel3>
          )}
          {esStr && (
            <Nivel3 title={esLtr ? "Solo renta corta" : "Gestión y costos"} open={l3 === "gest"} onToggle={() => openL3("gest")}>
              <NumField label="Costos operativos" raw={fmtMiles(a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos))} display={`$${fmtMiles(a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos))}/mes`} suffix="$" tag={a.costoInsumos ? "corregido por ti" : undefined} fuente={`consumo operativo típico para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("costoInsumos", { costoInsumos: fmtMiles(v) })} />
              <NumField label="Mantención" raw={fmtMiles(a.mantencionStr ?? String(costos.mantencion))} display={`$${fmtMiles(a.mantencionStr ?? String(costos.mantencion))}/mes`} suffix="$" tag={a.mantencionStr ? "corregido por ti" : undefined} fuente={`provisión mensual de mantención para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("mantencionStr", { mantencionStr: fmtMiles(v) })} />
              <NumField label="Amoblamiento (capex)" raw={fmtMiles(a.costoAmoblamiento ?? String(costos.costoAmoblamiento))} display={`$${fmtMiles(a.costoAmoblamiento ?? String(costos.costoAmoblamiento))}`} suffix="$" tag={a.costoAmoblamiento ? "corregido por ti" : undefined} fuente="capex inicial estimado si el depto no está amoblado" onCommit={(v) => commitEdit("costoAmoblamiento", { costoAmoblamiento: fmtMiles(v) })} />
            </Nivel3>
          )}
        </ActCard>
      </div>

      {alFilo && (
        <button type="button" onClick={onAlfiloTap} className="mt-4 lg:hidden w-full text-left rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</p>
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">Una diferencia pequeña cambia el veredicto. Tócalo para ir directo a revisarlo.</p>
        </button>
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
            <button type="button" onClick={onAlfiloTap} className="h-full w-full text-left rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</p>
              <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">Una diferencia pequeña cambia el veredicto. Tócalo para ir directo a revisarlo.</p>
            </button>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-end gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} incompleto={incompleto} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{incompleto ? "Completa la card 03 para generar." : ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
        </div>
      </div>

      {/* Mobile: CTA sticky. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-bg)_92%,transparent)] backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-stretch gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} canAnalyze={canAnalyze} submitting={submitting} incompleto={incompleto} onGenerar={onGenerar} onDesbloquear={onDesbloquear} onTerminal={onTerminal} />
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{incompleto ? "Completa la card 03 para generar." : ctaCaveat(isLoggedIn, canAnalyze, mod, a.comuna)}</p>
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

function FinalCTA({ mod, isLoggedIn, canAnalyze, submitting, incompleto, onGenerar, onDesbloquear, onTerminal }: { mod: string | undefined; isLoggedIn: boolean; canAnalyze: boolean; submitting: boolean; incompleto: boolean; onGenerar: () => void; onDesbloquear: () => void; onTerminal: () => void }) {
  const cls = "font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed";
  if (canAnalyze) {
    return <button type="button" onClick={onGenerar} disabled={submitting || incompleto} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar análisis · 1 crédito</>}</button>;
  }
  if (isLoggedIn) {
    return <button type="button" onClick={onDesbloquear} disabled={submitting || incompleto} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</> : <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>}</button>;
  }
  if (incompleto) {
    return <span className={`${cls} opacity-60 cursor-not-allowed`}>Crear cuenta gratis <ArrowRight size={14} /></span>;
  }
  return <Link href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`} onClick={onTerminal} className={cls}>Crear cuenta gratis <ArrowRight size={14} /></Link>;
}
