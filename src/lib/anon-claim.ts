// ─────────────────────────────────────────────────────────────────────────────
// Claim de análisis anónimos — F2-2 (diseño F2-1 §2, decisión 1 de Fabrizio)
//
// Cuando un usuario con sesión llega con la cookie `franco_anon`, la fila (o el
// PAR AMBAS — comparten hash) creada como anónima pasa a su nombre, y ESO
// consume su welcome credit: el análisis anónimo ERA su gratis. Registro
// orgánico sin cookie jamás pasa por acá y conserva el welcome como siempre.
//
// Núcleo compartido: lo llaman el endpoint POST /api/analisis/claim (login y
// register por password, y la red de seguridad del provider) y el route handler
// /auth/callback (OAuth + confirmación de email) — un solo lugar donde vive la
// mecánica, tres capas idempotentes que la invocan.
//
// Idempotencia: el UPDATE exige `user_id IS NULL` + hash exacto. Un segundo
// claim con la misma cookie encuentra 0 filas y termina en no-op silencioso.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/api-helpers/anon-cap";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { reportarFalloQuery } from "@/lib/observabilidad";

export interface ClaimResult {
  claimed: number;
  /** Destino natural post-claim (el análisis adoptado). Null si no hubo claim. */
  redirect: string | null;
}

/** Contexto del request para el evento Lead de Meta (mejor match browser-side). */
export interface ClaimLeadCtx {
  eventSourceUrl: string;
  clientIp: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
}

/**
 * Adopta las filas anónimas del token y consume el welcome. `admin` DEBE ser un
 * client service-role (el UPDATE toca filas sin dueño; RLS no lo permitiría).
 * El Lead de Meta va aparte (`enviarLeadClaim`) para que el caller decida si
 * puede diferirlo (waitUntil) — perder un evento de Meta nunca debe demorar ni
 * romper un login.
 */
export async function claimAnalisisAnonimos(
  admin: SupabaseClient,
  user: User,
  anonToken: string,
): Promise<ClaimResult> {
  const hash = sha256Hex(anonToken);
  const creatorName =
    (user.user_metadata?.nombre as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    null;

  const { data: filas, error } = await admin
    .from("analisis")
    .update({
      user_id: user.id,
      // El hash se limpia: la ventana de claim de este token queda cerrada.
      // `charge_mode` sigue en 'anon_cap' — la marca de origen es permanente.
      anon_claim_token_hash: null,
      ...(creatorName ? { creator_name: creatorName } : {}),
    })
    .eq("anon_claim_token_hash", hash)
    .is("user_id", null)
    .select("id, tipo_analisis, ambas_role, ambas_group_id");
  reportarFalloQuery(error, { ruta: "lib/anon-claim", operacion: "adoptar-filas", userId: user.id });

  if (!filas || filas.length === 0) return { claimed: 0, redirect: null };

  // Decisión 1 (F2-1): el análisis anónimo CONSUME el welcome. Mismo patrón de
  // fila-asegurada + UPDATE condicional que chargeAnalysisCredit (lib/access) —
  // si el welcome ya estaba usado, el update encuentra 0 filas y no pasa nada.
  {
    const { error: upsertError } = await admin.from("user_credits").upsert(
      {
        user_id: user.id,
        credits: 0,
        subscription_status: "none",
        welcome_credit_used: false,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    reportarFalloQuery(upsertError, { ruta: "lib/anon-claim", operacion: "asegurar-fila-creditos", userId: user.id });
    const { error: welcomeError } = await admin
      .from("user_credits")
      .update({
        welcome_credit_used: true,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("welcome_credit_used", false);
    reportarFalloQuery(welcomeError, { ruta: "lib/anon-claim", operacion: "consumir-welcome-claim", userId: user.id });
  }

  // Destino: el par AMBAS va al comparativo; suelto, a su informe.
  const ltr = filas.find((f) => f.ambas_role === "ltr");
  const str = filas.find((f) => f.ambas_role === "str");
  let redirect: string;
  if (ltr && str) {
    redirect = `/analisis/comparativa?ltr=${ltr.id}&str=${str.id}`;
  } else {
    const f = filas[0];
    redirect = f.tipo_analisis === "short-term"
      ? `/analisis/renta-corta/${f.id}`
      : `/analisis/${f.id}`;
  }
  return { claimed: filas.length, redirect };
}

/**
 * Meta CAPI Lead — el usuario estrenó su gratis al reclamar (F2-1 decisión 3).
 * event_id `lead-<userId>`: idempotente aunque el claim se dispare desde más de
 * una capa. Espejo del Lead que las rutas de creación emiten con
 * chargeMode==='welcome' (la rama anónima no lo emite al crear — se muda acá).
 */
export async function enviarLeadClaim(user: User, ctx: ClaimLeadCtx): Promise<void> {
  if (!user.email) return;
  try {
    await sendMetaCapiEvent({
      eventName: "Lead",
      eventId: `lead-${user.id}`,
      email: user.email,
      ...ctx,
    });
  } catch (e) {
    console.error("[anon-claim] Meta CAPI Lead excepción:", e);
  }
}
