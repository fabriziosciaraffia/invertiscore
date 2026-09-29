// Genera docs/emails/supabase-codigo.html desde la plantilla clara (src/lib/email/plantilla-clara.ts).
// Uso: node --import tsx scripts/emails/generar-supabase-codigo.ts
// El archivo generado se pega en Supabase → Authentication → Email Templates, en «Confirm signup»
// Y en «Magic Link» (el mismo HTML sirve para los dos: {{ .Token }} y {{ .ConfirmationURL }}).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { correoCodigoSupabase } from "../../src/lib/email/plantilla-clara";

const destino = join(__dirname, "..", "..", "docs", "emails", "supabase-codigo.html");
const cabecera = `<!-- GENERADO por scripts/emails/generar-supabase-codigo.ts desde src/lib/email/plantilla-clara.ts.
     No se edita a mano. Se pega en Supabase → Authentication → Email Templates, en «Confirm signup»
     y en «Magic Link». Asunto sugerido: «Tu código para entrar a Franco: {{ .Token }}». -->
`;
writeFileSync(destino, cabecera + correoCodigoSupabase(), "utf8");
console.log("ok", destino);
