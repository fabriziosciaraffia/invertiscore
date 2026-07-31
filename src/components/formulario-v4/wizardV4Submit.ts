"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Submit por modalidad (contratos idénticos a v3)
//
// Builders LTR/STR que producen EXACTAMENTE el mismo payload que v3 (mismos
// endpoints, mismo shape) desde el estado v4, y la orquestación por modalidad:
//   ltr  → POST /api/analisis                 → /analisis/{id}
//   str  → POST /api/analisis/short-term      → /analisis/renta-corta/{id}
//   both → pre-carga POST /api/credits/charge {intent:"both"} + ambasGroupId,
//          Promise.allSettled(postLTR, postSTR) → /analisis/comparativa?ltr&str
//
// Los supuestos diferidos usan `answers[campo] ?? default` (getCostosDefault /
// getGgccFallback / estimarContribuciones) — mismo default que ven en el plegado.
// ─────────────────────────────────────────────────────────────────────────────

import {
  antiguedadToNumber,
  mesesHastaEntrega,
  parseDecimalLocale,
  parseNum,
} from "@/components/formulario-v3/wizardV3State";
import { getMantencionRate } from "@/lib/analysis";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { estimarContribuciones } from "@/lib/contribuciones";
import type { Anomalia, PlausibilidadInput } from "@/lib/plausibilidad";
import type { WizardV4Answers } from "./wizardV4Nodes";

export interface SubmitContext {
  ufCLP: number;
  /** Tasa hipotecaria de mercado vigente (%, ej. 4,72). Alimenta subsidioTasa en
   *  el motor (tasa con subsidio = mercado − 0,6pp y el gate `aplicado`). */
  tasaMercado: number;
  /** Arriendo mediana de la zona (fallback para zonaRadio). */
  arriendoSugerido: number | null;
  arriendoN: number;
  precioM2UF: number | null;
  radiusUsed: number | null;
  ggccSugerido: number | null;
}

