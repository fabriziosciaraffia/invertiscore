// ─────────────────────────────────────────────────────────────────────────────
// EL MIX DE PALANCAS DEL COMPRADOR (10-sep-2026)
//
// Las cuatro palancas del hallazgo de distancia se prueban DE A UNA, "con el resto
// de los supuestos fijos". Esta pieza combina las TRES que dependen del comprador
// —precio, pie y plazo— y para cada combinación de pie × plazo devuelve el
// descuento mínimo de precio que cruza al veredicto de arriba.
//
// El arriendo y la tasa quedan fuera por definición, no por costo: el arriendo lo
// pone el mercado y la tasa el banco. Un mix que le pide al comprador mover algo
// que no controla no es un plan, es una lista de deseos.
//
// POR QUÉ EXISTE. Medido sobre los seeds del golden, el mix ahorra entre 3 y 25
// puntos de descuento frente a mover el precio solo — y en tres casos convierte un
// "ningún ajuste realista alcanza" en una negociación normal. Pero se paga con
// plata del día 1, así que la cifra del pie viaja SIEMPRE al lado (ver
// `costoDiaUnoUF`): un mix sin su costo es un espejismo.
//
// COSTO: ~120-200 recomputes de veredicto (bisección por combinación), 0 tokens,
// sin base. Medido: 5-41 ms según la grilla, contra ~44 ms de un runAnalysis.
// ─────────────────────────────────────────────────────────────────────────────

import type { MixPalancas, PalancaDistancia, Veredicto } from "./types";

/** Paso de la grilla del pie, en puntos. El mismo que usa `simularPieYPlazo`. */
export const MIX_PIE_PASO_PCT = 5;

/**
 * Plazos que el mix puede proponer. Es el enum del WIZARD (`WizardV4Answers.plazoCredito`),
 * no `PLAZOS_COMERCIALES` del motor, que incluye 15.
 *
 * Dos razones y las dos son de producto: (1) el mix es la antesala de un CTA que
 * prellena el formulario, y proponer 15 sería proponer algo que el formulario no acepta;
 * (2) acortar el plazo SUBE la cuota, así que como palanca para cruzar va al revés.
 */
export const MIX_PLAZOS_WIZARD = [20, 25, 30] as const;

/** Precisión de la bisección del descuento, en puntos porcentuales. */
const MIX_PREC_PTS = 0.1;

const RANK: Record<Veredicto, number> = { "BUSCAR OTRA": 0, "AJUSTA SUPUESTOS": 1, COMPRAR: 2 };

type Combinacion = { descuentoPct: number; sinDescuento: boolean; piePct: number; plazoAnios: number; costoDiaUnoUF: number };

/**
 * Devuelve el mejor mix y su contexto, o `null` si NINGUNA combinación cruza.
 *
 * `null` es explícito y significa "se probaron las N combinaciones y ninguna alcanza".
 * No es lo mismo que el campo ausente en una fila vieja — ver el tipo `MixPalancas`.
 */
