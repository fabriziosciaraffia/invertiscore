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
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import type { useWizardV4 } from "./useWizardV4";
import type { WizardV4Answers, Antiguedad } from "./wizardV4Nodes";
import { DEC, PIE_RAZON_OPCIONES } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { canAnalyzeFromTier, type TierInfo } from "./useWizardV4Tier";
import { buildLtrPayload, buildStrPayload, comprarLocked, submitAnonimo, submitConCredito, type SubmitContext, type SubmitResult } from "./wizardV4Submit";
import { obtenerTokenTurnstile } from "./turnstile";
import {
  evaluarPlausibilidad,
  desdeBodyLtr,
  desdeBodyStr,
  formatearNumero,
  formatearPct,
  type Anomalia,
  type Regla,
} from "@/lib/plausibilidad";
import {
  escalaArriendo,
  escalaComision,
  escalaOcupacion,
  escalaPie,
  escalaPrecio,
  escalaSuperficie,
  escalaTarifa,
  escalaTasa,
  escalaVacancia,
  type AvisoEscala,
} from "./avisoEscala";
import { ModalPlausibilidad, type OrigenCampo } from "./ModalPlausibilidad";
import { dormLabel, esEdicionReal, fmtCLP, fmtUF, fuenteArriendoLine, leerNum, procedenciaArriendoCorta, superficieM2, cuotaCLP, piePct, pieTexto, pieUF, precioUF } from "./derive";
import { decimalesUtiles, ecoPorDefecto, estadoNumericInput } from "./NumericInput";
import { formatNumeroCL, parseNumeroCL, type Decimales } from "@/lib/numero-cl";
import { calificaSubsidioV4, subsidioAplicadoV4, tasaConSubsidioV4 } from "./wizardV4Subsidio";
import { useWizardV4DryRun } from "./useWizardV4DryRun";
import { trackWizard } from "./track";
import { reportarValidacionRechazo } from "./stepTelemetry";
import { estamparSubmit } from "@/lib/informe-visto";

/**
 * Variante del gate de auth que ve el anónimo al llegar al resumen. Viaja como
 * propiedad de `wizard4_gate_auth_shown` para poder comparar conversión entre
 * variantes SIN inventar eventos nuevos (el funnel gate→signup sigue siendo el
 * mismo, solo se parte por esta propiedad).
 *
 * Historia: `"muro"` fue el baseline (CTA de registro sin entregar nada). Con
 * el cap anónimo (F2-2) el anónimo ya no choca un muro:
 *  · `"anonimo_cap"` — cap disponible: el CTA es "Generar mi análisis gratis".
 *  · `"anonimo_cap_consumido"` — segundo intento: muro de registro.
 */
export function gateVariant(anonCap: boolean): string {
  return anonCap ? "anonimo_cap" : "anonimo_cap_consumido";
}

const LABEL_MOD: Record<string, string> = { ltr: "Renta larga", str: "Renta corta", both: "Comparativo" };
const LABEL_GATE: Record<string, string> = { si: "Sí permite", no: "No permite", no_seguro: "No estoy seguro" };

type Wizard = ReturnType<typeof useWizardV4>;

/**
 * Valor guardado → texto del display EN REPOSO. Fuente única del formato de la
 * card, para que no vuelva a pasar lo de la tasa: el eco mostraba "= 4,72%" y la
 * card, debajo, "4.72%" — el texto crudo tal cual se tipeó, sin formatear.
 *
 * El `decimales` del campo se usa para PARSEAR (define qué es legible ahí), pero
 * NO para formatear: la card muestra los decimales que el valor realmente tiene.
 * Con decimales fijos, una vacancia por defecto de 5 se leía "5,0%" y una
 * comisión en 0 "0,0%" — un decimal colgando en dos valores que el usuario nunca
 * tocó. `decimalesUtiles` deja "5%" y "0%", y sigue mostrando "4,72%" y "4,5%"
 * cuando el decimal existe de verdad. Mismo criterio que el eco.
 */
function displayNum(
  raw: string | undefined,
  decimales: Decimales,
  envolver: (txt: string) => string,
  vacio = "—",
): string {
  const v = parseNumeroCL(raw ?? "", decimales);
  return v === null ? vacio : envolver(formatNumeroCL(v, decimalesUtiles(v)));
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
  entrega: "01", antiguedad: "01", tam: "01", estac: "01", bodega: "01",
  pie: "02", plazo: "02", tasa: "02",
  gate: "03", arr: "03", adr: "03",
  vacanciaPct: "03", comisionAdminPct: "03",
  costoInsumos: "03", mantencionStr: "03", costoAmoblamiento: "03",
};

// ── Modal de plausibilidad: de qué campos puede venir cada regla ─────────────
// El guard NO sabe cuál está mal (en uf_m2 puede ser el precio o la superficie),
// así que el modal ofrece TODOS los involucrados y solo marca el más probable.
const ORIGENES_POR_REGLA: Record<Regla, string[]> = {
  uf_m2_fuera_rango: ["precio", "superficie"],
  precio_total_fuera_rango: ["precio"],
  superficie_fuera_rango: ["superficie"],
  yield_imposible: ["precio", "arriendo"],
  str_yield_imposible: ["precio", "tarifa", "ocupacion"],
  arriendo_fuera_rango: ["arriendo"],
  tasa_fuera_rango: ["tasa"],
  pie_fuera_rango: ["pie"],
  pie_ausente: ["pie"],
  pie_cero_sin_razon: ["pie"],
  str_ocupacion_fuera_rango: ["ocupacion"],
  str_tarifa_fuera_rango: ["tarifa"],
  vacancia_fuera_rango: ["vacancia"],
  comision_admin_fuera_rango: ["comisionAdmin"],
};

/** `campo` de la anomalía principal → clave de origen (la sospecha marcada). */
const CAMPO_A_ORIGEN: Record<Anomalia["campo"], string> = {
  precio: "precio", superficie: "superficie", arriendo: "arriendo",
  tasa: "tasa", pie: "pie", ocupacion: "ocupacion", tarifaNoche: "tarifa",
  vacancia: "vacancia", comisionAdmin: "comisionAdmin",
};

/** Origen → campo del resumen (para reusar el ring de onAlfiloTap y FIELD_CARD). */
const ORIGEN_A_FIELD: Record<string, string> = {
  precio: "precio", superficie: "tam", arriendo: "arr", tasa: "tasa",
  pie: "pie", tarifa: "adr", ocupacion: "adr",
  vacancia: "vacanciaPct", comisionAdmin: "comisionAdminPct",
};

const LABEL_ORIGEN: Record<string, string> = {
  precio: "Precio", superficie: "Superficie", arriendo: "Arriendo",
  tasa: "Tasa", pie: "Pie", tarifa: "Tarifa", ocupacion: "Ocupación",
  vacancia: "Vacancia", comisionAdmin: "Comisión administración",
};

// ── Envoltorio de campo (label + valor/editor + tag + fuente) ────────────────

function FieldShell({ label, children, fuente, showFuente }: { label: string; children: ReactNode; fuente?: string; showFuente?: boolean }) {
  return (
    <div className="py-1 border-b border-dashed border-[var(--franco-border)] last:border-b-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--franco-text-muted)] m-0 mb-0.5">{label}</p>
      {children}
      {/* R7: la fuente/procedencia aparece SOLO con el editor abierto, no en reposo.
          Los tags (· estimado / · corregido) sí quedan siempre visibles. */}
      {fuente && showFuente && <p className="font-mono text-[10px] text-[var(--franco-text-muted)] m-0 mt-1 leading-snug">{fuente}</p>}
    </div>
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

/** Subtítulo de agrupación por pertenencia dentro de una card (solo AMBAS). */
function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--franco-text-tertiary)] m-0 mt-2 mb-0.5 first:mt-0">{children}</p>;
}

