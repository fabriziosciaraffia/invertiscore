// ─────────────────────────────────────────────────────────────────────────────
// El regalo al registrarse, del lado del servidor (16-oct-2026; las reglas en regalo-alta.ts). UN SOLO LUGAR lo otorga:
// `asegurarRegaloDeAlta`, que llaman todas las puertas que crean cuenta —/deptos, el reclamo después del código (banner,
// /entrar, guía), /auth/callback (enlace del correo y Google) y el dashboard como red—. La fila de `regalos_alta` es la
// marca de «una vez» (su clave es la cuenta): dos llamadas a la vez no regalan dos veces. En la misma pasada, la cuenta
// pierde la bienvenida (welcome_credit_used = true): el regalo la reemplaza.
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
async function esDeLaCasa(admin: SupabaseClient, userId: string, dispositivo: string | null): Promise<boolean> {
  try {
    const { data: u, error: eU } = await admin.auth.admin.getUserById(userId);
    reportarFalloQuery(eU, { ruta: RUTA, operacion: "leer-correo", userId });
    if (esCorreoDeLaCasa(u?.user?.email, correosAdmin())) return true;
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
  p: { userId: string; creadaAt: string | null | undefined; huella: Huella; puerta?: string | null; crono?: Cronometro },
  ahora: Date = new Date(),
): Promise<ResultadoRegaloAlta> {
  const c = p.crono ?? SIN_CRONOMETRO;
  try {
    if (!esCuentaDelRegalo(p.creadaAt)) return { estado: "vieja", vence: null };
    const { data: previa, error: e0 } = await c.medir("regalo-previo", Promise.resolve(admin.from("regalos_alta").select("motivo, vence_at").eq("user_id", p.userId).maybeSingle()));
    reportarFalloQuery(e0, { ruta: RUTA, operacion: "leer-decision", userId: p.userId });
    if (e0) return { estado: "fallo", vence: null };
    if (previa) return { estado: "ya", vence: previa.motivo === "otorgado" ? (previa.vence_at as string | null) : null };

    const dia = diaChile(ahora);
    const desdeDisp = new Date(ahora.getTime() - DIAS_TOPE_DISPOSITIVO * 864e5).toISOString();
    const [disp, total] = await c.medir("regalo-topes", Promise.all([
      p.huella.dispositivo
        ? admin.from("regalos_alta").select("user_id", { count: "exact", head: true }).eq("motivo", "otorgado").eq("dispositivo_hash", p.huella.dispositivo).gte("decidido_at", desdeDisp)
        : Promise.resolve(null),
      admin.from("regalos_alta").select("user_id", { count: "exact", head: true }).eq("motivo", "otorgado").eq("dia", dia),
    ]));
    // Un conteo sin número es «no sé», no cero (memoria «sonda de existencia»): no se regala a ciegas.
    const fallas = [disp?.error, total.error].filter(Boolean);
    if (fallas.length > 0 || (disp && disp.count == null) || total.count == null) {
      reportarFalloQuery(fallas[0], { ruta: RUTA, operacion: "contar-topes", userId: p.userId });
      return { estado: "fallo", vence: null };
    }
    const porDispositivo = disp ? disp.count : null;
    const deLaCasa = dispositivoTopa(porDispositivo) ? await c.medir("regalo-de-la-casa", esDeLaCasa(admin, p.userId, p.huella.dispositivo)) : false;
    const decision = decidirRegaloAlta({ creadaAt: p.creadaAt, porDispositivo, totalHoy: total.count ?? 0, deLaCasa });
    const vence = new Date(ahora.getTime() + DIAS_VIGENCIA_REGALO_ALTA * 864e5).toISOString();
    const otorga = decision === "otorgar";
    // La marca primero: si otra llamada ya decidió, esta no hace nada.
    const { error: eMarca } = await c.medir("regalo-marca", Promise.resolve(admin.from("regalos_alta").insert({
      user_id: p.userId, decidido_at: ahora.toISOString(), dia, motivo: otorga ? "otorgado" : decision,
      dispositivo_hash: p.huella.dispositivo, ip_hash: p.huella.ip, vence_at: otorga ? vence : null,
    })));
    if (eMarca) {
      if ((eMarca as { code?: string }).code === "23505") return { estado: "ya", vence: null };
      reportarFalloQuery(eMarca, { ruta: RUTA, operacion: "marcar", userId: p.userId });
      return { estado: "fallo", vence: null };
    }
    await c.medir("regalo-bienvenida", apagarBienvenida(admin, p.userId));
    if (!otorga) {
      void capturarServidor({ event: "regalo_alta_topado", distinctId: p.userId, uuid: uuidDeterminista(`regalo_alta:${p.userId}`), properties: { motivo: decision, puerta: p.puerta ?? null } }).catch(() => {});
      return { estado: decision, vence: null };
    }
    const { data: g, error: eGrant } = await c.medir("regalo-lote", Promise.resolve(admin.from("credit_grants").insert({
      user_id: p.userId, amount: 1, remaining: 1, source: FUENTE_REGALO_ALTA, granted_at: ahora.toISOString(), expires_at: vence,
    }).select("id").single()));
    if (eGrant || !g) {
      reportarFalloQuery(eGrant, { ruta: RUTA, operacion: "cargar", userId: p.userId });
      await admin.from("regalos_alta").update({ motivo: "fallo", vence_at: null }).eq("user_id", p.userId);
      return { estado: "fallo", vence: null };
    }
    await c.medir("regalo-enlace", Promise.resolve(admin.from("regalos_alta").update({ grant_id: g.id }).eq("user_id", p.userId)));
    void capturarServidor({ event: "regalo_alta_otorgado", distinctId: p.userId, uuid: uuidDeterminista(`regalo_alta:${p.userId}`), properties: { vence, puerta: p.puerta ?? null, de_la_casa: deLaCasa } }).catch(() => {});
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
