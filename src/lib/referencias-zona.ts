// ============================================================================
// REFERENCIAS DE ZONA — ámbito declarado + jerarquía (coherencia zona ↔ prosa)
// ============================================================================
// El re-censo dejó una familia de contradicciones donde el MISMO informe dice
// "entras barato" y "pagas 107% sobre el valor de zona" (testigo 05462488). No
// es un caché viejo ni un error de cálculo: son DOS MEDICIONES DISTINTAS de
// cosas distintas, narradas con el mismo nombre ("la zona").
//
//   · valorMercadoFranco (vm) — comparables dentro de un RADIO (~800 m) alrededor
//     del depto, calculado por el wizard y congelado en el input. Estima cuánto
//     vale ESTE activo en SU cuadra.
//   · mediana comunal — mediana de precio/m² de la COMUNA entera, ±20% de
//     superficie, dentro del universo (nuevo|usado), con veredicto explícito de
//     confiabilidad del motor. Responde "cómo se paga el m² en esta comuna".
//
// Medido sobre el parque: divergen 12% en mediana, 73 de 125 filas sobre 10% y
// 53 sobre 25%. No hay una "correcta" — miden ámbitos distintos. La prosa las
// mezclaba porque el prompt se las entregaba sin decir de qué era cada una.
//
// Este módulo es el espejo geográfico de `precio-jerarquia.ts` (§1.12.6): una
// cifra canónica por rol, el ÁMBITO declarado y la subordinación ya escrita. No
// borra ninguna de las dos: las nombra.
// ============================================================================

export interface ReferenciasZona {
  /** Bloque listo para interpolar en el user prompt ("" si no hay nada que jerarquizar). */
  bloque: string;
  /**
   * true cuando las dos referencias apuntan a lados opuestos Y la diferencia es
   * MATERIAL (piso de magnitud, ver CONFLICTO_*). Con el solo criterio de signo,
   * 52 de 280 informes quedaban marcados — muchos por conflictos triviales
   * ("radio 0% vs comuna −6%") donde exigir una frase de reconciliación es
   * absurdo. El piso deja solo los casos donde el lector percibe la contradicción.
   */
  signosOpuestos: boolean;
  /**
   * Frase canónica que reconcilia las dos lecturas. La misma que el bloque le
   * pide al modelo y la que el guard appendea cuando el modelo no la escribió —
   * una sola fuente para las dos capas. "" cuando no hay conflicto material.
   */
  fraseReconciliacion: string;
}

/** Piso de magnitud del conflicto material (ver `signosOpuestos`). */
export const CONFLICTO_MIN_PCT = 5;
export const CONFLICTO_MIN_SEPARACION_PTS = 20;

const fmtUFz = (n: number) => `UF ${(Math.round(n * 10) / 10).toLocaleString("es-CL")}`;
const pctz = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-CL");

