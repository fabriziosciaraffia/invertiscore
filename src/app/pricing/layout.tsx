import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Analiza departamentos gratis con Franco. Desbloquea el análisis con IA: veredicto, proyecciones a 20 años y escenarios de salida.",
  alternates: { canonical: "https://refranco.ai/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
