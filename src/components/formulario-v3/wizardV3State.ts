// State shape and helpers shared across wizard-v3 components.
// Flat object kept in the root page.tsx; passed down via props.

export type Modalidad = "ltr" | "str" | "both" | null;

export interface WizardV3State {
  // Paso 1 — visibles
  direccion: string;
  lat: number | null;
  lng: number | null;
  comuna: string;
  ciudad: string;
  tipoPropiedad: "usado" | "nuevo";
  superficieUtil: string;

  // Paso 1 — modal Detalles
  dormitorios: string;
  /** Studio: trata al depto como 1D para comparables pero se etiqueta "Studio" en UI. */
  esStudio?: boolean;
  banos: string;
  estacionamientos: string;
  bodegas: string;
  arriendoEstac: string;
  arriendoBodega: string;
  antiguedad: "0-2" | "3-5" | "6-10" | "11-20" | "20+";

  // Paso 1 — condicional (solo tipo=nuevo)
  estadoVenta: "inmediata" | "futura";
  fechaEntregaMes: string;
  fechaEntregaAnio: string;

  // Paso 2 — visibles
  precio: string;                    // valor en UF (string por control de input)
  piePct: string;                    // % — auto-derivado en Nuevo cuando user edita cuota mensual
  pieModoPago: "contado" | "cuotas"; // solo nuevo+inmediata
  cuotasPie: string;                 // cuando cuotas o futura
  montoCuotaPieUF: string;           // input controlado en Nuevo (UF/cuota); vacío = derivar de piePct

  // Paso 2 — ocultos con default
  plazoCredito: string;
  tasaInteres: string;

  // Paso 3
  modalidad: Modalidad;
  arriendo: string;                  // CLP
  gastos: string;                    // CLP
  contribuciones: string;            // CLP (trimestral)
  vacanciaPct: string;
  adminPct: string;

  // Tracking + metadata
  editedFields: string[];            // claves ajustadas manualmente en modal
  sampleSize: number;                // del último fetch de suggestions
  radiusUsed: number | null;
}

export const DEFAULT_STATE: WizardV3State = {
  direccion: "",
  lat: null,
  lng: null,
  comuna: "",
  ciudad: "",
  tipoPropiedad: "usado",
  superficieUtil: "",
  dormitorios: "2",
  esStudio: false,
  banos: "1",
  estacionamientos: "0",
  bodegas: "0",
  arriendoEstac: "",
  arriendoBodega: "",
  antiguedad: "3-5",
  estadoVenta: "inmediata",
  fechaEntregaMes: "",
  fechaEntregaAnio: "",
  precio: "",
  piePct: "20",
  pieModoPago: "contado",
  cuotasPie: "",
  montoCuotaPieUF: "",
  plazoCredito: "25",
  tasaInteres: "4.72",
  modalidad: null,
  arriendo: "",
  gastos: "",
  contribuciones: "",
  vacanciaPct: "5",
  adminPct: "0",
  editedFields: [],
  sampleSize: 0,
  radiusUsed: null,
};

// ─── Helpers ──────────────────────────────────────────
export function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Para decimales SIN thousands separator (tasa %, pie %).
//  Para CLP/UF con thousands, usar parseNum. parseNum borra todos
//  los puntos asumiendo formato chileno, lo cual rompe valores
//  como '4.72'.
export function parseDecimalLocale(s: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fmtUF(n: number, decimals = 0): string {
  const rounded = decimals > 0
    ? Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
    : Math.round(n);
  return "UF " + rounded.toLocaleString("es-CL");
}

export function fmtCLPShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (abs >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function antiguedadToNumber(val: string): number {
  switch (val) {
    case "0-2": return 1;
    case "3-5": return 4;
    case "6-10": return 8;
    case "11-20": return 15;
    case "20+": return 25;
    default: return 5;
  }
}

export function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

export function mesesHastaEntrega(mes: string, anio: string): number {
  if (!mes || !anio) return 0;
  const now = new Date();
  const entrega = new Date(Number(anio), Number(mes) - 1);
  return Math.max(1, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

/** Preview corto para la card "Entrega del proyecto" cuando tipo = Nuevo. */
export function previewEntrega(s: WizardV3State): string {
  if (s.estadoVenta !== "futura") return "Inmediata";
  if (!s.fechaEntregaMes || !s.fechaEntregaAnio) return "Futura · fecha pendiente";
  const mesAbbr = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ][Number(s.fechaEntregaMes) - 1] || "";
  const meses = mesesHastaEntrega(s.fechaEntregaMes, s.fechaEntregaAnio);
  const cuotasLabel = meses > 0 ? ` · ${meses} cuotas` : "";
  return `Futura · ${mesAbbr} ${s.fechaEntregaAnio}${cuotasLabel}`;
}

export function previewDetalles(s: WizardV3State): string {
  const parts: string[] = [];
  const dormPart = s.esStudio
    ? "Studio"
    : `${s.dormitorios || "—"} dorm`;
  const b = s.banos || "—";
  parts.push(`${dormPart} · ${b} baño${b === "1" ? "" : "s"}`);
  const e = Number(s.estacionamientos) || 0;
  parts.push(e > 0 ? `${e} estac` : "sin estac");
  const bo = Number(s.bodegas) || 0;
  parts.push(bo > 0 ? `${bo} bodega${bo > 1 ? "s" : ""}` : "sin bodega");
  if (s.tipoPropiedad === "usado") {
    parts.push(`${s.antiguedad} años`);
  }
  return parts.join(" · ");
}
