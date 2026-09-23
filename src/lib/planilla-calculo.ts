// ============================================================================
// «CÓMO SE CALCULA» — formatos y textos de la planilla (23-sep-2026)
// ============================================================================
// Mockup aprobado: docs/wireframes/rediseno-informe/planilla-como-se-calcula.html.
// Módulo puro: el render solo pinta. Dos reglas que viven acá y que el gate ejercita:
//   · LA MONEDA SIGUE EL TOGGLE: todo monto de la planilla pasa por estas funciones con la
//     moneda del informe. Pesos exactos en escritorio; millones con un decimal en teléfono (UF sin
//     decimales), con el redondeo avisado bajo la tabla.
//   · LOS TEXTOS FIJOS SALEN DEL DATO: la vacancia del caso, la entrega si es futura y la comisión
//     según quién opera. Hasta hoy decían «0,6 mes» (394 de 1.214 filas tienen otra vacancia),
//     «Entrega inmediata» (26 STR con entrega futura) y «comisión de plataforma 3%» (14 STR con
//     administrador).
// ============================================================================

export type Moneda = "CLP" | "UF";

const menos = (n: number) => (n < 0 ? "−" : "");
const miles = (n: number, dec = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Una celda de la tabla de flujo, sin símbolo (la unidad va en el rótulo de arriba). */
export function montoCelda(n: number, moneda: Moneda, valorUF: number, compacto: boolean): string {
  if (moneda === "UF") {
    const u = n / valorUF;
    return menos(u) + miles(Math.abs(u), compacto ? 0 : 1);
  }
  return compacto ? menos(n) + miles(Math.abs(n) / 1_000_000, 1) : menos(n) + miles(Math.round(Math.abs(n)));
}

/** Un monto dentro de una cuenta o una frase, con su símbolo: «$6.000.000» / «UF 146,8». */
export function montoCuenta(n: number, moneda: Moneda, valorUF: number): string {
  if (moneda === "UF") return `${menos(n)}UF ${miles(Math.abs(n / valorUF), 1)}`;
  return `${menos(n)}$${miles(Math.round(Math.abs(n)))}`;
}

/** Un monto grande dicho corto, para el teléfono: «$36,2 MM» / «UF 885». */
export function montoCorto(n: number, moneda: Moneda, valorUF: number): string {
  if (moneda === "UF") return `${menos(n)}UF ${miles(Math.round(Math.abs(n / valorUF)))}`;
  return `${menos(n)}$${miles(Math.abs(n) / 1_000_000, 1)} MM`;
}

/** El rótulo de la unidad, sobre la tabla. */
export function unidadTabla(moneda: Moneda, compacto: boolean): string {
  if (moneda === "UF") return compacto ? "UF de cada año, sin decimales" : "UF de cada año";
  return compacto ? "Millones de pesos de cada año" : "Pesos de cada año";
}

/** El aviso del redondeo, bajo la tabla del teléfono. */
export function avisoRedondeo(moneda: Moneda): string {
  return `${moneda === "UF" ? "En UF sin decimales" : "Redondeado a cien mil pesos"}: una fila puede no sumar por una décima. El flujo neto es siempre el del motor.`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «2027-8» → «agosto de 2027». Vacío si no se puede leer. */
export function fechaEntregaTexto(fecha?: string | null): string {
  if (!fecha) return "";
  const [y, m] = String(fecha).split("-").map(Number);
  return y && m && MESES[m - 1] ? `${MESES[m - 1]} de ${y}` : "";
}

const decimal = (n: number) => miles(n, Number.isInteger(n) ? 0 : 1);

// ── LTR ─────────────────────────────────────────────────────────────────────

/** La bajada del flujo LTR: la entrega si es futura, el reajuste si no. */
export function bajadaFlujoLtr(p: { aniosSinArriendo: number; fechaEntrega?: string | null }): string {
  if (p.aniosSinArriendo > 0) {
    const f = fechaEntregaTexto(p.fechaEntrega);
    const n = p.aniosSinArriendo === 1 ? "el primer año no hay arriendo" : `los primeros ${p.aniosSinArriendo} años no hay arriendo`;
    return `El depto se entrega${f ? ` en ${f}` : " después"}: ${n}, y la tabla lo muestra en cero.`;
  }
  return "Cada año con el arriendo, los gastos y la cuota reajustados.";
}

/** Lo que junta la columna «gastos» en LTR, con la vacancia del caso. */
export function fuenteFlujoLtr(p: { vacanciaMeses: number; usaAdministrador?: boolean; comisionAdministradorPct?: number | null }): string {
  const vac = `vacancia de ${decimal(p.vacanciaMeses)} ${p.vacanciaMeses === 1 ? "mes" : "meses"} al año`;
  const adm = p.usaAdministrador ? ` + administración ${decimal(p.comisionAdministradorPct ?? 0)}% del arriendo` : "";
  return `Arriendo reajustado 3,5% al año · gastos y cuota 3% al año · gastos = gastos comunes en vacancia + contribuciones + mantención + ${vac} + corretaje y recambio${adm}`;
}

// ── STR ─────────────────────────────────────────────────────────────────────

/** La bajada del flujo STR: la entrega si es futura (el primer año operativo es parcial). */
export function bajadaFlujoStr(p: { primerAnioOperativo: number; mesesPrimerAnio: number; fechaEntrega?: string | null }): string {
  if (p.mesesPrimerAnio < 12 || p.primerAnioOperativo > 1) {
    const f = fechaEntregaTexto(p.fechaEntrega);
    const m = `${p.mesesPrimerAnio} ${p.mesesPrimerAnio === 1 ? "mes" : "meses"}`;
    return `El depto se entrega${f ? ` en ${f}` : " después"}: el año ${p.primerAnioOperativo} opera ${m}, y ahí entran la estabilización y el amoblamiento.`;
  }
  return "Entrega inmediata: el año 1 ya opera, con la estabilización inicial descontada.";
}

/** Lo que junta la columna «gastos» en STR, con la comisión de quien opera. */
export function fuenteFlujoStr(p: { comisionAdministradorPct: number | null; estabilizacion: string; amoblamiento: string | null }): string {
  const com = p.comisionAdministradorPct != null ? `administrador ${decimal(p.comisionAdministradorPct)}% del ingreso, en vez de la comisión de plataforma` : "comisión de plataforma 3% del ingreso";
  return `Ingreso reajustado 3,5% al año · costos y cuota 3% al año · gastos = ${com} + luz, agua, internet, insumos, gastos comunes, mantención y contribuciones + estabilización inicial ${p.estabilizacion}${p.amoblamiento ? ` + amoblamiento ${p.amoblamiento} el año de la entrega` : ""}`;
}
