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
      return {
        kick: "Precio por metro",
        title: "Estás pagando de más por el metro cuadrado",
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
      return {
        kick: "Flujo mensual",
        title: "Lo que sale de tu bolsillo cada mes",
        kpi: fmtSigned(v.flujoNetoMensualCLP, currency, valorUF),
        kpiRed: v.flujoNetoMensualCLP < 0, // monetario negativo (uso Signal Red #2)
        ksub: "cada mes · sale de tu bolsillo, no del arriendo",
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
}: {
  hallazgo: Hallazgo;
  /** 1 = decisivo (grande) · 2 = segundo plano (mediano) · 3 = revisado (chip). */
  nivel: 1 | 2 | 3;
  currency?: "CLP" | "UF";
  /** UF del snapshot — para formatear montos cuando currency = "UF". */
  valorUF: number;
  /** Zona de "palanca" opcional (nivel 1): acción/CTA bajo un border-top. */
  palanca?: React.ReactNode;
}) {
  const d = findingDisplay(hallazgo, currency, valorUF);
  const dir = direccionMeta(hallazgo.direccion);
  const kpiColor = d.kpiRed ? "text-signal-red" : "";

  // Tokens de tamaño por nivel (escala del mockup: tier1 > tier2 > tier3).
  const pad = nivel === 1 ? "p-7" : nivel === 2 ? "p-6" : "p-4";
  const titleSize = nivel === 1 ? "text-[22px]" : nivel === 2 ? "text-[18px]" : "text-[15px]";
  const kpiSize = nivel === 1 ? "text-[36px]" : nivel === 2 ? "text-[28px]" : "text-[22px]";
  const resumenSize = nivel === 3 ? "text-[12.5px]" : "text-[13.5px]";
  const border = nivel === 1 ? "var(--franco-border-strong)" : "var(--franco-border)";
  const bg = nivel === 3 ? "rgba(26,26,26,0.55)" : "var(--franco-card)";
  const kick = nivel === 1 ? `Lo más decisivo · ${d.kick.toLowerCase()}` : d.kick;

  return (
    <div
      className={`rounded-2xl ${pad}`}
      style={{ background: bg, border: `0.5px solid ${border}` }}
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

      {/* resumen = fraseCanonica (el motor la escribe; la IA la reescribe aguas abajo) */}
      <p className={`font-body leading-[1.55] mt-3.5 ${resumenSize}`} style={{ color: "var(--franco-text-secondary)" }}>
        {hallazgo.fraseCanonica}
      </p>

      {/* palanca opcional (nivel 1): border-top + slot de acción */}
      {nivel === 1 && palanca ? (
        <div className="mt-4 pt-3.5" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
          {palanca}
        </div>
      ) : null}

      {/* pie: SOLO un caveat de procedencia que aclara cómo leer el dato (niveles
          1-2). Sin barra de confianza. Sin decisividad. Si no hay caveat real, no
          hay pie (el boilerplate "sobre tus datos declarados" no se muestra). */}
      {nivel !== 3 && d.procedencia ? (
        <div className="mt-4 pt-3.5" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
          <span className="font-body" style={{ fontSize: 11, color: "var(--franco-text-muted)" }}>
            {d.procedencia}
          </span>
        </div>
      ) : null}
    </div>
  );
}
