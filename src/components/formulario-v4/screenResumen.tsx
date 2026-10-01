"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — RESUMEN · DOCUMENTO MAESTRO
//
// El resumen es el documento maestro del deal: tres tarjetas por acto (Qué compras
// · Cómo lo financias · Cómo lo rentabilizas). TODA edición ocurre EN el resumen,
// inline — no hay viaje lápiz→pantalla→volver.
//
// CON EL FORMATO DEL INFORME (entrega 2, 27-sep-2026, mockup aprobado
// docs/wireframes/rediseno-informe/wizard-v4-actualizado.html):
//  · Las tres tarjetas son las FILAS NAVEGABLES del informe: título, una línea de
//    resumen, la cifra a la derecha y el disco del chevron. Una bajo otra, en todos
//    los anchos; nacen cerradas y se abren al tocarlas.
//  · Adentro, las MISMAS filas editables que en las pantallas (`filas.tsx`): un solo
//    formato para editar en todo el wizard. Sin tercer nivel: los gastos comunes a
//    un toque, no a tres. GGCC y contribuciones pasan a «Cómo lo rentabilizas».
//  · La gestión, la comisión STR, los huéspedes y el amoblado, editables acá (antes
//    no existían en ninguna parte), y «Cómo se cubre» con el monto de otra fuente.
//  · COMMIT = blur o Enter (NO cada keystroke). El dry-run, los eventos y la
//    línea-resumen se actualizan al COMMIT. Escape cancela.
//  · El botón queda fijo abajo (barra sticky), el mismo de todo el wizard.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { ChevronRight, Loader2, Pencil } from "lucide-react";
import { SINGLE_PRICE } from "@/lib/pricing";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { estimarContribuciones } from "@/lib/contribuciones";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { precisionDeComponentes, sinCodigoPostal, type PrecisionUbicacion } from "@/lib/geocoding-precision";
import { direccionCorta } from "@/components/entrada/llegada";
import { AvisoSinNumero, MapaPinAjustable } from "./MapaPinAjustable";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import type { useWizardV4 } from "./useWizardV4";
import type { WizardV4Answers, Antiguedad, PieRazon } from "./wizardV4Nodes";
import { DEC, decPie, PIE_RAZON_OPCIONES } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { canAnalyzeFromTier, type TierInfo } from "./useWizardV4Tier";
import { buildLtrPayload, buildStrPayload, comprarLocked, datosDfl2, submitAnonimo, submitConCredito, type SubmitContext, type SubmitResult } from "./wizardV4Submit";
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
  avisoPie,
  escalaArriendo,
  escalaComision,
  escalaOcupacion,
  escalaPie,
  escalaPrecio,
  escalaSuperficie,
  escalaTarifa,
  escalaTasa,
  escalaVacancia,
} from "./avisoEscala";
import { ModalPlausibilidad, type OrigenCampo } from "./ModalPlausibilidad";
import { CAJA_COBERTURA } from "@/lib/comuna-bounds";
import { costosOperativosEditados, cuotaCreditoPieCLP, dormLabel, dormitoriosNum, fmtCLP, fmtUF, fuenteArriendoLine, huespedesNum, leerNum, otraFuentePctCrudo, procedenciaArriendoCorta, superficieM2, cuotaCLP, pieEfectivoPct, piePct, pieTexto, pieUF, precioUF } from "./derive";
import { decimalesUtiles, ecoPorDefecto, estadoNumericInput } from "./NumericInput";
import { FilaFija, FilaNum, FilaOpciones } from "./filas";
import { OPCIONES_AMOBLADO } from "./screensActo3";
import { BarraCta } from "./ui";
import { formatNumeroCL, parseNumeroCL, type Decimales } from "@/lib/numero-cl";
import { calificaSubsidioV4, subsidioAplicadoV4, tasaConSubsidioV4 } from "./wizardV4Subsidio";
import { useWizardV4DryRun } from "./useWizardV4DryRun";
import { trackWizard } from "./track";
import { reportarValidacionRechazo } from "./stepTelemetry";
import { estamparSubmit } from "@/lib/informe-visto";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { MODALIDADES_OFRECIDAS } from "./screenInforme";

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

