import Link from "next/link";
import { fmtNumber } from "@/lib/admin-format";

/**
 * Toggle "incluir cuentas de prueba". Es un Link, no un input: el estado vive en
 * la URL (?test=1), así que la vista se puede compartir, marcar y volver atrás,
 * y la página sigue siendo server component.
 *
 * Apagado por defecto en las dos páginas: el panel muestra el negocio real salvo
 * que se pida explícitamente lo contrario.
 */
export function TestToggle({
  includeTest,
  href,
  className = "",
}: {
  includeTest: boolean;
  /** URL con el toggle invertido (la arma la página, que conoce sus filtros). */
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={includeTest}
      className={`inline-flex shrink-0 items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)] transition-colors hover:text-[var(--franco-text)] ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative h-[19px] w-[34px] shrink-0 rounded-full border transition-colors ${
          includeTest
            ? "border-[var(--franco-text)] bg-[var(--franco-text)]"
            : "border-[var(--franco-border-strong)] bg-[var(--franco-sunken)]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[13px] w-[13px] rounded-full transition-all ${
            includeTest ? "left-[18px] bg-white" : "left-[2px] bg-[var(--franco-text-muted)]"
          }`}
        />
      </span>
      Incluir cuentas de prueba
    </Link>
  );
}

/**
 * Barra de contexto: dice en una línea qué conjunto se está viendo y ofrece el
 * toggle. Va arriba de todo para que ningún número de la página se lea sin saber
 * si incluye las cuentas internas.
 */
export function ContextoBar({
  includeTest,
  href,
  usuarios,
  testCount,
}: {
  includeTest: boolean;
  href: string;
  usuarios: number;
  testCount: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-3.5 py-2.5">
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)]">
        {includeTest ? (
          <>
            Mostrando <b className="font-mono font-medium text-[var(--franco-text)]">{fmtNumber(usuarios)} usuarios</b>,
            incluidas las{" "}
            <b className="font-mono font-medium text-[var(--franco-text)]">{fmtNumber(testCount)} cuentas internas</b>.
          </>
        ) : (
          <>
            Mostrando{" "}
            <b className="font-mono font-medium text-[var(--franco-text)]">{fmtNumber(usuarios)} usuarios reales</b>. Se
            excluyen <b className="font-mono font-medium text-[var(--franco-text)]">{fmtNumber(testCount)}</b> cuentas
            internas.
          </>
        )}
      </p>
      <TestToggle includeTest={includeTest} href={href} />
    </div>
  );
}
