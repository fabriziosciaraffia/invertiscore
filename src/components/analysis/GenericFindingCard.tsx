// GenericFindingCard — card genérica de UN hallazgo del motor (Fase 1b · ladrillo).
//
// Renderiza cualquiera de los 6 hallazgos tipados con jerarquía visual en 3
// niveles (prop `nivel`). NO monta la pirámide ni decide el nivel: recibe el
// hallazgo ya ordenado y el nivel asignado por el caller.
//
// Doctrina de diseño (franco-design-system):
//  - 2 colores: Ink + Signal Red. Dirección FAVORABLE va en Ink 400 (--franco-v-buy),
//    NO en verde (cero verde es regla dura de marca). Signal Red solo en el punto
//    de dirección ADVERSO y en el KPI cuando el valor es críticamente adverso.
//  - Decisividad NUNCA se muestra como número: se traduce SOLO en nivel/tamaño/color.
//    El pie muestra procedencia + confianza (no un "peso 0.85").
//  - Tipografía: Serif (title), Sans (resumen), Mono (kick/kpi/labels).
//  - Anatomía y tokens del mockup aprobado (mockup-piramide.html), con --franco-*.

import type { Hallazgo } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { procedenciaExtendida } from "@/lib/procedencia-extendida";

// Mapa hallazgo → drawer de detalle. Los 6 hallazgos LTR tienen drawer (cap_rate
// se sumó en Fase 3). Sin entrada ⇒ sin affordance "Ver detalle".
const HALLAZGO_DRAWER: Partial<Record<Hallazgo["id"], DrawerKey>> = {
  flujo_mensual: "costoMensual",
  cap_rate: "capRate",
  sobreprecio: "negociacion",
  plusvalia: "largoPlazo",
  capex_puesta_a_punto: "capexPuestaAPunto",
  estructura_financiamiento: "reestructuracion",
  tir: "negociacion", // la tabla TIR-por-precio ya vive en el drawer negociación
};

// ── Formato (tuteo neutro, coma decimal chilena) ──────────────────────────────
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtUF = (n: number) => "UF " + Math.round(n).toLocaleString("es-CL");
const fmtSigned = (n: number, currency: "CLP" | "UF", valorUF: number) => {
  const sign = n < 0 ? "−" : "+";
  const abs = Math.abs(n);
  return sign + (currency === "UF" ? fmtUF(valorUF > 0 ? abs / valorUF : 0) : fmtCLP(abs));
};

// ── Mapper hallazgo → campos display (kick/title/kpi/ksub) ─────────────────────
// Espejo determinístico de describeHallazgo (HeroLTR) + fraseo del mockup. Aislado
// acá a propósito (ladrillo self-contained; la unificación es un paso posterior).
interface FindingDisplay {
  kick: string;      // categoría (mono uppercase)
  title: string;     // headline (serif)
  kpi: string;       // dato dominante (mono)
  kpiRed: boolean;   // KPI en Signal Red si el valor es críticamente adverso
  ksub: string;      // sub-label del KPI (mono uppercase)
  // Caveat de fuente/método al pie — SOLO cuando aclara cómo leer el dato (ej.
  // "publicación, no transacción"). El boilerplate "sobre tus datos declarados"
  // NO se muestra (no aporta). undefined ⇒ sin pie de procedencia.
  procedencia?: string;
}

