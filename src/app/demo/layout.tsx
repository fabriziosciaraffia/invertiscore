import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — Análisis de ejemplo",
  description: "Mira un análisis completo de Franco en acción. Franco Score, métricas financieras, comparación con la zona y análisis con IA.",
  alternates: { canonical: "https://refranco.ai/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
