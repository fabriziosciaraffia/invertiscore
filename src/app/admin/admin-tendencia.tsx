import { fmtNumber } from "@/lib/admin-format";
import type { AdminSemana } from "@/lib/admin-rpc";
import { AdminTendenciaChart, type PuntoSemana } from "./admin-tendencia-chart";

/** "2026-07-27" → "27 jul". Parseo manual: `new Date("YYYY-MM-DD")` es UTC y en
 *  Chile (UTC−4) retrocede un día al formatear en horario local. */
function fmtSemana(semana: string): string {
  const [, mes, dia] = semana.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const nombreMes = meses[Number.parseInt(mes, 10) - 1] ?? "";
  return `${Number.parseInt(dia, 10)} ${nombreMes}`;
}

/**
 * Bloque de tendencia: la pieza que no existía. Arriba el gráfico de la serie,
 * abajo la cohorte por semana de registro.
 *
 * En la tabla solo van las semanas CON registros: una fila "0 registrados, 0
 * activaron, tasa —" no dice nada y empuja las filas con datos fuera de pantalla.
 * En el gráfico sí aparecen todas, porque ahí el hueco es la información.
 */
export function AdminTendencia({ semanas }: { semanas: AdminSemana[] }) {
  const datos: PuntoSemana[] = semanas.map((s) => ({
    label: fmtSemana(s.semana),
    registros: s.registros,
    activaciones: s.activaciones,
  }));

  const cohortes = semanas
    .filter((s) => s.registros > 0)
    .slice()
    .reverse();

  const semanasVacias = semanas.length - cohortes.length;

  if (semanas.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 font-body text-sm text-[var(--franco-text-muted)]">
        Sin datos de tendencia. Si el panel es nuevo, falta correr{" "}
        <span className="font-mono text-xs">docs/sql/admin-panel-rpcs.sql</span> en Supabase.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      <div className="px-2 pb-1 pt-4 sm:px-4">
        <AdminTendenciaChart datos={datos} />
      </div>

      <div className="flex flex-wrap gap-4 px-4 pb-3.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)] sm:gap-5">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--franco-text)]" />
          Registros
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--ink-400)]" />
          Activaciones (primer análisis)
        </span>
      </div>

      <div className="border-t border-[var(--franco-border)] p-4">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          Cohorte por semana de registro
        </div>
        {cohortes.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
            Ninguna semana del período tuvo registros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Semana</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">
                    Registrados
                  </th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Activaron</th>
                  <th className="pb-2 text-right font-body text-xs font-medium text-[var(--franco-text-muted)]">
                    Tasa
                  </th>
                </tr>
              </thead>
              <tbody>
                {cohortes.map((s) => {
                  const tasa = Math.round((s.cohorte_activados / s.registros) * 100);
                  return (
                    <tr key={s.semana} className="border-t border-[var(--franco-border)]">
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">{fmtSemana(s.semana)}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                        {fmtNumber(s.registros)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                        {fmtNumber(s.cohorte_activados)}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          aria-hidden="true"
                          className="mr-2 hidden h-1.5 w-[52px] overflow-hidden rounded-sm bg-[var(--franco-sunken)] align-middle sm:inline-block"
                        >
                          <span className="block h-full bg-[var(--franco-text)]" style={{ width: `${tasa}%` }} />
                        </span>
                        <span className="font-mono text-xs text-[var(--franco-text)]">{tasa}%</span>
                      </td>
                    </tr>
                  );
                })}
                {semanasVacias > 0 && (
                  <tr className="border-t border-[var(--franco-border)]">
                    <td colSpan={4} className="py-2 font-body text-xs text-[var(--franco-text-muted)]">
                      Las {semanasVacias} semanas sin registros no se listan acá; en el gráfico sí aparecen, porque el
                      hueco es parte de la historia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