export function construirReferenciasZona(args: {
  precioPedidoUF: number;
  superficieM2: number;
  /** Valor estimado del activo por comparables del radio (input.valorMercadoFranco). */
  vmFrancoUF: number | null;
  /** El motor considera vm un dato real y no el fallback vm = precio. */
  tieneDiferenciaValida: boolean;
  radioMetros: number | null;
  sampleSizeVenta: number | null;
  /** Mediana comunal (UF/m²) y su veredicto de confiabilidad, del motor. */
  medianaComunaUfM2: number | null;
  desviacionPct: number | null;
  medianaConfiable: boolean;
  nComuna: number;
  universo: "nuevo" | "usado" | undefined;
  sujetoUfM2: number;
}): ReferenciasZona {
  const lineas: string[] = [];

  // ── Referencia por RADIO (el activo en su cuadra) ──
  const vmVale = args.tieneDiferenciaValida && args.vmFrancoUF !== null && args.vmFrancoUF > 0;
  const vmM2 = vmVale && args.superficieM2 > 0 ? (args.vmFrancoUF as number) / args.superficieM2 : null;
  const desvVm = vmVale && args.precioPedidoUF > 0
    ? ((args.precioPedidoUF - (args.vmFrancoUF as number)) / (args.vmFrancoUF as number)) * 100
    : null;
  if (vmVale) {
    const alcance = args.radioMetros
      ? `comparables publicados dentro de ${args.radioMetros} m de la propiedad${args.sampleSizeVenta ? ` (n=${args.sampleSizeVenta})` : ""}`
      : "comparables del entorno inmediato de la propiedad";
    lineas.push(
      `- VALOR ESTIMADO DEL ACTIVO (ámbito: RADIO): ${fmtUFz(args.vmFrancoUF as number)}${vmM2 ? ` = ${fmtUFz(vmM2)}/m²` : ""} — ${alcance}. ` +
      `Responde "cuánto vale ESTE depto en SU cuadra". Es la base de la ventaja o pérdida patrimonial del día de la firma` +
      (desvVm !== null ? ` (pides ${desvVm >= 0 ? "+" : ""}${pctz(desvVm)}% respecto de ese valor)` : "") + ".",
    );
  }

  // ── Referencia COMUNAL (cómo se paga el m² acá) ──
  if (args.medianaConfiable && args.medianaComunaUfM2 && args.medianaComunaUfM2 > 0) {
    const rot = args.universo ? ` de departamentos ${args.universo === "nuevo" ? "NUEVOS" : "USADOS"}` : "";
    lineas.push(
      `- MEDIANA DE LA COMUNA (ámbito: COMUNA COMPLETA): ${fmtUFz(args.medianaComunaUfM2)}/m²${rot}${args.nComuna ? ` (n=${args.nComuna})` : ""} — ` +
      `mediana del m² en toda la comuna, superficies ±20% de la tuya. Responde "cómo se paga el m² acá"` +
      (args.desviacionPct !== null ? `; tu ${fmtUFz(args.sujetoUfM2)}/m² queda ${args.desviacionPct >= 0 ? "+" : ""}${pctz(args.desviacionPct)}%` : "") + ".",
    );
  } else {
    lineas.push(
      `- MEDIANA DE LA COMUNA: SIN DATO CONFIABLE. PROHIBIDO afirmar nada sobre el precio frente a la comuna — ` +
      `ni "sobre la mediana", ni "bajo la mediana", ni "en línea con la comuna". La sección de zona de este informe tampoco la muestra.`,
    );
  }

  if (lineas.length === 0) return { bloque: "", signosOpuestos: false, fraseReconciliacion: "" };

  // ── ¿Las dos referencias apuntan a lados distintos? ──
  const signosOpuestos =
    vmVale && desvVm !== null && args.medianaConfiable && args.desviacionPct !== null &&
    Math.sign(desvVm) !== 0 && Math.sign(args.desviacionPct) !== 0 &&
    Math.sign(desvVm) !== Math.sign(args.desviacionPct) &&
    // Piso de magnitud: el conflicto tiene que ser perceptible para el lector.
    Math.abs(desvVm) >= CONFLICTO_MIN_PCT &&
    Math.abs(args.desviacionPct) >= CONFLICTO_MIN_PCT &&
    Math.abs(desvVm - args.desviacionPct) >= CONFLICTO_MIN_SEPARACION_PTS;

  const fraseReconciliacion = signosOpuestos
    ? `Frente al m² de la comuna entras ${(args.desviacionPct as number) < 0 ? "bajo la mediana" : "sobre la mediana"}, pero contra los comparables de tu propia cuadra estás pagando ${(desvVm as number) > 0 ? "por encima" : "por debajo"}: no es contradicción — la comuna es un promedio amplio y tu cuadra es el mercado que efectivamente compite con este depto.`
    : "";

  const reglas = [
    `Cada afirmación de precio nombra SU ámbito. "Barato" o "caro" sin decir contra qué está PROHIBIDO: escribe "bajo la mediana de la comuna" o "sobre el valor estimado de tu cuadra", nunca "bajo el valor de la zona" a secas.`,
    `Para "¿estoy pagando de más por el metro?" manda la MEDIANA DE LA COMUNA (es la que sostiene la card de precio por metro). Para "¿cuánta plata pongo o gano el día de la firma?" manda el VALOR ESTIMADO DEL ACTIVO. No las cruces: no midas la pérdida patrimonial contra la mediana comunal ni la posición de precio contra el valor del radio.`,
    `PROHIBIDO promediarlas, elegir la que conviene al argumento, o presentar una como corrección de la otra. Miden cosas distintas; ninguna corrige a la otra.`,
  ];
  if (signosOpuestos) {
    reglas.push(
      `⚠️ EN ESTE CASO APUNTAN A LADOS OPUESTOS (una dice que entras bien y la otra que pagas de más). NO elijas una ni las promedies: dilo con los dos ámbitos en la MISMA frase, con este encuadre (adáptalo lo mínimo): ` +
      `"${fraseReconciliacion}"`,
    );
  }

  return {
    signosOpuestos,
    fraseReconciliacion,
    bloque: `

=== REFERENCIAS DE ZONA (ámbito declarado — hay DOS mediciones distintas y ninguna es "la zona" a secas) ===
${lineas.join("\n")}
${reglas.map((r) => `· ${r}`).join("\n")}`,
  };
}


