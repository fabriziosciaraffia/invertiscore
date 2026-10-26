// ─────────────────────────────────────────────────────────────────────────────
// A QUIÉN NO SE LE MANDA UN CORREO (26-oct-2026, reporte del lunes). Las cuentas de prueba recibían el semanal —75
// envíos internos desde el 5-oct— y las de @refranco.ai, que no existen, rebotaban: 23 de los 33 rebotes del dominio.
// El filtro de cada cron (`cuentasPruebaSinCorreo`) cubría el semanal y el correo del día, pero no el informe listo,
// la bienvenida, «Quiero verlo», el pago ni la selección diaria. Ahora lo decide el único punto por donde sale todo
// correo (email.ts › enviarCorreo):
//   · una dirección de @refranco.ai que no es un buzón de Franco: nunca;
//   · una cuenta de prueba sin `recibe_correos`: nunca (las marcadas sí, salvo que sean de @refranco.ai);
//   · lo que va a un buzón de Franco (las alertas, el resumen de los crons) sale siempre, aunque hable de una cuenta de
//     prueba.
// Lo prueba el tier PAUTA-ARREGLOS.
// ─────────────────────────────────────────────────────────────────────────────

/** Los buzones de @refranco.ai que existen (reciben las alertas internas). */
export const BUZONES_FRANCO: readonly string[] = ["hola@refranco.ai"];

export type MotivoBloqueo = "dominio-propio" | "cuenta-de-prueba";

export function destinoBloqueado(to: string, userId: string | null | undefined, pruebaSinCorreo: ReadonlySet<string> | null): MotivoBloqueo | null {
  const correo = to.trim().toLowerCase();
  if (BUZONES_FRANCO.includes(correo)) return null;
  if (correo.endsWith("@refranco.ai")) return "dominio-propio";
  if (userId && pruebaSinCorreo?.has(userId)) return "cuenta-de-prueba";
  return null;
}

/** Las cuentas de prueba sin `recibe_correos`, con un minuto de caché. null si no se pudo leer (el correo sale). */
let guardadas: { ids: Set<string>; at: number } | null = null;
export async function cuentasDePruebaSinCorreo(): Promise<Set<string> | null> {
  if (guardadas && Date.now() - guardadas.at < 60_000) return guardadas.ids;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.from("test_accounts").select("user_id, recibe_correos");
    if (error) return guardadas?.ids ?? null;
    const ids = new Set((data ?? []).filter((r) => r.recibe_correos !== true).map((r) => r.user_id as string));
    guardadas = { ids, at: Date.now() };
    return ids;
  } catch {
    return guardadas?.ids ?? null;
  }
}