function findingDisplay(h: Hallazgo, currency: "CLP" | "UF", valorUF: number): FindingDisplay {
  switch (h.id) {
    case "sobreprecio": {
      const v = h.valor;
      const sobre = v.desviacionPct > 0;
      // Título direction-aware (antes hardcodeaba "pagando de más" → mentía en
      // favorable). Trío espejo del motor: borde |desv|≤2 = "a precio de zona"
      // (EN_LINEA_UMBRAL_PCT), luego favorable (bajo mediana) vs adverso (sobre).
      const enLinea = Math.abs(v.desviacionPct) <= 2;
      const title = enLinea
        ? "Pagas el metro a precio de zona"
        : sobre
          ? "Estás pagando de más por el metro cuadrado"
          : "Entras barato por el metro cuadrado";
      return {
        kick: "Precio por metro",
        title,
        kpi: `${sobre ? "+" : ""}${Math.round(v.desviacionPct)}%`,
        kpiRed: sobre, // pagar sobre la mediana = críticamente adverso (mockup)
        ksub: `${sobre ? "sobre" : "bajo"} la mediana · UF ${pct1(v.sujetoUfM2)} vs UF ${pct1(v.medianaComunaUfM2)} /m²`,
        procedencia: "Mediana de publicación de venta de la comuna, no transacción",
      };
    }
    case "cap_rate": {
      const v = h.valor;
      return {
        kick: "Rendimiento operativo",
        title: "Lo que renta hoy vs lo que debería",
        kpi: `${pct1(v.capRatePct)}%`,
        kpiRed: false,
        ksub: `cap rate · ${pct1(Math.abs(v.gapPts))} pts ${v.gapPts < 0 ? "bajo" : "sobre"} el mercado (${pct1(v.capRefPct)}%)`,
      };
    }
    case "flujo_mensual": {
      const v = h.valor;
      // Título + ksub direction-aware (antes hardcodeaba "sale de tu bolsillo" →
      // mentía en favorable, cuando el arriendo cubre todo y te QUEDA plata).
      const favorable = v.flujoNetoMensualCLP >= 0;
      return {
        kick: "Flujo mensual",
        title: favorable ? "Lo que te queda cada mes" : "Lo que sale de tu bolsillo cada mes",
        kpi: fmtSigned(v.flujoNetoMensualCLP, currency, valorUF),
        kpiRed: v.flujoNetoMensualCLP < 0, // monetario negativo (uso Signal Red #2)
        ksub: favorable
          ? "cada mes · te queda después de todos los costos"
          : "cada mes · sale de tu bolsillo, no del arriendo",
      };
    }
    case "estructura_financiamiento": {
      const v = h.valor;
      const pieFmt = Number.isInteger(v.piePct) ? String(v.piePct) : pct1(v.piePct);
      return {
        kick: "Estructura de la compra",
        title: "Cómo estás financiando",
        kpi: `Pie ${pieFmt}%`,
        kpiRed: false,
        ksub: `tasa ${pct1(v.tasaPct)}% · óptimo de pie 25%`,
        procedencia: "Tasa comparada contra referencia de mercado, no en tiempo real",
      };
    }
    case "capex_puesta_a_punto": {
      const v = h.valor;
      return {
        kick: "Puesta a punto",
        title: "Dejarlo listo para arrendar",
        kpi: `+${currency === "UF" ? fmtUF(v.montoUF) : fmtCLP(v.montoCLP)}`,
        kpiRed: false,
        ksub: `UF ${Math.round(v.montoUF)} · ${Math.round(v.fraccionInversion * 100)}% de tu inversión inicial`,
      };
    }
    case "plusvalia": {
      const v = h.valor;
      return {
        kick: "Plusvalía histórica",
        title: "Cuánto se ha valorizado la zona",
        kpi: `${pct1(v.anualizadaPct)}%`,
        kpiRed: false,
        ksub: `anual · 2014-2024 · umbral real ${pct1(v.refPct)}%`,
        procedencia: v.tieneData ? "Histórico 2014-2024 · Arenas & Cayo, Tinsa, Propital" : undefined,
      };
    }
    case "tir": {
      const v = h.valor;
      const bajo = v.gapPts < 0;
      return {
        kick: "Retorno total",
        title: "Lo que rinde puesto todo junto",
        kpi: `${pct1(v.tirPct)}%`,
        // false — espejo de cap_rate (el otro hallazgo de %-retorno): el KPI queda en Ink;
        // el punto de dirección "En contra" carga la señal adversa. Sin rojo extra.
        kpiRed: false,
        ksub: `TIR a 10 años · ${pct1(Math.abs(v.gapPts))} pts ${bajo ? "bajo" : "sobre"} el mínimo de ${v.umbralPct}%`,
      };
    }
  }
}

