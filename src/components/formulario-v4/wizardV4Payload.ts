// ─────────────────────────────────────────────────────────────────────────────
// El armado del payload LTR del wizard v4, puro y sin "use client" (30-sep-2026). Vivía en
// wizardV4Submit.ts, que es de cliente (manda los POST); de ahí se reexporta sin cambios. Se separó
// para que el servidor —el cron que evalúa los avisos— arme EXACTAMENTE la misma entrada que el
// wizard: importar un módulo "use client" desde un route convierte sus funciones en referencias de
// cliente que no se pueden llamar.
// ─────────────────────────────────────────────────────────────────────────────

import { antiguedadToNumber, mesesHastaEntrega } from "./helpers-wizard";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { estimarContribuciones } from "@/lib/contribuciones";
import { parseNumeroCL } from "@/lib/numero-cl";
import { DEC, type WizardV4Answers } from "./wizardV4Nodes";
import { cuotaCreditoPieCLP, dormitoriosNum, leerNum, otraFuentePctCrudo, pieEfectivoPct, type FuenteArriendo } from "./derive";
import { valorMercadoRefDeSugerencia } from "@/lib/valor-mercado";
import type { MuestraArriendo } from "@/lib/arriendo-referencia";

export interface SubmitContext {
  ufCLP: number;
  /** Tasa hipotecaria de mercado vigente (%, ej. 4,72). Alimenta subsidioTasa en
   *  el motor (tasa con subsidio = mercado − 0,6pp y el gate `aplicado`). */
  tasaMercado: number;
  /** Arriendo mediana de la zona (fallback para zonaRadio). */
  arriendoSugerido: number | null;
  arriendoN: number;
  /** Nivel de la sugerencia. Viaja en zonaRadio.arriendoFuente para que el
   *  informe rotule la referencia por lo que es y no reproche contra un estimado. */
  arriendoFuente: FuenteArriendo;
  /** Solo comuna-m2: rango del estimado, persistido junto a la fuente. */
  arriendoRango: { min: number; max: number } | null;
  /** Solo radio: la muestra detrás de la mediana. Se guarda solo si calza con `arriendoN`. */
  muestraArriendo?: MuestraArriendo | null;
  precioM2UF: number | null;
  radiusUsed: number | null;
  ggccSugerido: number | null;
  /** Procedencia de la sugerencia de venta (Tramo A). */
  ventaN: number;
  ventaFuente: "radio" | "comuna" | "sin-dato";
  ventaUniverso: "nuevo" | "usado" | "mixto" | null;
  ventaRadio: number | null;
}

/**
 * Entero no negativo del wizard (contadores y chips). Lee con `parseNumeroCL`
 * igual que todo lo demás; un texto ilegible cae al fallback en vez de colarse
 * como NaN.
 */
export const intSafe = (v: string | undefined, fallback: number): number => {
  if (!v) return fallback;
  const n = parseNumeroCL(v, 0);
  return n !== null && n >= 0 ? n : fallback;
};

/** GGCC efectivo (editado → sugerido → fallback comuna). */
export function ggccCLP(a: WizardV4Answers, ctx: SubmitContext, sup: number): number {
  if (a.gastosComunes) return leerNum(a.gastosComunes, DEC.gastosComunes);
  return ctx.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
}

/** Datos del DFL2 del depto (29-sep-2026): superficie y años desde la recepción (0 si es nuevo). */
export function datosDfl2(a: WizardV4Answers): { superficieM2: number; aniosDesdeRecepcion: number } {
  return {
    superficieM2: leerNum(a.superficieUtil, DEC.superficie),
    aniosDesdeRecepcion: a.tipoPropiedad === "usado" ? antiguedadToNumber(a.antiguedad ?? "") : 0,
  };
}

