import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Banner de subordinación AMBAS (migración 20260715). Un hijo (LTR o STR) que
 * pertenece a un análisis "Ambas" no es un análisis independiente: es el detalle
 * de respaldo de un comparativo. Este banner lo declara y ofrece el retorno al
 * comparativo (que es el producto que el usuario compró).
 *
 * `href` apunta a /analisis/comparativa?ltr=&str= con los ids del par.
 */
export function SubordinatedBanner({
  href,
  modalidad,
}: {
  href: string;
  modalidad: "LTR" | "STR";
}) {
  const label = modalidad === "LTR" ? "renta larga" : "renta corta";
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wide" style={{ padding: "3px 8px", background: "color-mix(in srgb, var(--franco-text) 10%, transparent)", color: "var(--franco-text)" }}>
          AMBAS
        </span>
        <p className="font-body text-[13px] leading-snug text-[var(--franco-text-secondary)]">
          <span className="font-medium text-[var(--franco-text)]">Este es el detalle de {label}</span> de una comparativa.
          Vívelo desde el comparativo — ahí decides qué modalidad conviene.
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--franco-border)] px-3.5 py-2 font-body text-[13px] font-medium text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-hover)]"
      >
        <ArrowLeft size={14} />
        Volver a la comparativa
      </Link>
    </div>
  );
}