/** Texto guardado → cifra, con los decimales que el valor realmente tiene (sin unidad). */
function cifra(raw: string | undefined, decimales: Decimales, def: number): string {
  const v = parseNumeroCL(raw ?? "", decimales);
  const x = v === null ? def : v;
  return formatNumeroCL(x, decimalesUtiles(x));
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
// Gastos comunes y contribuciones viven en la 03 desde el 27-sep-2026 (se descuentan
// del arriendo / se pagan al operar), igual que en las pantallas de renta.
const FIELD_CARD: Record<string, "01" | "02" | "03"> = {
  precio: "01",
  entrega: "01", antiguedad: "01", tam: "01", estac: "01", bodega: "01",
  pie: "02", otraFuente: "02", plazo: "02", tasa: "02",
  gate: "03", arr: "03", adr: "03",
  gastosComunes: "03", contribuciones: "03",
  vacanciaPct: "03", comisionAdminPct: "03",
  modoGestion: "03", comisionStrPct: "03", huespedes: "03", amoblado: "03",
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

// ── Piezas del resumen (los campos son las filas de `filas.tsx`) ─────────────

const ANTIGUEDADES: Array<{ value: Antiguedad; label: string }> = [
  { value: "0-2", label: "0–2 años" }, { value: "3-5", label: "3–5 años" }, { value: "6-10", label: "6–10 años" }, { value: "11-20", label: "11–20 años" }, { value: "20+", label: "20+ años" },
];

/** La razón del pie 0 en la píldora de la fila: corta, para que el rótulo no parta en dos. */
const RAZON_CORTA: Record<PieRazon, string> = {
  bono_pie: "Bono pie",
  otra_fuente: "Otra fuente",
  no_declarada: "Prefiero no decir",
};

/** Rótulo de agrupación dentro de una tarjeta («Lo que se descuenta», «Operación»). */
function SubRot({ children }: { children: ReactNode }) {
  return <div className="wz-sub-rot">{children}</div>;
}

/** Tamaño: superficie + dormitorios + baños en una fila; al tocarla, los tres editores. Los
 *  sub-campos patchean en vivo; «Listo» cierra y emite el commit. */
function TamanoFila({ a, patch, onCommit }: { a: WizardV4Answers; patch: (p: Partial<WizardV4Answers>) => void; onCommit: () => void }) {
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
    <div className="wz-fe">
      <span className="wz-k">Tamaño</span>
      <button type="button" className="wz-v wz-v-btn" onClick={() => setEditing((e) => !e)} aria-expanded={editing} aria-label={`Tamaño: ${display}. Toca para cambiarlo.`}>
        <span>{display}</span>
        <Pencil size={12} className="wz-lap" aria-hidden />
      </button>
      {editing && (
        <div className="wz-fe-nota wz-fe-editor">
          {/* Sin filtro: se acepta lo tipeado y el eco de abajo dice cómo se entendió. Misma
              precisión que el Acto 1 (DEC.superficie). */}
          <div className="wz-input-caja">
            <input
              autoFocus
              value={a.superficieUtil ?? ""}
              inputMode="decimal"
              aria-label="Superficie útil"
              aria-invalid={supEstado.estado === "error"}
              onChange={(e) => patch({ superficieUtil: e.target.value })}
              className="wz-input con-suf"
            />
            <span className="wz-suf">m²</span>
          </div>
          {supEstado.estado === "error" && <span className="wz-aviso fuerte">No se entiende — {supEstado.motivo}</span>}
          {(supEstado.estado === "ok" || supEstado.estado === "escala") && (
            <span className="wz-eco">
              = <b>{supEstado.eco}</b>
            </span>
          )}
          {supEstado.estado === "escala" && <span className="wz-indic">{supEstado.aviso}</span>}
          <div className="wz-fila-dorm" role="group" aria-label="Dormitorios">
            <button type="button" aria-pressed={!!a.esStudio} onClick={() => patch({ esStudio: true, dormitorios: "0" })}>Studio</button>
            {["1", "2", "3", "4"].map((d) => (
              <button key={d} type="button" aria-pressed={!a.esStudio && a.dormitorios === d} onClick={() => patch({ esStudio: false, dormitorios: d })}>
                {d === "4" ? "4+" : d}D
              </button>
            ))}
          </div>
          <div className="wz-fila-banos" role="group" aria-label="Baños">
            {["1", "2", "3"].map((b) => (
              <button key={b} type="button" aria-pressed={a.banos === b} onClick={() => patch({ banos: b })}>
                {b === "3" ? "3+" : b}B
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setEditing(false); onCommit(); }} className="wz-btn2 tinta">Listo</button>
        </div>
      )}
    </div>
  );
}

const DIAS_MES = 30.44;

/** Nota de cascada (la voz de Franco, en tarjeta gris) dentro de una tarjeta afectada. Vive
 *  hasta la próxima interacción con esa tarjeta (R3). */
function CascadeNote({ text }: { text: string }) {
  return <div className="wz-reac wz-reac-cascada">{text}</div>;
}

/** Editor inline de dirección: el mismo Places Autocomplete embebido en la card,
 *  con gate de cobertura. Confirma solo comunas cubiertas; devuelve los datos de
 *  la nueva dirección al padre (que decide la invalidación + cascada). */
function DireccionEdit({ initial, onConfirm, onCancel }: {
  initial: string;
  onConfirm: (d: { direccion: string; comuna: string; ciudad: string; lat: number; lng: number; precision: PrecisionUbicacion }) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);
  const [fuera, setFuera] = useState<string | null>(null);
  const [noEsCalle, setNoEsCalle] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!inputRef.current || acRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.maps?.places) return;
      // PISO DURO regional (mismo criterio que la portada): sin esto el editor
      // ofrece direcciones de Ovalle, Valdivia o Arica, que Franco no puede
      // analizar. Acá se usa la caja de la RM y no la de una comuna: este editor
      // sirve justamente para CORREGIR la comuna, así que acotarlo a la comuna
      // vigente impediría lo único que viene a hacer.
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"], componentRestrictions: { country: "cl" },
        bounds: new google.maps.LatLngBounds(
          new google.maps.LatLng(CAJA_COBERTURA[0], CAJA_COBERTURA[1]),
          new google.maps.LatLng(CAJA_COBERTURA[2], CAJA_COBERTURA[3]),
        ),
        strictBounds: true,
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
        // Misma regla que la portada: sin calle real no se confirma.
        const precision = precisionDeComponentes(comps);
        if (!precision) { setNoEsCalle(true); return; }
        setNoEsCalle(false);
        doneRef.current = true;
        onConfirm({ direccion: addr, comuna: comunaFinal, ciudad: match?.ciudad || "Santiago", lat, lng, precision });
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
        aria-label="Dirección del depto"
        className="wz-input"
      />
      {fuera ? (
        <p className="wz-aviso fuerte wz-mt6">{fuera} está fuera del Gran Santiago: Franco no tiene datos suficientes ahí.</p>
      ) : noEsCalle ? (
        <p className="wz-aviso fuerte wz-mt6">Esa opción no es una calle. Escribe la calle del depto y elígela de la lista.</p>
      ) : (
        <p className="wz-eco wz-mt6">Elige una opción de la lista. Cambiar de comuna vuelve a estimar la zona.</p>
      )}
    </div>
  );
}

// ── Las tres tarjetas: las filas navegables del informe ──────────────────────