const intSafe = (v: string | undefined, fallback: number): number => {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** GGCC efectivo (editado → sugerido → fallback comuna). */
function ggccCLP(a: WizardV4Answers, ctx: SubmitContext, sup: number): number {
  if (a.gastosComunes) return parseNum(a.gastosComunes);
  return ctx.ggccSugerido ?? getGgccFallback(a.comuna ?? "", sup) ?? 0;
}

/** Contribuciones trimestrales efectivas (editado → fórmula SII). */
function contribCLP(a: WizardV4Answers, precioCLP: number): number {
  if (a.contribuciones) return parseNum(a.contribuciones);
  return estimarContribuciones(precioCLP, a.tipoPropiedad === "nuevo");
}

// ── LTR ───────────────────────────────────────────────────────────────────────

export function buildLtrPayload(a: WizardV4Answers, ctx: SubmitContext) {
  const supUtil = parseDecimalLocale(a.superficieUtil ?? "");
  const precioUF = parseNum(a.precio ?? "");
  const nEstac = intSafe(a.estacionamientos, 0);
  const nBodega = intSafe(a.bodegas, 0);
  const antigNum = a.tipoPropiedad === "usado" ? antiguedadToNumber(a.antiguedad ?? "") : 0;
  const esFutura = a.tipoPropiedad === "nuevo" && a.estadoVenta === "futura";
  const cuotasPie = esFutura
    ? mesesHastaEntrega(a.fechaEntregaMes ?? "", a.fechaEntregaAnio ?? "")
    : a.tipoPropiedad === "nuevo" ? 1 : 0;
  const piePct = derivePiePctLocal(a, ctx.ufCLP);
  const pieUF = precioUF * (piePct / 100);
  const dorm = a.esStudio ? 0 : intSafe(a.dormitorios, 2);
  const nombre = `Depto ${a.esStudio ? "studio" : dorm + "D"}${a.banos || "1"}B ${a.comuna ?? ""}`.trim();

  return {
    nombre,
    comuna: a.comuna,
    ciudad: a.ciudad || "Santiago",
    direccion: a.direccionConfirmada || a.direccion || undefined,
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
    valorMercadoUsuario: undefined,
    piePct,
    plazoCredito: Number(a.plazoCredito) || 25,
    tasaInteres: parseDecimalLocale(a.tasaInteres ?? "") || 4.72,
    tasaMercado: ctx.tasaMercado,
    esNuevo: a.tipoPropiedad === "nuevo",
    gastos: ggccCLP(a, ctx, supUtil),
    contribuciones: contribCLP(a, Math.round(precioUF * ctx.ufCLP)),
    provisionMantencion: Math.round((precioUF * ctx.ufCLP * getMantencionRate(antigNum)) / 12),
    tipoRenta: "larga",
    arriendo: parseNum(a.arriendo ?? "") || ctx.arriendoSugerido || 0,
    arriendoEstacionamiento: 0,
    arriendoBodega: 0,
    vacanciaMeses: (Number(a.vacanciaPct ?? 5) * 12) / 100,
    usaAdministrador: Number(a.comisionAdminPct ?? 0) > 0,
    comisionAdministrador: Number(a.comisionAdminPct ?? 0) > 0 ? Number(a.comisionAdminPct) : undefined,
    zonaRadio: {
      precioM2VentaCLP: null,
      arriendoPromedio: ctx.arriendoSugerido,
      arriendoPrecioM2: null,
      sampleSizeArriendo: ctx.arriendoN,
      sampleSizeVenta: 0,
      radioMetros: ctx.radiusUsed ?? 500,
      lat: a.lat,
      lng: a.lng,
    },
  };
}

// Pie % derivado (mismo criterio que derive.ts, inline para no crear ciclo).
function derivePiePctLocal(a: WizardV4Answers, ufCLP: number): number {
  const unit = a.pieUnidad ?? "pct";
  const monto = unit === "pct" ? parseDecimalLocale(a.pieMonto ?? "") : parseNum(a.pieMonto ?? "");
  const pUF = parseNum(a.precio ?? "");
  if (monto <= 0) return 0;
  if (unit === "pct") return Math.min(monto, 100);
  if (pUF <= 0 || ufCLP <= 0) return 0;
  const pieEnUF = unit === "uf" ? monto : monto / ufCLP;
  return Math.min((pieEnUF / pUF) * 100, 100);
}

// ── STR ───────────────────────────────────────────────────────────────────────

export function buildStrPayload(a: WizardV4Answers, ctx: SubmitContext) {
  const supUtil = parseDecimalLocale(a.superficieUtil ?? "");
  const precioUF = parseNum(a.precio ?? "");
  const precioCompraCLP = Math.round(precioUF * ctx.ufCLP);
  const antigNum = a.tipoPropiedad === "usado" ? antiguedadToNumber(a.antiguedad ?? "") : 0;
  const dorm = a.esStudio ? 0 : intSafe(a.dormitorios, 2);
  const costos = getCostosDefault(dorm, "basico");
  const corregido = a.adrModo === "corregir";

  return {
    tipoAnalisis: "short-term" as const,
    direccion: a.direccionConfirmada || a.direccion || "",
    comuna: a.comuna,
    ciudad: a.ciudad || "Santiago",
    tipoPropiedad: a.tipoPropiedad,
    antiguedad: antigNum,
    lat: a.lat,
    lng: a.lng,
    dormitorios: dorm,
    banos: intSafe(a.banos, 1),
    superficieUtil: supUtil,
    capacidadHuespedes: Math.max(2, dorm * 2),
    precioCompra: precioCompraCLP,
    precioCompraUF: precioUF,
    piePct: derivePiePctLocal(a, ctx.ufCLP),
    tasaInteres: parseDecimalLocale(a.tasaInteres ?? "") || 4.72,
    tasaMercado: ctx.tasaMercado,
    plazoCredito: Number(a.plazoCredito) || 25,
    modoGestion: a.modoGestion ?? "auto",
    comisionAdministrador:
      a.modoGestion === "administrador" ? parseDecimalLocale(a.comisionStrPct ?? "") / 100 || 0.2 : 0.2,
    edificioPermiteAirbnb: a.edificioPermiteAirbnb ?? "no_seguro",
    tipoEdificio: "residencial_puro",
    adminPro: a.modoGestion === "administrador",
    habilitacion: "basico",
    operadorNombre: null,
    // Overrides solo cuando el usuario corrigió; en estimación el motor deriva de AirROI.
    adrOverride: corregido ? parseNum(a.adrTarifa ?? "") || null : null,
    occOverride: corregido ? parseDecimalLocale(a.adrOcupacion ?? "") / 100 || null : null,
    costoElectricidad: a.costoElectricidad ? parseNum(a.costoElectricidad) : costos.costoElectricidad,
    costoAgua: a.costoAgua ? parseNum(a.costoAgua) : costos.costoAgua,
    costoWifi: a.costoWifi ? parseNum(a.costoWifi) : costos.costoWifi,
    costoInsumos: a.costoInsumos ? parseNum(a.costoInsumos) : costos.costoInsumos,
    gastosComunes: ggccCLP(a, ctx, supUtil),
    mantencion: a.mantencionStr ? parseNum(a.mantencionStr) : costos.mantencion,
    contribuciones: contribCLP(a, precioCompraCLP),
    estaAmoblado: a.estaAmoblado === true,
    costoAmoblamiento: a.costoAmoblamiento ? parseNum(a.costoAmoblamiento) : costos.costoAmoblamiento,
    arriendoLargoMensual: parseNum(a.arriendo ?? "") || ctx.arriendoSugerido || 0,
  };
}

// ── Input PARCIAL para la alerta temprana (PIEZA B2) ─────────────────────────

/**
 * Mapea las respuestas TAL COMO ESTÁN a un PlausibilidadInput, sin rellenar
 * nada. Es lo que hace posible el chequeo por capas: `evaluarPlausibilidad` es
 * fail-open por regla, así que con datos parciales devuelve solo las reglas que
 * tienen con qué. UF/m² se puede evaluar apenas hay precio y superficie —cinco
 * pantallas antes del resumen— y el yield recién cuando existe el arriendo.
 *
 * NO usa buildLtrPayload a propósito: ese builder rellena defaults
 * (`tasaInteres || 4.72`, `arriendo || arriendoSugerido`), y con esos rellenos
 * el yield dispararía en la pantalla del precio contra un arriendo que el
 * usuario todavía no confirmó. Acá campo ausente = NaN = regla que no corre.
 *
 * La rama STR sigue el mismo criterio que `desdeBodyStr`: solo mira tarifa y
 * ocupación cuando el usuario las CORRIGIÓ. Con la estimación de AirROI no hay
 * input humano que juzgar.
 */
export function buildPlausibilidadParcial(a: WizardV4Answers, ufCLP: number): PlausibilidadInput {
  const soloSiHay = (v: string | undefined, parse: (s: string) => number): number =>
    v ? parse(v) : NaN;

  const corregidoStr = a.adrModo === "corregir";
  const ocupacion = corregidoStr ? soloSiHay(a.adrOcupacion, parseDecimalLocale) : NaN;
  const tarifa = corregidoStr ? soloSiHay(a.adrTarifa, parseNum) : NaN;

  return {
    precioUF: soloSiHay(a.precio, parseNum),
    superficieM2: soloSiHay(a.superficieUtil, parseDecimalLocale),
    ufCLP,
    tasaAnualPct: soloSiHay(a.tasaInteres, parseDecimalLocale),
    arriendoMensualCLP: soloSiHay(a.arriendo, parseNum),
    str: {
      tarifaNocheCLP: Number.isNaN(tarifa) ? null : tarifa,
      ocupacionPct: Number.isNaN(ocupacion) ? null : ocupacion,
    },
  };
}

// ── Orquestación ───────────────────────────────────────────────────────────────

export interface SubmitResult {
  ok: boolean;
  redirect?: string;
  /** Id estable del error (ej. `input_implausible`) o texto ya legible. */
  error?: string;
  /**
   * Anomalías del guard de plausibilidad (422). Vienen ORDENADAS por prioridad
   * desde el server — el consumidor muestra la primera. Ausente en el resto de
   * los errores.
   */
  anomalias?: Anomalia[];
}

/**
 * Error de fetch que conserva el payload del server. `Error.message` se aplanaba
 * a `err.error`, o sea el id de máquina (`input_implausible`), y el array de
 * anomalías se perdía acá — la caja roja terminaba mostrando el token crudo.
 */
class ApiError extends Error {
  anomalias?: Anomalia[];
  constructor(message: string, anomalias?: Anomalia[]) {
    super(message);
    this.name = "ApiError";
    this.anomalias = anomalias;
  }
}

/**
 * Lee el body de una respuesta fallida y arma el SubmitResult. Único lugar donde
 * se parsea un error del server: los tres call-sites que hacían `fetch` a mano
 * dejaban caer `anomalias` cada uno por su cuenta (así se perdía el mensaje del
 * guard en el camino locked).
 *
 * Devuelve el ARRAY COMPLETO, no el primer mensaje aplanado: el consumidor de
 * hoy muestra `anomalias[0]` en la caja de error, pero el modal compartido de
 * PIEZA B va a necesitar todas. La propagación es definitiva; lo único que
 * cambia después es dónde se pinta.
 */
async function errorDeRespuesta(res: Response, fallback: string): Promise<SubmitResult> {
  const err = await res.json().catch(() => ({}));
  return {
    ok: false,
    error: err.error || fallback,
    anomalias: Array.isArray(err.anomalias) ? (err.anomalias as Anomalia[]) : undefined,
  };
}

async function postJson(url: string, body: unknown): Promise<{ id: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { error, anomalias } = await errorDeRespuesta(res, "Error al crear el análisis");
    throw new ApiError(error!, anomalias);
  }
  return res.json();
}