export function calcularMixPalancas(p: {
  /** Veredicto al que hay que llegar (el inmediatamente superior al base). */
  meta: Veredicto;
  precioUF: number;
  /** Pie declarado, en % del precio. */
  piePct: number;
  plazoCredito: number;
  /**
   * ¿El pie se puede mover? Lo decide el hallazgo de distancia con su doctrina:
   * `false` con bono pie (la inmobiliaria lo cubre y subirlo desarma el trato) o con
   * el pie ya en el techo. Si es false, el pie NO entra a la grilla.
   */
  pieCalifica: boolean;
  /**
   * Tope del descuento de precio, en %. Es el MISMO que gobierna la palanca sola: si el
   * mix pudiera pedir un descuento que la palanca sola tiene prohibido ofrecer, Franco se
   * contradiría dentro del mismo informe.
   */
  topePct: number;
  /**
   * Techo del NIVEL de pie que el mix puede proponer. Llega por parámetro y no por
   * import para no cerrar un ciclo con `distancia-veredicto-hallazgo.ts`, que es quien
   * llama acá; su fuente única sigue siendo `DIST_PIE_TOPE_PCT`.
   */
  pieTopePct: number;
  /**
   * Las palancas que YA cruzan solas. Solo se usa para marcar el mix redundante, así que
   * acepta la unión ANCHA de `PalancaDistancia` —la que comparten LTR y STR, con `adr` y
   * `gestion`— en vez de la de acá: el mix solo pregunta si contiene una de las suyas, y
   * estrechar el tipo obligaría al llamador a filtrar sin ninguna ganancia.
   */
  palancasQueCruzan: PalancaDistancia["palanca"][];
  veredictoAtPatch: (patch: { precio?: number; piePct?: number; plazoCredito?: number }) => Veredicto;
}): MixPalancas | null {
  if (!Number.isFinite(p.precioUF) || p.precioUF <= 0) return null;
  if (!Number.isFinite(p.piePct) || !Number.isFinite(p.plazoCredito)) return null;

  // ── LA GRILLA ─────────────────────────────────────────────────────────────
  // Pie: del declarado hasta el techo, paso 5, NUNCA hacia abajo. El techo es el mismo
  // del hallazgo (`DIST_PIE_TOPE_PCT`), con su razón ya escrita allá: a alguien con 10%
  // declarado pedirle 40% deja de ser un ajuste de supuestos. Y hacia abajo no se explora
  // porque menos pie empeora el mes: sería una recomendación al revés.
  const pies: number[] = [p.piePct];
  if (p.pieCalifica) {
    for (let x = p.piePct + MIX_PIE_PASO_PCT; x <= p.pieTopePct; x += MIX_PIE_PASO_PCT) pies.push(x);
  }
  // Plazo: solo hacia arriba y solo lo que el wizard acepta. Si ya está en el máximo, la
  // grilla queda de una columna y el mix se reduce a las otras dos palancas — es el borde
  // que `redundanteConPalancaSola` tiene que poder declarar.
  const plazosArriba = MIX_PLAZOS_WIZARD.filter((a) => a >= p.plazoCredito);
  const plazos: number[] = plazosArriba.length > 0 ? [...plazosArriba] : [p.plazoCredito];

  const alcanza = (v: Veredicto) => RANK[v] >= RANK[p.meta];
  const cruza = (descuentoPct: number, piePct: number, plazoAnios: number) =>
    alcanza(p.veredictoAtPatch({ precio: p.precioUF * (1 - descuentoPct / 100), piePct, plazoCredito: plazoAnios }));

  /** Descuento mínimo que cruza para esta combinación, o null si no cruza ni en el tope. */
  const minimoDescuento = (piePct: number, plazoAnios: number): { pct: number; sin: boolean } | null => {
    // Primero el caso que más importa: ¿pie y plazo SOLOS ya cruzan? Se pregunta directo en
    // vez de leerlo del piso de la bisección, que devolvería un −0,1% engañoso.
    if (cruza(0, piePct, plazoAnios)) return { pct: 0, sin: true };
    if (!cruza(p.topePct, piePct, plazoAnios)) return null;
    let lo = 0;
    let hi = p.topePct;
    while (hi - lo > MIX_PREC_PTS) {
      const mid = (lo + hi) / 2;
      if (cruza(mid, piePct, plazoAnios)) hi = mid;
      else lo = mid;
    }
    return { pct: Math.round(hi * 10) / 10, sin: false };
  };

  const pieCLP = (descuentoPct: number, piePct: number) => (p.precioUF * (1 - descuentoPct / 100) * piePct) / 100;
  // BASE DEL COSTO: SIEMPRE el pie declarado hoy, sobre el precio de hoy. Es la única base
  // que el usuario reconoce, y la única que existe en los casos donde el precio solo NO
  // cruza — que son justamente aquellos donde el mix más vale.
  const pieDeclaradoUF = (p.precioUF * p.piePct) / 100;

  const combos: Combinacion[] = [];
  for (const pie of pies) {
    for (const plazo of plazos) {
      const r = minimoDescuento(pie, plazo);
      if (!r) continue;
      combos.push({
        descuentoPct: r.pct,
        sinDescuento: r.sin,
        piePct: pie,
        plazoAnios: plazo,
        costoDiaUnoUF: Math.round(pieCLP(r.pct, pie) - pieDeclaradoUF),
      });
    }
  }
  const probadas = pies.length * plazos.length;
  if (combos.length === 0) return null;

  // Orden: menos descuento primero —es lo que hay que pedirle a un tercero—, y a igual
  // descuento gana la que cuesta menos plata propia el día 1.
  combos.sort((a, b) => a.descuentoPct - b.descuentoPct || a.costoDiaUnoUF - b.costoDiaUnoUF || a.piePct - b.piePct);
  const mejor = combos[0];
  const segunda = combos[1] ?? null;

  const soloPrecio = combos.find((c) => c.piePct === p.piePct && c.plazoAnios === p.plazoCredito) ?? null;

  // ── ¿EL MIX AGREGA ALGO? ──────────────────────────────────────────────────
  // Si mueve UNA sola dimensión y esa palanca ya se reporta sola, el mix está repitiendo
  // una vía con otro nombre. Eso es ruido, y el render tiene que poder no dibujarlo.
  const movidas: ("precio" | "plazo" | "pie")[] = [];
  if (mejor.descuentoPct > 0) movidas.push("precio");
  if (mejor.piePct !== p.piePct) movidas.push("pie");
  if (mejor.plazoAnios !== p.plazoCredito) movidas.push("plazo");
  const redundanteConPalancaSola = movidas.length === 1 && p.palancasQueCruzan.includes(movidas[0]);

  return {
    descuentoPct: mejor.descuentoPct,
    sinDescuento: mejor.sinDescuento,
    piePct: mejor.piePct,
    plazoAnios: mejor.plazoAnios,
    piePctDelta: Math.round((mejor.piePct - p.piePct) * 10) / 10,
    plazoAniosDelta: mejor.plazoAnios - p.plazoCredito,
    descuentoSoloPrecioPct: soloPrecio ? soloPrecio.descuentoPct : null,
    costoDiaUnoUF: mejor.costoDiaUnoUF,
    costoDiaUnoBase: "pie_declarado",
    combinacionesQueCruzan: combos.length,
    combinacionesProbadas: probadas,
    segunda: segunda
      ? {
          descuentoPct: segunda.descuentoPct,
          sinDescuento: segunda.sinDescuento,
          piePct: segunda.piePct,
          plazoAnios: segunda.plazoAnios,
          costoDiaUnoUF: segunda.costoDiaUnoUF,
        }
      : null,
    redundanteConPalancaSola,
  };
}
