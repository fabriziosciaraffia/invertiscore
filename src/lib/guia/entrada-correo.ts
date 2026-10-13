// ─────────────────────────────────────────────────────────────────────────────
// La entrada por el enlace del correo (13-oct-2026, semanal.ts › puedeEntrarPorCorreo): el servidor genera un enlace
// mágico para el dueño de la selección (`generateLink` NO manda correo) y lo verifica ahí mismo con su `token_hash`, con
// el cliente de la sesión de la ruta: la sesión queda en las cookies de la respuesta (el redirect del clic). Nunca se
// sigue el `action_link` (ese camino usa PKCE y redirects). Si algo falla, no entra y la ruta sigue como siempre
// (/semanal → «Entrar»). Se verifica que la sesión que quedó sea la del dueño; si no, se cierra.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";

export async function entrarConCorreo(admin: SupabaseClient, sesion: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) return false;
    const { data: link, error: eLink } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hash = link?.properties?.hashed_token;
    if (eLink || !hash) {
      reportarFalloQuery(eLink ?? new Error("generateLink sin hashed_token"), { ruta: "lib/guia/entrada-correo", operacion: "generar-enlace", userId });
      return false;
    }
    const tipo = (link.properties.verification_type === "signup" ? "signup" : "magiclink") as EmailOtpType;
    const { data: v, error: eV } = await sesion.auth.verifyOtp({ token_hash: hash, type: tipo });
    if (eV || v?.user?.id !== userId) {
      if (v?.user && v.user.id !== userId) await sesion.auth.signOut();
      reportarFalloQuery(eV ?? new Error("la sesión no es la del dueño"), { ruta: "lib/guia/entrada-correo", operacion: "verificar-enlace", userId });
      return false;
    }
    return true;
  } catch (e) {
    reportarFalloQuery(e, { ruta: "lib/guia/entrada-correo", operacion: "entrar", userId });
    return false;
  }
}