// ── Dirección: punto + micro-label. Ink para favorable (cero verde). ──────────
function direccionMeta(dir: string): { color: string; label: string } {
  if (dir === "adverso") return { color: "var(--franco-v-avoid)", label: "En contra" };
  if (dir === "favorable") return { color: "var(--franco-v-buy)", label: "A favor" };
  return { color: "var(--franco-text-tertiary)", label: "Leve" };
}

// ── Componente ────────────────────────────────────────────────────────────────
export function GenericFindingCard({
  hallazgo,
  nivel,
  currency = "CLP",
  valorUF,
  palanca,
  esElMasDecisivo = true,
  bodyDuplicado = false,
  onOpenDrawer,
}: {
  hallazgo: Hallazgo;
  /** 1 = decisivo (grande) · 2 = segundo plano (mediano) · 3 = revisado (chip). */
  nivel: 1 | 2 | 3;
  currency?: "CLP" | "UF";
  /** UF del snapshot — para formatear montos cuando currency = "UF". */
  valorUF: number;
  /** Zona de "palanca" opcional (nivel 1): acción/CTA bajo un border-top. */
  palanca?: React.ReactNode;
  /** Solo aplica al nivel 1 (corona): si el coronado ES el de mayor decisividad
   *  del set, el kicker dice "Lo más decisivo"; si no (la corona la gana el orden
   *  Filosofía 1, no la decisividad), dice "Ojo antes de firmar" — honesto, sin
   *  afirmar un peso que el dato no respalda. Default true: no altera otros callers. */
  esElMasDecisivo?: boolean;
  /** Suprime el <p> body (fraseCanonica) cuando ese texto YA lo dice la apertura de
   *  la prosa (respuestaDirecta abre con la misma fraseCanonica del coronado). Evita
   *  que el usuario lea el mismo bloque dos veces en una pantalla. Lo computa el caller
   *  (PiramideHallazgos) por detección directa. Default false → body se muestra
   *  (backward-compat con todos los demás callers y con niveles 2/3). */
  bodyDuplicado?: boolean;
  /** Abre el drawer de detalle del hallazgo. Sin este callback, no hay affordance. */
  onOpenDrawer?: (key: DrawerKey) => void;
}) {
  const d = findingDisplay(hallazgo, currency, valorUF);
  const dir = direccionMeta(hallazgo.direccion);
  // Caveat corto de procedencia (pie): se suprime cuando la corona muestra la
  // procedencia extendida en el body (bodyDuplicado) — Flag A, no duplicar procedencia.
  const procedenciaCorta = bodyDuplicado ? undefined : d.procedencia;
  const kpiColor = d.kpiRed ? "text-signal-red" : "";

  // Affordance de detalle: solo cuando el hallazgo mapea a un drawer Y hay handler.
  const drawerKey = HALLAZGO_DRAWER[hallazgo.id];
  const hasDetalle = !!drawerKey && !!onOpenDrawer;
  const openDetalle = () => {
    if (drawerKey && onOpenDrawer) onOpenDrawer(drawerKey);
  };
  // Nivel 3: el chip completo es el trigger (sin texto extra). Niveles 1-2: link.
  const chipClickable = nivel === 3 && hasDetalle;

  // Tokens de tamaño por nivel (escala del mockup: tier1 > tier2 > tier3).
  const pad = nivel === 1 ? "p-7" : nivel === 2 ? "p-6" : "p-4";
  const titleSize = nivel === 1 ? "text-[22px]" : nivel === 2 ? "text-[18px]" : "text-[15px]";
  const kpiSize = nivel === 1 ? "text-[36px]" : nivel === 2 ? "text-[28px]" : "text-[22px]";
  const resumenSize = nivel === 3 ? "text-[12.5px]" : "text-[13.5px]";
  const border = nivel === 1 ? "var(--franco-border-strong)" : "var(--franco-border)";
  const bg = nivel === 3 ? "rgba(26,26,26,0.55)" : "var(--franco-card)";
  const kickPrefix = esElMasDecisivo ? "Lo más decisivo" : "Ojo antes de firmar";
  const kick = nivel === 1 ? `${kickPrefix} · ${d.kick.toLowerCase()}` : d.kick;

  return (
    <div
      className={`rounded-2xl ${pad} ${chipClickable ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
      style={{ background: bg, border: `0.5px solid ${border}` }}
      {...(chipClickable
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: openDetalle,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetalle();
              }
            },
          }
        : {})}
    >
      {/* head: kick + title (izq) · punto de dirección (der) */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className="font-mono uppercase tracking-[0.07em]"
            style={{ fontSize: 10, color: "var(--franco-text-tertiary)" }}
          >
            {kick}
          </div>
          <div
            className={`font-serif font-bold leading-[1.2] mt-2 ${titleSize}`}
            style={{ color: nivel === 3 ? "var(--franco-text-secondary)" : "var(--franco-text)" }}
          >
            {d.title}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0 pt-1">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: dir.color }} aria-hidden />
          <span
            className="font-mono uppercase tracking-[0.06em]"
            style={{ fontSize: 9, color: "var(--franco-text-tertiary)" }}
          >
            {dir.label}
          </span>
        </span>
      </div>

      {/* KPI dominante + sub-label */}
      <div className={`font-mono font-bold leading-none mt-3.5 ${kpiSize} ${kpiColor}`}
        style={kpiColor ? undefined : { color: nivel === 3 ? "var(--franco-text-secondary)" : "var(--franco-text)" }}
      >
        {d.kpi}
      </div>
      <div
        className="font-mono uppercase tracking-[0.05em] mt-2"
        style={{ fontSize: 10, color: "var(--franco-text-tertiary)" }}
      >
        {d.ksub}
      </div>

      {/* resumen = fraseCanonica (el motor la escribe; la IA la reescribe aguas abajo).
          Se OMITE cuando bodyDuplicado: la apertura de la prosa ya abrió con esta misma
          fraseCanonica y repetirla sería el mismo bloque dos veces. Al no renderizar el
          <p> tampoco queda su margen → sin hueco; el pie/procedencia toma su mt propio. */}
      {!bodyDuplicado ? (
        <p className={`font-body leading-[1.55] mt-3.5 ${resumenSize}`} style={{ color: "var(--franco-text-secondary)" }}>
          {hallazgo.fraseCanonica}
        </p>
      ) : (
        // Corona sin body: la prosa ya abrió con esta misma fraseCanonica. En vez de
        // dejar aire vertical, mostramos la procedencia extendida (de dónde sale el
        // dato). Reemplaza también el caveat corto del pie (procedenciaCorta, Flag A).
        <p className={`font-body leading-[1.55] mt-3.5 ${resumenSize}`} style={{ color: "var(--franco-text-muted)" }}>
          {procedenciaExtendida(hallazgo, currency, valorUF)}
        </p>
      )}

      {/* palanca opcional (nivel 1): border-top + slot de acción */}
      {nivel === 1 && palanca ? (
        <div className="mt-4 pt-3.5" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
          {palanca}
        </div>
      ) : null}

      {/* pie (niveles 1-2): caveat de procedencia (izq, cuando aclara cómo leer el
          dato) + affordance "Ver detalle →" (abajo-derecha). Sin barra de confianza,
          sin decisividad. Se muestra si hay procedencia real o hay drawer conectado. */}
      {nivel !== 3 && (procedenciaCorta || hasDetalle) ? (
        <div
          className="mt-4 pt-3.5 flex items-center justify-between gap-3"
          style={{ borderTop: "0.5px solid var(--franco-border)" }}
        >
          {procedenciaCorta ? (
            <span className="font-body min-w-0" style={{ fontSize: 11, color: "var(--franco-text-muted)" }}>
              {procedenciaCorta}
            </span>
          ) : (
            <span />
          )}
          {hasDetalle ? (
            <button
              type="button"
              onClick={openDetalle}
              className="font-mono uppercase tracking-[0.06em] shrink-0 transition-colors hover:text-[var(--franco-text-secondary)]"
              style={{ fontSize: 10, color: "var(--franco-text-tertiary)" }}
            >
              Ver detalle →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
