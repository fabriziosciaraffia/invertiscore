import Link from "next/link";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { fmtNumber, fmtRelative, fmtDateShort } from "@/lib/admin-format";
import { fmtSegmento } from "@/lib/admin-rpc";

/**
 * Fila ya resuelta por el server component. Server component también: el buscador
 * client-side se retiró (ahora filtra la RPC), así que no queda estado local que
 * justifique bajar esto al cliente.
 *
 * No hay columna "nombre": admin_list_users no devuelve user_metadata, y
 * resolverlo por fila sería un getUserById por usuario — justo el N+1 que este
 * refactor vino a matar. El nombre sigue en la ficha (/admin/usuarios/[id]).
 */
export interface UsuarioRow {
  id: string;
  email: string;
  saldo: number;
  isUnlimited: boolean;
  isTestUser: boolean;
  segmento: string;
  analisisTotal: number;
  ultimoAnalisis: string | null;
  createdAt: string | null;
}

/**
 * Tono del badge de segmento. Sin Signal Red: churn es atención, no criticidad
 * financiera, y la regla del rojo (franco-design-system, Capa 1) reserva el acento
 * para veredictos y montos negativos. La jerarquía la hace la escala Ink.
 */
function tonoSegmento(segmento: string): StatusBadgeTone {
  switch (segmento) {
    case "admin_ilimitado":
    case "suscriptor_activo":
      return "ink-400";
    case "suscriptor_churn":
      return "ink-700";
    case "comprador":
      return "ink-500";
    default:
      return "muted";
  }
}

function Saldo({ row }: { row: UsuarioRow }) {
  // is_unlimited es estado, no número: un "0" ahí se leería como sin saldo.
  if (row.isUnlimited) {
    return (
      <span className="font-mono text-sm text-[var(--franco-text)]" title="Ilimitado">
        ∞
      </span>
    );
  }
  return <span className="font-mono text-xs text-[var(--franco-text)]">{fmtNumber(row.saldo)}</span>;
}

function BadgeInterna() {
  return (
    <span className="ml-2 inline-block whitespace-nowrap rounded border border-[var(--franco-border)] bg-[var(--franco-sunken)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-muted)]">
      Interna
    </span>
  );
}

export function UsuariosTable({ rows }: { rows: UsuarioRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 font-body text-sm text-[var(--franco-text-muted)]">
        Sin usuarios para este filtro. Probá con otro segmento, limpiá la búsqueda o incluí las cuentas de prueba.
      </div>
    );
  }

  return (
    <>
      {/* ─── Desktop: tabla ─── */}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Correo</th>
              <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Segmento</th>
              <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Saldo</th>
              <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Análisis</th>
              <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">
                Último análisis
              </th>
              <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/admin/usuarios/${r.id}`}
                    className="font-mono text-xs text-[var(--franco-text)] transition-colors hover:text-[#C8323C]"
                  >
                    {r.email || "—"}
                  </Link>
                  {r.isTestUser && <BadgeInterna />}
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge
                    label={fmtSegmento(r.segmento)}
                    tone={tonoSegmento(r.segmento)}
                    className="text-[10px]"
                  />
                </td>
                <td className="py-2.5 pr-4">
                  <Saldo row={r} />
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-[var(--franco-text)]">
                  {fmtNumber(r.analisisTotal)}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-[var(--franco-text-muted)]">
                  {fmtRelative(r.ultimoAnalisis)}
                </td>
                <td className="py-2.5 font-mono text-xs text-[var(--franco-text-muted)]">
                  {fmtDateShort(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile: cards ─── */}
      {/* La tabla de 6 columnas en 380px obliga a scroll horizontal y esconde el
          saldo, que es el dato que se viene a mirar. Cada fila pasa a card con el
          correo arriba y los cuatro datos en grilla 2x2. */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/usuarios/${r.id}`}
            className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-3.5 transition-colors hover:border-[var(--franco-border-hover)]"
          >
            <div className="flex items-start justify-between gap-2.5">
              <span className="break-all font-mono text-xs leading-relaxed text-[var(--franco-text)]">
                {r.email || "—"}
                {r.isTestUser && <BadgeInterna />}
              </span>
              <StatusBadge
                label={fmtSegmento(r.segmento)}
                tone={tonoSegmento(r.segmento)}
                className="shrink-0 text-[9px]"
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2.5 border-t border-[var(--franco-border)] pt-2.5">
              <CampoCard label="Saldo">
                <Saldo row={r} />
              </CampoCard>
              <CampoCard label="Análisis">{fmtNumber(r.analisisTotal)}</CampoCard>
              <CampoCard label="Último análisis">{fmtRelative(r.ultimoAnalisis)}</CampoCard>
              <CampoCard label="Registrado">{fmtDateShort(r.createdAt)}</CampoCard>
            </dl>
          </Link>
        ))}
      </div>
    </>
  );
}

function CampoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">{label}</dt>
      <dd className="mt-0.5 font-mono text-[13px] text-[var(--franco-text)]">{children}</dd>
    </div>
  );
}
