/**
 * ARCHIVO — la pieza que resuelve el problema de escala.
 *
 * Desktop: tabla densa (filas de 40px, ~16 visibles) con búsqueda siempre
 * visible, chips de modalidad y veredicto con conteos reales, y orden por
 * columna. Mobile: la misma información como lista compacta, no como tabla.
 *
 * Todo el estado vive en la URL (`?q=&mod=&v=&sort=&dir=&page=`). Los chips y
 * los headers de columna son <Link>, así que filtran y ordenan sin JavaScript;
 * lo único que necesita cliente es el input de búsqueda (debounce) y el borrado.
 *
 * Sin agrupación por propiedad todavía — eso es el goal 3. Sin checkboxes ni
 * barra flotante de comparar: murieron con el dashboard viejo.
 */

import Link from "next/link";
import type { AnalisisDashboardRow, DashboardStats } from "@/lib/dashboard-query";
import type { Veredicto } from "@/lib/types";
import {
  buildHref,
  displayDireccion,
  fmtCap,
  fmtCLPSigned,
  fmtFechaCorta,
  fmtMultiplicador,
  hrefAnalisis,
  hrefPdf,
  modalidadLabel,
  sinDireccion,
  sortHref,
  veredictoDisplay,
  PAGE_SIZE,
  type DashboardParams,
} from "./dashboard-helpers";
import { ModChip, VerdictBadge, ZoneLabel, scoreColor } from "./dashboard-ui";
import { ArchiveSearch } from "./archive-search";
import { RowActions } from "./row-actions";
import type { DashboardSortKey } from "@/lib/dashboard-query";

interface Props {
  rows: AnalisisDashboardRow[];
  siblings: Map<string, AnalisisDashboardRow>;
  total: number;
  hasMore: boolean;
  params: DashboardParams;
  stats: DashboardStats;
}

// ─── Chips ──────────────────────────────────────────────────────────────────

