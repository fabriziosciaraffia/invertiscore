import Link from "next/link";
import { fmtNumber } from "@/lib/admin-format";
import { fmtSegmento, type AdminSegmento } from "@/lib/admin-rpc";

/**
 * Distribución de usuarios por segmento.
 *
 * Sin Recharts a propósito: con seis categorías y una sola dimensión, el número
 * es el dato y la barra solo da proporción relativa. Una librería de charts acá
 * suma peso al bundle y no agrega lectura. Si algún día hay series temporales,
 * ese es el caso donde Recharts sí paga.
 *
 * Se listan siempre los seis, incluso en cero: un segmento vacío es información
 * (y así las filas no saltan de posición cuando alguien entra o sale).
 */
export function AdminSegmentos({
  metrics,
  includeTest,
}: {
  metrics: Array<{ segmento: AdminSegmento; usuarios: number }>;
  includeTest: boolean;
}) {
  const max = Math.max(...metrics.map((m) => m.usuarios), 1);

  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
      <div className="flex flex-col">
        {metrics.map((m) => {
          const enCero = m.usuarios === 0;
          const href = `/admin/usuarios?segmento=${m.segmento}${includeTest ? "&test=1" : ""}`;
          return (
            <Link
              key={m.segmento}
              href={href}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[var(--franco-border)] py-2.5 first:border-t-0 sm:grid-cols-[150px_1fr_62px] sm:gap-3.5"
            >
              <span
                className={`font-body text-[13px] ${
                  enCero ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"
                }`}
              >
                {fmtSegmento(m.segmento)}
              </span>
              {/* La barra se esconde en mobile: con el ancho de un teléfono
                  quedaría de pocos píxeles y no comunicaría proporción. */}
              <span className="hidden h-2 overflow-hidden rounded-sm bg-[var(--franco-sunken)] sm:block">
                <span
                  className="block h-full bg-[var(--franco-text)]"
                  style={{ width: `${(m.usuarios / max) * 100}%` }}
                />
              </span>
              <span
                className={`text-right font-mono text-sm font-medium ${
                  enCero ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"
                }`}
              >
                {fmtNumber(m.usuarios)}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 border-t border-[var(--franco-border)] pt-2.5 font-body text-xs text-[var(--franco-text-muted)]">
        Cada fila abre la lista de usuarios ya filtrada por ese segmento.
      </p>
    </div>
  );
}
