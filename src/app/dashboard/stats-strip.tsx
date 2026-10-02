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

import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
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
    <EnlaceCarga
      href={href}
      className="group flex flex-col gap-1 border-b border-[var(--franco-border)] px-4 py-2.5 no-underline transition-colors last:border-b-0 hover:bg-[var(--franco-elevated)] sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      <span className="text-[12px] font-medium text-[var(--franco-text-muted)]">
        {label}
      </span>
      {children}
      <span className="self-start border-b border-dotted border-[var(--franco-border-strong)] text-[12.5px] text-[var(--franco-text-muted)] group-hover:border-signal-red group-hover:text-signal-red">
        {hint}
      </span>
    </EnlaceCarga>
  );
}

export function StatsStrip({ stats, params }: { stats: DashboardStats; params: DashboardParams }) {
  const { por_modalidad: mod } = stats;

  return (
    <div className="my-5 grid grid-cols-1 overflow-hidden rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] sm:grid-cols-4">
      <Stat href={buildHref(params, { q: "", mod: "todas", v: "todos" })} label="Análisis" hint="ver todos">
        <span className="text-xl font-bold leading-tight tabular-nums text-[var(--franco-text)]">{stats.total}</span>
      </Stat>

      <Stat href={buildHref(params, { sort: "flujo", dir: "desc" })} label="Flujo positivo" hint="ordenar por flujo">
        <span className="text-xl font-bold leading-tight tabular-nums text-[var(--franco-text)]">
          {stats.flujo_positivo}
          <span className="text-[13px] font-normal text-[var(--franco-text-muted)]"> / {stats.total}</span>
        </span>
      </Stat>

      <Stat href={buildHref(params, { sort: "score", dir: "desc" })} label="Puntaje promedio" hint="ordenar por puntaje">
        <span className="text-xl font-bold leading-tight tabular-nums text-[var(--franco-text)]">
          {stats.score_promedio}
        </span>
      </Stat>

      <Stat href={buildHref(params, { mod: "short-term" })} label="Por modalidad" hint="filtrar por modalidad">
        <span className="flex gap-2.5 text-[13px] font-medium text-[var(--franco-text)]">
          <span>
            {mod.long_term} <span className="text-[12.5px] font-normal text-[var(--franco-text-muted)]">larga</span>
          </span>
          <span>
            {mod.short_term} <span className="text-[12.5px] font-normal text-[var(--franco-text-muted)]">corta</span>
          </span>
          <span>
            {mod.ambas} <span className="text-[12.5px] font-normal text-[var(--franco-text-muted)]">ambas</span>
          </span>
        </span>
      </Stat>
    </div>
  );
}
