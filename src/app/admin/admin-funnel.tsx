import { fmtCLP, fmtNumber, fmtDateShort } from "@/lib/admin-format";

/**
 * Checkouts abandonados: quién llegó a pagar y no terminó.
 *
 * Este archivo tenía además el funnel de 7 etapas dibujado como barras
 * horizontales. Las barras se fueron a `admin-sankey.tsx`: mostraban la
 * secuencia pero no la BIFURCACIÓN, y desde el cap anónimo el embudo dejó de
 * ser una fila india — se puede probar el producto sin cuenta, así que hay dos
 * caminos que se separan y vuelven a juntarse. Una barra por etapa no puede
 * decir eso; un Sankey sí.
 *
 * La tabla se quedó acá tal cual: es la única parte del bloque que no era una
 * representación del funnel sino un listado accionable.
 */
export interface CheckoutAbandonado {
  paymentId: string;
  email: string;
  producto: string;
  monto: number;
  fecha: string;
  esTest: boolean;
}

export function AdminCheckoutsAbandonados({
  abandonados,
  includeTest,
}: {
  abandonados: CheckoutAbandonado[];
  includeTest: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
        Checkouts abandonados{abandonados.length > 0 && ` · ${fmtNumber(abandonados.length)}`}
      </div>
      {abandonados.length === 0 ? (
        <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
          {includeTest
            ? "No hay pagos pendientes con monto."
            : "Ningún usuario real llegó al checkout todavía. Los pagos pendientes de la base son de cuentas internas — activa el toggle de arriba para verlos."}
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
  );
}
