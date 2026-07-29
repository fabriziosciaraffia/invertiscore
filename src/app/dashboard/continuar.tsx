/**
 * Zona CONTINUAR — el uso dominante del dashboard es retomar, no explorar.
 *
 * 1 card hero (el análisis más reciente por `created_at`) + 3 compactas. La
 * recencia es por creación: `analisis` no tiene `updated_at` ni marca de última
 * apertura (ver la nota del contrato en assets-export/mockup-dashboard.html).
 *
 * Siempre muestra los 4 más recientes del usuario, sin importar los filtros del
 * archivo: es un atajo, no una vista de la consulta.
 */

import Link from "next/link";
import type { AnalisisDashboardRow } from "@/lib/dashboard-query";
import {
  displayDireccion,
  fmtCLPSigned,
  fmtFechaRelativa,
  hrefAnalisis,
  modalidadLabel,
  veredictoDisplay,
} from "./dashboard-helpers";
import { ModChip, ScoreRing, VerdictBadge, ZoneLabel } from "./dashboard-ui";

interface Props {
  rows: AnalisisDashboardRow[];
  siblings: Map<string, AnalisisDashboardRow>;
  /**
   * Primera frase del `resumen` del análisis hero. No sale de la vista
   * (`analisis_dashboard` no proyecta `resumen`, que es texto largo y no tiene
   * sentido traer por fila): page.tsx lo pide aparte para UNA sola fila.
   */
  heroResumen?: string | null;
}

function Flujo({ value, className = "" }: { value: number; className?: string }) {
  const neg = value < 0;
  return (
    <span className={`text-right ${className}`}>
      <span className="mb-0.5 block font-mono text-[8px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
        Flujo
      </span>
      <span
        className="font-mono text-sm font-medium"
        style={{ color: neg ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {fmtCLPSigned(value)}
      </span>
    </span>
  );
}

export function Continuar({ rows, siblings, heroResumen }: Props) {
  if (rows.length === 0) return null;

  const [hero, ...resto] = rows;
  const heroStr = hero.ambas_group_id ? siblings.get(hero.ambas_group_id) : undefined;
  const heroFlujo = heroStr ? Math.max(Number(hero.flujo), Number(heroStr.flujo)) : Number(hero.flujo);

  return (
    <section aria-labelledby="continuar-label">
      <ZoneLabel id="continuar-label">Continuar</ZoneLabel>

      {/* ── Card hero: el último análisis, visualmente dominante ── */}
      <Link
        href={hrefAnalisis(hero, heroStr?.id)}
        className="franco-card-target group mb-2.5 flex items-center gap-5 rounded-2xl border border-[var(--franco-border-hover)] bg-[var(--franco-elevated)] p-4 px-5 no-underline"
      >
        <ScoreRing score={hero.score_efectivo} size={56} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-heading text-[19px] font-bold tracking-[-0.01em] text-[var(--franco-text)]">
              {displayDireccion(hero)}
            </span>
            {/* El separador solo tiene sentido si la comuna va en la misma línea */}
            <span className="hidden text-[var(--franco-text-muted)] sm:inline" aria-hidden="true">·</span>
            <span className="font-body text-[13px] text-[var(--franco-text-secondary)]">{hero.comuna}</span>
            <ModChip label={modalidadLabel(hero)} />
            <VerdictBadge verdict={veredictoDisplay(hero)} />
          </div>
          {heroResumen && (
            <p className="mt-1.5 border-t border-[var(--franco-border)] pt-1.5 font-body text-xs leading-snug text-[var(--franco-text-secondary)]">
              <span className="font-medium text-[var(--franco-text)]">Siendo franco:</span> {heroResumen}
            </p>
          )}

          {/* Pie del hero en mobile: lo que en desktop vive en la columna
              derecha (flujo · fecha · retomar) no puede desaparecer — se
              reorganiza debajo. */}
          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[var(--franco-border)] pt-2.5 md:hidden">
            <Flujo value={heroFlujo} className="min-w-0" />
            <span className="flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.05em] text-[var(--franco-text-muted)]">
                {fmtFechaRelativa(hero.created_at)}
              </span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-signal-red">
                Retomar →
              </span>
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-6 md:flex">
          {heroStr && (
            <>
              <div className="min-w-[72px] text-right">
                <div className="mb-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
                  Renta larga
                </div>
                <div className="font-mono text-sm font-medium text-[var(--franco-text)]">{hero.score_efectivo}</div>
              </div>
              <div className="min-w-[72px] text-right">
                <div className="mb-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
                  Renta corta
                </div>
                <div className="font-mono text-sm font-medium text-[var(--franco-text)]">{heroStr.score_efectivo}</div>
              </div>
            </>
          )}
          <Flujo value={heroFlujo} className="min-w-[92px]" />
          <div className="text-right">
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.05em] text-[var(--franco-text-muted)]">
              {fmtFechaRelativa(hero.created_at)}
            </div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-signal-red">
              Retomar{" "}
              <span className="franco-card-arrow inline-block" aria-hidden="true">→</span>
            </div>
          </div>
        </div>
      </Link>

      {/* ── 3 cards compactas ──
          Mobile: carrusel horizontal con snap — una card entera y el borde de
          la siguiente asomando, que es lo que comunica «hay más al lado».
          Desktop: grid de 3. */}
      {resto.length > 0 && (
        <div className="-mx-6 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {resto.map((row) => {
            const str = row.ambas_group_id ? siblings.get(row.ambas_group_id) : undefined;
            const flujo = str ? Math.max(Number(row.flujo), Number(str.flujo)) : Number(row.flujo);
            return (
              <Link
                key={row.id}
                href={hrefAnalisis(row, str?.id)}
                className="franco-card-target flex w-[86%] shrink-0 snap-start items-center gap-3 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-3 px-3.5 no-underline md:w-auto md:shrink"
              >
                <ScoreRing score={row.score_efectivo} size={40} />
                <div className="min-w-0 flex-1">
                  {/* L1: dirección | modalidad · fecha — la dirección se lleva el ancho */}
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-heading text-[13.5px] font-bold tracking-[-0.01em] text-[var(--franco-text)]">
                      {displayDireccion(row)}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      <ModChip label={modalidadLabel(row)} />
                      <span className="font-mono text-[10px] tracking-[0.05em] text-[var(--franco-text-muted)]">
                        {fmtFechaRelativa(row.created_at)}
                      </span>
                    </span>
                  </div>
                  {/* L2: veredicto | flujo */}
                  <div className="mt-1.5 flex min-w-0 items-center gap-2">
                    <VerdictBadge verdict={veredictoDisplay(row)} mini />
                    <Flujo value={flujo} className="ml-auto shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
