/**
 * LOS EVENTOS DE META DESDE EL SERVIDOR (15-oct-2026, medición para la campaña). Todo evento que va a Meta por la
 * API de conversiones pasa por `emitirEventoMeta`, que:
 *
 *   1. deja FUERA a las cuentas de prueba (`test_accounts`, por id o por correo, y el admin) — salvo en MODO
 *      PRUEBA (la cookie `franco_meta_prueba`, que se prende con `?meta_prueba=1`): entonces el evento sale con
 *      `test_event_code` (META_TEST_EVENT_CODE), se ve en «Probar eventos» y no cuenta en producción;
 *   2. lo manda UNA vez por `event_id`: la fila de `meta_eventos` es la marca, y queda con su estado (enviado,
 *      fallo, omitido, apagado) para poder verificar en producción;
 *   3. lo manda con todo lo que ayuda a Meta a reconocer a la persona: correo hasheado, fbp, fbc, IP, navegador e
 *      id externo. Un webhook (el pago) no trae cookies: usa el último navegador conocido de la cuenta
 *      (`meta_contexto`, lo guardan los requests del navegador);
 *   4. devuelve el ESPEJO —el mismo evento con el mismo id— para que el pixel lo repita (espejo.ts). Sin espejo
 *      cuando la cuenta es de prueba, cuando el evento ya salió o en modo prueba.
 *   5. CON EL CONSENTIMIENTO (19-oct-2026, lib/consentimiento.ts): el correo hasheado, el id de la cuenta, `_fbp` y
 *      `_fbc` salen SOLO si el navegador dijo «si» en el aviso de cookies (la cookie del request, o la que quedó en
 *      `meta_contexto` para un webhook). Sin «si», el evento sale sin nada que identifique a la persona más allá de la
 *      IP y el navegador, y sin espejo (el pixel no corre). Lo arma `datosParaMeta`, que prueba el tier CONSENTIMIENTO.
 *
 * Nunca lanza: una falla de Meta no rompe el pago, el registro ni el informe. Lo prueba el tier MEDICION-META.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { sendMetaCapiEvent, type MetaCapiEventInput, type MetaCapiResult } from "@/lib/meta/capi";
import { COOKIE_ESPEJO, TOPE_ESPEJO, VIDA_ESPEJO_S, parsearEspejo, type EventoEspejo } from "@/lib/meta/espejo";
import { isAdminUser } from "@/lib/admin";
import { COOKIE_PRUEBA } from "@/lib/meta/cookies";
import { conPermiso, consentimientoDeCookie } from "@/lib/consentimiento";

/** Lo que el navegador deja saber de sí en un request. */
export interface ContextoMeta {
  ip: string | null;
  ua: string | null;
  fbp: string | null;
  fbc: string | null;
  url: string | null;
  /** Modo prueba: los eventos salen con el código de prueba y sin espejo. */
  prueba: boolean;
  /** El «si» del aviso de cookies (19-oct-2026): sin él no salen el correo, el id ni las cookies del pixel. */
  consentimiento: boolean;
}

export { COOKIE_PRUEBA };
/** El contexto guardado de una cuenta sirve para un webhook si es de los últimos siete días. */
export const VIDA_CONTEXTO_MS = 7 * 24 * 60 * 60 * 1000;

export type EstadoEventoMeta =
  | "enviando"
  | "enviado"
  | "fallo"
  | "omitido_cuenta_prueba"
  | "repetido"
  | "apagado"
  | "prueba_sin_codigo";

export interface EventoServidor {
  evento: string;
  eventId: string;
  userId?: string | null;
  email?: string | null;
  /** Monto (Purchase): va como `value` en CLP. */
  valor?: number | null;
  /** Datos del evento: a custom_data y al pixel. */
  datos?: Record<string, unknown>;
  /** El navegador del request; sin él (un webhook) se usa el guardado de la cuenta. */
  contexto?: ContextoMeta | null;
  /** De dónde sale, para la fila de `meta_eventos`. */
  origen?: string;
  /** Cuándo pasó (segundos unix): solo el relleno lo manda; sin él, ahora (capi.ts). */
  eventTime?: number | null;
}

export interface EmisionMeta {
  estado: EstadoEventoMeta;
  /** Lo que el pixel tiene que repetir; `null` si no corresponde. */
  espejo: EventoEspejo | null;
  /** El envío a Meta; quien llama lo espera o lo deja en `waitUntil`. */
  envio: Promise<void>;
}

const LISTO = Promise.resolve();

export function leerCookie(cabecera: string | null | undefined, nombre: string): string | null {
  if (!cabecera) return null;
  for (const parte of cabecera.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) {
      const crudo = v.join("=");
      try { return decodeURIComponent(crudo); } catch { return crudo; }
    }
  }
  return null;
}

