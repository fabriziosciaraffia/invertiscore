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
  /** true cuando ambas referencias existen y discrepan en SIGNO (la trampa del testigo). */
  signosOpuestos: boolean;
}

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

  if (lineas.length === 0) return { bloque: "", signosOpuestos: false };

  // ── ¿Las dos referencias apuntan a lados distintos? ──
  const signosOpuestos =
    vmVale && desvVm !== null && args.medianaConfiable && args.desviacionPct !== null &&
    Math.sign(desvVm) !== 0 && Math.sign(args.desviacionPct) !== 0 &&
    Math.sign(desvVm) !== Math.sign(args.desviacionPct);

  const reglas = [
    `Cada afirmación de precio nombra SU ámbito. "Barato" o "caro" sin decir contra qué está PROHIBIDO: escribe "bajo la mediana de la comuna" o "sobre el valor estimado de tu cuadra", nunca "bajo el valor de la zona" a secas.`,
    `Para "¿estoy pagando de más por el metro?" manda la MEDIANA DE LA COMUNA (es la que sostiene la card de precio por metro). Para "¿cuánta plata pongo o gano el día de la firma?" manda el VALOR ESTIMADO DEL ACTIVO. No las cruces: no midas la pérdida patrimonial contra la mediana comunal ni la posición de precio contra el valor del radio.`,
    `PROHIBIDO promediarlas, elegir la que conviene al argumento, o presentar una como corrección de la otra. Miden cosas distintas; ninguna corrige a la otra.`,
  ];
  if (signosOpuestos) {
    reglas.push(
      `⚠️ EN ESTE CASO APUNTAN A LADOS OPUESTOS (una dice que entras bien y la otra que pagas de más). NO elijas una ni las promedies: dilo con los dos ámbitos en la MISMA frase, con este encuadre (adáptalo lo mínimo): ` +
      `"frente al m² de la comuna entras ${(args.desviacionPct as number) < 0 ? "bajo la mediana" : "sobre la mediana"}, pero contra los comparables de tu propia cuadra estás pagando ${(desvVm as number) > 0 ? "por encima" : "por debajo"} — no es contradicción: la comuna es un promedio amplio y tu cuadra es el mercado que efectivamente compite con este depto".`,
    );
  }

  return {
    signosOpuestos,
    bloque: `

=== REFERENCIAS DE ZONA (ámbito declarado — hay DOS mediciones distintas y ninguna es "la zona" a secas) ===
${lineas.join("\n")}
${reglas.map((r) => `· ${r}`).join("\n")}`,
  };
}
