// ─────────────────────────────────────────────────────────────────────────────
// Cliente Supabase con SERVICE ROLE, sin cookies.
//
// Para lecturas y escrituras del servidor que no dependen de la sesión de
// nadie: páginas ISR públicas (landing, comunas), rutas edge (OG), crons y
// helpers de acceso. Hasta el 07-sep-2026 el mismo `createClient(URL,
// SERVICE_ROLE)` vivía copiado en cuatro archivos; ahora vive acá.
//
// NUNCA importarlo desde un componente cliente ni desde una página que además
// lee `cookies()`: para lo que depende de la sesión está `./server` (SSR con
// cookies) y `./client` (browser con anon key).
//
// Sin caché de instancia a propósito: `createClient` es barato y una instancia
// por request evita compartir estado entre invocaciones en runtimes que
// reutilizan el proceso (Fluid Compute) y en edge.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
