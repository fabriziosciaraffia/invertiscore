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
import { PLUSVALIA_DEFAULT_RANGO } from "@/lib/plusvalia-estimado.gen";
import { buildFraseFlujo } from "@/lib/flujo-mensual-hallazgo";
import { distanciaFindingDisplay } from "@/lib/distancia-copy";

// Mapa hallazgo → drawer de detalle. INYECTIVO: cada card abre un drawer cuyo
// título calza con ella. Sin entrada ⇒ sin affordance "Ver detalle" (mejor puerta
// ausente que puerta equivocada). Exportado (fix-drawers): la navegación prev/next
// deriva de este mapa + el orden de la pirámide (un solo orden de verdad).
// T5: HALLAZGO_DRAWER (hallazgo → drawer LTR) murió con la pirámide y la secuencia
// prev/next; la pirámide STR pasa su propio `drawerMap`.

// ── Formato (tuteo neutro, coma decimal chilena) ──────────────────────────────
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
// Margen de sensibilidad: entero sin decimal (−7%), coma chilena si no (−7,5%).
const fmtMargin = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
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
export interface FindingDisplay {
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

// Exportado (E.5) — el HeroSTR reusa este mapper para su TOP-3 de hallazgos, así
// las filas del hero quedan bit-consistentes con las cards de la pirámide (mismo
// kpi/ksub/dirección; sin builder paralelo que pueda driftar).
export function findingDisplay(h: Hallazgo, currency: "CLP" | "UF", valorUF: number): FindingDisplay {
  switch (h.id) {
    case "sobreprecio": {
      const v = h.valor;
      const sobre = v.desviacionPct > 0;
      // Título direction-aware (antes hardcodeaba "pagando de más" → mentía en
      // favorable). Trío espejo del motor: borde |desv|≤2 = "a precio de comuna"
      // (EN_LINEA_UMBRAL_PCT), luego favorable (bajo mediana) vs adverso (sobre).
      const enLinea = Math.abs(v.desviacionPct) <= 2;
      const title = enLinea
        ? "Pagas el metro a precio de comuna"
        : sobre
          ? "Estás pagando de más por el metro cuadrado"
          : "Entras barato por el metro cuadrado";
      // R2 — nombra el nivel geográfico (la mediana es COMUNAL). Nombre propio
      // cuando cabe; fallback genérico "de la comuna" para nombres largos que
      // desbordarían el ksub mono (universo máx "Pedro Aguirre Cerda" = 19; el
      // corte 16 cubre todas las comunas del corpus, incl. "Estación Central").
      const KSUB_COMUNA_MAX = 16;
      const geo = v.comuna && v.comuna.length <= KSUB_COMUNA_MAX ? `de ${v.comuna}` : "de la comuna";
      return {
        kick: "Precio por metro",
        title,
        kpi: `${sobre ? "+" : ""}${Math.round(v.desviacionPct)}%`,
        // Rojo solo fuera de la banda "en línea": un +1% con dot neutral no puede
        // cargar Signal Red (la etiqueta y el KPI dirían cosas distintas).
        kpiRed: sobre && !enLinea,
        ksub: `${sobre ? "sobre" : "bajo"} la mediana ${geo} · UF ${pct1(v.sujetoUfM2)} vs UF ${pct1(v.medianaComunaUfM2)} /m²`,
        procedencia: "Mediana de publicación de venta de la comuna, no transacción",
      };
    }
    case "cap_rate": {
      const v = h.valor;
      // Banda "en línea" (|gap| < 0,2 — dirección neutral): el ksub no puede decir
      // "bajo/sobre el mercado" mientras el dot dice "Leve" y la prosa "en línea".
      const capEnLinea = Math.abs(v.gapPts) < 0.2;
      return {
        kick: "Rendimiento operativo",
        title: "Lo que renta hoy vs lo que debería",
        kpi: `${pct1(v.capRatePct)}%`,
        kpiRed: false,
        ksub: capEnLinea
          ? `cap rate · en línea con el mercado (${pct1(v.capRefPct)}%)`
          : `cap rate · ${pct1(Math.abs(v.gapPts))} pts ${v.gapPts < 0 ? "bajo" : "sobre"} el mercado (${pct1(v.capRefPct)}%)`,
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
        // AUDITORÍA fase42 (2) — el "óptimo de pie 25%" se retiró del motor en FASE
        // 4.2 (no tiene fundamento) pero este ksub componente-side sobrevivió. La tasa
        // sí conserva referencia porque tiene fuente real (promedio de mercado).
        ksub: `tasa ${pct1(v.tasaPct)}% · mercado ${pct1(v.tasaMarketPct)}%`,
        procedencia: "Tasa comparada contra referencia de mercado, no en tiempo real",
      };
    }
    case "capex_puesta_a_punto": {
      const v = h.valor;
      // Rango (modelo v3): el KPI muestra los extremos y el ksub declara el punto que
      // corre el caso. Override, legacy y filas persistidas sin rango → valor único.
      const rango = v.montoMinUF != null && v.montoMaxUF != null && v.montoMaxUF > v.montoMinUF;
      const kpi = rango
        ? (currency === "UF"
            ? `UF ${Math.round(v.montoMinUF!).toLocaleString("es-CL")}–${Math.round(v.montoMaxUF!).toLocaleString("es-CL")}`
            : `${fmtCLP(v.montoMinCLP ?? v.montoCLP)}–${fmtCLP(v.montoMaxCLP ?? v.montoCLP)}`)
        : `+${currency === "UF" ? fmtUF(v.montoUF) : fmtCLP(v.montoCLP)}`;
      const punto = rango ? `Franco corre el caso con UF ${Math.round(v.montoUF)}` : `UF ${Math.round(v.montoUF)}`;
      return {
        kick: "Puesta a punto",
        title: "Dejarlo listo para arrendar",
        kpi,
        kpiRed: false,
        // Fase 5b · D4: con pie 0 el % sobre la inversión inicial miente (la
        // base se desploma) — el ksub cambia el porcentaje por el CUÁNDO.
        ksub: v.sinCapitalPropio
          ? `${punto} · antes de arrendar, en una sola vez`
          : `${punto} · ${Math.round(v.fraccionInversion * 100)}% de tu inversión inicial`,
      };
    }
    case "plusvalia": {
      const v = h.valor;
      return {
        kick: "Plusvalía histórica",
        title: "Cuánto se ha valorizado la comuna",
        kpi: `${pct1(v.anualizadaPct)}%`,
        kpiRed: false,
        ksub: `anual · ${PLUSVALIA_DEFAULT_RANGO} · umbral real ${pct1(v.refPct)}%`,
        // F4 — lee v.fuente (procedencia histórica real, fuente única) con fallback defensivo al
        // literal para filas pre-regen (v.fuente con texto del umbral). Fallback GS → sin footer.
        procedencia: v.tieneData
          ? ((v.fuente && !/umbral/i.test(v.fuente)) ? v.fuente : `Histórico ${PLUSVALIA_DEFAULT_RANGO} · Arenas & Cayo, Tinsa, Propital, Activo Más`)
          : undefined,
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
    case "sensibilidad": {
      const v = h.valor;
      const x = fmtMargin(v.marginPct);
      // KPI Opción A (UX · Fabrizio): el VERBO carga la dirección, no el signo — "Aguanta
      // −X%" confundía (verbo de capacidad peleando con el signo negativo). Adversa "Se cae
      // con −X%" (el veredicto se cae con esa caída de arriendo); favorable/borde "Aguanta
      // hasta −X%"; nunca-cambia "Aguanta −50% o más". Mismo valor de bisección que la
      // fraseCanonica (v.marginPct, 0,5pt) vía el mismo fmtMargin → KPI y prosa no divergen.
      const kpi = v.firme
        ? "Aguanta −50% o más"
        : h.direccion === "adverso"
          ? `Se cae con −${x}%`
          : `Aguanta hasta −${x}%`;
      // ksub direccional: adversa nombra la caída y el veredicto destino; favorable
      // distingue "colchón acotado" (borde, < corteFavorable) de "colchón amplio"
      // (firme-finito, ≥ corteFavorable) — mismo adjetivo que el body; firme (nunca
      // cambia) dice que la conclusión no cuelga del arriendo declarado.
      const colchon = v.marginPct >= v.corteFavorable ? "colchón amplio" : "colchón acotado";
      const ksub = v.firme
        ? "no depende del arriendo que declaraste"
        : h.direccion === "adverso"
          ? `si el arriendo real cae ${x}%, pasa a ${v.veredictoNuevo}`
          : `antes de pasar a ${v.veredictoNuevo} · ${colchon}`;
      return {
        kick: "Margen del veredicto",
        title: "Cuánto aguanta tu veredicto",
        kpi,
        // Signal Red solo en la banda frágil (< corteAdverso): el margen es tan fino que
        // un error normal del arriendo daría vuelta la conclusión — señal crítica.
        kpiRed: h.direccion === "adverso",
        ksub,
      };
    }
    case "patrimonio": {
      const v = h.valor;
      // KPI = patrimonio absoluto (D1: "KPI en UF"; togglea CLP/UF como capex). ksub = el
      // multiplicador + lo aportado. Título direction-aware (mismas 3 bandas que la frase).
      // 2 decimales recortados — misma precisión que la fraseCanonica del builder y que el
      // multiplicador que la prosa recibe del exit (familia 7: mata el ×1,5 vs ×1,45).
      const multFmt = "×" + v.multiplicador.toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", ",");
      const adverso = v.multiplicador < v.corteAdverso;
      const favorable = v.multiplicador >= v.corteFavorable;
      const patrimonioFmt = currency === "UF" ? fmtUF(valorUF > 0 ? v.patrimonioCLP / valorUF : 0) : fmtCLP(v.patrimonioCLP);
      const aportadoFmt = currency === "UF" ? fmtUF(valorUF > 0 ? v.aportadoCLP / valorUF : 0) : fmtCLP(v.aportadoCLP);
      // Pie cero (fase 3b · D3, mockup 98e2319): equity ABSOLUTO, multiplicador
      // suprimido del display (sigue clasificando dirección adentro del builder).
      // ksub lleva el monto en la OTRA moneda; sin Signal Red (no es criticidad).
      if (v.sinCapitalPropio) {
        const otraMoneda = currency === "UF" ? fmtCLP(v.patrimonioCLP) : fmtUF(valorUF > 0 ? v.patrimonioCLP / valorUF : 0);
        return {
          kick: "Patrimonio a 10 años",
          title: h.titular,
          kpi: patrimonioFmt,
          kpiRed: false,
          ksub: `tu parte al vender · año 10 · ${otraMoneda}`,
        };
      }
      return {
        kick: "Patrimonio a 10 años",
        title: adverso
          ? "Terminas con menos de lo que pusiste"
          : favorable
            ? "Tu parte vale bastante más de lo aportado"
            : "Tu parte vale algo más de lo aportado",
        kpi: patrimonioFmt,
        // Signal Red solo cuando el multiplicador < 1: terminas con menos de lo que pusiste,
        // el único caso críticamente adverso (uso #2, monetario negativo de facto).
        kpiRed: adverso,
        ksub: `${multFmt} · aportaste ${aportadoFmt}`,
      };
    }
    // ── PIRÁMIDE STR (E.1b) — los 6 propios. Los heredados (sobreprecio/plusvalia/tir/
    // patrimonio/capex/estructura_financiamiento) reusan los casos LTR de arriba. ──
    case "rentabilidad_str": {
      const v = h.valor;
      return {
        kick: "Rentabilidad operativa",
        title: h.titular,
        kpi: `${pct1(v.capRatePct)}%`,
        kpiRed: v.capRatePct < v.umbralPct,
        ksub: `CAP STR · umbral ${pct1(v.umbralPct)}%`,
        procedencia: "Umbral STR nacional, sin comparable comunal",
      };
    }
    case "flujo_str": {
      const v = h.valor;
      return {
        kick: "Flujo mensual",
        title: h.titular,
        kpi: fmtSigned(v.flujoMensualCLP, currency, valorUF),
        kpiRed: v.flujoMensualCLP < 0,
        ksub: "Estabilizado · ocupación base",
      };
    }
    case "ocupacion_vs_estimacion": {
      const v = h.valor;
      // Goal 4 — el supuesto del usuario contra la estimación de mercado para ESTE depto.
      // Sin override ambos son el mismo número: la card lo dice y no compara con nadie.
      if (v.esOverride) {
        return {
          kick: "Tu supuesto de ocupación",
          title: h.titular,
          kpi: `${v.ocupacionPct}%`,
          kpiRed: false,
          ksub: v.esFallback ? "Definida por ti · sin estimación para esta dirección" : `Definida por ti · estimación de mercado ${v.estimacionPct}%`,
          procedencia: "Ocupación definida por ti; la estimación de mercado es el contraste",
        };
      }
      return {
        kick: "Ocupación del caso",
        title: h.titular,
        kpi: `${v.ocupacionPct}%`,
        kpiRed: false, // la ocupación no es un negativo monetario; la dirección la da el dot
        ksub: v.esFallback ? "Supuesto conservador · sin dato para esta dirección" : "Estimación de mercado para este depto",
        procedencia: v.esFallback
          ? "Sin dato de ocupación para esta dirección · supuesto 45%"
          : "Datos de mercado: estimación para un depto como este en esta zona",
      };
    }
    case "ventaja_vs_ltr": {
      const v = h.valor;
      return {
        kick: "Ventaja vs arriendo largo",
        title: h.titular,
        // P3 (Rama 0b): % no confiable (NOI-LTR ≤0 o ratio explotado) ⇒ KPI en CLP absoluto
        // (dual-moneda). Si es confiable, %.
        kpi: !v.pctConfiable
          ? fmtSigned(v.sobreRentaCLP, currency, valorUF)
          : `${v.sobreRentaPct >= 0 ? "+" : "−"}${Math.abs(Math.round(v.sobreRentaPct))}%`,
        kpiRed: false,
        ksub: !v.pctConfiable
          ? (v.ltrNegativo ? "Corto vs largo · ambos negativos" : "Sobre-renta en pesos · % no informa")
          : "Sobre-renta neta · vs LTR",
      };
    }
    case "sensibilidad_str": {
      const v = h.valor;
      return {
        kick: "Robustez del veredicto",
        title: h.titular,
        kpi: `${v.beRatioPct}%`,
        kpiRed: v.beRatioPct > v.corteFragil,
        ksub: "Punto de equilibrio · % del mercado",
      };
    }
    case "estructura_costos_str": {
      const v = h.valor;
      return {
        kick: "Estructura de costos",
        title: h.titular,
        kpi: `${v.costStackPct}%`,
        kpiRed: v.costStackPct > v.bandaAdvPct,
        ksub: "% del bruto · típico 30-40%",
      };
    }
    case "distancia_veredicto": {
      // Port verbatim a módulo puro (distancia-copy.ts) para que el hero
      // comparativo y DocumentoAmbas (server component) consuman el mismo
      // copy sin importar de este archivo "use client". Cero cambio de texto.
      return distanciaFindingDisplay(h);
    }
    default: {
      // Exhaustividad defensiva (no debería alcanzarse: todos los ids tienen caso).
      return { kick: "", title: (h as { titular?: string }).titular ?? "", kpi: "", kpiRed: false, ksub: "" };
    }
  }
}

// ── Body de la card: dual-moneda para flujo, verbatim para el resto ───────────
// flujo_mensual embebe el monto en la fraseCanonica; la seed va en CLP (contrato de la prosa persistida
// bit-idéntico), pero la CARD debe mostrarlo en la moneda activa (sin $ en modo UF). Reusa
// la MISMA plantilla del builder (buildFraseFlujo) con el monto reformateado — misma rama,
// mismo texto. Los otros 8 tipos no tienen monto embebido → fraseCanonica verbatim.
export function fraseCanonicaCard(h: Hallazgo, currency: "CLP" | "UF", valorUF: number): string {
  if (h.id === "flujo_mensual") {
    const v = h.valor;
    const abs = Math.abs(v.flujoNetoMensualCLP);
    const montoFmt = currency === "UF" ? fmtUF(valorUF > 0 ? abs / valorUF : 0) : fmtCLP(abs);
    const ratio = v.dividendoMensualCLP > 0 ? abs / v.dividendoMensualCLP : 0;
    // v.consuelo reproduce la rama seeded (familia 1); ausente (legacy) ⇒ default
    // "plusvalia" dentro de buildFraseFlujo = texto pre-fix, byte-idéntico.
    // v.horizonte reproduce la variante favorable (pre-entrega / años negativos);
    // ausente (legacy / caso base) ⇒ frase fuerte, byte-idéntica a la seed.
    return buildFraseFlujo(montoFmt, h.direccion, ratio, v.consuelo, v.horizonte).fraseCanonica;
  }
  return h.fraseCanonica;
}

// ── Dirección: punto + micro-label. Ink para favorable (cero verde). ──────────
function direccionMeta(dir: string): { color: string; label: string } {
  if (dir === "adverso") return { color: "var(--franco-v-avoid)", label: "En contra" };
  if (dir === "favorable") return { color: "var(--franco-v-buy)", label: "A favor" };
  return { color: "var(--franco-text-tertiary)", label: "Leve" };
}

// ── Componente ────────────────────────────────────────────────────────────────
// Genérico sobre el tipo de drawer key `K` (E.2): la pirámide STR pasa su propio
// `drawerMap` con claves `DrawerKeySTR` + un `onOpenDrawer` tipado a esas claves. Sin
// `drawerMap` no hay affordance de detalle (T5: el mapa LTR murió con la pirámide).
export function GenericFindingCard<K extends string = DrawerKey>({
  hallazgo,
  nivel,
  currency = "CLP",
  valorUF,
  palanca,
  numero,
  anchorId,
  onOpenDrawer,
  drawerMap,
}: {
  hallazgo: Hallazgo;
  /** 1 = decisivo (grande) · 2 = segundo plano (mediano) · 3 = revisado (chip). */
  nivel: 1 | 2 | 3;
  currency?: "CLP" | "UF";
  /** UF del snapshot — para formatear montos cuando currency = "UF". */
  valorUF: number;
  /** Zona de "palanca" opcional (nivel 1): acción/CTA bajo un border-top. */
  palanca?: React.ReactNode;
  /** Posición en el orden único ("01", "02", …): antecede al tema en el eyebrow.
   *  La numeración es compartida con el índice del hero — es la que carga la
   *  jerarquía (los kickers de corona murieron). Sin `numero`, el eyebrow queda
   *  solo con el tema (callers fuera de la pirámide). */
  numero?: string;
  /** Id de ancla estable de la card (el índice del hero linkea con #anchorId). */
  anchorId?: string;
  /** Abre el drawer de detalle del hallazgo. Sin este callback, no hay affordance. */
  onOpenDrawer?: (key: K) => void;
  /** Mapa hallazgo → drawer key (la pirámide STR pasa el suyo, claves DrawerKeySTR).
   *  Sin mapa no hay detalle. */
  drawerMap?: Partial<Record<Hallazgo["id"], K>>;
}) {
  const d = findingDisplay(hallazgo, currency, valorUF);
  const dir = direccionMeta(hallazgo.direccion);
  const procedenciaCorta = d.procedencia;
  const kpiColor = d.kpiRed ? "text-signal-red" : "";

  // Affordance de detalle: solo cuando el hallazgo mapea a un drawer Y hay handler.
  const effectiveMap = (drawerMap ?? {}) as Partial<Record<Hallazgo["id"], K>>;
  const drawerKey = effectiveMap[hallazgo.id];
  const hasDetalle = !!drawerKey && !!onOpenDrawer;
  const openDetalle = () => {
    if (drawerKey && onOpenDrawer) onOpenDrawer(drawerKey);
  };
  // Affordance de card completa (Fase 2): TODA la card es el trigger cuando hay
  // detalle, en los 3 niveles (antes solo nivel 3). El "Ver detalle →" pasa a ser
  // afordancia visual (aria-hidden); interactivos anidados (palanca) con stopPropagation.
  const cardClickable = hasDetalle;

  // Tokens de tamaño por nivel (escala del mockup: tier1 > tier2 > tier3).
  const pad = nivel === 1 ? "p-7" : nivel === 2 ? "p-6" : "p-4";
  const titleSize = nivel === 1 ? "text-[22px]" : nivel === 2 ? "text-[18px]" : "text-[15px]";
  const kpiSize = nivel === 1 ? "text-[36px]" : nivel === 2 ? "text-[28px]" : "text-[22px]";
  const resumenSize = nivel === 3 ? "text-[12.5px]" : "text-[13.5px]";
  const border = nivel === 1 ? "var(--franco-border-strong)" : "var(--franco-border)";
  // nivel-3 = superficie hundida. Light: --franco-sunken; dark: fallback inline
  // (rgba dark original) → dark sin cambio. Fase 2.
  const bg = nivel === 3 ? "var(--franco-sunken, rgba(26,26,26,0.55))" : "var(--franco-card)";
  // Eyebrow = número de posición + tema ("01 · Flujo mensual"). La dirección va en el
  // dot existente a la derecha; la jerarquía la carga la numeración compartida con el
  // índice del hero, no un kicker. El número va en bold Ink (mockup .num); el tema
  // conserva el tono tertiary del eyebrow.
  const kick = numero ? (
    <>
      <span className="font-bold" style={{ color: "var(--franco-text)" }}>{numero}</span>
      {" · "}
      {d.kick}
    </>
  ) : (
    d.kick
  );

  return (
    <div
      id={anchorId}
      className={`rounded-2xl scroll-mt-[68px] ${pad} ${cardClickable ? "franco-card-target cursor-pointer" : ""}`}
      style={{ background: bg, border: `0.5px solid ${border}` }}
      {...(cardClickable
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
        {/* Punto de dirección. distancia_veredicto lo OMITE: conserva direccion "adverso"
            para que el orden Filosofía 1 lo ponga con los adversos, pero rotularlo
            "En contra" lo convertiría en un golpe cuando es un mapa — la card dice a qué
            distancia estás del veredicto de arriba, no que algo esté mal. */}
        {hallazgo.id !== "distancia_veredicto" && (
          <span className="inline-flex items-center gap-1.5 shrink-0 pt-1">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: dir.color }} aria-hidden />
            <span
              className="font-mono uppercase tracking-[0.06em]"
              style={{ fontSize: 9, color: "var(--franco-text-tertiary)" }}
            >
              {dir.label}
            </span>
          </span>
        )}
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
          T5: murió la rama `bodyDuplicado` (la pasaba PiramideHallazgos cuando la
          apertura fija repetía esta misma frase; esa apertura no existe desde v19). */}
      <p className={`font-body leading-[1.55] mt-3.5 ${resumenSize}`} style={{ color: "var(--franco-text-secondary)" }}>
        {fraseCanonicaCard(hallazgo, currency, valorUF)}
      </p>

      {/* palanca opcional (nivel 1): border-top + slot de acción */}
      {nivel === 1 && palanca ? (
        <div
          className="mt-4 pt-3.5"
          style={{ borderTop: "0.5px solid var(--franco-border)" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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
            <span
              aria-hidden
              className="franco-card-arrow font-mono uppercase tracking-[0.06em] shrink-0"
              style={{ fontSize: 10, color: "var(--franco-text-tertiary)" }}
            >
              Ver detalle →
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
