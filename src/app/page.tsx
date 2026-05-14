import LandingNav from "@/components/landing/LandingNav";
import SectionHero from "@/components/landing/SectionHero";
import SectionProblem from "@/components/landing/SectionProblem";
import SectionWhatFrancoDoes from "@/components/landing/SectionWhatFrancoDoes";
import SectionUseCases from "@/components/landing/SectionUseCases";
import SectionCTAPrimary from "@/components/landing/SectionCTAPrimary";
import SectionObjections from "@/components/landing/SectionObjections";
import SectionCTASecondary from "@/components/landing/SectionCTASecondary";
import SectionPricing from "@/components/landing/SectionPricing";
import SectionFinalCTA from "@/components/landing/SectionFinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Franco — ¿Y si el depto no se paga solo?",
  description:
    "Antes de invertir, ve si los números cierran. Análisis de inversión inmobiliaria con datos reales: 34.000+ deptos, arriendo largo y Airbnb, 24 comunas. Veredicto en 30 segundos.",
};

export default function LandingPage() {
  return (
    <div data-theme="light" className="min-h-screen bg-[#E8E6E1] text-[#0F0F0F]">
      <LandingNav />
      <main>
        <SectionHero />
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
  );
}
