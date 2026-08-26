// ─────────────────────────────────────────────────────────────────────────────
// Ficha del depto evaluado — builder puro (FASE 3 rediseño Dictamen).
//
// Contrato: mockup v9 (Franja + G2 Abierta) + decisiones PARÁ 0: la ficha
// muestra LO QUE HAY, no lo que falta — campo sin dato se OMITE (nunca
// "No aplica"; sin fila Subsidio). Cuotas del pie y fecha solo en entrega
// futura. "Capacidad" (huéspedes) no existe como dato hoy → fuera de v1.
// Specs en orden: Modalidad → Estado → Tipología → Superficie → Entrega.
//
// Builder PURO: recibe datos, devuelve estructura; el modal solo renderiza.
// Los montos van pre-formateados acá (estilo mockup: "$271,2 MM", "$980 mil",
// "UF 107,1/m²") y respetan el toggle CLP/UF donde aplica vía `moneda`.
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalisisInput, FullAnalysisResult } from "./types";

export interface FichaDepto {
  /** "El Vergel 2200 · Providencia" (dirección con fallback a comuna). */
  sub: string;
  /** Franja de identidad: pares [micro-etiqueta, valor]. */
  specs: [string, string][];
  /** Grupos G2: título + celdas [etiqueta, valor]. */
  grupos: { titulo: string; celdas: [string, string][] }[];
}

