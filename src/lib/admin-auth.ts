/**
 * Gate de admin reutilizable (Panel admin · Fase 2 · Paso 0).
 *
 * Extrae el gate que estaba copiado en 5 lugares (2 pages + /api/admin/action +
 * /api/admin/documentos/retry, más el service-role client inline en cada uno).
 * Un solo lugar donde se decide "¿este request es de un admin?" significa que
 * ninguna acción nueva de Fase 2 puede olvidarse de preguntarlo.
 *
 * ORDEN INVARIANTE: autenticar con el ANON server client (cookies de sesión) y
 * recién DESPUÉS construir el client de service role. Nunca al revés — el
 * service role bypassea RLS completo, así que no debe existir antes de saber
 * que hay un admin del otro lado.
 *
 * Dos salidas porque hay dos contextos con comportamiento distinto, y el
 * refactor no debe cambiar ninguno de los dos:
 *   - requireAdmin()      → route handlers: 403 JSON { error: "No autorizado" }.
 *   - requireAdminPage()  → Server Components: redirect /login | /dashboard.
 *
 * La identidad del admin (`adminUser.id` + `adminUser.email`) sale de acá y es
 * lo que alimenta el audit log — ver `withAdminAction` en admin-audit.ts.
 */

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  createClient as createServiceClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

/** Admin autenticado + client de service role listo para escribir. */
export type AdminContext = {
  adminUser: User;
  sb: SupabaseClient;
};

/**
 * Client de service role (bypassea RLS). Antes vivía inline y duplicado en cada
 * page/route admin; acá queda uno solo. NO exportarlo a componentes de cliente:
 * lee SUPABASE_SERVICE_ROLE_KEY, que es server-only.
 */
export function createAdminServiceClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AdminGate =
  | ({ ok: true } & AdminContext)
  | { ok: false; response: NextResponse };

/**
 * Gate para route handlers. Uso:
 *
 *   const gate = await requireAdmin();
 *   if (!gate.ok) return gate.response;
 *   const { adminUser, sb } = gate;
 *
 * El 403 replica textual el que devolvían las rutas admin existentes
 * ({ error: "No autorizado" }, status 403) — el refactor no cambia el contrato.
 */
export async function requireAdmin(): Promise<AdminGate> {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user || !isAdminUser(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { ok: true, adminUser: user, sb: createAdminServiceClient() };
}

/**
 * Gate para Server Components (`/admin`, `/admin/usuarios`, `/admin/usuarios/[id]`).
 * Mismos redirects que el gate inline que reemplaza: sin sesión → /login, con
 * sesión pero sin allowlist → /dashboard. `redirect()` lanza, así que el retorno
 * solo ocurre para un admin válido.
 */
export async function requireAdminPage(): Promise<AdminContext> {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminUser(user.email)) redirect("/dashboard");

  return { adminUser: user, sb: createAdminServiceClient() };
}
