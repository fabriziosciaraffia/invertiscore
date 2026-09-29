// Genera las plantillas de Supabase Auth desde la plantilla clara (src/lib/email/plantilla-clara.ts
// y src/lib/email/correos.ts), a docs/emails/. Uso: node --import tsx scripts/emails/generar-supabase-codigo.ts
// Cada archivo se pega en Supabase → Authentication → Email Templates:
//   · supabase-codigo.html        → «Confirm signup» Y «Magic Link» (el mismo HTML: {{ .Token }} y {{ .ConfirmationURL }})
//   · supabase-restablecer.html   → «Reset Password»
//   · supabase-cambio-correo.html → «Change Email Address»
// El tier CORREOS verifica que lo que está en docs/emails/ es exactamente lo que generan estas funciones.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLANTILLAS_SUPABASE, cabeceraSupabase } from "../../src/lib/email/supabase-plantillas";

for (const p of PLANTILLAS_SUPABASE) {
  const destino = join(__dirname, "..", "..", "docs", "emails", p.archivo);
  writeFileSync(destino, cabeceraSupabase(p.donde, p.asunto) + p.html(), "utf8");
  console.log("ok", destino);
}