// ─── GUARD DE ÁMBITOS (capa 2) ──────────────────────────────────────────────
//
// El bloque de arriba pide la reconciliación; este guard verifica que esté. La
// lección acumulada del proyecto: instrucción en el prompt != enforcement (pasó
// con el voseo y con la jerarquía de precios, resueltos los dos por código).
//
// POR QUÉ ES UN REQUISITO DE PRESENCIA Y NO UNA DETECCIÓN DE COLISIÓN
// ───────────────────────────────────────────────────────────────────
// La prosa pv6 del testigo 05462488 SÍ obedeció el bloque: etiquetó cada lectura
// con su ámbito ("7% bajo la mediana de la comuna" / "107% sobre el valor
// estimado de los comparables de tu cuadra"). El juez igual la marcó, y con
// razón: ninguna pieza JUNTA las dos. Además una de las dos lecturas suele vivir
// en la CARD (motor), no en la prosa, así que un detector de colisión
// prosa-contra-prosa no puede verla por construcción. Lo enforzable es: si el
// caso es materialmente opuesto, la prosa TRAE el puente.
//
// POR QUÉ APPEND Y NO REINTENTO
// ─────────────────────────────
// Un reintento regenera el JSON completo (~8.000 tokens) para agregar una frase
// que el builder ya tiene escrita palabra por palabra. El append cuesta 0 tokens,
// es determinista y AGREGA en vez de reescribir — el mismo criterio con que el
// guard de jerarquía appendea su línea de arbitraje.

/**
 * Frases que satisfacen el guard: las que RECONCILIAN las dos lecturas. NO basta
 * con etiquetar cada ámbito por separado (eso ya lo hace la prosa que igual falla).
 * Se aceptan formas orgánicas además de la canónica: la lección del guard de
 * jerarquía fue que 2 de sus 3 falsos positivos iniciales eran prosa buena que
 * decía lo correcto con otras palabras.
 */
export const MARCADOR_RECONCILIACION =
  /(no (es|hay) contradicci[oó]n|no se contradicen|dos formas de mirar|dos referencias distintas|dos varas|seg[uú]n con qu[eé] lo compares|promedio amplio|mismo depto (medido|comparado|frente)|no es lo mismo (la comuna|comparar)|ambas lecturas|las dos lecturas|conviven sin contradecirse)/i;

/**
 * ¿Falta el puente? Devuelve true cuando el caso es materialmente opuesto y
 * NINGUNA pieza de prosa trae una frase de reconciliación.
 */
export function faltaReconciliacion(piezas: { pieza: string; texto: string }[], refs: ReferenciasZona): boolean {
  if (!refs.signosOpuestos) return false;
  return !piezas.some((p) => MARCADOR_RECONCILIACION.test(p.texto));
}

/**
 * Appendea la frase canónica al campo de prosa que mejor la aloja: la respuesta
 * directa si existe, si no la pieza de negociación. Muta `ai` in place y
 * devuelve cuántos campos tocó (0 = no encontró dónde ponerla).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendReconciliacion(ai: any, refs: ReferenciasZona): number {
  if (!refs.fraseReconciliacion) return 0;
  // Anfitrion: la pieza de NEGOCIACION, no la respuesta directa. Dos razones:
  // (1) el argumento de precio vive ahi; (2) `conviene.respuestaDirecta` es el
  // unico campo con tope duro de palabras (PLAN C GUARD), y colgarle ~35
  // palabras haria que el recorte por oracion se comiera justo la frase que
  // este guard acaba de poner. Fallback a la respuesta directa solo si la pieza
  // de negociacion no existe en esta prosa.
  const enNegociacion = typeof ai?.negociacion?.contenido_clp === "string" && ai.negociacion.contenido_clp.trim().length > 0;
  const candidatos: [string, string][] = enNegociacion
    ? [["negociacion", "contenido_clp"], ["negociacion", "contenido_uf"]]
    : [["conviene", "respuestaDirecta_clp"], ["conviene", "respuestaDirecta_uf"]];
  let tocados = 0;
  for (const [a, b] of candidatos) {
    const obj = ai?.[a];
    if (obj && typeof obj[b] === "string" && obj[b].trim().length > 0 && !MARCADOR_RECONCILIACION.test(obj[b])) {
      obj[b] = `${obj[b].replace(/\s+$/, "")} ${refs.fraseReconciliacion}`;
      tocados++;
    }
  }
  return tocados;
}
