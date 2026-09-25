import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Analiza departamentos gratis con Franco. Desbloquea el análisis con datos reales: veredicto, proyecciones a 10 años y escenarios de salida.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
