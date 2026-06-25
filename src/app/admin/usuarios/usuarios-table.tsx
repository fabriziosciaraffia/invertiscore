"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtNumber, fmtRelative, fmtDateShort } from "@/lib/admin-format";

// Fila serializable que arma el server component. Solo datos planos: el render
// (badges, links, formatters) ocurre acá en cliente para permitir el buscador
// client-side sin endpoint nuevo.
export interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  saldo: number;
  isUnlimited: boolean;
  subscriptionStatus: string;
  activePlan: string | null;
  lastComuna: string | null;
  lastAnalisisAt: string | null;
  createdAt: string | null;
}

function SaldoCell({ row }: { row: UsuarioRow }) {
  // is_unlimited es ESTADO, no número.
  if (row.isUnlimited) {
    return <StatusBadge label="Ilimitado" tone="ink-400" className="text-[10px]" />;
  }
  // Suscriptor activo con plan finito → badge del plan + número de saldo.
  if (row.subscriptionStatus === "active") {
    const planLabel = row.activePlan ? `Plan ${row.activePlan}` : "Suscriptor";
    return (
      <span className="inline-flex items-center gap-2">
        <StatusBadge label={planLabel} tone="ink-400" className="text-[10px]" />
        <span className="font-mono text-xs text-[var(--franco-text)]">{fmtNumber(row.saldo)}</span>
      </span>
    );
  }
  return <span className="font-mono text-xs text-[var(--franco-text)]">{fmtNumber(row.saldo)}</span>;
}

export function UsuariosTable({ rows }: { rows: UsuarioRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por correo…"
          className="w-full max-w-sm rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2 font-mono text-sm text-[var(--franco-text)] outline-none focus:border-[var(--ink-400)]"
        />
        <span className="font-body text-xs text-[var(--franco-text-muted)] shrink-0">
          {fmtNumber(filtered.length)} de {fmtNumber(rows.length)}
        </span>
      </div>

      <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Nombre</th>
              <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Correo</th>
              <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Saldo</th>
              <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2 pr-4">Último análisis</th>
              <th className="font-body text-xs font-medium text-[var(--franco-text-muted)] pb-2">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="font-body text-sm text-[var(--franco-text-muted)] py-3">
                  {rows.length === 0 ? "Sin usuarios." : "Sin resultados para la búsqueda."}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                <td className="font-body text-xs text-[var(--franco-text)] py-2 pr-4">
                  <Link href={`/admin/usuarios/${r.id}`} className="hover:text-[#C8323C] transition-colors">
                    {r.nombre || "—"}
                  </Link>
                </td>
                <td className="font-mono text-xs text-[var(--franco-text)] py-2 pr-4 truncate max-w-[240px]">
                  <Link href={`/admin/usuarios/${r.id}`} className="hover:text-[#C8323C] transition-colors">
                    {r.email || "—"}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <SaldoCell row={r} />
                </td>
                <td className="font-body text-xs text-[var(--franco-text)] py-2 pr-4">
                  {r.lastComuna ? (
                    <span>
                      {r.lastComuna}
                      <span className="font-mono text-[10px] text-[var(--franco-text-muted)] ml-2">
                        {fmtRelative(r.lastAnalisisAt)}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="font-mono text-xs text-[var(--franco-text)] py-2">
                  {fmtDateShort(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
