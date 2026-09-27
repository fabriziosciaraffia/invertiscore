import { HeaderFranco } from "@/components/chrome/HeaderFranco";
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
 *
 * Desde el 27-sep-2026 arriba va el header único (HeaderFranco): su wordmark ya lleva al
 * dashboard, así que «← Volver al sitio» salió. Debajo queda la barra propia del panel —el rótulo
 * y las pestañas—, que no es un header: es navegación interna.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco />
      <div className="border-b border-[var(--franco-border)] bg-[var(--franco-card)]">
        <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6">
          <p className="m-0 font-body text-[12.5px] font-medium text-[var(--franco-text-tertiary)]">Panel de administración</p>
        </div>
        <AdminTabs />
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