/** El contexto de un request del navegador: IP, navegador, cookies del pixel y el modo prueba. */
export function contextoDeRequest(request: Request): ContextoMeta {
  const h = request.headers;
  const cookie = h.get("cookie");
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
    fbp: leerCookie(cookie, "_fbp"),
    fbc: leerCookie(cookie, "_fbc"),
    url: h.get("referer") ?? request.url,
    prueba: leerCookie(cookie, COOKIE_PRUEBA) === "1",
    consentimiento: conPermiso(consentimientoDeCookie(cookie)),
  };
}

/** El mismo contexto desde un server component (cabeceras y cookies de `next/headers`). */
export function contextoDeCabeceras(h: { get(n: string): string | null }, url: string | null): ContextoMeta {
  const cookie = h.get("cookie");
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
    fbp: leerCookie(cookie, "_fbp"),
    fbc: leerCookie(cookie, "_fbc"),
    url,
    prueba: leerCookie(cookie, COOKIE_PRUEBA) === "1",
    consentimiento: conPermiso(consentimientoDeCookie(cookie)),
  };
}

const tieneNavegador = (c: ContextoMeta | null | undefined): c is ContextoMeta => !!c && !!(c.ip || c.ua || c.fbp || c.fbc);

/** ¿Es una cuenta de prueba? Por id o por correo (`test_accounts`), o el admin. Un error del chequeo no la deja fuera. */
export async function esCuentaDePrueba(admin: SupabaseClient, userId?: string | null, email?: string | null): Promise<boolean> {
  if (email && isAdminUser(email)) return true;
  if (!userId && !email) return false;
  try {
    const { data, error } = await admin.rpc("es_cuenta_de_prueba", { p_user_id: userId ?? null, p_email: email ?? null });
    if (error) {
      console.error("[meta] es_cuenta_de_prueba:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[meta] es_cuenta_de_prueba excepción:", e);
    return false;
  }
}

/** Guarda el navegador de la cuenta, para los eventos que salen de un webhook. */
export async function guardarContextoMeta(admin: SupabaseClient, userId: string, c: ContextoMeta | null | undefined): Promise<void> {
  if (!userId || !tieneNavegador(c)) return;
  try {
    await admin.from("meta_contexto").upsert(
      { user_id: userId, ip: c.ip, ua: c.ua?.slice(0, 500) ?? null, fbp: c.fbp, fbc: c.fbc, url: c.url?.slice(0, 500) ?? null, prueba: c.prueba, consentimiento: c.consentimiento === true, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  } catch (e) {
    console.error("[meta] guardarContextoMeta:", e);
  }
}

/** El último navegador de la cuenta, si es de los últimos siete días. */
export async function leerContextoMeta(admin: SupabaseClient, userId: string): Promise<ContextoMeta | null> {
  try {
    const { data } = await admin.from("meta_contexto").select("ip, ua, fbp, fbc, url, prueba, consentimiento, updated_at").eq("user_id", userId).maybeSingle();
    const f = data as (Omit<ContextoMeta, "prueba" | "consentimiento"> & { prueba: boolean; consentimiento: boolean | null; updated_at: string }) | null;
    if (!f || Date.now() - new Date(f.updated_at).getTime() > VIDA_CONTEXTO_MS) return null;
    return { ip: f.ip, ua: f.ua, fbp: f.fbp, fbc: f.fbc, url: f.url, prueba: f.prueba === true, consentimiento: f.consentimiento === true };
  } catch {
    return null;
  }
}

async function anotar(admin: SupabaseClient, evento: string, eventId: string, prueba: boolean, cambios: Record<string, unknown>): Promise<void> {
  try {
    await admin.from("meta_eventos").update({ ...cambios, updated_at: new Date().toISOString() }).eq("evento", evento).eq("event_id", eventId).eq("prueba", prueba);
  } catch {
    /* el registro es para mirar; no frena nada */
  }
}

/** Quien manda de verdad (el tier lo reemplaza por un contador; asignarle a un export no tiene efecto en este repo). */
export const envioMeta: { enviar: (input: MetaCapiEventInput) => Promise<MetaCapiResult> } = {
  enviar: sendMetaCapiEvent,
};

/** Lo que el pixel recibe junto al evento: el valor de una compra y los datos. */
function datosNavegador(e: EventoServidor): Record<string, unknown> | undefined {
  const d: Record<string, unknown> = { ...(e.datos ?? {}) };
  if (typeof e.valor === "number" && Number.isFinite(e.valor)) {
    d.value = e.valor;
    d.currency = "CLP";
  }
  return Object.keys(d).length ? d : undefined;
}

/**
 * Lo que sale a la API de conversiones (19-oct-2026). Con el «si» del aviso de cookies, todo lo que ayuda a Meta a
 * reconocer a la persona: el correo (se hashea en capi.ts), el id de la cuenta, `_fbp` y `_fbc`. Sin él, nada de eso:
 * el evento, su valor, la página, la IP y el navegador.
 */
export function datosParaMeta(e: EventoServidor, contexto: ContextoMeta | null, codigoPrueba: string | null): MetaCapiEventInput {
  const permiso = contexto?.consentimiento === true;
  return {
    eventName: e.evento,
    eventId: e.eventId,
    email: permiso ? e.email ?? null : null,
    value: e.valor ?? null,
    currency: "CLP",
    datos: e.datos ?? null,
    eventSourceUrl: contexto?.url ?? null,
    clientIp: contexto?.ip ?? null,
    userAgent: contexto?.ua ?? null,
    fbp: permiso ? contexto?.fbp ?? null : null,
    fbc: permiso ? contexto?.fbc ?? null : null,
    externalId: permiso ? e.userId ?? null : null,
    testEventCode: codigoPrueba,
    eventTime: e.eventTime ?? null,
  };
}

/** Ver la cabecera. Nunca lanza. */
export async function emitirEventoMeta(admin: SupabaseClient, e: EventoServidor): Promise<EmisionMeta> {
  try {
    const contexto = tieneNavegador(e.contexto) ? e.contexto : e.userId ? await leerContextoMeta(admin, e.userId) : null;
    const prueba = !!(e.contexto?.prueba || contexto?.prueba);
    const fila = { event_id: e.eventId, evento: e.evento, user_id: e.userId ?? null, prueba, origen: e.origen ?? null };

    // 1 · Las cuentas de prueba, fuera (salvo en modo prueba, que sale con el código y no cuenta).
    if (!prueba && (await esCuentaDePrueba(admin, e.userId, e.email))) {
      await admin.from("meta_eventos").upsert({ ...fila, estado: "omitido_cuenta_prueba" }, { onConflict: "evento,event_id,prueba", ignoreDuplicates: true });
      return { estado: "omitido_cuenta_prueba", espejo: null, envio: LISTO };
    }

    // 2 · Una vez por id: la fila es la marca. Si ya estaba, el evento ya salió (o se omitió).
    const { data: nueva, error } = await admin
      .from("meta_eventos")
      .upsert({ ...fila, estado: "enviando" }, { onConflict: "evento,event_id,prueba", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[meta] meta_eventos:", error.message);
      return { estado: "fallo", espejo: null, envio: LISTO };
    }
    if (!nueva || nueva.length === 0) return { estado: "repetido", espejo: null, envio: LISTO };

    if (e.userId && tieneNavegador(e.contexto)) await guardarContextoMeta(admin, e.userId, e.contexto);
    // Sin el «si» del aviso de cookies no hay espejo: el pixel no corre en ese navegador.
    const espejo: EventoEspejo | null = prueba || contexto?.consentimiento !== true ? null : { evento: e.evento, eventId: e.eventId, ...(datosNavegador(e) ? { datos: datosNavegador(e) } : {}) };

    const codigoPrueba = process.env.META_TEST_EVENT_CODE?.trim() || null;
    if (prueba && !codigoPrueba) {
      await anotar(admin, e.evento, e.eventId, prueba, { estado: "prueba_sin_codigo" });
      return { estado: "prueba_sin_codigo", espejo: null, envio: LISTO };
    }

    // 3 · El envío; el estado queda en la fila.
    const envio = (async () => {
      const r = await envioMeta.enviar(datosParaMeta(e, contexto, prueba ? codigoPrueba : null));
      await anotar(admin, e.evento, e.eventId, prueba, {
        estado: r.ok ? "enviado" : r.skipped ? "apagado" : "fallo",
        detalle: r.ok ? null : `${r.reason ?? "?"}${r.status ? ` (${r.status})` : ""}`,
      });
    })().catch((err) => console.error("[meta] envío:", err));
    return { estado: "enviando", espejo, envio };
  } catch (err) {
    console.error("[meta] emitirEventoMeta:", err);
    return { estado: "fallo", espejo: null, envio: LISTO };
  }
}

/** Deja los espejos en la cookie corta de la respuesta (sumados a los que el navegador todavía no consumió). */
export function conEspejo<R extends Response>(res: R, espejos: Array<EventoEspejo | null | undefined>, request?: Request): R {
  const nuevos = espejos.filter((x): x is EventoEspejo => !!x);
  // Solo una NextResponse sabe poner cookies; una Response pelada sale tal cual (el pixel no repite, el servidor sí mandó).
  if (nuevos.length === 0 || !("cookies" in res)) return res;
  const previos = parsearEspejo(request ? leerCookie(request.headers.get("cookie"), COOKIE_ESPEJO) : null);
  const todos = [...previos.filter((p) => !nuevos.some((n) => n.eventId === p.eventId)), ...nuevos].slice(-TOPE_ESPEJO);
  (res as unknown as NextResponse).cookies.set(COOKIE_ESPEJO, JSON.stringify(todos), {
    path: "/",
    maxAge: VIDA_ESPEJO_S,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
