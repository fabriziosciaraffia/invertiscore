// ─────────────────────────────────────────────────────────────────────────────
// El wizard precargado (30-sep-2026): después de pagar el pack, el próximo análisis «toma un
// minuto: tus números ya están cargados». Del informe de origen se precarga lo de la PERSONA —pie,
// tasa, plazo y modalidad— y el contexto —comuna y tipología—; el wizard solo pregunta lo del depto
// nuevo (salta pie, tasa, plazo y modalidad con `financiamientoPrecargado`).
//
// REGLA DURA: la precarga NUNCA pisa lo del depto. Solo escribe las claves de `CAMPOS_PRECARGA` y
// solo donde el wizard todavía no tiene respuesta: la dirección, el precio, la superficie, el
// arriendo y los supuestos del depto no los toca jamás (`CAMPOS_DEPTO`). El tier lo vigila.
// ─────────────────────────────────────────────────────────────────────────────
import type { WizardV4Answers } from "@/components/formulario-v4/wizardV4Nodes";

/** Lo de la persona y el contexto: lo único que la precarga puede escribir. */
export const CAMPOS_PRECARGA = [
  "pieUnidad", "pieMonto", "tasaInteres", "tasaModo", "plazoCredito", "modalidad",
  "comuna", "ciudad", "dormitorios", "banos", "esStudio", "financiamientoPrecargado",
] as const satisfies ReadonlyArray<keyof WizardV4Answers>;

/** Lo del depto: la precarga no lo toca nunca, aunque venga en el informe de origen. */
export const CAMPOS_DEPTO = [
  "direccion", "direccionConfirmada", "lat", "lng", "ubicacionPrecision", "tipoPropiedad", "antiguedad",
  "estadoVenta", "fechaEntregaMes", "fechaEntregaAnio", "superficieUtil", "estacionamientos", "bodegas",
  "precio", "arriendo", "adrTarifa", "adrOcupacion", "gastosComunes", "contribuciones",
] as const satisfies ReadonlyArray<keyof WizardV4Answers>;

type CampoPrecarga = (typeof CAMPOS_PRECARGA)[number];
export type Precarga = Partial<Pick<WizardV4Answers, CampoPrecarga>>;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const coma = (n: number) => String(n).replace(".", ",");

/** Del input guardado del informe de origen (`analisis.input_data`) a respuestas del wizard. */
export function precargaDesdeInforme(input: Record<string, unknown> | null | undefined, tipo: "long-term" | "short-term" | null | undefined): Precarga {
  if (!input) return {};
  const p: Precarga = {};
  const pie = num(input.piePct);
  if (pie !== null && pie > 0) { p.pieUnidad = "pct"; p.pieMonto = coma(pie); }
  const tasa = num(input.tasaInteres);
  if (tasa !== null && tasa > 0) {
    p.tasaInteres = coma(tasa);
    const mercado = num(input.tasaMercado);
    p.tasaModo = mercado !== null && Math.abs(mercado - tasa) < 0.005 ? "estimada" : "preaprobada";
  }
  const plazo = num(input.plazoCredito);
  if (plazo === 20 || plazo === 25 || plazo === 30) p.plazoCredito = String(plazo) as Precarga["plazoCredito"];
  p.modalidad = tipo === "short-term" ? "str" : "ltr";
  if (typeof input.comuna === "string" && input.comuna.trim()) p.comuna = input.comuna.trim();
  if (typeof input.ciudad === "string" && input.ciudad.trim()) p.ciudad = input.ciudad.trim();
  const d = num(input.dormitorios);
  if (d !== null) { p.dormitorios = String(d); p.esStudio = d === 0; }
  const b = num(input.banos);
  if (b !== null) p.banos = String(b);
  // Solo se salta el financiamiento si quedó completo: pie, tasa, plazo y modalidad.
  if (p.pieMonto && p.tasaInteres && p.plazoCredito && p.modalidad) p.financiamientoPrecargado = true;
  return p;
}

const vacio = (v: unknown) => v === undefined || v === null || v === "";

/** El parche que se aplica sobre las respuestas actuales: solo claves de la precarga y solo vacías. */
export function aplicarPrecarga(actual: WizardV4Answers, precarga: Precarga): Precarga {
  const patch: Precarga = {};
  for (const k of CAMPOS_PRECARGA) {
    const v = precarga[k];
    if (v === undefined) continue;
    if (!vacio(actual[k])) continue;
    (patch as Record<string, unknown>)[k] = v;
  }
  return patch;
}
