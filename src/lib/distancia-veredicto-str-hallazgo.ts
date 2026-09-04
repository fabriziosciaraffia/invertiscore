// Hallazgo de DISTANCIA AL VEREDICTO SUPERIOR para STR — motor determinístico.
//
// Port del hallazgo LTR (`distancia-veredicto-hallazgo.ts`). La ARQUITECTURA se hereda
// entera —bisección por palanca sobre un closure de veredicto, tope de honestidad,
// decisividad 0—; los PARÁMETROS no: se recalibraron sobre el parque STR
// (of-sweep-distancia-str.ts, 82 no-COMPRAR) y ninguno coincide con el de LTR.
//
// SEIS PALANCAS, cada una biseccionada por separado:
//   · pie      — sube (% del precio). Condicional y PRIMERA (ver DIST_PIE_* en el módulo LTR).
//   · gestion  — cambia de modo (auto ↔ administrador). Discreta: una sola evaluación.
//   · precio   — baja (UF).
//   · adr      — sube (CLP/noche). TOPE PROPIO, más estricto (ver DIST_STR_TOPE_ADR_PCT).
//   · plazo    — sube (años, tramos comerciales de 5, tope 30).
// La OCUPACIÓN queda fuera a propósito: no la controla el propietario (sale de tarifa,
// demanda, calidad y reseñas) y en el motor es aritméticamente la MISMA palanca que el ADR
// —el ingreso base es `adr × occ × 365`, así que Δocc/Δadr = 1,0—. Ofrecerla sería ofrecer
// la tarifa dos veces con otro nombre.
//
// TRES CASOS DE OMISIÓN (return null): veredicto base COMPRAR · precio no computable ·
// ADR no computable.

import type {
  HallazgoDistanciaVeredicto,
  PalancaDistancia,
  ViaDistancia,
  RazonSinCapital,
  Veredicto,
} from "./types";
import { classifyPieLevel } from "./financing-health";
import {
  biseccionFactor,
  DIST_PIE_RAZON_EXCLUIDA,
  DIST_PIE_TOPE_PCT,
  DIST_PLAZO_TOPE_ANIOS,
  DIST_PLAZO_TRAMO_ANIOS,
} from "./distancia-veredicto-hallazgo";
import type { StrPatch } from "./analysis/veredicto-str-con-patch";

// ── Topes de honestidad (calibrados sobre el parque STR, no heredados) ────────────
// Sweep sobre 82 filas STR no-COMPRAR de prod (29 AJUSTA + 53 BUSCAR OTRA), midiendo el
// delta mínimo por palanca hasta el veredicto superior (of-sweep-distancia-str.ts):
//   AJUSTA → COMPRAR : precio p25 11,6% · MEDIANA 18,8% · p90 28,4%   ADR MEDIANA 11,4%
//   BUSCAR → AJUSTA  : precio p25  9,8% · MEDIANA 29,3% · p90 55,3%   ADR MEDIANA 18,0%
//
// · AJUSTA SUPUESTOS ⇒ 25% (LTR usa 30). La cobertura salta de 45% a 66% entre los topes 20
//   y 25, y de 25 a 30 gana UN solo caso —que además ya está cubierto por el ADR—. Bajar el
//   techo recorta cuánto se le pide al vendedor sin costar recuperables: a 25% quedan 28 de
//   29 con alguna vía.
//
// · BUSCAR OTRA ⇒ 15% (igual que LTR, por la misma razón y no por herencia). Acá el
//   veredicto ya disparó al menos un brazo del Gate 1, así que la vara para declararlo
//   recuperable es más alta a propósito. 15% corta bien bajo la mediana de precio (29,3%) y
//   deja 57% de los BUSCAR OTRA como estructurales.
export const DIST_STR_TOPE_AJUSTA_PCT = 25;
export const DIST_STR_TOPE_BUSCAR_PCT = 15;