function FilaNav({ id, titulo, resumen, cifra: ci, abierta, onToggle, children }: { id: string; titulo: string; resumen: string; cifra: string; abierta: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={`wz-fnav${abierta ? " abierta" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={abierta} aria-controls={`wz-fnav-${id}`} className="wz-fnav-cab">
        <span className="wz-fnav-txt">
          <span className="wz-ti">{titulo}</span>
          <span className="wz-re">{resumen}</span>
        </span>
        <span className="wz-ci">{ci}</span>
        <span className="wz-disco" aria-hidden>
          <ChevronRight size={16} className={abierta ? "wz-rot90" : undefined} />
        </span>
      </button>
      {abierta && (
        <div id={`wz-fnav-${id}`} className="wz-fnav-cuerpo">
          {children}
        </div>
      )}
    </section>
  );
}

export function ResumenScreen({ w, data, tier, isLoggedIn, onTerminal, cardInicial = null }: {
  w: Wizard; data: WizardV4Data; tier: TierInfo | null; isLoggedIn: boolean; onTerminal: () => void;
  /** Tarjeta abierta al montar. El wizard no la pasa (nacen cerradas); la usa el tier
   *  WIZARD-INTERIOR para dibujar el contenido de una tarjeta sin simular el toque. */
  cardInicial?: "01" | "02" | "03" | null;
}) {
  const posthog = usePostHog();
  const a = w.nav.answers;
  const mod = a.modalidad;
  const [submitting, setSubmitting] = useState(false);
  // Lo que tarda se ve cargando: el POST de generar enciende la barra del header y el botón queda
  // presionado; si falla, se suelta acá. Si llega, la página se descarga con la barra encendida.
  const soltarCarga = useRef<() => void>(() => {});
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

  // Las 3 tarjetas nacen CERRADAS (la línea-resumen es la revisión de un vistazo),
  // en todos los anchos. null = ninguna abierta.
  const [openCard, setOpenCard] = useState<"01" | "02" | "03" | null>(cardInicial);
  // R3: notas de cascada por card (viven hasta la próxima interacción con la card).
  const [cascade, setCascade] = useState<Record<string, string>>({});
  const [editingDir, setEditingDir] = useState(false);
  const [editingMod, setEditingMod] = useState(false);
  // R4: campo iluminado transitoriamente cuando la card al-filo apunta-adentro.
  const [highlight, setHighlight] = useState<string | null>(null);

  const dryRun = useWizardV4DryRun(a, data);
  // Aplicar una corrección también tarda (el dry-run recalcula): la fila corregida queda
  // presionada, con la barra, hasta que llega la respuesta.
  const [campoEnEspera, setCampoEnEspera] = useState<string | null>(null);
  useEffect(() => { if (!dryRun.pendiente) setCampoEnEspera(null); }, [dryRun.pendiente]);
  const enEspera = (field: string) => dryRun.pendiente && campoEnEspera === field;
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
    arriendoFuente: data.arriendoFuente,
    arriendoRango: data.arriendoRango,
    muestraArriendo: data.muestraArriendo,
    precioM2UF: data.precioM2UF,
    radiusUsed: data.radiusUsed,
    ggccSugerido: data.ggccSugerido,
    ventaN: data.ventaN,
    ventaFuente: data.ventaFuente,
    ventaUniverso: data.ventaUniverso,
    ventaRadio: data.ventaRadio,
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
    setCampoEnEspera(field);
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
  const precioCLP = pUF > 0 ? `≈ ${fmtCLP(pUF * data.ufCLP)} al valor UF de hoy` : undefined;
  const pct = piePct(a, data.ufCLP);
  // Fase 5b (mockup 5f7c4f9): el 0 es un dato DECLARADO, no un vacío. "—" queda
  // solo para el pie realmente ausente (campo sin tocar).
  const pieDeclarado = (a.pieMonto ?? "").trim() !== "";
  // «Otra fuente» (27-sep-2026): con pie 0 cubierto por otra fuente, el banco ve su monto como pie.
  const unidadPie = a.pieUnidad ?? "pct";
  const otraPct = otraFuentePctCrudo(a, data.ufCLP);
  const pieBanco = pieEfectivoPct(a, data.ufCLP);
  const cuotaPie = cuotaCreditoPieCLP(a, data.ufCLP);
  const pieSub = pct > 0
    ? fmtUF(pieUF(a, data.ufCLP))
    : pieDeclarado
      ? otraPct > 0 ? `Lo cubre otra fuente: ${Math.round(pieBanco)}% del precio` : "Financias el 100% con crédito"
      : "Falta el pie";
  const cuota = cuotaCLP(a, data.ufCLP);
  const sup = superficieM2(a);

  const conSubsidio = subsidioAplicadoV4(a, data.tasaMercado);
  const tasaTag = conSubsidio ? "con subsidio" : a.tasaModo === "preaprobada" ? "corregido por ti" : a.tasaModo === "estimada" ? "estimado" : undefined;

  // Supuestos (card 03).
  const ggccDef = data.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
  const contribDef = estimarContribuciones(pUF * data.ufCLP, datosDfl2(a));
  const dorm = dormitoriosNum(a);
  const costos = getCostosDefault(dorm, "basico");
  // «Costos operativos» es UN número, el total de los cuatro, y se guarda como total
  // (`costosOperativos`); el submit lo reparte. El id "costoInsumos" del commitEdit se
  // conserva porque es la propiedad `field` de wizard4_edit_from_summary.
  const totalOpsDef = costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos;
  const totalOpsEditado = costosOperativosEditados(a);

  // Procedencia del arriendo. Son TRES situaciones, no dos: Franco lo estimó, el
  // usuario cambió esa estimación, o nunca hubo estimación que cambiar. La tercera
  // existe desde que se retiraron los niveles de relleno (2026-08-04): sin
  // comparables cerca, el número lo puso el usuario porque no había alternativa —
  // no porque haya corregido nada.
  const arriendoSinDato = data.arriendoFuente === "sin-dato" || data.arriendoN <= 0;
  const arriendoCorregido = !arriendoSinDato && a.arrModo === "corregir";
  const arriendoTag = arriendoSinDato
    ? "Lo pusiste tú"
    : arriendoCorregido
      ? "Corregido por ti"
      : "Estimado por Franco";

  const esLtr = mod === "ltr" || mod === "both";
  const esStr = mod === "str" || mod === "both";

  // Estimados de zona (fallback de display cuando el override queda vacío tras
  // invalidar en una cascada de dirección).
  const { sugArriendo, sugTarifa, sugOcc, arriendoVal, tarifaVal, occVal } = valoresRenta(a, data);

  // Fix pie-cero: el pie tiene que estar DECLARADO para generar — monto escrito,
  // y si es exactamente 0, con su razón. Cubre el agujero del resumen: acá se
  // puede vaciar el pie editándolo (o llegar con un draft viejo sin pie), y sin
  // este gate el submit salía con piePct 0 silencioso.
  const pieIncompleto = !pieDeclarado || (pct === 0 && !a.pieRazon);
  const incompleto = pieIncompleto;
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
  const lineaIncompleto = pieIncompleto ? "Falta el pie: complétalo en «Cómo lo financias» para generar." : null;

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

  // Los DERIVADOS del estado limpio del modal: una función pura, testeable (ver abajo).
  const derivadosResumen = derivadosConfirmacion(a, data);
  const consumo = lineaConsumo(tier, isLoggedIn, canAnalyze, mod, a.comuna);

  // Confirmación de dirección nueva → invalidación + nota de cascada. Comuna
  // distinta descarta TODO (estimados y corregidos); misma comuna conserva
  // correcciones y solo refresca comparables.
  const onDireccionConfirm = (d: { direccion: string; comuna: string; ciudad: string; lat: number; lng: number; precision: PrecisionUbicacion }) => {
    setEditingDir(false);
    const comunaCambio = d.comuna.toLowerCase() !== (a.comuna ?? "").toLowerCase();
    const base = { direccion: d.direccion, direccionConfirmada: d.direccion, comuna: d.comuna, ciudad: d.ciudad, lat: d.lat, lng: d.lng, ubicacionPrecision: d.precision };
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
    if (nuevo === a.tipoPropiedad) return;
    const antesSub = calificaSubsidioV4(a);
    w.patchAnswers({ tipoPropiedad: nuevo });
    const despuesSub = calificaSubsidioV4({ ...a, tipoPropiedad: nuevo });
    if (antesSub !== despuesSub) {
      setCascade((c) => ({ ...c, "02": despuesSub ? "Este tipo califica para el subsidio a la tasa: revisa la opción en la tasa." : "Este tipo ya no califica para el subsidio; volví la tasa a mercado." }));
      setOpenCard("02"); // en mobile, abre la card afectada para que la nota se vea
    }
    trackWizard(posthog, "wizard4_edit_from_summary", { field: "tipo", cascada: true });
  };

  const onModalidadChange = (nuevo: "ltr" | "str" | "both") => {
    setEditingMod(false);
    // Solo lo que la pantalla de modalidad ofrece (con AMBAS apagado, sin «Comparativo»).
    if (nuevo === mod || !MODALIDADES_OFRECIDAS.includes(nuevo)) return;
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
    soltarCarga.current();
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
    soltarCarga.current = iniciarCarga(claveActual());
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
      // El análisis existe: el borrador se cierra y el wizard no vuelve a ofrecer «retomar».
      w.cerrarBorrador();
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

  // Líneas-resumen de las tres tarjetas — se recomputan de answers → se actualizan al commit.
  // «Qué compras»: la dirección corta (sin código postal), el tamaño y la tipología; la cifra
  // es el precio.
  const dormTxt = a.esStudio ? "Studio" : a.dormitorios ? `${a.dormitorios}D` : null;
  const summary01 = [
    direccionCorta(sinCodigoPostal(a.direccion ?? "")) || a.comuna || null,
    sup > 0 ? displayNum(a.superficieUtil, DEC.superficie, (t) => `${t} m²`) : null,
    dormTxt ? `${dormTxt}${a.banos ? ` ${a.banos}B` : ""}` : null,
  ].filter(Boolean).join(" · ") || "—";
  const cifra01 = pUF > 0 ? displayNum(a.precio, DEC.precioUF, (t) => `UF ${t}`) : "—";
  // Fase 5b: con pie 0 la línea abre con "Sin pie" — antes el chip desaparecía
  // y el resumen se leía como si el pie no existiera.
  const summary02 = [
    pct > 0 ? `${Math.round(pct)}% de pie` : pieDeclarado ? (otraPct > 0 ? `Pie de otra fuente (${Math.round(pieBanco)}%)` : "Sin pie") : null,
    a.plazoCredito ? `${a.plazoCredito} años` : null,
    a.tasaInteres ? displayNum(a.tasaInteres, DEC.tasa, (t) => `${t}%`) : null,
  ].filter(Boolean).join(" · ") || "—";
  const cifra02 = cuota > 0 ? fmtCLP(cuota) : "—";
  const opera = a.modoGestion === "administrador" ? "con administrador" : "lo opero yo";
  const summary03 = esStr && !esLtr
    ? [occVal > 0 ? `${cifra(String(occVal), DEC.ocupacion, occVal)}% de ocupación` : null, opera].filter(Boolean).join(" · ")
    : [
        arriendoSinDato ? "El arriendo lo pusiste tú" : arriendoCorregido ? "Arriendo corregido por ti" : "Arriendo estimado",
        procedenciaArriendoCorta(data.arriendoFuente, data.arriendoN, data.radiusUsed, data.arriendoSugerido, arriendoCorregido),
      ].filter(Boolean).join(" · ");
  const cifra03 = esStr && !esLtr
    ? tarifaVal > 0 ? fmtCLP(tarifaVal) : "—"
    : arriendoVal > 0 ? fmtCLP(arriendoVal) : "—";

  const toggleCard = (c: "01" | "02" | "03") => {
    setOpenCard((prev) => {
      const next = prev === c ? null : c;
      if (next) trackWizard(posthog, "wizard4_summary_level_opened", { card: next, nivel: 2 });
      return next;
    });
    setCascade((prev) => (prev[c] ? { ...prev, [c]: "" } : prev));
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

  const amoblado = a.estaAmoblado === true;
  const admin = a.modoGestion === "administrador";
  const tipologia = dormLabel(dorm);
  const lineaBajoCta = lineaIncompleto ?? consumo;

  return (
    <div>
      {/* El chip de modalidad, editable: tocarlo abre el selector (solo lo que la pantalla de
          modalidad ofrece). Píldora neutra, sin borde rojo. */}
      <div className="wz-mod-chip">
        <button
          type="button"
          onClick={() => setEditingMod((o) => !o)}
          aria-expanded={editingMod}
          aria-label={`Informe: ${mod ? LABEL_MOD[mod] : "—"}. Toca para cambiar.`}
          className="wz-chip wz-chip-btn"
        >
          {mod ? LABEL_MOD[mod] : "—"} <span aria-hidden>▾</span>
        </button>
        {editingMod && (
          <div className="wz-seg wz-seg-fila" role="group" aria-label="Modalidad del informe">
            {MODALIDADES_OFRECIDAS.map((m) => (
              <button key={m} type="button" aria-pressed={m === mod} onClick={() => onModalidadChange(m)}>
                {LABEL_MOD[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="wz-gap wz-gap-0">
        {/* ── Qué compras ── */}
        <FilaNav id="01" titulo="Qué compras" resumen={summary01} cifra={cifra01} abierta={openCard === "01"} onToggle={() => toggleCard("01")}>
          {/* Dirección: editor inline = Places embebido con gate de cobertura. */}
          <div className="wz-fe">
            <span className="wz-k">Dirección</span>
            {!editingDir && <span className="wz-f">{sinCodigoPostal(a.direccion || "") || "—"}</span>}
            {!editingDir && (
              <button type="button" className="wz-v wz-v-btn" onClick={() => setEditingDir(true)} aria-label="Cambiar la dirección">
                <span>Cambiar</span>
                <Pencil size={12} className="wz-lap" aria-hidden />
              </button>
            )}
            {editingDir && (
              <div className="wz-fe-nota">
                <DireccionEdit initial={a.direccion || ""} onConfirm={onDireccionConfirm} onCancel={() => setEditingDir(false)} />
              </div>
            )}
            {/* Sin número: la misma salida que en la portada — el aviso y el pin que se mueve. */}
            {!editingDir && a.lat && a.lng && a.comuna && (a.ubicacionPrecision === "calle" || a.ubicacionPrecision === "pin") && (
              <div className="wz-fe-nota wz-fe-editor">
                <AvisoSinNumero ajustada={a.ubicacionPrecision === "pin"} />
                <MapaPinAjustable
                  lat={a.lat}
                  lng={a.lng}
                  comuna={a.comuna}
                  height={180}
                  onMover={(la, ln) => {
                    w.patchAnswers({ lat: la, lng: ln, ubicacionPrecision: "pin" });
                    trackWizard(posthog, "wizard4_edit_from_summary", { field: "pin" });
                  }}
                />
              </div>
            )}
          </div>
          <FilaNum
            // `fmtUF` redondea a entero (UF 3.200,5 salía "UF 3.201") y es compartido con v3,
            // así que no se toca: el precio pasa por `cifra` como el resto de los campos.
            label="Precio" sub={precioCLP} raw={a.precio ?? ""} display={`UF ${cifra(a.precio, DEC.precioUF, 0)}`}
            decimales={DEC.precioUF} formatEco={ecoPorDefecto("UF ")} escala={escalaPrecio}
            highlight={highlight === "precio"}
            cargando={enEspera("precio")} onCommit={(v) => commitEdit("precio", { precio: v })}
          />
          {/* Tipo: estructural (muta el detalle + recalcula subsidio). */}
          <FilaOpciones
            label="Tipo" value={a.tipoPropiedad}
            options={[{ value: "usado" as const, label: "Usado" }, { value: "nuevo" as const, label: "Nuevo" }]}
            onCommit={onTipoChange}
          />
          {a.tipoPropiedad === "nuevo" ? (
            <FilaOpciones label="Entrega" value={a.estadoVenta}
              options={[{ value: "inmediata" as const, label: "Inmediata" }, { value: "futura" as const, label: "Futura" }]}
              cargando={enEspera("entrega")} onCommit={(v) => commitEdit("entrega", { estadoVenta: v })} />
          ) : (
            <FilaOpciones label="Antigüedad" value={a.antiguedad} options={ANTIGUEDADES}
              cargando={enEspera("antiguedad")} onCommit={(v) => commitEdit("antiguedad", { antiguedad: v })} />
          )}
          <TamanoFila a={a} patch={w.patchAnswers} onCommit={() => commitEdit("tam", {})} />
          <FilaNum label="Estacionamientos" raw={a.estacionamientos ?? ""} display={cifra(a.estacionamientos, DEC.estacionamientos, 0)} decimales={DEC.estacionamientos} highlight={highlight === "tam"} cargando={enEspera("estac")} onCommit={(v) => commitEdit("estac", { estacionamientos: v })} />
          <FilaNum label="Bodegas" raw={a.bodegas ?? ""} display={cifra(a.bodegas, DEC.bodegas, 0)} decimales={DEC.bodegas} cargando={enEspera("bodega")} onCommit={(v) => commitEdit("bodega", { bodegas: v })} />
        </FilaNav>

        {/* ── Cómo lo financias ── */}
        <FilaNav id="02" titulo="Cómo lo financias" resumen={summary02} cifra={cifra02} abierta={openCard === "02"} onToggle={() => toggleCard("02")}>
          {cascade["02"] && <CascadeNote text={cascade["02"]} />}
          <FilaNum
            label="Pie" sub={pieSub} raw={pct > 0 ? pieTexto(pct) : pieDeclarado ? "0" : ""}
            display={pct > 0 ? pieTexto(pct) : pieDeclarado ? "0" : "—"} unidad="%"
            decimales={DEC.piePct} formatEco={ecoPorDefecto("", "% del precio")} escala={(v) => avisoPie(v, a.pieRazon)}
            highlight={highlight === "pie"}
            commitCeroDesdeVacio
            onCommit={(v) => {
              // Fix pie-cero: borrar el campo NO es declarar cero — el vacío se ignora y el valor
              // anterior queda. El cero se declara escribiendo "0" (y eligiendo la razón abajo).
              if (v.trim() === "") return;
              // Fase 5b: al subir el pie sobre 0, la razón se descarta en SILENCIO (misma regla
              // que el wizard), y con ella «otra fuente». Al bajarlo a 0 el selector aparece acá.
              const nuevoPct = piePct({ ...a, pieUnidad: "pct", pieMonto: v }, data.ufCLP);
              const monto = a.otraFuenteMonto && otraPct > 0 ? { otraFuenteMonto: pieTexto(Math.min(otraPct, 100)) } : {};
              commitEdit("pie", nuevoPct > 0 && a.pieRazon
                ? { pieUnidad: "pct", pieMonto: v, pieRazon: undefined, otraFuenteMonto: undefined, otraFuenteCredito: undefined, otraFuenteCuota: undefined }
                : { pieUnidad: "pct", pieMonto: v, ...monto });
            }}
          />
          {/* Fase 5b · la razón del pie 0 vive donde el usuario la declaró y se edita como el
              resto de la tarjeta. Con pie > 0 la fila no existe. */}
          {pct === 0 && pieDeclarado && (
            <FilaOpciones
              label="Cómo se cubre" value={a.pieRazon}
              sub={a.pieRazon ? "Lo indicaste tú" : "Falta: elige cómo se cubre"}
              options={PIE_RAZON_OPCIONES.map((o) => ({ value: o.value, label: RAZON_CORTA[o.value] }))}
              cargando={enEspera("pie")} onCommit={(v) => commitEdit("pie", v === "otra_fuente" ? { pieRazon: v } : { pieRazon: v, otraFuenteMonto: undefined, otraFuenteCredito: undefined, otraFuenteCuota: undefined })}
            />
          )}
          {/* «Otra fuente» (27-sep-2026): el monto —para el banco es pie— y, si es un crédito, su
              cuota, que entra al flujo del mes. */}
          {pct === 0 && pieDeclarado && a.pieRazon === "otra_fuente" && (
            <>
              <FilaNum
                label="Cuánto cubre"
                sub={otraPct > 0 ? `El banco financia el ${Math.round(100 - pieBanco)}%` : "Sin monto, se analiza como pie 0"}
                raw={a.otraFuenteMonto ?? ""}
                display={a.otraFuenteMonto ? cifra(a.otraFuenteMonto, decPie(unidadPie), 0) : "—"}
                unidad={unidadPie === "pct" ? "%" : unidadPie === "uf" ? " UF" : " $"}
                decimales={decPie(unidadPie)}
                escala={() => (otraPct > 100 ? escalaPie(otraPct) : null)}
                cargando={enEspera("otraFuente")} onCommit={(v) => commitEdit("otraFuente", { otraFuenteMonto: v })}
              />
              {otraPct > 0 && (
                <FilaOpciones
                  label="¿Es un crédito?" value={a.otraFuenteCredito ? "si" : "no"}
                  options={[{ value: "no" as const, label: "No" }, { value: "si" as const, label: "Sí" }]}
                  cargando={enEspera("otraFuente")} onCommit={(v) => commitEdit("otraFuente", v === "si" ? { otraFuenteCredito: true } : { otraFuenteCredito: false, otraFuenteCuota: undefined })}
                />
              )}
              {otraPct > 0 && a.otraFuenteCredito && (
                <FilaNum
                  label="Cuota de ese crédito" sub="Se suma a tu flujo mensual"
                  raw={a.otraFuenteCuota ?? ""} display={a.otraFuenteCuota ? `$${cifra(a.otraFuenteCuota, DEC.cuotaCreditoPie, 0)}` : "—"} unidad="/mes"
                  decimales={DEC.cuotaCreditoPie} formatEco={ecoPorDefecto("$", " al mes")}
                  cargando={enEspera("otraFuente")} onCommit={(v) => commitEdit("otraFuente", { otraFuenteCuota: v })}
                />
              )}
            </>
          )}
          <FilaOpciones
            label="Plazo" value={a.plazoCredito}
            options={[{ value: "15", label: "15 años" }, { value: "20", label: "20 años" }, { value: "25", label: "25 años" }, { value: "30", label: "30 años" }]}
            cargando={enEspera("plazo")} onCommit={(v) => commitEdit("plazo", { plazoCredito: v })}
          />
          {calificaSubsidioV4(a) ? (
            <FilaOpciones
              label="Tasa" value={conSubsidio ? "sub" : a.tasaModo === "estimada" ? "mer" : undefined}
              sub={tasaTag ? tasaTag.charAt(0).toUpperCase() + tasaTag.slice(1) : undefined}
              options={[{ value: "sub", label: `Subsidio ${tasaStr(tasaConSubsidioV4(data.tasaMercado))}%` }, { value: "mer", label: `Mercado ${tasaStr(data.tasaMercado)}%` }]}
              cargando={enEspera("tasa")} onCommit={(v) => commitEdit("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(v === "sub" ? tasaConSubsidioV4(data.tasaMercado) : data.tasaMercado) })}
              fuente={conSubsidio ? "Subsidio estatal a la tasa (Ley 21.748): vivienda nueva en primera venta." : undefined}
            />
          ) : (
            <FilaNum
              label="Tasa" sub={tasaTag ? tasaTag.charAt(0).toUpperCase() + tasaTag.slice(1) : undefined}
              raw={a.tasaInteres ?? ""} display={cifra(a.tasaInteres, DEC.tasa, 0)} unidad="% anual"
              decimales={DEC.tasa} formatEco={ecoPorDefecto("", "% anual")} escala={escalaTasa}
              highlight={highlight === "tasa"}
              cargando={enEspera("tasa")} onCommit={(v) => commitEdit("tasa", { tasaModo: "preaprobada", tasaInteres: v })}
            />
          )}
          {cuota > 0 && <FilaFija label="Tu cuota mensual" sub="Calculada con el pie, el plazo y la tasa" valor={fmtCLP(cuota)} />}
          {cuotaPie > 0 && <FilaFija label="Cuota del crédito del pie" sub="Declarada por ti" valor={fmtCLP(cuotaPie)} />}
        </FilaNav>

        {/* ── Cómo lo rentabilizas ── */}
        <FilaNav id="03" titulo="Cómo lo rentabilizas" resumen={summary03} cifra={cifra03} abierta={openCard === "03"} onToggle={() => toggleCard("03")}>
          {cascade["03"] && <CascadeNote text={cascade["03"]} />}

          {esLtr && (
            <>
              {esStr && <SubRot>Renta larga</SubRot>}
              <FilaNum
                label="Arriendo mensual" sub={arriendoTag}
                raw={a.arriendo ?? String(sugArriendo || "")} display={arriendoVal > 0 ? fmtCLP(arriendoVal) : "—"} unidad="/mes"
                decimales={DEC.arriendo} formatEco={ecoPorDefecto("$", " al mes")} escala={escalaArriendo}
                fuente={fuenteArriendoLine(data.arriendoFuente, data.arriendoN, data.radiusUsed, data.arriendoRango)}
                highlight={highlight === "arr"}
                cargando={enEspera("arr")} onCommit={(v) => commitEdit("arr", { arriendo: v, arrModo: "corregir" })}
              />
              {/* 30-sep-2026: el arriendo compara contra lo mismo que ofrece la persona. Si tomó la
                  estimación, el arriendo sigue a la sugerencia nueva; si lo corrigió, queda el suyo. */}
              <FilaOpciones
                label="Amoblado"
                sub={a.amoblado === "si" ? "Se compara con arriendos amoblados de la zona" : "Se compara con arriendos sin amoblar de la zona"}
                value={a.amoblado ?? "no"}
                options={OPCIONES_AMOBLADO}
                cargando={enEspera("amoblado")}
                onCommit={(v) => commitEdit("amoblado", { amoblado: v, ...(a.arrModo === "corregir" ? {} : { arriendo: undefined }) })}
              />
              <SubRot>Lo que se descuenta</SubRot>
              <FilaNum label="Gastos comunes" sub={a.gastosComunes ? "Corregido por ti" : "Típicos de la comuna"} raw={a.gastosComunes ?? formatNumeroCL(Math.round(ggccDef), DEC.gastosComunes)} display={`$${cifra(a.gastosComunes, DEC.gastosComunes, Math.round(ggccDef))}`} unidad="/mes" decimales={DEC.gastosComunes} formatEco={ecoPorDefecto("$", " al mes")} cargando={enEspera("gastosComunes")} onCommit={(v) => commitEdit("gastosComunes", { gastosComunes: v })} />
              <FilaNum label="Contribuciones" sub={a.contribuciones ? "Corregido por ti" : "Fórmula del SII"} raw={a.contribuciones ?? formatNumeroCL(Math.round(contribDef), DEC.contribuciones)} display={`$${cifra(a.contribuciones, DEC.contribuciones, Math.round(contribDef))}`} unidad="/trim" decimales={DEC.contribuciones} formatEco={ecoPorDefecto("$", " al trimestre")} cargando={enEspera("contribuciones")} onCommit={(v) => commitEdit("contribuciones", { contribuciones: v })} />
              <FilaNum label="Vacancia" sub={a.vacanciaPct ? "Corregido por ti" : "Meses sin arrendatario al año"} raw={a.vacanciaPct ?? "5"} display={cifra(a.vacanciaPct ?? "5", DEC.vacancia, 5)} unidad="%" decimales={DEC.vacancia} formatEco={ecoPorDefecto("", "% del año")} escala={escalaVacancia} highlight={highlight === "vacanciaPct"} cargando={enEspera("vacanciaPct")} onCommit={(v) => commitEdit("vacanciaPct", { vacanciaPct: v })} />
              <FilaNum label="Comisión de administración" sub="0 = lo administras tú; corredor típico 7-10%" raw={a.comisionAdminPct ?? "0"} display={cifra(a.comisionAdminPct ?? "0", DEC.comisionAdmin, 0)} unidad="%" decimales={DEC.comisionAdmin} formatEco={ecoPorDefecto("", "% del arriendo")} escala={escalaComision} highlight={highlight === "comisionAdminPct"} cargando={enEspera("comisionAdminPct")} onCommit={(v) => commitEdit("comisionAdminPct", { comisionAdminPct: v })} />
            </>
          )}

          {esStr && (
            <>
              {esLtr && <SubRot>Renta corta</SubRot>}
              <FilaNum
                label="Tarifa por noche" sub={a.adrModo === "corregir" ? "Corregida por ti" : "Estimada por Franco"}
                raw={a.adrTarifa ?? String(sugTarifa || "")} display={tarifaVal > 0 ? fmtCLP(tarifaVal) : "—"}
                decimales={DEC.tarifa} formatEco={ecoPorDefecto("$", " la noche")} escala={escalaTarifa}
                fuente="Datos de mercado de Airbnb de la zona, últimos 90 días." highlight={highlight === "adr"}
                cargando={enEspera("adr")} onCommit={(v) => commitEdit("adr", { adrTarifa: v, adrModo: "corregir" })}
              />
              <FilaNum
                label="Ocupación" sub={a.adrModo === "corregir" ? "Corregida por ti" : "Estimada por Franco"}
                raw={String(a.adrOcupacion ?? (sugOcc || ""))} display={cifra(String(a.adrOcupacion ?? (sugOcc || "")), DEC.ocupacion, 0)} unidad="%"
                decimales={DEC.ocupacion} formatEco={ecoPorDefecto("", "% de las noches")} escala={escalaOcupacion}
                highlight={highlight === "adr"}
                cargando={enEspera("adr")} onCommit={(v) => commitEdit("adr", { adrOcupacion: v, adrModo: "corregir" })}
              />
              <SubRot>Operación</SubRot>
              <FilaOpciones
                label="Quién lo opera" value={admin ? "administrador" : "auto"}
                options={[{ value: "auto" as const, label: "Lo opero yo" }, { value: "administrador" as const, label: "Un administrador" }]}
                cargando={enEspera("modoGestion")} onCommit={(v) => commitEdit("modoGestion", { modoGestion: v })}
              />
              {admin ? (
                <FilaNum
                  label="Comisión" sub="Del ingreso, en lugar del 3% de la plataforma"
                  raw={a.comisionStrPct ?? "20"} display={cifra(a.comisionStrPct ?? "20", DEC.comisionAdmin, 20)} unidad="%"
                  decimales={DEC.comisionAdmin} formatEco={ecoPorDefecto("", "% del ingreso")} escala={escalaComision}
                  cargando={enEspera("comisionStrPct")} onCommit={(v) => commitEdit("comisionStrPct", { comisionStrPct: v })}
                />
              ) : (
                <FilaFija label="Comisión" sub="La de la plataforma: fija con «lo opero yo»" valor="3%" />
              )}
              <FilaNum
                label="Huéspedes" sub={a.capacidadHuespedes ? "Lo indicaste tú" : "Dos por dormitorio"}
                raw={a.capacidadHuespedes ?? String(huespedesNum(a))} display={String(huespedesNum(a))}
                decimales={DEC.huespedes} formatEco={(v) => `${v} ${v === 1 ? "huésped" : "huéspedes"}`}
                cargando={enEspera("huespedes")} onCommit={(v) => commitEdit("huespedes", { capacidadHuespedes: v })}
              />
              <FilaOpciones
                label="Amoblado" value={amoblado ? "si" : "no"}
                options={[{ value: "no" as const, label: "No" }, { value: "si" as const, label: "Sí" }]}
                cargando={enEspera("amoblado")} onCommit={(v) => commitEdit("amoblado", { estaAmoblado: v === "si" })}
              />
              <SubRot>Costos</SubRot>
              <FilaNum label="Luz, agua, wifi e insumos" sub={totalOpsEditado ? "Corregido por ti" : `Típico para ${tipologia}`} raw={totalOpsEditado ?? String(totalOpsDef)} display={`$${cifra(totalOpsEditado, DEC.costos, totalOpsDef)}`} unidad="/mes" decimales={DEC.costos} formatEco={ecoPorDefecto("$", " al mes")} cargando={enEspera("costoInsumos")} onCommit={(v) => commitEdit("costoInsumos", { costosOperativos: v })} />
              <FilaNum label="Mantención" sub={a.mantencionStr ? "Corregido por ti" : `Provisión mensual para ${tipologia}`} raw={a.mantencionStr ?? String(costos.mantencion)} display={`$${cifra(a.mantencionStr, DEC.costos, costos.mantencion)}`} unidad="/mes" decimales={DEC.costos} formatEco={ecoPorDefecto("$", " al mes")} cargando={enEspera("mantencionStr")} onCommit={(v) => commitEdit("mantencionStr", { mantencionStr: v })} />
              {!esLtr && (
                <>
                  <FilaNum label="Gastos comunes" sub={a.gastosComunes ? "Corregido por ti" : "Típicos de la comuna"} raw={a.gastosComunes ?? formatNumeroCL(Math.round(ggccDef), DEC.gastosComunes)} display={`$${cifra(a.gastosComunes, DEC.gastosComunes, Math.round(ggccDef))}`} unidad="/mes" decimales={DEC.gastosComunes} formatEco={ecoPorDefecto("$", " al mes")} cargando={enEspera("gastosComunes")} onCommit={(v) => commitEdit("gastosComunes", { gastosComunes: v })} />
                  <FilaNum label="Contribuciones" sub={a.contribuciones ? "Corregido por ti" : "Fórmula del SII"} raw={a.contribuciones ?? formatNumeroCL(Math.round(contribDef), DEC.contribuciones)} display={`$${cifra(a.contribuciones, DEC.contribuciones, Math.round(contribDef))}`} unidad="/trim" decimales={DEC.contribuciones} formatEco={ecoPorDefecto("$", " al trimestre")} cargando={enEspera("contribuciones")} onCommit={(v) => commitEdit("contribuciones", { contribuciones: v })} />
                </>
              )}
              {!amoblado && (
                <FilaNum label="Amoblarlo" sub={a.costoAmoblamiento ? "Corregido por ti" : "Una vez"} raw={a.costoAmoblamiento ?? String(costos.costoAmoblamiento)} display={`$${cifra(a.costoAmoblamiento, DEC.costos, costos.costoAmoblamiento)}`} decimales={DEC.costos} formatEco={ecoPorDefecto("$", ", una vez")} cargando={enEspera("costoAmoblamiento")} onCommit={(v) => commitEdit("costoAmoblamiento", { costoAmoblamiento: v })} />
              )}
            </>
          )}
        </FilaNav>
      </div>

      {alFilo && (
        <button type="button" onClick={onAlfiloTap} className="wz-bloque wz-alfilo">
          <span className="wz-bt">Este análisis es sensible {sensibleA(dryRun.variablesSensibles)}</span>
          <span className="wz-alfilo-t">Una diferencia pequeña cambia el veredicto. Tócalo para ir directo a revisarlo.</span>
        </button>
      )}

      {(error || anomalias.length > 0) && (
        <div className="wz-bloque wz-error" role="alert">
          {/* Con anomalías se muestra la de mayor prioridad (el server ya las ordenó). El resto
              vive en `anomalias` para el modal. */}
          <p>{anomalias.length > 0 ? anomalias[0].mensaje : error}</p>
        </div>
      )}

      <ModalPlausibilidad
        open={modalAbierto}
        anomalias={anomalias}
        origenes={origenes}
        resumen={{
          direccion: sinCodigoPostal(a.direccion || "") || a.comuna || "Tu análisis",
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

      {/* El botón, fijo abajo: el mismo de todo el wizard. */}
      <BarraCta>
        <FinalCTA mod={mod} isLoggedIn={isLoggedIn} anonCap={anonCap} canAnalyze={canAnalyze} submitting={submitting} incompleto={incompleto || bloqueadoPorAnomalia} onAbrir={abrirConfirmacion} onTerminal={onTerminal} />
        {lineaBajoCta && <p className="wz-bajo-cta">{lineaBajoCta}</p>}
      </BarraCta>
    </div>
  );
}

/**
 * Los valores de renta del resumen (y del modal): lo escrito o, si no hay, la estimación de la
 * zona. Una sola lectura para las filas de «Cómo lo rentabilizas» y para los derivados del modal.
 */
export function valoresRenta(a: WizardV4Answers, data: WizardV4Data) {
  const sugArriendo = data.arriendoSugerido ?? 0;
  const occRef = data.airRoi.ocupacionReferencia;
  const sugTarifa = data.airRoi.ingresoBrutoMensual > 0 && occRef > 0 ? Math.round(data.airRoi.ingresoBrutoMensual / (DIAS_MES * occRef)) : 0;
  const sugOcc = occRef > 0 ? Math.round(occRef * 100) : 0;
  return {
    sugArriendo,
    sugTarifa,
    sugOcc,
    arriendoVal: leerNum(a.arriendo, DEC.arriendo) || sugArriendo,
    tarifaVal: leerNum(a.adrTarifa, DEC.tarifa) || sugTarifa,
    occVal: leerNum(a.adrOcupacion, DEC.ocupacion) || sugOcc,
  };
}

/**
 * Los DERIVADOS del estado limpio del modal de confirmación. Nunca repiten lo que el usuario
 * tipeó: son los números que no vio en ninguna pantalla y que delatan un error de magnitud aunque
 * no llegue al umbral del guard. Formateo con los helpers del MÓDULO de plausibilidad, no propios
 * (tener dos hacía salir "106667" acá y "106.667" en el estado anomalía).
 *
 * · EL PIE ES EL QUE VE EL BANCO (27-sep-2026): con «otra fuente», el monto de esa fuente
 *   (`pieEfectivoPct`), no el $0 del campo del pie. En la unidad en que se escribió: pesos si se
 *   escribió en pesos; si no, UF.
 * · EL RETORNO ES EL DE LA MODALIDAD. En renta larga y en AMBAS, el de renta larga (sale del
 *   arriendo contra el precio). En renta corta, el de renta corta —tarifa × ocupación, escrita o
 *   estimada, contra el precio— o nada si no hay con qué. Antes renta corta decía «Retorno bruto
 *   LTR»: un número de una modalidad que el usuario no eligió.
 */
export function derivadosConfirmacion(a: WizardV4Answers, data: WizardV4Data): Array<{ label: string; valor: string }> {
  const uf = data.ufCLP;
  const pUF = precioUF(a);
  const sup = superficieM2(a);
  const cuota = cuotaCLP(a, uf);
  const precioCLPTotal = pUF * uf;
  const esLtr = a.modalidad === "ltr" || a.modalidad === "both";
  const { arriendoVal, tarifaVal, occVal } = valoresRenta(a, data);

  const pieDeclarado = (a.pieMonto ?? "").trim() !== "";
  const pieBanco = pieEfectivoPct(a, uf);
  const otra = otraFuentePctCrudo(a, uf) > 0;
  const pieBancoUF = (pUF * pieBanco) / 100;
  const enPesos = (a.pieUnidad ?? "pct") === "clp";
  // Fase 5b: pie 0 declarado muestra 0 (dato), no "—" (ausencia).
  const pieValor = pieBanco > 0 || pieDeclarado
    ? enPesos ? fmtCLP(pieBancoUF * uf) : fmtUF(pieBancoUF)
    : "—";

  const ufM2 = pUF > 0 && sup > 0 ? pUF / sup : 0;
  const out = [
    { label: "Precio", valor: ufM2 > 0 ? `${formatearNumero(ufM2)} UF/m²` : "—" },
    { label: "Dividendo", valor: cuota > 0 ? `${fmtCLP(cuota)}/mes` : "—" },
    { label: otra ? "Pie (otra fuente)" : "Pie", valor: pieValor },
  ];
  if (esLtr) {
    const r = precioCLPTotal > 0 && arriendoVal > 0 ? (arriendoVal * 12) / precioCLPTotal : 0;
    out.push({ label: "Retorno bruto", valor: r > 0 ? `${formatearPct(r)} anual` : "—" });
  } else {
    const r = precioCLPTotal > 0 && tarifaVal > 0 && occVal > 0 ? (tarifaVal * DIAS_MES * (occVal / 100) * 12) / precioCLPTotal : 0;
    if (r > 0) out.push({ label: "Retorno bruto", valor: `${formatearPct(r)} anual` });
  }
  return out;
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
      ? "El primero va por cuenta de Franco."
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
  // El botón de avanzar del wizard (`.wz-cta`): píldora roja a todo el ancho.
  const cls = "wz-cta wz-cta-final";
  if (isLoggedIn && canAnalyze) {
    // Sin "· 1 crédito": era falso para ilimitados y admins, y el consumo real
    // lo dice `lineaConsumo` según el tier. El botón solo nombra la acción.
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} data-presionado={submitting ? "1" : undefined} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Generando…</> : <>Generar el análisis</>}</button>;
  }
  if (isLoggedIn) {
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} data-presionado={submitting ? "1" : undefined} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Te llevamos a pagar…</> : <>Desbloquear este análisis{mod === "both" ? " comparativo" : ""} · {fmtCLP(SINGLE_PRICE)}</>}</button>;
  }
  // Anónimo con cap disponible (F2-2): el CTA genera DE VERDAD — mismo camino
  // del modal de confirmación; el submit sale sin sesión y el server emite la
  // cookie del cap con el response.
  if (anonCap) {
    return <button type="button" onClick={onAbrir} disabled={submitting || incompleto} data-presionado={submitting ? "1" : undefined} className={cls}>{submitting ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Generando…</> : <>Generar mi análisis gratis</>}</button>;
  }
  // Anónimo con cap consumido: muro de registro (baseline del funnel).
  if (incompleto) {
    return <button type="button" disabled className={cls}>Regístrate para continuar →</button>;
  }
  return <Link href={`/register?next=${encodeURIComponent("/analisis/nuevo-v4?resume=1")}`} onClick={onTerminal} className={cls}>Regístrate para continuar →</Link>;
}
