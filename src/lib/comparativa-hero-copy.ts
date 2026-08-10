// ─────────────────────────────────────────────────────────────────────────
// Hero comparativo 3 ejes — módulo PURO server-safe. Contrato vinculante:
// assets-export/mockup-hero-ambas-3ejes.html (master d25096d).
//
// v2 — mata el D8 sistémico del censo AMBAS (21 ALTAs confirmadas): las 4
// variantes fijas por banda jamás consultaban los veredictos de compra de
// los hijos, así que 27 pares con doble BUSCAR OTRA celebraban "la jugada
// sólida acá". Ahora el copy se arma sobre 3 EJES:
//   Eje 1 — ganador del MÉTODO (larga/parejas/corta) con su margen visible.
//   Eje 2 — robustez: la fragilidad es un CHIP calificador, no una banda
//           (la barra de método queda de 3 posiciones).
//   Eje 3 — viabilidad de COMPRA según los hijos → 3 estados:
//     E1  ambos hijos sostienen (COMPRAR/AJUSTA). Hero legítimo. Matiz
//         OBLIGATORIO si el hijo ganador es AJUSTA; mención OBLIGATORIA del
//         lado muerto si el ganador es COMPRAR y el perdedor BUSCAR OTRA.
//     E2  doble BUSCAR OTRA (rojo canónico Director 5963). El hero CAMBIA DE
//         PREGUNTA: badge propio "NO SE SOSTIENE" (tratamiento crítico), el
//         método subordinado a una línea, la barra RETIRADA (no apagada —
//         cada pieza que sobrevive compite con el "no compres").
//     E3  mixto (exactamente un hijo BUSCAR OTRA): subordinación parcial.
//         Subcasos: ganador a medias + perdedor muerto (el común) · estricto
//         (ganador BUSCAR — no existe en el parque hoy; misma regla, sub más
//         duro) · parejas mixto (sin ganador claro).
//
// Fuente única: HeroComparativa (web + share), DocumentoAmbas y el
// ensamblador editorial consumen `buildHeroAmbas` — cero copias de lógica.
// El veredicto de cada hijo lo emite su motor; acá solo se narra (§1.7).
// ─────────────────────────────────────────────────────────────────────────

import type { RecomendacionModalidadAmbas } from "@/lib/types";

export type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
export type EstadoHero = "e1" | "e2" | "e3";
export type GanadorMetodo = "larga" | "parejas" | "corta";
export type EscalaMargen = "estrecho" | "claro" | "amplio";

const sostiene = (v: Verdict | null): boolean => v === "COMPRAR" || v === "AJUSTA SUPUESTOS";

const fmtCLP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

