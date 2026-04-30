import type { ReactNode } from "react";
import FrancoLogo from "@/components/franco-logo";

// Disclaimer canonico unificado — antes habia 2 variantes y ausencias.
// Cambios materiales: agrega obligacion de verificar datos + clausula
// 'no reemplaza opinion profesional'.
export const DISCLAIMER_CANONICO =
  "Análisis informativo, no constituye asesoría financiera. Verificá los datos antes de tomar decisiones. Refranco no garantiza resultados ni reemplaza la opinión de un profesional.";

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
              Re franco con tu inversión
            </p>
          </div>
        )}
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
