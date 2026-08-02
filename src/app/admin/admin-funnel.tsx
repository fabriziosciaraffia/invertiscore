import { fmtCLP, fmtNumber, fmtDateShort } from "@/lib/admin-format";

/**
 * Funnel de 4 etapas. Presentación pura: los conteos los calcula la página.
 *
 * El porcentaje es siempre respecto de la etapa ANTERIOR, no del total: lo que
 * interesa es dónde se cae, no cuánto queda. Puede pasar de 100% (los que pagaron
 * y los que abandonaron el checkout son conjuntos distintos, no un subconjunto);
 * se muestra tal cual en vez de recortarlo, porque un 125% dice algo real.
 */
export interface EtapaFunnel {
  valor: number;
  nombre: string;
  detalle: string;
}

export interface CheckoutAbandonado {
  paymentId: string;
  email: string;
  producto: string;
  monto: number;
  fecha: string;
  esTest: boolean;
}

function pct(actual: number, anterior: number): string | null {
  if (anterior <= 0) return null;
  return `${Math.round((actual / anterior) * 100)}%`;
}

export function AdminFunnel({
  etapas,
  abandonados,
  includeTest,
}: {
  etapas: [EtapaFunnel, EtapaFunnel, EtapaFunnel, EtapaFunnel];
  abandonados: CheckoutAbandonado[];
  includeTest: boolean;
}) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {etapas.map((e, i) => {
          const anterior = i > 0 ? etapas[i - 1].valor : null;
          const conversion = anterior != null ? pct(e.valor, anterior) : null;
          const enCero = e.valor === 0;
          return (
            <div
              key={e.nombre}
              className={`relative border-[var(--franco-border)] p-4 ${
                i < 3 ? "lg:border-r" : ""
              } ${i === 0 ? "border-r" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""}`}
            >
              <div
                className={`font-mono text-[32px] font-bold leading-none tracking-tight ${
                  enCero ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"
                }`}
              >
                {fmtNumber(e.valor)}
              </div>
              <div className="mt-1.5 font-body text-[13px] text-[var(--franco-text)]">{e.nombre}</div>
              <div className="mt-0.5 font-body text-[11px] text-[var(--franco-text-muted)]">{e.detalle}</div>
              {conversion && (
                <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-tertiary)] lg:hidden">
                  {conversion} del anterior
                </div>
              )}
              <div className="mt-3 h-[3px] overflow-hidden rounded-sm bg-[var(--franco-sunken)]">
                <span
                  className={`block h-full ${enCero ? "bg-[var(--franco-border-strong)]" : "bg-[var(--franco-text)]"}`}
                  style={{ width: `${Math.max((e.valor / max) * 100, 2)}%` }}
                />
              </div>
              {/* Pastilla de conversión entre columnas — solo desktop, donde las
                  cuatro etapas están en una fila y la lectura es horizontal. */}
              {conversion && (
                <span className="absolute right-0 top-4 z-10 hidden translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--franco-text-secondary)] lg:inline">
                  {conversion}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--franco-border)] p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          Checkouts abandonados{abandonados.length > 0 && ` · ${fmtNumber(abandonados.length)}`}
        </div>
        {abandonados.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
            {includeTest
              ? "No hay pagos pendientes con monto."
              : "Ningún usuario real llegó al checkout todavía. Los pagos pendientes de la base son de cuentas internas — activá el toggle de arriba para verlos."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Correo</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Producto</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Monto</th>
                  <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {abandonados.map((a) => (
                  <tr key={a.paymentId} className="border-t border-[var(--franco-border)]">
                    <td className="break-all py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {a.email}
                      {a.esTest && (
                        <span className="ml-2 inline-block whitespace-nowrap rounded border border-[var(--franco-border)] bg-[var(--franco-sunken)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-muted)]">
                          Interna
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text)]">{a.producto}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">{fmtCLP(a.monto)}</td>
                    <td className="py-2 font-mono text-xs text-[var(--franco-text-muted)]">{fmtDateShort(a.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
