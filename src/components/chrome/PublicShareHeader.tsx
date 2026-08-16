"use client";

/**
 * PublicShareHeader — chrome mínimo para vistas compartidas públicas
 * (AMBAS / análisis compartidos vistos por un guest). Presentacional, sin
 * lógica de auth: no muestra acciones de la app, solo identidad + un acceso
 * sutil a login.
 *
 * Extraído del header inline de `share/comparativa/[token]/shared-client.tsx`.
 *
 * No es sticky (a diferencia de UnifiedNav): es un header de cierre de marca,
 * no un nav de navegación. Tokens --franco-* → responde a claro/oscuro.
 */

import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export function PublicShareHeader({
  date,
  anonOwner = false,
  registerNext,
}: {
  date?: string;
  /**
   * Variante ANÓNIMO-DUEÑO (cap anónimo F2-2): el visitante ES el creador del
   * análisis, sin cuenta. El marcador dice "TU ANÁLISIS" y la acción derecha
   * pasa de link sutil de login a CTA de registro para guardarlo — es la única
   * forma de volver a verlo después (el análisis no queda atado a nada más que
   * la cookie de este navegador).
   */
  anonOwner?: boolean;
  /** Destino del round-trip de registro (la URL de ESTE análisis). */
  registerNext?: string;
}) {
  return (
    <header
      style={{
        background: "var(--franco-bg)",
        borderBottom: "0.5px solid var(--franco-border)",
      }}
    >
      <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* IZQ — logo + marcador */}
        <div className="flex min-w-0 items-center gap-4">
          <FrancoLogo inverted size="header" href="/" />
          <div className="min-w-0 border-l border-[var(--franco-border)] pl-4">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--franco-text-muted)]">
              {anonOwner ? "TU ANÁLISIS" : "ANÁLISIS COMPARTIDO"}
            </p>
            {date && (
              <p className="truncate font-body text-[12px] text-[var(--franco-text-secondary)]">
                {date}
              </p>
            )}
          </div>
        </div>

        {/* DER — anónimo-dueño: CTA de guardado; si no, acceso sutil a login */}
        {anonOwner ? (
          <Link
            href={`/register?next=${encodeURIComponent(registerNext || "/dashboard")}`}
            className="shrink-0 self-center rounded-lg bg-signal-red px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-signal-red/90"
          >
            Crear cuenta para guardarlo
          </Link>
        ) : (
          <Link
            href="/login"
            className="shrink-0 self-center font-body text-sm text-[var(--franco-text-secondary)] transition-colors hover:text-[var(--franco-text)]"
          >
            Ingresar
          </Link>
        )}
      </div>
    </header>
  );
}

export default PublicShareHeader;
