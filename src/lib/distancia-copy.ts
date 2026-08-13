// ─────────────────────────────────────────────────────────────────────────
// Copy de "Lo que te separa" (distancia al veredicto) — módulo PURO server-safe.
//
// Dos consumos, patrón comparativa-chart-notas:
// 1. `distanciaFindingDisplay` — port VERBATIM del caso `distancia_veredicto`
//    de GenericFindingCard.findingDisplay ("use client"): la card LTR/STR no
//    cambia un byte, solo delega acá. Se extrajo porque DocumentoAmbas es un
//    server component y no puede importar valores de un módulo "use client".
// 2. `lineaDistanciaMini` — la línea de una frase bajo cada mini-score del
//    hero comparativo (contrato mockup-hero-ambas-3ejes), con el fallback
//    aprobado para el hijo irrecuperable sin hallazgo: el motor LTR no emite
//    `distancia_veredicto` en esos casos.
//
// Nota heredada (reportable de otro goal, NO se toca acá): el display de la
// card mapea la palanca ADR a la palabra "crédito" (default del switch de
// vías). La línea mini es superficie nueva y nombra la palanca por su hecho
// ("tarifa por noche"), sin tocar el copy existente de la card.
// ─────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto } from "@/lib/types";

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

const pct1 = (n: number) => n.toFixed(1).replace(".", ",");
const fmtMiles = (n: number) => Math.round(n).toLocaleString("es-CL");

export interface DistanciaDisplay {
  kick: string;
  title: string;
  kpi: string;
  kpiRed: boolean;
  ksub: string;
}

// Port verbatim de GenericFindingCard (caso "distancia_veredicto") — misma
// lógica, mismos textos. Cualquier cambio acá es cambio en la card LTR/STR.
export function distanciaFindingDisplay(h: HallazgoDistanciaVeredicto): DistanciaDisplay {
  const v = h.valor;
  // Kicker NEUTRO y único para los tres estados (decisión Fabrizio, gate 30-jul):
  // es un mapa, no un golpe. "Ruta a comprar" se descartó porque necesitaría un
  // tercer texto en el caso estructural, donde "ruta" sería mentira.
  const kick = "Lo que te separa";
  const objetivo = v.veredictoObjetivo === "COMPRAR" ? "Comprar" : "Ajusta supuestos";
  if (v.esEstructural) {
    const dm = v.deltaMinimoFueraDeTope;
    return {
      kick,
      title: `Ningún ajuste realista lo mueve de ${v.veredictoBase === "BUSCAR OTRA" ? "Buscar otra" : "Ajusta supuestos"}.`,
      // El KPI cita el delta mínimo REAL, no el tope. Sin él (ni el rango extendido
      // cruza) el KPI queda vacío y el título carga solo — más honesto que inventar.
      kpi: dm ? `${dm.deltaPct > 0 ? "+" : "−"}${pct1(Math.abs(dm.deltaPct))}%` : "—",
      // Ink, nunca Signal Red: no es un negativo crítico, es la distancia a un umbral.
      kpiRed: false,
      ksub: dm ? `${dm.palanca} · lo mínimo, y aun así no alcanza` : "fuera de todo rango razonable",
    };
  }
  const l = v.palancaMasBarata;
  if (!l) return { kick, title: `Lo que falta para ${objetivo}.`, kpi: "", kpiRed: false, ksub: "" };
  const via =
    l.palanca === "arriendo"
      ? "arriendo"
      : l.palanca === "precio"
        ? "precio"
        : l.palanca === "pie"
          ? "pie"
          : "crédito";
  const title =
    l.palanca === "plazo"
      ? `Está a un plazo de distancia de ${objetivo}.`
      : `Está a un ${via} de distancia de ${objetivo}.`;
  // El pie se cita como NIVEL ("26%"), no como variación: su deltaPct viene en puntos
  // porcentuales y "+26%" sobre un pie 0 no significaría nada.
  const kpi =
    l.palanca === "plazo"
      ? `${l.objetivo} años`
      : l.palanca === "pie"
        ? `${pct1(l.objetivo)}%`
        : `${l.deltaPct > 0 ? "+" : "−"}${pct1(Math.abs(l.deltaPct))}%`;
  const otras = v.palancas.length - 1;
  return {
    kick,
    title,
    kpi,
    kpiRed: false,
    ksub: otras > 0 ? `${via} · ${otras} vía${otras > 1 ? "s" : ""} más` : via,
  };
}

// ── Línea de una frase bajo el mini-score del hero comparativo ───────────────
// Contrato: "Le faltan $X de arriendo para COMPRAR" bajo cada mini-score, en
// los 3 estados. La palanca se nombra por su hecho (lector-30%): la tarifa por
// noche, no "ADR" ni "crédito".
export function lineaDistanciaMini(
  h: HallazgoDistanciaVeredicto | null | undefined,
  verdict: Verdict | null,
): string | null {
  if (!h) {
    // Fallback aprobado (contrato d25096d): el motor LTR no emite el hallazgo
    // para el hijo irrecuperable. Solo aplica al peor veredicto; con AJUSTA o
    // COMPRAR sin hallazgo, mejor silencio que inventar distancia.
    return verdict === "BUSCAR OTRA" ? "Ningún ajuste realista lo saca de BUSCAR OTRA." : null;
  }
  const v = h.valor;
  const objetivo = v.veredictoObjetivo;
  if (v.esEstructural) {
    const dm = v.deltaMinimoFueraDeTope;
    return dm
      ? `Ningún ajuste realista lo mueve de ${v.veredictoBase} — ni ${nombrePalanca(dm.palanca)} ${dm.deltaPct > 0 ? "+" : "−"}${pct1(Math.abs(dm.deltaPct))}%, lo mínimo, alcanza.`
      : `Ningún ajuste realista lo mueve de ${v.veredictoBase} — fuera de todo rango razonable.`;
  }
  const l = v.palancaMasBarata;
  if (!l) return null;
  const otras = v.palancas.length - 1;
  const cola = otras > 0 ? ` · ${otras} vía${otras > 1 ? "s" : ""} más` : "";
  // La MAGNITUD primero y el veredicto objetivo al final. La plantilla anterior
  // interpolaba el veredicto donde va el sustantivo y producía frases que el
  // lector no puede parsear: "A un arriendo de AJUSTA SUPUESTOS: $906.297".
  const delta = `${signo(l.deltaPct)}${pct1(Math.abs(l.deltaPct))}%`;
  switch (l.palanca) {
    case "arriendo":
      return `Con $${fmtMiles(l.objetivo)} de arriendo (${delta}) llega a ${objetivo}${cola}`;
    case "precio":
      return `Con un precio de UF ${fmtMiles(l.objetivo)} (${delta}) llega a ${objetivo}${cola}`;
    case "adr":
      return `Con una tarifa de $${fmtMiles(l.objetivo)} por noche (${delta}) llega a ${objetivo}${cola}`;
    case "pie":
      return `Con un pie de ${pct1(l.objetivo)}% llega a ${objetivo}${cola}`;
    case "plazo":
      return `Con un plazo de ${l.objetivo} años llega a ${objetivo}${cola}`;
    default:
      return `Con un ajuste de ${delta} llega a ${objetivo}${cola}`;
  }
}

const signo = (delta: number) => (delta > 0 ? "+" : "−");

function nombrePalanca(p: "arriendo" | "precio" | "adr"): string {
  return p === "adr" ? "la tarifa por noche" : p === "arriendo" ? "el arriendo" : "el precio";
}
