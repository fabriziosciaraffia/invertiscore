// Las plantillas de Supabase Auth que se pegan en el panel (Authentication → Email Templates), todas
// desde la plantilla clara. Las genera scripts/emails/generar-supabase-codigo.ts a docs/emails/ y el
// tier CORREOS verifica que lo pegable es exactamente esto.
import { correoCodigoSupabase } from "./plantilla-clara";
import { correoCambioCorreoSupabase, correoRestablecerSupabase } from "./correos";

export const PLANTILLAS_SUPABASE = [
  { archivo: "supabase-codigo.html", donde: "«Confirm signup» y «Magic Link»", asunto: "Tu código para entrar a Franco: {{ .Token }}", html: correoCodigoSupabase },
  { archivo: "supabase-restablecer.html", donde: "«Reset Password»", asunto: "Restablece tu contraseña de Franco", html: correoRestablecerSupabase },
  { archivo: "supabase-cambio-correo.html", donde: "«Change Email Address»", asunto: "Confirma tu correo nuevo en Franco", html: correoCambioCorreoSupabase },
] as const;

export const cabeceraSupabase = (donde: string, asunto: string) => `<!-- GENERADO por scripts/emails/generar-supabase-codigo.ts desde src/lib/email/. No se edita a mano.
     Se pega en Supabase → Authentication → Email Templates, en ${donde}. Asunto: «${asunto}». -->
`;
