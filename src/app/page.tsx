import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import SmoothScroll from "@/components/landing/SmoothScroll";
import { LandingThemeProvider } from "@/components/landing/LandingTheme";
import SectionHero from "@/components/landing/SectionHero";
import SectionProblem from "@/components/landing/SectionProblem";
import SectionWhatFrancoIs from "@/components/landing/SectionWhatFrancoIs";
import SectionWhatFrancoDoes from "@/components/landing/SectionWhatFrancoDoes";
import SectionUseCases from "@/components/landing/SectionUseCases";
import SectionCTAPrimary from "@/components/landing/SectionCTAPrimary";
import SectionObjections from "@/components/landing/SectionObjections";
import SectionCTASecondary from "@/components/landing/SectionCTASecondary";
import SectionPricing from "@/components/landing/SectionPricing";
import SectionFinalCTA from "@/components/landing/SectionFinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";
import { PROPERTIES_COUNT } from "@/lib/stats";

export const metadata = {
  title: "Franco — ¿Y si el depto no se paga solo?",
  description: `Antes de invertir, ve si los números cierran. Análisis de inversión inmobiliaria con datos reales: ${PROPERTIES_COUNT} deptos, arriendo largo y Airbnb, 24 comunas. Veredicto en 30 segundos.`,
};

export default function LandingPage() {
  return (
    <LandingThemeProvider>
      <div
        data-franco-root
        className="min-h-screen"
        style={{ background: "var(--landing-bg)", color: "var(--landing-text)" }}
      >
        <SmoothScroll />
        <UnifiedNav variant="landing" />
        <main>
          <SectionHero />
          <SectionWhatFrancoIs />
          <SectionProblem />
          <SectionWhatFrancoDoes />
          <SectionUseCases />
          <SectionCTAPrimary />
          <SectionObjections />
          <SectionCTASecondary />
          <SectionPricing />
          <SectionFinalCTA />
        </main>
        <LandingFooter />
      </div>
    </LandingThemeProvider>
  );
}