const ANTIGUEDADES: Array<{ value: Antiguedad; label: string }> = [
  { value: "0-2", label: "0–2 años" }, { value: "3-5", label: "3–5 años" }, { value: "6-10", label: "6–10 años" }, { value: "11-20", label: "11–20 años" }, { value: "20+", label: "20+ años" },
];

const chipCls = (active: boolean) =>
  `font-mono text-[12px] px-2.5 h-8 rounded-lg border-[0.5px] transition-colors ${active ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]" : "border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]"}`;

/** Editor compuesto de tamaño: superficie + dormitorios + baños. Los sub-campos
 *  patchean en vivo; "Listo" cierra y emite el commit. */
function TamanoField({ a, patch, onCommit }: { a: WizardV4Answers; patch: (p: Partial<WizardV4Answers>) => void; onCommit: () => void }) {
  const [editing, setEditing] = useState(false);
  const sup = superficieM2(a);
  const supEstado = estadoNumericInput(a.superficieUtil ?? "", {
    decimales: DEC.superficie,
    blurred: true,
    formatEco: ecoPorDefecto("", " m²"),
    escala: escalaSuperficie,
  });
  const supTxt = displayNum(a.superficieUtil, DEC.superficie, (t) => `${t} m²`);
  const display = sup > 0 ? `${supTxt} · ${a.esStudio ? "Studio" : (a.dormitorios ?? "—") + "D"} · ${a.banos ?? "—"}B` : "—";
  return (
    <FieldShell label="Tamaño">
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Sin filtro: se acepta lo tipeado y el eco de abajo dice cómo se
                entendió. Misma precisión que el Acto 1 (DEC.superficie). */}
            <input autoFocus value={a.superficieUtil ?? ""} inputMode="decimal"
              aria-invalid={supEstado.estado === "error"}
              onChange={(e) => patch({ superficieUtil: e.target.value })}
              className="w-[90px] h-9 rounded-lg border-[1.5px] border-signal-red bg-[var(--franco-card)] px-2 font-mono text-[14px] text-[var(--franco-text)] focus:outline-none" />
            <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">m²</span>
          </div>
          {supEstado.estado === "error" && (
            <p className="font-body text-[11px] text-signal-red m-0 leading-snug">No se entiende — {supEstado.motivo}</p>
          )}
          {(supEstado.estado === "ok" || supEstado.estado === "escala") && (
            <p className="font-mono text-[11px] text-[var(--franco-text-secondary)] m-0">= {supEstado.eco}</p>
          )}
          {supEstado.estado === "escala" && <AvisoEscala texto={supEstado.aviso} />}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => patch({ esStudio: true, dormitorios: "0" })} className={chipCls(!!a.esStudio)}>Studio</button>
            {["1", "2", "3", "4"].map((d) => <button key={d} type="button" onClick={() => patch({ esStudio: false, dormitorios: d })} className={chipCls(!a.esStudio && a.dormitorios === d)}>{d === "4" ? "4+" : d}D</button>)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["1", "2", "3"].map((b) => <button key={b} type="button" onClick={() => patch({ banos: b })} className={chipCls(a.banos === b)}>{b}B</button>)}
          </div>
          <button type="button" onClick={() => { setEditing(false); onCommit(); }} className="self-start font-mono text-[11px] uppercase tracking-[0.08em] text-signal-red mt-1">✓ Listo</button>
        </div>
      ) : (
        <EditableDisplay text={display} onStart={() => setEditing(true)} />
      )}
    </FieldShell>
  );
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

/**
 * Input inline con commit en blur/Enter, cancel en Escape.
 *
 * El chrome es el compacto del resumen; la CONDUCTA es la misma de
 * `NumericInput` — mismas funciones puras, misma precisión por campo. Antes cada
 * campo traía su propio filtro y por eso la ocupación daba 625 en el Acto 3 y 62
 * acá; ahora los dos leen con el `decimales` que declara `DEC`.
 *
 * Lo escrito se commitea TAL CUAL, aunque no se pueda leer: borrárselo al salir
 * sería la misma desaparición silenciosa que el componente viene a matar. Si
 * queda ilegible, `NumField` lo marca en reposo.
 */
function InlineInput({
  initial,
  decimales,
  formatEco,
  escala,
  fuente,
  suffix,
  onCommit,
  onCancel,
}: {
  initial: string;
  decimales: Decimales;
  formatEco: (valor: number) => string;
  escala?: (valor: number) => AvisoEscala | null;
  /**
   * Microcopy de ayuda del campo. Se renderiza ACÁ y no en `FieldShell` porque
   * el estado en vivo solo se conoce en este componente, y la ayuda tiene que
   * desaparecer cuando hay error (ver abajo).
   */
  fuente?: string;
  suffix?: string;
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

  const r = estadoNumericInput(v, { decimales, blurred: false, formatEco, escala });
  const hayError = r.estado === "error";

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="relative inline-flex items-center">
        <input
          ref={ref}
          value={v}
          inputMode={decimales === 0 ? "numeric" : "decimal"}
          aria-invalid={hayError}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => commit(v)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(v); }
            else if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          className={`w-[130px] h-9 rounded-lg border-[1.5px] border-signal-red bg-[var(--franco-card)] px-2 font-mono text-[14px] text-[var(--franco-text)] focus:outline-none ${suffix ? "pr-8" : ""}`}
        />
        {suffix && <span className="absolute right-2 font-mono text-[11px] text-[var(--franco-text-muted)] pointer-events-none">{suffix}</span>}
      </span>
      {/* Eco en vivo, igual que en las pantallas del wizard. */}
      {r.estado === "encurso" && (
        <span className="font-body text-[11px] italic text-[var(--franco-text-muted)]">Seguí escribiendo…</span>
      )}
      {r.estado === "error" && (
        <span className="font-body text-[11px] text-signal-red leading-snug">No se entiende — {r.motivo}</span>
      )}
      {(r.estado === "ok" || r.estado === "escala") && (
        <span className="font-mono text-[11px] text-[var(--franco-text-secondary)]">= {r.eco}</span>
      )}
      {r.estado === "escala" && <AvisoEscala texto={r.aviso} />}
      {/* La ayuda del campo se apaga SOLO con error: ahí el mensaje rojo ya dice
          qué pasa y qué hacer, y dejar debajo el microcopy normal obliga a leer
          dos líneas para entender una sola situación.
          Con "escala" SÍ se muestra: el número se entendió y la ayuda sigue
          siendo pertinente — es un aviso de magnitud, no un error de lectura. */}
      {fuente && r.estado !== "error" && (
        <span className="font-mono text-[10px] text-[var(--franco-text-muted)] leading-snug">{fuente}</span>
      )}
    </span>
  );
}

/**
 * Aviso de magnitud. Ink + label uppercase + borde lateral — el reemplazo que el
 * design system define para el ámbar de alerta. NUNCA rojo: el rojo dice "no te
 * entendí" y esto dice "te entendí y es imposible"; si los dos fueran rojos el
 * usuario no podría distinguir qué le toca hacer.
 */