/**
 * Tope PROPIO de la tarifa, único para las dos transiciones. No se parte por veredicto a
 * propósito: lo que el tope mide no es cuán malo es el deal, sino cuán plausible es rendir
 * sobre la mediana de tarifa de la zona — y esa plausibilidad no depende del veredicto de
 * partida.
 *
 * 10% es el punto donde la palanca sigue siendo una apuesta defendible (buena gestión,
 * fotos, calendario) y no una fantasía. Emite en 14 de 29 AJUSTA y 13 de 53 BUSCAR. El copy
 * DEBE decir que es una apuesta contra el mercado, no un ajuste garantizado: el dato de
 * tarifa viene de la observación real de la zona, no de un supuesto del usuario.
 */
export const DIST_STR_TOPE_ADR_PCT = 10;

/** Tope aplicable a precio/plazo/pie/gestión según el veredicto de partida. */
export const topeStrParaVeredicto = (v: Veredicto): number =>
  v === "BUSCAR OTRA" ? DIST_STR_TOPE_BUSCAR_PCT : DIST_STR_TOPE_AJUSTA_PCT;

// Rango EXTENDIDO para el caso estructural — límites de búsqueda, no promesas. Lo que se
// encuentra acá nunca entra a `palancas`; solo alimenta `deltaMinimoFueraDeTope` para que la
// frase dura cite el hecho ("ni bajando el precio un 46%") en vez del umbral.
const DIST_STR_EXT_ADR_MAX = 2.5;    // +150%
const DIST_STR_EXT_PRECIO_MIN = 0.30; // −70%

