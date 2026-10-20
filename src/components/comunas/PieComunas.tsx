import Link from "next/link";
import { AppFooter, ENLACES_PIE } from "@/components/chrome/AppFooter";

/**
 * El pie de las páginas de comuna (20-oct-2026): el de planes y del semanal (`informe`: el wordmark y el aviso, sin la
 * frase en mono) con los mismos enlaces del sitio que tenía el pie `minimal` —son enlaces internos de 27 páginas
 * públicas y no se pierden—, en Inter como el resto. Sin la frase en mono, la página ya no baja JetBrains Mono.
 */
export function PieComunas() {
  return (
    <AppFooter
      variant="informe"
      linksSlot={
        <nav aria-label="Franco" className="cm-pie">
          {ENLACES_PIE.map((e) => (
            <Link key={e.href} href={e.href}>
              {e.rotulo}
            </Link>
          ))}
        </nav>
      }
    />
  );
}