/** Genera el análisis con crédito (contratos v3). Devuelve el redirect destino. */
export async function submitConCredito(a: WizardV4Answers, ctx: SubmitContext): Promise<SubmitResult> {
  const mod = a.modalidad;
  try {
    if (mod === "ltr") {
      const { id } = await postJson("/api/analisis", buildLtrPayload(a, ctx));
      return { ok: true, redirect: `/analisis/${id}` };
    }
    if (mod === "str") {
      const { id } = await postJson("/api/analisis/short-term", buildStrPayload(a, ctx));
      return { ok: true, redirect: `/analisis/renta-corta/${id}` };
    }
    // both: pre-carga 1 crédito → ambos POSTs con chargeId + ambasGroupId.
    //
    // Los payloads viajan en el body del pre-cobro para que el guard de
    // plausibilidad corra ANTES de descontar. Sin esto el crédito se descuenta
    // acá y el rechazo llega recién en los POSTs hijos — y no hay rollback en
    // el sistema, así que ese crédito se perdía.
    const chargeRes = await fetch("/api/credits/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "both",
        ltr: buildLtrPayload(a, ctx),
        str: buildStrPayload(a, ctx),
      }),
    });
    if (!chargeRes.ok) {
      return errorDeRespuesta(chargeRes, "No pudimos procesar tu análisis. Intenta de nuevo.");
    }
    const { chargeId } = (await chargeRes.json()) as { chargeId: string };
    const ambasGroupId = crypto.randomUUID();
    const [ltrRes, strRes] = await Promise.allSettled([
      postJson("/api/analisis", { ...buildLtrPayload(a, ctx), prepaidChargeId: chargeId, ambasGroupId }),
      postJson("/api/analisis/short-term", { ...buildStrPayload(a, ctx), prepaidChargeId: chargeId, ambasGroupId }),
    ]);
    const ltrOk = ltrRes.status === "fulfilled";
    const strOk = strRes.status === "fulfilled";
    if (ltrOk && strOk) {
      return { ok: true, redirect: `/analisis/comparativa?ltr=${ltrRes.value.id}&str=${strRes.value.id}` };
    }
    if (ltrOk) {
      try { sessionStorage.setItem("franco_both_partial", JSON.stringify({ ok: "ltr", failed: "str" })); } catch { /* ignore */ }
      return { ok: true, redirect: `/analisis/${ltrRes.value.id}` };
    }
    if (strOk) {
      try { sessionStorage.setItem("franco_both_partial", JSON.stringify({ ok: "str", failed: "ltr" })); } catch { /* ignore */ }
      return { ok: true, redirect: `/analisis/renta-corta/${strRes.value.id}` };
    }
    return { ok: false, error: "No pudimos generar el análisis. Intenta de nuevo." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado",
      anomalias: err instanceof ApiError ? err.anomalias : undefined,
    };
  }
}

/** Compra pre-pago (logueado sin créditos): crea fila(s) locked y va a checkout. */
export async function comprarLocked(a: WizardV4Answers, ctx: SubmitContext): Promise<SubmitResult> {
  const mod = a.modalidad;
  try {
    if (mod === "both") {
      const res = await fetch("/api/analisis/locked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoAnalisis: "both", ltr: buildLtrPayload(a, ctx), str: buildStrPayload(a, ctx) }),
      });
      if (!res.ok) return errorDeRespuesta(res, "No se pudo crear el análisis. Intenta de nuevo.");
      const { ltrId, strId } = (await res.json()) as { ltrId: string; strId: string };
      return { ok: true, redirect: `/checkout?product=single&analysisId=${ltrId}&companionStrId=${strId}` };
    }
    const payload = mod === "str" ? buildStrPayload(a, ctx) : buildLtrPayload(a, ctx);
    const res = await fetch("/api/analisis/locked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return errorDeRespuesta(res, "No se pudo crear el análisis. Intenta de nuevo.");
    const { id } = (await res.json()) as { id: string };
    return { ok: true, redirect: `/checkout?product=single&analysisId=${id}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado",
      anomalias: err instanceof ApiError ? err.anomalias : undefined,
    };
  }
}
