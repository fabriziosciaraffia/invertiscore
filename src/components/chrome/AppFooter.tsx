import type { ReactNode } from "react";
import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

/** Los enlaces largos del sitio. Salieron del header único el 27-sep-2026 (decisión 1 del
 *  mockup aprobado): viven en el pie, como en la landing v14. */
const ENLACES_PIE = [
  { href: "/metodologia", rotulo: "Cómo calcula" },
  { href: "/comunas", rotulo: "Comunas" },
  { href: "/pricing", rotulo: "Planes" },
] as const;

// Disclaimer canonico unificado — antes habia 2 variantes y ausencias.
// Cambios materiales: agrega obligacion de verificar datos + clausula
// 'no reemplaza opinion profesional'. Voz tuteo neutro chileno (§2.1).
export const DISCLAIMER_CANONICO =
  "Análisis informativo, no constituye asesoría financiera. Verifica los datos antes de tomar decisiones. Refranco no garantiza resultados ni reemplaza la opinión de un profesional.";

interface AppFooterProps {
  variant: "minimal" | "rich";
  showLogo?: boolean;
  linksSlot?: ReactNode;
}

export function AppFooter({
  variant,
  showLogo = true,
  linksSlot,
}: AppFooterProps) {
  // rich tiene mas aire vertical (3-col grids, varios bloques de links).
  const gapClass = variant === "rich" ? "gap-8" : "gap-5";

  return (
    <footer
      className="py-9 px-4 sm:px-6"
      style={{ borderTop: "0.5px solid var(--franco-border)" }}
    >
      <div className={`mx-auto max-w-[1100px] flex flex-col ${gapClass}`}>
        {showLogo && (
          <div
            className="flex flex-col items-start gap-1.5"
            style={{ opacity: 0.6 }}
          >
            <FrancoLogo inverted size="sm" href="/" />
            <p
              className="font-mono uppercase m-0"
              style={{
                fontSize: 9,
                letterSpacing: "0.06em",
                color: "var(--franco-text-secondary)",
              }}
            >
              Real estate en su estado más franco
            </p>
          </div>
        )}
        <nav aria-label="Franco" className="flex flex-wrap gap-x-5 gap-y-2">
          {ENLACES_PIE.map((e) => (
            <Link key={e.href} href={e.href} className="font-body text-[13px] font-medium text-[var(--franco-text-secondary)] no-underline transition-colors hover:text-[var(--franco-text)]">
              {e.rotulo}
            </Link>
          ))}
        </nav>
        {linksSlot}
        <p
          className="font-body text-[11px] m-0 leading-[1.6]"
          style={{ color: "var(--franco-text-tertiary)" }}
        >
          {DISCLAIMER_CANONICO}
        </p>
      </div>
    </footer>
  );
}
