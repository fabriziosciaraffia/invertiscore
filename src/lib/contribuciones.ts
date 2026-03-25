/**
 * Estima contribuciones trimestrales según normativa SII.
 * Fuente: Ley 17.235, tasas vigentes reavalúo 2022-2025.
 *
 * @param precioCLP - Precio comercial en CLP
 * @param esNuevo - true si condicion === 'nuevo' (aplica DFL-2)
 * @returns contribución trimestral estimada en CLP
 */
export function estimarContribuciones(precioCLP: number, esNuevo: boolean = false): number {
  if (precioCLP <= 0) return 0;

  // Paso 1: Estimar avalúo fiscal (aprox 70% del valor comercial)
  const RATIO_AVALUO_COMERCIAL = 0.70;
  const avaluoFiscal = precioCLP * RATIO_AVALUO_COMERCIAL;

  // Paso 2: Exenciones
  const EXENCION_GENERAL = 57_000_000;  // ~$57M primer semestre 2025
  const EXENCION_DFL2 = 50_000_000;     // ~$50M adicional para DFL-2 (deptos nuevos)
  const CAMBIO_TASA = 118_571_000;      // Monto donde cambia de tasa 1 a tasa 2

  // Exención total aplicable
  const exencion = esNuevo
    ? Math.max(EXENCION_GENERAL, EXENCION_DFL2)
    : EXENCION_GENERAL;

  // Paso 3: Avalúo afecto (lo que queda después de exención)
  const avaluoAfecto = Math.max(0, avaluoFiscal - exencion);

  if (avaluoAfecto <= 0) return 0; // Exento de contribuciones

  // Paso 4: Tasas progresivas
  const TASA_1 = 0.00933;  // 0,933% anual hasta monto cambio de tasa
  const TASA_2 = 0.01088;  // 1,088% anual sobre monto cambio de tasa

  const tramoTasa1 = Math.max(0, Math.min(avaluoAfecto, CAMBIO_TASA - exencion));
  const tramoTasa2 = Math.max(0, avaluoAfecto - tramoTasa1);

  let contribAnual = (tramoTasa1 * TASA_1) + (tramoTasa2 * TASA_2);

  // Paso 5: Sobretasa beneficio fiscal (0,025% sobre tramo tasa 2)
  if (tramoTasa2 > 0) {
    contribAnual += tramoTasa2 * 0.00025;
  }

  // Trimestral
  return Math.round(contribAnual / 4);
}