// El HECHO antes que el concepto (lector-30%): la primera mención de cada
// modalidad en el hero la describe; "renta larga/corta" queda para retomar.
const HECHO: Record<"larga" | "corta", string> = { larga: "arrendarlo por mes", corta: "arrendarlo por día" };
const HECHO_CORTO: Record<"larga" | "corta", string> = { larga: "por mes", corta: "por día" };
const NOMBRE: Record<"larga" | "corta", string> = { larga: "renta larga", corta: "renta corta" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const otro = (l: "larga" | "corta"): "larga" | "corta" => (l === "larga" ? "corta" : "larga");

export function ganadorDeReco(reco: RecomendacionModalidadAmbas): GanadorMetodo {
  if (reco === "LTR_PREFERIDO") return "larga";
  if (reco === "STR_VENTAJA_CLARA") return "corta";
  return "parejas";
}

/** Eje 3 — tabla de derivación aprobada (STOP 1). Hijo sin veredicto ⇒ conservador (E1). */
export function derivarEstadoHero(ltrVerdict: Verdict | null, strVerdict: Verdict | null): EstadoHero {
  if (!ltrVerdict || !strVerdict) return "e1";
  const l = sostiene(ltrVerdict);
  const s = sostiene(strVerdict);
  if (!l && !s) return "e2";
  if (!l || !s) return "e3";
  return "e1";
}

export interface HeroAmbasInput {
  recomendacion: RecomendacionModalidadAmbas;
  fragil: boolean;
  ltrVerdict: Verdict | null;
  strVerdict: Verdict | null;
  // Margen (eje 1) + subordinada E2 — mismas fuentes que la tabla side-by-side.
  ltrFlujoMensual: number;
  strFlujoMensual: number;
  /** Decimal (0.041). Positivo = favorece al corto. */
  sobreRentaPct: number;
  sobreRentaPctConfiable: boolean;
  /** NOI mensual CLP a favor del corto (mismo signo que el pct). */
  sobreRentaCLP: number;
}

export interface MargenGanador {
  /** "$34.886/mes · 4,1%" — plata = delta de flujo (ancla con la card de flujo);
   *  % = sobre-renta NOI. Ratio degenerado ⇒ solo plata de renta operativa. */
  texto: string;
  escala: EscalaMargen;
  /** 0-100 para la barra del render. */
  fillPct: number;
}

export interface HeroAmbas {
  estado: EstadoHero;
  ganador: GanadorMetodo;
  /** Eje 2 — chip calificador. Nunca en E2 (competiría con el "no compres"). */
  fragilChip: boolean;
  badge: string;
  /** true solo en E2: badge Signal Red + wash de veredicto crítico. */
  badgeCritico: boolean;
  sub: string;
  /** Solo E2: el método subordinado a una línea. */
  subordinada: { kicker: string; texto: string } | null;
  posicion: string;
  /** false en E2 — la barra se RETIRA, no se apaga. */
  mostrarBarra: boolean;
  /** null en E2 (la subordinada carga la comparación). */
  margen: MargenGanador | null;
}

// ── Eje 1 · margen visible ────────────────────────────────────────────────────
// Escala aprobada como propuesta inicial (revisable con datos post-implementación):
// estrecho <10% · claro 10-30% · amplio >30% de sobre-renta. Cuando el ratio
// degenera (NOI del lado largo ≤ 0 → % sin sentido) se declara en plata de renta
// operativa y se rotula amplio — la degeneración solo ocurre con ventajas enormes.
function buildMargen(input: HeroAmbasInput): MargenGanador {
  const deltaFlujo = Math.abs(input.strFlujoMensual - input.ltrFlujoMensual);
  if (!input.sobreRentaPctConfiable) {
    return { texto: `${fmtCLP(input.sobreRentaCLP)}/mes de renta operativa`, escala: "amplio", fillPct: 92 };
  }
  const pct = Math.abs(input.sobreRentaPct);
  const escala: EscalaMargen = pct < 0.10 ? "estrecho" : pct <= 0.30 ? "claro" : "amplio";
  const fillPct = Math.min(96, Math.max(6, Math.round(pct * 100 * 2.2)));
  return { texto: `${fmtCLP(deltaFlujo)}/mes · ${pct1(pct * 100)}%`, escala, fillPct };
}

const VENTAJA_TXT: Record<EscalaMargen, string> = {
  estrecho: "real pero estrecha",
  claro: "clara",
  amplio: "grande",
};

// ── Badges (set final ratificado) ─────────────────────────────────────────────
const BADGE: Record<GanadorMetodo, string> = {
  larga: "RENTA LARGA",
  parejas: "PAREJAS",
  corta: "RENTA CORTA",
};
export const BADGE_NO_SE_SOSTIENE = "NO SE SOSTIENE";

// ── Barra de método (3 posiciones — eje 1) ────────────────────────────────────
export const SEGMENT_ORDER: GanadorMetodo[] = ["larga", "parejas", "corta"];
export const SEGMENT_SHORT: Record<GanadorMetodo, string> = {
  larga: "Larga",
  parejas: "Parejas",
  corta: "Corta",
};
export const SEGMENT_POS: Record<GanadorMetodo, number> = {
  larga: 16.5,
  parejas: 50,
  corta: 83.5,
};

// ── Eje 2 · chip de robustez (reemplaza al banner de fragilidad) ──────────────
export const FRAGIL_CHIP = {
  kicker: "Margen frágil",
  texto: "un mal mes se come la ventaja",
};

// ── E1 · copy base por ganador (celebración legítima: ambos hijos sostienen) ──
const E1_SUB: Record<GanadorMetodo, string> = {
  larga: "Arrendarlo por mes es la jugada acá: pones menos plata cada mes y no te pide horas.",
  corta: "Arrendarlo por día paga el esfuerzo acá: rinde más y el margen aguanta un traspié.",
  parejas: "Arrendarlo por mes o por día rinde casi igual acá; lo que decide es cuánto tiempo quieres dedicarle.",
};

const E1_POS: Record<GanadorMetodo, string> = {
  larga: "Renta larga es la jugada sólida acá. Airbnb te pide más plata de entrada, más horas cada semana y más estómago para la estacionalidad, para terminar con el mismo patrimonio y menos caja en el bolsillo. Si el tiempo no te sobra, ni lo mires: el número no paga el esfuerzo.",
  corta: "Renta corta paga el esfuerzo en este depto: rinde más que la larga y el margen aguanta un traspié. Si puedes poner las 8-12 horas a la semana, o aceptar la comisión de un administrador, es la mejor jugada. La ventaja es real, no de papel.",
  parejas: "Las dos rinden casi lo mismo, así que la plata no decide: decide tu tiempo. Si buscas algo pasivo, renta larga. Si te entusiasma operar y tienes las horas, el corto no te va a rendir menos. No hay respuesta equivocada acá, hay preferencia.",
};

// Matiz E1-AJUSTA (obligatorio, contrato) — el hijo ganador sostiene condicionado.
const MATIZ_SUB = " Ojo con el otro plano: como compra, este depto pide ajustar supuestos — la modalidad no arregla el precio.";
const MATIZ_POS = " Eso sí: como compra, este depto pide ajustar supuestos antes de firmar — la palanca concreta está en «Lo que te separa», bajo cada análisis.";

// ── Builder principal ────────────────────────────────────────────────────────
export function buildHeroAmbas(input: HeroAmbasInput): HeroAmbas {
  const ganador = ganadorDeReco(input.recomendacion);
  const estado = derivarEstadoHero(input.ltrVerdict, input.strVerdict);
  const margen = buildMargen(input);

  if (estado === "e2") return buildE2(input, ganador);
  if (estado === "e3") return buildE3(input, ganador, margen);
  return buildE1(input, ganador, margen);
}

// ── E1 — ambos sostienen ─────────────────────────────────────────────────────
function buildE1(input: HeroAmbasInput, ganador: GanadorMetodo, margen: MargenGanador): HeroAmbas {
  const vGanador =
    ganador === "larga" ? input.ltrVerdict : ganador === "corta" ? input.strVerdict : null;
  // Matiz: ganador claro en AJUSTA, o parejas con algún lado en AJUSTA.
  const conMatiz =
    ganador === "parejas"
      ? input.ltrVerdict === "AJUSTA SUPUESTOS" || input.strVerdict === "AJUSTA SUPUESTOS"
      : vGanador === "AJUSTA SUPUESTOS";
  // Mención del lado muerto (celda STOP 1): ganador COMPRAR + perdedor BUSCAR OTRA.
  // Con veredictos null la derivación cae acá (conservador) y no hay mención.
  const perdedor: "larga" | "corta" | null = ganador === "parejas" ? null : otro(ganador);
  const vPerdedor = perdedor === "larga" ? input.ltrVerdict : perdedor === "corta" ? input.strVerdict : null;
  const conMencion = vGanador === "COMPRAR" && vPerdedor === "BUSCAR OTRA" && perdedor !== null;

  const mencionSub = conMencion && perdedor
    ? ` Y algo más: ${HECHO[perdedor]} no se sostiene como compra — esa vía queda fuera de la mesa.`
    : "";
  const mencionPos = conMencion && perdedor
    ? ` Y ${HECHO[perdedor]} no está sobre la mesa: como compra no se sostiene.`
    : "";

  return {
    estado: "e1",
    ganador,
    fragilChip: input.fragil,
    badge: BADGE[ganador],
    badgeCritico: false,
    sub: E1_SUB[ganador] + (conMatiz ? MATIZ_SUB : "") + mencionSub,
    subordinada: null,
    posicion: E1_POS[ganador] + (conMatiz ? MATIZ_POS : "") + mencionPos,
    mostrarBarra: true,
    margen,
  };
}

// ── E2 — doble BUSCAR OTRA: cambia la pregunta ───────────────────────────────
function buildE2(input: HeroAmbasInput, ganador: GanadorMetodo): HeroAmbas {
  const ambosNegativos = input.ltrFlujoMensual < 0 && input.strFlujoMensual < 0;
  const sub =
    "Este depto no se sostiene en ninguna de las dos." +
    (ambosNegativos
      ? " Arrendarlo por mes o por día, en los dos casos pones plata de tu bolsillo todos los meses y el análisis de cada lado dice BUSCAR OTRA."
      : " Lo arriendes por mes o por día, el análisis de cada lado dice BUSCAR OTRA.") +
    " La pregunta ya no es cómo arrendarlo — es si comprarlo.";

  // El método, subordinado y en plata: quién pierde menos según el flujo mensual.
  const mejor: "larga" | "corta" = input.strFlujoMensual > input.ltrFlujoMensual ? "corta" : "larga";
  const fMejor = mejor === "corta" ? input.strFlujoMensual : input.ltrFlujoMensual;
  const fPeor = mejor === "corta" ? input.ltrFlujoMensual : input.strFlujoMensual;
  const delta = Math.abs(fMejor - fPeor);
  const texto =
    delta < 1000
      ? `las dos pierden prácticamente lo mismo: ${fmtCLP(fMejor)} al mes de tu bolsillo.`
      : ambosNegativos
        ? `${HECHO[mejor]} pierde menos: ${fmtCLP(delta)} menos de tu bolsillo al mes (${fmtCLP(fMejor)} contra ${fmtCLP(fPeor)}).`
        : `${HECHO[mejor]} queda mejor parado: ${fmtCLP(delta)} al mes de diferencia.`;

  const posicion =
    "Buscar otra." +
    (ambosNegativos
      ? " Las dos formas de arrendarlo te piden plata cada mes y ninguna paga el esfuerzo."
      : " Ninguna de las dos formas de arrendarlo sostiene la compra.") +
    " Si este depto te importa por algo que no es la inversión, está bien — pero no te cuentes la historia de que la modalidad lo arregla: lo que falla es la compra, y las palancas para darla vuelta están en cada análisis, abajo.";

  return {
    estado: "e2",
    ganador,
    fragilChip: false,
    badge: BADGE_NO_SE_SOSTIENE,
    badgeCritico: true,
    sub,
    subordinada: { kicker: "Si igual lo compras", texto },
    posicion,
    mostrarBarra: false,
    margen: null,
  };
}

// ── E3 — mixto: subordinación parcial ────────────────────────────────────────
function buildE3(input: HeroAmbasInput, ganador: GanadorMetodo, margen: MargenGanador): HeroAmbas {
  const ventaja = VENTAJA_TXT[margen.escala];

  // Subcaso parejas-mixto: sin ganador claro, un lado se sostiene y el otro no.
  if (ganador === "parejas") {
    const lado: "larga" | "corta" = sostiene(input.ltrVerdict) ? "larga" : "corta";
    const vLado = lado === "larga" ? input.ltrVerdict : input.strVerdict;
    const ajustando = vLado === "AJUSTA SUPUESTOS" ? ", y ajustando supuestos" : "";
    return {
      estado: "e3",
      ganador,
      fragilChip: input.fragil,
      badge: BADGE.parejas,
      badgeCritico: false,
      sub: `Arrendarlo por mes o por día rinde casi igual acá — pero como compra solo se sostiene ${HECHO[lado]}${ajustando}; ${HECHO[otro(lado)]} no se sostiene.`,
      subordinada: null,
      posicion: `Ninguna de las dos gana por rendimiento; la única que se sostiene como compra${vLado === "AJUSTA SUPUESTOS" ? " — ajustando supuestos —" : ""} es ${NOMBRE[lado]}. Si avanzas, es por ahí; ${HECHO[otro(lado)]} queda fuera de la mesa.`,
      mostrarBarra: true,
      margen,
    };
  }

  const perdedor = otro(ganador);
  const vGanador = ganador === "larga" ? input.ltrVerdict : input.strVerdict;
  const flujoPerdedor = perdedor === "larga" ? input.ltrFlujoMensual : input.strFlujoMensual;

  // Subcaso estricto (no existe en el parque hoy; misma regla, sub más duro):
  // el método que gana es justo el que no se sostiene como compra.
  if (!sostiene(vGanador)) {
    return {
      estado: "e3",
      ganador,
      fragilChip: input.fragil,
      badge: BADGE[ganador],
      badgeCritico: false,
      sub: `${cap(HECHO[ganador])} rinde más que ${HECHO_CORTO[perdedor]} acá — y aun así no se sostiene como compra. La única vía que se sostiene, ajustando supuestos, es ${NOMBRE[perdedor]}: rinde menos, pero existe.`,
      subordinada: null,
      posicion: `La ventaja de ${HECHO_CORTO[ganador]} es de rendimiento, no de viabilidad: como compra no se sostiene. Si avanzas, la única vía que existe es ${NOMBRE[perdedor]}, ajustando supuestos — y si eso te suena a comprar con calzador, es porque lo es.`,
      mostrarBarra: true,
      margen,
    };
  }

  // Subcaso común: ganador sostiene a medias (AJUSTA) + perdedor no se sostiene.
  const pozo =
    flujoPerdedor < 0
      ? `: la vía ${HECHO_CORTO[perdedor]} es un pozo de ${fmtCLP(flujoPerdedor)} al mes`
      : "";
  const horas = ganador === "corta" ? " y con las horas puestas" : "";
  return {
    estado: "e3",
    ganador,
    fragilChip: input.fragil,
    badge: BADGE[ganador],
    badgeCritico: false,
    sub: `${cap(HECHO[ganador])} rinde más que ${HECHO_CORTO[perdedor]} acá. Como compra, se sostiene solo si ajustas supuestos — y ${HECHO[perdedor]} no se sostiene ni así${pozo}.`,
    subordinada: null,
    posicion: `Si este depto entra a tu cartera, es ${HECHO_CORTO[ganador]}${horas}: la ventaja sobre ${HECHO_CORTO[perdedor]} es ${ventaja} y los números la sostienen. Pero que el margen no te apure la firma — como compra sigue pidiendo ajustar supuestos, y la otra vía no se sostiene. La modalidad correcta no convierte un precio equivocado en buena inversión.`,
    mostrarBarra: true,
    margen,
  };
}
