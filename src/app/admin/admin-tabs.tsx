"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pestañas del panel. Cliente porque necesita `usePathname` para marcar la activa
 * (el layout que la monta sigue siendo server component).
 *
 * "Finanzas" está declarada y deshabilitada a propósito: deja el patrón visible
 * para la próxima pestaña sin fingir que ya existe.
 */
const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/operacion", label: "Operación" },
] as const;

export function AdminTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="mx-auto flex max-w-[1200px] items-end gap-0.5 overflow-x-auto px-4 sm:px-6">
      {TABS.map((t) => {
        // /admin solo matchea exacto; /admin/usuarios matchea también la ficha
        // de un usuario (/admin/usuarios/[id]).
        const activa = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activa ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3.5 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              activa
                ? "border-[var(--signal-red)] text-[var(--franco-text)]"
                : "border-transparent text-[var(--franco-text-muted)] hover:text-[var(--franco-text)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
      <span
        aria-disabled="true"
        className="shrink-0 cursor-default border-b-2 border-transparent px-3.5 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--franco-border-strong)]"
      >
        Finanzas
        <span className="ml-1.5 rounded border border-[var(--franco-border)] px-1 py-px text-[8px] tracking-wider">
          Pronto
        </span>
      </span>
    </nav>
  );
}
