import { fmtCLP, fmtNumber, fmtDateShort } from "@/lib/admin-format";

/**
 * Funnel de 4 etapas con barras horizontales PROPORCIONALES al valor.
 *
 * Antes eran cuatro cajas del mismo tamaño con el número adentro, que es
 * exactamente lo que un funnel no debe ser: si todas las etapas se ven iguales,
 * la forma no dice nada y hay que leer los números uno por uno.
 *
 * Entre etapa y etapa va la caída en usuarios Y en porcentaje ("−16 usuarios ·
 * −33%"), no la conversión: el dato accionable es cuánta gente se pierde, no
 * cuánta sobrevive.
 */
export interface EtapaFunnel {
  valor: number;
  nombre: string;
  detalle: string;
  /** Qué hizo (o no hizo) la gente que se cayó acá. Se muestra en la banda de caída. */
  caida: string;
  /** Fase B (funnel 7 pasos): la fuente externa no respondió — se pinta "—" y
   *  la etapa queda fuera de barras y caídas. Fail-soft de PostHog: el funnel
   *  3-7 vive aunque 1-2 estén mudos. */
  sinDatos?: boolean;
  /** Desglose bajo el detalle (ej: "12 anónimos · 3 welcome"). */
  desglose?: string;
  /** Edad del dato para las etapas de fuente cacheada (ej: "actualizado hace
   *  3 min"). Sin etiqueta, un número cacheado se lee como número congelado —
   *  que es exactamente la confusión que originó este campo. */
  frescura?: string;
}

export interface CheckoutAbandonado {
  paymentId: string;
  email: string;
  producto: string;
  monto: number;
  fecha: string;
  esTest: boolean;
}

export function AdminFunnel({
  etapas,
  abandonados,
  includeTest,
}: {
  etapas: EtapaFunnel[];
  abandonados: CheckoutAbandonado[];
  includeTest: boolean;
}) {
  // La barra es proporcional a la primera etapa CON DATOS, no al máximo: el
  // funnel se lee como fracción del total que entró. Con PostHog mudo (1-2 en
  // sinDatos), la base cae a la primera etapa Supabase y la forma sigue viva.
  const primeraConDatos = etapas.find((e) => !e.sinDatos);
  const base = Math.max(primeraConDatos?.valor ?? 0, 1);

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)]">
      {etapas.map((e, i) => {
        const etapaAnterior = i > 0 ? etapas[i - 1] : null;
        const anterior = etapaAnterior && !etapaAnterior.sinDatos ? etapaAnterior.valor : null;
        const caidaMedible = anterior != null && !e.sinDatos;
        const perdidos = caidaMedible ? anterior - e.valor : null;
        const pctCaida = caidaMedible && anterior > 0 ? Math.round((perdidos! / anterior) * 100) : null;
        const enCero = !e.sinDatos && e.valor === 0;

        return (
          <div key={e.nombre}>
            {/* Banda de caída, entre la etapa anterior y esta */}
            {etapaAnterior != null && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-[var(--franco-border)] bg-[var(--franco-sunken)] px-4 py-1.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
                <span aria-hidden="true" className="text-[var(--franco-text-muted)]">
                  ↓
                </span>
                {!caidaMedible ? (
                  <span className="text-[var(--franco-text-muted)]">
                    caída no medible: falta el dato de una de las dos etapas
                  </span>
                ) : anterior === 0 ? (
                  <span className="text-[var(--franco-text-muted)]">
                    sin caída que medir: la etapa anterior está en cero
                  </span>
                ) : (
                  <>
                    <b className="font-medium text-[var(--signal-red)]">
                      −{fmtNumber(perdidos!)} {perdidos === 1 ? "usuario" : "usuarios"} · −{pctCaida}%
                    </b>
                    <span className="text-[var(--franco-text-muted)]">{e.caida}</span>
                  </>
                )}
              </div>
            )}

            <div className={`border-t border-[var(--franco-border)] px-4 py-3.5 first:border-t-0 ${i === 0 ? "border-t-0" : ""}`}>
              <div className="flex items-baseline justify-between gap-3.5">
                <div className="min-w-0">
                  <div
                    className={`font-body text-sm ${enCero || e.sinDatos ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"}`}
                  >
                    {e.nombre}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
                    {e.detalle}
                  </div>
                  {e.frescura && (
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
                      {e.frescura}
                    </div>
                  )}
                  {e.desglose && (
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">
                      {e.desglose}
                    </div>
                  )}
                </div>
                <div
                  className={`shrink-0 font-mono text-[22px] font-bold tracking-tight ${
                    enCero || e.sinDatos ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"
                  }`}
                  title={e.sinDatos ? "PostHog no respondió — el resto del funnel no depende de este dato" : undefined}
                >
                  {e.sinDatos ? "—" : fmtNumber(e.valor)}
                </div>
              </div>
              <div className="mt-2 h-[26px] overflow-hidden rounded bg-[var(--franco-sunken)]">
                <span
                  className={`block h-full rounded ${enCero || e.sinDatos ? "bg-[var(--franco-border-strong)]" : "bg-[var(--franco-text)]"}`}
                  style={{ width: e.sinDatos ? "0%" : `${Math.min((e.valor / base) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="border-t border-[var(--franco-border)] p-4">
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
    </div>
  );
}
