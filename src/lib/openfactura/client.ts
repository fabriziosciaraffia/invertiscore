/**
 * Cliente OpenFactura/Haulmer + emisión de boleta electrónica (TipoDTE 39).
 *
 * Pieza AISLADA y testeable: NO está cableada a ningún webhook todavía. El
 * wiring (disparar la emisión cuando Flow confirma el pago) va en un bloque
 * posterior, sobre payments/confirm y subscriptions/payment-callback.
 *
 * Server-only: documentos_tributarios tiene RLS sin policy de INSERT/UPDATE para
 * usuarios, así que SIEMPRE escribe con el cliente service-role (mismo patrón
 * inline del resto del proyecto; no existe un helper service-role compartido).
 *
 * Modelo de monto: el precio cobrado por Flow es IVA INCLUIDO (single $9.990 =
 * MntTotal). El neto se calcula hacia atrás: neto = round(total / 1.19),
 * IVA = total - neto. Así la boleta cuadra MntNeto + IVA = MntTotal.
 */

import { createClient } from "@supabase/supabase-js";
import { EMISOR } from "./emisor";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AmbienteOF = "dev" | "prod";

/** Ambiente OpenFactura desde env. Default dev (CAF simulado). */
export function getEnv(): AmbienteOF {
  return process.env.OPENFACTURA_ENV === "prod" ? "prod" : "dev";
}

/** Host de la API según el ambiente. dev usa CAF simulado (no válido ante SII). */
export function getBaseUrl(): string {
  return getEnv() === "prod"
    ? "https://api.haulmer.com"
    : "https://dev-api.haulmer.com";
}

/** Subconjunto de la fila `payments` necesario para emitir el DTE. */
export type PaymentForDTE = {
  id: string;
  user_id: string;
  product: string;
  amount: number;
  commerce_order: string;
  /** Nro de orden de Flow (BIGINT). Se usa como documentReference.ID; null en
   * pagos sin flowOrder → cae al hash determinístico del commerce_order. */
  flow_order?: number | null;
};

export type EmitirResult = {
  ok: boolean;
  folio?: number | string;
  documentoId: string;
  error?: string;
  /** true si el kill-switch (OPENFACTURA_ENABLED) cortó la emisión (no-op). */
  skipped?: boolean;
};

const TIPO_DTE_BOLETA_AFECTA = 39;

// IndServicio = 3 → "Boletas de ventas y servicios" (giro de servicio). Requerido
// por el SII en boletas electrónicas.
const IND_SERVICIO_VENTAS_Y_SERVICIOS = 3;

// Receptor para consumidor final sin RUT: convención SII "66666666-6".
const RECEPTOR_CONSUMIDOR_FINAL = {
  RUTRecep: "66666666-6",
  RznSocRecep: "Consumidor Final",
};

/**
 * MedioPago: campo agregado por OpenFactura para boletas el 10/02/2026. La doc
 * oficial (docsapi-openfactura.haulmer.com) es JS-rendered y no se pudo extraer
 * el set exacto de valores aceptados. Se deja OPCIONAL: por defecto NO se envía
 * (no rompe la emisión). Antes de prod: confirmar valores válidos en la doc y
 * pasar `medioPago` a buildDocumentoDTE. Pago de Franco siempre vía Flow (tarjeta).
 */

/**
 * Glosa del ítem (NmbItem). SII limita NmbItem a 80 chars → se trunca. Solo
 * caracteres Latin-1: tildes y ñ están OK, pero NO em-dash, comillas tipográficas
 * ni otros símbolos fuera del set (la API los "corrige" y emite un WARNING). Por
 * eso el separador es guion simple "-", no "—".
 */
export function glosaForProduct(product: string): string {
  if (product === "single") {
    return "Análisis de inversión inmobiliaria - refranco.ai";
  }
  const m = product.match(/^(plan10|plan50|unlimited)_(mensual|annual)$/);
  if (m) {
    const nombre =
      m[1] === "plan10" ? "Plan 10" : m[1] === "plan50" ? "Plan 50" : "Plan Ilimitado";
    const periodo = m[2] === "annual" ? "anual" : "mensual";
    return `${nombre} refranco.ai - suscripción ${periodo}`;
  }
  // Legacy (pro/pack3) o key desconocida → glosa genérica.
  return "Servicio refranco.ai";
}

/**
 * Entero determinístico y estable para documentReference.ID del autoservicio
 * (el esquema exige un número, OF-16). Hash simple del commerce_order acotado a
 * < 1e9 (entero seguro). No es reversible; solo único-y-estable por orden.
 */
function referenceNumber(commerceOrder: string): number {
  let h = 0;
  for (let i = 0; i < commerceOrder.length; i++) {
    h = (h * 31 + commerceOrder.charCodeAt(i)) % 1_000_000_000;
  }
  return h || 1; // nunca 0
}

/** neto = round(total / 1.19); iva = total - neto (total = bruto IVA incluido). */
export function calcularMontos(total: number): {
  neto: number;
  iva: number;
  total: number;
} {
  const neto = Math.round(total / 1.19);
  const iva = total - neto;
  return { neto, iva, total };
}

