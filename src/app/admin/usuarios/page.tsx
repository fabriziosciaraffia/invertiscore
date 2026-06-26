import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient, type User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";
import { getLedgerBalances } from "@/lib/credits-grant";
import { resolveDisplayName } from "@/lib/welcome";
import { UsuariosTable, type UsuarioRow } from "./usuarios-table";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function AdminUsuariosPage() {
  // Gate idéntico al de /admin (page.tsx): getUser con el anon server client,
  // allowlist por ADMIN_EMAIL, redirect a /login o /dashboard.
  const supabaseAuth = createServerSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminUser(user.email)) redirect("/dashboard");

  const sb = admin();

  // ─── USUARIOS (paginar hasta agotar — listUsers tope 1000/página) ───
  // Una sola página truncaría la base; el buscador filtra client-side sobre las
  // filas cargadas, así que un usuario fuera del primer lote sería invisible e
  // inalcanzable. Acumulamos todas las páginas. Tope de seguridad: 50 páginas
  // (50k usuarios) → si se alcanza, seguimos con lo que haya (no rompemos).
  const PER_PAGE = 1000;
  const MAX_PAGES = 50;
  const users: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: usersList } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });
    const batch = usersList?.users ?? [];
    users.push(...batch);
    if (batch.length < PER_PAGE) break; // última página
  }
  const userIds = users.map((u) => u.id);

  // ─── SALDO: ledger vivo (batch) + user_credits legacy (batch) ───
  const ledgerMap = userIds.length
    ? await getLedgerBalances(userIds, sb)
    : new Map<string, number>();

  const { data: creditsRows } = userIds.length
    ? await sb
        .from("user_credits")
        .select("user_id, credits, is_unlimited, subscription_status, active_plan")
        .in("user_id", userIds)
    : { data: [] };
  const creditsMap = new Map<
    string,
    { credits: number; is_unlimited: boolean; subscription_status: string; active_plan: string | null }
  >();
  for (const c of (creditsRows ?? []) as Array<{
    user_id: string;
    credits: number | null;
    is_unlimited: boolean | null;
    subscription_status: string | null;
    active_plan: string | null;
  }>) {
    creditsMap.set(c.user_id, {
      credits: c.credits ?? 0,
      is_unlimited: c.is_unlimited ?? false,
      subscription_status: c.subscription_status ?? "none",
      active_plan: c.active_plan ?? null,
    });
  }

  // ─── ÚLTIMO ANÁLISIS por usuario (un query, primer hit por orden desc) ───
  const { data: analisisRows } = userIds.length
    ? await sb
        .from("analisis")
        .select("user_id, comuna, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const lastAnalisisMap = new Map<string, { comuna: string | null; created_at: string }>();
  for (const a of (analisisRows ?? []) as Array<{ user_id: string; comuna: string | null; created_at: string }>) {
    if (!lastAnalisisMap.has(a.user_id)) {
      lastAnalisisMap.set(a.user_id, { comuna: a.comuna, created_at: a.created_at });
    }
  }

  // ─── Armado de filas + orden por created_at del usuario desc ───
  const rows: UsuarioRow[] = users
    .map((u) => {
      const c = creditsMap.get(u.id);
      const saldo = (ledgerMap.get(u.id) ?? 0) + (c?.credits ?? 0);
      const last = lastAnalisisMap.get(u.id);
      return {
        id: u.id,
        nombre: resolveDisplayName(u.user_metadata, u.email),
        email: u.email ?? "",
        saldo,
        isUnlimited: c?.is_unlimited ?? false,
        subscriptionStatus: c?.subscription_status ?? "none",
        activePlan: c?.active_plan ?? null,
        lastComuna: last?.comuna ?? null,
        lastAnalisisAt: last?.created_at ?? null,
        createdAt: u.created_at ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Usuarios</h1>
            <p className="font-mono text-sm text-[var(--franco-text-muted)] mt-1">
              Mesa de operaciones · solo lectura
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] font-body"
          >
            ← Panel
          </Link>
        </div>

        <UsuariosTable rows={rows} />
      </div>
    </div>
  );
}