const fmtMilesMM = (clp: number): string => {
  if (!Number.isFinite(clp) || clp <= 0) return "";
  if (clp < 1_000_000) return "$" + Math.round(clp / 1000).toLocaleString("es-CL") + " mil";
  return "$" + (clp / 1_000_000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
};
const fmtUFn = (uf: number): string => "UF " + (Math.round(uf * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtUFm2 = (uf: number): string => fmtUFn(uf) + "/m²";
const pctCL = (n: number, dec = 1): string => n.toLocaleString("es-CL", { maximumFractionDigits: dec }) + "%";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function entregaLabel(estadoVenta: string | undefined, fechaEntrega: string | undefined): string | null {
  if (estadoVenta !== "futura") return "Inmediata";
  if (!fechaEntrega) return null;
  const [a, m] = fechaEntrega.split("-").map(Number);
  if (!a || !m) return null;
  const mes = MESES_CORTOS[m - 1] ?? "";
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a}`;
}

/** Monto según el toggle de moneda de la página (mismo criterio que los chips). */
const montoSegunMoneda = (clp: number, ufValue: number, moneda: "CLP" | "UF"): string =>
  moneda === "UF" && ufValue > 0 ? fmtUFn(clp / ufValue) : fmtMilesMM(clp);

export function buildFichaLtr(p: {
  input: AnalisisInput;
  results: FullAnalysisResult | null | undefined;
  /** Mediana comunal UF/m² con universo, si existe (hallazgoSobreprecio). */
  medianaUfM2: number | null;
  universoMediana?: "nuevo" | "usado" | null;
  direccion: string;
  comuna: string;
  ufValue: number;
  moneda: "CLP" | "UF";
}): FichaDepto {
  const { input, ufValue, moneda } = p;
  const precioCLP = input.precio * ufValue;
  const ufM2 = input.superficie > 0 ? input.precio / input.superficie : 0;

  const esNuevo = input.esNuevo ?? (input.enConstruccion || input.estadoVenta === "futura");
  const estado = esNuevo
    ? input.estadoVenta === "futura"
      ? "Nuevo · en verde"
      : "Nuevo"
    : `Usado · ${input.antiguedad}a`;

  const specs: [string, string][] = [
    ["Modalidad", "Renta larga"],
    ["Estado", estado],
    ["Tipología", `${input.dormitorios}D · ${input.banos}B`],
    ["Superficie", `${input.superficie} m²`],
  ];
  const entrega = entregaLabel(input.estadoVenta, input.fechaEntrega);
  if (entrega) specs.push(["Entrega", entrega]);

  const precioRenta: [string, string][] = [
    ["Precio de venta", montoSegunMoneda(precioCLP, ufValue, moneda)],
    ["Precio unitario", fmtUFm2(ufM2)],
  ];
  if (p.medianaUfM2 != null && p.medianaUfM2 > 0) {
    const etiqueta = p.universoMediana ? `Mediana comuna (${p.universoMediana}s)` : "Mediana de la comuna";
    precioRenta.push([etiqueta, fmtUFm2(p.medianaUfM2)]);
  }
  if (input.arriendo > 0) precioRenta.push(["Arriendo estimado", `${montoSegunMoneda(input.arriendo, ufValue, moneda)}/mes`]);
  if (input.gastos > 0) precioRenta.push(["Gastos comunes", `${montoSegunMoneda(input.gastos, ufValue, moneda)}/mes`]);

  const fin: [string, string][] = [
    ["Pie", `${input.piePct}% · ${montoSegunMoneda(precioCLP * (input.piePct / 100), ufValue, moneda)}`],
  ];
  if (input.estadoVenta === "futura" && input.cuotasPie > 0 && input.montoCuota > 0) {
    fin.push(["Cuotas del pie", `${input.cuotasPie} × ${fmtMilesMM(input.montoCuota)}`]);
  }
  fin.push(["Tasa", pctCL(input.tasaInteres, 2)], ["Plazo", `${input.plazoCredito} años`]);

  return {
    sub: p.direccion ? `${p.direccion} · ${p.comuna}` : p.comuna,
    specs,
    grupos: [
      { titulo: "Precio & renta", celdas: precioRenta },
      { titulo: "Financiamiento", celdas: fin },
    ],
  };
}

export function buildFichaStr(p: {
  /** input_data STR (Record — el payload STR no comparte el shape LTR). */
  input: Record<string, unknown> | null | undefined;
  /** ADR ajustado (tarifa/noche CLP) y ocupación de referencia [0..1] del motor. */
  adrNoche: number | null;
  ocupacionZona: number | null;
  direccion: string;
  comuna: string;
  moneda: "CLP" | "UF";
}): FichaDepto {
  const inp = p.input ?? {};
  const num = (k: string): number => (typeof inp[k] === "number" && Number.isFinite(inp[k] as number) ? (inp[k] as number) : 0);
  const precioCLP = num("precioCompra");
  const precioUF = num("precioCompraUF");
  const ufValue = precioUF > 0 ? precioCLP / precioUF : 0;
  const superficie = num("superficieUtil") || num("superficie");
  const ufM2 = superficie > 0 && precioUF > 0 ? precioUF / superficie : 0;
  const antiguedad = num("antiguedad");
  const esNuevo = inp["tipoPropiedad"] === "nuevo";

  const specs: [string, string][] = [
    ["Modalidad", "Renta corta"],
    ["Estado", esNuevo ? "Nuevo" : `Usado · ${antiguedad}a`],
  ];
  const dorm = num("dormitorios");
  const banos = num("banos");
  if (dorm > 0 || banos > 0) specs.push(["Tipología", `${dorm}D · ${banos}B`]);
  if (superficie > 0) specs.push(["Superficie", `${superficie} m²`]);
  // "Capacidad" (huéspedes) y "Entrega": sin dato en el payload STR de hoy → se
  // omiten (STR no viaja con estadoVenta — memoria str-preentrega-asimetria).

  const precioTarifa: [string, string][] = [];
  if (precioCLP > 0) precioTarifa.push(["Precio de venta", montoSegunMoneda(precioCLP, ufValue || 1, ufValue > 0 ? p.moneda : "CLP")]);
  if (ufM2 > 0) precioTarifa.push(["Precio unitario", fmtUFm2(ufM2)]);
  const amoblamiento = num("costoAmoblamiento");
  if (amoblamiento > 0) precioTarifa.push(["Puesta a punto", fmtMilesMM(amoblamiento)]);
  if (p.adrNoche != null && p.adrNoche > 0) precioTarifa.push(["Tarifa por noche", fmtMilesMM(p.adrNoche)]);
  if (p.ocupacionZona != null && p.ocupacionZona > 0) precioTarifa.push(["Ocupación de la zona", pctCL(p.ocupacionZona * 100, 0)]);
  const modo = inp["modoGestion"];
  if (modo === "auto" || modo === "administrador") {
    const comision = typeof inp["comisionAdministrador"] === "number" ? (inp["comisionAdministrador"] as number) : null;
    precioTarifa.push([
      "Operación",
      modo === "auto" ? "Autogestión" : `Admin${comision != null ? ` · ${Math.round(comision * 100)}%` : ""}`,
    ]);
  }

  const piePct = num("piePct");
  const fin: [string, string][] = [];
  if (piePct > 0 && precioCLP > 0) fin.push(["Pie", `${piePct}% · ${fmtMilesMM(precioCLP * (piePct / 100))}`]);
  else if (piePct === 0 && precioCLP > 0) fin.push(["Pie", "0% — financiamiento 100%"]);
  const tasa = num("tasaInteres") || num("tasaCredito");
  if (tasa > 0) fin.push(["Tasa", pctCL(tasa, 2)]);
  const plazo = num("plazoCredito") || num("plazoAnios");
  if (plazo > 0) fin.push(["Plazo", `${plazo} años`]);

  return {
    sub: p.direccion ? `${p.direccion} · ${p.comuna}` : p.comuna,
    specs,
    grupos: [
      { titulo: "Precio & tarifa", celdas: precioTarifa },
      ...(fin.length ? [{ titulo: "Financiamiento", celdas: fin }] : []),
    ],
  };
}
