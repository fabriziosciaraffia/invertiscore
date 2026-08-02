import { SEGMENTOS, fmtSegmento, type AdminSegmento } from "@/lib/admin-rpc";

/**
 * Búsqueda + filtro por segmento. Es un form GET plano: sin estado de cliente, sin
 * endpoint nuevo, y el resultado queda en la URL (compartible, con historial).
 *
 * `test` viaja como hidden para que filtrar no apague el toggle de cuentas de
 * prueba, y `page` se omite a propósito: cualquier filtro nuevo vuelve a la 1.
 */
export function UsuariosFiltros({
  search,
  segmento,
  includeTest,
}: {
  search: string;
  segmento: AdminSegmento | null;
  includeTest: boolean;
}) {
  return (
    <form method="GET" action="/admin/usuarios" className="flex flex-1 flex-wrap items-center gap-2.5">
      {includeTest && <input type="hidden" name="test" value="1" />}

      <label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5">
        <span aria-hidden="true" className="font-mono text-xs text-[var(--franco-text-muted)]">
          ⌕
        </span>
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por correo…"
          aria-label="Buscar usuarios por correo"
          className="w-full border-0 bg-transparent font-body text-[13px] text-[var(--franco-text)] outline-none placeholder:text-[var(--franco-text-muted)]"
        />
      </label>

      <select
        name="segmento"
        defaultValue={segmento ?? ""}
        aria-label="Filtrar por segmento"
        className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[var(--franco-text)] outline-none"
      >
        <option value="">Todos los segmentos</option>
        {SEGMENTOS.map((s) => (
          <option key={s} value={s}>
            {fmtSegmento(s)}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-lg border border-[var(--franco-text)] bg-[var(--franco-text)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[var(--franco-bg)] transition-opacity hover:opacity-90"
      >
        Filtrar
      </button>
    </form>
  );
}
