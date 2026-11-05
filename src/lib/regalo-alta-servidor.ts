// ─────────────────────────────────────────────────────────────────────────────
// El regalo al registrarse, del lado del servidor (16-oct-2026; las reglas en regalo-alta.ts). UN SOLO LUGAR lo otorga:
// `asegurarRegaloDeAlta`, que llaman todas las puertas que crean cuenta —/deptos, el reclamo después del código (banner,
// /entrar, guía), /auth/callback (enlace del correo y Google) y el dashboard como red—. La fila de `regalos_alta` es la
// marca de «una vez» (su clave es la cuenta): dos llamadas a la vez no regalan dos veces. En la misma pasada, la cuenta
// pierde la bienvenida (welcome_credit_used = true): el regalo la reemplaza.
// LOS LOTES EN FALLO SE REINTENTAN SOLOS (05-nov-2026, auditoría de promesas parte 3): si el lote no se pudo cargar, la fila
// quedaba en «fallo» y ninguna llamada volvía a intentarlo —la cuenta quedaba sin regalo y sin bienvenida—. Ahora la próxima
// llamada (el dashboard es una) y el cron diario de conciliación (reconciliar-pagos › reintentarRegalosEnFallo) lo cargan.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { COOKIE_DISPOSITIVO, dispositivoValido } from "@/lib/dispositivo";
import { SIN_CRONOMETRO, type Cronometro } from "@/lib/cronometro";
import {
  DIAS_TOPE_DISPOSITIVO, DIAS_VIGENCIA_REGALO_ALTA, FUENTE_REGALO_ALTA, decidirRegaloAlta, diaChile, dispositivoTopa,
  esCorreoDeLaCasa, esCuentaDelRegalo, type DecisionRegalo,
} from "./regalo-alta";

const RUTA = "lib/regalo-alta";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

/** El dispositivo (topa) y la IP (solo queda anotada) de un pedido, en hash. */
export interface Huella { dispositivo: string | null; ip: string | null }

