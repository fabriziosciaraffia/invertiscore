import { requireAdminPage } from "@/lib/admin-auth";
import {
  adminListUsers,
  esSegmentoValido,
  leerIncludeTest,
  saldoDeFila,
  type AdminSegmento,
} from "@/lib/admin-rpc";
import { fmtNumber } from "@/lib/admin-format";
import { TestToggle } from "../test-toggle";
import { UsuariosFiltros } from "./usuarios-filtros";
import { UsuariosTable, type UsuarioRow } from "./usuarios-table";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

type SP = Record<string, string | string[] | undefined>;

function primerValor(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Arma una URL de esta misma página cambiando solo los parámetros indicados. */
function urlCon(sp: SP, cambios: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = primerValor(v);
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `/admin/usuarios?${s}` : "/admin/usuarios";
}

export default async function AdminUsuariosPage({ searchParams }: { searchParams: SP }) {
  // Gate compartido (src/lib/admin-auth.ts): getUser con el anon server client,
  // allowlist por ADMIN_EMAIL, redirect a /login o /dashboard, y solo entonces
  // el client de service role — que es el único con grant sobre las RPCs.
  const { sb } = await requireAdminPage();

  // ─── Estado de la vista: todo en la URL ───
  // Antes la búsqueda era client-side sobre las filas ya cargadas, lo que obligaba
  // a traer la base entera de usuarios para que el buscador no mintiera. Ahora el
  // filtro viaja a la RPC y solo vuelve la página pedida.
  const search = primerValor(searchParams.q).trim();
  const segParam = primerValor(searchParams.segmento);
  const segment: AdminSegmento | null = esSegmentoValido(segParam) ? segParam : null;
  const includeTest = leerIncludeTest(searchParams.test);
  const paginaPedida = Number.parseInt(primerValor(searchParams.page), 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  // ─── UNA sola llamada: join, filtro, orden y paginación del lado del servidor ───
  const { rows: rpcRows, total } = await adminListUsers(sb, {
    search: search || null,
    segment,
    includeTest,
    limit: POR_PAGINA,
    offset: (pagina - 1) * POR_PAGINA,
  });

  const rows: UsuarioRow[] = rpcRows.map((r) => ({
    id: r.user_id,
    email: r.email ?? "",
    // Saldo con el mismo criterio que getAvailableCredits: ledger vivo + legacy.
    saldo: saldoDeFila(r),
    isUnlimited: r.is_unlimited ?? false,
    isTestUser: r.is_test_user ?? false,
    segmento: r.segmento ?? "registrado",
    analisisTotal: r.analisis_total ?? 0,
    ultimoAnalisis: r.ultimo_analisis,
    createdAt: r.created_at,
  }));

  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);
  const hayAnterior = pagina > 1;
  const haySiguiente = hasta < total;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Usuarios</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">Mesa de operaciones</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <UsuariosFiltros search={search} segmento={segment} includeTest={includeTest} />
        <TestToggle includeTest={includeTest} href={urlCon(searchParams, { test: includeTest ? null : "1", page: null })} />
      </div>

      <UsuariosTable rows={rows} />

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--franco-border)] pt-3.5">
        <span className="font-mono text-[11px] text-[var(--franco-text-muted)]">
          {total === 0 ? "Sin resultados" : `${fmtNumber(desde)}–${fmtNumber(hasta)} de ${fmtNumber(total)}`}
        </span>
        <div className="flex gap-2">
          <PagerLink href={urlCon(searchParams, { page: String(pagina - 1) })} enabled={hayAnterior}>
            ← Anterior
          </PagerLink>
          <PagerLink href={urlCon(searchParams, { page: String(pagina + 1) })} enabled={haySiguiente}>
            Siguiente →
          </PagerLink>
        </div>
      </div>
    </>
  );
}

function PagerLink({ href, enabled, children }: { href: string; enabled: boolean; children: React.ReactNode }) {
  const base =
    "rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors";
  if (!enabled) {
    return (
      <span
        aria-disabled="true"
        className={`${base} cursor-default border-[var(--franco-border)] text-[var(--franco-border-strong)]`}
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      className={`${base} border-[var(--franco-border)] bg-[var(--franco-card)] text-[var(--franco-text)] hover:border-[var(--franco-border-hover)]`}
    >
      {children}
    </a>
  );
}
