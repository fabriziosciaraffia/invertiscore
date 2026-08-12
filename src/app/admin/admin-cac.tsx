import { fmtCLP, fmtNumber } from "@/lib/admin-format";
import { costoPorConversion, type GastoMeta } from "@/lib/meta-ads";

/**
 * Bloque de CAC: gasto de Meta cruzado con NUESTRAS conversiones.
 *
 * La asimetría es deliberada. El numerador viene de Meta porque es el único que
 * sabe cuánto se gastó; los denominadores salen de auth.users, analisis y
 * payments porque son los únicos que saben qué pasó de verdad. Las conversiones
 * que reporta Meta no entran acá ni como referencia: su atribución modelada no
 * cuadra con la nuestra, y dos cifras que no cuadran hacen dudar del panel entero.
 *
 * Tres estados distintos por celda, y ninguno se disfraza de otro:
 *   · sin gasto medido  → "sin dato" (el cron no corrió o el token murió)
 *   · sin conversiones  → "sin conversiones" (hubo gasto, no hubo resultado)
 *   · con ambos         → el cociente
 */

export interface DatosCac {
  gasto: GastoMeta;
  /** Registros del período, sin cuentas de prueba. */
  registros: number;
  /** Usuarios cuyo PRIMER análisis cae en el período. */
  activaciones: number;
  /** Pagos reales del período (paid, sobre $0, sin consumos de crédito). */
  pagos: number;
  /** Días de la ventana. */
  dias: number;
  /** Cobertura de atribución: cuántos de los registros tienen fila en user_attribution. */
  conAtribucion: number;
  /** Desglose por utm_source de los registros del período, mayor primero. */
  porFuente: Array<{ fuente: string; usuarios: number }>;
}

/** Celda de costo. `null` del cálculo se traduce al texto que corresponda. */
function costoTexto(gasto: GastoMeta, conversiones: number): string {
  if (gasto.sinDato) return "sin dato";
  if (conversiones <= 0) return "sin conversiones";
  const v = costoPorConversion(gasto, conversiones);
  return v == null ? "sin dato" : fmtCLP(Math.round(v));
}

export function AdminCac({ datos }: { datos: DatosCac }) {
  const { gasto, registros, activaciones, pagos, dias, conAtribucion, porFuente } = datos;

  // La cobertura decide si el CAC se puede atribuir a Meta o es solo un promedio
  // sobre TODOS los registros. Con la mitad de la base sin UTM, presentarlo como
  // "CAC de Meta" sería atribuirle a Meta gente que llegó por otro lado.
  const coberturaPct = registros > 0 ? Math.round((100 * conAtribucion) / registros) : 0;

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          Gasto Meta Ads · últimos {dias} días
        </div>
        <div className="font-mono text-[10px] text-[var(--franco-text-tertiary)]">
          {gasto.sinDato
            ? "sin mediciones"
            : `${fmtNumber(gasto.diasConDato)} de ${fmtNumber(gasto.diasPedidos)} días medidos${
                gasto.moneda ? ` · ${gasto.moneda}` : ""
              }`}
        </div>
      </div>

      <div className="mt-1 font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]">
        {gasto.sinDato ? "sin dato" : fmtCLP(Math.round(gasto.total))}
      </div>

      {/* Un gasto de 30 días armado con 3 días medidos no es un gasto de 30 días.
          Se dice antes de que alguien divida por él. */}
      {!gasto.sinDato && gasto.diasConDato < gasto.diasPedidos && (
        <div className="mt-1 font-body text-[11px] text-[var(--franco-text-muted)]">
          Faltan {fmtNumber(gasto.diasPedidos - gasto.diasConDato)} días de medición: el gasto real del
          período es mayor y los costos de abajo quedan subestimados.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--franco-border)] bg-[var(--franco-border)] sm:grid-cols-3">
        <Celda
          valor={costoTexto(gasto, registros)}
          label="Por registro"
          sub={`${fmtNumber(registros)} registros`}
        />
        <Celda
          valor={costoTexto(gasto, activaciones)}
          label="Por activación"
          sub={`${fmtNumber(activaciones)} generaron su primer análisis`}
        />
        <Celda
          valor={costoTexto(gasto, pagos)}
          label="Por pago"
          sub={`${fmtNumber(pagos)} pagos reales`}
        />
      </div>

      {/* Atribución: se muestra lo que se sabe y, sobre todo, lo que no. */}
      <div className="mt-3 border-t border-dashed border-[var(--franco-border)] pt-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          De dónde llegaron
        </div>
        {registros === 0 ? (
          <div className="mt-1 font-body text-[12px] text-[var(--franco-text-muted)]">
            Sin registros en el período.
          </div>
        ) : conAtribucion === 0 ? (
          <div className="mt-1 font-body text-[12px] text-[var(--franco-text-muted)]">
            Ninguno de los {fmtNumber(registros)} registros del período tiene UTM guardado. Los costos de
            arriba son sobre TODO el tráfico, no solo el de Meta.
          </div>
        ) : (
          <>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {porFuente.map((f) => (
                <span key={f.fuente} className="font-mono text-[12px] text-[var(--franco-text)]">
                  {f.fuente}
                  <span className="ml-1 text-[var(--franco-text-muted)]">{fmtNumber(f.usuarios)}</span>
                </span>
              ))}
            </div>
            <div className="mt-1.5 font-body text-[11px] text-[var(--franco-text-muted)]">
              {coberturaPct}% de los registros del período tiene atribución
              {coberturaPct < 100 && (
                <>
                  {" "}
                  — al {100 - coberturaPct}% restante no se le puede asignar canal, así que los costos de
                  arriba se calculan sobre todos los registros y no solo sobre los de Meta.
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Celda({ valor, label, sub }: { valor: string; label: string; sub: string }) {
  return (
    <div className="bg-[var(--franco-card)] p-3">
      <div className="truncate font-mono text-[18px] font-bold text-[var(--franco-text)]" title={valor}>
        {valor}
      </div>
      <div className="mt-0.5 font-body text-[12px] text-[var(--franco-text)]">{label}</div>
      <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-tertiary)]">{sub}</div>
    </div>
  );
}