export function huellaDeCabeceras(h: { get(nombre: string): string | null }, cookieDispositivo?: string | null): Huella {
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  let disp = cookieDispositivo ?? null;
  if (disp == null) {
    const m = (h.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE_DISPOSITIVO}=([^;]+)`));
    disp = m ? decodeURIComponent(m[1]) : null;
  }
  const d = dispositivoValido(disp);
  return { dispositivo: d ? hash(`disp:${d}`) : null, ip: ip ? hash(`ip:${ip}`) : null };
}

export function huellaDeRequest(request: Request): Huella {
  return huellaDeCabeceras(request.headers);
}

/** Los correos de admin (ADMIN_EMAIL, separados por coma). */
function correosAdmin(): string[] {
  return (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * ¿La cuenta es de la casa? (24-oct-2026, regalo-alta.ts) Su correo (un alias del admin o @refranco.ai), o el dispositivo:
 * si alguno de los regalos que ya dio fue a una cuenta de prueba (`test_accounts`), es un teléfono de la casa. Solo se
 * pregunta cuando el dispositivo ya topó. Si algo falla, no es de la casa: el tope sigue, que es lo prudente.
 */
async function esDeLaCasa(admin: SupabaseClient, userId: string, dispositivo: string | null, correo?: string | null): Promise<boolean> {
  try {
    // Con el correo a mano (el alta lo tiene), sin ir a Auth.
    if (correo !== undefined) {
      if (esCorreoDeLaCasa(correo, correosAdmin())) return true;
    } else {
      const { data: u, error: eU } = await admin.auth.admin.getUserById(userId);
      reportarFalloQuery(eU, { ruta: RUTA, operacion: "leer-correo", userId });
      if (esCorreoDeLaCasa(u?.user?.email, correosAdmin())) return true;
    }
    if (!dispositivo) return false;
    const { data: previas, error: eP } = await admin.from("regalos_alta").select("user_id").eq("motivo", "otorgado").eq("dispositivo_hash", dispositivo);
    reportarFalloQuery(eP, { ruta: RUTA, operacion: "regalos-del-dispositivo", userId });
    // La cuenta misma no está entre ellas: si ya tuviera su fila, asegurarRegaloDeAlta habría salido antes («ya»).
    const otras = (previas ?? []).map((r) => r.user_id as string);
    if (eP || otras.length === 0) return false;
    const { count, error: eT } = await admin.from("test_accounts").select("user_id", { count: "exact", head: true }).in("user_id", otras);
    reportarFalloQuery(eT, { ruta: RUTA, operacion: "dispositivo-de-prueba", userId });
    return !eT && count != null && count > 0;
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "de-la-casa", userId });
    return false;
  }
}

export interface ResultadoRegaloAlta {
  estado: DecisionRegalo | "ya" | "fallo";
  /** Cuándo vence el regalo, si la cuenta lo tiene (recién otorgado o de antes). */
  vence: string | null;
  /** Con «ya»: lo que quedó escrito antes (otorgado, tope_dispositivo, tope_dia…), para decir por qué no hay regalo. */
  motivo?: string | null;
}

/** Cuánto se espera a que una llamada en curso cargue su lote antes de darlo por perdido (otorgado sin lote enlazado). */
const ESPERA_LOTE_EN_CURSO_MS = 10 * 60 * 1000;

/** El lote del regalo de una cuenta, si ya existe (un enlace que no alcanzó a escribirse): nunca se cargan dos. */
async function loteExistente(admin: SupabaseClient, userId: string): Promise<{ id: string; expires_at: string | null } | null> {
  const { data, error } = await admin.from("credit_grants").select("id, expires_at").eq("user_id", userId).eq("source", FUENTE_REGALO_ALTA).order("granted_at").limit(1).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "lote-existente", userId });
  if (error) throw error;
  return (data as { id: string; expires_at: string | null } | null) ?? null;
}

/**
 * REINTENTAR EL LOTE (05-nov-2026): una cuenta cuya decisión fue regalar pero el lote no quedó —«fallo», o «otorgado» sin lote
 * enlazado pasada la espera—. «fallo» se reclama con un update condicional (dos reintentos a la vez: carga uno). El
 * vencimiento cuenta desde ahora: la persona nunca lo tuvo. Devuelve el resultado como si recién se otorgara; null si no
 * había nada que reintentar (o lo tomó otra llamada).
 */
export async function reintentarLote(
  admin: SupabaseClient,
  userId: string,
  previa: { motivo: string | null; vence_at?: string | null; grant_id?: string | null; decidido_at?: string | null },
  ahora: Date = new Date(),
): Promise<ResultadoRegaloAlta | null> {
  const vence = new Date(ahora.getTime() + DIAS_VIGENCIA_REGALO_ALTA * 864e5).toISOString();
  if (previa.motivo === "fallo") {
    const { data: reclamo, error } = await admin.from("regalos_alta").update({ motivo: "otorgado", vence_at: vence }).eq("user_id", userId).eq("motivo", "fallo").select("user_id");
    reportarFalloQuery(error, { ruta: RUTA, operacion: "reclamar-fallo", userId });
    if (error || !reclamo || reclamo.length === 0) return null;
  } else if (previa.motivo === "otorgado" && !previa.grant_id) {
    const desde = previa.decidido_at ? Date.parse(previa.decidido_at) : 0;
    if (Number.isFinite(desde) && ahora.getTime() - desde < ESPERA_LOTE_EN_CURSO_MS) return null;
  } else {
    return null;
  }
  try {
    const ya = await loteExistente(admin, userId);
    let id = ya?.id ?? null;
    const venceLote = ya?.expires_at ?? (previa.motivo === "otorgado" ? previa.vence_at ?? vence : vence);
    if (!id) {
      const { data: g, error: eGrant } = await admin.from("credit_grants").insert({
        user_id: userId, amount: 1, remaining: 1, source: FUENTE_REGALO_ALTA, granted_at: ahora.toISOString(), expires_at: venceLote,
      }).select("id").single();
      if (eGrant || !g) throw eGrant ?? new Error("lote sin id");
      id = g.id as string;
    }
    await admin.from("regalos_alta").update({ motivo: "otorgado", vence_at: venceLote, grant_id: id }).eq("user_id", userId);
    void capturarServidor({ event: "regalo_alta_reintentado", distinctId: userId, uuid: uuidDeterminista(`regalo_alta_reintento:${userId}`), properties: { vence: venceLote, de: previa.motivo } }).catch(() => {});
    return { estado: "otorgar", vence: venceLote };
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "reintentar-lote", userId });
    // Vuelve a «fallo»: el próximo intento (una visita o el cron) lo toma de nuevo.
    await admin.from("regalos_alta").update({ motivo: "fallo", vence_at: null }).eq("user_id", userId);
    return { estado: "fallo", vence: null };
  }
}

/** El barrido del cron diario (reconciliar-pagos): los regalos en fallo y los otorgados sin lote pasada la espera. */
export async function reintentarRegalosEnFallo(admin: SupabaseClient, ahora: Date = new Date(), tope = 50): Promise<{ revisados: number; cargados: number }> {
  const antes = new Date(ahora.getTime() - ESPERA_LOTE_EN_CURSO_MS).toISOString();
  const { data, error } = await admin.from("regalos_alta").select("user_id, motivo, vence_at, grant_id, decidido_at")
    .or(`motivo.eq.fallo,and(motivo.eq.otorgado,grant_id.is.null,decidido_at.lt.${antes})`).order("decidido_at").limit(tope);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "barrer-fallos" });
  let cargados = 0;
  for (const r of (data ?? []) as Array<{ user_id: string; motivo: string; vence_at: string | null; grant_id: string | null; decidido_at: string | null }>) {
    const res = await reintentarLote(admin, r.user_id, r, ahora);
    if (res?.estado === "otorgar") cargados++;
  }
  return { revisados: (data ?? []).length, cargados };
}

/** La cuenta pierde la bienvenida: el regalo la reemplaza (o, si topó, no hay nada gratis). */
async function apagarBienvenida(admin: SupabaseClient, userId: string): Promise<void> {
  const { error: e1 } = await admin.from("user_credits").upsert(
    { user_id: userId, credits: 0, subscription_status: "none", welcome_credit_used: true },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  reportarFalloQuery(e1, { ruta: RUTA, operacion: "fila-creditos", userId });
  const { error: e2 } = await admin.from("user_credits").update({ welcome_credit_used: true }).eq("user_id", userId).eq("welcome_credit_used", false);
  reportarFalloQuery(e2, { ruta: RUTA, operacion: "apagar-bienvenida", userId });
}

/**
 * El regalo de una cuenta, una vez. `creadaAt` es el `created_at` de la cuenta: las de antes del corte no se tocan.
 * Nunca lanza: si algo falla, la cuenta queda sin regalo y se reporta.
 */
export async function asegurarRegaloDeAlta(
  admin: SupabaseClient,
  /** `puerta`: también una promesa (el alta de /deptos la sabe recién a la mitad; solo la usan los eventos). */
  p: { userId: string; creadaAt: string | null | undefined; huella: Huella; puerta?: string | null | Promise<string | null>; crono?: Cronometro; correo?: string | null },
  ahora: Date = new Date(),
): Promise<ResultadoRegaloAlta> {
  const c = p.crono ?? SIN_CRONOMETRO;
  try {
    if (!esCuentaDelRegalo(p.creadaAt)) return { estado: "vieja", vence: null };
    // LA DECISIÓN DE ANTES Y LOS TOPES, EN UNA SOLA RONDA (25-oct-2026, el alta rápida): eran dos rondas en fila.
    const dia = diaChile(ahora);
    const desdeDisp = new Date(ahora.getTime() - DIAS_TOPE_DISPOSITIVO * 864e5).toISOString();
    const [{ data: previa, error: e0 }, disp, total] = await c.medir("regalo-previo-y-topes", Promise.all([
      admin.from("regalos_alta").select("motivo, vence_at, grant_id, decidido_at").eq("user_id", p.userId).maybeSingle(),
      p.huella.dispositivo
        ? admin.from("regalos_alta").select("user_id", { count: "exact", head: true }).eq("motivo", "otorgado").eq("dispositivo_hash", p.huella.dispositivo).gte("decidido_at", desdeDisp)
        : Promise.resolve(null),
      admin.from("regalos_alta").select("user_id", { count: "exact", head: true }).eq("motivo", "otorgado").eq("dia", dia),
    ]));
    reportarFalloQuery(e0, { ruta: RUTA, operacion: "leer-decision", userId: p.userId });
    if (e0) return { estado: "fallo", vence: null };
    if (previa) {
      // Un lote que no quedó (fallo, u otorgado sin lote pasada la espera) se reintenta acá mismo.
      const reintento = await reintentarLote(admin, p.userId, previa as { motivo: string | null; vence_at: string | null; grant_id: string | null; decidido_at: string | null }, ahora);
      if (reintento) return reintento;
      return { estado: "ya", vence: previa.motivo === "otorgado" ? (previa.vence_at as string | null) : null, motivo: (previa.motivo as string | null) ?? null };
    }
    // Un conteo sin número es «no sé», no cero (memoria «sonda de existencia»): no se regala a ciegas.
    const fallas = [disp?.error, total.error].filter(Boolean);
    if (fallas.length > 0 || (disp && disp.count == null) || total.count == null) {
      reportarFalloQuery(fallas[0], { ruta: RUTA, operacion: "contar-topes", userId: p.userId });
      return { estado: "fallo", vence: null };
    }
    const porDispositivo = disp ? disp.count : null;
    const deLaCasa = dispositivoTopa(porDispositivo) ? await c.medir("regalo-de-la-casa", esDeLaCasa(admin, p.userId, p.huella.dispositivo, p.correo)) : false;
    const decision = decidirRegaloAlta({ creadaAt: p.creadaAt, porDispositivo, totalHoy: total.count ?? 0, deLaCasa });
    const vence = new Date(ahora.getTime() + DIAS_VIGENCIA_REGALO_ALTA * 864e5).toISOString();
    const otorga = decision === "otorgar";
    // La marca primero: si otra llamada ya decidió, esta no hace nada.
    const { error: eMarca } = await c.medir("regalo-marca", Promise.resolve(admin.from("regalos_alta").insert({
      user_id: p.userId, decidido_at: ahora.toISOString(), dia, motivo: otorga ? "otorgado" : decision,
      dispositivo_hash: p.huella.dispositivo, ip_hash: p.huella.ip, vence_at: otorga ? vence : null,
    })));
    if (eMarca) {
      // OTRO PEDIDO DECIDIÓ PRIMERO (25-oct-2026, visto en el preview: el reclamo de la cuenta y el alta corren juntos): se
      // devuelve lo que decidió —con su vencimiento—, no un «ya» sin fecha que deja «Estás dentro» sin la tarjeta del regalo.
      if ((eMarca as { code?: string }).code === "23505") {
        const { data: ganadora } = await admin.from("regalos_alta").select("motivo, vence_at").eq("user_id", p.userId).maybeSingle();
        return { estado: "ya", vence: ganadora?.motivo === "otorgado" ? ((ganadora.vence_at as string | null) ?? null) : null, motivo: (ganadora?.motivo as string | null) ?? null };
      }
      reportarFalloQuery(eMarca, { ruta: RUTA, operacion: "marcar", userId: p.userId });
      return { estado: "fallo", vence: null };
    }
    // La bienvenida se apaga junto con el lote (eran dos rondas en fila).
    const bienvenida = c.medir("regalo-bienvenida", apagarBienvenida(admin, p.userId));
    if (!otorga) {
      await bienvenida;
      void capturarServidor({ event: "regalo_alta_topado", distinctId: p.userId, uuid: uuidDeterminista(`regalo_alta:${p.userId}`), properties: { motivo: decision, puerta: (await Promise.resolve(p.puerta).catch(() => null)) ?? null } }).catch(() => {});
      return { estado: decision, vence: null };
    }
    const [{ data: g, error: eGrant }] = await Promise.all([c.medir("regalo-lote", Promise.resolve(admin.from("credit_grants").insert({
      user_id: p.userId, amount: 1, remaining: 1, source: FUENTE_REGALO_ALTA, granted_at: ahora.toISOString(), expires_at: vence,
    }).select("id").single())), bienvenida]);
    if (eGrant || !g) {
      reportarFalloQuery(eGrant, { ruta: RUTA, operacion: "cargar", userId: p.userId });
      await admin.from("regalos_alta").update({ motivo: "fallo", vence_at: null }).eq("user_id", p.userId);
      return { estado: "fallo", vence: null };
    }
    await c.medir("regalo-enlace", Promise.resolve(admin.from("regalos_alta").update({ grant_id: g.id }).eq("user_id", p.userId)));
    void capturarServidor({ event: "regalo_alta_otorgado", distinctId: p.userId, uuid: uuidDeterminista(`regalo_alta:${p.userId}`), properties: { vence, puerta: (await Promise.resolve(p.puerta).catch(() => null)) ?? null, de_la_casa: deLaCasa } }).catch(() => {});
    return { estado: "otorgar", vence };
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "asegurar", userId: p.userId });
    return { estado: "fallo", vence: null };
  }
}

/** El regalo de alta vivo de una cuenta (para el correo del día y la pantalla): cuándo vence, o null. */
export async function regaloAltaVivo(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<string | null> {
  const { data } = await admin.from("credit_grants").select("expires_at").eq("user_id", userId).eq("source", FUENTE_REGALO_ALTA)
    .gt("remaining", 0).gt("expires_at", ahora.toISOString()).order("expires_at").limit(1).maybeSingle();
  return (data?.expires_at as string | null) ?? null;
}