const RANK: Record<Veredicto, number> = {
  "BUSCAR OTRA": 0,
  "AJUSTA SUPUESTOS": 1,
  COMPRAR: 2,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtUF = (n: number) => "UF " + Math.round(n).toLocaleString("es-CL");

/**
 * Familias de motivo de gate → la consecuencia vivida que las nombra. Se usa SOLO en el caso
 * puro-gate, donde el copy no puede hablar de distancia al puntaje. Cada glosa dice qué le
 * pasa al usuario, nunca cómo se llama el brazo por dentro (doctrina A11: la mecánica del
 * motor no sale a pantalla).
 */
const GLOSA_MOTIVO: Record<string, string> = {
  g1_regulacion: "el edificio no permite arriendo corto",
  g1_cocSevero: "lo que pones de tu bolsillo se come el capital que aportaste",
  g1_beInviable: "el arriendo corto no alcanza a cubrir la operación ni con la zona rindiendo lo que rinde",
  g1_flujoSevero: "cada mes tienes que poner una cifra fuerte de tu bolsillo, y el corto no compensa frente al arriendo tradicional",
  g1_capRateMinimo: "lo que deja la operación sobre el precio es demasiado poco",
  g2_sobreRentaNegativa: "el arriendo tradicional te deja más neto que el corto",
  g2_cocApretado: "lo que pones de tu bolsillo pesa demasiado sobre el capital que aportaste",
  g2_beApretado: "el margen de operación queda sin holgura",
  g2_flujoSinHorizonte: "el flujo mensual queda en negativo y ni la plusvalía ni la deuda que amortizas alcanzan a compensarlo",
};

const glosaDe = (motivos: string[]): string | null => {
  for (const m of motivos) {
    const g = GLOSA_MOTIVO[m];
    if (g) return g;
  }
  return null;
};

/**
 * Construye el proto-hallazgo de DISTANCIA AL VEREDICTO SUPERIOR para STR.
 * SOLO-LECTURA: decisividad 0 fija, igual que LTR — no compite en el ranking de la pirámide.
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA la reescribe aguas
 * abajo. Voz: tuteo neutro chileno, consecuencia vivida.
 */
export function buildHallazgoDistanciaVeredictoStr(p: {
  /** Veredicto al input declarado — el canónico ya computado por calcFrancoScoreSTR. */
  veredictoBase: Veredicto;
  /** Score compuesto (0-100), para detectar el caso puro-gate. */
  score: number;
  /** Precio en UF (unidad del informe). */
  precioUF: number;
  /** Precio en CLP (unidad del motor STR — es lo que viaja en el patch). */
  precioCLP: number;
  /** ADR que factura hoy el escenario base (CLP/noche). */
  adrActual: number;
  modoGestionActual: "auto" | "administrador";
  /** Comisión de cada modo, en decimal (0.03 / 0.20). Para expresar el delta de gestión. */
  comisionAutoDec: number;
  comisionAdminDec: number;
  plazoCredito: number;
  /** Pie declarado como % del precio. Decide si la palanca del pie se emite. */
  piePct: number;
  razonSinPie?: RazonSinCapital;
  /** Reevalúa el veredicto sobre un clon del input con el patch aplicado. */
  veredictoAtPatch: (patch: StrPatch) => Veredicto;
  /** Todos los motivos de gate que sostienen el veredicto (`francoScore.gates.motivos`). */
  motivosGate: string[];
  /**
   * Caso precio-justo STR (§1.12.4, detección `esCasoPrecioJustoStr`): precio a
   * mercado + tarifa/ocupación ancladas a la mediana observada + veredicto
   * degradado. Cambia el CIERRE del caso estructural — la brecha no es del
   * departamento, es de lo que la zona rinde en corto a estos precios de compra.
   */
  casoPrecioJusto?: boolean;
}): HallazgoDistanciaVeredicto | null {
  if (p.veredictoBase === "COMPRAR") return null;
  if (!Number.isFinite(p.precioUF) || p.precioUF <= 0) return null;
  if (!Number.isFinite(p.precioCLP) || p.precioCLP <= 0) return null;
  if (!Number.isFinite(p.adrActual) || p.adrActual <= 0) return null;

  const veredictoObjetivo: Veredicto =
    p.veredictoBase === "BUSCAR OTRA" ? "AJUSTA SUPUESTOS" : "COMPRAR";

  // PURO-GATE: la banda del score sola ya alcanza el objetivo. 14 de 82 en el parque — al
  // revés que LTR, donde las 143 AJUSTA tenían cero brazos de gate.
  const bandaSola: Veredicto =
    p.score >= 70 ? "COMPRAR" : p.score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  const esPuroGate = RANK[bandaSola] >= RANK[veredictoObjetivo];

  // ¿El pie califica como palanca? Mismas dos condiciones que LTR (nivel + origen), y la
  // clasificación se importa de financing-health para que este hallazgo y el de estructura
  // no puedan contradecirse dentro del mismo informe.
  const razonPie: RazonSinCapital = p.razonSinPie ?? "sin_pie";
  const esBonoPie = p.piePct === 0 && razonPie === DIST_PIE_RAZON_EXCLUIDA;
  const nivelPie = Number.isFinite(p.piePct) ? classifyPieLevel(p.piePct) : "optimo";
  const pieCalifica = !esBonoPie && (nivelPie === "mejorable" || nivelPie === "problematico");

  const alcanzaMeta = (v: Veredicto, meta: Veredicto) => RANK[v] >= RANK[meta];
  // El tope gobierna el SALTO medido, no el veredicto de partida (mismo criterio que LTR).
  const topeDe = (meta: Veredicto) =>
    meta === "COMPRAR" ? DIST_STR_TOPE_AJUSTA_PCT : topeStrParaVeredicto(p.veredictoBase);
  const topeAplicado = topeStrParaVeredicto(p.veredictoBase);

  /** Explora las CINCO vías STR para una meta dada. `palancas` = solo las que cruzan
   *  (pie y gestión primero, luego por |delta|); `vias` = las cinco con su estado, en
   *  orden canónico precio · tarifa · plazo · pie · gestión (goal T0 CONGELADO, 04-sep-2026).
   *  El pie se explora hasta el tope de 30% siempre que exista y no esté ya en el techo:
   *  con 20% "cruza" es un intercambio (más capital el día 1 a cambio de un mes que
   *  cierra), no una recomendación — el copy lo dice con ese estado. */
  const palancasHasta = (meta: Veredicto): { palancas: PalancaDistancia[]; vias: ViaDistancia[] } => {
    const relativas: PalancaDistancia[] = [];
    const tope = topeDe(meta);
    let viaPrecio: ViaDistancia;
    let viaAdr: ViaDistancia;
    let viaPlazo: ViaDistancia;
    let viaPie: ViaDistancia;
    let viaGestion: ViaDistancia;

    // PRECIO — baja hasta el tope general.
    const fPre = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ precioCompra: Math.round(p.precioCLP * f) }), meta),
      1 - tope / 100,
      false,
    );
    if (fPre != null) {
      const objetivo = Math.floor(p.precioUF * fPre);
      const pal: PalancaDistancia = {
        palanca: "precio",
        objetivo,
        actual: p.precioUF,
        deltaPct: Math.round((objetivo / p.precioUF - 1) * 1000) / 10, // negativo
        deltaAbs: objetivo - p.precioUF,
      };
      relativas.push(pal);
      viaPrecio = { estado: "cruza", ...pal };
    } else {
      viaPrecio = {
        estado: "noCruza",
        palanca: "precio",
        actual: p.precioUF,
        topeExplorado: tope,
        razon: `ni bajando el precio un ${fmtPct(tope)}% cambia el veredicto`,
      };
    }

    // ADR — sube, pero contra SU tope, no el general. Es la única palanca cuyo techo no se
    // mueve con el veredicto: pedir superar la tarifa observada de la zona es igual de
    // arriesgado venga de donde venga el deal.
    const fAdr = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ adrOverride: Math.round(p.adrActual * f) }), meta),
      1 + DIST_STR_TOPE_ADR_PCT / 100,
      true,
    );
    if (fAdr != null) {
      const objetivo = Math.ceil(p.adrActual * fAdr);
      const pal: PalancaDistancia = {
        palanca: "adr",
        objetivo,
        actual: p.adrActual,
        deltaPct: Math.round((objetivo / p.adrActual - 1) * 1000) / 10,
        deltaAbs: objetivo - p.adrActual,
      };
      relativas.push(pal);
      viaAdr = { estado: "cruza", ...pal };
    } else {
      viaAdr = {
        estado: "noCruza",
        palanca: "adr",
        actual: p.adrActual,
        topeExplorado: DIST_STR_TOPE_ADR_PCT,
        razon: `ni cobrando un ${fmtPct(DIST_STR_TOPE_ADR_PCT)}% más por noche cambia el veredicto`,
      };
    }

    // PLAZO — entero, redondeado hacia arriba al tramo comercial (los bancos ofrecen
    // 15/20/25/30, no años sueltos) y RE-VERIFICADO en ese tramo antes de emitirlo: si el
    // redondeo no cruzara, la palanca no se emite en vez de prometer algo falso.
    if (!Number.isFinite(p.plazoCredito) || p.plazoCredito <= 0) {
      viaPlazo = { estado: "noAplica", palanca: "plazo", actual: 0, razon: "sin crédito no hay plazo que estirar" };
    } else if (p.plazoCredito >= DIST_PLAZO_TOPE_ANIOS) {
      viaPlazo = {
        estado: "noAplica",
        palanca: "plazo",
        actual: p.plazoCredito,
        razon: `ya en ${DIST_PLAZO_TOPE_ANIOS} años: es el máximo que dan los bancos`,
      };
    } else {
      viaPlazo = {
        estado: "noCruza",
        palanca: "plazo",
        actual: p.plazoCredito,
        topeExplorado: DIST_PLAZO_TOPE_ANIOS,
        razon: `ni a ${DIST_PLAZO_TOPE_ANIOS} años cambia el veredicto`,
      };
      for (let anios = Math.floor(p.plazoCredito) + 1; anios <= DIST_PLAZO_TOPE_ANIOS; anios++) {
        if (!alcanzaMeta(p.veredictoAtPatch({ plazoCredito: anios }), meta)) continue;
        const comercial = Math.min(
          DIST_PLAZO_TOPE_ANIOS,
          Math.ceil(anios / DIST_PLAZO_TRAMO_ANIOS) * DIST_PLAZO_TRAMO_ANIOS,
        );
        if (comercial > p.plazoCredito && alcanzaMeta(p.veredictoAtPatch({ plazoCredito: comercial }), meta)) {
          const pal: PalancaDistancia = {
            palanca: "plazo",
            objetivo: comercial,
            actual: p.plazoCredito,
            deltaPct: Math.round((comercial / p.plazoCredito - 1) * 1000) / 10,
            deltaAbs: comercial - p.plazoCredito,
          };
          relativas.push(pal);
          viaPlazo = { estado: "cruza", ...pal };
        }
        break;
      }
    }

    // Más barata primero, entre las que se expresan como cambio relativo.
    relativas.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));

    // ── Palancas de UNIDADES PROPIAS, al frente y fuera del sort de arriba ──
    // Pie y gestión miden en puntos porcentuales, no en cambio relativo: compararlas por
    // |deltaPct| contra precio/ADR/plazo mezclaría unidades. Van primero por prioridad real,
    // no cosmética — son las dos únicas vías que no dependen de que el vendedor acepte ni de
    // que el mercado dé más. El pie antes que la gestión: cambiar de administrador es una
    // decisión operativa reversible, poner más capital es la que de verdad reordena el deal.
    const propias: PalancaDistancia[] = [];
    // El pie que cruza sin ser prioritario (ya cumple con 20% o más) va al final: cruza,
    // pero es un intercambio de capital, no la vía que Franco recomienda primero.
    const pieAlFinal: PalancaDistancia[] = [];

    if (esBonoPie) {
      viaPie = { estado: "noAplica", palanca: "pie", actual: p.piePct, razon: "el pie lo cubre la inmobiliaria: subirlo desarma el trato" };
    } else if (!Number.isFinite(p.piePct) || p.piePct >= DIST_PIE_TOPE_PCT) {
      viaPie = {
        estado: "noAplica",
        palanca: "pie",
        actual: p.piePct,
        razon: `ya con ${fmtPct(p.piePct)}% de pie: sobre ${DIST_PIE_TOPE_PCT}% Franco no lo prueba como ajuste`,
      };
    } else {
      viaPie = {
        estado: "noCruza",
        palanca: "pie",
        actual: p.piePct,
        topeExplorado: DIST_PIE_TOPE_PCT,
        razon: `ni con un pie de ${DIST_PIE_TOPE_PCT}% cambia el veredicto`,
      };
      for (let pie = Math.floor(p.piePct) + 1; pie <= DIST_PIE_TOPE_PCT; pie++) {
        if (!alcanzaMeta(p.veredictoAtPatch({ piePercent: pie / 100 }), meta)) continue;
        const pal: PalancaDistancia = {
          palanca: "pie",
          objetivo: pie,
          actual: p.piePct,
          deltaPct: Math.round((pie - p.piePct) * 10) / 10, // PUNTOS porcentuales
          deltaAbs: Math.round((pie - p.piePct) * 10) / 10,
        };
        if (pieCalifica) propias.push(pal);
        else pieAlFinal.push(pal);
        viaPie = { estado: "cruza", ...pal };
        break;
      }
    }

    // GESTIÓN — discreta, una sola evaluación: o el otro modo cruza o no. Los números
    // expresan la COMISIÓN sobre el ingreso, que es lo que efectivamente cambia de un modo
    // al otro (el ingreso es el mismo en ambos).
    {
      const otro = p.modoGestionActual === "auto" ? "administrador" : "auto";
      const comActual = (p.modoGestionActual === "auto" ? p.comisionAutoDec : p.comisionAdminDec) * 100;
      const comObjetivo = (otro === "auto" ? p.comisionAutoDec : p.comisionAdminDec) * 100;
      if (alcanzaMeta(p.veredictoAtPatch({ modoGestion: otro }), meta)) {
        const pal: PalancaDistancia = {
          palanca: "gestion",
          modoGestionObjetivo: otro,
          objetivo: Math.round(comObjetivo * 10) / 10,
          actual: Math.round(comActual * 10) / 10,
          deltaPct: Math.round((comObjetivo - comActual) * 10) / 10, // PUNTOS porcentuales
          deltaAbs: Math.round((comObjetivo - comActual) * 10) / 10,
        };
        propias.push(pal);
        viaGestion = { estado: "cruza", ...pal };
      } else {
        viaGestion = {
          estado: "noCruza",
          palanca: "gestion",
          actual: Math.round(comActual * 10) / 10,
          topeExplorado: Math.round(comObjetivo * 10) / 10,
          razon: otro === "auto" ? "ni gestionándolo tú cambia el veredicto" : "ni con administrador cambia el veredicto",
        };
      }
    }

    return { palancas: [...propias, ...relativas, ...pieAlFinal], vias: [viaPrecio, viaAdr, viaPlazo, viaPie, viaGestion] };
  };

  const explorado = palancasHasta(veredictoObjetivo);
  const palancas = explorado.palancas;
  const vias = explorado.vias;
  const palancaMasBarata = palancas[0] ?? null;
  const esEstructural = palancas.length === 0;

  // Estructural: delta mínimo en rango EXTENDIDO, solo para respaldar la frase dura con el
  // número real. No es accionable — es evidencia. Se computa solo acá (2 bisecciones extra).
  let deltaMinimoFueraDeTope: HallazgoDistanciaVeredicto["valor"]["deltaMinimoFueraDeTope"] = null;
  if (esEstructural) {
    const candidatos: { palanca: "precio" | "adr"; deltaPct: number }[] = [];
    const fAdrExt = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ adrOverride: Math.round(p.adrActual * f) }), veredictoObjetivo),
      DIST_STR_EXT_ADR_MAX,
      true,
    );
    if (fAdrExt != null) candidatos.push({ palanca: "adr", deltaPct: Math.round((fAdrExt - 1) * 1000) / 10 });
    const fPreExt = biseccionFactor(
      (f) => alcanzaMeta(p.veredictoAtPatch({ precioCompra: Math.round(p.precioCLP * f) }), veredictoObjetivo),
      DIST_STR_EXT_PRECIO_MIN,
      false,
    );
    if (fPreExt != null) candidatos.push({ palanca: "precio", deltaPct: Math.round((fPreExt - 1) * 1000) / 10 });
    candidatos.sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
    deltaMinimoFueraDeTope = candidatos[0] ?? null;
  }

  // Solo para BUSCAR OTRA: ¿el salto de DOS bandas cae en rango? Informativo.
  const palancaHastaComprar =
    p.veredictoBase === "BUSCAR OTRA" && !esEstructural ? (palancasHasta("COMPRAR").palancas[0] ?? null) : null;

  // Cercanía medida sobre la palanca RELATIVA más barata: pie y gestión están en puntos
  // porcentuales y dividirlas por un tope expresado en cambio relativo daría una cercanía
  // falsa. El ADR tampoco sirve de vara: su tope es otro.
  const masBarataRelativa = palancas.find((l) => l.palanca === "precio" || l.palanca === "plazo") ?? null;
  const cercaniaUmbral = masBarataRelativa
    ? clamp01(1 - Math.abs(masBarataRelativa.deltaPct) / topeAplicado)
    : 0;

  const objetivoNombre = veredictoObjetivo;
  const glosa = glosaDe(p.motivosGate);
  let titular: string;
  let fraseCanonica: string;

  if (esEstructural) {
    titular = "Ningún ajuste realista lo lleva al veredicto de arriba.";
    // FRASE ESTRUCTURAL (fix del signo, 02-sep-2026 — espejo del LTR c48877d):
    // `deltaMinimoFueraDeTope` es lo MÍNIMO que SÍ cruza (bisección en rango extendido) y
    // la frase lo escribía como si no cruzara ("Ni cerrando un 33,6% bajo el precio…").
    // Ahora: (1) los topes probados sin cruzar (precio según banda, tarifa con su tope
    // propio) y la cifra que recién cruzaría; (2) plazo, pie y gestión según lo que el
    // builder probó; (3) el cierre de brecha. Todo desde constantes y estado del builder,
    // nunca literales. T0 CONGELADO (04-sep-2026): las cifras se leen de `vias`, como en LTR.
    const dm = deltaMinimoFueraDeTope;
    const vPrecio = vias.find((v) => v.palanca === "precio");
    const vAdr = vias.find((v) => v.palanca === "adr");
    const vPlazo = vias.find((v) => v.palanca === "plazo");
    const vPie = vias.find((v) => v.palanca === "pie");
    const vGestion = vias.find((v) => v.palanca === "gestion");
    const topeP = vPrecio?.estado === "noCruza" ? vPrecio.topeExplorado : topeAplicado;
    const topeA = vAdr?.estado === "noCruza" ? vAdr.topeExplorado : DIST_STR_TOPE_ADR_PCT;
    const hecho = `Cerrar hasta −${fmtPct(topeP)}% bajo el precio o cobrar hasta +${fmtPct(topeA)}% más por noche no cambia el veredicto`;
    const primera = dm
      ? `${hecho}; recién ${
          dm.palanca === "precio"
            ? `con −${fmtPct(Math.abs(dm.deltaPct))}% de precio`
            : `cobrando +${fmtPct(Math.abs(dm.deltaPct))}% por noche`
        } cruzaría a ${objetivoNombre}, y eso ya no es un ajuste.`
      : `${hecho}, y tampoco lo hace ningún ajuste en rango.`;
    // Segunda oración: plazo, pie y gestión por su estado en `vias` (solo las `noCruza`;
    // `noAplica` se omite). Sin ninguna, no hay segunda oración.
    const tramos: string[] = [];
    if (vPlazo?.estado === "noCruza") tramos.push(`a ${vPlazo.topeExplorado} años`);
    if (vPie?.estado === "noCruza") tramos.push(`con pie ${fmtPct(vPie.topeExplorado)}%`);
    if (vGestion?.estado === "noCruza") tramos.push(p.modoGestionActual === "auto" ? "con administrador" : "autogestionando");
    const segunda = tramos.length === 0 ? "" : tramos.length === 1 ? ` Ni ${tramos[0]} cambia.` : ` Ni ${tramos.slice(0, -1).join(", ni ")} ni ${tramos[tramos.length - 1]} cambia.`;
    // Cierre del estructural (§1.12.4): con precio a mercado y tarifa/ocupación
    // ancladas a la mediana observada, "la brecha es del negocio" apunta mal —
    // el negocio está a mercado; lo que no rinde en corto a estos precios de
    // compra es la zona. Variante canónica STR.
    const cierreBrecha = p.casoPrecioJusto
      ? "La brecha no es de este departamento ni de su precio — esta zona no sostiene renta corta a los precios de compra actuales. Otro depto igual, acá mismo, tendría el mismo problema."
      : "La brecha es del negocio, no de cómo lo estás mirando.";
    fraseCanonica = `${primera}${segunda} ${cierreBrecha}`;
  } else {
    const l = palancaMasBarata!;
    const d = fmtPct(Math.abs(l.deltaPct));
    // La VÍA se redacta igual en los dos casos; lo que cambia es cómo se abre la frase. En
    // puro-gate no se puede decir "estás cerca" —el puntaje ya alcanzó—, así que se nombra
    // lo que hoy retiene el veredicto y recién después la vía que lo apaga.
    let via: string;
    if (l.palanca === "pie") {
      via =
        p.piePct === 0
          ? `poniendo un pie de ${fmtPct(l.objetivo)}% en vez de financiar el 100%, sin tocar el precio ni la tarifa`
          : `subiendo el pie de ${fmtPct(l.actual)}% a ${fmtPct(l.objetivo)}%, sin tocar el precio ni la tarifa`;
    } else if (l.palanca === "gestion") {
      via =
        l.modoGestionObjetivo === "auto"
          ? `gestionando tú el departamento en vez de dejarlo con administrador: te ahorras el ${fmtPct(Math.abs(l.actual))}% de comisión que hoy pagas`
          : `dejándolo con un administrador en vez de gestionarlo tú: te cuesta ${fmtPct(Math.abs(l.deltaPct))} puntos más de comisión, y aun así cruza`;
    } else if (l.palanca === "precio") {
      via = `cerrando en ${fmtUF(l.objetivo)} en vez de ${fmtUF(l.actual)} —un ${d}% menos—`;
    } else if (l.palanca === "adr") {
      via =
        `cobrando ${fmtCLP(l.objetivo)} por noche en vez de ${fmtCLP(l.actual)} —un ${d}% sobre lo que ` +
        `hoy rinde la zona—. Ojo con esta vía: la tarifa sale de lo que se cobra realmente alrededor, ` +
        `así que no es un supuesto que ajustas, es una apuesta a rendir sobre la mediana`;
    } else {
      via =
        `estirando el crédito de ${l.actual} a ${l.objetivo} años, sin cambiar el precio ni la tarifa. ` +
        `Alargas la deuda y pagas más intereses en total; a cambio, el aporte mensual baja lo suficiente`;
    }

    if (esPuroGate) {
      titular = "Lo que lo retiene no es el puntaje.";
      fraseCanonica = glosa
        ? `Tu puntaje ya da para ${objetivoNombre}; lo que lo retiene es que ${glosa}. Eso se da vuelta ${via}.`
        : `Tu puntaje ya da para ${objetivoNombre}: lo que falta no son puntos, es que la operación cierre. Se da vuelta ${via}.`;
    } else if (l.palanca === "pie") {
      titular = "Está a un pie de distancia del veredicto de arriba.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ${via}. Es la única vía que no depende de que ` +
        `el vendedor acepte ni de que la zona rinda más: depende de tu liquidez.`;
    } else if (l.palanca === "gestion") {
      titular = "Está a una decisión de gestión del veredicto de arriba.";
      fraseCanonica = `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ${via}.`;
    } else if (l.palanca === "precio") {
      titular = "Está cerca del veredicto de arriba por el lado del precio.";
      fraseCanonica =
        `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ${via}. Es una diferencia de negociación, ` +
        `no de otro departamento.`;
    } else if (l.palanca === "adr") {
      titular = "Está cerca del veredicto de arriba por el lado de la tarifa.";
      fraseCanonica = `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ${via}.`;
    } else {
      titular = "Está cerca del veredicto de arriba por el lado del crédito.";
      fraseCanonica = `Tu veredicto ${p.veredictoBase} pasa a ${objetivoNombre} ${via} para cruzar.`;
    }
  }

  return {
    id: "distancia_veredicto",
    tipo: "distancia_umbral",
    valor: {
      veredictoBase: p.veredictoBase,
      veredictoObjetivo,
      palancas,
      vias,
      palancaMasBarata,
      palancaHastaComprar,
      esEstructural,
      deltaMinimoFueraDeTope,
      topePct: topeAplicado,
      topeAdrPct: DIST_STR_TOPE_ADR_PCT,
      cercaniaUmbral,
      // Contrato heredado del hallazgo LTR: solo los severos. Los de GATE 2 viajan aparte
      // en `motivosGate`, porque en STR el copy también los necesita.
      brazosGate1Activos: p.motivosGate.filter((m) => m.startsWith("g1_")),
      motivosGate: p.motivosGate,
      esPuroGate,
      pieEsPalanca: pieCalifica,
      pieExcluidoPorBono: esBonoPie,
      piePctActual: Number.isFinite(p.piePct) ? p.piePct : undefined,
      casoPrecioJusto: p.casoPrecioJusto === true,
      modalidad: "str",
    },
    // NEUTRAL: es un mapa de la distancia al umbral, no una señal sobre el deal.
    direccion: "neutral",
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad (igual que LTR)
    // SIN magnitudContinua: la cercanía vive en valor.cercaniaUmbral, fuera de los sorts.
    procedencia: {
      base: "Reevaluación del veredicto moviendo una palanca a la vez: pie, modo de gestión, precio, tarifa por noche y plazo del crédito",
      confianza: "alta",
    },
    titular,
    fraseCanonica,
  };
}
