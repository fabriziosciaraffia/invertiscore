/**
 * Franja de stats accionables. Los 4 números salen de la RPC `dashboard_stats`
 * en UNA llamada, y son agregados sobre TODOS los análisis del usuario — no
 * sobre la página visible del archivo.
 *
 * Cada stat es un Link: clickear navega con el filtro puesto en la URL, sin
 * estado de cliente. La affordance es explícita (la línea de abajo dice qué
 * hace) porque una cifra clickeable sin señal no se descubre.
 *
 * «Flujo positivo» no tiene filtro server-side propio: la vista no expone un
 * predicado de flujo ≥ 0 como columna filtrable, así que esa tarjeta ordena por
 * flujo descendente, que deja arriba exactamente esas propiedades. Es la
 * desviación consciente del contrato, anotada en el reporte.
 */

import Link from "next/link";
import type { DashboardStats } from "@/lib/dashboard-query";
import { buildHref, type DashboardParams } from "./dashboard-helpers";

function Stat({
  href,
  label,
  hint,
  children,
}: {
  href: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 border-b border-[var(--franco-border)] px-4 py-2.5 no-underline transition-colors last:border-b-0 hover:bg-[var(--franco-elevated)] sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
        {label}
      </span>
      {children}
      <span className="self-start border-b border-dotted border-[var(--franco-border-strong)] font-body text-[10px] text-[var(--franco-text-muted)] group-hover:border-signal-red group-hover:text-signal-red">
        {hint}
      </span>
    </Link>
  );
}

export function StatsStrip({ stats, params }: { stats: DashboardStats; params: DashboardParams }) {
  const { por_modalidad: mod } = stats;

  return (
    <div className="my-5 grid grid-cols-1 overflow-hidden rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] sm:grid-cols-4">
      <Stat href={buildHref(params, { q: "", mod: "todas", v: "todos" })} label="Análisis" hint="ver todos">
        <span className="font-mono text-xl font-bold leading-tight text-[var(--franco-text)]">{stats.total}</span>
      </Stat>

      <Stat href={buildHref(params, { sort: "flujo", dir: "desc" })} label="Flujo positivo" hint="ordenar por flujo">
        <span className="font-mono text-xl font-bold leading-tight text-[var(--franco-text)]">
          {stats.flujo_positivo}
          <span className="text-xs font-normal text-[var(--franco-text-muted)]"> / {stats.total}</span>
        </span>
      </Stat>

      <Stat href={buildHref(params, { sort: "score", dir: "desc" })} label="Score promedio" hint="ordenar por score">
        <span className="font-mono text-xl font-bold leading-tight text-[var(--franco-text)]">
          {stats.score_promedio}
        </span>
      </Stat>

      <Stat href={buildHref(params, { mod: "short-term" })} label="Por modalidad" hint="filtrar por modalidad">
        <span className="flex gap-2.5 font-mono text-[13px] font-medium text-[var(--franco-text)]">
          <span>
            {mod.long_term} <i className="text-[9px] not-italic tracking-[0.06em] text-[var(--franco-text-muted)]">LARGA</i>
          </span>
          <span>
            {mod.short_term} <i className="text-[9px] not-italic tracking-[0.06em] text-[var(--franco-text-muted)]">CORTA</i>
          </span>
          <span>
            {mod.ambas} <i className="text-[9px] not-italic tracking-[0.06em] text-[var(--franco-text-muted)]">AMBAS</i>
          </span>
        </span>
      </Stat>
    </div>
  );
}
