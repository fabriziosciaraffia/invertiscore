import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Envía el welcome email una sola vez por usuario, de forma idempotente y
 * desacoplada del cliente.
 *
 * La fuente de verdad es la columna user_credits.welcome_email_sent (NO la
 * mera existencia de la fila, que ya no es confiable: complete-onboarding y
 * access.ts crean la fila antes de que el usuario llegue al dashboard).
 *
 * Envía si: la fila no existe, o existe con welcome_email_sent = false.
 * No hace nada si welcome_email_sent ya es true.
 *
 * fire-and-forget seguro: nunca tira. Cualquier error se loguea y se ignora
 * para no romper el render del dashboard/onboarding.
 *
 * @param name nombre completo del usuario (puede venir null); sendWelcomeEmail
 *             se encarga del split para el saludo con el primer nombre.
 */
export async function ensureWelcomeEmail(
  userId: string,
  email: string | null | undefined,
  name: string | null,
): Promise<void> {
  try {
    if (!userId || !email) return;

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("user_credits")
      .select("welcome_email_sent")
      .eq("user_id", userId)
      .single();

    // Ya enviado → no-op.
    if (existing?.welcome_email_sent === true) return;

    await sendWelcomeEmail(email, name ?? "");

    // Marcar como enviado sin pisar onboarding_completed ni el balance de
    // créditos. Update si la fila ya existe; insert si todavía no.
    if (existing) {
      await admin
        .from("user_credits")
        .update({ welcome_email_sent: true })
        .eq("user_id", userId);
    } else {
      await admin.from("user_credits").insert({
        user_id: userId,
        credits: 0,
        subscription_status: "none",
        welcome_email_sent: true,
      });
    }
  } catch (error) {
    console.error(
      "ensureWelcomeEmail error:",
      error instanceof Error ? error.message : "Unknown",
    );
  }
}
