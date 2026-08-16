// ─────────────────────────────────────────────────────────────────────────────
// Cap anónimo — F2-2 (diseño F2-1 aprobado 2026-08-16)
//
// Un anónimo puede generar UN análisis completo (LTR, STR o AMBAS) sin
// registrarse. La pieza central es la cookie `franco_anon`:
//
//  · CAP: su sola PRESENCIA = cap consumido. El enforcement no mira la base,
//    así la expiración de la ventana de claim (30 días) no re-abre el cap
//    (la cookie vive 180).
//  · CLAIM: su VALOR (hasheado sha256) queda en `analisis.anon_claim_token_hash`
//    y es el secreto que el registro/login usa para adoptar la fila. httpOnly:
//    invisible para JS, viaja solo en requests al dominio.
//
// El cap es fricción, no muralla (incógnito lo evade; ~USD 0,31/análisis lo
// tolera). Las capas: cookie + rate-limit por IP + Turnstile invisible.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

/** Nombre de la cookie del cap/claim. First-party, httpOnly, SameSite=Lax. */
export const ANON_COOKIE = "franco_anon";

/** Vida de la COOKIE (cap): 180 días. La ventana de CLAIM son 30 (cron). */
export const ANON_COOKIE_MAX_AGE_S = 180 * 24 * 60 * 60;

/** Valor de `charge_mode` que marca el origen anónimo. Permanente en la fila. */
export const CHARGE_MODE_ANON = "anon_cap";

/** Rate-limit de creación anónima por IP. In-memory por instancia (best-effort
 *  en serverless, mismo trade-off aceptado que /api/analisis/dry-run). */
const RL_MAX_POR_DIA = 5;
const RL_WINDOW_MS = 24 * 60 * 60 * 1000;
const hitsPorIp = new Map<string, number[]>();

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** IP del request tras el proxy de Vercel (primer hop de x-forwarded-for). */
export function ipDelRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "sin-ip"
  );
}

function rateLimitedPorIp(ip: string): boolean {
  const now = Date.now();
  const arr = (hitsPorIp.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hitsPorIp.set(ip, arr);
  return arr.length > RL_MAX_POR_DIA;
}

/**
 * Validación Turnstile server-side. KILL-SWITCH FAIL-OPEN: sin
 * `TURNSTILE_SECRET_KEY` en el env, no se valida nada (dev y rollback corren
 * solo con cookie + IP-limit). Activarlo es subir la key a Vercel + redeploy —
 * cero cambios de código, mismo criterio que OPENFACTURA_ENABLED.
 */
async function validarTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare caído no debe tumbar el camino anónimo completo: el resto de
    // las capas (cookie + IP) sigue en pie. Fail-open deliberado.
    return true;
  }
}

export type Actor =
  /** Sesión válida — el flujo con crédito de siempre, intacto. */
  | { tipo: "user"; user: User }
  /** Anónimo con cap disponible: token nuevo acuñado; el caller debe llamar
   *  `emitirCookieAnon(token)` después de crear la fila. */
  | { tipo: "anon"; token: string; tokenHash: string }
  /** Segundo POST del par AMBAS anónimo (serializado): la cookie ya existe y
   *  autentica al hermano. NO se emite cookie nueva. */
  | { tipo: "anon-hermano"; tokenHash: string }
  | { tipo: "rechazado"; response: NextResponse };

/**
 * Resuelve quién está creando el análisis. Reemplaza el 401 seco de
 * `requireAuthenticatedUser` en las DOS rutas de creación (LTR y STR).
 *
 * Rama anónima, chequeos en orden (todos baratos):
 *  1. Cookie presente → cap consumido (403)… salvo el caso hermano-AMBAS:
 *     si el body trae `ambasGroupId` y existe una fila LTR recién creada con
 *     ESTE token y ESE group_id, el request es el segundo POST del par
 *     serializado y pasa (el par completo es EL análisis del cap).
 *  2. Rate-limit por IP (5/día).
 *  3. Turnstile (solo si TURNSTILE_SECRET_KEY está seteada).
 */
export async function resolveActor(
  supabase: SupabaseClient,
  request: Request,
  opts: { turnstileToken?: unknown; ambasGroupId?: string | null },
): Promise<Actor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { tipo: "user", user };

  const cookieExistente = cookies().get(ANON_COOKIE)?.value;

  if (cookieExistente) {
    // ¿Hermano del par AMBAS? El token de la cookie tiene que calzar con una
    // fila LTR del MISMO group_id creada hace minutos. Ventana corta: esto solo
    // cubre la serialización del wizard, no un "segundo análisis" días después.
    if (opts.ambasGroupId) {
      const admin = createAnonPipelineClient();
      const hace10Min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: hermanoLtr } = await admin
        .from("analisis")
        .select("id")
        .eq("anon_claim_token_hash", sha256Hex(cookieExistente))
        .eq("ambas_group_id", opts.ambasGroupId)
        .eq("ambas_role", "ltr")
        .is("user_id", null)
        .gte("created_at", hace10Min)
        .maybeSingle();
      if (hermanoLtr?.id) {
        return { tipo: "anon-hermano", tokenHash: sha256Hex(cookieExistente) };
      }
    }
    return {
      tipo: "rechazado",
      response: NextResponse.json(
        { error: "cap_anonimo_consumido" },
        { status: 403 },
      ),
    };
  }

  const ip = ipDelRequest(request);
  if (rateLimitedPorIp(ip)) {
    return {
      tipo: "rechazado",
      response: NextResponse.json(
        { error: "Demasiados análisis desde esta conexión. Crea tu cuenta para continuar." },
        { status: 429 },
      ),
    };
  }

  if (!(await validarTurnstile(opts.turnstileToken, ip))) {
    return {
      tipo: "rechazado",
      response: NextResponse.json(
        { error: "No pudimos verificar que eres una persona. Recarga la página e intenta de nuevo." },
        { status: 403 },
      ),
    };
  }

  const token = randomUUID();
  return { tipo: "anon", token, tokenHash: sha256Hex(token) };
}

/**
 * Emite la cookie del cap. Llamar DESPUÉS del INSERT exitoso: si la creación
 * falla, el anónimo no debe quedar con el cap quemado y las manos vacías.
 */
export function emitirCookieAnon(token: string): void {
  cookies().set(ANON_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE_S,
  });
}

/**
 * Client service-role para el pipeline anónimo. La rama anónima NO tiene sesión,
 * y el client anon-key queda sujeto a las políticas RLS (que no contemplan
 * INSERT/UPDATE anónimos — y no deben). El INSERT de la fila, el UPDATE de la
 * prosa IA y el timing corren con este client. Server-only.
 */
export function createAnonPipelineClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** ¿El cap anónimo sigue disponible en ESTE navegador? (para /api/me/tier). */
export function anonCapDisponible(): boolean {
  return !cookies().get(ANON_COOKIE)?.value;
}

/** Lee el token de la cookie (para el claim y la vista anónimo-dueño). */
export function tokenAnonDelRequest(): string | null {
  return cookies().get(ANON_COOKIE)?.value ?? null;
}
