import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Analiza departamentos gratis con Franco. Desbloquea el informe completo con IA, proyecciones a 20 años y escenarios de salida desde $4.990.",
  alternates: { canonical: "https://refranco.ai/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
