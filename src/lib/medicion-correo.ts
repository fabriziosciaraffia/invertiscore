// Los correos como eventos (28-sep-2026): `correo_enviado` al salir de Resend, y desde el webhook
// de Resend `correo_entregado`, `correo_abierto`, `correo_clic`, `correo_rebotado`, `correo_spam`.
// Cada envío viaja con dos tags a Resend —`tipo` y `pid` (la identidad de PostHog)— para que el
// webhook pueda atar la apertura a la misma persona sin volver a mirar la base.

import { distinctIdDeCorreo, uuidDeterminista, type EventoServidor } from "./posthog-servidor";

export type TipoCorreo =
  | "bienvenida"
  | "pago_confirmado"
  | "boleta"
  | "pago_fallido"
  | "checkout_abandonado"
  | "informe_listo"
  | "eliminacion_interna"
  | "eliminacion_usuario";

export const TIPOS_CORREO: readonly TipoCorreo[] = [
  "bienvenida", "pago_confirmado", "boleta", "pago_fallido", "checkout_abandonado", "informe_listo", "eliminacion_interna", "eliminacion_usuario",
];

/** La identidad que viaja en el tag `pid`: el user id si se sabe, si no la derivada del correo. */
export function identidadCorreo(to: string, userId?: string | null): string {
  return userId && userId.trim() ? userId : distinctIdDeCorreo(to);
}

/** Resend solo admite letras ASCII, números, guiones y guiones bajos en los tags. */
export function valorTag(v: string): string {
  return v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

export function tagsCorreo(tipo: TipoCorreo, distinctId: string): Array<{ name: string; value: string }> {
  return [
    { name: "tipo", value: valorTag(tipo) },
    { name: "pid", value: valorTag(distinctId) },
  ];
}

export function eventoCorreoEnviado(args: { tipo: TipoCorreo; distinctId: string; resendId: string | null }): EventoServidor {
  return {
    event: "correo_enviado",
    distinctId: args.distinctId,
    ...(args.resendId ? { uuid: uuidDeterminista(`correo_enviado:${args.resendId}`) } : {}),
    properties: { tipo: args.tipo, email_id: args.resendId },
  };
}

/** Los eventos del webhook de Resend que se miden, y su nombre en PostHog. */
export const EVENTOS_RESEND: Record<string, string> = {
  "email.delivered": "correo_entregado",
  "email.opened": "correo_abierto",
  "email.clicked": "correo_clic",
  "email.bounced": "correo_rebotado",
  "email.complained": "correo_spam",
};

interface CargaResend {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    tags?: Array<{ name: string; value: string }> | Record<string, string>;
    click?: { link?: string };
    bounce?: { type?: string };
  };
}

type TagsResend = Array<{ name: string; value: string }> | Record<string, string> | undefined;

function tag(tags: TagsResend, nombre: string): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) return tags.find((t) => t?.name === nombre)?.value ?? null;
  const v = (tags as Record<string, string>)[nombre];
  return typeof v === "string" ? v : null;
}

/**
 * De la carga del webhook al evento. `svixId` identifica la entrega (los reintentos lo repiten),
 * así que el uuid sale de ahí. Sin `pid` en los tags la identidad se deriva del destinatario.
 */
export function eventoDeResend(carga: unknown, svixId: string): EventoServidor | null {
  const c = (carga ?? {}) as CargaResend;
  const nombre = c.type ? EVENTOS_RESEND[c.type] : undefined;
  if (!nombre || !c.data) return null;
  const to = Array.isArray(c.data.to) ? c.data.to[0] : c.data.to;
  const pid = tag(c.data.tags, "pid");
  const distinctId = pid ?? (to ? distinctIdDeCorreo(to) : null);
  if (!distinctId) return null;
  return {
    event: nombre,
    distinctId,
    uuid: uuidDeterminista(`resend:${svixId}`),
    timestamp: c.created_at,
    properties: {
      tipo: tag(c.data.tags, "tipo"),
      email_id: c.data.email_id ?? null,
      asunto: c.data.subject ?? null,
      ...(c.type === "email.clicked" ? { link: c.data.click?.link ?? null } : {}),
      ...(c.type === "email.bounced" ? { rebote: c.data.bounce?.type ?? null } : {}),
    },
  };
}