/**
 * Arma el body de POST /v2/dte/document en modo AUTOSERVICIO. OpenFactura emite
 * la boleta, envía el correo al cliente (customer.email) y le permite convertir
 * a factura (gatilla NC automática). Pura (sin I/O) → reutilizable y testeable.
 * Los montos van IVA incluido: el Detalle lleva el bruto (PrcItem/MontoItem =
 * total) y Totales desglosa neto+IVA.
 */
export function buildDocumentoDTE(opts: {
  product: string;
  amount: number;
  userEmail: string;
  fecha: string; // YYYY-MM-DD
  commerceOrder: string; // fallback para documentReference.ID si no hay flowOrder
  flowOrder?: number | null; // documentReference.ID preferido (nro de orden Flow)
  medioPago?: number | string;
  /**
   * Override del bloque Emisor. Default = EMISOR (Yape, prod). Solo se inyecta
   * en pruebas contra dev-api, donde el contribuyente debe coincidir con el
   * dueño de la apikey demo. En prod nunca se pasa → usa Yape.
   */
  emisor?: Record<string, string | number>;
}) {
  const { neto, iva, total } = calcularMontos(opts.amount);
  const idDoc: Record<string, number | string> = {
    TipoDTE: TIPO_DTE_BOLETA_AFECTA,
    FchEmis: opts.fecha,
    IndServicio: IND_SERVICIO_VENTAS_Y_SERVICIOS,
  };
  if (opts.medioPago !== undefined) idDoc.MedioPago = opts.medioPago;

  // El esquema de boleta de OpenFactura usa RznSocEmisor/GiroEmisor (no los
  // nombres SII RznSoc/GiroEmis del constante). Mapeamos aquí para no acoplar
  // emisor.ts al wire. La boleta NO lleva Acteco en el Emisor (validado contra
  // dev-api: OF-08 lo lista fuera de los campos esperados).
  const e = (opts.emisor ?? EMISOR) as Record<string, string | number>;
  const emisorBody = {
    RUTEmisor: e.RUTEmisor,
    RznSocEmisor: e.RznSoc,
    GiroEmisor: e.GiroEmis,
    CdgSIISucur: e.CdgSIISucur,
    DirOrigen: e.DirOrigen,
    CmnaOrigen: e.CmnaOrigen,
  };

  return {
    response: ["FOLIO", "PDF", "XML", "SELF_SERVICE"],
    dte: {
      Encabezado: {
        IdDoc: idDoc,
        Emisor: emisorBody,
        // Consumidor final limpio (sin CorreoRecep): el correo de la boleta lo
        // envía Franco vía Resend (sendBoletaEmail), no Haulmer. El email del
        // comprador va en customer.email para el autoservicio.
        Receptor: { ...RECEPTOR_CONSUMIDOR_FINAL },
        // Boleta afecta: Totales = MntNeto + IVA + MntTotal (sin TasaIVA, que el
        // esquema de boleta rechaza — validado contra dev-api).
        Totales: {
          MntNeto: neto,
          IVA: iva,
          MntTotal: total,
        },
      },
      Detalle: [
        {
          NroLinDet: 1,
          NmbItem: glosaForProduct(opts.product).slice(0, 80),
          QtyItem: 1,
          PrcItem: total,
          MontoItem: total,
        },
      ],
    },
    // Cliente al que OpenFactura le envía el correo con el documento.
    customer: {
      // TODO(facturación): pasar el nombre real del comprador cuando esté disponible.
      fullName: "Cliente refranco.ai",
      email: opts.userEmail,
    },
    // Autoservicio: emite la boleta + permite al cliente convertirla a factura.
    // documentReference es REQUERIDO (OF-17), es un ARRAY, y su ID debe ser
    // NUMÉRICO (OF-16). Franco no tiene nro de orden numérico (commerce_order es
    // `franco-<uuid>`), así que derivamos un entero determinístico y estable por
    // orden (ver referenceNumber). TODO(facturación): reemplazar por un nro de
    // orden real legible cuando exista.
    selfService: {
      issueBoleta: true,
      allowFactura: true,
      documentReference: [
        {
          type: "801",
          // Preferimos el flowOrder real de Flow; si es null, hash determinístico.
          ID: opts.flowOrder ?? referenceNumber(opts.commerceOrder),
          date: opts.fecha,
        },
      ],
    },
  };
}

/**
 * Emite la boleta electrónica de un pago confirmado. NUNCA lanza: ante cualquier
 * error (API o excepción) deja la fila en estado 'error' y retorna { ok:false }.
 *
 * Idempotencia en dos capas:
 *  1) DB: si ya existe un documento VIVO (pendiente|emitido) para el payment_id,
 *     se retorna ese sin re-emitir.
 *  2) OpenFactura: header Idempotency-Key = payment.commerce_order.
 */