function Chip({ href, activo, children, rojo = false }: {
  href: string; activo: boolean; children: React.ReactNode; rojo?: boolean;
}) {
  const base = "whitespace-nowrap rounded-[7px] border px-2.5 py-1 font-body text-xs no-underline transition-colors";
  if (activo && rojo) {
    return (
      <Link
        href={href}
        className={`${base} font-medium`}
        style={{
          color: "var(--signal-red)",
          borderColor: "color-mix(in srgb, var(--signal-red) 40%, transparent)",
          background: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
          borderWidth: 1.5,
        }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${
        activo
          ? "border-[var(--franco-text)] bg-[var(--franco-text)] font-medium text-[var(--franco-bg)]"
          : "border-[var(--franco-border)] text-[var(--franco-text-secondary)] hover:border-[var(--franco-border-hover)]"
      }`}
    >
      {children}
    </Link>
  );
}

function Conteo({ n }: { n: number }) {
  return <span className="ml-1.5 font-mono text-[10px] opacity-65">{n}</span>;
}

// ─── Header de columna ordenable ────────────────────────────────────────────

function Th({
  params, sortKey, label, num = false, className = "",
}: {
  params: DashboardParams; sortKey?: DashboardSortKey; label: string; num?: boolean; className?: string;
}) {
  const activo = sortKey !== undefined && params.sort === sortKey;
  const cls = `border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))] px-2.5 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.09em] ${
    num ? "text-right" : "text-left"
  } ${activo ? "text-[var(--franco-text)]" : "text-[var(--franco-text-muted)]"} ${className}`;

  if (!sortKey) {
    return <th scope="col" className={cls}>{label}</th>;
  }
  return (
    <th scope="col" className={cls} aria-sort={activo ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={sortHref(params, sortKey)} className="whitespace-nowrap text-inherit no-underline hover:text-[var(--franco-text)]">
        {label}
        <span className={`ml-1 text-[8px] ${activo ? "" : "opacity-0"}`} aria-hidden="true">
          {activo && params.dir === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
  );
}

// ─── Tabla ──────────────────────────────────────────────────────────────────

export function Archive({ rows, siblings, total, hasMore, params, stats }: Props) {
  const { por_modalidad: mod, por_veredicto: ver } = stats;
  const filtrando = params.q !== "" || params.mod !== "todas" || params.v !== "todos";

  const veredictos: Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];

  // El `id` es real: los <Link> de chips y headers apuntan a #archivo para que
  // filtrar u ordenar deje la tabla a la vista y no el tope de la página.
  return (
    <section id="archivo" aria-labelledby="archivo-label" className="scroll-mt-20">
      <ZoneLabel id="archivo-label">Archivo</ZoneLabel>

      <div className="overflow-hidden rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-[var(--franco-border)] p-3">
          <ArchiveSearch params={params} />

          <div className="flex flex-wrap gap-1.5">
            <Chip href={buildHref(params, { mod: "todas" })} activo={params.mod === "todas"}>
              Todas<Conteo n={stats.total} />
            </Chip>
            <Chip href={buildHref(params, { mod: "long-term" })} activo={params.mod === "long-term"}>
              Renta larga<Conteo n={mod.long_term} />
            </Chip>
            <Chip href={buildHref(params, { mod: "short-term" })} activo={params.mod === "short-term"}>
              Renta corta<Conteo n={mod.short_term} />
            </Chip>
            <Chip href={buildHref(params, { mod: "ambas" })} activo={params.mod === "ambas"}>
              Ambas<Conteo n={mod.ambas} />
            </Chip>
          </div>

          <span className="hidden h-5 w-px bg-[var(--franco-border)] sm:block" aria-hidden="true" />

          <div className="flex flex-wrap gap-1.5">
            {veredictos.map((v) => (
              <Chip
                key={v}
                href={buildHref(params, { v: params.v === v ? "todos" : v })}
                activo={params.v === v}
                rojo={v === "BUSCAR OTRA"}
              >
                {v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajusta supuestos" : "Buscar otra"}
                <Conteo n={ver[v] ?? 0} />
              </Chip>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
              Ningún análisis coincide con este filtro.
            </p>
            {filtrando && (
              <Link
                href={buildHref(params, { q: "", mod: "todas", v: "todos" })}
                className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.08em] text-signal-red no-underline"
              >
                Limpiar filtros →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop: tabla densa ── */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">Archivo de análisis</caption>
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <Th params={params} label="Dirección" />
                    <Th params={params} label="Comuna" />
                    <Th params={params} label="Mod." />
                    <Th params={params} label="Veredicto" />
                    <Th params={params} sortKey="score" label="Score" num />
                    <Th params={params} sortKey="flujo" label="Flujo" num />
                    <Th params={params} sortKey="cap" label="Cap" num />
                    <Th params={params} sortKey="multiplicador" label="Retorno" num />
                    <Th params={params} sortKey="fecha" label="Fecha" num />
                    <th scope="col" className="border-b border-[var(--franco-border-hover)] bg-[var(--franco-sunken,var(--franco-bg))]">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
                    const flujo = Number(row.flujo);
                    const abrir = hrefAnalisis(row, str?.id);
                    return (
                      <tr
                        key={row.id}
                        className="group relative border-b border-[var(--franco-border)] hover:bg-[var(--franco-elevated)]"
                      >
                        <td className="h-10 truncate px-2.5 align-middle">
                          <span className="flex items-center gap-2">
                            <Link
                              href={abrir}
                              className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-[var(--franco-text)] no-underline"
                            >
                              {displayDireccion(row)}
                            </Link>
                            {sinDireccion(row) && (
                              <span className="shrink-0 font-mono text-[8px] tracking-[0.05em] text-[var(--franco-text-muted)]">
                                SIN DIRECCIÓN
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="h-10 truncate px-2.5 align-middle font-body text-[13px] text-[var(--franco-text-muted)]">
                          {row.comuna}
                        </td>
                        <td className="h-10 px-2.5 align-middle">
                          <ModChip label={modalidadLabel(row)} />
                        </td>
                        <td className="h-10 px-2.5 align-middle">
                          <VerdictBadge verdict={veredictoDisplay(row)} mini />
                        </td>
                        <td className="h-10 px-2.5 text-right align-middle">
                          <span className="font-mono text-[13px] font-bold" style={{ color: scoreColor(row.score_efectivo) }}>
                            {row.score_efectivo}
                          </span>
                        </td>
                        <td
                          className="h-10 whitespace-nowrap px-2.5 text-right align-middle font-mono text-xs font-medium"
                          style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
                        >
                          {fmtCLPSigned(flujo)}
                        </td>
                        <td className="h-10 px-2.5 text-right align-middle font-mono text-xs font-medium text-[var(--franco-text)]">
                          {fmtCap(row.cap_rate === null ? null : Number(row.cap_rate))}
                        </td>
                        <td className="h-10 px-2.5 text-right align-middle font-mono text-xs font-medium text-[var(--franco-text)]">
                          {fmtMultiplicador(row.multiplicador === null ? null : Number(row.multiplicador))}
                        </td>
                        <td className="h-10 whitespace-nowrap px-2.5 text-right align-middle font-mono text-xs text-[var(--franco-text-muted)]">
                          {fmtFechaCorta(row.created_at)}
                        </td>
                        <td className="h-10 px-2.5 align-middle">
                          {/* Capa que hace clickeable TODA la fila. Va acá y no
                              como ::after del link de la dirección: esa celda
                              trunca (overflow hidden) y recortaría el overlay a
                              su propio ancho. aria-hidden porque el link
                              accesible es el de la dirección. */}
                          <Link
                            href={abrir}
                            aria-hidden="true"
                            tabIndex={-1}
                            className="absolute inset-0 z-0"
                          />
                          <RowActions
                            id={row.id}
                            groupId={row.ambas_group_id}
                            hrefAbrir={abrir}
                            hrefPdf={hrefPdf(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile: lista compacta, no tabla ── */}
            <ul className="md:hidden">
              {rows.map((row) => {
                const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
                const flujo = Number(row.flujo);
                const abrir = hrefAnalisis(row, str?.id);
                return (
                  <li key={row.id} className="relative flex items-center gap-3 border-b border-[var(--franco-border)] px-3.5 py-3 last:border-b-0">
                    {/* Mismo overlay que en la tabla: el link visible trunca y
                        recortaría su propio ::after. */}
                    <Link href={abrir} aria-hidden="true" tabIndex={-1} className="absolute inset-0 z-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={abrir}
                        className="relative z-10 block truncate font-heading text-sm font-bold text-[var(--franco-text)] no-underline"
                      >
                        {displayDireccion(row)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">{row.comuna}</span>
                        <ModChip label={modalidadLabel(row)} />
                        <VerdictBadge verdict={veredictoDisplay(row)} mini />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className="font-mono text-[13px] font-medium"
                        style={{ color: flujo < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
                      >
                        {fmtCLPSigned(flujo)}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase text-[var(--franco-text-muted)]">
                        {row.score_efectivo} · {fmtFechaCorta(row.created_at)}
                      </div>
                    </div>
                    <RowActions
                      id={row.id}
                      groupId={row.ambas_group_id}
                      hrefAbrir={abrir}
                      hrefPdf={hrefPdf(row)}
                      variant="menu"
                    />
                  </li>
                );
              })}
            </ul>

            {/* ── Pie ── */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--franco-border)] px-3.5 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                Mostrando {rows.length} de {total}
                {filtrando ? " que coinciden" : ""}
              </span>
              {hasMore && (
                <Link
                  href={buildHref(params, { page: params.page + 1 })}
                  className="rounded-[7px] border border-[var(--franco-border-hover)] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text)] no-underline hover:border-[var(--franco-border-strong)]"
                >
                  Cargar {PAGE_SIZE} más ↓
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
