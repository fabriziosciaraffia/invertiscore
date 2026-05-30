import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Resuelve el nombre a saludar desde el user de Supabase, con fallback en
 * cadena según el proveedor de auth:
 *   - Google OAuth → user_metadata.full_name / name
 *   - email+password → user_metadata.nombre (lo setea el signUp en /register)
 *   - sin nombre en metadata → se deriva del email (parte antes del @,
 *     normalizada: separadores → espacios, capitalizada)
 *   - si todo falla → "" (el saludo cae a "Hola," sin nombre)
 * sendWelcomeEmail aplica el split del primer nombre al resultado.
 */
export function resolveDisplayName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const m = metadata ?? {};
  const fromMeta =
    (m.full_name as string) || (m.name as string) || (m.nombre as string) || "";
  if (fromMeta.trim()) return fromMeta.trim();

  // Derivar del email: "juan.perez@gmail.com" → "Juan Perez".
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "";
  const cleaned = local
    .replace(/[._\-+]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Envía el welcome email una sola vez por usuario, de forma idempotente,
 * desacoplada del cliente y SEGURA ante concurrencia (race condition).
 *
 * La fuente de verdad es la columna user_credits.welcome_email_sent (NO la
 * mera existencia de la fila, que no es confiable: complete-onboarding y
 * access.ts crean la fila antes de que el usuario llegue al dashboard).
 *
 * Antes el flujo era check-then-act NO atómico (leer → si false enviar →
 * marcar true): con varios refresh rápidos del dashboard, N requests leían
 * sent=false antes de que alguna marcara true → todas enviaban → email
 * duplicado. Ahora el flag se marca ATÓMICAMENTE antes de enviar:
 *
 *   1. Garantiza la fila sin enviar (INSERT ... ON CONFLICT DO NOTHING).
 *   2. UPDATE condicional `SET welcome_email_sent=true WHERE ... AND
 *      welcome_email_sent=false`, pidiendo las filas afectadas. Postgres
 *      bloquea la fila: con N requests concurrentes exactamente una matchea
 *      el WHERE (false) y recibe la fila; las demás afectan 0 filas.
 *   3. Envía SOLO la request ganadora (la que flipeó el flag).
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

    // 1) Garantizar la fila SIN enviar ni pisar otros campos.
    //    INSERT ... ON CONFLICT DO NOTHING (ignoreDuplicates): si la fila ya
    //    existe no toca onboarding_completed ni credits; si no existe la crea
    //    con welcome_email_sent=false (el claim del paso 2 la flipea).
    await admin
      .from("user_credits")
      .upsert(
        {
          user_id: userId,
          credits: 0,
          subscription_status: "none",
          welcome_email_sent: false,
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    // 2) Claim atómico: marcar welcome_email_sent=true SOLO si estaba en false.
    //    El WHERE adicional sobre welcome_email_sent hace el check-and-set
    //    atómico a nivel de fila en Postgres. .select() devuelve las filas
    //    efectivamente actualizadas.
    const { data: claimed } = await admin
      .from("user_credits")
      .update({ welcome_email_sent: true })
      .eq("user_id", userId)
      .eq("welcome_email_sent", false)
      .select("user_id");

    // 3) Enviar SOLO la request ganadora (la que afectó 1 fila). Si afectó 0,
    //    otra request ya ganó el claim (o ya estaba enviado) → no-op.
    if (Array.isArray(claimed) && claimed.length === 1) {
      await sendWelcomeEmail(email, name ?? "");
    }
  } catch (error) {
    console.error(
      "ensureWelcomeEmail error:",
      error instanceof Error ? error.message : "Unknown",
    );
  }
}