/** Contribuciones trimestrales efectivas (editado → fórmula SII, con DFL2). */
export function contribCLP(a: WizardV4Answers, precioCLP: number): number {
  if (a.contribuciones) return leerNum(a.contribuciones, DEC.contribuciones);
  return estimarContribuciones(precioCLP, datosDfl2(a));
}

/** Origen de la contribución: la escribió el usuario o la estimó Franco. */
export function contribOrigen(a: WizardV4Answers): "estimada" | "declarada" {
  return a.contribuciones ? "declarada" : "estimada";
}

// ── LTR ───────────────────────────────────────────────────────────────────────

export function buildLtrPayload(a: WizardV4Answers, ctx: SubmitContext) {
  const supUtil = leerNum(a.superficieUtil, DEC.superficie);
  const precioUF = leerNum(a.precio, DEC.precioUF);
  const nEstac = intSafe(a.estacionamientos, 0);
  const nBodega = intSafe(a.bodegas, 0);
  const antigNum = a.tipoPropiedad === "usado" ? antiguedadToNumber(a.antiguedad ?? "") : 0;
  const esFutura = a.tipoPropiedad === "nuevo" && a.estadoVenta === "futura";
  const cuotasPie = esFutura
    ? mesesHastaEntrega(a.fechaEntregaMes ?? "", a.fechaEntregaAnio ?? "")
    : a.tipoPropiedad === "nuevo" ? 1 : 0;
  const piePct = pieEfectivoPct(a, ctx.ufCLP);
  const pieUF = precioUF * (piePct / 100);
  const dorm = dormitoriosNum(a);
  const comisionAdmin = leerNum(a.comisionAdminPct, DEC.comisionAdmin);
  const nombre = `Depto ${a.esStudio ? "studio" : dorm + "D"}${a.banos || "1"}B ${a.comuna ?? ""}`.trim();

  return {
    nombre,
    comuna: a.comuna,
    ciudad: a.ciudad || "Santiago",
    direccion: a.direccionConfirmada || a.direccion || undefined,
    // Cuán preciso es el punto: "calle" = sin número; "pin" = el usuario lo movió en el mapa.
    ubicacionPrecision: a.ubicacionPrecision,
    tipo: "Departamento",
    dormitorios: dorm,
    esStudio: a.esStudio === true,
    banos: intSafe(a.banos, 1),
    superficie: supUtil,
    superficieTotal: supUtil,
    antiguedad: antigNum,
    incluyeCorretajeInicial: a.tipoPropiedad === "usado",
    enConstruccion: a.tipoPropiedad === "nuevo" && a.estadoVenta !== "inmediata",
    piso: 0,
    estacionamiento: nEstac > 0 ? "si" : "no",
    cantidadEstacionamientos: nEstac,
    precioEstacionamiento: 0,
    bodega: nBodega > 0,
    cantidadBodegas: nBodega,
    estadoVenta: esFutura ? "futura" : "inmediata",
    fechaEntrega: esFutura ? `${a.fechaEntregaAnio}-${a.fechaEntregaMes}` : undefined,
    cuotasPie,
    montoCuota: cuotasPie > 0 ? Math.round((pieUF / cuotasPie) * ctx.ufCLP) : 0,
    precio: precioUF,
    valorMercadoFranco:
      ctx.precioM2UF && supUtil > 0 ? Math.round(ctx.precioM2UF * supUtil) : undefined,
    // Tramo A: el valor de mercado viaja CON su procedencia; el motor solo lee esto.
    valorMercadoRef: valorMercadoRefDeSugerencia({
      precioM2UF: ctx.precioM2UF, superficieUtilM2: supUtil, source: ctx.ventaFuente,
      sampleSize: ctx.ventaN, universoVenta: ctx.ventaUniverso, radiusUsed: ctx.ventaRadio,
    }),
    valorMercadoUsuario: undefined,
    piePct,
    // Fase 5b: el origen del pie 0 viaja al motor (razón de MetricaSobreCapital)
    // y de ahí al prompt. Solo tiene sentido con pie 0 — con pie > 0 el wizard
    // ya la descartó, y este guard lo hace explícito en el borde.
    razonSinPie: piePct === 0 ? a.pieRazon : undefined,
    // «Otra fuente» (27-sep-2026): con su monto, `piePct` ya es ese monto (para el banco es pie);
    // si es un crédito, su cuota entra al flujo del mes. Sin monto, nada de esto viaja.
    ...camposOtraFuente(a, ctx.ufCLP),
    plazoCredito: Number(a.plazoCredito) || 25,
    tasaInteres: leerNum(a.tasaInteres, DEC.tasa) || 4.72,
    tasaMercado: ctx.tasaMercado,
    esNuevo: a.tipoPropiedad === "nuevo",
    gastos: ggccCLP(a, ctx, supUtil),
    contribuciones: contribCLP(a, Math.round(precioUF * ctx.ufCLP)),
    contribucionesOrigen: contribOrigen(a),
    // Provisión de mantención: el wizard NO la calcula. 0 ⇒ el motor la deriva
    // con la fuente única (modelo-costos.ts, gateada por versión). Antes el
    // wizard mandaba el % del precio calculado acá y el motor lo trataba como
    // "declarado por el usuario", congelando la tabla vieja en input_data.
    provisionMantencion: 0,
    tipoRenta: "larga",
    arriendo: leerNum(a.arriendo, DEC.arriendo) || ctx.arriendoSugerido || 0,
    arriendoEstacionamiento: 0,
    arriendoBodega: 0,
    // El body viaja en MESES/año; el usuario la tipea en %. El 5 es el default
    // silencioso del wizard cuando nunca tocó el campo.
    vacanciaMeses: ((a.vacanciaPct ? leerNum(a.vacanciaPct, DEC.vacancia) : 5) * 12) / 100,
    usaAdministrador: comisionAdmin > 0,
    comisionAdministrador: comisionAdmin > 0 ? comisionAdmin : undefined,
    zonaRadio: {
      precioM2VentaCLP: ctx.precioM2UF ? Math.round(ctx.precioM2UF * ctx.ufCLP) : null,
      arriendoPromedio: ctx.arriendoSugerido,
      arriendoPrecioM2: null,
      sampleSizeArriendo: ctx.arriendoN,
      // Fuente y rango de la sugerencia (arriendo-referencia.ts los lee; filas
      // anteriores al campo se leen como radio, que es lo que eran).
      arriendoFuente: ctx.arriendoFuente,
      arriendoRangoMin: ctx.arriendoRango?.min ?? null,
      arriendoRangoMax: ctx.arriendoRango?.max ?? null,
      // La lista de «Ver los comparables» (24-sep-2026): la MISMA muestra de la mediana, o
      // nada. `leerMuestraArriendo` vuelve a exigir que calce con el n al leer.
      muestraArriendo:
        ctx.arriendoFuente === "radio" && ctx.muestraArriendo && ctx.muestraArriendo.avisos.length === ctx.arriendoN
          ? ctx.muestraArriendo
          : undefined,
      sampleSizeVenta: ctx.ventaN,
      ventaFuente: ctx.ventaFuente,
      ventaUniverso: ctx.ventaUniverso,
      ventaRadio: ctx.ventaRadio,
      radioMetros: ctx.radiusUsed ?? 500,
      lat: a.lat,
      lng: a.lng,
    },
  };
}

/** Los campos de «otra fuente» del payload, o ninguno. */
export function camposOtraFuente(a: WizardV4Answers, ufCLP: number): { pieOrigen?: "otra_fuente"; cuotaCreditoPie?: number } {
  if (otraFuentePctCrudo(a, ufCLP) <= 0) return {};
  const cuota = cuotaCreditoPieCLP(a, ufCLP);
  return { pieOrigen: "otra_fuente", ...(cuota > 0 ? { cuotaCreditoPie: cuota } : {}) };
}

