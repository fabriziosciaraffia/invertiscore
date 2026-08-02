import Link from "next/link";
import { AdminTabs } from "./admin-tabs";

/**
 * Chrome compartido del panel admin: wordmark + pestañas + salida al sitio.
 *
 * Antes cada página repetía su propio header y no había forma de llegar a
 * /admin/usuarios sin escribir la URL a mano. El layout deja el patrón armado
 * para sumar pestañas (Finanzas es el próximo slot, ya declarado y apagado).
 *
 * El layout NO recibe searchParams (limitación de Next), así que el toggle de
 * cuentas de prueba vive en cada página, no acá.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <header className="border-b border-[var(--franco-border)] bg-[var(--franco-card)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-2 px-4 pt-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-lg">
              <span className="font-light italic opacity-30">re</span>
              <span className="font-bold">franco</span>
              <span className="font-body text-sm font-medium text-[var(--signal-red)]">.ai</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
              Panel de administración
            </span>
          </div>
          <Link
            href="/dashboard"
            className="font-body text-sm text-[var(--franco-text-muted)] transition-colors hover:text-[var(--franco-text)]"
          >
            ← Volver al sitio
          </Link>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
