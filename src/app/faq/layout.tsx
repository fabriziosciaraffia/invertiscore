import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Todo lo que necesitas saber sobre Franco: cómo funciona el análisis, qué incluye el Franco Score, cómo se calculan las métricas y más.",
  alternates: { canonical: "https://refranco.ai/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