export async function emitirBoletaDTE({
  payment,
  userEmail,
  emisor,
}: {
  payment: PaymentForDTE;
  userEmail: string;
  /**
   * Override del bloque Emisor. Default = EMISOR (Yape, prod). Solo se inyecta
   * en QA contra dev-api, donde el emisor debe ser el dueño de la apikey demo.
   */
  emisor?: Record<string, string | number>;
}): Promise<EmitirResult> {
  // Kill-switch: permite desplegar a prod con el código cableado pero SIN emitir
  // boletas hasta activar la flag. No-op total: no toca la DB ni llama a la API.
  if (process.env.OPENFACTURA_ENABLED !== "true") {
    return { ok: false, skipped: true, documentoId: "" };
  }

  const supabase = createAdminClient();
  const ambiente = getEnv();

  // Idempotencia (1/2): ¿ya hay un documento vivo para este pago?
  const { data: existing } = await supabase
    .from("documentos_tributarios")
    .select("id, folio, estado")
    .eq("payment_id", payment.id)
    .in("estado", ["pendiente", "emitido"])
    .maybeSingle();

  if (existing) {
    return {
      ok: existing.estado === "emitido",
      folio: existing.folio ?? undefined,
      documentoId: existing.id,
    };
  }

  const { neto, iva, total } = calcularMontos(payment.amount);

  // Insertar fila pendiente. Si choca con el índice único parcial (carrera con
  // otra emisión del mismo pago), recuperamos la fila viva y la retornamos.
  const { data: inserted, error: insertErr } = await supabase
    .from("documentos_tributarios")
    .insert({
      payment_id: payment.id,
      user_id: payment.user_id,
      tipo_dte: TIPO_DTE_BOLETA_AFECTA,
      monto_total: total,
      monto_neto: neto,
      monto_iva: iva,
      estado: "pendiente",
      ambiente,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // 23505 = unique_violation → ya hay un documento vivo, recuperarlo.
    if (insertErr?.code === "23505") {
      const { data: vivo } = await supabase
        .from("documentos_tributarios")
        .select("id, folio, estado")
        .eq("payment_id", payment.id)
        .in("estado", ["pendiente", "emitido"])
        .maybeSingle();
      if (vivo) {
        return {
          ok: vivo.estado === "emitido",
          folio: vivo.folio ?? undefined,
          documentoId: vivo.id,
        };
      }
    }
    return {
      ok: false,
      documentoId: "",
      error: insertErr?.message ?? "No se pudo crear el documento pendiente",
    };
  }

  const documentoId = inserted.id;
  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const body = buildDocumentoDTE({
      product: payment.product,
      amount: payment.amount,
      userEmail,
      fecha,
      commerceOrder: payment.commerce_order,
      flowOrder: payment.flow_order ?? null,
      emisor,
    });

    const res = await fetch(`${getBaseUrl()}/v2/dte/document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.OPENFACTURA_API_KEY!,
        // Idempotencia (2/2) del lado OpenFactura.
        "Idempotency-Key": payment.commerce_order,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = { raw };
    }
    const data = (parsed ?? {}) as {
      FOLIO?: number | string;
      TOKEN?: string;
      PDF?: string;
      XML?: string;
      SELF_SERVICE?: { url?: string } | string;
      error?: { message?: string; code?: string };
    };

    // SELF_SERVICE: enlace de autoservicio (ver/convertir a factura). Puede venir
    // como objeto { url } o como string → normalizamos a la URL.
    const autoservicioUrl =
      data.SELF_SERVICE && typeof data.SELF_SERVICE === "object"
        ? data.SELF_SERVICE.url ?? null
        : typeof data.SELF_SERVICE === "string"
        ? data.SELF_SERVICE
        : null;

    // Persistencia liviana (V1): el PDF viene como base64 (~180KB) y NO se guarda.
    // Conservamos el resto (FOLIO, TOKEN, XML, WARNING, RESOLUCION, etc.) en el
    // JSONB. El PDF se reconstruye on-demand con el TOKEN.
    const stripPdf = (o: unknown): unknown => {
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const rest = { ...(o as Record<string, unknown>) };
        delete rest.PDF;
        return rest;
      }
      return o;
    };

    const folio = data.FOLIO;
    if (!res.ok || !folio) {
      const error =
        data.error?.message ?? `OpenFactura respondió ${res.status} sin FOLIO`;
      await supabase
        .from("documentos_tributarios")
        .update({
          estado: "error",
          error_mensaje: error,
          openfactura_response: stripPdf(parsed),
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentoId);
      return { ok: false, documentoId, error };
    }

    // pdf_url/xml_url quedan NULL en V1 (aún no hay Storage). El TOKEN permite
    // reconstruir el PDF cuando se monte. El XML queda dentro del JSONB.
    await supabase
      .from("documentos_tributarios")
      .update({
        estado: "emitido",
        folio,
        token: data.TOKEN ?? null,
        pdf_url: null,
        xml_url: null,
        autoservicio_url: autoservicioUrl,
        openfactura_response: stripPdf(parsed),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentoId);

    return { ok: true, folio, documentoId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error de red OpenFactura";
    await supabase
      .from("documentos_tributarios")
      .update({
        estado: "error",
        error_mensaje: error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentoId);
    return { ok: false, documentoId, error };
  }
}
