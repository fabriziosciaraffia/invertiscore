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

export function PublicShareHeader({ date }: { date?: string }) {
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
              ANÁLISIS COMPARTIDO
            </p>
            {date && (
              <p className="truncate font-body text-[12px] text-[var(--franco-text-secondary)]">
                {date}
              </p>
            )}
          </div>
        </div>

        {/* DER — acceso sutil a login (link, no botón) */}
        <Link
          href="/login"
          className="shrink-0 self-center font-body text-sm text-[var(--franco-text-secondary)] transition-colors hover:text-[var(--franco-text)]"
        >
          Ingresar
        </Link>
      </div>
    </header>
  );
}

export default PublicShareHeader;