function AvisoEscala({ texto }: { texto: string }) {
  return (
    <span
      className="block mt-1 border-l-2 border-[var(--franco-border-strong)] rounded-r-lg pl-2.5 pr-2 py-1.5"
      style={{ background: "color-mix(in srgb, var(--franco-text) 3.5%, transparent)" }}
    >
      <span className="block font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--franco-text-tertiary)] mb-0.5">
        Fuera de escala
      </span>
      <span className="block font-body text-[11px] text-[var(--franco-text-secondary)] leading-snug">{texto}</span>
    </span>
  );
}

/**
 * Campo numérico editable (precio/arriendo/tarifa/occ/supuestos).
 *
 * `raw` es el texto TAL COMO está guardado; `decimales` sale de `DEC` y es el
 * mismo que usa la pantalla del acto. En reposo muestra `display`; si lo
 * guardado no se puede leer, lo dice ahí mismo en vez de mostrar un "—" mudo.
 */
function NumField({
  label,
  raw,
  display,
  suffix,
  decimales,
  formatEco,
  escala,
  tag,
  fuente,
  procedencia,
  derived,
  highlight,
  commitCeroDesdeVacio,
  onCommit,
}: {
  label: string;
  raw: string;
  display: string;
  suffix: string;
  decimales: Decimales;
  formatEco?: (valor: number) => string;
  /** Aviso de magnitud. Los umbrales y el copy los pone el guard, no este campo. */
  escala?: (valor: number) => AvisoEscala | null;
  tag?: string;
  fuente?: string;
  /**
   * Procedencia comprimida, visible EN REPOSO. Excepción acotada a R7 — hoy solo
   * el arriendo la pasa. El criterio para sumar otro campo está en
   * `procedenciaArriendoCorta`; no agregues uno sin leerlo.
   */
  procedencia?: string;
  derived?: string;
  /** Anillo Signal Red transitorio cuando la card al-filo apunta a este campo. */
  highlight?: boolean;
  /**
   * Fix pie-cero: tratar lo escrito sobre un campo VACÍO como edición real
   * aunque `esEdicionReal` lea el mismo valor ("" y "0" son ambos 0 vía
   * `leerNum`). Para el pie, escribir "0" sobre el vacío ES la declaración —
   * sin esto, un draft sin pie no podía declarar el 0 desde el resumen. Solo el
   * pie lo pasa; el resto conserva el contrato "mirar no es editar".
   */
  commitCeroDesdeVacio?: boolean;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const eco = formatEco ?? ecoPorDefecto();
  const enReposo = estadoNumericInput(raw, { decimales, blurred: true, formatEco: eco, escala });

  return (
    <div className={highlight ? "rounded-lg -mx-1 px-1 ring-2 ring-signal-red transition-shadow duration-300" : ""}>
    {/* `fuente` NO va a FieldShell: la baja `InlineInput`, que es quien sabe si
        el texto en vivo se entiende. Sale igual que antes —solo con el editor
        abierto—, menos cuando hay error. */}
    <FieldShell label={label}>
      {editing ? (
        <InlineInput
          initial={raw}
          suffix={suffix}
          decimales={decimales}
          formatEco={eco}
          escala={escala}
          fuente={fuente}
          onCommit={(v) => {
            setEditing(false);
            // Salir del campo no es corregirlo. Ver `esEdicionReal`: el commit
            // solo se propaga si el valor cambió, y con eso quedan cubiertos de
            // una sola vez el tag, el evento de PostHog, la nota de cascada y
            // los patches que fuerzan modo "corregir" en el callsite.
            //
            // Ortogonal al aviso de escala: ese lo calcula `estadoNumericInput`
            // a partir del VALOR —en vivo desde `v`, en reposo desde `raw`—, no
            // del commit. Si el número no cambió, el aviso que corresponda ya se
            // estaba mostrando y sigue mostrándose.
            if (esEdicionReal(v, raw, decimales) || (commitCeroDesdeVacio && raw.trim() === "" && v.trim() !== "")) onCommit(v);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <EditableDisplay text={display} tag={tag} onStart={() => setEditing(true)} />
          {enReposo.estado === "error" && (
            <p className="font-body text-[11px] text-signal-red m-0 mt-0.5 leading-snug">
              No se entiende ese número — {enReposo.motivo}
            </p>
          )}
          {/* En reposo el aviso también se ve: si el valor quedó fuera de escala,
              esconderlo hasta que vuelvan a abrir el editor no ayuda a nadie. */}
          {enReposo.estado === "escala" && <AvisoEscala texto={enReposo.aviso} />}
          {/* Y debajo la procedencia, si el campo la declara. Primero la alerta,
              después el contexto: el aviso de escala pide una acción, la
              procedencia solo explica de dónde salió el número. */}
          {procedencia && (
            <p className="font-mono text-[10px] text-[var(--franco-text-muted)] m-0 mt-0.5 leading-snug">
              {procedencia}
            </p>
          )}
        </>
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
    <FieldShell label={label} fuente={fuente} showFuente={editing}>
      {editing ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              // Reelegir el chip que ya estaba puesto tampoco es corregir.
              onClick={() => { setEditing(false); if (o.value !== value) onCommit(o.value); }}
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
        className="lg:pointer-events-none w-full text-left px-4 py-2.5 flex items-start justify-between gap-3"
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
      <div className={`${open ? "block" : "hidden"} lg:block px-4 pb-2`}>{children}</div>
    </section>
  );
}

export function ResumenScreen({ w, data, tier, isLoggedIn, onTerminal }: { w: Wizard; data: WizardV4Data; tier: TierInfo | null; isLoggedIn: boolean; onTerminal: () => void }) {
  const posthog = usePostHog();
  const a = w.nav.answers;
  const mod = a.modalidad;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Anomalías del guard de plausibilidad (422), COMPLETAS y ya ordenadas por
  // prioridad desde el server. Hoy la caja de error pinta la primera; PIEZA B
  // las consume todas en el modal compartido sin tocar esta propagación.
  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  // Huella de los inputs dominantes al momento del rechazo. Mientras no cambie,
  // el CTA queda deshabilitado y el modal NO reaparece: interrumpe una vez, la
  // línea inline se queda de recordatorio. Si el usuario edita, la huella cambia
  // → se rehabilita y el modal puede volver si sigue fuera de rango.
  const [huellaBloqueada, setHuellaBloqueada] = useState<string | null>(null);

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
  // Cap anónimo (F2-2): ¿este navegador todavía puede generar su análisis
  // gratis sin registro? Señal de UX (/api/me/tier lee la cookie httpOnly);
  // el enforcement real es server-side en las rutas de creación.
  const anonCap = !isLoggedIn && tier?.anonCapAvailable === true;
  const ctx: SubmitContext = {
    ufCLP: data.ufCLP,
    tasaMercado: data.tasaMercado,
    arriendoSugerido: data.arriendoSugerido,
    arriendoN: data.arriendoN,
    precioM2UF: data.precioM2UF,
    radiusUsed: data.radiusUsed,
    ggccSugerido: data.ggccSugerido,
  };

  // Gate mostrado: UN disparo por montaje del resumen y por tipo de gate.
  //
  // El momento ya era el correcto —`ResumenScreen` solo se monta en el nodo
  // `resumen`, así que el evento marca la llegada real, no el mount del wizard
  // (verificado en PostHog: 276/276 con `step_viewed node='resumen'` previo,
  // mediana de 147 s desde el primer paso). Lo que estaba mal era el CONTEO: las
  // deps re-disparaban con cada cambio de modalidad inline y con cada cambio de
  // identidad de `tier` — 330 eventos para 277 usuarios en 30 días, hasta 7 por
  // persona. El funnel por usuario único lo aguantaba; cualquier métrica por
  // conteo de eventos, no. El ref lo cierra sin tocar el momento del disparo.
  const gateEmitido = useRef<{ auth?: boolean; credits?: boolean }>({});
  useEffect(() => {
    if (tier == null || !mod) return;
    if (!isLoggedIn) {
      if (gateEmitido.current.auth) return;
      gateEmitido.current.auth = true;
      trackWizard(posthog, "wizard4_gate_auth_shown", { modalidad: mod, gate_variant: gateVariant(anonCap) });
    } else if (!canAnalyze) {
      if (gateEmitido.current.credits) return;
      gateEmitido.current.credits = true;
      trackWizard(posthog, "wizard4_gate_credits_shown", { modalidad: mod });
    }
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
  // Fase 5b (mockup 5f7c4f9): el 0 es un dato DECLARADO, no un vacío. "—" queda
  // solo para el pie realmente ausente (campo sin tocar).
  const pieDeclarado = (a.pieMonto ?? "").trim() !== "";
  const pieStr = pct > 0
    ? `${Math.round(pct)}% · ${fmtUF(pieUF(a, data.ufCLP))}`
    : pieDeclarado
      ? "0% · financias el 100%"
      : "—";
  const cuota = cuotaCLP(a, data.ufCLP);
  const cuotaStr = cuota > 0 ? `Cuota ≈ ${fmtCLP(cuota)}/mes · calculada` : undefined;
  const sup = superficieM2(a);

  const conSubsidio = subsidioAplicadoV4(a, data.tasaMercado);
  const tasaTag = conSubsidio ? "con subsidio" : a.tasaModo === "preaprobada" ? "corregido por ti" : a.tasaModo === "estimada" ? "estimado" : undefined;

  // Detalle del depto (nivel 3 · card 01).
  const tipoStr = a.tipoPropiedad === "nuevo" ? "Nuevo" : a.tipoPropiedad === "usado" ? "Usado" : "—";

  // Supuestos (nivel 3 · card 03).
  const ggccDef = data.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
  const contribDef = estimarContribuciones(pUF * data.ufCLP, a.tipoPropiedad === "nuevo");
  const dorm = Number(a.dormitorios) || 2;
  const costos = getCostosDefault(dorm, "basico");

  // Procedencia del arriendo. Son TRES situaciones, no dos: Franco lo estimó, el
  // usuario cambió esa estimación, o nunca hubo estimación que cambiar. La tercera
  // existe desde que se retiraron los niveles de relleno (2026-08-04): sin
  // comparables cerca, el número lo puso el usuario porque no había alternativa —
  // no porque haya corregido nada.
  const arriendoSinDato = data.arriendoFuente === "sin-dato" || data.arriendoN <= 0;
  const arriendoCorregido = !arriendoSinDato && a.arrModo === "corregir";
  const arriendoTag = arriendoSinDato
    ? "lo pusiste tú"
    : arriendoCorregido
      ? "corregido por ti"
      : "estimado";

  const esLtr = mod === "ltr" || mod === "both";
  const esStr = mod === "str" || mod === "both";

  // Estimados de zona (fallback de display cuando el override queda vacío tras
  // invalidar en una cascada de dirección).
  const sugArriendo = data.arriendoSugerido ?? 0;
  const occRef = data.airRoi.ocupacionReferencia;
  const sugTarifa = data.airRoi.ingresoBrutoMensual > 0 && occRef > 0 ? Math.round(data.airRoi.ingresoBrutoMensual / (DIAS_MES * occRef)) : 0;
  const sugOcc = occRef > 0 ? Math.round(occRef * 100) : 0;
  const arriendoVal = leerNum(a.arriendo, DEC.arriendo) || sugArriendo;
  const tarifaVal = leerNum(a.adrTarifa, DEC.tarifa) || sugTarifa;
  const occVal = leerNum(a.adrOcupacion, DEC.ocupacion) || sugOcc;

  // POR COMPLETAR (R3): tras cambiar de modalidad, la rama STR exige el gate
  // (sin estimación posible). Bloquea generar hasta responderlo.
  const gatePorCompletar = esStr && !a.edificioPermiteAirbnb;
  // Fix pie-cero: el pie tiene que estar DECLARADO para generar — monto escrito,
  // y si es exactamente 0, con su razón. Cubre el agujero del resumen: acá se
  // puede vaciar el pie editándolo (o llegar con un draft viejo sin pie), y sin
  // este gate el submit salía con piePct 0 silencioso.
  const pieIncompleto = !pieDeclarado || (pct === 0 && !a.pieRazon);
  const incompleto = gatePorCompletar || pieIncompleto;
  // Rechazo por pie incompleto (I-1): el CTA queda bloqueado con la línea de
  // aviso. Un disparo por ENTRADA al estado, no por render.
  const pieIncompletoPrevio = useRef(false);
  useEffect(() => {
    if (pieIncompleto && !pieIncompletoPrevio.current) {
      reportarValidacionRechazo(posthog, "pie_incompleto", "resumen");
    }
    pieIncompletoPrevio.current = pieIncompleto;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieIncompleto]);
  const lineaIncompleto = gatePorCompletar
    ? "Completa la card 03 para generar."
    : pieIncompleto
      ? "Falta el pie — complétalo en la card 02 para generar."
      : null;

  // ── Datos del modal de plausibilidad ──────────────────────────────────────
  const huellaActual = [a.precio, a.superficieUtil, a.arriendo, a.tasaInteres, a.adrTarifa, a.adrOcupacion].join("|");
  // Rechazado y sin editar nada desde entonces → CTA bloqueado, sin reabrir modal.
  const bloqueadoPorAnomalia = huellaBloqueada !== null && huellaBloqueada === huellaActual;

  const valorOrigen: Record<string, string> = {
    precio: pUF > 0 ? fmtUF(pUF) : "—",
    superficie: sup > 0 ? `${a.superficieUtil} m²` : "—",
    arriendo: arriendoVal > 0 ? fmtCLP(arriendoVal) : "—",
    tasa: a.tasaInteres ? `${a.tasaInteres}%` : "—",
    tarifa: tarifaVal > 0 ? fmtCLP(tarifaVal) : "—",
    ocupacion: occVal > 0 ? `${occVal}%` : "—",
    vacancia: `${a.vacanciaPct ?? "5"}%`,
    comisionAdmin: `${a.comisionAdminPct ?? "0"}%`,
  };
  // Unión de los orígenes de TODAS las anomalías, sin repetir y en orden de
  // prioridad (el server ya ordenó las anomalías).
  const sospechoso = anomalias[0] ? CAMPO_A_ORIGEN[anomalias[0].campo] : null;
  const origenes: OrigenCampo[] = [];
  for (const an of anomalias) {
    for (const o of ORIGENES_POR_REGLA[an.regla] ?? []) {
      if (origenes.some((x) => x.key === o)) continue;
      origenes.push({ key: o, label: LABEL_ORIGEN[o] ?? o, valor: valorOrigen[o] ?? "—", sospechoso: o === sospechoso });
    }
  }

  // Los 4 DERIVADOS del estado limpio. Nunca repiten lo que el usuario tipeó:
  // son los números que no vio en ninguna pantalla y que delatan un error de
  // magnitud aunque no llegue al umbral del guard.
  const ufM2 = pUF > 0 && sup > 0 ? pUF / sup : 0;
  // En AMBAS el retorno mostrado es el de RENTA LARGA: es el único que sale de
  // un valor que el usuario tipeó (el arriendo) contra el precio. El de renta
  // corta se apoya en la estimación de AirROI, que no es input suyo — confirmarle
  // un número que no puso sería confirmarle otra cosa.
  const retornoBruto = pUF > 0 && data.ufCLP > 0 && arriendoVal > 0
    ? (arriendoVal * 12) / (pUF * data.ufCLP)
    : 0;
  // Formateo con los helpers del MÓDULO, no propios: tener dos era el motivo de
  // que el mismo valor saliera "106667" acá y "106.667" en el estado anomalía, y
  // de que un retorno de 0,004% se mostrara como "0,0%" perdiendo la información.
  const derivadosResumen = [
    { label: "Precio", valor: ufM2 > 0 ? `${formatearNumero(ufM2)} UF/m²` : "—" },
    { label: "Dividendo", valor: cuota > 0 ? `${fmtCLP(cuota)}/mes` : "—" },
    // Fase 5b: pie 0 declarado muestra $0 (dato), no "—" (ausencia).
    { label: "Pie", valor: pct > 0 ? fmtCLP(pieUF(a, data.ufCLP) * data.ufCLP) : pieDeclarado ? fmtCLP(0) : "—" },
    {
      label: esLtr ? "Retorno bruto" : "Retorno bruto LTR",
      valor: retornoBruto > 0 ? `${formatearPct(retornoBruto)} anual` : "—",
    },
  ];
  const consumo = lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna);

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

  /**
   * Fallo de submit, compartido por los DOS caminos (crédito y compra locked).
   * Guarda el array COMPLETO de anomalías en estado — no el primer mensaje
   * aplanado — porque el modal compartido de PIEZA B las va a necesitar todas.
   * Lo único que cambia entonces es dónde se pinta, no cómo llegan.
   */
  function manejarFallo(res: SubmitResult, fallback: string) {
    if (res.anomalias?.length) {
      trackWizard(posthog, "wizard4_input_implausible", {
        modalidad: mod,
        reglas: res.anomalias.map((x) => x.regla),
      });
    }
    setAnomalias(res.anomalias ?? []);
    // `error` puede ser un id de máquina (`input_implausible`): nunca se muestra
    // crudo. Con anomalías la caja usa el mensaje en tuteo; sin ellas, el fallback.
    setError(res.error && res.error !== "input_implausible" ? res.error : fallback);
    setSubmitting(false);
  }

  /** CTA del resumen: abre el modal de confirmación. NO dispara el POST todavía. */
  /**
   * Chequeo de plausibilidad EN EL CLIENTE, con el mismo módulo puro que corre
   * el server (sin red, sin DB) y sobre los MISMOS payloads que se van a enviar.
   * No duplica el punto de verdad: es el mismo archivo. El 422 sigue siendo la
   * autoridad y el fallback — esto solo evita pedirle al usuario que confirme un
   * imposible antes de avisarle que es imposible.
   */
  function anomaliasLocales(): Anomalia[] {
    const uf = data.ufCLP;
    if (!(uf > 0) || !mod) return [];
    try {
      if (mod === "str") return evaluarPlausibilidad(desdeBodyStr(buildStrPayload(a, ctx), uf));
      const ltr = desdeBodyLtr(buildLtrPayload(a, ctx), uf);
      if (mod === "ltr") return evaluarPlausibilidad(ltr);
      // AMBAS: precio/superficie son compartidos y la rama STR solo aporta sus
      // overrides — misma composición que /api/analisis/locked.
      return evaluarPlausibilidad({ ...ltr, str: desdeBodyStr(buildStrPayload(a, ctx), uf).str });
    } catch {
      return []; // fail-open: si algo falla acá, el server igual valida.
    }
  }

  function abrirConfirmacion() {
    // Blur del input activo ANTES de abrir. En iOS el teclado virtual se queda
    // arriba y el modal nace aplastado contra el borde superior; es el detalle
    // que más rompe en mobile y el que más se olvida.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // El modal NACE en el estado correcto. Sin esto abría en estado limpio —
    // "Confirma antes de generar", barra en Ink, tono tranquilo— mostrando
    // 106.667 UF/m² como si fuera normal, y la alerta recién aparecía DESPUÉS
    // de que el usuario confirmara. Le pedíamos confirmar un imposible.
    const locales = anomaliasLocales();
    setError(locales.length ? locales[0].mensaje : "");
    setAnomalias(locales);
    setModalAbierto(true);
    if (locales.length) {
      // Mismo bloqueo que tras un 422: el CTA queda inhabilitado hasta que el
      // usuario edite algo, así cerrar y volver a presionar no es un loop.
      setHuellaBloqueada(huellaActual);
      trackWizard(posthog, "wizard4_input_implausible", {
        modalidad: mod, reglas: locales.map((x) => x.regla), origen: "cliente",
      });
    } else {
      trackWizard(posthog, "wizard4_confirm_shown", {
        modalidad: mod,
        camino: !isLoggedIn ? "anonimo" : canAnalyze ? "credito" : "compra",
      });
    }
  }

  /** Primario del modal: recién acá sale el POST. */
  async function confirmarYEnviar() {
    setError(""); setAnomalias([]); setSubmitting(true); onTerminal();
    // Tres caminos: anónimo con cap (F2-2) → genera gratis sin sesión;
    // logueado con saldo → crédito; logueado sin saldo → compra locked.
    const esAnonimo = !isLoggedIn;
    const esCredito = !esAnonimo && canAnalyze;
    trackWizard(
      posthog,
      esAnonimo || esCredito ? "wizard4_submitted" : "wizard4_checkout_initiated",
      { modalidad: mod, ...(esAnonimo ? { camino: "anonimo" } : {}) },
    );
    // Stamp del click (Goal B): la página de resultados lo consume para medir
    // espera_ms de `informe_visto` — la espera COMPLETA percibida, click →
    // veredicto visible, que el server no puede medir.
    estamparSubmit();
    const res = esAnonimo
      ? await submitAnonimo(a, ctx, await obtenerTokenTurnstile())
      : esCredito
        ? await submitConCredito(a, ctx)
        : await comprarLocked(a, ctx);
    if (res.ok && res.redirect) {
      // Éxito real del POST (Goal B): cierra el hueco del funnel entre
      // "submitted" (pre-fetch) y el informe. posthog-js despacha el batch con
      // sendBeacon al pagehide, así que la navegación no se lo come.
      trackWizard(posthog, "wizard4_analysis_created", {
        modalidad: mod,
        camino: esAnonimo ? "anonimo" : esCredito ? "credito" : "compra-locked",
      });
      // Meta · AnonAnalysisCreated (medición post-F2): NO se dispara acá — el
      // window.location.href de abajo es navegación completa y el request del
      // pixel puede morir en el unload (fbq no usa sendBeacon). Se deja la
      // marca y MetaPixel (global, ya montado en la página destino) la consume
      // y dispara DESPUÉS de navegar. sessionStorage sobrevive same-tab.
      if (esAnonimo) {
        try { sessionStorage.setItem("meta_anon_created", "1"); } catch { /* sin marca, sin evento */ }
      }
      window.location.href = res.redirect;
      return;
    }
    manejarFallo(res, esCredito || esAnonimo ? "No pudimos generar el análisis." : "No se pudo crear el análisis.");
    // El 422 NO cierra el modal: cambia de estado limpio a estado anomalía.
    if (res.anomalias?.length) setHuellaBloqueada(huellaActual);
    else setModalAbierto(false);
  }

  /** Un dato de origen del modal: cierra, abre su card y la ilumina. NO navega
   *  hacia atrás en el wizard — el resumen es editable en el lugar. */
  function irAOrigen(origen: string) {
    const field = ORIGEN_A_FIELD[origen];
    setModalAbierto(false);
    if (!field) return;
    const card = FIELD_CARD[field];
    if (card) { setOpenCard(card); setCascade((c) => (c[card] ? { ...c, [card]: "" } : c)); }
    setHighlight(field);
    window.setTimeout(() => setHighlight(null), 1500);
    trackWizard(posthog, "wizard4_anomalia_origen_tap", { origen });
  }

  // Líneas-resumen (mobile) — se recomputan de answers → se actualizan al commit.
  // Card 01 colapsada (mobile): PRECIO primero. Antes abría con `a.direccion`,
  // que es el formatted_address de Places ("Suecia 750, 7510297 Providencia,
  // Región M…") y se comía la línea entera: la card del dato más decisivo era la
  // única que no mostraba ningún número. La comuna sola ubica igual y deja
  // espacio; la dirección completa está a un tap, dentro de la card.
  const summary01 = [
    pUF > 0 ? fmtUF(pUF) : null,
    sup > 0 ? `${a.superficieUtil} m²` : null,
    a.comuna || null,
  ].filter(Boolean).join(" · ") || "—";
  // Fase 5b: con pie 0 la línea abre con "Sin pie" — antes el chip desaparecía
  // y el resumen se leía como si el pie no existiera.
  const summary02 = [pct > 0 ? `${Math.round(pct)}% pie` : pieDeclarado ? "Sin pie" : null, a.plazoCredito ? `${a.plazoCredito} años` : null, a.tasaInteres ? `${a.tasaInteres}%` : null].filter(Boolean).join(" · ") || "—";
  const summary03 = esStr
    ? [a.adrTarifa ? `${fmtCLP(leerNum(a.adrTarifa, DEC.tarifa))}/noche` : null, a.adrOcupacion ? `${a.adrOcupacion}%` : null, a.edificioPermiteAirbnb ? LABEL_GATE[a.edificioPermiteAirbnb] : null].filter(Boolean).join(" · ") || "—"
    : (a.arriendo ? `${fmtCLP(leerNum(a.arriendo, DEC.arriendo))}/mes` : "—");

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

  return (
    <div className="pb-44 lg:pb-1">
      {/* Header: chip de informe editable — tap abre el selector de modalidad. */}
      <div className="mb-2">
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
            // `fmtUF` redondea a entero (UF 3.200,5 salía "UF 3.201") y es
            // compartido con v3, así que no se toca: el precio pasa por
            // `displayNum` como el resto de los campos.
            label="Precio" raw={a.precio ?? ""} display={displayNum(a.precio, DEC.precioUF, (t) => `UF ${t}`)} suffix="UF"
            decimales={DEC.precioUF} formatEco={ecoPorDefecto("UF ")} escala={escalaPrecio}
            derived={precioCLP} onCommit={(v) => commitEdit("precio", { precio: v })}
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
            {a.tipoPropiedad === "nuevo" ? (
              <ChipsField label="Entrega" value={a.estadoVenta}
                options={[{ value: "inmediata" as const, label: "Inmediata" }, { value: "futura" as const, label: "Futura" }]}
                onCommit={(v) => commitEdit("entrega", { estadoVenta: v })} />
            ) : (
              <ChipsField label="Antigüedad" value={a.antiguedad} options={ANTIGUEDADES}
                onCommit={(v) => commitEdit("antiguedad", { antiguedad: v })} />
            )}
            <TamanoField a={a} patch={w.patchAnswers} onCommit={() => commitEdit("tam", {})} />
            <NumField label="Estacionamientos" raw={a.estacionamientos ?? ""} display={displayNum(a.estacionamientos, DEC.estacionamientos, (t) => t, "0")} suffix="" decimales={DEC.estacionamientos} onCommit={(v) => commitEdit("estac", { estacionamientos: v })} />
            <NumField label="Bodegas" raw={a.bodegas ?? ""} display={displayNum(a.bodegas, DEC.bodegas, (t) => t, "0")} suffix="" decimales={DEC.bodegas} onCommit={(v) => commitEdit("bodega", { bodegas: v })} />
          </Nivel3>
          {/* Gastos del depto: GGCC + contribuciones son del inmueble, no de la
              modalidad → viven acá en las 3 modalidades (taxonomía de v3 "Comunes"). */}
          <Nivel3 title="Gastos del depto" open={l3c01 === "gastos"} onToggle={() => openL3c01("gastos")}>
            <NumField label="Gastos comunes" raw={a.gastosComunes ?? formatNumeroCL(Math.round(ggccDef), DEC.gastosComunes)} display={`${fmtCLP(leerNum(a.gastosComunes, DEC.gastosComunes) || ggccDef)}/mes`} suffix="$" decimales={DEC.gastosComunes} formatEco={ecoPorDefecto("$", "/mes")} tag={a.gastosComunes ? "corregido por ti" : undefined} fuente="gastos comunes típicos de la comuna" onCommit={(v) => commitEdit("gastosComunes", { gastosComunes: v })} />
            <NumField label="Contribuciones (trim.)" raw={a.contribuciones ?? formatNumeroCL(Math.round(contribDef), DEC.contribuciones)} display={fmtCLP(leerNum(a.contribuciones, DEC.contribuciones) || contribDef)} suffix="$" decimales={DEC.contribuciones} formatEco={ecoPorDefecto("$")} tag={a.contribuciones ? "corregido por ti" : undefined} fuente="fórmula SII según avalúo estimado" onCommit={(v) => commitEdit("contribuciones", { contribuciones: v })} />
          </Nivel3>
        </ActCard>

        {/* 02 · Cómo lo financias */}
        <ActCard num="02" title="Cómo lo financias" summaryLine={summary02} open={openCard === "02"} onToggle={() => toggleCard("02")}>
          {cascade["02"] && <CascadeNote text={cascade["02"]} />}
          <NumField
            label="Pie (% del precio)" raw={pct > 0 ? pieTexto(pct) : pieDeclarado ? "0" : ""} display={pieStr} suffix="%"
            decimales={DEC.piePct} formatEco={ecoPorDefecto("", "% del precio")} escala={escalaPie}
            commitCeroDesdeVacio
            onCommit={(v) => {
              // Fix pie-cero: borrar el campo NO es declarar cero — el vacío se
              // ignora y el valor anterior queda. El cero se declara escribiendo
              // "0" (y eligiendo la razón abajo). Este era el agujero del
              // resumen: un clear acá dejaba pieMonto vacío y el submit salía
              // con pie 0 silencioso.
              if (v.trim() === "") return;
              // Fase 5b: al subir el pie sobre 0, la razón se descarta en
              // SILENCIO (misma regla que el wizard). Al bajarlo a 0 el selector
              // aparece acá para que el usuario la declare sin volver atrás.
              const nuevoPct = piePct({ ...a, pieUnidad: "pct", pieMonto: v }, data.ufCLP);
              commitEdit("pie", nuevoPct > 0 && a.pieRazon
                ? { pieUnidad: "pct", pieMonto: v, pieRazon: undefined }
                : { pieUnidad: "pct", pieMonto: v });
            }}
          />
          {/* Fase 5b · la razón del pie 0 vive donde el usuario la declaró y se
              edita como el resto de la card (mockup 5f7c4f9). Con pie > 0 la
              fila no existe. */}
          {pct === 0 && pieDeclarado && (
            <ChipsField
              label="Cómo se cubre" value={a.pieRazon}
              options={PIE_RAZON_OPCIONES.map((o) => ({ value: o.value, label: o.label }))}
              tag={a.pieRazon ? "lo indicaste tú" : undefined}
              onCommit={(v) => commitEdit("pie", { pieRazon: v })}
            />
          )}
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
              label="Tasa" raw={a.tasaInteres ?? ""} display={displayNum(a.tasaInteres, DEC.tasa, (t) => `${t}%`)} suffix="%"
              decimales={DEC.tasa} formatEco={ecoPorDefecto("", "% anual")} escala={escalaTasa}
              tag={tasaTag} derived={cuotaStr} highlight={highlight === "tasa"}
              onCommit={(v) => commitEdit("tasa", { tasaModo: "preaprobada", tasaInteres: v })}
            />
          )}
          {calificaSubsidioV4(a) && cuotaStr && <DerivedLine text={cuotaStr} />}
        </ActCard>

        {/* 03 · Cómo lo rentabilizas */}
        <ActCard num="03" title="Cómo lo rentabilizas" summaryLine={summary03} open={openCard === "03"} onToggle={() => toggleCard("03")}>
          {cascade["03"] && <CascadeNote text={cascade["03"]} />}

          {/* ── Nivel 2 · RENTA LARGA: arriendo + vacancia (la vacancia subió acá) ── */}
          {esLtr && (
            <>
              {esStr && <Subtitulo>Renta larga</Subtitulo>}
              <NumField
                label="Arriendo mensual" raw={a.arriendo ?? String(sugArriendo || "")} display={arriendoVal > 0 ? `${fmtCLP(arriendoVal)}/mes` : "—"} suffix="$"
                decimales={DEC.arriendo} formatEco={ecoPorDefecto("$", "/mes")} escala={escalaArriendo}
                tag={arriendoTag}
                fuente={fuenteArriendoLine(data.arriendoFuente, data.arriendoN, data.radiusUsed)}
                procedencia={procedenciaArriendoCorta(
                  data.arriendoFuente, data.arriendoN, data.radiusUsed,
                  data.arriendoSugerido, arriendoCorregido,
                ) ?? undefined}
                highlight={highlight === "arr"}
                onCommit={(v) => commitEdit("arr", { arriendo: v, arrModo: "corregir" })}
              />
              <NumField label="Vacancia" raw={a.vacanciaPct ?? "5"} display={displayNum(a.vacanciaPct ?? "5", DEC.vacancia, (t) => `${t}%`)} suffix="%" decimales={DEC.vacancia} formatEco={ecoPorDefecto("", "% del año")} escala={escalaVacancia} tag={a.vacanciaPct ? "corregido por ti" : undefined} fuente="promedio de meses sin arrendatario al año" onCommit={(v) => commitEdit("vacanciaPct", { vacanciaPct: v })} />
            </>
          )}

          {/* ── Nivel 2 · RENTA CORTA: tarifa + ocupación (el gate bajó a Operación renta corta) ── */}
          {esStr && (
            <>
              {esLtr && <Subtitulo>Renta corta</Subtitulo>}
              <NumField
                label="Tarifa por noche" raw={a.adrTarifa ?? String(sugTarifa || "")} display={tarifaVal > 0 ? `${fmtCLP(tarifaVal)}/noche` : "—"} suffix="$"
                decimales={DEC.tarifa} formatEco={ecoPorDefecto("$", "/noche")} escala={escalaTarifa}
                tag={a.adrModo === "corregir" ? "corregido por ti" : "estimado"}
                fuente="datos de mercado Airbnb de la zona, últimos 90 días" highlight={highlight === "adr"}
                onCommit={(v) => commitEdit("adr", { adrTarifa: v, adrModo: "corregir" })}
              />
              <NumField
                label="Ocupación" raw={String(a.adrOcupacion ?? (sugOcc || ""))} display={displayNum(String(a.adrOcupacion ?? (sugOcc || "")), DEC.ocupacion, (t) => `${t}%`)} suffix="%"
                decimales={DEC.ocupacion} formatEco={ecoPorDefecto("", "% de ocupación")} escala={escalaOcupacion}
                tag={a.adrModo === "corregir" ? "corregido por ti" : "estimado"} highlight={highlight === "adr"}
                onCommit={(v) => commitEdit("adr", { adrOcupacion: v, adrModo: "corregir" })}
              />
            </>
          )}

          {/* ── Nivel 3 · operación (título "Operación renta larga/corta" siempre) ── */}
          {esLtr && (
            <Nivel3 title="Operación renta larga" open={l3 === "sup"} onToggle={() => openL3("sup")}>
              <NumField label="Comisión administración" raw={a.comisionAdminPct ?? "0"} display={displayNum(a.comisionAdminPct ?? "0", DEC.comisionAdmin, (t) => `${t}%`)} suffix="%" decimales={DEC.comisionAdmin} formatEco={ecoPorDefecto("", "% del arriendo")} escala={escalaComision} tag={a.comisionAdminPct ? "corregido por ti" : undefined} fuente="0 = autogestión; corredor típico 7-10%" onCommit={(v) => commitEdit("comisionAdminPct", { comisionAdminPct: v })} />
            </Nivel3>
          )}
          {esStr && (
            // Si el gate está POR COMPLETAR (tras cambiar de modalidad) se fuerza
            // abierto para que el usuario lo vea y desbloquee generar.
            <Nivel3 title="Operación renta corta" open={l3 === "gest" || gatePorCompletar} onToggle={() => openL3("gest")}>
              {/* Gate: interruptor de existencia de la mitad STR — primer campo del bloque. */}
              {gatePorCompletar ? (
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
              )}
              <NumField label="Costos operativos" raw={a.costoInsumos ?? String(costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos)} display={`${fmtCLP(leerNum(a.costoInsumos, DEC.costos) || costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos)}/mes`} suffix="$" decimales={DEC.costos} formatEco={ecoPorDefecto("$", "/mes")} tag={a.costoInsumos ? "corregido por ti" : undefined} fuente={`consumo operativo típico para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("costoInsumos", { costoInsumos: v })} />
              <NumField label="Mantención" raw={a.mantencionStr ?? String(costos.mantencion)} display={`${fmtCLP(leerNum(a.mantencionStr, DEC.costos) || costos.mantencion)}/mes`} suffix="$" decimales={DEC.costos} formatEco={ecoPorDefecto("$", "/mes")} tag={a.mantencionStr ? "corregido por ti" : undefined} fuente={`provisión mensual de mantención para ${dormLabel(dorm)}`} onCommit={(v) => commitEdit("mantencionStr", { mantencionStr: v })} />
              <NumField label="Amoblamiento (capex)" raw={a.costoAmoblamiento ?? String(costos.costoAmoblamiento)} display={fmtCLP(leerNum(a.costoAmoblamiento, DEC.costos) || costos.costoAmoblamiento)} suffix="$" decimales={DEC.costos} formatEco={ecoPorDefecto("$")} tag={a.costoAmoblamiento ? "corregido por ti" : undefined} fuente="capex inicial estimado si el depto no está amoblado" onCommit={(v) => commitEdit("costoAmoblamiento", { costoAmoblamiento: v })} />
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

      {(error || anomalias.length > 0) && (
        <div className="mt-4 rounded-xl border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--signal-red)_5%,transparent)] px-4 py-3">
          {/* Con anomalías se muestra la de mayor prioridad (el server ya las
              ordenó). El resto vive en `anomalias` para el modal de PIEZA B. */}
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0">
            {anomalias.length > 0 ? anomalias[0].mensaje : error}
          </p>
        </div>
      )}

      {/* Desktop: fila final. Al-filo (si hay) crece a la izquierda; el CTA va
          capado (~360px) para no volverse gigante al ancho nuevo. Sin al-filo,
          el CTA queda centrado. */}
      <div className="hidden lg:flex items-stretch justify-center gap-4 mt-2">
        {alFilo && (
          <button type="button" onClick={onAlfiloTap} className="flex-1 max-w-[760px] text-left rounded-r-lg border-l-2 border-signal-red bg-[color-mix(in_srgb,var(--franco-text)_3.5%,transparent)] pl-4 pr-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</p>
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0 leading-snug">Una diferencia pequeña cambia el veredicto. Tócalo para ir directo a revisarlo.</p>
          </button>
        )}
        <div className="w-full max-w-[360px] shrink-0 flex flex-col justify-end gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} anonCap={anonCap} canAnalyze={canAnalyze} submitting={submitting} incompleto={incompleto || bloqueadoPorAnomalia} onAbrir={abrirConfirmacion} onTerminal={onTerminal} />
          {(lineaIncompleto || lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna)) && (
            <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{lineaIncompleto ?? lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna)}</p>
          )}
        </div>
      </div>

      <ModalPlausibilidad
        open={modalAbierto}
        anomalias={anomalias}
        origenes={origenes}
        resumen={{
          direccion: a.direccion || a.comuna || "Tu análisis",
          modalidad: mod === "both" ? "Comparativo · renta larga y corta" : mod === "str" ? "Renta corta" : "Renta larga",
          derivados: derivadosResumen,
        }}
        consumo={consumo}
        labelConfirmar={!isLoggedIn ? "Generar mi análisis gratis" : canAnalyze ? "Generar el análisis" : `Ir a pagar · ${fmtCLP(SINGLE_PRICE)}`}
        submitting={submitting}
        onOrigen={irAOrigen}
        onConfirmar={confirmarYEnviar}
        onCerrar={() => setModalAbierto(false)}
      />

      {/* Mobile: CTA sticky. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--franco-border)] bg-[color-mix(in_srgb,var(--franco-bg)_92%,transparent)] backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-stretch gap-1.5">
          <FinalCTA mod={mod} isLoggedIn={isLoggedIn} anonCap={anonCap} canAnalyze={canAnalyze} submitting={submitting} incompleto={incompleto || bloqueadoPorAnomalia} onAbrir={abrirConfirmacion} onTerminal={onTerminal} />
          {(lineaIncompleto || lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna)) && (
            <p className="font-body text-[11px] text-[var(--franco-text-muted)] text-center m-0">{lineaIncompleto ?? lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Línea de consumo bajo el CTA. Depende del TIER COMPLETO, no de un booleano.
 *
 * Antes decía "1 crédito" a todo el mundo, incluidos ilimitados y admins que no
 * gastan nada — copy falso verificado en producción, en un producto cuya
 * propuesta es la franqueza. `null` = no se renderiza nada (es la respuesta
 * correcta para quien no consume: mejor silencio que una mención inventada).
 *
 * Vocabulario: "el análisis", nunca "crédito". El usuario compra análisis; el
 * crédito es contabilidad interna.
 */
export function lineaConsumo(
  tier: TierInfo | null,
  isLoggedIn: boolean,
  canAnalyze: boolean,
  mod: string | undefined,
  comuna: string | undefined,
): string | null {
  const sufijoMod = mod === "both" ? " comparativo" : "";

  // Guest: rama propia, partida por el cap anónimo (F2-2). Con cap disponible
  // el CTA genera de verdad — la línea lo dice sin pedir cuenta. Con cap
  // consumido, el CTA es registro y la línea no promete recuperar nada.
  if (!isLoggedIn) {
    return tier?.anonCapAvailable === true
      ? "El primero va por cuenta de Franco — sin crear cuenta."
      : "Tu análisis gratis ya lo usaste. Crea tu cuenta para seguir.";
  }

  // Sin saldo: compra directa.
  if (!canAnalyze) {
    return `Estás comprando este análisis${sufijoMod}${comuna ? ` de ${comuna}` : ""}. Pagas y se desbloquea al instante.`;
  }

  // Ilimitado y admin NO consumen: el bloque no se renderiza. Cero mención.
  if (tier?.isUnlimited || tier?.isAdmin) return null;

  // Welcome: el backend lo cobra ANTES del ledger, así que manda sobre el saldo.
  if (tier?.welcomeAvailable) {
    return "Este es tu análisis de bienvenida — el primero va por cuenta de Franco.";
  }

  // Saldo finito. Con plan mostramos el total del ciclo ("3 de 10"); sin plan
  // (créditos comprados sueltos) no hay denominador que mostrar.
  const saldo = tier?.credits ?? 0;
  const totalPlan = tier?.activePlan === "plan10" ? 10 : tier?.activePlan === "plan50" ? 50 : null;
  const quedan = saldo === 1 ? "Te queda 1" : `Te quedan ${saldo}`;
  return `Esto usa uno de tus análisis. ${quedan}${totalPlan ? ` de ${totalPlan}` : ""}.`;
}

function FinalCTA({ mod, isLoggedIn, anonCap, canAnalyze, submitting, incompleto, onAbrir, onTerminal }: { mod: string | undefined; isLoggedIn: boolean; anonCap: boolean; canAnalyze: boolean; submitting: boolean; incompleto: boolean; onAbrir: () => void; onTerminal: () => void }) {
  const cls = "font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed";
  if (isLoggedIn && canAnalyze) {
    // Sin "· 1 crédito": era falso para ilimitados y admins, y el consumo real
    // lo dice `lineaConsumo` según el tier. El botón solo nombra la acción.
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar el análisis</>}</button>;
  }
  if (isLoggedIn) {
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</> : <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>}</button>;
  }
  // Anónimo con cap disponible (F2-2): el CTA genera DE VERDAD — mismo camino
  // del modal de confirmación; el submit sale sin sesión y el server emite la
  // cookie del cap con el response.
  if (anonCap) {
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <>✦ Generar mi análisis gratis</>}</button>;
  }
  // Anónimo con cap consumido: muro de registro (baseline del funnel).
  if (incompleto) {
    return <span className={`${cls} opacity-60 cursor-not-allowed`}>Regístrate para continuar <ArrowRight size={14} /></span>;
  }
  return <Link href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`} onClick={onTerminal} className={cls}>Regístrate para continuar <ArrowRight size={14} /></Link>;
}
