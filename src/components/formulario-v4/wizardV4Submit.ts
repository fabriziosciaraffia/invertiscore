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

import { buildLtrPayload, buildStrPayload, type SubmitContext } from "./wizardV4Payload";
import { parseNumeroCL, type Decimales } from "@/lib/numero-cl";
import type { Anomalia, PlausibilidadInput } from "@/lib/plausibilidad";
import { DEC, type WizardV4Answers } from "./wizardV4Nodes";
import { pieEfectivoPct } from "./derive";

// El armado del payload LTR (y sus helpers) vive en wizardV4Payload.ts, sin "use client", para que el
// servidor lo use igual; se reexporta acá para los que ya lo importaban de este archivo.
export { buildLtrPayload, buildStrPayload, datosDfl2, type SubmitContext } from "./wizardV4Payload";

// El pie % del payload es `pieEfectivoPct` (derive.ts): el escrito, redondeado a la precisión
// canónica (fix pie-redondeo: sin eso el % derivado de $ o UF viajaba con el float crudo), o el
// monto de «otra fuente» cuando el pie es 0 y lo cubre otra fuente. Hasta el 27-sep-2026 era una
// copia local de `piePct`; con «otra fuente» las dos habrían divergido.

// ── STR ───────────────────────────────────────────────────────────────────────

// buildStrPayload vive en wizardV4Payload.ts desde el 14-oct-2026 (lo usa también el servidor: el semanal de renta corta).

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
  // NaN y no 0: es lo que activa el fail-open del guard. Un texto ILEGIBLE
  // también cae en NaN — antes devolvía un número plausible y equivocado, que
  // podía disparar una anomalía falsa sobre un dato que ni siquiera se entendió.
  const soloSiHay = (v: string | undefined, decimales: Decimales): number =>
    v ? parseNumeroCL(v, decimales) ?? NaN : NaN;

  const corregidoStr = a.adrModo === "corregir";
  const ocupacion = corregidoStr ? soloSiHay(a.adrOcupacion, DEC.ocupacion) : NaN;
  const tarifa = corregidoStr ? soloSiHay(a.adrTarifa, DEC.tarifa) : NaN;

  return {
    precioUF: soloSiHay(a.precio, DEC.precioUF),
    superficieM2: soloSiHay(a.superficieUtil, DEC.superficie),
    ufCLP,
    tasaAnualPct: soloSiHay(a.tasaInteres, DEC.tasa),
    arriendoMensualCLP: soloSiHay(a.arriendo, DEC.arriendo),
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

/**
 * Guard del cero silencioso (fix pie-cero): no se arma ni se postea un payload
 * con `piePct: 0` sin `razonSinPie`. El wizard ya lo bloquea en PieScreen y en
 * el resumen, y el server lo rechaza con 422 (regla `pie_cero_sin_razon` de
 * plausibilidad) — este es el borde intermedio, para que ningún camino de
 * submit futuro lo salte. Vive FUERA de los builders a propósito: el dry-run y
 * el pre-chequeo de plausibilidad también los llaman con estados transitorios
 * legítimos (pie recién vaciado, razón aún sin elegir) y no deben reventar.
 *
 * Devuelve el SubmitResult de error, o null si el pie está declarado.
 */
function guardPieDeclarado(a: WizardV4Answers, ctx: SubmitContext): SubmitResult | null {
  const montoVacio = (a.pieMonto ?? "").trim() === "";
  const pct = pieEfectivoPct(a, ctx.ufCLP);
  if (montoVacio || (pct === 0 && !a.pieRazon)) {
    return {
      ok: false,
      error: "Falta el pie: escribe el monto en el paso de financiamiento — y si va en $0, elige cómo se cubre.",
    };
  }
  return null;
}

/** Genera el análisis con crédito (contratos v3). Devuelve el redirect destino. */
export async function submitConCredito(a: WizardV4Answers, ctx: SubmitContext): Promise<SubmitResult> {
  const mod = a.modalidad;
  const sinPie = guardPieDeclarado(a, ctx);
  if (sinPie) return sinPie;
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

/**
 * Cap anónimo (F2-2): genera el análisis SIN sesión contra las mismas rutas del
 * flujo con crédito — el server resuelve el actor por ausencia de sesión, valida
 * cap/IP/Turnstile y emite la cookie `franco_anon` con el response.
 *
 * AMBAS va SERIALIZADO a propósito (decisión F2-1 #4): el POST LTR emite la
 * cookie y el POST STR viaja después CON ella — el server la reconoce como
 * hermano del par por el ambasGroupId. El Promise.allSettled del flujo con
 * crédito queda intacto; los 2-3 s extra son una vez en la vida del anónimo.
 */
export async function submitAnonimo(
  a: WizardV4Answers,
  ctx: SubmitContext,
  turnstileToken: string | null,
): Promise<SubmitResult> {
  const mod = a.modalidad;
  const sinPie = guardPieDeclarado(a, ctx);
  if (sinPie) return sinPie;
  const extra = turnstileToken ? { turnstileToken } : {};
  try {
    if (mod === "ltr") {
      const { id } = await postJson("/api/analisis", { ...buildLtrPayload(a, ctx), ...extra });
      return { ok: true, redirect: `/analisis/${id}` };
    }
    if (mod === "str") {
      const { id } = await postJson("/api/analisis/short-term", { ...buildStrPayload(a, ctx), ...extra });
      return { ok: true, redirect: `/analisis/renta-corta/${id}` };
    }
    // AMBAS serializado. Si el STR falla con el LTR ya creado, se degrada al
    // LTR suelto con la misma marca de parcial que usa el flujo con crédito.
    const ambasGroupId = crypto.randomUUID();
    const { id: ltrId } = await postJson("/api/analisis", {
      ...buildLtrPayload(a, ctx),
      ...extra,
      ambasGroupId,
    });
    try {
      const { id: strId } = await postJson("/api/analisis/short-term", {
        ...buildStrPayload(a, ctx),
        ambasGroupId,
      });
      return { ok: true, redirect: `/analisis/comparativa?ltr=${ltrId}&str=${strId}` };
    } catch {
      try { sessionStorage.setItem("franco_both_partial", JSON.stringify({ ok: "ltr", failed: "str" })); } catch { /* ignore */ }
      return { ok: true, redirect: `/analisis/${ltrId}` };
    }
  } catch (err) {
    // Ids de máquina del server anónimo → mensaje legible. El 403 del cap
    // llega si la señal de UX (anonCapAvailable) quedó stale — p. ej. dos
    // pestañas: una generó y la otra tenía el resumen abierto de antes.
    const crudo = err instanceof Error ? err.message : "Error inesperado";
    const error = crudo === "cap_anonimo_consumido"
      ? "Tu análisis gratis ya lo usaste. Crea tu cuenta para seguir."
      : crudo;
    return {
      ok: false,
      error,
      anomalias: err instanceof ApiError ? err.anomalias : undefined,
    };
  }
}

/** Compra pre-pago (logueado sin créditos): crea fila(s) locked y va a checkout. */
export async function comprarLocked(a: WizardV4Answers, ctx: SubmitContext): Promise<SubmitResult> {
  const mod = a.modalidad;
  const sinPie = guardPieDeclarado(a, ctx);
  if (sinPie) return sinPie;
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
